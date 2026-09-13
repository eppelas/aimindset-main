
/* ═══════════════════════════════════════════════════════════
   v1 · РАСТЯЖКА СОСТОЯНИЙ
   символ бренда №1: «растяжка первичного состояния и конечного.
   когда растяжка видна и человек её принимает — это развитие».
   каждая секция = переход слово-входа → слово-выхода (по тон-карте
   и фонду фраз); точка на линии = позиция чтения внутри секции.
   в hero цифры «растягиваются» от 1 к своим значениям при загрузке.
   ═══════════════════════════════════════════════════════════ */
(() => {
  "use strict";




  /* пары состояний: вход → выход (фонд фраз AIM, тон-карта) */
  const PAIRS = {
    hero:              ["пользователь", "создатель"],
    about:             ["личная практика", "общая среда"],
    team:              ["двое", "команда"],
    approach:          ["курс", "пространство"],
    cases:             ["идея", "система"],
    products:          ["форматы", "один нарратив"],
    learning:          ["смотреть", "делать"],
    "product-platform":["контент", "память"],
    "product-space":   ["знакомые", "попутчики"],
    research:          ["вопрос", "карта"],
    reviews:           ["до", "после"],
    manifesto:         ["поток", "пауза"],
    follow:            ["вспышки", "ритм"],
  };
  const SCRAMBLE = "·/~\\|＿-";

  const gauge = document.createElement("div");
  gauge.id = "stretch-gauge";
  gauge.setAttribute("data-editor-runtime", "");
  gauge.setAttribute("aria-hidden", "true");
  gauge.innerHTML =
    '<span class="sg-word sg-b"></span>' +
    '<span class="sg-morph"></span>' +
    '<span class="sg-track"><span class="sg-dot"></span></span>' +
    '<span class="sg-word sg-a"></span>';
  document.body.appendChild(gauge);
  const elA = gauge.querySelector(".sg-a");     // вход (снизу — откуда растём)
  const elB = gauge.querySelector(".sg-b");     // выход (сверху — куда)
  const elM = gauge.querySelector(".sg-morph"); // морфящееся слово
  const elDot = gauge.querySelector(".sg-dot");

  const sections = Array.from(document.querySelectorAll("main > section[id]"))
    .filter(s => PAIRS[s.id]);

  /* морф: слово A посимвольно превращается в B по прогрессу p */
  const morph = (a, b, p) => {
    const n = Math.max(a.length, b.length);
    const edge = Math.floor(p * n);
    let out = "";
    for (let i = 0; i < n; i++) {
      if (i < edge) out += b[i] || " ";
      else if (i === edge && p > 0.02 && p < 0.98)
        out += SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0];
      else out += a[i] || " ";
    }
    return out;
  };

  let ticking = false;
  const update = () => {
    ticking = false;
    const mid = innerHeight * 0.45;
    let cur = null, progress = 0;
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom >= mid) {
        cur = s;
        progress = Math.min(1, Math.max(0, (mid - r.top) / Math.max(r.height, 1)));
        break;
      }
    }
    if (!cur) { gauge.classList.remove("on"); return; }
    const [a, b] = PAIRS[cur.id];
    gauge.classList.add("on");
    elA.textContent = a;
    elB.textContent = b;
    elA.style.opacity = String(Math.max(0.25, 1 - progress));
    elB.style.opacity = String(Math.max(0.25, progress));
    elM.textContent = morph(a, b, progress);
    elDot.style.top = (100 - progress * 100) + "%";
  };
  const onScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  update();

  /* ── hero: размытый силуэт → живое число, без ложного нуля ── */
  const statNodes = Array.from(document.querySelectorAll(".stats b, .stats strong, .stats .stat-num"));
  const numRe = /^([^0-9]*)(\d+)(.*)$/;
  const emergingStats = statNodes.map(node => {
    const m = (node.textContent || "").match(numRe);
    if (!m) return null;
    const target = parseInt(m[2], 10);
    if (!isFinite(target) || target <= 1) return null;
    const orig = node.textContent;
    node.setAttribute("aria-label", orig);
    node.style.filter = "blur(7px)";
    node.style.opacity = ".38";
    node.style.transform = "scale(.88)";
    return { node, prefix: m[1], target, suffix: m[3], orig };
  }).filter(Boolean);
  const t0 = performance.now(), dur = 1400, blurHold = .14;
  let statsDone = false;
  const finishStats = () => {
    if (statsDone) return;
    statsDone = true;
    emergingStats.forEach(({ node, orig }) => {
      node.textContent = orig;
      node.style.filter = "";
      node.style.opacity = "";
      node.style.transform = "";
    });
  };
  const tickStats = now => {
    if (statsDone) return;
    const p = Math.min(1, (now - t0) / dur);
    const ease = 1 - Math.pow(1 - p, 3);
    const countP = Math.max(0, Math.min(1, (p - blurHold) / (1 - blurHold)));
    const countEase = 1 - Math.pow(1 - countP, 3);
    emergingStats.forEach(({ node, prefix, target, suffix, orig }) => {
      const val = Math.max(1, Math.round(1 + (target - 1) * countEase));
      node.textContent = p < blurHold ? orig : prefix + val + suffix;
      node.style.filter = `blur(${(7 * Math.pow(1 - ease, 1.5)).toFixed(2)}px)`;
      node.style.opacity = String(.38 + .62 * ease);
      node.style.transform = `scale(${(.88 + .12 * ease).toFixed(4)})`;
    });
    if (p < 1) requestAnimationFrame(tickStats);
    else finishStats();
  };
  requestAnimationFrame(tickStats);
  document.addEventListener("click", event => {
    if (event.target instanceof Element && event.target.closest("#editToggle, #editSave, #editDuplicate")) finishStats();
  }, true);

})();
