// ═══════════════════════════════════════════════════════════════════════════
// app-inline.js — Code extrait de index.html (tâche #89 CSP)
// Généré le 15 mars 2026 — à charger APRÈS app-nav.js
//
// Contient les 14 blocs inline précédemment dans index.html :
//   Bloc 1  — scrollRestoration
//   Bloc 2  — Service Worker registration
//   Bloc 3  — Avatars par défaut (yamSetAvatar, yamAvatarHTML, yamAvatarSrc)
//   Bloc 4  — Login page reload guard
//   Bloc 5  — visualViewport bottom-nav fix iOS
//   Bloc 6  — Login V2 interface (v2SelectJoinRole, v2SetError, v2CopyCode, v2ApplyDynamicNames, yamSplashOpen)
//   Bloc 7  — yamSwitchTab patch + scroll top
//   Bloc 8  — Sticky header / tabs / profil popup (yamStickyOpenProfile, syncAvatars)
//   Bloc 9  — Subviews + PrankMenu + AccountModal patch (openPrankMenu, closePrankMenu, yamToggleAccountModal)
//   Bloc 10 — DM online status observer (updateDmStatus)
//   Bloc 11 — Modales : clic dehors pour fermer
//   Bloc 12 — Home tab : mascotte IA + humeur + rappels + semaine
//             (homeRappelPrev/Next/Done, rappelAdd, openRappelSheet, closeRappelSheet)
//   Bloc 13 — Avatar sync topbar / setProfile patch (initDefaultAvatars, patchAcSync, hookSetProfile)
//   Bloc 14 — Cowatch live poll (_checkLive)
//
// addEventListener remplace les onclick= sur les éléments suivants :
//   #yamStickyAvatarSelf  → yamStickyOpenProfile()
//   #yamStickyGearBtn     → yamToggleAccountModal()
//   #yamSplashBtn         → yamSplashOpen()
//   #v2JoinRoleGirl       → v2SelectJoinRole('girl')
//   #v2JoinRoleBoy        → v2SelectJoinRole('boy')
//   #headerGearBtn        → yamToggleAccountModal()
//   .home-rappel-add-btn  → openRappelSheet()
//   .home-rappel-done     → homeRappelDone()
//   .home-rappel-later    → homeRappelNext()
//   .home-rappel-nav-btn  → homeRappelPrev() / homeRappelNext()
//   #rappelOverlay        → closeRappelSheet()
//   .rsh-close            → closeRappelSheet()
//   #rshInput             → rappelAdd() sur Enter
//   .rsh-submit           → rappelAdd()
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

// ══════════════════════════════════════════════════════════════════
// BLOC 1 — scrollRestoration
// Doit s'exécuter le plus tôt possible — pas de dépendances
// ══════════════════════════════════════════════════════════════════
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';


// ══════════════════════════════════════════════════════════════════
// BLOC 2 — Service Worker registration
// ══════════════════════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/yam-app/service-worker.js', { scope: '/yam-app/' })
      .then(function(reg) {
        console.log('⚡ [PWA] Service Worker enregistré :', reg.scope);
        reg.update();
      })
      .catch(function(err) {
        console.warn('[PWA] Service Worker échec :', err);
      });
  });
}


// ══════════════════════════════════════════════════════════════════
// BLOC 3 — Avatars par défaut
// Expose : window.yamAvatarHTML, window.yamSetAvatar,
//          window.yamAvatarSrc, window._yamSyncAllAvatarsForRole
// ══════════════════════════════════════════════════════════════════
(function(){
  var BASE = 'assets/images/';
  var DEFAULTS = { girl: 'assets/images/profil_girl.png', boy: 'assets/images/profil_boy.png' };

  window._yamRealAvatars = { girl: null, boy: null };

  function getSrc(role){
    return window._yamRealAvatars[role] || DEFAULTS[role] || DEFAULTS.girl;
  }

  window.yamAvatarHTML = function(role, sz){
    sz = sz || '100%';
    return '<img src="'+getSrc(role)+'" alt="" style="width:'+sz+';height:'+sz+';border-radius:50%;object-fit:cover;display:block;pointer-events:none;">';
  };

  window.yamSetAvatar = function(el, role){
    if(!el) return;
    var src = getSrc(role);
    var img = el.querySelector('img.yam-av-img');
    if(!img){
      el.textContent = '';
      img = document.createElement('img');
      img.className = 'yam-av-img';
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;pointer-events:none;';
      el.appendChild(img);
    }
    img.src = src;
  };

  window.yamAvatarSrc = function(role){ return getSrc(role); };

  window._yamSyncAllAvatarsForRole = function(role, url){
    window._yamRealAvatars[role] = url;
    document.querySelectorAll('.dm-avatar-' + role + ' img').forEach(function(img){ img.src = url; });
    var profile = (typeof getProfile === 'function') ? getProfile() : null;
    if(profile === role){
      var selfEl = document.getElementById('profileAvatarEmoji'); if(selfEl) selfEl.src = url;
      var selfMood = document.getElementById(role === 'girl' ? 'yamMoodElleAvatar' : 'yamMoodLuiAvatar');
      if(selfMood){ var i = selfMood.querySelector('img'); if(i) i.src = url; }
      var dmSelf = document.getElementById('dmHeaderAvatarSelf'); if(dmSelf){ var i2=dmSelf.querySelector('img'); if(i2) i2.src=url; }
    }
    if(profile && profile !== role){
      var othEl = document.getElementById('profileAvatarOtherEmoji'); if(othEl) othEl.src = url;
      var otherMood = document.getElementById(role === 'girl' ? 'yamMoodElleAvatar' : 'yamMoodLuiAvatar');
      if(otherMood){ var i3 = otherMood.querySelector('img'); if(i3) i3.src = url; }
      var dmOther = document.getElementById('dmHeaderAvatarOther'); if(dmOther){ var i4=dmOther.querySelector('img'); if(i4) i4.src=url; }
      var mhp = document.getElementById('mhpAvatar'); if(mhp){ var i5=mhp.querySelector('img'); if(i5) i5.src=url; }
    }
    var nousGirl = document.getElementById('nousProfilGirlAvatar'); if(nousGirl){ var ig=nousGirl.querySelector('img'); if(ig) ig.src = (role==='girl'?url:ig.src); }
    var nousBoy  = document.getElementById('nousProfilBoyAvatar');  if(nousBoy){  var ib=nousBoy.querySelector('img');  if(ib) ib.src  = (role==='boy' ?url:ib.src);  }
  };
})();


// ══════════════════════════════════════════════════════════════════
// BLOC 4 — Login page reload guard
// ══════════════════════════════════════════════════════════════════
(function(){
  // Ne pas recharger si un token de reset est dans le hash ou la query string — il serait perdu
  var _h = window.location.hash || '';
  var _q = window.location.search || '';
  if(_h.includes('type=recovery') || _h.includes('access_token') || _q.includes('type=recovery') || _q.includes('token_hash')) return;
  if(!sessionStorage.getItem('yam_login_page_reloaded')){
    sessionStorage.setItem('yam_login_page_reloaded','1');
    location.reload();
  }
})();


// ══════════════════════════════════════════════════════════════════
// BLOC 5 — visualViewport bottom-nav fix iOS
// ══════════════════════════════════════════════════════════════════
(function(){
  if (!window.visualViewport) return;
  var nav = document.querySelector('.bottom-nav');
  if (!nav) return;
  function fix() {
    var drift = window.innerHeight
              - window.visualViewport.height
              - window.visualViewport.offsetTop;
    nav.style.bottom = Math.max(0, drift) + 'px';
  }
  window.visualViewport.addEventListener('resize', fix);
  window.visualViewport.addEventListener('scroll', fix);
  fix();
})();


// ══════════════════════════════════════════════════════════════════
// BLOC 6 — Login V2 interface
// Expose : v2SelectJoinRole, v2SetError, v2SetLoading, v2CopyCode,
//          v2ApplyDynamicNames, yamSplashOpen
// NE redéfinit PAS : v2DoLogin, v2DoRegister, v2DoJoin, v2ShowLogin,
//                    v2HideLogin, v2SwitchTab, v2SelectRole (→ app-account.js)
// ══════════════════════════════════════════════════════════════════
var _v2SelectedJoinRole = null;

function v2SelectJoinRole(role){
  _v2SelectedJoinRole = role;
  document.getElementById('v2JoinRoleGirl').classList.toggle('selected', role==='girl');
  document.getElementById('v2JoinRoleBoy').classList.toggle('selected',  role==='boy');
}

function v2SetError(msg){ document.getElementById('v2LoginError').textContent = msg || ''; }
function v2SetLoading(on){
  document.getElementById('v2LoginLoader').style.display = on ? 'block' : 'none';
  document.querySelectorAll('.v2-btn').forEach(function(b){ b.disabled = on; });
}

function v2CopyCode(el, code){
  if(navigator.clipboard){
    navigator.clipboard.writeText(code).then(function(){
      el.textContent = '✅ Copié !';
      setTimeout(function(){ el.textContent = code; }, 2000);
    }).catch(function(){
      el.textContent = '✅ Copié !';
      setTimeout(function(){ el.textContent = code; }, 2000);
    });
  } else {
    el.textContent = '✅ Copié !';
    setTimeout(function(){ el.textContent = code; }, 2000);
  }
}

function v2ApplyDynamicNames(){
  if(typeof v2GetUser !== 'function') return;
  var u = v2GetUser();
  if(!u) return;

  var girlName = u.role === 'girl' ? (u.pseudo||'Moi') : (u.partner_pseudo||'Toi');
  var boyName  = u.role === 'boy'  ? (u.pseudo||'Moi')  : (u.partner_pseudo||'Toi');

  var btnGirl = document.getElementById('ppBtnGirl');
  var btnBoy  = document.getElementById('ppBtnBoy');
  if(typeof escHtml === 'function'){
    if(btnGirl) btnGirl.innerHTML = '<span class="profile-popup-dot girl"></span>' + escHtml(girlName);
    if(btnBoy)  btnBoy.innerHTML  = '<span class="profile-popup-dot boy"></span>'  + escHtml(boyName);
  } else {
    if(btnGirl) btnGirl.textContent = girlName;
    if(btnBoy)  btnBoy.textContent  = boyName;
  }

  var elleEl = document.getElementById('yamMoodElleName');
  var luiEl  = document.getElementById('yamMoodLuiName');
  if(elleEl) elleEl.textContent = girlName;
  if(luiEl)  luiEl.textContent  = boyName;

  var dmGirl = document.getElementById('dmIdNameGirl');
  var dmBoy  = document.getElementById('dmIdNameBoy');
  if(dmGirl) dmGirl.textContent = girlName;
  if(dmBoy)  dmBoy.textContent  = boyName;

  var gameGirlBtns = ['penduGenderGirl','puzzleGenderGirl','snakeGenderGirl'];
  var gameBoyBtns  = ['penduGenderBoy', 'puzzleGenderBoy', 'snakeGenderBoy'];
  gameGirlBtns.forEach(function(id){
    var el = document.getElementById(id); if(!el) return;
    var icon = el.querySelector('.gender-select-icon'); el.textContent = ''; if(icon) el.appendChild(icon); el.appendChild(document.createTextNode(girlName));
  });
  gameBoyBtns.forEach(function(id){
    var el = document.getElementById(id); if(!el) return;
    var icon = el.querySelector('.gender-select-icon'); el.textContent = ''; if(icon) el.appendChild(icon); el.appendChild(document.createTextNode(boyName));
  });

  var mgn = document.getElementById('memGenderGirlName'); if(mgn) mgn.textContent = girlName;
  var mbn = document.getElementById('memGenderBoyName');  if(mbn) mbn.textContent = boyName;

  var sgn = document.getElementById('skyjoAuthGirlName'); if(sgn) sgn.textContent = girlName;
  var sbn = document.getElementById('skyjoAuthBoyName');  if(sbn) sbn.textContent = boyName;

  var skyjoOpp = document.getElementById('skyjoOpponentLabel');
  var skyjoMy  = document.getElementById('skyjoMyLabel');
  if(u.role === 'girl'){
    if(skyjoMy)  skyjoMy.textContent  = girlName;
    if(skyjoOpp) skyjoOpp.textContent = boyName;
  } else {
    if(skyjoMy)  skyjoMy.textContent  = boyName;
    if(skyjoOpp) skyjoOpp.textContent = girlName;
  }
  var rlLeft  = document.getElementById('skyjoRoundLabelLeft');
  var rlRight = document.getElementById('skyjoRoundLabelRight');
  if(rlLeft)  rlLeft.textContent  = girlName;
  if(rlRight) rlRight.textContent = boyName;
  var flLeft  = document.getElementById('skyjoFinalLabelLeft');
  var flRight = document.getElementById('skyjoFinalLabelRight');
  if(flLeft)  flLeft.textContent  = girlName;
  if(flRight) flRight.textContent = boyName;

  var swg = document.getElementById('skyjoWaitNameGirl'); if(swg) swg.textContent = girlName;
  var swb = document.getElementById('skyjoWaitNameBoy');  if(swb) swb.textContent = boyName;

  var sgGirl = document.getElementById('sgBtnGirlName'); if(sgGirl) sgGirl.textContent = girlName;
  var sgBoy  = document.getElementById('sgBtnBoyName');  if(sgBoy)  sgBoy.textContent  = boyName;

  var prankLockTitle = document.getElementById('prankLockTitle');
  var partnerName = u.partner_pseudo || 'ton partenaire';
  if(prankLockTitle) prankLockTitle.textContent = 'Accès bloqué par ' + partnerName;
}

