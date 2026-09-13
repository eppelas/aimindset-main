"""Strict text-only three-way import of an existing Google editor save; no network or code import.

The caller must obtain base HTML, template and content from one trusted source revision.
The edited document must preserve one aim-source-commit meta matching that trusted revision.
Only --output writes a new JSON file; the source document is never overwritten.
"""
import argparse
from dataclasses import dataclass, field
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re

VOID = set('area base br col embed hr img input link meta param source track wbr'.split())
FIELD = re.compile(r'\{\{text:([^}]+)\}\}')
EXCLUDED_TAGS = {'head','script','style','svg','canvas','input','textarea','select','option','iframe','video','audio','aim-site-header','aim-site-footer','header','footer'}
EXCLUDED_IDS = {'learning','sectionRail','editBar','spaceScheduleBoard'}
CHROME_IDS = {'sectionRail','editBar','stretch-gauge','codex-browser-sidebar-comments-root','w19-proc'}


class ImportRejected(ValueError):
    pass


@dataclass(eq=False)
class Node:
    tag: str
    attrs: dict = field(default_factory=dict)
    children: list = field(default_factory=list)
    parent: object = None

    def text(self):
        return ''.join(c if isinstance(c,str) else c.text() for c in self.children)


def append(node, value):
    if isinstance(value,str) and node.children and isinstance(node.children[-1],str):
        node.children[-1] += value
    else:
        node.children.append(value)
        if isinstance(value,Node):value.parent=node


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root=Node('#document');self.stack=[self.root]
        self.feed(source);self.close()

    def handle_starttag(self, tag, attrs):
        if len(attrs)!=len(dict(attrs)):
            raise ImportRejected('Duplicate HTML attributes')
        n=Node(tag,dict(attrs));append(self.stack[-1],n)
        if tag not in VOID:self.stack.append(n)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag,attrs)
        if tag not in VOID:self.stack.pop()

    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==tag:
                del self.stack[i:];return

    def handle_data(self, data):
        append(self.stack[-1],data)


def walk(node):
    yield node
    for child in node.children:
        if isinstance(child,Node):yield from walk(child)


def classes(node):
    return set((node.attrs.get('class') or '').split())


def normalize(node):
    """Only the explicit runtime seams already removed by inline-editor.serialize()."""
    children=node.children;node.children=[]
    for child in children:
        if isinstance(child,str):
            append(node,child if node.tag in ('script','style') else child.replace('\u200b',''))
            continue
        ident=child.attrs.get('id','');cs=classes(child)
        if (child.tag=='meta' and child.attrs.get('name')=='aim-source-commit'):
            continue
        if (ident in CHROME_IDS or ident.startswith('codex-browser-') or 'data-editor-runtime' in child.attrs
            or 'data-editor-ui' in child.attrs or 'edit-bar' in cs or 'w19-fx' in cs
            or (child.tag=='canvas' and node.tag=='body')
            or child.tag.startswith(('grammarly-','lastpass-','com-1password-'))
            or 'data-grammarly-shadow-root' in child.attrs or 'data-lastpass-icon-root' in child.attrs):
            continue
        if child.tag=='p' and 'team-activity' in cs:
            child.children=[child.attrs.get('aria-label') or child.text()]
        if ident=='spaceScheduleBoard':child.children=[]
        normalize(child)
        # The existing morph engine fills these author-empty decorative hosts
        # with its SVG. Ignore only that known geometry, never executable nodes.
        if 'program-card__morph' in cs and child.attrs.get('aria-hidden')=='true':
            geometry={'svg','defs','pattern','path','filter','fegaussianblur','femerge','femergenode','rect'}
            def morph_part(part):
                if isinstance(part,str):return not part.strip()
                if part.tag!='svg' or not any(c.startswith('morph-svg--') for c in classes(part)):return False
                return all(n.tag in geometry and not any(k.startswith('on') or k in ('href','xlink:href','src') for k in n.attrs) and all(not isinstance(c,str) or not c.strip() for c in n.children) for n in walk(part))
            if all(morph_part(c) for c in child.children):child.children=[]
        if child.tag=='span' and ('hang' in cs or 'w19-lbl' in cs):
            for part in child.children:append(node,part)
        else:append(node,child)
    # serialize trims only terminal NBSP; it does not collapse internal spaces/newlines.
    if node.children and isinstance(node.children[-1],str) and node.tag not in ('script','style'):
        node.children[-1]=node.children[-1].rstrip('\u00a0')


