// ═══════════════════════════════════════════════════════════
// app-love.js — Page Nous : Photos Elle/Lui · Raisons · Post-its · Memo

// ════════════════════════════════════════════
// SECTION ELLE — Upload Supabase Storage V2
// ════════════════════════════════════════════
(function(){
  var SB_BUCKET = 'images';
  var SB_FOLDER = 'elle';
  var SLOTS = ['animal','fleurs','personnage','saison','repas'];
  var ELLE_DESC_DEFAULTS = {
    animal:     'Un regard doux 💫',
    fleurs:     'Pleine de couleurs 💕',
    personnage: 'Attachante 💍',
    saison:     'Un rayon de soleil ☀️',
    repas:      "N'aime que les pattes 🤝"
  };
  var _currentSlot = null;

  // ── Charger les images depuis Supabase Storage V2 ──
  function elleLoadImages(){
    SLOTS.forEach(function(slot){
      var url = SB2_URL + '/storage/v1/object/public/' + SB_BUCKET + '/' + SB_FOLDER + '/' + slot + '.jpg?t=' + Date.now();
      var img = document.getElementById('elle-img-' + slot);
      if(!img) return;
      var probe = new Image();
      probe.onload = function(){ img.src = url; };
      probe.onerror = function(){ /* image non uploadée */ };
      probe.src = url;
    });
  }

  function elleSyncEditMode(){
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
  }

  window.elleUploadClick = function(slot){
    if(getProfile() !== 'boy') return;
    _currentSlot = slot;
    var input = document.getElementById('elleFileInput');
    input.value = '';
    input.click();
  };

  window.elleHandleFile = function(input){
    if(!input.files || !input.files[0]) return;
    var file = input.files[0];
    var slot = _currentSlot;
    if(!slot) return;

    var ALLOWED_TYPES = ['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
    if(ALLOWED_TYPES.indexOf(file.type) === -1){
      alert('Format non autorisé. Utilise une image JPEG, PNG ou WebP.');
      input.value = '';
      return;
    }
    if(file.size > 5 * 1024 * 1024){ alert('Image trop lourde (max 5 Mo)'); return; }

    var loading = document.getElementById('elle-loading-' + slot);
    var bar = document.getElementById('elle-bar-' + slot);
    if(loading) loading.classList.add('show');
    if(bar){ bar.style.width = '0%'; setTimeout(function(){ bar.style.width = '60%'; }, 100); }

    var path = SB_FOLDER + '/' + slot + '.jpg';
    fetch(SB2_URL + '/storage/v1/object/' + SB_BUCKET + '/' + path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': file.type, 'x-upsert': 'true' }, sb2Headers()),
      body: file
    })
    .then(function(r){
      if(bar) bar.style.width = '100%';
      return r.text().then(function(body){
        if(loading) loading.classList.remove('show');
        if(r.ok){
          var img = document.getElementById('elle-img-' + slot);
          if(img) img.src = SB2_URL + '/storage/v1/object/public/' + SB_BUCKET + '/' + SB_FOLDER + '/' + slot + '.jpg?t=' + Date.now();
        } else {
          alert('Erreur ' + r.status + ' : ' + body);
        }
      });
    })
    .catch(function(err){
      if(loading) loading.classList.remove('show');
      alert('Erreur réseau : ' + err);
    });
  };

  function elleLoadDescs(){
    sb2Fetch('v2_photo_descs', 'category=eq.elle').then(function(descs){
      if(!Array.isArray(descs)) return;
      SLOTS.forEach(function(slot){
        var d = descs.find(function(x){ return x.slot === slot; });
        var el = document.getElementById('elle-desc-' + slot);
        if(el) el.textContent = d ? d.description : ELLE_DESC_DEFAULTS[slot];
      });
    }).catch(function(){});
  }

  window.elleEditDesc = function(slot){
    if(getProfile() !== 'boy') return;
    var cur = document.getElementById('elle-desc-' + slot).textContent || '';
    var txt = prompt('Modifier la description :', cur);
    if(txt === null || txt.trim() === cur.trim()) return;
    elleSaveDesc(slot, txt.trim());
  };

  function elleSaveDesc(slot, text){
    var coupleId = null;
    try{
      var s = JSON.parse(localStorage.getItem('yam_v2_session')||'null');
      if(s && s.user) coupleId = s.user.couple_id;
    }catch(e){}
    if(!coupleId) return;

    var payload = { couple_id: coupleId, category: 'elle', slot: slot, description: text };
    sb2Post('v2_photo_descs', payload, { 'Prefer': 'resolution=merge-duplicates' })
      .then(function(){ elleLoadDescs(); })
      .catch(function(){});
  }

  window.addEventListener('_profileApply', function(){ elleSyncEditMode(); elleLoadImages(); elleLoadDescs(); });
  elleLoadImages();
  elleLoadDescs();
})();


