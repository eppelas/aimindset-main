"""Check generated-file freshness without private platform access; not a trust attestation."""
import argparse
import hashlib
import json
import re
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
RECORD = 'source-build-record.json'
SHELL_PAGES = ('non-profit/index.html', 'ai-mindset-consulting/index.html', 'oferta/index.html', 'confpolicy/index.html')
OUTPUTS = ('index.html', 'assets/site/site-shell.js', *SHELL_PAGES)
SHA256 = re.compile(r'[0-9a-f]{64}')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inputs(root):
    manifest = json.loads((root / 'source-manifest.json').read_text())
    includes = [entry['path'] for entry in manifest['blocks']]
    if len(includes) != len(set(includes)):
        raise ValueError('Duplicate source manifest path')
    for name in includes:
        path = PurePosixPath(name)
        if path.is_absolute() or str(path) != name or '\\' in name or '..' in path.parts or not name.startswith('src/page/'):
            raise ValueError('Invalid source manifest path')
    names = ['src/page/index.html', 'src/site-sections.json', 'source-manifest.json',
             'platform-dependency.json', 'tools/source-build.py', 'tools/check-generated-source.py',
             'assets/site/site-shell.css', *SHELL_PAGES]
    names += includes
    names += [p.relative_to(root).as_posix() for p in (root / 'src/content').rglob('*.json') if p.is_file()]
    if len(names) != len(set(names)):
        raise ValueError('Duplicate compiler input path')
    result = {}
    for name in sorted(names):
        path = root / name
        if not path.resolve().is_relative_to(root.resolve()) or path.is_symlink() or not path.is_file():
            raise ValueError('Missing or non-local compiler input: ' + name)
        # These pages retain their current body; only generated shell cache keys vary.
        if name in SHELL_PAGES:
            content = re.sub(r'(assets/site/site-shell\.(?:js|css))(?:\?v=[\w-]+)?', r'\1', path.read_text())
            result[name] = hashlib.sha256(content.encode()).hexdigest()
        else:
            result[name] = digest(path)
    return result


def verify(root=ROOT, output=None, expected=None, platform_revision=None):
    if platform_revision is not None and not re.fullmatch(r'[0-9a-f]{40}', platform_revision):
        raise ValueError('Platform revision override must be an exact lowercase 40-character SHA')
    root = Path(root)
    output = Path(output) if output else root
    record_path = output / RECORD
    if not record_path.is_file():
        raise ValueError('Missing source-build-record.json; run tools/source-build.py with the pinned platform')
    record = json.loads(record_path.read_text())
    if not isinstance(record, dict) or set(record) != {'schemaVersion', 'inputs', 'outputs', 'platform'} or record['schemaVersion'] != 1:
        raise ValueError('Invalid source build record schema')
    current = inputs(root)
    if record['inputs'] != current:
        recorded = record['inputs'] if isinstance(record['inputs'], dict) else {}
        drift = sorted(name for name in set(current) | set(recorded) if current.get(name) != recorded.get(name))
        raise ValueError('Compiler input drift: ' + ', '.join(drift))
    actual_outputs = {name: digest(output / name) for name in OUTPUTS}
    if record['outputs'] != actual_outputs:
        raise ValueError('Generated output drift: rebuild from the current inputs')
    dep = json.loads((root / 'platform-dependency.json').read_text())
    platform = record['platform']
    if not isinstance(platform, dict) or set(platform) != {'repository', 'revision', 'dependencyRevision', 'components', 'releaseSha256', 'compilerSha256'}:
        raise ValueError('Invalid platform provenance schema')
    if platform['repository'] != dep['repository'] or platform['dependencyRevision'] != dep['revision'] or platform['revision'] != (platform_revision or dep['revision']):
        raise ValueError('Platform provenance differs from the pinned dependency')
    if not isinstance(platform['components'], dict) or set(platform['components']) != set(dep['components']):
        raise ValueError('Platform component set differs from the pinned dependency')
    values = list(platform['components'].values()) + [platform['releaseSha256'], platform['compilerSha256']]
    if not all(isinstance(value, str) and SHA256.fullmatch(value) for value in values):
        raise ValueError('Invalid platform provenance hash')
    if expected is not None and record != expected:
        raise ValueError('Build record differs from actual verified compilation')
    return {'inputs': len(current), 'outputs': len(actual_outputs), 'platformRevision': platform['revision'], 'result': 'PASS'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--output-dir', type=Path)
    parser.add_argument('--platform-revision', help='Explicit exact parent commit; otherwise require the consumer dependency pin')
    args = parser.parse_args()
    print(json.dumps(verify(args.root, args.output_dir, platform_revision=args.platform_revision)))
