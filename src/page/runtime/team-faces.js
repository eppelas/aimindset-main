
/* два полулица: человек (тёплое, левая половина сплошная, правая чуть дышит) и
   агент (синее, зеркальное, рассыпанная половина постоянно пересобирается).
   Ховер: человеческое мягко кивает; агентное полностью пересчитывается. */
(function(){
  var CELL=10, FSOLID=[[0,5],[0,6],[0,7],[1,3],[1,4],[1,5],[1,6],[1,7],[1,8],[1,9],[2,2],[2,3],[2,4],[2,6],[2,7],[2,8],[2,9],[2,10],[3,1],[3,2],[3,3],[3,7],[3,8],[3,9],[3,10],[3,11],[4,1],[4,2],[4,3],[4,7],[4,8],[4,9],[4,10],[4,11],[5,0],[5,1],[5,2],[5,3],[5,4],[5,5],[5,6],[5,7],[5,8],[5,9],[5,10],[5,11],[5,12],[7,5],[8,5],[9,5],[5,13],[5,14]], FDOTS=[[7,1],[7,3],[7,7],[7,9],[7,11],[8,2],[8,4],[8,6],[8,8],[8,10],[9,1],[9,3],[9,7],[9,9],[9,11],[10,2],[10,4],[10,6],[10,8],[10,10],[11,3],[11,5],[11,7],[11,9],[12,6]];
  /* Прикрытый правый глаз логотипа (EYE_ROWS выше), сведённый к сетке 10px. */
  var AGENT_SOLID=FSOLID.filter(function(p){return !(p[0]===2&&p[1]===6);}).concat([[3,4],[4,4],[3,5],[4,5]]);
  function hsh(a,b){ var n=Math.sin(a*127.1+b*311.7)*43758.5453; return n-Math.floor(n); }
  [].slice.call(document.querySelectorAll('#w19-smileys canvas.smiley')).forEach(function(cv){
    var ctx=cv.getContext('2d'), mood=cv.getAttribute('data-mood'), agent=mood==='agent';
    var col=agent?'#1FB6D1':'#C50D17', seed=1, hover=0, nod=0;
    var item=cv.closest('.team-ai-pair__item'), reduce=matchMedia('(prefers-reduced-motion:reduce)'), painted=false, lastPaint=0;
    var raf=null;
    function canPaint(){
      var bounds=cv.getBoundingClientRect();
      return !document.hidden&&bounds.bottom>=0&&bounds.top<=innerHeight&&!(painted&&reduce.matches);
    }
    function wake(){
      if(!canPaint()){if(raf!==null)cancelAnimationFrame(raf);raf=null;return;}
      if(raf===null)raf=requestAnimationFrame(loop);
    }
    reduce.addEventListener('change',function(){painted=false;wake();});
    document.addEventListener('visibilitychange',wake);
    addEventListener('scroll',wake,{passive:true});
    addEventListener('resize',wake);
    if(window.IntersectionObserver)new IntersectionObserver(wake).observe(cv);
    item.addEventListener('mouseenter',function(){ hover=1; if(agent)seed=Math.random()*100; else nod=1; });
    item.addEventListener('mouseleave',function(){ hover=0; });
    function loop(ts){
      raf=null;
      if(!canPaint())return;
      if(innerWidth<=960&&painted&&ts-lastPaint<1000/30){wake();return;}
      lastPaint=ts;painted=true;
      ctx.clearRect(0,0,156,156);
      var t=reduce.matches?0:(ts||0)/1000, oy=0;
      if(nod>0){ oy=Math.sin(nod*Math.PI*2)*6; nod-=0.02; if(nod<0)nod=0; }   /* мягкий кивок */
      var ox=(156-13*CELL)/2, oy0=(156-15*CELL)/2+oy;
      var solid=agent?AGENT_SOLID:FSOLID, ALL=solid.concat(FDOTS);
      for(var k=0;k<ALL.length;k++){
        var fx=ALL[k][0], fy=ALL[k][1], dotted=k>=solid.length;
        if(agent){ fx=12-fx; }
        var dx=0, dy=0, show=true;
        if(dotted){
          var dotKey=FSOLID.length+k-solid.length;
          var ph=hsh(dotKey,seed|0)+t*(agent?0.5:0.12);
          dx=Math.round(Math.sin(ph*6.283)*(agent?1.6:0.7));
          dy=Math.round(Math.cos(ph*4.71)*(agent?1.2:0.5));
          if(agent&&hover&&hsh(dotKey,(t*3)|0)<0.35) show=false;
        }
        if(!show)continue;
        ctx.fillStyle=col;
        ctx.globalAlpha=dotted?0.85:1;
        ctx.fillRect(ox+(fx+dx)*CELL, oy0+(fy+dy)*CELL, CELL-1, CELL-1);
      }
      wake();
    }
    loop();
  });
})();
