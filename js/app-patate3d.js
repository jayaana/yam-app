/* ============================================================
   app-patate3d.js — TEST de la patate en 3D sur l'Accueil (branche feat/patate3d-accueil)
   Rien ne change tant que le bouton « 3D » n'est pas activé (choix mémorisé dans localStorage).
   Charge three.js et le modèle (assets/patate3d/patate-v1.glb.gz) seulement à l'activation.
   Routine reprise de l'Accueil photos : clignement, regard, sourire, salut. Panneau : un bouton par clip + mesures.
   ============================================================ */
(function () {
  'use strict';
  var KEY = 'yam_patate3d', GLB = 'assets/patate3d/patate-v1.glb.gz';
  var host = null, T = null, S = null, on = false, loading = false, panelOpen = false;
  var M = { gz: 0, raw: 0, tFetch: 0, tUnzip: 0, tParse: 0, tFirst: 0, fps: 0, worst: 0, frames: 0, heap: 0 };
  var btn, panel, stats, canvas, clipBox;
  function lsGet() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function lsSet(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {} }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---------- interface : bouton + panneau ---------- */
  function css() {
    var s = document.createElement('style');
    s.textContent =
      '#p3dBtn{position:absolute;left:-6px;top:-6px;z-index:5;min-width:44px;height:36px;padding:0 12px;border:0;border-radius:18px;background:#ff6f61;color:#fff;font:700 15px/36px "Lilita One","Fredoka",sans-serif;letter-spacing:.5px;box-shadow:0 2px 6px rgba(0,0,0,.25)}' +
      '#p3dBtn.on{background:#c4352a}' +
      '#p3dCanvas{position:absolute;left:50%;top:50%;width:220px;height:240px;margin:-120px 0 0 -110px;pointer-events:none;z-index:2}' +
      '#p3dPanel{position:fixed;left:8px;right:8px;top:calc(var(--safe-top,0px) + 56px);max-height:68vh;overflow:auto;-webkit-overflow-scrolling:touch;z-index:9990;background:rgba(255,248,244,.97);color:#4a2a24;border-radius:16px;padding:12px;box-shadow:0 6px 24px rgba(0,0,0,.35);font:600 13px/1.35 "Fredoka",sans-serif}' +
      '#p3dPanel[hidden]{display:none}' +
      '#p3dPanel h4{margin:8px 0 6px;font:700 14px "Lilita One","Fredoka",sans-serif;color:#c4352a}' +
      '#p3dPanel .cl{display:flex;flex-wrap:wrap;gap:6px}' +
      '#p3dPanel button.c{min-height:40px;padding:0 12px;border:0;border-radius:12px;background:#ffd9d0;color:#7a2418;font:700 13px "Fredoka",sans-serif}' +
      '#p3dPanel button.c.act{background:#ff6f61;color:#fff}' +
      '#p3dPanel pre{margin:0;white-space:pre-wrap;font:600 12px/1.45 ui-monospace,Menlo,monospace}' +
      '#p3dPanel label{display:flex;gap:8px;align-items:center;min-height:36px}';
    document.head.appendChild(s);
  }
  function build() {
    host = document.getElementById('homeMascot'); if (!host) return false;
    css();
    var par = host.parentNode;
    btn = document.createElement('button'); btn.id = 'p3dBtn'; btn.type = 'button'; btn.textContent = '3D'; btn.setAttribute('aria-label', 'Patate en 3D (test)');
    par.appendChild(btn);
    panel = document.createElement('div'); panel.id = 'p3dPanel'; panel.hidden = true; document.body.appendChild(panel);
    btn.addEventListener('click', function () { if (!on) activer(); else if (!panelOpen) { panelOpen = true; panel.hidden = false; renderPanel(); } else { panelOpen = false; panel.hidden = true; } });
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    return true;
  }
  function renderPanel() {
    var h = '<div class="cl"><button class="c" data-a="off">Revenir aux photos</button><button class="c" data-a="close">Fermer</button></div>';
    h += '<h4>Mesures</h4><pre id="p3dStats"></pre>';
    h += '<h4>Routine</h4><label><input type="checkbox" id="p3dRout"' + (S && S.routine ? ' checked' : '') + '> routine automatique (clignement, regard, sourire, salut)</label>';
    h += '<label><input type="checkbox" id="p3dGrain"' + (S && S.grain ? ' checked' : '') + '> grain de feutre</label>';
    h += '<h4>Clips</h4><div class="cl" id="p3dClips">';
    if (T) T.names.forEach(function (n) { h += '<button class="c" data-clip="' + n + '">' + n.replace('expr_', '').replace('_', ' ') + '</button>'; });
    h += '</div>';
    panel.innerHTML = h; stats = document.getElementById('p3dStats'); majStats();
  }
  panel_events();
  function panel_events() {
    document.addEventListener('click', function (e) {
      var t = e.target; if (!t || !t.closest || !panel || !panel.contains(t)) return;
      var b = t.closest('button'); if (!b) return;
      if (b.dataset.clip) jouer(b.dataset.clip, true);
      else if (b.dataset.a === 'off') desactiver();
      else if (b.dataset.a === 'close') { panelOpen = false; panel.hidden = true; }
    });
    document.addEventListener('change', function (e) {
      if (!e.target) return;
      if (e.target.id === 'p3dRout') { S.routine = e.target.checked; if (S.routine) planning(); }
      if (e.target.id === 'p3dGrain') { S.grain = e.target.checked; if (S.grainU) S.grainU.value = S.grain ? 1 : 0; }
    });
  }
  function mo(x) { return (x / 1048576).toFixed(1) + ' Mo'; }
  function majStats() {
    if (!stats || !T) return;
    var r = T.renderer.info, hp = (performance && performance.memory) ? mo(performance.memory.usedJSHeapSize) : 'n/d (Safari)';
    stats.textContent =
      'images/s      ' + M.fps.toFixed(0) + '  (pire image ' + M.worst.toFixed(0) + ' ms)\n' +
      'modèle        ' + mo(M.gz) + ' transmis, ' + mo(M.raw) + ' décompressé\n' +
      'chargement    ' + M.tFetch.toFixed(0) + ' ms réseau, ' + M.tUnzip.toFixed(0) + ' décompression,\n' +
      '              ' + M.tParse.toFixed(0) + ' lecture, première image à ' + M.tFirst.toFixed(0) + ' ms\n' +
      'mémoire JS    ' + hp + '\n' +
      'GPU           ' + r.memory.geometries + ' formes, ' + r.memory.textures + ' textures\n' +
      'par image     ' + r.render.calls + ' appels, ' + (r.render.triangles / 1000).toFixed(0) + ' k triangles\n' +
      'résolution    ' + canvas.width + 'x' + canvas.height + ' (ratio ' + T.renderer.getPixelRatio().toFixed(1) + ')\n' +
      'clips actifs  ' + (S.actifs.length ? S.actifs.join(', ') : 'aucun');
  }

  /* ---------- chargement ---------- */
  function activer() {
    if (loading) return; loading = true; lsSet(true);
    btn.textContent = '...'; var t0 = performance.now();
    Promise.all([import('./vendor/three.module.js'), import('./vendor/GLTFLoader.js')]).then(function (mods) {
      var THREE = mods[0], GLTFLoader = mods[1].GLTFLoader;
      return fetch(GLB).then(function (r) { if (!r.ok) throw new Error('modèle introuvable'); return r.arrayBuffer(); }).then(function (gz) {
        M.gz = gz.byteLength; M.tFetch = performance.now() - t0; var t1 = performance.now();
        if (typeof DecompressionStream === 'undefined') throw new Error('décompression non supportée');
        var ds = new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip')));
        return ds.arrayBuffer().then(function (raw) { M.raw = raw.byteLength; M.tUnzip = performance.now() - t1; return raw; });
      }).then(function (raw) {
        var t2 = performance.now();
        return new Promise(function (ok, ko) { new GLTFLoader().parse(raw, '', function (g) { M.tParse = performance.now() - t2; ok(g); }, ko); });
      }).then(function (gltf) { demarrer(THREE, gltf, t0); });
    }).catch(function (e) { loading = false; btn.textContent = '3D'; lsSet(false); alert('Patate 3D : ' + (e && e.message || e)); });
  }
  function desactiver() {
    on = false; lsSet(false); panelOpen = false; panel.hidden = true;
    if (S) { S.timers.forEach(clearTimeout); S.dead = true; cancelAnimationFrame(S.raf); }
    if (T) { T.renderer.dispose(); if (T.renderer.forceContextLoss) T.renderer.forceContextLoss(); }
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    host.style.display = ''; btn.textContent = '3D'; btn.classList.remove('on'); T = null; S = null; loading = false;
  }

  /* ---------- scène ---------- */
  function demarrer(THREE, gltf, t0) {
    canvas = document.createElement('canvas'); canvas.id = 'p3dCanvas'; host.parentNode.appendChild(canvas);
    var W = 220, H = 240, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
    var scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff4ea, 0xb9785a, 1.0));
    var key = new THREE.DirectionalLight(0xfff6ee, 2.7); key.position.set(-1.6, 2.4, 3); scene.add(key);
    var fill = new THREE.DirectionalLight(0xffc9b0, 0.6); fill.position.set(2.2, 0.2, 1.5); scene.add(fill);
    var rim = new THREE.DirectionalLight(0xffe2c8, 1.1); rim.position.set(1.5, 1.2, -2.5); scene.add(rim);
    var root = new THREE.Group(); root.add(gltf.scene); scene.add(root);
    var grainU = { value: 1 };
    var noise = bruit(THREE);
    gltf.scene.traverse(function (o) {
      if (!o.isMesh) return; o.frustumCulled = false;
      var m = o.material; if (!m) return;
      if (m.name === 'peau' || m.name === 'paupiere' || m.name === 'paupiere_joie') { m.side = THREE.FrontSide; feutre(m, noise, grainU); }
    });
    var box = new THREE.Box3().setFromObject(gltf.scene), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    var cam = new THREE.PerspectiveCamera(22, W / H, 0.1, 20);
    var dist = (sz.y * 0.70) / Math.tan(22 * Math.PI / 360);
    cam.position.set(c.x, c.y, c.z + dist); cam.lookAt(c.x, c.y, c.z);
    var mixer = new THREE.AnimationMixer(gltf.scene), clips = {}, names = [];
    gltf.animations.forEach(function (a) { clips[a.name] = a; if (a.name !== 'repos') names.push(a.name); });
    T = { THREE: THREE, renderer: renderer, scene: scene, cam: cam, mixer: mixer, clips: clips, names: names, root: root, baseY: 0 };
    S = { routine: true, grain: true, grainU: grainU, actifs: [], acts: {}, timers: [], dead: false, raf: 0, base: null, baseKey: '', visible: true };
    on = true; loading = false; btn.classList.add('on'); btn.textContent = '3D'; host.style.display = 'none';
    baseMaj();
    mixer.addEventListener('finished', function (e) {
      var n = e.action._nom; delete S.acts[n]; S.actifs = S.actifs.filter(function (x) { return x !== n; }); e.action.stop(); baseMaj();
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { S.visible = en[0].isIntersecting; }).observe(canvas);
    var last = performance.now(), acc = 0, nfr = 0, first = true;
    (function boucle(now) {
      if (S.dead) return; S.raf = requestAnimationFrame(boucle);
      var dt = Math.min((now - last) / 1000, 0.1); last = now;
      if (document.hidden || !S.visible) return;
      mixer.update(dt);
      root.scale.y = 1 + Math.sin(now / 1400) * 0.006; root.position.y = Math.sin(now / 1400) * 0.002;   /* respiration légère */
      renderer.render(scene, cam);
      if (first) { first = false; M.tFirst = performance.now() - t0; }
      var ms = dt * 1000; if (ms > M.worst || nfr === 0) M.worst = ms;
      acc += dt; nfr++; if (acc >= 1) { M.fps = nfr / acc; acc = 0; nfr = 0; M.worst = ms; if (panelOpen) majStats(); }
    })(performance.now());
    planning();
  }
  function bruit(THREE) {
    var n = 128, d = new Uint8Array(n * n * 4), i;
    for (i = 0; i < n * n; i++) { var v = 110 + Math.floor((Math.random() + Math.random() + Math.random()) / 3 * 70); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    var t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
  }
  function feutre(m, noise, gU) {   /* grain de feutre fin : bruit mélangé selon trois axes dans l'espace du modèle (suit le squelette) */
    m.roughness = 0.72; if (m.sheen !== undefined) { m.sheen = 0.6; }
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uGrain = { value: noise }; sh.uniforms.uGA = gU;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;uniform sampler2D uGrain;uniform float uGA;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n{vec3 q=vOP*46.0;float g=(texture2D(uGrain,q.yz).r+texture2D(uGrain,q.xz).r+texture2D(uGrain,q.xy).r)/3.0-0.5;diffuseColor.rgb*=1.0+g*uGA*vec3(0.55,0.75,0.9);}');
    };
    m.needsUpdate = true;
  }

  /* ---------- animations : clips NLA ---------- */
  /* « repos » pilote tous les os/formes ; pendant un clip, on joue « repos » privé des pistes que ce clip pilote (sinon moyenne des deux) */
  function baseMaj() {
    var key = S.actifs.slice().sort().join('+'), THREE = T.THREE;
    if (key === S.baseKey) return; S.baseKey = key;
    if (S.base) S.base.stop();
    var rep = T.clips.repos; if (!rep) return;
    var pris = {}; S.actifs.forEach(function (n) { T.clips[n].tracks.forEach(function (tr) { pris[tr.name] = 1; }); });
    var ck = '_base_' + key;
    if (!T.clips[ck]) T.clips[ck] = new THREE.AnimationClip(ck, rep.duration, rep.tracks.filter(function (tr) { return !pris[tr.name]; }));
    S.base = T.mixer.clipAction(T.clips[ck]); S.base.setLoop(THREE.LoopRepeat, Infinity); S.base.play();
  }
  function jouer(nom, manuel) {
    if (!T || !T.clips[nom]) return;
    if (S.acts[nom]) return;
    var THREE = T.THREE, a = T.mixer.clipAction(T.clips[nom]); a._nom = nom;
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; a.timeScale = /^regard/.test(nom) ? 1.6 : 1; a.play();
    S.acts[nom] = a; S.actifs.push(nom); baseMaj();
    if (manuel && panel) { var b = panel.querySelector('[data-clip="' + nom + '"]'); if (b) { b.classList.add('act'); setTimeout(function () { b.classList.remove('act'); }, T.clips[nom].duration * 1000 / a.timeScale); } }
  }
  function libre(n) { return !S.acts[n]; }
  function every(a, b, fn) { (function go() { if (!S || S.dead) return; var t = setTimeout(function () { if (S && S.routine && !document.hidden && S.visible) fn(); go(); }, rnd(a, b)); S.timers.push(t); })(); }
  var planned = false;
  function planning() {
    if (planned && S.planned === S) return; S.planned = S; planned = true;
    var dur = function () { return S.actifs.some(function (n) { return /^expr_(joie|colere|malicieux)$/.test(n); }); };
    every(2500, 6000, function () { if (!dur() && libre('clignement')) jouer('clignement'); });
    every(2500, 5500, function () { var k = ['regard_gauche', 'regard_droite', 'regard_haut', 'regard_bas']; var n = k[Math.floor(Math.random() * 4)]; if (!k.some(function (x) { return S.acts[x]; })) jouer(n); });
    every(12000, 22000, function () { if (!S.actifs.some(function (n) { return /^expr_/.test(n); })) jouer('expr_sourire'); });
    every(25000, 32000, function () { if (!S.actifs.length || S.actifs.every(function (n) { return n === 'clignement' || /^regard/.test(n); })) jouer('salut'); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!build()) return;
    if (lsGet()) activer();
  });
})();