// ════════════════════════════════════════════
// SECTION LUI — Upload Supabase Storage V2
// ════════════════════════════════════════════
(function(){
  var SB_BUCKET = 'images';
  var SB_FOLDER = 'lui';
  var SLOTS = ['animal','fleurs','personnage','saison','repas'];
  var LUI_DESC_DEFAULTS = {
    animal:     'Un compagnon fidèle 🐾',
    fleurs:     'Sauvages et libres 🌿',
    personnage: 'Attachant 🎮',
    saison:     'L\'automne chaleureux 🍂',
    repas:      'Pizza toujours 🍕'
  };
  var _currentSlot = null;

  function luiLoadImages(){
    SLOTS.forEach(function(slot){
      var url = SB2_URL + '/storage/v1/object/public/' + SB_BUCKET + '/' + SB_FOLDER + '/' + slot + '.jpg?t=' + Date.now();
      var img = document.getElementById('lui-img-' + slot);
      if(!img) return;
      var probe = new Image();
      probe.onload = function(){ img.src = url; };
      probe.onerror = function(){ /* image non uploadée */ };
      probe.src = url;
    });
  }

  function luiSyncEditMode(){
    var profile = getProfile();
    var isLink = (profile === 'girl');
    SLOTS.forEach(function(slot){
      var btn = document.getElementById('lui-btn-' + slot);
      if(btn) btn.style.display = isLink ? '' : 'none';
      var desc = document.getElementById('lui-desc-' + slot);
      if(desc){
        if(isLink) desc.classList.add('elle-desc-editable');
        else desc.classList.remove('elle-desc-editable');
      }
    });
  }

  window.luiUploadClick = function(slot){
    if(getProfile() !== 'girl') return;
    _currentSlot = slot;
    var input = document.getElementById('luiFileInput');
    input.value = '';
    input.click();
  };

  window.luiHandleFile = function(input){
    if(!input.files || !input.files[0]) return;
    var file = input.files[0];
    var slot = _currentSlot;
    if(!slot) return;

    var ALLOWED_TYPES = ['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
    if(ALLOWED_TYPES.indexOf(file.type) === -1){
      alert('Format non autorisé. Utilise une image JPEG, PNG ou WebP.');
      input.value = '';
      return;
    }
    if(file.size > 5 * 1024 * 1024){ alert('Image trop lourde (max 5 Mo)'); return; }

    var loading = document.getElementById('lui-loading-' + slot);
    var bar = document.getElementById('lui-bar-' + slot);
    if(loading) loading.classList.add('show');
    if(bar){ bar.style.width = '0%'; setTimeout(function(){ bar.style.width = '60%'; }, 100); }

    var path = SB_FOLDER + '/' + slot + '.jpg';
    fetch(SB2_URL + '/storage/v1/object/' + SB_BUCKET + '/' + path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': file.type, 'x-upsert': 'true' }, sb2Headers()),
      body: file
    })
    .then(function(r){
      if(bar) bar.style.width = '100%';
      return r.text().then(function(body){
        if(loading) loading.classList.remove('show');
        if(r.ok){
          var img = document.getElementById('lui-img-' + slot);
          if(img) img.src = SB2_URL + '/storage/v1/object/public/' + SB_BUCKET + '/' + SB_FOLDER + '/' + slot + '.jpg?t=' + Date.now();
        } else {
          alert('Erreur ' + r.status + ' : ' + body);
        }
      });
    })
    .catch(function(err){
      if(loading) loading.classList.remove('show');
      alert('Erreur réseau : ' + err);
    });
  };

  function luiLoadDescs(){
    sb2Fetch('v2_photo_descs', 'category=eq.lui').then(function(descs){
      if(!Array.isArray(descs)) return;
      SLOTS.forEach(function(slot){
        var d = descs.find(function(x){ return x.slot === slot; });
        var el = document.getElementById('lui-desc-' + slot);
        if(el) el.textContent = d ? d.description : LUI_DESC_DEFAULTS[slot];
      });
    }).catch(function(){});
  }

  window.luiEditDesc = function(slot){
    if(getProfile() !== 'girl') return;
    var cur = document.getElementById('lui-desc-' + slot).textContent || '';
    var txt = prompt('Modifier la description :', cur);
    if(txt === null || txt.trim() === cur.trim()) return;
    luiSaveDesc(slot, txt.trim());
  };

  function luiSaveDesc(slot, text){
    var coupleId = null;
    try{
      var s = JSON.parse(localStorage.getItem('yam_v2_session')||'null');
      if(s && s.user) coupleId = s.user.couple_id;
    }catch(e){}
    if(!coupleId) return;

    var payload = { couple_id: coupleId, category: 'lui', slot: slot, description: text };
    sb2Post('v2_photo_descs', payload, { 'Prefer': 'resolution=merge-duplicates' })
      .then(function(){ luiLoadDescs(); })
      .catch(function(){});
  }

  window.addEventListener('_profileApply', function(){ luiSyncEditMode(); luiLoadImages(); luiLoadDescs(); });
  luiLoadImages();
  luiLoadDescs();
})();


