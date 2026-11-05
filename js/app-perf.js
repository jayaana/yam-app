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
    var q = /[?&]ab=([0-8])/.exec(location.search);
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
      var L = [['0','Normal'],['1','Patate figée'],['2','Patate retirée'],['3','Décor coupé'],['4','Tout figé'],['5','Corps fixe + détails'],['6','Corps seul'],['7','Photos (test)'],['8','Repos enrichi (test)']];
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

  /* Modes 7 et 8 : "photos" — base fixe + petites images par zone (visage, bras, feuilles, pieds) échangées par moments.
     7 = repos de base ; 8 = repos enrichi (regard varié, bras droit, feuilles, pieds). SVG caché. */
  if (AB === '7' || AB === '8') {
    var ENR = (AB === '8');
    var st7 = document.createElement('style');
    st7.textContent = '#homeMascot{display:none!important}#yamPhoto{position:relative;width:180px;height:180px;display:block}#yamPhoto img{position:absolute;display:block;pointer-events:none}#yamPhoto img.off{visibility:hidden}';
    document.head.appendChild(st7);
    document.addEventListener('DOMContentLoaded', function () {
      var h = document.getElementById('homeMascot'); if (!h) return;
      fetch('assets/mascotte/img/manifest.json').then(function (r) { return r.json(); }).then(function (M) {
        var k = 180 / M.size, w = document.createElement('div'); w.id = 'yamPhoto';
        function mk(src, box) {
          var im = new Image(); im.src = 'assets/mascotte/img/' + src + '.webp';
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
        function seq(z, steps, done) {   /* steps : [[pose, ms], ...] puis retour au neutre */
          var o = Z[z]; if (!o || o.busy || document.hidden) return false; o.busy = true; var i = 0;
          (function next() {
            if (i >= steps.length) { show(o, 'neutral'); o.busy = false; if (done) done(); return; }
            show(o, steps[i][0]); var ms = steps[i][1]; i++; setTimeout(next, ms);
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
        every(25000, 32000, function () { seq('armL', [['w90', 450], ['w76', 380], ['w100', 380], ['w76', 380], ['w100', 380], ['w52', 450], ['w0', 600], ['wM14', 500]]); });
        if (ENR) {
          every(7000, 13000, function () { seq('armR', [['r2', 700], ['r1', 700], ['r2', 600]]); });
          every(4000, 8000, function () { seq('leaf', [['l1', 500], ['l2', 700], ['l1', 500]]); });
          every(9000, 16000, function () {
            var L = Math.random() < .5, a = L ? 'tapL1' : 'tapR1', b = L ? 'tapL2' : 'tapR2';
            seq('legs', [[a, 160], [b, 130], [a, 160], [b, 130], [a, 160]]);
          });
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
