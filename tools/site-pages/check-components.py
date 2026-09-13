"""Check shared shell ownership, component structure and route-relative links.

The historic check.py targets copied static shells. This contract verifies the
runtime component architecture; rendered geometry is checked separately.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, unquote
import hashlib, json, re

ROOT = Path(__file__).resolve().parents[2]
ROUTES = ['index.html', 'non-profit/index.html', 'ai-mindset-consulting/index.html', 'oferta/index.html', 'confpolicy/index.html']
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

class Document(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.nodes, self.elements, self.stack = [], [], []
        self.feed(html)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.nodes.append((tag, attrs))
        index = len(self.elements)
        self.elements.append({'tag': tag, 'attrs': attrs, 'parent': self.stack[-1] if self.stack else None, 'text': ''})
        if tag not in VOID:
            self.stack.append(index)
    def handle_endtag(self, tag):
        for pos in range(len(self.stack) - 1, -1, -1):
            if self.elements[self.stack[pos]]['tag'] == tag:
                del self.stack[pos:]
                break
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)
    def handle_data(self, data):
        for index in self.stack:
            self.elements[index]['text'] += data
    def with_class(self, name):
        return [i for i, el in enumerate(self.elements) if name in el['attrs'].get('class', '').split()]
    def inside(self, index, ancestor):
        parent = self.elements[index]['parent']
        while parent is not None:
            if parent == ancestor:
                return True
            parent = self.elements[parent]['parent']
        return False

def normal(text):
    return re.sub(r'\s+', ' ', text).strip()

def check_page_shell_ownership(text, route):
    for el in Document(text).elements:
        if el['tag'] == 'style':
            css = re.sub(r'/\*.*?\*/', '', el['text'], flags=re.S)
            selectors = re.findall(r'([^{}]+)\{', css)
            assert not any(re.search(r'(?<![\w-])aim-site-(?:header|footer)(?![\w-])', selector) for selector in selectors), (route, 'page-local shell CSS override')
        if el['tag'] == 'script':
            assert not el['attrs'].get('id', '').startswith('home-footer-essence'), (route, 'page-local footer mutation')
            script = el['text']
            mutates = re.search(r'\.(?:after|before|append|appendChild|prepend|replaceWith|replaceChildren|insertBefore|insertAdjacentHTML|remove)\s*\(|\.(?:innerHTML|outerHTML)\s*=', script)
            assert not ('footer-essence' in script and mutates), (route, 'page-local footer mutation')

def check_footer(markup):
    doc = Document(markup)
    essence, columns = doc.with_class('footer-essence'), doc.with_class('cols')
    assert len(essence) == len(columns) == 1, 'one shared footer essence and navigation group required'
    essence, columns = essence[0], columns[0]
    assert doc.elements[essence]['parent'] == doc.elements[columns]['parent'] and essence > columns, 'footer essence must follow navigation columns as a separate sibling'
    children = [el for i, el in enumerate(doc.elements) if doc.inside(i, essence)]
    paragraphs = [el for el in children if el['tag'] == 'p']
    assert len(paragraphs) == 1 and not any(el['tag'] in ['ul', 'ol', 'li'] for el in children), 'footer essence must be one prose paragraph'
    assert normal(paragraphs[0]['text']) == 'давать людям опору в быстро меняющемся мире', 'footer essence copy changed'

def check_discounts(text):
    doc = Document(text)
    prices, groups = doc.with_class('price'), doc.with_class('price-discount')
    assert len(prices) == len(groups) == 3, 'three price-discount groups required'
    for price, expected in zip(prices, ['10%', '15%', '20%']):
        local_groups = [i for i in groups if doc.elements[i]['parent'] == price]
        assert len(local_groups) == 1, 'each price needs its own price-discount group'
        group = local_groups[0]
        amounts = [i for i in doc.with_class('discount') if doc.inside(i, price)]
        labels = [i for i in doc.with_class('note') if doc.inside(i, price)]
        assert len(amounts) == len(labels) == 1 and all(doc.elements[i]['parent'] == group for i in amounts + labels), 'discount percentage and label must stay together inside price-discount'
        assert normal(doc.elements[amounts[0]]['text']) == expected, 'discount percentage changed'
        assert normal(doc.elements[labels[0]]['text']) == 'скидка на всю команду', 'discount label changed'

def negative_fixtures(home, footer, consulting):
    """Recreate the old footer divergence and detached discount label in memory."""
    split_label, changed = re.subn(r'(<div class="price-discount">)(<p class="discount">[^<]+</p>)(<p class="note">.*?</p>)(</div>)', r'\1\2\4\3', consulting, count=1)
    assert changed == 1, 'discount negative fixture could not be constructed'
    nested_essence = '<footer><div class="wrap"><div class="cols"><div class="footer-essence"><p>давать людям опору в быстро меняющемся мире</p></div></div></div></footer>'
    fixtures = [
        ('homepage footer CSS', lambda: check_page_shell_ownership(home + '<style>@media(max-width:640px){aim-site-footer .site-footer{padding:32px}}</style>', 'fixture'), 'page-local shell CSS override'),
        ('homepage header CSS', lambda: check_page_shell_ownership(home + '<style>aim-site-header{--aim-shell-gutter:64px}</style>', 'fixture'), 'page-local shell CSS override'),
        ('homepage footer mutation', lambda: check_page_shell_ownership(home + '<script>const essence=document.querySelector(".footer-essence");document.querySelector(".cols").after(essence);</script>', 'fixture'), 'page-local footer mutation'),
        ('essence inside navigation', lambda: check_footer(nested_essence), 'footer essence must follow navigation columns'),
        ('essence list instead of paragraph', lambda: check_footer(re.sub(r'<p>(.*?)</p>', r'<ul><li>\1</li></ul>', footer, count=1)), 'footer essence must be one prose paragraph'),
        ('detached discount label', lambda: check_discounts(split_label), 'discount percentage and label must stay together'),
    ]
    passed = []
    for name, check, reason in fixtures:
        try:
            check()
        except AssertionError as error:
            assert reason in str(error), (name, 'unexpected fixture failure', str(error))
            passed.append(name)
        else:
            raise AssertionError((name, 'regression fixture was not rejected'))
    return passed

module = (ROOT/'assets/site/site-shell.js').read_text()
components = {name: json.loads(re.search(r'const '+name+r' = (".*");', module)[1]) for name in ['HEADER', 'FOOTER']}
check_footer(components['FOOTER'])
for name, markup in components.items():
    for tag, attrs in Document(markup).nodes:
        for key in ['href', 'src']:
            value = attrs.get(key)
            if not value or value.startswith(('#', 'https://', 'mailto:')):
                continue
            assert value.startswith('@@BASE@@'), (name, value, 'route must resolve from the component base')
            rel = value.removeprefix('@@BASE@@')
            parsed = urlsplit(rel)
            target = ROOT/unquote(parsed.path)
            assert target.is_file() or (target/'index.html').is_file(), value
            if parsed.fragment:
                document = target if target.is_file() else target/'index.html'
                assert any(a.get('id') == unquote(parsed.fragment) for t, a in Document(document.read_text()).nodes), value

asset_names = set()
link_count = 0
documents = {}
for route in ROUTES:
    text = documents[route] = (ROOT/route).read_text()
    doc = Document(text)
    check_page_shell_ownership(text, route)
    if route == 'ai-mindset-consulting/index.html':
        check_discounts(text)
    for tag in ['aim-site-header', 'aim-site-footer']:
        assert sum(t == tag for t, a in doc.nodes) == 1, (route, tag)
    assert not any(t in ['header', 'footer'] and ('site-header' in a.get('class','') or 'site-footer' in a.get('class','')) for t,a in doc.nodes), route
    scripts = [a for t,a in doc.nodes if t == 'script' and 'site-shell.js' in a.get('src','')]
    assert len(scripts) == 1 and 'defer' not in scripts[0] and 'async' not in scripts[0], route
    css = [a for t,a in doc.nodes if t == 'link' and 'site-shell.css' in a.get('href','')]
    assert len(css) == 1, route
    assert 'assets/site/shell.css' not in text, route
    for attrs, key in [(scripts[0],'src'), (css[0],'href')]:
        url = urlsplit(attrs[key]); asset = (ROOT/route).parent/unquote(url.path)
        assert asset.is_file(), str(asset)
        assert url.query == 'v='+hashlib.sha256(asset.read_bytes()).hexdigest()[:10], (route, attrs[key], 'stale asset')
        asset_names.add(asset.resolve())
    for tag, attrs in doc.nodes:
        href = attrs.get('href', '')
        if tag != 'a' or not href or urlsplit(href).scheme:
            continue
        target_url = urlsplit(urljoin('https://preview.invalid/'+route, href))
        target = ROOT/unquote(target_url.path.lstrip('/'))
        if target.is_dir(): target = target/'index.html'
        assert target.is_file(), (route, href, str(target))
        if target_url.fragment:
            fragment = unquote(target_url.fragment)
            ids = {a.get('id') for t,a in Document(target.read_text()).nodes}
            assert fragment in ids, (route, href, 'missing anchor')
        link_count += 1

assert len(asset_names) == 2, 'All pages must reference the same JS and CSS files'
assert '[data-editor-runtime="site-header"]' in module
assert 'data-editor-runtime=\\"site-footer\\"' in module
fixtures = negative_fixtures(documents['index.html'], components['FOOTER'], documents['ai-mindset-consulting/index.html'])
print(json.dumps({'pages': len(ROUTES), 'sharedAssets': len(asset_names), 'internalLinks': link_count, 'discountGroups': 3, 'negativeFixtures': fixtures, 'result': 'PASS'}))
