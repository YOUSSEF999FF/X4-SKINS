/* X4 SKINS 18 MAX — config.js : remote JSON (GitHub) → last good copy → bundled copy */
(function () {
  'use strict';
  var X4 = (window.X4 = window.X4 || {});

  function base() { return (window.APP_CONFIG && window.APP_CONFIG.dataBase) || ''; }

  function fetchJson(url, timeout) {
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, timeout || 8000);
    return fetch(url, { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) { clearTimeout(to); return j; }, function (e) { clearTimeout(to); throw e; });
  }

  /* each validator returns true only if the file is safe for the app to use */
  var VALID = {
    gate: function (j) {
      return j && typeof j.hash === 'string' && j.hash.length > 20 && typeof j.salt === 'string' &&
        typeof j.iter === 'number' && j.iter >= 1000 && j.iter <= 2000000;
    },
    update: function (j) {
      return j && typeof j.latestVersion === 'string' && /^\d+(\.\d+){0,3}$/.test(j.latestVersion.trim());
    },
    start: function (j) {
      return j && Array.isArray(j.items);
    },
    explain: function (j) {
      return j && Array.isArray(j.items);
    },
    info: function (j) {
      return j && Array.isArray(j.items);
    }
  };

  /* an image named in a JSON file: a full https link, or a path inside the repo's data/ folder (e.g. "images/logo.png") */
  function asset(path) {
    if (!path || typeof path !== 'string') return '';
    path = path.trim();
    if (/^https:\/\//i.test(path)) return path;
    if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.indexOf('..') > -1) return '';      // no other schemes, no climbing out of data/
    return (base() || './data/') + path.replace(/^\.?\//, '');
  }

  /* returns { data, source } where source is 'remote' | 'cache' | 'bundled', or null */
  function load(name) {
    var ok = VALID[name] || function (j) { return !!j; };
    var cacheKey = 'x4_cfg_' + name;
    var remote = base() ? base() + name + '.json?_=' + Math.floor(Date.now() / 60000) : null;

    var step = remote
      ? fetchJson(remote).then(function (j) {
          if (!ok(j)) throw new Error('invalid');
          X4.store.set(cacheKey, JSON.stringify(j));
          return { data: j, source: 'remote' };
        })
      : Promise.reject(new Error('no remote'));

    return step
      .catch(function () {
        var c = null;
        try { c = JSON.parse(X4.store.get(cacheKey) || 'null'); } catch (e) {}
        if (c && ok(c)) return { data: c, source: 'cache' };
        throw new Error('no cache');
      })
      .catch(function () {
        return fetchJson('./data/' + name + '.json?_=' + Date.now(), 4000).then(function (j) {
          if (!ok(j)) throw new Error('invalid bundled');
          return { data: j, source: 'bundled' };
        });
      })
      .catch(function () { return null; });
  }

  X4.config = { load: load, base: base, asset: asset };
})();
