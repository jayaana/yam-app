// ═══════════════════════════════════════════════════════════════════════════
// app-nous.js — Section "Nous ♥" — Module complet v2.0
// Remplace app-love.js. Contient TOUT ce qui concerne le couple :
// Profil Paired · Photos Elle/Lui · Raisons · Petits mots · Mémo
// Likes · Badge NEW · Souvenirs · Activités
// ═══════════════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════════
// HELPERS — Bloquer scroll arrière-plan + masquer mini-header
// Système robuste iOS Safari : position:fixed sur body + compteur
// de locks pour gérer les modales empilées sans casser le restore
// ════════════════════════════════════════════════════════════════════
var _savedScrollPosition = 0;
var _scrollLockCount = 0;      // compteur — permet d'empiler les modales

// Reset au chargement : s'assure qu'aucun lock résiduel ne bloque le scroll
window.addEventListener('load', function(){
  _scrollLockCount = 0;
  window._yamScrollLocked = false;
  var nousWrap = document.getElementById('nousContentWrapper');
  if(nousWrap) nousWrap.style.overflow = '';
  var miniHeader = document.getElementById('yamStickyHeader');
  if(miniHeader) miniHeader.style.display = '';
});
var _bodyScrollY = 0;          // position réelle du body au moment du lock

function _saveScrollPosition() {
  // Priorité : scrollTop du nousContentWrapper (scroll interne de la section)
  var nousWrap = document.getElementById('nousContentWrapper');
  if (nousWrap) {
    _savedScrollPosition = nousWrap.scrollTop;
  } else {
    _savedScrollPosition = window.scrollY || document.documentElement.scrollTop || 0;
  }
}

function _restoreScrollPosition() {
  // Ne restaurer que quand toutes les modales sont fermées
  if (_scrollLockCount > 0) return;
  var nousWrap = document.getElementById('nousContentWrapper');
  if (nousWrap && _savedScrollPosition >= 0) {
    setTimeout(function(){
      nousWrap.scrollTop = _savedScrollPosition;
    }, 50);
  }
}

function _blockBackgroundScroll() {
  _scrollLockCount++;
  if (_scrollLockCount > 1) return;

  _bodyScrollY = window.scrollY || document.documentElement.scrollTop || 0;

  var nousWrap = document.getElementById('nousContentWrapper');
  if (nousWrap) nousWrap.style.overflow = 'hidden';

  window._yamScrollLocked = true;

  var miniHeader = document.getElementById('yamStickyHeader');
  if (miniHeader) miniHeader.style.display = 'none';
}

// Version force-reset : remet le lock à 1 exactement, même si déjà locké
function _forceScrollLock() {
  _scrollLockCount = 1;
  _bodyScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  var nousWrap = document.getElementById('nousContentWrapper');
  if (nousWrap) nousWrap.style.overflow = 'hidden';
  window._yamScrollLocked = true;
  var miniHeader = document.getElementById('yamStickyHeader');
  if (miniHeader) miniHeader.style.display = 'none';
}

function _unblockBackgroundScroll() {
  if (_scrollLockCount > 0) _scrollLockCount--;
  if (_scrollLockCount > 0) return;

  window._yamScrollLocked = false;

  // Ne pas restaurer l'ancienne position — on veut toujours arriver en haut
  // window.scrollTo(0, _bodyScrollY); — supprimé

  var nousWrap = document.getElementById('nousContentWrapper');
  if (nousWrap) nousWrap.style.overflow = '';

  var miniHeader = document.getElementById('yamStickyHeader');
  if (miniHeader) miniHeader.style.display = '';
}

// Reset complet du scroll lock — appelé par closeAllViews (app-nav.js)
// quand on navigue entre onglets depuis une modale ouverte
window._nousResetScrollLock = function() {
  _scrollLockCount = 0;
  window._yamScrollLocked = false;
  var nousWrap = document.getElementById('nousContentWrapper');
  if (nousWrap) nousWrap.style.overflow = '';
  var miniHeader = document.getElementById('yamStickyHeader');
  if (miniHeader) miniHeader.style.display = '';
};

// Exposition globale pour app-core.js (descEditOpen/Close)
window._nousBlockScroll = function() { _blockBackgroundScroll(); };
window._nousUnblockScroll = function() { _unblockBackgroundScroll(); };


// ════════════════════════════════════════════════════════════════════
// 0. ACCÈS BETA — Code d'accès requis (section en cours de développement)
// ════════════════════════════════════════════════════════════════════
(function(){

  // ── Code d'accès beta — à changer quand la section sera stable ──
  var BETA_CODE = 'majversion2';
  var LS_KEY    = 'yam_nous_beta_unlocked';

  // Vérifie si déjà déverrouillé en session
  function _isUnlocked() {
    return sessionStorage.getItem(LS_KEY) === '1';
  }

  // Affiche le contenu (après unlock)
  function _nousShowContent() {
    var overlay = document.getElementById('nousLockOverlay');
    var content = document.getElementById('nousContentWrapper');
    if (overlay) overlay.style.display = 'none';
    if (content) content.style.display = 'block';
    if (!window._nousContentLoaded) {
      window._nousContentLoaded = true;
      _nousInitAll();
      // Déclenche l'initialisation des sections IA et Histoire
      setTimeout(function(){ document.dispatchEvent(new Event('nousContentReady')); }, 300);
    }
  }

  // Affiche l'overlay de code d'accès beta
  function _nousShowBetaGate() {
    var overlay = document.getElementById('nousLockOverlay');
    var content = document.getElementById('nousContentWrapper');
    if (content) content.style.display = 'none';
    if (!overlay) return;
    overlay.style.display = 'flex';
    // Injecte le formulaire beta si pas déjà là
    if (!overlay.querySelector('.nous-beta-gate')) {
      overlay.innerHTML =
        '<div class="nous-beta-gate" style="' +
          'display:flex;flex-direction:column;align-items:center;gap:18px;' +
          'padding:36px 28px;background:rgba(15,15,26,0.97);border-radius:20px;' +
          'border:1px solid rgba(255,255,255,0.08);max-width:320px;width:90%;text-align:center;' +
        '">' +
          '<div style="font-size:2rem;">🔒</div>' +
          '<div style="font-weight:700;font-size:1.1rem;color:#fff;">Section en beta</div>' +
          '<div style="font-size:0.85rem;color:rgba(255,255,255,0.5);line-height:1.5;">' +
            'Cette section est encore en développement.<br>Entre le code d\'accès pour y accéder.' +
          '</div>' +
          '<input id="nousBetaInput" type="password" placeholder="Code d\'accès…" ' +
            'style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);' +
            'background:rgba(255,255,255,0.07);color:#fff;font-size:1rem;text-align:center;outline:none;" ' +
            'onkeydown="if(event.key===\'Enter\') window.nousBetaSubmit()" />' +
          '<div id="nousBetaError" style="font-size:0.82rem;color:#ff6b6b;min-height:18px;"></div>' +
          '<button onclick="window.nousBetaSubmit()" ' +
            'style="width:100%;padding:13px;border-radius:12px;border:none;' +
            'background:linear-gradient(135deg,#e91e8c,#9c27b0);color:#fff;font-weight:700;' +
            'font-size:1rem;cursor:pointer;">Accéder ✨</button>' +
        '</div>';
      // Focus auto
      setTimeout(function(){ var inp=document.getElementById('nousBetaInput'); if(inp) inp.focus(); }, 100);
    }
  }

  // Soumission du code
  window.nousBetaSubmit = function() {
    var inp = document.getElementById('nousBetaInput');
    var err = document.getElementById('nousBetaError');
    if (!inp) return;
    if (inp.value.trim() === BETA_CODE) {
      sessionStorage.setItem(LS_KEY, '1');
      if (err) err.textContent = '';
      _nousShowContent();
    } else {
      if (err) err.textContent = 'Code incorrect, réessaie 🙈';
      inp.value = '';
      inp.focus();
    }
  };

  // Point d'entrée appelé par yamSwitchTab
  window.nousCheckLock = function() {
    if (_isUnlocked()) {
      _nousShowContent();
    } else {
      _nousShowBetaGate();
    }
  };

  window._nousIsUnlocked = function(){ return _isUnlocked(); };

  setTimeout(function(){
    if (window._currentTab === 'nous') window.nousCheckLock();
  }, 800);

})();


// ════════════════════════════════════════════════════════════════════
// 1. INIT CENTRALE — appelée une seule fois au premier affichage
// ════════════════════════════════════════════════════════════════════
function _nousInitAll() {
  _nousLoadProfil();
  elleLoadImages();
  elleLoadDescs();
  elleSyncSections();
  luiLoadImages();
  luiLoadDescs();
  luiSyncDescs();
  if(typeof window._loadSectionTitles === 'function') window._loadSectionTitles();
  var _niu = (typeof v2GetUser==='function')?v2GetUser():null;
  var _nic = _niu?_niu.couple_id:null;
  if(_nic){
    if(typeof _loadElleBanners==='function') _loadElleBanners(_nic);
    if(typeof _loadLuiBanners==='function') _loadLuiBanners(_nic);
  }
  _nousLoadBadge();
  loadLikeCounters();
  _petitsMotsLoad();
  renderMemoCouple();
  nousLoadSouvenirs();
  nousLoadActivites();
  livresLoad();
  if (!window._checkUnreadStarted) {
    window._checkUnreadStarted = true;
    _startLockBadgePolling();
  }
  if (!window._likesIv) {
    window._likesIv = setInterval(loadLikeCounters, 5000);
  }
  document.querySelectorAll('#nousContentWrapper .fade-in').forEach(function(el){
    if (window._fadeObs) window._fadeObs.observe(el);
  });
  // Force fetch Supabase au 1er chargement — retry jusqu'à ce que couple_id soit dispo
  (function _tryRefreshBadges(attempts){
    var u = (typeof v2GetUser==='function') ? v2GetUser() : null;
    if(u && u.couple_id){
      if(typeof window.yamForceRefreshNewBadges==='function') window.yamForceRefreshNewBadges();
    } else if(attempts > 0){
      setTimeout(function(){ _tryRefreshBadges(attempts-1); }, 800);
    }
  })(10);
}


// ════════════════════════════════════════════════════════════════════
// 2. PROFIL COUPLE
// ════════════════════════════════════════════════════════════════════
function _nousLoadProfil() {
  var u = (typeof v2GetUser === 'function') ? v2GetUser() : null;
  if (!u) return;
  var girlName = (typeof v2GetDisplayName === 'function') ? v2GetDisplayName('girl') : 'Elle';
  var boyName  = (typeof v2GetDisplayName === 'function') ? v2GetDisplayName('boy')  : 'Lui';
  var el = document.getElementById('nousProfilGirlName');
  var bl = document.getElementById('nousProfilBoyName');
  if (el) el.textContent = girlName;
  if (bl) bl.textContent = boyName;
  var girlAv = document.getElementById('nousProfilGirlAvatar');
  var boyAv  = document.getElementById('nousProfilBoyAvatar');
  if (girlAv) { var gi = girlAv.querySelector('img'); if (gi) gi.src = window.yamAvatarSrc ? window.yamAvatarSrc('girl') : 'assets/images/profil_girl.png'; }
  if (boyAv)  { var bi = boyAv.querySelector('img');  if (bi) bi.src = window.yamAvatarSrc ? window.yamAvatarSrc('boy')  : 'assets/images/profil_boy.png'; }
  var startDate = window.startDate || new Date('2024-10-29T00:00:00');
  var now = new Date();
  var days = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
  var el2 = document.getElementById('nousProfilDays');
  if (el2) el2.textContent = days + ' jour' + (days > 1 ? 's' : '') + ' ensemble 💕';
}


// ════════════════════════════════════════════════════════════════════
// BADGE "NEW" UNIVERSEL — 5h après toute modification
// Stockage : Supabase table v2_new_badges (couple_id, section, marked_at)
// → partagé entre les deux appareils du couple en temps réel
// Sections : elle_slot_{slot}, lui_slot_{slot}, souvenir, memo_note,
//            memo_todo, livre, petit_mot
// ════════════════════════════════════════════════════════════════════
(function(){
  var NEW_DURATION_MS = 5 * 60 * 60 * 1000; // 5 heures

  // Cache local en mémoire : { section: timestamp_ms } — évite des requêtes répétées
  var _badgeCache    = {};   // section → marked_at (ms)
  var _cacheLoadedAt = 0;    // timestamp du dernier fetch complet
  var CACHE_TTL      = 60 * 1000; // 1 min — recharge depuis Supabase si plus vieux

  function _getCoupleId(){ var u=(typeof v2GetUser==='function')?v2GetUser():null; return u?u.couple_id:null; }

  // ── Charge tous les badges du couple depuis Supabase ──
  function _fetchAllBadges(callback){
    var cid = _getCoupleId(); if(!cid){ if(callback) callback(); return; }
    fetch(SB2_URL+'/rest/v1/v2_new_badges?couple_id=eq.'+encodeURIComponent(cid)+'&select=section,marked_at', {headers: sb2Headers()})
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(rows){
      _badgeCache = {};
      if(Array.isArray(rows)){
        rows.forEach(function(row){
          _badgeCache[row.section] = new Date(row.marked_at).getTime();
        });
      }
      _cacheLoadedAt = Date.now();
      if(callback) callback();
    })
    .catch(function(){ if(callback) callback(); });
  }

  // ── Rafraîchit le cache si périmé, puis appelle callback ──
  function _ensureCache(callback){
    if(Date.now() - _cacheLoadedAt < CACHE_TTL){
      if(callback) callback();
    } else {
      _fetchAllBadges(callback);
    }
  }

  // ── Enregistre un "new" pour une section dans Supabase ──
  window.yamMarkNew = function(section){
    var cid = _getCoupleId(); if(!cid) return;
    var now = new Date().toISOString();
    // Mise à jour optimiste du cache local immédiatement
    _badgeCache[section] = Date.now();
    // Upsert dans Supabase (merge-duplicates sur la PK couple_id+section)
    fetch(SB2_URL+'/rest/v1/v2_new_badges', {
      method: 'POST',
      headers: sb2Headers({'Prefer':'resolution=merge-duplicates,return=minimal','Content-Type':'application/json'}),
      body: JSON.stringify({ couple_id: cid, section: section, marked_at: now })
    }).catch(function(){ /* silencieux — le cache local a déjà été mis à jour */ });
  };

  // ── Vérifie si une section est "new" (dans les 5h) — lecture depuis le cache ──
  window.yamIsNew = function(section){
    var ts = _badgeCache[section];
    return !!(ts && (Date.now() - ts) < NEW_DURATION_MS);
  };

  // ── Affiche/cache un badge NEW sur un élément DOM ──
  window.yamShowNewBadge = function(el, show){
    if(!el) return;
    var badge = el.querySelector('.yam-new-badge');
    if(show){
      if(!badge){
        badge = document.createElement('span');
        badge.className = 'yam-new-badge';
        badge.textContent = 'NEW';
        badge.style.cssText = 'position:absolute;top:4px;right:4px;background:linear-gradient(135deg,#e879a0,#9b59b6);color:#fff;font-size:8px;font-weight:800;letter-spacing:0.5px;padding:2px 5px;border-radius:6px;text-transform:uppercase;z-index:10;pointer-events:none;line-height:1.4;';
        var ps = window.getComputedStyle(el).position;
        if(ps === 'static') el.style.position = 'relative';
        el.appendChild(badge);
      }
      badge.style.display = '';
    } else {
      if(badge) badge.style.display = 'none';
    }
  };

  // ── Applique l'état des badges sur le DOM (lecture depuis cache) ──
  function _applyBadges(){
    // Mémo note — card entière
    var memoNoteCard = document.querySelector('#memoCoupleSection .memo-duo-card:first-child');
    if(memoNoteCard) window.yamShowNewBadge(memoNoteCard, window.yamIsNew('memo_note'));
    // Mémo todo — card entière
    var memoTodoCard = document.querySelector('#memoCoupleSection .memo-duo-card:last-child');
    if(memoTodoCard) window.yamShowNewBadge(memoTodoCard, window.yamIsNew('memo_todo'));
    // Souvenirs — badge à gauche de "Tout voir" (comme livres)
    var souvenirNew = document.getElementById('souvenirNewBadge');
    if(souvenirNew) souvenirNew.style.display = window.yamIsNew('souvenir') ? '' : 'none';
    // Souvenirs — badge sur chaque card individuelle (géré dans _buildSouvenirCard)
    // Livres — badge inline HTML existant
    var livresNew = document.getElementById('livresNewBadge');
    if(livresNew) livresNew.style.display = window.yamIsNew('livre') ? '' : 'none';
    // Petits mots — badge inline HTML existant
    var pmNew = document.getElementById('postitNewBadge');
    if(pmNew) pmNew.style.display = window.yamIsNew('petit_mot') ? '' : 'none';
    // Pochettes Elle/Lui — badge sur la card complète (album-card lui-card-wrap)
    ['animal','fleurs','personnage','saison','repas'].forEach(function(slot){
      ['elle','lui'].forEach(function(who){
        // Cibler la card parente (.album-card) via le data-slot
        var dataSlot = who==='elle' ? who+'-'+slot : slot;
        var card = document.querySelector('.album-card[data-slot="'+dataSlot+'"]');
        if(card) window.yamShowNewBadge(card, window.yamIsNew(who+'_slot_'+slot));
      });
    });
  }

  // ── Rafraîchit le cache depuis Supabase puis applique les badges ──
  // Toujours async : on attend le fetch avant d'appliquer
  window.yamRefreshNewBadges = function(){
    _ensureCache(_applyBadges);
  };

  // ── Force un rechargement complet depuis Supabase (ignore le TTL) ──
  window.yamForceRefreshNewBadges = function(){
    _cacheLoadedAt = 0;
    _fetchAllBadges(_applyBadges);
  };

  // ── Marque ET rafraîchit : écrit dans SB puis recharge pour confirmer ──
  window.yamMarkNewAndRefresh = function(section){
    window.yamMarkNew(section);   // upsert SB + cache optimiste local
    _applyBadges();               // affichage immédiat côté local
  };

  // Pas de polling — refresh unique au lancement via _tryRefreshBadges dans _nousInitAll

})();

// ── Badge nav Nous (icône de l'onglet) ──
function _nousLoadBadge() {
  var badge = document.getElementById('navNousBadge');
  if (badge) badge.style.display = 'none';
}
window.nousSignalNew = function() {
  var badge = document.getElementById('navNousBadge');
  if (badge && window._currentTab !== 'nous') badge.style.display = 'block';
};


// ════════════════════════════════════════════════════════════════════
// TITRES ELLE/LUI PERSONNALISABLES (stockés dans v2_photo_descs category='label')
// boy édite le titre de ELLE — girl édite le titre de LUI
// ════════════════════════════════════════════════════════════════════
(function(){
  function _getCoupleId(){ var u=(typeof v2GetUser==='function')?v2GetUser():null; return u?u.couple_id:null; }

  // Charger les titres depuis Supabase
  function _loadSectionTitles(){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    fetch(SB2_URL+'/rest/v1/v2_photo_descs?couple_id=eq.'+coupleId+'&category=eq.label&select=slot,description',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      if(!Array.isArray(rows)) return;
      rows.forEach(function(row){
        if(row.slot === 'elle_title' || row.slot === '0' || row.slot === 0){
          var el = document.getElementById('elleSectionTitle');
          if(el && row.description) el.textContent = row.description;
        } else if(row.slot === 'lui_title' || row.slot === '99' || row.slot === 99){
          var el2 = document.getElementById('luiSectionTitle');
          if(el2 && row.description) el2.textContent = row.description;
        }
      });
    }).catch(function(){});
  }

  function _saveSectionTitle(slot, val){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    // Cherche aussi les anciens slots ('0' pour elle_title, '99' pour lui_title)
    var altSlot = slot === 'elle_title' ? '0' : slot === 'lui_title' ? '99' : null;
    var slotFilter = altSlot
      ? 'slot=in.('+encodeURIComponent(slot)+','+encodeURIComponent(altSlot)+')'
      : 'slot=eq.'+encodeURIComponent(slot);
    var qUrl = SB2_URL+'/rest/v1/v2_photo_descs?couple_id=eq.'+coupleId+'&category=eq.label&'+slotFilter+'&select=id&limit=1';
    fetch(qUrl, {headers: sb2Headers()})
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(rows){
      if(rows && rows.length > 0){
        // Ligne existante → PATCH
        fetch(SB2_URL+'/rest/v1/v2_photo_descs?id=eq.'+rows[0].id+'&couple_id=eq.'+coupleId, {
          method: 'PATCH',
          headers: sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),
          body: JSON.stringify({description: val, slot: String(slot)})
        }).catch(function(){});
      } else {
        // Nouvelle ligne → POST
        fetch(SB2_URL+'/rest/v1/v2_photo_descs', {
          method: 'POST',
          headers: sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),
          body: JSON.stringify({couple_id: coupleId, category: 'label', slot: String(slot), description: val})
        }).catch(function(){});
      }
    }).catch(function(){});
  }

  // Éditer le titre de ELLE (accessible par boy seulement)
  window.elleEditSectionTitle = function(){
    if(getProfile() !== 'boy') return;
    var el = document.getElementById('elleSectionTitle'); if(!el) return;
    descEditOpen(el.textContent.trim(), 'Titre de la section Elle', function(val){
      if(!val) return;
      el.textContent = val;
      _saveSectionTitle('elle_title', val);
    });
  };

  // Éditer le titre de LUI (accessible par girl seulement)
  window.luiEditSectionTitle = function(){
    if(getProfile() !== 'girl') return;
    var el = document.getElementById('luiSectionTitle'); if(!el) return;
    descEditOpen(el.textContent.trim(), 'Titre de la section Lui', function(val){
      if(!val) return;
      el.textContent = val;
      _saveSectionTitle('lui_title', val);
    });
  };

  // Exposer le chargement des titres à l'init
  window._loadSectionTitles = _loadSectionTitles;
})();



