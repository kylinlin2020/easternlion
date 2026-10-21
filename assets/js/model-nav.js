(function () {
  /* the neighbour models of the model the visitor is looking at:
     the size below and the size above, so a buyer can weigh up
     the cheaper and the larger unit without leaving the page */
  var table = document.querySelector('.spec-table');
  var box = document.getElementById('modelNav');
  if (!table || !box) return;

  var tbody = table.querySelector('tbody');
  var thead = table.querySelector('thead');
  if (!tbody || !thead) return;

  /* the power column: the standby rating for a generator set,
     the output rating for an alternator */
  var headers = Array.prototype.slice.call(thead.querySelectorAll('tr')).pop().querySelectorAll('th');
  var col = -1;
  for (var i = 0; i < headers.length; i++) {
    var t = (headers[i].textContent || '').toLowerCase();
    if (!/kw/.test(t)) continue;
    if (/standby/.test(t)) { col = i; break; }
    if (col < 0) col = i;
  }
  if (col < 1) return;

  var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr')).map(function (tr) {
    var cells = tr.children;
    var name = (cells[0] ? cells[0].textContent : '').replace(/\s+/g, ' ').trim();
    var raw = cells[col] ? (cells[col].textContent || '') : '';
    var kw = parseFloat(raw.replace(/[^0-9.]/g, ''));
    return { id: tr.id, name: name, kw: isNaN(kw) ? 0 : kw, el: tr };
  }).filter(function (r) { return r.name; });

  if (rows.length < 2) return;

  var byKw = rows.slice().sort(function (a, b) { return a.kw - b.kw; });

  var STRINGS = {
    label: box.dataset.msgLabel || 'Neighbouring models',
    hint: box.dataset.msgHint || 'Pick a model in the table to see the sizes next to it.',
    current: box.dataset.msgCurrent || 'current',
    up: box.dataset.msgUp || 'larger',
    down: box.dataset.msgDown || 'smaller',
    same: box.dataset.msgSame || 'same power'
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function currentId() {
    var h = (window.location.hash || '').replace(/^#/, '');
    if (h && document.getElementById(h)) return h;
    var sel = document.getElementById('modelJump');
    if (sel && sel.value && document.getElementById(sel.value)) return sel.value;
    return '';
  }

  function render() {
    var id = currentId();
    var idx = -1;
    byKw.forEach(function (r, i) { if (r.id === id) idx = i; });

    if (idx < 0) {
      box.innerHTML = '<p class="mn-hint">' + esc(STRINGS.hint) + '</p>';
      return;
    }

    var cur = byKw[idx];
    var below = byKw[idx - 1];
    var above = byKw[idx + 1];

    var html = '<span class="mn-label">' + esc(STRINGS.label) + '</span>';

    if (below) {
      html += '<a class="mn-item mn-down" href="#' + esc(below.id) + '">' +
        '<span class="mn-dir">' + esc(below.kw < cur.kw ? STRINGS.down : (below.kw > cur.kw ? STRINGS.up : STRINGS.same)) + '</span>' +
        '<span class="mn-name">' + esc(below.name) + '</span>' +
        '<span class="mn-kw">' + below.kw + ' kW</span>' +
        '</a>';
    }

    html += '<span class="mn-item mn-current">' +
      '<span class="mn-dir">' + esc(STRINGS.current) + '</span>' +
      '<span class="mn-name">' + esc(cur.name) + '</span>' +
      '<span class="mn-kw">' + cur.kw + ' kW</span>' +
      '</span>';

    if (above) {
      html += '<a class="mn-item mn-up" href="#' + esc(above.id) + '">' +
        '<span class="mn-dir">' + esc(above.kw > cur.kw ? STRINGS.up : (above.kw < cur.kw ? STRINGS.down : STRINGS.same)) + '</span>' +
        '<span class="mn-name">' + esc(above.name) + '</span>' +
        '<span class="mn-kw">' + above.kw + ' kW</span>' +
        '</a>';
    }

    box.innerHTML = html;
    box.hidden = false;
  }

  /* clicking a neighbour scrolls to the row like the jump menu does */
  box.addEventListener('click', function (e) {
    var a = e.target.closest('.mn-item');
    if (!a || a.tagName !== 'A') return;
    e.preventDefault();
    var row = document.getElementById(a.getAttribute('href').slice(1));
    if (!row) return;
    history.replaceState(null, '', '#' + row.id);
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('is-hit');
    setTimeout(function () { row.classList.remove('is-hit'); }, 2200);
    render();
  });

  /* the jump menu drives the strip as well */
  var sel = document.getElementById('modelJump');
  if (sel) {
    sel.addEventListener('change', function () {
      if (!sel.value) return;
      history.replaceState(null, '', '#' + sel.value);
      render();
    });
  }

  window.addEventListener('hashchange', render);
  render();
})();
