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
// #98 — PROGRESSION DES SECTIONS (Le Nid)
// Ordre : mémo → petits mots → souvenirs → activités → bibliothèque
// Chaque section remplie déverrouille la suivante.
// Stocké dans photo_descs (category='nous_progress', slot='nest')
// ════════════════════════════════════════════════════════════════════
var _NID_IDS    = ['memoCoupleSection','postitsSection','souvenirsSection','activitesSection','Books'];
var _NID_NAMES  = {memoCoupleSection:'Mémo',postitsSection:'Petits mots',souvenirsSection:'Souvenirs',activitesSection:'Activités',Books:'Bibliothèque'};
var _NID_DATA   = null; // {unlocked:[], milestones_claimed:[]}
var _NID_ROW_ID = null;

function _nidCid(){ var u=(typeof yamGetUser==='function')?yamGetUser():null; return u?u.couple_id:null; }

function _nidLoad(cb){
  var cid=_nidCid();
  if(!cid){ _NID_DATA={unlocked:['memoCoupleSection'],milestones_claimed:[]}; if(cb) cb(); return; }
  fetch(SB_URL+'/rest/v1/photo_descs?couple_id=eq.'+cid+'&category=eq.nous_progress&slot=eq.nest&limit=1',{headers:sb2Headers()})
    .then(function(r){return r.ok?r.json():[];})
    .then(function(rows){
      if(rows&&rows[0]){ _NID_ROW_ID=rows[0].id; try{_NID_DATA=JSON.parse(rows[0].description||'{}');}catch(e){_NID_DATA={};} }
      else { _NID_ROW_ID=null; _NID_DATA={}; }
      if(!Array.isArray(_NID_DATA.unlocked)) _NID_DATA.unlocked=[];
      if(!_NID_DATA.milestones_claimed) _NID_DATA.milestones_claimed=[];
      if(cb) cb();
    }).catch(function(){ _NID_DATA={unlocked:['memoCoupleSection'],milestones_claimed:[]}; if(cb) cb(); });
}

function _nidSave(){
  var cid=_nidCid(); if(!cid||!_NID_DATA) return;
  var body={couple_id:cid,category:'nous_progress',slot:'nest',description:JSON.stringify(_NID_DATA)};
  if(_NID_ROW_ID){
    fetch(SB_URL+'/rest/v1/photo_descs?id=eq.'+_NID_ROW_ID,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(body)});
  } else {
    fetch(SB_URL+'/rest/v1/photo_descs',{method:'POST',headers:sb2Headers({'Prefer':'return=representation','Content-Type':'application/json'}),body:JSON.stringify(body)})
      .then(function(r){return r.ok?r.json():[];}).then(function(rows){if(rows&&rows[0])_NID_ROW_ID=rows[0].id;});
  }
}

// Appliquer l'état visuel de chaque section
function _nidApply(){
  if(!_NID_DATA) return;
  var unlocked=_NID_DATA.unlocked||[];
  var nextIdx=unlocked.length;

  // Nettoyer l'ancien label flottant (position:fixed sur body)
  var oldFloat=document.getElementById('nidPeekFloat');
  if(oldFloat) { oldFloat.remove(); window._nidFloatRaf && cancelAnimationFrame(window._nidFloatRaf); }

  _NID_IDS.forEach(function(id,i){
    var el=document.getElementById(id); if(!el) return;
    el.classList.remove('nid-peek','nid-hidden','nid-peek-pulse');
    // Supprimer ancien label inline
    var oldLbl=el.querySelector('.nid-peek-lbl'); if(oldLbl) oldLbl.remove();

    if(unlocked.indexOf(id)!==-1){
      el.style.display='';
    } else if(i===nextIdx){
      // Peek : flou+dégradé sur la section
      el.style.display='';
      el.classList.add('nid-peek');
      el.classList.add('nid-peek-pulse'); // légère pulsation visuelle
      // Label injecté sur document.body en position:fixed
      // → échappe au backdrop-filter de ::before
      _nidCreateFloatLabel(el, _NID_IDS[i-1]);
    } else {
      el.classList.add('nid-hidden');
    }
  });

  _nidRefreshBar();
}

// Label fixe sur le body, repositionné en RAF au scroll
function _nidCreateFloatLabel(section, prevId) {
  var lbl = document.createElement('div');
  lbl.id = 'nidPeekFloat';
  lbl.className = 'nid-peek-lbl-fixed';
  var prevName = _NID_NAMES[prevId] || 'la section précédente';
  lbl.textContent = 'Remplissez "' + prevName + '" pour débloquer';
  document.body.appendChild(lbl);

  function _place() {
    var sr = section.getBoundingClientRect();
    var lw = lbl.offsetWidth || 240;
    var lh = lbl.offsetHeight || 34;
    var navH = 72; // nav bar height + marge

    // Centré horizontalement sur la section
    lbl.style.left = Math.round(sr.left + sr.width / 2 - lw / 2) + 'px';

    // Positionné dans la section, jamais sous la nav
    var ideal = Math.round(sr.bottom - 44);
    var max   = window.innerHeight - navH - lh;
    lbl.style.top = Math.min(ideal, max) + 'px';

    // Visible seulement si la section est dans le viewport (au-dessus de la nav)
    var inView = sr.bottom > 40 && sr.top < (window.innerHeight - navH);
    lbl.style.display = inView ? '' : 'none';

    window._nidFloatRaf = requestAnimationFrame(_place);
  }
  _place();
}



// Signal : une section vient d'être remplie pour la première fois
window._nousSignalNewContent = function(sectionId){
  if(!_NID_DATA){ _nidLoad(function(){ window._nousSignalNewContent(sectionId); }); return; }
  if(_NID_DATA.unlocked.indexOf(sectionId)!==-1) return; // déjà fait

  _NID_DATA.unlocked.push(sectionId);
  _nidSave();

  // Révéler avec animation
  var el=document.getElementById(sectionId);
  if(el){
    el.classList.remove('nid-peek','nid-hidden');
    var lbl=el.querySelector('.nid-peek-lbl'); if(lbl) lbl.remove();
    el.style.display='';
    el.classList.add('nid-reveal');
    setTimeout(function(){ el.classList.remove('nid-reveal'); },600);
    var name=_NID_NAMES[sectionId]||sectionId;
    if(typeof showToast==='function') showToast('"'+name+'" débloquée ✨','success');
  }

  // La nouvelle section suivante passe en peek
  _nidApply();
  _nidMilestones();
  // Relancer la détection pour débloquer la section suivante en cascade
  // (ex: activitesSection vient d'être débloquée → détecter Books immédiatement)
  setTimeout(_nidAutoDetect, 300);
};

// Barre de progression avec paliers nommés
function _nidPct(){
  if(!_NID_DATA||!_NID_IDS.length) return 0;
  var cnt=_NID_IDS.filter(function(id){ return _NID_DATA.unlocked.indexOf(id)!==-1; }).length;
  return Math.round((cnt/_NID_IDS.length)*100);
}

function _nidRefreshBar(){
  var bar=document.getElementById('nousNestBar'); if(!bar) return;
  // Ne pas réafficher si déjà complété définitivement
  if(_NID_DATA && _NID_DATA.completed) { bar.style.display='none'; return; }
  var pct=_nidPct();
  var fill=bar.querySelector('.nid-bar-fill');
  var pctEl=bar.querySelector('.nid-bar-pct');
  if(fill) fill.style.width=pct+'%';
  if(pctEl) pctEl.textContent=pct+'%';
  // Paliers : allumer chaque section déverrouillée
  var unlocked=_NID_DATA?_NID_DATA.unlocked:['memoCoupleSection'];
  bar.querySelectorAll('.nid-milestone').forEach(function(m){
    m.classList.toggle('done', unlocked.indexOf(m.dataset.id)!==-1);
  });
  bar.style.display='block';
}
window._nousUpdateNestBar=_nidRefreshBar;

function _nidInjectBar(){
  var wrapper=document.getElementById('nousContentWrapper');
  if(!wrapper||document.getElementById('nousNestBar')) return;
  var bar=document.createElement('div');
  bar.id='nousNestBar';
  bar.className='nous-nest-bar';
  bar.style.display='none';
  // Créer les paliers avec les vrais noms des sections
  var milestonesHtml='';
  _NID_IDS.forEach(function(id){
    milestonesHtml+='<div class="nid-milestone" data-id="'+id+'"><div class="nid-milestone-dot"></div><div class="nid-milestone-name">'+_NID_NAMES[id]+'</div></div>';
  });
  bar.innerHTML=
    '<div class="nid-bar-header"><span class="nid-bar-title">Votre espace</span><span class="nid-bar-pct">0%</span></div>'+
    '<div class="nid-bar-track"><div class="nid-bar-fill"></div></div>'+
    '<div class="nid-bar-milestones">'+milestonesHtml+'</div>';
  // Insérer après nousProfilSection
  var profil=document.getElementById('nousProfilSection');
  if(profil&&profil.nextSibling) wrapper.insertBefore(bar,profil.nextSibling);
  else wrapper.insertBefore(bar,wrapper.firstChild);
}

// Toast de progression — affiché en HAUT pour ne pas se superposer au toast flamme
function _nidShowToast(msg) {
  var t = document.getElementById('nidToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'nidToast';
    document.body.appendChild(t);
  }
  clearTimeout(t._timer);
  t.textContent = msg;
  t.classList.add('show');
  t._timer = setTimeout(function() {
    t.classList.remove('show');
  }, 3200);
}

function _nidMilestones(){
  var pct=_nidPct();
  var claimed=_NID_DATA.milestones_claimed||[];
  [25,50,75,100].forEach(function(m){
    if(pct>=m&&claimed.indexOf(m)===-1){
      claimed.push(m); _NID_DATA.milestones_claimed=claimed; _nidSave();
      setTimeout(function(){
        if(typeof window.yamFlameActivity==='function') window.yamFlameActivity('nest_milestone');
        var msgs={
          25: '✨ 20% — Mémo débloqué !',
          50: '✨ 40% — Petits mots débloqués !',
          75: '✨ 60% — Souvenirs débloqués !',
          100: '✨ Votre espace est complet ❤️'
        };
        _nidShowToast(msgs[m] || 'Palier atteint !');
        // À 100% : marquer définitivement complété + masquer la barre
        if(m === 100) {
          _NID_DATA.completed = true;
          _nidSave();
          setTimeout(function() {
            var bar = document.getElementById('nousNestBar');
            if(bar) { bar.style.transition = 'opacity 0.8s'; bar.style.opacity = '0'; setTimeout(function(){ bar.style.display = 'none'; }, 800); }
          }, 3000); // laisser le temps de voir le 100%
        }
      }, 700);
    }
  });
}


// Détection automatique au chargement : déverrouille silencieusement les sections
// qui ont déjà du contenu, sans toast ni animation
function _nidAutoDetect() {
  if (!_NID_DATA) { _nidLoad(function(){ _nidAutoDetect(); }); return; }
  var cid = _nidCid(); if (!cid) return;
  var unlocked = _NID_DATA.unlocked;
  var changed = false;

  function _unlock(id) {
    if (unlocked.indexOf(id) === -1) { unlocked.push(id); changed = true; }
  }

  // Logique : Elle/Lui→Mémo, Mémo→Petits mots, Petits mots→Souvenirs,
  //           Souvenirs→Activités, Activités→Bibliothèque

  // 1. Elle/Lui : image uploadée → débloquer Mémo
  // Vérification via DB : au moins 1 ligne elle_img ou lui_img = image uploadée
  var elleUrl = SB_URL+'/rest/v1/photo_descs?couple_id=eq.'+cid+'&category=eq.elle_img&limit=1&select=id';
  var luiUrl  = SB_URL+'/rest/v1/photo_descs?couple_id=eq.'+cid+'&category=eq.lui_img&limit=1&select=id';

  Promise.all([
    fetch(elleUrl,{headers:sb2Headers()}).then(function(r){return r.ok?r.json():[];}).catch(function(){return [];}),
    fetch(luiUrl, {headers:sb2Headers()}).then(function(r){return r.ok?r.json():[];}).catch(function(){return [];})
  ])
    .then(function(imgs) {
      if ((imgs[0] && imgs[0].length) || (imgs[1] && imgs[1].length)) { _unlock('memoCoupleSection'); }
      // 2. Mémo note → débloquer Petits mots
      return fetch(SB_URL+'/rest/v1/memo_notes?couple_id=eq.'+cid+'&limit=1&select=id', { headers: sb2Headers() });
    })
    .then(function(r) { return r && r.ok ? r.json() : []; })
    .then(function(rows) {
      if (rows && rows.length) { _unlock('postitsSection'); }
      // 3. Mémo todo → débloquer Petits mots
      return fetch(SB_URL+'/rest/v1/memo_todos?couple_id=eq.'+cid+'&limit=1&select=id', { headers: sb2Headers() });
    })
    .then(function(r) { return r && r.ok ? r.json() : []; })
    .then(function(rows) {
      if (rows && rows.length) { _unlock('postitsSection'); }
      // 4. Petits mots → débloquer Souvenirs
      return fetch(SB_URL+'/rest/v1/petits_mots?couple_id=eq.'+cid+'&limit=1&select=id', { headers: sb2Headers() });
    })
    .then(function(r) { return r && r.ok ? r.json() : []; })
    .then(function(rows) {
      if (rows && rows.length) { _unlock('souvenirsSection'); }
      // 5. Souvenir → débloquer Activités
      return fetch(SB_URL+'/rest/v1/memories?couple_id=eq.'+cid+'&limit=1&select=id', { headers: sb2Headers() });
    })
    .then(function(r) { return r && r.ok ? r.json() : []; })
    .then(function(rows) {
      if (rows && rows.length) { _unlock('activitesSection'); }
      // 6. Activité → débloquer Bibliothèque
      return fetch(SB_URL+'/rest/v1/activites?couple_id=eq.'+cid+'&limit=1&select=id', { headers: sb2Headers() });
    })
    .then(function(r) { return r && r.ok ? r.json() : []; })
    .then(function(rows) {
      if (rows && rows.length) { _unlock('Books'); }
      if (changed) { _nidSave(); _nidApply(); _nidMilestones(); }
    })
    .catch(function() {});
}

// Page solo (pas de partenaire lié)
function _nidShowSolo(){
  var overlay=document.getElementById('nousLockOverlay');
  var content=document.getElementById('nousContentWrapper');
  if(content) content.style.display='none';
  if(!overlay) return;
  overlay.style.cssText='display:flex;align-items:center;justify-content:center;min-height:60vh;padding:40px 24px;';
  overlay.innerHTML=
    '<div class="nous-solo-welcome">'+
      '<div class="nous-solo-illu">👩‍❤️‍👨</div>'+
      '<h2 class="nous-solo-title">Votre espace à deux</h2>'+
      '<p class="nous-solo-sub">Reliez-vous à votre partenaire pour construire votre espace commun — photos, souvenirs, petits mots et bien plus.</p>'+
      '<div class="nous-solo-code-wrap">'+
        '<div class="nous-solo-code-label">Votre code couple</div>'+
        '<button class="nous-solo-code-btn" id="nidSoloBtn">Voir mon code</button>'+
      '</div>'+
      '<p class="nous-solo-hint">Partagez votre code avec votre partenaire, ou entrez le sien dans les paramètres.</p>'+
    '</div>';
  var btn=document.getElementById('nidSoloBtn');
  if(btn) btn.addEventListener('click',function(){ if(typeof window.yamToggleAccountModal==='function') window.yamToggleAccountModal(); });
}

// ════════════════════════════════════════════════════════════════════
// 0. ACCÈS DIRECT — Beta gate supprimé
// ════════════════════════════════════════════════════════════════════
(function(){

  // Affiche le contenu directement, sans code d'accès
  function _nousShowContent() {
    var overlay = document.getElementById('nousLockOverlay');
    var content = document.getElementById('nousContentWrapper');
    if(overlay){ overlay.style.display='none'; overlay.style.cssText=''; }
    if(content) content.style.display='block';
    if(!window._nousContentLoaded) {
      window._nousContentLoaded = true;
      _nidInjectBar();
      _nidLoad(function(){
        // Si déjà complété, masquer la barre définitivement
        if(_NID_DATA && _NID_DATA.completed) {
          var bar = document.getElementById('nousNestBar');
          if(bar) bar.style.display = 'none';
          _nidApply(); // appliquer quand même pour déverrouiller les sections
          return;
        }
        _nidApply();
        setTimeout(_nidAutoDetect, 1200);
      });
      _nousInitAll();
      setTimeout(function(){ document.dispatchEvent(new Event('nousContentReady')); }, 300);
    } else {
      // Retour sur l'onglet : vérifier completed avant de rafraîchir
      if(_NID_DATA && _NID_DATA.completed) {
        var bar = document.getElementById('nousNestBar');
        if(bar) bar.style.display = 'none';
      } else {
        _nidRefreshBar();
      }
    }
  }

  window.nousCheckLock = function() {
    var u=(typeof yamGetUser==='function')?yamGetUser():null;
    if(!u||!u.partner_pseudo||!u.partner_pseudo.trim()){ _nidShowSolo(); return; }
    _nousShowContent();
  };

  window._nousIsUnlocked = function(){ return true; };
  window.nousBetaSubmit  = function() {};

  setTimeout(function(){
    if (window._currentTab === 'nous') window.nousCheckLock();
  }, 800);

})();


// ════════════════════════════════════════════════════════════════════
// 1. INIT CENTRALE — appelée une seule fois au premier affichage
// ════════════════════════════════════════════════════════════════════
// ── Edge Function yam-init (#59) ─────────────────────────────────────────
// URL construite localement (SB_URL est global depuis app-core.js)
var SB2_EDGE_YAM_INIT = null; // initialisé au premier appel (SB_URL dispo)

