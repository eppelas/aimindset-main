"""Publish compiled Wild through its existing Google publisher, preserving pending text."""
import argparse,base64,hashlib,importlib.util,json,mimetypes,os,re,subprocess,sys,uuid
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from urllib.parse import quote

BUCKET='aimindset-v5-editable-20260721'
PROJECT='cr-ref-genmedia-20260529'
ORIGIN='https://aimindset-wild.web.app'
API='https://storage.googleapis.com'
SHA=re.compile('[a-f0-9]{40}')
def digest(data):return hashlib.sha256(data).hexdigest()
def stamp(html,rev,source):
    html=re.sub(r'<meta\b[^>]*name=["\']aim-source-commit["\'][^>]*>','',html)
    html,count=re.subn(r'(<html\b[^>]*\bdata-rev=["\'])\d+(["\'][^>]*>)',lambda m:m[1]+str(rev)+m[2],html,count=1)
    if not count:html=re.sub(r'<html\b', '<html data-rev="'+str(rev)+'"',html,count=1)
    assert '</head>' in html
    return html.replace('</head>','<meta name="aim-source-commit" content="'+source+'"></head>',1)
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def run(command,cwd):return subprocess.check_output(command,cwd=cwd,text=True,timeout=60).strip()
def request(url,method='GET',data=None,token=None,kind=None,missing=False):
    headers={'Cache-Control':'no-cache'}
    if token:headers.update({'Authorization':'Bearer '+token})
    if isinstance(data,dict):data=json.dumps(data).encode();kind='application/json'
    if kind:headers['Content-Type']=kind
    try:
        with urlopen(Request(url,data=data,method=method,headers=headers),timeout=45) as r:return r.read()
    except HTTPError as e:
        if missing and e.code==404:return None
        raise RuntimeError('Google request failed HTTP '+str(e.code)+' at '+url.split('?')[0]) from e
def json_request(*a,**kw):
    raw=request(*a,**kw);return json.loads(raw) if raw is not None else None
def snapshot():
    status_url=ORIGIN+'/__status?object=wild%2Findex.html'
    a=json_request(status_url);data=request(ORIGIN+'/?source-sync='+uuid.uuid4().hex);b=json_request(status_url)
    assert a['ok'] and a['object']=='wild/index.html'
    assert all(a[k]==b[k] for k in ('rev','sha','generation')),'Google changed during snapshot'
    assert digest(data)[:16]==a['sha'],'Google status/hash mismatch'
    return a,data
PAGES=module('google_editor_pages',Path(__file__).with_name('editor_pages.py')).PAGES

def load_bootstrap(path):
    entries=json.loads(Path(path).read_text()) if path else {}
    allowed={page['object'] for page in PAGES.values()}
    if not isinstance(entries,dict) or set(entries)-allowed:raise ValueError('Bootstrap contains an unknown editable object')
    for name,value in entries.items():
        if not isinstance(value,dict) or set(value)!={'sha256'} or not re.fullmatch('[a-f0-9]{64}',str(value['sha256'])):raise ValueError('Bootstrap needs one exact sha256 per object')
    return entries

def snapshot_gcs(page,token):
    name=page['object'];a=json_request(object_url(name),token=token)
    assert a.get('name')==name and str(a.get('generation','')).isdigit(),'GCS object identity mismatch'
    data=request(object_url(name)+'?alt=media&generation='+a['generation'],token=token)
    b=json_request(object_url(name),token=token)
    assert b.get('name')==name and b.get('generation')==a['generation'],'Google changed during snapshot'
    assert a.get('md5Hash')==base64.b64encode(hashlib.md5(data).digest()).decode(),'GCS snapshot content hash mismatch'
    rev=re.search(r'<html\b[^>]*\bdata-rev=["\'](\d+)["\']',data.decode())
    return {'ok':True,'object':name,'rev':int(rev[1]) if rev else 0,'sha':digest(data)[:16],'generation':a['generation']},data

def page_snapshot(page,token):
    return snapshot() if page['id']=='home' else snapshot_gcs(page,token)

