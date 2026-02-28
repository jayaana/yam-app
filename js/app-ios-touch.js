// ═══════════════════════════════════════════════════════════════════════════
// app-ios-touch.js — Système unifié de gestion tactile et clavier iOS
// Chargé EN PREMIER (avant app-core.js) dans index.html
//
// CE FICHIER EST L'UNIQUE SOURCE DE VÉRITÉ pour :
//   1. Pull-to-refresh blocker
//   2. Swipe de bord gauche/droit (navigation système)
//   3. Clavier iOS — repositionnement de TOUS les conteneurs actifs
//   4. Scroll background blocker dans les modales
//   5. Sélection de texte — toujours autorisée partout
//
// RÈGLE : aucun autre fichier ne doit créer de listener
//   visualViewport, touchmove global avec passive:false,
//   ou modifier le meta viewport.
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // CONFIG — modifier ici si la structure HTML change
  // ─────────────────────────────────────────────────────────────

  var NAV_HEIGHT = 64; // hauteur bottom-nav en px

  // Conteneurs "flottants" qui doivent suivre le clavier quand il s'ouvre.
  // Format : { id, mode }
  //   mode 'sheet'  : la sheet interne (.nous-modal-sheet) translate vers le haut
  //   mode 'popup'  : popup petit format repositionné en top/left absolus (lockPopup)
  var KEYBOARD_TARGETS = [
    // hiddenPage : monte via bottom + dmKeyboardBg couvre la nav
    { id: 'hiddenPage', mode: 'bottom', bgId: 'dmKeyboardBg' },

    // Sheets (bottom sheet — translateY vers le haut)
    // Les .nous-modal-overlay.open sont gérés dynamiquement
    { id: 'accountModal',          mode: 'sheet'  },
    { id: 'descEditModal',         mode: 'sheet'  },

    // Boîtes centrées (inset:0 + justify-content:center — translateY vers le haut)
    { id: 'v2LoginOverlay',        mode: 'center', inner: 'v2LoginBox'    },
    { id: 'sgModal',               mode: 'center', inner: 'sg-modal-inner' },
    { id: 'sgEditModal',           mode: 'center', inner: 'sg-modal-inner' },
    { id: 'prankMsgModal',         mode: 'center', inner: null             },

    // Boîtes centrées supplémentaires
    { id: 'sgAuthModal',           mode: 'center', inner: 'memo-auth-inner' },

    // Bottom-sheet supplémentaire
    { id: 'searchOverlay',         mode: 'sheet',  inner: 'search-popup'   },

    // Popup petit format (repositionnement absolu top/left)
    { id: 'lockPopup',             mode: 'popup'  },
  ];

  // Sélecteur CSS des overlays Nous (détectés dynamiquement à chaque event)
  var NOUS_OVERLAY_SELECTOR = '.nous-modal-overlay.open';

  // IDs de toutes les modales/overlays dont on doit bloquer le scroll de fond
  // (empêche la page derrière de scroller quand on swipe à l'intérieur)
  // SCROLL_LOCK_OVERLAYS supprimé — scroll lock géré globalement via _yamScrollLocked

  // ─────────────────────────────────────────────────────────────
  // UTILITAIRES INTERNES
  // ─────────────────────────────────────────────────────────────

  function isInput(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  // Remonte la chaîne DOM pour trouver un ancêtre scrollable
  function findScrollableAncestor(el) {
    var node = el;
    while (node && node !== document.body) {
      var style = window.getComputedStyle(node);
      var oy = style.overflowY;
      if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  // Détecte si le visualViewport est disponible
  var HAS_VV = !!window.visualViewport;

  // Calcule la hauteur du clavier (0 si fermé)
  function getKeyboardHeight() {
    if (!HAS_VV) return 0;
    var vv = window.visualViewport;
    return Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  }


  // ─────────────────────────────────────────────────────────────
  // 1. PULL-TO-REFRESH BLOCKER
  // Bloque uniquement le geste pull-to-refresh natif du navigateur.
  // N'interfère jamais avec la sélection de texte ni le scroll normal.
  // ─────────────────────────────────────────────────────────────

  var _ptrStartY  = 0;
  var _ptrStartX  = 0;
  var _ptrStartT  = 0;
  var _ptrCanBlock = false;

  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { _ptrCanBlock = false; return; }
    _ptrStartY   = e.touches[0].clientY;
    _ptrStartX   = e.touches[0].clientX;
    _ptrStartT   = Date.now();
    // On ne peut bloquer que si on est tout en haut ET que c'est un geste vers le bas
    _ptrCanBlock = (window.scrollY === 0);
  }, { passive: true }); // toujours passive au touchstart

  document.addEventListener('touchmove', function (e) {
    if (!_ptrCanBlock) return;
    if (e.touches.length !== 1) return;

    var t  = e.touches[0];
    var dy = t.clientY - _ptrStartY;
    var dx = t.clientX - _ptrStartX;

    // ── Jamais bloquer si : ──
    // a) cible = input/textarea
    if (isInput(e.target)) return;
    // b) geste majoritairement horizontal (sélection de texte latérale)
    if (Math.abs(dx) > Math.abs(dy) + 8) return;
    // c) longpress (>380ms) = sélection de texte
    if (Date.now() - _ptrStartT > 380) return;
    // d) zone scrollable interne
    if (findScrollableAncestor(e.target)) return;
    // e) une modale est ouverte (elle gère son propre scroll)
    if (document.querySelector('.nous-modal-overlay.open')) return;
    if (document.querySelector('.modal-overlay.open')) return;

    // Bloquer uniquement le pull-to-refresh (vers le bas depuis le haut de page)
    if (dy > 0 && window.scrollY === 0) {
      e.preventDefault();
    }
  }, { passive: false }); // passive:false nécessaire pour pouvoir preventDefault

  document.addEventListener('touchend', function () {
    _ptrCanBlock = false;
  }, { passive: true });


  // ─────────────────────────────────────────────────────────────
  // 2. SWIPE DE BORD — bloque la navigation système Chrome/Safari
  // (swipe depuis <20px du bord gauche ou droit → navigation arrière/avant)
  // ─────────────────────────────────────────────────────────────

  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    var x = e.touches[0].clientX;
    if (x < 20 || x > window.innerWidth - 20) {
      e.preventDefault();
    }
  }, { passive: false });


  // ─────────────────────────────────────────────────────────────
  // 3. CLAVIER iOS — repositionnement unifié
  //
  // Sur iOS, quand le clavier s'ouvre :
  //   - window.innerHeight reste identique (layout viewport)
  //   - visualViewport.height diminue de la hauteur du clavier
  //
  // Stratégie par mode :
  //   'sheet'  : la sheet interne translate vers le haut via transform
  //   'popup'  : repositionnement absolu top/left (lockPopup)
  //   Overlays .nous-modal-overlay.open : détectés dynamiquement, mode sheet
  // ─────────────────────────────────────────────────────────────

  function _applyKeyboard() {
    if (!HAS_VV) return;
    var vv      = window.visualViewport;
    var kbH     = getKeyboardHeight();
    var isOpen  = kbH > 80;

    // ── Cibles statiques ──
    KEYBOARD_TARGETS.forEach(function (cfg) {
      var el = document.getElementById(cfg.id);
      if (!el) return;

      var visible = el.classList.contains('active') ||
                    el.classList.contains('open')   ||
                    el.style.display === 'flex'     ||
                    el.style.display === 'block';
      if (!visible) return;

      if (cfg.mode === 'bottom') {
        // hiddenPage : monte via bottom, dmKeyboardBg couvre la nav
        var visible = el.classList.contains('active');
        if (!visible) return;
        el.style.bottom = isOpen ? kbH + 'px' : '';
        var bg = cfg.bgId ? document.getElementById(cfg.bgId) : null;
        if (bg) {
          bg.style.height = isOpen ? (kbH + NAV_HEIGHT) + 'px' : '';
          bg.classList.toggle('on', isOpen);
        }
        // Scroller les messages vers le bas
        if (isOpen) {
          var msgs = document.getElementById('dmMessages');
          if (msgs) setTimeout(function() { msgs.scrollTop = msgs.scrollHeight; }, 80);
        }

      } else if (cfg.mode === 'sheet') {
        // Modale avec sheet : translate la sheet vers le haut de kbH px.
        // L'overlay est inset:0, le clavier couvre la nav naturellement.
        var sheet = cfg.inner
          ? (el.querySelector('.' + cfg.inner) || el.querySelector('#' + cfg.inner))
          : (el.querySelector('.nous-modal-sheet, .modal-sheet, .account-sheet, .desc-edit-sheet, .search-popup, [id$="Sheet"]') || el);
        if (!sheet) sheet = el;
        if (isOpen) {
          sheet.style.transform  = 'translateY(-' + kbH + 'px)';
          sheet.style.transition = 'transform 0.25s ease';
          sheet.style.maxHeight  = (vv.height - 24) + 'px';
          var focused = document.activeElement;
          if (focused && isInput(focused) && el.contains(focused)) {
            setTimeout(function () {
              focused.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }, 80);
          }
        } else {
          sheet.style.transform  = '';
          sheet.style.transition = '';
          sheet.style.maxHeight  = '';
        }

      } else if (cfg.mode === 'center') {
        // Boîte centrée : on translate le conteneur interne vers le haut
        // pour qu'il reste visible au-dessus du clavier
        var inner = cfg.inner
          ? (el.querySelector('.' + cfg.inner) || el.querySelector('#' + cfg.inner) || el)
          : el;
        if (isOpen) {
          // Estimer de combien on doit remonter : moitié de la hauteur clavier
          // (la boîte était au centre, elle doit remonter dans la zone visible)
          var boxH   = inner.offsetHeight || 300;
          var visibleH = window.innerHeight - kbH;
          var currentTop = visibleH / 2 - boxH / 2; // position naturelle du haut de la boîte
          if (currentTop < 20) {
            // La boîte déborde en haut — pas de translation possible
            inner.style.transform  = '';
            inner.style.transition = '';
          } else {
            var shift2 = Math.min(kbH / 2, currentTop - 20);
            inner.style.transform  = 'translateY(-' + shift2 + 'px)';
            inner.style.transition = 'transform 0.25s ease';
          }
          // Scroll l'input actif dans la zone visible
          var focused2 = document.activeElement;
          if (focused2 && isInput(focused2) && el.contains(focused2)) {
            setTimeout(function () {
              focused2.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }, 80);
          }
        } else {
          inner.style.transform  = '';
          inner.style.transition = '';
        }

      } else if (cfg.mode === 'popup') {
        // Petit popup : repositionnement absolu calé sur le visual viewport
        if (isOpen) {
          var vvBottom = vv.offsetTop + vv.height;
          var popH = el.offsetHeight || 120;
          var popW = el.offsetWidth  || 230;
          var topPx  = vvBottom - popH - 12;
          var leftPx = vv.offsetLeft + vv.width - popW - 10;
          el.style.bottom = 'auto';
          el.style.top    = Math.max(8, topPx)  + 'px';
          el.style.left   = Math.max(8, leftPx) + 'px';
          el.style.right  = 'auto';
        } else {
          el.style.bottom = '80px';
          el.style.right  = '8px';
          el.style.top    = 'auto';
          el.style.left   = 'auto';
        }
      }
    });

    // ── Cibles dynamiques : .nous-modal-overlay.open ──
    // La sheet a margin-bottom:nav-height — elle est déjà au-dessus de la nav.
    // On translate uniquement de la partie que le clavier couvre au-dessus de la nav.
    document.querySelectorAll(NOUS_OVERLAY_SELECTOR).forEach(function (overlay) {
      var sheet = overlay.querySelector('.nous-modal-sheet');
      if (!sheet) return;
      if (isOpen) {
        var shift = Math.max(0, kbH - NAV_HEIGHT);
        sheet.style.transform  = shift > 0 ? 'translateY(-' + shift + 'px)' : '';
        sheet.style.transition = 'transform 0.25s ease';
        var focused = document.activeElement;
        if (focused && isInput(focused) && overlay.contains(focused)) {
          setTimeout(function () {
            focused.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 80);
        }
      } else {
        sheet.style.transform  = '';
        sheet.style.transition = '';
      }
    });
  }

  // Écoute le visual viewport avec debounce (évite les appels en rafale)
  if (HAS_VV) {
    var _kbTimer = null;
    function _scheduleKeyboard() {
      if (_kbTimer) cancelAnimationFrame(_kbTimer);
      _kbTimer = requestAnimationFrame(function () {
        _kbTimer = null;
        _applyKeyboard();
      });
    }
    window.visualViewport.addEventListener('resize', _scheduleKeyboard);
    window.visualViewport.addEventListener('scroll', _scheduleKeyboard);
  }

  // API publique — les autres fichiers appellent ceci pour déclencher un recalcul
  // (ex: app-messages.js lors de l'ouverture de hiddenPage)
  window._yamKeyboardUpdate = _applyKeyboard;

  // Compat : ancienne référence utilisée par app-messages.js
  // hiddenPage ne remonte plus — _dmUpdateVP ne fait rien pour lui.
  window._dmUpdateVP = function() { _applyKeyboard(); };

  // Compat : ancienne référence utilisée par app-nav.js pour lockPopup
  window._positionLockPopup = function () { _applyKeyboard(); };


  // ─────────────────────────────────────────────────────────────
  // 4. SCROLL BACKGROUND BLOCKER
  //
  // Quand une modale est ouverte, le fond de l'overlay doit être
  // "mort" (pas de scroll de la page principale derrière).
  // La sheet interne (zone scrollable) reste scroll-able.
  //
  // On n'attache PAS ce listener sur les inputs/textareas.
  // On n'interfère jamais avec la sélection de texte.
  // ─────────────────────────────────────────────────────────────

  // ─── Scroll lock global ───
  // Sur iOS PWA, overflow:hidden sur body ne suffit pas à bloquer le scroll
  // quand des éléments fixed sont ouverts. On utilise un listener sur document
  // piloté par le flag window._yamScrollLocked posé par app-nous.js.

  var _sbt = 0, _sbx = 0, _sby = 0;

  function _docScrollBlock(e) {
    if (!window._yamScrollLocked) return;

    var target = e.target;

    // Toujours laisser passer sur input/textarea
    if (isInput(target)) return;

    // Laisser passer si geste horizontal (sélection de texte)
    if (e.touches && e.touches.length === 1) {
      var dx = Math.abs(e.touches[0].clientX - _sbx);
      var dy = Math.abs(e.touches[0].clientY - _sby);
      if (dx > dy + 8) return;
    }

    // Laisser passer si longpress (sélection de texte iOS)
    if (Date.now() - _sbt > 380) return;

    // Laisser passer si zone scrollable interne (sheet, liste...)
    if (findScrollableAncestor(target)) return;

    // Bloquer tout le reste
    e.preventDefault();
  }

  document.addEventListener('touchstart', function(e) {
    _sbt = Date.now();
    if (e.touches && e.touches.length === 1) {
      _sbx = e.touches[0].clientX;
      _sby = e.touches[0].clientY;
    }
  }, { passive: true });

  document.addEventListener('touchmove', _docScrollBlock, { passive: false });

  // Compat : API publique conservée mais ne fait plus rien (géré globalement)
  window._yamRegisterScrollLock = function () {};

  // ─────────────────────────────────────────────────────────────
  // 5. SÉLECTION DE TEXTE — garantie universelle
  //
  // Certains éléments parents ont user-select:none hérité.
  // On force user-select:text sur tous les inputs/textareas via JS
  // en complément du CSS (double sécurité).
  // ─────────────────────────────────────────────────────────────

  function _ensureTextSelection() {
    var selectors = 'input, textarea, [contenteditable]';
    document.querySelectorAll(selectors).forEach(function (el) {
      el.style.webkitUserSelect = 'text';
      el.style.userSelect = 'text';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _ensureTextSelection);
  } else {
    setTimeout(_ensureTextSelection, 0);
  }

  // MutationObserver : applique aussi aux inputs créés dynamiquement
  var _selObs = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (isInput(node)) {
          node.style.webkitUserSelect = 'text';
          node.style.userSelect = 'text';
        }
        node.querySelectorAll && node.querySelectorAll('input, textarea').forEach(function (el) {
          el.style.webkitUserSelect = 'text';
          el.style.userSelect = 'text';
        });
      });
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      _selObs.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    _selObs.observe(document.body, { childList: true, subtree: true });
  }

})();