// ════════════════════════════════════════════════════════════════════
// 4 & 5. SECTIONS ELLE & LUI — Pochettes éditables
// Pattern identique aux Livres : bouton "Modifier" → modale slotEditModal
// Upload photo + titre (banner) + description → v2_photo_descs
// ════════════════════════════════════════════════════════════════════
(function(){

  var SB_BUCKET = 'images';
  var SLOTS = ['animal','fleurs','personnage','saison','repas'];

  function _getCoupleId(){ var u=(typeof v2GetUser==='function')?v2GetUser():null; return u?u.couple_id:null; }
  function _ellePath(cid,slot){ return 'uploads/'+cid+'/'+slot+'-elle.jpg'; }
  function _luiPath(cid,slot){ return 'uploads/'+cid+'/'+slot+'-lui.jpg'; }

  // ── Données en mémoire (chargées depuis Supabase) ──
  var _elleBanners = {};
  var _elleDescs   = {};
  var _luiBanners  = {};
  var _luiDescs    = {};

  // ── État modale d'édition ──
  var _editSection = null;
  var _editSlot    = null;

  // ─────────────────────────────
  // SYNC VISIBILITÉ SECTIONS
  // ─────────────────────────────
  window.elleSyncSections = function(){
    var profile = getProfile();
    var elleSection  = document.getElementById('elleSectionContent');
    var luiSection   = document.getElementById('luiSectionContent');
    var elleGear     = document.getElementById('elleGearBtn');
    var luiGear      = document.getElementById('luiGearBtn');
    var elleTitleBtn = document.getElementById('elleTitleEditBtn');
    var luiTitleBtn  = document.getElementById('luiTitleEditBtn');
    if(!elleSection || !luiSection) return;
    if(profile === 'boy'){
      luiSection.style.display  = 'block';
      if(!elleSection.dataset.forceOpen) elleSection.style.display = 'none';
      if(elleGear)     elleGear.style.display     = '';
      if(luiGear)      luiGear.style.display      = 'none';
      if(elleTitleBtn) elleTitleBtn.style.display  = 'flex';
      if(luiTitleBtn)  luiTitleBtn.style.display   = 'none';
    } else {
      elleSection.style.display = 'block';
      if(!luiSection.dataset.forceOpen) luiSection.style.display = 'none';
      if(elleGear)     elleGear.style.display     = 'none';
      if(luiGear)      luiGear.style.display      = '';
      if(elleTitleBtn) elleTitleBtn.style.display  = 'none';
      if(luiTitleBtn)  luiTitleBtn.style.display   = 'flex';
    }
    // Boutons edit : boy → elle, girl → lui
    SLOTS.forEach(function(slot){
      var eBtn = document.getElementById('elle-btn-'+slot);
      var lBtn = document.getElementById('lui-btn-'+slot);
      if(eBtn) eBtn.style.display = profile==='boy'  ? '' : 'none';
      if(lBtn) lBtn.style.display = profile==='girl' ? '' : 'none';
    });
  };

  window.elleToggleSection = function(){
    if(getProfile()!=='boy') return;
    var s=document.getElementById('elleSectionContent'); if(!s) return;
    if(s.style.display==='none'||!s.style.display){ s.dataset.forceOpen='1'; s.style.display='block'; }
    else { delete s.dataset.forceOpen; s.style.display='none'; }
  };
  window.luiToggleSection = function(){
    if(getProfile()!=='girl') return;
    var s=document.getElementById('luiSectionContent'); if(!s) return;
    if(s.style.display==='none'||!s.style.display){ s.dataset.forceOpen='1'; s.style.display='block'; }
    else { delete s.dataset.forceOpen; s.style.display='none'; }
  };

  // ─────────────────────────────
  // CHARGEMENT PHOTOS
  // ─────────────────────────────
  function _loadImages(section){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    SLOTS.forEach(function(slot){
      var path = section==='elle' ? _ellePath(coupleId,slot) : _luiPath(coupleId,slot);
      var url  = SB2_URL+'/storage/v1/object/public/'+SB_BUCKET+'/'+path+'?t='+Date.now();
      var img   = document.getElementById(section+'-img-'+slot);
      var empty = document.getElementById(section+'-empty-'+slot);
      var btn   = document.getElementById(section+'-btn-'+slot);
      if(!img) return;
      var t = new Image();
      t.onload = function(){
        img.src=url; img.style.display=''; img.classList.add('loaded');
        if(empty) empty.style.display='none';
        if(btn) btn.classList.remove('empty');
      };
      t.onerror = function(){
        img.style.display='none';
        if(empty) empty.style.display='';
        if(btn) btn.classList.add('empty');
      };
      t.src = url;
    });
  }
  window.elleLoadImages = function(){ _loadImages('elle'); };
  window.luiLoadImages  = function(){ _loadImages('lui');  };

  // ─────────────────────────────
  // CHARGEMENT DONNÉES SUPABASE
  // ─────────────────────────────
  function _loadData(section){
    var coupleId=_getCoupleId(); if(!coupleId) return;
    var catBanner = section==='elle' ? 'elle_banner' : 'lui_banner';
    var catDesc   = section;
    var banners   = section==='elle' ? _elleBanners : _luiBanners;
    var descs     = section==='elle' ? _elleDescs   : _luiDescs;

    // Banners (titres)
    fetch(SB2_URL+'/rest/v1/v2_photo_descs?couple_id=eq.'+coupleId+'&category=eq.'+catBanner+'&select=slot,description',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      rows.forEach(function(row){
        banners[row.slot]=row.description;
        var el=document.getElementById(section+'-banner-'+row.slot);
        if(el) el.textContent=row.description;
        var lbl=document.querySelector('#'+section+'-empty-'+row.slot+' .lui-img-empty-lbl');
        if(lbl) lbl.textContent=row.description;
      });
    }).catch(function(){});

    // Descriptions
    fetch(SB2_URL+'/rest/v1/v2_photo_descs?couple_id=eq.'+coupleId+'&category=eq.'+catDesc+'&select=slot,description',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      rows.forEach(function(row){
        descs[row.slot]=row.description;
        var el=document.getElementById(section+'-desc-'+row.slot);
        if(el) el.textContent=row.description;
      });
    }).catch(function(){});
  }
  window.elleLoadDescs = function(){ _loadData('elle'); };
  window.luiLoadDescs  = function(){ _loadData('lui');  };
  window.luiSyncDescs  = window.luiLoadDescs;
  window.luiSyncEditMode = window.luiLoadDescs;

  // ─────────────────────────────
  // UPLOAD PHOTO (depuis modale)
  // ─────────────────────────────
  function _uploadPhoto(section, slot, file){
    var ALLOWED=['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
    if(ALLOWED.indexOf(file.type)===-1){ alert('Format non autorisé.'); return; }
    if(file.size>5*1024*1024){ alert('Image trop lourde (max 5 Mo)'); return; }
    var coupleId=_getCoupleId(); if(!coupleId){ alert('Session introuvable'); return; }
    var path = section==='elle' ? _ellePath(coupleId,slot) : _luiPath(coupleId,slot);

    // Feedback dans la modale
    var photoDiv=document.getElementById('slotEditPhoto');
    if(photoDiv) photoDiv.innerHTML='<div style="color:var(--muted);font-size:12px;">Envoi...</div>';

    fetch(SB2_URL+'/storage/v1/object/'+SB_BUCKET+'/'+path,{
      method:'POST', headers:Object.assign({'Content-Type':file.type,'x-upsert':'true'},sb2Headers()), body:file
    }).then(function(r){ return r.text().then(function(){ return r.ok; }); })
    .then(function(ok){
      if(ok){
        var newUrl=SB2_URL+'/storage/v1/object/public/'+SB_BUCKET+'/'+path+'?t='+Date.now();
        // Mettre à jour la card dans la page
        var img=document.getElementById(section+'-img-'+slot);
        var emptyEl=document.getElementById(section+'-empty-'+slot);
        var btnEl=document.getElementById(section+'-btn-'+slot);
        if(img){ img.src=newUrl; img.style.display=''; img.classList.add('loaded'); }
        if(emptyEl) emptyEl.style.display='none';
        if(btnEl) btnEl.classList.remove('empty');
        // Mettre à jour la photo dans la modale
        if(photoDiv){ photoDiv.innerHTML=''; photoDiv.style.backgroundImage='url('+newUrl+')'; }
        var ph=document.getElementById('slotEditPhotoPlaceholder');
        if(ph) ph.style.display='none';
        if(typeof window.yamMarkNewAndRefresh==='function') window.yamMarkNewAndRefresh(section+'_slot_'+slot);
      } else {
        if(photoDiv) photoDiv.innerHTML='<div style="color:#e05555;font-size:11px;">Erreur upload</div>';
      }
    }).catch(function(){
      if(photoDiv) photoDiv.innerHTML='<div style="color:#e05555;font-size:11px;">Erreur réseau</div>';
    });
  }

  // ─────────────────────────────
  // MODALE D'ÉDITION (= livreEditModal)
  // ─────────────────────────────
  window.slotOpenEdit = function(section, slot){
    var profile=getProfile();
    if(section==='elle' && profile!=='boy')  return;
    if(section==='lui'  && profile!=='girl') return;

    _editSection=section; _editSlot=slot;
    _saveScrollPosition();
    _forceScrollLock();

    var modal=document.getElementById('slotEditModal'); if(!modal) return;

    // Titre
    var labels={animal:'Animal',fleurs:'Fleurs',personnage:'Personnage',saison:'Saison',repas:'Repas'};
    document.getElementById('slotEditModalTitle').textContent=(section==='elle'?'Elle':'Lui')+' · '+( labels[slot]||slot );

    // Pré-remplir depuis mémoire
    var banners=section==='elle'?_elleBanners:_luiBanners;
    var descs=section==='elle'?_elleDescs:_luiDescs;
    document.getElementById('slotEditBannerInput').value=banners[slot]||'';
    document.getElementById('slotEditDescInput').value=descs[slot]||'';

    // Photo
    var photoDiv=document.getElementById('slotEditPhoto');
    var placeholder=document.getElementById('slotEditPhotoPlaceholder');
    var imgEl=document.getElementById(section+'-img-'+slot);
    var hasPhoto=imgEl && imgEl.src && imgEl.style.display!=='none' && imgEl.src!==window.location.href && !imgEl.src.endsWith('/');
    if(photoDiv){
      if(hasPhoto){ photoDiv.style.backgroundImage='url('+imgEl.src+')'; photoDiv.innerHTML=''; if(placeholder) placeholder.style.display='none'; }
      else { photoDiv.style.backgroundImage=''; if(placeholder){ placeholder.style.display='flex'; photoDiv.innerHTML=''; photoDiv.appendChild(placeholder); } }
    }

    modal.classList.add('open');
  };

  window.slotCloseEdit = function(){
    var modal=document.getElementById('slotEditModal');
    if(modal) modal.classList.remove('open');
    _unblockBackgroundScroll();
    _restoreScrollPosition();
    _editSection=null; _editSlot=null;
  };

  // Clic sur la photo dans la modale → file input (identique à livresPhotoClick)
  window.slotEditPhotoClick = function(){
    if(!_editSection||!_editSlot) return;
    var inp=document.getElementById(_editSection==='elle'?'elleFileInput':'luiFileInput');
    if(!inp) return;
    inp.value='';
    inp._slotTarget=_editSlot; inp._sectionTarget=_editSection;
    inp.click();
  };

  // Handler file input elle (appelé par onchange dans HTML)
  window.elleHandleFile = function(input){
    if(!input.files||!input.files[0]) return;
    var slot=input._slotTarget; if(!slot) return;
    var file=input.files[0];
    // Aperçu immédiat
    var reader=new FileReader();
    reader.onload=function(ev){
      var photoDiv=document.getElementById('slotEditPhoto');
      var ph=document.getElementById('slotEditPhotoPlaceholder');
      if(photoDiv){ photoDiv.style.backgroundImage='url('+ev.target.result+')'; photoDiv.innerHTML=''; }
      if(ph) ph.style.display='none';
    };
    reader.readAsDataURL(file);
    _uploadPhoto('elle', slot, file);
  };

  // Handler file input lui
  window.luiHandleFile = function(input){
    if(!input.files||!input.files[0]) return;
    var slot=input._slotTarget; if(!slot) return;
    var file=input.files[0];
    var reader=new FileReader();
    reader.onload=function(ev){
      var photoDiv=document.getElementById('slotEditPhoto');
      var ph=document.getElementById('slotEditPhotoPlaceholder');
      if(photoDiv){ photoDiv.style.backgroundImage='url('+ev.target.result+')'; photoDiv.innerHTML=''; }
      if(ph) ph.style.display='none';
    };
    reader.readAsDataURL(file);
    _uploadPhoto('lui', slot, file);
  };

  // Sauvegarder titre + description (identique à livresSave)
  // Helper upsert : vérifie si la ligne existe (GET) puis PATCH ou POST
  function _upsertPhotoDesc(coupleId, category, slot, description){
    var qUrl=SB2_URL+'/rest/v1/v2_photo_descs?couple_id=eq.'+coupleId+'&category=eq.'+category+'&slot=eq.'+slot+'&select=id&limit=1';
    fetch(qUrl,{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      if(rows && rows.length>0){
        // Ligne existante → PATCH
        var id=rows[0].id;
        fetch(SB2_URL+'/rest/v1/v2_photo_descs?id=eq.'+id+'&couple_id=eq.'+coupleId,{
          method:'PATCH',
          headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),
          body:JSON.stringify({description:description})
        }).catch(function(){});
      } else {
        // Nouvelle ligne → POST
        fetch(SB2_URL+'/rest/v1/v2_photo_descs',{
          method:'POST',
          headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),
          body:JSON.stringify({couple_id:coupleId,category:category,slot:slot,description:description})
        }).catch(function(){});
      }
    }).catch(function(){});
  }

  window.slotEditSave = function(){
    if(!_editSection||!_editSlot) return;
    var coupleId=_getCoupleId(); if(!coupleId) return;
    var s=_editSection; var sl=_editSlot;
    var bannerVal=(document.getElementById('slotEditBannerInput').value||'').trim();
    var descVal=(document.getElementById('slotEditDescInput').value||'').trim();

    var banners=s==='elle'?_elleBanners:_luiBanners;
    var descs=s==='elle'?_elleDescs:_luiDescs;

    // Sauvegarder banner si renseigné
    if(bannerVal){
      banners[sl]=bannerVal;
      var bEl=document.getElementById(s+'-banner-'+sl); if(bEl) bEl.textContent=bannerVal;
      var lbl=document.querySelector('#'+s+'-empty-'+sl+' .lui-img-empty-lbl'); if(lbl) lbl.textContent=bannerVal;
      _upsertPhotoDesc(coupleId, s==='elle'?'elle_banner':'lui_banner', sl, bannerVal);
    }

    // Sauvegarder description si renseignée
    if(descVal){
      descs[sl]=descVal;
      var dEl=document.getElementById(s+'-desc-'+sl); if(dEl) dEl.textContent=descVal;
      _upsertPhotoDesc(coupleId, s, sl, descVal);
    }

    if(typeof showToast==='function') showToast('Pochette mise à jour ✓','success',2000);
    window.slotCloseEdit();
  };

  // Init
  document.addEventListener('nousContentReady', function(){
    var coupleId=_getCoupleId(); if(!coupleId) return;
    window.elleLoadImages();
    window.luiLoadImages();
    _loadData('elle');
    _loadData('lui');
    window.elleSyncSections();
  });

})();

// ════════════════════════════════════════════════════════════════════
// 6. FADE-IN OBSERVER
// ════════════════════════════════════════════════════════════════════
window._fadeObs = new IntersectionObserver(function(entries){
  entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('visible'); window._fadeObs.unobserve(e.target); } });
}, { threshold: 0.08 });
document.querySelectorAll('.fade-in').forEach(function(el){ window._fadeObs.observe(el); });


// ════════════════════════════════════════════════════════════════════
// 7. RAISONS D'AMOUR
// ════════════════════════════════════════════════════════════════════
var reasons = [];
var _reasonDeck = [], _reasonDeckPos = 0;

function _buildDeck(excludeFirst){
  var deck=[]; for(var k=0;k<reasons.length;k++) deck.push(k);
  for(var j=deck.length-1;j>0;j--){ var r=Math.floor(Math.random()*(j+1)); var tmp=deck[j]; deck[j]=deck[r]; deck[r]=tmp; }
  if(excludeFirst!==undefined&&deck[0]===excludeFirst&&deck.length>1){ var swap=1+Math.floor(Math.random()*(deck.length-1)); var t=deck[0]; deck[0]=deck[swap]; deck[swap]=t; }
  return deck;
}

function _initReasonsDeck(){
  if(!reasons.length) return;
  _reasonDeck=_buildDeck(); _reasonDeckPos=0;
  var i=_reasonDeck[_reasonDeckPos++];
  var rText=document.getElementById('reasonText');
  if(rText) rText.textContent=reasons[i];
}

function showReason(idx){
  var rText=document.getElementById('reasonText'); if(!rText||!reasons.length) return;
  rText.classList.remove('reason-in-down'); rText.classList.add('reason-out-up');
  setTimeout(function(){ rText.textContent=reasons[idx]; rText.classList.remove('reason-out-up'); void rText.offsetWidth; rText.classList.add('reason-in-down'); },200);
}

var _reasonAutoIv = null;
function _startReasonAuto(){
  if(_reasonAutoIv||!reasons.length) return;
  _reasonAutoIv = setInterval(function(){
    if(window._currentTab !== 'nous'||!reasons.length) return;
    if(_reasonDeckPos>=_reasonDeck.length){ var last=_reasonDeck[_reasonDeck.length-1]; _reasonDeck=_buildDeck(last); _reasonDeckPos=0; }
    showReason(_reasonDeck[_reasonDeckPos++]);
  }, 6000);
}

(function(){
  var box = document.getElementById('reasonBox');
  if(!box) return;
  box.addEventListener('click', function(){
    if(!reasons.length) return;
    if(_reasonDeckPos>=_reasonDeck.length){ var last=_reasonDeck[_reasonDeck.length-1]; _reasonDeck=_buildDeck(last); _reasonDeckPos=0; }
    showReason(_reasonDeck[_reasonDeckPos++]);
    if(_reasonAutoIv){ clearInterval(_reasonAutoIv); _reasonAutoIv=null; }
    _startReasonAuto();
  });
})();


