/* X4 SKINS 18 MAX — bgfx.js : futuristic background (particles with depth, light trails, perspective grid)
   Everything is a closed-form function of time t, so the same frame can be rendered at any moment.
   Speed notes: the big soft glow is rendered once into a tiny canvas and stretched (a full-screen gradient fill per
   frame was the most expensive thing in the app); particle parameters are computed once; the caller draws into a
   canvas that is smaller than the screen (o.scale) because everything here is soft anyway. */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});

  var sprite = null;
  function getSprite() {
    if (sprite) return sprite;
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    var r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(220,245,255,1)');
    r.addColorStop(0.18, 'rgba(120,200,255,0.85)');
    r.addColorStop(0.5, 'rgba(30,120,255,0.25)');
    r.addColorStop(1, 'rgba(0,60,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    sprite = c;
    return c;
  }

  /* ---- the central glow + vignette: a 128px-wide canvas that is stretched over the whole screen */
  var glowC = null, glowKey = '';
  function glowLayer(W, H, cx, cy, glow) {
    var k = 128 / Math.max(W, H), w = Math.max(8, Math.round(W * k)), h = Math.max(8, Math.round(H * k));
    var gq = Math.round(glow * 50) / 50;
    var key = w + 'x' + h + '|' + gq + '|' + Math.round(cx / W * 200) + '|' + Math.round(cy / H * 200);
    if (key === glowKey && glowC) return glowC;
    if (!glowC) glowC = document.createElement('canvas');
    glowC.width = w; glowC.height = h;
    var g = glowC.getContext('2d');
    var R = Math.max(W, H) * 0.75 * k, x = cx * k, y = cy * k;
    var gr = g.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, 'rgba(20,110,255,' + (0.20 + 0.28 * gq) + ')');
    gr.addColorStop(0.45, 'rgba(10,50,160,' + (0.10 + 0.10 * gq) + ')');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.clearRect(0, 0, w, h);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    glowKey = key;
    return glowC;
  }

  var trailCache = { key: '', list: [] };
  function makeTrails(W, H) {
    var key = W + 'x' + H;
    if (trailCache.key === key) return trailCache.list;
    var rnd = X4.rng(20260622), list = [];
    for (var n = 0; n < 9; n++) {
      var x = rnd() * W, y = rnd() * H, horiz = rnd() < 0.5, pts = [[x, y]];
      for (var i = 0; i < 6; i++) {
        var len = (50 + rnd() * 170) * (rnd() < 0.5 ? -1 : 1);
        if (horiz) x = X4.clamp(x + len, -20, W + 20); else y = X4.clamp(y + len, -20, H + 20);
        pts.push([x, y]);
        horiz = !horiz;
      }
      var cum = [0], L = 0;
      for (var k = 1; k < pts.length; k++) { L += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); cum.push(L); }
      list.push({ pts: pts, cum: cum, L: L, speed: 0.06 + rnd() * 0.09, phase: rnd() });
    }
    trailCache = { key: key, list: list };
    return list;
  }

  function pointAt(tr, d) {
    d = X4.clamp(d, 0, tr.L);
    for (var i = 1; i < tr.cum.length; i++) {
      if (d <= tr.cum[i]) {
        var u = (d - tr.cum[i - 1]) / ((tr.cum[i] - tr.cum[i - 1]) || 1);
        return [tr.pts[i - 1][0] + (tr.pts[i][0] - tr.pts[i - 1][0]) * u, tr.pts[i - 1][1] + (tr.pts[i][1] - tr.pts[i - 1][1]) * u];
      }
    }
    return tr.pts[tr.pts.length - 1];
  }

  /* particle parameters never change: compute them once per count */
  var pc = { n: 0, z: null, x: null, y: null };
  function particles(N) {
    if (pc.n >= N) return pc;
    var z = new Float32Array(N), x = new Float32Array(N), y = new Float32Array(N);
    for (var i = 0; i < N; i++) { z[i] = 0.2 + 0.8 * X4.h01(i, 1); x[i] = X4.h01(i, 2); y[i] = X4.h01(i, 3); }
    pc = { n: N, z: z, x: x, y: y };
    return pc;
  }

  /* o: { alpha, density, glow, grid, cx, cy, scale }   scale = canvas pixels per CSS pixel (default 1) */
  function draw(ctx, W, H, t, o) {
    o = o || {};
    var alpha = o.alpha == null ? 1 : o.alpha;
    var low = X4.perf.low;
    var density = (o.density == null ? 1 : o.density) * (low ? 0.5 : 1);
    var glow = o.glow == null ? 0.5 : o.glow;
    var cx = o.cx == null ? W / 2 : o.cx, cy = o.cy == null ? H * 0.45 : o.cy;
    var hair = Math.max(1, 1 / (o.scale || 1));           // keep 1-device-pixel lines visible on a smaller canvas

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#02040b';
    ctx.fillRect(0, 0, W, H);
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;

    /* central energy glow + vignette */
    ctx.drawImage(glowLayer(W, H, cx, cy, glow), 0, 0, W, H);

    /* perspective grid floor */
    if (o.grid !== false) {
      var hz = H * 0.66, lines = low ? 8 : 11;
      ctx.lineWidth = hair;
      for (var i = 0; i < lines; i++) {
        var f = ((i + (t * 0.18) % 1) / lines);
        var y = hz + (H - hz) * f * f;
        ctx.strokeStyle = 'rgba(60,150,255,' + (0.05 + 0.16 * f) + ')';
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      var vstep = low ? 2 : 1;
      for (var v = -8; v <= 8; v += vstep) {
        ctx.strokeStyle = 'rgba(60,150,255,' + (0.05 + 0.04 * (1 - Math.abs(v) / 8)) + ')';
        ctx.beginPath(); ctx.moveTo(W / 2 + v * 6, hz); ctx.lineTo(W / 2 + v * (W / 7), H); ctx.stroke();
      }
    }

    /* light trails (circuit-like paths with travelling pulses) */
    var trails = makeTrails(W, H), nTr = low ? 5 : trails.length, steps = low ? 4 : 8;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (var a = 0; a < nTr; a++) {
      var tr = trails[a];
      ctx.strokeStyle = 'rgba(40,120,255,0.07)'; ctx.lineWidth = hair;
      ctx.beginPath(); ctx.moveTo(tr.pts[0][0], tr.pts[0][1]);
      for (var b = 1; b < tr.pts.length; b++) ctx.lineTo(tr.pts[b][0], tr.pts[b][1]);
      ctx.stroke();
      var s = ((t * tr.speed + tr.phase) % 1), head = s * (tr.L + 120), len = 110;
      var prev = pointAt(tr, head - len);
      for (var q = 1; q <= steps; q++) {
        var d1 = head - len + (len * q) / steps, d0 = head - len + (len * (q - 1)) / steps;
        var p = pointAt(tr, d1);
        if (d1 < 0 || d0 > tr.L) { prev = p; continue; }
        ctx.strokeStyle = 'rgba(110,200,255,' + (0.7 * q / steps * (0.6 + 0.4 * glow)) + ')';
        ctx.lineWidth = Math.max(1.4, hair);
        ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
        prev = p;
      }
    }

    /* depth particles (additive) */
    var sp = getSprite(), N = Math.round(90 * density), P = particles(N);
    ctx.globalCompositeOperation = 'lighter';
    for (var n = 0; n < N; n++) {
      var z = P.z[n];                                   // depth 0.2 .. 1
      var vy = -(6 + 34 * z), drift = Math.sin(t * (0.25 + z * 0.4) + n) * (8 + 14 * z);
      var yy = ((P.y[n] * H + vy * t) % H + H) % H, xx = P.x[n] * W + drift;
      var size = (4 + 18 * z * z) * (0.6 + 0.8 * glow);
      var tw = 0.45 + 0.55 * Math.sin(t * (1 + z * 2) + n * 3.1);
      ctx.globalAlpha = alpha * X4.clamp(0.12 + 0.55 * z * tw, 0, 1);
      ctx.drawImage(sp, xx - size / 2, yy - size / 2, size, size);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  X4.bgfx = { draw: draw };
})();
