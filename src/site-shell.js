/* One runtime source for the header and footer on every connected page.
 * Donor: the current v19 homepage. Page files contain only component mounts.
 * Keep this classic script synchronous at the header mount: the existing
 * homepage editor/section rail reads the light DOM later in the same parse.
 */
(()=>{
  const BASE = new URL('../../', document.currentScript.src).href;
  const HEADER = {{shared:navigation:json}};
  const FOOTER = {{shared:footer:json}};
  const SECTIONS = {"home": "<a href=\"#about\">кто мы</a><a href=\"#team\">команда</a><a href=\"#approach\">подход</a><a href=\"#cases\">сделано внутри</a><a href=\"#learning\">обучение</a><a href=\"#product-platform\" data-sections=\"product-platform product-space\">платформа и сообщество</a><a href=\"#product-consultations\" data-sections=\"product-consultations product-nonprofit\">консультации</a><a href=\"#research\">исследования</a><a href=\"#reviews\">слова</a><a href=\"#manifesto\">манифест</a><a href=\"#follow\">где следить</a><a href=\"#faq\" hidden>вопросы</a>", "ai-mindset-consulting": "<a href=\"#format\">формат</a><a href=\"#support\">поддержка</a><a href=\"#cases\">кейсы</a><a href=\"#terms\">спецусловия</a><a href=\"#contact\">контакты</a>"};
  class AimSiteHeader extends HTMLElement {
    connectedCallback(){
      if(this.querySelector('[data-editor-runtime="site-header"]')) return;
      this.setAttribute('data-editor-ui','');
      const page=this.getAttribute('page')||'';
      this.innerHTML=HEADER.replaceAll('@@BASE@@',BASE)+(SECTIONS[page]?`<nav class="tabs${page==='home'?'':' page-tabs'}" aria-label="Разделы страницы" data-editor-runtime="site-subnav"><div class="wrap">${SECTIONS[page]}</div></nav>`:'');
      this.querySelectorAll('.primary-nav [data-page]').forEach(a=>{
        if(a.dataset.page===page)a.setAttribute('aria-current','page');
      });

 if(page==='home')this.querySelectorAll('[data-section="learning"]').forEach(a=>a.setAttribute('href','#learning'));
 const menu=this.querySelector('#wild-labs-menu'),button=menu.querySelector('button');
 const setOpen=open=>{menu.toggleAttribute('data-open',open);button.setAttribute('aria-expanded',String(open))};
 menu.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')setOpen(true)});
 menu.addEventListener('pointerleave',()=>{if(!menu.contains(document.activeElement))setOpen(false)});
 menu.addEventListener('focusin',()=>setOpen(true));
 menu.addEventListener('focusout',e=>{if(!menu.contains(e.relatedTarget))setOpen(false)});
 button.addEventListener('click',()=>setOpen(true));
 button.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);menu.querySelector('a').focus()}});
 menu.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();button.focus();setOpen(false)}});
 document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))setOpen(false)});
 menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setOpen(false)));

      // Port of staging src/components/MobileMenu.tsx: full-screen right slide,
      // grouped flat links, body-fixed scroll lock and deferred section scrolling.
      // Native dialog supplies focus containment, Escape and background inertness.
      const trigger=document.createElement('button');
      trigger.type='button';trigger.className='mobile-menu-trigger';
      trigger.setAttribute('aria-label','Открыть меню');trigger.setAttribute('aria-expanded','false');
      trigger.setAttribute('aria-controls','aim-mobile-menu');
      trigger.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 4h18v3H3zm0 7h18v3H3zm0 7h18v3H3z"/></svg>';
      this.querySelector('.site-header .wrap').append(trigger);
      const dialog=document.createElement('dialog');dialog.id='aim-mobile-menu';dialog.className='aim-mobile-menu';
      dialog.setAttribute('aria-label','Навигация');
      dialog.innerHTML='<div class="mobile-menu-head"><span>навигация</span><button type="button" class="mobile-menu-close" aria-label="Закрыть меню" autofocus><svg width="25" height="25" viewBox="0 0 25 25" aria-hidden="true"><path fill="currentColor" d="M0 0h5v5H0zm20 0h5v5h-5zM5 5h5v5H5zm10 0h5v5h-5zM10 10h5v5h-5zM5 15h5v5H5zm10 0h5v5h-5zM0 20h5v5H0zm20 0h5v5h-5z"/></svg></button></div><div class="mobile-menu-groups"><nav class="mobile-site-links" aria-label="Меню сайта"><div class="mobile-menu-label">меню сайта</div></nav></div>';
      const siteLinks=dialog.querySelector('.mobile-site-links');
      [...this.querySelector('.primary-nav').children].forEach(item=>{
        if(item.matches('a'))siteLinks.append(item.cloneNode(true));
        else if(item.matches('.nav-dropdown')){
          const group=document.createElement('div');group.className='mobile-labs';
          const label=document.createElement('div');label.className='mobile-labs-label';label.textContent='labs';group.append(label);
          item.querySelectorAll('.nav-dropdown__panel > a,.nav-dropdown__panel > span').forEach(link=>group.append(link.cloneNode(true)));
          siteLinks.append(group);
        }
      });
      if(SECTIONS[page]){
        const sections=document.createElement('nav');sections.className='mobile-section-links';sections.setAttribute('aria-label','Разделы страницы');
        sections.innerHTML='<div class="mobile-menu-label">на этой странице</div>'+SECTIONS[page];
        dialog.querySelector('.mobile-menu-groups').append(sections);
      }
      this.append(dialog);
      let savedScroll=0,savedBody=null;
      const closeMenu=()=>{if(dialog.open)dialog.close()};
      trigger.addEventListener('click',()=>{
        savedScroll=window.scrollY;
        savedBody=Object.fromEntries(['position','top','width','overflowY'].map(k=>[k,document.body.style[k]]));
        Object.assign(document.body.style,{position:'fixed',top:`-${savedScroll}px`,width:'100%',overflowY:'scroll'});
        dialog.showModal();dialog.scrollTop=0;trigger.setAttribute('aria-expanded','true');
      });
      dialog.querySelector('.mobile-menu-close').addEventListener('click',closeMenu);
      let pendingHash=null;
      dialog.addEventListener('close',()=>{
        if(savedBody)Object.assign(document.body.style,savedBody);
        savedBody=null;trigger.setAttribute('aria-expanded','false');
        window.scrollTo({top:savedScroll,behavior:'instant'});trigger.focus({preventScroll:true});
        const hash=pendingHash;pendingHash=null;
        if(hash)requestAnimationFrame(()=>{
          history.pushState(null,'',hash);
          document.getElementById(hash.slice(1))?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
          dispatchEvent(new Event('hashchange'));
        });
      });
      dialog.querySelectorAll('a').forEach(a=>a.addEventListener('click',e=>{
        if(a.getAttribute('href').startsWith('#')){e.preventDefault();pendingHash=a.getAttribute('href')}
        closeMenu();
      }));
      matchMedia('(max-width: 1100px)').addEventListener('change',e=>{if(!e.matches)closeMenu()});

      // Home section-order/editor behavior uses the same live .tabs nodes.
      // Other pages use its source visible-section algorithm without the rail.
      if(page!=='home' && SECTIONS[page]){
        const update=()=>{
          const nav=this.querySelector('.tabs');
          const links=[...nav.querySelectorAll('a[href^="#"]')];
          const sections=links.map(a=>document.getElementById(a.hash.slice(1))).filter(Boolean);
          const bottom=nav.getBoundingClientRect().bottom,probe=bottom+Math.min(48,innerHeight*.07);
          let current=null,best=0;
          for(const section of sections){const r=section.getBoundingClientRect(),visible=Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,bottom));if(visible>best){best=visible;current=section}}
          if(!current||best<(innerHeight-bottom)*.35)current=sections.find(s=>{const r=s.getBoundingClientRect();return r.top<=probe&&r.bottom>probe});
          if(!current)current=sections.filter(s=>s.getBoundingClientRect().top<=probe).at(-1);
          links.forEach(a=>{const active=current&&a.hash==='#'+current.id;a.classList.toggle('is-current',!!active);if(active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});
        };
        let frame=0;const queue=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;update()})};
        addEventListener('scroll',queue,{passive:true});addEventListener('resize',queue,{passive:true});
        addEventListener('hashchange',queue);addEventListener('DOMContentLoaded',queue,{once:true});
        if(document.readyState!=='loading')queue();
      }
    }
  }
  class AimSiteFooter extends HTMLElement {
    connectedCallback(){
      if(this.querySelector('[data-editor-runtime="site-footer"]'))return;
      this.setAttribute('data-editor-ui','');
      this.innerHTML=FOOTER.replaceAll('@@BASE@@',BASE);
    }
  }
  if(!customElements.get('aim-site-header'))customElements.define('aim-site-header',AimSiteHeader);
  if(!customElements.get('aim-site-footer'))customElements.define('aim-site-footer',AimSiteFooter);
})();
