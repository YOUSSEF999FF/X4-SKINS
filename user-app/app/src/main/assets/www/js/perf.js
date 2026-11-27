/* X4 SKINS 18 MAX — perf.js : adaptive quality.
   The app measures how smoothly it really runs on THIS phone and lowers the heavy effects only when it has to.
     tier 2  full look (default on normal phones)
     tier 1  lighter: no blur in animations, no glass blur on buttons/cards, 20 fps background, fewer particles
     tier 0  lightest: still background, still borders, plain fades — the neon look stays, the cost goes
   A phone that had to step down remembers it, so the next launch starts smooth right away.
   (LITE edition ignores all this: it has no effects at all.) */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});
  var P = X4.perf, root = document.documentElement;
  if (P.lite) { P.tier = 0; P.min = true; P.bgScale = 1; P.pulse = P.modal = function () {}; P.on = function () {}; return; }

  var KEY = 'x4_perf_tier_v2';
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode etc. */ } }

  var listeners = [];
  P.on = function (f) { listeners.push(f); };
  function emit(what) { listeners.slice().forEach(function (f) { try { f(what); } catch (e) { console.error(e); } }); }

  /* ---------------------------------------------------------------- tiers */
  var devDpr = window.devicePixelRatio || 1;
  function apply(t) {
    P.tier = t; P.low = t <= 1; P.min = t === 0;
    P.dpr = Math.min(devDpr, t === 2 ? 1.5 : 1);            // sharp canvases (borders, bolts, intro text)
    P.bgScale = t === 2 ? 0.75 : 0.5;                       // soft canvases (animated background) are drawn smaller and stretched
    root.classList.remove('q0', 'q1', 'q2'); root.classList.add('q' + t);
  }
  var start = lsGet(KEY);
  if (start !== '0' && start !== '1' && start !== '2') {
    var mem = navigator.deviceMemory || 4;
    start = mem <= 2 ? '1' : '2';                           // very small RAM → begin lighter
  }
  apply(+start);

  /* ---------------------------------------------------------------- frame-rate watchdog
     Runs only while something is animating (pulse). Looks at how long real frames take. */
  var until = 0, running = false, last = 0, win = [], born = 0, lastChange = 0, strikes = 0, strikeAt = 0;
  var THR = { 2: 25, 1: 31 };                               // median ms/frame that is "too slow" at each tier (≈ 40 fps / 32 fps)

  function down(why) {
    if (P.tier === 0) return;
    var t = P.tier - 1;
    apply(t); lsSet(KEY, String(t));
    lastChange = performance.now(); win = []; strikes = 0;
    P.lastChange = { to: t, why: why };
    emit('tier');
  }
  function tick(now) {
    if (now > until) { running = false; last = 0; return; }
    requestAnimationFrame(tick);
    if (!born) born = now;
    if (last && !document.hidden) {
      var dt = now - last;
      if (dt < 250 && now - born > 900 && now - lastChange > 2200) {           // skip start-up jank + settle time after a change
        win.push(dt); if (win.length > 40) win.shift();
        if (win.length === 40 && P.tier > 0 && P.watch !== false && !window.__X4_NO_WATCH) {
          /* the MEDIAN frame time: one-off hitches (a decode, a GC pause, a screenshot) must not demote a healthy phone */
          var med = win.slice().sort(function (a, b) { return a - b; })[20];
          if (med > THR[P.tier]) {
            /* two slow windows in a row (≈ 2+ s of real slowness) before stepping down: one heavy transition
               (a dialog opening) on an otherwise healthy phone must not lower its quality for good */
            if (now - strikeAt > 5000) strikes = 0;
            strikes++; strikeAt = now; win = [];
            if (strikes >= 2) down(Math.round(med) + 'ms');
          } else { strikes = 0; win.splice(0, 10); }
        }
      }
    }
    last = now;
  }
  P.watch = true;
  /* anything that animates calls this: "the next ms milliseconds are worth watching" */
  P.pulse = function (ms) {
    var n = performance.now() + (ms || 300);
    if (n > until) until = n;
    if (!running) { running = true; last = 0; requestAnimationFrame(tick); }
  };
  P.setTier = function (t) { apply(t); emit('tier'); };      // for tests / future settings

  /* ---------------------------------------------------------------- dialogs open? (the page behind them can rest) */
  P.modals = 0;
  P.modal = function (d) {
    P.modals = Math.max(0, P.modals + d);
    root.classList.toggle('modal-open', P.modals > 0);
    emit('modal');
  };

  /* ---------------------------------------------------------------- cheaper Web-Animations keyframes
     Blur / brightness on a big moving layer is what makes dialogs and page changes stutter on weak GPUs.
     tier 2 keeps them (that is the designed look), tier 1 drops blur(), tier 0 drops filter entirely. */
  var _animate = Element.prototype.animate;
  function cleanFilter(v) {
    if (typeof v !== 'string') return v;
    if (P.tier === 0) return 'none';
    return v.replace(/blur\([^)]*\)\s*/g, '').trim() || 'none';
  }
  function cleanKF(kf) {
    if (P.tier === 2 || !kf) return kf;
    if (Array.isArray(kf)) {
      return kf.map(function (f) {
        if (!f || typeof f !== 'object' || !('filter' in f)) return f;
        var c = {}, k; for (k in f) c[k] = f[k];
        c.filter = cleanFilter(f.filter); return c;
      });
    }
    if (typeof kf === 'object' && 'filter' in kf) {
      var o = {}, k2; for (k2 in kf) o[k2] = kf[k2];
      o.filter = Array.isArray(kf.filter) ? kf.filter.map(cleanFilter) : cleanFilter(kf.filter); return o;
    }
    return kf;
  }
  Element.prototype.animate = function (kf, opt) {
    if (P.tier === 0 && opt && typeof opt === 'object' && opt.duration > 420) {   // tier 0: nothing runs long
      opt = Object.assign({}, opt, { duration: Math.max(260, opt.duration * 0.55), delay: (opt.delay || 0) * 0.5 });
    }
    return _animate.call(this, cleanKF(kf), opt);
  };
})();
