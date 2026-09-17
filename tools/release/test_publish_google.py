"""Reverse publication guards, with all network/Git effects mocked."""
import base64
import hashlib
import html
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('publish_google_test',ROOT/'tools/release/publish-google.py')
google=importlib.util.module_from_spec(spec);spec.loader.exec_module(google)
SHA='a'*40


class PublishGoogleTests(unittest.TestCase):
    def test_stamp_is_idempotent_and_only_changes_provenance_and_revision(self):
        page='<html data-rev="7"><head><title>Text</title></head><body><script>const x=1;</script>Original</body></html>'
        stamped=google.stamp(page,8,SHA)
        self.assertEqual(google.stamp(stamped,8,SHA),stamped)
        self.assertEqual(stamped.count('name="aim-source-commit"'),1)
        self.assertIn('<html data-rev="8">',stamped)
        self.assertIn('<script>const x=1;</script>Original',stamped)
        changed=google.stamp(stamped,9,'b'*40)
        self.assertNotIn(SHA,changed);self.assertIn('data-rev="9"',changed)

    def test_snapshot_rejects_concurrent_save_and_wrong_payload(self):
        data=b'<html>source</html>';status={'ok':True,'object':'wild/index.html','rev':1,'sha':google.digest(data)[:16],'generation':'10'}
        with patch.object(google,'json_request',side_effect=[status,status]),patch.object(google,'request',return_value=data):
            self.assertEqual(google.snapshot(),(status,data))
        for second,payload in [({**status,'generation':'11'},data),(status,b'different bytes')]:
            with self.subTest(),patch.object(google,'json_request',side_effect=[status,second]),patch.object(google,'request',return_value=payload):
                with self.assertRaises(AssertionError):google.snapshot()

    def test_backup_pins_source_generation_and_create_only_destination(self):
        calls=[]
        def api(url,*args,**kw):
            calls.append(url)
            if len(calls)==1:return None
            if len(calls)==2:return {'done':False,'rewriteToken':'next / token'}
            return {'done':True}
        with patch.object(google,'json_request',side_effect=api):
            name=google.backup('wild/assets/x.css',{'generation':'123','md5Hash':'abc'},SHA,'token')
        self.assertEqual(name,'wild/release-backups/'+SHA+'/123/assets/x.css')
        self.assertIn('ifSourceGenerationMatch=123&ifGenerationMatch=0',calls[1])
        self.assertIn('rewriteToken=next%20%2F%20token',calls[2])
        self.assertIn('ifSourceGenerationMatch=123',calls[2])

    def test_existing_backup_requires_matching_identity(self):
        with patch.object(google,'json_request',return_value={'md5Hash':'different'}):
            with self.assertRaisesRegex(AssertionError,'identity conflict'):
                google.backup('wild/index.html',{'generation':'12','md5Hash':'expected'},SHA,'token')

    def test_upload_is_conditional_and_checks_returned_content_hash(self):
        data=b'original source bytes';md5=base64.b64encode(hashlib.md5(data).digest()).decode()
        for old,match in [(None,'0'),({'generation':'123'},'123')]:
            with self.subTest(),patch.object(google,'json_request',return_value={'md5Hash':md5,'generation':'456'}) as call:
                self.assertEqual(google.upload('wild/test.css',data,old,SHA,'token'),'456')
                args=call.call_args.args
                self.assertTrue(args[0].endswith('ifGenerationMatch='+match))
                self.assertIn(data,args[2]);self.assertIn(SHA.encode(),args[2])
        with patch.object(google,'json_request',return_value={'md5Hash':'wrong','generation':'456'}):
            with self.assertRaisesRegex(AssertionError,'hash mismatch'):google.upload('wild/test.css',data,None,SHA,'token')

    def test_bootstrap_requires_exact_audited_revision_and_hash(self):
        cloud=({'rev':168,'sha':'audited'},b'<html><head></head><body>old</body></html>')
        google.check_pending(ROOT,cloud,SHA,168,'audited')
        for rev,sha in [(None,None),(167,'audited'),(168,'wrong')]:
            with self.subTest(),self.assertRaisesRegex(AssertionError,'audited revision/hash'):
                google.check_pending(ROOT,cloud,SHA,rev,sha)

    def pending(self,edited,current=None):
        files={p:(ROOT/p).read_bytes() for p in ('src/page/index.html','index.html','src/content/main.json','src/site-sections.json')}
        original_module=google.module
        if current is not None:
            importer=original_module('pending_import_test',ROOT/'tools/release/import-google-save.py')
            real_merge=importer.merge
            importer.merge=lambda template,base,cloud,base_content,_current,**kwargs:real_merge(template,base,cloud,base_content,current,**kwargs)
            modules=patch.object(google,'module',return_value=importer)
        else:modules=patch.object(google,'module',wraps=original_module)
        with patch.object(google.subprocess,'run') as ancestor,patch.object(google.subprocess,'check_output',side_effect=lambda args,**kw:files[args[2].split(':',1)[1]]),modules:
            result=google.check_pending(ROOT,({},google.stamp(edited,168,SHA).encode()),'b'*40)
            ancestor.assert_called_once()
            return result

    def test_pending_google_text_blocks_publication_with_real_importer(self):
        base=(ROOT/'index.html').read_text();original=json.loads((ROOT/'src/content/original-text.json').read_text())['text.0052'];value=json.loads((ROOT/'src/content/main.json').read_text())['fields']['text.0052'];raw=original if html.unescape(original)==value else html.escape(value,quote=False)
        self.pending(base)
        with self.assertRaisesRegex(ValueError,'unimported text.*text.0052'):
            self.pending(base.replace(raw,'A new cloud heading',1))
        current=json.loads((ROOT/'src/content/main.json').read_text());current['fields']['text.0052']='A new cloud heading'
        self.pending(base.replace(raw,'A new cloud heading',1),current)

    def test_google_script_mutation_never_becomes_source(self):
        base=(ROOT/'index.html').read_text();at=base.index('</script>',base.index('id="v1x-script"'))
        with self.assertRaises(ValueError):self.pending(base[:at]+';malicious();'+base[at:])

    def test_main_rejects_index_not_matching_verified_artifact(self):
        root=Path(tempfile.mkdtemp(prefix='google-index-contract-'));artifact=root/'artifact';artifact.mkdir()
        (root/'index.html').write_text('<html data-rev="1"><head></head><body>unverified</body></html>')
        manifest={'sourceCommit':SHA,'platformCommit':'b'*40,'files':{'index.html':{'sha256':google.digest(b'verified artifact'),'bytes':17}}}
        (artifact/'release-manifest.json').write_text(json.dumps(manifest))
        public=types.SimpleNamespace(verified_artifact=lambda p:None)
        transform=types.SimpleNamespace(public_html=lambda t:t,public_text=lambda t:t,public_css=lambda t:t,oidc_token=lambda:'fixture-oidc')
        args=['publish-google.py','--root',str(root),'--artifact',str(artifact),'--source-sha',SHA,'--receipt',str(root/'receipt.json')]
        cloud=({'rev':1,'sha':'old','generation':'1'},b'old cloud')
        with patch.object(sys,'argv',args),patch.object(google,'run',return_value=SHA),patch.object(google,'module',side_effect=lambda name,p:public if name=='google_public_contract' else transform),patch.object(google,'page_snapshot',return_value=cloud),patch.object(google,'check_pending'),patch.object(google,'json_request') as network:
            with self.assertRaisesRegex(AssertionError,'Index differs from verified artifact'):google.main()
            network.assert_not_called()

    def main_fixture(self, assets):
        root=Path(tempfile.mkdtemp(prefix='google-publish-flow-'));artifact=root/'artifact';artifact.mkdir()
        page='<html data-rev="1"><head></head><body>verified</body></html>'
        files={}
        for config in google.PAGES.values():
            file=root/config['output'];file.parent.mkdir(parents=True,exist_ok=True);file.write_text(page)
            files[config['output']]={'sha256':google.digest(page.encode()),'bytes':len(page)}
        for name,data in assets.items():
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
            files[name]={'sha256':google.digest(data),'bytes':len(data)}
        (artifact/'release-manifest.json').write_text(json.dumps({'sourceCommit':SHA,'platformCommit':'b'*40,'files':files}))
        cloud_data=google.stamp(page,1,SHA).encode()
        cloud=({'rev':1,'sha':google.digest(cloud_data)[:16],'generation':'10'},cloud_data)
        public=types.SimpleNamespace(verified_artifact=lambda p:None)
        transform=types.SimpleNamespace(public_html=lambda t:t,public_text=lambda t:t,public_css=lambda t:t,oidc_token=lambda:'fixture-oidc')
        args=['publish-google.py','--root',str(root),'--artifact',str(artifact),'--source-sha',SHA,'--publish','--receipt',str(root/'receipt.json')]
        return root,cloud,public,transform,args

    def test_nested_bootstrap_exact_full_hash_and_object_allowlist(self):
        page=google.PAGES['non-profit'];data=b'<html><head></head><body>legacy</body></html>';cloud=({'object':page['object'],'rev':0},data)
        with self.assertRaises(AssertionError):google.check_pending(ROOT,cloud,SHA,page=page)
        with self.assertRaises(AssertionError):google.check_pending(ROOT,cloud,SHA,page=page,bootstrap_pages={page['object']:{'sha256':'0'*64}})
        google.check_pending(ROOT,cloud,SHA,page=page,bootstrap_pages={page['object']:{'sha256':google.digest(data)}})
        path=Path(tempfile.mkdtemp(prefix='bootstrap-map-'))/'map.json';path.write_text(json.dumps({'wild/other.html':{'sha256':'0'*64}}))
        with self.assertRaises(ValueError):google.load_bootstrap(path)

    def test_missing_identity_prevents_all_publication_writes(self):
        root,cloud,public,transform,args=self.main_fixture({'assets/a.css':b'asset'})
        transform.oidc_token=lambda:None
        with patch.object(sys,'argv',args),patch.object(google,'run',return_value='storage-access-token'),patch.object(google,'module',side_effect=lambda n,p:public if n=='google_public_contract' else transform),patch.object(google,'page_snapshot',return_value=cloud),patch.object(google,'check_pending'),patch.object(google,'json_request',return_value=None),patch.object(google,'upload') as upload,patch.object(google,'backup') as backup:
            # Exact checkout check is distinct from the Google access-token lookup.
            with patch.object(google,'run',side_effect=lambda command,root:SHA if command[:2]==['git','rev-parse'] else 'storage-access-token'):
                with self.assertRaisesRegex(AssertionError,'workflow identity required'):google.main()
            upload.assert_not_called();backup.assert_not_called()

    def test_reverse_save_uses_oidc_and_exact_publication_source(self):
        root,cloud,public,transform,args=self.main_fixture({})
        old=({'rev':1,'sha':'old','generation':'10'},b'old html');calls=[]
        def snapshot(page,token):
            if calls and calls[-1][0].endswith('/__save'):
                data=google.stamp((root/page['output']).read_text(),2,SHA).encode()
                return {'object':page['object'],'rev':2,'sha':google.digest(data)[:16],'generation':'11'},data
            return old
        def network(url,*args,**kwargs):
            calls.append((url,args,kwargs))
            if url.endswith('/__save'):
                payload=args[1];self.assertEqual(kwargs['token'],'fixture-oidc');self.assertEqual(payload['publicationSource'],SHA)
                data=google.stamp(payload['html'],2,SHA).encode();return {'ok':True,'rev':2,'sha':google.digest(data)[:16]}
            return {'generation':'10'}
        with patch.object(sys,'argv',args),patch.object(google,'run',return_value=SHA),patch.object(google,'module',side_effect=lambda n,p:public if n=='google_public_contract' else transform),patch.object(google,'page_snapshot',side_effect=snapshot),patch.object(google,'check_pending'),patch.object(google,'json_request',side_effect=network),patch.object(google,'backup',return_value='wild/backup'):
            google.main()
        self.assertEqual(sum(url.endswith('/__save') for url,_,_ in calls),len(google.PAGES))

    def test_pending_child_blocks_all_uploads(self):
        root,cloud,public,transform,args=self.main_fixture({'assets/a.css':b'asset'})
        def pending(*args,**kwargs):
            if kwargs['page']['id']=='non-profit':raise ValueError('pending child')
        with patch.object(sys,'argv',args),patch.object(google,'run',return_value=SHA),patch.object(google,'module',side_effect=lambda n,p:public if n=='google_public_contract' else transform),patch.object(google,'page_snapshot',return_value=cloud),patch.object(google,'check_pending',side_effect=pending),patch.object(google,'json_request') as network,patch.object(google,'upload') as upload:
            with self.assertRaisesRegex(ValueError,'pending child'):google.main()
            network.assert_not_called();upload.assert_not_called()

    def test_child_generation_race_blocks_uploads(self):
        root,cloud,public,transform,args=self.main_fixture({});calls=[0]
        def snapshot(*args):
            calls[0]+=1
            return ({**cloud[0],'generation':'11'},cloud[1]) if calls[0]==len(google.PAGES)+2 else cloud
        with patch.object(sys,'argv',args),patch.object(google,'run',return_value=SHA),patch.object(google,'module',side_effect=lambda n,p:public if n=='google_public_contract' else transform),patch.object(google,'page_snapshot',side_effect=snapshot),patch.object(google,'check_pending'),patch.object(google,'upload') as upload:
            with self.assertRaisesRegex(AssertionError,'changed before publishing'):google.main()
            upload.assert_not_called()

    def test_same_source_and_same_cloud_has_no_reverse_publish_loop(self):
        root,cloud,public,transform,args=self.main_fixture({})
        with patch.object(sys,'argv',args),patch.object(google,'run',return_value=SHA),patch.object(google,'module',side_effect=lambda n,p:public if n=='google_public_contract' else transform),patch.object(google,'page_snapshot',return_value=cloud),patch.object(google,'check_pending'),patch.object(google,'json_request') as network,patch.object(google,'upload') as upload:
            google.main();network.assert_not_called();upload.assert_not_called()
        receipt=json.loads((root/'receipt.json').read_text())
        self.assertEqual(receipt['moves'],[]);self.assertEqual(receipt['newGoogle'],cloud[0])

    def test_partial_upload_failure_preserves_durable_plan_and_move_history(self):
        root,cloud,public,transform,args=self.main_fixture({'assets/one.css':b'one','assets/two.css':b'two'})
        with patch.object(sys,'argv',args),patch.object(google,'run',return_value=SHA),patch.object(google,'module',side_effect=lambda n,p:public if n=='google_public_contract' else transform),patch.object(google,'page_snapshot',return_value=cloud),patch.object(google,'check_pending'),patch.object(google,'json_request',return_value={'generation':'2','md5Hash':'old'}),patch.object(google,'backup',side_effect=lambda name,*a:'backup/'+name),patch.object(google,'upload',side_effect=['3',RuntimeError('second upload failed')]):
            with self.assertRaisesRegex(RuntimeError,'second upload failed'):google.main()
        events=[json.loads(line) for line in (root/'receipt.journal.jsonl').read_text().splitlines()]
        self.assertEqual([e['stage'] for e in events],['planned','before-upload','uploaded','before-upload'])
        self.assertEqual(events[2]['oldGeneration'],'2');self.assertEqual(events[2]['newGeneration'],'3')
        self.assertEqual(events[-1]['backup'],'backup/wild/assets/two.css')
        self.assertFalse((root/'receipt.json').exists())


if __name__=='__main__':unittest.main()
