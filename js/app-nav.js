// ═══════════════════════════════════════════════════════════
// app-nav.js — Tabs · Navigation · Accueil · UX · Perf

/* ══════════════════════════════════════════
   YAM TAB SWITCHING SYSTEM
══════════════════════════════════════════ */
(function(){
  var TAB_MAP = {
    home:    { panel: 'yamHomeTab',     nav: 'navHome' },
    messages:{ panel: 'yamMessagesTab', nav: 'navMessages' },
    jeux:    { panel: 'yamJeuxTab',     nav: 'navJeux' },
    musique: { panel: 'yamMusiqueTab',  nav: 'navMusique' },
    nous:    { panel: 'yamNousTab',     nav: 'navNous' }
  };
  var _currentTab = 'home';

  window.yamSwitchTab = function(tab) {
    if(window.closeAllViews) window.closeAllViews();

    // Cacher tous les panels, montrer le bon — sans animation
    Object.keys(TAB_MAP).forEach(function(key) {
      var t = TAB_MAP[key];
      if(t.panel) {
        var el = document.getElementById(t.panel);
        if(el) el.classList.toggle('active', key === tab);
      }
      var nav = document.getElementById(t.nav);
      if(nav) nav.classList.toggle('nav-active', key === tab);
    });

    _currentTab = tab;
    window._currentTab = tab;
    window.scrollTo(0, 0);
    if(window.updateFloatingThemeBtn) window.updateFloatingThemeBtn();

    // Particules et danse : actives seulement sur musique/nous, et si musique en cours
    var musicPlaying = window.currentAudio && !window.currentAudio.paused;
    var allowFx = (tab === 'musique' || tab === 'nous');
    if(allowFx && musicPlaying){
      window.particleActive = true;
      if(window.showDance) window.showDance();
    } else {
      window.particleActive = false;
      if(window.hideDance) window.hideDance();
    }

    // MiniPlayer : visible seulement sur onglet musique
    var mp2 = document.getElementById('miniPlayer');
    if(mp2){
      if(tab === 'musique'){
        mp2.classList.remove('tab-hidden');
        mp2.classList.remove('game-hidden');
        if(window.mpUpdate) window.mpUpdate();
        // padding géré par mpShow via mp-active
      } else {
        mp2.classList.add('tab-hidden');
        mp2.classList.remove('visible');
        document.body.classList.remove('mp-active');
      }
    }

    // Icône musique dansante : active si musique joue + pas sur onglet musique
    var navMus = document.getElementById('navMusique');
    if(navMus){
      navMus.classList.toggle('music-playing', musicPlaying && tab !== 'musique');
    }

    // Cœur doré : retiré quand on entre dans "nous", restauré si événement actif quand on en sort
    var navNous2 = document.getElementById('navNous');
    if(navNous2){
      if(tab === 'nous'){
        navNous2.classList.remove('event-active');
      } else {
        // Remettre si l'événement est toujours en cours
        if(typeof isInVideoWindow === 'function' && isInVideoWindow()){
          navNous2.classList.add('event-active');
        }
      }
    }
  };

  // When hiddenPage closes, restore messages tab as active
  document.addEventListener('hiddenPageClosed', function() {
    var navMsgEl = document.getElementById('navMessages');
    if(navMsgEl) navMsgEl.classList.add('nav-active');
    var msgPanel = document.getElementById('yamMessagesTab');
    if(msgPanel) msgPanel.classList.add('active');
    // Hide all other panels
    ['yamHomeTab','yamJeuxTab','yamMusiqueTab','yamNousTab'].forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.classList.remove('active');
      var key = Object.keys(TAB_MAP).find(function(k){ return TAB_MAP[k].panel === id; });
      if(key){ var nav = document.getElementById(TAB_MAP[key].nav); if(nav) nav.classList.remove('nav-active'); }
    });
    _currentTab = 'messages';
  });

  // Override scrollToTop to go home
  var _origScrollToTop = window.scrollToTop;
  window.scrollToTop = function() {
    yamSwitchTab('home');
    window.scrollTo(0,0);
  };

  // Sync mood display from profileMood system
  function yamSyncMood() {
    var profile = window.getProfile ? window.getProfile() : null;

    var moodSelf  = document.getElementById('profileMoodSelf');
    var moodOther = document.getElementById('profileMoodOther');

    var selfEmoji  = moodSelf  ? moodSelf.textContent.trim()  : '';
    var otherEmoji = moodOther ? moodOther.textContent.trim() : '';

    // "En ligne" dès qu'on est connecté, même sans humeur définie
    var selfOnline  = !!profile;
    var dot = document.getElementById('presenceDot');
    var otherOnline = !!(dot && dot.classList.contains('visible'));

    var elleAvatar = document.getElementById('yamMoodElleAvatar');
    var luiAvatar  = document.getElementById('yamMoodLuiAvatar');
    var elleState  = document.getElementById('yamMoodElleState');
    var luiState   = document.getElementById('yamMoodLuiState');

    if(profile === 'girl') {
      if(elleAvatar && selfEmoji)  elleAvatar.textContent = selfEmoji;
      if(luiAvatar  && otherEmoji) luiAvatar.textContent  = otherEmoji;
      if(elleState)  elleState.textContent  = selfOnline  ? 'En ligne' : '—';
      if(luiState)   luiState.textContent   = otherOnline ? 'En ligne' : '—';
    } else if(profile === 'boy') {
      if(luiAvatar  && selfEmoji)  luiAvatar.textContent  = selfEmoji;
      if(elleAvatar && otherEmoji) elleAvatar.textContent = otherEmoji;
      if(luiState)   luiState.textContent   = selfOnline  ? 'En ligne' : '—';
      if(elleState)  elleState.textContent  = otherOnline ? 'En ligne' : '—';
    }
  }

  // Sync mood periodically
  window.yamSyncMood = yamSyncMood;
  setTimeout(yamSyncMood, 1500);
  setInterval(yamSyncMood, 15000);

  // Sync theme toggle label in home tab
  var origApplyTheme = window.applyThemeToggle;
  window.applyThemeToggle = function() {
    if(origApplyTheme) origApplyTheme.apply(this, arguments);
    var homeBtn = document.getElementById('themeToggleHome');
    if(homeBtn) {
      var isLight = document.body.classList.contains('light');
      homeBtn.textContent = isLight ? '🌙 Thème' : '☀️ Thème';
    }
  };

  // Badge non-lus sur l'icône Messages dans la nav
  var _origLockNavBtn = document.getElementById('lockNavBtn');
  function _syncNavMsgUnread(){
    var navMsg   = document.getElementById('navMessages');
    var navBadge = document.getElementById('navMsgBadge');
    if(!navMsg) return;
    var hasUnread = _origLockNavBtn && _origLockNavBtn.classList.contains('has-unread');
    navMsg.classList.toggle('has-unread', !!hasUnread);
    if(navBadge){
      if(hasUnread){
        // Lire le chiffre depuis lockUnreadBadge (déjà calculé par checkUnread/fetchMsgs)
        var lockBadge = document.getElementById('lockUnreadBadge');
        var count = lockBadge ? lockBadge.textContent : '';
        navBadge.textContent = count || '';
        navBadge.classList.add('visible');
      } else {
        navBadge.classList.remove('visible');
      }
    }
  }
  // Observer aussi lockUnreadBadge pour capter les mises à jour du chiffre
  var _lnbObs = new MutationObserver(_syncNavMsgUnread);
  if(_origLockNavBtn) _lnbObs.observe(_origLockNavBtn, {attributes:true,attributeFilter:['class']});
  var _lockBadgeEl = document.getElementById('lockUnreadBadge');
  if(_lockBadgeEl) _lnbObs.observe(_lockBadgeEl, {childList:true,characterData:true,subtree:true});
  // Sync initial
  _syncNavMsgUnread();

  // Intercept toggleLockPopup to set nav active state
  document.addEventListener('DOMContentLoaded', function(){
    var origToggleLock = window.toggleLockPopup;
    if(origToggleLock) {
      window.toggleLockPopup = function() {
        origToggleLock.apply(this, arguments);
      };
    }
  });

})();

