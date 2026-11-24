/* X4 SKINS 18 MAX — explain.js : the Explanations page
   Big YouTube player (a native view placed exactly over the frame on this page) + a floating glass bar with up to
   6 items. Every item comes from data/explain.json: name, picture, YouTube link. Tapping an item plays the shield-style
   effect in the item's own shape/logo and, under the frost, the player switches to that video.
   "Open in YouTube" opens the same video in the YouTube app / browser. */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});
  var I = X4.i18n;

  var SHAPES = ['banner', 'hexagon', 'squircle', 'diamond', 'circle', 'badge'];     // used when an item names no shape
  var items = [], cur = -1, active = false, wired = false, iv = 0, lastKey = '';
  var bar, ind, playerEl, phEl, phText, titleEl, descEl, openBtn, devFrame = null;

  /* ---------------------------------------------------------------- data */
  /* accepts a link (watch, youtu.be, shorts, live, embed, playlist) or a bare 11-character video id */
  function parseYT(u) {
    if (!u || typeof u !== 'string') return null;
    u = u.trim();
    var ID = /^[A-Za-z0-9_-]{6,64}$/;
    if (/^[A-Za-z0-9_-]{11}$/.test(u)) return { kind: 'v', id: u, watch: 'https://www.youtube.com/watch?v=' + u };
    var url;
    try { url = new URL(u); } catch (e) { return null; }
    var h = url.hostname.toLowerCase().replace(/^(www|m|music)\./, ''), id = '', list = url.searchParams.get('list') || '';
    if (h === 'youtu.be') id = url.pathname.split('/')[1] || '';
    else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
      id = url.searchParams.get('v') || '';
      var m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      if (!id && m) id = m[1];
    } else return null;
    if (id && ID.test(id) && id !== 'videoseries') return { kind: 'v', id: id, watch: 'https://www.youtube.com/watch?v=' + id };
    if (list && ID.test(list)) return { kind: 'list', id: list, watch: 'https://www.youtube.com/playlist?list=' + list };
    return null;
  }

  function normalize(arr) {
    var out = [];
    (arr || []).forEach(function (o, i) {
      if (!o || o.enabled === false || out.length >= 6) return;
      out.push({
        id: String(o.id || ('e' + i)), title: o.title, label: o.label, desc: o.description,
        image: X4.config.asset(o.image), icon: o.icon || '', shape: o.shape || '',
        yt: parseYT(o.youtube || o.url || ''), imgFail: false
      });
    });
    return out;
  }

  /* ---------------------------------------------------------------- the floating bar */
  function tileHtml(it) {
    return it.image ? '<img alt="" decoding="async" src="' + it.image.replace(/"/g, '&quot;') + '">' : X4.glyphs.svg(it.icon || 'youtube', 26);
  }

  function renderBar() {
    bar.innerHTML = '<span class="ex-ind"></span>';
    ind = X4.$('.ex-ind', bar);
    items.forEach(function (it, i) {
      var b = X4.el('button', 'ex-it');
      b.type = 'button';
      b.setAttribute('data-i', i);
      b.innerHTML = '<span class="ex-tile">' + tileHtml(it) + '</span><span class="ex-lbl"></span>';
      X4.$('.ex-lbl', b).textContent = I.pick(it.label) || I.pick(it.title) || String(i + 1);
      var im = X4.$('img', b);
      if (im) im.addEventListener('error', function () { it.imgFail = true; it.image = ''; X4.$('.ex-tile', b).innerHTML = X4.glyphs.svg(it.icon || 'youtube', 26); });
      X4.fx.pressable(b, { radius: 18 });
      b.addEventListener('click', function () { choose(i); });
      bar.appendChild(b);
    });
    mark();
  }

  function mark() {
    var bs = X4.$$('.ex-it', bar);
    bs.forEach(function (b, i) { b.classList.toggle('on', i === cur); });
    var b = bs[cur];
    if (b && ind) {
      ind.style.width = b.offsetWidth + 'px';
      ind.style.transform = 'translateX(' + b.offsetLeft + 'px)';
      ind.classList.add('show');
    } else if (ind) ind.classList.remove('show');
  }

  function revealBar() {
    X4.$$('.ex-it', bar).forEach(function (b, i) {
      b.animate([
        { opacity: 0, transform: 'translateY(34px) scale(.7)', filter: 'blur(8px) brightness(2)' },
        { opacity: 1, transform: 'translateY(-4px) scale(1.06)', filter: 'blur(0) brightness(1.3)', offset: 0.65 },
        { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'brightness(1)' }
      ], { duration: 650, delay: 120 + i * 90, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'backwards' });
    });
  }

  /* ---------------------------------------------------------------- choosing / playing */
  function choose(i) {
    if (i === cur || i < 0 || i >= items.length || X4.emblem.isPlaying() || X4.router.isBusy()) return;
    var it = items[i];
    hidePlayer();                                           // the native player must not cover the effect
    X4.emblem.play({
      shape: it.shape || SHAPES[i % SHAPES.length],
      image: it.imgFail ? '' : it.image,
      icon: it.icon || 'youtube'
    }, { speed: 0.7, onPeak: function () { select(i, true); } });
  }

  /* title / description of the current item and the placeholder text, in the current language */
  function texts() {
    var it = items[cur];
    phText.textContent = I.t('ex.empty');
    if (!it) return;
    titleEl.textContent = I.pick(it.title) || I.pick(it.label) || '';
    descEl.textContent = I.pick(it.desc) || '';
    descEl.style.display = descEl.textContent ? '' : 'none';
  }

  function select(i, autoplay) {
    cur = i;
    var it = items[i];
    mark();
    texts();
    openBtn.disabled = !it.yt;
    phEl.classList.toggle('show', !it.yt);
    if (it.yt) {
      if (X4.native.yt.has) X4.native.yt.load(it.yt.kind, it.yt.id, autoplay);
      else devPlayer(it, autoplay);
    } else {
      if (X4.native.yt.has) X4.native.yt.stop(); else devPlayer(null);
    }
    lastKey = '';
    sync();
  }

  /* plain browser (development only): show the embed inside the frame */
  function devPlayer(it, autoplay) {
    if (devFrame) { devFrame.remove(); devFrame = null; }
    if (!it) return;
    devFrame = document.createElement('iframe');
    devFrame.allow = 'autoplay; encrypted-media';
    devFrame.src = 'https://www.youtube.com/embed/' + (it.yt.kind === 'list' ? 'videoseries?list=' : '') + it.yt.id + (it.yt.kind === 'list' ? '&' : '?') + 'playsinline=1&rel=0&fs=0&autoplay=' + (autoplay ? 1 : 0);
    devFrame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:inherit;';
    playerEl.appendChild(devFrame);
  }

  /* ---------------------------------------------------------------- native player placement */
  function hidePlayer() {
    lastKey = 'off';
    X4.native.yt.layout(false, 0, 0, 0, 0);
  }

  /* the native player is shown only while nothing else may cover it: this page is settled, no dialog, no effect */
  function sync() {
    if (!active || !X4.native.yt.has) return;
    var it = items[cur];
    var want = !!(it && it.yt) && X4.router.cur() === 'explain' && !X4.router.isBusy() && !X4.emblem.isPlaying() &&
      !document.querySelector('.modal.open');
    var key = 'off';
    if (want) {
      var r = playerEl.getBoundingClientRect();
      if (r.width < 40) want = false;
      else key = [r.left + 2, r.top + 2, r.width - 4, r.height - 4].map(Math.round).join(',');
    }
    if (key === lastKey) return;
    lastKey = key;
    if (!want) { X4.native.yt.layout(false, 0, 0, 0, 0); return; }
    var p = key.split(',');
    X4.native.yt.layout(true, +p[0], +p[1], +p[2], +p[3]);
  }

  /* ---------------------------------------------------------------- wiring */
  function wire() {
    if (wired) return;
    wired = true;
    bar = X4.$('#ex-bar'); playerEl = X4.$('#ex-player'); phEl = X4.$('#ex-ph'); phText = X4.$('#ex-ph-t');
    titleEl = X4.$('#ex-title'); descEl = X4.$('#ex-desc'); openBtn = X4.$('#ex-open');
    X4.fx.pressable(openBtn, { radius: 17 });
    openBtn.addEventListener('click', function () {
      var it = items[cur];
      if (!it || !it.yt) { X4.toast(I.t('gate.noLink')); return; }
      X4.native.openExternal(it.yt.watch);
    });
    I.on('change', function () {
      if (!active || !items.length) return;
      renderBar();
      texts();
    });
    window.addEventListener('resize', function () { lastKey = ''; mark(); sync(); });
    /* the player's renderer died (low memory): load the current video again, paused */
    X4.native.ev.on('yt', function (w) { if (w === 'gone' && active && cur >= 0) select(cur, false); });
  }

  function enter() {
    wire();
    active = true; cur = -1; lastKey = '';
    titleEl.textContent = ''; descEl.textContent = ''; descEl.style.display = 'none';
    phEl.classList.add('show'); phText.textContent = '';
    openBtn.disabled = true;
    clearInterval(iv);
    iv = setInterval(sync, 120);
    return X4.config.load('explain').then(function (r) {
      if (!active) return;
      items = r ? normalize(r.data.items) : [];
      renderBar();
      if (items.length) { select(0, false); revealBar(); }
      else { phText.textContent = I.t('ex.empty'); }
    });
  }

  function leave() {
    if (!active) return;
    active = false;
    clearInterval(iv);
    lastKey = '';
    X4.native.yt.stop();
    if (devFrame) { devFrame.remove(); devFrame = null; }
  }

  X4.explain = { enter: enter, leave: leave, parseYT: parseYT, sync: sync, isActive: function () { return active; } };
})();
