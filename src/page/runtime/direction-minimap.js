
(() => {
  'use strict';
  if(document.getElementById('codex-browser-direction-minimap'))return;
  /* page order: learning → platform/space → consulting → research */
  const groups=[['learning','обучение',['#learning']],['platform','платформа',['#product-platform','#product-space']],['consulting','консалтинг',['#product-consultations']],['research','исследования',['#research']]];
  const nav=document.createElement('nav');
  nav.id='codex-browser-direction-minimap';nav.className='direction-minimap';nav.dataset.editorRuntime='';nav.setAttribute('aria-label','направления');
  const rootLink=document.createElement('a');rootLink.href='#products';rootLink.textContent='направления';rootLink.className='direction-minimap-root';nav.append(rootLink);
  const items=groups.map(([key,label,sels])=>{const a=document.createElement('a');a.href=sels[0];a.textContent=label;a.dataset.dir=key;nav.append(a);return{a,sels}});
  document.body.append(nav);
  let ticking=false;
  const update=()=>{
    ticking=false;
    const mid=innerHeight*.5;let current=null;
    items.forEach(it=>{
      let range=null;
      it.sels.forEach(sel=>{const el=document.querySelector(sel);if(!el)return;const r=el.getBoundingClientRect();range=range?[Math.min(range[0],r.top),Math.max(range[1],r.bottom)]:[r.top,r.bottom]});
      if(range&&range[0]<=mid&&range[1]>=mid)current=it;
    });
    items.forEach(it=>it.a.classList.toggle('is-current',it===current));
    nav.classList.toggle('is-visible',!!current);
  };
  const onScroll=()=>{if(!ticking){ticking=true;requestAnimationFrame(update)}};
  addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll,{passive:true});update();
})();
