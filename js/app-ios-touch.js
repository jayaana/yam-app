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
      _showKbdBackdrop(kbH);
      _enableDrag(sheet);
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
      _disableDrag(sheet);
      _hideKbdBackdrop();
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
    if (_kbActive) {
      // Clavier ouvert : tout bloqué sauf le drag custom (stopPropagation)
      e.preventDefault();
      return;
    }
    // Clavier fermé : autorise scroll uniquement dans la sheet
    var node = e.target;
    while (node && node !== document.body) {
      if (node.classList && (
        node.classList.contains('nous-modal-sheet') ||
        node.classList.contains('desc-edit-sheet')  ||
        node.classList.contains('account-sheet')    ||
        node.classList.contains('modal-sheet')      ||
        node.classList.contains('search-popup')
      )) return;
      node = node.parentElement;
    }
    e.preventDefault();
  }, { passive: false });

  window._yamRegisterScrollLock = function () {};



  // ═══════════════════════════════════
  // 4b. DRAG + FOND OPAQUE (clavier ouvert)
  // ═══════════════════════════════════

  var _dragEl     = null;
  var _dragStartY = 0;
  var _dragBaseTY = 0;
  var _kbdBackdrop = null;

  function _getCurrentTY(el) {
    var m = (el.style.transform || '').match(/translateY\(([\-\d.]+)px\)/);
    return m ? parseFloat(m[1]) : 0;
  }

  function _onDragStart(e) {
    if (!_kbActive || e.touches.length !== 1) return;
    _dragStartY = e.touches[0].clientY;
    _dragBaseTY = _getCurrentTY(e.currentTarget);
    e.stopPropagation();
  }

  function _onDragMove(e) {
    if (!_kbActive || !_dragEl || e.touches.length !== 1) return;
    var dy    = e.touches[0].clientY - _dragStartY;
    var newTY = _dragBaseTY + dy;
    if (newTY < -(window.innerHeight * 0.75)) newTY = -(window.innerHeight * 0.75);
    // Pas de limite basse — peut descendre sous le clavier
    _dragBaseTY = newTY;
    _dragStartY = e.touches[0].clientY;
    _dragEl.style.transition = 'none';
    _dragEl.style.transform  = newTY !== 0 ? 'translateY(' + newTY + 'px)' : '';
    e.stopPropagation();
    e.preventDefault();
  }

  function _onDragEnd(e) { e.stopPropagation(); }

  function _enableDrag(sheet) {
    if (!sheet || sheet._dragEnabled) return;
    sheet._dragEnabled = true;
    _dragEl = sheet;
    sheet.addEventListener('touchstart', _onDragStart, { passive: true });
    sheet.addEventListener('touchmove',  _onDragMove,  { passive: false });
    sheet.addEventListener('touchend',   _onDragEnd,   { passive: true });
  }

  function _disableDrag(sheet) {
    if (!sheet || !sheet._dragEnabled) return;
    sheet._dragEnabled = false;
    sheet.removeEventListener('touchstart', _onDragStart);
    sheet.removeEventListener('touchmove',  _onDragMove);
    sheet.removeEventListener('touchend',   _onDragEnd);
    sheet.style.transition = 'transform 0.25s ease';
    sheet.style.transform  = '';
    setTimeout(function () { if (sheet) sheet.style.transition = ''; }, 280);
    if (_dragEl === sheet) _dragEl = null;
  }

  // Fond opaque qui bouche la zone entre le bas de la sheet et le haut du clavier
  function _showKbdBackdrop(kbH) {
    if (_kbdBackdrop) return;
    _kbdBackdrop = document.createElement('div');
    _kbdBackdrop.style.cssText = [
      'position:fixed',
      'left:0',
      'right:0',
      'bottom:0',               // couvre tout l\'écran clavier compris
      'top:0',                   // remonte jusqu'en haut — tout l'arrière-plan est couvert
      'z-index:915',             // entre overlay (920) et le reste
      'pointer-events:all',      // bloque les touches sur l'arrière-plan
      'background:rgba(0,0,0,0.6)',
      'backdrop-filter:blur(4px)',
      '-webkit-backdrop-filter:blur(4px)'
    ].join(';');
    document.body.appendChild(_kbdBackdrop);
  }

  function _hideKbdBackdrop() {
    if (!_kbdBackdrop) return;
    var el = _kbdBackdrop;
    _kbdBackdrop = null;
    el.style.transition = 'opacity 0.2s ease';
    el.style.opacity = '0';
    setTimeout(function () { if (el.parentElement) el.parentElement.removeChild(el); }, 220);
  }

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
