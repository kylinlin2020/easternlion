(function () {
  var links = document.querySelectorAll('a[data-lb]');
  if (!links.length) return;

  /* the glyph and the label come from the icon catalogue, not from this file */
  var ui = window.elUI || {};
  var closeSvg = ui.icon ? ui.icon('close') : '';
  var closeLabel = (ui.str ? ui.str('close', 'Close') : 'Close').replace(/"/g, '&quot;');

  var box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('aria-hidden', 'true');
  box.innerHTML =
    '<div class="lb-backdrop"></div>' +
    '<figure class="lb-figure">' +
    '<img class="lb-img" src="" alt="">' +
    '<figcaption class="lb-cap"></figcaption>' +
    '<button class="lb-close" type="button" aria-label="' + closeLabel + '">' +
    closeSvg +
    '</button></div>';
  document.body.appendChild(box);

  var img = box.querySelector('.lb-img');
  var cap = box.querySelector('.lb-cap');
  var close = box.querySelector('.lb-close');

  function open(href, alt) {
    img.src = href;
    img.alt = alt || '';
    cap.textContent = alt || '';
    box.classList.add('is-open');
    box.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function hide() {
    box.classList.remove('is-open');
    box.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      open(a.getAttribute('data-lb') || a.getAttribute('href'), a.getAttribute('data-lb-alt') || a.getAttribute('title') || '');
    });
  });

  close.addEventListener('click', hide);
  box.querySelector('.lb-backdrop').addEventListener('click', hide);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hide();
  });
})();
