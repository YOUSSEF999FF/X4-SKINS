/* X4 SKINS 18 MAX — net.js : REAL, continuous internet check
   - Google generate_204 must answer exactly 204 (a Wi‑Fi login page answers 200/302, so it fails).
   - If Google fails, our own GitHub ping.txt must answer "ok" before we call it offline.
   - Offline is declared after two failed checks in a row; the first success brings the app back. */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});

  var G = 'https://www.google.com/generate_204';
  var em = new X4.Emitter();
  var state = null;            // null (unknown) | true | false
  var fails = 0, timer = 0, running = false, inflight = null;

  function pingUrl() {
    var b = X4.config.base();
    return b ? b + 'ping.txt?_=' + Date.now() : '';
  }

  function probeOnce() {
    return X4.native.probe(G, 2500).then(function (r) {
      if (r.status === 204) return true;
      var p = pingUrl();
      if (!p) return false;
      return X4.native.probe(p, 2500).then(function (r2) {
        return r2.status === 200 && /ok/i.test(r2.body || '');
      });
    });
  }

  function set(v) {
    if (state === v) return;
    state = v;
    em.emit('change', v);
  }

  function schedule(ms) {
    clearTimeout(timer);
    if (!running || document.hidden) return;
    timer = setTimeout(tick, ms);
  }

  function tick() {
    if (inflight) return inflight;
    inflight = probeOnce().catch(function () { return false; }).then(function (ok) {
      inflight = null;
      if (ok) { fails = 0; set(true); }
      else { fails++; if (fails >= 2) set(false); }
      schedule(ok ? 5000 : (fails >= 2 ? 2500 : 1500));
      return ok;
    });
    return inflight;
  }

  X4.net = {
    on: function (n, f) { em.on(n, f); return X4.net; },
    isOnline: function () { return state === true; },
    state: function () { return state; },
    start: function () { if (running) return; running = true; tick(); },
    /* used by the Retry button: probe right now and answer true/false */
    checkNow: function () { clearTimeout(timer); fails = Math.max(fails, 1); return tick(); }
  };

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) clearTimeout(timer); else if (running) tick();
  });
  window.__native_onNet = function () { if (running) { clearTimeout(timer); tick(); } };
  window.__native_onResume = function () { if (running) { clearTimeout(timer); tick(); } };
})();
