/* X4 SKINS 18 MAX — util.js : helpers, easing, emitter, native bridge wrapper */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});

  X4.$ = function (s, r) { return (r || document).querySelector(s); };
  X4.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  X4.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  X4.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  X4.lerp = function (a, b, t) { return a + (b - a) * t; };
  X4.smooth = function (t) { t = X4.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  X4.ease = {
    outCubic: function (t) { t = X4.clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); },
    inCubic: function (t) { t = X4.clamp(t, 0, 1); return t * t * t; },
    outQuad: function (t) { t = X4.clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); },
    inOutCubic: function (t) { t = X4.clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    outBack: function (t) { t = X4.clamp(t, 0, 1); var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: function (t) {
      t = X4.clamp(t, 0, 1);
      if (t === 0 || t === 1) return t;
      var c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
  };

  /* deterministic pseudo random in [0,1) — lets the intro be rendered at any time t */
  X4.h01 = function (i, salt) {
    var x = Math.sin(i * 127.1 + (salt || 0) * 311.7 + 17.13) * 43758.5453;
    return x - Math.floor(x);
  };
  X4.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  X4.perf = { low: false, dpr: Math.min(window.devicePixelRatio || 1, 2) };

  /* tiny event emitter */
  X4.Emitter = function () { this._h = {}; };
  X4.Emitter.prototype.on = function (n, f) { (this._h[n] = this._h[n] || []).push(f); return this; };
  X4.Emitter.prototype.off = function (n, f) { var a = this._h[n]; if (a) { var i = a.indexOf(f); if (i > -1) a.splice(i, 1); } return this; };
  X4.Emitter.prototype.emit = function (n, v) { (this._h[n] || []).slice().forEach(function (f) { try { f(v); } catch (e) { console.error(e); } }); };

  X4.el = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  /* ------------------------------------------------------------------ native bridge */
  X4.native = (function () {
    var B = window.AndroidBridge || null;
    var pending = {}, seq = 0;

    window.__native_onProbe = function (id, status, body) {
      var p = pending[id];
      if (!p) return;
      delete pending[id];
      clearTimeout(p.t);
      p.res({ status: status, body: body || '' });
    };

    function probe(url, timeout) {
      timeout = timeout || 2500;
      return new Promise(function (res) {
        if (typeof window.__X4_PROBE_OVERRIDE === 'function') {           // tests only
          Promise.resolve(window.__X4_PROBE_OVERRIDE(url)).then(res);
          return;
        }
        if (B && B.probe) {
          var id = 'p' + (++seq);
          pending[id] = {
            res: res,
            t: setTimeout(function () { if (pending[id]) { delete pending[id]; res({ status: -1, body: '' }); } }, timeout + 1500)
          };
          try { B.probe(id, url, timeout); } catch (e) { delete pending[id]; res({ status: -1, body: '' }); }
          return;
        }
        /* plain browser fallback (development) */
        var ctl = ('AbortController' in window) ? new AbortController() : null;
        var to = setTimeout(function () { if (ctl) ctl.abort(); }, timeout);
        var isG = /generate_204/.test(url);
        fetch(url, { mode: isG ? 'no-cors' : 'cors', cache: 'no-store', signal: ctl ? ctl.signal : undefined })
          .then(function (r) {
            clearTimeout(to);
            if (isG) return res({ status: 204, body: '' });
            return r.text().then(function (t) { res({ status: r.status, body: t.slice(0, 64) }); });
          })
          .catch(function () { clearTimeout(to); res({ status: -1, body: '' }); });
      });
    }

    /* events coming from the Android shell (sites, downloads, "leaving the app" requests) */
    var ev = new X4.Emitter();
    function parse(j) { try { return typeof j === 'string' ? JSON.parse(j) : j; } catch (e) { return null; } }
    window.__native_onSite = function (j) { var o = parse(j); if (o) ev.emit('site', o); };
    window.__native_onDl = function (j) { var o = parse(j); if (o) ev.emit('dl', o); };
    window.__native_onLeave = function (url) { ev.emit('leave', url); };
    window.__native_onYt = function (what) { ev.emit('yt', String(what)); };

    return {
      has: !!B,
      hasSites: !!(B && B.openSite),
      ev: ev,
      site: {
        open: function (slot, url, allowed) {
          try { B.openSite(slot | 0, String(url), JSON.stringify(allowed || [])); return true; } catch (e) { return false; }
        },
        close: function () { try { if (B && B.closeSite) B.closeSite(); } catch (e) {} },
        cancel: function () { try { if (B && B.cancelOpen) B.cancelOpen(); } catch (e) {} },
        back: function () { try { return !!(B && B.siteBack && B.siteBack()); } catch (e) { return false; } }
      },
      /* which parts of the screen belong to our UI while a site is open (everything else touches the site) */
      setHit: function (all, rects) { try { if (B && B.setHit) B.setHit(!!all, JSON.stringify(rects || [])); } catch (e) {} },
      leaveTo: function (url) { try { if (B && B.leaveTo) B.leaveTo(String(url)); else window.open(url, '_blank'); } catch (e) {} },
      leaveCancel: function () { try { if (B && B.leaveCancel) B.leaveCancel(); } catch (e) {} },
      cancelDownload: function (id) { try { if (B && B.cancelDownload) B.cancelDownload(id | 0); } catch (e) {} },
      openFile: function (ref, mime) { try { return !!(B && B.openFile && B.openFile(String(ref || ''), String(mime || ''))); } catch (e) { return false; } },
      /* the YouTube player of the Explanations page is a native view that sits over the page (see explain.js) */
      yt: {
        has: !!(B && B.ytLoad),
        load: function (kind, id, autoplay) { try { if (B && B.ytLoad) B.ytLoad(String(kind), String(id), !!autoplay); } catch (e) {} },
        layout: function (show, l, t, w, h) { try { if (B && B.ytLayout) B.ytLayout(!!show, Math.round(l), Math.round(t), Math.round(w), Math.round(h)); } catch (e) {} },
        stop: function () { try { if (B && B.ytStop) B.ytStop(); } catch (e) {} }
      },
      probe: probe,
      openExternal: function (url) {
        if (!url) return false;
        if (B && B.openExternal) { try { B.openExternal(String(url)); return true; } catch (e) { return false; } }
        try { window.open(url, '_blank'); } catch (e) {}
        return true;
      },
      version: function () {
        try { if (B && B.getVersion) return String(B.getVersion()); } catch (e) {}
        return (window.APP_CONFIG && window.APP_CONFIG.appVersionFallback) || '0.0.0';
      },
      haptic: function () {
        try { if (B && B.haptic) B.haptic(1); else if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
      },
      exit: function () { try { if (B && B.exitApp) B.exitApp(); } catch (e) {} }
    };
  })();

  /* safe localStorage */
  X4.store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* small toast */
  X4.toast = function (msg) {
    var t = X4.$('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(X4.toast._t);
    X4.toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  };
})();
