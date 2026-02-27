// ═══════════════════════════════════════════════════════════════════════════
// app-nous.js — Section "Nous ♥" — Module complet v1.0
// Remplace app-love.js. Contient TOUT ce qui concerne le couple :
// Verrou accès · Profil Paired · Photos Elle/Lui · Raisons · Post-its
// Mémo · Likes · Badge NEW · Souvenirs · Activités
// ═══════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// 0. VERROU "NOUS ♥" — Code d'accès à la section
// ════════════════════════════════════════════════════════════════════
(function(){

  // Hash SHA-256 de "GROSCHANTIER" (uppercase)
  // echo -n "GROSCHANTIER" | shasum -a 256
  var NOUS_CODE_HASH = '6b509c876e4aad61e8f746975a55b3e353542b5b1f09f3cddee9aff49c6dd0b5';
  var NOUS_SESSION_KEY = 'yam_nous_unlocked';
  var NOUS_EXPIRY_MS   = 7 * 24 * 60 * 60 * 1000; // 7 jours

  // Calcule le vrai hash au premier appel (async)
  var _realHash = null;
  async function _computeHash(str) {
    var enc  = new TextEncoder().encode(str.toUpperCase());
    var buf  = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
  }

  // Initialiser le vrai hash au chargement
  _computeHash('GROSCHANTIER').then(function(h){ _realHash = h; });

  // ── Vérifier si la session de déverrouillage est encore valide ──
  function _nousIsUnlocked() {
    try {
      var data = JSON.parse(localStorage.getItem(NOUS_SESSION_KEY) || 'null');
      if (!data) return false;
      if (Date.now() > data.expires) { localStorage.removeItem(NOUS_SESSION_KEY); return false; }
      return true;
    } catch(e) { return false; }
  }

  // ── Sauvegarder la session de déverrouillage ──
  function _nousSaveUnlock() {
    localStorage.setItem(NOUS_SESSION_KEY, JSON.stringify({ expires: Date.now() + NOUS_EXPIRY_MS }));
  }

  // ── Afficher le verrou si non déverrouillé ──
  function nousCheckLock() {
    if (_nousIsUnlocked()) {
      _nousShowContent();
      return;
    }
    _nousShowLock();
  }

  function _nousShowLock() {
    var overlay = document.getElementById('nousLockOverlay');
    var content = document.getElementById('nousContentWrapper');
    if (overlay) overlay.style.display = 'flex';
    if (content) content.style.display = 'none';
  }

  function _nousShowContent() {
    var overlay = document.getElementById('nousLockOverlay');
    var content = document.getElementById('nousContentWrapper');
    if (overlay) overlay.style.display = 'none';
    if (content) content.style.display = 'block';
    // Charger le contenu si pas encore fait
    if (!window._nousContentLoaded) {
      window._nousContentLoaded = true;
      _nousInitAll();
    }
  }

  // ── Valider le code ──
  window.nousCheckCode = async function() {
    if (!_realHash) { _realHash = await _computeHash('GROSCHANTIER'); }
    var input = document.getElementById('nousCodeInput');
    var errEl = document.getElementById('nousCodeError');
    if (!input) return;
    var val   = input.value.trim();
    var hash  = await _computeHash(val);
    if (hash === _realHash) {
      _nousSaveUnlock();
      input.value = '';
      if (errEl) errEl.style.display = 'none';
      // Animation de déverrouillage
      var lock = document.getElementById('nousLockOverlay');
      if (lock) { lock.style.transition = 'opacity 0.4s'; lock.style.opacity = '0'; setTimeout(_nousShowContent, 400); }
      else _nousShowContent();
    } else {
      if (errEl) { errEl.textContent = '❌ Code incorrect'; errEl.style.display = 'block'; input.value = ''; input.focus(); }
    }
  };

  // ── Écouter Enter dans l'input code ──
  document.addEventListener('DOMContentLoaded', function() {
    var inp = document.getElementById('nousCodeInput');
    if (inp) inp.addEventListener('keydown', function(e){ if (e.key === 'Enter') window.nousCheckCode(); });
  });

  // ── Exposer globalement ──
  window.nousCheckLock  = nousCheckLock;
  window._nousIsUnlocked = _nousIsUnlocked;

  // yamSwitchTab est patché dans index.html → appelle window.nousLoad()
  // nousLoad() appelle nousCheckLock() — pas besoin de re-patcher ici

  // Lancer au chargement si on est déjà sur l'onglet nous
  setTimeout(function(){
    if (window._currentTab === 'nous') nousCheckLock();
  }, 800);

})();


// ════════════════════════════════════════════════════════════════════
// 1. INIT CENTRALE — appelée une seule fois après déverrouillage
// ════════════════════════════════════════════════════════════════════
function _nousInitAll() {
  _nousLoadProfil();
  elleLoadImages();
  elleLoadDescs();
  elleSyncEditMode();
  luiLoadImages();
  luiLoadDescs();
  luiSyncEditMode();
  luiSyncDescs();
  _nousLoadBadge();
  loadLikeCounters();
  buildStack();
  // Memo
  var notesSlider = document.getElementById('memoNotesSlider');
  if (notesSlider) { renderNotes(); renderTodos(); }
  // Souvenirs
  nousLoadSouvenirs();
  // Activités
  nousLoadActivites();
  // Polling badge non-lus (messages)
  if (!window._checkUnreadStarted) {
    window._checkUnreadStarted = true;
    _startLockBadgePolling();
  }
  // Likes poll
  if (!window._likesIv) {
    window._likesIv = setInterval(loadLikeCounters, 5000);
  }
  // Fade-in observer
  document.querySelectorAll('#nousContentWrapper .fade-in').forEach(function(el){
    if (window._fadeObs) window._fadeObs.observe(el);
  });
}


// ════════════════════════════════════════════════════════════════════
// 2. PROFIL COUPLE — Style "Paired" (avatars en grand au centre)
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
  // Avatars
  var girlAv = document.getElementById('nousProfilGirlAvatar');
  var boyAv  = document.getElementById('nousProfilBoyAvatar');
  if (girlAv) { var gi = girlAv.querySelector('img'); if (gi) gi.src = window.yamAvatarSrc ? window.yamAvatarSrc('girl') : 'assets/images/profil_girl.png'; }
  if (boyAv)  { var bi = boyAv.querySelector('img');  if (bi) bi.src = window.yamAvatarSrc ? window.yamAvatarSrc('boy')  : 'assets/images/profil_boy.png'; }
  // Date couple
  var startDate = window.startDate || new Date('2024-10-29T00:00:00');
  var now = new Date();
  var diffMs = now - startDate;
  var days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  var el2 = document.getElementById('nousProfilDays');
  if (el2) el2.textContent = days + ' jour' + (days > 1 ? 's' : '') + ' ensemble 💕';
}


