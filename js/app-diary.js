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
  var DIARY_TBL    = 'diary_pages';
  var COMMENT_TBL  = 'diary_comments';
  var STORAGE_BASE = SB_URL + '/storage/v1/object/images/';
  var POLL_MS      = 6000;   // fallback poll
  var MAX_IMG_BYTES = 1200 * 1024; // 1.2 Mo

  // Palettes de couvertures
  var COVER_PALETTES = [
    { bg: '#fce4eb', emoji: '🌸', label: 'Rose poudré' },
    { bg: '#e8f4f8', emoji: '💙', label: 'Ciel' },
    { bg: '#f0fce4', emoji: '🌿', label: 'Sage' },
    { bg: '#fef9e4', emoji: '✨', label: 'Or doux' },
    { bg: '#f3e8fd', emoji: '💜', label: 'Lavande' },
    { bg: '#ffe8d6', emoji: '🍑', label: 'Pêche' },
    { bg: '#e8fdf5', emoji: '🌊', label: 'Menthe' },
    { bg: '#fde8e8', emoji: '❤️',  label: 'Corail' },
    { bg: '#2d2d2d', emoji: '🖤',  label: 'Nuit' },
    { bg: '#1a2a3a', emoji: '🌙', label: 'Minuit' },
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

  // ─── 2. INIT ──────────────────────────────────────────────────────
  function _init() {
    if (_inited) return;
    _inited = true;
    _view = document.getElementById('diaryView');
    if (!_view) { console.error('[Diary] #diaryView introuvable'); return; }

    document.addEventListener('yam:session_ready', function () {
      setTimeout(_initRT, 1200);
    });
    document.addEventListener('yam:rt_ready', function () {
      setTimeout(_initRT, 600);
    });
    if (yamGetUser()) setTimeout(_initRT, 2000);

    yamLog('[Diary] Module initialisé');
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
        } else if (payload.eventType === 'UPDATE') {
          _pages = _pages.map(function(p){ return p.id === payload.new.id ? payload.new : p; });
          // Si on est en train de lire/co-écrire cette page, mettre à jour live
          if (_currentPage && _currentPage.id === payload.new.id && _mode === 'read') {
            _currentPage = payload.new;
            _renderReadPage(_currentPage);
          }
        } else if (payload.eventType === 'DELETE') {
          _pages = _pages.filter(function(p){ return p.id !== payload.old.id; });
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
    var homeTab = document.getElementById('yamHomeTab');
    if (!_view || !homeTab) return;

    document.body.classList.remove('subview-active');
    _yamSlide(homeTab, _view, 'backward');
    homeTab.classList.add('active');

    setTimeout(function () {
      _view.classList.remove('active');
      _view.style.display = '';
    }, 360);

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
          '<div style="font-size:28px;animation:spin 1s linear infinite;">📖</div>' +
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

    var html = '<div style="display:flex;flex-direction:column;height:100%;background:var(--bg);overflow:hidden;">';

    // Header
    html += _headerHTML('My Diary 📖', false);

    // Tabs
    html += '<div style="display:flex;gap:0;flex-shrink:0;padding:0 16px 0;margin-top:4px;">' +
      _tabBtn('mine',    '✍️ Mon journal', _tab === 'mine',    myPages.length) +
      _tabBtn('partner', '💌 ' + escHtml(yamGetDisplayName(partnerRole)), _tab === 'partner', partnerPages.length) +
    '</div>';

    html += '<div id="diaryListScroll" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 16px 80px;">';

    var list = _tab === 'mine' ? myPages : partnerPages;

    if (list.length === 0) {
      html += _emptyState(_tab === 'mine');
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:12px;">';
      list.forEach(function(page) {
        html += _pageCard(page, me);
      });
      html += '</div>';
    }

    html += '</div></div>';

    // FAB bouton nouvelle page (seulement dans "Mon journal")
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

    _view.innerHTML = html;
    _bindHeaderBack();
    _bindListEvents();
  }

  function _tabBtn(id, label, active, count) {
    return '<button data-diary-tab="' + id + '" style="flex:1;padding:8px 4px;' +
      'font-size:12px;font-weight:' + (active ? '700' : '500') + ';' +
      'color:' + (active ? 'var(--accent)' : 'var(--muted)') + ';' +
      'background:none;border:none;border-bottom:2px solid ' + (active ? 'var(--accent)' : 'transparent') + ';' +
      'cursor:pointer;font-family:DM Sans,sans-serif;transition:all 0.18s;' +
      'display:flex;align-items:center;justify-content:center;gap:4px;">' +
      escHtml(label) +
      (count > 0 ? '<span style="background:' + (active ? 'var(--accent)' : 'var(--muted)') + ';color:#fff;' +
        'border-radius:9px;padding:0 5px;font-size:9px;line-height:16px;">' + count + '</span>' : '') +
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

    return '<div data-diary-open="' + escHtml(page.id) + '" style="' +
      'display:flex;gap:12px;align-items:stretch;' +
      'background:var(--s1);border:1px solid var(--border);border-radius:18px;' +
      'overflow:hidden;cursor:pointer;box-shadow:var(--sh-sm);' +
      'transition:transform 0.15s,box-shadow 0.15s;">' +

      // Couverture miniature
      '<div style="width:72px;flex-shrink:0;background:' + escHtml(coverBg) + ';' +
        'display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;' +
        'position:relative;">' +
        '<span style="font-size:28px;">' + escHtml(coverEmoji) + '</span>' +
        (page.mood ? '<span style="font-size:14px;">' + escHtml(page.mood) + '</span>' : '') +
        (isCanva ? '<div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.45);' +
          'border-radius:4px;padding:1px 4px;font-size:8px;color:#fff;font-weight:700;">CANVA</div>' : '') +
      '</div>' +

      // Infos
      '<div style="flex:1;min-width:0;padding:12px 10px 12px 0;display:flex;flex-direction:column;gap:4px;">' +
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
        (page.content && !isCanva ? '<div style="font-size:12px;color:var(--sub);line-height:1.4;' +
          'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' +
          _stripHTML(page.content).substring(0, 120) + '</div>' : '') +
        (isCanva ? '<div style="font-size:11px;color:var(--muted);">📐 Présentation Canva</div>' : '') +
      '</div>' +

      // Flèche
      '<div style="flex-shrink:0;display:flex;align-items:center;padding-right:12px;">' +
        '<svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round"><polyline points="1 1 6 6 1 11"/></svg>' +
      '</div>' +
    '</div>';
  }

  function _bindListEvents() {
    // Tab switch
    _view.querySelectorAll('[data-diary-tab]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _tab = this.getAttribute('data-diary-tab');
        _renderList();
      });
    });

    // Ouvrir une page
    _view.querySelectorAll('[data-diary-open]').forEach(function(card) {
      card.addEventListener('click', function() {
        var id = this.getAttribute('data-diary-open');
        var page = _pages.find(function(p){ return p.id === id; });
        if (page) _openReadPage(page);
      });
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

    // Header lecture
    html += '<div style="flex-shrink:0;background:var(--bg);border-bottom:1px solid var(--border);' +
      'padding:calc(var(--safe-top,0px) + 10px) 16px 10px;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<button id="diaryReadBack" style="width:34px;height:34px;border-radius:50%;background:var(--s2);' +
          'border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;">' +
          '<svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="var(--text)" stroke-width="2" stroke-linecap="round"><polyline points="7 1 1 7 7 13"/></svg>' +
        '</button>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:15px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(page.title || 'Sans titre') + '</div>' +
          '<div style="font-size:10px;color:var(--muted);">' +
            new Date(page.created_at).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'}) +
            (page.mood ? ' · ' + escHtml(page.mood) : '') +
          '</div>' +
        '</div>' +
        (canEdit ? '<button id="diaryReadEdit" style="padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;' +
          'border:1px solid var(--accent);background:var(--accent-s);color:var(--accent);cursor:pointer;' +
          'font-family:DM Sans,sans-serif;flex-shrink:0;">✏️ Modifier</button>' : '') +
      '</div></div>';

    // Corps — Canva ou texte riche
    html += '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;">';

    if (isCanva && page.canva_url) {
      // Embed Canva live
      html += '<div style="width:100%;height:60vw;min-height:280px;background:var(--s2);">' +
        '<iframe id="diaryCanvaFrame" ' +
          'src="' + escHtml(_sanitizeCanvaUrl(page.canva_url)) + '" ' +
          'style="width:100%;height:100%;border:none;" ' +
          'allow="fullscreen" loading="lazy" ' +
          'sandbox="allow-scripts allow-same-origin allow-popups allow-forms">' +
        '</iframe></div>' +
        '<div style="padding:16px 18px 8px;">' +
          (page.content ? '<div class="diary-rich-content">' + _sanitizeHTML(page.content) + '</div>' : '') +
        '</div>';
    } else {
      // Couverture déco
      html += '<div style="background:' + escHtml(coverBg) + ';' +
        'min-height:120px;display:flex;align-items:center;justify-content:center;font-size:52px;' +
        'position:relative;overflow:hidden;">' +
        '<span style="filter:drop-shadow(0 2px 8px rgba(0,0,0,0.15));">' + escHtml(page.cover_emoji || '📖') + '</span>' +
        // Image de fond si définie
        (page.bg_image_url ? '<img src="' + escHtml(page.bg_image_url) + '" alt="" ' +
          'style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.35;">' : '') +
      '</div>' +
      '<div style="padding:18px 18px 4px;">' +
        '<div class="diary-rich-content" style="font-size:15px;line-height:1.8;color:var(--text);">' +
          (page.content ? _sanitizeHTML(page.content) : '<em style="color:var(--muted);">Page vide</em>') +
        '</div>' +
      '</div>';
    }

    // Images galerie
    var imgs = [];
    try { imgs = JSON.parse(page.images || '[]'); } catch(e) {}
    if (imgs.length > 0) {
      html += '<div style="padding:12px 18px;display:flex;flex-wrap:wrap;gap:8px;">';
      imgs.forEach(function(img) {
        html += '<img src="' + escHtml(img.url) + '" alt="" data-diary-img-full="' + escHtml(img.url) + '" ' +
          'style="width:calc(50% - 4px);border-radius:12px;object-fit:cover;height:120px;cursor:pointer;' +
          'box-shadow:var(--sh-sm);" loading="lazy">';
      });
      html += '</div>';
    }

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

    // Events lecture
    var backBtn = document.getElementById('diaryReadBack');
    if (backBtn) backBtn.addEventListener('click', function() {
      _mode = 'list';
      _currentPage = null;
      _stopCommentRT();
      _renderList();
    });

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
      return '<div style="display:flex;flex-direction:column;align-items:' + (isMe ? 'flex-end' : 'flex-start') + ';gap:2px;">' +
        '<div style="font-size:9px;color:var(--muted);">' +
          escHtml(yamGetDisplayName(c.author_role)) + ' · ' + date +
        '</div>' +
        '<div style="max-width:85%;padding:8px 12px;border-radius:' + (isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px') + ';' +
          'background:' + (isMe ? 'var(--accent)' : 'var(--s2)') + ';' +
          'color:' + (isMe ? '#fff' : 'var(--text)') + ';' +
          'font-size:13px;line-height:1.4;">' +
          escHtml(c.content) +
        '</div>' +
      '</div>';
    }).join('');
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

    // Header éditeur
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
    COVER_PALETTES.forEach(function(p, i) {
      var selected = page ? page.cover_color === p.bg : (i === 0);
      html += '<button data-cover-bg="' + escHtml(p.bg) + '" data-cover-emoji="' + escHtml(p.emoji) + '" ' +
        'style="width:30px;height:30px;border-radius:50%;' +
        'background:' + escHtml(p.bg) + ';' +
        'border:' + (selected ? '2.5px solid var(--accent)' : '2px solid transparent') + ';' +
        'cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;' +
        'box-shadow:' + (selected ? '0 0 0 2px var(--accent-s)' : 'var(--sh-sm)') + ';" ' +
        'title="' + escHtml(p.label) + '">' +
        escHtml(p.emoji) +
      '</button>';
    });
    html += '</div></div>';

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

    // Toolbar formatage
    html += '<div id="diaryToolbar" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;' +
      'padding:8px 10px;background:var(--s2);border-radius:12px;border:1px solid var(--border);">' +

      // Titre H2
      _toolBtn('diaryFmtH2',    '<b>T</b>',   'Titre',      'font-size:16px;') +
      // Gras
      _toolBtn('diaryFmtBold',  '<b>B</b>',   'Gras',       'font-weight:800;') +
      // Italique
      _toolBtn('diaryFmtItalic','<i>I</i>',   'Italique',   'font-style:italic;') +
      // Souligné
      _toolBtn('diaryFmtUnder', '<u>S</u>',   'Souligné',   '') +
      // Couleur texte
      _toolBtn('diaryFmtColor', '🎨',          'Couleur',    '') +
      // Alignement centre
      _toolBtn('diaryFmtCenter','⬛',           'Centrer',   '') +
      // Liste
      _toolBtn('diaryFmtList',  '☰',           'Liste',      '') +
      // Trait séparateur
      _toolBtn('diaryFmtHR',    '—',           'Séparateur', '') +
      // Image insérée
      _toolBtn('diaryFmtImg',   '🖼️',          'Image',      '') +
      // Emoji picker
      _toolBtn('diaryFmtEmoji', '😊',          'Emoji',      '') +
    '</div>';

    // Couleur picker (hidden)
    html += '<div id="diaryColorPicker" style="display:none;flex-wrap:wrap;gap:6px;' +
      'padding:8px;background:var(--s1);border-radius:10px;border:1px solid var(--border);margin-bottom:8px;">' +
      ['#e75a7c','#f06688','#5ac8fa','#7c6af7','#34c759','#ff9500','#ff3b30','#636366',
       '#000000','#ffffff','#ffd700','#a2845e'].map(function(c) {
        return '<button data-diary-color="' + c + '" style="width:26px;height:26px;border-radius:50%;' +
          'background:' + c + ';border:2px solid var(--border);cursor:pointer;"></button>';
      }).join('') +
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

    // Éditeur contenteditable
    html += '<div id="diaryEditor" contenteditable="true" spellcheck="true" ' +
      'style="min-height:200px;padding:14px 16px;border-radius:14px;' +
      'border:1.5px solid var(--border);background:var(--s1);' +
      'font-size:15px;line-height:1.8;color:var(--text);' +
      'font-family:Georgia,serif;outline:none;word-wrap:break-word;' +
      '-webkit-user-modify:read-write-plaintext-only;" ' +
      'data-placeholder="Écris ta page ici… Laisse libre cours à tes pensées ✨">';

    if (page && page.content) {
      html += _sanitizeHTML(page.content);
    }
    html += '</div>';

    // Image de fond
    html += '<div style="margin-top:12px;display:flex;gap:8px;align-items:center;">' +
      '<button id="diaryBgImgBtn" style="padding:7px 14px;border-radius:20px;font-size:11px;font-weight:700;' +
        'border:1px solid var(--border);background:var(--s2);color:var(--sub);cursor:pointer;' +
        'font-family:DM Sans,sans-serif;">🖼️ Image de fond</button>' +
      (page && page.bg_image_url ?
        '<img src="' + escHtml(page.bg_image_url) + '" style="width:36px;height:36px;border-radius:8px;object-fit:cover;">' +
        '<button id="diaryBgImgDel" style="font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;">✕</button>'
        : '') +
    '</div>';

    // Galerie images insérées
    html += '<div id="diaryImgsGrid" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;"></div>';

    html += '</div>'; // fin diaryTextSection

    // ── Zone Canva ──
    html += '<div id="diaryCanvaSection" style="display:' + (isCanva ? 'block' : 'none') + ';">';
    html += '<div style="margin-bottom:10px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:6px;line-height:1.5;">' +
        '📐 <strong>Colle le lien "Présentation" Canva</strong> (mode Vue publique).<br>' +
        'Les modifications sur Canva se mettront à jour automatiquement ici.' +
      '</div>' +
      '<div style="display:flex;gap:8px;">' +
        '<input id="diaryCanvaInput" type="url" placeholder="https://www.canva.com/design/…/view" ' +
          'style="flex:1;padding:10px 14px;border-radius:12px;border:1.5px solid var(--border);' +
          'background:var(--s1);color:var(--text);font-size:13px;font-family:DM Sans,sans-serif;outline:none;" ' +
          'value="' + escHtml(page ? (page.canva_url || '') : '') + '">' +
        '<button id="diaryCanvaValidate" style="padding:10px 14px;border-radius:12px;' +
          'background:var(--accent-s);border:1px solid var(--accent);color:var(--accent);' +
          'font-size:12px;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;white-space:nowrap;">Valider</button>' +
      '</div>' +
      '<div id="diaryCanvaFeedback" style="font-size:11px;margin-top:4px;color:var(--muted);"></div>' +
    '</div>';

    // Aperçu Canva
    if (isCanva && page.canva_url) {
      html += '<div style="border-radius:14px;overflow:hidden;border:1px solid var(--border);">' +
        '<iframe src="' + escHtml(_sanitizeCanvaUrl(page.canva_url)) + '" ' +
          'style="width:100%;height:300px;border:none;" loading="lazy" ' +
          'sandbox="allow-scripts allow-same-origin allow-popups allow-forms">' +
        '</iframe></div>';
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
        _view.querySelectorAll('[data-cover-bg]').forEach(function(b) {
          b.style.border = '2px solid transparent';
          b.style.boxShadow = 'var(--sh-sm)';
        });
        this.style.border = '2.5px solid var(--accent)';
        this.style.boxShadow = '0 0 0 2px var(--accent-s)';
      });
    });

    // Humeurs
    _view.querySelectorAll('[data-mood]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _view.querySelectorAll('[data-mood]').forEach(function(b) {
          b.style.border = '1.5px solid var(--border)';
          b.style.background = 'var(--s2)';
        });
        this.style.border = '2px solid var(--accent)';
        this.style.background = 'var(--accent-s)';
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

    document.getElementById('diaryFmtH2')    && document.getElementById('diaryFmtH2').addEventListener('click', function() {
      _execFmt('formatBlock', '<h2>');
    });
    document.getElementById('diaryFmtBold')  && document.getElementById('diaryFmtBold').addEventListener('click', function() {
      _execFmt('bold');
    });
    document.getElementById('diaryFmtItalic')&& document.getElementById('diaryFmtItalic').addEventListener('click', function() {
      _execFmt('italic');
    });
    document.getElementById('diaryFmtUnder') && document.getElementById('diaryFmtUnder').addEventListener('click', function() {
      _execFmt('underline');
    });
    document.getElementById('diaryFmtCenter')&& document.getElementById('diaryFmtCenter').addEventListener('click', function() {
      _execFmt('justifyCenter');
    });
    document.getElementById('diaryFmtList') && document.getElementById('diaryFmtList').addEventListener('click', function() {
      _execFmt('insertUnorderedList');
    });
    document.getElementById('diaryFmtHR') && document.getElementById('diaryFmtHR').addEventListener('click', function() {
      if (editor) { editor.focus(); document.execCommand('insertHTML', false, '<hr style="border:none;border-top:1.5px solid var(--border);margin:12px 0;">'); }
    });

    // Couleur picker toggle
    var colorPicker = document.getElementById('diaryColorPicker');
    document.getElementById('diaryFmtColor') && document.getElementById('diaryFmtColor').addEventListener('click', function() {
      if (colorPicker) colorPicker.style.display = colorPicker.style.display === 'none' ? 'flex' : 'none';
      var emojiPicker = document.getElementById('diaryEmojiPicker');
      if (emojiPicker) emojiPicker.style.display = 'none';
    });
    if (colorPicker) colorPicker.querySelectorAll('[data-diary-color]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        _execFmt('foreColor', this.getAttribute('data-diary-color'));
        colorPicker.style.display = 'none';
        if (editor) editor.focus();
      });
    });

    // Emoji picker toggle
    var emojiPicker = document.getElementById('diaryEmojiPicker');
    document.getElementById('diaryFmtEmoji') && document.getElementById('diaryFmtEmoji').addEventListener('click', function() {
      if (emojiPicker) emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'flex' : 'none';
      if (colorPicker) colorPicker.style.display = 'none';
    });
    if (emojiPicker) emojiPicker.querySelectorAll('[data-diary-emoji]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (editor) { editor.focus(); document.execCommand('insertHTML', false, this.getAttribute('data-diary-emoji')); }
        emojiPicker.style.display = 'none';
      });
    });

    // Insertion image dans le texte
    document.getElementById('diaryFmtImg') && document.getElementById('diaryFmtImg').addEventListener('click', function() {
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
          if (fb) { fb.textContent = '❌ Lien invalide. Exemple: https://www.canva.com/design/…/view'; fb.style.color = '#ff3b30'; }
          return;
        }
        _canvaValid = true;
        if (fb) { fb.textContent = '✅ Lien Canva valide !'; fb.style.color = 'var(--accent)'; }
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

  function _execFmt(cmd, val) {
    var editor = document.getElementById('diaryEditor');
    if (editor) editor.focus();
    document.execCommand(cmd, false, val || null);
  }

  function _renderEditorImages() {
    var grid = document.getElementById('diaryImgsGrid');
    if (!grid) return;
    if (_editorImages.length === 0) { grid.innerHTML = ''; return; }
    grid.innerHTML = _editorImages.map(function(img, i) {
      return '<div style="position:relative;width:calc(50% - 4px);">' +
        '<img src="' + escHtml(img.url) + '" style="width:100%;height:100px;border-radius:10px;object-fit:cover;">' +
        '<button data-diary-del-img="' + i + '" style="position:absolute;top:4px;right:4px;' +
          'width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.55);border:none;cursor:pointer;' +
          'color:#fff;font-size:11px;display:flex;align-items:center;justify-content:center;">✕</button>' +
      '</div>';
    }).join('');

    grid.querySelectorAll('[data-diary-del-img]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.getAttribute('data-diary-del-img'), 10);
        _editorImages.splice(idx, 1);
        _renderEditorImages();
      });
    });
  }

  // ─── 10. UPLOAD IMAGES ────────────────────────────────────────────
  function _compressImage(file, maxW, maxBytes, cb) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var scale  = Math.min(1, maxW / img.width);
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        function tryQuality(q) {
          canvas.toBlob(function(blob) {
            if (!blob) { cb(null); return; }
            if (blob.size <= maxBytes || q <= 0.35) { cb(blob); }
            else { tryQuality(Math.round((q - 0.15) * 100) / 100); }
          }, 'image/jpeg', q);
        }
        tryQuality(0.82);
      };
      img.onerror = function() { cb(null); };
      img.src = e.target.result;
    };
    reader.onerror = function() { cb(null); };
    reader.readAsDataURL(file);
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

    _compressImage(file, 1200, MAX_IMG_BYTES, function(blob) {
      if (!blob) { showToast('Erreur compression', 'error'); return; }
      var path = 'diary/' + u.couple_id + '/' + Date.now() + '.jpg';
      _uploadToStorage(blob, path, function(url) {
        if (!url) { showToast('Erreur upload', 'error'); return; }
        _editorImages.push({ url: url, slot: Date.now() });
        _renderEditorImages();
        // Insérer dans l'éditeur aussi
        var editor = document.getElementById('diaryEditor');
        if (editor) {
          editor.focus();
          document.execCommand('insertHTML', false,
            '<img src="' + escHtml(url) + '" style="max-width:100%;border-radius:10px;margin:6px 0;" alt="">');
        }
        showToast('Image ajoutée ✨', 'success');
        haptic('success');
      });
    });
  }

  function _handleBgImageUpload(file) {
    if (!file.type.startsWith('image/')) { showToast('Format non supporté', 'error'); return; }
    var u = yamGetUser();
    if (!u) return;
    showToast('Upload…', '', 1500);

    _compressImage(file, 1400, MAX_IMG_BYTES, function(blob) {
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
        content = _sanitizeHTML(editorEl.innerHTML);
      }
    }

    if (!title && !content && !canvaUrl) {
      showToast('La page est vide', 'error'); return;
    }

    // Couverture sélectionnée
    var selectedCover = _view.querySelector('[data-cover-bg][style*="var(--accent)"]');
    var coverBg    = selectedCover ? selectedCover.getAttribute('data-cover-bg')    : (_currentPage ? _currentPage.cover_color : '#fce4eb');
    var coverEmoji = selectedCover ? selectedCover.getAttribute('data-cover-emoji') : (_currentPage ? _currentPage.cover_emoji : '📖');

    // Humeur sélectionnée
    var selectedMood = _view.querySelector('[data-mood][style*="var(--accent)"]');
    var mood = selectedMood ? selectedMood.getAttribute('data-mood') : (_currentPage ? _currentPage.mood : null);

    // Canva design ID
    var canvaDesignId = canvaUrl ? _extractCanvaDesignId(canvaUrl) : null;

    // Partage
    var shareToggle   = document.getElementById('diaryShareToggle');
    var cowriteToggle = document.getElementById('diaryCowriteToggle');
    var isShared      = shareToggle   ? shareToggle.getAttribute('data-on')   === '1' : false;
    var canCowrite    = cowriteToggle ? cowriteToggle.getAttribute('data-on') === '1' : false;

    var bgImageUrl = (_currentPage && _currentPage.bg_image_url) || null;

    var payload = {
      couple_id:       u.couple_id,
      author_role:     u.role,
      title:           title.substring(0, 100),
      content:         content.substring(0, 50000),
      mood:            mood || null,
      cover_color:     coverBg,
      cover_emoji:     coverEmoji,
      canva_url:       canvaUrl,
      canva_design_id: canvaDesignId,
      images:          JSON.stringify(_editorImages),
      is_shared:       isShared,
      partner_can_edit: isShared && canCowrite,
      bg_image_url:    bgImageUrl,
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
          var src = attr.value;
          if (!src.startsWith('http') && !src.startsWith('data:image') && !src.startsWith('blob:')) {
            el.removeAttribute('src');
          }
        }
      });
    });

    return tmp.innerHTML;
  }

  // Strip HTML pour aperçu texte brut
  function _stripHTML(html) {
    if (!html) return '';
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  // Valider URL Canva
  function _validateCanvaUrl(url) {
    if (!url) return false;
    try {
      var u = new URL(url);
      return u.hostname === 'www.canva.com' && u.pathname.includes('/design/');
    } catch(e) { return false; }
  }

  // Sanitize URL Canva pour iframe
  function _sanitizeCanvaUrl(url) {
    if (!_validateCanvaUrl(url)) return '';
    // Forcer le paramètre embed
    try {
      var u = new URL(url);
      if (!u.pathname.includes('/view')) {
        u.pathname = u.pathname.replace(/\/?$/, '/view');
      }
      u.searchParams.set('embed', '');
      return u.toString();
    } catch(e) { return ''; }
  }

  // Extraire l'ID design Canva
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

  // Injecter CSS éditeur (placeholder + rich content styles)
  function _injectEditorCSS() {
    if (document.getElementById('diary-editor-css')) return;
    var style = document.createElement('style');
    style.id = 'diary-editor-css';
    style.textContent = [
      '#diaryEditor[data-placeholder]:empty:before {',
      '  content: attr(data-placeholder);',
      '  color: var(--muted);',
      '  pointer-events: none;',
      '  font-style: italic;',
      '}',
      '.diary-rich-content h2 { font-size:18px;font-weight:700;color:var(--text);margin:14px 0 6px;line-height:1.3; }',
      '.diary-rich-content h3 { font-size:15px;font-weight:700;color:var(--text);margin:10px 0 4px; }',
      '.diary-rich-content p  { margin:6px 0;line-height:1.8;color:var(--text); }',
      '.diary-rich-content ul { padding-left:18px;margin:6px 0; }',
      '.diary-rich-content li { margin:3px 0;line-height:1.7;color:var(--text); }',
      '.diary-rich-content hr { border:none;border-top:1.5px solid var(--border);margin:14px 0; }',
      '.diary-rich-content img { max-width:100%;border-radius:10px;margin:8px 0;display:block; }',
      '.diary-rich-content a  { color:var(--accent);text-decoration:underline; }',
      '@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }',
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
