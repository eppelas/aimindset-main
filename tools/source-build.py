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
    shared.verify_instructions(ROOT)
    spec = importlib.util.spec_from_file_location('generated_freshness', ROOT / 'tools/check-generated-source.py')
    freshness = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(freshness)
    input_hashes = freshness.inputs(ROOT)
    components = shared.load_components(platform)
    manifest = json.loads((ROOT / 'source-manifest.json').read_text())
    expected = [entry['path'] for entry in manifest['blocks']]
    page_spec = importlib.util.spec_from_file_location('editor_pages', ROOT / 'tools/release/editor_pages.py')
    pages = importlib.util.module_from_spec(page_spec)
    page_spec.loader.exec_module(pages)
    template = pages.render_page(ROOT, 'home')

    actual = re.findall(r'\{\{source:([^}]+)\}\}', template)
    if actual != expected or len(set(actual)) != len(actual):
        raise ValueError('Source includes must occur exactly once in manifest order')
    def include(match):
        path = ROOT / match[1]
        if not path.resolve().is_relative_to((ROOT / 'src/page').resolve()):
            raise ValueError('Source include outside src/page')
        return path.read_text()
    homepage = re.sub(r'\{\{source:([^}]+)\}\}', include, shared.materialize(template, components))
    sections = json.loads((ROOT / 'src/site-sections.json').read_text())
    label_spec = importlib.util.spec_from_file_location('section_label_importer', ROOT / 'tools/release/import-google-save.py')
    labels = importlib.util.module_from_spec(label_spec)
    label_spec.loader.exec_module(labels)
    def label_manifest(page_key):
        payload = json.dumps(labels.section_labels(sections, page_key), ensure_ascii=False).replace('<', '\\u003c')
        return '<script id="aim-section-labels" type="application/json">' + payload + '</script>'
    if 'id="aim-section-labels"' in homepage:
        raise ValueError('Local section manifest is compiler-owned')
    section_manifest = label_manifest('home')
    homepage = homepage.replace('</head>', section_manifest + '</head>', 1) if '</head>' in homepage else section_manifest + homepage
    editor_runtime = (ROOT/'src/page/runtime/inline-editor.js').read_text()
    sync_runtime = (ROOT/'src/page/runtime/editor-sync-status.js').read_text()
    sync_script = '<script id="aim-editor-sync-runtime" data-editor-ui="">'+sync_runtime+'</script>'
    editor_script = '<script>'+editor_runtime+'</script>'
    if editor_script in homepage:
        homepage = homepage.replace(editor_script, sync_script+editor_script, 1)
    elif 'const toggle = document.getElementById("editToggle")' in homepage:
        raise ValueError('Home editor runtime boundary differs')
    editor_css = (ROOT/'src/page/editor/overlay.css').read_text()
    editor_toolbar = (ROOT/'src/page/editor/toolbar.html').read_text()
    api_match = re.search(r'<meta name="aim-edit-api" content="([^"]+)"', homepage)
    editor_api = api_match[1] if api_match else 'https://aimindset-wild.web.app'
    def editable_page(key):
        page = pages.PAGES[key];text = pages.render_page(ROOT,key)
        page_sources = manifest.get('pageSources', {}).get(key, [])
        actual_sources = re.findall(r'\{\{source:([^}]+)\}\}', text)
        if actual_sources != page_sources or len(set(page_sources)) != len(page_sources) or any(name not in expected for name in page_sources):
            raise ValueError('Page source includes must match declared shared manifest blocks: ' + key)
        text = re.sub(r'\{\{source:([^}]+)\}\}', include, text)
        if 'id="editBar"' in text:raise ValueError('Page editor overlay is compiler-owned')
        meta = '<meta name="aim-edit-api" content="'+html.escape(editor_api,quote=True)+'"><meta name="aim-edit-object" content="'+page['object']+'">'
        head = meta+label_manifest(page['section_key'])+'<style id="aim-editor-overlay-styles" data-editor-ui="">'+editor_css+'</style>'
        text = re.sub(r'<html\b', '<html data-rev="0"', text, count=1)
        text = text.replace('</head>',head+'</head>',1)
        return text.replace('</body>',editor_toolbar+sync_script+'<script id="aim-editor-overlay-runtime" data-editor-ui="">'+editor_runtime+'</script></body>',1)
    shell = shared.consumer_shell(sections)
    shared.verify_outputs(homepage, shell, components)
    destination = Path(output) if output else ROOT
    versions = {'js': hashlib.sha256(shell.encode()).hexdigest()[:10],
                'css': freshness.digest(ROOT / 'assets/site/site-shell.css')[:10]}
    def shell_versions(text):
        return re.sub(r'(assets/site/site-shell\.(js|css))(?:\?v=[\w-]+)?',
                      lambda match: match[1] + '?v=' + versions[match[2]], text)
    outputs = {'index.html': shell_versions(homepage), 'assets/site/site-shell.js': shell}
    migrated = {page['output'] for key,page in pages.PAGES.items() if key != 'home'}
    outputs.update({page['output']: shell_versions(editable_page(key)) for key,page in pages.PAGES.items() if key != 'home'})
    outputs.update({name: shell_versions((ROOT / name).read_text()) for name in freshness.SHELL_PAGES if name not in migrated})
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
