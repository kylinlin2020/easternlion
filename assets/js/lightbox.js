(function () {
  'use strict';

  /* ---- Simple lightbox (data-lb) ---- */
  var simpleLinks = document.querySelectorAll('a[data-lb]');
  if (simpleLinks.length) {
    var ui = window.elUI || {};
    var closeSvg = ui.icon ? ui.icon('close') : '';
    var closeLabel = (ui.str ? ui.str('close', 'Close') : 'Close').replace(/"/g, '"');

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
      '</button></figure>';
    document.body.appendChild(box);

    var img = box.querySelector('.lb-img');
    var cap = box.querySelector('.lb-cap');
    var close = box.querySelector('.lb-close');

    function openSimple(href, alt) {
      img.src = href;
      img.alt = alt || '';
      cap.textContent = alt || '';
      box.classList.add('is-open');
      box.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function hideSimple() {
      box.classList.remove('is-open');
      box.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    simpleLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        openSimple(a.getAttribute('data-lb') || a.getAttribute('href'), a.getAttribute('data-lb-alt') || a.getAttribute('title') || '');
      });
    });
    close.addEventListener('click', hideSimple);
    box.querySelector('.lb-backdrop').addEventListener('click', hideSimple);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && box.classList.contains('is-open')) hideSimple();
    });
  }

  /* ---- Gallery lightbox (data-lightbox) ---- */
  var galleryLinks = document.querySelectorAll('a[data-lightbox]');
  if (!galleryLinks.length) return;

  var galleries = {};
  galleryLinks.forEach(function (a) {
    var gid = a.getAttribute('data-lightbox');
    if (!galleries[gid]) galleries[gid] = [];
    galleries[gid].push({
      href: a.getAttribute('href'),
      alt: a.getAttribute('aria-label') || a.getAttribute('title') || '',
      caption: a.getAttribute('data-caption') || ''
    });
  });

  var ui = window.elUI || {};
  var closeSvg = ui.icon ? ui.icon('close') : '';
  var closeLabel = (ui.str ? ui.str('close', 'Close') : 'Close').replace(/"/g, '"');
  var prevLabel = (ui.str ? ui.str('lightbox_prev', 'Previous') : 'Previous').replace(/"/g, '"');
  var nextLabel = (ui.str ? ui.str('lightbox_next', 'Next') : 'Next').replace(/"/g, '"');

  var gbox = document.createElement('div');
  gbox.className = 'lightbox';
  gbox.id = 'gallery-lightbox';
  gbox.setAttribute('aria-hidden', 'true');
  gbox.innerHTML =
    '<button class="lightbox-close" type="button" aria-label="' + closeLabel + '">' + closeSvg + '</button>' +
    '<button class="lightbox-nav lightbox-prev" type="button" aria-label="' + prevLabel + '">&#8249;</button>' +
    '<button class="lightbox-nav lightbox-next" type="button" aria-label="' + nextLabel + '">&#8250;</button>' +
    '<figure class="lightbox-figure">' +
    '<img class="lightbox-img" src="" alt="">' +
    '<figcaption class="lightbox-caption"></figcaption>' +
    '</figure>';
  document.body.appendChild(gbox);

  var gimg = gbox.querySelector('.lightbox-img');
  var gcap = gbox.querySelector('.lightbox-caption');
  var gclose = gbox.querySelector('.lightbox-close');
  var gprev = gbox.querySelector('.lightbox-prev');
  var gnext = gbox.querySelector('.lightbox-next');

  var currentGid = null;
  var currentIdx = 0;
  var currentItems = [];

  function openGallery(gid, idx) {
    currentGid = gid;
    currentItems = galleries[gid] || [];
    if (!currentItems.length) return;
    currentIdx = Math.max(0, Math.min(idx, currentItems.length - 1));
    showCurrent();
    gbox.hidden = false;
    gbox.classList.add('is-open');
    gbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    gprev.style.display = currentItems.length > 1 ? 'flex' : 'none';
    gnext.style.display = currentItems.length > 1 ? 'flex' : 'none';
  }
  function hideGallery() {
    gbox.hidden = true;
    gbox.classList.remove('is-open');
    gbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentGid = null;
    currentItems = [];
  }
  function showCurrent() {
    var item = currentItems[currentIdx];
    if (!item) return;
    gimg.src = item.href;
    gimg.alt = item.alt;
    gcap.textContent = item.caption || '';
  }
  function navigate(dir) {
    if (!currentGid || currentItems.length <= 1) return;
    currentIdx = (currentIdx + dir + currentItems.length) % currentItems.length;
    showCurrent();
  }

  galleryLinks.forEach(function (a, i) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var gid = a.getAttribute('data-lightbox');
      var idx = galleries[gid].findIndex(function (it) { return it.href === a.getAttribute('href'); });
      openGallery(gid, idx >= 0 ? idx : 0);
    });
  });

  gclose.addEventListener('click', hideGallery);
  gbox.addEventListener('click', function (e) {
    if (e.target === gbox) hideGallery();
  });
  gprev.addEventListener('click', function () { navigate(-1); });
  gnext.addEventListener('click', function () { navigate(1); });

  document.addEventListener('keydown', function (e) {
    if (gbox.hidden) return;
    if (e.key === 'Escape') hideGallery();
    else if (e.key === 'ArrowLeft') navigate(-1);
    else if (e.key === 'ArrowRight') navigate(1);
  });

  /* Touch swipe support */
  var touchX = null;
  gbox.addEventListener('touchstart', function (e) { touchX = e.changedTouches[0].clientX; }, {passive: true});
  gbox.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) navigate(dx > 0 ? -1 : 1);
    touchX = null;
  }, {passive: true});
})();