(function(){
  function checkV2Session(){
    try{
      var s = JSON.parse(localStorage.getItem('yam_session_v3')||'null');
      if(s && s.access_token && s.user) return true;
    }catch(e){}
    return false;
  }

  var _hash = window.location.hash || '';
  var _search = window.location.search || '';
  var _isReset = _hash.includes('type=recovery') || _search.includes('type=recovery') || _search.includes('token_hash');
  if(_isReset){
    var _params = {};
    // Lire d'abord la query string (nouveau format Supabase)
    _search.replace(/^\?/,'').split('&').forEach(function(p){
      var kv = p.split('='); if(kv[0]) _params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]||'');
    });
    // Lire aussi le hash (ancien format, compatibilité)
    _hash.replace(/^#/,'').split('&').forEach(function(p){
      var kv = p.split('='); if(kv[0]) _params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]||'');
    });
    // Nouveau format : token_hash + type=recovery → échange contre un access_token via Supabase
    if(_params['token_hash'] && !_params['access_token']){
      window._yamResetTokenHash = _params['token_hash'];
      window._yamResetToken = null; // sera résolu après l'échange
    } else {
      window._yamResetToken = _params['access_token'] || null;
    }
    history.replaceState(null,'', window.location.pathname);
    window.addEventListener('load', function(){
      var overlay = document.getElementById('v2LoginOverlay');
      if(overlay) overlay.classList.add('active');
      ['v2FormLogin','v2FormForgot','v2FormRegister','v2FormJoin'].forEach(function(id){
        var el = document.getElementById(id); if(el) el.style.display='none';
      });
      var tabs = document.getElementById('v2LoginTabs');
      if(tabs) tabs.style.display = 'none';
      var resetForm = document.getElementById('v2FormReset');
      if(resetForm) resetForm.style.display = '';
    });
  } else if(!checkV2Session()){
    var _sp = document.getElementById('yamSplashScreen');
    if(_sp) _sp.style.display = 'block';
    document.body.classList.add('splash-active');
  } else {
    window.addEventListener('load', function(){ setTimeout(v2ApplyDynamicNames, 200); });
  }

  window.yamSplashOpen = function(){
    console.log('[YAM DEBUG] yamSplashOpen - ouverture modal login');
    if(window.v2ShowLogin){
      window.v2ShowLogin();
    } else {
      // v2ShowLogin pas encore chargé — retry jusqu'à disponibilité
      var _retry = 0;
      var _iv = setInterval(function(){
        if(window.v2ShowLogin){ clearInterval(_iv); window.v2ShowLogin(); }
        else if(++_retry > 20){ clearInterval(_iv); } // abandon après 2s
      }, 100);
    }
  };
})();


// ══════════════════════════════════════════════════════════════════
// BLOC 7 — yamSwitchTab patch + scroll top
// ══════════════════════════════════════════════════════════════════
(function(){
  window.addEventListener('load', function(){
    setTimeout(function(){ }, 50);
  });

  function patchYamSwitchTab(){
    if(typeof window.yamSwitchTab !== 'function'){
      setTimeout(patchYamSwitchTab, 100);
      return;
    }
    var _orig = window.yamSwitchTab;
    window.yamSwitchTab = function(tab){
      _orig(tab);
      if(tab === 'messages'){
        setTimeout(function(){
          if(typeof window.openHiddenPage === 'function') window.openHiddenPage();
        }, 30);
      } else if(tab === 'nous'){
        setTimeout(function(){
          if(typeof window.nousCheckLock === 'function') window.nousCheckLock();
        }, 100);
        setTimeout(function(){ }, 220);
      } else {
        setTimeout(function(){ }, 220);
      }
    };
  }
  patchYamSwitchTab();
})();


// ══════════════════════════════════════════════════════════════════
// BLOC 8 — Sticky header universel
// Animation PROPORTIONNELLE au scroll : fondu progressif 0→SCROLL_FULL px
// Grand header s'efface / sticky apparaît en fonction de la position exacte
// Engrenage à droite → ouvre Paramètres (yamToggleAccountModal)
// ══════════════════════════════════════════════════════════════════
(function(){
  var TAB_TITLES = {
    home:    'Accueil',
    jeux:    'Jeux',
    musique: 'Musique',
    nous:    'Nous ♥',
    messages: null
  };

  // Zone de transition : le sticky apparaît progressivement sur les 60 premiers px de scroll
  // SCROLL_FULL : distance de scroll pour que l'animation soit complète
  // = hauteur du grand header (mesuré au runtime pour coller à la réalité)
  var SCROLL_FULL = 60; // valeur par défaut, écrasée au init()
  var _mainHeaderH = 60; // hauteur mesurée du grand header

  var currentTab    = 'home';
  var stickyEl      = null;
  var titleEl       = null;
  var mainHeader    = null;
  var ticking       = false;
  var _lastProgress = -1;

  function _getActiveScrollY() {
    // Lire le scrollTop du panel si scroll interne (overflow:auto + height fixe)
    // sinon window.scrollY (body scroll — Home, Nous, Musique)
    var tabIds = { home: 'yamHomeTab', nous: 'yamNousTab', jeux: 'yamJeuxTab', musique: 'yamMusiqueTab' };
    var panelId = tabIds[currentTab];
    if (panelId) {
      var panel = document.getElementById(panelId);
      if (panel) {
        var cs = getComputedStyle(panel);
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
          return panel.scrollTop;
        }
      }
    }
    return window.scrollY || window.pageYOffset || 0;
  }

  function applyProgress(progress) {
    // progress : 0.0 = grand header visible / 1.0 = sticky visible
    if (Math.abs(progress - _lastProgress) < 0.005) return;
    _lastProgress = progress;

    var isNowVisible = progress >= 1;
    var wasVisible   = stickyEl.classList.contains('visible');

    // ── Sticky header : glisse depuis le haut + fondu proportionnel ──
    // Le sticky est fixed → il recouvre le contenu sans rien pousser
    stickyEl.style.transition = 'none';
    stickyEl.style.opacity    = String(progress);
    stickyEl.style.transform  = 'translateY(' + ((1 - progress) * -100) + '%)';
    stickyEl.style.pointerEvents = progress > 0.5 ? 'auto' : 'none';

    // ── Grand header : glisse vers le haut proportionnellement au scroll ──
    // translateY = -progress × hauteur du header → sort progressivement hors écran
    // height/overflow ne changent JAMAIS → aucun saut dans le flow du body
    if (mainHeader) {
      var translateY = -progress * _mainHeaderH;
      mainHeader.style.transition    = 'none';
      mainHeader.style.opacity       = String(1 - progress);
      mainHeader.style.transform     = 'translateY(' + translateY + 'px)';
      mainHeader.style.pointerEvents = progress > 0.5 ? 'none' : '';
    }

    // ── Classes CSS (seuil à 1) ──
    if (isNowVisible && !wasVisible) {
      stickyEl.classList.add('visible');
      if (mainHeader) mainHeader.classList.add('sticky-hidden');
      document.body.classList.add('sticky-visible');
    } else if (!isNowVisible && wasVisible) {
      stickyEl.classList.remove('visible');
      if (mainHeader) mainHeader.classList.remove('sticky-hidden');
      document.body.classList.remove('sticky-visible');
    }
  }

  function resetToHidden() {
    _lastProgress = -1;
    if (!stickyEl) return;
    stickyEl.classList.remove('visible');
    stickyEl.style.transition    = 'none';
    stickyEl.style.opacity       = '0';
    stickyEl.style.transform     = 'translateY(-100%)';
    stickyEl.style.pointerEvents = 'none';
    if (mainHeader) {
      mainHeader.classList.remove('sticky-hidden');
      mainHeader.style.transition    = 'none';
      mainHeader.style.opacity       = '';
      mainHeader.style.transform     = '';
      mainHeader.style.height        = '';
      mainHeader.style.overflow      = '';
      mainHeader.style.visibility    = '';
      mainHeader.style.pointerEvents = '';
    }
    document.body.classList.remove('sticky-visible');
  }

  function updateSticky() {
    ticking = false;
    if (!stickyEl) return;
    if (currentTab === 'messages') { resetToHidden(); return; }
    var scrollY    = _getActiveScrollY();
    var progress   = Math.min(1, Math.max(0, scrollY / SCROLL_FULL));
    applyProgress(progress);
  }

  function onScroll() {
    if (!ticking) { window.requestAnimationFrame(updateSticky); ticking = true; }
  }

  function setTab(tab) {
    // Reset scrollTop uniquement pour les panels à scroll interne (overflow:auto)
    // Pour les panels body-scroll (Home, Nous, Musique), yamSwitchTab fait window.scrollTo(0,0)
    var tabIds = { home: 'yamHomeTab', nous: 'yamNousTab', jeux: 'yamJeuxTab', musique: 'yamMusiqueTab' };
    var prevPanelId = tabIds[currentTab];
    if (prevPanelId) {
      var prevPanel = document.getElementById(prevPanelId);
      if (prevPanel) {
        var cs = getComputedStyle(prevPanel);
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
          prevPanel.scrollTop = 0;
        }
      }
    }
    currentTab = tab;
    resetToHidden();
    if (!titleEl) return;
    var title = TAB_TITLES[tab];
    if (title) titleEl.textContent = title;
  }

  function init() {
    stickyEl   = document.getElementById('yamStickyHeader');
    titleEl    = document.getElementById('yamStickyHeaderTitle');
    mainHeader = document.getElementById('yamMainHeader');
    if (!stickyEl || !titleEl) return;

    // Mesurer la hauteur réelle du grand header pour que SCROLL_FULL soit exact
    // → progress atteint 1.0 exactement quand le header est sorti du viewport
    function measureHeader() {
      if (mainHeader && mainHeader.offsetHeight > 0) {
        _mainHeaderH = mainHeader.offsetHeight;
        SCROLL_FULL  = _mainHeaderH;
      }
    }
    measureHeader();
    window.addEventListener('load', measureHeader, { once: true });

    window.addEventListener('scroll', onScroll, { passive: true });
    document.querySelectorAll('.yam-tab-panel').forEach(function(panel) {
      panel.addEventListener('scroll', onScroll, { passive: true });
    });

    // Engrenage → ouvre Paramètres (setTimeout pour s'assurer qu'aucun autre code ne l'écrase)
    setTimeout(function() {
      var gearBtn = document.getElementById('yamStickyGearBtn');
      if (gearBtn) {
        gearBtn.onclick = function() {
          if (typeof window.yamToggleAccountModal === 'function') window.yamToggleAccountModal();
          else if (typeof window.openAccountModal === 'function') window.openAccountModal();
        };
      }
    }, 1500);

    function patchTitle() {
      if (typeof window.yamSwitchTab !== 'function') { setTimeout(patchTitle, 150); return; }
      var _orig = window.yamSwitchTab;
      window.yamSwitchTab = function(tab) { _orig(tab); setTab(tab); };
    }
    patchTitle();

    resetToHidden();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  document.body.classList.remove('nous-active');

})();


