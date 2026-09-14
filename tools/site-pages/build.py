"""Build four static pages from preserved source blocks and a single site shell.

The optional homepage sync changes only the shared header/footer and their links.
Every changed file is backed up before writing; identical output is not rewritten.
"""
from pathlib import Path
from html import escape, unescape
import re, json, hashlib, datetime, sys

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent
if any((ROOT/'src/pages'/page/'index.html').exists() for page in ['ai-mindset-consulting','non-profit']):
    raise SystemExit('Marketing pages migrated to src/pages and src/content/pages. Use tools/source-build.py; historical generator cannot overwrite current text.')
STAMP=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S-%f')
LOG=[]
SOURCE={name:json.loads((HERE/'content'/f'{name}.json').read_text()) for name in ['non-profit','ai-mindset-consulting','oferta','confpolicy']}
def preserve_write(path,text):
    if path.suffix=='.html':
        def asset_version(m):
            asset=ROOT/'assets/site'/m[2]
            return m[1]+'?v='+hashlib.sha256(asset.read_bytes()).hexdigest()[:10] if asset.exists() else m[0]
        text=re.sub(r'(assets/site/([\w.-]+\.(?:css|js|png|html)))(?:\?v=[\w-]+)?',asset_version,text)
    old=path.read_text() if path.exists() else None
    if old==text:return
    entry={'dst':str(path.relative_to(ROOT)),'operation':'create' if old is None else 'patch'}
    if old is not None:
        backup=ROOT/'backups'/f'site-pages-{STAMP}'/path.relative_to(ROOT)
        backup.parent.mkdir(parents=True,exist_ok=True)
        with backup.open('x') as f:f.write(old)
        entry.update(src=str(path.relative_to(ROOT)),rollback=str(backup.relative_to(ROOT)))
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(text)
    LOG.append(entry)

def nbsp(text):
    # Bind short Russian function words only in text nodes, never in hrefs/URLs.
    parts=re.split(r'(<[^>]+>)',text)
    for i in range(0,len(parts),2):
        parts[i]=re.sub(r'(?<![\w/])([ВвКкСсУуОоАаИиЯя]|[Нн]а|[Пп]о|[Ии]з|[Нн]е|[Дд]о|[Зз]а|[Оо]т|[Оо]б|[Сс]о|[Вв]о|[Нн]о|[Тт]о|[Лл]и|[Жж]е|[Бб]ы) +(?=\S)',lambda m:m[1]+'\u00a0',parts[i])
    return ''.join(parts)

def shell(which,route):
    base='' if route=='home' else '../'
    s=(HERE/f'{which}.html').read_text().replace('@@BASE@@',base).replace('@@PAGE@@',route)
    s=s.replace(f'data-page="{route}"',f'data-page="{route}" aria-current="page"')
    return nbsp(s)

def inline(page,index):
    b=SOURCE[page]['blocks'][index]
    value=b.get('html') or escape(b.get('text',''))
    value=re.sub(r'(^|>)(\s*)#\s*',r'\1\2',value) if b['type']=='heading' else value
    value=value.replace('href="/"','href="../index.html#learning"')
    if page=='ai-mindset-consulting':
        value=value.replace('href="/ai-mindset-consulting"','href="https://t.me/alex_named"')
    return value

def block(page,index,tag=None,cls=''):
    b=SOURCE[page]['blocks'][index];kind=b['type']
    attr=f' data-source-block="{index}"'+(f' class="{cls}"' if cls else '')
    if kind=='list':
        t='ol' if b.get('ordered') else 'ul'
        return f'<{t}{attr}>'+''.join(f'<li>{x["html"]}</li>' for x in b['items'])+f'</{t}>'
    if kind=='quote':return f'<blockquote{attr} class="rhythm-quote"><p>{inline(page,index)}</p></blockquote>'
    if kind=='image':
        name={6:"team-operating-system.png",22:"team-lab-support.png",48:"team-synergy.png",51:"team-ai-workflow.png"}[index]
        width,height={6:(928,1213),22:(941,640),48:(1536,559),51:(928,1232)}[index]
        return f'<img{attr} width="{width}" height="{height}" class="source-image" src="../assets/site/source-images/{name}" alt="{escape({6:"Архитектурная композиция из светлых бетонных блоков",22:"Две металлические головы с оранжевыми полосами на уровне глаз",48:"Люди вокруг круглого пространства с бирюзовыми линиями связей",51:"Коллаж из архитектурных чертежей, фотографий и жёлтых акцентов"}[index])}" loading="lazy">'
    t=tag or ('h3' if kind=='heading' else 'p')
    return f'<{t}{attr}>{inline(page,index)}</{t}>'

def section(id,n,label,title,content):
    return f'<section id="{id}" class="page-section"><div class="section-side"><p class="num">{n:02} · {label}</p></div><div class="section-body"><h2>{title}</h2>{content}</div></section>'

def cta(href,label,kind='btn'):
    match=re.search(r'\s*([→↗↓])$',label)
    text=label[:match.start()] if match else label
    arrow=(match[1] if match else '↗') if kind=='product-cta' else ''
    icon=f'<span class="go-arrow" aria-hidden="true">{arrow}</span>' if arrow else ''
    return f'<a class="{kind}" href="{href}"><span>{text}</span>{icon}</a>'