// ════════════════════════════════════════════════════════════════════
// 8. PETITS MOTS — Stockés en base, visibles uniquement par le destinataire
// Table : v2_petits_mots (id, couple_id, author, title, text, color, icon, created_at)
// author = 'girl' ou 'boy' — le destinataire voit les mots de l'autre
// ════════════════════════════════════════════════════════════════════
(function(){

  var NOTE_COLORS = ['#1a3a2a','#2a1a2e','#1a2a3a','#2a2216','#1a2a2a','#2a1a1a','#1a1a2a','#222222'];
  var NOTE_ICONS  = ['💪','🌸','☀️','👵','⭐','🤗','🌙','💘','💌','✍️'];
  var rots = [-1.8,1.4,-0.9,2.0,-1.3,0.7,-2.2,1.1];
  var _stackData = [];
  var _stackIndex = 0;

  function _getCoupleId(){ var u=(typeof v2GetUser==='function')?v2GetUser():null; return u?u.couple_id:null; }
  function _getProfile(){ return (typeof getProfile==='function')?getProfile():'girl'; }

  // Charge les mots REÇUS (écrits par le partenaire)
  function _petitsMotsLoad(){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    var profile  = _getProfile();
    var author   = profile === 'girl' ? 'boy' : 'girl'; // mots écrits par l'autre
    fetch(SB2_URL+'/rest/v1/v2_petits_mots?couple_id=eq.'+coupleId+'&author=eq.'+author+'&order=created_at.asc&select=*',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      _stackData = Array.isArray(rows)?rows:[];
      // Ajouter post-it anniversaire si le 29
      _injectAnnivPostitIfNeeded();
      _stackIndex = 0;
      _buildPostitStack();
      // Rafraîchir le badge NEW (s'affiche uniquement pour le receveur)
      if(typeof window.yamRefreshNewBadges==='function') window.yamRefreshNewBadges();
    }).catch(function(){ _buildPostitStack(); });
  }
  window._petitsMotsLoad = _petitsMotsLoad;

  function _injectAnnivPostitIfNeeded(){
    var START = new Date(2024,9,29); var now = new Date();
    if(now.getDate()!==29) return;
    var months=(now.getFullYear()-START.getFullYear())*12+(now.getMonth()-START.getMonth());
    if(months<1) return;
    var msg = getAnnivPostitText(months);
    _stackData.unshift({id:'anniv',color:'#2a1a1a',icon:'🎂',title:'Bonne mensiversaire',text:msg,isAnniv:true});
  }

  function _buildPostitStack(){
    var stackWrap=document.getElementById('postitStack'); var stackCtr=document.getElementById('stackCounter');
    if(!stackWrap) return;
    stackWrap.innerHTML='';
    if(!_stackData.length){
      var emptyEl=document.createElement('div'); emptyEl.className='postit-empty';
      emptyEl.textContent='Aucun mot pour toi pour l\'instant...';
      stackWrap.appendChild(emptyEl);
      if(stackCtr) stackCtr.textContent='0 / 0';
      return;
    }
    var n=_stackData.length;
    for(var i=0;i<n;i++){
      var dIdx=(_stackIndex+n-1-i)%n; var dd=_stackData[dIdx]; var depth=n-1-i;
      var col = dd.color || NOTE_COLORS[dIdx%NOTE_COLORS.length];
      var icon= dd.icon  || NOTE_ICONS[dIdx%NOTE_ICONS.length];
      var el=document.createElement('div'); el.className='postit';
      el.style.zIndex=i+1;
      el.style.transform='translateY('+(depth*4)+'px) rotate('+rots[dIdx%rots.length]+'deg)';
      el.style.opacity=depth===0?'1':String(Math.max(0.38,1-depth*0.16));
      el.innerHTML='<div class="p-art" style="background:'+escHtml(col)+'">'+escHtml(icon)+'</div><div class="p-body"><div class="p-title">'+escHtml(dd.title||'')+'</div><div class="p-text">'+escHtml(dd.text||'')+'</div></div>';
      if(dd.isAnniv){ el.style.boxShadow='0 0 0 2px rgba(245,197,24,0.6), 0 8px 32px rgba(0,0,0,0.45)'; }
      stackWrap.appendChild(el);
    }
    if(stackCtr) stackCtr.textContent=(_stackIndex+1)+' / '+n;
    var top=stackWrap.lastElementChild; if(top) _attachPostitEvents(top);
  }
  window.buildStack = _buildPostitStack;

  function _dismissTop(dirX){
    var top=document.getElementById('postitStack').lastElementChild; if(!top||top._dismissing||top.className==='postit-empty') return;
    top._dismissing=true; var angle=dirX>0?18:-18; var tx=dirX>0?'115%':'-115%';
    top.style.transition='transform 0.32s cubic-bezier(.4,0,.6,1), opacity 0.26s';
    top.style.transform='translateX('+tx+') rotate('+angle+'deg)'; top.style.opacity='0'; top.style.pointerEvents='none';
    _stackIndex=(_stackIndex+1)%_stackData.length; setTimeout(_buildPostitStack,300);
  }

  function _attachPostitEvents(el){
    var startX,startY,dragging=false,moved=false; var baseRot=rots[_stackIndex%rots.length];
    el.addEventListener('touchstart',function(e){ if(el._dismissing) return; var t=e.touches[0]; startX=t.clientX; startY=t.clientY; dragging=true; moved=false; el.style.transition='none'; },{passive:true});
    el.addEventListener('touchmove',function(e){ if(!dragging||el._dismissing) return; var t=e.touches[0]; var dx=t.clientX-startX; var dy=t.clientY-startY; if(Math.abs(dx)<4&&Math.abs(dy)<4) return; moved=true; if(Math.abs(dx)>Math.abs(dy)){ e.preventDefault(); var rot=baseRot+dx*0.06; var lift=Math.min(Math.abs(dx)*0.04,6); el.style.transform='translateX('+dx+'px) translateY(-'+lift+'px) rotate('+rot+'deg)'; el.style.opacity=String(Math.max(0.3,1-Math.abs(dx)/280)); } },{passive:false});
    el.addEventListener('touchend',function(e){ if(!dragging||el._dismissing) return; dragging=false; var t=e.changedTouches[0]; var dx=t.clientX-startX; var dy=t.clientY-startY; if(!moved){ _dismissTop(1); return; } if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>60){ _dismissTop(dx>0?1:-1); } else { el.style.transition='transform 0.3s cubic-bezier(.4,2,.55,.9), opacity 0.2s'; el.style.transform='translateY(0px) rotate('+baseRot+'deg)'; el.style.opacity='1'; } },{passive:true});
    el.addEventListener('mousedown',function(e){ if(el._dismissing) return; startX=e.clientX; startY=e.clientY; dragging=true; moved=false; el.style.transition='none'; el.style.cursor='grabbing'; });
    document.addEventListener('mousemove',function onMove(e){ if(!dragging||el._dismissing) return; var dx=e.clientX-startX; var dy=e.clientY-startY; if(Math.abs(dx)<4&&Math.abs(dy)<4) return; moved=true; var rot=baseRot+dx*0.06; var lift=Math.min(Math.abs(dx)*0.04,6); el.style.transform='translateX('+dx+'px) translateY(-'+lift+'px) rotate('+rot+'deg)'; el.style.opacity=String(Math.max(0.3,1-Math.abs(dx)/280)); el._onMove=onMove; });
    document.addEventListener('mouseup',function onUp(e){ if(!dragging||el._dismissing) return; dragging=false; el.style.cursor='pointer'; document.removeEventListener('mousemove',el._onMove); document.removeEventListener('mouseup',onUp); var dx=e.clientX-startX; var dy=e.clientY-startY; if(!moved){ _dismissTop(1); return; } if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>60){ _dismissTop(dx>0?1:-1); } else { el.style.transition='transform 0.3s cubic-bezier(.4,2,.55,.9), opacity 0.2s'; el.style.transform='translateY(0px) rotate('+baseRot+'deg)'; el.style.opacity='1'; } });
  }

  // ── Gestion pop-up petits mots écrits ──
  window.openPetitsMotsGestion = function(){
    var modal = document.getElementById('petitsMotsGestionModal'); if(!modal) return;
    _saveScrollPosition();
    _blockBackgroundScroll();
    _renderPetitsMotsGestion();
    modal.classList.add('open');
  };
  window.closePetitsMotsGestion = function(){
    var modal = document.getElementById('petitsMotsGestionModal'); if(modal) modal.classList.remove('open');
    _unblockBackgroundScroll();
    _restoreScrollPosition();
  };

  function _renderPetitsMotsGestion(){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    var profile  = _getProfile();
    var list = document.getElementById('petitsMotsGestionList'); if(!list) return;
    list.innerHTML='<div style="color:var(--muted);font-size:13px;padding:16px;text-align:center;">Chargement...</div>';
    // Charge les mots écrits PAR moi (pour mon partenaire)
    fetch(SB2_URL+'/rest/v1/v2_petits_mots?couple_id=eq.'+coupleId+'&author=eq.'+profile+'&order=created_at.desc&select=*',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      list.innerHTML='';
      if(!Array.isArray(rows)||!rows.length){
        list.innerHTML='<div style="color:var(--muted);font-size:13px;padding:24px;text-align:center;">Tu n\'as pas encore écrit de mots pour ton partenaire.</div>';
      } else {
        rows.forEach(function(mot){
          var row=document.createElement('div'); row.className='petits-mots-gestion-row';
          var col=mot.color||NOTE_COLORS[0]; var icon=mot.icon||'💌';
          row.innerHTML=
            '<div class="petits-mots-gestion-icon" style="background:'+escHtml(col)+'">'+escHtml(icon)+'</div>'+
            '<div class="petits-mots-gestion-info">'+
              '<div class="petits-mots-gestion-title">'+escHtml(mot.title||'Sans titre')+'</div>'+
              '<div class="petits-mots-gestion-prev">'+escHtml((mot.text||'').substring(0,50))+((mot.text||'').length>50?'…':'')+'</div>'+
            '</div>'+
            '<button class="petits-mots-edit-btn" aria-label="Modifier">'+_gearSVG()+'</button>'+
            '<button class="petits-mots-del-btn" aria-label="Supprimer">✕</button>';
          (function(m){
            row.querySelector('.petits-mots-edit-btn').addEventListener('click',function(){ _openPetitsMotsEditor(m); });
            row.querySelector('.petits-mots-del-btn').addEventListener('click',function(){
              if(!confirm('Supprimer ce mot ?')) return;
              fetch(SB2_URL+'/rest/v1/v2_petits_mots?id=eq.'+m.id+'&couple_id=eq.'+coupleId,{method:'DELETE',headers:sb2Headers()})
              .then(function(){ _renderPetitsMotsGestion(); _petitsMotsLoad(); }).catch(function(){});
            });
          })(mot);
          list.appendChild(row);
        });
      }
      // Bouton ajouter
      var addBtn=document.createElement('button'); addBtn.className='petits-mots-add-btn';
      addBtn.textContent='+ Ajouter un mot';
      addBtn.addEventListener('click',function(){ _openPetitsMotsEditor(null); });
      list.appendChild(addBtn);
    }).catch(function(){ list.innerHTML='<div style="color:#e05555;font-size:13px;padding:16px;">Erreur de chargement</div>'; });
  }

  var _editingMot = null;
  function _openPetitsMotsEditor(mot){
    _editingMot = mot;
    var editor = document.getElementById('petitsMotsEditor'); if(!editor) return;
    _saveScrollPosition();
    _blockBackgroundScroll();
    document.getElementById('petitsMotsEditorTitle').value = mot?(mot.title||''):'';
    document.getElementById('petitsMotsEditorText').value  = mot?(mot.text||''):'';
    document.getElementById('petitsMotsEditorIcon').value  = mot?(mot.icon||'💌'):'💌';
    // Couleur
    var colorPicker = document.getElementById('petitsMotsColorPicker');
    if(colorPicker){
      colorPicker.innerHTML='';
      NOTE_COLORS.forEach(function(c){
        var btn=document.createElement('button'); btn.className='pm-color-btn'+(mot&&mot.color===c?' active':'');
        btn.style.background=c; btn.dataset.color=c;
        btn.addEventListener('click',function(){
          colorPicker.querySelectorAll('.pm-color-btn').forEach(function(b){ b.classList.remove('active'); });
          btn.classList.add('active');
        });
        colorPicker.appendChild(btn);
      });
      if(!mot) colorPicker.querySelector('.pm-color-btn').classList.add('active');
    }
    editor.classList.add('open');
  }
  window.closePetitsMotsEditor = function(){
    var editor = document.getElementById('petitsMotsEditor'); if(editor) editor.classList.remove('open');
    _unblockBackgroundScroll();
    _restoreScrollPosition();
    _editingMot = null;
  };

  window.savePetitMot = function(){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    var profile  = _getProfile();
    var title = (document.getElementById('petitsMotsEditorTitle').value||'').trim();
    var text  = (document.getElementById('petitsMotsEditorText').value||'').trim();
    var icon  = (document.getElementById('petitsMotsEditorIcon').value||'💌').trim();
    if(!text){ if(typeof showToast==='function') showToast('Le message ne peut pas être vide','error'); return; }
    var activeColor = document.querySelector('#petitsMotsColorPicker .pm-color-btn.active');
    var color = activeColor ? activeColor.dataset.color : NOTE_COLORS[0];
    var data = { couple_id:coupleId, author:profile, title:title||'Sans titre', text:text, icon:icon, color:color };
    var btn = document.getElementById('petitsMotsSaveBtn'); if(btn){ btn.textContent='...'; btn.disabled=true; }
    var done = function(){ if(btn){ btn.textContent='Sauvegarder'; btn.disabled=false; } window.closePetitsMotsEditor(); _renderPetitsMotsGestion(); _petitsMotsLoad();
      // Le NEW apparaît côté receveur — on marque via une clé partagée couple
      // Le receveur le verra à sa prochaine ouverture
      if(typeof window.yamMarkNew==='function') window.yamMarkNew('petit_mot');
    };
    if(_editingMot&&_editingMot.id){
      fetch(SB2_URL+'/rest/v1/v2_petits_mots?id=eq.'+_editingMot.id+'&couple_id=eq.'+coupleId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)}).then(done).catch(done);
    } else {
      fetch(SB2_URL+'/rest/v1/v2_petits_mots',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)}).then(done).catch(done);
    }
  };

  // Fermer en cliquant dehors
  setTimeout(function(){
    var gm=document.getElementById('petitsMotsGestionModal');
    if(gm) gm.addEventListener('click',function(e){ if(e.target===gm) window.closePetitsMotsGestion(); });
    var ed=document.getElementById('petitsMotsEditor');
    if(ed) ed.addEventListener('click',function(e){ if(e.target===ed) window.closePetitsMotsEditor(); });
  },0);

})();

// Textes anniversaire post-its
var annivPostitMessages=[
  null,
  "Un mois de plus à tes côtés... et j'en veux encore des centaines",
  "Deux mois. Deux mois à sourire grâce à toi. J'espère ne jamais m'y habituer",
  "Trois mois ensemble — et déjà je sais plus comment c'était avant toi",
  "Quatre mois. Chaque journée avec toi est un cadeau que je garde précieusement",
  "Cinq mois. T'es devenue une évidence dans ma vie, et c'est la plus belle des évidences",
  "Six mois déjà. La moitié d'une année à être heureux — grâce à toi",
  "Sept mois. Je recompte parfois depuis le début juste pour me rappeler ma chance",
  "Huit mois. Nos souvenirs s'accumulent et chacun d'eux me fait sourire",
  "Neuf mois. Je t'aime un peu plus fort qu'hier, et moins fort que demain",
  "Dix mois. T'es mon endroit préféré au monde",
  "Onze mois. Presque un an... et pourtant ça me semble à peine commencé"
];

function getAnnivPostitText(months){
  if(months%12===0){ var years=months/12; if(years===1) return "Un an ensemble !! Boucle bouclée, mais notre histoire elle, ne fait que commencer"; if(years===2) return "Deux ans. Deux ans à construire quelque chose de vrai, de beau, de nous."; if(years===3) return "Trois ans. Trois ans que t'es ma meilleure décision."; return years+" ans ensemble. Je recommencerais mille fois."; }
  else if(months<12){ return annivPostitMessages[months]; }
  else { var m=months%12===0?12:months%12; var y=Math.floor(months/12); return y+" an"+(y>1?"s":"")+" et "+m+" mois. Chaque jour compte, et chaque jour t'es là."; }
}
window.getAnnivPostitText = getAnnivPostitText;


// ════════════════════════════════════════════════════════════════════
// 9. BADGE MESSAGES NON-LUS (polling)
// ════════════════════════════════════════════════════════════════════
function _startLockBadgePolling(){
  var _prevUnreadCount=-1;
  function checkUnread(){
    var hiddenPage=document.getElementById('hiddenPage'); var chatScreen=document.getElementById('dmChatScreen');
    if(hiddenPage&&hiddenPage.classList.contains('active')&&chatScreen&&chatScreen.style.display!=='none') return;
    var profile=getProfile(); if(!profile) return;
    var other=profile==='girl'?'boy':'girl';
    var coupleId=(typeof v2GetUser==='function'&&v2GetUser())?v2GetUser().couple_id:null; if(!coupleId) return;
    fetch(SB2_URL+'/rest/v1/v2_dm_messages?couple_id=eq.'+coupleId+'&sender=eq.'+other+'&seen=eq.false&deleted=eq.false&order=created_at.desc&limit=99',{headers:sb2Headers()})
    .then(function(r){ return r.json(); })
    .then(function(rows){
      if(!Array.isArray(rows)) return;
      var unread=rows.length;
      var lockBtn=document.getElementById('lockNavBtn'); var lockBadge=document.getElementById('lockUnreadBadge');
      if(!lockBtn||!lockBadge) return;
      if(unread>0){
        lockBadge.textContent=unread>99?'99+':unread; lockBadge.classList.add('visible'); lockBtn.classList.add('has-unread');
        if(_prevUnreadCount>=0&&unread>_prevUnreadCount&&window._currentTab!=='messages'){
          var last=rows[0];
          var avatarSrc=window.yamAvatarSrc?window.yamAvatarSrc(other):('assets/images/profil_'+other+'.png');
          var name=(typeof v2GetDisplayName==='function'?v2GetDisplayName(other):(other==='girl'?'Elle':'Lui'));
          var txt=(last&&last.text)?last.text:'Nouveau message';
          if(window.showMsgHeaderPill) window.showMsgHeaderPill(avatarSrc,name,txt,true);
        }
      } else { lockBadge.classList.remove('visible'); lockBtn.classList.remove('has-unread'); }
      _prevUnreadCount=unread;
    }).catch(function(){});
  }
  window._checkUnread=checkUnread;
  checkUnread();
  setInterval(checkUnread,8000);
  document.addEventListener('hiddenPageClosed',function(){ checkUnread(); });
}


// ════════════════════════════════════════════════════════════════════
// 10. LIKES CŒURS
// ════════════════════════════════════════════════════════════════════
function fmtLikes(n){ if(!n||n<=0) return '0'; if(n>=1000000) return (n/1000000).toFixed(1).replace('.0','')+'M'; if(n>=1000) return (n/1000).toFixed(1).replace('.0','')+'k'; return String(n); }


// ── Paliers journaliers cœurs ──────────────────────────────────────────────
var _heartMilestones = [10, 50, 100, 200, 500];
var _lastMilestone   = 0;

// Cache journalier localStorage
function _heartTodayKey(){
  var u = (typeof v2GetUser==='function'&&v2GetUser()) ? v2GetUser().couple_id : 'x';
  var d = new Date();
  var dt = d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
  return 'yam_hearts_day_'+u+'_'+dt;
}
function _getDailyCount(){
  try{ return parseInt(localStorage.getItem(_heartTodayKey())||'0')||0; }catch(e){ return 0; }
}
function _incDailyCount(){
  try{
    var k=_heartTodayKey();
    var n=(parseInt(localStorage.getItem(k)||'0')||0)+1;
    localStorage.setItem(k,n);
    return n;
  }catch(e){ return 0; }
}

function _checkMilestone(daily){
  for(var i=_heartMilestones.length-1;i>=0;i--){
    if(daily>=_heartMilestones[i] && _heartMilestones[i]>_lastMilestone){
      _lastMilestone=_heartMilestones[i];
      _triggerMilestone(_heartMilestones[i]);
      break;
    }
  }
}
function _triggerMilestone(n){
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;z-index:9999;pointer-events:none;'
    +'display:flex;align-items:center;justify-content:center;'
    +'background:rgba(232,100,150,0.18);animation:milestoneFlash 1.5s ease forwards;';
  overlay.innerHTML='<div style="text-align:center;animation:milestonePop 1.5s ease forwards;">'
    +'<div style="font-size:54px;line-height:1;">🩷</div>'
    +'<div style="font-size:21px;font-weight:900;color:#fff;text-shadow:0 2px 14px rgba(220,80,130,0.9);margin-top:8px;">'
    +n+' cœurs aujourd\'hui !</div>'
    +'</div>';
  document.body.appendChild(overlay);
  setTimeout(function(){ overlay.remove(); },1600);
  if(typeof showToast==='function') showToast(n+' cœurs envoyés aujourd\'hui 🩷','success');
}

function _updateSpamBar(daily){
  // Prochain palier non encore atteint
  var nextM=_heartMilestones[0], prevM=0;
  for(var i=0;i<_heartMilestones.length;i++){
    if(daily<_heartMilestones[i]){ nextM=_heartMilestones[i]; break; }
    if(i===_heartMilestones.length-1){ nextM=_heartMilestones[i]+100; } // au delà du dernier
  }
  for(var j=_heartMilestones.length-1;j>=0;j--){
    if(daily>=_heartMilestones[j]){ prevM=_heartMilestones[j]; break; }
  }
  var pct=(nextM>prevM)?Math.min(((daily-prevM)/(nextM-prevM))*100,100):100;
  var countEl=document.getElementById('homeSpamCount');
  var barEl=document.getElementById('homeSpamBar');
  if(countEl) countEl.textContent=daily+'/'+nextM;
  if(barEl)   barEl.style.width=pct+'%';
}
window._updateSpamBar = _updateSpamBar;

function spawnHeart(){
  var profile=getProfile()||null; if(!profile) return;
  var coupleId=(typeof v2GetUser==='function'&&v2GetUser())?v2GetUser().couple_id:null;
  if(!coupleId) return;

  // Spawn depuis le bouton vers le haut
  var btn=document.getElementById('homeSpamHeart');
  var sx=window.innerWidth/2, sy=window.innerHeight/2;
  if(btn){ var r=btn.getBoundingClientRect(); sx=r.left+r.width/2; sy=r.top+r.height/2; }
  var h=document.createElement('div');
  h.className='like-heart-btn';
  h.textContent='🩷';
  var dx=(Math.random()-0.5)*70;
  h.style.setProperty('--dx',dx+'px');
  h.style.left=sx+'px';
  h.style.top=sy+'px';
  document.body.appendChild(h);
  setTimeout(function(){ h.remove(); },900);

  // Incrémenter le daily count + mettre à jour barre instantanément
  var daily=_incDailyCount();
  _updateSpamBar(daily);
  _checkMilestone(daily);

  // Incrémenter le total (pour les bulles météo)
  var numEl=document.getElementById(profile==='girl'?'likeNumGirl':'likeNumBoy');
  if(numEl){
    var txt=(numEl.textContent||'0').trim();
    var cur=0;
    if(txt.endsWith('M')) cur=parseFloat(txt)*1000000;
    else if(txt.endsWith('k')) cur=parseFloat(txt)*1000;
    else cur=parseInt(txt)||0;
    numEl.textContent=fmtLikes(cur+1);
  }

  fetch(SB2_URL+'/rest/v1/rpc/increment_like_counter',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},sb2Headers()),body:JSON.stringify({p_profile:profile,p_couple_id:coupleId})})
  .then(function(r){ if(!r.ok){ return r.text().then(function(){ loadLikeCounters(); }); } if(window.scheduleLikeSync) window.scheduleLikeSync(); })
  .catch(function(){ loadLikeCounters(); });
}
window.spawnHeart = spawnHeart;


function loadLikeCounters(){
  var coupleId=(typeof v2GetUser==='function'&&v2GetUser())?v2GetUser().couple_id:null; if(!coupleId) return;
  fetch(SB2_URL+'/rest/v1/v2_like_counters?couple_id=eq.'+coupleId+'&select=profile,total',{headers:sb2Headers()})
  .then(function(r){ return r.ok?r.json():[]; })
  .then(function(rows){
    if(!Array.isArray(rows)) return;
    var elGirl=document.getElementById('likeNumGirl'); var elBoy=document.getElementById('likeNumBoy');
    var foundGirl=false; var foundBoy=false;
    rows.forEach(function(r){ if(r.profile==='girl'&&elGirl){ elGirl.textContent=fmtLikes(r.total); foundGirl=true; } if(r.profile==='boy'&&elBoy){ elBoy.textContent=fmtLikes(r.total); foundBoy=true; } });
    if(!foundGirl&&elGirl) elGirl.textContent='0'; if(!foundBoy&&elBoy) elBoy.textContent='0';
  }).catch(function(){});
}
window.loadLikeCounters=loadLikeCounters;

var _likeSyncDebounce=null;
window.scheduleLikeSync=function(){ if(_likeSyncDebounce) clearTimeout(_likeSyncDebounce); _likeSyncDebounce=setTimeout(function(){ loadLikeCounters(); _likeSyncDebounce=null; },800); };

loadLikeCounters();


