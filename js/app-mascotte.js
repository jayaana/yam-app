/* ============================================================
   app-mascotte.js — mascotte SVG (patate) de l'Accueil + page « Maison »
   Le dessin est dans assets/mascotte/mascotte.svg (chargé une fois, mis en
   cache par le service worker). États : repos / content (musique lancée
   par l'utilisateur, avec casque). Habillage choisi dans la page Maison,
   mémorisé sur l'appareil (localStorage).
   ============================================================ */
(function () {
  'use strict';
  var KEY_TENUE = 'yam_mascotte_tenue', KEY_CASQUE = 'yam_mascotte_casque';
  var TENUES = [
    { id: 'rouge', name: 'Rouge Noël', col: '#d63a3a' },
    { id: 'jaune', name: 'Jaune', col: '#f5c542' },
    { id: 'vert',  name: 'Crème', col: '#cbb691' },
    { id: 'nu',    name: 'Aucun', col: '#e8c9a0' }
  ];
  var CASQUES = [
    { id: 'blanc', name: 'Casque blanc', col: '#ffffff' },
    { id: 'noir',  name: 'Casque noir', col: '#222222' }
  ];
  var svgText = null, loading = null;

  function get(k, def, list) {
    try { var v = localStorage.getItem(k); for (var i = 0; i < list.length; i++) if (list[i].id === v) return v; } catch (e) {}
    return def;
  }
  function tenue() { return get(KEY_TENUE, 'rouge', TENUES); }
  function casque() { return get(KEY_CASQUE, 'blanc', CASQUES); }

  function load() {
    if (svgText) return Promise.resolve(svgText);
    if (!loading) loading = fetch('assets/mascotte/mascotte.svg').then(function (r) {
      if (!r.ok) throw new Error('mascotte');
      return r.text();
    }).then(function (t) { svgText = t; return t; }, function () { loading = null; return null; });
    return loading;
  }

  /* Musique lancée par l'utilisateur lui-même (son propre lecteur) */
  function isPlaying() {
    var n = document.getElementById('navMusique');
    return !!((n && n.classList.contains('music-playing')) || (window._yamCurrentAudio && !window._yamCurrentAudio.paused));
  }

  var showCasque = false;   /* aperçu du casque dans la Maison après avoir touché un casque */
  function classesFor(playing, force) {
    var c = 'm nu ' + (playing ? 'content avec-casque' : 'repos' + (force ? ' avec-casque' : ''));
    var t = tenue();
    if (t !== 'nu') {
      var suf = t === 'vert' ? '' : (t === 'rouge' ? 'Rouge' : 'Jaune');
      ['moufle', 'pantoufle'].forEach(function (a) { c += ' porte-' + a + suf + 'G porte-' + a + suf + 'D'; });
    }
    if (casque() === 'noir') c += ' casque-noir';
    return c;
  }

  /* La copie de la Maison reçoit des identifiants à elle (sinon doublons avec l'Accueil = contours parasites) */
  function uniq(t) {
    return t.replace(/id="([^"]+)"/g, 'id="$1-mz"').replace(/url\(#([^)]+)\)/g, 'url(#$1-mz)').replace(/href="#([^"]+)"/g, 'href="#$1-mz"');
  }

  /* Pose le SVG dans un conteneur (une seule fois) puis règle les classes */
  function mount(host, playing, force) {
    if (!host) return;
    var s = host.firstElementChild;
    if (!s || String(s.tagName).toLowerCase() !== 'svg') {
      if (!svgText) return;
      host.innerHTML = host.id === 'mzStage' ? uniq(svgText) : svgText;
      s = host.firstElementChild;
      if (s && window.IntersectionObserver) {
        new IntersectionObserver(function (es) {
          es.forEach(function (e) { s.classList.toggle('pause', !e.isIntersecting || document.hidden); });
        }).observe(s);
      }
    }
    if (!s) return;
    var cls = classesFor(playing, force) + (s.classList.contains('pause') ? ' pause' : '') + (s.classList.contains('joie') ? ' joie' : '') + (s.classList.contains('joieY') ? ' joieY' : '');
    if (s.getAttribute('class') !== cls) s.setAttribute('class', cls);
  }

  function sync() {
    var playing = isPlaying();
    var h = document.getElementById('homeMascot');
    if (h) load().then(function () { mount(h, playing); });
    var p = document.getElementById('mzPage');
    var m = document.getElementById('mzStage');
    if (m && p && p.classList.contains('active')) load().then(function () { mount(m, playing, showCasque); });
  }
  window.mascotteSync = sync;

  /* Joie au clic sur le cœur : saut + chewing-gum + yeux souriants (pose repos seulement) */
  function joie() {
    var h = document.getElementById('homeMascot'), svg = h && h.firstElementChild;
    if (!svg || !svg.classList.contains('repos')) return;
    svg.classList.remove('joie');
    void svg.getBoundingClientRect();
    svg.classList.add('joie', 'joieY');
    clearTimeout(svg._joieT); clearTimeout(svg._joieYT);
    svg._joieT = setTimeout(function () { svg.classList.remove('joie'); }, 1000);
    svg._joieYT = setTimeout(function () { svg.classList.remove('joieY'); }, 1500);
  }

  document.addEventListener('visibilitychange', function () {
    var all = document.querySelectorAll('svg.m');
    for (var i = 0; i < all.length; i++) all[i].classList.toggle('pause', document.hidden);
  });

  /* ---- page Maison (simple : changer la tenue) ---- */
  /* Petites icônes : copies des vrais accessoires du dessin (gant, pantoufle, casque) */
  var ICO = {
    vert:  [['[data-acc="moufle-G"]'], ['[data-acc="pantoufle-G"]']],
    rouge: [['[data-acc="moufle-rouge-G"]'], ['[data-acc="pantoufle-rouge-G"]']],
    jaune: [['[data-acc="moufle-jaune-G"]'], ['[data-acc="pantoufle-jaune-G"]']],
    blanc: [['.slot-head:not(.acc-noir)']],
    noir:  [['.slot-head.acc-noir']]
  };
  function icon(src, sels, size) {
    var els = [], k;
    sels.forEach(function (q) { var n = src.querySelectorAll(q); for (k = 0; k < n.length; k++) els.push(n[k]); });
    if (!els.length) return '';
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, html = '';
    els.forEach(function (e) {
      var d = e.style.display; e.style.display = 'inline';
      try { var b = e.getBBox(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); } catch (x) {}
      e.style.display = d;
      html += e.outerHTML;
    });
    if (x1 <= x0) return '';
    var pad = 6;
    return '<svg class="mz-ico" width="' + size + '" height="' + size + '" viewBox="' + (x0 - pad) + ' ' + (y0 - pad) + ' ' + (x1 - x0 + 2 * pad) + ' ' + (y1 - y0 + 2 * pad) + '" aria-hidden="true">' + html + '</svg>';
  }
  function cards(list, cur, attr, size) {
    var src = document.querySelector('#mzStage svg');
    return list.map(function (o) {
      var ic = '';
      if (src) (ICO[o.id] || []).forEach(function (sels) { ic += icon(src, sels, size); });
      return '<div class="mz-card' + (o.id === cur ? ' on' : '') + '" data-' + attr + '="' + o.id + '" role="button" tabindex="0">' +
        '<span class="mz-icos">' + (ic || '<span class="mz-none"></span>') + '</span><span class="mz-nm">' + o.name + '</span></div>';
    }).join('');
  }
  function renderPage() {
    var g = document.getElementById('mzTenues'), c = document.getElementById('mzCasques');
    if (g) g.innerHTML = cards(TENUES, tenue(), 'tenue', 34);
    if (c) c.innerHTML = cards(CASQUES, casque(), 'casque', 44);
  }
  function buildPage() {
    if (document.getElementById('mzPage')) return;
    var d = document.createElement('div');
    d.id = 'mzPage'; d.className = 'mz-page';
    d.innerHTML =
      '<div class="mz-top"><div class="mz-back" id="mzBack" role="button" tabindex="0" aria-label="Retour">‹</div><div class="mz-title">Maison</div></div>' +
      '<div class="mz-stage" id="mzStage"></div>' +
      '<div class="mz-body">' +
        '<div class="mz-label">Tenue</div><div class="mz-grid" id="mzTenues"></div>' +
        '<div class="mz-label">Casque</div><div class="mz-grid c2" id="mzCasques"></div>' +
      '</div>';
    document.body.appendChild(d);
  }
  function openMaison() {
    buildPage();
    var hd = document.getElementById('yamMainHeader'), pg = document.getElementById('mzPage');
    if (hd) pg.style.setProperty('--mz-top', Math.round(hd.getBoundingClientRect().bottom) + 'px');
    showCasque = false;
    pg.classList.add('active');
    renderPage();
    load().then(function () { mount(document.getElementById('mzStage'), isPlaying(), showCasque); renderPage(); });
    sync();
  }
  function closeMaison() {
    var p = document.getElementById('mzPage');
    if (p) p.classList.remove('active');
    ['mzStage', 'mzTenues', 'mzCasques'].forEach(function (i) { var e = document.getElementById(i); if (e) e.innerHTML = ''; });
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#homeSpamHeart')) { joie(); return; }
    if (t.closest('#homeMaisonBtn')) { openMaison(); return; }
    if (t.closest('#mzBack')) { closeMaison(); return; }
    var c = t.closest('#mzPage .mz-card');
    if (!c) return;
    try {
      if (c.getAttribute('data-tenue')) localStorage.setItem(KEY_TENUE, c.getAttribute('data-tenue'));
      if (c.getAttribute('data-casque')) { localStorage.setItem(KEY_CASQUE, c.getAttribute('data-casque')); showCasque = true; }
    } catch (x) {}
    renderPage();
    sync();
  });

  document.addEventListener('DOMContentLoaded', function () { sync(); setInterval(sync, 1000); });
})();
