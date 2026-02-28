// ═══════════════════════════════════════════════════════════════════════════
// app-ios-touch.js — Système unifié tactile & clavier iOS — Source unique
// Version définitive — chargé EN PREMIER dans index.html
//
// CE FICHIER EST L'UNIQUE SOURCE DE VÉRITÉ pour :
//   1. Pull-to-refresh blocker (empêche le rechargement natif navigateur)
//   2. Swipe de bord gauche/droit (bloque la navigation système)
//   3. Clavier iOS — repositionnement de TOUS les conteneurs actifs,
//      généralisé à TOUTE l'app (hiddenPage, modales Nous, account, login,
//      sg, pranks, search, lockPopup)
//   4. Scroll background blocker (empêche le fond de scroller sous les modales)
//   5. Sélection de texte — toujours autorisée partout sur tous les inputs
//
// RÈGLE ABSOLUE : aucun autre fichier JS ne doit :
//   - créer un listener visualViewport
//   - créer un listener touchmove global avec passive:false
//   - modifier document.body.style.position / overflow / width
//   - modifier le meta viewport (maximum-scale etc.)
//
// COMPORTEMENT CLAVIER VOULU (comme iMessage / WhatsApp) :
//   - hiddenPage  → la dm-input-bar remonte exactement de la hauteur du clavier
//                   via padding-bottom dynamique ; le clavier couvre la nav
//   - Modales Nous (.nous-modal-overlay.open) → la sheet translate vers le
//                   haut du montant que le clavier empiète sur elle
//   - accountModal / descEditModal / searchOverlay → même translateY que sheets
//   - v2LoginOverlay / sgModal / sgEditModal / sgAuthModal / prankMsgModal →
//                   boîtes centrées : translateY vers le haut pour rester visibles
//   - lockPopup → repositionnement absolu calé sur le visual viewport
//   La nav reste TOUJOURS à sa place — le clavier passe par-dessus elle.
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIG — une seule constante à ajuster si le CSS change
  // ─────────────────────────────────────────────────────────────────────────

  // Hauteur de la bottom-nav en px (doit correspondre à --nav-height dans le CSS)
  var NAV_HEIGHT = 64;

  // ─────────────────────────────────────────────────────────────────────────
  // CATALOGUE DES CIBLES CLAVIER — format :
  //   id      : ID de l'élément container
  //   mode    : 'bottom'  → hiddenPage (padding-bottom sur dm-input-bar)
  //             'sheet'   → bottom-sheet (translateY sur la sheet interne)
  //             'center'  → boîte centrée (translateY sur le contenu interne)
  //             'popup'   → petit popup repositionné en absolu
  //   inner   : sélecteur CSS de l'élément interne à déplacer (optionnel)
  //   active  : function(el) → true si le conteneur est actuellement visible
  //             (si absent : vrai si .open / .active / display:flex/block)
  // ─────────────────────────────────────────────────────────────────────────

  var KEYBOARD_TARGETS = [
    // ── Messages (InstaLove) ──
    // hiddenPage s'étend de top:0 à bottom:0 (inset:0 via CSS).
    // La nav est derrière (z-index 1000 < 1100).
    // Comportement : padding-bottom sur .dm-input-bar = kbH quand clavier ouvert.
    {
      id: 'hiddenPage',
      mode: 'bottom',
      active: function (el) { return el.classList.contains('active'); }
    },

    // ── Bottom-sheets statiques ──
    { id: 'accountModal',  mode: 'sheet' },
    { id: 'descEditModal', mode: 'sheet' },
    { id: 'searchOverlay', mode: 'sheet', inner: '.search-popup' },

    // ── Boîtes centrées ──
    { id: 'v2LoginOverlay', mode: 'center', inner: '#v2LoginBox'       },
    { id: 'sgModal',        mode: 'center', inner: '.sg-modal-inner'   },
    { id: 'sgEditModal',    mode: 'center', inner: '.sg-modal-inner'   },
    { id: 'sgAuthModal',    mode: 'center', inner: '.memo-auth-inner'  },
    { id: 'prankMsgModal',  mode: 'center', inner: null                },

    // ── Popup petit format ──
    { id: 'lockPopup', mode: 'popup' }
  ];

  // Sélecteur des overlays Nous détectés dynamiquement
  var NOUS_OVERLAY_SEL = '.nous-modal-overlay.open';

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITAIRES
  // ─────────────────────────────────────────────────────────────────────────

  function isInput(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      || el.isContentEditable;
  }

  function findScrollableAncestor(el) {
    var node = el;
    while (node && node !== document.body) {
      var oy = window.getComputedStyle(node).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  var HAS_VV = !!window.visualViewport;

  function getKeyboardHeight() {
    if (!HAS_VV) return 0;
    var vv = window.visualViewport;
    return Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  }

  function isVisible(el, cfg) {
    if (cfg.active) return cfg.active(el);
    return el.classList.contains('active')
      || el.classList.contains('open')
      || el.style.display === 'flex'
      || el.style.display === 'block';
  }

  function scrollActiveInputIntoView(container, delay) {
    var focused = document.activeElement;
    if (!focused || !isInput(focused)) return;
    if (!container.contains(focused))  return;
    setTimeout(function () {
      focused.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, delay || 80);
  }


  // ═════════════════════════════════════════════════════════════════════════
  // 1. PULL-TO-REFRESH BLOCKER
  //
  // Bloque UNIQUEMENT le geste "tirer vers le bas depuis le haut de la page"
  // qui déclenche le rechargement natif du navigateur.
  // N'interfère JAMAIS avec la sélection de texte, le scroll ou les modales.
  // ═════════════════════════════════════════════════════════════════════════

  var _ptrStartY   = 0;
  var _ptrStartX   = 0;
  var _ptrStartT   = 0;
  var _ptrCanBlock = false;

  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { _ptrCanBlock = false; return; }
    _ptrStartY   = e.touches[0].clientY;
    _ptrStartX   = e.touches[0].clientX;
    _ptrStartT   = Date.now();
    _ptrCanBlock = (window.scrollY === 0);
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!_ptrCanBlock)           return;
    if (e.touches.length !== 1)  return;
    var t  = e.touches[0];
    var dy = t.clientY - _ptrStartY;
    var dx = t.clientX - _ptrStartX;
    if (isInput(e.target))                             return; // champ de saisie
    if (Math.abs(dx) > Math.abs(dy) + 8)              return; // geste horizontal
    if (Date.now() - _ptrStartT > 380)                return; // longpress / sélection
    if (findScrollableAncestor(e.target))              return; // zone scrollable
    if (document.querySelector(NOUS_OVERLAY_SEL))      return; // modale Nous ouverte
    if (document.querySelector('.modal-overlay.open')) return; // autre modale
    if (dy > 0 && window.scrollY === 0) {
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('touchend', function () {
    _ptrCanBlock = false;
  }, { passive: true });


  // ═════════════════════════════════════════════════════════════════════════
  // 2. SWIPE DE BORD — bloque la navigation navigateur (Chrome/Safari)
  // Swipe depuis <20px du bord gauche ou droit → navigation arrière/avant.
  // ═════════════════════════════════════════════════════════════════════════

  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    var x = e.touches[0].clientX;
    if (x < 20 || x > window.innerWidth - 20) {
      e.preventDefault();
    }
  }, { passive: false });


  // ═════════════════════════════════════════════════════════════════════════
  // 3. CLAVIER iOS — SYSTÈME UNIFIÉ GÉNÉRALISÉ
  //
  // Écoute visualViewport.resize (déclenché par iOS quand le clavier apparaît
  // ou disparaît). Repositionne TOUS les conteneurs actifs selon leur mode.
  // La nav n'est JAMAIS touchée — le clavier la couvre nativement.
  //
  // MODE 'bottom' (hiddenPage) :
  //   hiddenPage : position:fixed inset:0 (bottom:0). iOS ne pousse pas les
  //   fixed lors de l'ouverture clavier. On simule le comportement natif :
  //   padding-bottom = kbH sur .dm-input-bar → la barre de saisie remonte
  //   via le flex-column. padding-bottom = NAV_HEIGHT quand clavier fermé
  //   (contenu ne passe pas sous la nav).
  //
  // MODE 'sheet' (accountModal, descEditModal, searchOverlay) :
  //   Overlay inset:0. Sheet en bas (align-items:flex-end).
  //   translateY(-kbH) → la sheet monte au-dessus du clavier.
  //
  // MODE dynamique (.nous-modal-overlay.open) :
  //   Overlay inset:0. Sheet a margin-bottom:0 et padding-bottom:var(--nav-height).
  //   translateY(-max(0, kbH - NAV_HEIGHT)) → remonte seulement la partie
  //   que le clavier empiète au-dessus de la nav.
  //
  // MODE 'center' (v2LoginOverlay, sgModal, sgAuthModal, prankMsgModal) :
  //   Boîte centrée (justify-content:center). translateY vers le haut pour
  //   rester dans la zone visible, sans sortir de l'écran en haut.
  //
  // MODE 'popup' (lockPopup) :
  //   Repositionnement en top/left calculé depuis visualViewport.
  // ═════════════════════════════════════════════════════════════════════════

  function _applyKeyboard() {
    if (!HAS_VV) return;

    var vv     = window.visualViewport;
    var kbH    = getKeyboardHeight();
    var isOpen = kbH > 80;

    // ── Cibles statiques ──
    KEYBOARD_TARGETS.forEach(function (cfg) {
      var el = document.getElementById(cfg.id);
      if (!el) return;
      if (!isVisible(el, cfg)) return;

      // ── mode 'bottom' ──
      if (cfg.mode === 'bottom') {
        var inputBar = el.querySelector('.dm-input-bar');
        if (!inputBar) return;
        if (isOpen) {
          inputBar.style.paddingBottom = kbH + 'px';
          inputBar.style.transition    = 'padding-bottom 0.25s ease';
          var msgs = document.getElementById('dmMessages');
          if (msgs) {
            setTimeout(function () { msgs.scrollTop = msgs.scrollHeight; }, 80);
            setTimeout(function () { msgs.scrollTop = msgs.scrollHeight; }, 320);
          }
        } else {
          inputBar.style.paddingBottom = NAV_HEIGHT + 'px';
          inputBar.style.transition    = 'padding-bottom 0.25s ease';
        }
        return;
      }

      // ── mode 'sheet' ──
      if (cfg.mode === 'sheet') {
        var sheet;
        if (cfg.inner) {
          sheet = el.querySelector(cfg.inner);
        } else {
          sheet = el.querySelector('.nous-modal-sheet,.modal-sheet,.account-sheet,.desc-edit-sheet,.search-popup') || el;
        }
        if (!sheet) sheet = el;
        if (isOpen) {
          sheet.style.transform  = 'translateY(-' + kbH + 'px)';
          sheet.style.transition = 'transform 0.25s ease';
          scrollActiveInputIntoView(el, 80);
        } else {
          sheet.style.transform  = '';
          sheet.style.transition = 'transform 0.25s ease';
          setTimeout(function () { sheet.style.transition = ''; }, 280);
        }
        return;
      }

      // ── mode 'center' ──
      if (cfg.mode === 'center') {
        var inner = cfg.inner ? (el.querySelector(cfg.inner) || el) : el;
        if (isOpen) {
          var boxH     = inner.offsetHeight || 300;
          var visH     = window.innerHeight - kbH;
          var natTop   = (visH - boxH) / 2;
          var shift    = (natTop < 20) ? 0 : Math.min(kbH / 2, natTop - 20);
          inner.style.transform  = shift > 0 ? 'translateY(-' + shift + 'px)' : '';
          inner.style.transition = 'transform 0.25s ease';
          scrollActiveInputIntoView(el, 80);
        } else {
          inner.style.transform  = '';
          inner.style.transition = 'transform 0.25s ease';
          setTimeout(function () { inner.style.transition = ''; }, 280);
        }
        return;
      }

      // ── mode 'popup' ──
      if (cfg.mode === 'popup') {
        if (isOpen) {
          var vvBottom = vv.offsetTop + vv.height;
          var popH     = el.offsetHeight || 120;
          var popW     = el.offsetWidth  || 230;
          var topPx    = vvBottom - popH - 12;
          var leftPx   = vv.offsetLeft + vv.width - popW - 10;
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
        return;
      }
    });

    // ── Cibles dynamiques : .nous-modal-overlay.open ──
    // Overlay inset:0. Sheet margin-bottom:0, padding-bottom:var(--nav-height).
    // translate de max(0, kbH - NAV_HEIGHT) → remonte seulement l'excédent.
    document.querySelectorAll(NOUS_OVERLAY_SEL).forEach(function (overlay) {
      var sheet = overlay.querySelector('.nous-modal-sheet');
      if (!sheet) return;
      if (isOpen) {
        var shift = Math.max(0, kbH - NAV_HEIGHT);
        if (shift > 0) {
          sheet.style.transform  = 'translateY(-' + shift + 'px)';
          sheet.style.transition = 'transform 0.25s ease';
        } else {
          sheet.style.transform  = '';
          sheet.style.transition = '';
        }
        scrollActiveInputIntoView(overlay, 80);
      } else {
        sheet.style.transform  = '';
        sheet.style.transition = 'transform 0.25s ease';
        setTimeout(function () { sheet.style.transition = ''; }, 280);
      }
    });
  }

  // Listener visualViewport avec debounce RAF
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

  // ── API publique ──
  window._yamKeyboardUpdate = _applyKeyboard;
  window._dmUpdateVP        = _applyKeyboard; // compat app-messages.js
  window._positionLockPopup = _applyKeyboard; // compat app-nav.js


  // ═════════════════════════════════════════════════════════════════════════
  // 4. SCROLL BACKGROUND BLOCKER
  //
  // Listener touchmove sur document, piloté par window._yamScrollLocked
  // (posé/retiré par app-nous.js à l'ouverture/fermeture de chaque modale).
  // Bloque le scroll de la page principale derrière les modales sur iOS PWA
  // (overflow:hidden sur body ne suffit pas pour les éléments position:fixed).
  //
  // Laisse toujours passer : inputs, gestes horizontaux, longpress, zones scrollables.
  // ═════════════════════════════════════════════════════════════════════════

  var _sbT = 0, _sbX = 0, _sbY = 0;

  document.addEventListener('touchstart', function (e) {
    _sbT = Date.now();
    if (e.touches && e.touches.length === 1) {
      _sbX = e.touches[0].clientX;
      _sbY = e.touches[0].clientY;
    }
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!window._yamScrollLocked) return;
    var target = e.target;
    if (isInput(target)) return;
    if (e.touches && e.touches.length === 1) {
      var dx = Math.abs(e.touches[0].clientX - _sbX);
      var dy = Math.abs(e.touches[0].clientY - _sbY);
      if (dx > dy + 8) return; // geste horizontal
    }
    if (Date.now() - _sbT > 380)      return; // longpress / sélection
    if (findScrollableAncestor(target)) return; // zone scrollable interne
    e.preventDefault();
  }, { passive: false });

  // Compat — no-op car le lock est désormais global via _yamScrollLocked
  window._yamRegisterScrollLock = function () {};


  // ═════════════════════════════════════════════════════════════════════════
  // 5. SÉLECTION DE TEXTE — garantie universelle
  //
  // Force user-select:text sur tous les inputs/textareas (présents ET futurs).
  // Complète le CSS (double sécurité contre les user-select:none parents).
  // ═════════════════════════════════════════════════════════════════════════

  function _forceTextSel(el) {
    el.style.webkitUserSelect = 'text';
    el.style.userSelect       = 'text';
  }

  function _applyTextSelAll() {
    document.querySelectorAll('input, textarea, [contenteditable]').forEach(_forceTextSel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _applyTextSelAll);
  } else {
    setTimeout(_applyTextSelAll, 0);
  }

  var _selObs = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (isInput(node)) _forceTextSel(node);
        if (node.querySelectorAll) {
          node.querySelectorAll('input, textarea, [contenteditable]').forEach(_forceTextSel);
        }
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


  // ═════════════════════════════════════════════════════════════════════════
  // 6. INIT dm-input-bar
  //
  // Dès le chargement, s'assure que .dm-input-bar a padding-bottom = NAV_HEIGHT
  // pour que le contenu ne passe pas sous la nav quand hiddenPage est ouvert
  // et que le clavier est fermé.
  // ═════════════════════════════════════════════════════════════════════════

  function _initDmBar() {
    var hp = document.getElementById('hiddenPage');
    if (!hp) return;
    var bar = hp.querySelector('.dm-input-bar');
    if (!bar) return;
    if (!bar.style.paddingBottom) {
      bar.style.paddingBottom = NAV_HEIGHT + 'px';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initDmBar);
  } else {
    setTimeout(_initDmBar, 0);
  }

})();
