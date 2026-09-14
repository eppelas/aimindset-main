"""Entity-preserving canonical page rendering and protected extraction boundaries."""
import importlib.util,json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('editor_pages',ROOT/'tools/release/editor_pages.py')
pages=importlib.util.module_from_spec(spec);spec.loader.exec_module(pages)
class PagesTests(unittest.TestCase):
 def test_original_entities_roundtrip_and_changed_text_escaped(self):
  template='<p>{{text:a}}</p>';raw={'a':'A&nbsp;&amp; B'}
  self.assertEqual(pages.render_text(template,{'a':'A\u00a0& B'},raw),'<p>A&nbsp;&amp; B</p>')
  self.assertEqual(pages.render_text(template,{'a':'<new>&'},raw),'<p>&lt;new&gt;&amp;</p>')
 def test_missing_duplicate_and_extra_fields_rejected(self):
  for template,fields in [('{{text:a}}',{}),('{{text:a}}{{text:a}}',{'a':'A'}),('plain',{'a':'A'})]:
   with self.assertRaises(ValueError):pages.render_text(template,fields,{})
 def test_current_pages_have_exactly_bound_author_fields(self):
  for slug in ['ai-mindset-consulting','non-profit']:
   page=pages.PAGES[slug];rendered=pages.render_page(ROOT,slug)
   self.assertNotIn('{{text:',rendered)
   self.assertIn('<aim-site-header page="'+slug+'"',rendered)
   self.assertEqual(page['object'],'wild/'+slug+'/index.html')
 def test_public_strips_overlay_scripts_styles_and_meta(self):
  spec=importlib.util.spec_from_file_location('pages_public',ROOT/'tools/release/public_build.py');public=importlib.util.module_from_spec(spec);spec.loader.exec_module(public)
  source='<html><head><style id="aim-editor-overlay-styles">.edit-bar{color:red}</style><meta name="aim-edit-object" content="wild/non-profit/index.html"></head><body><main>kept</main><div id="editBar">edit</div><script id="aim-editor-sync-runtime">AIMEditorSync; /__sync-status</script><script id="aim-editor-overlay-runtime">editSave;</script></body></html>'
  result=public.public_html(source)
  self.assertIn('<main>kept</main>',result)
  for forbidden in ['editBar','AIMEditorSync','aim-editor','aim-edit-object','sync-status']:self.assertNotIn(forbidden,result)
 def test_learning_and_gallery_controls_not_extracted(self):
  ngo=(ROOT/pages.PAGES['non-profit']['template']).read_text()
  host=ngo.split('data-learning-embed',1)[1].split('</iframe>',1)[0]
  self.assertNotIn('{{text:',host)
  team=(ROOT/pages.PAGES['ai-mindset-consulting']['template']).read_text()
  control=team.split('data-case-toggle',1)[1].split('</button>',1)[0]
  self.assertNotIn('{{text:',control)
if __name__=='__main__':unittest.main()