// ════════════════════════════════════════════════════════════════════
// 11. MÉMO COUPLE — Note unique + Todo list, sans PIN
//     • Clic Note  → vue lecture (openMemoNoteView) → bouton Modifier → openMemoNoteEdit
//     • Clic Todo  → vue lecture cochable (openMemoTodoView) → bouton Modifier → openMemoTodoEdit
//     • Crayon Note  → édition note seule (openMemoNoteEdit)
//     • Crayon Todo  → édition todo seule (openMemoTodoEdit)
// ════════════════════════════════════════════════════════════════════
(function(){

  function _getSession(){ return (typeof v2GetUser==='function')?v2GetUser():null; }

  // ── Rendu principal : aperçu note + todo côte à côte ──
  function renderMemoCouple(){
    _renderMemoPreview();
    _renderTodoPreview();
  }
  window.renderMemoCouple = renderMemoCouple;
  window.renderNotes = renderMemoCouple;
  window.renderTodos = renderMemoCouple;

  // ── Aperçu de la note ──
  function _renderMemoPreview(){
    var el = document.getElementById('memoNotePreview'); if(!el) return;
    var su = _getSession(); var coupleId = su?su.couple_id:null; if(!coupleId){ el.textContent=''; return; }
    fetch(SB2_URL+'/rest/v1/v2_memo_notes?couple_id=eq.'+coupleId+'&order=updated_at.desc&limit=1',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(notes){
      if(!Array.isArray(notes)||!notes.length){
        el.innerHTML='<span style="color:var(--muted);font-size:12px;">Aucune note — appuie pour écrire</span>';
        var dateEl=document.getElementById('memoNoteDate'); if(dateEl) dateEl.textContent='';
        return;
      }
      var note = notes[0];
      var prev = (note.text||'').substring(0,120)+((note.text||'').length>120?'…':'');
      el.textContent = prev;
      var modDate = note.updated_at||note.created_at;
      var d = new Date(modDate);
      var dateEl = document.getElementById('memoNoteDate');
      var isUpd = note.updated_at&&note.updated_at!==note.created_at;
      if(dateEl) dateEl.textContent = (isUpd?'Modifié ':'Créé ')+d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    }).catch(function(){});
  }

  // ── Aperçu de la todo ──
  function _renderTodoPreview(){
    var container = document.getElementById('memoTodoPreview'); if(!container) return;
    var su = _getSession(); var coupleId = su?su.couple_id:null; if(!coupleId){ container.innerHTML=''; return; }
    fetch(SB2_URL+'/rest/v1/v2_memo_todos?couple_id=eq.'+coupleId+'&order=created_at.asc&limit=5',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(items){
      container.innerHTML='';
      if(!Array.isArray(items)||!items.length){
        container.innerHTML='<span style="color:var(--muted);font-size:12px;">Liste vide — appuie pour ajouter</span>';
        return;
      }
      items.forEach(function(item){
        var row=document.createElement('div'); row.className='memo-todo-preview-row';
        row.innerHTML='<span class="memo-todo-preview-check'+(item.done?' done':'')+'"></span><span class="memo-todo-preview-text'+(item.done?' done':'')+'">'+escHtml(item.text)+'</span>';
        container.appendChild(row);
      });
    }).catch(function(){});
  }

  // ════════════════════════════════════════════════
  // VUE NOTE (lecture seule)
  // ════════════════════════════════════════════════
  window.openMemoNoteView = function(){
    var modal = document.getElementById('memoNoteViewModal'); if(!modal) return;
    var su = _getSession(); var coupleId = su?su.couple_id:null; if(!coupleId) return;
    _saveScrollPosition();
    _blockBackgroundScroll();
    var txtEl   = document.getElementById('memoNoteViewText');
    var titleEl = document.getElementById('memoNoteViewTitle');
    var dateEl  = document.getElementById('memoNoteViewDate');
    if(txtEl) txtEl.textContent = 'Chargement...';
    modal.classList.add('open');
    fetch(SB2_URL+'/rest/v1/v2_memo_notes?couple_id=eq.'+coupleId+'&order=updated_at.desc&limit=1',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(notes){
      var note = Array.isArray(notes)&&notes.length?notes[0]:null;
      if(!note){ if(txtEl) txtEl.textContent='Aucune note pour l\'instant.'; return; }
      if(titleEl) titleEl.textContent = note.title||'Note';
      if(txtEl)   txtEl.textContent   = note.text||'';
      if(dateEl&&(note.updated_at||note.created_at)){
        var d=new Date(note.updated_at||note.created_at);
        var isUpd=note.updated_at&&note.updated_at!==note.created_at;
        dateEl.textContent=(isUpd?'Modifié ':'Créé ')+d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      }
    }).catch(function(){ if(txtEl) txtEl.textContent='Erreur de chargement.'; });
  };
  window.closeMemoNoteView = function(){
    var modal = document.getElementById('memoNoteViewModal'); if(modal) modal.classList.remove('open');
    _unblockBackgroundScroll();
    _restoreScrollPosition();
  };
  // Transition vue→edit sans double-lock
  window.memoNoteViewToEdit = function(){
    var viewModal = document.getElementById('memoNoteViewModal'); if(viewModal) viewModal.classList.remove('open');
    // Ne pas unblock/reblock — on reste verrouillé, on ouvre juste l'edit
    _loadMemoNoteForEdit();
    var editModal = document.getElementById('memoNoteEditModal'); if(editModal) editModal.classList.add('open');
  };

  // ════════════════════════════════════════════════
  // VUE TODO (lecture + cochable, sans drag & drop)
  // ════════════════════════════════════════════════
  window.openMemoTodoView = function(){
    var modal = document.getElementById('memoTodoViewModal'); if(!modal) return;
    _saveScrollPosition();
    _blockBackgroundScroll();
    modal.classList.add('open');
    _loadTodoView();
  };
  window.closeMemoTodoView = function(){
    var modal = document.getElementById('memoTodoViewModal'); if(modal) modal.classList.remove('open');
    _unblockBackgroundScroll();
    _restoreScrollPosition();
    renderMemoCouple();
  };
  // Transition vue→edit sans double-lock
  window.memoTodoViewToEdit = function(){
    var viewModal = document.getElementById('memoTodoViewModal'); if(viewModal) viewModal.classList.remove('open');
    _loadTodoFull();
    var editModal = document.getElementById('memoTodoEditModal'); if(editModal) editModal.classList.add('open');
  };

  function _loadTodoView(){
    var su = _getSession(); var coupleId = su?su.couple_id:null; if(!coupleId) return;
    var container = document.getElementById('memoTodoViewList'); if(!container) return;
    container.innerHTML='<div style="color:var(--muted);font-size:13px;padding:12px;">Chargement...</div>';
    fetch(SB2_URL+'/rest/v1/v2_memo_todos?couple_id=eq.'+coupleId+'&order=created_at.asc',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(items){
      container.innerHTML='';
      if(!Array.isArray(items)||!items.length){
        var empty=document.createElement('div');
        empty.style.cssText='color:var(--muted);font-size:13px;padding:20px;text-align:center;';
        empty.textContent='Aucun item — utilise Modifier pour en ajouter.';
        container.appendChild(empty);
        return;
      }
      items.forEach(function(item){
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--s2);border-radius:12px;border:1px solid var(--border);';
        row.innerHTML =
          '<div class="todo-check'+(item.done?' done':'')+'" style="width:22px;height:22px;border-radius:6px;border:2px solid '+(item.done?'#e879a0':'var(--border)')+';background:'+(item.done?'linear-gradient(135deg,#e879a0,#9b59b6)':'transparent')+';display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:13px;color:#fff;">'+(item.done?'✓':'')+'</div>'+
          '<div style="flex:1;font-size:14px;color:var(--text);'+(item.done?'text-decoration:line-through;opacity:0.5;':'')+'">' +escHtml(item.text)+'</div>';
        (function(it, r){
          r.querySelector('.todo-check').addEventListener('click', function(){
            fetch(SB2_URL+'/rest/v1/v2_memo_todos?id=eq.'+it.id+'&couple_id=eq.'+coupleId,{
              method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),
              body:JSON.stringify({done:!it.done})
            }).then(function(){ _loadTodoView(); _renderTodoPreview(); });
          });
        })(item, row);
        container.appendChild(row);
      });
    }).catch(function(){ container.innerHTML='<div style="color:#e05555;font-size:13px;padding:12px;">Erreur de chargement</div>'; });
  }

  // ════════════════════════════════════════════════
  // MODAL ÉDITION NOTE (seule)
  // ════════════════════════════════════════════════
  var _currentNoteId = null;

  window.openMemoNoteEdit = function(){
    var modal = document.getElementById('memoNoteEditModal'); if(!modal) return;
    _saveScrollPosition();
    _forceScrollLock();
    _loadMemoNoteForEdit();
    modal.classList.add('open');
  };
  window.closeMemoNoteEdit = function(){
    var modal = document.getElementById('memoNoteEditModal'); if(modal) modal.classList.remove('open');
    _unblockBackgroundScroll();
    _restoreScrollPosition();
    renderMemoCouple();
  };

  function _loadMemoNoteForEdit(){
    var su = _getSession(); var coupleId = su?su.couple_id:null; if(!coupleId) return;
    fetch(SB2_URL+'/rest/v1/v2_memo_notes?couple_id=eq.'+coupleId+'&order=updated_at.desc&limit=1',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(notes){
      var note = Array.isArray(notes)&&notes.length?notes[0]:null;
      _currentNoteId = note?note.id:null;
      var ta = document.getElementById('memoPopupTextarea');
      var ti = document.getElementById('memoPopupTitleInput');
      if(ta) ta.value = note?(note.text||''):'';
      if(ti) ti.value = note?(note.title||''):'';
      var dateEl = document.getElementById('memoPopupDate');
      if(dateEl&&note){
        var d=new Date(note.updated_at||note.created_at);
        var isUpd=note.updated_at&&note.updated_at!==note.created_at;
        dateEl.textContent=(isUpd?'Modifié ':'Créé ')+d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      } else if(dateEl){ dateEl.textContent=''; }
    }).catch(function(){});
  }

  window.memoSaveNote = function(){
    var su = _getSession(); var coupleId = su?su.couple_id:null; if(!coupleId) return;
    var txt = (document.getElementById('memoPopupTextarea').value||'').trim();
    var ttl = (document.getElementById('memoPopupTitleInput').value||'').trim()||'Note';
    var btn = document.getElementById('memoPopupSaveBtn'); if(btn){ btn.textContent='...'; btn.disabled=true; }
    var done = function(){ 
      if(btn){ btn.textContent='Modifier'; btn.disabled=false; } 
      renderMemoCouple(); 
      // Badge NEW pour les deux
      if(typeof window.yamMarkNewAndRefresh==='function') window.yamMarkNewAndRefresh('memo_note');
      // NOUVEAU : Toast de confirmation
      if(typeof showToast === 'function') showToast('Note sauvegardée ✓', 'success', 2000);
    };
    if(_currentNoteId){
      fetch(SB2_URL+'/rest/v1/v2_memo_notes?id=eq.'+_currentNoteId+'&couple_id=eq.'+coupleId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({text:txt,title:ttl,updated_at:new Date().toISOString()})}).then(done).catch(done);
    } else {
      if(!txt) return done();
      fetch(SB2_URL+'/rest/v1/v2_memo_notes',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({couple_id:coupleId,text:txt,title:ttl})}).then(function(){ _loadMemoNoteForEdit(); done(); }).catch(done);
    }
  };

  // ════════════════════════════════════════════════
  // MODAL ÉDITION TODO (seule)
  // ════════════════════════════════════════════════
  window.openMemoTodoEdit = function(){
    var modal = document.getElementById('memoTodoEditModal'); if(!modal) return;
    _saveScrollPosition();
    _forceScrollLock();
    modal.classList.add('open');
    _loadTodoFull();
  };
  window.closeMemoTodoEdit = function(){
    var modal = document.getElementById('memoTodoEditModal'); if(modal) modal.classList.remove('open');
    _unblockBackgroundScroll();
    _restoreScrollPosition();
    renderMemoCouple();
  };

  function _loadTodoFull(){
    var su = _getSession(); var coupleId = su?su.couple_id:null; if(!coupleId) return;
    var container = document.getElementById('memoPopupTodoList'); if(!container) return;
    container.innerHTML='<div style="color:var(--muted);font-size:12px;padding:8px;">Chargement...</div>';
    fetch(SB2_URL+'/rest/v1/v2_memo_todos?couple_id=eq.'+coupleId+'&order=created_at.asc',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(items){
      container.innerHTML='';
      if(!Array.isArray(items)||!items.length){
        var empty=document.createElement('div'); empty.style.cssText='color:var(--muted);font-size:12px;padding:8px;'; empty.textContent='Aucun item.'; container.appendChild(empty);
      } else {
        items.forEach(function(item){
          var row=document.createElement('div'); row.className='todo-item';
          row.innerHTML='<div class="todo-check'+(item.done?' done':'')+'">'+(item.done?'✓':'')+'</div><div class="todo-text'+(item.done?' done':'')+'">' +escHtml(item.text)+'</div><div class="todo-del">✕</div>';
          (function(it){
            row.querySelector('.todo-check').addEventListener('click',function(){
              fetch(SB2_URL+'/rest/v1/v2_memo_todos?id=eq.'+it.id+'&couple_id=eq.'+coupleId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({done:!it.done})}).then(_loadTodoFull);
            });
            row.querySelector('.todo-del').addEventListener('click',function(e){ e.stopPropagation();
              fetch(SB2_URL+'/rest/v1/v2_memo_todos?id=eq.'+it.id+'&couple_id=eq.'+coupleId,{method:'DELETE',headers:sb2Headers()}).then(_loadTodoFull);
            });
          })(item);
          container.appendChild(row);
        });
      }
    }).catch(function(){});
  }

  window.memoAddTodoItem = function(){
    var su = _getSession(); var coupleId = su?su.couple_id:null; if(!coupleId) return;
    var input = document.getElementById('memoPopupTodoInput'); if(!input) return;
    var txt = input.value.trim(); if(!txt) return; input.value='';
    fetch(SB2_URL+'/rest/v1/v2_memo_todos',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({couple_id:coupleId,text:txt,done:false})}).then(function(){
      _loadTodoFull();
      if(typeof window.yamMarkNewAndRefresh==='function') window.yamMarkNewAndRefresh('memo_todo');
    });
  };

  // Fermer en cliquant dehors
  setTimeout(function(){
    var ne = document.getElementById('memoNoteEditModal');
    if(ne) ne.addEventListener('click',function(e){ if(e.target===ne) window.closeMemoNoteEdit(); });
    var te = document.getElementById('memoTodoEditModal');
    if(te) te.addEventListener('click',function(e){ if(e.target===te) window.closeMemoTodoEdit(); });
    var nv = document.getElementById('memoNoteViewModal');
    if(nv) nv.addEventListener('click',function(e){ if(e.target===nv) window.closeMemoNoteView(); });
    var tv = document.getElementById('memoTodoViewModal');
    if(tv) tv.addEventListener('click',function(e){ if(e.target===tv) window.closeMemoTodoView(); });
  },0);

  // Enter dans l'input todo
  setTimeout(function(){
    var tdi = document.getElementById('memoPopupTodoInput');
    if(tdi) tdi.addEventListener('keydown',function(e){ if(e.key==='Enter') window.memoAddTodoItem(); });
  },0);

})();


// ════════════════════════════════════════════════════════════════════
// 12. SOUVENIRS
// ════════════════════════════════════════════════════════════════════
(function(){

  function _getCoupleId(){ var u=(typeof v2GetUser==='function')?v2GetUser():null; return u?u.couple_id:null; }

  var _souvenirAllRows = [];

  window.nousLoadSouvenirs = function(){
    var coupleId=_getCoupleId(); if(!coupleId) return;
    fetch(SB2_URL+'/rest/v1/v2_memories?couple_id=eq.'+coupleId+'&order=created_at.desc&select=*',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      _souvenirAllRows = Array.isArray(rows)?rows:[];
      _renderSouvenirRows(_souvenirAllRows);
      var overlay=document.getElementById('souvenirGestionOverlay');
      if(overlay&&overlay.classList.contains('open')){ _renderGestionList(); }
    }).catch(function(){ });
  };

  function _renderSouvenirRows(rows){
    var recentRow    = document.getElementById('souvenirsRecentRow');
    var favRow       = document.getElementById('souvenirsFavRow');
    var emptyEl      = document.getElementById('souvenirsEmpty');
    var recentScroll = document.getElementById('souvenirsRecentScroll');
    var favScroll    = document.getElementById('souvenirsFavScroll');
    if(!recentRow||!favRow||!recentScroll||!favScroll||!emptyEl) return;
    recentScroll.innerHTML=''; favScroll.innerHTML='';
    if(!rows.length){
      recentRow.style.display='none'; favRow.style.display='none';
      emptyEl.style.display='block'; return;
    }
    emptyEl.style.display='none';
    // Favoris en tête de liste
    var favs   = rows.filter(function(s){ return s.is_fav; });
    var recent = rows.filter(function(s){ return !s.is_fav; }).slice(0,5);
    if(favs.length){
      favRow.style.display='block';
      favs.forEach(function(s){ favScroll.appendChild(_buildSouvenirCard(s)); });
    } else { favRow.style.display='none'; }
    if(recent.length){
      recentRow.style.display='block';
      recent.forEach(function(s){ recentScroll.appendChild(_buildSouvenirCard(s)); });
    } else { recentRow.style.display='none'; }
  }

  function _buildSouvenirCard(s){
    var card=document.createElement('div'); card.className='souvenir-card';
    var photoUrl=s.photo_url||'';
    var dateStr=s.date?new Date(s.date+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):'';
    var photoStyle=photoUrl?'background-image:url('+escHtml(photoUrl)+');':'';
    var pencilSVG='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    card.innerHTML=
      '<div class="souvenir-photo" style="'+photoStyle+'">'
      +(photoUrl?'':'<span style="font-size:28px;opacity:0.3;">&#128247;</span>')
      +(s.lieu?'<div class="souvenir-lieu">&#128205; '+escHtml(s.lieu)+'</div>':'')
      +'</div>'
      +'<div class="souvenir-info">'
      +'<div class="souvenir-info-text">'
      +'<div class="souvenir-name">'+escHtml(s.title||'Souvenir')+'</div>'
      +(dateStr?'<div class="souvenir-date">'+escHtml(dateStr)+'</div>':'')
      +'</div>'
      +'<div class="souvenir-edit-icon">'+pencilSVG+'</div>'
      +'</div>';
    card.querySelector('.souvenir-edit-icon').addEventListener('click',function(e){ e.stopPropagation(); nousOpenSouvenirModal(s); });
    // Badge NEW — posé sur la card racine (position:relative, sans overflow:hidden)
    // .souvenir-photo a overflow:hidden pour rogner la photo → badge invisible si posé dessus
    if(s.id && typeof window.yamIsNew==='function' && window.yamIsNew('souvenir_'+s.id)){
      if(typeof window.yamShowNewBadge==='function') window.yamShowNewBadge(card, true);
    }
    return card;
  }

  // Flag : indique si souvenirModal a été ouvert depuis la liste de gestion
  var _souvenirFromGestion = false;

  // Rouage → ouvre directement la liste complète (plus de sheet intermédiaire)
  window.nousOpenSouvenirGestion = function(){
    if(!_souvenirAllRows.length){ window.nousLoadSouvenirs(); }
    _saveScrollPosition();
    _blockBackgroundScroll();
    _renderGestionList();
    var overlay=document.getElementById('souvenirGestionOverlay');
    if(overlay){
      overlay.classList.add('open');
      // Scroll auto en haut
      setTimeout(function(){
        var list=document.getElementById('souvenirGestionList');
        if(list) list.scrollTop=0;
        // Scroll overlay au top
        overlay.scrollTop=0;
      }, 50);
    }
  };

  window.nousCloseSouvenirGestion = function(){
    var overlay=document.getElementById('souvenirGestionOverlay');
    if(overlay) overlay.classList.remove('open');
    _unblockBackgroundScroll();
    _restoreScrollPosition();
  };

  // Conservé pour compatibilité mais inutilisé désormais
  window.closeSouvenirGestionSheet = function(){
    var sheet=document.getElementById('souvenirGestionSheet');
    if(sheet) sheet.classList.remove('open');
  };

  function _renderGestionList(){
    var list=document.getElementById('souvenirGestionList'); if(!list) return;
    list.innerHTML='';
    list.scrollTop=0;
    if(!_souvenirAllRows.length){
      list.innerHTML='<div style="text-align:center;color:var(--muted);font-size:13px;padding:32px;">Aucun souvenir pour l\'instant</div>';
      return;
    }
    var heartFilled='<svg width="22" height="22" viewBox="0 0 24 24" fill="#e879a0" stroke="#e879a0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    var heartEmpty='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

    // Favoris d'abord, puis le reste
    var sorted = _souvenirAllRows.slice().sort(function(a,b){
      if(a.is_fav&&!b.is_fav) return -1;
      if(!a.is_fav&&b.is_fav) return 1;
      return 0;
    });

    sorted.forEach(function(s){
      var row=document.createElement('div'); row.className='souvenir-gestion-row';
      var photoStyle=s.photo_url?'background-image:url('+escHtml(s.photo_url)+');':'';
      var dateStr=s.date?new Date(s.date+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'';
      var isFav=!!s.is_fav;
      row.innerHTML=
        '<div class="souvenir-gestion-photo" style="'+photoStyle+'">'
        +(s.photo_url?'':'<span style="font-size:22px;opacity:0.3;">&#128247;</span>')
        +'</div>'
        +'<div class="souvenir-gestion-info">'
          +'<div class="souvenir-gestion-title">'+escHtml(s.title||'Souvenir')+'</div>'
          +'<div class="souvenir-gestion-meta">'+(dateStr?escHtml(dateStr):'')+(s.lieu?' &middot; &#128205;'+escHtml(s.lieu):'')+'</div>'
          +(s.description?'<div class="souvenir-gestion-meta" style="margin-top:2px;color:var(--sub);">'+escHtml(s.description.substring(0,60))+(s.description.length>60?'&hellip;':'')+'</div>':'')
        +'</div>'
        +'<button class="souvenir-fav-btn'+(isFav?' active':'')+'" aria-label="Favori" data-id="'+escHtml(String(s.id))+'">'+
        (isFav?heartFilled:heartEmpty)+
        '</button>';
      row.querySelector('.souvenir-fav-btn').addEventListener('click',function(){
        var id=this.dataset.id;
        var souv=_souvenirAllRows.filter(function(x){ return String(x.id)===String(id); })[0];
        if(!souv) return;
        var newFav=!souv.is_fav; souv.is_fav=newFav;
        var btn=this;
        fetch(SB2_URL+'/rest/v1/v2_memories?id=eq.'+id,{
          method:'PATCH',
          headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),
          body:JSON.stringify({is_fav:newFav})
        }).catch(function(){ souv.is_fav=!newFav; _renderGestionList(); });
        btn.classList.toggle('active',newFav);
        btn.innerHTML=newFav?heartFilled:heartEmpty;
        _renderSouvenirRows(_souvenirAllRows);
      });
      row.querySelector('.souvenir-gestion-photo').addEventListener('click',function(){ _souvenirFromGestion=true; nousOpenSouvenirModal(s); });
      row.querySelector('.souvenir-gestion-info').addEventListener('click',function(){ _souvenirFromGestion=true; nousOpenSouvenirModal(s); });
      list.appendChild(row);
    });
  }

  window.nousOpenSouvenirModal = function(souvenir){
    var isNew=!souvenir;
    var modal=document.getElementById('souvenirModal'); if(!modal) return;
    if(!_souvenirFromGestion){
      _saveScrollPosition();
      _blockBackgroundScroll();
    }
    document.getElementById('souvenirModalTitle').textContent=isNew?'Nouveau souvenir':'Modifier le souvenir';
    document.getElementById('souvenirInputTitle').value=isNew?'':(souvenir.title||'');
    var _dateVal=isNew?'':(souvenir.date?souvenir.date.substring(0,10):'');
    document.getElementById('souvenirInputDate').value=_dateVal;
    var _dateLabel=document.getElementById('souvenirDateLabel');
    if(_dateLabel){if(_dateVal){_dateLabel.style.color='var(--text)';_dateLabel.textContent=new Date(_dateVal+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});}else{_dateLabel.style.color='var(--muted)';_dateLabel.textContent='Date du souvenir...';}}
    document.getElementById('souvenirInputLieu').value=isNew?'':(souvenir.lieu||'');
    document.getElementById('souvenirInputDesc').value=isNew?'':(souvenir.description||'');
    var delBtn=document.getElementById('souvenirModalDelBtn'); if(delBtn) delBtn.style.display=isNew?'none':'block';
    var photoPreview=document.getElementById('souvenirPhotoPreview');
    if(photoPreview){
      photoPreview.style.backgroundImage=souvenir&&souvenir.photo_url?'url('+escHtml(souvenir.photo_url)+')':'';
      photoPreview.style.backgroundSize='cover'; photoPreview.style.backgroundPosition='center';
      photoPreview.innerHTML=souvenir&&souvenir.photo_url?'':'<div style="font-size:24px;color:var(--muted);">&#128247;</div><div style="font-size:11px;color:var(--muted);margin-top:4px;">Ajouter une photo</div>';
    }
    modal.dataset.souvenirId=souvenir?souvenir.id:'';
    modal.dataset.photoUrl=souvenir&&souvenir.photo_url?souvenir.photo_url:'';
    modal.classList.add('open');
  };

  window.closeSouvenirModal=function(){
    var modal=document.getElementById('souvenirModal'); if(modal) modal.classList.remove('open');
    if(_souvenirFromGestion){
      _souvenirFromGestion=false;
      _renderGestionList();
      var overlay=document.getElementById('souvenirGestionOverlay');
      if(overlay) overlay.classList.add('open');
    } else {
      _unblockBackgroundScroll();
      _restoreScrollPosition();
    }
  };

  window.souvenirPhotoClick=function(){
    var inp=document.getElementById('souvenirPhotoInput'); if(inp){ inp.value=''; inp.click(); }
  };

  window.souvenirHandlePhoto=function(input){
    if(!input.files||!input.files[0]) return;
    var file=input.files[0]; var coupleId=_getCoupleId(); if(!coupleId) return;
    var modal=document.getElementById('souvenirModal');
    var preview=document.getElementById('souvenirPhotoPreview');
    if(preview){ preview.innerHTML='<div style="font-size:13px;color:var(--muted);">Envoi...</div>'; }
    var path='memories/'+coupleId+'/'+Date.now()+'.jpg';
    fetch(SB2_URL+'/storage/v1/object/images/'+path,{method:'POST',headers:Object.assign({'Content-Type':file.type,'x-upsert':'true'},sb2Headers()),body:file})
    .then(function(r){ return r.text().then(function(){ return r.ok; }); })
    .then(function(ok){
      if(ok){
        var url=SB2_URL+'/storage/v1/object/public/images/'+path;
        if(modal) modal.dataset.photoUrl=url;
        if(preview){ preview.style.backgroundImage='url('+url+')'; preview.style.backgroundSize='cover'; preview.style.backgroundPosition='center'; preview.innerHTML=''; }
      } else { if(preview) preview.innerHTML='<div style="font-size:11px;color:#e05555;">Erreur upload</div>'; }
    }).catch(function(){ if(preview) preview.innerHTML='<div style="font-size:11px;color:#e05555;">Erreur réseau</div>'; });
  };

  window.souvenirSave=function(){
    var modal=document.getElementById('souvenirModal'); if(!modal) return;
    var coupleId=_getCoupleId(); if(!coupleId) return;
    var id=modal.dataset.souvenirId;
    var data={
      couple_id:coupleId,
      title:document.getElementById('souvenirInputTitle').value.trim()||'Souvenir',
      date:document.getElementById('souvenirInputDate').value||null,
      lieu:document.getElementById('souvenirInputLieu').value.trim()||null,
      description:document.getElementById('souvenirInputDesc').value.trim()||null,
      photo_url:modal.dataset.photoUrl||null
    };
    var saveBtn=document.getElementById('souvenirSaveBtn'); if(saveBtn){ saveBtn.textContent='...'; saveBtn.disabled=true; }
    if(id){
      // Modification — ID déjà connu
      fetch(SB2_URL+'/rest/v1/v2_memories?id=eq.'+id,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)})
      .then(function(){
        if(saveBtn){ saveBtn.textContent='Sauvegarder'; saveBtn.disabled=false; }
        if(typeof window.yamMarkNew==='function') window.yamMarkNew('souvenir');
        if(typeof window.yamMarkNewAndRefresh==='function') window.yamMarkNewAndRefresh('souvenir_'+id);
        window.closeSouvenirModal(); window.nousLoadSouvenirs();
      }).catch(function(){
        if(saveBtn){ saveBtn.textContent='Sauvegarder'; saveBtn.disabled=false; }
        window.closeSouvenirModal(); window.nousLoadSouvenirs();
      });
    } else {
      // Création — on récupère l'ID retourné
      fetch(SB2_URL+'/rest/v1/v2_memories',{method:'POST',headers:sb2Headers({'Prefer':'return=representation','Content-Type':'application/json'}),body:JSON.stringify(data)})
      .then(function(r){ return r.json(); })
      .then(function(rows){
        if(saveBtn){ saveBtn.textContent='Sauvegarder'; saveBtn.disabled=false; }
        var newId = Array.isArray(rows) && rows[0] ? rows[0].id : null;
        if(typeof window.yamMarkNew==='function') window.yamMarkNew('souvenir');
        if(newId && typeof window.yamMarkNewAndRefresh==='function') window.yamMarkNewAndRefresh('souvenir_'+newId);
        window.closeSouvenirModal(); window.nousLoadSouvenirs();
      }).catch(function(){
        if(saveBtn){ saveBtn.textContent='Sauvegarder'; saveBtn.disabled=false; }
        window.closeSouvenirModal(); window.nousLoadSouvenirs();
      });
    }
  };

  window.souvenirDelete=function(){
    var modal=document.getElementById('souvenirModal'); if(!modal) return;
    var id=modal.dataset.souvenirId; if(!id) return;
    if(!confirm('Supprimer ce souvenir ?')) return;
    fetch(SB2_URL+'/rest/v1/v2_memories?id=eq.'+id,{method:'DELETE',headers:sb2Headers()})
    .then(function(){ window.closeSouvenirModal(); window.nousLoadSouvenirs(); }).catch(function(){});
  };

  var _souvenirM=document.getElementById('souvenirModal');
  if(_souvenirM) _souvenirM.addEventListener('click',function(e){ if(e.target===_souvenirM) window.closeSouvenirModal(); });

})();


