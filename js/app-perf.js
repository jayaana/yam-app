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
    var q = /[?&]ab=([0-7])/.exec(location.search);
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
      var L = [['0','Normal'],['1','Patate figée'],['2','Patate retirée'],['3','Décor coupé'],['4','Tout figé'],['5','Corps fixe + détails'],['6','Corps seul'],['7','Photos (test)']];
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

  /* Mode 7 : prototype "photos" — image fixe de la patate + clignement en petite image, SVG caché. */
  if (AB === '7') {
    var st7 = document.createElement('style');
    st7.textContent = '#homeMascot{display:none!important}#yamPhoto{position:relative;width:180px;height:180px;display:block}#yamPhoto img{position:absolute;display:block;pointer-events:none}';
    document.head.appendChild(st7);
    document.addEventListener('DOMContentLoaded', function () {
      var h = document.getElementById('homeMascot'); if (!h) return;
      var w = document.createElement('div'); w.id = 'yamPhoto';
      var a = new Image(); a.src = 'assets/mascotte/img/repos.webp'; a.style.cssText = 'left:0;top:0;width:180px;height:180px';
      var b = new Image(); b.src = 'assets/mascotte/img/clin.webp';
      b.style.cssText = 'left:' + (191 / 3) + 'px;top:' + (188 / 3) + 'px;width:' + (201 / 3) + 'px;height:' + (148 / 3) + 'px;opacity:0';
      w.appendChild(a); w.appendChild(b);
      h.parentNode.insertBefore(w, h);
      function blink() { b.style.opacity = 1; setTimeout(function () { b.style.opacity = 0; }, 160); setTimeout(blink, 2500 + Math.random() * 3500); }
      setTimeout(blink, 2000);
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
