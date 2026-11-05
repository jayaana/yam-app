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
