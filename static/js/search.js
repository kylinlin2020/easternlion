(function () {
  var input = document.getElementById('site-search');
  var panel = document.getElementById('searchResults');
  if (!input || !panel) return;

  var index = null;
  var cats = [];
  var loading = false;

  var STRINGS = {
    empty: panel.dataset.msgEmpty || '',
    all: panel.dataset.msgAll || '',
    cats: panel.dataset.msgCats || ''
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function load() {
    if (index || loading) return Promise.resolve();
    loading = true;
    var base = document.documentElement.getAttribute('data-base') || '';
    return fetch(base + '/search-index.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        index = data.items || [];
        cats = data.cats || [];
      })
      .catch(function () { index = []; cats = []; })
      .then(function () { loading = false; });
  }

  /* normalise: lower case, drop spaces and dashes so that "gfs w33",
     "gfs-w33" and "GFSW33" all match */
  function norm(s) {
    return String(s).toLowerCase().replace(/[\s\-_/]/g, '');
  }

  function score(item, q, nq) {
    var t = (item.t || '').toLowerCase();
    var d = (item.d || '').toLowerCase();
    var k = (item.k || '').toLowerCase();
    var c = (item.c || '').toLowerCase();

    if (t.indexOf(q) === 0) return 120;
    if (t.indexOf(q) > -1) return 90;
    if (k.indexOf(q) > -1) return 70;
    if (c.indexOf(q) > -1) return 55;
    if (d.indexOf(q) > -1) return 35;

    /* model numbers, e.g. GFS-W33 */
    var models = item.m || [];
    for (var i = 0; i < models.length; i++) {
      var m = models[i];
      if (!m) continue;
      var ml = m.toLowerCase();
      if (ml.indexOf(q) === 0) return 80;
      if (ml.indexOf(q) > -1) return 60;
      if (norm(m).indexOf(nq) > -1) return 50;
    }
    return 0;
  }

  function catHits(q, nq) {
    var out = [];
    for (var i = 0; i < cats.length; i++) {
      var c = cats[i];
      var hay = ((c.t || '') + ' ' + (c.k || '') + ' ' + (c.d || '')).toLowerCase();
      if (hay.indexOf(q) > -1 || norm(c.t).indexOf(nq) > -1) out.push(c);
    }
    return out.slice(0, 5);
  }

  function render(q) {
    if (!q) { panel.hidden = true; panel.innerHTML = ''; return; }
    var nq = norm(q);

    var hits = index
      .map(function (i) { return { i: i, s: score(i, q, nq) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 8);

    var catList = catHits(q, nq);
    var html = '';

    /* category shortcuts */
    if (catList.length) {
      html += '<div class="sp-cats"><span class="sp-cats-label">' + esc(STRINGS.cats) + '</span>' +
        catList.map(function (c) {
          return '<a class="sp-cat" href="' + esc(c.u) + '">' + esc(c.t) + '</a>';
        }).join('') + '</div>';
    }

    if (!hits.length) {
      var base = document.documentElement.getAttribute('data-base') || '';
      var links = (cats || []).slice(0, 4).map(function (c) {
        return '<a class="sp-cat" href="' + esc(c.u) + '">' + esc(c.t) + '</a>';
      }).join('');
      panel.innerHTML = html + '<p class="sp-empty">' + esc(STRINGS.empty) + '</p>' +
        (links ? '<div class="sp-empty-links"><span>' + esc(STRINGS.cats) + '</span>' + links + '</div>' : '');
      panel.hidden = false;
      return;
    }

    html += hits.map(function (h) {
      var it = h.i;
      var meta = [];
      if (it.k) meta.push(esc(it.k));
      if (it.h) meta.push(esc(it.h) + 'Hz');
      if (it.g) meta.push(esc(it.g) + '–' + esc(it.p) + ' kW');

      /* show the matching model when the hit came from a model number */
      var model = '';
      if (it.m && it.m.length) {
        for (var i = 0; i < it.m.length; i++) {
          var m = it.m[i];
          if (!m) continue;
          if (m.toLowerCase().indexOf(q) > -1 || norm(m).indexOf(nq) > -1) { model = m; break; }
        }
      }
      if (model) meta.push(esc(model));

      return '<a class="sp-item" href="' + esc(it.u) + '">' +
        '<span class="sp-t">' + esc(it.t) + '</span>' +
        (meta.length ? '<span class="sp-m">' + meta.join(' · ') + '</span>' : '') +
        (it.d ? '<span class="sp-d">' + esc(it.d) + '</span>' : '') +
        '</a>';
    }).join('');

    panel.innerHTML = html + '<a class="sp-all" href="' + (document.documentElement.getAttribute('data-base') || '') + '/products/?q=' + encodeURIComponent(q) + '">' + esc(STRINGS.all) + ' →</a>';
    panel.hidden = false;
  }

  var timer = null;
  input.addEventListener('input', function () {
    var q = input.value.trim().toLowerCase();
    clearTimeout(timer);
    if (!q) { panel.hidden = true; return; }
    timer = setTimeout(function () {
      load().then(function () { render(q); });
    }, 160);
  });

  input.addEventListener('focus', function () {
    if (input.value.trim()) load().then(function () { render(input.value.trim().toLowerCase()); });
  });

  document.addEventListener('click', function (e) {
    if (!panel.contains(e.target) && e.target !== input) panel.hidden = true;
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { panel.hidden = true; input.blur(); }
  });
})();
