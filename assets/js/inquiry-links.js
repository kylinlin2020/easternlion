(function () {
  /* ------------------------------------------------------------------ *
   *  The WhatsApp button carries the whole request: the series, the model
   *  the visitor is looking at, the power they need, the frequency and the
   *  page link. The inquiry button carries the same context into the form.
   * ------------------------------------------------------------------ */
  var wa = document.querySelector('.js-whatsapp');
  var inq = document.querySelector('.js-inquire');
  if (!wa && !inq) return;

  var T = {};
  var strEl = document.getElementById('waStrings');
  if (strEl) {
    try {
      var s = JSON.parse((strEl.textContent || '').trim());
      if (typeof s === 'string') s = JSON.parse(s);
      T = s || {};
    } catch (e) { T = {}; }
  }
  function t(k, fallback) { return T[k] || fallback; }

  var series = (wa && wa.getAttribute('data-series')) || '';
  var pageUrl = (wa && wa.getAttribute('data-url')) || window.location.href;
  var hz = parseInt((wa && wa.getAttribute('data-hz')) || '50', 10);

  /* the load the visitor asked for, if they came from the power finder */
  var params = new URLSearchParams(window.location.search);
  var wantedLoad = parseFloat(params.get('load') || '') || 0;
  if (params.get('hz')) hz = parseInt(params.get('hz'), 10);

  /* the model the visitor is looking at */
  function currentModel() {
    var h = (window.location.hash || '').replace(/^#/, '');
    if (h && document.getElementById(h)) return h;
    var sel = document.getElementById('modelJump');
    if (sel && sel.value && document.getElementById(sel.value)) return sel.value;
    return '';
  }

  /* the standby rating of that model, read out of the specification table */
  function modelPower(modelId) {
    if (!modelId) return 0;
    var row = document.getElementById(modelId);
    if (!row) return 0;
    var table = row.closest('table');
    if (!table) return 0;
    var head = table.querySelector('thead');
    if (!head) return 0;
    var rows = head.querySelectorAll('tr');
    var headers = rows[rows.length - 1].querySelectorAll('th');
    var index = -1;
    for (var i = 0; i < headers.length; i++) {
      var htxt = (headers[i].textContent || '').toLowerCase();
      if (htxt.indexOf('standby') > -1 || htxt.indexOf('output') > -1) { index = i; break; }
    }
    if (index < 0) return 0;
    var cell = row.children[index];
    if (!cell) return 0;
    var num = parseFloat((cell.textContent || '').replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : num;
  }

  function build() {
    var modelId = currentModel();
    var model = modelId ? modelId.replace(/^model-/, '') : '';
    var standby = modelPower(modelId);
    var load = wantedLoad || standby;

    var lines = [];
    lines.push(t('from', 'Inquiry from easternlion.cn'));
    if (series) lines.push(t('series', 'Series') + ': ' + series);
    if (model) lines.push(t('model', 'Model') + ': ' + model);
    if (load > 0) {
      lines.push(t('power', 'Required power') + ': ' + load + ' kW' + (hz ? ' @ ' + hz + ' Hz' : ''));
    }
    if (standby > 0 && standby !== load) {
      lines.push(t('standby', 'Standby rating') + ': ' + standby + ' kW');
    }
    lines.push(t('link', 'Link') + ': ' + pageUrl + (modelId ? '#' + modelId : ''));

    var text = lines.join('\n');

    if (wa) {
      var number = (wa.getAttribute('data-wa') || '').replace(/\D/g, '');
      wa.href = number ? 'https://wa.me/' + number + '?text=' + encodeURIComponent(text) : '#';
    }

    if (inq) {
      var q = 'product=' + encodeURIComponent(model || series);
      if (load > 0) q += '&load=' + encodeURIComponent(load) + '&hz=' + encodeURIComponent(hz);
      inq.href = inq.getAttribute('data-base') + '?' + q;
    }
  }

  window.addEventListener('hashchange', build);
  var sel = document.getElementById('modelJump');
  if (sel) sel.addEventListener('change', build);
  var nav = document.getElementById('modelNav');
  if (nav) nav.addEventListener('click', function () { setTimeout(build, 10); });

  build();
})();
