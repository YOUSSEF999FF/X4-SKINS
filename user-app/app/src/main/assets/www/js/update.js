/* X4 SKINS 18 MAX — update.js : the update dialog, controlled by data/update.json
   { latestVersion, force, title{lang}, description{lang}, button:{ label{lang}, url } }
   Shows over ANY page once the screen is calm (not during the intro, a transition or another effect). */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});
  var I = X4.i18n;

  var data = null, loadP = null, pending = false, force = false, dismissed = false, shown = false;
  var modal, panel, bGo, bLater, wired = false, lb = null, resolveRun = null, timer = 0;

  function parts(v) { return String(v).trim().split('.').map(function (n) { return parseInt(n, 10) || 0; }); }
  function cmp(a, b) {
    a = parts(a); b = parts(b);
    for (var i = 0; i < 4; i++) { var x = a[i] || 0, y = b[i] || 0; if (x !== y) return x > y ? 1 : -1; }
    return 0;
  }

  function load() {
    if (loadP) return loadP;
    loadP = X4.config.load('update').then(function (r) {
      data = r ? r.data : null;
      pending = !!data && cmp(data.latestVersion, X4.native.version()) > 0;
      force = pending && data.force === true;
      return pending;
    });
    return loadP;
  }

  /* LITE edition downloads the LITE apk: data.button.urlLite if the admin set one, otherwise the same link with
     the standard file name swapped for the LITE one. */
  function liteUrl(u, d) {
    if (!X4.perf.lite) return u;
    var own = d && d.button && typeof d.button.urlLite === 'string' ? d.button.urlLite.trim() : '';
    if (own) return own;
    return u.replace(/X4-SKINS-18-MAX(-v[\w.]+)?\.apk/i, function (m, v) { return 'X4-SKINS-18-MAX-LITE' + (v || '') + '.apk'; });
  }

  function wire() {
    if (wired) return;
    wired = true;
    modal = X4.$('#update'); panel = X4.$('.panel', modal); bGo = X4.$('#up-go'); bLater = X4.$('#up-later');
    X4.$('#up-emblem').innerHTML = X4.emblem.mini('update', 58);
    X4.fx.pressable(bGo, { radius: 17 }); X4.fx.pressable(bLater, { radius: 17 });
    bGo.addEventListener('click', function () {
      var u = data && ((data.button && data.button.url) || data.url);
      if (u) X4.native.openExternal(liteUrl(String(u).trim(), data)); else X4.toast(I.t('gate.noLink'));
    });
    bLater.addEventListener('click', function () { dismiss(); });
    I.on('change', function () { if (shown) render(); });
  }

  function render() {
    if (!data) return;
    X4.$('#up-title').textContent = I.pick(data.title, 'update.title');
    X4.$('#up-msg').textContent = I.pick(data.description, 'update.msg');
    X4.$('#up-ver').textContent = X4.native.version() + '  →  ' + String(data.latestVersion).trim();
    X4.$('#up-go-lbl').textContent = I.pick(data.button && data.button.label, 'update.btn');
    bLater.style.display = force ? 'none' : '';
  }

  function idle() { return !!(X4.ui && X4.ui.idle()); }
  function canShow() { return pending && !dismissed && !shown && idle(); }

  function open() {
    wire(); render();
    modal.setAttribute('aria-hidden', 'false');
    var p = X4.fx.dialogIn(modal, panel);
    if (lb) lb.stop();
    lb = X4.fx.lightningBorder(panel, { pad: 16, radius: 26 });
    return p;
  }

  function show() {
    shown = true;
    return X4.emblem.play('update', { onPeak: open });
  }

  function dismiss() {
    if (force || !shown) return;
    shown = false; dismissed = true;                 // optional update: closable, comes back on the next launch
    modal.setAttribute('aria-hidden', 'true');
    if (lb) { lb.stop(); lb = null; }
    X4.fx.dialogOut(modal, panel).then(function () { if (resolveRun) { var r = resolveRun; resolveRun = null; r(); } });
  }

  /* called once when page 2 is reached: resolves when there is nothing (left) to show */
  function run() {
    return Promise.race([load(), X4.sleep(3500)]).then(function () {
      if (!pending || dismissed) return;
      return new Promise(function (res) {
        resolveRun = res;                              // dismiss() resolves it (never, for a forced update)
        (function poll() {
          if (shown) return;                           // already on screen (shown by the watcher)
          if (dismissed) { resolveRun = null; res(); return; }
          if (canShow()) { show(); return; }
          setTimeout(poll, 250);
        })();
      });
    });
  }

  /* safety net: if the file arrives late, it still shows on whatever page the user is on */
  function watch() {
    clearInterval(timer);
    timer = setInterval(function () { if (canShow()) show(); }, 1000);
  }

  function handleBack() {
    if (!shown) return false;
    if (force) return false;
    dismiss();
    return true;
  }

  X4.update = { load: load, run: run, watch: watch, handleBack: handleBack, isShown: function () { return shown; }, cmp: cmp, liteUrl: liteUrl };
})();
