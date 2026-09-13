#!/usr/bin/env python3
"""Poll the existing Google editor and commit allowlisted text to Wild."""
import argparse
import base64
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.request

REPO = 'eppelas/aimindset-main'
ORIGIN = 'https://aimindset-wild.web.app'
STATUS = ORIGIN + '/__status?object=wild%2Findex.html'
CONTENT = 'src/content/main.json'
DEPENDENCY = 'platform-dependency.json'
PAGES_MANIFEST = 'https://eppelas.github.io/aimindset-main/wild/release-manifest.json'
ALLOWED = {CONTENT, DEPENDENCY, 'index.html', 'assets/site/site-shell.js', 'source-build-record.json',
           'non-profit/index.html', 'ai-mindset-consulting/index.html', 'oferta/index.html', 'confpolicy/index.html'}


def run(args, cwd, data=None):
    result = subprocess.run(args, cwd=cwd, input=data, capture_output=True, check=False, timeout=180)
    if result.returncode:
        message = 'Command failed: ' + ' '.join(args[:3])
        # Local validation failures need the actual failing assertion. Never
        # expose gh/gcloud responses or environment dumps through this helper.
        if Path(args[0]).name in {'python', 'python3', 'node', 'npm'}:
            detail = (result.stderr + b'\n' + result.stdout).decode('utf-8', errors='replace')[-6000:]
            for name, value in os.environ.items():
                if len(value) >= 8 and any(word in name.upper() for word in ('TOKEN', 'SECRET', 'PASSWORD', 'PRIVATE_KEY')):
                    detail = detail.replace(value, '[REDACTED]')
            detail = re.sub(r'(?i)Bearer\s+[^\s]+|gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+', '[REDACTED]', detail)
            message += '\n' + detail.strip()
        raise RuntimeError(message)
    return result.stdout


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Cloud redirects are not accepted')


def fetch(url, limit):
    with urllib.request.build_opener(NoRedirect()).open(urllib.request.Request(url, headers={'Cache-Control': 'no-cache', 'Accept': 'application/json' if url == STATUS else 'text/html'}), timeout=30) as response:
        if response.url != url:
            raise ValueError('Unexpected cloud origin')
        data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError('Cloud response too large')
        return data


class SourceMeta(HTMLParser):
    def __init__(self):
        super().__init__(); self.sources = []; self.revs = []
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'meta' and values.get('name') == 'aim-source-commit':
            self.sources.append(values.get('content'))
        if tag == 'html':
            self.revs.append(values.get('data-rev'))


def cloud_snapshot(fetcher=fetch):
    before = json.loads(fetcher(STATUS, 65536))
    html = fetcher(ORIGIN + '/', 2_000_000)
    after = json.loads(fetcher(STATUS, 65536))
    for status in (before, after):
        if status.get('ok') is not True or status.get('object') != 'wild/index.html' or not isinstance(status.get('rev'), int) or isinstance(status['rev'], bool) or status['rev'] < 0 or not re.fullmatch('[a-f0-9]{16}', str(status.get('sha', ''))):
            raise ValueError('Unexpected Google status contract')
    if any(before.get(key) != after.get(key) for key in ('rev', 'sha', 'generation', 'object')):
        raise ValueError('Google changed during fetch; retry on the next scheduled run')
    if hashlib.sha256(html).hexdigest()[:16] != before['sha']:
        raise ValueError('Google body hash does not match status')
    if before.get('bytes') is not None and before['bytes'] != len(html):
        raise ValueError('Google body size does not match status')
    metadata = SourceMeta(); metadata.feed(html.decode('utf-8'))
    if len(metadata.sources) != 1 or not re.fullmatch('[a-f0-9]{40}', str(metadata.sources[0])) or metadata.revs != [str(before['rev'])]:
        raise ValueError('Missing or ambiguous immutable source metadata')
    return before, html, metadata.sources[0]


def gh(root, path, method='GET', body=None):
    args = ['gh', 'api', 'repos/' + REPO + '/' + path, '--method', method]
    if body is not None:
        args += ['--input', '-']
    return json.loads(run(args, root, None if body is None else json.dumps(body).encode()))