// ════════════════════════════════════════════════════════════════════
// 13. ACTIVITÉS — v2 : 2 cartes max en page · overlay liste · étoile · tri
// ════════════════════════════════════════════════════════════════════
(function(){

  var ACTIVITES_SUGGEREES=[
    {emoji:'🍳',titre:'Cuisiner un plat inconnu',desc:'Choisissez une recette que vous n\'avez jamais faite ensemble',steps:['Choisir la recette','Faire les courses','Cuisiner ensemble','Déguster et noter']},
    {emoji:'🎬',titre:'Soirée film culte',desc:'Un film que l\'un de vous n\'a jamais vu',steps:['Choisir le film','Préparer pop-corn & snacks','Regarder','Partager vos avis']},
    {emoji:'🌳',titre:'Balade nature',desc:'Explorer un endroit que vous ne connaissez pas encore',steps:['Choisir l\'endroit','Y aller','Prendre des photos','Revenir avec un souvenir']},
    {emoji:'🎨',titre:'Soirée créative',desc:'Peinture, dessin, ou tout ce qui vous passe par la tête',steps:['Préparer le matériel','Choisir un thème','Créer ensemble','Exposer vos œuvres']},
    {emoji:'📖',titre:'Lire le même livre',desc:'Et en discuter chapitre par chapitre',steps:['Choisir le livre','Lire jusqu\'à un chapitre convenu','En discuter','Continuer !']},
    {emoji:'🎲',titre:'Soirée jeux de société',desc:'Plusieurs jeux, compétition amicale garantie',steps:['Choisir 3 jeux','Fixer les règles','Jouer','Désigner le champion']},
    {emoji:'⭐',titre:'Observer les étoiles',desc:'Une nuit claire, une couverture, et vous deux',steps:['Vérifier la météo','Choisir un endroit dégagé','Installer la couverture','Profiter du ciel']},
    {emoji:'💌',titre:'Échange de lettres',desc:'Écrire une lettre à l\'autre à la main',steps:['Trouver du papier et un stylo','Écrire la lettre','L\'offrir','Garder les lettres précieusement']}
  ];

  function _getCoupleId(){ var u=(typeof v2GetUser==='function')?v2GetUser():null; return u?u.couple_id:null; }

  // Cache de toutes les activités (comme _souvenirAllRows pour les souvenirs)
  var _activiteAllRows = [];

  // Flag : indique si activiteModal a été ouvert depuis l'overlay liste
  var _activiteFromGestion = false;

  // ── Helpers : calcul progression & état d'une activité ──
  function _actSteps(act){ var s=[]; try{ s=JSON.parse(act.steps||'[]'); }catch(e){} return s; }
  function _actPct(act){ var s=_actSteps(act); return s.length?Math.round(s.filter(function(x){return x.done;}).length/s.length*100):0; }
  function _actDone(act){ return _actPct(act)===100; }
  function _actStarred(act){ return !!act.is_fav; }

  // ── Tri pour la page principale : étoilées non-terminées d'abord, terminées en bas ──
  function _sortForHome(rows){
    return rows.slice().sort(function(a,b){
      var doneA=_actDone(a)?1:0, doneB=_actDone(b)?1:0;
      if(doneA!==doneB) return doneA-doneB; // non-terminées avant terminées
      var starA=_actStarred(a)?0:1, starB=_actStarred(b)?0:1;
      if(starA!==starB) return starA-starB; // étoilées avant non-étoilées
      return 0;
    });
  }

  // ── Tri pour l'overlay liste : étoilées d'abord, terminées en bas ──
  function _sortForGestion(rows){
    return rows.slice().sort(function(a,b){
      var doneA=_actDone(a)?1:0, doneB=_actDone(b)?1:0;
      if(doneA!==doneB) return doneA-doneB;
      var starA=_actStarred(a)?0:1, starB=_actStarred(b)?0:1;
      if(starA!==starB) return starA-starB;
      // Puis plus récentes en tête (created_at desc)
      return (b.created_at||'').localeCompare(a.created_at||'');
    });
  }

  // ════════════════════════════════════════════
  // CHARGEMENT PRINCIPAL
  // ════════════════════════════════════════════
  window.nousLoadActivites=function(){
    var coupleId=_getCoupleId(); if(!coupleId) return;
    var container=document.getElementById('activitesContainer'); if(!container) return;
    container.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px;">Chargement...</div>';
    fetch(SB2_URL+'/rest/v1/v2_activites?couple_id=eq.'+coupleId+'&order=created_at.desc&select=*',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      _activiteAllRows = Array.isArray(rows)?rows:[];
      _renderActivitesHome();
      // Si l'overlay gestion est ouvert, le rafraîchir aussi
      var overlay=document.getElementById('activiteGestionOverlay');
      if(overlay&&overlay.classList.contains('open')){ _renderActiviteGestionList(); }
    }).catch(function(){ container.innerHTML='<div style="color:var(--muted);font-size:13px;padding:16px;">Erreur de chargement</div>'; });
  };

  // ── Rendu page principale : 2 cartes max, idée du jour, bouton créer ──
  function _renderActivitesHome(){
    var container=document.getElementById('activitesContainer'); if(!container) return;
    container.innerHTML='';

    // Idée du jour
    var coupleId=_getCoupleId();
    var dayOfYear=Math.floor((Date.now()-new Date(new Date().getFullYear(),0,0))/(1000*60*60*24));
    var todaySuggested=ACTIVITES_SUGGEREES[dayOfYear%ACTIVITES_SUGGEREES.length];
    var alreadyAdded=_activiteAllRows.some(function(r){ return r.title===todaySuggested.titre; });
    if(!alreadyAdded){
      var suggCard=document.createElement('div'); suggCard.className='activite-sugg-card';
      suggCard.innerHTML='<div class="activite-sugg-badge">Idée du jour</div>'+
        '<div class="activite-header"><span class="activite-emoji">'+todaySuggested.emoji+'</span>'+
        '<div class="activite-info"><div class="activite-titre">'+escHtml(todaySuggested.titre)+'</div>'+
        '<div class="activite-desc">'+escHtml(todaySuggested.desc)+'</div></div></div>'+
        '<button class="activite-add-btn" onclick="nousAddSuggestedActivite()">Ajouter à nos activités</button>';
      suggCard.dataset.sugg=JSON.stringify(todaySuggested);
      container.appendChild(suggCard);
    }

    // 2 cartes max — tri : étoilées non-terminées en tête, terminées en bas
    var sorted=_sortForHome(_activiteAllRows);
    var toShow=sorted.slice(0,2);
    toShow.forEach(function(act){ container.appendChild(_buildActiviteCard(act)); });

    // Bouton créer
    var btnWrap=document.getElementById('activitesBtnWrap');
    if(btnWrap){
      var newBtn=document.createElement('button'); newBtn.className='activite-new-btn';
      newBtn.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Créer une activité';
      newBtn.addEventListener('click',function(){ window.nousOpenActiviteModal(null); });
      btnWrap.innerHTML=''; btnWrap.appendChild(newBtn);
    }
  }

  // ── Build une carte activité pour la page principale ──
  function _buildActiviteCard(act){
    var steps=_actSteps(act);
    var total=steps.length; var doneCount=steps.filter(function(s){return s.done;}).length;
    var pct=total>0?Math.round(doneCount/total*100):0;
    var isCompleted=(pct===100&&total>0);
    var isStarred=_actStarred(act);
    var card=document.createElement('div'); card.className='activite-card';
    var stepsHtml='';
    steps.forEach(function(s,i){
      stepsHtml+='<div class="activite-step'+(s.done?' done':'')+'" data-idx="'+i+'">'+
        '<div class="activite-step-check">'+(s.done?'✓':'')+'</div>'+
        '<div class="activite-step-text">'+escHtml(s.text)+'</div>'+
        '</div>';
    });
    card.innerHTML=
      '<div class="activite-card-header">'+
        '<span class="activite-emoji">'+(act.emoji||'✨')+'</span>'+
        '<div class="activite-info">'+
          '<div class="activite-titre">'+escHtml(act.title||'Activité')+(isStarred?' <span style="font-size:11px;vertical-align:middle;opacity:0.85;">⭐</span>':'')+'</div>'+
          (act.description?'<div class="activite-desc">'+escHtml(act.description)+'</div>':'')+
        '</div>'+
        '<button class="activite-edit-btn">'+_gearSVG()+'</button>'+
      '</div>'+
      (total?'<div class="activite-progress-wrap"><div class="activite-progress-bar"><div class="activite-progress-fill" style="width:'+pct+'%"></div></div><div class="activite-progress-txt">'+doneCount+'/'+total+'</div></div>':'')+
      (stepsHtml?'<div class="activite-steps">'+stepsHtml+'</div>':'')+
      (isCompleted?'<div class="activite-completed">Activité complétée !</div>':'');
    card.querySelector('.activite-edit-btn').addEventListener('click',function(){ window.nousOpenActiviteModal(act); });
    card.querySelectorAll('.activite-step').forEach(function(el){
      el.querySelector('.activite-step-check').addEventListener('click',function(){
        window.nousToggleStep(act.id,parseInt(el.dataset.idx));
      });
    });
    return card;
  }

  // ════════════════════════════════════════════
  // OVERLAY GESTION — liste complète
  // ════════════════════════════════════════════
  window.nousOpenActiviteGestion=function(){
    if(!_activiteAllRows.length){ window.nousLoadActivites(); }
    _activiteFromGestion=false;
    _saveScrollPosition();
    _blockBackgroundScroll();
    _renderActiviteGestionList();
    var overlay=document.getElementById('activiteGestionOverlay');
    if(overlay){
      overlay.classList.add('open');
      setTimeout(function(){
        var list=document.getElementById('activiteGestionList');
        if(list) list.scrollTop=0;
        overlay.scrollTop=0;
      },50);
    }
  };

  window.nousCloseActiviteGestion=function(){
    _activiteFromGestion=false;
    var overlay=document.getElementById('activiteGestionOverlay');
    if(overlay) overlay.classList.remove('open');
    _unblockBackgroundScroll();
    _restoreScrollPosition();
  };

  // ── Rendu liste complète dans l'overlay ──
  function _renderActiviteGestionList(){
    var list=document.getElementById('activiteGestionList'); if(!list) return;
    list.innerHTML=''; list.scrollTop=0;

    // Bouton créer en tête
    var newBtn=document.createElement('button'); newBtn.className='activite-new-btn';
    newBtn.style.cssText='margin:12px 0 8px;';
    newBtn.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Créer une activité';
    newBtn.addEventListener('click',function(){ _activiteFromGestion=true; window.nousOpenActiviteModal(null); });
    list.appendChild(newBtn);

    if(!_activiteAllRows.length){
      list.innerHTML+='<div style="text-align:center;color:var(--muted);font-size:13px;padding:32px;">Aucune activité pour l\'instant</div>';
      return;
    }

    var starFilled='<svg width="22" height="22" viewBox="0 0 24 24" fill="#f0c040" stroke="#f0c040" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    var starEmpty='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

    var sorted=_sortForGestion(_activiteAllRows);
    sorted.forEach(function(act){
      var steps=_actSteps(act);
      var total=steps.length;
      var doneCount=steps.filter(function(s){return s.done;}).length;
      var pct=total?Math.round(doneCount/total*100):0;
      var isStarred=_actStarred(act);
      var isCompleted=(pct===100&&total>0);

      var row=document.createElement('div'); row.className='activite-gestion-row';
      row.innerHTML=
        '<div class="activite-gestion-emoji">'+(act.emoji||'✨')+'</div>'+
        '<div class="activite-gestion-info">'+
          '<div class="activite-gestion-title">'+escHtml(act.title||'Activité')+(isCompleted?' <span style="font-size:10px;color:var(--green);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">✓ Terminée</span>':'')+'</div>'+
          (act.description?'<div class="activite-gestion-meta">'+escHtml(act.description.substring(0,55))+(act.description.length>55?'…':'')+'</div>':'')+
          (total?'<div class="activite-gestion-progress"><div class="activite-gestion-bar"><div class="activite-gestion-fill" style="width:'+pct+'%"></div></div><span style="font-size:10px;color:var(--muted);flex-shrink:0;">'+doneCount+'/'+total+'</span></div>':'')+
        '</div>'+
        '<button class="activite-star-btn'+(isStarred?' active':'')+'" aria-label="Favori" data-id="'+escHtml(String(act.id))+'">'+
          (isStarred?starFilled:starEmpty)+
        '</button>';

      // Clic sur la ligne → ouvrir la modale (toute la row sauf l'étoile)
      row.style.cursor='pointer';
      (function(a){
        row.addEventListener('click',function(e){
          if(e.target.closest('.activite-star-btn')) return;
          _activiteFromGestion=true;
          window.nousOpenActiviteModal(a);
        });
      })(act);

      // Clic sur l'étoile → toggle is_fav
      row.querySelector('.activite-star-btn').addEventListener('click',function(e){
        e.stopPropagation();
        var id=this.dataset.id;
        var a=_activiteAllRows.filter(function(x){ return String(x.id)===String(id); })[0];
        if(!a) return;
        var newFav=!a.is_fav; a.is_fav=newFav;
        var btn=this;
        fetch(SB2_URL+'/rest/v1/v2_activites?id=eq.'+id,{
          method:'PATCH',
          headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),
          body:JSON.stringify({is_fav:newFav})
        }).catch(function(){ a.is_fav=!newFav; _renderActiviteGestionList(); });
        btn.classList.toggle('active',newFav);
        btn.innerHTML=newFav?starFilled:starEmpty;
        _renderActivitesHome(); // rafraîchit le tri en page principale
      });

      list.appendChild(row);
    });
  }

  // ════════════════════════════════════════════
  // TOGGLE ÉTAPE
  // ════════════════════════════════════════════
  window.nousToggleStep=function(actId,stepIdx){
    var coupleId=_getCoupleId(); if(!coupleId) return;
    fetch(SB2_URL+'/rest/v1/v2_activites?id=eq.'+actId+'&couple_id=eq.'+coupleId+'&select=steps',{headers:sb2Headers()})
    .then(function(r){ return r.json(); })
    .then(function(rows){
      if(!rows||!rows[0]) return;
      var steps=[]; try{ steps=JSON.parse(rows[0].steps||'[]'); }catch(e){}
      if(steps[stepIdx]) steps[stepIdx].done=!steps[stepIdx].done;
      // Mettre à jour le cache local immédiatement
      var cached=_activiteAllRows.filter(function(x){return String(x.id)===String(actId);})[0];
      if(cached) cached.steps=JSON.stringify(steps);
      return fetch(SB2_URL+'/rest/v1/v2_activites?id=eq.'+actId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({steps:JSON.stringify(steps)})});
    }).then(function(){ window.nousLoadActivites(); }).catch(function(){});
  };

  // ════════════════════════════════════════════
  // MODALE CRÉATION / MODIFICATION
  // ════════════════════════════════════════════
  window.nousOpenActiviteModal=function(act){
    var modal=document.getElementById('activiteModal'); if(!modal) return;
    // Si on vient de la liste de gestion, ne pas re-locker (déjà fait)
    if(!_activiteFromGestion){
      _saveScrollPosition();
      _blockBackgroundScroll();
    }
    var isNew=!act||!act.id;
    document.getElementById('activiteModalTitle').textContent=isNew?'Nouvelle activité':'Modifier l\'activité';
    document.getElementById('activiteInputTitre').value=isNew?'':(act.title||'');
    document.getElementById('activiteInputDesc').value=isNew?'':(act.description||'');
    document.getElementById('activiteInputEmoji').value=isNew?'✨':(act.emoji||'✨');
    var stepsRaw=[]; try{ stepsRaw=JSON.parse(act&&act.steps||'[]'); }catch(e){}
    var stepsContainer=document.getElementById('activiteModalSteps');
    stepsContainer.innerHTML=''; stepsRaw.forEach(function(s){ _addStepRow(s.text); });
    if(!stepsRaw.length){ _addStepRow(''); }
    modal.dataset.actId=act&&act.id?act.id:'';
    modal.classList.add('open');
  };

  function _addStepRow(val){
    var container=document.getElementById('activiteModalSteps'); if(!container) return;
    var row=document.createElement('div'); row.className='activite-modal-step-row';
    row.innerHTML='<input type="text" class="activite-step-input" placeholder="Étape..." value="'+escHtml(val||'')+'" maxlength="80"><button class="activite-step-del" onclick="this.parentNode.remove()">✕</button>';
    container.appendChild(row);
  }
  window.nousAddStep=function(){ _addStepRow(''); };

  // Fermeture : retour à la liste si ouvert depuis la gestion, sinon retour normal
  window.closeActiviteModal=function(){
    var modal=document.getElementById('activiteModal'); if(modal) modal.classList.remove('open');
    if(_activiteFromGestion){
      _activiteFromGestion=false;
      _renderActiviteGestionList();
      var overlay=document.getElementById('activiteGestionOverlay');
      if(overlay && !overlay.classList.contains('open')){
        overlay.classList.add('open');
      }
      // scroll lock déjà actif via l'overlay gestion — ne pas unblock
    } else {
      _unblockBackgroundScroll();
      _restoreScrollPosition();
    }
  };

  window.activiteSave=function(){
    var modal=document.getElementById('activiteModal'); if(!modal) return;
    var coupleId=_getCoupleId(); if(!coupleId) return;
    var id=modal.dataset.actId;
    var stepInputs=document.querySelectorAll('#activiteModalSteps .activite-step-input');
    var steps=Array.from(stepInputs).map(function(inp){ return {text:inp.value.trim(),done:false}; }).filter(function(s){ return s.text; });
    var data={ couple_id:coupleId, title:document.getElementById('activiteInputTitre').value.trim()||'Activité', description:document.getElementById('activiteInputDesc').value.trim()||null, emoji:document.getElementById('activiteInputEmoji').value.trim()||'✨', steps:JSON.stringify(steps) };
    var btn=document.getElementById('activiteSaveBtn'); if(btn){ btn.textContent='...'; btn.disabled=true; }
    var done2=function(){ if(btn){ btn.textContent='Sauvegarder'; btn.disabled=false; } window.closeActiviteModal(); window.nousLoadActivites(); };
    if(id){ fetch(SB2_URL+'/rest/v1/v2_activites?id=eq.'+id,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)}).then(done2).catch(done2); }
    else { fetch(SB2_URL+'/rest/v1/v2_activites',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)}).then(done2).catch(done2); }
  };

  window.activiteDelete=function(){
    var modal=document.getElementById('activiteModal'); if(!modal) return;
    var id=modal.dataset.actId; if(!id) return;
    if(!confirm('Supprimer cette activité ?')) return;
    var coupleId=_getCoupleId(); if(!coupleId) return;
    fetch(SB2_URL+'/rest/v1/v2_activites?id=eq.'+id+'&couple_id=eq.'+coupleId,{method:'DELETE',headers:sb2Headers()})
    .then(function(){ window.closeActiviteModal(); window.nousLoadActivites(); }).catch(function(){});
  };

  window.nousAddSuggestedActivite=function(){
    var card=document.querySelector('.activite-sugg-card'); if(!card) return;
    var sugg=JSON.parse(card.dataset.sugg||'{}');
    var coupleId=_getCoupleId(); if(!coupleId) return;
    var data={ couple_id:coupleId, title:sugg.titre, description:sugg.desc, emoji:sugg.emoji, steps:JSON.stringify(sugg.steps.map(function(s){ return {text:s,done:false}; })), is_suggested:true };
    fetch(SB2_URL+'/rest/v1/v2_activites',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)})
    .then(function(){ window.nousLoadActivites(); if(typeof window.nousSignalNew==='function') window.nousSignalNew(); })
    .catch(function(){});
  };

  var _activiteM=document.getElementById('activiteModal');
  if(_activiteM) _activiteM.addEventListener('click',function(e){ if(e.target===_activiteM) window.closeActiviteModal(); });

  // ── Suggestion IA pour activités ──
  var _iaSuggCache = null; // { title, desc, emoji, steps[] }

  var _iaSuggLastCall = 0;
  var _IA_SUGG_COOLDOWN = 30 * 1000; // 30 secondes entre chaque appel
  var _IA_SUGG_MAX_PER_DAY = 3;      // max 3 suggestions par jour

  function _iaSuggGetCount(){
    var today = new Date().toISOString().slice(0,10);
    try {
      var data = JSON.parse(localStorage.getItem('yam_iasugg_count') || 'null');
      if(data && data.date === today) return data.count;
    } catch(e){}
    return 0;
  }

  function _iaSuggIncrCount(){
    var today = new Date().toISOString().slice(0,10);
    var count = _iaSuggGetCount() + 1;
    try { localStorage.setItem('yam_iasugg_count', JSON.stringify({date: today, count: count})); } catch(e){}
  }

  window.activiteIaSuggest = function(){
    var btn = document.getElementById('activiteIaBtn');
    var card = document.getElementById('activiteIaSuggCard');
    var textEl = document.getElementById('activiteIaSuggText');
    var metaEl = document.getElementById('activiteIaSuggMeta');
    if(!btn || !textEl) return;

    // Limite journalière : 3 suggestions par jour
    if(_iaSuggGetCount() >= _IA_SUGG_MAX_PER_DAY){
      if(card) card.style.display = 'flex';
      textEl.innerHTML = '🤖 Le petit robot est épuisé... Revenez demain pour de nouvelles idées ! 😴';
      if(metaEl) metaEl.textContent = 'Limite journalière atteinte';
      btn.disabled = true;
      btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Reviens demain 😴';
      return;
    }

    // Cooldown anti-spam : 30s minimum entre chaque appel Gemini
    var now = Date.now();
    var remaining = Math.ceil((_iaSuggLastCall + _IA_SUGG_COOLDOWN - now) / 1000);
    if(remaining > 0){
      if(typeof showToast === 'function') showToast('Patiente encore ' + remaining + 's avant une nouvelle idée 😊', 'info');
      return;
    }
    _iaSuggLastCall = now;

    btn.disabled = true;
    btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="spin-anim"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Génération...';

    var coupleId = _getCoupleId();
    var u = (typeof v2GetUser==='function') ? v2GetUser() : null;
    var partnerName = u ? (u.partner_pseudo || 'ton partenaire') : 'ton partenaire';
    var daysTogether = 0;
    if(window.startDate){ daysTogether = Math.floor((Date.now()-new Date(window.startDate))/(1000*60*60*24)); }

    var saison = ['hiver','hiver','printemps','printemps','printemps','été','été','été','automne','automne','automne','hiver'][new Date().getMonth()];
    var doneActivites = _activiteAllRows.filter(function(a){ return _actDone(a); }).map(function(a){ return a.title; }).slice(0,5);

    var prompt = 'Tu es un assistant bienveillant pour un couple. Propose UNE seule activité originale et concrète à faire ensemble, adaptée à la saison ('+saison+') et au fait qu\'ils sont ensemble depuis '+daysTogether+' jours.'+
      (doneActivites.length ? ' Ils ont déjà fait : '+doneActivites.join(', ')+'. Évite ces activités.' : '')+
      ' Réponds UNIQUEMENT en JSON strict, sans aucun texte autour, avec ce format exact : {"emoji":"🎯","title":"Titre court","description":"Une phrase courte et motivante","steps":["Étape 1","Étape 2","Étape 3"]}';

    var SB2_EDGE_GEMINI = SB2_URL + '/functions/v1/gemini-suggest';
    fetch(SB2_EDGE_GEMINI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-secret': SB2_APP_SECRET, 'apikey': SB2_KEY, 'Authorization': 'Bearer ' + SB2_KEY },
      body: JSON.stringify({ prompt: prompt })
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if(data.error) throw new Error(data.error);
      var raw = data.text || '';
      // Nettoyer les éventuels backticks markdown
      raw = raw.replace(/```json|```/g,'').trim();
      var parsed = JSON.parse(raw);
      _iaSuggCache = parsed;
      if(card) card.style.display = 'flex';
      textEl.innerHTML = '<strong>'+(parsed.emoji||'✨')+' '+escHtml(parsed.title||'')+'</strong><br><span style="font-weight:400;">'+escHtml(parsed.description||'')+'</span>';
      if(parsed.steps && parsed.steps.length){
        textEl.innerHTML += '<ul style="margin:8px 0 0 0;padding-left:16px;font-size:12px;color:var(--muted);line-height:1.6;">';
        parsed.steps.forEach(function(s){ textEl.innerHTML += '<li>'+escHtml(s)+'</li>'; });
        textEl.innerHTML += '</ul>';
      }
      if(metaEl) metaEl.textContent = 'Suggestion IA · '+saison.charAt(0).toUpperCase()+saison.slice(1);
      _iaSuggIncrCount(); // comptabiliser l'appel réussi
    })
    .catch(function(err){
      if(card) card.style.display = 'flex';
      textEl.textContent = 'Une idée : planifiez une soirée jeux de société thématique avec vos jeux préférés ! 🎲';
      if(metaEl) metaEl.textContent = 'Suggestion hors-ligne';
      _iaSuggCache = {emoji:'🎲',title:'Soirée jeux thématique',description:'Planifiez une soirée jeux ensemble',steps:['Choisir les jeux','Préparer les snacks','Jouer !']};
    })
    .finally(function(){
      btn.disabled = false;
      btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Nouvelle idée pour nous';
    });
  };

  window.activiteIaAdd = function(){
    if(!_iaSuggCache) return;
    var coupleId = _getCoupleId(); if(!coupleId) return;
    var s = _iaSuggCache;
    var data = { couple_id: coupleId, title: s.title||'Activité', description: s.description||null, emoji: s.emoji||'✨', steps: JSON.stringify((s.steps||[]).map(function(t){ return {text:t,done:false}; })) };
    fetch(SB2_URL+'/rest/v1/v2_activites',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)})
    .then(function(){
      _iaSuggCache = null;
      var card = document.getElementById('activiteIaSuggCard');
      if(card) card.style.display = 'none';
      window.nousLoadActivites();
    }).catch(function(){});
  };

})();


