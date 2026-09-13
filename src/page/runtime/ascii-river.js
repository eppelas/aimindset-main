

/* ═══════════════════════════════════════════════════════════
   v2 · РУСЛО — ascii-река на символьной сетке
   «у кого AI есть, а русла ещё нет» (s26 {flow})

   СИСТЕМА, не эффект:
   · сетка = моноширинные клетки (атом бренда — символ, не пиксель)
   · карта влажности Float32Array; глиф клетки по уровню: · ~ ≈
   · карта препятствий: заголовки — камни В ФОРМЕ БУКВ
     (вода проходит сквозь пробелы между словами), остальной
     контент — прямоугольники с рваным hash-краем
   · курсор = камень · удержание = запруда (вода копится) ·
     отпустил = прорыв волной · клик = круги по воде
   · пауза 2.6с = река «ищет новое русло» (меандр) и по ней
     плывёт кораблик ▸ — персонаж, огибающий камни
   · скролл: вода привязана к документу (карта сдвигается)
   · без библиотек; DPR cap 2; пауза при скрытой вкладке
   ═══════════════════════════════════════════════════════════ */
(() => {
  "use strict";


  /* ── настройки ── */
  /* ручейки живут только ниже хиро: в хиро — поле wild */
  let heroDocBottom = 0;
  const heroEl = document.getElementById('hero');
  const measureHero = () => { if(heroEl){ const r=heroEl.getBoundingClientRect(); heroDocBottom = r.bottom + scrollY; } };
  measureHero(); addEventListener('resize', measureHero); setTimeout(measureHero, 600);
  const CELL_W = 7, CELL_H = 13;               // клетка символьной сетки
  const FONT = '11px "JetBrains Mono", ui-monospace, monospace';
  const N_PART = 460;                          // частиц воды
  const DECAY = 0.94;                         // остывание влажности за кадр
  const DEPOSIT = 0.13;                        // сколько влаги оставляет частица
  const BANDS = [[0.06, "·"], [0.22, "~"], [0.5, "≈"]]; // пороги уровней
  const POOL_LOW = ".:;·", POOL_MID = "=+<>{}", POOL_HIGH = "01$#";
  const INK = "#8b929e";                       // вода — чернила
  const IDLE_MS = 2600;

  /* детерминированный hash (как в шейдерах) — без Math.random в кадре */
  const hash = (x, y) => {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };

  const canvas = document.createElement("canvas");
  canvas.id = "ruslo-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let W = 0, H = 0, DPR = 1, COLS = 0, ROWS = 0;
  let moist, obst;                             // карта воды и карта препятствий

  const resize = () => {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.font = FONT;
    ctx.textBaseline = "top";
    COLS = Math.ceil(W / CELL_W);
    ROWS = Math.ceil(H / CELL_H) + 2;
    moist = new Float32Array(COLS * ROWS);
    obst = new Uint8Array(COLS * ROWS);
    obstDirty = true;
  };

  /* ── препятствия ─────────────────────────────────────────
     заголовки: моноширинный текст → камень на каждую букву,
     пробелы свободны — река течёт «сквозь» заголовок.
     остальное: прямоугольник с рваным краем. */
  const HEAD_SEL = "h1,h2,h3,h4";
  const RECT_SEL = ["p","li","img","video","canvas","button","table","figure",
    "blockquote",".stats > div",".hero-lab-card",".top .wrap",".tabs .wrap",".section-rail",".sec-head",
    ".team-role","nav.project-links"].join(",");
  let obstDirty = true, lastObstAt = 0;

  const markCell = (cx, cy) => {
    if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS) obst[cy * COLS + cx] = 1;
  };

  const buildObstacles = () => {
    obst.fill(0);
    const PAD = 1;
    for (const el of document.querySelectorAll(HEAD_SEL)) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.bottom < -30 || r.top > H + 30) continue;
      const c0 = Math.floor(r.left / CELL_W), c1 = Math.ceil(r.right / CELL_W);
      const r0 = Math.floor(r.top / CELL_H), r1 = Math.ceil(r.bottom / CELL_H);
      for (let cy = r0; cy <= r1; cy++)
        for (let cx = c0; cx <= c1; cx++)
          if (hash(cx, cy) > 0.12) markCell(cx, cy);
    }
    for (const el of document.querySelectorAll(RECT_SEL)) {
      if (el === canvas) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < -30 || r.top > H + 30) continue;
      if (r.width > W * 0.9 && r.height > H * 0.9) continue;   /* полноэкранные оверлеи (канвасы слоёв) — не камни */
      const c0 = Math.floor(r.left / CELL_W) - PAD, c1 = Math.ceil(r.right / CELL_W) + PAD;
      const r0 = Math.floor(r.top / CELL_H) - PAD, r1 = Math.ceil(r.bottom / CELL_H) + PAD;
      for (let cy = r0; cy <= r1; cy++)
        for (let cx = c0; cx <= c1; cx++) {
          const edge = cy === r0 || cy === r1 || cx === c0 || cx === c1;
          if (edge && hash(cx * 3, cy * 7) < 0.3) continue;  // рваный край
          markCell(cx, cy);
        }
    }
  };

  const isRock = (px, py) => {
    const cx = (px / CELL_W) | 0, cy = (py / CELL_H) | 0;
    if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return false;
    return obst[cy * COLS + cx] === 1;
  };

  /* ── течение ── */
  let phase = 0;                                // эволюция поля
  const flowAngle = (x, y, t) =>
    Math.PI / 2 +                               // вниз
    Math.sin(y * 0.006 + t * 0.00022 + Math.sin(x * 0.004 + t * 0.00013) * 1.7) * 0.85;

  /* ── частицы ── */
  const parts = [];
  const spawn = (p, top) => {
    p.x = Math.random() * W;
    p.y = top ? -8 - Math.random() * 40 : Math.random() * H;
    p.vx = 0; p.vy = 30 + Math.random() * 30;
    p.held = false;
  };
  for (let i = 0; i < N_PART; i++) { const p = {}; spawn(p, false); parts.push(p); }

  /* ── интерактив: временно усиливает уже существующее течение ── */
  let mx = -1e4, my = -1e4, lastActivity = performance.now();
  let holdStart = 0, holding = false, heldPoint = null, pendingReroll = 0, rerollSerial = 0, impulse = null;
  let tapCount = 0, tapTimer = 0, tapPoint = null, holdPreview = null, holdToken = 0, holdArmTimer = 0;
  const surgeParts = [];
  const activity = () => { lastActivity = performance.now(); boat = null; };

  /* ── команда: те же глифы русла пересобирают порядок деятельности ──
     Слова берутся буквально из существующего <p>; новых ролей здесь нет. */
  let teamHover = null;
  const teamStates = [];
  const placeTeamTokens = (state, order, animate) => {
    const before = new Map();
    if (animate) state.spans.forEach(span => before.set(span, span.getBoundingClientRect()));
    const nodes = [];
    order.forEach((tokenIndex, visualIndex) => {
      const span = state.spans[tokenIndex];
      span.textContent = state.tokens[tokenIndex] + (visualIndex === order.length - 1 ? state.ending : ",");
      nodes.push(span);
      if (visualIndex < order.length - 1) nodes.push(document.createTextNode(" "));
    });
    state.text.replaceChildren(...nodes);
    state.order = order.slice();
    if (!animate) return;
    state.spans.forEach(span => {
      const a = before.get(span), b = span.getBoundingClientRect();
      if (!a) return;
      span.style.transition = "none";
      span.style.transform = `translate(${a.left - b.left}px,${a.top - b.top}px)`;
      span.style.opacity = ".48";
    });
    requestAnimationFrame(() => requestAnimationFrame(() => state.spans.forEach(span => {
      span.style.transition = ""; span.style.transform = ""; span.style.opacity = "";
    })));
  };
  const nextTeamOrder = state => {
    const next = state.order.slice();
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(hash(state.seed + state.cycle * 13.7 + i * 3.1, i * 9.7 + state.cycle) * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    if (next.every((value, index) => value === state.order[index])) next.push(next.shift());
    state.cycle += 1;
    placeTeamTokens(state, next, true);
  };
  {
    document.querySelectorAll("#team .team-member").forEach((card, cardIndex) => {
      const text = card.querySelector(".team-member-copy p");
      if (!text) return;
      const original = text.textContent.trim(), endingMatch = original.match(/[.!?]$/), ending = endingMatch ? endingMatch[0] : "";
      const body = endingMatch ? original.slice(0, -1) : original;
      const tokens = body.split(/\s*,\s*/).filter(Boolean);
      if (tokens.length < 2) return;
      const state = { card, text, original, ending, tokens, spans: tokens.map(() => {
        const span = document.createElement("span"); span.className = "team-activity-token"; return span;
      }), order: tokens.map((_, index) => index), seed: 71 + cardIndex * 131, cycle: 0, nextSwap: 0, entered: 0 };
      text.classList.add("team-activity");
      text.setAttribute("aria-label", original);
      placeTeamTokens(state, state.order, false);
      card.addEventListener("mouseenter", () => {
        if(innerWidth<=960)return;
        if (teamHover && teamHover !== state) {
          teamHover.card.classList.remove("is-flowing");
          placeTeamTokens(teamHover, teamHover.tokens.map((_, index) => index), true);
        }
        state.seed = performance.now() * .017 + cardIndex * 131;
        state.cycle = 0; state.entered = performance.now(); state.nextSwap = state.entered + 220;
        teamHover = state; card.classList.add("is-flowing"); activity();
      });
      card.addEventListener("mouseleave", () => {
        if(innerWidth<=960)return;
        card.classList.remove("is-flowing");
        placeTeamTokens(state, state.tokens.map((_, index) => index), true);
        if (teamHover === state) teamHover = null;
      });
      teamStates.push(state);
    });
  }
  let teamReset=0;
  document.addEventListener('aim:team-effect',e=>{
    if(e.detail.hint)return;
    const state=teamStates.find(s=>s.card===e.detail.card);if(!state)return;
    clearTimeout(teamReset);
    if(teamHover){teamHover.card.classList.remove('is-flowing');placeTeamTokens(teamHover,teamHover.tokens.map((_,i)=>i),true);}
    state.entered=performance.now();state.nextSwap=state.entered+1180;state.cycle=0;
    teamHover=state;state.card.classList.add('is-flowing');nextTeamOrder(state);activity();
    teamReset=setTimeout(()=>{state.card.classList.remove('is-flowing');placeTeamTokens(state,state.tokens.map((_,i)=>i),true);if(teamHover===state)teamHover=null;},e.detail.duration);
  });
  const interactiveTarget = e => !!(e.target && e.target.closest && e.target.closest('a,button,[role="button"],input,textarea,select,[contenteditable],.top,#ruslo-badge'));
  const addSurge = (cfg, seed, count, t0, token) => {
    const areaScale = Math.max(0.34, Math.min(1, (W * H) / (1280 * 720)));
    const n = Math.round(count * areaScale);
    for (let i = 0; i < n; i++) {
      const k = seed + i * 17.3;
      let x = hash(k, i * 1.7 + 11) * W, y = hash(i * 2.9 + 23, k) * H;
      if (cfg.islands) {
        /* Это не нарисованные ленты: частицы стартуют несколькими
           вертикально вытянутыми группами и дальше следуют прежнему flowAngle. */
        const island = i % cfg.islands;
        const ax = hash(seed * 0.37 + island * 13, island * 7 + 11) * W;
        const ay = hash(island * 17 + 5, seed * 0.23 + island) * H;
        const angle = hash(k * 1.1, island * 19 + 3) * Math.PI * 2;
        const radius = Math.sqrt(hash(k * 0.43, island * 31 + 9));
        x = ax + Math.cos(angle) * radius * W * cfg.islandX;
        y = ay + Math.sin(angle) * radius * H * cfg.islandY;
        x = (x % W + W) % W; y = (y % H + H) % H;
      }
      surgeParts.push({
        x, y,
        vx: 0, vy: 30 + hash(k * 3, i + 5) * 30,
        t0, until: t0 + cfg.duration,
        speed: cfg.speed, deposit: cfg.deposit, holdToken: token || 0
      });
    }
    if (surgeParts.length > 25000) surgeParts.splice(0, surgeParts.length - 25000);
  };
  const reroll = (scope, origin) => {
    /* Один клик — спокойная версия прежнего залпа; второй возвращает
       его исходную плотность, третий временно открывает редкие цветные ячейки. */
    const cfg = scope === "deep" ? { duration: 4200, speed: 1.45, deposit: 4.4, cadence: 180, count: 16000, islands: 12, islandX: .18, islandY: .34 }
      : scope === "triple" ? { duration: 3500, speed: 1.28, deposit: 3.7, cadence: 90, count: 10000, color: true, islands: 9, islandX: .16, islandY: .30 }
      : scope === "wide" ? { duration: 3000, speed: 1.10, deposit: 3.2, cadence: 100, count: 6000, islands: 6, islandX: .15, islandY: .28 }
      : { duration: 1300, speed: 0.72, deposit: 1.15, cadence: 110, count: 750, islands: 3, islandX: .14, islandY: .24 };
    impulse = { t0: performance.now(), seed: Math.random() * 1000 + ++rerollSerial * 71, scope, origin, ...cfg };
    addSurge(cfg, impulse.seed, cfg.count, impulse.t0);
    activity();
  };
  const impulseState = now => {
    if (!impulse) return null;
    if (impulse.scope === "hold" && holding && holdPreview) {
      const heldFor = now - holdPreview.t0;
      return { seed: impulse.seed, step: Math.floor(heldFor / impulse.cadence),
        power: Math.min(1.18, 0.34 + heldFor / 850), speed: impulse.speed, deposit: impulse.deposit,
        color: false, scope: impulse.scope };
    }
    const age = (now - impulse.t0) / impulse.duration;
    if (age >= 1) { impulse = null; return null; }
    return { seed: impulse.seed, step: Math.floor((now - impulse.t0) / impulse.cadence),
      power: Math.sin(age * Math.PI), speed: impulse.speed, deposit: impulse.deposit,
      color: !!impulse.color, scope: impulse.scope };
  };
  const clearHoldPreview = () => {
    if (!holdPreview) return;
    const token = holdPreview.token;
    for (let i = surgeParts.length - 1; i >= 0; i--) if (surgeParts[i].holdToken === token) surgeParts.splice(i, 1);
    if (impulse && impulse.scope === "hold") impulse = null;
    holdPreview = null;
  };
  const beginHoldPreview = () => {
    const now = performance.now(), token = ++holdToken;
    const cfg = { duration: 1450, speed: 1.24, deposit: 4.8, cadence: 240, islands: 7, islandX: .16, islandY: .34 };
    holdPreview = { t0: now, token, lastEmit: now, cfg };
    impulse = { t0: now, seed: Math.random() * 1000 + ++rerollSerial * 71, scope: "hold", origin: { x: heldPoint.x, y: heldPoint.y }, duration: 90000, ...cfg };
    /* Первое уплотнение начинается до отпускания — это те же частицы, не новый слой. */
    addSurge(cfg, impulse.seed, 9000, now, token);
    activity();
  };
  const scheduleTap = () => {
    tapCount += 1;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      const scope = tapCount >= 3 ? "triple" : tapCount === 2 ? "wide" : "normal";
      tapCount = 0; reroll(scope, tapPoint); tapPoint = null;
    }, 270);
  };

  addEventListener("pointermove", e => {
    mx = e.clientX; my = e.clientY; activity();
    if (holding && heldPoint && Math.hypot(e.clientX - heldPoint.x, e.clientY - heldPoint.y) > 12) clearHoldPreview();
  }, { passive: true });
  addEventListener("pointerdown", e => {
    if ((e.button && e.button !== 0) || interactiveTarget(e)) return;
    const heroRect = heroEl && heroEl.getBoundingClientRect();
    if (heroRect && e.clientY < heroRect.bottom) return;
    holding = true; holdStart = performance.now(); heldPoint = { x: e.clientX, y: e.clientY, sy: scrollY };
    /* Обычный клик сначала ждёт окно двойного: живой preview — только у удержания. */
    clearTimeout(holdArmTimer);
    holdArmTimer = setTimeout(() => {
      if (holding && heldPoint && performance.now() - holdStart >= 350) beginHoldPreview();
    }, 350);
  }, { passive: true });
  addEventListener("pointerup", e => {
    if (!holding || !heldPoint) return;
    holding = false;
    const point = heldPoint, duration = performance.now() - holdStart; heldPoint = null;
    clearTimeout(holdArmTimer);
    const moved = Math.hypot(e.clientX - point.x, e.clientY - point.y) > 12 || Math.abs(scrollY - point.sy) > 8;
    clearHoldPreview();
    if (moved) return;
    if (duration > 350) { clearTimeout(tapTimer); tapCount = 0; reroll("deep", point); }
    else { tapPoint = point; scheduleTap(); }
  }, { passive: true });
  addEventListener("pointercancel", () => { holding = false; heldPoint = null; clearTimeout(holdArmTimer); clearHoldPreview(); }, { passive: true });
  addEventListener("scroll", () => {
    activity();
    if (holding) { clearTimeout(holdArmTimer); clearHoldPreview(); }
    obstDirty = true;
    const dy = scrollY - lastScrollY;
    boost = Math.min(3.2, boost + Math.abs(dy) / 90);
    lastScrollY = scrollY;
    /* вода привязана к документу: сдвигаем карты на целые клетки */
    pendingShift += dy;
    const rowsShift = Math.trunc(pendingShift / CELL_H);
    if (rowsShift !== 0) {
      pendingShift -= rowsShift * CELL_H;
      shiftRows(moist, rowsShift);
    }
  }, { passive: true });
  let lastScrollY = scrollY, pendingShift = 0;
  let boost = 1;                                 // короткий разгон только от скролла
  const shiftRows = (map, n) => {
    if (n > 0 && n < ROWS) { map.copyWithin(0, n * COLS); map.fill(0, (ROWS - n) * COLS); }
    else if (n < 0 && -n < ROWS) { map.copyWithin(-n * COLS, 0, (ROWS + n) * COLS); map.fill(0, 0, -n * COLS); }
    else map.fill(0);
  };

  /* ── кораблик (персонаж пауз) ── */
  let boat = null;
  const startBoat = () => {
    boat = { x: W * (0.2 + 0.6 * Math.random()), y: -10, trail: [] };
  };

  /* Исходный v19-ритм: островки полной воды и длинные сухие паузы.
     Это применяется только к idle-потоку, не к временному пересчёту. */
  const rhythmAt = docY => {
    const v = 0.5 + 0.5 * Math.sin(docY * 0.0011 + 1.3) * Math.sin(docY * 0.00041 + 0.4);
    return 0.05 + 0.95 * Math.pow(v, 2.4);
  };

  /* физика одинакова для постоянной воды и краткого залпа: меняется
     только количество частиц, а не траектория, препятствия или слой рендера. */
  const stepParticle = (p, dt, speedGain, depositGain) => {
    const nearCur = Math.hypot(p.x - mx, p.y - my);
    const a = flowAngle(p.x, p.y, phase);
    const sp = (46 + 30 * hash(p.x | 0, 13)) * speedGain;
    let ax = Math.cos(a) * sp, ay = Math.sin(a) * sp;
    if (nearCur < 90 && nearCur > 1) {
      const f = (1 - nearCur / 90) * 240;
      ax += ((p.x - mx) / nearCur) * f; ay += ((p.y - my) / nearCur) * f * 0.6;
    }
    p.vx += (ax - p.vx) * Math.min(dt * 4, 1);
    p.vy += (ay - p.vy) * Math.min(dt * 4, 1);
    let nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    if (isRock(nx, ny)) {
      const leftFree = !isRock(nx - CELL_W, p.y), rightFree = !isRock(nx + CELL_W, p.y);
      if (leftFree === rightFree) { ny = p.y; nx = p.x + (hash(p.x, p.y) < 0.5 ? -1 : 1) * CELL_W * 2 * dt * 8; }
      else nx = p.x + (rightFree ? 1 : -1) * CELL_W * 2 * dt * 8;
      if (isRock(nx, ny)) { nx = p.x; ny = p.y - CELL_H * dt * 4; }
    }
    p.x = nx; p.y = ny;
    if (p.y > H + 20 || p.x < -30 || p.x > W + 30) { spawn(p, true); return; }
    const ci = ((p.y / CELL_H) | 0) * COLS + ((p.x / CELL_W) | 0);
    if (ci >= 0 && ci < moist.length && !obst[ci]) moist[ci] = Math.min(1, moist[ci] + DEPOSIT * depositGain);
  };
  const stepParts = dt => {
    const now = performance.now(), rr = impulseState(now);
    const baseSpeed = 1 + (rr ? rr.power * rr.speed : 0), baseDeposit = 1 + (rr ? rr.power * rr.deposit : 0);
    for (const p of parts) stepParticle(p, dt, baseSpeed, baseDeposit * boost * rhythmAt(p.y + scrollY));
    if (holding && holdPreview && impulse && impulse.scope === "hold" && now - holdPreview.lastEmit > 170) {
      const heldFor = now - holdPreview.t0;
      const count = Math.round(900 + Math.min(2600, heldFor * 0.65));
      holdPreview.lastEmit = now;
      addSurge(holdPreview.cfg, impulse.seed + heldFor * 0.19, count, now, holdPreview.token);
    }
    for (let i = surgeParts.length - 1; i >= 0; i--) {
      const p = surgeParts[i];
      if (now >= p.until) { surgeParts.splice(i, 1); continue; }
      const age = (now - p.t0) / (p.until - p.t0), power = Math.sin(age * Math.PI);
      stepParticle(p, dt, 1 + power * p.speed, 1 + power * p.deposit);
    }
  };

  const renderTeamReassembly = now => {
    const state = teamHover;
    if (!state) return;
    const r = state.card.getBoundingClientRect();
    if (r.width < 2 || r.bottom < 0 || r.top > H) return;
    if (now >= state.nextSwap) {
      nextTeamOrder(state);
      state.nextSwap = now + 1180;
    }
    const appear = Math.min(1, (now - state.entered) / 260);
    const seed = state.seed + state.cycle * 17.3;
    const step = Math.floor((now - state.entered) / 120);
    const c0 = Math.floor(r.left / CELL_W), c1 = Math.ceil(r.right / CELL_W);
    ctx.save();
    ctx.font = FONT; ctx.textBaseline = "top";
    for (let cx = c0; cx <= c1; cx++) {
      const x = cx * CELL_W, u = (x - r.left) / Math.max(1, r.width);
      if (u < 0 || u > 1) continue;
      for (let lane = 0; lane < 4; lane++) {
        const center = r.top + r.height * (.18 + lane * .22) +
          Math.sin(u * 8.6 + lane * 2.1 + now * .0014 + seed) * CELL_H * 1.15;
        const cy = Math.round(center / CELL_H), y = cy * CELL_H;
        const gate = hash(cx * 7 + seed + step * .31, cy * 5 - seed + lane * 13);
        if (gate > .44 + .32 * Math.sin(u * Math.PI)) continue;
        const pool = lane > 1 ? POOL_MID : POOL_LOW;
        const glyph = pool[(hash(cx * 11 + seed, cy * 17 - seed + step) * pool.length) | 0];
        const chroma = hash(cx * 19 + lane, cy * 23 + seed) > .88;
        ctx.fillStyle = chroma ? (lane % 2 ? "#1FB6D1" : "#C50D17") : INK;
        ctx.globalAlpha = appear * (.18 + .34 * (1 - Math.abs(.5 - u)));
        ctx.fillText(glyph, x, y);
        if (gate < .16 && u > .18) {
          ctx.globalAlpha *= .48;
          ctx.fillText("·", x, y + CELL_H);
        }
      }
    }
    ctx.restore();
  };

  /* ── цикл ── */
  let running = true, prev = performance.now();
  const frame = now => {
    if (!running) return;
    requestAnimationFrame(frame);
    if(innerWidth<=960 && scrollY+innerHeight<heroDocBottom){
      if(!frame.heroPaused){ctx.clearRect(0,0,W,H);frame.heroPaused=true;}
      prev=now;return;
    }
    frame.heroPaused=false;
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;

    if (!warmed && !ensureInit()) return;
    boost += (1 - boost) * Math.min(dt * 1.6, 1);
    if (obstDirty && now - lastObstAt > 160) { buildObstacles(); obstDirty = false; lastObstAt = now; }

    const idle = now - lastActivity > IDLE_MS;
    phase = now * (idle ? 2.6 : 1);              // в паузе река ищет новое русло
    if (idle && !boat && hash(now | 0, 7) > 0.6) startBoat();
    stepParts(dt);

    /* кораблик */
    if (boat) {
      const a = flowAngle(boat.x, boat.y, phase);
      let bx = boat.x + Math.cos(a) * 60 * dt, by = boat.y + Math.sin(a) * 60 * dt;
      if (isRock(bx, by)) { bx = boat.x + (isRock(bx + CELL_W, by) ? -1 : 1) * CELL_W * 6 * dt; by = boat.y; }
      boat.x = bx; boat.y = by;
      boat.trail.push([bx, by]);
      if (boat.trail.length > 10) boat.trail.shift();
      if (boat.y > H + 20) boat = null;
    }

    /* рендер */
    ctx.clearRect(0, 0, W, H);
    const rr = impulseState(now);
    for (let cy = 0; cy < ROWS; cy++) {
      const y = cy * CELL_H;
      if (y + scrollY < heroDocBottom) continue;          /* не заходим в хиро */
      for (let cx = 0; cx < COLS; cx++) {
        const ci = cy * COLS + cx;
        const m = moist[ci];
        if (m < BANDS[0][0]) { moist[ci] *= rr ? 0.982 : DECAY; continue; }
        const pool = m >= BANDS[2][0] ? POOL_HIGH : m >= BANDS[1][0] ? POOL_MID : POOL_LOW;
        const rk = rr ? rr.seed * 0.071 + rr.step * 1.31 : 0;
        const glyph = pool[(hash(cx * 7 + 1 + rk, cy * 3 + 5 - rk * 0.43) * pool.length) | 0];
        const impulseAlpha = rr ? (rr.scope === "hold" ? 0.9 : 0.76) : 0.42;
        ctx.globalAlpha = Math.min(impulseAlpha, 0.1 + m * (0.38 + (rr ? rr.power * 0.3 : 0)));
        /* Цвет — только на третьем быстром клике, редко и только пока длится пересчёт. */
        const chroma = rr && rr.color && m >= BANDS[1][0] && hash(cx * 11 + rk, cy * 17 - rk) > 0.972;
        ctx.fillStyle = chroma ? (hash(cx + rk, cy - rk) > 0.5 ? "#0E8AA0" : "#C50D17") : INK;
        const weightNearMouse = rr && rr.scope === "hold" && rr.origin &&
          Math.hypot(cx * CELL_W - rr.origin.x, y - rr.origin.y) < 132 && hash(cx * 5 + rk, cy * 7 - rk) > 0.38;
        if (weightNearMouse) { ctx.font = '700 12px "JetBrains Mono", ui-monospace, monospace'; ctx.globalAlpha = Math.min(0.9, ctx.globalAlpha + 0.16); }
        ctx.fillText(glyph, cx * CELL_W, y);
        if (weightNearMouse) ctx.font = FONT;
        moist[ci] *= rr ? 0.982 : DECAY;
      }
    }
    ctx.globalAlpha = 1;
    if (boat && boat.y + scrollY > heroDocBottom) {
      ctx.fillStyle = INK;
      boat.trail.forEach(([tx, ty], i) => {
        ctx.globalAlpha = (i + 1) / boat.trail.length * 0.5;
        ctx.fillText("·", tx, ty);
      });
      ctx.globalAlpha = 1;
      ctx.fillText("▸", boat.x, boat.y);   // ▸
    }
    renderTeamReassembly(now);
  };

  /* инициализация только при живом вьюпорте: фоновая вкладка даёт 0×0 */
  let warmed = false;
  const warmup = () => {
    for (const p of parts) spawn(p, false);
    for (let i = 0; i < 150; i++) {
      phase = performance.now() + i * 16;
      stepParts(1 / 60);
      if (i % 3 === 0) for (let j = 0; j < moist.length; j++) moist[j] *= 0.985;
    }
    for (let j = 0; j < moist.length; j++) moist[j] *= 0.5;
  };
  const ensureInit = () => {
    if (innerWidth < 2 || innerHeight < 2) return false;
    if (W !== innerWidth || H !== innerHeight || !warmed) resize();
    if (!warmed) { buildObstacles(); warmup(); warmed = true; }
    return true;
  };
  ensureInit();
  addEventListener("resize", () => { ensureInit(); }, { passive: true });
  requestAnimationFrame(frame);

  /* диагностика (только чтение) */
  window.__ruslo = {
    stats() {
      let wet = 0, rock = 0, sum = 0;
      for (let i = 0; i < moist.length; i++) { if (moist[i] > 0.06) wet++; sum += moist[i]; }
      for (let i = 0; i < obst.length; i++) rock += obst[i];
      const ys = parts.slice(0, 8).map(p => [p.x | 0, p.y | 0]);
      return { COLS, ROWS, wet, rock, total: moist.length, sum: +sum.toFixed(1), sample: ys, running };
    },
    steps(n) { for (let i = 0; i < n; i++) { phase = performance.now() + i * 16; stepParts(1 / 60); } return this.stats(); }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) running = false;
    else {
      ensureInit();
      if (!running) { running = true; prev = performance.now(); requestAnimationFrame(frame); }
    }
  });
})();

