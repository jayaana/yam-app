// ═══════════════════════════════════════════════════════════
// app-events.js — Système événements couple v2
// Tâches #10 + #37 — 100% CSP-compliant (zéro onclick inline)
// ═══════════════════════════════════════════════════════════

(function () {
  'use strict';

  var SB2         = SB_URL + '/rest/v1/couple_events';
  var PUSH_KEY    = 'yam_events_push_';
  var MIGRATE_KEY = 'yam_anniv_migrated_';

  // ── Helpers ───────────────────────────────────────────────
  function _user()  { return (typeof yamGetUser === 'function') ? yamGetUser() : null; }
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
    var today = new Date(ty, t.getMonth(), t.getDate());
    if (candidate < today) candidate = new Date(ty + 1, d.getMonth(), d.getDate());
    return candidate.toISOString().slice(0, 10);
  }
  function _monthsSince(dateStr) {
    var start = new Date(dateStr + 'T12:00:00'), now = new Date();
    return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  }
  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _toast(msg, type) { if (typeof showToast === 'function') showToast(msg, type || 'info', 2000); }

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
  // Config visuelle par type d'event
  var _eventTypeConfig = {
    anniversary: { bg: 'linear-gradient(135deg,#f5c518,#e75a7c)', icon: '🎂', color: '#f5c518', confetti: true,  pulse: true  },
    birthday:    { bg: 'linear-gradient(135deg,#a78bfa,#60a5fa)', icon: '🎉', color: '#a78bfa', confetti: true,  pulse: true  },
    trip:        { bg: 'linear-gradient(135deg,#34d399,#60a5fa)', icon: '✈️', color: '#34d399', confetti: false, pulse: false },
    other:       { bg: 'linear-gradient(135deg,#94a3b8,#64748b)', icon: '📅', color: '#94a3b8', confetti: false, pulse: false }
  };

  function _showEventBanner(text, type) {
    if (!_isHomeVisible()) return;
    var cfg = _eventTypeConfig[type] || _eventTypeConfig.other;
    document.body.classList.add('anniv-mode');
    var banner = document.getElementById('annivBanner'), sub = document.getElementById('annivSub');
    if (banner) { banner.style.background = cfg.bg; banner.classList.add('visible'); }
    if (sub) sub.textContent = text;
    var sinceEl = document.querySelector('.counter-since');
    if (sinceEl) {
      sinceEl.innerHTML = cfg.icon + ' ' + text;
      sinceEl.style.color = cfg.color;
      sinceEl.style.fontWeight = '600';
      sinceEl.style.animation = cfg.pulse ? 'evtPulse 1.4s ease-in-out infinite' : 'none';
    }
    if (cfg.confetti) _launchConfettis();
  }
  function _hideAnnivBanner() {
    document.body.classList.remove('anniv-mode');
    var banner = document.getElementById('annivBanner');
    if (banner) { banner.classList.remove('visible'); banner.style.background = ''; }
    var sinceEl = document.querySelector('.counter-since');
    if (sinceEl) { sinceEl.style.color = ''; sinceEl.style.fontWeight = ''; sinceEl.style.animation = ''; }
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
      s.textContent = '@keyframes evtPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}';
      document.head.appendChild(s);
    }
    var btn = null;
    document.querySelectorAll('.home-feat-btn').forEach(function(b) { if (b.textContent.includes('Events')) btn = b; });
    if (!btn) return;
    btn.style.cursor = 'pointer'; btn.style.position = 'relative'; btn.removeAttribute('title');

    var soonest = null;
    events.forEach(function(ev) {
      var nd = ev.is_recurring ? _nextOccurrence(ev.date) : ev.date;
      var days = _daysUntil(nd);
      if (days >= 0 && days <= 3 && (!soonest || days < soonest.days)) soonest = { days: days };
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
      var nd = ev.is_recurring ? _nextOccurrence(ev.date) : ev.date;
      if (_daysUntil(nd) !== 0) return;
      var label = ev.emoji + ' ' + ev.title;
      if (ev.type === 'anniversary') {
        var months = _monthsSince(ev.date);
        if (months < 1) return;
        if (months % 12 === 0) { var y = months/12; label = 'Ça fait ' + y + ' an' + (y > 1 ? 's' : '') + ' qu\'on s\'aime 🩷'; }
        else label = 'Ça fait maintenant ' + months + ' mois qu\'on s\'aime 🩷';
      }
      _showEventBanner(label, ev.type);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 7. CHARGEMENT
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
      _syncStoryBubble();
    }).catch(function() {});
  }

  // ═══════════════════════════════════════════════════════════
  // 8. BULLE VIDÉO — lire depuis photo_descs
  // ═══════════════════════════════════════════════════════════
  function _syncStoryBubble() {
    var coupleId = _cid(); if (!coupleId) return;
    fetch(SB_URL + '/rest/v1/photo_descs?couple_id=eq.' + coupleId + '&category=eq.settings&slot=eq.story_bubble&limit=1', { headers: sb2Headers() })
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(rows) {
      window._storyBubbleEnabled = !!(rows && rows[0] && rows[0].description === 'true');
      if (typeof window._applyStoryState === 'function') window._applyStoryState();
    }).catch(function() {});
  }

  // ═══════════════════════════════════════════════════════════
  // 9. STYLES MODAL
  // ═══════════════════════════════════════════════════════════
  function _injectStyles() {
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
      '.evt-card-cd{font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;flex-shrink:0;white-space:nowrap}',
      '.evt-cd-today{background:#fef3c7;color:#d97706}',
      '.evt-cd-soon{background:#fce7f3;color:#be185d}',
      '.evt-cd-normal{background:var(--s1);color:var(--muted);border:1px solid var(--border)}',
      '.evt-add-btn{width:100%;padding:13px;border-radius:14px;border:2px dashed var(--border);background:transparent;color:var(--muted);font-size:14px;cursor:pointer;font-weight:600;margin-top:6px;box-sizing:border-box;display:block}',
      '.evt-sec{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin:16px 0 8px}',
      '.evt-form-wrap{background:var(--s2);border-radius:14px;padding:16px;margin-top:8px}',
      '.evt-lbl{font-size:12px;font-weight:600;color:var(--muted);display:block;margin-bottom:4px;margin-top:12px}',
      '.evt-lbl:first-of-type{margin-top:0}',
      '.evt-inp{width:100%;background:var(--s1);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;color:var(--text);box-sizing:border-box;font-family:inherit;-webkit-appearance:none;display:block}',
      '.evt-textarea{resize:vertical;min-height:60px}',
      '.evt-row{display:flex;gap:10px}',
      '.evt-row>div{flex:1;min-width:0}',
      '.evt-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-top:1px solid var(--border);margin-top:12px;gap:12px}',
      '.evt-toggle-lbl{font-size:13px;color:var(--text);font-weight:500}',
      '.evt-toggle-sub{font-size:11px;color:var(--muted);margin-top:2px}',
      '.evt-toggle{width:44px;height:26px;background:var(--border);border-radius:13px;position:relative;cursor:pointer;border:none;flex-shrink:0;transition:background .2s}',
      '.evt-toggle.on{background:#e75a7c}',
      '.evt-toggle::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;background:#fff;border-radius:50%;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}',
      '.evt-toggle.on::after{transform:translateX(18px)}',
      '.evt-save-btn{width:100%;padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,#e75a7c,#9b59b6);color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-top:14px;box-sizing:border-box;display:block}',
      '.evt-save-btn:disabled{opacity:.5}',
      '.evt-del-btn{width:100%;padding:12px;border-radius:14px;border:1px solid #e75a7c;background:transparent;color:#e75a7c;font-size:14px;font-weight:600;cursor:pointer;margin-top:8px;box-sizing:border-box;display:block}',
      '.evt-empty{text-align:center;color:var(--muted);font-size:13px;padding:24px 0}',
      '.evt-bubble-card{background:var(--s2);border-radius:14px;padding:14px 16px;margin-bottom:8px}',
      '.evt-back{display:flex;align-items:center;gap:8px;margin-bottom:16px;cursor:pointer;color:var(--accent);font-size:14px;font-weight:600}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ═══════════════════════════════════════════════════════════
  // 10. MODAL — injection + délégation d'événements (CSP-safe)
  // ═══════════════════════════════════════════════════════════
  var _editingId = null;

  function _injectModal() {
    if (document.getElementById('eventsModal')) return;
    _injectStyles();

    var modal = document.createElement('div'); modal.id = 'eventsModal';
    // Sheet
    var sheet = document.createElement('div'); sheet.id = 'eventsSheet';
    // Header
    var hdr = document.createElement('div'); hdr.className = 'evt-hdr';
    var hdrTitle = document.createElement('div'); hdrTitle.className = 'evt-hdr-title'; hdrTitle.textContent = '📅 Événements';
    var closeBtn = document.createElement('button'); closeBtn.className = 'evt-close-btn'; closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', function() { _closeModal(); });
    hdr.appendChild(hdrTitle); hdr.appendChild(closeBtn);
    // Body
    var body = document.createElement('div'); body.id = 'eventsModalBody'; body.className = 'evt-body';
    sheet.appendChild(hdr); sheet.appendChild(body);
    modal.appendChild(sheet);
    document.body.appendChild(modal);

    // Fermer en cliquant dehors
    modal.addEventListener('click', function(e) { if (e.target === modal) _closeModal(); });
  }

  function _closeModal() {
    var m = document.getElementById('eventsModal'); if (m) m.style.display = 'none';
    _editingId = null;
  }

  window.openEventsModal = function() {
    _injectModal();
    document.getElementById('eventsModal').style.display = 'flex';
    _renderList();
  };
  window.closeEventsModal = _closeModal;

  // ── Rendu liste ───────────────────────────────────────────
  function _renderList() {
    var body = document.getElementById('eventsModalBody'); if (!body) return;
    body.innerHTML = '';
    var loading = document.createElement('div'); loading.className = 'evt-empty'; loading.textContent = 'Chargement...';
    body.appendChild(loading);
    var coupleId = _cid();
    if (!coupleId) { body.innerHTML = ''; var p = document.createElement('p'); p.className = 'evt-empty'; p.textContent = 'Connecte-toi pour gérer tes événements.'; body.appendChild(p); return; }

    fetch(SB2 + '?couple_id=eq.' + coupleId + '&order=date.asc', { headers: sb2Headers() })
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(events) {
      _eventsCache = Array.isArray(events) ? events : [];
      _updateEventsBadge(_eventsCache);
      _syncStoryBubble();
      _buildList(_eventsCache, body);
    })
    .catch(function() { body.innerHTML = ''; var p = document.createElement('p'); p.style.color='#e05555'; p.style.textAlign='center'; p.textContent='Erreur de chargement'; body.appendChild(p); });
  }

  function _buildList(events, body) {
    body.innerHTML = '';

    // Toggle bulle vidéo — état depuis window._storyBubbleEnabled (chargé depuis photo_descs)
    var bubbleOn = !!window._storyBubbleEnabled;
    var bubbleCard = document.createElement('div'); bubbleCard.className = 'evt-bubble-card';
    var bubbleRow = document.createElement('div'); bubbleRow.className = 'evt-toggle-row'; bubbleRow.style.cssText = 'border:none;padding:0;margin:0';
    var bubbleLeft = document.createElement('div');
    var bubbleLbl = document.createElement('div'); bubbleLbl.className = 'evt-toggle-lbl'; bubbleLbl.textContent = '🎬 Bulle vidéo horaire';
    var bubbleSub = document.createElement('div'); bubbleSub.className = 'evt-toggle-sub'; bubbleSub.textContent = 'Les 10 dernières min de chaque heure';
    bubbleLeft.appendChild(bubbleLbl); bubbleLeft.appendChild(bubbleSub);
    var bubbleToggle = document.createElement('button'); bubbleToggle.className = 'evt-toggle' + (bubbleOn ? ' on' : '');
    bubbleToggle.id = 'evtBubbleToggle';
    bubbleToggle.addEventListener('click', function() { _toggleBubble(this); });
    bubbleRow.appendChild(bubbleLeft); bubbleRow.appendChild(bubbleToggle);
    bubbleCard.appendChild(bubbleRow);
    body.appendChild(bubbleCard);

    // Section "À venir"
    var upcoming = [], past = [];
    events.forEach(function(ev) {
      var nd = ev.is_recurring ? _nextOccurrence(ev.date) : ev.date;
      ev._nd = nd; ev._du = _daysUntil(nd);
      if (ev._du >= 0) upcoming.push(ev); else past.push(ev);
    });
    upcoming.sort(function(a, b) { return a._du - b._du; });

    var secUp = document.createElement('div'); secUp.className = 'evt-sec'; secUp.textContent = 'À venir';
    body.appendChild(secUp);

    if (!upcoming.length) {
      var empty = document.createElement('div'); empty.className = 'evt-empty'; empty.textContent = 'Aucun événement à venir';
      body.appendChild(empty);
    } else {
      upcoming.forEach(function(ev) { body.appendChild(_buildCard(ev)); });
    }

    // Section "Passés" (non récurrents)
    var pastNR = past.filter(function(ev) { return !ev.is_recurring; });
    if (pastNR.length) {
      var secPast = document.createElement('div'); secPast.className = 'evt-sec'; secPast.textContent = 'Passés';
      body.appendChild(secPast);
      pastNR.forEach(function(ev) { var c = _buildCard(ev); c.style.opacity = '0.5'; body.appendChild(c); });
    }

    // Bouton ajouter
    var addBtn = document.createElement('button'); addBtn.className = 'evt-add-btn'; addBtn.textContent = '+ Ajouter un événement';
    addBtn.addEventListener('click', function() { _openForm(null); });
    body.appendChild(addBtn);
  }

  function _buildCard(ev) {
    var card = document.createElement('div'); card.className = 'evt-card';
    var emojiEl = document.createElement('div'); emojiEl.className = 'evt-card-emoji'; emojiEl.textContent = ev.emoji || '📅';
    var info = document.createElement('div'); info.className = 'evt-card-info';
    var title = document.createElement('div'); title.className = 'evt-card-title'; title.textContent = ev.title;
    var meta = document.createElement('div'); meta.className = 'evt-card-meta';
    var dl = new Date((ev._nd || ev.date)+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
    if (ev.is_recurring) dl += ' (annuel)';
    meta.textContent = dl + (ev.notes ? ' · ' + ev.notes.substring(0,30) : '');
    info.appendChild(title); info.appendChild(meta);
    var cd = document.createElement('div'); cd.className = 'evt-card-cd';
    var du = typeof ev._du !== 'undefined' ? ev._du : _daysUntil(ev._nd || ev.date);
    if (du === 0)      { cd.textContent = '🎉 Aujourd\'hui'; cd.classList.add('evt-cd-today'); }
    else if (du === 1) { cd.textContent = 'Demain';          cd.classList.add('evt-cd-soon'); }
    else if (du <= 3)  { cd.textContent = 'Dans ' + du + ' j.'; cd.classList.add('evt-cd-soon'); }
    else               { cd.textContent = 'Dans ' + du + ' j.'; cd.classList.add('evt-cd-normal'); }
    card.appendChild(emojiEl); card.appendChild(info); card.appendChild(cd);
    card.addEventListener('click', function() { _openForm(ev.id); });
    return card;
  }

  // ── Toggle bulle vidéo ────────────────────────────────────
  // Stocké dans photo_descs (category='settings', slot='story_bubble')
  // Jamais dans couple_events pour éviter les notifications parasites
  var SB_PD = SB_URL + '/rest/v1/photo_descs';

  function _getBubbleSetting(coupleId, cb) {
    fetch(SB_PD + '?couple_id=eq.' + coupleId + '&category=eq.settings&slot=eq.story_bubble&limit=1', { headers: sb2Headers() })
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(rows) { cb(rows && rows[0] ? rows[0].description === 'true' : false, rows && rows[0] ? rows[0].id : null); })
    .catch(function() { cb(false, null); });
  }

  function _saveBubbleSetting(coupleId, value, existingId) {
    if (existingId) {
      return fetch(SB_PD + '?id=eq.' + existingId, {
        method: 'PATCH', headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ description: value ? 'true' : 'false' })
      });
    } else {
      return fetch(SB_PD, {
        method: 'POST', headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ couple_id: coupleId, category: 'settings', slot: 'story_bubble', description: value ? 'true' : 'false' })
      });
    }
  }

  function _toggleBubble(btn) {
    var coupleId = _cid(); if (!coupleId) return;
    var newVal = !btn.classList.contains('on');
    _getBubbleSetting(coupleId, function(currentVal, rowId) {
      _saveBubbleSetting(coupleId, newVal, rowId).then(function() {
        if (newVal) btn.classList.add('on'); else btn.classList.remove('on');
        window._storyBubbleEnabled = newVal;
        if (typeof window._applyStoryState === 'function') window._applyStoryState();
      }).catch(function() {});
    });
  }

  // ── Formulaire créer/modifier ─────────────────────────────
  function _openForm(id) {
    _editingId = id;
    var body = document.getElementById('eventsModalBody'); if (!body) return;
    var ev = id ? _eventsCache.filter(function(e) { return e.id === id; })[0] : null;
    body.innerHTML = '';

    // Bouton retour
    var backBtn = document.createElement('div'); backBtn.className = 'evt-back'; backBtn.textContent = '← ' + (ev ? 'Modifier' : 'Nouvel événement');
    backBtn.addEventListener('click', function() { _editingId = null; _renderList(); });
    body.appendChild(backBtn);

    // Formulaire
    var form = document.createElement('div'); form.className = 'evt-form-wrap';

    function _field(labelText, inputEl) {
      var lbl = document.createElement('label'); lbl.className = 'evt-lbl'; lbl.textContent = labelText;
      form.appendChild(lbl); form.appendChild(inputEl);
    }

    // Titre
    var inpTitle = document.createElement('input'); inpTitle.type = 'text'; inpTitle.id = 'evtFTitle';
    inpTitle.className = 'evt-inp'; inpTitle.placeholder = 'Ex : Anniversaire de Marie'; inpTitle.maxLength = 60;
    inpTitle.value = ev ? ev.title : '';
    _field('Titre', inpTitle);

    // Emoji + Type
    var row1 = document.createElement('div'); row1.className = 'evt-row';
    var colEmoji = document.createElement('div');
    var lblEmoji = document.createElement('label'); lblEmoji.className = 'evt-lbl'; lblEmoji.textContent = 'Emoji';
    var inpEmoji = document.createElement('input'); inpEmoji.type = 'text'; inpEmoji.id = 'evtFEmoji';
    inpEmoji.className = 'evt-inp'; inpEmoji.maxLength = 4; inpEmoji.value = ev ? ev.emoji : '📅';
    colEmoji.appendChild(lblEmoji); colEmoji.appendChild(inpEmoji);

    var colType = document.createElement('div');
    var lblType = document.createElement('label'); lblType.className = 'evt-lbl'; lblType.textContent = 'Type';
    var selType = document.createElement('select'); selType.id = 'evtFType'; selType.className = 'evt-inp';
    [['anniversary','Anniversaire'],['birthday','Fête'],['trip','Voyage'],['other','Autre']].forEach(function(t) {
      var opt = document.createElement('option'); opt.value = t[0]; opt.textContent = t[1];
      if (ev && ev.type === t[0]) opt.selected = true;
      selType.appendChild(opt);
    });
    colType.appendChild(lblType); colType.appendChild(selType);
    row1.appendChild(colEmoji); row1.appendChild(colType);
    form.appendChild(row1);

    // Date
    var inpDate = document.createElement('input'); inpDate.type = 'date'; inpDate.id = 'evtFDate';
    inpDate.className = 'evt-inp'; inpDate.value = ev ? ev.date : _todayStr();
    _field('Date', inpDate);

    // Assigné + Rappel
    var row2 = document.createElement('div'); row2.className = 'evt-row';
    var colAsgn = document.createElement('div');
    var lblAsgn = document.createElement('label'); lblAsgn.className = 'evt-lbl'; lblAsgn.textContent = 'Assigné à';
    var selAsgn = document.createElement('select'); selAsgn.id = 'evtFAssigned'; selAsgn.className = 'evt-inp';
    [['both','Tous les deux'],['girl','Elle'],['boy','Lui']].forEach(function(t) {
      var opt = document.createElement('option'); opt.value = t[0]; opt.textContent = t[1];
      if (ev ? ev.assigned_to === t[0] : t[0] === 'both') opt.selected = true;
      selAsgn.appendChild(opt);
    });
    colAsgn.appendChild(lblAsgn); colAsgn.appendChild(selAsgn);

    var colRem = document.createElement('div');
    var lblRem = document.createElement('label'); lblRem.className = 'evt-lbl'; lblRem.textContent = 'Rappel';
    var selRem = document.createElement('select'); selRem.id = 'evtFReminder'; selRem.className = 'evt-inp';
    [['0','Jour J'],['1','J-1'],['3','J-3'],['7','J-7']].forEach(function(t) {
      var opt = document.createElement('option'); opt.value = t[0]; opt.textContent = t[1];
      if (ev ? String(ev.days_before_reminder) === t[0] : t[0] === '1') opt.selected = true;
      selRem.appendChild(opt);
    });
    colRem.appendChild(lblRem); colRem.appendChild(selRem);
    row2.appendChild(colAsgn); row2.appendChild(colRem);
    form.appendChild(row2);

    // Notes
    var inpNotes = document.createElement('textarea'); inpNotes.id = 'evtFNotes';
    inpNotes.className = 'evt-inp evt-textarea'; inpNotes.placeholder = 'Infos supplémentaires...';
    inpNotes.value = ev ? (ev.notes || '') : '';
    _field('Notes (optionnel)', inpNotes);

    // Toggle récurrent
    var recurRow = document.createElement('div'); recurRow.className = 'evt-toggle-row';
    var recurLbl = document.createElement('div'); recurLbl.className = 'evt-toggle-lbl'; recurLbl.textContent = 'Récurrent chaque année';
    var recurToggle = document.createElement('button'); recurToggle.className = 'evt-toggle' + (ev && ev.is_recurring ? ' on' : '');
    recurToggle.id = 'evtFRecurring';
    recurToggle.addEventListener('click', function() { this.classList.toggle('on'); });
    recurRow.appendChild(recurLbl); recurRow.appendChild(recurToggle);
    form.appendChild(recurRow);
    body.appendChild(form);

    // Sauvegarder
    var saveBtn = document.createElement('button'); saveBtn.className = 'evt-save-btn'; saveBtn.id = 'evtSaveBtn'; saveBtn.textContent = '💾 Sauvegarder';
    saveBtn.addEventListener('click', _saveEvent);
    body.appendChild(saveBtn);

    // Supprimer (si édition)
    if (ev) {
      var delBtn = document.createElement('button'); delBtn.className = 'evt-del-btn'; delBtn.textContent = '🗑 Supprimer';
      delBtn.addEventListener('click', function() { _deleteEvent(ev.id); });
      body.appendChild(delBtn);
    }
  }

  // ── Sauvegarder ──────────────────────────────────────────
  function _saveEvent() {
    var coupleId = _cid(); if (!coupleId) return;
    var title = (document.getElementById('evtFTitle').value || '').trim();
    var emoji = (document.getElementById('evtFEmoji').value || '📅').trim();
    var type  = document.getElementById('evtFType').value;
    var date  = document.getElementById('evtFDate').value;
    var asgn  = document.getElementById('evtFAssigned').value;
    var rem   = parseInt(document.getElementById('evtFReminder').value) || 1;
    var notes = (document.getElementById('evtFNotes').value || '').trim();
    var recur = document.getElementById('evtFRecurring').classList.contains('on');
    if (!title) { _toast('Le titre est obligatoire', 'error'); return; }
    if (!date)  { _toast('La date est obligatoire', 'error');  return; }
    var btn = document.getElementById('evtSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    var payload = { couple_id: coupleId, title: title, emoji: emoji, type: type, date: date,
      assigned_to: asgn, days_before_reminder: rem, notes: notes || null, is_recurring: recur };
    var req = _editingId
      ? fetch(SB2 + '?id=eq.' + _editingId + '&couple_id=eq.' + coupleId, {
          method: 'PATCH', headers: sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}), body: JSON.stringify(payload) })
      : fetch(SB2, {
          method: 'POST', headers: sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}), body: JSON.stringify(payload) });
    req.then(function(r) {
      if (!r.ok) throw new Error(r.status);
      _toast('Événement sauvegardé ✓', 'success');
      _editingId = null; _loadEvents(); _renderList();
    }).catch(function() {
      _toast('Erreur de sauvegarde', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '💾 Sauvegarder'; }
    });
  }

  // ── Supprimer ─────────────────────────────────────────────
  function _deleteEvent(id) {
    if (!confirm('Supprimer cet événement ?')) return;
    var coupleId = _cid(); if (!coupleId) return;
    fetch(SB2 + '?id=eq.' + id + '&couple_id=eq.' + coupleId, { method: 'DELETE', headers: sb2Headers() })
    .then(function() { _toast('Événement supprimé', 'success'); _editingId = null; _loadEvents(); _renderList(); })
    .catch(function() { _toast('Erreur de suppression', 'error'); });
  }

  // ═══════════════════════════════════════════════════════════
  // 11. INIT
  // ═══════════════════════════════════════════════════════════
  function _init() {
    var coupleId = _cid(); if (!coupleId) return;
    _migrateAnniv(coupleId);
    _loadEvents();
    // Brancher le bouton Events (CSP-safe via addEventListener)
    setTimeout(function() {
      document.querySelectorAll('.home-feat-btn').forEach(function(b) {
        if (b.textContent.includes('Events')) {
          b.style.cursor = 'pointer'; b.removeAttribute('title');
          // Éviter de doubler le listener
          if (!b._evtBound) {
            b._evtBound = true;
            b.addEventListener('click', function() { window.openEventsModal(); });
          }
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