(function(){
  // ── Heures déclenchantes (format 24h) ──────────────────────────────────────
  var TRIGGER_HOURS = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];
  var WINDOW_BEFORE = 10; // minutes avant l'heure pile (les 10 dernières minutes de l'heure)
  var WINDOW_AFTER  = 0;  // plus de fenêtre après l'heure pile

  var tlContent = document.getElementById('tlContent');
  var videoWrap = document.getElementById('storyVideoWrap');
  var video     = document.getElementById('storyVideo');

  // Restaurer le toggle de la timeline (compatibilité JS existant)
  var tlWrap   = document.getElementById('tlWrap');
  var tlToggle = document.getElementById('tlToggle');
  if(tlToggle && tlWrap){
    var tlOpen = false;
    tlToggle.addEventListener('click', function(){
      tlOpen = !tlOpen;
      tlWrap.classList.toggle('collapsed', !tlOpen);
      tlWrap.classList.toggle('expanded',  tlOpen);
      tlToggle.textContent = tlOpen ? '▴ Réduire' : '▾ Voir la suite';
    });
  }

  // ── Vérification de la fenêtre temporelle ──────────────────────────────────
  function isInVideoWindow() {
    var now     = new Date();
    var totalMin = now.getHours() * 60 + now.getMinutes();

    for (var i = 0; i < TRIGGER_HOURS.length; i++) {
      var centerMin = TRIGGER_HOURS[i] * 60;
      if (totalMin >= centerMin - WINDOW_BEFORE && totalMin < centerMin + WINDOW_AFTER) {
        return true;
      }
    }
    return false;
  }

  // ── Bascule affichage ──────────────────────────────────────────────────────
  var counterBlock  = document.getElementById('counterBlock');
  var storyHeart   = document.getElementById('storyHeart');

  function applyState() {
    var navNous = document.getElementById('navNous');
    if (isInVideoWindow()) {
      // Cacher la timeline, montrer la vidéo en boucle
      tlContent.style.display  = 'none';
      videoWrap.style.display  = 'block';
      if (video.paused) {
        video.play().catch(function(){});
      }
      // Illuminer le compteur (bloc unique)
      if (counterBlock) counterBlock.classList.add('glowing');
      // Afficher le coeur battant
      if (storyHeart) storyHeart.style.display = 'block';
      // Cœur doré pulsant sur l'icône Nous
      if (navNous) navNous.classList.add('event-active');
    } else {
      // Montrer la timeline, cacher la vidéo
      videoWrap.style.display = 'none';
      video.pause();
      tlContent.style.display = 'block';
      // Éteindre le compteur
      if (counterBlock) counterBlock.classList.remove('glowing');
      // Cacher le coeur
      if (storyHeart) storyHeart.style.display = 'none';
      // Retirer le cœur doré
      if (navNous) navNous.classList.remove('event-active');
    }
  }

  // Appliquer immédiatement au chargement
  applyState();
  window.isInVideoWindow = isInVideoWindow;

  // ── Compte à rebours ──────────────────────────────────────────────────────
  var countdownEl = document.getElementById('storyCountdownTxt');

  function updateCountdown() {
    var now      = new Date();
    var totalMin = now.getHours() * 60 + now.getMinutes();
    var totalSec = totalMin * 60 + now.getSeconds();

    // Trouver la prochaine fin de fenêtre
    var secsLeft = null;
    for (var i = 0; i < TRIGGER_HOURS.length; i++) {
      var endSec = (TRIGGER_HOURS[i] * 60 + WINDOW_AFTER) * 60;
      var startSec = (TRIGGER_HOURS[i] * 60 - WINDOW_BEFORE) * 60;
      if (totalSec >= startSec && totalSec < endSec) {
        secsLeft = endSec - totalSec;
        break;
      }
    }

    if (secsLeft !== null && secsLeft > 0 && countdownEl) {
      var m = Math.floor(secsLeft / 60);
      var s = secsLeft % 60;
      countdownEl.textContent = (m > 0 ? m + 'min ' : '') + (s < 10 ? '0' : '') + s + 's';
    } else if (countdownEl) {
      countdownEl.textContent = '';
    }
  }

  // Réévaluer toutes les 30 secondes pour détecter l'entrée/sortie de fenêtre
  setInterval(applyState, 30000);
  // Countdown seconde par seconde
  setInterval(updateCountdown, 1000);
  updateCountdown();
})();

var canvas=document.getElementById('particleCanvas'),ctx=canvas.getContext('2d');
canvas.width=window.innerWidth; canvas.height=window.innerHeight;
var particles=[],particleActive=false;
window.addEventListener('resize',function(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;});
function HP(){this.reset();}
// Particules réduites pour perf iPhone — max 20, opacité douce, vitesse modérée
HP.prototype.reset=function(){this.x=Math.random()*canvas.width;this.y=canvas.height+30;this.sz=Math.random()*5+2;this.vy=Math.random()*0.7+0.4;this.vx=(Math.random()-.5)*.35;this.a=Math.random()*.28+.18;};
HP.prototype.update=function(){this.y-=this.vy;this.x+=this.vx;this.a-=.0015;if(this.y<-10||this.a<=0)this.reset();};
HP.prototype.draw=function(){var col=document.body.classList.contains('light')?'rgba(200,24,94,'+this.a+')':'rgba(0,201,167,'+this.a+')';ctx.save();ctx.translate(this.x,this.y);ctx.beginPath();var t=this.sz*.3;ctx.moveTo(0,t);ctx.bezierCurveTo(0,0,-this.sz/2,0,-this.sz/2,t);ctx.bezierCurveTo(-this.sz/2,this.sz/2,0,this.sz*.75,0,this.sz);ctx.bezierCurveTo(0,this.sz*.75,this.sz/2,this.sz/2,this.sz/2,t);ctx.bezierCurveTo(this.sz/2,0,0,0,0,t);ctx.fillStyle=col;ctx.fill();ctx.restore();};
window._animPStopped = false;
function animP(){if(window._animPStopped)return;ctx.clearRect(0,0,canvas.width,canvas.height);if(particleActive){if(particles.length<70)particles.push(new HP());particles.forEach(function(p){p.update();p.draw();});}requestAnimationFrame(animP);}
// Ne pas démarrer animP ici — Perf v3 gère le RAF
// animP(); // désactivé

// ── LOVE BOX ──
var loveWords=["Je t'aime Anaelle 💘","Mon cœur ❤️","Mon amour 💕","Mon ange ☀️","Ma madame ✨","Ma chérie 💓","Mon petit bonheur 🥰","Love you biloute 🤡💖","Ma vieille dame préférée 👵💕","Mon équilibre 🌙","Ma meilleure amie 💞","Mon monde 🌍","T'es tout ce qu'il me faut 💎"];

var _loveDeck = [], _loveDeckPos = 0;
function _buildLoveDeck(excludeFirst) {
  var deck = [];
  for (var k = 0; k < loveWords.length; k++) deck.push(k);
  for (var j = deck.length - 1; j > 0; j--) {
    var r = Math.floor(Math.random() * (j + 1));
    var tmp = deck[j]; deck[j] = deck[r]; deck[r] = tmp;
  }
  if (excludeFirst !== undefined && deck[0] === excludeFirst && deck.length > 1) {
    var swap = 1 + Math.floor(Math.random() * (deck.length - 1));
    var t = deck[0]; deck[0] = deck[swap]; deck[swap] = t;
  }
  return deck;
}
_loveDeck = _buildLoveDeck();
_loveDeckPos = 0;

var loveBoxTimeout=null, loveBoxBusy=false;
document.getElementById('loveBox').addEventListener('click',function(e){
  if (_loveDeckPos >= _loveDeck.length) {
    var lastShown = _loveDeck[_loveDeck.length - 1];
    _loveDeck = _buildLoveDeck(lastShown);
    _loveDeckPos = 0;
  }
  var i = _loveDeck[_loveDeckPos++];
  var textEl=document.getElementById('loveBoxText');
  if(!textEl) return;
  if(loveBoxTimeout){ clearTimeout(loveBoxTimeout); loveBoxTimeout=null; }
  textEl.style.transition='none';
  textEl.style.opacity='0';
  void textEl.offsetHeight;
  textEl.style.transition='opacity 0.2s';
  loveBoxTimeout=setTimeout(function(){
    textEl.textContent=loveWords[i];
    document.querySelector('.lb-icon').style.display='none';
    textEl.style.opacity='1';
    loveBoxTimeout=null;
  },150);
  // Cœurs qui jaillissent depuis le bouton
  var rect=e.currentTarget.getBoundingClientRect();
  var cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  var hearts=['💗','💖','💕','🩷','✨'];
  for(var k=0;k<6;k++){
    (function(k){
      setTimeout(function(){
        var h=document.createElement('div');
        h.className='lb-burst-heart';
        h.textContent=hearts[Math.floor(Math.random()*hearts.length)];
        var angle=(Math.random()*260-130)*Math.PI/180;
        var dist=60+Math.random()*60;
        h.style.cssText='position:fixed;left:'+cx+'px;top:'+cy+'px;font-size:'+(14+Math.random()*16)+'px;pointer-events:none;z-index:3000;transition:none;';
        document.body.appendChild(h);
        requestAnimationFrame(function(){
          h.style.transition='transform 0.7s cubic-bezier(.2,1,.3,1),opacity 0.7s ease';
          h.style.transform='translate('+Math.round(Math.cos(angle)*dist)+'px,'+Math.round(Math.sin(angle)*dist-40)+'px) scale(1.2)';
          h.style.opacity='0';
          setTimeout(function(){h.remove();},750);
        });
      },k*60);
    })(k);
  }
});

// ── DANCE ──
var dZ=document.getElementById('danceZone'),dG=document.getElementById('dancerGirl'),dB=document.getElementById('dancerBoy');
var isQuizOpen=false;
var _danceAutoStop=null;
function showDance(){
  if(isQuizOpen) return;
  var tab = window._currentTab || '';
  if(tab !== 'musique' && tab !== 'nous') return;
  dZ.style.opacity='1';dG.classList.add('animate');dB.classList.add('animate');
  if(_danceAutoStop) clearTimeout(_danceAutoStop);
  _danceAutoStop=setTimeout(function(){ dG.classList.remove('animate'); dB.classList.remove('animate'); _danceAutoStop=null; },45000);
}
function hideDance(){
  if(_danceAutoStop){ clearTimeout(_danceAutoStop); _danceAutoStop=null; }
  dZ.style.opacity='0';dG.classList.remove('animate');dB.classList.remove('animate');
}

// ── TIMELINE ──
var tlWrap=document.getElementById('tlWrap'),tlToggle=document.getElementById('tlToggle'),tlOpen=false;
tlToggle.addEventListener('click',function(){tlOpen=!tlOpen;tlWrap.classList.toggle('collapsed',!tlOpen);tlWrap.classList.toggle('expanded',tlOpen);tlToggle.textContent=tlOpen?'▴ Réduire':'▾ Voir la suite';});
var obs=new IntersectionObserver(function(e){e.forEach(function(x){if(x.isIntersecting)x.target.classList.add('visible');});},{threshold:0.15});
document.querySelectorAll('.tl-item').forEach(function(el){obs.observe(el);});

// ── ROUE ──

