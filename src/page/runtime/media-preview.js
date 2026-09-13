
/* Общий медиапросмотр: hover/фокус, без изменения размеров самой карточки. */
(function(){
  var desktop=matchMedia('(min-width:901px) and (hover:hover)'), reduced=matchMedia('(prefers-reduced-motion:reduce)');
  var cards=[].slice.call(document.querySelectorAll('.project-card'));
  function close(card){
    card.classList.remove('is-project-preview','is-motion-playing');
    var video=card.querySelector('.project-motion');
    if(video){video.pause();if(video.readyState)video.currentTime=0;}
  }
  function closeAll(){cards.forEach(close);}
  function position(card){
    var art=card.querySelector('.project-art'),r=art.getBoundingClientRect(),pad=16;
    var scale=Math.min(2,640/r.width,(innerWidth-pad*2)/r.width,(innerHeight-pad*2)/r.height);
    var x=Math.max(pad,Math.min(r.left+r.width*(1-scale)/2,innerWidth-pad-r.width*scale));
    var y=Math.max(pad,Math.min(r.top+r.height*(1-scale)/2,innerHeight-pad-r.height*scale));
    card.style.setProperty('--preview-scale',scale);
    card.style.setProperty('--preview-x',(x-r.left)+'px');
    card.style.setProperty('--preview-y',(y-r.top)+'px');
  }
  function open(card){
    if(!desktop.matches||document.hidden)return;
    cards.forEach(function(other){if(other!==card)close(other);});
    position(card);
    card.classList.add('is-project-preview');
    var video=card.querySelector('.project-motion');
    if(video&&!reduced.matches){video.muted=true;video.defaultMuted=true;video.playsInline=true;video.play().then(function(){if(card.classList.contains('is-project-preview'))card.classList.add('is-motion-playing');else video.pause();}).catch(function(){card.classList.remove('is-motion-playing');});}
  }
  cards.forEach(function(card){
    card.addEventListener('pointerenter',function(e){if(e.pointerType==='mouse')open(card);});
    card.addEventListener('pointermove',function(e){if(e.pointerType==='mouse'&&!card.classList.contains('is-project-preview'))open(card);});
    card.addEventListener('pointerleave',function(){if(!card.contains(document.activeElement))close(card);});
    card.addEventListener('focusin',function(){requestAnimationFrame(function(){requestAnimationFrame(function(){if(card.contains(document.activeElement))open(card);});});});
    card.addEventListener('focusout',function(e){if(!card.contains(e.relatedTarget))close(card);});
    var video=card.querySelector('.project-motion');
    if(video){video.addEventListener('error',function(){card.classList.remove('is-motion-playing');});video.addEventListener('waiting',function(){card.classList.remove('is-motion-playing');});video.addEventListener('playing',function(){if(card.classList.contains('is-project-preview'))card.classList.add('is-motion-playing');});}
  });
  addEventListener('keydown',function(e){if(e.key==='Escape')closeAll();});
  addEventListener('scroll',function(){
    cards.forEach(function(card){
      if(card.classList.contains('is-project-preview')){
        var r=card.querySelector('.project-art').getBoundingClientRect();
        if(r.bottom<=0||r.top>=innerHeight)close(card);
        else position(card);
      }else close(card);
    });
  },{passive:true});
  addEventListener('resize',closeAll,{passive:true});
  document.addEventListener('visibilitychange',function(){if(document.hidden)closeAll();});
  desktop.addEventListener('change',closeAll);reduced.addEventListener('change',closeAll);
})();