// ════════════════════════════════════════════════════════════════════
// 3. BADGE "NEW" sur l'icône Nous
// ════════════════════════════════════════════════════════════════════
function _nousLoadBadge() {
  // On marque "vu" les nouveautés quand on ouvre la section
  var KEY = 'yam_nous_last_seen_' + ((typeof v2GetUser==='function'&&v2GetUser()) ? v2GetUser().couple_id : 'x');
  localStorage.setItem(KEY, Date.now());
  var badge = document.getElementById('navNousBadge');
  if (badge) badge.style.display = 'none';
}

// Appelé depuis app-core ou autre pour signaler une nouveauté dans Nous
window.nousSignalNew = function() {
  var badge = document.getElementById('navNousBadge');
  if (badge && window._currentTab !== 'nous') badge.style.display = 'block';
};


// ════════════════════════════════════════════════════════════════════
// 4. SECTION ELLE — Upload Supabase Storage V2
// ════════════════════════════════════════════════════════════════════
(function(){
  var SB_BUCKET = 'images';
  var SB_FOLDER = 'elle';
  var SLOTS = ['animal','fleurs','personnage','saison','repas'];
  var ELLE_DESC_DEFAULTS = {
    animal:'Un regard doux 💫', fleurs:'Pleine de couleurs 💕', personnage:'Attachante 💍',
    saison:'Un rayon de soleil ☀️', repas:"N'aime que les pattes 🤝"
  };
  var _currentSlot = null;
  function _getElleSession(){ try{ var s=JSON.parse(localStorage.getItem('yam_v2_session')||'null'); return s&&s.user?s.user.couple_id:null; }catch(e){ return null; } }

  window.elleLoadImages = function(){
    SLOTS.forEach(function(slot){
      var url = SB2_URL + '/storage/v1/object/public/' + SB_BUCKET + '/' + SB_FOLDER + '/' + slot + '.jpg?t=' + Date.now();
      var img = document.getElementById('elle-img-' + slot);
      if(!img) return;
      if(img.src && img.src.indexOf('zjmbyjpxqrojnuymnpcf') !== -1) img.removeAttribute('src');
      var probe = new Image();
      probe.onload = function(){ img.src = url; };
      probe.onerror = function(){};
      probe.src = url;
    });
  };

  window.elleSyncEditMode = function(){
    var profile = getProfile();
    var isLink = (profile === 'boy');
    SLOTS.forEach(function(slot){
      var btn = document.getElementById('elle-btn-' + slot);
      if(btn) btn.style.display = isLink ? '' : 'none';
      var desc = document.getElementById('elle-desc-' + slot);
      if(desc){
        if(isLink) desc.classList.add('lui-desc-editable');
        else desc.classList.remove('lui-desc-editable');
      }
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
    fetch(SB2_URL+'/storage/v1/object/'+SB_BUCKET+'/'+SB_FOLDER+'/'+slot+'.jpg', {
      method:'POST', headers:Object.assign({'Content-Type':file.type,'x-upsert':'true'},sb2Headers()), body:file
    }).then(function(r){
      if(bar) bar.style.width='100%';
      return r.text().then(function(body){
        if(loading) loading.classList.remove('show');
        if(r.ok){ var img=document.getElementById('elle-img-'+slot); if(img) img.src=SB2_URL+'/storage/v1/object/public/'+SB_BUCKET+'/'+SB_FOLDER+'/'+slot+'.jpg?t='+Date.now(); }
        else alert('Erreur '+r.status+' : '+body);
      });
    }).catch(function(err){ if(loading) loading.classList.remove('show'); alert('Erreur réseau : '+err); });
  };

  function elleLoadDescs(){
    fetch(SB2_URL+'/rest/v1/v2_photo_descs?category=eq.elle&couple_id=eq.'+_getElleSession()+'&select=slot,description',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      if(!Array.isArray(rows)) return;
      rows.forEach(function(row){ var el=document.getElementById('elle-desc-'+row.slot); if(el&&row.description) el.textContent=row.description; });
    }).catch(function(){
      SLOTS.forEach(function(slot){ var saved=localStorage.getItem('elle_desc_'+slot); var el=document.getElementById('elle-desc-'+slot); if(el&&saved) el.textContent=saved; });
    });
  }
  window.elleLoadDescs = elleLoadDescs;

  function elleSaveDesc(slot,val){
    var coupleId=_getElleSession(); if(!coupleId) return;
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
  var SB_BUCKET='images', SB_FOLDER='lui';
  var SLOTS=['animal','fleurs','personnage','saison','repas'];
  var LUI_DESC_DEFAULTS={animal:'Son animal 🐾',fleurs:'Ses fleurs 🌸',personnage:'Son personnage 💙',saison:'Sa saison 🍂',repas:'Son repas préféré 🍽️'};
  var _currentSlot=null;
  function _getLuiSession(){ try{ var s=JSON.parse(localStorage.getItem('yam_v2_session')||'null'); return s&&s.user?s.user.couple_id:null; }catch(e){ return null; } }

  window.luiLoadImages=function(){
    SLOTS.forEach(function(slot){
      var url=SB2_URL+'/storage/v1/object/public/'+SB_BUCKET+'/'+SB_FOLDER+'/'+slot+'.jpg?t='+Date.now();
      var img=document.getElementById('lui-img-'+slot);
      var empty=document.getElementById('lui-empty-'+slot);
      var btn=document.getElementById('lui-btn-'+slot);
      if(!img) return;
      if(img.src&&img.src.indexOf('zjmbyjpxqrojnuymnpcf')!==-1) img.removeAttribute('src');
      var probe=new Image();
      probe.onload=function(){ img.src=url; img.style.display=''; if(empty) empty.style.display='none'; if(btn) btn.classList.remove('empty'); };
      probe.onerror=function(){ img.style.display='none'; if(empty) empty.style.display=''; if(btn) btn.classList.add('empty'); };
      probe.src=url;
    });
  };

  window.luiSyncEditMode=function(){
    var profile=getProfile(); var isZelda=(profile==='girl');
    SLOTS.forEach(function(slot){ var btn=document.getElementById('lui-btn-'+slot); if(btn) btn.style.display=isZelda?'':'none'; });
  };

  window.luiSyncDescs=function(){
    var profile=getProfile(); var isZelda=(profile==='girl');
    SLOTS.forEach(function(slot){ var el=document.getElementById('lui-desc-'+slot); if(!el) return; if(isZelda) el.classList.add('lui-desc-editable'); else el.classList.remove('lui-desc-editable'); });
  };

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
    fetch(SB2_URL+'/storage/v1/object/'+SB_BUCKET+'/'+SB_FOLDER+'/'+slot+'.jpg',{
      method:'POST',headers:Object.assign({'Content-Type':file.type,'x-upsert':'true'},sb2Headers()),body:file
    }).then(function(r){
      if(bar) bar.style.width='100%';
      return r.text().then(function(body){
        if(loading) loading.classList.remove('show');
        if(r.ok){
          var img=document.getElementById('lui-img-'+slot); var emptyEl=document.getElementById('lui-empty-'+slot); var btnEl=document.getElementById('lui-btn-'+slot);
          var newUrl=SB2_URL+'/storage/v1/object/public/'+SB_BUCKET+'/'+SB_FOLDER+'/'+slot+'.jpg?t='+Date.now();
          if(img){ img.src=newUrl; img.style.display=''; } if(emptyEl) emptyEl.style.display='none'; if(btnEl) btnEl.classList.remove('empty');
        } else alert('Erreur '+r.status+' : '+body);
      });
    }).catch(function(err){ if(loading) loading.classList.remove('show'); alert('Erreur réseau : '+err); });
  };

  window.luiLoadDescs=function(){
    fetch(SB2_URL+'/rest/v1/v2_photo_descs?category=eq.lui&couple_id=eq.'+_getLuiSession()+'&select=slot,description',{headers:sb2Headers()})
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
      var coupleId=_getLuiSession(); if(!coupleId) return;
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
var reasons = [
  "Ta personnalité. Elle est unique, elle est toi, et j'arrête pas de la découvrir 💫",
  "Le fait que tu te bats pour t'améliorer tout le temps. Ça me rend vraiment fier de toi 🌱",
  "Ta petite timidité qui donne envie de te mettre à l'aise pour toujours 🌸",
  "Ton sourire 😄",
  "J'aime bien tes lèvres 🫦",
  "Ton humour. T'as le don de me faire beaucoup rire avec tes bêtises 🤣",
  "Ta sensibilité. Quand tu ressens vraiment les choses, ça compte énormément 💓",
  "T'es mignonne. Dans tout ce que t'es, dans tout ce que tu fais 🌺",
  "Ton côté sage. T'as une façon de voir les choses qui me calme quand j'en ai besoin 🕊️",
  "La façon dont tu travailles sur toi — ça me pousse à faire pareil 🚀",
  "Ton cœur. T'as une façon d'aimer qui me touche vraiment au fond 💞",
  "Nos fous rires. Ces moments où on rit de rien pendant des heures — y'a rien de mieux 🥰",
  "Le fait que tu sois ma meilleure amie autant que mon amour 👫",
  "Le fait d'être toi, sans faire semblant. Juste toi. Et c'est tout ce qu'il faut ✨"
];

var _reasonDeck = [], _reasonDeckPos = 0;
function _buildDeck(excludeFirst){
  var deck=[]; for(var k=0;k<reasons.length;k++) deck.push(k);
  for(var j=deck.length-1;j>0;j--){ var r=Math.floor(Math.random()*(j+1)); var tmp=deck[j]; deck[j]=deck[r]; deck[r]=tmp; }
  if(excludeFirst!==undefined&&deck[0]===excludeFirst&&deck.length>1){ var swap=1+Math.floor(Math.random()*(deck.length-1)); var t=deck[0]; deck[0]=deck[swap]; deck[swap]=t; }
  return deck;
}

(function(){
  _reasonDeck=_buildDeck(); _reasonDeckPos=0;
  var i=_reasonDeck[_reasonDeckPos++];
  var rText=document.getElementById('reasonText');
  if(rText) rText.textContent=reasons[i];
})();

function showReason(idx){
  var rText=document.getElementById('reasonText'); if(!rText) return;
  rText.classList.remove('reason-in-down'); rText.classList.add('reason-out-up');
  setTimeout(function(){ rText.textContent=reasons[idx]; rText.classList.remove('reason-out-up'); void rText.offsetWidth; rText.classList.add('reason-in-down'); },200);
}

var _reasonAutoIv = null;
function _startReasonAuto(){
  if(_reasonAutoIv) return;
  _reasonAutoIv = setInterval(function(){
    if(window._currentTab !== 'nous') return;
    if(_reasonDeckPos>=_reasonDeck.length){ var last=_reasonDeck[_reasonDeck.length-1]; _reasonDeck=_buildDeck(last); _reasonDeckPos=0; }
    showReason(_reasonDeck[_reasonDeckPos++]);
  }, 6000);
}
_startReasonAuto();

(function(){
  var box = document.getElementById('reasonBox');
  if(!box) return;
  box.addEventListener('click', function(){
    if(_reasonDeckPos>=_reasonDeck.length){ var last=_reasonDeck[_reasonDeck.length-1]; _reasonDeck=_buildDeck(last); _reasonDeckPos=0; }
    showReason(_reasonDeck[_reasonDeckPos++]);
    // Réinitialiser le timer auto
    if(_reasonAutoIv){ clearInterval(_reasonAutoIv); _reasonAutoIv=null; }
    _startReasonAuto();
  });
})();


// ════════════════════════════════════════════════════════════════════
// 8. POST-ITS SWIPABLES
// ════════════════════════════════════════════════════════════════════
var postitData = [
  {color:'#1a3a2a',icon:'💪',title:'Fiers de nous',text:"Des débuts compliqués, des doutes, des gens contre nous... et on s'est renforcés à chaque fois."},
  {color:'#2a1a2e',icon:'🌸',title:"Merci d'être toi",text:"Merci pour ta patience, ton humour, et tous les efforts pour qu'on grandisse ensemble."},
  {color:'#1a2a3a',icon:'☀️',title:'Plus vivante',text:"T'as rendu ma vie plus simple, plus belle, plus vivante. T'es ma dose de bonheur quotidien."},
  {color:'#2a2216',icon:'👵',title:'Ma vieille dame préférée',text:"T'es ma meilleure amie, mon bonheur, mon monde. Celle avec qui tout devient plus léger."},
  {color:'#1a2a2a',icon:'⭐',title:'Mon repère',text:"T'es mon équilibre, la preuve qu'un vrai amour existe. Je veux tout partager avec toi."},
  {color:'#2a1a1a',icon:'🤗',title:'Mon jour préféré',text:"Le jour où je te prendrai dans mes bras et te serrerai si fort qu'on pourra plus respirer."},
  {color:'#1a1a2a',icon:'🌙',title:'80 ans main dans la main',text:"Nos délires de \"vieille dame ch'ti\", nos bêtises... Je veux encore rire comme ça à 80 ans. 💕"},
  {color:'#222222',icon:'💘',title:'Ma seule certitude',text:"T'es pas juste \"la personne que j'aime\". T'es la seule avec qui je veux construire ma vie."}
];

var annivPostitMessages=[
  null,
  "Un mois de plus à tes côtés... et j'en veux encore des centaines 💑",
  "Deux mois. Deux mois à sourire grâce à toi. J'espère ne jamais m'y habituer 🌸",
  "Trois mois ensemble — et déjà je sais plus comment c'était avant toi 🥺",
  "Quatre mois. Chaque journée avec toi est un cadeau que je garde précieusement 💝",
  "Cinq mois. T'es devenue une évidence dans ma vie, et c'est la plus belle des évidences ✨",
  "Six mois déjà. La moitié d'une année à être heureux — grâce à toi 🎂",
  "Sept mois. Je recompte parfois depuis le début juste pour me rappeler ma chance 💫",
  "Huit mois. Nos souvenirs s'accumulent et chacun d'eux me fait sourire 🌟",
  "Neuf mois. Je t'aime un peu plus fort qu'hier, et moins fort que demain 💞",
  "Dix mois. T'es mon endroit préféré au monde 🏠💕",
  "Onze mois. Presque un an... et pourtant ça me semble à peine commencé 🌙"
];

function getAnnivPostitText(months){
  if(months%12===0){ var years=months/12; if(years===1) return "Un an ensemble !! Boucle bouclée, mais notre histoire elle, ne fait que commencer 🎉💑"; if(years===2) return "Deux ans. Deux ans à construire quelque chose de vrai, de beau, de nous. Je t'aime 💍"; if(years===3) return "Trois ans. Trois ans que t'es ma meilleure décision 🥂✨"; return years+" ans ensemble. Je recommencerais mille fois 🎂💑"; }
  else if(months<12){ return annivPostitMessages[months]; }
  else { var m=months%12===0?12:months%12; var y=Math.floor(months/12); return y+" an"+(y>1?"s":"")+" et "+m+" mois. Chaque jour compte, et chaque jour t'es là 🩷"; }
}
window.getAnnivPostitText = getAnnivPostitText;

var rots=[-1.8,1.4,-0.9,2.0,-1.3,0.7,-2.2,1.1];
var stackIndex=0;

(function injectAnnivPostit(){
  var START=new Date(2024,9,29); var now=new Date();
  if(now.getDate()!==29) return;
  var months=(now.getFullYear()-START.getFullYear())*12+(now.getMonth()-START.getMonth());
  if(months<1) return;
  var msg=getAnnivPostitText(months);
  postitData.unshift({color:'#2a1a1a',icon:'🎂',title:'Bonne mensiversaire 🩷',text:msg,isAnniv:true});
  rots.unshift(0.4);
})();

function buildStack(){
  var stackWrap=document.getElementById('postitStack'); var stackCtr=document.getElementById('stackCounter');
  if(!stackWrap) return;
  stackWrap.innerHTML=''; var n=postitData.length;
  for(var i=0;i<n;i++){
    var dIdx=(stackIndex+n-1-i)%n; var dd=postitData[dIdx]; var depth=n-1-i;
    var el=document.createElement('div'); el.className='postit';
    el.style.zIndex=i+1;
    el.style.transform='translateY('+(depth*4)+'px) rotate('+rots[dIdx%rots.length]+'deg)';
    el.style.opacity=depth===0?'1':String(Math.max(0.38,1-depth*0.16));
    el.innerHTML='<div class="p-art" style="background:'+escHtml(dd.color)+'">'+dd.icon+'</div><div class="p-body"><div class="p-title">'+escHtml(dd.title)+'</div><div class="p-text">'+escHtml(dd.text)+'</div></div>';
    if(dd.isAnniv){ el.style.boxShadow='0 0 0 2px rgba(245,197,24,0.6), 0 8px 32px rgba(0,0,0,0.45)'; }
    stackWrap.appendChild(el);
  }
  if(stackCtr) stackCtr.textContent=(stackIndex+1)+' / '+n;
  var top=stackWrap.lastElementChild; if(top) _attachPostitEvents(top);
}
window.buildStack = buildStack;

function _dismissTop(dirX){
  var top=document.getElementById('postitStack').lastElementChild; if(!top||top._dismissing) return;
  top._dismissing=true; var angle=dirX>0?18:-18; var tx=dirX>0?'115%':'-115%';
  top.style.transition='transform 0.32s cubic-bezier(.4,0,.6,1), opacity 0.26s';
  top.style.transform='translateX('+tx+') rotate('+angle+'deg)'; top.style.opacity='0'; top.style.pointerEvents='none';
  stackIndex=(stackIndex+1)%postitData.length; setTimeout(buildStack,300);
}

function _attachPostitEvents(el){
  var startX,startY,dragging=false,moved=false; var baseRot=rots[stackIndex%rots.length];
  el.addEventListener('touchstart',function(e){ if(el._dismissing) return; var t=e.touches[0]; startX=t.clientX; startY=t.clientY; dragging=true; moved=false; el.style.transition='none'; },{passive:true});
  el.addEventListener('touchmove',function(e){ if(!dragging||el._dismissing) return; var t=e.touches[0]; var dx=t.clientX-startX; var dy=t.clientY-startY; if(Math.abs(dx)<4&&Math.abs(dy)<4) return; moved=true; if(Math.abs(dx)>Math.abs(dy)){ e.preventDefault(); var rot=baseRot+dx*0.06; var lift=Math.min(Math.abs(dx)*0.04,6); el.style.transform='translateX('+dx+'px) translateY(-'+lift+'px) rotate('+rot+'deg)'; el.style.opacity=String(Math.max(0.3,1-Math.abs(dx)/280)); } },{passive:false});
  el.addEventListener('touchend',function(e){ if(!dragging||el._dismissing) return; dragging=false; var t=e.changedTouches[0]; var dx=t.clientX-startX; var dy=t.clientY-startY; if(!moved){ _dismissTop(1); return; } if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>60){ _dismissTop(dx>0?1:-1); } else { el.style.transition='transform 0.3s cubic-bezier(.4,2,.55,.9), opacity 0.2s'; el.style.transform='translateY(0px) rotate('+baseRot+'deg)'; el.style.opacity='1'; } },{passive:true});
  el.addEventListener('mousedown',function(e){ if(el._dismissing) return; startX=e.clientX; startY=e.clientY; dragging=true; moved=false; el.style.transition='none'; el.style.cursor='grabbing'; });
  document.addEventListener('mousemove',function onMove(e){ if(!dragging||el._dismissing) return; var dx=e.clientX-startX; var dy=e.clientY-startY; if(Math.abs(dx)<4&&Math.abs(dy)<4) return; moved=true; var rot=baseRot+dx*0.06; var lift=Math.min(Math.abs(dx)*0.04,6); el.style.transform='translateX('+dx+'px) translateY(-'+lift+'px) rotate('+rot+'deg)'; el.style.opacity=String(Math.max(0.3,1-Math.abs(dx)/280)); el._onMove=onMove; });
  document.addEventListener('mouseup',function onUp(e){ if(!dragging||el._dismissing) return; dragging=false; el.style.cursor='pointer'; document.removeEventListener('mousemove',el._onMove); document.removeEventListener('mouseup',onUp); var dx=e.clientX-startX; var dy=e.clientY-startY; if(!moved){ _dismissTop(1); return; } if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>60){ _dismissTop(dx>0?1:-1); } else { el.style.transition='transform 0.3s cubic-bezier(.4,2,.55,.9), opacity 0.2s'; el.style.transform='translateY(0px) rotate('+baseRot+'deg)'; el.style.opacity='1'; } });
}


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
    var s=JSON.parse(localStorage.getItem('yam_v2_session')||'null'); var coupleId=s&&s.user?s.user.couple_id:null; if(!coupleId) return;
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
          var txt=(last&&last.text)?last.text:'💬 Nouveau message';
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
  var coupleId=null; try{ var s=JSON.parse(localStorage.getItem('yam_v2_session')||'null'); if(s&&s.user) coupleId=s.user.couple_id; }catch(e){}
  if(!coupleId) return;
  var numEl=document.getElementById(profile==='girl'?'likeNumGirl':'likeNumBoy');
  if(numEl){ var txt=(numEl.textContent||'0').trim(); var cur=0; if(txt.endsWith('M')) cur=parseFloat(txt)*1000000; else if(txt.endsWith('k')) cur=parseFloat(txt)*1000; else cur=parseInt(txt)||0; numEl.textContent=fmtLikes(cur+1); }
  fetch(SB2_URL+'/rest/v1/rpc/increment_like_counter',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},sb2Headers()),body:JSON.stringify({p_profile:profile,p_couple_id:coupleId})})
  .then(function(r){ if(!r.ok){ return r.text().then(function(txt){ loadLikeCounters(); }); } if(window.scheduleLikeSync) window.scheduleLikeSync(); })
  .catch(function(){ loadLikeCounters(); });
}
window.spawnHeart = spawnHeart;