var activities=[
  {label:"Regarder une série",icon:"📺"},{label:"Apprendre à cuisiner",icon:"🍳"},
  {label:"Appel surprise",icon:"📞"},{label:"Film au hasard",icon:"🎬"},
  {label:"Envoyer des vocaux",icon:"🎤"},{label:"Jouer en ligne",icon:"🎮"},
  {label:"Écouter notre playlist",icon:"🎵"},{label:"Se raconter un souvenir",icon:"💭"},
  {label:"Regarder les étoiles",icon:"🌙"},{label:"S'écrire une lettre",icon:"💌"}
];
var wheelCanvas=document.getElementById('wheelCanvas');
var wCtx=wheelCanvas.getContext('2d');
var SIZE=wheelCanvas.parentElement.offsetWidth||240;
wheelCanvas.width=SIZE; wheelCanvas.height=SIZE;
var R=SIZE/2,currentAngle=0,isSpinning=false;
var sliceColors=['#1a2a1a','#1a1a2a','#2a1a1a','#1a2a2a','#2a2a1a','#1a1a1a','#242424','#1e2a1e','#2a1e1e','#1e1e2a'];
function drawWheel(angle){
  var n=activities.length,slice=(2*Math.PI)/n;
  wCtx.clearRect(0,0,SIZE,SIZE);
  for(var i=0;i<n;i++){
    var start=angle+i*slice,end=start+slice;
    wCtx.beginPath();wCtx.moveTo(R,R);wCtx.arc(R,R,R-2,start,end);wCtx.closePath();
    wCtx.fillStyle=sliceColors[i%sliceColors.length];wCtx.fill();
    wCtx.strokeStyle='rgba(255,255,255,0.08)';wCtx.lineWidth=1;wCtx.stroke();
    wCtx.save();wCtx.translate(R,R);wCtx.rotate(start+slice/2);wCtx.textAlign='center';wCtx.textBaseline='middle';
    wCtx.font=Math.round(R*0.18)+'px serif';
    wCtx.fillText(activities[i].icon,R*0.58,0);wCtx.restore();
  }
  wCtx.beginPath();wCtx.arc(R,R,R-2,0,2*Math.PI);
  wCtx.strokeStyle='rgba(0,201,167,0.3)';wCtx.lineWidth=2;wCtx.stroke();
}
drawWheel(currentAngle);
document.getElementById('spinBtn').addEventListener('click',function(){
  if(isSpinning)return;isSpinning=true;this.disabled=true;
  var wr=document.getElementById('wheelResult');wr.className='';wr.innerHTML='<span class="result-label">En train de tourner...</span>';
  var extraSpins=(5+Math.floor(Math.random()*5))*2*Math.PI;
  var targetSlice=Math.floor(Math.random()*activities.length);
  var sliceAngle=(2*Math.PI)/activities.length;
  var targetAngle=extraSpins+(-(targetSlice+0.5)*sliceAngle);
  var startAngle=currentAngle,duration=3500+Math.random()*1000,startTime=null;
  var spinBtn=this;
  function easeOut(t){return 1-Math.pow(1-t,4);}
  function animate(ts){
    if(!startTime)startTime=ts;
    var elapsed=ts-startTime,progress=Math.min(elapsed/duration,1);
    currentAngle=startAngle+(targetAngle-startAngle)*easeOut(progress);
    drawWheel(currentAngle);
    if(progress<1){requestAnimationFrame(animate);}
    else{isSpinning=false;spinBtn.disabled=false;var act=activities[targetSlice];wr.className='wheelResult has-result';wr.innerHTML='<span class="result-icon">'+act.icon+'</span><span class="result-label">Ce soir c\'est décidé !</span><span class="result-text">'+escHtml(act.label)+'</span>';}
  }
  requestAnimationFrame(animate);
});

// ── LOCK ──
var lockPopup=document.getElementById('lockPopup'),lockInput=document.getElementById('lockInput'),lockError=document.getElementById('lockError');

/* ══════════════════════════════════════════════════
   lockPopup — ancrage au visualViewport iOS
   
   Sur iOS, position:fixed est relatif au layout viewport.
   Quand le clavier s'ouvre, la page scroll vers le bas et
   le popup (en bas à droite) disparaît hors de la zone visible.
   
   Solution : calculer top/left en coordonnées absolues depuis
   visualViewport.offsetTop + visualViewport.height, puis
   utiliser ces valeurs pour positionner via top+right.
══════════════════════════════════════════════════ */
(function(){
  var MARGIN_BOTTOM = 12; // px au-dessus du clavier (ou du bas d'écran)
  var MARGIN_RIGHT  = 10;
  var _rafId = null;

  function positionPopup(){
    if(!lockPopup || lockPopup.style.display !== 'block') return;

    if(window.visualViewport){
      var vv     = window.visualViewport;
      // Bas du visual viewport en coordonnées layout (= ce que "top" comprend)
      var vvBottom = vv.offsetTop + vv.height;
      // Hauteur du popup
      var popH   = lockPopup.offsetHeight || 120;
      var popW   = lockPopup.offsetWidth  || 230;

      // On place le popup : son bas = vvBottom - MARGIN_BOTTOM
      var topPx  = vvBottom - popH - MARGIN_BOTTOM;
      // À droite : vv.offsetLeft + vv.width - popW - MARGIN_RIGHT
      var leftPx = vv.offsetLeft + vv.width - popW - MARGIN_RIGHT;

      // On utilise top+left (pas bottom+right) pour éviter la confusion
      lockPopup.style.bottom = 'auto';
      lockPopup.style.top    = Math.max(8, topPx) + 'px';
      lockPopup.style.left   = Math.max(8, leftPx) + 'px';
      lockPopup.style.right  = 'auto';
    } else {
      // Fallback navigateurs sans visualViewport
      lockPopup.style.bottom = '80px';
      lockPopup.style.right  = '8px';
      lockPopup.style.top    = 'auto';
      lockPopup.style.left   = 'auto';
    }
  }

  function schedulePosition(){
    if(_rafId) cancelAnimationFrame(_rafId);
    _rafId = requestAnimationFrame(function(){
      _rafId = null;
      positionPopup();
    });
  }

  // Écoute le visual viewport (clavier iOS)
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', schedulePosition);
    window.visualViewport.addEventListener('scroll', schedulePosition);
  }
  // Écoute aussi le scroll de la page (au cas où)
  window.addEventListener('scroll', schedulePosition, { passive: true });
  window.addEventListener('resize', schedulePosition, { passive: true });

  window._positionLockPopup = positionPopup;
})();

function toggleLockPopup(){
  resetZoom();
  var isOpen = lockPopup.style.display === 'block';
  document.getElementById('libraryPopup').style.display = 'none';
  if(isOpen){
    lockPopup.style.display = 'none';
    // Restore scroll
    document.body.style.overflow   = '';
    document.body.style.position   = '';
    document.body.style.width      = '';
  } else {
    // Si un profil est déjà connecté, accès direct sans mot de passe
    var _prof = localStorage.getItem('jayana_profile');
    if(_prof === 'girl' || _prof === 'boy'){
      openHiddenPage();
      return;
    }
    lockError.style.display = 'none';
    lockInput.value = '';
    lockPopup.style.display = 'block';
    // Positionne immédiatement avant que le clavier s'ouvre
    if(window._positionLockPopup) window._positionLockPopup();
    // Re-positionne après l'animation d'ouverture du clavier (~350ms)
    setTimeout(function(){ if(window._positionLockPopup) window._positionLockPopup(); }, 100);
    setTimeout(function(){ if(window._positionLockPopup) window._positionLockPopup(); }, 400);
  }
}
var _HASH_NEMO='eb38eebd7bef45d49aef46835c8460fc98c9af3f68f6af759a08173709cd76ea';
var _HASH_KEVIN='a586ffe3acf28484d17760d1ddaa2af699666c870aaaa66f8cfc826a528429ce';
var _S=(function(){var p=['Pl@','ylis','t_J4','yana','_202','5!xK','9'];return p.join('');})();
async function _sha256(str){var buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str+_S));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');}
var _lockFailCount=0, _lockBlocked=false;
async function checkCode(){
  if(_lockBlocked) return;
  var val=lockInput.value.trim().toUpperCase();lockError.style.display='none';
  var h=await _sha256(val);
  if(h===_HASH_NEMO){_lockFailCount=0;lockPopup.style.display='none';document.getElementById('prankOverlay').classList.add('show');return;}
  if(h===_HASH_KEVIN){_lockFailCount=0;lockPopup.style.display='none';openHiddenPage();return;}
  _lockFailCount++;
  lockError.style.display='block';lockInput.value='';
  if(_lockFailCount>=5){
    _lockBlocked=true;
    lockError.textContent='⛔ Trop de tentatives — attends 30s';
    lockInput.disabled=true;
    setTimeout(function(){_lockBlocked=false;_lockFailCount=0;lockInput.disabled=false;lockError.style.display='none';},30000);
  } else {
    lockError.textContent='❌ Code incorrect, recommence ! ('+_lockFailCount+'/5)';
  }
}
function closePrank(){document.getElementById('prankOverlay').classList.remove('show');lockPopup.style.display='block';lockInput.value='';}
function openHiddenPage(){
  var profile = getProfile ? getProfile() : null;
  if(!profile){
    // Pas connecté → modal choix profil
    document.getElementById('instaloveAuthModal').style.display = 'flex';
    return;
  }
  document.getElementById('hiddenPage').classList.add('active');
  particleActive=false;hideDance();window.scrollTo(0,0);
  _dmUpdateHeaderAvatars();
  // Afficher l'écran home (logo InstaLove) — indispensable pour la détection d'état
  if(window._dmRawShowHome) window._dmRawShowHome();
}
window.instaloveAuthSelect = function(p){
  document.getElementById('instaloveAuthModal').style.display='none';
  function _afterAuth(){
    document.getElementById('hiddenPage').classList.add('active');
    particleActive=false;hideDance();window.scrollTo(0,0);
    _dmUpdateHeaderAvatars();
    // Aller à l'écran intermédiaire avec la carte conv
    if(window.dmShowConv) window.dmShowConv();
  }
  if(typeof sbLoadSession==='function' && sbLoadSession(p)){
    if(window._profileSave) window._profileSave(p);
    if(window._profileApply) window._profileApply(p);
    _afterAuth();
  } else if(window.showProfileCodeModal){
    window.showProfileCodeModal(p, function(){
      if(window._profileSave) window._profileSave(p);
      if(window._profileApply) window._profileApply(p);
      if(window._profileLoadMoods) window._profileLoadMoods();
      _afterAuth();
    });
  } else {
    _afterAuth();
  }
};
window.instaloveAuthClose = function(){
  document.getElementById('instaloveAuthModal').style.display='none';
};
function _dmUpdateHeaderAvatars(){
  var profile = getProfile ? getProfile() : null;
  var selfEl  = document.getElementById('dmHeaderAvatarSelf');
  var otherEl = document.getElementById('dmHeaderAvatarOther');
  var dotSelf = document.getElementById('dmHeaderDotSelf');
  var dotOther= document.getElementById('dmHeaderDotOther');
  if(!selfEl) return;

  // Soi-même = toujours en ligne (on est connecté)
  if(dotSelf){ dotSelf.style.background='#22c55e'; dotSelf.style.boxShadow='0 0 4px rgba(34,197,94,0.8)'; }

  if(profile === 'girl'){
    selfEl.textContent  = '👧'; selfEl.style.borderColor = '#e879a0';
    otherEl.textContent = '👦'; otherEl.style.borderColor= '#5b9cf6';
  } else if(profile === 'boy'){
    selfEl.textContent  = '👦'; selfEl.style.borderColor = '#5b9cf6';
    otherEl.textContent = '👧'; otherEl.style.borderColor= '#e879a0';
  } else {
    selfEl.textContent  = '👤'; selfEl.style.borderColor = 'var(--border)';
    otherEl.textContent = '👤'; otherEl.style.borderColor= 'var(--border)';
  }

  // Synchroniser le point de l'autre avec le presenceDot du header principal
  var mainDot = document.getElementById('presenceDot');
  var otherOnline = mainDot && mainDot.classList.contains('visible');
  if(dotOther){
    dotOther.style.background  = otherOnline ? '#22c55e' : '#555';
    dotOther.style.boxShadow   = otherOnline ? '0 0 4px rgba(34,197,94,0.7)' : 'none';
  }
}
// Rafraîchir aussi quand presenceDot change
(function(){
  var mainDot = document.getElementById('presenceDot');
  if(!mainDot) return;
  new MutationObserver(function(){ _dmUpdateHeaderAvatars(); })
    .observe(mainDot, {attributes:true, attributeFilter:['class']});
})();
function closeHiddenPage(){document.getElementById('hiddenPage').classList.remove('active');}
lockInput.addEventListener('keydown',function(e){if(e.key==='Enter')checkCode();});
document.addEventListener('click',function(e){
  if(lockPopup.style.display==='block'&&!lockPopup.contains(e.target)&&!document.getElementById('lockNavBtn').contains(e.target))lockPopup.style.display='none';
  var lib=document.getElementById('libraryPopup');
  if(lib.style.display==='block'){
    var libNav=document.querySelector('.nav-item:nth-child(3)');
    if(!lib.contains(e.target)&&!(libNav&&libNav.contains(e.target)))lib.style.display='none';
  }
});



