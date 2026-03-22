// ═══════════════════════════════════════════════════════════
// app-memory.js — Memory v2 : Classique+ · Écho · Architecte
// Mars 2026 — YAM
// Dépendances : app-core.js, app-account.js, app-multiplayer.js
// Globals : sb2Fetch, sb2Post, yamGetUser, getProfile,
//           v2GetDisplayName, escHtml, _yamSlide, YAMMultiplayer
// ═══════════════════════════════════════════════════════════

var _gamesLoaded = true;
function _loadGames() {}

// ── État courant (mis à jour à chaque onStateUpdate) ──
var _memLastState = null;

var MEMORY_EMOJIS = ['💕','🌸','💋','🥰','🌙','✨','🎵','💎','🎀','🍓','🌺','🦋'];
var ECHO_EMOJIS   = ['💕','🌸','💋','🥰','🌙','✨','🎵','💎'];
var ARCHI_SHAPES  = [
  {emoji:'🔴',color:'#ef4444'},{emoji:'🔵',color:'#3b82f6'},
  {emoji:'🟢',color:'#22c55e'},{emoji:'🟡',color:'#eab308'},
  {emoji:'🟣',color:'#a855f7'},{emoji:'🟠',color:'#f97316'}
];
var ARCHI_SVG=[
  {color:'#ef4444',bg:'#fee2e2',svg:'<svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="10" fill="#ef4444"/></svg>'},
  {color:'#3b82f6',bg:'#dbeafe',svg:'<svg width="26" height="26" viewBox="0 0 26 26"><rect x="3" y="3" width="20" height="20" rx="3" fill="#3b82f6"/></svg>'},
  {color:'#22c55e',bg:'#dcfce7',svg:'<svg width="26" height="26" viewBox="0 0 26 26"><polygon points="13,2 24,24 2,24" fill="#22c55e"/></svg>'},
  {color:'#f59e0b',bg:'#fef3c7',svg:'<svg width="26" height="26" viewBox="0 0 26 26"><polygon points="13,2 24,13 13,24 2,13" fill="#f59e0b"/></svg>'},
  {color:'#a855f7',bg:'#f3e8ff',svg:'<svg width="26" height="26" viewBox="0 0 26 26"><polygon points="13,2 16,10 25,10 18,15 21,24 13,19 5,24 8,15 1,10 10,10" fill="#a855f7"/></svg>'},
  {color:'#06b6d4',bg:'#cffafe',svg:'<svg width="26" height="26" viewBox="0 0 26 26"><rect x="10" y="2" width="6" height="22" rx="2" fill="#06b6d4"/><rect x="2" y="10" width="22" height="6" rx="2" fill="#06b6d4"/></svg>'}
];
function _memArchiShapeEl(si,size,clickCb){
  size=size||44;
  var s=ARCHI_SVG[si]||ARCHI_SVG[0];
  var d=document.createElement('div');
  d.style.cssText='width:'+size+'px;height:'+size+'px;border-radius:10px;background:'+s.bg+';border:1.5px solid '+s.color+'44;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-sizing:border-box;transition:transform .12s;';
  d.innerHTML=s.svg;
  if(clickCb){d.style.cursor='pointer';d.addEventListener('click',clickCb);}
  return d;
}
var TROPHIES = {
  telepathie:    {name:'🧠 Télépathie',     desc:'Écho niveau 8+ sans erreur'},
  eclair:        {name:'⚡ Éclair',          desc:'Classique+ manche 3 en moins de 60s'},
  architecte:    {name:'🏗️ Architecte',     desc:'Architecte sans aucun reset'},
  osmose:        {name:'💑 Osmose',          desc:'Les 3 modes gagnés en mode ALL'},
  precision:     {name:'🎯 Précision',       desc:'Classique+ gagné en moins de 20 coups'},
  inextinguible: {name:'🔥 Inextinguible',   desc:'Écho niveau 10+'},
  legende:       {name:'👑 Légende',         desc:'Tous les trophées débloqués'}
};
var MEM_GAME_TABLE     = 'memory_games';
var MEM_PRESENCE_TABLE = 'memory_presence';
var MEM_TROPHY_TABLE   = 'memory_trophies';

// ── État global ──
var _memMp          = null;
var _memProfile     = null;
var _memOther       = null;
var _memCurrentMode = null;
var _memAllQueue    = [];
var _memAllResults  = {};
var _memMyTrophies  = [];
var _memStartedAt   = 0;
var _memAllAfk      = false;  // true quand on part en AFK d'un mode ALL en cours

// ── État Classique+ ──
var _clCards       = [], _clFlipped = [], _clManche = 1;
var _clGirlPairs   = 0, _clBoyPairs = 0, _clMoves = 0, _clTotalMoves = 0;
var _clTimer       = null, _clSeconds = 0, _clManche3Secs = 0, _clTimerStart = 0;
var _clProcessing  = false, _clResultShown = false, _clSaved = false;

// ── État Écho ──
var _echoSequence  = [], _echoLevel = 1, _echoMyInput = [];
var _echoShowInt   = null, _echoSaved = false, _echoPublished = false, _echoShowing = false;

// ── État Architecte ──
var _archiTarget   = [], _archiRound = 1;
var _archiPerfect  = true, _archiSaved = false;

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function _memGetProfile() {
  if (_memProfile) return _memProfile;
  if (typeof getProfile === 'function') { var p = getProfile(); if (p) return p; }
  var u = typeof yamGetUser === 'function' ? yamGetUser() : null;
  return u ? u.role : null;
}
function _memGetCoupleId() {
  var u = typeof yamGetUser === 'function' ? yamGetUser() : null;
  return u ? u.couple_id : null;
}
function _memGetName(role) {
  return typeof v2GetDisplayName === 'function' ? v2GetDisplayName(role) : (role === 'girl' ? 'Elle' : 'Lui');
}
function _memEl(id) { return document.getElementById(id); }

function _memLoadAvatar(containerEl, userId, role, size) {
  if (!containerEl) return;
  size = size || 64;
  var fallback = 'assets/images/profil_' + role + '.png';
  function show(src) {
    var img = document.createElement('img');
    img.style.cssText = 'width:'+size+'px;height:'+size+'px;border-radius:50%;object-fit:cover;display:block;';
    img.src = src; containerEl.innerHTML = ''; containerEl.appendChild(img);
  }
  if (!userId) { show(fallback); return; }
  var SB = typeof SB_URL !== 'undefined' ? SB_URL : '';
  var url = SB + '/storage/v1/object/public/images/avatars/' + userId + '.jpg?t=' + Date.now();
  var probe = new Image();
  probe.onload = function() { show(url); };
  probe.onerror = function() { show(fallback); };
  probe.src = url;
}

// ── Injection dynamique des barres de profil joueurs ──
// Appelé au lancement de chaque mode pour injecter avatar + nom + dot adversaire
// dans les conteneurs prévus dans le HTML (ou les créer si absents)

function _memInjectProfileBar(containerElId, userId, role, isOpponent, showDot) {
  var u = typeof yamGetUser === 'function' ? yamGetUser() : null;
  var uid = userId || (u ? (role === _memProfile ? u.id : u.partner_id) : null);
  var container = _memEl(containerElId);
  if (!container) return;
  var name = _memGetName(role);
  var isGirl=(role==='girl'),border=isGirl?'#f9a8d4':'#c4b5fd',bg=isGirl?'#fce7f3':'#ede9fe';
  var dotHtml = (isOpponent && showDot)
    ? '<span id="' + containerElId + 'Dot" style="position:absolute;bottom:2px;right:2px;width:13px;height:13px;border-radius:50%;background:#444;border:2.5px solid #fff;transition:background .3s,box-shadow .3s;"></span>'
    : '';
  container.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;gap:5px;">' +
      '<div style="position:relative;flex-shrink:0;">' +
        '<div id="' + containerElId + 'Av" style="width:62px;height:62px;border-radius:50%;overflow:hidden;background:' + bg + ';border:2.5px solid ' + border + ';"></div>' +
        dotHtml +
      '</div>' +
      '<span style="font-size:13px;font-weight:500;color:#111827;white-space:nowrap;">' + name + '</span>' +
    '</div>';
  _memLoadAvatar(_memEl(containerElId + 'Av'), uid, role, 62);
}

// Met à jour le dot de présence adversaire dans n'importe quel écran
function _memUpdatePresenceDot(containerElId, isOnline) {
  var dot = _memEl(containerElId + 'Dot');
  if (!dot) return;
  dot.style.background   = isOnline ? '#22c55e' : '#666';
  dot.style.boxShadow    = isOnline ? '0 0 6px rgba(34,197,94,0.8)' : 'none';
}

// Injecte ou met à jour les deux profils dans un écran donné
// me_id / opp_id = IDs des conteneurs parent pour "moi" et "adversaire"
// Injecte les profils Echo avec coeurs intégrés (avatar + nom + ❤️)
// maxLives = nb max de coeurs (3 standalone, 2 ALL)
function _memRenderEchoProfiles(meContainerId, oppContainerId, maxLives) {
  var u = typeof yamGetUser === 'function' ? yamGetUser() : null;
  // IDs des éléments de vies — on utilise ceux attendus par _memApplyEchoState
  // Si déjà existants dans le HTML on les laisse, sinon on les crée dans la barre
  var livesExistMe  = !!_memEl('memEchoLivesMe');
  var livesExistOth = !!_memEl('memEchoLivesOther');
  function renderOne(cid, userId, role, isOpp) {
    var c = _memEl(cid); if (!c) return;
    var name = _memGetName(role);
    var dotHtml = isOpp
      ? '<span id="' + cid + 'Dot" style="position:absolute;bottom:2px;right:2px;width:13px;height:13px;border-radius:50%;background:#444;border:2.5px solid #fff;transition:background .3s,box-shadow .3s;"></span>'
      : '';
    var livesId = isOpp ? 'memEchoLivesOther' : 'memEchoLivesMe';
    var livesAlreadyExists = isOpp ? livesExistOth : livesExistMe;
    var hearts = new Array(maxLives).fill('❤️').join('');
    // Créer la div lives ici seulement si pas déjà dans le HTML
    var livesHtml = livesAlreadyExists
      ? '' // existant dans le HTML → on le remplit séparément
      : '<div id="' + livesId + '" style="font-size:15px;letter-spacing:1px;min-height:20px;">' + hearts + '</div>';
    var isGirl2=(role==='girl'),border2=isGirl2?'#f9a8d4':'#c4b5fd',bg2=isGirl2?'#fce7f3':'#ede9fe';
    c.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;gap:5px;">' +
        '<div style="position:relative;flex-shrink:0;">' +
          '<div id="' + cid + 'Av" style="width:62px;height:62px;border-radius:50%;overflow:hidden;background:' + bg2 + ';border:2.5px solid ' + border2 + ';"></div>' +
          dotHtml +
        '</div>' +
        '<span style="font-size:13px;font-weight:500;color:#111827;white-space:nowrap;">' + name + '</span>' +
        livesHtml +
      '</div>';
    _memLoadAvatar(_memEl(cid + 'Av'), userId, role, 62);
    // Initialiser la div lives existante avec les bons coeurs
    if (livesAlreadyExists) {
      var lEl = _memEl(livesId);
      if (lEl) lEl.textContent = hearts;
    }
  }
  renderOne(meContainerId,  u ? u.id         : null, _memProfile, false);
  renderOne(oppContainerId, u ? u.partner_id : null, _memOther,   true);
}

function _memRenderDualProfiles(meContainerId, oppContainerId) {
  var u = typeof yamGetUser === 'function' ? yamGetUser() : null;
  _memInjectProfileBar(meContainerId,  u ? u.id         : null, _memProfile, false, false);
  _memInjectProfileBar(oppContainerId, u ? u.partner_id : null, _memOther,   true,  true);
}

function _memShowScreen(id) {
  ['memScreenLobby','memScreenMode','memScreenClassic','memScreenEcho','memScreenArchi'].forEach(function(s) {
    var el = _memEl(s);
    if (el) { el.style.display = 'none'; el.classList.remove('mem-screen--active'); }
  });
  var t = _memEl(id);
  if (t) { t.style.display = 'flex'; t.classList.add('mem-screen--active'); }
}

function _memShowLb(show) {
  var lb = _memEl('memoryLeaderboard'); if (lb) lb.style.display = show ? 'block' : 'none';
}

function _memCleanup() {
  if (_memMp) { _memMp.leave(); _memMp = null; }
  if (_echoShowInt) { clearInterval(_echoShowInt); _echoShowInt = null; }
  if (_clTimer)     { clearInterval(_clTimer);     _clTimer = null; }
  _memCurrentMode = null; _memAllQueue = []; _memAllResults = {};
  // Reset flags de résultat pour éviter les popups persistants entre sessions
  _clResultShown = false; _clSaved = false;
  // Masquer les popups de résultat si encore affichés
  var rEl = _memEl('memClassicMancheResult'); if (rEl) rEl.style.display = 'none';
  var fEl = _memEl('memClassicFinalResult');  if (fEl) fEl.style.display = 'none';
  var eEl = _memEl('memEchoFinalResult');     if (eEl) eEl.style.display = 'none';
  var aEl = _memEl('memArchiFinalResult');    if (aEl) aEl.style.display = 'none';
  // Vider les bulles spéciales pour ne pas les faire persister d'une session à l'autre
  var specRow = _memEl('memClassicSpecialRow');
  if (specRow) { specRow.style.display = 'none'; specRow.innerHTML = ''; }
}

// ═══════════════════════════════════════════════════════════
// OUVERTURE / FERMETURE
// ═══════════════════════════════════════════════════════════

function openMemoryGame() {
  _memProfile = _memGetProfile();
  _memOther   = _memProfile === 'girl' ? 'boy' : 'girl';
  _yamSlide(document.getElementById('memoryView'), document.getElementById('gamesView'), 'forward');
  window.scrollTo(0, 0);
  _memShowLb(false);
  // Si on revient d'une AFK mode ALL → passer par enterLobby (comme les autres modes).
  // enterLobby() voit presenceEmpty → purge si les deux sont partis,
  // ou rejoint directement si l'adversaire est encore en ligne.
  if (_memAllAfk) {
    _memAllAfk = false;
    _memLoadTrophies(function() { _memStartLobby(); });
    return;
  }
  // Partie ALL encore active sans AFK (ex: rechargement page) → reprendre via _allRouteState
  // qui vérifie lui-même si le bon écran est visible et force un restart si besoin
  var _allActive = (_memCurrentMode === 'all' || (_memLastState && _memLastState.mode === 'all'))
                    && _memMp && _memLastState && !_memLastState.winner;
  if (_allActive) {
    _allRouteState(_memLastState, null);
    return;
  }
  _memLoadTrophies(function() { _memStartLobby(); });
}

// Quitter définitivement — même comportement qu'Ocho/Skyjo
function closeMemoryGame() {
  // Mode ALL en cours (pas encore terminé) → AFK, exactement comme les autres modes :
  // stopAll() coupe le heartbeat (_presenceActive=false) PUIS deletePresence() vide la
  // ligne en base. Au retour, enterLobby() vérifie presenceEmpty :
  //   • Les deux partis → presenceEmpty=true → purge la partie fantôme
  //   • Un seul parti  → l'adversaire a relancé la présence → rejoint directement
  // _memMp et _memLastState restent en mémoire (pas de cleanup) pour que le flag
  // _memAllAfk puisse être détecté dans openMemoryGame().
  var _isAllInProgress = (_memCurrentMode === 'all' || (_memLastState && _memLastState.mode === 'all'))
                          && _memMp && _memLastState && !_memLastState.winner;
  if (_isAllInProgress) {
    _memAllAfk = true;
    // Couper le heartbeat AVANT deletePresence (comme leave() dans app-multiplayer.js)
    if (_memMp && typeof _memMp.stopAll === 'function') _memMp.stopAll();
    if (_memMp && typeof _memMp.deletePresence === 'function') _memMp.deletePresence();
    _yamSlide(document.getElementById('gamesView'), document.getElementById('memoryView'), 'backward');
    return;
  }
  // Tous les autres cas (fin de partie, autres modes) → quitter normalement
  _memCleanup();
  _yamSlide(document.getElementById('gamesView'), document.getElementById('memoryView'), 'backward');
}

