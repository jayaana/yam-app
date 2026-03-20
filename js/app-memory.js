// ═══════════════════════════════════════════════════════════
// app-memory.js — Jeu Memory (solo + multijoueur)
// Séparé de app-games.js — Mars 2026
// Dépendances : app-core.js, app-account.js, app-multiplayer.js
// Globals : sb2Fetch, sb2Post, yamGetUser, getProfile,
//           v2GetDisplayName, escHtml, _yamSlide, YAMMultiplayer
// ═══════════════════════════════════════════════════════════

// ── MEMORY — chargement direct ──
var _gamesLoaded = true;
function _loadGames() {} // no-op conservé pour compat


// ── MEMORY ──
var MEMORY_EMOJIS = ['💕','🌸','💋','🥰','🌙','✨','🎵','💎','🎀','🍓','🌺','🦋'];
var memCards=[], memFlipped=[], memMatched=0, memMoves=0, memLocked=false;
var memTimerInt=null, memSeconds=0, memStarted=false;
var memMode = 'solo';     // 'solo' | 'multi'
var memMyPairs = 0;       // paires trouvées par moi (multi)
var memOtherPairs = 0;    // paires trouvées par l'autre (multi)
var memMyTurn = true;     // true = c'est mon tour (multi)
var _memMp = null;        // handle YAMMultiplayer
var _memProcessing = false; // true pendant le délai de retournement (700ms) → bloque onStateUpdate
var _memResultShown = false; // guard anti-doublon fin de partie

// ── Tables Supabase pour le multi memory ──
var MEM_GAME_TABLE     = 'memory_games';
var MEM_PRESENCE_TABLE = 'memory_presence';

// ── Helpers session ──
function _memGetSession() {
  try { return ( yamGetUser ? {user: yamGetUser()} : null ); } catch(e) { return null; }
}
function _memGetCoupleId() {
  var s = _memGetSession(); return s && s.user ? s.user.couple_id : null;
}
function _memGetProfile() {
  if(typeof getProfile === 'function'){ var p=getProfile(); if(p) return p; }
  var u = typeof yamGetUser === 'function' ? yamGetUser() : null;
  return u ? u.role : null;
}
function _memGetName(role) {
  return (typeof v2GetDisplayName === 'function') ? v2GetDisplayName(role) : (role === 'girl' ? 'Elle' : 'Lui');
}

// ── Ouverture / Fermeture ──
// openMemoryGame et closeMemoryGame sont definies dans app-nav.js (charge en dernier)
// _memShowScreen, memoryChooseSolo, memoryChooseMulti etc. restent ici

// ── Navigation entre écrans internes ──
function _memShowScreen(screen) {
  var screens = {
    mode:  document.getElementById('memoryModeScreen'),
    lobby: document.getElementById('memoryLobbyScreen'),
    game:  document.getElementById('memoryGameArea')
  };
  Object.keys(screens).forEach(function(k) {
    if (screens[k]) screens[k].style.display = k === screen ? 'flex' : 'none';
  });
  if (screen === 'mode' && screens.mode) screens.mode.style.display = 'block';
  if (screen === 'game' && screens.game) screens.game.style.display = 'block';
  // Classement visible seulement sur l'écran mode
  var lb = document.getElementById('memoryLeaderboard');
  if (lb) lb.style.display = screen === 'mode' ? 'block' : 'none';
}

// ── Choix de mode ──
function memoryChooseSolo() {
  memMode = 'solo';
  _memShowScreen('game');
  // Cacher les scores multi, montrer restart
  var ms = document.getElementById('memMultiScores');
  var rb = document.getElementById('memBtnRestart');
  if (ms) ms.style.display = 'none';
  if (rb) rb.style.display = '';
  memoryInit();
  // Badge joueur courant
  var profile = _memGetProfile();
  var badge = document.getElementById('memTurnBadge');
  if (badge && profile) badge.textContent = '🧠 ' + _memGetName(profile);
}

function memoryChooseMulti() {
  memMode = 'multi';
  // Cacher restart en multi
  var rb = document.getElementById('memBtnRestart');
  if (rb) rb.style.display = 'none';
  _memShowScreen('lobby');
  _memStartMulti();
}

