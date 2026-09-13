/* Fit the user-selected 100px headline using the donor's actual font measurement. */
(() => {
  const roots=[...document.querySelectorAll('.approved-hero')];
  const context=document.createElement('canvas').getContext('2d');
  if(!context)return;
  function fit(){roots.forEach(root=>{
    const title=root.querySelector('.hero-title'),style=getComputedStyle(title);
    let maximum=innerWidth<=700?48:100;
    context.font=`${style.fontWeight} 100px ${style.fontFamily}`;
    const tracking=parseFloat(style.letterSpacing)/parseFloat(style.fontSize)*100||0;
    // Keep the selected title lines intact as their columns shrink, including nonbreaking phrases.
    const words=[...title.querySelectorAll('.title-line')].map(line=>line.textContent.trim());
    const widest=Math.max(...words.map(word=>context.measureText(word).width+(word.length-1)*tracking));
    if(widest>0)maximum=Math.min(maximum,Math.floor(title.clientWidth/widest*100/2)*2);
    root.style.setProperty('--review-size',Math.max(innerWidth<=700?24:40,maximum)+'px');
  });}
  fit();
  const faces=roots.map(root=>{const s=getComputedStyle(root.querySelector('.hero-title'));return document.fonts.load(`${s.fontWeight} 100px ${s.fontFamily}`,'кмдлжй');});
  Promise.all(faces).then(fit);document.fonts.ready.then(fit);
  addEventListener('resize',fit);
})();
