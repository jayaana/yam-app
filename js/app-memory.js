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

// ── État Classique+ ──
var _clCards       = [], _clFlipped = [], _clManche = 1;
var _clGirlPairs   = 0, _clBoyPairs = 0, _clMoves = 0, _clTotalMoves = 0;
var _clTimer       = null, _clSeconds = 0, _clManche3Secs = 0;
var _clProcessing  = false, _clResultShown = false, _clSaved = false;

// ── État Écho ──
var _echoSequence  = [], _echoLevel = 1, _echoMyInput = [];
var _echoShowInt   = null, _echoSaved = false, _echoShowing = false;

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
  _memLoadTrophies(function() { _memStartLobby(); });
}

function closeMemoryGame() {
  _memCleanup();
  _yamSlide(document.getElementById('gamesView'), document.getElementById('memoryView'), 'backward');
}

// Note : memoryBackBtn est géré par app-inline.js

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
  if (cancelBtn) cancelBtn.onclick = function() { _memCleanup(); _memShowLb(true); _lbLoad(); };

  _memMp = YAMMultiplayer.init({
    gameTable:        MEM_GAME_TABLE,
    presenceTable:    MEM_PRESENCE_TABLE,
    deleteOnLeave:    true,
    staleGameMinutes: 2,

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
      var dot  = _memEl('memClassicOppDot');
      var name = _memEl('memClassicOppName');
      if (dot) {
        dot.style.background   = isOnline ? '#22c55e' : '#666';
        dot.style.boxShadow    = isOnline ? '0 0 6px rgba(34,197,94,0.8)' : 'none';
        dot.style.width        = '8px';
        dot.style.height       = '8px';
        dot.style.borderRadius = '50%';
        dot.style.display      = 'inline-block';
      }
      if (name) name.textContent = _memGetName(_memOther);
    },

    onMatchFound: function(gameRow) {
      _memStartedAt = Date.now();
      _memLastState = gameRow.state;
      setTimeout(function() { _memGoToModeSelect(gameRow); }, 400);
    },

    onStateUpdate: function(gameRow) {
      if (!gameRow || !gameRow.state) return;
      _memLastState = gameRow.state;
      _memRouteState(gameRow.state, gameRow);
    },

    onAbandon: function() { _memCleanup(); _memShowLb(true); _lbLoad(); },
    onReconnectTimeout: function() { _memCleanup(); },
    onLeave: function() { _memCleanup(); },
    onOpponentOffline: function(oppName) {
      if (!_memMp) return;
      _memMp.showChoice('😔', oppName+' est déconnecté(e)', 'Attends ou quitte.',
        'Attendre', function(){_memMp.startReconnectWait();}, 'Quitter', closeMemoryGame);
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

function _memVoteMode(mode) {
  ['classic','echo','archi','all'].forEach(function(m) {
    var c = _memEl('memModeCard' + m.charAt(0).toUpperCase() + m.slice(1));
    if (c) c.classList.toggle('mem-mode-card--selected', m === mode);
  });
  var hint = _memEl('memModeHint');
  if (hint) hint.textContent = 'Vote envoyé — en attente de '+_memGetName(_memOther)+'…';

  // Toujours partir du dernier état connu pour ne pas écraser le vote de l'autre
  var ns = JSON.parse(JSON.stringify(_memLastState || {phase:'mode_select'}));
  ns[_memProfile + '_vote'] = mode;

  if (ns[_memOther + '_vote'] === mode) {
    ns.phase = 'launching'; ns.mode = mode;
    var cap  = mode.charAt(0).toUpperCase() + mode.slice(1);
    var card = _memEl('memModeCard' + cap);
    if (card) card.classList.add('mem-mode-card--matched');
    if (hint) hint.textContent = '✅ Accord ! Lancement…';
  }
  if (_memMp) _memMp.saveState(ns);
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
  var ph = state.phase, mo = state.mode;
  if (ph === 'mode_select')                                    { _memUpdateVotes(state); }
  else if (ph === 'launching')                                 { _memLaunchMode(state.mode, gameRow || {state:state}); }
  else if (mo === 'classic' || ph === 'classic')               { _memApplyClassicState(state); }
  else if (mo === 'echo'    || ph === 'echo')                  { _memApplyEchoState(state); }
  else if (mo === 'archi'   || ph === 'archi')                 { _memApplyArchiState(state); }
}

// ═══════════════════════════════════════════════════════════
// LANCEMENT
// ═══════════════════════════════════════════════════════════

function _memLaunchMode(mode, gameRow) {
  if (_memCurrentMode === mode && mode !== null) return; // anti-double
  _memCurrentMode = mode;
  if (mode === 'all') {
    _memAllQueue = ['classic','echo','archi']; _memAllResults = {};
    _memLaunchNextAll(gameRow);
  } else {
    _memLaunchSingle(mode, gameRow);
  }
}

function _memLaunchNextAll(gameRow) {
  if (!_memAllQueue.length) { _memShowAllResults(); return; }
  var m = _memAllQueue.shift();
  _memLaunchSingle(m, gameRow);
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
  _clProcessing=false; _clResultShown=false; _clSaved=false; _clSeconds=0; _clManche3Secs=0;
  if (_clTimer) { clearInterval(_clTimer); _clTimer=null; }
  _clCards=[]; _clFlipped=[];
  _memShowScreen('memScreenClassic');
  _memUpdateClassicHeader();
  if (_memProfile === 'girl' && _memMp && (!gameRow || !gameRow.state || gameRow.state.phase !== 'classic')) {
    _memMp.saveState(_memBuildClassicState(1));
  } else if (gameRow && gameRow.state) {
    _memApplyClassicState(gameRow.state);
  }
}

function _memBuildClassicState(manche) {
  var cfg  = _CLASSIC_CFGS[manche-1];
  var pool = MEMORY_EMOJIS.slice(0,cfg.pairs).concat(MEMORY_EMOJIS.slice(0,cfg.pairs));
  for (var i=pool.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=pool[i];pool[i]=pool[j];pool[j]=t;}
  return {phase:'classic',mode:'classic',manche:manche,cards:pool,matched:[],flipped:[],
    girl_pairs:0,boy_pairs:0,turn:'girl',moves:0,winner:null,
    specials:cfg.specials,timer_start:Date.now(),elapsed:0};
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
  _clGirlPairs = state.girl_pairs||0; _clBoyPairs = state.boy_pairs||0;
  _clManche    = state.manche||1;     _clMoves    = state.moves||0;
  _memUpdateClassicHeader();

  if (state.winner && !_clResultShown) {
    _clResultShown = true;
    if (_clTimer) { clearInterval(_clTimer); _clTimer=null; }
    _memShowClassicMancheResult(state); return;
  }

  var grid = _memEl('memClassicGrid'); if (!grid) return;
  if (_clCards.length !== (state.cards||[]).length) {
    var mcfg = _CLASSIC_CFGS[Math.min(_clManche-1, _CLASSIC_CFGS.length-1)];
    grid.style.width = '100%';
    grid.style.gridTemplateColumns = 'repeat('+mcfg.cols+', 1fr)';
    grid.innerHTML=''; _clCards=[];
    (state.cards||[]).forEach(function(emoji,idx) {
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
  if (myTurn) _clFlipped=[];
  _memSetClassicBlocked(!myTurn);

  var badge=_memEl('memClassicTurnBadge');
  if (badge){badge.textContent=myTurn?'🎯 Ton tour':'⏳ '+_memGetName(_memOther);badge.className='mem-turn-badge'+(myTurn?'':' mem-turn-badge--other');}

  var specRow=_memEl('memClassicSpecialRow');
  if (specRow&&state.specials&&state.specials.length){
    specRow.style.display='flex';
    var lbl={vue:'👁 Vue',miroir:'🪞 Miroir',bombe:'💣 Bombe'}, cls={vue:'mem-special-chip--vue',miroir:'mem-special-chip--miroir',bombe:'mem-special-chip--bombe'};
    specRow.innerHTML=state.specials.map(function(s){return '<div class="mem-special-chip '+(cls[s]||'')+'">'+(lbl[s]||s)+'</div>';}).join('');
  }

  // Timer manche 3
  if (_clManche===3 && !_clTimer && !state.winner) {
    _clSeconds=state.elapsed||0;
    _clTimer=setInterval(function(){
      _clSeconds++; _clManche3Secs=_clSeconds;
      var rem=Math.max(0,90-_clSeconds);
      var el=_memEl('memClassicTimer');
      if (el){el.textContent=rem+'s';el.className='mem-game-timer'+(rem<=15?' mem-game-timer--urgent':'');}
      if (rem===0&&!_clResultShown&&_memMp){
        clearInterval(_clTimer);_clTimer=null;
        var ns=_memBuildWinnerState(state);
        _memMp.saveState(ns);
      }
    },1000);
  }
}

function _memBuildWinnerState(state) {
  var matched=_clCards.filter(function(c){return c.classList.contains('matched');}).map(function(c){return parseInt(c.dataset.idx);});
  return {phase:'classic',mode:'classic',manche:_clManche,
    cards:_clCards.map(function(c){return c.dataset.emoji;}),matched:matched,flipped:[],
    girl_pairs:_clGirlPairs,boy_pairs:_clBoyPairs,moves:_clMoves,
    specials:state.specials||[],timer_start:state.timer_start||0,elapsed:_clSeconds,
    winner:_clGirlPairs>=_clBoyPairs?'girl':'boy'};
}

function _memSetClassicBlocked(blocked) {
  _clCards.forEach(function(c){if(!c.classList.contains('matched'))c.classList.toggle('blocked',blocked);});
}

function _memClassicCardClick(card) {
  if (!_memMp||card.classList.contains('flipped')||card.classList.contains('matched')||card.classList.contains('blocked')||_clProcessing||_clFlipped.length>=2) return;
  card.classList.add('flipped'); _clFlipped.push(card);
  if (_clFlipped.length!==2) return;
  _clProcessing=true; _clMoves++; _clTotalMoves++;
  var a=_clFlipped[0],b=_clFlipped[1],match=a.dataset.emoji===b.dataset.emoji;
  setTimeout(function(){
    var matched=_clCards.filter(function(c){return c.classList.contains('matched');}).map(function(c){return parseInt(c.dataset.idx);});
    var cur=_memMp.getGameState?_memMp.getGameState():{}; if(!cur)cur={};
    if (match){
      a.classList.add('matched');b.classList.add('matched');
      matched=matched.concat([parseInt(a.dataset.idx),parseInt(b.dataset.idx)]);
      if (_memProfile==='girl')_clGirlPairs++;else _clBoyPairs++;
      var allDone=matched.length===_clCards.length;
      var winner=allDone?(_clGirlPairs>_clBoyPairs?'girl':_clBoyPairs>_clGirlPairs?'boy':'draw'):null;
      var ns={phase:'classic',mode:'classic',manche:_clManche,cards:_clCards.map(function(c){return c.dataset.emoji;}),
        matched:matched,flipped:[],turn:_memProfile,girl_pairs:_clGirlPairs,boy_pairs:_clBoyPairs,moves:_clMoves,
        specials:(cur.specials||[]),timer_start:(cur.timer_start||0),elapsed:_clSeconds,winner:winner};
      _clFlipped=[];_clProcessing=false;_memMp.saveState(ns);
    } else {
      a.classList.add('wrong');b.classList.add('wrong');
      setTimeout(function(){
        a.classList.remove('flipped','wrong');b.classList.remove('flipped','wrong');
        _clFlipped=[];_clProcessing=false;
        var ns2={phase:'classic',mode:'classic',manche:_clManche,cards:_clCards.map(function(c){return c.dataset.emoji;}),
          matched:matched,flipped:[],turn:_memProfile==='girl'?'boy':'girl',girl_pairs:_clGirlPairs,boy_pairs:_clBoyPairs,
          moves:_clMoves,specials:(cur.specials||[]),timer_start:(cur.timer_start||0),elapsed:_clSeconds,winner:null};
        _memMp.saveState(ns2);
      },700);
    }
    _memUpdateClassicScores();
  }, match?300:0);
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
      rEl.style.display='none'; _clManche++; _clResultShown=false; _clCards=[]; _clFlipped=[]; _clMoves=0;
      if (_clTimer){clearInterval(_clTimer);_clTimer=null;}
      if (_memProfile==='girl'&&_memMp) _memMp.saveState(_memBuildClassicState(_clManche));
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
  if (sEl) sEl.textContent=(_memProfile==='girl'?gW:bW)+' paires · '+_clTotalMoves+' coups total';
  if (iWon&&_clManche3Secs>0&&_clManche3Secs<60) _memUnlockTrophy('eclair','memClassicTrophyUnlock');
  if (iWon&&_clTotalMoves<20) _memUnlockTrophy('precision','memClassicTrophyUnlock');
  if (_memProfile==='girl') {
    var cid=_memGetCoupleId(),dur=Math.round((Date.now()-_memStartedAt)/1000);
    if (cid) ['girl','boy'].forEach(function(r){
      var sc=Math.round(((r==='girl'?gW:bW)/Math.max(1,gW+bW))*1000);
      sb2Post('game_scores',{couple_id:cid,game_id:'memory',player_role:r,score:sc,moves:_clTotalMoves,time_seconds:dur,winner_role:fw,user_id:typeof yamGetUser==='function'?yamGetUser().id:null}).catch(function(){});
    });
  }
  var doneBtn=_memEl('memClassicDoneBtn');
  if (doneBtn) doneBtn.onclick=function(){
    fEl.style.display='none';
    if (_memCurrentMode==='all'&&_memAllQueue.length>0){_memAllResults.classic={winner:fw};_memLaunchNextAll(null);}
    else if (_memCurrentMode==='all'){_memAllResults.classic={winner:fw};_memShowAllResults();}
    else{_memCleanup();_memShowLb(true);_lbLoad();}
  };
  if (typeof window.yamFlameActivity==='function') window.yamFlameActivity('memory_done');
}

// ═══════════════════════════════════════════════════════════
// ÉCHO
// ═══════════════════════════════════════════════════════════

function _memStartEcho(gameRow) {
  _echoLevel=1; _echoSaved=false; _echoSequence=[]; _echoMyInput=[]; _echoShowing=false;
  _memShowScreen('memScreenEcho');
  var lEl=_memEl('memEchoLevel'); if (lEl) lEl.textContent='Niveau 1';
  var lMe=_memEl('memEchoLivesMe'),lOth=_memEl('memEchoLivesOther');
  if (lMe) lMe.textContent='❤️❤️❤️'; if (lOth) lOth.textContent='❤️❤️❤️';
  var grid=_memEl('memEchoGrid');
  if (grid){grid.innerHTML='';ECHO_EMOJIS.forEach(function(e,i){
    var cell=document.createElement('div');cell.className='mem-echo-cell mem-echo-cell--blocked';cell.textContent=e;
    (function(idx){cell.addEventListener('click',function(){_memEchoTap(idx);});})(i);
    grid.appendChild(cell);
  });}
  if (_memProfile==='girl'&&_memMp) _memMp.saveState(_memBuildEchoState(1,[3,3]));
  else if (gameRow&&gameRow.state) _memApplyEchoState(gameRow.state);
}

function _memBuildEchoState(level,lives) {
  var seq=[]; for (var i=0;i<level+2;i++) seq.push(Math.floor(Math.random()*8));
  return {phase:'echo',mode:'echo',manche:1,sequence:seq,level:level,
    girl_lives:lives[0],boy_lives:lives[1],girl_input:[],boy_input:[],winner:null};
}

function _memApplyEchoState(state) {
  if (!state||state.phase!=='echo') return;
  var prevLevel = _echoLevel;
  _echoSequence=state.sequence||[]; _echoLevel=state.level||1;
  if (_echoLevel !== prevLevel) _echoShowing = false;
  var ml=_memProfile==='girl'?state.girl_lives:state.boy_lives;
  var ol=_memProfile==='girl'?state.boy_lives:state.girl_lives;
  function hearts(n){return['❤️','❤️','❤️'].slice(0,Math.max(0,n)).join('')||'💀';}
  var lMe=_memEl('memEchoLivesMe'),lOth=_memEl('memEchoLivesOther');
  if (lMe) lMe.textContent=hearts(ml); if (lOth) lOth.textContent=hearts(ol);
  var lv=_memEl('memEchoLevel'); if (lv) lv.textContent='Niveau '+_echoLevel;
  if (state.winner&&!_echoSaved){_memShowEchoResult(state);return;}
  var myInput=_memProfile==='girl'?state.girl_input:state.boy_input;
  _memUpdateEchoPips(_echoSequence.length,(myInput||[]).length);
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
    _echoMyInput=[];_memUpdateEchoPips(_echoSequence.length,0);_memSaveEchoInput(false);
  }
}

function _memSaveEchoInput(success) {
  if (!_memMp) return;
  var cur=_memMp.getGameState?_memMp.getGameState():null; if(!cur) return;
  var ns=JSON.parse(JSON.stringify(cur));
  ns[_memProfile+'_input']=success?_echoMyInput.slice():[];
  if (!success) ns[_memProfile+'_lives']=Math.max(0,(ns[_memProfile+'_lives']||3)-1);
  var otherDone=(ns[_memOther+'_input']||[]).length===_echoSequence.length;
  if (success&&otherDone){
    var lv=_echoLevel+1;
    if (lv>8)  _memUnlockTrophy('telepathie','memEchoTrophyUnlock');
    if (lv>10) _memUnlockTrophy('inextinguible','memEchoTrophyUnlock');
    _echoShowing = false;
    ns=_memBuildEchoState(lv,[ns.girl_lives,ns.boy_lives]);
  }
  if ((ns.girl_lives||0)<=0||(ns.boy_lives||0)<=0){
    var gl=ns.girl_lives||0,bl=ns.boy_lives||0;
    ns.winner=gl>bl?'girl':bl>gl?'boy':'draw';
  }
  _memMp.saveState(ns);
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
  if(sEl)sEl.textContent='Niveau atteint : '+_echoLevel;
  if(_memProfile==='girl'){var cid=_memGetCoupleId(),dur=Math.round((Date.now()-_memStartedAt)/1000);if(cid)['girl','boy'].forEach(function(r){sb2Post('game_scores',{couple_id:cid,game_id:'memory',player_role:r,score:_echoLevel*100,moves:0,time_seconds:dur,winner_role:state.winner,user_id:typeof yamGetUser==='function'?yamGetUser().id:null}).catch(function(){});});}
  var btn=_memEl('memEchoDoneBtn');if(btn)btn.onclick=function(){
    fEl.style.display='none';
    if(_memCurrentMode==='all'&&_memAllQueue.length>0){_memAllResults.echo={winner:state.winner};_memLaunchNextAll(null);}
    else if(_memCurrentMode==='all'){_memAllResults.echo={winner:state.winner};_memShowAllResults();}
    else{_memCleanup();_memShowLb(true);_lbLoad();}
  };
  if(typeof window.yamFlameActivity==='function')window.yamFlameActivity('memory_done');
}

// ═══════════════════════════════════════════════════════════
// ARCHITECTE
// ═══════════════════════════════════════════════════════════

function _memStartArchi(gameRow) {
  _archiRound=1;_archiTarget=[];_archiPerfect=true;_archiSaved=false;
  _memShowScreen('memScreenArchi');
  var nMe=_memEl('memArchiNameMe'),nOth=_memEl('memArchiNameOther');
  if(nMe)nMe.textContent=_memGetName(_memProfile);if(nOth)nOth.textContent=_memGetName(_memOther);
  _memBuildArchiPalette();
  if(_memProfile==='girl'&&_memMp)_memMp.saveState(_memBuildArchiState(1));
  else if(gameRow&&gameRow.state)_memApplyArchiState(gameRow.state);
}

function _memBuildArchiState(round) {
  var len=3+round,target=[];
  for(var i=0;i<len;i++)target.push(Math.floor(Math.random()*ARCHI_SHAPES.length));
  return{phase:'archi',mode:'archi',manche:round,target:target,girl_stack:[],boy_stack:[],
    girl_score:0,boy_score:0,girl_done:false,boy_done:false,winner:null,show_until:Date.now()+3500};
}

function _memBuildArchiPalette() {
  var p=_memEl('memArchiShapesMe');if(!p)return;p.innerHTML='';
  ARCHI_SHAPES.forEach(function(s,i){
    var d=document.createElement('div');d.className='mem-archi-shape';
    d.style.background=s.color+'33';d.style.borderColor=s.color+'66';d.textContent=s.emoji;
    (function(idx){d.addEventListener('click',function(){_memArchiTap(idx);});})(i);
    p.appendChild(d);
  });
}

function _memApplyArchiState(state) {
  if(!state||state.phase!=='archi')return;
  _archiTarget=state.target||[];_archiRound=state.manche||1;
  var rEl=_memEl('memArchiRound');if(rEl)rEl.textContent='Structure '+_archiRound+'/3';
  var targetEl=_memEl('memArchiTarget');
  if(targetEl){
    var showing=Date.now()<(state.show_until||0);
    if(showing){
      targetEl.innerHTML='';
      _archiTarget.forEach(function(si){var s=ARCHI_SHAPES[si],d=document.createElement('div');d.className='mem-archi-shape';d.style.background=s.color+'33';d.style.borderColor=s.color+'66';d.textContent=s.emoji;targetEl.appendChild(d);});
      var rem=state.show_until-Date.now();
      setTimeout(function(){
        if(targetEl)targetEl.innerHTML='<div style="font-size:13px;color:var(--muted);padding:12px;">🫣 Modèle caché</div>';
        var cur=(_memMp&&_memMp.getGameState?_memMp.getGameState():null)||_memLastState;
        if(cur)_memApplyArchiState(cur);
      },rem);
    } else {
      targetEl.innerHTML='<div style="font-size:13px;color:var(--muted);padding:12px;">🫣 Modèle caché</div>';
    }
  }
  var phEl=_memEl('memArchiPhase'),showing2=Date.now()<(state.show_until||0);
  if(phEl)phEl.textContent=showing2?'👀 Mémorise ! ('+Math.ceil(((state.show_until||0)-Date.now())/1000)+'s)':'🏗️ Reconstruit !';
  _memRenderArchiStack(_memEl('memArchiStackMe'),    _memProfile==='girl'?state.girl_stack:state.boy_stack);
  _memRenderArchiStack(_memEl('memArchiStackOther'), _memProfile==='girl'?state.boy_stack:state.girl_stack);
  var pal=_memEl('memArchiShapesMe');if(pal)pal.style.pointerEvents=(showing2||state[_memProfile+'_done'])?'none':'';
  var gS=state.girl_score||0,bS=state.boy_score||0;
  var eMe=_memEl('memArchiScoreMe'),eOth=_memEl('memArchiScoreOther');
  if(eMe)eMe.textContent=_memProfile==='girl'?gS:bS;if(eOth)eOth.textContent=_memProfile==='girl'?bS:gS;
  if(state.winner&&!_archiSaved){_memShowArchiResult(state);}
}

function _memRenderArchiStack(el,stack){
  if(!el)return;el.innerHTML='';
  (stack||[]).forEach(function(si){var s=ARCHI_SHAPES[si],d=document.createElement('div');d.className='mem-archi-shape';d.style.background=s.color+'33';d.style.borderColor=s.color+'66';d.textContent=s.emoji;el.appendChild(d);});
}

function _memArchiTap(si) {
  if(!_memMp)return;
  var cur=_memMp.getGameState?_memMp.getGameState():null;if(!cur)return;
  if(Date.now()<(cur.show_until||0))return;
  var sp=_memProfile+'_stack',ns=JSON.parse(JSON.stringify(cur));
  var myStack=(ns[sp]||[]).concat([si]);
  ns[sp]=myStack;
  var exp=_archiTarget[myStack.length-1];
  if(si!==exp){
    ns[sp]=[];_archiPerfect=false;
    var sEl=_memEl('memArchiStackMe');if(sEl){sEl.classList.add('mem-archi-stack--wrong');setTimeout(function(){sEl.classList.remove('mem-archi-stack--wrong');},400);}
    _memMp.saveState(ns);return;
  }
  if(myStack.length===_archiTarget.length){
    ns[_memProfile+'_done']=true;ns[_memProfile+'_score']=(ns[_memProfile+'_score']||0)+1;
    var sEl2=_memEl('memArchiStackMe');if(sEl2){sEl2.classList.add('mem-archi-stack--complete');setTimeout(function(){sEl2.classList.remove('mem-archi-stack--complete');},600);}
    if(ns[_memOther+'_done']){
      if(cur.manche>=3){var gl=ns.girl_score||0,bl=ns.boy_score||0;ns.winner=gl>bl?'girl':bl>gl?'boy':'draw';}
      else{setTimeout(function(){if(_memMp){var next=_memBuildArchiState(cur.manche+1);next.girl_score=ns.girl_score||0;next.boy_score=ns.boy_score||0;_memMp.saveState(next);}},1000);}
    }
  }
  _memMp.saveState(ns);
}

function _memShowArchiResult(state){
  _archiSaved=true;var fEl=_memEl('memArchiFinalResult');if(!fEl)return;fEl.style.display='flex';
  var iWon=state.winner===_memProfile,isDraw=state.winner==='draw';
  var eEl=_memEl('memArchiFinalEmoji'),tEl=_memEl('memArchiFinalTitle');
  if(eEl)eEl.textContent=isDraw?'🤝':iWon?'🏆':'😢';
  if(tEl)tEl.textContent=isDraw?'Égalité !':iWon?'Victoire !':_memGetName(_memOther)+' gagne !';
  if(iWon&&_archiPerfect)_memUnlockTrophy('architecte','memArchiTrophyUnlock');
  if(_memProfile==='girl'){var cid=_memGetCoupleId(),dur=Math.round((Date.now()-_memStartedAt)/1000);if(cid)['girl','boy'].forEach(function(r){sb2Post('game_scores',{couple_id:cid,game_id:'memory',player_role:r,score:(r==='girl'?(state.girl_score||0):(state.boy_score||0))*333,moves:0,time_seconds:dur,winner_role:state.winner,user_id:typeof yamGetUser==='function'?yamGetUser().id:null}).catch(function(){});});}
  var btn=_memEl('memArchiDoneBtn');if(btn)btn.onclick=function(){
    fEl.style.display='none';
    if(_memCurrentMode==='all'){_memAllResults.archi={winner:state.winner};_memShowAllResults();}
    else{_memCleanup();_memShowLb(true);_lbLoad();}
  };
  if(typeof window.yamFlameActivity==='function')window.yamFlameActivity('memory_done');
}

// ═══════════════════════════════════════════════════════════
// ALL — Résultat global
// ═══════════════════════════════════════════════════════════

function _memShowAllResults(){
  var myW=0;Object.keys(_memAllResults).forEach(function(k){if(_memAllResults[k].winner===_memProfile)myW++;});
  var othW=Object.keys(_memAllResults).length-myW;
  if(myW===3)_memUnlockTrophy('osmose',null);
  _memShowScreen('memScreenClassic');
  var fEl=_memEl('memClassicFinalResult');if(!fEl)return;fEl.style.display='flex';
  var fw=myW>othW?_memProfile:othW>myW?_memOther:'draw',iWon=fw===_memProfile,isDraw=fw==='draw';
  var eEl=_memEl('memClassicFinalEmoji'),tEl=_memEl('memClassicFinalTitle'),sEl=_memEl('memClassicFinalScore');
  if(eEl)eEl.textContent=isDraw?'🤝':iWon?'🏆':'🎖️';
  if(tEl)tEl.textContent=isDraw?'Égalité !':iWon?'Tu gagnes le ALL ! 🎉':_memGetName(_memOther)+' gagne le ALL !';
  if(sEl)sEl.textContent=myW+' – '+othW+' (sur 3 modes)';
  var btn=_memEl('memClassicDoneBtn');if(btn)btn.onclick=function(){_memCleanup();_memShowLb(true);_lbLoad();};
}

// ═══════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════

var lbCurrentTab='all',lbCurrentData=[];

function _lbLoad(){
  var list=_memEl('lbList');if(!list)return;
  list.innerHTML='<div class="lb-loading"><span class="spinner"></span></div>';
  var cid=_memGetCoupleId();if(!cid){list.innerHTML='<div class="lb-empty">Session expirée</div>';return;}
  sb2Fetch('game_scores','couple_id=eq.'+cid+'&game_id=eq.memory&order=score.desc&limit=50')
    .then(function(r){lbCurrentData=Array.isArray(r)?r:[];lbRender(lbCurrentData);})
    .catch(function(){if(list)list.innerHTML='<div class="lb-empty">Aucun score encore 🎮</div>';});
}

function lbRender(rows){
  var list=_memEl('lbList');if(!list)return;
  var top=(lbCurrentTab==='all'?rows:rows.filter(function(r){return r.player_role===lbCurrentTab;})).slice(0,10);
  if(!top.length){list.innerHTML='<div class="lb-empty">Aucun score encore 🎮</div>';return;}
  var icons=['🥇','🥈','🥉'];
  list.innerHTML=top.map(function(row,i){
    var name=typeof v2GetDisplayName==='function'?v2GetDisplayName(row.player_role):row.player_role;
    var m=Math.floor(parseInt(row.time_seconds||0)/60),s=parseInt(row.time_seconds||0)%60;
    var ts=m?m+'m'+String(s).padStart(2,'0')+'s':s+'s';
    return '<div class="lb-row"><div class="lb-rank">'+(icons[i]||(i+1))+'</div><div class="lb-name">'+(typeof escHtml==='function'?escHtml(name):name)+'</div><div class="lb-score"><span>'+parseInt(row.score||0)+'pts</span> · '+ts+'</div></div>';
  }).join('');
}

document.addEventListener('DOMContentLoaded',function(){
  var tAll=_memEl('lbTabAll'),tGirl=_memEl('lbTabGirl'),tBoy=_memEl('lbTabBoy');
  if(tAll)  tAll.addEventListener('click',  function(){lbCurrentTab='all'; lbRender(lbCurrentData);});
  if(tGirl) tGirl.addEventListener('click', function(){lbCurrentTab='girl';lbRender(lbCurrentData);});
  if(tBoy)  tBoy.addEventListener('click',  function(){lbCurrentTab='boy'; lbRender(lbCurrentData);});
});

// ── Expose globaux ──
window.openMemoryGame  = openMemoryGame;
window.closeMemoryGame = closeMemoryGame;
window._memOpenGame    = openMemoryGame;
window._memCloseGame   = closeMemoryGame;
window._memRouteState  = _memRouteState;
