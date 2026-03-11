// ═══════════════════════════════════════════════════════════
// app-messages.js — InstaLove · DM · Notif pilule
// ✅ VERSION CORRIGÉE V3.3 — Isolation couple_id complète

// ══════════════════════════════════════════
// DM — INSTALOVE
// ══════════════════════════════════════════
(function(){
  var TABLE = 'v2_dm_messages';
  var identity = null;  // 'girl' | 'boy'
  var cache    = [];
  var pollId   = null;
  var attached = false;

  function $(id){ return document.getElementById(id); }

  /* ══ PROFIL PILL (haut droite) ══ */
  function updateProfilePill(screenName){
    // Pill supprimée — on est toujours connecté à ce stade
    var pill = $('dmTopbarProfile');
    if(pill) pill.style.display = 'none';
    if(window._dmUpdateHeaderAvatars) window._dmUpdateHeaderAvatars();
  }

  /* ══ NAVIGATION ══ */
  var _dmDur = 300;

  /* Carrousel : incoming entre depuis un côté, outgoing sort de l'autre */
  function _dmSlide(incoming, outgoing, dir){
    if(!dir){
      // Pas d'animation : afficher direct
      ['dmHomeScreen','dmChatScreen'].forEach(function(id){
        var s = document.getElementById(id);
        if(!s) return;
        if(s === incoming){ s.style.display='flex'; s.style.transform=''; s.style.transition=''; }
        else { s.style.display='none'; s.style.transform=''; s.style.transition=''; }
      });
      return;
    }
    var inStart  = dir==='forward' ? 'translateX(100%)'  : 'translateX(-100%)';
    var outEnd   = dir==='forward' ? 'translateX(-100%)' : 'translateX(100%)';
    var TR = 'transform '+_dmDur+'ms cubic-bezier(.4,0,.2,1)';

    // Mettre incoming hors écran SANS transition
    if(incoming){
      incoming.style.transition = 'none';
      incoming.style.transform  = inStart;
      incoming.style.display    = 'flex';
    }
    // S'assurer que outgoing est au centre SANS transition
    if(outgoing && outgoing !== incoming){
      outgoing.style.transition = 'none';
      outgoing.style.transform  = 'translateX(0)';
      outgoing.style.display    = 'flex';
    }
    // Forcer deux frames pour que le navigateur calcule les positions initiales
    void (incoming || outgoing).getBoundingClientRect();
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      if(incoming){ incoming.style.transition = TR; incoming.style.transform = 'translateX(0)'; }
      if(outgoing && outgoing !== incoming){ outgoing.style.transition = TR; outgoing.style.transform = outEnd; }
      setTimeout(function(){
        if(outgoing && outgoing !== incoming){ outgoing.style.display='none'; outgoing.style.transform=''; outgoing.style.transition=''; }
        if(incoming){ incoming.style.transition=''; }
      }, _dmDur + 50);
    }); });
  }

  function _dmGetVisible(){
    var ids = ['dmHomeScreen','dmChatScreen'];
    for(var i=0;i<ids.length;i++){
      var el = document.getElementById(ids[i]);
      if(el && el.style.display !== 'none') return el;
    }
    return null;
  }

  function showConvScreen(dir){
    var ov = $('dmIdentityScreen');
    if(ov) ov.style.display = 'none';
    // CONV : nav visible — hiddenPage remonte à bottom:var(--nav-height) via CSS
    document.body.classList.remove('dm-chat-active');
    var el = $('dmHomeScreen');
    var outgoing = dir ? _dmGetVisible() : null;
    _dmSlide(el, outgoing !== el ? outgoing : null, dir);
    // — Mode CONV : logo à gauche, profil à droite, avatars présence masqués —
    var _logo = document.getElementById('dmTopbarLogo');
    if(_logo) _logo.style.display = 'block';
    var _ccb = document.getElementById('dmChatCenterBlock');
    if(_ccb) _ccb.style.display = 'none';
    var _haConv = document.getElementById('dmHeaderAvatars');
    if(_haConv) _haConv.style.display = 'none';
    var _cpb = document.getElementById('dmConvProfileBtn');
    if(_cpb) _cpb.style.display = 'flex';
    // Sync avatar profil avec celui connecté
    var _cav = document.getElementById('dmConvAvatarEmoji');
    if(_cav && window.yamAvatarSrc){ var _p=getProfile(); if(_p) _cav.src=window.yamAvatarSrc(_p); }
    var backBtn = $('dmTopbarBack');
    // Supprimer le bouton retour en conv
    var _oldBack = document.getElementById('dmTopbarBack');
    if(_oldBack) _oldBack.parentNode.removeChild(_oldBack);
    var lbl = $('dmBackLabel'); if(lbl) lbl.textContent = 'Retour';
    var logo = $('dmHomeLogo'), conv = $('dmHomeConv');
    if(logo) logo.style.display = 'none';
    if(conv) conv.style.display = 'flex';
    loadHomePreview();
    updateProfilePill('conv');
  }

  function showScreen(name, dir){
    var ov = $('dmIdentityScreen');
    if(ov) ov.style.display = 'none';
    if(name === 'home') { showConvScreen(dir); return; }
    var center  = $('dmTopbarCenter');
    var backBtn = $('dmTopbarBack');
    var outgoing = dir ? _dmGetVisible() : null;

    if(name === 'chat'){
      // CHAT : hiddenPage descend à bottom:0 via body.dm-chat-active → clavier couvre la nav
      document.body.classList.add('dm-chat-active');
      var el = $('dmChatScreen');
      _dmSlide(el, outgoing !== el ? outgoing : null, dir);
      // — Mode CHAT : logo masqué, avatars présence visibles, profil conv masqué —
      var _logoC = document.getElementById('dmTopbarLogo');
      if(_logoC) _logoC.style.display = 'none';
      var _cpbC = document.getElementById('dmConvProfileBtn');
      if(_cpbC) _cpbC.style.display = 'none';
      var dmHA = document.getElementById('dmHeaderAvatars');
      if(dmHA) dmHA.style.display = 'none';
      var _logoC = document.getElementById('dmTopbarLogo');
      if(_logoC) _logoC.style.display = 'none';
      var _ccbC = document.getElementById('dmChatCenterBlock');
      if(_ccbC) _ccbC.style.display = 'flex';
      if(window.yamAvatarSrc){
        var _ag = document.getElementById('dmChatAvGirl'); if(_ag) _ag.src = window.yamAvatarSrc('girl');
        var _ab = document.getElementById('dmChatAvBoy');  if(_ab) _ab.src = window.yamAvatarSrc('boy');
      }
      // Injecter le bouton retour en chat
    if(!document.getElementById('dmTopbarBack')){
      var _topbar = document.getElementById('dmTopbar');
      var _center = document.getElementById('dmTopbarCenter');
      if(_topbar && _center){
        var _btn = document.createElement('div');
        _btn.className = 'gv-back'; _btn.id = 'dmTopbarBack';
        _btn.onclick = dmHandleBack;
        _btn.style.flexShrink = '0';
        _btn.dataset.dest = 'home';
        _btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg><span id="dmBackLabel">Retour</span>';
        _topbar.insertBefore(_btn, _center);
      }
    } else {
      var _b = document.getElementById('dmTopbarBack');
      _b.dataset.dest = 'home'; _b.style.display = 'flex';
    }
      var lbl2 = $('dmBackLabel'); if(lbl2) lbl2.textContent = 'Retour';
      var lockBadge = document.getElementById('lockUnreadBadge');
      var lockBtn   = document.getElementById('lockNavBtn');
      if(lockBadge) lockBadge.classList.remove('visible');
      if(lockBtn)   lockBtn.classList.remove('has-unread');
    }
    updateProfilePill(name);
  }

  // Alias simplifié — redirige vers showConvScreen
  window.dmShowConv = function(dir){ showConvScreen(dir); };

  // dmHideConv supprimé — plus nécessaire

  /* ══ BOUTON RETOUR ══ */
  window.dmHandleBack = function(){
    var btn  = $('dmTopbarBack');
    var dest = btn ? (btn.dataset.dest || 'close') : 'close';
    if(dest === 'close'){
      if(window.closeHiddenPage) window.closeHiddenPage();
    } else {
      // Retour chat → conv directement, sans history.go(-1)
      showConvScreen('backward');
    }
  };

  var identityPickerContext = 'profile'; // 'profile' | 'chat'

  /* ══ CLIC LOGO → ouvre le chat ══ */
  window.dmOpenMessaging = function(){
    var saved = getProfile();
    if(saved === 'girl' || saved === 'boy'){
      identity = saved;
      showScreen('chat', 'forward');
      startChat();
    } else {
      // Afficher overlay choix identité par-dessus l'accueil, puis aller au chat
      identityPickerContext = 'chat';
      showIdentityOverlay();
    }
  };

  /* ══ OVERLAY IDENTITÉ ══ */
  function showIdentityOverlay(){
    // Garder l'accueil visible en dessous
    var ov = $('dmIdentityScreen');
    if(ov) ov.style.display = 'flex';
    // Highlight bouton actuel
    updateIdButtons();
  }

  window.dmShowIdentityPicker = function(){
    identityPickerContext = 'profile';
    showIdentityOverlay();
  };

  window.dmCloseIdentityIfOutside = function(e){
    if(e.target === $('dmIdentityScreen')) closeIdentityOverlay();
  };

  function closeIdentityOverlay(){
    var ov = $('dmIdentityScreen');
    if(ov) ov.style.display = 'none';
  }

  function updateIdButtons(){
    var bg = $('dmIdBtnGirl'), bb = $('dmIdBtnBoy');
    if(bg) bg.classList.toggle('selected', identity === 'girl');
    if(bb) bb.classList.toggle('selected', identity === 'boy');
    if(window._dmUpdateHeaderAvatars) window._dmUpdateHeaderAvatars();
  }

  window.dmSetIdentity = function(g){
    // Vérifier session ou demander le code via setProfile
    // setProfile gère la modal et ne sauvegarde qu'après succès
    function afterAuth(){
      identity = g;
      closeIdentityOverlay();
      updateIdButtons();
      var chat = $('dmChatScreen');
      var chatVisible = chat && chat.style.display !== 'none';
      if(chatVisible){
        updateProfilePill('chat');
      } else if(identityPickerContext === 'chat'){
        showScreen('chat');
        startChat();
      } else {
        updateProfilePill('home');
      }
    }
    // v2 : session active → pas de code demandé
    if(typeof v2LoadSession === 'function' && v2LoadSession()){
      if(window._profileSave) window._profileSave(g);
      if(window._profileApply) window._profileApply(g);
      afterAuth();
      return;
    }
    // Pas de session v2 → rediriger vers login
    if(window.v2ShowLogin) window.v2ShowLogin();
  };

  /* ══ CHAT ══ */
  function startChat(){
    cache = [];
    _msgOlderDone  = false;
    _msgLoadingOld = false;
    var el = $('dmMessages');
    if(el) el.innerHTML = '<div class="dm-loading-msgs"><div class="dm-loading-dots"><span></span><span></span><span></span></div></div>';
    if(!attached){ attachListeners(); attached = true; }
    stopPoll();
    fetchMsgs();
    pollId = setInterval(function(){ fetchMsgs(); pollTyping(); }, 3000);
    window._chatPollId = pollId;
  }

  function stopPoll(){ if(pollId){ clearInterval(pollId); pollId = null; window._chatPollId = null; } }
  window._dmStopPoll  = stopPoll;
  window._dmStartPoll = function(ms){
    stopPoll();
    pollId = setInterval(function(){ fetchMsgs(); pollTyping(); }, ms||3000);
    window._chatPollId = pollId;
  };

  function attachListeners(){
    var input    = $('dmInput');
    var sendBtn  = $('dmSendBtn');
    var photoBtn = $('dmPhotoBtn');
    var photoInput = $('dmPhotoInput');

    if(input){
      input.addEventListener('input', function(){ updateSendBtn(); sendTypingPing(); });
      input.addEventListener('keydown', function(e){
        if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); doSend(); }
      });
    }
    if(sendBtn) sendBtn.addEventListener('click', doSend);

    // ── Bouton galerie photo ──
    if(photoBtn && photoInput){
      photoBtn.addEventListener('click', function(){ photoInput.click(); });
      photoInput.addEventListener('change', function(){
        var file = photoInput.files && photoInput.files[0];
        if(!file) return;
        photoInput.value = ''; // reset pour permettre de resélectionner le même fichier
        _dmShowPhotoPreview(file);
      });
    }
  }

  /* ══ PHOTOS ══════════════════════════════════════════════════════════ */

  var _dmPendingPhotoBlob = null;

  // Compression canvas avant upload
  function _dmCompressImage(file, maxW, maxH, quality, cb){
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function(){
      var w = img.naturalWidth, h = img.naturalHeight;
      var ratio = Math.min(maxW / w, maxH / h, 1);
      var cw = Math.round(w * ratio), ch = Math.round(h * ratio);
      var canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);
      URL.revokeObjectURL(url);
      canvas.toBlob(function(blob){ cb(blob); }, 'image/jpeg', quality);
    };
    img.onerror = function(){ URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  }

  // Afficher la prévisualisation avant envoi
  function _dmShowPhotoPreview(file){
    _dmCompressImage(file, 1200, 1200, 0.82, function(blob){
      if(!blob) return;
      _dmPendingPhotoBlob = blob;
      var previewUrl = URL.createObjectURL(blob);
      var overlay  = document.getElementById('dmPhotoPreview');
      var img      = document.getElementById('dmPhotoPreviewImg');
      var btnSend  = document.getElementById('dmPhotoPreviewSend');
      var btnCancel= document.getElementById('dmPhotoPreviewCancel');
      if(!overlay || !img) return;
      img.src = previewUrl;
      overlay.style.display = 'flex';

      btnSend.onclick = function(){
        overlay.style.display = 'none';
        URL.revokeObjectURL(previewUrl);
        _dmSendPhoto(_dmPendingPhotoBlob);
        _dmPendingPhotoBlob = null;
      };
      btnCancel.onclick = function(){
        overlay.style.display = 'none';
        URL.revokeObjectURL(previewUrl);
        _dmPendingPhotoBlob = null;
      };
      document.getElementById('dmPhotoPreviewBg').onclick = btnCancel.onclick;
    });
  }

  // Upload vers Supabase Storage + envoi du message
  function _dmSendPhoto(blob){
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId || !identity) return;

    var uuid = 'dm_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
    var path = 'dm_photos/' + coupleId + '/' + uuid + '.jpg';
    var storageUrl = SB2_URL + '/storage/v1/object/images/' + path;

    // Afficher une miniature "en cours d'envoi" immédiatement
    var tmpId  = 'tmp_photo_' + Date.now();
    var localUrl = URL.createObjectURL(blob);
    var tmpMsg = {
      id: tmpId, sender: identity, message_type: 'photo',
      photo_url: localUrl, text: '', seen: false,
      created_at: new Date().toISOString()
    };
    cache.push(tmpMsg);
    appendBubble(tmpMsg, cache.length - 1, cache);
    scrollBottom();

    // Upload Storage
    fetch(storageUrl, {
      method: 'POST',
      headers: Object.assign(sb2Headers(), { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }),
      body: blob
    })
    .then(function(r){
      if(!r.ok) throw new Error('Upload failed ' + r.status);
      // URL publique
      var publicUrl = SB2_URL + '/storage/v1/object/public/images/' + path;
      // Enregistrer le message en base
      return fetch(SB2_URL + '/rest/v1/' + TABLE, {
        method: 'POST',
        headers: sb2Headers({'Prefer':'return=representation'}),
        body: JSON.stringify({
          couple_id: coupleId, sender: identity,
          text: '', message_type: 'photo', photo_url: publicUrl
        })
      });
    })
    .then(function(r){ return r.json(); })
    .then(function(rows){
      var real = Array.isArray(rows) ? rows[0] : null;
      URL.revokeObjectURL(localUrl);
      if(real && real.id){
        // Remplacer le tmp dans le cache
        for(var i=0; i<cache.length; i++){
          if(cache[i].id === tmpId){ cache[i] = real; break; }
        }
        // Mettre à jour le data-id dans le DOM
        var node = document.querySelector('[data-id="'+tmpId+'"]');
        if(node){
          node.dataset.id = real.id;
          // Remplacer l'URL locale par l'URL publique
          var img = node.querySelector('.dm-photo-inner img');
          if(img) img.src = real.photo_url;
          var inner = node.querySelector('.dm-photo-inner');
          if(inner) inner.classList.remove('sending');
        }
      }
      // Push notif
      if(typeof window.yamPushNotify==='function'){
        window.yamPartnerOnlineCheck().then(function(online){
          if(!online){
            var _me3 = v2GetUser && v2GetUser();
            var pName = (_me3 && _me3.pseudo) || (v2GetPartnerPseudo && v2GetPartnerPseudo()) || 'Partenaire';
            window.yamPushNotify({ title: pName + ' 📷', body: 'T\'a envoyé une photo', tag: 'yam-message', data: { tab: 'messages' } });
          }
        });
      }
    })
    .catch(function(err){
      console.error('[DM PHOTO]', err);
      URL.revokeObjectURL(localUrl);
      // Retirer la miniature en erreur
      cache = cache.filter(function(m){ return m.id !== tmpId; });
      var node = document.querySelector('[data-id="'+tmpId+'"]');
      if(node) node.remove();
      if(typeof showToast === 'function') showToast('Erreur envoi photo', 'error');
    });
  }

  // Ouvrir une photo en plein écran
  window._dmOpenPhotoViewer = function(url){
    var v = document.getElementById('dmPhotoViewer');
    var img = document.getElementById('dmPhotoViewerImg');
    if(!v || !img) return;
    img.src = url;
    v.style.display = 'flex';
    document.getElementById('dmPhotoViewerClose').onclick = function(){ v.style.display = 'none'; img.src = ''; };
    document.getElementById('dmPhotoViewerBg').onclick    = function(){ v.style.display = 'none'; img.src = ''; };
  };

  /* ══ FLASH NOUVEAU MESSAGE ══ */
  function flashNewMsg(){
    var el = $('dmMessages');
    if(!el) return;
    el.classList.remove('dm-flash');
    void el.offsetWidth;
    el.classList.add('dm-flash');
    setTimeout(function(){ el.classList.remove('dm-flash'); }, 700);
  }

  /* ══ TYPING INDICATOR ══ */
  var TYPING_TABLE = 'v2_dm_typing';
  var typingEl     = null;
  var typingTimer  = null;
  var myTypingTs   = 0;

  function showTyping(who){
    if(typingEl) return;
    var el = $('dmMessages');
    if(!el) return;
    typingEl = document.createElement('div');
    typingEl.className = 'dm-typing-wrap';
    typingEl.id = 'dmTypingWrap';
    var _avSrc = (window.yamAvatarSrc) ? window.yamAvatarSrc(who) : ('assets/images/profil_' + who + '.png');
    typingEl.innerHTML =
      '<div class="dm-typing-avatar"><img src="' + _avSrc + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;"></div>' +
      '<div class="dm-typing-bubble">' +
        '<div class="dm-typing-dot"></div>' +
        '<div class="dm-typing-dot"></div>' +
        '<div class="dm-typing-dot"></div>' +
      '</div>';
    el.appendChild(typingEl);
    scrollBottom();
  }

  function hideTyping(){
    if(typingEl){ typingEl.remove(); typingEl = null; }
  }

  // ✅ CORRECTION BUG #1b — Typing Indicator avec couple_id
  function sendTypingPing(){
    var now = Date.now();
    if(now - myTypingTs < 2000) return; // debounce 2s
    myTypingTs = now;
    
    // Récupérer couple_id
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId) return;
    
    fetch(SB2_URL + '/rest/v1/' + TYPING_TABLE + '?couple_id=eq.' + coupleId + '&sender=eq.' + identity, {
      method: 'GET', headers: sb2Headers()
    }).then(function(r){ return r.json(); }).then(function(rows){
      var body = { couple_id: coupleId, sender: identity, updated_at: new Date().toISOString() };
      if(Array.isArray(rows) && rows.length){
        fetch(SB2_URL + '/rest/v1/' + TYPING_TABLE + '?couple_id=eq.' + coupleId + '&sender=eq.' + identity, {
          method: 'PATCH', headers: sb2Headers(), body: JSON.stringify(body)
        }).catch(function(){});
      } else {
        fetch(SB2_URL + '/rest/v1/' + TYPING_TABLE, {
          method: 'POST', headers: sb2Headers({'Prefer':'return=minimal'}), body: JSON.stringify(body)
        }).catch(function(){});
      }
    }).catch(function(){});
  }

  // ✅ CORRECTION BUG #1c — Poll Typing avec couple_id
  function pollTyping(){
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId) return;
    
    var other = identity === 'girl' ? 'boy' : 'girl';
    fetch(SB2_URL + '/rest/v1/' + TYPING_TABLE + '?couple_id=eq.' + coupleId + '&sender=eq.' + other, {
      headers: sb2Headers()
    }).then(function(r){ return r.json(); }).then(function(rows){
      if(!Array.isArray(rows) || !rows.length){ hideTyping(); return; }
      var ts = new Date(rows[0].updated_at).getTime();
      var age = Date.now() - ts;
      if(age < 4000){ showTyping(other); } else { hideTyping(); }
    }).catch(function(){ hideTyping(); });
  }

  /* ══ REPLY ══ */
  var _replyMsg = null;

  window.dmCancelReply = function(){
    _replyMsg = null;
    var bar = $('dmReplyBar');
    if(bar) bar.classList.remove('show');
    var inp = $('dmInput');
    if(inp) inp.focus();
  };

  function startReply(msg){
    _replyMsg = msg;
    var bar  = $('dmReplyBar');
    var txt  = $('dmReplyBarText');
    if(!bar || !txt) return;
    var who  = (typeof v2GetDisplayName==="function"?v2GetDisplayName(msg.sender):(msg.sender==="girl"?"Elle":"Lui"));
    var preview = msg.message_type === 'audio' ? '🎤 Vocal' : (msg.message_type === 'photo' ? '📷 Photo' : (msg.text || ''));
    if(preview.length > 40) preview = preview.slice(0,40) + '…';
    txt.textContent = who + ' : ' + preview;
    bar.classList.add('show');
    var inp = $('dmInput');
    if(inp) inp.focus();
  }

  /* ══ ÉDITION MESSAGE ══ */
  function startEdit(msg, wrap){
    var bbl = wrap.querySelector('.dm-bubble');
    var txt = wrap.querySelector('.dm-bubble-text');
    if(!bbl || !txt) return;

    var oldText = msg.text || '';
    txt.style.display = 'none';
    var meta = wrap.querySelector('.dm-bubble-meta');
    if(meta) meta.style.display = 'none';

    var editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'dm-edit-input';
    editInput.value = oldText;
    editInput.maxLength = 500;

    var actions = document.createElement('div');
    actions.className = 'dm-edit-actions';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'dm-edit-btn dm-edit-cancel-btn';
    cancelBtn.textContent = 'Annuler';

    var confirmBtn = document.createElement('button');
    confirmBtn.className = 'dm-edit-btn dm-edit-confirm';
    confirmBtn.textContent = 'Modifier ✓';

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    bbl.appendChild(editInput);
    bbl.appendChild(actions);
    editInput.focus();
    editInput.select();

    function cancelEdit(){
      editInput.remove(); actions.remove();
      txt.style.display = ''; if(meta) meta.style.display = '';
    }

    function confirmEdit(){
      var newText = editInput.value.trim();
      if(!newText || newText === oldText){ cancelEdit(); return; }
      editInput.remove(); actions.remove();
      txt.style.display = '';
      txt.textContent = newText;
      msg.text = newText;
      // Ajouter label "(modifié)"
      var edited = wrap.querySelector('.dm-edited-label');
      if(!edited){
        edited = document.createElement('span');
        edited.className = 'dm-edited-label';
        edited.textContent = '(modifié)';
        txt.after(edited);
      }
      if(meta) meta.style.display = '';
      if(String(msg.id).indexOf('tmp_') === 0) return;
      fetch(SB2_URL + '/rest/v1/' + TABLE + '?id=eq.' + msg.id, {
        method: 'PATCH', headers: sb2Headers(),
        body: JSON.stringify({ text: newText, edited: true })
      }).catch(function(err){ console.error('[DM] edit err:', err); });
    }

    cancelBtn.addEventListener('click', cancelEdit);
    confirmBtn.addEventListener('click', confirmEdit);
    editInput.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ e.preventDefault(); confirmEdit(); }
      if(e.key === 'Escape'){ cancelEdit(); }
    });
  }


  /* ══ LABEL "VU" INSTAGRAM ══ */
  function updateSeenLabel(){
    var el = $('dmMessages');
    if(!el) return;

    // Supprimer l'ancien label
    var old = el.querySelector('.dm-seen-label');
    if(old) old.remove();

    // Dernier message envoyé par moi qui est vu
    var lastSeen = null;
    for(var i = cache.length - 1; i >= 0; i--){
      if(cache[i].sender === identity && cache[i].seen && !cache[i].deleted){
        lastSeen = cache[i]; break;
      }
    }
    if(!lastSeen) return;

    var wrap = el.querySelector('[data-id="' + lastSeen.id + '"]');
    if(!wrap) return;

    var other = identity === 'girl' ? 'boy' : 'girl';
    var _seenSrc = (window.yamAvatarSrc) ? window.yamAvatarSrc(other) : ('assets/images/profil_' + other + '.png');
    var lbl   = document.createElement('div');
    lbl.className = 'dm-seen-label';
    lbl.innerHTML = '<span class="dm-seen-avatar" style="overflow:hidden;"><img src="' + _seenSrc + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;"></span>Vu';
    wrap.insertAdjacentElement('afterend', lbl);
  }

  // ✅ CORRECTION BUG #1a — Fetch Messages avec couple_id
  var _msgPageSize   = 50;   // messages chargés par tranche
  var _msgOlderDone  = false; // true si on a atteint le début de la conv
  var _msgLoadingOld = false; // verrou anti-doublon

  // Charge les messages plus anciens (bouton "Voir plus")
  function loadOlderMsgs(){
    if(_msgLoadingOld || _msgOlderDone) return;
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId) return;
    _msgLoadingOld = true;

    // Ancre : created_at du plus vieux message en cache
    var oldest = cache[0];
    var anchor = oldest ? ('&created_at=lt.' + encodeURIComponent(oldest.created_at)) : '';
    fetch(SB2_URL + '/rest/v1/' + TABLE + '?couple_id=eq.' + coupleId + anchor
        + '&order=created_at.desc&limit=' + _msgPageSize + '&select=*', {
      headers: sb2Headers()
    })
    .then(function(r){ return r.json(); })
    .then(function(rows){
      _msgLoadingOld = false;
      if(!Array.isArray(rows) || !rows.length){ _msgOlderDone = true; _hideLoadMoreBtn(); return; }
      // rows est en desc, on remet en asc
      rows.reverse();
      // Prépend dans cache + DOM
      var el = document.getElementById('dmMessages');
      var prevScroll = el ? el.scrollHeight : 0;
      rows.forEach(function(msg){ cache.unshift(msg); });
      // Re-rendre tout (simple et fiable)
      renderAll();
      // Restaurer position scroll pour ne pas sauter
      if(el) el.scrollTop = el.scrollHeight - prevScroll;
      if(rows.length < _msgPageSize){ _msgOlderDone = true; _hideLoadMoreBtn(); }
    })
    .catch(function(){ _msgLoadingOld = false; });
  }

  function _hideLoadMoreBtn(){
    var btn = document.getElementById('dmLoadMoreBtn');
    if(btn) btn.style.display = 'none';
  }

  function _showLoadMoreBtn(){
    var el = document.getElementById('dmMessages');
    if(!el) return;
    var btn = document.getElementById('dmLoadMoreBtn');
    if(!btn){
      btn = document.createElement('div');
      btn.id = 'dmLoadMoreBtn';
      btn.textContent = '⬆ Voir les messages précédents';
      btn.addEventListener('click', loadOlderMsgs);
      el.insertBefore(btn, el.firstChild);
    }
    btn.style.display = 'block';
  }

  function fetchMsgs(){
    // Récupérer le couple_id depuis la session
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId){
      console.warn('[DM] fetchMsgs: couple_id manquant');
      return;
    }

    // Premier chargement : les 50 derniers en ASC
    var url = SB2_URL + '/rest/v1/' + TABLE + '?couple_id=eq.' + coupleId
            + '&order=created_at.desc&limit=' + _msgPageSize + '&select=*';

    fetch(url, {
      headers: sb2Headers()
    })
    .then(function(r){
      if(!r.ok) return r.text().then(function(t){ throw new Error(r.status + ' ' + t); });
      return r.json();
    })
    .then(function(rows){
      if(!Array.isArray(rows)){ console.error('[DM] fetchMsgs: réponse inattendue', rows); return; }
      // rows est desc → remettre en asc
      rows.reverse();

      // Premier chargement
      if(!cache.length){
        cache = rows;
        renderAll();
        // Afficher le bouton "voir plus" si la page est pleine
        if(rows.length >= _msgPageSize) _showLoadMoreBtn();
        return;
      }

      // Messages nouveaux
      var knownIds = {};
      cache.forEach(function(m){ knownIds[m.id] = true; });
      var added = false;
      rows.forEach(function(msg){
        if(!knownIds[msg.id] && String(msg.id).indexOf('tmp_') !== 0){
          cache.push(msg);
          appendBubble(msg, cache.length - 1, cache);
          added = true;
          // Notification visuelle + vibration si message de l'autre
          if(msg.sender !== identity){
            if(navigator.vibrate) navigator.vibrate([40, 30, 40]);
            flashNewMsg();
            // Pilule notif dans le header (seulement si pas sur onglet messages)
            if(window._currentTab !== 'messages'){
              var senderName = (typeof v2GetDisplayName==="function"?v2GetDisplayName(msg.sender):(msg.sender==="girl"?"Elle":"Lui"));
              var senderAvatarSrc = window.yamAvatarSrc ? window.yamAvatarSrc(msg.sender) : ('assets/images/profil_'+msg.sender+'.png');
              showMsgHeaderPill(senderAvatarSrc, senderName, msg.text || '💬', true);
            }
          }
        }
      });
      if(added) scrollBottom();

      // Mettre à jour les ticks "vu" et réactions
      var seenChanged = false;
      rows.forEach(function(msg){
        if(msg.sender === identity && msg.seen){
          var cached = cache.find(function(m){ return m.id === msg.id; });
          if(cached && !cached.seen){ cached.seen = true; seenChanged = true; }
        }
        // Sync réaction depuis serveur
        var cached = cache.find(function(m){ return m.id === msg.id; });
        if(cached && cached.reaction !== msg.reaction){
          cached.reaction = msg.reaction;
          var wrap = document.querySelector('[data-id="'+msg.id+'"]');
          if(wrap){
            var old = wrap.querySelector('.dm-react');
            if(old) old.remove();
            if(msg.reaction){
              var r = document.createElement('div');
              r.className = 'dm-react';
              r.textContent = msg.reaction;
              r.addEventListener('click', function(){ setReaction(cached, wrap, null); });
              wrap.querySelector('.dm-bubble').appendChild(r);
              wrap.classList.add('has-reaction');
            } else {
              wrap.classList.remove('has-reaction');
            }
          }
        }
        // Marquer comme lu si le chat est visible
        var chatScreen = document.getElementById('dmChatScreen');
        if(chatScreen && chatScreen.style.display !== 'none' &&
           msg.sender !== identity && !msg.seen){
          markSeen(msg.id);
        }
      });
      if(seenChanged) updateSeenLabel();
    })
    .catch(function(err){ console.error('[DM] fetchMsgs erreur:', err); });
  }

  /* ══ RENDU COMPLET ══ */
  function renderAll(){
    var el = $('dmMessages');
    if(!el) return;
    el.innerHTML = '';

    if(!cache.length){
      el.innerHTML =
        '<div class="dm-empty">' +
          '<div class="dm-empty-icon">\ud83d\udcac</div>' +
          '<div class="dm-empty-text">Envoyez le premier message \u2728<br><small style="opacity:.6">Soyez vous-m\u00eames \u2665</small></div>' +
        '</div>';
      return;
    }

    var lastDay = '';
    var todayStr = new Date().toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
    todayStr = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);
    var yesterdayDate = new Date(); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    var yesterdayStr = yesterdayDate.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
    yesterdayStr = yesterdayStr.charAt(0).toUpperCase() + yesterdayStr.slice(1);

    cache.forEach(function(msg, i){
      var d   = new Date(msg.created_at);
      var day = d.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'});
      day = day.charAt(0).toUpperCase() + day.slice(1);
      var dayLabel = day === todayStr ? 'Aujourd\'hui' : (day === yesterdayStr ? 'Hier' : day);
      if(dayLabel !== lastDay){
        lastDay = dayLabel;
        var lbl = document.createElement('div');
        lbl.className   = 'dm-day-label';
        lbl.textContent = dayLabel;
        el.appendChild(lbl);
      }
      appendBubble(msg, i, cache);
    });
    scrollBottom();
    // Marquer comme lu si le chat est visible (dmChatScreen affiché)
    // On ne vérifie plus hiddenPage.classList.contains('active') car ce flag
    // peut ne pas encore être posé au moment où renderAll() s'exécute (timing race).
    var chatScreen = document.getElementById('dmChatScreen');
    if(chatScreen && chatScreen.style.display !== 'none'){
      var toMark = cache.filter(function(m){ return m.sender !== identity && !m.seen; });
      toMark.forEach(function(m){ markSeen(m.id); });
      // Si des messages ont été marqués lus, re-poller le badge immédiatement
      if(toMark.length > 0 && typeof window._dmPollUnread === 'function'){
        setTimeout(window._dmPollUnread, 800);
      }
      // Reset du badge icône PWA (iOS home screen)
      if(toMark.length > 0 && navigator.serviceWorker && navigator.serviceWorker.controller){
        if(window.yamClearAppBadge) window.yamClearAppBadge();
      }
    }
    updateSeenLabel();
  }

  /* ══ MENU CONTEXTUEL ══ */
  var REACTIONS = ['❤️','😂','🔥','😍','💀','🥺'];
  var ctxOverlay = null;
  var ctxMenu    = null;

  function closeCtxMenu(){
    if(ctxOverlay) { ctxOverlay.remove(); ctxOverlay = null; }
    if(ctxMenu)    { ctxMenu.remove();    ctxMenu    = null; }
  }

  function openCtxMenu(e, msg, wrap, bbl){
    closeCtxMenu();
    var mine = (msg.sender === identity);

    // Overlay transparent pour fermer au clic extérieur
    ctxOverlay = document.createElement('div');
    ctxOverlay.className = 'dm-ctx-overlay';
    ctxOverlay.addEventListener('click', closeCtxMenu);
    document.body.appendChild(ctxOverlay);

    // Menu
    ctxMenu = document.createElement('div');
    ctxMenu.className = 'dm-ctx-menu';

    // Réactions
    var reactRow = document.createElement('div');
    reactRow.className = 'dm-ctx-reactions';
    REACTIONS.forEach(function(em){
      var btn = document.createElement('span');
      btn.className = 'dm-ctx-react-btn';
      btn.textContent = em;
      if(msg.reaction === em) btn.classList.add('active');
      btn.addEventListener('click', function(){
        var newReact = (msg.reaction === em) ? null : em;
        setReaction(msg, wrap, newReact);
        closeCtxMenu();
      });
      reactRow.appendChild(btn);
    });
    ctxMenu.appendChild(reactRow);

    // Répondre
    var replyItem = document.createElement('div');
    replyItem.className = 'dm-ctx-item';
    replyItem.innerHTML = '<span>↩️</span> Répondre';
    replyItem.addEventListener('click', function(){
      startReply(msg);
      closeCtxMenu();
    });
    ctxMenu.appendChild(replyItem);

    // Modifier (seulement ses propres messages texte non supprimés)
    if(mine && !msg.deleted && msg.message_type !== 'audio'){
      var editItem = document.createElement('div');
      editItem.className = 'dm-ctx-item';
      editItem.innerHTML = '<span>✏️</span> Modifier';
      editItem.addEventListener('click', function(){
        startEdit(msg, wrap);
        closeCtxMenu();
      });
      ctxMenu.appendChild(editItem);
    }

    // Copier
    var copyItem = document.createElement('div');
    copyItem.className = 'dm-ctx-item';
    copyItem.innerHTML = '<span>📋</span> Copier';
    copyItem.addEventListener('click', function(){
      navigator.clipboard && navigator.clipboard.writeText(msg.text);
      closeCtxMenu();
    });
    ctxMenu.appendChild(copyItem);

    // Supprimer (seulement ses propres messages)
    if(mine){
      var delItem = document.createElement('div');
      delItem.className = 'dm-ctx-item danger';
      delItem.innerHTML = '<span>🗑️</span> Supprimer';
      delItem.addEventListener('click', function(){
        deleteMsg(msg, wrap);
        closeCtxMenu();
      });
      ctxMenu.appendChild(delItem);
    }

    // Positionner le menu
    document.body.appendChild(ctxMenu);
    var mw = ctxMenu.offsetWidth  || 170;
    var mh = ctxMenu.offsetHeight || 160;
    var vw = window.innerWidth, vh = window.innerHeight;
    var x  = e.clientX, y = e.clientY;
    if(x + mw > vw - 8) x = vw - mw - 8;
    if(y + mh > vh - 8) y = y - mh - 8;
    if(y < 8) y = 8;
    ctxMenu.style.left = x + 'px';
    ctxMenu.style.top  = y + 'px';
  }

  /* ══ RÉACTION ══ */
  function setReaction(msg, wrap, reaction){
    msg.reaction = reaction;
    // Update UI
    var old = wrap.querySelector('.dm-react');
    if(old) old.remove();
    if(reaction){
      var r = document.createElement('div');
      r.className   = 'dm-react';
      r.textContent = reaction;
      r.addEventListener('click', function(){ setReaction(msg, wrap, null); });
      wrap.querySelector('.dm-bubble').appendChild(r);
      wrap.classList.add('has-reaction');
    } else {
      wrap.classList.remove('has-reaction');
    }
    // Persist Supabase
    if(String(msg.id).indexOf('tmp_') === 0) return;
    fetch(SB2_URL + '/rest/v1/' + TABLE + '?id=eq.' + msg.id, {
      method: 'PATCH',
      headers: sb2Headers(),
      body: JSON.stringify({ reaction: reaction })
    }).catch(function(err){ console.error('[DM] reaction err:', err); });
  }

  /* ══ SUPPRESSION ══ */
  function deleteMsg(msg, wrap){
    // Soft delete UI
    var bbl = wrap.querySelector('.dm-bubble');
    var txt = wrap.querySelector('.dm-bubble-text');
    if(txt) txt.textContent = 'Message supprimé';
    if(bbl) bbl.classList.add('deleted');
    var react = wrap.querySelector('.dm-react');
    if(react) react.remove();

    if(String(msg.id).indexOf('tmp_') === 0){ wrap.remove(); return; }
    // Soft delete Supabase
    fetch(SB2_URL + '/rest/v1/' + TABLE + '?id=eq.' + msg.id, {
      method: 'PATCH',
      headers: sb2Headers(),
      body: JSON.stringify({ deleted: true, text: 'Message supprimé' })
    }).catch(function(err){ console.error('[DM] delete err:', err); });
  }

  /* ══ BULLE ══ */
  function appendBubble(msg, idx, all){
    var el = $('dmMessages');
    if(!el) return;

    var emp = el.querySelector('.dm-empty');
    if(emp) emp.remove();

    var mine     = (msg.sender === identity);
    var prev     = all[idx - 1];
    var next     = all[idx + 1];
    var samePrev = prev && prev.sender === msg.sender;
    var sameNext = next && next.sender === msg.sender;

    if(!samePrev && idx > 0){
      var sp = document.createElement('div');
      sp.className = 'dm-spacer';
      el.appendChild(sp);
    }

    // ── Rendu spécial PHOTO (sans bulle, style Instagram) ──
    if(msg.message_type === 'photo' && msg.photo_url && !msg.deleted){
      var photoWrap = document.createElement('div');
      photoWrap.className = 'dm-photo-wrap' + (mine ? ' mine' : '');
      photoWrap.dataset.id = msg.id;

      var inner = document.createElement('div');
      inner.className = 'dm-photo-inner' + (String(msg.id).indexOf('tmp_') === 0 ? ' sending' : '');

      var img = document.createElement('img');
      img.src = msg.photo_url;
      img.alt = 'Photo';
      img.loading = 'lazy';

      var d  = new Date(msg.created_at);
      var ts = ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
      var timeEl = document.createElement('div');
      timeEl.className = 'dm-photo-time';
      timeEl.textContent = ts;

      inner.appendChild(img);
      inner.appendChild(timeEl);
      photoWrap.appendChild(inner);
      el.appendChild(photoWrap);

      // Tap → plein écran
      inner.addEventListener('click', function(){
        if(window._dmOpenPhotoViewer) window._dmOpenPhotoViewer(msg.photo_url);
      });
      return; // pas de bulle classique
    }

    var wrap = document.createElement('div');
    wrap.className = 'dm-msg-wrap' + (mine ? ' mine' : '');
    if(!sameNext) wrap.classList.add('last-in-group');
    wrap.dataset.id = msg.id;

    // Avatar
    if(!mine){
      var av = document.createElement('div');
      av.className   = 'dm-avatar dm-msg-avatar ' + (msg.sender === 'girl' ? 'dm-avatar-girl' : 'dm-avatar-boy');
      // Avatar image dans les bulles
      (function(){ if(window.yamSetAvatar) window.yamSetAvatar(av, msg.sender); else av.textContent = msg.sender === 'girl' ? 'E' : 'L'; })();
      av.style.fontSize = '16px';
      av.style.background = 'none';
      av.style.visibility = samePrev ? 'hidden' : 'visible';
      wrap.appendChild(av);
    }

    // Bulle
    var bbl = document.createElement('div');
    bbl.className = 'dm-bubble' + (msg.deleted ? ' deleted' : '');

    // Reply preview
    if(msg.reply_to_text && !msg.deleted){
      var rp = document.createElement('div');
      rp.className = 'dm-reply-preview';
      var rpWho = (typeof v2GetDisplayName==="function"?v2GetDisplayName(msg.reply_to_sender):(msg.reply_to_sender==="girl"?"Elle":"Lui"));
      var rpTxt = msg.reply_to_text.length > 45 ? msg.reply_to_text.slice(0,45)+'…' : msg.reply_to_text;
      rp.textContent = rpWho + ' : ' + rpTxt;
      bbl.appendChild(rp);
    }

    if(msg.message_type === 'audio' && msg.audio_data && !msg.deleted){
      var audioBubble = document.createElement('div');
      audioBubble.className = 'dm-audio-bubble';
      var durSecs = msg.audio_duration || 0;
      var durStr  = Math.floor(durSecs/60) + ':' + ('0'+Math.floor(durSecs%60)).slice(-2);

      // Waveform pseudo-aléatoire reproductible basée sur l'id du message
      var WV_BARS = 38;
      var seed = 0;
      var seedStr = String(msg.id || '');
      for(var si=0; si<seedStr.length; si++) seed = (seed * 31 + seedStr.charCodeAt(si)) & 0xffff;
      function seededRand(){ seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 4294967296; }
      var barHeights = [];
      for(var bi=0; bi<WV_BARS; bi++){
        var center = 1 - Math.abs((bi / (WV_BARS-1)) - 0.5) * 2;
        var h = Math.round((5 + seededRand() * 20) * (0.5 + center * 0.7));
        barHeights.push(Math.max(3, Math.min(24, h)));
      }
      var barsHTML = '';
      for(var bi2=0; bi2<WV_BARS; bi2++){
        barsHTML += '<div class="dm-wv-bar" style="height:'+barHeights[bi2]+'px"></div>';
      }

      audioBubble.innerHTML =
        '<button class="dm-audio-play" data-playing="0">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>'
        + '</button>'
        + '<div class="dm-audio-right">'
        +   '<div class="dm-audio-waveform">' + barsHTML + '<div class="dm-wv-thumb"></div></div>'
        +   '<span class="dm-audio-dur">' + durStr + '</span>'
        + '</div>';

      bbl.appendChild(audioBubble);

      // Logique lecture + scrub
      (function(ab, audioData, totalDurSecs, totalDurStr){
        var playBtn  = ab.querySelector('.dm-audio-play');
        var waveform = ab.querySelector('.dm-audio-waveform');
        var bars     = ab.querySelectorAll('.dm-wv-bar');
        var thumb    = ab.querySelector('.dm-wv-thumb');
        var durEl    = ab.querySelector('.dm-audio-dur');
        var aud      = null;
        var playing  = false;
        var dragging = false;

        var ICON_PLAY  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
        var ICON_PAUSE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

        function updateVisuals(pct){
          var n = bars.length;
          var active = Math.round(pct * n);
          for(var i=0; i<n; i++){
            if(i < active) bars[i].classList.add('played');
            else           bars[i].classList.remove('played');
          }
          thumb.style.left = (pct * 100) + '%';
        }

        function updateDur(currentTime, duration){
          var rem = (duration || totalDurSecs) - currentTime;
          if(rem < 0) rem = 0;
          durEl.textContent = Math.floor(rem/60)+':'+('0'+Math.floor(rem%60)).slice(-2);
        }

        function stopAudio(){
          if(aud){ aud.pause(); aud.currentTime = 0; }
          playing = false;
          playBtn.innerHTML = ICON_PLAY;
          waveform.classList.remove('active');
          updateVisuals(0);
          durEl.textContent = totalDurStr;
        }

        function initAudio(){
          if(aud) return;
          aud = new Audio(audioData);
          aud.addEventListener('timeupdate', function(){
            if(dragging) return;
            var pct = aud.duration ? aud.currentTime / aud.duration : 0;
            updateVisuals(pct);
            updateDur(aud.currentTime, aud.duration);
          });
          aud.addEventListener('ended', stopAudio);
        }

        playBtn.addEventListener('click', function(){
          if(playing){ stopAudio(); return; }
          initAudio();
          playing = true;
          playBtn.innerHTML = ICON_PAUSE;
          waveform.classList.add('active');
          aud.play().catch(function(){ stopAudio(); });
        });

        function pctFromEvent(e){
          var rect = waveform.getBoundingClientRect();
          var clientX = (e.touches || e.changedTouches) ? (e.touches || e.changedTouches)[0].clientX : e.clientX;
          return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        }

        function seekTo(pct){
          initAudio();
          var doSeek = function(){
            aud.currentTime = pct * aud.duration;
            updateVisuals(pct);
            updateDur(aud.currentTime, aud.duration);
          };
          if(aud.readyState >= 1 && aud.duration){ doSeek(); }
          else { aud.addEventListener('loadedmetadata', doSeek, { once: true }); }
        }

        waveform.addEventListener('touchstart', function(e){
          dragging = true;
          waveform.classList.add('active');
          updateVisuals(pctFromEvent(e));
        }, { passive: true });

        waveform.addEventListener('touchmove', function(e){
          if(!dragging) return;
          var pct = pctFromEvent(e);
          updateVisuals(pct);
          var dur = aud && aud.duration ? aud.duration : totalDurSecs;
          updateDur(pct * dur, dur);
        }, { passive: true });

        waveform.addEventListener('touchend', function(e){
          if(!dragging) return;
          dragging = false;
          seekTo(pctFromEvent(e));
        }, { passive: true });

        waveform.addEventListener('click', function(e){
          seekTo(pctFromEvent(e));
        });

      })(audioBubble, 'data:' + (msg.audio_mime || 'audio/webm') + ';base64,' + msg.audio_data, durSecs, durStr);
    } else {
      var txt = document.createElement('span');
      txt.className   = 'dm-bubble-text';
      txt.textContent = msg.deleted ? '🚫 Message supprimé' : (msg.text || '');
      bbl.appendChild(txt);
      // Label modifié
      if(msg.edited && !msg.deleted){
        var editedLbl = document.createElement('span');
        editedLbl.className = 'dm-edited-label';
        editedLbl.textContent = '(modifié)';
        bbl.appendChild(editedLbl);
      }
    }

    // Heure (plus de tick dans la bulle)
    var d  = new Date(msg.created_at);
    var ts = ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2);
    var meta = document.createElement('div');
    meta.className = 'dm-bubble-meta';
    meta.textContent = ts;
    bbl.appendChild(meta);

    // Réaction existante
    if(msg.reaction){
      var r = document.createElement('div');
      r.className   = 'dm-react';
      r.textContent = msg.reaction;
      r.addEventListener('click', function(){ setReaction(msg, wrap, null); });
      bbl.appendChild(r);
      wrap.classList.add('has-reaction');
    }

    wrap.appendChild(bbl);
    el.appendChild(wrap);

    // Long press + clic droit → menu contextuel (pas sur messages supprimés)
    if(!msg.deleted){
      var tapT = null;
      var moved = false;
      wrap.addEventListener('touchstart', function(e){ 
        moved = false; 
        tapT = setTimeout(function(){ 
          if(!moved) openCtxMenu({clientX: window.innerWidth/2, clientY: window.innerHeight/2}, msg, wrap, bbl); 
        }, 500); 
      }, {passive:true});
      wrap.addEventListener('touchmove',  function(){ moved = true; clearTimeout(tapT); }, {passive:true});
      wrap.addEventListener('touchend',   function(e){ clearTimeout(tapT); }, {passive:true});
      wrap.addEventListener('contextmenu', function(e){ e.preventDefault(); openCtxMenu(e, msg, wrap, bbl); });
    }
  }

  /* ══ ENVOI ══ */
  // ✅ CORRECTION BUG #1d — Envoi message texte avec couple_id
  function doSend(){
    // Ne pas interférer si un enregistrement vocal lock est en cours
    if(window._dmLockRecordingActive && window._dmLockRecordingActive()) return;
    if(!identity){
      showIdentityOverlay();
      return;
    }
    var input = $('dmInput');
    if(!input) return;
    var text = input.value.trim();
    if(!text) return;
    input.value = '';
    // ✅ FIX iOS — setTimeout(0) obligatoire pour fermer le clavier sur iPhone/iPad
    setTimeout(function(){ input.blur(); }, 0);
    updateSendBtn();

    // Récupérer couple_id
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId){
      console.error('[DM] doSend: couple_id manquant');
      return;
    }

    // Capture reply avant de le cancel
    var replyId   = _replyMsg ? _replyMsg.id   : null;
    var replyText = _replyMsg ? (_replyMsg.message_type === 'audio' ? '🎤 Vocal' : (_replyMsg.message_type === 'photo' ? '📷 Photo' : (_replyMsg.text || ''))) : null;
    var replySender = _replyMsg ? _replyMsg.sender : null;
    window.dmCancelReply();

    // Optimistic
    var tmpId  = 'tmp_' + Date.now();
    var tmpMsg = { id: tmpId, sender: identity, text: text, seen: false, created_at: new Date().toISOString(),
                   reply_to_id: replyId, reply_to_text: replyText, reply_to_sender: replySender };
    cache.push(tmpMsg);
    appendBubble(tmpMsg, cache.length - 1, cache);
    scrollBottom();

    var body = { couple_id: coupleId, sender: identity, text: text };
    if(replyId)   body.reply_to_id     = replyId;
    if(replyText) body.reply_to_text   = replyText;
    if(replySender) body.reply_to_sender = replySender;

    fetch(SB2_URL + '/rest/v1/' + TABLE, {
      method: 'POST',
      headers: sb2Headers({'Prefer': 'return=representation'}),
      body: JSON.stringify(body)
    })
    .then(function(r){
      if(!r.ok) return r.text().then(function(t){ throw new Error(r.status + ' ' + t); });
      return r.json();
    })
    .then(function(rows){
      var real = Array.isArray(rows) ? rows[0] : null;
      if(real && real.id){
        for(var i = 0; i < cache.length; i++){
          if(cache[i].id === tmpId){ cache[i] = real; break; }
        }
        var node = document.querySelector('[data-id="'+tmpId+'"]');
        if(node) node.dataset.id = real.id;
      }
      // Flamme — premier message du jour
      if(typeof window.yamFlameActivity==='function') window.yamFlameActivity('first_message');
      // Push au partenaire uniquement s'il n'est pas déjà en ligne
      if(typeof window.yamPushNotify==='function'){
        var _me = (typeof v2GetUser==='function' && v2GetUser());
        var partnerName = (_me && _me.pseudo) || (typeof v2GetPartnerPseudo==='function' && v2GetPartnerPseudo()) || 'Partenaire';
        var preview = text.length > 60 ? text.slice(0, 57) + '...' : text;
        var _pushPayload = { title: partnerName + ' 💬', body: preview, tag: 'yam-message', data: { tab: 'messages' } };
        window.yamPartnerOnlineCheck().then(function(online){
          if(!online) window.yamPushNotify(_pushPayload);
        });
      }
    })
    .catch(function(err){
      console.error('[DM] doSend erreur:', err);
      cache = cache.filter(function(m){ return m.id !== tmpId; });
      var node = document.querySelector('[data-id="'+tmpId+'"]');
      if(node) node.remove();
    });
  }
  window.dmSend = doSend;

  /* ══ ENREGISTREMENT VOCAL ══ */
  (function(){
    var micBtn     = $('dmMicBtn');
    var recBar      = $('dmRecIndicator');
    var recTime     = $('dmRecTime');
    var recTrash    = recBar ? recBar.querySelector('.dm-rec-bar-trash') : null;
    var recWaveform = $('dmRecWaveform');
    var extremeTrash= $('dmExtremeTrash');
    var dmInput    = $('dmInput');
    if(!micBtn || !recBar) return;

    var mediaRec    = null;
    var audioChunks = [];
    var recStart    = null;
    var recTimer    = null;
    var MAX_SEC     = 60;

    var audioCtx    = null;
    var analyser    = null;
    var wvBars      = [];
    var wvRafId     = null;
    var WV_BARS     = 40;

    var cachedStream = null;

    var SWIPE_CANCEL  = 108; // px — annulation dès le seuil danger (warn = cancel)
    var SWIPE_WARN    = 108; // px — danger (poubelle rouge) = déclenchement annulation
    var SWIPE_EXTREME = 148; // px — barre disparaît — 40px après danger pour une phase visible
    var swipeStartX  = null;
    var swipeDeltaX  = 0;
    var cancelled    = false;
    var isRecording  = false;
    var touchStartTime = 0;
    var TAP_MAX_MS   = 200; // durée max d'un tap court (ms)

    // — Mode verrouillé —
    var lockBar      = $('dmRecLockBar');
    var lockTime     = $('dmRecLockTime');
    var lockWaveform = $('dmRecLockWaveform');
    var lockTrash    = $('dmRecLockTrash');
    var lockSend     = $('dmRecLockSend');

    var lockMediaRec    = null;
    var lockAudioChunks = [];
    var lockRecStart    = null;
    var lockTimer       = null;
    var lockWvBars      = [];
    var lockWvRafId     = null;
    var lockCancelled   = false;
    var isLockRecording = false;

    function buildLockWaveform(){
      if(!lockWaveform) return;
      lockWaveform.innerHTML = '';
      lockWvBars = [];
      for(var i=0; i<WV_BARS; i++){
        var b = document.createElement('div');
        b.className = 'dm-rec-wv-bar';
        b.style.height = '3px';
        lockWaveform.appendChild(b);
        lockWvBars.push(b);
      }
    }

    function startLockWaveform(stream){
      if(!window.AudioContext && !window.webkitAudioContext) return;
      try{
        var lCtx = new (window.AudioContext || window.webkitAudioContext)();
        var lAna = lCtx.createAnalyser();
        lAna.fftSize = 128;
        lAna.smoothingTimeConstant = 0.7;
        var src = lCtx.createMediaStreamSource(stream);
        src.connect(lAna);
        var data = new Uint8Array(lAna.frequencyBinCount);
        // Stocker pour pouvoir fermer
        lockBar._audioCtx = lCtx;
        function draw(){
          lockWvRafId = requestAnimationFrame(draw);
          lAna.getByteFrequencyData(data);
          var binStep = Math.floor(data.length / WV_BARS);
          for(var i=0; i<WV_BARS; i++){
            var idx = i < WV_BARS/2
              ? Math.floor(i * binStep)
              : Math.floor((WV_BARS - 1 - i) * binStep);
            var v = data[idx] / 255;
            var h = Math.round(3 + v * v * 21);
            lockWvBars[i].style.height = h + 'px';
            lockWvBars[i].style.opacity = 0.5 + v * 0.5;
          }
        }
        draw();
      }catch(e){}
    }

    function stopLockWaveform(){
      if(lockWvRafId){ cancelAnimationFrame(lockWvRafId); lockWvRafId = null; }
      if(lockBar && lockBar._audioCtx){ try{ lockBar._audioCtx.close(); }catch(e){} lockBar._audioCtx = null; }
      lockWvBars.forEach(function(b){ b.style.height = '3px'; b.style.opacity = '0.85'; });
    }

    function _closeLockBar(){
      stopLockWaveform();
      clearInterval(lockTimer);
      isLockRecording = false;
      if(lockBar) lockBar.classList.remove('active');
      if(lockTime) lockTime.textContent = '0:00';
      dmInput.style.opacity = '';
      dmInput.style.pointerEvents = '';
    }

    function startLockRecording(){
      if(!identity){ showIdentityOverlay(); return; }
      isLockRecording = true;
      // Utiliser cachedStream s'il a été pré-chargé dans touchstart
      var p = (cachedStream && cachedStream.active) ? Promise.resolve(cachedStream) : getStream();
      p.then(function(stream){
        cachedStream = stream;
        if(!isLockRecording) return; // annulé entre temps
        lockCancelled   = false;
        lockAudioChunks = [];
        lockRecStart    = Date.now();

        buildLockWaveform();
        startLockWaveform(stream);

        if(lockBar) lockBar.classList.add('active');
        dmInput.style.opacity = '0';
        dmInput.style.pointerEvents = 'none';

        lockTimer = setInterval(function(){
          var elapsed = (Date.now() - lockRecStart) / 1000;
          if(lockTime) lockTime.textContent = fmtTime(elapsed);
          if(elapsed >= MAX_SEC) stopLockRecording(true);
        }, 200);

        var mimeType = 'audio/webm';
        if(MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))      mimeType = 'audio/webm;codecs=opus';
        else if(MediaRecorder.isTypeSupported('audio/mp4'))              mimeType = 'audio/mp4';
        else if(MediaRecorder.isTypeSupported('audio/aac'))              mimeType = 'audio/aac';

        lockMediaRec = new MediaRecorder(stream, {mimeType: mimeType});
        lockMediaRec.addEventListener('dataavailable', function(e){ if(e.data.size>0) lockAudioChunks.push(e.data); });
        lockMediaRec.addEventListener('stop', function(){
          stream.getTracks().forEach(function(t){ t.stop(); });
          cachedStream = null;
          if(!lockCancelled && lockAudioChunks.length){
            var blob = new Blob(lockAudioChunks, {type: lockMediaRec.mimeType});
            var duration = (Date.now() - lockRecStart) / 1000;
            sendAudio(blob, duration);
          }
          lockAudioChunks = [];
        });
        lockMediaRec.start();
      }).catch(function(err){
        isLockRecording = false;
        console.warn('[MIC LOCK]', err);
        if(typeof showToast==='function') showToast('Micro non disponible', 'error');
      });
    }

    function stopLockRecording(send){
      if(!lockMediaRec || lockMediaRec.state==='inactive'){ _closeLockBar(); return; }
      lockCancelled = !send;
      _closeLockBar();
      lockMediaRec.stop();
    }

    if(lockTrash){
      lockTrash.addEventListener('touchstart', function(e){ e.stopPropagation(); }, {passive:true});
      lockTrash.addEventListener('click', function(e){ e.stopPropagation(); stopLockRecording(false); });
    }
    if(lockSend){
      lockSend.addEventListener('touchstart', function(e){ e.stopPropagation(); }, {passive:true});
      lockSend.addEventListener('click', function(e){ e.stopPropagation(); stopLockRecording(true); });
    }

    function fmtTime(s){ return Math.floor(s/60)+':'+('0'+Math.floor(s%60)).slice(-2); }

    function buildWaveform(){
      if(!recWaveform) return;
      recWaveform.innerHTML = '';
      wvBars = [];
      for(var i=0; i<WV_BARS; i++){
        var b = document.createElement('div');
        b.className = 'dm-rec-wv-bar';
        b.style.height = '3px';
        recWaveform.appendChild(b);
        wvBars.push(b);
      }
    }

    function startWaveform(stream){
      if(!window.AudioContext && !window.webkitAudioContext) return;
      try{
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.7;
        var src = audioCtx.createMediaStreamSource(stream);
        src.connect(analyser);
        var data = new Uint8Array(analyser.frequencyBinCount);
        function draw(){
          wvRafId = requestAnimationFrame(draw);
          analyser.getByteFrequencyData(data);
          var binStep = Math.floor(data.length / WV_BARS);
          for(var i=0; i<WV_BARS; i++){
            var idx = i < WV_BARS/2
              ? Math.floor(i * binStep)
              : Math.floor((WV_BARS - 1 - i) * binStep);
            var v = data[idx] / 255;
            var h = Math.round(3 + v * v * 21);
            wvBars[i].style.height = h + 'px';
            wvBars[i].style.opacity = 0.5 + v * 0.5;
          }
        }
        draw();
      }catch(e){}
    }

    function stopWaveform(){
      if(wvRafId){ cancelAnimationFrame(wvRafId); wvRafId = null; }
      if(audioCtx){ try{ audioCtx.close(); }catch(e){} audioCtx = null; analyser = null; }
      wvBars.forEach(function(b){ b.style.height = '3px'; b.style.opacity = '0.85'; });
    }

    function getStream(){
      if(cachedStream && cachedStream.active) return Promise.resolve(cachedStream);
      return navigator.mediaDevices.getUserMedia({audio:true}).then(function(s){
        cachedStream = s; return s;
      });
    }

    function _doRecord(stream){
      if(!isRecording) return;
      cancelled   = false;
      audioChunks = [];
      recStart    = Date.now();

      buildWaveform();
      startWaveform(stream);

      recBar.classList.add('active');
      micBtn.classList.add('recording');
      dmInput.style.opacity = '0';
      dmInput.style.pointerEvents = 'none';

      recTimer = setInterval(function(){
        var elapsed = (Date.now() - recStart) / 1000;
        if(recTime) recTime.textContent = fmtTime(elapsed);
        if(elapsed >= MAX_SEC) stopRecording(true);
      }, 200);

      var mimeType = 'audio/webm';
      if(MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))      mimeType = 'audio/webm;codecs=opus';
      else if(MediaRecorder.isTypeSupported('audio/mp4'))              mimeType = 'audio/mp4';
      else if(MediaRecorder.isTypeSupported('audio/aac'))              mimeType = 'audio/aac';

      mediaRec = new MediaRecorder(stream, {mimeType: mimeType});
      mediaRec.addEventListener('dataavailable', function(e){ if(e.data.size>0) audioChunks.push(e.data); });
      mediaRec.addEventListener('stop', function(){
        stream.getTracks().forEach(function(t){ t.stop(); });
        cachedStream = null;
        if(!cancelled && audioChunks.length){
          var blob = new Blob(audioChunks, {type: mediaRec.mimeType});
          var duration = (Date.now() - recStart) / 1000;
          sendAudio(blob, duration);
        }
        audioChunks = [];
      });
      mediaRec.start();
    }

    function _closeBar(){
      stopWaveform();
      clearInterval(recTimer);
      isRecording = false;
      micBtn.classList.remove('recording', 'swiping', 'extreme-hide');
      recBar.classList.remove('active', 'swiping', 'extreme');

      if(recTime) recTime.textContent = '0:00';
      dmInput.style.opacity = '';
      dmInput.style.pointerEvents = '';
      _resetSwipeUI();
    }

    function startRecording(){
      if(!identity){ showIdentityOverlay(); return; }
      isRecording = true;
      getStream().then(function(stream){
        _doRecord(stream);
      }).catch(function(err){
        isRecording = false;
        console.warn('[MIC]', err);
        if(typeof showToast==='function') showToast('Micro non disponible', 'error');
      });
    }

    function stopRecording(send){
      if(!mediaRec || mediaRec.state==='inactive'){ _closeBar(); return; }
      cancelled = !send;
      _closeBar();
      mediaRec.stop();
    }

    function cancelRecording(){ stopRecording(false); }

    function _resetSwipeUI(){
      swipeStartX = null;
      swipeDeltaX = 0;
      micBtn.style.transform = '';
      if(recTrash) recTrash.classList.remove('danger');
      if(extremeTrash) extremeTrash.classList.remove('active');
    }

    function sendAudio(blob, duration){
      var s = JSON.parse(localStorage.getItem('yam_v2_session')||'null');
      var coupleId = s && s.user ? s.user.couple_id : null;
      if(!coupleId){ console.error('[DM] sendAudio: couple_id manquant'); return; }
      var reader = new FileReader();
      reader.onloadend = function(){
        var b64 = reader.result.split(',')[1];
        var audioMime = blob.type || 'audio/webm';
        var tmpId  = 'tmp_' + Date.now();
        var tmpMsg = {
          id: tmpId, sender: identity,
          message_type: 'audio', audio_data: b64,
          audio_mime: audioMime, audio_duration: duration,
          text: '', seen: false, created_at: new Date().toISOString()
        };
        cache.push(tmpMsg);
        appendBubble(tmpMsg, cache.length-1, cache);
        scrollBottom();

        fetch(SB2_URL + '/rest/v1/' + TABLE, {
          method: 'POST',
          headers: sb2Headers({'Prefer':'return=representation'}),
          body: JSON.stringify({
            couple_id: coupleId, sender: identity, text: '',
            message_type: 'audio', audio_data: b64,
            audio_mime: audioMime, audio_duration: Math.round(duration)
          })
        })
        .then(function(r){ return r.json(); })
        .then(function(rows){
          var real = Array.isArray(rows) ? rows[0] : null;
          if(real && real.id){
            for(var i=0;i<cache.length;i++){
              if(cache[i].id===tmpId){ cache[i]=real; break; }
            }
            var node = document.querySelector('[data-id="'+tmpId+'"]');
            if(node) node.dataset.id = real.id;
          }
          if(typeof window.yamPushNotify==='function'){
            var _me2 = (typeof v2GetUser==='function' && v2GetUser());
            var partnerName = (_me2 && _me2.pseudo)||(typeof v2GetPartnerPseudo==='function' && v2GetPartnerPseudo())||'Partenaire';
            var _vPush = { title: partnerName+' 🎙️', body:"T'a envoyé un message vocal", tag:'yam-message', data:{tab:'messages'} };
            window.yamPartnerOnlineCheck().then(function(online){
              if(!online) window.yamPushNotify(_vPush);
            });
          }
        })
        .catch(function(err){ console.error('[AUDIO SEND]', err); });
      };
      reader.readAsDataURL(blob);
    }

    var _pendingStream = null;
    var _swipeAtEnd    = 0;
    var _gestureIsTap  = false; // posé dans touchend avant que le .then() de touchstart s'exécute

    micBtn.addEventListener('touchstart', function(e){
      e.preventDefault();
      if(isLockRecording) return;
      var touch = e.touches[0];
      swipeStartX   = touch.clientX;
      swipeDeltaX   = 0;
      _gestureIsTap = false;
      touchStartTime = Date.now();
      // getUserMedia immédiatement — Dynamic Island s'allume dès le touchstart
      _pendingStream = getStream().then(function(stream){
        cachedStream = stream;
        // Ne démarrer _doRecord que si c'est un hold (pas un tap) et que le doigt est encore appuyé
        if(!_gestureIsTap && swipeStartX !== null && !isLockRecording){
          isRecording = true;
          _doRecord(stream);
        }
        return stream;
      }).catch(function(err){
        console.warn('[MIC]', err);
        if(typeof showToast==='function') showToast('Micro non disponible', 'error');
        _pendingStream = null;
        return null;
      });
    }, {passive: false});

    micBtn.addEventListener('touchmove', function(e){
      if(swipeStartX === null) return;
      var touch = e.touches[0];
      var dx = touch.clientX - swipeStartX;
      if(dx > 0) dx = 0;
      swipeDeltaX = dx;
      var abs = Math.abs(dx);
      var danger  = abs >= SWIPE_WARN;
      var extreme = abs >= SWIPE_EXTREME;
      micBtn.classList.add('swiping');
      recBar.classList.add('swiping');
      micBtn.style.transform = 'translateX(' + Math.max(dx * 0.5, -SWIPE_CANCEL * 0.5) + 'px)';
      if(recTrash) recTrash.classList.toggle('danger', danger);
      recBar.classList.toggle('extreme', extreme);
      if(extremeTrash) extremeTrash.classList.toggle('active', extreme);
      micBtn.classList.toggle('extreme-hide', extreme);
    }, {passive: true});

    micBtn.addEventListener('touchend', function(){
      var elapsed  = Date.now() - touchStartTime;
      var isTap    = elapsed < TAP_MAX_MS && Math.abs(swipeDeltaX) < 10;
      _swipeAtEnd  = swipeDeltaX;
      _gestureIsTap = isTap; // posé AVANT reset et AVANT que le .then() puisse s'exécuter
      swipeStartX  = null;
      swipeDeltaX  = 0;

      if(isLockRecording){ _pendingStream = null; return; }

      var p = _pendingStream || getStream().catch(function(){ return null; });
      _pendingStream = null;

      if(isTap){
        // Tap → mode lock, stream déjà ouvert dans touchstart
        p.then(function(stream){
          if(!stream) return;
          // Annuler _doRecord si jamais il a démarré avant qu'on pose _gestureIsTap
          if(isRecording){ stopRecording(false); }
          cachedStream = stream;
          startLockRecording();
        });
        return;
      }

      // Hold — si _doRecord a déjà démarré dans le .then() de touchstart → arrêter
      if(isRecording){
        if(Math.abs(_swipeAtEnd) >= SWIPE_CANCEL){
          cancelRecording();
        } else {
          stopRecording(true);
        }
        return;
      }

      // Hold rare : stream pas encore prêt au touchend → démarrer + arrêter dans le .then()
      p.then(function(stream){
        if(!stream) return;
        cachedStream = stream;
        isRecording = true;
        _doRecord(stream);
        if(Math.abs(_swipeAtEnd) >= SWIPE_CANCEL){
          cancelRecording();
        } else {
          stopRecording(true);
        }
      });
    }, {passive: true});

    micBtn.addEventListener('touchcancel', function(){ cancelRecording(); }, {passive:true});

    var desktopRec = false;
    micBtn.addEventListener('click', function(e){
      if(swipeStartX !== null) return;
      e.preventDefault();
      if(!desktopRec){ desktopRec = true; startLockRecording(); }
      else            { desktopRec = false; }
    });
    micBtn.addEventListener('touchend', function(){ desktopRec = false; }, {passive:true});

    // Exposer l'état lock pour que doSend() puisse le vérifier
    window._dmLockRecordingActive = function(){ return isLockRecording; };

    // Libérer le stream micro proprement à la fermeture du chat
    window._dmReleaseStream = function(){
      if(cachedStream){
        cachedStream.getTracks().forEach(function(t){ t.stop(); });
        cachedStream = null;
      }
    };

  })();

  function markSeen(id){
    if(!id || String(id).indexOf('tmp_') === 0) return;
    fetch(SB2_URL + '/rest/v1/' + TABLE + '?id=eq.' + id, {
      method: 'PATCH',
      headers: sb2Headers(),
      body: JSON.stringify({ seen: true })
    }).catch(function(){});
  }

  function updateSendBtn(){
    var v   = $('dmInput') ? $('dmInput').value.trim() : '';
    var btn = $('dmSendBtn');
    if(btn) btn.classList.toggle('ready', v.length > 0);
  }

  function scrollBottom(){
    var el = $('dmMessages');
    if(el) setTimeout(function(){ el.scrollTop = el.scrollHeight; }, 60);
  }

  /* ══ PREVIEW ACCUEIL ══ */
  // ✅ CORRECTION BUG #1f — loadHomePreview avec couple_id
  function loadHomePreview(){
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId) return;
    
    fetch(SB2_URL + '/rest/v1/' + TABLE + '?couple_id=eq.' + coupleId + '&order=created_at.desc&limit=50&select=id,sender,text,message_type,seen,created_at,reaction,deleted,audio_duration', {
      headers: sb2Headers()
    })
    .then(function(r){ return r.json(); })
    .then(function(rows){
      if(!Array.isArray(rows) || !rows.length){
        var p = $('dmHomePreview');
        if(p) p.textContent = 'Aucun message encore \u2728';
        return;
      }
      // Ignorer les messages supprimés pour le dernier message affiché
      var validRows = rows.filter(function(m){ return !m.deleted; });
      var last  = validRows.length ? validRows[0] : rows[0];
      // Compter uniquement les messages non-lus de l'autre personne (pas les siens) et non supprimés
      var myId = identity || (typeof getProfile === 'function' ? getProfile() : null);
      var other = myId === 'girl' ? 'boy' : (myId === 'boy' ? 'girl' : null);
      var unread = other
        ? rows.filter(function(m){ return !m.seen && m.sender === other && !m.deleted; }).length
        : 0; // si on ne connaît pas l'identité, on n'affiche rien plutôt que de compter faux

      var p = $('dmHomePreview');
      var t = $('dmHomeTime');
      var b = $('dmHomeBadge');

      if(p && last){
        var who = (typeof v2GetDisplayName==="function"?v2GetDisplayName(last.sender):(last.sender==="girl"?"Elle":"Lui"));
        var txt = last.deleted ? '🚫 Message supprimé' : (last.message_type === 'audio' ? '🎤 Vocal' : (last.message_type === 'photo' ? '📷 Photo' : (last.text || '')));
        if(txt.length > 34) txt = txt.slice(0,34) + '…';
      }
      if(t){
        var d  = new Date(last.created_at);
        var now = new Date();
        var diff = (now - d) / 60000;
        if(diff < 1)       t.textContent = 'maintenant';
        else if(diff < 60) t.textContent = Math.floor(diff) + 'min';
        else               t.textContent = ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
      }
      if(b){
        if(unread > 0){ b.textContent = unread; b.style.display = 'flex'; }
        else           { b.style.display = 'none'; }
      }

      // Badge + clignotement sur le cadenas de la nav principale
      var lockBtn   = document.getElementById('lockNavBtn');
      var lockBadge = document.getElementById('lockUnreadBadge');
      if (lockBtn && lockBadge) {
        if (unread > 0) {
          lockBadge.textContent = unread > 99 ? '99+' : unread;
          lockBadge.classList.add('visible');
          lockBtn.classList.add('has-unread');
        } else {
          lockBadge.classList.remove('visible');
          lockBtn.classList.remove('has-unread');
        }
      }
    })
    .catch(function(){});
  }

  /* ══ THÈME ══ */
  function syncTheme(){
    var light = document.body.classList.contains('light');
    var moon  = $('dmThemeIconMoon'), sun = $('dmThemeIconSun');
    if(moon) moon.style.display = light ? 'none' : '';
    if(sun)  sun.style.display  = light ? ''     : 'none';
  }
  syncTheme();
  var _origTheme = window.applyThemeToggle;
  window.applyThemeToggle = function(){
    if(_origTheme) _origTheme.apply(this, arguments);
    syncTheme();
  };

  /* ══ OPEN / CLOSE ══ */
  var _origOpen = window.openHiddenPage;
  window.openHiddenPage = function(){
    if(_origOpen) _origOpen.apply(this, arguments);
    syncTheme();
    var fb = document.getElementById('floatingThemeBtn');
    if(fb){ fb.style.opacity = '0'; fb.style.pointerEvents = 'none'; }
    var saved = getProfile();
    if(saved === 'girl' || saved === 'boy') identity = saved;
    attached = false;
    if(window._dmUpdateHeaderAvatars) window._dmUpdateHeaderAvatars();
    if(window._dmUpdateVP) window._dmUpdateVP();
    // Reset immédiat du badge visuel dès l'ouverture
    var lockBadge = document.getElementById('lockUnreadBadge');
    var lockBtn   = document.getElementById('lockNavBtn');
    if(lockBadge) lockBadge.classList.remove('visible');
    if(lockBtn)   lockBtn.classList.remove('has-unread');
    // Reset badge icône PWA systématiquement à l'ouverture du chat
    if(navigator.serviceWorker && navigator.serviceWorker.controller){
      if(window.yamClearAppBadge) window.yamClearAppBadge();
    }
    // Toujours afficher conv directement — plus d'écran intermédiaire/logo
    showConvScreen();
    // Re-poller le badge après que les markSeen soient partis en base
    setTimeout(function(){
      if(typeof window._dmPollUnread === 'function') window._dmPollUnread();
    }, 1500);
  };

  var _origClose = window.closeHiddenPage;
  window.closeHiddenPage = function(){
    stopPoll();
    attached = false;
    // Libérer le stream micro pour que iOS n'affiche plus l'indicateur Dynamic Island
    if(window._dmReleaseStream) window._dmReleaseStream();
    // Retirer dm-chat-active — hiddenPage n'est plus actif
    document.body.classList.remove('dm-chat-active');
    var fb = document.getElementById('floatingThemeBtn');
    if(fb){ fb.style.opacity = ''; fb.style.pointerEvents = ''; }
    if(window._dmUpdateVP) window._dmUpdateVP();
    if(_origClose) _origClose.apply(this, arguments);
    // Dispatch event so nav can clean up messages active state
    document.dispatchEvent(new CustomEvent('hiddenPageClosed'));
  };

  // ── Fonctions brutes exposées pour applyState (History IIFE) ──
  // Ces versions font le travail visuel SANS pousser dans l'historique.
  window._dmRawOpen = function(){
    // Ouvre hiddenPage + setup de base, sans push
    var hp = document.getElementById('hiddenPage');
    if(hp) hp.classList.add('active');
    syncTheme();
    var fb = document.getElementById('floatingThemeBtn');
    if(fb){ fb.style.opacity = '0'; fb.style.pointerEvents = 'none'; }
    var saved = getProfile();
    if(saved === 'girl' || saved === 'boy') identity = saved;
    attached = false;
    if(window._dmUpdateVP) window._dmUpdateVP();
  };
  // Fonctions brutes — toutes redirigent vers les fonctions simplifiées
  window._dmRawShowHome = function(dir){ showConvScreen(dir); };
  window._dmRawShowConv = function(dir){ showConvScreen(dir); };
  window._dmRawShowChat = function(dir){
    var saved = getProfile();
    if(saved === 'girl' || saved === 'boy'){
      identity = saved;
      showScreen('chat', dir);
      startChat();
    }
  };

})();