// ════════════════════════════════════════════════════════════════════
// 14. MOTS DOUX IA — 15 générés en batch chaque jour, rotation aléatoire
// Logique :
//   • Au premier accès du jour → génère 15 mots doux en une fois (appels séquentiels)
//   • Les 15 mots sont stockés en localStorage + base
//   • Toute la journée, le bouton "refresh" fait tourner aléatoirement dans ce pool
//   • Le lendemain → nouveau batch de 15 (l'ancien est remplacé)
// Table : v2_mots_doux (id, couple_id, text, generated_at)
// ════════════════════════════════════════════════════════════════════
(function(){

  function _getCoupleId(){ var u=(typeof v2GetUser==='function')?v2GetUser():null; return u?u.couple_id:null; }
  var SB2_EDGE = SB2_URL + '/functions/v1/gemini-suggest';
  var _MD_BATCH_SIZE = 10;  // nombre de mots doux générés par jour

  // ── Clés localStorage ──
  function _cacheKey(coupleId){ return 'yam_motdoux_batch_' + coupleId; }

  // Charger le batch du jour depuis localStorage
  // Retourne { date, mots: [...], deckPos } ou null si absent/périmé
  function _loadCache(coupleId){
    try {
      var data = JSON.parse(localStorage.getItem(_cacheKey(coupleId)) || 'null');
      var today = new Date().toISOString().slice(0,10);
      if(data && data.date === today && Array.isArray(data.mots) && data.mots.length > 0) return data;
    } catch(e){}
    return null;
  }

  // Sauvegarder le batch en localStorage
  function _saveCache(coupleId, mots, deckPos){
    try {
      localStorage.setItem(_cacheKey(coupleId), JSON.stringify({
        date: new Date().toISOString().slice(0,10),
        mots: mots,
        deckPos: deckPos || 0
      }));
    } catch(e){}
  }

  // Mélange Fisher-Yates
  function _shuffle(arr){
    var a = arr.slice();
    for(var i = a.length-1; i > 0; i--){
      var j = Math.floor(Math.random()*(i+1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ── Affichage ──
  function _setLoading(on){
    var sp  = document.getElementById('motsDoux_spinner');
    var btn = document.getElementById('motsDoux_refreshBtn');
    if(sp)  sp.style.display    = on ? 'block' : 'none';
    if(btn){ btn.disabled       = on; btn.style.opacity = on ? '0.4' : ''; }
  }

  function _displayMot(text, meta){
    var el     = document.getElementById('motsDoux_text');
    var metaEl = document.getElementById('motsDoux_meta');
    if(!el) return;
    el.style.transition = 'opacity 0.2s';
    el.style.opacity = '0';
    setTimeout(function(){
      el.textContent = text;
      if(metaEl) metaEl.textContent = meta || '';
      el.style.opacity = '1';
    }, 200);
  }

  // Affiche un mot du deck en cours et avance la position
  function _showNextFromDeck(coupleId){
    var cache = _loadCache(coupleId);
    if(!cache || !cache.mots.length) return false;
    var pos  = (cache.deckPos || 0) % cache.mots.length;
    var text = cache.mots[pos];
    // Avancer la position pour le prochain appel
    _saveCache(coupleId, cache.mots, pos + 1);
    var dateLabel = new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
    _displayMot(text, 'Mots du jour · ' + dateLabel + ' · ' + (pos+1) + '/' + cache.mots.length);
    return true;
  }

  // ── Génération batch séquentielle ──
  // Génère _MD_BATCH_SIZE mots un par un (appels séquentiels pour éviter le rate-limit)
  function _generateBatch(coupleId, onDone){
    var u = (typeof v2GetUser==='function') ? v2GetUser() : null;
    var partnerName  = u ? (u.partner_pseudo || 'mon amour') : 'mon amour';
    var daysTogether = 0;
    if(window.startDate){ daysTogether = Math.floor((Date.now()-new Date(window.startDate))/(1000*60*60*24)); }
    var saison  = ['hiver','hiver','printemps','printemps','printemps','été','été','été','automne','automne','automne','hiver'][new Date().getMonth()];
    var moments = ['matin','après-midi','soir'];
    var collected = [];

    _setLoading(true);
    // Afficher un message de génération pendant le chargement
    var el = document.getElementById('motsDoux_text');
    if(el){ el.style.opacity='0'; setTimeout(function(){ el.textContent='Génération de tes mots doux du jour... ✨'; el.style.opacity='1'; },200); }

    function _fetchOne(index){
      if(index >= _MD_BATCH_SIZE){
        // Tous les mots sont collectés
        var shuffled = _shuffle(collected);
        _saveCache(coupleId, shuffled, 0);
        // Sauvegarder aussi en base (batch insert)
        var now = new Date().toISOString();
        var rows = shuffled.map(function(t){ return { couple_id: coupleId, text: t, generated_at: now }; });
        fetch(SB2_URL+'/rest/v1/v2_mots_doux', {
          method: 'POST',
          headers: sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),
          body: JSON.stringify(rows)
        }).catch(function(){});
        _setLoading(false);
        if(onDone) onDone(shuffled);
        return;
      }
      // Varier le moment de la journée pour diversifier les messages
      var moment = moments[index % moments.length];
      var exemples = [
        'J\'adore quand tu souris sans raison, ça illumine n\'importe quelle pièce.',
        'Ce soir j\'aurais juste envie de te tenir la main et de ne rien dire.',
        'Il y a des jours où je réalise à quel point j\'ai de la chance que tu existes.',
        'Tu es le genre de personne qui rend les matins difficiles supportables.',
        'Même les silences avec toi ont quelque chose de doux.'
      ];
      var prompt = 'Tu es dans un couple amoureux. Écris UN seul petit mot doux pour ton partenaire. ' +
        'Règles STRICTES : ' +
        '1) 1 à 2 phrases maximum, jamais plus. ' +
        '2) NE commence JAMAIS par un prénom ou un surnom. ' +
        '3) Le message doit être concret et touchant, pas une généralité vide. ' +
        '4) Pas un seul mot suivi d\'un point. ' +
        '5) Aucun guillemet. Aucune explication. Seulement le message. ' +
        'On est en ' + saison + ', ' + moment + '. Ensemble depuis ' + daysTogether + ' jours. ' +
        'Voici un exemple du ton attendu (ne le copie pas, invente quelque chose de différent) : ' +
        exemples[index % exemples.length];

      fetch(SB2_EDGE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-secret': SB2_APP_SECRET, 'apikey': SB2_KEY, 'Authorization': 'Bearer ' + SB2_KEY },
        body: JSON.stringify({ prompt: prompt })
      })
      .then(function(r){ return r.json(); })
      .then(function(data){
        var text = (data.text || '').trim().replace(/^"+|"+$/g,'').trim();
        if(text) collected.push(text);
        // Petit délai entre chaque appel pour éviter le rate-limit
        setTimeout(function(){ _fetchOne(index + 1); }, 300);
      })
      .catch(function(){
        // En cas d'erreur sur un mot, on continue quand même
        setTimeout(function(){ _fetchOne(index + 1); }, 300);
      });
    }

    _fetchOne(0);
  }

  var _motsDoux_loading    = false;
  var _motsDoux_init_done  = false;
  var _motsDoux_generating = false; // verrou génération batch

  // ── Point d'entrée principal ──
  // forced=false → init auto (affiche depuis cache ou génère si nouveau jour)
  // forced=true  → bouton refresh : pioche le mot suivant dans le deck du jour
  window.motsDoux_refresh = function(forced){
    var coupleId = _getCoupleId();
    if(!coupleId){ _displayMot('Connecte-toi pour recevoir des mots doux ✨',''); return; }

    // Bouton refresh → pioche dans le deck du jour (rotation aléatoire)
    if(forced){
      if(_motsDoux_generating){ if(typeof showToast==='function') showToast('Génération en cours... ✨','info',2000); return; }
      var shown = _showNextFromDeck(coupleId);
      if(!shown){
        // Pas de cache valide → lancer la génération
        if(!_motsDoux_generating){ _motsDoux_generating=true; _generateBatch(coupleId, function(mots){ _motsDoux_generating=false; _showNextFromDeck(coupleId); }); }
      }
      return;
    }

    // Init auto
    if(_motsDoux_loading && !forced) return;
    _motsDoux_loading = true;

    // Cache du jour dispo ?
    var cache = _loadCache(coupleId);
    if(cache && cache.mots.length){
      _motsDoux_loading = false;
      _showNextFromDeck(coupleId);
      return;
    }

    // Pas de cache → vérifier en base si un batch existe déjà aujourd'hui
    var today = new Date().toISOString().slice(0,10);
    fetch(SB2_URL+'/rest/v1/v2_mots_doux?couple_id=eq.'+coupleId+'&order=generated_at.desc&limit='+_MD_BATCH_SIZE+'&select=text,generated_at',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      // Filtrer uniquement les mots générés aujourd'hui
      var todayMots = (rows||[]).filter(function(r){
        return r.generated_at && r.generated_at.slice(0,10) === today;
      }).map(function(r){ return r.text; });

      if(todayMots.length >= _MD_BATCH_SIZE){
        // Batch du jour déjà en base → le charger en cache et afficher
        var shuffled = _shuffle(todayMots);
        _saveCache(coupleId, shuffled, 0);
        _motsDoux_loading = false;
        _showNextFromDeck(coupleId);
      } else {
        // Nouveau jour → générer le batch complet
        _motsDoux_loading = false;
        if(!_motsDoux_generating){
          _motsDoux_generating = true;
          _generateBatch(coupleId, function(mots){
            _motsDoux_generating = false;
            _showNextFromDeck(coupleId);
          });
        }
      }
    })
    .catch(function(){
      // Erreur réseau → fallbacks offline
      _motsDoux_loading = false;
      var fallbacks = [
        'Pense à toi et ça me suffit pour sourire, même à distance. ❤️',
        'Je suis tellement reconnaissant(e) de t\'avoir dans ma vie. Tu es mon endroit préféré.',
        'Ce soir, sache que tu occupes mes pensées, et c\'est la meilleure place qui soit. 💕',
        'Avec toi, même les moments simples deviennent des souvenirs que je chéris.',
        'Tu es la meilleure chose qui me soit arrivée. 🌸'
      ];
      var shuffledFallbacks = _shuffle(fallbacks);
      _saveCache(coupleId, shuffledFallbacks, 0);
      _showNextFromDeck(coupleId);
    });
  };

  // Init au chargement de la section Nous — déclenchement unique
  document.addEventListener('nousContentReady', function(){
    if(_motsDoux_init_done) return;
    _motsDoux_init_done = true;
    window.motsDoux_refresh(false);
  });
  // Fallback unique : si event raté
  setTimeout(function(){
    if(_motsDoux_init_done) return;
    var el = document.getElementById('motsDoux_text');
    if(el && el.textContent === 'Chargement...'){
      _motsDoux_init_done = true;
      window.motsDoux_refresh(false);
    }
  }, 2500);

})();


// ════════════════════════════════════════════════════════════════════
// 15. NOTRE HISTOIRE — éditable, stockée dans v2_histoire
// Table : v2_histoire (id, couple_id, emoji, date_label, title, text, sort_order, created_at)
// ════════════════════════════════════════════════════════════════════
(function(){

  function _getCoupleId(){ var u=(typeof v2GetUser==='function')?v2GetUser():null; return u?u.couple_id:null; }
  var _histoireAllRows = [];
  var _histoireFromGestion = false;
  var _histoireEditingId = null;

  // ── Rendu timeline principale ──
  window.histoireRenderTimeline = function(items){
    var container = document.getElementById('tlItemsContainer');
    if(!container) return;
    container.innerHTML = '';
    if(!items || !items.length){
      container.innerHTML = '<div class="tl-item visible"><div class="tl-dot"></div><div class="tl-date">En construction</div><div class="tl-card"><h3>Notre histoire commence... 🌟</h3><p>Clique sur le crayon pour ajouter vos premiers chapitres.</p></div></div>';
      return;
    }
    // Tri par sort_order puis created_at
    var sorted = items.slice().sort(function(a,b){
      if((a.sort_order||0)!=(b.sort_order||0)) return (a.sort_order||0)-(b.sort_order||0);
      return (a.created_at||'').localeCompare(b.created_at||'');
    });
    sorted.forEach(function(item){
      var el = document.createElement('div');
      el.className = 'tl-item';
      el.innerHTML =
        '<div class="tl-dot"></div>'+
        '<div class="tl-date">'+(item.emoji?escHtml(item.emoji)+' ':'')+escHtml(item.date_label||'')+'</div>'+
        '<div class="tl-card"><h3>'+escHtml(item.title||'')+'</h3><p>'+escHtml(item.text||'')+'</p></div>';
      container.appendChild(el);
    });
    if(typeof window._tlObserve === 'function') window._tlObserve();
  };

  // ── Chargement depuis Supabase ──
  window.histoireLoad = function(){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    fetch(SB2_URL+'/rest/v1/v2_histoire?couple_id=eq.'+coupleId+'&order=sort_order.asc,created_at.asc&select=*',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      _histoireAllRows = Array.isArray(rows)?rows:[];
      window.histoireRenderTimeline(_histoireAllRows);
      var overlay = document.getElementById('histoireGestionOverlay');
      if(overlay && overlay.classList.contains('open')) _histoireRenderGestionList();
    }).catch(function(){});
  };

  // ── Overlay gestion ──
  window.histoireOpenGestion = function(){
    if(!_histoireAllRows.length) window.histoireLoad();
    _saveScrollPosition();
    _blockBackgroundScroll();
    _histoireRenderGestionList();
    var overlay = document.getElementById('histoireGestionOverlay');
    if(overlay){ overlay.classList.add('open'); setTimeout(function(){ var list=document.getElementById('histoireGestionList'); if(list)list.scrollTop=0; },50); }
  };

  window.histoireCloseGestion = function(){
    var overlay = document.getElementById('histoireGestionOverlay');
    if(overlay) overlay.classList.remove('open');
    _unblockBackgroundScroll();
    _restoreScrollPosition();
  };

  function _histoireRenderGestionList(){
    var list = document.getElementById('histoireGestionList'); if(!list) return;
    list.innerHTML = ''; list.scrollTop = 0;

    if(!_histoireAllRows.length){
      list.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:32px 16px;">Aucun chapitre pour l\'instant.<br>Ajoutez votre premier souvenir !</div>';
      return;
    }

    var sorted = _histoireAllRows.slice().sort(function(a,b){
      if((a.sort_order||0)!=(b.sort_order||0)) return (a.sort_order||0)-(b.sort_order||0);
      return (a.created_at||'').localeCompare(b.created_at||'');
    });

    sorted.forEach(function(item){
      var row = document.createElement('div');
      row.className = 'histoire-gestion-row';
      row.innerHTML =
        '<div class="histoire-gestion-emoji">'+(item.emoji||'📅')+'</div>'+
        '<div class="histoire-gestion-info">'+
          '<div class="histoire-gestion-date">'+escHtml(item.date_label||'')+'</div>'+
          '<div class="histoire-gestion-title">'+escHtml(item.title||'')+'</div>'+
          (item.text?'<div class="histoire-gestion-text">'+escHtml(item.text)+'</div>':'')+
        '</div>';
      (function(it){
        row.addEventListener('click', function(){
          _histoireFromGestion = true;
          histoireOpenItemModal(it);
        });
      })(item);
      list.appendChild(row);
    });
  }

  // ── Modal item ──
  window.histoireOpenItemModal = function(item){
    var modal = document.getElementById('histoireItemModal'); if(!modal) return;
    if(!_histoireFromGestion){ _saveScrollPosition(); _blockBackgroundScroll(); }
    var isNew = !item || !item.id;
    _histoireEditingId = isNew ? null : item.id;
    document.getElementById('histoireItemModalTitle').textContent = isNew ? 'Nouveau chapitre' : 'Modifier ce chapitre';
    document.getElementById('histoireItemEmoji').value = isNew ? '💘' : (item.emoji||'💘');
    document.getElementById('histoireItemDate').value = isNew ? '' : (item.date_label||'');
    document.getElementById('histoireItemTitle').value = isNew ? '' : (item.title||'');
    document.getElementById('histoireItemText').value = isNew ? '' : (item.text||'');
    var delBtn = document.getElementById('histoireItemDeleteBtn');
    if(delBtn) delBtn.style.display = isNew ? 'none' : 'block';
    modal.classList.add('open');
  };

  window.histoireCloseItemModal = function(){
    var modal = document.getElementById('histoireItemModal');
    if(modal) modal.classList.remove('open');
    if(_histoireFromGestion){
      _histoireFromGestion = false;
      _histoireRenderGestionList();
      var overlay = document.getElementById('histoireGestionOverlay');
      if(overlay) overlay.classList.add('open');
    } else {
      _unblockBackgroundScroll();
      _restoreScrollPosition();
    }
    _histoireEditingId = null;
  };

  window.histoireSaveItem = function(){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    var emoji = document.getElementById('histoireItemEmoji').value.trim()||'💘';
    var dateLabel = document.getElementById('histoireItemDate').value.trim();
    var title = document.getElementById('histoireItemTitle').value.trim();
    var text = document.getElementById('histoireItemText').value.trim();
    if(!title){ alert('Le titre est obligatoire.'); return; }
    var data = { couple_id: coupleId, emoji: emoji, date_label: dateLabel, title: title, text: text };
    var btn = document.getElementById('histoireItemSaveBtn');
    if(btn){ btn.textContent='...'; btn.disabled=true; }
    var done = function(){ if(btn){btn.textContent='Sauvegarder';btn.disabled=false;} window.histoireCloseItemModal(); window.histoireLoad(); };
    if(_histoireEditingId){
      fetch(SB2_URL+'/rest/v1/v2_histoire?id=eq.'+_histoireEditingId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)}).then(done).catch(done);
    } else {
      fetch(SB2_URL+'/rest/v1/v2_histoire',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)}).then(done).catch(done);
    }
  };

  window.histoireDeleteItem = function(){
    if(!_histoireEditingId) return;
    if(!confirm('Supprimer ce chapitre ?')) return;
    var coupleId = _getCoupleId();
    fetch(SB2_URL+'/rest/v1/v2_histoire?id=eq.'+_histoireEditingId+'&couple_id=eq.'+coupleId,{method:'DELETE',headers:sb2Headers()})
    .then(function(){ window.histoireCloseItemModal(); window.histoireLoad(); }).catch(function(){});
  };

  // Listener click-dehors modal item
  var _hModal = document.getElementById('histoireItemModal');
  if(_hModal) _hModal.addEventListener('click',function(e){ if(e.target===_hModal) window.histoireCloseItemModal(); });

  // Init au chargement
  document.addEventListener('nousContentReady', function(){ window.histoireLoad(); });
  setTimeout(function(){ if(!_histoireAllRows.length) window.histoireLoad(); }, 2000);

})();


