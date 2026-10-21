(function () {
  var input = document.getElementById('site-search');
  var panel = document.getElementById('searchResults');
  if (!input || !panel) return;

  var index = null;
  var cats = [];
  var loading = false;
  var active = -1;

  var STRINGS = {
    empty: panel.dataset.msgEmpty || '',
    all: panel.dataset.msgAll || '',
    cats: panel.dataset.msgCats || '',
    model: panel.dataset.msgModel || '',
    spec: panel.dataset.msgSpec || '',
    specNone: panel.dataset.msgSpecNone || '',
    standby: panel.dataset.msgStandby || '',
    prime: panel.dataset.msgPrime || '',
    output: panel.dataset.msgOutput || ''
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

  /* ------------------------------------------------------------ spec query */
  /* "200kw", "200 kW 60Hz", "60hz" -> { kw: 200, hz: 60, text: "..." } */
  function parseSpec(q) {
    var text = q;
    var kw = 0;
    var hz = 0;
    var m = text.match(/(\d+(?:[.,]\d+)?)\s*(kw|kva)\b/i);
    if (m) {
      kw = parseFloat(m[1].replace(',', '.'));
      text = text.replace(m[0], ' ');
    }
    m = text.match(/(\d+)\s*hz\b/i);
    if (m) {
      hz = parseInt(m[1], 10);
      text = text.replace(m[0], ' ');
    }
    return { kw: kw, hz: hz, text: text.replace(/\s+/g, ' ').trim() };
  }

  /* the capacity of a model row {n: name, p: prime, s: standby, a: 50Hz, b: 60Hz} */
  function capAt(m, freq) {
    var k50 = m.a || 0;
    var k60 = m.b || 0;
    if (k50 || k60) return freq === 60 ? (k60 || k50) : (k50 || k60);
    return m.s || m.p || 0;
  }

  function specLabel(m) {
    if (m.a || m.b) return STRINGS.output;
    if (m.s) return STRINGS.standby;
    return STRINGS.prime;
  }

  /* every model that covers the requested power */
  function specHits(kw, hz) {
    var out = [];
    (index || []).forEach(function (it) {
      if (hz && it.h && it.h !== hz) return;
      (it.mm || []).forEach(function (m) {
        var cap = capAt(m, hz || it.h || 50);
        if (!cap || cap < kw) return;
        out.push({ it: it, m: m, cap: cap, hz: hz || it.h || 50 });
      });
    });
    out.sort(function (a, b) {
      if (a.cap !== b.cap) return a.cap - b.cap;
      return a.it.t < b.it.t ? -1 : 1;
    });
    return out;
  }

  /* ------------------------------------------------------------ text search */
  function score(item, q, nq) {
    var t = (item.t || '').toLowerCase();
    var d = (item.d || '').toLowerCase();
    var k = (item.k || '').toLowerCase();
    var c = (item.c || '').toLowerCase();

    if (t.indexOf(q) === 0) return 120;
    if (t.indexOf(q) > -1) return 90;
    if (k.indexOf(q) > -1) return 55;
    if (c.indexOf(q) > -1) return 50;
    if (d.indexOf(q) > -1) return 35;

    /* model numbers, e.g. GFS-W33 */
    var models = item.mm || [];
    for (var i = 0; i < models.length; i++) {
      var m = (models[i].n || '').toLowerCase();
      if (!m) continue;
      if (m.indexOf(q) === 0) return 80;
      if (m.indexOf(q) > -1) return 60;
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

  /* ---------------------------------------------------------------- render */
  function render(q) {
    if (!q) { panel.hidden = true; panel.innerHTML = ''; return; }
    var spec = parseSpec(q);
    var text = spec.text.toLowerCase();
    var nq = norm(spec.text);

    var html = '';

    /* 1. the models that cover the requested power */
    var hits = [];
    if (spec.kw > 0) hits = specHits(spec.kw, spec.hz);
    if (hits.length) {
      var label = STRINGS.spec
        .replace('{kw}', spec.kw)
        .replace('{hz}', spec.hz || 50);
      html += '<div class="sp-spec"><span class="sp-spec-label">' + esc(label) + '</span>';
      hits.slice(0, 8).forEach(function (h) {
        var href = h.it.u + '#model-' + encodeURIComponent(h.m.n);
        html += '<a class="sp-spec-item" href="' + esc(href) + '">' +
          '<span class="sp-t">' + esc(h.m.n) + '</span>' +
          '<span class="sp-m">' + h.cap + ' kW ' + esc(specLabel(h.m)) + '</span>' +
          '<span class="sp-s">' + esc(h.it.t) + '</span>' +
          '</a>';
      });
      if (hits.length > 8) {
        var base = document.documentElement.getAttribute('data-base') || '';
        html += '<a class="sp-all" href="' + esc(base + '/products/?q=' + encodeURIComponent(q)) + '">' +
          esc(STRINGS.all) + ' (' + hits.length + ') →</a>';
      }
      html += '</div>';
    } else if (spec.kw > 0) {
      html += '<div class="sp-spec"><span class="sp-spec-label">' + esc(STRINGS.specNone.replace('{kw}', spec.kw)) + '</span></div>';
    }

    /* 2. the text matches */
    var tHits = [];
    if (text) {
      tHits = index
        .map(function (i) { return { i: i, s: score(i, text, nq) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .slice(0, 6);
    }

    var catList = text ? catHits(text, nq) : [];
    if (catList.length) {
      html += '<div class="sp-cats"><span class="sp-cats-label">' + esc(STRINGS.cats) + '</span>' +
        catList.map(function (c) {
          return '<a class="sp-cat" href="' + esc(c.u) + '">' + esc(c.t) + '</a>';
        }).join('') + '</div>';
    }

    if (!hits.length && !tHits.length && !catList.length) {
      var links = (cats || []).slice(0, 4).map(function (c) {
        return '<a class="sp-cat" href="' + esc(c.u) + '">' + esc(c.t) + '</a>';
      }).join('');
      panel.innerHTML = html + '<p class="sp-empty">' + esc(STRINGS.empty) + '</p>' +
        (links ? '<div class="sp-empty-links"><span>' + esc(STRINGS.cats) + '</span>' + links + '</div>' : '');
      panel.hidden = false;
      return;
    }

    html += tHits.map(function (h) {
      var it = h.i;
      var meta = [];
      if (it.k) meta.push(esc(it.k));
      if (it.h) meta.push(esc(it.h) + 'Hz');
      if (it.g) meta.push(esc(it.g) + '–' + esc(it.p) + ' kW');

      /* show the matching model when the hit came from a model number */
      var model = '';
      var models = it.mm || [];
      for (var i = 0; i < models.length; i++) {
        var m = (models[i].n || '').toLowerCase();
        if (!m) continue;
        if (m.indexOf(text) > -1 || norm(m).indexOf(nq) > -1) { model = models[i].n; break; }
      }
      if (model) meta.push(esc(model));

      return '<a class="sp-item" href="' + esc(it.u) + '">' +
        '<span class="sp-t">' + esc(it.t) + '</span>' +
        (meta.length ? '<span class="sp-m">' + meta.join('  ·  ') + '</span>' : '') +
        (it.d ? '<span class="sp-d">' + esc(it.d) + '</span>' : '') +
        '</a>';
    }).join('');

    if (text) {
      html += '<a class="sp-all" href="' + (document.documentElement.getAttribute('data-base') || '') + '/products/?q=' + encodeURIComponent(q) + '">' + esc(STRINGS.all) + ' →</a>';
    }

    panel.innerHTML = html;
    panel.hidden = false;
    setActive(-1);
  }

  /* ------------------------------------------------------- keyboard support */
  function options() {
    return panel.querySelectorAll('a[href]');
  }

  function setActive(i) {
    var list = options();
    if (active > -1 && list[active]) list[active].classList.remove('is-active');
    active = i;
    if (list[active]) {
      list[active].classList.add('is-active');
      list[active].scrollIntoView({ block: 'nearest' });
    }
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
    if (e.key === 'Escape') { panel.hidden = true; input.blur(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      var list = options();
      if (!list.length) return;
      e.preventDefault();
      var next = active + (e.key === 'ArrowDown' ? 1 : -1);
      if (next < 0) next = list.length - 1;
      if (next >= list.length) next = 0;
      setActive(next);
      return;
    }
    if (e.key === 'Enter' && active > -1) {
      var list2 = options();
      if (list2[active]) {
        e.preventDefault();
        window.location.href = list2[active].getAttribute('href');
      }
    }
  });
})();