// ────────────────────────────────────────────────────────────
// MODE SOLO
// ────────────────────────────────────────────────────────────
function memoryInit() {
  clearInterval(memTimerInt);
  memCards=[]; memFlipped=[]; memMatched=0; memMoves=0; memSeconds=0;
  memLocked=false; memStarted=false;
  memMyPairs=0; memOtherPairs=0;
  _memProcessing=false;
  _memResultShown=false;

  var scoreEl = document.getElementById('memScore');
  var movesEl = document.getElementById('memMoves');
  var timeEl  = document.getElementById('memTime');
  var winEl   = document.getElementById('memoryWin');
  if (scoreEl) scoreEl.textContent = '0';
  if (movesEl) movesEl.textContent = '0';
  if (timeEl)  timeEl.textContent  = '0s';
  if (winEl)   winEl.classList.remove('show');

  // Utiliser 8 paires en solo, 8 en multi
  var pool = MEMORY_EMOJIS.slice(0, 8);
  var pairs = pool.concat(pool);
  // Mélanger
  for (var i = pairs.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = pairs[i]; pairs[i] = pairs[j]; pairs[j] = tmp;
  }

  var grid = document.getElementById('memoryGrid');
  grid.innerHTML = '';
  // Adapter la grille selon le nombre de paires
  var cols = 4;
  grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';

  pairs.forEach(function(emoji, idx) {
    var card = document.createElement('div');
    card.className = 'mem-card';
    card.innerHTML = '<div class="mem-card-inner"><div class="mem-card-front"></div><div class="mem-card-back">' + emoji + '</div></div>';
    card.dataset.emoji = emoji;
    card.dataset.idx   = idx;
    (function(c) { c.addEventListener('click', function() { memCardClick(c); }); })(card);
    grid.appendChild(card);
    memCards.push(card);
  });
}

function memoryRestart() {
  if (memMode === 'multi') return; // pas de restart en multi
  clearInterval(memTimerInt);
  var winEl = document.getElementById('memoryWin');
  if (winEl) winEl.classList.remove('show');
  memoryInit();
}

function memoryQuit() {
  // Identique au pattern Skyjo : abandon() gère PATCH abandoned + DELETE + notification adversaire
  if (_memMp && memMode === 'multi') {
    _memMp.abandon(function() {
      clearInterval(memTimerInt);
      _memMp = null;
      _memResetToMode();
    });
  } else {
    clearInterval(memTimerInt);
    if (_memMp) { _memMp.leave(); _memMp = null; }
    _memResetToMode();
  }
}

function _memResetToMode() {
  var winEl = document.getElementById('memoryWin');
  if (winEl) winEl.classList.remove('show');
  var multiScores = document.getElementById('memMultiScores');
  if (multiScores) multiScores.style.display = 'none';
  memMode = null;
  _memResultShown = false;
  // Vider memCards pour forcer la reconstruction depuis Supabase à la prochaine partie
  memCards = [];
  memFlipped = [];
  memMatched = 0;
  memMyPairs = 0;
  memOtherPairs = 0;
  _memProcessing = false;
  _memShowScreen('mode');
}

function memCardClick(card) {
  // En multi, bloquer si pas mon tour
  if (memMode === 'multi' && !memMyTurn) return;
  if (memLocked || card.classList.contains('flipped') || card.classList.contains('matched')) return;

  if (!memStarted) {
    memStarted = true;
    memTimerInt = setInterval(function() {
      memSeconds++;
      var m = Math.floor(memSeconds / 60), s = memSeconds % 60;
      var timeEl = document.getElementById('memTime');
      if (timeEl) timeEl.textContent = m ? m + 'm' + String(s).padStart(2, '0') + 's' : s + 's';
    }, 1000);
  }

  card.classList.add('flipped');
  memFlipped.push(card);

  if (memFlipped.length === 2) {
    memMoves++;
    var movesEl = document.getElementById('memMoves');
    if (movesEl) movesEl.textContent = memMoves;
    memLocked = true;
    _memProcessing = true;
    if (memMode === 'multi') {
      _memSetBoardBlocked(true);
      // Sauvegarder avec les 2 cartes visibles — l'adversaire les voit pendant 700ms
      _memSaveMultiState(false);
    }
    setTimeout(function() {
      _memProcessing = false;
      checkMemMatch();
    }, memMode === 'multi' ? 1200 : 700);
  } else if (memMode === 'multi' && memFlipped.length === 1) {
    // 1ère carte : sauvegarder pour que l'adversaire la voit tout de suite
    _memSaveMultiState(false);
  }
}

