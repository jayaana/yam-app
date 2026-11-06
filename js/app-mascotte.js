/* ============================================================
   app-mascotte.js — mascotte (patate) de l'Accueil + page « Maison »
   Rendu = images (js/app-photos.js), plus de SVG animé. Ce fichier décide de l'humeur
   (fête / musique avec casque / triste / repos), de la tenue et du casque (communs au couple),
   de la jauge de cœurs et de la page Maison.
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
  /* Listes de tenues et de casques = fichier assets/mascotte/img/index.json écrit par l'outil photos (ajouter une tenue = relancer l'outil, aucun code).
     Les listes ci-dessus restent seulement le secours si le fichier est absent. */
  fetch('assets/mascotte/img/index.json').then(function (r) { return r.json(); }).then(function (I) {
    if (!I || !I.tenues || !I.casques) return;
    function maj(dst, src) { dst.length = 0; src.forEach(function (o) { dst.push({ id: o.id, name: o.nom, col: o.col }); }); }
    maj(TENUES, I.tenues); maj(CASQUES, I.casques);
    try { if (typeof sync === 'function') sync(); if (pageOpen()) renderPage(); } catch (e) {}
  }).catch(function () {});

  function get(k, def, list) {
    try { var v = localStorage.getItem(k); for (var i = 0; i < list.length; i++) if (list[i].id === v) return v; } catch (e) {}
    return def;
  }
  /* Habillage COMMUN au couple : table Supabase « mascotte » (une ligne par couple), mise à jour en direct.
     Copie locale (localStorage) = affichage immédiat et secours si la table est absente. */
  var shared = { tenue: null, casque: null };
  function ok(v, list) { for (var i = 0; i < list.length; i++) if (list[i].id === v) return v; return null; }
  function tenue() { return ok(shared.tenue, TENUES) || get(KEY_TENUE, 'rouge', TENUES); }
  function casque() { return ok(shared.casque, CASQUES) || get(KEY_CASQUE, 'blanc', CASQUES); }
  function coupleId() { var u = (typeof yamGetUser === 'function') ? yamGetUser() : null; return u ? u.couple_id : null; }
  var lastFetch = 0;
  function pull(force) {
    var cid = coupleId();
    if (!cid || typeof sb2Fetch !== 'function') return;
    /* copie locale rangée par couple : si un autre couple se connecte sur le même appareil, on oublie la tenue/casque/jauge de l'ancien */
    try {
      var lc = localStorage.getItem('yam_mascotte_couple');
      if (lc && lc !== cid) { localStorage.removeItem(KEY_TENUE); localStorage.removeItem(KEY_CASQUE); localStorage.removeItem(KEY_JAUGE); shared.tenue = null; shared.casque = null; shared.jauge = null; shared.jmaj = 0; lastFetch = 0; force = true; }
      if (lc !== cid) localStorage.setItem('yam_mascotte_couple', cid);
    } catch (e) {}
    if (!force && Date.now() - lastFetch < 30000) return;
    lastFetch = Date.now();
    var q = 'couple_id=eq.' + encodeURIComponent(cid) + '&select=tenue,casque';
    sb2Fetch('patate', q + ',jauge,jauge_maj').then(function (rows) {
      /* colonnes de la jauge absentes (SQL pas encore lancé) : on relit sans elles */
      return Array.isArray(rows) ? rows : sb2Fetch('patate', q);
    }).then(function (rows) {
      var r = Array.isArray(rows) && rows[0];
      if (!r) return;
      if (typeof r.jauge === 'number' && r.jauge_maj) {
        var t = Date.parse(r.jauge_maj);
        /* on garde la valeur locale si elle est plus récente (clic pas encore envoyé) */
        if (t && (!shared.jmaj || t > shared.jmaj)) { shared.jauge = r.jauge; shared.jmaj = t; saveJauge(); }
      }
      shared.tenue = r.tenue; shared.casque = r.casque;
      /* mode photos : la tenue de l'autre/du serveur est appliquée à chaud (images repointées, patate floue le temps du chargement) */
      if (ok(r.tenue, TENUES) && home) home.tenue(r.tenue);
      try { if (ok(r.tenue, TENUES)) localStorage.setItem(KEY_TENUE, r.tenue); if (ok(r.casque, CASQUES)) localStorage.setItem(KEY_CASQUE, r.casque); } catch (e) {}
      sync(); if (pageOpen()) renderPage();
    });
  }
  function push() {
    var cid = coupleId();
    if (!cid || typeof sb2Upsert !== 'function') return;
    return sb2Upsert('patate', { couple_id: cid, tenue: tenue(), casque: casque(), updated_at: new Date().toISOString() });
  }
  /* ---- JAUGE DE CŒURS (commune au couple : colonnes jauge / jauge_maj de la table patate) ----
     Niveau en % au moment jauge_maj ; il se vide de 100 → 0 en 12 h. Chaque cœur ajoute 5 %.
     Humeur : fête 5 s (max atteint, ou palier du compteur jauge pleine) > musique (casque) > triste (< 15 %) > repos. */
  var KEY_JAUGE = 'yam_mascotte_jauge';
  var DUREE = 12 * 3600 * 1000, SEUIL_TRISTE = 15, PAS = 5, FETE_MS = 5000;
  var rappelUntil = 0, rappelNext = 0;   /* zone Rayonnante : petit « content » de 3 s de temps en temps, sans cœurs */
  var pushT = null, feteUntil = 0, feteTimer = null, armed = true;
  shared.jauge = null; shared.jmaj = null;
  try { var lj = JSON.parse(localStorage.getItem(KEY_JAUGE) || 'null'); if (lj && typeof lj.v === 'number' && lj.t) { shared.jauge = lj.v; shared.jmaj = lj.t; } } catch (e) {}
  function saveJauge() { try { localStorage.setItem(KEY_JAUGE, JSON.stringify({ v: shared.jauge, t: shared.jmaj })); } catch (e) {} }
  function niveau() {
    if (shared.jauge === null) return 50;
    return Math.max(0, Math.min(100, shared.jauge - (Date.now() - shared.jmaj) / DUREE * 100));
  }
  window.mascotteNiveau = niveau;   /* lu par la fenêtre FPS (js/app-fps.js) */
  function pushJauge() {
    var cid = coupleId();
    if (!cid || typeof sb2Upsert !== 'function') return;
    sb2Upsert('patate', { couple_id: cid, jauge: Math.round(shared.jauge * 10) / 10, jauge_maj: new Date(shared.jmaj).toISOString() });
  }
  function fete() {
    if (!homeVisible()) return;
    armed = false;
    feteUntil = Date.now() + FETE_MS;
    if (home) home.calme();   /* la fête prend la place d'un saut en cours */
    sync();
    var btn = document.getElementById('homeMascot'), n = 0;
    clearInterval(feteTimer);
    feteTimer = setInterval(function () {
      /* pluie de cœurs : on réutilise les cœurs flottants du bouton (.like-heart-btn) */
      if (btn && btn.isConnected) {
        var r = btn.getBoundingClientRect(), h = document.createElement('div');
        h.className = 'like-heart-btn'; h.textContent = '🩷';
        h.style.setProperty('--dx', ((Math.random() - 0.5) * 120) + 'px');
        h.style.left = (r.left + r.width * (0.2 + Math.random() * 0.6)) + 'px';
        h.style.top = (r.top + r.height * (0.3 + Math.random() * 0.4)) + 'px';
        document.body.appendChild(h);
        setTimeout(function () { h.remove(); }, 900);
      }
      if (++n >= 14) clearInterval(feteTimer);
    }, 350);
    setTimeout(sync, FETE_MS + 50);
  }
  /* Bague d'humeur autour du cœur (maquette validée) : 1 Triste < 15 % · 2 Calme · 3 Contente ≥ 50 % · 4 Rayonnante ≥ 85 % */
  function paintRing() {
    var b = document.getElementById('homeSpamHeart');
    if (!b) return;
    var n = niveau(), l = n < SEUIL_TRISTE ? 1 : n < 50 ? 2 : n < 85 ? 3 : 4, c = 'lv' + l;
    if (window._ghSpamArc) window._ghSpamArc(n);   /* l'arc jaune du halo = le même niveau que la bague */
    if (!b.classList.contains(c)) { b.classList.remove('lv1', 'lv2', 'lv3', 'lv4'); b.classList.add(c); }
  }
  /* Appelée à chaque cœur envoyé (spawnHeart, app-nous.js) ; daily = compteur du jour après ce cœur */
  window.mascotteJaugeTap = function (daily) {
    var lvl = niveau(), nv = Math.min(100, lvl + PAS);
    if (lvl < 80) armed = true;
    shared.jauge = nv; shared.jmaj = Date.now(); saveJauge();
    clearTimeout(pushT); pushT = setTimeout(function () { pushT = null; pushJauge(); }, 1500);
    var ms = (typeof _heartMilestones !== 'undefined') ? _heartMilestones : [], palier = false;
    for (var i = 0; i < ms.length; i++) if (daily - 1 < ms[i] && daily >= ms[i]) palier = true;
    paintRing();
    if (nv >= 85 && (armed || palier)) fete(); else sync();   /* la fête se lance dès la zone dorée (≥ 85 %) */
  };

  var rtDone = false;
  function listen() {
    var cid = coupleId();
    if (rtDone || !cid || !window._yamRT) return;
    rtDone = true;
    try {
      window._yamRT.channel('patate_' + cid)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'patate', filter: 'couple_id=eq.' + cid }, function () { pull(true); })
        .subscribe();
    } catch (e) { rtDone = false; }
  }
  function pageOpen() { var p = document.getElementById('mzPage'); return !!(p && p.classList.contains('active')); }
  /* L'Accueil est-il réellement visible ? (sinon aucune animation, aucun travail) */
  function homeVisible() {
    return document.documentElement.getAttribute('data-yam-tab') === 'home' && !document.documentElement.hasAttribute('data-yam-settings') && !pageOpen() && !document.hidden;
  }

  /* Musique lancée par l'utilisateur lui-même (son propre lecteur) */
  function isPlaying() {
    var n = document.getElementById('navMusique');
    return !!((n && n.classList.contains('music-playing')) || (window._yamCurrentAudio && !window._yamCurrentAudio.paused));
  }

  var showCasque = false;   /* aperçu du casque dans la Maison après avoir touché un casque */
  var home = null, stage = null;   /* moteurs d'images (js/app-photos.js) : Accueil et aperçu de la Maison */
  /* Humeur de l'Accueil : fête > musique > triste > repos */
  function moodNow() {
    if (Date.now() < feteUntil || Date.now() < rappelUntil) return 'content';
    if (isPlaying()) return 'ecoute';
    return niveau() < SEUIL_TRISTE ? 'triste' : 'repos';
  }

  function sync() {
    var h = document.getElementById('homeMascot');
    var vis = homeVisible();
    if (home && !h.isConnected) { home.detruire(); home = null; }
    if (home) home.pause(!vis);
    if (!vis && !pageOpen()) return;
    var playing = isPlaying();
    if (vis) {
      var now = Date.now();
      if (niveau() < 85) rappelNext = 0;
      else if (!rappelNext) rappelNext = now + 15000;
      else if (now >= rappelNext && !playing && now >= feteUntil) { rappelUntil = now + 3000; rappelNext = now + 20000 + Math.random() * 20000; }
    }
    if (vis) { listen(); pull(false); paintRing(); }
    if (h && !home && window.yamPatate) home = window.yamPatate(h, { size: 180, precharge: true, tenue: tenue, casque: casque });
    if (home) home.humeur(moodNow());
    if (stage && pageOpen()) stage.humeur(showCasque ? 'ecoute' : 'repos');
  }
  window.mascotteSync = sync;

  /* Joie au clic sur le cœur : saut + chewing-gum + yeux souriants (pose repos seulement) */
  function joie() {
    if (!home || Date.now() < feteUntil) return;   /* pendant la fête : pas de saut, on laisse voir l'animation */
    var m = moodNow();
    if (m !== 'repos' && m !== 'content') return;   /* saut en repos ou content, pas en triste/musique */
    home.joie();
  }

  document.addEventListener('visibilitychange', function () { sync(); });

  /* ---- page Maison (simple : changer la tenue) ---- */
  /* Petites icônes : petites images des vrais accessoires (assets/mascotte/img/icones/, faites par photos-outil/icones.py) ; « Aucun » = cercle barré */
  var ICO = { vert: 2, rouge: 2, jaune: 2, blanc: 1, noir: 1 };
  function cards(list, cur, attr, size) {
    return list.map(function (o) {
      var ic = '';
      for (var i = 1; i <= (ICO[o.id] || 0); i++) ic += '<img class="mz-ico" src="assets/mascotte/img/icones/ico-' + o.id + '-' + i + '.webp" width="' + size + '" height="' + size + '" alt="" draggable="false">';
      return '<div class="mz-card' + (o.id === cur ? ' on' : '') + '" data-' + attr + '="' + o.id + '" role="button" tabindex="0">' +
        '<span class="mz-icos">' + (ic || '<span class="mz-none"></span>') + '</span><span class="mz-nm">' + escHtml(o.name) + '</span></div>';
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
      '<div class="mz-top"><div class="mz-back" id="mzBack" role="button" tabindex="0" aria-label="Retour"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></div><div class="mz-title">Maison</div><div class="mz-lab" id="mzLabBtn" role="button" tabindex="0" hidden>Labo</div></div>' +
      '<div class="mz-stage" id="mzStage"></div>' +
      '<div class="mz-body">' +
        '<div class="mz-label">Tenue</div><div class="mz-grid" id="mzTenues"></div>' +
        '<div class="mz-label">Casque</div><div class="mz-grid c2" id="mzCasques"></div>' +
      '</div>';
    d.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });   /* page Maison non défilable */
    document.body.appendChild(d);
  }
  function openMaison() {
    buildPage();
    var hd = document.getElementById('yamMainHeader'), pg = document.getElementById('mzPage');
    if (hd) pg.style.setProperty('--mz-top', Math.round(hd.getBoundingClientRect().bottom) + 'px');
    document.documentElement.setAttribute('data-yam-maison', '1');
    showCasque = false;
    pg.classList.add('active');
    renderPage();
    var lb = document.getElementById('mzLabBtn');
    if (lb) lb.hidden = !(window.yamMaisonLabo && window.yamMaisonLabo.actif());   /* Labo : visible seulement en mode perf */
    if (stage) stage.detruire();
    stage = window.yamPatate ? window.yamPatate(document.getElementById('mzStage'), { size: 150, still: true, tenue: tenue, casque: casque }) : null;
    sync();
  }
  function closeMaison() {
    var p = document.getElementById('mzPage');
    if (p) p.classList.remove('active');
    if (window.yamMaisonLabo) window.yamMaisonLabo.fermer();
    document.documentElement.removeAttribute('data-yam-maison');
    if (stage) { stage.detruire(); stage = null; }
    ['mzStage', 'mzTenues', 'mzCasques'].forEach(function (i) { var e = document.getElementById(i); if (e) e.innerHTML = ''; });
  }

  // La page Maison se ferme des qu'on quitte l'Accueil (Parametres, autre onglet) : jamais de page ou de couleur de zone sure qui reste
  new MutationObserver(function () {
    var h = document.documentElement;
    if (h.hasAttribute('data-yam-maison') && (h.hasAttribute('data-yam-settings') || (h.getAttribute('data-yam-tab') || 'home') !== 'home')) closeMaison();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-yam-settings', 'data-yam-tab'] });

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('#homeSpamHeart')) { joie(); return; }
    if (t.closest('#homeMaisonBtn')) { openMaison(); return; }
    if (t.closest('#mzBack')) { closeMaison(); return; }
    if (t.closest('#mzLabBtn')) { if (window.yamMaisonLabo) window.yamMaisonLabo.ouvrir(); return; }
    var c = t.closest('#mzPage .mz-card');
    if (!c) return;
    try {
      if (c.getAttribute('data-tenue')) { shared.tenue = c.getAttribute('data-tenue'); localStorage.setItem(KEY_TENUE, shared.tenue); if (stage) stage.tenue(shared.tenue); if (home) home.tenue(shared.tenue); }
      if (c.getAttribute('data-casque')) { shared.casque = c.getAttribute('data-casque'); localStorage.setItem(KEY_CASQUE, shared.casque); showCasque = true; if (stage) stage.casque(); }
    } catch (x) {}
    push();
    renderPage();
    sync();
  });

  document.addEventListener('DOMContentLoaded', function () { sync(); setInterval(sync, 1000); });
})();
