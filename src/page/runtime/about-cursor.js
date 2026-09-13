
/* ═══ курсор-лого «про нас»: маска растеризована из assets/brand/ai-mindset-logo-transparent.png (18×18) ═══ */
(function() {
  "use strict";
  var mobileLogo=innerWidth<=960;
  if (!mobileLogo && !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  var SOLID=[[6,0],[7,0],[8,0],[9,0],[10,0],[11,0],[4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],[12,1],[13,1],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[10,2],[11,2],[12,2],[13,2],[14,2],[15,2],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[10,3],[11,3],[12,3],[13,3],[14,3],[15,3],[16,3],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4],[10,4],[11,4],[12,4],[13,4],[14,4],[15,4],[16,4],[0,5],[1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5],[10,5],[11,5],[12,5],[13,5],[14,5],[15,5],[16,5],[17,5],[0,6],[1,6],[6,6],[7,6],[10,6],[11,6],[12,6],[13,6],[14,6],[15,6],[16,6],[17,6],[0,7],[1,7],[6,7],[7,7],[10,7],[11,7],[12,7],[13,7],[14,7],[15,7],[16,7],[17,7],[0,8],[1,8],[2,8],[5,8],[6,8],[7,8],[10,8],[11,8],[15,8],[16,8],[17,8],[1,9],[2,9],[3,9],[4,9],[5,9],[6,9],[7,9],[10,9],[11,9],[12,9],[13,9],[14,9],[15,9],[16,9],[1,10],[2,10],[3,10],[4,10],[5,10],[6,10],[7,10],[10,10],[11,10],[12,10],[13,10],[14,10],[15,10],[16,10],[2,11],[3,11],[4,11],[5,11],[6,11],[7,11],[10,11],[11,11],[12,11],[13,11],[14,11],[15,11],[4,12],[5,12],[6,12],[7,12],[10,12],[11,12],[12,12],[13,12],[6,13],[7,13],[10,13],[11,13],[7,14],[10,14],[11,14],[10,15],[11,15],[10,16],[11,16],[10,17],[11,17]];   /* ножка в две клетки, как у оригинала */
  var EDGE=[[5,0],[12,0],[3,1],[14,1],[8,2],[9,2],[8,3],[9,3],[0,4],[8,4],[9,4],[17,4],[8,5],[9,5],[2,6],[8,6],[9,6],[2,7],[8,7],[9,7],[3,8],[4,8],[8,8],[9,8],[12,8],[13,8],[14,8],[0,9],[8,9],[9,9],[17,9],[8,10],[9,10],[8,11],[9,11],[3,12],[8,12],[9,12],[14,12],[5,13],[8,13],[9,13],[12,13],[8,14],[9,14],[11,14],[9,15],[11,15],[9,16],[11,16],[9,17]];   /* полупрозрачный сглаживающий контур */
  var N=18, LC=3;
  var cv=document.createElement('canvas'); cv.id='aim-cursor-logo'; cv.setAttribute('aria-hidden','true');
  var logoHost=null,dragStart=null,about=document.getElementById('about'),facePosition={x:0,y:0};
  function placeFace(x,y){facePosition.x=Math.max(0,Math.min(about.clientWidth-54,x));facePosition.y=Math.max(0,Math.min(about.clientHeight-72,y));logoHost.style.left=facePosition.x+'px';logoHost.style.top=facePosition.y+'px';}
  if(mobileLogo){
    logoHost=document.createElement('button');logoHost.type='button';logoHost.className='about-mobile-logo';logoHost.dataset.editorRuntime='';
    logoHost.setAttribute('aria-label','Переместить логотип');logoHost.append(cv);about.append(logoHost);
    placeFace(Math.random()*Math.max(0,about.clientWidth-54),100+Math.random()*180);
    logoHost.addEventListener('pointerdown',e=>{e.stopPropagation();dragStart={x:e.clientX,y:e.clientY,baseX:facePosition.x,baseY:facePosition.y};logoHost.setPointerCapture(e.pointerId)});
    logoHost.addEventListener('pointermove',e=>{if(dragStart)placeFace(dragStart.baseX+e.clientX-dragStart.x,dragStart.baseY+e.clientY-dragStart.y)});
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>logoHost.addEventListener(type,()=>dragStart=null));
    logoHost.addEventListener('keydown',e=>{const delta={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[e.key];if(delta){e.preventDefault();placeFace(facePosition.x+delta[0],facePosition.y+delta[1])}});
    let tap=null;about.addEventListener('pointerdown',e=>{if(e.target.closest('a,button,input,textarea'))return;tap={x:e.clientX,y:e.clientY}});
    about.addEventListener('pointerup',e=>{if(tap&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<8){const r=about.getBoundingClientRect();placeFace(e.clientX-r.left-27,e.clientY-r.top-36)}tap=null});
    about.addEventListener('pointercancel',()=>tap=null);
  }else document.body.appendChild(cv);
  var ctx=cv.getContext('2d'), W=0,H=0,DPR=1;
  function size(){ var nd=Math.min(devicePixelRatio||1,2);
    if(W===(mobileLogo?54:innerWidth)&&H===(mobileLogo?72:innerHeight)&&DPR===nd)return;
    DPR=nd;W=mobileLogo?54:innerWidth;H=mobileLogo?72:innerHeight;
    cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0); }
  size(); addEventListener('resize',size,{passive:true});
  var mx=-100,my=-100,inAbout=false,alpha=0,cursorRaf=0;
  function wakeCursor(){if(!cursorRaf&&!document.hidden&&(inAbout||alpha>=.02))cursorRaf=requestAnimationFrame(loop);}
  addEventListener('pointermove',function(e){ if(mobileLogo)return;mx=e.clientX;my=e.clientY;
    var el=e.target; inAbout=!!(el&&el.closest&&el.closest('#about')&&!el.closest('a,button'));wakeCursor(); },{passive:true});
  addEventListener('scroll',function(){ if(mobileLogo)return;var el=document.elementFromPoint(mx,my);
    inAbout=!!(el&&el.closest&&el.closest('#about')&&!el.closest('a,button'));wakeCursor(); },{passive:true});
  var run=true;
  function loop(ts){cursorRaf=0;if(!run||document.hidden)return;size();
    ctx.clearRect(0,0,W,H);
    if(mobileLogo){var r=logoHost.getBoundingClientRect();inAbout=r.bottom>0&&r.top<innerHeight;}
    alpha+=((inAbout?1:0)-alpha)*0.25;                     /* мягкое появление/уход */
    if(alpha<0.02){alpha=0;return;}
    wakeCursor();
    var t=(ts||0)/1000;
    var blink=(t%4.6)<0.12;                                /* открытый глаз изредка моргает */
    var calm=matchMedia('(prefers-reduced-motion:reduce)').matches;
    var lox=mobileLogo?0:mx+13, loy=mobileLogo?0:my+13;
    ctx.globalAlpha=alpha;
    ctx.fillStyle='#374151';                                /* светлее, чем #111210 */
    /* Пропорции знака: 18 колонок × 14 рядов; клетка 3×4 px даёт круг 54×56 px и ножку высотой 16 px. */
    var LCX=3, LCY=4;
    for(var i=0;i<SOLID.length;i++){ var c=SOLID[i]; ctx.fillRect(lox+c[0]*LCX, loy+c[1]*LCY, LCX, LCY); }
    if(blink){ /* моргание: закрываем открытый глаз чёрточкой (заливаем дырку рядов 6-8 слева) */
      for(var bx=2;bx<=7;bx++) ctx.fillRect(lox+bx*LCX, loy+7*LCY, LCX, LCY); }
    /* слой EDGE (полутона по контуру) отключён — меньше деталей, чище силуэт */
    ctx.globalAlpha=1;
  }
  if(mobileLogo){new IntersectionObserver(function(entries){inAbout=entries.some(function(e){return e.isIntersecting;});wakeCursor();}).observe(logoHost);}
  document.addEventListener('visibilitychange',function(){run=!document.hidden;if(!run){if(cursorRaf)cancelAnimationFrame(cursorRaf);cursorRaf=0;ctx.clearRect(0,0,W,H);}else wakeCursor();});
})();
