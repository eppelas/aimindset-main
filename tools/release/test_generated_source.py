"""Freshness rejects source/output drift; compilation owns the record and check is read-only."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]

def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

fresh = load('freshness_test', ROOT / 'tools/check-generated-source.py')
builder = load('source_builder_test', ROOT / 'tools/source-build.py')


def snapshot(root):
    return {str(p.relative_to(root)): (p.read_bytes(), p.stat().st_mtime_ns) for p in root.rglob('*') if p.is_file()}


class GeneratedSourceTests(unittest.TestCase):
    def setUp(self):
        # Retain temporary fixtures; no destructive cleanup is used.
        self.home = Path(tempfile.mkdtemp(prefix='wild-freshness-test-'))
        self.root = self.home / 'source'
        self.platform = self.home / 'platform'
        files = {
            'src/page/index.html': '{{shared:learning}}{{source:src/page/runtime/example.js}}',
            'src/page/runtime/example.js': 'const value=1;',
            'MANDATORY_INSTRUCTIONS.md': '# Mandatory fixture',
            'AGENTS.md': '# Agent fixture',
            'src/site-sections.json': json.dumps({'home':'<a href="#about">about</a>'}),
            'src/content/main.json': '{"fields":{}}',
            'src/content/original-text.json': '{}',
            'source-manifest.json': json.dumps({'blocks':[{'path':'src/page/runtime/example.js','tag':'script'}]}),
            'platform-dependency.json': json.dumps({'repository':'fixture/platform','revision':'a'*40,'components':['navigation','footer','learning']}),
            'tools/release/import-google-save.py': (ROOT/'tools/release/import-google-save.py').read_text(),
            'tools/source-build.py': (ROOT/'tools/source-build.py').read_text(),
            'tools/check-generated-source.py': (ROOT/'tools/check-generated-source.py').read_text(),
        }
        files['src/page/editor/overlay.css']='.edit-bar{display:flex}'
        files['src/page/editor/toolbar.html']='<div id="editBar"></div>'
        files['src/page/runtime/editor-sync-status.js']='window.AIMEditorSync={};'
        files['src/page/runtime/inline-editor.js']='// editor fixture'
        files['tools/release/editor_pages.py']=(ROOT/'tools/release/editor_pages.py').read_text()
        for slug in ['ai-mindset-consulting','non-profit','oferta','confpolicy']:
            files[f'src/pages/{slug}/index.html']='<html><head></head><body><main>Preserved page body</main><script src="../assets/site/site-shell.js?v=old"></script></body></html>'
            files[f'src/content/pages/{slug}.json']='{"fields":{}}'
            files[f'src/content/pages/{slug}.original.json']='{}'
        files['assets/site/site-shell.css'] = ':root{color:black}'
        files['assets/site/site-return.js'] = 'window.AIMSiteReturn={};'
        files['assets/site/site-return.css'] = '.site-return{display:block}'
        files.update({name:'<main>Preserved page body</main><script src="../assets/site/site-shell.js?v=old"></script>' for name in fresh.SHELL_PAGES})
        for name, text in files.items():
            p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
        (self.platform/'components/approved').mkdir(parents=True)
        (self.platform/'components/approved/release.json').write_text('{}')
        (self.platform/'shared.py').write_text('# fixture compiler')
        self.components = {'navigation':'NAV','footer':'FOOT','learning':'LEARN'}
        self.calls=[]
        self.shared=types.SimpleNamespace(
            __file__=str(self.platform/'shared.py'),
            verify_lock=lambda p:self.calls.append('lock'),
            verify_instructions=lambda p:self.calls.append('instructions'),
            load_components=lambda p:self.components,
            materialize=lambda text,c:text.replace('{{shared:learning}}',c['learning']),
            materialize_shell=lambda text,c:text.replace('{{shared:navigation:json}}',c['navigation']).replace('{{shared:footer:json}}',c['footer']),
            consumer_shell=lambda sections:self.components['navigation']+self.components['footer'],
            verify_outputs=lambda *args:self.calls.append('verify_outputs'),
            hashes=lambda c:{k:hashlib.sha256(v.encode()).hexdigest() for k,v in c.items()},
        )

    def build(self, output=None, check=False, platform_revision=None, actual_revision=None):
        with patch.object(builder,'ROOT',self.root), patch.object(builder.importlib,'import_module',return_value=self.shared), patch.object(builder.subprocess,'check_output',return_value=(actual_revision or 'a'*40)+'\n'):
            return builder.build(self.platform,output,check,platform_revision)

    def test_migrated_pages_share_runtime_and_keep_distinct_save_objects(self):
        self.build()
        for slug in ['ai-mindset-consulting','non-profit','oferta','confpolicy']:
            text=(self.root/f'{slug}/index.html').read_text()
            self.assertIn('content="wild/'+slug+'/index.html"',text)
            self.assertEqual(text.count('id="editBar"'),1)
            self.assertIn('id="aim-editor-overlay-runtime"',text)
            self.assertIn('id="aim-editor-sync-runtime"',text)
            self.assertNotIn('editDuplicate',text)

    def test_migrated_page_uses_canonical_template_not_old_output(self):
        self.build()
        (self.root/'non-profit/index.html').write_text('stale output')
        self.build()
        self.assertIn('Preserved page body',(self.root/'non-profit/index.html').read_text())
        self.assertNotIn('non-profit/index.html',fresh.inputs(self.root))
        self.assertIn('src/pages/non-profit/index.html',fresh.inputs(self.root))

    def test_optional_submenu_absent_or_empty_builds(self):
        for sections in ({}, {'home':''}):
            (self.root/'src/site-sections.json').write_text(json.dumps(sections))
            self.build()
            self.assertIn('<script id="aim-section-labels" type="application/json">{}</script>',(self.root/'index.html').read_text())

    def test_compiler_writes_record_after_verified_build(self):
        self.build()
        self.assertEqual(self.calls,['lock','instructions','verify_outputs'])
        self.assertEqual(fresh.verify(self.root)['result'],'PASS')
        record=json.loads((self.root/fresh.RECORD).read_text())
        self.assertEqual(record['platform']['components'],self.shared.hashes(self.components))
        self.assertIn('tools/source-build.py',record['inputs'])

    def test_shared_asset_revision_reaches_every_page_without_changing_body(self):
        self.build()
        expected = hashlib.sha256(b'NAVFOOT').hexdigest()[:10]
        for name in fresh.SHELL_PAGES:
            self.assertIn('site-shell.js?v='+expected,(self.root/name).read_text())
            self.assertIn('<main>Preserved page body</main>',(self.root/name).read_text())
        before=snapshot(self.root);self.build(check=True);self.assertEqual(snapshot(self.root),before)
        self.components['navigation']='NEWNAV';self.build()
        expected=hashlib.sha256(b'NEWNAVFOOT').hexdigest()[:10]
        for name in fresh.SHELL_PAGES:self.assertIn('site-shell.js?v='+expected,(self.root/name).read_text())

    def test_source_drift_rejected(self):
        self.build()
        (self.root/'src/page/runtime/example.js').write_text('const value=2;')
        with self.assertRaisesRegex(ValueError,'Compiler input drift'):fresh.verify(self.root)

    def test_output_drift_rejected(self):
        self.build();(self.root/'index.html').write_text('stale output')
        with self.assertRaisesRegex(ValueError,'Generated output drift'):fresh.verify(self.root)

    def test_added_content_and_removed_record_path_rejected(self):
        self.build();(self.root/'src/content/extra.json').write_text('{}')
        with self.assertRaisesRegex(ValueError,'Compiler input drift'):fresh.verify(self.root)
        self.build();record=json.loads((self.root/fresh.RECORD).read_text());record['inputs'].pop('src/content/extra.json')
        (self.root/fresh.RECORD).write_text(json.dumps(record))
        with self.assertRaisesRegex(ValueError,'Compiler input drift'):fresh.verify(self.root)

    def test_missing_record_is_failure_even_for_check(self):
        with self.assertRaisesRegex(ValueError,'Missing source-build-record'):fresh.verify(self.root)
        before=snapshot(self.home)
        with self.assertRaisesRegex(ValueError,'Missing source-build-record'):self.build(check=True)
        self.assertEqual(snapshot(self.home),before)

    def test_check_does_not_write_or_repair(self):
        self.build();before=snapshot(self.home);self.build(check=True)
        self.assertEqual(snapshot(self.home),before)
        (self.root/'assets/site/site-shell.js').write_text('wrong shell');before=snapshot(self.home)
        with self.assertRaisesRegex(ValueError,'Generated output drift'):self.build(check=True)
        self.assertEqual(snapshot(self.home),before)

    def test_output_directory_has_record_and_root_is_untouched(self):
        before=snapshot(self.root);out=self.home/'output';self.build(out)
        self.assertEqual(snapshot(self.root),before)
        self.assertEqual(fresh.verify(self.root,out)['result'],'PASS')
        before=snapshot(self.home);self.build(out,check=True);self.assertEqual(snapshot(self.home),before)

    def test_component_provenance_drift_rejected_by_actual_check(self):
        self.build();record=json.loads((self.root/fresh.RECORD).read_text());record['platform']['components']['footer']='b'*64
        (self.root/fresh.RECORD).write_text(json.dumps(record))
        with self.assertRaisesRegex(ValueError,'actual verified compilation'):self.build(check=True)

    def test_parent_drift_requires_explicit_matching_revision(self):
        with self.assertRaisesRegex(ValueError,'explicitly selected revision'):
            self.build(actual_revision='b'*40)
        with self.assertRaisesRegex(ValueError,'explicitly selected revision'):
            self.build(platform_revision='c'*40,actual_revision='b'*40)
        self.assertFalse((self.root/fresh.RECORD).exists())

    def test_explicit_pair_is_allowed_but_default_freshness_rejects_it(self):
        out=self.home/'explicit-output'
        self.build(out,platform_revision='b'*40,actual_revision='b'*40)
        record=json.loads((out/fresh.RECORD).read_text())
        self.assertEqual(record['platform']['revision'],'b'*40)
        self.assertEqual(record['platform']['dependencyRevision'],'a'*40)
        with self.assertRaisesRegex(ValueError,'Platform provenance'):
            fresh.verify(self.root,out)
        with self.assertRaisesRegex(ValueError,'Platform provenance'):
            fresh.verify(self.root,out,platform_revision='c'*40)
        self.assertEqual(fresh.verify(self.root,out,platform_revision='b'*40)['result'],'PASS')
        before=snapshot(self.home)
        self.build(out,check=True,platform_revision='b'*40,actual_revision='b'*40)
        self.assertEqual(snapshot(self.home),before)

    def test_revision_override_must_be_exact_sha(self):
        for revision in ('main','latest','a'*7,'A'*40,'a'*40+'\n'):
            with self.subTest(revision=revision):
                with self.assertRaisesRegex(ValueError,'exact lowercase'):
                    self.build(platform_revision=revision)
                with self.assertRaisesRegex(ValueError,'exact lowercase'):
                    fresh.verify(self.root,platform_revision=revision)


if __name__=='__main__':unittest.main()
