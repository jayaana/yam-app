/* ============================================================
   app-photos.js — la patate en IMAGES (rendu normal de l'Accueil et de la Maison)
   Pourquoi : le dessin SVG animé faisait chauffer l'iPhone ; ici une base fixe + de petites images
   échangées par moments (visage, bras, feuilles, pieds) et des humeurs en images entières = 60 FPS, téléphone froid.
   Images produites par l'outil mascotte/photos-outil (assets/mascotte/img/<tenue>/ + index.json).
   API : window.yamPatate(hôte, options) → { humeur(m), joie(), calme(), pause(b), tenue(t), casque(), detruire() }
     options : size (px), tenue() et casque() (lecture de l'état courant), still (Maison : aucune animation, 1re image des scènes), precharge (Accueil).
     humeurs : 'repos' | 'content' | 'ecoute' | 'triste'.
   ============================================================ */
(function () {
  'use strict';
  var IDX = null, IDXP = null, MAN = {}, prefetched = false;
  var BASE = 'assets/mascotte/img/';
  function tenueOk(t) { return /^[a-z0-9_-]+$/i.test(t || '') && (!IDX || IDX.tenues.some(function (o) { return o.id === t; })); }
  function sceneDuCasque(id) { var r = 'ecoute'; if (IDX) IDX.casques.forEach(function (c) { if (c.id === id) r = c.scene; }); return r; }
  function index() {
    if (!IDXP) IDXP = fetch(BASE + 'index.json').then(function (r) { return r.json(); }).catch(function () { return null; }).then(function (I) { IDX = I && I.tenues && I.casques ? I : null; return IDX; });
    return IDXP;
  }
  function manifest(t) {
    if (!MAN[t]) MAN[t] = fetch(BASE + t + '/manifest.json').then(function (r) { if (!r.ok) throw new Error('manifest'); return r.json(); }).catch(function (e) { delete MAN[t]; throw e; });
    return MAN[t];
  }
  /* Téléchargement d'avance, discret : toutes les tenues entrent dans le cache durable du service worker (changement de tenue instantané, hors connexion) */
  function prefetch(first) {
    if (prefetched) return; prefetched = true;
    setTimeout(function () {
      try {
        if (!IDX || !IDX.fichiers || !navigator.onLine || (navigator.connection && navigator.connection.saveData)) return;
        var q = [];
        Object.keys(IDX.fichiers).sort(function (a, b) { return (b === first) - (a === first); }).forEach(function (t) { IDX.fichiers[t].forEach(function (f) { q.push(BASE + t + '/' + f); }); });
        var stop = false;
        function un() {
          if (stop) return;
          var u = q.shift(); if (!u) return;
          fetch(u).then(function (r) { return r.ok ? r.arrayBuffer() : (stop = true); }).then(un, function () { stop = true; });
        }
        un(); un(); un();
      } catch (e) {}
    }, 20000);
  }

  var CSS = '#homeMascot,#mzStage{position:relative}.yam-photo{position:relative;display:block}.yam-photo img{position:absolute;display:block;pointer-events:none}.yam-photo img.off{visibility:hidden}.yam-photo img.hf{visibility:hidden}.yam-photo img.hf.on{visibility:visible}.yam-photo.hum img:not(.hf){visibility:hidden!important}';
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  window.yamPatate = function (host, opts) {
    opts = opts || {};
    var SIZE = opts.size || 180, still = !!opts.still, dead = false, paused = false;
    var API = { ready: false };
    var TEN = null, DIR = '', M = null, k = 1, w = null, Z = {}, HF = {}, hgen = 0, plist = [], hmode = '', revealed = false, eyeT = 0, swapping = false;
    var mood = 'repos', joieAt = 0, joieEnd = 0, joieYEnd = 0, jt = 0, timers = [];
    function getTen() { var t = opts.tenue ? opts.tenue() : 'rouge'; return tenueOk(t) ? t : 'rouge'; }
    function getCq() { return opts.casque ? opts.casque() : 'blanc'; }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
    function later(fn, ms) { var t = setTimeout(function () { if (!dead) fn(); }, ms); timers.push(t); return t; }

    function boxOf(im) { var r = im._ref; return !r ? null : r[0] === 'z' ? M.zones[r[1]].rect : M.scenes[r[1]].rect; }
    function place(im) {   /* position/taille d'une image d'après le manifeste courant */
      var b = boxOf(im), l = b ? b[0] : 0, t = b ? b[1] : 0, r = b ? b[2] : M.size, bt = b ? b[3] : M.size;
      im.style.cssText = im.style.cssText.replace(/(left|top|width|height):[^;]*;?/g, '') + ';left:' + l * k + 'px;top:' + t * k + 'px;width:' + (r - l) * k + 'px;height:' + (bt - t) * k + 'px';
    }
    function mk(src, box) {
      var im = new Image(); im._k = src; im.src = DIR + src + '.webp';
      var l = box ? box[0] : 0, t = box ? box[1] : 0, r = box ? box[2] : M.size, b = box ? box[3] : M.size;
      im.style.cssText = 'left:' + l * k + 'px;top:' + t * k + 'px;width:' + (r - l) * k + 'px;height:' + (b - t) * k + 'px';
      return im;
    }
    function show(o, n) { o.set[o.cur].className = 'off'; o.set[n].className = ''; o.cur = n; }

    /* ---- animations du repos (zones) ---- */
    function salut(done) {   /* bras gauche : trajectoire lissée jouée avec les images tous les 5 degrés */
      var P = M.zones.armL.poses, av = [];
      P.forEach(function (n) { var m = /^s(M?)(\d+)$/.exec(n); if (m) av.push([(m[1] ? -1 : 1) * +m[2], n]); });
      [[0, 'neutral'], [-14, 'wM14'], [52, 'w52'], [76, 'w76'], [90, 'w90'], [100, 'w100']].forEach(function (c) { if (P.indexOf(c[1]) >= 0) av.push(c); }); av.sort(function (a, b) { return a[0] - b[0]; });
      if (av.length < 10) return seq('armL', [['w90', 450], ['w100', 380], ['w0', 600]], done);
      var K = [[0, 0], [90, 520], [76, 440], [100, 440], [76, 440], [100, 440], [52, 540], [0, 760], [-14, 600], [0, 600]], T = 1.15, fr = [], last = null, STEP = 55;
      function near(a) { var b = av[0]; av.forEach(function (c) { if (Math.abs(c[0] - a) < Math.abs(b[0] - a)) b = c; }); return b[1]; }
      for (var i = 1; i < K.length; i++) {
        var n = Math.max(1, Math.round(K[i][1] * T / STEP));
        for (var j = 1; j <= n; j++) {
          var u = j / n, e = u * u * (3 - 2 * u), a = K[i - 1][0] + (K[i][0] - K[i - 1][0]) * e, p = near(a);
          if (p === last) fr[fr.length - 1][1] += STEP; else { fr.push([p, STEP]); last = p; }
        }
      }
      fr.push(['neutral', 0]);
      var o = Z.armL; if (!o || o.busy || document.hidden || paused) return false; o.busy = true;
      var q = 0; (function next() {
        if (dead) return;
        if (q >= fr.length) { o.busy = false; if (done) done(); return; }
        show(o, fr[q][0]); var ms = fr[q][1]; q++; if (ms) setTimeout(next, ms); else next();
      })();
      return true;
    }
    function seq(z, steps, done) {   /* steps : [[pose, ms], ...] ; images intermédiaires entre les poses, retour au neutre */
      var o = Z[z]; if (!o || o.busy || document.hidden || paused) return false; o.busy = true;
      var NT = M.nt || 0, tw = {}; (M.zones[z].tween || []).forEach(function (n) { tw[n] = 1; });
      var fr = [], prev = null;
      function away(p) { if (p && tw[p]) for (var q = NT; q >= 1; q--) fr.push([p + '.' + q, 45]); }
      steps.forEach(function (s) {
        away(prev);
        if (tw[s[0]]) for (var q = 1; q <= NT; q++) fr.push([s[0] + '.' + q, 45]);
        fr.push([s[0], s[1]]); prev = s[0];
      });
      away(prev); fr.push(['neutral', 0]);
      var i = 0;
      (function next() {
        if (dead) return;
        if (i >= fr.length) { o.busy = false; if (done) done(); return; }
        show(o, fr[i][0]); var ms = fr[i][1]; i++; if (ms) setTimeout(next, ms); else next();
      })();
      return true;
    }
    function every(a, b, fn) { (function go() { if (dead) return; fn(); later(go, rnd(a, b)); })(); }
    function planning() {
      every(2500, 6000, function () { seq('face', [['blink', 160]]); });
      var G = ['gazeR', 'gazeL', 'gazeD', 'gazeU', 'gazeUR', 'gazeUL', 'gazeDR', 'gazeDL', 'gazeR2', 'gazeL2'];
      every(2500, 5500, function () {   /* le regard se promène : 1 à 4 positions à la suite */
        var n = 1 + Math.floor(Math.random() * 4), s = [];
        for (var q = 0; q < n; q++) s.push([pick(G), rnd(500, 1500)]);
        seq('face', s);
      });
      every(12000, 20000, function () { seq('face', [['brow', 1100]]); });
      every(12000, 22000, function () { seq('face', Math.random() < .5 ? [['smile1', 600]] : [['smile1', 300], ['smile2', 1400], ['smile1', 300]]); });
      every(25000, 32000, function () { salut(); });
      every(7000, 13000, function () { seq('armR', [['r2', 700], ['r1', 700], ['r2', 600]]); });
      every(4000, 8000, function () { seq('leaf', [['l1', 500], ['l2', 700], ['l1', 500]]); });
      every(9000, 16000, function () {
        var L = Math.random() < .5, a = L ? 'tapL1' : 'tapR1', b = L ? 'tapL2' : 'tapR2';
        seq('legs', [[a, 160], [b, 130], [a, 160], [b, 130], [a, 160]]);
      });
    }

    /* ---- humeurs : images entières h-<nom>-<n>.webp jouées par requestAnimationFrame ---- */
    function baseReady() {
      if (!(w.firstChild && w.firstChild.complete && w.firstChild.naturalWidth)) return false;
      return Object.keys(Z).every(function (z) { var im = Z[z].set.neutral; return im.complete && im.naturalWidth; });
    }
    function reveal() { if (revealed) return; revealed = true; w.style.opacity = '1'; w.style.filter = 'blur(0px)'; later(function () { w.style.filter = 'none'; w.style.transition = 'none'; }, 500); }
    function hload(nm) {
      var o = M.scenes && M.scenes[nm]; if (!o || !o.rect || HF[nm]) return;
      var arr = [];
      for (var i = 1; i <= o.n; i++) {
        var im = mk('h-' + nm + '-' + i, o.rect); im._ref = ['s', nm]; im.className = 'hf';
        im.style.zIndex = /^triste(Yeux)$/.test(nm) ? 3 : /^triste./.test(nm) ? 2 : 1;
        (function (im) { var tries = 0, u = im.src; im.onerror = function () { if (tries++ < 3) setTimeout(function () { im.src = u + '?r=' + tries; }, 800 * tries); }; })(im);
        w.appendChild(im); arr.push(im);
      }
      HF[nm] = arr;
    }
    function hready(nm) { var a = HF[nm]; return !!a && a.every(function (im) { return im.complete && im.naturalWidth; }); }
    function player(nm, boucle, onend, hold) {   /* images 1..n au rythme de M.scenes[nm].ms ; boucle ou passage unique (reste sur la dernière) */
      var a = HF[nm], step = M.scenes[nm].ms, t0 = performance.now(), cur = null, last = -1, raf = 0, P = { stop: stop };
      function stop() { cancelAnimationFrame(raf); P.dead = true; if (cur) { cur.className = 'hf'; cur = null; } }
      if (still) { cur = a[0]; cur.className = 'hf on'; plist.push(P); return P; }   /* Maison : image fixe */
      (function f(now) {
        if (P.dead) return;
        var i = Math.max(0, Math.floor((now - t0) / step));
        if (!boucle && i >= a.length) { if (!hold && cur) { cur.className = 'hf'; cur = null; } if (onend) onend(); return; }
        i %= a.length;
        if (i !== last) { if (cur) cur.className = 'hf'; cur = a[i]; cur.className = 'hf on'; last = i; }
        raf = requestAnimationFrame(f);
      })(t0);
      plist.push(P); return P;
    }
    function hstop() { hgen++; plist.forEach(function (q) { q.stop(); }); plist = []; w.classList.remove('hum'); }
    function htriste() {
      var g = hgen; w.classList.add('hum');
      HF.triste[0].className = 'hf on'; plist.push({ stop: function () { HF.triste[0].className = 'hf'; } });
      if (still) return;
      function quand(nm, fn) {   /* lance fn dès que les images de nm sont chargées */
        if (hready(nm)) return fn();
        var iv = setInterval(function () { if (g !== hgen || dead) clearInterval(iv); else if (hready(nm)) { clearInterval(iv); fn(); } }, 300);
        plist.push({ stop: function () { clearInterval(iv); } });
      }
      quand('tristeLarme', function () { if (g === hgen) player('tristeLarme', true); });
      quand('tristeYeux', function () { (function yeux() {
        var t = setTimeout(function () {
          if (g !== hgen || dead) return; var im = HF.tristeYeux[0]; im.className = 'hf on';
          setTimeout(function () { im.className = 'hf'; if (g === hgen) yeux(); }, 320);
        }, 3900);
        plist.push({ stop: function () { clearTimeout(t); HF.tristeYeux[0].className = 'hf'; } });
      })(); });
      quand('tristeCoucou', function () { (function coucou() {
        /* pendant le coucou, on retire de l'image fixe le rectangle du bras (sinon sa main fixe se voit sous la main qui salue = main dédoublée) */
        function trou(on) {
          var im = HF.triste[0], T = M.scenes.triste.rect, C = M.scenes.tristeCoucou.rect;
          if (!on) { im.style.clipPath = ''; return; }
          var W = (T[2] - T[0]) * k, H = (T[3] - T[1]) * k, x0 = (C[0] - T[0]) * k + 1.5, y0 = (C[1] - T[1]) * k + 1.5, x1 = (C[2] - T[0]) * k - 1.5, y1 = (C[3] - T[1]) * k - 1.5;
          im.style.clipPath = "path(evenodd,'M0 0H" + W + "V" + H + "H0Z M" + x0 + " " + y0 + "H" + x1 + "V" + y1 + "H" + x0 + "Z')";
        }
        var t = setTimeout(function () { if (g === hgen && !dead) { trou(true); player('tristeCoucou', false, function () { trou(false); coucou(); }); } }, 9000 + Math.random() * 6000);
        plist.push({ stop: function () { clearTimeout(t); trou(false); } });
      })(); });
    }
    function yeuxFermes(ms) {   /* après le saut : yeux fermés un moment (pose smile2) avant de rouvrir ceux du repos */
      var o = Z.face; if (!o) return; clearTimeout(eyeT);
      show(o, 'smile2'); o.busy = true;
      eyeT = setTimeout(function () { show(o, 'neutral'); o.busy = false; }, ms);
    }
    function yeuxOuverts() { var o = Z.face; if (!o || !eyeT) return; clearTimeout(eyeT); eyeT = 0; show(o, 'neutral'); o.busy = false; }
    var NEED = { triste: ['triste', 'tristeLarme', 'tristeYeux', 'tristeCoucou'] };

    /* état voulu = humeur + joie en cours (joie : saut, yeux fermés ; joieY : yeux fermés encore un moment) */
    function voulu() {
      if (paused) return '';
      var n = Date.now();
      if ((mood === 'repos' || mood === 'content') && n < joieEnd) return 'joie';
      if (mood === 'content') return 'content';
      if (mood === 'ecoute') return sceneDuCasque(getCq());
      if (mood === 'triste') return 'triste';
      if (n < joieYEnd) return 'joieY';
      return '';
    }
    function tick() {
      if (dead || !M || document.hidden) return;
      var st = voulu();
      if (st === 'joie' && hmode === 'joie' && joieAt !== jt && hready('joie')) {   /* nouveau clic sur le cœur : la joie repart du début */
        jt = joieAt; hstop(); w.classList.add('hum'); player('joie', false, null, true); return;
      }
      if (st === 'joie') jt = joieAt;
      if (!revealed && !baseReady()) return;
      if (st === hmode) { reveal(); return; }
      if (st && st !== 'joieY') {   /* charge tout de suite les images de cette humeur ; on ne change d'état que quand elles sont prêtes (sinon on réessaie au prochain passage) */
        (NEED[st] || [st]).forEach(hload);
        if (!hready(st === 'triste' ? 'triste' : st)) return;
      }
      var prev = hmode; hmode = st; hstop();
      if (st === 'joie') yeuxOuverts();
      if (prev === 'joie' && (st === 'joieY' || !st)) yeuxFermes(1000);
      reveal();
      if (!st || st === 'joieY') return;
      if (st === 'triste') { htriste(); return; }
      w.classList.add('hum');
      player(st, st !== 'joie', null, true);
    }

    /* ---- montage ---- */
    function monter(Mn) {
      M = Mn; k = SIZE / M.size;
      w = document.createElement('div'); w.className = 'yam-photo'; w.style.cssText = 'width:' + SIZE + 'px;height:' + SIZE + 'px;opacity:0;filter:blur(10px);transition:opacity .35s,filter .35s';
      w.appendChild(mk('base', null));
      Object.keys(M.zones).forEach(function (z) {
        var o = { set: {}, cur: 'neutral', busy: false };
        M.zones[z].poses.forEach(function (n) {
          var im = mk(z + '-' + n, M.zones[z].rect); im._ref = ['z', z]; if (n !== 'neutral') im.className = 'off';
          o.set[n] = im; w.appendChild(im);
        });
        Z[z] = o;
      });
      host.innerHTML = ''; host.appendChild(w);
      API.ready = true;
      later(reveal, 5000);   /* sécurité : on montre la patate même si une image tarde */
      if (!still) {
        planning();
        if (opts.precharge) ['content', 'joie', 'triste', 'tristeLarme', 'tristeYeux', 'tristeCoucou', sceneDuCasque(getCq())].forEach(function (nm, i) { later(function () { hload(nm); }, 1200 + i * 1500); });
      }
      timers.push(setInterval(tick, 200));
    }
    index().then(function () {
      if (dead) return;
      TEN = getTen(); DIR = BASE + TEN + '/';
      if (opts.precharge) prefetch(TEN);
      return manifest(TEN).then(function (Mn) { if (!dead) monter(Mn); });
    }).catch(function () { API.failed = true; });

    /* ---- commandes ---- */
    API.humeur = function (m) { if (m && m !== mood) { mood = m; if (M) setTimeout(tick, 0); } };
    API.joie = function () {
      var n = Date.now(); joieAt = n; joieEnd = n + 1000; joieYEnd = n + 1500;
      if (M) setTimeout(tick, 40);
    };
    API.calme = function () { joieEnd = 0; joieYEnd = 0; };   /* la fête prend la place d'un saut en cours */
    API.pause = function (b) { b = !!b; if (b !== paused) { paused = b; if (M && !paused) setTimeout(tick, 0); else if (M) tick(); } };
    API.casque = function () { if (M) setTimeout(tick, 0); };
    API.tenue = function (ten) {   /* changement de tenue à chaud : même structure d'images pour toutes les tenues, on repointe chaque image, patate floue le temps du chargement */
      if (!M || !tenueOk(ten) || ten === TEN || swapping) return;
      swapping = true;
      manifest(ten).then(function (NM) {
        if (dead) return;
        TEN = ten; DIR = BASE + ten + '/'; M = NM; k = SIZE / M.size;
        hstop(); hmode = ''; revealed = false;
        w.style.transition = 'opacity .35s, filter .35s'; w.style.opacity = '0'; w.style.filter = 'blur(10px)';
        [].forEach.call(w.querySelectorAll('img'), function (im) { place(im); im.src = DIR + im._k + '.webp'; });
        later(reveal, 8000);
        swapping = false;
      }, function () { swapping = false; });
    };
    API.detruire = function () {
      dead = true; timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
      try { plist.forEach(function (q) { q.stop(); }); } catch (e) {}
      if (w && w.parentNode) w.parentNode.removeChild(w);
    };
    return API;
  };
})();
