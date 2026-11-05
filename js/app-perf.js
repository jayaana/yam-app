/* ============================================================
   app-perf.js — petite fenêtre de mesure (FPS) pour juger la surchauffe
   Invisible par défaut. Activer : ouvrir l'appli avec ?perf=1 dans l'adresse
   (mémorisé sur l'appareil) ; désactiver : ?perf=0.
   iOS ne donne pas la température ni le CPU/GPU aux pages web : on mesure les
   images par seconde, qui chutent (60 → 30) quand le téléphone chauffe et se bride.
   ============================================================ */
(function () {
  'use strict';
  var KEY = 'yam_perf', on = false;
  try {
    var m = /[?&]perf=([01])/.exec(location.search);
    if (m) localStorage.setItem(KEY, m[1]);
    on = localStorage.getItem(KEY) === '1';
  } catch (e) { on = !!/[?&]perf=1/.test(location.search); }

  /* A/B de surchauffe : ?ab=1 patate figée, ?ab=2 patate retirée, ?ab=3 décor (nuages, particules, décor Jeux) coupé,
     ?ab=4 tout figé (patate + décor), ?ab=0 normal. Mémorisé ; rechargement automatique au changement. */
  var AB = '0';
  try {
    var q = /[?&]ab=([0-9])/.exec(location.search);
    if (q) localStorage.setItem('yam_ab', q[1]);
    AB = localStorage.getItem('yam_ab') || '0';
  } catch (e) {}
  if (AB !== '0') {
    var css = '';
    if (AB === '1' || AB === '4') css += '#homeMascot,#homeMascot *{animation:none!important;transition:none!important}';
    if (AB === '2') css += '#homeMascot{display:none!important}';
    if (AB === '3' || AB === '4') css += '.gh-cloud,#particleCanvas,#jxDecor,#jxDecor *{animation:none!important;display:none!important}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    if (AB === '3' || AB === '4') window.addEventListener('load', function () { window._animPStopped = true; });
  }

  /* Menu de test dans l'appli installée : 5 touches rapides dans le coin haut-gauche. */
  document.addEventListener('DOMContentLoaded', function () {
    var taps = [];
    document.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; if (!t || t.clientX > 60 || t.clientY > 60) return;
      var now = Date.now(); taps = taps.filter(function (x) { return now - x < 2500; }); taps.push(now);
      if (taps.length < 5) return; taps = [];
      if (document.getElementById('yamAbMenu')) return;
      var m = document.createElement('div'); m.id = 'yamAbMenu';
      m.style.cssText = 'position:fixed;left:10px;top:70px;z-index:2147483600;background:#222;color:#fff;padding:10px;border-radius:12px;font:600 14px system-ui;display:flex;flex-direction:column;gap:8px';
      var L = [['0','Normal'],['1','Patate figée'],['2','Patate retirée'],['3','Décor coupé'],['4','Tout figé'],['5','Corps fixe + détails'],['6','Corps seul'],['7','Photos (test)'],['8','Repos enrichi (test)'],['9','Humeurs (test)']];
      L.forEach(function (o) {
        var b = document.createElement('button'); b.textContent = (AB === o[0] ? '✓ ' : '') + o[1];
        b.style.cssText = 'padding:10px 14px;border-radius:8px;border:0;font:600 14px system-ui';
        b.addEventListener('click', function () { try { localStorage.setItem('yam_ab', o[0]); localStorage.setItem(KEY, '1'); } catch (x) {} location.reload(); });
        m.appendChild(b);
      });
      var f = document.createElement('button'); f.textContent = 'Fermer'; f.style.cssText = 'padding:10px;border:0;border-radius:8px';
      f.addEventListener('click', function () { m.remove(); }); m.appendChild(f);
      document.body.appendChild(m);
    }, { passive: true });
  });

  /* Modes 5 et 6 : on fige seulement une partie des animations de la patate, par leur nom. */
  if (AB === '5' || AB === '6') {
    var BODY = /^(mHopIdle|mLean|mBreath|mBob|mRock|mBeat|mHop|mJoieHop|mDroop|mSitSigh|mSigh)$/;
    setInterval(function () {
      var h = document.getElementById('homeMascot'); if (!h || !h.getAnimations) return;
      h.getAnimations({ subtree: true }).forEach(function (a) {
        var n = a.animationName; if (!n) return;
        var freeze = (AB === '5') ? (BODY.test(n) || /^(mStem|mLeafL|mLeafR|mJoieStem|mJoieLeafL|mJoieLeafR)$/.test(n)) : !BODY.test(n);
        if (freeze && a.playState === 'running') { try { a.pause(); a.currentTime = 0; } catch (e) {} }
      });
    }, 300);
  }

  /* Modes 7, 8 et 9 : "photos" — base fixe + petites images par zone (visage, bras, feuilles, pieds) échangées par moments.
     7 = repos de base ; 8 = repos enrichi (regard varié, bras droit, feuilles, pieds) ; 9 = repos enrichi + humeurs (content/fête, joie au clic, triste, danse avec casque) en images entières. SVG caché. */
  if (AB === '7' || AB === '8' || AB === '9') {
    var ENR = (AB === '8' || AB === '9'), HUM = (AB === '9');
    var st7 = document.createElement('style');
    st7.textContent = '#homeMascot{display:none!important}#yamPhoto{position:relative;width:180px;height:180px;display:block}#yamPhoto img{position:absolute;display:block;pointer-events:none}#yamPhoto img.off{visibility:hidden}#yamPhoto img.hf{visibility:hidden}#yamPhoto img.hf.on{visibility:visible}#yamPhoto.hum img:not(.hf){visibility:hidden!important}';
    document.head.appendChild(st7);
    document.addEventListener('DOMContentLoaded', function () {
      var h = document.getElementById('homeMascot'); if (!h) return;
      var TEN = 'rouge'; try { TEN = localStorage.getItem('yam_mascotte_tenue') || 'rouge'; } catch (e) {} if (!/^(rouge|jaune|vert|nu)$/.test(TEN)) TEN = 'rouge';
      window.yamPhotoTenue = TEN;   /* lu par app-mascotte.js : si la tenue du serveur diffère au démarrage (autre compte), la page se recharge une fois */
      var DIR = 'assets/mascotte/img/' + TEN + '/';
      fetch(DIR + 'manifest.json').then(function (r) { return r.json(); }).then(function (M) {
        var k = 180 / M.size, w = document.createElement('div'); w.id = 'yamPhoto';
        function mk(src, box) {
          var im = new Image(); im.src = DIR + src + '.webp';
          var l = box ? box[0] : 0, t = box ? box[1] : 0, r = box ? box[2] : M.size, b = box ? box[3] : M.size;
          im.style.cssText = 'left:' + l * k + 'px;top:' + t * k + 'px;width:' + (r - l) * k + 'px;height:' + (b - t) * k + 'px';
          return im;
        }
        w.appendChild(mk('base', null));
        var Z = {};
        Object.keys(M.zones).forEach(function (z) {
          var o = { set: {}, cur: 'neutral', busy: false };
          M.zones[z].poses.forEach(function (n) {
            var im = mk(z + '-' + n, M.zones[z].rect); if (n !== 'neutral') im.className = 'off';
            o.set[n] = im; w.appendChild(im);
          });
          Z[z] = o;
        });
        h.parentNode.insertBefore(w, h);
        function rnd(a, b) { return a + Math.random() * (b - a); }
        function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
        function show(o, n) { o.set[o.cur].className = 'off'; o.set[n].className = ''; o.cur = n; }
        /* salut du bras gauche : trajectoire lissée (accélère puis ralentit) jouée avec les images tous les 5 degrés */
        function salut(done) {
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
          var o = Z.armL; if (!o || o.busy || document.hidden) return false; o.busy = true;
          var q = 0; (function next() {
            if (q >= fr.length) { o.busy = false; if (done) done(); return; }
            show(o, fr[q][0]); var ms = fr[q][1]; q++; if (ms) setTimeout(next, ms); else next();
          })();
          return true;
        }
        function seq(z, steps, done) {   /* steps : [[pose, ms], ...] ; images intermédiaires entre les poses, retour au neutre */
          var o = Z[z]; if (!o || o.busy || document.hidden) return false; o.busy = true;
          var NT = M.nt || 0, tw = {}; (M.zones[z].tween || []).forEach(function (n) { tw[n] = 1; });
          var fr = [], prev = null;
          function away(p) { if (p && tw[p]) for (var q = NT; q >= 1; q--) fr.push([p + '.' + q, 45]); }
          steps.forEach(function (st) {
            away(prev);
            if (tw[st[0]]) for (var q = 1; q <= NT; q++) fr.push([st[0] + '.' + q, 45]);
            fr.push([st[0], st[1]]); prev = st[0];
          });
          away(prev); fr.push(['neutral', 0]);
          var i = 0;
          (function next() {
            if (i >= fr.length) { o.busy = false; if (done) done(); return; }
            show(o, fr[i][0]); var ms = fr[i][1]; i++; if (ms) setTimeout(next, ms); else next();
          })();
          return true;
        }
        function every(a, b, fn) { (function go() { fn(); setTimeout(go, rnd(a, b)); })(); }
        every(2500, 6000, function () { seq('face', [['blink', 160]]); });
        if (!ENR) {
          every(5000, 9000, function () { var o = Math.random(); seq('face', o < .4 ? [['gazeR', 1500]] : o < .8 ? [['gazeL', 1500]] : [['gazeD', 1200]]); });
        } else {
          var G = ['gazeR', 'gazeL', 'gazeD', 'gazeU', 'gazeUR', 'gazeUL', 'gazeDR', 'gazeDL', 'gazeR2', 'gazeL2'];
          every(2500, 5500, function () {   /* le regard se promène : 1 à 4 positions à la suite */
            var n = 1 + Math.floor(Math.random() * 4), st = [];
            for (var q = 0; q < n; q++) st.push([pick(G), rnd(500, 1500)]);
            seq('face', st);
          });
        }
        every(12000, 20000, function () { seq('face', [['brow', 1100]]); });
        every(12000, 22000, function () { seq('face', Math.random() < .5 ? [['smile1', 600]] : [['smile1', 300], ['smile2', 1400], ['smile1', 300]]); });
        every(25000, 32000, function () { salut(); });
        if (ENR) {
          every(7000, 13000, function () { seq('armR', [['r2', 700], ['r1', 700], ['r2', 600]]); });
          every(4000, 8000, function () { seq('leaf', [['l1', 500], ['l2', 700], ['l1', 500]]); });
          every(9000, 16000, function () {
            var L = Math.random() < .5, a = L ? 'tapL1' : 'tapR1', b = L ? 'tapL2' : 'tapR2';
            seq('legs', [[a, 160], [b, 130], [a, 160], [b, 130], [a, 160]]);
          });
        }
        if (HUM && M.scenes) {
          /* Humeurs en images (h-<nom>-<n>.webp, rognées, ~25 images/s) jouées par requestAnimationFrame.
             Humeur lue sur les classes du SVG caché (app-mascotte.js : fête > musique > triste > repos). */
          var CQ = 'blanc'; try { CQ = localStorage.getItem('yam_mascotte_casque') || 'blanc'; } catch (e) {}
          var HF = {}, hgen = 0, plist = [], hmode = '', hsvg = null;
          /* voile de démarrage : patate floue/transparente tant que la bonne humeur n'est pas prête (évite d'entrevoir le repos avant le triste) */
          var revealed = false;
          w.style.cssText += ';opacity:0;filter:blur(10px);transition:opacity .35s,filter .35s';
          function reveal() { if (revealed) return; revealed = true; w.style.opacity = '1'; w.style.filter = 'blur(0px)'; setTimeout(function () { w.style.filter = 'none'; w.style.transition = 'none'; }, 500); }
          setTimeout(reveal, 5000);
          function hload(nm) {
            var o = M.scenes[nm]; if (!o || !o.rect || HF[nm]) return;
            var arr = [];
            for (var i = 1; i <= o.n; i++) {
              var im = mk('h-' + nm + '-' + i, o.rect); im.className = 'hf';
              im.style.zIndex = /^triste(Yeux)$/.test(nm) ? 3 : /^triste./.test(nm) ? 2 : 1;
              (function (im) { var tries = 0, u = im.src; im.onerror = function () { if (tries++ < 3) setTimeout(function () { im.src = u + '?r=' + tries; }, 800 * tries); }; })(im);
              w.appendChild(im); arr.push(im);
            }
            HF[nm] = arr;
          }
          ['content', 'joie', 'triste', 'tristeLarme', 'tristeYeux', 'tristeCoucou', CQ === 'noir' ? 'ecouteN' : 'ecoute'].forEach(function (nm, i) { setTimeout(function () { hload(nm); }, 1200 + i * 1500); });
          function hready(nm) { var a = HF[nm]; return !!a && a.every(function (im) { return im.complete && im.naturalWidth; }); }
          /* lecteur : images 1..n au rythme de M.scenes[nm].ms ; boucle ou passage unique (reste sur la dernière) */
          function player(nm, boucle, onend, hold) {
            var a = HF[nm], step = M.scenes[nm].ms, t0 = performance.now(), cur = null, last = -1, raf = 0, P = { stop: stop };
            function stop() { cancelAnimationFrame(raf); P.dead = true; if (cur) { cur.className = 'hf'; cur = null; } }
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
            function quand(nm, fn) {   /* lance fn dès que les images de nm sont chargées */
              if (hready(nm)) return fn();
              var iv = setInterval(function () { if (g !== hgen) clearInterval(iv); else if (hready(nm)) { clearInterval(iv); fn(); } }, 300);
              plist.push({ stop: function () { clearInterval(iv); } });
            }
            quand('tristeLarme', function () { if (g === hgen) player('tristeLarme', true); });
            quand('tristeYeux', function () { (function yeux() {
              var t = setTimeout(function () {
                if (g !== hgen) return; var im = HF.tristeYeux[0]; im.className = 'hf on';
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
              var t = setTimeout(function () { if (g === hgen) { trou(true); player('tristeCoucou', false, function () { trou(false); coucou(); }); } }, 9000 + Math.random() * 6000);
              plist.push({ stop: function () { clearTimeout(t); trou(false); } });
            })(); });
          }
          var eyeT = 0;
          function yeuxFermes(ms) {   /* après le saut : yeux fermés un moment (pose smile2) avant de rouvrir ceux du repos */
            var o = Z.face; if (!o) return; clearTimeout(eyeT);
            show(o, 'smile2'); o.busy = true;
            eyeT = setTimeout(function () { show(o, 'neutral'); o.busy = false; }, ms);
          }
          function yeuxOuverts() { var o = Z.face; if (!o || !eyeT) return; clearTimeout(eyeT); eyeT = 0; show(o, 'neutral'); o.busy = false; }
          var NEED = { triste: ['triste', 'tristeLarme', 'tristeYeux', 'tristeCoucou'] };
          var jt = null;
          function tick() {
            if (document.hidden) return;
            var s = hsvg && hsvg.isConnected ? hsvg : (hsvg = h.firstElementChild); if (!s || !s.classList) return;
            var c = s.classList, st = (c.contains('joie') && (c.contains('repos') || c.contains('content'))) ? 'joie' : c.contains('content') ? 'content' : c.contains('ecoute') ? (c.contains('casque-noir') ? 'ecouteN' : 'ecoute') : c.contains('triste') ? 'triste' : (c.contains('repos') && c.contains('joie')) ? 'joie' : (c.contains('joieY') ? 'joieY' : '');
            if (st === 'joie' && hmode === 'joie' && s._joieT !== jt && hready('joie')) {   /* nouveau clic sur le cœur : la joie repart du début */
              jt = s._joieT; hstop(); w.classList.add('hum'); player('joie', false, null, true); return;
            }
            if (st === 'joie') jt = s._joieT;
            if (!revealed && !(w.firstChild && w.firstChild.complete && w.firstChild.naturalWidth)) return;
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
          setInterval(tick, 200);
          document.addEventListener('click', function (e) { if (e.target && e.target.closest && e.target.closest('#homeSpamHeart')) setTimeout(tick, 40); }, true);
        }
      });
    });
  }
  if (!on) return;

  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:6px;bottom:84px;z-index:2147483000;pointer-events:none;background:rgba(0,0,0,.72);color:#fff;font:600 11px/1.35 ui-monospace,Menlo,monospace;padding:5px 8px;border-radius:8px;white-space:pre';
  document.body.appendChild(box);

  var frames = 0, last = performance.now(), t0 = last, lastFrame = last;
  var min = 999, sum = 0, n = 0, jank = 0, fps = 0;

  function loop(t) {
    frames++;
    if (t - lastFrame > 50) jank++;     /* image qui a mis plus de 50 ms */
    lastFrame = t;
    if (t - last >= 1000) {
      fps = Math.round(frames * 1000 / (t - last));
      frames = 0; last = t;
      if (t - t0 > 3000) { n++; sum += fps; if (fps < min) min = fps; }   /* on ignore les 3 premières secondes */
      var anims = 0;
      try { anims = document.getAnimations().filter(function (a) { return a.playState === 'running'; }).length; } catch (e) {}
      var h = document.getElementById('homeMascot');
      box.textContent = 'FPS ' + fps + '   moy ' + (n ? Math.round(sum / n) : '-') + '   min ' + (n ? min : '-') +
        '\nsaccades ' + jank + '   animations ' + anims + '\néléments patate ' + (h ? h.getElementsByTagName('*').length : 0);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