// ══════════════════════════════════════════════════════════════════
// BLOC 9 — Subviews + PrankMenu + AccountModal patch
// Expose : window.yamToggleAccountModal
// ══════════════════════════════════════════════════════════════════
(function() {
  var SUBVIEW_IDS = ['gamesView','quizView','memoryView','penduView','puzzleView','snakeView','skyjoView','ochoView','prankMenu'];

  function updateSubviewState() {
    var anyActive = SUBVIEW_IDS.some(function(id) {
      var el = document.getElementById(id);
      return el && (el.classList.contains('active') || el.classList.contains('show') || el.style.display === 'flex' || el.style.display === 'block');
    });
    document.body.classList.toggle('subview-active', anyActive);
  }

  function watchSubviews() {
    var obs = new MutationObserver(updateSubviewState);
    SUBVIEW_IDS.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) obs.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
    });
    updateSubviewState();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchSubviews);
  else setTimeout(watchSubviews, 300);

  function patchPrankMenu() {
    if (typeof window.openPrankMenu === 'function' && !window._prankPatched) {
      var _origOpen = window.openPrankMenu;
      window.openPrankMenu = function() {
        // Vérifier si le partenaire existe AVANT d'activer subview-active
        // pour ne pas bloquer la nav quand l'original bail out avec un toast
        var u = typeof yamGetUser === 'function' ? yamGetUser() : null;
        var hasPartner = u && u.partner_pseudo;
        _origOpen.apply(this, arguments);
        // N'activer subview-active que si le menu va vraiment s'ouvrir
        if (hasPartner) document.body.classList.add('subview-active');
      };
      var _origClose = window.closePrankMenu;
      if (typeof _origClose === 'function') {
        window.closePrankMenu = function() { _origClose.apply(this, arguments); setTimeout(updateSubviewState, 50); };
      }
      window._prankPatched = true;
    } else if (!window._prankPatched) {
      setTimeout(patchPrankMenu, 200);
    }
  }
  setTimeout(patchPrankMenu, 500);
})();

(function() {
  var HDR_MUSIQUE = 'Notre univers en musique';
  var HDR_DEFAULT = 'Notre univers';

  function updateHdrSub(tab) {
    var el = document.getElementById('hdrSub');
    if (!el) return;
    el.textContent = (tab === 'musique') ? HDR_MUSIQUE : HDR_DEFAULT;
  }

  function patchHdrSub() {
    if (typeof window.yamSwitchTab !== 'function') { setTimeout(patchHdrSub, 150); return; }
    var _orig = window.yamSwitchTab;
    window.yamSwitchTab = function(tab) { _orig(tab); updateHdrSub(tab); };
    updateHdrSub('home');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patchHdrSub);
  else patchHdrSub();
})();

window.yamToggleAccountModal = function() {
  var view = document.getElementById('settingsView');
  if (!view) return;
  if (view.classList.contains('active')) {
    if (typeof window.closeAccountModal === 'function') window.closeAccountModal();
  } else {
    if (typeof window.openAccountModal === 'function') window.openAccountModal();
  }
};

// Patcher closeAccountModal pour revenir sur l'accueil après fermeture
(function() {
  function patchClose() {
    if (typeof window.closeAccountModal !== 'function') { setTimeout(patchClose, 200); return; }
    var _orig = window.closeAccountModal;
    window.closeAccountModal = function() {
      _orig.apply(this, arguments);
      // Toujours revenir sur l'accueil après fermeture des paramètres
      if (typeof window.yamSwitchTab === 'function') window.yamSwitchTab('home');
    };
  }
  patchClose();
})();