// Injecte les données batchées dans les structures existantes de l'app,
// exactement comme si chaque fonction avait fait sa propre requête.
function _nousApplyBatchData(d) {
  var coupleId = (yamGetUser()||{}).couple_id;
  if(!coupleId) return;

  // 1. Titres sections
  if(Array.isArray(d.sectionTitles)) {
    d.sectionTitles.forEach(function(row) {
      if(row.slot === 'elle_title' || row.slot === '0' || row.slot === 0) {
        var el = document.getElementById('elleSectionTitle');
        if(el && row.description) el.textContent = row.description;
      } else if(row.slot === 'lui_title' || row.slot === '99' || row.slot === 99) {
        var el2 = document.getElementById('luiSectionTitle');
        if(el2 && row.description) el2.textContent = row.description;
      }
    });
  }

  // 2+3. Banners + descs Elle
  if(Array.isArray(d.elleBanners)) {
    d.elleBanners.forEach(function(row) {
      var el = document.getElementById('elle-banner-'+row.slot);
      if(el) el.textContent = row.description;
      var lbl = document.querySelector('#elle-empty-'+row.slot+' .lui-img-empty-lbl');
      if(lbl) lbl.textContent = row.description;
    });
  }
  if(Array.isArray(d.elleDescs)) {
    d.elleDescs.forEach(function(row) {
      var el = document.getElementById('elle-desc-'+row.slot);
      if(el) el.textContent = row.description;
    });
  }

  // 4+5. Banners + descs Lui
  if(Array.isArray(d.luiBanners)) {
    d.luiBanners.forEach(function(row) {
      var el = document.getElementById('lui-banner-'+row.slot);
      if(el) el.textContent = row.description;
      var lbl = document.querySelector('#lui-empty-'+row.slot+' .lui-img-empty-lbl');
      if(lbl) lbl.textContent = row.description;
    });
  }
  if(Array.isArray(d.luiDescs)) {
    d.luiDescs.forEach(function(row) {
      var el = document.getElementById('lui-desc-'+row.slot);
      if(el) el.textContent = row.description;
    });
  }

  // 6. Likes coeurs
  if(Array.isArray(d.likeCounters)) {
    var elGirl = document.getElementById('likeNumGirl');
    var elBoy  = document.getElementById('likeNumBoy');
    var foundGirl = false; var foundBoy = false;
    d.likeCounters.forEach(function(r) {
      if(r.role==='girl'&&elGirl){ elGirl.textContent=fmtLikes(r.total); foundGirl=true; }
      if(r.role==='boy' &&elBoy) { elBoy.textContent =fmtLikes(r.total); foundBoy=true;  }
    });
    if(!foundGirl&&elGirl) elGirl.textContent='0';
    if(!foundBoy &&elBoy)  elBoy.textContent ='0';
  }

  // 7. Petits mots
  if(Array.isArray(d.petitsMots) && typeof window._petitsMotsApply === 'function') {
    window._petitsMotsApply(d.petitsMots);
  }

  // 8+9. Mémo note + todos
  if(typeof window._memoNoteApply === 'function')  window._memoNoteApply(d.memoNote  || []);
  if(typeof window._memoTodosApply === 'function') window._memoTodosApply(d.memoTodos || []);

  // 10. Souvenirs
  if(Array.isArray(d.memories)) {
    window._souvenirAllRows = d.memories;
    if(typeof window._renderSouvenirRowsPublic === 'function') window._renderSouvenirRowsPublic(d.memories);
  }

  // 11. Activités
  if(Array.isArray(d.activites)) {
    window._activiteAllRows = d.activites;
    if(typeof window._renderActivitesHomePublic === 'function') window._renderActivitesHomePublic();
  }

  // 12. Livres
  if(Array.isArray(d.livres)) {
    window._livresAllRows = d.livres;
    if(typeof window._renderLivresSliderPublic === 'function') window._renderLivresSliderPublic();
  }

  // 13+14. v4 — Images Moi/Toi via photo_descs (plus de requête Storage au chargement)
  if(Array.isArray(d.elleImages)) _applyImagesFromDB('elle', d.elleImages);
  if(Array.isArray(d.luiImages))  _applyImagesFromDB('lui',  d.luiImages);
}

// Applique les URLs images stockées en DB directement dans les <img>
function _applyImagesFromDB(section, rows) {
  // Indexer les rows par slot pour lookup O(1)
  var bySlot = {};
  rows.forEach(function(row) { if(row.slot && row.description) bySlot[row.slot] = row.description; });
  // SLOTS est dans un closure privé — tableau inline identique
  var _SLOTS = ['animal','fleurs','personnage','saison','repas'];
  _SLOTS.forEach(function(slot) {
    var url   = bySlot[slot] || null;
    var img   = document.getElementById(section+'-img-'+slot);
    var empty = document.getElementById(section+'-empty-'+slot);
    var btn   = document.getElementById(section+'-btn-'+slot);
    if(!img) return;
    if(url) {
      // URL depuis la DB — inclut ?t=timestamp unique à chaque upload
      // Jamais en cache → affichage immédiat garanti (envoyeur et partenaire)
      img.src = url;
      img.style.display = '';
      img.classList.add('loaded');
      if(empty) empty.style.display = 'none';
      if(btn)   btn.classList.remove('empty');
    } else {
      img.style.display = 'none';
      if(empty) empty.style.display = '';
      if(btn)   btn.classList.add('empty');
    }
  });
}

// Tentative batch — si succès, skip les fetches individuels ; si échec, fallback classique.
function _nousInitBatch(onSuccess, onFallback) {
  var u = (typeof yamGetUser==='function') ? yamGetUser() : null;
  if(!u || !u.couple_id) { onFallback(); return; }

  if(!SB2_EDGE_YAM_INIT) SB2_EDGE_YAM_INIT = SB_URL + '/functions/v1/yam-init';

  var token = '';
  try { token = yamGetAccessToken ? yamGetAccessToken() : ''; } catch(e){}
  if(!token) { onFallback(); return; }

  var profile = (typeof getProfile==='function') ? getProfile() : 'girl';

  fetch(SB2_EDGE_YAM_INIT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (yamGetAccessToken ? yamGetAccessToken() : '') },
    body: JSON.stringify({ couple_id: u.couple_id, profile: profile })
  })
  .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
  .then(function(res) {
    if(res && res.ok && res.data) {
      _nousApplyBatchData(res.data);
      onSuccess();
    } else {
      onFallback();
    }
  })
  .catch(function() {
    onFallback();
  });
}

function _nousInitAll() {
  _nousLoadProfil();
  // ── Images Moi/Toi chargées via le batch yam-init (v4) ──
  // elleLoadImages/luiLoadImages gardées uniquement pour le RT après upload

  // ── Batch yam-init (#59) : 12 fetches → 1 requête ──────────────
  // Si la Edge Function répond → données injectées directement.
  // Si elle échoue (cold start, erreur réseau) → fallback classique immédiat.
  _nousInitBatch(
    function() {
      // Succès batch — uniquement ce que le batch ne couvre pas
      console.log('[yam-init] Batch OK — 12 fetches remplacés par 1');
      _petitsMotsLoad();
      renderMemoCouple();
      nousLoadSouvenirs();
      nousLoadActivites();
      livresLoad();
    },
    function() {
      // Fallback — comportement original intact
      console.warn('[yam-init] Fallback → fetches classiques');
      elleLoadDescs();
      elleSyncSections();
      luiLoadDescs();
      luiSyncDescs();
      if(typeof window._loadSectionTitles === 'function') window._loadSectionTitles();
      var _niu = (typeof yamGetUser==='function')?yamGetUser():null;
      var _nic = _niu?_niu.couple_id:null;
      if(_nic){
        if(typeof _loadElleBanners==='function') _loadElleBanners(_nic);
        if(typeof _loadLuiBanners==='function') _loadLuiBanners(_nic);
      }
      loadLikeCounters();
      _petitsMotsLoad();
      renderMemoCouple();
      nousLoadSouvenirs();
      nousLoadActivites();
      livresLoad();
    }
  );

  _nousLoadBadge();
  if (!window._likesIv) {
    window._likesIv = setInterval(loadLikeCounters, 5000);
  }
  document.querySelectorAll('#nousContentWrapper .fade-in').forEach(function(el){
    if (window._fadeObs) window._fadeObs.observe(el);
  });
  // Force fetch Supabase au 1er chargement — retry jusqu'à ce que couple_id soit dispo
  (function _tryRefreshBadges(attempts){
    var u = (typeof yamGetUser==='function') ? yamGetUser() : null;
    if(u && u.couple_id){
      if(typeof window.yamForceRefreshNewBadges==='function') window.yamForceRefreshNewBadges();
    } else if(attempts > 0){
      setTimeout(function(){ _tryRefreshBadges(attempts-1); }, 800);
    }
  })(10);

  // Flamme de couple
  if (typeof window.flammeInit === 'function') window.flammeInit();
}


