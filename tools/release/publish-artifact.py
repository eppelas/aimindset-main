#!/usr/bin/env python3
"""Publish verified Wild artifacts additively through Git data API; dry-run by default."""
import argparse
import base64
import hashlib
import json
import re
import subprocess
import tempfile
import uuid
from pathlib import Path, PurePosixPath

REPOSITORY = 'eppelas/aimindset-main'
BRANCH = 'main'
WORKFLOWS = ('.github/workflows/wild-release.yml', '.github/workflows/google-save-sync.yml')
PUBLIC_ROOTS = {'_astro', 'assets', 'ai-mindset-consulting', 'confpolicy', 'non-profit', 'oferta', 'index.html', 'ecosystem-grid-legacy.html', 'ecosystem-mindmap.html'}
# This asset's adjacent LOCAL-EVALUATION.txt limits it to local review.
LOCAL_EVALUATION_ASSETS = {'assets/site/fonts/aeroport-black-trial.otf'}


def blob_sha(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def safe_path(name):
    path = PurePosixPath(name)
    if not isinstance(name, str) or not name or path.is_absolute() or str(path) != name or '\\' in name or any(part in ('..', '.', '.git', '.github') or part.startswith('.') for part in path.parts):
        raise ValueError('Unsafe artifact path')
    if path.parts[0] not in PUBLIC_ROOTS:
        raise ValueError('Repository/source path is not a public release path')
    return name


def verified_artifact(root):
    root = Path(root)
    if root.is_symlink():
        raise ValueError('Artifact root cannot be a symlink')
    root = root.resolve(strict=True)
    for item in root.rglob('*'):
        if item.is_symlink():
            raise ValueError('Artifact symlinks are forbidden')
    manifest_bytes = (root / 'release-manifest.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    if not isinstance(manifest, dict) or set(manifest) - {'files', 'sourceCommit', 'platformCommit'} or not isinstance(manifest.get('files'), dict) or not manifest['files']:
        raise ValueError('Invalid release manifest')
    if LOCAL_EVALUATION_ASSETS.intersection(manifest['files']):
        raise ValueError('Local evaluation font cannot be published; supply the licensed webfont or approve a replacement first')
    for key in ('sourceCommit', 'platformCommit'):
        if manifest.get(key) is not None and not re.fullmatch('[a-f0-9]{40}', str(manifest[key])):
            raise ValueError('Invalid manifest commit provenance')
    expected = set(manifest['files']) | {'release-manifest.json', '.nojekyll'}
    actual = {str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()}
    if actual != expected:
        raise ValueError('Artifact file set differs from the release allowlist')
    contents = {}
    for name, metadata in manifest['files'].items():
        safe_path(name)
        data = (root / name).read_bytes()
        if not isinstance(metadata, dict) or metadata.get('bytes') != len(data) or metadata.get('sha256') != hashlib.sha256(data).hexdigest():
            raise ValueError('Artifact hash or length mismatch: ' + name)
        contents['wild/' + name] = data
    if (root / '.nojekyll').read_bytes() != b'':
        raise ValueError('.nojekyll must be present and empty')
    if 'wild/index.html' not in contents:
        raise ValueError('Missing Wild index.html')
    contents['wild/.nojekyll'] = b''
    contents['wild/release-manifest.json'] = manifest_bytes
    return root, contents


class GitHub:
    def api(self, path, method='GET', payload=None, allow_missing=False):
        command = ['gh', 'api', 'repos/' + REPOSITORY + '/' + path, '--method', method]
        if payload is not None:
            command += ['--input', '-']
        result = subprocess.run(command, input=None if payload is None else json.dumps(payload), text=True, capture_output=True)
        if result.returncode:
            if allow_missing and 'HTTP 404' in result.stderr:
                return None
            raise RuntimeError('GitHub API operation failed: ' + method + ' ' + path.split('?')[0])
        return json.loads(result.stdout)


def publish_plan(git, contents, source_sha=None, install_workflow=False):
    head = git.api('git/ref/heads/' + BRANCH)['object']['sha']
    commit = git.api('git/commits/' + head)
    tree = git.api('git/trees/' + commit['tree']['sha'] + '?recursive=1')
    if tree.get('truncated'):
        raise ValueError('Remote tree is truncated; cannot verify the complete target')
    existing = {item['path']: item for item in tree['tree']}
    if source_sha:
        if git.api('git/commits/' + source_sha)['sha'] != source_sha:
            raise ValueError('Source commit mismatch')
    if install_workflow:
        if not source_sha:
            raise ValueError('Workflow installation requires --source-sha')
        flag = git.api('actions/variables/AIM_PLATFORM_INTEGRATION', allow_missing=True)
        if flag and flag.get('value') == 'enabled':
            raise ValueError('Workflow integration is enabled; refusing initial gated installation')
        contents = dict(contents)
        for workflow in WORKFLOWS:
            source = git.api('contents/' + workflow + '?ref=' + source_sha)
            data = base64.b64decode(source['content'])
            if b"vars.AIM_PLATFORM_INTEGRATION == 'enabled'" not in data:
                raise ValueError('Workflow lacks required disabled integration gate')
            contents[workflow] = data
    for name in contents:
        prior = existing.get(name)
        if prior and (prior.get('type') != 'blob' or prior.get('mode') not in ('100644', '100755')):
            raise ValueError('Target path is not a regular Git blob: ' + name)
        for parent in PurePosixPath(name).parents:
            ancestor = existing.get(str(parent))
            if ancestor and ancestor.get('type') != 'tree':
                raise ValueError('Target ancestor is not a directory')
    changed = {name: data for name, data in contents.items() if existing.get(name, {}).get('sha') != blob_sha(data)}
    retained = sorted(name for name, item in existing.items() if name.startswith('wild/') and item['type'] == 'blob' and name not in contents)
    return head, commit['tree']['sha'], changed, retained


def execute(git, head, base_tree, changed, source_sha):
    entries = []
    for name, data in sorted(changed.items()):
        blob = git.api('git/blobs', 'POST', {'content': base64.b64encode(data).decode(), 'encoding': 'base64'})
        if blob['sha'] != blob_sha(data):
            raise ValueError('Uploaded blob identity mismatch')
        entries.append({'path': name, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
    tree = git.api('git/trees', 'POST', {'base_tree': base_tree, 'tree': entries})
    commit = git.api('git/commits', 'POST', {'message': 'Publish verified Wild artifact\n\nWild-Source-Commit: ' + source_sha, 'tree': tree['sha'], 'parents': [head]})
    # The observed parent plus force:false rejects a concurrent main update.
    git.api('git/refs/heads/' + BRANCH, 'PATCH', {'sha': commit['sha'], 'force': False})
    return commit['sha']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('artifact', type=Path)
    parser.add_argument('--publish', action='store_true')
    parser.add_argument('--source-sha')
    parser.add_argument('--install-workflow', action='store_true')
    parser.add_argument('--receipt', type=Path)
    args = parser.parse_args()
    if args.source_sha is not None and not re.fullmatch('[0-9a-f]{40}', args.source_sha):
        parser.error('--source-sha must be an exact lowercase 40-character Git commit')
    if args.publish and not args.source_sha:
        parser.error('--publish requires --source-sha')
    root, contents = verified_artifact(args.artifact)
    provenance = json.loads(contents['wild/release-manifest.json'])
    if provenance.get('sourceCommit') and provenance['sourceCommit'] != args.source_sha:
        raise ValueError('Manifest source commit does not match --source-sha')
    receipt_path = (args.receipt or Path(tempfile.gettempdir()) / ('aim-wild-release-' + uuid.uuid4().hex + '.json')).absolute()
    plan_path = receipt_path.with_name(receipt_path.stem + '.plan.json')
    if receipt_path.resolve().is_relative_to(root) or receipt_path.exists() or plan_path.exists():
        raise ValueError('Receipt must be new and outside the public artifact')
    git = GitHub()
    head, tree, changed, retained = publish_plan(git, contents, args.source_sha, args.install_workflow)
    receipt = {'repository': REPOSITORY, 'branch': BRANCH, 'mode': 'publish' if args.publish else 'dry-run', 'source_sha': args.source_sha, 'old_sha': head, 'changed_files': sorted(changed), 'changed_bytes': sum(map(len, changed.values())), 'retained_existing_wild_files': retained, 'new_sha': None}
    print(json.dumps(receipt, indent=2))
    # Reserve the receipt before any mutation; an ambiguous network result retains the plan.
    with plan_path.open('x') as stream:
        json.dump({**receipt, 'status': 'planned'}, stream, indent=2)
    if args.publish and changed:
        receipt['new_sha'] = execute(git, head, tree, changed, args.source_sha)
    receipt['status'] = 'published' if args.publish and changed else 'unchanged' if args.publish else 'dry-run'
    # Keep the original plan and a separate valid JSON completion receipt.
    receipt['plan_receipt'] = str(plan_path)
    with receipt_path.open('x') as stream:
        json.dump(receipt, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'receipt': str(receipt_path), 'status': receipt['status'], 'new_sha': receipt['new_sha']}))


if __name__ == '__main__':
    main()
