"""Build public artifacts from the assembled source; never publish repository files."""
from html.parser import HTMLParser
from pathlib import Path
import argparse, hashlib, json, re, shutil, uuid

VOID = set('area base br col embed hr img input link meta param source track wbr'.split())
class Spans(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source=source; self.lines=[0]; self.stack=[]; self.nodes=[]
        for m in re.finditer('\n',source): self.lines.append(m.end())
        self.feed(source)
    def position(self):
        line,col=self.getpos(); return self.lines[line-1]+col
    def handle_starttag(self, tag, attrs):
        n={'tag':tag,'attrs':dict(attrs),'start':self.position(),'open_end':self.position()+len(self.get_starttag_text())}
        self.nodes.append(n)
        if tag in VOID: n['end']=n['open_end']
        else:self.stack.append(n)
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i]['tag']==tag:
                self.stack[i]['end']=self.source.index('>',self.position())+1
                self.stack=self.stack[:i];break
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag,attrs)
        if tag not in VOID:self.stack.pop()['end']=self.position()+len(self.get_starttag_text())

def replace_once(source, old, new=''):
    if source.count(old) != 1:
        raise ValueError('Public map source contract changed: ' + old[:70])
    return source.replace(old, new, 1)


def public_map(source):
    """Remove the known editor seam, retaining the approved map interaction code."""
    if 'id="mapRuntime"' not in source:
        return source
    start = source.index('      function readEditableText(el){')
    end = source.index('      function branchClass(node)', start)
    source = source[:start] + source[end:]
    start = source.index("      nodesHost.addEventListener('input',event=>{")
    end = source.index('      renderNodes();drawEdges();', start)
    source = source[:start] + source[end:]
    for line in (
        "      const sourceById = new Map(sourceNodes.map(node => [node.id,node]));",
        "      const MAP_OBJECT = 'wild/ecosystem-mindmap.html';",
        "      const EDIT_API = location.origin;",
        "      let editEnabled = false;", "      let copyDirty = false;", "      let savingCopy = false;",
        "        if(editEnabled&&event.target.closest('[data-map-editable]')){event.stopPropagation();return}",
        "        if(editEnabled&&event.target.closest('.node-action')){event.preventDefault();event.stopPropagation();return}",
        "        if(editEnabled&&event.target.closest?.('[data-map-editable]'))return;",
        "            if(interaction.persist&&source){source.x=node.x;source.y=node.y}",
        "            if(interaction.persist){copyDirty=true;parent.postMessage({type:'aim-map:dirty'},'*')}",
        "      parent.postMessage({type:'aim-map:ready',rev:Number(document.documentElement.dataset.rev||1)},'*');",
    ):
        source = replace_once(source, line)
    source = replace_once(source, ',persist:editEnabled', '')
    source = replace_once(source, 'const node=interaction.node,source=sourceById.get(node.id);', 'const node=interaction.node;')
    source = source.replace(' data-map-editable', '')
    source = re.sub(r' data-map-field="[^"]*"', '', source)
    return source


EDITOR_SELECTOR = re.compile(r'editing|edit-bar|data-editable|data-map-editable|section-drag-handle|section-rail-hint|section-rail-item\.is-drop|section-rail-item\.is-dragging|#editBar|data-editor-control|product-block-drag-handle|#sectionRail')


def public_css(source):
    """Filter editor-only CSS rules; retain each other selector and declaration."""
    result=[]; cursor=0; start=0; quote=None; comment=False; depth=0; opening=None
    while cursor < len(source):
        char=source[cursor]
        if comment:
            if source[cursor:cursor+2]=='*/': comment=False;cursor+=2;continue
        elif quote:
            if char=='\\': cursor+=2;continue
            if char==quote: quote=None
        elif source[cursor:cursor+2]=='/*': comment=True;cursor+=2;continue
        elif char in ('"', "'"): quote=char
        elif char=='{':
            if depth==0: opening=cursor
            depth+=1
        elif char=='}':
            depth-=1
            if depth==0:
                prelude=source[start:opening]; body=source[opening+1:cursor]
                clean=re.sub(r'/\*.*?\*/', '', prelude, flags=re.S).strip()
                if clean.startswith(('@media','@supports','@layer','@container')):
                    result.append(prelude+'{'+public_css(body)+'}')
                elif not clean.startswith('@'):
                    selectors=[x for x in prelude.split(',') if not EDITOR_SELECTOR.search(re.sub(r'/\*.*?\*/', '', x, flags=re.S))]
                    if selectors: result.append(','.join(selectors)+'{'+body+'}')
                else: result.append(prelude+'{'+body+'}')
                start=cursor+1
        cursor+=1
    if depth or quote or comment: raise ValueError('Unbalanced CSS in public transform')
    result.append(source[start:])
    return ''.join(result)


