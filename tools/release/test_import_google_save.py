"""Real Wild mapping plus rejected ambiguity, code mutation and stale-cloud merge."""
import copy
import hashlib
import html
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('google_save_importer',ROOT/'tools/release/import-google-save.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


class GoogleSaveImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.template=(ROOT/'src/page/index.html').read_text()
        cls.base=(ROOT/'index.html').read_text()
        cls.content=json.loads((ROOT/'src/content/main.json').read_text())
        cls.raw=json.loads((ROOT/'src/content/original-text.json').read_text())

    def edited(self,fields):
        source=self.base
        for key,value in fields.items():
            raw=self.raw[key]
            self.assertEqual(source.count(raw),1,key)
            source=source.replace(raw,html.escape(value,quote=False),1)
        return source

    def merge(self,edited,current=None):
        return module.merge(self.template,self.base,edited,self.content,current or self.content)

    def test_current_real_compiled_html_has_no_changes(self):
        result,report=self.merge(self.base)
        self.assertEqual(result,self.content)
        self.assertEqual(report['changedFields'],[])
        self.assertEqual(report['mappedFields'],328)

    def test_real_heading_and_paragraph_exact_changes_preserve_other_values(self):
        changes={'text.0052':'Заголовок & смысл','text.0053':'Первая строка\nВторая строка — с\u00a0пробелом'}
        result,report=self.merge(self.edited(changes))
        self.assertEqual(report['changedFields'],sorted(changes))
        self.assertEqual(result['fields'],{**self.content['fields'],**changes})

    def test_entities_runtime_hang_and_pixel_label_normalize(self):
        key='text.0052';raw=self.raw[key]
        edited=self.base.replace(raw,'<span class="hang">'+raw[:1]+'</span>'+raw[1:],1)
        result,report=self.merge(edited)
        self.assertEqual(report['changedFields'],[])
        key='text.0052';raw=self.raw[key]
        self.assertEqual(self.base.count(raw),1)
        edited=self.base.replace(raw,'<span class="w19-fx"></span><span class="w19-lbl">'+raw+'</span>',1)
        result,report=self.merge(edited);self.assertEqual(report['changedFields'],[])

    def test_team_activity_uses_serializers_aria_label(self):
        template='<html><body><section id="team"><p>{{text:x}}</p></section></body></html>'
        base='<html><body><section id="team"><p>делает AI</p></section></body></html>'
        edited='<html><body><section id="team"><p class="team-activity" aria-label="делает AI"><span>д</span><canvas></canvas></p></section></body></html>'
        content={'fields':{'x':'делает AI'}}
        self.assertEqual(module.merge(template,base,edited,content,content)[1]['changedFields'],[])

    def test_enter_in_single_field_preserves_newline(self):
        key='text.0052';edited=self.base.replace(self.raw[key],'Первая<br>Вторая',1)
        result,report=self.merge(edited)
        self.assertEqual(result['fields'][key],'Первая\nВторая')
        self.assertEqual(report['changedFields'],[key])

    def test_local_change_prevents_old_cloud_overwrite(self):
        current=copy.deepcopy(self.content);current['fields']['text.0052']='Новое локальное'
        with self.assertRaisesRegex(module.ImportRejected,'Concurrent text conflict: text.0052'):
            self.merge(self.edited({'text.0052':'Старая вкладка правит'}),current)
        result,report=self.merge(self.base,current)
        self.assertEqual(result,current);self.assertEqual(report['changedFields'],[])
        result,report=self.merge(self.edited({'text.0052':'Новое локальное'}),current)
        self.assertEqual(result,current);self.assertEqual(report['changedFields'],[])

    def test_ambiguous_structural_edit_and_duplicate_id_rejected(self):
        edited=self.base.replace(self.raw['text.0052'],'<strong>Новое</strong>',1)
        with self.assertRaisesRegex(module.ImportRejected,'structure'):self.merge(edited)
        edited=self.base.replace('<body','<body',1).replace('</body>','<div id="hero">x</div></body>',1)
        with self.assertRaisesRegex(module.ImportRejected,'duplicate id'):self.merge(edited)

    def test_protected_learning_link_and_script_changes_never_enter_content(self):
        for edited in (
            self.base.replace('<section class="learning-space" id="learning"','<section class="learning-space" id="changed-learning"',1),
            self.base.replace('href="https://t.me/ai_mind_set"','href="https://attacker.invalid"',1),
            self.base[:self.base.index('</script>',self.base.index('id="v1x-script"'))]+';alert("injected");'+self.base[self.base.index('</script>',self.base.index('id="v1x-script"')):],
        ):
            with self.subTest():
                with self.assertRaises(module.ImportRejected):self.merge(edited)
        tree,_=module.parse(self.base)
        learning=next(n for n in module.walk(tree) if n.attrs.get('id')=='learning')
        text=next(c for n in module.walk(learning) for c in n.children if isinstance(c,str) and c.strip() and '<' not in c and self.base.count(c)==1)
        with self.assertRaisesRegex(module.ImportRejected,'unmapped/protected'):
            self.merge(self.base.replace(text,text+' changed',1))

    def test_unmapped_visible_insert_and_wrong_base_are_rejected(self):
        with self.assertRaisesRegex(module.ImportRejected,'structure'):
            self.merge(self.base.replace('</main>','<p>new unowned content</p></main>',1))
        wrong=copy.deepcopy(self.content);wrong['fields']['text.0052']='unrelated baseline'
        with self.assertRaisesRegex(module.ImportRejected,'Base HTML/content mismatch for text.0052'):
            module.merge(self.template,self.base,self.base,wrong,wrong)

    def test_cli_meta_binding_and_new_json_output(self):
        root=Path(tempfile.mkdtemp(prefix='wild-google-import-test-'));sha='a'*40
        files={'template.html':self.template,'base.html':self.base,'edited.html':self.base.replace('</head>','<meta name="aim-source-commit" content="'+sha+'"></head>',1),'content.json':json.dumps(self.content,ensure_ascii=False)}
        for name,text in files.items():(root/name).write_text(text)
        command=[sys.executable,'-B',str(ROOT/'tools/release/import-google-save.py'),'--base-template',str(root/'template.html'),'--base-html',str(root/'base.html'),'--edited-html',str(root/'edited.html'),'--base-content',str(root/'content.json'),'--current-content',str(root/'content.json'),'--base-source',sha,'--output',str(root/'out.json'),'--report',str(root/'report.json')]
        run=subprocess.run(command,capture_output=True,text=True);self.assertEqual(run.returncode,0,run.stderr)
        self.assertEqual(json.loads((root/'out.json').read_text()),self.content)
        report=json.loads((root/'report.json').read_text());self.assertEqual(report['changedFields'],[]);self.assertEqual(report['baseSourceSha'],sha)
        bad=command[:];bad[bad.index('--base-source')+1]='b'*40
        run=subprocess.run(bad,capture_output=True,text=True);self.assertNotEqual(run.returncode,0);self.assertIn('matching aim-source-commit',run.stderr)

    def test_serialized_morph_indentation_is_ignored_but_text_is_not(self):
        template='<html><body><section id="approach"><p>{{text:x}}</p><span class="program-card__morph" aria-hidden="true"></span></section></body></html>'
        base=template.replace('{{text:x}}','Text')
        content={'fields':{'x':'Text'}}
        edited=base.replace('</span>','\n   \n</span>')
        self.assertEqual(module.merge(template,base,edited,content,content)[1]['changedFields'],[])
        with self.assertRaises(module.ImportRejected):
            module.merge(template,base,base.replace('</span>','unexpected text</span>'),content,content)
        geometry='<svg class="morph-svg--technical"><defs><pattern><path d="M0 0"/></pattern></defs><rect width="5"/></svg>'
        self.assertEqual(module.merge(template,base,base.replace('</span>',geometry+'</span>'),content,content)[1]['changedFields'],[])
        with self.assertRaises(module.ImportRejected):
            module.merge(template,base,base.replace('</span>',geometry.replace('<rect','<script>bad()</script><rect')+'</span>'),content,content)



if __name__=='__main__':unittest.main()
