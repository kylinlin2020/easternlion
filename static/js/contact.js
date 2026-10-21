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

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;

    var f = new FormData(form);
    var subject = 'Inquiry' + (f.get('product') ? ': ' + f.get('product') : '');
    var body = [
      'Name: ' + (f.get('name') || ''),
      'Email: ' + (f.get('email') || ''),
      'Phone: ' + (f.get('phone') || ''),
      'Company: ' + (f.get('company') || ''),
      'Product: ' + (f.get('product') || ''),
      'Drawing / spec reference: ' + (f.get('drawing') || ''),
      '',
      f.get('message') || ''
    ].join('\n');

    /* show the confirmation panel first … */
    form.hidden = true;
    if (success) {
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /* … then hand the inquiry over to the visitor's mail client */
    setTimeout(function () {
      window.location.href = 'mailto:' + form.dataset.mailTo +
        '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    }, 350);
  });

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
