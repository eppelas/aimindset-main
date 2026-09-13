
(()=>{
 const research=document.getElementById('researchProjects'),more=document.querySelector('.research-more');
 more?.addEventListener('click',()=>{const expanded=research.dataset.expanded!=='true';research.dataset.expanded=String(expanded);more.setAttribute('aria-expanded',String(expanded));more.textContent=expanded?'свернуть':'ещё';if(!expanded)requestAnimationFrame(()=>{more.scrollIntoView({block:'end',behavior:'instant'});more.focus({preventScroll:true});});});
 // Status determines the mobile rail. Seasonal and currently open programs remain outside.
 const grid=document.querySelector('#learning .program-grid'),rail=document.querySelector('#learning .program-trio');
 if(!grid||!rail)return;
 function group(){
  [...grid.querySelectorAll('.program-card')].forEach(card=>{
   const waiting=!!card.querySelector('.waitlist-open')&&!card.matches('.program-card--main,.program-card--current')&&!card.querySelector('.program-card__status');
   if(waiting&&card.parentElement!==rail)rail.append(card);
   if(!waiting&&card.parentElement===rail)grid.insertBefore(card,rail);
  });rail.hidden=!rail.children.length;
 }
 group();let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;group()})}).observe(grid,{childList:true,subtree:true});
})();