document.getElementById('quizBtn').addEventListener('click', function(){ openQuiz(); });
document.getElementById('gamesBtn').addEventListener('click', function(){ openGames(); });


// ── NAV : closeAllViews étendu ──
function resetZoom(){
  var m = document.querySelector('meta[name="viewport"]');
  m.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5');
  setTimeout(function(){
    m.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5');
  }, 30);
}
/* ── _yamSlide : transition carrousel identique aux messages ── */
function _yamSlide(incoming, outgoing, dir){
  var DUR = 300;
  var TR  = 'transform '+DUR+'ms cubic-bezier(.4,0,.2,1), opacity '+DUR+'ms ease';

  // Détecter si les éléments sont en flux normal (pas fixed) — besoin de les fixer temporairement
  var inFixed  = incoming && window.getComputedStyle(incoming).position === 'fixed';
  var outFixed = outgoing && window.getComputedStyle(outgoing).position === 'fixed';
  var needTempFixed = (incoming && !inFixed) || (outgoing && !outFixed);

  function tempFix(el){
    if(!el) return;
    var r = el.getBoundingClientRect();
    el.style.position = 'fixed';
    el.style.top  = '0'; el.style.left = '0';
    el.style.width = '100%'; el.style.height = '100%';
    el.style.zIndex = '999';
  }
  function unFix(el, wasFixed){
    if(!el || wasFixed) return;
    el.style.position = '';
    el.style.top = ''; el.style.left = '';
    el.style.width = ''; el.style.height = '';
    el.style.zIndex = '';
  }

  if(incoming){
    if(!inFixed) tempFix(incoming);
    incoming.style.transition = 'none';
    incoming.style.transform  = dir==='forward' ? 'translateX(100%)' : 'translateX(-100%)';
    incoming.style.opacity    = '1';
    incoming.classList.add('active');
  }
  if(outgoing){
    if(!outFixed) tempFix(outgoing);
    outgoing.style.transition = 'none';
    outgoing.style.transform  = 'translateX(0)';
    outgoing.style.opacity    = '1';
  }

  void (incoming || outgoing).getBoundingClientRect();
  requestAnimationFrame(function(){ requestAnimationFrame(function(){
    if(incoming){
      incoming.style.transition = TR;
      incoming.style.transform  = 'translateX(0)';
    }
    if(outgoing){
      outgoing.style.transition = TR;
      outgoing.style.transform  = dir==='forward' ? 'translateX(-100%)' : 'translateX(100%)';
      outgoing.style.opacity    = '0';
    }
    setTimeout(function(){
      if(outgoing){
        outgoing.classList.remove('active');
        outgoing.style.transform  = '';
        outgoing.style.transition = '';
        outgoing.style.opacity    = '';
        unFix(outgoing, outFixed);
      }
      if(incoming){
        incoming.style.transition = '';
        incoming.style.transform  = '';
        unFix(incoming, inFixed);
      }
    }, DUR + 50);
  }); });
}

function openGames(){
  resetZoom();
  _yamSlide(document.getElementById('gamesView'), document.getElementById('yamJeuxTab'), 'forward');
  particleActive=false;hideDance();window.scrollTo(0,0);
}
function closeGames(){
  _yamSlide(null, document.getElementById('gamesView'), 'backward');
  document.getElementById('yamJeuxTab').classList.add('active');
}
function openMemoryGame(){
  _loadGames();
  resetZoom();
  _yamSlide(document.getElementById('memoryView'), document.getElementById('gamesView'), 'forward');
  particleActive=false; hideDance();
  window.scrollTo(0,0);
  _lbLoad();
}
function closeMemoryGame(){
  _yamSlide(document.getElementById('gamesView'), document.getElementById('memoryView'), 'backward');
  clearInterval(memTimerInt);
  document.getElementById('memoryGameArea').style.display='none';
  document.getElementById('memoryStartScreen').style.display='none';
  document.getElementById('memoryGenderScreen').style.display='flex';
  document.getElementById('memoryWin').classList.remove('show');
  memCurrentPlayer=null;
  document.getElementById('memGenderGirl').className='gender-select-btn';
  document.getElementById('memGenderBoy').className='gender-select-btn';
}
function closeAllViews(){
  var ids=['gamesView','quizView','memoryView','penduView','puzzleView','snakeView','skyjoView'];
  ids.forEach(function(id){
    var el=document.getElementById(id);
    if(el){ el.classList.remove('active'); el.style.transform=''; el.style.transition=''; el.style.opacity=''; }
  });
  if(isQuizOpen){ isQuizOpen=false; document.getElementById('navSearch').style.display=''; }
  if(document.getElementById('hiddenPage').classList.contains('active')){ closeHiddenPage(); }
  if(typeof abortActivePrank==='function') abortActivePrank();
}
function scrollToTop(){resetZoom();closeAllViews();if(window.yamSwitchTab)window.yamSwitchTab('home');window.scrollTo({top:0,behavior:'smooth'});}
function toggleLibrary(){var p=document.getElementById('libraryPopup');p.style.display=p.style.display==='block'?'none':'block';}
function goTo(id){resetZoom();closeAllViews();document.getElementById('libraryPopup').style.display='none';setTimeout(function(){var el=document.getElementById(id);if(el)el.scrollIntoView({behavior:'smooth'});},150);}

