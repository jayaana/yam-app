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


  // ═══════════════════════════════════════════════════════════════════════
  // FENÊTRE ISOLÉE — au focus d'un input dans une modale
  //
  // Principe : quand le clavier s'ouvre dans une modale, on crée un
  // wrapper position:fixed inset:0 z-index:9999 avec fond opaque qui
  // isole COMPLÈTEMENT la modale du reste de la page.
  // L'arrière-plan devient inaccessible — impossible de le scroller
  // ou de le toucher.
  // La modale (sheet) est draggable verticalement pour accéder à tout
  // son contenu sans scroll de page.
  // La nav est dupliquée dans la fenêtre et se cache au clavier.
  // ═══════════════════════════════════════════════════════════════════════

  var _isoWindow     = null;   // le wrapper div isolé
  var _isoModal      = null;   // la modale actuellement dans la fenêtre
  var _isoNavClone   = null;   // clone de la nav dans la fenêtre
  var _isoOrigParent = null;   // parent original de la modale
  var _isoOrigNext   = null;   // nextSibling original (pour réinsérer)
  var _kbActive      = false;
  var _kbFocusTimer  = null;
  var _kbBlurTimer   = null;

  function _getKbHeight() {
    if (window.visualViewport) {
      var kb = window.innerHeight - window.visualViewport.height;
      return kb > 80 ? kb : 0;
    }
    var kb = window.innerHeight - document.documentElement.clientHeight;
    return kb > 80 ? kb : 0;
  }

  // ── Crée la fenêtre isolée si elle n'existe pas ──
  function _ensureIsoWindow() {
    if (_isoWindow) return;

    _isoWindow = document.createElement('div');
    _isoWindow.id = 'yamIsoWindow';
    _isoWindow.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:9999',
      'display:none',
      'flex-direction:column',
      'align-items:stretch',
      'justify-content:flex-end',  // sheet en bas par défaut
      'background:rgba(0,0,0,0.6)',
      '-webkit-backdrop-filter:blur(4px)',
      'backdrop-filter:blur(4px)',
      'overflow:hidden',
      '-webkit-overflow-scrolling:none',
      'touch-action:none',         // BLOQUE tout scroll iOS sur le fond
    ].join(';');

    document.body.appendChild(_isoWindow);
  }

  // ── Ouvre la fenêtre isolée avec la modale donnée ──
  function _openIsoWindow(modal) {
    _ensureIsoWindow();

    if (_isoModal && _isoModal !== modal) {
      _closeIsoWindow();
    }

    _isoModal      = modal;
    _isoOrigParent = modal.parentElement;
    _isoOrigNext   = modal.nextSibling;

    // Récupère la sheet interne pour le drag
    var sheet = modal.querySelector('.nous-modal-sheet');

    // Déplace la modale dans la fenêtre isolée
    // On déplace uniquement la sheet si elle existe, sinon toute la modale
    if (sheet) {
      // On place juste la sheet — fond géré par _isoWindow
      sheet._isoDetached = true;
      sheet._isoParent   = modal;

      // Retire le fond/backdrop de la modale originale visuellement
      // (on garde la modale en DOM pour ne pas casser les refs JS)
      modal.style.background       = 'transparent';
      modal.style.backdropFilter   = 'none';
      modal.style.webkitBackdropFilter = 'none';
      modal.style.pointerEvents    = 'none';  // la modale originale n'intercepte plus les touches

      // Clone la sheet dans la fenêtre isolée
      _isoWindow.innerHTML = '';  // reset
      _isoWindow.appendChild(sheet);
    } else {
      // Pas de sheet — déplace tout le modal
      _isoOrigParent.removeChild(modal);
      _isoWindow.appendChild(modal);
    }

    // Duplique la nav en bas de la fenêtre isolée
    var originalNav = document.querySelector('.bottom-nav');
    if (originalNav) {
      _isoNavClone = originalNav.cloneNode(true);
      _isoNavClone.style.cssText += ';pointer-events:none;position:relative;z-index:1;flex-shrink:0;';
      originalNav.style.visibility = 'hidden'; // cache la vraie nav sans la supprimer du layout
      _isoWindow.appendChild(_isoNavClone);
    }

    // Active le drag sur la sheet
    if (sheet) {
      _enableDrag(sheet);
    }

    // Tap sur le fond de la fenêtre isolée → ferme la modale via sa fonction originale
    _isoWindow.addEventListener('click', function _isoBackdropClick(e) {
      if (e.target !== _isoWindow) return;
      _isoWindow.removeEventListener('click', _isoBackdropClick);
      // Cherche la fonction de fermeture de la modale originale
      var closeFn = modal.getAttribute('data-close-fn');
      if (closeFn && window[closeFn]) {
        window[closeFn]();
      } else {
        // Fermeture générique : retire la classe .open
        modal.classList.remove('open');
        if (window._yamScrollLocked !== false) {
          window._yamScrollLocked = false;
        }
      }
    });

    // Affiche la fenêtre
    _isoWindow.style.display = 'flex';
  }

  // ── Ferme la fenêtre isolée et remet tout en place ──
  function _closeIsoWindow() {
    if (!_isoWindow || _isoWindow.style.display === 'none') return;

    var modal = _isoModal;
    if (!modal) { _resetIsoWindow(); return; }

    var sheet = modal.querySelector('.nous-modal-sheet, .nous-modal-sheet[class]');
    // Cherche la sheet dans la fenêtre isolée
    var isoSheet = _isoWindow.querySelector('.nous-modal-sheet');

    if (isoSheet && isoSheet._isoDetached) {
      // Remet le fond sur la modale
      modal.style.background           = '';
      modal.style.backdropFilter        = '';
      modal.style.webkitBackdropFilter  = '';
      modal.style.pointerEvents         = '';

      // Remet la sheet dans sa modale originale
      isoSheet._isoDetached = false;
      isoSheet.style.transform  = '';
      isoSheet.style.transition = '';
      isoSheet.style.paddingBottom = '';
      _disableDrag(isoSheet);

      // Cherche le bon point d'insertion (avant la nav clone si elle était là)
      modal.appendChild(isoSheet);
    } else if (modal.parentElement === _isoWindow) {
      // Modal entier déplacé — le remettre
      _isoOrigParent.insertBefore(modal, _isoOrigNext);
    }

    // Restore la vraie nav
    var originalNav = document.querySelector('.bottom-nav');
    if (originalNav) {
      originalNav.style.visibility = '';
      originalNav.style.transform  = '';
      originalNav.style.transition = '';
    }

    _resetIsoWindow();
  }

  function _resetIsoWindow() {
    if (_isoWindow) {
      _isoWindow.style.display = 'none';
      _isoWindow.innerHTML = '';
    }
    _isoModal      = null;
    _isoNavClone   = null;
    _isoOrigParent = null;
    _isoOrigNext   = null;
  }

  // ── Cache/montre la nav dans la fenêtre isolée ──
  function _hideIsoNav() {
    if (_isoNavClone) {
      _isoNavClone.style.transition = 'transform 0.25s ease';
      _isoNavClone.style.transform  = 'translateY(120px)';
    }
  }

  function _showIsoNav() {
    if (_isoNavClone) {
      _isoNavClone.style.transition = 'transform 0.25s ease';
      _isoNavClone.style.transform  = '';
      setTimeout(function () {
        if (_isoNavClone) { _isoNavClone.style.transition = ''; }
      }, 280);
    }
  }

  // ── Réduit le padding-bottom de la sheet quand clavier ouvert ──
  function _shrinkSheetPadding() {
    var sheet = _isoWindow ? _isoWindow.querySelector('.nous-modal-sheet') : null;
    if (sheet) {
      sheet.style.transition    = 'padding-bottom 0.25s ease';
      sheet.style.paddingBottom = '16px';
    }
  }

  function _restoreSheetPadding() {
    var sheet = _isoWindow ? _isoWindow.querySelector('.nous-modal-sheet') : null;
    if (sheet) {
      sheet.style.transition    = 'padding-bottom 0.25s ease';
      sheet.style.paddingBottom = '';
      setTimeout(function () {
        if (sheet) sheet.style.transition = '';
      }, 280);
    }
  }

  // ═══════════════════════════════════
  // DRAG LIBRE DE LA SHEET
  // ═══════════════════════════════════

  var _dragEl     = null;
  var _dragStartY = 0;
  var _dragStartT = 0;
  var _dragVelY   = 0;

  function _getCurrentTY(el) {
    var m = (el.style.transform || '').match(/translateY\(([\-\d.]+)px\)/);
    return m ? parseFloat(m[1]) : 0;
  }

  function _dragTouchStart(e) {
    if (e.touches.length !== 1) return;
    _dragStartY = e.touches[0].clientY;
    _dragStartT = Date.now();
    _dragVelY   = 0;
    if (_dragEl) _dragEl._dragBaseTY = _getCurrentTY(_dragEl);
    e.stopPropagation();
  }

  function _dragTouchMove(e) {
    if (!_dragEl || e.touches.length !== 1) return;
    var dy    = e.touches[0].clientY - _dragStartY;
    var newTY = (_dragEl._dragBaseTY || 0) + dy;
    // Limite haute : 80% de la hauteur écran vers le haut
    var maxUp = -(window.innerHeight * 0.8);
    if (newTY < maxUp) newTY = maxUp;
    // Limite basse : ne descend pas sous sa position naturelle
    if (newTY > 0) newTY = 0;

    var dt = Math.max(1, Date.now() - _dragStartT);
    _dragVelY = dy / dt;
    _dragStartY = e.touches[0].clientY;
    _dragStartT = Date.now();
    if (_dragEl._dragBaseTY !== undefined) _dragEl._dragBaseTY = newTY;

    _dragEl.style.transition = 'none';
    _dragEl.style.transform  = 'translateY(' + newTY + 'px)';
    e.stopPropagation();
    e.preventDefault();  // empêche tout scroll derrière
  }

  function _dragTouchEnd(e) {
    if (!_dragEl) return;
    // Snap vers le haut si vitesse suffisante vers le haut, sinon reste en place
    var curTY = _getCurrentTY(_dragEl);
    _dragEl.style.transition = 'transform 0.22s cubic-bezier(0.25,0.46,0.45,0.94)';
    // Pas de snap automatique vers la position 0 — reste où l'utilisateur a laissé
    e.stopPropagation();
  }

  function _enableDrag(el) {
    if (!el || el._dragEnabled) return;
    el._dragEnabled = true;
    el._dragBaseTY  = 0;
    el.addEventListener('touchstart', _dragTouchStart, { passive: true });
    el.addEventListener('touchmove',  _dragTouchMove,  { passive: false });
    el.addEventListener('touchend',   _dragTouchEnd,   { passive: true });
    _dragEl = el;
  }

  function _disableDrag(el) {
    if (!el || !el._dragEnabled) return;
    el._dragEnabled = false;
    el.removeEventListener('touchstart', _dragTouchStart);
    el.removeEventListener('touchmove',  _dragTouchMove);
    el.removeEventListener('touchend',   _dragTouchEnd);
    if (_dragEl === el) _dragEl = null;
  }


  // ═══════════════════════════════════
  // CLAVIER — focusin / focusout
  // ═══════════════════════════════════

  function _onKeyboardOpen(container, kbH) {
    _kbActive = true;

    if (container.id === 'hiddenPage') {
      // Messages : gestion spéciale sans fenêtre isolée
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

    // Seuls les conteneurs avec une .nous-modal-sheet passent par la fenêtre isolée
    // Les écrans plein écran (login, lockPopup, sgModal...) ne sont pas interceptés
    var hasSheet = container.querySelector('.nous-modal-sheet, .desc-edit-sheet, .account-sheet');
    if (!hasSheet) return;

    // Ouvre la fenêtre isolée avec cette modale
    _openIsoWindow(container);

    // Cache la nav isolée + réduit padding
    _hideIsoNav();
    _shrinkSheetPadding();
  }

  function _onKeyboardClose(container) {
    _kbActive = false;

    if (container && container.id === 'hiddenPage') {
      var bar = container.querySelector('.dm-input-bar');
      if (bar) {
        bar.style.transition    = 'padding-bottom 0.25s ease';
        bar.style.paddingBottom = NAV_HEIGHT + 'px';
      }
      return;
    }

    // Remet la nav + padding
    _showIsoNav();
    _restoreSheetPadding();

    // Ne ferme PAS la fenêtre isolée ici — elle reste ouverte tant que la modale est ouverte
    // Elle sera fermée par _unblockBackgroundScroll via _yamCloseIsoWindow()
  }

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
        // Deuxième tentative si le clavier n'est pas encore mesuré
        setTimeout(function () {
          var kbH2 = _getKbHeight();
          if (kbH2 < 80) return;
          _onKeyboardOpen(container, kbH2);
        }, 200);
        return;
      }
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
        // Changement de champ dans la même modale — ne rien faire
        if (newContainer && newContainer === container) return;
      }
      _onKeyboardClose(container);
    }, BLUR_DELAY);
  });


  // ═══════════════════════════════════════════════════════════════════════
  // HOOK sur _unblockBackgroundScroll de app-nous.js
  // Quand toutes les modales sont fermées → ferme la fenêtre isolée
  // ═══════════════════════════════════════════════════════════════════════

  // app-nous.js appelle window._yamScrollLocked = false quand il déverrouille.
  // On intercepte ce moment pour fermer la fenêtre isolée.
  window._yamCloseIsoWindow = function () {
    if (_kbActive) {
      _kbActive = false;
      if (_kbFocusTimer) { clearTimeout(_kbFocusTimer); _kbFocusTimer = null; }
      if (_kbBlurTimer)  { clearTimeout(_kbBlurTimer);  _kbBlurTimer  = null; }
    }
    _closeIsoWindow();
  };

  // Proxy sur _yamScrollLocked pour détecter le déverrouillage
  var _lockProxy = false;
  Object.defineProperty(window, '_yamScrollLocked', {
    get: function () { return _lockProxy; },
    set: function (v) {
      _lockProxy = v;
      if (!v) {
        // Toutes les modales fermées — ferme la fenêtre isolée
        setTimeout(_closeIsoWindow, 50);
      }
    },
    configurable: true
  });


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
    if (!_ptrCanBlock) return;
    if (e.touches.length !== 1) return;
    var t  = e.touches[0];
    var dy = t.clientY - _ptrStartY;
    var dx = t.clientX - _ptrStartX;
    if (isInput(e.target))                 return;
    if (Math.abs(dx) > Math.abs(dy) + 8)  return;
    if (Date.now() - _ptrStartT > 380)     return;
    // Si la fenêtre isolée est ouverte, ne pas interférer (le drag gère tout)
    if (_isoWindow && _isoWindow.style.display !== 'none') return;
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
  // 3. SÉLECTION DE TEXTE
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
    document.addEventListener('DOMContentLoaded', function () {
      _selObs.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    _selObs.observe(document.body, { childList: true, subtree: true });
  }


  // ═══════════════════════════════════
  // 4. INIT dm-input-bar
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


  // ═══════════════════════════════════
  // 5. COMPAT — fonctions vides pour les anciens appels
  // ═══════════════════════════════════

  window._yamKeyboardUpdate    = function () {};
  window._dmUpdateVP           = function () {};
  window._positionLockPopup    = function () {};
  window._yamRegisterScrollLock = function () {};

})();
