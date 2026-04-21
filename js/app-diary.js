// ═══════════════════════════════════════════════════════════════════
// app-diary.js — YAM v15 — My Diary
// Journal intime riche : pages texte/images/Canva, partage couple,
// co-écriture, Realtime + fallback poll
//
// Dépendances : app-core.js
// Globals utilisés : SB_URL, sb2Headers(), sb2Fetch(), sb2Post(),
//   sb2Patch(), sb2Delete(), yamGetUser(), getProfile(),
//   yamGetDisplayName(), showToast(), haptic(), _yamSlide(),
//   yamFlameActivity(), escHtml(), window._yamRT
// Tables : diary_pages, diary_comments
// ═══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── 1. CONSTANTES ────────────────────────────────────────────────
  var DIARY_TBL          = 'diary_pages';
  var COMMENT_TBL        = 'diary_comments';
  var STORAGE_BASE       = SB_URL + '/storage/v1/object/images/';
  var SB_EDGE_CANVA      = SB_URL + '/functions/v1/canva-proxy';
  var POLL_MS      = 6000;   // fallback poll
  var MAX_IMG_BYTES    = 400 * 1024; // 400 Ko — images éditeur (= slots Elle/Lui dans app-nous)
  var MAX_BG_IMG_BYTES = 600 * 1024; // 600 Ko — image de fond (= souvenirs dans app-nous)

  // Palettes de couvertures
  var COVER_PALETTES = [
    { bg: '#fce4eb', emoji: '🌸', label: 'Rose poudré' },
    { bg: '#e8f4f8', emoji: '💙', label: 'Ciel' },
    { bg: '#f0fce4', emoji: '🌿', label: 'Sage' },
    { bg: '#fef9e4', emoji: '✨', label: 'Or doux' },
    { bg: '#f3e8fd', emoji: '🩷', label: 'Lavande' },
    { bg: '#ffe8d6', emoji: '🍑', label: 'Pêche' },
    { bg: '#e8fdf5', emoji: '🍃', label: 'Menthe' },
    { bg: '#fde8e8', emoji: '🌺', label: 'Corail' },
    { bg: 'var(--s3)', emoji: '⭐', label: 'Nuit' },
    { bg: 'var(--s2)', emoji: '🌠', label: 'Minuit' },
    { bg: 'linear-gradient(135deg,#fce4eb,#f3e8fd)', emoji: '🌈', label: 'Aurore' },
    { bg: 'linear-gradient(135deg,#e8f4f8,#e8fdf5)', emoji: '🌊', label: 'Océan' },
  ];

  // Humeurs disponibles
  var MOODS = ['😊','😍','🥰','😢','😤','😴','🤔','🎉','💪','🌟','😌','🔥'];

  // État
  var _inited      = false;
  var _view        = null;
  var _pages       = [];
  var _currentPage = null;   // page en cours d'édition/lecture
  var _mode        = 'list'; // 'list' | 'read' | 'edit' | 'partner'
  var _tab         = 'mine'; // 'mine' | 'partner'
  var _rtChannel   = null;
  var _pollTimer   = null;
  var _saving      = false;
  var _editorImages = []; // images insérées dans l'éditeur courant
  var _canvaValid  = false;
  var _editorCoverEmoji = null; // Fix2: emoji couverture persisté pendant l'édition

  // ─── HISTORIQUE UNDO/REDO (refs de module, peuplées par _bindEditorEvents) ──
  var _histSnapshotNow = function() {};
  var _doHistUndo      = function() {};
  var _doHistRedo      = function() {};

  // ─── POLICES : maps au niveau module ─────────────────────────────
  var _fontDisplayNames = {
    'Georgia, serif':                                'Georgia',
    '"Palatino Linotype", Palatino, serif':          'Palatino',
    'Garamond, "Adobe Garamond Pro", serif':         'Garamond',
    '"DM Sans", sans-serif':                         'DM Sans',
    'Verdana, Geneva, sans-serif':                   'Verdana',
    'Arial, Helvetica, sans-serif':                  'Arial',
    '"Courier New", Courier, monospace':             'Courier',
    'Impact, Charcoal, sans-serif':                  'Impact',
    '"Trebuchet MS", Helvetica, sans-serif':         'Trebu.',
    '"Brush Script MT", cursive':                    'Script',
  };
  var _fontShortNames = {
    'Georgia': 'Georgia', 'Palatino Linotype': 'Palatino', 'Garamond': 'Garamond',
    'DM Sans': 'DM Sans', 'Verdana': 'Verdana', 'Arial': 'Arial',
    'Courier New': 'Courier', 'Impact': 'Impact',
    'Trebuchet MS': 'Trebu.', 'Brush Script MT': 'Script',
  };

  // ─── FAVORIS : stockés en localStorage par couple ─────────────────
  function _getPinnedIds() {
    var u = yamGetUser();
    if (!u) return {};
    try { return JSON.parse(localStorage.getItem('diary_pinned_' + u.couple_id) || '{}'); } catch(e) { return {}; }
  }
  function _setPinnedIds(obj) {
    var u = yamGetUser();
    if (!u) return;
    try { localStorage.setItem('diary_pinned_' + u.couple_id, JSON.stringify(obj)); } catch(e) {}
  }
  function _isPinned(pageId) { return !!_getPinnedIds()[pageId]; }
  function _togglePin(pageId) {
    var pins = _getPinnedIds();
    if (pins[pageId]) { delete pins[pageId]; } else { pins[pageId] = Date.now(); }
    _setPinnedIds(pins);
  }

  // ─── BADGES : pages partenaire non vues ───────────────────────────
  // Stocke en localStorage : { seenIds: {id: timestamp}, lastUpdateSeen: {id: updated_at} }
  function _getBadgeState() {
    var u = yamGetUser();
    if (!u) return { seenIds: {}, lastUpdateSeen: {} };
    try { return JSON.parse(localStorage.getItem('diary_badge_' + u.couple_id) || '{"seenIds":{},"lastUpdateSeen":{}}'); } catch(e) { return { seenIds: {}, lastUpdateSeen: {} }; }
  }
  function _saveBadgeState(state) {
    var u = yamGetUser();
    if (!u) return;
    try { localStorage.setItem('diary_badge_' + u.couple_id, JSON.stringify(state)); } catch(e) {}
  }
  // Marque une page comme vue (nouvelle page partagée)
  function _markPageSeen(pageId) {
    var state = _getBadgeState();
    state.seenIds[pageId] = Date.now();
    _saveBadgeState(state);
    _updateHomeBadge();
    _updateTabBadges();
  }
  // Marque une mise à jour comme vue (updated_at vu)
  function _markUpdateSeen(pageId, updatedAt) {
    var state = _getBadgeState();
    if (!state.lastUpdateSeen) state.lastUpdateSeen = {};
    state.lastUpdateSeen[pageId] = updatedAt;
    _saveBadgeState(state);
    _updateHomeBadge();
    _updateTabBadges();
  }
  // Compte les pages partenaire non vues (nouvelles)
  function _countNewPartnerPages() {
    var u = yamGetUser();
    if (!u) return 0;
    var me = getProfile();
    var partnerRole = me === 'girl' ? 'boy' : 'girl';
    var state = _getBadgeState();
    return _pages.filter(function(p) {
      return p.author_role === partnerRole && p.is_shared && !state.seenIds[p.id];
    }).length;
  }
  // Compte les pages co-écriture ou partagées avec mise à jour non vue
  function _countUpdatedPartnerPages() {
    var u = yamGetUser();
    if (!u) return 0;
    var me = getProfile();
    var partnerRole = me === 'girl' ? 'boy' : 'girl';
    var state = _getBadgeState();
    var updSeen = state.lastUpdateSeen || {};
    return _pages.filter(function(p) {
      if (!(p.author_role === partnerRole && p.is_shared)) return false;
      if (!p.updated_at) return false;
      // Déjà vu si on a déjà enregistré cet updated_at
      if (!state.seenIds[p.id]) return false; // nouvelle page → géré par _countNewPartnerPages
      var seenUpd = updSeen[p.id];
      return !seenUpd || seenUpd < p.updated_at;
    }).length;
  }
  // Met à jour le badge "NEW" sur la carte My Diary — même approche que le badge Boutique :
  // span #homeDiaryNewBadge en position:absolute dans un wrapper sans overflow:hidden
  function _updateHomeBadge() {
    var badge = document.getElementById('homeDiaryNewBadge');
    if (!badge) return;
    var count = _countNewPartnerPages() + _countUpdatedPartnerPages();
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : 'NEW';
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  function _bindHomeBadgeScroll() {} // no-op
  // Met à jour les badges sur les onglets "Mon journal" et "Partenaire"
  function _updateTabBadges() {
    // Badge onglet partenaire : nouvelles pages
    var newCount = _countNewPartnerPages();
    var updCount = _countUpdatedPartnerPages();
    var partnerBadge = document.querySelector('[data-diary-tab-badge="partner"]');
    if (partnerBadge) {
      var total = newCount + updCount;
      if (total > 0) {
        partnerBadge.textContent = total > 9 ? '9+' : String(total);
        partnerBadge.style.display = '';
      } else {
        partnerBadge.style.display = 'none';
      }
    }
  }

  // ─── 2. INIT ──────────────────────────────────────────────────────
  function _init() {
    if (_inited) return;
    _inited = true;
    _view = document.getElementById('diaryView');
    if (!_view) { console.error('[Diary] #diaryView introuvable'); return; }
    // Injecter le CSS dès l'init — nécessaire pour le mode lecture
    _injectEditorCSS();
    // Reset l'état visuel de la toolbar à l'ouverture
    setTimeout(function() { if (typeof _updateToolbarState === 'function') _updateToolbarState(); }, 100);

    document.addEventListener('yam:session_ready', function () {
      setTimeout(_initRT, 1200);
      // Charger les pages silencieusement pour afficher le badge dès l'accueil
      setTimeout(_loadPagesSilent, 1500);
    });
    document.addEventListener('yam:rt_ready', function () {
      setTimeout(_initRT, 600);
    });
    if (yamGetUser()) {
      setTimeout(_initRT, 2000);
      setTimeout(_loadPagesSilent, 2500);
    }

    yamLog('[Diary] Module initialisé');
  }

  // Chargement silencieux des pages pour le badge accueil (sans afficher le journal)
  function _loadPagesSilent() {
    var u = yamGetUser();
    if (!u || !u.couple_id) return;
    if (_pages.length > 0) { _updateHomeBadge(); return; } // déjà chargé
    sb2Fetch(DIARY_TBL, 'couple_id=eq.' + u.couple_id + '&order=created_at.desc')
      .then(function(rows) {
        _pages = Array.isArray(rows) ? rows : [];
        _updateHomeBadge();
        _updateTabBadges();
      })
      .catch(function() {});
  }

  // ─── 3. REALTIME ──────────────────────────────────────────────────
  function _initRT() {
    var u = yamGetUser();
    if (!u || !u.couple_id || !window._yamRT) return;
    if (window._yamRTChannels && window._yamRTChannels['diary_pages']) return;

    _rtChannel = window._yamRT
      .channel('diary_pages_' + u.couple_id)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: DIARY_TBL,
        filter: 'couple_id=eq.' + u.couple_id,
      }, function (payload) {
        yamLog('[RT] diary_pages', payload.eventType);
        if (payload.eventType === 'INSERT') {
          if (!_pages.find(function(p){ return p.id === payload.new.id; })) {
            _pages.unshift(payload.new);
          }
          // Badge : nouvelle page partenaire
          _updateHomeBadge();
          _updateTabBadges();
        } else if (payload.eventType === 'UPDATE') {
          _pages = _pages.map(function(p){ return p.id === payload.new.id ? payload.new : p; });
          // Si on est en train de lire/co-écrire cette page, mettre à jour live
          if (_currentPage && _currentPage.id === payload.new.id && _mode === 'read') {
            _currentPage = payload.new;
            _renderReadPage(_currentPage);
          }
          // Badge : mise à jour page partenaire
          _updateHomeBadge();
          _updateTabBadges();
        } else if (payload.eventType === 'DELETE') {
          _pages = _pages.filter(function(p){ return p.id !== payload.old.id; });
          _updateHomeBadge();
          _updateTabBadges();
        }
        // Re-render liste si visible
        if (_mode === 'list') _renderList();
      })
      .subscribe(function(status) {
        if (status === 'SUBSCRIBED') {
          yamLog('[RT] ✅ diary_pages connecté');
          _stopPoll();
        } else if (['CHANNEL_ERROR','TIMED_OUT','CLOSED'].indexOf(status) !== -1) {
          if (window._yamRTChannels) delete window._yamRTChannels['diary_pages'];
          yamLog('[RT] diary_pages perdu → fallback poll');
          _startPoll();
        }
      });

    if (window._yamRTChannels) window._yamRTChannels['diary_pages'] = _rtChannel;
  }

  function _startPoll() {
    if (_pollTimer) return;
    _pollTimer = setInterval(function() {
      if (_mode === 'list' || _mode === 'read') _loadPages(false);
    }, POLL_MS);
  }

  function _stopPoll() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  // ─── 4. OUVERTURE / FERMETURE ─────────────────────────────────────
  window.diaryOpen = function () {
    _init();
    var u = yamGetUser();
    if (!u) { showToast('Connecte-toi d\'abord 💕', 'error'); return; }

    var homeTab = document.getElementById('yamHomeTab');
    if (!_view) return;

    document.body.classList.add('subview-active');
    _yamSlide(_view, homeTab, 'forward');
    haptic('light');

    _mode = 'list';
    _tab  = 'mine';
    _loadPages(true);
  };

  window.diaryClose = function () {
    _stopPoll();
    _stopCommentRT();
    _mode = 'list';
    _currentPage = null;

    var homeTab = document.getElementById('yamHomeTab');
    if (!_view || !homeTab) return;

    document.body.classList.remove('subview-active');
    _yamSlide(homeTab, _view, 'backward');
    homeTab.classList.add('active');

    // _yamSlide retire .active après DUR+50ms — pas besoin de forcer display
    haptic('light');
  };

  // ─── 5. CHARGEMENT ────────────────────────────────────────────────
  function _loadPages(showSkeleton) {
    var u = yamGetUser();
    if (!u || !u.couple_id) return;
    if (showSkeleton) _renderSkeleton();

    sb2Fetch(DIARY_TBL, 'couple_id=eq.' + u.couple_id + '&order=created_at.desc')
      .then(function(rows) {
        _pages = Array.isArray(rows) ? rows : [];
        if (_mode === 'list') _renderList();
        _updateHomeBadge();
        _updateTabBadges();
      })
      .catch(function() {
        if (_mode === 'list') _renderList();
      });
  }

  // ─── 6. RENDU LISTE ───────────────────────────────────────────────
  function _renderSkeleton() {
    if (!_view) return;
    _view.innerHTML =
      '<div style="display:flex;flex-direction:column;height:100%;background:var(--bg);">' +
        _headerHTML('My Diary', true) +
        '<div style="flex:1;display:flex;align-items:center;justify-content:center;">' +
          '<div style="font-size:28px;animation:bkPulse 1.4s ease-in-out infinite;">📖</div>' +
        '</div>' +
      '</div>';
    _bindHeaderBack();
  }

  function _renderList() {
    if (!_view) return;
    var me = getProfile();
    var partnerRole = me === 'girl' ? 'boy' : 'girl';
    var myPages      = _pages.filter(function(p){ return p.author_role === me; });
    var partnerPages = _pages.filter(function(p){ return p.author_role === partnerRole && p.is_shared; });

    // Trier : épinglés en tête, puis par date décroissante
    var pins = _getPinnedIds();
    function _sortWithPins(list) {
      return list.slice().sort(function(a, b) {
        var aPin = pins[a.id] || 0;
        var bPin = pins[b.id] || 0;
        if (aPin && !bPin) return -1;
        if (!aPin && bPin) return 1;
        if (aPin && bPin) return bPin - aPin; // plus récemment épinglé en premier
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
    myPages      = _sortWithPins(myPages);
    partnerPages = _sortWithPins(partnerPages);

    var newCount = _countNewPartnerPages();
    var updCount = _countUpdatedPartnerPages();
    var totalBadge = newCount + updCount;

    var html = '<div style="display:flex;flex-direction:column;height:100%;background:var(--bg);overflow:hidden;">';

    // Header
    html += _headerHTMLWithTheme('My Diary 📖');

    // Tabs
    html += '<div style="display:flex;gap:0;flex-shrink:0;padding:0 16px 0;margin-top:4px;">' +
      _tabBtn('mine',    '💌 Mon journal', _tab === 'mine',    myPages.length, 0) +
      _tabBtn('partner', '💌 ' + escHtml(yamGetDisplayName(partnerRole)), _tab === 'partner', partnerPages.length, totalBadge) +
    '</div>';

    html += '<div id="diaryListScroll" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 16px 80px;">';

    var list = _tab === 'mine' ? myPages : partnerPages;

    if (list.length === 0) {
      html += _emptyState(_tab === 'mine');
    } else {
      var pinnedList = list.filter(function(p) { return _isPinned(p.id); });
      var normalList = list.filter(function(p) { return !_isPinned(p.id); });

      html += '<div style="display:flex;flex-direction:column;gap:12px;">';

      // ── Pages épinglées ──
      if (pinnedList.length > 0) {
        pinnedList.forEach(function(page) { html += _pageCard(page, me); });

        // Séparateur uniquement s'il y a aussi des pages normales
        if (normalList.length > 0) {
          html += '<div style="height:1px;background:var(--border);margin:4px 0;"></div>';
        }
      }

      // ── Pages normales ──
      normalList.forEach(function(page) { html += _pageCard(page, me); });

      html += '</div>';
    }

    html += '</div>'; // fin diaryListScroll

    // FAB bouton nouvelle page (seulement dans "Mon journal") — DANS le container
    if (_tab === 'mine') {
      html += '<button id="diaryFab" style="position:fixed;right:20px;bottom:calc(var(--nav-height) + 16px);' +
        'width:54px;height:54px;border-radius:50%;' +
        'background:linear-gradient(135deg,var(--accent),#c94f6f);' +
        'border:none;cursor:pointer;box-shadow:0 4px 20px rgba(231,90,124,0.45);' +
        'display:flex;align-items:center;justify-content:center;z-index:10;' +
        'transition:transform 0.15s,box-shadow 0.15s;">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round">' +
          '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>' +
        '</svg></button>';
    }

    html += '</div>'; // fin container principal

    _view.innerHTML = html;
    _bindHeaderBack();
    _bindListEvents();
  }

  function _tabBtn(id, label, active, count, badgeCount) {
    return '<button data-diary-tab="' + id + '" style="flex:1;padding:8px 4px;' +
      'font-size:12px;font-weight:' + (active ? '700' : '500') + ';' +
      'color:' + (active ? 'var(--accent)' : 'var(--muted)') + ';' +
      'background:none;border:none;border-bottom:2px solid ' + (active ? 'var(--accent)' : 'transparent') + ';' +
      'cursor:pointer;font-family:DM Sans,sans-serif;transition:all 0.18s;' +
      'display:flex;align-items:center;justify-content:center;gap:4px;">' +
      escHtml(label) +
      (count > 0 ? '<span style="background:' + (active ? 'var(--accent)' : 'var(--muted)') + ';color:#fff;' +
        'border-radius:9px;padding:0 5px;font-size:9px;line-height:16px;">' + count + '</span>' : '') +
      (badgeCount > 0 ? '<span data-diary-tab-badge="' + id + '" style="background:#ff3b30;color:#fff;' +
        'border-radius:9px;padding:0 5px;font-size:9px;line-height:16px;font-weight:800;' +
        'animation:diaryBadgePulse 1.5s ease-in-out infinite;">' + (badgeCount > 9 ? '9+' : badgeCount) + '</span>' : '') +
    '</button>';
  }

  function _emptyState(isMine) {
    return '<div style="text-align:center;padding:60px 24px;color:var(--muted);">' +
      '<div style="font-size:56px;margin-bottom:16px;filter:drop-shadow(0 4px 12px rgba(231,90,124,0.25));">📔</div>' +
      '<div style="font-size:17px;font-weight:700;color:var(--text);margin-bottom:8px;">' +
        (isMine ? 'Ton journal t\'attend' : 'Aucune page partagée') + '</div>' +
      '<div style="font-size:13px;line-height:1.6;">' +
        (isMine ? 'Crée ta première page :<br>texte riche, photos, ou importe depuis Canva' :
                  'Quand ton/ta partenaire partagera<br>une page, elle apparaîtra ici') +
      '</div></div>';
  }

  function _pageCard(page, me) {
    var isOwn    = page.author_role === me;
    var canEdit  = isOwn || page.partner_can_edit;
    var coverBg  = page.cover_color || '#fce4eb';
    var coverEmoji = page.cover_emoji || '📖';
    var isCanva  = !!page.canva_url;
    var date     = new Date(page.created_at).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' });
    var hasImg   = page.bg_image_url || (page.images && JSON.parse(page.images || '[]').length > 0);
    var pinned   = _isPinned(page.id);
    var state    = _getBadgeState();
    var isNewForMe = !isOwn && !state.seenIds[page.id];
    var hasUpdateForMe = !isOwn && !isNewForMe && page.updated_at &&
      (!state.lastUpdateSeen || !state.lastUpdateSeen[page.id] || state.lastUpdateSeen[page.id] < page.updated_at);

    // Infos de dernière modification pour co-écriture
    var lastEditInfo = '';
    if (page.partner_can_edit && page.updated_at && page.last_editor_role) {
      var updDate = new Date(page.updated_at).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
      var editorName = yamGetDisplayName(page.last_editor_role);
      lastEditInfo = '<div style="font-size:10px;color:var(--muted);margin-top:2px;">' +
        '✏️ ' + escHtml(editorName) + ' · ' + escHtml(updDate) + '</div>';
    }

    return '<div style="position:relative;overflow:visible;padding-top:10px;">' +

      // Badge nouveau / mis à jour — hors de la carte, dans le wrapper
      (isNewForMe ? '<span style="position:absolute;top:0;right:28px;z-index:4;' +
        'background:var(--accent);color:#fff;font-size:9px;font-weight:800;' +
        'border-radius:8px;padding:2px 6px;box-shadow:var(--sh-sm);' +
        'animation:diaryBadgePulse 1.5s ease-in-out infinite;">NOUVEAU ✨</span>' : '') +
      (hasUpdateForMe ? '<span style="position:absolute;top:0;right:28px;z-index:4;' +
        'background:#ff9500;color:#fff;font-size:9px;font-weight:800;' +
        'border-radius:8px;padding:2px 6px;box-shadow:var(--sh-sm);' +
        'animation:diaryBadgePulse 1.5s ease-in-out infinite;">MIS À JOUR 🔄</span>' : '') +

      // Carte — overflow:hidden pour ne pas bloquer le scroll iOS
      '<div data-diary-open="' + escHtml(page.id) + '" style="' +
        'display:flex;gap:12px;align-items:stretch;' +
        'background:var(--s1);border:1px solid ' + (isNewForMe || hasUpdateForMe ? 'var(--accent)' : 'var(--border)') + ';border-radius:18px;' +
        'overflow:hidden;cursor:pointer;box-shadow:' + (isNewForMe || hasUpdateForMe ? '0 0 0 2px var(--accent-s),' : '') + 'var(--sh-sm);' +
        'transition:transform 0.15s,box-shadow 0.15s;position:relative;">' +

        // Épingle (coin bas-droit) — dans la carte, overflow:hidden la garde à l'intérieur
        '<button data-diary-pin="' + escHtml(page.id) + '" title="' + (pinned ? 'Désépingler' : 'Épingler en tête') + '" ' +
          'style="position:absolute;bottom:8px;right:8px;z-index:4;width:24px;height:24px;' +
          'border-radius:6px;' +
          (pinned
            ? 'background:var(--accent);border:none;opacity:1;'
            : 'background:transparent;border:none;opacity:0.3;') +
          'display:flex;align-items:center;justify-content:center;cursor:pointer;' +
          'transition:opacity 0.2s,background 0.2s;">' +
          '<svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M7 1C5.34 1 4 2.34 4 4c0 1.1.47 2.08 1.22 2.77L4.5 9H2v1.5h4.25V15l.75.75.75-.75v-4.25H12V9H9.5L8.78 6.77C9.53 6.08 10 5.1 10 4c0-1.66-1.34-3-3-3z" ' +
              'fill="' + (pinned ? '#fff' : 'var(--text)') + '"/>' +
          '</svg>' +
        '</button>' +

      // Couverture miniature
      '<div style="width:72px;flex-shrink:0;background:' + escHtml(coverBg) + ';' +
        'display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;' +
        'position:relative;border-radius:18px 0 0 18px;overflow:hidden;">' +
        '<span style="font-size:28px;">' + escHtml(coverEmoji) + '</span>' +
        (page.mood ? '<span style="font-size:14px;">' + escHtml(page.mood) + '</span>' : '') +
        (isCanva ? '<div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.45);' +
          'border-radius:4px;padding:1px 4px;font-size:8px;color:#fff;font-weight:700;">CANVA</div>' : '') +
      '</div>' +

      // Infos
      '<div style="flex:1;min-width:0;padding:12px 36px 12px 0;display:flex;flex-direction:column;gap:4px;">' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
          '<span style="font-size:14px;font-weight:700;color:var(--text);' +
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">' +
            escHtml(page.title || 'Sans titre') + '</span>' +
          (page.is_shared ? '<span style="font-size:9px;background:var(--accent-s);color:var(--accent);' +
            'border-radius:6px;padding:2px 6px;flex-shrink:0;font-weight:700;">PARTAGÉ</span>' : '') +
          (page.partner_can_edit ? '<span style="font-size:9px;background:rgba(90,200,250,0.15);color:var(--sage);' +
            'border-radius:6px;padding:2px 6px;flex-shrink:0;font-weight:700;">CO-ÉCRITURE</span>' : '') +
        '</div>' +
        '<div style="font-size:11px;color:var(--muted);">' + escHtml(date) + '</div>' +
        lastEditInfo +
        (page.content && !isCanva ? '<div style="font-size:12px;color:var(--sub);line-height:1.4;' +
          'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' +
          _stripHTML(page.content).substring(0, 120) + '</div>' : '') +
        (isCanva ? '<div style="font-size:11px;color:var(--muted);">📐 Présentation Canva</div>' : '') +
      '</div>' +    // fin zone infos

    '</div>' +      // fin carte intérieure (overflow:hidden)
    '</div>';       // fin wrapper (overflow:visible)
  }

  function _bindListEvents() {
    // Fix1 — Thème toggle : délègue directement à applyThemeToggle (app-core.js)
    // applyThemeToggle gère lui-même l'affichage de toutes les icônes .gvh-moon/.gvh-sun
    var _themeBtn = document.getElementById('diaryThemeToggle');
    if (_themeBtn) {
      _themeBtn.addEventListener('click', function() {
        if (typeof window.applyThemeToggle === 'function') {
          window.applyThemeToggle();
        }
      });
    }

    // Tab switch
    _view.querySelectorAll('[data-diary-tab]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _tab = this.getAttribute('data-diary-tab');
        _renderList();
      });
    });

    // Épingler / désépingler une page
    _view.querySelectorAll('[data-diary-pin]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation(); // ne pas ouvrir la page
        var id = this.getAttribute('data-diary-pin');
        _togglePin(id);
        haptic('light');
        _renderList();
      });
      btn.addEventListener('touchend', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var id = this.getAttribute('data-diary-pin');
        _togglePin(id);
        haptic('light');
        _renderList();
      }, { passive: false });
    });

    // Ouvrir une page — bloque si clic/touch sur le bouton épingle
    _view.querySelectorAll('[data-diary-open]').forEach(function(card) {
      // click (desktop + délégué)
      card.addEventListener('click', function(e) {
        if (e.target.closest('[data-diary-pin]')) return;
        var id = this.getAttribute('data-diary-open');
        var page = _pages.find(function(p){ return p.id === id; });
        if (page) _openReadPage(page);
      });
      // touchend iOS — nécessaire pour bloquer aussi le touch sur le pin
      card.addEventListener('touchend', function(e) {
        if (e.target.closest('[data-diary-pin]')) return;
        // laisser le click natif se produire normalement
      }, { passive: true });
    });

    // FAB nouvelle page
    var fab = document.getElementById('diaryFab');
    if (fab) {
      fab.addEventListener('click', _openNewPage);
      fab.addEventListener('touchstart', function() { this.style.transform = 'scale(0.93)'; }, { passive: true });
      fab.addEventListener('touchend',   function() { this.style.transform = ''; }, { passive: true });
    }
  }

  // ─── 7. LECTURE D'UNE PAGE ────────────────────────────────────────
  function _openReadPage(page) {
    _currentPage = page;
    _mode = 'read';

    // Marquer comme vu si c'est une page partenaire
    var me = getProfile();
    if (page.author_role !== me) {
      _markPageSeen(page.id);
      if (page.updated_at) _markUpdateSeen(page.id, page.updated_at);
    }

    _renderReadPage(page);

    // Charger les commentaires en RT
    _initCommentRT(page.id);
  }

  function _renderReadPage(page) {
    if (!_view) return;
    var me      = getProfile();
    var isOwn   = page.author_role === me;
    var canEdit = isOwn || page.partner_can_edit;
    var isCanva = !!page.canva_url;
    var coverBg = page.cover_color || '#fce4eb';

    var html = '<div id="diaryReadWrap" style="display:flex;flex-direction:column;height:100%;background:var(--bg);overflow:hidden;">';

    var _readPinned = _isPinned(page.id);

    // Header lecture
    html += '<div style="flex-shrink:0;background:var(--bg);border-bottom:1px solid var(--border);' +
      'padding:calc(var(--safe-top,0px) + 10px) 16px 10px;">' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<button id="diaryReadBack" style="width:34px;height:34px;border-radius:50%;background:var(--s2);' +
          'border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;">' +
          '<svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="var(--text)" stroke-width="2" stroke-linecap="round"><polyline points="7 1 1 7 7 13"/></svg>' +
        '</button>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:15px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(page.title || 'Sans titre') + '</div>' +
          '<div style="font-size:10px;color:var(--muted);">' +
            new Date(page.created_at).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'}) +
            (page.mood ? ' · ' + escHtml(page.mood) : '') +
            (page.partner_can_edit && page.updated_at && page.last_editor_role
              ? ' · ✏️ ' + escHtml(yamGetDisplayName(page.last_editor_role)) + ' · ' +
                new Date(page.updated_at).toLocaleDateString('fr-FR', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
              : '') +
          '</div>' +
        '</div>' +
        // Bouton pin — toujours présent (Canva ET texte)
        '<button id="diaryReadPin" title="' + (_readPinned ? 'Désépingler' : 'Épingler en tête') + '" ' +
          'style="width:34px;height:34px;border-radius:50%;flex-shrink:0;cursor:pointer;' +
          'border:1.5px solid ' + (_readPinned ? 'var(--accent)' : 'var(--border)') + ';' +
          'background:' + (_readPinned ? 'var(--accent)' : 'var(--s2)') + ';' +
          'display:flex;align-items:center;justify-content:center;transition:all 0.2s;">' +
          '<svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M7 1C5.34 1 4 2.34 4 4c0 1.1.47 2.08 1.22 2.77L4.5 9H2v1.5h4.25V15l.75.75.75-.75v-4.25H12V9H9.5L8.78 6.77C9.53 6.08 10 5.1 10 4c0-1.66-1.34-3-3-3z" ' +
              'fill="' + (_readPinned ? '#fff' : 'var(--muted)') + '"/>' +
          '</svg>' +
        '</button>' +
        (canEdit ? '<button id="diaryReadEdit" style="padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;' +
          'border:1px solid var(--accent);background:var(--accent-s);color:var(--accent);cursor:pointer;' +
          'font-family:DM Sans,sans-serif;flex-shrink:0;">✏️ Modifier</button>' : '') +
      '</div></div>';

    // Corps — Canva ou texte riche
    html += '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:calc(var(--safe-bottom,0px) + 80px);">';

    if (isCanva && page.canva_url) {
      var _rEmbedUrl = _sanitizeCanvaUrl(page.canva_url);
      // Afficher l'iframe directement si on a un lien embedable
      if (_rEmbedUrl) {
        html += '<div style="position:relative;width:100%;">' +
          '<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;">' +
            '<iframe src="' + escHtml(_rEmbedUrl) + '" ' +
              'style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" ' +
              'allowfullscreen allow="fullscreen">' +
            '</iframe>' +
          '</div>' +
          // Bouton plein écran YAM — remplace le bouton natif iOS qui sort de l'app
          '<button id="diaryCanvaFullscreen" data-canva-url="' + escHtml(page.canva_url) + '" ' +
            'style="position:absolute;bottom:10px;right:10px;' +
            'width:34px;height:34px;border-radius:10px;border:none;cursor:pointer;' +
            'background:rgba(0,0,0,0.5);color:#fff;font-size:16px;' +
            'display:flex;align-items:center;justify-content:center;' +
            'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:2;">' +
            '⛶' +
          '</button>' +
        '</div>';
      } else {
        // Pas de lien embedable → carte avec bouton Voir
        html += '<div id="diaryCanvaCard" data-canva-url="' + escHtml(page.canva_url) + '" style="margin:16px;">' +
          _canvaCard(page.canva_url) +
        '</div>';
      }
      if (page.content) {
        html += '<div style="padding:0 18px 4px;">' +
          '<div class="diary-rich-content">' + _sanitizeHTML(page.content) + '</div>' +
        '</div>';
      }
    } else {
      // Couverture déco
      // Si image de fond : afficher UNIQUEMENT l'image (opacité pleine), pas l'emoji
      // Si pas d'image : afficher l'emoji centré sur fond coloré
      html += '<div style="background:' + escHtml(coverBg) + ';' +
        'min-height:120px;display:flex;align-items:center;justify-content:center;font-size:52px;' +
        'position:relative;overflow:hidden;">' +
        (page.bg_image_url
          ? '<img src="' + escHtml(page.bg_image_url) + '" alt="" ' +
            'style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:1;">'
          : '<span style="filter:drop-shadow(0 2px 8px rgba(0,0,0,0.15));z-index:1;">' + escHtml(page.cover_emoji || '📖') + '</span>'
        ) +
      '</div>' +
      '<div style="padding:18px 18px 4px;">' +
        '<div class="diary-rich-content" style="font-size:15px;line-height:1.8;color:var(--text);">' +
          (page.content ? _sanitizeHTML(page.content) : '<em style="color:var(--muted);">Page vide</em>') +
        '</div>' +
      '</div>';
    }

    // Fix5: galerie images supprimée — les images sont dans le contenu HTML (diary-rich-content)

    // Section commentaires / co-écriture
    html += '<div style="padding:0 18px 16px;">';
    html += '<div style="font-size:12px;font-weight:700;color:var(--muted);margin:16px 0 8px;' +
      'text-transform:uppercase;letter-spacing:0.5px;">Commentaires</div>';
    html += '<div id="diaryCommentsList" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">';
    html += '<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px 0;">Chargement…</div>';
    html += '</div>';

    // Champ commentaire
    html += '<div style="display:flex;gap:8px;align-items:flex-end;">' +
      '<textarea id="diaryCommentInput" placeholder="Ajouter un commentaire…" ' +
        'style="flex:1;padding:10px 12px;border-radius:14px;border:1px solid var(--border);' +
        'background:var(--s2);color:var(--text);font-size:13px;font-family:DM Sans,sans-serif;' +
        'resize:none;min-height:40px;max-height:100px;outline:none;line-height:1.4;" ' +
        'rows="1"></textarea>' +
      '<button id="diaryCommentSend" style="width:36px;height:36px;border-radius:50%;' +
        'background:var(--accent);border:none;cursor:pointer;flex-shrink:0;' +
        'display:flex;align-items:center;justify-content:center;">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M2 21L23 12 2 3v7l15 2-15 2z"/></svg>' +
      '</button>' +
    '</div>';
    html += '</div>'; // padding wrapper

    html += '</div>'; // scroll
    html += '</div>'; // readWrap
    _view.innerHTML = html;

    // Fixer les couleurs des puces en mode lecture
    setTimeout(function() {
      var rc = document.querySelector('.diary-rich-content');
      if (rc) _fixListColors(rc);
    }, 50);

    // Binder le bouton plein écran Canva inline
    if (isCanva && page.canva_url) {
      setTimeout(function() {
        var fsBtn = document.getElementById('diaryCanvaFullscreen');
        if (fsBtn) {
          var _cu = fsBtn.getAttribute('data-canva-url');
          fsBtn.addEventListener('click', function() { _openCanvaViewer(_cu); });
          fsBtn.addEventListener('touchend', function(e) {
            e.preventDefault(); _openCanvaViewer(_cu);
          }, { passive: false });
        }
        // Enrichir la carte oEmbed si fallback
        var card = document.getElementById('diaryCanvaCard');
        if (card) _loadCanvaOembed(card, page.canva_url, true);
      }, 200);
    }

    // Events lecture
    var backBtn = document.getElementById('diaryReadBack');
    if (backBtn) backBtn.addEventListener('click', function() {
      _mode = 'list';
      _currentPage = null;
      _stopCommentRT();
      _renderList();
    });

    var pinBtn = document.getElementById('diaryReadPin');
    if (pinBtn) {
      pinBtn.addEventListener('click', function() {
        _togglePin(page.id);
        haptic('light');
        // Re-render le bouton pin seulement (évite de re-render toute la page)
        var nowPinned = _isPinned(page.id);
        pinBtn.title = nowPinned ? 'Désépingler' : 'Épingler en tête';
        pinBtn.style.background = nowPinned ? 'var(--accent)' : 'var(--s2)';
        pinBtn.style.borderColor = nowPinned ? 'var(--accent)' : 'var(--border)';
        var svg = pinBtn.querySelector('path');
        if (svg) svg.setAttribute('fill', nowPinned ? '#fff' : 'var(--text)');
      });
    }

    var editBtn = document.getElementById('diaryReadEdit');
    if (editBtn) editBtn.addEventListener('click', function() {
      _openEditPage(_currentPage);
    });

    // Lightbox images
    _view.querySelectorAll('[data-diary-img-full]').forEach(function(img) {
      img.addEventListener('click', function() {
        _openLightbox(this.getAttribute('data-diary-img-full'));
      });
    });

    // Commentaire
    var sendBtn = document.getElementById('diaryCommentSend');
    if (sendBtn) sendBtn.addEventListener('click', _sendComment);

    var commentInput = document.getElementById('diaryCommentInput');
    if (commentInput) {
      commentInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _sendComment(); }
      });
      commentInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
      });
    }

    // Charger les commentaires
    _loadComments(page.id);
  }

  // ─── 8. COMMENTAIRES ──────────────────────────────────────────────
  function _loadComments(pageId) {
    sb2Fetch(COMMENT_TBL, 'page_id=eq.' + pageId + '&order=created_at.asc')
      .then(function(rows) { _renderComments(rows || []); })
      .catch(function() { _renderComments([]); });
  }

  function _renderComments(rows) {
    var list = document.getElementById('diaryCommentsList');
    if (!list) return;
    var me = getProfile();
    if (rows.length === 0) {
      list.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px 0;">Aucun commentaire encore ✨</div>';
      return;
    }
    list.innerHTML = rows.map(function(c) {
      var isMe = c.author_role === me;
      var date = new Date(c.created_at).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
      // Fix6: bouton suppression sur ses propres commentaires
      return '<div style="display:flex;flex-direction:column;align-items:' + (isMe ? 'flex-end' : 'flex-start') + ';gap:2px;">' +
        '<div style="font-size:9px;color:var(--muted);display:flex;align-items:center;gap:5px;">' +
          escHtml(yamGetDisplayName(c.author_role)) + ' · ' + date +
          (isMe ? ' <button data-diary-del-comment="' + escHtml(c.id) + '" ' +
            'style="background:none;border:none;cursor:pointer;color:rgba(255,59,48,0.75);' +
            'font-size:11px;padding:0 2px;line-height:1;flex-shrink:0;" title="Supprimer mon commentaire">✕</button>' : '') +
        '</div>' +
        '<div style="max-width:85%;padding:8px 12px;border-radius:' + (isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px') + ';' +
          'background:' + (isMe ? 'var(--accent)' : 'var(--s2)') + ';' +
          'color:' + (isMe ? '#fff' : 'var(--text)') + ';' +
          'font-size:13px;line-height:1.4;">' +
          escHtml(c.content) +
        '</div>' +
      '</div>';
    }).join('');

    // Fix6: lier les boutons de suppression
    list.querySelectorAll('[data-diary-del-comment]').forEach(function(delBtn) {
      delBtn.addEventListener('click', function() {
        _deleteComment(this.getAttribute('data-diary-del-comment'));
      });
    });
  }

  // Fix6 — Supprimer un commentaire (auteur uniquement — RLS Supabase)
  function _deleteComment(commentId) {
    if (!commentId || !_currentPage) return;
    sb2Delete(COMMENT_TBL, 'id=eq.' + commentId)
      .then(function() {
        haptic('light');
        _loadComments(_currentPage.id);
      })
      .catch(function() { showToast('Erreur suppression', 'error'); });
  }

  var _commentRTCh = null;
  function _initCommentRT(pageId) {
    _stopCommentRT();
    if (!window._yamRT) return;
    var u = yamGetUser();
    if (!u) return;

    _commentRTCh = window._yamRT
      .channel('diary_comments_' + pageId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: COMMENT_TBL,
        filter: 'page_id=eq.' + pageId,
      }, function() { _loadComments(pageId); })
      .subscribe();
  }

  function _stopCommentRT() {
    if (_commentRTCh && window._yamRT) {
      try { window._yamRT.removeChannel(_commentRTCh); } catch(e) {}
      _commentRTCh = null;
    }
  }

  function _sendComment() {
    var input = document.getElementById('diaryCommentInput');
    if (!input) return;
    var text = input.value.trim();
    if (!text || !_currentPage) return;

    var u = yamGetUser();
    if (!u) return;

    input.value = '';
    input.style.height = '';

    sb2Post(COMMENT_TBL, {
      couple_id:   u.couple_id,
      page_id:     _currentPage.id,
      author_role: u.role,
      content:     text.substring(0, 2000),
    }).then(function() {
      _loadComments(_currentPage.id);
      haptic('light');
    }).catch(function() {
      showToast('Erreur envoi commentaire', 'error');
    });
  }

  // ─── 9. ÉDITEUR DE PAGE ───────────────────────────────────────────
  function _openNewPage() {
    _currentPage = null;
    _editorImages = [];
    _openEditPage(null);
  }

  function _openEditPage(page) {
    _mode = 'edit';
    _currentPage = page;
    _editorImages = [];
    // Fix2: mémoriser l'emoji de couverture dès l'ouverture
    _editorCoverEmoji = (page && page.cover_emoji) ? page.cover_emoji : null;

    try {
      if (page && page.images) _editorImages = JSON.parse(page.images);
    } catch(e) {}

    _renderEditor(page);
  }

  function _renderEditor(page) {
    if (!_view) return;
    var isNew   = !page;
    var isCanva = page && !!page.canva_url;
    var coverBg = (page && page.cover_color) || '#fce4eb';

    var html = '<div style="display:flex;flex-direction:column;height:100%;background:var(--bg);overflow:hidden;">';

    // Header éditeur — dans le flux
    html += '<div style="flex-shrink:0;background:var(--bg);border-bottom:1px solid var(--border);' +
      'padding:calc(var(--safe-top,0px) + 10px) 16px 10px;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<button id="diaryEditorBack" style="width:34px;height:34px;border-radius:50%;background:var(--s2);' +
          'border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;">' +
          '<svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="var(--text)" stroke-width="2" stroke-linecap="round"><polyline points="7 1 1 7 7 13"/></svg>' +
        '</button>' +
        '<div style="flex:1;font-size:15px;font-weight:700;color:var(--text);">' +
          (isNew ? 'Nouvelle page' : 'Modifier la page') +
        '</div>' +
        '<button id="diaryEditorSave" style="padding:7px 16px;border-radius:20px;font-size:12px;font-weight:700;' +
          'background:var(--accent);color:#fff;border:none;cursor:pointer;font-family:DM Sans,sans-serif;">' +
          '💾 Sauver' +
        '</button>' +
      '</div></div>';

    html += '<div id="diaryEditorScroll" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px;">';

    // ── Titre ──
    html += '<div style="margin-bottom:14px;">' +
      '<input id="diaryEditorTitle" type="text" placeholder="Titre de ta page…" maxlength="100" ' +
        'style="width:100%;padding:12px 14px;border-radius:14px;border:1.5px solid var(--border);' +
        'background:var(--s1);color:var(--text);font-size:16px;font-weight:700;' +
        'font-family:DM Sans,sans-serif;outline:none;" ' +
        'value="' + escHtml(page ? (page.title || '') : '') + '">' +
    '</div>';

    // ── Couverture + Humeur ──
    html += '<div style="display:flex;gap:10px;margin-bottom:14px;">';

    // Couleur couverture
    html += '<div style="flex:1;">' +
      '<div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px;">Couverture</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
    // Fix2 : emoji couverture courant (peut être custom, différent de la palette)
    var _currentCoverEmoji = (page && page.cover_emoji) ? page.cover_emoji : null;
    COVER_PALETTES.forEach(function(p, i) {
      var selected = page ? page.cover_color === p.bg : (i === 0);
      // Si ce bouton est sélectionné et que la page a un emoji custom, l'afficher
      var displayEmoji = (selected && _currentCoverEmoji) ? _currentCoverEmoji : p.emoji;
      // data-cover-emoji porte l'emoji AFFICHÉ (custom ou palette)
      html += '<button data-cover-bg="' + escHtml(p.bg) + '" data-cover-emoji="' + escHtml(displayEmoji) + '" ' +
        'style="width:30px;height:30px;border-radius:50%;' +
        'background:' + escHtml(p.bg) + ';' +
        'border:' + (selected ? '2.5px solid var(--accent)' : '2px solid transparent') + ';' +
        'cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;' +
        'box-shadow:' + (selected ? '0 0 0 2px var(--accent-s)' : 'var(--sh-sm)') + ';" ' +
        'title="' + escHtml(p.label) + '">' +
        escHtml(displayEmoji) +
      '</button>';
    });
      // Bouton (+) dans un wrapper relatif pour ancrer le picker en absolu
      html += '<div id="diaryCoverEmojiWrap" style="position:relative;display:inline-block;">';
      html += '<button id="diaryAddCoverEmoji" ' +
        'style="width:30px;height:30px;border-radius:50%;' +
        'background:var(--s2);border:1.5px dashed var(--accent);' +
        'cursor:pointer;display:flex;align-items:center;justify-content:center;' +
        'font-size:14px;font-weight:800;color:var(--accent);">+</button>';
      // Picker emoji couverture en position absolue (ne repousse rien)
      html += _buildCoverEmojiPicker();
      html += '</div>';
    html += '</div>';

    html += '</div>';

    // Humeur
    html += '<div>' +
      '<div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px;">Humeur</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:5px;max-width:140px;">';
    MOODS.forEach(function(m) {
      var selected = page && page.mood === m;
      html += '<button data-mood="' + escHtml(m) + '" ' +
        'style="width:28px;height:28px;border-radius:8px;font-size:16px;' +
        'border:' + (selected ? '2px solid var(--accent)' : '1.5px solid var(--border)') + ';' +
        'background:' + (selected ? 'var(--accent-s)' : 'var(--s2)') + ';' +
        'cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
        escHtml(m) +
      '</button>';
    });
    html += '</div></div>';
    html += '</div>'; // fin flex couverture+humeur

    // ── Toggle mode : Texte riche / Canva ──
    html += '<div style="display:flex;gap:0;margin-bottom:14px;border:1.5px solid var(--border);' +
      'border-radius:14px;overflow:hidden;background:var(--s2);">' +
      '<button id="diaryModeText" style="flex:1;padding:8px;font-size:12px;font-weight:700;cursor:pointer;' +
        'font-family:DM Sans,sans-serif;border:none;' +
        'background:' + (!isCanva ? 'var(--s1)' : 'transparent') + ';' +
        'color:' + (!isCanva ? 'var(--accent)' : 'var(--muted)') + ';' +
        'border-radius:12px 0 0 12px;">✍️ Texte riche</button>' +
      '<button id="diaryModeCanva" style="flex:1;padding:8px;font-size:12px;font-weight:700;cursor:pointer;' +
        'font-family:DM Sans,sans-serif;border:none;' +
        'background:' + (isCanva ? 'var(--s1)' : 'transparent') + ';' +
        'color:' + (isCanva ? 'var(--accent)' : 'var(--muted)') + ';' +
        'border-radius:0 12px 12px 0;">📐 Canva</button>' +
    '</div>';

    // ── Zone texte riche ──
    html += '<div id="diaryTextSection" style="display:' + (isCanva ? 'none' : 'block') + ';">';
    // (toolbar déplacée en position:fixed bas — voir après le scroll)

    // Couleur picker (hidden)
    html += '<div id="diaryColorPicker" style="display:none;flex-wrap:wrap;gap:6px;' +
      'padding:8px;background:var(--s1);border-radius:10px;border:1px solid var(--border);margin-bottom:8px;">' +
      // Bouton reset couleur (texte barré)
      '<button data-diary-color="reset" title="Supprimer la couleur" ' +
        'style="width:26px;height:26px;border-radius:50%;background:var(--s2);' +
        'border:2px solid var(--border);cursor:pointer;position:relative;overflow:hidden;' +
        'display:flex;align-items:center;justify-content:center;">' +
        '<svg width="20" height="20" viewBox="0 0 20 20" fill="none">' +
          '<line x1="3" y1="3" x2="17" y2="17" stroke="#ff3b30" stroke-width="2.2" stroke-linecap="round"/>' +
        '</svg>' +
      '</button>' +
      // Palette couleurs — rose foncé bien différencié de rose clair
      ['#c0194a','#f06688','#5ac8fa','#7c6af7','#34c759','#ff9500','#ff3b30','#636366',
       '#ffd700','#a2845e','#20c997','#fd7f6f'].map(function(c) {
        return '<button data-diary-color="' + c + '" ' +
          'style="width:26px;height:26px;border-radius:50%;background:' + c + ';' +
          'border:2px solid var(--border);cursor:pointer;position:relative;" ' +
          'title="' + c + '">' +
          // Indicateur actif injecté dynamiquement via JS
        '</button>';
      }).join('') +
    '</div>';

    // Menu liste (hidden) — 3 types de puces
    html += '<div id="diaryListMenu" style="display:none;gap:6px;' +
      'padding:6px 8px;background:var(--s1);border-radius:10px;border:1px solid var(--border);margin-bottom:8px;">' +
      '<button data-diary-list-type="disc" style="flex:1;padding:5px 8px;border-radius:8px;' +
        'border:1px solid var(--border);background:var(--s2);cursor:pointer;font-size:12px;' +
        'font-family:DM Sans,sans-serif;color:var(--text);display:flex;align-items:center;gap:5px;">' +
        '<span style="font-size:16px;">•</span> Points</button>' +
      '<button data-diary-list-type="dash" style="flex:1;padding:5px 8px;border-radius:8px;' +
        'border:1px solid var(--border);background:var(--s2);cursor:pointer;font-size:12px;' +
        'font-family:DM Sans,sans-serif;color:var(--text);display:flex;align-items:center;gap:5px;">' +
        '<span style="font-size:14px;font-weight:700;">–</span> Tirets</button>' +
      '<button data-diary-list-type="square" style="flex:1;padding:5px 8px;border-radius:8px;' +
        'border:1px solid var(--border);background:var(--s2);cursor:pointer;font-size:12px;' +
        'font-family:DM Sans,sans-serif;color:var(--text);display:flex;align-items:center;gap:5px;">' +
        '<span style="font-size:12px;">▪</span> Carrés</button>' +
    '</div>';

    // Emoji picker (hidden)
    html += '<div id="diaryEmojiPicker" style="display:none;flex-wrap:wrap;gap:6px;' +
      'padding:8px;background:var(--s1);border-radius:10px;border:1px solid var(--border);margin-bottom:8px;">' +
      ['❤️','🌸','✨','🌟','💫','🎉','🥰','😊','😍','💕','🌈','🌺','🍀','🌙','⭐',
       '🦋','🌻','💖','🌷','🎵','🍓','🌊','🔥','💎','🎀'].map(function(e) {
        return '<button data-diary-emoji="' + e + '" style="font-size:20px;width:32px;height:32px;' +
          'border-radius:8px;border:1px solid var(--border);background:var(--s2);cursor:pointer;">' + e + '</button>';
      }).join('') +
    '</div>';

    // Panneau taille — Fix3
    var _FS = [{l:'Petit',px:11},{l:'Normal',px:15},{l:'Moyen',px:18},{l:'Grand',px:22},{l:'Titre',px:28},{l:'Géant',px:36}];
    html += '<div id="diarySizePicker" style="display:none;flex-wrap:wrap;gap:6px;padding:8px;background:var(--s1);border-radius:10px;border:1px solid var(--border);margin-bottom:8px;">';
    _FS.forEach(function(s){
      html += '<button data-diary-size="'+s.px+'" style="padding:4px 10px;border-radius:8px;border:1px solid var(--border);background:var(--s2);cursor:pointer;font-family:Georgia,serif;font-size:'+s.px+'px;line-height:1.4;color:var(--text);">'+escHtml(s.l)+'</button>';
    });
    html += '</div>';

    // Panneau polices — DANS LE FLUX, même position que les autres pickers (avant l'éditeur)
    var _FONTS = [
      { label: 'Georgia',    stack: 'Georgia, serif'                                  },
      { label: 'Palatino',   stack: '"Palatino Linotype", Palatino, serif'             },
      { label: 'Garamond',   stack: 'Garamond, "Adobe Garamond Pro", serif'           },
      { label: 'DM Sans',    stack: '"DM Sans", sans-serif'                           },
      { label: 'Verdana',    stack: 'Verdana, Geneva, sans-serif'                     },
      { label: 'Arial',      stack: 'Arial, Helvetica, sans-serif'                   },
      { label: 'Courier',    stack: '"Courier New", Courier, monospace'               },
      { label: 'Impact',     stack: 'Impact, Charcoal, sans-serif'                   },
      { label: 'Trebuchet',  stack: '"Trebuchet MS", Helvetica, sans-serif'           },
      { label: 'Cursive',    stack: '"Brush Script MT", cursive'                     },
    ];
    var _sampleMap = {
      'Georgia': 'Aa', 'Palatino': 'Pp', 'Garamond': 'Gg',
      'DM Sans': 'Aa', 'Verdana': 'Vv', 'Arial': 'Aa',
      'Courier': '{;}', 'Impact': 'IMP', 'Trebu.': 'Tt', 'Script': 'Abc'
    };
    html += '<div id="diaryFontPicker" style="display:none;flex-wrap:nowrap;overflow-x:auto;' +
      'gap:6px;padding:8px;background:var(--s1);border-radius:10px;' +
      'border:1px solid var(--border);margin-bottom:8px;scrollbar-width:thin;' +
      '-webkit-overflow-scrolling:touch;">';
    _FONTS.forEach(function(f) {
      var displayName = _fontDisplayNames[f.stack] || f.label;
      var sample = _sampleMap[displayName] || 'Aa';
      html += '<button data-diary-font="' + escHtml(f.stack) + '" ' +
        'style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;' +
        'padding:4px 7px;border-radius:8px;border:1px solid var(--border);' +
        'background:var(--s2);cursor:pointer;min-width:52px;">' +
        '<span style="font-family:' + escHtml(f.stack) + ';font-size:16px;color:var(--text);' +
          'line-height:1.2;letter-spacing:-0.5px;">' + escHtml(sample) + '</span>' +
        '<span style="font-size:9px;color:var(--muted);font-family:DM Sans,sans-serif;' +
          'white-space:nowrap;">' + escHtml(displayName) + '</span>' +
      '</button>';
    });
    html += '</div>';

    // Éditeur contenteditable — hauteur fixe, scroll interne
    html += '<div id="diaryEditor" contenteditable="true" spellcheck="true" ' +
      'style="height:220px;overflow-y:auto;-webkit-overflow-scrolling:touch;' +
      'padding:14px 16px;border-radius:14px;' +
      'border:1.5px solid var(--border);background:var(--s1);' +
      'font-size:15px;line-height:1.8;color:var(--text);' +
      'font-family:Georgia,serif;outline:none;word-wrap:break-word;box-sizing:border-box;" ' +
      'data-placeholder="Écris ta page ici… Laisse libre cours à tes pensées ✨">';

    if (page && page.content) {
      html += _sanitizeHTML(page.content);
    }
    html += '</div>';

    // Ligne 1 — Toolbar formatage (sans undo/redo)
    html += '<div id="diaryToolbar" style="display:flex;flex-wrap:nowrap;overflow-x:auto;gap:5px;' +
      'margin-top:6px;padding:4px 0;scrollbar-width:none;-webkit-overflow-scrolling:touch;">' +
      _toolBtn('diaryFmtH2',    '<b>T</b>', 'Titre',    'flex-shrink:0;font-size:15px;') +
      _toolBtn('diaryFmtBold',  '<b>B</b>', 'Gras',     'flex-shrink:0;font-weight:800;') +
      _toolBtn('diaryFmtItalic','<i style="font-style:italic;font-family:Georgia,serif;font-size:13px;">I</i>', 'Italique', 'flex-shrink:0;') +
      _toolBtn('diaryFmtUnder', '<u>S</u>', 'Souligné', 'flex-shrink:0;') +
      '<button id="diaryFmtSize" title="Taille" style="min-width:34px;height:28px;padding:0 7px;border-radius:8px;flex-shrink:0;border:1px solid var(--border);background:var(--s1);cursor:pointer;font-size:11px;font-weight:700;color:var(--text);">Aa</button>' +
      _toolBtn('diaryFmtColor', '🎨', 'Couleur', 'flex-shrink:0;') +
      '<button id="diaryFmtCenter" title="Centrer" style="min-width:30px;height:28px;padding:0 6px;border-radius:8px;flex-shrink:0;border:1px solid var(--border);background:var(--s1);cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
        '<svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor" style="display:block;">' +
          '<rect x="1" y="0" width="12" height="2" rx="1"/><rect x="2.5" y="3.5" width="9" height="2" rx="1"/>' +
          '<rect x="1" y="7" width="12" height="2" rx="1"/><rect x="2.5" y="10.5" width="9" height="2" rx="1"/>' +
        '</svg></button>' +
      '<button id="diaryFmtList" title="Liste" style="min-width:30px;height:28px;padding:0 6px;border-radius:8px;flex-shrink:0;border:1px solid var(--border);background:var(--s1);cursor:pointer;display:flex;align-items:center;justify-content:center;">' +
        '<svg width="15" height="13" viewBox="0 0 15 13" fill="currentColor">' +
          '<circle cx="1.5" cy="2" r="1.5"/><rect x="5" y="1" width="9" height="2" rx="1"/>' +
          '<circle cx="1.5" cy="6.5" r="1.5"/><rect x="5" y="5.5" width="9" height="2" rx="1"/>' +
          '<circle cx="1.5" cy="11" r="1.5"/><rect x="5" y="10" width="9" height="2" rx="1"/>' +
        '</svg></button>' +
      _toolBtn('diaryFmtHR',  '—',   'Séparateur', 'flex-shrink:0;') +
      _toolBtn('diaryFmtImg', '📸', 'Image',       'flex-shrink:0;') +
    '</div>';

    // Ligne 2 — Image de fond (gauche) + Police (centre) + Annuler/Rétablir (droite)
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;gap:8px;">' +
      // Gauche : bouton image de fond + preview + police
      '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;overflow:hidden;">' +
        '<button id="diaryBgImgBtn" style="padding:7px 14px;border-radius:20px;font-size:11px;font-weight:700;' +
          'border:1px solid var(--border);background:var(--s2);color:var(--sub);cursor:pointer;' +
          'font-family:DM Sans,sans-serif;white-space:nowrap;flex-shrink:0;">🖼️ Image de fond</button>' +
        (page && page.bg_image_url ?
          '<img src="' + escHtml(page.bg_image_url) + '" style="width:32px;height:32px;border-radius:8px;object-fit:cover;flex-shrink:0;">' +
          '<button id="diaryBgImgDel" style="font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;">✕</button>'
          : '') +
        // Bouton police — affiche la police courante
        '<button id="diaryFmtFont" title="Police d\'écriture" ' +
          'style="height:28px;padding:0 10px;border-radius:8px;flex-shrink:0;border:1px solid var(--border);' +
          'background:var(--s1);cursor:pointer;font-size:12px;color:var(--text);' +
          'display:flex;align-items:center;gap:5px;white-space:nowrap;">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>' +
          '</svg>' +
          '<span id="diaryFontLabel" style="font-size:11px;font-weight:700;">Georgia</span>' +
        '</button>' +
      '</div>' +
      // Droite : Annuler + Rétablir
      '<div style="display:flex;gap:5px;flex-shrink:0;">' +
        _toolBtn('diaryFmtUndo', '&#x21A9;', 'Annuler',  'font-size:14px;') +
        _toolBtn('diaryFmtRedo', '&#x21AA;', 'Rétablir', 'font-size:14px;') +
      '</div>' +
    '</div>';

    // Fix5: galerie supprimée — images gérées directement dans l'éditeur contenteditable

    html += '</div>'; // fin diaryTextSection

    // ── Zone Canva ──
    html += '<div id="diaryCanvaSection" style="display:' + (isCanva ? 'block' : 'none') + ';">';
    html += '<div style="margin-bottom:10px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:6px;line-height:1.6;">' +
        '📐 <strong>Colle le lien d\u2019intégration Canva</strong>.<br>' +
        'Dans Canva : <strong>Partager → Intégrer → Lien d\u2019intégration intelligent</strong><br>' +
        '<span style="color:var(--accent);">✓</span> Ce lien (/view?embed) permet l\u2019affichage direct dans l\u2019app.' +
      '</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<input id="diaryCanvaInput" type="url" placeholder="https://www.canva.com/design/…" ' +
          'style="flex:1;padding:10px 14px;border-radius:12px;border:1.5px solid var(--border);' +
          'background:var(--s1);color:var(--text);font-size:13px;font-family:DM Sans,sans-serif;outline:none;" ' +
          'value="' + escHtml(page ? (page.canva_url || '') : '') + '">' +
        '<button id="diaryCanvaValidate" style="padding:10px 14px;border-radius:12px;' +
          'background:var(--accent-s);border:1px solid var(--accent);color:var(--accent);' +
          'font-size:12px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;white-space:nowrap;">Valider</button>' +
      '</div>' +
      '<div id="diaryCanvaFeedback" style="font-size:11px;margin-top:4px;color:var(--muted);"></div>' +
    '</div>';

    // Aperçu Canva éditeur — carte oEmbed (iframe bloqué CSP)
    if (isCanva && page.canva_url) {
      html += '<div id="diaryCanvaCardEdit" data-canva-url="' + escHtml(page.canva_url) + '">' +
        _canvaFallbackCard(page.canva_url, false) +
      '</div>';
    }

    html += '<div style="margin-top:12px;">' +
      '<div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:6px;text-transform:uppercase;">Note supplémentaire</div>' +
      '<textarea id="diaryCanvaNote" placeholder="Ajouter une note à ta présentation…" ' +
        'style="width:100%;padding:10px 14px;border-radius:12px;border:1.5px solid var(--border);' +
        'background:var(--s1);color:var(--text);font-size:13px;font-family:DM Sans,sans-serif;' +
        'resize:none;outline:none;line-height:1.5;" rows="3">' +
        escHtml(page ? (page.content || '') : '') +
      '</textarea></div>';

    html += '</div>'; // fin diaryCanvaSection

    // ── Partage ──
    html += '<div style="margin-top:20px;padding:14px;background:var(--s2);border-radius:16px;' +
      'border:1px solid var(--border);">' +
      '<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px;">🔒 Accès partenaire</div>' +
      '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:8px;">' +
        '<div id="diaryShareToggle" data-on="' + (page && page.is_shared ? '1' : '0') + '" ' +
          'style="width:40px;height:22px;border-radius:11px;position:relative;cursor:pointer;transition:background 0.2s;' +
          'background:' + (page && page.is_shared ? 'var(--accent)' : 'var(--s3)') + ';">' +
          '<div id="diaryShareDot" style="position:absolute;top:3px;left:' + (page && page.is_shared ? '21px' : '3px') + ';' +
            'width:16px;height:16px;border-radius:50%;background:#fff;transition:left 0.2s;' +
            'box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>' +
        '</div>' +
        '<span style="font-size:13px;color:var(--text);">Partager avec mon/ma partenaire</span>' +
      '</label>' +
      '<label id="diaryCowriteLabel" style="display:' + (page && page.is_shared ? 'flex' : 'none') + ';' +
        'align-items:center;gap:10px;cursor:pointer;">' +
        '<div id="diaryCowriteToggle" data-on="' + (page && page.partner_can_edit ? '1' : '0') + '" ' +
          'style="width:40px;height:22px;border-radius:11px;position:relative;cursor:pointer;transition:background 0.2s;' +
          'background:' + (page && page.partner_can_edit ? 'var(--sage)' : 'var(--s3)') + ';">' +
          '<div id="diaryCowriteDot" style="position:absolute;top:3px;left:' + (page && page.partner_can_edit ? '21px' : '3px') + ';' +
            'width:16px;height:16px;border-radius:50%;background:#fff;transition:left 0.2s;' +
            'box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>' +
        '</div>' +
        '<span style="font-size:13px;color:var(--text);">Autoriser la co-écriture</span>' +
      '</label>' +
    '</div>';

    // Supprimer (si existant)
    if (page) {
      html += '<button id="diaryDeleteBtn" style="margin-top:14px;width:100%;padding:11px;' +
        'border-radius:14px;border:1px solid rgba(255,59,48,0.35);background:rgba(255,59,48,0.08);' +
        'color:#ff3b30;font-size:13px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;">' +
        '🗑️ Supprimer cette page</button>';
    }

    html += '<div style="height:24px;"></div>';

    html += '</div>'; // scroll
    html += '</div>'; // wrap

    // Input fichiers (hidden)
    html += '<input type="file" id="diaryFileInput" accept="image/*" style="display:none;">';
    html += '<input type="file" id="diaryBgFileInput" accept="image/*" style="display:none;">';

    _view.innerHTML = html;

    _bindEditorEvents(page);
    _renderEditorImages();
    // Enrichir la carte Canva éditeur via oEmbed
    if (isCanva && page && page.canva_url) {
      setTimeout(function() {
        var card = document.getElementById('diaryCanvaCardEdit');
        if (card) _loadCanvaOembed(card, page.canva_url, false);
      }, 200);
    }
    // Fix4: activer les poignées sur les images déjà dans l'éditeur (réédition)
    setTimeout(function() {
      var ed = document.getElementById('diaryEditor');
      if (ed) _bindImgResizeHandles(ed);
    }, 100);
  }

  // Fixer la couleur des puces de liste = couleur du premier texte dans le <li>
  // Applique une couleur uniquement sur les nœuds texte de la sélection
  // sans toucher au reste du <li> ou du paragraphe
  // ─── Couleur : approche DOM pure, sans insertHTML pour éviter les alinéas ───

  // Enveloppe tous les nœuds texte d'un Range dans un <span style="color:X">
  // sans toucher au reste du DOM — pas de insertHTML, pas d'alinéa
  function _applyColorToRange(range, color) {
    if (range.collapsed) return;

    // Collecter tous les nœuds texte qui sont dans le range
    var textNodes = _getTextNodesInRange(range);
    if (textNodes.length === 0) return;

    textNodes.forEach(function(info) {
      var node   = info.node;
      var start  = info.start; // offset de début dans ce nœud
      var end    = info.end;   // offset de fin dans ce nœud

      // Découper le nœud texte si nécessaire
      // Ordre correct : couper la FIN d'abord, puis le DÉBUT
      // node.splitText(end) → node garde préfixe+sélection, nouveau nœud = suffixe
      // node.splitText(start) → node = préfixe, target = sélection exacte
      if (end < node.length) node.splitText(end);
      var target = (start > 0) ? node.splitText(start) : node;

      // Si target est dans un span coloré, changer juste sa couleur
      var parent = target.parentNode;
      if (parent && parent.tagName === 'SPAN' && parent.style.color) {
        parent.style.color = color;
        return;
      }

      // Envelopper — display:inline obligatoire pour éviter tout saut de ligne
      var span = document.createElement('span');
      span.style.color = color;
      span.style.display = 'inline';
      parent.insertBefore(span, target);
      span.appendChild(target);
    });
  }

  // Supprime la couleur sur la sélection
  // Unwrap dès que la couleur est retirée — peu importe les autres styles résiduels
  function _removeColorInRange(range) {
    if (range.collapsed) return;
    var textNodes = _getTextNodesInRange(range);
    textNodes.forEach(function(info) {
      var node  = info.node;
      var start = info.start;
      var end   = info.end;

      if (end < node.length) node.splitText(end);
      var target = (start > 0) ? node.splitText(start) : node;

      var parent = target.parentNode;
      if (parent && parent.tagName === 'SPAN' && parent.style.color) {
        parent.style.color = '';
        // Unwrap dès que la couleur est retirée (indépendamment des autres styles)
        var gp = parent.parentNode;
        if (gp) {
          while (parent.firstChild) gp.insertBefore(parent.firstChild, parent);
          gp.removeChild(parent);
        }
      }
    });
    // Recalculer les couleurs de puces après reset
    setTimeout(function() {
      if (typeof _fixListColors === 'function') _fixListColors();
    }, 10);
  }

  // Retourne tous les nœuds texte dans un Range avec leurs offsets exacts
  function _getTextNodesInRange(range) {
    var result = [];
    var sc = range.startContainer;
    var ec = range.endContainer;
    var so = range.startOffset;
    var eo = range.endOffset;

    // Cas simple : sélection dans un seul nœud texte
    if (sc === ec && sc.nodeType === 3) {
      result.push({ node: sc, start: so, end: eo });
      return result;
    }

    // Cas général : parcourir l'arbre entre startContainer et endContainer
    var iter = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    var node;
    while ((node = iter.nextNode())) {
      if (!range.intersectsNode(node)) continue;
      var start = (node === sc) ? so : 0;
      var end   = (node === ec) ? eo : node.length;
      if (start < end) {
        result.push({ node: node, start: start, end: end });
      }
    }
    return result;
  }

  // Nettoyage : fusionne spans adjacents de même couleur
  function _mergeAdjacentColorSpans(container) {
    if (!container) return;
    var spans = container.querySelectorAll ? container.querySelectorAll('span[style*="color"]') : [];
    spans.forEach(function(span) {
      var next = span.nextSibling;
      if (next && next.nodeType === 1 && next.tagName === 'SPAN' &&
          next.style && next.style.color === span.style.color) {
        while (next.firstChild) span.appendChild(next.firstChild);
        if (next.parentNode) next.parentNode.removeChild(next);
      }
    });
  }

    function _fixListColors(container) {
    if (!container) container = document.getElementById('diaryEditor');
    if (!container) return;

    // RÈGLE : la puce prend la couleur du li SEULEMENT si le premier enfant
    // direct est un <span style="color:...">
    // On NE SET JAMAIS li.style.color — cela propage la couleur à tout le texte
    // On utilise data-puce-id + règle CSS injectée pour cibler uniquement ::before/::marker

    var rules = [];

    container.querySelectorAll('li').forEach(function(li, idx) {
      // Toujours vider li.style.color (nettoyage de l'ancienne logique)
      if (li.style.color) li.style.color = '';

      var firstChild = li.firstChild;
      var bulletColor = '';

      // Seulement si le PREMIER enfant direct est un SPAN coloré
      if (firstChild &&
          firstChild.nodeType === 1 &&
          firstChild.tagName === 'SPAN' &&
          firstChild.style && firstChild.style.color) {
        bulletColor = firstChild.style.color;
      }

      if (bulletColor) {
        var uid = 'puce-' + idx + '-' + Date.now();
        li.setAttribute('data-puce-id', uid);
        rules.push(
          '[data-puce-id="' + uid + '"]::before,' +
          '[data-puce-id="' + uid + '"]::marker{color:' + bulletColor + ' !important;}'
        );
      } else {
        li.removeAttribute('data-puce-id');
      }
    });

    var styleEl = document.getElementById('diary-puce-colors');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'diary-puce-colors';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = rules.join('\n');
  }

  // ── Palette emoji couverture complète (desktop + iOS) ──
  function _buildCoverEmojiPicker() {
    var EMOJI_CATS = [
      { label: '❤️ Amour',    list: ['❤️','🩷','💕','💖','💗','💘','💝','💞','🥰','😍','😘','💋','💑','👫','💏','🌹','💐','🌸','🌺','🌻','🌷','🍀','🦋'] },
      { label: '😊 Émotions', list: ['😊','😍','🥰','😂','😭','😢','😤','😡','🤔','🤩','😴','😌','🤗','🥺','😏','😎','🤭','😇','🥳','😜','😋','🤪'] },
      { label: '✨ Magie',    list: ['✨','🌟','💫','⭐','🌠','🎇','🎆','🌈','☀️','🌙','🌛','🌜','🌝','🌚','🔮','🪄','💎','🏆','🎖️','🎗️'] },
      { label: '🎉 Fête',     list: ['🎉','🎊','🎈','🥂','🍾','🎂','🎁','🎀','🪅','🎠','🎡','🎢','🎭','🎨','🎪','🎤','🎵','🎶','🎸','🎹'] },
      { label: '🌿 Nature',   list: ['🌿','🌱','🌲','🌳','🌴','🌵','🍄','🌾','🍂','🍁','🌺','🌸','💐','🦋','🐝','🐞','🦄','🐉','🦊','🐺','🐻','🐼','🐨'] },
      { label: '🍓 Food',     list: ['🍓','🍒','🍑','🍊','🍋','🍇','🍉','🍍','🥭','🍔','🍕','🍣','🧁','🍰','🎂','🍫','🍬','🍭','☕','🧃','🍵'] },
      { label: '🏔️ Voyage',   list: ['🏔️','🌊','🏖️','🌅','🌄','🗺️','✈️','🚀','🛸','🚂','🎒','⛺','🏕️','🗼','🗽','🎡','🌁','🌃','🌆','🌇','🌉'] },
      { label: '💪 Vie',      list: ['💪','🙌','👏','🤝','🫂','🧘','🏋️','🎯','📚','📖','✏️','🎓','💡','🔑','🏠','🌺','🌙','☀️','🌊','⚡','🔥','💧'] },
    ];

    // position:absolute — flotte par-dessus le layout, ne repousse rien
    // left:0 pour s'aligner sur le bouton (+), top:100% juste en dessous
    // max-width + right contraints pour ne jamais déborder à droite
    // max-height + overflow-y pour ne pas déborder en bas
    // Le positionnement réel est fait en JS au moment de l'ouverture (position:fixed)
    var html = '<div id="diaryCoverEmojiPicker" style="display:none;' +
      'position:fixed;' +
      'width:min(320px,calc(100vw - 32px));' +
      'max-height:260px;overflow-y:auto;-webkit-overflow-scrolling:touch;' +
      'z-index:9999;' +
      'background:var(--s1);border:1.5px solid var(--border);border-radius:14px;' +
      'overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.18);">';

    // Onglets catégories
    html += '<div style="display:flex;overflow-x:auto;border-bottom:1px solid var(--border);' +
      'scrollbar-width:none;background:var(--s2);">';
    EMOJI_CATS.forEach(function(cat, i) {
      html += '<button data-diary-emoji-cat="' + i + '" ' +
        'style="flex-shrink:0;padding:7px 10px;font-size:11px;font-weight:' + (i === 0 ? '700' : '500') + ';' +
        'border:none;background:' + (i === 0 ? 'var(--s1)' : 'transparent') + ';' +
        'color:' + (i === 0 ? 'var(--accent)' : 'var(--muted)') + ';' +
        'cursor:pointer;white-space:nowrap;border-bottom:2px solid ' + (i === 0 ? 'var(--accent)' : 'transparent') + ';' +
        'font-family:DM Sans,sans-serif;">' + escHtml(cat.label) + '</button>';
    });
    html += '</div>';

    // Grilles par catégorie
    EMOJI_CATS.forEach(function(cat, i) {
      html += '<div data-diary-emoji-grid="' + i + '" ' +
        'style="display:' + (i === 0 ? 'flex' : 'none') + ';flex-wrap:wrap;gap:4px;padding:10px;">';
      cat.list.forEach(function(e) {
        html += '<button data-cover-emoji-pick="' + escHtml(e) + '" ' +
          'style="width:34px;height:34px;border-radius:8px;font-size:20px;' +
          'border:1px solid transparent;background:var(--s2);cursor:pointer;' +
          'display:flex;align-items:center;justify-content:center;' +
          'transition:transform 0.1s,background 0.1s;">' +
          escHtml(e) + '</button>';
      });
      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  function _toolBtn(id, label, title, style) {
    return '<button id="' + id + '" title="' + escHtml(title) + '" ' +
      'style="min-width:30px;height:28px;padding:0 8px;border-radius:8px;' +
      'border:1px solid var(--border);background:var(--s1);cursor:pointer;' +
      'font-size:12px;' + style + '">' + label + '</button>';
  }

  function _bindEditorEvents(page) {
    // Retour
    var backBtn = document.getElementById('diaryEditorBack');
    if (backBtn) backBtn.addEventListener('click', function() {
      if (_currentPage) {
        _mode = 'read';
        _renderReadPage(_currentPage);
      } else {
        _mode = 'list';
        _renderList();
      }
    });

    // Sauvegarder
    var saveBtn = document.getElementById('diaryEditorSave');
    if (saveBtn) saveBtn.addEventListener('click', _savePage);

    // Couvertures
    _view.querySelectorAll('[data-cover-bg]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var isSelected = this.style.border.indexOf('var(--accent)') !== -1;
        // Désélectionner tous
        _view.querySelectorAll('[data-cover-bg]').forEach(function(b) {
          b.style.border = '2px solid transparent';
          b.style.boxShadow = 'var(--sh-sm)';
        });
        if (isSelected) {
          // Reclic → désélectionner (pas de couverture)
          _editorCoverEmoji = null;
        } else {
          // Sélectionner
          this.style.border = '2.5px solid var(--accent)';
          this.style.boxShadow = '0 0 0 2px var(--accent-s)';
          _editorCoverEmoji = this.getAttribute('data-cover-emoji');
        }
      });
    });

    // Humeurs — reclic = désélection
    _view.querySelectorAll('[data-mood]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var isSelected = this.style.border.indexOf('var(--accent)') !== -1;
        // Désélectionner tous
        _view.querySelectorAll('[data-mood]').forEach(function(b) {
          b.style.border = '1.5px solid var(--border)';
          b.style.background = 'var(--s2)';
        });
        if (!isSelected) {
          // Sélectionner
          this.style.border = '2px solid var(--accent)';
          this.style.background = 'var(--accent-s)';
        }
        // Reclic → rien à faire, déjà désélectionné ci-dessus
      });
    });

    // Mode texte/canva
    var modeText  = document.getElementById('diaryModeText');
    var modeCanva = document.getElementById('diaryModeCanva');
    var textSec   = document.getElementById('diaryTextSection');
    var canvaSec  = document.getElementById('diaryCanvaSection');

    if (modeText) modeText.addEventListener('click', function() {
      textSec.style.display  = 'block';
      canvaSec.style.display = 'none';
      modeText.style.background  = 'var(--s1)'; modeText.style.color  = 'var(--accent)';
      modeCanva.style.background = 'transparent'; modeCanva.style.color = 'var(--muted)';
    });
    if (modeCanva) modeCanva.addEventListener('click', function() {
      textSec.style.display  = 'none';
      canvaSec.style.display = 'block';
      modeCanva.style.background = 'var(--s1)'; modeCanva.style.color  = 'var(--accent)';
      modeText.style.background  = 'transparent'; modeText.style.color = 'var(--muted)';
    });

    // ── Toolbar formatage ──
    var editor = document.getElementById('diaryEditor');

    // ── TOOLBAR : sauvegarde sélection au blur, restauration avant execCommand ──
    // Sur iOS Safari, on ne peut pas empêcher la perte de focus avec preventDefault.
    // La solution fiable : écouter blur/selectionchange sur l'éditeur pour mémoriser
    // le Range, puis le restaurer juste avant d'appeler execCommand.
    // Mettre à jour l'état visuel des boutons de la toolbar
    function _updateToolbarState() {
      var states = {
        'diaryFmtBold':   document.queryCommandState('bold'),
        'diaryFmtItalic': document.queryCommandState('italic'),
        'diaryFmtUnder':  document.queryCommandState('underline'),
        'diaryFmtCenter': document.queryCommandState('justifyCenter'),
      };

      // H2 : vérifier si on est dans un h2
      var sel = window.getSelection();
      var node = sel && sel.anchorNode;
      var el = node ? (node.nodeType === 3 ? node.parentElement : node) : null;
      states['diaryFmtH2'] = !!(el && el.closest && el.closest('h2'));

      Object.keys(states).forEach(function(id) {
        var btn = document.getElementById(id);
        if (!btn) return;
        if (states[id]) {
          // Actif : fond accent + texte blanc
          btn.style.background = 'var(--accent)';
          btn.style.color      = '#fff';
          btn.style.borderColor = 'var(--accent)';
        } else {
          // Inactif : style normal
          btn.style.background  = 'var(--s1)';
          btn.style.color       = 'var(--text)';
          btn.style.borderColor = 'var(--border)';
        }
      });
    }

    // ── Historique undo/redo custom (couvre TOUTES les modifs DOM) ────
    // ── Historique undo/redo custom ────────────────────────────────
    var _histStack   = [];
    var _redoStack   = [];
    var _histPaused  = false;
    var _inUndoRedo  = false;   // évite d'effacer redoStack pendant restore
    var _histTimer   = null;
    var MAX_HIST     = 50;

    function _histSnapshot() {
      if (_histPaused || !editor) return;
      var snap = editor.innerHTML;
      if (_histStack.length > 0 && _histStack[_histStack.length - 1] === snap) return;
      _histStack.push(snap);
      if (_histStack.length > MAX_HIST) _histStack.shift();
      if (!_inUndoRedo) _redoStack = []; // n'effacer redo que sur vraie action user
    }

    function _histSnapshotDeferred() {
      if (_histTimer) clearTimeout(_histTimer);
      _histTimer = setTimeout(function() { _histSnapshot(); _histTimer = null; }, 600);
    }

    function _histSnapshotNowLocal() {
      if (_histTimer) { clearTimeout(_histTimer); _histTimer = null; }
      _histSnapshot();
    }

    function _restoreSnap(snap) {
      _histPaused = true;
      _inUndoRedo = true;
      editor.innerHTML = snap;
      _histPaused = false;
      _inUndoRedo = false;
      setTimeout(function() {
        _bindImgResizeHandles(editor);
        _fixListColors();
        _updateToolbarState();
        _updateFontLabel();
      }, 0);
    }

    function _histUndo() {
      if (!editor) return;
      // S'assurer que l'état actuel est dans la pile
      var current = editor.innerHTML;
      if (_histStack.length === 0 || _histStack[_histStack.length - 1] !== current) {
        _histStack.push(current);
      }
      if (_histStack.length <= 1) return; // rien à annuler
      var undone = _histStack.pop();
      _redoStack.push(undone);
      _restoreSnap(_histStack[_histStack.length - 1]);
    }

    function _histRedo() {
      if (!editor || _redoStack.length === 0) return;
      var next = _redoStack.pop();
      _inUndoRedo = true;
      _histStack.push(next);
      _inUndoRedo = false;
      _restoreSnap(next);
    }

    // Snapshot initial
    if (editor) { setTimeout(function() { _histSnapshot(); }, 100); }

    // Exposer au niveau module
    _histSnapshotNow = _histSnapshotNowLocal;
    _doHistUndo      = _histUndo;
    _doHistRedo      = _histRedo;

    if (editor) {
      editor.addEventListener('blur', function() { _saveSelection(); });
      editor.addEventListener('keyup', function(e) {
        _saveSelection();
        _updateToolbarState();
        _histSnapshotDeferred();
        // Mettre à jour les couleurs des puces si on tape dans une liste
        var sel = window.getSelection();
        if (sel && sel.anchorNode) {
          var node = sel.anchorNode;
          var li = (node.nodeType === 3 ? node.parentElement : node);
          if (li && li.closest && li.closest('li')) {
            _fixListColors();
          }
        }
      });
      editor.addEventListener('mouseup', function() { _saveSelection(); _updateToolbarState(); });
      editor.addEventListener('touchend', function() { setTimeout(function() { _saveSelection(); _updateToolbarState(); }, 50); });
      // Aussi sur selectionchange pour capturer les clics sans frappe
      document.addEventListener('selectionchange', function() {
        if (document.activeElement === editor) {
          _updateToolbarState();
        }
      });

      // MutationObserver : détecter tout changement de style inline (foreColor)
      // pour mettre à jour la couleur des puces en temps réel comme Word
      var _listColorObserver = new MutationObserver(function(mutations) {
        var needsFix = false;
        mutations.forEach(function(m) {
          // Changement d'attribut style sur un nœud dans un li
          if (m.type === 'attributes' && m.attributeName === 'style') {
            var target = m.target;
            if (target && target.closest && target.closest('li')) needsFix = true;
          }
          // Ajout/suppression de nœuds (insertHTML, foreColor créent des <span>)
          if (m.type === 'childList') {
            var check = function(nodes) {
              nodes.forEach(function(node) {
                if (node.nodeType === 1 && node.closest && node.closest('li')) needsFix = true;
              });
            };
            check(m.addedNodes);
          }
        });
        if (needsFix) {
          // Debounce : éviter les appels répétés sur une rafale de mutations
          clearTimeout(editor._fixColorsTimer);
          editor._fixColorsTimer = setTimeout(function() { _fixListColors(); }, 30);
        }
      });
      _listColorObserver.observe(editor, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['style'],
      });
    }

    // _bindFmt : mousedown (desktop) + touchend (iOS) sur les boutons toolbar
    function _bindFmt(id, fn) {
      var el = document.getElementById(id);
      if (!el) return;
      // Desktop : mousedown empêche le blur sur la plupart des navigateurs
      el.addEventListener('mousedown', function(e) {
        e.preventDefault(); // Empêche le blur sur desktop/Android
        fn.call(this, e);
      });
      // iOS Safari : touchend car touchstart déclenche le blur parfois avant mousedown
      el.addEventListener('touchend', function(e) {
        e.preventDefault();
        fn.call(this, e);
      }, { passive: false });
    }

    _bindFmt('diaryFmtH2', function() {
      _histSnapshotNow();
      _restoreSelection();
      try {
        var sel = window.getSelection();
        var node = sel && sel.anchorNode;
        var el = node ? (node.nodeType === 3 ? node.parentElement : node) : null;
        var h2El = el && el.closest ? el.closest('h2') : null;

        if (h2El) {
          // Retirer le H2 : remplacer manuellement dans le DOM
          // car formatBlock 'p' ne retire pas le H2 quand il y a un <p> imbriqué
          var parent = h2El.parentNode;
          var div = document.createElement('div');
          // Déplacer le contenu du H2 dans un div
          // Si le H2 contient un <p>, extraire son contenu directement
          var inner = h2El.querySelector('p') || h2El;
          while (inner.firstChild) div.appendChild(inner.firstChild);
          parent.replaceChild(div, h2El);
          // Replacer le curseur dans le nouveau div
          var newRange = document.createRange();
          newRange.setStart(div, 0);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
        } else {
          // Appliquer H2
          document.execCommand('formatBlock', false, 'h2');
        }
      } catch(e) { document.execCommand('formatBlock', false, 'h2'); }
      _saveSelection();
    });
    _bindFmt('diaryFmtBold',   function() { _execFmt('bold'); });
    _bindFmt('diaryFmtItalic', function() { _execFmt('italic'); });
    _bindFmt('diaryFmtUnder',  function() { _execFmt('underline'); });
    _bindFmt('diaryFmtCenter', function() {
      _histSnapshotNow();
      _restoreSelection();
      // Détecter l'alignement actuel et basculer center ↔ left
      var sel = window.getSelection();
      var isCentered = false;
      if (sel && sel.rangeCount > 0) {
        var node = sel.getRangeAt(0).commonAncestorContainer;
        var el = node.nodeType === 1 ? node : node.parentElement;
        if (el) {
          var align = el.style.textAlign ||
            (el.closest && el.closest('[style*="text-align"]') &&
             el.closest('[style*="text-align"]').style.textAlign) || '';
          isCentered = align === 'center' ||
            document.queryCommandState('justifyCenter');
        }
      }
      document.execCommand(isCentered ? 'justifyLeft' : 'justifyCenter', false, null);
      _saveSelection();
    });
    // Menu liste — toggle affichage + sauvegarder la sélection au moment de l'ouverture
    var listMenu = document.getElementById('diaryListMenu');
    var _listMenuSavedRange = null; // sélection au moment où le menu liste s'ouvre

    _bindFmt('diaryFmtList', function() {
      if (!listMenu) return;
      var open = listMenu.style.display !== 'none';
      // Fermer tous les autres pickers
      var cp = document.getElementById('diaryColorPicker');
      var ep = document.getElementById('diaryEmojiPicker');
      var fp = document.getElementById('diaryFontPicker');
      if (cp) cp.style.display = 'none';
      if (ep) ep.style.display = 'none';
      if (fp) fp.style.display = 'none';
      if (open) {
        listMenu.style.display = 'none';
        _listMenuSavedRange = null;
      } else {
        // Sauvegarder la sélection MAINTENANT — avant que l'éditeur perde le focus
        _saveSelection();
        var sel = window.getSelection();
        _listMenuSavedRange = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0).cloneRange() : null;
        listMenu.style.display = 'flex';
      }
    });

    // Sélection type de liste
    if (listMenu) listMenu.querySelectorAll('[data-diary-list-type]').forEach(function(btn) {
      function insertList() {
        _histSnapshotNow();
        var type = btn.getAttribute('data-diary-list-type');

        // Restaurer la sélection sauvegardée au moment de l'ouverture du menu
        var editorEl = document.getElementById('diaryEditor');
        if (!editorEl) { listMenu.style.display = 'none'; return; }
        editorEl.focus();

        var sel = window.getSelection();
        if (_listMenuSavedRange) {
          sel.removeAllRanges();
          sel.addRange(_listMenuSavedRange.cloneRange());
        } else {
          // Fallback : restaurer depuis _savedRange
          _restoreSelection();
          sel = window.getSelection();
        }

        if (!sel || sel.rangeCount === 0) { listMenu.style.display = 'none'; return; }

        var range = sel.getRangeAt(0);

        // ── Détecter si la sélection couvre une liste existante ──
        var ancestor = range.commonAncestorContainer;
        var anchorEl = ancestor.nodeType === 3 ? ancestor.parentElement : ancestor;

        var existingUl = anchorEl.closest ? anchorEl.closest('ul') : null;
        if (!existingUl) {
          var fragCheck = range.cloneContents();
          var fragDiv = document.createElement('div');
          fragDiv.appendChild(fragCheck);
          existingUl = fragDiv.querySelector('ul');
        }

        if (existingUl && editorEl && editorEl.contains(anchorEl)) {
          // ── MODE REMPLACEMENT / SUPPRESSION ──
          var ulsToConvert = [];
          editorEl.querySelectorAll('ul').forEach(function(ul) {
            if (range.intersectsNode ? range.intersectsNode(ul) :
                (range.compareBoundaryPoints(Range.END_TO_START, range) <= 0)) {
              ulsToConvert.push(ul);
            }
          });
          if (ulsToConvert.length === 0 && anchorEl.closest && anchorEl.closest('ul')) {
            ulsToConvert.push(anchorEl.closest('ul'));
          }

          ulsToConvert.forEach(function(ul) {
            var currentType = 'disc';
            if (ul.classList.contains('diary-list-dash'))   currentType = 'dash';
            if (ul.classList.contains('diary-list-square')) currentType = 'square';

            if (currentType === type) {
              // Même type → supprimer la liste, garder le texte
              var fragment = document.createDocumentFragment();
              Array.prototype.forEach.call(ul.querySelectorAll('li'), function(li) {
                var p = document.createElement('p');
                while (li.firstChild) p.appendChild(li.firstChild);
                fragment.appendChild(p);
              });
              ul.parentNode.replaceChild(fragment, ul);
            } else {
              // Type différent → changer la classe
              ul.className = '';
              if (type === 'dash')   ul.className = 'diary-list-dash';
              if (type === 'square') ul.className = 'diary-list-square';
            }
          });

          listMenu.style.display = 'none';
          _listMenuSavedRange = null;
          _saveSelection();
          setTimeout(function() { _fixListColors(); }, 10);
          return;
        }

        // ── MODE CRÉATION — comportement Word ──
        // On travaille sur les BLOCS entiers (p, div, h1-6) touchés par la sélection,
        // pas sur le contenu sélectionné. Peu importe si le curseur est au début,
        // au milieu ou à la fin — toute la ligne devient un <li>.

        var cls = '';
        if (type === 'dash')   cls = 'diary-list-dash';
        if (type === 'square') cls = 'diary-list-square';

        // Collecter les nœuds blocs touchés par la sélection
        function _getBlocksInRange(r, ed) {
          var blocks = [];
          var seen = [];

          // Nœud de départ et de fin du range
          function _blockOf(node) {
            var el = (node.nodeType === 3) ? node.parentElement : node;
            // Remonter jusqu'à un enfant direct de l'éditeur
            while (el && el.parentElement && el.parentElement !== ed) {
              el = el.parentElement;
            }
            return (el && el !== ed) ? el : null;
          }

          var startBlock = _blockOf(r.startContainer);
          var endBlock   = _blockOf(r.endContainer);

          if (!startBlock) return blocks;

          // Parcourir les enfants directs de l'éditeur entre startBlock et endBlock
          var children = Array.prototype.slice.call(ed.childNodes);
          var inRange = false;
          for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (child === startBlock) inRange = true;
            if (inRange && seen.indexOf(child) === -1) {
              seen.push(child);
              blocks.push(child);
            }
            if (child === endBlock) break;
          }
          // Si startBlock === endBlock ou rien trouvé, au moins le startBlock
          if (blocks.length === 0 && startBlock) blocks.push(startBlock);
          return blocks;
        }

        var blocks = _getBlocksInRange(range, editorEl);

        if (blocks.length === 0) {
          // Fallback : insérer un li vide à la position du curseur
          var fbCls = cls ? ' class="' + cls + '"' : '';
          document.execCommand('insertHTML', false,
            '<ul' + fbCls + '><li>&#8203;</li></ul><p>&#8203;</p>');
          listMenu.style.display = 'none';
          _listMenuSavedRange = null;
          _saveSelection();
          setTimeout(function() { _fixListColors(); }, 10);
          return;
        }

        // Construire la <ul> à partir des blocs entiers
        var ulEl = document.createElement('ul');
        if (cls) ulEl.className = cls;

        blocks.forEach(function(block) {
          var li = document.createElement('li');
          // Copier tous les enfants du bloc dans le li
          // (garder les spans de couleur/taille/police)
          var blockClone = block.cloneNode(true);
          // Si le bloc est un nœud texte direct, l'envelopper
          if (blockClone.nodeType === 3) {
            li.textContent = blockClone.textContent;
          } else {
            while (blockClone.firstChild) li.appendChild(blockClone.firstChild);
          }
          if (!li.textContent.trim()) li.innerHTML = '&#8203;';
          ulEl.appendChild(li);
        });

        // Remplacer les blocs par la <ul> + un <p> vide après
        var pAfter = document.createElement('p');
        pAfter.innerHTML = '&#8203;';
        var parent = blocks[0].parentNode;
        parent.insertBefore(ulEl, blocks[0]);
        parent.insertBefore(pAfter, ulEl.nextSibling || null);
        // Supprimer les blocs originaux
        blocks.forEach(function(block) { if (block.parentNode) block.parentNode.removeChild(block); });

        // Placer le curseur dans le dernier li
        var lastLi = ulEl.lastElementChild || ulEl.lastChild;
        if (lastLi) {
          var newRange = document.createRange();
          newRange.selectNodeContents(lastLi);
          newRange.collapse(false);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }

        listMenu.style.display = 'none';
        _listMenuSavedRange = null;
        _saveSelection();
        setTimeout(function() { _fixListColors(); }, 10);
      }
      btn.addEventListener('mousedown', function(e) { e.preventDefault(); insertList(); });
      btn.addEventListener('touchend',  function(e) { e.preventDefault(); insertList(); }, { passive: false });
    });
    _bindFmt('diaryFmtHR', function() {
      _histSnapshotNow();
      _restoreSelection();
      document.execCommand('insertHTML', false,
        '<hr style="border:none;border-top:1.5px solid var(--border);margin:12px 0;display:block;"><p></p>');
      _saveSelection();
    });

    // Couleur picker toggle
    var colorPicker = document.getElementById('diaryColorPicker');
    _bindFmt('diaryFmtColor', function() {
      if (!colorPicker) return;
      colorPicker.style.display = colorPicker.style.display === 'none' ? 'flex' : 'none';
      var ep = document.getElementById('diaryEmojiPicker');
      var sp = document.getElementById('diarySizePicker');
      var lm = document.getElementById('diaryListMenu');
      var fp = document.getElementById('diaryFontPicker');
      if (ep) ep.style.display = 'none';
      if (sp) sp.style.display = 'none';
      if (lm) lm.style.display = 'none';
      if (fp) fp.style.display = 'none';
    });
    // Mettre à jour l'indicateur de couleur active dans le picker
    function _updateActiveColor() {
      if (!colorPicker) return;
      var curColor = '';
      try {
        curColor = document.queryCommandValue('foreColor') || '';
        // Normaliser en hex
        if (curColor.startsWith('rgb')) {
          var m = curColor.match(/\d+/g);
          if (m && m.length >= 3) {
            curColor = '#' + [m[0],m[1],m[2]].map(function(v){
              return ('0' + parseInt(v).toString(16)).slice(-2);
            }).join('');
          }
        }
      } catch(e) {}
      curColor = curColor.toLowerCase();
      colorPicker.querySelectorAll('[data-diary-color]').forEach(function(b) {
        var bc = (b.getAttribute('data-diary-color') || '').toLowerCase();
        // Supprimer ancien indicateur
        var old = b.querySelector('.diary-color-dot');
        if (old) old.remove();
        if (bc !== 'reset' && curColor && curColor === bc) {
          var dot = document.createElement('div');
          dot.className = 'diary-color-dot';
          dot.style.cssText = 'position:absolute;bottom:-3px;right:-3px;width:8px;height:8px;' +
            'border-radius:50%;background:var(--accent);border:1.5px solid var(--s1);';
          b.appendChild(dot);
        }
      });
    }

    if (colorPicker) colorPicker.querySelectorAll('[data-diary-color]').forEach(function(btn) {
      function applyColor() {
        _histSnapshotNow();
        var col = btn.getAttribute('data-diary-color');
        _restoreSelection();

        var sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) {
          colorPicker.style.display = 'none';
          return;
        }
        var range = sel.getRangeAt(0);

        if (col === 'reset') {
          // Supprimer toutes les couleurs dans la sélection :
          // parcourir les spans de couleur qui se chevauchent et retirer leur color
          _removeColorInRange(range);
        } else {
          if (range.collapsed) {
            // Curseur seul (pas de sélection) — on ne fait rien
          } else {
            // Appliquer la couleur UNIQUEMENT sur la sélection via Range manuel
            _applyColorToRange(range, col);
          }
        }

        colorPicker.style.display = 'none';
        _saveSelection();
        setTimeout(function() {
          _fixListColors();
          _updateActiveColor();
        }, 10);
      }
      btn.addEventListener('mousedown', function(e) { e.preventDefault(); applyColor(); });
      btn.addEventListener('touchend',  function(e) { e.preventDefault(); applyColor(); }, { passive: false });
    });

    // Mettre à jour l'indicateur quand le picker s'ouvre
    var _origColorToggle = null;
    if (colorPicker) {
      var diaryFmtColorBtn = document.getElementById('diaryFmtColor');
      if (diaryFmtColorBtn) {
        // Surcharger pour appeler _updateActiveColor à l'ouverture
        var _origOpen = diaryFmtColorBtn._diaryColorOpenFn;
      }
    }
    // Écouter selectionchange pour mettre à jour l'indicateur quand le picker est ouvert
    document.addEventListener('selectionchange', function() {
      if (colorPicker && colorPicker.style.display !== 'none') {
        _updateActiveColor();
      }
    });

    // (bouton emoji supprimé de la toolbar)

    // Undo / Redo — système custom (couvre couleur, police, taille, listes, etc.)
    _bindFmt('diaryFmtUndo', function() { _doHistUndo(); });
    _bindFmt('diaryFmtRedo', function() { _doHistRedo(); });

    // Fix3 — Size picker
    var sizePicker = document.getElementById('diarySizePicker');
    _bindFmt('diaryFmtSize', function() {
      if (!sizePicker) return;
      var open = sizePicker.style.display !== 'none';
      sizePicker.style.display = open ? 'none' : 'flex';
      var _cp = document.getElementById('diaryColorPicker');
      var _ep = document.getElementById('diaryEmojiPicker');
      var _lm = document.getElementById('diaryListMenu');
      if (_cp) _cp.style.display = 'none';
      if (_ep) _ep.style.display = 'none';
      if (_lm) _lm.style.display = 'none';
    });
    if (sizePicker) {
      sizePicker.querySelectorAll('[data-diary-size]').forEach(function(sBtn) {
        function _doSize() {
          _histSnapshotNow();
          var px = sBtn.getAttribute('data-diary-size');
          _restoreSelection();
          var sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) { sizePicker.style.display = 'none'; return; }
          var range = sel.getRangeAt(0);
          if (range.collapsed) { sizePicker.style.display = 'none'; return; }
          var nodes = _getTextNodesInRange(range);
          if (!nodes.length) { sizePicker.style.display = 'none'; return; }
          nodes.forEach(function(info) {
            var node = info.node, s = info.start, e = info.end;
            if (e < node.length) node.splitText(e);
            var t = (s > 0) ? node.splitText(s) : node;
            var par = t.parentNode;
            if (par && par.tagName === 'SPAN' && par.style.fontSize) {
              par.style.fontSize = px + 'px'; return;
            }
            var sp = document.createElement('span');
            sp.style.fontSize = px + 'px';
            sp.style.display  = 'inline';
            par.insertBefore(sp, t);
            sp.appendChild(t);
          });
          sizePicker.style.display = 'none';
          _saveSelection();
        }
        sBtn.addEventListener('mousedown', function(e) { e.preventDefault(); _doSize(); });
        sBtn.addEventListener('touchend',  function(e) { e.preventDefault(); _doSize(); }, { passive: false });
      });
    }

    // ── Picker emoji couverture ──
    var coverEmojiBtn    = document.getElementById('diaryAddCoverEmoji');
    var coverEmojiPicker = document.getElementById('diaryCoverEmojiPicker');

    if (coverEmojiBtn && coverEmojiPicker) {
      // Ouvrir/fermer
      function _openCoverPicker() {
        var open = coverEmojiPicker.style.display !== 'none';
        if (open) { coverEmojiPicker.style.display = 'none'; return; }

        // Calculer la position en fixed par rapport au bouton
        var btnRect = coverEmojiBtn.getBoundingClientRect();
        var pickerW = Math.min(320, window.innerWidth - 32);
        var top     = btnRect.bottom + 6;

        // Aligner à gauche du bouton, mais contrôler le débordement à droite
        var left = btnRect.left;
        if (left + pickerW > window.innerWidth - 16) {
          // Déborde à droite → ancrer à droite de l'écran avec marge
          left = window.innerWidth - pickerW - 16;
        }
        if (left < 16) left = 16; // ne pas sortir à gauche non plus

        // Vérifier débordement en bas
        var maxH = 260;
        if (top + maxH > window.innerHeight - 20) {
          // Afficher au-dessus du bouton si pas assez de place en bas
          top = btnRect.top - maxH - 6;
          if (top < 20) top = 20;
        }

        coverEmojiPicker.style.left   = left + 'px';
        coverEmojiPicker.style.top    = top  + 'px';
        coverEmojiPicker.style.width  = pickerW + 'px';
        coverEmojiPicker.style.display = 'block';
      }

      coverEmojiBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        _openCoverPicker();
      });
      coverEmojiBtn.addEventListener('touchend', function(e) {
        e.preventDefault();
        _openCoverPicker();
      }, { passive: false });

      // Onglets catégories
      coverEmojiPicker.querySelectorAll('[data-diary-emoji-cat]').forEach(function(tab) {
        tab.addEventListener('click', function() {
          var idx = this.getAttribute('data-diary-emoji-cat');
          // Activer l'onglet
          coverEmojiPicker.querySelectorAll('[data-diary-emoji-cat]').forEach(function(t) {
            var active = t.getAttribute('data-diary-emoji-cat') === idx;
            t.style.fontWeight    = active ? '700' : '500';
            t.style.background    = active ? 'var(--s1)' : 'transparent';
            t.style.color         = active ? 'var(--accent)' : 'var(--muted)';
            t.style.borderBottom  = active ? '2px solid var(--accent)' : '2px solid transparent';
          });
          // Afficher la grille
          coverEmojiPicker.querySelectorAll('[data-diary-emoji-grid]').forEach(function(g) {
            g.style.display = g.getAttribute('data-diary-emoji-grid') === idx ? 'flex' : 'none';
          });
        });
      });

      // Sélectionner un emoji de couverture
      coverEmojiPicker.querySelectorAll('[data-cover-emoji-pick]').forEach(function(btn) {
        function pickEmoji() {
          var emoji = btn.getAttribute('data-cover-emoji-pick');
          // Fix2: stocker l'emoji custom choisi
          _editorCoverEmoji = emoji;
          // Mettre à jour le bouton couverture sélectionné avec ce nouvel emoji
          var selectedCoverBtn = _view.querySelector('[data-cover-bg][style*="var(--accent)"]');
          if (!selectedCoverBtn) {
            // Prendre le premier bouton couverture sélectionné
            selectedCoverBtn = _view.querySelector('[data-cover-bg]');
          }
          if (selectedCoverBtn) {
            selectedCoverBtn.setAttribute('data-cover-emoji', emoji);
            selectedCoverBtn.textContent = emoji;
          }
          coverEmojiPicker.style.display = 'none';
          // Feedback visuel sur le bouton
          btn.style.background = 'var(--accent-s)';
          btn.style.transform  = 'scale(1.2)';
          setTimeout(function() {
            btn.style.background = 'var(--s2)';
            btn.style.transform  = '';
          }, 200);
        }
        btn.addEventListener('click', pickEmoji);
        btn.addEventListener('touchend', function(e) { e.preventDefault(); pickEmoji(); }, { passive: false });
      });

      // Fermer au clic extérieur
      document.addEventListener('click', function(e) {
        if (coverEmojiPicker.style.display !== 'none' &&
            !coverEmojiPicker.contains(e.target) &&
            e.target !== coverEmojiBtn) {
          coverEmojiPicker.style.display = 'none';
        }
      });

      // Fermer au scroll (le picker fixed ne suit pas le scroll)
      var diaryScroll = document.getElementById('diaryEditorScroll');
      if (diaryScroll) {
        diaryScroll.addEventListener('scroll', function() {
          coverEmojiPicker.style.display = 'none';
        }, { passive: true });
      }
    }

    // Insertion image dans le texte — click normal (ouvre file picker)
    document.getElementById('diaryFmtImg') && document.getElementById('diaryFmtImg').addEventListener('mousedown', function(e) {
      e.preventDefault();
      var fi = document.getElementById('diaryFileInput');
      if (fi) fi.click();
    });


    var fileInput = document.getElementById('diaryFileInput');
    if (fileInput) fileInput.addEventListener('change', function() {
      if (this.files && this.files[0]) _handleEditorImageUpload(this.files[0]);
      this.value = '';
    });

    // Image de fond
    var bgBtn = document.getElementById('diaryBgImgBtn');
    if (bgBtn) bgBtn.addEventListener('click', function() {
      var bfi = document.getElementById('diaryBgFileInput');
      if (bfi) bfi.click();
    });

    var bgDel = document.getElementById('diaryBgImgDel');
    if (bgDel) bgDel.addEventListener('click', function() {
      if (page) page.bg_image_url = null;
      _renderEditor(page);
    });

    var bgFileInput = document.getElementById('diaryBgFileInput');
    if (bgFileInput) bgFileInput.addEventListener('change', function() {
      if (this.files && this.files[0]) _handleBgImageUpload(this.files[0]);
      this.value = '';
    });

    // ── Police d'écriture ──────────────────────────────────────────
    var fontPicker  = document.getElementById('diaryFontPicker');
    var fontBtn     = document.getElementById('diaryFmtFont');
    var fontLabel   = document.getElementById('diaryFontLabel');

    // Met à jour le label du bouton police selon la position du curseur
    function _updateFontLabel() {
      if (!fontLabel || !editor) return;
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      var node = sel.anchorNode;
      var el = node ? (node.nodeType === 3 ? node.parentElement : node) : null;
      if (!el || !editor.contains(el)) return;
      var computed = window.getComputedStyle(el).fontFamily || '';
      var firstName = computed.split(',')[0].replace(/['"]/g, '').trim();
      if (!firstName) return;
      var shortName = _fontShortNames[firstName] || (firstName.length > 7 ? firstName.substring(0, 7) + '\u2026' : firstName);
      fontLabel.textContent = shortName;
    }

    function _toggleFontPicker() {
      if (!fontPicker) return;
      var isOpen = fontPicker.style.display !== 'none';
      // Fermer TOUS les autres pickers (y compris colorPicker)
      ['diaryColorPicker','diarySizePicker','diaryEmojiPicker','diaryListMenu'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
      fontPicker.style.display = isOpen ? 'none' : 'flex';
    }

    if (fontBtn) {
      fontBtn.addEventListener('mousedown', function(e) { e.preventDefault(); _saveSelection(); _toggleFontPicker(); });
      fontBtn.addEventListener('touchend',  function(e) { e.preventDefault(); _saveSelection(); _toggleFontPicker(); }, { passive: false });
    }

    if (fontPicker) {
      fontPicker.querySelectorAll('[data-diary-font]').forEach(function(btn) {
        function applyFont() {
          _histSnapshotNow();
          var fontStack = btn.getAttribute('data-diary-font');
          var labelText = (_fontDisplayNames && _fontDisplayNames[fontStack])
            ? _fontDisplayNames[fontStack]
            : (btn.querySelector('span:last-child') ? btn.querySelector('span:last-child').textContent : fontStack.split(',')[0].replace(/['"]/g,'').trim());

          // Restaurer la sélection SANS fermer le picker — permet de tester plusieurs polices
          _restoreSelection();
          var sel = window.getSelection();
          if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            var textNodes = _getTextNodesInRange(sel.getRangeAt(0));
            textNodes.forEach(function(info) {
              var node = info.node;
              var start = info.start;
              var end   = info.end;
              if (end < node.length) node.splitText(end);
              var target = (start > 0) ? node.splitText(start) : node;
              var parent = target.parentNode;
              if (parent && parent.tagName === 'SPAN' && parent.style.fontFamily) {
                parent.style.fontFamily = fontStack;
              } else {
                var span = document.createElement('span');
                span.style.fontFamily = fontStack;
                span.style.display = 'inline';
                parent.insertBefore(span, target);
                span.appendChild(target);
              }
            });
            // Re-sauver la sélection pour permettre d'appliquer une autre police
            _saveSelection();
          } else {
            // Aucune sélection → police globale de l'éditeur
            if (editor) editor.style.fontFamily = fontStack;
          }

          // Surligner le bouton actif, label mis à jour — picker reste ouvert
          fontPicker.querySelectorAll('[data-diary-font]').forEach(function(b) {
            b.style.background = 'var(--s2)';
            b.style.border = '1px solid var(--border)';
          });
          btn.style.background = 'var(--accent-s)';
          btn.style.border = '1.5px solid var(--accent)';
          if (fontLabel) fontLabel.textContent = labelText;
        }
        btn.addEventListener('mousedown', function(e) { e.preventDefault(); applyFont(); });
        btn.addEventListener('touchend',  function(e) { e.preventDefault(); applyFont(); }, { passive: false });
      });
    }

    // Mettre à jour le label police lors des déplacements du curseur
    if (editor) {
      editor.addEventListener('keyup',    _updateFontLabel);
      editor.addEventListener('mouseup',  _updateFontLabel);
      editor.addEventListener('touchend', _updateFontLabel, { passive: true });
    }

    // Placeholder éditeur
    if (editor) {
      editor.addEventListener('focus', function() {
        this.style.borderColor = 'var(--accent)';
      });
      editor.addEventListener('blur', function() {
        this.style.borderColor = 'var(--border)';
      });
      // Placeholder visuel
      editor.addEventListener('input', function() {
        this.setAttribute('data-empty', this.innerHTML === '' || this.innerHTML === '<br>' ? '1' : '0');
      });
    }

    // Canva validation
    var canvaInput    = document.getElementById('diaryCanvaInput');
    var canvaValidate = document.getElementById('diaryCanvaValidate');
    if (canvaValidate && canvaInput) {
      canvaValidate.addEventListener('click', function() {
        var url = canvaInput.value.trim();
        var fb  = document.getElementById('diaryCanvaFeedback');
        if (!url) { if (fb) fb.textContent = '⚠️ Colle un lien Canva'; return; }
        var valid = _validateCanvaUrl(url);
        if (!valid) {
          if (fb) { fb.textContent = '❌ Lien invalide — colle un lien canva.com/design/…'; fb.style.color = '#ff3b30'; }
          return;
        }
        _canvaValid = true;
        var embedTest = _sanitizeCanvaUrl(url);
        if (fb) {
          fb.textContent = '✅ Lien valide — aperçu intégré activé';
          fb.style.color = 'var(--accent)';
        }
      });
    }

    // Partage toggles
    var shareToggle  = document.getElementById('diaryShareToggle');
    var shareDot     = document.getElementById('diaryShareDot');
    var cowriteLabel = document.getElementById('diaryCowriteLabel');
    var cowriteToggle = document.getElementById('diaryCowriteToggle');
    var cowriteDot   = document.getElementById('diaryCowriteDot');

    if (shareToggle) shareToggle.addEventListener('click', function() {
      var on = this.getAttribute('data-on') === '1';
      on = !on;
      this.setAttribute('data-on', on ? '1' : '0');
      this.style.background = on ? 'var(--accent)' : 'var(--s3)';
      if (shareDot) shareDot.style.left = on ? '21px' : '3px';
      if (cowriteLabel) cowriteLabel.style.display = on ? 'flex' : 'none';
      if (!on && cowriteToggle) {
        cowriteToggle.setAttribute('data-on','0');
        cowriteToggle.style.background = 'var(--s3)';
        if (cowriteDot) cowriteDot.style.left = '3px';
      }
    });

    if (cowriteToggle) cowriteToggle.addEventListener('click', function() {
      var on = this.getAttribute('data-on') === '1';
      on = !on;
      this.setAttribute('data-on', on ? '1' : '0');
      this.style.background = on ? 'var(--sage)' : 'var(--s3)';
      if (cowriteDot) cowriteDot.style.left = on ? '21px' : '3px';
    });

    // Supprimer
    var delBtn = document.getElementById('diaryDeleteBtn');
    if (delBtn) delBtn.addEventListener('click', _deletePage);

    // Éditeur contenteditable placeholder CSS
    _injectEditorCSS();

  }

  // Sauvegarde/restauration de sélection pour la toolbar
  var _savedRange = null;

  function _saveSelection() {
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      _savedRange = sel.getRangeAt(0).cloneRange();
    }
  }

  function _restoreSelection() {
    var editor = document.getElementById('diaryEditor');
    if (!editor) return false;
    editor.focus();
    if (_savedRange) {
      var sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(_savedRange);
        return true;
      }
    }
    return false;
  }

  function _execFmt(cmd, val) {
    _histSnapshotNow(); // snapshot avant modification
    _restoreSelection();
    document.execCommand(cmd, false, val || null);
    _saveSelection();
  }

  function _renderEditorImages() {
    // Fix5: no-op — les images sont insérées directement dans l'éditeur contenteditable,
    // pas dans une galerie séparée qui créait un doublon
  }

  // ─── 10. UPLOAD IMAGES ────────────────────────────────────────────
  // Compression — délègue à window.compressImage (Promise, app-account.js)
  // Fallback interne identique : qualités [0.82, 0.65, 0.45], URL.createObjectURL
  function _compressImage(file, maxW, maxBytes, cb) {
    var isHeic = file.type === 'image/heic' || file.type === 'image/heif'
              || (file.name && (file.name.toLowerCase().endsWith('.heic')
                             || file.name.toLowerCase().endsWith('.heif')));
    if (isHeic) {
      showToast('Format HEIC non supporté — convertis en JPG dans Photos puis réessaie', 'error', 4000);
      cb(null); return;
    }
    if (typeof window.compressImage === 'function') {
      window.compressImage(file, maxW, maxBytes)
        .then(function(blob) { cb(blob); })
        .catch(function(err) {
          if (err && err.message === 'HEIC_NOT_SUPPORTED') {
            showToast('Format HEIC non supporté — convertis en JPG', 'error', 4000);
            cb(null);
          } else {
            _compressImageFallback(file, maxW, maxBytes, cb);
          }
        });
      return;
    }
    _compressImageFallback(file, maxW, maxBytes, cb);
  }

  // Fallback — copie exacte de window.compressImage (app-account.js) en callback
  function _compressImageFallback(file, maxW, maxBytes, cb) {
    var img = new Image();
    var objectUrl = URL.createObjectURL(file);
    img.onload = function() {
      URL.revokeObjectURL(objectUrl);
      var w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      if (!ctx) { cb(null); return; }
      ctx.drawImage(img, 0, 0, w, h);
      var qualities = [0.82, 0.65, 0.45];
      var idx = 0;
      function tryQ() {
        if (idx >= qualities.length) {
          canvas.toBlob(function(b) { cb(b || null); }, 'image/jpeg', 0.45); return;
        }
        var q = qualities[idx++];
        canvas.toBlob(function(b) {
          if (!b) { cb(null); return; }
          if (!maxBytes || b.size <= maxBytes) { cb(b); } else { tryQ(); }
        }, 'image/jpeg', q);
      }
      tryQ();
    };
    img.onerror = function() { URL.revokeObjectURL(objectUrl); cb(null); };
    img.src = objectUrl;
  }

  function _uploadToStorage(blob, path, cb) {
    var u = yamGetUser();
    if (!u) { cb(null); return; }
    var url = SB_URL + '/storage/v1/object/images/' + path;
    fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, sb2Headers()),
      body: blob,
    })
    .then(function(r) {
      if (!r.ok) throw new Error('Upload failed ' + r.status);
      return r.json();
    })
    .then(function(data) {
      var publicUrl = SB_URL + '/storage/v1/object/public/images/' + path;
      cb(publicUrl);
    })
    .catch(function(err) {
      yamLog('[Diary] Upload error:', err);
      cb(null);
    });
  }

  function _handleEditorImageUpload(file) {
    if (!file.type.startsWith('image/')) { showToast('Format non supporté', 'error'); return; }
    var u = yamGetUser();
    if (!u) return;
    showToast('Compression…', '', 1000);
    _histSnapshotNow(); // snapshot avant insertion image

    _compressImage(file, 1200, MAX_IMG_BYTES, function(blob) {
      if (!blob) { showToast('Erreur compression', 'error'); return; }
      var path = 'diary/' + u.couple_id + '/' + Date.now() + '.jpg';
      _uploadToStorage(blob, path, function(url) {
        if (!url) { showToast('Erreur upload', 'error'); return; }
        _editorImages.push({ url: url, slot: Date.now() });
        var editorEl = document.getElementById('diaryEditor');
        if (editorEl) {
          editorEl.focus();
          // Fix4: wrapper avec poignée JS custom — fonctionne iOS + desktop
          // width inline = persiste après save/reload
          var imgHtml =
            '<span contenteditable="false" class="diary-img-wrap" ' +
              'style="display:inline-block;position:relative;width:280px;max-width:100%;' +
              'border-radius:10px;margin:8px 2px;vertical-align:bottom;' +
              'box-shadow:0 2px 8px rgba(0,0,0,0.15);">' +
              '<img src="' + escHtml(url) + '" ' +
                'style="width:100%;height:auto;display:block;border-radius:10px;" ' +
                'alt="">' +
              // Poignée de redimensionnement bas-droite
              '<span class="diary-img-handle" ' +
                'style="position:absolute;bottom:0;right:0;width:22px;height:22px;cursor:nwse-resize;' +
                'touch-action:none;z-index:2;' +
                'background:linear-gradient(135deg,transparent 50%,rgba(0,0,0,0.35) 50%);">' +
              '</span>' +
            '</span> ';
          document.execCommand('insertHTML', false, imgHtml);
          _injectImgWrapCSS();
          // Activer la poignée sur tous les wraps existants dans l'éditeur
          setTimeout(function() { _bindImgResizeHandles(editorEl); }, 50);
        }
        showToast('Image insérée ✨ — Tire le coin └ pour la redimensionner', 'success', 3500);
        haptic('success');
      });
    });
  }

  // Fix4 — Lie les poignées de redimensionnement JS (touch + mouse) sur toutes les images de l'éditeur
  // Fix6 — UI de rognage avec poignées de coin draggables (iOS + desktop)
  function _openCropUI(imgEl, wrapEl) {
    var imgSrc = imgEl.getAttribute('src') || imgEl.src;
    if (!imgSrc) return;

    // ── Overlay ──
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:10000;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'gap:16px;padding:20px 16px;box-sizing:border-box;';

    var titleEl = document.createElement('div');
    titleEl.style.cssText = 'color:#fff;font-size:15px;font-weight:700;font-family:DM Sans,sans-serif;';
    titleEl.textContent = 'Rogner l’image';
    overlay.appendChild(titleEl);

    // ── Zone crop : image + cadre de sélection ──
    var cropArea = document.createElement('div');
    cropArea.style.cssText = 'position:relative;touch-action:none;display:inline-block;' +
      'max-width:min(500px,calc(100vw - 32px));border-radius:10px;overflow:hidden;' +
      'user-select:none;-webkit-user-select:none;';

    var imgDisplay = document.createElement('img');
    imgDisplay.crossOrigin = 'anonymous';
    imgDisplay.style.cssText = 'display:block;max-width:100%;max-height:52vh;border-radius:10px;';
    cropArea.appendChild(imgDisplay);

    // Masque sombre autour de la sélection
    var maskTop    = _makeMask();
    var maskBottom = _makeMask();
    var maskLeft   = _makeMask();
    var maskRight  = _makeMask();
    [maskTop, maskBottom, maskLeft, maskRight].forEach(function(m){ cropArea.appendChild(m); });

    // Cadre de sélection blanc
    var selFrame = document.createElement('div');
    selFrame.style.cssText = 'position:absolute;border:2px solid #fff;box-sizing:border-box;' +
      'pointer-events:none;';
    cropArea.appendChild(selFrame);

    // 4 poignées de coin
    var HANDLE_SIZE = 22; // px — assez grand pour le doigt
    var corners = ['tl','tr','bl','br'];
    var handles = {};
    corners.forEach(function(c) {
      var h = document.createElement('div');
      h.dataset.corner = c;
      h.style.cssText = 'position:absolute;width:' + HANDLE_SIZE + 'px;height:' + HANDLE_SIZE + 'px;' +
        'border-radius:50%;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,0.5);' +
        'cursor:pointer;touch-action:none;z-index:2;' +
        'transform:translate(-50%,-50%);';
      cropArea.appendChild(h);
      handles[c] = h;
    });

    overlay.appendChild(cropArea);

    function _makeMask() {
      var d = document.createElement('div');
      d.style.cssText = 'position:absolute;background:rgba(0,0,0,0.5);pointer-events:none;';
      return d;
    }

    // ── État ──
    var iW = 0, iH = 0;   // dimensions d'affichage de l'image
    var sel = { x:0, y:0, w:0, h:0 }; // sélection en px affichage

    imgDisplay.onload = function() {
      iW = imgDisplay.offsetWidth  || imgDisplay.naturalWidth;
      iH = imgDisplay.offsetHeight || imgDisplay.naturalHeight;
      // Sélection initiale = marges de 10%
      var margin = Math.min(iW, iH) * 0.1;
      sel = { x: margin, y: margin, w: iW - margin*2, h: iH - margin*2 };
      _redraw();
    };
    imgDisplay.src = imgSrc;

    function _redraw() {
      var x = sel.x, y = sel.y, w = sel.w, h = sel.h;
      selFrame.style.left   = x + 'px';
      selFrame.style.top    = y + 'px';
      selFrame.style.width  = w + 'px';
      selFrame.style.height = h + 'px';
      // Masques
      maskTop.style.cssText    += ';left:0;top:0;right:0;height:' + y + 'px;';
      maskBottom.style.cssText += ';left:0;bottom:0;right:0;height:' + (iH - y - h) + 'px;';
      maskLeft.style.cssText   += ';left:0;top:' + y + 'px;width:' + x + 'px;height:' + h + 'px;';
      maskRight.style.cssText  += ';right:0;top:' + y + 'px;width:' + (iW - x - w) + 'px;height:' + h + 'px;';
      // Reposition poignées
      handles.tl.style.left = x + 'px'; handles.tl.style.top = y + 'px';
      handles.tr.style.left = (x+w) + 'px'; handles.tr.style.top = y + 'px';
      handles.bl.style.left = x + 'px'; handles.bl.style.top  = (y+h) + 'px';
      handles.br.style.left = (x+w) + 'px'; handles.br.style.top = (y+h) + 'px';
    }

    // ── Drag des poignées ──
    var activeDrag = null; // {corner, startX, startY, origSel}

    function _clientPos(e) {
      var t = e.changedTouches ? e.changedTouches[0] : (e.touches ? e.touches[0] : e);
      var rect = cropArea.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(t.clientX - rect.left, iW)),
        y: Math.max(0, Math.min(t.clientY - rect.top,  iH))
      };
    }

    function _onHandleStart(e) {
      e.preventDefault(); e.stopPropagation();
      var p = _clientPos(e);
      activeDrag = {
        corner: e.currentTarget.dataset.corner,
        startX: p.x, startY: p.y,
        origSel: { x: sel.x, y: sel.y, w: sel.w, h: sel.h }
      };
    }
    function _onMove(e) {
      if (!activeDrag) return;
      e.preventDefault();
      var p  = _clientPos(e);
      var dx = p.x - activeDrag.startX;
      var dy = p.y - activeDrag.startY;
      var o  = activeDrag.origSel;
      var MIN = 40;

      if (activeDrag.corner === 'tl') {
        sel.x = Math.max(0, Math.min(o.x + dx, o.x + o.w - MIN));
        sel.y = Math.max(0, Math.min(o.y + dy, o.y + o.h - MIN));
        sel.w = o.x + o.w - sel.x;
        sel.h = o.y + o.h - sel.y;
      } else if (activeDrag.corner === 'tr') {
        sel.y = Math.max(0, Math.min(o.y + dy, o.y + o.h - MIN));
        sel.w = Math.max(MIN, Math.min(o.w + dx, iW - o.x));
        sel.h = o.y + o.h - sel.y;
      } else if (activeDrag.corner === 'bl') {
        sel.x = Math.max(0, Math.min(o.x + dx, o.x + o.w - MIN));
        sel.w = o.x + o.w - sel.x;
        sel.h = Math.max(MIN, Math.min(o.h + dy, iH - o.y));
      } else { // br
        sel.w = Math.max(MIN, Math.min(o.w + dx, iW - o.x));
        sel.h = Math.max(MIN, Math.min(o.h + dy, iH - o.y));
      }
      _redraw();
    }
    function _onUp(e) { activeDrag = null; }

    corners.forEach(function(c) {
      handles[c].addEventListener('mousedown',  _onHandleStart);
      handles[c].addEventListener('touchstart', _onHandleStart, { passive: false });
    });
    document.addEventListener('mousemove',  _onMove);
    document.addEventListener('touchmove',  _onMove, { passive: false });
    document.addEventListener('mouseup',    _onUp);
    document.addEventListener('touchend',   _onUp);

    // ── Boutons ──
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;';

    function _makeBtn(text, accent) {
      var b = document.createElement('button');
      b.style.cssText = 'padding:11px 24px;border-radius:22px;font-size:13px;font-weight:700;' +
        'cursor:pointer;font-family:DM Sans,sans-serif;border:none;touch-action:manipulation;' +
        (accent ? 'background:var(--accent);color:#fff;'
                : 'background:rgba(255,255,255,0.15);color:#fff;border:1.5px solid rgba(255,255,255,0.3);');
      b.textContent = text;
      return b;
    }

    var btnCancel = _makeBtn('Annuler', false);
    btnCancel.addEventListener('click', function() {
      document.removeEventListener('mousemove', _onMove);
      document.removeEventListener('touchmove', _onMove);
      document.removeEventListener('mouseup',   _onUp);
      document.removeEventListener('touchend',  _onUp);
      document.body.removeChild(overlay);
    });

    var btnApply = _makeBtn('✔ Rogner', true);
    btnApply.addEventListener('click', function() {
      // Calculer le ratio entre taille naturelle et taille affichée
      var scaleX = imgDisplay.naturalWidth  / iW;
      var scaleY = imgDisplay.naturalHeight / iH;
      var rx = Math.round(sel.x * scaleX);
      var ry = Math.round(sel.y * scaleY);
      var rw = Math.round(sel.w * scaleX);
      var rh = Math.round(sel.h * scaleY);
      if (rw < 10 || rh < 10) { showToast('Zone trop petite', 'error'); return; }

      var outCanvas = document.createElement('canvas');
      outCanvas.width  = rw; outCanvas.height = rh;

      // Charger l'image avec crossOrigin pour le canvas
      var imgForCrop = new Image();
      imgForCrop.crossOrigin = 'anonymous';
      imgForCrop.onload = function() {
        outCanvas.getContext('2d').drawImage(imgForCrop, rx, ry, rw, rh, 0, 0, rw, rh);
        outCanvas.toBlob(function(blob) {
          if (!blob) { showToast('Erreur rognage', 'error'); return; }
          var u = yamGetUser();
          if (!u) return;
          btnApply.textContent = '⏳'; btnApply.disabled = true;
          var path = 'diary/' + u.couple_id + '/crop-' + Date.now() + '.jpg';
          _uploadToStorage(blob, path, function(newUrl) {
            document.removeEventListener('mousemove', _onMove);
            document.removeEventListener('touchmove', _onMove);
            document.removeEventListener('mouseup',   _onUp);
            document.removeEventListener('touchend',  _onUp);
            if (!newUrl) {
              showToast('Erreur upload', 'error');
              btnApply.textContent = '✔ Rogner'; btnApply.disabled = false; return;
            }
            imgEl.setAttribute('src', newUrl);
            imgEl.src = newUrl;
            for (var i = 0; i < _editorImages.length; i++) {
              if (_editorImages[i].url === imgSrc) { _editorImages[i].url = newUrl; break; }
            }
            document.body.removeChild(overlay);
            showToast('Image rognée ✨', 'success');
            haptic('success');
          });
        }, 'image/jpeg', 0.92);
      };
      imgForCrop.src = imgSrc;
    });

    btnRow.appendChild(btnCancel);
    btnRow.appendChild(btnApply);
    overlay.appendChild(btnRow);

    var hint = document.createElement('div');
    hint.style.cssText = 'color:rgba(255,255,255,0.4);font-size:11px;text-align:center;font-family:DM Sans,sans-serif;';
    hint.textContent = 'Tire les coins blancs pour ajuster la zone';
    overlay.appendChild(hint);

    document.body.appendChild(overlay);
    haptic('light');
  }

  function _bindImgResizeHandles(container) {
    if (!container) return;
    container.querySelectorAll('.diary-img-wrap').forEach(function(wrap) {
      // Fix4/6: deux flags séparés — resize et crop peuvent être rebindés indépendamment
      wrap.setAttribute('contenteditable', 'false');

      // ── Resize handle ──
      if (!wrap._rBound) {
        wrap._rBound = true;

        var handle = wrap.querySelector('.diary-img-handle');
        if (!handle) {
          handle = document.createElement('span');
          handle.className = 'diary-img-handle';
          handle.style.cssText = 'position:absolute;bottom:0;right:0;width:26px;height:26px;' +
            'cursor:nwse-resize;touch-action:none;z-index:2;' +
            'background:linear-gradient(135deg,transparent 40%,rgba(0,0,0,0.4) 40%);' +
            'border-radius:0 0 10px 0;';
          wrap.appendChild(handle);
        }

        var startX, startW;
        function onStart(e) {
          e.preventDefault(); e.stopPropagation();
          var clientX = e.touches ? e.touches[0].clientX : e.clientX;
          startX = clientX; startW = wrap.offsetWidth;
          document.addEventListener('mousemove', onMove);
          document.addEventListener('touchmove', onMove, { passive: false });
          document.addEventListener('mouseup',   onEnd);
          document.addEventListener('touchend',  onEnd);
        }
        function onMove(e) {
          e.preventDefault();
          var clientX = e.touches ? e.touches[0].clientX : e.clientX;
          var maxW = wrap.parentElement ? wrap.parentElement.offsetWidth : 600;
          wrap.style.width = Math.max(80, Math.min(startW + (clientX - startX), maxW)) + 'px';
        }
        function onEnd() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('touchmove', onMove);
          document.removeEventListener('mouseup',   onEnd);
          document.removeEventListener('touchend',  onEnd);
        }
        handle.addEventListener('mousedown',  onStart);
        handle.addEventListener('touchstart', onStart, { passive: false });
      }

      // ── Bouton crop — toujours recréé (supprimer l'ancien HTML sans listeners) ──
      var existingCropBtn = wrap.querySelector('.diary-img-crop-btn');
      if (existingCropBtn) existingCropBtn.remove(); // peut être un nœud HTML sans listeners
      if (true) {
        var cropBtn = document.createElement('button');
        cropBtn.className = 'diary-img-crop-btn';
        cropBtn.title = 'Rogner';
        cropBtn.setAttribute('contenteditable', 'false');
        cropBtn.style.cssText = 'position:absolute;top:5px;left:5px;width:28px;height:28px;' +
          'border-radius:8px;border:none;cursor:pointer;background:rgba(0,0,0,0.45);' +
          'color:#fff;font-size:15px;display:flex;align-items:center;justify-content:center;z-index:3;' +
          'touch-action:manipulation;';
        cropBtn.innerHTML = '&#x2702;&#xFE0F;';
        cropBtn.addEventListener('mousedown', function(e) { e.preventDefault(); e.stopPropagation(); });
        cropBtn.addEventListener('click', function(e) {
          e.preventDefault(); e.stopPropagation();
          var imgEl = wrap.querySelector('img');
          if (imgEl) _openCropUI(imgEl, wrap);
        });
        // iOS : touchend déclenche mieux que click
        cropBtn.addEventListener('touchend', function(e) {
          e.preventDefault(); e.stopPropagation();
          var imgEl = wrap.querySelector('img');
          if (imgEl) _openCropUI(imgEl, wrap);
        }, { passive: false });
        wrap.appendChild(cropBtn);
      }

    });
  }

  // Fix4 — CSS du wrapper image (injecté une seule fois)
  function _injectImgWrapCSS() {
    if (document.getElementById('diary-img-wrap-css')) return;
    var s = document.createElement('style');
    s.id = 'diary-img-wrap-css';
    s.textContent = [
      /* Éditeur */
      '.diary-img-wrap { box-sizing:border-box; user-select:none; -webkit-user-select:none; }',
      /* Lecture — respecter la width inline sauvegardée */
      '.diary-rich-content .diary-img-wrap { display:inline-block;max-width:100%;' +
        'border-radius:10px;margin:6px 2px;vertical-align:bottom;overflow:hidden; }',
      '.diary-rich-content .diary-img-wrap img { width:100%;height:auto;display:block;border-radius:10px; }',
      /* Fix5b: cacher handle ET bouton crop en lecture */
      '.diary-rich-content .diary-img-handle { display:none !important; }',
      '.diary-rich-content .diary-img-crop-btn { display:none !important; }',
    ].join(' ');
    document.head.appendChild(s);
  }

  function _handleBgImageUpload(file) {
    if (!file.type.startsWith('image/')) { showToast('Format non supporté', 'error'); return; }
    var u = yamGetUser();
    if (!u) return;
    showToast('Upload…', '', 1500);

    _compressImage(file, 1400, MAX_BG_IMG_BYTES, function(blob) {
      if (!blob) { showToast('Erreur compression', 'error'); return; }
      var path = 'diary-bg/' + u.couple_id + '/' + Date.now() + '.jpg';
      _uploadToStorage(blob, path, function(url) {
        if (!url) { showToast('Erreur upload', 'error'); return; }
        if (!_currentPage) _currentPage = {};
        _currentPage.bg_image_url = url;
        // Ré-render juste le bouton
        var bgBtn = document.getElementById('diaryBgImgBtn');
        if (bgBtn) bgBtn.insertAdjacentHTML('afterend',
          '<img src="' + escHtml(url) + '" style="width:36px;height:36px;border-radius:8px;object-fit:cover;">');
        showToast('Image de fond ajoutée ✨', 'success');
        haptic('success');
      });
    });
  }

  // ─── 11. SAUVEGARDE ───────────────────────────────────────────────
  function _savePage() {
    if (_saving) return;
    var u = yamGetUser();
    if (!u) return;

    var titleEl    = document.getElementById('diaryEditorTitle');
    var editorEl   = document.getElementById('diaryEditor');
    var canvaInput = document.getElementById('diaryCanvaInput');
    var canvaNote  = document.getElementById('diaryCanvaNote');

    var textSection  = document.getElementById('diaryTextSection');
    var canvaSection = document.getElementById('diaryCanvaSection');
    var isCanvaMode  = canvaSection && canvaSection.style.display !== 'none';

    var title    = titleEl ? titleEl.value.trim() : '';
    var content  = '';
    var canvaUrl = null;

    if (isCanvaMode) {
      canvaUrl = canvaInput ? canvaInput.value.trim() : '';
      if (canvaUrl && !_validateCanvaUrl(canvaUrl)) {
        showToast('Lien Canva invalide', 'error');
        return;
      }
      if (!canvaUrl) canvaUrl = null;
      content = canvaNote ? canvaNote.value.trim() : '';
    } else {
      if (editorEl) {
        // Sanitize HTML avant sauvegarde
        // Nettoyer les artefacts de _fixListColors avant sauvegarde :
        // - li.style.color mis dynamiquement (ne doit pas être persisté)
        // - data-puce-id mis dynamiquement
        // - style diary-puce-colors (dans <head>, pas dans contenu)
        var editorClone = editorEl.cloneNode(true);
        editorClone.querySelectorAll('li').forEach(function(li) {
          li.style.color = '';
          li.style.userSelect = '';
          li.style.webkitUserSelect = '';
          li.removeAttribute('data-puce-id');
          if (!li.style.cssText.trim()) li.removeAttribute('style');
        });
        // Nettoyer user-select sur tous les éléments (artefact iOS)
        editorClone.querySelectorAll('[style*="user-select"]').forEach(function(el) {
          el.style.userSelect = '';
          el.style.webkitUserSelect = '';
          if (!el.style.cssText.trim()) el.removeAttribute('style');
        });
        // Supprimer les éléments d'UI éditeur (crop-btn, handle resize) — ne doivent pas être persistés
        // Ainsi au rechargement _bindImgResizeHandles les recrée avec leurs event listeners
        editorClone.querySelectorAll('.diary-img-crop-btn,.diary-img-handle').forEach(function(el){ el.remove(); });

        // Nettoyer les spans sans style utile — mais PROTÉGER :
        // - diary-img-wrap (wrapper image avec width inline = taille sauvegardée)
        // - spans avec font-size (taille de texte)
        editorClone.querySelectorAll('span').forEach(function(sp) {
          // Protéger le wrapper image : a class diary-img-wrap + width inline
          if (sp.classList && sp.classList.contains('diary-img-wrap')) return;
          // Protéger les spans de taille (font-size)
          if (sp.style && sp.style.fontSize) return;
          // Protéger les spans de police (font-family)
          if (sp.style && sp.style.fontFamily) return;
          if (sp.style && !sp.style.color && !sp.style.fontWeight &&
              !sp.style.fontStyle && !sp.style.textDecoration) {
            // Span vide de style utile → unwrap
            var p = sp.parentNode;
            if (p) { while (sp.firstChild) p.insertBefore(sp.firstChild, sp); p.removeChild(sp); }
          }
        });
        content = _sanitizeHTML(editorClone.innerHTML);
      }
    }

    if (!title && !content && !canvaUrl) {
      showToast('La page est vide', 'error'); return;
    }

    // Fix2 : couverture sélectionnée
    var selectedCover = _view.querySelector('[data-cover-bg][style*="var(--accent)"]');
    // Si aucune couverture sélectionnée et _editorCoverEmoji null → pas de couverture
    var coverBg    = selectedCover ? selectedCover.getAttribute('data-cover-bg') : null;
    var coverEmoji = _editorCoverEmoji
      || (selectedCover ? selectedCover.getAttribute('data-cover-emoji') : null)
      || null;

    // Humeur sélectionnée
    var selectedMood = _view.querySelector('[data-mood][style*="var(--accent)"]');
    // null si désélectionné (reclic) ou jamais sélectionné
    var mood = selectedMood ? selectedMood.getAttribute('data-mood') : null;

    // Canva design ID
    var canvaDesignId = canvaUrl ? _extractCanvaDesignId(canvaUrl) : null;

    // Partage
    var shareToggle   = document.getElementById('diaryShareToggle');
    var cowriteToggle = document.getElementById('diaryCowriteToggle');
    var isShared      = shareToggle   ? shareToggle.getAttribute('data-on')   === '1' : false;
    var canCowrite    = cowriteToggle ? cowriteToggle.getAttribute('data-on') === '1' : false;

    var bgImageUrl = (_currentPage && _currentPage.bg_image_url) || null;

    // Garder l'auteur original si co-écriture (page appartenant au partenaire)
    var originalAuthor = (_currentPage && _currentPage.author_role) ? _currentPage.author_role : u.role;

    var payload = {
      couple_id:        u.couple_id,
      author_role:      originalAuthor,
      title:            title.substring(0, 100),
      content:          content.substring(0, 50000),
      mood:             mood || null,
      cover_color:      coverBg,
      cover_emoji:      coverEmoji,
      canva_url:        canvaUrl,
      canva_design_id:  canvaDesignId,
      images:           JSON.stringify(_editorImages),
      is_shared:        isShared,
      partner_can_edit: isShared && canCowrite,
      bg_image_url:     bgImageUrl,
      last_editor_role: u.role,   // auteur de cette modification
      updated_at:       new Date().toISOString(),
    };

    _saving = true;
    var saveBtn = document.getElementById('diaryEditorSave');
    if (saveBtn) { saveBtn.textContent = '⏳'; saveBtn.disabled = true; }

    var promise;
    if (_currentPage && _currentPage.id) {
      promise = sb2Patch(DIARY_TBL, 'id=eq.' + _currentPage.id, payload);
    } else {
      promise = sb2Post(DIARY_TBL, payload);
    }

    promise.then(function(rows) {
      _saving = false;
      if (saveBtn) { saveBtn.textContent = '💾 Sauver'; saveBtn.disabled = false; }

      var saved = Array.isArray(rows) && rows.length > 0 ? rows[0] : (_currentPage || payload);
      if (!saved.id && _currentPage && _currentPage.id) saved.id = _currentPage.id;

      showToast('Page sauvegardée 📔', 'success');
      haptic('success');

      if (typeof window.yamFlameActivity === 'function') {
        yamFlameActivity('diary_write');
      }

      // Mettre à jour le cache local
      if (_currentPage && _currentPage.id) {
        _pages = _pages.map(function(p) { return p.id === _currentPage.id ? Object.assign({}, p, payload, { id: _currentPage.id }) : p; });
      } else {
        _loadPages(false);
      }

      _mode = 'list';
      _currentPage = null;
      _renderList();
    })
    .catch(function(err) {
      _saving = false;
      if (saveBtn) { saveBtn.textContent = '💾 Sauver'; saveBtn.disabled = false; }
      yamLog('[Diary] Erreur save:', err);
      showToast('Erreur sauvegarde', 'error');
    });
  }

  // ─── 12. SUPPRESSION ──────────────────────────────────────────────
  function _deletePage() {
    if (!_currentPage || !_currentPage.id) return;
    if (!confirm('Supprimer définitivement cette page ?')) return;

    sb2Delete(DIARY_TBL, 'id=eq.' + _currentPage.id)
      .then(function() {
        _pages = _pages.filter(function(p) { return p.id !== _currentPage.id; });
        showToast('Page supprimée', '', 2000);
        haptic('light');
        _mode = 'list';
        _currentPage = null;
        _renderList();
      })
      .catch(function() { showToast('Erreur suppression', 'error'); });
  }

  // ─── 13. LIGHTBOX ─────────────────────────────────────────────────
  function _openLightbox(url) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;cursor:pointer;';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    var img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.style.cssText = 'max-width:92vw;max-height:85vh;border-radius:12px;object-fit:contain;';
    overlay.appendChild(img);
    overlay.addEventListener('click', function() { document.body.removeChild(overlay); });
    document.body.appendChild(overlay);
    haptic('light');
  }

  // ─── 14. HELPERS HTML / SÉCURITÉ ──────────────────────────────────

  // Sanitize HTML : garde uniquement les balises sûres
  function _sanitizeHTML(html) {
    if (!html) return '';
    var tmp = document.createElement('div');
    tmp.innerHTML = html;

    // Supprimer les scripts et autres balises dangereuses
    var dangerous = tmp.querySelectorAll('script,iframe[src]:not([src*="canva"]),object,embed,form,input,link,meta,style,base');
    dangerous.forEach(function(el) { el.remove(); });

    // Supprimer les attributs event handlers sur tous les éléments
    tmp.querySelectorAll('*').forEach(function(el) {
      var attrs = Array.prototype.slice.call(el.attributes);
      attrs.forEach(function(attr) {
        var n = attr.name.toLowerCase();
        if (n.startsWith('on') || n === 'href' && attr.value.toLowerCase().trim().startsWith('javascript')) {
          el.removeAttribute(attr.name);
        }
        // Valider src des images
        if (n === 'src' && el.tagName === 'IMG') {
          var srcVal = attr.value;
          if (!srcVal.startsWith('http') && !srcVal.startsWith('data:image') && !srcVal.startsWith('blob:')) {
            el.removeAttribute('src');
          }
        }
      });
      // Fix4: préserver la width inline des wrappers d'image (pour que le resize soit persisté)
      if (el.classList && el.classList.contains('diary-img-wrap') && el.style && el.style.width) {
        // width inline intentionnel — ne pas le supprimer
      }
    });

    return tmp.innerHTML;
  }

  // Strip HTML pour aperçu texte brut
  function _stripHTML(html) {
    if (!html) return '';
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    // Supprimer les éléments d'UI (bouton crop, poignée resize) avant extraction texte
    tmp.querySelectorAll('.diary-img-crop-btn,.diary-img-handle').forEach(function(el){ el.remove(); });
    return tmp.textContent || tmp.innerText || '';
  }

  // Valider URL Canva
  // Valider URL Canva — accepte www.canva.com/design/... ET canva.link/... (raccourcis)
  // Carte Canva : thumbnail oEmbed + bouton "Voir" qui ouvre un viewer in-app
  function _canvaCard(url) {
    return '<div style="background:var(--s2);border-radius:18px;border:1px solid var(--border);' +
      'overflow:hidden;">' +
      // Zone thumbnail — affiche aperçu oEmbed ou placeholder
      '<div id="canva-thumb-wrap" style="width:100%;min-height:180px;background:var(--s3);' +
        'display:flex;align-items:center;justify-content:center;position:relative;">' +
        '<div style="font-size:48px;">📐</div>' +
      '</div>' +
      // Footer carte
      '<div style="padding:14px 16px;display:flex;align-items:center;gap:10px;">' +
        '<div style="flex:1;min-width:0;">' +
          '<div id="canva-card-title" style="font-size:14px;font-weight:700;color:var(--text);' +
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Présentation Canva</div>' +
          '<div style="font-size:11px;color:var(--muted);margin-top:2px;">canva.com</div>' +
        '</div>' +
        // Bouton viewer in-app
        '<button id="diaryCanvaViewBtn" ' +
          'style="flex-shrink:0;padding:9px 18px;border-radius:18px;border:none;' +
          'background:var(--accent);color:#fff;font-size:12px;font-weight:700;' +
          'cursor:pointer;font-family:DM Sans,sans-serif;">' +
          '▶ Voir' +
        '</button>' +
      '</div>' +
    '</div>';
  }

  // Carte compacte pour l'éditeur
  function _canvaFallbackCard(url, large) {
    if (large) return _canvaCard(url);
    return '<div style="padding:12px 14px;background:var(--s2);border-radius:12px;' +
      'border:1px solid var(--border);display:flex;align-items:center;gap:10px;">' +
      '<div id="canva-thumb-wrap" style="width:48px;height:34px;border-radius:6px;' +
        'background:var(--s3);display:flex;align-items:center;justify-content:center;' +
        'font-size:18px;flex-shrink:0;">📐</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div id="canva-card-title" style="font-size:12px;font-weight:700;color:var(--text);' +
          'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Présentation Canva</div>' +
        '<div style="font-size:10px;color:var(--muted);">canva.com</div>' +
      '</div>' +
      '<button id="diaryCanvaViewBtn" ' +
        'style="flex-shrink:0;padding:7px 14px;border-radius:14px;border:none;' +
        'background:var(--accent);color:#fff;font-size:11px;font-weight:700;' +
        'cursor:pointer;font-family:DM Sans,sans-serif;">▶ Voir</button>' +
    '</div>';
  }

  // Enrichir la carte via Edge Function canva-proxy (résout le CORS)
  function _loadCanvaOembed(containerEl, url, large) {
    if (!containerEl || !url) return;

    // Bind le bouton Voir → ouvre le viewer in-app
    var viewBtn = containerEl.querySelector('#diaryCanvaViewBtn');
    if (viewBtn) {
      viewBtn.addEventListener('click', function() {
        _openCanvaViewer(url, viewBtn.dataset.viewUrl);
      });
      viewBtn.addEventListener('touchend', function(e) {
        e.preventDefault(); _openCanvaViewer(url, viewBtn.dataset.viewUrl);
      }, { passive: false });
    }

    // Appel Edge Function canva-proxy (côté serveur → pas de CORS)
    fetch(SB_EDGE_CANVA, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, sb2Headers()),
      body: JSON.stringify({ action: 'oembed', url: url }),
    })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (!data || !data.ok) return;

        // Mettre à jour le titre
        var titleEl = containerEl.querySelector('#canva-card-title');
        if (titleEl && data.title) titleEl.textContent = data.title;

        // Mettre à jour la thumbnail
        if (data.thumbnail_url) {
          var wrap = containerEl.querySelector('#canva-thumb-wrap');
          if (wrap) {
            if (large) {
              // Grande carte : image pleine largeur avec ratio
              wrap.style.minHeight = '0';
              wrap.innerHTML =
                '<img src="' + escHtml(data.thumbnail_url) + '" ' +
                  'style="width:100%;display:block;border-radius:18px 18px 0 0;' +
                  'max-height:280px;object-fit:cover;" ' +
                  'alt="Aperçu Canva">';
            } else {
              // Petite carte : thumbnail compacte
              wrap.innerHTML =
                '<img src="' + escHtml(data.thumbnail_url) + '" ' +
                  'style="width:48px;height:34px;object-fit:cover;' +
                  'border-radius:6px;display:block;" alt="">';
            }
          }
        }

        // Stocker view_url pour le viewer
        if (data.view_url) {
          var btn2 = containerEl.querySelector('#diaryCanvaViewBtn');
          if (btn2) btn2.dataset.viewUrl = data.view_url;
        }
      })
      .catch(function() {}); // Edge Function indisponible → carte de base reste
  }

  // Viewer Canva in-app : overlay plein écran avec iframe no-referrer
  // En PWA installée, le referrer est null → souvent accepté par Canva
  function _openCanvaViewer(url, viewUrlOverride) {
    // Utiliser le lien /view?embed officiel Canva (Partager → Intégrer)
    // Ce lien est autorisé en iframe par Canva contrairement au lien de partage normal
    var viewUrl = viewUrlOverride || _sanitizeCanvaUrl(url) || url;

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#000;' +
      'display:flex;flex-direction:column;';

    // Barre top
    var bar = document.createElement('div');
    bar.style.cssText =
      'flex-shrink:0;height:calc(var(--safe-top,0px) + 48px);' +
      'background:rgba(15,15,15,0.96);display:flex;align-items:flex-end;' +
      'justify-content:space-between;padding:0 16px 10px;box-sizing:border-box;' +
      'border-bottom:1px solid rgba(255,255,255,0.08);';
    bar.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span style="font-size:18px;">📐</span>' +
        '<span style="color:#fff;font-size:14px;font-weight:600;font-family:DM Sans,sans-serif;">Canva</span>' +
      '</div>' +
      '<button id="canvaViewerClose" style="background:rgba(255,255,255,0.12);border:none;' +
        'color:#fff;font-size:13px;font-weight:700;padding:7px 16px;border-radius:16px;' +
        'cursor:pointer;font-family:DM Sans,sans-serif;">✕ Fermer</button>';
    overlay.appendChild(bar);

    // iframe avec le lien d'intégration officiel Canva — PAS de sandbox
    var iframe = document.createElement('iframe');
    iframe.src = viewUrl;
    iframe.style.cssText = 'flex:1;width:100%;border:none;background:#fff;';
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allow', 'fullscreen');
    // Pas de referrerpolicy restrictif — le lien /view?embed est autorisé par Canva
    overlay.appendChild(iframe);

    document.body.appendChild(overlay);
    haptic('light');

    bar.querySelector('#canvaViewerClose').addEventListener('click', function() {
      document.body.removeChild(overlay);
    });
    // Fermer aussi avec le bouton retour matériel (Android)
    var _onPop = function() {
      if (document.body.contains(overlay)) document.body.removeChild(overlay);
      window.removeEventListener('popstate', _onPop);
    };
    history.pushState({ canvaViewer: true }, '');
    window.addEventListener('popstate', _onPop);
  }

  // Valider un lien Canva (accepte /view, /edit, canva.link)
  function _validateCanvaUrl(url) {
    if (!url) return false;
    try {
      var u = new URL(url);
      if ((u.hostname === 'www.canva.com' || u.hostname === 'canva.com') &&
          u.pathname.includes('/design/')) return true;
      if (u.hostname === 'canva.link') return true;
      return false;
    } catch(e) { return false; }
  }

  // Détecter si le lien est un lien d'édition (non embedable directement)
  function _isCanvaEditUrl(url) {
    if (!url) return false;
    try {
      var u = new URL(url);
      return u.pathname.includes('/edit') || u.searchParams.has('utm_medium');
    } catch(e) { return false; }
  }

  // Convertir n'importe quel lien Canva en URL embedable /view?embed
  function _sanitizeCanvaUrl(url) {
    if (!url) return '';
    try {
      var u = new URL(url);

      // canva.link : ajouter ?embed tel quel
      if (u.hostname === 'canva.link') {
        u.searchParams.set('embed', '');
        return u.toString();
      }

      // Deux formats possibles dans pathname :
      // 1. /design/{ID}/view                    → lien de partage simple
      // 2. /design/{ID}/{TOKEN}/view             → lien d'intégration intelligent
      // Dans les deux cas : garder le pathname jusqu'à /view, ajouter ?embed

      var path = u.pathname;

      // S'assurer que le pathname se termine par /view (pas /edit, /watch, etc.)
      // Remplacer /edit, /watch par /view
      path = path.replace(/\/(edit|watch)(\/.*)?$/, '/view');

      // Si le pathname ne contient pas /view, l'ajouter avant les paramètres
      if (!path.endsWith('/view')) {
        // Couper après le dernier segment connu (/design/ID ou /design/ID/TOKEN)
        path = path.replace(/\/$/, '') + '/view';
      }

      // Reconstruire proprement : domaine + pathname + ?embed uniquement
      // Supprimer tous les paramètres utm_* et de tracking
      return 'https://www.canva.com' + path + '?embed';
    } catch(e) { return ''; }
  }

  // Extraire l'ID design Canva (fonctionne sur lien complet uniquement)
  function _extractCanvaDesignId(url) {
    try {
      var match = url.match(/canva\.com\/design\/([A-Za-z0-9_-]+)/);
      return match ? match[1] : null;
    } catch(e) { return null; }
  }

  // ─── 15. UI HELPERS ───────────────────────────────────────────────
  function _headerHTML(title, loading) {
    return '<div style="flex-shrink:0;background:var(--bg);border-bottom:1px solid var(--border);' +
      'padding:calc(var(--safe-top,0px) + 10px) 16px 12px;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<button id="diaryHeaderBack" style="width:34px;height:34px;border-radius:50%;background:var(--s2);' +
          'border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;">' +
          '<svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="var(--text)" stroke-width="2" stroke-linecap="round"><polyline points="7 1 1 7 7 13"/></svg>' +
        '</button>' +
        '<div style="flex:1;font-size:17px;font-weight:700;color:var(--text);">' + escHtml(title) + '</div>' +
      '</div></div>';
  }

  function _bindHeaderBack() {
    var btn = document.getElementById('diaryHeaderBack');
    if (btn) btn.addEventListener('click', window.diaryClose);
  }

  // Fix1 — Header avec toggle thème (page liste uniquement)
  function _headerHTMLWithTheme(title) {
    // Fix1: SVG moon/sun identiques à app-core.js
    // En thème CLAIR (body.light) : lune cachée (display:none), soleil visible
    // En thème SOMBRE (pas body.light) : lune visible, soleil caché (display:none)
    // C'est la logique de app-core.js : applyThemeToggle cache moon en goWarm (light)
    var isLight = document.body.classList.contains('light');
    var moonHide = isLight  ? ' style="display:none"' : '';
    var sunHide  = !isLight ? ' style="display:none"' : '';
    var MOON_SVG = '<svg class="gvh-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + moonHide + '>' +
      '<path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>';
    var SUN_SVG  = '<svg class="gvh-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + sunHide + '>' +
      '<circle cx="12" cy="12" r="5"/>' +
      '<line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>' +
      '<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>' +
      '<line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>' +
      '<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>' +
      '</svg>';
    return '<div style="flex-shrink:0;background:var(--bg);border-bottom:1px solid var(--border);' +
      'padding:calc(var(--safe-top,0px) + 10px) 16px 12px;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<button id="diaryHeaderBack" style="width:34px;height:34px;border-radius:50%;background:var(--s2);' +
          'border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;">' +
          '<svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="var(--text)" stroke-width="2" stroke-linecap="round"><polyline points="7 1 1 7 7 13"/></svg>' +
        '</button>' +
        '<div style="flex:1;font-size:17px;font-weight:700;color:var(--text);">' + escHtml(title) + '</div>' +
        '<button id="diaryThemeToggle" title="Th\u00e8me" class="dm-topbar-theme" ' +
          'style="width:34px;height:34px;border-radius:50%;background:var(--s2);' +
          'border:1px solid var(--border);display:flex;align-items:center;justify-content:center;' +
          'cursor:pointer;color:var(--text);">' +
          MOON_SVG + SUN_SVG +
        '</button>' +
      '</div></div>';
  }

  // Injecter CSS éditeur (placeholder + rich content styles)
  function _injectEditorCSS() {
    if (document.getElementById('diary-editor-css')) return;
    var style = document.createElement('style');
    style.id = 'diary-editor-css';
    style.textContent = [
      /* Placeholder */
      '#diaryEditor[data-placeholder]:empty:before {',
      '  content: attr(data-placeholder);',
      '  color: var(--muted);',
      '  pointer-events: none;',
      '  font-style: italic;',
      '}',
      /* FIX 2 — Soulignement couleur = couleur du texte */
      '#diaryEditor u, #diaryEditor [style*="underline"] {',
      '  text-decoration-color: currentColor !important;',
      '}',
      '#diaryEditor span[style*="color"] { display:inline !important; }',
      /* Lecture rich content */
      '.diary-rich-content h2 { font-size:18px;font-weight:700;color:var(--text);margin:14px 0 6px;line-height:1.3; }',
      '.diary-rich-content h3 { font-size:15px;font-weight:700;color:var(--text);margin:10px 0 4px; }',
      '.diary-rich-content p  { margin:6px 0;line-height:1.8;color:var(--text); }',
      '.diary-rich-content hr { border:none;border-top:1.5px solid var(--border);margin:14px 0; }',
      '.diary-rich-content img { max-width:100%;border-radius:10px;margin:8px 0;display:block; }',
      '.diary-rich-content a  { color:var(--accent);text-decoration:underline; }',
      /* Listes : puce même couleur que le texte, alignement parfait */
      /* Disc natif */
      '#diaryEditor ul, .diary-rich-content ul { list-style:disc;padding-left:1.4em;margin:6px 0; }',
      '#diaryEditor li, .diary-rich-content li { margin:2px 0;line-height:1.75;color:inherit;padding-left:0.2em; }',
      /* ::marker hérite de color du li (fixé inline par _fixListColors) */
      '#diaryEditor ul li::marker, .diary-rich-content ul li::marker { color:inherit;font-size:1em; }',
      /* Tirets — padding-left sur li + ::before absolute — robuste au splitText, pas de flex */
      '#diaryEditor ul.diary-list-dash, .diary-rich-content ul.diary-list-dash {',
      '  list-style:none !important;padding-left:0 !important;margin:6px 0;',
      '}',
      '#diaryEditor ul.diary-list-dash li, .diary-rich-content ul.diary-list-dash li {',
      '  display:block !important;position:relative !important;padding-left:1.2em !important;',
      '}',
      '#diaryEditor ul.diary-list-dash li::before, .diary-rich-content ul.diary-list-dash li::before {',
      '  content:"–" !important;position:absolute !important;left:0 !important;top:0;color:inherit;font-weight:700;font-size:1em;line-height:1.75;',
      '}',
      /* Carrés */
      '#diaryEditor ul.diary-list-square, .diary-rich-content ul.diary-list-square {',
      '  list-style:none !important;padding-left:0 !important;margin:6px 0;',
      '}',
      '#diaryEditor ul.diary-list-square li, .diary-rich-content ul.diary-list-square li {',
      '  display:block !important;position:relative !important;padding-left:1.2em !important;',
      '}',
      '#diaryEditor ul.diary-list-square li::before, .diary-rich-content ul.diary-list-square li::before {',
      '  content:"▪" !important;position:absolute !important;left:0 !important;top:0;color:inherit;font-size:0.85em;line-height:1.9;',
      '}',
      '@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }',
      '@keyframes diaryBadgePulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── 16. NETTOYAGE ────────────────────────────────────────────────
  window._diaryStopPolls = function() {
    _stopPoll();
    _stopCommentRT();
    if (_rtChannel && window._yamRT) {
      try { window._yamRT.removeChannel(_rtChannel); } catch(e) {}
      _rtChannel = null;
    }
    if (window._yamRTChannels) delete window._yamRTChannels['diary_pages'];
  };

  // Brancher dans yamClearAllPolls
  var _origClear = window.yamClearAllPolls;
  window.yamClearAllPolls = function() {
    if (_origClear) _origClear();
    window._diaryStopPolls();
  };

  // ─── 17. BOOT ─────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    _init();
  });

  yamLog('[Diary] app-diary.js chargé');

})();
