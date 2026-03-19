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

  /* ── État ── */
  var _currentGame = 'ocho';
  var _scoreCache  = null;
  var _girlName    = '—';
  var _boyName     = '—';

  /* ── Helpers DOM ── */
  function _el(id) { return document.getElementById(id); }
  function _esc(s) { return typeof escHtml === 'function' ? escHtml(s) : s; }

  /* ── Sélection chip ── */
  function jxSelChip(el) {
    document.querySelectorAll('.jx-chip').forEach(function (c) { c.classList.remove('jx-chip-on'); });
    el.classList.add('jx-chip-on');
    _currentGame = el.dataset.game;
    if (_scoreCache) _renderLb(_currentGame, _scoreCache);
  }
  window.jxSelChip = jxSelChip;

  /* ── Drag-to-scroll chips ── */
  function _initChipsDrag() {
    var el = _el('jxChips');
    if (!el) return;
    var d = false, sx = 0, sl = 0;
    el.addEventListener('mousedown',  function (e) { d = true; sx = e.pageX - el.offsetLeft; sl = el.scrollLeft; });
    el.addEventListener('mouseleave', function ()  { d = false; });
    el.addEventListener('mouseup',    function ()  { d = false; });
    el.addEventListener('mousemove',  function (e) {
      if (!d) return;
      e.preventDefault();
      el.scrollLeft = sl - (e.pageX - el.offsetLeft - sx);
    });
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
      var avBg   = isGirl ? 'rgba(254,243,226,.9)' : 'rgba(234,243,255,.9)';
      var em     = isGirl ? '😺' : '🐻';
      var detail = '';
      if (r.moves && r.moves > 0) {
        detail = r.moves + ' coups';
      } else if (r.time_seconds && r.time_seconds > 0) {
        var m = Math.floor(r.time_seconds / 60), s = r.time_seconds % 60;
        detail = m ? m + 'm' + String(s).padStart(2, '0') + 's' : s + 's';
      }
      return '<div class="jx-lb-row">'
        + '<div class="jx-lb-rank">' + (_MEDALS[i] || (i + 1)) + '</div>'
        + '<div class="jx-lb-av" style="background:' + avBg + '">' + em + '</div>'
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

    /* Noms */
    var na = _el('jxNameA'); if (na) na.textContent = _girlName;
    var nb = _el('jxNameB'); if (nb) nb.textContent = _boyName;

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
          _renderLb(_currentGame, []);
          return;
        }

        /* Comptages */
        var totalGirl = r.filter(function (x) { return x.player_role === 'girl'; }).length;
        var totalBoy  = r.filter(function (x) { return x.player_role === 'boy';  }).length;
        var total     = r.length;
        var elSA = _el('jxScoreA'), elSB = _el('jxScoreB');
        if (elSA) elSA.textContent = totalGirl;
        if (elSB) elSB.textContent = totalBoy;
        var elTot = _el('jxTotal'); if (elTot) elTot.textContent = total + ' parties ce mois';

        /* Barre progression */
        var pct = total > 0 ? Math.round((totalGirl / total) * 100) : 50;
        var pf = _el('jxProgFill'); if (pf) pf.style.width = pct + '%';

        /* Leader + couronne */
        var ldr = _el('jxLeader');
        var avA = _el('jxAvA'), avB = _el('jxAvB');
        if (totalGirl > totalBoy) {
          if (ldr) ldr.textContent = _girlName + ' mène 🔥';
          if (avA) avA.classList.add('jx-leading');
          if (avB) avB.classList.remove('jx-leading');
        } else if (totalBoy > totalGirl) {
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

        /* Chips */
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

  /* ── Init drag chips au chargement DOM ── */
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