// ════════════════════════════════════════════════════════════════════
// SECTION LIVRES — Pochettes dynamiques couple, badge NEW, Idée du jour Groq
// Table : v2_books (id, couple_id, idx, title, description, has_image, position, created_at, updated_at)
// ════════════════════════════════════════════════════════════════════
(function(){

  var SB_BUCKET = 'images';
  var GROQ_EDGE = SB2_URL + '/functions/v1/gemini-suggest';
  var MAX_VISIBLE = 5; // pochettes visibles dans le slider

  function _getCoupleId(){ var u=(typeof v2GetUser==='function')?v2GetUser():null; return u?u.couple_id:null; }

  var _livresAllRows = [];
  var _livreFromGestion = false;
  var _livreEditingId = null;
  var _livreCurrentPhotoUrl = null;

  // ── Idée du jour : 5 idées générées 1x/jour, navigation →
  var _ideaCache = null; // { date, ideas: [...], pos }

  function _livreIdeaKey(coupleId){ return 'yam_livre_ideas_'+coupleId; }

  function _loadIdeaCache(coupleId){
    try{
      var d = JSON.parse(localStorage.getItem(_livreIdeaKey(coupleId))||'null');
      var today = new Date().toISOString().slice(0,10);
      if(d && d.date===today && Array.isArray(d.ideas) && d.ideas.length) return d;
    }catch(e){}
    return null;
  }

  function _saveIdeaCache(coupleId, ideas, pos){
    try{
      localStorage.setItem(_livreIdeaKey(coupleId), JSON.stringify({
        date: new Date().toISOString().slice(0,10),
        ideas: ideas,
        pos: pos||0
      }));
    }catch(e){}
  }

  // ── Charger les livres depuis Supabase ──
  window.livresLoad = function(){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    fetch(SB2_URL+'/rest/v1/v2_books?couple_id=eq.'+coupleId+'&order=position.asc,created_at.desc&select=*',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      _livresAllRows = Array.isArray(rows)?rows:[];
      _renderLivresSlider();
      // Rafraîchir badge NEW
      if(typeof window.yamRefreshNewBadges==='function') window.yamRefreshNewBadges();
      // Si overlay gestion ouvert, rafraîchir
      var overlay = document.getElementById('livresGestionOverlay');
      if(overlay && overlay.classList.contains('open')) _renderLivresGestionList();
    }).catch(function(){});
  };

  // ── Rendu slider (5 premières pochettes) ──
  function _renderLivresSlider(){
    var slider = document.getElementById('livresSlider'); if(!slider) return;
    slider.innerHTML = '';
    if(!_livresAllRows.length){
      var empty = document.createElement('div');
      empty.style.cssText = 'color:var(--muted);font-size:13px;padding:16px 4px;';
      empty.textContent = 'Ajoutez votre première pochette ! 📚';
      slider.appendChild(empty);
      return;
    }
    var toShow = _livresAllRows.slice(0,MAX_VISIBLE);
    toShow.forEach(function(book){ slider.appendChild(_buildLivreCard(book)); });
  }

  // ── Build une carte livre pour le slider ──
  function _buildLivreCard(book){
    var card = document.createElement('div');
    card.className = 'album-card lui-card-wrap';
    card.style.position = 'relative';
    var photoUrl = book.has_image ? (SB2_URL+'/storage/v1/object/public/'+SB_BUCKET+'/books/'+book.couple_id+'/'+book.id+'.jpg?t='+Math.floor(Date.now()/60000)) : '';
    var editSVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    // Badge NEW
    var isNew = window.yamIsNew ? window.yamIsNew('livre_'+book.id) : false;
    var newBadge = isNew ? '<span style="position:absolute;top:4px;right:4px;background:linear-gradient(135deg,#e879a0,#9b59b6);color:#fff;font-size:8px;font-weight:800;letter-spacing:0.5px;padding:2px 5px;border-radius:6px;text-transform:uppercase;z-index:10;pointer-events:none;">NEW</span>' : '';
    card.innerHTML =
      '<div class="album-image" style="position:relative;">'+newBadge+
        (photoUrl ?
          '<img src="'+escHtml(photoUrl)+'" style="width:100%;height:100%;object-fit:cover;border-radius:10px 10px 0 0;" loading="lazy">' :
          '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:36px;color:var(--muted);">📚</div>'
        )+
        '<div class="album-banner">'+escHtml(book.title||'Sans titre')+'</div>'+
        '<div class="lui-upload-btn"><div class="lui-upload-icon">'+editSVG+'</div><div class="lui-upload-lbl">Modifier</div></div>'+
      '</div>'+
      '<div class="album-desc" style="cursor:default;">'+escHtml(book.description||'Ajouter une légende...')+'</div>';
    // Clic bouton edit (la photo / bouton modifier)
    card.querySelector('.lui-upload-btn').addEventListener('click',function(e){ e.stopPropagation(); _livreFromGestion=false; window.livresOpenEdit(book); });
    // (pas de click sur la légende — double-clic photo suffit pour éditer)
    return card;
  }

  // ── Éditer la légende d'un livre ──
  function _editLivreDesc(book){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    descEditOpen(book.description||'', 'Légende du livre "'+escHtml(book.title||'')+'"', function(val){
      book.description = val;
      fetch(SB2_URL+'/rest/v1/v2_books?id=eq.'+book.id+'&couple_id=eq.'+coupleId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({description:val})}).catch(function(){});
      window.yamMarkNewAndRefresh && window.yamMarkNewAndRefresh('livre_'+book.id);
      window.yamMarkNew && window.yamMarkNew('livre');
      window.livresLoad();
    });
  }

  // ── Overlay gestion ──
  window.livresOpenGestion = function(){
    if(!_livresAllRows.length) window.livresLoad();
    _saveScrollPosition();
    _blockBackgroundScroll();
    _renderLivresGestionList();
    var overlay = document.getElementById('livresGestionOverlay');
    if(overlay){ overlay.classList.add('open'); setTimeout(function(){ var l=document.getElementById('livresGestionList'); if(l)l.scrollTop=0; },50); }
  };

  window.livresCloseGestion = function(){
    var overlay = document.getElementById('livresGestionOverlay');
    if(overlay) overlay.classList.remove('open');
    _livreFromGestion = false;
    _unblockBackgroundScroll();
    _restoreScrollPosition();
  };

  function _renderLivresGestionList(){
    var list = document.getElementById('livresGestionList'); if(!list) return;
    list.innerHTML = ''; list.scrollTop = 0;
    if(!_livresAllRows.length){
      list.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:32px;">Aucun livre pour l\'instant</div>';
      return;
    }
    _livresAllRows.forEach(function(book){
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer;';
      var photoUrl = book.has_image ? (SB2_URL+'/storage/v1/object/public/'+SB_BUCKET+'/books/'+book.couple_id+'/'+book.id+'.jpg?t='+Math.floor(Date.now()/60000)) : '';
      var isNew = window.yamIsNew ? window.yamIsNew('livre_'+book.id) : false;
      row.innerHTML =
        '<div style="width:48px;height:64px;background:var(--s2);border-radius:8px;flex-shrink:0;overflow:hidden;position:relative;">'+
          (photoUrl ? '<img src="'+escHtml(photoUrl)+'" style="width:100%;height:100%;object-fit:cover;" loading="lazy">' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:20px;">📚</div>')+
          (isNew ? '<span style="position:absolute;top:2px;right:2px;background:linear-gradient(135deg,#e879a0,#9b59b6);color:#fff;font-size:7px;font-weight:800;padding:1px 4px;border-radius:4px;">NEW</span>' : '')+
        '</div>'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-size:14px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(book.title||'Sans titre')+'</div>'+
          (book.description ? '<div style="font-size:12px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(book.description)+'</div>' : '')+
        '</div>'+
        '<div style="font-size:18px;color:var(--muted);flex-shrink:0;padding-right:4px;">›</div>';
      (function(b){ row.addEventListener('click', function(){ _livreFromGestion=true; window.livresOpenEdit(b); }); })(book);
      list.appendChild(row);
    });
  }

  // ── Ouvrir modale de création ──
  window.livresOpenNew = function(){
    _saveScrollPosition();
    _forceScrollLock();
    _livreEditingId = null;
    _livreCurrentPhotoUrl = null;
    var modal = document.getElementById('livreEditModal'); if(!modal) return;
    document.getElementById('livreEditModalTitle').textContent = 'Nouvelle pochette';
    document.getElementById('livreEditTitle').value = '';
    document.getElementById('livreEditDesc').value = '';
    var photo = document.getElementById('livreEditPhoto');
    if(photo){ photo.style.backgroundImage=''; photo.innerHTML='<div style="font-size:28px;color:var(--muted);">📚</div><div style="font-size:11px;color:var(--muted);margin-top:4px;">Ajouter une photo de couverture</div>'; }
    var delBtn = document.getElementById('livreEditDelBtn'); if(delBtn) delBtn.style.display='none';
    modal.classList.add('open');
  };

  // ── Ouvrir modale d'édition ──
  window.livresOpenEdit = function(book){
    _saveScrollPosition();
    _forceScrollLock();
    _livreEditingId = book.id;
    _livreCurrentPhotoUrl = book.has_image ? (SB2_URL+'/storage/v1/object/public/'+SB_BUCKET+'/books/'+book.couple_id+'/'+book.id+'.jpg') : null;
    var modal = document.getElementById('livreEditModal'); if(!modal) return;
    document.getElementById('livreEditModalTitle').textContent = 'Modifier le livre';
    document.getElementById('livreEditTitle').value = book.title||'';
    document.getElementById('livreEditDesc').value = book.description||'';
    var photo = document.getElementById('livreEditPhoto');
    if(photo){
      if(_livreCurrentPhotoUrl){ photo.style.backgroundImage='url('+_livreCurrentPhotoUrl+'?t='+Date.now()+')'; photo.innerHTML=''; }
      else { photo.style.backgroundImage=''; photo.innerHTML='<div style="font-size:28px;color:var(--muted);">📚</div><div style="font-size:11px;color:var(--muted);margin-top:4px;">Ajouter une photo de couverture</div>'; }
    }
    var delBtn = document.getElementById('livreEditDelBtn'); if(delBtn) delBtn.style.display='block';
    modal.classList.add('open');
  };

  window.livresCloseEdit = function(){
    // Fermer le clavier iOS avant de fermer la modale (évite les glitches de resize)
    if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
    var modal = document.getElementById('livreEditModal'); if(modal) modal.classList.remove('open');
    var sheet = document.querySelector('#livreEditModal .nous-modal-sheet');
    if(sheet) sheet.style.marginBottom = '';
    if(_livreFromGestion){
      _livreFromGestion = false;
      _renderLivresGestionList();
      var overlay = document.getElementById('livresGestionOverlay');
      if(overlay && !overlay.classList.contains('open')) overlay.classList.add('open');
      // Re-lock pour la gestion overlay
      _forceScrollLock();
    } else {
      _unblockBackgroundScroll();
      _restoreScrollPosition();
    }
    _livreEditingId = null;
    _livreCurrentPhotoUrl = null;
  };

  // ── Fix iOS clavier : géré par app-ios-touch.js (_yamKeyboardUpdate) ──

  // ── Upload photo ──
  window.livresPhotoClick = function(){
    var inp = document.getElementById('livrePhotoInput'); if(inp){ inp.value=''; inp.click(); }
  };

  window.livresHandlePhoto = function(input){
    if(!input.files||!input.files[0]) return;
    var file = input.files[0];
    var ALLOWED = ['image/jpeg','image/jpg','image/png','image/webp'];
    if(ALLOWED.indexOf(file.type)===-1){ alert('Format non autorisé.'); return; }
    if(file.size>5*1024*1024){ alert('Image trop lourde (max 5 Mo)'); return; }
    var coupleId = _getCoupleId(); if(!coupleId) return;
    var photo = document.getElementById('livreEditPhoto');
    if(photo) photo.innerHTML = '<div style="font-size:12px;color:var(--muted);">Envoi...</div>';

    // Si nouveau livre, générer un ID temporaire pour l'upload
    var bookId = _livreEditingId || ('tmp_'+Date.now());
    var path = 'books/'+coupleId+'/'+bookId+'.jpg';
    fetch(SB2_URL+'/storage/v1/object/'+SB_BUCKET+'/'+path,{method:'POST',headers:Object.assign({'Content-Type':file.type,'x-upsert':'true'},sb2Headers()),body:file})
    .then(function(r){ return r.text().then(function(){ return r.ok; }); })
    .then(function(ok){
      if(ok){
        _livreCurrentPhotoUrl = SB2_URL+'/storage/v1/object/public/'+SB_BUCKET+'/'+path;
        if(!_livreEditingId) window._livreTmpPhotoId = bookId; // stocker l'ID temporaire
        if(photo){ photo.style.backgroundImage='url('+_livreCurrentPhotoUrl+'?t='+Date.now()+')'; photo.innerHTML=''; }
      } else {
        if(photo) photo.innerHTML='<div style="font-size:11px;color:#e05555;">Erreur upload</div>';
      }
    }).catch(function(){ if(photo) photo.innerHTML='<div style="font-size:11px;color:#e05555;">Erreur réseau</div>'; });
  };

  // ── Sauvegarde ──
  window.livresSave = function(){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    var title = (document.getElementById('livreEditTitle').value||'').trim();
    var desc  = (document.getElementById('livreEditDesc').value||'').trim();
    if(!title){ if(typeof showToast==='function') showToast('Le titre est obligatoire','error'); return; }
    var btn = document.getElementById('livreEditSaveBtn'); if(btn){ btn.textContent='...'; btn.disabled=true; }
    var hasImage = !!_livreCurrentPhotoUrl;

    var done = function(id){
      if(btn){ btn.textContent='Sauvegarder'; btn.disabled=false; }
      // Si on avait un id temporaire pour la photo, renommer dans Storage
      if(window._livreTmpPhotoId && id && window._livreTmpPhotoId !== id){
        var oldPath = 'books/'+coupleId+'/'+window._livreTmpPhotoId+'.jpg';
        var newPath = 'books/'+coupleId+'/'+id+'.jpg';
        // On re-upload depuis l'URL temporaire dans le bon slot
        // (simple PATCH ne suffit pas sur le storage — on patch juste has_image=true côté DB)
        fetch(SB2_URL+'/rest/v1/v2_books?id=eq.'+id,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({has_image:true})}).catch(function(){});
      }
      window._livreTmpPhotoId = null;
      window.yamMarkNew && window.yamMarkNew('livre');
      window.yamMarkNew && window.yamMarkNew('livre_'+(id||_livreEditingId));
      window.yamRefreshNewBadges && window.yamRefreshNewBadges();
      window.livresCloseEdit();
      window.livresLoad();
    };

    if(_livreEditingId){
      // Mise à jour
      var data = {title:title, description:desc, has_image:hasImage};
      // Si nouvelle photo uploadée avec l'ID final, renommer si nécessaire
      if(hasImage && window._livreTmpPhotoId && window._livreTmpPhotoId !== _livreEditingId){
        // Upload de la photo dans le bon slot (fetch blob depuis l'URL tmp)
        var tmpUrl = SB2_URL+'/storage/v1/object/public/'+SB_BUCKET+'/books/'+coupleId+'/'+window._livreTmpPhotoId+'.jpg';
        fetch(tmpUrl).then(function(r){ return r.blob(); }).then(function(blob){
          return fetch(SB2_URL+'/storage/v1/object/'+SB_BUCKET+'/books/'+coupleId+'/'+_livreEditingId+'.jpg',{method:'POST',headers:Object.assign({'Content-Type':'image/jpeg','x-upsert':'true'},sb2Headers()),body:blob});
        }).catch(function(){});
      }
      fetch(SB2_URL+'/rest/v1/v2_books?id=eq.'+_livreEditingId+'&couple_id=eq.'+coupleId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)}).then(function(){ done(_livreEditingId); }).catch(function(){ done(_livreEditingId); });
    } else {
      // Nouveau
      var data2 = {couple_id:coupleId, title:title, description:desc, has_image:hasImage, position:(_livresAllRows.length)};
      fetch(SB2_URL+'/rest/v1/v2_books',{method:'POST',headers:sb2Headers({'Prefer':'return=representation','Content-Type':'application/json'}),body:JSON.stringify(data2)})
      .then(function(r){
        if(!r.ok) return r.json().then(function(e){ throw new Error(e.message||e.hint||('HTTP '+r.status)); });
        return r.json();
      })
      .then(function(rows){
        var newId = Array.isArray(rows)&&rows.length?rows[0].id:null;
        // Si on a une photo avec un ID temporaire, la renommer vers le bon ID
        if(newId && hasImage && window._livreTmpPhotoId){
          var tmpPath = SB2_URL+'/storage/v1/object/public/'+SB_BUCKET+'/books/'+coupleId+'/'+window._livreTmpPhotoId+'.jpg';
          fetch(tmpPath).then(function(r){ return r.blob(); }).then(function(blob){
            return fetch(SB2_URL+'/storage/v1/object/'+SB_BUCKET+'/books/'+coupleId+'/'+newId+'.jpg',{method:'POST',headers:Object.assign({'Content-Type':'image/jpeg','x-upsert':'true'},sb2Headers()),body:blob});
          }).then(function(){
            // Patch has_image maintenant que la photo est au bon endroit
            fetch(SB2_URL+'/rest/v1/v2_books?id=eq.'+newId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({has_image:true})}).catch(function(){});
          }).catch(function(){});
        }
        done(newId);
      }).catch(function(err){
        if(btn){ btn.textContent='Sauvegarder'; btn.disabled=false; }
        if(typeof showToast==='function') showToast('Erreur : '+(err&&err.message?err.message:'impossible de sauvegarder'),'error',3500);
      });
    }
  };

  // ── Suppression ──
  window.livresDelete = function(){
    if(!_livreEditingId) return;
    if(!confirm('Supprimer ce livre ?')) return;
    var coupleId = _getCoupleId(); if(!coupleId) return;
    fetch(SB2_URL+'/rest/v1/v2_books?id=eq.'+_livreEditingId+'&couple_id=eq.'+coupleId,{method:'DELETE',headers:sb2Headers()})
    .then(function(){ window.livresCloseEdit(); window.livresLoad(); }).catch(function(){});
  };

  // ── Idée du jour Groq — 5 idées générées 1x/jour, navigation → ──
  window.livresIdeeDuJour = function(){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    var cache = _loadIdeaCache(coupleId);
    var card = document.getElementById('livreIdeaCard');
    var textEl = document.getElementById('livreIdeaText');
    var metaEl = document.getElementById('livreIdeaMeta');
    var btn = document.getElementById('livreIdeaBtn');

    if(card) card.style.display = 'flex';

    // Si cache valide, naviguer dans les 5 idées
    if(cache && cache.ideas.length){
      var pos = (cache.pos||0) % cache.ideas.length;
      if(textEl) textEl.innerHTML = '<strong>📖 '+escHtml(cache.ideas[pos].title||'')+'</strong><br><span style="font-weight:400;font-size:13px;color:var(--muted);">'+escHtml(cache.ideas[pos].author||'')+(cache.ideas[pos].desc?' — '+escHtml(cache.ideas[pos].desc):'')+'</span>';
      if(metaEl) metaEl.textContent = 'Idée '+(pos+1)+'/'+cache.ideas.length+' · Générée aujourd\'hui';
      _saveIdeaCache(coupleId, cache.ideas, pos+1);
      // Enregistrer le cache comme _ideaCache courant pour livresAddFromIdea
      _ideaCache = cache.ideas[pos];
      return;
    }

    // Générer les 5 idées
    if(btn){ btn.disabled=true; btn.innerHTML='Chargement...'; }
    if(textEl) textEl.textContent = 'Génération de 5 idées de lecture... 📚';

    var prompt = 'Tu es un assistant passionné de littérature pour un couple. Propose EXACTEMENT 5 idées de livres à lire ensemble (romans, fantasy, suspense, développement personnel, etc.), variés et originaux. Réponds UNIQUEMENT en JSON strict sans texte autour, format exact : [{"title":"Titre du livre","author":"Auteur","desc":"Une phrase sur le livre"},...]';

    fetch(GROQ_EDGE,{method:'POST',headers:{'Content-Type':'application/json','x-app-secret':SB2_APP_SECRET,'apikey':SB2_KEY,'Authorization':'Bearer '+SB2_KEY},body:JSON.stringify({prompt:prompt})})
    .then(function(r){ return r.json(); })
    .then(function(data){
      if(data.error) throw new Error(data.error);
      var raw = (data.text||'').replace(/```json|```/g,'').trim();
      var ideas = JSON.parse(raw);
      if(!Array.isArray(ideas)||!ideas.length) throw new Error('Format invalide');
      _saveIdeaCache(coupleId, ideas, 1);
      _ideaCache = ideas[0];
      if(textEl) textEl.innerHTML = '<strong>📖 '+escHtml(ideas[0].title||'')+'</strong><br><span style="font-weight:400;font-size:13px;color:var(--muted);">'+escHtml(ideas[0].author||'')+(ideas[0].desc?' — '+escHtml(ideas[0].desc):'')+'</span>';
      if(metaEl) metaEl.textContent = 'Idée 1/5 · Générée maintenant';
    })
    .catch(function(){
      var fallbacks = [{title:'Le Petit Prince',author:'Antoine de Saint-Exupéry',desc:'Un conte poétique intemporel'},{title:'L\'Alchimiste',author:'Paulo Coelho',desc:'Suivre ses rêves jusqu\'au bout du monde'},{title:'Les Fourmis',author:'Bernard Werber',desc:'La colonie humaine vue différemment'},{title:'Orgueil et Préjugés',author:'Jane Austen',desc:'Le roman d\'amour classique par excellence'},{title:'Dune',author:'Frank Herbert',desc:'L\'épopée de science-fiction ultime'}];
      _saveIdeaCache(coupleId, fallbacks, 1);
      _ideaCache = fallbacks[0];
      if(textEl) textEl.innerHTML = '<strong>📖 '+escHtml(fallbacks[0].title)+'</strong><br><span style="font-weight:400;font-size:13px;color:var(--muted);">'+escHtml(fallbacks[0].author)+' — '+escHtml(fallbacks[0].desc)+'</span>';
      if(metaEl) metaEl.textContent = 'Idées hors-ligne';
    })
    .finally(function(){ if(btn){ btn.disabled=false; btn.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Idée du jour'; }});
  };

  // ── Ajouter l'idée du jour comme livre ──
  window.livresAddFromIdea = function(){
    if(!_ideaCache) return;
    var coupleId = _getCoupleId(); if(!coupleId) return;
    var data = {couple_id:coupleId, title:_ideaCache.title||'Livre', description:(_ideaCache.author||'')+(_ideaCache.desc?' — '+_ideaCache.desc:''), has_image:false, position:_livresAllRows.length};
    fetch(SB2_URL+'/rest/v1/v2_books',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)})
    .then(function(r){
      if(!r.ok) return r.json().then(function(e){ throw new Error(e.message||e.hint||r.status); });
      window.yamMarkNew && window.yamMarkNew('livre');
      window.yamRefreshNewBadges && window.yamRefreshNewBadges();
      var card = document.getElementById('livreIdeaCard'); if(card) card.style.display='none';
      window.livresLoad();
      if(typeof showToast==='function') showToast('Livre ajouté à votre bibliothèque ! 📚','success',2500);
    }).catch(function(err){
      if(typeof showToast==='function') showToast('Erreur : '+(err&&err.message?err.message:'impossible d\'ajouter le livre'),'error',3500);
    });
  };

  // Init au chargement de la section
  document.addEventListener('nousContentReady', function(){ window.livresLoad(); });

  // ── Fermeture au clic sur le fond des overlays livres ──
  // IMPORTANT : livreEditModal ne se ferme PAS au clic sur le fond (trop de faux positifs iOS)
  // Seul livresGestionOverlay (liste) se ferme au clic fond — pas de saisie texte dedans.
  (function(){
    var _livresOverlayIds = [
      { id: 'livresGestionOverlay', fn: function(){ window.livresCloseGestion(); } }
      // livreEditModal : PAS de fermeture au clic fond — utiliser le bouton ✕
    ];
    function _attachOverlayClose(id, fn){
      var _touchStartX = null, _touchStartY = null, _openedAt = 0;
      setTimeout(function(){
        var el = document.getElementById(id);
        if(!el) return;

        // Mémoriser quand la modale s'ouvre (pour ignorer le tap d'ouverture lui-même)
        new MutationObserver(function(){
          if(el.classList.contains('open')) _openedAt = Date.now();
        }).observe(el, { attributes: true, attributeFilter: ['class'] });

        // click — desktop + Android
        el.addEventListener('click', function(e){
          if(Date.now() - _openedAt < 400) return; // trop tôt après ouverture
          if(e.target === el) fn();
        });

        // touchstart — iOS : noter les coords SEULEMENT si touch direct sur overlay (pas enfant)
        el.addEventListener('touchstart', function(e){
          if(e.target === el){
            _touchStartX = e.touches[0].clientX;
            _touchStartY = e.touches[0].clientY;
          } else {
            _touchStartX = null; // touch sur la sheet ou un bouton → pas de fermeture
            _touchStartY = null;
          }
        }, { passive: true });

        // touchend — iOS
        el.addEventListener('touchend', function(e){
          if(_touchStartX === null) return; // touch parti d'un enfant
          if(Date.now() - _openedAt < 400) return; // trop tôt
          if(e.target !== el) return; // fin du touch sur un enfant
          var dx = Math.abs(e.changedTouches[0].clientX - _touchStartX);
          var dy = Math.abs(e.changedTouches[0].clientY - _touchStartY);
          if(dx < 10 && dy < 10) fn(); // tap propre sur le fond
          _touchStartX = null;
          _touchStartY = null;
        }, { passive: true });

      }, 0);
    }
    _livresOverlayIds.forEach(function(o){ _attachOverlayClose(o.id, o.fn); });
  })();

})();


