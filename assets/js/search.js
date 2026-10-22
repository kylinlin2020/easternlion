(function () {
  var input = document.getElementById('site-search');
  var panel = document.getElementById('searchResults');
  if (!input || !panel) return;

  var index = null;
  var guide = null;
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
    guide: panel.dataset.msgGuide || 'How to choose',
    guideMore: panel.dataset.msgGuideMore || 'Read the full guide',
    compare: panel.dataset.msgCompare || 'Compare',
    models: panel.dataset.msgModels || 'models',
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
        guide = data.guide || null;
        cats = data.cats || [];
      })
      .catch(function () { index = []; guide = null; cats = []; })
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
  /* ------------------------------------------------- the decision guide */
  var GUIDE_RE = /how\s+to|how\s+do\s+i|choose|choosing|which\s+one|select|selection|size|sizing|guide|\u9009\u578b|\u600e\u4e48\u9009|\u5982\u4f55\u9009|\u9009\u62e9|\u6307\u5357/;
  var CMP_RE = /\bvs\b|versus|\bdifference\b|\bcompare\b|\u5bf9\u6bd4|\u533a\u522b|\u6bd4\u8f83/;

  function guideBlock(item) {
    var g = guide;
    if (!g) return '';
    var html = '<div class="sp-guide">';
    html += '<div class="sp-guide-head"><span class="sp-guide-title">' + esc(g.title) + '</span>' +
      '<span class="sp-guide-intro">' + esc(g.intro) + '</span></div>';
    html += '<ul class="sp-guide-list">';
    (g.rows || []).forEach(function (row) {
      var value = row.v || '';
      if (row.g && item && item.gv && item.gv[row.g]) value = item.gv[row.g];
      html += '<li><b>' + esc(row.k) + '</b><span>' + esc(value) + '</span></li>';
    });
    html += '</ul>';
    if (item) {
      html += '<a class="sp-guide-link" href="' + esc(item.u) + '#how-to-choose">' + esc(STRINGS.guideMore) + ' →</a>';
    }
    html += '</div>';
    return html;
  }

  function compareBlock(items) {
    if (items.length < 2) return '';
    var html = '<div class="sp-compare"><div class="sp-compare-head">' + esc(STRINGS.compare) + '</div>';
    html += '<div class="sp-compare-cols">';
    items.slice(0, 2).forEach(function (it) {
      var range = (it.g || 0) + '–' + (it.p || 0) + ' kW';
      var models = (it.gv && it.gv.models) || 0;
      html += '<a class="sp-compare-col" href="' + esc(it.u) + '">' +
        '<b>' + esc(it.t) + '</b>' +
        '<span>' + esc(range) + ' · ' + (it.h || 50) + ' Hz</span>' +
        '<span>' + models + ' ' + esc(STRINGS.models) + '</span>' +
        '</a>';
    });
    html += '</div></div>';
    return html;
  }

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

    /* the guide answers "how do I choose" right in the dropdown */
    var guideHtml = '';
    if (text && GUIDE_RE.test(text) && guide) {
      var subject = null;
      var wantsGenset = /generator|genset|diesel|\u53d1\u7535\u673a|\u67f4\u6cb9/.test(text);
      var pool = hits.map(function (h) { return h.it; });
      if (wantsGenset) {
        for (var wi = 0; wi < pool.length; wi++) {
          if (pool[wi].gv && pool[wi].gv.kind === 'genset') { subject = pool[wi]; break; }
        }
      }
      if (!subject && pool.length) subject = pool[0];
      if (!subject && tHits.length) subject = tHits[0].i;      /* the best text match */
      if (!subject) {
        for (var gi = 0; gi < (index || []).length; gi++) {
          if (index[gi].gv && index[gi].gv.models) { subject = index[gi]; break; }
        }
      }
      guideHtml = guideBlock(subject);
    }

    /* "cummins vs perkins" becomes a side by side of the two series */
    var compare = '';
    if (text && CMP_RE.test(text)) {
      var words = text.split(/[^a-z0-9]+/).filter(function (w) {
        return w.length > 2 && !/vs|versus|and|the|difference|compare|best|between|for/.test(w);
      });
      var found = [];
      words.forEach(function (w) {
        if (found.length >= 2) return;
        for (var wi = 0; wi < index.length; wi++) {
          var it = index[wi];
          if (it.t.toLowerCase().indexOf(w) > -1 && found.indexOf(it) === -1) { found.push(it); break; }
        }
      });
      if (found.length < 2) {
        found = hits.map(function (h) { return h.i; }).slice(0, 2);
      }
      compare = compareBlock(found);
    }

    var catList = text ? catHits(text, nq) : [];
    if (catList.length) {
      html += '<div class="sp-cats"><span class="sp-cats-label">' + esc(STRINGS.cats) + '</span>' +
        catList.map(function (c) {
          return '<a class="sp-cat" href="' + esc(c.u) + '">' + esc(c.t) + '</a>';
        }).join('') + '</div>';
    }

    if (guideHtml || compare) {
      html = guideHtml + compare + html;
    }

    if (!hits.length && !tHits.length && !catList.length && !guideHtml && !compare) {
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