// ════════════════════════════════════════════════════════════════════
// 2. PROFIL COUPLE
// ════════════════════════════════════════════════════════════════════
function _nousLoadProfil() {
  var u = (typeof yamGetUser === 'function') ? yamGetUser() : null;
  if (!u) return;
  var myRole   = u.role;
  // Pseudos réels si disponibles, sinon Moi/Toi selon le rôle
  var girlName = (typeof v2GetDisplayName === 'function') ? v2GetDisplayName('girl') : (myRole === 'girl' ? 'Rose' : 'Bleu');
  var boyName  = (typeof v2GetDisplayName === 'function') ? v2GetDisplayName('boy')  : (myRole === 'boy'  ? 'Bleu' : 'Rose');
  // v2GetDisplayName retourne 'Elle'/'Lui' quand le pseudo n'est pas connu → remplacer par Moi/Toi
  if (girlName === 'Elle' || girlName === 'Lui') girlName = (myRole === 'girl' ? 'Rose' : 'Bleu');
  if (boyName  === 'Elle' || boyName  === 'Lui') boyName  = (myRole === 'boy'  ? 'Bleu' : 'Rose');
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

  function _getCoupleId(){ var u=(typeof yamGetUser==='function')?yamGetUser():null; return u?u.couple_id:null; }

  // ── Charge tous les badges du couple depuis Supabase ──
  function _fetchAllBadges(callback){
    var cid = _getCoupleId(); if(!cid){ if(callback) callback(); return; }
    fetch(SB_URL+'/rest/v1/new_badges?couple_id=eq.'+encodeURIComponent(cid)+'&select=section,marked_at', {headers: sb2Headers()})
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
    fetch(SB_URL+'/rest/v1/new_badges', {
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
  function _getCoupleId(){ var u=(typeof yamGetUser==='function')?yamGetUser():null; return u?u.couple_id:null; }

  // Charger les titres depuis Supabase
  function _loadSectionTitles(){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    fetch(SB_URL+'/rest/v1/photo_descs?couple_id=eq.'+coupleId+'&category=eq.label&select=slot,description',{headers:sb2Headers()})
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
    var qUrl = SB_URL+'/rest/v1/photo_descs?couple_id=eq.'+coupleId+'&category=eq.label&'+slotFilter+'&select=id&limit=1';
    fetch(qUrl, {headers: sb2Headers()})
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(rows){
      if(rows && rows.length > 0){
        // Ligne existante → PATCH
        fetch(SB_URL+'/rest/v1/photo_descs?id=eq.'+rows[0].id+'&couple_id=eq.'+coupleId, {
          method: 'PATCH',
          headers: sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),
          body: JSON.stringify({description: val, slot: String(slot)})
        }).catch(function(){});
      } else {
        // Nouvelle ligne → POST
        fetch(SB_URL+'/rest/v1/photo_descs', {
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

  function _getCoupleId(){ var u=(typeof yamGetUser==='function')?yamGetUser():null; return u?u.couple_id:null; }
  function _ellePath(cid,slot){ return 'uploads/'+cid+'/'+slot+'-elle.jpg'; }
  function _luiPath(cid,slot){ return 'uploads/'+cid+'/'+slot+'-lui.jpg'; }
  function _ellePathTs(cid,slot,ts){ return 'uploads/'+cid+'/'+slot+'-elle-'+ts+'.jpg'; }
  function _luiPathTs(cid,slot,ts){ return 'uploads/'+cid+'/'+slot+'-lui-'+ts+'.jpg'; }

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
    var elleInfoBtn  = document.getElementById('elleInfoBtn');
    var luiInfoBtn   = document.getElementById('luiInfoBtn');
    if(!elleSection || !luiSection) return;
    if(profile === 'boy'){
      // boy : édite ROSE (elle) → œil centré sur ROSE, pas de ? sur ROSE
      //        sa section BLEU → ? seulement, pas d'œil
      luiSection.style.display  = 'block';
      if(!elleSection.dataset.forceOpen) elleSection.style.display = 'none';
      // ROSE : œil visible centré (position absolute déjà dans HTML), pas de ?
      if(elleGear)     { elleGear.style.display = ''; elleGear.style.position = ''; elleGear.style.left = ''; elleGear.style.transform = ''; }
      if(elleInfoBtn)  elleInfoBtn.style.display = 'none';
      // BLEU : pas d'œil, juste ?
      if(luiGear)      luiGear.style.display  = 'none';
      if(luiInfoBtn)   luiInfoBtn.style.display = '';
      if(elleTitleBtn) elleTitleBtn.style.display = 'flex';
      if(luiTitleBtn)  luiTitleBtn.style.display  = 'none';
    } else {
      // girl : édite BLEU (lui) → œil centré sur BLEU, pas de ? sur BLEU
      //         sa section ROSE → ? seulement, pas d'œil
      elleSection.style.display = 'block';
      if(!luiSection.dataset.forceOpen) luiSection.style.display = 'none';
      // ROSE : pas d'œil, juste ?
      if(elleGear)     elleGear.style.display  = 'none';
      if(elleInfoBtn)  elleInfoBtn.style.display = '';
      // BLEU : œil visible centré, pas de ?
      if(luiGear)      { luiGear.style.display = ''; luiGear.style.position = ''; luiGear.style.left = ''; luiGear.style.transform = ''; }
      if(luiInfoBtn)   luiInfoBtn.style.display = 'none';
      if(elleTitleBtn) elleTitleBtn.style.display = 'none';
      if(luiTitleBtn)  luiTitleBtn.style.display  = 'flex';
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
  // CHARGEMENT PHOTOS — via DB (photo_descs category=elle_img/lui_img)
  // Meme systeme que les souvenirs : URL brute stockee en DB, pas de ?t=,
  // le navigateur cache normalement. Zero egress storage au rechargement.
  // ─────────────────────────────
  function _loadImagesFromDB(section){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    var cat = section+'_img';
    fetch(SB_URL+'/rest/v1/photo_descs?couple_id=eq.'+coupleId+'&category=eq.'+cat+'&select=slot,description',
      { headers: sb2Headers() })
      .then(function(r){ return r.ok ? r.json() : []; })
      .then(function(rows){ _applyImagesFromDB(section, Array.isArray(rows)?rows:[]); })
      .catch(function(){});
  }
  window.elleLoadImages = function(){ _loadImagesFromDB('elle'); };
  window.luiLoadImages  = function(){ _loadImagesFromDB('lui');  };

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
    fetch(SB_URL+'/rest/v1/photo_descs?couple_id=eq.'+coupleId+'&category=eq.'+catBanner+'&select=slot,description',{headers:sb2Headers()})
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
    fetch(SB_URL+'/rest/v1/photo_descs?couple_id=eq.'+coupleId+'&category=eq.'+catDesc+'&select=slot,description',{headers:sb2Headers()})
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
    var ALLOWED=['image/jpeg','image/jpg','image/png','image/webp'];
    if(ALLOWED.indexOf(file.type)===-1){
      if(typeof showToast==='function') showToast('Format non autorisé — utilisez JPG, PNG ou WebP', 'error', 3500);
      return;
    }
    var coupleId=_getCoupleId();
    if(!coupleId){
      if(typeof showToast==='function') showToast('Session introuvable — reconnecte-toi', 'error', 3000);
      return;
    }
    var _ts = Date.now();
    var path = section==='elle' ? _ellePathTs(coupleId,slot,_ts) : _luiPathTs(coupleId,slot,_ts);
    var photoDiv=document.getElementById('slotEditPhoto');

    // Détection HEIC avant compression
    var isHeic = file.type==='image/heic' || file.type==='image/heif'
              || file.name.toLowerCase().endsWith('.heic')
              || file.name.toLowerCase().endsWith('.heif');
    if(isHeic){
      if(typeof showToast==='function') showToast('Format HEIC non supporté — convertissez en JPG dans Photos puis réessayez', 'error', 4500);
      if(photoDiv) photoDiv.innerHTML='';
      return;
    }

    // doUpload : reçoit un Blob déjà compressé (ou le File original en fallback)
    var _uploadedKo = 0;
    var doUpload = function(blob){
      _uploadedKo = Math.round(blob.size/1024);
      if(photoDiv) photoDiv.innerHTML='<div style="color:var(--muted);font-size:12px;">Envoi...</div>';
      fetch(SB_URL+'/storage/v1/object/'+SB_BUCKET+'/'+path,{
        method:'POST', headers:Object.assign({'Content-Type':'image/jpeg','x-upsert':'true'},sb2Headers()), body:blob
      }).then(function(r){ return r.text().then(function(){ return r.ok; }); })
      .then(function(ok){
        if(ok){
          // Même stratégie que les souvenirs : URL stockée dans modal.dataset.photoUrl
          // La sauvegarde réelle en DB se fait dans slotEditSave (bouton Sauvegarder)
          var urlWithTs=SB_URL+'/storage/v1/object/public/'+SB_BUCKET+'/'+path;
          var modal2=document.getElementById('slotEditModal');
          if(modal2) modal2.dataset.photoUrl=urlWithTs;
          if(photoDiv){ photoDiv.innerHTML=''; photoDiv.style.backgroundImage='url('+urlWithTs+')'; }
          var ph=document.getElementById('slotEditPhotoPlaceholder');
          if(ph) ph.style.display='none';
          if(typeof showToast==='function') showToast('✅ Photo optimisée : '+_uploadedKo+' Ko', 'success', 2500);
        } else {
          if(photoDiv) photoDiv.innerHTML='<div style="color:#e05555;font-size:11px;">Erreur upload</div>';
          if(typeof showToast==='function') showToast('Erreur upload — réessaie', 'error', 3000);
        }
      }).catch(function(){
        if(photoDiv) photoDiv.innerHTML='<div style="color:#e05555;font-size:11px;">Erreur réseau</div>';
        if(typeof showToast==='function') showToast('Erreur réseau — vérifie ta connexion', 'error', 3000);
      });
    };

    // Compression avant upload — max 1200px, cible 400 Ko
    if(typeof window.compressImage === 'function'){
      window.compressImage(file, 1200, 400*1024)
        .then(function(blob){
          doUpload(blob);
        })
        .catch(function(err){
          if(err && err.message === 'HEIC_NOT_SUPPORTED'){
            if(typeof showToast==='function') showToast('Format HEIC non supporté — convertissez en JPG dans Photos', 'error', 4500);
            if(photoDiv) photoDiv.innerHTML='';
            return;
          }
          if(err && err.message === 'PHOTO_TOO_LARGE'){
            if(typeof showToast==='function') showToast('Photo trop lourde (5 Mo max après compression)', 'error', 4000);
            if(photoDiv) photoDiv.innerHTML='';
            return;
          }
          // Fallback : upload fichier original
          if(typeof showToast==='function') showToast('Compression impossible — envoi en l\'original', 'info', 2500);
          doUpload(file);
        });
    } else {
      doUpload(file);
    }
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

    // Pré-remplir depuis mémoire
    var banners=section==='elle'?_elleBanners:_luiBanners;
    var descs=section==='elle'?_elleDescs:_luiDescs;
    document.getElementById('slotEditBannerInput').value=banners[slot]||'';
    document.getElementById('slotEditDescInput').value=descs[slot]||'';

    // Titre : titre de la section (MOI/TOI ou personnalisé), pas le titre du slot
    var sectionTitleEl=document.getElementById(section==='elle'?'elleSectionTitle':'luiSectionTitle');
    var sectionTitle=(sectionTitleEl&&sectionTitleEl.textContent.trim())||(section==='elle'?'Rose':'Bleu');
    document.getElementById('slotEditModalTitle').textContent=sectionTitle;

    // Photo
    var photoDiv=document.getElementById('slotEditPhoto');
    var placeholder=document.getElementById('slotEditPhotoPlaceholder');
    var imgEl=document.getElementById(section+'-img-'+slot);
    var hasPhoto=imgEl && imgEl.src && imgEl.style.display!=='none' && imgEl.src!==window.location.href && !imgEl.src.endsWith('/');
    if(photoDiv){
      if(hasPhoto){ photoDiv.style.backgroundImage='url('+imgEl.src+')'; photoDiv.innerHTML=''; if(placeholder) placeholder.style.display='none'; }
      else { photoDiv.style.backgroundImage=''; if(placeholder){ placeholder.style.display='flex'; photoDiv.innerHTML=''; photoDiv.appendChild(placeholder); } }
    }

    // Stocker l'URL actuelle + id photo_descs dans dataset — même pattern que souvenirs
    // photoUrl vide par défaut : ne sauvegarder que si l'utilisateur uploade une nouvelle photo
    modal.dataset.photoUrl = '';
    modal.dataset.photoDescId = '';
    var _cid = _getCoupleId();
    if(_cid){
      fetch(SB_URL+'/rest/v1/photo_descs?couple_id=eq.'+_cid+'&category=eq.'+section+'_img&slot=eq.'+slot+'&select=id',
        {headers:sb2Headers()})
        .then(function(r){return r.ok?r.json():[];})
        .then(function(rows){ if(rows&&rows[0]) modal.dataset.photoDescId=rows[0].id; })
        .catch(function(){});
    }
    // Afficher le bouton supprimer photo uniquement si une photo existe
    var _delBtn=document.getElementById('slotEditDelBtn');
    if(_delBtn) _delBtn.style.display='flex';
    modal.classList.add('open');
  };

  window.slotCloseEdit = function(){
    var modal=document.getElementById('slotEditModal');
    if(modal) modal.classList.remove('open');
    _unblockBackgroundScroll();
    _restoreScrollPosition();
    _editSection=null; _editSlot=null;
  };

  // ── Visualisation pochette (lecture seule) ──
  window.slotOpenView = function(section, slot){
    var imgEl   = document.getElementById(section+'-img-'+slot);
    if(!imgEl || imgEl.style.display==='none' || !imgEl.src || imgEl.src===window.location.href) return;
    var banner  = document.getElementById(section+'-banner-'+slot);
    var descEl  = document.getElementById(section+'-desc-'+slot);
    var modal   = document.getElementById('slotViewModal'); if(!modal) return;
    var _svi=document.getElementById('slotViewImg'); if(_svi){_svi.src=imgEl.src;_svi.style.display='block';}
    var _sve=document.getElementById('slotViewEmoji'); if(_sve) _sve.style.display='none';
    document.getElementById('slotViewTitle').textContent = banner  ? banner.textContent  : '';
    document.getElementById('slotViewDesc').textContent  = descEl  ? descEl.textContent  : '';
    var editBtn=document.getElementById('slotViewEditBtn'); if(editBtn) editBtn.style.display='none';
    window._slotViewCurrentSouvenir=null; window._slotViewCurrentLivre=null;
    _saveScrollPosition();
    _blockBackgroundScroll();
    modal.classList.add('open');
  };
  window.slotCloseView = function(){
    var modal=document.getElementById('slotViewModal'); if(!modal) return;
    modal.classList.remove('open');
    _unblockBackgroundScroll();
    _restoreScrollPosition();
  };

  // ── Visualisation souvenir (lecture seule) ──
  window.souvenirOpenView = function(s){
    if(!s || !s.photo_url) return;
    var modal = document.getElementById('slotViewModal'); if(!modal) return;
    var _svi=document.getElementById('slotViewImg'); if(_svi){_svi.src=s.photo_url;_svi.style.display='block';}
    var _sve=document.getElementById('slotViewEmoji'); if(_sve) _sve.style.display='none';
    document.getElementById('slotViewTitle').textContent = s.title || '';
    // Meta : date + lieu
    var metaEl = document.getElementById('slotViewMeta');
    if(metaEl){
      var parts = [];
      if(s.date) parts.push(new Date(s.date+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}));
      if(s.lieu) parts.push('📍 '+s.lieu);
      metaEl.textContent = parts.join(' · ');
    }
    document.getElementById('slotViewDesc').textContent = s.description || '';
    var editBtn=document.getElementById('slotViewEditBtn');
    if(editBtn){ editBtn.style.display='flex'; }
    window._slotViewCurrentSouvenir=s;
    _saveScrollPosition();
    _blockBackgroundScroll();
    modal.classList.add('open');
  };

  // ── Visualisation livre (lecture seule) ──
  window.livreOpenView = function(book){
    if(!book) return;
    var modal = document.getElementById('slotViewModal'); if(!modal) return;
    var imgEl = document.getElementById('slotViewImg');
    var emojiEl = document.getElementById('slotViewEmoji');
    if(book.has_image){
      var photoUrl = SB_URL+'/storage/v1/object/public/'+SB_BUCKET+'/books/'+book.couple_id+'/'+book.id+'.jpg?t='+Math.floor(Date.now()/60000);
      if(imgEl){ imgEl.src=photoUrl; imgEl.style.display='block'; }
      if(emojiEl) emojiEl.style.display='none';
    } else {
      if(imgEl){ imgEl.src=''; imgEl.style.display='none'; }
      if(emojiEl) emojiEl.style.display='flex';
    }
    document.getElementById('slotViewTitle').textContent = book.title||'';
    var metaEl = document.getElementById('slotViewMeta');
    if(metaEl) metaEl.textContent = '';
    document.getElementById('slotViewDesc').textContent = book.description||'';
    var editBtn = document.getElementById('slotViewEditBtn');
    if(editBtn) editBtn.style.display = 'flex';
    window._slotViewCurrentLivre = book;
    window._slotViewCurrentSouvenir = null;
    _saveScrollPosition();
    _blockBackgroundScroll();
    modal.classList.add('open');
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
    var qUrl=SB_URL+'/rest/v1/photo_descs?couple_id=eq.'+coupleId+'&category=eq.'+category+'&slot=eq.'+slot+'&select=id&limit=1';
    fetch(qUrl,{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      if(rows && rows.length>0){
        // Ligne existante → PATCH
        var id=rows[0].id;
        fetch(SB_URL+'/rest/v1/photo_descs?id=eq.'+id+'&couple_id=eq.'+coupleId,{
          method:'PATCH',
          headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),
          body:JSON.stringify({description:description})
        }).catch(function(){});
      } else {
        // Nouvelle ligne → POST
        fetch(SB_URL+'/rest/v1/photo_descs',{
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
    var modal=document.getElementById('slotEditModal');
    var newPhotoUrl=modal ? (modal.dataset.photoUrl||'') : '';

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

    // Sauvegarder la photo — identique à souvenirSave :
    // PATCH direct si id connu, POST sinon
    if(newPhotoUrl){
      var cat=s+'_img';
      var pdId=modal?modal.dataset.photoDescId:'';
      var payload={description:newPhotoUrl,updated_at:new Date().toISOString()};
      var req;
      if(pdId){
        req=fetch(SB_URL+'/rest/v1/photo_descs?id=eq.'+pdId,{method:'PATCH',
          headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),
          body:JSON.stringify(payload)});
      } else {
        var body=Object.assign({couple_id:coupleId,category:cat,slot:sl},payload);
        req=fetch(SB_URL+'/rest/v1/photo_descs',{method:'POST',
          headers:sb2Headers({'Prefer':'return=representation','Content-Type':'application/json'}),
          body:JSON.stringify(body)});
      }
      req.then(function(r){
          // Si POST, récupérer l'id retourné pour les prochains saves
          if(!pdId && modal && r.ok) r.json().then(function(rows){
            if(rows&&rows[0]) modal.dataset.photoDescId=rows[0].id;
          }).catch(function(){});
          // Mettre à jour l'img locale — identique à nousLoadSouvenirs après save
          var img=document.getElementById(s+'-img-'+sl);
          var emptyEl=document.getElementById(s+'-empty-'+sl);
          var btnEl=document.getElementById(s+'-btn-'+sl);
          // Recharger depuis la DB — identique à nousLoadSouvenirs() après save
          if(typeof window.elleLoadImages==='function') window.elleLoadImages();
          if(typeof window.luiLoadImages==='function')  window.luiLoadImages();
          if(typeof window.yamFlameActivity==='function') window.yamFlameActivity('elle_lui_update');
          if(typeof window._nousSignalNewContent==='function') window._nousSignalNewContent('memoCoupleSection');
          if(typeof window.yamMarkNewAndRefresh==='function') window.yamMarkNewAndRefresh(s+'_slot_'+sl);
        }).catch(function(){});
    }

    if(typeof showToast==='function') showToast('Pochette mise à jour ✓','success',2000);
    window.slotCloseEdit();
  };

  // Supprime uniquement la photo du slot — titre et description inchangés
  window.slotDeleteSlot = function(){
    if(!_editSection||!_editSlot) return;
    if(!confirm('Supprimer cette pochette (photo, titre et description) ?')) return;
    var coupleId=_getCoupleId(); if(!coupleId) return;
    var s=_editSection; var sl=_editSlot;
    var banners=s==='elle'?_elleBanners:_luiBanners;
    var descs=s==='elle'?_elleDescs:_luiDescs;

    // Supprimer toutes les lignes photo_descs liées à ce slot (img + banner + desc)
    var cats=[s+'_img', s==='elle'?'elle_banner':'lui_banner', s];
    cats.forEach(function(cat){
      fetch(SB_URL+'/rest/v1/photo_descs?couple_id=eq.'+coupleId+'&category=eq.'+cat+'&slot=eq.'+sl,
        {method:'DELETE',headers:sb2Headers()}).catch(function(){});
    });

    // Nettoyer mémoire locale
    delete banners[sl]; delete descs[sl];

    // Réinitialiser UI page principale
    var img=document.getElementById(s+'-img-'+sl);
    var emptyEl=document.getElementById(s+'-empty-'+sl);
    var btnEl=document.getElementById(s+'-btn-'+sl);
    var bannerEl=document.getElementById(s+'-banner-'+sl);
    var descEl=document.getElementById(s+'-desc-'+sl);
    var lbl=document.querySelector('#'+s+'-empty-'+sl+' .lui-img-empty-lbl');
    if(img){ img.src=''; img.style.display='none'; img.classList.remove('loaded'); }
    if(emptyEl) emptyEl.style.display='';
    if(btnEl) btnEl.classList.add('empty');
    if(bannerEl) bannerEl.textContent='';
    if(descEl) descEl.textContent='';
    if(lbl) lbl.textContent='';

    if(typeof showToast==='function') showToast('Pochette supprimée ✓','success',2000);
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

  function _getCoupleId(){ var u=(typeof yamGetUser==='function')?yamGetUser():null; return u?u.couple_id:null; }
  function _getProfile(){ if(typeof getProfile==='function'){ var p=getProfile(); if(p) return p; } var u=(typeof yamGetUser==='function')?yamGetUser():null; return u?u.role:null; }

  // Charge les mots REÇUS (écrits par le partenaire)
  function _petitsMotsLoad(){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    var profile  = _getProfile();
    var author   = profile === 'girl' ? 'boy' : 'girl'; // mots écrits par l'autre
    fetch(SB_URL+'/rest/v1/petits_mots?couple_id=eq.'+coupleId+'&author=eq.'+author+'&order=created_at.asc&select=*',{headers:sb2Headers()})
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

  // Variante batch : injecter les données sans fetch
  window._petitsMotsApply = function(rows) {
    _stackData = Array.isArray(rows) ? rows : [];
    _injectAnnivPostitIfNeeded();
    _stackIndex = 0;
    _buildPostitStack();
    if(typeof window.yamRefreshNewBadges==='function') window.yamRefreshNewBadges();
  };

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
    fetch(SB_URL+'/rest/v1/petits_mots?couple_id=eq.'+coupleId+'&author=eq.'+profile+'&order=created_at.desc&select=*',{headers:sb2Headers()})
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
              fetch(SB_URL+'/rest/v1/petits_mots?id=eq.'+m.id+'&couple_id=eq.'+coupleId,{method:'DELETE',headers:sb2Headers()})
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
      if(typeof window.yamFlameActivity==='function') window.yamFlameActivity('petit_mot');
      if(typeof window._nousSignalNewContent==='function') window._nousSignalNewContent('souvenirsSection');
    };
    if(_editingMot&&_editingMot.id){
      fetch(SB_URL+'/rest/v1/petits_mots?id=eq.'+_editingMot.id+'&couple_id=eq.'+coupleId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)}).then(done).catch(done);
    } else {
      fetch(SB_URL+'/rest/v1/petits_mots',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)}).then(done).catch(done);
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

// ════════════════════════════════════════════════════════════════════
// 10. LIKES CŒURS
// ════════════════════════════════════════════════════════════════════
function fmtLikes(n){ if(!n||n<=0) return '0'; if(n>=1000000) return (n/1000000).toFixed(1).replace('.0','')+'M'; if(n>=1000) return (n/1000).toFixed(1).replace('.0','')+'k'; return String(n); }


// ── Paliers journaliers cœurs ──────────────────────────────────────────────
var _heartMilestones = [10, 50, 100, 200, 500];
var _lastMilestone   = 0;

// Cache journalier localStorage
function _heartTodayKey(){
  var user = (typeof yamGetUser==='function'&&yamGetUser()) ? yamGetUser() : null;
  var uid = user ? user.id : ((typeof yamGetUser==='function'&&yamGetUser()) ? yamGetUser().id : 'x');
  var d = new Date();
  var dt = d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
  return 'yam_hearts_day_'+uid+'_'+dt;
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
    +parseInt(n)+' cœurs aujourd\'hui !</div>'
    +'</div>';
  document.body.appendChild(overlay);
  setTimeout(function(){ overlay.remove(); },1600);
  if(typeof showToast==='function') showToast(parseInt(n)+' cœurs envoyés aujourd\'hui 🩷','success');
  // Flamme — palier cœur atteint
  if(typeof window.yamFlameActivity==='function') window.yamFlameActivity('heart_milestone');
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
  var coupleId=(typeof yamGetUser==='function'&&yamGetUser())?yamGetUser().couple_id:null;
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

  fetch(SB_URL+'/rest/v1/rpc/increment_like_counter',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},sb2Headers()),body:JSON.stringify({p_profile:profile,p_couple_id:coupleId})})
  .then(function(r){ if(!r.ok){ return r.text().then(function(){ loadLikeCounters(); }); } if(window.scheduleLikeSync) window.scheduleLikeSync(); })
  .catch(function(){ loadLikeCounters(); });
}
window.spawnHeart = spawnHeart;


function loadLikeCounters(){
  var coupleId=(typeof yamGetUser==='function'&&yamGetUser())?yamGetUser().couple_id:null; if(!coupleId) return;
  fetch(SB_URL+'/rest/v1/like_counters?couple_id=eq.'+coupleId+'&select=role,total',{headers:sb2Headers()})
  .then(function(r){ return r.ok?r.json():[]; })
  .then(function(rows){
    if(!Array.isArray(rows)) return;
    var elGirl=document.getElementById('likeNumGirl'); var elBoy=document.getElementById('likeNumBoy');
    var foundGirl=false; var foundBoy=false;
    rows.forEach(function(r){ if(r.role==='girl'&&elGirl){ elGirl.textContent=fmtLikes(r.total); foundGirl=true; } if(r.role==='boy'&&elBoy){ elBoy.textContent=fmtLikes(r.total); foundBoy=true; } });
    if(!foundGirl&&elGirl) elGirl.textContent='0'; if(!foundBoy&&elBoy) elBoy.textContent='0';
  }).catch(function(){});
}
window.loadLikeCounters=loadLikeCounters;

var _likeSyncDebounce=null;
window.scheduleLikeSync=function(){ if(_likeSyncDebounce) clearTimeout(_likeSyncDebounce); _likeSyncDebounce=setTimeout(function(){ loadLikeCounters(); _likeSyncDebounce=null; },800); };

loadLikeCounters();

// ── Realtime likes coeurs (#27) ─────────────────────────────────────────────
var _likesRTChannel = null;

function _startLikesRealtime(coupleId) {
  if (!window._yamRT || !coupleId || _likesRTChannel) return;

  _likesRTChannel = window._yamRT
    .channel('likes-' + coupleId)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'like_counters',
      filter: 'couple_id=eq.' + coupleId
    }, function() {
      loadLikeCounters();
    })
    .subscribe(function(status) {
      if (status === 'SUBSCRIBED') {
        // Stopper le poll 5s — Realtime prend le relais
        if (window._likesIv) { clearInterval(window._likesIv); window._likesIv = null; }
        console.log('[RT] Likes channel connecté — poll désactivé'); console.warn('[RT] ✅ Likes connecté — Realtime actif');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // Fallback poll si Realtime échoue
        if (!window._likesIv) {
          window._likesIv = setInterval(loadLikeCounters, 5000);
          console.warn('[RT] Likes channel perdu — fallback poll 5s');
        }
      }
    });

  window._yamRTChannels['likes'] = _likesRTChannel;
}

// Lancer Realtime ou fallback poll selon disponibilité
(function() {
  var u = (typeof yamGetUser === 'function') ? yamGetUser() : null;
  var coupleId = u ? u.couple_id : null;
  if (window._yamRT && coupleId) {
    _startLikesRealtime(coupleId);
  } else if (!window._likesIv) {
    window._likesIv = setInterval(loadLikeCounters, 5000);
  }
})();

// ✅ #38 — Relancer après reconnexion
document.addEventListener('yam:session_ready', function(){
  var u = (typeof yamGetUser === 'function') ? yamGetUser() : null;
  var coupleId = u ? u.couple_id : null;
  loadLikeCounters();
  if (window._yamRT && coupleId) {
    _likesRTChannel = null; // reset pour permettre reconnexion
    _startLikesRealtime(coupleId);
  } else if (!window._likesIv) {
    window._likesIv = setInterval(loadLikeCounters, 5000);
  }
});


// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// REALTIME — Tous les canaux Nous (memo, petits mots, souvenirs,
//             activités, livres, histoire, photo_descs)
// Pattern : event:'*' + fallback poll 10s sur CHANNEL_ERROR
// ════════════════════════════════════════════════════════════════════

// ── Realtime memo ──────────────────────────────────────────
var _memoRTCh = null, _memoPollIv = null;
function _startMemoRT(cid) {
  if(!window._yamRT||!cid||_memoRTCh) return;
  _memoRTCh = window._yamRT.channel('memo-'+cid)
    .on('postgres_changes',{event:'*',schema:'public',table:'memo_notes',filter:'couple_id=eq.'+cid},
        function(){ if(typeof renderMemoCouple==='function') renderMemoCouple(); })
    .subscribe(function(s){
      if(s==='SUBSCRIBED'){ if(_memoPollIv){clearInterval(_memoPollIv);_memoPollIv=null;} }
      else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'){
        if(!_memoPollIv) _memoPollIv=setInterval(function(){ if(typeof renderMemoCouple==='function') renderMemoCouple(); },10000);
      }
    });
  window._yamRTChannels['memo']=_memoRTCh;
}

// ── Realtime memoTodo ──────────────────────────────────────────
var _memoTodoRTCh = null, _memoTodoPollIv = null;
function _startMemotodoRT(cid) {
  if(!window._yamRT||!cid||_memoTodoRTCh) return;

  // Refetch memo_todos depuis Supabase et injecter via _memoTodosApply
  function _reloadTodos() {
    fetch(SB_URL+'/rest/v1/memo_todos?couple_id=eq.'+cid+'&order=created_at.asc&limit=20&select=*',{headers:sb2Headers()})
      .then(function(r){ return r.ok?r.json():[]; })
      .then(function(rows){
        if(typeof window._memoTodosApply==='function') window._memoTodosApply(rows);
        // Aussi recharger la vue complète si elle est ouverte
        if(typeof window._loadTodoFull==='function') window._loadTodoFull();
      }).catch(function(){});
  }

  _memoTodoRTCh = window._yamRT.channel('memoTodo-'+cid)
    .on('postgres_changes',{event:'*',schema:'public',table:'memo_todos',filter:'couple_id=eq.'+cid},
        function(){ _reloadTodos(); })
    .subscribe(function(s){
      if(s==='SUBSCRIBED'){ if(_memoTodoPollIv){clearInterval(_memoTodoPollIv);_memoTodoPollIv=null;} }
      else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'){
        if(!_memoTodoPollIv) _memoTodoPollIv=setInterval(function(){ _reloadTodos(); },10000);
      }
    });
  window._yamRTChannels['memoTodo']=_memoTodoRTCh;
}

// ── Realtime petitsMots ──────────────────────────────────────────
var _petitsMotsRTCh = null, _petitsMotsPollIv = null;
function _startPetitsmotsRT(cid) {
  if(!window._yamRT||!cid||_petitsMotsRTCh) return;
  _petitsMotsRTCh = window._yamRT.channel('petitsMots-'+cid)
    .on('postgres_changes',{event:'*',schema:'public',table:'petits_mots',filter:'couple_id=eq.'+cid},
        function(){ if(typeof window._petitsMotsLoad==='function') window._petitsMotsLoad(); })
    .subscribe(function(s){
      if(s==='SUBSCRIBED'){ if(_petitsMotsPollIv){clearInterval(_petitsMotsPollIv);_petitsMotsPollIv=null;} }
      else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'){
        if(!_petitsMotsPollIv) _petitsMotsPollIv=setInterval(function(){ if(typeof window._petitsMotsLoad==='function') window._petitsMotsLoad(); },10000);
      }
    });
  window._yamRTChannels['petitsMots']=_petitsMotsRTCh;
}