// ════════════════════════════════════════════
// RAISONS D'AMOUR (v2_couples.config_json.reasons)
// ════════════════════════════════════════════
(function(){
  function escHtml(str){return(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  function reloadReasons(arr){
    var wrap=document.getElementById('reasonsList');
    if(!wrap)return;wrap.innerHTML='';
    if(!Array.isArray(arr)||!arr.length){wrap.innerHTML='<div class="reason-empty">Aucune raison ajoutée.</div>';return;}
    arr.forEach(function(r,i){
      var div=document.createElement('div');div.className='reason-card';
      div.innerHTML='<div class="reason-num">'+(i+1)+'</div><div class="reason-text">'+escHtml(r)+'</div>';
      wrap.appendChild(div);
    });
  }

  window.addReason=function(){
    var txt=prompt('Nouvelle raison de t\'aimer :');
    if(!txt||!txt.trim())return;
    var current=window.YAM_COUPLE&&window.YAM_COUPLE.reasons?window.YAM_COUPLE.reasons:[];
    current.push(txt.trim());
    saveReasons(current);
  };

  window.editReasons=function(){
    var current=window.YAM_COUPLE&&window.YAM_COUPLE.reasons?window.YAM_COUPLE.reasons:[];
    if(!current.length){alert('Aucune raison encore ajoutée.');return;}
    var numbered=current.map(function(r,i){return(i+1)+'. '+r;}).join('\n');
    var newTxt=prompt('Modifier les raisons (une par ligne) :',numbered);
    if(newTxt===null||newTxt.trim()===numbered)return;
    var lines=newTxt.split('\n').map(function(x){return x.replace(/^\d+\.\s*/,'').trim();}).filter(Boolean);
    saveReasons(lines);
  };

  window.clearReasons=function(){
    if(!confirm('Vraiment effacer toutes les raisons ?'))return;
    saveReasons([]);
  };

  function saveReasons(arr){
    var coupleId=null;
    try{
      var s=JSON.parse(localStorage.getItem('yam_v2_session')||'null');
      if(s&&s.user)coupleId=s.user.couple_id;
    }catch(e){}
    if(!coupleId)return;
    var payload={config_json:{reasons:arr,postits:window.YAM_COUPLE&&window.YAM_COUPLE.postits?window.YAM_COUPLE.postits:[],timeline:window.YAM_COUPLE&&window.YAM_COUPLE.timeline?window.YAM_COUPLE.timeline:[]}};
    sb2Patch('v2_couples','id=eq.'+coupleId,payload).then(function(){
      if(window.YAM_COUPLE)window.YAM_COUPLE.reasons=arr;
      reloadReasons(arr);
    }).catch(function(){});
  }

  window.addEventListener('_coupleConfigLoaded',function(){
    var arr=window.YAM_COUPLE&&window.YAM_COUPLE.reasons?window.YAM_COUPLE.reasons:[];
    reloadReasons(arr);
  });
})();


// ════════════════════════════════════════════
// POST-ITS SWIPABLES (v2_couples.config_json.postits)
// ════════════════════════════════════════════
(function(){
  var postitData=[];
  var postitIndex=0;
  var POSTIT_COLORS=['#fff59d','#ffcc80','#a5d6a7','#90caf9','#ce93d8','#ef9a9a','#ffab91','#80cbc4'];

  function buildStack(){
    var c=document.getElementById('postitStack');if(!c){return;}c.innerHTML='';
    if(!postitData.length){c.innerHTML='<div class="postit-empty">Aucun post-it créé</div>';return;}
    var item=postitData[postitIndex%postitData.length];
    var col=POSTIT_COLORS[postitIndex%POSTIT_COLORS.length];
    var d=document.createElement('div');d.className='postit-card';d.style.background=col;
    d.innerHTML='<div class="postit-date">'+escHtml(item.date||'')+'</div><div class="postit-text">'+escHtml(item.text)+'</div>';
    c.appendChild(d);
  }

  function escHtml(str){return(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  window.swipeRight=function(){
    postitIndex++;buildStack();
  };
  window.swipeLeft=function(){
    postitIndex=(postitIndex>0)?postitIndex-1:postitData.length-1;buildStack();
  };

  window.addPostit=function(){
    var txt=prompt('Nouveau post-it :');
    if(!txt||!txt.trim())return;
    var now=new Date();
    var ds=now.toLocaleDateString('fr-FR');
    postitData.push({text:txt.trim(),date:ds});
    savePostits();
  };

  window.clearPostits=function(){
    if(!confirm('Vraiment effacer tous les post-its ?'))return;
    postitData=[];postitIndex=0;savePostits();
  };

  function savePostits(){
    var coupleId=null;
    try{
      var s=JSON.parse(localStorage.getItem('yam_v2_session')||'null');
      if(s&&s.user)coupleId=s.user.couple_id;
    }catch(e){}
    if(!coupleId)return;
    var payload={config_json:{reasons:window.YAM_COUPLE&&window.YAM_COUPLE.reasons?window.YAM_COUPLE.reasons:[],postits:postitData,timeline:window.YAM_COUPLE&&window.YAM_COUPLE.timeline?window.YAM_COUPLE.timeline:[]}};
    sb2Patch('v2_couples','id=eq.'+coupleId,payload).then(function(){
      if(window.YAM_COUPLE)window.YAM_COUPLE.postits=postitData;
      buildStack();
    }).catch(function(){});
  }

  window.addEventListener('_coupleConfigLoaded',function(){
    var arr=window.YAM_COUPLE&&window.YAM_COUPLE.postits?window.YAM_COUPLE.postits:[];
    postitData=Array.isArray(arr)?arr:[];
    postitIndex=0;

    var now=new Date();
    var day=now.getDate();
    if(day===29){
      var START=new Date(2024,9,29);
      var months=(now.getFullYear()-START.getFullYear())*12+(now.getMonth()-START.getMonth());
      if(months>=1){
        var annivText=getAnnivPostitText(months);
        var existingAnniv=postitData.find(function(p){return p.text.indexOf(annivText)!==-1;});
        if(!existingAnniv){
          var ds=now.toLocaleDateString('fr-FR');
          postitData.unshift({text:annivText,date:ds});
        }
      }
    }
    buildStack();
  });

  function getAnnivPostitText(months){
    var msgs={
      1:"💕 1 mois ensemble ! Déjà tellement de bonheur partagé.",
      2:"💕 2 mois d'amour ! Chaque jour avec toi est un cadeau.",
      3:"💕 3 mois ! Comme le temps passe vite quand on est heureux.",
      4:"💕 4 mois ensemble ! Notre histoire s'écrit page après page.",
      5:"💕 5 mois de nous ! Merci d'être là, chaque jour.",
      6:"💕 Un demi-année ensemble ! Notre complicité grandit.",
      7:"💕 7 mois ! Chaque moment avec toi est précieux.",
      8:"💕 8 mois d'aventures partagées ! On continue ?",
      9:"💕 9 mois ! Presque une année à nos côtés.",
      10:"💕 10 mois ! L'anniversaire d'un an approche !",
      11:"💕 11 mois ! Bientôt notre premier anniversaire !"
    };
    if(msgs[months])return msgs[months];
    var years=Math.floor(months/12);
    if(years===1)return"🎉 1 an ensemble ! Joyeux anniversaire mon amour !";
    if(years===2)return"🎉 2 ans ! Deux années d'amour, de rires et de complicité.";
    if(years===3)return"🎉 3 ans ! Trois belles années à tes côtés.";
    return"🎉 "+years+" ans ensemble ! Que notre amour continue de grandir.";
  }
})();


// ════════════════════════════════════════════
// BADGE MESSAGES NON LUS + NOTIFICATION PILULE
// ════════════════════════════════════════════
(function(){
  var _prevUnreadCount = -1;

  function checkUnread(){
    var profile = getProfile();
    if(!profile) return;
    var other = profile === 'girl' ? 'boy' : 'girl';

    var coupleId = null;
    try{
      var s = JSON.parse(localStorage.getItem('yam_v2_session')||'null');
      if(s && s.user) coupleId = s.user.couple_id;
    }catch(e){}
    if(!coupleId) return;

    sb2Fetch('v2_dm_messages', 'couple_id=eq.' + coupleId + '&sender=eq.' + other + '&seen=eq.false&order=created_at.desc')
    .then(function(rows){
      var unread = Array.isArray(rows) ? rows.length : 0;
      var lockBadge = document.getElementById('lockUnreadBadge');
      var lockBtn   = document.getElementById('lockNavBtn');
      if(unread > 0){
        lockBadge.textContent = unread > 99 ? '99+' : String(unread);
        lockBadge.classList.add('visible');
        lockBtn.classList.add('has-unread');
        if(_prevUnreadCount >= 0 && unread > _prevUnreadCount && window._currentTab !== 'messages'){
          var last = rows[0];
          var emoji = other === 'girl' ? '👧' : '👦';
          var name  = (typeof v2GetDisplayName==="function"?v2GetDisplayName(other):(other==="girl"?"👧":"👦"));
          var txt   = (last && last.text) ? last.text : '💬 Nouveau message';
          if(window.showMsgHeaderPill) window.showMsgHeaderPill(emoji, name, txt);
        }
      } else {
        lockBadge.classList.remove('visible');
        lockBtn.classList.remove('has-unread');
      }
      _prevUnreadCount = unread;
    })
    .catch(function(){});
  }
  window._checkUnread = checkUnread;
  checkUnread();
  setInterval(checkUnread, 8000);
})();

// ════════════════════════════════════════════
// LIKES / CŒURS (V3.2 — CORRIGÉ V3.2.1)
// ════════════════════════════════════════════
function spawnHeart(){
  // Animation cœur volant
  var h=document.createElement('div');
  h.className='like-heart';
  h.textContent='🤍';
  document.body.appendChild(h);
  setTimeout(function(){h.remove();},600);

  var profile = getProfile();
  if(!profile) return;

  var coupleId = null;
  var token = null;
  try{
    var s = JSON.parse(localStorage.getItem('yam_v2_session')||'null');
    if(s && s.user) coupleId = s.user.couple_id;
    if(s && s.token) token = s.token;
  }catch(e){}
  
  if(!coupleId || !token) {
    console.error('Likes: couple_id ou token manquant');
    return;
  }

  // Mise à jour optimiste
  var numEl = document.getElementById(profile==='girl' ? 'likeNumGirl' : 'likeNumBoy');
  if(numEl){
    var txt = (numEl.textContent||'0').trim();
    var cur = 0;
    if(txt.endsWith('M')) cur = parseFloat(txt) * 1000000;
    else if(txt.endsWith('k')) cur = parseFloat(txt) * 1000;
    else cur = parseInt(txt) || 0;
    numEl.textContent = fmtLikes(cur + 1);
  }

  // ⭐ CORRECTION : Envoyer le token de session pour authentifier la requête RPC
  fetch(SB2_URL+'/rest/v1/rpc/increment_like_counter', {
    method:'POST',
    headers: {
      'apikey': SB2_KEY,
      'Authorization': 'Bearer ' + token,  // ⭐ TOKEN SESSION (pas seulement anon key)
      'Content-Type': 'application/json'
    },
    body:JSON.stringify({ 
      p_profile: profile, 
      p_couple_id: coupleId 
    })
  })
  .then(function(r){ 
    if(!r.ok) {
      console.error('Erreur RPC increment_like_counter:', r.status);
      return null;
    }
    return r.json(); 
  })
  .then(function(data){ 
    // Recharger pour sync avec la BDD
    loadLikeCounters(); 
  })
  .catch(function(err){ 
    console.error('Erreur réseau likes:', err);
    // En cas d'erreur, on recharge quand même pour avoir l'état correct
    loadLikeCounters(); 
  });
}

function fmtLikes(n){
  if(!n || n<=0) return '0';
  if(n>=1000000) return (n/1000000).toFixed(1).replace('.0','')+'M';
  if(n>=1000) return (n/1000).toFixed(1).replace('.0','')+'k';
  return String(n);
}

function loadLikeCounters(){
  var coupleId = null;
  try{
    var s = JSON.parse(localStorage.getItem('yam_v2_session')||'null');
    if(s && s.user) coupleId = s.user.couple_id;
  }catch(e){}
  if(!coupleId) return;

  fetch(SB2_URL+'/rest/v1/v2_like_counters?couple_id=eq.'+coupleId+'&select=profile,total', {
    headers: sb2Headers()
  })
  .then(function(r){ return r.ok ? r.json() : []; })
  .then(function(rows){
    if(!Array.isArray(rows)) return;
    rows.forEach(function(r){
      var elGirl = document.getElementById('likeNumGirl');
      var elBoy  = document.getElementById('likeNumBoy');
      if(r.profile==='girl' && elGirl) elGirl.textContent = fmtLikes(r.total);
      if(r.profile==='boy'  && elBoy)  elBoy.textContent  = fmtLikes(r.total);
    });
  }).catch(function(err){
    console.error('Erreur chargement likes:', err);
  });
}

// Exposer globalement pour le refresh par onglet
window.loadLikeCounters = loadLikeCounters;

loadLikeCounters();
// Polling toutes les 5s
window._likesIv = setInterval(loadLikeCounters, 5000);


// ── MEMO COUPLE — Supabase ──
(function(){
  var _MEMO_HASH='a586ffe3acf28484d17760d1ddaa2af699666c870aaaa66f8cfc826a528429ce', memoUnlocked=false, memoCurrentNote=null;
  var NOTE_COLORS=['#1a3a2a','#2a1a2e','#1a2a3a','#2a2216','#1a2a2a','#2a1a1a','#1a1a2a','#222222'];
  var NOTE_ICONS=['💬','✍️','💌','📖','🌙','💭','✨','🎵'];

  function escHtml(str){return(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  var _authCb=null;
  function openMemoAuth(cb){
    _authCb=cb;
    var m=document.getElementById('memoAuthModal');m.classList.add('open');
    document.getElementById('memoAuthInput').value='';
    document.getElementById('memoAuthErr').style.display='none';
    setTimeout(function(){document.getElementById('memoAuthInput').focus();},80);
  }
  window.closeMemoAuth=function(){document.getElementById('memoAuthModal').classList.remove('open');};
  var _memoFailCount=0, _memoBlocked=false;
  window.memoCheckAuth=async function(){
    if(_memoBlocked) return;
    var val=document.getElementById('memoAuthInput').value.trim().toUpperCase();
    var h=await _sha256(val);
    if(h===_MEMO_HASH){_memoFailCount=0;window.closeMemoAuth();if(_authCb){_authCb();_authCb=null;}}
    else{
      _memoFailCount++;
      document.getElementById('memoAuthInput').value='';
      document.getElementById('memoAuthInput').focus();
      var errEl=document.getElementById('memoAuthErr');
      if(_memoFailCount>=5){
        _memoBlocked=true;
        errEl.style.display='block';errEl.textContent='⛔ Trop de tentatives — attends 30s';
        document.getElementById('memoAuthInput').disabled=true;
        setTimeout(function(){_memoBlocked=false;_memoFailCount=0;document.getElementById('memoAuthInput').disabled=false;errEl.style.display='none';},30000);
      } else {
        errEl.style.display='block';errEl.textContent='❌ Code incorrect, réessaie ! ('+_memoFailCount+'/5)';
      }
    }
  };
  document.getElementById('memoAuthInput').addEventListener('keydown',function(e){if(e.key==='Enter')window.memoCheckAuth();});
  document.getElementById('memoAuthModal').addEventListener('click',function(e){if(e.target===this)window.closeMemoAuth();});

  window.memoRequestUnlock=function(){
    if(memoUnlocked){memoLock();return;}
    if(v2LoadSession()){memoUnlock();return;}
    openMemoAuth(function(){memoUnlock();});
  };

  function memoUnlock(){
    memoUnlocked=true;
    document.getElementById('memoLockBadge').classList.add('unlocked');
    document.getElementById('memoLockTxt').textContent='Verrouiller';
    document.getElementById('memoTodoAddRow').style.display='flex';
    renderNotes();renderTodos();
  }
  function memoLock(){
    memoUnlocked=false;
    document.getElementById('memoLockBadge').classList.remove('unlocked');
    document.getElementById('memoLockTxt').textContent='Modifier';
    document.getElementById('memoTodoAddRow').style.display='none';
    renderNotes();renderTodos();
  }

  function renderNotes(){
    var slider=document.getElementById('memoNotesSlider');
    slider.innerHTML='<div class="memo-loading"><span class="spinner"></span>Chargement...</div>';
    sbGet('memo_notes').then(function(notes){
      slider.innerHTML='';
      var addCard=document.createElement('div');
      addCard.className='memo-note-add-card'+(memoUnlocked?' visible':'');
      addCard.innerHTML='<div class="memo-note-add-img"><div class="memo-note-add-icon">+</div><div class="memo-note-add-lbl">Nouvelle note</div></div>';
      addCard.addEventListener('click',function(){openMemoModal(null,true);});
      slider.appendChild(addCard);
      if(!Array.isArray(notes)||!notes.length){
        var empty=document.createElement('div');empty.className='memo-notes-empty';
        empty.textContent=memoUnlocked?'Aucune note — ajoute-en une !':'Aucune note pour l\'instant.';
        slider.appendChild(empty);return;
      }
      notes.forEach(function(note,i){
        var col=NOTE_COLORS[i%NOTE_COLORS.length],icon=NOTE_ICONS[i%NOTE_ICONS.length];
        var prev=(note.text||'').substring(0,40)+((note.text||'').length>40?'…':'');
        var d=new Date(note.updated_at||note.created_at);
        var ds=d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
        var isRecentlyModified = note.updated_at &&
          note.updated_at !== note.created_at &&
          (Date.now() - new Date(note.updated_at).getTime()) < 6 * 60 * 60 * 1000;
        var newBadge = isRecentlyModified ? '<div class="memo-note-new-badge">new</div>' : '';
        var card=document.createElement('div');card.className='memo-note-card';
        card.innerHTML=
          '<div class="memo-note-img" style="background:'+col+'">' +
          '<div class="memo-note-bg">'+icon+'</div>' +
          newBadge +
          '<div class="memo-note-date-badge">'+escHtml(ds)+'</div>' +
          '<div class="memo-note-banner">'+escHtml(note.title||'Note')+'</div></div>' +
          '<div class="memo-note-preview">'+escHtml(prev)+'</div>';
        (function(n){card.addEventListener('click',function(){openMemoModal(n,false);});})(note);
        slider.appendChild(card);
      });
    }).catch(function(){
      document.getElementById('memoNotesSlider').innerHTML='<div class="memo-notes-empty">❌ Erreur de connexion Supabase.</div>';
    });
  }

  function openMemoModal(note,isNew){
    memoCurrentNote=note;
    if(memoUnlocked){
      document.getElementById('memoDeleteNoteBtn').style.display=isNew?'none':'block';
      document.getElementById('memoModalTitle').value=note?(note.title||''):'';
      document.getElementById('memoModalText').value=note?(note.text||''):'';
      document.getElementById('memoModalTitle').disabled=false;
      document.getElementById('memoModalText').disabled=false;
      document.getElementById('memoSaveNoteBtn').style.display='';
    }else{
      document.getElementById('memoDeleteNoteBtn').style.display='none';
      document.getElementById('memoModalTitle').value=note?(note.title||''):'';
      document.getElementById('memoModalText').value=note?(note.text||''):'';
      document.getElementById('memoModalTitle').disabled=true;
      document.getElementById('memoModalText').disabled=true;
      document.getElementById('memoSaveNoteBtn').style.display='none';
    }
    document.getElementById('memoNoteModal').classList.add('open');
  }
  window.closeMemoNoteModal=function(){document.getElementById('memoNoteModal').classList.remove('open');};
  window.saveNote=function(){
    var title=document.getElementById('memoModalTitle').value.trim();
    var text=document.getElementById('memoModalText').value.trim();
    if(!title||!text)return;
    if(memoCurrentNote&&memoCurrentNote.id){
      sbPatch('memo_notes','id=eq.'+memoCurrentNote.id,{title:title,text:text,updated_at:new Date().toISOString()}).then(function(){window.closeMemoNoteModal();renderNotes();}).catch(function(){});
    }else{
      sbPost('memo_notes',{title:title,text:text}).then(function(){window.closeMemoNoteModal();renderNotes();}).catch(function(){});
    }
  };
  window.deleteNote=function(){
    if(!memoCurrentNote||!memoCurrentNote.id)return;
    if(!confirm('Supprimer cette note ?'))return;
    sbDelete('memo_notes','id=eq.'+memoCurrentNote.id).then(function(){window.closeMemoNoteModal();renderNotes();}).catch(function(){});
  };

  function renderTodos(){
    var list=document.getElementById('memoTodoList');
    list.innerHTML='<div class="memo-loading"><span class="spinner"></span>Chargement...</div>';
    sbGet('memo_todos').then(function(todos){
      list.innerHTML='';
      if(!Array.isArray(todos)||!todos.length){list.innerHTML='<div class="memo-todo-empty">Aucune tâche</div>';return;}
      todos.forEach(function(t){
        var div=document.createElement('div');div.className='memo-todo-item'+(t.done?' done':'');
        div.innerHTML='<input type="checkbox" class="memo-todo-check" '+(t.done?'checked':'')+(memoUnlocked?'':' disabled')+'><span class="memo-todo-text">'+escHtml(t.text)+'</span>'+(memoUnlocked?'<button class="memo-todo-delete" onclick="deleteTodo(\''+t.id+'\')">✕</button>':'');
        div.querySelector('.memo-todo-check').addEventListener('change',function(e){toggleTodo(t.id,e.target.checked);});
        list.appendChild(div);
      });
    }).catch(function(){list.innerHTML='<div class="memo-todo-empty">❌ Erreur Supabase</div>';});
  }
  window.addTodo=function(){
    var txt=document.getElementById('memoTodoInput').value.trim();
    if(!txt)return;
    sbPost('memo_todos',{text:txt,done:false}).then(function(){document.getElementById('memoTodoInput').value='';renderTodos();}).catch(function(){});
  };
  window.toggleTodo=function(id,done){sbPatch('memo_todos','id=eq.'+id,{done:done}).then(function(){renderTodos();}).catch(function(){});};
  window.deleteTodo=function(id){sbDelete('memo_todos','id=eq.'+id).then(function(){renderTodos();}).catch(function(){});};

  async function _sha256(txt){var buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(txt));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');}

  renderNotes();
  renderTodos();
})();
