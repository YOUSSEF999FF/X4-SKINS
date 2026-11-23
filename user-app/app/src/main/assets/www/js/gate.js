/* X4 SKINS 18 MAX — gate.js : page 2 password dialog
   shield effect → glass dialog → PBKDF2 check → dialog closes → the 3 buttons appear one after another.
   The password itself is never stored anywhere: data/gate.json holds only a salted PBKDF2-SHA256 hash. */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});
  var I = X4.i18n;

  var modal, panel, input, form, msg, field, confirmBtn, eye, bGet, bHow;
  var data = null, busy = false, isOpen = false, wired = false, lb = null, msgKey = '', resolveRun = null, errTimer = 0;

  function b64ToBytes(s) {
    var bin = atob(s), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function bytesToB64(u) {
    var s = '';
    for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }
  function derive(pw, d) {
    var subtle = window.crypto && window.crypto.subtle;
    if (!subtle) return Promise.reject(new Error('no-subtle'));
    return subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']).then(function (k) {
      return subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64ToBytes(d.salt), iterations: d.iter }, k, 256);
    }).then(function (bits) { return bytesToB64(new Uint8Array(bits)); });
  }
  function same(a, b) {
    a = String(a); b = String(b);
    if (a.length !== b.length) return false;
    var r = 0;
    for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }

  function linkOf(o) { return o && typeof o.url === 'string' ? o.url.trim() : ''; }
  function applyLabels() {
    if (!bGet) return;
    var g = (data && data.getPass) || {}, h = (data && data.howToGetPass) || {};
    X4.$('.lbl', bGet).textContent = I.pick(g.label) || 'Get Pass';
    X4.$('.lbl', bHow).textContent = I.pick(h.label) || 'How To Get Pass';
  }

  function showMsg(key, isErr) {
    msgKey = key || '';
    msg.textContent = key ? I.t(key) : '';
    msg.classList.toggle('err', !!isErr);
    field.classList.toggle('err', !!isErr);
  }

  function border(color) {
    if (lb) lb.stop();
    lb = X4.fx.lightningBorder(panel, { pad: 16, radius: 26, color: color || '80,190,255' });
  }

  function shake() {
    panel.animate([
      { transform: 'translateX(0)' }, { transform: 'translateX(-14px)' }, { transform: 'translateX(12px)' },
      { transform: 'translateX(-9px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }
    ], { duration: 460, easing: 'ease-out' });
  }

  function wire() {
    if (wired) return;
    wired = true;
    modal = X4.$('#gate'); panel = X4.$('.panel', modal); input = X4.$('#gate-input'); form = X4.$('#gate-form');
    msg = X4.$('#gate-msg'); field = X4.$('#gate-field'); confirmBtn = X4.$('#gate-confirm'); eye = X4.$('#gate-eye');
    bGet = X4.$('#gate-getpass'); bHow = X4.$('#gate-howto');
    X4.$('#gate-emblem').innerHTML = X4.emblem.mini('shield', 58);
    [confirmBtn, bGet, bHow].forEach(function (b) { X4.fx.pressable(b, { radius: 17 }); });

    form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    input.addEventListener('input', function () { if (msgKey) showMsg(''); });
    eye.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eye.classList.toggle('on', show);
    });
    function openLink(o) {
      var u = linkOf(o);
      if (!u) { X4.toast(I.t('gate.noLink')); return; }
      X4.native.openExternal(u);
    }
    bGet.addEventListener('click', function () { openLink(data && data.getPass); });
    bHow.addEventListener('click', function () { openLink(data && data.howToGetPass); });
    I.on('change', function () { applyLabels(); if (msgKey) msg.textContent = I.t(msgKey); });
  }

  function openDialog() {
    wire();
    isOpen = true;
    input.value = ''; input.type = 'password'; eye.classList.remove('on'); showMsg('');
    modal.setAttribute('aria-hidden', 'false');
    var p = X4.fx.dialogIn(modal, panel);
    border();
    p.then(function () { setTimeout(function () { try { input.focus(); } catch (e) {} }, 120); });
  }

  function closeDialog() {
    isOpen = false;
    modal.setAttribute('aria-hidden', 'true');
    if (lb) { lb.stop(); lb = null; }
    return X4.fx.dialogOut(modal, panel);
  }

  function fail() {
    showMsg('gate.wrong', true);
    X4.native.haptic();
    shake();
    panel.classList.add('err');
    border('255,80,105');                       // red lightning for a moment
    clearTimeout(errTimer);
    errTimer = setTimeout(function () { panel.classList.remove('err'); if (isOpen) border(); }, 1000);
    input.value = '';
    try { input.focus(); } catch (e) {}
  }

  function succeed(d) {
    X4.store.set('x4_gate_token', d.hash);
    panel.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], { duration: 260 });
    try { input.blur(); } catch (e) {}
    X4.sleep(160).then(closeDialog).then(function () {
      reveal();
      if (resolveRun) { var r = resolveRun; resolveRun = null; r(); }
    });
  }

  function submit() {
    if (busy) return;
    var v = input.value.trim();
    if (!v) { showMsg('gate.empty', true); shake(); X4.native.haptic(); return; }
    busy = true;
    confirmBtn.classList.add('loading');
    var getData = data ? Promise.resolve(data) : X4.config.load('gate').then(function (r) { data = r ? r.data : null; applyLabels(); return data; });
    getData.then(function (d) {
      if (!d) { showMsg('gate.unavailable', true); return; }
      return derive(v, d).then(function (h) { if (same(h, d.hash)) succeed(d); else fail(); });
    }).catch(function () { showMsg('gate.unavailable', true); }).then(function () {
      busy = false; confirmBtn.classList.remove('loading');
    });
  }

  /* the three main buttons come in one after another with a 3D pop */
  function reveal() {
    var box = X4.$('#main-actions');
    box.classList.add('shown');
    X4.$$('.btn-main', box).forEach(function (b, i) {
      b.animate([
        { opacity: 0, transform: 'perspective(700px) translateY(52px) rotateX(-38deg) scale(.8)', filter: 'blur(12px) brightness(2.2)' },
        { opacity: 1, transform: 'perspective(700px) translateY(-7px) rotateX(5deg) scale(1.04)', filter: 'blur(0) brightness(1.35)', offset: 0.62 },
        { opacity: 1, transform: 'perspective(700px) translateY(0) rotateX(0deg) scale(1)', filter: 'brightness(1)' }
      ], { duration: 850, delay: i * 190, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'backwards' });
    });
  }

  /* resolves when the buttons are on screen (password accepted, or already remembered) */
  function run() {
    wire();
    return X4.config.load('gate').then(function (r) {
      data = r ? r.data : null;
      applyLabels();
      var tok = X4.store.get('x4_gate_token');
      if (data && tok && same(tok, data.hash)) { reveal(); return; }      // remembered, and the password has not changed
      if (tok) X4.store.del('x4_gate_token');
      var done = new Promise(function (res) { resolveRun = res; });
      X4.emblem.play('shield', { onPeak: openDialog });
      return done;
    });
  }

  X4.gate = { run: run, isOpen: function () { return isOpen; } };
})();
