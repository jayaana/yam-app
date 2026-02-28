// ═══════════════════════════════════════════════════════════════════════════
// app-ios-touch.js — Système unifié tactile & clavier iOS — Source unique
// Chargé EN PREMIER dans index.html
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var NAV_HEIGHT = 64;
  var KB_DELAY   = 320;
  var BLUR_DELAY = 120;

  function isInput(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function findScrollableAncestor(el) {
    var node = el;
    while (node && node !== document.body) {
      var oy = window.getComputedStyle(node).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return node;
      node = node.parentElement;
    }
    return null;
  }

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


  // ═══════════════════════════════════
  // 1. PULL-TO-REFRESH BLOCKER
  // ═══════════════════════════════════

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

  document.addEventListener('touchend', function () { _ptrCanBlock = false; }, { passive: true });


  // ═══════════════════════════════════
  // 2. SWIPE DE BORD
  // ═══════════════════════════════════

  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    var x = e.touches[0].clientX;
    if (x < 20 || x > window.innerWidth - 20) e.preventDefault();
  }, { passive: false });


  // ═══════════════════════════════════
  // 3. CLAVIER iOS — focusin / focusout
  //
  // Au focus : cache la nav (translateY fixe).
  // Pour hiddenPage : remonte aussi la dm-input-bar via padding-bottom.
  // Pour toutes les autres modales : la nav cachée suffit + scroll input visible.
  // Au blur : remet la nav, remet padding-bottom si hiddenPage.
  // ═══════════════════════════════════

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

  function _onKeyboardOpen(container, kbH) {
    _hideNav();

    if (container.id === 'hiddenPage') {
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

    // Réduit le padding-bottom de la sheet (compensait la nav, maintenant cachée)
    var sheet = container.querySelector('.nous-modal-sheet, .desc-edit-sheet, .account-sheet, .modal-sheet, .search-popup');
    if (sheet) {
      sheet.style.transition    = 'padding-bottom 0.25s ease';
      sheet.style.paddingBottom = '16px';
    }
    setTimeout(_scrollFocusedIntoView, 80);
  }

  function _onKeyboardClose(container) {
    _showNav();
    if (!container) return;

    if (container.id === 'hiddenPage') {
      var bar = container.querySelector('.dm-input-bar');
      if (bar) {
        bar.style.transition    = 'padding-bottom 0.25s ease';
        bar.style.paddingBottom = NAV_HEIGHT + 'px';
      }
      return;
    }

    // Remet le padding-bottom CSS d'origine
    var sheet = container.querySelector('.nous-modal-sheet, .desc-edit-sheet, .account-sheet, .modal-sheet, .search-popup');
    if (sheet) {
      sheet.style.transition    = 'padding-bottom 0.25s ease';
      sheet.style.paddingBottom = '';
      setTimeout(function () { sheet.style.transition = ''; }, 280);
    }
  }

  document.addEventListener('focusin', function (e) {
    if (!isInput(e.target)) return;
    if (_kbBlurTimer)  { clearTimeout(_kbBlurTimer);  _kbBlurTimer  = null; }
    var container = findModalContainer(e.target);
    if (!container) return;
    if (_kbFocusTimer) { clearTimeout(_kbFocusTimer); _kbFocusTimer = null; }

    _kbFocusTimer = setTimeout(function () {
      _kbFocusTimer = null;
      var kbH = _getKbHeight();
      if (kbH < 80) {
        setTimeout(function () {
          var kbH2 = _getKbHeight();
          if (kbH2 < 80) return;
          _kbActive = true;
          _onKeyboardOpen(container, kbH2);
        }, 200);
        return;
      }
      _kbActive = true;
      _onKeyboardOpen(container, kbH);
    }, KB_DELAY);
  });

  document.addEventListener('focusout', function (e) {
    if (!isInput(e.target)) return;
    if (!_kbActive && !_kbFocusTimer) return;
    if (_kbFocusTimer) { clearTimeout(_kbFocusTimer); _kbFocusTimer = null; }
    var container = findModalContainer(e.target);

    _kbBlurTimer = setTimeout(function () {
      _kbBlurTimer = null;
      var newFocus = document.activeElement;
      if (newFocus && isInput(newFocus)) {
        var newContainer = findModalContainer(newFocus);
        if (newContainer && newContainer === container) return;
      }
      _kbActive = false;
      _onKeyboardClose(container);
    }, BLUR_DELAY);
  });

  window._yamKeyboardUpdate = function () {};
  window._dmUpdateVP        = function () {};
  window._positionLockPopup = function () {};


  // ═══════════════════════════════════
  // 4. SCROLL BACKGROUND BLOCKER
  // ═══════════════════════════════════

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

    // Si la cible est dans une modale ouverte, on laisse son scroll interne fonctionner
    var inModal = !!(
      findModalContainer(target) ||
      target.closest && (
        target.closest('.nous-modal-overlay.open') ||
        target.closest('.souvenir-gestion-overlay.open') ||
        target.closest('#descEditModal.open') ||
        target.closest('#accountModal.open') ||
        target.closest('#searchOverlay.open') ||
        target.closest('#memoModal.open') ||
        target.closest('#memoAuthModal.open') ||
        target.closest('#hiddenPage.active')
      )
    );
    if (inModal) return;

    if (isInput(target)) return;
    if (e.touches && e.touches.length === 1) {
      var dx = Math.abs(e.touches[0].clientX - _sbX);
      var dy = Math.abs(e.touches[0].clientY - _sbY);
      if (dx > dy + 8) return;
    }
    if (Date.now() - _sbT > 380) return;
    e.preventDefault();
  }, { passive: false });

  window._yamRegisterScrollLock = function () {};


  // ═══════════════════════════════════
  // 5. SÉLECTION DE TEXTE
  // ═══════════════════════════════════

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
    document.addEventListener('DOMContentLoaded', function () { _selObs.observe(document.body, { childList: true, subtree: true }); });
  } else {
    _selObs.observe(document.body, { childList: true, subtree: true });
  }


  // ═══════════════════════════════════
  // 6. INIT dm-input-bar
  // ═══════════════════════════════════

  function _initDmBar() {
    var hp = document.getElementById('hiddenPage');
    if (!hp) return;
    var bar = hp.querySelector('.dm-input-bar');
    if (!bar || bar.style.paddingBottom) return;
    bar.style.paddingBottom = NAV_HEIGHT + 'px';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initDmBar);
  } else {
    setTimeout(_initDmBar, 0);
  }

})();