def ensure_delivery(root, head, pin, cloud_base, api=None, reader=None, runner=None):
    """Retry delivery of an existing current commit; never create another commit."""
    api, reader, runner = api or gh, reader or fetch, runner or run
    if api(root, 'git/ref/heads/wild')['object']['sha'] != head:
        raise ValueError('Wild advanced before delivery; retry the current HEAD next poll')
    try:
        published = json.loads(reader(PAGES_MANIFEST, 131072))
    except (OSError, ValueError):
        published = {}
    if cloud_base == head and published.get('sourceCommit') == head and published.get('platformCommit') == pin:
        return 'delivered'
    page = 1
    active = {'queued', 'in_progress', 'waiting', 'pending', 'requested'}
    while True:
        runs = api(root, 'actions/workflows/wild-release.yml/runs?head_sha=' + head + '&per_page=100&page=' + str(page))
        if any(r.get('head_sha') == head and r.get('status') in active for r in runs.get('workflow_runs', [])):
            return 'release-active'
        if page * 100 >= runs.get('total_count', 0):
            break
        page += 1
    if api(root, 'git/ref/heads/wild')['object']['sha'] != head:
        raise ValueError('Wild advanced before dispatch; retry the current HEAD next poll')
    runner(['gh', 'workflow', 'run', 'wild-release.yml', '--repo', REPO, '--ref', 'wild', '-f', 'publish=true', '-f', 'source_ref=' + head], root)
    return 'release-dispatched'


def assert_same_snapshot(before, after):
    if any(before[0].get(k) != after[0].get(k) for k in ('rev', 'sha', 'generation')) or before[1:] != after[1:]:
        raise ValueError('Google changed while validating; no commit written, retry next poll')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test', action='store_true', help='Run deterministic polling safety tests without network')
    parser.add_argument('--platform', type=Path)
    parser.add_argument('--publish', action='store_true', help='Validate trusted source and commit validated text and dispatch its exact release')
    parser.add_argument('--dry-run', action='store_true', help='Read-only default: import into temporary output, never modify source or remote')
    args = parser.parse_args()
    if args.self_test:
        self_test(); return
    if args.publish and args.dry_run:
        parser.error('Choose --publish or --dry-run')
    root = Path(__file__).resolve().parents[2]
    head = run(['git', 'rev-parse', 'HEAD'], root).decode().strip()
    if not re.fullmatch('[a-f0-9]{40}', head):
        raise ValueError('Invalid local source commit')
    if args.publish:
        if not args.platform or run(['git', 'status', '--porcelain'], root).strip():
            raise ValueError('Publishing needs a clean trusted checkout and checked parent')
        if gh(root, 'git/ref/heads/wild')['object']['sha'] != head:
            raise ValueError('Checkout is not current Wild HEAD')
    status, html, base = cloud_snapshot()
    run(['git', 'merge-base', '--is-ancestor', base, head], root)
    temp = Path(tempfile.mkdtemp(prefix='aim-google-sync-'))
    for label, path in [('base-html', 'index.html'), ('base-template', 'src/page/index.html'), ('base-content', CONTENT)]:
        (temp / label).write_bytes(run(['git', 'show', base + ':' + path], root))
    (temp / 'edited.html').write_bytes(html)
    output, report = temp / 'content.json', temp / 'report.json'
    run(['python3', '-B', 'tools/release/import-google-save.py', '--base-html', str(temp / 'base-html'), '--base-template', str(temp / 'base-template'), '--base-content', str(temp / 'base-content'), '--current-content', str(root / CONTENT), '--edited-html', str(temp / 'edited.html'), '--output', str(output), '--report', str(report), '--base-source', base], root)
    current, proposed = json.loads((root / CONTENT).read_text()), json.loads(output.read_text())
    if set(current) != set(proposed) or set(current['fields']) != set(proposed['fields']):
        raise ValueError('Importer changed content schema or field allowlist')
    changed = sorted(key for key in current['fields'] if current['fields'][key] != proposed['fields'][key])
    import_report = json.loads(report.read_text())
    if import_report.get('baseSourceSha') != base or import_report.get('changedFields') != changed:
        raise ValueError('Importer report differs from validated content delta')
    summary = {'cloud_revision': status['rev'], 'cloud_sha': status['sha'], 'base_source': base, 'current_source': head, 'changed_fields': changed, 'mode': 'publish' if args.publish else 'dry-run'}
    print(json.dumps(summary))
    if not args.publish:
        return
    dependency = json.loads((root / DEPENDENCY).read_text())
    pin = dependency['revision']
    if dependency.get('repository') != 'eppelas/aim-web-platform' or not re.fullmatch('[a-f0-9]{40}', pin):
        raise ValueError('Invalid trusted parent dependency')
    latest = run(['git', 'rev-parse', 'HEAD'], args.platform).decode().strip()
    if not re.fullmatch('[a-f0-9]{40}', latest) or run(['git', 'status', '--porcelain'], args.platform).strip():
        raise ValueError('Parent checkout must be an exact clean commit')
    run(['git', 'merge-base', '--is-ancestor', pin, latest], args.platform)
    parent_changed = latest != pin
    if not changed and not parent_changed:
        assert_same_snapshot((status, html, base), cloud_snapshot())
        print(json.dumps({'status': ensure_delivery(root, head, pin, base), 'commit': head}))
        return
    if changed:
        (root / CONTENT).write_bytes(output.read_bytes())
    if parent_changed:
        (root / DEPENDENCY).write_text(json.dumps({**dependency, 'revision': latest}, indent=2) + '\n')
    for command in [
        ['python3', '-B', 'tools/source-build.py', '--platform', str(args.platform.resolve())],
        ['python3', '-B', 'tools/source-build.py', '--platform', str(args.platform.resolve()), '--check'],
        ['python3', '-B', 'tools/verify-source-build.py', '--platform', str(args.platform.resolve())],
        ['npm', 'run', 'check'],
        ['python3', '-B', '-m', 'unittest', 'discover', '-s', 'tools/release', '-p', 'test_*.py', '-v'],
        ['node', 'tools/verify-idle-schedulers.cjs'],
        ['node', 'tools/verify-idle-scenes.cjs'],
        ['npm', 'run', 'test:editor'],
    ]:
        run(command, root)
    files = run(['git', 'diff', '--name-only'], root).decode().splitlines()
    required = ({CONTENT} if changed else set()) | ({DEPENDENCY} if parent_changed else set())
    if not required.issubset(files) or set(files) - ALLOWED:
        raise ValueError('Generated changes escaped content/build allowlist')
    assert_same_snapshot((status, html, base), cloud_snapshot())
    commit = commit_text(root, head, {path: (root / path).read_bytes() for path in files}, status, base, changed, parent_revision=latest if parent_changed else None)
    delivery = ensure_delivery(root, commit, latest, base)
    print(json.dumps({'status': delivery, 'commit': commit, 'url': 'https://github.com/' + REPO + '/commit/' + commit}))


