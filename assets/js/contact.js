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
    chipsBox.innerHTML = models.map(function (m) {
      return '<span class="m-chip">' + esc(m) +
        '<button type="button" class="m-chip-x" data-model="' + esc(m) + '" aria-label="Remove">&times;</button>' +
        '</span>';
    }).join('');
    if (modelField) modelField.hidden = models.length === 0;
  }

  function addModel(m) {
    m = (m || '').trim();
    if (!m) return;
    if (models.indexOf(m) > -1) return;
    models.push(m);
    renderChips();
  }

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

    /* the summary at the top of the message */
    var msg = document.getElementById('messageField');
    if (msg && !msg.value.trim()) {
      var load = q.get('load');
      var hz = q.get('hz');
      var lines = [];
      var LABEL_MODELS = form.dataset.msgModels || 'Models';
      var LABEL_POWER = form.dataset.msgPower || 'Required power';
      if (models.length) lines.push(LABEL_MODELS + ': ' + models.join(', '));
      if (load) lines.push(LABEL_POWER + ': ' + load + ' kW' + (hz ? ' @ ' + hz + ' Hz' : ''));
      if (lines.length) {
        msg.value = lines.join('\n') + '\n\n';
      }
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

  function send(body) {
    if (preview) preview.hidden = true;
    form.hidden = true;
    if (success) {
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /* hand the inquiry over to the visitor's mail client */
    setTimeout(function () {
      window.location.href = 'mailto:' + form.dataset.mailTo +
        '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    }, 350);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;

    subject = assembleSubject();
    var body = assemble();

    if (preview && previewText) {
      previewText.value = body;
      preview.hidden = false;
      form.hidden = true;
      preview.scrollIntoView({ behavior: 'smooth', block: 'center' });
      previewText.focus();
      /* show the beginning of the mail, not the end */
      previewText.setSelectionRange(0, 0);
      previewText.scrollTop = 0;
      return;
    }

    send(body);
  });

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

  if (previewBack) {
    previewBack.addEventListener('click', function () {
      if (preview) preview.hidden = true;
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
