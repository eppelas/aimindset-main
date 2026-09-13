
/* Section content is static: no staggered scroll entrance. */
/* super-slight smooth scroll референса (только desktop-мышь) */
(function(){ if(!window.matchMedia) return;
  if(matchMedia('(hover: none)').matches || matchMedia('(pointer: coarse)').matches) return;
  var target=window.scrollY||0, cur=target, raf=0;
  function maxY(){ return Math.max(0, document.documentElement.scrollHeight - innerHeight); }
  function run(){ var d=target-cur; if(Math.abs(d)<0.4){ cur=target; window.scrollTo({top:cur,behavior:'instant'}); raf=0; return; } cur+=d*0.18; window.scrollTo({top:cur,behavior:'instant'}); raf=requestAnimationFrame(run); }
  addEventListener('wheel',function(e){ if(e.ctrlKey||e.defaultPrevented) return; if(e.target.closest&&e.target.closest('.edit-bar,textarea,[contenteditable]')) return;
    if(!raf){ cur=target=window.scrollY; } var dy=e.deltaY*(e.deltaMode===1?16:(e.deltaMode===2?innerHeight:1)); target=Math.max(0,Math.min(maxY(),target+dy)); if(!raf)raf=requestAnimationFrame(run); e.preventDefault(); },{passive:false});
  function syncNativeScroll(){ if(raf){ cancelAnimationFrame(raf); raf=0; } cur=target=window.scrollY; }
  addEventListener('hashchange',function(){ requestAnimationFrame(syncNativeScroll); });
  addEventListener('click',function(e){ if(e.target.closest&&e.target.closest('a[href^="#"]')) requestAnimationFrame(syncNativeScroll); });
  addEventListener('keydown',function(){ if(!raf){ cur=target=window.scrollY; } });
  addEventListener('resize',function(){ cur=target=window.scrollY; });
})();
