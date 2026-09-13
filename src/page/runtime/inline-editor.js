
// ————— ОБВЯЗКА РЕДАКТИРОВАНИЯ v3 —————
// Редактор: автоматическое определение текстовых полей, пробел/enter
// в contenteditable, блокировка кликов, ревизии и проверка сохранённой записи.
(() => {
  const desktopEditing = () => matchMedia('(min-width:1101px) and (hover:hover) and (pointer:fine)').matches;
  if (!desktopEditing()) return;
  const NBSP = " ";
  const ANCHOR = "\u200B";
  const INTERACTIVE = "a, button, summary, label, [role='button']";
  const toggle = document.getElementById("editToggle");
  const duplicate = document.getElementById("editDuplicate");
  const save = document.getElementById("editSave");
  const variantLink = document.getElementById("editVariantLink");
  const status = document.getElementById("editStatus");
  const remoteApi = (document.querySelector('meta[name="aim-edit-api"]')?.content || "").replace(/\/+$/, "");
  const editorObject = document.querySelector('meta[name="aim-edit-object"]')?.content || "index.html";
  const mapFrame = document.querySelector(".ecosystem-embed-frame");
  const mapEditingAllowed = editorObject === "wild/index.html";
  let enabled = false;
  let dirty = false;
  let mapDirty = false;
  let mapReady = false;
  let mapRequestSeq = 0;
  const pendingMapSaves = new Map();
  let refreshTimer = 0;
  let recheckTimer = 0;
  let duplicating = false;

  const myRev = () => Number(document.documentElement.dataset.rev || 0);
  const t = () => new Date().toTimeString().slice(0, 8);
  function setStatus(text, isError = false, detail = "") {
    status.textContent = text;
    status.title = detail || text;
    status.classList.toggle("is-error", !!isError);
  }
  function sendMapState() {
    if (!mapFrame?.contentWindow || !mapReady) return;
    mapFrame.contentWindow.postMessage({ type: "aim-map:state", context: editorObject, editing: enabled && mapEditingAllowed }, "*");
  }
  function saveMapIfNeeded() {
    if (!mapDirty) return Promise.resolve(null);
    if (!mapReady || !mapFrame?.contentWindow) return Promise.reject(new Error("карта ещё не загрузилась — подождите секунду и сохраните снова"));
    const requestId = "map-" + (++mapRequestSeq) + "-" + Date.now();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingMapSaves.delete(requestId);
        reject(new Error("карта не ответила на сохранение"));
      }, 25000);
      pendingMapSaves.set(requestId, { resolve, reject, timer });
      mapFrame.contentWindow.postMessage({ type: "aim-map:save", context: editorObject, requestId }, "*");
    });
  }
  window.addEventListener("message", event => {
    if (!mapFrame || event.source !== mapFrame.contentWindow || !event.data || typeof event.data !== "object") return;
    if (event.data.type === "aim-map:ready") {
      mapReady = true;
      sendMapState();
      return;
    }
    if (event.data.type === "aim-map:dirty" && mapEditingAllowed) {
      mapDirty = true;
      markDirty("● карта изменена — не сохранено");
      return;
    }
    if (event.data.type === "aim-map:save-result") {
      const pending = pendingMapSaves.get(event.data.requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingMapSaves.delete(event.data.requestId);
      if (event.data.ok) {
        mapDirty = false;
        pending.resolve(event.data);
      } else pending.reject(new Error(event.data.error || "карта не сохранилась"));
    }
  });
  mapFrame?.addEventListener("load", () => {
    mapReady = false;
    setTimeout(() => {
      mapReady = true;
      sendMapState();
    }, 300);
  });

  // ——— авто-детект редактируемых ———
  function hasOwnText(node) {
    return Array.from(node.childNodes).some(c => c.nodeType === Node.TEXT_NODE && c.textContent.replaceAll(ANCHOR, "").trim());
  }
  function hasElementChildren(node) {
    return Array.from(node.children).some(c => c instanceof HTMLElement && !c.matches("br, wbr"));
  }
  function hasLayoutBox(node) {
    if (node.hidden || !node.getClientRects().length) return false;
    const st = getComputedStyle(node);
    return st.display !== "none" && st.visibility !== "hidden" && st.opacity !== "0";
  }
  function isEditableCandidate(node) {
    if (!(node instanceof HTMLElement) || node.matches("br, wbr")) return false;
    if (node.closest(".edit-bar, [data-editor-ui], header, footer, #learning, #aim-mobile-menu, script, style, svg, canvas, input, textarea, select, option, iframe, video, audio")) return false;
    const known = node.matches("p, h1, h2, h3, h4, h5, h6, summary, dt, dd, li, figcaption, blockquote, span, a, b, i, em, strong, button");
    if (!node.textContent.trim() && !known) return false;
    if (!hasLayoutBox(node)) return false;
    if (hasOwnText(node)) return true;
    return known && !hasElementChildren(node);
  }
  function collectEditables() {
    return Array.from(document.querySelectorAll("body *")).filter(isEditableCandidate);
  }
  function ensureAnchor(el) {
    const empty = !el.textContent.replaceAll(ANCHOR, "").trim() && !Array.from(el.children).some(c => !c.matches("br, wbr"));
    if (!empty) return;
    if (!el.textContent.includes(ANCHOR)) el.appendChild(document.createTextNode(ANCHOR));
  }
  function applyMarkers() {
    if (!enabled) return;
    const set = new Set(collectEditables());
    document.querySelectorAll("[data-editable]").forEach(el => {
      if (set.has(el)) return;
      el.removeAttribute("contenteditable"); el.removeAttribute("data-editable"); el.removeAttribute("spellcheck");
    });
    set.forEach(el => {
      el.setAttribute("contenteditable", "true");
      el.setAttribute("data-editable", "");
      el.setAttribute("spellcheck", "true");
      ensureAnchor(el);
    });
  }
  function clearMarkers() {
    document.querySelectorAll("[data-editable]").forEach(el => {
      el.removeAttribute("contenteditable"); el.removeAttribute("data-editable"); el.removeAttribute("spellcheck");
    });
  }
  const observer = new MutationObserver(muts => {
    if (!enabled) return;
    if (!muts.some(m => [...m.addedNodes, ...m.removedNodes].some(n => {
      const el = n instanceof Element ? n : n.parentElement;
      return el && !el.closest(".edit-bar, [data-editor-ui]");
    }))) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(applyMarkers, 40);
  });

  // ——— вставка текста/переноса ———
  function getEditableTarget(ev) {
    return ev.target instanceof Element ? ev.target.closest("[data-editable]") : null;
  }
  function editableFromSelection() {
    const sel = getSelection();
    if (!sel || !sel.rangeCount) return null;
    const node = sel.anchorNode;
    const el = node instanceof Element ? node : node?.parentElement;
    return el?.closest?.("[data-editable]") || null;
  }
  function getActiveEditable(ev) {
    const fromEvent = ev ? getEditableTarget(ev) : null;
    if (fromEvent) return fromEvent;
    const a = document.activeElement;
    const fromActive = a instanceof Element ? a.closest("[data-editable]") : null;
    return fromActive || editableFromSelection();
  }
  function lock(ev) { ev.preventDefault(); ev.stopImmediatePropagation(); }
  function ensureCaretInside(editable) {
    const sel = getSelection();
    if (!sel) return null;
    let range = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (!range || !editable.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(editable); range.collapse(false);
      sel.removeAllRanges(); sel.addRange(range);
    }
    return sel;
  }
  function insertTextManual(editable, text) {
    const sel = getSelection(); if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const frag = document.createDocumentFragment();
    let lastNode = null;
    String(text).split("\n").forEach((line, index) => {
      if (index) { const br = document.createElement("br"); frag.appendChild(br); lastNode = br; }
      const node = document.createTextNode(line);
      frag.appendChild(node); lastNode = node;
    });
    range.insertNode(frag);
    if (lastNode) range.setStartAfter(lastNode);
    range.collapse(true);
    sel.removeAllRanges(); sel.addRange(range);
  }
  function insertText(editable, text) {
    ensureAnchor(editable);
    editable.focus({ preventScroll: true });
    if (!ensureCaretInside(editable)) return;
    // execCommand пишет правку в нативный undo-стек — тогда Cmd/Ctrl+Z откатывает и вставку, и пробелы
    const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const lines = String(text).split("\n");
    let html = lines.map(esc).join("<br>");
    if (lines.length > 1 && !lines[lines.length - 1]) html += ANCHOR;   // хвостовой перенос: каретка должна уйти за <br>
    const ok = lines.length === 1 ? document.execCommand("insertText", false, text) : document.execCommand("insertHTML", false, html);
    if (!ok) insertTextManual(editable, text);
    editable.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  }
  function insertBreak(editable) {
    ensureAnchor(editable);
    editable.focus({ preventScroll: true });
    if (!ensureCaretInside(editable)) return;
    // нативный перенос — тоже в undo-стек
    if (!document.execCommand("insertHTML", false, "<br>" + ANCHOR)) {
      const sel = getSelection();
      const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      if (range) {
        range.deleteContents();
        const br = document.createElement("br");
        range.insertNode(br);
        const anchor = document.createTextNode(ANCHOR);
        br.after(anchor);
        range.setStart(anchor, ANCHOR.length); range.collapse(true);
        sel.removeAllRanges(); sel.addRange(range);
      }
    }
    editable.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertLineBreak", data: null }));
  }
  function caretFromPoint(x, y) {
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (!pos) return null;
      const r = document.createRange();
      r.setStart(pos.offsetNode, pos.offset); r.collapse(true);
      return r;
    }
    return null;
  }
  function placeCaret(editable, ev) {
    ensureAnchor(editable);
    editable.focus({ preventScroll: true });
    const sel = getSelection();
    if (!sel) return;
    let range = null;
    if (Number.isFinite(ev.clientX)) {
      const pr = caretFromPoint(ev.clientX, ev.clientY);
      if (pr && editable.contains(pr.startContainer)) range = pr;
    }
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(editable); range.collapse(false);
    }
    sel.removeAllRanges(); sel.addRange(range);
  }
  function hasSelectionInside(editable) {
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return false;
    return editable.contains(sel.anchorNode) && editable.contains(sel.focusNode) && String(sel).length > 0;
  }

  // ——— capture-глушители: клики не переходят, summary не схлопывается, пробел печатается ———
  document.addEventListener("click", ev => {
    if (!enabled || ev.target.closest(".edit-bar, .section-drag-handle, .product-block-drag-handle, .ecosystem-map-open, .ecosystem-map-dialog__close")) return;
    if (getEditableTarget(ev) || ev.target.closest(INTERACTIVE)) lock(ev);
  }, true);
  document.addEventListener("pointerdown", ev => {
    if (!enabled || ev.target.closest(".edit-bar, .section-drag-handle, .product-block-drag-handle, .ecosystem-map-open, .ecosystem-map-dialog__close")) return;
    if (getEditableTarget(ev)) { ev.stopImmediatePropagation(); return; }
    if (ev.target.closest(INTERACTIVE)) lock(ev);
  }, true);
  document.addEventListener("pointerup", ev => {
    if (!enabled) return;
    const editable = getEditableTarget(ev);
    if (!editable) return;
    ev.stopImmediatePropagation();
    const caretEv = { clientX: ev.clientX, clientY: ev.clientY };
    setTimeout(() => { if (enabled && !hasSelectionInside(editable)) placeCaret(editable, caretEv); }, 0);
  }, true);
  document.addEventListener("keydown", ev => {
    if (!enabled) return;
    const editable = getActiveEditable(ev);
    if (!editable) return;
    const plain = !ev.altKey && !ev.ctrlKey && !ev.metaKey;
    if ((ev.key === " " || ev.code === "Space") && plain) {
      lock(ev); insertText(editable, NBSP); markDirty(); return;   // пробел печатается, summary не схлопывается
    }
    if (ev.key === "Enter" && plain) {
      lock(ev); insertBreak(editable); markDirty(); return;
    }
    ev.stopPropagation();
  }, true);
  document.addEventListener("paste", ev => {
    if (!enabled) return;
    const editable = getActiveEditable(ev);
    if (!editable) return;
    const text = (ev.clipboardData?.getData("text/plain") || "").replace(/\r\n?/g, "\n").replace(/ /g, " ");
    lock(ev);
    if (text) { insertText(editable, text); markDirty(); }
  }, true);
  document.addEventListener("input", ev => {
    if (!enabled || !getEditableTarget(ev)) return;
    markDirty();
  }, true);
  document.addEventListener("site:changed", ev => {
    if (!enabled) return;
    markDirty(ev.detail?.message || "● порядок разделов изменён — не сохранено");
  });
  window.addEventListener("beforeunload", ev => {
    if (dirty || mapDirty) { ev.preventDefault(); ev.returnValue = "есть несохранённые правки"; }
  });

  function markDirty(message = "● не сохранено — есть правки") {
    dirty = true;
    save.disabled = false;
    setStatus(message);
  }

  function setEditing(on) {
    on = on && desktopEditing();
    enabled = on;
    document.body.classList.toggle("editing", on);
    if (on) { applyMarkers(); observer.observe(document.body, { childList: true, subtree: true }); }
    else { observer.disconnect(); clearTimeout(refreshTimer); clearMarkers(); }
    toggle.textContent = on ? "закончить правку" : "править";
    save.style.display = on || dirty ? "" : "none";
    save.disabled = saving || !dirty;
    sendMapState();
    if (on) {
      const wrong = location.protocol === "file:";
      setStatus(wrong ? "⚠ открыто не через порт 4179 — сохранение может не сработать" : "текст страницы и карты редактируется · разделы двигаются справа · rev " + myRev());
    } else if (!dirty) setStatus("");
  }

  // ——— сериализация: чистим служебное и мусор contenteditable ———
  function serialize() {
    const clone = document.documentElement.cloneNode(true);
    // DOM браузерных расширений (Grammarly, LastPass, 1Password…) в разметку не попадает — иначе он запекается в опубликованный HTML.
    clone.querySelectorAll("*").forEach(el => { const t = el.localName || ""; if (/^(grammarly-|lastpass-|com-1password-)/.test(t) || el.hasAttribute("data-grammarly-shadow-root") || el.hasAttribute("data-lastpass-icon-root")) el.remove(); });
    [clone, clone.querySelector("body")].forEach(el => { if (!el) return; [...el.attributes].forEach(a => { if (/^data-(gr-|lastpass-|1p-)/.test(a.name)) el.removeAttribute(a.name); }); });
    clone.querySelectorAll("#codex-browser-sidebar-comments-root, [id^='codex-browser-'], [data-editor-runtime], #stretch-gauge").forEach(el => el.remove());
    // Рантайм-узлы, которые скрипты создают сами при загрузке (поле знака,
    // русло, курсор-лого, воксельный компаньон, слой стрелки, спираль
    // процесса, бейдж): их нельзя запекать в разметку — иначе после
    // сохранения скрипты создадут их ПОВТОРНО и на странице будет два движка.
    // Все они — прямые дети <body> (авторские канвасы лежат внутри секций).
    clone.querySelectorAll("body > canvas, #w19-proc").forEach(el => el.remove());
    // висячая пунктуация живёт только в рантайме: спаны в разметку не запекаем
    clone.querySelectorAll(".hang-native").forEach(el => {el.classList.remove("hang-native"); if(!el.classList.length) el.removeAttribute("class");});
    clone.querySelectorAll("span.hang").forEach(sp => sp.replaceWith(document.createTextNode(sp.textContent)));
    // Рантайм-следы wild-движка тоже не запекаем (иначе каждое сохранение редактора уводит live от исходника):
    // reveal-классы и задержки, пиксельные кнопки, токены команды, размеры канвасов сцен, расписание {space}, пустые атрибуты.
    clone.querySelectorAll(".w19-reveal").forEach(el => { el.classList.remove("w19-reveal", "w19-in"); if (!el.classList.length) el.removeAttribute("class"); if (el.style && el.style.transitionDelay) { el.style.transitionDelay = ""; if (!el.getAttribute("style")) el.removeAttribute("style"); } });
    clone.querySelectorAll(".w19-px").forEach(b => { const fx = b.querySelector(":scope > .w19-fx"); if (fx) fx.remove(); const lbl = b.querySelector(":scope > .w19-lbl"); if (lbl) { while (lbl.firstChild) b.insertBefore(lbl.firstChild, lbl); lbl.remove(); } b.classList.remove("w19-px"); if (!b.classList.length) b.removeAttribute("class"); });
    clone.querySelectorAll("p.team-activity").forEach(p => { p.textContent = p.getAttribute("aria-label") || p.textContent; p.classList.remove("team-activity"); p.removeAttribute("aria-label"); if (!p.classList.length) p.removeAttribute("class"); });
    clone.querySelectorAll(".direction-scene canvas, .kinetic-scene canvas").forEach(cv => { cv.removeAttribute("width"); cv.removeAttribute("height"); cv.removeAttribute("style"); });
    clone.querySelectorAll(".kinetic-scene[style]").forEach(el => el.removeAttribute("style"));
    const scheduleBoard = clone.querySelector("#spaceScheduleBoard"); if (scheduleBoard) scheduleBoard.innerHTML = "";
    clone.querySelectorAll(".stats b[aria-label]").forEach(b => b.removeAttribute("aria-label"));
    clone.querySelectorAll("a.is-current").forEach(a => { a.classList.remove("is-current"); a.removeAttribute("aria-current"); if (!a.classList.length) a.removeAttribute("class"); });
    clone.querySelectorAll('[style=""], [class=""]').forEach(el => { if (el.getAttribute("style") === "") el.removeAttribute("style"); if (el.getAttribute("class") === "") el.removeAttribute("class"); });
    // Любые случайные block-обёртки внутри текстовых полей превращаем в обычные переносы.
    clone.querySelectorAll("[data-editable] div, [data-editable] p").forEach(block => {
      const frag = document.createDocumentFragment();
      if (block.previousSibling) frag.appendChild(document.createElement("br"));
      while (block.firstChild) frag.appendChild(block.firstChild);
      block.replaceWith(frag);
    });
    clone.querySelectorAll("[contenteditable]").forEach(el => el.removeAttribute("contenteditable"));
    clone.querySelectorAll("[data-editable]").forEach(el => el.removeAttribute("data-editable"));
    clone.querySelectorAll("[spellcheck]").forEach(el => el.removeAttribute("spellcheck"));
    clone.querySelectorAll("dialog[open]").forEach(dialog => dialog.removeAttribute("open"));
    clone.querySelectorAll(".section-rail-item").forEach(el => {
      el.classList.remove("is-current", "is-dragging", "is-drop-before", "is-drop-after");
      el.removeAttribute("aria-grabbed");
    });
    clone.querySelectorAll(".product-block").forEach(el => {
      el.classList.remove("is-dragging", "is-drop-before", "is-drop-after");
      el.removeAttribute("aria-grabbed");
    });
    // браузер вставляет div/p внутрь редактируемых — расплющиваем в <br>
    clone.querySelectorAll("p div, p p, h1 div, h2 div, h3 div, summary div, blockquote div").forEach(block => {
      const frag = document.createDocumentFragment();
      if (block.previousSibling) frag.appendChild(document.createElement("br"));
      while (block.firstChild) frag.appendChild(block.firstChild);
      block.replaceWith(frag);
    });
    // выкидываем каретные якоря
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    const drops = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (n.textContent.includes(ANCHOR)) n.textContent = n.textContent.replaceAll(ANCHOR, "");
    }
    // нормализуем хвостовые NBSP по краям текстов (внутри — оставляем)
    const tw = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) {
      const n = tw.currentNode;
      if (/\u00a0$/.test(n.textContent) && n.parentElement && !n.nextSibling) n.textContent = n.textContent.replace(/\u00a0+$/, "");
    }
    const body = clone.querySelector("body"); if (body) body.classList.remove("editing");
    const bar = clone.querySelector("#editBar .status"); if (bar) bar.textContent = "";
    const tg = clone.querySelector("#editToggle"); if (tg) tg.textContent = "править";
    const sv = clone.querySelector("#editSave"); if (sv) sv.style.display = "none";
    const dp = clone.querySelector("#editDuplicate"); if (dp) dp.removeAttribute("disabled");
    const vl = clone.querySelector("#editVariantLink"); if (vl) { vl.hidden = true; vl.removeAttribute("href"); }
    const wd = clone.querySelector("#waitlistDialog"); if (wd) wd.removeAttribute("open");
    clone.querySelectorAll("#waitlistForm input").forEach(input => {
      if (input.type !== "hidden") input.removeAttribute("value");
    });
    const wc = clone.querySelector("#waitlistCode"); if (wc) wc.setAttribute("value", "");
    const ws = clone.querySelector("#waitlistStatus"); if (ws) { ws.textContent = ""; ws.classList.remove("is-error"); }
    const wb = clone.querySelector("#waitlistSubmit"); if (wb) wb.removeAttribute("disabled");
    return "<!DOCTYPE html>\n" + clone.outerHTML + "\n";
  }

  // ——— сохранение с проверкой и перепроверкой ———
  function editorEndpoints(path) {
    const endpoints = [];
    if (location.protocol !== "file:" && location.hostname !== "storage.googleapis.com") {
      endpoints.push(new URL(path, location.origin).href);
    }
    if (remoteApi) endpoints.push(remoteApi + path);
    endpoints.push("http://localhost:4179" + path);
    return [...new Set(endpoints)];
  }

  async function currentRemoteStatus() {
    const path = "/__status?object=" + encodeURIComponent(editorObject);
    for (const endpoint of editorEndpoints(path)) {
      try {
        const r = await fetch(endpoint, { cache: "no-store" });
        const j = await r.json();
        if (r.ok && j.ok) return j;
      } catch {}
    }
    return null;
  }

  async function verify(expectedRev, expectedSha = "") {
    const current = await currentRemoteStatus();
    return !!current && current.rev === expectedRev && (!expectedSha || current.sha === expectedSha);
  }

  let saving = false;
  save.addEventListener("click", async () => {
    if (!desktopEditing()) return;
    if (saving) return;
    saving = true;
    save.disabled = true;
    clearTimeout(recheckTimer);
    setStatus("сохраняю…");
    try {
      if (mapDirty) {
        setStatus("сохраняю карту…");
        await saveMapIfNeeded();
        setStatus("карта записана · сохраняю страницу…");
      }
      const html = serialize();
      const endpoints = editorEndpoints("/__save");
      let ok = false, info = "", conflict = false, newRev = null, newSha = "";
      for (const ep of endpoints) {
        try {
          const r = await fetch(ep, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ html, rev: myRev(), object: editorObject }) });
          const j = await r.json().catch(() => ({}));
          if (r.ok && j.ok) { ok = true; newRev = j.rev; newSha = j.sha || ""; info = j.backup || "изменений не было"; break; }
          if (r.status === 409) { conflict = true; info = j.message || "конфликт версий"; break; }
          info = j.error || ("http " + r.status);
        } catch (e) { info = e.message; }
      }
      if (conflict) { setStatus("⚠ НЕ ЗАПИСАНО: " + info, true); return; }
      if (!ok) { setStatus("⚠ НЕ ЗАПИСАНО: " + info + " — правки живут только в этой вкладке, не закрывайте её", true); return; }

      document.documentElement.dataset.rev = String(newRev);
      setStatus("сервер ответил ок · проверяю файл…");
      const confirmed = await verify(newRev, newSha);
      if (confirmed) {
        dirty = false;
        setEditing(false);
        setStatus("✓ точно записано в html · rev " + newRev + " · " + t());
        recheckTimer = setTimeout(async () => {
          const still = await verify(newRev, newSha);
          setStatus(still
            ? "✓ точно записано · rev " + newRev + " · перепроверено в " + t()
            : "⚠ файл изменился после сохранения (rev ≠ " + newRev + ") — возможно, синк отката́л; проверьте backups/changelog.jsonl");
        }, 5000);
      } else {
        setStatus("⚠ не уверен, что записалось: сервер сказал ок, но файл не подтверждён — попробуйте сохранить ещё раз, вкладку не закрывайте");
      }
    } catch (e) { setStatus("⚠ НЕ ЗАПИСАНО: " + e.message, true, String(e.stack || e)); }
    finally { saving = false; save.disabled = !dirty; }
  });

  duplicate.addEventListener("click", async () => {
    if (!desktopEditing()) return;
    if (duplicating) return;
    const html = serialize();
    duplicating = true;
    duplicate.disabled = true;
    variantLink.hidden = true;
    variantLink.removeAttribute("href");
    setStatus("создаю отдельный вариант…");
    try {
      let created = null;
      let info = "";
      for (const endpoint of editorEndpoints("/__duplicate")) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ html, rev: myRev(), object: editorObject, label: "" }),
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok && data.ok) { created = data; break; }
          info = data.message || data.error || ("http " + response.status);
          if (response.status === 409) break;
        } catch (error) { info = error.message; }
      }
      if (!created) {
        setStatus("⚠ ВАРИАНТ НЕ СОЗДАН: " + info, true);
        return;
      }
      navigator.clipboard?.writeText(created.publicUrl).catch(() => {});
      variantLink.href = created.publicUrl;
      variantLink.hidden = false;
      setStatus("✓ отдельный вариант создан · ссылка скопирована");
    } catch (error) {
      setStatus("⚠ ВАРИАНТ НЕ СОЗДАН: " + error.message, true);
    } finally {
      duplicating = false;
      duplicate.disabled = false;
    }
  });

  matchMedia('(min-width:1101px) and (hover:hover) and (pointer:fine)').addEventListener('change', e => {
    if (!e.matches) setEditing(false);
  });
  function requestEditPassword() {
    return new Promise(resolve => {
      const dialog = document.createElement("dialog");
      dialog.setAttribute("data-editor-runtime", "");
      dialog.setAttribute("aria-label", "Пароль для редактирования");
      dialog.style.cssText = "padding:24px;border:1px solid #111;font:14px monospace;max-width:calc(100vw - 32px)";
      dialog.innerHTML = '<form><label>Пароль для редактирования<br><input type="password" name="password" autocomplete="off" autofocus style="font:inherit;padding:10px;margin:12px 0;width:220px;max-width:100%"></label><div style="display:flex;gap:12px"><button type="submit">Открыть</button><button type="button">Отмена</button></div></form>';
      const finish = value => { dialog.remove(); resolve(value); };
      dialog.querySelector("form").addEventListener("submit", event => {
        event.preventDefault(); finish(dialog.querySelector("input").value);
      });
      dialog.querySelector('button[type="button"]').addEventListener("click", () => finish(null));
      dialog.addEventListener("cancel", event => { event.preventDefault(); finish(null); });
      document.body.appendChild(dialog);
      dialog.showModal();
    });
  }
  toggle.addEventListener("click", async () => {
    if (!desktopEditing()) return;
    if (enabled) { setEditing(false); return; }
    const password = await requestEditPassword();
    if (password === null) return;
    if (password !== "0281") { setStatus("Неверный пароль", true); return; }
    toggle.disabled = true;
    setStatus("проверяю, что открыта свежая версия…");
    try {
      const current = await currentRemoteStatus();
      if (!current) {
        setStatus("⚠ правка не включена: не удалось проверить текущую версию — обновите страницу и попробуйте снова", true);
        return;
      }
      if (current.rev !== myRev()) {
        setStatus("⚠ правка не включена: опубликована rev " + current.rev + ", а открыта rev " + myRev() + " — обновите страницу (⌘R)", true);
        return;
      }
      setEditing(true);
    } finally {
      toggle.disabled = false;
    }
  });
})();