// ══ NAVIGATION BROWSER — retour uniquement, avant définitivement désactivé ══
// Pattern sentinelle : un seul état pushé dans le navigateur, repoussé après
// chaque retour → la flèche "avant" du navigateur reste toujours grisée.
(function(){
  var _busy = false;
  var _stack = [];  // pile JS interne, ne se reflète plus dans history

  var GAME_VIEWS = {
    quiz:   { el:'quizView',   open:'openQuiz',       close:'closeQuiz'       },
    games:  { el:'gamesView',  open:'openGames',      close:'closeGames'      },
    memory: { el:'memoryView', open:'openMemoryGame', close:'closeMemoryGame' },
    pendu:  { el:'penduView',  open:'openPenduGame',  close:'closePenduGame'  },
    puzzle: { el:'puzzleView', open:'openPuzzleGame', close:'closePuzzleGame' },
    snake:  { el:'snakeView',  open:'openSnakeGame',  close:'closeSnakeGame'  },
  };

  // ─── Pile JS uniquement (plus de history.pushState à chaque navigation) ──
  function push(entry){
    _stack.push(entry);
  }

  // ─── Affiche l'état en haut de pile (appelé après un goBack) ─────────────
  function applyTop(){
    if(!_stack.length) return;
    var e = _stack[_stack.length - 1];

    if(e.type === 'closed'){
      // Fermer tout ce qui est ouvert — on appelle les fonctions visuelles brutes
      // (pas les versions patchées, pour éviter de re-modifier la pile)
      var hp = document.getElementById('hiddenPage');
      if(hp && hp.classList.contains('active')){
        if(window._dmRawClose) window._dmRawClose();
        else hp.classList.remove('active');
      }
      Object.keys(GAME_VIEWS).forEach(function(k){
        var el = document.getElementById(GAME_VIEWS[k].el);
        if(el && el.classList.contains('active') && window[GAME_VIEWS[k].close])
          window[GAME_VIEWS[k].close]();
      });

    } else if(e.type === 'game'){
      var v = e.view;
      Object.keys(GAME_VIEWS).forEach(function(k){
        if(k === v) return;
        if(k === 'games' && ['memory','pendu','puzzle','snake'].indexOf(v) !== -1) return;
        var el = document.getElementById(GAME_VIEWS[k].el);
        if(el && el.classList.contains('active') && window[GAME_VIEWS[k].close])
          window[GAME_VIEWS[k].close]();
      });
      var tel = document.getElementById(GAME_VIEWS[v].el);
      if(!tel || !tel.classList.contains('active'))
        if(window[GAME_VIEWS[v].open]) window[GAME_VIEWS[v].open]();

    } else if(e.type === 'dm'){
      var s = e.screen;
      var _profCheck = localStorage.getItem('jayana_profile');
      if(_profCheck !== 'girl' && _profCheck !== 'boy') return;
      var hp2 = document.getElementById('hiddenPage');
      if(!hp2 || !hp2.classList.contains('active'))
        if(window._dmRawOpen) window._dmRawOpen();
      if(s === 'home')      { if(window._dmRawShowHome) window._dmRawShowHome('backward'); }
      else if(s === 'conv') { if(window._dmRawShowHome) window._dmRawShowHome(); if(window._dmRawShowConv) window._dmRawShowConv('backward'); }
      else if(s === 'chat') { if(window._dmRawShowHome) window._dmRawShowHome(); if(window._dmRawShowChat) window._dmRawShowChat('backward'); }
    }
  }

  // ─── Retour d'un cran dans la pile JS ─────────────────────────────────────
  function goBack(){
    if(_stack.length <= 1) return; // déjà au fond, rien à fermer
    _stack.pop();
    applyTop();
  }

  // ─── popstate : intercepte TOUT retour navigateur ─────────────────────────
  // Après chaque retour, on repousse immédiatement la sentinelle →
  // il n'y a JAMAIS d'état "en avant" dans l'historique du navigateur.
  window.addEventListener('popstate', function(){
    if(_busy) return;
    _busy = true;
    // Si le swipe a déjà déclenché la fermeture avec animation, juste sync la pile
    if(!window._yamSwipeInProgress) goBack();
    else _stack.pop(); // dépiler sans ré-animer
    history.pushState({ jy:'sentinel' }, ''); // sentinelle repoussée
    setTimeout(function(){ _busy = false; }, 400);
  });

  // ─── Patch jeux/quiz ──────────────────────────────────────────────────────
  var _rawGameOpen = {};
  Object.keys(GAME_VIEWS).forEach(function(k){
    _rawGameOpen[k] = window[GAME_VIEWS[k].open];
  });
  Object.keys(GAME_VIEWS).forEach(function(k){
    var raw = _rawGameOpen[k];
    var fn  = GAME_VIEWS[k].open;
    window[fn] = function(){
      raw.apply(this, arguments);
      if(!_busy) push({ type:'game', view:k });
    };
  });

  // ─── Patch mode caché — setTimeout(0) pour exécuter après le DM IIFE ─────
  setTimeout(function(){

    var rawOpenHP = window.openHiddenPage;
    window.openHiddenPage = function(){
      if(rawOpenHP) rawOpenHP.apply(this, arguments);
      if(!_busy) push({ type:'dm', screen:'home' });
    };

    var rawDmShowConv = window.dmShowConv;
    window.dmShowConv = function(){
      if(rawDmShowConv) rawDmShowConv.apply(this, arguments);
      if(!_busy) push({ type:'dm', screen:'conv' });
    };

    var rawDmOpenMessaging = window.dmOpenMessaging;
    window.dmOpenMessaging = function(){
      if(rawDmOpenMessaging) rawDmOpenMessaging.apply(this, arguments);
      if(!_busy){
        var prev = _stack[_stack.length - 1];
        if(prev && prev.type === 'dm' && prev.screen === 'home'){
          if(window._dmRawShowConv) window._dmRawShowConv();
          push({ type:'dm', screen:'conv' });
        }
        push({ type:'dm', screen:'chat' });
      }
    };

    // closeHiddenPage : vide la pile JS côté DM, plus de history.go
    var rawCloseHP = window.closeHiddenPage;
    window.closeHiddenPage = function(){
      if(rawCloseHP) rawCloseHP.apply(this, arguments);
      if(_busy) return;
      // Dépiler jusqu'à retrouver 'closed'
      while(_stack.length > 1 && _stack[_stack.length - 1].type !== 'closed'){
        _stack.pop();
      }
    };
    window._dmRawClose = rawCloseHP;

  }, 0);

  // ─── État initial ──────────────────────────────────────────────────────────
  _stack.push({ type:'closed' });
  history.replaceState({ jy:'base' }, '');     // plancher (jamais navigable en avant)
  history.pushState({ jy:'sentinel' }, '');    // sentinelle : toujours au-dessus

})();

/* ══════════════════════════════════════════════════════════════════
   AMÉLIORATIONS UX/DESIGN & PERFORMANCE — v.UX1
   ▸ Skeleton loading images
   ▸ Pull-to-refresh
   ▸ Toast notifications
   ▸ Haptic feedback
   ▸ Transitions sous-vues améliorées
   ▸ Sécurité : suppression clé exposée dans console
   ▸ Lazy image loading via IntersectionObserver
   ▸ Debounce scroll/resize
   ▸ Active state feedback
══════════════════════════════════════════════════════════════════ */

/* ── 1. TOAST NOTIFICATIONS ── */
window.showToast = function(msg, type, duration){
  var t = document.getElementById('uxToast');
  if(!t) return;
  t.textContent = msg;
  t.className = 'show' + (type ? ' ' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(function(){
    t.classList.remove('show');
    setTimeout(function(){ t.className = ''; }, 300);
  }, duration || 2200);
};

/* ── 2. HAPTIC FEEDBACK ── */
window.haptic = function(type){
  if(!navigator.vibrate) return;
  var patterns = { light:20, medium:40, heavy:80, success:[40,30,40], error:[60,40,60,40,60] };
  navigator.vibrate(patterns[type] || 20);
};

/* Brancher haptic sur les actions existantes — non-invasif */
(function(){
  /* Bêtises */
  var origPrankSend = window.prankSend;
  if(origPrankSend) window.prankSend = function(){
    haptic('medium'); origPrankSend.apply(this, arguments);
  };
  /* Like heart */
  var origSpawnHeart = window.spawnHeart;
  if(origSpawnHeart) window.spawnHeart = function(){
    haptic('success'); origSpawnHeart.apply(this, arguments);
  };
})();

/* Haptic sur les nav items */
document.querySelectorAll('.nav-item').forEach(function(el){
  el.addEventListener('touchstart', function(){ haptic('light'); }, { passive:true });
});
/* Haptic sur les bubbleBtn */
document.querySelectorAll('.bubbleBtn').forEach(function(el){
  el.addEventListener('touchstart', function(){ haptic('light'); }, { passive:true });
});

/* ── 3. SKELETON IMAGES — masquage au chargement ── */
(function(){
  /* Pour les images Lui qui sont injectées dynamiquement via JS :
     On observe les img qui passent visible=true */
  function hideSkeleton(img){
    var wrap = img.closest('.album-image');
    if(!wrap) return;
    var sk = wrap.querySelector('.skeleton-overlay');
    if(sk){ sk.classList.add('hidden'); }
  }
  /* Images déjà dans le DOM */
  document.querySelectorAll('.album-image img').forEach(function(img){
    if(img.complete && img.naturalWidth){ hideSkeleton(img); return; }
    img.addEventListener('load', function(){ hideSkeleton(img); });
    img.addEventListener('error', function(){ hideSkeleton(img); });
  });
  /* Surveille les nouvelles images injectées (Lui) */
  var obs = new MutationObserver(function(mutations){
    mutations.forEach(function(m){
      m.addedNodes.forEach(function(n){
        if(n.nodeType !== 1) return;
        var imgs = n.tagName === 'IMG' ? [n] : n.querySelectorAll ? n.querySelectorAll('img') : [];
        imgs.forEach(function(img){
          if(img.complete && img.naturalWidth){ hideSkeleton(img); return; }
          img.addEventListener('load', function(){ hideSkeleton(img); });
          img.addEventListener('error', function(){ hideSkeleton(img); });
        });
      });
    });
  });
  obs.observe(document.body, { childList:true, subtree:true });
})();

/* ── 4. PULL-TO-REFRESH ── */
(function(){
  var indicator = document.getElementById('pullRefreshIndicator');
  var ptrText   = document.getElementById('ptrText');
  var ptrArrow  = document.getElementById('ptrArrow');
  if(!indicator) return;

  var startY = 0, pulling = false, threshold = 72;
  var subviews = ['gamesView','memoryView','penduView','puzzleView','snakeView','skyjoView','quizView','hiddenPage'];

  function anySubviewOpen(){
    return subviews.some(function(id){
      var el = document.getElementById(id);
      return el && (el.classList.contains('active') || el.style.display === 'block' || (el.id === 'hiddenPage' && el.classList.contains('active')));
    });
  }

  document.addEventListener('touchstart', function(e){
    if(window.scrollY > 10) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }, { passive:true });

  document.addEventListener('touchmove', function(e){
    if(!pulling) return;
    var dy = e.touches[0].clientY - startY;
    if(dy < 20) return;
    indicator.classList.add('visible');
    if(dy >= threshold){
      ptrArrow.classList.add('ready');
      ptrText.textContent = 'Relâche pour actualiser';
    } else {
      ptrArrow.classList.remove('ready');
      ptrText.textContent = 'Tire pour actualiser';
    }
  }, { passive:true });

  document.addEventListener('touchend', function(e){
    if(!pulling) return;
    pulling = false;
    var dy = (e.changedTouches[0].clientY - startY);
    if(dy >= threshold){
      indicator.classList.add('refreshing');
      ptrText.textContent = 'Actualisation…';
      haptic('medium');
      /* Recharge les données distantes si disponible */
      var refreshFns = [
        window.nlPoll, window.checkActivePrank, window.sgLoad, window.memoLoad
      ];
      var done = 0;
      refreshFns.forEach(function(fn){ if(typeof fn === 'function') { try{ fn(); }catch(e){} } done++; });
      setTimeout(function(){
        indicator.classList.remove('refreshing','visible');
        ptrArrow.classList.remove('ready');
        ptrText.textContent = 'Tire pour actualiser';
        showToast('✓ Actualisé', 'success', 1600);
        haptic('success');
      }, 1200);
    } else {
      indicator.classList.remove('visible');
      ptrArrow.classList.remove('ready');
    }
  }, { passive:true });
})();

/* ── 5. TRANSITIONS SOUS-VUES AMÉLIORÉES ── */
(function(){
  /* Surcharge openGames / closeGames pour ajouter slide */
  var _origOpenGames  = window.openGames;
  var _origCloseGames = window.closeGames;
  var _origOpenQuiz   = window.openQuiz;
  var _origCloseQuiz  = window.closeQuiz;

  function addSlideIn(id){
    var el = document.getElementById(id);
    if(!el) return;
    el.style.animation = 'none';
    el.offsetHeight; /* reflow */
    el.style.animation = '';
  }

  if(_origOpenGames) window.openGames = function(){
    _origOpenGames.apply(this, arguments);
    setTimeout(function(){ addSlideIn('gamesView'); }, 10);
  };
  if(_origOpenQuiz) window.openQuiz = function(){
    _origOpenQuiz.apply(this, arguments);
    setTimeout(function(){ addSlideIn('quizView'); }, 10);
  };
})();

/* ── 6. ACTIVE STATE TACTILE SUR CARTES ALBUM ── */
document.querySelectorAll('.album-image').forEach(function(el){
  el.addEventListener('touchstart', function(){ el.style.transform = 'scale(0.97)'; el.style.transition = 'transform 0.1s'; }, { passive:true });
  el.addEventListener('touchend', function(){ el.style.transform = ''; el.style.transition = 'transform 0.25s'; }, { passive:true });
});

/* ── 7. SCROLL PERFORMANCE — passive listeners déjà OK, ajout will-change ── */
(function(){
  var sections = document.querySelectorAll('.section, .fade-in');
  sections.forEach(function(s){ s.style.willChange = 'opacity, transform'; });
  /* Nettoyage will-change après animation */
  var obsClean = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        setTimeout(function(){ entry.target.style.willChange = 'auto'; }, 600);
        obsClean.unobserve(entry.target);
      }
    });
  });
  sections.forEach(function(s){ obsClean.observe(s); });
})();

