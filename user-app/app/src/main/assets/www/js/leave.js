/* X4 SKINS 18 MAX — leave.js : the "you are leaving the app" notice of webview2
   The Android shell stops a link that leads outside the opened site and asks for this notice (6 languages, OK button).
   OK → the link opens in the phone's browser while the app stays alive in the background. */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});
  var I = X4.i18n;

  var modal, panel, okBtn, hostEl, wired = false, open = false, pending = '', lb = null, busy = false;

  function hostOf(u) { try { return new URL(u).host; } catch (e) { return String(u).slice(0, 60); } }

  function texts() {
    if (!wired) return;
    X4.$('#leave-title').textContent = I.t('leave.title');
    X4.$('#leave-msg').textContent = I.t('leave.msg');
    X4.$('.lbl', okBtn).textContent = I.t('leave.ok');
  }

  function wire() {
    if (wired) return;
    wired = true;
    modal = X4.$('#leave-dlg'); panel = X4.$('.panel', modal); okBtn = X4.$('#leave-ok'); hostEl = X4.$('#leave-host');
    X4.fx.pressable(okBtn, { radius: 17 });
    okBtn.addEventListener('click', accept);
    I.on('change', texts);
  }

  function show(url) {
    wire();
    pending = String(url || '');
    if (open) { hostEl.textContent = hostOf(pending); return; }     // a newer link replaces the one shown
    open = true; busy = false;
    texts();
    hostEl.textContent = hostOf(pending);
    modal.setAttribute('aria-hidden', 'false');
    X4.native.haptic();
    X4.fx.dialogIn(modal, panel);
    if (lb) lb.stop();
    lb = X4.fx.lightningBorder(panel, { pad: 16, radius: 26 });
  }

  function close() {
    open = false;
    modal.setAttribute('aria-hidden', 'true');
    if (lb) { lb.stop(); lb = null; }
    return X4.fx.dialogOut(modal, panel);
  }

  function accept() {
    if (!open || busy) return;
    busy = true;
    var u = pending; pending = '';
    X4.native.leaveTo(u);
    close();
  }

  function cancel() {
    if (!open) return;
    pending = '';
    X4.native.leaveCancel();
    close();
  }

  X4.native.ev.on('leave', show);
  X4.leave = { isOpen: function () { return open; }, cancel: cancel, show: show };
})();