function checkMemMatch() {
  var a = memFlipped[0], b = memFlipped[1];
  if (a.dataset.emoji === b.dataset.emoji) {
    a.classList.add('matched');
    b.classList.add('matched');
    memMatched++;
    var scoreEl = document.getElementById('memScore');
    if (scoreEl) scoreEl.textContent = memMatched;

    if (memMode === 'multi') {
      memMyPairs++;
      _memUpdateMultiScores();
      if (memMatched === 8) {
        _memEndMulti(); // 8 paires au total → fin de partie
      } else {
        // Trouver une paire = on rejoue (turn reste à moi)
        memLocked = false;
        _memSetBoardBlocked(false);
        _memSaveMultiState(false); // false = je rejoue
      }
    } else {
      if (memMatched === 8) {
        clearInterval(memTimerInt);
        setTimeout(memoryWinFn, 400);
      }
    }
  } else {
    a.classList.add('wrong');
    b.classList.add('wrong');
    _memProcessing = true;
    setTimeout(function() {
      _memProcessing = false;
      a.classList.remove('flipped', 'wrong');
      b.classList.remove('flipped', 'wrong');
      if (memMode === 'multi') {
        memMyTurn = false;
        _memSetBoardBlocked(true);
        _memUpdateTurnBadge();
        _memSaveMultiState(true);
      }
    }, memMode === 'multi' ? 1000 : 350);
  }
  memFlipped = [];
  if (memMode !== 'multi') memLocked = false;
}

// Calcul score solo
function memoryCalcScore(moves, seconds) {
  var base = 1000;
  var penalty = moves * 10 + seconds * 2;
  return Math.max(0, base - penalty);
}

