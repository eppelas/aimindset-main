
// ————— ЛОКАЛЬНАЯ ПЕРЕСТАНОВКА ПРОДУКТОВ —————
(() => {
  const list = document.getElementById("productBlocks");
  if (!list) return;
  const isEditing = () => document.body.classList.contains("editing");
  const items = () => Array.from(list.querySelectorAll(":scope > .product-block[data-product-block]"));
  let drag = null;

  function clearState() {
    items().forEach(item => {
      item.classList.remove("is-dragging", "is-drop-before", "is-drop-after");
      item.removeAttribute("aria-grabbed");
    });
  }

  function itemAtPoint(x, y) {
    const hit = document.elementFromPoint(x, y);
    if (!(hit instanceof Element)) return null;
    const item = hit.closest(".product-block[data-product-block]");
    return item && list.contains(item) ? item : null;
  }

  function isAfter(target, x, y) {
    const rect = target.getBoundingClientRect();
    const sameRow = drag && Math.abs(drag.item.getBoundingClientRect().top - rect.top) < Math.min(rect.height, drag.item.getBoundingClientRect().height) * .45;
    return sameRow ? x > rect.left + rect.width / 2 : y > rect.top + rect.height / 2;
  }

  function moveItem(item, target, after) {
    if (!item || !target || item === target) return;
    if (after) target.after(item); else target.before(item);
    document.dispatchEvent(new CustomEvent("site:changed", { detail: { message: "● порядок продуктов изменён — сохраните его" } }));
  }

  list.addEventListener("pointerdown", ev => {
    if (!isEditing() || ev.button !== 0) return;
    const handle = ev.target.closest(".product-block-drag-handle");
    const item = handle?.closest(".product-block[data-product-block]");
    if (!handle || !item) return;
    drag = { handle, item, pointerId: ev.pointerId, x: ev.clientX, y: ev.clientY, active: false, target: null, after: false };
    item.setAttribute("aria-grabbed", "true");
    try { handle.setPointerCapture(ev.pointerId); } catch {}
    ev.preventDefault();
    ev.stopPropagation();
  }, true);

  list.addEventListener("pointermove", ev => {
    if (!drag || drag.pointerId !== ev.pointerId || !isEditing()) return;
    if (!drag.active && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 4) return;
    drag.active = true;
    drag.item.classList.add("is-dragging");
    items().forEach(item => item.classList.remove("is-drop-before", "is-drop-after"));
    const target = itemAtPoint(ev.clientX, ev.clientY);
    if (!target || target === drag.item) { drag.target = null; return; }
    drag.after = isAfter(target, ev.clientX, ev.clientY);
    drag.target = target;
    target.classList.toggle("is-drop-before", !drag.after);
    target.classList.toggle("is-drop-after", drag.after);
    ev.preventDefault();
  }, true);

  list.addEventListener("pointerup", ev => {
    if (!drag || drag.pointerId !== ev.pointerId) return;
    try { drag.handle.releasePointerCapture(ev.pointerId); } catch {}
    if (drag.active && drag.target) moveItem(drag.item, drag.target, drag.after);
    clearState();
    drag = null;
  }, true);

  list.addEventListener("pointercancel", () => { clearState(); drag = null; }, true);

  list.addEventListener("keydown", ev => {
    if (!isEditing() || !ev.target.matches(".product-block-drag-handle") || !ev.altKey) return;
    if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;
    const item = ev.target.closest(".product-block[data-product-block]");
    const all = items();
    const from = all.indexOf(item);
    const to = ev.key === "ArrowUp" ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= all.length) return;
    const target = all[to];
    if (ev.key === "ArrowUp") target.before(item); else target.after(item);
    document.dispatchEvent(new CustomEvent("site:changed", { detail: { message: "● порядок продуктов изменён — сохраните его" } }));
    ev.target.focus();
    ev.preventDefault();
  });
})();