// ══════════════════════════════════════════════════════════════════
// BLOC 10 — DM online status observer
// ══════════════════════════════════════════════════════════════════
(function(){
  var ONLINE_COLOR_PART = '34, 197, 94';

  function isOtherOnline() {
    var dot = document.getElementById('dmHeaderDotOther');
    if (!dot) return false;
    return window.getComputedStyle(dot).backgroundColor.indexOf(ONLINE_COLOR_PART) !== -1;
  }

  function updateDmStatus() {
    var status = document.getElementById('dmStatus');
    if (!status) return;
    if (isOtherOnline()) {
      status.textContent = '• En ligne'; status.style.color = '#22c55e';
    } else {
      status.textContent = '• Hors ligne'; status.style.color = 'var(--muted)';
    }
  }

  function startObserver() {
    var dot = document.getElementById('dmHeaderDotOther');
    if (!dot) return false;
    new MutationObserver(function() { setTimeout(updateDmStatus, 30); })
      .observe(dot, { attributes: true, attributeFilter: ['style'] });
    return true;
  }

  function init() { startObserver(); updateDmStatus(); setInterval(updateDmStatus, 3000); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();


// ══════════════════════════════════════════════════════════════════
// BLOC 11 — Modales : clic dehors pour fermer
// ══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function(){
  ['activiteModal','histoireItemModal'].forEach(function(id){
    var m = document.getElementById(id);
    if (!m) return;
    m.addEventListener('click', function(e){ if (e.target === m) m.classList.remove('open'); });
  });
});


// ══════════════════════════════════════════════════════════════════
// BLOC 12 — Home tab : mascotte IA + rappels + humeur
// Expose : window.homeRappelNext, window.homeRappelPrev,
//          window.homeRappelDone, window.openRappelSheet,
//          window.closeRappelSheet, window.rappelAdd,
//          window._homeSyncMood, window._homeSyncSpam
// ══════════════════════════════════════════════════════════════════

/* ══ Mascotte IA ══ */
(function(){
  var GROQ_EDGE  = SB_URL + '/functions/v1/gemini-suggest';
  var PER_SLOT   = 5;
  var _phrases   = [];
  var _lastIdx   = -1;
  var _generating= false;

  function _sess(){ try{ return JSON.parse(localStorage.getItem('yam_session_v3')||'null'); }catch(e){return null;} }
  function _userId(){   var s=_sess(); return s&&s.user?s.user.id:null; }
  function _coupleId(){ var s=_sess(); return s&&s.user?s.user.couple_id:null; }
  function _role(){     var s=_sess(); return s&&s.user?(s.user.role||null):null; }
  function _partner(){  var s=_sess(); return s&&s.user&&s.user.partner_pseudo?s.user.partner_pseudo:null; }

  function _today(){
    var d=new Date();
    return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
  }

  function _currentState(){
    var now = new Date();
    var totalMin = now.getHours()*60 + now.getMinutes();
    if(totalMin >= 300 && totalMin < 720){
      return { slot:'matin', slotIdx:0, phraseIdx:Math.min(4, Math.floor((totalMin-300)/84)) };
    }
    if(totalMin >= 720 && totalMin < 1140){
      return { slot:'après-midi', slotIdx:1, phraseIdx:Math.min(4, Math.floor((totalMin-720)/84)) };
    }
    var elapsed = (totalMin >= 1140) ? totalMin - 1140 : totalMin + 300;
    return { slot:'soir', slotIdx:2, phraseIdx:Math.min(4, Math.floor(elapsed/120)) };
  }

  function _globalIdx(state){ return state.slotIdx * PER_SLOT + state.phraseIdx; }
  function _lkey(uid){ return 'yam_mascot_'+uid; }
  function _sbSlot(role){ return _today()+'_'+role; }

  function _loadLocal(uid){
    try{
      var o=JSON.parse(localStorage.getItem(_lkey(uid))||'null');
      if(o&&o.date===_today()&&Array.isArray(o.phrases)&&o.phrases.length===15){
        var empty=o.phrases.filter(function(p){return !p||p.length<4;}).length;
        if(empty<=5) return o.phrases;
        localStorage.removeItem(_lkey(uid));
      }
    }catch(e){}
    return null;
  }
  function _saveLocal(uid,phrases){
    try{ localStorage.setItem(_lkey(uid),JSON.stringify({date:_today(),phrases:phrases})); }catch(e){}
  }
  function _loadSB(cid,role,cb){
    fetch(SB_URL+'/rest/v1/photo_descs?couple_id=eq.'+cid+'&category=eq.mascot&slot=eq.'+encodeURIComponent(_sbSlot(role))+'&select=description&limit=1',{headers:sb2Headers()})
    .then(function(r){return r.ok?r.json():[];})
    .then(function(rows){
      if(rows&&rows[0]&&rows[0].description){
        try{
          var p=JSON.parse(rows[0].description);
          if(Array.isArray(p)&&p.length===15){
            var empty=p.filter(function(t){return !t||t.length<4;}).length;
            if(empty<=5){cb(p);return;}
          }
        }catch(e){}
      }
      cb(null);
    }).catch(function(){cb(null);});
  }
  function _saveSB(cid,role,phrases){
    fetch(SB_URL+'/rest/v1/photo_descs',{
      method:'POST',
      headers:sb2Headers({'Prefer':'resolution=merge-duplicates,return=minimal','Content-Type':'application/json'}),
      body:JSON.stringify({couple_id:cid,category:'mascot',slot:_sbSlot(role),description:JSON.stringify(phrases)})
    }).catch(function(){});
  }

  function _setLoading(on){
    var ld=document.getElementById('homeMsgLoading');
    var tx=document.getElementById('homeMsgInner');
    if(ld) ld.style.display=on?'inline-flex':'none';
    if(tx) tx.style.display=on?'none':'';
  }
  function _show(idx){
    if(!_phrases.length||idx<0||idx>=_phrases.length) return;
    var el=document.getElementById('homeMsgInner');
    if(!el) return;
    var text=_phrases[idx];
    if(!text||text.length<4){
      for(var d=1;d<15;d++){
        var a=_phrases[(idx+d)%15], b=_phrases[(idx-d+15)%15];
        if(a&&a.length>=4){text=a;break;}
        if(b&&b.length>=4){text=b;break;}
      }
    }
    if(!text||text.length<4) return;
    if(_lastIdx===idx&&el.textContent===text) return;
    _lastIdx=idx;
    el.style.opacity='0';
    setTimeout(function(){ el.textContent=text; el.style.transition='opacity 0.4s ease'; el.style.opacity='1'; },160);
  }

  function _refreshDisplay(){ if(!_phrases.length) return; _show(_globalIdx(_currentState())); }
  function _startAutoRotate(){ _refreshDisplay(); setInterval(function(){ _refreshDisplay(); }, 60*1000); }

  function _makePrompts(role,partnerName,daysTogether,saison){
    var isBoy=role==='boy', proSuj=isBoy?'elle':'il', proCompl=isBoy?'la':'le',
        proInd=isBoy?'lui':'lui', adj=isBoy?'ta copine':'ton copain',
        pNom=partnerName||adj, moi=isBoy?'un garçon':'une fille',
        ProSuj=proSuj.charAt(0).toUpperCase()+proSuj.slice(1);
    var base='Tu es YAM, mascotte d\'une app pour couples. Tu parles DIRECTEMENT a '+moi+'. Saison : '+saison+'. Ensemble depuis '+daysTogether+' jours. Écris UNE phrase (10 mots max). REGLES : pas de guillemets, pas d\'explication, juste la phrase. Direct, vivant. 1 emoji max.';
    var matin=[
      base+' C\'est le matin, juste après le réveil. Demande si '+moi+' a bien dormi ou souhaite-lui un bon réveil.',
      base+' C\'est le matin. Suggère d\'envoyer un premier message de la journée à '+pNom+'.',
      base+' C\'est le matin. Rappelle de définir son humeur du jour dans l\'app.',
      base+' C\'est le matin. Glisse que son/sa partenaire lui manque peut-être au réveil. Utilise "'+proSuj+'".',
      base+' C\'est le matin. Souhaite une belle journée liée à la relation.',
    ];
    var aprem=[
      base+' C\'est l\'après-midi. Demande comment se passe la journée.',
      base+' C\'est l\'après-midi. Propose une partie de jeu dans l\'app avec '+pNom+' (Memory, Skyjo, Pendu).',
      base+' C\'est l\'après-midi. Encourage à écrire un petit mot doux dans l\'app.',
      base+' C\'est l\'après-midi. Suggère malicieusement d\'envoyer une bêtise à '+pNom+'.',
      base+' C\'est l\'après-midi. Rappelle de penser à son/sa partenaire. Utilise "'+proSuj+'".',
    ];
    var soir=[
      base+' C\'est le soir. Demande si la journée s\'est bien passée.',
      base+' C\'est le soir. Propose d\'écouter ou partager une chanson avec '+pNom+'.',
      base+' C\'est le soir. Suggère d\'appeler ou entendre la voix du/de la partenaire. Utilise "'+adj+'".',
      base+' C\'est le soir. Parle des souvenirs dans l\'app ou propose d\'en ajouter un.',
      base+' C\'est le soir. Rappelle combien de jours ils sont ensemble ('+daysTogether+' jours) de façon tendre.',
    ];
    return matin.concat(aprem).concat(soir);
  }

  function _generate(cid,role,onDone){
    if(_generating) return;
    _generating=true; _setLoading(true);
    var pName=_partner(), days=window.startDate?Math.floor((Date.now()-new Date(window.startDate))/(1000*60*60*24)):0;
    var saison=['hiver','hiver','printemps','printemps','printemps','été','été','été','automne','automne','automne','hiver'][new Date().getMonth()];
    var prompts=_makePrompts(role,pName,days,saison), collected=[];
    function _next(i){
      if(i>=15){
        _generating=false;
        while(collected.length<15) collected.push('');
        _saveSB(cid,role,collected);
        var uid=_userId(); if(uid) _saveLocal(uid,collected);
        onDone(collected); return;
      }
      fetch(GROQ_EDGE,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+(yamGetAccessToken?yamGetAccessToken():SB_ANON_KEY),'apikey':SB_ANON_KEY},body:JSON.stringify({prompt:prompts[i]})})
      .then(function(r){return r.json();})
      .then(function(d){ var t=(d.text||'').trim().replace(/^[""\"«»\-–—]+|[""\"«»]+$/g,'').trim(); collected.push(t&&t.length>3?t:''); setTimeout(function(){_next(i+1);},280); })
      .catch(function(){collected.push(''); setTimeout(function(){_next(i+1);},350);});
    }
    _next(0);
  }

  function _load(){
    var uid=_userId(), cid=_coupleId(), role=_role();
    if(!uid||!cid||!role){ _setLoading(false); var el=document.getElementById('homeMsgInner'); if(el) el.textContent='Connecte-toi pour découvrir tes messages du jour 💕'; return; }
    var local=_loadLocal(uid);
    if(local){ _phrases=local; _setLoading(false); _startAutoRotate(); return; }
    _loadSB(cid,role,function(sb){
      if(sb){ _phrases=sb; _saveLocal(uid,sb); _setLoading(false); _startAutoRotate(); return; }
      _generate(cid,role,function(phrases){ _phrases=phrases; _setLoading(false); _startAutoRotate(); });
    });
  }

  window.addEventListener('load',function(){
    setTimeout(function(){
      _load();
      var _origSP=window.setProfile;
      window.setProfile=function(g){ if(_origSP) _origSP(g); if(g&&!_phrases.length) setTimeout(_load,700); };
    },500);
  });
})();

/* ══ Rappels du jour ══ */
(function(){
  var GROQ  = SB_URL + '/functions/v1/gemini-suggest';
  var CAT   = 'yam_rappels';
  var SLOT  = 'v1';
  var _data = [];
  var _idx  = 0;

  function _s(){ try{return JSON.parse(localStorage.getItem('yam_session_v3')||'null');}catch(e){return null;} }
  function _cid(){ var s=_s(); return s&&s.user?s.user.couple_id:null; }
  function _uid2(){ return Math.random().toString(36).slice(2,9)+Date.now().toString(36); }

  var _rowId = null;

  function _load(cb){
    var cid=_cid(); if(!cid){cb([]);return;}
    fetch(SB_URL+'/rest/v1/photo_descs?couple_id=eq.'+cid+'&category=eq.'+CAT+'&slot=eq.'+SLOT+'&select=id,description&limit=1',{headers:sb2Headers()})
    .then(function(r){return r.ok?r.json():[];})
    .then(function(rows){
      if(rows&&rows[0]){ _rowId=rows[0].id||null; try{var p=JSON.parse(rows[0].description||'');if(Array.isArray(p)){cb(p);return;}}catch(e){} }
      cb([]);
    }).catch(function(){cb([]);});
  }

  function _save(){
    var cid=_cid(); if(!cid)return;
    _lastHash=_hash(_data);
    if(_rowId){
      fetch(SB_URL+'/rest/v1/photo_descs?id=eq.'+_rowId,{method:'PATCH',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),body:JSON.stringify({description:JSON.stringify(_data)})}).catch(function(){});
    } else {
      fetch(SB_URL+'/rest/v1/photo_descs',{method:'POST',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=representation'}),body:JSON.stringify({couple_id:cid,category:CAT,slot:SLOT,description:JSON.stringify(_data)})})
      .then(function(r){return r.ok?r.json():null;}).then(function(rows){if(rows&&rows[0])_rowId=rows[0].id;}).catch(function(){});
    }
  }

  function _active(){ return _data.filter(function(r){return !r.done;}); }
  function _done(){   return _data.filter(function(r){return r.done;}); }

  function _card(){
    var act=_active(), el=document.getElementById('homeRappelText'), ctr=document.getElementById('homeRappelCounter');
    var actRow=document.querySelector('.home-rappel-actions'), navRow=document.querySelector('.home-rappel-nav'), sep=document.querySelector('.home-rappel-sep');
    if(!act.length){
      if(el)  el.textContent='Tous vos rappels sont faits 🎉';
      if(ctr) ctr.textContent='';
      [actRow,navRow,sep].forEach(function(e){if(e)e.style.display='none';});
      return;
    }
    [actRow,navRow,sep].forEach(function(e){if(e)e.style.display='';});
    if(_idx>=act.length) _idx=0;
    if(el)  el.textContent=act[_idx].text;
    if(ctr) ctr.textContent=(_idx+1)+'/'+act.length;
  }

  window.homeRappelNext=function(){ var act=_active(); if(!act.length)return; _idx=(_idx+1)%act.length; _card(); };
  window.homeRappelPrev=function(){ var act=_active(); if(!act.length)return; _idx=(_idx-1+act.length)%act.length; _card(); };
  window.homeRappelDone=function(){
    var act=_active(); if(!act.length)return;
    var item=act[_idx];
    _data.forEach(function(r){if(r.id===item.id)r.done=true;});
    _save();
    if(typeof showToast==='function') showToast('Bravo ! 💕','success');
    if(typeof window.yamFlameActivity==='function') window.yamFlameActivity('rappel_done');
    var newAct=_active();
    if(_idx>=newAct.length)_idx=Math.max(0,newAct.length-1);
    _card(); _sheet();
  };

  function _sheet(){
    var list=document.getElementById('rshList'); if(!list)return;
    list.innerHTML='';
    var sorted=_active().concat(_done());
    if(!sorted.length){
      var d=document.createElement('div'); d.className='rsh-empty'; d.textContent='Aucun rappel — YAM va en proposer 💭'; list.appendChild(d); return;
    }
    sorted.forEach(function(item){
      var row=document.createElement('div');
      row.className='rsh-item'+(item.done?' rsh-done':'');
      var chk=document.createElement('div');
      chk.className='rsh-check'+(item.done?' on':'');
      chk.textContent=item.done?'✓':'';
      chk.onclick=function(){
        _data.forEach(function(r){if(r.id===item.id)r.done=!r.done;});
        _save(); var newAct=_active(); if(_idx>=newAct.length)_idx=Math.max(0,newAct.length-1); _card(); _sheet();
      };
      var txt=document.createElement('div');
      txt.className='rsh-item-txt'; txt.textContent=item.text; txt.contentEditable='true'; txt.spellcheck=false;
      txt.onblur=function(){ var v=txt.textContent.trim(); if(!v){txt.textContent=item.text;return;} _data.forEach(function(r){if(r.id===item.id)r.text=v;}); _save(); _card(); };
      txt.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();txt.blur();}};
      var del=document.createElement('button');
      del.className='rsh-del'; del.innerHTML='&times;'; del.title='Supprimer';
      del.onclick=function(){ _data=_data.filter(function(r){return r.id!==item.id;}); _save(); var newAct=_active(); if(_idx>=newAct.length)_idx=Math.max(0,newAct.length-1); _card(); _sheet(); };
      row.appendChild(chk); row.appendChild(txt); row.appendChild(del);
      list.appendChild(row);
    });
  }

  window.openRappelSheet=function(){
    _sheet();
    document.getElementById('rappelSheet').classList.add('open');
    document.getElementById('rappelOverlay').classList.add('open');
    setTimeout(function(){var i=document.getElementById('rshInput');if(i)i.focus();},340);
  };
  window.closeRappelSheet=function(){
    document.getElementById('rappelSheet').classList.remove('open');
    document.getElementById('rappelOverlay').classList.remove('open');
  };
  window.rappelAdd=function(){
    var inp=document.getElementById('rshInput'); if(!inp)return;
    var v=inp.value.trim(); if(!v)return;
    _data.push({id:_uid2(),text:v,done:false});
    _save(); inp.value=''; _card(); _sheet();
  };

  function _todayStr(){ var d=new Date(); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
  function _canGenToday(){ try{ return localStorage.getItem('yam_rgen_'+(_cid()||'')) !== _todayStr(); }catch(e){ return true; } }
  function _markGenToday(){ try{ localStorage.setItem('yam_rgen_'+(_cid()||''), _todayStr()); }catch(e){} }

  function _genAI(){
    var cid=_cid(); if(!cid) return;
    if(!_canGenToday()) return;
    if(_data.length>0) return;
    var loader=document.getElementById('rshLoader'); if(loader) loader.style.display='flex';
    var prompts=[
      'Écris UN rappel de couple en 4 mots maximum. Impératif. S\'adresse aux DEUX ensemble. Pas de "je", pas de prénom, pas de "mon amour", pas de "vous deux". Thème : geste tendre. Réponds UNIQUEMENT avec la phrase, rien d\'autre.',
      'Écris UN rappel de couple en 4 mots maximum. Impératif. S\'adresse aux DEUX ensemble. Pas de "je", pas de prénom. Thème : se parler, s\'appeler, message. Réponds UNIQUEMENT avec la phrase, rien d\'autre.',
      'Écris UN rappel de couple en 4 mots maximum. Impératif. S\'adresse aux DEUX ensemble. Pas de "je", pas de prénom. Thème : activité partagée. Réponds UNIQUEMENT avec la phrase, rien d\'autre.',
    ];
    var col=[];
    function _nx(i){
      if(i>=3){
        if(loader) loader.style.display='none';
        if(!col.length) col=['Faites-vous un bisou 😘','Appelez-vous ce soir 📞','Partagez une chanson 🎵'];
        _markGenToday();
        col.forEach(function(t){ _data.push({id:_uid2(),text:t,done:false}); });
        _save(); _card(); _sheet(); return;
      }
      fetch(GROQ,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+(yamGetAccessToken?yamGetAccessToken():SB_ANON_KEY),'apikey':SB_ANON_KEY},body:JSON.stringify({prompt:prompts[i]})})
      .then(function(r){return r.json();}).then(function(d){ var t=(d.text||'').trim().replace(/^[""\"«»\-–—\s]+|[""\"«»\s]+$/g,'').trim(); if(t&&t.length>2&&t.length<60) col.push(t); setTimeout(function(){_nx(i+1);},280); })
      .catch(function(){setTimeout(function(){_nx(i+1);},320);});
    }
    _nx(0);
  }

  var _pollTimer=null, _lastHash='';
  function _hash(arr){ return arr.map(function(r){return r.id+':'+(r.done?'1':'0')+':'+r.text;}).join('|'); }

  function _init(){
    var cid=_cid();
    if(!cid){ _data=[{id:'d1',text:'Faites-vous un bisou 😘',done:false},{id:'d2',text:'Appelez-vous ce soir 📞',done:false},{id:'d3',text:'Partagez une chanson 🎵',done:false}]; _card(); return; }
    _load(function(loaded){ _data=loaded; _lastHash=_hash(_data); if(_data.length===0&&_canGenToday()) _genAI(); else _card(); });
    _startPoll();
  }

  function _startPoll(){
    if(_pollTimer) clearInterval(_pollTimer);
    _pollTimer=setInterval(function(){
      if(document.hidden) return;
      var cid=_cid(); if(!cid) return;
      _load(function(fresh){ var h=_hash(fresh); if(h!==_lastHash){ _data=fresh; _lastHash=h; var act=_active(); if(_idx>=act.length)_idx=Math.max(0,act.length-1); _card(); var sheet=document.getElementById('rappelSheet'); if(sheet&&sheet.classList.contains('open')) _sheet(); }});
    }, 8000);
  }

  document.addEventListener('visibilitychange', function(){
    if(!document.hidden){ var cid=_cid(); if(!cid) return; _load(function(fresh){ var h=_hash(fresh); if(h!==_lastHash){ _data=fresh; _lastHash=h; var act=_active(); if(_idx>=act.length)_idx=Math.max(0,act.length-1); _card(); var sheet=document.getElementById('rappelSheet'); if(sheet&&sheet.classList.contains('open')) _sheet(); }}); }
  });

  document.addEventListener('DOMContentLoaded',_init);
  var _prev=window.setProfile;
  window.setProfile=function(g){ if(_prev)_prev(g); if(g)setTimeout(_init,900); };
})();

/* ══ Sync humeurs + online + avatars ══ */
(function(){
  function homeSyncMood(){
    var profile=window.getProfile?window.getProfile():(typeof v2GetUser==='function'?(v2GetUser()?(v2GetUser().role||null):null):null);
    var user=typeof v2GetUser==='function'?v2GetUser():null;
    if(user){
      var selfName=user.pseudo||'Moi', partName=user.partner_pseudo||'Toi';
      if(profile==='girl'){ var n=document.getElementById('homeMoodElleName');if(n)n.textContent=selfName; var m=document.getElementById('homeMoodLuiName');if(m)m.textContent=partName; }
      else if(profile==='boy'){ var n=document.getElementById('homeMoodLuiName');if(n)n.textContent=selfName; var m=document.getElementById('homeMoodElleName');if(m)m.textContent=partName; }
    }
    var elleEditBtn=document.getElementById('homeMoodElleEditBtn'), luiEditBtn=document.getElementById('homeMoodLuiEditBtn');
    if(elleEditBtn) elleEditBtn.style.display=(profile==='girl')?'':'none';
    if(luiEditBtn)  luiEditBtn.style.display=(profile==='boy')?'':'none';
    var selfMoodEl=document.getElementById('profileMoodSelf'), otherMoodEl=document.getElementById('profileMoodOther');
    var selfEmoji=selfMoodEl&&selfMoodEl.classList.contains('visible')?selfMoodEl.textContent.trim():'';
    var otherEmoji=otherMoodEl&&otherMoodEl.classList.contains('visible')?otherMoodEl.textContent.trim():'';
    var labels=(profile==='boy')?(window.MOOD_LABELS_BOY||{}):(window.MOOD_LABELS||{});
    var selfLabel=selfEmoji?(labels[selfEmoji]||''):'';
    var otherProfile=(profile==='girl')?'boy':'girl';
    var otherLabels=(otherProfile==='boy')?(window.MOOD_LABELS_BOY||{}):(window.MOOD_LABELS||{});
    var otherLabel=otherEmoji?(otherLabels[otherEmoji]||''):'';
    var selfMessage=window._myMoodMessage||'', otherMessage=window._otherMoodMessage||'';
    function setMoodCard(cardId,emojiId,labelId,quoteId,emoji,label,message){
      var emojiEl=document.getElementById(emojiId), labelEl=document.getElementById(labelId), quoteEl=document.getElementById(quoteId);
      if(emojiEl) emojiEl.textContent=emoji||'';
      if(labelEl) labelEl.textContent=label||(emoji?'':'Humeur');
      if(quoteEl){ if(message&&message.trim()){quoteEl.textContent=message.trim();quoteEl.style.fontStyle='italic';}else if(emoji){quoteEl.textContent=label||emoji;quoteEl.style.fontStyle='normal';}else{quoteEl.textContent='—';quoteEl.style.fontStyle='normal';} }
    }
    if(profile==='girl'){
      setMoodCard('homeMoodElle','homeMoodElleEmoji','homeMoodElleLabel','homeMoodElleQuote',selfEmoji,selfLabel,selfMessage);
      setMoodCard('homeMoodLui','homeMoodLuiEmoji','homeMoodLuiLabel','homeMoodLuiQuote',otherEmoji,otherLabel,otherMessage);
    } else {
      setMoodCard('homeMoodLui','homeMoodLuiEmoji','homeMoodLuiLabel','homeMoodLuiQuote',selfEmoji,selfLabel,selfMessage);
      setMoodCard('homeMoodElle','homeMoodElleEmoji','homeMoodElleLabel','homeMoodElleQuote',otherEmoji,otherLabel,otherMessage);
    }
    var dot=document.getElementById('presenceDot'), otherOnline=!!(dot&&dot.classList.contains('visible')), selfOnline=!!profile;
    function setOnline(statusId,dotId,isOnline){ var statusEl=document.getElementById(statusId),dotEl=document.getElementById(dotId); if(statusEl){statusEl.textContent=isOnline?'En ligne':'Hors ligne';statusEl.className='home-mood-status'+(isOnline?' online':'');} if(dotEl)dotEl.className='home-mood-online'+(isOnline?' online':''); }
    if(profile==='girl'){setOnline('homeMoodElleStatus','homeMoodElleOnline',selfOnline);setOnline('homeMoodLuiStatus','homeMoodLuiOnline',otherOnline);}
    else{setOnline('homeMoodLuiStatus','homeMoodLuiOnline',selfOnline);setOnline('homeMoodElleStatus','homeMoodElleOnline',otherOnline);}
    function syncAvatar(imgId,role){ var img=document.getElementById(imgId);if(!img)return; var realAv=window._yamRealAvatars&&window._yamRealAvatars[role]; if(realAv)img.src=realAv; else img.src='assets/images/profil_'+role+'.png'; }
    syncAvatar('homeMoodElleAvatar','girl'); syncAvatar('homeMoodLuiAvatar','boy');
  }

  function homeSyncSpam(){
    var daily=(typeof _getDailyCount==='function')?_getDailyCount():0;
    if(typeof _updateSpamBar==='function') _updateSpamBar(daily);
    if(typeof _heartMilestones!=='undefined'&&typeof _lastMilestone!=='undefined'){
      for(var i=_heartMilestones.length-1;i>=0;i--){ if(daily>=_heartMilestones[i]){_lastMilestone=_heartMilestones[i];break;} }
    }
  }

  function homeSyncMascot(){
    var img=document.getElementById('homeMascotImg'); if(!img) return;
    var navMus=document.getElementById('navMusique'), navPlaying=navMus&&navMus.classList.contains('music-playing');
    var audioPlaying=window._yamCurrentAudio&&!window._yamCurrentAudio.paused;
    var isPlaying=navPlaying||audioPlaying;
    var newSrc=isPlaying?'https://raw.githubusercontent.com/jayaana/yam-app/main/assets/images/yam_dance.gif':'https://raw.githubusercontent.com/jayaana/yam-app/main/assets/images/yam_start.gif';
    if(img.src!==newSrc) img.src=newSrc;
  }

  document.addEventListener('DOMContentLoaded',function(){
    setTimeout(homeSyncMood,500); setTimeout(homeSyncSpam,800);
    setInterval(homeSyncMood,8000); setInterval(homeSyncSpam,5000); setInterval(homeSyncMascot,1000);
  });

  window._homeSyncMood=homeSyncMood;
  window._homeSyncSpam=homeSyncSpam;
})();


// ══════════════════════════════════════════════════════════════════
// BLOC 13 — Avatar sync topbar / setProfile patch
// ══════════════════════════════════════════════════════════════════
(function(){
  function initDefaultAvatars(){
    var profile=(typeof getProfile==='function')?getProfile():null, self=profile||'girl', other=(self==='girl')?'boy':'girl';
    var elEmoji=document.getElementById('profileAvatarEmoji'), othEmoji=document.getElementById('profileAvatarOtherEmoji');
    if(elEmoji&&elEmoji.tagName==='IMG')  elEmoji.src=window.yamAvatarSrc(self);
    if(othEmoji&&othEmoji.tagName==='IMG') othEmoji.src=window.yamAvatarSrc(other);
    var moodElle=document.getElementById('yamMoodElleAvatar'), moodLui=document.getElementById('yamMoodLuiAvatar');
    if(moodElle){var img=moodElle.querySelector('img');if(img)img.src=window.yamAvatarSrc('girl');}
    if(moodLui) {var img2=moodLui.querySelector('img'); if(img2)img2.src=window.yamAvatarSrc('boy');}
    var dmSelf=document.getElementById('dmHeaderAvatarSelf'), dmOther=document.getElementById('dmHeaderAvatarOther');
    if(dmSelf) {var i1=dmSelf.querySelector('img'); if(i1)i1.src=window.yamAvatarSrc(self);}
    if(dmOther){var i2=dmOther.querySelector('img');if(i2)i2.src=window.yamAvatarSrc(other);}
    var mhp=document.getElementById('mhpAvatar'); if(mhp){var im=mhp.querySelector('img');if(im)im.src=window.yamAvatarSrc(self);}
  }

  function patchAcSync(){
    var orig=window._acSyncAvatarTopbar;
    if(!orig){setTimeout(patchAcSync,200);return;}
    window._acSyncAvatarTopbar=function(profile,avatarUrl){
      if(orig) orig.apply(this,arguments);
      var avEl=document.getElementById('profileAvatarEmoji');
      if(avEl&&avEl.tagName==='IMG'){ if(!avatarUrl) avEl.src=window.yamAvatarSrc(profile||getProfile()||'girl'); }
      initDefaultAvatars();
    };
  }

  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',function(){initDefaultAvatars();patchAcSync();}); }
  else { initDefaultAvatars(); patchAcSync(); }

  function hookSetProfile(){
    if(typeof window.setProfile!=='function'){setTimeout(hookSetProfile,300);return;}
    if(window._yamAvatarHooked) return;
    window._yamAvatarHooked=true;
    var orig=window.setProfile;
    window.setProfile=function(p){orig.apply(this,arguments);setTimeout(initDefaultAvatars,100);};
  }
  setTimeout(hookSetProfile,500);
})();


// ══════════════════════════════════════════════════════════════════
// BLOC 14 — Cowatch live — Realtime INSERT/UPDATE + fallback poll 5s
// ══════════════════════════════════════════════════════════════════
// Surveille cowatch_sessions via Supabase Realtime.
// Les sessions sont fermées par PATCH active=false (UPDATE), jamais par DELETE.
// → event:'*' sur cowatch_sessions suffit : INSERT (création) + UPDATE (active→false).
// Pas besoin de REPLICA IDENTITY FULL car le filtre couple_id est sur INSERT/UPDATE,
// pas sur DELETE.
// Fallback poll 5s si Realtime indispo (même pattern que jx_lobby dans dashboard).
// ══════════════════════════════════════════════════════════════════
(function(){
  var TABLE      = 'cowatch_sessions';
  var _liveIv    = null;   // fallback poll interval
  var _rtChannel = null;   // channel Realtime actif

  /* ── Logique métier commune : pill + navJeux glow ── */
  function _checkLive(){
    var u = typeof v2GetUser === 'function' ? v2GetUser() : null;
    var coupleId = u ? u.couple_id : null;
    var pill = document.getElementById('cwLivePill');
    if (!pill) return;
    if (!coupleId) { pill.style.display = 'none'; return; }

    fetch(
      SB_URL + '/rest/v1/' + TABLE +
      '?couple_id=eq.' + encodeURIComponent(coupleId) +
      '&active=eq.true&order=updated_at.desc&limit=1',
      { headers: sb2Headers() }
    )
    .then(function(r){ return r.json(); })
    .then(function(rows){
      _applyLiveState(!!(rows && rows.length && rows[0].active));
    }).catch(function(){});
  }

  /* ── Applique l'état live : pill + navJeux ── */
  function _applyLiveState(show){
    var pill      = document.getElementById('cwLivePill');
    var modalOpen = document.getElementById('cwOv') &&
                    document.getElementById('cwOv').classList.contains('on');

    if (pill) pill.style.display = (show && !modalOpen) ? 'inline-flex' : 'none';

    var navJeuxEl = document.getElementById('navJeux');
    if (navJeuxEl) {
      var shouldGlow = show && !modalOpen && window._currentTab !== 'jeux';
      navJeuxEl.classList.toggle('partner-in-lobby', shouldGlow);
    }
  }

  /* ── Fallback poll 5s ── */
  function _startFallbackPoll(){
    if (_liveIv) return;
    _checkLive();
    _liveIv = setInterval(_checkLive, 5000);
    yamLog('[CwLive] fallback poll actif');
  }
  function _stopFallbackPoll(){
    if (_liveIv){ clearInterval(_liveIv); _liveIv = null; }
  }

  /* ── Realtime ── */
  function _subscribeRT(coupleId){
    if (!window._yamRT || !coupleId) { _startFallbackPoll(); return; }
    if (_rtChannel) return; // déjà abonné

    _rtChannel = window._yamRT
      .channel('cw_live_' + coupleId)
      .on('postgres_changes', {
        event:  '*',       // INSERT (session créée) + UPDATE (active→false)
        schema: 'public',
        table:  TABLE,
        filter: 'couple_id=eq.' + coupleId,
      }, function(payload){
        yamLog('[CwLive] RT event', payload.eventType);
        /* Re-fetch pour avoir l'état exact (évite de lire payload.new qui
           peut être vide sur certaines configs Supabase Realtime) */
        _checkLive();
      })
      .subscribe(function(status){
        if (status === 'SUBSCRIBED'){
          yamLog('[CwLive] RT connecté'); console.log('[RT] ✅ Cowatch live connecté', { channel: 'cowatch_sessions', status: 'SUBSCRIBED' });
          _stopFallbackPoll();   // RT OK → on arrête le poll
          _checkLive();          // état initial
        } else if (['CHANNEL_ERROR','TIMED_OUT','CLOSED'].indexOf(status) !== -1){
          yamLog('[CwLive] RT ' + status + ' — fallback poll'); console.warn('[RT] Cowatch live channel perdu — fallback poll 5s');
          _rtChannel = null;
          _startFallbackPoll();  // RT KO → on bascule sur le poll
        }
      });

    window._yamRTChannels['cw_live'] = _rtChannel;
  }

  function _closeRT(){
    if (_rtChannel){
      try { if (window._yamRT) window._yamRT.removeChannel(_rtChannel); } catch(e){}
      delete window._yamRTChannels['cw_live'];
      _rtChannel = null;
    }
  }

  /* ── Init : appelée après login (session_ready) ── */
  function _initCwLive(){
    var u = typeof v2GetUser === 'function' ? v2GetUser() : null;
    if (!u || !u.couple_id) return;
    _closeRT();
    _stopFallbackPoll();
    if (window._yamRT){
      _subscribeRT(u.couple_id);
    } else {
      _startFallbackPoll();
    }
  }

  /* ── Démarrage ── */
  document.addEventListener('DOMContentLoaded', function(){
    /* Tentative immédiate si session déjà active au chargement */
    setTimeout(function(){
      if (window._yamRT){ _initCwLive(); }
      else { _startFallbackPoll(); }
    }, 600);
  });

  /* yam:rt_ready : RT initialisé → (re)connecter le channel */
  document.addEventListener('yam:rt_ready', function(){
    _initCwLive();
  });

  /* yam:session_ready : après login → init */
  document.addEventListener('yam:session_ready', function(){
    setTimeout(_initCwLive, 800);
  });

  /* Exposé pour debug console */
  window._cwLiveCheck = _checkLive;

  /* ── Sync navJeux.partner-in-lobby ↔ tab courant (cowatch uniquement)
     Quand l'utilisateur entre sur l'onglet Jeux → retire le glow cowatch.
     Quand il le quitte → relance _checkLive pour le remettre si session encore active.
     Patch chaîné sur yamSwitchTab (le dashboard fait la même chose pour les lobbies jeux). ── */
  (function(){
    var _origSwitch = window.yamSwitchTab;
    window.yamSwitchTab = function(tab){
      if (_origSwitch) _origSwitch.apply(this, arguments);
      var navJeux = document.getElementById('navJeux');
      if (!navJeux) return;
      if (tab === 'jeux'){
        /* On entre sur l'onglet Jeux → retirer le glow cowatch */
        navJeux.classList.remove('partner-in-lobby');
      } else {
        /* On quitte l'onglet Jeux → re-vérifier si session cowatch encore active */
        _checkLive();
      }
    };
  }());
})();


// ══════════════════════════════════════════════════════════════════
// LIAISON DES EVENT LISTENERS
// Remplace les onclick= retirés de index.html
// Exécuté après DOMContentLoaded pour garantir que les éléments existent
// ══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function(){

  // — bouton splash (écran de démarrage)
  var splashBtn = document.getElementById('yamSplashBtn');
  if(splashBtn) splashBtn.addEventListener('click', function(){ window.yamSplashOpen && window.yamSplashOpen(); });

  // — sélection rôle join (inscription)
  var joinGirl = document.getElementById('v2JoinRoleGirl');
  if(joinGirl) joinGirl.addEventListener('click', function(){ v2SelectJoinRole('girl'); });
  var joinBoy = document.getElementById('v2JoinRoleBoy');
  if(joinBoy) joinBoy.addEventListener('click', function(){ v2SelectJoinRole('boy'); });

  // — bouton engrenage header principal
  var headerGear = document.getElementById('headerGearBtn');
  if(headerGear) headerGear.addEventListener('click', function(){ window.yamToggleAccountModal && window.yamToggleAccountModal(); });

  // — overlay rappels (fermer en cliquant dehors)
  var rappelOverlay = document.getElementById('rappelOverlay');
  if(rappelOverlay) rappelOverlay.addEventListener('click', function(){ window.closeRappelSheet && window.closeRappelSheet(); });

  // — bouton fermer sheet rappels
  var rshClose = document.querySelector('.rsh-close');
  if(rshClose) rshClose.addEventListener('click', function(){ window.closeRappelSheet && window.closeRappelSheet(); });

  // — input rappels : valider sur Enter
  var rshInput = document.getElementById('rshInput');
  if(rshInput) rshInput.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); window.rappelAdd && window.rappelAdd(); } });

  // — bouton ajouter rappel (submit)
  var rshSubmit = document.querySelector('.rsh-submit');
  if(rshSubmit) rshSubmit.addEventListener('click', function(){ window.rappelAdd && window.rappelAdd(); });

  // — bouton ouvrir sheet rappels (.home-rappel-add-btn)
  var rappelAddBtn = document.querySelector('.home-rappel-add-btn');
  if(rappelAddBtn) rappelAddBtn.addEventListener('click', function(){ window.openRappelSheet && window.openRappelSheet(); });

  // — bouton "C'est fait" rappel
  var rappelDone = document.querySelector('.home-rappel-done');
  if(rappelDone) rappelDone.addEventListener('click', function(){ window.homeRappelDone && window.homeRappelDone(); });

  // — bouton "Plus tard" rappel
  var rappelLater = document.querySelector('.home-rappel-later');
  if(rappelLater) rappelLater.addEventListener('click', function(){ window.homeRappelNext && window.homeRappelNext(); });

  // — boutons nav rappels (‹ et ›)
  var navBtns = document.querySelectorAll('.home-rappel-nav-btn');
  if(navBtns.length >= 2){
    navBtns[0].addEventListener('click', function(){ window.homeRappelNext && window.homeRappelNext(); });
    navBtns[1].addEventListener('click', function(){ window.homeRappelPrev && window.homeRappelPrev(); });
  }

});