function memoryWinFn() {
  var win = document.getElementById('memoryWin');
  win.classList.add('show');
  var stars = memMoves <= 18 ? '🌟🌟🌟' : memMoves <= 28 ? '🌟🌟' : '🌟';
  var timeStr = document.getElementById('memTime').textContent;
  var profile = _memGetProfile();
  var who = _memGetName(profile);
  var msg = memMoves <= 18
    ? 'Parfait ' + who + ' ! ' + memMoves + ' coups en ' + timeStr + ' 💕'
    : memMoves <= 28
    ? 'Bien joué ' + who + ' ! ' + memMoves + ' coups en ' + timeStr + ' 😊'
    : 'Bravo ' + who + ' ! ' + memMoves + ' coups en ' + timeStr + ' 😏';
  document.getElementById('memoryWinTitle').textContent = stars + ' Terminé !';
  document.getElementById('memoryWinSub').textContent   = msg;
  win.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Sauvegarder score
  var scoreVal = memoryCalcScore(memMoves, memSeconds);
  var coupleId = _memGetCoupleId();
  var _uSave = yamGetUser ? yamGetUser() : null;
  if (profile && coupleId && _uSave && _uSave.partner_pseudo) {
    sb2Post('game_scores', {
      couple_id: coupleId, game_id: 'memory',
      player_role: profile, score: scoreVal,
      moves: memMoves, time_seconds: memSeconds,
      winner_role: null,
      user_id: yamGetUser ? yamGetUser().id : null
    }).then(function() { _lbLoad(); if (typeof window.yamUpdateTrophies === 'function') window.yamUpdateTrophies(); }).catch(function() {});
  }
  // Flamme
  if (typeof window.yamFlameActivity === 'function') window.yamFlameActivity('memory_done');
}
// ────────────────────────────────────────────────────────────
function _memStartMulti() {
  var profile = _memGetProfile();
  var myName  = _memGetName(profile);
  var other   = profile === 'girl' ? 'boy' : 'girl';
  var othName = _memGetName(other);

  // Mettre à jour le lobby
  var nameMe  = document.getElementById('memLobbyNameMe');
  var nameOth = document.getElementById('memLobbyNameOther');
  var dotOth  = document.getElementById('memLobbyDotOther');
  var status  = document.getElementById('memLobbyStatus');
  if (nameMe)  nameMe.textContent  = myName;
  if (nameOth) nameOth.textContent = othName;
  if (dotOth)  dotOth.style.opacity = '0.3';
  if (status)  status.textContent  = 'En attente de ' + othName + '…';

  _memMp = YAMMultiplayer.init({
    gameTable:        MEM_GAME_TABLE,
    presenceTable:    MEM_PRESENCE_TABLE,
    deleteOnLeave:    true,
    staleGameMinutes: 2,  // partie non mise à jour depuis 2min → fantôme à la relance

    buildInitialState: function() {
      // Générer les 8 paires mélangées
      var pool = MEMORY_EMOJIS.slice(0, 8).concat(MEMORY_EMOJIS.slice(0, 8));
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      return {
        cards: pool,        // tableau des emojis mélangés
        matched: [],        // indices des paires trouvées
        girl_pairs: 0,
        boy_pairs:  0,
        turn: 'girl',       // qui commence
        moves: 0,
        winner: null
      };
    },

    onWaiting: function(me, opp) {
      if (dotOth) dotOth.style.opacity = '0.3';
      if (status) status.textContent = 'En attente de ' + _memGetName(opp) + '…';
    },

    onLobbyTick: function(girlOk, boyOk) {
      var isOth = profile === 'girl' ? boyOk : girlOk;
      if (dotOth) {
        dotOth.style.background  = isOth ? '#22c55e' : '#555';
        dotOth.style.boxShadow   = isOth ? '0 0 6px rgba(34,197,94,0.8)' : 'none';
      }
      if (isOth && status) status.textContent = othName + ' est prêt(e) ! Lancement…';
    },

    onMatchFound: function(gameRow) {
      if (dotOth) dotOth.style.opacity = '1';
      if (status)  status.textContent   = 'Partie trouvée !';
      setTimeout(function() { _memLaunchMultiGame(gameRow); }, 400);
    },

    onPresenceUpdate: function(isOnline) {
      var dot = document.getElementById('memOppDot');
      if (dot) {
        dot.style.background = isOnline ? '#22c55e' : '#555';
        dot.style.boxShadow  = isOnline ? '0 0 5px rgba(34,197,94,0.8)' : 'none';
        dot.style.opacity    = '1';
      }
    },

    onStateUpdate: function(gameRow) {
      if (!gameRow.state) return;
      _memApplyMultiState(gameRow.state);
    },

    onOpponentOffline: function(oppName) {
      if (!_memMp) return;
      _memMp.showChoice(
        '😔', oppName + ' est déconnecté(e)',
        'Tu peux attendre son retour ou quitter la partie.',
        'Attendre', function() { _memMp.startReconnectWait(); },
        'Quitter',  function() { memoryQuit(); }
      );
    },

    onAbandon: function() {
      clearInterval(memTimerInt);
      _memMp.showAlert('🏳️', 'Partie abandonnée', function() { _memResetToMode(); });
    },

    onReconnectTimeout: function() {
      clearInterval(memTimerInt);
      _memResetToMode();
    },

    onLeave: function() {
      clearInterval(memTimerInt);
      _memMp = null;
      _memResetToMode();
    }
  });

  _memMp.enterLobby();

  // Expose pour le système pause/resume (identique Skyjo)
  window._memRefreshRates   = function() { if (_memMp) _memMp.refreshRates(); };
  window._memDeletePresence = function() { if (_memMp) _memMp.deletePresence(); };
  window._memUpsertPresence = function() { if (_memMp) _memMp.upsertPresence(); };
}

