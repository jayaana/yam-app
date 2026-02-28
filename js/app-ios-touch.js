// ═══════════════════════════════════════════════════════════════════════════
// app-ios-touch.js — Système unifié tactile & clavier iOS — Source unique
// Chargé EN PREMIER dans index.html
//
// CE FICHIER EST L'UNIQUE SOURCE DE VÉRITÉ pour :
//   1. Pull-to-refresh blocker
//   2. Swipe de bord gauche/droit
//   3. Clavier iOS — basé sur focusin/focusout (PAS visualViewport)
//      Nav cachée + modale remontée au focus, tout revient au blur.
//   4. Scroll background blocker
//   5. Sélection de texte universelle
//   6. Init dm-input-bar (Messages)
//
// RÈGLE ABSOLUE : aucun autre fichier JS ne doit :
//   - créer un listener visualViewport
//   - créer un listener touchmove global avec passive:false
//   - modifier document.body.style.position / overflow / width
//   - modifier le meta viewport (maximum-scale etc.)
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIG
  // ─────────────────────────────────────────────────────────────────────────

  var NAV_HEIGHT = 64;   // px — doit correspondre à --nav-height dans le CSS
  var KB_DELAY   = 320;  // ms — délai iOS avant que le clavier soit pleinement ouvert
  var BLUR_DELAY = 120;  // ms — délai avant de considérer le clavier vraiment fermé

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

  // Remonte la chaîne parentale pour trouver le conteneur modal le plus proche
  function findModalContainer(el) {
    var node = el;
    while (node && node !== document.body) {
      if (node.classList) {
        if (node.classList.contains('nous-modal-overlay'))       return node;
        if (node.classList.contains('souvenir-gestion-overlay')) return node;
      }
      var id = node.id;
      if (id === 'hiddenPage'     || id === 'descEditModal'  ||
          id === 'accountModal'   || id === 'searchOverlay'  ||
          id === 'memoModal'      || id === 'memoAuthModal'  ||
          id === 'v2LoginOverlay' || id === 'sgModal'        ||
          id === 'sgEditModal'    || id === 'sgAuthModal'    ||
          id === 'prankMsgModal'  || id === 'lockPopup') {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }


  // ═════════════════════════════════════════════════════════════════════════
  // 1. PULL-TO-REFRESH BLOCKER
  // ═════════════════════════════════════════════════════════════════════════

  var _ptrStartY = 0, _ptrStartX = 0, _ptrStartT = 0, _ptrCanBlock = false;

  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { _ptrCanBlock = false; return; }
    _ptrStartY   = e.touches[0].clientY;
    _ptrStartX   = e.touches[0].clientX;
    _ptrStartT   = Date.now();
    _ptrCanBlock = (window.scrollY === 0);
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!_ptrCanBlock)          return;
    if (e.touches.length !== 1) return;
    var t  = e.touches[0];
    var dy = t.clientY - _ptrStartY;
    var dx = t.clientX - _ptrStartX;
    if (isInput(e.target))                                        return;
    if (Math.abs(dx) > Math.abs(dy) + 8)                         return;
    if (Date.now() - _ptrStartT > 380)                           return;
    if (findScrollableAncestor(e.target))                         return;
    if (document.querySelector('.nous-modal-overlay.open'))       return;
    if (document.querySelector('.souvenir-gestion-overlay.open')) return;
    if (document.querySelector('.modal-overlay.open'))            return;
    if (dy > 0 && window.scrollY === 0) e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchend', function () {
    _ptrCanBlock = false;
  }, { passive: true });


  // ═════════════════════════════════════════════════════════════════════════
  // 2. SWIPE DE BORD
  // ═════════════════════════════════════════════════════════════════════════

  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    var x = e.touches[0].clientX;
    if (x < 20 || x > window.innerWidth - 20) e.preventDefault();
  }, { passive: false });


  // ═════════════════════════════════════════════════════════════════════════
  // 3. CLAVIER iOS — focusin / focusout
  //
  // Principe :
  //   focusin  → attendre KB_DELAY ms → mesurer kbH → cacher nav + remonter modale
  //   focusout → attendre BLUR_DELAY ms → si le focus n'est pas dans la même
  //              modale → montrer nav + redescendre modale
  //
  // Mesure de kbH : window.innerHeight - window.visualViewport.height
  // (visualViewport est utilisé UNIQUEMENT pour mesurer, pas pour les events)
  // Fallback : window.innerHeight - document.documentElement.clientHeight
  // ═════════════════════════════════════════════════════════════════════════

  var _kbFocusTimer = null;
  var _kbBlurTimer  = null;
  var _kbActive     = false;

  function _getKbHeight() {
    if (window.visualViewport) {
      var kb = window.innerHeight - window.visualViewport.height;
      return kb > 80 ? kb : 0;
    }
    var kb = window.innerHeight - document.documentElement.clientHeight;
    return kb > 80 ? kb : 0;
  }

  function _hideNav() {
    var nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    nav.style.transition = 'transform 0.25s ease';
    // Valeur fixe large — sort la nav de l'écran vers le bas quoi qu'il arrive
    nav.style.transform  = 'translateY(120px)';
  }

  function _showNav() {
    var nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    nav.style.transition = 'transform 0.25s ease';
    nav.style.transform  = '';
    setTimeout(function () { nav.style.transition = ''; }, 280);
  }

  function _scrollFocusedIntoView() {
    var focused = document.activeElement;
    if (focused && isInput(focused)) {
      focused.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function _liftContainer(container, kbH) {
    if (!container) return;
    var id = container.id;

    // ── hiddenPage (Messages) ──
    if (id === 'hiddenPage') {
      var bar = container.querySelector('.dm-input-bar');
      if (bar) {
        bar.style.transition    = 'padding-bottom 0.25s ease';
        bar.style.paddingBottom = kbH + 'px';
        var msgs = document.getElementById('dmMessages');
        if (msgs) {
          setTimeout(function () { msgs.scrollTop = msgs.scrollHeight; }, 80);
          setTimeout(function () { msgs.scrollTop = msgs.scrollHeight; }, 350);
        }
      }
      return;
    }

    // ── .nous-modal-overlay → la nav est cachée, la sheet est déjà collée en bas
    // iOS ne remonte pas les position:fixed → la sheet reste sous le clavier.
    // On translate uniquement de ce que le clavier empiète SUR la sheet.
    // La sheet a padding-bottom:nav-height → ce padding est maintenant de l'espace libre
    // puisque la nav est cachée. Shift net = kbH - NAV_HEIGHT.
    if (container.classList && container.classList.contains('nous-modal-overlay')) {
      var sheet = container.querySelector('.nous-modal-sheet');
      if (!sheet) return;
      var shift = Math.max(0, kbH - NAV_HEIGHT);
      sheet.style.transition = 'transform 0.25s ease';
      sheet.style.transform  = shift > 0 ? 'translateY(-' + shift + 'px)' : '';
      setTimeout(_scrollFocusedIntoView, 80);
      return;
    }

    // ── .souvenir-gestion-overlay → plein écran, scroll l'input dans la vue ──
    if (container.classList && container.classList.contains('souvenir-gestion-overlay')) {
      setTimeout(_scrollFocusedIntoView, 80);
      return;
    }

    // ── descEditModal → translate la .desc-edit-sheet ──
    if (id === 'descEditModal') {
      var dsheet = container.querySelector('.desc-edit-sheet');
      if (dsheet) {
        dsheet.style.transition = 'transform 0.25s ease';
        dsheet.style.transform  = 'translateY(-' + kbH + 'px)';
      }
      return;
    }

    // ── accountModal ──
    if (id === 'accountModal') {
      var asheet = container.querySelector('.account-sheet, .nous-modal-sheet, .modal-sheet') || container;
      asheet.style.transition = 'transform 0.25s ease';
      asheet.style.transform  = 'translateY(-' + kbH + 'px)';
      return;
    }

    // ── searchOverlay ──
    if (id === 'searchOverlay') {
      var spop = container.querySelector('.search-popup');
      if (spop) {
        spop.style.transition = 'transform 0.25s ease';
        spop.style.transform  = 'translateY(-' + kbH + 'px)';
      }
      return;
    }

    // ── lockPopup ──
    if (id === 'lockPopup') {
      container.style.bottom = 'auto';
      container.style.top    = '20px';
      return;
    }

    // ── Boîtes centrées : memoModal, memoAuthModal, v2LoginOverlay,
    //    sgModal, sgEditModal, sgAuthModal, prankMsgModal ──
    var centerSelectors = [
      '.memo-modal-inner', '.sg-modal-inner', '.memo-auth-inner', '#v2LoginBox'
    ];
    var inner = null;
    for (var i = 0; i < centerSelectors.length; i++) {
      inner = container.querySelector(centerSelectors[i]);
      if (inner) break;
    }
    if (!inner) inner = container;
    var boxH   = inner.offsetHeight || 300;
    var visH   = window.innerHeight - kbH;
    var natTop = (visH - boxH) / 2;
    var cshift = natTop < 20 ? 0 : Math.min(kbH / 2, natTop - 20);
    inner.style.transition = 'transform 0.25s ease';
    inner.style.transform  = cshift > 0 ? 'translateY(-' + cshift + 'px)' : '';
  }

  function _dropContainer(container) {
    if (!container) return;
    var id = container.id;

    if (id === 'hiddenPage') {
      var bar = container.querySelector('.dm-input-bar');
      if (bar) {
        bar.style.transition    = 'padding-bottom 0.25s ease';
        bar.style.paddingBottom = NAV_HEIGHT + 'px';
      }
      return;
    }

    if (container.classList && container.classList.contains('nous-modal-overlay')) {
      var sheet = container.querySelector('.nous-modal-sheet');
      if (sheet) {
        sheet.style.transition = 'transform 0.25s ease';
        sheet.style.transform  = '';
        setTimeout(function () { sheet.style.transition = ''; }, 280);
      }
      return;
    }

    if (container.classList && container.classList.contains('souvenir-gestion-overlay')) {
      return;
    }

    if (id === 'descEditModal') {
      var dsheet = container.querySelector('.desc-edit-sheet');
      if (dsheet) {
        dsheet.style.transition = 'transform 0.25s ease';
        dsheet.style.transform  = '';
        setTimeout(function () { dsheet.style.transition = ''; }, 280);
      }
      return;
    }

    if (id === 'accountModal') {
      var asheet = container.querySelector('.account-sheet, .nous-modal-sheet, .modal-sheet') || container;
      asheet.style.transition = 'transform 0.25s ease';
      asheet.style.transform  = '';
      setTimeout(function () { asheet.style.transition = ''; }, 280);
      return;
    }

    if (id === 'searchOverlay') {
      var spop = container.querySelector('.search-popup');
      if (spop) {
        spop.style.transition = 'transform 0.25s ease';
        spop.style.transform  = '';
        setTimeout(function () { spop.style.transition = ''; }, 280);
      }
      return;
    }

    if (id === 'lockPopup') {
      container.style.bottom = '80px';
      container.style.top    = 'auto';
      return;
    }

    // Boîtes centrées
    var centerSelectors = [
      '.memo-modal-inner', '.sg-modal-inner', '.memo-auth-inner', '#v2LoginBox'
    ];
    var inner = null;
    for (var i = 0; i < centerSelectors.length; i++) {
      inner = container.querySelector(centerSelectors[i]);
      if (inner) break;
    }
    if (!inner) inner = container;
    inner.style.transition = 'transform 0.25s ease';
    inner.style.transform  = '';
    setTimeout(function () { inner.style.transition = ''; }, 280);
  }

  // ── focusin : un input prend le focus ──
  document.addEventListener('focusin', function (e) {
    if (!isInput(e.target)) return;

    if (_kbBlurTimer) { clearTimeout(_kbBlurTimer); _kbBlurTimer = null; }

    var container = findModalContainer(e.target);
    if (!container) return;

    if (_kbFocusTimer) { clearTimeout(_kbFocusTimer); _kbFocusTimer = null; }

    _kbFocusTimer = setTimeout(function () {
      _kbFocusTimer = null;
      var kbH = _getKbHeight();
      if (kbH < 80) {
        // Clavier pas encore mesuré — on réessaie
        setTimeout(function () {
          var kbH2 = _getKbHeight();
          if (kbH2 < 80) return;
          _kbActive = true;
          _hideNav();
          _liftContainer(container, kbH2);
        }, 200);
        return;
      }
      _kbActive = true;
      _hideNav();
      _liftContainer(container, kbH);
    }, KB_DELAY);
  });

  // ── focusout : un input perd le focus ──
  document.addEventListener('focusout', function (e) {
    if (!isInput(e.target)) return;
    if (!_kbActive && !_kbFocusTimer) return;

    if (_kbFocusTimer) { clearTimeout(_kbFocusTimer); _kbFocusTimer = null; }

    var container = findModalContainer(e.target);

    _kbBlurTimer = setTimeout(function () {
      _kbBlurTimer = null;
      // Si le focus est passé à un autre input dans la même modale → ne rien faire
      var newFocus = document.activeElement;
      if (newFocus && isInput(newFocus)) {
        var newContainer = findModalContainer(newFocus);
        if (newContainer && newContainer === container) return;
      }
      _kbActive = false;
      _showNav();
      _dropContainer(container);
    }, BLUR_DELAY);
  });

  // API publique — compat avec les autres fichiers JS (no-op désormais)
  window._yamKeyboardUpdate = function () {};
  window._dmUpdateVP        = function () {};
  window._positionLockPopup = function () {};


  // ═════════════════════════════════════════════════════════════════════════
  // 4. SCROLL BACKGROUND BLOCKER
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
      if (dx > dy + 8) return;
    }
    if (Date.now() - _sbT > 380)       return;
    if (findScrollableAncestor(target)) return;
    e.preventDefault();
  }, { passive: false });

  window._yamRegisterScrollLock = function () {};


  // ═════════════════════════════════════════════════════════════════════════
  // 5. SÉLECTION DE TEXTE — garantie universelle
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