def tabs(items):
    return '<nav class="page-tabs" aria-label="Разделы страницы"><div class="wrap">'+''.join(f'<a href="#{id}">{label}</a>' for id,label in items)+'</div></nav>'

def intro(page,label,description,actions,proof=''):
    return f'<section id="top" class="page-intro"><p class="breadcrumbs"><a href="../index.html">главная</a><span>/</span>{label}</p><div class="intro-title"><p class="num">{label}</p><h1>{escape(SOURCE[page]["title"])}</h1><div class="intro-actions">{actions}</div></div><div class="intro-description">{description}</div>{proof}</section>'

def document(page,body,nav='',legal=False):
    title=SOURCE[page]['title']
    hero_assets='<link rel="stylesheet" href="../assets/site/approved-heroes.css"><script src="../assets/site/approved-heroes.js" defer></script>' if page in ['non-profit','ai-mindset-consulting'] else ''
    descriptions={'non-profit':'Бесплатное обучение для представителей НКО: практические навыки AI, сообщество и экспертная поддержка.','ai-mindset-consulting':'AI Mindset. Team track — обучение на реальных задачах компании, персонализированная поддержка и экспертиза с рынка.','oferta':'Публичный договор-оферта AI Mindset.','confpolicy':'Политика конфиденциальности AI Mindset.'}
    return nbsp(f'''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(title)} — AI Mindset</title><meta name="description" content="{escape(descriptions[page])}"><link rel="canonical" href="https://aimindset.org/{page}/"><link rel="icon" href="../assets/site/aim-favicon.png" type="image/png"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&amp;family=Source+Code+Pro:wght@700&amp;display=swap" rel="stylesheet"><link rel="stylesheet" href="../assets/site/tokens.css?v=20260910b"><link rel="stylesheet" href="../assets/site/pages.css?v=20260910b"><link rel="stylesheet" href="../assets/site/site-shell.css?v=aa04872dcc" id="shared-site-shell">{('<link rel="stylesheet" href="../assets/site/marketing.css">') if page in ['non-profit','ai-mindset-consulting'] else ''}{('<link rel="stylesheet" href="../assets/site/learning-embed.css">') if page=='non-profit' else ''}<link rel="stylesheet" href="../assets/site/buttons.css">{hero_assets}<link rel="stylesheet" href="../assets/site/site-return.css"></head><body data-page="{page}"><a class="skip-link" href="#main-content">К содержанию</a>{shell('header',page)}<main id="main-content" class="wrap">{body}</main>{shell('footer',page)}<script src="../assets/site/program-morph.js" defer></script>{('<script src="../assets/site/case-gallery.js" defer></script>') if page=='ai-mindset-consulting' else ''}{('<script src="../assets/site/learning-embed.js" defer></script>') if page=='non-profit' else ''}<script src="../assets/site/site-return.js" defer></script></body></html>''')

def legal(page):
    data=SOURCE[page];heading=data['title'];sections=[];parts=[];sid='document-intro'
    for i,b in enumerate(data['blocks'][1:],1):
        if b['type']=='heading':
            parts.append('</section>' if parts else '')
            sid='section-'+str(len(sections)+1)
            sections.append((sid,b['text']))
            parts.append(f'<section id="{sid}">'+block(page,i,tag='h2'))
        else:
            if not parts:parts.append('<section id="document-intro">')
            parts.append(block(page,i))
    parts.append('</section>')
    toc='<aside class="document-toc"><details open><summary>Содержание</summary><ol>'+''.join(f'<li><a href="#{id}">{escape(t)}</a></li>' for id,t in sections)+'</ol></details></aside>'
    top=f'<section class="page-intro legal-intro" id="top"><p class="breadcrumbs"><a href="../index.html">главная</a><span>/</span>документы</p><div class="intro-title"><p class="num">AI Mindset · документы</p><h1>{escape(heading)}</h1>{block(page,0,cls="note")}</div></section>'
    other='confpolicy' if page=='oferta' else 'oferta'
    ending=f'<div class="document-end"><a href="../{other}/">{escape(SOURCE[other]["title"])} →</a></div>'
    preserve_write(ROOT/page/'index.html',document(page,top+'<div class="legal-layout">'+toc+'<article class="legal-document">'+''.join(parts)+ending+'</article></div>',legal=True))

def sync_home():
    # Home uses the same runtime components. Never paste a second shell into it.
    path=ROOT/'index.html';text=path.read_text()
    if '<aim-site-header ' not in text or '<aim-site-footer ' not in text:
        raise RuntimeError('Homepage must use shared component mounts; inspect source before integration.')
    preserve_write(path,text)

from layouts import render_pages
render_pages(globals())
if '--marketing-only' not in sys.argv:
    legal('oferta');legal('confpolicy')
if '--sync-home' in sys.argv:sync_home()
if LOG:
    (ROOT/'backups'/f'site-pages-{STAMP}').mkdir(parents=True,exist_ok=True)
    (ROOT/'backups'/f'site-pages-{STAMP}'/'file-log.json').write_text(json.dumps(LOG,ensure_ascii=False,indent=2))
print(json.dumps({'built':2 if '--marketing-only' in sys.argv else 4,'changed':LOG},ensure_ascii=False,indent=2))
