"""Local navigation text import: real source, conflicts, protected structure, reverse guard."""
import copy,html,importlib.util,json,sys,unittest,tempfile,shutil
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
imp=load('section_importer',ROOT/'tools/release/import-google-save.py')
google=load('section_publisher',ROOT/'tools/release/publish-google.py')
public=load('section_public',ROOT/'tools/release/public_build.py')
sync=load('section_sync',ROOT/'tools/release/sync-google-save.py')
class SectionLabelsTests(unittest.TestCase):
 def setUp(self):
  # User-editable source captions must not act as unit-test fixture identifiers.
  self.sections={
   'home':'<a href="#about">кто мы</a><a href="#team">команда</a><a href="#product-platform" data-sections="product-platform product-space">платформа</a><a href="#faq" hidden>вопросы</a>',
   'ai-mindset-consulting':'<a href="#format">формат</a>',
  }
  self.labels=imp.section_labels(self.sections)
  self.base='<html><head>'+self.manifest(self.labels)+'</head><body><p id="copy">body</p></body></html>'
 def manifest(self,labels):return '<script id="aim-section-labels" type="application/json">'+json.dumps(labels,ensure_ascii=False).replace('<','\\u003c')+'</script>'
 def cloud(self,labels):return self.base.replace(self.manifest(self.labels),self.manifest(labels))
 def test_page_without_optional_submenu(self):
  self.assertEqual(imp.section_labels({}),{})
  self.assertEqual(imp.section_labels({"home":""}),{})
  result,report=imp.merge_section_labels({}, {}, '<html></html>', '<html></html>')
  self.assertEqual(result,{});self.assertEqual(report['changedFields'],[])
 def test_actual_source_roundtrip_without_caption_or_count_assumptions(self):
  sections=json.loads((ROOT/'src/site-sections.json').read_text());labels=imp.section_labels(sections)
  manifest=self.manifest(labels)
  result,report=imp.merge_section_labels(sections,sections,manifest,manifest)
  self.assertEqual(result,sections);self.assertEqual(report['changedFields'],[])
  for node in imp.Document(sections.get('home','')).root.children:
   if isinstance(node,imp.Node) and 'hidden' in node.attrs:self.assertNotIn(node.attrs['href'][1:],labels)
 def test_renamed_base_labels_keep_threeway_and_already_imported_behavior(self):
  for label in ['кто мы ', 'наша история', 'проект <AI> & люди']:
   with self.subTest(label=label):
    sections={**self.sections,'home':self.sections['home'].replace('>кто мы<','>'+html.escape(label,quote=False)+'<')}
    labels=imp.section_labels(sections);base=self.manifest(labels);incoming=self.manifest({**labels,'about':label+' update'})
    imported,report=imp.merge_section_labels(sections,sections,base,incoming)
    self.assertEqual(report['changedFields'],['about']);self.assertEqual(imp.section_labels(imported)['about'],label+' update')
    unchanged,report=imp.merge_section_labels(sections,imported,base,incoming)
    self.assertEqual(unchanged,imported);self.assertEqual(report['changedFields'],[])
    with self.assertRaisesRegex(ValueError,'Concurrent local'):
     imp.merge_section_labels(sections,imported,base,self.manifest({**labels,'about':'a different Google edit'}))
 def test_threeway_keeps_existing_github_edits_and_escapes_text(self):
  current={**self.sections,'home':self.sections['home'].replace('команда','команда GitHub')};cloud={**self.labels,'about':'кто мы <сегодня> & AI'}
  result,report=imp.merge_section_labels(self.sections,current,self.base,self.cloud(cloud))
  self.assertIn('команда GitHub',result['home']);self.assertIn('кто мы &lt;сегодня&gt; &amp; AI',result['home']);self.assertEqual(report['changedFields'],['about'])
  self.assertEqual(result['ai-mindset-consulting'],self.sections['ai-mindset-consulting'])
 def test_same_field_conflict_and_already_imported(self):
  current={**self.sections,'home':self.sections['home'].replace('кто мы','GitHub')};cloud=self.cloud({**self.labels,'about':'Google'})
  with self.assertRaisesRegex(ValueError,'Concurrent local'):imp.merge_section_labels(self.sections,current,self.base,cloud)
  current['home']=current['home'].replace('GitHub','Google');_,report=imp.merge_section_labels(self.sections,current,self.base,cloud);self.assertEqual(report['changedFields'],[])
 def test_structure_order_destination_hidden_faq_rejected(self):
  for changed in [self.sections['home'].replace('#about','#different'),self.sections['home'].replace('data-sections="product-platform product-space"','data-sections="product-platform"'),self.sections['home'].replace(' hidden',''),self.sections['home'].replace('вопросы','changed hidden')]:
   with self.assertRaises(ValueError):imp.merge_section_labels(self.sections,{**self.sections,'home':changed},self.base,self.base)
  for values in [{**self.labels,'faq':'edit'},{'about':'only'}, {**self.labels,'about':{'href':'bad'}},{**self.labels,'about':''}]:
   with self.assertRaises(ValueError):imp.merge_section_labels(self.sections,self.sections,self.base,self.cloud(values))
 def test_legacy_google_without_manifest_preserves_current_labels_and_text(self):
  old='<html><head></head><body><p id="copy">body</p></body></html>';cloud=old.replace('>body<','>old Google edit<');current={**self.sections,'home':self.sections['home'].replace('кто мы','GitHub')}
  result,report=imp.merge_section_labels(self.sections,current,old,cloud);self.assertEqual(result,current)
  content={'fields':{'text.1':'body'}};result,_=imp.merge(old.replace('>body<','>{{text:text.1}}<'),old,cloud,content,content,section_labels_validated=True);self.assertEqual(result['fields']['text.1'],'old Google edit')
 def test_modified_manifest_requires_section_validation(self):
  edited=self.cloud({**self.labels,'about':'new'});content={'fields':{'text.1':'body'}}
  with self.assertRaisesRegex(ValueError,'validated section merge'):imp.merge(self.base.replace('>body<','>{{text:text.1}}<'),self.base,edited,content,content)
 def test_duplicate_missing_manifest_rejected(self):
  for edited in [self.base.replace('</head>',self.manifest(self.labels)+'</head>'),self.base.replace(self.manifest(self.labels),'')]:
   with self.assertRaises(ValueError):imp.merge_section_labels(self.sections,self.sections,self.base,edited)
 def test_exact_onepassword_status_only_is_ignored(self):
  import html
  artifact='<div '+ ' '.join(k+'="'+html.escape(v,quote=True)+'"' for k,v in imp.ONEPASSWORD_STATUS_ATTRS.items())+'>'+imp.ONEPASSWORD_STATUS_TEXT+'</div>'
  base='<html><body><p id="copy">body</p></body></html>';template=base.replace('>body<','>{{text:text.1}}<');content={'fields':{'text.1':'body'}}
  edited=base.replace('</body>',artifact+'</body>')
  result,_=imp.merge(template,base,edited,content,content);self.assertEqual(result,content)
  for malicious in [artifact.replace('<div ','<div onclick="alert(1)" ',1),artifact.replace('</div>','<script>alert(1)</script></div>'),artifact.replace('1px','100px')]:
   with self.assertRaises(ValueError):imp.merge(template,base,base.replace('</body>',malicious+'</body>'),content,content)
 def test_public_has_no_editor_manifest(self):
  self.assertNotIn('aim-section-labels',public.public_html(self.base))
 def test_reverse_guard_blocks_unimported_label_and_allows_imported(self):
  body='<html><head></head><body><p id="copy">body</p></body></html>';template=body.replace('>body<','>{{text:text.1}}<')
  old=body.replace('</head>',self.manifest(self.labels)+'</head>');cloud=old.replace(self.manifest(self.labels),self.manifest({**self.labels,'about':'Google label'}));cloud=google.stamp(cloud,1,'a'*40)
  files={'src/page/index.html':template,'index.html':old,'src/content/main.json':json.dumps({'fields':{'text.1':'body'}}),'src/site-sections.json':json.dumps(self.sections)}
  home=Path(tempfile.mkdtemp(prefix='aim-section-reverse-'));(home/'src/content').mkdir(parents=True);(home/'src/content/main.json').write_text(files['src/content/main.json']);(home/'src/site-sections.json').write_text(files['src/site-sections.json'])
  with patch.object(google,'module',return_value=imp),patch.object(google.subprocess,'run'),patch.object(google.subprocess,'check_output',side_effect=lambda args,**kw:files[args[2].split(':',1)[1]].encode()):
   with self.assertRaisesRegex(ValueError,'unimported local section'):google.check_pending(home,({},cloud.encode()),'b'*40)
   current={**self.sections,'home':self.sections['home'].replace('кто мы','Google label')};(home/'src/site-sections.json').write_text(json.dumps(current));google.check_pending(home,({},cloud.encode()),'b'*40)
 def test_section_only_direct_commit_keeps_single_nonforce_ref_update(self):
  calls=[]
  def api(root,path,method='GET',body=None):
   calls.append((path,method,body))
   if path=='git/ref/heads/wild':return {'object':{'sha':'a'*40}}
   if path=='git/commits/'+'a'*40:return {'tree':{'sha':'tree'}}
   return {'sha':'c'*40}
  result=sync.commit_text(ROOT,'a'*40,{sync.SECTIONS:b'{}'}, {'rev':5},'b'*40,[],api,section_changes=['about'])
  self.assertEqual(result,'c'*40);self.assertEqual(calls[-1][2],{'sha':'c'*40,'force':False});self.assertEqual(sum(c[1]=='PATCH' for c in calls),1)
if __name__=='__main__':unittest.main()
