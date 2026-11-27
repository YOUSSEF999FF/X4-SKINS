/* X4 SKINS 18 MAX — intro.js : page 1, the cinematic opening.
   Timeline (seconds):
     0.0  background fades in (particles, light trails, grid)
     0.7  "X4 SKINS" glass 3D pops up with an elastic bounce
     1.7  neon glow + energy gathers around the logo
     3.0  charge peak (logo trembles)
     3.35 light explosion, shock rings, particles, logo dissolves
     3.55 metal panel appears, 4.1 "X4 SKINS 18 MAX" is engraved by a laser with blue sparks
     6.5  done (the scene keeps idling until the internet check lets the app move on)
   render(t) is a pure function of time so any frame can be drawn (used for testing and for the short repeat-launch version). */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});

  var T = { pop: 0.7, glow: 1.7, charge: 3.0, boom: 3.35, panel: 3.55, engrave: 4.1, engraveDur: 1.9, end: 6.5 };
  var clamp = X4.clamp, ease = X4.ease, h01 = X4.h01;

  var root, bgC, fxC, bg, fx, logoPos, logo, flash, fade, skipBtn;
  var W = 0, H = 0, cx = 0, cy = 0, dpr = 1, bgS = 0.75, frameNo = 0, lastR = 0;
  var panelC, engC, glowC, cols = [], px = 0, py = 0, pw = 0, ph = 0, ready = false;
  var raf = 0, t0 = null, startAt = 0, skipOffset = 0, done = false, onDone = null, frames = [], sprite = null;

  function getSprite() {
    if (sprite) return sprite;
    sprite = document.createElement('canvas'); sprite.width = sprite.height = 48;
    var g = sprite.getContext('2d'), r = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(140,215,255,0.9)'); r.addColorStop(1, 'rgba(0,90,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 48, 48);
    return sprite;
  }

  function drawSpaced(g, text, x, y, font, sp) {
    g.font = font;
    var cxp = x;
    for (var i = 0; i < text.length; i++) { var ch = text.charAt(i); g.fillText(ch, cxp, y); cxp += g.measureText(ch).width + sp; }
  }
  function measureSpaced(g, text, font, sp) {
    g.font = font;
    var w = 0;
    for (var i = 0; i < text.length; i++) w += g.measureText(text.charAt(i)).width + sp;
    return w - sp;
  }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr); var g = c.getContext('2d'); g.scale(dpr, dpr); return { c: c, g: g }; }

  /* ---------------------------------------------------------------- one-time assets for the engraving */
  function build() {
    var m = mk(10, 10).g, k = 1, s1, s2, sp1, sp2, gap, w1, w2, h1, h2, pad, F = '"Archivo Black", Impact, "Arial Black", sans-serif';
    for (var tries = 0; tries < 8; tries++) {
      s1 = Math.min(W * 0.105, 44) * k; s2 = Math.min(W * 0.25, 100) * k; sp1 = s1 * 0.12; sp2 = s2 * 0.07; gap = s1 * 0.55;
      w1 = measureSpaced(m, 'X4 SKINS', '400 ' + s1 + 'px ' + F, sp1);
      w2 = measureSpaced(m, '18 MAX', '400 ' + s2 + 'px ' + F, sp2);
      pad = Math.max(20, s1 * 0.7);
      var total = Math.max(w1, w2) + pad * 2, room = W - 40;
      if (total <= room) break;
      k *= Math.max(0.5, room / total * 0.98);
    }
    h1 = s1 * 0.72; h2 = s2 * 0.72;
    pw = Math.max(w1, w2) + pad * 2; ph = h1 + gap + h2 + pad * 2;
    px = (W - pw) / 2; py = cy - ph / 2;
    var f1 = '400 ' + s1 + 'px ' + F, f2 = '400 ' + s2 + 'px ' + F;

    function lines(g, fill) {
      g.fillStyle = fill; g.textBaseline = 'alphabetic';
      drawSpaced(g, 'X4 SKINS', (pw - w1) / 2, pad + h1, f1, sp1);
      drawSpaced(g, '18 MAX', (pw - w2) / 2, pad + h1 + gap + h2, f2, sp2);
    }

    /* mask of the letters */
    var M = mk(pw, ph); lines(M.g, '#fff');

    /* engraved look: dark metal fill + inner shadow (top-left) + inner highlight (bottom-right) */
    var E = mk(pw, ph), g = E.g;
    g.drawImage(M.c, 0, 0, pw, ph);
    g.globalCompositeOperation = 'source-in';
    var gr = g.createLinearGradient(0, py - py, 0, ph); gr.addColorStop(0, '#0b1a36'); gr.addColorStop(1, '#1d3d70');
    g.fillStyle = gr; g.fillRect(0, 0, pw, ph);
    g.globalCompositeOperation = 'source-atop';
    var S = mk(pw, ph); S.g.fillStyle = 'rgba(0,0,0,0.95)'; S.g.fillRect(0, 0, pw, ph);
    S.g.globalCompositeOperation = 'destination-out'; S.g.drawImage(M.c, 2.4, 2.4, pw, ph);
    g.drawImage(S.c, 0, 0, pw, ph);
    var Hh = mk(pw, ph); Hh.g.fillStyle = 'rgba(120,210,255,0.95)'; Hh.g.fillRect(0, 0, pw, ph);
    Hh.g.globalCompositeOperation = 'destination-out'; Hh.g.drawImage(M.c, -1.7, -1.7, pw, ph);
    g.drawImage(Hh.c, 0, 0, pw, ph);
    g.globalCompositeOperation = 'source-over';
    engC = E.c;

    /* neon rim glow (outside the letters only) */
    var G = mk(pw, ph), gg = G.g;
    gg.shadowColor = 'rgba(40,150,255,1)'; gg.shadowBlur = 16;
    gg.drawImage(M.c, 0, 0, pw, ph); gg.drawImage(M.c, 0, 0, pw, ph);
    gg.shadowBlur = 0; gg.globalCompositeOperation = 'destination-out'; gg.drawImage(M.c, 0, 0, pw, ph);
    glowC = G.c;

    /* sample letter pixels, grouped by 3px columns, so sparks fly from real letter edges */
    cols = [];
    try {
      var id = M.c.getContext('2d').getImageData(0, 0, M.c.width, M.c.height), step = 3, nx = Math.ceil(pw / step);
      for (var i = 0; i < nx; i++) cols.push([]);
      for (var yy = 0; yy < ph; yy += 2) {
        for (var xx = 0; xx < pw; xx += step) {
          var a = id.data[((Math.floor(yy * dpr)) * M.c.width + Math.floor(xx * dpr)) * 4 + 3];
          if (a > 128) cols[Math.floor(xx / step)].push(yy);
        }
      }
    } catch (e) { cols = []; }

    /* the digital metal plate */
    var P = mk(pw, ph), p = P.g, r = 18;
    p.beginPath(); p.moveTo(r, 0); p.arcTo(pw, 0, pw, ph, r); p.arcTo(pw, ph, 0, ph, r); p.arcTo(0, ph, 0, 0, r); p.arcTo(0, 0, pw, 0, r); p.closePath();
    var pg = p.createLinearGradient(0, 0, 0, ph); pg.addColorStop(0, '#0d1526'); pg.addColorStop(0.5, '#070c18'); pg.addColorStop(1, '#0a1222');
    p.fillStyle = pg; p.fill();
    p.save(); p.clip();
    var rr = X4.rng(77);
    for (var b = 0; b < 160; b++) {                                    // brushed metal streaks
      p.fillStyle = 'rgba(120,170,255,' + (0.015 + rr() * 0.035) + ')';
      p.fillRect(rr() * pw, rr() * ph, 20 + rr() * 90, 1);
    }
    p.strokeStyle = 'rgba(60,140,255,0.14)'; p.lineWidth = 1;          // circuit traces
    for (var c = 0; c < 7; c++) {
      var x = rr() * pw, y = rr() * ph; p.beginPath(); p.moveTo(x, y);
      for (var s = 0; s < 3; s++) { if (s % 2) y += (rr() - 0.5) * 50; else x += (rr() - 0.5) * 90; p.lineTo(x, y); }
      p.stroke(); p.fillStyle = 'rgba(90,180,255,0.35)'; p.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    var vg = p.createRadialGradient(pw / 2, ph / 2, ph * 0.2, pw / 2, ph / 2, pw * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    p.fillStyle = vg; p.fillRect(0, 0, pw, ph);
    p.restore();
    p.lineWidth = 1.6; var eg = p.createLinearGradient(0, 0, pw, ph); eg.addColorStop(0, 'rgba(150,215,255,0.9)'); eg.addColorStop(0.5, 'rgba(40,120,255,0.55)'); eg.addColorStop(1, 'rgba(130,200,255,0.85)');
    p.strokeStyle = eg; p.beginPath(); p.moveTo(r, 0.8); p.arcTo(pw - 0.8, 0.8, pw - 0.8, ph - 0.8, r); p.arcTo(pw - 0.8, ph - 0.8, 0.8, ph - 0.8, r); p.arcTo(0.8, ph - 0.8, 0.8, 0.8, r); p.arcTo(0.8, 0.8, pw - 0.8, 0.8, r); p.closePath(); p.stroke();
    p.strokeStyle = 'rgba(190,235,255,0.9)'; p.lineWidth = 2;                              // corner brackets
    [[10, 10, 1, 1], [pw - 10, 10, -1, 1], [10, ph - 10, 1, -1], [pw - 10, ph - 10, -1, -1]].forEach(function (q) {
      p.beginPath(); p.moveTo(q[0], q[1] + q[3] * 14); p.lineTo(q[0], q[1]); p.lineTo(q[0] + q[2] * 14, q[1]); p.stroke();
    });
    panelC = P.c;
    ready = true;
  }

  function layout() {
    W = root.clientWidth; H = root.clientHeight; dpr = X4.perf.dpr;
    cx = W / 2; cy = H * 0.45;
    fxC.width = Math.round(W * dpr); fxC.height = Math.round(H * dpr); fxC.style.width = W + 'px'; fxC.style.height = H + 'px';
    bgS = X4.perf.bgScale;                              // the soft background canvas is smaller than the screen and stretched
    bgC.width = Math.round(W * bgS); bgC.height = Math.round(H * bgS); bgC.style.width = W + 'px'; bgC.style.height = H + 'px';
    bg = bgC.getContext('2d'); fx = fxC.getContext('2d');
    logoPos.style.top = cy + 'px';
    build();
  }

  /* ---------------------------------------------------------------- per-phase drawing */
  function reveal(t) {
    var u = (t - T.engrave) / T.engraveDur;
    if (u <= 0) return 0; if (u >= 1) return 1;
    return 0.15 * X4.smooth(u) + 0.85 * u;
  }

  function logoState(t) {
    var s = 1, o = 0, blur = 0, rx = 0, jx = 0, jy = 0, glow = 0.25, shine = -80;
    if (t < T.pop) { o = 0; }
    else if (t < T.glow) {
      var u = (t - T.pop) / 1.0;
      s = 0.2 + 0.8 * ease.outElastic(u); o = clamp(u * 4, 0, 1); blur = (1 - clamp(u * 2.2, 0, 1)) * 14;
      rx = (1 - ease.outCubic(u)) * -55; glow = 0.25 + 0.2 * u;
    } else if (t < T.charge) {
      var u2 = (t - T.glow) / 1.3;
      s = 1 + 0.03 * X4.smooth(u2) + 0.012 * Math.sin((t - T.glow) * 7); o = 1;
      glow = 0.45 + 0.7 * X4.smooth(u2); rx = Math.sin((t - T.glow) * 1.6) * 4;
      shine = -80 + (((t - T.glow) / 0.8) % 1) * 240;
    } else if (t < T.boom) {
      var u3 = (t - T.charge) / (T.boom - T.charge), fr = Math.floor(t * 60);
      s = 1.03 + 0.09 * u3 * u3; o = 1; glow = 1.15 + 0.6 * u3;
      jx = (h01(fr, 5) - 0.5) * 5 * u3; jy = (h01(fr, 6) - 0.5) * 5 * u3; shine = 60;
    } else if (t < T.boom + 0.6) {
      var u4 = (t - T.boom) / 0.6;
      s = 1.12 + 1.0 * u4 * u4; o = 1 - Math.pow(u4, 1.4); blur = u4 * 26; glow = 1.8 - u4;
    } else { o = 0; }
    logo.style.visibility = o <= 0.002 ? 'hidden' : 'visible';
    logo.style.opacity = o.toFixed(3);
    logo.style.transform = 'translate3d(' + jx.toFixed(2) + 'px,' + jy.toFixed(2) + 'px,0) perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) scale(' + s.toFixed(4) + ')';
    logo.style.filter = (blur > 0.3 && !X4.perf.low) ? 'blur(' + blur.toFixed(1) + 'px)' : 'none';
    logo.style.setProperty('--glow', glow.toFixed(3));
    logo.style.setProperty('--shine', shine.toFixed(1));
    return glow;
  }

  function energy(t) {
    if (t < 1.6 || t > 3.6) return;
    var N = X4.perf.low ? 70 : 150, sp = getSprite(), R = Math.max(W, H) * 0.55;
    fx.globalCompositeOperation = 'lighter'; fx.lineCap = 'round';
    for (var i = 0; i < N; i++) {
      var ts = T.glow + h01(i, 1) * 1.2, life = 0.9 + h01(i, 2) * 0.6, u = (t - ts) / life;
      if (u < 0 || u > 1) continue;
      var a0 = h01(i, 3) * 6.283, r0 = (0.25 + h01(i, 4) * 0.75) * R;
      function pos(uu) { var r = r0 * Math.pow(1 - uu, 1.6), a = a0 + uu * 3.2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8]; }
      var p = pos(u), al = Math.sin(u * Math.PI);
      if (u > 0.05) { var q = pos(u - 0.05); fx.strokeStyle = 'rgba(110,200,255,' + (0.7 * al) + ')'; fx.lineWidth = 1.3; fx.beginPath(); fx.moveTo(q[0], q[1]); fx.lineTo(p[0], p[1]); fx.stroke(); }
      fx.globalAlpha = 0.9 * al; fx.drawImage(sp, p[0] - 5, p[1] - 5, 10, 10); fx.globalAlpha = 1;
    }
    fx.globalCompositeOperation = 'source-over';
  }

  function explosion(t) {
    var dt = t - T.boom;
    if (dt < 0 || dt > 2.3) return;
    fx.globalCompositeOperation = 'lighter';
    [[950, 1.0, 3], [640, 0.85, 2.2], [380, 0.7, 1.6]].forEach(function (r) {
      var al = clamp(1 - dt / r[1], 0, 1);
      if (al <= 0) return;
      fx.strokeStyle = 'rgba(120,205,255,' + (0.8 * al) + ')'; fx.lineWidth = r[2] * (1 + 4 * al);
      fx.beginPath(); fx.arc(cx, cy, dt * r[0] * (1 - 0.1 * dt), 0, 6.283); fx.stroke();
    });
    var bloom = clamp(1 - dt / 0.8, 0, 1);
    if (bloom > 0) {
      var rad = 150 * (1 + dt * 3.2), g = fx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, 'rgba(255,255,255,' + (0.95 * bloom) + ')'); g.addColorStop(0.3, 'rgba(130,210,255,' + (0.7 * bloom) + ')'); g.addColorStop(1, 'rgba(0,80,255,0)');
      fx.fillStyle = g; fx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    var N = X4.perf.low ? 90 : 210, k = 2.4;
    fx.lineCap = 'round';
    for (var i = 0; i < N; i++) {
      var life = 0.9 + h01(i, 13) * 1.0, u = dt / life;
      if (u >= 1) continue;
      var ang = h01(i, 11) * 6.283, v = 60 + h01(i, 12) * 760, dist = v * (1 - Math.exp(-k * dt)) / k, spd = v * Math.exp(-k * dt);
      var x = cx + Math.cos(ang) * dist, y = cy + Math.sin(ang) * dist + 60 * dt * dt, len = Math.max(2, spd * 0.035);
      fx.strokeStyle = 'rgba(' + (h01(i, 14) > 0.7 ? '230,248,255' : '90,185,255') + ',' + (1 - u) + ')'; fx.lineWidth = 1.2 + h01(i, 15) * 1.6;
      fx.beginPath(); fx.moveTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len); fx.lineTo(x, y); fx.stroke();
    }
    fx.globalCompositeOperation = 'source-over';
  }

  function engraving(t) {
    if (t < T.panel || !ready) return;
    var pa = X4.smooth((t - T.panel) / 0.55);
    fx.globalAlpha = pa; fx.drawImage(panelC, px, py, pw, ph); fx.globalAlpha = 1;
    var p = reveal(t);
    if (p > 0) {
      fx.save(); fx.beginPath(); fx.rect(px, py, pw * p, ph); fx.clip();
      fx.drawImage(engC, px, py, pw, ph);
      fx.globalCompositeOperation = 'lighter'; fx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 4);
      fx.drawImage(glowC, px, py, pw, ph);
      fx.restore();
    }
    var active = t >= T.engrave && t <= T.engrave + T.engraveDur + 0.12;
    if (active && p < 1) {
      var lx = px + pw * p, fl = 0.8 + 0.2 * Math.sin(t * 60);
      fx.globalCompositeOperation = 'lighter';
      var lg = fx.createLinearGradient(lx - 14, 0, lx + 14, 0);
      lg.addColorStop(0, 'rgba(60,160,255,0)'); lg.addColorStop(0.5, 'rgba(210,244,255,' + fl + ')'); lg.addColorStop(1, 'rgba(60,160,255,0)');
      fx.fillStyle = lg; fx.fillRect(lx - 14, py + 4, 28, ph - 8);
      var by = py + ph * (0.5 + 0.45 * Math.sin(t * 13));
      var bgl = fx.createRadialGradient(lx, by, 0, lx, by, 34); bgl.addColorStop(0, 'rgba(255,255,255,0.95)'); bgl.addColorStop(0.3, 'rgba(120,205,255,0.6)'); bgl.addColorStop(1, 'rgba(0,100,255,0)');
      fx.fillStyle = bgl; fx.fillRect(lx - 34, by - 34, 68, 68);
      var bucket = Math.floor(t * 28);                                     // light scratches at the cutting front
      fx.lineCap = 'round'; fx.strokeStyle = 'rgba(190,232,255,0.8)'; fx.lineWidth = 1;
      for (var s = 0; s < 4; s++) {
        var sy = py + 8 + h01(bucket * 7 + s, 31) * (ph - 16), a = (h01(bucket * 5 + s, 32) - 0.5) * 1.2, l = 10 + h01(bucket + s, 33) * 26;
        fx.beginPath(); fx.moveTo(lx - Math.cos(a) * l, sy - Math.sin(a) * l); fx.lineTo(lx + Math.cos(a) * l * 0.4, sy + Math.sin(a) * l * 0.4); fx.stroke();
      }
      /* blue sparks, spawned from real letter pixels near the front */
      var SP = X4.perf.low ? 26 : 56;
      for (var j = 0; j < SP; j++) {
        var Lc = 0.28 + 0.3 * h01(j, 21), off = h01(j, 22) * Lc, cyc = Math.floor((t + off) / Lc), age = (t + off) - cyc * Lc, ts = t - age;
        if (ts < T.engrave || ts > T.engrave + T.engraveDur) continue;
        var pp = reveal(ts); if (pp <= 0 || pp >= 1) continue;
        var life = 0.35 + 0.3 * h01(j, 27); if (age > life) continue;
        var col = cols.length ? cols[Math.min(cols.length - 1, Math.max(0, Math.floor((pw * pp) / 3)))] : null;
        var sy2 = py + ((col && col.length) ? col[Math.floor(h01(j + cyc * 53, 24) * col.length)] : ph / 2);
        var sx = px + pw * pp - h01(j + cyc * 97, 23) * 12;
        var ang = -Math.PI * (0.1 + 0.8 * h01(j + cyc * 31, 25)), v = 90 + h01(j + cyc * 17, 26) * 280;
        function sp(a2) { return [sx + Math.cos(ang) * v * a2, sy2 + Math.sin(ang) * v * a2 + 420 * a2 * a2]; }
        var q1 = sp(age), q0 = sp(Math.max(0, age - 0.035)), al = 1 - age / life;
        fx.strokeStyle = 'rgba(' + (j % 3 === 0 ? '235,250,255' : '90,190,255') + ',' + al + ')'; fx.lineWidth = 1.3;
        fx.beginPath(); fx.moveTo(q0[0], q0[1]); fx.lineTo(q1[0], q1[1]); fx.stroke();
      }
      fx.globalCompositeOperation = 'source-over';
    }
    if (p >= 1) {                                                           // idle: light runs along the engraved edges
      var sw = px + pw * (((t * 0.32) % 1.5) - 0.25);
      fx.save(); fx.beginPath(); fx.rect(sw - 28, py, 56, ph); fx.clip();
      fx.globalCompositeOperation = 'lighter'; fx.globalAlpha = 0.95; fx.drawImage(glowC, px, py, pw, ph); fx.restore();
    }
  }

  function flashAlpha(t) {
    var dt = t - T.boom;
    if (dt < -0.12) return 0;
    if (dt < 0) return 0.25 * (1 + dt / 0.12);
    return 0.95 * Math.pow(Math.max(0, 1 - dt / 0.5), 1.5);
  }

  function render(t, withBg) {
    if (!W) return;
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = logoState(t);
    var glowBg = t < T.glow ? 0.3 : clamp(g * 0.7, 0, 1.2);
    if (withBg !== false) {
      bg.setTransform(bgC.width / W, 0, 0, bgC.height / H, 0, 0);
      X4.bgfx.draw(bg, W, H, t, { alpha: ease.outCubic(t / 0.9), glow: glowBg, cx: cx, cy: cy, scale: bgS });
    }
    fx.clearRect(0, 0, W, H);
    energy(t); explosion(t); engraving(t);
    flash.style.opacity = flashAlpha(t).toFixed(3);
  }

  function tNow(now) { return startAt + (now - t0) / 1000 + skipOffset; }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (t0 == null) t0 = now;
    X4.perf.pulse(250);
    var t = tNow(now);
    frameNo++;
    /* the cinematic is drawn at full rate on a healthy phone — except the background (soft, 30 fps is plenty);
       lighter tiers draw everything at ~30 fps */
    if (X4.perf.low) { if (now - lastR >= 30) { lastR = now; render(t, true); } }
    else render(t, (frameNo & 1) === 0 || frameNo < 3);
    if (!done && t >= T.end) { done = true; if (onDone) onDone(); }
  }

  function start(o) {
    o = o || {};
    if (X4.perf.lite) {                                    // LITE: no cinematic — a still logo, then straight on
      done = false; onDone = o.onDone || null;
      setTimeout(function () { if (!done) { done = true; if (onDone) onDone(); } }, 700);
      return Promise.resolve();
    }
    root = X4.$('#screen-intro');
    bgC = X4.$('#intro-bg'); fxC = X4.$('#intro-fx'); logoPos = X4.$('#intro-logo-pos'); logo = X4.$('#intro-logo');
    flash = X4.$('#intro-flash'); fade = X4.$('#intro-fade'); skipBtn = X4.$('#intro-skip');
    startAt = o.startAt || 0; onDone = o.onDone || null; done = false; t0 = null; skipOffset = 0; frames = []; frameNo = 0; lastR = 0;
    var fonts = (document.fonts && document.fonts.load) ? Promise.race([document.fonts.load('400 40px "Archivo Black"'), X4.sleep(1500)]) : Promise.resolve();
    return fonts.then(function () {
      layout();
      var rs = 0;
      window.addEventListener('resize', function () { clearTimeout(rs); rs = setTimeout(layout, 120); });
      if (o.paused) return;                                                   // tests render single frames
      if (startAt > 0 && fade) fade.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' });
      setTimeout(function () { if (skipBtn) skipBtn.classList.add('show'); }, 1200);
      raf = requestAnimationFrame(frame);
    });
  }

  function skip() {
    if (done) return;
    if (X4.perf.lite) { done = true; if (onDone) onDone(); return; }
    var cur = (t0 == null) ? startAt : tNow(performance.now());
    skipOffset += Math.max(0, T.end + 0.05 - cur);
    if (flash) flash.animate([{ opacity: 0.45 }, { opacity: 0 }], { duration: 350 });
    if (skipBtn) skipBtn.classList.remove('show');
  }

  function seek(t) { cancelAnimationFrame(raf); render(t); }
  function stop() { cancelAnimationFrame(raf); }

  X4.intro = { start: start, skip: skip, seek: seek, stop: stop, T: T };
})();