// ── Realtime souvenirs ──────────────────────────────────────────
var _souvenirsRTCh = null, _souvenirsPollIv = null;
function _startSouvenirsRT(cid) {
  if(!window._yamRT||!cid||_souvenirsRTCh) return;
  _souvenirsRTCh = window._yamRT.channel('souvenirs-'+cid)
    .on('postgres_changes',{event:'*',schema:'public',table:'memories',filter:'couple_id=eq.'+cid},
        function(){ if(window._souvenirSaving) return; if(typeof window.nousLoadSouvenirs==='function') window.nousLoadSouvenirs(true); })
    .subscribe(function(s){
      if(s==='SUBSCRIBED'){ if(_souvenirsPollIv){clearInterval(_souvenirsPollIv);_souvenirsPollIv=null;} }
      else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'){
        if(!_souvenirsPollIv) _souvenirsPollIv=setInterval(function(){ if(typeof window.nousLoadSouvenirs==='function') window.nousLoadSouvenirs(true); },10000);
      }
    });
  window._yamRTChannels['souvenirs']=_souvenirsRTCh;
}

// ── Realtime activites ──────────────────────────────────────────
var _activitesRTCh = null, _activitesPollIv = null;
function _startActivitesRT(cid) {
  if(!window._yamRT||!cid||_activitesRTCh) return;
  _activitesRTCh = window._yamRT.channel('activites-'+cid)
    .on('postgres_changes',{event:'*',schema:'public',table:'activites',filter:'couple_id=eq.'+cid},
        function(){ window.nousInvalidateActivitesCache(); window.nousLoadActivites(true); if(typeof _nidAutoDetect==='function') setTimeout(_nidAutoDetect,300); })
    .subscribe(function(s){
      if(s==='SUBSCRIBED'){ if(_activitesPollIv){clearInterval(_activitesPollIv);_activitesPollIv=null;} }
      else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'){
        if(!_activitesPollIv) _activitesPollIv=setInterval(function(){ window.nousInvalidateActivitesCache(); window.nousLoadActivites(true); },10000);
      }
    });
  window._yamRTChannels['activites']=_activitesRTCh;
}

// ── Realtime livres ──────────────────────────────────────────
var _livresRTCh = null, _livresPollIv = null;
function _startLivresRT(cid) {
  if(!window._yamRT||!cid||_livresRTCh) return;
  _livresRTCh = window._yamRT.channel('livres-'+cid)
    .on('postgres_changes',{event:'*',schema:'public',table:'books',filter:'couple_id=eq.'+cid},
        function(){ if(typeof window.livresLoad==='function') window.livresLoad(); })
    .subscribe(function(s){
      if(s==='SUBSCRIBED'){ if(_livresPollIv){clearInterval(_livresPollIv);_livresPollIv=null;} }
      else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'){
        if(!_livresPollIv) _livresPollIv=setInterval(function(){ if(typeof window.livresLoad==='function') window.livresLoad(); },10000);
      }
    });
  window._yamRTChannels['livres']=_livresRTCh;
}

// ── Realtime histoire ──────────────────────────────────────────
var _histoireRTCh = null, _histoirePollIv = null;
function _startHistoireRT(cid) {
  if(!window._yamRT||!cid||_histoireRTCh) return;
  _histoireRTCh = window._yamRT.channel('histoire-'+cid)
    .on('postgres_changes',{event:'*',schema:'public',table:'histoire',filter:'couple_id=eq.'+cid},
        function(){ if(typeof window.histoireLoad==='function') window.histoireLoad(); })
    .subscribe(function(s){
      if(s==='SUBSCRIBED'){ if(_histoirePollIv){clearInterval(_histoirePollIv);_histoirePollIv=null;} }
      else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'){
        if(!_histoirePollIv) _histoirePollIv=setInterval(function(){ if(typeof window.histoireLoad==='function') window.histoireLoad(); },10000);
      }
    });
  window._yamRTChannels['histoire']=_histoireRTCh;
}

// ── Realtime photoDescs ──────────────────────────────────────────
var _photoDescsRTCh = null, _photoDescsPollIv = null;
function _startPhotodescsRT(cid) {
  if(!window._yamRT||!cid||_photoDescsRTCh) return;
  _photoDescsRTCh = window._yamRT.channel('photoDescs-'+cid)
    .on('postgres_changes',{event:'*',schema:'public',table:'photo_descs',filter:'couple_id=eq.'+cid},
        function(){
          var cid3=(typeof yamGetUser==='function'&&yamGetUser())?yamGetUser().couple_id:null;
          if(!cid3) return;
          ['elle','lui'].forEach(function(sec){
            fetch(SB_URL+'/rest/v1/photo_descs?couple_id=eq.'+cid3+'&category=eq.'+sec+'_img&select=slot,description',{headers:sb2Headers()})
              .then(function(r){return r.ok?r.json():[];})
              .then(function(rows){ if(typeof _applyImagesFromDB==='function') _applyImagesFromDB(sec,rows); })
              .catch(function(){});
          });
          // Titres, banners et descriptions — RT couvre tout photo_descs
          if(typeof window._loadSectionTitles==='function') window._loadSectionTitles();
          if(typeof window.elleLoadDescs==='function') window.elleLoadDescs();
          if(typeof window.luiLoadDescs==='function')  window.luiLoadDescs();
          if(typeof window.elleSyncSections==='function') window.elleSyncSections();
          // Progression NID partagée — recharger et réappliquer si nous_progress a changé
          if(typeof _nidLoad==='function') _nidLoad(function(){ if(typeof _nidApply==='function') _nidApply(); if(typeof _nidAutoDetect==='function') _nidAutoDetect(); });
        })
    .subscribe(function(s){
      if(s==='SUBSCRIBED'){ if(_photoDescsPollIv){clearInterval(_photoDescsPollIv);_photoDescsPollIv=null;} }
      else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'){
        if(!_photoDescsPollIv) _photoDescsPollIv=setInterval(function(){ if(typeof window.elleLoadImages==='function'){window.elleLoadImages();window.luiLoadImages();}; },10000);
      }
    });
  window._yamRTChannels['photoDescs']=_photoDescsRTCh;
}

// Init au chargement
(function(){
  var u=(typeof yamGetUser==='function')?yamGetUser():null;
  _startMemoRT(u&&u.couple_id?u.couple_id:null);
  _startMemotodoRT(u&&u.couple_id?u.couple_id:null);
  _startPetitsmotsRT(u&&u.couple_id?u.couple_id:null);
  _startSouvenirsRT(u&&u.couple_id?u.couple_id:null);
  _startActivitesRT(u&&u.couple_id?u.couple_id:null);
  _startLivresRT(u&&u.couple_id?u.couple_id:null);
  _startHistoireRT(u&&u.couple_id?u.couple_id:null);
  _startPhotodescsRT(u&&u.couple_id?u.couple_id:null);
})();

// Init après session prête
document.addEventListener('yam:session_ready',function(){
  var u=(typeof yamGetUser==='function')?yamGetUser():null;
  if(!u||!u.couple_id) return;
  // Si on est sur l'onglet Nous et que la page solo était affichée → relancer
  if(window._currentTab === 'nous' && u.partner_pseudo && u.partner_pseudo.trim()) {
    var overlay = document.getElementById('nousLockOverlay');
    var content = document.getElementById('nousContentWrapper');
    var soloShown = (overlay && overlay.className.includes('solo')) ||
                    (content && content.style.display === 'none');
    if(soloShown) {
      window._nousContentLoaded = false;
      setTimeout(function(){ window.nousCheckLock && window.nousCheckLock(); }, 300);
    }
  }
  _memoRTCh=null; _startMemoRT(u.couple_id);
  _memoTodoRTCh=null; _startMemotodoRT(u.couple_id);
  _petitsMotsRTCh=null; _startPetitsmotsRT(u.couple_id);
  _souvenirsRTCh=null; _startSouvenirsRT(u.couple_id);
  _activitesRTCh=null; _startActivitesRT(u.couple_id);
  _livresRTCh=null; _startLivresRT(u.couple_id);
  _histoireRTCh=null; _startHistoireRT(u.couple_id);
  _photoDescsRTCh=null; _startPhotodescsRT(u.couple_id);
});

