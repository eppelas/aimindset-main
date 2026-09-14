"""Canonical editor page routes and entity-preserving text rendering."""
import html,json,re
from pathlib import Path
PAGES = {'home': {'id': 'home', 'object': 'wild/index.html', 'output': 'index.html', 'template': 'src/page/index.html', 'content': 'src/content/main.json', 'original': 'src/content/original-text.json', 'section_key': 'home'}, 'ai-mindset-consulting': {'id': 'ai-mindset-consulting', 'object': 'wild/ai-mindset-consulting/index.html', 'output': 'ai-mindset-consulting/index.html', 'template': 'src/pages/ai-mindset-consulting/index.html', 'content': 'src/content/pages/ai-mindset-consulting.json', 'original': 'src/content/pages/ai-mindset-consulting.original.json', 'section_key': 'ai-mindset-consulting'}, 'non-profit': {'id': 'non-profit', 'object': 'wild/non-profit/index.html', 'output': 'non-profit/index.html', 'template': 'src/pages/non-profit/index.html', 'content': 'src/content/pages/non-profit.json', 'original': 'src/content/pages/non-profit.original.json', 'section_key': 'non-profit'}}

def render_text(template, fields, original):
    ids=re.findall(r'\{\{text:([^}]+)\}\}',template)
    if set(ids)!=set(fields) or len(ids)!=len(set(ids)):
        raise ValueError('Text fields must match source template exactly')
    def value(match):
        key=match[1];text=fields[key]
        if not isinstance(text,str):raise ValueError('Text value must be string')
        raw=original.get(key)
        return raw if raw is not None and html.unescape(raw)==text else html.escape(text,quote=False)
    return re.sub(r'\{\{text:([^}]+)\}\}',value,template)

def render_page(root,page_id):
    page=PAGES[page_id];root=Path(root)
    return render_text((root/page['template']).read_text(),json.loads((root/page['content']).read_text())['fields'],json.loads((root/page['original']).read_text()))