def check_pending(root,cloud,current_source,bootstrap_rev=None,bootstrap_sha=None,*,page=None,bootstrap_pages=None):
    page=page or PAGES['home']
    if page['id']!='home':assert cloud[0].get('object')==page['object'],'Wrong editable namespace'
    html=cloud[1].decode();importer=module('google_import',root/'tools/release/import-google-save.py')
    metas=[n.attrs.get('content') for n in importer.walk(importer.Document(html).root) if n.tag=='meta' and n.attrs.get('name')=='aim-source-commit']
    if not metas:
        audited=(bootstrap_pages or {}).get(page['object'])
        if audited:
            assert digest(cloud[1])==audited['sha256'],'Bootstrap live bytes differ from audited object hash'
            return
        assert page['id']=='home','Nested bootstrap requires an audited object/full-hash map'
        assert cloud[0]['rev']==bootstrap_rev and cloud[0]['sha']==bootstrap_sha,'Google baseline lacks source provenance; initial publication needs an audited revision/hash'
        return
    assert len(metas)==1 and SHA.fullmatch(metas[0]),'Invalid Google source revision'
    base=metas[0]
    subprocess.run(['git','merge-base','--is-ancestor',base,current_source],cwd=root,check=True,timeout=30)
    def show(rel):return subprocess.check_output(['git','show',base+':'+rel],cwd=root,timeout=30).decode()
    current=json.loads((root/page['content']).read_text())
    section_args={} if page['section_key']=='home' else {'section_key':page['section_key']}
    _,section_report=importer.merge_section_labels(json.loads(show('src/site-sections.json')),json.loads((root/'src/site-sections.json').read_text()),show(page['output']),html,**section_args)
    if section_report['changedFields']:
        raise ValueError('Google has unimported local section labels; sync first: '+','.join(section_report['changedFields']))
    try:
        _,report=importer.merge(show(page['template']),show(page['output']),html,json.loads(show(page['content'])),current,section_labels_validated=True)
    except importer.ImportRejected as exc:
        audited=(bootstrap_pages or {}).get(page['object'])
        if audited and str(exc).startswith('Base HTML/content mismatch'):
            assert digest(cloud[1])==audited['sha256'],'Bootstrap live bytes differ from audited object hash'
            return
        raise
    if report['changedFields']:
        raise ValueError('Google has unimported text; sync it first: '+','.join(report['changedFields']))
def object_url(name):return API+'/storage/v1/b/'+BUCKET+'/o/'+quote(name,safe='')
def backup(name,metadata,source,token):
    destination='wild/release-backups/'+source+'/'+metadata['generation']+'/'+name.removeprefix('wild/')
    existing=json_request(object_url(destination),token=token,missing=True)
    if existing:
        assert existing.get('md5Hash')==metadata.get('md5Hash'),'Backup identity conflict'
        return destination
    endpoint=object_url(name)+'/rewriteTo/b/'+BUCKET+'/o/'+quote(destination,safe='')+'?ifSourceGenerationMatch='+metadata['generation']+'&ifGenerationMatch=0'
    response=json_request(endpoint,'POST',{},token)
    for _ in range(20):
        if response['done']:break
        response=json_request(endpoint+'&rewriteToken='+quote(response['rewriteToken'],safe=''),'POST',{},token)
    assert response['done'],'Backup rewrite did not complete'
    return destination