def parse(source):
    root=Document(source).root;normalize(root)
    ids={}
    for n in walk(root):
        ident=n.attrs.get('id')
        if ident:
            if ident in ids:raise ImportRejected('Ambiguous duplicate id: '+ident)
            ids[ident]=n
    bodies=[n for n in walk(root) if n.tag=='body']
    if len(bodies)==1:ids['$body']=bodies[0]
    return root,ids


def eligible(node):
    in_body=False
    while node:
        if node.tag in EXCLUDED_TAGS or node.attrs.get('id') in EXCLUDED_IDS:return False
        if node.tag=='body':in_body=True
        node=node.parent
    return in_body


def address(node):
    steps=[]
    while node.parent is not None:
        if node.attrs.get('id'):return (node.attrs['id'],tuple(reversed(steps)))
        if node.tag=='body':return ('$body',tuple(reversed(steps)))
        siblings=[c for c in node.parent.children if isinstance(c,Node) and c.tag==node.tag]
        steps.append((node.tag,siblings.index(node)))
        node=node.parent
    raise ImportRejected('Editable source field lacks a stable ancestor id')


def resolve(ids, loc):
    ident,steps=loc
    if ident not in ids:raise ImportRejected('Missing stable anchor: '+ident)
    node=ids[ident]
    for tag,index in steps:
        siblings=[c for c in node.children if isinstance(c,Node) and c.tag==tag]
        if index>=len(siblings):raise ImportRejected('Unresolved element path below '+ident)
        node=siblings[index]
    return node


def text_slots(node):
    return [c for c in node.children if isinstance(c,str)]


def mappings(template, base_html, base_fields):
    tree,_=parse(template);base,ids=parse(base_html);mapped={};by_node={}
    for node in walk(tree):
        if not eligible(node):continue
        for slot,text in enumerate(text_slots(node)):
            matches=list(FIELD.finditer(text))
            if not matches:continue
            if len(matches)!=1:raise ImportRejected('Multiple fields occupy one direct-text slot')
            m=matches[0];key=m[1]
            if key not in base_fields or key in mapped:raise ImportRejected('Unknown or duplicate field '+key)
            loc=address(node);target=resolve(ids,loc);values=text_slots(target)
            if target.tag!=node.tag or slot>=len(values):raise ImportRejected('Unresolved text slot '+key)
            prefix,suffix=text[:m.start()],text[m.end():]
            expected=prefix+base_fields[key]+suffix
            # Same terminal-NBSP normalization as serialize().
            if slot==len(text_slots(node))-1 and node.children and isinstance(node.children[-1],str):expected=expected.rstrip('\u00a0')
            if values[slot]!=expected:raise ImportRejected('Base HTML/content mismatch for '+key)
            if (target,slot) in by_node:raise ImportRejected('Ambiguous field location '+key)
            mapped[key]=(target,slot,prefix,suffix);by_node[target,slot]=key
    if not mapped:raise ImportRejected('No editable fields mapped')
    return base,mapped,by_node


