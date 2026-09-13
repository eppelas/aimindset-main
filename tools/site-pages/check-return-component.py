"""Keep return navigation owned by the shared source, across all five routes."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib,re,json
ROOT=Path(__file__).resolve().parents[2]
ROUTES=['index.html','ai-mindset-consulting/index.html','non-profit/index.html','oferta/index.html','confpolicy/index.html']
class Tags(HTMLParser):
 def __init__(self,text):
  super().__init__();self.tags=[];self.feed(text)
 def handle_starttag(self,tag,attrs):self.tags.append((tag,dict(attrs)))
def check(text,route):
 tags=Tags(text).tags
 for ext,tag,attr in [('css','link','href'),('js','script','src')]:
  filename='site-return.'+ext
  refs=[a[attr] for t,a in tags if t==tag and filename in a.get(attr,'')]
  assert len(refs)==1,(route,'one shared return asset',filename)
  path=(ROOT/route).parent/refs[0].split('?')[0]
  assert path.resolve()==(ROOT/'assets/site'/filename).resolve(),(route,'return asset path')
  expected=hashlib.sha256(path.read_bytes()).hexdigest()[:10]
  assert refs[0].endswith('?v='+expected),(route,'stale return asset')
 assert not any(a.get('id')=='backToTop' for t,a in tags),(route,'duplicate return markup')
 assert 'Return to the actual origin of an internal navigation' not in text,(route,'duplicate return controller')
 for style in re.findall(r'<style\b[^>]*>(.*?)</style>',text,re.S):
  style=re.sub(r'/\*.*?\*/','',style,flags=re.S)
  assert not re.search(r'back-to-top|backToTop',style),(route,'page-local return CSS')
pages={r:(ROOT/r).read_text() for r in ROUTES}
for route,text in pages.items():check(text,route)
home=pages['index.html'];fixtures=[
 ('missing asset',home.replace('site-return.js','missing-return.js')),
 ('duplicate markup',home+'<a id="backToTop"></a>'),
 ('duplicate controller',home+'<script>// Return to the actual origin of an internal navigation</script>'),
 ('page override',home+'<style>.back-to-top{background:pink}</style>')]
for name,text in fixtures:
 try:check(text,'index.html')
 except AssertionError:pass
 else:raise AssertionError('fixture not rejected: '+name)
print(json.dumps({'result':'PASS','routes':len(ROUTES),'sharedReturnAssets':2,'negativeFixtures':[name for name,_ in fixtures]}))