def upload(name,data,old,source,token):
    content_type=mimetypes.guess_type(name)[0] or 'application/octet-stream'
    if name.endswith('.html'):content_type='text/html; charset=utf-8'
    metadata={'name':name,'contentType':content_type,'cacheControl':'no-cache, max-age=0, must-revalidate','metadata':{'sourceCommit':source,'sha256':digest(data)}}
    boundary='aim'+uuid.uuid4().hex
    body=('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+json.dumps(metadata)+'\r\n--'+boundary+'\r\nContent-Type: '+content_type+'\r\n\r\n').encode()+data+('\r\n--'+boundary+'--\r\n').encode()
    url=API+'/upload/storage/v1/b/'+BUCKET+'/o?uploadType=multipart&ifGenerationMatch='+(old['generation'] if old else '0')
    result=json_request(url,'POST',body,token,'multipart/related; boundary='+boundary)
    assert result['md5Hash']==base64.b64encode(hashlib.md5(data).digest()).decode(),'Uploaded object hash mismatch'
    return result['generation']
def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]);ap.add_argument('--artifact',type=Path,required=True)
    ap.add_argument('--source-sha',required=True);ap.add_argument('--publish',action='store_true');ap.add_argument('--bootstrap-rev',type=int);ap.add_argument('--bootstrap-sha');ap.add_argument('--receipt',type=Path,required=True);ap.add_argument('--bootstrap-pages',type=Path,help='Audited {object: {sha256: full hash}} map for initial provenance-free pages')
    a=ap.parse_args();root=a.root.resolve();source=a.source_sha
    assert SHA.fullmatch(source) and run(['git','rev-parse','HEAD'],root)==source,'Source must be the exact checkout'
    journal_path=a.receipt.with_suffix('.journal.jsonl')
    assert not a.receipt.exists() and not journal_path.exists(),'Receipt/journal must be new files'
    def journal(event):
        with journal_path.open('a') as stream:
            stream.write(json.dumps(event)+'\n');stream.flush();os.fsync(stream.fileno())
    pub=module('google_public_contract',root/'tools/release/publish-artifact.py');pub.verified_artifact(a.artifact)
    manifest=json.loads((a.artifact/'release-manifest.json').read_text())
    assert manifest['sourceCommit']==source,'Public/Google source pair mismatch'
    transform=module('google_public_build',root/'tools/release/public_build.py')
    assert digest(transform.public_html((root/'index.html').read_text()).encode())==manifest['files']['index.html']['sha256'],'Index differs from verified artifact'
    editable_outputs={page['output'] for page in PAGES.values()}
    assert editable_outputs.issubset(manifest['files']),'Verified artifact lacks an editable page'
    desired={name:(root/name).read_bytes() for name in manifest['files'] if name not in editable_outputs}
    for name in manifest['files']:
        data=(root/name).read_bytes()
        if name.endswith('.html'):public=transform.public_html(data.decode()).encode()
        elif name.endswith(('.css','.js')):
            text=transform.public_text(data.decode());public=(transform.public_css(text) if name.endswith('.css') else text).encode()
        else:public=data
        assert digest(public)==manifest['files'][name]['sha256'],'Source differs from verified artifact: '+name
    token=os.environ.get('GOOGLE_ACCESS_TOKEN') or run(['gcloud','auth','print-access-token'],root)
    bootstrap_pages=load_bootstrap(a.bootstrap_pages)
    clouds={page_id:page_snapshot(page,token) for page_id,page in PAGES.items()}
    for page_id,page in PAGES.items():
        check_pending(root,clouds[page_id],source,a.bootstrap_rev,a.bootstrap_sha,page=page,bootstrap_pages=bootstrap_pages)
    targets={page_id:stamp((root/page['output']).read_text(),clouds[page_id][0]['rev'],source) for page_id,page in PAGES.items()}
    planned=[]
    with ThreadPoolExecutor(max_workers=6) as pool:
        existing=list(pool.map(lambda name:json_request(object_url('wild/'+name),token=token,missing=True),desired))
    for (name,data),old in zip(desired.items(),existing):
        if old and old.get('md5Hash')==base64.b64encode(hashlib.md5(data).digest()).decode():continue
        planned.append((name,data,old))
    receipt={'sourceCommit':source,'platformCommit':manifest['platformCommit'],'oldGoogle':clouds['home'][0],'oldGooglePages':{key:value[0] for key,value in clouds.items()},'mode':'publish' if a.publish else 'dry-run','changedFiles':[x[0] for x in planned],'moves':[]}
    with journal_path.open('x') as stream:
        stream.write(json.dumps({'stage':'planned',**receipt})+'\n');stream.flush();os.fsync(stream.fileno())
    if a.publish:
        needs_write=bool(planned) or any(targets[key].encode()!=clouds[key][1] for key in PAGES)
        identity_token=module('google_sync_identity',root/'tools/release/sync-status.py').oidc_token() if needs_write else None
        assert not needs_write or identity_token,'Authenticated workflow identity required before publication writes'
        for page_id,page in PAGES.items():
            now=page_snapshot(page,token);assert now[0]['generation']==clouds[page_id][0]['generation'],'Google changed before publishing: '+page_id
        for name,data,old in planned:
            object_name='wild/'+name
            saved=backup(object_name,old,source,token) if old else None
            journal({'stage':'before-upload','source':object_name,'backup':saved,'oldGeneration':old['generation'] if old else None,'sha256':digest(data)})
            generation=upload(object_name,data,old,source,token)
            receipt['moves'].append({'source':'gs://'+BUCKET+'/'+object_name,'backup':'gs://'+BUCKET+'/'+saved if saved else None,'oldGeneration':old['generation'] if old else None,'newGeneration':generation})
            journal({'stage':'uploaded',**receipt['moves'][-1]})
        receipt['newGooglePages']={}
        for page_id,page in PAGES.items():
            cloud=clouds[page_id];target_html=targets[page_id];object_name=page['object']
            if target_html.encode()==cloud[1]:
                receipt['newGooglePages'][page_id]=cloud[0]
                continue
            old=json_request(object_url(object_name),token=token)
            assert old.get('name',object_name)==object_name and old['generation']==cloud[0]['generation'],'Google changed while assets were publishing: '+page_id
            saved=backup(object_name,old,source,token)
            journal({'stage':'before-save','source':object_name,'backup':saved,'oldGoogle':cloud[0],'sha256':digest(target_html.encode())})
            payload={'html':target_html,'rev':cloud[0]['rev'],'generation':cloud[0]['generation'],'object':object_name}
            payload['publicationSource']=source
            result=json_request(ORIGIN+'/__save','POST',payload,token=identity_token)
            assert result['ok'],'Existing publisher rejected save'
            expected=stamp(target_html,result['rev'],source).encode()
            fresh=page_snapshot(page,token)
            assert fresh[0]['object']==object_name and fresh[0]['rev']==result['rev'] and fresh[0]['sha']==result['sha'],'Published page was not confirmed'
            assert digest(fresh[1])==digest(expected),'Published HTML differs from compiled source'
            receipt['moves'].append({'source':'gs://'+BUCKET+'/'+object_name,'backup':'gs://'+BUCKET+'/'+saved,'oldGeneration':old['generation'],'newGeneration':fresh[0]['generation']})
            receipt['newGooglePages'][page_id]=fresh[0]
            journal({'stage':'saved',**receipt['moves'][-1]})
        receipt['newGoogle']=receipt['newGooglePages']['home']
    with a.receipt.open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
    print(json.dumps({'source':source,'mode':receipt['mode'],'changedAssets':len(planned),'google':receipt.get('newGoogle'),'receipt':str(a.receipt)}))
if __name__=='__main__':main()