def merge(template, base_html, edited_html, base_content, current_content):
    for name,content in [('base',base_content),('current',current_content)]:
        if not isinstance(content,dict) or not isinstance(content.get('fields'),dict) or not all(isinstance(v,str) for v in content['fields'].values()):
            raise ImportRejected('Invalid '+name+' content')
    base_fields=base_content['fields'];current=current_content['fields']
    if set(base_fields)!=set(current):raise ImportRejected('Content field set changed since the Google base')
    base,mapped,by_node=mappings(template,base_html,base_fields)
    edited,_=parse(edited_html);incoming={}
    def label(node):
        fields=[key for (parent,_),key in by_node.items() if parent is node]
        return node.tag+'#'+node.attrs.get('id','')+(' ['+', '.join(fields)+']' if fields else '')
    def changed_text(a,slot,y):
        key=by_node.get((a,slot))
        if key is None:
            raise ImportRejected('Changed unmapped/protected text at '+label(a))
        _,_,prefix,suffix=mapped[key]
        if not y.startswith(prefix) or (suffix and not y.endswith(suffix)):
            raise ImportRejected('Changed text outside field boundaries '+key)
        value=y[len(prefix):len(y)-len(suffix) if suffix else None]
        if len(value)>20000:raise ImportRejected('Oversized text field '+key)
        incoming[key]=value
    def compare(a,b):
        if a.tag!=b.tag:raise ImportRejected('Changed DOM element structure at '+a.tag)
        # No URL, executable attribute, identifier, or form-target changes are imported.
        def semantic(n):
            return {k:v for k,v in n.attrs.items() if k in ('id','href','src','srcset','action','formaction','type','name') or k.startswith('on')}
        if semantic(a)!=semantic(b):raise ImportRejected('Changed protected/link attributes at '+a.tag)
        # Browser Enter is serialized as <br>; only a single, whole leaf field
        # can consume those line breaks without crossing another source field.
        if len(a.children)==1 and isinstance(a.children[0],str) and (a,0) in by_node and any(isinstance(c,Node) for c in b.children):
            if all(isinstance(c,str) or (c.tag=='br' and not c.attrs and not c.children) for c in b.children):
                changed_text(a,0,''.join(c if isinstance(c,str) else '\n' for c in b.children));return
        if len(a.children)!=len(b.children):raise ImportRejected('Changed DOM child/text structure at '+label(a))
        slot=0
        for x,y in zip(a.children,b.children):
            if isinstance(x,Node) and isinstance(y,Node):compare(x,y)
            elif isinstance(x,str) and isinstance(y,str):
                if x!=y:
                    key=by_node.get((a,slot))
                    if key is None:
                        # Formatting-only browser serialization whitespace has no content meaning.
                        if x.strip() or y.strip():raise ImportRejected('Changed unmapped/protected text at '+label(a))
                    else:changed_text(a,slot,y)
                slot+=1
            else:raise ImportRejected('Changed DOM text/element structure at '+a.tag)
    compare(base,edited)
    changes={};conflicts=[]
    for key,value in incoming.items():
        if value==base_fields[key] or value==current[key]:continue
        if current[key]!=base_fields[key]:conflicts.append(key)
        else:changes[key]=value
    if conflicts:raise ImportRejected('Concurrent text conflict: '+', '.join(sorted(conflicts)))
    result={**current_content,'fields':{**current,**changes}}
    return result,{'mappedFields':len(mapped),'excludedFields':sorted(set(base_fields)-set(mapped)),'changedFields':sorted(changes),'changes':{k:{'before':current[k],'after':v} for k,v in changes.items()}}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-template',type=Path,required=True)
    parser.add_argument('--base-html',type=Path,required=True)
    parser.add_argument('--edited-html',type=Path,required=True)
    parser.add_argument('--base-content',type=Path,required=True)
    parser.add_argument('--current-content',type=Path,required=True)
    parser.add_argument('--base-source',required=True)
    parser.add_argument('--report',type=Path,help='New JSON report file')
    parser.add_argument('--output',type=Path,help='New content JSON file; omit for a read-only validation/plan')
    args=parser.parse_args()
    if not re.fullmatch('[0-9a-f]{40}',args.base_source):parser.error('Exact base source SHA required')
    data=args.base_html.read_bytes()
    meta=[n.attrs.get('content') for n in walk(Document(args.edited_html.read_text()).root) if n.tag=='meta' and n.attrs.get('name')=='aim-source-commit']
    if meta != [args.base_source]:parser.error('Edited HTML requires one matching aim-source-commit meta')
    result,report=merge(args.base_template.read_text(),data.decode('utf-8'),args.edited_html.read_text(),json.loads(args.base_content.read_text()),json.loads(args.current_content.read_text()))
    report['baseSourceSha']=args.base_source;report['baseHtmlSha256']=hashlib.sha256(data).hexdigest()
    destinations=[p for p in (args.output,args.report) if p is not None]
    if len({p.resolve() for p in destinations})!=len(destinations) or any(p.exists() for p in destinations):
        parser.error('Output and report must be distinct new files')
    if args.output:
        with args.output.open('x',encoding='utf-8',newline='\n') as out:out.write(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    if args.report:
        with args.report.open('x',encoding='utf-8',newline='\n') as out:out.write(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__=='__main__':main()
