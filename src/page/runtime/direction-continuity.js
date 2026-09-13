
(() => {
  'use strict';
  const links=[...document.querySelectorAll('.ecosystem-direction-jump')];
  if(!links.length||document.getElementById('codex-browser-direction-continuity'))return;
  const destinations={learning:'#learning',platform:'#product-platform',research:'#research',consulting:'#product-consultations'};
  /* линии всегда видны — карточка остаётся частью схемы; левые стартуют слева, правые справа;
     спуск вертикальный, на поворот — одна дуга R=14. */
  const SVG_NS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(SVG_NS,'svg');
  svg.id='codex-browser-direction-continuity';svg.dataset.editorRuntime='';svg.classList.add('direction-continuity-guide');
  document.body.append(svg);
  /* линии не сливаются. Внутренняя полоса (40px) → верхняя секция стороны, полка ниже;
     внешняя (56px) → нижняя секция, полка выше. Горизонтали не режут чужие вертикали. */
  const lanes={learning:{side:-1,lane:0},platform:{side:-1,lane:1},consulting:{side:1,lane:0},research:{side:1,lane:1}};
  const paths={};
  const minimap=document.getElementById('codex-browser-direction-minimap');
  const interactive=matchMedia('(min-width:961px) and (hover:hover)');
  let closeTimer=0,lastTrigger=null,returningFocus=false;
  const keepMenu=()=>clearTimeout(closeTimer);
  const closeMenu=()=>{
    keepMenu();minimap?.classList.remove('is-line-open');
    minimap?.querySelectorAll('.is-line-target').forEach(a=>a.classList.remove('is-line-target'));
    Object.values(paths).forEach(p=>p.g.classList.remove('is-line-hot'));
  };
  const leaveMenu=()=>{keepMenu();closeTimer=setTimeout(()=>{
    if(minimap?.matches(':hover')||minimap?.contains(document.activeElement)||Object.values(paths).some(p=>[p.anchor,p.link].some(el=>el===document.activeElement||el.matches(':hover'))))return;
    closeMenu();
  },450)};
  const openMenu=(key,event)=>{
    if(!interactive.matches||!minimap||returningFocus||document.body.classList.contains('editing'))return;
    keepMenu();lastTrigger=event.currentTarget||paths[key].anchor;
    minimap.classList.add('is-line-open');
    minimap.querySelectorAll('[data-dir]').forEach(a=>a.classList.toggle('is-line-target',a.dataset.dir===key));
    Object.entries(paths).forEach(([id,p])=>p.g.classList.toggle('is-line-hot',id===key));
    if(innerWidth>=1600)return;
    const x=typeof event.clientX==='number'?event.clientX:(lanes[key].side<0?24:innerWidth-24);
    const y=typeof event.clientY==='number'?event.clientY:innerHeight/2;
    const box=minimap.getBoundingClientRect();
    const left=x>innerWidth/2?x-box.width-12:x+12;
    const top=Math.max(112,Math.min(y-20,innerHeight-box.height-16));
    minimap.style.setProperty('--line-menu-x',Math.round(Math.max(16,Math.min(left,innerWidth-box.width-16)))+'px');
    minimap.style.setProperty('--line-menu-y',Math.round(top)+'px');
  };
  minimap?.addEventListener('pointerenter',keepMenu);
  minimap?.addEventListener('pointerleave',leaveMenu);
  minimap?.addEventListener('focusin',keepMenu);
  minimap?.addEventListener('focusout',leaveMenu);
  minimap?.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu()});
  addEventListener('scroll',()=>{
    if(minimap?.contains(document.activeElement)||Object.values(paths).some(p=>p.anchor===document.activeElement||p.link===document.activeElement))return;
    closeMenu();
  },{passive:true});
  addEventListener('resize',closeMenu,{passive:true});
  addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!minimap?.classList.contains('is-line-open'))return;
    if(minimap.contains(document.activeElement)){returningFocus=true;lastTrigger?.focus({preventScroll:true});returningFocus=false;}
    closeMenu();
  });
  links.forEach(link=>{
    const branch=link.closest('[data-ecosystem-branch]');if(!branch)return;
    const key=branch.dataset.ecosystemBranch;if(!destinations[key]||paths[key])return;
    const g=document.createElementNS(SVG_NS,'g');g.dataset.dir=key;
    const echo=document.createElementNS(SVG_NS,'path');echo.classList.add('direction-continuity-guide__echo');
    const main=document.createElementNS(SVG_NS,'path');main.classList.add('direction-continuity-guide__main');
    echo.setAttribute('aria-hidden','true');main.setAttribute('aria-hidden','true');
    const anchor=document.createElementNS(SVG_NS,'a');anchor.classList.add('direction-continuity-guide__link');
    anchor.setAttribute('href',destinations[key]);anchor.setAttribute('tabindex','0');anchor.setAttribute('aria-label',link.getAttribute('aria-label'));
    const hit=document.createElementNS(SVG_NS,'path');hit.classList.add('direction-continuity-guide__hit');hit.setAttribute('aria-hidden','true');
    anchor.append(hit);g.append(echo,main,anchor);svg.append(g);
    paths[key]={g,main,echo,branch,anchor,hit,link};
    anchor.addEventListener('pointerenter',event=>openMenu(key,event));
    anchor.addEventListener('pointerleave',leaveMenu);
    anchor.addEventListener('focus',event=>openMenu(key,event));
    anchor.addEventListener('blur',leaveMenu);
    anchor.addEventListener('click',closeMenu);
    anchor.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown'||event.key==='ArrowRight'){
        event.preventDefault();openMenu(key,event);minimap?.querySelector('[data-dir="'+key+'"]')?.focus({preventScroll:true});
      }
    });
    link.addEventListener('pointerenter',closeMenu);
    link.addEventListener('pointerleave',leaveMenu);
    link.addEventListener('focus',closeMenu);
    link.addEventListener('blur',leaveMenu);
    link.addEventListener('click',closeMenu);
    link.addEventListener('keydown',event=>{
      if(!interactive.matches||innerWidth>=1600||!['ArrowDown','ArrowRight'].includes(event.key))return;
      event.preventDefault();openMenu(key,event);
      minimap?.querySelector('[data-dir="'+key+'"]')?.focus({preventScroll:true});
    });
    branch.addEventListener('pointerenter',()=>g.classList.add('is-hot'));
    branch.addEventListener('pointerleave',()=>g.classList.remove('is-hot'));
  });
  const R=14;
  const route=key=>{
    const p=paths[key];if(!p)return;
    const target=document.querySelector(destinations[key]);if(!target)return;
    const {side,lane}=lanes[key];
    const head=target.querySelector(':scope > .sec-head')||target.querySelector('.sec-head');
    const anchor=(head&&(side<0?head.querySelector('.num:first-child'):head.querySelector('.num:last-child')))||head;
    const br=p.branch.getBoundingClientRect(),cr=p.branch.querySelector('.direction-scene').getBoundingClientRect();
    /* если шапки нет — целимся в верх секции (+40px), а не в её геометрический центр */
    const tr=anchor?anchor.getBoundingClientRect():(()=>{const r=target.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top+28,height:24};})();
    if(br.width<10)return;
    const graph=document.querySelector('[data-ecosystem-graph]');
    const gr=graph?graph.getBoundingClientRect():br;
    const doc=document.documentElement,docW=doc.clientWidth;
    const outer=(side<0?gr.left-40-lane*16:gr.right+40+lane*16)+scrollX;
    const sideX=side<0?Math.max(12,outer):Math.min(docW-12,outer);
    const sx=(side<0?cr.left+.5:cr.right-.5)+scrollX, sy=cr.bottom+scrollY;
    // All routes leave below the cards; crossings are intentional.
    const shelfY=gr.bottom+scrollY+(lane===1?18:34);
    const ex=(side<0?tr.left-8:tr.right+8)+scrollX, ey=tr.top+scrollY+tr.height/2;
    const d1=sideX>sx?1:-1, d2=ex>sideX?1:-1;
    const d='M '+sx.toFixed(1)+' '+sy.toFixed(1)
      +' L '+sx.toFixed(1)+' '+(shelfY-R).toFixed(1)
      +' Q '+sx.toFixed(1)+' '+shelfY.toFixed(1)+' '+(sx+d1*R).toFixed(1)+' '+shelfY.toFixed(1)
      +' L '+(sideX-d1*R).toFixed(1)+' '+shelfY.toFixed(1)
      +' Q '+sideX.toFixed(1)+' '+shelfY.toFixed(1)+' '+sideX.toFixed(1)+' '+(shelfY+R).toFixed(1)
      +' L '+sideX.toFixed(1)+' '+(ey-R).toFixed(1)
      +' Q '+sideX.toFixed(1)+' '+ey.toFixed(1)+' '+(sideX+d2*R).toFixed(1)+' '+ey.toFixed(1)
      +' L '+ex.toFixed(1)+' '+ey.toFixed(1);
    p.main.setAttribute('d',d);p.echo.setAttribute('d',d);p.hit.setAttribute('d',d);p.echo.setAttribute('transform','translate('+(side*3)+' 0)');
  };
  let frame=0;
  const build=()=>{frame=0;
    const doc=document.documentElement,docW=doc.clientWidth,docH=Math.max(doc.scrollHeight,doc.clientHeight);
    svg.setAttribute('viewBox','0 0 '+docW+' '+docH);svg.style.width=docW+'px';svg.style.height=docH+'px';
    Object.keys(paths).forEach(route);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(build)};
  addEventListener('resize',schedule,{passive:true});addEventListener('load',schedule);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(schedule);
  setInterval(schedule,3000);build();
})();
