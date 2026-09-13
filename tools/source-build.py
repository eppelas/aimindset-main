"""Build editor-compatible Wild HTML from ordered sources and protected components."""
import argparse
import hashlib
import html
import importlib
import importlib.util
import json
import re
import sys
import subprocess
from pathlib import Path

# --check must not create local bytecode caches while loading either compiler.
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]


def build(platform, output=None, check=False, platform_revision=None):
    sys.path.insert(0, str(Path(platform).resolve()))
    shared = importlib.import_module('platform_core.shared')
    shared.verify_lock(platform)
    dependency = json.loads((ROOT / 'platform-dependency.json').read_text())
    revision = subprocess.check_output(['git', '-C', str(platform), 'rev-parse', 'HEAD'], text=True).strip()
    if platform_revision is not None and not re.fullmatch(r'[0-9a-f]{40}', platform_revision):
        raise ValueError('Platform revision override must be an exact lowercase 40-character SHA')
    if revision != (platform_revision or dependency['revision']):
        raise ValueError('Platform checkout differs from the explicitly selected revision')
    spec = importlib.util.spec_from_file_location('generated_freshness', ROOT / 'tools/check-generated-source.py')
    freshness = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(freshness)
    input_hashes = freshness.inputs(ROOT)
    components = shared.load_components(platform)
    manifest = json.loads((ROOT / 'source-manifest.json').read_text())
    expected = [entry['path'] for entry in manifest['blocks']]
    template = (ROOT / 'src/page/index.html').read_text()
    text_fields = json.loads((ROOT / 'src/content/main.json').read_text())['fields']
    original_text = json.loads((ROOT / 'src/content/original-text.json').read_text())
    text_ids = re.findall(r'\{\{text:([^}]+)\}\}', template)
    if set(text_ids) != set(text_fields) or len(text_ids) != len(set(text_ids)):
        raise ValueError('Text fields must match source template exactly')
    def text_value(match):
        key = match[1]; value = text_fields[key]
        if not isinstance(value, str): raise ValueError('Text value must be string')
        raw = original_text.get(key)
        return raw if raw is not None and html.unescape(raw) == value else html.escape(value, quote=False)
    template = re.sub(r'\{\{text:([^}]+)\}\}', text_value, template)

    actual = re.findall(r'\{\{source:([^}]+)\}\}', template)
    if actual != expected or len(set(actual)) != len(actual):
        raise ValueError('Source includes must occur exactly once in manifest order')
    def include(match):
        path = ROOT / match[1]
        if not path.resolve().is_relative_to((ROOT / 'src/page').resolve()):
            raise ValueError('Source include outside src/page')
        return path.read_text()
    homepage = re.sub(r'\{\{source:([^}]+)\}\}', include, shared.materialize(template, components))
    shell = shared.consumer_shell(json.loads((ROOT / 'src/site-sections.json').read_text()))
    shared.verify_outputs(homepage, shell, components)
    destination = Path(output) if output else ROOT
    versions = {'js': hashlib.sha256(shell.encode()).hexdigest()[:10],
                'css': freshness.digest(ROOT / 'assets/site/site-shell.css')[:10]}
    def shell_versions(text):
        return re.sub(r'(assets/site/site-shell\.(js|css))(?:\?v=[\w-]+)?',
                      lambda match: match[1] + '?v=' + versions[match[2]], text)
    outputs = {'index.html': shell_versions(homepage), 'assets/site/site-shell.js': shell}
    outputs.update({name: shell_versions((ROOT / name).read_text()) for name in freshness.SHELL_PAGES})
    record = {
        'schemaVersion': 1,
        'inputs': input_hashes,
        'outputs': {name: hashlib.sha256(text.encode()).hexdigest() for name, text in outputs.items()},
        'platform': {
            'repository': dependency['repository'], 'revision': revision,
            'dependencyRevision': dependency['revision'],
            'components': shared.hashes(components),
            'releaseSha256': freshness.digest(Path(platform) / 'components/approved/release.json'),
            'compilerSha256': freshness.digest(Path(shared.__file__)),
        },
    }
    if freshness.inputs(ROOT) != input_hashes:
        raise ValueError('Compiler inputs changed during compilation')
    if check:
        freshness.verify(ROOT, destination, expected=record, platform_revision=platform_revision)
    for name, content in outputs.items():
        path = destination / name
        if check:
            if not path.exists() or path.read_text() != content:
                raise ValueError('Generated output differs: ' + str(path))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists() or path.read_text() != content:
                path.write_text(content)
    if not check:
        (destination / freshness.RECORD).write_text(json.dumps(record, indent=2, sort_keys=True) + '\n')
        freshness.verify(ROOT, destination, expected=record, platform_revision=platform_revision)
    return record['outputs']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--platform', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path)
    parser.add_argument('--platform-revision', help='Explicit exact parent commit; defaults to the consumer dependency pin')
    parser.add_argument('--check', action='store_true', help='Verify generated files without writing')
    args = parser.parse_args()
    print(json.dumps(build(args.platform, args.output_dir, args.check, args.platform_revision), indent=2))