function loadLikeCounters(){
  var coupleId=null; try{ var s=JSON.parse(localStorage.getItem('yam_v2_session')||'null'); if(s&&s.user) coupleId=s.user.couple_id; }catch(e){} if(!coupleId) return;
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
// 11. MÉMO COUPLE
// ════════════════════════════════════════════════════════════════════
(function(){
  var _MEMO_HASH='a586ffe3acf28484d17760d1ddaa2af699666c870aaaa66f8cfc826a528429ce';
  var memoUnlocked=false, memoCurrentNote=null;
  var NOTE_COLORS=['#1a3a2a','#2a1a2e','#1a2a3a','#2a2216','#1a2a2a','#2a1a1a','#1a1a2a','#222222'];
  var NOTE_ICONS=['💬','✍️','💌','📖','🌙','💭','✨','🎵'];

  async function _sha256(str){ var enc=new TextEncoder().encode(str.toUpperCase()); var buf=await crypto.subtle.digest('SHA-256',enc); return Array.from(new Uint8Array(buf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join(''); }

  var _authCb=null;
  function openMemoAuth(cb){
    _authCb=cb; var m=document.getElementById('memoAuthModal'); if(!m) return; m.classList.add('open');
    document.getElementById('memoAuthInput').value=''; document.getElementById('memoAuthErr').style.display='none';
    setTimeout(function(){ document.getElementById('memoAuthInput').focus(); },80);
  }
  window.closeMemoAuth=function(){ var m=document.getElementById('memoAuthModal'); if(m) m.classList.remove('open'); };

  var _memoFailCount=0, _memoBlocked=false;
  window.memoCheckAuth=async function(){
    if(_memoBlocked) return;
    var val=document.getElementById('memoAuthInput').value.trim().toUpperCase();
    var h=await _sha256(val);
    if(h===_MEMO_HASH){ _memoFailCount=0; window.closeMemoAuth(); if(_authCb){ _authCb(); _authCb=null; } }
    else{
      _memoFailCount++;
      document.getElementById('memoAuthInput').value=''; document.getElementById('memoAuthInput').focus();
      var errEl=document.getElementById('memoAuthErr');
      if(_memoFailCount>=5){ _memoBlocked=true; errEl.style.display='block'; errEl.textContent='⛔ Trop de tentatives — attends 30s'; document.getElementById('memoAuthInput').disabled=true; setTimeout(function(){ _memoBlocked=false; _memoFailCount=0; document.getElementById('memoAuthInput').disabled=false; errEl.style.display='none'; },30000); }
      else { errEl.style.display='block'; errEl.textContent='❌ Code incorrect, réessaie ! ('+_memoFailCount+'/5)'; }
    }
  };

  var inp=document.getElementById('memoAuthInput');
  if(inp) inp.addEventListener('keydown',function(e){ if(e.key==='Enter') window.memoCheckAuth(); });
  var modal=document.getElementById('memoAuthModal');
  if(modal) modal.addEventListener('click',function(e){ if(e.target===this) window.closeMemoAuth(); });

  window.memoRequestUnlock=function(){
    if(memoUnlocked){ memoLock(); return; }
    if(v2LoadSession()){ memoUnlock(); return; }
    openMemoAuth(function(){ memoUnlock(); });
  };

  function memoUnlock(){ memoUnlocked=true; document.getElementById('memoLockBadge').classList.add('unlocked'); document.getElementById('memoLockTxt').textContent='Verrouiller'; document.getElementById('memoTodoAddRow').style.display='flex'; renderNotes(); renderTodos(); }
  function memoLock(){ memoUnlocked=false; document.getElementById('memoLockBadge').classList.remove('unlocked'); document.getElementById('memoLockTxt').textContent='Modifier'; document.getElementById('memoTodoAddRow').style.display='none'; renderNotes(); renderTodos(); }

  function _getMemoSession(){ try{ var s=JSON.parse(localStorage.getItem('yam_v2_session')||'null'); return s&&s.user?s.user:null; }catch(e){ return null; } }

  function renderNotes(){
    var slider=document.getElementById('memoNotesSlider'); if(!slider) return;
    slider.innerHTML='<div class="memo-loading"><span class="spinner"></span>Chargement...</div>';
    var su=_getMemoSession(); var coupleId=su?su.couple_id:null; if(!coupleId){ slider.innerHTML='<div class="memo-notes-empty">Session introuvable.</div>'; return; }
    fetch(SB2_URL+'/rest/v1/v2_memo_notes?couple_id=eq.'+coupleId+'&order=created_at.desc',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(notes){
      slider.innerHTML='';
      var addCard=document.createElement('div'); addCard.className='memo-note-add-card'+(memoUnlocked?' visible':'');
      addCard.innerHTML='<div class="memo-note-add-img"><div class="memo-note-add-icon">+</div><div class="memo-note-add-lbl">Nouvelle note</div></div>';
      addCard.addEventListener('click',function(){ openMemoModal(null,true); }); slider.appendChild(addCard);
      if(!Array.isArray(notes)||!notes.length){ var empty=document.createElement('div'); empty.className='memo-notes-empty'; empty.textContent=memoUnlocked?'Aucune note — ajoute-en une !':'Aucune note pour l\'instant.'; slider.appendChild(empty); return; }
      notes.forEach(function(note,i){
        var col=NOTE_COLORS[i%NOTE_COLORS.length], icon=NOTE_ICONS[i%NOTE_ICONS.length];
        var prev=(note.text||'').substring(0,40)+((note.text||'').length>40?'…':'');
        var d=new Date(note.updated_at||note.created_at); var ds=d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
        var isRecentlyModified=note.updated_at&&note.updated_at!==note.created_at&&(Date.now()-new Date(note.updated_at).getTime())<6*60*60*1000;
        var newBadge=isRecentlyModified?'<div class="memo-note-new-badge">new</div>':'';
        var card=document.createElement('div'); card.className='memo-note-card';
        card.innerHTML='<div class="memo-note-img" style="background:'+col+'"><div class="memo-note-bg">'+icon+'</div>'+newBadge+'<div class="memo-note-date-badge">'+escHtml(ds)+'</div><div class="memo-note-banner">'+escHtml(note.title||'Note')+'</div></div><div class="memo-note-preview">'+escHtml(prev)+'</div>';
        (function(n){ card.addEventListener('click',function(){ openMemoModal(n,false); }); })(note);
        slider.appendChild(card);
      });
    }).catch(function(err){ console.error('renderNotes error',err); document.getElementById('memoNotesSlider').innerHTML='<div class="memo-notes-empty">❌ Erreur de connexion Supabase.</div>'; });
  }
  window.renderNotes = renderNotes;

  function openMemoModal(note,isNew){
    memoCurrentNote=note;
    if(memoUnlocked){ document.getElementById('memoModalView').style.display='none'; document.getElementById('memoModalEdit').style.display='block'; document.getElementById('memoModalTitleInput').value=isNew?'':(note.title||''); document.getElementById('memoModalTextarea').value=isNew?'':(note.text||''); document.getElementById('memoModalDelBtn').style.display=isNew?'none':'block'; }
    else { document.getElementById('memoModalView').style.display='block'; document.getElementById('memoModalEdit').style.display='none'; document.querySelector('.memo-modal-label').textContent=note&&note.title?note.title:'Note'; document.getElementById('memoModalContent').textContent=note?(note.text||'(vide)'):''; var modDate=note?(note.updated_at||note.created_at):Date.now(); var d=new Date(modDate); var isUpdated=note&&note.updated_at&&note.updated_at!==note.created_at; document.getElementById('memoModalDate').textContent=(isUpdated?'Modifié le ':'Créé le ')+d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }
    document.getElementById('memoModal').classList.add('open');
  }
  window.closeMemoModal=function(){ document.getElementById('memoModal').classList.remove('open'); memoCurrentNote=null; var lbl=document.querySelector('.memo-modal-label'); if(lbl) lbl.textContent='Note'; };
  var mm=document.getElementById('memoModal'); if(mm) mm.addEventListener('click',function(e){ if(e.target===this) window.closeMemoModal(); });

  window.memoSaveNote=function(){
    var txt=document.getElementById('memoModalTextarea').value.trim(); var ttl=document.getElementById('memoModalTitleInput').value.trim()||'Sans titre'; if(!txt) return;
    var su=_getMemoSession(); var coupleId=su?su.couple_id:null; if(!coupleId) return;
    var btn=document.querySelector('.memo-modal-save'); btn.textContent='⏳'; btn.disabled=true;
    var done=function(){ btn.textContent='Sauvegarder 💾'; btn.disabled=false; window.closeMemoModal(); renderNotes(); };
    if(memoCurrentNote&&memoCurrentNote.id){
      fetch(SB2_URL+'/rest/v1/v2_memo_notes?id=eq.'+memoCurrentNote.id+'&couple_id=eq.'+coupleId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({text:txt,title:ttl,updated_at:new Date().toISOString()})}).then(done).catch(done);
    } else {
      fetch(SB2_URL+'/rest/v1/v2_memo_notes',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({couple_id:coupleId,text:txt,title:ttl})}).then(done).catch(done);
    }
  };
  window.memoDeleteNote=function(){
    if(!memoCurrentNote||!memoCurrentNote.id){ window.closeMemoModal(); return; }
    var su=_getMemoSession(); var coupleId=su?su.couple_id:null; if(!coupleId) return;
    fetch(SB2_URL+'/rest/v1/v2_memo_notes?id=eq.'+memoCurrentNote.id+'&couple_id=eq.'+coupleId,{method:'DELETE',headers:sb2Headers()}).then(function(){ window.closeMemoModal(); renderNotes(); });
  };

  function renderTodos(){
    var container=document.getElementById('memoTodoList'); if(!container) return;
    container.innerHTML='<div class="memo-loading"><span class="spinner"></span>Chargement...</div>';
    var su=_getMemoSession(); var coupleId=su?su.couple_id:null; if(!coupleId){ container.innerHTML='<div class="todo-empty">Session introuvable.</div>'; return; }
    fetch(SB2_URL+'/rest/v1/v2_memo_todos?couple_id=eq.'+coupleId+'&order=created_at.asc',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(items){
      container.innerHTML='';
      if(!Array.isArray(items)||!items.length){ var empty=document.createElement('div'); empty.className='todo-empty'; empty.textContent=memoUnlocked?'Aucun item — ajoute-en un !':'La to-do est vide.'; container.appendChild(empty); return; }
      items.forEach(function(item){
        var row=document.createElement('div'); row.className='todo-item';
        row.innerHTML='<div class="todo-check'+(item.done?' done':'')+'">'+(item.done?'✓':'')+'</div><div class="todo-text'+(item.done?' done':'')+'">'+escHtml(item.text)+'</div>'+(memoUnlocked?'<div class="todo-del">✕</div>':'');
        (function(it){ 
          row.querySelector('.todo-check').addEventListener('click',function(){ 
            fetch(SB2_URL+'/rest/v1/v2_memo_todos?id=eq.'+it.id+'&couple_id=eq.'+coupleId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({done:!it.done})}).then(renderTodos); 
          }); 
          var del=row.querySelector('.todo-del'); 
          if(del) del.addEventListener('click',function(e){ e.stopPropagation(); fetch(SB2_URL+'/rest/v1/v2_memo_todos?id=eq.'+it.id+'&couple_id=eq.'+coupleId,{method:'DELETE',headers:sb2Headers()}).then(renderTodos); }); 
        })(item);
        container.appendChild(row);
      });
    }).catch(function(err){ console.error('renderTodos error',err); document.getElementById('memoTodoList').innerHTML='<div class="todo-empty">❌ Erreur Supabase.</div>'; });
  }
  window.renderTodos = renderTodos;

  window.memoAddTodoItem=function(){
    var input=document.getElementById('memoTodoInput'), txt=input.value.trim(); if(!txt) return; input.value='';
    var su=_getMemoSession(); var coupleId=su?su.couple_id:null; if(!coupleId) return;
    fetch(SB2_URL+'/rest/v1/v2_memo_todos',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({couple_id:coupleId,text:txt,done:false})}).then(renderTodos);
  };
  var tdi=document.getElementById('memoTodoInput'); if(tdi) tdi.addEventListener('keydown',function(e){ if(e.key==='Enter') window.memoAddTodoItem(); });

  // renderNotes/renderTodos sont appelés via memoUnlock() ou _nousInitAll()
  // Ne pas appeler ici directement (session pas encore dispo)
})();


