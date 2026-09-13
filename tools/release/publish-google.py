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
    html=re.sub(r'(<html\b[^>]*\bdata-rev=")\d+("[^>]*>)',lambda m:m[1]+str(rev)+m[2],html,count=1)
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
def check_pending(root,cloud,current_source,bootstrap_rev=None,bootstrap_sha=None):
    html=cloud[1].decode();importer=module('google_import',root/'tools/release/import-google-save.py')
    metas=[n.attrs.get('content') for n in importer.walk(importer.Document(html).root) if n.tag=='meta' and n.attrs.get('name')=='aim-source-commit']
    if not metas:
        assert cloud[0]['rev']==bootstrap_rev and cloud[0]['sha']==bootstrap_sha,'Google baseline lacks source provenance; initial publication needs an audited revision/hash'
        return
    assert len(metas)==1 and SHA.fullmatch(metas[0]),'Invalid Google source revision'
    base=metas[0]
    subprocess.run(['git','merge-base','--is-ancestor',base,current_source],cwd=root,check=True,timeout=30)
    def show(rel):return subprocess.check_output(['git','show',base+':'+rel],cwd=root,timeout=30).decode()
    current=json.loads((root/'src/content/main.json').read_text())
    _,report=importer.merge(show('src/page/index.html'),show('index.html'),html,json.loads(show('src/content/main.json')),current)
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
    ap.add_argument('--source-sha',required=True);ap.add_argument('--publish',action='store_true');ap.add_argument('--bootstrap-rev',type=int);ap.add_argument('--bootstrap-sha');ap.add_argument('--receipt',type=Path,required=True)
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
    cloud=snapshot();check_pending(root,cloud,source,a.bootstrap_rev,a.bootstrap_sha)
    target_html=stamp((root/'index.html').read_text(),cloud[0]['rev'],source)
    desired={name:(root/name).read_bytes() for name in manifest['files'] if name!='index.html'}
    transform=module('google_public_build',root/'tools/release/public_build.py')
    assert digest(transform.public_html((root/'index.html').read_text()).encode())==manifest['files']['index.html']['sha256'],'Index differs from verified artifact'
    for name,data in desired.items():
        if name.endswith('.html'):public=transform.public_html(data.decode()).encode()
        elif name.endswith(('.css','.js')):
            text=transform.public_text(data.decode());public=(transform.public_css(text) if name.endswith('.css') else text).encode()
        else:public=data
        assert digest(public)==manifest['files'][name]['sha256'],'Source differs from verified artifact: '+name
    token=os.environ.get('GOOGLE_ACCESS_TOKEN') or run(['gcloud','auth','print-access-token'],root)
    planned=[]
    with ThreadPoolExecutor(max_workers=6) as pool:
        existing=list(pool.map(lambda name:json_request(object_url('wild/'+name),token=token,missing=True),desired))
    for (name,data),old in zip(desired.items(),existing):
        if old and old.get('md5Hash')==base64.b64encode(hashlib.md5(data).digest()).decode():continue
        planned.append((name,data,old))
    receipt={'sourceCommit':source,'platformCommit':manifest['platformCommit'],'oldGoogle':cloud[0],'mode':'publish' if a.publish else 'dry-run','changedFiles':[x[0] for x in planned],'moves':[]}
    with journal_path.open('x') as stream:
        stream.write(json.dumps({'stage':'planned',**receipt})+'\n');stream.flush();os.fsync(stream.fileno())
    if a.publish:
        now=snapshot();assert now[0]['generation']==cloud[0]['generation'],'Google changed before publishing'
        for name,data,old in planned:
            object_name='wild/'+name
            saved=backup(object_name,old,source,token) if old else None
            journal({'stage':'before-upload','source':object_name,'backup':saved,'oldGeneration':old['generation'] if old else None,'sha256':digest(data)})
            generation=upload(object_name,data,old,source,token)
            receipt['moves'].append({'source':'gs://'+BUCKET+'/'+object_name,'backup':'gs://'+BUCKET+'/'+saved if saved else None,'oldGeneration':old['generation'] if old else None,'newGeneration':generation})
            journal({'stage':'uploaded',**receipt['moves'][-1]})
        if target_html.encode()!=cloud[1]:
            old=json_request(object_url('wild/index.html'),token=token)
            assert old['generation']==cloud[0]['generation'],'Google changed while assets were publishing'
            saved=backup('wild/index.html',old,source,token)
            journal({'stage':'before-save','source':'wild/index.html','backup':saved,'oldGoogle':cloud[0],'sha256':digest(target_html.encode())})
            result=json_request(ORIGIN+'/__save','POST',{'html':target_html,'rev':cloud[0]['rev'],'object':'wild/index.html'})
            assert result['ok'],'Existing publisher rejected save'
            expected=stamp(target_html,result['rev'],source).encode()
            # stamp adds the same metadata at the head end; avoid a second insertion newline.
            fresh=snapshot();assert fresh[0]['rev']==result['rev'] and fresh[0]['sha']==result['sha'],'Published page was not confirmed'
            assert digest(fresh[1])==digest(expected),'Published HTML differs from compiled source'
            receipt['moves'].append({'source':'gs://'+BUCKET+'/wild/index.html','backup':'gs://'+BUCKET+'/'+saved,'oldGeneration':old['generation'],'newGeneration':fresh[0]['generation']})
            receipt['newGoogle']=fresh[0]
            journal({'stage':'saved',**receipt['moves'][-1]})
        else:receipt['newGoogle']=cloud[0]
    with a.receipt.open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
    print(json.dumps({'source':source,'mode':receipt['mode'],'changedAssets':len(planned),'google':receipt.get('newGoogle'),'receipt':str(a.receipt)}))
if __name__=='__main__':main()