function memoryMultiCancel() {
  if (_memMp) { _memMp.leave(); _memMp = null; }
  _memShowScreen('mode');
}

function _memLaunchMultiGame(gameRow) {
  _memShowScreen('game');
  var profile = _memGetProfile();
  var other   = profile === 'girl' ? 'boy' : 'girl';
  var isCreator = gameRow.created_by === profile;

  // Afficher scores multi
  var ms = document.getElementById('memMultiScores');
  if (ms) ms.style.display = 'flex';

  // Initialiser noms multi
  var nMe  = document.getElementById('memMscoreNameMe');
  var nOth = document.getElementById('memMscoreNameOther');
  if (nMe)  nMe.textContent  = _memGetName(profile);
  if (nOth) nOth.textContent = _memGetName(other);

  // Vider memCards pour forcer reconstruction depuis Supabase (évite héritage d'une grille solo ou partie précédente)
  memCards = [];
  var grid = document.getElementById('memoryGrid');
  if (grid) grid.innerHTML = '';

  // Appliquer l'état initial
  _memApplyMultiState(gameRow.state || { cards:[], matched:[], girl_pairs:0, boy_pairs:0, turn:'girl', moves:0, winner:null });

  // Timer — reprendre elapsed_seconds depuis le state si reconnexion
  clearInterval(memTimerInt);
  memSeconds = (gameRow.state && gameRow.state.elapsed_seconds) ? gameRow.state.elapsed_seconds : 0;
  memStarted = true;
  // Afficher immédiatement le bon temps
  var timeEl = document.getElementById('memTime');
  if (timeEl) {
    var m0 = Math.floor(memSeconds / 60), s0 = memSeconds % 60;
    timeEl.textContent = m0 ? m0 + 'm' + String(s0).padStart(2,'0') + 's' : s0 + 's';
  }
  memTimerInt = setInterval(function() {
    memSeconds++;
    var m = Math.floor(memSeconds / 60), s = memSeconds % 60;
    var el = document.getElementById('memTime');
    if (el) el.textContent = m ? m + 'm' + String(s).padStart(2,'0') + 's' : s + 's';
  }, 1000);
}

function _memApplyMultiState(state) {
  if (!state) return;
  // Bloquer les updates distants uniquement si c'est MON tour et que je suis
  // en plein traitement local (animation retournement) — sinon laisser passer
  // pour que l'adversaire voie mes cartes en temps réel
  var profile = _memGetProfile();
  var isMyTurn = state.turn === profile;
  if (isMyTurn && (_memProcessing || memFlipped.length > 0)) return;
  var other   = profile === 'girl' ? 'boy' : 'girl';

  // Si partie terminée
  if (state.winner) {
    clearInterval(memTimerInt);
    _memShowMultiResult(state);
    return;
  }

  memMyTurn = (state.turn === profile);

  // Reconstruire la grille à partir de state.cards
  if (state.cards && state.cards.length > 0) {
    var grid = document.getElementById('memoryGrid');
    // Reconstruire la grille si elle est vide ou si la taille ne correspond pas
    // (premier chargement ou reconnexion)
    if (memCards.length !== state.cards.length) {
      grid.innerHTML = '';
      memCards = [];
      state.cards.forEach(function(emoji, idx) {
        var card = document.createElement('div');
        card.className = 'mem-card';
        card.innerHTML = '<div class="mem-card-inner"><div class="mem-card-front"></div><div class="mem-card-back">' + emoji + '</div></div>';
        card.dataset.emoji = emoji;
        card.dataset.idx   = String(idx);
        (function(c) { c.addEventListener('click', function() { memCardClick(c); }); })(card);
        grid.appendChild(card);
        memCards.push(card);
      });
    }

    // Appliquer l'état des cartes
    var matched = state.matched || [];
    var flipped = state.flipped || [];
    memCards.forEach(function(c, i) {
      if (matched.indexOf(i) !== -1) {
        c.classList.add('flipped', 'matched');
        c.classList.remove('blocked', 'wrong');
      } else if (flipped.indexOf(i) !== -1) {
        // Carte retournée (par moi ou l'adversaire) : toujours visible
        c.classList.add('flipped');
        c.classList.remove('matched', 'wrong', 'blocked');
      } else {
        // Carte face cachée
        c.classList.remove('matched', 'flipped', 'wrong');
      }
    });
    memMatched = matched.length / 2;
    // Ne vider memFlipped que si c'est mon tour (sinon ce sont les cartes de l'adversaire)
    if (memMyTurn) memFlipped = [];
  }

  // Mettre à jour les scores
  var myPairs  = profile === 'girl' ? (state.girl_pairs || 0) : (state.boy_pairs || 0);
  var othPairs = profile === 'girl' ? (state.boy_pairs  || 0) : (state.girl_pairs || 0);
  memMyPairs    = myPairs;
  memOtherPairs = othPairs;
  _memUpdateMultiScores();
  _memUpdateTurnBadge();

  // Bloquer/débloquer le plateau
  _memSetBoardBlocked(!memMyTurn);

  // Moves
  var movesEl = document.getElementById('memMoves');
  if (movesEl) movesEl.textContent = state.moves || 0;
  memMoves = state.moves || 0;
}

