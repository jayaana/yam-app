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
    var parts = dateStr.slice(0, 10).split('-');
    var target = new Date(parseInt(parts[0],10), parseInt(parts[1],10)-1, parseInt(parts[2],10));
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
  }
  function _nextOccurrence(dateStr) {
    var t = new Date(); var ty = t.getFullYear();
    // Parse sans ambiguïté timezone : extraire les composantes directement
    var parts = dateStr.slice(0, 10).split('-');
    var origDay = parseInt(parts[2], 10);
    var origMonth = parseInt(parts[1], 10) - 1; // 0-indexed
    var candidate = new Date(ty, origMonth, origDay);
    var today = new Date(ty, t.getMonth(), t.getDate());
    if (candidate < today) candidate = new Date(ty + 1, origMonth, origDay);
    var yy = candidate.getFullYear();
    var mm = ('0' + (candidate.getMonth() + 1)).slice(-2);
    var dd = ('0' + candidate.getDate()).slice(-2);
    return yy + '-' + mm + '-' + dd;
  }

  // Prochaine occurrence MENSUELLE (même jour du mois, mois suivant si passé)
  function _nextMonthlyOccurrence(dateStr) {
    var parts = dateStr.slice(0, 10).split('-');
    var origDay = parseInt(parts[2], 10);
    var t = new Date();
    var todayY = t.getFullYear(), todayM = t.getMonth(), todayD = t.getDate();
    // Candidate ce mois-ci
    var candY = todayY, candM = todayM;
    // Si le jour du mois est déjà passé ce mois-ci, aller au mois prochain
    if (origDay < todayD) {
      candM += 1;
      if (candM > 11) { candM = 0; candY += 1; }
    }
    // Gérer les mois qui n'ont pas le jour (ex: 31 en février)
    var maxDay = new Date(candY, candM + 1, 0).getDate();
    var day = Math.min(origDay, maxDay);
    var mm = ('0' + (candM + 1)).slice(-2);
    var dd = ('0' + day).slice(-2);
    return candY + '-' + mm + '-' + dd;
  }
  // Prochaine occurrence HEBDOMADAIRE (même jour de la semaine, semaine suivante si passé)
  function _nextWeeklyOccurrence(dateStr) {
    var parts = dateStr.slice(0, 10).split('-');
    var origDay = parseInt(parts[2], 10);
    var origMonth = parseInt(parts[1], 10) - 1;
    var origYear = parseInt(parts[0], 10);
    var t = new Date();
    var today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    // Jour de la semaine d'origine (0=dim, 1=lun, ...)
    var origDate = new Date(origYear, origMonth, origDay);
    var targetDow = origDate.getDay();
    // Trouver le prochain jour correspondant (aujourd'hui inclus si pas encore passé)
    var diff = (targetDow - today.getDay() + 7) % 7;
    if (diff === 0) diff = 0; // aujourd'hui même jour de semaine → on garde
    var candidate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff);
    // Si c'est aujourd'hui mais déjà passé (diff===0), on avance d'une semaine
    // On ne gère pas l'heure ici, donc on garde le jour même si diff===0
    var yy = candidate.getFullYear();
    var mm = ('0' + (candidate.getMonth() + 1)).slice(-2);
    var dd = ('0' + candidate.getDate()).slice(-2);
    return yy + '-' + mm + '-' + dd;
  }

  function _monthsSince(dateStr) {
    var parts = dateStr.slice(0, 10).split('-');
    var startY = parseInt(parts[0], 10), startM = parseInt(parts[1], 10) - 1;
    var now = new Date();
    return (now.getFullYear() - startY) * 12 + (now.getMonth() - startM);
  }
  function _resolveNextDate(ev) {
    var isMensiv = _isSystemAnniv(ev);
    if (isMensiv || ev.is_monthly_recurring) return _nextMonthlyOccurrence(ev.date);
    if (ev.is_weekly_recurring)  return _nextWeeklyOccurrence(ev.date);
    if (ev.is_recurring)         return _nextOccurrence(ev.date);
    return ev.date;
  }

  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _toast(msg, type) { if (typeof showToast === 'function') showToast(msg, type || 'info', 2000); }

  // ── Lire la start_date couple depuis toutes les sources disponibles ──
  function _getStartDate() {
    return (window.YAM_COUPLE && window.YAM_COUPLE.start_date)
      || (window.startDate)
      || null;
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
  // 2. OVERLAY MENSIVERSAIRE — plein écran, lisible thème clair/sombre
  // ═══════════════════════════════════════════════════════════
  var _mensivOverlayShownKey = 'yam_mensiv_shown_' + _todayStr();

  function _injectOverlayStyles() {
    if (document.getElementById('evtOverlayStyle')) return;
    var s = document.createElement('style'); s.id = 'evtOverlayStyle';
    s.textContent = [
      /* Overlay mensiversaire — dans le flux, sous le header */
      '#yamMensivOverlay{display:none;width:100%;box-sizing:border-box;',
      'padding:4px 16px 8px;background:transparent;}',
      '#yamMensivOverlay.visible{display:block;}',
      '.mensiv-card{background:var(--s1);border-radius:20px;padding:20px 20px 18px;width:100%;',
      'text-align:center;position:relative;box-shadow:0 8px 32px rgba(0,0,0,.15);',
      'border:1px solid var(--border);box-sizing:border-box;margin-bottom:12px;}',
      '.mensiv-hearts{font-size:52px;margin-bottom:16px;display:block;animation:mensivFloat 3s ease-in-out infinite;}',
      '@keyframes mensivFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}',
      '.mensiv-count{font-size:56px;font-weight:800;line-height:1;margin-bottom:4px;',
      'background:linear-gradient(135deg,#f5c518,#e75a7c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}',
      '.mensiv-label{font-size:15px;font-weight:500;color:var(--muted);margin-bottom:24px;line-height:1.4;}',
      '.mensiv-msg{font-size:17px;font-weight:600;color:var(--text);margin-bottom:28px;line-height:1.5;}',
      '.mensiv-close{background:var(--s2);border:1px solid var(--border);border-radius:14px;',
      'color:var(--text);font-size:14px;font-weight:600;padding:12px 32px;cursor:pointer;letter-spacing:.3px;',
      'transition:background .15s;}',
      '.mensiv-close:active{background:var(--border);}',

      /* Bannière events accueil — dans le flux, entre header et yamHomeTab */
      '#annivBanner{display:none;align-items:center;justify-content:space-between;gap:10px;',
      'width:calc(100% - 32px);box-sizing:border-box;padding:12px 16px;margin:0 16px 4px;',
      'border-radius:14px;box-shadow:0 4px 20px rgba(0,0,0,.25);}',
      '#annivBanner.visible{display:flex;}',
      '#annivBanner .anniv-title{text-align:center;flex:1;}',

      /* Thème anniversaire/couple */
      '#annivBanner.evt-type-anniversary{background:var(--s1,#fff);border-bottom:2px solid #e75a7c;}',
      '#annivBanner.evt-type-anniversary .anniv-title{color:var(--text,#1c1c1e);}',
      '#annivBanner.evt-type-anniversary .anniv-emoji{text-shadow:0 0 12px rgba(231,90,124,.6);}',

      /* Thème fête */
      '#annivBanner.evt-type-birthday{background:var(--s1,#fff);border-bottom:2px solid #38bdf8;}',
      '#annivBanner.evt-type-birthday .anniv-title{color:var(--text,#1c1c1e);}',

      /* Thème voyage */
      '#annivBanner.evt-type-trip{background:var(--s1,#fff);border-bottom:2px solid #34d399;}',
      '#annivBanner.evt-type-trip .anniv-title{color:var(--text,#1c1c1e);}',

      /* Thème autre */
      '#annivBanner.evt-type-other{background:var(--s1,#fff);border-bottom:2px solid var(--border,#ddd);}',
      '#annivBanner.evt-type-other .anniv-title{color:var(--text,#1c1c1e);}',

      /* Éléments bannière */
      '.anniv-emoji{font-size:22px;flex-shrink:0;}',
      '.anniv-title{font-size:14px;font-weight:700;letter-spacing:.1px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.anniv-close-x{background:var(--s2,#f2f2f7);border:none;border-radius:50%;width:28px;height:28px;',
      'color:var(--text,#1c1c1e);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;',
      'font-weight:700;line-height:1;}',
      '#annivBanner.evt-type-other .anniv-close-x{background:var(--s2,#f2f2f7);color:var(--text,#1c1c1e);}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Afficher l'overlay mensiversaire ──────────────────────
  function _showMensivOverlay(months) {
    if (localStorage.getItem(_mensivOverlayShownKey)) return; // une seule fois par jour
    _injectOverlayStyles();

    var overlay = document.getElementById('yamMensivOverlay');
    if (!overlay) return;
    overlay.innerHTML = ''; // vider le contenu précédent

    var isYear = months % 12 === 0;
    var count = isYear ? months / 12 : months;
    var unit = isYear ? (count > 1 ? 'ans' : 'an') : 'mois';

    var card = document.createElement('div'); card.className = 'mensiv-card';

    var hearts = document.createElement('span'); hearts.className = 'mensiv-hearts';
    hearts.textContent = isYear ? '🎂' : '🩷';

    var countEl = document.createElement('div'); countEl.className = 'mensiv-count';
    countEl.textContent = count + ' ' + unit;

    var lbl = document.createElement('div'); lbl.className = 'mensiv-label';
    lbl.textContent = 'ensemble';

    var msg = document.createElement('div'); msg.className = 'mensiv-msg';
    msg.textContent = isYear
      ? '✨ Bonne ' + (count === 1 ? 'première' : count + 'ème') + ' année d\'amour !'
      : '💌 Ça fait maintenant ' + count + ' mois qu\'on s\'aime 🩷';

    var closeBtn = document.createElement('button'); closeBtn.className = 'mensiv-close';
    closeBtn.textContent = 'Célébrons ça 🎉';
    closeBtn.addEventListener('click', function() {
      overlay.classList.remove('visible');
      setTimeout(function() { overlay.style.display = 'none'; overlay.innerHTML = ''; }, 300);
      localStorage.setItem(_mensivOverlayShownKey, '1');
    });

    card.appendChild(hearts); card.appendChild(countEl); card.appendChild(lbl);
    card.appendChild(msg); card.appendChild(closeBtn);
    overlay.appendChild(card);

    requestAnimationFrame(function() { overlay.classList.add('visible'); });
    _launchConfettis();
  }

  // ═══════════════════════════════════════════════════════════
  // 3. BANNIÈRE accueil — lisible thème clair et sombre
  // ═══════════════════════════════════════════════════════════
  function _isHomeVisible() {
    var h = document.getElementById('yamHomeTab');
    return !!(h && getComputedStyle(h).display !== 'none');
  }

  // Config par type : bg retiré, classes CSS gèrent l'apparence
  var _eventTypeConfig = {
    anniversary: { cls: 'evt-type-anniversary', icon: '🎂', confetti: true,  pulse: true  },
    birthday:    { cls: 'evt-type-birthday',    icon: '🎉', confetti: true,  pulse: true  },
    trip:        { cls: 'evt-type-trip',        icon: '✈️',  confetti: false, pulse: false },
    other:       { cls: 'evt-type-other',       icon: '📅', confetti: false, pulse: false }
  };

  var _bannerTypes = ['evt-type-anniversary','evt-type-birthday','evt-type-trip','evt-type-other'];

  function _showEventBanner(text, type) {
    if (!_isHomeVisible()) return;
    _injectOverlayStyles();
    var cfg = _eventTypeConfig[type] || _eventTypeConfig.other;
    document.body.classList.add('anniv-mode');

    var banner = document.getElementById('annivBanner');
    if (!banner) return;

    // Nettoyer les classes de type précédentes
    _bannerTypes.forEach(function(c) { banner.classList.remove(c); });
    banner.classList.add(cfg.cls);

    // Vider et reconstruire le contenu pour contrôler le DOM
    banner.innerHTML = '';

    var emoji = document.createElement('span'); emoji.className = 'anniv-emoji'; emoji.textContent = cfg.icon;
    var title = document.createElement('div'); title.className = 'anniv-title'; title.textContent = text;
    var x = document.createElement('button'); x.className = 'anniv-close-x'; x.textContent = '✕';
    x.addEventListener('click', function() { _hideAnnivBanner(); });

    banner.appendChild(emoji); banner.appendChild(title); banner.appendChild(x);
    banner.classList.add('visible');

    if (cfg.confetti) _launchConfettis();
  }

  function _hideAnnivBanner() {
    document.body.classList.remove('anniv-mode');
    var banner = document.getElementById('annivBanner');
    if (banner) {
      banner.classList.remove('visible');
      _bannerTypes.forEach(function(c) { banner.classList.remove(c); });
    }
  }

  document.addEventListener('yam:tab_switched', function() {
    if (!_isHomeVisible()) _hideAnnivBanner();
    else setTimeout(_checkTodayEvents, 200);
  });

  // ═══════════════════════════════════════════════════════════
  // 4. MIGRATION AUTO — anniversaire depuis start_date couple
  // L'event mensiversaire est NON MODIFIABLE (is_system=true côté logique)
  // ═══════════════════════════════════════════════════════════
  function _migrateAnniv(coupleId) {
    var startDate = _getStartDate();
    if (!startDate) return;
    var key = MIGRATE_KEY + coupleId;

    // Re-vérifier si la start_date a changé (cas rare : couple reconfigure la date)
    var savedDate = localStorage.getItem(key + '_date');
    var sdSliced = startDate.slice(0, 10);
    if (localStorage.getItem(key) && savedDate === sdSliced) return;

    fetch(SB2 + '?couple_id=eq.' + coupleId + '&type=eq.anniversary&limit=1', { headers: sb2Headers() })
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(rows) {
      if (rows && rows.length > 0) {
        var existing = rows[0];
        // Si la date a changé (couple a mis à jour start_date), on patch l'event
        if (existing.date !== sdSliced) {
          fetch(SB2 + '?id=eq.' + existing.id + '&couple_id=eq.' + coupleId, {
            method: 'PATCH',
            headers: sb2Headers({'Content-Type': 'application/json', 'Prefer': 'return=minimal'}),
            body: JSON.stringify({ date: sdSliced })
          }).then(function() {
            localStorage.setItem(key, '1');
            localStorage.setItem(key + '_date', sdSliced);
            _loadEvents();
          }).catch(function() {});
        } else {
          localStorage.setItem(key, '1');
          localStorage.setItem(key + '_date', sdSliced);
        }
        return;
      }
      // Créer l'event mensiversaire lié à la start_date
      fetch(SB2, {
        method: 'POST',
        headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
        body: JSON.stringify({
          couple_id: coupleId, title: 'Mensiversaire 🩷', emoji: '🎂',
          date: sdSliced, is_recurring: true, type: 'anniversary',
          notes: 'Date de début du couple', assigned_to: 'both',
          days_before_reminder: 1, story_bubble_enabled: false
        })
      }).then(function() {
        localStorage.setItem(key, '1');
        localStorage.setItem(key + '_date', sdSliced);
        _loadEvents();
      }).catch(function() {});
    }).catch(function() {});
  }

  // ═══════════════════════════════════════════════════════════
  // 5. PUSH NOTIFICATIONS — J-3, J-1, J-0
  // ═══════════════════════════════════════════════════════════
  function _checkPushReminders(events) {
    if (typeof yamPushNotify !== 'function') return;
    var today = _todayStr();
    events.forEach(function(ev) {
      var nextDate = _resolveNextDate(ev);
      var days     = _daysUntil(nextDate);
      var remind   = ev.days_before_reminder || 1;
      [0, 1, 3, 7].filter(function(d) { return d === 0 || d <= remind; }).forEach(function(d) {
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
  // 6. BADGE CLIGNOTANT sur l'icône Events
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
      var nd = _resolveNextDate(ev);
      var days = _daysUntil(nd);
      if (days >= 0 && days <= 3 && (!soonest || days < soonest.days)) {
        var cfg = _eventTypeConfig[ev.type] || _eventTypeConfig.other;
        soonest = { days: days, icon: ev.emoji || cfg.icon };
      }
    });
    var old = btn.querySelector('.evt-alert-badge'); if (old) old.remove();
    if (!soonest) return;
    var badge = document.createElement('span');
    badge.className   = 'evt-alert-badge';
    var isEmoji = soonest.days === 0;
    badge.textContent = isEmoji ? soonest.icon : 'J-' + soonest.days;
    var urgent = soonest.days <= 1;
    var color = urgent ? '#e75a7c' : '#f5a623';
    badge.style.cssText = 'position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;padding:0 5px;'
      + 'border-radius:10px;font-size:10px;font-weight:800;'
      + (isEmoji ? 'background:transparent;border:1.5px solid ' + color + ';' : 'background:' + color + ';')
      + 'color:#fff;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:10;'
      + 'line-height:1;animation:' + (urgent ? 'evtPulse 1s infinite' : 'none') + ';';
    btn.appendChild(badge);
  }

  // ═══════════════════════════════════════════════════════════
  // 7. VÉRIFICATION EVENTS DU JOUR
  // ═══════════════════════════════════════════════════════════
  var _eventsCache = [];

  function _checkTodayEvents() {
    var todayEvents = [];
    _eventsCache.forEach(function(ev) {
      var nd = _resolveNextDate(ev);
      if (_daysUntil(nd) !== 0) return;
      todayEvents.push(ev);
    });

    // Afficher d'abord les events non-mensiversaire
    var nonAnniv = todayEvents.filter(function(ev) { return ev.type !== 'anniversary'; });
    var toShow = nonAnniv.length ? nonAnniv : todayEvents;

    toShow.forEach(function(ev) {
      if (ev.type === 'anniversary') {
        var months = _monthsSince(ev.date);
        if (months < 1) return;
        var isMensiv = (ev.notes === 'Date de début du couple' || ev.title.indexOf('Mensiversaire') !== -1);
        if (isMensiv) {
          // Afficher l'overlay plein écran pour le mensiversaire
          _showMensivOverlay(months);
          // Et la bannière accueil (texte simple)
          var label = months % 12 === 0
            ? '🎂 ' + (months/12) + ' an' + (months/12 > 1 ? 's' : '') + ' ensemble !'
            : '🩷 ' + months + ' mois ensemble !';
          _showEventBanner(label, 'anniversary');
        } else {
          _showEventBanner('🎂 ' + ev.title, 'anniversary');
        }
      } else {
        _showEventBanner(ev.emoji + ' ' + ev.title, ev.type);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 8. CHARGEMENT
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
  // 9. BULLE VIDÉO
  // ═══════════════════════════════════════════════════════════
  function _syncStoryBubble() {
    var coupleId = _cid(); if (!coupleId) return;
    var u = _user(); var userId = u ? u.id : null; if (!userId) return;
    var slot = 'story_bubble_' + userId;
    fetch(SB_URL + '/rest/v1/photo_descs?couple_id=eq.' + coupleId + '&category=eq.settings&slot=eq.' + slot + '&limit=1', { headers: sb2Headers() })
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(rows) {
      window._storyBubbleEnabled = !!(rows && rows[0] && rows[0].description === 'true');
      if (typeof window._applyStoryState === 'function') window._applyStoryState();
    }).catch(function() {});
  }

  // ═══════════════════════════════════════════════════════════
  // 10. STYLES MODAL
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
      /* Card event — badge lisibilité */
      '.evt-card{background:var(--s2);border-radius:14px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;gap:12px;cursor:pointer;border:1px solid var(--border)}',
      '.evt-card:active{opacity:.7}',
      '.evt-card-emoji{font-size:26px;flex-shrink:0}',
      '.evt-card-info{flex:1;min-width:0}',
      '.evt-card-title{font-size:14px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.evt-card-meta{font-size:12px;color:var(--muted);margin-top:2px}',
      '.evt-card-cd{font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;flex-shrink:0;white-space:nowrap}',
      /* Badges countdown — contraste garanti thème clair ET sombre */
      '.evt-cd-today{background:#e75a7c;color:#fff}',
      '.evt-cd-soon{background:#7c3aed;color:#fff}',
      '.evt-cd-normal{background:var(--s1);color:var(--muted);border:1px solid var(--border)}',
      /* Badge système (mensiversaire non modifiable) */
      '.evt-card-system{border-left:3px solid #e75a7c;}',
      '.evt-card-system .evt-card-title::after{content:" 🔒";font-size:11px;color:var(--muted);}',
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
      '.evt-save-btn{width:100%;padding:14px;border-radius:14px;border:none;background:#e75a7c;color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-top:14px;box-sizing:border-box;display:block}',
      '.evt-save-btn:disabled{opacity:.5}',
      '.evt-del-btn{width:100%;padding:12px;border-radius:14px;border:1px solid #e75a7c;background:transparent;color:#e75a7c;font-size:14px;font-weight:600;cursor:pointer;margin-top:8px;box-sizing:border-box;display:block}',
      '.evt-empty{text-align:center;color:var(--muted);font-size:13px;padding:24px 0}',
      '.evt-bubble-card{background:var(--s2);border-radius:14px;padding:14px 16px;margin-bottom:8px}',
      '.evt-back{display:flex;align-items:center;gap:8px;margin-bottom:16px;cursor:pointer;color:var(--accent);font-size:14px;font-weight:600}',
      /* Notice event système non modifiable */
      '.evt-system-notice{background:rgba(231,90,124,.1);border:1px solid rgba(231,90,124,.25);border-radius:10px;padding:10px 14px;',
      'font-size:12px;color:var(--muted);margin-bottom:12px;display:flex;align-items:center;gap:8px;}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Vérifier si un event est le mensiversaire système (non modifiable) ──
  function _isSystemAnniv(ev) {
    return ev && ev.type === 'anniversary' &&
      (ev.notes === 'Date de début du couple' || ev.title.indexOf('Mensiversaire') !== -1);
  }

  // ═══════════════════════════════════════════════════════════
  // 11. MODAL — injection + délégation d'événements (CSP-safe)
  // ═══════════════════════════════════════════════════════════
  var _editingId = null;

  function _injectModal() {
    if (document.getElementById('eventsModal')) return;
    _injectStyles();
    _injectOverlayStyles();

    var modal = document.createElement('div'); modal.id = 'eventsModal';
    var sheet = document.createElement('div'); sheet.id = 'eventsSheet';
    var hdr = document.createElement('div'); hdr.className = 'evt-hdr';
    var hdrTitle = document.createElement('div'); hdrTitle.className = 'evt-hdr-title'; hdrTitle.textContent = '📅 Événements';
    var closeBtn = document.createElement('button'); closeBtn.className = 'evt-close-btn'; closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', function() { _closeModal(); });
    hdr.appendChild(hdrTitle); hdr.appendChild(closeBtn);
    var body = document.createElement('div'); body.id = 'eventsModalBody'; body.className = 'evt-body';
    sheet.appendChild(hdr); sheet.appendChild(body);
    modal.appendChild(sheet);
    document.body.appendChild(modal);
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

    // Toggle bulle vidéo
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
      var nd = _resolveNextDate(ev);
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

    var pastNR = past.filter(function(ev) { return !ev.is_recurring && !ev.is_monthly_recurring && !ev.is_weekly_recurring; });
    if (pastNR.length) {
      var secPast = document.createElement('div'); secPast.className = 'evt-sec'; secPast.textContent = 'Passés';
      body.appendChild(secPast);
      pastNR.forEach(function(ev) { var c = _buildCard(ev); c.style.opacity = '0.5'; body.appendChild(c); });
    }

    var addBtn = document.createElement('button'); addBtn.className = 'evt-add-btn'; addBtn.textContent = '+ Ajouter un événement';
    addBtn.addEventListener('click', function() { _openForm(null); });
    body.appendChild(addBtn);
  }

  function _buildCard(ev) {
    var card = document.createElement('div'); card.className = 'evt-card';
    var isSystem = _isSystemAnniv(ev);
    if (isSystem) card.classList.add('evt-card-system');

    var emojiEl = document.createElement('div'); emojiEl.className = 'evt-card-emoji'; emojiEl.textContent = ev.emoji || '📅';
    var info = document.createElement('div'); info.className = 'evt-card-info';
    var title = document.createElement('div'); title.className = 'evt-card-title'; title.textContent = ev.title;

    // Afficher le nombre de mois/ans pour le mensiversaire
    if (isSystem) {
      var months = _monthsSince(ev.date);
      if (months >= 1) {
        var countStr = months % 12 === 0
          ? (months/12) + ' an' + (months/12 > 1 ? 's' : '')
          : months + ' mois';
        title.textContent = ev.title + ' · ' + countStr;
      }
    }

    var meta = document.createElement('div'); meta.className = 'evt-card-meta';
    // Pour les événements mensuels/hebdo, afficher la date d'origine, pas la prochaine occurrence
    var isMonthly = isSystem || ev.is_monthly_recurring;
    var isWeekly  = !!ev.is_weekly_recurring;
    var displayStr = (isMonthly || isWeekly) ? ev.date : (ev._nd || ev.date);
    var displayParts = displayStr.split('-');
    var displayDate = new Date(parseInt(displayParts[0],10), parseInt(displayParts[1],10)-1, parseInt(displayParts[2],10));
    var dl = displayDate.toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
    if (ev.is_recurring && !isSystem) dl += ' (annuel)';
    if (ev.is_monthly_recurring && !isSystem) dl += ' (mensuel)';
    if (isSystem) dl += ' (mensuel)';
    if (ev.is_weekly_recurring) dl += ' (hebdo)';
    meta.textContent = dl + (ev.notes && !isSystem ? ' · ' + ev.notes.substring(0,30) : '');
    info.appendChild(title); info.appendChild(meta);

    var cd = document.createElement('div'); cd.className = 'evt-card-cd';
    var du = typeof ev._du !== 'undefined' ? ev._du : _daysUntil(ev._nd || ev.date);
    if (du === 0)       { cd.textContent = '🎉 Aujourd\'hui';          cd.classList.add('evt-cd-today'); }
    else if (du === 1)  { cd.textContent = 'Demain';                    cd.classList.add('evt-cd-soon'); }
    else if (du === -1) { cd.textContent = 'Hier';                      cd.classList.add('evt-cd-normal'); }
    else if (du > 0 && du <= 3) { cd.textContent = 'Dans ' + du + ' j.';       cd.classList.add('evt-cd-soon'); }
    else if (du > 0)    { cd.textContent = 'Dans ' + du + ' j.';       cd.classList.add('evt-cd-normal'); }
    else                { cd.textContent = 'Il y a ' + Math.abs(du) + ' j.'; cd.classList.add('evt-cd-normal'); }

    card.appendChild(emojiEl); card.appendChild(info); card.appendChild(cd);

    // Event système : pas d'ouverture du formulaire d'édition
    if (!isSystem) {
      card.addEventListener('click', function() { _openForm(ev.id); });
    }
    return card;
  }

  // ── Toggle bulle vidéo ────────────────────────────────────
  var SB_PD = SB_URL + '/rest/v1/photo_descs';

  function _getBubbleSetting(coupleId, userId, cb) {
    var slot = 'story_bubble_' + userId;
    fetch(SB_PD + '?couple_id=eq.' + coupleId + '&category=eq.settings&slot=eq.' + slot + '&limit=1', { headers: sb2Headers() })
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(rows) { cb(rows && rows[0] ? rows[0].description === 'true' : false, rows && rows[0] ? rows[0].id : null); })
    .catch(function() { cb(false, null); });
  }

  function _saveBubbleSetting(coupleId, userId, value, existingId) {
    var slot = 'story_bubble_' + userId;
    if (existingId) {
      return fetch(SB_PD + '?id=eq.' + existingId, {
        method: 'PATCH', headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ description: value ? 'true' : 'false' })
      });
    } else {
      return fetch(SB_PD, {
        method: 'POST', headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ couple_id: coupleId, category: 'settings', slot: slot, description: value ? 'true' : 'false' })
      });
    }
  }

  function _toggleBubble(btn) {
    var coupleId = _cid(); if (!coupleId) return;
    var u = _user(); var userId = u ? u.id : null; if (!userId) return;
    var newVal = !btn.classList.contains('on');
    _getBubbleSetting(coupleId, userId, function(currentVal, rowId) {
      _saveBubbleSetting(coupleId, userId, newVal, rowId).then(function() {
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

    // Bloquer l'édition de l'event mensiversaire système
    if (ev && _isSystemAnniv(ev)) {
      _toast('Le mensiversaire se met à jour automatiquement depuis la date de votre couple 🩷', 'info');
      return;
    }

    body.innerHTML = '';

    var backBtn = document.createElement('div'); backBtn.className = 'evt-back'; backBtn.textContent = '← ' + (ev ? 'Modifier' : 'Nouvel événement');
    backBtn.addEventListener('click', function() { _editingId = null; _renderList(); });
    body.appendChild(backBtn);

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
    [['birthday','Anniversaire 🎂'],['trip','Voyage ✈️'],['other','Autre 📅']].forEach(function(t) {
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

    // Toggle récurrent chaque année
    var recurRow = document.createElement('div'); recurRow.className = 'evt-toggle-row';
    var recurLbl = document.createElement('div'); recurLbl.className = 'evt-toggle-lbl'; recurLbl.textContent = 'Récurrent chaque année';
    var recurToggle = document.createElement('button'); recurToggle.className = 'evt-toggle' + (ev && ev.is_recurring ? ' on' : '');
    recurToggle.id = 'evtFRecurring';
    recurToggle.addEventListener('click', function() {
      this.classList.toggle('on');
      if (this.classList.contains('on')) {
        var monthly = document.getElementById('evtFRecurringMonthly');
        if (monthly) monthly.classList.remove('on');
        var weekly = document.getElementById('evtFRecurringWeekly');
        if (weekly) weekly.classList.remove('on');
      }
    });
    recurRow.appendChild(recurLbl); recurRow.appendChild(recurToggle);
    form.appendChild(recurRow);

    // Toggle récurrent chaque mois
    var recurMonthRow = document.createElement('div'); recurMonthRow.className = 'evt-toggle-row';
    var recurMonthLbl = document.createElement('div'); recurMonthLbl.className = 'evt-toggle-lbl'; recurMonthLbl.textContent = 'Récurrent chaque mois';
    var recurMonthToggle = document.createElement('button'); recurMonthToggle.className = 'evt-toggle' + (ev && ev.is_monthly_recurring ? ' on' : '');
    recurMonthToggle.id = 'evtFRecurringMonthly';
    recurMonthToggle.addEventListener('click', function() {
      this.classList.toggle('on');
      if (this.classList.contains('on')) {
        var yearly = document.getElementById('evtFRecurring');
        if (yearly) yearly.classList.remove('on');
        var weekly = document.getElementById('evtFRecurringWeekly');
        if (weekly) weekly.classList.remove('on');
      }
    });
    recurMonthRow.appendChild(recurMonthLbl); recurMonthRow.appendChild(recurMonthToggle);
    form.appendChild(recurMonthRow);

    // Toggle récurrent chaque semaine
    var recurWeekRow = document.createElement('div'); recurWeekRow.className = 'evt-toggle-row';
    var recurWeekLbl = document.createElement('div'); recurWeekLbl.className = 'evt-toggle-lbl'; recurWeekLbl.textContent = 'Récurrent chaque semaine';
    var recurWeekToggle = document.createElement('button'); recurWeekToggle.className = 'evt-toggle' + (ev && ev.is_weekly_recurring ? ' on' : '');
    recurWeekToggle.id = 'evtFRecurringWeekly';
    recurWeekToggle.addEventListener('click', function() {
      this.classList.toggle('on');
      if (this.classList.contains('on')) {
        var yearly = document.getElementById('evtFRecurring');
        if (yearly) yearly.classList.remove('on');
        var monthly = document.getElementById('evtFRecurringMonthly');
        if (monthly) monthly.classList.remove('on');
      }
    });
    recurWeekRow.appendChild(recurWeekLbl); recurWeekRow.appendChild(recurWeekToggle);
    form.appendChild(recurWeekRow);
    body.appendChild(form);

    // Sauvegarder
    var saveBtn = document.createElement('button'); saveBtn.className = 'evt-save-btn'; saveBtn.id = 'evtSaveBtn'; saveBtn.textContent = 'Sauvegarder';
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
    var recurMonthly = document.getElementById('evtFRecurringMonthly') ? document.getElementById('evtFRecurringMonthly').classList.contains('on') : false;
    var recurWeekly  = document.getElementById('evtFRecurringWeekly')  ? document.getElementById('evtFRecurringWeekly').classList.contains('on')  : false;
    if (!title) { _toast('Le titre est obligatoire', 'error'); return; }
    if (!date)  { _toast('La date est obligatoire', 'error');  return; }
    var btn = document.getElementById('evtSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    var payload = { couple_id: coupleId, title: title, emoji: emoji, type: type, date: date,
      assigned_to: asgn, days_before_reminder: rem, notes: notes || null, is_recurring: recur, is_monthly_recurring: recurMonthly, is_weekly_recurring: recurWeekly };
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
      if (btn) { btn.disabled = false; btn.textContent = 'Sauvegarder'; }
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
  // 12. INIT
  // ═══════════════════════════════════════════════════════════
  function _init() {
    var coupleId = _cid(); if (!coupleId) return;
    _migrateAnniv(coupleId);
    _loadEvents();
    setTimeout(function() {
      document.querySelectorAll('.home-feat-btn').forEach(function(b) {
        if (b.textContent.includes('Events')) {
          b.style.cursor = 'pointer'; b.removeAttribute('title');
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
