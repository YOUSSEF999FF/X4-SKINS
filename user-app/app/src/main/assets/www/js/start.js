/* X4 SKINS 18 MAX — start.js : page 3 (START)
   "18 MAX" emblem effect → glass dialog listing the links from data/start.json → tapping a link opens it in
   webview1 or webview2 (the JSON decides which) → the dialog leaves once the site is really showing.
   A small floating 18 MAX button brings the list back; Android back goes back inside the site, then to page 2. */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});
  var I = X4.i18n;

  var items = [], state = 'loading';                     // loading | ok | empty
  var modal, panel, listEl, titleEl, subEl, closeBtn, fab, lb = null;
  var wired = false, sitesUsed = false, listOpen = false, siteOpen = false, opening = null, curId = '', fabSuppress = false, fabPos = null;

  /* ---------------------------------------------------------------- data */
  function toSlot(v) {
    v = String(v == null ? '1' : v).toLowerCase();
    return (v === '2' || v === 'webview2' || v === 'web2') ? 2 : 1;
  }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }

  function normalize(arr) {
    var out = [];
    (arr || []).forEach(function (o, i) {
      if (!o || typeof o.url !== 'string' || o.enabled === false) return;
      var url = o.url.trim();
      if (!/^https?:\/\/[^\s]+$/i.test(url)) return;                 // only real web links ever open inside the app
      var allowed = Array.isArray(o.allowed) ? o.allowed.filter(function (s) { return typeof s === 'string' && s.trim(); }).map(function (s) { return s.trim(); }) : [];
      out.push({ id: String(o.id || ('i' + i)), title: o.title, subtitle: o.subtitle, url: url, slot: toSlot(o.view != null ? o.view : o.webview), allowed: allowed });
    });
    return out;
  }

  /* ---------------------------------------------------------------- list rendering */
  var ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.2 2.5 5 13.2h5.6l-1.1 8.3L19 9.9h-5.7z"/></svg>';
  var CHEV = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

  function renderTexts() {
    if (!wired) return;
    titleEl.textContent = I.t('start.title');
    subEl.textContent = I.t('start.sub');
    X4.$('.lbl', closeBtn).textContent = I.t('close');
  }

  function render() {
    if (!wired) return;
    listEl.innerHTML = '';
    if (state === 'loading') { listEl.innerHTML = '<div class="lk-note"><i class="lk-spin"></i></div>'; return; }
    if (!items.length) { listEl.innerHTML = '<div class="lk-note">' + I.t('start.empty') + '</div>'; return; }
    items.forEach(function (it) {
      var b = X4.el('button', 'link-btn');
      b.type = 'button';
      b.setAttribute('data-id', it.id);
      var name = I.pick(it.title) || hostOf(it.url);
      var sub = I.pick(it.subtitle) || hostOf(it.url);
      b.innerHTML = '<span class="lk-ico">' + ICON + '</span><span class="lk-txt"><span class="lk-name"></span><span class="lk-sub" dir="ltr"></span></span>' + CHEV;
      X4.$('.lk-name', b).textContent = name;
      X4.$('.lk-sub', b).textContent = sub;
      X4.fx.pressable(b, { radius: 18 });
      b.addEventListener('click', function () { choose(it, b); });
      listEl.appendChild(b);
    });
  }

  /* ---------------------------------------------------------------- the list dialog */
  function openList() {
    wire();
    if (listOpen) return Promise.resolve();
    listOpen = true;
    setFab(false);
    renderTexts();
    render();
    modal.setAttribute('aria-hidden', 'false');
    var p = X4.fx.dialogIn(modal, panel);
    if (lb) lb.stop();
    lb = X4.fx.lightningBorder(panel, { pad: 16, radius: 26 });
    return p;
  }

  function closeList() {
    if (!listOpen) return Promise.resolve();
    listOpen = false;
    modal.setAttribute('aria-hidden', 'true');
    if (lb) { lb.stop(); lb = null; }
    return X4.fx.dialogOut(modal, panel).then(function () { if (siteOpen && !listOpen) setFab(true); });
  }

  /* ---------------------------------------------------------------- opening a site */
  function choose(it, btn) {
    if (opening) return;
    if (!X4.native.hasSites) {                           // plain browser (development): nothing to embed into
      X4.native.openExternal(it.url);
      return;
    }
    if (siteOpen && curId === it.id) { closeList(); return; }
    opening = { it: it, btn: btn };
    sitesUsed = true;
    listEl.classList.add('busy');
    btn.classList.add('loading');
    X4.native.site.open(it.slot, it.url, it.allowed);
  }

  function endOpening() {
    if (!opening) return;
    opening.btn.classList.remove('loading');
    listEl.classList.remove('busy');
    opening = null;
  }

  function onShown() {
    if (!opening) return;
    curId = opening.it.id;
    endOpening();
    siteOpen = true;
    X4.hit.setSite(true);                                // our layer becomes transparent: the site shows through
    closeList();
  }

  function onSiteFail() {
    if (opening) { endOpening(); X4.toast(I.t('start.fail')); X4.native.haptic(); }
  }

  function onSiteEvent(e) {
    if (!e) return;
    if (e.t === 'shown') onShown();
    else if (e.t === 'error') onSiteFail();
    else if (e.t === 'gone') {                           // the site's renderer crashed: back to the list
      siteOpen = false; curId = ''; X4.hit.setSite(false); setFab(false);
      if (X4.router.cur() === 'start') openList();
    }
  }

  /* ---------------------------------------------------------------- floating 18 MAX button */
  function setFab(on) {
    if (!fab) return;
    var was = fab.classList.contains('show');
    fab.classList.toggle('show', !!on);
    if (on && !was) {
      place();
      fab.animate([
        { opacity: 0, transform: 'scale(.2) rotate(-90deg)', filter: 'brightness(2.4) blur(6px)' },
        { opacity: 1, transform: 'scale(1.14) rotate(8deg)', filter: 'brightness(1.5)', offset: 0.65 },
        { opacity: 1, transform: 'scale(1) rotate(0)', filter: 'brightness(1)' }
      ], { duration: 650, easing: 'cubic-bezier(.2,.9,.25,1)' });
    }
    X4.hit.refresh();
  }

  function loadPos() {
    try { var p = JSON.parse(X4.store.get('x4_fab') || 'null'); if (p && typeof p.y === 'number') return p; } catch (e) {}
    return { side: 1, y: 0.6 };
  }
  function place() {
    if (!fab) return;
    fabPos = fabPos || loadPos();
    var W = window.innerWidth, H = window.innerHeight, s = 48, m = 8;
    var top = X4.clamp(fabPos.y * H - s / 2, m + 24, H - s - m - 24);
    fab.style.top = top + 'px';
    fab.style.left = (fabPos.side ? W - s - m : m) + 'px';
  }

  function dragify(el) {
    var id = null, sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
    el.addEventListener('pointerdown', function (e) {
      id = e.pointerId; sx = e.clientX; sy = e.clientY; moved = false;
      var r = el.getBoundingClientRect(); ox = r.left; oy = r.top;
    });
    el.addEventListener('pointermove', function (e) {
      if (e.pointerId !== id) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 12) return;
      if (!moved) { moved = true; try { el.setPointerCapture(id); } catch (x) {} }
      var W = window.innerWidth, H = window.innerHeight;
      el.style.left = X4.clamp(ox + dx, 4, W - 52) + 'px';
      el.style.top = X4.clamp(oy + dy, 28, H - 76) + 'px';
    });
    function end(e) {
      if (e.pointerId !== id) return;
      id = null;
      if (!moved) return;
      fabSuppress = true; setTimeout(function () { fabSuppress = false; }, 260);
      var r = el.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
      fabPos = { side: (r.left + r.width / 2) > W / 2 ? 1 : 0, y: (r.top + r.height / 2) / H };
      X4.store.set('x4_fab', JSON.stringify(fabPos));
      el.style.transition = 'left .28s cubic-bezier(.2,.9,.25,1)';
      place();
      setTimeout(function () { el.style.transition = ''; X4.hit.refresh(); }, 320);
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  /* ---------------------------------------------------------------- wiring */
  function wire() {
    if (wired) return;
    wired = true;
    modal = X4.$('#start-dlg'); panel = X4.$('.panel', modal); listEl = X4.$('#start-list');
    titleEl = X4.$('#start-title'); subEl = X4.$('#start-sub'); closeBtn = X4.$('#start-close'); fab = X4.$('#fab-max');
    X4.$('#start-emblem').innerHTML = X4.emblem.mini('max18', 64);
    fab.innerHTML = X4.emblem.mini('max18', 30);
    X4.fx.pressable(closeBtn, { radius: 17 });
    X4.fx.pressable(fab, { radius: 24 });
    closeBtn.addEventListener('click', function () { onBack(); });
    fab.addEventListener('click', function () { if (!fabSuppress) openList(); });
    dragify(fab);
    window.addEventListener('resize', place);
    I.on('change', function () { renderTexts(); render(); });
    X4.native.ev.on('site', onSiteEvent);
  }

  /* ---------------------------------------------------------------- public */
  function enter() {
    wire();
    siteOpen = false; curId = ''; state = 'loading'; items = [];
    X4.config.load('start').then(function (r) {
      items = r ? normalize(r.data.items) : [];
      state = items.length ? 'ok' : 'empty';
      render();
    });
    return X4.emblem.play('max18', { onPeak: openList });
  }

  /* leaving page 3: the sites are closed (downloads keep running by themselves) */
  function teardown() {
    if (sitesUsed) { sitesUsed = false; X4.native.site.close(); }
    endOpening();
    siteOpen = false; curId = '';
    X4.hit.setSite(false);
    setFab(false);
    if (listOpen) {
      listOpen = false;
      modal.setAttribute('aria-hidden', 'true');
      if (lb) { lb.stop(); lb = null; }
      modal.classList.remove('open', 'in');
    }
  }

  function goHome() { teardown(); if (X4.start.home) X4.start.home(); }

  /* Android back. true = handled here. */
  function onBack() {
    if (X4.leave && X4.leave.isOpen()) { X4.leave.cancel(); return true; }
    if (X4.dl && X4.dl.isOpen()) { X4.dl.hide(); return true; }
    if (opening) { X4.native.site.cancel(); endOpening(); return true; }
    if (listOpen) {
      if (siteOpen) closeList(); else goHome();
      return true;
    }
    if (siteOpen) {
      if (X4.native.site.back()) return true;            // one step back inside the site
      goHome();
      return true;
    }
    goHome();
    return true;
  }

  X4.start = { enter: enter, onBack: onBack, teardown: teardown, home: null, isSiteOpen: function () { return siteOpen; }, isListOpen: function () { return listOpen; } };
})();