function _memMultiCardClick(card, allCards) {
  if (!memMyTurn || memLocked) return;
  if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
  memCardClick(card);
}

function _memSaveMultiState(passTurn) {
  if (!_memMp) return;
  var profile = _memGetProfile();
  var other   = profile === 'girl' ? 'boy' : 'girl';

  // Construire l'état depuis les cartes actuelles
  var matchedIndices = [];
  var flippedIndices = [];
  memCards.forEach(function(c, i) {
    if (c.classList.contains('matched')) matchedIndices.push(i);
    else if (c.classList.contains('flipped')) flippedIndices.push(i);
  });

  var cardEmojis = memCards.map(function(c) { return c.dataset.emoji; });

  // passTurn=true  → c'est maintenant le tour de l'adversaire
  // passTurn=false → j'ai trouvé une paire, je rejoue
  var nextTurn = passTurn ? other : profile;

  var state = {
    cards:           cardEmojis,
    matched:         matchedIndices,
    flipped:         flippedIndices,
    girl_pairs:      profile === 'girl' ? memMyPairs : memOtherPairs,
    boy_pairs:       profile === 'boy'  ? memMyPairs : memOtherPairs,
    turn:            nextTurn,
    moves:           memMoves,
    elapsed_seconds: memSeconds,
    winner:          null
  };

  _memMp.saveState(state);
}

function _memEndMulti() {
  clearInterval(memTimerInt);
  var profile = _memGetProfile();
  var other   = profile === 'girl' ? 'boy' : 'girl';

  var winner;
  if (memMyPairs > memOtherPairs)       winner = profile;
  else if (memOtherPairs > memMyPairs)  winner = other;
  else                                   winner = 'draw';

  var state = {
    cards:      memCards.map(function(c) { return c.dataset.emoji; }),
    matched:    Array.from({length: memCards.length}, function(_, i) { return i; }), // tout matché
    girl_pairs: profile === 'girl' ? memMyPairs : memOtherPairs,
    boy_pairs:  profile === 'boy'  ? memMyPairs : memOtherPairs,
    turn:       profile,
    moves:      memMoves,
    winner:     winner
  };

  if (_memMp) _memMp.saveState(state);
  _memShowMultiResult(state);
}

