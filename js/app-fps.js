/* ============================================================
   app-fps.js — mini fenêtre de mesure des images par seconde (FPS)
   Activation / désactivation : 1 appui sur le logo YAM de l'Accueil (mémorisé sur l'appareil).
   Une fois active, la fenêtre reste affichée sur n'importe quelle page. iOS ne donne pas la température :
   on mesure les FPS, qui chutent (60 → 30) quand le téléphone chauffe et se bride.
   ============================================================ */
(function () {
  'use strict';
  var KEY = 'yam_fps', box = null, raf = 0, on = false;
  function stored() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function save(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {} }

  function start() {
    if (box) return;
    box = document.createElement('div'); box.id = 'yamFps';
    box.style.cssText = 'position:fixed;left:6px;bottom:84px;z-index:2147483000;pointer-events:none;background:rgba(0,0,0,.72);color:#fff;font:600 11px/1.35 ui-monospace,Menlo,monospace;padding:5px 8px;border-radius:8px;white-space:pre';
    document.body.appendChild(box);
    var frames = 0, last = performance.now(), t0 = last, lastFrame = last, min = 999, sum = 0, n = 0, jank = 0;
    (function loop(t) {
      if (!box) return;
      frames++;
      if (t - lastFrame > 50) jank++;   /* image qui a mis plus de 50 ms */
      lastFrame = t;
      if (t - last >= 1000) {
        var fps = Math.round(frames * 1000 / (t - last));
        frames = 0; last = t;
        if (t - t0 > 3000) { n++; sum += fps; if (fps < min) min = fps; }   /* on ignore les 3 premières secondes */
        var anims = 0, p = document.querySelector('#homeMascot .yam-photo');
        try { anims = document.getAnimations().filter(function (a) { return a.playState === 'running'; }).length; } catch (e) {}
        box.textContent = 'FPS ' + fps + '   moy ' + (n ? Math.round(sum / n) : '-') + '   min ' + (n ? min : '-') +
          '\nsaccades ' + jank + '   animations ' + anims +
          '\néléments ' + document.getElementsByTagName('*').length + '   images patate ' + (p ? p.getElementsByTagName('img').length : 0) +
          (window.mascotteNiveau ? '\nbonheur ' + window.mascotteNiveau().toFixed(2) + ' %' : '') +
          (performance.memory ? '\nmémoire ' + Math.round(performance.memory.usedJSHeapSize / 1048576) + ' Mo' : '');
      }
      raf = requestAnimationFrame(loop);
    })(last);
  }
  function stop() { cancelAnimationFrame(raf); if (box && box.parentNode) box.parentNode.removeChild(box); box = null; }
  function set(v) { on = !!v; save(on); if (on) start(); else stop(); }
  window.yamFps = set;

  document.addEventListener('DOMContentLoaded', function () {
    if (stored()) set(true);
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest || !e.target.closest('#yamLogoHome')) return;
      set(!on);   /* un seul appui sur le logo */
    });
  });
})();
