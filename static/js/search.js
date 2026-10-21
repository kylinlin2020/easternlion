(function () {
  var input = document.getElementById('site-search');
  var panel = document.getElementById('searchResults');
  if (!input || !panel) return;

  var index = null;
  var loading = false;

  var STRINGS = {
    empty: panel.dataset.msgEmpty || '',
    loading: panel.dataset.msgLoading || '',
    results: panel.dataset.msgResults || '',
    all: panel.dataset.msgAll || ''
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
      .then(function (data) { index = data.items || []; })
      .catch(function () { index = []; })
      .then(function () { loading = false; });
  }

  function score(item, q) {
    var t = (item.t || '').toLowerCase();
    var d = (item.d || '').toLowerCase();
    var k = (item.k || '').toLowerCase();
    var c = (item.c || '').toLowerCase();
    if (t.indexOf(q) === 0) return 100;
    if (t.indexOf(q) > -1) return 70;
    if (k.indexOf(q) > -1) return 55;
    if (c.indexOf(q) > -1) return 40;
    if (d.indexOf(q) > -1) return 25;
    return 0;
  }

  function render(q) {
    if (!q) { panel.hidden = true; panel.innerHTML = ''; return; }
    var hits = index
      .map(function (i) { return { i: i, s: score(i, q) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 8);

    if (!hits.length) {
      panel.innerHTML = '<p class="sp-empty">' + esc(STRINGS.empty) + '</p>';
      panel.hidden = false;
      return;
    }

    var html = hits.map(function (h) {
      var it = h.i;
      var meta = [];
      if (it.k) meta.push(esc(it.k));
      if (it.h) meta.push(esc(it.h) + 'Hz');
      if (it.g) meta.push(esc(it.g) + '–' + esc(it.p) + ' kW');
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
