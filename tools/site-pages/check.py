"""Structural content checks; rendered geometry is verified separately in-browser."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit,unquote
import json,re,importlib.util

ROOT=Path(__file__).resolve().parents[2]
VOID={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
class Node:
    def __init__(self,tag='',attrs=(),parent=None):
        self.tag,self.attrs,self.parent,self.children=tag,dict(attrs),parent,[]
    def text(self):return ''.join(c if isinstance(c,str) else c.text() for c in self.children)
    def all(self):
        yield self
        for c in self.children:
            if isinstance(c,Node):yield from c.all()
    def has(self,cls):return cls in self.attrs.get('class','').split()
class Tree(HTMLParser):
    def __init__(self,text):
        super().__init__(convert_charrefs=True);self.root=Node();self.current=self.root;self.feed(text)
    def handle_starttag(self,tag,attrs):
        assert len(attrs)==len(dict(attrs)),f'duplicate attribute: {tag}'
        n=Node(tag,attrs,self.current);self.current.children.append(n)
        if tag not in VOID:self.current=n
    def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs);self.handle_endtag(tag) if tag not in VOID else None
    def handle_endtag(self,tag):
        if tag in VOID:return
        assert self.current.tag==tag,f'unbalanced {self.current.tag}/{tag}'
        self.current=self.current.parent
    def handle_data(self,text):self.current.children.append(text)
def normal(text):return re.sub(r'\s+',' ',text).strip()
def fragment(text):return normal(Tree(text).root.text())

spec=importlib.util.spec_from_file_location('editor_pages',ROOT/'tools/release/editor_pages.py')
editor_pages=importlib.util.module_from_spec(spec);spec.loader.exec_module(editor_pages)
report={}
for page in ['non-profit','ai-mindset-consulting','oferta','confpolicy']:
    path=ROOT/page/'index.html'
    if page in editor_pages.PAGES:
        current=path.read_text()
        assert current.count('<aim-site-header ')==1 and current.count('<aim-site-footer ')==1,f'shared component mounts missing: {page}'
        assert f'<aim-site-header page="{page}"' in current
        expected=editor_pages.render_page(ROOT,page)
        main=lambda source:re.search(r'<main\b[^>]*>.*?</main>',source,re.S).group(0)
        assert main(path.read_text())==main(expected),f'generated author content differs from canonical source: {page}'
        report[page]='PASS: canonical template and text';continue
    tree=Tree(path.read_text());nodes=list(tree.root.all())
    assert tree.current is tree.root,'unclosed markup'
    assert sum(n.tag=='h1' for n in nodes)==1
    assert sum(n.has('site-header') or n.tag=='aim-site-header' for n in nodes)==1
    assert sum(n.has('site-footer') or n.tag=='aim-site-footer' for n in nodes)==1
    ids=[n.attrs['id'] for n in nodes if 'id' in n.attrs]
    assert len(ids)==len(set(ids)),f'duplicate id {page}'
    for n in nodes:
        for attr in ['src','href']:
            val=n.attrs.get(attr,'');u=urlsplit(val)
            if not val or u.scheme or u.netloc:continue
            dest=(path.parent/unquote(u.path)).resolve() if u.path else path
            if dest.is_dir():dest=dest/'index.html'
            assert dest.exists(),f'missing resource {page}/{val}'
            if u.fragment and dest==path:assert u.fragment in ids,f'missing fragment {val}'
        if n.tag=='li' and '↗' in n.text():
            assert any(c.tag=='a' and c.attrs.get('href') for c in n.all()),'decorative link arrow in list'
    if page in ['oferta','confpolicy']:
        original=json.loads((ROOT/'tools/site-pages/content'/f'{page}.json').read_text())
        for i,b in enumerate(original['blocks']):
            match=[n for n in nodes if n.attrs.get('data-source-block')==str(i)]
            assert len(match)==1,f'legal block {i} missing/duplicated'
            assert normal(match[0].text())==fragment(b.get('html') or b['text']),f'legal block {i} changed'
    if page=='ai-mindset-consulting':
        cases=json.loads((ROOT/'tools/site-pages/content/cases.json').read_text())['cards']
        cards=[n for n in nodes if n.has('case-card')]
        assert len(cards)==len(cases)==15
        for card,source in zip(cards,cases):
            assert card.attrs['data-case-id']==source['id']
            for value in [source['title'],source['description'],source['category'],*source['tags']]:
                assert normal(value) in normal(card.text()),f'missing case field {source["id"]}'
        videos=[n for n in nodes if n.has('video-card')]
        data=json.loads((ROOT/'tools/site-pages/content/videos.json').read_text())['videos']
        assert len(videos)==len(data)==3
        for node,source in zip(videos,data):
            assert node.attrs['href']==source['watch_url'] and node.attrs['target']=='_blank'
            assert 'noopener' in node.attrs['rel']
        assert all('▪' not in n.text() for n in nodes if n.tag=='p'),'inline pseudo-list bullets'
    if page=='non-profit':
        assert not any(n.has('page-tabs') for n in nodes)
        assert not any(n.has('breadcrumbs') for n in nodes)
        original=json.loads((ROOT/'tools/site-pages/content/non-profit.json').read_text())
        for i in [3,4]:
            match=[n for n in nodes if n.attrs.get('data-source-block')==str(i)]
            assert len(match)==1,f'non-profit source block {i} missing/duplicated'
            assert normal(match[0].text())==fragment(original['blocks'][i]['html']),f'non-profit source block {i} changed'
        assert sum(n.has('program-card') for n in nodes)==5
        assert sum(n.has('waitlist-open') for n in nodes)==4
        assert sum(n.attrs.get('id')=='waitlistDialog' for n in nodes)==1
    report[page]='PASS'

# Homepage source/runtime freshness is checked by tools/check-generated-source.py.
css=(ROOT/'assets/site/pages.css').read_text()
assert not re.search(r'\.rhythm-quote::before\s*\{[^}]*content:',css),'invented quote ornament'
assert not re.search(r'\.prose-list\s+li::before\s*\{[^}]*↗',css),'fake linked list markers'
report['homepage_scripts_and_styles']='verified separately by source-build --check and check-generated-source.py'
report['ux']='real list semantics; arrows link; original shell; no invented quote ornament'
print(json.dumps(report,ensure_ascii=False,indent=2))