// ════════════════════════════════════════════════════════════════════
// 12. SOUVENIRS
// ════════════════════════════════════════════════════════════════════
(function(){

  function _getCoupleId(){ try{ var s=JSON.parse(localStorage.getItem('yam_v2_session')||'null'); return s&&s.user?s.user.couple_id:null; }catch(e){ return null; } }

  // Cache local des souvenirs
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
    var recent5 = rows.slice(0,5);
    var recent5ids = recent5.map(function(s){ return s.id; });
    var favs = rows.filter(function(s){ return s.is_fav && recent5ids.indexOf(s.id)===-1; }).slice(0,5);
    if(recent5.length){
      recentRow.style.display='block';
      recent5.forEach(function(s){ recentScroll.appendChild(_buildSouvenirCard(s)); });
    } else { recentRow.style.display='none'; }
    if(favs.length){
      favRow.style.display='block';
      favs.forEach(function(s){ favScroll.appendChild(_buildSouvenirCard(s)); });
    } else { favRow.style.display='none'; }
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

  window.nousOpenSouvenirGestion = function(){
    var overlay=document.getElementById('souvenirGestionOverlay'); if(!overlay) return;
    if(!_souvenirAllRows.length){ window.nousLoadSouvenirs(); }
    _renderGestionList();
    overlay.classList.add('open');
    document.body.style.overflow='hidden';
  };

  window.nousCloseSouvenirGestion = function(){
    var overlay=document.getElementById('souvenirGestionOverlay');
    if(overlay) overlay.classList.remove('open');
    document.body.style.overflow='';
  };


  function _renderGestionList(){
    var list=document.getElementById('souvenirGestionList'); if(!list) return;
    list.innerHTML='';
    if(!_souvenirAllRows.length){
      list.innerHTML='<div style="text-align:center;color:var(--muted);font-size:13px;padding:32px;">Aucun souvenir pour l\'instant &#127775;</div>';
      return;
    }
    var heartFilled='<svg width="22" height="22" viewBox="0 0 24 24" fill="#e879a0" stroke="#e879a0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    var heartEmpty='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    _souvenirAllRows.forEach(function(s){
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
      row.querySelector('.souvenir-gestion-photo').addEventListener('click',function(){ nousOpenSouvenirModal(s); nousCloseSouvenirGestion(); });
      row.querySelector('.souvenir-gestion-info').addEventListener('click',function(){ nousOpenSouvenirModal(s); nousCloseSouvenirGestion(); });
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
      photoPreview.innerHTML=souvenir&&souvenir.photo_url?'':' <div style="font-size:24px;color:var(--muted);">&#128247;</div><div style="font-size:11px;color:var(--muted);margin-top:4px;">Ajouter une photo</div>';
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
    }).catch(function(){ if(preview) preview.innerHTML='<div style="font-size:11px;color:#e05555;">Erreur reseau</div>'; });
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
      fetch(SB2_URL+'/rest/v1/v2_memories?id=eq.'+id,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)})
      .then(done).catch(done);
    } else {
      fetch(SB2_URL+'/rest/v1/v2_memories',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)})
      .then(done).catch(done);
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

  function _getCoupleId(){ try{ var s=JSON.parse(localStorage.getItem('yam_v2_session')||'null'); return s&&s.user?s.user.couple_id:null; }catch(e){ return null; } }

  window.nousLoadActivites=function(){
    var coupleId=_getCoupleId(); if(!coupleId) return;
    var container=document.getElementById('activitesContainer'); if(!container) return;
    container.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px;">Chargement...</div>';
    fetch(SB2_URL+'/rest/v1/v2_activites?couple_id=eq.'+coupleId+'&order=created_at.desc&select=*',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      container.innerHTML='';
      // Activités suggérées du jour (rotation selon le jour de l'année)
      var dayOfYear=Math.floor((Date.now()-new Date(new Date().getFullYear(),0,0))/(1000*60*60*24));
      var todaySuggested=ACTIVITES_SUGGEREES[dayOfYear%ACTIVITES_SUGGEREES.length];
      // Vérifier si déjà ajoutée
      var alreadyAdded=rows.some(function(r){ return r.title===todaySuggested.titre; });
      if(!alreadyAdded){
        var suggCard=document.createElement('div'); suggCard.className='activite-sugg-card';
        suggCard.innerHTML='<div class="activite-sugg-badge">💡 Idée du jour</div>'+
          '<div class="activite-header"><span class="activite-emoji">'+todaySuggested.emoji+'</span><div class="activite-info"><div class="activite-titre">'+escHtml(todaySuggested.titre)+'</div><div class="activite-desc">'+escHtml(todaySuggested.desc)+'</div></div></div>'+
          '<button class="activite-add-btn" onclick="nousAddSuggestedActivite()">Ajouter à nos activités ✨</button>';
        suggCard.dataset.sugg=JSON.stringify(todaySuggested);
        container.appendChild(suggCard);
      }
      // Bouton nouvelle activité personnalisée
      var newBtn=document.createElement('button'); newBtn.className='activite-new-btn';
      newBtn.innerHTML='+ Créer une activité personnalisée'; newBtn.addEventListener('click',function(){ nousOpenActiviteModal(null); });
      container.appendChild(newBtn);
      // Activités existantes
      if(Array.isArray(rows)&&rows.length){ rows.forEach(function(act){ container.appendChild(_buildActiviteCard(act)); }); }
    }).catch(function(){ container.innerHTML='<div style="color:var(--muted);font-size:13px;padding:16px;">❌ Erreur de chargement</div>'; });
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
    // Construire le HTML sans JSON.stringify dans onclick
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
      '<button class="activite-edit-btn">✏️</button>'+
      '</div>'+
      '<div class="activite-progress-wrap"><div class="activite-progress-bar"><div class="activite-progress-fill" style="width:'+pct+'%"></div></div><div class="activite-progress-txt">'+done+'/'+total+'</div></div>'+
      (stepsDiv?'<div class="activite-steps">'+stepsDiv+'</div>':'')+
      (pct===100?'<div class="activite-completed">🎉 Activité complétée !</div>':'');
    // Event listeners propres — évite le crash JSON dans onclick HTML
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
    document.getElementById('activiteModalTitle').textContent=isNew?'Nouvelle activité ✨':'Modifier l\'activité';
    document.getElementById('activiteInputTitre').value=isNew?'':(act.title||'');
    document.getElementById('activiteInputDesc').value=isNew?'':(act.description||'');
    document.getElementById('activiteInputEmoji').value=isNew?'✨':(act.emoji||'✨');
    // Steps
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
    var btn=document.getElementById('activiteSaveBtn'); if(btn){ btn.textContent='⏳'; btn.disabled=true; }
    var done2=function(){ if(btn){ btn.textContent='Sauvegarder 💾'; btn.disabled=false; } window.closeActiviteModal(); window.nousLoadActivites(); };
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

  // Fermer en cliquant dehors (direct — DOM déjà prêt quand app-nous.js s'exécute)
  var _activiteM=document.getElementById('activiteModal');
  if(_activiteM) _activiteM.addEventListener('click',function(e){ if(e.target===_activiteM) window.closeActiviteModal(); });

})();