def commit_text(root, head, contents, status, base, changed, api=None, parent_revision=None):
    if parent_revision is not None and not re.fullmatch('[a-f0-9]{40}', parent_revision):
        raise ValueError('Invalid parent commit')
    if not changed and not parent_revision:
        return None
    required = ({CONTENT} if changed else set()) | ({DEPENDENCY} if parent_revision else set())
    if not required.issubset(contents) or set(contents) - ALLOWED:
        raise ValueError('Commit paths escaped the allowlist')
    api = api or gh
    if api(root, 'git/ref/heads/wild')['object']['sha'] != head:
        raise ValueError('Wild advanced while validating; no commit written')
    target = api(root, 'git/commits/' + head)
    entries = []
    for path, data in sorted(contents.items()):
        blob = api(root, 'git/blobs', 'POST', {'content': base64.b64encode(data).decode(), 'encoding': 'base64'})
        entries.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
    tree = api(root, 'git/trees', 'POST', {'base_tree': target['tree']['sha'], 'tree': entries})
    message = 'Import Google text revision ' + str(status['rev']) + '\n\nGoogle-Base-Source: ' + base + '\nChanged-Fields: ' + ', '.join(changed)
    message += '\nGoogle-Snapshot-Sha: ' + str(status.get('sha', ''))
    if parent_revision:
        message += '\nPlatform-Revision: ' + parent_revision
    commit = api(root, 'git/commits', 'POST', {'message': message, 'tree': tree['sha'], 'parents': [head]})['sha']
    api(root, 'git/refs/heads/wild', 'PATCH', {'sha': commit, 'force': False})
    return commit