function _memShowMultiResult(state) {
  if (_memResultShown) return;
  _memResultShown = true;
  var profile = _memGetProfile();
  var other   = profile === 'girl' ? 'boy' : 'girl';
  var winner  = state.winner;
  var iWon    = winner === profile;
  var isDraw  = winner === 'draw';

  var emoji = isDraw ? '🤝' : iWon ? '🏆' : '😢';
  var title = isDraw ? 'Égalité !' : iWon ? 'Tu as gagné ! 🎉' : _memGetName(other) + ' a gagné !';
  var myP   = profile === 'girl' ? (state.girl_pairs || 0) : (state.boy_pairs  || 0);
  var othP  = profile === 'girl' ? (state.boy_pairs  || 0) : (state.girl_pairs || 0);
  var sub   = _memGetName(profile) + ' : ' + myP + ' paires · ' + _memGetName(other) + ' : ' + othP + ' paires';

  var win = document.getElementById('memoryWin');
  win.classList.add('show');
  document.getElementById('memoryWin').querySelector('.memory-win-emoji').textContent = emoji;
  document.getElementById('memoryWinTitle').textContent = title;
  document.getElementById('memoryWinSub').textContent   = sub;
  // Masquer le bouton rejouer en multi
  var replayBtn = document.getElementById('memWinReplayBtn');
  if (replayBtn) replayBtn.style.display = 'none';
  // Bouton quitter visible en multi
  var quitBtn = document.getElementById('memWinQuitBtn');
  if (quitBtn) {
    quitBtn.style.display = '';
    quitBtn.onclick = function() {
      clearInterval(memTimerInt);
      if (_memMp) { _memMp.leave(); _memMp = null; }
      _memResetToMode();
    };
  }
  win.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Sauvegarder le score des deux joueurs (multi)
  // Uniquement côté 'girl' pour éviter la double écriture (_memShowMultiResult tourne chez les deux)
  var coupleId = _memGetCoupleId();
  var _uSaveM = yamGetUser ? yamGetUser() : null;
  if (profile === 'girl' && coupleId && _uSaveM && _uSaveM.partner_pseudo) {
    var scoreVal = memoryCalcScore(memMoves, memSeconds);
    var girlPairs = state.girl_pairs || 0;
    var boyPairs  = state.boy_pairs  || 0;
    ['girl','boy'].forEach(function(role) {
      var roleScore = role === 'girl'
        ? memoryCalcScore(memMoves - (boyPairs * 2), memSeconds)
        : memoryCalcScore(memMoves - (girlPairs * 2), memSeconds);
      roleScore = isDraw ? scoreVal : (role === winner ? scoreVal : Math.max(0, scoreVal - 200));
      sb2Post('game_scores', {
        couple_id:   coupleId, game_id: 'memory',
        player_role: role,
        score:       roleScore,
        moves:       memMoves, time_seconds: memSeconds,
        winner_role: isDraw ? 'draw' : winner,
        user_id:     _uSaveM ? _uSaveM.id : null
      }).catch(function(){});
    });
    if (typeof _lbLoad === 'function') _lbLoad();
    if (typeof window.yamUpdateTrophies === 'function') window.yamUpdateTrophies();
  }

  if (_memMp) { _memMp.stopAll(); }
}

function _memSetBoardBlocked(blocked) {
  memCards.forEach(function(c) {
    if (!c.classList.contains('matched')) {
      c.classList.toggle('blocked', blocked);
    }
  });
  memLocked = blocked;
}

function _memUpdateMultiScores() {
  var valMe  = document.getElementById('memMscoreValMe');
  var valOth = document.getElementById('memMscoreValOther');
  if (valMe)  valMe.textContent  = memMyPairs;
  if (valOth) valOth.textContent = memOtherPairs;
  var scoreEl = document.getElementById('memScore');
  if (scoreEl) scoreEl.textContent = memMyPairs;
}

function _memUpdateTurnBadge() {
  var badge = document.getElementById('memTurnBadge');
  if (!badge) return;
  var profile = _memGetProfile();
  if (memMyTurn) {
    badge.textContent = '🎯 Ton tour !';
    badge.className   = 'mem-turn-badge';
  } else {
    badge.textContent = '⏳ Tour de ' + _memGetName(profile === 'girl' ? 'boy' : 'girl');
    badge.className   = 'mem-turn-badge mem-turn-badge--other';
  }
}


// ── LEADERBOARD MEMORY ──
var lbCurrentTab = 'all';
var lbCurrentData = [];
var _gamesLbLoaded = false;

function lbSetTab(tab) {
  lbCurrentTab = tab;
  ['all','girl','boy'].forEach(function(t) {
    var el = document.getElementById('lbTab' + t.charAt(0).toUpperCase() + t.slice(1));
    if(el) el.className = 'lb-tab' + (t === tab ? ' active-' + tab : '');
  });
  lbRender(lbCurrentData);
}

