(function () {
  var tables = document.querySelectorAll('.spec-table');
  if (!tables.length) return;

  tables.forEach(function (table) {
    var thead = table.querySelector('thead');
    var tbody = table.querySelector('tbody');
    if (!thead || !tbody) return;

    var headers = thead.querySelectorAll('th');
    var current = { col: -1, dir: 1 };

    function cellValue(row, index) {
      var cell = row.children[index];
      if (!cell) return '';
      var text = (cell.textContent || '').replace(/\s+/g, ' ').trim();
      var num = parseFloat(text.replace(/[^0-9.\-]/g, ''));
      var looksNumeric = /[0-9]/.test(text) && !/[A-Za-z\u4e00-\u9fa5]/.test(text.replace(/[0-9.,\-\s]/g, ''));
      return { text: text, num: looksNumeric && !isNaN(num) ? num : null };
    }

    function sort() {
      var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
      var col = current.col;
      rows.sort(function (a, b) {
        var va = cellValue(a, col);
        var vb = cellValue(b, col);
        if (va.num !== null && vb.num !== null) return (va.num - vb.num) * current.dir;
        return va.text.localeCompare(vb.text) * current.dir;
      });
      rows.forEach(function (r) { tbody.appendChild(r); });
    }

    headers.forEach(function (th, index) {
      if (!th.textContent.trim()) return;
      th.classList.add('is-sortable');
      th.setAttribute('role', 'button');
      th.setAttribute('tabindex', '0');
      th.title = th.title || 'Sort';
      var activate = function () {
        if (current.col === index) current.dir = -current.dir;
        else { current.col = index; current.dir = 1; }
        headers.forEach(function (h) { h.classList.remove('is-sorted-asc', 'is-sorted-desc'); });
        th.classList.add(current.dir === 1 ? 'is-sorted-asc' : 'is-sorted-desc');
        sort();
      };
      th.addEventListener('click', activate);
      th.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
    });
  });
})();