def self_test():
    import unittest
    class PollingTests(unittest.TestCase):
        def fixture(self):
            body = ('<html data-rev="3"><meta name="aim-source-commit" content="' + 'a' * 40 + '"></html>').encode()
            status = {'ok': True, 'object': 'wild/index.html', 'rev': 3, 'sha': hashlib.sha256(body).hexdigest()[:16], 'generation': '7'}
            return body, status
        def test_direct_commit_exact_parent_and_nonforce(self):
            calls = []
            def api(root, path, method='GET', body=None):
                calls.append((path, method, body))
                if path == 'git/ref/heads/wild': return {'object': {'sha': 'a' * 40}}
                if path == 'git/commits/' + 'a' * 40: return {'tree': {'sha': 'base-tree'}}
                if path == 'git/blobs': return {'sha': 'blob'}
                if path == 'git/trees': return {'sha': 'tree'}
                if path == 'git/commits': return {'sha': 'b' * 40}
                return {}
            result = commit_text(Path('/tmp'), 'a' * 40, {CONTENT: b'{}'}, {'rev': 3}, 'c' * 40, ['text.1'], api)
            self.assertEqual(result, 'b' * 40)
            self.assertEqual(calls[-2][2]['parents'], ['a' * 40])
            self.assertEqual(calls[-1], ('git/refs/heads/wild', 'PATCH', {'sha': 'b' * 40, 'force': False}))
            self.assertFalse(any('pulls' in call[0] for call in calls))
        def test_head_race_and_noop_make_no_writes(self):
            calls = []
            def api(root, path, method='GET', body=None):
                calls.append(method); return {'object': {'sha': 'd' * 40}}
            self.assertIsNone(commit_text(Path('/tmp'), 'a' * 40, {}, {'rev': 3}, 'c' * 40, [], api))
            self.assertEqual(calls, [])
            with self.assertRaises(ValueError):
                commit_text(Path('/tmp'), 'a' * 40, {CONTENT: b'{}'}, {'rev': 3}, 'c' * 40, ['text.1'], api)
            self.assertEqual(calls, ['GET'])
        def test_real_importer_nochange_dry_run_keeps_source(self):
            import contextlib, io, sys
            from unittest.mock import patch
            root = Path(__file__).resolve().parents[2]
            original_run = run
            source_before = (root / CONTENT).read_bytes()
            html = (root / 'index.html').read_text()
            html = re.sub(r'<meta\s+name=["\']aim-source-commit["\'][^>]*>', '', html)
            html = html.replace('<head>', '<head><meta name="aim-source-commit" content="' + 'a' * 40 + '">', 1)
            self.assertIn('aim-source-commit', html)
            def fixture_run(command, cwd, data=None):
                if command[:2] == ['git', 'rev-parse']: return ('a' * 40).encode()
                if command[:2] == ['git', 'merge-base']: return b''
                if command[:2] == ['git', 'show']: return (root / command[2].split(':', 1)[1]).read_bytes()
                self.assertEqual(command[:3], ['python3', '-B', 'tools/release/import-google-save.py'])
                return original_run(command, cwd, data)
            output = io.StringIO()
            with patch.dict(globals(), {'run': fixture_run, 'cloud_snapshot': lambda: ({'rev': 3, 'sha': hashlib.sha256(html.encode()).hexdigest()[:16]}, html.encode(), 'a' * 40)}), patch.object(sys, 'argv', ['sync-google-save.py', '--dry-run']), contextlib.redirect_stdout(output):
                main()
            self.assertEqual(json.loads(output.getvalue())['changed_fields'], [])
            self.assertEqual((root / CONTENT).read_bytes(), source_before)
        def test_consistent_snapshot(self):
            body, status = self.fixture()
            result = cloud_snapshot(lambda url, limit: json.dumps(status).encode() if url == STATUS else body)
            self.assertEqual(result[2], 'a' * 40)
        def test_namespace_hash_and_revision_fail_closed(self):
            body, status = self.fixture()
            for patch in ({'object': 'index.html'}, {'sha': 'b' * 16}, {'rev': 4}, {'ok': False}):
                current = {**status, **patch}
                with self.assertRaises(ValueError):
                    cloud_snapshot(lambda url, limit: json.dumps(current).encode() if url == STATUS else body)
        def test_concurrent_save_rejected(self):
            body, status = self.fixture(); count = 0
            def reader(url, limit):
                nonlocal count
                if url != STATUS: return body
                count += 1
                return json.dumps({**status, 'generation': str(count)}).encode()
            with self.assertRaises(ValueError): cloud_snapshot(reader)
        def test_github_adapter_uses_fixed_repo_and_json_stdin(self):
            calls = []
            original = globals()['run']
            def fake_run(args, cwd, data=None):
                calls.append((args, cwd, data))
                return b'{"sha":"accepted"}'
            globals()['run'] = fake_run
            try:
                gh(Path('/tmp'), 'git/refs/heads/wild', 'PATCH', {'sha': 'a' * 40, 'force': False})
            finally:
                globals()['run'] = original
            self.assertEqual(calls[0][0], ['gh', 'api', 'repos/eppelas/aimindset-main/git/refs/heads/wild', '--method', 'PATCH', '--input', '-'])
            self.assertEqual(json.loads(calls[0][2]), {'sha': 'a' * 40, 'force': False})
        def test_duplicate_source_metadata_rejected(self):
            body, status = self.fixture()
            body += ('<meta name="aim-source-commit" content="' + 'a' * 40 + '">').encode()
            status['sha'] = hashlib.sha256(body).hexdigest()[:16]
            with self.assertRaises(ValueError):
                cloud_snapshot(lambda url, limit: json.dumps(status).encode() if url == STATUS else body)
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(PollingTests))
    if not result.wasSuccessful(): raise SystemExit(1)


if __name__ == '__main__':
    main()
