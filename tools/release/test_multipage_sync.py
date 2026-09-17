"""Page identity, independent label merging, protected edits and one commit."""
import hashlib,importlib.util,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);sys.modules[name]=m;s.loader.exec_module(m);return m
sync=load('multi_sync',ROOT/'tools/release/sync-google-save.py')
imp=load('multi_import',ROOT/'tools/release/import-google-save.py')
class MultiTests(unittest.TestCase):
 def test_section_keys_remain_independent(self):
  sections={'home':'<a href="#about">Home</a>','ai-mindset-consulting':'<a href="#about">Team</a>'}
  manifest=lambda text:'<script id="aim-section-labels" type="application/json">'+json.dumps({'about':text})+'</script>'
  result,report=imp.merge_section_labels(sections,sections,manifest('Team'),manifest('New'),section_key='ai-mindset-consulting')
  self.assertEqual(result['home'],sections['home']);self.assertEqual(imp.section_labels(result,'ai-mindset-consulting'),{'about':'New'})
  with self.assertRaises(ValueError):imp.merge_section_labels(sections,result,manifest('Team'),manifest('Other'),section_key='ai-mindset-consulting')
 def test_every_snapshot_validates_object_hash_and_revision(self):
  for page_id,page in sync.PAGES.items():
   body=('<html data-rev="1"><meta name="aim-source-commit" content="'+'a'*40+'"></html>').encode()
   status={'ok':True,'object':page['object'],'rev':1,'sha':hashlib.sha256(body).hexdigest()[:16],'generation':'2'}
   def reader(url,limit):return json.dumps(status).encode() if '/__status?' in url else body
   self.assertEqual(sync.cloud_snapshot(reader,page_id)[2],'a'*40)
   status['object']='index.html'
   with self.assertRaises(ValueError):sync.cloud_snapshot(reader,page_id)
 def test_real_page_sources_roundtrip_and_reject_protected_links(self):
  pages=load('multi_pages',ROOT/'tools/release/editor_pages.py')
  for page_id,page in sync.PAGES.items():
   if page_id=='home':continue
   base=pages.render_page(ROOT,page_id);content=json.loads((ROOT/page['content']).read_text());template=(ROOT/page['template']).read_text()
   result,report=imp.merge(template,base,base,content,content)
   self.assertEqual(result,content);self.assertEqual(report['changedFields'],[])
   import re
   edited=re.sub(r'href="[^"]+"','href="https://example.invalid"',base,count=1)
   with self.assertRaises(ValueError):imp.merge(template,base,edited,content,content)
 def test_all_page_paths_in_one_nonforce_commit(self):
  calls=[]
  def api(root,path,method='GET',body=None):
   calls.append((path,method,body))
   if path=='git/ref/heads/wild':return {'object':{'sha':'a'*40}}
   if path=='git/commits/'+'a'*40:return {'tree':{'sha':'tree'}}
   return {'sha':'b'*40}
  paths={p['content'] for p in sync.PAGES.values()}
  sync.commit_text(ROOT,'a'*40,{p:b'{}' for p in paths},{'rev':1},'c'*40,['home:text.1'],api,content_paths=paths)
  self.assertEqual(sum(method=='PATCH' for _,method,_ in calls),1)
  self.assertEqual(calls[-1][2],{'sha':'b'*40,'force':False})
  tree=next(body for path,method,body in calls if path=='git/trees');self.assertEqual({x['path'] for x in tree['tree']},paths)
 def test_wait_confirms_both_hosts_after_delay_without_dispatch(self):
  ticks=[0];events=[];head='a'*40;pin='b'*40
  snapshots={key:({'object':p['object'],'rev':1,'sha':'c'*16},b'',head) for key,p in sync.PAGES.items()}
  def reader(*args):return json.dumps({'sourceCommit':head if ticks[0]>=15 else 'c'*40,'platformCommit':pin}).encode()
  result=sync.wait_delivery(ROOT,head,pin,snapshots,api=lambda *args:{'object':{'sha':head}},reader=reader,snapshotter=lambda page_id='home':snapshots[page_id],sleeper=lambda n:ticks.__setitem__(0,ticks[0]+n),clock=lambda:ticks[0],reporter=lambda snap,state,**kw:events.append(state))
  self.assertEqual(result,'published');self.assertEqual(ticks[0],15);self.assertEqual(events.count('published'),len(sync.PAGES))
 def test_wait_timeout_and_superseded_never_report_published(self):
  for advanced in [False,True]:
   ticks=[0];events=[];head='a'*40
   def sleeper(n):ticks[0]+=n
   with self.assertRaises(ValueError if advanced else TimeoutError):
    sync.wait_delivery(ROOT,head,'b'*40,{'home':({'object':'wild/index.html'},b'',head)},timeout=30,api=lambda *args:{'object':{'sha':'c'*40 if advanced else head}},reader=lambda *args:b'{}',clock=lambda:ticks[0],sleeper=sleeper,reporter=lambda snap,state,**kw:events.append(state))
   self.assertNotIn('published',events);self.assertEqual(ticks[0],0 if advanced else 30)
 def test_one_page_race_rejects_batch(self):
  for page in sync.PAGES.values():
   before=({'object':page['object'],'rev':1,'sha':'a','generation':'1'},b'old','a'*40)
   with self.assertRaises(ValueError):sync.assert_same_snapshot(before,({**before[0],'generation':'2'},b'new','a'*40))
if __name__=='__main__':unittest.main()