// Scroll background blocker — géré par app-ios-touch.js (_yamRegisterScrollLock)

// ════════════════════════════════════════════════════════════════════
// 14. HELPER — SVG crayon sobre (remplace l'ancien engrenage)
// ════════════════════════════════════════════════════════════════════
function _gearSVG(){
  // Crayon sobre — identique au style des boutons "Modifier" dans les modales
  return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
}


// ════════════════════════════════════════════════════════════════════
// 15. SETPROFILE HOOK — resync sections + relance nousLoad si besoin
// ════════════════════════════════════════════════════════════════════
(function(){
  var _origSetProfile = window.setProfile;
  window.setProfile = function(gender){
    if(_origSetProfile) _origSetProfile.apply(this, arguments);
    setTimeout(function(){
      if(typeof elleSyncSections === 'function') elleSyncSections();
      if(typeof window.luiSyncDescs === 'function') window.luiSyncDescs();
      if(typeof _nousLoadProfil  === 'function') _nousLoadProfil();
      // Si l'onglet nous est actif et que les données ne sont pas encore chargées
      // (cas où nousLoad avait été appelé trop tôt avant la session), on relance
      if(window._currentTab === 'nous') {
        if(!window._nousContentLoaded) {
          window._nousContentLoaded = true;
          _nousInitAll();
        } else {
          // Refresh des données liées au profil
          if(typeof window.nousLoadSouvenirs==='function') window.nousLoadSouvenirs();
          if(typeof renderMemoCouple==='function') renderMemoCouple();
          if(typeof window._petitsMotsLoad==='function') window._petitsMotsLoad();
          if(typeof window.nousLoadActivites==='function') window.nousLoadActivites();
        }
      }
    }, 300);
  };
})();


// ════════════════════════════════════════════════════════════════════
// 16. EXPOSITION GLOBALE pour yamSwitchTab
// ════════════════════════════════════════════════════════════════════
window.nousLoad = function(){
  var u = (typeof v2GetUser === 'function') ? v2GetUser() : null;
  if (!u || !u.couple_id) {
    // Session pas encore prête — setProfile() va relancer nousLoad via son hook
    // On marque quand même que l'onglet a été demandé
    window._nousContentLoaded = false;
    return;
  }
  if(window._nousContentLoaded) {
    // Refresh léger à chaque retour sur l'onglet
    loadLikeCounters();
    if(typeof window.nousLoadSouvenirs==='function') window.nousLoadSouvenirs();
    if(typeof window.nousLoadActivites==='function') window.nousLoadActivites();
    if(typeof renderMemoCouple==='function') renderMemoCouple();
    if(typeof window._petitsMotsLoad==='function') window._petitsMotsLoad();
    if(typeof window.livresLoad==='function') window.livresLoad();
    if(typeof window.yamRefreshNewBadges==='function') setTimeout(window.yamRefreshNewBadges, 300);
  } else {
    window._nousContentLoaded = true;
    _nousInitAll();
  }
};


// ════════════════════════════════════════════════════════════════════
// SUGGESTIONS DE LA SEMAINE — 5 mots générés par IA (Groq)
// Partagés entre les 2 via Supabase (v2_suggestion_songs réutilisé
// ou v2_new_badges — ici on utilise v2_photo_descs category='semaine')
// Régénérables 1x/semaine — identiques pour les 2 partenaires
// ════════════════════════════════════════════════════════════════════
(function(){

  var GROQ_EDGE  = SB2_URL + '/functions/v1/gemini-suggest';
  var SLOTS_LUI  = ['animal','fleurs','personnage','saison','repas'];
  var SLOTS_ELLE = ['animal','fleurs','personnage','saison','repas'];
  var SLOT_LABELS = { animal:'Animal 🐾', fleurs:'Fleurs 🌸', personnage:'Personnage 🧑', saison:'Saison 🍂', repas:'Repas 🍽️' };

  function _getCoupleId(){ var u=(typeof v2GetUser==='function')?v2GetUser():null; return u?u.couple_id:null; }
  function _getWeekKey(){
    var d = new Date();
    var jan1 = new Date(d.getFullYear(), 0, 1);
    var week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return d.getFullYear() + '-W' + week;
  }

  // ── Charger depuis Supabase (category='semaine', slot=weekKey) ──
  function _loadFromSB(callback){
    var cid = _getCoupleId(); if(!cid){ callback(null, 0); return; }
    var wk = _getWeekKey();
    fetch(SB2_URL+'/rest/v1/v2_photo_descs?couple_id=eq.'+cid+'&category=eq.semaine&slot=eq.'+encodeURIComponent(wk)+'&select=description&limit=1', {headers: sb2Headers()})
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(rows){
      if(rows && rows[0] && rows[0].description){
        try{
          var parsed = JSON.parse(rows[0].description);
          // Nouveau format : { words: [...], regen: N }
          if(parsed && parsed.words){ callback(parsed.words, parsed.regen||0); return; }
          // Ancien format : tableau direct
          if(Array.isArray(parsed)){ callback(parsed, 0); return; }
        }catch(e){}
      }
      callback(null, 0);
    })
    .catch(function(){ callback(null, 0); });
  }

  // ── Sauvegarder dans Supabase (words + compteur de regens) ──
  function _saveSB(words, regenCount){
    var cid = _getCoupleId(); if(!cid) return;
    var wk = _getWeekKey();
    var payload = { words: words, regen: regenCount||0 };
    fetch(SB2_URL+'/rest/v1/v2_photo_descs', {
      method: 'POST',
      headers: sb2Headers({'Prefer':'resolution=merge-duplicates,return=minimal','Content-Type':'application/json'}),
      body: JSON.stringify({ couple_id: cid, category: 'semaine', slot: wk, description: JSON.stringify(payload) })
    }).catch(function(){});
  }

  // ── Lire le compteur de regens depuis les données chargées ──
  var _currentRegen = 0;
  var _currentWords = null;

  // ── Rendre les pills ──
  function _renderPills(words, weekKey, regenCount){
    var pills = document.getElementById('semainePills'); if(!pills) return;
    var meta  = document.getElementById('semaineMeta');
    var btn   = document.getElementById('semaineGenBtn');
    pills.innerHTML = '';
    var regenLeft = 1 - (regenCount||0);
    if(meta) meta.textContent = 'Semaine ' + weekKey + ' · ' + (regenLeft > 0 ? '1 rafraîchissement restant' : 'Plus de rafraîchissement cette semaine');
    if(btn){
      if(regenLeft > 0){
        btn.textContent = 'Rafraîchir';
        btn.disabled = false;
        btn.style.opacity = '1';
      } else {
        btn.textContent = 'Rafraîchir';
        btn.disabled = true;
        btn.style.opacity = '0.4';
      }
    }
    words.forEach(function(w){
      var pill = document.createElement('span');
      pill.textContent = w;
      pill.style.cssText = 'display:inline-flex;align-items:center;padding:7px 14px;border-radius:20px;background:linear-gradient(135deg,rgba(232,121,160,0.15),rgba(155,89,182,0.15));border:1px solid rgba(232,121,160,0.3);color:var(--text);font-size:13px;font-weight:600;font-family:\'DM Sans\',sans-serif;pointer-events:none;user-select:none;-webkit-user-select:none;';
      pills.appendChild(pill);
    });
  }

  // ── Charger et afficher ──
  function _semaineLoad(){
    var meta = document.getElementById('semaineMeta'); if(meta) meta.textContent = '';
    var pills = document.getElementById('semainePills'); if(pills) pills.innerHTML = '';
    _loadFromSB(function(words, regenCount){
      _currentRegen = regenCount||0;
      _currentWords = words;
      if(words && words.length){
        _renderPills(words, _getWeekKey(), _currentRegen);
      } else {
        var meta2 = document.getElementById('semaineMeta');
        if(meta2) meta2.textContent = 'Aucune suggestion cette semaine — appuie sur Générer ✨';
        var btn = document.getElementById('semaineGenBtn');
        if(btn){ btn.textContent = 'Générer'; btn.disabled = false; btn.style.opacity = '1'; }
      }
    });
  }

  // ── Générer via Groq ──
  /* ── Toggle suggestions IA — repliées par défaut ── */
  window.semaineToggle = function(){
    var content = document.getElementById('semaineContent');
    var eye     = document.getElementById('semaineEyeIcon');
    var btn     = document.getElementById('semaineToggleBtn');
    if(!content) return;
    var isOpen = content.dataset.open === '1';
    if(!isOpen){
      content.style.maxHeight = '300px';
      content.style.opacity   = '1';
      content.dataset.open    = '1';
      if(eye) eye.textContent = '🙈';
      if(btn){ btn.style.borderRadius = '14px 14px 0 0'; }
    } else {
      content.style.maxHeight = '0';
      content.style.opacity   = '0';
      content.dataset.open    = '0';
      if(eye) eye.textContent = '👁️';
      if(btn){ btn.style.borderRadius = '14px'; }
    }
  };

  window.semaineGenerate = function(){
    var cid = _getCoupleId(); if(!cid) return;
    // Vérifier la limite : 1 génération initiale + 1 rafraîchissement = 2 max
    // La 1ère génération (currentWords===null) est toujours autorisée
    if(_currentWords !== null && _currentRegen >= 1){
      if(typeof showToast==='function') showToast('Plus de rafraîchissement disponible cette semaine 🙈', 'error', 2500);
      return;
    }
    var btn  = document.getElementById('semaineGenBtn');
    var meta = document.getElementById('semaineMeta');
    var pills = document.getElementById('semainePills');
    if(btn){ btn.disabled=true; btn.textContent='...'; }
    if(meta) meta.textContent = 'Génération en cours ✨';
    if(pills) pills.innerHTML = '';

    var prompt = 'Tu es un assistant créatif pour un couple amoureux. Génère EXACTEMENT 5 noms communs concrets et visuels, faciles à photographier ou illustrer, pour décrire son partenaire de façon poétique. Chaque mot doit évoquer une qualité ou une émotion à travers une image concrète. Par exemple : Dessert (sa douceur), Vague (son énergie), Bougie (sa chaleur), Forêt (son mystère), Miel (sa tendresse). Les mots doivent être simples, beaux, photographiables. Réponds UNIQUEMENT en JSON strict, tableau de 5 strings, un seul mot par élément, sans texte autour. Exemple : ["Dessert","Vague","Bougie","Forêt","Miel"]';

    fetch(GROQ_EDGE, {
      method: 'POST',
      headers: {'Content-Type':'application/json','x-app-secret':SB2_APP_SECRET,'apikey':SB2_KEY,'Authorization':'Bearer '+SB2_KEY},
      body: JSON.stringify({prompt: prompt})
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if(data.error) throw new Error(data.error);
      var raw = (data.text||'').replace(/```json|```/g,'').trim();
      var words = JSON.parse(raw);
      if(!Array.isArray(words)||words.length<5) throw new Error('Format invalide');
      words = words.slice(0,5);
      var newRegen = _currentWords === null ? 0 : _currentRegen + 1;
      _currentRegen = newRegen;
      _currentWords = words;
      _saveSB(words, newRegen);
      _renderPills(words, _getWeekKey(), newRegen);
    })
    .catch(function(){
      // Fallbacks poétiques
      var fallbacks = ['Renard','Pivoine','Hermione','Automne','Miel'];
      var newRegen2 = _currentWords === null ? 0 : _currentRegen + 1;
      _currentRegen = newRegen2;
      _currentWords = fallbacks;
      _saveSB(fallbacks, newRegen2);
      _renderPills(fallbacks, _getWeekKey(), newRegen2);
      if(meta) meta.textContent = 'Suggestions hors-ligne · Semaine '+_getWeekKey();
    })
    .finally(function(){
      if(btn){ btn.disabled=false; btn.textContent='Régénérer'; }
    });
  };

  // Mots en lecture seule — pas de modale

  // STUB vide pour éviter les erreurs si appelé ailleurs
  window._openSlotModal = function(){};
  window.semaineCloseSlotModal = function(){};

  /*
    var wordEl = document.getElementById('semaineSlotWord'); if(wordEl) wordEl.textContent = word;
    var list = document.getElementById('semaineSlotList'); if(!list) return;
    list.innerHTML = '';

    // Copier dans le presse-papier
    if(navigator.clipboard){ navigator.clipboard.writeText(word).catch(function(){}); }

    // Boutons pour chaque slot ELLE et LUI
    [
      {section:'elle', slots: SLOTS_ELLE},
      {section:'lui',  slots: SLOTS_LUI}
    ].forEach(function(s){
      var profile = (typeof getProfile==='function') ? getProfile() : 'girl';
      // girl édite lui, boy édite elle
      if((profile==='girl' && s.section==='elle') || (profile==='boy' && s.section==='lui')) return;
      s.slots.forEach(function(slot){
        var lbl = (s.section==='elle'?'Elle · ':'Lui · ') + SLOT_LABELS[slot];
        var btn2 = document.createElement('button');
        btn2.textContent = lbl;
        btn2.style.cssText = 'width:100%;padding:11px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:var(--text);font-size:13px;font-weight:600;cursor:pointer;text-align:left;font-family:\'DM Sans\',sans-serif;';
        btn2.addEventListener('click', function(){
          semaineCloseSlotModal();
          // Ouvrir la modale d'édition du slot avec le mot pré-rempli
          if(typeof window.slotOpenEdit === 'function'){
            window.slotOpenEdit(s.section, slot);
            // Pré-remplir le champ banner après ouverture
            setTimeout(function(){
              var inp = document.getElementById('slotEditBannerInput');
              if(inp){ inp.value = word; inp.dispatchEvent(new Event('input')); }
            }, 300);
          }
        });
        list.appendChild(btn2);
      });
    });

    // Bouton "Juste copier"
    var copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 Copié dans le presse-papier';
    copyBtn.style.cssText = 'width:100%;padding:11px 14px;border-radius:12px;border:1px solid rgba(232,121,160,0.3);background:rgba(232,121,160,0.08);color:#e879a0;font-size:13px;font-weight:600;cursor:default;text-align:center;font-family:\'DM Sans\',sans-serif;';
    list.appendChild(copyBtn);

    modal.style.display = 'flex';
    _blockBackgroundScroll();
  };
  // alias public
  window.semaineOpenPill = window._openSlotModal;

  window.semaineCloseSlotModal = function(){
    var modal = document.getElementById('semaineSlotModal'); if(!modal) return;
    modal.style.display = 'none';
    _unblockBackgroundScroll();
  };

  */

  // Init au chargement de la section
  document.addEventListener('nousContentReady', function(){ _semaineLoad(); });

})();
