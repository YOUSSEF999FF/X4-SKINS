/* X4 SKINS 18 MAX — hit.js : who gets the finger — our interface or the website underneath?
   While a site (webview1 / webview2) is open, our HTML interface is a transparent layer on top of it.
   The Android shell lets touches fall through to the site everywhere EXCEPT the rectangles reported here
   (the floating 18 MAX button, download bubbles) or everywhere when one of our dialogs is open. */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});

  var site = false, last = '', raf = 0, iv = 0, PADPX = 8;

  function compute() {
    raf = 0;
    if (!site) { send(true, []); return; }
    /* any dialog (or the shield effect) open → the whole screen belongs to us */
    if (document.querySelector('.modal.open, #emblem-layer.on')) { send(true, []); return; }
    var rects = [];
    X4.$$('[data-hit]').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      var cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return;
      rects.push([Math.round(r.left - PADPX), Math.round(r.top - PADPX), Math.round(r.right + PADPX), Math.round(r.bottom + PADPX)]);
    });
    send(false, rects);
  }

  function send(all, rects) {
    var key = (all ? '1' : '0') + JSON.stringify(rects);
    if (key === last) return;
    last = key;
    X4.native.setHit(all, rects);
  }

  /* cheap: runs at most once per frame, and does nothing at all while no site is open */
  function refresh() {
    if (raf) return;
    raf = requestAnimationFrame(compute);
  }

  function setSite(on) {
    on = !!on;
    if (on === site) { refresh(); return; }
    site = on;
    document.documentElement.classList.toggle('site-on', on);
    last = '';
    clearInterval(iv);
    if (on) iv = setInterval(refresh, 300);       // safety net for animated elements
    compute();
  }

  function init() {
    try {
      new MutationObserver(function () { if (site) refresh(); })
        .observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-hidden', 'hidden'] });
    } catch (e) {}
    window.addEventListener('resize', refresh);
  }

  X4.hit = { setSite: setSite, refresh: refresh, init: init, isSite: function () { return site; } };
})();
