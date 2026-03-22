/* ═══════════════════════════════════════════════════
   app-jeux-dashboard.js
   Dashboard Mini-jeux — scores, VS, leaderboard chips
   Chargé après app-nav.js, avant app-inline.js
   Exposé via window.jxLoadDashboard (appelé par app-nav.js)
═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Constantes ── */
  var _GAME_EMOJI = { memory:'🧠', memory_classic:'🃏', memory_echo:'🔊', memory_archi:'🏗️', memory_all:'⚡', pendu:'🔤', puzzle:'🧩', snake:'🐍', ocho:'🎴', skyjo:'🃏' };
  var _GAME_LABEL = {
    ocho:'Ocho', skyjo:'Skyjo',
    memory:'Memory', memory_classic:'Classic+', memory_echo:'Écho', memory_archi:'Architecte', memory_all:'ALL ⚡',
    pendu:'Pendu', puzzle:'Puzzle', snake:'Snake'
  };
  var _MEDALS     = ['🥇','🥈','🥉'];

  /* ── Supabase Storage (même constantes que app-account.js) ── */
  var _SB_URL    = 'https://jstiwtbgkbedtldqjdhp.supabase.co';
  var _SB_BUCKET = 'images';

  /* ── État ── */
  var _currentGame = 'ocho';
  var _scoreCache  = null;
  var _girlName    = '—';
  var _boyName     = '—';
  var _girlUserId  = null;
  var _boyUserId   = null;

  /* ── Helpers DOM ── */
  function _el(id) { return document.getElementById(id); }
  function _esc(s) { return typeof escHtml === 'function' ? escHtml(s) : s; }

  /* ── Fallback selon le rôle ── */
  function _fallbackSrc(role) {
    return 'assets/images/' + (role === 'girl' ? 'profil_girl' : 'profil_boy') + '.png';
  }

  /* ── Charge un avatar dans un container DOM via probe Image()
     Supabase Storage renvoie HTTP 200 même si le fichier n'existe pas
     → onerror sur <img> ne se déclenche jamais → il faut probe d'abord.
     Même technique que _acLoadAvatarPhoto() dans app-account.js.
     Aucun attribut onerror= inline → compatible CSP strict.
  ── */
  function _loadAvatarInto(containerEl, userId, role, size) {
    if (!containerEl) return;
    size = size || 38;
    var fallback = _fallbackSrc(role);

    function _show(src) {
      var img = document.createElement('img');
      img.style.width        = size + 'px';
      img.style.height       = size + 'px';
      img.style.borderRadius = '50%';
      img.style.objectFit    = 'cover';
      img.style.display      = 'block';
      img.src = src;
      containerEl.innerHTML = '';
      containerEl.appendChild(img);
    }

    if (!userId) { _show(fallback); return; }

    var url = _SB_URL + '/storage/v1/object/public/' + _SB_BUCKET + '/avatars/' + userId + '.jpg?t=' + Date.now();
    var probe = new Image();
    probe.onload  = function () { _show(url); };
    probe.onerror = function () { _show(fallback); };
    probe.src = url;
  }

  /* ── Mise à jour avatars header VS ── */
  function _updateAvatars() {
    _loadAvatarInto(_el('jxAvA'), _girlUserId, 'girl', 38);
    _loadAvatarInto(_el('jxAvB'), _boyUserId,  'boy',  38);
  }

  /* ── Sélection chip ── */
  function jxSelChip(el) {
    var chip = el.closest ? el.closest('.jx-chip') : el;
    if (!chip || !chip.dataset || !chip.dataset.game) return;
    document.querySelectorAll('.jx-chip').forEach(function (c) { c.classList.remove('jx-chip-on'); });
    chip.classList.add('jx-chip-on');
    _currentGame = chip.dataset.game;
    if (_scoreCache) _renderLb(_currentGame, _scoreCache);
  }
  window.jxSelChip = jxSelChip;

  /* ── Drag-to-scroll + délégation click (FIX CSP : zéro onclick inline) ── */
  function _initChipsDrag() {
    var el = _el('jxChips');
    if (!el) return;
    var d = false, sx = 0, sl = 0, moved = false;

    el.addEventListener('mousedown', function (e) {
      d = true; moved = false;
      sx = e.pageX - el.offsetLeft;
      sl = el.scrollLeft;
    });
    el.addEventListener('mouseleave', function () { d = false; });
    el.addEventListener('mouseup',    function () { d = false; });
    el.addEventListener('mousemove',  function (e) {
      if (!d) return;
      e.preventDefault();
      moved = true;
      el.scrollLeft = sl - (e.pageX - el.offsetLeft - sx);
    });

    el.addEventListener('click', function (e) {
      if (moved) return;
      var chip = e.target.closest ? e.target.closest('.jx-chip') : null;
      if (chip) jxSelChip(chip);
    });

    el.addEventListener('touchend', function (e) {
      var chip = e.target.closest ? e.target.closest('.jx-chip') : null;
      if (chip) jxSelChip(chip);
    }, { passive: true });
  }

  /* ── Calcul victoires multi uniquement ──
     Lit winner_role directement — pas de pairing fragile.
     Seuls ocho, skyjo, memory (multi) comptent pour le score VS.
     Une ligne player_role='girl' par partie suffit à compter la victoire.
  ── */
  var _MULTI_GAMES = ['ocho', 'skyjo', 'memory', 'memory_classic', 'memory_echo', 'memory_archi', 'memory_all'];

  function _computeWins(rows) {
    var wins = { girl: 0, boy: 0 };
    if (!rows || !rows.length) return wins;
    /* On ne prend qu'une ligne par partie (player_role='girl') pour éviter
       de compter deux fois la même partie (une ligne girl + une ligne boy). */
    rows
      .filter(function (r) {
        var _mIds=['memory','memory_classic','memory_echo','memory_archi','memory_all'];
        return (_MULTI_GAMES.indexOf(r.game_id) !== -1 || _mIds.indexOf(r.game_id) !== -1) &&
               r.winner_role && r.winner_role !== 'draw' &&
               r.player_role === 'girl';
      })
      .forEach(function (r) {
        wins[r.winner_role] = (wins[r.winner_role] || 0) + 1;
      });
    return { girl: wins.girl || 0, boy: wins.boy || 0 };
  }

  /* ── Leaderboard ── */
  function _renderLb(game, rows) {
    // Pour 'memory' : agréger tous les sous-modes memory_*
    var _memIds = ['memory', 'memory_classic', 'memory_echo', 'memory_archi', 'memory_all'];
    var gameRows = (rows || [])
      .filter(function (r) {
        return game === 'memory'
          ? _memIds.indexOf(r.game_id) !== -1
          : r.game_id === game;
      })
      .sort(function (a, b) { return (b.score || 0) - (a.score || 0); });

    var lblEl = _el('jxLbGame');
    if (lblEl) lblEl.textContent = _GAME_LABEL[game] || game;

    var sc = _el('jxLbScroll');
    if (!sc) return;

    if (!gameRows.length) {
      sc.innerHTML = '<div style="height:29px;display:flex;align-items:center;font-size:11px;color:var(--muted);">Aucune partie encore 🎮</div>';
      return;
    }

    sc.innerHTML = '';

    gameRows.slice(0, 10).forEach(function (r, i) {
      var isGirl = r.player_role === 'girl';
      var name   = isGirl ? _girlName : _boyName;
      var userId = isGirl ? _girlUserId : _boyUserId;
      var role   = isGirl ? 'girl' : 'boy';

      var detail = '';
      if (r.moves && r.moves > 0) {
        detail = game === 'ocho'
          ? r.moves + ' manches'
          : r.moves + ' coups';
      } else if (r.time_seconds && r.time_seconds > 0) {
        var m = Math.floor(r.time_seconds / 60), s2 = r.time_seconds % 60;
        detail = m ? m + 'm' + String(s2).padStart(2, '0') + 's' : s2 + 's';
      }

      var row = document.createElement('div');
      row.className = 'jx-lb-row';

      var rank = document.createElement('div');
      rank.className = 'jx-lb-rank';
      rank.textContent = _MEDALS[i] || (i + 1);
      row.appendChild(rank);

      /* Avatar via probe async — zéro onerror inline */
      var avWrap = document.createElement('div');
      avWrap.className = 'jx-lb-av';
      _loadAvatarInto(avWrap, userId, role, 26);
      row.appendChild(avWrap);

      var nameEl = document.createElement('div');
      nameEl.className = 'jx-lb-name';
      nameEl.textContent = name;
      row.appendChild(nameEl);

      if (detail) {
        var det = document.createElement('div');
        det.className = 'jx-lb-detail';
        det.textContent = detail;
        row.appendChild(det);
      }

      var pts = document.createElement('div');
      pts.className = 'jx-lb-pts';
      pts.textContent = parseInt(r.score || 0).toLocaleString();
      row.appendChild(pts);

      // Badge mode pour les sous-modes Memory
      if (game === 'memory_all') {
        var badge = document.createElement('div');
        badge.textContent = '⚡ ALL';
        badge.style.cssText = 'font-size:9px;font-weight:700;background:linear-gradient(135deg,#f97316,#eab308);color:#fff;border-radius:6px;padding:2px 5px;margin-left:4px;white-space:nowrap;';
        row.appendChild(badge);
      }

      sc.appendChild(row);
    });

    sc.scrollTop = 0;
  }

  /* ── Score chip (ex: "5–3") ── */
  function _renderChip(game, rows, myRole) {
    var capGame = game.charAt(0).toUpperCase() + game.slice(1);
    var el = _el('jxC' + capGame);
    if (!el) return;

    // Pour 'memory' : agréger tous les sous-modes memory_*
    var memoryIds = ['memory', 'memory_classic', 'memory_echo', 'memory_archi', 'memory_all'];
    var gameRows = (rows || []).filter(function (r) {
      return game === 'memory'
        ? memoryIds.indexOf(r.game_id) !== -1
        : r.game_id === game;
    });
    if (!gameRows.length) { el.textContent = '—'; return; }

    var g, b;
    if (_MULTI_GAMES.indexOf(game) !== -1 || game === 'memory') {
      // Jeux multi : victoires via winner_role — une ligne girl par partie
      var multiRows = gameRows.filter(function (r) { return r.player_role === 'girl' && r.winner_role && r.winner_role !== 'draw'; });
      g = multiRows.filter(function (r) { return r.winner_role === 'girl'; }).length;
      b = multiRows.filter(function (r) { return r.winner_role === 'boy';  }).length;
    } else {
      // Jeux solo : nombre de parties par rôle
      g = gameRows.filter(function (r) { return r.player_role === 'girl'; }).length;
      b = gameRows.filter(function (r) { return r.player_role === 'boy';  }).length;
    }

    if (!g && !b) { el.textContent = '—'; return; }

    // Toujours girl à gauche, boy à droite — cohérent avec le header VS
    var leftScore  = g;
    var rightScore = b;
    var leftWins   = g >= b;
    el.innerHTML = leftWins
      ? '<span class="jx-w">' + leftScore + '</span>–' + rightScore
      : leftScore + '–<span class="jx-w">' + rightScore + '</span>';
  }

  /* ── Chargement principal ── */
  function jxLoadDashboard() {
    var u = typeof yamGetUser === 'function' ? yamGetUser() : null;
    if (!u || !u.couple_id) {
      var ldr = _el('jxLeader');
      if (ldr) ldr.textContent = 'Lie-toi à un partenaire 💑';
      return;
    }

    var coupleId = u.couple_id;
    var myRole   = u.role || (typeof getProfile === 'function' ? getProfile() : null);
    _girlName    = myRole === 'girl' ? (u.pseudo || '—') : (u.partner_pseudo || '—');
    _boyName     = myRole === 'boy'  ? (u.pseudo || '—') : (u.partner_pseudo || '—');

    if (myRole === 'girl') {
      _girlUserId = u.id         || null;
      _boyUserId  = u.partner_id || null;
    } else {
      _boyUserId  = u.id         || null;
      _girlUserId = u.partner_id || null;
    }

    var na = _el('jxNameA'); if (na) na.textContent = _girlName;
    var nb = _el('jxNameB'); if (nb) nb.textContent = _boyName;

    _updateAvatars();

    if (typeof sb2Fetch !== 'function') return;

    sb2Fetch('game_scores', 'couple_id=eq.' + coupleId + '&order=created_at.desc&limit=200')
      .then(function (rows) {
        _scoreCache = Array.isArray(rows) ? rows : [];
        var r = _scoreCache;

        if (!r.length) {
          var ldr = _el('jxLeader'); if (ldr) ldr.textContent = 'Aucune partie encore 🎮';
          var sa  = _el('jxScoreA'); if (sa)  sa.textContent  = '0';
          var sb2 = _el('jxScoreB'); if (sb2) sb2.textContent = '0';
          var pf0 = _el('jxProgFill'); if (pf0) pf0.style.width = '50%';
          _renderLb(_currentGame, []);
          return;
        }

        var wins   = _computeWins(r);
        var wGirl  = wins.girl;
        var wBoy   = wins.boy;
        var wTotal = wGirl + wBoy;
        var total = r.filter(function (x) {
          return _MULTI_GAMES.indexOf(x.game_id) !== -1
            ? x.player_role === 'girl'   // 1 ligne par partie en multi
            : true;                       // 1 ligne par partie en solo
        }).length;

        var elSA = _el('jxScoreA'), elSB = _el('jxScoreB');
        if (elSA) elSA.textContent = Math.round(wGirl);
        if (elSB) elSB.textContent = Math.round(wBoy);

        var elTot = _el('jxTotal');
        if (elTot) elTot.textContent = total + ' parties ce mois';

        var pct = wTotal > 0 ? Math.round((wGirl / wTotal) * 100) : 50;
        var pf = _el('jxProgFill'); if (pf) pf.style.width = pct + '%';

        var ldr = _el('jxLeader');
        var avA = _el('jxAvA'), avB = _el('jxAvB');
        if (wGirl > wBoy) {
          if (ldr) ldr.textContent = _girlName + ' mène 🔥';
          if (avA) avA.classList.add('jx-leading');
          if (avB) avB.classList.remove('jx-leading');
        } else if (wBoy > wGirl) {
          if (ldr) ldr.textContent = _boyName + ' mène 🔥';
          if (avB) avB.classList.add('jx-leading');
          if (avA) avA.classList.remove('jx-leading');
        } else {
          if (ldr) ldr.textContent = 'Égalité parfaite !';
          if (avA) avA.classList.remove('jx-leading');
          if (avB) avB.classList.remove('jx-leading');
        }

        // Jeu favori — compter les vraies parties (1 par partie en multi)
        var counts = {};
        r.forEach(function (x) {
          if (_MULTI_GAMES.indexOf(x.game_id) !== -1 && x.player_role !== 'girl') return;
          // Regrouper les sous-modes memory sous 'memory' pour le jeu favori
          var gid = x.game_id.indexOf('memory') === 0 ? 'memory' : x.game_id;
          counts[gid] = (counts[gid] || 0) + 1;
        });
        var fav = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0] || '—';
        var favEl = _el('jxFav');
        if (favEl) favEl.textContent = (_GAME_EMOJI[fav] || '🎮') + ' ' + (fav.charAt(0).toUpperCase() + fav.slice(1));

        var times = r.filter(function (x) { return x.game_id === fav && x.time_seconds > 0; }).map(function (x) { return x.time_seconds; });
        var avgEl = _el('jxAvg');
        if (avgEl) {
          if (times.length) {
            var avg = Math.round(times.reduce(function (a, b) { return a + b; }, 0) / times.length);
            var mm = Math.floor(avg / 60), ss = avg % 60;
            avgEl.textContent = mm ? mm + 'm' + String(ss).padStart(2, '0') + 's' : ss + 's';
          } else {
            avgEl.textContent = '—';
          }
        }

        // Streak — nombre de parties consécutives gagnées par le même joueur
        // Pour les jeux multi : winner_role. Pour les jeux solo : player_role.
        // On reconstruit une liste de "1 résultat par partie" triée par date desc.
        var partiesDesc = r
          .filter(function (x) {
            return _MULTI_GAMES.indexOf(x.game_id) !== -1 ? x.player_role === 'girl' : true;
          })
          .slice() // r est déjà trié created_at desc
          .map(function (x) {
            return _MULTI_GAMES.indexOf(x.game_id) !== -1 ? x.winner_role : x.player_role;
          })
          .filter(function (role) { return role && role !== 'draw'; });

        var streak = 0, lastR = null;
        for (var i = 0; i < partiesDesc.length; i++) {
          if (!lastR || partiesDesc[i] === lastR) { lastR = partiesDesc[i]; streak++; }
          else break;
        }
        var streakName = lastR === 'girl' ? _girlName : _boyName;
        var stEl = _el('jxStreak'), stLbl = _el('jxStreakLbl');
        if (stEl)  stEl.textContent  = '🔥 ' + streak + ' de suite';
        if (stLbl) stLbl.textContent = 'Série ' + streakName;

        var favLbl = _el('jxAvgLbl');
        if (favLbl) favLbl.textContent = 'Durée moy. ' + ((_GAME_LABEL[fav] || fav));

        // 'memory' agrège tous les sous-modes memory_* dans _renderChip
        ['ocho', 'skyjo', 'memory', 'pendu', 'puzzle', 'snake'].forEach(function (g) {
          _renderChip(g, r, myRole);
        });

        _renderLb(_currentGame, r);
      })
      .catch(function () {
        var ldr = _el('jxLeader');
        if (ldr) ldr.textContent = 'Erreur de chargement';
      });
  }

  /* ── Init ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initChipsDrag);
  } else {
    _initChipsDrag();
  }

  window.jxLoadDashboard = jxLoadDashboard;

  document.addEventListener('yam:session_ready', function () {
    setTimeout(jxLoadDashboard, 800);
  });

  /* ══════════════════════════════════════════════════════════════
     GAME LOBBY PRESENCE — bouton Jouer doré + badge "En jeu"
     Détecte en realtime si le partenaire attend dans un lobby.
     Tables surveillées : ocho_games, skyjo_games, memory_games
  ══════════════════════════════════════════════════════════════ */
  (function () {

    /* Tables multijoueur, chip dashboard et card gamesView associés */
    var LOBBY_TABLES = [
      { table: 'ocho_games',   chip: 'ocho',   card: 'ochoCard'     },
      { table: 'skyjo_games',  chip: 'skyjo',  card: 'skyjoCard'    },
      { table: 'memory_games', chip: 'memory', card: 'gvMemoryCard' },
    ];

    var _rtChannels  = [];   /* canaux Realtime ouverts */
    var _pollTimer   = null; /* fallback poll si RT indispo */
    var _activeChip  = null; /* chip actuellement marqué */
    var _activeEntry = null; /* entry LOBBY_TABLES active */

    /* ── Helpers DOM ── */
    function _getPlayBtn() { return document.getElementById('jxGamesMore'); }

    function _getChip(game) {
      return document.querySelector('#jxChips .jx-chip[data-game="' + game + '"]');
    }

    /* ── Helpers DOM ─ card gamesView ── */
    function _getCard(cardId) { return document.getElementById(cardId); }

    /* ── Activation : bouton doré + badge chip + badge card ── */
    function _activate(entry) {
      var btn = _getPlayBtn();
      if (btn) btn.classList.add('jx-play-btn--lobby');

      /* Retire l'ancien si le jeu a changé */
      if (_activeChip && _activeChip !== entry.chip) _deactivateEntry(_activeEntry);
      _activeChip  = entry.chip;
      _activeEntry = entry;

      /* Chip dashboard */
      var chip = _getChip(entry.chip);
      if (chip) {
        chip.classList.add('jx-chip--waiting');
        if (!chip.querySelector('.jx-chip-live-badge')) {
          var cb = document.createElement('span');
          cb.className = 'jx-chip-live-badge';
          cb.textContent = 'En jeu';
          chip.appendChild(cb);
        }
      }

      /* Card gamesView */
      var card = _getCard(entry.card);
      if (card) {
        card.classList.add('gv-game-card--waiting');
        if (!card.querySelector('.gv-card-live-badge')) {
          var gb = document.createElement('span');
          gb.className = 'gv-card-live-badge';
          gb.textContent = 'En attente';
          /* Insérer avant la flèche */
          var arrow = card.querySelector('.gv-game-card-arrow');
          if (arrow) card.insertBefore(gb, arrow);
          else card.appendChild(gb);
        }
      }
    }

    /* ── Désactivation complète ── */
    function _deactivate() {
      var btn = _getPlayBtn();
      if (btn) btn.classList.remove('jx-play-btn--lobby');
      if (_activeEntry) { _deactivateEntry(_activeEntry); _activeEntry = null; }
      _activeChip = null;
    }

    function _deactivateEntry(entry) {
      if (!entry) return;
      /* Chip */
      var chip = _getChip(entry.chip);
      if (chip) {
        chip.classList.remove('jx-chip--waiting');
        var cb = chip.querySelector('.jx-chip-live-badge');
        if (cb) cb.remove();
      }
      /* Card */
      var card = _getCard(entry.card);
      if (card) {
        card.classList.remove('gv-game-card--waiting');
        var gb = card.querySelector('.gv-card-live-badge');
        if (gb) gb.remove();
      }
    }

    /* ── Requête REST : cherche un lobby waiting du partenaire ── */
    function _checkLobbies() {
      var u = typeof yamGetUser === 'function' ? yamGetUser() : null;
      if (!u || !u.couple_id) return;
      var partnerRole = u.role === 'girl' ? 'boy' : 'girl';
      var coupleId    = u.couple_id;

      var found = false;
      var pending = LOBBY_TABLES.length;

      LOBBY_TABLES.forEach(function (entry) {
        fetch(
          SB_URL + '/rest/v1/' + entry.table +
          '?couple_id=eq.' + coupleId +
          '&status=eq.waiting' +
          '&created_by=eq.' + partnerRole +
          '&select=id&limit=1',
          { headers: sb2Headers() }
        )
        .then(function (r) { return r.json(); })
        .then(function (rows) {
          if (Array.isArray(rows) && rows.length > 0) {
            found = true;
            _activate(entry);
          }
          pending--;
          if (pending === 0 && !found) _deactivate();
        })
        .catch(function () { pending--; });
      });
    }

    /* ── Realtime : écoute INSERT/UPDATE/DELETE sur les 3 tables ── */
    function _subscribeRT() {
      if (!window._yamRT) return false;
      var u = typeof yamGetUser === 'function' ? yamGetUser() : null;
      if (!u || !u.couple_id) return false;

      _closeRT();

      LOBBY_TABLES.forEach(function (entry) {
        var ch = window._yamRT
          .channel('jx_lobby_' + entry.table + '_' + u.couple_id)
          .on('postgres_changes', {
            event:  '*',
            schema: 'public',
            table:  entry.table,
            filter: 'couple_id=eq.' + u.couple_id,
          }, function () {
            /* Un changement sur cette table → re-vérifier tous les lobbies */
            _checkLobbies();
          })
          .subscribe(function (status) {
            if (status === 'SUBSCRIBED') {
              yamLog('[LobbyPresence] RT ' + entry.table + ' connecté');
            } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].indexOf(status) !== -1) {
              yamLog('[LobbyPresence] RT ' + entry.table + ' ' + status + ' — fallback poll');
              _startFallbackPoll();
            }
          });
        _rtChannels.push(ch);
      });
      return true;
    }

    function _closeRT() {
      _rtChannels.forEach(function (ch) {
        try { if (window._yamRT) window._yamRT.removeChannel(ch); } catch (e) {}
      });
      _rtChannels = [];
    }

    /* ── Fallback poll (si Realtime indispo) ── */
    function _startFallbackPoll() {
      if (_pollTimer) return;
      _checkLobbies();
      _pollTimer = setInterval(_checkLobbies, 5000);
      yamLog('[LobbyPresence] fallback poll actif');
    }

    function _stopFallbackPoll() {
      if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
    }

    /* ── Init ── */
    function _init() {
      var u = typeof yamGetUser === 'function' ? yamGetUser() : null;
      if (!u || !u.couple_id) return;

      _checkLobbies();

      if (window._yamRT) {
        _subscribeRT();
        _stopFallbackPoll();
      } else {
        _startFallbackPoll();
      }
    }

    /* ── Accrochage sur setProfile — même pattern que app-account.js ── */
    /* setProfile est appelé par app-account.js après login ET après refresh,
       c'est le point d'entrée fiable utilisé par tous les modules YAM.       */
    var _origSetProfileLobby = window.setProfile;
    window.setProfile = function (g) {
      if (_origSetProfileLobby) _origSetProfileLobby.apply(this, arguments);
      setTimeout(_init, 800);
    };

    /* Si setProfile a déjà été appelé (page déjà chargée / refresh) */
    if (typeof getProfile === 'function' && getProfile()) {
      setTimeout(_init, 800);
    }

    /* Expose pour debug console */
    window._jxLobbyPresence = { check: _checkLobbies, init: _init };

  }());

})();
