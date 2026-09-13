
/* dev-навигация для проверок: ?peek=team открывает страницу сразу на секции */
(() => {
  const id = new URLSearchParams(location.search).get("peek");
  if (!id) return;
  addEventListener("DOMContentLoaded", () => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + scrollY - 80;
    document.querySelector("main").style.marginTop = (-y) + "px";
  });
})();