def public_text(source):
    # Runtime identity markers remain necessary for shell deduplication, not editing.
    source=source.replace('data-editor-runtime','data-site-runtime').replace('data-editor-ui','data-site-ui')
    source=source.replace('.dataset.editorRuntime', '.dataset.siteRuntime').replace('.dataset.editorUi', '.dataset.siteUi')
    source=re.sub(r'\sdata-(?:rev|editable|editor-[\w-]+)=(?:"[^"]*"|\'[^\']*\')', '', source)
    source=re.sub(r'\scontenteditable(?:=(?:"[^"]*"|\'[^\']*\'))?', '', source)
    # Public animations no longer need to settle before an editor click.
    source=re.sub(r'  document.addEventListener\("click", (?:e|event) => \{\s*if \([^\n]*#editToggle[^\n]*\n  \}, true\);', '', source)
    source=source.replace('!document.body.classList.contains("editing")', 'true')
    source=source.replace(',[contenteditable]', '').replace('.edit-bar,textarea', 'textarea')
    source=re.sub(r'  function settleForEditor\(\) \{.*?    drawDots\(1\);\n  \}', '', source, flags=re.S)
    source=re.sub(r'\sdata-site-ui=(?:\\"[^"]*\\"|"[^"]*"|\'[^\']*\')', '', source)
    source=re.sub(r'\b[\w.]+\.setAttribute\(["\']data-site-ui["\'],\s*["\']["\']\);?', '', source)
    source=re.sub(r'--edit-outline:[^;]+;', '', source)
    return source


def assert_public(source):
    for pattern in [r'<meta\b[^>]*name=["\']aim-edit-', r'edit(?:Bar|Toggle|Save|Duplicate)',
                    r'/__(?:save|duplicate|status)', r'contenteditable', r'data-editor-',
                    r'aim-map:(?:state|save|dirty)', r'editEnabled', r'body\.editing', r'\.edit-bar']:
        if re.search(pattern,source): raise ValueError('Editor leaked into public output: '+pattern)


def public_html(source):
    source=public_map(source)
    parser=Spans(source); cuts=[]
    for n in parser.nodes:
        attrs=n['attrs']; body=source[n['open_end']:n.get('end',n['open_end'])]
        editor_script=n['tag']=='script' and ('const toggle = document.getElementById("editToggle")' in body or 'ЛОКАЛЬНАЯ ПЕРЕСТАНОВКА ПРОДУКТОВ' in body)
        if attrs.get('id') in ('editBar','sectionRail','aim-section-labels') or (n['tag']=='meta' and attrs.get('name','').startswith('aim-edit-')) or editor_script:
            assert 'end' in n,'Unclosed editor element'
            cuts.append((n['start'],n['end'],''))
        elif n['tag']=='style':
            closing=source.rfind('</style',n['open_end'],n['end'])
            cuts.append((n['open_end'],closing,public_css(source[n['open_end']:closing])))
    # Outer removals subsume child edits; never apply overlapping offsets twice.
    kept=[]
    for a,b,replacement in sorted(cuts):
        if kept and a < kept[-1][1]: continue
        kept.append((a,b,replacement))
    for a,b,replacement in reversed(kept): source=source[:a]+replacement+source[b:]
    source=public_text(source)
    source=source.replace('data-events-api="/__events"', 'data-events-api="https://aimindset-wild.web.app/__events"')
    source=re.sub(r'<!--.*?-->', '', source, flags=re.S)
    assert_public(source)
    return source

def build(root,out,source_sha=None,platform_sha=None):
    assert out.resolve()!=root.resolve()
    out.mkdir(parents=True,exist_ok=True)
    paths=['index.html','non-profit/index.html','ai-mindset-consulting/index.html','oferta/index.html','confpolicy/index.html','ecosystem-mindmap.html','ecosystem-grid-legacy.html']
    extensions={'.css','.js','.png','.jpg','.jpeg','.webp','.gif','.svg','.woff','.woff2','.ttf','.otf','.mp4','.webm','.ico'}
    paths += [str(p.relative_to(root)) for prefix in ('assets','_astro') for p in (root/prefix).rglob('*') if p.is_file() and not p.is_symlink() and p.suffix.lower() in extensions]
    # The iframe entry is a runtime dependency, not a source document.
    paths.append('assets/site/learning-frame.html')
    paths.append('assets/site/fonts/Unbounded-OFL.txt')
    manifest={}
    for rel in sorted(set(paths)):
        source=root/rel
        if not source.is_file():raise ValueError('Missing public dependency '+rel)
        data=source.read_bytes()
        if source.suffix=='.html':data=public_html(data.decode()).encode()
        elif source.suffix in ('.js','.css'):
            text=public_text(data.decode())
            if source.suffix=='.css':text=public_css(text)
            assert_public(text)
            data=text.encode()
        dest=out/rel;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
        manifest[rel]={'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
    (out/'.nojekyll').write_text('')
    (out/'release-manifest.json').write_text(json.dumps({'sourceCommit':source_sha,'platformCommit':platform_sha,'files':manifest},indent=2)+'\n')
    expected=set(manifest)|{'.nojekyll','release-manifest.json'}
    stale=[p for p in out.rglob('*') if (p.is_file() or p.is_symlink()) and str(p.relative_to(out)) not in expected]
    if stale:
        archive=out.parent/(out.name+'-retired-'+uuid.uuid4().hex[:8])
        moves=[]
        for old in stale:
            dest=archive/old.relative_to(out);dest.parent.mkdir(parents=True,exist_ok=True)
            shutil.move(old,dest)
            moves.append({'source':str(old),'destination':str(dest),'rollback':'move destination back to source'})
        (archive/'src-dst-log.json').write_text(json.dumps(moves,indent=2)+'\n')
    print(json.dumps({'publicFiles':len(manifest),'bytes':sum(x['bytes'] for x in manifest.values()),'output':str(out)}))
    return manifest
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]);ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--source-sha');ap.add_argument('--platform-sha')
    a=ap.parse_args();build(a.root,a.output,a.source_sha,a.platform_sha)
