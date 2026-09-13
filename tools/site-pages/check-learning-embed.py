"""Contract: the NGO catalogue is a live consumer of the homepage, never a copy."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib, json, re
ROOT=Path(__file__).resolve().parents[2]

class Tags(HTMLParser):
    def __init__(self,text):
        super().__init__();self.nodes=[];self.feed(text)
    def handle_starttag(self,tag,attrs):self.nodes.append((tag,dict(attrs)))

def contract(home,ngo):
    source=Tags(home).nodes;consumer=Tags(ngo).nodes
    exports=[a for tag,a in source if tag=='script' and 'data-learning-runtime' in a]
    assert sorted(a['data-learning-runtime'] for a in exports)==['motion','responsive','waitlist'],'missing or duplicate source runtime'
    assert not any('src' in a for a in exports),'exported source runtimes must be inline'
    ids=[a.get('id') for tag,a in source]
    for id in ['learning','waitlistDialog','waitlistForm','waitlistTopic','waitlistCode','waitlistTelegram','waitlistName','waitlistStatus','waitlistSubmit','waitlistClose']:
        assert ids.count(id)==1,('missing or duplicate source node',id)
    frames=[a for tag,a in consumer if tag=='iframe' and 'learning-frame.html' in a.get('data-src','')]
    assert len(frames)==1,'exactly one live catalogue frame'
    assert frames[0].get('title')=='Лаборатории AI Mindset'
    assert not any('program-card' in a.get('class','').split() for tag,a in consumer),'copied programme cards on NGO'
    assert not any(a.get('id')=='waitlistDialog' for tag,a in consumer),'copied waitlist form on NGO'
    assert 'catalogue.css' not in ngo and 'assets/site/waitlist.js' not in ngo,'copied catalogue runtime on NGO'

home=(ROOT/'index.html').read_text();ngo=(ROOT/'non-profit/index.html').read_text()
contract(home,ngo)
for filename in ['learning-embed.js','learning-embed.css','learning-frame.html']:
    assert filename+'?v='+hashlib.sha256((ROOT/'assets/site'/filename).read_bytes()).hexdigest()[:10] in ngo,('stale asset',filename)
frame=(ROOT/'assets/site/learning-frame.html').read_text()
assert 'learning-frame.js?v='+hashlib.sha256((ROOT/'assets/site/learning-frame.js').read_bytes()).hexdigest()[:10] in frame
fixtures=[('missing waitlist export',home.replace('data-learning-runtime="waitlist"',''),ngo),('missing source form',home.replace('id="waitlistForm"',''),ngo),('copied programme',home,ngo+'<article class="program-card"></article>'),('copied form',home,ngo+'<dialog id="waitlistDialog"></dialog>')]
for name,h,n in fixtures:
    try:contract(h,n)
    except AssertionError:pass
    else:raise AssertionError(('fixture escaped',name))
print(json.dumps({'result':'PASS','source':'index.html#learning','consumer':'non-profit/index.html','sourceRuntimes':3,'negativeFixtures':[f[0] for f in fixtures]}))
