(function () {
  var dataEl = document.getElementById('compareData');
  if (!dataEl) return;

  var series = [];
  try {
    var raw = (dataEl.textContent || '').trim();
    series = JSON.parse(raw);
    if (typeof series === 'string') series = JSON.parse(series);
  } catch (e) { return; }
  if (!Array.isArray(series) || !series.length) return;

  var T = {};
  var strEl = document.getElementById('compareStrings');
  if (strEl) {
    try {
      var s = JSON.parse((strEl.textContent || '').trim());
      if (typeof s === 'string') s = JSON.parse(s);
      T = s || {};
    } catch (e) { T = {}; }
  }
  function t(key, fallback) {
    var v = T[key];
    if (v === undefined || v === null || v === '') return fallback;
    return v;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* glyphs and button labels shared by every widget (see partial ui-data) */
  var ui = window.elUI || {};
  function uiIcon(name) { return ui.icon ? ui.icon(name) : ''; }
  function uiStr(name, fallback) { return ui.str ? ui.str(name, fallback) : fallback; }

  var byUrl = {};
  series.forEach(function (m) { byUrl[m.u] = m; });

  var selected = [];
  var MAX = 4;

  /* ---------------------------------------------------- the small badge */
  var badge = document.createElement('div');
  badge.className = 'compare-badge';
  badge.innerHTML =
    '<button type="button" class="cb-toggle" aria-expanded="false">' +
    uiIcon('menu') +
    '<span class="cb-count">0</span>' +
    '<span class="cb-label"></span>' +
    '</button>' +
    '<div class="compare-pop" hidden>' +
    '<div class="cp-head"></div>' +
    '<div class="cp-items"></div>' +
    '<div class="cp-actions">' +
    '<button type="button" class="btn btn-outline btn-sm cb-clear"></button>' +
    '<button type="button" class="btn btn-primary btn-sm cb-open"></button>' +
    '</div>' +
    '</div>';
  document.body.appendChild(badge);

  var pop = badge.querySelector('.compare-pop');
  var toggle = badge.querySelector('.cb-toggle');
  var countEl = badge.querySelector('.cb-count');
  var labelEl = badge.querySelector('.cb-label');
  var itemsEl = badge.querySelector('.cp-items');
  var headEl = badge.querySelector('.cp-head');
  var openBtn = badge.querySelector('.cb-open');
  var clearBtn = badge.querySelector('.cb-clear');

  headEl.textContent = t('title', 'Model comparison');
  clearBtn.textContent = t('clear', 'Clear');

  /* -------------------------------------------------------- the dialog */
  var modal = document.createElement('div');
  modal.className = 'compare-modal';
  modal.innerHTML =
    '<div class="cm-backdrop"></div>' +
    '<div class="cm-panel" role="dialog" aria-modal="true" aria-label="' + esc(uiStr('title', 'Model comparison')) + '">' +
    '<button type="button" class="cm-close" aria-label="' + esc(uiStr('close', 'Close')) + '">' +
    uiIcon('close') +
    '</button>' +
    '<div class="cm-body"></div>' +
    '</div>';
  document.body.appendChild(modal);

  function render() {
    countEl.textContent = selected.length;
    labelEl.textContent = selected.length ? t('selected', 'selected') : '';
    badge.classList.toggle('is-open', selected.length > 0);
    document.body.classList.toggle('has-compare', selected.length > 0);

    itemsEl.innerHTML = selected.map(function (m) {
      return '<span class="cp-item">' +
        '<img src="' + m.i + '" alt="">' +
        '<span class="cp-name">' + esc(m.t) + '</span>' +
        '<button type="button" class="cp-x" data-url="' + esc(m.u) + '" aria-label="' + esc(uiStr('remove', 'Remove')) + '">&times;</button>' +
        '</span>';
    }).join('');

    openBtn.disabled = selected.length < 2;
    openBtn.textContent = selected.length < 2
      ? t('compare', 'Compare') + ' (' + selected.length + ')'
      : t('compare', 'Compare') + ' ' + selected.length + ' ' + t('models', 'models');
  }

  function togglePop(force) {
    var open = force !== undefined ? force : pop.hidden;
    pop.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function toggleModel(url) {
    var m = byUrl[url];
    if (!m) return;
    var i = selected.findIndex(function (s) { return s.u === url; });
    if (i > -1) selected.splice(i, 1);
    else {
      if (selected.length >= MAX) selected.shift();
      selected.push(m);
    }
    document.querySelectorAll('.product-card').forEach(function (c) {
      var on = selected.some(function (s) { return s.u === c.getAttribute('data-url'); });
      c.classList.toggle('is-compared', on);
      var b = c.querySelector('.js-compare');
      if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    render();
    if (!selected.length) togglePop(false);
  }

  function clearAll() {
    selected = [];
    document.querySelectorAll('.product-card').forEach(function (c) {
      c.classList.remove('is-compared');
      var b = c.querySelector('.js-compare');
      if (b) b.setAttribute('aria-pressed', 'false');
    });
    render();
    togglePop(false);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.js-compare');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      toggleModel(btn.getAttribute('data-url'));
      return;
    }
    var x = e.target.closest('.cp-x');
    if (x) { e.preventDefault(); toggleModel(x.getAttribute('data-url')); return; }
    if (e.target.closest('.cb-clear')) { clearAll(); return; }
    if (e.target.closest('.cb-open')) { openModal(); togglePop(false); return; }
    if (e.target.closest('.cb-toggle')) { togglePop(); return; }
    if (e.target.closest('.cm-close') || e.target.closest('.cm-backdrop')) { closeModal(); return; }
    if (!badge.contains(e.target)) togglePop(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (modal.classList.contains('is-open')) { closeModal(); return; }
      if (!pop.hidden) { togglePop(false); return; }
    }
  });

  var ROWS = [
    { k: 'g', t: 'power', f: function (m) { return m.g + ' – ' + m.p + ' kW'; } },
    { k: 'h', t: 'freq', f: function (m) { return m.h + ' Hz'; } },
    { k: 'n', t: 'count', f: function (m) { return m.n; } },
    { k: 'e', t: 'engine', f: function (m) { return m.e; } },
    { k: 'a', t: 'alternator', f: function (m) { return m.a; } },
    { k: 'c', t: 'controller', f: function (m) { return m.c; } },
  ];

  var ROW_FALLBACK = {
    power: 'Power range', freq: 'Frequency', count: 'Models',
    engine: 'Engine', alternator: 'Alternator', controller: 'Controller'
  };

  function openModal() {
    if (selected.length < 2) return;
    var body = modal.querySelector('.cm-body');
    var html = '<table class="cm-table"><thead><tr><th></th>';
    selected.forEach(function (m) {
      html += '<th><img src="' + m.i + '" alt=""><a href="' + m.u + '">' + esc(m.t) + '</a></th>';
    });
    html += '</tr></thead><tbody>';
    ROWS.forEach(function (r) {
      html += '<tr><th>' + t(r.t, ROW_FALLBACK[r.t]) + '</th>';
      selected.forEach(function (m) { html += '<td>' + r.f(m) + '</td>'; });
      html += '</tr>';
    });
    html += '<tr><th></th>';
    selected.forEach(function (m) {
      html += '<td><a class="btn btn-outline btn-sm" href="' + m.u + '">' + esc(t('open', 'Open')) + '</a></td>';
    });
    html += '</tr></tbody></table>';

    /* ask for a quote for every series that is on the table */
    var names = selected.map(function (m) { return m.t; }).join(',');
    var label = t('quote', 'Request a quote for these {n} models').replace('{n}', selected.length);
    html += '<div class="cm-foot">' +
      '<a class="btn btn-primary" href="' + esc(t('quote_url', '/contact/') + '?models=' + encodeURIComponent(names)) + '">' +
      esc(label) +
      '</a></div>';

    body.innerHTML = html;
    modal.querySelector('.cm-panel').setAttribute('aria-label', t('title', 'Model comparison'));
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  render();
})();
