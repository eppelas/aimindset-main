
/* ═══ кнопки: пиксельное мерцание на ховер (референс inline-3, __pxHover) ═══ */
(function(){
  var ACC=['#C50D17'], CELL=9;   /* один цвет хайлайта, без второго */
  function attach(b){
    if(!b||b.__pxd) return; b.__pxd=true;
    b.classList.add('w19-px');
    var lbl=document.createElement('span'); lbl.className='w19-lbl';
    while(b.firstChild) lbl.appendChild(b.firstChild);
    var fx=document.createElement('span'); fx.className='w19-fx'; fx.setAttribute('aria-hidden','true');
    b.appendChild(fx); b.appendChild(lbl);
    var cells=[];
    function build(){
      fx.textContent=''; cells=[];
      var cols=Math.ceil(b.offsetWidth/CELL), rows=Math.ceil(b.offsetHeight/CELL);
      fx.style.gridTemplateColumns='repeat('+cols+','+CELL+'px)'; fx.style.gridAutoRows=CELL+'px';
      for(var i=0;i<cols*rows;i++){ cells.push(fx.appendChild(document.createElement('i'))); }
    }
    build();
    if(window.ResizeObserver) new ResizeObserver(build).observe(b);
    var timer=null;
    /* не резкий сброс узора, а «звёздочки» — по одной клетке зажигается, живёт ~1.5–2.5 с и мягко гаснет */
    function spark(){ if(!cells.length) return; var el=cells[(Math.random()*cells.length)|0]; if(el.__on) return;
      /* Keep the animated pixels outside the label in every button state. */
      var pixel=el.getBoundingClientRect(), label=lbl.getBoundingClientRect();
      if(pixel.right>label.left-2&&pixel.left<label.right+2&&pixel.bottom>label.top-2&&pixel.top<label.bottom+2) return;
      el.__on=1; el.style.background=ACC[0];
      setTimeout(function(){ el.style.background='transparent'; el.__on=0; }, 1500+Math.random()*1000); }
    function clear(){ for(var i=0;i<cells.length;i++){ cells[i].style.background='transparent'; cells[i].__on=0; } }
    b.addEventListener('mouseenter', function(){ if(timer) return; spark(); timer=setInterval(spark,280); });
    b.addEventListener('mouseleave', function(){ clearInterval(timer); timer=null; clear(); });
  }
  [].slice.call(document.querySelectorAll('a.btn, button:not(.tt-close):not(.space-schedule__toggle):not(.ecosystem-direction-effect):not(.back-to-top)')).forEach(function(b){
    if(b.closest('aim-site-header')||b.offsetWidth<40) return; attach(b);
  });
  window.__w19pxHover=attach;
})();

