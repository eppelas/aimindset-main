// Return to the actual origin of an internal navigation, including its viewport position.
(()=>{
 if(document.getElementById('backToTop'))return;
 const template=document.createElement('template');
 template.innerHTML="<a class=\"back-to-top\" id=\"backToTop\" href=\"#hero\" aria-label=\"Вернуться наверх\" aria-hidden=\"true\" tabindex=\"-1\" data-editor-ui=\"\">\n  <span class=\"back-to-top__arrow\" aria-hidden=\"true\">↑</span><span>наверх</span>\n</a>";
 const control=template.content.firstElementChild;
 control.href=document.getElementById('hero')?'#hero':'#top';
 document.body.append(control);
 const origins=[];
 function update(){const visible=origins.length>0;document.body.classList.toggle('show-back-to-top',visible);control.setAttribute('aria-hidden',String(!visible));control.tabIndex=visible?0:-1;}
 document.addEventListener('click',e=>{
  const a=e.target.closest?.('a[href^="#"],[data-hero-waitlist]');if(!a||a===control||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==='_blank')return;
  const href=a.getAttribute('href')||'#learning';if(href.length<2||!document.getElementById(href.slice(1)))return;
  const card=a.closest('.ecosystem-direction-card'),section=a.closest('main>section');
  const origin=card||section||null;
  const inMobileMenu=!!a.closest('.aim-mobile-menu');
  const y=inMobileMenu&&document.body.style.position==='fixed'?-parseFloat(document.body.style.top||'0'):scrollY;
  origins.push({el:origin,y,offset:origin?origin.getBoundingClientRect().top:0,hash:location.hash,
    focus:inMobileMenu?document.querySelector('.mobile-menu-trigger'):a});
  control.setAttribute('aria-label',card?'Вернуться к выбранному направлению':'Вернуться к месту перехода');
  control.href=card?'#products':section?'#'+section.id:(document.getElementById('hero')?'#hero':'#top');update();
 },true);
 control.addEventListener('click',e=>{
  e.preventDefault();const source=origins.pop();if(!source){scrollTo({top:0,behavior:'instant'});return;}
  const top=source.el?.isConnected?source.el.getBoundingClientRect().top+scrollY-source.offset:source.y;
  history.replaceState(history.state,'',source.hash||location.pathname+location.search);
  scrollTo({top,behavior:'instant'});if(source.focus?.isConnected)source.focus.focus({preventScroll:true});update();
 });update();
})();
