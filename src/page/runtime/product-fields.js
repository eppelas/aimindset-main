
// ————— PRODUCT FIELDS V2 —————
// Craft-quality direction: a shared 9px field language, but a separate physical
// law for every product. These canvases are decoration only: never put product
// copy in this script and never rewrite user-owned HTML while changing motion.
// This block is the sole runtime owner of every [data-kinetic-scene] canvas.
(() => {
  const roots = [...document.querySelectorAll("[data-kinetic-scene]")];
  if (!roots.length) return;

  const reduced = false;  /* Обработка prefers-reduced-motion снята намеренно: страница показывает одно и то же на любой машине. */
  const finePointer = matchMedia("(hover:hover) and (pointer:fine)").matches;
  const C = {
    ink: "#05070a", paper: "#f4f4ef", acid: "#0E8AA0", platformAcid: "#bf0909",
    blue: "#0E8AA0", ice: "#1FB6D1", violet: "#9E1727",
    space: "#7b55ad", spaceLight: "#9a7bc8",   /* цвет space/комьюнити — фиолетовый чипа {s} */
    mint: "#6B7280", amber: "#9E1727", gold: "#bf0909",
    red: "#bf0909", pink: "#9E1727", bank: "#e2e2dc"
  };
  const TAU = Math.PI * 2;
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const rand = seed => {
    let n = seed >>> 0;
    return () => ((n = Math.imul(n, 1664525) + 1013904223 >>> 0) / 4294967296);
  };
  const rgba = (hex, alpha) => {
    const v = parseInt(hex.slice(1), 16);
    return `rgba(${v >> 16},${v >> 8 & 255},${v & 255},${alpha})`;
  };
  const rr = (ctx, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };
  const line = (ctx, points, color, width = 1, dash = []) => {
    if (points.length < 2) return;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke(); ctx.restore();
  };
  const grid = (ctx, w, h, color, step = 36) => {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = .5; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = .5; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke(); ctx.restore();
  };
  const glow = (ctx, x, y, radius, color, alpha) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, rgba(color, alpha)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };
  const cursor = (s, color) => {
    if (!s.active || !finePointer) return;
    const { ctx, w, h } = s, x = s.pointer.x * w, y = s.pointer.y * h;
    ctx.save(); ctx.strokeStyle = rgba(color, .9); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, 11 + s.hit * 15, 0, TAU); ctx.stroke();
    ctx.fillStyle = color; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.restore();
  };
  const pixelAtmosphere = (s, color, density = .28, cell = 9) => {
    const { ctx, w, h, time } = s;
    const px = s.pointer.x * w, py = s.pointer.y * h;
    ctx.save();
    for (let y = cell / 2; y < h; y += cell) {
      for (let x = cell / 2; x < w; x += cell) {
        const wave = Math.sin(x * .035 + time * .00042 + s.seed) + Math.cos(y * .043 - time * .0003);
        const near = 1 - clamp(Math.hypot(x - px, y - py) / Math.max(80, Math.min(w, h) * .45));
        const energy = wave * .5 + near * (s.active ? 1.4 : .15) + s.hit * near * 2;
        if (energy < 1.15 - density) continue;
        const size = energy > 1.25 ? 3 : 1.5;
        ctx.fillStyle = rgba(color, .08 + clamp(energy * .09, 0, .22));
        ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
      }
    }
    ctx.restore();
  };

  function stateFor(root, i) {
    const type = root.dataset.kineticScene;
    const r = rand(7703 + i * 809);
    const s = {
      root, canvas: root.querySelector("canvas"), ctx: null, type, r,
      seed: r() * 20, w: 1, h: 1, dpr: 1, visible: false, active: false,
      pointer: { x: .5, y: .5, tx: .5, ty: .5 }, time: 0,
      hit: 0, pulse: 0, mode: 0, scroll: .5, data: {}
    };
    s.ctx = s.canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (type === "platform") {
      s.data.bits = Array.from({ length: 84 }, (_, n) => ({
        y: r(), phase: r(), speed: .65 + r() * 1.1, size: n % 11 === 0 ? 6 : n % 4 === 0 ? 4 : 2,
        lane: n % 6, tone: n % 13 === 0 ? C.platformAcid : n % 7 === 0 ? C.mint : n % 3 === 0 ? C.ice : C.ink
      }));
    }
    if (type === "space") {
      s.data.cells = Array.from({ length: 46 }, (_, n) => ({
        angle: r() * TAU, radius: .12 + r() * .34, speed: .45 + r() * .85,
        size: n % 9 === 0 ? 8 : 3 + r() * 4, phase: r() * TAU, kind: n % 4
      }));
      s.data.rings = [];
    }
    if (type === "consulting") {
      s.data.fragments = Array.from({ length: 98 }, (_, n) => ({
        x: r(), y: r(), a: r() * TAU, len: 5 + r() * 24,
        phase: r() * TAU, bright: n % 12 === 0
      }));
      s.data.pinned = false;
    }
    if (type === "nonprofit") {
      s.data.plants = Array.from({ length: 3 }, (_, n) => ({
        x: [.28, .52, .76][n], y: [.55, .30, .52][n], phase: r() * TAU,
        drift: .72 + r() * .48, chosen: false
      }));
      s.data.motes = Array.from({ length: 34 }, (_, n) => ({
        plant: n % 3, phase: r(), speed: .38 + r() * .76, offset: (r() - .5) * .14,
        size: n % 8 === 0 ? 3.3 : 1.3 + r() * 1.8
      }));
      s.data.pulses = [];
      /* Three distinct initiatives become a shared, load-bearing weave.
         The original growth study stays above as rollback material; this is
         deliberately a different visual law, not a tweak to the plant. */
      s.data.weave = Array.from({ length: 19 }, (_, n) => ({
        lane: n % 3, phase: r() * TAU, drift: .5 + r() * .8,
        weight: n % 7 === 0 ? 1.4 : n % 4 === 0 ? 1.05 : .7
      }));
      s.data.commonsPulses = [];
      s.data.imprintRead = 0;
      s.data.voiceMarks = Array.from({ length: 54 }, (_, n) => ({
        voice: n % 3, phase: r() * TAU, rank: Math.floor(n / 3),
        wobble: .45 + r() * .9, size: 1.2 + r() * 2.4
      }));
      s.data.clearingMarks = Array.from({ length: 188 }, (_, n) => ({
        x: .055 + r() * .89, y: .09 + r() * .82, phase: r() * TAU,
        size: n % 13 === 0 ? 3.4 : n % 5 === 0 ? 2.3 : 1.15 + r() * 1.05,
        kind: n % 4
      }));
      s.data.mobile = { tilt: -.035, target: -.035, impulse: 0 };
      s.data.press = { read: 0, registration: .35, rotation: 0, cycle: 0 };
      s.data.rhizome = [
        { x:.18, y:.29, phase:r()*TAU, tone:'#1F2937' },
        { x:.46, y:.76, phase:r()*TAU, tone:'#bf0909' },
        { x:.79, y:.34, phase:r()*TAU, tone:'#1F2937' }
      ];
      s.data.rhizomePulses = [];
      s.data.mycelium = Array.from({ length: 18 }, (_, n) => ({
        phase:r()*TAU, lane:n%3, reach:.48+r()*.45, curl:(r()-.5)*.22
      }));
      s.data.nursery = { pulse: 0, wave: 0 };
    }
    return s;
  }

  const states = roots.map(stateFor);

  function resize(s) {
    const box = s.root.getBoundingClientRect();
    s.w = Math.max(1, box.width); s.h = Math.max(1, box.height);
    s.dpr = Math.min(devicePixelRatio || 1, 2);
    s.canvas.width = Math.round(s.w * s.dpr); s.canvas.height = Math.round(s.h * s.dpr);
    s.canvas.style.width = `${s.w}px`; s.canvas.style.height = `${s.h}px`;
    s.ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  }
  const point = (s, e) => {
    const b = s.root.getBoundingClientRect();
    return { x: clamp((e.clientX - b.left) / b.width), y: clamp((e.clientY - b.top) / b.height) };
  };

  states.forEach(s => {
    new ResizeObserver(() => { resize(s); draw(s, performance.now(), 0); }).observe(s.root);
    s.root.addEventListener("pointerenter", e => {
      if (!finePointer) return;
      s.active = true; s.root.classList.add("is-active");
      Object.assign(s.pointer, { tx: point(s, e).x, ty: point(s, e).y });
    });
    s.root.addEventListener("pointermove", e => {
      if (!finePointer) return;
      const p = point(s, e); s.pointer.tx = p.x; s.pointer.ty = p.y;
      s.root.style.setProperty("--scene-x", `${p.x * 100}%`);
      s.root.style.setProperty("--scene-y", `${p.y * 100}%`);
    }, { passive: true });
    s.root.addEventListener("pointerleave", () => {
      if (s.type === "consulting" && s.data.pinned) return;
      s.active = false; s.root.classList.remove("is-active");
    });
    s.root.addEventListener("pointerdown", e => {
      if (document.body.classList.contains("editing")) return;
      const p = point(s, e); s.pointer.tx = p.x; s.pointer.ty = p.y;
      s.active = true; s.root.classList.add("is-active"); s.hit = 1; s.pulse = 1; s.mode++;
      if (s.type === "space") s.data.rings.push({ x: p.x, y: p.y, age: 0 });
      if (s.type === "consulting") s.data.pinned = !s.data.pinned;
      if (s.type === "nonprofit") {
        const plant = s.data.plants.map((item, index) => ({ index, distance: Math.hypot(item.x - p.x, item.y - p.y) }))
          .sort((a, b) => a.distance - b.distance)[0].index;
        s.data.pulses.push({ plant, age: 0 });
        if (s.data.pulses.length > 3) s.data.pulses.shift();
        s.data.commonsPulses.push({ x: p.x, y: p.y, age: 0, mode: s.mode });
        if (s.data.commonsPulses.length > 2) s.data.commonsPulses.shift();
        s.data.mobile.target = (p.x - .5) * .34;
        s.data.mobile.impulse = .78;
        s.data.press.cycle = 1;
        s.data.rhizomePulses.push({x:p.x,y:p.y,age:0});
        if (s.data.rhizomePulses.length > 2) s.data.rhizomePulses.shift();
        s.data.nursery.pulse = 1;
      }
    });
    if (s.type === "teams" || s.type === "nonprofit") {
      const releaseTouch = () => {
        if (finePointer) return;
        s.active = false; s.root.classList.remove("is-active");
      };
      s.root.addEventListener("pointerup", releaseTouch);
      s.root.addEventListener("pointercancel", releaseTouch);
    }
  });

  function drawPlatform(s) {
    const { ctx, w, h, data, time } = s;
    ctx.fillStyle = "#f4f4ef"; ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, rgba(C.ink, .075), 36); pixelAtmosphere(s, C.ice, .17);
    const gateX = w * .48, matrixX = w * .61, top = h * .15;
    const rows = 6, cols = 4, gap = 7;
    const cw = Math.max(24, Math.min(55, (w - matrixX - 20 - gap * 3) / 4));
    const ch = Math.max(15, Math.min(27, (h * .7 - gap * 5) / 6));
    const px = s.pointer.x * w, py = s.pointer.y * h;
    glow(ctx, px, py, Math.max(90, w * .25), C.ice, s.active ? .10 : .025);

    ctx.fillStyle = rgba(C.ink, .07); ctx.fillRect(gateX - 7, h * .08, 14, h * .84);
    ctx.fillStyle = C.platformAcid;
    for (let y = h * .12; y < h * .88; y += 18) ctx.fillRect(gateX - 1, y, 2, 8);

    data.bits.forEach((b, i) => {
      const t = (b.phase + time * .000055 * b.speed) % 1;
      let x, y, alpha;
      if (t < .58) {
        const q = smooth(t / .58);
        x = mix(-20, gateX - 10, q);
        y = h * (.12 + b.y * .76) + Math.sin(time * .002 + i) * 5;
        alpha = .18 + q * .7;
      } else {
        const q = smooth((t - .58) / .42);
        const col = b.lane % cols, row = Math.floor(i / cols) % rows;
        x = mix(gateX + 9, matrixX + col * (cw + gap) + cw / 2, q);
        y = mix(h / 2, top + row * (ch + gap) + ch / 2, q);
        alpha = .9 - q * .35;
      }
      const dx = x - px, dy = y - py, d = Math.max(1, Math.hypot(dx, dy));
      if (s.active && d < 85) { const push = (1 - d / 85) * (12 + s.hit * 28); x += dx / d * push; y += dy / d * push; }
      if (s.hit > .01) { x += Math.cos(i * 2.399) * s.hit * 24; y += Math.sin(i * 2.399) * s.hit * 24; }
      ctx.fillStyle = rgba(b.tone, alpha); ctx.fillRect(Math.round(x), Math.round(y), b.size * 2.2, b.size);
    });

    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const x = matrixX + col * (cw + gap), y = top + row * (ch + gap);
      const chosen = ((row + col * 2 + s.mode) % 9 === 0) && s.hit > .08;
      ctx.fillStyle = chosen ? C.platformAcid : rgba(C.ink, .07 + ((row + col) % 3) * .025);
      rr(ctx, x, y, cw, ch, 2); ctx.fill();
      ctx.fillStyle = chosen ? C.ink : rgba(C.ink, .48);
      ctx.fillRect(x + 6, y + 6, cw * (.28 + ((row + col) % 3) * .13), 2);
      if (ch > 19) ctx.fillRect(x + 6, y + 12, cw * (.18 + (row % 2) * .16), 1);
    }
    ctx.strokeStyle = rgba(C.platformAcid, .92); ctx.lineWidth = 1;
    ctx.strokeRect(matrixX - 9, top - 9, cols * (cw + gap) - gap + 18, rows * (ch + gap) - gap + 18);
    cursor(s, C.platformAcid);
  }

  function drawSpace(s, dt) {
    const { ctx, w, h, data, time } = s;
    const gsp = ctx.createLinearGradient(0, 0, w, h); gsp.addColorStop(0, "#f4f4ef"); gsp.addColorStop(1, "#ece7f4");   /* блок {space} живёт в фиолетовом — цвет чипа {s} */
    ctx.fillStyle = gsp; ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, rgba(C.spaceLight, .13), 36); pixelAtmosphere(s, C.space, .25);
    const cx = w * .5, cy = h * .42, px = s.pointer.x * w, py = s.pointer.y * h;
    glow(ctx, cx, cy, Math.max(w, h) * .46, C.space, .055);
    const pos = data.cells.map((cell, i) => {
      const breath = 1 + Math.sin(time * .0011 + cell.phase) * (.06 + s.hit * .07);
      const a = cell.angle + Math.sin(time * .00025 * cell.speed + cell.phase) * .28;
      let x = cx + Math.cos(a) * cell.radius * w * breath;
      let y = cy + Math.sin(a * 1.13) * cell.radius * h * 1.18 * breath;
      const dx = x - px, dy = y - py, d = Math.max(1, Math.hypot(dx, dy));
      if (s.active && d < 125) { const force = (1 - d / 125) * (s.mode % 2 ? -24 : 18); x += dx / d * force; y += dy / d * force; }
      return { x, y, cell, i };
    });
    pos.forEach((a, i) => {
      const links = pos.map((b, j) => ({ b, j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
        .filter(v => v.j !== i).sort((u, v) => u.d - v.d).slice(0, 2);
      links.forEach(({ b, j, d }) => {
        if (j < i || d > Math.min(w, h) * .38) return;
        const hot = s.active && Math.min(Math.hypot(a.x - px, a.y - py), Math.hypot(b.x - px, b.y - py)) < 100;
        ctx.strokeStyle = hot ? rgba(C.spaceLight, .9) : rgba(i % 4 ? C.space : C.violet, .34);
        ctx.lineWidth = hot ? 1.6 : 1; ctx.beginPath(); ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo((a.x + b.x) / 2 + Math.sin(i) * 12, (a.y + b.y) / 2 + Math.cos(j) * 12, b.x, b.y); ctx.stroke();
      });
    });
    pos.forEach(({ x, y, cell, i }) => {
      const color = i % 7 === 0 ? C.mint : i % 4 === 0 ? C.violet : C.spaceLight;
      const size = cell.size * (1 + s.hit * .35);
      ctx.fillStyle = rgba(color, .9);
      if (cell.kind === 0) ctx.fillRect(x - size, y - size, size * 2, size * 2);
      else if (cell.kind === 1) { ctx.strokeStyle = color; ctx.strokeRect(x - size, y - size, size * 2, size * 2); }
      else { ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); cell.kind === 2 ? ctx.fill() : ctx.stroke(); }
    });
    data.rings.forEach(r => r.age += dt * .001);
    data.rings = data.rings.filter(r => r.age < 1.45);
    data.rings.forEach(r => {
      const q = r.age / 1.45; ctx.strokeStyle = rgba(C.acid, (1 - q) * .85); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r.x * w, r.y * h, q * Math.min(w, h) * .62, 0, TAU); ctx.stroke();
    });
    cursor(s, C.spaceLight);
  }

  function drawTeams(s) {
    const { ctx, w, h, time } = s;
    const mobile=matchMedia("(max-width:960px)").matches, ink=mobile?C.ink:C.paper;
    ctx.fillStyle = mobile?"#f4f4ef":"#050505"; ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, rgba(ink, .055), 36); pixelAtmosphere(s, ink, .12, 9);
    const px = s.pointer.x * w, py = s.pointer.y * h;
    const strands = mobile?["#050505", "#777772"]:["#f4f4f1", "#969692"];
    const paths = strands.map((color, strand) => {
      const pts = [];
      for (let x = -12; x <= w + 12; x += 7) {
        const phase = x / Math.max(80, w * .19) + time * .0011 + strand * Math.PI;
        let y = h / 2 + Math.sin(phase) * h * .27;
        const d = Math.hypot(x - px, y - py);
        if (s.active && d < 95) y += (y - py) / Math.max(1, d) * (1 - d / 95) * 48;
        y += Math.sin(phase * 2) * s.hit * h * .16;
        pts.push({ x, y });
      }
      line(ctx, pts, rgba(color, strand === 0 ? .95 : .68), strand === 0 ? 1.55 : 1.15);
      for (let n = 0; n < 5; n++) {
        const q = (time * .00011 + n / 5 + strand * .09) % 1;
        const position = q * (pts.length - 1);
        const index = Math.floor(position);
        const next = pts[Math.min(pts.length - 1, index + 1)];
        const current = pts[index];
        const p = { x: mix(current.x, next.x, position - index), y: mix(current.y, next.y, position - index) };
        ctx.fillStyle = color; ctx.fillRect(p.x - 2.5, p.y - 2, 5, 4);
      }
      return pts;
    });
    for (let i = 1; i < paths[0].length; i += 3) {
      const a = paths[0][i], b = paths[1][i];
      ctx.strokeStyle = rgba(ink, .24); ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    glow(ctx, px, py, 95, ink, s.active ? .07 : .012); cursor(s, ink);
  }

  function drawConsulting(s) {
    const { ctx, w, h, data, time } = s;
    const mobile=matchMedia("(max-width:960px)").matches;
    ctx.fillStyle = mobile?"#050505":"#f4f4ef"; ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, rgba(C.red, .09), 27); pixelAtmosphere(s, C.red, .2, 9);
    const ax = .5 + Math.sin(time * .00038 + s.seed) * .17;
    const ay = .49 + Math.cos(time * .00031 + s.seed) * .13;
    const fx = (s.active || data.pinned ? s.pointer.x : ax) * w;
    const fy = (s.active || data.pinned ? s.pointer.y : ay) * h;
    const radius = Math.max(60, Math.min(115, Math.min(w, h) * .48));
    data.fragments.forEach((f, i) => {
      let x = f.x * w, y = f.y * h;
      const dx = fx - x, dy = fy - y, d = Math.hypot(dx, dy);
      const inside = smooth(1 - d / radius);
      const raw = f.a + Math.sin(time * .00055 + f.phase) * .2;
      const target = Math.atan2(dy, dx) + Math.PI / 2;
      const a = mix(raw, target, inside);
      const len = f.len * (1 + inside * 1.05);
      if (s.hit > 0) { x += Math.cos(i * 2.4) * s.hit * 18; y += Math.sin(i * 2.4) * s.hit * 18; }
      ctx.strokeStyle = inside > .02 ? rgba(f.bright ? C.acid : C.pink, .30 + inside * .70) : rgba(mobile?C.paper:C.ink, .16);
      ctx.lineWidth = f.bright ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2);
      ctx.lineTo(x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2); ctx.stroke();
    });
    glow(ctx, fx, fy, radius, C.red, .10 + s.hit * .08);
    ctx.strokeStyle = data.pinned ? C.acid : C.red; ctx.lineWidth = 2;
    [1, .66].forEach(scale => { ctx.beginPath(); ctx.arc(fx, fy, radius * scale, 0, TAU); ctx.stroke(); });
    const marker = 7 + s.hit * 5;
    ctx.fillStyle = data.pinned ? C.acid : C.red;
    ctx.fillRect(fx - marker / 2, fy - marker / 2, marker, marker);
    cursor(s, data.pinned ? C.acid : C.red);
  }

  function drawNonprofit(s) {
    const { ctx, w, h, data, time } = s;
    ctx.fillStyle = "#f4f4ef"; ctx.fillRect(0, 0, w, h);
    grid(ctx, w, h, rgba(C.ink, .07), 32);
    const gapA = w * .36, gapB = w * .64, px = s.pointer.x * w, py = s.pointer.y * h;
    ctx.fillStyle = rgba(C.ink, .035); ctx.fillRect(0, 0, gapA - 6, h); ctx.fillRect(gapB + 6, 0, w - gapB - 6, h);
    const routeY = (x, lane) => {
      const base = h * (.28 + lane * .22);
      const q = clamp((x - gapA) / Math.max(1, gapB - gapA));
      let y = base - Math.sin(q * Math.PI) * (12 + lane * 3);
      if (s.active) {
        const influence = smooth(clamp(1 - Math.abs(x - px) / Math.max(62, w * .2)));
        y = mix(y, py, influence * .22);
        y -= Math.sin(influence * Math.PI) * s.hit * (6 + lane * 2);
      }
      return y;
    };
    data.blocks.forEach((b, i) => {
      const q = (b.phase + time * .000068 * (1 + b.lane * .1)) % 1;
      let x = mix(-10, w + 10, q);
      const yy = routeY(x, b.lane);
      ctx.fillStyle = b.lane === 1 ? "#0E8AA0" : rgba(C.ink, .84);
      ctx.fillRect(x - b.size, yy - b.size / 2, b.size * 2, b.size);
    });
    for (let lane = 0; lane < 3; lane++) {
      const pts = [];
      for (let x = 0; x <= w; x += 5) pts.push({ x, y: routeY(x, lane) });
      line(ctx, pts, lane === 1 ? "#0E8AA0" : rgba(C.ink, .74), lane === 1 ? 1.6 : 1.1, lane === 2 ? [6, 6] : []);
    }
    [gapA, gapB].forEach(x => { ctx.fillStyle = rgba(C.ink, .82); ctx.fillRect(x - 2, h * .12, 4, h * .76); ctx.fillStyle = "#0E8AA0"; ctx.fillRect(x, h * .19, 1, h * .62); });
    cursor(s, C.ink);
  }

  function drawNonprofitGrowth(s) {
    const { ctx, w, h, data, time } = s;
    const px = s.pointer.x * w, py = s.pointer.y * h, rootX = w * .50, rootY = h * .90;
    ctx.fillStyle = ink; ctx.fillRect(0, 0, w, h);
    /* Three projects share one root system: practice travels in both
       directions, from the common ground outward and back into it. */
    const tipFor = (plant, i) => {
      const d = Math.hypot(plant.x * w - px, plant.y * h - py);
      const care = s.active ? smooth(1 - d / Math.max(50, w * .34)) : 0;
      const sway = Math.sin(time * .00072 * plant.drift + plant.phase) * w * .016;
      return { x: plant.x * w + sway + (px - plant.x * w) * care * .12, y: plant.y * h + (py - plant.y * h) * care * .09, care };
    };
    const tips = data.plants.map(tipFor);
    const bezier = (a, b, c, d, u) => {
      const v = 1 - u;
      return { x: v*v*v*a.x + 3*v*v*u*b.x + 3*v*u*u*c.x + u*u*u*d.x, y: v*v*v*a.y + 3*v*v*u*b.y + 3*v*u*u*c.y + u*u*u*d.y };
    };
    for (let i = 0; i < 34; i++) {
      const a = i * 2.399 + Math.sin(time * .00017 + i) * .08;
      const rr = (5 + (i % 7) * 1.7) * (1 + s.hit * .12);
      const x = rootX + Math.cos(a) * rr * 1.5, y = rootY + Math.sin(a) * rr * .55;
      ctx.fillStyle = i % 8 === 0 ? 'rgba(191,9,9,.72)' : 'rgba(23,56,46,.78)';
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    tips.forEach((tip, i) => {
      const cp1 = { x: mix(rootX, tip.x, .20) + (i - 1) * w * .13, y: rootY - h * (.10 + i * .02) };
      const cp2 = { x: mix(rootX, tip.x, .72) - (i - 1) * w * .055, y: tip.y + h * .14 };
      ctx.strokeStyle = tip.care > .22 ? 'rgba(191,9,9,.94)' : 'rgba(23,56,46,.82)';
      ctx.lineWidth = 1.3 + tip.care * 1.35; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(rootX, rootY); ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, tip.x, tip.y); ctx.stroke();
      for (let j = 1; j < 5; j++) {
        const u = j / 5, p = bezier({x:rootX,y:rootY}, cp1, cp2, tip, u);
        const ang = -1.42 + (j - 2) * .32 + Math.sin(time * .00053 + i + j) * .12;
        const len = (5 + j * 1.8) * (1 + tip.care * .55);
        ctx.strokeStyle = 'rgba(23,56,46,.40)'; ctx.lineWidth = .8; ctx.beginPath();
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(ang) * len, p.y + Math.sin(ang) * len); ctx.stroke();
      }
      ctx.save(); ctx.translate(tip.x, tip.y); ctx.rotate((i - 1) * .11 + Math.sin(time * .0006 + i) * .07);
      const leaf = 10 + tip.care * 8;
      ctx.fillStyle = i === s.mode % 3 && s.active ? '#bf0909' : '#1F2937';
      [-1, 1].forEach(side => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * leaf * .88, -leaf * .95, side * leaf * 1.16, -leaf * .04); ctx.quadraticCurveTo(side * leaf * .46, leaf * .15, 0, 0); ctx.fill(); });
      ctx.fillStyle = '#f4f4ef'; ctx.fillRect(-2.4, -2.4, 4.8, 4.8); ctx.restore();
    });
    data.motes.forEach((m, i) => {
      const tip = tips[m.plant], phase = (m.phase + time * .00010 * m.speed) % 1;
      const cp1 = { x: mix(rootX, tip.x, .20) + (m.plant - 1) * w * .13, y: rootY - h * (.10 + m.plant * .02) };
      const cp2 = { x: mix(rootX, tip.x, .72) - (m.plant - 1) * w * .055, y: tip.y + h * .14 };
      const q = phase < .5 ? phase * 2 : 2 - phase * 2;
      const p = bezier({x:rootX,y:rootY}, cp1, cp2, tip, q);
      const side = (m.offset + Math.sin(time * .001 + i) * .012) * w;
      ctx.fillStyle = m.plant === s.mode % 3 && s.active ? 'rgba(191,9,9,.95)' : 'rgba(23,56,46,.46)';
      ctx.fillRect(p.x + side - m.size * .5, p.y - m.size * .5, m.size, m.size);
    });
    if (s.active) {
      const r = Math.min(w, h) * (.09 + smooth(1 - Math.hypot(px - rootX, py - rootY) / Math.max(w, h)) * .12);
      ctx.strokeStyle = 'rgba(191,9,9,.60)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    data.pulses.forEach(pulse => {
      pulse.age += .018; const q = clamp(pulse.age / 1.2), from = tips[pulse.plant];
      ctx.strokeStyle = `rgba(191,9,9,${(1 - q) * .76})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(from.x, from.y, q * Math.min(w, h) * .72, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(23,56,46,${(1 - q) * .38})`; ctx.beginPath(); ctx.arc(rootX, rootY, q * Math.min(w, h) * .46, 0, TAU); ctx.stroke();
    });
    data.pulses = data.pulses.filter(pulse => pulse.age < 1.2);
    ctx.lineCap = 'butt';
  }

  /* Non-profit: three individual initiatives are held by one shared weave.
     It is a field of support, not a plant, a bridge, or a generic icon.
     Hover acts like a loom: the existing threads draw toward the pointer and
     reveal how a common structure can carry different projects together. */
  function drawNonprofitCommons(s, dt) {
    const { ctx, w, h, data, time } = s;
    const px = s.pointer.x * w, py = s.pointer.y * h;
    const left = w * .14, right = w * .88, top = h * .17, bottom = h * .81;
    const cx = w * .54, cy = h * .49;
    const pull = s.active ? .82 : .16;
    const ink = '#1F2937', sage = '#6B7280', warm = '#bf0909';
    ctx.fillStyle = '#ebeeed'; ctx.fillRect(0, 0, w, h);

    /* The soft, irregular boundary makes the structure a piece of fabric,
       rather than a UI grid or a generic network. */
    const edge = (u, side) => {
      const wave = Math.sin(u * 7.2 + time * .00032 + side * 1.7) * h * .018;
      const cursorLift = s.active ? smooth(1 - Math.hypot(mix(left, right, u) - px, (side ? bottom : top) - py) / Math.max(w, h) * 1.25) : 0;
      return (side ? bottom : top) + wave + (side ? 1 : -1) * cursorLift * h * .055;
    };
    ctx.save();
    ctx.beginPath();
    for (let n = 0; n <= 34; n++) { const u = n / 34, x = mix(left, right, u); n ? ctx.lineTo(x, edge(u, 0)) : ctx.moveTo(x, edge(u, 0)); }
    for (let n = 34; n >= 0; n--) { const u = n / 34, x = mix(left, right, u); ctx.lineTo(x, edge(u, 1)); }
    ctx.closePath(); ctx.clip();

    /* Weft: three streams begin as separate project traces at the left edge.
       Near the pointer they thicken and become visibly interdependent. */
    for (let row = 0; row < 7; row++) {
      const pts = [];
      const base = mix(top + h * .045, bottom - h * .045, row / 6);
      for (let n = 0; n <= 34; n++) {
        const u = n / 34, x = mix(left, right, u);
        const flow = Math.sin(u * 8.5 + row * 1.71 + time * .00048) * h * (.020 + (row % 2) * .006);
        const d = Math.hypot(x - px, base + flow - py);
        const near = s.active ? smooth(1 - d / Math.max(36, w * .34)) : 0;
        const gathering = (cy - (base + flow)) * near * .36 + (py - (base + flow)) * near * .16;
        pts.push({ x, y: base + flow + gathering });
      }
      ctx.strokeStyle = row === 3 ? 'rgba(191,9,9,.80)' : `rgba(23,56,46,${.16 + (row % 3) * .055})`;
      ctx.lineWidth = row === 3 ? 1.25 + s.hit * .45 : .65 + (row % 3) * .12;
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    }
    /* Warp: not a regular grid. Its fibres bow, cross and become denser only
       in the interaction area, where the shared capacity is being examined. */
    for (let col = 0; col < 9; col++) {
      const u = col / 8, pts = [];
      for (let n = 0; n <= 22; n++) {
        const v = n / 22, y = mix(edge(u, 0), edge(u, 1), v);
        const drift = Math.sin(v * 7 + col * 2.13 + time * .00038) * w * .009;
        const d = Math.hypot(mix(left, right, u) + drift - px, y - py);
        const near = s.active ? smooth(1 - d / Math.max(38, w * .29)) : 0;
        const targetX = px + (u - .5) * w * .11;
        pts.push({ x: mix(left, right, u) + drift + (targetX - (mix(left, right, u) + drift)) * near * .26, y });
      }
      ctx.strokeStyle = col % 4 === 0 ? 'rgba(191,9,9,.46)' : 'rgba(23,56,46,.20)';
      ctx.lineWidth = .55 + (col % 3) * .10;
      ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    }
    ctx.restore();

    /* Three exact sources: they enter the cloth and keep their own rhythm.
       A small square is a material marker, never an icon or a made-up label. */
    for (let i = 0; i < 3; i++) {
      const y = mix(top + h * .13, bottom - h * .13, i / 2) + Math.sin(time * .00054 + i * 1.83) * h * .025;
      const toward = s.active ? smooth(1 - Math.hypot(left - px, y - py) / Math.max(52, w * .45)) : 0;
      const x = left - w * .065 + toward * w * .037;
      ctx.strokeStyle = i === 1 ? rgba(warm, .96) : rgba(ink, .88); ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(x + 5, y); ctx.quadraticCurveTo(left - 2, y + (i - 1) * 4, left + w * .07, y + (cy - y) * .10); ctx.stroke();
      ctx.fillStyle = i === 1 ? warm : ink; ctx.fillRect(x - 3, y - 3, 6, 6);
      ctx.fillStyle = '#ebeeed'; ctx.fillRect(x - 1, y - 1, 2, 2);
    }

    /* The local lens is not an extra layer: it enlarges the actual weave
       beneath it, giving the mouse a legible cause-and-effect. */
    if (s.active) {
      const radius = Math.min(w, h) * .22;
      const g = ctx.createRadialGradient(px, py, radius * .08, px, py, radius);
      g.addColorStop(0, 'rgba(244,244,239,.14)'); g.addColorStop(.70, 'rgba(244,244,239,.025)'); g.addColorStop(1, 'rgba(244,244,239,0)');
      ctx.fillStyle = g; ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
      ctx.strokeStyle = rgba(warm, .38 + s.hit * .35); ctx.lineWidth = .8; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.arc(px, py, radius * (.68 + s.hit * .16), 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    data.commonsPulses.forEach(pulse => {
      pulse.age += dt * .001; const q = clamp(pulse.age / 1.15);
      ctx.strokeStyle = `rgba(191,9,9,${(1 - q) * .58})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(pulse.x * w, pulse.y * h, q * Math.min(w, h) * .72, 0, TAU); ctx.stroke();
    });
    data.commonsPulses = data.commonsPulses.filter(pulse => pulse.age < 1.15);
  }

  /* Non-profit final study: a braid of three, not three separate “awards”.
     Each strand begins with a distinct project trace; together they become
     one carrying structure. The cursor physically tugs the already-present
     braid, and a click sends a signal through every strand — no objects are
     spawned, teleported, or treated as decoration. */
  function drawNonprofitBraid(s, dt) {
    const { ctx, w, h, data, time } = s;
    const px = s.pointer.x * w, py = s.pointer.y * h;
    const dark = '#1F2937', paper = '#f4f4ef', warm = '#bf0909';
    const starts = [.25, .50, .75], ends = [.63, .28, .52];
    const bezier = (a, b, c, d, u) => {
      const v = 1 - u;
      return { x: v*v*v*a.x + 3*v*v*u*b.x + 3*v*u*u*c.x + u*u*u*d.x, y: v*v*v*a.y + 3*v*v*u*b.y + u*u*u*d.y };
    };
    const strandPoint = (i, u) => {
      const phase = time * .00044 + i * 1.91;
      const y0 = starts[i] * h, y3 = ends[i] * h;
      const a = { x: -w * .05, y: y0 };
      const b = { x: w * .26, y: y0 + Math.sin(phase) * h * .045 + (i - 1) * h * .08 };
      const c = { x: w * .66, y: y3 - Math.sin(phase * 1.2) * h * .045 - (i - 1) * h * .10 };
      const d = { x: w * 1.06, y: y3 };
      const p = bezier(a, b, c, d, u);
      const distance = Math.hypot(p.x - px, p.y - py);
      const touch = s.active ? smooth(1 - distance / Math.max(42, w * .42)) : 0;
      const curl = Math.sin(u * Math.PI * 2 + phase + i) * h * .014;
      return {
        x: p.x + (px - p.x) * touch * .20,
        y: p.y + curl + (py - p.y) * touch * .20,
        touch
      };
    };
    const path = (i, from = 0, to = 1) => {
      const points = [];
      for (let n = 0; n <= 38; n++) { const u = mix(from, to, n / 38); points.push(strandPoint(i, u)); }
      return points;
    };
    const stroke = (points, color, width) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); points.forEach((p, n) => n ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    };
    ctx.fillStyle = dark; ctx.fillRect(0, 0, w, h);

    /* A quiet paper-shadow gives the braid a spatial plane without turning it
       into a card, grid, bridge, or a literal illustration. */
    const shadow = ctx.createLinearGradient(0, 0, w, h);
    shadow.addColorStop(0, 'rgba(244,244,239,.10)'); shadow.addColorStop(1, 'rgba(244,244,239,0)');
    ctx.fillStyle = shadow; ctx.fillRect(0, 0, w, h);
    const strands = [0, 1, 2].map(i => path(i));

    /* First pass: broad pale fibres. At this scale they read as a single
       braid; their dark seams preserve each initiative's own direction. */
    strands.forEach(points => stroke(points, 'rgba(244,244,239,.97)', Math.max(9, h * .108)));
    strands.forEach((points, i) => stroke(points, i === 1 ? rgba(warm, .96) : 'rgba(23,56,46,.88)', i === 1 ? 1.55 : 1.18));

    /* Controlled overpasses: enough to make a woven object, never a generic
       web. Their rhythm moves continuously with the same actual strands. */
    const overpasses = [[0,.37,.48],[2,.49,.60],[1,.58,.69],[0,.66,.77]];
    overpasses.forEach(([i, from, to], n) => {
      const section = path(i, from, to);
      stroke(section, 'rgba(244,244,239,.99)', Math.max(10.5, h * .125));
      stroke(section, i === 1 ? rgba(warm,.98) : 'rgba(23,56,46,.94)', i === 1 ? 1.75 : 1.35);
      const p = section[Math.floor(section.length * .5)];
      ctx.fillStyle = n % 2 ? rgba(warm,.90) : 'rgba(23,56,46,.72)'; ctx.fillRect(p.x - 1.3, p.y - 1.3, 2.6, 2.6);
    });

    /* The three initial marks all exist from page load. They are material
       traces of the three places, rather than a set of interface icons. */
    starts.forEach((v, i) => {
      const p = strandPoint(i, .065), angle = Math.atan2(strandPoint(i,.085).y - p.y, strandPoint(i,.085).x - p.x);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(angle);
      ctx.fillStyle = paper; ctx.fillRect(-6, -4, 12, 8);
      ctx.strokeStyle = i === 1 ? warm : dark; ctx.lineWidth = 1; ctx.strokeRect(-6, -4, 12, 8);
      ctx.fillStyle = i === 1 ? warm : dark; ctx.fillRect(-3.2, -1.1, 6.4, 2.2); ctx.restore();
    });

    /* Hover affects the braid itself; there is no detached lens or extra
       object. A click travels across the three connected paths. */
    if (s.active) {
      const radius = Math.min(w, h) * .22;
      const glowField = ctx.createRadialGradient(px, py, 0, px, py, radius);
      glowField.addColorStop(0, 'rgba(209,138,27,.23)'); glowField.addColorStop(1, 'rgba(209,138,27,0)');
      ctx.fillStyle = glowField; ctx.fillRect(px-radius, py-radius, radius*2, radius*2);
    }
    data.commonsPulses.forEach(pulse => {
      pulse.age += dt * .001;
      const q = clamp(pulse.age / 1.25);
      [0, 1, 2].forEach(i => {
        const p = strandPoint(i, q);
        ctx.fillStyle = `rgba(209,138,27,${(1-q)*.95})`; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2 - q*.7, 0, TAU); ctx.fill();
      });
    });
    data.commonsPulses = data.commonsPulses.filter(pulse => pulse.age < 1.25);
    ctx.lineCap = 'butt';
  }

  /* Non-profit final direction: three private motivations become one public
     imprint. The left is deliberately three different authorial textures;
     the right is their shared publishing field. Hover is the act of reading:
     existing marks are gathered and translated, never replaced by icons. */
  function drawNonprofitImprint(s, dt) {
    const { ctx, w, h, data, time } = s;
    const ink = '#1F2937', paper = '#f4f4ef', warm = '#bf0909';
    const px = s.pointer.x * w, py = s.pointer.y * h;
    data.imprintRead = mix(data.imprintRead, s.active ? 1 : 0, reduced ? 1 : .055);
    const read = data.imprintRead;
    ctx.fillStyle = ink; ctx.fillRect(0, 0, w, h);

    const sourceOrigin = [
      { x: w * .17, y: h * .26 },
      { x: w * .18, y: h * .52 },
      { x: w * .17, y: h * .76 }
    ];
    const tone = i => i === 1 ? warm : ink;
    const curve = (a, b, t) => {
      const p = { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) };
      const bend = Math.sin(t * Math.PI) * (a.y < b.y ? 1 : -1) * h * .055;
      return { x: p.x, y: p.y + bend };
    };

    /* One broad but deliberately imperfect publication field. It is made of
       the same marks as the three voices — not an independent diagram layer. */
    ctx.save();
    ctx.globalAlpha = .42 + read * .22;
    for (let n = 0; n < 28; n++) {
      const col = n % 7, row = Math.floor(n / 7);
      const x = w * (.55 + col * .047) + Math.sin(row * 1.7 + col) * 1.4;
      const y = h * (.20 + row * .18) + Math.cos(col * 1.3 + row) * 1.8;
      ctx.fillStyle = row === 1 ? warm : paper;
      const ww = 3.6 + (n % 3) * 2.2, hh = n % 4 === 0 ? 1.8 : 2.8;
      ctx.fillRect(x - ww / 2, y - hh / 2, ww, hh);
    }
    ctx.restore();

    data.voiceMarks.forEach((mark, n) => {
      const voice = mark.voice, rank = mark.rank;
      const source = sourceOrigin[voice];
      /* Three very different local grammars: typed bars, perforated pressure,
         and editorial slashes. They are traces, not decorative particles. */
      let a;
      if (voice === 0) a = { x: source.x + ((rank % 6) - 2.5) * w * .020, y: source.y + (Math.floor(rank / 6) - 1) * h * .037 };
      else if (voice === 1) a = { x: source.x + Math.sin(rank * 2.21) * w * .052, y: source.y + Math.cos(rank * 1.63) * h * .075 };
      else a = { x: source.x + ((rank % 5) - 2) * w * .026 + Math.floor(rank / 5) * w * .012, y: source.y + (Math.floor(rank / 5) - 1) * h * .046 };
      a.x += Math.sin(time * .00048 * mark.wobble + mark.phase) * .55;
      a.y += Math.cos(time * .00042 * mark.wobble + mark.phase) * .45;
      const outCol = (rank * 2 + voice * 3) % 7, outRow = (rank + voice) % 4;
      const b = {
        x: w * (.54 + outCol * .049) + Math.sin(rank * 1.7 + voice) * 1.3,
        y: h * (.20 + outRow * .18) + Math.cos(rank * 1.21 + voice) * 1.6
      };
      const d = Math.min(Math.hypot(a.x - px, a.y - py), Math.hypot(b.x - px, b.y - py));
      const attention = s.active ? smooth(1 - d / Math.max(40, w * .38)) : 0;
      const travel = read * (.14 + attention * .72 + s.hit * .18);
      const p = curve(a, b, travel);
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.globalAlpha = .34 + travel * .64;
      ctx.fillStyle = voice === 1 ? warm : paper;
      if (voice === 0) {
        const ww = 2.7 + (rank % 4) * 1.8; ctx.fillRect(-ww / 2, -1, ww, 2);
      } else if (voice === 1) {
        const q = 1.25 + (rank % 3) * .55; ctx.fillRect(-q, -q, q * 2, q * 2);
      } else {
        ctx.rotate(-.62 + Math.sin(rank) * .12); ctx.fillRect(-.7, -2.9, 1.4, 5.8);
      }
      ctx.restore();
    });

    /* Reader motion actually reorganises the shared print: a quiet area of
       contrast follows the pointer while all three sources react through it. */
    if (read > .015) {
      const r = Math.min(w, h) * (.18 + read * .14);
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(244,244,239,${.12 * read})`); g.addColorStop(1, 'rgba(244,244,239,0)');
      ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
    data.commonsPulses.forEach(pulse => {
      pulse.age += dt * .001; const q = clamp(pulse.age / 1.15);
      data.voiceMarks.forEach((mark, n) => {
        if (n % 6) return;
        const b = { x: w * (.54 + ((mark.rank * 2 + mark.voice * 3) % 7) * .049), y: h * (.20 + ((mark.rank + mark.voice) % 4) * .18) };
        const a = sourceOrigin[mark.voice], p = curve(a, b, q);
        ctx.fillStyle = `rgba(191,9,9,${(1 - q) * .85})`; ctx.fillRect(p.x - 1.8, p.y - 1.8, 3.6, 3.6);
      });
    });
    data.commonsPulses = data.commonsPulses.filter(pulse => pulse.age < 1.15);
  }

  /* Non-profit final art direction: a dense system makes room for exactly
     three non-identical initiatives. The negative forms are not “objects”;
     they are space being cleared within a real field. Pointer movement opens
     that field continuously, while a click sends a quiet structural shift
     through marks that already exist. */
  function drawNonprofitClearing(s, dt) {
    const { ctx, w, h, data, time } = s;
    const ink = '#1F2937', paper = '#f4f4ef', warm = '#bf0909';
    const px = s.pointer.x * w, py = s.pointer.y * h;
    const openings = [
      { x: .28, y: .34, sx: .115, sy: .19, kind: 0 },
      { x: .56, y: .62, sx: .15, sy: .105, kind: 1 },
      { x: .77, y: .31, sx: .105, sy: .17, kind: 2 }
    ];
    ctx.fillStyle = ink; ctx.fillRect(0, 0, w, h);
    const holeValue = (x, y, o) => {
      const dx = (x / w - o.x) / o.sx, dy = (y / h - o.y) / o.sy;
      if (o.kind === 0) return Math.max(Math.abs(dx) * .72 + Math.abs(dy) * .98, Math.hypot(dx * .58, dy) * .92);
      if (o.kind === 1) return Math.max(Math.abs(dx), Math.abs(dy) * .72 + Math.abs(dx) * .26);
      return Math.max(Math.abs(dx) * .84 + Math.abs(dy) * .36, Math.abs(dy) * .96 + Math.max(0, -dx) * .32);
    };
    const nearOpen = (x, y) => Math.min(...openings.map(o => holeValue(x, y, o)));

    /* This is deliberately a materially dense field, not scattered sparkle.
       Its pieces move only in response to the pointer and retained click wave. */
    data.clearingMarks.forEach((m, i) => {
      let x = m.x * w, y = m.y * h;
      const dMouse = Math.hypot(x - px, y - py);
      const push = s.active ? smooth(1 - dMouse / Math.max(38, w * .29)) : 0;
      const dx = x - px, dy = y - py, d = Math.max(1, Math.hypot(dx, dy));
      x += dx / d * push * (7 + (i % 4) * 2.5);
      y += dy / d * push * (5 + (i % 5) * 1.8);
      const value = nearOpen(x, y);
      const breathing = Math.sin(time * .00038 + m.phase) * .45;
      if (value < .93) return;
      const alpha = .10 + Math.min(.16, (value - .93) * .10) + push * .13;
      ctx.fillStyle = i % 17 === 0 ? `rgba(209,138,27,${alpha + .12})` : `rgba(244,244,239,${alpha})`;
      const q = m.size + breathing;
      if (m.kind === 0) ctx.fillRect(x - q * .45, y - q * .45, q * .9, q * .9);
      else if (m.kind === 1) ctx.fillRect(x - q * 1.35, y - .6, q * 2.7, 1.2);
      else if (m.kind === 2) ctx.fillRect(x - .6, y - q * 1.25, 1.2, q * 2.5);
      else { ctx.save(); ctx.translate(x, y); ctx.rotate(.62); ctx.fillRect(-.55, -q, 1.1, q * 2); ctx.restore(); }
    });

    /* Three places remain visibly open even at rest. Their distinct internal
       motions keep them specific rather than becoming three generic circles. */
    openings.forEach((o, index) => {
      const ox = o.x * w, oy = o.y * h;
      const distance = Math.hypot(ox - px, oy - py);
      const attention = s.active ? smooth(1 - distance / Math.max(44, w * .38)) : 0;
      const swell = 1 + attention * .22 + s.hit * .08;
      ctx.save(); ctx.translate(ox, oy); ctx.scale(swell, swell);
      ctx.strokeStyle = index === 1 ? `rgba(209,138,27,${.90 + attention * .10})` : `rgba(244,244,239,${.86 + attention * .14})`;
      ctx.lineWidth = 1.05 + attention * .65; ctx.lineJoin = 'round';
      ctx.beginPath();
      if (o.kind === 0) {
        ctx.moveTo(-w*o.sx*.42, -h*o.sy*.54); ctx.lineTo(w*o.sx*.34, -h*o.sy*.54); ctx.lineTo(w*o.sx*.50, h*o.sy*.14); ctx.lineTo(w*o.sx*.08, h*o.sy*.54); ctx.lineTo(-w*o.sx*.48, h*o.sy*.35); ctx.closePath();
      } else if (o.kind === 1) {
        ctx.moveTo(-w*o.sx*.55, -h*o.sy*.38); ctx.lineTo(w*o.sx*.38, -h*o.sy*.38); ctx.lineTo(w*o.sx*.54, h*o.sy*.30); ctx.lineTo(-w*o.sx*.29, h*o.sy*.44); ctx.closePath();
      } else {
        ctx.moveTo(-w*o.sx*.40, -h*o.sy*.52); ctx.quadraticCurveTo(w*o.sx*.42, -h*o.sy*.55, w*o.sx*.45, 0); ctx.lineTo(w*o.sx*.18, h*o.sy*.52); ctx.lineTo(-w*o.sx*.50, h*o.sy*.34); ctx.closePath();
      }
      ctx.fillStyle = 'rgba(237,241,233,.98)'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = index === 1 ? warm : ink;
      if (o.kind === 0) { ctx.fillRect(-4.8 + Math.sin(time*.001 + index)*1.4, -1, 9.6, 2); ctx.fillRect(-1, -4.3, 2, 8.6); }
      else if (o.kind === 1) { for (let n=0;n<3;n++) ctx.fillRect(-6+n*5, -1.2+Math.sin(time*.0013+n)*1.1, 2.8, 2.4); }
      else { ctx.save(); ctx.rotate(.62 + Math.sin(time*.001)*.08); ctx.fillRect(-1, -5, 2, 10); ctx.restore(); }
      ctx.restore();
    });
    data.commonsPulses.forEach(pulse => {
      pulse.age += dt * .001; const q = clamp(pulse.age / 1.05);
      openings.forEach((o, i) => {
        const ox=o.x*w, oy=o.y*h;
        ctx.strokeStyle = i === 1 ? `rgba(209,138,27,${(1-q)*.75})` : `rgba(23,56,46,${(1-q)*.52})`;
        ctx.lineWidth=.8; ctx.beginPath(); ctx.arc(ox,oy,q*Math.min(w,h)*(.18+i*.05),0,TAU); ctx.stroke();
      });
    });
    data.commonsPulses = data.commonsPulses.filter(pulse => pulse.age < 1.05);
  }

  /* Non-profit final direction: a moving support structure holds three
     intentionally different initiatives in balance. It is one physical
     scene — three places kept possible by a shared counterweight — rather
     than a grant icon, a gate, or a field of anonymous data. */
  function drawNonprofitMobile(s, dt) {
    const { ctx, w, h, data, time } = s;
    const ink = '#1F2937', paper = '#f4f4ef', warm = '#bf0909', pale = '#ebeeed';
    const px = s.pointer.x * w, py = s.pointer.y * h;
    const mobile = data.mobile;
    const pointerTilt = s.active ? (s.pointer.x - .5) * .26 + (s.pointer.y - .5) * .05 : -.035;
    mobile.target = mix(mobile.target, pointerTilt, s.active ? .075 : .018);
    mobile.impulse = Math.max(0, mobile.impulse - dt * .00072);
    mobile.tilt = mix(mobile.tilt, mobile.target + Math.sin(time*.0013) * .012 + mobile.impulse * Math.sin(time*.009) * .085, .065);
    ctx.fillStyle = pale; ctx.fillRect(0, 0, w, h);
    const pivot = { x:w*.53, y:h*.39 };
    const unit = { x:Math.cos(mobile.tilt), y:Math.sin(mobile.tilt) };
    const normal = { x:-unit.y, y:unit.x };
    const at = (distance, offset=0) => ({ x:pivot.x+unit.x*distance+normal.x*offset, y:pivot.y+unit.y*distance+normal.y*offset });
    const rod = (a,b,width=1.25,color=ink) => { ctx.strokeStyle=color; ctx.lineWidth=width; ctx.lineCap='round'; ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke(); };
    const bob = (origin, length, phase, kind, scale=1) => {
      const attention = s.active ? Math.max(0,1-Math.hypot(origin.x-px,origin.y-py)/Math.max(48,w*.4)) : 0;
      const swing = Math.sin(time*.0015+phase)*(.055+attention*.14)+mobile.impulse*Math.sin(time*.008+phase)*.17;
      const end={x:origin.x+Math.sin(swing)*length,y:origin.y+Math.cos(swing)*length};
      rod(origin,end,.9,`rgba(23,56,46,${.64+attention*.28})`);
      ctx.save();ctx.translate(end.x,end.y);ctx.rotate(swing);
      if(kind===0){
        ctx.fillStyle=ink;ctx.beginPath();ctx.moveTo(-8*scale,0);ctx.lineTo(-2*scale,-7*scale);ctx.lineTo(7*scale,-4*scale);ctx.lineTo(9*scale,5*scale);ctx.lineTo(-6*scale,6*scale);ctx.closePath();ctx.fill();
        ctx.fillStyle=paper;ctx.fillRect(-2*scale,-1*scale,5*scale,2*scale);
      }else if(kind===1){
        ctx.fillStyle=paper;ctx.strokeStyle=warm;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-8*scale,-5*scale);ctx.lineTo(6*scale,-6*scale);ctx.lineTo(9*scale,4*scale);ctx.lineTo(-5*scale,6*scale);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.fillStyle=warm;ctx.fillRect(-3*scale,-1*scale,7*scale,2*scale);
      }else{
        ctx.fillStyle=ink;ctx.beginPath();ctx.moveTo(-6*scale,-7*scale);ctx.lineTo(7*scale,-3*scale);ctx.lineTo(4*scale,8*scale);ctx.lineTo(-7*scale,4*scale);ctx.closePath();ctx.fill();
        ctx.fillStyle=warm;ctx.fillRect(-1*scale,-3*scale,3*scale,3*scale);
      }
      ctx.restore();
      return end;
    };

    /* The support is an architectural counterweight, not a “button” or
       illustrative seesaw. It moves slowly enough that each relationship is
       legible; the three suspended forms never appear or disappear. */
    const left=at(-w*.36), right=at(w*.37), mid=at(w*.09);
    ctx.fillStyle='rgba(23,56,46,.10)';ctx.beginPath();ctx.moveTo(pivot.x-w*.07,pivot.y+h*.39);ctx.lineTo(pivot.x+w*.10,pivot.y+h*.39);ctx.lineTo(pivot.x+w*.025,pivot.y+h*.08);ctx.closePath();ctx.fill();
    rod(left,right,2.1,ink); rod(at(-w*.23,3),at(w*.20,3),.7,'rgba(209,138,27,.84)');
    ctx.fillStyle=warm;ctx.fillRect(pivot.x-3.5,pivot.y-3.5,7,7);
    ctx.fillStyle=paper;ctx.fillRect(pivot.x-1.2,pivot.y-1.2,2.4,2.4);
    const a=bob(left,h*.30,0,0,1.05), b=bob(mid,h*.43,2.2,1,.92), c=bob(right,h*.27,4.1,2,1);
    /* A restrained shared response: existing support-lines brighten only
       while a reader is inside, then settle rather than snapping back. */
    if(s.active){
      [a,b,c].forEach((p,i)=>{ctx.strokeStyle=i===1?`rgba(209,138,27,.42)`:'rgba(23,56,46,.22)';ctx.lineWidth=.7;ctx.beginPath();ctx.arc(p.x,p.y,8+s.hit*10,0,TAU);ctx.stroke();});
    }
    data.commonsPulses.forEach(pulse=>{
      pulse.age+=dt*.001;const q=clamp(pulse.age/1.1);
      ctx.strokeStyle=`rgba(209,138,27,${(1-q)*.65})`;ctx.lineWidth=1;ctx.beginPath();ctx.arc(pivot.x,pivot.y,q*Math.min(w,h)*.62,0,TAU);ctx.stroke();
    });
    data.commonsPulses=data.commonsPulses.filter(pulse=>pulse.age<1.1);
    ctx.lineCap='butt';
  }

  /* Non-profit final scene: three different motivation materials pass through
     one public press. The press is a single large physical object; the three
     materials never become generic cards or loose particles. Hover acts as a
     registration line that gathers the real marks before the roller; click
     runs one calm edition and leaves all three initiatives in place. */
  function drawNonprofitPress(s, dt) {
    const { ctx, w, h, data, time } = s;
    const ink = '#1F2937', paper = '#f4f4ef', warm = '#bf0909', muted = '#9aafa4';
    const px = s.pointer.x * w, py = s.pointer.y * h;
    const press = data.press;
    const rollerX = w * .53, rollerW = Math.max(16, w * .135), rollerTop = h * .14, rollerH = h * .70;
    press.read = mix(press.read, s.active ? 1 : 0, reduced ? 1 : .05);
    press.registration = mix(press.registration, s.active ? clamp(s.pointer.x, .08, .92) : .35, reduced ? 1 : .05);
    press.cycle = Math.max(0, press.cycle - dt * .00033);
    press.rotation += dt * (.00013 + press.read * .00045 + press.cycle * .0017);
    ctx.fillStyle = '#ebeeed'; ctx.fillRect(0, 0, w, h);
    const lanes = [.28, .50, .72];
    const inputEnd = rollerX - rollerW * .56, outputStart = rollerX + rollerW * .56;
    const regX = mix(w*.13, w*.83, press.registration);

    /* Three authorial densities: set material, grain, and a handwritten
       stroke. They remain legible as different sources even before motion. */
    lanes.forEach((yy, lane) => {
      const y = yy * h;
      ctx.fillStyle = 'rgba(23,56,46,.055)'; ctx.fillRect(w*.055, y-h*.072, w*.89, h*.144);
      for (let n = 0; n < 14; n++) {
        const q = n / 13, x = mix(w*.075, inputEnd, q);
        const d = Math.abs(x - regX);
        const gather = press.read * smooth(1 - d / Math.max(25, w*.25));
        const shift = (regX - x) * gather * .045 + press.cycle * w*.018;
        ctx.save(); ctx.translate(x + shift, y);
        ctx.fillStyle = lane === 1 ? `rgba(209,138,27,${.46+gather*.44})` : `rgba(23,56,46,${.42+gather*.44})`;
        if (lane === 0) {
          const ww = 2.2 + (n % 4) * 1.65; ctx.fillRect(-ww/2, -1.15, ww, 2.3);
          if (n % 3 === 0) ctx.fillRect(-ww*.2, 3.0, ww*.52, 1.1);
        } else if (lane === 1) {
          const z = n % 3 === 0 ? 3.6 : 2.1; ctx.fillRect(-z/2, -z/2, z, z);
        } else {
          ctx.rotate(-.58 + Math.sin(n)*.14);ctx.fillRect(-.7,-3.2,1.4,6.4);
        }
        ctx.restore();
      }
      /* The material has a definite physical width; it is not a connection
         line. The colour travelling through it matches the print result. */
      ctx.strokeStyle = lane === 1 ? 'rgba(209,138,27,.40)' : 'rgba(23,56,46,.28)';ctx.lineWidth=.7;
      ctx.beginPath();ctx.moveTo(w*.06,y+h*.052);ctx.lineTo(inputEnd+1,y+h*.052);ctx.stroke();
    });

    /* Registration is a real interaction tool: it gathers the exact marks
       beneath it and makes the roller respond, without adding a detached UI. */
    if (press.read > .015) {
      ctx.strokeStyle = `rgba(209,138,27,${.40+press.read*.42})`;ctx.lineWidth=1;ctx.setLineDash([2,2]);
      ctx.beginPath();ctx.moveTo(regX, h*.10);ctx.lineTo(regX,h*.90);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle = warm;ctx.fillRect(regX-2,pyOr(h*.09),4,3);
    }

    /* One large roller — the visual heart of this small block. Its hatching
       turns continuously; the warm registration seam is the only accent. */
    ctx.save();rr(ctx,rollerX-rollerW/2,rollerTop,rollerW,rollerH,rollerW/2);ctx.clip();
    const g=ctx.createLinearGradient(rollerX-rollerW/2,0,rollerX+rollerW/2,0);
    g.addColorStop(0,'#0e2921');g.addColorStop(.48,ink);g.addColorStop(1,'#285448');ctx.fillStyle=g;ctx.fillRect(rollerX-rollerW/2,rollerTop,rollerW,rollerH);
    for(let n=-4;n<15;n++){
      const yy=rollerTop+n*7+(press.rotation*70%7);ctx.strokeStyle=n%4===0?'rgba(244,244,239,.34)':'rgba(244,244,239,.13)';ctx.lineWidth=n%4===0?1.15:.55;
      ctx.beginPath();ctx.moveTo(rollerX-rollerW*.45,yy);ctx.lineTo(rollerX+rollerW*.45,yy-3);ctx.stroke();
    }
    ctx.restore();ctx.strokeStyle=ink;ctx.lineWidth=1.1;rr(ctx,rollerX-rollerW/2,rollerTop,rollerW,rollerH,rollerW/2);ctx.stroke();
    ctx.fillStyle=warm;ctx.fillRect(rollerX-1.25,rollerTop-4,2.5,rollerH+8);
    ctx.fillStyle=paper;ctx.fillRect(rollerX-.65,rollerTop-2,1.3,rollerH+4);

    /* After the press, those same materials gain room and amplitude: public
       imprint, three different voices, without pretending they are identical. */
    lanes.forEach((yy,lane)=>{
      const y=yy*h, spread=1+press.read*.32+press.cycle*.18;
      for(let n=0;n<11;n++){
        const q=n/10,x=mix(outputStart,w*.93,q),j=Math.sin(n*2.14+time*.00055+lane)*h*.018*spread;
        ctx.fillStyle=lane===1?`rgba(209,138,27,${.46+press.read*.42})`:`rgba(23,56,46,${.40+press.read*.45})`;
        if(lane===0){const ww=(3+n%3*2)*spread;ctx.fillRect(x-ww/2,y+j-1.3,ww,2.6);if(n%3===0)ctx.fillRect(x-ww*.2,y+j+3.2,ww*.5,1.2)}
        else if(lane===1){const z=(2.2+n%3*1.5)*spread;ctx.fillRect(x-z/2,y+j-z/2,z,z)}
        else{ctx.save();ctx.translate(x,y+j);ctx.rotate(-.56+Math.sin(n)*.12);ctx.fillRect(-.75,-(3.4+n%2)*spread,.8,(6.8+n%2)*spread);ctx.restore()}
      }
      ctx.strokeStyle=lane===1?'rgba(209,138,27,.50)':'rgba(23,56,46,.30)';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(outputStart-1,y+h*.052);ctx.lineTo(w*.945,y+h*.052);ctx.stroke();
    });
    data.commonsPulses.forEach(pulse=>{pulse.age+=dt*.001;const q=clamp(pulse.age/1.15);ctx.strokeStyle=`rgba(209,138,27,${(1-q)*.72})`;ctx.lineWidth=1;ctx.beginPath();ctx.arc(rollerX,h*.50,q*Math.min(w,h)*.46,0,TAU);ctx.stroke();});
    data.commonsPulses=data.commonsPulses.filter(pulse=>pulse.age<1.15);
    function pyOr(fallback){return s.active ? py : fallback;}
  }

  /* Non-profit: three distinct initiatives take root in one living support
     system. This keeps the plant metaphor, but removes the literal three
     sprouts: it is a dense rhizome, viewed below the surface. Pointer motion
     bends the actual roots, and a click travels through existing growth. */
  function drawNonprofitRhizome(s, dt) {
    const { ctx, w, h, data, time } = s;
    const ink='#1F2937', pale='#ebeeed', warm='#bf0909', paper='#f4f4ef';
    const px=s.pointer.x*w, py=s.pointer.y*h;
    const origin={x:w*.52,y:h*.52};
    const bezier=(a,b,c,d,u)=>{const v=1-u;return{x:v*v*v*a.x+3*v*v*u*b.x+3*v*u*u*c.x+u*u*u*d.x,y:v*v*v*a.y+3*v*v*u*b.y+3*v*u*u*c.y+u*u*u*d.y}};
    const pathFor=(node,index)=>{
      const end={x:node.x*w,y:node.y*h};
      const sign=index===0?-1:index===1?1:1;
      const pull=s.active?smooth(1-Math.hypot(end.x-px,end.y-py)/Math.max(54,w*.38)):0;
      const b={x:origin.x+(end.x-origin.x)*.28+sign*w*.08,y:origin.y+(end.y-origin.y)*.12-h*.10};
      const c={x:origin.x+(end.x-origin.x)*.76-sign*w*.055+(px-end.x)*pull*.12,y:origin.y+(end.y-origin.y)*.78+(py-end.y)*pull*.12};
      const pts=[];for(let n=0;n<=42;n++){const u=n/42,p=bezier(origin,b,c,end,u);const d=Math.hypot(p.x-px,p.y-py);const near=s.active?smooth(1-d/Math.max(36,w*.28)):0;pts.push({x:p.x+(px-p.x)*near*.115,y:p.y+(py-p.y)*near*.115,u,near});}return pts;
    };
    const stroke=(pts,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();pts.forEach((p,n)=>n?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();};
    ctx.fillStyle=pale;ctx.fillRect(0,0,w,h);
    const aura=ctx.createRadialGradient(origin.x,origin.y,0,origin.x,origin.y,Math.max(w,h)*.56);
    aura.addColorStop(0,'rgba(23,56,46,.075)');aura.addColorStop(1,'rgba(23,56,46,0)');ctx.fillStyle=aura;ctx.fillRect(0,0,w,h);
    const paths=data.rhizome.map(pathFor);

    /* The dark, low root-shadow gives volume. Fine hairs are attached to
       exact path points; they cannot become arbitrary background scribbles. */
    paths.forEach((pts,index)=>{
      stroke(pts,'rgba(23,56,46,.14)',5.1);
      stroke(pts,index===1?'rgba(209,138,27,.92)':'rgba(23,56,46,.90)',1.35);
      for(let n=3;n<pts.length-3;n+=3){
        const p=pts[n],prev=pts[n-1],next=pts[n+1];const angle=Math.atan2(next.y-prev.y,next.x-prev.x)+((n+index)%2?1:-1)*(1.03+Math.sin(n*.8)*.16);
        const len=(3.4+(n%5)*1.1)*(1+p.near*.45);
        ctx.strokeStyle=index===1?'rgba(209,138,27,.28)':'rgba(23,56,46,.27)';ctx.lineWidth=.58;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo(p.x+Math.cos(angle)*len*.42,p.y+Math.sin(angle)*len*.20,p.x+Math.cos(angle)*len,p.y+Math.sin(angle)*len);ctx.stroke();
      }
    });
    /* Shared root crown: an actual junction, not an unrelated particle pile. */
    for(let n=0;n<28;n++){const a=n*2.399+time*.00008;const rr=3+(n%7)*1.05;ctx.fillStyle=n%9===0?'rgba(209,138,27,.78)':'rgba(23,56,46,.56)';ctx.fillRect(origin.x+Math.cos(a)*rr-1.25,origin.y+Math.sin(a)*rr*.62-1.25,2.5,2.5);}
    data.rhizome.forEach((node,index)=>{
      const p=paths[index][paths[index].length-1];const breathe=1+Math.sin(time*.0011+node.phase)*.055;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(index===1?.18:-.16+index*.11);ctx.scale(breathe,breathe);
      /* Seeds, not leaves: compact irregular cells with a small inner
         opening — each one has a different orientation and density. */
      ctx.fillStyle=node.tone;ctx.beginPath();ctx.moveTo(-6,-2);ctx.quadraticCurveTo(-2,-7,5,-4);ctx.lineTo(7,2);ctx.quadraticCurveTo(2,6,-5,5);ctx.closePath();ctx.fill();
      ctx.strokeStyle=paper;ctx.lineWidth=.85;ctx.beginPath();ctx.moveTo(-2,-1.6);ctx.quadraticCurveTo(1,-3.2,3,.6);ctx.stroke();ctx.restore();
    });
    data.rhizomePulses.forEach(pulse=>{pulse.age+=dt*.001;const q=clamp(pulse.age/1.22);paths.forEach((pts,index)=>{const p=pts[Math.min(pts.length-1,Math.floor(q*(pts.length-1)))];ctx.fillStyle=index===1?`rgba(209,138,27,${(1-q)*.96})`:`rgba(23,56,46,${(1-q)*.78})`;ctx.beginPath();ctx.arc(p.x,p.y,2.2-q*.7,0,TAU);ctx.fill();});});
    data.rhizomePulses=data.rhizomePulses.filter(pulse=>pulse.age<1.22);
    ctx.lineCap='butt';
  }

  /* Non-profit living-system study. One root crown holds a dense, distributed
     mycelium — three distinct nodes are embedded in it, rather than being
     rendered as three literal shoots. The whole organism changes shape under
     the cursor; its roots are not a passive background. */
  function drawNonprofitMycelium(s, dt) {
    const { ctx, w, h, data, time } = s;
    const ink='#1F2937', pale='#ebeeed', warm='#bf0909', paper='#f4f4ef';
    const px=s.pointer.x*w,py=s.pointer.y*h;
    const cx=w*.51,cy=h*.39;
    const pointerForce=s.active?smooth(1-Math.hypot(cx-px,cy-py)/Math.max(48,w*.48)):0;
    const crownX=cx+(px-cx)*pointerForce*.22;
    const crownY=cy+(py-cy)*pointerForce*.13;
    const nodes=[{x:w*.20,y:h*.72,tone:ink},{x:w*.50,y:h*.83,tone:warm},{x:w*.82,y:h*.66,tone:ink}];
    const cubic=(a,b,c,d,u)=>{const v=1-u;return{x:v*v*v*a.x+3*v*v*u*b.x+3*v*u*u*c.x+u*u*u*d.x,y:v*v*v*a.y+3*v*v*u*b.y+3*v*u*u*c.y+u*u*u*d.y}};
    const rootFor=(branch,index)=>{
      const goal=nodes[branch.lane];
      const a={x:crownX+(index%5-2)*2.3,y:crownY+6};
      const b={x:mix(crownX,goal.x,.30)+(index%4-1.5)*w*.035,y:cy+h*(.11+(index%5)*.018)};
      const c={x:mix(crownX,goal.x,.76)+(index%3-1)*w*.038+(px-goal.x)*pointerForce*.10,y:mix(cy,goal.y,.73)-h*.10+Math.sin(time*.00044+branch.phase)*h*.024};
      const d={x:goal.x+(index%5-2)*w*.022,y:goal.y+(index%4-1.5)*h*.035};
      const pts=[];for(let n=0;n<=31;n++){const u=n/31,p=cubic(a,b,c,d,u);const distance=Math.hypot(p.x-px,p.y-py);const touch=s.active?smooth(1-distance/Math.max(34,w*.25)):0;pts.push({x:p.x+(px-p.x)*touch*.12,y:p.y+(py-p.y)*touch*.10,u,touch});}return pts;
    };
    const stroke=(pts,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();pts.forEach((p,n)=>n?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();};
    ctx.fillStyle=pale;ctx.fillRect(0,0,w,h);
    const haze=ctx.createRadialGradient(crownX,crownY,0,crownX,crownY,Math.max(w,h)*.58);haze.addColorStop(0,'rgba(23,56,46,.085)');haze.addColorStop(1,'rgba(23,56,46,0)');ctx.fillStyle=haze;ctx.fillRect(0,0,w,h);
    const roots=data.mycelium.map(rootFor);
    /* The first low-opacity pass creates a single organic mass; the second
       exposes particular roots only where the cursor gives them energy. */
    roots.forEach((pts,index)=>{
      const lane=data.mycelium[index].lane;
      stroke(pts,lane===1?'rgba(209,138,27,.15)':'rgba(23,56,46,.16)',2.9);
      stroke(pts,lane===1?'rgba(209,138,27,.54)':'rgba(23,56,46,.52)',.62+(index%5===0?.35:0));
      for(let n=5;n<pts.length-3;n+=4){const p=pts[n],prev=pts[n-1],next=pts[n+1],a=Math.atan2(next.y-prev.y,next.x-prev.x)+((n+index)%2?1:-1)*(1.04+Math.sin(index)*.13),len=(2.7+(index+n)%4*.9)*(1+p.touch*.65);ctx.strokeStyle=lane===1?'rgba(209,138,27,.25)':'rgba(23,56,46,.23)';ctx.lineWidth=.48;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo(p.x+Math.cos(a)*len*.35,p.y+Math.sin(a)*len*.1,p.x+Math.cos(a)*len,p.y+Math.sin(a)*len);ctx.stroke();}
    });
    /* A single visibly elastic crown: this is the surface of the organism,
       not an extra icon layered over its roots. */
    ctx.save();ctx.translate(crownX,crownY);ctx.rotate(-.18+Math.sin(time*.0007)*.08+(px-cx)/Math.max(1,w)*.14);
    const sx=1+pointerForce*.22,sy=1+pointerForce*.12;ctx.scale(sx,sy);
    ctx.fillStyle=ink;ctx.beginPath();ctx.moveTo(-13,-3);ctx.quadraticCurveTo(-8,-12,2,-11);ctx.quadraticCurveTo(13,-8,15,1);ctx.quadraticCurveTo(9,9,-4,10);ctx.quadraticCurveTo(-15,7,-13,-3);ctx.fill();
    ctx.fillStyle=paper;ctx.beginPath();ctx.moveTo(-4,-2);ctx.quadraticCurveTo(1,-6,7,-2);ctx.quadraticCurveTo(3,3,-4,2);ctx.fill();ctx.fillStyle=warm;ctx.fillRect(4,-2,3.4,3.4);ctx.restore();
    nodes.forEach((node,i)=>{const wave=1+Math.sin(time*.001+i*2.1)*.08;ctx.save();ctx.translate(node.x,node.y);ctx.rotate((i-1)*.22);ctx.scale(wave,wave);ctx.fillStyle=node.tone;ctx.beginPath();ctx.moveTo(-4.2,-2.8);ctx.lineTo(3.8,-4);ctx.lineTo(5.2,2);ctx.lineTo(-2.2,4);ctx.closePath();ctx.fill();ctx.fillStyle=pale;ctx.fillRect(-1.3,-1,2.6,2);ctx.restore();});
    data.rhizomePulses.forEach(pulse=>{pulse.age+=dt*.001;const q=clamp(pulse.age/1.18);roots.forEach((pts,index)=>{if(index%3)return;const p=pts[Math.min(pts.length-1,Math.floor(q*(pts.length-1)))];ctx.fillStyle=index%6===1?`rgba(209,138,27,${(1-q)*.9})`:`rgba(23,56,46,${(1-q)*.72})`;ctx.beginPath();ctx.arc(p.x,p.y,1.8-q*.5,0,TAU);ctx.fill();});});
    data.rhizomePulses=data.rhizomePulses.filter(pulse=>pulse.age<1.18);ctx.lineCap='butt';
  }

  /* Non-profit final plant direction: a common underground rhizome carries
     three young buds. This is intentionally a horizontal nursery — not three
     stems radiating from one point. Mouse movement flexes the one shared root
     and every bud follows it; click sends one visible growth pulse through it. */
  function drawNonprofitNursery(s, dt) {
    const {ctx,w,h,data,time}=s;
    const ink='#1F2937',pale='#ebeeed',warm='#bf0909',paper='#f4f4ef';
    const px=s.pointer.x*w,py=s.pointer.y*h;
    const rootY=h*.68;
    data.nursery.wave=mix(data.nursery.wave,s.active?1:0,reduced?1:.045);
    data.nursery.pulse=Math.max(0,data.nursery.pulse-dt*.00055);
    const rootPoint=u=>{
      const x=mix(w*.05,w*.95,u),base=rootY+Math.sin(u*Math.PI*2.15+time*.00034)*h*.022;
      const distance=Math.hypot(x-px,base-py);const pull=data.nursery.wave*smooth(1-distance/Math.max(44,w*.33));
      return{x,y:base+(py-base)*pull*.38+Math.sin(u*Math.PI*3+time*.0011)*data.nursery.pulse*h*.052,pull};
    };
    const line=(pts,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();pts.forEach((p,n)=>n?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();};
    const root=[];for(let n=0;n<=58;n++)root.push(rootPoint(n/58));
    ctx.fillStyle=pale;ctx.fillRect(0,0,w,h);
    const wash=ctx.createRadialGradient(w*.5,rootY,0,w*.5,rootY,w*.65);wash.addColorStop(0,'rgba(23,56,46,.075)');wash.addColorStop(1,'rgba(23,56,46,0)');ctx.fillStyle=wash;ctx.fillRect(0,0,w,h);
    /* A single thick living root, then its finer hairs — every small branch is
       derived from this exact curve, never placed as ambient decoration. */
    line(root,'rgba(23,56,46,.16)',5.2);line(root,ink,1.65);
    for(let n=2;n<root.length-2;n+=2){const p=root[n],prev=root[n-1],next=root[n+1],a=Math.atan2(next.y-prev.y,next.x-prev.x)+1.54+Math.sin(n*1.7)*.14;const len=(7+(n%7)*1.65)*(1+p.pull*.54);ctx.strokeStyle=n%9===0?'rgba(209,138,27,.48)':'rgba(23,56,46,.38)';ctx.lineWidth=.66;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo(p.x+Math.cos(a)*len*.28,p.y+Math.sin(a)*len*.14,p.x+Math.cos(a)*len,p.y+Math.sin(a)*len);ctx.stroke();}
    const buds=[{u:.22,top:.38,tone:ink,angle:-.23},{u:.50,top:.19,tone:warm,angle:.03},{u:.79,top:.43,tone:ink,angle:.22}];
    buds.forEach((bud,index)=>{
      const base=rootPoint(bud.u),distance=Math.hypot(base.x-px,base.y-py),attention=data.nursery.wave*smooth(1-distance/Math.max(62,w*.48));
      const tip={x:base.x+(px-base.x)*(.07+attention*.34)+Math.sin(time*.00072+index)*w*.006,y:bud.top*h+(py-bud.top*h)*(.04+attention*.22)};
      const cp1={x:base.x+(index-1)*w*.025+(px-base.x)*attention*.12,y:base.y-h*.13};const cp2={x:tip.x-(index-1)*w*.036+(px-tip.x)*attention*.20,y:tip.y+h*.13};
      ctx.strokeStyle=index===1?'rgba(209,138,27,.90)':'rgba(23,56,46,.88)';ctx.lineWidth=1.28+attention*.72;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.bezierCurveTo(cp1.x,cp1.y,cp2.x,cp2.y,tip.x,tip.y);ctx.stroke();
      const stemPoint=u=>{const v=1-u;return{x:v*v*v*base.x+3*v*v*u*cp1.x+3*v*u*u*cp2.x+u*u*u*tip.x,y:v*v*v*base.y+3*v*v*u*cp1.y+3*v*u*u*cp2.y+u*u*u*tip.y}};
      [[.48,-1],[.69,1]].forEach(([u,side],leafIndex)=>{const p=stemPoint(u),ahead=stemPoint(Math.min(.98,u+.035));const tangent=Math.atan2(ahead.y-p.y,ahead.x-p.x);const leafAngle=tangent+side*(.72+Math.sin(time*.0008+index+leafIndex)*.10);const length=(5.5+leafIndex*1.8)*(1+attention*.25);const end={x:p.x+Math.cos(leafAngle)*length,y:p.y+Math.sin(leafAngle)*length};ctx.strokeStyle=index===1?'rgba(209,138,27,.62)':'rgba(23,56,46,.58)';ctx.lineWidth=.72;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.save();ctx.translate(end.x,end.y);ctx.rotate(leafAngle);ctx.fillStyle=index===1?'rgba(209,138,27,.82)':'rgba(23,56,46,.78)';ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(length*.34,-length*.40,length*.72,-length*.06);ctx.quadraticCurveTo(length*.33,length*.24,0,0);ctx.fill();ctx.restore();});
      for(let n=1;n<5;n++){const u=n/5,v=1-u,p={x:v*v*v*base.x+3*v*v*u*cp1.x+3*v*u*u*cp2.x+u*u*u*tip.x,y:v*v*v*base.y+3*v*v*u*cp1.y+3*v*u*u*cp2.y+u*u*u*tip.y};const a=-1.58+(n-2)*.27+(index-1)*.15;ctx.strokeStyle='rgba(23,56,46,.28)';ctx.lineWidth=.52;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+Math.cos(a)*(4+n),p.y+Math.sin(a)*(4+n));ctx.stroke();}
      /* A compact botanical bud with more character than two leaf ovals. */
      ctx.save();ctx.translate(tip.x,tip.y);ctx.rotate(bud.angle+(px-tip.x)/Math.max(1,w)*attention*.56);ctx.scale(1+attention*.38,1+attention*.38);
      ctx.fillStyle=bud.tone;ctx.beginPath();ctx.moveTo(0,-9);ctx.bezierCurveTo(8,-7,8,2,0,7);ctx.bezierCurveTo(-8,2,-8,-7,0,-9);ctx.fill();
      ctx.strokeStyle=paper;ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(0,-6.3);ctx.quadraticCurveTo(-.8,-.4,0,4.1);ctx.stroke();ctx.fillStyle=index===1?paper:warm;ctx.fillRect(-1.2,-1.2,2.4,2.4);ctx.restore();
    });
    data.rhizomePulses.forEach(pulse=>{pulse.age+=dt*.001;const q=clamp(pulse.age/1.2);const p=rootPoint(q);ctx.fillStyle=`rgba(209,138,27,${(1-q)*.96})`;ctx.beginPath();ctx.arc(p.x,p.y,2.4-q*.8,0,TAU);ctx.fill();buds.forEach((bud,index)=>{if(q<.52)return;const base=rootPoint(bud.u),u=(q-.52)/.48;const tip={x:base.x,y:bud.top*h};const x=mix(base.x,tip.x,u),y=mix(base.y,tip.y,u);ctx.fillStyle=index===1?`rgba(209,138,27,${(1-u)*.82})`:`rgba(23,56,46,${(1-u)*.68})`;ctx.fillRect(x-1.4,y-1.4,2.8,2.8);});});
    data.rhizomePulses=data.rhizomePulses.filter(pulse=>pulse.age<1.2);ctx.lineCap='butt';
  }

  /* A second nursery pass, kept separate from the prior study for rollback.
     Three initiatives are deliberately unlike one another: cotyledons, a
     small three-part bloom, and a forked shoot. Hover grows them from their
     existing stems; no leaf or flower is randomly introduced into the field. */
  function drawNonprofitGarden(s, dt) {
    const {ctx,w,h,data,time}=s;
    const ink='#1F2937',warm='#bf0909',paper='#f4f4ef';
    const px=s.pointer.x*w,py=s.pointer.y*h;
    const rootY=h*.68, ease=t=>1-Math.pow(1-clamp(t),3);
    const nursery=data.nursery;
    const growth=nursery.growth||(nursery.growth=[.08,.08,.08]);
    nursery.wave=mix(nursery.wave,s.active?1:0,reduced?1:.045);
    nursery.pulse=Math.max(0,nursery.pulse-dt*.00048);
    const rootPoint=u=>{
      const x=mix(w*.05,w*.95,u),base=rootY+Math.sin(u*Math.PI*2.15+time*.00034)*h*.022;
      const distance=Math.hypot(x-px,base-py),pull=nursery.wave*smooth(1-distance/Math.max(44,w*.33));
      const tug=clamp((py-base)*pull*.18,-h*.08,h*.08);
      return{x,y:base+tug+Math.sin(u*Math.PI*3+time*.0011)*nursery.pulse*h*.036,pull};
    };
    const line=(pts,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();pts.forEach((p,n)=>n?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();};
    const cubic=(a,b,c,d,u)=>{const v=1-u;return{x:v*v*v*a.x+3*v*v*u*b.x+3*v*u*u*c.x+u*u*u*d.x,y:v*v*v*a.y+3*v*v*u*b.y+3*v*u*u*c.y+u*u*u*d.y}};
    const root=[];for(let n=0;n<=58;n++)root.push(rootPoint(n/58));
    ctx.fillStyle=paper;ctx.fillRect(0,0,w,h);
    line(root,ink,1.8);
    line(root.slice(16,29),'rgba(244,244,239,.92)',.72);
    [5,10,15,21,26,33,39,45,51].forEach((n,i)=>{const p=root[n],prev=root[n-1],next=root[n+1],a=Math.atan2(next.y-prev.y,next.x-prev.x)+(i%2?1.44:1.72),len=4.8+(i%4)*1.7;ctx.strokeStyle=i===4?'rgba(209,138,27,.72)':'rgba(23,56,46,.48)';ctx.lineWidth=.68;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo(p.x+Math.cos(a)*len*.42,p.y+Math.sin(a)*len*.14,p.x+Math.cos(a)*len,p.y+Math.sin(a)*len);ctx.stroke();});
    const lance=(at,angle,length,width,fill,stroke)=>{if(length<.18)return;ctx.save();ctx.translate(at.x,at.y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(length*.47,-width,length,0);ctx.quadraticCurveTo(length*.45,width*.56,0,0);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.72;ctx.stroke();}ctx.restore();};
    const buds=[{u:.22,top:.39},{u:.50,top:.18},{u:.79,top:.43}];
    buds.forEach((bud,index)=>{
      const base=rootPoint(bud.u),restTip={x:base.x+(index-1)*w*.022,y:bud.top*h};
      const distance=Math.hypot(restTip.x-px,restTip.y-py),attention=nursery.wave*smooth(1-distance/Math.max(52,w*.37));
      growth[index]=mix(growth[index],s.active?.17+attention*.83:.08,reduced?1:(s.active?.036:.015));
      const g=ease(clamp(growth[index]+nursery.pulse*.12));
      const tip={x:restTip.x+(px-restTip.x)*attention*.12+Math.sin(time*.00066+index)*w*.003,y:restTip.y+(py-restTip.y)*attention*.055};
      const cp1={x:base.x+(index-1)*w*.020+(px-base.x)*attention*.045,y:base.y-h*.12};
      const cp2={x:tip.x-(index-1)*w*.025+(px-tip.x)*attention*.065,y:tip.y+h*.12};
      ctx.strokeStyle=index===1?warm:ink;ctx.lineWidth=1.15+attention*.42;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.bezierCurveTo(cp1.x,cp1.y,cp2.x,cp2.y,tip.x,tip.y);ctx.stroke();
      const stemPoint=u=>cubic(base,cp1,cp2,tip,u);
      const tangentAt=u=>{const p=stemPoint(u),n=stemPoint(Math.min(.985,u+.025));return{p,a:Math.atan2(n.y-p.y,n.x-p.x)}};
      if(index===0){
        const a=tangentAt(.67);lance(a.p,a.a-1.02,4+12*g,1.15+1.65*g,ink);
        const b=tangentAt(.79);lance(b.p,b.a+.84,2+10*g,.9+1.32*g,paper,ink);
        ctx.strokeStyle=ink;ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(tip.x-1.3,tip.y+1.6);ctx.lineTo(tip.x+2.2,tip.y-1.5);ctx.stroke();
      }else if(index===1){
        const bloom={x:tip.x,y:tip.y+1.4};
        lance(bloom,-1.80,3+10*g,1.0+1.45*g,ink);
        lance({x:bloom.x-1.2*g,y:bloom.y+1.0*g},-1.22,2+8*g,.72+1.05*g,paper,ink);
        lance({x:bloom.x+1.0*g,y:bloom.y+1.5*g},-.58,2+6*g,.76+1.02*g,warm);
        ctx.fillStyle=warm;ctx.fillRect(tip.x-1.15,tip.y-3.4,2.3,5.3);
      }else{
        const fork=tangentAt(.77),branch=6+7*g;ctx.strokeStyle=ink;ctx.lineWidth=1.0;ctx.beginPath();ctx.moveTo(fork.p.x,fork.p.y);ctx.lineTo(fork.p.x+Math.cos(fork.a-.64)*branch,fork.p.y+Math.sin(fork.a-.64)*branch);ctx.moveTo(fork.p.x,fork.p.y);ctx.lineTo(fork.p.x+Math.cos(fork.a+.68)*(branch*.82),fork.p.y+Math.sin(fork.a+.68)*(branch*.82));ctx.stroke();
        lance({x:fork.p.x+Math.cos(fork.a-.64)*branch,y:fork.p.y+Math.sin(fork.a-.64)*branch},fork.a-1.22,3+7*g,.88+1.2*g,ink);
        lance({x:fork.p.x+Math.cos(fork.a+.68)*(branch*.82),y:fork.p.y+Math.sin(fork.a+.68)*(branch*.82)},fork.a+.10,2+6*g,.75+1.0*g,paper,ink);
        ctx.strokeStyle=ink;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(tip.x-1.8,tip.y+1.1);ctx.lineTo(tip.x+2.4,tip.y-1.1);ctx.stroke();
      }
    });
    data.rhizomePulses.forEach(pulse=>{pulse.age+=dt*.001;const q=clamp(pulse.age/1.2),p=rootPoint(q);ctx.fillStyle=`rgba(209,138,27,${(1-q)*.96})`;ctx.beginPath();ctx.arc(p.x,p.y,2.3-q*.7,0,TAU);ctx.fill();buds.forEach(bud=>{const arrival=clamp((q-bud.u+.12)/.22);if(arrival<=0)return;const base=rootPoint(bud.u);ctx.strokeStyle=`rgba(209,138,27,${(1-arrival)*.82})`;ctx.lineWidth=1.35;ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.lineTo(base.x,base.y-h*.12*arrival);ctx.stroke();});});
    data.rhizomePulses=data.rhizomePulses.filter(pulse=>pulse.age<1.2);ctx.lineCap='butt';
  }

  /* Foreground growth pass. It retains the Garden renderer as the physical
     system and only makes its already-attached forms optically legible in the
     compact two-column mark. */
  function drawNonprofitGardenBloom(s, dt) {
    drawNonprofitGarden(s, dt);
    const {ctx,w,h,data,time}=s;
    const ink='#1F2937',warm='#bf0909',paper='#f4f4ef';
    const px=s.pointer.x*w,py=s.pointer.y*h,rootY=h*.68;
    const ease=t=>1-Math.pow(1-clamp(t),3);
    const rootPoint=u=>{
      const x=mix(w*.05,w*.95,u),base=rootY+Math.sin(u*Math.PI*2.15+time*.00034)*h*.022;
      const pull=data.nursery.wave*smooth(1-Math.hypot(x-px,base-py)/Math.max(44,w*.33));
      return{x,y:base+clamp((py-base)*pull*.18,-h*.08,h*.08)+Math.sin(u*Math.PI*3+time*.0011)*data.nursery.pulse*h*.036};
    };
    const cubic=(a,b,c,d,u)=>{const v=1-u;return{x:v*v*v*a.x+3*v*v*u*b.x+3*v*u*u*c.x+u*u*u*d.x,y:v*v*v*a.y+3*v*v*u*b.y+3*v*u*u*c.y+u*u*u*d.y}};
    const petal=(at,angle,length,width,fill,stroke)=>{ctx.save();ctx.translate(at.x,at.y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(length*.48,-width,length,0);ctx.quadraticCurveTo(length*.43,width*.62,0,0);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.9;ctx.stroke();}ctx.restore();};
    const buds=[{u:.22,top:.39},{u:.50,top:.18},{u:.79,top:.43}];
    buds.forEach((bud,index)=>{
      const base=rootPoint(bud.u),restTip={x:base.x+(index-1)*w*.022,y:bud.top*h};
      const attention=data.nursery.wave*smooth(1-Math.hypot(restTip.x-px,restTip.y-py)/Math.max(52,w*.37));
      const g=ease(clamp((data.nursery.growth||[.08,.08,.08])[index]+data.nursery.pulse*.12));
      const tip={x:restTip.x+(px-restTip.x)*attention*.12+Math.sin(time*.00066+index)*w*.003,y:restTip.y+(py-restTip.y)*attention*.055};
      const cp1={x:base.x+(index-1)*w*.020+(px-base.x)*attention*.045,y:base.y-h*.12};
      const cp2={x:tip.x-(index-1)*w*.025+(px-tip.x)*attention*.065,y:tip.y+h*.12};
      const pointAt=u=>cubic(base,cp1,cp2,tip,u);
      const tangentAt=u=>{const p=pointAt(u),n=pointAt(Math.min(.985,u+.024));return{p,a:Math.atan2(n.y-p.y,n.x-p.x)}};
      if(index===0){
        const lower=tangentAt(.61),upper=tangentAt(.75);
        petal(lower.p,lower.a-1.10,5+14*g,1.3+2.0*g,ink);
        petal(upper.p,upper.a+.90,3+12*g,1.05+1.6*g,paper,ink);
      } else if(index===1){
        /* The flower is a three-way unfolding mark, not a filled terminal
           circle: green support, white leaf, and the orange signal split. */
        const c={x:tip.x,y:tip.y+1.1};
        petal(c,-1.76,4+15*g,1.35+2.1*g,ink);
        petal({x:c.x-1.2*g,y:c.y+1.3*g},-1.18,3+12*g,1.0+1.7*g,paper,ink);
        petal({x:c.x+1.5*g,y:c.y+1.8*g},-.52,3+10*g,1.0+1.5*g,warm);
        ctx.fillStyle=warm;ctx.fillRect(c.x-1.5,c.y-4.4,3,6.8);
      } else {
        const fork=tangentAt(.72),d=7+9*g;
        ctx.strokeStyle=ink;ctx.lineWidth=1.35;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(fork.p.x,fork.p.y);ctx.lineTo(fork.p.x+Math.cos(fork.a-.65)*d,fork.p.y+Math.sin(fork.a-.65)*d);ctx.moveTo(fork.p.x,fork.p.y);ctx.lineTo(fork.p.x+Math.cos(fork.a+.70)*(d*.80),fork.p.y+Math.sin(fork.a+.70)*(d*.80));ctx.stroke();
        petal({x:fork.p.x+Math.cos(fork.a-.65)*d,y:fork.p.y+Math.sin(fork.a-.65)*d},fork.a-1.20,3+9*g,1+1.5*g,ink);
        petal({x:fork.p.x+Math.cos(fork.a+.70)*(d*.80),y:fork.p.y+Math.sin(fork.a+.70)*(d*.80)},fork.a+.08,3+8*g,.9+1.35*g,paper,ink);
      }
    });
    ctx.lineCap='butt';
  }

  /* Detail-only final layer: it never creates independent particles. The extra
     forms use the same three stems and the same eased growth state, making the
     cursor read as cultivation rather than a decorative hover effect. */
  function drawNonprofitGardenBloomV2(s, dt) {
    drawNonprofitGardenBloom(s, dt);
    const {ctx,w,h,data,time}=s;
    const ink='#1F2937',warm='#bf0909',paper='#f4f4ef';
    const px=s.pointer.x*w,py=s.pointer.y*h,rootY=h*.68;
    const ease=t=>1-Math.pow(1-clamp(t),3);
    const rootPoint=u=>{
      const x=mix(w*.05,w*.95,u),base=rootY+Math.sin(u*Math.PI*2.15+time*.00034)*h*.022;
      const pull=data.nursery.wave*smooth(1-Math.hypot(x-px,base-py)/Math.max(44,w*.33));
      return{x,y:base+clamp((py-base)*pull*.18,-h*.08,h*.08)+Math.sin(u*Math.PI*3+time*.0011)*data.nursery.pulse*h*.036};
    };
    const cubic=(a,b,c,d,u)=>{const v=1-u;return{x:v*v*v*a.x+3*v*v*u*b.x+3*v*u*u*c.x+u*u*u*d.x,y:v*v*v*a.y+3*v*v*u*cp1y+3*v*u*u*c2y+u*u*u*d.y}};
    /* Use a local Bézier evaluator with both axes explicit: a growing shape can
       never detach from its stem while the root is being pulled. */
    const curve=(a,b,c,d,u)=>{const v=1-u;return{x:v*v*v*a.x+3*v*v*u*b.x+3*v*u*u*c.x+u*u*u*d.x,y:v*v*v*a.y+3*v*v*u*b.y+3*v*u*u*c.y+u*u*u*d.y}};
    const petal=(at,angle,length,width,fill,stroke)=>{if(length<.2)return;ctx.save();ctx.translate(at.x,at.y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(length*.48,-width,length,0);ctx.quadraticCurveTo(length*.45,width*.62,0,0);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.85;ctx.stroke();}ctx.restore();};
    const buds=[{u:.22,top:.39},{u:.50,top:.18},{u:.79,top:.43}];
    buds.forEach((bud,index)=>{
      const base=rootPoint(bud.u),restTip={x:base.x+(index-1)*w*.022,y:bud.top*h};
      const attention=data.nursery.wave*smooth(1-Math.hypot(restTip.x-px,restTip.y-py)/Math.max(52,w*.37));
      const g=ease(clamp((data.nursery.growth||[.08,.08,.08])[index]+data.nursery.pulse*.12));
      if(g<.12)return;
      const tip={x:restTip.x+(px-restTip.x)*attention*.12+Math.sin(time*.00066+index)*w*.003,y:restTip.y+(py-restTip.y)*attention*.055};
      const cp1={x:base.x+(index-1)*w*.020+(px-base.x)*attention*.045,y:base.y-h*.12};
      const cp2={x:tip.x-(index-1)*w*.025+(px-tip.x)*attention*.065,y:tip.y+h*.12};
      const at=u=>curve(base,cp1,cp2,tip,u);
      const tangent=u=>{const p=at(u),n=at(Math.min(.985,u+.024));return{p,a:Math.atan2(n.y-p.y,n.x-p.x)}};
      if(index===0){
        const p=tangent(.50);petal(p.p,p.a-1.02,2+14*g,1+1.7*g,ink);
        const q=tangent(.84);petal(q.p,q.a+.72,2+11*g,.9+1.35*g,paper,ink);
      } else if(index===1) {
        /* A compact flower only unfolds as the central stem receives focus. */
        const burst=smooth((g-.12)/.88),c={x:tip.x,y:tip.y+.8};
        const petals=[[-2.15,ink,1],[-1.56,paper,1],[-.92,warm,.82],[-.35,ink,.70]];
        petals.forEach(([angle,color,scale],n)=>petal({x:c.x+Math.cos(angle)*burst*1.7,y:c.y+Math.sin(angle)*burst*1.7},angle,2+(16*burst*scale),1+(2.35*burst*scale),color,color===paper?ink:null));
        ctx.fillStyle=warm;ctx.fillRect(c.x-1.8,c.y-1.8,3.6,3.6);
      } else {
        const p=tangent(.56);petal(p.p,p.a-1.10,2+11*g,.9+1.45*g,ink);
        const q=tangent(.88);petal(q.p,q.a+.92,2+9*g,.85+1.2*g,paper,ink);
      }
    });
    ctx.lineCap='butt';
  }

  /* High-response interaction layer. The three forms remain rooted in the
     nursery, but pointer energy now travels through the whole system instead
     of only making a nearly imperceptible local tremor. */
  function drawNonprofitGardenMotion(s, dt) {
    drawNonprofitGardenBloomV2(s, dt);
    const {ctx,w,h,data,time}=s;
    const ink='#1F2937',warm='#bf0909',paper='#f4f4ef';
    const px=s.pointer.x*w,py=s.pointer.y*h,rootY=h*.68;
    const nursery=data.nursery;
    nursery.energy=mix(nursery.energy||0,s.active?1:0,reduced?1:(s.active?.105:.028));
    const energy=nursery.energy;
    if(energy<.012)return;
    const ease=t=>1-Math.pow(1-clamp(t),3);
    const rootPoint=u=>{
      const x=mix(w*.05,w*.95,u),base=rootY+Math.sin(u*Math.PI*2.15+time*.00034)*h*.022;
      const local=smooth(1-Math.hypot(x-px,base-py)/Math.max(38,w*.29))*energy;
      return{x,y:base+clamp((py-base)*local*.48,-h*.18,h*.18)+Math.sin(time*.005+u*11)*local*h*.026,local};
    };
    const root=[];for(let n=0;n<=56;n++)root.push(rootPoint(n/56));
    ctx.strokeStyle=`rgba(23,56,46,${.22+energy*.62})`;ctx.lineWidth=1.15+energy*1.35;ctx.lineCap='round';ctx.beginPath();root.forEach((p,n)=>n?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
    const curve=(a,b,c,d,u)=>{const v=1-u;return{x:v*v*v*a.x+3*v*v*u*b.x+3*v*u*u*c.x+u*u*u*d.x,y:v*v*v*a.y+3*v*v*u*b.y+3*v*u*u*c.y+u*u*u*d.y}};
    const leaf=(at,angle,length,width,fill,stroke)=>{if(length<.5)return;ctx.save();ctx.translate(at.x,at.y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(length*.48,-width,length,0);ctx.quadraticCurveTo(length*.45,width*.60,0,0);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.86;ctx.stroke();}ctx.restore();};
    const shoots=[{u:.22,top:.39,phase:0},{u:.50,top:.18,phase:2.1},{u:.79,top:.43,phase:4.25}];
    shoots.forEach((shoot,index)=>{
      const base=rootPoint(shoot.u),restTip={x:base.x+(index-1)*w*.022,y:shoot.top*h};
      const local=smooth(1-Math.hypot(restTip.x-px,restTip.y-py)/Math.max(55,w*.42));
      const g=ease(clamp(((nursery.growth||[.08,.08,.08])[index])*.68+energy*(.34+local*.58)+nursery.pulse*.10));
      const sway=Math.sin(time*.004+shoot.phase)*energy;
      const tip={x:restTip.x+(px-restTip.x)*(energy*.075+local*energy*.18)+sway*w*.010,y:restTip.y+(py-restTip.y)*(energy*.035+local*energy*.13)};
      const cp1={x:base.x+(index-1)*w*.026+(px-base.x)*local*energy*.09,y:base.y-h*(.12+energy*.035)};
      const cp2={x:tip.x-(index-1)*w*.030+(px-tip.x)*local*energy*.12,y:tip.y+h*(.12+energy*.025)};
      ctx.strokeStyle=index===1?warm:ink;ctx.lineWidth=1.1+energy*1.15;ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.bezierCurveTo(cp1.x,cp1.y,cp2.x,cp2.y,tip.x,tip.y);ctx.stroke();
      const point=u=>curve(base,cp1,cp2,tip,u);
      const tangent=u=>{const p=point(u),n=point(Math.min(.985,u+.027));return{p,a:Math.atan2(n.y-p.y,n.x-p.x)}};
      if(index===0){
        const a=tangent(.53),b=tangent(.73);leaf(a.p,a.a-1.12,4+17*g,1.3+2.4*g,ink);leaf(b.p,b.a+.84,3+13*g,1.0+1.8*g,paper,ink);
      }else if(index===1){
        const bloom=smooth((g-.18)/.82),c={x:tip.x,y:tip.y+1.2};
        const forms=[[-2.34,ink,1],[-1.72,paper,.94],[-1.05,warm,.86],[-.42,ink,.73]];
        forms.forEach(([angle,color,scale])=>leaf({x:c.x+Math.cos(angle)*bloom*2.4,y:c.y+Math.sin(angle)*bloom*2.4},angle,3+20*bloom*scale,1.15+2.8*bloom*scale,color,color===paper?ink:null));
        ctx.fillStyle=warm;ctx.fillRect(c.x-2.0,c.y-2.0,4,4);
      }else{
        const p=tangent(.58),q=tangent(.79);leaf(p.p,p.a-1.10,3+14*g,1.05+2.0*g,ink);leaf(q.p,q.a+.91,3+12*g,.95+1.65*g,paper,ink);
      }
    });
    ctx.lineCap='butt';
  }

  /* Clean production renderer. Earlier visual studies remain above for
     rollback, but this pass draws the nursery exactly once: no doubled stems,
     no stacked roots, and no shapes that appear detached from the plant. */
  function drawNonprofitGardenCoherent(s, dt) {
    const {ctx,w,h,data,time}=s;
    const ink='#1F2937',warm='#bf0909',paper='#f4f4ef';
    const nursery=data.nursery;
    const px=s.pointer.x*w,py=s.pointer.y*h,rootY=h*.69;
    const ease=t=>1-Math.pow(1-clamp(t),3);
    const growth=nursery.growth||(nursery.growth=[.34,.34,.34]);
    nursery.wave=mix(nursery.wave,s.active?1:0,reduced?1:.075);
    nursery.pulse=Math.max(0,nursery.pulse-dt*.00048);
    const rootPoint=u=>{
      const x=mix(w*.05,w*.95,u),base=rootY+Math.sin(u*Math.PI*1.8+time*.00028)*h*.020;
      const local=nursery.wave*smooth(1-Math.hypot(x-px,base-py)/Math.max(42,w*.31));
      return{x,y:base+clamp((py-base)*local*.28,-h*.11,h*.11)+Math.sin(time*.003+u*9)*local*h*.014,local};
    };
    const cubic=(a,b,c,d,u)=>{const v=1-u;return{x:v*v*v*a.x+3*v*v*u*b.x+3*v*u*u*c.x+u*u*u*d.x,y:v*v*v*a.y+3*v*v*u*b.y+3*v*u*u*c.y+u*u*u*d.y}};
    const stroke=(points,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach((p,n)=>n?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();};
    const leaf=(at,angle,length,width,fill,outline)=>{ctx.save();ctx.translate(at.x,at.y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(length*.47,-width,length,0);ctx.quadraticCurveTo(length*.43,width*.58,0,0);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(outline){ctx.strokeStyle=outline;ctx.lineWidth=.82;ctx.stroke();}ctx.restore();};
    ctx.fillStyle=paper;ctx.fillRect(0,0,w,h);
    const root=[];for(let i=0;i<=54;i++)root.push(rootPoint(i/54));
    stroke(root,ink,2.05);
    stroke(root.slice(16,29),'rgba(244,244,239,.92)',.72);
    [5,11,17,25,33,40,48].forEach((n,i)=>{const p=root[n],prev=root[n-1],next=root[n+1],a=Math.atan2(next.y-prev.y,next.x-prev.x)+(i%2?1.55:1.70),len=5+(i%3)*2;ctx.strokeStyle=i===3?warm:'rgba(23,56,46,.50)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo(p.x+Math.cos(a)*len*.4,p.y+Math.sin(a)*len*.18,p.x+Math.cos(a)*len,p.y+Math.sin(a)*len);ctx.stroke();});
    const plants=[{u:.22,top:.39,kind:'cotyledon',phase:.4},{u:.50,top:.17,kind:'bloom',phase:2.1},{u:.79,top:.43,kind:'fork',phase:4.2}];
    plants.forEach((plant,index)=>{
      const base=rootPoint(plant.u),restTip={x:base.x+(index-1)*w*.018,y:plant.top*h};
      const focus=smooth(1-Math.hypot(restTip.x-px,restTip.y-py)/Math.max(54,w*.38));
      const target=s.active?.36+focus*.64:.30;
      growth[index]=mix(growth[index],target,reduced?1:(s.active?.062:.018));
      const g=ease(growth[index]+nursery.pulse*.11);
      const sway=Math.sin(time*.0028+plant.phase)*nursery.wave;
      const tip={x:restTip.x+(px-restTip.x)*(focus*.14+nursery.wave*.028)+sway*w*.006,y:restTip.y+(py-restTip.y)*(focus*.09+nursery.wave*.018)};
      const cp1={x:base.x+(index-1)*w*.024+(px-base.x)*focus*.07,y:base.y-h*(.11+.018*nursery.wave)};
      const cp2={x:tip.x-(index-1)*w*.028+(px-tip.x)*focus*.09,y:tip.y+h*(.115+.017*nursery.wave)};
      ctx.strokeStyle=index===1?warm:ink;ctx.lineWidth=1.2+focus*.72;ctx.beginPath();ctx.moveTo(base.x,base.y);ctx.bezierCurveTo(cp1.x,cp1.y,cp2.x,cp2.y,tip.x,tip.y);ctx.stroke();
      const point=u=>cubic(base,cp1,cp2,tip,u);
      const tangent=u=>{const p=point(u),n=point(Math.min(.985,u+.025));return{p,a:Math.atan2(n.y-p.y,n.x-p.x)}};
      if(plant.kind==='cotyledon'){
        const a=tangent(.49),b=tangent(.66),c=tangent(.82);
        leaf(a.p,a.a-1.13,5+14*g,1.4+2.25*g,ink);
        leaf(b.p,b.a+.83,4+12*g,1.12+1.7*g,paper,ink);
        leaf(c.p,c.a-1.00,2+8*g,.9+1.3*g,ink);
      }else if(plant.kind==='bloom'){
        const bloom=smooth((g-.19)/.81),c={x:tip.x,y:tip.y+1.4};
        const petals=[[-2.28,ink,1],[-1.70,paper,.92],[-1.10,warm,.82],[-.48,ink,.70]];
        petals.forEach(([angle,color,scale])=>leaf({x:c.x+Math.cos(angle)*bloom*2,y:c.y+Math.sin(angle)*bloom*2},angle,3+18*bloom*scale,1.12+2.55*bloom*scale,color,color===paper?ink:null));
        ctx.fillStyle=warm;ctx.fillRect(c.x-1.8,c.y-1.8,3.6,3.6);
      }else{
        const fork=tangent(.66),d=5+10*g;
        ctx.strokeStyle=ink;ctx.lineWidth=1.18;ctx.beginPath();ctx.moveTo(fork.p.x,fork.p.y);ctx.lineTo(fork.p.x+Math.cos(fork.a-.67)*d,fork.p.y+Math.sin(fork.a-.67)*d);ctx.moveTo(fork.p.x,fork.p.y);ctx.lineTo(fork.p.x+Math.cos(fork.a+.68)*d*.82,fork.p.y+Math.sin(fork.a+.68)*d*.82);ctx.stroke();
        leaf({x:fork.p.x+Math.cos(fork.a-.67)*d,y:fork.p.y+Math.sin(fork.a-.67)*d},fork.a-1.17,3+10*g,1+1.65*g,ink);
        leaf({x:fork.p.x+Math.cos(fork.a+.68)*d*.82,y:fork.p.y+Math.sin(fork.a+.68)*d*.82},fork.a+.12,3+9*g,.95+1.45*g,paper,ink);
        const p=tangent(.43);leaf(p.p,p.a+1.00,2+7*g,.82+1.1*g,ink);
      }
    });
    data.rhizomePulses.forEach(pulse=>{pulse.age+=dt*.001;const q=clamp(pulse.age/1.16),p=rootPoint(q);ctx.fillStyle=`rgba(209,138,27,${(1-q)*.96})`;ctx.beginPath();ctx.arc(p.x,p.y,2.25-q*.7,0,TAU);ctx.fill();});
    data.rhizomePulses=data.rhizomePulses.filter(pulse=>pulse.age<1.16);ctx.lineCap='butt';
  }

  /* The nursery is already alive when it enters view. Hover is an expansion of
     that base state, never a transition from three empty sticks. */
  function drawNonprofitGardenEstablished(s, dt) {
    const nursery=s.data.nursery;
    if(!nursery.coherentBaseline){
      nursery.coherentBaseline=true;
      nursery.growth=[.42,.42,.42];
    }
    drawNonprofitGardenCoherent(s, dt);
  }

  /* Growth is a change in botanical structure, not a scale transform. This
     layer adds staged, stem-attached leaves/petals only while attention is in
     the mark; the base foliage rendered above remains visible at rest. */
  function drawNonprofitGardenCanopy(s, dt) {
    drawNonprofitGardenEstablished(s, dt);
    const {ctx,w,h,data,time}=s;
    const ink='#1F2937',warm='#bf0909',paper='#f4f4ef';
    const nursery=data.nursery;
    const px=s.pointer.x*w,py=s.pointer.y*h,rootY=h*.69;
    const canopy=nursery.canopy||(nursery.canopy=[0,0,0]);
    const ease=t=>1-Math.pow(1-clamp(t),3);
    const rootPoint=u=>{
      const x=mix(w*.05,w*.95,u),base=rootY+Math.sin(u*Math.PI*1.8+time*.00028)*h*.020;
      const local=nursery.wave*smooth(1-Math.hypot(x-px,base-py)/Math.max(42,w*.31));
      return{x,y:base+clamp((py-base)*local*.28,-h*.11,h*.11)};
    };
    const cubic=(a,b,c,d,u)=>{const v=1-u;return{x:v*v*v*a.x+3*v*v*u*b.x+3*v*u*u*c.x+u*u*u*d.x,y:v*v*v*a.y+3*v*v*u*b.y+3*v*u*u*c.y+u*u*u*d.y}};
    const leaf=(at,angle,length,width,fill,outline)=>{if(length<.35)return;ctx.save();ctx.translate(at.x,at.y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(length*.47,-width,length,0);ctx.quadraticCurveTo(length*.43,width*.58,0,0);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(outline){ctx.strokeStyle=outline;ctx.lineWidth=.82;ctx.stroke();}ctx.restore();};
    const plants=[{u:.22,top:.39,phase:.4},{u:.50,top:.17,phase:2.1},{u:.79,top:.43,phase:4.2}];
    plants.forEach((plant,index)=>{
      const base=rootPoint(plant.u),restTip={x:base.x+(index-1)*w*.018,y:plant.top*h};
      const focus=smooth(1-Math.hypot(restTip.x-px,restTip.y-py)/Math.max(54,w*.38));
      const target=s.active?.12+focus*.88:0;
      canopy[index]=mix(canopy[index],target,reduced?1:(s.active?.13:.024));
      const a=ease(canopy[index]);
      if(a<.025)return;
      const tip={x:restTip.x+(px-restTip.x)*(focus*.14+nursery.wave*.028),y:restTip.y+(py-restTip.y)*(focus*.09+nursery.wave*.018)};
      const cp1={x:base.x+(index-1)*w*.024+(px-base.x)*focus*.07,y:base.y-h*(.11+.018*nursery.wave)};
      const cp2={x:tip.x-(index-1)*w*.028+(px-tip.x)*focus*.09,y:tip.y+h*(.115+.017*nursery.wave)};
      const point=u=>cubic(base,cp1,cp2,tip,u);
      const tangent=u=>{const p=point(u),n=point(Math.min(.985,u+.025));return{p,a:Math.atan2(n.y-p.y,n.x-p.x)}};
      if(index===0){
        const first=ease((a-.05)/.65),second=ease((a-.36)/.64);
        const p=tangent(.31),q=tangent(.57),r=tangent(.76);
        leaf(p.p,p.a-1.04,first*15,first*2.55,ink);
        leaf(q.p,q.a+.91,first*13,first*2.15,paper,ink);
        leaf(r.p,r.a-1.16,second*15,second*2.35,ink);
        leaf(r.p,r.a+.72,second*11,second*1.85,paper,ink);
      }else if(index===1){
        const petals=ease((a-.06)/.78),outer=ease((a-.42)/.56),c={x:tip.x,y:tip.y+1.6};
        [[-2.50,ink,1],[-1.90,paper,.90],[-1.34,warm,.88],[-.78,ink,.76],[-.22,paper,.65]].forEach(([angle,color,scale])=>leaf({x:c.x+Math.cos(angle)*petals*2.3,y:c.y+Math.sin(angle)*petals*2.3},angle,petals*(7+14*scale),petals*(1.1+2.45*scale),color,color===paper?ink:null));
        [[-2.12,ink],[-.55,warm],[.02,ink]].forEach(([angle,color])=>leaf({x:c.x+Math.cos(angle)*outer*4,y:c.y+Math.sin(angle)*outer*4},angle,outer*13,outer*2.05,color));
        ctx.fillStyle=warm;ctx.fillRect(c.x-1.9,c.y-1.9,3.8,3.8);
      }else{
        const first=ease((a-.05)/.65),second=ease((a-.38)/.62);
        const p=tangent(.38),q=tangent(.57),r=tangent(.82);
        leaf(p.p,p.a+1.04,first*13,first*2.15,ink);
        leaf(q.p,q.a-1.08,first*14,first*2.38,paper,ink);
        leaf(r.p,r.a+.84,second*14,second*2.2,ink);
        leaf(r.p,r.a-1.12,second*11,second*1.75,paper,ink);
      }
    });
    ctx.lineCap='butt';
  }

  function draw(s, time, dt) {
    s.time = reduced ? 3400 : time;
    s.pointer.x = mix(s.pointer.x, s.pointer.tx, reduced ? 1 : .115);
    s.pointer.y = mix(s.pointer.y, s.pointer.ty, reduced ? 1 : .115);
    s.hit = Math.max(0, s.hit - dt * .00062); s.pulse = Math.max(0, s.pulse - dt * .0007);
    if (s.type === "platform") drawPlatform(s);
    else if (s.type === "space") drawSpace(s, dt);
    else if (s.type === "teams") drawTeams(s);
    else if (s.type === "consulting") drawConsulting(s);
    else if (s.type === "nonprofit") drawNonprofitGardenCanopy(s, dt);
    else if (s.type === "nonprofit") drawNonprofitGardenEstablished(s, dt);
    else if (s.type === "nonprofit") drawNonprofitGardenCoherent(s, dt);
    else if (s.type === "nonprofit") drawNonprofitGardenMotion(s, dt);
    else if (s.type === "nonprofit") drawNonprofitGardenBloomV2(s, dt);
    else if (s.type === "nonprofit") drawNonprofitGardenBloom(s, dt);
    else if (s.type === "nonprofit") drawNonprofitGarden(s, dt);
    else if (s.type === "nonprofit") drawNonprofitNursery(s, dt);
    else if (s.type === "nonprofit") drawNonprofitGrowth(s);
    else if (s.type === "nonprofit") drawNonprofit(s);
  }

  let running = false, previous = performance.now();
  const frame = time => {
    const dt = Math.min(34, time - previous || 16); previous = time;
    states.filter(s => s.visible).forEach(s => draw(s, time, reduced ? 0 : dt));
    if (!reduced && states.some(s => s.visible)) requestAnimationFrame(frame); else running = false;
  };
  const visibility = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const s = states.find(v => v.root === entry.target); if (s) s.visible = entry.isIntersecting;
    });
    if (!running && states.some(s => s.visible)) { running = true; previous = performance.now(); requestAnimationFrame(frame); }
  }, { rootMargin: "160px 0px" });
  states.forEach(s => { resize(s); draw(s, performance.now(), 0); visibility.observe(s.root); });
})();
