import importlib.util
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('publish_artifact', Path(__file__).with_name('publish-artifact.py'))
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class ArtifactTests(unittest.TestCase):
    def artifact(self):
        # Test data stays in a temporary directory; no teardown deletes files.
        root = Path(tempfile.mkdtemp(prefix='aim-release-unit-'))
        data = b'<html>verified</html>'
        (root / 'index.html').write_bytes(data)
        (root / '.nojekyll').write_bytes(b'')
        (root / 'release-manifest.json').write_text(json.dumps({'files': {'index.html': {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}}}))
        return root

    def test_valid_artifact_and_extra_rejection(self):
        root = self.artifact()
        _, files = publisher.verified_artifact(root)
        self.assertEqual(set(files), {'wild/index.html', 'wild/.nojekyll', 'wild/release-manifest.json'})
        (root / 'private.txt').write_text('do not publish')
        with self.assertRaises(ValueError):
            publisher.verified_artifact(root)

    def test_hash_and_symlink_rejection(self):
        root = self.artifact()
        (root / 'index.html').write_text('changed')
        with self.assertRaises(ValueError):
            publisher.verified_artifact(root)
        root2 = self.artifact()
        (root2 / 'alias').symlink_to(root2 / 'index.html')
        with self.assertRaises(ValueError):
            publisher.verified_artifact(root2)

    def test_safe_paths(self):
        for path in ['../index.html', '/index.html', 'a/../b', '.git/config', '.github/test', 'a\\b', 'a//b', 'src/page.html', 'tools/server.py', 'package.json']:
            with self.assertRaises(ValueError):
                publisher.safe_path(path)

    def test_review_font_rejected_despite_valid_manifest(self):
        root = self.artifact()
        font = root / 'assets/site/fonts/aeroport-black-trial.otf'
        font.parent.mkdir(parents=True)
        data = b'local evaluation fixture'
        font.write_bytes(data)
        path = root / 'release-manifest.json'
        manifest = json.loads(path.read_text())
        manifest['files'][str(font.relative_to(root))] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
        path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'Local evaluation font'):
            publisher.verified_artifact(root)

    def test_plan_preserves_unrelated_paths_and_skips_identical_blobs(self):
        class Git:
            def api(self, path):
                if path.startswith('git/ref/'):
                    return {'object': {'sha': 'a' * 40}}
                if path.startswith('git/commits/'):
                    return {'tree': {'sha': 'tree'}}
                return {'tree': [{'path': 'index.html', 'type': 'blob', 'mode': '100644', 'sha': 'main'}, {'path': 'wild/index.html', 'type': 'blob', 'mode': '100644', 'sha': publisher.blob_sha(b'old')}, {'path': 'wild/retained.html', 'type': 'blob', 'mode': '100644', 'sha': 'keep'}]}
        head, tree, changed, retained = publisher.publish_plan(Git(), {'wild/index.html': b'old', 'wild/new.html': b'new'})
        self.assertEqual(changed, {'wild/new.html': b'new'})
        self.assertEqual(retained, ['wild/retained.html'])

    def test_exact_parent_and_no_force_race_does_not_retry(self):
        calls = []
        class Git:
            def api(self, path, method, payload):
                calls.append((path, payload))
                if path == 'git/blobs':
                    return {'sha': publisher.blob_sha(b'new')}
                if path == 'git/trees':
                    self_tree = payload
                    assert self_tree['base_tree'] == 'tree-old'
                    assert [item['path'] for item in self_tree['tree']] == ['wild/index.html']
                    return {'sha': 'tree-new'}
                if path == 'git/commits':
                    assert payload['parents'] == ['a' * 40]
                    return {'sha': 'b' * 40}
                assert payload == {'sha': 'b' * 40, 'force': False}
                raise RuntimeError('race')
        with self.assertRaisesRegex(RuntimeError, 'race'):
            publisher.execute(Git(), 'a' * 40, 'tree-old', {'wild/index.html': b'new'}, 'c' * 40)
        self.assertEqual(len(calls), 4)


if __name__ == '__main__':
    unittest.main()
