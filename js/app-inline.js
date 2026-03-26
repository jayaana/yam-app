// ═══════════════════════════════════════════════════════════════════════════
// app-inline.js — Code transversal extrait de index.html (tâche #89 CSP)
// Refactoré — à charger APRÈS app-nav.js
//
// Contient uniquement les blocs légitimement transversaux :
//   Bloc 1  — scrollRestoration         (timing critique, avant tout)
//   Bloc 2  — Service Worker            (transversal PWA)
//   Bloc 3  — Avatars par défaut        (yamSetAvatar, yamAvatarHTML, yamAvatarSrc)
//   Bloc 4  — Login page reload guard   (timing critique)
//   Bloc 5  — visualViewport iOS fix    (fix CSS layout)
//   Bloc 10 — DM online status observer
//   Bloc 11 — Modales : clic dehors pour fermer
//   Event listeners CSP                 (remplace les onclick= retirés de index.html)
//
// Blocs migrés vers leurs modules propriétaires :
//   Bloc 6  (v2ApplyDynamicNames)              → app-core.js
//   Bloc 6  (v2SelectJoinRole, yamSplashOpen)  → app-account.js
//   Blocs 7+8 (yamSwitchTab, sticky header)    → app-nav.js
//   Bloc 9  (yamToggleAccountModal, patches)   → app-account.js
//   Bloc 12 (mascotte IA, rappels, humeurs)    → app-home.js
//   Bloc 13 (avatar sync, hookSetProfile)      → app-account.js
//   Bloc 14 (cowatch live, _yamSyncNavJeux)    → app-cowatch.js
//
// Ordre de chargement recommandé :
//   app-core.js → app-nav.js → app-account.js → app-home.js → app-cowatch.js → app-inline.js
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
// BLOC 6b — Reset password + affichage splash si pas de session
// ← logique extraite du BLOC 6 original, reste ici car doit
//   s'exécuter EN DERNIER (après que toutes les fonctions login
//   soient définies dans app-account.js)
// ══════════════════════════════════════════════════════════════════
(function(){
  function checkV2Session(){
    try{
      var s = JSON.parse(localStorage.getItem('yam_session_v3')||'null');
      if(s && s.access_token && s.user) return true;
    }catch(e){}
    return false;
  }

  var _hash   = window.location.hash   || '';
  var _search = window.location.search || '';
  var _isReset = _hash.includes('type=recovery') || _search.includes('type=recovery') || _search.includes('token_hash');

  if(_isReset){
    var _params = {};
    _search.replace(/^\?/,'').split('&').forEach(function(p){
      var kv = p.split('='); if(kv[0]) _params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]||'');
    });
    _hash.replace(/^#/,'').split('&').forEach(function(p){
      var kv = p.split('='); if(kv[0]) _params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]||'');
    });
    if(_params['token_hash'] && !_params['access_token']){
      window._yamResetTokenHash = _params['token_hash'];
      window._yamResetToken = null;
    } else {
      window._yamResetToken = _params['access_token'] || null;
    }
    history.replaceState(null, '', window.location.pathname);
    window.addEventListener('load', function(){
      var overlay = document.getElementById('v2LoginOverlay');
      if(overlay) overlay.classList.add('active');
      ['v2FormLogin','v2FormForgot','v2FormRegister','v2FormJoin'].forEach(function(id){
        var el = document.getElementById(id); if(el) el.style.display = 'none';
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
    window.addEventListener('load', function(){
      setTimeout(function(){ if(typeof v2ApplyDynamicNames === 'function') v2ApplyDynamicNames(); }, 200);
    });
  }
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

  // ── Sticky header — géré par app-nav.js (setTimeout 1500ms sur yamStickyGearBtn) ──
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