function _lbLoad() {
  var list = document.getElementById('lbList');
  if(!list) return;
  list.innerHTML = '<div class="lb-loading"><span class="spinner"></span></div>';
  var s = ( yamGetUser ? {user: yamGetUser()} : null );
  var coupleId = s && s.user ? s.user.couple_id : null;
  if(!coupleId) {
    list.innerHTML = '<div class="lb-empty">Session expirée — reconnectez-vous</div>';
    return;
  }
  if(!(s && s.user && s.user.partner_pseudo)) {
    list.innerHTML = '<div class="lb-empty">Lie-toi à un partenaire pour débloquer le classement 👩‍❤️‍👨</div>';
    return;
  }
  sb2Fetch('game_scores', 'couple_id=eq.' + coupleId + '&game_id=eq.memory&order=score.desc&limit=50')
    .then(function(rows) {
      lbCurrentData = Array.isArray(rows) ? rows : [];
      lbRender(lbCurrentData);
    })
    .catch(function() {
      if(list) list.innerHTML = '<div class="lb-empty">Aucun score encore 🎮</div>';
    });
}

function lbRender(rows) {
  var list = document.getElementById('lbList');
  if(!list) return;
  var filtered = lbCurrentTab === 'all' ? rows : rows.filter(function(r){ return r.player_role === lbCurrentTab; });
  var top = filtered.slice(0, 10);
  if(!top.length) {
    list.innerHTML = '<div class="lb-empty">Aucun score encore — soyez les premiers ! 🎮</div>';
    return;
  }
  var rankIcons = ['🥇','🥈','🥉'];
  list.innerHTML = top.map(function(row, i) {
    var rankClass   = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    var rankDisplay = i < 3 ? rankIcons[i] : (i + 1);
    var playerLabel = (typeof v2GetDisplayName==='function' ? v2GetDisplayName(row.player_role) : (row.player_role==='girl' ? 'Moi' : 'Toi'));
    var roleImg = row.player_role === 'girl'
      ? '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iI2U4NDA2YSIvPjxwYXRoIGQ9Ik01MCA2MCBDNDggNTgsMzIgNDgsMzIgMzcgQzMyIDI5LDM5IDI1LDQ0IDI4IEM0NyAzMCw1MCAzNCw1MCAzNCBDNTAgMzQsNTMgMzAsNTYgMjggQzYxIDI1LDY4IDI5LDY4IDM3IEM2OCA0OCw1MiA1OCw1MCA2MFoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC44NSkiLz48L3N2Zz4=" width="16" height="16" style="border-radius:50%;vertical-align:middle;flex-shrink:0;">'
      : '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzBmNGRiMCIvPjxwYXRoIGQ9Ik01MCA2MCBDNDggNTgsMzIgNDgsMzIgMzcgQzMyIDI5LDM5IDI1LDQ0IDI4IEM0NyAzMCw1MCAzNCw1MCAzNCBDNTAgMzQsNTMgMzAsNTYgMjggQzYxIDI1LDY4IDI5LDY4IDM3IEM2OCA0OCw1MiA1OCw1MCA2MFoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC44NSkiLz48L3N2Zz4=" width="16" height="16" style="border-radius:50%;vertical-align:middle;flex-shrink:0;">';
    var m = Math.floor(parseInt(row.time_seconds||0) / 60), s = parseInt(row.time_seconds||0) % 60;
    var timeStr = m ? m + 'm' + String(s).padStart(2,'0') + 's' : s + 's';
    return '<div class="lb-row">' +
      '<div class="lb-rank ' + rankClass + '">' + rankDisplay + '</div>' +
      '<div class="lb-name" style="display:flex;align-items:center;gap:5px;">' + roleImg + escHtml(playerLabel) + '</div>' +
      '<div class="lb-score"><span>' + parseInt(row.score||0) + 'pts</span> · ' + parseInt(row.moves||0) + ' coups · ' + timeStr + '</div>' +
    '</div>';
  }).join('');
}