/* ══════════════════════════════════════════
   BADGE NON-LUS — poll indépendant au démarrage
   Runs without needing to open hiddenPage first
══════════════════════════════════════════ */
(function(){
  var _bgSeenPillIds = {};

  function _pollDmBadge(){
    var s = null;
    try{ s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null'); }catch(e){}
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId || typeof SB2_URL === 'undefined') return;
    var myProfile = (typeof getProfile === 'function') ? getProfile() : null;
    fetch(SB2_URL + '/rest/v1/v2_dm_messages?couple_id=eq.' + coupleId + '&seen=eq.false&select=id,sender,text&order=created_at.desc&limit=20', {
      headers: (typeof sb2Headers === 'function') ? sb2Headers() : {'apikey': SB2_KEY, 'Authorization': 'Bearer ' + SB2_KEY}
    })
    .then(function(r){ return r.json(); })
    .then(function(rows){
      if(!Array.isArray(rows)) return;

      // — Badge non-lus —
      var unread = myProfile
        ? rows.filter(function(m){ return m.sender !== myProfile; }).length
        : 0; // identité inconnue → on n'affiche rien plutôt que compter faux
      var lockBtn   = document.getElementById('lockNavBtn');
      var lockBadge = document.getElementById('lockUnreadBadge');
      if(lockBtn){
        if(unread > 0){ lockBtn.classList.add('has-unread'); }
        else           { lockBtn.classList.remove('has-unread'); }
      }
      if(lockBadge){
        if(unread > 0){ lockBadge.textContent = unread > 99 ? '99+' : unread; lockBadge.classList.add('visible'); }
        else           { lockBadge.classList.remove('visible'); }
      }

      // — Pilule notification (seulement hors onglet messages et hors chat actif) —
      if(window._currentTab === 'messages') return;
      if(window._chatPollId) return;
      rows.forEach(function(msg){
        if(!myProfile || msg.sender === myProfile) return;
        if(_bgSeenPillIds[msg.id]) return;
        _bgSeenPillIds[msg.id] = true;
        var senderName = (typeof v2GetDisplayName === 'function') ? v2GetDisplayName(msg.sender) : (msg.sender === 'girl' ? 'Elle' : 'Lui');
        var senderSrc = window.yamAvatarSrc ? window.yamAvatarSrc(msg.sender) : ('assets/images/profil_' + msg.sender + '.png');
        if(window.showMsgHeaderPill) window.showMsgHeaderPill(senderSrc, senderName, msg.text || '💬', true);
      });
    })
    .catch(function(){});
  }

  // Démarrer après que les autres modules sont prêts
  function _startBadgePoll(){
    if(typeof SB2_URL === 'undefined' || typeof sb2Headers === 'undefined'){
      setTimeout(_startBadgePoll, 500);
      return;
    }
    _pollDmBadge();
    setInterval(_pollDmBadge, 8000); // toutes les 8s
  }

  window._dmPollUnread = _pollDmBadge;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(_startBadgePoll, 1500); });
  } else {
    setTimeout(_startBadgePoll, 1500);
  }
})();

