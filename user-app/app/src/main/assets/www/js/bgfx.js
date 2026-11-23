/* X4 SKINS 18 MAX — bgfx.js : futuristic background (particles with depth, light trails, perspective grid)
   Everything is a closed-form function of time t, so the same frame can be rendered at any moment. */
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

  /* o: { alpha, density, glow, grid, cx, cy } */
  function draw(ctx, W, H, t, o) {
    o = o || {};
    var alpha = o.alpha == null ? 1 : o.alpha;
    var density = (o.density == null ? 1 : o.density) * (X4.perf.low ? 0.5 : 1);
    var glow = o.glow == null ? 0.5 : o.glow;
    var cx = o.cx == null ? W / 2 : o.cx, cy = o.cy == null ? H * 0.45 : o.cy;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#02040b';
    ctx.fillRect(0, 0, W, H);
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;

    /* central energy glow + vignette */
    var R = Math.max(W, H) * 0.75;
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, 'rgba(20,110,255,' + (0.20 + 0.28 * glow) + ')');
    g.addColorStop(0.45, 'rgba(10,50,160,' + (0.10 + 0.10 * glow) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    /* perspective grid floor */
    if (o.grid !== false) {
      var hz = H * 0.66, lines = 11;
      ctx.lineWidth = 1;
      for (var i = 0; i < lines; i++) {
        var f = ((i + (t * 0.18) % 1) / lines);
        var y = hz + (H - hz) * f * f;
        ctx.strokeStyle = 'rgba(60,150,255,' + (0.05 + 0.16 * f) + ')';
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      for (var v = -8; v <= 8; v++) {
        ctx.strokeStyle = 'rgba(60,150,255,' + (0.05 + 0.04 * (1 - Math.abs(v) / 8)) + ')';
        ctx.beginPath(); ctx.moveTo(W / 2 + v * 6, hz); ctx.lineTo(W / 2 + v * (W / 7), H); ctx.stroke();
      }
    }

    /* light trails (circuit-like paths with travelling pulses) */
    var trails = makeTrails(W, H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (var a = 0; a < trails.length; a++) {
      var tr = trails[a];
      ctx.strokeStyle = 'rgba(40,120,255,0.07)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tr.pts[0][0], tr.pts[0][1]);
      for (var b = 1; b < tr.pts.length; b++) ctx.lineTo(tr.pts[b][0], tr.pts[b][1]);
      ctx.stroke();
      var s = ((t * tr.speed + tr.phase) % 1), head = s * (tr.L + 120), len = 110, steps = 8;
      var prev = pointAt(tr, head - len);
      for (var q = 1; q <= steps; q++) {
        var p = pointAt(tr, head - len + (len * q) / steps);
        if (head - len + (len * q) / steps < 0 || head - len + (len * (q - 1)) / steps > tr.L) { prev = p; continue; }
        ctx.strokeStyle = 'rgba(110,200,255,' + (0.7 * q / steps * (0.6 + 0.4 * glow)) + ')';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
        prev = p;
      }
    }

    /* depth particles (additive) */
    var sp = getSprite(), N = Math.round(90 * density);
    ctx.globalCompositeOperation = 'lighter';
    for (var n = 0; n < N; n++) {
      var z = 0.2 + 0.8 * X4.h01(n, 1);                 // depth 0.2 .. 1
      var x0 = X4.h01(n, 2) * W, y0 = X4.h01(n, 3) * H;
      var vy = -(6 + 34 * z), drift = Math.sin(t * (0.25 + z * 0.4) + n) * (8 + 14 * z);
      var yy = ((y0 + vy * t) % H + H) % H, xx = x0 + drift;
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