/* ═══ пикселизация команды: вся карточка — зона взаимодействия, цвет берём из её фото ═══ */
(function(){
  var cards=[].slice.call(document.querySelectorAll('#team .team-member'));
  if(!cards.length) return;
  var cv=document.createElement('canvas'); cv.id='team-pixel-effect'; cv.setAttribute('aria-hidden','true');
  cv.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:5;pointer-events:none;';
  document.body.appendChild(cv);
  var ctx=cv.getContext('2d'), DPR=Math.min(devicePixelRatio||1,2), W=0,H=0, BL=14, target=null;
  var off=document.createElement('canvas'), offc=off.getContext('2d',{willReadFrequently:true});
  var raf=0,sampleKey='',sampleImage=null,sampleData=null;
  function wake(){if(!raf&&target&&!document.hidden)raf=requestAnimationFrame(loop);}
  function suspend(){if(raf)cancelAnimationFrame(raf);raf=0;if(painted){ctx.clearRect(0,0,W,H);painted=false;}}
  function size(){ if(W===innerWidth&&H===innerHeight)return; W=innerWidth; H=innerHeight; cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR); ctx.setTransform(DPR,0,0,DPR,0,0); }
  size(); addEventListener('resize',size);
  cards.forEach(function(card){
    var image=card.querySelector('img'); if(!image)return;
    image.addEventListener('load',function(){if(sampleImage===image){sampleImage=null;sampleKey='';}if(target&&target.image===image)wake();});
    card.addEventListener('mouseenter',function(){if(innerWidth>960){target={card:card,image:image};wake();}});
    card.addEventListener('mouseleave',function(){if(innerWidth>960&&target&&target.card===card){target=null;suspend();}});
  });
  function hsh(a){ var n=Math.sin(a)*43758.5453; return n-Math.floor(n); }
  document.addEventListener('aim:team-effect',function(e){
    var d=e.detail;if(!d||!cards.includes(d.card))return;
    if(d.hint&&target&&!target.hint)return;
    target={card:d.card,image:d.card.querySelector('img'),until:performance.now()+d.duration,hint:d.hint};wake();
  });
  var painted=false,lastFrame=0;
  function loop(ts){
    raf=0;
    if(target&&target.until&&ts>=target.until)target=null;
    if(!target||document.hidden){if(painted){ctx.clearRect(0,0,W,H);painted=false;}return;}
    if(innerWidth<=960&&ts-lastFrame<1000/30){wake();return;}lastFrame=ts||0;
    ctx.clearRect(0,0,W,H);painted=true;
    if(target){ var cardRect=target.card.getBoundingClientRect(), image=target.image, r=image.getBoundingClientRect(), mw=image.naturalWidth, mh=image.naturalHeight;
      if(r.width>0 && r.bottom>0 && r.top<H && mw && mh){
        var cols=Math.floor(r.width/BL), rows=Math.floor(r.height/BL);
        if(cols>=2&&rows>=2){
          if(off.width!==cols||off.height!==rows){ off.width=cols; off.height=rows; }
          var sc=Math.max(r.width/mw, r.height/mh), cw=r.width/sc, ch=r.height/sc;
          try{
            var key=[image.currentSrc||image.src,mw,mh,cw,ch,cols,rows].join('|');
            if(sampleImage!==image||sampleKey!==key){offc.drawImage(image,(mw-cw)/2,(mh-ch)/2,cw,ch,0,0,cols,rows);sampleData=offc.getImageData(0,0,cols,rows).data;sampleImage=image;sampleKey=key;}
            var data=sampleData;
            var step=Math.floor((ts||0)/90), reach=Math.min(cols,rows)*0.62, s=BL-1;
            for(var j=0;j<rows;j++)for(var i=0;i<cols;i++){
              var dcx=Math.min(i,cols-1-i), dcy=Math.min(j,rows-1-j), d=Math.sqrt(dcx*dcx+dcy*dcy);
              var p=1-d/reach; if(p<=0) continue; p*=p; if(target.hint)p*=.2;
              if(hsh(i*12.9+j*78.2+step*3.1) > p) continue;
              var k=(j*cols+i)*4;
              ctx.fillStyle='rgb('+data[k]+','+data[k+1]+','+data[k+2]+')';
              ctx.fillRect(Math.round(r.left)+i*BL, Math.round(r.top)+j*BL, s, s); }
            /* Фото распадается дальше в тело карточки; русло поверх этих
               редких клеток собирает уже символьную часть деятельности. */
            var spread=Math.max(0,cardRect.right-r.right), streamCols=Math.ceil(spread/BL);
            for(var q=0;q<streamCols;q++)for(var lane=0;lane<2;lane++){
              var sx=r.right+q*BL, sy=r.top+r.height*(0.32+lane*0.34)+Math.sin(q*.72+lane*2.4+(ts||0)*.0024)*BL*1.25;
              var fade=1-q/Math.max(1,streamCols), gate=hsh(q*19.1+lane*7.7+Math.floor((ts||0)/140));
              if(gate>fade*.72)continue;
              var sampleRow=Math.max(0,Math.min(rows-1,Math.floor((sy-r.top)/r.height*rows))), sampleCol=Math.max(0,cols-1-q%Math.max(1,cols)), sk=(sampleRow*cols+sampleCol)*4;
              ctx.globalAlpha=(.10+.22*fade)*(target.hint?.2:1);
              ctx.fillStyle='rgb('+data[sk]+','+data[sk+1]+','+data[sk+2]+')';
              ctx.fillRect(Math.round(sx/BL)*BL,Math.round(sy/BL)*BL,s,s);
            }
            ctx.globalAlpha=1;
          }catch(e){}
        } } }
    wake();}
  document.addEventListener('visibilitychange',function(){if(document.hidden)suspend();else wake();});
})();