// 11. MÉMO COUPLE — Note unique + Todo list, sans PIN
//     • Clic Note  → vue lecture (openMemoNoteView) → bouton Modifier → openMemoNoteEdit
//     • Clic Todo  → vue lecture cochable (openMemoTodoView) → bouton Modifier → openMemoTodoEdit
//     • Crayon Note  → édition note seule (openMemoNoteEdit)
//     • Crayon Todo  → édition todo seule (openMemoTodoEdit)
// ════════════════════════════════════════════════════════════════════
(function(){

  function _getSession(){ return (typeof yamGetUser==='function')?yamGetUser():null; }

  // ── Rendu principal : aperçu note + todo côte à côte ──
  function renderMemoCouple(){
    _renderMemoPreview();
    _renderTodoPreview();
  }
  window.renderMemoCouple = renderMemoCouple;
  window.renderNotes = renderMemoCouple;
  window.renderTodos = renderMemoCouple;

  // Variantes batch : injecter sans fetch
  window._memoNoteApply = function(notes) {
    var el = document.getElementById('memoNotePreview'); if(!el) return;
    if(!Array.isArray(notes)||!notes.length){
      el.innerHTML='<span style="color:var(--muted);font-size:12px;">Aucune note — appuie pour écrire</span>';
      var dateEl=document.getElementById('memoNoteDate'); if(dateEl) dateEl.textContent=''; return;
    }
    var note=notes[0];
    var prev=(note.text||'').substring(0,120)+((note.text||'').length>120?'…':'');
    el.textContent=prev;
    var modDate=note.updated_at||note.created_at;
    var d=new Date(modDate);
    var dateEl=document.getElementById('memoNoteDate');
    var isUpd=note.updated_at&&note.updated_at!==note.created_at;
    if(dateEl) dateEl.textContent=(isUpd?'Modifié ':'Créé ')+d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  };
  window._memoTodosApply = function(items) {
    var container=document.getElementById('memoTodoPreview'); if(!container) return;
    container.innerHTML='';
    if(!Array.isArray(items)||!items.length){
      container.innerHTML='<span style="color:var(--muted);font-size:12px;">Liste vide — appuie pour ajouter</span>'; return;
    }
    items.forEach(function(item){
      var row=document.createElement('div'); row.className='memo-todo-preview-row';
      row.innerHTML='<span class="memo-todo-preview-check'+(item.done?' done':'')+'"></span><span class="memo-todo-preview-text'+(item.done?' done':'')+'">'+escHtml(item.text)+'</span>';
      container.appendChild(row);
    });
  };

  // ── Aperçu de la note ──
  function _renderMemoPreview(){
    var el = document.getElementById('memoNotePreview'); if(!el) return;
    var su = _getSession(); var coupleId = su?su.couple_id:null; if(!coupleId){ el.textContent=''; return; }
    fetch(SB_URL+'/rest/v1/memo_notes?couple_id=eq.'+coupleId+'&order=updated_at.desc&limit=1',{headers:sb2Headers()})
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
    fetch(SB_URL+'/rest/v1/memo_todos?couple_id=eq.'+coupleId+'&order=created_at.asc&limit=5',{headers:sb2Headers()})
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
    fetch(SB_URL+'/rest/v1/memo_notes?couple_id=eq.'+coupleId+'&order=updated_at.desc&limit=1',{headers:sb2Headers()})
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
    fetch(SB_URL+'/rest/v1/memo_todos?couple_id=eq.'+coupleId+'&order=created_at.asc',{headers:sb2Headers()})
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
            fetch(SB_URL+'/rest/v1/memo_todos?id=eq.'+it.id+'&couple_id=eq.'+coupleId,{
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
    fetch(SB_URL+'/rest/v1/memo_notes?couple_id=eq.'+coupleId+'&order=updated_at.desc&limit=1',{headers:sb2Headers()})
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
      if(typeof window._nousSignalNewContent==='function') window._nousSignalNewContent('postitsSection');
      if(typeof window._nousSignalNewContent==='function') window._nousSignalNewContent('postitsSection');
      // NOUVEAU : Toast de confirmation
      if(typeof showToast === 'function') showToast('Note sauvegardée ✓', 'success', 2000);
    };
    if(_currentNoteId){
      fetch(SB_URL+'/rest/v1/memo_notes?id=eq.'+_currentNoteId+'&couple_id=eq.'+coupleId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({text:txt,title:ttl,updated_at:new Date().toISOString()})}).then(done).catch(done);
    } else {
      if(!txt) return done();
      fetch(SB_URL+'/rest/v1/memo_notes',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({couple_id:coupleId,text:txt,title:ttl})}).then(function(){ _loadMemoNoteForEdit(); done(); }).catch(done);
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
    fetch(SB_URL+'/rest/v1/memo_todos?couple_id=eq.'+coupleId+'&order=created_at.asc',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(items){
      container.innerHTML='';
      if(!Array.isArray(items)||!items.length){
        var empty=document.createElement('div'); empty.style.cssText='color:var(--muted);font-size:12px;padding:8px;'; empty.textContent='Aucun item.'; container.appendChild(empty);
      } else {
        items.forEach(function(item){
          var row=document.createElement('div'); row.className='todo-item';
          var _cbHtml=(item.done&&item.checked_by)?'<div class="todo-checked-by">par '+escHtml(item.checked_by)+'</div>':'';
          row.innerHTML='<div class="todo-check'+(item.done?' done':'')+'">'+(item.done?'✓':'')+'</div><div class="todo-text-wrap"><div class="todo-text'+(item.done?' done':'')+'">' +escHtml(item.text)+'</div>'+_cbHtml+'</div><div class="todo-del">✕</div>';
          (function(it){
            row.querySelector('.todo-check').addEventListener('click',function(){
              var _p={done:!it.done};
              if(!it.done) _p.checked_by=(typeof yamGetPseudo==='function')?yamGetPseudo():null;
              else _p.checked_by=null;
              fetch(SB_URL+'/rest/v1/memo_todos?id=eq.'+it.id+'&couple_id=eq.'+coupleId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(_p)}).then(_loadTodoFull);
            });
            row.querySelector('.todo-del').addEventListener('click',function(e){ e.stopPropagation();
              fetch(SB_URL+'/rest/v1/memo_todos?id=eq.'+it.id+'&couple_id=eq.'+coupleId,{method:'DELETE',headers:sb2Headers()}).then(_loadTodoFull);
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
    fetch(SB_URL+'/rest/v1/memo_todos',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({couple_id:coupleId,text:txt,done:false})}).then(function(){
      _loadTodoFull();
      if(typeof window.yamMarkNewAndRefresh==='function') window.yamMarkNewAndRefresh('memo_todo');
      if(typeof window._nousSignalNewContent==='function') window._nousSignalNewContent('postitsSection');
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

  function _getCoupleId(){ var u=(typeof yamGetUser==='function')?yamGetUser():null; return u?u.couple_id:null; }

  var _souvenirAllRows = [];

  var _souvenirOffset = 0;
  var _souvenirPageSize = 20;
  var _souvenirHasMore = false;

  window.nousLoadSouvenirs = function(reset){
    var coupleId=_getCoupleId(); if(!coupleId) return;
    if(reset !== false){ _souvenirOffset = 0; _souvenirAllRows = []; }
    fetch(SB_URL+'/rest/v1/memories?couple_id=eq.'+coupleId+'&order=created_at.desc&select=*&limit='+(_souvenirPageSize+1)+'&offset='+_souvenirOffset,{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      rows = Array.isArray(rows)?rows:[];
      _souvenirHasMore = rows.length > _souvenirPageSize;
      if(_souvenirHasMore) rows = rows.slice(0, _souvenirPageSize);
      if(_souvenirOffset === 0){
        _souvenirAllRows = rows;
      } else {
        _souvenirAllRows = _souvenirAllRows.concat(rows);
      }
      _souvenirOffset += rows.length;
      _renderSouvenirRows(_souvenirAllRows);
      _updateSouvenirLoadMore();
      var overlay=document.getElementById('souvenirGestionOverlay');
      if(overlay&&overlay.classList.contains('open')){ _renderGestionList(); }
    }).catch(function(){ });
  };

  function _updateSouvenirLoadMore(){
    var existing = document.getElementById('souvenirLoadMoreBtn');
    var recentRow = document.getElementById('souvenirsRecentRow');
    if(!recentRow) return;
    if(_souvenirHasMore){
      if(!existing){
        var btn = document.createElement('button');
        btn.id = 'souvenirLoadMoreBtn';
        btn.className = 'activite-new-btn';
        btn.style.cssText = 'margin:8px auto;display:block;font-size:12px;';
        btn.textContent = 'Charger plus (' + _souvenirPageSize + ' suivants)';
        btn.addEventListener('click', function(){ window.nousLoadSouvenirs(false); });
        recentRow.parentNode.insertBefore(btn, recentRow.nextSibling);
      }
    } else {
      if(existing) existing.remove();
    }
  }
  window._renderSouvenirRowsPublic = function(rows) { _renderSouvenirRows(rows); };

  function _souvenirAnnivYears(ds){
    if(!ds) return null;
    var t=new Date(),ty=t.getFullYear();
    for(var o=0;o<=7;o++){
      var d=new Date(t.getFullYear(),t.getMonth(),t.getDate()+o);
      var m=new Date(ds+'T12:00:00');
      if(m.getMonth()===d.getMonth()&&m.getDate()===d.getDate()){
        var y=ty-m.getFullYear(); return y>0?y:null;
      }
    }
    return null;
  }

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
    // Anniversaires J+0→J+7 en tête
    var annivMap={}; rows.forEach(function(s){ var y=_souvenirAnnivYears(s.date); if(y) annivMap[s.id]=y; });
    var annivRows=rows.filter(function(s){ return !!annivMap[s.id]; })
      .sort(function(a,b){
        function off(ds){ var t=new Date(); for(var o=0;o<=7;o++){ var d=new Date(t.getFullYear(),t.getMonth(),t.getDate()+o),m=new Date(ds+'T12:00:00'); if(m.getMonth()===d.getMonth()&&m.getDate()===d.getDate()) return o; } return 8; }
        return off(a.date)-off(b.date);
      });
    var annivIds={}; annivRows.forEach(function(s){ annivIds[s.id]=true; });
    if(annivRows.length){ recentRow.style.display='block'; annivRows.forEach(function(s){ recentScroll.appendChild(_buildSouvenirCard(s,annivMap[s.id])); }); }
    var favs=rows.filter(function(s){ return s.is_fav&&!annivIds[s.id]; });
    var recent=rows.filter(function(s){ return !s.is_fav&&!annivIds[s.id]; }).slice(0,5);
    if(favs.length){ favRow.style.display='block'; favs.forEach(function(s){ favScroll.appendChild(_buildSouvenirCard(s,null)); }); } else { favRow.style.display='none'; }
    if(recent.length){ recentRow.style.display='block'; recent.forEach(function(s){ recentScroll.appendChild(_buildSouvenirCard(s,null)); }); } else if(!annivRows.length){ recentRow.style.display='none'; }
  }

  function _buildSouvenirCard(s,annivYears){
    var card=document.createElement('div'); card.className='souvenir-card'+(annivYears?' souvenir-card--anniv':'');
    var photoUrl=s.photo_url||'';
    var dateStr=s.date?new Date(s.date+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):'';
    var photoStyle=photoUrl?'background-image:url('+escHtml(photoUrl)+');':'';
    card.innerHTML=
      '<div class="souvenir-photo" style="'+photoStyle+'">'
      +(photoUrl?'':'<span style="font-size:28px;opacity:0.3;">&#128247;</span>')
      +(s.lieu?'<div class="souvenir-lieu">&#128205; '+escHtml(s.lieu)+'</div>':'')
      +'</div>'
      +'<div class="souvenir-info">'
      +'<div class="souvenir-info-text">'
      +'<div class="souvenir-name">'+escHtml(s.title||'Souvenir')+'</div>'
      +(dateStr?'<div class="souvenir-date">'+escHtml(dateStr)+'</div>':'')
      +(annivYears?'<div class="souvenir-anniv-badge">📅 Il y a '+annivYears+' an'+(annivYears>1?'s':'')+'</div>':'')
      +'</div>'
      +'</div>';
    // Clic sur la photo → vue en grand
    if(photoUrl){
      card.querySelector('.souvenir-photo').addEventListener('click', function(e){
        e.stopPropagation();
        if(typeof window.souvenirOpenView==='function') window.souvenirOpenView(s);
      });
    }
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
        fetch(SB_URL+'/rest/v1/memories?id=eq.'+id,{
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
    var file=input.files[0];
    var coupleId=_getCoupleId(); if(!coupleId) return;

    // Détection HEIC
    var isHeic = file.type==='image/heic' || file.type==='image/heif'
              || file.name.toLowerCase().endsWith('.heic')
              || file.name.toLowerCase().endsWith('.heif');
    if(isHeic){
      if(typeof showToast==='function') showToast('Format HEIC non supporté — convertissez en JPG dans Photos puis réessayez', 'error', 4500);
      return;
    }

    var ALLOWED=['image/jpeg','image/jpg','image/png','image/webp'];
    if(ALLOWED.indexOf(file.type)===-1){
      if(typeof showToast==='function') showToast('Format non autorisé — utilisez JPG, PNG ou WebP', 'error', 3500);
      return;
    }

    var modal=document.getElementById('souvenirModal');
    var preview=document.getElementById('souvenirPhotoPreview');
    if(preview){ preview.innerHTML='<div style="font-size:13px;color:var(--muted);">Compression...</div>'; }

    var path='memories/'+coupleId+'/'+Date.now()+'.jpg';

    var doUpload = function(blob){
      if(preview){ preview.innerHTML='<div style="font-size:13px;color:var(--muted);">Envoi...</div>'; }
      fetch(SB_URL+'/storage/v1/object/images/'+path,{method:'POST',headers:Object.assign({'Content-Type':'image/jpeg','x-upsert':'true'},sb2Headers()),body:blob})
      .then(function(r){ return r.text().then(function(){ return r.ok; }); })
      .then(function(ok){
        if(ok){
          var url=SB_URL+'/storage/v1/object/public/images/'+path;
          if(modal) modal.dataset.photoUrl=url;
          if(preview){ preview.style.backgroundImage='url('+url+')'; preview.style.backgroundSize='cover'; preview.style.backgroundPosition='center'; preview.innerHTML=''; }
          if(typeof showToast==='function') showToast('✅ Photo optimisée : '+_uploadedKo+' Ko', 'success', 2500);
        } else {
          if(preview) preview.innerHTML='<div style="font-size:11px;color:#e05555;">Erreur upload</div>';
          if(typeof showToast==='function') showToast('Erreur upload — réessaie', 'error', 3000);
        }
      }).catch(function(){
        if(preview) preview.innerHTML='<div style="font-size:11px;color:#e05555;">Erreur réseau</div>';
        if(typeof showToast==='function') showToast('Erreur réseau — vérifie ta connexion', 'error', 3000);
      });
    };

    var _uploadedKo = 0;
    var _origDoUpload = doUpload;
    doUpload = function(blob){ _uploadedKo = Math.round(blob.size/1024); _origDoUpload(blob); };

    // Compression — max 1400px, cible 600 Ko
    if(typeof window.compressImage === 'function'){
      window.compressImage(file, 1400, 600*1024)
        .then(function(blob){
          doUpload(blob);
        })
        .catch(function(err){
          if(err && err.message === 'PHOTO_TOO_LARGE'){
            if(typeof showToast==='function') showToast('Photo trop lourde (5 Mo max après compression)', 'error', 4000);
            return;
          }
          if(typeof showToast==='function') showToast('Compression impossible — envoi en l\'original', 'info', 2500);
          doUpload(file);
        });
    } else {
      doUpload(file);
    }
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
      window._souvenirSaving=true;
      fetch(SB_URL+'/rest/v1/memories?id=eq.'+id,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)})
      .then(function(){
        if(saveBtn){ saveBtn.textContent='Sauvegarder'; saveBtn.disabled=false; }
        if(typeof window.yamMarkNew==='function') window.yamMarkNew('souvenir');
        if(typeof window.yamMarkNewAndRefresh==='function') window.yamMarkNewAndRefresh('souvenir_'+id);
        if(typeof window.yamFlameActivity==='function') window.yamFlameActivity('souvenir_new');
        window.closeSouvenirModal(); window.nousLoadSouvenirs();
        setTimeout(function(){ window._souvenirSaving=false; }, 3000);
        if(typeof window._nousSignalNewContent==='function') window._nousSignalNewContent('activitesSection');
      }).catch(function(){
        window._souvenirSaving=false;
        if(saveBtn){ saveBtn.textContent='Sauvegarder'; saveBtn.disabled=false; }
        window.closeSouvenirModal(); window.nousLoadSouvenirs();
      });
    } else {
      // Création — on récupère l'ID retourné
      window._souvenirSaving=true;
      fetch(SB_URL+'/rest/v1/memories',{method:'POST',headers:sb2Headers({'Prefer':'return=representation','Content-Type':'application/json'}),body:JSON.stringify(data)})
      .then(function(r){ return r.json(); })
      .then(function(rows){
        if(saveBtn){ saveBtn.textContent='Sauvegarder'; saveBtn.disabled=false; }
        var newId = Array.isArray(rows) && rows[0] ? rows[0].id : null;
        if(typeof window.yamMarkNew==='function') window.yamMarkNew('souvenir');
        if(newId && typeof window.yamMarkNewAndRefresh==='function') window.yamMarkNewAndRefresh('souvenir_'+newId);
        if(typeof window.yamFlameActivity==='function') window.yamFlameActivity('souvenir_new');
        window.closeSouvenirModal(); window.nousLoadSouvenirs();
        setTimeout(function(){ window._souvenirSaving=false; }, 3000);
        if(typeof window._nousSignalNewContent==='function') window._nousSignalNewContent('activitesSection');
      }).catch(function(){
        window._souvenirSaving=false;
        if(saveBtn){ saveBtn.textContent='Sauvegarder'; saveBtn.disabled=false; }
        window.closeSouvenirModal(); window.nousLoadSouvenirs();
      });
    }
  };

  window.souvenirDelete=function(){
    var modal=document.getElementById('souvenirModal'); if(!modal) return;
    var id=modal.dataset.souvenirId; if(!id) return;
    if(!confirm('Supprimer ce souvenir ?')) return;
    fetch(SB_URL+'/rest/v1/memories?id=eq.'+id,{method:'DELETE',headers:sb2Headers()})
    .then(function(){ window.closeSouvenirModal(); window.nousLoadSouvenirs(); if(typeof window._nousSignalNewContent==='function') window._nousSignalNewContent('souvenirsSection'); }).catch(function(){});
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

  function _getCoupleId(){ var u=(typeof yamGetUser==='function')?yamGetUser():null; return u?u.couple_id:null; }

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
  var _ACTIVITES_CACHE_TTL = 3600 * 1000; // 1h en ms

  function _activitesCacheKey(coupleId){ return 'yam_activites_cache_' + coupleId; }

  function _activitesGetCache(coupleId){
    try {
      var raw = localStorage.getItem(_activitesCacheKey(coupleId));
      if(!raw) return null;
      var obj = JSON.parse(raw);
      if(Date.now() - obj.ts > _ACTIVITES_CACHE_TTL) { localStorage.removeItem(_activitesCacheKey(coupleId)); return null; }
      return obj.data;
    } catch(e){ return null; }
  }

  function _activitesSetCache(coupleId, data){
    try { localStorage.setItem(_activitesCacheKey(coupleId), JSON.stringify({ ts: Date.now(), data: data })); } catch(e){}
  }

  window.nousInvalidateActivitesCache = function(){
    var coupleId = _getCoupleId();
    if(coupleId) localStorage.removeItem(_activitesCacheKey(coupleId));
  };

  window.nousLoadActivites=function(forceRefresh){
    var coupleId=_getCoupleId(); if(!coupleId) return;
    var container=document.getElementById('activitesContainer'); if(!container) return;

    // Utiliser le cache si disponible et pas de forceRefresh
    if(!forceRefresh){
      var cached = _activitesGetCache(coupleId);
      if(cached){
        _activiteAllRows = cached;
        _renderActivitesHome();
        var overlayC=document.getElementById('activiteGestionOverlay');
        if(overlayC&&overlayC.classList.contains('open')){ _renderActiviteGestionList(); }
        return;
      }
    }

    container.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px;">Chargement...</div>';
    fetch(SB_URL+'/rest/v1/activites?couple_id=eq.'+coupleId+'&order=created_at.desc&select=*',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      _activiteAllRows = Array.isArray(rows)?rows:[];
      _activitesSetCache(coupleId, _activiteAllRows);
      _renderActivitesHome();
      // Si l'overlay gestion est ouvert, le rafraîchir aussi
      var overlay=document.getElementById('activiteGestionOverlay');
      if(overlay&&overlay.classList.contains('open')){ _renderActiviteGestionList(); }
    }).catch(function(){ container.innerHTML='<div style="color:var(--muted);font-size:13px;padding:16px;">Erreur de chargement</div>'; });
  };
  window._renderActivitesHomePublic = function() { _renderActivitesHome(); };

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
        '<div class="activite-header"><span class="activite-emoji">'+escHtml(todaySuggested.emoji||'✨')+'</span>'+
        '<div class="activite-info"><div class="activite-titre">'+escHtml(todaySuggested.titre)+'</div>'+
        '<div class="activite-desc">'+escHtml(todaySuggested.desc)+'</div></div></div>'+
        '<button class="activite-add-btn">Ajouter à nos activités</button>';
      suggCard.dataset.sugg=JSON.stringify(todaySuggested);
      container.appendChild(suggCard);
      var _addBtn = suggCard.querySelector('.activite-add-btn');
      if(_addBtn) _addBtn.addEventListener('click', function(){ window.nousAddSuggestedActivite && window.nousAddSuggestedActivite(); });
    }

    // 1 carte max — tri : étoilées non-terminées en tête, terminées en bas
    var sorted=_sortForHome(_activiteAllRows);
    var toShow=sorted.slice(0,1);
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
        '<span class="activite-emoji">'+escHtml(act.emoji||'✨')+'</span>'+
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
        '<div class="activite-gestion-emoji">'+escHtml(act.emoji||'✨')+'</div>'+
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
        fetch(SB_URL+'/rest/v1/activites?id=eq.'+id,{
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
    fetch(SB_URL+'/rest/v1/activites?id=eq.'+actId+'&couple_id=eq.'+coupleId+'&select=steps',{headers:sb2Headers()})
    .then(function(r){ return r.json(); })
    .then(function(rows){
      if(!rows||!rows[0]) return;
      var steps=[]; try{ steps=JSON.parse(rows[0].steps||'[]'); }catch(e){}
      if(steps[stepIdx]) steps[stepIdx].done=!steps[stepIdx].done;
      // Mettre à jour le cache local immédiatement
      var cached=_activiteAllRows.filter(function(x){return String(x.id)===String(actId);})[0];
      if(cached) cached.steps=JSON.stringify(steps);
      return fetch(SB_URL+'/rest/v1/activites?id=eq.'+actId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({steps:JSON.stringify(steps)})});
    }).then(function(){ window.nousInvalidateActivitesCache(); window.nousLoadActivites(true); }).catch(function(){});
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
    row.innerHTML='<input type="text" class="activite-step-input" placeholder="Étape..." value="'+escHtml(val||'')+'" maxlength="80"><button class="activite-step-del">✕</button>';
    var _delBtn = row.querySelector('.activite-step-del');
    if(_delBtn) _delBtn.addEventListener('click', function(){ row.remove(); });
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
    var done2=function(){ if(btn){ btn.textContent='Sauvegarder'; btn.disabled=false; } window.closeActiviteModal(); window.nousLoadActivites();
      // Appeler _nidAutoDetect directement — activitesSection peut déjà être unlocked
      // donc _nousSignalNewContent ferait un early return sans jamais appeler autoDetect
      if(typeof _nidAutoDetect==='function') setTimeout(_nidAutoDetect, 300);
    };
    if(id){
      fetch(SB_URL+'/rest/v1/activites?id=eq.'+id,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)}).then(done2).catch(done2);
    } else {
      fetch(SB_URL+'/rest/v1/activites',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)})
      .then(function(){
        if(typeof window.yamFlameActivity==='function') window.yamFlameActivity('activite_done');
        done2();
      }).catch(done2);
    }
  };

  window.activiteDelete=function(){
    var modal=document.getElementById('activiteModal'); if(!modal) return;
    var id=modal.dataset.actId; if(!id) return;
    if(!confirm('Supprimer cette activité ?')) return;
    var coupleId=_getCoupleId(); if(!coupleId) return;
    fetch(SB_URL+'/rest/v1/activites?id=eq.'+id+'&couple_id=eq.'+coupleId,{method:'DELETE',headers:sb2Headers()})
    .then(function(){ window.closeActiviteModal(); window.nousLoadActivites(); if(typeof window._nousSignalNewContent==='function') window._nousSignalNewContent('activitesSection'); }).catch(function(){});
  };

  window.nousAddSuggestedActivite=function(){
    var card=document.querySelector('.activite-sugg-card'); if(!card) return;
    var sugg=JSON.parse(card.dataset.sugg||'{}');
    var coupleId=_getCoupleId(); if(!coupleId) return;
    var data={ couple_id:coupleId, title:sugg.titre, description:sugg.desc, emoji:sugg.emoji, steps:JSON.stringify(sugg.steps.map(function(s){ return {text:s,done:false}; })), is_suggested:true };
    fetch(SB_URL+'/rest/v1/activites',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)})
    .then(function(){
      // Invalider le cache avant de recharger
      if(typeof window.nousInvalidateActivitesCache==='function') window.nousInvalidateActivitesCache();
      window.nousLoadActivites(true);
      if(typeof window.nousSignalNew==='function') window.nousSignalNew();
      // Appeler _nidAutoDetect directement — activitesSection peut déjà être unlocked
      // donc _nousSignalNewContent ferait un early return sans jamais appeler autoDetect
      if(typeof _nidAutoDetect==='function') setTimeout(_nidAutoDetect, 300);
    })
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
    var u = (typeof yamGetUser==='function') ? yamGetUser() : null;
    var partnerName = u ? (u.partner_pseudo || 'ton partenaire') : 'ton partenaire';
    var daysTogether = 0;
    if(window.startDate){ daysTogether = Math.floor((Date.now()-new Date(window.startDate))/(1000*60*60*24)); }

    var saison = ['hiver','hiver','printemps','printemps','printemps','été','été','été','automne','automne','automne','hiver'][new Date().getMonth()];
    var doneActivites = _activiteAllRows.filter(function(a){ return _actDone(a); }).map(function(a){ return a.title; }).slice(0,5);

    var prompt = 'Tu es un assistant bienveillant pour un couple. Propose UNE seule activité originale et concrète à faire ensemble, adaptée à la saison ('+saison+') et au fait qu\'ils sont ensemble depuis '+daysTogether+' jours.'+
      (doneActivites.length ? ' Ils ont déjà fait : '+doneActivites.join(', ')+'. Évite ces activités.' : '')+
      ' Réponds UNIQUEMENT en JSON strict, sans aucun texte autour, avec ce format exact : {"emoji":"🎯","title":"Titre court","description":"Une phrase courte et motivante","steps":["Étape 1","Étape 2","Étape 3"]}';

    var SB2_EDGE_GEMINI = SB_URL + '/functions/v1/gemini-suggest';
    fetch(SB2_EDGE_GEMINI, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (yamGetAccessToken ? yamGetAccessToken() : ''), 'apikey': SB_ANON_KEY },
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
      textEl.innerHTML = '<strong>'+escHtml(parsed.emoji||'✨')+' '+escHtml(parsed.title||'')+'</strong><br><span style="font-weight:400;">'+escHtml(parsed.description||'')+'</span>';
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
    fetch(SB_URL+'/rest/v1/activites',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)})
    .then(function(){
      _iaSuggCache = null;
      var card = document.getElementById('activiteIaSuggCard');
      if(card) card.style.display = 'none';
      window.nousInvalidateActivitesCache(); window.nousLoadActivites(true);
    }).catch(function(){});
  };

})();



