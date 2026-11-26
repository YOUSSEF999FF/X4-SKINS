/* X4 SKINS 18 MAX — router.js : animated page transitions + back stack */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});

  var R = (X4.router = new X4.Emitter());
  var screens = {}, cur = 'intro', stack = [], busy = false;

  R.init = function () {
    X4.$$('.screen').forEach(function (s) { screens[s.id.replace('screen-', '')] = s; });
    cur = 'intro';
  };
  R.cur = function () { return cur; };
  R.isBusy = function () { return busy; };
  R.canGoBack = function () { return stack.length > 0; };

  function sweep(dur, dir) {
    var sw = X4.$('#tx-sweep');
    sw.classList.add('on');
    var a = sw.animate([{ transform: 'translateX(' + (-115 * dir) + '%)', opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.75 }, { transform: 'translateX(' + (115 * dir) + '%)', opacity: 0 }],
      { duration: dur, easing: 'cubic-bezier(.45,.05,.3,1)' });
    return a.finished.catch(function () {}).then(function () { sw.classList.remove('on'); });
  }

  /* o: { back:true } for going backwards, { kind:'fade' } for the intro → home hand-over */
  function go(name, o) {
    o = o || {};
    if (busy || name === cur || !screens[name]) return Promise.resolve(false);
    if (X4.perf.lite) {                                  // LITE: instant page switch, no animation at all
      var f = screens[cur], prevL = cur;
      screens[name].classList.add('active');
      f.classList.remove('active');
      if (o.back) stack.pop(); else if (o.kind !== 'fade') stack.push(prevL);
      cur = name;
      R.emit('change', { from: prevL, to: name });
      return Promise.resolve(true);
    }
    busy = true;
    var from = screens[cur], to = screens[name], low = X4.perf.low;
    var rtl = document.documentElement.dir === 'rtl';
    var dir = (o.back ? -1 : 1) * (rtl ? -1 : 1);
    to.classList.add('active', 'entering');
    from.classList.add('leaving');
    var anims = [], fin = [];
    function an(el, kf, opt) { var a = el.animate(kf, opt); anims.push(a); fin.push(a.finished.catch(function () {})); }
    var blur = function (px) { return low ? 'none' : 'blur(' + px + 'px)'; };

    if (o.kind === 'fade') {
      an(from, [{ opacity: 1, filter: 'none', transform: 'scale(1)' }, { opacity: 0, filter: blur(14), transform: 'scale(1.1)' }], { duration: 750, easing: 'ease-in', fill: 'forwards' });
      an(to, [{ opacity: 0, filter: blur(14), transform: 'scale(.94)' }, { opacity: 1, filter: 'none', transform: 'scale(1)' }], { duration: 950, delay: 300, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      fin.push(sweep(1100, 1));
    } else {
      an(from, [{ opacity: 1, filter: 'none', transform: 'translateX(0) scale(1)' }, { opacity: 0, filter: blur(10), transform: 'translateX(' + (-14 * dir) + '%) scale(.93)' }],
        { duration: 480, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' });
      an(to, [{ opacity: 0, filter: blur(10), transform: 'translateX(' + (16 * dir) + '%) scale(1.06)' }, { opacity: 1, filter: 'none', transform: 'translateX(0) scale(1)' }],
        { duration: 640, delay: 170, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      fin.push(sweep(760, dir));
    }

    var prev = cur;
    return Promise.all(fin).then(function () {
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      from.classList.remove('active', 'leaving');
      to.classList.remove('entering');
      if (o.back) stack.pop(); else if (o.kind !== 'fade') stack.push(prev);
      cur = name;
      busy = false;
      R.emit('change', { from: prev, to: name });
      return true;
    });
  }

  R.go = go;
  R.back = function () {
    if (!stack.length) return Promise.resolve(false);
    return go(stack[stack.length - 1], { back: true });
  };
})();
