import json
from pathlib import Path
import re
import subprocess
import unittest

from public_build import Spans, public_html, public_css, public_text, assert_public

ROOT = Path(__file__).resolve().parents[2]


def script_bodies(source):
    result=[]
    for n in Spans(source).nodes:
        if n['tag']=='script' and n['attrs'].get('type','') not in ('application/json','application/ld+json') and 'src' not in n['attrs']:
            end=source.rfind('</script',n['open_end'],n['end'])
            result.append(source[n['open_end']:end])
    return result


class PublicBuildTests(unittest.TestCase):
    def test_map_retains_public_interactions_and_data(self):
        source=(ROOT/'ecosystem-mindmap.html').read_text()
        result=public_html(source)
        original_nodes=[n for n in Spans(source).nodes if n['attrs'].get('id')=='mapData'][0]
        self.assertIn(source[original_nodes['start']:original_nodes['end']], result)
        for expected in ("stage.addEventListener('pointerdown'", "stage.addEventListener('pointermove'",
                         "stage.addEventListener('wheel'", "stage.addEventListener('click'",
                         "document.querySelector('#zoomIn').addEventListener", "document.querySelector('#zoomOut').addEventListener",
                         "document.querySelector('#fitMap').addEventListener", "window.addEventListener('keydown'",
                         "collapsed.add(id)", "collapsed.delete(id)", "node.href", "renderNodes();drawEdges();requestAnimationFrame(refitForStageSize)"):
            self.assertIn(expected,result)
        for forbidden in ('setMapEditing','serializedMap','saveMapCopy','applyCopy','copyDirty','EDIT_API','data-map-editable','beforeunload'):
            self.assertNotIn(forbidden,result)

    def test_public_inline_javascript_compiles(self):
        scripts=[]
        for path in ('index.html','ecosystem-mindmap.html','ecosystem-grid-legacy.html','non-profit/index.html'):
            scripts.extend(script_bodies(public_html((ROOT/path).read_text())))
        script="const vm=require('node:vm');let input='';process.stdin.on('data',x=>input+=x).on('end',()=>JSON.parse(input).forEach((s,i)=>{try{new vm.Script(s)}catch(e){throw new Error('script '+i+': '+e.message)}}));"
        check=subprocess.run(['node','-e',script],input=json.dumps(scripts),text=True,capture_output=True)
        self.assertEqual(check.returncode,0,check.stderr)

    def test_home_sections_and_learning_exports_preserved(self):
        source=(ROOT/'index.html').read_text();result=public_html(source)
        # Content survives except editor annotations and the public events origin.
        for n in Spans(source).nodes:
            if n['tag']=='section':
                fragment=source[n['start']:n['end']]
                expected=re.sub(r'<!--.*?-->','',public_text(fragment),flags=re.S)
                expected=expected.replace('data-events-api="/__events"', 'data-events-api="https://aimindset-wild.web.app/__events"')
                self.assertTrue(expected in result, 'Changed content section: '+str(n['attrs'].get('id')))
            if n['tag']=='script' and 'data-learning-runtime' in n['attrs']:
                self.assertIn(public_text(source[n['start']:n['end']]),result)
        self.assertIn('id="ecosystemMapOpen"',result)
        self.assertIn('ecosystem-mindmap.html?embed=1',result)
        self.assertIn('id="waitlistDialog"',result)
        self.assertIn('data-events-api="https://aimindset-wild.web.app/__events"',result)
        self.assertNotIn('data-events-api="/__events"',result)
        self.assertNotIn('.dataset.editorRuntime', result)
        nonprofit=public_html((ROOT/'non-profit/index.html').read_text())
        self.assertIn('data-learning-embed',nonprofit)
        self.assertIn('../assets/site/learning-frame.html',nonprofit)

    def test_css_keeps_normal_selectors_in_mixed_rule(self):
        css='@media(max-width:800px){#editBar,.public{color:red}.card{color:blue}}'
        self.assertEqual(public_css(css),'@media(max-width:800px){.public{color:red}.card{color:blue}}')
        self.assertEqual(public_css('/* editing compatibility */ .card{color:red}'), '/* editing compatibility */ .card{color:red}')
        self.assertEqual(public_css('.card:hover{color:red}@keyframes a{0%{opacity:0}100%{opacity:1}}'),'.card:hover{color:red}@keyframes a{0%{opacity:0}100%{opacity:1}}')

    def test_leak_gate_fails_closed(self):
        for snippet in ('fetch("/__save")','setMapEditing editEnabled','<div contenteditable>','<meta name="aim-edit-api">','aim-map:state','.edit-bar{}','data-editor-runtime'):
            with self.assertRaises(ValueError,msg=snippet): assert_public(snippet)

    def test_all_public_html_passes(self):
        for path in ('index.html','non-profit/index.html','ai-mindset-consulting/index.html','oferta/index.html','confpolicy/index.html','ecosystem-mindmap.html','ecosystem-grid-legacy.html','assets/site/learning-frame.html'):
            with self.subTest(path=path): assert_public(public_html((ROOT/path).read_text()))


if __name__=='__main__': unittest.main()
