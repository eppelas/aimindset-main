
// ————— КАРТА ПРОЕКТОВ В ПОПАПЕ —————
(() => {
  const dialog = document.getElementById("ecosystemMapDialog");
  const open = document.getElementById("ecosystemMapOpen");
  const close = document.getElementById("ecosystemMapClose");
  if (!dialog || !open || !close) return;

  function openMap() {
    if (dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    requestAnimationFrame(() => close.focus({ preventScroll: true }));
  }
  function closeMap() {
    if (dialog.open) dialog.close();
  }
  open.addEventListener("click", openMap);
  open.addEventListener("pointerdown", event => {
    if (!document.body.classList.contains("editing")) return;
    event.preventDefault();
    event.stopPropagation();
    openMap();
  });
  close.addEventListener("click", closeMap);
  close.addEventListener("pointerdown", event => {
    if (!document.body.classList.contains("editing")) return;
    event.preventDefault();
    event.stopPropagation();
    closeMap();
  });
  document.addEventListener("click", event => {
    if (!document.body.classList.contains("editing")) return;
    if (event.target.closest?.("#ecosystemMapOpen")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openMap();
    } else if (event.target.closest?.("#ecosystemMapClose")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeMap();
    }
  }, true);
  dialog.addEventListener("click", event => {
    if (event.target === dialog) closeMap();
  });
})();