// Note : memoryBackBtn est géré par app-nav.js

// ═══════════════════════════════════════════════════════════
// TROPHÉES
// ═══════════════════════════════════════════════════════════

function _memLoadTrophies(cb) {
  var cid = _memGetCoupleId();
  if (!cid) { _memMyTrophies = []; if (cb) cb(); return; }
  sb2Fetch(MEM_TROPHY_TABLE, 'couple_id=eq.'+cid+'&player_role=eq.'+_memGetProfile())
    .then(function(r) { _memMyTrophies = Array.isArray(r) ? r.map(function(x){return x.trophy_id;}) : []; if (cb) cb(); })
    .catch(function() { _memMyTrophies = []; if (cb) cb(); });
}

function _memHighestTitle() {
  var order = ['legende','osmose','inextinguible','telepathie','architecte','eclair','precision'];
  for (var i = 0; i < order.length; i++) if (_memMyTrophies.indexOf(order[i]) !== -1) return TROPHIES[order[i]].name;
  return '';
}

function _memUnlockTrophy(id, elId) {
  if (_memMyTrophies.indexOf(id) !== -1) return;
  var cid = _memGetCoupleId(); if (!cid) return;
  sb2Post(MEM_TROPHY_TABLE, {couple_id:cid, player_role:_memGetProfile(), trophy_id:id, trophy_name:TROPHIES[id].name})
    .then(function() {
      _memMyTrophies.push(id);
      if (elId) { var el = _memEl(elId); if (el) { el.textContent = '🏆 Trophée : '+TROPHIES[id].name; el.style.display = 'block'; } }
      var all = ['telepathie','eclair','architecte','osmose','precision','inextinguible'];
      if (all.every(function(k){return _memMyTrophies.indexOf(k)!==-1;})) _memUnlockTrophy('legende', elId);
    }).catch(function(){});
}

// ═══════════════════════════════════════════════════════════
// LOBBY — MATCHMAKING
// ═══════════════════════════════════════════════════════════

function _memStartLobby() {
  _memShowScreen('memScreenLobby');
  var u = typeof yamGetUser === 'function' ? yamGetUser() : null;
  _memLoadAvatar(_memEl('memLobbyAvMe'),    u ? u.id         : null, _memProfile, 80);
  _memLoadAvatar(_memEl('memLobbyAvOther'), u ? u.partner_id : null, _memOther,   80);
  var nMe = _memEl('memLobbyNameMe'), nOth = _memEl('memLobbyNameOther');
  if (nMe)  nMe.textContent  = _memGetName(_memProfile);
  if (nOth) nOth.textContent = _memGetName(_memOther);
  var tMe = _memEl('memLobbyTitleMe'); if (tMe) tMe.textContent = _memHighestTitle();

  var cancelBtn = _memEl('memLobbyCancelBtn');
  if (cancelBtn) cancelBtn.onclick = function() {
    _memCleanup();
    // Retour vers la vue gamesView (ferme memoryView proprement)
    _yamSlide(document.getElementById('gamesView'), document.getElementById('memoryView'), 'backward');
  };

  _memMp = YAMMultiplayer.init({
    gameTable:        MEM_GAME_TABLE,
    presenceTable:    MEM_PRESENCE_TABLE,
    deleteOnLeave:    true,
    staleGameMinutes: 30,

    buildInitialState: function() {
      return { phase:'mode_select', girl_vote:null, boy_vote:null, mode:null, started_at:Date.now() };
    },

    onWaiting: function() {
      var st = _memEl('memLobbyStatus'); if (st) st.textContent = 'En attente de '+_memGetName(_memOther)+'…';
    },

    onLobbyTick: function(girlOk, boyOk) {
      var ok = _memProfile === 'girl' ? boyOk : girlOk;
      var dot = _memEl('memLobbyDotOther');
      if (dot) { dot.style.background = ok ? '#22c55e' : '#444'; dot.style.boxShadow = ok ? '0 0 8px rgba(34,197,94,.8)' : 'none'; }
      var st = _memEl('memLobbyStatus'); if (st) st.textContent = ok ? _memGetName(_memOther)+' est là ! 🎉' : 'En attente de '+_memGetName(_memOther)+'…';
    },

    onPresenceUpdate: function(isOnline) {
      // Mettre à jour tous les dots adversaire dans tous les écrans actifs
      var dot  = _memEl('memClassicOppDot');
      var name = _memEl('memClassicOppName');
      if (dot) {
        dot.style.background   = isOnline ? '#22c55e' : '#666';
        dot.style.boxShadow    = isOnline ? '0 0 6px rgba(34,197,94,0.8)' : 'none';
        dot.style.width        = '8px'; dot.style.height = '8px';
        dot.style.borderRadius = '50%'; dot.style.display = 'inline-block';
      }
      if (name) name.textContent = _memGetName(_memOther);
      // Nouveaux dots injectés dynamiquement par _memInjectProfileBar
      _memUpdatePresenceDot('memClassicOppProfile', isOnline);
      _memUpdatePresenceDot('memEchoOppProfile',     isOnline);
      _memUpdatePresenceDot('memArchiOppProfile',    isOnline);
    },

    onMatchFound: function(gameRow) {
      _memStartedAt = Date.now();
      _memLastState = gameRow.state;
      _memCurrentMode = null;
      var state = gameRow.state;
      var ph = state && state.phase;
      setTimeout(function() {
        // Mode ALL en cours : router directement sans passer par la sélection de mode
        if (state && state.mode === 'all' && !state.winner) {
          _memRouteState(state, gameRow);
        } else if (ph === 'classic' || ph === 'echo' || ph === 'archi') {
          _memRouteState(state, gameRow);
        } else {
          _memGoToModeSelect(gameRow);
        }
      }, 400);
    },

    onStateUpdate: function(gameRow) {
      if (!gameRow || !gameRow.state) return;
      _memLastState = gameRow.state;
      // Si on revient en jeu après une absence, _memCurrentMode peut être périmé
      // Le reset est géré dans onMatchFound; ici on route normalement
      _memRouteState(gameRow.state, gameRow);
    },

    onAbandon: function() { _memCleanup(); _memShowLb(true); _lbLoad(); },
    onReconnectTimeout: function() { _memCleanup(); },
    onLeave: function() { _memCleanup(); },
    onOpponentOffline: function(oppName) {
      if (!_memMp) return;
      _memMp.showChoice('😔', oppName+' est déconnecté(e)', 'Attends ou quitte.',
        'Attendre', function(){_memMp.startReconnectWait();},
        'Quitter', function(){
          // Forcer le cleanup même en mode ALL (l'adversaire a choisi de quitter)
          _memCurrentMode = null;
          closeMemoryGame();
        });
    }
  });

  _memMp.enterLobby();
  window._memRefreshRates   = function() { if (_memMp) _memMp.refreshRates(); };
  window._memDeletePresence = function() { if (_memMp) _memMp.deletePresence(); };
  window._memUpsertPresence = function() { if (_memMp) _memMp.upsertPresence(); };
}

// ═══════════════════════════════════════════════════════════
// SÉLECTION DE MODE
// ═══════════════════════════════════════════════════════════

function _memGoToModeSelect(gameRow) {
  _memShowScreen('memScreenMode');
  var u = typeof yamGetUser === 'function' ? yamGetUser() : null;
  _memLoadAvatar(_memEl('memModeAvMe'),    u ? u.id         : null, _memProfile, 64);
  _memLoadAvatar(_memEl('memModeAvOther'), u ? u.partner_id : null, _memOther,   64);
  var nMe = _memEl('memModeNameMe'), nOth = _memEl('memModeNameOther');
  if (nMe)  nMe.textContent  = _memGetName(_memProfile);
  if (nOth) nOth.textContent = _memGetName(_memOther);
  var tMe = _memEl('memModeTitleMe'); if (tMe) tMe.textContent = _memHighestTitle() || 'Débutant';
  var tOth = _memEl('memModeTitleOther'); if (tOth) tOth.textContent = '…';
  (function() {
    var cid = _memGetCoupleId();
    if (!cid || !tOth) return;
    sb2Fetch(MEM_TROPHY_TABLE, 'couple_id=eq.'+cid+'&player_role=eq.'+_memOther)
      .then(function(r) {
        var oppTrophies = Array.isArray(r) ? r.map(function(x){return x.trophy_id;}) : [];
        var order = ['legende','osmose','inextinguible','telepathie','architecte','eclair','precision'];
        var title = '';
        for (var i = 0; i < order.length; i++) {
          if (oppTrophies.indexOf(order[i]) !== -1) { title = TROPHIES[order[i]].name; break; }
        }
        if (tOth) tOth.textContent = title || 'Débutant';
      }).catch(function() { if (tOth) tOth.textContent = 'Débutant'; });
  })();
  var vMe = _memEl('memVoteMe'), vOth = _memEl('memVoteOther');
  if (vMe)  { vMe.textContent  = '—'; vMe.className  = 'mem-vote-chip'; }
  if (vOth) { vOth.textContent = '—'; vOth.className = 'mem-vote-chip'; }

  ['classic','echo','archi','all'].forEach(function(mode) {
    var cap  = mode.charAt(0).toUpperCase() + mode.slice(1);
    var card = _memEl('memModeCard' + cap);
    if (!card) return;
    card.classList.remove('mem-mode-card--selected','mem-mode-card--matched');
    card.onclick = function() { _memVoteMode(mode); };
  });
}

// Chaque joueur écrit simplement son vote dans le state.
// Le routeur vérifie si les deux votes concordent → lance.
// Pas de fetch, pas de guard, pas d'état intermédiaire.
function _memVoteMode(mode) {
  if (!_memMp || !_memLastState) return;

  ['classic','echo','archi','all'].forEach(function(m) {
    var c = _memEl('memModeCard' + m.charAt(0).toUpperCase() + m.slice(1));
    if (c) c.classList.toggle('mem-mode-card--selected', m === mode);
  });
  var hint = _memEl('memModeHint');
  if (hint) hint.textContent = 'Vote envoyé — en attente de '+_memGetName(_memOther)+'…';

  // Écrire mon vote dans une copie du dernier état connu
  var ns = JSON.parse(JSON.stringify(_memLastState));
  ns[_memProfile + '_vote'] = mode;

  // Si l'autre a déjà voté le même mode → accord
  // Le second à voter publie directement le state de jeu prêt (avec les cartes)
  // Les deux joueurs recoivent ce meme state via onStateUpdate — aucun avantage
  if (ns[_memOther + '_vote'] === mode) {
    var cap = mode.charAt(0).toUpperCase() + mode.slice(1);
    var card = _memEl('memModeCard' + cap);
    if (card) card.classList.add('mem-mode-card--matched');
    if (hint) hint.textContent = '\u2705 Accord ! Lancement…';
    var gameState;
    if (mode === 'all') {
      gameState = _allBuildClassicState(); // manche 1 du ALL
      gameState.mode = 'all'; gameState.all_step = 'classic';
    } else if (mode === 'classic') {
      gameState = _memBuildClassicState(1);
    } else if (mode === 'echo') {
      gameState = _memBuildEchoState(1, [3, 3]);
    } else if (mode === 'archi') {
      gameState = _memBuildArchiState(1, false);
    }
    _memMp.saveState(gameState);
  } else {
    _memMp.saveState(ns);
  }
}

function _memUpdateVotes(state) {
  var labels = {classic:'Classique+', echo:'Écho', archi:'Architecte', all:'ALL'};
  var mv = state[_memProfile + '_vote'], ov = state[_memOther + '_vote'];
  var vMe = _memEl('memVoteMe'), vOth = _memEl('memVoteOther');
  if (vMe)  { vMe.textContent  = mv ? labels[mv] : '—'; vMe.className  = 'mem-vote-chip'+(mv?' mem-vote-chip--active':''); }
  if (vOth) { vOth.textContent = ov ? labels[ov] : '—'; vOth.className = 'mem-vote-chip'+(ov?' mem-vote-chip--active':''); }
}

// ═══════════════════════════════════════════════════════════
// ROUTEUR D'ÉTAT
// ═══════════════════════════════════════════════════════════

