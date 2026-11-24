/* X4 SKINS 18 MAX — emblem.js : the "shield" effect.
   A glass emblem grows from the centre, expands until it frosts the whole screen, then the frost clears.
   The same engine is used with other shapes (update arrow now; 18 MAX badge and logos in later phases). */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});

  /* shapes live in a 100 x 120 box */
  var SHAPES = {
    shield: {
      path: 'M50 5 L90 17 V57 C90 85 71 104 50 115 C29 104 10 85 10 57 V17 Z',
      core: '<rect x="43" y="40" width="14" height="36" rx="4"/>',
      tabs: '<rect x="44" y="1" width="12" height="9" rx="3" fill="#7fd0ff"/><rect x="44" y="110" width="12" height="9" rx="3" fill="#7fd0ff"/>'
    },
    max18: {
      path: 'M22 12 H78 L95 29 V91 L78 108 H22 L5 91 V29 Z',
      core: '<text x="50" y="68" text-anchor="middle" font-family="Archivo Black, Impact, sans-serif" font-size="44">18</text>' +
            '<text x="50" y="91" text-anchor="middle" font-family="Archivo Black, Impact, sans-serif" font-size="18" letter-spacing="3">MAX</text>',
      tabs: '<rect x="40" y="5" width="20" height="5" rx="2.5" fill="#7fd0ff"/><rect x="40" y="110" width="20" height="5" rx="2.5" fill="#7fd0ff"/>'
    },
    update: {
      path: 'M50 6 L90 30 V84 L50 114 L10 84 V30 Z',
      core: '<path d="M50 34 L69 58 H56 V86 H44 V58 H31 Z"/>',
      tabs: ''
    }
  };

  var defsReady = false;
  function ensureDefs() {
    if (defsReady) return;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
    var html = '<defs>';
    Object.keys(SHAPES).forEach(function (k) {
      html += '<clipPath id="clip-' + k + '" clipPathUnits="objectBoundingBox"><path transform="scale(0.01 0.008333)" d="' + SHAPES[k].path + '"/></clipPath>';
    });
    svg.innerHTML = html + '</defs>';
    document.body.appendChild(svg);
    defsReady = true;
  }

  function miniSvg(name, size) {
    var S = SHAPES[name] || SHAPES.shield;
    return '<svg viewBox="0 0 100 120" width="' + size + '" height="' + (size * 1.2) + '" aria-hidden="true">' +
      '<defs><linearGradient id="mg-' + name + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8f8ff"/><stop offset=".5" stop-color="#58c0ff"/><stop offset="1" stop-color="#1a6dff"/></linearGradient></defs>' +
      '<path d="' + S.path + '" fill="rgba(60,150,255,.18)" stroke="url(#mg-' + name + ')" stroke-width="5" stroke-linejoin="round"/>' +
      '<g fill="#eaf8ff">' + S.core + '</g></svg>';
  }

  var playing = false, chain = Promise.resolve(), queued = 0;

  /* play(shapeName, { onPeak }) → resolves when the frost has fully cleared.
     Calls are queued so two effects never fight over the same layer. */
  function play(name, o) {
    queued++;
    var p = chain.then(function () { return run(name, o); });
    chain = p.catch(function () {}).then(function () { queued--; });
    return p;
  }

  function run(name, o) {
    o = o || {};
    ensureDefs();
    var S = SHAPES[name] || SHAPES.shield;
    var L = X4.$('#emblem-layer'), frost = X4.$('.em-frost', L), shape = X4.$('.em-shape', L),
        glass = X4.$('.em-glass', L), rim = X4.$('.em-rim', L), core = X4.$('.em-core', L), sheen = X4.$('.em-sheen', L);
    var low = X4.perf.low, anims = [];

    rim.innerHTML = '<defs><linearGradient id="emg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1fbff"/><stop offset=".45" stop-color="#5cc4ff"/><stop offset="1" stop-color="#1a6dff"/></linearGradient></defs>' +
      '<path d="' + S.path + '" fill="none" stroke="url(#emg)" stroke-width="3.6" stroke-linejoin="round"/>' + S.tabs;
    core.innerHTML = '<svg viewBox="0 0 100 120"><g fill="#eaf8ff">' + S.core + '</g></svg>';
    glass.style.clipPath = 'url(#clip-' + (SHAPES[name] ? name : 'shield') + ')';
    glass.style.webkitClipPath = glass.style.clipPath;

    function an(el, kf, opt) { var a = el.animate(kf, opt); anims.push(a); return a.finished.catch(function () {}); }

    playing = true;
    L.classList.add('on');
    shape.style.opacity = '0';
    frost.style.opacity = '0';

    /* 1) the emblem grows out of the centre (like the reference shield) */
    var grow = an(shape, [
      { transform: 'scale(.12) rotateY(-75deg)', opacity: 0 },
      { transform: 'scale(1.09) rotateY(10deg)', opacity: 1, offset: 0.7 },
      { transform: 'scale(1) rotateY(0deg)', opacity: 1 }
    ], { duration: 900, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'forwards' });
    an(frost, [{ opacity: 0 }, { opacity: 0.35 }], { duration: 900, fill: 'forwards' });

    return grow.then(function () {
      /* 2) short hold: light sweeps over the glass, emblem breathes */
      an(sheen, [{ transform: 'translateX(-260%) skewX(-20deg)' }, { transform: 'translateX(260%) skewX(-20deg)' }], { duration: 650, easing: 'ease-in-out' });
      return an(shape, [{ transform: 'scale(1) rotateY(0deg)' }, { transform: 'scale(1.05) rotateY(-6deg)' }, { transform: 'scale(1) rotateY(0deg)' }],
        { duration: 650, easing: 'ease-in-out', fill: 'forwards' });
    }).then(function () {
      /* 3) the emblem expands over the whole screen and frosts it */
      var p1 = an(shape, [
        { transform: 'scale(1) rotateY(0deg)', opacity: 1, offset: 0 },
        { transform: 'scale(6) rotateY(0deg)', opacity: 0.95, offset: 0.75 },
        { transform: 'scale(11) rotateY(0deg)', opacity: 0, offset: 1 }
      ], { duration: 900, easing: 'cubic-bezier(.6,0,.9,.5)', fill: 'forwards' });
      var p2 = an(frost, low
        ? [{ opacity: 0.35 }, { opacity: 1 }]
        : [{ opacity: 0.35, backdropFilter: 'blur(0px) saturate(1)' }, { opacity: 1, backdropFilter: 'blur(22px) saturate(1.5)' }],
        { duration: 900, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' });
      return Promise.all([p1, p2]);
    }).then(function () {
      if (o.onPeak) { try { o.onPeak(); } catch (e) { console.error(e); } }
      /* 4) frost clears, revealing whatever was prepared underneath */
      return an(frost, low
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [{ opacity: 1, backdropFilter: 'blur(22px) saturate(1.5)' }, { opacity: 0, backdropFilter: 'blur(0px) saturate(1)' }],
        { duration: 800, easing: 'ease-out', fill: 'forwards' });
    }).then(function () {
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      L.classList.remove('on');
      playing = false;
    });
  }

  X4.emblem = { play: play, mini: miniSvg, isPlaying: function () { return playing || queued > 0; } };
})();