/* ── 8. SÉCURITÉ — note console ── */
(function(){
  // Rappel : SB_KEY est la clé anon publique Supabase.
  // La vraie protection des données repose sur les Row-Level Security (RLS) en base.
  // Voir le fichier supabase-audit.sql pour les vérifications à effectuer.
})();

/* ── 9. DEBOUNCE resize events ── */
(function(){
  var origUpdate = window._dmUpdateVP;
  if(!origUpdate) return;
  var _timer;
  window.visualViewport && window.visualViewport.removeEventListener('resize', origUpdate);
  window.visualViewport && window.visualViewport.addEventListener('resize', function(){
    clearTimeout(_timer);
    _timer = setTimeout(function(){ if(origUpdate) origUpdate(); }, 60);
  });
})();

/* ── 10. IMAGE INTERSECTION OBSERVER pour vraie lazy load des sliders ── */
(function(){
  if(!('IntersectionObserver' in window)) return;
  var lazyImgs = document.querySelectorAll('img[loading="lazy"]');
  if(!lazyImgs.length) return;
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(!entry.isIntersecting) return;
      var img = entry.target;
      if(img.dataset.src){ img.src = img.dataset.src; }
      obs.unobserve(img);
    });
  }, { rootMargin: '200px' });
  lazyImgs.forEach(function(img){ obs.observe(img); });
})();

/* ── 11. FEEDBACK VISUEL sur envoi de suggestion ── */
(function(){
  var origSgSave = window.sgSave;
  if(!origSgSave) return;
  window.sgSave = function(){
    haptic('success');
    origSgSave.apply(this, arguments);
  };
})();

/* ── Bloquer le swipe natif Chrome/Safari sur les bords gauche et droit ── */
(function(){
  document.addEventListener('touchstart', function(e){
    var x = e.touches[0].clientX;
    if(x < 20 || x > window.innerWidth - 20){
      e.preventDefault();
    }
  }, { passive: false });
})();

/* ── 12. SWIPE HORIZONTAL sur la bottom nav (smooth scroll sections) ── */
(function(){
  var SECTIONS = ['counterSection', 'reasonSection', 'elleSection', 'luiSection',
                  'memoCoupleSection', 'suggestionSection', 'wheelSection', 'Love'];
  var swipeStartX = 0, swipeStartY = 0, swipeLocked = false;
  var subviews = ['gamesView','memoryView','penduView','puzzleView','snakeView','skyjoView','quizView','hiddenPage'];

  function anySubviewOpen(){
    return subviews.some(function(id){
      var el = document.getElementById(id);
      return el && (el.classList.contains('active') || el.style.display === 'block');
    });
  }

  document.addEventListener('touchstart', function(e){
    if(anySubviewOpen()) return;
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
    swipeLocked = false;
  }, { passive:true });

  document.addEventListener('touchend', function(e){
    if(anySubviewOpen()) return;
    if(swipeLocked) return;
    var dx = e.changedTouches[0].clientX - swipeStartX;
    var dy = e.changedTouches[0].clientY - swipeStartY;
    /* Uniquement si swipe horizontal fort et peu de vertical */
    if(Math.abs(dx) < 80 || Math.abs(dy) > 60) return;


    /* Trouver la section visible actuellement */
    var current = -1;
    for(var i = 0; i < SECTIONS.length; i++){
      var el = document.getElementById(SECTIONS[i]);
      if(!el) continue;
      var rect = el.getBoundingClientRect();
      if(rect.top < window.innerHeight / 2 && rect.bottom > 0){ current = i; break; }
    }
    if(current === -1) return;
    var next = dx < 0 ? Math.min(current + 1, SECTIONS.length - 1) : Math.max(current - 1, 0);
    if(next === current) return;
    var target = document.getElementById(SECTIONS[next]);
    if(target){ haptic('light'); target.scrollIntoView({ behavior:'smooth', block:'start' }); }
  }, { passive:true });
})();

/* ── 12b. SWIPE retour dans hiddenPage (swipe droit uniquement) ── */
/* Swipe GAUCHE (avancer) désactivé volontairement — causait des bugs.
   Swipe DROIT → history.go(-1) → popstate sentinelle → retour propre.      */
setTimeout(function(){
  var _sx = 0, _sy = 0, _sActive = false, _throttle = false;

  function dmScreen(){
    var hp = document.getElementById('hiddenPage');
    if(!hp || !hp.classList.contains('active')) return null;
    var chat = document.getElementById('dmChatScreen');
    if(chat && chat.style.display !== 'none') return 'chat';
    var home = document.getElementById('dmHomeScreen');
    if(home && home.style.display !== 'none'){
      var conv = document.getElementById('dmHomeConv');
      if(conv && conv.style.display !== 'none') return 'conv';
      return 'logo';
    }
    return null;
  }

  document.addEventListener('touchstart', function(e){
    _sActive = false;
    var hp = document.getElementById('hiddenPage');
    if(!hp || !hp.classList.contains('active')) return;
    var ae = document.activeElement;
    if(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
    var pm = document.getElementById('prankMenu');
    if(pm && pm.classList.contains('show')) return;
    _sx = e.touches[0].clientX;
    _sy = e.touches[0].clientY;
    _sActive = true;
  }, { passive: true });

  document.addEventListener('touchend', function(e){
    if(!_sActive) return;
    _sActive = false;
    if(_throttle) return;

    var hp = document.getElementById('hiddenPage');
    if(!hp || !hp.classList.contains('active')) return;
    var ae = document.activeElement;
    if(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
    var pm = document.getElementById('prankMenu');
    if(pm && pm.classList.contains('show')) return;

    var dx = e.changedTouches[0].clientX - _sx;
    var dy = e.changedTouches[0].clientY - _sy;

    // Swipe GAUCHE → ignoré (navigation en avant désactivée)
    if(dx <= 0) return;

    if(Math.abs(dx) < 55) return;
    if(Math.abs(dy) > Math.abs(dx) * 0.7) return;

    var sc = dmScreen();
    if(!sc || sc === 'logo') return;

    _throttle = true;
    setTimeout(function(){ _throttle = false; }, 500);

    haptic('light');

    // Animation slide-out de l'écran visible vers la droite avant le retour
    var visible = ['dmChatScreen','dmHomeScreen'].reduce(function(found, id){
      if(found) return found;
      var el = document.getElementById(id);
      return (el && el.style.display !== 'none') ? el : null;
    }, null);
    if(visible){
      visible.style.transition = 'transform 0.25s cubic-bezier(.4,0,.2,1)';
      visible.style.transform  = 'translateX(100%)';
      setTimeout(function(){
        visible.style.transition = '';
        visible.style.transform  = '';
        history.go(-1);
      }, 240);
    } else {
      history.go(-1);
    }
  }, { passive: true });

  /* ── Bloquer Alt+→ Chrome (avancer) quand une vue est ouverte ── */
  document.addEventListener('keydown', function(e){
    if(!e.altKey || e.key !== 'ArrowRight') return;
    var views = ['hiddenPage','gamesView','quizView','memoryView','penduView','puzzleView','snakeView','skyjoView'];
    var open = views.some(function(id){
      var el = document.getElementById(id);
      return el && (el.classList.contains('active') || el.style.display === 'flex' || el.style.display === 'block');
    });
    if(open) e.preventDefault();
  }, true);

}, 300);

/* ── 12c. SWIPE retour dans les vues jeux/quiz (même pattern que messages) ── */
setTimeout(function(){
  var _gsx = 0, _gsy = 0, _gsActive = false, _gThrottle = false;
  var GAME_IDS = ['gamesView','quizView','memoryView','penduView','puzzleView','snakeView','skyjoView'];

  function anyGameViewOpen(){
    return GAME_IDS.some(function(id){
      var el = document.getElementById(id);
      return el && el.classList.contains('active');
    });
  }

  document.addEventListener('touchstart', function(e){
    _gsActive = false;
    if(!anyGameViewOpen()) return;
    var ae = document.activeElement;
    if(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
    _gsx = e.touches[0].clientX;
    _gsy = e.touches[0].clientY;
    _gsActive = true;
  }, { passive: true });

  document.addEventListener('touchend', function(e){
    if(!_gsActive) return;
    _gsActive = false;
    if(_gThrottle) return;
    if(!anyGameViewOpen()) return;
    var ae = document.activeElement;
    if(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;

    var dx = e.changedTouches[0].clientX - _gsx;
    var dy = e.changedTouches[0].clientY - _gsy;

    if(dx <= 0) return;
    if(Math.abs(dx) < 55) return;
    if(Math.abs(dy) > Math.abs(dx) * 0.7) return;

    _gThrottle = true;
    setTimeout(function(){ _gThrottle = false; }, 500);

    haptic('light');

    // Appeler la fonction close de la vue active — elle utilise déjà _yamSlide
    var CLOSE_MAP = {
      'skyjoView':  function(){ if(window.closeSkyjoGame) closeSkyjoGame(); },
      'memoryView': function(){ closeMemoryGame(); },
      'penduView':  function(){ closePenduGame(); },
      'puzzleView': function(){ closePuzzleGame(); },
      'snakeView':  function(){ closeSnakeGame(); },
      'quizView':   function(){ closeQuiz(); },
      'gamesView':  function(){ closeGames(); }
    };
    var PRIORITY = ['skyjoView','memoryView','penduView','puzzleView','snakeView','quizView','gamesView'];
    for(var i = 0; i < PRIORITY.length; i++){
      var el = document.getElementById(PRIORITY[i]);
      if(el && el.classList.contains('active')){
        CLOSE_MAP[PRIORITY[i]]();
        // Sync la pile de navigation après l'animation — flag pour éviter double fermeture
        window._yamSwipeInProgress = true;
        setTimeout(function(){
          history.go(-1);
          setTimeout(function(){ window._yamSwipeInProgress = false; }, 100);
        }, 360);
        break;
      }
    }
  }, { passive: true });

}, 300);

/* ── 13. AMÉLIORATION THÈME — sauvegarde en localStorage ── */
(function(){
  /* Restaure le thème au chargement */
  var savedTheme = localStorage.getItem('jayana_theme');
  if(savedTheme === 'light' && !document.body.classList.contains('light')){
    document.body.classList.add('light');
    /* Sync icônes */
    var themeBtn = document.getElementById('themeToggle');
    if(themeBtn) themeBtn.textContent = '🌙 Thème';
    var floatBtn = document.getElementById('floatingThemeBtn');
    if(floatBtn) floatBtn.textContent = '🌙 Thème';
    ['dmThemeIconMoon','gvThemeIconMoon','qzThemeIconMoon','pmThemeIconMoon'].forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.style.display = 'none';
    });
    ['dmThemeIconSun','gvThemeIconSun','qzThemeIconSun','pmThemeIconSun'].forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.style.display = '';
    });
  }
  /* Surcharge applyThemeToggle pour sauvegarder */
  var _origToggle = window.applyThemeToggle;
  if(_origToggle){
    window.applyThemeToggle = function(){
      _origToggle.apply(this, arguments);
      var isLight = document.body.classList.contains('light');
      localStorage.setItem('jayana_theme', isLight ? 'light' : 'dark');
      haptic('light');
    };
  }
})();