/* ══════════════════════════════════════════
   NOTIF PILULE HEADER — nouveau message
══════════════════════════════════════════ */
(function(){
  var _pillTimer = null;

  window.showMsgHeaderPill = function(emoji, name, text, isImgSrc){
    var pill = document.getElementById('msgHeaderPill');
    var av   = document.getElementById('mhpAvatar');
    var nm   = document.getElementById('mhpName');
    var tx   = document.getElementById('mhpText');
    if(!pill) return;

    if(_pillTimer){ clearTimeout(_pillTimer); _pillTimer = null; }

    if(av){
      var _img = av.querySelector('img');
      if(isImgSrc){
        // URL d'avatar — afficher l'img, supprimer tout span texte résiduel
        if(_img){ _img.src = emoji; _img.style.display='block'; }
        var _spanOld = av.querySelector('span.mhp-em');
        if(_spanOld) _spanOld.parentNode.removeChild(_spanOld);
        av.style.fontSize='';
      } else {
        // Emoji/texte — cacher l'img, afficher un span
        if(_img) _img.style.display='none';
        av.style.fontSize='18px';
        var _span = av.querySelector('span.mhp-em');
        if(!_span){ _span=document.createElement('span'); _span.className='mhp-em'; av.appendChild(_span); }
        _span.textContent = emoji || '💬';
      }
    }
    if(nm) nm.textContent = name  || 'Nouveau message';
    var display = (text || '…').toString();
    if(display.length > 40) display = display.slice(0, 40) + '…';
    if(tx) tx.textContent = display;

    pill.classList.remove('hiding');
    pill.style.display = 'flex';
    void pill.offsetWidth; // reflow pour relancer l'animation
    document.body.classList.add('msg-pill-active');
    var ov = document.getElementById('msgPillOverlay');
    if(ov){ ov.style.display='block'; void ov.offsetWidth; ov.classList.add('active'); }

    _pillTimer = setTimeout(function(){
      pill.classList.add('hiding');
      document.body.classList.remove('msg-pill-active');
      if(ov){ ov.classList.remove('active'); setTimeout(function(){ ov.style.display='none'; }, 350); }
      setTimeout(function(){
        pill.style.display = 'none';
        pill.classList.remove('hiding');
      }, 300);
      _pillTimer = null;
    }, 4000);
  };

  // Cacher la pilule et ouvrir directement le chat
  window._hidePillAndOpenChat = function(){
    _hidePill();
    // Ouvrir InstaLove directement sur le chat
    if(window.openHiddenPage) window.openHiddenPage();
    setTimeout(function(){
      if(window.dmOpenMessaging) window.dmOpenMessaging();
    }, 120);
  };

  // Cacher la pilule quand on passe sur l'onglet messages
  document.addEventListener('yamTabChange', function(e){
    if(e.detail === 'messages') _hidePill();
  });
  function _hidePill(){
    var pill = document.getElementById('msgHeaderPill');
    if(!pill || pill.style.display === 'none') return;
    if(_pillTimer){ clearTimeout(_pillTimer); _pillTimer = null; }
    document.body.classList.remove('msg-pill-active');
    var ov = document.getElementById('msgPillOverlay');
    if(ov){ ov.classList.remove('active'); setTimeout(function(){ ov.style.display='none'; }, 350); }
    pill.classList.add('hiding');
    setTimeout(function(){ pill.style.display='none'; pill.classList.remove('hiding'); }, 280);
  }
  // Hook sur yamSwitchTab
  var _origSwitchPill = window.yamSwitchTab;
  window.yamSwitchTab = function(tab){
    if(_origSwitchPill) _origSwitchPill.apply(this, arguments);
    if(tab === 'messages') _hidePill();
  };
})();
