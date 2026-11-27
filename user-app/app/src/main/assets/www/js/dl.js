/* X4 SKINS 18 MAX — dl.js : the download dialog
   Lightning-glow circular progress ring with the REAL percentage, REAL size and REAL file name (all reported by the
   Android shell while it writes the file into Download/AHM X APP). Buttons: open file, cancel, hide (the download keeps
   going and shrinks to a bubble). Dialog and bubbles leave with a lightning effect. */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});
  var I = X4.i18n;

  var C = 2 * Math.PI * 82;                      // ring circumference (viewBox 200)
  var CC = 2 * Math.PI * 21;                     // bubble ring circumference (viewBox 52)
  var items = {}, order = [], focusId = 0, wired = false, isOpen = false, busyClose = false;
  var modal, panel, ringEl, prog, spin, cv, ctx, titleEl, pctEl, speedEl, nameEl, sizeEl, whereEl, bOpen, bCancel, bHide, bClose, chipsEl;
  var lb = null, iv = 0, celebrate = 0, S = 0, R = 0;

  /* ---------------------------------------------------------------- helpers */
  function fmt(n) {
    if (!(n >= 0)) return '';
    var u = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (i === 0 ? String(Math.round(n)) : (n >= 100 ? n.toFixed(0) : n.toFixed(1))) + ' ' + u[i];
  }
  function pctOf(d) { return d.total > 0 ? X4.clamp(d.got / d.total, 0, 1) : 0; }
  function ind(d) { return d.state === 'run' && !(d.total > 0); }

  /* ---------------------------------------------------------------- native events */
  function onDl(e) {
    if (!e) return;
    var id = e.id | 0;
    if (e.t === 'note') {                                   // nothing started: unsupported link / no storage permission
      X4.toast(I.t(e.code === 'perm' ? 'dl.perm' : 'dl.unsupported')); X4.native.haptic(); return;
    }
    if (!id) return;
    var d = items[id];
    if (e.t === 'start') {
      d = items[id] = { id: id, name: e.name || '', total: e.total > 0 ? e.total : -1, got: 0, state: 'run', speed: 0, lt: performance.now(), lg: 0, path: '', ref: '', mime: '' };
      order.push(id);
      showDialog(id);
      return;
    }
    if (!d) return;
    if (e.t === 'meta') {
      if (e.name) d.name = e.name;
      d.total = e.total > 0 ? e.total : -1;
      if (e.mime) d.mime = e.mime;
    } else if (e.t === 'prog') {
      var now = performance.now(), dt = (now - d.lt) / 1000;
      if (dt > 0.2) { var inst = (e.got - d.lg) / dt; d.speed = d.speed ? d.speed * 0.6 + inst * 0.4 : inst; d.lt = now; d.lg = e.got; }
      d.got = e.got;
      if (e.total > 0) d.total = e.total;
    } else if (e.t === 'done') {
      d.state = 'done'; d.got = e.size > 0 ? e.size : d.got; d.total = d.got; d.speed = 0;
      if (e.name) d.name = e.name;
      d.path = e.path || ''; d.ref = e.ref || ''; d.mime = e.mime || d.mime;
      celebrate = performance.now();
      X4.native.haptic();
      if (focusId !== id) X4.toast(I.t('dl.done') + ' — ' + d.name);
    } else if (e.t === 'fail') {
      d.state = 'fail'; d.speed = 0; d.err = e.reason || '';
      X4.native.haptic();
    } else if (e.t === 'cancel') {
      d.state = 'cancel'; d.speed = 0;
    }
    paint(id);
  }

  /* ---------------------------------------------------------------- painting */
  function titleKey(d) { return d.state === 'done' ? 'dl.done' : d.state === 'fail' ? 'dl.failed' : d.state === 'cancel' ? 'dl.canceled' : 'dl.title'; }

  function paint(id) {
    var d = items[id];
    if (!d) return;
    paintChip(d);
    if (focusId === id && wired) paintDialog(d);
  }

  function paintDialog(d) {
    var p = pctOf(d), isInd = ind(d);
    var fin = d.state === 'done', noTotal = !(d.total > 0);

    prog.style.strokeDashoffset = String(C * (1 - (fin ? 1 : (isInd ? 0.26 : p))));
    spin.classList.toggle('ind', isInd);
    panel.classList.toggle('is-done', fin);
    panel.classList.toggle('is-bad', d.state === 'fail' || d.state === 'cancel');
    titleEl.textContent = I.t(titleKey(d));
    pctEl.textContent = fin ? '100%' : (isInd ? fmt(d.got) : (noTotal ? '—' : Math.floor(p * 100) + '%'));
    speedEl.textContent = (d.state === 'run' && d.speed > 1 ? fmt(d.speed) + '/s' : '');
    nameEl.textContent = d.name || '…';
    sizeEl.textContent = d.total > 0 ? (fin ? fmt(d.total) : fmt(d.got) + ' / ' + fmt(d.total)) : (fmt(d.got) + ' · ' + I.t('dl.unknown'));
    if (d.state === 'done') whereEl.textContent = I.t('dl.saved') + ' ' + (d.path || 'Download/AHM X APP');
    else if (d.state === 'fail' && d.err === 'perm') whereEl.textContent = I.t('dl.perm');
    else whereEl.textContent = '';
    whereEl.style.display = whereEl.textContent ? '' : 'none';
    var run = d.state === 'run', fin2 = d.state === 'done';
    bCancel.hidden = bHide.hidden = !run;
    bOpen.hidden = !fin2;
    bClose.hidden = run;
    X4.$('.lbl', bOpen).textContent = I.t('dl.open');
    X4.$('.lbl', bCancel).textContent = I.t('dl.cancel');
    X4.$('.lbl', bHide).textContent = I.t('dl.hide');
    X4.$('.lbl', bClose).textContent = I.t('close');
  }

  /* ---------------------------------------------------------------- bubbles (hidden downloads) */
  function chipOf(id) { return X4.$('.dl-chip[data-id="' + id + '"]', chipsEl); }

  function paintChip(d) {
    var show = focusId !== d.id;
    var c = chipOf(d.id);
    if (!show) { if (c) removeChip(c, false); return; }
    var fresh = !c;
    if (!c) {
      c = X4.el('button', 'dl-chip');
      c.type = 'button'; c.setAttribute('data-id', d.id); c.setAttribute('data-hit', '');
      c.innerHTML = '<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="ct" cx="26" cy="26" r="21"/><g class="cg"><circle class="cp" cx="26" cy="26" r="21" transform="rotate(-90 26 26)"/></g></svg><span class="cx" dir="ltr"></span>';
      X4.fx.pressable(c, { radius: 26 });
      c.addEventListener('click', function () { showDialog(d.id); });
      chipsEl.appendChild(c);
      c.animate([{ opacity: 0, transform: 'scale(.3)', filter: 'brightness(2.4)' }, { opacity: 1, transform: 'scale(1.12)', filter: 'brightness(1.4)', offset: .65 }, { opacity: 1, transform: 'scale(1)', filter: 'brightness(1)' }],
        { duration: 520, easing: 'cubic-bezier(.2,.9,.25,1)' });
    }
    var p = pctOf(d), isInd = ind(d), cp = X4.$('.cp', c), cx = X4.$('.cx', c);
    c.classList.toggle('done', d.state === 'done');
    c.classList.toggle('bad', d.state === 'fail' || d.state === 'cancel');
    c.querySelector('.cg').classList.toggle('ind', isInd);
    cp.style.strokeDashoffset = String(CC * (1 - (d.state === 'done' ? 1 : (isInd ? 0.26 : p))));
    cx.textContent = d.state === 'done' ? '✓' : (d.state === 'fail' || d.state === 'cancel') ? '✕' : (isInd ? '…' : Math.floor(p * 100));
    if (fresh) X4.hit.refresh();
  }

  function removeChip(c, zap) {
    if (!c) return Promise.resolve();
    c.removeAttribute('data-hit');
    var p = zap ? X4.fx.zap(c, { radius: 26, duration: 420, z: 460, hide: function () { c.style.display = 'none'; } }) : Promise.resolve();
    return p.then(function () { if (c.parentNode) c.parentNode.removeChild(c); X4.hit.refresh(); });
  }

  /* ---------------------------------------------------------------- ring lightning */
  function sizeCanvas() {
    var w = ringEl.offsetWidth || 220, pad = 26;
    S = w + pad * 2; R = w * 0.41;
    var dpr = X4.perf.low ? 1 : X4.perf.dpr;
    cv.style.cssText = 'position:absolute;left:' + (-pad) + 'px;top:' + (-pad) + 'px;width:' + S + 'px;height:' + S + 'px;pointer-events:none;';
    cv.width = Math.round(S * dpr); cv.height = Math.round(S * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function arcBolt(a0, len, amp) {
    var pts = [], n = Math.max(3, Math.round(len / 0.05)), c = S / 2;
    for (var i = 0; i <= n; i++) {
      var a = a0 + len * i / n, r = R + (Math.random() - 0.5) * amp * (i === 0 || i === n ? 0.3 : 1);
      pts.push([c + Math.cos(a) * r, c + Math.sin(a) * r]);
    }
    return pts;
  }

  function drawBolts() {
    var d = items[focusId];
    if (!d || !isOpen || document.hidden) return;
    ctx.clearRect(0, 0, S, S);
    var t = performance.now(), c = S / 2, boost = celebrate && t - celebrate < 900;
    if (d.state !== 'run' && !boost) return;
    var isInd = ind(d), p = d.state === 'done' ? 1 : (isInd ? 0.26 : pctOf(d));
    var spinA = isInd ? (t / 1100 % 1) * Math.PI * 2 : 0;
    var head = -Math.PI / 2 + (isInd ? spinA + 0.26 * Math.PI * 2 : p * Math.PI * 2), tail = head - Math.max(0.08, p * Math.PI * 2);
    var flick = 0.8 + 0.2 * Math.sin(t / 40);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    X4.perf.pulse(150);
    var bolts = [], n = X4.perf.low ? 2 : 4;
    for (var k = 0; k < n; k++) bolts.push(arcBolt(tail + Math.random() * Math.max(0.05, head - tail - 0.3), 0.22 + Math.random() * 0.4, 9));
    if (boost) for (var j = 0; j < 7; j++) bolts.push(arcBolt(Math.random() * Math.PI * 2, 0.3 + Math.random() * 0.6, 14));
    bolts.forEach(function (b) {
      X4.fx.glowPts(ctx, b, '110,200,255', 0.8 * flick, 2.4);
      ctx.strokeStyle = 'rgba(240,250,255,' + flick + ')'; ctx.lineWidth = 1; X4.fx.strokePts(ctx, b);
    });
    /* sparks leaping off the head of the ring (or all around it while celebrating) */
    var sparks = boost ? 6 : 2;
    for (var s = 0; s < sparks; s++) {
      var a = boost ? Math.random() * Math.PI * 2 : head + (Math.random() - 0.5) * 0.18;
      var x0 = c + Math.cos(a) * R, y0 = c + Math.sin(a) * R, L = 10 + Math.random() * 20, dir = Math.random() < 0.7 ? 1 : -0.5;
      var pts = X4.fx.bolt(x0, y0, x0 + Math.cos(a) * L * dir, y0 + Math.sin(a) * L * dir, 8, 3);
      ctx.strokeStyle = 'rgba(190,235,255,0.95)'; ctx.lineWidth = 1.3; X4.fx.strokePts(ctx, pts);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------------------------------------------------------------- dialog open / close */
  function showDialog(id) {
    wire();
    var prev = focusId;
    focusId = id;
    if (prev && prev !== id && items[prev]) paintChip(items[prev]);       // the previous one becomes a bubble
    var d = items[id];
    var chip = chipOf(id); if (chip) removeChip(chip, false);
    paintDialog(d);
    if (isOpen) return Promise.resolve();
    isOpen = true;
    modal.setAttribute('aria-hidden', 'false');
    var p = X4.fx.dialogIn(modal, panel);
    if (X4.perf.lite) return p;                                            // LITE: no lightning on the progress ring
    if (lb) lb.stop();
    lb = X4.fx.lightningBorder(panel, { pad: 16, radius: 26 });
    sizeCanvas();
    clearInterval(iv); iv = setInterval(drawBolts, 70);
    return p;
  }

  /* lightning-vanish; the download itself is untouched */
  function dismiss(removeItem) {
    if (!isOpen || busyClose) return Promise.resolve();
    busyClose = true;
    var id = focusId;
    isOpen = false;
    modal.setAttribute('aria-hidden', 'true');
    clearInterval(iv); iv = 0;
    if (lb) { lb.stop(); lb = null; }
    ctx.clearRect(0, 0, S, S);
    return X4.fx.dialogZap(modal, panel).then(function () {
      busyClose = false;
      focusId = 0;
      if (removeItem) { delete items[id]; order = order.filter(function (x) { return x !== id; }); }
      else if (items[id]) paintChip(items[id]);
    });
  }

  function hide() {
    var d = items[focusId];
    if (!d) return dismiss(false);
    return dismiss(d.state !== 'run');                 // finished/failed ones are simply closed, running ones become bubbles
  }

  function wire() {
    if (wired) return;
    wired = true;
    modal = X4.$('#dl-dlg'); panel = X4.$('.panel', modal); ringEl = X4.$('#dl-ring'); prog = X4.$('#dl-prog'); spin = X4.$('#dl-spin');
    cv = X4.$('#dl-bolts'); ctx = cv.getContext('2d'); titleEl = X4.$('#dl-title'); pctEl = X4.$('#dl-pct'); speedEl = X4.$('#dl-speed');
    nameEl = X4.$('#dl-name'); sizeEl = X4.$('#dl-size'); whereEl = X4.$('#dl-where');
    bOpen = X4.$('#dl-open'); bCancel = X4.$('#dl-cancel'); bHide = X4.$('#dl-hide'); bClose = X4.$('#dl-close'); chipsEl = X4.$('#dl-chips');
    prog.style.strokeDasharray = C + ' ' + C;
    [bOpen, bCancel, bHide, bClose].forEach(function (b) { X4.fx.pressable(b, { radius: 17 }); });

    bHide.addEventListener('click', function () { hide(); });
    bClose.addEventListener('click', function () { dismiss(true); });
    bCancel.addEventListener('click', function () {
      var d = items[focusId];
      if (!d || d.state !== 'run') return;
      X4.native.cancelDownload(d.id);
      d.state = 'cancel'; paint(d.id);
      setTimeout(function () { if (focusId === d.id) dismiss(true); }, 750);
    });
    bOpen.addEventListener('click', function () {
      var d = items[focusId];
      if (!d) return;
      if (!X4.native.openFile(d.ref, d.mime)) { X4.toast(I.t('dl.noapp')); X4.native.haptic(); }
    });
    I.on('change', function () { if (focusId && items[focusId]) paintDialog(items[focusId]); });
    window.addEventListener('resize', function () { if (isOpen) sizeCanvas(); });
  }

  function init() {
    chipsEl = X4.$('#dl-chips');
    X4.native.ev.on('dl', onDl);
  }

  X4.dl = { init: init, isOpen: function () { return isOpen; }, hide: hide, count: function () { return order.length; } };
})();
