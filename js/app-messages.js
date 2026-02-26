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

  function showScreen(name, dir){
    var ov = $('dmIdentityScreen');
    if(ov) ov.style.display = 'none';
    var center  = $('dmTopbarCenter');
    var backBtn = $('dmTopbarBack');
    var outgoing = dir ? _dmGetVisible() : null;

    if(name === 'home'){
      var el = $('dmHomeScreen');
      _dmSlide(el, outgoing !== el ? outgoing : null, dir);
      if(center) center.innerHTML =
        '<div style="display:flex;flex-direction:column;line-height:1.2;">' +
        '<span style="font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--green);">You And Me</span>' +
        '<span style="font-family:\'Playfair Display\',serif;font-size:17px;font-weight:700;color:var(--text);line-height:1.1;">YAM</span>' +
        '</div>';
      if(backBtn){ backBtn.dataset.dest = 'close'; backBtn.style.visibility = 'hidden'; }
      var lbl = $('dmBackLabel'); if(lbl) lbl.textContent = 'Retour';
      var logo = $('dmHomeLogo'), conv = $('dmHomeConv');
      if(logo) logo.style.display = 'none'; // logo supprimé — fenêtre parasite purgée
      if(conv) conv.style.display = 'flex';  // toujours afficher la conv directement
      loadHomePreview();
    } else if(name === 'chat'){
      var el = $('dmChatScreen');
      _dmSlide(el, outgoing !== el ? outgoing : null, dir);
      // Masquer le bloc avatars de droite (doublon — avatars déjà dans le centre)
      var dmHA = document.getElementById('dmHeaderAvatars');
      if(dmHA) dmHA.style.display = 'none';
      if(center) center.innerHTML =
        '<div class="dm-topbar-avatars">' +
          '<div class="dm-avatar dm-avatar-girl" style="font-size:14px;background:none;">👧</div>' +
          '<div class="dm-avatar dm-avatar-boy" style="font-size:14px;background:none;">👦</div>' +
        '</div>' +
        '<div class="dm-topbar-names">' +
          '<span class="dm-topbar-title">Nous \u2764\ufe0f</span>' +
          '<span class="dm-topbar-sub" id="dmStatus">\u2022 En ligne</span>' +
        '</div>';
      if(backBtn){ backBtn.dataset.dest = 'home'; backBtn.style.visibility = 'visible'; }
      var lbl2 = $('dmBackLabel'); if(lbl2) lbl2.textContent = 'Retour';
      var lockBadge = document.getElementById('lockUnreadBadge');
      var lockBtn   = document.getElementById('lockNavBtn');
      if(lockBadge) lockBadge.classList.remove('visible');
      if(lockBtn)   lockBtn.classList.remove('has-unread');
    }
    updateProfilePill(name);
  }

  window.dmShowConv = function(){
    var logo = document.getElementById('dmHomeLogo');
    var conv = document.getElementById('dmHomeConv');
    if(logo) logo.style.display = 'none';
    if(conv) conv.style.display = 'flex';
    // Slide forward sur dmHomeScreen lui-même (logo→conv, même conteneur)
    var hs = document.getElementById('dmHomeScreen');
    if(hs){
      hs.style.transition = 'none'; hs.style.transform = 'translateX(100%)';
      void hs.getBoundingClientRect();
      requestAnimationFrame(function(){ requestAnimationFrame(function(){
        hs.style.transition = 'transform '+_dmDur+'ms cubic-bezier(.4,0,.2,1)';
        hs.style.transform = 'translateX(0)';
        setTimeout(function(){ hs.style.transition=''; }, _dmDur+50);
      }); });
    }
    var center = document.getElementById('dmTopbarCenter');
    if(center) center.innerHTML =
      '<div style="display:flex;flex-direction:column;line-height:1.2;">' +
      '<span style="font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--green);">You And Me</span>' +
      '<span style="font-family:\'Playfair Display\',serif;font-size:17px;font-weight:700;color:var(--text);line-height:1.1;">YAM</span>' +
      '</div>';
    var btn = document.getElementById('dmTopbarBack');
    if(btn){ btn.dataset.dest = 'close'; btn.style.visibility = 'hidden'; }
    var lbl = document.getElementById('dmBackLabel');
    if(lbl) lbl.textContent = 'Retour';
    loadHomePreview();
  };

  window.dmHideConv = function(){
    var logo = document.getElementById('dmHomeLogo');
    var conv = document.getElementById('dmHomeConv');
    if(logo) logo.style.display = 'none'; // logo supprimé
    if(conv) conv.style.display = 'flex';  // on garde conv visible (plus de logo intermédiaire)
    var btn = document.getElementById('dmTopbarBack');
    if(btn){ btn.dataset.dest = 'close'; btn.style.visibility = 'hidden'; }
    var lbl = document.getElementById('dmBackLabel');
    if(lbl) lbl.textContent = 'Retour';
  };

  /* ══ BOUTON RETOUR ══ */
  window.dmHandleBack = function(){
    var btn  = $('dmTopbarBack');
    var dest = btn ? (btn.dataset.dest || 'close') : 'close';
    if(dest === 'close'){
      closeHiddenPage();
    } else {
      // Utiliser history.go(-1) pour rester en sync avec la pile d'historique
      // Le popstate appliquera le bon état visuel via applyState
      history.go(-1);
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
    var emojiBtn = $('dmEmojiBtn');
    var picker   = $('dmEmojiPicker');

    if(input){
      input.addEventListener('input', function(){ updateSendBtn(); sendTypingPing(); });
      input.addEventListener('keydown', function(e){
        if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); doSend(); }
      });
    }
    if(sendBtn) sendBtn.addEventListener('click', doSend);

    if(emojiBtn && picker){
      picker.querySelectorAll('span').forEach(function(sp){
        sp.addEventListener('click', function(ev){
          ev.stopPropagation();
          var input = $('dmInput');
          if(!input) return;
          var s = input.selectionStart, en = input.selectionEnd;
          input.value = input.value.slice(0,s) + sp.textContent + input.value.slice(en);
          input.selectionStart = input.selectionEnd = s + sp.textContent.length;
          input.focus();
          updateSendBtn();
          picker.classList.remove('open');
          emojiBtn.classList.remove('open');
        });
      });
      emojiBtn.addEventListener('click', function(ev){
        ev.stopPropagation();
        picker.classList.toggle('open');
        emojiBtn.classList.toggle('open', picker.classList.contains('open'));
      });
      document.addEventListener('click', function(){
        if(picker) picker.classList.remove('open');
        if(emojiBtn) emojiBtn.classList.remove('open');
      });
    }
  }

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
    var emo = who === 'girl' ? '👧' : '👦';
    typingEl.innerHTML =
      '<div class="dm-typing-avatar">' + emo + '</div>' +
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
    var who  = (typeof v2GetDisplayName==="function"?v2GetDisplayName(msg.sender):(msg.sender==="girl"?"👧":"👦"));
    var preview = msg.message_type === 'audio' ? '🎤 Vocal' : (msg.text || '');
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
    var emo   = other === 'girl' ? '👧' : '👦';
    var lbl   = document.createElement('div');
    lbl.className = 'dm-seen-label';
    lbl.innerHTML = '<span class="dm-seen-avatar">' + emo + '</span>Vu';
    wrap.insertAdjacentElement('afterend', lbl);
  }

  // ✅ CORRECTION BUG #1a — Fetch Messages avec couple_id
  function fetchMsgs(){
    // Récupérer le couple_id depuis la session
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId){
      console.warn('[DM] fetchMsgs: couple_id manquant');
      return;
    }
    
    fetch(SB2_URL + '/rest/v1/' + TABLE + '?couple_id=eq.' + coupleId + '&order=created_at.asc&limit=300&select=*', {
      headers: sb2Headers()
    })
    .then(function(r){
      if(!r.ok) return r.text().then(function(t){ throw new Error(r.status + ' ' + t); });
      return r.json();
    })
    .then(function(rows){
      if(!Array.isArray(rows)){ console.error('[DM] fetchMsgs: réponse inattendue', rows); return; }

      // Premier chargement
      if(!cache.length){
        cache = rows;
        renderAll();
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
              var senderName = (typeof v2GetDisplayName==="function"?v2GetDisplayName(msg.sender):(msg.sender==="girl"?"👧":"👦"));
              var senderEmoji = msg.sender === 'girl' ? '👧' : '👦';
              showMsgHeaderPill(senderEmoji, senderName, msg.text || '💬');
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
        // Ne marquer comme lu QUE si InstaLove est ouvert ET on est dans dmChatScreen
        var hiddenPage = document.getElementById('hiddenPage');
        var chatScreen = document.getElementById('dmChatScreen');
        if(hiddenPage && hiddenPage.classList.contains('active') &&
           chatScreen && chatScreen.style.display !== 'none' &&
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
    // Ne marquer comme lu QUE si InstaLove est ouvert ET on est dans dmChatScreen
    var hiddenPage = document.getElementById('hiddenPage');
    var chatScreen = document.getElementById('dmChatScreen');
    if(hiddenPage && hiddenPage.classList.contains('active') && 
       chatScreen && chatScreen.style.display !== 'none'){
      cache.forEach(function(m){ if(m.sender !== identity && !m.seen) markSeen(m.id); });
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

    var wrap = document.createElement('div');
    wrap.className = 'dm-msg-wrap' + (mine ? ' mine' : '');
    if(!samePrev) wrap.classList.add('first-in-group');
    if(!sameNext) wrap.classList.add('last-in-group');
    wrap.dataset.id = msg.id;

    // Avatar
    if(!mine){
      var av = document.createElement('div');
      av.className   = 'dm-avatar dm-msg-avatar ' + (msg.sender === 'girl' ? 'dm-avatar-girl' : 'dm-avatar-boy');
      av.textContent = msg.sender === 'girl' ? '👧' : '👦';
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
      var rpWho = (typeof v2GetDisplayName==="function"?v2GetDisplayName(msg.reply_to_sender):(msg.reply_to_sender==="girl"?"👧":"👦"));
      var rpTxt = msg.reply_to_text.length > 45 ? msg.reply_to_text.slice(0,45)+'…' : msg.reply_to_text;
      rp.textContent = rpWho + ' : ' + rpTxt;
      bbl.appendChild(rp);
    }

    if(msg.message_type === 'audio' && msg.audio_data && !msg.deleted){
      // Bulle vocale
      var audioBubble = document.createElement('div');
      audioBubble.className = 'dm-audio-bubble';
      var durSecs = msg.audio_duration || 0;
      var durStr = Math.floor(durSecs/60) + ':' + ('0'+Math.floor(durSecs%60)).slice(-2);
      audioBubble.innerHTML =
        '<button class="dm-audio-play" data-playing="0">'
        + '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>'
        + '</button>'
        + '<div class="dm-audio-bar"><div class="dm-audio-progress"></div></div>'
        + '<span class="dm-audio-dur">'+durStr+'</span>';
      bbl.appendChild(audioBubble);

      // Logique de lecture
      (function(ab, audioData){
        var playBtn  = ab.querySelector('.dm-audio-play');
        var progress = ab.querySelector('.dm-audio-progress');
        var durEl    = ab.querySelector('.dm-audio-dur');
        var aud      = null;
        var playing  = false;
        function stopAudio(){
          if(aud){ aud.pause(); aud.currentTime=0; }
          playing = false;
          playBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
          progress.style.width = '0%';
          durEl.textContent = durStr;
        }
        playBtn.addEventListener('click', function(){
          if(playing){ stopAudio(); return; }
          if(!aud){
            aud = new Audio(audioData);
            aud.addEventListener('timeupdate', function(){
              var pct = aud.duration ? (aud.currentTime/aud.duration*100) : 0;
              progress.style.width = pct + '%';
              var rem = aud.duration - aud.currentTime;
              durEl.textContent = Math.floor(rem/60)+':'+('0'+Math.floor(rem%60)).slice(-2);
            });
            aud.addEventListener('ended', stopAudio);
          }
          playing = true;
          playBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
          aud.play().catch(function(){});
        });
      })(audioBubble, 'data:audio/webm;base64,' + msg.audio_data);
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
    if(!identity){
      showIdentityOverlay();
      return;
    }
    var input = $('dmInput');
    if(!input) return;
    var text = input.value.trim();
    if(!text) return;
    input.value = '';
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
    var replyText = _replyMsg ? (_replyMsg.message_type === 'audio' ? '🎤 Vocal' : (_replyMsg.text || '')) : null;
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
  // ✅ CORRECTION BUG #1e — Envoi message audio avec couple_id
  (function(){
    var micBtn     = $('dmMicBtn');
    var recInd     = $('dmRecIndicator');
    var recTime    = $('dmRecTime');
    var dmInput    = $('dmInput');
    if(!micBtn) return;

    var mediaRec   = null;
    var audioChunks= [];
    var recStart   = null;
    var recTimer   = null;
    var MAX_SEC    = 30;
    var pressing   = false;

    function fmtTime(s){ return Math.floor(s/60)+':'+('0'+Math.floor(s%60)).slice(-2); }

    function startRecording(){
      if(!identity){ showIdentityOverlay(); return; }
      navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
        pressing = true;
        audioChunks = [];
        recStart = Date.now();
        micBtn.classList.add('recording');
        recInd.classList.add('active');
        dmInput.placeholder = 'Enregistrement…';

        // Timer affiché
        recTimer = setInterval(function(){
          var elapsed = (Date.now() - recStart) / 1000;
          recTime.textContent = fmtTime(elapsed);
          if(elapsed >= MAX_SEC) stopRecording(true);
        }, 200);

        mediaRec = new MediaRecorder(stream, {mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'});
        mediaRec.addEventListener('dataavailable', function(e){ if(e.data.size > 0) audioChunks.push(e.data); });
        mediaRec.addEventListener('stop', function(){
          stream.getTracks().forEach(function(t){ t.stop(); });
          if(!pressing && audioChunks.length){
            var blob = new Blob(audioChunks, {type: mediaRec.mimeType});
            var duration = (Date.now() - recStart) / 1000;
            sendAudio(blob, duration);
          }
          audioChunks = [];
        });
        mediaRec.start();
      }).catch(function(err){
        console.warn('[MIC]', err);
        alert('Micro non disponible : ' + err.message);
      });
    }

    function stopRecording(send){
      if(!mediaRec || mediaRec.state === 'inactive') return;
      clearInterval(recTimer);
      pressing = !send;
      micBtn.classList.remove('recording');
      recInd.classList.remove('active');
      recTime.textContent = '0:00';
      dmInput.placeholder = 'Message…';
      mediaRec.stop();
    }

    function sendAudio(blob, duration){
      var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
      var coupleId = s && s.user ? s.user.couple_id : null;
      if(!coupleId){
        console.error('[DM] sendAudio: couple_id manquant');
        return;
      }
      
      var reader = new FileReader();
      reader.onloadend = function(){
        var b64 = reader.result.split(',')[1];
        var tmpId  = 'tmp_' + Date.now();
        var tmpMsg = {
          id: tmpId, sender: identity,
          message_type: 'audio', audio_data: b64,
          audio_duration: duration,
          text: '', seen: false, created_at: new Date().toISOString()
        };
        cache.push(tmpMsg);
        appendBubble(tmpMsg, cache.length-1, cache);
        scrollBottom();

        fetch(SB2_URL + '/rest/v1/' + TABLE, {
          method: 'POST',
          headers: sb2Headers({'Prefer':'return=representation'}),
          body: JSON.stringify({
            couple_id: coupleId,
            sender: identity, text: '',
            message_type: 'audio', audio_data: b64,
            audio_duration: Math.round(duration)
          })
        })
        .then(function(r){ return r.json(); })
        .then(function(rows){
          var real = Array.isArray(rows) ? rows[0] : null;
          if(real && real.id){
            for(var i=0; i<cache.length; i++){
              if(cache[i].id===tmpId){ cache[i]=real; break; }
            }
            var node = document.querySelector('[data-id="'+tmpId+'"]');
            if(node) node.dataset.id = real.id;
          }
        })
        .catch(function(err){ console.error('[AUDIO SEND]', err); });
      };
      reader.readAsDataURL(blob);
    }

    // Tap pour démarrer / tap pour arrêter et envoyer
    var isRecording = false;
    micBtn.addEventListener('click', function(e){
      e.preventDefault();
      if(!isRecording){
        isRecording = true;
        startRecording();
      } else {
        isRecording = false;
        stopRecording(true);
      }
    });
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
      var other = identity === 'girl' ? 'boy' : (identity === 'boy' ? 'girl' : null);
      var unread = other
        ? rows.filter(function(m){ return !m.seen && m.sender === other && !m.deleted; }).length
        : rows.filter(function(m){ return !m.seen && !m.deleted; }).length;

      var p = $('dmHomePreview');
      var t = $('dmHomeTime');
      var b = $('dmHomeBadge');

      if(p && last){
        var who = (typeof v2GetDisplayName==="function"?v2GetDisplayName(last.sender):(last.sender==="girl"?"👧":"👦"));
        var txt = last.deleted ? '🚫 Message supprimé' : (last.message_type === 'audio' ? '🎤 Vocal' : (last.text || ''));
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
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    if(saved === 'girl' || saved === 'boy'){
      // Aller à l'écran intermédiaire (liste conv) et non directement au chat
      showScreen('home');
      // Afficher directement la carte conv (pas le logo) — version raw sans push pile
      if(window._dmRawShowConv) window._dmRawShowConv();
      else if(window.dmShowConv) window.dmShowConv();
    } else {
      showScreen('home');
    }
  };

  var _origClose = window.closeHiddenPage;
  window.closeHiddenPage = function(){
    stopPoll();
    attached = false;
    var fb = document.getElementById('floatingThemeBtn');
    if(fb){ fb.style.opacity = ''; fb.style.pointerEvents = ''; }
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
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
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
  };
  window._dmRawShowHome = function(dir){ showScreen('home', dir); };
  window._dmRawShowConv = function(dir){
    var logo = document.getElementById('dmHomeLogo');
    var conv = document.getElementById('dmHomeConv');
    if(logo) logo.style.display = 'none';
    if(conv) conv.style.display = 'flex';
    // Slide sur dmHomeScreen (logo→conv ou retour conv→logo)
    var hs = document.getElementById('dmHomeScreen');
    if(hs && dir){
      var st = dir==='forward' ? 'translateX(100%)' : 'translateX(-100%)';
      hs.style.transition='none'; hs.style.transform=st;
      void hs.getBoundingClientRect();
      requestAnimationFrame(function(){ requestAnimationFrame(function(){
        hs.style.transition='transform 300ms cubic-bezier(.4,0,.2,1)';
        hs.style.transform='translateX(0)';
        setTimeout(function(){ hs.style.transition=''; },350);
      }); });
    }
    var btn = document.getElementById('dmTopbarBack');
    if(btn){ btn.dataset.dest = 'close'; btn.style.visibility = 'hidden'; }
    var lbl = document.getElementById('dmBackLabel');
    if(lbl) lbl.textContent = 'Retour';
    loadHomePreview();
  };
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
   NOTIF PILULE HEADER — nouveau message
══════════════════════════════════════════ */
(function(){
  var _pillTimer = null;

  window.showMsgHeaderPill = function(emoji, name, text){
    var pill = document.getElementById('msgHeaderPill');
    var av   = document.getElementById('mhpAvatar');
    var nm   = document.getElementById('mhpName');
    var tx   = document.getElementById('mhpText');
    if(!pill) return;

    if(_pillTimer){ clearTimeout(_pillTimer); _pillTimer = null; }

    if(av) av.textContent = emoji || '💬';
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
    // 1. Ouvrir InstaLove (hiddenPage)
    if(window.openHiddenPage) window.openHiddenPage();
    // 2. Afficher la liste des convs
    setTimeout(function(){
      if(window.dmShowConv) window.dmShowConv();
      // 3. Ouvrir directement le chat
      setTimeout(function(){
        if(window.dmOpenMessaging) window.dmOpenMessaging();
      }, 120);
    }, 80);
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
