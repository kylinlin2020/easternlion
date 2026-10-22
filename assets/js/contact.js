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
  var chipsBox = document.getElementById('modelChips');
  var modelField = document.getElementById('modelField');
  var modelAdd = document.getElementById('modelAdd');
  var modelAddBtn = document.getElementById('modelAddBtn');
  var models = [];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function renderChips() {
    if (!chipsBox) return;
    var info = chipsBox.querySelector('.m-chip--info');
    chipsBox.innerHTML = models.map(function (m) {
      return '<span class="m-chip">' + esc(m) +
        '<button type="button" class="m-chip-x" data-model="' + esc(m) + '" aria-label="Remove">&times;</button>' +
        '</span>';
    }).join('');
    if (info) chipsBox.appendChild(info);
    if (modelField) modelField.hidden = models.length === 0 && !info;
  }

  function addModel(m) {
    m = (m || '').trim();
    if (!m) return;
    if (models.indexOf(m) > -1) return;
    models.push(m);
    renderChips();
  }

  /* the restore script adds the saved models */
  window.elAddModel = addModel;

  if (chipsBox) {
    var q = new URLSearchParams(window.location.search);
    load = q.get('load') || '';
    hz = q.get('hz') || '';
    var list = q.get('models');
    if (list) list.split(',').forEach(addModel);
    var one = q.get('product');
    if (one) {
      var series = q.get('series');
      addModel(series ? one + ' (' + series + ')' : one);
    }

    chipsBox.addEventListener('click', function (e) {
      var x = e.target.closest('.m-chip-x');
      if (!x) return;
      var m = x.getAttribute('data-model');
      models = models.filter(function (v) { return v !== m; });
      renderChips();
    });

    if (modelAddBtn && modelAdd) {
      modelAddBtn.addEventListener('click', function () {
        addModel(modelAdd.value);
        modelAdd.value = '';
      });
      modelAdd.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          addModel(modelAdd.value);
          modelAdd.value = '';
        }
      });
    }
    renderChips();

    /* the load and the frequency travel with the inquiry */
    if (load) {
      var LABEL_POWER = form.dataset.msgPower || 'Required power';
      var info = document.createElement('span');
      info.className = 'm-chip m-chip--info';
      info.textContent = LABEL_POWER + ': ' + load + ' kW' + (hz ? ' @ ' + hz + ' Hz' : '');
      chipsBox.appendChild(info);
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

    var rows = [];
    if (models.length) {
      models.forEach(function (m) { rows.push('  ' + l('model', 'Model') + '    : ' + m); });
    } else if (product) {
      rows.push('  ' + l('model', 'Model') + '    : ' + product);
    }
    if (load) {
      rows.push('  ' + l('required_power', 'Required power') + ' : ' + load +
        ' kW' + (hz ? ' @ ' + hz + ' Hz' : ''));
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
  function payload(body) {
    var f = new FormData(form);
    var models = [];
    var chips = document.querySelectorAll('#modelChips .m-chip:not(.m-chip--info)');
    chips.forEach(function (c) {
      var b = c.querySelector('.m-chip-x');
      if (b) models.push(b.getAttribute('data-model'));
    });
    return {
      body: body,
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

  function fillPreview(body) {
    if (previewText) previewText.value = body;
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
    fillPreview(body);

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
      var body = previewText ? previewText.value : assemble();
      subject = assembleSubject();
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