// ══════════════════════════════════════════════════════════════════
// LIAISON DES EVENT LISTENERS — COMPLET
// Remplace les 277 handlers inline retirés de index.html
// ══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function(){

  function _on(id, event, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(event, fn);
  }
  function _onAll(selector, event, fn) {
    document.querySelectorAll(selector).forEach(function(el) {
      el.addEventListener(event, fn);
    });
  }

  // ── Thème ──
  _on('themeToggleLogin', 'click', function(){ window.applyThemeToggle && window.applyThemeToggle(); });
  _on('themeToggleHome',  'click', function(){ window.applyThemeToggle && window.applyThemeToggle(); });
  _on('themeToggleDm1',   'click', function(){ window.applyThemeToggle && window.applyThemeToggle(); });
  _on('themeToggleDm2',   'click', function(){ window.applyThemeToggle && window.applyThemeToggle(); });
  _on('themeToggleGames', 'click', function(){ window.applyThemeToggle && window.applyThemeToggle(); });
  _on('themeTogglePranks','click', function(){ window.applyThemeToggle && window.applyThemeToggle(); });

  // ── Login V2 ──
  _on('v2BtnLogin',      'click', function(){ window.v2DoLogin && window.v2DoLogin(); });
  _on('v2LinkForgot',    'click', function(){ window.v2ShowForgot && window.v2ShowForgot(); });
  _on('v2BtnForgot',     'click', function(){ window.v2DoForgotPassword && window.v2DoForgotPassword(); });
  _on('v2LinkBackLogin', 'click', function(){ window.v2ShowLoginForm && window.v2ShowLoginForm(); });
  _on('v2BtnReset',      'click', function(){ window.v2DoResetPassword && window.v2DoResetPassword(); });
  _on('v2BtnRegister',   'click', function(){ window.v2DoRegister && window.v2DoRegister(); });
  _on('v2BtnJoin',       'click', function(){ window.v2DoJoin && window.v2DoJoin(); });
  _on('v2TabLogin',    'click', function(){ window.v2SwitchTab && window.v2SwitchTab('login'); });
  _on('v2TabRegister', 'click', function(){ window.v2SwitchTab && window.v2SwitchTab('register'); });
  _on('v2TabJoin',     'click', function(){ window.v2SwitchTab && window.v2SwitchTab('join'); });
  _on('v2RoleGirl', 'click', function(){ window.v2SelectRole && window.v2SelectRole('girl'); });
  _on('v2RoleBoy',  'click', function(){ window.v2SelectRole && window.v2SelectRole('boy'); });
  _on('v2RoleInfoBtn', 'click', function(){
    var box = document.getElementById('v2RoleInfoBox');
    if(box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
  });
  _on('v2JoinRoleInfoBtn', 'click', function(){
    var box = document.getElementById('v2JoinRoleInfoBox');
    if(box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
  });

  // ── Profil / Humeur ──
  _on('profileAvatar',     'click', function(){ window.toggleProfilePopup && window.toggleProfilePopup(); });
  _on('moodBandeau',       'click', function(){ window.triggerMoodBandeau && window.triggerMoodBandeau(); });
  _on('ppBtnGirl',   'click', function(){ window.setProfile && window.setProfile('girl'); });
  _on('ppBtnBoy',    'click', function(){ window.setProfile && window.setProfile('boy'); });
  _on('ppBtnMood',   'click', function(e){ window.openMoodPicker && window.openMoodPicker(e); });
  _on('ppBtnLogout', 'click', function(){ window.nativeLogout && window.nativeLogout(); });
  _on('homeMoodElleEditBtn', 'click', function(e){ window.openMoodPicker && window.openMoodPicker(e); });
  _on('homeMoodLuiEditBtn',  'click', function(e){ window.openMoodPicker && window.openMoodPicker(e); });
  _on('moodPickerOverlay',   'click', function(){ window.closeMoodPicker && window.closeMoodPicker(); });
  _on('homeSpamHeart', 'click', function(){ window.spawnHeart && window.spawnHeart(); });

  // ── Navigation tabs ──
  _on('navHome',     'click', function(){ window.yamSwitchTab && window.yamSwitchTab('home'); });
  _on('navMessages', 'click', function(){ window.yamSwitchTab && window.yamSwitchTab('messages'); });
  _on('navJeux',     'click', function(){ window.yamSwitchTab && window.yamSwitchTab('jeux'); });
  _on('navMusique',  'click', function(){ window.yamSwitchTab && window.yamSwitchTab('musique'); });
  _on('navNous',     'click', function(){ window.yamSwitchTab && window.yamSwitchTab('nous'); });

  // ── Sticky header — géré par le setTimeout dans BLOC 8 ──
  // yamStickyGearBtn : handler posé par app-inline BLOC 8 (setTimeout 1500ms) — ne pas dupliquer ici
  _on('headerGearBtn',       'click', function(){ window.yamToggleAccountModal && window.yamToggleAccountModal(); });

  // ── Splash / Login ──
  _on('yamSplashBtn', 'click', function(){ window.yamSplashOpen && window.yamSplashOpen(); });

  // ── Rappels ──
  _on('rappelOverlay',  'click', function(){ window.closeRappelSheet && window.closeRappelSheet(); });
  _onAll('.rsh-close',  'click', function(){ window.closeRappelSheet && window.closeRappelSheet(); });
  _on('rshInput', 'keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); window.rappelAdd && window.rappelAdd(); } });
  _onAll('.rsh-submit', 'click', function(){ window.rappelAdd && window.rappelAdd(); });
  _onAll('.home-rappel-add-btn', 'click', function(){ window.openRappelSheet && window.openRappelSheet(); });
  _onAll('.home-rappel-done',    'click', function(){ window.homeRappelDone && window.homeRappelDone(); });
  _onAll('.home-rappel-later',   'click', function(){ window.homeRappelNext && window.homeRappelNext(); });
  (function(){
    var btns = document.querySelectorAll('.home-rappel-nav-btn');
    if(btns[0]) btns[0].addEventListener('click', function(){ window.homeRappelNext && window.homeRappelNext(); });
    if(btns[1]) btns[1].addEventListener('click', function(){ window.homeRappelPrev && window.homeRappelPrev(); });
  })();

  // ── Histoire ──
  _on('histoireGestionBtn',       'click', function(){ window.histoireOpenGestion && window.histoireOpenGestion(); });
  _on('histoireCloseChapterBtn',  'click', function(){ window.histoireCloseChapterModal && window.histoireCloseChapterModal(); });
  _on('histoireBulle', 'click', function(){
    var m = document.getElementById('histoireChapterModal');
    if(m && m.style.display !== 'none'){ m.style.display='none'; }
    else if(m){ m.style.display='flex'; }
  });
  _on('histoireNewItemBtn',       'click', function(){ window.histoireOpenItemModal && window.histoireOpenItemModal(null); });
  _on('histoireCloseGestionBtn',  'click', function(){ window.histoireCloseGestion && window.histoireCloseGestion(); });
  _on('histoireCloseItemModalBtn','click', function(){ window.histoireCloseItemModal && window.histoireCloseItemModal(); });
  _on('histoireItemSaveBtn',   'click', function(){ window.histoireSaveItem && window.histoireSaveItem(); });
  _on('histoireItemDeleteBtn', 'click', function(){ window.histoireDeleteItem && window.histoireDeleteItem(); });

  // ── Semaine ──
  _on('semaineToggleBtn',    'click', function(){ window.semaineToggle && window.semaineToggle(); });
  _on('semaineGenBtn',       'click', function(){ window.semaineGenerate && window.semaineGenerate(); });
  _on('semaineCloseSlotBtn', 'click', function(){ window.semaineCloseSlotModal && window.semaineCloseSlotModal(); });

  // ── Mémo ──
  _on('memoNoteViewCard',      'click', function(){ window.openMemoNoteView && window.openMemoNoteView(); });
  _on('memoNoteStopProp',      'click', function(e){ e.stopPropagation(); });
  _on('memoNoteEditBtn',       'click', function(){ window.openMemoNoteEdit && window.openMemoNoteEdit(); });
  _on('memoTodoViewCard',      'click', function(){ window.openMemoTodoView && window.openMemoTodoView(); });
  _on('memoTodoStopProp',      'click', function(e){ e.stopPropagation(); });
  _on('memoTodoEditBtn',       'click', function(){ window.openMemoTodoEdit && window.openMemoTodoEdit(); });
  _on('memoNoteViewCloseBtn',  'click', function(){ window.closeMemoNoteView && window.closeMemoNoteView(); });
  _on('memoNoteViewBackBtn',   'click', function(){ window.closeMemoNoteView && window.closeMemoNoteView(); });
  _on('memoNoteViewToEditBtn', 'click', function(){ window.memoNoteViewToEdit && window.memoNoteViewToEdit(); });
  _on('memoTodoViewCloseBtn',  'click', function(){ window.closeMemoTodoView && window.closeMemoTodoView(); });
  _on('memoTodoViewBackBtn',   'click', function(){ window.closeMemoTodoView && window.closeMemoTodoView(); });
  _on('memoTodoViewToEditBtn', 'click', function(){ window.memoTodoViewToEdit && window.memoTodoViewToEdit(); });
  _on('memoNoteEditCloseBtn',  'click', function(){ window.closeMemoNoteEdit && window.closeMemoNoteEdit(); });
  _on('memoNoteEditCancelBtn', 'click', function(){ window.closeMemoNoteEdit && window.closeMemoNoteEdit(); });
  _on('memoPopupSaveBtn',      'click', function(){ window.memoSaveNote && window.memoSaveNote(); });
  _on('memoNoteEditSaveBtn2',  'click', function(){ window.memoSaveNote && window.memoSaveNote(); });
  _on('memoTodoEditCloseBtn',  'click', function(){ window.closeMemoTodoEdit && window.closeMemoTodoEdit(); });
  _on('memoAddTodoItemBtn',    'click', function(){ window.memoAddTodoItem && window.memoAddTodoItem(); });
  _on('memoTodoEditCancelBtn', 'click', function(){ window.closeMemoTodoEdit && window.closeMemoTodoEdit(); });
  _on('openMemoNoteEdit',      'click', function(){ window.openMemoNoteEdit && window.openMemoNoteEdit(); });
  _on('openMemoTodoEdit',      'click', function(){ window.openMemoTodoEdit && window.openMemoTodoEdit(); });

  // ── Petits mots ──
  _on('openPetitsMotsBtn',       'click', function(){ window.openPetitsMotsGestion && window.openPetitsMotsGestion(); });
  _on('closePetitsMotsGestionBtn','click', function(){ window.closePetitsMotsGestion && window.closePetitsMotsGestion(); });
  _on('closePetitsMotsEditorBtn', 'click', function(){ window.closePetitsMotsEditor && window.closePetitsMotsEditor(); });
  _on('petitsMotsSaveBtn',        'click', function(){ window.savePetitMot && window.savePetitMot(); });

  // ── Slot elle/lui ──
  _on('elleTitleEditBtn', 'click', function(){ window.elleEditSectionTitle && window.elleEditSectionTitle(); });
  _on('elleGearBtn',      'click', function(){ window.elleToggleSection && window.elleToggleSection(); });
  _on('elleFileInput',    'change', function(){ window.elleHandleFile && window.elleHandleFile(this); });
  _on('luiTitleEditBtn',  'click', function(){ window.luiEditSectionTitle && window.luiEditSectionTitle(); });
  _on('luiGearBtn',       'click', function(){ window.luiToggleSection && window.luiToggleSection(); });
  _on('luiFileInput',     'change', function(){ window.luiHandleFile && window.luiHandleFile(this); });
  // slotOpenEdit — délégation via data-slot sur les album-cards
  document.querySelectorAll('.album-card.lui-card-wrap').forEach(function(card){
    var slot = card.dataset.slot;
    if(!slot) return;
    var role = slot.startsWith('elle-') ? 'elle' : 'lui';
    var slotName = slot.startsWith('elle-') ? slot.replace('elle-','') : slot;
    var editBtn = card.querySelector('.lui-upload-btn');
    if(editBtn) editBtn.addEventListener('click', function(){ window.slotOpenEdit && window.slotOpenEdit(role, slotName); });
    var emptyDiv = card.querySelector('.lui-img-empty');
    if(emptyDiv) emptyDiv.addEventListener('click', function(){ window.slotOpenEdit && window.slotOpenEdit(role, slotName); });
    var bannerEditable = card.querySelector('.album-banner.editable');
    if(bannerEditable) bannerEditable.addEventListener('click', function(){ window.slotOpenEdit && window.slotOpenEdit(role, slotName); });
  });
  _on('slotCloseEditBtn',  'click', function(){ window.slotCloseEdit && window.slotCloseEdit(); });
  _on('slotEditPhoto',     'click', function(){ window.slotEditPhotoClick && window.slotEditPhotoClick(); });
  _on('slotEditSaveBtn',   'click', function(){ window.slotEditSave && window.slotEditSave(); });

  // ── Souvenirs ──
  _on('openSouvenirGestionBtn',  'click', function(){ window.nousOpenSouvenirGestion && window.nousOpenSouvenirGestion(); });
  _on('souvenirNewBtn',          'click', function(){ window.nousOpenSouvenirModal && window.nousOpenSouvenirModal(null); });
  _on('closeSouvenirModalBtn',   'click', function(){ window.closeSouvenirModal && window.closeSouvenirModal(); });
  _on('souvenirPhotoPreview',    'click', function(){ window.souvenirPhotoClick && window.souvenirPhotoClick(); });
  _on('souvenirPhotoInput',      'change', function(){ window.souvenirHandlePhoto && window.souvenirHandlePhoto(this); });
  _on('souvenirInputDate', 'change', function(){
    var l = document.getElementById('souvenirDateLabel');
    if(this.value){ if(l){l.style.color='var(--text)'; l.textContent=new Date(this.value+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});} }
    else { if(l){l.style.color='var(--muted)'; l.textContent='Date (optionnel)';} }
  });
  _on('souvenirSaveBtn',        'click', function(){ window.souvenirSave && window.souvenirSave(); });
  _on('souvenirModalDelBtn',    'click', function(){ window.souvenirDelete && window.souvenirDelete(); });
  _on('souvenirGestionNewBtn',  'click', function(){ window._souvenirFromGestion=true; window.nousOpenSouvenirModal && window.nousOpenSouvenirModal(null); });
  _on('closeSouvenirGestionBtn','click', function(){ window.nousCloseSouvenirGestion && window.nousCloseSouvenirGestion(); });

  // ── Activités ──
  _on('openActiviteGestionBtn',    'click', function(){ window.nousOpenActiviteGestion && window.nousOpenActiviteGestion(); });
  _on('activiteIaBtn',             'click', function(){ window.activiteIaSuggest && window.activiteIaSuggest(); });
  _on('activiteIaAddBtn',          'click', function(){ window.activiteIaAdd && window.activiteIaAdd(); });
  _on('closeActiviteGestionBtn',   'click', function(){ window.nousCloseActiviteGestion && window.nousCloseActiviteGestion(); });
  _on('closeActiviteModalBtn',     'click', function(){ window.closeActiviteModal && window.closeActiviteModal(); });
  _on('activiteAddStepBtn',        'click', function(){ window.nousAddStep && window.nousAddStep(); });
  _on('activiteSaveBtn',           'click', function(){ window.activiteSave && window.activiteSave(); });
  _on('activiteDeleteBtn',         'click', function(){ window.activiteDelete && window.activiteDelete(); });

  // ── Livres ──
  _on('openLivresGestionBtn', 'click', function(){ window.livresOpenGestion && window.livresOpenGestion(); });
  _on('livreIdeaBtn',         'click', function(){ window.livresIdeeDuJour && window.livresIdeeDuJour(); });
  _on('livresNewBtn',         'click', function(){ window.livresOpenNew && window.livresOpenNew(); });
  _on('livresAddIdeaBtn',     'click', function(){ window.livresAddFromIdea && window.livresAddFromIdea(); });
  _on('livreIdeaCloseBtn',    'click', function(){ var c=document.getElementById('livreIdeaCard'); if(c) c.style.display='none'; });
  _on('livreIdeaNextBtn',     'click', function(){ window.livresIdeeDuJour && window.livresIdeeDuJour(); });
  _on('livresNewBtn2',        'click', function(){ window.livresOpenNew && window.livresOpenNew(); });
  _on('livresCloseGestionBtn','click', function(){ window.livresCloseGestion && window.livresCloseGestion(); });
  _on('livresCloseEditBtn',   'click', function(){ window.livresCloseEdit && window.livresCloseEdit(); });
  _on('livreEditPhoto',       'click', function(){ window.livresPhotoClick && window.livresPhotoClick(); });
  _on('livrePhotoInput',      'change', function(){ window.livresHandlePhoto && window.livresHandlePhoto(this); });
  _on('livreEditSaveBtn',     'click', function(){ window.livresSave && window.livresSave(); });
  _on('livreEditDelBtn',      'click', function(){ window.livresDelete && window.livresDelete(); });

  // ── Suggestions musicales ──
  _on('sgAddBtn',      'click', function(){ window.openSgModal && window.openSgModal(); });
  _on('sgLockBadge',   'click', function(){ window.sgToggleLock && window.sgToggleLock(); });
  _on('sgCheckAuthBtn','click', function(){ window.sgCheckAuth && window.sgCheckAuth(); });
  _on('sgCancelAuthBtn','click', function(){ window.closeSgAuth && window.closeSgAuth(); });
  _on('sgCloseManageBtn','click', function(){ window.closeSgManageModal && window.closeSgManageModal(); });
  _on('sgCloseEditBtn', 'click', function(){ window.closeSgEditModal && window.closeSgEditModal(); });
  _on('sgEditSaveBtn',  'click', function(){ window.sgEditSave && window.sgEditSave(); });
  _on('sgCloseModalBtn','click', function(){ window.closeSgModal && window.closeSgModal(); });
  _on('sgSaveBtn',      'click', function(){ window.sgSave && window.sgSave(); });
  _on('sgManageOpenBtn','click', function(){ window.closeSgModal && window.closeSgModal(); window.openSgManageModal && window.openSgManageModal(); });

  // ── Jeux — navigation ──
  _on('jxQuizRow',   'click', function(){ var b=document.getElementById('quizBtn');   if(b)b.click(); });
  _on('jxGamesMore', 'click', function(){ var b=document.getElementById('gamesBtn');  if(b)b.click(); });
  _on('libItemMemo', 'click', function(){ window.goTo && window.goTo('memoCoupleSection'); });
  _on('libItemLove', 'click', function(){ window.goTo && window.goTo('Love'); });
  _on('libItemSugg', 'click', function(){ window.goTo && window.goTo('suggestionSection'); });
  _on('libItemBooks','click', function(){ window.goTo && window.goTo('Books'); });
  _on('lockSubmit',  'click', function(){ window.checkCode && window.checkCode(); });

  // ── Jeux — accès rapide home ──
  (function(){
    var jxRows = document.querySelectorAll('.jx-row');
    jxRows.forEach(function(row){
      if(row.id) return; // déjà géré par id
      // Fallback pour les jx-rows sans id (ne devrait plus exister après nos ajouts)
    });
  })();

  // ── Jeux avec id ──
  _on('skyjoCard',    'click', function(){ window.openSkyjoLock && window.openSkyjoLock(); });
  _on('ochoCard',     'click', function(){ window.openOcho      && window.openOcho(); });
  (function(){
    // Accès rapide depuis l'onglet jeux (jx-rows avec id connus)
    var map = {
      'openSkyjoLock': function(){ window.openSkyjoLock && window.openSkyjoLock(); },
      'openMemoryGame': function(){ window.openMemoryGame && window.openMemoryGame(); },
      'openPenduGame': function(){ window.openPenduGame && window.openPenduGame(); },
      'openCowatchModal': function(){ window.openCowatchModal && window.openCowatchModal(); },
      'openWheelModal': function(){ window.openWheelModal && window.openWheelModal(); },
      'openPrankMenu': function(){ window.openPrankMenu && window.openPrankMenu(); },
    };
    document.querySelectorAll('.jx-row, .jx-wheel-btn').forEach(function(el){
      if(el.id) return;
      // Sans id — déterminer l'action par position dans le DOM
    });
  })();

  // ── Accès rapide jeux (sans id, par data ou position) ──
  // On identifie les jx-rows restants sans id par leur contenu
  document.querySelectorAll('.jx-row:not([id])').forEach(function(row){
    var txt = row.textContent;
    if(txt.indexOf('Ocho') !== -1)
      row.addEventListener('click', function(){ window.openOcho && window.openOcho(); });
    else if(txt.indexOf('Skyjo') !== -1 || row.querySelector('#skyjoCard'))
      row.addEventListener('click', function(){ window.openSkyjoLock && window.openSkyjoLock(); });
    else if(txt.indexOf('Memory') !== -1)
      row.addEventListener('click', function(){ window.openMemoryGame && window.openMemoryGame(); });
    else if(txt.indexOf('Pendu') !== -1)
      row.addEventListener('click', function(){ window.openPenduGame && window.openPenduGame(); });
    else if(txt.indexOf('Regarder') !== -1 || txt.indexOf('Watch') !== -1 || txt.indexOf('Co-watch') !== -1)
      row.addEventListener('click', function(){ window.openCowatchModal && window.openCowatchModal(); });
    else if(txt.indexOf('Bêtise') !== -1 || txt.indexOf('Prank') !== -1 || txt.indexOf('bêtise') !== -1)
      row.addEventListener('click', function(){ window.openPrankMenu && window.openPrankMenu(); });
  });
  _onAll('.jx-wheel-btn:not([id])', 'click', function(){ window.openWheelModal && window.openWheelModal(); });

  // ── Quiz ──
  _on('quizBackBtn',    'click', function(){ window.closeQuiz && window.closeQuiz(); });
  _on('quizRestartBtn', 'click', function(){ window.startQuiz && window.startQuiz(); });

  // ── Recherche ──
  _on('searchOverlay', 'click', function(e){ if(e.target === document.getElementById('searchOverlay')) window.closeSearch && window.closeSearch(); });
  _on('searchInput',   'input', function(){ window.filterSongs && window.filterSongs(this.value); });
  _on('searchCloseBtn','click', function(){ window.closeSearch && window.closeSearch(); });

  // ── DM Messages ──
  _on('dmHomeConv',            'click', function(){ window.dmOpenMessaging && window.dmOpenMessaging(); });
  _on('dmConvProfileBtn',      'click', function(){ if(window.openAccountModal) window.openAccountModal(); else if(window.toggleProfilePopup) window.toggleProfilePopup(); });
  _on('dmIdentityScreen',      'click', function(e){ window.dmCloseIdentityIfOutside && window.dmCloseIdentityIfOutside(e); });
  _on('dmIdBtnGirl',           'click', function(){ window.dmSetIdentity && window.dmSetIdentity('girl'); });
  _on('dmIdBtnBoy',            'click', function(){ window.dmSetIdentity && window.dmSetIdentity('boy'); });
  _on('dmCancelReplyBtn',      'click', function(){ window.dmCancelReply && window.dmCancelReply(); });
  _on('dmReactPickerCloseBtn', 'click', function(){ window.closeDmReactPicker && window.closeDmReactPicker(); });
  _on('msgHeaderPill',         'click', function(){ window._hidePillAndOpenChat && window._hidePillAndOpenChat(); });

  // ── Jeux — vues ──
  _on('gamesBackBtn',  'click', function(){ window.closeGames && window.closeGames(); });
  _on('gvMemoryCard',  'click', function(){ window.openMemoryGame && window.openMemoryGame(); });
  _on('gvPenduCard',   'click', function(){ window.openPenduGame && window.openPenduGame(); });
  _on('gvPuzzleCard',  'click', function(){ window.openPuzzleGame && window.openPuzzleGame(); });
  _on('gvSnakeCard',   'click', function(){ window.openSnakeGame && window.openSnakeGame(); });

  // ── Memory ──
  _on('memoryBackBtn',       'click', function(){ window.closeMemoryGame && window.closeMemoryGame(); });
  _on('memorySoloBtn',       'click', function(){ window.memoryChooseSolo && window.memoryChooseSolo(); });
  _on('memoryMultiBtn',      'click', function(){ window.memoryChooseMulti && window.memoryChooseMulti(); });
  _on('memoryMultiCancelBtn','click', function(){ window.memoryMultiCancel && window.memoryMultiCancel(); });
  _on('memBtnRestart',       'click', function(){ window.memoryRestart && window.memoryRestart(); });
  _on('memoryQuitBtn',       'click', function(){ window.memoryQuit && window.memoryQuit(); });
  _on('memWinReplayBtn',     'click', function(){ window.memoryRestart && window.memoryRestart(); });
  _on('lbTabAll',  'click', function(){ window.lbSetTab && window.lbSetTab('all'); });
  _on('lbTabGirl', 'click', function(){ window.lbSetTab && window.lbSetTab('girl'); });
  _on('lbTabBoy',  'click', function(){ window.lbSetTab && window.lbSetTab('boy'); });

  // ── Pendu ──
  _on('penduBackBtn',      'click', function(){ window.closePenduGame && window.closePenduGame(); });
  _on('penduGenderGirl',   'click', function(){ window.penduSelectGender && window.penduSelectGender('girl'); });
  _on('penduGenderBoy',    'click', function(){ window.penduSelectGender && window.penduSelectGender('boy'); });
  _on('penduNextWordBtn',  'click', function(){ window.penduNextWord && window.penduNextWord(); });
  _on('plbTabAll',  'click', function(){ window.plbSetTab && window.plbSetTab('all'); });
  _on('plbTabGirl', 'click', function(){ window.plbSetTab && window.plbSetTab('girl'); });
  _on('plbTabBoy',  'click', function(){ window.plbSetTab && window.plbSetTab('boy'); });

  // ── Puzzle ──
  _on('puzzleBackBtn',     'click', function(){ window.closePuzzleGame && window.closePuzzleGame(); });
  _on('puzzleGenderGirl',  'click', function(){ window.puzzleSelectGender && window.puzzleSelectGender('girl'); });
  _on('puzzleGenderBoy',   'click', function(){ window.puzzleSelectGender && window.puzzleSelectGender('boy'); });
  _on('puzzleInitBtn',     'click', function(){ window.puzzleInit && window.puzzleInit(); });
  _on('puzzlePreviewBtn',  'click', function(){ window.puzzleShowPreview && window.puzzleShowPreview(); });
  _on('puzzleReplayBtn2',  'click', function(){ window.puzzleReplay && window.puzzleReplay(); });
  (function(){
    var sizeBtns = document.querySelectorAll('.puzzle-size-btn');
    var sizes = [3, 4, 5];
    sizeBtns.forEach(function(btn, idx){
      (function(s, b){ b.addEventListener('click', function(){ window.puzzleSetSize && window.puzzleSetSize(s, b); }); })(sizes[idx] || 3, btn);
    });
    // puzzleReplay sur game-start-btn (multiple) — cibler par position
    var startBtns = document.querySelectorAll('.game-start-btn');
    startBtns.forEach(function(btn){
      if(btn.id) return;
      if(btn.textContent.indexOf('Rejouer') !== -1 || btn.textContent.indexOf('🔀') !== -1)
        btn.addEventListener('click', function(){ window.puzzleReplay && window.puzzleReplay(); });
    });
  })();
  _on('zplbTabAll',  'click', function(){ window.zplbSetTab && window.zplbSetTab('all'); });
  _on('zplbTabGirl', 'click', function(){ window.zplbSetTab && window.zplbSetTab('girl'); });
  _on('zplbTabBoy',  'click', function(){ window.zplbSetTab && window.zplbSetTab('boy'); });

  // ── Snake ──
  _on('snakeBackBtn',     'click', function(){ window.closeSnakeGame && window.closeSnakeGame(); });
  _on('snakeGenderGirl',  'click', function(){ window.snakeSelectGender && window.snakeSelectGender('girl'); });
  _on('snakeGenderBoy',   'click', function(){ window.snakeSelectGender && window.snakeSelectGender('boy'); });
  _on('snakeStartBtn',    'click', function(){ window.snakeStart && window.snakeStart(); });
  // NOTE: Les boutons dpad (snakeBtnUp/Down/Left/Right) sont bindés par ID dans app-games.js
  // — NE PAS les rebinder ici par querySelectorAll(.snake-btn) car le bouton centre (.snake-btn-center)
  // décale les index et provoque des directions erronées (bas → game over, droite → bas).

  // ── Skyjo ──
  _on('skyjoBackBtn',       'click', function(){ window.closeSkyjoGame && window.closeSkyjoGame(); });
  _on('skyjoAbandonBtn',    'click', function(){ window.skyjoAbandon && window.skyjoAbandon(); });
  _on('skyjoLeaveWaitBtn',  'click', function(){ window.skyjoLeaveWait && window.skyjoLeaveWait(); });
  _on('skyjoDiscardBtn',    'click', function(){ window.skyjoDiscardHeld && window.skyjoDiscardHeld(); });
  _on('skyjoDeckCard',      'click', function(){ window.skyjoDrawFromDeck && window.skyjoDrawFromDeck(); });
  _on('skyjoDiscardCard',   'click', function(){ window.skyjoDrawFromDiscard && window.skyjoDrawFromDiscard(); });
  _on('sjReactBtn',         'click', function(e){ window.skyjoToggleReactionPicker && window.skyjoToggleReactionPicker(e); });
  _on('skyjoNextRoundBtn',  'click', function(){ window.skyjoNextRound && window.skyjoNextRound(); });
  _on('skyjoNewGameBtn',    'click', function(){ window.skyjoNewGame && window.skyjoNewGame(); });
  _on('skyjoCloseBtn2',     'click', function(){ window.closeSkyjoGame && window.closeSkyjoGame(); });
  _on('skyjoAuthGirl', 'click', function(){ window.skyjoAuthSelect && window.skyjoAuthSelect('girl'); });
  _on('skyjoAuthBoy',  'click', function(){ window.skyjoAuthSelect && window.skyjoAuthSelect('boy'); });
  _on('skyjoAuthCloseLink', 'click', function(){ window.skyjoAuthClose && window.skyjoAuthClose(); });
  (function(){
    var reacts = document.querySelectorAll('.sj-react-option');
    reacts.forEach(function(btn, idx){
      (function(n, b){ b.addEventListener('click', function(){ window.skyjoSendReaction && window.skyjoSendReaction(n); }); })(idx+1, btn);
    });
  })();

  // ── Bêtises ──
  _on('prankMenuBackBtn',   'click', function(){ window.closePrankMenu && window.closePrankMenu(); });
  _on('themeTogglePranks',  'click', function(){ window.applyThemeToggle && window.applyThemeToggle(); });
  _on('prankMenuCancelBtn', 'click', function(){ window.closePrankMenu && window.closePrankMenu(); });
  _on('prankCancelAllBtn',  'click', function(){ window.prankCancelAll && window.prankCancelAll(); });
  _on('prankSendBtn',       'click', function(){ window.prankSend && window.prankSend(); });
  _on('prankMsgCancelBtn',  'click', function(){ window.closePrankMsg && window.closePrankMsg(); });
  _on('prankCloseBtn',      'click', function(){ window.closePrank && window.closePrank(); });
  _on('prankNotif',         'click', function(){ window.prankNotifDismiss && window.prankNotifDismiss(); });
  _on('prankLockBtn2',      'click', function(){ window.prankCheckLock && window.prankCheckLock(); });
  _on('gotchaCloseBtn',     'click', function(){ window.closeGotcha && window.closeGotcha(); });
  // prankSelectType et prankToggleFav — délégation via data-prank-type
  document.querySelectorAll('.prank-menu-item[data-prank-type]').forEach(function(el){
    el.addEventListener('click', function(){ window.prankSelectType && window.prankSelectType(el.dataset.prankType); });
  });
  document.querySelectorAll('.prank-fav-btn[data-prank-type]').forEach(function(el){
    el.addEventListener('click', function(e){ e.stopPropagation(); window.prankToggleFav && window.prankToggleFav(e, el.dataset.prankType); });
  });

  // ── Mini player musique ──
  _on('mpModeBtn', 'click', function(){ window.mpCycleMode && window.mpCycleMode(); });
  _on('mpPrevBtn', 'click', function(){ window.mpPrev && window.mpPrev(); });
  _on('mpPlayBtn', 'click', function(){ window.mpToggle && window.mpToggle(); });
  _on('mpNextBtn', 'click', function(){ window.mpNext && window.mpNext(); });
  _on('mpStopBtn', 'click', function(){ window.mpStop && window.mpStop(); });

  // ── Desc edit ──
  _on('descEditCancelBtn', 'click', function(){ window.descEditClose && window.descEditClose(); });
  _on('descEditSaveBtn',   'click', function(){ window.descEditSave && window.descEditSave(); });

});
