/* X4 SKINS 18 MAX — glyphs.js : small vector marks used when an item has no image of its own.
   Every glyph is drawn inside the 56 x 56 area (x 22..78, y 32..88) of the emblem box (100 x 120), in ice-white with
   dark-blue details, so the same markup works inside the shield effect AND as a flat icon on a button. */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});
  var D = '#0a2a6e';

  var G = {
    youtube: '<path d="M22 46Q22 39 29 38C40 36.6 60 36.6 71 38Q78 39 78 46V74Q78 81 71 82C60 83.4 40 83.4 29 82Q22 81 22 74Z"/>' +
             '<path d="M43 49L63 60L43 71Z" fill="' + D + '"/>',
    telegram: '<path d="M79 36L23 57Q19 59.5 24 61.5L38 66L44 83Q45.5 86 48 83.5L55 77L68 86Q72 88 73 83L81 43Q82 35 79 36Z"/>' +
              '<path d="M38 66L72 44L46 70L44.5 80Z" fill="' + D + '" opacity=".5"/>',
    whatsapp: '<path d="M50 33A26 26 0 1 1 37 82L25 86L29.5 74A26 26 0 0 1 50 33Z"/>' +
              '<path d="M41.5 47Q39 55 49 66Q59 76 68 73.5L69 68L62 64L58.5 67Q52 64 48.5 57.5L51.5 54L48 47Z" fill="' + D + '"/>',
    discord: '<path d="M31 40Q50 32 69 40Q78 56 77 78Q65 87 60 80L57 76H43L40 80Q35 87 23 78Q22 56 31 40Z"/>' +
             '<ellipse cx="41" cy="62" rx="5.4" ry="6.2" fill="' + D + '"/><ellipse cx="59" cy="62" rx="5.4" ry="6.2" fill="' + D + '"/>',
    website: '<g fill="none" stroke="#eaf8ff" stroke-width="4" stroke-linecap="round"><circle cx="50" cy="60" r="25"/>' +
             '<ellipse cx="50" cy="60" rx="10.5" ry="25"/><path d="M25 60H75M30.5 47H69.5M30.5 73H69.5"/></g>',
    bot: '<rect x="26" y="46" width="48" height="36" rx="11"/><path d="M50 46V37" stroke="#eaf8ff" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="34.5" r="4"/>' +
         '<circle cx="40" cy="62" r="5.2" fill="' + D + '"/><circle cx="60" cy="62" r="5.2" fill="' + D + '"/><rect x="41" y="72" width="18" height="3.6" rx="1.8" fill="' + D + '"/>' +
         '<rect x="21" y="56" width="5" height="14" rx="2.5"/><rect x="74" y="56" width="5" height="14" rx="2.5"/>',
    group: '<circle cx="39" cy="48" r="9"/><path d="M23 82Q23 63 39 63Q55 63 55 82Z"/><circle cx="62" cy="52" r="7.5" opacity=".85"/><path d="M52 82Q52 67 63 67Q77 67 77 82Z" opacity=".85"/>',
    channel: '<path d="M26 54H38L62 38V82L38 66H26Q22 66 22 62V58Q22 54 26 54Z"/><path d="M68 49Q76 60 68 71" fill="none" stroke="#eaf8ff" stroke-width="4" stroke-linecap="round"/>' +
             '<path d="M30 66L34 82H42L40 68Z"/>',
    play: '<path d="M38 38L72 60L38 82Z"/>',
    link: '<g fill="none" stroke="#eaf8ff" stroke-width="5" stroke-linecap="round"><path d="M45 55L55 45Q62 38 69 45Q76 52 69 59L63 65"/><path d="M55 65L45 75Q38 82 31 75Q24 68 31 61L37 55"/></g>'
  };

  function has(n) { return !!G[n]; }
  function get(n) { return G[n] || G.link; }

  /* flat icon for HTML buttons / tiles */
  function svg(name, size) {
    size = size || 28;
    return '<svg viewBox="20 32 60 56" width="' + size + '" height="' + Math.round(size * 56 / 60) + '" aria-hidden="true"><g fill="#eaf8ff">' + get(name) + '</g></svg>';
  }

  X4.glyphs = { has: has, get: get, svg: svg, names: Object.keys(G) };
})();