// ════════════════════════════════════════════════════════════════════
// 15. NOTRE HISTOIRE v2 — Bulle + Bandeau scroll horizontal
// Table : v2_histoire (id, couple_id, emoji, date_label, title, text, sort_order, created_at)
// ════════════════════════════════════════════════════════════════════
(function(){

  function _getCoupleId(){ var u=(typeof yamGetUser==='function')?yamGetUser():null; return u?u.couple_id:null; }

  var _histoireAllRows = [];
  var _histoireSelectedIndex = 0; // index du chapitre affiché dans la bulle
  var _histoireEditingId = null;
  var _histoireFromGestion = false;

  // ── Rendu bulle principale ──
  function _renderBulle(item) {
    var metaEl   = document.getElementById('histoireBulleMeta');
    var titreEl  = document.getElementById('histoireBulleTitre');
    var texteEl  = document.getElementById('histoireBulleTexte');
    if (!metaEl || !titreEl || !texteEl) return;

    if (!item) {
      metaEl.textContent  = '';
      titreEl.textContent = 'Notre histoire commence... 🌟';
      texteEl.textContent = 'Clique sur Éditer pour ajouter vos premiers chapitres.';
      return;
    }

    var metaStr = '';
    if (item.emoji)      metaStr += item.emoji + ' · ';
    if (item.date_label) metaStr += item.date_label.toUpperCase();
    metaEl.textContent = metaStr;
    titreEl.textContent = item.title || '';

    // 1ère ligne du texte seulement
    var fullText = item.text || '';
    var firstLine = fullText.split('\n')[0];
    // Tronquer à ~80 caractères
    if (firstLine.length > 80) firstLine = firstLine.slice(0, 80) + '…';
    texteEl.textContent = firstLine || '…';
  }

  // ── Rendu bandeau scroll horizontal ──
  function _renderBandeau() {
    var bandeau = document.getElementById('histoireBandeau');
    if (!bandeau) return;
    bandeau.innerHTML = '';

    if (!_histoireAllRows.length) return;

    var sorted = _histoireAllRows.slice().sort(function(a,b){
      if((a.sort_order||0) !== (b.sort_order||0)) return (a.sort_order||0)-(b.sort_order||0);
      return (a.created_at||'').localeCompare(b.created_at||'');
    });

    sorted.forEach(function(item, idx) {
      var tab = document.createElement('div');
      tab.className = 'histoire-bandeau-tab' + (idx === _histoireSelectedIndex ? ' active' : '');
      tab.innerHTML =
        '<div class="histoire-bandeau-num">CHAP. ' + (idx + 1) + '</div>' +
        '<div class="histoire-bandeau-titre">' + escHtml(item.title || 'À écrire...') + '</div>';
      (function(i, it){
        tab.addEventListener('click', function(){
          _histoireSelectedIndex = i;
          _rIdx = i; // syncer le lecteur avec la sélection
          _renderBulle(it);
          _renderBandeau();
          // Scroll dans le bandeau uniquement — jamais sur la page
          var b = document.getElementById('histoireBandeau');
          if (b) {
            var tabWidth = b.scrollWidth / b.children.length;
            var target = tabWidth * i - (b.clientWidth / 2) + (tabWidth / 2);
            b.scrollLeft = Math.max(0, target);
          }
        });
      })(idx, item);
      bandeau.appendChild(tab);
    });

    // Scroll automatique vers le tab actif — dans le bandeau uniquement
    setTimeout(function(){
      var b = document.getElementById('histoireBandeau');
      if (!b || !b.children.length) return;
      var tabWidth = b.scrollWidth / b.children.length;
      var target = tabWidth * _histoireSelectedIndex - (b.clientWidth / 2) + (tabWidth / 2);
      b.scrollLeft = Math.max(0, target);
    }, 50);
  }

  // ── Chargement depuis Supabase ──
  window.histoireLoad = function(){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    fetch(SB_URL+'/rest/v1/histoire?couple_id=eq.'+coupleId+'&order=sort_order.asc,created_at.asc&select=*',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():[]; })
    .then(function(rows){
      _histoireAllRows = Array.isArray(rows) ? rows : [];
      // Garder l'index sélectionné dans les bornes
      if (_histoireSelectedIndex >= _histoireAllRows.length) _histoireSelectedIndex = 0;
      var sorted = _histoireAllRows.slice().sort(function(a,b){
        if((a.sort_order||0)!=(b.sort_order||0)) return (a.sort_order||0)-(b.sort_order||0);
        return (a.created_at||'').localeCompare(b.created_at||'');
      });
      _renderBulle(sorted[_histoireSelectedIndex] || null);
      _renderBandeau();
      // Compatibilité : si overlay gestion ouvert, rafraîchir
      var overlay = document.getElementById('histoireGestionOverlay');
      if(overlay && overlay.classList.contains('open')) _histoireRenderGestionList();
    }).catch(function(){});
  };

  // Maintenu pour compatibilité (appelé depuis app-account.js / YAM_COUPLE)
  window.histoireRenderTimeline = function(items){
    _histoireAllRows = Array.isArray(items) ? items : [];
    if (_histoireSelectedIndex >= _histoireAllRows.length) _histoireSelectedIndex = 0;
    var sorted = _histoireAllRows.slice().sort(function(a,b){
      if((a.sort_order||0)!=(b.sort_order||0)) return (a.sort_order||0)-(b.sort_order||0);
      return (a.created_at||'').localeCompare(b.created_at||'');
    });
    _renderBulle(sorted[_histoireSelectedIndex] || null);
    _renderBandeau();
  };

  // ── Modale chapitre complet — positionnée absolue sur la bulle ──
  // ── Lecteur chapitres (#100) ──────────────────────────────────────────────────
  // app-inline.js fait display:flex sur #histoireChapterModal au clic bulle.
  // On intercepte via MutationObserver pour peupler titre/texte/nav sans 
  // modifier app-inline.js.
  var _rIdx = 0;
  var _histoireObserverInited = false;

  function _histoireSorted() {
    return _histoireAllRows.slice().sort(function(a,b){
      if((a.sort_order||0)!=(b.sort_order||0)) return (a.sort_order||0)-(b.sort_order||0);
      return (a.created_at||'').localeCompare(b.created_at||'');
    });
  }

  function _initHistoireObserver() {
    if (_histoireObserverInited) return;
    var modal = document.getElementById('histoireChapterModal');
    if (!modal) return;
    _histoireObserverInited = true;
    var obs = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.type === 'attributes' && m.attributeName === 'style') {
          var d = modal.style.display;
          if (d === 'flex' || d === 'block') {
            _histoirePopulateModal();
          }
        }
      });
    });
    obs.observe(modal, { attributes: true, attributeFilter: ['style'] });
  }

  function _histoirePopulateModal() {
    var sorted = _histoireSorted();
    if (!sorted.length) return;
    _rIdx = Math.max(0, Math.min(_rIdx, sorted.length - 1));
    var item = sorted[_rIdx];
    if (!item) return;
    var metaStr = '';
    if (item.emoji)      metaStr += item.emoji + ' · ';
    if (item.date_label) metaStr += item.date_label.toUpperCase();
    var metaEl  = document.getElementById('histoireChapterModalMeta');
    var titreEl = document.getElementById('histoireChapterModalTitre');
    var texteEl = document.getElementById('histoireChapterModalTexte');
    if (metaEl)  metaEl.textContent  = metaStr;
    if (titreEl) titreEl.textContent = item.title || '';
    if (texteEl) {
      texteEl.textContent = item.text || '';
      texteEl.style.maxHeight = 'calc(60vh - 160px)';
      texteEl.style.overflowY = 'auto';
      texteEl.style.webkitOverflowScrolling = 'touch';
    }
    // Navigation
    var modal = document.getElementById('histoireChapterModal');
    var navEl = document.getElementById('histoireModalNav');
    if (!navEl) {
      navEl = document.createElement('div');
      navEl.id = 'histoireModalNav';
      navEl.className = 'histoire-modal-nav';
      var content = modal ? modal.querySelector('.histoire-chapter-modal-content') : null;
      if (content) content.appendChild(navEl);
    }
    var hasPrev = _rIdx > 0, hasNext = _rIdx < sorted.length - 1;
    navEl.innerHTML =
      '<span class="histoire-modal-counter">' + (_rIdx+1) + ' / ' + sorted.length + '</span>' +
      '<div class="histoire-modal-nav-btns">' +
        '<button class="histoire-modal-nav-btn' + (hasPrev?'':' hidden') + '" id="hmnPrev">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15,18 9,12 15,6"/></svg>' +
        '</button>' +
        '<button class="histoire-modal-nav-btn histoire-modal-nav-btn--next' + (hasNext?'':' hidden') + '" id="hmnNext">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,18 15,12 9,6"/></svg>' +
        '</button>' +
      '</div>';
    var bp = document.getElementById('hmnPrev');
    var bn = document.getElementById('hmnNext');
    if (bp) bp.onclick = function(e) { e.stopPropagation(); _rIdx = Math.max(0, _rIdx-1); _histoirePopulateModal(); };
    if (bn) bn.onclick = function(e) { e.stopPropagation(); _rIdx = Math.min(sorted.length-1, _rIdx+1); _histoirePopulateModal(); };
  }

  function _histoireRenderModal(sorted, idx) {
    var item = sorted[idx]; if(!item) return;
    var modal = document.getElementById('histoireChapterModal'); if(!modal) return;

    // Meta
    var metaStr = '';
    if(item.emoji)      metaStr += item.emoji + ' · ';
    if(item.date_label) metaStr += item.date_label.toUpperCase();
    document.getElementById('histoireChapterModalMeta').textContent  = metaStr;
    document.getElementById('histoireChapterModalTitre').textContent = item.title || '';
    document.getElementById('histoireChapterModalTexte').textContent = item.text || '';

    // Navigation entre chapitres
    var navEl = document.getElementById('histoireModalNav');
    if(!navEl) {
      navEl = document.createElement('div');
      navEl.id = 'histoireModalNav';
      navEl.className = 'histoire-modal-nav';
      var content = modal.querySelector('.histoire-chapter-modal-content');
      if(content) content.appendChild(navEl);
    }
    var hasPrev = idx > 0, hasNext = idx < sorted.length - 1;
    navEl.innerHTML =
      '<span class="histoire-modal-counter">' + (idx+1) + ' / ' + sorted.length + '</span>' +
      '<div class="histoire-modal-nav-btns">' +
        '<button class="histoire-modal-nav-btn'+(hasPrev?'':' hidden')+'" id="hmnPrev">'
        +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15,18 9,12 15,6"/></svg>'
        +'</button>' +
        '<button class="histoire-modal-nav-btn histoire-modal-nav-btn--next'+(hasNext?'':' hidden')+'" id="hmnNext">'
        +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,18 15,12 9,6"/></svg>'
        +'</button>' +
      '</div>';
    var bPrev = document.getElementById('hmnPrev');
    var bNext = document.getElementById('hmnNext');
    if(bPrev) bPrev.onclick = function(e){ e.stopPropagation(); if(_rIdx>0){_rIdx--;_histoireRenderModal(sorted,_rIdx);_histoireSelectedIndex=_rIdx;} };
    if(bNext) bNext.onclick = function(e){ e.stopPropagation(); if(_rIdx<sorted.length-1){_rIdx++;_histoireRenderModal(sorted,_rIdx);_histoireSelectedIndex=_rIdx;} };
  }

  window.histoireOpenChapterModal = function() {
    // Syncer l'index avec le chapitre sélectionné dans le bandeau
    _rIdx = _histoireSelectedIndex;
    // L'observer va peupler automatiquement quand display change
    // Si appelé programmatiquement (pas via app-inline), on peuple directement
    _histoirePopulateModal();
    _initHistoireObserver();
  };

  window.histoireCloseChapterModal = function() {
    var modal = document.getElementById('histoireChapterModal');
    if(modal) modal.style.display = 'none';
  };

  // Click en dehors ferme la modale
  document.addEventListener('click', function(e){
    var modal = document.getElementById('histoireChapterModal');
    if(!modal || modal.style.display === 'none') return;
    var bulle = document.getElementById('histoireBulle');
    if(bulle && bulle.contains(e.target)) return;
    if(!modal.contains(e.target)) window.histoireCloseChapterModal();
  });

  // Binding du bouton close (l'event listener est ici, pas dans app-inline.js)
  setTimeout(function(){
    var btn = document.getElementById('histoireCloseChapterBtn');
    if(btn) btn.addEventListener('click', function(e){ e.stopPropagation(); window.histoireCloseChapterModal(); });
  }, 0);

  // ── Overlay gestion (inchangé) ──
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
        '<div class="histoire-gestion-emoji">'+escHtml(item.emoji||'📅')+'</div>'+
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

  // ── Modal item édition (inchangé) ──
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
    var emoji     = document.getElementById('histoireItemEmoji').value.trim()||'💘';
    var dateLabel = document.getElementById('histoireItemDate').value.trim();
    var title     = document.getElementById('histoireItemTitle').value.trim();
    var text      = document.getElementById('histoireItemText').value.trim();
    if(!title){ if(typeof showToast==='function') showToast('Le titre est obligatoire', 'error'); return; }
    var data = { couple_id: coupleId, emoji: emoji, date_label: dateLabel, title: title, text: text };
    var btn = document.getElementById('histoireItemSaveBtn');
    if(btn){ btn.textContent='...'; btn.disabled=true; }
    var done = function(){ if(btn){btn.textContent='Sauvegarder';btn.disabled=false;} window.histoireCloseItemModal(); window.histoireLoad(); };
    if(_histoireEditingId){
      fetch(SB_URL+'/rest/v1/histoire?id=eq.'+_histoireEditingId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)}).then(done).catch(done);
    } else {
      fetch(SB_URL+'/rest/v1/histoire',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)})
      .then(function(){ if(typeof window.yamFlameActivity==='function') window.yamFlameActivity('histoire_new'); done(); }).catch(done);
    }
  };

  window.histoireDeleteItem = function(){
    if(!_histoireEditingId) return;
    if(!confirm('Supprimer ce chapitre ?')) return;
    var coupleId = _getCoupleId();
    fetch(SB_URL+'/rest/v1/histoire?id=eq.'+_histoireEditingId+'&couple_id=eq.'+coupleId,{method:'DELETE',headers:sb2Headers()})
    .then(function(){ window.histoireCloseItemModal(); window.histoireLoad(); }).catch(function(){});
  };

  // Click-dehors modal item
  var _hModal = document.getElementById('histoireItemModal');
  if(_hModal) _hModal.addEventListener('click',function(e){ if(e.target===_hModal) window.histoireCloseItemModal(); });

  // Init
  document.addEventListener('nousContentReady', function(){ window.histoireLoad(); setTimeout(_initHistoireObserver, 300); });
  setTimeout(function(){ if(!_histoireAllRows.length) window.histoireLoad(); }, 2000);

})();


