"""Delivery retry and parent-only consumer commits; no network or repository mutation."""
import importlib.util
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch
from types import SimpleNamespace

ROOT=Path(__file__).resolve().parents[2]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
sync=load('sync_recovery_test',ROOT/'tools/release/sync-google-save.py')
HEAD='a'*40;PIN='b'*40;OLD='c'*40


class RecoveryTests(unittest.TestCase):
    def delivery(self,cloud=OLD,pages=None,runs=None):
        calls=[];dispatched=[]
        def api(root,path,*args):
            calls.append(path)
            if path=='git/ref/heads/wild':return {'object':{'sha':HEAD}}
            return {'workflow_runs':runs or [],'total_count':len(runs or [])}
        result=sync.ensure_delivery(ROOT,HEAD,PIN,cloud,api,lambda *args:json.dumps(pages or {}).encode(),lambda command,*args:dispatched.append(command))
        return result,calls,dispatched

    def test_local_validation_diagnostics_are_bounded_and_redacted(self):
        secret='private-test-token-value'
        failed=SimpleNamespace(returncode=1,stdout=b'',stderr=(('x'*8000)+'\nFAIL: test_current_content\n'+secret+' Bearer token-value').encode())
        with patch.object(sync.subprocess,'run',return_value=failed), patch.dict(os.environ,{'TEST_SECRET':secret}):
            with self.assertRaises(RuntimeError) as caught:sync.run(['python3','-m','unittest'],ROOT)
        message=str(caught.exception)
        self.assertIn('FAIL: test_current_content',message)
        self.assertNotIn(secret,message);self.assertNotIn('token-value',message)
        self.assertLess(len(message),6100)
        with patch.object(sync.subprocess,'run',return_value=failed):
            with self.assertRaises(RuntimeError) as caught:sync.run(['gh','api','endpoint'],ROOT)
        self.assertEqual(str(caught.exception),'Command failed: gh api endpoint')

    def test_both_destinations_exact_noop(self):
        result,_,sent=self.delivery(HEAD,{'sourceCommit':HEAD,'platformCommit':PIN})
        self.assertEqual(result,'delivered');self.assertEqual(sent,[])

    def test_commit_succeeded_dispatch_failed_recovered_without_commit(self):
        result,calls,sent=self.delivery()
        self.assertEqual(result,'release-dispatched');self.assertEqual(len(sent),1)
        self.assertEqual(sent[0][sent[0].index('--ref')+1],'wild')
        self.assertIn('source_ref='+HEAD,sent[0]);self.assertTrue(all('git/commits' not in c for c in calls))

    def test_each_destination_and_parent_pair_must_match(self):
        for cloud,pages in [(OLD,{'sourceCommit':HEAD,'platformCommit':PIN}),(HEAD,{'sourceCommit':OLD,'platformCommit':PIN}),(HEAD,{'sourceCommit':HEAD,'platformCommit':OLD})]:
            with self.subTest(cloud=cloud,pages=pages):self.assertEqual(self.delivery(cloud,pages)[0],'release-dispatched')

    def test_active_exact_run_is_not_duplicated(self):
        for status in ('queued','in_progress','waiting','pending','requested'):
            with self.subTest(status=status):
                result,_,sent=self.delivery(runs=[{'head_sha':HEAD,'status':status}])
                self.assertEqual(result,'release-active');self.assertEqual(sent,[])

    def test_failed_cancelled_or_other_head_run_retries(self):
        for run in [{'head_sha':HEAD,'status':'completed','conclusion':'failure'},{'head_sha':HEAD,'status':'completed','conclusion':'cancelled'},{'head_sha':OLD,'status':'in_progress'}]:
            with self.subTest(run=run):self.assertEqual(self.delivery(runs=[run])[0],'release-dispatched')

    def test_advanced_head_prevents_dispatch(self):
        calls=[]
        def api(root,path,*args):
            if path=='git/ref/heads/wild':
                calls.append(path);return {'object':{'sha':HEAD if len(calls)==1 else OLD}}
            return {'workflow_runs':[],'total_count':0}
        with self.assertRaisesRegex(ValueError,'advanced before dispatch'):
            sync.ensure_delivery(ROOT,HEAD,PIN,OLD,api,lambda *args:b'{}',lambda *args:self.fail('stale dispatch'))

    def test_active_run_on_second_page_is_found(self):
        def api(root,path,*args):
            if path=='git/ref/heads/wild':return {'object':{'sha':HEAD}}
            return {'workflow_runs':[{'head_sha':HEAD,'status':'queued'}] if 'page=2' in path else [],'total_count':101}
        self.assertEqual(sync.ensure_delivery(ROOT,HEAD,PIN,OLD,api,lambda *args:b'{}',lambda *args:self.fail('duplicate dispatch')),'release-active')

    def test_parallel_google_save_blocks_commit(self):
        before=({'rev':1,'sha':'one','generation':'1'},b'html',HEAD)
        for after in [({'rev':2,'sha':'two','generation':'2'},b'changed',HEAD),({'rev':1,'sha':'one','generation':'2'},b'html',HEAD)]:
            with self.assertRaisesRegex(ValueError,'no commit written'):sync.assert_same_snapshot(before,after)
        sync.assert_same_snapshot(before,before)

    def test_parent_only_commit_is_allowlisted_and_has_exact_parent(self):
        calls=[]
        def api(root,path,method='GET',body=None):
            calls.append((path,method,body))
            if path=='git/ref/heads/wild':return {'object':{'sha':HEAD}}
            if path=='git/commits/'+HEAD:return {'tree':{'sha':'base-tree'}}
            if path=='git/blobs':return {'sha':'blob'}
            if path=='git/trees':return {'sha':'tree'}
            if path=='git/commits':return {'sha':OLD}
            return {}
        contents={sync.DEPENDENCY:json.dumps({'revision':PIN}).encode(),'index.html':b'new protected parent','assets/site/site-shell.js':b'new shell','source-build-record.json':b'new record'}
        result=sync.commit_text(ROOT,HEAD,contents,{'rev':1,'sha':'snapshot'},HEAD,[],api,parent_revision=PIN)
        self.assertEqual(result,OLD)
        commit=next(body for path,method,body in calls if path=='git/commits')
        self.assertEqual(commit['parents'],[HEAD]);self.assertIn('Platform-Revision: '+PIN,commit['message'])
        self.assertEqual(calls[-1][2],{'sha':OLD,'force':False})
        tree=next(body for path,method,body in calls if path=='git/trees')
        self.assertEqual({x['path'] for x in tree['tree']},set(contents))
        with self.assertRaisesRegex(ValueError,'allowlist'):
            sync.commit_text(ROOT,HEAD,{**contents,'src/page/runtime/other.js':b'bad'}, {'rev':1},HEAD,[],api,parent_revision=PIN)
        self.assertIsNone(sync.commit_text(ROOT,HEAD,{}, {'rev':1},HEAD,[],api))

    def test_new_consumer_baseline_matches_actual_parent_materialize(self):
        # Release CI has ../platform; a local run can select the same read-only checkout.
        platform=Path(os.environ.get('AIM_PLATFORM_TEST_ROOT',ROOT.parent/'platform'))
        shared_path=platform/'platform_core/shared.py'
        if not shared_path.is_file():self.skipTest('Actual parent checkout not available; release CI executes this integration case')
        shared=load('actual_parent_materialize_test',shared_path)
        importer=load('actual_parent_importer_test',ROOT/'tools/release/import-google-save.py')
        components=shared.load_components(platform)
        template='<html><head></head><body><section id="hero"><h1>{{text:title}}</h1></section>{{shared:learning}}</body></html>'
        old=shared.materialize(template.replace('{{text:title}}','Original'),components)
        updated={**components,'learning':components['learning'].replace('</section>','<p>New approved parent wording</p></section>',1)}
        new=shared.materialize(template.replace('{{text:title}}','Original'),updated)
        content={'fields':{'title':'Original'}}
        result,report=importer.merge(template,new,new,content,content)
        self.assertEqual(report['changedFields'],[])
        result,report=importer.merge(template,new,new.replace('<h1>Original</h1>','<h1>Edited</h1>'),content,content)
        self.assertEqual(report['changedFields'],['title'])
        with self.assertRaises(importer.ImportRejected):importer.merge(template,old,new,content,content)
        with self.assertRaises(importer.ImportRejected):importer.merge(template,new,new.replace('New approved parent wording','Unapproved change'),content,content)


if __name__=='__main__':unittest.main()
