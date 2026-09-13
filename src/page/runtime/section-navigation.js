
// ————— ПРАВАЯ НАВИГАЦИЯ И ХАРДКОД ПОРЯДКА СЕКЦИЙ —————
(() => {
  const main = document.querySelector("main");
  const rail = document.getElementById("sectionRail");
  const list = rail?.querySelector(".section-rail-list");
  const tabsWrap = document.querySelector(".tabs .wrap");
  if (!main || !rail || !list || !tabsWrap) return;

  const isEditing = () => document.body.classList.contains("editing");
  const items = () => Array.from(list.querySelectorAll(":scope > .section-rail-item[data-section-id]"));
  const sectionOf = item => main.querySelector(`:scope > section#${CSS.escape(item.dataset.sectionId || "")}`);
  let drag = null;

  function idsFromRail() {
    return items().map(item => item.dataset.sectionId);
  }

  function isExactSectionOrder(ids) {
    const actual = Array.from(main.querySelectorAll(":scope > section[id]")).map(section => section.id);
    return ids.length === actual.length && new Set(ids).size === ids.length && actual.every(id => ids.includes(id));
  }

  function syncIndexes() {
    items().forEach((item, index) => {
      const label = item.querySelector(".section-rail-index");
      if (label) label.textContent = String(index).padStart(2, "0");
    });
    syncSectionNumbers();
  }

  // Номер — свойство позиции, имя — свойство секции: видимые «NN ·» в шапках
  // пересчитываются по фактическому порядку. Секции без подписи номер не занимают.
  const SECTION_NUM_RE = /^\d+[A-Za-zА-Яа-я]?(\s*·\s*)/;
  function syncSectionNumbers() {
    let index = 0;
    main.querySelectorAll(":scope > section[id]").forEach(section => {
      const span = section.querySelector(".sec-head .num");
      if (!span || !SECTION_NUM_RE.test(span.textContent)) return;
      const prefix = String(++index).padStart(2, "0");
      const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (SECTION_NUM_RE.test(node.nodeValue)) {
          node.nodeValue = node.nodeValue.replace(SECTION_NUM_RE, `${prefix}$1`);
          break;
        }
      }
    });
  }

  function syncTopNavigation(ids) {
    const links = Array.from(tabsWrap.querySelectorAll(":scope > a[href^='#']"));
    const linksById = new Map();
    links.forEach(link => {
      const fallbackId = decodeURIComponent(link.getAttribute("href").slice(1));
      const coveredIds = (link.dataset.sections || fallbackId).trim().split(/\s+/);
      coveredIds.forEach(id => linksById.set(id, link));
    });
    const appended = new Set();
    ids.forEach(id => {
      const link = linksById.get(id);
      if (link && !appended.has(link)) {
        tabsWrap.append(link);
        appended.add(link);
      }
    });
    links.filter(link => !appended.has(link)).forEach(link => tabsWrap.append(link));
  }

  function linkCoversSection(link, id) {
    const hrefId = decodeURIComponent((link.getAttribute("href") || "").replace(/^#/, ""));
    return (link.dataset.sections || hrefId).trim().split(/\s+/).includes(id);
  }

  function setCurrentNavigation(id) {
    Array.from(tabsWrap.querySelectorAll(":scope > a[href^='#']")).forEach(link => {
      const current = linkCoversSection(link, id);
      link.classList.toggle("is-current", current);
      if (current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  function applySectionOrder(ids, announce = true) {
    if (!isExactSectionOrder(ids)) return false;
    const sections = new Map(Array.from(main.querySelectorAll(":scope > section[id]")).map(section => [section.id, section]));
    const railItems = new Map(items().map(item => [item.dataset.sectionId, item]));
    ids.forEach(id => {
      main.append(sections.get(id));
      list.append(railItems.get(id));
    });
    syncTopNavigation(ids);
    syncIndexes();
    if (announce) document.dispatchEvent(new CustomEvent("site:changed", { detail: { message: "● порядок разделов изменён — сохраните его" } }));
    return true;
  }

  function clearDragState() {
    items().forEach(item => {
      item.classList.remove("is-dragging", "is-drop-before", "is-drop-after");
      item.removeAttribute("aria-grabbed");
    });
  }

  function itemAtPoint(x, y) {
    const hit = document.elementFromPoint(x, y);
    if (!(hit instanceof Element)) return null;
    const item = hit.closest(".section-rail-item[data-section-id]");
    return item && list.contains(item) ? item : null;
  }

  function proposedOrder(dragged, target, after) {
    const ids = idsFromRail().filter(id => id !== dragged.dataset.sectionId);
    const targetIndex = ids.indexOf(target.dataset.sectionId);
    if (targetIndex < 0) return null;
    ids.splice(targetIndex + (after ? 1 : 0), 0, dragged.dataset.sectionId);
    return ids;
  }

  list.addEventListener("pointerdown", ev => {
    if (!isEditing() || ev.button !== 0) return;
    const handle = ev.target.closest(".section-drag-handle");
    const item = handle?.closest(".section-rail-item[data-section-id]");
    if (!handle || !item || !sectionOf(item)) return;
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
    const rect = target.getBoundingClientRect();
    drag.after = ev.clientY > rect.top + rect.height / 2;
    drag.target = target;
    target.classList.toggle("is-drop-before", !drag.after);
    target.classList.toggle("is-drop-after", drag.after);
    ev.preventDefault();
  }, true);

  list.addEventListener("pointerup", ev => {
    if (!drag || drag.pointerId !== ev.pointerId) return;
    try { drag.handle.releasePointerCapture(ev.pointerId); } catch {}
    if (drag.active && drag.target) {
      const ids = proposedOrder(drag.item, drag.target, drag.after);
      if (ids) applySectionOrder(ids);
    }
    clearDragState();
    drag = null;
  }, true);

  list.addEventListener("pointercancel", () => {
    clearDragState();
    drag = null;
  }, true);

  list.addEventListener("keydown", ev => {
    if (!isEditing() || !ev.target.matches(".section-drag-handle") || !ev.altKey) return;
    if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;
    const item = ev.target.closest(".section-rail-item[data-section-id]");
    const all = items();
    const from = all.indexOf(item);
    const to = ev.key === "ArrowUp" ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= all.length) return;
    const ids = idsFromRail();
    [ids[from], ids[to]] = [ids[to], ids[from]];
    if (applySectionOrder(ids)) ev.target.focus();
    ev.preventDefault();
  });

  const actualSections = Array.from(main.querySelectorAll(":scope > section[id]"));
  let navFrame = 0;
  function updateCurrentSection() {
    navFrame = 0;
    const sections = Array.from(main.querySelectorAll(":scope > section[id]"));
    const tabsBottom = document.querySelector(".tabs")?.getBoundingClientRect().bottom || 0;
    const probe = tabsBottom + Math.min(48, innerHeight * .07);
    /* активна та секция, что занимает БОЛЬШЕ всего экрана (если хоть одна ≥35% высоты);
       иначе — та, что под линией сразу за табами. */
    let current = null, bestArea = 0;
    sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      const visible = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, tabsBottom));
      if (visible > bestArea) { bestArea = visible; current = section; }
    });
    if (!current || bestArea < (innerHeight - tabsBottom) * .35) current = sections.find(section => {
      const rect = section.getBoundingClientRect();
      return rect.top <= probe && rect.bottom > probe;
    });
    if (!current) {
      current = sections.filter(section => section.getBoundingClientRect().top <= probe).at(-1) || sections[0];
    }
    if (!current) return;
    items().forEach(item => item.classList.toggle("is-current", item.dataset.sectionId === current.id));
    setCurrentNavigation(current.id);
  }
  function queueCurrentSection() {
    if (!navFrame) navFrame = requestAnimationFrame(updateCurrentSection);
  }
  addEventListener("scroll", queueCurrentSection, { passive: true });
  addEventListener("resize", queueCurrentSection, { passive: true });
  addEventListener("hashchange", queueCurrentSection);
  syncTopNavigation(actualSections.map(section => section.id));
  syncIndexes();
  updateCurrentSection();
})();
