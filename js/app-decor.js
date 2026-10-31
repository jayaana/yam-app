/* ============================================================
   app-decor.js — décors de fond de l'onglet Jeux (un par saison)
   Un décor = identifiant + nom + variantes jour/nuit.
   « ete » est déjà dans index.html (#jxDecor) ; les autres sont des
   fichiers SVG chargés à la demande dans #jxDecor. Choix mémorisé
   sur l'appareil (localStorage) ; grille de choix dans Paramètres >
   Apparence (#stgDecorGrid).
   ============================================================ */
(function () {
  'use strict';
  var KEY = 'yam_decor';
  var DECORS = [
    { id: 'ete',       name: 'Été',       sub: 'La plage' },
    { id: 'noel',      name: 'Hiver',     sub: 'Le chalet de Noël', jour: 'decor/noel-jour.svg', nuit: 'decor/noel-nuit.svg' },
    { id: 'printemps', name: 'Printemps', soon: true },
    { id: 'automne',   name: 'Automne',   soon: true }
  ];
  var texts = {};   /* id -> { jour, nuit } (texte SVG des décors à fichiers) */

  function byId(id) { for (var i = 0; i < DECORS.length; i++) if (DECORS[i].id === id) return DECORS[i]; return null; }
  function stored() {
    try { var v = localStorage.getItem(KEY); var d = byId(v); return d && !d.soon ? v : 'noel'; } catch (e) { return 'noel'; }
  }
  function isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

  function load(id) {
    var d = byId(id);
    if (!d || !d.jour) return Promise.resolve(true);
    if (texts[id]) return Promise.resolve(true);
    function get(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u); return r.text(); }); }
    return Promise.all([get(d.jour), get(d.nuit)]).then(function (t) { texts[id] = { jour: t[0], nuit: t[1] }; return true; }, function () { return false; });
  }

  /* Injecte les deux variantes dans #jxDecor (une seule fois par décor) */
  function inject(id) {
    var host = document.getElementById('jxDecor');
    if (!host || !texts[id] || host.querySelector('.jx-' + id)) return;
    host.insertAdjacentHTML('beforeend', texts[id].jour.replace(/^<svg class="[^"]*"/, '<svg class="jx-' + id + ' jx-noel jx-jour"'));
    host.insertAdjacentHTML('beforeend', texts[id].nuit.replace(/^<svg class="[^"]*"/, '<svg class="jx-' + id + ' jx-noel jx-nuit"'));
  }

  function apply(id) {
    return load(id).then(function (ok) {
      if (!ok) id = 'ete';
      if (id !== 'ete') inject(id);
      document.documentElement.setAttribute('data-decor', id);
      return id;
    });
  }

  /* Aperçu d'une carte : SVG du décor avec identifiants uniques (le décor réel est caché, ses dégradés ne servent pas) */
  function uniq(svg, suf) {
    return svg.replace(/id="([^"]+)"/g, 'id="$1' + suf + '"').replace(/url\(#([^)]+)\)/g, 'url(#$1' + suf + ')');
  }
  function previewSvg(d) {
    var v = isDark() ? 'nuit' : 'jour', host = document.getElementById('jxDecor'), s = '';
    if (d.jour) s = texts[d.id] ? texts[d.id][v] : '';
    else if (host) { var e = host.querySelector('svg.jx-' + (v === 'nuit' ? 'nuit' : 'jour') + ':not(.jx-noel)'); s = e ? e.outerHTML : ''; }
    return s ? uniq(s.replace(/^<svg [^>]*?(?=\s(width|viewBox))/, '<svg '), '-pv') : '';
  }

  function render() {
    var g = document.getElementById('stgDecorGrid');
    if (!g) return;
    var cur = document.documentElement.getAttribute('data-decor') || 'ete', h = '';
    DECORS.forEach(function (d) {
      if (d.soon) {
        h += '<div class="dc-card lock"><div class="dc-prev"><b>Bientôt</b></div><div class="dc-bar"><div class="dc-nm">' + d.name + '</div></div></div>';
        return;
      }
      h += '<div class="dc-card' + (d.id === cur ? ' on' : '') + '" data-decor="' + d.id + '" role="button" tabindex="0">' +
        '<div class="dc-prev">' + previewSvg(d) + '</div><div class="dc-ck">✓</div>' +
        '<div class="dc-bar"><div class="dc-nm">' + d.name + '</div><div class="dc-sub">' + d.sub + '</div></div></div>';
    });
    g.innerHTML = h;
  }
  window.yamDecorRender = function () {
    /* charge les aperçus manquants puis dessine */
    Promise.all(DECORS.filter(function (d) { return d.jour; }).map(function (d) { return load(d.id); })).then(render);
    render();
  };

  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('#stgDecorGrid .dc-card[data-decor]');
    if (!c) return;
    var id = c.getAttribute('data-decor');
    try { localStorage.setItem(KEY, id); } catch (x) {}
    apply(id).then(render);
  });
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  apply(stored());
})();
