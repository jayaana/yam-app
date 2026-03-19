/* ═══════════════════════════════════════════════════
   app-jeux-dashboard.js
   Dashboard Mini-jeux — scores, VS, leaderboard chips
   Chargé après app-nav.js, avant app-inline.js
   Exposé via window.jxLoadDashboard (appelé par app-nav.js)
═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Constantes ── */
  var _GAME_EMOJI = { memory:'🎴', pendu:'🔤', puzzle:'🧩', snake:'🐍', ocho:'🎴', skyjo:'🃏' };
  var _GAME_LABEL = { ocho:'Ocho', skyjo:'Skyjo', memory:'Memory', pendu:'Pendu', puzzle:'Puzzle', snake:'Snake' };
  var _MEDALS     = ['🥇','🥈','🥉'];

  /* ── Supabase Storage base URL ── */
  var _SB_STORAGE = 'https://jstiwtbgkbedtldqjdhp.supabase.co/storage/v1/object/public/images/';

  /* ── État ── */
  var _currentGame = 'ocho';
  var _scoreCache  = null;
  var _girlName    = '—';
  var _boyName     = '—';
  var _girlAvatarUrl = null;
  var _boyAvatarUrl  = null;
  var _girlUserId    = null;
  var _boyUserId     = null;

  /* ── Helpers DOM ── */
  function _el(id) { return document.getElementById(id); }
  function _esc(s) { return typeof escHtml === 'function' ? escHtml(s) : s; }

  /* ── Avatar HTML : photo Supabase ou fallback avatar.png ── */
  function _avatarImg(userId, role, size) {
    size = size || 38;
    var fallback = 'img/' + (role === 'girl' ? 'avatar_girl' : 'avatar_boy') + '.png';
    /* Si on n'a pas encore l'userId (profil non chargé), on affiche le fallback */
    if (!userId) {
      return '<img src="' + fallback + '" '
        + 'style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;" '
        + 'onerror="this.src=\'' + fallback + '\'">';
    }
    var url = _SB_STORAGE + 'avatars/' + userId + '.jpg';
    return '<img src="' + url + '" '
      + 'style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;" '
      + 'onerror="this.src=\'' + fallback + '\'">';
  }

  /* ── Mise à jour des avatars dans le header VS ── */
  function _updateAvatars() {
    var avA = _el('jxAvA');
    var avB = _el('jxAvB');
    if (avA) {
      /* On remplace le contenu emoji par une vraie image, en gardant la couronne supprimée */
      avA.innerHTML = _avatarImg(_girlUserId, 'girl', 38);
    }
    if (avB) {
      avB.innerHTML = _avatarImg(_boyUserId, 'boy', 38);
    }
  }

  /* ── Sélection chip (FIX : plus d'onclick inline, appelé via delegation) ── */
  function jxSelChip(el) {
    /* el peut être un enfant du chip (span icon, span name…) — on remonte au .jx-chip */
    var chip = el.closest ? el.closest('.jx-chip') : el;
    if (!chip || !chip.dataset || !chip.dataset.game) return;
    document.querySelectorAll('.jx-chip').forEach(function (c) { c.classList.remove('jx-chip-on'); });
    chip.classList.add('jx-chip-on');
    _currentGame = chip.dataset.game;
    if (_scoreCache) _renderLb(_currentGame, _scoreCache);
  }
  window.jxSelChip = jxSelChip;

  /* ── Drag-to-scroll + click delegation chips (FIX CSP : aucun onclick inline) ── */
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

    /* Délégation click — remplace tous les onclick="jxSelChip(this)" inline */
    el.addEventListener('click', function (e) {
      if (moved) return; /* ignore si c'était un drag */
      var chip = e.target.closest ? e.target.closest('.jx-chip') : null;
      if (chip) jxSelChip(chip);
    });

    /* Touch : scroll natif OK, tap sur chip via touchend */
    el.addEventListener('touchend', function (e) {
      var chip = e.target.closest ? e.target.closest('.jx-chip') : null;
      if (chip) jxSelChip(chip);
    }, { passive: true });
  }

  /* ── Calcul victoires ──
     game_scores : chaque row = 1 joueur pour 1 partie.
     On regroupe par fenêtre de 5s (created_at) + game_id pour apparier girl vs boy.
     Le joueur avec le score le plus élevé dans la paire gagne.
     Si une seule entrée (solo), on compte quand même une victoire pour ce joueur.
  ── */
  function _computeWins(rows) {
    var wins = { girl: 0, boy: 0 };
    if (!rows || !rows.length) return wins;

    /* Trier par created_at croissant */
    var sorted = rows.slice().sort(function (a, b) {
      return new Date(a.created_at) - new Date(b.created_at);
    });

    /* Grouper : si deux rows ont même game_id et created_at à moins de 10s d'écart → même partie */
    var paired = [];
    var used   = {};
    for (var i = 0; i < sorted.length; i++) {
      if (used[i]) continue;
      var r = sorted[i];
      var partner = null;
      for (var j = i + 1; j < sorted.length; j++) {
        if (used[j]) continue;
        var s = sorted[j];
        if (s.game_id !== r.game_id) continue;
        var diff = Math.abs(new Date(s.created_at) - new Date(r.created_at));
        if (diff < 10000) { partner = s; used[j] = true; break; }
      }
      used[i] = true;
      if (partner) {
        paired.push([r, partner]);
      } else {
        paired.push([r]);
      }
    }

    paired.forEach(function (pair) {
      if (pair.length === 1) {
        /* Partie solo — victoire pour ce joueur */
        wins[pair[0].player_role] = (wins[pair[0].player_role] || 0) + 1;
      } else {
        var a = pair[0], b = pair[1];
        var scoreA = a.score || 0, scoreB = b.score || 0;
        if (scoreA > scoreB) {
          wins[a.player_role] = (wins[a.player_role] || 0) + 1;
        } else if (scoreB > scoreA) {
          wins[b.player_role] = (wins[b.player_role] || 0) + 1;
        } else {
          /* Égalité — point pour les deux */
          wins[a.player_role] = (wins[a.player_role] || 0) + 0.5;
          wins[b.player_role] = (wins[b.player_role] || 0) + 0.5;
        }
      }
    });

    return { girl: wins.girl || 0, boy: wins.boy || 0 };
  }

  /* ── Leaderboard : 2 lignes visibles, scroll interne ── */
  function _renderLb(game, rows) {
    var gameRows = (rows || [])
      .filter(function (r) { return r.game_id === game; })
      .sort(function (a, b) { return (b.score || 0) - (a.score || 0); });

    var lblEl = _el('jxLbGame');
    if (lblEl) lblEl.textContent = _GAME_LABEL[game] || game;

    var sc = _el('jxLbScroll');
    if (!sc) return;

    if (!gameRows.length) {
      sc.innerHTML = '<div style="height:29px;display:flex;align-items:center;font-size:11px;color:var(--muted);">Aucune partie encore 🎮</div>';
      return;
    }

    sc.innerHTML = gameRows.slice(0, 10).map(function (r, i) {
      var isGirl = r.player_role === 'girl';
      var name   = isGirl ? _girlName : _boyName;
      var userId = isGirl ? _girlUserId : _boyUserId;
      var role   = isGirl ? 'girl' : 'boy';
      var detail = '';
      if (r.moves && r.moves > 0) {
        detail = r.moves + ' coups';
      } else if (r.time_seconds && r.time_seconds > 0) {
        var m = Math.floor(r.time_seconds / 60), s = r.time_seconds % 60;
        detail = m ? m + 'm' + String(s).padStart(2, '0') + 's' : s + 's';
      }
      return '<div class="jx-lb-row">'
        + '<div class="jx-lb-rank">' + (_MEDALS[i] || (i + 1)) + '</div>'
        + '<div class="jx-lb-av">' + _avatarImg(userId, role, 26) + '</div>'
        + '<div class="jx-lb-name">' + _esc(name) + '</div>'
        + (detail ? '<div class="jx-lb-detail">' + detail + '</div>' : '')
        + '<div class="jx-lb-pts">' + parseInt(r.score || 0).toLocaleString() + '</div>'
        + '</div>';
    }).join('');
    sc.scrollTop = 0;
  }

  /* ── Score chip (ex: "5–3") ── */
  function _renderChip(game, rows, myRole) {
    var capGame = game.charAt(0).toUpperCase() + game.slice(1);
    var el = _el('jxC' + capGame);
    if (!el) return;
    var g = (rows || []).filter(function (r) { return r.game_id === game && r.player_role === 'girl'; }).length;
    var b = (rows || []).filter(function (r) { return r.game_id === game && r.player_role === 'boy';  }).length;
    var me  = myRole === 'girl' ? g : b;
    var her = myRole === 'girl' ? b : g;
    if (!me && !her) { el.textContent = '—'; return; }
    el.innerHTML = me >= her
      ? '<span class="jx-w">' + me + '</span>–' + her
      : me + '–<span class="jx-w">' + her + '</span>';
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

    /* IDs pour les avatars */
    if (myRole === 'girl') {
      _girlUserId = u.id || null;
      _boyUserId  = u.partner_id || null;
    } else {
      _boyUserId  = u.id || null;
      _girlUserId = u.partner_id || null;
    }

    /* Noms */
    var na = _el('jxNameA'); if (na) na.textContent = _girlName;
    var nb = _el('jxNameB'); if (nb) nb.textContent = _boyName;

    /* Avatars photos */
    _updateAvatars();

    if (typeof sb2Fetch !== 'function') return;

    sb2Fetch('game_scores', 'couple_id=eq.' + coupleId + '&order=created_at.desc&limit=200')
      .then(function (rows) {
        _scoreCache = Array.isArray(rows) ? rows : [];
        var r = _scoreCache;

        /* Scores vides */
        if (!r.length) {
          var ldr = _el('jxLeader'); if (ldr) ldr.textContent = 'Aucune partie encore 🎮';
          var sa = _el('jxScoreA'); if (sa) sa.textContent = '0';
          var sb2 = _el('jxScoreB'); if (sb2) sb2.textContent = '0';
          var pf0 = _el('jxProgFill'); if (pf0) pf0.style.width = '50%';
          _renderLb(_currentGame, []);
          return;
        }

        /* ── Victoires réelles (FIX barre de progression) ── */
        var wins    = _computeWins(r);
        var wGirl   = wins.girl;
        var wBoy    = wins.boy;
        var total   = r.length;
        var wTotal  = wGirl + wBoy;

        var elSA = _el('jxScoreA'), elSB = _el('jxScoreB');
        if (elSA) elSA.textContent = Math.round(wGirl);
        if (elSB) elSB.textContent = Math.round(wBoy);

        var elTot = _el('jxTotal');
        if (elTot) elTot.textContent = total + ' parties ce mois';

        /* Barre progression basée sur les victoires réelles */
        var pct = wTotal > 0 ? Math.round((wGirl / wTotal) * 100) : 50;
        var pf = _el('jxProgFill'); if (pf) pf.style.width = pct + '%';

        /* Leader */
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

        /* Jeu favori */
        var counts = {};
        r.forEach(function (x) { counts[x.game_id] = (counts[x.game_id] || 0) + 1; });
        var fav = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0] || '—';
        var favEl = _el('jxFav');
        if (favEl) favEl.textContent = (_GAME_EMOJI[fav] || '🎮') + ' ' + (fav.charAt(0).toUpperCase() + fav.slice(1));

        /* Durée moyenne */
        var times = r.filter(function (x) { return x.time_seconds > 0; }).map(function (x) { return x.time_seconds; });
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

        /* Série en cours */
        var streak = 0, lastR = null;
        for (var i = 0; i < r.length; i++) {
          if (!lastR || r[i].player_role === lastR) { lastR = r[i].player_role; streak++; }
          else break;
        }
        var streakName = lastR === 'girl' ? _girlName : _boyName;
        var stEl = _el('jxStreak'), stLbl = _el('jxStreakLbl');
        if (stEl)  stEl.textContent  = '🔥 ' + streak + ' de suite';
        if (stLbl) stLbl.textContent = 'Série ' + streakName;

        /* Chips scores */
        ['ocho', 'skyjo', 'memory', 'pendu', 'puzzle', 'snake'].forEach(function (g) {
          _renderChip(g, r, myRole);
        });

        /* Leaderboard */
        _renderLb(_currentGame, r);
      })
      .catch(function () {
        var ldr = _el('jxLeader');
        if (ldr) ldr.textContent = 'Erreur de chargement';
      });
  }

  /* ── Init drag chips + delegation click au chargement DOM ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initChipsDrag);
  } else {
    _initChipsDrag();
  }

  /* ── Exposition globale ── */
  window.jxLoadDashboard = jxLoadDashboard;

  /* ── Fallback session ready ── */
  document.addEventListener('yam:session_ready', function () {
    setTimeout(jxLoadDashboard, 800);
  });

})();
