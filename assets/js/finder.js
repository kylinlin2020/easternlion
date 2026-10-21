(function () {
  var dataEl = document.getElementById('finderData');
  if (!dataEl) return;

  var series = [];
  try {
    var raw = (dataEl.textContent || '').trim();
    series = JSON.parse(raw);
    if (typeof series === 'string') series = JSON.parse(series);
  } catch (e) { return; }
  if (!Array.isArray(series) || !series.length) return;

  var T = {};
  var strEl = document.getElementById('finderStrings');
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
  function fill(str, vars) {
    return String(str).replace(/\{(\w+)\}/g, function (m, k) {
      return vars[k] !== undefined ? vars[k] : m;
    });
  }

  /* the capacity of a model at the requested frequency */
  function capAt(m, freq) {
    if (m.a || m.b) return freq === 60 ? (m.b || m.a) : (m.a || m.b);
    return m.c || m.s || m.p || 0;
  }
  function unitOf(m) {
    if (m.a || m.b) return t('finder_model_output', 'output');
    if (m.s) return t('finder_model_standby', 'standby');
    return t('finder_model_prime', 'prime');
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function build(section) {
    var id = section.id;
    var form = document.getElementById(id + 'Form');
    var input = document.getElementById(id + 'Kw');
    var out = document.getElementById(id + 'Results');
    var hzBox = document.getElementById(id + 'Hz');
    if (!form || !input || !out) return;

    var freq = 50;

    if (hzBox) {
      hzBox.addEventListener('click', function (e) {
        var b = e.target.closest('.seg-btn');
        if (!b) return;
        freq = parseInt(b.getAttribute('data-hz'), 10) || 50;
        hzBox.querySelectorAll('.seg-btn').forEach(function (x) {
          x.classList.toggle('is-active', x === b);
        });
        run();
      });
    }

    var chips = section.querySelectorAll('.finder-chips .chip');
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        input.value = c.getAttribute('data-kw');
        run();
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      run();
    });

    function run() {
      var kw = parseFloat(input.value);
      if (!kw || kw <= 0) {
        out.hidden = true;
        out.innerHTML = '';
        return;
      }
      render(kw, freq, out);
    }

    function render(kw, freq, out) {
      var hits = [];
      series.forEach(function (s) {
        var models = (s.mn || []).filter(function (m) {
          return capAt(m, freq) >= kw;
        });
        if (!models.length) return;
        models.sort(function (a, b) { return capAt(a, freq) - capAt(b, freq); });
        hits.push({ s: s, models: models });
      });
      hits.sort(function (a, b) { return capAt(a.models[0], freq) - capAt(b.models[0], freq); });

      var html = '';

      if (!hits.length) {
        /* nothing covers the load — point at the closest unit */
        var closest = null;
        series.forEach(function (s) {
          (s.mn || []).forEach(function (m) {
            var c = capAt(m, freq);
            if (!closest || c < closest.cap) closest = { s: s, m: m, cap: c };
          });
        });
        html += '<div class="finder-empty">';
        html += '<p class="fe-title">' + esc(fill(t('finder_none', 'No model in this range covers {kw} kW.'), { kw: kw })) + '</p>';
        if (closest) {
          html += '<p class="fe-text">' + esc(
            fill(t('finder_none_closest', 'The closest is {model} ({kw} kW) — tell us the load and our engineers will size it for you.'), {
              model: closest.m.m,
              kw: closest.cap
            })
          ) + '</p>';
          html += '<a class="btn btn-outline btn-sm" href="' + closest.s.u + '">' + esc(t('finder_open', 'Open spec sheet')) + '</a>';
        } else {
          html += '<p class="fe-text">' + esc(t('finder_none_max', 'Send us the load and we will quote a custom solution.')) + '</p>';
        }
        html += '</div>';
        out.innerHTML = html;
        out.hidden = false;
        return;
      }

      var head = hits.length === 1
        ? t('finder_head_one', '1 series covers {kw} kW at {hz} Hz')
        : t('finder_head', '{n} series cover {kw} kW at {hz} Hz');
      html += '<div class="finder-head-row"><h3 class="fr-title">' +
        esc(fill(head, { n: hits.length, kw: kw, hz: freq })) +
        '</h3></div>';

      html += '<div class="finder-list">';
      var LIMIT = 6;
      hits.forEach(function (hit, idx) {
        if (idx === LIMIT) {
          html += '<button type="button" class="finder-more-btn">' +
            esc(fill(t('finder_more_series', 'Show {n} more series'), { n: hits.length - LIMIT })) +
            '</button>';
        }
        var best = hit.models[0];
        var s = hit.s;
        html += '<article class="finder-item' + (idx >= LIMIT ? ' is-hidden' : '') + '">';
        html += '<img class="fi-img" src="' + s.i + '" alt="" loading="lazy">';
        html += '<div class="fi-body">';
        html += '<h4 class="fi-title"><a href="' + s.u + '">' + esc(s.t) + '</a></h4>';
        html += '<p class="fi-model"><b>' + esc(best.m) + '</b> · ' + capAt(best, freq) + ' kW ' + esc(unitOf(best)) + '</p>';
        if (hit.models.length > 1) {
          html += '<p class="fi-more">' + esc(fill(t('finder_more', '+{n} more models in this series cover this load'), { n: hit.models.length - 1 })) + '</p>';
        }
        html += '<ul class="fi-models">';
        hit.models.slice(0, 8).forEach(function (m) {
          html += '<li><a href="' + s.u + '#model-' + encodeURIComponent(m.m) + '">' + esc(m.m) +
            ' <span>' + capAt(m, freq) + ' kW</span></a></li>';
        });
        if (hit.models.length > 8) {
          html += '<li class="is-more">+' + (hit.models.length - 8) + ' …</li>';
        }
        html += '</ul>';
        html += '</div>';
        html += '<div class="fi-actions">';
        html += '<a class="btn btn-outline btn-sm" href="' + s.u + '">' + esc(t('finder_open', 'Open spec sheet')) + '</a>';
        var q = t('finder_inquire_url', '/contact/') +
          '?product=' + encodeURIComponent(best.m) +
          '&series=' + encodeURIComponent(s.t) +
          '&load=' + encodeURIComponent(kw) +
          '&hz=' + encodeURIComponent(freq);
        html += '<a class="btn btn-primary btn-sm" href="' + esc(q) + '">' + esc(t('finder_inquire', 'Get a quote')) + '</a>';
        html += '</div>';
        html += '</article>';
      });
      html += '</div>';

      out.innerHTML = html;
      out.hidden = false;

      var more = out.querySelector('.finder-more-btn');
      if (more) {
        more.addEventListener('click', function () {
          out.querySelectorAll('.finder-item.is-hidden').forEach(function (el) {
            el.classList.remove('is-hidden');
          });
          more.remove();
        });
      }
    }
  }

  document.querySelectorAll('.finder').forEach(build);
})();