// ════════════════════════════════════════════════════════════════════
// 14. SETPROFILE HOOK — resync édit modes sur changement de profil
// ════════════════════════════════════════════════════════════════════
(function(){
  var _origSetProfile = window.setProfile;
  window.setProfile = function(gender){
    if(_origSetProfile) _origSetProfile.apply(this, arguments);
    setTimeout(function(){
      if(typeof elleSyncEditMode === 'function') elleSyncEditMode();
      if(typeof luiSyncEditMode  === 'function') luiSyncEditMode();
      if(typeof luiSyncDescs     === 'function') luiSyncDescs();
      if(typeof _nousLoadProfil  === 'function') _nousLoadProfil();
    }, 300);
  };
})();


// ════════════════════════════════════════════════════════════════════
// 15. EXPOSITION GLOBALE pour yamSwitchTab
// ════════════════════════════════════════════════════════════════════
window.nousLoad = function(){
  if(window._nousIsUnlocked && window._nousIsUnlocked()){
    if(window._nousContentLoaded) {
      // Refresh léger à chaque retour sur l'onglet
      loadLikeCounters();
      if(typeof window.nousLoadSouvenirs==='function') window.nousLoadSouvenirs();
      if(typeof window.nousLoadActivites==='function') window.nousLoadActivites();
      if(typeof window.renderNotes==='function') window.renderNotes();
      if(typeof window.renderTodos==='function') window.renderTodos();
    } else {
      window._nousContentLoaded = true;
      _nousInitAll();
    }
  } else {
    nousCheckLock();
  }
};
