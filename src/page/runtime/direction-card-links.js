
/* клик по тексту карточки направления ведёт туда же, куда стрелка (сцена под кнопкой остаётся интерактивной) */
document.querySelectorAll('.ecosystem-direction-card .ecosystem-direction-copy').forEach(function(copy){
  copy.addEventListener('click',function(e){ if(e.target.closest('a')) return; var a=copy.querySelector('a.ecosystem-direction-arrow'); if(a) a.click(); });
});
