// ═══════════════════════════════════════════════════════════════════════════
// app-nous.js — Section "Nous ♥" — Module complet v2.0
// Remplace app-love.js. Contient TOUT ce qui concerne le couple :
// Profil Paired · Photos Elle/Lui · Raisons · Petits mots · Mémo
// Likes · Badge NEW · Souvenirs · Activités
// ═══════════════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════════
// 0. ACCÈS BETA — Code d'accès requis (section en cours de développement)
// ════════════════════════════════════════════════════════════════════
(function(){

  // ── Code d'accès beta — à changer quand la section sera stable ──
  var BETA_CODE = 'yam2026';
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
  _nousLoadBadge();
  loadLikeCounters();
  _petitsMotsLoad();
  renderMemoCouple();
  nousLoadSouvenirs();
  nousLoadActivites();
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
// 3. BADGE "NEW" sur l'icône Nous
// ════════════════════════════════════════════════════════════════════
function _nousLoadBadge() {
  var KEY = 'yam_nous_last_seen_' + ((typeof v2GetUser==='function'&&v2GetUser()) ? v2GetUser().couple_id : 'x');
  localStorage.setItem(KEY, Date.now());
  var badge = document.getElementById('navNousBadge');
  if (badge) badge.style.display = 'none';
}

window.nousSignalNew = function() {
  var badge = document.getElementById('navNousBadge');
  if (badge && window._currentTab !== 'nous') badge.style.display = 'block';
};


// ════════════════════════════════════════════════════════════════════
// 4. SECTION ELLE — Upload Supabase Storage V2
// ════════════════════════════════════════════════════════════════════
(function(){
  var SB_BUCKET = 'images';
  var SLOTS = ['animal','fleurs','personnage','saison','repas'];
  var ELLE_DESC_DEFAULTS = {
    animal:'Un regard doux', fleurs:'Pleine de couleurs', personnage:'Attachante',
    saison:'Un rayon de soleil', repas:'Son repas préféré'
  };
  var _currentSlot = null;
  function _getCoupleId(){ var u=(typeof v2GetUser==='function')?v2GetUser():null; return u?u.couple_id:null; }
  // Path isolé par couple : uploads/{coupleId}/{slot}-elle.jpg
  function _ellePath(coupleId, slot){ return 'uploads/'+coupleId+'/'+slot+'-elle.jpg'; }

  // Sync visibilité :
  // - boy voit SA section LUI (visible), ELLE masquée par défaut
  //   → rouage sur ELLE uniquement pour boy (pour décrire sa copine)
  // - girl voit SA section ELLE (visible), LUI masqué par défaut
  //   → rouage sur LUI uniquement pour girl (pour décrire son copain)
  window.elleSyncSections = function(){
    var profile = getProfile();
    var elleSection = document.getElementById('elleSectionContent');
    var luiSection  = document.getElementById('luiSectionContent');
    var elleGear    = document.getElementById('elleGearBtn');
    var luiGear     = document.getElementById('luiGearBtn');
    if (!elleSection || !luiSection) return;

    if (profile === 'boy') {
      // boy : voit LUI (sa section), ELLE masquée par défaut
      luiSection.style.display = 'block';
      if (!elleSection.dataset.forceOpen) elleSection.style.display = 'none';
      // Rouage visible sur ELLE (partenaire), caché sur LUI
      if (elleGear) elleGear.style.display = '';
      if (luiGear)  luiGear.style.display  = 'none';
    } else {
      // girl : voit ELLE (sa section), LUI masqué par défaut
      elleSection.style.display = 'block';
      if (!luiSection.dataset.forceOpen) luiSection.style.display = 'none';
      // Rouage visible sur LUI (partenaire), caché sur ELLE
      if (elleGear) elleGear.style.display = 'none';
      if (luiGear)  luiGear.style.display  = '';
    }
    // Boutons upload + légendes éditables : boy édite ELLE, girl édite LUI
    SLOTS.forEach(function(slot){
      var elleBtn  = document.getElementById('elle-btn-' + slot);
      var luiBtn   = document.getElementById('lui-btn-'  + slot);
      if (elleBtn) elleBtn.style.display = profile === 'boy'  ? '' : 'none';
      if (luiBtn)  luiBtn.style.display  = profile === 'girl' ? '' : 'none';
      var elleDesc = document.getElementById('elle-desc-' + slot);
      var luiDesc  = document.getElementById('lui-desc-'  + slot);
      if (elleDesc){ if(profile==='boy')  elleDesc.classList.add('lui-desc-editable'); else elleDesc.classList.remove('lui-desc-editable'); }
      if (luiDesc) { if(profile==='girl') luiDesc.classList.add('lui-desc-editable');  else luiDesc.classList.remove('lui-desc-editable'); }
    });
  };

  // Rouage ELLE : boy peut ouvrir/fermer la section ELLE pour décrire sa copine
  window.elleToggleSection = function(){
    var profile = getProfile();
    if (profile !== 'boy') return; // seul boy peut toggle ELLE
    var elleSection = document.getElementById('elleSectionContent');
    if (!elleSection) return;
    if (elleSection.style.display === 'none' || !elleSection.style.display) {
      elleSection.dataset.forceOpen = '1';
      elleSection.style.display = 'block';
    } else {
      delete elleSection.dataset.forceOpen;
      elleSection.style.display = 'none';
    }
  };

  window.elleLoadImages = function(){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    SLOTS.forEach(function(slot){
      var url = SB2_URL + '/storage/v1/object/public/' + SB_BUCKET + '/' + _ellePath(coupleId, slot) + '?t=' + Date.now();
      var img = document.getElementById('elle-img-' + slot);
      if(!img) return;
      var probe = new Image();
      probe.onload = function(){ img.src = url; };
      probe.onerror = function(){};
      probe.src = url;
    });
  };

  window.elleUploadClick = function(slot){
    if(getProfile() !== 'boy') return;
    _currentSlot = slot;
    var input = document.getElementById('elleFileInput');
    input.value = ''; input.click();
  };

  window.elleHandleFile = function(input){
    if(!input.files || !input.files[0]) return;
    var file = input.files[0]; var slot = _currentSlot; if(!slot) return;
    var ALLOWED = ['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
    if(ALLOWED.indexOf(file.type) === -1){ alert('Format non autorisé.'); input.value=''; return; }
    if(file.size > 5*1024*1024){ alert('Image trop lourde (max 5 Mo)'); return; }
    var loading = document.getElementById('elle-loading-' + slot);
    var bar     = document.getElementById('elle-bar-' + slot);
    if(loading) loading.classList.add('show');
    if(bar){ bar.style.width='0%'; setTimeout(function(){ bar.style.width='60%'; },100); }
    var coupleId=_getCoupleId(); if(!coupleId){ alert('Session introuvable'); return; }
    var filePath = _ellePath(coupleId, slot);
    fetch(SB2_URL+'/storage/v1/object/'+SB_BUCKET+'/'+filePath, {
      method:'POST', headers:Object.assign({'Content-Type':file.type,'x-upsert':'true'},sb2Headers()), body:file
    }).then(function(r){
      if(bar) bar.style.width='100%';
      return r.text().then(function(body){
        if(loading) loading.classList.remove('show');
        if(r.ok){ var img=document.getElementById('elle-img-'+slot); if(img) img.src=SB2_URL+'/storage/v1/object/public/'+SB_BUCKET+'/'+filePath+'?t='+Date.now(); }
        else alert('Erreur '+r.status+' : '+body);
      });
    }).catch(function(err){ if(loading) loading.classList.remove('show'); alert('Erreur réseau : '+err); });
  };

  window.elleLoadDescs = function(){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    fetch(SB2_URL+'/rest/v1/v2_photo_descs?category=eq.elle&couple_id=eq.'+coupleId+'&select=slot,description',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      if(!Array.isArray(rows)) return;
      rows.forEach(function(row){ var el=document.getElementById('elle-desc-'+row.slot); if(el&&row.description) el.textContent=row.description; });
    }).catch(function(){
      SLOTS.forEach(function(slot){ var saved=localStorage.getItem('elle_desc_'+slot); var el=document.getElementById('elle-desc-'+slot); if(el&&saved) el.textContent=saved; });
    });
  };

  function elleSaveDesc(slot,val){
    var coupleId=_getCoupleId(); if(!coupleId) return;
    fetch(SB2_URL+'/rest/v1/v2_photo_descs',{method:'POST',headers:sb2Headers({'Prefer':'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify({couple_id:coupleId,category:'elle',slot:slot,description:val})}).catch(function(){});
    localStorage.setItem('elle_desc_'+slot,val);
  }

  var SLOT_LABELS = {animal:'Son animal',fleurs:'Ses fleurs',personnage:'Son personnage',saison:'Sa saison',repas:'Son repas'};
  window.elleEditDesc = function(slot){
    if(getProfile()!=='boy') return;
    var el=document.getElementById('elle-desc-'+slot); if(!el) return;
    descEditOpen(el.textContent.trim(),'Légende · '+(SLOT_LABELS[slot]||slot),function(val){
      val=val||ELLE_DESC_DEFAULTS[slot]; el.textContent=val; elleSaveDesc(slot,val);
    });
  };
})();


// ════════════════════════════════════════════════════════════════════
// 5. SECTION LUI — Upload Supabase Storage V2
// ════════════════════════════════════════════════════════════════════
(function(){
  var SB_BUCKET='images';
  var SLOTS=['animal','fleurs','personnage','saison','repas'];
  var LUI_DESC_DEFAULTS={animal:'Son animal',fleurs:'Ses fleurs',personnage:'Son personnage',saison:'Sa saison',repas:'Son repas préféré'};
  var _currentSlot=null;
  function _getCoupleId(){ var u=(typeof v2GetUser==='function')?v2GetUser():null; return u?u.couple_id:null; }
  // Path isolé par couple : uploads/{coupleId}/{slot}-lui.jpg
  function _luiPath(coupleId, slot){ return 'uploads/'+coupleId+'/'+slot+'-lui.jpg'; }

  // Rouage LUI : girl peut ouvrir/fermer la section LUI pour décrire son copain
  window.luiToggleSection = function(){
    var profile = getProfile();
    if (profile !== 'girl') return; // seul girl peut toggle LUI
    var luiSection = document.getElementById('luiSectionContent');
    if (!luiSection) return;
    if (luiSection.style.display === 'none' || !luiSection.style.display) {
      luiSection.dataset.forceOpen = '1';
      luiSection.style.display = 'block';
    } else {
      delete luiSection.dataset.forceOpen;
      luiSection.style.display = 'none';
    }
  };

  window.luiLoadImages=function(){
    var coupleId=_getCoupleId(); if(!coupleId) return;
    SLOTS.forEach(function(slot){
      var url=SB2_URL+'/storage/v1/object/public/'+SB_BUCKET+'/'+_luiPath(coupleId,slot)+'?t='+Date.now();
      var img=document.getElementById('lui-img-'+slot);
      var empty=document.getElementById('lui-empty-'+slot);
      var btn=document.getElementById('lui-btn-'+slot);
      if(!img) return;
      var probe=new Image();
      probe.onload=function(){ img.src=url; img.style.display=''; if(empty) empty.style.display='none'; if(btn) btn.classList.remove('empty'); };
      probe.onerror=function(){ img.style.display='none'; if(empty) empty.style.display=''; if(btn) btn.classList.add('empty'); };
      probe.src=url;
    });
  };

  window.luiSyncDescs=function(){
    var profile=getProfile(); var isZelda=(profile==='girl');
    SLOTS.forEach(function(slot){ var el=document.getElementById('lui-desc-'+slot); if(!el) return; if(isZelda) el.classList.add('lui-desc-editable'); else el.classList.remove('lui-desc-editable'); });
  };

  // luiSyncEditMode gardé comme alias pour compatibilité setProfile hook
  window.luiSyncEditMode = window.luiSyncDescs;

  window.luiUploadClick=function(slot){
    if(getProfile()!=='girl') return;
    _currentSlot=slot; var input=document.getElementById('luiFileInput'); input.value=''; input.click();
  };

  window.luiHandleFile=function(input){
    if(!input.files||!input.files[0]) return;
    var file=input.files[0]; var slot=_currentSlot; if(!slot) return;
    var ALLOWED=['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
    if(ALLOWED.indexOf(file.type)===-1){ alert('Format non autorisé.'); input.value=''; return; }
    if(file.size>5*1024*1024){ alert('Image trop lourde (max 5 Mo)'); return; }
    var loading=document.getElementById('lui-loading-'+slot); var bar=document.getElementById('lui-bar-'+slot);
    if(loading) loading.classList.add('show');
    if(bar){ bar.style.width='0%'; setTimeout(function(){ bar.style.width='60%'; },100); }
    var coupleId=_getCoupleId(); if(!coupleId){ alert('Session introuvable'); return; }
    var filePath=_luiPath(coupleId,slot);
    fetch(SB2_URL+'/storage/v1/object/'+SB_BUCKET+'/'+filePath,{
      method:'POST',headers:Object.assign({'Content-Type':file.type,'x-upsert':'true'},sb2Headers()),body:file
    }).then(function(r){
      if(bar) bar.style.width='100%';
      return r.text().then(function(body){
        if(loading) loading.classList.remove('show');
        if(r.ok){
          var img=document.getElementById('lui-img-'+slot); var emptyEl=document.getElementById('lui-empty-'+slot); var btnEl=document.getElementById('lui-btn-'+slot);
          var newUrl=SB2_URL+'/storage/v1/object/public/'+SB_BUCKET+'/'+filePath+'?t='+Date.now();
          if(img){ img.src=newUrl; img.style.display=''; } if(emptyEl) emptyEl.style.display='none'; if(btnEl) btnEl.classList.remove('empty');
        } else alert('Erreur '+r.status+' : '+body);
      });
    }).catch(function(err){ if(loading) loading.classList.remove('show'); alert('Erreur réseau : '+err); });
  };

  window.luiLoadDescs=function(){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    fetch(SB2_URL+'/rest/v1/v2_photo_descs?category=eq.lui&couple_id=eq.'+coupleId+'&select=slot,description',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      if(!Array.isArray(rows)) return;
      rows.forEach(function(row){ var el=document.getElementById('lui-desc-'+row.slot); if(el&&row.description) el.textContent=row.description; });
    }).catch(function(){
      SLOTS.forEach(function(slot){ var saved=localStorage.getItem('lui_desc_'+slot); var el=document.getElementById('lui-desc-'+slot); if(el&&saved) el.textContent=saved; });
    });
  };

  window.luiEditDesc=function(slot){
    if(getProfile()!=='girl') return;
    var el=document.getElementById('lui-desc-'+slot); if(!el) return;
    var LABELS={animal:'Son animal',fleurs:'Ses fleurs',personnage:'Son personnage',saison:'Sa saison',repas:'Son repas'};
    descEditOpen(el.textContent.trim(),'Légende · '+(LABELS[slot]||slot),function(val){
      val=val||LUI_DESC_DEFAULTS[slot]; el.textContent=val;
      var coupleId=_getCoupleId(); if(!coupleId) return;
      fetch(SB2_URL+'/rest/v1/v2_photo_descs',{method:'POST',headers:sb2Headers({'Prefer':'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify({couple_id:coupleId,category:'lui',slot:slot,description:val})}).catch(function(){});
      localStorage.setItem('lui_desc_'+slot,val);
    });
  };
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
    _renderPetitsMotsGestion();
    modal.classList.add('open');
  };
  window.closePetitsMotsGestion = function(){
    var modal = document.getElementById('petitsMotsGestionModal'); if(modal) modal.classList.remove('open');
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
    var done = function(){ if(btn){ btn.textContent='Sauvegarder'; btn.disabled=false; } window.closePetitsMotsEditor(); _renderPetitsMotsGestion(); _petitsMotsLoad(); };
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
          var last=rows[0]; var emoji=other==='girl'?'👧':'👦';
          var name=(typeof v2GetDisplayName==='function'?v2GetDisplayName(other):(other==='girl'?'👧':'👦'));
          var txt=(last&&last.text)?last.text:'Nouveau message';
          if(window.showMsgHeaderPill) window.showMsgHeaderPill(emoji,name,txt);
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

function spawnHeart(){
  var h=document.createElement('div'); h.className='like-heart'; h.textContent='🤍'; document.body.appendChild(h); setTimeout(function(){ h.remove(); },600);
  var profile=getProfile()||null; if(!profile) return;
  var coupleId=(typeof v2GetUser==='function'&&v2GetUser())?v2GetUser().couple_id:null;
  if(!coupleId) return;
  var numEl=document.getElementById(profile==='girl'?'likeNumGirl':'likeNumBoy');
  if(numEl){ var txt=(numEl.textContent||'0').trim(); var cur=0; if(txt.endsWith('M')) cur=parseFloat(txt)*1000000; else if(txt.endsWith('k')) cur=parseFloat(txt)*1000; else cur=parseInt(txt)||0; numEl.textContent=fmtLikes(cur+1); }
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
// ════════════════════════════════════════════════════════════════════
(function(){

  function _getSession(){ return (typeof v2GetUser==='function')?v2GetUser():null; }

  // ── Rendu principal : aperçu note + todo côte à côte ──
  function renderMemoCouple(){
    _renderMemoPreview();
    _renderTodoPreview();
  }
  window.renderMemoCouple = renderMemoCouple;
  // Aliases pour compatibilité avec nousLoad()
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

  // ── Pop-up mémo (note + todo éditable) ──
  window.openMemoPopup = function(){
    var modal = document.getElementById('memoPopupModal'); if(!modal) return;
    _loadMemoFull();
    modal.classList.add('open');
  };
  window.closeMemoPopup = function(){
    var modal = document.getElementById('memoPopupModal'); if(modal) modal.classList.remove('open');
    renderMemoCouple();
  };

  var _currentNoteId = null;

  function _loadMemoFull(){
    var su = _getSession(); var coupleId = su?su.couple_id:null; if(!coupleId) return;
    // Note
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
    // Todo
    _loadTodoFull();
  }

  window.memoSaveNote = function(){
    var su = _getSession(); var coupleId = su?su.couple_id:null; if(!coupleId) return;
    var txt = (document.getElementById('memoPopupTextarea').value||'').trim();
    var ttl = (document.getElementById('memoPopupTitleInput').value||'').trim()||'Note';
    var btn = document.getElementById('memoPopupSaveBtn'); if(btn){ btn.textContent='...'; btn.disabled=true; }
    var done = function(){ if(btn){ btn.textContent='Sauvegarder'; btn.disabled=false; } renderMemoCouple(); };
    if(_currentNoteId){
      fetch(SB2_URL+'/rest/v1/v2_memo_notes?id=eq.'+_currentNoteId+'&couple_id=eq.'+coupleId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({text:txt,title:ttl,updated_at:new Date().toISOString()})}).then(done).catch(done);
    } else {
      if(!txt) return done();
      fetch(SB2_URL+'/rest/v1/v2_memo_notes',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({couple_id:coupleId,text:txt,title:ttl})}).then(function(){ _loadMemoFull(); done(); }).catch(done);
    }
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
          row.innerHTML='<div class="todo-check'+(item.done?' done':'')+'">'+(item.done?'✓':'')+'</div><div class="todo-text'+(item.done?' done':'')+'">'+escHtml(item.text)+'</div><div class="todo-del">✕</div>';
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
    fetch(SB2_URL+'/rest/v1/v2_memo_todos',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({couple_id:coupleId,text:txt,done:false})}).then(_loadTodoFull);
  };

  // Fermer en cliquant dehors
  setTimeout(function(){
    var mm = document.getElementById('memoPopupModal');
    if(mm) mm.addEventListener('click',function(e){ if(e.target===mm) window.closeMemoPopup(); });
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
    return card;
  }

  // Rouage → ouvre directement la liste complète (plus de sheet intermédiaire)
  window.nousOpenSouvenirGestion = function(){
    if(!_souvenirAllRows.length){ window.nousLoadSouvenirs(); }
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
    document.body.style.overflow='hidden';
  };

  window.nousCloseSouvenirGestion = function(){
    var overlay=document.getElementById('souvenirGestionOverlay');
    if(overlay) overlay.classList.remove('open');
    document.body.style.overflow='';
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
      row.querySelector('.souvenir-gestion-photo').addEventListener('click',function(){ nousOpenSouvenirModal(s); window.nousCloseSouvenirGestion(); });
      row.querySelector('.souvenir-gestion-info').addEventListener('click',function(){ nousOpenSouvenirModal(s); window.nousCloseSouvenirGestion(); });
      list.appendChild(row);
    });
  }

  window.nousOpenSouvenirModal = function(souvenir){
    var isNew=!souvenir;
    var modal=document.getElementById('souvenirModal'); if(!modal) return;
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
    var done=function(){ if(saveBtn){ saveBtn.textContent='Sauvegarder'; saveBtn.disabled=false; } window.closeSouvenirModal(); window.nousLoadSouvenirs(); };
    if(id){
      fetch(SB2_URL+'/rest/v1/v2_memories?id=eq.'+id,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)}).then(done).catch(done);
    } else {
      fetch(SB2_URL+'/rest/v1/v2_memories',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)}).then(done).catch(done);
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
// 13. ACTIVITÉS
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

  window.nousLoadActivites=function(){
    var coupleId=_getCoupleId(); if(!coupleId) return;
    var container=document.getElementById('activitesContainer'); if(!container) return;
    container.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px;">Chargement...</div>';
    fetch(SB2_URL+'/rest/v1/v2_activites?couple_id=eq.'+coupleId+'&order=created_at.desc&select=*',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      container.innerHTML='';
      var dayOfYear=Math.floor((Date.now()-new Date(new Date().getFullYear(),0,0))/(1000*60*60*24));
      var todaySuggested=ACTIVITES_SUGGEREES[dayOfYear%ACTIVITES_SUGGEREES.length];
      var alreadyAdded=rows.some(function(r){ return r.title===todaySuggested.titre; });
      if(!alreadyAdded){
        var suggCard=document.createElement('div'); suggCard.className='activite-sugg-card';
        suggCard.innerHTML='<div class="activite-sugg-badge">Idée du jour</div>'+
          '<div class="activite-header"><span class="activite-emoji">'+todaySuggested.emoji+'</span><div class="activite-info"><div class="activite-titre">'+escHtml(todaySuggested.titre)+'</div><div class="activite-desc">'+escHtml(todaySuggested.desc)+'</div></div></div>'+
          '<button class="activite-add-btn" onclick="nousAddSuggestedActivite()">Ajouter à nos activités</button>';
        suggCard.dataset.sugg=JSON.stringify(todaySuggested);
        container.appendChild(suggCard);
      }
      var newBtn=document.createElement('button'); newBtn.className='activite-new-btn';
      newBtn.innerHTML='+ Créer une activité'; newBtn.addEventListener('click',function(){ nousOpenActiviteModal(null); });
      container.appendChild(newBtn);
      if(Array.isArray(rows)&&rows.length){ rows.forEach(function(act){ container.appendChild(_buildActiviteCard(act)); }); }
    }).catch(function(){ container.innerHTML='<div style="color:var(--muted);font-size:13px;padding:16px;">Erreur de chargement</div>'; });
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

  function _buildActiviteCard(act){
    var steps=[];
    try{ steps=JSON.parse(act.steps||'[]'); }catch(e){}
    var total=steps.length; var done=steps.filter(function(s){ return s.done; }).length;
    var pct=total>0?Math.round(done/total*100):0;
    var card=document.createElement('div'); card.className='activite-card';
    var stepsDiv='';
    steps.forEach(function(s,i){
      stepsDiv+='<div class="activite-step'+(s.done?' done':'')+'" data-idx="'+i+'">'+
        '<div class="activite-step-check">'+(s.done?'✓':'')+'</div>'+
        '<div class="activite-step-text">'+escHtml(s.text)+'</div>'+
        '</div>';
    });
    card.innerHTML=
      '<div class="activite-card-header">'+
      '<span class="activite-emoji">'+(act.emoji||'✨')+'</span>'+
      '<div class="activite-info">'+
      '<div class="activite-titre">'+escHtml(act.title||'Activité')+'</div>'+
      (act.description?'<div class="activite-desc">'+escHtml(act.description)+'</div>':'')+
      '</div>'+
      '<button class="activite-edit-btn">'+_gearSVG()+'</button>'+
      '</div>'+
      '<div class="activite-progress-wrap"><div class="activite-progress-bar"><div class="activite-progress-fill" style="width:'+pct+'%"></div></div><div class="activite-progress-txt">'+done+'/'+total+'</div></div>'+
      (stepsDiv?'<div class="activite-steps">'+stepsDiv+'</div>':'')+
      (pct===100?'<div class="activite-completed">Activité complétée !</div>':'');
    card.querySelector('.activite-edit-btn').addEventListener('click', function(){ window.nousOpenActiviteModal(act); });
    card.querySelectorAll('.activite-step').forEach(function(el){
      el.querySelector('.activite-step-check').addEventListener('click', function(){
        window.nousToggleStep(act.id, parseInt(el.dataset.idx));
      });
    });
    return card;
  }

  window.nousToggleStep=function(actId,stepIdx){
    var coupleId=_getCoupleId(); if(!coupleId) return;
    fetch(SB2_URL+'/rest/v1/v2_activites?id=eq.'+actId+'&couple_id=eq.'+coupleId+'&select=steps',{headers:sb2Headers()})
    .then(function(r){ return r.json(); })
    .then(function(rows){
      if(!rows||!rows[0]) return;
      var steps=[]; try{ steps=JSON.parse(rows[0].steps||'[]'); }catch(e){}
      if(steps[stepIdx]) steps[stepIdx].done=!steps[stepIdx].done;
      return fetch(SB2_URL+'/rest/v1/v2_activites?id=eq.'+actId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({steps:JSON.stringify(steps)})});
    }).then(function(){ window.nousLoadActivites(); }).catch(function(){});
  };

  window.nousOpenActiviteModal=function(act){
    var modal=document.getElementById('activiteModal'); if(!modal) return;
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

  window.closeActiviteModal=function(){
    var modal=document.getElementById('activiteModal'); if(modal) modal.classList.remove('open');
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

  var _activiteM=document.getElementById('activiteModal');
  if(_activiteM) _activiteM.addEventListener('click',function(e){ if(e.target===_activiteM) window.closeActiviteModal(); });

})();


// ════════════════════════════════════════════════════════════════════
// 14. HELPER — SVG rouage
// ════════════════════════════════════════════════════════════════════
function _gearSVG(){
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
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
  } else {
    window._nousContentLoaded = true;
    _nousInitAll();
  }
};
