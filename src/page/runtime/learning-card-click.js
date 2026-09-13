
document.querySelectorAll('#learning .program-card').forEach(card=>{
 card.addEventListener('click',event=>{
  if(event.target.closest('a,button,input,select,textarea,label')||window.getSelection()?.toString())return;
  card.querySelector('.program-card__footer .waitlist-open,.program-card__footer a')?.click();
 });
});
