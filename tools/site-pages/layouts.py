"""Source-backed marketing compositions; the shared site shell stays in build.py."""
import json,re
from html import escape

def render_pages(api):
    root,here,source,block,inline,cta,document,write,tabs=(api[k] for k in ['ROOT','HERE','SOURCE','block','inline','cta','document','preserve_write','tabs'])
    def morph(preset='community',color='#555',duration=30000,phase=0):
        return f'<div class="program-card__morph" data-morph-preset="{preset}" data-morph-duration="{duration}" data-morph-phase="{phase}" data-morph-neutral data-morph-color="{color}" aria-hidden="true"></div>'
    def heading(p,i):
        return editorial(re.sub(r'^\d+\.\s*','',inline(p,i)),True)
    def quote(p,i):
        return f'<blockquote class="rhythm-quote editorial-pullquote" data-source-block="{i}"><p><span class="rhythm-highlight">{inline(p,i)}</span></p></blockquote>'
    def bullets(p,i,prefix_tag='p'):
        parts=re.split(r'▪[︎️]?',source[p]['blocks'][i]['text']);prefix=parts[0].strip()
        return f'<div data-source-block="{i}">'+(f'<{prefix_tag}>{escape(prefix)}</{prefix_tag}>' if prefix else '')+'<ul class="plain-list">'+''.join(f'<li>{escape(x.strip())}</li>' for x in parts[1:] if x.strip())+'</ul></div>'
    section_number=0
    def editorial(html,short=False):
        # Normalize authored copy only; proper names and source quotations keep their case.
        parts=re.split(r'(<[^>]+>)',html)
        first=True
        for n in range(0,len(parts),2):
            if first and re.search(r'[А-Яа-яЁёA-Za-z]',parts[n]):
                parts[n]=re.sub(r'^(\s*)([А-ЯЁ])',lambda m:m[1]+m[2].lower(),parts[n],count=1)
                first=False
            parts[n]=parts[n].replace(' — ',' – ')
        value=''.join(parts)
        return re.sub(r'[.,:;]+(?=(?:</[^>]+>)*$)','',value) if short else value
    def section(id,title,body,intro='',cls=''):
        nonlocal section_number
        section_number+=1
        title=editorial(title.replace('<br>',' '),True)
        opener=f'<div class="sec-head wild-section-head"><h2 id="{id}-title" class="num">{section_number:02} · {{{title}}}</h2></div>'
        lead=f'<div class="section-lead">{editorial(intro)}</div>' if intro else ''
        return f'<section id="{id}" class="page-section marketing-section {cls}" aria-labelledby="{id}-title">{opener}{lead}{body}</section>'

    p='ai-mindset-consulting';b=lambda i,**kw:block(p,i,**kw)
    body=(here/'approved-heroes'/f'{p}.html').read_text()
    outcomes='<ul class="outcome-grid">'+''.join('<li>'+item['html']+'</li>' for item in source[p]['blocks'][3]['items'])+'</ul>'
    body+=section('format','Как это работает',outcomes+'<div class="quote-break quote-break--right">'+quote(p,7)+'</div>',b(2),cls='team-format')
    support=''
    for title,ids,preset in [(9,[10,11],'semantic-strategy'),(12,[13],'semantic-setup'),(14,[15],'semantic-team-chat'),(16,[17],'semantic-progress')]:
        support+='<article class="support-item"><div class="support-title">'+b(title)+morph(preset,['#c50d17','#519b8b','#7651b8','#555'][[9,12,14,16].index(title)],26000+[9,12,14,16].index(title)*3000,title*.031)+'</div>'+''.join(bullets(p,i) if '▪' in source[p]['blocks'][i]['text'] else b(i) for i in ids)+'</article>'
    follow='<div class="support-after"><div><h3 data-source-block="18">поддержка после лаборатории<br><span class="team-ink">от 2 до 12 недель</span></h3><ul class="plain-list">'+''.join(f'<li data-source-block="{i}">{escape(source[p]["blocks"][i]["text"].lstrip("▪︎ "))}</li>' for i in [19,20,21])+'</ul></div><div class="supporting-visual">'+b(22)+'</div></div>'
    body+=section('support','Сопровождение команды','<div class="support-grid">'+support+'</div>'+follow,'<p>Сверх базовой программы лаборатории</p>',cls='team-support')
    cards=json.loads((here/'content/cases.json').read_text())['cards']
    case_presets={'coaching':'coaching','portfolio':'vision','language':'learning','calls':'summary','obsidian':'knowledge','project':'project','automation':'automation','research':'research','content':'content','analysis':'analytics','voice':'voice','crm':'sales','code':'code','support':'support','workflow':'workflow'}
    def casecard(c,i):
        dark=c['source_data'].get('dark',False)
        color=c['source_data'].get('color','#666')
        classes='case-card'+(' case-card--dark' if dark else '')+(' case-card--feature' if i==0 else '')
        span=[4,2,2,3,3,2][i%6]
        return f'<article class="{classes}" data-case-id="{c["id"]}" style="--case-span:{span};--case-accent:{color}">'+morph(case_presets[c['id']],color,24000+(i%5)*3000,round((i*.173)%1,3))+f'<p class="eyebrow">{escape(c["category"])}</p><h3>{escape(c["title"])}</h3><p>{escape(c["description"])}</p><div class="case-footer"><ul class="case-tags" aria-label="Инструменты">'+''.join('<li>'+escape(t)+'</li>' for t in c['tags'])+'</ul></div></article>'
    gallery='<div id="team-case-gallery" class="case-grid" data-case-gallery>'+''.join(casecard(c,i) for i,c in enumerate(cards))+'</div><button class="product-cta case-toggle" type="button" aria-expanded="false" aria-controls="team-case-gallery" data-case-toggle hidden><span data-case-label>Ещё 9 кейсов</span><span aria-hidden="true">+</span></button>'
    videos=json.loads((here/'content/videos.json').read_text())['videos']
    media='<div class="video-grid">'+''.join(f'<article class="video-card"><a class="video-cover" href="{escape(v["watch_url"],quote=True)}" target="_blank" rel="noopener noreferrer" aria-label="{escape(v["title"],quote=True)} — с {v["start_label"]}, новая вкладка"><img src="{v["thumbnail_url"]}" alt="" width="1280" height="720" loading="lazy"><span class="video-time">с {v["start_label"]}</span></a><h3>{escape(v["title"])}</h3><a class="product-cta" href="{escape(v["watch_url"],quote=True)}" target="_blank" rel="noopener noreferrer" aria-label="Смотреть фрагмент: {escape(v["title"],quote=True)} — новая вкладка"><span>смотреть фрагмент</span><span class="go-arrow" aria-hidden="true">↗</span></a></article>' for v in videos)+'</div>'
    body+=section('cases','Что создают команды<br>за 4 недели',gallery+'<div class="showcase-head"><h3>внутри рабочих проектов</h3><p>фрагменты Founder OS Showcase</p></div>'+media,b(32),cls='team-cases')
    contexts=''.join('<article class="context-item">'+morph(preset,color,27000+n*2500,n*.2)+bullets(p,i,'h3')+'</article>' for n,(i,preset,color) in enumerate([(26,'semantic-product','#c50d17'),(27,'semantic-marketing','#519b8b'),(28,'semantic-hr','#7651b8'),(29,'semantic-operations','#555')]))
    body+=section('practice','Практика в контексте<br>вашего бизнеса','<div class="context-grid">'+contexts+'</div>',b(25),cls='team-practice')
    community='<div class="community-grid"><div class="community-copy"><h3>'+heading(p,38)+'</h3>'+b(39)+b(42,cls='result')+morph('semantic-community','#519b8b',36000,.47)+'</div><div class="community-quotes">'+quote(p,40)+quote(p,41)+'</div></div>'
    community+='<div class="reason-cards"><article class="reason-card"><div><h3>'+heading(p,43)+'</h3>'+b(44)+b(45,cls='result')+'</div>'+morph('semantic-personal','#7651b8',31000,.27)+'</article><article class="reason-card reason-card--visual"><div><h3>'+heading(p,46)+'</h3>'+b(47)+b(49,cls='result')+'</div><div class="synergy-visual">'+b(48)+'</div></article></div>'
    body+=section('community','Команда и среда',community,cls='team-community')
    roi='<div class="roi-grid"><div class="supporting-visual">'+b(51)+'</div><div class="roi-copy">'+bullets(p,52)+b(55,cls='result')+'</div></div><div class="roi-quotes">'+quote(p,53)+quote(p,54)+'</div>'
    body+=section('roi','ROI начинается сразу',roi,cls='team-roi')
    prices=''
    for title,idx,discount in [(57,58,10),(59,60,15),(61,62,20)]:
        prices+='<article class="price">'+re.sub(r'(\d)-(\d)',r'\1–\2',b(title))+f'<div class="price-discount"><p class="discount">{discount}%</p><p class="note">скидка на всю команду</p></div><ul class="plain-list">'+''.join('<li>'+x['html']+'</li>' for x in source[p]['blocks'][idx]['items'][:2])+'</ul></article>'
    body+=section('terms','Спецусловия<br>для команд','<div class="pricing">'+prices+'</div><div class="company-proof">'+b(63,tag='p',cls='statement')+b(64,cls='note')+'</div>',cls='team-terms')
    contact='<div class="contact-grid"><div class="contact-main"><p class="contact-eyebrow">Team track</p><h3>начнём с ваших задач</h3><p>Бесплатная 30-минутная консультация: разберём задачи и предложим конкретные шаги.</p><div class="intro-actions">'+cta('https://t.me/ai_mind_set_team','написать команде')+'</div></div><div class="contact-custom"><p class="contact-eyebrow">кастомный формат</p><h3>программа для вашей компании</h3><p>Обсудите с основателем проекта Александром цели и задачи компании — и подберите кастомный формат.</p><div class="intro-actions">'+cta('https://t.me/alex_named','написать Александру','product-cta')+'</div></div></div>'
    contact+='<p class="cross-page">Работаете в НКО? <a href="../non-profit/">Бесплатное участие в лаборатории →</a></p>'
    body+=section('contact','Внедрить AI<br>в процессы компании',contact,cls='team-contact')
    write(root/p/'index.html',document(p,body))

    p='non-profit';b=lambda i,**kw:block(p,i,**kw);apply=source[p]['blocks'][2]['links'][0]['href']
    section_number=0
    body=(here/'approved-heroes'/f'{p}.html').read_text()
    statement='Это не только технический навык – в первую очередь это способ мышления (mindset).'
    mission=inline(p,4)
    assert statement in mission
    before,after=mission.split(statement)
    mission_body='<div class="mission-layout"><div class="mission-greeting">'+editorial(b(3))+'</div><div class="mission-prose" data-source-block="4"><p>'+editorial(before.strip())+'</p><p>'+editorial(after.strip())+'</p></div></div>'
    mission_body+='<div class="quote-break quote-break--right"><blockquote class="rhythm-quote editorial-pullquote" data-source-block="4"><p><span class="rhythm-highlight">'+statement+'</span></p></blockquote></div>'
    body+=section('mission','менять мир к лучшему',mission_body,cls='nonprofit-mission')
    offer='<div class="participation-grid"><article class="participation-offer">'+editorial(b(5),True)+'<ul class="offer-list" data-source-block="6">'+''.join('<li>'+editorial(item['html'],True)+'</li>' for item in source[p]['blocks'][6]['items'])+'</ul></article><article class="participation-exchange">'+editorial(b(7),True)+editorial(b(8,cls='plain-list'))+'</article></div>'
    body+=section('participation','участие в лаборатории',offer,cls='nonprofit-participation')
    criteria=''
    for n,(i,preset,color) in enumerate([(10,'np-benefit','#519b8b'),(12,'np-ai-project','#c50d17'),(14,'np-sharing','#7651b8'),(16,'np-active-learning','#519b8b')]):
        detail=source[p]['blocks'][i+1]['text'].replace('"посмотреть в записи"','«посмотреть в записи»')
        # Keep every source sentence; paragraph breaks provide reading pauses.
        sentences=re.split(r'(?<=[.!?]) +',detail)
        midpoint=max(1,len(sentences)//2)
        copy='<p>'+editorial(escape(' '.join(sentences[:midpoint])))+'</p><p>'+editorial(escape(' '.join(sentences[midpoint:])))+'</p>'
        criteria+='<article class="criterion criterion--'+str(n+1)+'"><div class="criterion-head"><div><span class="criterion-number" aria-hidden="true">0'+str(n+1)+'</span>'+editorial(b(i,tag='h3'),True)+'</div>'+morph(preset,color,26000+n*3000,n*.173)+'</div><div class="criterion-copy" data-source-block="'+str(i+1)+'">'+copy+'</div></article>'
    body+=section('criteria','критерии отбора','<div class="criteria-grid">'+criteria+'</div>',cls='nonprofit-criteria')
    principles='<ul class="principles-grid">'
    for n,(item,preset,color) in enumerate(zip(source[p]['blocks'][1]['items'],['np-benefit','np-active-learning','semantic-community','semantic-personal'],['#c50d17','#519b8b','#7651b8','#555'])):
        head,detail=re.split(r' [—–] ',item['text'],maxsplit=1)
        principles+='<li><div><h3>'+editorial(escape(head),True)+'</h3><p>'+editorial(escape(detail),True)+'</p></div>'+morph(preset,color,27000+n*3000,n*.19)+'</li>'
    principles+='</ul>'
    body+=section('approach','среда обучения',principles,cls='nonprofit-approach')
    # Only the homepage owns programme data, visuals and waitlist behaviour.
    catalogue='<div class="learning-embed" data-learning-embed data-learning-source="../index.html#learning"><p class="learning-embed__status" role="status"><a href="../index.html#learning">посмотреть лаборатории на главной</a></p><iframe title="Лаборатории AI Mindset" data-src="../assets/site/learning-frame.html" scrolling="no"></iframe></div>'
    body+=section('labs','Наши лаборатории',catalogue,cls='nonprofit-labs')
    application='<div class="application-grid"><div class="application-copy">'+editorial(b(20))+editorial(b(21))+'<div class="intro-actions">'+cta(apply,'подать заявку →')+'</div></div></div><p class="cross-page">Для бизнеса — <a href="../ai-mindset-consulting/">обучение команд →</a></p>'
    body+=section('apply','Расскажите<br>о своём проекте',application,cls='nonprofit-apply')
    write(root/p/'index.html',document(p,body))
