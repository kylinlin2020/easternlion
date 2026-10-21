(function () {
  var dataEl = document.getElementById('compareData');
  if (!dataEl) return;

  var models = [];
  try {
    var raw = (dataEl.textContent || '').trim();
    models = JSON.parse(raw);
    /* some templating engines double-encode the payload */
    if (typeof models === 'string') models = JSON.parse(models);
  } catch (e) { return; }
  if (!Array.isArray(models) || !models.length) return;

  var T = {};
  var strEl = document.getElementById('compareStrings');
  if (strEl) {
    try {
      var s = JSON.parse((strEl.textContent || '').trim());
      if (typeof s === 'string') s = JSON.parse(s);
      T = s || {};
    } catch (e) { T = {}; }
  }
  function t(key, fallback) { return T[key] || fallback; }

  var byUrl = {};
  models.forEach(function (m) { byUrl[m.u] = m; });

  var selected = [];
  var MAX = 4;

  /* ---------- bar ---------- */
  var bar = document.createElement('div');
  bar.className = 'compare-bar';
  bar.innerHTML =
    '<div class="cb-items"></div>' +
    '<div class="cb-actions">' +
    '<button type="button" class="btn btn-outline btn-sm cb-clear"></button>' +
    '<button type="button" class="btn btn-primary btn-sm cb-open"></button>' +
    '</div>';
  document.body.appendChild(bar);

  /* ---------- modal ---------- */
  var modal = document.createElement('div');
  modal.className = 'compare-modal';
  modal.innerHTML =
    '<div class="cm-backdrop"></div>' +
    '<div class="cm-panel" role="dialog" aria-modal="true" aria-label="Model comparison">' +
    '<button type="button" class="cm-close" aria-label="Close">' +
    '<svg viewBox="0 0 24 24"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4z"/></svg>' +
    '</button>' +
    '<div class="cm-body"></div>' +
    '</div>';
  document.body.appendChild(modal);

  var itemsEl = bar.querySelector('.cb-items');
  var openBtn = bar.querySelector('.cb-open');
  var clearBtn = bar.querySelector('.cb-clear');

  function render() {
    itemsEl.innerHTML = selected.map(function (m) {
      return '<span class="cb-chip" data-url="' + m.u + '">' +
        '<img src="' + m.i + '" alt="">' +
        '<span>' + m.t + '</span>' +
        '<button type="button" class="cb-x" data-url="' + m.u + '" aria-label="Remove">&times;</button>' +
        '</span>';
    }).join('');

    bar.classList.toggle('is-open', selected.length > 0);
    openBtn.disabled = selected.length < 2;
    openBtn.textContent = selected.length < 2
      ? t('compare', 'Compare') + ' (' + selected.length + ')'
      : t('compare', 'Compare') + ' ' + selected.length + ' ' + t('models', 'models');
  }

  function toggle(url) {
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
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.js-compare');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      toggle(btn.getAttribute('data-url'));
      return;
    }
    var x = e.target.closest('.cb-x');
    if (x) { e.preventDefault(); toggle(x.getAttribute('data-url')); return; }
    if (e.target.closest('.cb-clear')) { selected = []; toggleAll(); return; }
    if (e.target.closest('.cb-open')) { openModal(); return; }
    if (e.target.closest('.cm-close') || e.target.closest('.cm-backdrop')) { closeModal(); return; }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  function toggleAll() {
    document.querySelectorAll('.product-card').forEach(function (c) {
      c.classList.remove('is-compared');
      var b = c.querySelector('.js-compare');
      if (b) b.setAttribute('aria-pressed', 'false');
    });
    selected = [];
    render();
  }

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
      html += '<th><img src="' + m.i + '" alt=""><a href="' + m.u + '">' + m.t + '</a></th>';
    });
    html += '</tr></thead><tbody>';
    ROWS.forEach(function (r) {
      html += '<tr><th>' + t(r.t, ROW_FALLBACK[r.t]) + '</th>';
      selected.forEach(function (m) { html += '<td>' + r.f(m) + '</td>'; });
      html += '</tr>';
    });
    html += '<tr><th></th>';
    selected.forEach(function (m) {
      html += '<td><a class="btn btn-outline btn-sm" href="' + m.u + '">' + t('open', 'Open') + '</a></td>';
    });
    html += '</tr></tbody></table>';
    body.innerHTML = html;
    modal.querySelector('.cm-panel').setAttribute('aria-label', t('title', 'Model comparison'));
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  clearBtn.textContent = t('clear', 'Clear');
  render();
})();
