/* X4 SKINS 18 MAX — app.js : orchestration
   boot → real internet check (continuous) + cinematic intro → page 2 once (intro finished AND online)
   → update dialog (if any) → shield + password dialog (unless remembered) → the 3 buttons. */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});
  var I = X4.i18n;

  var introDone = false, proceeded = false;
  var netVisible = false, netWant = false, netBusy = false, retrying = false, netLb = null, netModal, netPanel, netStatus, netRetry, statusTimer = 0;
  var homeBg;

  /* ---------------------------------------------------------------- home background: video if present, else animated neon */
  function makeHomeBg() {
    if (X4.perf.lite) return { setActive: function () {}, refresh: function () {} };   // LITE: plain static background (CSS), no video / canvas
    var P = X4.perf;
    var v = X4.$('#bg-video'), c = X4.$('#bg-canvas'), g = c.getContext('2d');
    var videoOK = false, active = false, raf = 0, last = 0, W = 0, H = 0, S = 1, drawn = false;

    function size() {
      S = P.bgScale;                                     // the background is soft: draw it smaller, the browser stretches it
      W = c.clientWidth; H = c.clientHeight;
      c.width = Math.max(1, Math.round(W * S)); c.height = Math.max(1, Math.round(H * S));
      g.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
      drawn = false;
    }
    function paint(now) {
      P.pulse(250);
      X4.bgfx.draw(g, W, H, now / 1000, { density: 0.9, glow: 0.55, cx: W / 2, cy: H * 0.42, scale: S });
      drawn = true;
    }
    /* how often the background is redrawn: full speed 30 fps; while a dialog sits on top of it (it is dimmed + blurred
       there anyway) 12 fps; on a struggling phone 20 fps / frozen behind dialogs / one still picture */
    function interval() {
      if (P.min) return 0;
      if (P.modals > 0) return P.low ? 0 : 80;
      return P.low ? 50 : 33;
    }
    function loop(now) {
      var iv = interval();
      if (iv === 0) {                                    // still picture: paint once, then stop the loop completely
        if (!drawn) paint(now);
        raf = 0; return;
      }
      raf = requestAnimationFrame(loop);
      if (now - last < iv - 2) return;
      last = now;
      paint(now);
    }
    function refresh() {
      cancelAnimationFrame(raf); raf = 0;
      if (!active || document.hidden) { try { v.pause(); } catch (e) {} return; }
      if (videoOK) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      else { if (c.width <= 1 || S !== P.bgScale) size(); raf = requestAnimationFrame(loop); }
    }
    v.addEventListener('canplay', function () { videoOK = true; v.classList.add('ready'); c.classList.add('hide'); refresh(); });
    v.addEventListener('error', function () { videoOK = false; v.classList.remove('ready'); c.classList.remove('hide'); refresh(); });
    window.addEventListener('resize', function () { if (active && !videoOK) { size(); refresh(); } });
    document.addEventListener('visibilitychange', refresh);
    P.on(function (what) { if (active && !videoOK) { if (what === 'tier') S = 0; refresh(); } });   // tier or dialog state changed → pick the new rate / size
    v.src = 'assets/bg.mp4';                              // a missing file simply triggers the animated fallback
    return { setActive: function (a) { active = a; refresh(); }, refresh: refresh };
  }

  /* ---------------------------------------------------------------- navigation helpers */
  function nav(name) {
    var p = X4.router.go(name);
    if (name === 'home') homeBg.setActive(true);
    p.then(function (ok) {
      if (!ok) return;
      if (X4.router.cur() !== 'home') homeBg.setActive(false);
      if (name === 'start') X4.start.enter();             // 18 MAX emblem → list of links
      else if (name === 'explain') X4.explain.enter();    // player + floating bar
      else if (name === 'info') X4.info.enter();          // social links
    });
    return p;
  }
  function back() {
    var here = X4.router.cur();
    if (here === 'start') X4.start.teardown();             // closes the sites; downloads keep running
    else if (here === 'explain') X4.explain.leave();       // stops the player
    else if (here === 'info') X4.info.leave();
    var p = X4.router.back();
    homeBg.setActive(true);                               // every phase-1 sub page returns to page 2
    return p;
  }

  /* ---------------------------------------------------------------- no-internet dialog (always wins) */
  function netOpen() {
    netModal.setAttribute('aria-hidden', 'false');
    netStatus.textContent = ''; netStatus.classList.remove('err');
    var p = X4.fx.dialogIn(netModal, netPanel);
    if (netLb) netLb.stop();
    netLb = X4.fx.lightningBorder(netPanel, { pad: 16, radius: 26 });
    return p;
  }
  function netClose() {
    netModal.setAttribute('aria-hidden', 'true');
    if (netLb) { netLb.stop(); netLb = null; }
    return X4.fx.dialogOut(netModal, netPanel, { fast: true });
  }
  function syncNet() {
    if (netBusy) return;
    netBusy = true;
    (function step() {
      if (netWant && !netVisible) { netVisible = true; return netOpen().then(step); }
      if (!netWant && netVisible) { return netClose().then(function () { netVisible = false; return step(); }); }
      netBusy = false;
    })();
  }

  function buildLangBar() {
    var bar = X4.$('#net-langs');
    I.langs.forEach(function (l) {
      var b = X4.el('button', 'lang-chip', '<span class="fl">' + l.flag + '</span><span class="nm">' + l.name + '</span>');
      b.type = 'button'; b.setAttribute('data-lang', l.code);
      b.addEventListener('click', function () { X4.native.haptic(); I.set(l.code, true); });
      bar.appendChild(b);
    });
    function mark() { X4.$$('.lang-chip', bar).forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-lang') === I.lang); }); }
    I.on('change', function () { mark(); netStatus.textContent = ''; });
    mark();
  }

  function onRetry() {
    if (retrying) return;
    retrying = true;
    netRetry.classList.add('loading');
    netStatus.classList.remove('err'); netStatus.textContent = I.t('net.checking');
    X4.net.checkNow().then(function (ok) {
      retrying = false; netRetry.classList.remove('loading');
      if (ok) { netStatus.textContent = ''; return; }
      netStatus.textContent = I.t('net.still'); netStatus.classList.add('err'); X4.native.haptic();
      clearTimeout(statusTimer);
      statusTimer = setTimeout(function () { netStatus.textContent = ''; netStatus.classList.remove('err'); }, 2400);
    });
  }

  /* ---------------------------------------------------------------- the single hand-over to page 2 */
  function maybeProceed() {
    if (proceeded || !introDone || !X4.net.isOnline()) return;
    proceeded = true;
    X4.$('#intro-skip').classList.remove('show');
    var p = X4.router.go('home', { kind: 'fade' });
    homeBg.setActive(true);
    p.then(function () {
      X4.intro.stop();
      X4.update.watch();
      return X4.update.run();
    }).then(function () {
      return X4.gate.run();
    }).catch(function (e) { console.error(e); });
  }

  /* what the rest of the app asks: "is the screen calm enough to show another dialog?" */
  X4.ui = {
    idle: function () {
      return introDone && proceeded && X4.net.isOnline() && !netVisible && !X4.emblem.isPlaying() && !X4.router.isBusy();
    },
    netVisible: function () { return netVisible; }
  };

  /* Android back button: JS answers true when it handled it, otherwise the app closes */
  window.__native_onBack = function () {
    if (netVisible) return false;
    if (X4.update.isShown()) return X4.update.handleBack();
    if (X4.leave.isOpen()) { X4.leave.cancel(); return true; }
    if (X4.dl.isOpen()) { X4.dl.hide(); return true; }
    if (X4.emblem.isPlaying() || X4.router.isBusy()) return true;
    var c = X4.router.cur();
    if (c === 'intro') { X4.intro.skip(); return true; }
    if (c === 'start') return X4.start.onBack();          // back inside the site → list → page 2
    if (c !== 'home') { back(); return true; }
    return false;
  };
  /* the Android keyboard height (CSS px): dialogs move up so the Confirm button is never hidden */
  window.__native_onKeyboard = function (px) { document.documentElement.style.setProperty('--kb', Math.max(0, px | 0) + 'px'); };
  var prevResume = window.__native_onResume;
  window.__native_onResume = function () { if (prevResume) prevResume(); if (homeBg) homeBg.refresh(); };
  window.__native_onPause = function () { if (homeBg) homeBg.refresh(); };

  /* ---------------------------------------------------------------- boot */
  function boot() {
    I.init();
    X4.router.init();
    homeBg = makeHomeBg();
    X4.router.on('start', function (e) { if (e.from === 'home' && e.to !== 'home') homeBg.setActive(false); });   // the page is leaving: freeze the background right away
    X4.hit.init();
    X4.dl.init();
    X4.start.home = back;

    netModal = X4.$('#netdlg'); netPanel = X4.$('.panel', netModal); netStatus = X4.$('#net-status'); netRetry = X4.$('#net-retry');
    buildLangBar();
    X4.fx.pressable(netRetry, { radius: 17 });
    netRetry.addEventListener('click', onRetry);

    X4.$('#intro-skip').addEventListener('click', function () { X4.intro.skip(); });
    X4.$$('[data-back]').forEach(function (b) { b.addEventListener('click', back); });

    var radii = { 'btn-start': 27, 'btn-explain': 22, 'btn-info': 23 };
    X4.$$('.btn-main').forEach(function (b) {
      X4.fx.pressable(b, { radius: radii[b.id] || 22 });
      b.addEventListener('click', function () { nav(b.getAttribute('data-go')); });
    });

    X4.net.on('change', function (ok) {
      netWant = (ok === false);
      syncNet();
      if (ok) maybeProceed();
    });
    X4.net.start();                                       // real checks start immediately and never stop
    X4.update.load();                                     // download update.json while the intro plays

    var seen = X4.store.get('x4_seen') === '1';
    X4.intro.start({
      startAt: seen ? 2.6 : 0,                            // repeat launches skip the first pop
      onDone: function () { introDone = true; X4.store.set('x4_seen', '1'); maybeProceed(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
