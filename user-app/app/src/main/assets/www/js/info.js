/* X4 SKINS 18 MAX — info.js : the AHM X INFO page
   One glass card per link from data/info.json (WhatsApp channel, Telegram channel/bot/group, Discord, website …).
   Tapping a card plays the shield-style effect in that card's own shape + logo, and at its peak the link opens
   outside the app (browser / the right app). Add, remove or change items from GitHub only. */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});
  var I = X4.i18n;

  /* the effect shape for an item that does not name one: different for every kind of link */
  var SHAPE_FOR = { whatsapp: 'squircle', telegram: 'circle', bot: 'hexagon', group: 'badge', discord: 'diamond', website: 'octagon', channel: 'badge', youtube: 'banner', link: 'circle' };

  var items = [], wired = false, active = false, listEl, opening = false;

  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }

  function normalize(arr) {
    var out = [];
    (arr || []).forEach(function (o, i) {
      if (!o || o.enabled === false) return;
      var url = typeof o.url === 'string' ? o.url.trim() : '';
      if (url && !/^(https?:\/\/|tg:\/\/|whatsapp:\/\/|mailto:)/i.test(url)) url = '';     // only links the shell is willing to open
      out.push({
        id: String(o.id || ('i' + i)), title: o.title, subtitle: o.subtitle, url: url,
        icon: X4.glyphs.has(o.icon) ? o.icon : 'link', image: X4.config.asset(o.image), shape: o.shape || '', imgFail: false
      });
    });
    return out;
  }

  function tile(it) {
    return it.image ? '<img alt="" decoding="async" src="' + it.image.replace(/"/g, '&quot;') + '">' : X4.glyphs.svg(it.icon, 30);
  }

  var OUT = '<svg class="out" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4L10 14"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>';

  function render() {
    listEl.innerHTML = '';
    if (!items.length) { listEl.innerHTML = '<div class="lk-note">' + I.t('start.empty') + '</div>'; return; }
    items.forEach(function (it) {
      var b = X4.el('button', 'info-card');
      b.type = 'button';
      b.setAttribute('data-id', it.id);
      b.innerHTML = '<span class="ic-tile">' + tile(it) + '</span><span class="lk-txt"><span class="lk-name"></span><span class="lk-sub"></span></span>' + OUT;
      X4.$('.lk-name', b).textContent = I.pick(it.title) || hostOf(it.url) || '—';
      X4.$('.lk-sub', b).textContent = I.pick(it.subtitle) || (it.url ? hostOf(it.url) : '');
      var im = X4.$('img', b);
      if (im) im.addEventListener('error', function () { it.imgFail = true; it.image = ''; X4.$('.ic-tile', b).innerHTML = X4.glyphs.svg(it.icon, 30); });
      X4.fx.pressable(b, { radius: 22 });
      b.addEventListener('click', function () { open(it); });
      listEl.appendChild(b);
    });
  }

  function reveal() {
    X4.$$('.info-card', listEl).forEach(function (b, i) {
      b.animate([
        { opacity: 0, transform: 'perspective(700px) translateY(46px) rotateX(-30deg) scale(.86)', filter: 'blur(10px) brightness(2)' },
        { opacity: 1, transform: 'perspective(700px) translateY(-5px) rotateX(4deg) scale(1.02)', filter: 'blur(0) brightness(1.3)', offset: 0.64 },
        { opacity: 1, transform: 'perspective(700px) translateY(0) rotateX(0) scale(1)', filter: 'brightness(1)' }
      ], { duration: 720, delay: 120 + i * 110, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'backwards' });
    });
  }

  function open(it) {
    if (opening || X4.emblem.isPlaying() || X4.router.isBusy()) return;
    if (!it.url) { X4.toast(I.t('gate.noLink')); X4.native.haptic(); return; }
    opening = true;
    X4.emblem.play({ shape: it.shape || SHAPE_FOR[it.icon] || 'badge', image: it.imgFail ? '' : it.image, icon: it.icon },
      { speed: 0.7, onPeak: function () { X4.native.openExternal(it.url); } })
      .then(function () { opening = false; }, function () { opening = false; });
  }

  function wire() {
    if (wired) return;
    wired = true;
    listEl = X4.$('#info-list');
    I.on('change', function () { if (active) render(); });
  }

  function enter() {
    wire();
    active = true; opening = false;
    listEl.innerHTML = '<div class="lk-note"><i class="lk-spin"></i></div>';
    return X4.config.load('info').then(function (r) {
      if (!active) return;
      items = r ? normalize(r.data.items) : [];
      render();
      reveal();
    });
  }

  function leave() { active = false; }

  X4.info = { enter: enter, leave: leave };
})();