function _memRouteState(state, gameRow) {
  if (!state) return;
  var ph = state.phase;

  if (ph === 'mode_select') {
    _memUpdateVotes(state);
    var myVote  = state[_memProfile + '_vote'];
    var oppVote = state[_memOther   + '_vote'];
    if (myVote && oppVote && myVote === oppVote) {
      _memLaunchMode(myVote, gameRow);
    }

  } else if (state.mode === 'all') {
    // Tout état tagué mode:'all' est géré exclusivement par le routeur ALL
    _allRouteState(state, gameRow);

  } else if (ph === 'classic' || ph === 'echo' || ph === 'archi') {
    var mo = state.mode || ph;
    if (_memCurrentMode === mo) {
      if (ph === 'classic') _memApplyClassicState(state);
      else if (ph === 'echo')  _memApplyEchoState(state);
      else if (ph === 'archi') _memApplyArchiState(state);
    } else {
      _memLaunchMode(mo, gameRow);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// LANCEMENT
// ═══════════════════════════════════════════════════════════

function _memLaunchMode(mode, gameRow) {
  if (_memCurrentMode === mode && mode !== null) return; // anti-double
  _memCurrentMode = mode;
  if (mode === 'all') {
    _allStart(gameRow);
  } else {
    _memLaunchSingle(mode, gameRow);
  }
}




function _memLaunchSingle(mode, gameRow) {
  if (mode === 'classic') _memStartClassic(gameRow);
  else if (mode === 'echo')  _memStartEcho(gameRow);
  else if (mode === 'archi') _memStartArchi(gameRow);
}

// ═══════════════════════════════════════════════════════════
// CLASSIQUE+
// ═══════════════════════════════════════════════════════════

var _CLASSIC_CFGS = [
  {pairs:8,  cols:4, specials:[],                      timer:false},
  {pairs:10, cols:4, specials:['vue','miroir'],         timer:false},
  {pairs:10, cols:4, specials:['vue','miroir','bombe'], timer:90}
];

function _memStartClassic(gameRow) {
  _clManche=1; _clGirlPairs=0; _clBoyPairs=0; _clTotalMoves=0;
  _clProcessing=false; _clResultShown=false; _clSaved=false; _clSeconds=0; _clManche3Secs=0; _clTimerStart=0;
  if (_clTimer) { clearInterval(_clTimer); _clTimer=null; }
  _clCards=[]; _clFlipped=[];
  _memShowScreen('memScreenClassic');
  var _t=_memEl('memViewTitle');if(_t)_t.textContent='Classique+';
  var _ms=_memEl('memScreenClassic');if(_ms){var _gh=_ms.querySelector('.mem-game-header');if(_gh)_gh.style.display='none';var _op=_ms.querySelector('.mem-opp-presence');if(_op)_op.style.display='none';var _tr=_ms.querySelector('.mem-turn-row');var _tim=_memEl('memClassicTimer');if(_tim&&_tr&&!_tr.querySelector('#memClassicTimer')){_tim.style.cssText='font-size:13px;font-weight:500;color:#111827;background:#f9fafb;border:1px solid #f3f4f6;border-radius:99px;padding:4px 12px;';_tr.appendChild(_tim);}}
  _memRenderDualProfiles('memClassicMyProfile', 'memClassicOppProfile');
  _memUpdateClassicHeader();
  // Les deux joueurs recoivent le meme state via onStateUpdate — appliquer directement
  var state = gameRow && gameRow.state;
  if (state && (state.phase === 'classic' || state.phase === 'echo' || state.phase === 'archi')) {
    _memApplyClassicState(state);
  }
  // Sinon : le state arrive via onStateUpdate dans les ms qui suivent
}

function _memBuildClassicState(manche) {
  var cfg  = _CLASSIC_CFGS[manche-1];
  var pool = MEMORY_EMOJIS.slice(0,cfg.pairs).concat(MEMORY_EMOJIS.slice(0,cfg.pairs));
  for (var i=pool.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=pool[i];pool[i]=pool[j];pool[j]=t;}
  // timer_start fixé à la manche 1 uniquement — conservé ensuite pour chrono global
  return {phase:'classic',mode:'classic',manche:manche,cards:pool,matched:[],flipped:[],
    girl_pairs:0,boy_pairs:0,turn:'girl',moves:0,winner:null,
    specials:cfg.specials,timer_start:manche===1?Date.now():null,elapsed:0};
}

function _memUpdateClassicHeader() {
  var mEl = _memEl('memClassicManche');
  var isAll = (_memCurrentMode === 'all');
  if (mEl) mEl.textContent = isAll ? 'Mode Classique · 1 manche' : 'Manche '+_clManche+'/3';
  _memUpdateClassicScores();
}

function _memUpdateClassicScores() {
  var me  = _memProfile==='girl' ? _clGirlPairs : _clBoyPairs;
  var oth = _memProfile==='girl' ? _clBoyPairs  : _clGirlPairs;
  var eMe = _memEl('memClassicScoreMe'), eOth = _memEl('memClassicScoreOther');
  if (eMe)  eMe.textContent  = me;
  if (eOth) eOth.textContent = oth;
}

function _memApplyClassicState(state) {
  if (!state || _clProcessing) return;
  // Si c'est mon tour et que j'ai déjà une carte retournée localement,
  // ignorer l'update entrant pour ne pas perturber mon jeu en cours
  if (state.turn === _memProfile && _clFlipped.length > 0) return;
  _clGirlPairs = state.girl_pairs||0; _clBoyPairs = state.boy_pairs||0;
  var _prevManche = _clManche;         // snapshot AVANT écrasement
  _clManche    = state.manche||1;     _clMoves    = state.moves||0;
  // Mémoriser le timer_start global dès la manche 1
  if (state.timer_start && !_clTimerStart) _clTimerStart = state.timer_start;
  _memUpdateClassicHeader();

  if (state.winner && !_clResultShown) {
    _clResultShown = true;
    if (_clTimer) { clearInterval(_clTimer); _clTimer=null; }
    _memShowClassicMancheResult(state); return;
  }

  // Si pas de winner → s'assurer que le popup de résultat est caché et le flag remis à zero
  // (couvre le cas où l'adversaire lance la manche suivante avant que ce joueur n'ait cliqué)
  if (!state.winner) {
    var rEl = _memEl('memClassicMancheResult');
    if (rEl) rEl.style.display = 'none';
    _clResultShown = false;
  }

  var grid = _memEl('memClassicGrid'); if (!grid) return;
  var _stateCards = state.cards || [];
  // Reconstruire la grille si la longueur change OU si la manche a changé.
  // IMPORTANT : comparer avec _prevManche (snapshot avant l'écrasement de _clManche),
  // sinon state.manche === _clManche est toujours vrai à ce stade.
  if (_clCards.length !== _stateCards.length || _clManche !== _prevManche) {
    var mcfg = _CLASSIC_CFGS[Math.min((state.manche||1)-1, _CLASSIC_CFGS.length-1)];
    grid.style.width = '100%';
    grid.style.gridTemplateColumns = 'repeat('+mcfg.cols+', 1fr)';
    grid.innerHTML=''; _clCards=[];
    _stateCards.forEach(function(emoji,idx) {
      var card = document.createElement('div');
      card.className='mem-card'; card.dataset.emoji=emoji; card.dataset.idx=String(idx);
      card.innerHTML='<div class="mem-card-inner"><div class="mem-card-front"></div><div class="mem-card-back">'+emoji+'</div></div>';
      (function(c){c.addEventListener('click',function(){_memClassicCardClick(c);});})(card);
      grid.appendChild(card); _clCards.push(card);
    });
  }

  var matched=state.matched||[], flipped=state.flipped||[];
  _clCards.forEach(function(c,i) {
    if (matched.indexOf(i)!==-1){c.classList.add('flipped','matched');c.classList.remove('wrong','blocked');}
    else if(flipped.indexOf(i)!==-1){c.classList.add('flipped');c.classList.remove('matched','wrong','blocked');}
    else{c.classList.remove('flipped','matched','wrong','blocked');}
  });

  var myTurn = state.turn===_memProfile;
  // Bloquer uniquement si on est en train de traiter une paire (setTimeout en cours)
  if (myTurn && _clProcessing) return;
  // C'est mon tour → réinitialiser _clFlipped (nouveau tour propre)
  if (myTurn) _clFlipped = [];
  _memSetClassicBlocked(!myTurn);

  var badge=_memEl('memClassicTurnBadge');
  if (badge){badge.textContent=myTurn?'🎯 Ton tour':'⏳ '+_memGetName(_memOther);badge.className='mem-turn-badge'+(myTurn?'':' mem-turn-badge--other');}

  var specRow=_memEl('memClassicSpecialRow');
  if (specRow){
    if(state.specials&&state.specials.length){
      specRow.style.display='flex';
      var lbl={vue:'👁 Vue',miroir:'🪞 Miroir',bombe:'💣 Bombe'}, cls={vue:'mem-special-chip--vue',miroir:'mem-special-chip--miroir',bombe:'mem-special-chip--bombe'};
      specRow.innerHTML=state.specials.map(function(s){return '<div class="mem-special-chip '+(cls[s]||'')+'">'+(lbl[s]||s)+'</div>';}).join('');
    } else {
      specRow.style.display='none';
      specRow.innerHTML='';
    }
  }

  // Chrono global — démarre dès la manche 1, tourne en continu
  if (!_clTimer && !state.winner && _clTimerStart) {
    // Mémoriser le timestamp de début de manche 3 pour le trophée Éclair
    var _manche3Start = (_clManche === 3) ? Date.now() : 0;
    _clTimer = setInterval(function(){
      if (!_clTimerStart) return;
      var elapsed = Math.floor((Date.now() - _clTimerStart) / 1000);
      var el = _memEl('memClassicTimer');
      if (el) { el.textContent = _memFormatTime(elapsed); el.className = 'mem-game-timer'; }
      // Mettre a jour _clManche3Secs si on est en manche 3
      if (_clManche === 3 && _manche3Start) {
        _clManche3Secs = Math.floor((Date.now() - _manche3Start) / 1000);
      }
    }, 1000);
  }
}

function _memFormatTime(secs) {
  var m = Math.floor(secs/60), s = secs%60;
  return m>0 ? m+'m'+String(s).padStart(2,'0')+'s' : s+'s';
}

function _memBuildWinnerState(state) {
  var matched=_clCards.filter(function(c){return c.classList.contains('matched');}).map(function(c){return parseInt(c.dataset.idx);});
  return {phase:'classic',mode:'classic',manche:_clManche,
    cards:_clCards.map(function(c){return c.dataset.emoji;}),matched:matched,flipped:[],
    girl_pairs:_clGirlPairs,boy_pairs:_clBoyPairs,moves:_clMoves,
    specials:state.specials||[],timer_start:state.timer_start||0,elapsed:_clSeconds,
    winner:_clGirlPairs>_clBoyPairs?'girl':_clBoyPairs>_clGirlPairs?'boy':'draw'};
}

function _memSetClassicBlocked(blocked) {
  _clCards.forEach(function(c){if(!c.classList.contains('matched'))c.classList.toggle('blocked',blocked);});
}

function _memClassicCardClick(card) {
  if (!_memMp||card.classList.contains('flipped')||card.classList.contains('matched')||card.classList.contains('blocked')||_clProcessing||_clFlipped.length>=2) return;

  card.classList.add('flipped');
  _clFlipped.push(card);

  // Sauvegarder immédiatement (1ère ou 2ème carte) pour que l'adversaire voie en temps réel
  var _curRT=_memMp.getGameState?_memMp.getGameState():{}; if(!_curRT)_curRT={};
  var _flippedNow=_clFlipped.map(function(c){return parseInt(c.dataset.idx);});
  var _matchedNow=_clCards.filter(function(c){return c.classList.contains('matched');}).map(function(c){return parseInt(c.dataset.idx);});
  _memMp.saveState({phase:'classic',mode:'classic',manche:_clManche,
    cards:_clCards.map(function(c){return c.dataset.emoji;}),
    matched:_matchedNow, flipped:_flippedNow, turn:_memProfile,
    girl_pairs:_clGirlPairs, boy_pairs:_clBoyPairs, moves:_clMoves,
    specials:(_curRT.specials||[]), timer_start:(_curRT.timer_start||_clTimerStart||0), elapsed:_clSeconds, winner:null});

  // Attendre la 2ème carte
  if (_clFlipped.length !== 2) return;

  // 2 cartes retournées : bloquer les updates entrants pendant le traitement
  _clProcessing = true;
  _clMoves++; _clTotalMoves++;
  _memSetClassicBlocked(true); // bloquer le plateau localement

  var a=_clFlipped[0], b=_clFlipped[1], match=a.dataset.emoji===b.dataset.emoji;

  setTimeout(function(){
    _clProcessing = false;
    var matched=_clCards.filter(function(c){return c.classList.contains('matched');}).map(function(c){return parseInt(c.dataset.idx);});
    var cur=_memMp.getGameState?_memMp.getGameState():{}; if(!cur)cur={};

    if (match) {
      a.classList.add('matched'); b.classList.add('matched');
      matched=matched.concat([parseInt(a.dataset.idx),parseInt(b.dataset.idx)]);
      if (_memProfile==='girl') _clGirlPairs++; else _clBoyPairs++;
      var allDone=matched.length===_clCards.length;
      var winner=allDone?(_clGirlPairs>_clBoyPairs?'girl':_clBoyPairs>_clGirlPairs?'boy':'draw'):null;
      // Match : je rejoue (turn reste à moi)
      _clFlipped=[];
      _memSetClassicBlocked(false);
      _memMp.saveState({phase:'classic',mode:'classic',manche:_clManche,
        cards:_clCards.map(function(c){return c.dataset.emoji;}),
        matched:matched, flipped:[], turn:_memProfile,
        girl_pairs:_clGirlPairs, boy_pairs:_clBoyPairs, moves:_clMoves,
        specials:(cur.specials||[]), timer_start:(cur.timer_start||_clTimerStart||0), elapsed:_clSeconds, winner:winner});
    } else {
      a.classList.add('wrong'); b.classList.add('wrong');
      setTimeout(function(){
        a.classList.remove('flipped','wrong'); b.classList.remove('flipped','wrong');
        _clFlipped=[];
        // Pas de match : passer le tour à l'adversaire
        _memMp.saveState({phase:'classic',mode:'classic',manche:_clManche,
          cards:_clCards.map(function(c){return c.dataset.emoji;}),
          matched:matched, flipped:[], turn:_memProfile==='girl'?'boy':'girl',
          girl_pairs:_clGirlPairs, boy_pairs:_clBoyPairs, moves:_clMoves,
          specials:(cur.specials||[]), timer_start:(cur.timer_start||_clTimerStart||0), elapsed:_clSeconds, winner:null});
      }, 700);
    }
    _memUpdateClassicScores();
  }, match ? 300 : 0);
}

function _memShowClassicMancheResult(state) {
  var me=_memProfile==='girl'?state.girl_pairs:state.boy_pairs;
  var oth=_memProfile==='girl'?state.boy_pairs:state.girl_pairs;
  var iWon=state.winner===_memProfile, isDraw=state.winner==='draw';
  var isAll=_memCurrentMode==='all';
  var rEl=_memEl('memClassicMancheResult'); if (!rEl) return;
  rEl.style.display='flex';
  var eEl=_memEl('memClassicMancheEmoji'),tEl=_memEl('memClassicMancheTitle'),sEl=_memEl('memClassicMancheSub');
  if (eEl) eEl.textContent=isDraw?'🤝':iWon?'🏆':'😢';
  if (tEl) tEl.textContent=isDraw?'Égalité !':iWon?'Tu remportes la manche !':_memGetName(_memOther)+' remporte la manche !';
  if (sEl) sEl.textContent=me+' paires vs '+oth+' · '+state.moves+' coups';

  var nextBtn=_memEl('memClassicNextBtn'), quitBtn=_memEl('memClassicQuitBtn');
  if (nextBtn) {
    nextBtn.style.display=(isAll||_clManche>=3)?'none':'';
    nextBtn.textContent='Manche suivante →';
    nextBtn.onclick=function(){
      rEl.style.display='none'; _clResultShown=false; _clCards=[]; _clFlipped=[]; _clMoves=0;
      _clManche++;
      if (_clTimer){clearInterval(_clTimer);_clTimer=null;}
      if (_memMp) {
        var ns = _memBuildClassicState(_clManche);
        if (_clTimerStart) ns.timer_start = _clTimerStart;
        _memMp.saveState(ns);
      }
    };
  }
  if (quitBtn) quitBtn.onclick=function(){_memShowClassicFinal(state);};
  if (isAll||_clManche>=3) setTimeout(function(){_memShowClassicFinal(state);},2200);
}

function _memShowClassicFinal(state) {
  var rEl=_memEl('memClassicMancheResult'); if (rEl) rEl.style.display='none';
  var fEl=_memEl('memClassicFinalResult'); if (!fEl) return;
  fEl.style.display='flex';
  var gW=_clGirlPairs, bW=_clBoyPairs;
  var fw=gW>bW?'girl':bW>gW?'boy':'draw', iWon=fw===_memProfile, isDraw=fw==='draw';
  var eEl=_memEl('memClassicFinalEmoji'),tEl=_memEl('memClassicFinalTitle'),sEl=_memEl('memClassicFinalScore');
  if (eEl) eEl.textContent=isDraw?'🤝':iWon?'🏆':'🎖️';
  if (tEl) tEl.textContent=isDraw?'Égalité !':iWon?'Victoire ! 🎉':_memGetName(_memOther)+' gagne !';
  if (sEl) {
    var totalSecs = _clTimerStart ? Math.floor((Date.now()-_clTimerStart)/1000) : 0;
    sEl.textContent=(_memProfile==='girl'?gW:bW)+' paires · '+_clTotalMoves+' coups · '+_memFormatTime(totalSecs);
  }
  if (iWon&&_clManche3Secs>0&&_clManche3Secs<60) _memUnlockTrophy('eclair','memClassicTrophyUnlock');
  if (iWon&&_clTotalMoves<20) _memUnlockTrophy('precision','memClassicTrophyUnlock');
  if (_memProfile==='girl') {
    var cid=_memGetCoupleId(),dur=Math.round((Date.now()-_memStartedAt)/1000);
    if (cid) ['girl','boy'].forEach(function(r){
      var myPairs = r==='girl'?gW:bW;
      var total   = Math.max(1, gW+bW);
      var iWin    = fw===r, isDraw = fw==='draw';
      // Proportion de paires (0-600) + bonus victoire (200) ou draw (100) + bonus vitesse (0-200)
      var sc_pairs   = Math.round((myPairs/total)*600);
      var sc_win     = iWin?200:(isDraw?100:0);
      var sc_speed   = dur>0 ? Math.max(0, Math.round(200 - (dur/3))) : 0; // -1pt/3s, max 200
      var sc         = Math.min(1000, sc_pairs + sc_win + sc_speed);
      sb2Post('game_scores',{couple_id:cid,game_id:'memory_classic',player_role:r,score:sc,moves:_clTotalMoves,time_seconds:dur,winner_role:fw,user_id:typeof yamGetUser==="function"?yamGetUser().id:null}).catch(function(){});
    });
  }
  var doneBtn=_memEl('memClassicDoneBtn');
  if (doneBtn) doneBtn.onclick=function(){
    fEl.style.display='none';
    // Supprimer la partie en base avant le cleanup (evite la partie fantome)
    if (_memMp && typeof _memMp.deleteGame === 'function') _memMp.deleteGame();
    _memCleanup();_memShowLb(true);_lbLoad();
  };
  if (typeof window.yamFlameActivity==='function') window.yamFlameActivity('memory_done');
}

// ═══════════════════════════════════════════════════════════
// ÉCHO
// ═══════════════════════════════════════════════════════════

function _memStartEcho(gameRow) {
  _echoLevel=1; _echoSaved=false; _echoPublished=false; _echoSequence=[]; _echoMyInput=[]; _echoShowing=false;
  _memShowScreen('memScreenEcho');
  var _t=_memEl('memViewTitle');if(_t)_t.textContent='Echo';
  var _msE=_memEl('memScreenEcho');if(_msE){var _ghE=_msE.querySelector('.mem-game-header');if(_ghE)_ghE.style.display='none';var _sep=_msE.querySelector('.mem-echo-lives-sep');if(_sep)_sep.style.display='none';}
  _memEchoEnsureSeqBar();
  _memRenderEchoProfiles('memEchoMyProfile', 'memEchoOppProfile', 3);
  var lEl=_memEl('memEchoLevel'); if (lEl) lEl.textContent='Niveau 1';
  var grid=_memEl('memEchoGrid');
  if (grid){grid.innerHTML='';ECHO_EMOJIS.forEach(function(e,i){
    var cell=document.createElement('div');cell.className='mem-echo-cell mem-echo-cell--blocked';cell.textContent=e;
    (function(idx){cell.addEventListener('click',function(){_memEchoTap(idx);});})(i);
    grid.appendChild(cell);
  });}
  var stateE = gameRow && gameRow.state;
  if (stateE && stateE.phase === 'echo') {
    _memApplyEchoState(stateE);
  }
  // Sinon : state arrive via onStateUpdate
}

function _memBuildEchoState(level,lives) {
  var seq=[]; for (var i=0;i<level+2;i++) seq.push(Math.floor(Math.random()*8));
  return {phase:'echo',mode:'echo',manche:1,sequence:seq,level:level,
    girl_lives:lives[0],boy_lives:lives[1],
    girl_input:[],boy_input:[],
    girl_max_level:0,boy_max_level:0,   // niveau max atteint par chacun
    girl_finish_time:null,boy_finish_time:null, // timestamp quand chacun atteint ce niveau
    girl_eliminated:false,boy_eliminated:false, // éliminé = plus de cœurs
    winner:null};
}

function _memApplyEchoState(state) {
  if (!state||state.phase!=='echo') return;
  var prevLevel = _echoLevel;
  var prevSeqLen = _echoSequence.length;
  _echoSequence=state.sequence||[]; _echoLevel=state.level||1;
  // Réinitialiser _echoShowing si le niveau ou la séquence a changé
  // (couvre le cas où c'est l'adversaire qui publie le niveau suivant)
  if (_echoLevel !== prevLevel || _echoSequence.length !== prevSeqLen) _echoShowing = false;
  var ml=_memProfile==='girl'?state.girl_lives:state.boy_lives;
  var ol=_memProfile==='girl'?state.boy_lives:state.girl_lives;
  var meElim   = _memProfile==='girl'?state.girl_eliminated:state.boy_eliminated;
  var othElim  = _memProfile==='girl'?state.boy_eliminated:state.girl_eliminated;
  function hearts(n){return['❤️','❤️','❤️'].slice(0,Math.max(0,n)).join('')||'💀';}
  var lMe=_memEl('memEchoLivesMe'),lOth=_memEl('memEchoLivesOther');
  if (lMe) lMe.textContent=hearts(ml); if (lOth) lOth.textContent=hearts(ol);
  var lv=_memEl('memEchoLevel'); if (lv) lv.textContent='Niveau '+_echoLevel;
  if (state.winner&&!_echoSaved){_memShowEchoResult(state);return;}
  var myInput=_memProfile==='girl'?state.girl_input:state.boy_input;
  _memUpdateEchoPips(_echoSequence.length,(myInput||[]).length);

  // Filet : je suis survivant, adversaire éliminé, winner non publié
  // Utilise _echoPublished (pas _echoSaved) pour ne pas bloquer l'affichage du résultat
  if (!meElim && othElim && !state.winner && !_echoPublished && _memMp) {
    var _nsF = JSON.parse(JSON.stringify(state));
    var myF  = (_memProfile==='girl'?_nsF.girl_input:_nsF.boy_input)||[];
    if (myF.length === _echoSequence.length) {
      // J'ai réussi ma séquence → publier winner
      _echoPublished = true;
      _nsF.winner = _memEchoPickWinner(_nsF);
      _memMp.saveState(_nsF);
      return;
    }
  }

  // Si je suis éliminé : afficher message d'attente, bloquer la grille
  if (meElim) {
    var ph=_memEl('memEchoPhase');
    if(ph) ph.textContent='💀 Tu attends que '+_memGetName(_memOther)+' finisse…';
    _memEchoBlock(); return;
  }
  // Lancer l'animation de séquence une seule fois par niveau
  if ((myInput||[]).length<_echoSequence.length && !_echoShowing) {
    _echoShowing = true;
    _echoMyInput = (myInput||[]).slice();
    _memEchoShowSeq(function(){ _memEchoUnblock(); });
  }
}

function _memEchoShowSeq(cb) {
  var ph=_memEl('memEchoPhase'); if (ph) ph.textContent='👀 Mémorise…';
  _memEchoBlock(); if (_echoShowInt) clearInterval(_echoShowInt);
  var idx=0;
  _echoShowInt=setInterval(function(){
    var cells=document.querySelectorAll('#memEchoGrid .mem-echo-cell');
    cells.forEach(function(c){c.classList.remove('mem-echo-cell--lit');});
    if (idx<_echoSequence.length){
      var cell=cells[_echoSequence[idx]]; if (cell) cell.classList.add('mem-echo-cell--lit');
      setTimeout(function(){if(cell)cell.classList.remove('mem-echo-cell--lit');},500);
      idx++;
    } else {clearInterval(_echoShowInt);_echoShowInt=null;if(cb)setTimeout(cb,400);}
  },700);
}

function _memEchoBlock(){document.querySelectorAll('#memEchoGrid .mem-echo-cell').forEach(function(c){c.classList.add('mem-echo-cell--blocked');});}
function _memEchoUnblock(){
  var ph=_memEl('memEchoPhase');if(ph)ph.textContent='🎯 Reproduis !';
  document.querySelectorAll('#memEchoGrid .mem-echo-cell').forEach(function(c){c.classList.remove('mem-echo-cell--blocked');});
}

function _memEchoTap(idx) {
  if (_echoMyInput.length>=_echoSequence.length||!_memMp) return;
  var exp=_echoSequence[_echoMyInput.length];
  var cell=document.querySelectorAll('#memEchoGrid .mem-echo-cell')[idx];
  if (idx===exp){
    if(cell){cell.classList.add('mem-echo-cell--correct');setTimeout(function(){cell.classList.remove('mem-echo-cell--correct');},400);}
    _echoMyInput.push(idx);
    _memUpdateEchoPips(_echoSequence.length,_echoMyInput.length);
    if (_echoMyInput.length===_echoSequence.length){_memEchoBlock();_memSaveEchoInput(true);}
  } else {
    if(cell){cell.classList.add('mem-echo-cell--wrong');setTimeout(function(){cell.classList.remove('mem-echo-cell--wrong');},500);}
    _echoMyInput=[];_echoShowing=false;_memEchoBlock();_memUpdateEchoPips(_echoSequence.length,0);_memSaveEchoInput(false);
  }
}

function _memSaveEchoInput(success) {
  if (!_memMp) return;
  var cur=_memMp.getGameState?_memMp.getGameState():null;
  if(!cur) cur=_memLastState;
  if(!cur) return;
  var ns=JSON.parse(JSON.stringify(cur));
  var now = Date.now();
  ns[_memProfile+'_input'] = success ? _echoMyInput.slice() : [];

  if (!success) {
    // Erreur → perd une vie
    ns[_memProfile+'_lives'] = Math.max(0,(ns[_memProfile+'_lives']||3)-1);
    if (ns[_memProfile+'_lives'] <= 0) {
      // Éliminé → mémoriser le niveau atteint et le moment
      ns[_memProfile+'_eliminated']  = true;
      ns[_memProfile+'_max_level']   = _echoLevel;
      ns[_memProfile+'_finish_time'] = now;
      // Si l'autre est aussi éliminé → départager
      if (ns[_memOther+'_eliminated']) {
        ns.winner = _memEchoPickWinner(ns);
      }
      // Sinon : la partie continue pour l'autre joueur
    }
  } else {
    // Succès → mettre à jour le niveau max
    if ((_echoLevel) > (ns[_memProfile+'_max_level']||0)) {
      ns[_memProfile+'_max_level']   = _echoLevel;
      ns[_memProfile+'_finish_time'] = now;
    }
    var otherDone  = (ns[_memOther+'_input']||[]).length === _echoSequence.length;
    var otherElim  = !!(ns[_memOther+'_eliminated']);
    if (otherElim && !otherDone) {
      // L'adversaire est éliminé mais n'a pas réussi → je suis le survivant → je gagne
      _echoPublished = true;
      ns.winner = _memEchoPickWinner(ns);
    } else if (otherDone || otherElim) {
      // Les deux ont terminé ce niveau → passer au suivant
      var lv = _echoLevel + 1;
      if (lv>8)  _memUnlockTrophy('telepathie','memEchoTrophyUnlock');
      if (lv>10) _memUnlockTrophy('inextinguible','memEchoTrophyUnlock');
      _echoShowing = false;
      var newState = _memBuildEchoState(lv,[ns.girl_lives,ns.boy_lives]);
      // Transférer les stats max/finish/eliminated
      newState.girl_max_level   = ns.girl_max_level||0;
      newState.boy_max_level    = ns.boy_max_level||0;
      newState.girl_finish_time = ns.girl_finish_time||null;
      newState.boy_finish_time  = ns.boy_finish_time||null;
      newState.girl_eliminated  = ns.girl_eliminated||false;
      newState.boy_eliminated   = ns.boy_eliminated||false;
      ns = newState;
    }
  }
  _memMp.saveState(ns);
}

function _memEchoPickWinner(ns) {
  var gElim = !!(ns.girl_eliminated), bElim = !!(ns.boy_eliminated);
  // Un survivant bat toujours un éliminé, peu importe les niveaux et timestamps
  if (!gElim && bElim) return 'girl';
  if (!bElim && gElim) return 'boy';
  // Les deux dans le même état (deux survivants ou deux éliminés)
  // → départager par niveau max atteint
  var gLv = ns.girl_max_level||0, bLv = ns.boy_max_level||0;
  if (gLv !== bLv) return gLv > bLv ? 'girl' : 'boy';
  // Même niveau → celui qui l'a atteint en premier gagne
  var gT = ns.girl_finish_time||0, bT = ns.boy_finish_time||0;
  if (gT && bT && gT !== bT) return gT < bT ? 'girl' : 'boy';
  return 'draw';
}

function _memUpdateEchoPips(total,done){
  var prog=_memEl('memEchoProgress');if(!prog)return;prog.innerHTML='';
  for(var i=0;i<total;i++){var p=document.createElement('div');p.className='mem-echo-pip'+(i<done?' mem-echo-pip--done':i===done?' mem-echo-pip--active':'');prog.appendChild(p);}
}

function _memShowEchoResult(state) {
  _echoSaved=true; var fEl=_memEl('memEchoFinalResult');if(!fEl)return;fEl.style.display='flex';
  var iWon=state.winner===_memProfile,isDraw=state.winner==='draw';
  var eEl=_memEl('memEchoFinalEmoji'),tEl=_memEl('memEchoFinalTitle'),sEl=_memEl('memEchoFinalScore');
  if(eEl)eEl.textContent=isDraw?'🤝':iWon?'🏆':'😢';
  if(tEl)tEl.textContent=isDraw?'Égalité !':iWon?'Victoire !':_memGetName(_memOther)+' gagne !';
  if(sEl){
    var myMaxLv = _memProfile==='girl'?(state.girl_max_level||_echoLevel):(state.boy_max_level||_echoLevel);
    var othMaxLv= _memProfile==='girl'?(state.boy_max_level||0):(state.girl_max_level||0);
    sEl.textContent='Niveau max : '+myMaxLv+' vs '+othMaxLv;
  }
  if(_memProfile==='girl'){
  var cid=_memGetCoupleId(),dur=Math.round((Date.now()-_memStartedAt)/1000);
  if(cid)['girl','boy'].forEach(function(r){
    var maxLv   = r==='girl'?(state.girl_max_level||_echoLevel):(state.boy_max_level||0);
    var survived= r==='girl'?!state.girl_eliminated:!state.boy_eliminated;
    var iWin    = state.winner===r, isDraw = state.winner==='draw';
    // Niveau max atteint (0-640) + survie (200) + victoire (100) ou draw (50)
    var sc_level = Math.min(640, maxLv*80);
    var sc_surv  = survived?200:0;
    var sc_win   = iWin?100:(isDraw?50:0);
    var sc       = Math.min(1000, sc_level+sc_surv+sc_win);
    sb2Post('game_scores',{couple_id:cid,game_id:'memory_echo',player_role:r,score:sc,moves:0,time_seconds:dur,winner_role:state.winner,user_id:typeof yamGetUser==="function"?yamGetUser().id:null}).catch(function(){});
  });
}
  var btn=_memEl('memEchoDoneBtn');if(btn)btn.onclick=function(){
    fEl.style.display='none';
    if (_memMp && typeof _memMp.deleteGame === 'function') _memMp.deleteGame();
    _memCleanup();_memShowLb(true);_lbLoad();
  };
  if(typeof window.yamFlameActivity==='function')window.yamFlameActivity('memory_done');
}

// ═══════════════════════════════════════════════════════════
// ARCHITECTE
// ═══════════════════════════════════════════════════════════

function _memStartArchi(gameRow) {
  _archiRound=1; _archiTarget=[]; _archiMyTarget=[]; _archiPerfect=true; _archiSaved=false;
  _memShowScreen('memScreenArchi');
  var _t=_memEl('memViewTitle');if(_t)_t.textContent='Architecte';
  var _ms3=_memEl('memScreenArchi');if(_ms3){var _gh3=_ms3.querySelector('.mem-game-header');if(_gh3)_gh3.style.display='none';var _oldSh=_ms3.querySelector('.mem-archi-shapes');if(_oldSh)_oldSh.style.display='none';}
  _memArchiSetup3Cols();
  _memRenderDualProfiles('memArchiMyProfile', 'memArchiOppProfile');
  var nMe=_memEl('memArchiNameMe'),nOth=_memEl('memArchiNameOther');
  if(nMe)nMe.textContent=_memGetName(_memProfile);
  if(nOth)nOth.textContent=_memGetName(_memOther);
  _memBuildArchiPalette();
  var isAll = _memCurrentMode === 'all';
  var stateA = gameRow && gameRow.state;
  if (stateA && stateA.phase === 'archi') {
    // Recalculer show_until localement pour garantir 4s d'animation complètes
    var localStateA = JSON.parse(JSON.stringify(stateA));
    localStateA.show_until = Date.now() + 4000;
    _memApplyArchiState(localStateA);
  }
  // Sinon : state arrive via onStateUpdate
}

// Tours DIFFÉRENTES pour chaque joueur — chacun a sa propre séquence à mémoriser
function _memBuildArchiState(round, isAll) {
  var len = 3 + round;
  var girlTarget=[], boyTarget=[];
  for(var i=0;i<len;i++) {
    girlTarget.push(Math.floor(Math.random()*ARCHI_SHAPES.length));
    boyTarget.push(Math.floor(Math.random()*ARCHI_SHAPES.length));
  }
  var maxRounds = isAll ? 1 : 3;
  return {
    phase:'archi', mode:'archi', manche:round, max_rounds:maxRounds,
    girl_target:girlTarget, boy_target:boyTarget,  // tours différentes
    girl_stack:[], boy_stack:[],
    girl_errors:0, boy_errors:0,   // compteur d'erreurs par round
    girl_score:0, boy_score:0,     // rounds gagnés
    girl_done:false, boy_done:false,
    girl_done_time:null, boy_done_time:null, // timestamp de fin de round
    winner:null,
    show_until:Date.now()+4000
  };
}

// _archiMyTarget = la tour de CE joueur (girl_target ou boy_target selon le rôle)
var _archiMyTarget = [];

function _memBuildArchiPalette() {
  var p=_memEl('memArchiShapesMe');if(!p)return;p.innerHTML='';
  ARCHI_SVG.forEach(function(s,i){
    p.appendChild(_memArchiShapeEl(i,44,(function(idx){return function(){_memArchiTap(idx);};})(i)));
  });
}

function _memApplyArchiState(state) {
  if(!state||state.phase!=='archi')return;
  // Chaque joueur lit SA propre tour
  _archiMyTarget = (_memProfile==='girl' ? state.girl_target : state.boy_target) || [];
  _archiTarget   = _archiMyTarget; // compatibilité
  _archiRound    = state.manche||1;
  var maxRounds  = state.max_rounds||3;
  var rEl=_memEl('memArchiRound');
  if(rEl) rEl.textContent = maxRounds===1 ? 'Tour unique' : 'Round '+_archiRound+'/'+maxRounds;

  // Afficher SA propre tour pendant la phase mémorisation
  var targetEl=_memEl('memArchiTarget');
  if(targetEl){
    var showing=Date.now()<(state.show_until||0);
    if(showing){
      targetEl.innerHTML='';
      _archiMyTarget.forEach(function(si){
        var s=_memArchiShapeEl(si,44,null);
        if(targetEl.firstChild){targetEl.insertBefore(s,targetEl.firstChild);}else{targetEl.appendChild(s);}
      });
      var rem=state.show_until-Date.now();
      setTimeout(function(){
        if(targetEl)targetEl.innerHTML='<div style="font-size:13px;color:var(--muted);padding:12px;">🫣 Tour cachée</div>';
        // Mettre à jour uniquement la phase texte sans récursion
        var phEl2=_memEl('memArchiPhase');
        if(phEl2) phEl2.textContent='🏗️ Reconstruit !';
        var pal2=_memEl('memArchiShapesMe');
        var cur2=(_memMp&&_memMp.getGameState?_memMp.getGameState():null)||_memLastState;
        if(pal2) pal2.style.pointerEvents=(cur2&&cur2[_memProfile+'_done'])?'none':'';
      },rem);
    } else {
      targetEl.innerHTML='<div style="display:flex;align-items:center;justify-content:center;gap:6px;padding:14px 8px;font-size:12px;color:#9ca3af;">&#128274; Tour cach&#233;e</div>';
    }
  }

  var phEl=_memEl('memArchiPhase'),showing2=Date.now()<(state.show_until||0);
  if(phEl)phEl.textContent=showing2?'👀 Mémorise ta tour ! ('+Math.ceil(((state.show_until||0)-Date.now())/1000)+'s)':'🏗️ Reconstruit !';

  // Afficher les piles (chacun voit sa pile ET celle de l'adversaire)
  _memRenderArchiStack(_memEl('memArchiStackMe'),    _memProfile==='girl'?state.girl_stack:state.boy_stack);
  _memRenderArchiStack(_memEl('memArchiStackOther'), _memProfile==='girl'?state.boy_stack:state.girl_stack);

  // Bloquer palette pendant mémorisation ou si ce joueur a déjà fini ce round
  var pal=_memEl('memArchiShapesMe');
  if(pal) pal.style.pointerEvents=(showing2||state[_memProfile+'_done'])?'none':'';

  // Scores = rounds gagnés
  var gS=state.girl_score||0, bS=state.boy_score||0;
  var eMe=_memEl('memArchiScoreMe'),eOth=_memEl('memArchiScoreOther');
  if(eMe)eMe.textContent=(_memProfile==='girl'?gS:bS);
  if(eOth)eOth.textContent=(_memProfile==='girl'?bS:gS);

  if(state.winner&&!_archiSaved){_memShowArchiResult(state);}
}

function _memRenderArchiStack(el,stack){
  if(!el)return;el.innerHTML='';
  (stack||[]).forEach(function(si){
    var s=_memArchiShapeEl(si,44,null);
    if(el.firstChild){el.insertBefore(s,el.firstChild);}else{el.appendChild(s);}
  });
}

function _memArchiTap(si) {
  if(!_memMp)return;
  var cur=_memMp.getGameState?_memMp.getGameState():null;
  if(!cur) cur=_memLastState;
  if(!cur)return;
  if(Date.now()<Math.max(cur.show_until||0, _allArchiShowUntil||0))return;
  if(cur[_memProfile+'_done'])return; // déjà fini ce round

  var sp=_memProfile+'_stack';
  var ns=JSON.parse(JSON.stringify(cur));
  var myStack=(ns[sp]||[]).concat([si]);
  ns[sp]=myStack;

  var exp=_archiMyTarget[myStack.length-1];
  if(si!==exp){
    // Erreur → réinitialiser la pile, incrémenter les erreurs
    ns[sp]=[];
    ns[_memProfile+'_errors']=(ns[_memProfile+'_errors']||0)+1;
    _archiPerfect=false;
    var sEl=_memEl('memArchiStackMe');
    if(sEl){sEl.classList.add('mem-archi-stack--wrong');setTimeout(function(){sEl.classList.remove('mem-archi-stack--wrong');},400);}
    _memMp.saveState(ns);
    return;
  }

  // Bonne forme
  if(myStack.length===_archiMyTarget.length){
    // Ce joueur a fini sa tour en premier (ou en deuxième)
    ns[_memProfile+'_done']      = true;
    ns[_memProfile+'_done_time'] = Date.now();

    var sEl2=_memEl('memArchiStackMe');
    if(sEl2){sEl2.classList.add('mem-archi-stack--complete');setTimeout(function(){sEl2.classList.remove('mem-archi-stack--complete');},600);}

    if(ns[_memOther+'_done']){
      // Les deux ont fini → attribuer le point du round au plus rapide
      var myTime  = ns[_memProfile+'_done_time'];
      var othTime = ns[_memOther+'_done_time'];
      var roundWinner = myTime <= othTime ? _memProfile : _memOther;
      ns[roundWinner+'_score'] = (ns[roundWinner+'_score']||0) + 1;

      var maxRounds = cur.max_rounds||3;
      if(cur.manche >= maxRounds){
        // Fin de partie → publier une seule fois avec winner
        var gS=ns.girl_score||0, bS=ns.boy_score||0;
        ns.winner = gS>bS?'girl':bS>gS?'boy':'draw';
        _memMp.saveState(ns);
      } else {
        // Round suivant → publier ns d'abord (avec _done:true visible), puis next après délai
        _memMp.saveState(ns);
        var isAll = _memCurrentMode==='all';
        var _nsScores = {girl: ns.girl_score||0, boy: ns.boy_score||0};
        setTimeout(function(){
          if(_memMp){
            var next=_memBuildArchiState(cur.manche+1, isAll);
            next.girl_score=_nsScores.girl;
            next.boy_score=_nsScores.boy;
            _memMp.saveState(next);
          }
        },1200);
      }
      return; // ne pas retomber dans le saveState générique ci-dessous
    }
    // Si l'autre n'a pas encore fini : on attend, la partie continue pour lui
  }
  _memMp.saveState(ns);
}

function _memShowArchiResult(state){
  _archiSaved=true;
  var fEl=_memEl('memArchiFinalResult');if(!fEl)return;fEl.style.display='flex';
  var iWon=state.winner===_memProfile,isDraw=state.winner==='draw';
  var eEl=_memEl('memArchiFinalEmoji'),tEl=_memEl('memArchiFinalTitle');
  if(eEl)eEl.textContent=isDraw?'🤝':iWon?'🏆':'😢';
  if(tEl)tEl.textContent=isDraw?'Égalité !':iWon?'Victoire !':_memGetName(_memOther)+' gagne !';
  // Trophée si gagné sans aucune erreur
  var myErrors = _memProfile==='girl'?(state.girl_errors||0):(state.boy_errors||0);
  if(iWon && myErrors===0) _memUnlockTrophy('architecte','memArchiTrophyUnlock');
  // Sauvegarder le score
  if(_memProfile==='girl'){
    var cid=_memGetCoupleId(),dur=Math.round((Date.now()-_memStartedAt)/1000);
    if(cid)['girl','boy'].forEach(function(r){
      var rounds     = r==='girl'?(state.girl_score||0):(state.boy_score||0);
      var errors     = r==='girl'?(state.girl_errors||0):(state.boy_errors||0);
      var maxRounds  = state.max_rounds||3;
      var iWin       = state.winner===r, isDraw = state.winner==='draw';
      // Rounds gagnés (0-600) + précision zéro erreur (200) + victoire (200)
      var sc_rounds  = Math.round((rounds/Math.max(1,maxRounds))*600);
      var sc_perfect = errors===0?200:Math.max(0,200-errors*20);
      var sc_win     = iWin?200:(isDraw?100:0);
      var sc         = Math.min(1000, sc_rounds+sc_perfect+sc_win);
      sb2Post('game_scores',{couple_id:cid,game_id:'memory_archi',player_role:r,score:sc,
        moves:errors, time_seconds:dur, winner_role:state.winner,
        user_id:typeof yamGetUser==='function'?yamGetUser().id:null}).catch(function(){});
    });
  }
  var btn=_memEl('memArchiDoneBtn');if(btn)btn.onclick=function(){
    fEl.style.display='none';
    if (_memMp && typeof _memMp.deleteGame === 'function') _memMp.deleteGame();
    _memCleanup();_memShowLb(true);_lbLoad();
  };
  if(typeof window.yamFlameActivity==='function')window.yamFlameActivity('memory_done');
}




// ═══════════════════════════════════════════════════════════
// MODE ALL — Entièrement autonome
// 3 étapes séquentielles : classic (niveau 2) → echo (niveau 5) → archi (1 round)
// Chaque state porte mode:'all' + all_step:'classic'|'echo'|'archi'
// Aucune dépendance aux modes standalone — copie directe de leur logique
// ═══════════════════════════════════════════════════════════

// ── État local ALL ──
var _allStep        = null;   // 'classic' | 'echo' | 'archi'
var _allResults     = {};     // {classic:{winner}, echo:{winner}, archi:{winner}}
var _allResultShown = false;

// ── État classic ALL ──
var _allClCards      = [], _allClFlipped = [];
var _allClGirlPairs  = 0,  _allClBoyPairs = 0, _allClMoves = 0;
var _allClProcessing = false, _allClTimerStart = 0, _allClTimer = null;

// ── État echo ALL ──
var _allEchoSeq     = [], _allEchoMyInput = [], _allEchoShowing = false;
var _allEchoShowInt = null, _allEchoSaved = false, _allEchoPublished = false;

// ── État archi ALL ──
var _allArchiMyTarget = [], _allArchiSaved = false, _allArchiPerfect = true, _allArchiShowUntil = 0;

// ─────────────────────────────────────────────
// BUILDERS — chaque step a son propre state shape
// ─────────────────────────────────────────────

// Classique niveau 2 : 10 paires, spéciales vue+miroir, pas de timer
function _allBuildClassicState() {
  var pool = MEMORY_EMOJIS.slice(0,10).concat(MEMORY_EMOJIS.slice(0,10));
  for (var i=pool.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=pool[i];pool[i]=pool[j];pool[j]=t;}
  return {phase:'classic', mode:'all', all_step:'classic',
    cards:pool, matched:[], flipped:[], turn:'girl',
    girl_pairs:0, boy_pairs:0, moves:0, winner:null,
    specials:['vue','miroir'], timer_start:Date.now()};
}

// Écho niveau 5 : séquence de 7 items, 3 vies chacun (↑ de 2 → 3 pour ALL)
function _allBuildEchoState() {
  var seq=[]; for(var i=0;i<7;i++) seq.push(Math.floor(Math.random()*8));
  return {phase:'echo', mode:'all', all_step:'echo',
    sequence:seq, level:5,
    girl_lives:3, boy_lives:3,
    girl_input:[], boy_input:[],
    girl_max_level:0, boy_max_level:0,
    girl_finish_time:null, boy_finish_time:null,
    girl_eliminated:false, boy_eliminated:false,
    winner:null};
}

// Architecte 1 round, séquence de 4 formes
function _allBuildArchiState() {
  var gl=[], bl=[];
  for(var i=0;i<4;i++){
    gl.push(Math.floor(Math.random()*ARCHI_SHAPES.length));
    bl.push(Math.floor(Math.random()*ARCHI_SHAPES.length));
  }
  return {phase:'archi', mode:'all', all_step:'archi',
    manche:1, max_rounds:1,
    girl_target:gl, boy_target:bl,
    girl_stack:[], boy_stack:[],
    girl_errors:0, boy_errors:0,
    girl_score:0, boy_score:0,
    girl_done:false, boy_done:false,
    girl_done_time:null, boy_done_time:null,
    winner:null, show_until:Date.now()+4000};
}

// ─────────────────────────────────────────────
// DÉMARRAGE
// ─────────────────────────────────────────────

function _allStart(gameRow) {
  // Reset complet de tout l'etat ALL — critique pour eviter les residus d'une partie precedente
  _memCurrentMode = 'all'; // marquer explicitement pour closeMemoryGame et openMemoryGame
  _allStep = null; _allResults = {}; _allResultShown = false;
  _allEchoSaved = false; _allEchoPublished = false; _allArchiSaved = false; _allArchiShowUntil = 0;
  // Reset etat Classic ALL
  _allClCards = []; _allClFlipped = [];
  _allClGirlPairs = 0; _allClBoyPairs = 0; _allClMoves = 0;
  _allClProcessing = false; _allClTimerStart = 0;
  if (_allClTimer) { clearInterval(_allClTimer); _allClTimer = null; }
  // Reset etat Echo ALL
  _allEchoSeq = []; _allEchoMyInput = []; _allEchoShowing = false;
  if (_allEchoShowInt) { clearInterval(_allEchoShowInt); _allEchoShowInt = null; }
  // Reset etat Archi ALL
  _allArchiMyTarget = []; _allArchiPerfect = true;
  // Le state initial (classic) a déjà été publié par _memVoteMode
  // → on route directement depuis le gameRow reçu
  var state = gameRow && gameRow.state;
  if (state && state.mode === 'all') _allRouteState(state, gameRow);
}

// ─────────────────────────────────────────────
// ROUTEUR ALL — seul point d'entrée pour tous les updates
// ─────────────────────────────────────────────

function _allRouteState(state, gameRow) {
  var step = state.all_step;
  if (!step) return;

  // Vérifier que le bon écran est visible — si non, forcer un restart du step
  // même si step === _allStep (ex: retour après AFK, reload, ou écran de vote encore visible)
  var screenMap = {classic:'memScreenClassic', echo:'memScreenEcho', archi:'memScreenArchi'};
  var expectedScreen = screenMap[step];
  var screenEl = expectedScreen ? document.getElementById(expectedScreen) : null;
  var screenVisible = screenEl && getComputedStyle(screenEl).display !== 'none';
  var needsRestart = (step !== _allStep) || !screenVisible;

  // Changement de step OU bon écran non visible → lancer/relancer le bon écran
  if (needsRestart) {
    _allStep = step;
    _allResultShown = false; // reset pour eviter blocage inter-steps
    if (step === 'classic') _allStartClassic(state);
    else if (step === 'echo')  _allStartEcho(state);
    else if (step === 'archi') _allStartArchi(state);
    return;
  }

  // Même step ET bon écran déjà visible → appliquer le state
  if (step === 'classic') _allApplyClassicState(state);
  else if (step === 'echo')  _allApplyEchoState(state);
  else if (step === 'archi') _allApplyArchiState(state);
}

// ─────────────────────────────────────────────
// STEP 1 — CLASSIC
// ─────────────────────────────────────────────

function _allStartClassic(state) {
  _allClCards=[]; _allClFlipped=[];
  _allClGirlPairs=0; _allClBoyPairs=0; _allClMoves=0;
  _allClProcessing=false; _allClTimerStart=0;
  if (_allClTimer){clearInterval(_allClTimer);_allClTimer=null;}
  _memShowScreen('memScreenClassic');
  // Injecter profils adversaire
  _memRenderDualProfiles('memClassicMyProfile', 'memClassicOppProfile');
  var mEl=_memEl('memClassicManche'); if(mEl) mEl.textContent='ALL · Classique';
  _allApplyClassicState(state);
}

function _allApplyClassicState(state) {
  if (!state || _allClProcessing) return;
  if (state.turn === _memProfile && _allClFlipped.length > 0) return;

  _allClGirlPairs = state.girl_pairs||0;
  _allClBoyPairs  = state.boy_pairs||0;
  _allClMoves     = state.moves||0;
  if (state.timer_start && !_allClTimerStart) _allClTimerStart = state.timer_start;

  var eMe=_memEl('memClassicScoreMe'), eOth=_memEl('memClassicScoreOther');
  if(eMe) eMe.textContent = _memProfile==='girl'?_allClGirlPairs:_allClBoyPairs;
  if(eOth) eOth.textContent = _memProfile==='girl'?_allClBoyPairs:_allClGirlPairs;

  if (state.winner && !_allResultShown) {
    _allResultShown = true;
    if (_allClTimer){clearInterval(_allClTimer);_allClTimer=null;}
    var _clW=state.winner;
    _allShowStepResult('classic', _clW, function() {
      _allResultShown = false;
      if (_memMp && _allStep==='classic') _memMp.saveState(_allBuildEchoState());
    });
    return;
  }

  var grid=_memEl('memClassicGrid'); if(!grid) return;
  var stCards=state.cards||[];
  if (_allClCards.length !== stCards.length) {
    grid.style.gridTemplateColumns='repeat(4,1fr)';
    grid.innerHTML=''; _allClCards=[];
    stCards.forEach(function(emoji,idx){
      var card=document.createElement('div');
      card.className='mem-card'; card.dataset.emoji=emoji; card.dataset.idx=String(idx);
      card.innerHTML='<div class="mem-card-inner"><div class="mem-card-front"></div><div class="mem-card-back">'+emoji+'</div></div>';
      (function(c){c.addEventListener('click',function(){_allClassicCardClick(c);});})(card);
      grid.appendChild(card); _allClCards.push(card);
    });
  }

  var matched=state.matched||[], flipped=state.flipped||[];
  _allClCards.forEach(function(c,i){
    if(matched.indexOf(i)!==-1){c.classList.add('flipped','matched');c.classList.remove('wrong','blocked');}
    else if(flipped.indexOf(i)!==-1){c.classList.add('flipped');c.classList.remove('matched','wrong','blocked');}
    else{c.classList.remove('flipped','matched','wrong','blocked');}
  });

  var myTurn=state.turn===_memProfile;
  if(myTurn && _allClProcessing) return;
  if(myTurn) _allClFlipped=[];
  _allClCards.forEach(function(c){if(!c.classList.contains('matched'))c.classList.toggle('blocked',!myTurn);});

  var badge=_memEl('memClassicTurnBadge');
  if(badge){badge.textContent=myTurn?'🎯 Ton tour':'⏳ '+_memGetName(_memOther);badge.className='mem-turn-badge'+(myTurn?'':' mem-turn-badge--other');}

  var specRow=_memEl('memClassicSpecialRow');
  if(specRow && state.specials && state.specials.length){
    specRow.style.display='flex';
    var lbl={vue:'👁 Vue',miroir:'🪞 Miroir'};
    var cls={vue:'mem-special-chip--vue',miroir:'mem-special-chip--miroir'};
    specRow.innerHTML=state.specials.map(function(s){return '<div class="mem-special-chip '+(cls[s]||'')+'">'+(lbl[s]||s)+'</div>';}).join('');
  }

  if(!_allClTimer && !state.winner && _allClTimerStart){
    _allClTimer=setInterval(function(){
      var el=_memEl('memClassicTimer');
      if(el) el.textContent=_memFormatTime(Math.floor((Date.now()-_allClTimerStart)/1000));
    },1000);
  }
}

function _allClassicCardClick(card) {
  if(!_memMp||card.classList.contains('flipped')||card.classList.contains('matched')||card.classList.contains('blocked')||_allClProcessing||_allClFlipped.length>=2) return;
  card.classList.add('flipped');
  _allClFlipped.push(card);

  var cur=(_memMp.getGameState?_memMp.getGameState():null)||_memLastState||{};
  var flNow=_allClFlipped.map(function(c){return parseInt(c.dataset.idx);});
  var maNow=_allClCards.filter(function(c){return c.classList.contains('matched');}).map(function(c){return parseInt(c.dataset.idx);});
  _memMp.saveState({phase:'classic',mode:'all',all_step:'classic',
    cards:_allClCards.map(function(c){return c.dataset.emoji;}),
    matched:maNow,flipped:flNow,turn:_memProfile,
    girl_pairs:_allClGirlPairs,boy_pairs:_allClBoyPairs,moves:_allClMoves,
    specials:cur.specials||['vue','miroir'],timer_start:cur.timer_start||_allClTimerStart,winner:null});

  if(_allClFlipped.length!==2) return;
  _allClProcessing=true;
  _allClMoves++;
  _allClCards.forEach(function(c){if(!c.classList.contains('matched'))c.classList.add('blocked');});

  var a=_allClFlipped[0],b=_allClFlipped[1],match=a.dataset.emoji===b.dataset.emoji;
  setTimeout(function(){
    _allClProcessing=false;
    var cur2=(_memMp.getGameState?_memMp.getGameState():null)||_memLastState||{};
    var matched=_allClCards.filter(function(c){return c.classList.contains('matched');}).map(function(c){return parseInt(c.dataset.idx);});
    if(match){
      a.classList.add('matched');b.classList.add('matched');
      matched=matched.concat([parseInt(a.dataset.idx),parseInt(b.dataset.idx)]);
      if(_memProfile==='girl') _allClGirlPairs++; else _allClBoyPairs++;
      var allDone=matched.length===_allClCards.length;
      var winner=allDone?(_allClGirlPairs>_allClBoyPairs?'girl':_allClBoyPairs>_allClGirlPairs?'boy':'draw'):null;
      _allClFlipped=[];
      _allClCards.forEach(function(c){if(!c.classList.contains('matched'))c.classList.remove('blocked');});
      _memMp.saveState({phase:'classic',mode:'all',all_step:'classic',
        cards:_allClCards.map(function(c){return c.dataset.emoji;}),
        matched:matched,flipped:[],turn:_memProfile,
        girl_pairs:_allClGirlPairs,boy_pairs:_allClBoyPairs,moves:_allClMoves,
        specials:cur2.specials||['vue','miroir'],timer_start:cur2.timer_start||_allClTimerStart,winner:winner});
    } else {
      a.classList.add('wrong');b.classList.add('wrong');
      setTimeout(function(){
        a.classList.remove('flipped','wrong');b.classList.remove('flipped','wrong');
        _allClFlipped=[];
        _memMp.saveState({phase:'classic',mode:'all',all_step:'classic',
          cards:_allClCards.map(function(c){return c.dataset.emoji;}),
          matched:matched,flipped:[],turn:_memProfile==='girl'?'boy':'girl',
          girl_pairs:_allClGirlPairs,boy_pairs:_allClBoyPairs,moves:_allClMoves,
          specials:cur2.specials||['vue','miroir'],timer_start:cur2.timer_start||_allClTimerStart,winner:null});
      },700);
    }
  },match?300:0);
}

// ─────────────────────────────────────────────
// STEP 2 — ECHO
// ─────────────────────────────────────────────

function _allStartEcho(state) {
  _allEchoSeq=[]; _allEchoMyInput=[]; _allEchoShowing=false; _allEchoSaved=false; _allEchoPublished=false;
  if(_allEchoShowInt){clearInterval(_allEchoShowInt);_allEchoShowInt=null;}
  _memShowScreen('memScreenEcho');
  // Injecter profils avec 3 coeurs pour ALL
  _memRenderEchoProfiles('memEchoMyProfile', 'memEchoOppProfile', 3);
  var lEl=_memEl('memEchoLevel');if(lEl) lEl.textContent='ALL · Écho';
  var grid=_memEl('memEchoGrid');
  if(grid){grid.innerHTML='';ECHO_EMOJIS.forEach(function(e,i){
    var cell=document.createElement('div');cell.className='mem-echo-cell mem-echo-cell--blocked';cell.textContent=e;
    (function(idx){cell.addEventListener('click',function(){_allEchoTap(idx);});})(i);
    grid.appendChild(cell);
  });}
  _allApplyEchoState(state);
}

function _allApplyEchoState(state) {
  if(!state||state.all_step!=='echo') return;
  var prevSeqLen = _allEchoSeq.length;
  _allEchoSeq = state.sequence||[];
  if(_allEchoSeq.length !== prevSeqLen) _allEchoShowing=false;

  var ml=_memProfile==='girl'?state.girl_lives:state.boy_lives;
  var ol=_memProfile==='girl'?state.boy_lives:state.girl_lives;
  function hearts(n){return['❤️','❤️','❤️'].slice(0,Math.max(0,n)).join('')||'💀';}
  var lMe=_memEl('memEchoLivesMe'),lOth=_memEl('memEchoLivesOther');
  if(lMe) lMe.textContent=hearts(ml); if(lOth) lOth.textContent=hearts(ol);
  var lv=_memEl('memEchoLevel');if(lv) lv.textContent='ALL · Niveau '+state.level;

  var meElim=_memProfile==='girl'?state.girl_eliminated:state.boy_eliminated;
  var othElim=_memProfile==='girl'?state.boy_eliminated:state.girl_eliminated;
  var myInput=_memProfile==='girl'?state.girl_input:state.boy_input;
  _memUpdateEchoPips(_allEchoSeq.length,(myInput||[]).length);

  // winner présent → afficher résultat EN PRIORITÉ (même si ce joueur est éliminé)
  // Doit être vérifié AVANT le check meElim pour ne pas bloquer sur "Tu attends..."
  if(state.winner && !_allEchoSaved){
    _allEchoSaved=true;
    var _echoW=state.winner;
    // Déplacer le popup dans body pour contourner le parent display:none
    var _rEl=_memEl('memClassicMancheResult');
    var _rElParent=_rEl?_rEl.parentElement:null;
    var _rElNext=_rEl?_rEl.nextSibling:null;
    if(_rEl){
      document.body.appendChild(_rEl);
      _rEl.style.position='fixed'; _rEl.style.zIndex='9999';
      _rEl.style.inset='0'; _rEl.style.opacity='1';
    }
    _allShowStepResult('echo', _echoW, function(){
      // Remettre le popup à sa place originale
      if(_rEl && _rElParent){
        _rElParent.insertBefore(_rEl,_rElNext);
        _rEl.style.position=''; _rEl.style.zIndex=''; _rEl.style.inset=''; _rEl.style.opacity='';
      }
      if(_memMp && _allStep==='echo') _memMp.saveState(_allBuildArchiState());
    });
    return;
  }

  // Filet de sécurité 1 : les deux éliminés mais winner jamais publié
  // Utiliser un flag séparé pour ne pas bloquer l'affichage du résultat quand il arrive
  if(meElim && othElim && !state.winner && !_allEchoPublished && _memMp){
    _allEchoPublished=true; // verrouille publication, sans bloquer l'affichage du résultat
    var ns2=JSON.parse(JSON.stringify(state));
    ns2.winner=_memEchoPickWinner(ns2)||'draw';
    _memMp.saveState(ns2);
    return;
  }

  // Filet de sécurité 2 : les deux ont réussi sans élimination mais winner non publié
  var bothSucceeded = (state.girl_input||[]).length === _allEchoSeq.length &&
                      (state.boy_input||[]).length  === _allEchoSeq.length;
  if(bothSucceeded && !state.winner && !_allEchoPublished && _memMp){
    _allEchoPublished=true;
    var ns3=JSON.parse(JSON.stringify(state));
    ns3.winner=_memEchoPickWinner(ns3)||'draw';
    _memMp.saveState(ns3);
    return;
  }

  // Filet de sécurité 3 : je suis survivant, l'adversaire est éliminé, winner non publié
  // Couvre le cas où girl réussit mais son état local n'avait pas encore boy_eliminated=true
  var iAmSurvivor = !meElim && othElim;
  var iFinished = (myInput||[]).length === _allEchoSeq.length;
  if(iAmSurvivor && iFinished && !state.winner && !_allEchoPublished && _memMp){
    _allEchoPublished=true;
    var ns4=JSON.parse(JSON.stringify(state));
    ns4.winner=_memEchoPickWinner(ns4)||'draw';
    _memMp.saveState(ns4);
    return;
  }

  if(meElim){
    var ph=_memEl('memEchoPhase');if(ph)ph.textContent='💀 Tu attends que '+_memGetName(_memOther)+' finisse…';
    document.querySelectorAll('#memEchoGrid .mem-echo-cell').forEach(function(c){c.classList.add('mem-echo-cell--blocked');});
    return;
  }
  // Ne relancer l'animation QUE si :
  // 1. Mon input est vide (nouveau niveau ou après erreur)
  // 2. Je ne suis pas en train de jouer (_allEchoMyInput local est aussi vide)
  // 3. L'animation n'est pas déjà en cours
  // Evite que la fin de l'adversaire (qui remet boy_input=full dans le state)
  // ne déclenche une relance intempestive de l'animation pour ce joueur
  var myLocalInputLen = _allEchoMyInput ? _allEchoMyInput.length : 0;
  var myServerInputLen = (myInput||[]).length;
  var shouldShowSeq = myServerInputLen === 0 && myLocalInputLen === 0 && !_allEchoShowing;
  if(shouldShowSeq){
    _allEchoShowing=true;
    _allEchoMyInput=[];
    _allEchoShowSeq(function(){
      document.querySelectorAll('#memEchoGrid .mem-echo-cell').forEach(function(c){c.classList.remove('mem-echo-cell--blocked');});
      var ph=_memEl('memEchoPhase');if(ph)ph.textContent='🎯 Reproduis !';
    });
  }
}

function _allEchoShowSeq(cb){
  var ph=_memEl('memEchoPhase');if(ph)ph.textContent='👀 Mémorise…';
  document.querySelectorAll('#memEchoGrid .mem-echo-cell').forEach(function(c){c.classList.add('mem-echo-cell--blocked');});
  if(_allEchoShowInt)clearInterval(_allEchoShowInt);
  var idx=0;
  _allEchoShowInt=setInterval(function(){
    var cells=document.querySelectorAll('#memEchoGrid .mem-echo-cell');
    cells.forEach(function(c){c.classList.remove('mem-echo-cell--lit');});
    if(idx<_allEchoSeq.length){
      var cell=cells[_allEchoSeq[idx]];if(cell)cell.classList.add('mem-echo-cell--lit');
      setTimeout(function(){if(cell)cell.classList.remove('mem-echo-cell--lit');},500);
      idx++;
    }else{clearInterval(_allEchoShowInt);_allEchoShowInt=null;if(cb)setTimeout(cb,400);}
  },700);
}

function _allEchoTap(idx){
  if(_allEchoMyInput.length>=_allEchoSeq.length||!_memMp) return;
  var cur=(_memMp.getGameState?_memMp.getGameState():null)||_memLastState;if(!cur)return;
  var ns=JSON.parse(JSON.stringify(cur));
  var exp=_allEchoSeq[_allEchoMyInput.length];
  var cell=document.querySelectorAll('#memEchoGrid .mem-echo-cell')[idx];

  if(idx===exp){
    if(cell){cell.classList.add('mem-echo-cell--correct');setTimeout(function(){cell.classList.remove('mem-echo-cell--correct');},400);}
    _allEchoMyInput.push(idx);
    _memUpdateEchoPips(_allEchoSeq.length,_allEchoMyInput.length);
    ns[_memProfile+'_input']=_allEchoMyInput.slice();
    if(_allEchoMyInput.length===_allEchoSeq.length){
      // Succès — vérifier si les deux ont fini
      ns[_memProfile+'_max_level']=ns.level||5;
      ns[_memProfile+'_finish_time']=Date.now();
      document.querySelectorAll('#memEchoGrid .mem-echo-cell').forEach(function(c){c.classList.add('mem-echo-cell--blocked');});
      var otherDone=(ns[_memOther+'_input']||[]).length===_allEchoSeq.length;
      var otherElim=!!(ns[_memOther+'_eliminated']);
      if(otherDone||otherElim){
        // Les deux ont fini → winner
        ns.winner=_memEchoPickWinner(ns);
      }
    }
  } else {
    if(cell){cell.classList.add('mem-echo-cell--wrong');setTimeout(function(){cell.classList.remove('mem-echo-cell--wrong');},500);}
    _allEchoMyInput=[];_allEchoShowing=false;document.querySelectorAll('#memEchoGrid .mem-echo-cell').forEach(function(c){c.classList.add('mem-echo-cell--blocked');});
    _memUpdateEchoPips(_allEchoSeq.length,0);
    ns[_memProfile+'_input']=[];
    ns[_memProfile+'_lives']=Math.max(0,(ns[_memProfile+'_lives']||2)-1);
    if(ns[_memProfile+'_lives']<=0){
      ns[_memProfile+'_eliminated']=true;
      ns[_memProfile+'_max_level']=ns.level||5;
      ns[_memProfile+'_finish_time']=Date.now();
      if(ns[_memOther+'_eliminated']) ns.winner=_memEchoPickWinner(ns);
    }
  }
  _memMp.saveState(ns);
}

// ─────────────────────────────────────────────
// STEP 3 — ARCHI
// ─────────────────────────────────────────────

function _allStartArchi(state) {
  _allArchiMyTarget=[]; _allArchiSaved=false; _allArchiPerfect=true;
  _memShowScreen('memScreenArchi');
  // Injecter profils adversaire
  _memRenderDualProfiles('memArchiMyProfile', 'memArchiOppProfile');
  var nMe=_memEl('memArchiNameMe'),nOth=_memEl('memArchiNameOther');
  if(nMe)nMe.textContent=_memGetName(_memProfile);
  if(nOth)nOth.textContent=_memGetName(_memOther);
  // Reconstruire la palette avec les listeners ALL
  var p=_memEl('memArchiShapesMe');if(p){p.innerHTML='';
    ARCHI_SHAPES.forEach(function(s,i){
      var d=document.createElement('div');d.className='mem-archi-shape';
      d.style.background=s.color+'33';d.style.borderColor=s.color+'66';d.textContent=s.emoji;
      (function(idx){d.addEventListener('click',function(){_allArchiTap(idx);});})(i);
      p.appendChild(d);
    });
  }
  // Recalculer show_until localement : chaque joueur a ses 4s complètes
  // On stocke dans _allArchiShowUntil pour que les polls suivants respectent aussi ce délai
  _allArchiShowUntil = Date.now() + 4000;
  var localState = JSON.parse(JSON.stringify(state));
  localState.show_until = _allArchiShowUntil;
  _allApplyArchiState(localState);
}

function _allApplyArchiState(state) {
  if(!state||state.all_step!=='archi') return;
  _allArchiMyTarget=(_memProfile==='girl'?state.girl_target:state.boy_target)||[];

  var rEl=_memEl('memArchiRound');if(rEl)rEl.textContent='ALL · Tour unique';

  // Utiliser le max entre le show_until serveur et le show_until local
  // pour garantir 4s d'animation même si les polls reçoivent le state original
  var effectiveShowUntil = Math.max(state.show_until||0, _allArchiShowUntil||0);
  var showing=Date.now()<effectiveShowUntil;
  var targetEl=_memEl('memArchiTarget');
  if(targetEl){
    if(showing){
      targetEl.innerHTML='';
      _allArchiMyTarget.forEach(function(si){
        var s=ARCHI_SHAPES[si],d=document.createElement('div');
        d.className='mem-archi-shape';d.style.background=s.color+'33';d.style.borderColor=s.color+'66';d.textContent=s.emoji;
        targetEl.appendChild(d);
      });
      setTimeout(function(){
        if(targetEl)targetEl.innerHTML='<div style="font-size:13px;color:var(--muted);padding:12px;">🫣 Tour cachée</div>';
        // Mettre à jour uniquement la phase texte sans récursion
        var phEl2=_memEl('memArchiPhase');
        if(phEl2) phEl2.textContent='🏗️ Reconstruit !';
        var pal2=_memEl('memArchiShapesMe');
        var cur2=(_memMp&&_memMp.getGameState?_memMp.getGameState():null)||_memLastState;
        if(pal2) pal2.style.pointerEvents=(cur2&&cur2[_memProfile+'_done'])?'none':'';
      },effectiveShowUntil-Date.now());
    } else {
      targetEl.innerHTML='<div style="display:flex;align-items:center;justify-content:center;gap:6px;padding:14px 8px;font-size:12px;color:#9ca3af;">&#128274; Tour cach&#233;e</div>';
    }
  }

  var phEl=_memEl('memArchiPhase');
  if(phEl)phEl.textContent=showing?'👀 Mémorise ta tour ! ('+Math.ceil((effectiveShowUntil-Date.now())/1000)+'s)':'🏗️ Reconstruit !';

  _memRenderArchiStack(_memEl('memArchiStackMe'),    _memProfile==='girl'?state.girl_stack:state.boy_stack);
  _memRenderArchiStack(_memEl('memArchiStackOther'), _memProfile==='girl'?state.boy_stack:state.girl_stack);

  var pal=_memEl('memArchiShapesMe');
  if(pal)pal.style.pointerEvents=(showing||state[_memProfile+'_done'])?'none':'';

  if(state.winner && !_allArchiSaved){
    _allArchiSaved=true;
    // Déplacer le popup dans body pour contourner le parent display:none
    var _rElA=_memEl('memClassicMancheResult');
    var _rElAParent=_rElA?_rElA.parentElement:null;
    var _rElANext=_rElA?_rElA.nextSibling:null;
    if(_rElA){
      document.body.appendChild(_rElA);
      _rElA.style.position='fixed'; _rElA.style.zIndex='9999';
      _rElA.style.inset='0'; _rElA.style.opacity='1';
    }
    _allShowStepResult('archi', state.winner, function(){
      if(_rElA && _rElAParent){
        _rElAParent.insertBefore(_rElA,_rElANext);
        _rElA.style.position=''; _rElA.style.zIndex=''; _rElA.style.inset=''; _rElA.style.opacity='';
      }
      _allShowFinal();
    });
  }
}

function _allArchiTap(si){
  if(!_memMp)return;
  var cur=(_memMp.getGameState?_memMp.getGameState():null)||_memLastState;if(!cur)return;
  if(Date.now()<Math.max(cur.show_until||0, _allArchiShowUntil||0))return;
  if(cur[_memProfile+'_done'])return;

  var sp=_memProfile+'_stack';
  var ns=JSON.parse(JSON.stringify(cur));
  var myStack=(ns[sp]||[]).concat([si]);
  ns[sp]=myStack;

  var exp=_allArchiMyTarget[myStack.length-1];
  if(si!==exp){
    ns[sp]=[];
    ns[_memProfile+'_errors']=(ns[_memProfile+'_errors']||0)+1;
    _allArchiPerfect=false;
    var sEl=_memEl('memArchiStackMe');
    if(sEl){sEl.classList.add('mem-archi-stack--wrong');setTimeout(function(){sEl.classList.remove('mem-archi-stack--wrong');},400);}
    _memMp.saveState(ns);return;
  }

  if(myStack.length===_allArchiMyTarget.length){
    ns[_memProfile+'_done']=true;
    ns[_memProfile+'_done_time']=Date.now();
    var sEl2=_memEl('memArchiStackMe');
    if(sEl2){sEl2.classList.add('mem-archi-stack--complete');setTimeout(function(){sEl2.classList.remove('mem-archi-stack--complete');},600);}

    if(ns[_memOther+'_done']){
      var myT=ns[_memProfile+'_done_time'],othT=ns[_memOther+'_done_time'];
      var rw=myT<=othT?_memProfile:_memOther;
      ns[rw+'_score']=(ns[rw+'_score']||0)+1;
      var gS=ns.girl_score||0,bS=ns.boy_score||0;
      ns.winner=gS>bS?'girl':bS>gS?'boy':'draw';
    }
  }
  _memMp.saveState(ns);
}

// ─────────────────────────────────────────────
// TRANSITIONS ENTRE STEPS
// ─────────────────────────────────────────────

// Popup de résultat d'une étape — cb appelé quand le joueur confirme (girl publie l'étape suivante)
function _allShowStepResult(step, winner, cb) {
  // Règle simple : n'importe qui clique → publie l'étape suivante via cb.
  // Le 2e cliqueur ne fait rien car l'écran a déjà changé via onStateUpdate.
  var labels={classic:'Classique',echo:'Écho',archi:'Architecte'};
  var iWon=winner===_memProfile, isDraw=winner==='draw';
  _allResults[step]={winner:winner};

  var rEl=_memEl('memClassicMancheResult');if(!rEl){if(cb)cb();return;}
  var eEl=_memEl('memClassicMancheEmoji'),tEl=_memEl('memClassicMancheTitle'),sEl=_memEl('memClassicMancheSub');
  if(eEl)eEl.textContent=isDraw?'🤝':iWon?'🏆':'😢';
  if(tEl)tEl.textContent=isDraw?'Égalité !':iWon?'Tu gagnes le '+labels[step]+' !':_memGetName(_memOther)+' gagne le '+labels[step]+' !';
  // Afficher le score ALL en cours dans le sous-titre
  var myW=0,othW=0;
  ['classic','echo','archi'].forEach(function(k){
    if(_allResults[k]){
      if(_allResults[k].winner===_memProfile) myW++;
      else if(_allResults[k].winner===_memOther) othW++;
    }
  });
  var steps_done=['classic','echo','archi'].filter(function(k){return !!_allResults[k];}).length;
  if(sEl) sEl.textContent=steps_done < 3 ? 'Score ALL : '+myW+' – '+othW+' · '+(3-steps_done)+' étape(s) restante(s)' : '';
  rEl.style.display='flex';

  var nextBtn=_memEl('memClassicNextBtn');if(nextBtn)nextBtn.style.display='none';
  var quitBtn=_memEl('memClassicQuitBtn');
  if(quitBtn){
    quitBtn.textContent= step==='archi' ? 'Voir le résultat final' : 'Étape suivante →';

    var _cbFired = false;
    function _fireCb(){
      if(_cbFired) return;
      _cbFired = true;
      rEl.style.display='none';
      if(cb) cb();
    }

    quitBtn.onclick = _fireCb;

    // Pour les transitions intermédiaires (classic→echo, echo→archi) :
    // déclencher automatiquement après 3s sans attendre le clic
    // → les deux joueurs passent à la même vitesse
    if(step !== 'archi'){
      setTimeout(_fireCb, 3000);
    }
  }
}

// ─────────────────────────────────────────────
// RÉSULTAT FINAL ALL
// ─────────────────────────────────────────────

function _allShowFinal() {
  var myW=0, othW=0;
  ['classic','echo','archi'].forEach(function(k){
    if(_allResults[k]&&_allResults[k].winner===_memProfile) myW++;
    if(_allResults[k]&&_allResults[k].winner===_memOther)   othW++;
  });
  if(myW===3) _memUnlockTrophy('osmose',null);

  // Afficher le résultat final par-dessus tout (sans montrer les cartes du Classique)
  var fEl=_memEl('memClassicFinalResult');if(!fEl)return;
  var fElParent=fEl.parentElement, fElNext=fEl.nextSibling;
  document.body.appendChild(fEl);
  fEl.style.cssText += ';position:fixed!important;z-index:9999!important;inset:0!important;opacity:1!important;display:flex!important;background:var(--bg,#fff)!important;';
  var fw=myW>othW?_memProfile:othW>myW?_memOther:'draw',iWon=fw===_memProfile,isDraw=fw==='draw';
  var eEl=_memEl('memClassicFinalEmoji'),tEl=_memEl('memClassicFinalTitle'),sEl=_memEl('memClassicFinalScore');
  if(eEl)eEl.textContent=isDraw?'🤝':iWon?'🏆':'🎖️';
  if(tEl)tEl.textContent=isDraw?'Égalité !':iWon?'Tu gagnes le ALL ! 🎉':_memGetName(_memOther)+' gagne le ALL !';

  // Détail par étape
  var detailParts=['classic','echo','archi'].map(function(k){
    var r=_allResults[k];if(!r)return k+'?';
    var w=r.winner;var lbl={classic:'🃏',echo:'👂',archi:'🏗️'};
    return lbl[k]+(w===_memProfile?'✅':w==='draw'?'🤝':'❌');
  });
  if(sEl)sEl.textContent=myW+' – '+othW+' · '+detailParts.join('  ');

  if(_memProfile==='girl'){
    var cid=_memGetCoupleId(),dur=Math.round((Date.now()-_memStartedAt)/1000);
    if(cid)['girl','boy'].forEach(function(r){
      // Score ALL = victoires cumulées pondérées + bonus victoire finale
      var wins   = 0;
      ['classic','echo','archi'].forEach(function(k){
        if(_allResults[k]){
          if(_allResults[k].winner===r) wins+=300;
          else if(_allResults[k].winner==='draw') wins+=150;
        }
      });
      var iWin   = fw===r, isDraw = fw==='draw';
      var sc_win = iWin?100:(isDraw?50:0); // bonus victoire globale
      var sc     = Math.min(1000, wins+sc_win);
      // game_id 'memory_all' pour badge distinct dans le classement
      sb2Post('game_scores',{couple_id:cid,game_id:'memory_all',player_role:r,score:sc,moves:0,time_seconds:dur,winner_role:fw,user_id:typeof yamGetUser==='function'?yamGetUser().id:null}).catch(function(){});
    });
  }
  var btn=_memEl('memClassicDoneBtn');
  if(btn)btn.onclick=function(){
    fEl.style.display='none';
    // Remettre fEl à sa place originale avant cleanup
    if(fElParent) fElParent.insertBefore(fEl, fElNext);
    fEl.style.position=''; fEl.style.zIndex=''; fEl.style.inset=''; fEl.style.opacity=''; fEl.style.background='';
    if(_memMp&&typeof _memMp.deleteGame==='function')_memMp.deleteGame();
    _memCleanup();_memShowLb(true);_lbLoad();
  };
  if(typeof window.yamFlameActivity==='function')window.yamFlameActivity('memory_done');
}


// ═══════════════════════════════════════════════════════════

var lbCurrentTab='all',lbCurrentData=[];

function _lbLoad(){
  var list=_memEl('lbList');if(!list)return;
  list.innerHTML='<div class="lb-loading"><span class="spinner"></span></div>';
  var cid=_memGetCoupleId();if(!cid){list.innerHTML='<div class="lb-empty">Session expirée</div>';return;}
  // Charger tous les sous-modes memory
  sb2Fetch('game_scores','couple_id=eq.'+cid+'&game_id=in.(memory_classic,memory_echo,memory_archi,memory_all)&order=score.desc&limit=50')
    .then(function(r){lbCurrentData=Array.isArray(r)?r:[];lbRender(lbCurrentData);})
    .catch(function(){if(list)list.innerHTML='<div class="lb-empty">Aucun score encore 🎮</div>';});
}

function lbRender(rows){
  var list=_memEl('lbList');if(!list)return;
  var top=(lbCurrentTab==='all'?rows:rows.filter(function(r){return r.player_role===lbCurrentTab;})).slice(0,10);
  if(!top.length){list.innerHTML='<div class="lb-empty">Aucun score encore 🎮</div>';return;}
  var icons=['🥇','🥈','🥉'];
  var modeLabel={'memory_classic':'🃏','memory_echo':'🔊','memory_archi':'🏗️','memory_all':'⚡'};
  list.innerHTML=top.map(function(row,i){
    var name=typeof v2GetDisplayName==='function'?v2GetDisplayName(row.player_role):row.player_role;
    var m=Math.floor(parseInt(row.time_seconds||0)/60),s=parseInt(row.time_seconds||0)%60;
    var ts=m?m+'m'+String(s).padStart(2,'0')+'s':s+'s';
    var badge=modeLabel[row.game_id]||'🎴';
    var allBadge=row.game_id==='memory_all'?'<span style="font-size:9px;font-weight:700;background:linear-gradient(135deg,#f97316,#eab308);color:#fff;border-radius:5px;padding:1px 4px;margin-left:3px;">ALL</span>':'';
    return '<div class="lb-row"><div class="lb-rank">'+(icons[i]||(i+1))+'</div><div class="lb-name">'+badge+' '+(typeof escHtml==='function'?escHtml(name):name)+allBadge+'</div><div class="lb-score"><span>'+parseInt(row.score||0)+'pts</span> · '+ts+'</div></div>';
  }).join('');
}


function _memArchiSetup3Cols(){
  var screen=_memEl('memScreenArchi');if(!screen)return;
  var existing=screen.querySelector('.mem-archi-3cols');if(existing)existing.remove();
  var nameMe=_memGetName(_memProfile),nameOth=_memGetName(_memOther);
  var isGirl=(_memProfile==='girl'),oppIsGirl=(_memOther==='girl');
  var wrap=document.createElement('div');wrap.className='mem-archi-3cols';
  wrap.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;';
  function makeCol(label,labelColor,borderColor,stackId,shapesId){
    var col=document.createElement('div');
    col.style.cssText='display:flex;flex-direction:column;align-items:center;gap:6px;background:#fff;border:1.5px solid '+borderColor+';border-radius:14px;padding:10px 6px;';
    col.innerHTML='<div style="font-size:9px;font-weight:700;color:'+labelColor+';text-transform:uppercase;letter-spacing:1px;">'+label+'</div>';
    var stack=document.createElement('div');stack.style.cssText='display:flex;flex-direction:column;gap:6px;align-items:center;min-height:100px;width:100%;';
    if(stackId)stack.id=stackId;
    col.appendChild(stack);
    if(shapesId){var sh=document.createElement('div');sh.id=shapesId;sh.style.cssText='display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-top:4px;';col.appendChild(sh);}
    return col;
  }
  var colMe=makeCol(nameMe.toUpperCase(),isGirl?'#ec4899':'#7c3aed',isGirl?'#fce7f3':'#ede9fe','memArchiStackMe',null);
  var colMod=makeCol('MOD\u00c8LE','#9ca3af','#e5e7eb',null,null);
  var tgt=document.createElement('div');tgt.id='memArchiTarget';tgt.style.cssText='display:flex;flex-direction:column;gap:6px;align-items:center;min-height:100px;width:100%;';
  colMod.appendChild(tgt);
  var colOpp=makeCol(nameOth.toUpperCase(),oppIsGirl?'#ec4899':'#7c3aed',oppIsGirl?'#fce7f3':'#ede9fe','memArchiStackOther',null);
  wrap.appendChild(colMe);wrap.appendChild(colMod);wrap.appendChild(colOpp);
  var oldTW=screen.querySelector('.mem-archi-target-wrap');if(oldTW)oldTW.style.display='none';
  var oldBld=screen.querySelector('.mem-archi-builders');if(oldBld)oldBld.style.display='none';
  var phase=_memEl('memArchiPhase');
  if(phase&&phase.nextSibling){screen.insertBefore(wrap,phase.nextSibling);}else{screen.appendChild(wrap);}
  // Palette sous les 3 colonnes
  var paletteWrap=document.createElement('div');
  paletteWrap.style.cssText='background:#fff;border:1px solid #f3f4f6;border-radius:14px;padding:10px 12px;margin-top:0;';
  paletteWrap.innerHTML='<div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;text-align:center;margin-bottom:8px;">PALETTE</div>';
  var shapesDiv=document.createElement('div');shapesDiv.id='memArchiShapesMe';shapesDiv.style.cssText='display:flex;flex-wrap:wrap;gap:8px;justify-content:center;';
  paletteWrap.appendChild(shapesDiv);
  wrap.parentNode.insertBefore(paletteWrap,wrap.nextSibling);
}

function _memEchoEnsureSeqBar(){
  if(_memEl('memEchoSeqBarWrap'))return;
  var phase=_memEl('memEchoPhase');if(!phase)return;
  var bar=document.createElement('div');bar.id='memEchoSeqBarWrap';
  bar.style.cssText='background:#fff;border:1px solid #f3f4f6;border-radius:14px;padding:8px 12px;margin-bottom:4px;';
  var prog=_memEl('memEchoProgress');
  var _livesMe=_memEl('memEchoLivesMe'),_livesOth=_memEl('memEchoLivesOther');
  bar.style.cssText='background:#fff;border:1px solid #f3f4f6;border-radius:14px;padding:8px 12px;margin-bottom:4px;display:flex;align-items:center;gap:8px;';
  if(_livesMe){_livesMe.style.cssText='font-size:16px;letter-spacing:2px;flex-shrink:0;';bar.appendChild(_livesMe);}
  var _center=document.createElement('div');_center.style.cssText='flex:1;text-align:center;';
  _center.innerHTML='<div style="font-size:10px;font-weight:500;color:#f9a8d4;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">S\u00c9QUENCE</div>';
  if(prog){_center.appendChild(prog);}
  bar.appendChild(_center);
  if(_livesOth){_livesOth.style.cssText='font-size:16px;letter-spacing:2px;flex-shrink:0;';bar.appendChild(_livesOth);}
  phase.parentNode.insertBefore(bar,phase);
}

document.addEventListener('DOMContentLoaded',function(){
  var tAll=_memEl('lbTabAll'),tGirl=_memEl('lbTabGirl'),tBoy=_memEl('lbTabBoy');
  if(tAll)  tAll.addEventListener('click',  function(){lbCurrentTab='all'; lbRender(lbCurrentData);});
  if(tGirl) tGirl.addEventListener('click', function(){lbCurrentTab='girl';lbRender(lbCurrentData);});
  if(tBoy)  tBoy.addEventListener('click',  function(){lbCurrentTab='boy'; lbRender(lbCurrentData);});

  // ── Injection des conteneurs de profil joueurs dans chaque écran ──
  // Crée les divs si absents du HTML — insère en haut de chaque screen
  _memEnsureProfileBar('memScreenClassic', 'memClassicMyProfile', 'memClassicOppProfile', 'mem-profile-bar--classic');
  _memEnsureProfileBar('memScreenEcho',    'memEchoMyProfile',    'memEchoOppProfile',    'mem-profile-bar--echo');
  _memEnsureProfileBar('memScreenArchi',   'memArchiMyProfile',   'memArchiOppProfile',   'mem-profile-bar--archi');

  // ── Styles CSS dynamiques pour les barres de profil ──
  var style=document.createElement('style');
  style.textContent=
    '.mem-profile-bar{display:flex;justify-content:space-between;align-items:center;background:#fff;border-bottom:1px solid #f3f4f6;padding:12px 20px 14px;gap:8px;flex-shrink:0;}'+
    '.mem-turn-badge{font-size:12px!important;font-weight:500!important;padding:5px 14px!important;border-radius:99px!important;background:#fce7f3!important;border:1.5px solid #f9a8d4!important;color:#be185d!important;box-shadow:none!important;letter-spacing:0!important;animation:memPulse 1.8s ease infinite!important;}'+
    '.mem-turn-badge--other{background:#ede9fe!important;border-color:#c4b5fd!important;color:#7c3aed!important;animation:none!important;}'+
    '@keyframes memPulse{0%{box-shadow:0 0 0 0 rgba(236,72,153,.4)}70%{box-shadow:0 0 0 8px rgba(236,72,153,0)}100%{box-shadow:0 0 0 0 rgba(236,72,153,0)}}'+
    '.mem-game-timer{font-size:13px!important;font-weight:500!important;color:#111827!important;background:#f9fafb!important;border:1px solid #f3f4f6!important;border-radius:99px!important;padding:4px 10px!important;}'+
    '.mem-echo-cell{border-radius:16px!important;background:#fff!important;border:1.5px solid #fce7f3!important;box-shadow:0 2px 8px rgba(0,0,0,.04)!important;}'+
    '.mem-echo-cell--lit{border-color:#ec4899!important;background:#fdf2f8!important;}'+
    '.mem-echo-cell--correct{border-color:#22c55e!important;background:#f0fdf4!important;}'+
    '.mem-echo-cell--wrong{border-color:#ef4444!important;background:#fff1f2!important;}'+
    '.mem-echo-cell--blocked{opacity:.6!important;pointer-events:none!important;}'+
    '.mem-echo-phase{font-size:13px!important;font-weight:600!important;color:#db2777!important;text-align:center;padding:4px 0 8px!important;}'+
    '.mem-manche-badge{font-size:11px!important;font-weight:500!important;color:#be185d!important;background:#fce7f3!important;border:1.5px solid #f9a8d4!important;border-radius:99px!important;padding:4px 12px!important;}'+
    '.mem-gscore--me{color:#ec4899!important;}.mem-gscore--other{color:#7c3aed!important;}'+
    '.mem-gscore{font-size:32px!important;font-weight:600!important;line-height:1!important;}'+
    '.mem-game-header{background:#fff!important;border:1px solid #f3f4f6!important;border-radius:16px!important;padding:12px 16px!important;margin-bottom:10px!important;}'+
    '#memScreenClassic,#memScreenEcho,#memScreenArchi,#memScreenMode,#memScreenLobby{background:#f5f5f7!important;}'+
    '.mem-card-back{background:#fff!important;border:1.5px solid #fce7f3!important;}'+
    '.mem-card.matched .mem-card-back{background:#fdf2f8!important;border-color:#ec4899!important;}'+
    '.mem-card.wrong .mem-card-back{background:#fff1f2!important;border-color:#ef4444!important;}'+
    '.mem-echo-hearts{font-size:16px!important;letter-spacing:2px!important;}'+
    '.mem-mode-card--selected{border-color:#ec4899!important;background:#fce7f3!important;}'+
    '.mem-mode-card--matched{border-color:#22c55e!important;background:#f0fdf4!important;}'+
    '.mem-vote-chip--active{background:#fce7f3!important;border-color:#f9a8d4!important;color:#be185d!important;}'+
    '.mem-lobby-player:first-child .mem-lobby-avatar{background:#fce7f3!important;border-color:#f9a8d4!important;}'+
    '.mem-lobby-player:last-child .mem-lobby-avatar{background:#ede9fe!important;border-color:#c4b5fd!important;}'+
    '.mem-mode-player:first-child .mem-mode-avatar{background:#fce7f3!important;border-color:#f9a8d4!important;}'+
    '.mem-mode-player:last-child .mem-mode-avatar{background:#ede9fe!important;border-color:#c4b5fd!important;}'+
    '.mem-opp-name{display:none!important;}'+
    '.mem-echo-lives{display:flex!important;align-items:center!important;gap:8px!important;}';
  document.head.appendChild(style);
});

// Crée la barre de profil dans un écran si les conteneurs n'existent pas déjà
function _memEnsureProfileBar(screenId, meId, oppId, extraClass) {
  if(_memEl(meId)&&_memEl(oppId))return;
  var screen=_memEl(screenId);if(!screen)return;
  var bar=document.createElement('div');
  bar.className='mem-profile-bar '+(extraClass||'');
  var isEcho=(extraClass||'').indexOf('echo')!==-1,center;
  if(isEcho){
    center='<div style="display:flex;flex-direction:column;align-items:center;gap:4px;"><div id="memEchoLevel" style="background:#fff;border:1.5px solid #fbcfe8;border-radius:99px;padding:4px 14px;font-size:12px;color:#db2777;font-weight:500;">Niveau 1</div><span style="font-size:11px;color:#f9a8d4;font-weight:500;">VS</span></div>';
  } else {
    var sid=screenId,sMeId=sid==='memScreenClassic'?'memClassicScoreMe':'memArchiScoreMe',sOthId=sid==='memScreenClassic'?'memClassicScoreOther':'memArchiScoreOther',mId=sid==='memScreenClassic'?'memClassicManche':'memArchiRound';
    center='<div style="display:flex;flex-direction:column;align-items:center;gap:4px;"><div style="display:flex;align-items:center;gap:10px;"><span id="'+sMeId+'" style="font-size:32px;font-weight:600;color:#ec4899;line-height:1;">0</span><span style="font-size:14px;color:#e5e7eb;">&ndash;</span><span id="'+sOthId+'" style="font-size:32px;font-weight:600;color:#7c3aed;line-height:1;">0</span></div><span id="'+mId+'" style="font-size:11px;font-weight:500;color:#f9a8d4;">Manche 1/3</span></div>';
  }
  bar.innerHTML='<div id="'+meId+'"></div>'+center+'<div id="'+oppId+'"></div>';
  screen.insertBefore(bar,screen.firstChild);
}

// ── Expose globaux ──
window.openMemoryGame  = openMemoryGame;
window.closeMemoryGame = closeMemoryGame;
window._memOpenGame    = openMemoryGame;
window._memCloseGame   = closeMemoryGame;
window._memRouteState  = _memRouteState;
