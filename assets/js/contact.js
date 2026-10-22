(function () {
  var form = document.getElementById('inquiryForm');
  var success = document.getElementById('formSuccess');
  if (!form) return;

  var errorBox = document.getElementById('formError');
  var again = document.getElementById('formAgain');

  var MSG = {
    required: form.dataset.msgRequired || 'This field is required.',
    email: form.dataset.msgEmail || 'Please enter a valid e-mail address.',
    name: form.dataset.msgName || 'Please enter your name.',
    message: form.dataset.msgMsg || 'Please describe your requirement.'
  };

  /* ------------------------------------------------------------------ *
   *  the power finder and the comparison tool hand over the selection:
   *  ?product=MODEL&series=SERIES&load=KW&hz=HZ   or   ?models=A,B,C
   * ------------------------------------------------------------------ */
  var load = '';
  var hz = '';
  var matrix = document.getElementById('modelMatrix');
  var modelField = document.getElementById('modelField');
  var modelAdd = document.getElementById('modelAdd');
  var modelAddBtn = document.getElementById('modelAddBtn');
  var models = [];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------------------------------------------------- the model matrix */
  function rowHtml(model, loadValue, hzValue) {
    return '<div class="mm-row">' +
      '<input class="input mm-model" type="text" value="' + esc(model || '') + '" placeholder="' + esc(modelAdd ? modelAdd.placeholder : '') + '">' +
      '<input class="input mm-load" type="number" min="0" step="0.1" value="' + esc(loadValue || '') + '" placeholder="kW">' +
      '<select class="input mm-hz">' +
      '<option value="">–</option>' +
      '<option value="50"' + (String(hzValue) === '50' ? ' selected' : '') + '>50 Hz</option>' +
      '<option value="60"' + (String(hzValue) === '60' ? ' selected' : '') + '>60 Hz</option>' +
      '</select>' +
      '<button type="button" class="mm-x" aria-label="Remove">&times;</button>' +
      '</div>';
  }

  function addRow(model, loadValue, hzValue) {
    if (!matrix) return;
    var row = document.createElement('div');
    row.innerHTML = rowHtml(model, loadValue, hzValue);
    matrix.appendChild(row.firstChild);
    if (modelField) modelField.hidden = false;
  }

  /* the rows are the source of truth — the visitor can edit them */
  function readRows() {
    var out = [];
    if (!matrix) return out;
    matrix.querySelectorAll('.mm-row').forEach(function (row) {
      var model = (row.querySelector('.mm-model') || {}).value || '';
      var loadValue = (row.querySelector('.mm-load') || {}).value || '';
      var hzValue = (row.querySelector('.mm-hz') || {}).value || '';
      model = model.trim();
      loadValue = loadValue.trim();
      if (!model && !loadValue) return;
      out.push({ model: model, load: loadValue, hz: hzValue });
    });
    return out;
  }

  /* the restore script adds the saved models */
  window.elAddModel = function (m, loadValue, hzValue) { addRow(m, loadValue, hzValue); };

  if (matrix) {
    var q = new URLSearchParams(window.location.search);
    load = q.get('load') || '';
    hz = q.get('hz') || '';

    /* ?models=A:500:60,B:1000:50  (or the older ?models=A,B) */
    var list = q.get('models');
    if (list) {
      list.split(',').forEach(function (part) {
        var bits = part.split(':');
        addRow((bits[0] || '').trim(), bits[1] || '', bits[2] || '');
      });
    }
    var one = q.get('product');
    if (one) {
      var series = q.get('series');
      addRow(series ? one + ' (' + series + ')' : one, load, hz);
    }

    matrix.addEventListener('click', function (e) {
      var x = e.target.closest('.mm-x');
      if (!x) return;
      var row = x.closest('.mm-row');
      if (row) row.remove();
      if (!matrix.querySelector('.mm-row') && modelField) modelField.hidden = true;
    });

    if (modelAddBtn && modelAdd) {
      modelAddBtn.addEventListener('click', function () {
        var v = modelAdd.value.trim();
        if (!v) return;
        addRow(v, '', '');
        modelAdd.value = '';
        var rows = matrix.querySelectorAll('.mm-row');
        var last = rows[rows.length - 1];
        if (last) {
          var input = last.querySelector('.mm-model');
          if (input) input.focus();
        }
      });
      modelAdd.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          modelAddBtn.click();
        }
      });
    }
  }

  function setError(field, msg) {
    var box = field.parentNode.querySelector('.field-error');
    if (box) {
      box.textContent = msg || '';
      box.hidden = !msg;
    }
    field.classList.toggle('is-invalid', !!msg);
    field.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  function validate() {
    var ok = true;
    var first = null;

    form.querySelectorAll('[data-required]').forEach(function (field) {
      var v = (field.value || '').trim();
      var msg = '';
      if (!v) {
        msg = field.name === 'name' ? MSG.name : field.name === 'message' ? MSG.message : MSG.required;
      } else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        msg = MSG.email;
      }
      setError(field, msg);
      if (msg) {
        ok = false;
        if (!first) first = field;
      }
    });

    if (!ok && errorBox) {
      errorBox.textContent = MSG.required;
      errorBox.hidden = false;
      if (first) first.focus();
    } else if (errorBox) {
      errorBox.hidden = true;
    }
    return ok;
  }

  /* ------------------------------------------------------------- *
   *  the inquiry is assembled into a structured mail and shown to the
   *  visitor before it leaves — nothing is sent silently
   * ------------------------------------------------------------- */
  var L = {};
  var strEl = document.getElementById('inquiryStrings');
  if (strEl) {
    try {
      var parsed = JSON.parse((strEl.textContent || '').trim());
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      L = parsed || {};
    } catch (e) { L = {}; }
  }
  function l(key, fallback) { return L[key] || fallback; }

  var preview = document.getElementById('formPreview');
  var previewText = document.getElementById('previewText');
  var previewMail = document.getElementById('previewMail');
  var previewCopy = document.getElementById('previewCopy');
  var previewBack = document.getElementById('previewBack');
  var previewCopied = document.getElementById('previewCopied');
  var previewWhatsApp = document.getElementById('previewWhatsApp');
  var previewDownload = document.getElementById('previewDownload');
  var previewSend = document.getElementById('previewSend');
  var previewNotice = document.getElementById('previewNotice');
  var sentBody = document.getElementById('sentBody');
  var subject = '';

  /* the mail the sales team receives, mirrored in the page */
  var MAIL_LABELS = {
    en: {
      title: 'Generator set inquiry', series: 'Series', model: 'Model',
      power: 'Required power', drawing: 'Drawing / spec reference', message: 'Message',
      contact: 'Contact', name: 'Name', company: 'Company', phone: 'Phone / WhatsApp',
      email: 'E-mail', page: 'Page', reply: 'Reply to this mail reaches the visitor directly.'
    },
    zh: {
      title: '发电机组询价', series: '系列', model: '机型',
      power: '需求功率', drawing: '图纸 / 技术要求编号', message: '留言',
      contact: '联系方式', name: '姓名', company: '公司', phone: '电话 / WhatsApp',
      email: '邮箱', page: '来源页面', reply: '直接回复本邮件即可回复访客。'
    }
  };

  function renderMailPreview(data) {
    var box = document.getElementById('mailPreview');
    if (!box) return;
    var lang = data.lang === 'zh' ? 'zh' : 'en';
    var L = MAIL_LABELS[lang];
    var esc = function (s) {
      return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    };
    var rows = function (label, value) {
      if (!value) return '';
      return '<tr><th>' + esc(label) + '</th><td>' + esc(value) + '</td></tr>';
    };

    var machine = '';
    if (data.series) machine += rows(L.series, data.series);
    (data.models || []).forEach(function (m) {
      var bits = [m.model];
      if (m.load) bits.push(m.load + ' kW' + (m.hz ? ' @ ' + m.hz + ' Hz' : ''));
      machine += rows(L.model, bits.join(' — '));
    });
    var modelsHaveLoad = (data.models || []).some(function (m) { return m.load; });
    if (data.load && !modelsHaveLoad) {
      machine += rows(L.power, data.load + ' kW' + (data.hz ? ' @ ' + data.hz + ' Hz' : ''));
    }
    if (data.drawing) machine += rows(L.drawing, data.drawing);

    var contact = '';
    contact += rows(L.name, data.name);
    if (data.company) contact += rows(L.company, data.company);
    if (data.phone) contact += rows(L.phone, data.phone);
    contact += rows(L.email, data.email);
    if (data.page) contact += rows(L.page, data.page);

    var html = '<div class="mail-card">';
    html += '<div class="mail-head"><span class="mail-title">' + esc(L.title) + '</span>' +
      '<span class="mail-to">to sales@easternlion.cn</span></div>';
    if (machine) html += '<table class="mail-table">' + machine + '</table>';
    if (data.body) {
      html += '<h4 class="mail-h">' + esc(L.message) + '</h4>' +
        '<div class="mail-text">' + esc(data.body) + '</div>';
    }
    if (contact) html += '<h4 class="mail-h">' + esc(L.contact) + '</h4><table class="mail-table">' + contact + '</table>';
    html += '<p class="mail-reply">' + esc(L.reply) + '</p>';
    html += '</div>';
    box.innerHTML = html;
  }

  function assembleSubject() {
    var f = new FormData(form);
    var product = (f.get('product') || '').trim();
    var first = product || (models.length ? models[0] : '');
    return l('subject', 'Generator set inquiry') + (first ? ': ' + first : '');
  }

  function assemble() {
    var f = new FormData(form);
    var name = (f.get('name') || '').trim();
    var company = (f.get('company') || '').trim();
    var phone = (f.get('phone') || '').trim();
    var email = (f.get('email') || '').trim();
    var drawing = (f.get('drawing') || '').trim();
    var message = (f.get('message') || '').trim();
    var product = (f.get('product') || '').trim();

    var out = [];
    out.push(l('salutation', 'Dear Eastern Lion sales team,'));
    out.push('');
    out.push(l('interested', 'I am interested in the following generator set(s):'));
    out.push('');

    var modelRows = readRows();
    var rows = [];
    if (modelRows.length) {
      rows.push('  ' + l('model', 'Model') + ':');
      modelRows.forEach(function (r) {
        var line = '    - ' + r.model;
        if (r.load) line += '    ' + r.load + ' kW' + (r.hz ? ' @ ' + r.hz + ' Hz' : '');
        rows.push(line);
      });
    } else if (product) {
      rows.push('  ' + l('model', 'Model') + '    : ' + product);
      if (load) {
        rows.push('  ' + l('required_power', 'Required power') + ' : ' + load +
          ' kW' + (hz ? ' @ ' + hz + ' Hz' : ''));
      }
    }
    if (drawing) {
      rows.push('  ' + l('drawing', 'Drawing / spec reference') + ' : ' + drawing);
    }
    if (rows.length) {
      out.push(rows.join('\n'));
      out.push('');
    }

    if (message) {
      out.push(l('message', 'Message') + ':');
      out.push(message);
      out.push('');
    }

    out.push(l('contact', 'Contact'));
    out.push('  ' + l('name', 'Name') + '    : ' + name);
    if (company) out.push('  ' + l('company', 'Company') + ' : ' + company);
    if (phone) out.push('  ' + l('phone', 'Phone') + '       : ' + phone);
    out.push('  ' + l('email', 'E-mail') + '   : ' + email);
    out.push('');
    out.push('--');
    out.push(l('footer', 'Sent from easternlion.cn'));

    return out.join('\n');
  }

  /* the inquiry is sent to sales@easternlion.cn from the edge */
  function messageField() {
    var field = form.querySelector('[name="message"]');
    return field ? field.value.trim() : '';
  }

  function payload(body, message) {
    var f = new FormData(form);
    var models = readRows();
    return {
      body: message === undefined ? body : message,
      subject: subject,
      name: (f.get('name') || '').trim(),
      email: (f.get('email') || '').trim(),
      phone: (f.get('phone') || '').trim(),
      company: (f.get('company') || '').trim(),
      product: (f.get('product') || '').trim(),
      drawing: (f.get('drawing') || '').trim(),
      website: (f.get('website') || '').trim(),
      models: models,
      load: load,
      hz: hz,
      lang: (document.documentElement.getAttribute('lang') || 'en').slice(0, 5),
      page: window.location.href
    };
  }

  function postInquiry(body) {
    return fetch('/api/inquiry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload(body))
    }).then(function (r) {
      return r.json().then(function (d) { return !!(d && d.ok); }).catch(function () { return false; });
    }).catch(function () { return false; });
  }

  function sent(body) {
    if (preview) preview.hidden = true;
    form.hidden = true;
    if (sentBody) sentBody.textContent = body;
    if (success) {
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function failed(body) {
    if (previewText) previewText.value = body;
    if (preview) {
      preview.hidden = false;
      preview.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (previewNotice) {
      previewNotice.textContent = (preview.dataset.msgFailed || 'The inquiry could not be sent automatically.');
      previewNotice.hidden = false;
    }
  }

  function fillPreview(body, message) {
    if (previewText) previewText.value = message;
    if (previewWhatsApp) {
      var number = (form.dataset.whatsapp || '').replace(/\D/g, '');
      previewWhatsApp.href = number
        ? 'https://wa.me/' + number + '?text=' + encodeURIComponent(body)
        : '#';
      previewWhatsApp.hidden = !number;
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;

    subject = assembleSubject();
    var body = assemble();
    var message = messageField();
    fillPreview(body, message);
    renderMailPreview(payload(body, message));

    var button = document.getElementById('submitInquiry');
    if (button) {
      button.disabled = true;
      button.textContent = (button.dataset.sending || button.textContent);
    }

    postInquiry(body).then(function (ok) {
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.label || button.textContent;
      }
      if (ok) { sent(body); return; }
      failed(body);
    });
  });

  /* the send button of the preview panel */
  if (previewSend) {
    previewSend.addEventListener('click', function () {
      var body = assemble();
      var message = previewText ? previewText.value : messageField();
      subject = assembleSubject();
      renderMailPreview(payload(body, message));
      previewSend.disabled = true;
      postInquiry(body).then(function (ok) {
        previewSend.disabled = false;
        if (ok) { sent(body); return; }
        failed(body);
      });
    });
  }

  if (previewMail) {
    previewMail.addEventListener('click', function () {
      send(previewText ? previewText.value : assemble());
    });
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  if (previewCopy) {
    previewCopy.addEventListener('click', function () {
      var text = previewText ? previewText.value : '';
      if (!text) return;
      var done = function () {
        if (previewCopied) {
          previewCopied.hidden = false;
          setTimeout(function () { previewCopied.hidden = true; }, 2600);
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
      } else {
        fallbackCopy(text, done);
      }
    });
  }

  if (previewDownload) {
    previewDownload.addEventListener('click', function () {
      var text = previewText ? previewText.value : assemble();
      if (!text) return;
      var name = ((form.querySelector('[name="name"]') || {}).value || 'inquiry')
        .trim().replace(/[^\w\u4e00-\u9fa5.-]+/g, '-');
      var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'easternlion-inquiry-' + name + '.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  }

  if (previewBack) {
    previewBack.addEventListener('click', function () {
      if (preview) preview.hidden = true;
      if (previewNotice) previewNotice.hidden = true;
      form.hidden = false;
      if (success) success.hidden = true;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  form.querySelectorAll('input, textarea').forEach(function (field) {
    field.addEventListener('input', function () {
      if (field.classList.contains('is-invalid')) validate();
    });
  });

  if (again) {
    again.addEventListener('click', function () {
      form.reset();
      form.hidden = false;
      success.hidden = true;
      form.querySelectorAll('.field-error').forEach(function (b) { b.hidden = true; });
      form.querySelectorAll('.is-invalid').forEach(function (f) { f.classList.remove('is-invalid'); });
      form.querySelector('input') && form.querySelector('input').focus();
    });
  }
})();
