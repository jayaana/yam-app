// ═══════════════════════════════════════════════════════════════════
// app-books.js — YAM v15 — Lire ensemble
// Lecture asynchrone + synchronisée via Gutenberg API (gutendex.com)
// Dépendances : app-core.js
// Globals utilisés : SB_URL, sb2Headers(), sb2Fetch(), sb2Post(),
//   sb2Patch(), sb2Delete(), yamGetUser(), getProfile(),
//   yamGetDisplayName(), showToast(), haptic(), _yamSlide(),
//   yamFlameActivity(), escHtml(), window._yamRT
// Ordre de chargement : après app-core.js
// ═══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── 1. CONSTANTES & CONFIG ──────────────────────────────────────

  var GUTENDEX_API    = 'https://gutendex.com/books/';
  var GUTENBERG_BASE  = 'https://www.gutenberg.org';
  // Gutenberg bloque CORS sur toutes ses URLs — proxy obligatoire
  // corsproxy.io : proxy CORS gratuit, retourne directement le texte (pas de wrapping JSON)
  var CORS_PROXY      = 'https://corsproxy.io/?url=';
  var BK_LIBRARY_TBL  = 'book_library';
  var BK_READS_TBL    = 'book_reads';
  var BK_SESSIONS_TBL = 'book_sessions';
  var BK_PRESENCE_TBL = 'book_presence';
  var BK_ANNOTS_TBL   = 'book_annotations';

  var CHARS_PER_PAGE  = 1800;   // ~1 page écran = ~1800 caractères

  // État global du module
  var _bkInited       = false;
  var _bkView         = null;   // l'élément DOM #bookView
  var _bkLibrary      = [];     // livres du couple (book_library)
  var _bkCurrentBook  = null;   // livre en cours de lecture
  var _bkReads        = {};     // { girl: row, boy: row } pour le livre courant
  var _bkSyncActive   = false;
  var _bkIsHost       = false;
  var _bkRTReads      = null;   // channel RT pour progression asynchrone
  var _bkSearchCache  = {};     // cache recherche gutendex
  var _bkTab          = 'library'; // 'library' | 'search' | 'catalog'
  var _bkSaving       = false;  // guard anti-double save progression
  var _bkCurrentRenderPage = null; // exposé par _bkRenderText pour navigation sync


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
        var row = payload.new;
        if (!row) return;

        // Mettre à jour la progression en mémoire dans _bkLibrary
        _bkLibrary.forEach(function (book) {
          if (book.id === row.book_id) {
            book['read_' + row.player_role] = row.current_position || 0;
          }
        });

        // Si on est dans le reader, mettre à jour la barre de progression
        if (_bkCurrentBook && row.book_id === _bkCurrentBook.id) {
          _bkReads[row.player_role] = row;
          _bkRenderProgressBar();
        }

        // Mettre à jour la card dans la biblio si visible
        var card = document.querySelector('[data-book-id="' + row.book_id + '"]');
        if (card) {
          var book = _bkLibrary.find(function(b){ return b.id === row.book_id; });
          if (book) _bkUpdateCard(card, book);
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

    // ── RT book_sessions — carte mise à jour en temps réel ──
    if (!window._yamRTChannels['book_sessions']) {
      // Stocker le book_id de la session active localement
      // car payload.old sur DELETE ne contient que l'id, même avec REPLICA IDENTITY FULL
      var _lastSessionBookId = null;

      var chSessions = window._yamRT
        .channel('book_sessions_' + u.couple_id)
        .on('postgres_changes', {
          event: '*', schema: 'public',
          table: BK_SESSIONS_TBL,
          filter: 'couple_id=eq.' + u.couple_id,
        }, function (payload) {

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Mémoriser le book_id de la session active
            if (payload.new && payload.new.book_id) {
              _lastSessionBookId = payload.new.book_id;
            }
            var row = payload.new;
            if (!row) return;
            _bkLibrary.forEach(function(book) {
              if (book.id === row.book_id) {
                book._syncSession = (row.status !== 'active') ? null : row;
              }
            });
          } else if (payload.eventType === 'DELETE') {
            // payload.old ne contient que l'id — utiliser le book_id mémorisé
            var deletedBookId = (payload.old && payload.old.book_id) || _lastSessionBookId;
            if (deletedBookId) {
              _bkLibrary.forEach(function(book) {
                if (book.id === deletedBookId) {
                  book._syncSession = null;
                }
              });
              _lastSessionBookId = null;
            } else {
              // Fallback : effacer toutes les sessions
              _bkLibrary.forEach(function(book) { book._syncSession = null; });
            }
          }

          // Trier : livre en session en tête
          _bkLibrary.sort(function(a, b) {
            if (a._syncSession && !b._syncSession) return -1;
            if (!a._syncSession && b._syncSession) return 1;
            return 0;
          });
          // Re-render la biblio si elle est visible (pas en train de lire)
          var bv = document.getElementById('bookView');
          var reader = document.getElementById('bkReader');
          if (bv && bv.classList.contains('active') &&
              reader && !reader.classList.contains('bk-reader-visible')) {
            _bkRenderLibrary();
          }
        })
        .subscribe();
      window._yamRTChannels['book_sessions'] = chSessions;
    }
  }


  // ─── 5. OUVERTURE / FERMETURE DE LA VUE ──────────────────────────

  window.bkOpen = function () {
    _bkInit();
    var u = yamGetUser();
    if (!u) { showToast('Connecte-toi d\'abord 💕', 'error'); return; }

    var bookView = document.getElementById('bookView');
    var jeuxTab  = document.getElementById('yamJeuxTab');
    if (!bookView) return;

    // Cacher la navbar YAM comme le font Skyjo/Ocho (classe subview-active sur body)
    document.body.classList.add('subview-active');

    _yamSlide(bookView, jeuxTab, 'forward');
    haptic('light');
    _bkLoadLibrary();
  };

  window.bkClose = function () {
    // Stopper la sync seulement si elle est active (évite le toast parasite)
    if (_bkSyncActive) _bkStopSyncSession();

    var bookView = document.getElementById('bookView');
    var jeuxTab  = document.getElementById('yamJeuxTab');
    if (!bookView || !jeuxTab) return;

    // Réafficher la navbar YAM
    document.body.classList.remove('subview-active');
    bookView.classList.remove('bk-reading');

    _yamSlide(jeuxTab, bookView, 'backward');
    jeuxTab.classList.add('active');

    // Forcer la suppression de active après l'animation (DUR=300ms + marge)
    setTimeout(function () {
      bookView.classList.remove('active');
      bookView.style.display = '';
    }, 360);

    haptic('light');
  };

  // Fermer le reader et revenir à la bibliothèque
  function _bkCloseReader() {
    // Stopper la sync seulement si active
    if (_bkSyncActive) _bkStopSyncSession();
    _bkCurrentBook = null;
    _bkCurrentRenderPage = null;
    _bkReads = {};
    var reader   = document.getElementById('bkReader');
    var lib      = document.getElementById('bkLibContainer');
    var bookView = document.getElementById('bookView');
    if (reader)   { reader.classList.remove('bk-reader-visible'); }
    if (lib)      lib.style.display = '';
    if (bookView) bookView.classList.remove('bk-reading');
    _bkRenderLibrary();
  }


  // ─── 6. CHARGEMENT DE LA BIBLIOTHÈQUE COUPLE ─────────────────────

  function _bkLoadLibrary() {
    var u = yamGetUser();
    if (!u || !u.couple_id) return;
    _bkRenderSkeleton();

    Promise.all([
      sb2Fetch(BK_LIBRARY_TBL,  'couple_id=eq.' + u.couple_id + '&order=added_at.desc'),
      sb2Fetch(BK_READS_TBL,    'couple_id=eq.' + u.couple_id),
      sb2Fetch(BK_SESSIONS_TBL, 'couple_id=eq.' + u.couple_id + '&status=eq.active'),
    ])
      .then(function (results) {
        var books    = Array.isArray(results[0]) ? results[0] : [];
        var reads    = Array.isArray(results[1]) ? results[1] : [];
        var sessions = Array.isArray(results[2]) ? results[2] : [];

        books.forEach(function (book) {
          reads.forEach(function (read) {
            if (read.book_id === book.id) {
              book['read_' + read.player_role] = read.current_position || 0;
            }
          });
          if (book.read_girl === undefined) book.read_girl = 0;
          if (book.read_boy  === undefined) book.read_boy  = 0;
          book._syncSession = sessions.find(function(s){ return s.book_id === book.id; }) || null;
        });

        // Livre en session sync → en tête
        books.sort(function(a, b) {
          if (a._syncSession && !b._syncSession) return -1;
          if (!a._syncSession && b._syncSession) return 1;
          return 0;
        });

        _bkLibrary = books;
        _bkRenderLibrary();
      })
      .catch(function () { _bkRenderLibrary(); });
  }

  function _bkRefreshLibraryCards() {
    var u = yamGetUser();
    if (!u || !u.couple_id) return;
    Promise.all([
      sb2Fetch(BK_LIBRARY_TBL,  'couple_id=eq.' + u.couple_id + '&order=added_at.desc'),
      sb2Fetch(BK_READS_TBL,    'couple_id=eq.' + u.couple_id),
      sb2Fetch(BK_SESSIONS_TBL, 'couple_id=eq.' + u.couple_id + '&status=eq.active'),
    ]).then(function (results) {
      var books    = Array.isArray(results[0]) ? results[0] : [];
      var reads    = Array.isArray(results[1]) ? results[1] : [];
      var sessions = Array.isArray(results[2]) ? results[2] : [];
      books.forEach(function (book) {
        reads.forEach(function (read) {
          if (read.book_id === book.id) book['read_' + read.player_role] = read.current_position || 0;
        });
        if (book.read_girl === undefined) book.read_girl = 0;
        if (book.read_boy  === undefined) book.read_boy  = 0;
        book._syncSession = sessions.find(function(s){ return s.book_id === book.id; }) || null;
      });
      books.sort(function(a, b) {
        if (a._syncSession && !b._syncSession) return -1;
        if (!a._syncSession && b._syncSession) return 1;
        return 0;
      });
      _bkLibrary = books;
      _bkRenderLibrary();
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
    if (reader) { reader.classList.remove('bk-reader-visible'); }

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

    // ── Délégation d'événements — UN seul listener permanent sur le container ──
    // Plus fiable que querySelectorAll après innerHTML (pas de risque de timing)
    if (!c._bkDelegated) {
      c._bkDelegated = true;
      c.addEventListener('click', function (e) {
        var t = e.target;

        // Remonter jusqu'à trouver un attribut data-bk-*
        while (t && t !== c) {
          // Ouvrir le reader (mode normal)
          if (t.hasAttribute('data-bk-open')) {
            var bookId = t.getAttribute('data-bk-open');
            var book = _bkLibrary.find(function (b) { return b.id === bookId; });
            if (book) { _bkOpenReader(book, null, false); return; }
          }
          // Ouvrir en solo — ignorer la session sync du partenaire
          if (t.hasAttribute('data-bk-open-solo')) {
            var soloId = t.getAttribute('data-bk-open-solo');
            var soloBook = _bkLibrary.find(function (b) { return b.id === soloId; });
            if (soloBook) { _bkOpenReader(soloBook, null, true); return; }
          }
          // Rejoindre une session sync depuis la carte
          if (t.hasAttribute('data-bk-join')) {
            var joinId = t.getAttribute('data-bk-join');
            var joinBook = _bkLibrary.find(function (b) { return b.id === joinId; });
            if (joinBook && joinBook._syncSession) {
              _bkOpenReader(joinBook, joinBook._syncSession, false);
            }
            return;
          }
          // Changer d'onglet
          if (t.hasAttribute('data-bk-tab')) {
            _bkTab = t.getAttribute('data-bk-tab');
            _bkRenderLibrary();
            return;
          }
          // Ajouter depuis catalogue
          if (t.hasAttribute('data-bk-add-catalog')) {
            var gid = parseInt(t.getAttribute('data-bk-add-catalog'), 10);
            var item = BK_CATALOG.find(function (i) { return i.gutenberg_id === gid; });
            if (item) _bkAddFromCatalog(item, t);
            return;
          }
          // Sync depuis reader
          if (t.hasAttribute('data-bk-sync')) {
            var bkId = t.getAttribute('data-bk-sync');
            var bk = _bkLibrary.find(function (b) { return b.id === bkId; });
            if (bk) _bkStartSync(bk);
            return;
          }
          // Retirer livre
          if (t.hasAttribute('data-bk-delete')) {
            _bkDeleteBook(t.getAttribute('data-bk-delete'));
            return;
          }
          t = t.parentElement;
        }
      });

      // Délégation pour la recherche (keydown Enter sur l'input)
      c.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var inp = document.getElementById('bkSearchInput');
          if (inp && document.activeElement === inp) _bkSearch(inp.value.trim());
        }
      });
    }

    // Bouton recherche Go (ajouté directement car pas de data-attr)
    var searchBtn = document.getElementById('bkSearchBtn');
    if (searchBtn && !searchBtn._bkBound) {
      searchBtn._bkBound = true;
      searchBtn.addEventListener('click', function () {
        var inp = document.getElementById('bkSearchInput');
        if (inp) _bkSearch(inp.value.trim());
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
    var partnerRole = me === 'girl' ? 'boy' : 'girl';
    var partnerName = yamGetDisplayName(partnerRole);
    var statusColors = { reading: '#22c55e', done: 'var(--accent)', paused: 'var(--muted)' };
    var statusLabels = { reading: 'En cours', done: 'Terminé', paused: 'En pause' };

    var myRead      = book['read_' + me]          || 0;
    var partnerRead = book['read_' + partnerRole] || 0;
    var total       = book.total_chars || 1;
    var myPct       = Math.round((myRead / total) * 100);
    var partnerPage = book.total_chars > 0 ? Math.round(partnerRead / CHARS_PER_PAGE) + 1 : '—';
    var totalPages  = book.total_chars > 0 ? Math.ceil(book.total_chars / CHARS_PER_PAGE) : '—';

    var session       = book._syncSession || null;
    var partnerIsHost = session && session.created_by === partnerRole;
    var borderStyle   = session ? 'border:1.5px solid #22c55e;' : 'border:1px solid var(--border);';

    var html = '<div data-book-id="' + escHtml(book.id) + '" style="background:var(--s1);' + borderStyle + 'border-radius:14px;overflow:hidden;">';

    // Bandeau sync si session active
    if (session) {
      var syncLabel = partnerIsHost
        ? '📡 ' + escHtml(partnerName) + ' lit en sync — rejoindre ?'
        : '📡 Ta session sync est active — en attente de ' + escHtml(partnerName);
      html += '<div style="background:rgba(34,197,94,.1);border-bottom:1px solid rgba(34,197,94,.2);' +
        'padding:5px 12px;display:flex;align-items:center;gap:6px;">' +
        '<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;flex-shrink:0;' +
        'animation:cwLiveDot 1.6s ease-in-out infinite;"></span>' +
        '<span style="font-size:11px;font-weight:700;color:#16a34a;flex:1;">' + syncLabel + '</span>' +
        '</div>';
    }

    html +=
      '<div data-bk-open="' + escHtml(book.id) + '" class="bk-card-row" style="display:flex;gap:12px;padding:12px 14px;cursor:pointer;' +
      'transition:background .12s;-webkit-tap-highlight-color:transparent;">' +
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
              '<div style="height:100%;width:' + myPct + '%;background:var(--accent);border-radius:2px;"></div>' +
            '</div>' +
            '<span style="font-size:10px;font-weight:700;color:var(--accent);min-width:28px;">' + myPct + '%</span>' +
          '</div>' +
          '<div style="font-size:10px;color:var(--muted);">' +
            escHtml(partnerName) + ' : p.' + partnerPage + '/' + totalPages +
            ' <span style="color:' + (statusColors[book.status] || 'var(--muted)') + ';font-weight:700;">· ' +
            (statusLabels[book.status] || '') + '</span>' +
          '</div>' +
        '</div>' +
        '<svg width="7" height="12" viewBox="0 0 8 14" style="stroke:var(--muted);stroke-width:2;fill:none;' +
        'flex-shrink:0;align-self:center;"><polyline points="1 1 7 7 1 13"/></svg>' +
      '</div>' +
      '<div style="display:flex;border-top:1px solid var(--border);">';

    if (partnerIsHost) {
      html +=
        '<button data-bk-join="' + escHtml(book.id) + '" style="flex:2;padding:9px;font-size:12px;font-weight:700;' +
        'color:#16a34a;background:rgba(34,197,94,.07);border:none;cursor:pointer;font-family:DM Sans,sans-serif;">📡 Rejoindre</button>' +
        '<div style="width:1px;background:var(--border);"></div>' +
        '<button data-bk-open-solo="' + escHtml(book.id) + '" style="flex:1;padding:9px;font-size:12px;font-weight:700;' +
        'color:var(--muted);background:none;border:none;cursor:pointer;font-family:DM Sans,sans-serif;">Lire seul·e</button>';
    } else {
      html +=
        '<button data-bk-open="' + escHtml(book.id) + '" style="flex:1;padding:9px;font-size:12px;font-weight:700;' +
        'color:var(--accent);background:none;border:none;cursor:pointer;font-family:DM Sans,sans-serif;">Lire</button>';
    }

    html +=
        '<div style="width:1px;background:var(--border);"></div>' +
        '<button data-bk-delete="' + escHtml(book.id) + '" style="flex:1;padding:9px;font-size:12px;font-weight:700;' +
        'color:var(--muted);background:none;border:none;cursor:pointer;font-family:DM Sans,sans-serif;">Retirer</button>' +
      '</div>' +
    '</div>';

    return html;
  }

  // Rebrancher les listeners sur les boutons Retirer uniquement
  function _bkBindCardListeners(container) {
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
    var partnerRole = me === 'girl' ? 'boy' : 'girl';
    var total = book.total_chars || 1;
    var myRead      = book['read_' + me]          || 0;
    var partnerRead = book['read_' + partnerRole] || 0;
    var myPct       = Math.round((myRead / total) * 100);
    var partnerPage = book.total_chars > 0 ? Math.round(partnerRead / CHARS_PER_PAGE) + 1 : 1;
    var totalPages  = book.total_chars > 0 ? Math.ceil(book.total_chars / CHARS_PER_PAGE) : '—';
    var partnerName = yamGetDisplayName(partnerRole);

    // Mettre à jour la barre de progression (div avec background accent)
    var bar = card.querySelector('[style*="background:var(--accent);border-radius:2px"]');
    if (bar) bar.style.width = myPct + '%';

    // Mettre à jour le % affiché
    var pctLabel = card.querySelector('[style*="color:var(--accent);min-width:28px"]');
    if (pctLabel) pctLabel.textContent = myPct + '%';

    // Mettre à jour la ligne partenaire
    var partnerDiv = card.querySelector('[style*="font-size:10px;color:var(--muted)"]');
    if (partnerDiv) {
      var statusColors = { reading: '#22c55e', done: 'var(--accent)', paused: 'var(--muted)' };
      var statusLabels = { reading: 'En cours', done: 'Terminé', paused: 'En pause' };
      partnerDiv.innerHTML = escHtml(partnerName) + ' : p.' + partnerPage + '/' + totalPages +
        ' <span style="color:' + (statusColors[book.status] || 'var(--muted)') + ';font-weight:700;">· ' +
        (statusLabels[book.status] || '') + '</span>';
    }
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
        gutenberg_id:  item.gutenberg_id,
        title:         item.title,
        author:        item.author,
        cover_emoji:   item.cover,
        content_url:   meta.content_url   || '',
        fallback_urls: meta.fallback_urls || [],
        total_chars:   meta.total_chars   || 0,
        chapters:      meta.chapters      || [],
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
        gutenberg_id:  item.gutenberg_id,
        title:         item.title,
        author:        item.author,
        cover_emoji:   '📖',
        content_url:   meta.content_url   || '',
        fallback_urls: meta.fallback_urls || [],
        total_chars:   meta.total_chars   || 0,
        chapters:      meta.chapters      || [],
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

  // Construit les URLs candidates pour un ID Gutenberg donné
  // On stocke toutes les URLs possibles — _bkShowReader les essaie en cascade
  function _bkBuildTextUrls(gutenbergId) {
    var id = gutenbergId;
    return [
      // Cache Gutenberg — CORS autorisé, c'est le plus fiable
      'https://www.gutenberg.org/cache/epub/' + id + '/pg' + id + '.txt',
      // Fichiers directs — patterns classiques Gutenberg
      'https://www.gutenberg.org/files/' + id + '/' + id + '-0.txt',
      'https://www.gutenberg.org/files/' + id + '/' + id + '.txt',
      'https://www.gutenberg.org/files/' + id + '/' + id + '-8.txt',
    ];
  }

  // Récupère la première URL valide via gutendex (pour avoir les vrais formats)
  // + construit les URLs de fallback depuis l'ID
  function _bkFetchGutenbergMeta(gutenbergId, cb) {
    var fallbackUrls = _bkBuildTextUrls(gutenbergId);

    // Essayer gutendex pour avoir l'URL exacte du fichier
    fetch(GUTENDEX_API + gutenbergId + '/')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var formats = data.formats || {};

        function isValidTextUrl(url) {
          if (!url) return false;
          if (url.endsWith('.zip'))    return false;
          if (url.endsWith('.images')) return false;
          if (url.endsWith('.epub'))   return false;
          if (url.endsWith('.mobi'))   return false;
          if (url.endsWith('.html'))   return false; // HTML = CORS problématique
          return true;
        }

        // Priorité : texte brut uniquement
        var gutendexUrl =
          (isValidTextUrl(formats['text/plain; charset=utf-8'])   ? formats['text/plain; charset=utf-8']   : '') ||
          (isValidTextUrl(formats['text/plain; charset=us-ascii']) ? formats['text/plain; charset=us-ascii'] : '') ||
          (isValidTextUrl(formats['text/plain'])                   ? formats['text/plain']                   : '') ||
          '';

        // Mettre l'URL gutendex en tête de liste si elle est valide
        var allUrls = gutendexUrl ? [gutendexUrl].concat(fallbackUrls) : fallbackUrls;
        // Dédupliquer
        var seen = {};
        allUrls = allUrls.filter(function (u) {
          if (seen[u]) return false; seen[u] = true; return true;
        });

        cb({ content_url: allUrls[0], fallback_urls: allUrls.slice(1), total_chars: 0, chapters: [] });
      })
      .catch(function () {
        // Gutendex indisponible → utiliser uniquement les URLs construites
        cb({ content_url: fallbackUrls[0], fallback_urls: fallbackUrls.slice(1), total_chars: 0, chapters: [] });
      });
  }

  function _bkInsertBook(data, cb) {
    var u = yamGetUser();
    if (!u || !u.couple_id) { cb(false); return; }

    // Note: fallback_urls colonne optionnelle — ignorée si elle n'existe pas encore en base
    // Les URLs de fallback sont reconstruites à la volée depuis gutenberg_id
    var payload = {
      couple_id:    u.couple_id,
      source:       'gutenberg',
      gutenberg_id: data.gutenberg_id,
      title:        data.title,
      author:       data.author,
      cover_emoji:  data.cover_emoji,
      content_url:  data.content_url,
      total_chars:  data.total_chars,
      chapters:     JSON.stringify(data.chapters || []),
      added_by:     u.role,
      status:       'reading',
    };

    sb2Post(BK_LIBRARY_TBL, payload)
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

  function _bkOpenReader(book, sessionToJoin, ignoreSync) {
    _bkCurrentBook = book;
    var u = yamGetUser();
    if (!u) return;

    sb2Fetch(BK_READS_TBL, 'couple_id=eq.' + u.couple_id + '&book_id=eq.' + book.id)
      .then(function (rows) {
        _bkReads = {};
        (rows || []).forEach(function (r) { _bkReads[r.player_role] = r; });
        _bkShowReader(book);
        if (sessionToJoin && !ignoreSync) {
          _bkJoinSync(book, sessionToJoin);
        }
        if (ignoreSync) book._ignoreSync = true;
      });
  }

  function _bkShowReader(book) {
    var lib = document.getElementById('bkLibContainer');
    var reader = document.getElementById('bkReader');
    var bookView = document.getElementById('bookView');
    if (lib)    lib.style.display    = 'none';
    if (reader) { reader.style.display = ''; reader.classList.add('bk-reader-visible'); }
    if (bookView) bookView.classList.add('bk-reading');
    haptic('light');

    // Filtrer les URLs invalides : /ebooks/xxx est une page HTML, pas un fichier texte
    function isDirectTextUrl(url) {
      if (!url) return false;
      if (url.indexOf('/ebooks/') !== -1) return false; // page de téléchargement, pas le texte
      if (url.endsWith('.zip'))    return false;
      if (url.endsWith('.images')) return false;
      if (url.endsWith('.epub'))   return false;
      if (url.endsWith('.mobi'))   return false;
      return url.startsWith('http');
    }

    // Construire la liste complète des URLs à essayer
    var builtUrls = book.gutenberg_id ? _bkBuildTextUrls(book.gutenberg_id) : [];
    var allUrls   = [];
    // content_url stocké seulement si c'est une URL directe valide
    if (isDirectTextUrl(book.content_url)) allUrls.push(book.content_url);
    allUrls = allUrls.concat(builtUrls);
    // Dédupliquer
    var seen = {};
    allUrls = allUrls.filter(function (url) {
      if (!url || seen[url]) return false; seen[url] = true; return true;
    });

    if (allUrls.length === 0) {
      _bkRenderReaderShell(book,
        '<div style="padding:24px;text-align:center;color:var(--muted);">Texte non disponible pour ce livre.<br>Essaie un autre titre.</div>');
      return;
    }

    _bkRenderReaderShell(book,
      '<div id="bkTextLoading" style="padding:40px;text-align:center;color:var(--muted);font-size:13px;">' +
      'Chargement du livre…<br><span style="font-size:10px;opacity:.6;">Source : Project Gutenberg</span></div>');

    // Essayer les URLs une par une jusqu'à ce que l'une réponde
    _bkFetchWithFallback(allUrls, 0, function (text, usedUrl) {
      if (!text) {
        var content = document.getElementById('bkTextContent');
        if (content) content.innerHTML =
          '<div style="padding:24px;text-align:center;color:var(--muted);">' +
          'Impossible de charger le texte.<br>' +
          '<span style="font-size:11px;">Toutes les sources ont échoué — vérifie ta connexion.</span></div>';
        return;
      }
      // Mettre à jour content_url avec l'URL qui a marché
      if (usedUrl && usedUrl !== book.content_url) {
        sb2Patch(BK_LIBRARY_TBL, 'id=eq.' + book.id, { content_url: usedUrl }).catch(function () {});
        book.content_url = usedUrl;
      }
      var parsed = _bkParseText(text);
      _bkRenderText(book, parsed);
    });
  }

  // Fetch avec fallback en cascade — essaie chaque URL jusqu'à succès
  // Toutes les URLs Gutenberg passent par corsproxy.io (CORS bloqué nativement)
  function _bkFetchWithFallback(urls, idx, cb) {
    if (idx >= urls.length) { cb(null, null); return; }
    var originalUrl = urls[idx];
    // Wrapper CORS — corsproxy.io retourne directement le contenu texte
    var fetchUrl = originalUrl.indexOf('gutenberg.org') !== -1
      ? CORS_PROXY + encodeURIComponent(originalUrl)
      : originalUrl;

    yamLog('[Books] Essai URL ' + (idx + 1) + '/' + urls.length + ':', originalUrl);

    fetch(fetchUrl)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (text) {
        if (!text || text.trim().length < 100) throw new Error('Contenu trop court');
        cb(text, originalUrl);
      })
      .catch(function (err) {
        yamLog('[Books] URL échouée:', originalUrl, err.message);
        _bkFetchWithFallback(urls, idx + 1, cb);
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

    // Layout : flex column, header fixe, texte scrollable (flex:1), nav fixe en bas
    // IMPORTANT : la nav est un enfant direct du reader, PAS dans bkTextContent
    reader.innerHTML =
      // ── Header ──
      '<div id="bkReaderHeader" style="flex-shrink:0;background:var(--bg);border-bottom:1px solid var(--border);' +
      'padding:calc(var(--safe-top,0px) + 10px) 16px 8px;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<button id="bkBackBtn" style="width:34px;height:34px;border-radius:50%;background:var(--s2);' +
          'border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;">' +
            '<svg width="8" height="14" viewBox="0 0 8 14" style="stroke:var(--text);stroke-width:2;fill:none;stroke-linecap:round;">' +
            '<polyline points="7 1 1 7 7 13"/></svg>' +
          '</button>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
              escHtml(book.title) + '</div>' +
            '<div style="font-size:10px;color:var(--muted);">' + escHtml(book.author) + '</div>' +
          '</div>' +
          '<button id="bkSyncBtn" style="padding:6px 12px;border-radius:20px;font-size:11px;font-weight:700;' +
          'border:1px solid var(--accent);background:var(--accent-s);color:var(--accent);cursor:pointer;' +
          'font-family:DM Sans,sans-serif;flex-shrink:0;">📡 Sync</button>' +
        '</div>' +
        // Barre de progression double
        '<div id="bkProgressWrap" style="margin-top:8px;">' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<span style="font-size:10px;color:var(--text);font-weight:700;min-width:26px;">' + myPct + '%</span>' +
            '<div style="flex:1;height:4px;border-radius:2px;background:var(--border);position:relative;overflow:hidden;">' +
              '<div id="bkMyProg" style="position:absolute;left:0;top:0;bottom:0;width:' + myPct + '%;' +
              'background:var(--accent);border-radius:2px;transition:width .4s;"></div>' +
              '<div id="bkPartnerProg" style="position:absolute;left:0;top:0;bottom:0;width:' + partnerPct + '%;' +
              'background:rgba(231,90,124,.3);border-radius:2px;transition:width .4s;"></div>' +
            '</div>' +
            '<span style="font-size:10px;color:var(--muted);min-width:52px;text-align:right;">' +
              escHtml(partnerName) + ' ' + partnerPct + '%</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // ── Corps texte — flex:1, min-height:0 OBLIGATOIRE pour que flex enfant soit scrollable ──
      '<div id="bkTextContent" style="flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;' +
      'padding:20px 18px 70px;font-size:16px;line-height:1.8;color:var(--text);font-family:Georgia,serif;">' +
        bodyHtml +
      '</div>';
      // Note: la navigation ‹/› est dans #bkGlobalNav (enfant direct de #bookView)
      // Elle s'affiche via .bk-reading sur bookView — pas dans le reader

    // Event listeners shell
    document.getElementById('bkBackBtn').addEventListener('click', _bkCloseReader);
    document.getElementById('bkSyncBtn').addEventListener('click', function () {
      _bkStartSync(book);
    });
  }

  function _bkParseText(raw) {
    var text = raw;

    // Normaliser les fins de ligne
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Supprimer les balises HTML si présent
    if (text.indexOf('<html') !== -1 || text.indexOf('<body') !== -1) {
      var tmp = document.createElement('div');
      tmp.innerHTML = text;
      tmp.querySelectorAll('script,style,head').forEach(function (el) { el.remove(); });
      text = tmp.innerText || tmp.textContent || '';
      text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }

    // Couper AVANT le début réel du texte (sauter l'en-tête Gutenberg)
    var startMarkers = [
      '*** START OF THE PROJECT GUTENBERG',
      '*** START OF THIS PROJECT GUTENBERG',
      '*END*THE SMALL PRINT',
      '***START OF THE PROJECT GUTENBERG',
    ];
    for (var i = 0; i < startMarkers.length; i++) {
      var idx = text.indexOf(startMarkers[i]);
      if (idx !== -1) {
        // Sauter jusqu'à la fin de cette ligne
        var nl = text.indexOf('\n', idx);
        if (nl !== -1) { text = text.slice(nl + 1); break; }
      }
    }

    // Couper APRÈS la fin du texte (pied de page Gutenberg)
    var endMarkers = [
      '*** END OF THE PROJECT GUTENBERG',
      '*** END OF THIS PROJECT GUTENBERG',
      '***END OF THE PROJECT GUTENBERG',
      'End of the Project Gutenberg',
      'End of Project Gutenberg',
    ];
    for (var j = 0; j < endMarkers.length; j++) {
      var endIdx = text.indexOf(endMarkers[j]);
      if (endIdx !== -1) { text = text.slice(0, endIdx); break; }
    }

    // Normaliser les espaces excessifs
    text = text.replace(/\n{4,}/g, '\n\n\n').trim();

    return text;
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

      // Broadcaster la page si mode sync actif et hôte
      if (_bkSyncActive && _bkIsHost) {
        _bkBroadcastPage(pageIdx);
      }

      // Scroll haut
      content.scrollTop = 0;
    }

    // Exposer renderPage pour que le mode sync puisse sauter à une page
    _bkCurrentRenderPage = renderPage;

    // Navigation — bloquée fonctionnellement ET visuellement pour le suiveur
    var prevBtn = document.getElementById('bkPrevPage');
    var nextBtn = document.getElementById('bkNextPage');
    if (prevBtn) prevBtn.addEventListener('click', function () {
      if (_bkSyncActive && !_bkIsHost) return;
      haptic('light'); renderPage(currentPage - 1);
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
      if (_bkSyncActive && !_bkIsHost) return;
      haptic('light'); renderPage(currentPage + 1);
    });

    renderPage(currentPage);

    // Vérifier session sync sauf si mode solo
    if (!book._ignoreSync) {
      _bkCheckExistingSession(book);
    }
    book._ignoreSync = false;
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

  var _bkSyncRTChannel = null;

  function _bkStartSync(book) {
    if (_bkSyncActive) { _bkStopSyncSession(); return; }
    var u = yamGetUser();
    if (!u) return;
    var partnerRole = u.role === 'girl' ? 'boy' : 'girl';
    var partnerName = yamGetDisplayName(partnerRole);

    // Refetch la session en base — évite la double session si partenaire déjà hôte
    sb2Fetch(BK_SESSIONS_TBL, 'couple_id=eq.' + u.couple_id + '&status=eq.active')
      .then(function(sessions) {
        var existing = sessions && sessions[0];
        if (existing && existing.created_by !== u.role) {
          var sessionBook = _bkLibrary.find(function(b){ return b.id === existing.book_id; });
          var bookTitle = sessionBook ? '"' + sessionBook.title + '"' : 'un autre livre';
          showToast('📡 ' + partnerName + ' est déjà en session sur ' + bookTitle + ' — rejoins-la !', 'error', 4000);
          return;
        }

        _bkSyncActive = true;
        _bkIsHost     = true;

        var label = document.getElementById('bkPageLabel');
        var match = label ? label.textContent.match(/Page (\d+)/) : null;
        var currentPage = match ? parseInt(match[1], 10) - 1 : 0;

        fetch(SB_URL + '/rest/v1/' + BK_SESSIONS_TBL + '?on_conflict=couple_id', {
          method: 'POST',
          headers: sb2Headers({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify({
            couple_id: u.couple_id, book_id: book.id, created_by: u.role,
            status: 'active',
            state: JSON.stringify({ current_page: currentPage, book_id: book.id }),
            updated_at: new Date().toISOString(),
          }),
        }).catch(function(e){ yamLog('[Sync] upsert error:', e); });

        _bkShowSyncBanner(book, partnerName, true);
        _bkSubscribeSyncRT(book, u);
        showToast('📡 Session lancée — en attente de ' + partnerName, 'success', 3000);
        haptic('success');
      }).catch(function() {
        _bkSyncActive = true; _bkIsHost = true;
        _bkShowSyncBanner(book, partnerName, true);
        _bkSubscribeSyncRT(book, u);
      });
  }

  function _bkJoinSync(book, sessionRow) {
    if (_bkSyncActive) return; // guard double join
    var u = yamGetUser();
    if (!u) return;
    _bkSyncActive = true;
    _bkIsHost     = false;
    var partnerName = yamGetDisplayName(u.role === 'girl' ? 'boy' : 'girl');
    var state = typeof sessionRow.state === 'string' ? JSON.parse(sessionRow.state) : (sessionRow.state || {});

    _bkShowSyncBanner(book, partnerName, false);
    _bkSubscribeSyncRT(book, u);
    showToast('📡 Rejoint la session de ' + partnerName, 'success', 2500);
    haptic('success');

    // Aller à la page de l'hôte avec retry (texte peut ne pas être chargé)
    if (state.current_page !== undefined) {
      var tp = state.current_page;
      function tryGo(n) {
        if (typeof _bkCurrentRenderPage === 'function') { _bkCurrentRenderPage(tp); }
        else if (n > 0) { setTimeout(function(){ tryGo(n-1); }, 400); }
      }
      tryGo(10);
    }
  }

  function _bkSubscribeSyncRT(book, u) {
    if (_bkSyncRTChannel) {
      try { _bkSyncRTChannel.untrack(); } catch(e){}
      try { _bkSyncRTChannel.unsubscribe(); } catch(e){}
      _bkSyncRTChannel = null;
    }
    var rt = window._yamRT || window.yamRT;
    if (!rt) { yamLog('[Sync] RT non disponible'); return; }

    var partnerRole = u.role === 'girl' ? 'boy' : 'girl';
    var partnerName = yamGetDisplayName(partnerRole);

    _bkSyncRTChannel = rt.channel('bk-sync-' + u.couple_id)

      // ── Présence native — détection instantanée connexion/déco ──
      .on('presence', { event: 'sync' }, function() {
        var st = _bkSyncRTChannel.presenceState();
        var on = Object.keys(st).some(function(k) {
          return Array.isArray(st[k]) && st[k].some(function(p){ return p.role === partnerRole; });
        });
        _bkUpdateSyncBannerStatus(on);
      })
      .on('presence', { event: 'join' }, function(payload) {
        var joined = payload.newPresences || [];
        if (joined.some(function(p){ return p.role === partnerRole; })) _bkUpdateSyncBannerStatus(true);
      })
      .on('presence', { event: 'leave' }, function(payload) {
        var left = payload.leftPresences || [];
        if (left.some(function(p){ return p.role === partnerRole; })) {
          _bkUpdateSyncBannerStatus(false);
          if (!_bkIsHost) {
            showToast('📖 ' + partnerName + ' a quitté la session', '', 3000);
            _bkStopSyncSession();
          }
        }
      })

      // ── postgres_changes UPDATE — synchronisation des pages ──
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: BK_SESSIONS_TBL,
        filter: 'couple_id=eq.' + u.couple_id,
      }, function(payload) {
        var row = payload.new;
        if (!row || row.book_id !== book.id) return;
        if (!_bkIsHost) {
          var st = typeof row.state === 'string' ? JSON.parse(row.state) : (row.state || {});
          if (st.current_page !== undefined) {
            var tp = st.current_page;
            function tryJ(n) {
              if (typeof _bkCurrentRenderPage === 'function') { _bkCurrentRenderPage(tp); }
              else if (n > 0) { setTimeout(function(){ tryJ(n-1); }, 300); }
            }
            tryJ(5);
          }
        }
      })

      // ── DELETE — leader a quitté (requiert REPLICA IDENTITY FULL) ──
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public',
        table: BK_SESSIONS_TBL,
        filter: 'couple_id=eq.' + u.couple_id,
      }, function() {
        if (!_bkIsHost) {
          showToast('📖 ' + partnerName + ' a terminé la session', '', 3000);
          _bkStopSyncSession();
        }
      })

      .subscribe(function(status) {
        if (status === 'SUBSCRIBED') {
          _bkSyncRTChannel.track({ role: u.role, book_id: book.id });
        }
      });
  }

  // Broadcaster la page courante (appelé à chaque tournée de page par l'hôte)
  function _bkBroadcastPage(pageIdx) {
    if (!_bkSyncActive || !_bkIsHost) return;
    var u = yamGetUser();
    if (!u) return;
    fetch(SB_URL + '/rest/v1/' + BK_SESSIONS_TBL + '?couple_id=eq.' + u.couple_id, {
      method: 'PATCH',
      headers: sb2Headers({ 'Prefer': 'return=minimal' }),
      body: JSON.stringify({
        state:      JSON.stringify({ current_page: pageIdx, book_id: _bkCurrentBook ? _bkCurrentBook.id : null }),
        updated_at: new Date().toISOString(),
      }),
    }).catch(function(e){ yamLog('[Sync] broadcast error:', e); });
  }

  function _bkGoToPage(pageIdx) {
    if (typeof _bkCurrentRenderPage === 'function') _bkCurrentRenderPage(pageIdx);
  }

  function _bkShowSyncBanner(book, partnerName, isHost) {
    var readerHeader = document.getElementById('bkReaderHeader');
    if (!readerHeader) return;
    var old = document.getElementById('bkSyncBanner');
    if (old) old.remove();

    var banner = document.createElement('div');
    banner.id = 'bkSyncBanner';
    banner.dataset.isHost      = isHost ? '1' : '0';
    banner.dataset.partnerName = partnerName;
    // Fond neutre, texte normal — dot gris par défaut, vert quand partenaire détecté
    banner.style.cssText = 'flex-shrink:0;background:var(--s2);border-bottom:1px solid var(--border);' +
      'padding:5px 12px;display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text);font-weight:600;';
    banner.innerHTML =
      '<span id="bkSyncDot" style="width:7px;height:7px;border-radius:50%;flex-shrink:0;' +
      'background:var(--muted);transition:background .3s;"></span>' +
      '<span id="bkSyncLabel" style="flex:1;">' +
        escHtml(isHost ? '📡 En attente de ' + partnerName + '…' : '📡 Connexion…') +
      '</span>' +
      '<button id="bkSyncStopBtn" style="padding:2px 8px;border-radius:12px;border:1px solid var(--border);' +
      'background:none;color:var(--muted);font-size:10px;font-weight:700;cursor:pointer;' +
      'font-family:DM Sans,sans-serif;white-space:nowrap;">Quitter</button>';

    readerHeader.after(banner);
    document.getElementById('bkSyncStopBtn').addEventListener('click', _bkStopSyncSession);

    // Griser les boutons nav pour le suiveur
    if (!isHost) _bkSetNavButtonsEnabled(false);
  }

  function _bkSetNavButtonsEnabled(enabled) {
    ['bkPrevPage', 'bkNextPage'].forEach(function(id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.style.opacity = enabled ? '' : '0.3';
      btn.style.cursor  = enabled ? '' : 'not-allowed';
      btn.title = enabled ? '' : 'Le leader tourne les pages';
    });
  }

  function _bkUpdateSyncBannerStatus(online) {
    var dot    = document.getElementById('bkSyncDot');
    var label  = document.getElementById('bkSyncLabel');
    var banner = document.getElementById('bkSyncBanner');
    if (!dot || !label || !banner) return;
    var isHost      = banner.dataset.isHost === '1';
    var partnerName = banner.dataset.partnerName || '';
    if (online) {
      dot.style.background = '#22c55e';
      dot.style.animation  = 'cwLiveDot 1.6s ease-in-out infinite';
      label.textContent    = '📡 En sync avec ' + partnerName + (isHost ? ' · vous guidez' : ' · vous suivez');
    } else {
      dot.style.background = 'var(--muted)'; // gris
      dot.style.animation  = 'none';
      label.textContent    = '⚠️ ' + partnerName + ' hors ligne';
    }
  }

  function _bkStopSyncSession() {
    if (_bkSyncRTChannel) {
      try { _bkSyncRTChannel.untrack(); } catch(e){}
      try { _bkSyncRTChannel.unsubscribe(); } catch(e){}
      _bkSyncRTChannel = null;
    }
    // Hôte → supprimer la session (REPLICA IDENTITY FULL requis pour RT DELETE)
    if (_bkSyncActive && _bkIsHost) {
      var u = yamGetUser();
      if (u) {
        fetch(SB_URL + '/rest/v1/' + BK_SESSIONS_TBL + '?couple_id=eq.' + u.couple_id, {
          method: 'DELETE', headers: sb2Headers(),
        }).catch(function(){});
      }
    }
    _bkSyncActive = false;
    _bkIsHost     = false;

    var banner = document.getElementById('bkSyncBanner');
    if (banner) banner.remove();

    _bkSetNavButtonsEnabled(true);

    var reader = document.getElementById('bkReader');
    if (reader && reader.classList.contains('bk-reader-visible') && _bkCurrentBook) {
      showToast('Session sync terminée', '', 2000);
    }
  }

  // Vérifier si session active du partenaire → toast Oui/Non
  function _bkCheckExistingSession(book) {
    if (_bkSyncActive) return; // déjà en session
    var u = yamGetUser();
    if (!u) return;
    sb2Fetch(BK_SESSIONS_TBL,
      'couple_id=eq.' + u.couple_id + '&book_id=eq.' + book.id + '&status=eq.active'
    ).then(function(rows) {
      if (!rows || rows.length === 0) return;
      var session = rows[0];
      if (session.created_by === u.role) return;
      if (_bkSyncActive) return; // double check
      var partnerName = yamGetDisplayName(u.role === 'girl' ? 'boy' : 'girl');

      var toastEl = document.getElementById('bkJoinToast');
      if (toastEl) toastEl.remove();
      var toast = document.createElement('div');
      toast.id = 'bkJoinToast';
      toast.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);' +
        'z-index:9999;background:var(--accent);color:#fff;border-radius:14px;' +
        'padding:10px 14px;font-size:13px;font-weight:700;font-family:DM Sans,sans-serif;' +
        'display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,.2);white-space:nowrap;';
      toast.innerHTML =
        '<span>📡 ' + escHtml(partnerName) + ' lit en sync — rejoindre ?</span>' +
        '<button id="bkJoinYes" style="padding:4px 12px;border-radius:20px;background:#fff;' +
        'color:var(--accent);font-size:12px;font-weight:800;border:none;cursor:pointer;font-family:DM Sans,sans-serif;">Oui</button>' +
        '<button id="bkJoinNo" style="padding:4px 8px;border-radius:20px;background:rgba(255,255,255,.2);' +
        'color:#fff;font-size:12px;font-weight:700;border:none;cursor:pointer;font-family:DM Sans,sans-serif;">✕</button>';
      document.body.appendChild(toast);

      var timer = setTimeout(function(){ toast.remove(); }, 8000);
      document.getElementById('bkJoinYes').onclick = function() {
        clearTimeout(timer); toast.remove();
        if (!_bkSyncActive) _bkJoinSync(book, session);
      };
      document.getElementById('bkJoinNo').onclick = function() {
        clearTimeout(timer); toast.remove();
      };
    }).catch(function(){});
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
        '#bkReader{flex:1;min-height:0;flex-direction:column;}' +
        '#bkReader:not(.bk-reader-visible){display:none !important;}' +
        '#bkReader.bk-reader-visible{display:flex !important;}' +
        '#bkReader.sync-active{border-top:2px solid var(--accent);}' +
        /* Quand reader visible : cacher le header biblio + la nav est dans bookView */
        '#bookView.bk-reading #bkHeader{display:none !important;}' +
        '#bookView.bk-reading #bkLibContainer{display:none !important;}' +
        '#bkTextContent{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;min-height:0;padding-bottom:60px;}' +
        '#bkGlobalNav{flex-shrink:0;background:var(--bg);border-top:1px solid var(--border);' +
        'padding:8px 16px calc(var(--safe-bottom,0px) + 45px);display:none;align-items:center;gap:10px;}' +
        '#bookView.bk-reading #bkGlobalNav{display:flex;}' +
        '.bk-card-row:active{background:var(--s2) !important;}' +
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

      // Conteneur reader (sans nav — la nav est dans bookView)
      '<div id="bkReader" style="flex:1;overflow:hidden;flex-direction:column;"></div>' +

      // Navigation pages — enfant direct de bookView, affiché uniquement en mode lecture
      '<div id="bkGlobalNav">' +
        '<button id="bkPrevPage" style="padding:9px 20px;border-radius:20px;background:var(--s2);' +
        'border:1px solid var(--border);font-size:13px;color:var(--text);cursor:pointer;' +
        'font-family:DM Sans,sans-serif;font-weight:600;">‹ Préc.</button>' +
        '<div id="bkPageLabel" style="flex:1;text-align:center;font-size:11px;color:var(--muted);"></div>' +
        '<button id="bkNextPage" style="padding:9px 20px;border-radius:20px;background:var(--s2);' +
        'border:1px solid var(--border);font-size:13px;color:var(--text);cursor:pointer;' +
        'font-family:DM Sans,sans-serif;font-weight:600;">Suiv. ›</button>' +
      '</div>';

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
    // Stopper la sync si active
    if (_bkSyncActive) _bkStopSyncSession();
    // Nettoyer le channel RT book_reads
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