/* ── 14. SMOOTH IMAGE LOAD pour les images Lui injectées par JS ── */
(function(){
  /* Patch luiLoadImages si disponible */
  var _origLuiLoad = window.luiLoadImages;
  if(!_origLuiLoad) return;
  window.luiLoadImages = function(){
    _origLuiLoad.apply(this, arguments);
    /* Après injection, ajoute skeleton + onload */
    setTimeout(function(){
      document.querySelectorAll('#luiSlider img').forEach(function(img){
        var wrap = img.closest('.album-image');
        if(!wrap) return;
        if(!wrap.querySelector('.skeleton-overlay')){
          var sk = document.createElement('div');
          sk.className = 'skeleton-overlay';
          wrap.appendChild(sk);
        }
        var sk = wrap.querySelector('.skeleton-overlay');
        if(img.complete && img.naturalWidth){ sk.classList.add('hidden'); return; }
        img.addEventListener('load', function(){ sk.classList.add('hidden'); });
        img.addEventListener('error', function(){ sk.classList.add('hidden'); });
      });
    }, 100);
  };
})();


(function(){
  'use strict';

  var _CI = window.clearInterval;
  var _SI = window.setInterval;

  /* ══════════════════════════════════════════════════════
     1. CANVAS PARTICLES
        Stoppe animP original via _animPStopped
        Lance une seule boucle RAF optimisée
        RAF s'arrête vraiment quand particleActive = false
  ══════════════════════════════════════════════════════ */
  (function(){
    var _canvas = null;
    var _ctx    = null;
    var _rafId  = null;

    function getCtx(){
      if(_ctx) return _ctx;
      _canvas = document.querySelector('canvas');
      if(_canvas) _ctx = _canvas.getContext('2d');
      return _ctx;
    }

    function loop(){
      var c = getCtx();
      if(!c){ _rafId = requestAnimationFrame(loop); return; }
      if(window.particleActive){
        c.clearRect(0, 0, _canvas.width, _canvas.height);
        if(window.particles){
          if(window.particles.length < 20 && window.HP)
            window.particles.push(new window.HP());
          window.particles.forEach(function(p){ p.update(); p.draw(); });
        }
        _rafId = requestAnimationFrame(loop);
      } else {
        // Inactif → vide canvas une fois et STOPPE le RAF
        c.clearRect(0, 0, _canvas.width, _canvas.height);
        if(window.particles) window.particles = [];
        _rafId = null;
        // Relancé par _watchParticle ci-dessous
      }
    }

    // Watcher léger (1/s) qui relance la boucle si particleActive repasse à true
    _SI(function(){
      if(window.particleActive && !_rafId){
        _rafId = requestAnimationFrame(loop);
      }
    }, 1000);

    // animP est déjà désactivé dès le départ — démarrage direct
    setTimeout(function(){
      window._animPStopped = true; // sécurité au cas où
      window.particles = window.particles || [];
      // Le loop se lancera dès que particleActive passe à true (via le watcher)
      // Pas besoin de démarrer le RAF à froid — économie CPU au chargement
    }, 100);
  })();

  /* ══════════════════════════════════════════════════════
     2. MINI PLAYER 250ms → EVENT-DRIVEN
        Annule window._mpPollIv (exposé dans le code original)
        Remplace par événements audio natifs
  ══════════════════════════════════════════════════════ */
  (function(){
    function hookAudio(audio){
      if(!audio || audio._v3Hooked) return;
      audio._v3Hooked = true;
      audio.addEventListener('timeupdate', function(){
        // Appelle la version window (exposée par le mini player)
        if(window.mpUpdateProgress) window.mpUpdateProgress();
      });
      audio.addEventListener('play', function(){
        if(window.mpUpdate)           window.mpUpdate();
        if(window.mpUpdateProgress)   window.mpUpdateProgress();
        if(window.mpUpdateMode)       window.mpUpdateMode();
        if(window.mpCheckGameState)   window.mpCheckGameState();
        if(window.updateTop50PlayBtn) window.updateTop50PlayBtn();
      });
      audio.addEventListener('pause', function(){
        if(window.mpUpdate)           window.mpUpdate();
        if(window.mpUpdateMode)       window.mpUpdateMode();
        if(window.updateTop50PlayBtn) window.updateTop50PlayBtn();
      });
      audio.addEventListener('ended', function(){
        if(window.mpUpdate)           window.mpUpdate();
        if(window.updateTop50PlayBtn) window.updateTop50PlayBtn();
      });
      audio.addEventListener('loadedmetadata', function(){
        if(window.mpUpdateProgress) window.mpUpdateProgress();
      });
    }

    document.querySelectorAll('audio').forEach(hookAudio);

    var _origMpUpdate = window.mpUpdate;
    window.mpUpdate = function(){
      if(_origMpUpdate) _origMpUpdate.apply(this, arguments);
      if(window.currentAudio) hookAudio(window.currentAudio);
    };

    setTimeout(function(){
      // Annule 250ms original
      if(window._mpPollIv != null){ _CI(window._mpPollIv); window._mpPollIv = null; }
      // Annule 500ms top50
      if(window._top50Iv  != null){ _CI(window._top50Iv);  window._top50Iv  = null; }
      // Fallback basse fréquence pour états non-audio (mode, game state)
      _SI(function(){
        if(window.mpUpdateMode)     window.mpUpdateMode();
        if(window.mpCheckGameState) window.mpCheckGameState();
      }, 2000);
      // Appel initial top50
      if(window.updateTop50PlayBtn) window.updateTop50PlayBtn();
    }, 1500);
  })();

  /* ══════════════════════════════════════════════════════
     3. POLLS ADAPTATIFS — SANS DOUBLON
        Annule les originaux (exposés via window._likesIv, window._nlIv)
        Recrée avec fréquences optimales selon visibilité
  ══════════════════════════════════════════════════════ */
  var _timers = { likes: null, nl: null };

  var FREQ = {
    likes: { visible: 12000, hidden: 0     },
    nl:    { visible: 8000,  hidden: 25000 }
  };

  function _sched(key, fn, freq){
    if(_timers[key]){ _CI(_timers[key]); _timers[key] = null; }
    var ms = document.hidden ? freq.hidden : freq.visible;
    if(!ms) return;
    _timers[key] = _SI(fn, ms);
  }

  function _reschedAll(){
    _sched('likes', function(){
      if(window.loadLikeCounters) window.loadLikeCounters();
    }, FREQ.likes);

    _sched('nl', function(){
      if(window.nlPoll) window.nlPoll();
    }, FREQ.nl);

    // Chat : ralentit si page cachée et chat ouvert
    if(document.hidden && window._dmStartPoll && window._chatPollId){
      window._dmStartPoll(10000);
    } else if(!document.hidden && window._dmStartPoll && window._chatPollId){
      window._dmStartPoll(4000);
    }
  }

  setTimeout(function(){
    // Annule les originaux
    if(window._likesIv != null){ _CI(window._likesIv); window._likesIv = null; }
    if(window._nlIv    != null){ _CI(window._nlIv);    window._nlIv    = null; }
    // Lance les optimisés
    _reschedAll();
  }, 1500);

  document.addEventListener('visibilitychange', function(){
    _reschedAll();
    document.body.classList.toggle('perf-hidden', document.hidden);

    // ── Particules & Danse : stop immédiat si page cachée ──
    if(document.hidden){
      // Stoppe les particules sans modifier l'état particleActive
      // (si musique toujours en cours, elles reprendront au retour)
      window._particlePausedByVisibility = !!window.particleActive;
      window.particleActive = false;
      // Stoppe la danse visuellement sans toucher au timer audio
      var dG2 = document.getElementById('dancerGirl');
      var dB2 = document.getElementById('dancerBoy');
      if(dG2) dG2.classList.remove('animate');
      if(dB2) dB2.classList.remove('animate');
      // Stoppe toute bêtise active (timers, RAF, listeners)
      if(typeof abortActivePrank==='function') abortActivePrank();
    } else {
      // Page redevient visible — reprend si la musique était active
      if(window._particlePausedByVisibility && window.currentAudio && !window.currentAudio.paused){
        window.particleActive = true;
        // La danse reprend aussi
        if(window.showDance) window.showDance();
      }
      window._particlePausedByVisibility = false;
    }
  });

  /* ══════════════════════════════════════════════════════
     4. ANIMATIONS CSS HORS VIEWPORT
  ══════════════════════════════════════════════════════ */
  (function(){
    if(!('IntersectionObserver' in window)) return;
    var sels = ['.skeleton','.skeleton-overlay','.wave-bar','.pa-wave span',
                '.badge-new','#profileAvatar','#counterBlock','.spinner',
                '.lb-icon','#loveBox','.sp-song.nl-other-playing'];
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.target.id === 'loveBox'){
          // Les pseudo-éléments ne peuvent pas être ciblés directement
          // On basculer animation-play-state via une classe CSS
          e.target.classList.toggle('anim-paused', !e.isIntersecting);
        } else {
          e.target.style.animationPlayState = e.isIntersecting ? '' : 'paused';
        }
      });
    }, { rootMargin: '80px' });
    function observe(root){
      sels.forEach(function(sel){
        (root||document).querySelectorAll(sel).forEach(function(el){ obs.observe(el); });
      });
    }
    observe();
    new MutationObserver(function(muts){
      muts.forEach(function(m){
        m.addedNodes.forEach(function(n){
          if(n.nodeType!==1) return;
          sels.forEach(function(sel){
            if(n.matches&&n.matches(sel)) obs.observe(n);
            if(n.querySelectorAll) n.querySelectorAll(sel).forEach(function(el){ obs.observe(el); });
          });
        });
      });
    }).observe(document.body,{childList:true,subtree:true});
  })();

  /* ══════════════════════════════════════════════════════
     5. WILL-CHANGE — nettoyage après 4s
  ══════════════════════════════════════════════════════ */
  setTimeout(function(){
    document.querySelectorAll('.section,.fade-in,.counter-unit,.tl-card,.song,.sp-song').forEach(function(el){
      el.style.willChange = 'auto';
    });
  }, 4000);

  /* ══════════════════════════════════════════════════════
     6. SCROLL iOS
  ══════════════════════════════════════════════════════ */
  ['gamesView','memoryView','penduView','puzzleView','snakeView','skyjoView','quizView','hiddenPage'].forEach(function(id){
    var el = document.getElementById(id);
    if(!el) return;
    el.style.overscrollBehavior     = 'contain';
    el.style.webkitOverflowScrolling = 'touch';
  });

  /* ══════════════════════════════════════════════════════
     7. MEDIA SESSION API
  ══════════════════════════════════════════════════════ */
  (function(){
    if(!('mediaSession' in navigator)) return;
    var _linked = false;
    document.addEventListener('play', function(e){
      if(e.target.tagName==='AUDIO') _linked = false;
    }, true);
    var _origMU2 = window.mpUpdate;
    window.mpUpdate = function(){
      if(_origMU2) _origMU2.apply(this, arguments);
      if(_linked||!window.currentAudio||window.currentAudio.paused) return;
      _linked = true;
      try{
        var tEl = window.currentRow&&window.currentRow.querySelector('.sp-title,.song-title');
        var aEl = window.currentRow&&window.currentRow.querySelector('.sp-artist,.song-artist');
        navigator.mediaSession.metadata = new MediaMetadata({
          title:  tEl ? tEl.textContent : 'Playlist Jayana',
          artist: aEl ? aEl.textContent : 'Jayana',
          album:  'Playlist Jayana 💖'
        });
        navigator.mediaSession.setActionHandler('play',          function(){ if(window.currentAudio) window.currentAudio.play(); });
        navigator.mediaSession.setActionHandler('pause',         function(){ if(window.currentAudio) window.currentAudio.pause(); });
        navigator.mediaSession.setActionHandler('nexttrack',     function(){
          var rows=Array.from(document.querySelectorAll('#Love .sp-song'));
          var cur=document.querySelector('#Love .sp-song.playing');
          var nxt=rows[rows.indexOf(cur)+1]||rows[0];
          if(nxt){var b=nxt.querySelector('.sp-btn-play');if(b)b.click();}
        });
        navigator.mediaSession.setActionHandler('previoustrack', function(){
          var rows=Array.from(document.querySelectorAll('#Love .sp-song'));
          var cur=document.querySelector('#Love .sp-song.playing');
          var prv=rows[rows.indexOf(cur)-1];
          if(prv){var b=prv.querySelector('.sp-btn-play');if(b)b.click();}
        });
      }catch(e){}
    };
  })();

  /* ══════════════════════════════════════════════════════
     8. CSS GLOBAL
  ══════════════════════════════════════════════════════ */
  (function(){
    var s = document.createElement('style');
    s.textContent =
      /* ── Perf globale ── */
      'body.perf-hidden *{animation-play-state:paused !important;}' +
      '.section{contain:layout;}' +
      '.bottom-nav{contain:layout style;}' +
      '.song,.sp-song{contain:layout style;}' +
      '#gamesView,#quizView,#memoryView,#penduView,#puzzleView,#snakeView{contain:layout style;}' +

      /* ── Backdrop-filter désactivé sur iOS (webkit-touch-callout détecte iOS) ── */
      '@supports (-webkit-touch-callout: none){' +
        '#searchOverlay{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}' +
        '#memoModal,#memoAuthModal{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}' +
        '#sgModal,#sgAuthModal,#sgEditModal{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}' +
        '#prankOverlay,#prankMenu,#prankMsgModal,#prankGotcha{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}' +
        '#prankLock,#prankKeyboard,#prankMemoryOverlay{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}' +
        '.prank-toast,.prank-curtain-banner,#prankCurtainBanner,#prankIntrusBanner{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}' +
        '#prankTargetBanner,#prankEyesBanner,#prankFogBanner,#prankColorsBanner{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}' +
        '#prankSplashBanner,#prankNotif,.memo-note-date-badge{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}' +
        '.sg-modal-inner,.search-popup{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}' +
        '#prankFogOverlay{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}' +
      '}' +

      /* ── GPU layers ── */
      '#miniPlayer,#miniPlayer .mp-inner{will-change:transform;}' +
      '.mp-seek-fill{will-change:width;}' +

      /* ── Pause animations loveBox hors viewport ── */
      '#loveBox.anim-paused .lb-icon{animation-play-state:paused!important;}' +
      '#loveBox.anim-paused::after{animation-play-state:paused!important;}' +
      '#loveBox.anim-paused::before{animation-play-state:paused!important;}' +

      /* ── NL Glow durations ── */
      '.sp-song.nl-other-playing.nl-glow-together::after{animation-duration:2.5s!important;}' +
      '.sp-song.nl-other-playing.nl-glow-boy::after{animation-duration:3s!important;}' +
      '.sp-song.nl-other-playing.nl-glow-girl::after{animation-duration:3s!important;}';
    document.head.appendChild(s);
  })();

  /* ══════════════════════════════════════════════════════
     9. LOG
  ══════════════════════════════════════════════════════ */
  setTimeout(function(){
    console.log(
      '⚡ Jayana Perf v3.5\n' +
      '  ✓ animP original désactivé dès le départ (pas de double RAF)\n' +
      '  ✓ 250ms mini player → event-driven\n' +
      '  ✓ likes 12s visible / 0 si caché — nlPoll 8s / 25s\n' +
      '  ✓ animations hors viewport pausées (IntersectionObserver)\n' +
      '  ✓ will-change nettoyé après 4s\n' +
      '  ✓ Media Session API (contrôles iOS lock screen)\n' +
      '  ✓ [v3.2] backdrop-filter désactivé sur iOS (tous les overlays)\n' +
      '  ✓ [v3.2] box-shadow/border-color animés → opacity pseudo-éléments\n' +
      '  ✓ [v3.2] lbSweep GPU compositing, vues contain:layout style\n' +
      '  ✓ [v3.3] will-change:background-position supprimé\n' +
      '  ✓ [v3.3] prankFogOverlay + prankCurtainBanner couverts iOS\n' +
      '  ✓ [v3.3] IntersectionObserver étendu: #loveBox + nlGlow\n' +
      '  ✓ [v3.3] prank-shake durée max 4s\n' +
      '  ✓ [v3.4] Particules: 70 → 20 max, paramètres allégés\n' +
      '  ✓ [v3.4] danceGirl/Boy: 0.4s → 0.65s, auto-stop 45s\n' +
      '  ✓ [v3.4] visibilitychange: particules + danse stoppées si page cachée\n' +
      '  ✓ [v3.5] particules + danse stoppées à l\'ouverture de toutes les vues\n' +
      '  ✓ [v3.5] abortActivePrank: _kbHintInterval/_kbHintTimer/_shakeMaxTimer nettoyés\n' +
      '  ✓ [v3.5] closeAllViews + visibilitychange → abortActivePrank systématique\n' +
      '  ✓ [v3.5] canvas anniv: RAF stoppe si page cachée\n' +
      '  ✓ [v3.6] Skyjo bg-pause: anim pausées + poll/heartbeat ralentis (visibilitychange+pagehide+blur)'
    );
  }, 2000);

})();

