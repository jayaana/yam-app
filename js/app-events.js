// ═══════════════════════════════════════════════════════════
// app-events.js — Système événements couple v2
// Tâches #10 + #37
// • Remplace le hardcode anniversaire mensuel du 29
// • Bannière uniquement sur l'onglet Accueil
// • Modal CRUD couple_events (create/edit/delete)
// • Badge clignotant J-3/J-1/J-0 sur l'icône Events
// • Push yamPushNotify() J-3, J-1, J-0
// • Bulle vidéo horaire activable/désactivable par event
// • Migration automatique de l'anniversaire mensuel
// ═══════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Constantes ────────────────────────────────────────────
  var SB2         = SB_URL + '/rest/v1/couple_events';
  var PUSH_KEY    = 'yam_events_push_';
  var MIGRATE_KEY = 'yam_anniv_migrated_';

  // ── Helpers ───────────────────────────────────────────────
  function _user()  { return (typeof yamGetUser   === 'function') ? yamGetUser()   : null; }
  function _cid()   { var u = _user(); return u ? u.couple_id : null; }

  function _todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0'+(d.getMonth()+1)).slice(-2) + '-' + ('0'+d.getDate()).slice(-2);
  }

  function _daysUntil(dateStr) {
    var t = new Date(); var today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    var target = new Date(dateStr + 'T12:00:00');
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
  }

  function _nextOccurrence(dateStr) {
    var t = new Date(); var ty = t.getFullYear();
    var d = new Date(dateStr + 'T12:00:00');
    var candidate = new Date(ty, d.getMonth(), d.getDate());
    var today     = new Date(ty, t.getMonth(), t.getDate());
    if (candidate < today) candidate = new Date(ty + 1, d.getMonth(), d.getDate());
    return candidate.toISOString().slice(0, 10);
  }

  function _monthsSince(dateStr) {
    var start = new Date(dateStr + 'T12:00:00'), now = new Date();
    return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  }

  function _escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ═══════════════════════════════════════════════════════════
  // 1. CONFETTIS
  // ═══════════════════════════════════════════════════════════
  function _launchConfettis() {
    var canvas = document.getElementById('annivCanvas'); if (!canvas) return;
    canvas.classList.add('visible'); canvas.style.opacity = '1';
    var ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    window.addEventListener('resize', function() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
    var COLORS = ['#f5c518','#ff6eb0','#a78bfa','#60a5fa','#34d399','#fb923c'];
    var pieces = [], running = true;
    function Piece() {
      this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height;
      this.w = 6+Math.random()*7; this.h = 3+Math.random()*4;
      this.rot = Math.random()*Math.PI*2; this.drot = (Math.random()-.5)*.12;
      this.vy = 1.2+Math.random()*2.2; this.vx = (Math.random()-.5)*1.2;
      this.color = COLORS[Math.floor(Math.random()*COLORS.length)]; this.alpha = .75+Math.random()*.25;
    }
    for (var i = 0; i < 55; i++) pieces.push(new Piece());
    setTimeout(function() {
      running = false;
      var op = 1, fade = setInterval(function() {
        op -= .04; canvas.style.opacity = Math.max(0, op);
        if (op <= 0) { clearInterval(fade); canvas.classList.remove('visible'); }
      }, 60);
    }, 12000);
    document.addEventListener('visibilitychange', function() { if (document.hidden) running = false; });
    (function loop() {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      for (var j = 0; j < pieces.length; j++) {
        var pc = pieces[j]; ctx.save(); ctx.globalAlpha = pc.alpha;
        ctx.translate(pc.x,pc.y); ctx.rotate(pc.rot); ctx.fillStyle = pc.color;
        ctx.fillRect(-pc.w/2,-pc.h/2,pc.w,pc.h); ctx.restore();
        pc.x += pc.vx; pc.y += pc.vy; pc.rot += pc.drot;
        if (pc.y > canvas.height+20) { if (running) pieces[j] = new Piece(); else { pieces.splice(j,1); j--; } }
      }
      if (pieces.length > 0) requestAnimationFrame(loop);
    })();
  }

  // ═══════════════════════════════════════════════════════════
  // 2. BANNIÈRE — uniquement sur l'onglet Accueil
  // ═══════════════════════════════════════════════════════════
  function _isHomeVisible() {
    var h = document.getElementById('yamHomeTab');
    return !!(h && getComputedStyle(h).display !== 'none');
  }

  function _showAnnivBanner(text) {
    if (!_isHomeVisible()) return;
    document.body.classList.add('anniv-mode');
    var banner = document.getElementById('annivBanner'), sub = document.getElementById('annivSub');
    if (banner) banner.classList.add('visible');
    if (sub)    sub.textContent = text;
    var sinceEl = document.querySelector('.counter-since');
    if (sinceEl) { sinceEl.innerHTML = '🎂 ' + text; sinceEl.style.color = '#f5c518'; sinceEl.style.fontWeight = '600'; }
    _launchConfettis();
  }

  function _hideAnnivBanner() {
    document.body.classList.remove('anniv-mode');
    var banner = document.getElementById('annivBanner');
    if (banner) banner.classList.remove('visible');
  }

  document.addEventListener('yam:tab_switched', function() {
    if (!_isHomeVisible()) _hideAnnivBanner();
    else setTimeout(_checkTodayEvents, 200);
  });

  // ═══════════════════════════════════════════════════════════
  // 3. MIGRATION AUTO — hardcode anniversaire → couple_events
  // ═══════════════════════════════════════════════════════════
  function _migrateAnniv(coupleId) {
    var startDate = window.startDate || (window.YAM_COUPLE && window.YAM_COUPLE.start_date);
    if (!startDate) return;
    var key = MIGRATE_KEY + coupleId;
    if (localStorage.getItem(key)) return;
    fetch(SB2 + '?couple_id=eq.' + coupleId + '&type=eq.anniversary&limit=1', { headers: sb2Headers() })
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(rows) {
      if (rows && rows.length > 0) { localStorage.setItem(key, '1'); return; }
      fetch(SB2, {
        method: 'POST',
        headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
        body: JSON.stringify({
          couple_id: coupleId, title: 'Mensiversaire 🩷', emoji: '🎂',
          date: startDate.slice(0, 10), is_recurring: true, type: 'anniversary',
          notes: 'Date de début du couple', assigned_to: 'both',
          days_before_reminder: 1, story_bubble_enabled: false
        })
      }).then(function() { localStorage.setItem(key, '1'); _loadEvents(); }).catch(function() {});
    }).catch(function() {});
  }

  // ═══════════════════════════════════════════════════════════
  // 4. PUSH NOTIFICATIONS — J-3, J-1, J-0
  // ═══════════════════════════════════════════════════════════
  function _checkPushReminders(events) {
    if (typeof yamPushNotify !== 'function') return;
    var today = _todayStr();
    events.forEach(function(ev) {
      var nextDate = ev.is_recurring ? _nextOccurrence(ev.date) : ev.date;
      var days     = _daysUntil(nextDate);
      var remind   = ev.days_before_reminder || 1;
      [0, 1, 3].filter(function(d) { return d === 0 || d <= remind; }).forEach(function(d) {
        if (days !== d) return;
        var pushKey = PUSH_KEY + ev.id + '_' + today + '_J' + d;
        if (localStorage.getItem(pushKey)) return;
        var msg = d === 0
          ? ev.emoji + ' Aujourd\'hui : ' + ev.title + ' ! 🎉'
          : ev.emoji + ' Dans ' + d + ' jour' + (d > 1 ? 's' : '') + ' : ' + ev.title;
        yamPushNotify({ title: '📅 Rappel événement', body: msg, tag: 'yam-event-' + ev.id, data: { url: '/yam-app/' } });
        localStorage.setItem(pushKey, '1');
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 5. BADGE CLIGNOTANT sur l'icône Events
  // ═══════════════════════════════════════════════════════════
  function _updateEventsBadge(events) {
    if (!document.getElementById('evtBadgeStyle')) {
      var s = document.createElement('style'); s.id = 'evtBadgeStyle';
      s.textContent = '@keyframes evtPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:.75}}';
      document.head.appendChild(s);
    }
    var btn = null;
    document.querySelectorAll('.home-feat-btn').forEach(function(b) { if (b.textContent.includes('Events')) btn = b; });
    if (!btn) return;
    btn.style.cursor = 'pointer'; btn.style.position = 'relative';
    btn.removeAttribute('title');
    btn.onclick = function() { window.openEventsModal(); };

    var soonest = null;
    events.forEach(function(ev) {
      var nd   = ev.is_recurring ? _nextOccurrence(ev.date) : ev.date;
      var days = _daysUntil(nd);
      if (days >= 0 && days <= 3 && (!soonest || days < soonest.days)) soonest = { ev: ev, days: days };
    });

    var old = btn.querySelector('.evt-alert-badge'); if (old) old.remove();
    if (!soonest) return;

    var badge = document.createElement('span');
    badge.className   = 'evt-alert-badge';
    badge.textContent = soonest.days === 0 ? '🎉' : 'J-' + soonest.days;
    var urgent = soonest.days <= 1;
    badge.style.cssText = 'position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;padding:0 5px;'
      + 'border-radius:10px;font-size:10px;font-weight:800;background:' + (urgent ? '#e75a7c' : '#f5a623') + ';'
      + 'color:#fff;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:10;'
      + 'line-height:1;animation:' + (urgent ? 'evtPulse 1s infinite' : 'none') + ';';
    btn.appendChild(badge);
  }

  // ═══════════════════════════════════════════════════════════
  // 6. VÉRIFICATION EVENTS DU JOUR
  // ═══════════════════════════════════════════════════════════
  var _eventsCache = [];

  function _checkTodayEvents() {
    _eventsCache.forEach(function(ev) {
      var nd   = ev.is_recurring ? _nextOccurrence(ev.date) : ev.date;
      var days = _daysUntil(nd);
      if (days !== 0) return;
      var label = ev.emoji + ' ' + ev.title;
      if (ev.type === 'anniversary') {
        var months = _monthsSince(ev.date);
        if (months < 1) return;
        if (months % 12 === 0) { var y = months/12; label = 'Ça fait ' + y + ' an' + (y>1?'s':'') + ' qu\'on s\'aime 🩷'; }
        else label = 'Ça fait maintenant ' + months + ' mois qu\'on s\'aime 🩷';
      }
      _showAnnivBanner(label);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 7. CHARGEMENT DES EVENTS
  // ═══════════════════════════════════════════════════════════
  function _loadEvents() {
    var coupleId = _cid(); if (!coupleId) return;
    fetch(SB2 + '?couple_id=eq.' + coupleId + '&order=date.asc', { headers: sb2Headers() })
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(events) {
      _eventsCache = Array.isArray(events) ? events : [];
      _checkTodayEvents();
      _checkPushReminders(_eventsCache);
      _updateEventsBadge(_eventsCache);
      _syncStoryBubble(_eventsCache);
    }).catch(function() {});
  }

  // ═══════════════════════════════════════════════════════════
  // 8. BULLE VIDÉO — toggle via couple_events
  // ═══════════════════════════════════════════════════════════
  function _syncStoryBubble(events) {
    window._storyBubbleEnabled = events.some(function(ev) { return ev.story_bubble_enabled; });
    if (typeof window._applyStoryState === 'function') window._applyStoryState();
  }

  // ═══════════════════════════════════════════════════════════
  // 9. STYLES MODAL
  // ═══════════════════════════════════════════════════════════
  function _injectModalStyles() {
    if (document.getElementById('eventsModalStyle')) return;
    var s = document.createElement('style'); s.id = 'eventsModalStyle';
    s.textContent = [
      '#eventsModal{position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.55);display:none;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}',
      '#eventsSheet{background:var(--s1);border-radius:24px 24px 0 0;width:100%;max-width:600px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;padding-bottom:env(safe-area-inset-bottom,0px)}',
      '.evt-hdr{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 14px;border-bottom:1px solid var(--border);flex-shrink:0}',
      '.evt-hdr-title{font-size:17px;font-weight:700;color:var(--text)}',
      '.evt-close-btn{background:var(--s2);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:15px;color:var(--muted);display:flex;align-items:center;justify-content:center}',
      '.evt-body{overflow-y:auto;flex:1;padding:16px 20px 24px}',
      '.evt-card{background:var(--s2);border-radius:14px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;gap:12px;cursor:pointer;border:1px solid var(--border)}',
      '.evt-card:active{opacity:.7}',
      '.evt-card-emoji{font-size:26px;flex-shrink:0}',
      '.evt-card-info{flex:1;min-width:0}',
      '.evt-card-title{font-size:14px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.evt-card-meta{font-size:12px;color:var(--muted);margin-top:2px}',
      '.evt-card-countdown{font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;flex-shrink:0;white-space:nowrap}',
      '.evt-countdown-today{background:#fef3c7;color:#d97706}',
      '.evt-countdown-soon{background:#fce7f3;color:#be185d}',
      '.evt-countdown-normal{background:var(--s2);color:var(--muted);border:1px solid var(--border)}',
      '.evt-add-btn{width:100%;padding:13px;border-radius:14px;border:2px dashed var(--border);background:transparent;color:var(--muted);font-size:14px;cursor:pointer;font-weight:600;margin-top:6px;box-sizing:border-box}',
      '.evt-section-title{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin:16px 0 8px}',
      '.evt-form{background:var(--s2);border-radius:14px;padding:16px;margin-top:8px}',
      '.evt-form label{font-size:12px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px;margin-top:12px}',
      '.evt-form label:first-of-type{margin-top:0}',
      '.evt-form input[type=text],.evt-form input[type=date],.evt-form select,.evt-form textarea{width:100%;background:var(--s1);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;color:var(--text);box-sizing:border-box;font-family:inherit;-webkit-appearance:none}',
      '.evt-form textarea{resize:vertical;min-height:60px}',
      '.evt-form-row{display:flex;gap:10px}',
      '.evt-form-row>div{flex:1;min-width:0}',
      '.evt-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-top:1px solid var(--border);margin-top:12px;gap:12px}',
      '.evt-toggle-lbl{font-size:13px;color:var(--text);font-weight:500}',
      '.evt-toggle-sub{font-size:11px;color:var(--muted);margin-top:2px}',
      '.evt-toggle{width:44px;height:26px;background:var(--border);border-radius:13px;position:relative;cursor:pointer;border:none;flex-shrink:0;transition:background .2s;-webkit-appearance:none}',
      '.evt-toggle.on{background:#e75a7c}',
      '.evt-toggle::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;background:#fff;border-radius:50%;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}',
      '.evt-toggle.on::after{transform:translateX(18px)}',
      '.evt-save-btn{width:100%;padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,#e75a7c,#9b59b6);color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-top:14px;box-sizing:border-box}',
      '.evt-save-btn:disabled{opacity:.5}',
      '.evt-del-btn{width:100%;padding:12px;border-radius:14px;border:1px solid #e75a7c;background:transparent;color:#e75a7c;font-size:14px;font-weight:600;cursor:pointer;margin-top:8px;box-sizing:border-box}',
      '.evt-empty{text-align:center;color:var(--muted);font-size:13px;padding:24px 0}',
      '.evt-bubble-card{background:var(--s2);border-radius:14px;padding:14px 16px;margin-bottom:8px}',
      '.evt-back-btn{display:flex;align-items:center;gap:8px;margin-bottom:16px;cursor:pointer;color:var(--accent);font-size:14px;font-weight:600}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ═══════════════════════════════════════════════════════════
  // 10. MODAL CRUD EVENTS
  // ═══════════════════════════════════════════════════════════
  var _editingEventId = null;

  function _injectModal() {
    if (document.getElementById('eventsModal')) return;
    _injectModalStyles();
    var modal = document.createElement('div'); modal.id = 'eventsModal';
    modal.innerHTML = '<div id="eventsSheet">'
      + '<div class="evt-hdr"><div class="evt-hdr-title">📅 Événements</div>'
      + '<button class="evt-close-btn" onclick="window.closeEventsModal()">✕</button></div>'
      + '<div class="evt-body" id="eventsModalBody"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) window.closeEventsModal(); });
  }

  window.openEventsModal = function() {
    _injectModal();
    document.getElementById('eventsModal').style.display = 'flex';
    _renderModalList();
  };

  window.closeEventsModal = function() {
    var m = document.getElementById('eventsModal'); if (m) m.style.display = 'none';
    _editingEventId = null;
  };

  function _renderModalList() {
    var body = document.getElementById('eventsModalBody'); if (!body) return;
    body.innerHTML = '<div class="evt-empty">Chargement...</div>';
    var coupleId = _cid();
    if (!coupleId) { body.innerHTML = '<p class="evt-empty">Connecte-toi pour gérer tes événements.</p>'; return; }
    fetch(SB2 + '?couple_id=eq.' + coupleId + '&order=date.asc', { headers: sb2Headers() })
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(events) {
      _eventsCache = Array.isArray(events) ? events : [];
      _updateEventsBadge(_eventsCache);
      _syncStoryBubble(_eventsCache);
      _buildModalList(_eventsCache, body);
    })
    .catch(function() { body.innerHTML = '<p style="color:#e05555;text-align:center">Erreur de chargement</p>'; });
  }

  function _buildModalList(events, body) {
    var upcoming = [], past = [];
    events.forEach(function(ev) {
      var nd = ev.is_recurring ? _nextOccurrence(ev.date) : ev.date;
      ev._nd = nd; ev._du = _daysUntil(nd);
      if (ev._du >= 0) upcoming.push(ev); else past.push(ev);
    });
    upcoming.sort(function(a, b) { return a._du - b._du; });

    var html = '';

    // Toggle bulle vidéo
    var bubbleOn = events.some(function(ev) { return ev.story_bubble_enabled; });
    html += '<div class="evt-bubble-card"><div class="evt-toggle-row" style="border:none;padding:0;margin:0">'
      + '<div><div class="evt-toggle-lbl">🎬 Bulle vidéo horaire</div>'
      + '<div class="evt-toggle-sub">Les 10 dernières min de chaque heure</div></div>'
      + '<button class="evt-toggle' + (bubbleOn ? ' on' : '') + '" id="evtBubbleToggle" onclick="window._evtToggleBubble(this)"></button>'
      + '</div></div>';

    // Prochains
    html += '<div class="evt-section-title">À venir</div>';
    if (!upcoming.length) {
      html += '<div class="evt-empty">Aucun événement à venir</div>';
    } else {
      upcoming.forEach(function(ev) {
        var cls   = ev._du === 0 ? 'evt-countdown-today' : ev._du <= 3 ? 'evt-countdown-soon' : 'evt-countdown-normal';
        var label = ev._du === 0 ? '🎉 Aujourd\'hui' : ev._du === 1 ? 'Demain' : 'Dans ' + ev._du + ' j.';
        var dl    = new Date(ev._nd+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'}) + (ev.is_recurring ? ' (annuel)' : '');
        html += '<div class="evt-card" onclick="window._evtOpenForm(\'' + ev.id + '\')">'
          + '<div class="evt-card-emoji">' + _escHtml(ev.emoji||'📅') + '</div>'
          + '<div class="evt-card-info"><div class="evt-card-title">' + _escHtml(ev.title) + '</div>'
          + '<div class="evt-card-meta">' + _escHtml(dl) + (ev.notes ? ' · ' + _escHtml(ev.notes.substring(0,30)) : '') + '</div></div>'
          + '<div class="evt-card-countdown ' + cls + '">' + label + '</div></div>';
      });
    }

    // Passés (non récurrents)
    var pastNR = past.filter(function(ev) { return !ev.is_recurring; });
    if (pastNR.length) {
      html += '<div class="evt-section-title">Passés</div>';
      pastNR.forEach(function(ev) {
        var dl = new Date(ev.date+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
        html += '<div class="evt-card" style="opacity:.5" onclick="window._evtOpenForm(\'' + ev.id + '\')">'
          + '<div class="evt-card-emoji">' + _escHtml(ev.emoji||'📅') + '</div>'
          + '<div class="evt-card-info"><div class="evt-card-title">' + _escHtml(ev.title) + '</div>'
          + '<div class="evt-card-meta">' + _escHtml(dl) + '</div></div></div>';
      });
    }

    html += '<button class="evt-add-btn" onclick="window._evtOpenForm(null)">+ Ajouter un événement</button>';
    body.innerHTML = html;
  }

  // ── Toggle bulle vidéo ────────────────────────────────────
  window._evtToggleBubble = function(btn) {
    var coupleId = _cid(); if (!coupleId) return;
    var isOn = btn.classList.contains('on');
    if (isOn) {
      fetch(SB2 + '?couple_id=eq.' + coupleId + '&story_bubble_enabled=eq.true', {
        method: 'PATCH',
        headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ story_bubble_enabled: false })
      }).then(function() {
        btn.classList.remove('on');
        _eventsCache.forEach(function(ev) { ev.story_bubble_enabled = false; });
        window._storyBubbleEnabled = false;
        if (typeof window._applyStoryState === 'function') window._applyStoryState();
      }).catch(function() {});
    } else {
      var target = _eventsCache[0];
      if (!target) {
        fetch(SB2, {
          method: 'POST',
          headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=representation' }),
          body: JSON.stringify({ couple_id: coupleId, title: 'Bulle vidéo', emoji: '🎬',
            date: _todayStr(), is_recurring: false, type: 'other', story_bubble_enabled: true, assigned_to: 'both' })
        }).then(function(r) { return r.json(); })
        .then(function(rows) {
          if (rows&&rows[0]) _eventsCache.push(rows[0]);
          btn.classList.add('on'); window._storyBubbleEnabled = true;
          if (typeof window._applyStoryState === 'function') window._applyStoryState();
        }).catch(function() {});
      } else {
        fetch(SB2 + '?id=eq.' + target.id + '&couple_id=eq.' + coupleId, {
          method: 'PATCH',
          headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
          body: JSON.stringify({ story_bubble_enabled: true })
        }).then(function() {
          btn.classList.add('on'); target.story_bubble_enabled = true;
          window._storyBubbleEnabled = true;
          if (typeof window._applyStoryState === 'function') window._applyStoryState();
        }).catch(function() {});
      }
    }
  };

  // ── Formulaire créer/modifier ─────────────────────────────
  window._evtOpenForm = function(id) {
    _editingEventId = id;
    var body = document.getElementById('eventsModalBody'); if (!body) return;
    var ev = id ? _eventsCache.filter(function(e) { return e.id === id; })[0] : null;
    body.innerHTML = '<div class="evt-back-btn" onclick="window._evtBackToList()">← '
      + (ev ? 'Modifier l\'événement' : 'Nouvel événement') + '</div>'
      + '<div class="evt-form">'
      + '<label>Titre</label>'
      + '<input id="evtFTitle" type="text" placeholder="Ex : Anniversaire de Marie" maxlength="60" value="' + _escHtml(ev ? ev.title : '') + '">'
      + '<div class="evt-form-row">'
      + '<div><label>Emoji</label><input id="evtFEmoji" type="text" placeholder="📅" maxlength="4" value="' + _escHtml(ev ? ev.emoji : '📅') + '"></div>'
      + '<div><label>Type</label><select id="evtFType">'
      + [['anniversary','Anniversaire'],['birthday','Fête'],['trip','Voyage'],['other','Autre']].map(function(t) {
          return '<option value="' + t[0] + '"' + (ev && ev.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
        }).join('') + '</select></div></div>'
      + '<label>Date</label><input id="evtFDate" type="date" value="' + _escHtml(ev ? ev.date : _todayStr()) + '">'
      + '<div class="evt-form-row">'
      + '<div><label>Assigné à</label><select id="evtFAssigned">'
      + [['both','Tous les deux'],['girl','Elle'],['boy','Lui']].map(function(t) {
          return '<option value="' + t[0] + '"' + (ev && ev.assigned_to === t[0] ? ' selected' : (!ev && t[0]==='both' ? ' selected' : '')) + '>' + t[1] + '</option>';
        }).join('') + '</select></div>'
      + '<div><label>Rappel</label><select id="evtFReminder">'
      + [['0','Jour J'],['1','J-1'],['3','J-3'],['7','J-7']].map(function(t) {
          return '<option value="' + t[0] + '"' + (ev && String(ev.days_before_reminder)===t[0] ? ' selected' : (!ev && t[0]==='1' ? ' selected' : '')) + '>' + t[1] + '</option>';
        }).join('') + '</select></div></div>'
      + '<label>Notes (optionnel)</label>'
      + '<textarea id="evtFNotes" placeholder="Infos supplémentaires...">' + _escHtml(ev ? (ev.notes||'') : '') + '</textarea>'
      + '<div class="evt-toggle-row"><div><div class="evt-toggle-lbl">Récurrent chaque année</div></div>'
      + '<button class="evt-toggle' + (ev && ev.is_recurring ? ' on' : '') + '" id="evtFRecurring" onclick="this.classList.toggle(\'on\')"></button></div>'
      + '</div>'
      + '<button class="evt-save-btn" id="evtSaveBtn" onclick="window._evtSave()">💾 Sauvegarder</button>'
      + (ev ? '<button class="evt-del-btn" onclick="window._evtDelete(\'' + ev.id + '\')">🗑 Supprimer</button>' : '');
  };

  window._evtBackToList = function() { _renderModalList(); };

  window._evtSave = function() {
    var coupleId = _cid(); if (!coupleId) return;
    var title = (document.getElementById('evtFTitle').value||'').trim();
    var emoji = (document.getElementById('evtFEmoji').value||'📅').trim();
    var type  = document.getElementById('evtFType').value;
    var date  = document.getElementById('evtFDate').value;
    var asgn  = document.getElementById('evtFAssigned').value;
    var rem   = parseInt(document.getElementById('evtFReminder').value)||1;
    var notes = (document.getElementById('evtFNotes').value||'').trim();
    var recur = document.getElementById('evtFRecurring').classList.contains('on');
    if (!title) { if (typeof showToast==='function') showToast('Le titre est obligatoire','error'); return; }
    if (!date)  { if (typeof showToast==='function') showToast('La date est obligatoire','error');  return; }
    var btn = document.getElementById('evtSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    var payload = { couple_id: coupleId, title: title, emoji: emoji, type: type, date: date,
      assigned_to: asgn, days_before_reminder: rem, notes: notes||null, is_recurring: recur };
    var req = _editingEventId
      ? fetch(SB2 + '?id=eq.' + _editingEventId + '&couple_id=eq.' + coupleId, {
          method:'PATCH', headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
          body:JSON.stringify(payload) })
      : fetch(SB2, { method:'POST', headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
          body:JSON.stringify(payload) });
    req.then(function(r) {
      if (!r.ok) throw new Error('Erreur '+r.status);
      if (typeof showToast==='function') showToast('Événement sauvegardé ✓','success',2000);
      _editingEventId = null; _loadEvents(); _renderModalList();
    }).catch(function() {
      if (typeof showToast==='function') showToast('Erreur de sauvegarde','error');
      if (btn) { btn.disabled=false; btn.textContent='💾 Sauvegarder'; }
    });
  };

  window._evtDelete = function(id) {
    if (!confirm('Supprimer cet événement ?')) return;
    var coupleId = _cid(); if (!coupleId) return;
    fetch(SB2 + '?id=eq.' + id + '&couple_id=eq.' + coupleId, { method:'DELETE', headers:sb2Headers() })
    .then(function() {
      if (typeof showToast==='function') showToast('Événement supprimé','success',1500);
      _editingEventId = null; _loadEvents(); _renderModalList();
    }).catch(function() { if (typeof showToast==='function') showToast('Erreur de suppression','error'); });
  };

  // ═══════════════════════════════════════════════════════════
  // 11. INIT
  // ═══════════════════════════════════════════════════════════
  function _init() {
    var coupleId = _cid(); if (!coupleId) return;
    _migrateAnniv(coupleId);
    _loadEvents();
    setTimeout(function() {
      document.querySelectorAll('.home-feat-btn').forEach(function(b) {
        if (b.textContent.includes('Events')) {
          b.style.cursor = 'pointer'; b.removeAttribute('title');
          b.onclick = function() { window.openEventsModal(); };
        }
      });
    }, 500);
  }

  document.addEventListener('yam:session_ready', function() { setTimeout(_init, 1500); });
  document.addEventListener('DOMContentLoaded',   function() { setTimeout(_init, 2500); });

  window._yamLoadEvents     = _loadEvents;
  window._yamDaysUntil      = _daysUntil;
  window._yamNextOccurrence = _nextOccurrence;

}());