// ════════════════════════════════════════════════════════════════════
// SECTION LIVRES — Pochettes dynamiques couple, badge NEW, Idée du jour Groq
// Table : v2_books (id, couple_id, idx, title, description, has_image, position, created_at, updated_at)
// ════════════════════════════════════════════════════════════════════
(function(){

  var SB_BUCKET = 'images';
  var GROQ_EDGE = SB_URL + '/functions/v1/gemini-suggest';
  var MAX_VISIBLE = 5; // pochettes visibles dans le slider

  function _getCoupleId(){ var u=(typeof yamGetUser==='function')?yamGetUser():null; return u?u.couple_id:null; }

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
    fetch(SB_URL+'/rest/v1/books?couple_id=eq.'+coupleId+'&order=position.asc,created_at.desc&select=*',{headers:sb2Headers()})
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
  window._renderLivresSliderPublic = function() { _renderLivresSlider(); };

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
    var photoUrl = book.has_image ? (SB_URL+'/storage/v1/object/public/'+SB_BUCKET+'/books/'+book.couple_id+'/'+book.id+'.jpg?t='+Math.floor(Date.now()/60000)) : '';
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
      '</div>'+
      '<div class="album-desc" style="cursor:default;">'+escHtml(book.description||'Ajouter une légende...')+'</div>';
    // Clic sur la pochette → vue en grand
    card.querySelector('.album-image').addEventListener('click',function(e){
      if(e.target.closest('.livre-del-btn')) return;
      e.stopPropagation();
      if(typeof window.livreOpenView==='function') window.livreOpenView(book);
    });
    return card;
  }

  // ── Éditer la légende d'un livre ──
  function _editLivreDesc(book){
    var coupleId = _getCoupleId(); if(!coupleId) return;
    descEditOpen(book.description||'', 'Légende du livre "'+escHtml(book.title||'')+'"', function(val){
      book.description = val;
      fetch(SB_URL+'/rest/v1/books?id=eq.'+book.id+'&couple_id=eq.'+coupleId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({description:val})}).catch(function(){});
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
      var photoUrl = book.has_image ? (SB_URL+'/storage/v1/object/public/'+SB_BUCKET+'/books/'+book.couple_id+'/'+book.id+'.jpg?t='+Math.floor(Date.now()/60000)) : '';
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
    _livreCurrentPhotoUrl = book.has_image ? (SB_URL+'/storage/v1/object/public/'+SB_BUCKET+'/books/'+book.couple_id+'/'+book.id+'.jpg') : null;
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

    // Détection HEIC
    var isHeic = file.type==='image/heic' || file.type==='image/heif'
              || file.name.toLowerCase().endsWith('.heic')
              || file.name.toLowerCase().endsWith('.heif');
    if(isHeic){
      if(typeof showToast==='function') showToast('Format HEIC non supporté — convertissez en JPG dans Photos puis réessayez', 'error', 4500);
      return;
    }

    var ALLOWED = ['image/jpeg','image/jpg','image/png','image/webp'];
    if(ALLOWED.indexOf(file.type)===-1){
      if(typeof showToast==='function') showToast('Format non autorisé — utilisez JPG, PNG ou WebP', 'error', 3500);
      return;
    }

    var coupleId = _getCoupleId(); if(!coupleId) return;
    var photo = document.getElementById('livreEditPhoto');
    if(photo) photo.innerHTML = '<div style="font-size:12px;color:var(--muted);">Compression...</div>';

    var bookId = _livreEditingId || ('tmp_'+Date.now());
    var path = 'books/'+coupleId+'/'+bookId+'.jpg';

    var _uploadedKo = 0;
    var doUpload = function(blob){
      _uploadedKo = Math.round(blob.size/1024);
      if(photo) photo.innerHTML = '<div style="font-size:12px;color:var(--muted);">Envoi...</div>';
      fetch(SB_URL+'/storage/v1/object/'+SB_BUCKET+'/'+path,{method:'POST',headers:Object.assign({'Content-Type':'image/jpeg','x-upsert':'true'},sb2Headers()),body:blob})
      .then(function(r){ return r.text().then(function(){ return r.ok; }); })
      .then(function(ok){
        if(ok){
          _livreCurrentPhotoUrl = SB_URL+'/storage/v1/object/public/'+SB_BUCKET+'/'+path;
          if(!_livreEditingId) window._livreTmpPhotoId = bookId;
          if(photo){ photo.style.backgroundImage='url('+_livreCurrentPhotoUrl+'?t='+Date.now()+')'; photo.innerHTML=''; }
          if(typeof showToast==='function') showToast('✅ Photo optimisée : '+_uploadedKo+' Ko', 'success', 2500);
        } else {
          if(photo) photo.innerHTML='<div style="font-size:11px;color:#e05555;">Erreur upload</div>';
          if(typeof showToast==='function') showToast('Erreur upload — réessaie', 'error', 3000);
        }
      }).catch(function(){
        if(photo) photo.innerHTML='<div style="font-size:11px;color:#e05555;">Erreur réseau</div>';
        if(typeof showToast==='function') showToast('Erreur réseau — vérifie ta connexion', 'error', 3000);
      });
    };

    // Compression — max 1200px, cible 400 Ko
    if(typeof window.compressImage === 'function'){
      window.compressImage(file, 1200, 400*1024)
        .then(function(blob){
          doUpload(blob);
        })
        .catch(function(err){
          if(err && err.message === 'PHOTO_TOO_LARGE'){
            if(typeof showToast==='function') showToast('Photo trop lourde (5 Mo max après compression)', 'error', 4000);
            return;
          }
          if(typeof showToast==='function') showToast('Compression impossible — envoi en l\'original', 'info', 2500);
          doUpload(file);
        });
    } else {
      doUpload(file);
    }
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
        fetch(SB_URL+'/rest/v1/books?id=eq.'+id,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({has_image:true})}).catch(function(){});
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
        var tmpUrl = SB_URL+'/storage/v1/object/public/'+SB_BUCKET+'/books/'+coupleId+'/'+window._livreTmpPhotoId+'.jpg';
        fetch(tmpUrl).then(function(r){ return r.blob(); }).then(function(blob){
          return fetch(SB_URL+'/storage/v1/object/'+SB_BUCKET+'/books/'+coupleId+'/'+_livreEditingId+'.jpg',{method:'POST',headers:Object.assign({'Content-Type':'image/jpeg','x-upsert':'true'},sb2Headers()),body:blob});
        }).catch(function(){});
      }
      fetch(SB_URL+'/rest/v1/books?id=eq.'+_livreEditingId+'&couple_id=eq.'+coupleId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)}).then(function(){ done(_livreEditingId); }).catch(function(){ done(_livreEditingId); });
    } else {
      // Nouveau
      var data2 = {couple_id:coupleId, title:title, description:desc, has_image:hasImage, position:(_livresAllRows.length)};
      fetch(SB_URL+'/rest/v1/books',{method:'POST',headers:sb2Headers({'Prefer':'return=representation','Content-Type':'application/json'}),body:JSON.stringify(data2)})
      .then(function(r){
        if(!r.ok) return r.json().then(function(e){ throw new Error(e.message||e.hint||('HTTP '+r.status)); });
        return r.json();
      })
      .then(function(rows){
        var newId = Array.isArray(rows)&&rows.length?rows[0].id:null;
        // Si on a une photo avec un ID temporaire, la renommer vers le bon ID
        if(newId && hasImage && window._livreTmpPhotoId){
          var tmpPath = SB_URL+'/storage/v1/object/public/'+SB_BUCKET+'/books/'+coupleId+'/'+window._livreTmpPhotoId+'.jpg';
          fetch(tmpPath).then(function(r){ return r.blob(); }).then(function(blob){
            return fetch(SB_URL+'/storage/v1/object/'+SB_BUCKET+'/books/'+coupleId+'/'+newId+'.jpg',{method:'POST',headers:Object.assign({'Content-Type':'image/jpeg','x-upsert':'true'},sb2Headers()),body:blob});
          }).then(function(){
            // Patch has_image maintenant que la photo est au bon endroit
            fetch(SB_URL+'/rest/v1/books?id=eq.'+newId,{method:'PATCH',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify({has_image:true})}).catch(function(){});
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
    fetch(SB_URL+'/rest/v1/books?id=eq.'+_livreEditingId+'&couple_id=eq.'+coupleId,{method:'DELETE',headers:sb2Headers()})
    .then(function(){ window.livresCloseEdit(); window.livresLoad(); if(typeof window._nousSignalNewContent==='function') window._nousSignalNewContent('Books'); }).catch(function(){});
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

    fetch(GROQ_EDGE,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+(yamGetAccessToken?yamGetAccessToken():'')},body:JSON.stringify({prompt:prompt})})
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
    fetch(SB_URL+'/rest/v1/books',{method:'POST',headers:sb2Headers({'Prefer':'return=minimal','Content-Type':'application/json'}),body:JSON.stringify(data)})
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
  var u = (typeof yamGetUser === 'function') ? yamGetUser() : null;
  if (!u || !u.couple_id) {
    // Session pas encore prête — setProfile() va relancer nousLoad via son hook
    // On marque quand même que l'onglet a été demandé
    window._nousContentLoaded = false;
    return;
  }
  if(window._nousContentLoaded) {
    // Si la page solo était affichée et que le partenaire vient d'être lié → relancer
    var u2 = (typeof yamGetUser==='function') ? yamGetUser() : null;
    var soloVisible = document.getElementById('nousLockOverlay') &&
      document.getElementById('nousLockOverlay').className.includes('solo-active') ||
      (document.getElementById('nousContentWrapper') && 
       document.getElementById('nousContentWrapper').style.display === 'none');
    if(soloVisible && u2 && u2.partner_pseudo && u2.partner_pseudo.trim()) {
      window._nousContentLoaded = false;
      window.nousCheckLock();
      return;
    }
    // Refresh léger à chaque retour sur l'onglet
    loadLikeCounters();
    if(typeof window.nousLoadSouvenirs==='function') window.nousLoadSouvenirs();
    if(typeof window.nousLoadActivites==='function') window.nousLoadActivites();
    if(typeof renderMemoCouple==='function') renderMemoCouple();
    if(typeof window._petitsMotsLoad==='function') window._petitsMotsLoad();
    if(typeof window.livresLoad==='function') window.livresLoad();
    if(typeof window.yamRefreshNewBadges==='function') setTimeout(window.yamRefreshNewBadges, 300);
    if(typeof window.flammeRefresh==='function') setTimeout(window.flammeRefresh, 200);
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

  var GROQ_EDGE  = SB_URL + '/functions/v1/gemini-suggest';
  var SLOTS_LUI  = ['animal','fleurs','personnage','saison','repas'];
  var SLOTS_ELLE = ['animal','fleurs','personnage','saison','repas'];
  var SLOT_LABELS = { animal:'Animal 🐾', fleurs:'Fleurs 🌸', personnage:'Personnage 🧑', saison:'Saison 🍂', repas:'Repas 🍽️' };

  function _getCoupleId(){ var u=(typeof yamGetUser==='function')?yamGetUser():null; return u?u.couple_id:null; }
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
    fetch(SB_URL+'/rest/v1/photo_descs?couple_id=eq.'+cid+'&category=eq.semaine&slot=eq.'+encodeURIComponent(wk)+'&select=description&limit=1', {headers: sb2Headers()})
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
    fetch(SB_URL+'/rest/v1/photo_descs', {
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
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+(yamGetAccessToken?yamGetAccessToken():'')},
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
// ════════════════════════════════════════════════════════════════════
// FLAMME DE COUPLE — Moteur complet
// Tables : v2_flame, v2_flame_activities, v2_streak, v2_game_scores
//
// Logique :
//   • Jauge 0→24 points, décroissance 1pt/heure (float)
//   • Chaque activité de couple = +2pts (max 1x/jour par type)
//   • Streak : cumulatif pur — +1 jour chaque jour où points > 0 à minuit
//   • Trophées : somme des meilleurs scores par jeu, séparés Elle/Lui
//   • Quasi temps réel : recalcul local toutes les 30s + sync Supabase 60s
// ════════════════════════════════════════════════════════════════════
(function () {

  // ── Config ──────────────────────────────────────────────────────
  var FLAME_MAX        = 24;   // points max
  var FLAME_DECAY_PH   = 1;    // points perdus par heure
  var ACTIVITY_POINTS  = 2;    // points gagnés par activité
  var LOCAL_TICK_MS    = 30000;  // recalcul local toutes les 30s
  var SYNC_MS          = 60000;  // sync Supabase toutes les 60s
  var MIDNIGHT_CHECK_MS= 60000;  // vérification minuit toutes les 60s

  // ── Helpers session ─────────────────────────────────────────────
  function _getCoupleId () {
    var u = (typeof yamGetUser === 'function') ? yamGetUser() : null;
    return u ? u.couple_id : null;
  }
  function _getProfile () {
    if (typeof getProfile === 'function') {
      var p = getProfile();
      if (p) return p;
    }
    var u = (typeof yamGetUser === 'function') ? yamGetUser() : null;
    return u ? u.role : null;
  }

  // ── État en mémoire ─────────────────────────────────────────────
  var _flame = {
    points            : 0,
    last_updated      : null,  // Date JS
    rowId             : null,
    points_at_midnight: null   // snapshot à minuit — source de vérité pour valider le streak
  };

  var _streak = {
    current_streak : 0,
    best_streak    : 0,
    total_days     : 0,
    last_flame_date: null,
    last_malus_date: null,   // date du dernier malus minuit appliqué
    rowId          : null
  };
  var _activitiesToday = {}; // { activity_type: true } — activités déjà faites aujourd'hui
  var _trophies = { girl: 0, boy: 0 };

  // ── Clé de date locale (YYYY-MM-DD) ─────────────────────────────
  function _todayStr () {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ── Calcul des points courants (interpolation depuis last_updated) ─
  function _currentPoints () {
    if (!_flame.last_updated) return _flame.points;
    var elapsed = (Date.now() - _flame.last_updated.getTime()) / 3600000; // heures
    var decay   = elapsed * FLAME_DECAY_PH;
    return Math.max(0, Math.min(FLAME_MAX, _flame.points - decay));
  }

  // ════════════════════════════════════════════════════════════════
  // SUPABASE — Lecture initiale
  // ════════════════════════════════════════════════════════════════

  function _loadAll (onDone) {
    var cid = _getCoupleId();
    if (!cid) { if (onDone) onDone(); return; }

    // Parallelise les 3 lectures
    var done = 0;
    function _mayDone () { done++; if (done >= 3 && onDone) onDone(); }

    // 1. Flame
    fetch(SB_URL + '/rest/v1/flame?couple_id=eq.' + cid + '&limit=1', { headers: sb2Headers() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (rows && rows[0]) {
          var remoteDate   = new Date(rows[0].last_updated);
          var remotePoints = parseFloat(rows[0].points) || 0;
          // Ne pas écraser si on a une valeur locale plus récente ET plus haute
          // (cas : RPC vient de tourner mais Supabase retourne encore l'ancienne valeur)
          var localIsNewer = _flame.last_updated && _flame.last_updated > remoteDate;
          var localIsBetter = _flame.points > remotePoints;
          if (!localIsNewer || !localIsBetter) {
            _flame.points       = remotePoints;
            _flame.last_updated = remoteDate;
          }
          _flame.rowId              = rows[0].id;
          _flame.points_at_midnight = (rows[0].points_at_midnight != null)
                                        ? parseFloat(rows[0].points_at_midnight)
                                        : null;
        }
        _mayDone();
      }).catch(_mayDone);

    // 2. Streak
    fetch(SB_URL + '/rest/v1/streak?couple_id=eq.' + cid + '&limit=1', { headers: sb2Headers() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        if (rows && rows[0]) {
          _streak.current_streak  = rows[0].current_streak  || 0;
          _streak.best_streak     = rows[0].best_streak     || 0;
          _streak.total_days      = rows[0].total_days      || 0;
          _streak.last_flame_date = rows[0].last_flame_date || null;
          _streak.last_malus_date = rows[0].last_malus_date || null;
          _streak.rowId           = rows[0].id;
        }
        // Fallback localStorage si pas encore en base (migration douce)
        if (!_streak.last_malus_date) {
          try { _streak.last_malus_date = localStorage.getItem('yam_malus_date') || null; } catch(e) {}
        }
        _mayDone();
      }).catch(_mayDone);

    // 3. Activités du jour déjà faites — filtrées par triggered_by pour ne charger que les miennes
    var localMidnight = new Date();
    localMidnight.setHours(0, 0, 0, 0);
    var profile3 = _getProfile();
    var _loadUid = (typeof yamGetUser === 'function' && yamGetUser()) ? yamGetUser().id : null;
    var actUrl = SB_URL + '/rest/v1/flame_activities?couple_id=eq.' + cid +
      '&activity_date=gte.' + new Date().toISOString().split('T')[0] +
      (_loadUid ? '&user_id=eq.' + _loadUid : '') +
      '&select=activity_type';
    fetch(actUrl, { headers: sb2Headers() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        _activitiesToday = {};
        if (Array.isArray(rows)) {
          rows.forEach(function (r) { _activitiesToday[r.activity_type] = true; });
        }
        _mayDone();
      }).catch(_mayDone);
  }

  // ════════════════════════════════════════════════════════════════
  // SUPABASE — Sauvegarde flame (valeur absolue, sync périodique)
  // ════════════════════════════════════════════════════════════════

  function _saveFlame (pts) {
    var cid = _getCoupleId();
    if (!cid) return;
    console.warn('[FLAME] _saveFlame appelé avec pts=' + pts, new Error().stack);
    var now = new Date().toISOString();

    if (_flame.rowId) {
      fetch(SB_URL + '/rest/v1/flame?id=eq.' + _flame.rowId, {
        method: 'PATCH',
        headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ points: pts, last_updated: now })
      }).catch(function () {});
    } else {
      fetch(SB_URL + '/rest/v1/flame', {
        method: 'POST',
        headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=representation' }),
        body: JSON.stringify({ couple_id: cid, points: pts, last_updated: now })
      })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) { if (rows && rows[0]) _flame.rowId = rows[0].id; })
      .catch(function () {});
    }
  }

  // ════════════════════════════════════════════════════════════════
  // SUPABASE — Incrément atomique via RPC (évite la race condition)
  // Quand les deux partenaires déclenchent une activité en même temps,
  // on utilise une RPC SQL pour incrémenter côté serveur de façon sûre.
  // ════════════════════════════════════════════════════════════════

  function _incrementFlameAtomic (cid, delta, onDone) {
    var now = new Date().toISOString();
    // Upsert avec incrément SQL via RPC Supabase
    // Fallback : si la RPC n'existe pas, on utilise le PATCH classique
    fetch(SB_URL + '/rest/v1/rpc/yam_flame_increment', {
      method: 'POST',
      headers: sb2Headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        p_couple_id   : cid,
        p_delta       : delta,
        p_max         : FLAME_MAX,
        p_last_updated: now
      })
    })
    .then(function (r) {
      if (r.ok) {
        return r.json().then(function (raw) {
          // La RPC Supabase retourne un tableau ou un objet direct
          var result = Array.isArray(raw) ? raw[0] : raw;
          // La RPC retourne le nouveau score
          if (result && typeof result.new_points === 'number') {
            _flame.points       = result.new_points;
            _flame.last_updated = new Date(now);
            if (result.id) _flame.rowId = result.id;
            _renderFlame();
          }
          if (onDone) onDone();
        });
      } else {
        // RPC absente ou erreur → fallback PATCH valeur absolue
        _saveFlame(_flame.points);
        if (onDone) onDone();
      }
    })
    .catch(function () {
      // Réseau KO → on garde la valeur locale, sync au prochain tick
      if (onDone) onDone();
    });
  }

  // ════════════════════════════════════════════════════════════════
  // DÉCLENCHER UNE ACTIVITÉ — API publique
  // ════════════════════════════════════════════════════════════════

  window.yamFlameActivity = function (activityType) {
    var cid     = _getCoupleId();
    var profile = _getProfile();
    if (!cid || !profile) return;

    // Garde mémoire — bloque les doublons dans la même session
    if (_activitiesToday[activityType]) return;
    _activitiesToday[activityType] = true; // réserver pour éviter les appels concurrents

    var labels = {
      first_login    : 'Première connexion du jour 🔥',
      first_message  : 'Premier message du jour 🔥',
      heart_milestone: 'Palier cœur atteint 🔥',
      rappel_done    : 'Rappel complété 🔥',
      quiz_done      : 'Quiz terminé 🔥',
      petit_mot      : 'Petit mot écrit 🔥',
      skyjo_together : 'Partie Skyjo ensemble 🔥',
      mood_change    : 'Humeur mise à jour 🔥',
      histoire_new   : "Nouvelle page d'histoire 🔥",
      elle_lui_update: 'Section Elle/Lui mise à jour 🔥',
      souvenir_new   : 'Nouveau souvenir 🔥',
      activite_done  : 'Activité complétée 🔥',
      music_together : 'Musique ensemble 🔥'
    };

    // GET d'abord : vérifie si l'activité existe déjà aujourd'hui pour ce user
    var _faUser = (typeof yamGetUser === 'function' && yamGetUser()) ? yamGetUser() : null;
    var _faUid  = _faUser ? _faUser.id : null;
    var _faDate = new Date().toISOString().split('T')[0];
    var _faCheckUrl = SB_URL + '/rest/v1/flame_activities?couple_id=eq.' + cid
      + '&activity_type=eq.' + activityType
      + '&activity_date=eq.' + _faDate
      + (_faUid ? '&user_id=eq.' + _faUid : '')
      + '&select=id&limit=1';

    fetch(_faCheckUrl, { headers: sb2Headers() })
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(existing) {
      if (existing && existing.length > 0) {
        // Déjà enregistré aujourd'hui — pas d'incrément
        return;
      }
      return fetch(SB_URL + '/rest/v1/flame_activities', {
        method  : 'POST',
        headers : sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
        body    : JSON.stringify({
          couple_id    : cid,
          user_id      : _faUid,
          activity_type: activityType,
          activity_date: _faDate
        })
      })
      .then(function(r) {
        if (!r.ok) {
          _activitiesToday[activityType] = false;
          return;
        }
        var current = _currentPoints();
        var newPts  = Math.min(FLAME_MAX, current + ACTIVITY_POINTS);
        _flame.points       = newPts;
        _flame.last_updated = new Date();
        _renderFlame();
        _incrementFlameAtomic(cid, ACTIVITY_POINTS, null);
        if (typeof showToast === 'function') {
          showToast(labels[activityType] || '🔥 +2 flamme !', 'success', 2200);
        }
      });
    })
    .catch(function() {
      _activitiesToday[activityType] = false;
    });
  };

  // ════════════════════════════════════════════════════════════════
  // STREAK — Vérification quotidienne (à minuit)
  // ════════════════════════════════════════════════════════════════

  function _checkStreak () {
    var cid = _getCoupleId();
    if (!cid) return;

    var today      = _todayStr();
    var yesterday  = (function () {
      var d = new Date(); d.setDate(d.getDate() - 1);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    })();

    // ── STREAK : récompense pour la veille — AVANT le malus ──────────
    // Si on a bien travaillé hier, on mérite le streak avant que le nouveau
    // jour ne commence avec son malus.
    if (_streak.last_flame_date !== today) {
      // points_at_midnight = snapshot écrit à minuit par la Edge Function flame-midnight.
      // Si null : le cron n'a pas encore tourné (premier jour, ou erreur) → pas de streak.
      // C'est la seule source de vérité fiable — pas de fallback _currentPoints()
      // car l'app est fermée la nuit et les points auraient déjà décru.
      var ptsAtMidnight = _flame.points_at_midnight;
      if (ptsAtMidnight !== null && ptsAtMidnight > 0) {
        _streak.current_streak++;
        _streak.total_days++;
        if (_streak.current_streak > _streak.best_streak) {
          _streak.best_streak = _streak.current_streak;
        }
        _streak.last_flame_date = today;

        var streakBody = {
          couple_id      : cid,
          current_streak : _streak.current_streak,
          best_streak    : _streak.best_streak,
          total_days     : _streak.total_days,
          last_flame_date: today,
          last_malus_date: _streak.last_malus_date || null,
          updated_at     : new Date().toISOString()
        };

        if (_streak.rowId) {
          fetch(SB_URL + '/rest/v1/streak?id=eq.' + _streak.rowId, {
            method: 'PATCH',
            headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
            body: JSON.stringify(streakBody)
          }).catch(function () {});
        } else {
          fetch(SB_URL + '/rest/v1/streak', {
            method: 'POST',
            headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=representation' }),
            body: JSON.stringify(streakBody)
          })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (rows) { if (rows && rows[0]) _streak.rowId = rows[0].id; })
          .catch(function () {});
        }

        _renderStreak();
      }
    }

    // ── MALUS MINUIT : -50% une fois par jour — APRÈS le streak ──────
    // Pénalité pour commencer le nouveau jour, appliquée après la récompense.
    // CONDITION : on n'applique le malus QUE si points_at_midnight > 0.
    // Si points_at_midnight est null ou 0, la flamme était déjà éteinte — pas de malus.
    if (_streak.last_malus_date !== today) {
      var ptsAtMidnightForMalus = _flame.points_at_midnight;
      // Si points_at_midnight null → pas encore de snapshot (premier jour ou cron pas tourné)
      // → on marque last_malus_date pour ne pas re-tenter, mais on n'écrit rien dans flame
      _streak.last_malus_date = today;
      try { localStorage.setItem('yam_malus_date', today); } catch(e) {}
      if (_streak.rowId) {
        fetch(SB_URL + '/rest/v1/streak?id=eq.' + _streak.rowId, {
          method: 'PATCH',
          headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
          body: JSON.stringify({ last_malus_date: today, updated_at: new Date().toISOString() })
        }).catch(function () {});
      }
      // N'appliquer le malus que s'il y avait vraiment des points à minuit
      if (ptsAtMidnightForMalus !== null && ptsAtMidnightForMalus > 0 && _flame.rowId) {
        var afterMalus = Math.floor(ptsAtMidnightForMalus * 0.5);
        _flame.points       = afterMalus;
        _flame.last_updated = new Date();
        _saveFlame(afterMalus);
        _renderFlame();
      }
    }

  }

  // ════════════════════════════════════════════════════════════════
  // TROPHÉES — Cumul des meilleurs scores par jeu
  // ════════════════════════════════════════════════════════════════

  // Recalcule les scores cumulés depuis game_scores et met à jour l'affichage + couronne.
  // Inclut tous les jeux : memory, pendu, puzzle, snake, skyjo, ocho.
  function _recalcTrophies () {
    var cid = _getCoupleId();
    if (!cid) return;

    fetch(SB_URL + '/rest/v1/game_scores?couple_id=eq.' + cid +
      '&select=player_role,game_id,score&order=score.desc', { headers: sb2Headers() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (scoreRows) {
        if (!Array.isArray(scoreRows)) return;

        // Un score par jeu = meilleur score toutes parties confondues
        // Memory : meilleur score parmi les 4 sous-modes (max, pas somme)
        var MEMORY_IDS = ['memory_classic', 'memory_echo', 'memory_archi', 'memory_all'];
        var games      = ['pendu', 'puzzle', 'snake', 'skyjo', 'ocho'];
        var girlBest   = {};
        var boyBest    = {};

        scoreRows.forEach(function (row) {
          if (row.player_role === 'girl') {
            if (!girlBest[row.game_id] || row.score > girlBest[row.game_id])
              girlBest[row.game_id] = row.score;
          } else {
            if (!boyBest[row.game_id] || row.score > boyBest[row.game_id])
              boyBest[row.game_id] = row.score;
          }
        });

        // Memory = meilleur score parmi tous les sous-modes
        var girlMemory = MEMORY_IDS.reduce(function (m, id) { return Math.max(m, girlBest[id] || 0); }, 0);
        var boyMemory  = MEMORY_IDS.reduce(function (m, id) { return Math.max(m, boyBest[id]  || 0); }, 0);

        _trophies.girl = girlMemory + games.reduce(function (s, g) { return s + (girlBest[g] || 0); }, 0);
        _trophies.boy  = boyMemory  + games.reduce(function (s, g) { return s + (boyBest[g]  || 0); }, 0);

        if (_trophies.girl === 0 && _trophies.boy === 0) { _renderTrophies(); return; }

        var winner = _trophies.girl > _trophies.boy ? 'girl'
                   : _trophies.boy  > _trophies.girl ? 'boy'
                   : 'draw';

        fetch(SB_URL + '/rest/v1/crown?on_conflict=couple_id', {
          method  : 'POST',
          headers : Object.assign({}, sb2Headers(), { 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify({
            couple_id : cid,
            winner    : winner,
            girl_score: _trophies.girl,
            boy_score : _trophies.boy,
            awarded_at: new Date().toISOString()
          })
        }).catch(function () {});

        _renderTrophies();
      }).catch(function () {});
  }

  function _loadTrophies () { _recalcTrophies(); }

  // Hook public — met à jour les scores affichés sans toucher à la couronne
  window.yamUpdateTrophies = function () { _recalcTrophies(); };

  // ════════════════════════════════════════════════════════════════
  // RENDU — Flamme SVG + gauge circulaire
  // ════════════════════════════════════════════════════════════════

  function _renderFlame () {
    var pts         = _currentPoints();
    var ratio       = pts / FLAME_MAX;           // 0→1

    // Gauge SVG (cercle de progression)
    // r=19 dans le SVG → circumférence = 2π×19 = 119.38
    var radius      = 19;
    var circumf     = 2 * Math.PI * radius;      // 119.38
    var dashOffset  = circumf * (1 - ratio);

    var circle = document.getElementById('flammeGaugeCircle');
    if (circle) {
      circle.style.strokeDashoffset = dashOffset;
      // strokeDasharray est posé en HTML, on ne le réécrit pas
    }

    // Couleur de la gauge selon niveau
    var gaugeColor;
    if      (ratio <= 0)    gaugeColor = '#cccccc';
    else if (ratio < 0.25)  gaugeColor = '#f97316';
    else if (ratio < 0.5)   gaugeColor = '#ef4444';
    else if (ratio < 0.75)  gaugeColor = '#dc2626';
    else                    gaugeColor = '#ff6b35';
    if (circle) circle.style.stroke = gaugeColor;

    // Niveau de flamme (classe CSS pour animation)
    var flameEl = document.getElementById('flammeIcon');
    if (flameEl) {
      flameEl.className = 'flamme-icon ' + (
        ratio === 0        ? 'flamme-dead'   :
        ratio < 0.25       ? 'flamme-low'    :
        ratio < 0.5        ? 'flamme-mid'    :
        ratio < 0.75       ? 'flamme-high'   :
                             'flamme-max'
      );
    }

    // Texte heure restante avant extinction
    var ptsEl = document.getElementById('flammePts');
    if (ptsEl) {
      if (pts <= 0) {
        ptsEl.textContent = 'Éteinte';
        ptsEl.classList.add('flamme-pts-danger');
      } else {
        var hLeft = pts / FLAME_DECAY_PH;
        var hh    = Math.floor(hLeft);
        var mm    = Math.floor((hLeft - hh) * 60);
        ptsEl.textContent = hh + 'h' + String(mm).padStart(2, '0');
        if (ratio < 0.25) {
          ptsEl.classList.add('flamme-pts-danger');
        } else {
          ptsEl.classList.remove('flamme-pts-danger');
        }
      }
    }

    // Indicateur d'alerte "flamme en danger" sous la gauge
    var dangerEl = document.getElementById('flammeDangerAlert');
    if (dangerEl) {
      dangerEl.style.display = (pts > 0 && ratio < 0.25) ? 'block' : 'none';
    }
  }

  // ════════════════════════════════════════════════════════════════
  // RENDU — Barre de streak
  // ════════════════════════════════════════════════════════════════

  function _renderStreak () {
    var days = _streak.current_streak;   // ← streak consécutif (pas total_days)
    var best = _streak.best_streak;

    var streakNumEl = document.getElementById('flammeStreakNum');
    if (streakNumEl) streakNumEl.textContent = days;

    // Paliers linéaires : 0→7 / 7→14 / 14→30 / 30→60 / 60→∞
    // Chaque palier occupe 25% de la barre physique
    var segs = [
      { dMin:0,  dMax:7,  next:'→ 7 jours'  },
      { dMin:7,  dMax:14, next:'→ 14 jours' },
      { dMin:14, dMax:30, next:'→ 30 jours' },
      { dMin:30, dMax:60, next:'→ 60 jours' },
      { dMin:60, dMax:60, next:'🔥 Record !' }
    ];

    var segW = 100 / (segs.length - 1); // 25% par palier
    var barPct = 100;
    var nextLabel = '🔥 Record !';

    for (var i = 0; i < segs.length - 1; i++) {
      var s = segs[i];
      if (days <= s.dMax) {
        var ratio = (days - s.dMin) / (s.dMax - s.dMin);
        barPct    = (i + ratio) * segW;
        nextLabel = s.next;
        break;
      }
    }
    barPct = Math.max(0, Math.min(100, barPct));

    var barEl   = document.getElementById('flammeStreakBar');
    var labelEl = document.getElementById('flammeStreakLabel');
    var nextEl  = document.getElementById('flammeStreakNext');
    var bestEl  = document.getElementById('flammeStreakBest');

    if (barEl)   barEl.style.width   = barPct.toFixed(2) + '%';
    if (labelEl) labelEl.textContent = days + (days <= 1 ? ' jour 🔥' : ' jours 🔥');
    if (nextEl)  nextEl.textContent  = nextLabel;
    if (bestEl)  bestEl.textContent  = best > 0 ? '🏆 Record : ' + best + 'j' : '';
  }

  // ════════════════════════════════════════════════════════════════
  // RENDU — Trophées
  // ════════════════════════════════════════════════════════════════

  function _renderTrophies () {
    var girlEl = document.getElementById('flammeScoreGirl');
    var boyEl  = document.getElementById('flammeScoreBoy');
    if (girlEl) girlEl.textContent = _formatScore(_trophies.girl);
    if (boyEl)  boyEl.textContent  = _formatScore(_trophies.boy);
    _renderCrown();
  }

  // ════════════════════════════════════════════════════════════════
  // COURONNE — Attribue la couronne au meilleur score de trophées
  // Calculé une fois par jour (vérifié à chaque tick minuit)
  // Stocké en localStorage avec la date du jour pour éviter recalcul
  // ════════════════════════════════════════════════════════════════

  function _renderCrown () {
    // Le winner est deja dans _trophies — calcule et ecrit en base par _loadTrophies()
    // Cette fonction se contente d'afficher le resultat en memoire
    var winner = _trophies.girl > _trophies.boy ? 'girl'
               : _trophies.boy  > _trophies.girl ? 'boy'
               : null; // egalite ou pas encore charge

    var girlRing  = document.getElementById('girlAvatarRing');
    var boyRing   = document.getElementById('boyAvatarRing');
    var girlCrown = document.getElementById('girlCrown');
    var boyCrown  = document.getElementById('boyCrown');
    var girlSpark = document.getElementById('girlSparkles');
    var boySpark  = document.getElementById('boySparkles');
    var girlBadge = document.getElementById('girlCrownBadge');
    var boyBadge  = document.getElementById('boyCrownBadge');

    // Reset tout
    if (girlRing)  girlRing.classList.remove('ring-winner');
    if (boyRing)   boyRing.classList.remove('ring-winner');
    if (girlCrown) girlCrown.style.display = 'none';
    if (boyCrown)  boyCrown.style.display  = 'none';
    if (girlSpark) girlSpark.style.display = 'none';
    if (boySpark)  boySpark.style.display  = 'none';
    if (girlBadge) girlBadge.style.display = 'none';
    if (boyBadge)  boyBadge.style.display  = 'none';

    if (!winner) return;

    var score = winner === 'girl' ? _trophies.girl : _trophies.boy;
    var ring  = winner === 'girl' ? girlRing  : boyRing;
    var crown = winner === 'girl' ? girlCrown : boyCrown;
    var spark = winner === 'girl' ? girlSpark : boySpark;
    var badge = winner === 'girl' ? girlBadge : boyBadge;

    if (ring)  ring.classList.add('ring-winner');
    if (crown) crown.style.display = 'block';
    if (spark) spark.style.display = 'block';
    if (badge) {
      badge.textContent  = '\u{1F451} ' + _formatScore(score) + ' pts';
      badge.style.display = 'inline-block';
    }
  }

  function _formatScore (n) {
    if (!n || n <= 0) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (n >= 1000)    return (n / 1000).toFixed(1).replace('.0', '') + 'k';
    return String(n);
  }

  // ════════════════════════════════════════════════════════════════
  // RENDU — Date de couple
  // ════════════════════════════════════════════════════════════════

  function _renderCoupleSince () {
    var startDate = window.startDate || new Date('2024-10-29T00:00:00');
    var el = document.getElementById('flammeCoupleSince');
    if (!el) return;
    var opts = { day: 'numeric', month: 'long', year: 'numeric' };
    el.textContent = 'Ensemble depuis le ' + startDate.toLocaleDateString('fr-FR', opts);
  }

  // ════════════════════════════════════════════════════════════════
  // TICK LOCAL — décroissance visible en quasi temps réel
  // ════════════════════════════════════════════════════════════════

  var _localTickIv = null;
  var _syncIv      = null;
  var _midnightIv  = null;

  function _startTicks () {
    if (_localTickIv) return;

    // Tick local : recalcul de la flamme toutes les 30s
    _localTickIv = setInterval(function () {
      if (document.hidden) return;
      _renderFlame();
    }, LOCAL_TICK_MS);

    // Sync Supabase toutes les 60s (lire l'état de l'autre)
    _syncIv = setInterval(function () {
      if (document.hidden) return;
      var cid = _getCoupleId(); if (!cid) return;
      fetch(SB_URL + '/rest/v1/flame?couple_id=eq.' + cid + '&limit=1', { headers: sb2Headers() })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (rows) {
          if (!rows || !rows[0]) return;
          var remotePoints = parseFloat(rows[0].points) || 0;
          var remoteDate   = new Date(rows[0].last_updated);
          // N'écraser que si la version distante est plus récente
          if (!_flame.last_updated || remoteDate > _flame.last_updated) {
            _flame.points       = remotePoints;
            _flame.last_updated = remoteDate;
            _flame.rowId        = rows[0].id;
            _renderFlame();
          }
        }).catch(function () {});
    }, SYNC_MS);

    // Verification minuit (streak + couronne)
    // A minuit : _loadTrophies() relit Supabase, detecte qu'il n'y a pas encore
    // de ligne pour le nouveau jour, recalcule et ecrit en base.
    var _lastCrownDate = _todayStr();
    _midnightIv = setInterval(function () {
      if (document.hidden) return;
      var nowDate = _todayStr();
      if (nowDate !== _lastCrownDate) {
        _lastCrownDate = nowDate;
        // Recharger _flame depuis Supabase pour récupérer points_at_midnight
        // écrit par la Edge Function flame-midnight (cron 00:00 UTC)
        var cid = _getCoupleId();
        if (cid) {
          fetch(SB_URL + '/rest/v1/flame?couple_id=eq.' + cid + '&limit=1', { headers: sb2Headers() })
            .then(function (r) { return r.ok ? r.json() : []; })
            .then(function (rows) {
              if (rows && rows[0]) {
                _flame.points_at_midnight = (rows[0].points_at_midnight != null)
                                              ? parseFloat(rows[0].points_at_midnight)
                                              : null;
              }
              _checkStreak();
            }).catch(function () { _checkStreak(); });
        } else {
          _checkStreak();
        }
        _loadTrophies();
      } else {
        _checkStreak();
      }
    }, MIDNIGHT_CHECK_MS);
  }

  // Retour en premier plan : juste re-render, pas de _checkStreak
  // (_checkStreak tourne via _midnightIv — dangereux si _flame est en état intermédiaire)
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      _renderFlame();
    }
  });

  // ════════════════════════════════════════════════════════════════
  // INIT — Point d'entrée appelé par _nousInitAll()
  // ════════════════════════════════════════════════════════════════

  var _flammeInited = false;

  window.flammeInit = function () {
    if (_flammeInited) { window.flammeRefresh(); return; }
    _flammeInited = true;
    _loadAll(function () {
      _renderFlame();
      _renderStreak();
      _renderTrophies();
      _renderCoupleSince();
      _loadTrophies();
      _checkStreak();
      _startTicks();
      window.yamFlameActivity('first_login');
    });
  };

  // Ré-exécutable (retour sur l'onglet) — lecture seule, pas de _checkStreak ni _saveFlame
  window.flammeRefresh = function () {
    var cid = _getCoupleId(); if (!cid) return;
    fetch(SB_URL + '/rest/v1/flame?couple_id=eq.' + cid + '&limit=1', { headers: sb2Headers() })
      .then(function(r){ return r.ok ? r.json() : []; })
      .then(function(rows){
        if (rows && rows[0]) {
          var remoteDate   = new Date(rows[0].last_updated);
          var remotePoints = parseFloat(rows[0].points) || 0;
          var localIsNewer = _flame.last_updated && _flame.last_updated > remoteDate;
          var localIsBetter = _flame.points > remotePoints;
          if (!localIsNewer || !localIsBetter) {
            _flame.points       = remotePoints;
            _flame.last_updated = remoteDate;
          }
          _flame.rowId              = rows[0].id;
          _flame.points_at_midnight = rows[0].points_at_midnight != null ? parseFloat(rows[0].points_at_midnight) : null;
        }
        _renderFlame();
        _renderStreak();
        _renderTrophies();
        _renderCoupleSince();
      }).catch(function(){});
  };

})();


