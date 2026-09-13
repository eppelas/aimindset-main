
(()=>{
 const mobile=matchMedia('(max-width:960px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const cards=[...document.querySelectorAll('#team .team-member')];
 const effects=(card,duration,hint)=>{if(mobile.matches&&!reduced.matches)document.dispatchEvent(new CustomEvent('aim:team-effect',{detail:{card,duration,hint}}));};
 let hintSlot=0;
 const observer=new IntersectionObserver(entries=>entries.forEach(e=>{
   if(!e.isIntersecting||!mobile.matches)return;
   const delay=Math.max(0,hintSlot-performance.now());hintSlot=performance.now()+delay+1300;
   setTimeout(()=>{const r=e.target.getBoundingClientRect();if(r.bottom>80&&r.top<innerHeight-60){e.target.classList.add('is-scroll-hint');effects(e.target,1200,true);setTimeout(()=>e.target.classList.remove('is-scroll-hint'),1200);}},delay);
   observer.unobserve(e.target);
 }),{threshold:.45});
 cards.forEach(card=>{
   const control=document.createElement('button');control.type='button';control.className='team-animation-trigger';control.dataset.editorRuntime='';
   control.setAttribute('aria-label','Пересобрать карточку: '+card.querySelector('h3').textContent);
   control.innerHTML='';control.addEventListener('click',()=>effects(card,3000,false));card.append(control);observer.observe(card);
 });
 const pair=document.getElementById('w19-smileys');if(!pair)return;
 const items=[...pair.querySelectorAll('.team-ai-pair__item')];
 const panel=document.createElement('div');panel.className='team-goals';panel.id='team-goals';panel.hidden=true;panel.dataset.editorRuntime='';panel.setAttribute('aria-live','polite');pair.prepend(panel);
 const select=(item)=>{
   if(!mobile.matches)return;
   const open=item.getAttribute('aria-expanded')!=='true';items.forEach(el=>el.setAttribute('aria-expanded','false'));
   panel.hidden=!open;if(!open)return;
   const mood=item.querySelector('canvas').dataset.mood;item.setAttribute('aria-expanded','true');
   const title=document.createElement('p');title.textContent=mood==='human'?'цели человека':'цели агента';
   const canvas=document.createElement('canvas');canvas.width=360;canvas.height=260;canvas.style.cssText='display:block;width:100%;height:auto';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',(window.__aimTeamGoals?.[mood]||[]).join(', '));panel.replaceChildren(title,canvas);
   const ctx=canvas.getContext('2d'),HUMAN_CMDS=window.__aimTeamGoals?.human||[],AGENT_CMDS=window.__aimTeamGoals?.agent||[];
   const hsh=(a,b)=>{const n=Math.sin(a*12.9898+b*78.233)*43758.5453;return n-Math.floor(n)};
   const render=t=>{if(panel.hidden||!canvas.isConnected)return;ctx.clearRect(0,0,360,260);const AL={x:130,y:130,r:110,p:1,who:mood};
      ctx.save(); ctx.strokeStyle='#111210'; ctx.globalAlpha=0.8; ctx.setLineDash([4,4]); ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(AL.x,AL.y,AL.r,0,6.2832); ctx.stroke(); ctx.setLineDash([]);
      ctx.font='10px "JetBrains Mono",monospace'; ctx.textAlign='left';
      var tags=AL.who==='human'?HUMAN_CMDS:AGENT_CMDS;
      ctx.beginPath(); ctx.arc(AL.x,AL.y,AL.r*0.62,0,6.2832); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(AL.x-6,AL.y); ctx.lineTo(AL.x+6,AL.y); ctx.moveTo(AL.x,AL.y-6); ctx.lineTo(AL.x,AL.y+6); ctx.stroke();
      for(var ti=0;ti<tags.length;ti++){
        var ta=(ti/tags.length)*6.2832+t*0.00025, tr=AL.r*0.62*(0.6+0.4*hsh(ti,3));
        var tx=AL.x+Math.cos(ta)*tr, ty2=AL.y+Math.sin(ta)*tr*0.8;
        if(Math.hypot(tx-AL.x,ty2-AL.y)>AL.r-10) continue;
        ctx.globalAlpha=0.55+0.4*AL.p; ctx.fillStyle=AL.who==='human'?((ti%3===0)?'#c50d17':'#111210'):((ti%3===0)?'#1FB6D1':'#111210');
        ctx.fillText(tags[ti], tx, ty2);
      }
      ctx.restore(); ctx.globalAlpha=1;
 requestAnimationFrame(render);};requestAnimationFrame(render);
 };
 let revealed=false;
 const revealFaces=()=>{
   if(revealed||!mobile.matches)return;
   const r=pair.getBoundingClientRect();if(r.top>innerHeight-200||r.bottom<80)return;
   revealed=true;
   items.forEach((item,i)=>setTimeout(()=>item.classList.add('is-revealed'),reduced.matches?0:300+i*1100));
 };
 pair.classList.add('has-scroll-sequence');
 const reveal=new IntersectionObserver(revealFaces,{threshold:.1});reveal.observe(pair);
 addEventListener('scroll',revealFaces,{passive:true});addEventListener('resize',revealFaces);requestAnimationFrame(revealFaces);
 const setMode=()=>items.forEach(item=>{if(mobile.matches){item.setAttribute('role','button');item.tabIndex=0;item.setAttribute('aria-expanded','false');item.setAttribute('aria-controls','team-goals');item.setAttribute('aria-label','Показать цели: '+item.querySelector('span').textContent.toLowerCase());}else{['role','tabindex','aria-expanded','aria-controls','aria-label'].forEach(a=>item.removeAttribute(a));panel.hidden=true;}});
 setMode();mobile.addEventListener('change',setMode);
 items.forEach(item=>{item.addEventListener('click',()=>select(item));item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(item)}})});
})();
