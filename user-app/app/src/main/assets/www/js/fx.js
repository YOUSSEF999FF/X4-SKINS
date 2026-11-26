/* X4 SKINS 18 MAX — fx.js : lightning border, lightning touch effect, cinematic dialog in/out */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});

  /* midpoint-displacement bolt */
  function bolt(x0, y0, x1, y1, disp, depth) {
    var pts = [[x0, y0], [x1, y1]];
    for (var d = 0; d < depth; d++) {
      var np = [pts[0]];
      for (var i = 0; i < pts.length - 1; i++) {
        var a = pts[i], b = pts[i + 1];
        var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
        var off = (Math.random() - 0.5) * disp;
        np.push([mx + (-dy / len) * off, my + (dx / len) * off], b);
      }
      pts = np; disp *= 0.55;
    }
    return pts;
  }
  function strokePts(ctx, pts) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }

  /* rounded-rect perimeter sampled every few px */
  function perimeter(pad, W, H, radius) {
    var pts = [], r = Math.min(radius, W / 2, H / 2), step = 9;
    function line(x0, y0, x1, y1) { var n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step)); for (var i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); }
    function arc(cx, cy, a0, a1) { var n = Math.max(2, Math.round(r * Math.abs(a1 - a0) / step)); for (var i = 0; i < n; i++) { var a = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } }
    var x = pad, y = pad;
    line(x + r, y, x + W - r, y); arc(x + W - r, y + r, -Math.PI / 2, 0);
    line(x + W, y + r, x + W, y + H - r); arc(x + W - r, y + H - r, 0, Math.PI / 2);
    line(x + W - r, y + H, x + r, y + H); arc(x + r, y + H - r, Math.PI / 2, Math.PI);
    line(x, y + H - r, x, y + r); arc(x + r, y + r, Math.PI, Math.PI * 1.5);
    return pts;
  }

  /* ---------------------------------------------------------------- lightning border */
  function lightningBorder(host, o) {
    if (X4.perf.lite) return { stop: function () {}, resize: function () {} };      // LITE: no lightning
    o = o || {};
    var pad = o.pad || 16, radius = o.radius || 22, color = o.color || '80,190,255', amp = o.amp || 2.2, fps = X4.perf.low ? 8 : (o.fps || 14);
    var cv = document.createElement('canvas');
    cv.className = 'lb-canvas';
    cv.style.cssText = 'position:absolute;left:' + (-pad) + 'px;top:' + (-pad) + 'px;pointer-events:none;z-index:3;';
    host.appendChild(cv);
    var ctx = cv.getContext('2d'), dpr = X4.perf.dpr, w = 0, h = 0, base = [], alive = true;

    function size() {
      w = host.offsetWidth + pad * 2; h = host.offsetHeight + pad * 2;
      cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      base = perimeter(pad, w - pad * 2, h - pad * 2, radius);
    }
    size();

    function path(jit) {
      ctx.beginPath();
      for (var i = 0; i < base.length; i++) {
        var p = base[i], q = base[(i + 1) % base.length];
        var dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
        var j = (Math.random() - 0.5) * jit;
        var x = p[0] + (-dy / l) * j, y = p[1] + (dx / l) * j;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }

    function draw() {
      if (host.offsetWidth + pad * 2 !== w || host.offsetHeight + pad * 2 !== h) size();
      ctx.clearRect(0, 0, w, h);
      var t = performance.now() / 1000;
      var flick = 0.78 + 0.22 * Math.sin(t * 23) * Math.sin(t * 7.3);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = 'rgba(' + color + ',0.95)';
      ctx.shadowBlur = (X4.perf.low ? 6 : 14) * flick;
      ctx.strokeStyle = 'rgba(' + color + ',' + (0.55 * flick) + ')';
      ctx.lineWidth = 2.2; path(amp * 1.6); ctx.stroke();
      ctx.shadowBlur = X4.perf.low ? 3 : 6;
      ctx.strokeStyle = 'rgba(215,242,255,' + (0.9 * flick) + ')';
      ctx.lineWidth = 1; path(amp); ctx.stroke();
      if (Math.random() < 0.2) {                       // an arc leaps outward
        var i = Math.floor(Math.random() * base.length), p = base[i];
        var dx = p[0] - w / 2, dy = p[1] - h / 2, l = Math.hypot(dx, dy) || 1, len = 8 + Math.random() * pad * 1.1;
        ctx.shadowBlur = 10; ctx.strokeStyle = 'rgba(190,235,255,0.95)'; ctx.lineWidth = 1.3;
        strokePts(ctx, bolt(p[0], p[1], p[0] + dx / l * len, p[1] + dy / l * len, 6, 3));
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
    }
    var iv = setInterval(function () {
      if (!alive) return;
      if (!document.hidden && host.isConnected && host.getClientRects().length) draw();
    }, 1000 / fps);
    draw();
    return {
      stop: function () { alive = false; clearInterval(iv); if (cv.parentNode) cv.parentNode.removeChild(cv); },
      resize: size
    };
  }

  /* ---------------------------------------------------------------- lightning touch effect */
  function pressable(btn, o) {
    o = o || {};
    if (X4.perf.lite) {                                // LITE: just a haptic tick + a flat "pressed" colour, no tilt/ripple/bolts
      btn.addEventListener('pointerdown', function () {
        if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
        btn.classList.add('is-pressed'); X4.native.haptic();
      }, { passive: true });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { btn.addEventListener(n, function () { btn.classList.remove('is-pressed'); }, { passive: true }); });
      return;
    }
    var pad = 18, cv = null, ctx = null, raf = 0;
    var rip = document.createElement('span');
    rip.className = 'fx-ripples';
    btn.appendChild(rip);

    function ensureCanvas() {
      if (cv) return;
      cv = document.createElement('canvas');
      cv.className = 'fx-bolts';
      cv.style.cssText = 'position:absolute;left:' + (-pad) + 'px;top:' + (-pad) + 'px;pointer-events:none;z-index:4;';
      btn.appendChild(cv); ctx = cv.getContext('2d');
    }
    function burst(x, y) {
      ensureCanvas();
      var dpr = X4.perf.dpr, w = btn.offsetWidth + pad * 2, h = btn.offsetHeight + pad * 2;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      var per = perimeter(pad, w - pad * 2, h - pad * 2, o.radius || 20);
      var near = 0, best = 1e9, px = x + pad, py = y + pad;
      for (var i = 0; i < per.length; i++) { var d = Math.hypot(per[i][0] - px, per[i][1] - py); if (d < best) { best = d; near = i; } }
      var count = X4.perf.low ? 3 : 6, bolts = [];
      function make() {
        bolts = [];
        for (var k = 0; k < count; k++) {
          var idx = (near + Math.round((k - count / 2) * per.length / 18) + per.length * 4) % per.length, p = per[idx];
          var ang = Math.atan2(p[1] - h / 2, p[0] - w / 2) + (Math.random() - 0.5) * 0.9, len = 12 + Math.random() * 22;
          bolts.push(bolt(p[0], p[1], p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len, 9, 3));
        }
      }
      make();
      var t0 = performance.now(), last = t0;
      cancelAnimationFrame(raf);
      (function frame(now) {
        var u = (now - t0) / 280;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        if (u >= 1) return;
        if (now - last > 55) { make(); last = now; }
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(80,190,255,1)'; ctx.shadowBlur = X4.perf.low ? 4 : 12;
        for (var b = 0; b < bolts.length; b++) {
          ctx.strokeStyle = 'rgba(120,205,255,' + (0.9 * (1 - u)) + ')'; ctx.lineWidth = 2.4; strokePts(ctx, bolts[b]);
          ctx.strokeStyle = 'rgba(235,248,255,' + (1 - u) + ')'; ctx.lineWidth = 1; strokePts(ctx, bolts[b]);
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
        raf = requestAnimationFrame(frame);
      })(t0);
    }
    function ripple(x, y) {
      var r = document.createElement('i');
      r.style.left = x + 'px'; r.style.top = y + 'px';
      rip.appendChild(r);
      setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 700);
    }
    function down(e) {
      if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
      var r = btn.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      btn.style.setProperty('--tx', ((y / r.height - 0.5) * -16).toFixed(1) + 'deg');
      btn.style.setProperty('--ty', ((x / r.width - 0.5) * 16).toFixed(1) + 'deg');
      btn.classList.remove('is-spring'); btn.classList.add('is-pressed');
      btn.classList.remove('flash'); void btn.offsetWidth; btn.classList.add('flash');
      ripple(x, y); burst(x, y); X4.native.haptic();
    }
    function up() {
      if (!btn.classList.contains('is-pressed')) return;
      btn.classList.remove('is-pressed'); btn.classList.add('is-spring');
      setTimeout(function () { btn.classList.remove('is-spring'); }, 620);
    }
    btn.addEventListener('pointerdown', down, { passive: true });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { btn.addEventListener(n, up, { passive: true }); });
  }


  /* ---------------------------------------------------------------- lightning "disappear" effect
     Bolts crackle across the element while it flashes white-blue and vanishes. Resolves when it is gone. */
  function zap(el, o) {
    o = o || {};
    if (X4.perf.lite) {                                // LITE: it simply disappears
      if (o.hide) { try { o.hide(); } catch (e) { console.error(e); } }
      return Promise.resolve();
    }
    var r = el.getBoundingClientRect(), pad = 36, W = r.width + pad * 2, H = r.height + pad * 2;
    var cv = document.createElement('canvas'), dpr = X4.perf.low ? 1 : X4.perf.dpr;
    cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
    cv.style.cssText = 'position:fixed;left:' + (r.left - pad) + 'px;top:' + (r.top - pad) + 'px;width:' + W + 'px;height:' + H + 'px;pointer-events:none;z-index:' + (o.z || 900) + ';';
    document.body.appendChild(cv);
    var ctx = cv.getContext('2d'), dur = o.duration || 560, per = perimeter(pad, r.width, r.height, o.radius || 24);
    var count = X4.perf.low ? 4 : 8, bolts = [], t0 = performance.now(), last = -999, raf = 0, done;

    function make() {
      bolts = [];
      for (var k = 0; k < count; k++) {
        var a = per[Math.floor(Math.random() * per.length)];
        var b = Math.random() < 0.55 ? per[Math.floor(Math.random() * per.length)] : [W / 2 + (Math.random() - 0.5) * W * 0.5, H / 2 + (Math.random() - 0.5) * H * 0.5];
        bolts.push(bolt(a[0], a[1], b[0], b[1], 26, 4));
        if (Math.random() < 0.6) {                          // a short outward spark from the rim
          var q = per[Math.floor(Math.random() * per.length)], dx = q[0] - W / 2, dy = q[1] - H / 2, l = Math.hypot(dx, dy) || 1, len = 10 + Math.random() * pad;
          bolts.push(bolt(q[0], q[1], q[0] + dx / l * len, q[1] + dy / l * len, 8, 3));
        }
      }
    }
    var anim = el.animate([
      { opacity: 1, filter: 'brightness(1)', transform: 'scale(1)' },
      { opacity: 1, filter: 'brightness(2.8) saturate(1.4)', transform: 'scale(1.025)', offset: 0.34 },
      { opacity: 0, filter: 'brightness(3.4) blur(7px)', transform: 'scale(1.07)' }
    ], { duration: dur, easing: 'ease-in', fill: 'forwards' });

    done = new Promise(function (res) {
      (function frame(now) {
        var u = Math.min(1, (now - t0) / dur);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        if (now - last > 48) { make(); last = now; }
        var amp = Math.sin(Math.PI * Math.min(1, u * 1.15));
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(80,190,255,1)'; ctx.shadowBlur = X4.perf.low ? 5 : 14;
        for (var i = 0; i < bolts.length; i++) {
          ctx.strokeStyle = 'rgba(110,200,255,' + (0.85 * amp) + ')'; ctx.lineWidth = 2.6; strokePts(ctx, bolts[i]);
          ctx.strokeStyle = 'rgba(240,250,255,' + amp + ')'; ctx.lineWidth = 1.1; strokePts(ctx, bolts[i]);
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
        if (u < 1) raf = requestAnimationFrame(frame); else res();
      })(t0);
    });
    return done.then(function () {
      if (cv.parentNode) cv.parentNode.removeChild(cv);
      if (o.hide) { try { o.hide(); } catch (e) { console.error(e); } }   // hide for real, then drop the animation
      try { anim.cancel(); } catch (e) {}
    });
  }

  /* ---------------------------------------------------------------- cinematic dialog in / out */
  function hitRefresh() { if (X4.hit) X4.hit.refresh(); }

  function dialogIn(modal, panel) {
    modal.classList.add('open');
    modal.classList.add('in');
    hitRefresh();
    if (X4.perf.lite) return Promise.resolve();        // LITE: appears instantly
    var a = panel.animate([
      { transform: 'perspective(900px) translateZ(-420px) rotateX(22deg) scale(.55)', opacity: 0, filter: 'blur(16px) brightness(2.2)' },
      { transform: 'perspective(900px) translateZ(46px) rotateX(-3deg) scale(1.05)', opacity: 1, filter: 'blur(2px) brightness(1.45)', offset: 0.6 },
      { transform: 'perspective(900px) translateZ(-8px) rotateX(1deg) scale(.985)', opacity: 1, filter: 'blur(0) brightness(1.1)', offset: 0.8 },
      { transform: 'perspective(900px) translateZ(0) rotateX(0deg) scale(1)', opacity: 1, filter: 'blur(0) brightness(1)' }
    ], { duration: X4.perf.low ? 600 : 950, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    var sheen = panel.querySelector('.sheen');
    if (sheen) sheen.animate([{ transform: 'translateX(-260%) skewX(-18deg)' }, { transform: 'translateX(260%) skewX(-18deg)' }], { duration: 1300, delay: 300, easing: 'ease-in-out' });
    return a.finished.catch(function () {});
  }

  function dialogOut(modal, panel, o) {
    o = o || {};
    if (X4.perf.lite) {                                // LITE: disappears instantly
      modal.classList.remove('in'); modal.classList.remove('open'); hitRefresh();
      return Promise.resolve();
    }
    var a = panel.animate([
      { transform: 'perspective(900px) translateZ(0) scale(1)', opacity: 1, filter: 'blur(0) brightness(1)' },
      { transform: 'perspective(900px) translateZ(60px) scale(1.04)', opacity: 1, filter: 'blur(0) brightness(1.8)', offset: 0.3 },
      { transform: 'perspective(900px) translateZ(-300px) rotateX(-14deg) scale(.7)', opacity: 0, filter: 'blur(12px) brightness(2.4)' }
    ], { duration: o.fast ? 260 : 440, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' });
    modal.classList.remove('in');
    return a.finished.catch(function () {}).then(function () {
      modal.classList.remove('open');
      try { a.cancel(); } catch (e) {}
      hitRefresh();
    });
  }

  /* dialog leaves with the lightning effect (used by the download dialog) */
  function dialogZap(modal, panel) {
    modal.classList.remove('in');
    if (X4.perf.lite) { modal.classList.remove('open'); hitRefresh(); return Promise.resolve(); }
    return zap(panel, { radius: 26, hide: function () { modal.classList.remove('open'); } }).then(hitRefresh);
  }

  X4.fx = { dialogZap: dialogZap, bolt: bolt, strokePts: strokePts, perimeter: perimeter, lightningBorder: lightningBorder, pressable: pressable, zap: zap, dialogIn: dialogIn, dialogOut: dialogOut };
})();
