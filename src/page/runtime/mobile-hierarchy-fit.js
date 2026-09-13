
(()=>{
 const mobile=matchMedia('(max-width:960px)');let scheduled=false;
 function fit(el,property,max){
   el.style.setProperty(property,max+'px');
   const range=document.createRange();range.selectNodeContents(el);
   const cs=getComputedStyle(el),available=el.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
   if(available<=0)return;
   const width=range.getBoundingClientRect().width;
   let size=Math.max(11,Math.min(max,Math.floor(max*available/Math.max(1,width))));
   el.style.setProperty(property,size+'px');
   while(size>11&&range.getBoundingClientRect().width>available){el.style.setProperty(property,--size+'px')}
 }
 function update(){scheduled=false;
   const labels=[...document.querySelectorAll('main>section>.sec-head>.num:first-child,#learning .learning-kicker>.num')].filter(el=>el.querySelector('.section-name'));
   labels.forEach(el=>el.style.removeProperty('--mobile-label-size'));
   if(mobile.matches){let size=24;const measure=el=>{const a=el.querySelector('.section-number'),b=el.querySelector('.section-name');return (a ? a.getBoundingClientRect().width + 28 : 0) + b.getBoundingClientRect().width <= el.clientWidth};do{labels.forEach(el=>el.style.setProperty('--mobile-label-size',size+'px'));if(labels.filter(el=>el.getClientRects().length).every(measure))break;size--}while(size>11)}
   document.querySelectorAll('#products .ecosystem-direction-copy h2').forEach(el=>{if(mobile.matches){el.style.width='calc(100% - 32px)';fit(el,'--direction-label-size',18)}else{el.style.removeProperty('--direction-label-size');el.style.removeProperty('width')}});
 }
 const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update)}};
 addEventListener('resize',schedule);mobile.addEventListener('change',schedule);document.fonts.ready.then(schedule);schedule();
})();
