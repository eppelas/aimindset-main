"""Verify exported file integrity and local HTML/CSS dependencies at the Pages base."""
import argparse,hashlib,json,re
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin,urlsplit,unquote

parser=argparse.ArgumentParser();parser.add_argument('root',type=Path);args=parser.parse_args()
root=args.root.resolve();manifest=json.loads((root/'release-manifest.json').read_text())['files']
expected=set(manifest)|{'.nojekyll','release-manifest.json'}
actual={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()}
assert actual==expected,'Unexpected or missing exported files'
for name,record in manifest.items():
    path=root/name;assert not path.is_symlink(),name
    data=path.read_bytes();assert len(data)==record['bytes'] and hashlib.sha256(data).hexdigest()==record['sha256'],name
links=[]
class References(HTMLParser):
    def handle_starttag(self,tag,attrs):
        for key,value in attrs:
            if value and key in ('src','href','poster'):links.append(value)
missing=[];checked=0
for name in manifest:
    file=root/name
    if file.suffix not in ('.html','.css'):continue
    source=file.read_text();links=[]
    if file.suffix=='.html':References().feed(source)
    links.extend(m[1].strip(' \"\'') for m in re.finditer(r'url\(([^)]+)\)',source))
    for link in links:
        if not link or link.startswith('#'):continue
        url=urlsplit(urljoin('https://preview.invalid/wild/'+name,unescape(link)))
        if url.netloc!='preview.invalid' or url.scheme!='https':continue
        if not url.path.startswith('/wild/'):
            missing.append((name,link,'outside Wild base'));continue
        relative=unquote(url.path[len('/wild/'):]);target=root/relative
        if target.is_dir():target=target/'index.html'
        if not target.is_file():missing.append((name,link,'missing file'))
        checked+=1
assert not missing,json.dumps(missing,ensure_ascii=False)
print(json.dumps({'files':len(manifest),'localReferences':checked,'base':'/aimindset-main/wild/','result':'PASS'}))
