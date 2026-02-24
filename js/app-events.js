// ═══════════════════════════════════════════════════════════
// app-events.js — Événements temporels (anniversaire, saisonniers...)

/* ════════════════════════════════════════════
   MODE ANNIVERSAIRE MENSUEL — le 29 de chaque mois
════════════════════════════════════════════ */
(function(){
  var START = new Date(2024, 9, 29); // 29 octobre 2024
  var now   = new Date();
  var day   = now.getDate();

  if (day !== 29) return; // Pas le 29 → rien

  // Calcul du nombre de mois écoulés
  var months = (now.getFullYear() - START.getFullYear()) * 12
             + (now.getMonth()    - START.getMonth());
  if (months < 1) return; // Pas encore 1 mois complet

  // ── Activer la classe anniv ──
  document.body.classList.add('anniv-mode');

  // ── Bannière ──
  var banner = document.getElementById('annivBanner');
  var sub    = document.getElementById('annivSub');
  if (banner) banner.classList.add('visible');
  if (sub) sub.textContent = 'Ça fait maintenant ' + months + ' mois qu\'on s\'aime 🩷';

  // ── Compteur spécial ──
  var sinceEl = document.querySelector('.counter-since');
  if (sinceEl) {
    sinceEl.innerHTML = '🎂 ' + months + ' mois ensemble aujourd\'hui !';
    sinceEl.style.color = '#f5c518';
    sinceEl.style.fontWeight = '600';
  }

  // ── Confettis ──
  var canvas = document.getElementById('annivCanvas');
  if (!canvas) return;
  canvas.classList.add('visible');
  var ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  var COLORS = ['#f5c518','#ff6eb0','#a78bfa','#60a5fa','#34d399','#fb923c'];
  var pieces = [];
  var MAX    = 55;

  function Piece() {
    this.x    = Math.random() * canvas.width;
    this.y    = -10 - Math.random() * 40;
    this.w    = 6 + Math.random() * 7;
    this.h    = 3 + Math.random() * 4;
    this.rot  = Math.random() * Math.PI * 2;
    this.drot = (Math.random() - 0.5) * 0.12;
    this.vy   = 1.2 + Math.random() * 2.2;
    this.vx   = (Math.random() - 0.5) * 1.2;
    this.color= COLORS[Math.floor(Math.random() * COLORS.length)];
    this.alpha= 0.75 + Math.random() * 0.25;
  }

  for (var i = 0; i < MAX; i++) {
    var p = new Piece();
    p.y = Math.random() * canvas.height; // Répartis dès le départ
    pieces.push(p);
  }

  var running = true;
  // Arrêter les confettis après 12 secondes (discret)
  setTimeout(function(){
    running = false;
    // Fondu canvas progressif
    var op = 1;
    var fade = setInterval(function(){
      op -= 0.04;
      canvas.style.opacity = Math.max(0, op);
      if (op <= 0) { clearInterval(fade); canvas.classList.remove('visible'); }
    }, 60);
  }, 12000);

  // Stop immédiat si page cachée (multitâche iOS)
  function onAnnivVisibility(){
    if(document.hidden){ running = false; }
  }
  document.addEventListener('visibilitychange', onAnnivVisibility);

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var j = 0; j < pieces.length; j++) {
      var pc = pieces[j];
      ctx.save();
      ctx.globalAlpha = pc.alpha;
      ctx.translate(pc.x, pc.y);
      ctx.rotate(pc.rot);
      ctx.fillStyle = pc.color;
      ctx.fillRect(-pc.w/2, -pc.h/2, pc.w, pc.h);
      ctx.restore();

      pc.x   += pc.vx;
      pc.y   += pc.vy;
      pc.rot += pc.drot;

      if (pc.y > canvas.height + 20) {
        if (running) {
          pieces[j] = new Piece();
        } else {
          pieces.splice(j, 1); j--;
        }
      }
    }
    if (pieces.length > 0) requestAnimationFrame(loop);
    else document.removeEventListener('visibilitychange', onAnnivVisibility);
  }
  loop();

})();