// ════════════════════════════════════════════════════════════════════
// FIN DU MODULE FLAMME
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// BULLE VIDÉO ÉVÉNEMENT — 10 dernières minutes de chaque heure
// Gérée ici car appartient à la section Nous ♥
// ════════════════════════════════════════════════════════════════════
(function(){
  var WINDOW_BEFORE = 10; // minutes avant l'heure pile
  var WINDOW_AFTER  = 0;
  var TRIGGER_HOURS = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];

  function isInVideoWindow() {
    var now = new Date();
    var totalMin = now.getHours() * 60 + now.getMinutes();
    for (var i = 0; i < TRIGGER_HOURS.length; i++) {
      var centerMin = TRIGGER_HOURS[i] * 60;
      if (totalMin >= centerMin - WINDOW_BEFORE && totalMin < centerMin + WINDOW_AFTER) {
        return true;
      }
    }
    return false;
  }

  function applyState() {
    var videoWrap    = document.getElementById('storyVideoWrap');
    var video        = document.getElementById('storyVideo');
    var storyHeart   = document.getElementById('storyHeart');
    var navNous      = document.getElementById('navNous');
    var counterBlock = document.getElementById('counterBlock');
    if (!videoWrap || !video) return;

    if (isInVideoWindow()) {
      videoWrap.style.display = 'block';
      if (video.paused) video.play().catch(function(){});
      if (storyHeart)   storyHeart.style.display = 'block';
      if (navNous)      navNous.classList.add('event-active');
      if (counterBlock) counterBlock.classList.add('glowing');
    } else {
      videoWrap.style.display = 'none';
      video.pause();
      if (storyHeart)   storyHeart.style.display = 'none';
      if (navNous)      navNous.classList.remove('event-active');
      if (counterBlock) counterBlock.classList.remove('glowing');
    }
  }

  applyState();
  window.isInVideoWindow  = isInVideoWindow;
  window._applyStoryState = applyState;

  document.addEventListener('visibilitychange', function(){
    if (!document.hidden) applyState();
  });

  // ── Countdown ──
  var countdownEl = document.getElementById('storyCountdownTxt');
  var _cdIv = null, _cdTmo = null;

  function _stopCountdown(){
    if (_cdIv)  { clearInterval(_cdIv);  _cdIv  = null; }
    if (_cdTmo) { clearTimeout(_cdTmo);  _cdTmo = null; }
  }

  function updateCountdown(){
    var now = new Date();
    var totalSec = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
    var secsLeft = null;
    for (var i = 0; i < TRIGGER_HOURS.length; i++) {
      var endSec   = (TRIGGER_HOURS[i]*60 + WINDOW_AFTER)  * 60;
      var startSec = (TRIGGER_HOURS[i]*60 - WINDOW_BEFORE) * 60;
      if (totalSec >= startSec && totalSec < endSec) { secsLeft = endSec - totalSec; break; }
    }
    if (secsLeft !== null && secsLeft > 0 && countdownEl) {
      var m = Math.floor(secsLeft / 60), s = secsLeft % 60;
      countdownEl.textContent = (m > 0 ? m + 'min ' : '') + (s < 10 ? '0' : '') + s + 's';
    } else if (countdownEl) {
      countdownEl.textContent = '';
    }
  }

  function _scheduleCountdown(){
    _stopCountdown();
    if (document.hidden) return;
    var now = new Date();
    var totalSec = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
    var inWindow = false;
    for (var i = 0; i < TRIGGER_HOURS.length; i++) {
      var endSec   = (TRIGGER_HOURS[i]*60 + WINDOW_AFTER)  * 60;
      var startSec = (TRIGGER_HOURS[i]*60 - WINDOW_BEFORE) * 60;
      if (totalSec >= startSec && totalSec < endSec) { inWindow = true; break; }
    }
    if (inWindow) {
      updateCountdown();
      _cdIv = setInterval(updateCountdown, 1000);
      var curH = Math.floor(totalSec / 3600);
      var wEnd = (curH * 60 + WINDOW_AFTER) * 60;
      _cdTmo = setTimeout(function(){ _stopCountdown(); _scheduleCountdown(); applyState(); }, Math.max(0, (wEnd - totalSec) * 1000) + 500);
    } else {
      var secsInDay = 24 * 3600, minWait = secsInDay;
      for (var j = 0; j < TRIGGER_HOURS.length; j++) {
        var ns = (TRIGGER_HOURS[j]*60 - WINDOW_BEFORE) * 60;
        var w  = ns - totalSec; if (w < 0) w += secsInDay;
        if (w < minWait) minWait = w;
      }
      _cdTmo = setTimeout(function(){ updateCountdown(); _scheduleCountdown(); applyState(); }, Math.max(1000, minWait * 1000 - 500));
    }
  }

  document.addEventListener('visibilitychange', function(){ if (document.hidden) { _stopCountdown(); } else { _scheduleCountdown(); } });
  _scheduleCountdown();
})();
