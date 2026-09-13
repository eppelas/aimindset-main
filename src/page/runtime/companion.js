
(function () {
  'use strict';

  /* Лицо рисуется в поле #hero-kv; идл-компаньон — самостоятельная фигура. */

  /* ---------- config (ported from minified `Xt`) ---------- */
  var CFG = {
    voxelSize: 4.5,
    scale: 1.75,                 // legible enough for its palm, eye and carried request to read as one figure
    growth: 0.72,                // fixed NS() growth param: arms + antennae + spread feet
    bubbleBackground: 'rgba(23,23,23,0.92)',
    bubbleText: '#bbb',
    bubbleFontSize: 11,
    bubbleFontWeight: 400,
    wanderSpeed: 0.015,
    maxSpeed: 1.8,
    friction: 0.978,
    gravity: 0.003,
    perimeterMargin: 80,
    idleAfterMs: 6500,           // User idle delay before the companion appears.
    reenterCooldownMs: 45000,    // пауза между визитами — не «постоянно вылезает»
    firstAfterMs: 15000,         // первый выход не раньше 15 с после загрузки
    promptEveryMin: 6, promptEveryMax: 10, // seconds between bubbles
    typewriterSecPerChar: 0.03,  // ~30ms/char reveal
    bubbleHold: 3.0,             // seconds at full text
    topLimit: 120,               // never walk over header
    bottomPad: 80,
    phases: {                    // session phases (glyph accents warm up over time)
      newcomer:    { after: 0,   eyeScale: 1.3, glyphOpacity: 0.3 },
      comfortable: { after: 60,  eyeScale: 1.1, glyphOpacity: 0.5 },
      inspired:    { after: 180, eyeScale: 1,   glyphOpacity: 0.8 },
      deep:        { after: 420, eyeScale: 0.9, glyphOpacity: 1 }
    }
  };

  /* palette (ported from `dL`) */
  var INK = '#1F2937';
  var PALETTE = [INK, '#6B7280', '#C50D17', '#f4f4ef', '#374151', '#9CA3AF', 'rgba(197,13,23,0.48)'];

  var PROMPTS = [
    'начни с одной задачи',
    'сначала опиши контекст',
    'проверь на живом кейсе',
    'сохрани удачный ход',
    'повтори вручную — потом автоматизируй',
    'раздели задачу на следующий шаг',
    'сформулируй, что должно измениться',
    'сравни два подхода',
    'задай системе роль и границы',
    'собери материалы в одном месте',
    'не усложняй первый проход',
    'оставь человеку последнее слово',
    'передай рутину, оставь решение себе',
    'преврати повторение в шаблон',
    'если ответ не подходит — уточни задачу'
  ];

  /* ---------- reduced motion: fully disabled ---------- */
  var mqReduce = null;  /* Обработка prefers-reduced-motion снята намеренно: страница показывает одно и то же на любой машине. */
  // This is an idle-mouse companion. On touch-first screens it would cover content
  // without offering the intended cursor interaction, so it stays absent there.
  var mqFinePointer = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;

  /* ---------- isometric projection (ported from cL/uL, angle = PI/6) ---------- */
  var ISO = Math.PI / 6;
  var COSA = Math.cos(ISO);
  var SINA = Math.sin(ISO);
  function projX(x, y, z) { return (x - z) * COSA; }
  function projY(x, y, z) { return -y + (x + z) * SINA; } // model +y renders downward: screenY = cy - projY*size

  /* ---------- geometry builder ---------- */
  /* The idle companion is the consulting hand made mobile: a dense palm,
     three distinct fingers, an attentive eye, a warm request and four legs.
     It is a voxel translation of the same object, not another mascot. */
  function buildVoxels(growth) {
    var vox = [];
    function add(x, y, z, c) { vox.push([x, y, z, c]); }
    // A full but shaped palm: density gives it a readable mass at site scale,
    // while the stepped corners keep the silhouette from becoming a rectangle.
    for (var py = 0; py < 3; py++) for (var px = -4; px <= 4; px++) for (var pz = -1; pz <= 1; pz++) {
      var edge = Math.abs(px) + Math.abs(pz) * 1.18;
      if ((py === 0 && edge > 3.7) || (py === 2 && edge > 4.25) || edge > 4.7) continue;
      add(px, py, pz, px === -4 && py === 1 ? 1 : (py === 0 && pz === 1 ? 4 : 0));
    }
    // Three compact, tactile fingers echo the consulting form exactly; each has real volume.
    var fingers = [[-2,3],[0,4],[2,2]];
    for (var fi = 0; fi < fingers.length; fi++) for (var fy = 1; fy <= fingers[fi][1]; fy++) for (var fz = -1; fz <= 1; fz++) {
      if (Math.abs(fz) === 1 && fy === fingers[fi][1]) continue;
      add(fingers[fi][0], -fy, fz, fy === fingers[fi][1] ? 1 : (fz === 1 ? 4 : 0));
    }
    // Four short legs emerge under the palm, so it can cross the page without becoming humanoid.
    var feet = [-3, -1, 1, 3];
    for (var li = 0; li < feet.length; li++) {
      add(feet[li], 3, 0, 4); add(feet[li], 4, 0, li % 2 ? 1 : 4);
      add(feet[li] + (feet[li] < 0 ? -1 : 1), 4, -1, li % 2 ? 2 : 1);
    }
    return vox;
  }

  // painter's sort (z, then y, then x) — done once, geometry is static
  var VOXELS = buildVoxels(CFG.growth).sort(function (a, b) {
    return a[2] - b[2] || a[1] - b[1] || a[0] - b[0];
  });
  var HEAD_H = 0; // retained for the generic renderer's small secondary bob

  /* ---------- canvas ---------- */
  var canvas = document.createElement('canvas');
  canvas.id = 'vxc-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  var W = 0, H = 0, DPR = 1;
  function size() {
    var w = window.innerWidth, h = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === W && h === H && dpr === DPR) return; // guard: rebuild only on real change
    W = w; H = h; DPR = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------- shaded color cache (ported from `We`) ---------- */
  var shadeCache = {};
  function shade(color, ratio) {
    var key = color + ratio;
    if (shadeCache[key]) return shadeCache[key];
    var out;
    if (color.charAt(0) === 'r') { // rgba(...)
      var m = color.match(/[\d.]+/g);
      out = 'rgba(' + Math.round(parseFloat(m[0]) * ratio) + ',' + Math.round(parseFloat(m[1]) * ratio) + ',' +
            Math.round(parseFloat(m[2]) * ratio) + ',' + m[3] + ')';
    } else if (color.length === 7) {
      var r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
      out = 'rgb(' + Math.round(r * ratio) + ',' + Math.round(g * ratio) + ',' + Math.round(b * ratio) + ')';
    } else {
      return color;
    }
    shadeCache[key] = out;
    return out;
  }

  /* ---------- cube face drawing (ported from `me`: top + left 0.7 + right 0.85 + top edge stroke) ---------- */
  function drawCube(x, y, s, color, edge) {
    var h = s / 2;
    // top face
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + h * COSA, y - h + h * SINA);
    ctx.lineTo(x, y - h + h * SINA * 2);
    ctx.lineTo(x - h * COSA, y - h + h * SINA);
    ctx.closePath();
    ctx.fill();
    // left face (darkest)
    ctx.fillStyle = shade(color, 0.7);
    ctx.beginPath();
    ctx.moveTo(x - h * COSA, y - h + h * SINA);
    ctx.lineTo(x, y - h + h * SINA * 2);
    ctx.lineTo(x, y + h * SINA * 2 - h + h);
    ctx.lineTo(x - h * COSA, y + h * SINA);
    ctx.closePath();
    ctx.fill();
    // right face
    ctx.fillStyle = shade(color, 0.85);
    ctx.beginPath();
    ctx.moveTo(x + h * COSA, y - h + h * SINA);
    ctx.lineTo(x, y - h + h * SINA * 2);
    ctx.lineTo(x, y + h * SINA * 2 - h + h);
    ctx.lineTo(x + h * COSA, y + h * SINA);
    ctx.closePath();
    ctx.fill();
    // subtle top-edge highlight
    if (edge) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x - h * COSA, y - h + h * SINA);
      ctx.lineTo(x, y - h);
      ctx.lineTo(x + h * COSA, y - h + h * SINA);
      ctx.stroke();
    }
  }

  /* ---------- state ---------- */
  var MODE_HIDDEN = 'hidden', MODE_ENTERING = 'entering', MODE_ACTIVE = 'active', MODE_LEAVING = 'leaving';
  var mode = MODE_HIDDEN;
  var startedAt = performance.now();
  var lastActivity = performance.now();
  var lastLeftAt = -1e9;
  var sessionSec = 0;

  var C = { // character (ported from `I`)
    x: 0, y: 0, vx: 0, vy: 0,
    squash: 0.2, squashV: 0, squashTarget: 1,
    tilt: 0, hopY: 0, hopV: 0,
    blinkTimer: 0, blinkState: false,
    legPhase: 0, breathPhase: 0,
    floatPhase: Math.random() * Math.PI * 2,
    trail: [], facing: 1
  };
  var cursor = { x: -9999, y: -9999, active: false };
  var wander = { x: 0, y: 0, t: 0 };
  var entryTargetX = 0;

  function phase() {
    var p = CFG.phases;
    if (sessionSec >= p.deep.after) return p.deep;
    if (sessionSec >= p.inspired.after) return p.inspired;
    if (sessionSec >= p.comfortable.after) return p.comfortable;
    return p.newcomer;
  }

  function yMin() { return CFG.topLimit; }
  function yMax() { return Math.max(CFG.topLimit + 40, H - CFG.bottomPad); }
  function clampY(v) { return Math.max(yMin(), Math.min(yMax(), v)); }

  /* ---------- practical prompts: random, no immediate repeat (shuffle bag) ---------- */
  var bag = [];
  var lastPrompt = null;
  function nextPrompt() {
    if (!bag.length) {
      bag = PROMPTS.slice();
      for (var i = bag.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = bag[i]; bag[i] = bag[j]; bag[j] = t;
      }
      if (bag.length > 1 && bag[bag.length - 1] === lastPrompt) {
        bag[bag.length - 1] = bag[0]; bag[0] = lastPrompt;
      }
    }
    lastPrompt = bag.pop();
    return lastPrompt;
  }

  /* ---------- speech bubble (ported: fade in 0.25s / hold / fade out 0.6s, typewriter reveal) ---------- */
  var bubble = { text: '', timer: 0, duration: 0, opacity: 0, slideY: 0, charReveal: 0 };
  var nextPromptIn = 0;
  function say(text) {
    bubble.text = text;
    bubble.timer = 0;
    bubble.duration = 0.25 + text.length * CFG.typewriterSecPerChar + CFG.bubbleHold + 0.6;
    bubble.opacity = 0;
    bubble.slideY = 6;
    bubble.charReveal = 0;
  }
  function hushBubble() { // cut short on user activity
    if (bubble.opacity > 0 && bubble.timer < bubble.duration - 0.6) bubble.timer = bubble.duration - 0.6;
  }
  function updateBubble(dt) {
    if (bubble.opacity <= 0 && bubble.timer === 0 && bubble.slideY <= 0) return;
    bubble.timer += dt;
    if (bubble.timer < 0.25) bubble.opacity = Math.min(1, bubble.timer / 0.25);
    else if (bubble.timer < bubble.duration - 0.6) bubble.opacity = 1;
    else if (bubble.timer < bubble.duration) bubble.opacity = Math.max(0, (bubble.duration - bubble.timer) / 0.6);
    else bubble.opacity = 0;
    bubble.slideY += (0 - bubble.slideY) * 0.15;
    bubble.charReveal = Math.min(bubble.text.length, bubble.charReveal + dt / CFG.typewriterSecPerChar);
  }
  function wrapText(text, maxW) {
    var words = text.split(' ');
    var lines = [];
    var cur = '';
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = words[i]; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function roundRectPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawBubble(ax, ay) {
    if (bubble.opacity <= 0.01) return;
    ctx.save();
    ctx.font = CFG.bubbleFontWeight + ' ' + CFG.bubbleFontSize + 'px "JetBrains Mono", "IBM Plex Mono", monospace';
    var shown = bubble.text.slice(0, Math.floor(bubble.charReveal));
    var maxW = Math.min(280, W * 0.35);
    var lines = wrapText(shown, maxW);
    var lineH = CFG.bubbleFontSize + 3;
    var pad = 9;
    var boxW = Math.min(maxW + pad * 2, lines.reduce(function (m, l) {
      return Math.max(m, ctx.measureText(l).width);
    }, 0) + pad * 2);
    var boxH = lineH * lines.length + pad * 2 - 2;
    var bx = Math.max(6, Math.min(W - boxW - 6, ax - boxW / 2));
    var byy = Math.max(6, ay - 50 - (lines.length - 1) * lineH + bubble.slideY);
    ctx.globalAlpha = bubble.opacity * 0.95;
    // soft drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    roundRectPath(bx + 2, byy + 2, boxW, boxH, 6);
    ctx.fill();
    // rounded dark bubble with red top accent (clipped to keep corners clean)
    roundRectPath(bx, byy, boxW, boxH, 6);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = CFG.bubbleBackground;
    ctx.fillRect(bx, byy, boxW, boxH);
    ctx.fillStyle = PALETTE[2];
    ctx.fillRect(bx, byy, boxW, 1.5);
    ctx.restore();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = CFG.bubbleText;
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bx + pad, byy + pad + lineH * i + lineH / 2);
    }
    ctx.restore();
  }

  /* ---------- red speed trail (ported from `vt`) ---------- */
  function drawTrail() {
    var speed = Math.sqrt(C.vx * C.vx + C.vy * C.vy);
    if (speed < 0.5) return;
    for (var i = 0; i < C.trail.length; i++) {
      var p = C.trail[i];
      var a = i / C.trail.length * 0.06 * Math.min(speed / 2, 1);
      var s = 1 + i / C.trail.length * 2;
      ctx.globalAlpha = a;
      ctx.fillStyle = PALETTE[2];
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- character rendering (ported from `Be`) ---------- */
  function drawCharacter(now) {
    var ph = phase();
    var vs = CFG.voxelSize * CFG.scale;
    var t = (now - startedAt) / 1000;

    ctx.save();
    var floatY = Math.sin(C.floatPhase) * 2;
    var breath = 1 + Math.sin(C.breathPhase) * 0.02;
    var cx = C.x;
    var cy = C.y + C.hopY + floatY;
    ctx.translate(cx, cy);
    ctx.scale(C.facing * (1 + (1 - C.squash) * 0.15) * breath, C.squash * breath);
    ctx.rotate(C.tilt * 0.5);
    ctx.translate(-cx, -cy);

    // soft ellipse shadow beneath
    ctx.save();
    ctx.globalAlpha = 0.06 + CFG.growth * 0.04;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(cx, cy + (25 + CFG.growth * 8), (14 + CFG.growth * 12), (4 + CFG.growth * 2), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    var speed = Math.sqrt(C.vx * C.vx + C.vy * C.vy);
    var swing = Math.sin(C.legPhase) * Math.min(speed * 2, 4);

    for (var i = 0; i < VOXELS.length; i++) {
      var vx0 = VOXELS[i][0], vy0 = VOXELS[i][1], vz0 = VOXELS[i][2], ci = VOXELS[i][3];
      var color = PALETTE[ci];
      var mx = vx0, my = vy0, mz = vz0;

      // sensing feelers sway while walking
      if (vy0 < 0) mx += (vx0 < 0 ? swing : -swing) * 0.3;
      // outer body and feeler tips breathe independently.
      if (Math.abs(vx0) > 3 || (vy0 < 0 && Math.abs(vx0) >= 2)) {
        mx += Math.sin(t * 1.5 + vy0 * 0.5) * 0.3;
        my += Math.cos(t * 1.2 + vx0 * 0.3) * 0.15;
      }
      // diagonal pairs of legs stride, with a gentle lift at each step.
      if (vy0 >= 3) {
        var legBeat = Math.sin(C.legPhase + ((vx0 < 0) === (vz0 < 0) ? 0 : Math.PI));
        mx += legBeat * Math.min(speed * 1.1, 1.4);
        my += Math.max(0, legBeat) * Math.min(speed * 0.7, 0.8);
      }

      if (ci === 2) {
        ctx.globalAlpha = ph.glyphOpacity;
      } else if (ci === 6) {
        ctx.globalAlpha = ph.glyphOpacity * 0.3;
      } else if (ci === 3) {
        // eyes: blink, else pupils track cursor
        if (C.blinkState) color = INK;
        else {
          var dx = cursor.x - C.x, dy = cursor.y - C.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d > 10) { mx += dx / d * 0.3 * C.facing; my += dy / d * 0.15; }
        }
        ctx.globalAlpha = 1;
      } else if (ci === 5) {
        mx += Math.sin(t * 2 + vx0) * 0.5;
        my += Math.cos(t * 1.5 + vy0) * 0.4;
        ctx.globalAlpha = 0.5 + Math.sin(t * 3 + vx0 + vy0) * 0.3;
      } else {
        ctx.globalAlpha = 1;
      }

      var sx = cx + projX(mx, my, mz) * vs;
      var sy = cy - projY(mx, my, mz) * vs;
      drawCube(sx, sy, vs, color, ci !== 6);
    }
    // Foreground markers make the guide readable even at its intentionally small scale:
    // one attentive eye and the warm request it is carrying across the page.
    var lookX = 0, lookY = 0;
    var lookDX = cursor.x - C.x, lookDY = cursor.y - C.y;
    var lookD = Math.sqrt(lookDX * lookDX + lookDY * lookDY);
    if (lookD > 10) { lookX = lookDX / lookD * 0.26 * C.facing; lookY = lookDY / lookD * 0.12; }
    var eyeX = cx + projX(-2.15 + lookX, .55 + lookY, 1.85) * vs;
    var eyeY = cy - projY(-2.15 + lookX, .55 + lookY, 1.85) * vs;
    drawCube(eyeX, eyeY, vs * 1.32, PALETTE[3], true);
    drawCube(eyeX + vs * 0.05, eyeY + vs * 0.08, vs * 0.43, PALETTE[0], true);
    var cargoBob = Math.sin(t * 2.1) * 0.12;
    var cargoX = cx + projX(.25, -1.65 + cargoBob, 1.65) * vs;
    var cargoY = cy - projY(.25, -1.65 + cargoBob, 1.65) * vs;
    drawCube(cargoX, cargoY, vs * 1.35, PALETTE[2], true);
    drawCube(cargoX, cargoY - vs * 0.72, vs * 0.52, PALETTE[3], true);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ---------- wandering (perimeter-flavored targets, ported feel of `Je`) ---------- */
  function pickWanderTarget() {
    var m = CFG.perimeterMargin;
    switch (Math.floor(Math.random() * 4)) {
      case 0: wander.x = m + Math.random() * (W - m * 2); wander.y = yMin() + Math.random() * 40; break;
      case 1: wander.x = W - m - Math.random() * 30; wander.y = yMin() + Math.random() * (yMax() - yMin()); break;
      case 2: wander.x = m + Math.random() * (W - m * 2); wander.y = yMax() - Math.random() * 40; break;
      default: wander.x = m + Math.random() * 30; wander.y = yMin() + Math.random() * (yMax() - yMin()); break;
    }
    wander.y = clampY(wander.y);
    wander.t = 0;
  }

  /* ---------- state transitions ---------- */
  function enter() {
    size();
    // walk in from the screen edge nearest to the last cursor position
    var fromLeft = cursor.active ? cursor.x < W / 2 : Math.random() < 0.5;
    C.x = fromLeft ? -40 : W + 40;
    // Arrive on the lower perimeter: the companion never starts by covering the hero copy.
    C.y = clampY(yMax() - 36);
    C.vx = fromLeft ? 1 : -1;
    C.vy = 0;
    C.trail.length = 0;
    C.squash = 0.6; C.squashV = 0; C.squashTarget = 1;
    C.hopY = 0; C.hopV = -1.5;
    entryTargetX = fromLeft ? CFG.perimeterMargin + 60 : W - CFG.perimeterMargin - 60;
    mode = MODE_ENTERING;
    nextPromptIn = 2.5 + Math.random() * 2;
  }

  function startLeaving() {
    if (mode !== MODE_ACTIVE && mode !== MODE_ENTERING) return;
    mode = MODE_LEAVING;
    hushBubble();
    C.hopV = -1.5;
    C.squashTarget = 0.85;
  }

  /* ---------- physics update (ported from `qt`) ---------- */
  function update(dt, now) {
    sessionSec = (now - startedAt) / 1000;
    window.__w19CompanionOut = (mode !== MODE_HIDDEN);   /* стрелка-гид не выходит, пока он на экране */

    if (mode === MODE_HIDDEN) {
      if (now - lastActivity > CFG.idleAfterMs && now - lastLeftAt > CFG.reenterCooldownMs && now - startedAt > CFG.firstAfterMs) enter();
      return;
    }

    // squash / hop springs, breathing
    C.squashV += (C.squashTarget - C.squash) * 0.18;
    C.squashV *= 0.72;
    C.squash += C.squashV;
    C.squashTarget += (1 - C.squashTarget) * 0.08;
    C.hopV += -C.hopY * 0.12;
    C.hopV *= 0.78;
    C.hopY += C.hopV;
    C.breathPhase += dt * 2;
    C.floatPhase += dt * 0.8;

    if (mode === MODE_ENTERING) {
      var edx = entryTargetX - C.x;
      C.vx += Math.sign(edx) * CFG.wanderSpeed * 5;
      C.vy += (clampY(yMax() - 36) - C.y) * 0.001;
      if (Math.abs(edx) < 30) {
        mode = MODE_ACTIVE;
        pickWanderTarget();
      }
    } else if (mode === MODE_ACTIVE) {
      wander.t += dt;
      var retargetAfter = 6 + Math.random() * 4;
      if (wander.t > retargetAfter || Math.abs(C.x - wander.x) < 20) pickWanderTarget();
      var wdx = wander.x - C.x, wdy = wander.y - C.y;
      var wd = Math.sqrt(wdx * wdx + wdy * wdy);
      if (wd > 1) {
        C.vx += wdx / wd * CFG.wanderSpeed;
        C.vy += wdy / wd * CFG.wanderSpeed;
      }
      // speech scheduling: count down only while no bubble is up
      var bubbleDone = bubble.duration === 0 || bubble.timer >= bubble.duration;
      if (bubbleDone) {
        nextPromptIn -= dt;
        if (nextPromptIn <= 0) {
          say(nextPrompt());
          nextPromptIn = CFG.promptEveryMin + Math.random() * (CFG.promptEveryMax - CFG.promptEveryMin);
        }
      }
    } else if (mode === MODE_LEAVING) {
      var exitX = C.x < W / 2 ? -80 : W + 80;
      var ldx = exitX - C.x;
      C.vx += Math.sign(ldx) * 0.14; // trot out in ~1s
      if (C.x < -60 || C.x > W + 60) {
        mode = MODE_HIDDEN; lastLeftAt = now;
        bubble.opacity = 0; bubble.timer = 0; bubble.duration = 0; bubble.slideY = 0;
        C.trail.length = 0;
        return;
      }
    }

    // friction / speed cap / gravity (leaving gets a faster cap for the trot)
    C.vx *= CFG.friction;
    C.vy *= CFG.friction;
    var cap = mode === MODE_LEAVING ? CFG.maxSpeed * 2.4 : CFG.maxSpeed;
    var sp = Math.sqrt(C.vx * C.vx + C.vy * C.vy);
    if (sp > cap) { C.vx = C.vx / sp * cap; C.vy = C.vy / sp * cap; }
    C.vy += CFG.gravity;
    C.x += C.vx;
    C.y += C.vy;
    if (Math.abs(C.vx) > 0.2) C.facing = C.vx > 0 ? 1 : -1;

    // bounds: horizontal only inside ACTIVE (must be free to cross edges when entering/leaving)
    if (mode === MODE_ACTIVE) {
      if (C.x < 30) { C.x = 30; C.vx *= -0.4; }
      if (C.x > W - 30) { C.x = W - 30; C.vx *= -0.4; }
    }
    // vertical: never over the header, never below bottom pad
    if (C.y < yMin()) { C.y = yMin(); C.vy *= -0.4; }
    if (C.y > yMax()) { C.y = yMax(); C.vy *= -0.4; C.hopV = -0.8; }

    C.legPhase += Math.sqrt(C.vx * C.vx + C.vy * C.vy) * 0.25;
    C.tilt += (C.vx * 0.03 - C.tilt) * 0.06;

    // blink
    C.blinkTimer += dt;
    if (!C.blinkState && C.blinkTimer > 3 + Math.random() * 4) { C.blinkState = true; C.blinkTimer = 0; }
    if (C.blinkState && C.blinkTimer > 0.12) C.blinkState = false;

    C.trail.push({ x: C.x, y: C.y });
    if (C.trail.length > 12) C.trail.shift();

    updateBubble(dt);
  }

  /* ---------- main loop ---------- */
  var rafId = null;
  var lastTime = performance.now();
  var running = false, companionPainted = false;

  function frame(now) {
    var dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    size();
    update(dt, now);
    if(companionPainted||mode!==MODE_HIDDEN)ctx.clearRect(0,0,W,H);
    companionPainted=mode!==MODE_HIDDEN;
    if (companionPainted) {
      drawTrail();
      drawCharacter(now);
      drawBubble(C.x, C.y + C.hopY);
    }
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    size();
    lastTime = performance.now();
    lastActivity = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    ctx.clearRect(0, 0, W, H);
    mode = MODE_HIDDEN;
  }

  /* ---------- activity listeners ---------- */
  function onActivity() {
    lastActivity = performance.now();
    if (mode === MODE_ACTIVE || mode === MODE_ENTERING) startLeaving();
  }
  function onPointerMove(e) {
    cursor.x = e.clientX;
    cursor.y = e.clientY;
    cursor.active = true;
    onActivity();
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('scroll', onActivity, { passive: true });
  window.addEventListener('wheel', onActivity, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (!running && reduced()) return;
    if (document.hidden) {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    } else if (running) {
      lastTime = performance.now();
      lastActivity = performance.now();
      if (rafId === null) rafId = requestAnimationFrame(frame);
    }
  });

  /* ---------- reduced motion gate ---------- */
  function reduced() { return !!(window.innerWidth < 760 || (mqReduce && mqReduce.matches) || (mqFinePointer && !mqFinePointer.matches)); }
  function applyMotionPref() {
    if (reduced()) stop();
    else start();
  }
  if (mqReduce) {
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', applyMotionPref);
    else if (mqReduce.addListener) mqReduce.addListener(applyMotionPref);
  }
  if (mqFinePointer) {
    if (mqFinePointer.addEventListener) mqFinePointer.addEventListener('change', applyMotionPref);
    else if (mqFinePointer.addListener) mqFinePointer.addListener(applyMotionPref);
  }
  window.addEventListener('resize', applyMotionPref, { passive: true });

  /* ---------- debug handle ---------- */
  window.__vxc = {
    get state() {
      return {
        mode: mode,
        running: running,
        x: Math.round(C.x), y: Math.round(C.y),
        speed: Math.round(Math.sqrt(C.vx * C.vx + C.vy * C.vy) * 100) / 100,
        facing: C.facing,
        idleForMs: Math.round(performance.now() - lastActivity),
        talking: bubble.opacity > 0.01,
        prompt: bubble.text,
        sessionSec: Math.round(sessionSec),
        voxels: VOXELS.length,
        reducedMotion: reduced()
      };
    },
    forceIdle: function () {
      lastActivity = performance.now() - CFG.idleAfterMs - 1; lastLeftAt = -1e9; startedAt = Math.min(startedAt, performance.now() - CFG.firstAfterMs - 1);
      if (running && mode === MODE_HIDDEN) enter();
    }
  };

  applyMotionPref();
})();
