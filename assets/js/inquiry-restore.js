(function () {
  /* ------------------------------------------------------------------ *
   *  A visitor who filled the inquiry form but left without sending
   *  should not have to type everything again. The context is kept in
   *  local storage and offered back — quietly, in one line, dismissible.
   * ------------------------------------------------------------------ */
  var KEY = 'el-inquiry';
  var DAYS = 14;

  var bar = document.getElementById('resumeBar');
  var form = document.getElementById('inquiryForm');

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.at) return null;
      var age = (Date.now() - data.at) / 86400000;
      if (age > DAYS) { localStorage.removeItem(KEY); return null; }
      return data;
    } catch (e) { return null; }
  }

  function write(data) {
    try {
      data.at = Date.now();
      localStorage.setItem(KEY, JSON.stringify(data));
      /* a new inquiry deserves a new reminder */
      localStorage.removeItem(KEY + '-hidden');
    } catch (e) {}
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  /* ------------------------------------------------- fill the form back in */
  function restoreIntoForm(data) {
    if (!form) return;
    var set = function (name, value) {
      if (!value) return;
      var field = form.querySelector('[name="' + name + '"]');
      if (field && !field.value) field.value = value;
    };
    set('name', data.name);
    set('company', data.company);
    set('email', data.email);
    set('phone', data.phone);
    set('drawing', data.drawing);

    /* the candidate models — but only when the url did not bring its own */
    var chips = document.getElementById('modelChips');
    if (chips && data.models && data.models.length) {
      var existing = chips.querySelectorAll('.m-chip');
      if (!existing.length) {
        if (window.elAddModel) data.models.forEach(function (m) { window.elAddModel(m); });
      }
    }
  }

  /* ----------------------------------------------------- save on submit */
  if (form) {
    form.addEventListener('submit', function () {
      var f = new FormData(form);
      var models = [];
      var chips = document.querySelectorAll('#modelChips .m-chip');
      chips.forEach(function (c) {
        var b = c.querySelector('.m-chip-x');
        if (b) models.push(b.getAttribute('data-model'));
      });
      if (!models.length && f.get('product')) models.push(f.get('product'));
      var data = {
        name: (f.get('name') || '').trim(),
        company: (f.get('company') || '').trim(),
        email: (f.get('email') || '').trim(),
        phone: (f.get('phone') || '').trim(),
        drawing: (f.get('drawing') || '').trim(),
        message: (f.get('message') || '').trim(),
        models: models
      };
      var load = new URLSearchParams(window.location.search).get('load');
      if (load) data.load = load;
      var hz = new URLSearchParams(window.location.search).get('hz');
      if (hz) data.hz = hz;
      if (data.models.length || data.load || data.message) write(data);
    }, true);
  }

  /* -------------------------------------------------------- the reminder */
  if (!bar) return;
  var data = read();
  if (!data) return;
  if (!data.models || !data.models.length) { clear(); return; }

  var dismissed = false;
  try { dismissed = localStorage.getItem(KEY + '-hidden') === '1'; } catch (e) {}
  if (dismissed) return;

  var contactUrl = (document.documentElement.getAttribute('data-base') || '') + '/contact/';
  var T = bar.dataset;
  var label = T.msgModels || 'You were looking at';
  var first = data.models[0];
  var more = data.models.length > 1 ? ' +' + (data.models.length - 1) : '';
  var load = data.load ? ' · ' + data.load + ' kW' + (data.hz ? ' @ ' + data.hz + ' Hz' : '') : '';

  bar.innerHTML =
    '<div class="rb-inner">' +
    '<span class="rb-text">' + label + ' <b>' + first + more + '</b>' + load + '</span>' +
    '<a class="rb-link" href="' + contactUrl + '">' + (T.msgContinue || 'Continue the inquiry') + '</a>' +
    '<button type="button" class="rb-x" aria-label="' + (T.msgClose || 'Close') + '">&times;</button>' +
    '</div>';
  bar.hidden = false;

  bar.querySelector('.rb-x').addEventListener('click', function () {
    bar.hidden = true;
    try { localStorage.setItem(KEY + '-hidden', '1'); } catch (e) {}
  });

  if (form) restoreIntoForm(data);
})();
