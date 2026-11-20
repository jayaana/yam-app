/* ============================================================
   app-patate3d.js — patate en 3D de l'Accueil (seule patate de l'Accueil, les photos n'y sont plus)
   Chargée au démarrage : three.js + modèle (assets/patate3d/patate-v5.glb.gz).
   Humeur décidée par js/app-mascotte.js (window.yamP3d.humeur / joie). Bouton « 3D » : panneau de test (un bouton par clip + mesures).
   ============================================================ */
(function () {
  'use strict';
  var KEY = 'yam_patate3d', GLB = 'assets/patate3d/patate-v5.glb.gz';
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
      '#homeMascot{display:none!important}' +   /* plus de patate photos à l'Accueil */
      '#p3dBtn{position:absolute;left:-6px;top:-6px;z-index:5;min-width:44px;height:36px;padding:0 12px;border:0;border-radius:18px;background:#ff6f61;color:#fff;font:700 15px/36px "Lilita One","Fredoka",sans-serif;letter-spacing:.5px;box-shadow:0 2px 6px rgba(0,0,0,.25)}' +
      '#p3dBtn.on{background:#c4352a}' +
      '#p3dCanvas{position:absolute;left:50%;top:50%;width:220px;height:240px;margin:-120px 0 0 -110px;pointer-events:none;z-index:2}' +
      '#p3dPanel{position:fixed;left:8px;right:8px;top:380px;bottom:84px;overflow:auto;-webkit-overflow-scrolling:touch;z-index:9990;background:rgba(255,248,244,.97);color:#4a2a24;border-radius:16px;padding:12px;box-shadow:0 6px 24px rgba(0,0,0,.35);font:600 13px/1.35 "Fredoka",sans-serif}' +
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
    btn.addEventListener('click', function () { if (!on) activer(); else if (!panelOpen) { panelOpen = true; placePanel(); panel.hidden = false; renderPanel(); } else { panelOpen = false; panel.hidden = true; } });
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    return true;
  }
  function placePanel() {   /* le panneau se pose SOUS la patate pour qu'on la voie bouger */
    var b = canvas ? canvas.getBoundingClientRect().bottom : 380; panel.style.top = Math.round(b + 4) + 'px';
  }
  function renderPanel() {
    var h = '<div class="cl"><button class="c" data-a="close">Fermer</button></div>';
    h += '<h4>Clips</h4><div class="cl" id="p3dClips">';
    if (T) T.names.forEach(function (n) { h += '<button class="c" data-clip="' + n + '">' + n.replace('expr_', '').replace('_', ' ') + '</button>'; });
    h += '<button class="c" data-a="saut">saut</button><button class="c" data-a="fete">fête</button>';
    h += '</div>';
    h += '<h4>Routine</h4><label><input type="checkbox" id="p3dRout"' + (S && S.routine ? ' checked' : '') + '> routine automatique (clignement, regard, sourire, salut)</label>';
    h += '<label><input type="checkbox" id="p3dGrain"' + (S && S.grain ? ' checked' : '') + '> grain de feutre</label>';
    h += '<h4>Mesures</h4><pre id="p3dStats"></pre>';
    panel.innerHTML = h; stats = document.getElementById('p3dStats'); majStats();
  }
  panel_events();
  function panel_events() {
    document.addEventListener('click', function (e) {
      var t = e.target; if (!t || !t.closest || !panel || !panel.contains(t)) return;
      var b = t.closest('button'); if (!b) return;
      if (b.dataset.clip) jouer(b.dataset.clip, true);
      else if (b.dataset.a === 'saut') { if (S && !S.acts.bras_haut) { if (S.saut === -1) S.saut = 0; visageJoie(); } }   /* saut + visage de joie, quelle que soit l'humeur */
      else if (b.dataset.a === 'fete') { if (window.mascotteFete) window.mascotteFete(); else fete(); }   /* vraie fête : cœurs, visage de joie tenu 5 s, 4 sauts bras levés */   /* saut seul, quelle que soit l'humeur */
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
      return charger(GLB, 3).then(function (gz) {
        M.gz = gz.byteLength; M.tFetch = performance.now() - t0; var t1 = performance.now();
        if (typeof DecompressionStream === 'undefined') throw new Error('décompression non supportée');
        var ds = new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip')));
        return ds.arrayBuffer().then(function (raw) { M.raw = raw.byteLength; M.tUnzip = performance.now() - t1; return raw; });
      }).then(function (raw) {
        var t2 = performance.now();
        return new Promise(function (ok, ko) { new GLTFLoader().parse(raw, '', function (g) { M.tParse = performance.now() - t2; ok(g); }, ko); });
      }).then(function (gltf) { demarrer(THREE, gltf, t0); });
    }).catch(function (e) { loading = false; btn.textContent = '3D'; console.warn('Patate 3D : ' + (e && e.message || e)); });   /* le bouton 3D relance le chargement */
  }
  function charger(u, n) {   /* nouvel essai si la connexion est coupée */
    return fetch(u).then(function (r) { if (!r.ok) throw new Error('modèle introuvable'); return r.arrayBuffer(); }).catch(function (e) { if (n > 1) return new Promise(function (ok) { setTimeout(ok, 800); }).then(function () { return charger(u, n - 1); }); throw e; });
  }

  /* ---------- scène ---------- */
  function demarrer(THREE, gltf, t0) {
    canvas = document.createElement('canvas'); canvas.id = 'p3dCanvas'; host.parentNode.appendChild(canvas);
    var W = 220, H = 240, dpr = Math.min(window.devicePixelRatio || 1, 3);
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
    var scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff4ea, 0xb9785a, 1.0));
    var key = new THREE.DirectionalLight(0xfff6ee, 2.7); key.position.set(-1.6, 2.4, 3); scene.add(key);
    var fill = new THREE.DirectionalLight(0xffc9b0, 0.6); fill.position.set(2.2, 0.2, 1.5); scene.add(fill);
    var rim = new THREE.DirectionalLight(0xffe2c8, 1.1); rim.position.set(1.5, 1.2, -2.5); scene.add(rim);
    var root = new THREE.Group(); root.add(gltf.scene); scene.add(root);
    var grainU = { value: 1 }, skinU = { we: { value: 0 }, wm: { value: 0 }, ws: { value: 0 }, wb: { value: 0 } }, corps = null;
    var noise = bruit(THREE), blancs = [];
    gltf.scene.traverse(function (o) {
      if (!o.isMesh) return; o.frustumCulled = false;
      var mn = o.geometry.morphAttributes.normal;   /* export : certaines formes (corps : bouche_neutre, bouche_ouv1..10) ont pour « écart de normale » la normale de base elle-même
         → relief de l'œil fermé éclairé à moitié dès qu'une de ces bouches est active (effet panda à 0,25 s et 1,6 s de la joie). Écart nul à la place. */
      if (mn) for (var ni = 0; ni < mn.length; ni++) if (mn[ni] === o.geometry.attributes.normal || mn[ni].array === o.geometry.attributes.normal.array) mn[ni] = new THREE.Float32BufferAttribute(new Float32Array(mn[ni].count * 3), 3);
      var m = o.material; if (!m) return;
      if (m.name && m.name.indexOf('oeil_cornee') === 0) { o.material = verre(THREE); o.renderOrder = 3; return; }   /* verre de l'œil : exporté en noir opaque, remplacé par un vrai verre transparent + voile de reflet gris chaud en haut */
      if (m.name && m.name.indexOf('oeil_') === 0) { m.side = THREE.FrontSide; m.polygonOffsetFactor = m.name === 'oeil_pupille' || m.name === 'oeil_reflet' ? -2 : m.name === 'oeil_iris' ? -1 : 0; m.polygonOffset = m.polygonOffsetFactor !== 0; m.polygonOffsetUnits = m.polygonOffsetFactor; if (!m.userData.lum) { m.userData.lum = 1; if (m.name === 'oeil_iris') irisMat(THREE, m); if (m.name === 'oeil_blanc') m.emissive.setRGB(0.208, 0.208, 0.208); } }   /* matériau partagé par les 2 yeux : réglé UNE fois (avant, ×0,35 appliqué par œil = blanc droit plus sombre). Iris : couleur calculée par pixel (irisMat) ; blanc éclairci au niveau Blender (gauche 242 / droite 220 à l'Accueil). Reflet avancé comme la pupille (-2) : sinon l'iris (-1) le cachait à la taille Accueil ; reculer le blanc le faisait passer derrière la peau. Vérifié : coupé par la paupière (méfiant, colère, clignement) */
      if (m.name === 'oeil_iris') irisRep(THREE, o);   /* repères de l'iris recalculés par pixel (voir irisMat) */
      if (m.name === 'oeil_blanc' && o.geometry.attributes.color) { o.material = m = m.clone(); blancs.push(blancFixe(THREE, o)); }
      if (m.name === 'peau' && o.geometry.attributes._skin && o.morphTargetDictionary) { m = o.material = m.clone(); corps = o; }
      if (m.name === 'paupiere_joie') normalesFormes(THREE, o, gltf.scene);
      if (m.name === 'peau' || m.name === 'paupiere' || m.name === 'paupiere_joie') { m.side = THREE.FrontSide; feutre(m, noise, grainU, o === corps ? skinU : null); }
    });
    if (corps) paupieresPeau(THREE, gltf.scene, corps);
    var yeuxM = []; gltf.scene.traverse(function (o) { if (o.isMesh && /^oeil/.test(o.name)) yeuxM.push(o); });
    var avK = [];   /* paupière haute en avance sur le cil (avancePaupiere), posée après le repos */
    var pliK = []; gltf.scene.traverse(function (o) { var d = o.isMesh && o.morphTargetDictionary; if (d && d.plisse !== undefined && /^(paupiere|paupiere_bas|cils_ouv)\d$/.test(o.name)) pliK.push([o.morphTargetInfluences, d.plisse]); });   /* plissé (malicieux) en saut : sous la moitié = repos ; les images de passage (globe visible entre peau et cil) sont sautées, comme la joie et le clignement */
    var fermes = []; gltf.scene.traverse(function (o) { if (o.isMesh && o.morphTargetDictionary && o.morphTargetDictionary.ferme !== undefined) fermes.push([o, o.morphTargetDictionary.ferme, o.morphTargetDictionary.plisse]); });
    var jyK = [], jpK = [], pbK = []; gltf.scene.traverse(function (o) { var d = o.isMesh && o.morphTargetDictionary; if (!d) return; if (d.jy_pre !== undefined) jyK.push([o, d.jy_pre]); if (d.jy_in !== undefined) jyK.push([o, d.jy_in]); if (/^paupiere\d$/.test(o.name) && d.joie !== undefined) jpK.push([o, d.joie]); if (/^paupiere_bas\d$/.test(o.name) && d.joie !== undefined) pbK.push([o, d.joie]); });
    /* Joie : l'œil se fermait en 6 étapes (paupière jpaup qui descend + traits cil0/1_haut/bas) → bourrelet autour de l'œil (« cernes »).
       Œil de joie tout-ou-rien (comme le clignement) : ces pièces sont cachées, l'arc de l'œil fermé est posé dès la mi-fermeture. */
    var arcK = [], cilK = [];
    gltf.scene.traverse(function (o) { if (!o.isMesh) return; if (/^(jpaup\d|cil\d_(haut|bas))$/.test(o.name)) o.visible = false; if (/^arcjoie\d$/.test(o.name) && o.morphTargetDictionary) arcK.push([o.morphTargetInfluences, o.morphTargetDictionary]); if (/^cils_ouv\d$/.test(o.name) && o.morphTargetDictionary && o.morphTargetDictionary.joie !== undefined) cilK.push([o.morphTargetInfluences, o.morphTargetDictionary.joie]); });   /* cils de l'œil ouvert : gardés jusqu'à la fermeture */
    var dic = corps ? corps.morphTargetDictionary : null, nOuv = [];
    if (dic) for (var q = 1; q <= 10; q++) nOuv.push(dic['bouche_ouv' + q]);
    var mSour = gltf.scene.getObjectByName('sourcils'), mBou = gltf.scene.getObjectByName('bouche'), iNeutre = mBou && mBou.morphTargetDictionary ? mBou.morphTargetDictionary.bouche_neutre : -1;
    if (corps) { fantomes(THREE, corps, mSour, mBou, iNeutre); points(THREE, corps, skinU); }
    function majPeau() {   /* poids « yeux fermés » et « bouche ouverte » du corps, pour la peau propre */
      for (var fi = 0; fi < fermes.length; fi++) { var fw = fermes[fi][0].morphTargetInfluences, fk = fermes[fi][1]; fw[fk] = fw[fk] >= 0.5 ? 1 : 0; if (fw[fk] && fermes[fi][2] !== undefined) fw[fermes[fi][2]] = 0; }
      for (fi = 0; fi < pliK.length; fi++) if (pliK[fi][0][pliK[fi][1]] < 0.5) pliK[fi][0][pliK[fi][1]] = 0;
      for (fi = 0; fi < avK.length; fi++) { var aw0 = avK[fi][0], ac = aw0[avK[fi][1]], as = Math.min(1, ac / 0.1); aw0[avK[fi][2]] = as * as * (3 - 2 * as) * (1 - ac); aw0[avK[fi][3]] = 0.12 * aw0[avK[fi][2]] + 0.025 * ac; aw0[avK[fi][4]] = aw0[avK[fi][2]]; }   /* forme « avance » : rejoint le cil dès le début du plissé, nulle au repos et en fin de plissé */   /* œil fermé : le plissé (méfiant) est retiré, sinon les deux formes s'additionnaient (paupière 585 px au lieu de 412, sous l'œil) ; clignement net : à mi-chemin, l'iris et la peau qui ferme l'œil passaient DANS le globe (formes linéaires) → œil blanc vide 2 images */
      for (var bi = 0; bi < blancs.length; bi++) blancs[bi].u.value.setFromMatrix4(blancs[bi].m4.makeRotationFromQuaternion(blancs[bi].o.quaternion));   /* ombre du creux de l'œil : suit l'orbite, pas le globe */
      if (!dic) return;
      var wj = corps.morphTargetInfluences, jo = wj[dic.joie] || 0, pj = jo + (wj[dic.jy_pre] || 0), ji, tj, tp;   /* joie nette : entre ouvert et plissé (0 < p < 0,9), l'iris et la paupière (formes linéaires) passaient DANS le globe → œil blanc sans pupille ~0,1 s au début et à la fin ; tout-ou-rien à mi-chemin, comme le clignement */
      if (pj > 0) {   /* œil fermé = exactement l'état du milieu de la joie (corps « joie » à 1, sans la forme jy_pre qui faisait un autre relief bombé à 0,25 s et 1,6 s) */
        tp = pj < 0.5 ? 0 : 1;
        for (ji = 0; ji < jyK.length; ji++) jyK[ji][0].morphTargetInfluences[jyK[ji][1]] = 0;
        for (ji = 0; ji < jpK.length; ji++) jpK[ji][0].morphTargetInfluences[jpK[ji][1]] = tp;
        if (tp) { wj[dic.joie] = 1; for (ji = 0; ji < pbK.length; ji++) pbK[ji][0].morphTargetInfluences[pbK[ji][1]] = 1; }
      }
      for (ji = 0; ji < arcK.length; ji++) { var aw = arcK[ji][0], ad = arcK[ji][1]; aw[ad.joie] = pj >= 0.5 ? 1 : 0; aw[ad.jy_sous] = 0; aw[ad.jy_sur] = 0; }
      for (ji = 0; ji < cilK.length; ji++) cilK[ji][0][cilK[ji][1]] = pj >= 0.5 ? 1 : 0;
      var w = corps.morphTargetInfluences, e =(w[dic.ferme] || 0) + (w[dic.joie] || 0) + (w[dic.jy_pre] || 0), b = w[dic.bouche_rire] || 0, i;
      for (i = 0; i < 10; i++) if (nOuv[i] !== undefined) b += (w[nOuv[i]] || 0) * (i + 1) / 10;
      skinU.we.value = Math.min(1, e); skinU.wm.value = Math.min(1, b);
      var ws = 0, wb = 0, wi;   /* sourcil ou bouche qui quittent leur place de repos : la peinture de repos dessous passe en peau propre */
      if (mSour && mSour.morphTargetInfluences) for (wi = 0; wi < mSour.morphTargetInfluences.length; wi++) ws += mSour.morphTargetInfluences[wi];
      if (mBou && mBou.morphTargetInfluences) for (wi = 0; wi < mBou.morphTargetInfluences.length; wi++) if (wi !== iNeutre) wb += mBou.morphTargetInfluences[wi];
      skinU.ws.value = Math.min(1, ws * 1.5); skinU.wb.value = Math.min(1, wb * 1.5);
      var ouv = e < 0.9; for (i = 0; i < yeuxM.length; i++) if (yeuxM[i].visible !== ouv) yeuxM[i].visible = ouv;   /* yeux fermés : la paupière les couvre, on les masque (le globe traversait la paupière) */
    }
    var box = new THREE.Box3().setFromObject(gltf.scene), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    var cam = new THREE.PerspectiveCamera(22, W / H, 0.1, 20);
    var dist = (sz.y * 0.80) / Math.tan(22 * Math.PI / 360);
    cam.position.set(c.x, c.y, c.z + dist); cam.lookAt(c.x, c.y, c.z);
    var mixer = new THREE.AnimationMixer(gltf.scene), clips = {}, names = [];
    /* GLTFLoader applique aussi les poids de formes d'un nœud (ex. oeil0, 1 clé) à tous ses enfants (iris, reflets… 3 clés) : pistes de mauvaise taille → poids NaN, iris invisible.
       On retire toute piste de formes dont la taille ne correspond pas au nombre de clés de la pièce. */
    gltf.animations.forEach(function (a) {
      a.tracks = a.tracks.filter(function (tr) {
        var mm = /^(.*)\.morphTargetInfluences$/.exec(tr.name); if (!mm) return true;
        var ob = gltf.scene.getObjectByName(mm[1]); return !ob || !ob.morphTargetInfluences || tr.values.length / tr.times.length === ob.morphTargetInfluences.length;
      });
    });
    /* L'export écrit TOUTES les clés de forme d'une pièce dans chaque clip (un tableau par pièce), y compris celles que le clip n'anime pas.
       Deux clips qui se chevauchent étaient alors moyennés à 50/50 (clignement pendant le sourire : paupière fermée à moitié ; joie + clignement :
       sillon du sourire de repos à moitié sous la bouche qui rit = bouche en double). On découpe chaque piste en une piste par clé, et un clip
       ne garde que les clés qu'il fait varier : les autres viennent du « repos » (baseMaj ne lui retire que les clés prises). */
    gltf.animations.forEach(function (a) {
      var out = [];
      a.tracks.forEach(function (tr) {
        if (!/\.morphTargetInfluences$/.test(tr.name)) { out.push(tr); return; }
        var n = tr.times.length, vs = tr.values.length / n, it = tr.getInterpolation();
        for (var i = 0; i < vs; i++) {
          var v = new Float32Array(n), lo = Infinity, hi = -Infinity, k;
          for (k = 0; k < n; k++) { v[k] = tr.values[k * vs + i]; if (v[k] < lo) lo = v[k]; if (v[k] > hi) hi = v[k]; }
          if (a.name !== 'repos' && hi - lo < 1e-5) continue;
          out.push(new THREE.NumberKeyframeTrack(tr.name + '[' + i + ']', tr.times, v, it));
        }
      });
      a.tracks = out;
    });
    gltf.animations.forEach(function (a) { clips[a.name] = a; if (a.name !== 'repos') names.push(a.name); });
    /* Clips faits à partir des existants (routine plus variée) :
       « expr_rire » = la joie yeux OUVERTS : seulement la bouche (formes bouche*) de la joie, avec les sourcils du sourire ;
       regards en diagonale = rotation haut/bas puis gauche/droite composées image par image (×0,85 chacune, sinon ~14° : trop loin). */
    function cleDe(tr) { var m = /^(.+)\.morphTargetInfluences\[(\d+)\]$/.exec(tr.name), o = m && gltf.scene.getObjectByName(m[1]), d = o && o.morphTargetDictionary; if (!d) return null; for (var k in d) if (d[k] === +m[2]) return [m[1], k]; return null; }
    if (clips.expr_joie) { clips.expr_rire = new THREE.AnimationClip('expr_rire', clips.expr_joie.duration, clips.expr_joie.tracks.filter(function (tr) { var c = cleDe(tr); return c && /^bouche/.test(c[1]); }).concat(clips.expr_sourire ? clips.expr_sourire.tracks.filter(function (tr) { return /^sourcils\./.test(tr.name); }) : [])); names.push('expr_rire'); }
    ['haut', 'bas'].forEach(function (v) { ['gauche', 'droite'].forEach(function (h) {
      var cv = clips['regard_' + v], ch = clips['regard_' + h]; if (!cv || !ch) return;
      var id = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), tr = [];
      ch.tracks.forEach(function (th) {
        var tv = cv.tracks.filter(function (x) { return x.name === th.name; })[0]; if (!tv || !/\.quaternion$/.test(th.name)) return;
        var iv = tv.createInterpolant(), out = new Float32Array(th.times.length * 4);
        for (var k = 0; k < th.times.length; k++) { qa.fromArray(th.values, k * 4); id.set(0, 0, 0, 1).slerp(qa, 0.85); qa.copy(id); qb.fromArray(iv.evaluate(th.times[k])); id.set(0, 0, 0, 1).slerp(qb, 0.85); qa.multiply(id).toArray(out, k * 4); }
        tr.push(new THREE.QuaternionKeyframeTrack(th.name, th.times, out));
      });
      if (tr.length) { var nm = 'regard_' + v + '_' + h; clips[nm] = new THREE.AnimationClip(nm, ch.duration, tr); names.push(nm); }
    }); });
    /* « bras_haut » (fête) : les DEUX bras levés = pose du bras levé du salut (t = BRAS_T), recopiée en miroir (x, -y, -z, w) sur l'autre bras ; montée 0,15 s, tenue pendant les sauts, descente 0,3 s */
    if (clips.salut) (function () {
      var t0 = clips.salut.tracks.filter(function (x) { return /os_bras0\.quaternion$/.test(x.name); })[0], t1 = clips.salut.tracks.filter(function (x) { return /os_bras1\.quaternion$/.test(x.name); })[0]; if (!t0 || !t1) return;
      var r0 = Array.from(t0.values.slice(0, 4)), r1 = Array.from(t1.values.slice(0, 4)), q = t0.createInterpolant().evaluate(BRAS_T), up0 = [q[0], q[1], q[2], q[3]], up1 = [q[0], -q[1], -q[2], q[3]], D = SAUTS * SAUT_FIN + (SAUTS - 1) * SAUT_PAUSE, tk = [0, 0.15, D - 0.05, D + 0.25];
      clips.bras_haut = new THREE.AnimationClip('bras_haut', D + 0.25, [new THREE.QuaternionKeyframeTrack(t0.name, tk, [].concat(r0, up0, up0, r0)), new THREE.QuaternionKeyframeTrack(t1.name, tk, [].concat(r1, up1, up1, r1))]);
    })();
    T = { THREE: THREE, renderer: renderer, scene: scene, cam: cam, mixer: mixer, clips: clips, names: names, root: root, baseY: 0 };
    S = { routine: true, grain: true, grainU: grainU, actifs: [], sortants: [], acts: {}, timers: [], dead: false, raf: 0, base: null, baseKey: '', visible: true, hum: 'repos', tenir: null, saut: -1, sautN: 0 };
    on = true; loading = false; btn.classList.add('on'); btn.textContent = '3D'; document.body.classList.add('p3d-on'); window.__p3d = { T: T, S: S, jouer: jouer, majPeau: majPeau, fondus: fondus, finir: function () { finir(); }, GRAIN_F: GRAIN_F };
    baseMaj(); mixer.update(0); avK = avancePaupiere(THREE, gltf.scene) || [];
    /* Fin d'un clip traitée APRÈS mixer.update : arrêter une action (et changer le repos) pendant la mise à jour réordonne la liste des actions
       en cours → une autre action (ex. la joie, quand un regard finit pendant elle) était sautée une image : yeux rouverts 1 image (« clignement parasite »). */
    var finis = [];
    mixer.addEventListener('finished', function (e) { finis.push(e.action); });
    function finir() {
      if (!finis.length) return; var l = finis; finis = [];
      l.forEach(function (a) { var n = a._nom; a.stop(); if (S.acts[n] !== a) return; delete S.acts[n]; S.actifs = S.actifs.filter(function (x) { return x !== n; }); });   /* expression remplacée : déjà retirée */
      baseMaj();
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { S.visible = en[0].isIntersecting; }).observe(canvas);
    var last = performance.now(), acc = 0, nfr = 0, first = true, chk = 0, ph = 0;
    window.yamP3d = { humeur: humeur, joie: joie, fete: fete };   /* piloté par js/app-mascotte.js (humeur de la jauge de cœurs, tapotage du cœur) */
    (function boucle(now) {
      if (S.dead) return; S.raf = requestAnimationFrame(boucle);
      var dt = Math.min((now - last) / 1000, 0.1); last = now;
      if (!canvas.isConnected || !btn.isConnected) rattache();
      if (++chk >= 30) {   /* toutes les ~0,5 s : vraie place à l'écran (l'observateur restait parfois bloqué sur « caché » après la connexion ou une reconstruction de l'Accueil → patate figée) */
        chk = 0; var rc = canvas.getBoundingClientRect();
        S.visible = rc.width > 0 && rc.bottom > 0 && rc.right > 0 && rc.top < window.innerHeight && rc.left < window.innerWidth;
      }
      if (document.hidden || !S.visible) return;
      mixer.update(dt); finir(); fondus(); tenir(); majPeau();
      ph += dt * mixer.timeScale;   /* respiration légère, ralentie avec le reste quand elle est triste */
      var js = 1, jy = 0;
      if (S.saut >= 0) { var sp = sautPose(S.saut); js = sp.sy; jy = sp.y * sz.y; S.saut += dt; if (S.saut > SAUT_FIN) { if (S.sautN > 0) { S.sautN--; S.saut = -SAUT_PAUSE; } else S.saut = -1; } }
      else if (S.saut > -1) S.saut = Math.min(0, S.saut + dt);   /* pause au sol entre deux sauts de la fête */
      var jx = 1 / Math.sqrt(js);   /* volume gardé : écrasée = plus large, étirée = plus fine ; pieds fixes (box.min.y) */
      root.scale.set(jx, (1 + Math.sin(ph / 1.4) * 0.006) * js, jx); root.position.y = Math.sin(ph / 1.4) * 0.002 + jy + box.min.y * (1 - js);
      renderer.render(scene, cam);
      if (first) { first = false; M.tFirst = performance.now() - t0; }
      var ms = dt * 1000; if (ms > M.worst || nfr === 0) M.worst = ms;
      acc += dt; nfr++; if (acc >= 1) { M.fps = nfr / acc; acc = 0; nfr = 0; M.worst = ms; if (panelOpen) majStats(); }
    })(performance.now());
    planning();
  }
  function rattache() {   /* l'Accueil peut être reconstruit (retour des Paramètres) : on remet bouton et canvas près de la mascotte */
    var h = document.getElementById('homeMascot'); if (!h) return; host = h;
    if (!btn.isConnected) h.parentNode.appendChild(btn);
    if (!canvas.isConnected) h.parentNode.appendChild(canvas);
  }
  /* Paupières de joie (jpaup) : exportées sans normales de formes. Pliées en joie, elles gardaient l'orientation du repos face à la lumière
     → paupières blanches. Les normales recalculées sur le pli pointaient vers le haut (triangles écrasés) : encore pâles, et le grain projeté
     de travers faisait des rayures. La paupière recouvre le globe de l'œil : pour chaque forme, normale = du centre du globe vers le sommet
     (comme une vraie paupière), ajoutée en écart aux normales d'origine du repos. */
  function normalesFormes(THREE, o, scene) {
    var g = o.geometry, mp = g.morphAttributes.position; if (!mp || !mp.length || g.morphAttributes.normal) return;
    scene.updateMatrixWorld(true);
    var inv = o.matrixWorld.clone().invert(), cs = [], i, k;
    ['oeil0', 'oeil1'].forEach(function (nm) { var e = scene.getObjectByName(nm); if (e) cs.push(e.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv)); });
    if (!cs.length) return;
    var p0 = g.attributes.position, n0 = g.attributes.normal, n = p0.count, rel = g.morphTargetsRelative, mx = 0, my = 0, mz = 0;
    for (i = 0; i < n; i++) { mx += p0.getX(i); my += p0.getY(i); mz += p0.getZ(i); }
    var mc = new THREE.Vector3(mx / n, my / n, mz / n), C = cs.reduce(function (a, b) { return a.distanceTo(mc) <= b.distanceTo(mc) ? a : b; });   /* globe le plus proche de cette paupière */
    var out = [];
    for (k = 0; k < mp.length; k++) {
      var d = mp[k], dn = new Float32Array(n * 3);
      for (i = 0; i < n; i++) {
        var x = (rel ? p0.getX(i) : 0) + d.getX(i) - C.x, y = (rel ? p0.getY(i) : 0) + d.getY(i) - C.y, z = (rel ? p0.getZ(i) : 0) + d.getZ(i) - C.z, l = Math.sqrt(x * x + y * y + z * z) || 1;
        dn[i * 3] = x / l - (rel ? n0.getX(i) : 0); dn[i * 3 + 1] = y / l - (rel ? n0.getY(i) : 0); dn[i * 3 + 2] = z / l - (rel ? n0.getZ(i) : 0);
      }
      out.push(new THREE.BufferAttribute(dn, 3));
    }
    g.morphAttributes.normal = out;
  }
  /* Paupières haute/basse : coquilles autour du globe, éclairées comme une boule (basse dans l'ombre = « poche » −20 %, haute trop claire)
     et peintes plus jaune que la peau, sans le rose des joues (coupure nette, « œil de panda »). Une fois au chargement, pour le repos et
     chaque forme : normale = 80 % celle de la peau la plus proche (même forme sur la peau si elle existe), couleur = peau propre (_skin) la
     plus proche en position plissée (prise au plus près de la peau, la paupière haute fermée prenait le rose des joues). Mesuré au gros plan plissé : écart à la peau −4 % / −2 % (Blender −3 % / 0). */
  /* Malicieux (plissé) : la paupière haute part du repos très haut (trajet ~124 px contre 74 pour le cil) → avec la même courbe, le globe se voyait entre la peau et le cil.
     Forme « avance » par direction autour de l'œil : a = (cil repos − paupière repos) / (paupière plissée − paupière repos), en hauteur angulaire (×0,95, plafond 0,75) ;
     poids = lissé(plissé/0,1) × (1 − plissé) (majPeau) : la paupière rejoint tout de suite le cil, puis les deux finissent ensemble. Trou 1294 → 28 px, cil jamais caché.
     + arrondi limité : à mi-chemin la coquille rentrait dans le globe (marche sombre sous la peau) ; rayon ≥ min(repos, 0,187) (pied du cil 0,1876 : 0,188 en cachait déjà 5 %) */
  function avancePaupiere(THREE, scene) {
    var B = 5, MARGE = 0.95, PLAF = 0.75, RC = 0.187, v = new THREE.Vector3(), out = [];
    scene.updateMatrixWorld(true);
    ['0', '1'].forEach(function (n) {
      var P = scene.getObjectByName('paupiere' + n), C = scene.getObjectByName('cils_ouv' + n);
      if (!P || !C || !P.morphTargetDictionary || P.morphTargetDictionary.plisse === undefined || !C.morphTargetDictionary || C.morphTargetDictionary.plisse === undefined) return;
      var inv = P.matrixWorld.clone().invert();
      function sph(o, wt, loc, cb) { var g = o.geometry, p = g.attributes.position, mp = g.morphAttributes.position[o.morphTargetDictionary.plisse]; for (var i = 0; i < p.count; i++) { v.set(p.getX(i) + wt * mp.getX(i), p.getY(i) + wt * mp.getY(i), p.getZ(i) + wt * mp.getZ(i)); if (loc) v.applyMatrix4(o.matrixWorld).applyMatrix4(inv); var r = v.length(); cb(i, Math.atan2(v.x, v.z) * 180 / Math.PI, Math.asin(v.y / r) * 180 / Math.PI); } }
      function minEl(o, wt, loc) { var m = {}; sph(o, wt, loc, function (i, a, e) { if (Math.abs(a) > 100) return; var b = Math.floor((a + 180) / B); if (m[b] === undefined || e < m[b]) m[b] = e; }); return m; }
      var P0 = minEl(P, 0), P1 = minEl(P, 1), C0 = minEl(C, 0, true), pts = [];
      Object.keys(C0).map(Number).sort(function (a, b) { return a - b; }).forEach(function (b) { if (P0[b] === undefined) return; pts.push([b * B - 180 + B / 2, Math.max(0, Math.min(PLAF, MARGE * (C0[b] - P0[b]) / (P1[b] - P0[b])))]); });
      if (!pts.length) return;
      function aDe(az) { if (az <= pts[0][0]) return pts[0][1]; for (var k = 1; k < pts.length; k++) if (az <= pts[k][0]) { var u = (az - pts[k - 1][0]) / (pts[k][0] - pts[k - 1][0]); return pts[k - 1][1] + u * (pts[k][1] - pts[k - 1][1]); } return pts[pts.length - 1][1]; }
      var g = P.geometry, ip = P.morphTargetDictionary.plisse, mp = g.morphAttributes.position[ip], mn = g.morphAttributes.normal && g.morphAttributes.normal[ip], cnt = g.attributes.position.count, dp = new Float32Array(cnt * 3), dn = new Float32Array(cnt * 3);
      sph(P, 0, false, function (i, a) { var s = aDe(a); dp[i * 3] = s * mp.getX(i); dp[i * 3 + 1] = s * mp.getY(i); dp[i * 3 + 2] = s * mp.getZ(i); if (mn) { dn[i * 3] = s * mn.getX(i); dn[i * 3 + 1] = s * mn.getY(i); dn[i * 3 + 2] = s * mn.getZ(i); } });
      g.morphAttributes.position.push(new THREE.BufferAttribute(dp, 3)); if (g.morphAttributes.normal) g.morphAttributes.normal.push(new THREE.BufferAttribute(dn, 3));
      P.morphTargetDictionary.avance = P.morphTargetInfluences.length; P.morphTargetInfluences.push(0); P.material.needsUpdate = true;
      /* Coins de la paupière haute pendant le plissé (u = angle vers le nez, base de la forme) :
         « corr » = coin intérieur : delta plissé × lissé((u − 17)/4), poids 0,12 × avance + 0,025 × plissé (trou au bout intérieur du cil 219 → 0 px) ;
         « ext » = coin extérieur : le bord roulé (r < 0,1926) avance vers la caméra au-delà de u −22,3 (plein dès −26,5), 0,013 × avance
         (le bourrelet de peau du corps passait devant la paupière : coin sombre entre paupière et cil 253 → 52 px, aucune bande sous le cil). */
      var p3 = g.attributes.position, dc = new Float32Array(cnt * 3), de = new Float32Array(cnt * 3), dz = new THREE.Vector3(0, 0, 1).applyMatrix3(new THREE.Matrix3().setFromMatrix4(P.matrixWorld).invert());
      for (var i = 0; i < cnt; i++) {
        var x = p3.getX(i), y = p3.getY(i), z = p3.getZ(i), r = Math.hypot(x, y, z), aa = Math.atan2(x, z) * 180 / Math.PI, u = n === '1' ? -aa : aa;
        var sc = Math.min(1, Math.max(0, (u - 17) / 4)); sc = sc * sc * (3 - 2 * sc); dc[i * 3] = sc * mp.getX(i); dc[i * 3 + 1] = sc * mp.getY(i); dc[i * 3 + 2] = sc * mp.getZ(i);
        var se = Math.abs(aa) > 100 ? 0 : Math.min(1, Math.max(0, (-22.3 - u) / 4.2)); se = se * se * (3 - 2 * se); se *= 0.013 * Math.min(1, Math.max(0, (0.1926 - r) / (0.1926 - 0.1837)));
        de[i * 3] = se * dz.x; de[i * 3 + 1] = se * dz.y; de[i * 3 + 2] = se * dz.z;
      }
      [['corr', dc], ['ext', de]].forEach(function (f) { g.morphAttributes.position.push(new THREE.BufferAttribute(f[1], 3)); if (g.morphAttributes.normal) g.morphAttributes.normal.push(new THREE.BufferAttribute(new Float32Array(cnt * 3), 3)); P.morphTargetDictionary[f[0]] = P.morphTargetInfluences.length; P.morphTargetInfluences.push(0); });
      out.push([P.morphTargetInfluences, ip, P.morphTargetDictionary.avance, P.morphTargetDictionary.corr, P.morphTargetDictionary.ext]);
      /* Cil dessiné par-dessus la paupière (pochoir) : la coque avant de la paupière descendait sous le haut du cil (u −14..−18, cil 30 → 13 px).
         La paupière marque ses pixels visibles ; une copie du cil s'y dessine sans test de profondeur (seulement là où la paupière est visible). */
      var pm = P.material; pm.stencilWrite = true; pm.stencilRef = 1; pm.stencilFunc = THREE.AlwaysStencilFunc; pm.stencilZPass = THREE.ReplaceStencilOp; pm.needsUpdate = true; P.renderOrder = 1;
      var cm = C.material.clone(); cm.depthFunc = THREE.AlwaysDepth; cm.stencilWrite = true; cm.stencilWriteMask = 0; cm.stencilRef = 1; cm.stencilFunc = THREE.EqualStencilFunc;
      var C2 = new THREE.Mesh(C.geometry, cm); C2.name = 'cils_dessus' + n; C2.morphTargetInfluences = C.morphTargetInfluences; C2.morphTargetDictionary = C.morphTargetDictionary; C2.renderOrder = 2; C2.frustumCulled = false; C.add(C2);
    });
    var p0 = scene.getObjectByName('paupiere0');
    if (out.length && p0) {
      var mat = p0.material, old = mat.onBeforeCompile, k0 = mat.customProgramCacheKey.bind(mat);
      mat.onBeforeCompile = function (sh, r) { if (old) old.call(this, sh, r); sh.vertexShader = sh.vertexShader.replace('#include <morphtarget_vertex>', '#include <morphtarget_vertex>\n  transformed = normalize(transformed) * max(length(transformed), min(length(position), ' + RC.toFixed(4) + '));'); };
      mat.customProgramCacheKey = function () { return k0() + '|r' + RC; }; mat.needsUpdate = true;
    }
    return out;
  }
  function paupieresPeau(THREE, scene, corps) {
    scene.updateMatrixWorld(true);
    var L = []; scene.traverse(function (o) { if (o.isMesh && /^paupiere(_bas)?\d$/.test(o.name) && o.geometry.attributes.color) L.push(o); });
    if (!L.length) return;
    var sg = corps.geometry, sp = sg.attributes.position, sn = sg.attributes.normal, sk = sg.attributes._skin, smp = sg.morphAttributes.position || [], smn = sg.morphAttributes.normal || [], sd = corps.morphTargetDictionary || {};
    var sM = corps.matrixWorld, sN = new THREE.Matrix3().getNormalMatrix(sM), v = new THREE.Vector3(), w = new THREE.Vector3(), i, j, k, s;
    function posL(P, j, ks) { v.fromBufferAttribute(P.p0, j); if (ks >= 0 && P.mp[ks]) { if (P.rel) { v.x += P.mp[ks].getX(j); v.y += P.mp[ks].getY(j); v.z += P.mp[ks].getZ(j); } else v.fromBufferAttribute(P.mp[ks], j); } return v.applyMatrix4(P.M); }
    var etats = [null];
    L = L.map(function (o) {
      var g = o.geometry, dic = o.morphTargetDictionary || {}, names = [];
      for (var nm in dic) { names[dic[nm]] = nm; if (etats.indexOf(nm) < 0) etats.push(nm); }
      var NM = new THREE.Matrix3().getNormalMatrix(o.matrixWorld), n = g.attributes.position.count;
      return { g: g, p0: g.attributes.position, n0: g.attributes.normal, col: g.attributes.color, mp: g.morphAttributes.position || [], rel: g.morphTargetsRelative, n: n, M: o.matrixWorld, NM: NM, inv: NM.clone().invert(), names: names, coul: names.indexOf('plisse'), cible: [], bestD: new Float32Array(n).fill(1e9), bestC: new Int32Array(n).fill(-1) };
    });
    /* La paupière est une grande demi-sphère (rayon du globe), surtout cachée dans la tête : seule compte la peau autour de l'œil
       (à moins de rayon + 5 cm du centre du globe) ; les points de paupière loin de cette peau (partie cachée) sont sautés */
    var cs0 = []; ['oeil0', 'oeil1'].forEach(function (nm) { var e = scene.getObjectByName(nm); if (e) cs0.push(e.getWorldPosition(new THREE.Vector3())); });
    if (!cs0.length) return;
    var R = 0; L.forEach(function (P) { var m = 0; for (j = 0; j < P.n; j++) { posL(P, j, -1); m += Math.min.apply(null, cs0.map(function (c) { return c.distanceTo(v); })); } R = Math.max(R, m / P.n); }); R += 0.05;
    var GC = 0.04, occ = new Set(), ck = function (x, y, z) { return (Math.floor(x / GC) + 512) * 1048576 + (Math.floor(y / GC) + 512) * 1024 + (Math.floor(z / GC) + 512); };
    var cand = [], box = new THREE.Box3(), fin = new Set();   /* un point de peau tous les 6 mm suffit (couleur et éclairage varient doucement) : calcul ÷ 5 */
    for (i = 0; i < sp.count; i++) { if (sk.getX(i) < 0.3) continue; v.fromBufferAttribute(sp, i).applyMatrix4(sM); var pr = false; for (k = 0; k < cs0.length; k++) if (cs0[k].distanceTo(v) < R) pr = true; if (!pr) continue; var fk = (Math.floor(v.x / 0.006) + 512) * 1048576 + (Math.floor(v.y / 0.006) + 512) * 1024 + (Math.floor(v.z / 0.006) + 512); if (fin.has(fk)) continue; fin.add(fk); cand.push(i); box.expandByPoint(v); var bx = Math.floor(v.x / GC), by = Math.floor(v.y / GC), bz = Math.floor(v.z / GC); for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) for (var d = -1; d <= 1; d++) occ.add((bx + a + 512) * 1048576 + (by + b + 512) * 1024 + (bz + d + 512)); }   /* R < 0,3 = points mal peints au fond des creux */
    if (!cand.length) return;
    box.expandByScalar(0.06);
    var CELL = 0.02, RMAX = 3, ox = box.min.x, oy = box.min.y, oz = box.min.z, NX = Math.ceil((box.max.x - ox) / CELL) + 1, NY = Math.ceil((box.max.y - oy) / CELL) + 1, NZ = Math.ceil((box.max.z - oz) / CELL) + 1;
    function grille(nom) {   /* peau (positions/normales monde) dans la forme « nom » (ou au repos), rangée en cases numériques */
      var ki = nom && sd[nom] !== undefined ? sd[nom] : -1, nc = cand.length, P = new Float32Array(nc * 3), Q = new Float32Array(nc * 3), cs = new Int32Array(nc), deb = new Int32Array(NX * NY * NZ + 1), ord = new Int32Array(nc), c;
      for (c = 0; c < nc; c++) {
        var a = cand[c]; v.fromBufferAttribute(sp, a); w.fromBufferAttribute(sn, a);
        if (ki >= 0) { if (smp[ki]) { v.x += smp[ki].getX(a); v.y += smp[ki].getY(a); v.z += smp[ki].getZ(a); } if (smn[ki]) { w.x += smn[ki].getX(a); w.y += smn[ki].getY(a); w.z += smn[ki].getZ(a); } }
        v.applyMatrix4(sM); w.applyMatrix3(sN).normalize(); P[c * 3] = v.x; P[c * 3 + 1] = v.y; P[c * 3 + 2] = v.z; Q[c * 3] = w.x; Q[c * 3 + 1] = w.y; Q[c * 3 + 2] = w.z;
        var ix = Math.floor((v.x - ox) / CELL), iy = Math.floor((v.y - oy) / CELL), iz = Math.floor((v.z - oz) / CELL);
        cs[c] = ix < 0 || iy < 0 || iz < 0 || ix >= NX || iy >= NY || iz >= NZ ? -1 : ix + NX * (iy + NY * iz); if (cs[c] >= 0) deb[cs[c] + 1]++;
      }
      for (c = 1; c < deb.length; c++) deb[c] += deb[c - 1];
      var pos = deb.slice(0, -1); for (c = 0; c < nc; c++) if (cs[c] >= 0) ord[pos[cs[c]]++] = c;
      return { P: P, Q: Q, deb: deb, ord: ord };
    }
    function proche(G, x, y, z) {
      var cx = Math.floor((x - ox) / CELL), cy = Math.floor((y - oy) / CELL), cz = Math.floor((z - oz) / CELL), best = -1, bd = 1e9, P = G.P;
      for (var r = 0; r <= RMAX; r++) {   /* anneaux de cases de plus en plus larges ; arrêt dès qu'aucune case plus loin ne peut faire mieux */
        for (var c3 = Math.max(0, cz - r); c3 <= Math.min(NZ - 1, cz + r); c3++) for (var c2 = Math.max(0, cy - r); c2 <= Math.min(NY - 1, cy + r); c2++) for (var c1 = Math.max(0, cx - r); c1 <= Math.min(NX - 1, cx + r); c1++) {
          if (Math.max(Math.abs(c1 - cx), Math.abs(c2 - cy), Math.abs(c3 - cz)) !== r) continue;
          var id = c1 + NX * (c2 + NY * c3); for (var t = G.deb[id], f = G.deb[id + 1]; t < f; t++) { var e = G.ord[t], dx = P[e * 3] - x, dy = P[e * 3 + 1] - y, dz = P[e * 3 + 2] - z, q = dx * dx + dy * dy + dz * dz; if (q < bd) { bd = q; best = e; } }
        }
        if (best >= 0 && bd <= r * r * CELL * CELL) break;
      }
      return best < 0 ? null : [best, bd];
    }
    var LISSE = 0.025;
    function moyenne(G, e) {   /* normale de peau moyennée sur ~2,5 cm autour du point le plus proche : un seul point recopiait les petits creux de l'orbite (paupière « froissée ») */
      var P = G.P, Q = G.Q, x = P[e * 3], y = P[e * 3 + 1], z = P[e * 3 + 2], cx = Math.floor((x - ox) / CELL), cy = Math.floor((y - oy) / CELL), cz = Math.floor((z - oz) / CELL), rr = Math.ceil(LISSE / CELL), sx = 0, sy = 0, sz = 0;
      for (var c3 = Math.max(0, cz - rr); c3 <= Math.min(NZ - 1, cz + rr); c3++) for (var c2 = Math.max(0, cy - rr); c2 <= Math.min(NY - 1, cy + rr); c2++) for (var c1 = Math.max(0, cx - rr); c1 <= Math.min(NX - 1, cx + rr); c1++) {
        var id = c1 + NX * (c2 + NY * c3); for (var t = G.deb[id], f = G.deb[id + 1]; t < f; t++) { var q = G.ord[t], dx = P[q * 3] - x, dy = P[q * 3 + 1] - y, dz = P[q * 3 + 2] - z, d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d >= LISSE) continue; var wt = 1 - d / LISSE; sx += Q[q * 3] * wt; sy += Q[q * 3 + 1] * wt; sz += Q[q * 3 + 2] * wt; }
      }
      var l = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1; return [sx / l, sy / l, sz / l];
    }
    for (s = 0; s < etats.length; s++) {   /* une grille de peau à la fois, partagée par les 4 paupières */
      var G = grille(etats[s]);
      L.forEach(function (P) {
        var ks = s === 0 ? -1 : P.names.indexOf(etats[s]); if (s > 0 && ks < 0) return;
        var out = new Float32Array(P.n * 3);
        for (j = 0; j < P.n; j++) {
          posL(P, j, ks); w.fromBufferAttribute(P.n0, j).applyMatrix3(P.NM).normalize();
          var r = occ.has(ck(v.x, v.y, v.z)) ? proche(G, v.x, v.y, v.z) : null;
          if (r) { var e = r[0], nm = moyenne(G, e); w.multiplyScalar(0.2); w.x += 0.8 * nm[0]; w.y += 0.8 * nm[1]; w.z += 0.8 * nm[2]; if (ks >= 0 && (P.coul < 0 || ks === P.coul) && r[1] < P.bestD[j]) { P.bestD[j] = r[1]; P.bestC[j] = cand[e]; } }
          w.applyMatrix3(P.inv).normalize(); out[j * 3] = w.x; out[j * 3 + 1] = w.y; out[j * 3 + 2] = w.z;
        }
        P.cible[ks + 1] = out;
      });
    }
    L.forEach(function (P) {
      var base = P.cible[0], n = P.n;
      if (P.mp.length) { var mn = []; for (k = 0; k < P.mp.length; k++) { var Tk = P.cible[k + 1], dn = new Float32Array(n * 3); if (Tk) for (j = 0; j < n * 3; j++) dn[j] = Tk[j] - base[j]; mn.push(new THREE.BufferAttribute(dn, 3)); } P.g.morphAttributes.normal = mn; }   /* écarts de normale par forme (glTF : formes relatives) */
      for (j = 0; j < n; j++) P.n0.setXYZ(j, base[j * 3], base[j * 3 + 1], base[j * 3 + 2]); P.n0.needsUpdate = true;
      for (j = 0; j < n; j++) { var b2 = P.bestC[j]; if (b2 >= 0) P.col.setXYZ(j, Math.min(1, sk.getX(b2)), Math.min(1, sk.getY(b2)), Math.min(1, sk.getZ(b2))); }   /* _skin monte jusqu'à 1,053 : borné, sinon débordement (couleur 16 bits) = tache bleue */
      P.col.needsUpdate = true;
    });
  }
  function verre(THREE) {   /* cornée comme Blender : invisible de face (l'ancien blanc à 10 % délavait l'iris), léger éclat seulement vers le bord (Fresnel) */
    var m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, roughness: 0.06, metalness: 0, depthWrite: false, side: THREE.FrontSide, specularIntensity: 1.0 });
    m.onBeforeCompile = function (sh) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\n{float fr=1.0-clamp(abs(dot(normalize(vNormal),normalize(vViewPosition))),0.0,1.0);gl_FragColor.a=0.35*fr*fr*fr;}');
    };
    return m;
  }
  /* Iris : les couleurs cuites par sommet (export léger) étaient floues et une lueur grise uniforme le délavait. Couleur recalculée par pixel
     comme le matériau Blender (patate3d.py o3_mat_iris) : dégradé haut sombre → bas clair, fibres, plus sombre près de la pupille, anneau bleu nuit ;
     lueur = couleur de l'iris × 0,5 (mesuré : moyenne sur le masque Blender 70,99,121 / Blender 76,106,127 ; avant 0,037 gris). Repères (r, angle, hauteur) retrouvés depuis la forme : bord r = 1 centré sur l'iris, bord intérieur r = 0,66 centré sur la pupille. */
  function irisRep(THREE, o) {
    var pu = null; o.parent.children.forEach(function (s) { if (s.isMesh && s.material && s.material.name === 'oeil_pupille') pu = s; });
    var p = o.geometry.attributes.position, b = new THREE.Box3().setFromBufferAttribute(p), bp = pu ? new THREE.Box3().setFromBufferAttribute(pu.geometry.attributes.position) : b;
    var icx = (b.min.x + b.max.x) / 2, icy = (b.min.y + b.max.y) / 2, rx = (b.max.x - b.min.x) / 2, ry = (b.max.y - b.min.y) / 2;
    var pcx = (bp.min.x + bp.max.x) / 2, pcy = (bp.min.y + bp.max.y) / 2, PUP = 0.66, a = new Float32Array(p.count * 4);
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i), r = Math.hypot((x - icx) / rx, (y - icy) / ry), cx = icx, cy = icy;
      for (var k = 0; k < 6; k++) { var t = Math.min(1, Math.max(0, (r - PUP) / (1 - PUP))); cx = pcx + t * (icx - pcx); cy = pcy + t * (icy - pcy); r = Math.hypot((x - cx) / rx, (y - cy) / ry); }
      var u = (x - cx) / rx, v = (y - cy) / ry, n = Math.hypot(u, v) || 1;
      a[i * 4] = r; a[i * 4 + 1] = u / n; a[i * 4 + 2] = v / n; a[i * 4 + 3] = (y - icy) / ry;
    }
    o.geometry.setAttribute('irisRep', new THREE.BufferAttribute(a, 4));
  }
  function irisMat(THREE, m) {
    function c(r, g, b) { var q = new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace); return 'vec3(' + q.r.toFixed(5) + ',' + q.g.toFixed(5) + ',' + q.b.toFixed(5) + ')'; }
    var U = m.userData.irisU = { emk: { value: 0.5 }, fib: { value: 1.0 } };
    m.emissive.setRGB(0, 0, 0);
    m.onBeforeCompile = function (sh) {
      sh.uniforms.irisEmk = U.emk; sh.uniforms.irisFib = U.fib;
      sh.vertexShader = 'attribute vec4 irisRep;\nvarying vec4 vIris;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvIris = irisRep;');
      sh.fragmentShader = 'varying vec4 vIris;\nuniform float irisEmk, irisFib;\n' +
        'float irH(vec3 p){p=fract(p*0.3183099+0.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}\n' +
        'float irN(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);return mix(mix(mix(irH(i),irH(i+vec3(1,0,0)),f.x),mix(irH(i+vec3(0,1,0)),irH(i+vec3(1,1,0)),f.x),f.y),mix(mix(irH(i+vec3(0,0,1)),irH(i+vec3(1,0,1)),f.x),mix(irH(i+vec3(0,1,1)),irH(i+vec3(1,1,1)),f.x),f.y),f.z);}\n' +
        'float irS(float v,float a,float b){return smoothstep(0.0,1.0,clamp((v-a)/(b-a),0.0,1.0));}\n' +
        sh.fragmentShader.replace('#include <color_fragment>',
          '{float r=vIris.x,pz=vIris.w;vec2 cs=normalize(vIris.yz+1e-6);\n' +
          'vec3 c=mix(' + c(46, 54, 72) + ',' + c(44, 72, 98) + ',irS(pz,0.75,0.0));c=mix(c,' + c(92, 142, 172) + ',irS(pz,0.0,-0.9));\n' +
          'vec3 q=vec3(9.0*cs,1.4*r);float n=(irN(q)+0.6*irN(q*2.0)+0.86*0.5)/2.46;\n' +
          'c*=mix(1.0,mix(0.82,1.18,irS(n,0.3,0.7))*0.92,irisFib);\n' +
          'c*=mix(0.78,1.0,irS(r,0.66,0.80));c=mix(c,' + c(20, 22, 38) + ',irS(r,0.865,0.935));diffuseColor.rgb=c;}')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance=diffuseColor.rgb*irisEmk;');
    };
    m.needsUpdate = true;
  }
  /* Blanc de l'œil : l'ombre du creux (occlusion cuite par sommet au repos) était peinte SUR le globe ; quand l'œil tourne (regard), elle entrait
     dans le blanc (plaque brune à bord en escalier). On la range dans une petite image indexée par la direction vue depuis l'orbite, et le shader
     la lit avec la rotation de l'œil retirée : l'ombre reste fixe dans le creux, lissée (plus de triangles visibles). */
  function blancFixe(THREE, o) {
    /* Sous l'iris, la cuisson est presque noire (l'iris cachait la lumière) : c'est pourtant du blanc qui apparaît quand l'œil tourne.
       Zone sous l'iris = couleur du blanc réellement visible au repos ; ailleurs = cuisson (ombre douce des paupières), lissée. */
    var p = o.geometry.attributes.position, c = o.geometry.attributes.color, n = p.count, W = 128, H = 64, i, k;
    var dx = new Float32Array(n), dy = new Float32Array(n), dz = new Float32Array(n), ax = 0, ay = 0, az = 0, rI = 0, ir = null;
    for (i = 0; i < n; i++) { var x = p.getX(i), y = p.getY(i), z = p.getZ(i), l = Math.sqrt(x * x + y * y + z * z) || 1; dx[i] = x / l; dy[i] = y / l; dz[i] = z / l; }
    o.traverse(function (s) { if (!ir && s.isMesh && s.material && s.material.name === 'oeil_iris') ir = s.geometry.attributes.position; });
    if (ir) {
      for (i = 0; i < ir.count; i++) { var ix = ir.getX(i), iy = ir.getY(i), iz = ir.getZ(i), il = Math.sqrt(ix * ix + iy * iy + iz * iz) || 1; ax += ix / il; ay += iy / il; az += iz / il; }
      var al = Math.sqrt(ax * ax + ay * ay + az * az); ax /= al; ay /= al; az /= al;
      for (i = 0; i < ir.count; i++) { var jl = Math.sqrt(ir.getX(i) * ir.getX(i) + ir.getY(i) * ir.getY(i) + ir.getZ(i) * ir.getZ(i)) || 1; rI = Math.max(rI, Math.acos(Math.min(1, (ir.getX(i) * ax + ir.getY(i) * ay + ir.getZ(i) * az) / jl))); }
    } else { az = 1; }
    var wr = 0, wg = 0, wb = 0, wn = 0, lmax = 0;   /* couleur du blanc visible : sommets les plus clairs à l'avant */
    for (i = 0; i < n; i++) if (dx[i] * ax + dy[i] * ay + dz[i] * az > 0.7) lmax = Math.max(lmax, 0.3 * c.getX(i) + 0.59 * c.getY(i) + 0.11 * c.getZ(i));
    for (i = 0; i < n; i++) if (dx[i] * ax + dy[i] * ay + dz[i] * az > 0.7 && 0.3 * c.getX(i) + 0.59 * c.getY(i) + 0.11 * c.getZ(i) > lmax * 0.88) { wr += c.getX(i); wg += c.getY(i); wb += c.getZ(i); wn++; }
    wr /= wn; wg /= wn; wb /= wn;
    var d = new Uint8Array(W * H * 4), S2 = 0.0016, cMin = Math.cos(1.2), dk = Math.PI / 180;
    var ref = [0, 0, 0]; for (i = 0; i < n; i++) if (dx[i] * ax + dy[i] * ay + dz[i] * az < cMin) { ref[0] += c.getX(i); ref[1] += c.getY(i); ref[2] += c.getZ(i); ref[3] = (ref[3] || 0) + 1; }
    if (ref[3]) { ref[0] /= ref[3]; ref[1] /= ref[3]; ref[2] /= ref[3]; }
    for (k = 0; k < W * H; k++) {
      var u = ((k % W) + 0.5) / W, v = (Math.floor(k / W) + 0.5) / H, th = (u - 0.5) * 2 * Math.PI, ph = v * Math.PI;
      var tx = Math.sin(ph) * Math.sin(th), ty = Math.cos(ph), tz = Math.sin(ph) * Math.cos(th), sw = 0, r = ref[0], g = ref[1], b = ref[2];
      var fa = tx * ax + ty * ay + tz * az;
      if (fa > cMin) {
        r = g = b = 0;
        for (i = 0; i < n; i++) { var q = tx * dx[i] + ty * dy[i] + tz * dz[i]; if (q < 0.985) continue; var w = Math.exp((q - 1) / S2); sw += w; r += w * c.getX(i); g += w * c.getY(i); b += w * c.getZ(i); }
        if (sw > 1e-6) { r /= sw; g /= sw; b /= sw; } else { r = ref[0]; g = ref[1]; b = ref[2]; }
        var an = Math.acos(Math.min(1, fa)), wI = Math.min(1, Math.max(0, (rI + 2.5 * dk - an) / (4 * dk)));   /* 1 sous l'iris, fondu sur ~4° */
        wI = wI * wI * (3 - 2 * wI); r += (Math.max(r, wr) - r) * wI; g += (Math.max(g, wg) - g) * wI; b += (Math.max(b, wb) - b) * wI;
      }
      d[k * 4] = Math.round(r * 255); d[k * 4 + 1] = Math.round(g * 255); d[k * 4 + 2] = Math.round(b * 255); d[k * 4 + 3] = 255;
    }
    var t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
    var e = { o: o, m4: new THREE.Matrix4(), u: { value: new THREE.Matrix3() } };
    o.material.onBeforeCompile = function (sh) {
      sh.uniforms.uAO = { value: t }; sh.uniforms.uRotO = e.u;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat3 uRotO;varying vec3 vDirO;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvDirO = uRotO * transformed;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uAO;varying vec3 vDirO;')
        .replace('#include <color_fragment>', '{vec3 dd=normalize(vDirO);vec2 uv=vec2(atan(dd.x,dd.z)/6.2831853+0.5,acos(clamp(dd.y,-1.0,1.0))/3.1415927);diffuseColor.rgb*=texture2D(uAO,uv).rgb;}');
    };
    o.material.needsUpdate = true;
    return e;
  }
  /* Fantômes de sourcils et de bouche : la peau porte, peints dessous, le sourcil et le sourire de REPOS (cachés par les vrais au repos).
     Quand le sourcil ou la bouche bougent, la peinture restait visible (sourcils en X, bouche en double). On marque les sommets de peau proches
     du sourcil / de la bouche de repos (attribut _fant : x sourcil, y bouche, fondu doux) ; le shader y passe en peau propre (_skin) selon les clés. */
  function fantomes(THREE, corps, mS, mB, iN) {
    var g = corps.geometry, bp0 = g.attributes.position, n = bp0.count, f = new Float32Array(n * 2);
    var iCN = corps.morphTargetDictionary ? corps.morphTargetDictionary.bouche_neutre : undefined, mdC = iCN !== undefined && g.morphAttributes.position ? g.morphAttributes.position[iCN] : null;
    var bp = { getX: function (i) { return bp0.getX(i) + (mdC ? mdC.getX(i) : 0); }, getY: function (i) { return bp0.getY(i) + (mdC ? mdC.getY(i) : 0); }, getZ: function (i) { return bp0.getZ(i) + (mdC ? mdC.getZ(i) : 0); } };   /* peau dans sa forme de repos */
    corps.updateMatrixWorld(true); var inv = corps.matrixWorld.clone().invert();
    function pts(o, dIdx) {
      if (!o) return [];
      o.updateMatrixWorld(true); var p = o.geometry.attributes.position, md = (dIdx >= 0 && o.geometry.morphAttributes.position) ? o.geometry.morphAttributes.position[dIdx] : null, r = [], v = new THREE.Vector3(), mt = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (md) { v.x += md.getX(i); v.y += md.getY(i); v.z += md.getZ(i); } v.applyMatrix4(mt); r.push(v.x, v.y, v.z); }
      return r;
    }
    function marque(P, axe, R0, R1) {
      if (!P.length) return;
      var C = R1, cells = {}, i, k, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (i = 0; i < P.length; i += 3) { var key = Math.floor(P[i] / C) + ',' + Math.floor(P[i + 1] / C) + ',' + Math.floor(P[i + 2] / C); (cells[key] || (cells[key] = [])).push(i); for (k = 0; k < 3; k++) { if (P[i + k] < mn[k]) mn[k] = P[i + k]; if (P[i + k] > mx[k]) mx[k] = P[i + k]; } }
      for (i = 0; i < n; i++) {
        var x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
        if (x < mn[0] - R1 || x > mx[0] + R1 || y < mn[1] - R1 || y > mx[1] + R1 || z < mn[2] - R1 || z > mx[2] + R1) continue;
        var cx = Math.floor(x / C), cy = Math.floor(y / C), cz = Math.floor(z / C), d2 = R1 * R1, a, b, c2;
        for (a = -1; a <= 1; a++) for (b = -1; b <= 1; b++) for (c2 = -1; c2 <= 1; c2++) { var L = cells[(cx + a) + ',' + (cy + b) + ',' + (cz + c2)]; if (!L) continue; for (k = 0; k < L.length; k++) { var j = L[k], dx = P[j] - x, dy = P[j + 1] - y, dz = P[j + 2] - z, dd = dx * dx + dy * dy + dz * dz; if (dd < d2) d2 = dd; } }
        var d = Math.sqrt(d2); if (d >= R1) continue;
        var t = Math.min(1, Math.max(0, (R1 - d) / (R1 - R0))); f[i * 2 + axe] = t * t * (3 - 2 * t);
      }
    }
    marque(pts(mS, -1), 0, 0.010, 0.018);
    var sil = [];   /* sourire de repos = sillon creusé dans la peau par la clé bouche_neutre du corps (peinture cuite sur ce sillon) */
    if (mdC) for (var si = 0; si < n; si++) { var ddx = mdC.getX(si), ddy = mdC.getY(si), ddz = mdC.getZ(si); if (ddx * ddx + ddy * ddy + ddz * ddz > 4e-6) sil.push(bp0.getX(si), bp0.getY(si), bp0.getZ(si)); }
    bp = bp0; marque(sil, 1, 0.005, 0.013);
    g.setAttribute('_fant', new THREE.BufferAttribute(f, 2));
  }
  /* Points blancs des joues (ref2 : 2 à gauche, 1 à droite) : peints par sommet ils faisaient des taches à bords déchiquetés (maillage grossier
     sur les joues) ; glb_leger.py les efface de la peinture et on les dessine ici en ronds nets, pixel par pixel, accrochés à la peau (position
     de repos du sommet : ils suivent la joue en joie). Centre = point de la peau vu de face en (x, y). */
  function points(THREE, corps, skU) {
    var L = [[-0.200, -0.045, 0.0080], [0.2112, -0.045, 0.0080], [-0.1801, -0.0559, 0.0046], [0.1913, -0.0559, 0.0046]]   /* point de droite = miroir du gros point de gauche autour de l'axe du visage (x = 0,0056) */, rc = new THREE.Raycaster();
    corps.updateMatrixWorld(true);
    skU.pts = L.map(function (p) {
      rc.set(new THREE.Vector3(p[0], p[1], 2).applyMatrix4(corps.matrixWorld), new THREE.Vector3(0, 0, -1));
      var h = rc.intersectObject(corps, false)[0], q = h ? corps.worldToLocal(h.point.clone()) : new THREE.Vector3(p[0], p[1], 0.18);
      return { value: new THREE.Vector4(q.x, q.y, q.z, p[2]) };
    });
  }
  function bruit(THREE) {
    var n = 128, d = new Uint8Array(n * n * 4), i;
    for (i = 0; i < n * n; i++) { var v = 93 + Math.floor((Math.random() + Math.random() + Math.random()) / 3 * 70); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    var t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
  }
  var GRAIN_F = { value: [2.2, 1.4] };   /* force du grain fin / très fin (bruit centré sur 0,5 ; l'ancien décalage qui éclaircissait la peau est gardé en facteur fixe) */
  function feutre(m, noise, gU, skU) {   /* grain de feutre fin : bruit mélangé selon trois axes dans l'espace du modèle (suit le squelette) */
    m.roughness = 0.72; if (m.sheen !== undefined) { m.sheen = 0.6; }
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uGrain = { value: noise }; sh.uniforms.uGA = gU; sh.uniforms.uGF = GRAIN_F;
      if (skU) {   /* peau propre : fond COLOR_0 vers _skin (sans creux d'orbite ni ombre de bouche) selon les clés yeux fermés / bouche ouverte */
        sh.uniforms.uWE = skU.we; sh.uniforms.uWM = skU.wm; sh.uniforms.uWS = skU.ws; sh.uniforms.uWB = skU.wb;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 _skin;attribute vec2 _fant;uniform float uWE;uniform float uWM;uniform float uWS;uniform float uWB;')
          .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_COLOR\nvColor.rgb = mix(vColor.rgb, _skin.rgb, max(max(_skin.a < 0.5 ? 0.0 : (_skin.a < 1.5 ? uWE : uWM), _fant.x * uWS), _fant.y * uWB));\n#endif');
      }
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;varying vec3 vON;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;vON = normal;');
      if (m.name === 'paupiere_joie') sh.vertexShader = sh.vertexShader.replace('#include <morphtarget_vertex>', '#include <morphtarget_vertex>\nvOP = transformed;vON = objectNormal;');   /* paupière de joie : tassée au repos, dépliée par les formes → le grain pris au repos s'étirait en rayures ; il suit ici la forme */
      if (skU && skU.pts) { sh.uniforms.uPt0 = skU.pts[0]; sh.uniforms.uPt1 = skU.pts[1]; sh.uniforms.uPt2 = skU.pts[2]; sh.uniforms.uPt3 = skU.pts[3]; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec4 uPt0;uniform vec4 uPt1;uniform vec4 uPt2;uniform vec4 uPt3;'); }
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;varying vec3 vON;uniform sampler2D uGrain;uniform float uGA;uniform vec2 uGF;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n{vec3 w=pow(abs(normalize(vON)),vec3(4.0));w/=w.x+w.y+w.z;vec3 q=vOP*8.0;float g=texture2D(uGrain,q.yz).r*w.x+texture2D(uGrain,q.xz).r*w.y+texture2D(uGrain,q.xy).r*w.z-0.5;vec3 q2=vOP*17.0;float g2=texture2D(uGrain,q2.yz+0.37).r*w.x+texture2D(uGrain,q2.xz+0.61).r*w.y+texture2D(uGrain,q2.xy+0.13).r*w.z-0.5;diffuseColor.rgb*=mix(vec3(1.0),vec3(1.162,1.198,1.234),uGA)*(1.0+(g*uGF.x+g2*uGF.y)*uGA*vec3(0.8,1.0,1.25));}' + (skU && skU.pts ?
          '\n{float a=0.0;a=max(a,1.0-smoothstep(uPt0.w*0.8,uPt0.w,distance(vOP,uPt0.xyz)));a=max(a,1.0-smoothstep(uPt1.w*0.8,uPt1.w,distance(vOP,uPt1.xyz)));a=max(a,1.0-smoothstep(uPt2.w*0.8,uPt2.w,distance(vOP,uPt2.xyz)));a=max(a,1.0-smoothstep(uPt3.w*0.8,uPt3.w,distance(vOP,uPt3.xyz)));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0,0.93,0.90),a);}' : ''))
        .replace('#include <opaque_fragment>', '{float rim=pow(1.0-clamp(dot(normalize(vViewPosition),normal),0.0,1.0),2.6);outgoingLight+=vec3(1.0,0.74,0.52)*rim*0.30*uGA;}\n#include <opaque_fragment>');
    };
    m.needsUpdate = true;
  }

  /* ---------- animations : clips NLA ---------- */
  /* « repos » pilote tous les os/formes ; pendant un clip, on joue « repos » privé des pistes que ce clip pilote (sinon moyenne des deux) */
  function baseMaj() {
    var noms = S.actifs.concat(S.sortants.map(function (o) { return o._nom; })).filter(function (n, i, l) { return l.indexOf(n) === i; });   /* expression qui s'efface en fondu : ses pistes restent hors du repos jusqu'à la fin */
    var key = noms.sort().join('+'), THREE = T.THREE;
    if (key === S.baseKey) return; S.baseKey = key;
    if (S.base) S.base.stop();
    var rep = T.clips.repos; if (!rep) return;
    var pris = {}; noms.forEach(function (n) { T.clips[n].tracks.forEach(function (tr) { pris[tr.name] = 1; }); });
    var ck = '_base_' + key;
    if (!T.clips[ck]) T.clips[ck] = new THREE.AnimationClip(ck, rep.duration, rep.tracks.filter(function (tr) { return !pris[tr.name]; }));
    S.base = T.mixer.clipAction(T.clips[ck]); S.base.setLoop(THREE.LoopRepeat, Infinity); S.base.play();
  }
  function jouer(nom, manuel) {
    if (!T || !T.clips[nom]) return;
    if (S.acts[nom]) return;
    var anc = [];
    if (/^expr_/.test(nom)) S.actifs.filter(function (n) { return n !== nom && /^expr_/.test(n); }).forEach(function (n) {   /* une expression remplace la précédente : sinon les deux s'additionnaient (colère + joie = bouche triste ET bouche qui rit) */
      var o = S.acts[n]; delete S.acts[n]; S.actifs = S.actifs.filter(function (x) { return x !== n; }); if (o._aide) { o._aide.stop(); o._aide = null; } anc.push(o);
    });
    var THREE = T.THREE, a = T.mixer.clipAction(T.clips[nom]); a._nom = nom;
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = false; a.timeScale = /^regard/.test(nom) ? 1.6 : 1;
    if (anc.length) {   /* fondu direct en 0,25 s de l'ancienne vers la nouvelle, lancée à son plateau : avant, l'ancienne repartait vers le repos (bouche neutre ~10 images) puis la nouvelle rejouait son début */
      a.time = plateau(T.clips[nom]); a.fadeIn(0.25);
      /* bouche d'un coup : deux bouches mélangées = arc de l'ancienne + intérieur rond de la nouvelle (double bouche). L'ancienne est coupée net,
         seul son reste (sourcils, yeux) s'efface ; la bouche de la nouvelle est jouée à fond dès le départ par une action d'appoint */
      anc.forEach(function (o) {
        var t0 = o.time; o.stop();
        var pc = partie(T.clips[o._nom], false); if (!pc.tracks.length) return;
        var s = T.mixer.clipAction(pc); s._nom = o._nom; s.reset(); s.setLoop(THREE.LoopOnce, 1); s.clampWhenFinished = false; s.timeScale = o.timeScale; s.time = t0; s.play(); s.fadeOut(0.25);
        if (S.sortants.indexOf(s) < 0) S.sortants.push(s);
      });
      var pb = partie(T.clips[nom], true);
      if (pb.tracks.length) { var h = T.mixer.clipAction(pb); h._nom = nom + '#bouche'; h.reset(); h.setLoop(THREE.LoopOnce, 1); h.clampWhenFinished = false; h.timeScale = a.timeScale; h.time = a.time; h.play(); a._aide = h; }
    }
    a.play();
    S.acts[nom] = a; S.actifs.push(nom); baseMaj();
    if (manuel && panel) { var b = panel.querySelector('[data-clip="' + nom + '"]'); if (b) { b.classList.add('act'); setTimeout(function () { b.classList.remove('act'); }, T.clips[nom].duration * 1000 / a.timeScale); } }
  }
  function plateau(c) {   /* début du plateau d'un clip : dernière clé où chaque piste atteint sa valeur du milieu (0,333 s pour les expressions) */
    if (c._plat !== undefined) return c._plat;
    var mx = 0, mid = c.duration / 2;
    c.tracks.forEach(function (tr) {
      var tt = tr.times, v = tr.values, vs = tr.getValueSize(), im = 0, k, j, eg;
      while (im < tt.length - 1 && tt[im + 1] <= mid) im++;
      for (k = im; k > 0; k--) { eg = true; for (j = 0; j < vs; j++) if (Math.abs(v[(k - 1) * vs + j] - v[im * vs + j]) > 1e-3) { eg = false; break; } if (!eg) break; }
      if (tt[k] > mx) mx = tt[k];
    });
    return (c._plat = Math.min(mx, mid));
  }
  var pBouche = null;
  function partie(c, bouche) {   /* pistes de bouche seules (true) ou tout sauf la bouche (false) : pièces bouche* + formes bouche_* du corps */
    var k = bouche ? '_pB' : '_pR'; if (c[k]) return c[k];
    if (!pBouche) { pBouche = {}; var pa = T.scene.getObjectByName('patate'), d = pa && pa.morphTargetDictionary; if (d) Object.keys(d).forEach(function (nm) { if (/^bouche/.test(nm)) pBouche[d[nm]] = 1; }); }
    var est = function (tr) { var m = /^patate\.morphTargetInfluences\[(\d+)\]$/.exec(tr.name); return /^bouche/.test(tr.name) || (m && pBouche[+m[1]]); };
    return (c[k] = new T.THREE.AnimationClip(c.name + k, c.duration, c.tracks.filter(function (tr) { return bouche ? est(tr) : !est(tr); })));
  }
  function fondus() {   /* fin du fondu : l'ancienne expression (poids 0) est arrêtée, ses pistes rendues au repos ; la bouche d'appoint s'arrête quand la nouvelle est à fond */
    for (var ai = 0; ai < S.actifs.length; ai++) { var x = S.acts[S.actifs[ai]]; if (x && x._aide && x.getEffectiveWeight() >= 0.999) { x._aide.stop(); x._aide = null; } }
    if (!S.sortants.length) return;
    var reste = S.sortants.filter(function (o) {
      if (o.enabled && o.isRunning()) return true;
      o.stop(); return false;
    });
    if (reste.length !== S.sortants.length) { S.sortants = reste; baseMaj(); }
  }
  /* ---------- humeur (décidée par js/app-mascotte.js : jauge de cœurs, fête) ----------
     repos = routine ; triste (< 15 %) = tristesse tenue, tout ralenti ; content (fête, rappel) = joie tenue.
     Expression tenue : jouée jusqu'à son plateau puis mise en pause ; relâchée, elle finit et revient au repos. */
  var TENUE = { triste: 'expr_tristesse', content: 'expr_joie' };
  function humeur(m) {
    if (!S || S.dead || !T) return;
    if (!TENUE[m]) m = 'repos';   /* « ecoute » (musique) : pas de casque en 3D, routine normale */
    if (m === S.hum) return; S.hum = m;
    T.mixer.timeScale = m === 'triste' ? 0.6 : 1;
    S.tenir = TENUE[m] || null;
    Object.keys(S.acts).forEach(function (n) { var a = S.acts[n]; if (a.paused && n !== S.tenir) a.paused = false; });
  }
  function tenir() {
    var n = S.tenir; if (!n || !T.clips[n]) return;
    var a = S.acts[n];
    if (!a) {   /* une autre expression (lancée à la main depuis le panneau) joue d'abord en entier ; joie : pas pendant un clignement (paupières empilées) */
      if (S.actifs.some(function (x) { return /^expr_/.test(x); }) || (n === 'expr_joie' && S.acts.clignement)) return;
      jouer(n); return;
    }
    var p = plateau(T.clips[n]);
    if (!a.paused && a.time >= p && a.time <= T.clips[n].duration - 0.35) a.paused = true;
  }
  /* Saut de joie (fait dans l'appli, sans Blender) : élan écrasé, saut étiré, retombée écrasée, rebond. Clés [temps s, étirement vertical] ; hauteur 20 % de la patate, en l'air 0,10 → 0,45 s */
  var SAUT_K = [[0, 1], [0.07, 0.84], [0.13, 1.16], [0.26, 0.98], [0.40, 1.06], [0.46, 0.82], [0.54, 1.06], [0.62, 0.98], [0.68, 1]], SAUT_FIN = 0.68;
  function sautPose(t) {
    var k = SAUT_K, i = 1; while (i < k.length - 1 && t > k[i][0]) i++;
    var a = k[i - 1], b = k[i], u = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))); u = u * u * (3 - 2 * u);
    var v = (t - 0.10) / 0.35;   /* en l'air de 0,10 à 0,45 s */
    return { sy: a[1] + (b[1] - a[1]) * u, y: v > 0 && v < 1 ? 0.20 * 4 * v * (1 - v) : 0 };
  }
  var joieT = 0;
  function visageJoie() {   /* visage de joie, pas pendant un clignement (paupières empilées) */
    if (joieT || S.acts.expr_joie) return;
    if (S.acts.clignement) { joieT = setTimeout(function () { joieT = 0; if (S && !S.dead) visageJoie(); }, 120); return; }
    jouer('expr_joie');
  }
  function joie() {   /* tapotage du cœur : saut (repos ou content ; un saut à la fois) + visage de joie (repos ; en fête il est déjà tenu). Rien pendant la fête (bras levés) */
    if (!S || S.dead || !T || (S.hum !== 'repos' && S.hum !== 'content') || S.acts.bras_haut) return;
    if (S.saut === -1) S.saut = 0;
    if (S.hum === 'repos') visageJoie();
  }
  var SAUTS = 4, SAUT_PAUSE = 0.12, BRAS_T = 1.02;   /* fête : 4 sauts (3,1 s ; la fête dure 5 s), 0,12 s au sol entre deux ; pose des bras prise dans le salut à 1,02 s */
  function fete() {   /* jauge au maximum (fête de js/app-mascotte.js) : 4 sauts de joie enchaînés, les deux bras levés ; le visage de joie est tenu par l'humeur « content » */
    if (!S || S.dead || !T || S.hum === 'triste') return;
    var a = S.acts.salut; if (a) { a.stop(); delete S.acts.salut; S.actifs = S.actifs.filter(function (x) { return x !== 'salut'; }); }   /* le salut bouge les mêmes bras */
    if (S.acts.bras_haut) return;
    jouer('bras_haut'); S.sautN = SAUTS - 1; S.saut = 0;
  }
  function libre(n) { return !S.acts[n]; }
  function every(a, b, fn) { (function go() { if (!S || S.dead) return; var t = setTimeout(function () { if (S && S.routine && !document.hidden && S.visible) fn(); go(); }, rnd(a, b)); S.timers.push(t); })(); }
  var planned = false;
  function planning() {
    if (planned && S.planned === S) return; S.planned = S; planned = true;
    var dur = function () { return S.actifs.some(function (n) { return /^expr_(joie|colere|malicieux|mefiant)$/.test(n); }); };
    every(2500, 6000, function () { if (!dur() && libre('clignement')) jouer('clignement'); });
    /* « Sacs mélangés » : chaque tour joue tout le sac une fois, ordre au hasard, jamais deux fois la même de suite (le tirage au sort laissait la joie absente plusieurs minutes).
       Rythme demandé : chaque animation ~2 fois par minute. Expressions (6) toutes les 6–7,4 s ; regards (8) toutes les 4,3–5,7 s ; salut toutes les 34–46 s → chacune ~1,5 fois par minute (tour ~40 s ; 2 fois par minute était trop agité). */
    function sacDe(liste) { var s = [], der = ''; return function (prendre) { if (!s.length) { s = liste.slice(); for (var i = s.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = s[i]; s[i] = s[j]; s[j] = t; } if (s[0] === der) s.push(s.shift()); } return prendre ? (der = s.shift()) : s[0]; }; }   /* sac(false) = la prochaine, sac(true) = la prend */
    var sacR = sacDe(T.names.filter(function (x) { return /^regard_/.test(x); }));   /* 4 directions + 4 diagonales */
    var sacT = sacDe(T.names.filter(function (x) { return /^regard_/.test(x) && !/haut/.test(x); }));   /* triste : jamais vers le haut */
    every(4300, 5700, function () {
      if (T.names.some(function (x) { return /^regard_/.test(x) && S.acts[x]; })) return;
      if (S.hum === 'triste') { if (Math.random() < 0.5) jouer(sacT(true)); return; }   /* triste : regard deux fois moins souvent */
      jouer(sacR(true));
    });
    var sacE = sacDe(['expr_sourire', 'expr_rire', 'expr_joie', 'expr_malicieux', 'expr_mefiant', 'expr_surprise']);
    function expression() {   /* joie / malicieux / méfiant : pas pendant un clignement (paupières empilées) → réessai 0,4 s plus tard */
      if (!S || S.dead || !S.routine || document.hidden || !S.visible || S.actifs.some(function (n) { return /^expr_/.test(n); })) return;
      if (/^expr_(joie|malicieux|mefiant)$/.test(sacE(false)) && S.acts.clignement) { S.timers.push(setTimeout(expression, 400)); return; }
      jouer(sacE(true));
    }
    every(6000, 7400, expression);
    every(34000, 46000, function () { if (libre('salut') && libre('bras_haut')) jouer('salut'); });   /* salut : aussi pendant une expression (il ne bouge que le corps) ; triste : ralenti avec le reste */
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!build()) return;
    activer();   /* la 3D est la seule patate de l'Accueil (les photos n'y sont plus) */
  });
})();
