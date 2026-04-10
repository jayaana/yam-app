// ═══════════════════════════════════════════════════════════════════
// app-books.js — YAM v14 — Lire ensemble
// Lecture asynchrone + synchronisée via Gutenberg API (gutendex.com)
// Dépendances : app-core.js, app-multiplayer.js
// Globals utilisés : SB_URL, sb2Headers(), sb2Fetch(), sb2Post(),
//   sb2Patch(), sb2Delete(), sb2Upsert(), yamGetUser(), getProfile(),
//   yamGetDisplayName(), showToast(), haptic(), _yamSlide(),
//   YAMMultiplayer, yamFlameActivity(), escHtml(), window._yamRT,
//   window._yamRTChannels
// Ordre de chargement : après app-multiplayer.js, avant app-cowatch.js
// ═══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── 1. CONSTANTES & CONFIG ──────────────────────────────────────

  var GUTENDEX_API    = 'https://gutendex.com/books/';
  var GUTENBERG_BASE  = 'https://www.gutenberg.org';
  var BK_LIBRARY_TBL  = 'book_library';
  var BK_READS_TBL    = 'book_reads';
  var BK_SESSIONS_TBL = 'book_sessions';
  var BK_PRESENCE_TBL = 'book_presence';
  var BK_ANNOTS_TBL   = 'book_annotations';

  var SYNC_POLL_MS    = 3000;   // poll mode synchronisé
  var PRES_MS         = 5000;   // heartbeat présence lobby
  var CHARS_PER_PAGE  = 1800;   // ~1 page écran = ~1800 caractères

  // État global du module
  var _bkInited       = false;
  var _bkView         = null;   // l'élément DOM #bookView
  var _bkLibrary      = [];     // livres du couple (book_library)
  var _bkCurrentBook  = null;   // livre en cours de lecture
  var _bkReads        = {};     // { girl: row, boy: row } pour le livre courant
  var _bkSyncEngine   = null;   // instance YAMMultiplayer pour mode sync
  var _bkSyncActive   = false;
  var _bkIsHost       = false;
  var _bkPresTimer    = null;
  var _bkSyncPollTimer= null;
  var _bkRTReads      = null;   // channel RT pour progression asynchrone
  var _bkSearchCache  = {};     // cache recherche gutendex
  var _bkTab          = 'library'; // 'library' | 'search' | 'catalog'
  var _bkScrollPos    = 0;      // position scroll dans le reader
  var _bkSaving       = false;  // guard anti-double save progression


  // ─── 2. CATALOGUE CURÉ (~50 classiques FR) ───────────────────────

  var BK_CATALOG = [
    { gutenberg_id: 17489, title: 'Les Misérables',              author: 'Victor Hugo',           cover: '📚', genre: 'Roman' },
    { gutenberg_id: 14155, title: 'Notre-Dame de Paris',         author: 'Victor Hugo',           cover: '📚', genre: 'Roman' },
    { gutenberg_id: 5246,  title: 'Le Comte de Monte-Cristo',    author: 'Alexandre Dumas',       cover: '⚔️', genre: 'Aventure' },
    { gutenberg_id: 13704, title: "L'homme à l'oreille cassée",  author: 'Edmond About',          cover: '📖', genre: 'Roman' },
    { gutenberg_id: 600,   title: 'Madame Bovary',               author: 'Gustave Flaubert',      cover: '💔', genre: 'Roman' },
    { gutenberg_id: 4650,  title: 'Le Tour du monde en 80 jours',author: 'Jules Verne',           cover: '🌍', genre: 'Aventure' },
    { gutenberg_id: 800,   title: 'Le Rouge et le Noir',         author: 'Stendhal',              cover: '🖤', genre: 'Roman' },
    { gutenberg_id: 4461,  title: 'Vingt mille lieues sous les mers', author: 'Jules Verne',      cover: '🌊', genre: 'Aventure' },
    { gutenberg_id: 1257,  title: "De la Terre à la Lune",       author: 'Jules Verne',           cover: '🚀', genre: 'Aventure' },
    { gutenberg_id: 14836, title: 'Germinal',                    author: 'Émile Zola',            cover: '⚒️', genre: 'Roman' },
    { gutenberg_id: 1069,  title: "L'Assommoir",                 author: 'Émile Zola',            cover: '🍷', genre: 'Roman' },
    { gutenberg_id: 5711,  title: 'Nana',                        author: 'Émile Zola',            cover: '🌹', genre: 'Roman' },
    { gutenberg_id: 4364,  title: 'Bel-Ami',                     author: 'Guy de Maupassant',     cover: '🎩', genre: 'Roman' },
    { gutenberg_id: 3175,  title: 'Une vie',                     author: 'Guy de Maupassant',     cover: '🌾', genre: 'Roman' },
    { gutenberg_id: 2413,  title: 'Le Père Goriot',              author: 'Honoré de Balzac',      cover: '👴', genre: 'Roman' },
    { gutenberg_id: 1237,  title: 'Eugénie Grandet',             author: 'Honoré de Balzac',      cover: '💰', genre: 'Roman' },
    { gutenberg_id: 17989, title: 'Candide',                     author: 'Voltaire',              cover: '💡', genre: 'Philosophie' },
    { gutenberg_id: 2650,  title: 'Les Trois Mousquetaires',     author: 'Alexandre Dumas',       cover: '⚔️', genre: 'Aventure' },
    { gutenberg_id: 36,    title: "Les Fleurs du Mal",           author: 'Charles Baudelaire',    cover: '🌸', genre: 'Poésie' },
    { gutenberg_id: 3748,  title: "L'Étranger",                  author: 'Albert Camus',          cover: '☀️', genre: 'Roman' },
    { gutenberg_id: 4606,  title: 'Le Petit Prince',             author: 'Antoine de Saint-Exupéry', cover: '🌟', genre: 'Conte' },
    { gutenberg_id: 13951, title: 'Cyrano de Bergerac',          author: 'Edmond Rostand',        cover: '🎭', genre: 'Théâtre' },
    { gutenberg_id: 910,   title: "L'Île mystérieuse",           author: 'Jules Verne',           cover: '🏝️', genre: 'Aventure' },
    { gutenberg_id: 2413,  title: 'La Cousine Bette',            author: 'Honoré de Balzac',      cover: '👩', genre: 'Roman' },
    { gutenberg_id: 14155, title: 'Les Misérables — Tome II',    author: 'Victor Hugo',           cover: '📚', genre: 'Roman' },
    { gutenberg_id: 8700,  title: 'Poil de Carotte',             author: 'Jules Renard',          cover: '🥕', genre: 'Roman' },
    { gutenberg_id: 4651,  title: 'Michel Strogoff',             author: 'Jules Verne',           cover: '🐴', genre: 'Aventure' },
    { gutenberg_id: 5791,  title: 'Carmen',                      author: 'Prosper Mérimée',       cover: '💃', genre: 'Nouvelle' },
    { gutenberg_id: 14287, title: 'Le Horla',                    author: 'Guy de Maupassant',     cover: '👻', genre: 'Nouvelle' },
    { gutenberg_id: 1150,  title: 'Jacques le Fataliste',        author: 'Denis Diderot',         cover: '🤔', genre: 'Roman' },
  ];


  // ─── 3. INIT MODULE ──────────────────────────────────────────────

  function _bkInit() {
    if (_bkInited) return;
    _bkInited = true;
    _bkView = document.getElementById('bookView');
    if (!_bkView) { console.error('[Books] #bookView introuvable'); return; }

    // Écouter session_ready pour démarrer le RT après login
    document.addEventListener('yam:session_ready', function () {
      setTimeout(_bkInitRT, 1500);
    });
    document.addEventListener('yam:rt_ready', function () {
      setTimeout(_bkInitRT, 800);
    });

    // Initialiser RT si session déjà active au chargement
    if (yamGetUser()) setTimeout(_bkInitRT, 2500);

    yamLog('[Books] Module initialisé');
  }


  // ─── 4. REALTIME — progression asynchrone ────────────────────────

  function _bkInitRT() {
    var u = yamGetUser();
    if (!u || !u.couple_id || !window._yamRT) return;
    if (window._yamRTChannels['book_reads']) return;

    var ch = window._yamRT
      .channel('book_reads_' + u.couple_id)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: BK_READS_TBL,
        filter: 'couple_id=eq.' + u.couple_id,
      }, function (payload) {
        // Mettre à jour la progression du partenaire en temps réel
        if (_bkCurrentBook && payload.new && payload.new.book_id === _bkCurrentBook.id) {
          var role = payload.new.player_role;
          _bkReads[role] = payload.new;
          _bkRenderProgressBar();
        }
        // Rafraîchir aussi la lib si vue ouverte
        if (_bkView && _bkView.classList.contains('active')) {
          _bkRefreshLibraryCards();
        }
      })
      .subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          yamLog('[RT] ✅ book_reads connecté');
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          delete window._yamRTChannels['book_reads'];
          yamLog('[RT] book_reads perdu — fallback poll');
        }
      });
    window._yamRTChannels['book_reads'] = ch;
  }


  // ─── 5. OUVERTURE / FERMETURE DE LA VUE ──────────────────────────

  window.bkOpen = function () {
    _bkInit();
    var u = yamGetUser();
    if (!u) { showToast('Connecte-toi d\'abord 💕', 'error'); return; }

    var jeuxTab = document.getElementById('yamJeuxTab');
    _yamSlide(_bkView, jeuxTab, 'forward');
    haptic('light');
    _bkLoadLibrary();
  };

  window.bkClose = function () {
    _bkStopSyncSession();
    var jeuxTab = document.getElementById('yamJeuxTab');
    _yamSlide(jeuxTab, _bkView, 'backward');
    jeuxTab.classList.add('active');
    haptic('light');
  };

  // Fermer le reader et revenir à la bibliothèque
  function _bkCloseReader() {
    _bkStopSyncSession();
    _bkCurrentBook = null;
    _bkReads = {};
    var reader = document.getElementById('bkReader');
    var lib    = document.getElementById('bkLibContainer');
    if (reader) reader.style.display = 'none';
    if (lib)    lib.style.display    = '';
    _bkRenderLibrary();
  }


  // ─── 6. CHARGEMENT DE LA BIBLIOTHÈQUE COUPLE ─────────────────────

  function _bkLoadLibrary() {
    var u = yamGetUser();
    if (!u || !u.couple_id) return;
    _bkRenderSkeleton();

    sb2Fetch(BK_LIBRARY_TBL, 'couple_id=eq.' + u.couple_id + '&order=added_at.desc')
      .then(function (rows) {
        _bkLibrary = Array.isArray(rows) ? rows : [];
        _bkRenderLibrary();
      })
      .catch(function () {
        _bkRenderLibrary();
      });
  }

  function _bkRefreshLibraryCards() {
    var u = yamGetUser();
    if (!u || !u.couple_id) return;
    sb2Fetch(BK_LIBRARY_TBL, 'couple_id=eq.' + u.couple_id + '&order=added_at.desc')
      .then(function (rows) {
        _bkLibrary = Array.isArray(rows) ? rows : [];
        // Mettre à jour seulement les cards sans re-render complet
        _bkLibrary.forEach(function (book) {
          var card = document.querySelector('[data-book-id="' + book.id + '"]');
          if (card) _bkUpdateCard(card, book);
        });
      });
  }


  // ─── 7. RENDU UI PRINCIPAL ───────────────────────────────────────

  function _bkRenderSkeleton() {
    var c = document.getElementById('bkLibContainer');
    if (!c) return;
    c.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:12px;padding:12px 16px;">' +
        [1, 2, 3].map(function () {
          return '<div style="height:88px;border-radius:14px;background:var(--s2);animation:bkPulse 1.4s ease-in-out infinite;"></div>';
        }).join('') +
      '</div>';
  }

  function _bkRenderLibrary() {
    var c = document.getElementById('bkLibContainer');
    if (!c) return;
    c.style.display = '';
    var reader = document.getElementById('bkReader');
    if (reader) reader.style.display = 'none';

    var u = yamGetUser();
    var me = getProfile();

    var html = '<div style="padding:0 16px 16px;">';

    // Tabs : Bibliothèque | Catalogue | Recherche
    html += '<div style="display:flex;gap:6px;margin-bottom:14px;overflow-x:auto;scrollbar-width:none;">' +
      _bkTabBtn('library', '📚 Ma biblio', _bkTab === 'library') +
      _bkTabBtn('catalog', '✨ Classiques', _bkTab === 'catalog') +
      _bkTabBtn('search',  '🔍 Rechercher', _bkTab === 'search') +
    '</div>';

    if (_bkTab === 'library') {
      if (_bkLibrary.length === 0) {
        html += '<div style="text-align:center;padding:40px 20px;color:var(--muted);">' +
          '<div style="font-size:40px;margin-bottom:12px;">📖</div>' +
          '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px;">Aucun livre encore</div>' +
          '<div style="font-size:13px;line-height:1.5;">Ajoutez un classique depuis<br>le catalogue ou cherchez un livre</div>' +
        '</div>';
      } else {
        html += '<div style="display:flex;flex-direction:column;gap:10px;">';
        _bkLibrary.forEach(function (book) {
          html += _bkBookCard(book, me);
        });
        html += '</div>';
      }
    }

    if (_bkTab === 'catalog') {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
      BK_CATALOG.forEach(function (item) {
        var alreadyAdded = _bkLibrary.some(function (b) { return b.gutenberg_id === item.gutenberg_id; });
        html += _bkCatalogCard(item, alreadyAdded);
      });
      html += '</div>';
    }

    if (_bkTab === 'search') {
      html += '<div style="margin-bottom:12px;">' +
        '<div style="display:flex;gap:8px;">' +
        '<input id="bkSearchInput" type="text" placeholder="Titre, auteur…" ' +
        'style="flex:1;padding:10px 14px;border-radius:50px;border:1px solid var(--border);' +
        'background:var(--s1);color:var(--text);font-size:14px;font-family:DM Sans,sans-serif;outline:none;">' +
        '<button id="bkSearchBtn" style="padding:10px 18px;border-radius:50px;background:var(--accent);' +
        'color:#fff;font-size:13px;font-weight:700;border:none;cursor:pointer;font-family:DM Sans,sans-serif;">' +
        'Go</button></div></div>' +
        '<div id="bkSearchResults"></div>';
    }

    html += '</div>';
    c.innerHTML = html;

    // Event listeners
    c.querySelectorAll('[data-bk-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _bkTab = btn.getAttribute('data-bk-tab');
        _bkRenderLibrary();
      });
    });

    c.querySelectorAll('[data-bk-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var bookId = btn.getAttribute('data-bk-open');
        var book = _bkLibrary.find(function (b) { return b.id === bookId; });
        if (book) _bkOpenReader(book);
      });
    });

    c.querySelectorAll('[data-bk-add-catalog]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var gid = parseInt(btn.getAttribute('data-bk-add-catalog'), 10);
        var item = BK_CATALOG.find(function (i) { return i.gutenberg_id === gid; });
        if (item) _bkAddFromCatalog(item, btn);
      });
    });

    var searchBtn = document.getElementById('bkSearchBtn');
    var searchInput = document.getElementById('bkSearchInput');
    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', function () { _bkSearch(searchInput.value.trim()); });
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') _bkSearch(searchInput.value.trim());
      });
    }
  }

  function _bkTabBtn(tab, label, active) {
    return '<button data-bk-tab="' + tab + '" style="flex-shrink:0;padding:7px 14px;border-radius:20px;' +
      'font-size:12px;font-weight:700;border:1px solid ' + (active ? 'rgba(231,90,124,.4)' : 'var(--border)') + ';' +
      'background:' + (active ? 'var(--accent-s)' : 'var(--s1)') + ';' +
      'color:' + (active ? 'var(--accent)' : 'var(--text)') + ';' +
      'cursor:pointer;font-family:DM Sans,sans-serif;">' + label + '</button>';
  }

  function _bkBookCard(book, me) {
    var myRead = book['read_' + me] || 0;
    var pct = book.total_chars > 0 ? Math.round((myRead / book.total_chars) * 100) : 0;
    var partnerRole = me === 'girl' ? 'boy' : 'girl';
    var partnerRead = book['read_' + partnerRole] || 0;
    var partnerPct = book.total_chars > 0 ? Math.round((partnerRead / book.total_chars) * 100) : 0;
    var partnerName = yamGetDisplayName(partnerRole);
    var statusColors = { reading: '#22c55e', done: 'var(--accent)', paused: 'var(--muted)' };
    var statusLabels = { reading: 'En cours', done: 'Terminé', paused: 'En pause' };

    return '<div data-book-id="' + escHtml(book.id) + '" style="background:var(--s1);border:1px solid var(--border);' +
      'border-radius:14px;overflow:hidden;">' +
      '<div data-bk-open="' + escHtml(book.id) + '" style="display:flex;gap:12px;padding:12px 14px;cursor:pointer;' +
      'transition:background .12s;-webkit-tap-highlight-color:transparent;" ' +
      'onmouseenter="this.style.background=\'var(--s2)\'" onmouseleave="this.style.background=\'\'">' +
        '<div style="width:48px;height:64px;border-radius:8px;background:var(--accent-s);display:flex;' +
        'align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">' +
          escHtml(book.cover_emoji || '📖') +
        '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px;' +
          'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(book.title) + '</div>' +
          '<div style="font-size:11px;color:var(--muted);margin-bottom:6px;">' + escHtml(book.author) + '</div>' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">' +
            '<div style="flex:1;height:3px;border-radius:2px;background:var(--border);overflow:hidden;">' +
              '<div style="height:100%;width:' + pct + '%;background:var(--accent);border-radius:2px;"></div>' +
            '</div>' +
            '<span style="font-size:10px;font-weight:700;color:var(--accent);min-width:28px;">' + pct + '%</span>' +
          '</div>' +
          '<div style="font-size:10px;color:var(--muted);">' +
            escHtml(partnerName) + ' : ' + partnerPct + '%' +
            ' <span style="color:' + (statusColors[book.status] || 'var(--muted)') + ';font-weight:700;">· ' +
            (statusLabels[book.status] || '') + '</span>' +
          '</div>' +
        '</div>' +
        '<svg width="7" height="12" viewBox="0 0 8 14" style="stroke:var(--muted);stroke-width:2;fill:none;' +
        'flex-shrink:0;align-self:center;"><polyline points="1 1 7 7 1 13"/></svg>' +
      '</div>' +
      // Boutons actions
      '<div style="display:flex;border-top:1px solid var(--border);">' +
        '<button data-bk-open="' + escHtml(book.id) + '" style="flex:1;padding:9px;font-size:12px;font-weight:700;' +
        'color:var(--accent);background:none;border:none;cursor:pointer;font-family:DM Sans,sans-serif;">Lire</button>' +
        '<div style="width:1px;background:var(--border);"></div>' +
        '<button data-bk-sync="' + escHtml(book.id) + '" style="flex:1;padding:9px;font-size:12px;font-weight:700;' +
        'color:var(--text);background:none;border:none;cursor:pointer;font-family:DM Sans,sans-serif;">📡 Lire ensemble</button>' +
        '<div style="width:1px;background:var(--border);"></div>' +
        '<button data-bk-delete="' + escHtml(book.id) + '" style="flex:1;padding:9px;font-size:12px;font-weight:700;' +
        'color:var(--muted);background:none;border:none;cursor:pointer;font-family:DM Sans,sans-serif;">Retirer</button>' +
      '</div>' +
    '</div>';
  }

  // Rebrancher les listeners sur les boutons Lire ensemble / Retirer
  function _bkBindCardListeners(container) {
    (container || document).querySelectorAll('[data-bk-sync]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var bookId = btn.getAttribute('data-bk-sync');
        var book = _bkLibrary.find(function (b) { return b.id === bookId; });
        if (book) _bkStartSync(book);
      });
    });
    (container || document).querySelectorAll('[data-bk-delete]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var bookId = btn.getAttribute('data-bk-delete');
        _bkDeleteBook(bookId);
      });
    });
  }

  function _bkUpdateCard(card, book) {
    var me = getProfile();
    var myRead = book['read_' + me] || 0;
    var pct = book.total_chars > 0 ? Math.round((myRead / book.total_chars) * 100) : 0;
    var progressBar = card.querySelector('[data-bk-pct]');
    if (progressBar) progressBar.style.width = pct + '%';
  }

  function _bkCatalogCard(item, alreadyAdded) {
    return '<div style="background:var(--s1);border:1px solid var(--border);border-radius:12px;' +
      'padding:12px;display:flex;flex-direction:column;gap:8px;">' +
        '<div style="font-size:28px;text-align:center;">' + item.cover + '</div>' +
        '<div style="font-size:12px;font-weight:700;color:var(--text);line-height:1.3;text-align:center;">' +
          escHtml(item.title) + '</div>' +
        '<div style="font-size:10px;color:var(--muted);text-align:center;">' + escHtml(item.author) + '</div>' +
        '<button data-bk-add-catalog="' + item.gutenberg_id + '" ' +
        (alreadyAdded ? 'disabled ' : '') +
        'style="padding:7px;border-radius:20px;font-size:11px;font-weight:700;border:1px solid ' +
        (alreadyAdded ? 'var(--border)' : 'var(--accent)') + ';' +
        'background:' + (alreadyAdded ? 'var(--s2)' : 'var(--accent-s)') + ';' +
        'color:' + (alreadyAdded ? 'var(--muted)' : 'var(--accent)') + ';' +
        'cursor:' + (alreadyAdded ? 'default' : 'pointer') + ';font-family:DM Sans,sans-serif;">' +
        (alreadyAdded ? '✓ Ajouté' : '+ Ajouter') + '</button>' +
    '</div>';
  }


  // ─── 8. RECHERCHE GUTENDEX ────────────────────────────────────────

  function _bkSearch(query) {
    if (!query || query.length < 2) return;
    var resultsEl = document.getElementById('bkSearchResults');
    if (!resultsEl) return;

    // Cache
    if (_bkSearchCache[query]) {
      _bkRenderSearchResults(resultsEl, _bkSearchCache[query]);
      return;
    }

    resultsEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px;">Recherche…</div>';

    fetch(GUTENDEX_API + '?search=' + encodeURIComponent(query) + '&languages=fr')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var results = (data.results || []).slice(0, 12);
        _bkSearchCache[query] = results;
        _bkRenderSearchResults(resultsEl, results);
      })
      .catch(function () {
        resultsEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px;">Erreur réseau — réessaie</div>';
      });
  }

  function _bkRenderSearchResults(container, results) {
    if (!results || results.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px;">Aucun résultat en français</div>';
      return;
    }
    container.innerHTML = '';
    results.forEach(function (book) {
      var author = book.authors && book.authors[0] ? book.authors[0].name : 'Auteur inconnu';
      var alreadyAdded = _bkLibrary.some(function (b) { return b.gutenberg_id === book.id; });
      var div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);';
      div.innerHTML =
        '<div style="width:40px;height:52px;border-radius:6px;background:var(--s2);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">📖</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(book.title) + '</div>' +
          '<div style="font-size:11px;color:var(--muted);">' + escHtml(author) + '</div>' +
        '</div>' +
        '<button style="flex-shrink:0;padding:7px 14px;border-radius:20px;font-size:11px;font-weight:700;' +
        'border:1px solid ' + (alreadyAdded ? 'var(--border)' : 'var(--accent)') + ';' +
        'background:' + (alreadyAdded ? 'var(--s2)' : 'var(--accent-s)') + ';' +
        'color:' + (alreadyAdded ? 'var(--muted)' : 'var(--accent)') + ';' +
        'cursor:' + (alreadyAdded ? 'default' : 'pointer') + ';font-family:DM Sans,sans-serif;">' +
        (alreadyAdded ? '✓' : '+ Ajouter') + '</button>';

      var btn = div.querySelector('button');
      if (!alreadyAdded) {
        btn.addEventListener('click', function () {
          _bkAddFromSearch({
            gutenberg_id: book.id,
            title: book.title,
            author: author,
            cover_emoji: '📖',
          }, btn);
        });
      }
      container.appendChild(div);
    });
  }


  // ─── 9. AJOUT D'UN LIVRE ─────────────────────────────────────────

  function _bkAddFromCatalog(item, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
    _bkFetchGutenbergMeta(item.gutenberg_id, function (meta) {
      _bkInsertBook({
        gutenberg_id: item.gutenberg_id,
        title:        item.title,
        author:       item.author,
        cover_emoji:  item.cover,
        content_url:  meta.content_url || '',
        total_chars:  meta.total_chars || 0,
        chapters:     meta.chapters    || [],
      }, function (ok) {
        if (btn) { btn.disabled = ok; btn.textContent = ok ? '✓ Ajouté' : 'Erreur'; }
        if (ok) {
          showToast('📚 "' + item.title + '" ajouté !', 'success');
          haptic('success');
          _bkLoadLibrary();
        }
      });
    });
  }

  function _bkAddFromSearch(item, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
    _bkFetchGutenbergMeta(item.gutenberg_id, function (meta) {
      _bkInsertBook({
        gutenberg_id: item.gutenberg_id,
        title:        item.title,
        author:       item.author,
        cover_emoji:  '📖',
        content_url:  meta.content_url || '',
        total_chars:  meta.total_chars || 0,
        chapters:     meta.chapters    || [],
      }, function (ok) {
        if (btn) { btn.disabled = ok; btn.textContent = ok ? '✓' : 'Erreur'; }
        if (ok) {
          showToast('📚 "' + item.title + '" ajouté !', 'success');
          haptic('success');
          _bkLoadLibrary();
        }
      });
    });
  }

  // Récupère l'URL du texte HTML depuis gutendex et pré-calcule les chars
  function _bkFetchGutenbergMeta(gutenbergId, cb) {
    fetch(GUTENDEX_API + gutenbergId + '/')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var formats = data.formats || {};
        // Préférer HTML, sinon texte brut
        var contentUrl =
          formats['text/html'] ||
          formats['text/html; charset=utf-8'] ||
          formats['text/plain; charset=utf-8'] ||
          formats['text/plain'] || '';

        // Nettoyer l'URL (Gutenberg retourne parfois des .zip)
        if (contentUrl && contentUrl.endsWith('.zip')) contentUrl = '';

        cb({ content_url: contentUrl, total_chars: 0, chapters: [] });
      })
      .catch(function () {
        cb({ content_url: '', total_chars: 0, chapters: [] });
      });
  }

  function _bkInsertBook(data, cb) {
    var u = yamGetUser();
    if (!u || !u.couple_id) { cb(false); return; }

    sb2Post(BK_LIBRARY_TBL, {
      couple_id:    u.couple_id,
      source:       'gutenberg',
      gutenberg_id: data.gutenberg_id,
      title:        data.title,
      author:       data.author,
      cover_emoji:  data.cover_emoji,
      content_url:  data.content_url,
      total_chars:  data.total_chars,
      chapters:     JSON.stringify(data.chapters),
      added_by:     u.role,
      status:       'reading',
    })
      .then(function (rows) {
        cb(Array.isArray(rows) && rows.length > 0);
      })
      .catch(function () { cb(false); });
  }

  function _bkDeleteBook(bookId) {
    if (!confirm('Retirer ce livre de votre bibliothèque ?')) return;
    sb2Delete(BK_LIBRARY_TBL, 'id=eq.' + bookId)
      .then(function () {
        _bkLibrary = _bkLibrary.filter(function (b) { return b.id !== bookId; });
        showToast('Livre retiré', '', 2000);
        _bkRenderLibrary();
      });
  }


  // ─── 10. LECTEUR DE TEXTE ────────────────────────────────────────

  function _bkOpenReader(book) {
    _bkCurrentBook = book;
    var u = yamGetUser();
    if (!u) return;

    // Charger les progressions des deux
    sb2Fetch(BK_READS_TBL, 'couple_id=eq.' + u.couple_id + '&book_id=eq.' + book.id)
      .then(function (rows) {
        _bkReads = {};
        (rows || []).forEach(function (r) { _bkReads[r.player_role] = r; });
        _bkShowReader(book);
      });
  }

  function _bkShowReader(book) {
    var lib = document.getElementById('bkLibContainer');
    var reader = document.getElementById('bkReader');
    if (lib)    lib.style.display    = 'none';
    if (reader) reader.style.display = '';
    haptic('light');

    if (!book.content_url) {
      _bkRenderReaderShell(book, '<div style="padding:24px;text-align:center;color:var(--muted);">Texte non disponible pour ce livre.<br>Essaie un autre titre du catalogue.</div>');
      return;
    }

    // Afficher shell + loading pendant le fetch du texte
    _bkRenderReaderShell(book, '<div id="bkTextLoading" style="padding:40px;text-align:center;color:var(--muted);font-size:13px;">Chargement du livre…<br><span style="font-size:10px;opacity:.6;">Source : Project Gutenberg</span></div>');

    fetch(book.content_url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (raw) {
        var text = _bkParseText(raw);
        _bkRenderText(book, text);
      })
      .catch(function () {
        var content = document.getElementById('bkTextContent');
        if (content) content.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);">Impossible de charger le texte.<br>Vérifie ta connexion.</div>';
      });
  }

  function _bkRenderReaderShell(book, bodyHtml) {
    var reader = document.getElementById('bkReader');
    if (!reader) return;
    var me = getProfile();
    var partnerRole = me === 'girl' ? 'boy' : 'girl';
    var myRead = (_bkReads[me] && _bkReads[me].current_position) || 0;
    var partnerRead = (_bkReads[partnerRole] && _bkReads[partnerRole].current_position) || 0;
    var total = book.total_chars || 1;
    var myPct = Math.min(100, Math.round((myRead / total) * 100));
    var partnerPct = Math.min(100, Math.round((partnerRead / total) * 100));
    var partnerName = yamGetDisplayName(partnerRole);

    reader.innerHTML =
      // Header
      '<div style="position:sticky;top:0;z-index:10;background:var(--bg);border-bottom:1px solid var(--border);' +
      'padding:calc(var(--safe-top,0px) + 10px) 16px 10px;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<button id="bkBackBtn" style="width:34px;height:34px;border-radius:50%;background:var(--s2);' +
          'border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;">' +
            '<svg width="8" height="14" viewBox="0 0 8 14" style="stroke:var(--text);stroke-width:2;fill:none;">' +
            '<polyline points="7 1 1 7 7 13"/></svg>' +
          '</button>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
              escHtml(book.title) + '</div>' +
            '<div style="font-size:10px;color:var(--muted);">' + escHtml(book.author) + '</div>' +
          '</div>' +
          '<button id="bkSyncBtn" style="padding:6px 12px;border-radius:20px;font-size:11px;font-weight:700;' +
          'border:1px solid var(--accent);background:var(--accent-s);color:var(--accent);cursor:pointer;' +
          'font-family:DM Sans,sans-serif;">📡 Sync</button>' +
        '</div>' +
        // Barre de progression double
        '<div id="bkProgressWrap" style="margin-top:8px;">' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<span style="font-size:10px;color:var(--text);font-weight:700;min-width:26px;">' + myPct + '%</span>' +
            '<div style="flex:1;height:4px;border-radius:2px;background:var(--border);position:relative;">' +
              '<div id="bkMyProg" style="position:absolute;left:0;top:0;bottom:0;width:' + myPct + '%;' +
              'background:var(--accent);border-radius:2px;transition:width .4s;"></div>' +
              '<div id="bkPartnerProg" style="position:absolute;left:0;top:0;bottom:0;width:' + partnerPct + '%;' +
              'background:rgba(231,90,124,.3);border-radius:2px;transition:width .4s;"></div>' +
            '</div>' +
            '<span style="font-size:10px;color:var(--muted);min-width:44px;text-align:right;">' +
              escHtml(partnerName) + ' ' + partnerPct + '%</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Corps texte
      '<div id="bkTextContent" style="padding:20px 18px 40px;overflow-y:auto;' +
      'font-size:16px;line-height:1.75;color:var(--text);font-family:Georgia,serif;">' +
        bodyHtml +
      '</div>' +

      // Nav pages
      '<div style="position:sticky;bottom:0;background:var(--bg);border-top:1px solid var(--border);' +
      'padding:8px 16px calc(var(--safe-bottom,0px) + 8px);display:flex;align-items:center;gap:10px;">' +
        '<button id="bkPrevPage" style="padding:8px 16px;border-radius:20px;background:var(--s2);' +
        'border:1px solid var(--border);font-size:13px;color:var(--text);cursor:pointer;font-family:DM Sans,sans-serif;">‹ Préc.</button>' +
        '<div id="bkPageLabel" style="flex:1;text-align:center;font-size:11px;color:var(--muted);"></div>' +
        '<button id="bkNextPage" style="padding:8px 16px;border-radius:20px;background:var(--s2);' +
        'border:1px solid var(--border);font-size:13px;color:var(--text);cursor:pointer;font-family:DM Sans,sans-serif;">Suiv. ›</button>' +
      '</div>';

    // Event listeners shell
    document.getElementById('bkBackBtn').addEventListener('click', _bkCloseReader);
    document.getElementById('bkSyncBtn').addEventListener('click', function () {
      _bkStartSync(book);
    });
  }

  // Parser HTML Gutenberg → texte propre
  function _bkParseText(raw) {
    // Supprimer les balises HTML
    var tmp = document.createElement('div');
    // Si c'est du HTML
    if (raw.indexOf('<html') !== -1 || raw.indexOf('<body') !== -1) {
      tmp.innerHTML = raw;
      // Supprimer scripts et styles
      tmp.querySelectorAll('script,style,head').forEach(function (el) { el.remove(); });
      var text = tmp.innerText || tmp.textContent || '';
      return text.replace(/\n{3,}/g, '\n\n').trim();
    }
    // Texte brut
    return raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function _bkRenderText(book, text) {
    var content = document.getElementById('bkTextContent');
    if (!content) return;

    // Mettre à jour le total_chars en base si pas encore défini
    if (!book.total_chars || book.total_chars === 0) {
      book.total_chars = text.length;
      sb2Patch(BK_LIBRARY_TBL, 'id=eq.' + book.id, { total_chars: text.length }).catch(function () {});
    }

    // Découper en pages
    var pages = _bkPaginate(text);
    var me = getProfile();
    var myPos = (_bkReads[me] && _bkReads[me].current_position) || 0;
    var currentPage = Math.floor(myPos / CHARS_PER_PAGE);
    if (currentPage >= pages.length) currentPage = 0;

    function renderPage(pageIdx) {
      if (pageIdx < 0) pageIdx = 0;
      if (pageIdx >= pages.length) pageIdx = pages.length - 1;
      currentPage = pageIdx;

      var pageText = pages[pageIdx];
      content.innerHTML = '<div style="white-space:pre-wrap;">' + escHtml(pageText) + '</div>';

      // Mise à jour label
      var label = document.getElementById('bkPageLabel');
      if (label) label.textContent = 'Page ' + (pageIdx + 1) + ' / ' + pages.length;

      // Sauvegarder progression
      var pos = pageIdx * CHARS_PER_PAGE;
      _bkSaveProgress(book, pos, text.length);

      // Scroll haut
      content.scrollTop = 0;
    }

    // Navigation
    var prevBtn = document.getElementById('bkPrevPage');
    var nextBtn = document.getElementById('bkNextPage');
    if (prevBtn) prevBtn.addEventListener('click', function () { haptic('light'); renderPage(currentPage - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { haptic('light'); renderPage(currentPage + 1); });

    renderPage(currentPage);
  }

  function _bkPaginate(text) {
    var pages = [];
    var i = 0;
    while (i < text.length) {
      var end = i + CHARS_PER_PAGE;
      // Couper sur un espace ou saut de ligne pour éviter de couper un mot
      if (end < text.length) {
        var nextSpace = text.indexOf(' ', end);
        var nextLine  = text.indexOf('\n', end);
        var nearest   = Math.min(
          nextSpace  === -1 ? Infinity : nextSpace,
          nextLine   === -1 ? Infinity : nextLine
        );
        if (nearest !== Infinity && nearest - end < 200) end = nearest + 1;
      }
      pages.push(text.slice(i, end));
      i = end;
    }
    return pages;
  }

  // Barre de progression mise à jour via Realtime
  function _bkRenderProgressBar() {
    var me = getProfile();
    var partnerRole = me === 'girl' ? 'boy' : 'girl';
    var book = _bkCurrentBook;
    if (!book || !book.total_chars) return;

    var myRead      = (_bkReads[me]           && _bkReads[me].current_position)           || 0;
    var partnerRead = (_bkReads[partnerRole]   && _bkReads[partnerRole].current_position)  || 0;
    var total       = book.total_chars;
    var myPct       = Math.min(100, Math.round((myRead / total) * 100));
    var partnerPct  = Math.min(100, Math.round((partnerRead / total) * 100));

    var myBar      = document.getElementById('bkMyProg');
    var partnerBar = document.getElementById('bkPartnerProg');
    if (myBar)      myBar.style.width      = myPct + '%';
    if (partnerBar) partnerBar.style.width = partnerPct + '%';
  }


  // ─── 11. SAUVEGARDE PROGRESSION ──────────────────────────────────

  function _bkSaveProgress(book, position, totalChars) {
    if (_bkSaving) return;
    _bkSaving = true;
    var u = yamGetUser();
    if (!u || !u.couple_id) { _bkSaving = false; return; }

    var pct = totalChars > 0 ? Math.round((position / totalChars) * 100) : 0;

    fetch(SB_URL + '/rest/v1/' + BK_READS_TBL + '?on_conflict=couple_id,book_id,player_role', {
      method: 'POST',
      headers: sb2Headers({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({
        couple_id:        u.couple_id,
        book_id:          book.id,
        player_role:      u.role,
        current_position: position,
        percent_read:     pct,
        last_read_at:     new Date().toISOString(),
      }),
    })
      .then(function () {
        _bkSaving = false;
        // Mettre à jour le cache local
        _bkReads[u.role] = Object.assign(_bkReads[u.role] || {}, {
          current_position: position,
          percent_read:     pct,
        });
        _bkRenderProgressBar();

        // Flamme : lecture = activité flamme (1x/jour max géré côté yamFlameActivity)
        if (pct > 0 && typeof window.yamFlameActivity === 'function') {
          window.yamFlameActivity('book_read');
        }

        // Si terminé : toast + flamme
        if (pct >= 100) {
          showToast('🎉 Livre terminé ! La flamme brûle fort 🔥', 'success', 4000);
          haptic('success');
          if (typeof window.yamFlameActivity === 'function') {
            window.yamFlameActivity('book_done');
          }
          sb2Patch(BK_LIBRARY_TBL, 'id=eq.' + book.id, { status: 'done' }).catch(function () {});
        }
      })
      .catch(function () { _bkSaving = false; });
  }


  // ─── 12. MODE SYNCHRONISÉ ────────────────────────────────────────

  function _bkStartSync(book) {
    _bkCurrentBook = book;

    // Si le reader est fermé, on l'ouvre d'abord
    var reader = document.getElementById('bkReader');
    var lib    = document.getElementById('bkLibContainer');
    if (lib)    lib.style.display    = 'none';
    if (reader) reader.style.display = '';

    _bkRenderSyncLobby(book);

    _bkSyncEngine = YAMMultiplayer.init({
      gameTable:     BK_SESSIONS_TBL,
      presenceTable: BK_PRESENCE_TBL,

      buildInitialState: function () {
        return {
          book_id:          book.id,
          current_position: 0,
          current_page:     0,
          co_control:       false,
        };
      },

      onWaiting: function (me) {
        _bkIsHost = true;
        _bkRenderSyncLobby(book, 'En attente de ' + yamGetDisplayName(me === 'girl' ? 'boy' : 'girl') + '…');
      },

      onMatchFound: function (gameRow) {
        _bkSyncActive = true;
        var state = typeof gameRow.state === 'string' ? JSON.parse(gameRow.state) : gameRow.state;
        _bkIsHost = (gameRow.created_by === getProfile());
        showToast('📡 Lecture synchronisée !', 'success');
        haptic('success');
        _bkOpenSyncReader(book, state);
      },

      onStateUpdate: function (gameRow) {
        if (!_bkSyncActive) return;
        var state = typeof gameRow.state === 'string' ? JSON.parse(gameRow.state) : gameRow.state;
        _bkApplySyncState(state);
      },

      onOpponentOffline: function () {
        showToast(yamGetDisplayName(getProfile() === 'girl' ? 'boy' : 'girl') + ' est déconnecté·e', 'error');
      },

      onAbandon: function () {
        showToast('Partenaire a quitté la session', '', 3000);
        _bkStopSyncSession();
      },

      onLeave: function () {
        _bkSyncActive = false;
      },
    });

    _bkSyncEngine.enter(getProfile());
  }

  function _bkStopSyncSession() {
    if (_bkSyncEngine) {
      _bkSyncEngine.stopAll();
      _bkSyncEngine.leave && _bkSyncEngine.leave();
      _bkSyncEngine = null;
    }
    _bkSyncActive = false;
    _bkIsHost     = false;
  }

  function _bkRenderSyncLobby(book, msg) {
    var reader = document.getElementById('bkReader');
    if (!reader) return;
    var partnerName = yamGetDisplayName(getProfile() === 'girl' ? 'boy' : 'girl');
    reader.innerHTML =
      '<div style="position:sticky;top:0;z-index:10;background:var(--bg);border-bottom:1px solid var(--border);' +
      'padding:calc(var(--safe-top,0px) + 10px) 16px 10px;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<button id="bkSyncCancelBtn" style="width:34px;height:34px;border-radius:50%;background:var(--s2);' +
          'border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;">' +
            '<svg width="8" height="14" viewBox="0 0 8 14" style="stroke:var(--text);stroke-width:2;fill:none;">' +
            '<polyline points="7 1 1 7 7 13"/></svg>' +
          '</button>' +
          '<div style="font-size:13px;font-weight:700;color:var(--text);">Lire ensemble</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 24px;gap:16px;">' +
        '<div style="font-size:48px;">📡</div>' +
        '<div style="font-size:15px;font-weight:700;color:var(--text);">' + escHtml(book.title) + '</div>' +
        '<div id="bkSyncStatus" style="font-size:13px;color:var(--muted);text-align:center;">' +
          (msg || 'Connexion à ' + escHtml(partnerName) + '…') +
        '</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:var(--accent);animation:bkDot 1s ease-in-out infinite;"></span>' +
          '<span style="width:8px;height:8px;border-radius:50%;background:var(--accent);animation:bkDot 1s ease-in-out .2s infinite;"></span>' +
          '<span style="width:8px;height:8px;border-radius:50%;background:var(--accent);animation:bkDot 1s ease-in-out .4s infinite;"></span>' +
        '</div>' +
      '</div>';

    document.getElementById('bkSyncCancelBtn').addEventListener('click', function () {
      _bkStopSyncSession();
      _bkOpenReader(book);
    });
  }

  function _bkOpenSyncReader(book, state) {
    _bkCurrentBook = book;
    // Ouvrir le reader normal puis activer le mode sync
    var u = yamGetUser();
    sb2Fetch(BK_READS_TBL, 'couple_id=eq.' + u.couple_id + '&book_id=eq.' + book.id)
      .then(function (rows) {
        _bkReads = {};
        (rows || []).forEach(function (r) { _bkReads[r.player_role] = r; });
        _bkShowReader(book);
        // Attendre que le reader charge puis aller à la page sync
        setTimeout(function () {
          if (state && state.current_page !== undefined) {
            _bkGoToSyncPage(state.current_page);
          }
          _bkAddSyncOverlay();
        }, 600);
      });
  }

  function _bkGoToSyncPage(pageIdx) {
    var prevBtn = document.getElementById('bkPrevPage');
    var nextBtn = document.getElementById('bkNextPage');
    // Naviguer jusqu'à la bonne page via les boutons (simple et sûr)
    var label = document.getElementById('bkPageLabel');
    if (label) {
      var match = label.textContent.match(/Page (\d+)/);
      if (match) {
        var current = parseInt(match[1], 10) - 1;
        if (current < pageIdx && nextBtn) {
          for (var i = 0; i < (pageIdx - current) && i < 5; i++) {
            setTimeout(function () { nextBtn.click(); }, i * 50);
          }
        }
      }
    }
  }

  function _bkAddSyncOverlay() {
    var reader = document.getElementById('bkReader');
    if (!reader) return;
    // Bannière de session sync active
    var banner = document.createElement('div');
    banner.id = 'bkSyncBanner';
    banner.style.cssText = 'position:sticky;top:0;z-index:20;background:rgba(231,90,124,.12);' +
      'border-bottom:1px solid rgba(231,90,124,.3);padding:6px 16px;' +
      'display:flex;align-items:center;gap:8px;font-size:11px;color:var(--accent);font-weight:700;';
    banner.innerHTML =
      '<span style="width:6px;height:6px;border-radius:50%;background:var(--accent);' +
      'animation:cwLiveDot 1.6s ease-in-out infinite;flex-shrink:0;"></span>' +
      '<span>Session synchronisée avec ' + escHtml(yamGetDisplayName(getProfile() === 'girl' ? 'boy' : 'girl')) + '</span>' +
      '<button id="bkSyncStopBtn" style="margin-left:auto;padding:3px 10px;border-radius:20px;' +
      'border:1px solid rgba(231,90,124,.4);background:none;color:var(--accent);font-size:10px;' +
      'font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;">Quitter</button>';

    var header = reader.querySelector('[style*="sticky"]');
    if (header) header.after(banner);
    else reader.prepend(banner);

    document.getElementById('bkSyncStopBtn').addEventListener('click', function () {
      _bkStopSyncSession();
      banner.remove();
      showToast('Session synchronisée terminée', '', 2000);
    });

    // Patch les boutons de navigation pour broadcaster la page
    var prevBtn = document.getElementById('bkPrevPage');
    var nextBtn = document.getElementById('bkNextPage');
    if (prevBtn) {
      var origPrev = prevBtn.onclick;
      prevBtn.addEventListener('click', function () {
        if (_bkIsHost || (window._bkCoControl)) _bkBroadcastPage();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (_bkIsHost || (window._bkCoControl)) _bkBroadcastPage();
      });
    }
  }

  function _bkBroadcastPage() {
    if (!_bkSyncEngine || !_bkSyncActive) return;
    var label = document.getElementById('bkPageLabel');
    if (!label) return;
    var match = label.textContent.match(/Page (\d+)/);
    if (!match) return;
    var page = parseInt(match[1], 10) - 1;
    _bkSyncEngine.saveState({
      book_id:          _bkCurrentBook ? _bkCurrentBook.id : null,
      current_page:     page,
      current_position: page * CHARS_PER_PAGE,
      co_control:       false,
    });
  }

  function _bkApplySyncState(state) {
    if (_bkIsHost) return; // L'hôte ne reçoit pas ses propres updates
    if (!state || state.current_page === undefined) return;
    _bkGoToSyncPage(state.current_page);
  }


  // ─── 13. HTML DE LA VUE PRINCIPALE ───────────────────────────────

  function _bkBuildView() {
    var el = document.getElementById('bookView');
    if (!el) return;

    el.innerHTML =
      // Animations CSS
      '<style>' +
        '#bookView{position:fixed;inset:0;background:var(--bg);z-index:100;display:flex;flex-direction:column;overflow:hidden;}' +
        '#bookView:not(.active){display:none;}' +
        '#bkLibContainer{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;}' +
        '#bkReader{flex:1;overflow:hidden;display:none;flex-direction:column;}' +
        '#bkReader.sync-active{border-top:2px solid var(--accent);}' +
        '#bkTextContent{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;}' +
        '@keyframes bkPulse{0%,100%{opacity:1;}50%{opacity:.4;}}' +
        '@keyframes bkDot{0%,100%{transform:scale(1);opacity:.5;}50%{transform:scale(1.4);opacity:1;}}' +
      '</style>' +

      // Header principal (bibliothèque)
      '<div id="bkHeader" style="flex-shrink:0;background:var(--bg);border-bottom:1px solid var(--border);' +
      'padding:calc(var(--safe-top,0px) + 10px) 16px 10px;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<button id="bkMainBackBtn" style="width:34px;height:34px;border-radius:50%;background:var(--s2);' +
          'border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;">' +
            '<svg width="8" height="14" viewBox="0 0 8 14" style="stroke:var(--text);stroke-width:2;fill:none;">' +
            '<polyline points="7 1 1 7 7 13"/></svg>' +
          '</button>' +
          '<div style="flex:1;">' +
            '<div style="font-size:17px;font-weight:700;color:var(--text);">📚 Lire ensemble</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Conteneur bibliothèque
      '<div id="bkLibContainer" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;"></div>' +

      // Conteneur reader
      '<div id="bkReader" style="flex:1;overflow:hidden;flex-direction:column;"></div>';

    // Listener retour principal
    document.getElementById('bkMainBackBtn').addEventListener('click', window.bkClose);
  }


  // ─── 14. MISE À JOUR ROW "Lire ensemble" DANS L'ONGLET JEUX ─────

  var _bkRowBound = false;

  function _bkActivateJeuxRow() {
    if (_bkRowBound) return;

    // Cibler par id en priorité (patch index.html)
    var row = document.getElementById('jxBooksRow');

    // Fallback : chercher par texte si l'id n'est pas encore présent
    if (!row) {
      document.querySelectorAll('.jx-row').forEach(function (r) {
        var nameEl = r.querySelector('.jx-row-name');
        if (nameEl && nameEl.textContent.indexOf('Lire ensemble') !== -1) row = r;
      });
    }

    if (!row) return; // pas encore dans le DOM, réessayer plus tard

    row.classList.remove('disabled');
    // Nettoyer badge "Bientôt" résiduel si présent
    var badge = row.querySelector('.jx-badge');
    if (badge) badge.remove();
    var sub = row.querySelector('.jx-row-sub');
    if (sub) sub.textContent = 'Classiques gratuits + lecture synchronisée';

    row.addEventListener('click', window.bkOpen);
    _bkRowBound = true;
    yamLog('[Books] Ligne "Lire ensemble" activée dans l\'onglet Jeux');
  }


  // ─── 15. STOP POLL À LA DÉCONNEXION ──────────────────────────────

  window._bkStopPolls = function () {
    _bkStopSyncSession();
    if (_bkPresTimer)    { clearInterval(_bkPresTimer);     _bkPresTimer    = null; }
    if (_bkSyncPollTimer){ clearInterval(_bkSyncPollTimer); _bkSyncPollTimer = null; }
    if (window._yamRTChannels && window._yamRTChannels['book_reads']) {
      try { window._yamRT.removeChannel(window._yamRTChannels['book_reads']); } catch (e) {}
      delete window._yamRTChannels['book_reads'];
    }
    _bkRTReads = null;
  };

  // Brancher dans yamClearAllPolls
  var _origClearPolls = window.yamClearAllPolls;
  window.yamClearAllPolls = function () {
    if (_origClearPolls) _origClearPolls();
    window._bkStopPolls();
  };


  // ─── 16. BOOT ────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    _bkBuildView();
    _bkActivateJeuxRow();
  });

  // Ré-activer la ligne si l'onglet est switché (lazy init)
  document.addEventListener('yam:tab_switched', function () {
    _bkActivateJeuxRow();
  });

  // Exposer pour app-jeux-dashboard.js (détection présence lobby)
  window._bkGetPresenceTable = function () { return BK_PRESENCE_TBL; };
  window._bkGetSessionTable  = function () { return BK_SESSIONS_TBL; };

  yamLog('[Books] app-books.js chargé');

})();
