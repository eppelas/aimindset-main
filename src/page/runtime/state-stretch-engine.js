
(() => {
  "use strict";
  /* ── v1 «Растяжка состояний» ─────────────────────────────────────────
     Ядро метафоры: развитие = видимая растяжка состояний — откуда человек
     входит, куда выходит, какую дистанцию реально прошёл. Всё управляется
     позицией скролла (scrub в обе стороны), плавный lerp, без библиотек. */

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const reduced = false;  /* Обработка prefers-reduced-motion снята намеренно: страница показывает одно и то же на любой машине. */

  /* Прогресс «вход→выход» элемента: 0 — верх элемента у нижней кромки
     вьюпорта, 1 — центр элемента дошёл до центра экрана. Для блоков,
     видимых уже при нулевом скролле, старт прижимается к нулю. */
  function prog(el) {
    const r = el.getBoundingClientRect(), vh = innerHeight, y = scrollY;
    const top = r.top + y;
    const start = Math.max(0, top - vh);
    const end = Math.max(start + 1, top + Math.min(r.height, vh * 0.9) / 2 - vh / 2);
    return clamp((y - start) / (end - start), 0, 1);
  }

  /* ── 1. Резерв ширины хиро-статистики ─────────────────────────────── */
  const nums = [...document.querySelectorAll("#hero .stats b")].map(b => {
    const original = b.textContent;
    const m = original.match(/^([^0-9]*)([0-9]+)([\s\S]*)$/);
    if (!m) return null;
    return { el: b, original, prefix: m[1], value: +m[2], suffix: m[3], shown: null };
  }).filter(Boolean);
  // резервируем ширину, чтобы счёт не двигал вёрстку
  function reserveNumWidths() {
    // меряем ширину САМОГО ЧИСЛА, а не блока: b — display:block и его rect
    // равен ширине колонки, из-за чего все цифры пинились на одну ширину
    // и просветы между парами становились рваными.
    const range = document.createRange();
    nums.forEach(n => {
      n.el.style.minWidth = "";
      range.selectNodeContents(n.el);
      n.el.style.minWidth = Math.ceil(range.getBoundingClientRect().width) + 1 + "px";
    });
  }
  reserveNumWidths();

  /* ── 2. Пары тон-карты Brand OS: слабая форма → сильная ───────────── */
  const TONE_SPECS = [
    { root: "#learning .sec-head",  weak: "обучение",      strong: "инициация" },
    { root: "#approach .sec-head",  weak: "курс",          strong: "среда" },
    { root: "#product-space h3",    weak: "сообщество",    strong: "попутчики" },
    { root: "#research .rows",      weak: "трансформация", strong: "растяжка" }
  ];
  const tones = [];
  function findTextNode(root, word) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n.parentElement && n.parentElement.closest(".v1x-tone")) continue;
      const i = n.data.indexOf(word);
      if (i > -1) return { node: n, index: i };
    }
    return null;
  }
  TONE_SPECS.forEach(spec => {
    const root = document.querySelector(spec.root);
    if (!root) return;
    const hit = findTextNode(root, spec.weak);
    if (!hit) return;
    // выделяем слово в собственный текстовый узел и оборачиваем (рантайм-обёртка, исходник не тронут)
    const target = hit.index > 0 ? hit.node.splitText(hit.index) : hit.node;
    target.splitText(spec.weak.length);
    const wrap = document.createElement("span");
    wrap.className = "v1x-tone";
    wrap.setAttribute("data-editor-ui", "");
    const weakEl = document.createElement("span");
    weakEl.className = "v1x-weak";
    weakEl.textContent = spec.weak;
    const strike = document.createElement("span");
    strike.className = "v1x-strike";
    weakEl.appendChild(strike);
    const strongEl = document.createElement("span");
    strongEl.className = "v1x-strong";
    strongEl.textContent = spec.strong;
    wrap.append(weakEl, strongEl);
    target.parentNode.replaceChild(wrap, target);
    // Если за словом сразу идёт знак препинания, переносим его в ту же
    // неразрывную группу. Так знак не попадает в область набираемого слова
    // и не может столкнуться с последним глифом на финальном кадре.
    let punctuation = "";
    const tail = wrap.nextSibling;
    if (tail && tail.nodeType === Node.TEXT_NODE && /^[,.;:!?…)}\]»”’]/.test(tail.data)) {
      punctuation = tail.data.charAt(0);
      tail.data = tail.data.slice(1);
      const punctuationEl = document.createElement("span");
      punctuationEl.className = "v1x-punctuation";
      punctuationEl.textContent = punctuation;
      wrap.appendChild(punctuationEl);
    }
    tones.push({ wrap, strike, strongEl, weak: spec.weak, strong: spec.strong, punctuation, chars: -1, strikeW: -1 });
  });
  // фиксируем ширину сильной формы — «печать» не двигает вёрстку
  function reserveToneWidths() {
    tones.forEach(t => {
      const keep = t.strongEl.textContent;
      t.strongEl.style.width = "";
      t.strongEl.textContent = t.strong;
      // Небольшой оптический запас не даёт последнему глифу соприкасаться
      // со следующим исходным знаком (`}` / `,`) при допечатывании.
      t.strongEl.style.width = Math.ceil(t.strongEl.getBoundingClientRect().width) + 2 + "px";
      t.strongEl.textContent = keep;
    });
  }
  reserveToneWidths();
  // после загрузки шрифта перемеряем резервы ширины
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { reserveNumWidths(); reserveToneWidths(); });
  }

  /* ── 3. Точечный силуэт A→B в хиро ────────────────────────────────── */
  const hero = document.getElementById("hero");
  const DOT_N = 400, DOT_H = 120;
  let canvas = null, ctx = null, dots = [], cw = 0;
  if (hero) {
    canvas = document.createElement("canvas");
    canvas.className = "v1x-dots";
    canvas.id = "codex-browser-v1x-dots"; // префикс id — сериализатор редактора удаляет такие узлы из сохранений
    canvas.setAttribute("data-editor-ui", "");
    canvas.setAttribute("aria-hidden", "true");
    hero.appendChild(canvas);
    ctx = canvas.getContext("2d");
  }
  function buildDots() {
    if (!ctx || innerWidth<=960) return;
    cw = hero.clientWidth;
    const dpr = Math.min(devicePixelRatio || 1, 2); // потолок DPR = 2
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(DOT_H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // сид-генератор: россыпь «входа» стабильна между перерисовками
    let s = 20260813;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    // «выход»: упорядоченная решётка по всей полосе
    const cols = Math.max(1, Math.ceil(Math.sqrt(DOT_N * cw / DOT_H)));
    const gx = cw / (cols + 1), gy = DOT_H / (Math.ceil(DOT_N / cols) + 1);
    dots = [];
    for (let i = 0; i < DOT_N; i++) {
      dots.push({
        ax: rnd() * cw, ay: rnd() * DOT_H,                      // «вход»: случайное облако
        bx: gx * ((i % cols) + 1), by: gy * (((i / cols) | 0) + 1), // «выход»: узел решётки
        d: rnd() * 0.35                                          // персональная задержка морфа
      });
    }
  }
  function drawDots(p) {
    if (!ctx) return;
    ctx.clearRect(0, 0, cw, DOT_H);
    ctx.fillStyle = "#000";
    for (const d of dots) {
      const t = easeOut(clamp((p - d.d) / 0.65, 0, 1));
      ctx.fillRect(lerp(d.ax, d.bx, t) - 1, lerp(d.ay, d.by, t) - 1, 2, 2);
    }
  }
  const heroProg = () => hero
    ? clamp(scrollY / Math.max(1, hero.offsetHeight - innerHeight * 0.35), 0, 1)
    : 0;

  /* Прогресс секции остаётся частью скролл-анимации, но правый датчик
     намеренно не создаём: это была лишняя отдельная панель интерфейса. */
  const sections = [...document.querySelectorAll("section[id]")];
  function gaugeTarget(prev) {
    const mid = innerHeight / 2;
    for (const sec of sections) {
      const r = sec.getBoundingClientRect();
      if (r.height <= 0) continue; // скрытые секции
      if (r.top <= mid && r.bottom > mid) return clamp((mid - r.top) / r.height, 0, 1);
    }
    return prev; // между секциями держим предыдущее значение
  }

  /* ── Применение состояний ─────────────────────────────────────────── */
  function applyTone(t, p) {
    if(matchMedia("(max-width:960px)").matches && t.wrap.closest("#product-space")) p=1;
    // первая половина пути — зачёркивание слабой формы
    const sw = Math.round(clamp(p / 0.45, 0, 1) * 100);
    if (sw !== t.strikeW) { t.strikeW = sw; t.strike.style.width = sw + "%"; }
    // вторая половина — «печать» сильной формы посимвольно
    const chars = Math.round(clamp((p - 0.35) / 0.6, 0, 1) * t.strong.length);
    if (chars !== t.chars) { t.chars = chars; t.strongEl.textContent = t.strong.slice(0, chars); }
  }

  /* ── Совместимость с редактором страницы: перед правкой/сохранением
     возвращаем исходный текст (числа и слова), чтобы в сохранённый HTML
     не попали промежуточные состояния и рантайм-обёртки. ────────────── */
  let stopped = false;
  function settleForEditor() {
    if (stopped) return;
    stopped = true;
    nums.forEach(n => { n.el.textContent = n.original; n.el.style.minWidth = ""; });
    tones.forEach(t => {
      if (t.wrap.parentNode) {
        const parent = t.wrap.parentNode;
        parent.replaceChild(document.createTextNode(t.weak + t.punctuation), t.wrap);
        parent.normalize();
      }
    });
    drawDots(1);
  }
  document.addEventListener("click", e => {
    if (e.target instanceof Element && e.target.closest("#editToggle, #editSave, #editDuplicate")) settleForEditor();
  }, true);

  /* ── Режим reduced-motion: финальные состояния статически ─────────── */
  if (reduced) {
    nums.forEach(n => { n.el.textContent = n.original; });
    tones.forEach(t => { t.strike.style.width = "100%"; t.strongEl.textContent = t.strong; });
    buildDots();
    drawDots(1);
    addEventListener("resize", () => { buildDots(); drawDots(1); });
    return;
  }

  /* ── Главный цикл: цели из скролла, плавный lerp, пауза на скрытой вкладке ── */
  const cur = { dots: 0, gauge: 0, tones: tones.map(() => 0) };
  const tgt = { dots: 0, gauge: 0, tones: tones.map(() => 0) };
  let raf = 0;
  function computeTargets() {
    tgt.dots = heroProg();
    tones.forEach((t, i) => { tgt.tones[i] = prog(t.wrap); });
    tgt.gauge = gaugeTarget(tgt.gauge);
  }
  function step(from, to) {
    const d = to - from;
    return Math.abs(d) < 0.0015 ? to : from + d * 0.14;
  }
  function frame() {
    raf = 0;
    if (stopped || document.hidden) return; // пауза: скрытая вкладка / режим правки
    computeTargets();
    let moving = false;
    cur.dots = step(cur.dots, tgt.dots);
    cur.gauge = step(cur.gauge, tgt.gauge);
    if (cur.dots !== tgt.dots || cur.gauge !== tgt.gauge) moving = true;
    cur.tones = cur.tones.map((v, i) => {
      const nv = step(v, tgt.tones[i]);
      if (nv !== tgt.tones[i]) moving = true;
      return nv;
    });
    drawDots(cur.dots);
    tones.forEach((t, i) => applyTone(t, cur.tones[i]));
    if (moving) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && !stopped && !document.hidden) raf = requestAnimationFrame(frame);
  }
  addEventListener("scroll", kick, { passive: true });
  addEventListener("resize", () => { buildDots(); reserveNumWidths(); reserveToneWidths(); kick(); });
  document.addEventListener("visibilitychange", kick);
  buildDots();
  kick();
})();
