// ═══════════════════════════════════════════════════════════════════
// app-home.js — Onglet Accueil
// ← migré depuis app-inline.js BLOC 12
//
// Contient :
//   - Mascotte IA (phrases du jour, génération Gemini, cache local+SB)
//   - Rappels du jour (CRUD, génération IA, sync SB)
//   - Sync humeurs / présence / avatars (homeSyncMood, homeSyncSpam)
//
// Dépendances globales (définies dans app-core.js) :
//   SB_URL, SB_ANON_KEY, sb2Headers(), yamGetUser(), yamGetAccessToken(),
//   getProfile(), setProfile(), showToast(), yamFlameActivity()
// ═══════════════════════════════════════════════════════════════════

'use strict';


// ═══════════════════════════════════════════════════════════════════
// Mascotte IA — phrases contextuelles du jour (matin / après-midi / soir)
// ═══════════════════════════════════════════════════════════════════
(function(){
  var GROQ_EDGE  = SB_URL + '/functions/v1/gemini-suggest';
  var PER_SLOT   = 5;
  var _phrases   = [];
  var _lastIdx   = -1;
  var _generating= false;

  function _userId(){   var u=yamGetUser(); return u?u.id:null; }
  function _coupleId(){ var u=yamGetUser(); return u?u.couple_id:null; }
  function _role(){     var u=yamGetUser(); return u?u.role:null; }
  function _partner(){  var u=yamGetUser(); return u&&u.partner_pseudo?u.partner_pseudo:null; }

  function _today(){
    var d=new Date();
    return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
  }

  function _currentState(){
    var now=new Date(), totalMin=now.getHours()*60+now.getMinutes();
    if(totalMin>=300&&totalMin<720)  return {slotIdx:0,phraseIdx:Math.min(4,Math.floor((totalMin-300)/84))};
    if(totalMin>=720&&totalMin<1140) return {slotIdx:1,phraseIdx:Math.min(4,Math.floor((totalMin-720)/84))};
    var elapsed=(totalMin>=1140)?totalMin-1140:totalMin+300;
    return {slotIdx:2,phraseIdx:Math.min(4,Math.floor(elapsed/120))};
  }

  function _globalIdx(state){ return state.slotIdx*PER_SLOT+state.phraseIdx; }
  function _lkey(uid){ return 'yam_mascot_'+uid; }
  function _sbSlot(role){ return _today()+'_'+role; }

  function _loadLocal(uid){
    try{
      var o=JSON.parse(localStorage.getItem(_lkey(uid))||'null');
      if(o&&o.date===_today()&&Array.isArray(o.phrases)&&o.phrases.length===15){
        if(o.phrases.filter(function(p){return !p||p.length<4;}).length<=5) return o.phrases;
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
          if(Array.isArray(p)&&p.length===15&&p.filter(function(t){return !t||t.length<4;}).length<=5){cb(p);return;}
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
    var ld=document.getElementById('homeMsgLoading'), tx=document.getElementById('homeMsgInner');
    if(ld) ld.style.display=on?'inline-flex':'none';
    if(tx) tx.style.display=on?'none':'';
  }
  function _show(idx){
    if(!_phrases.length||idx<0||idx>=_phrases.length) return;
    var el=document.getElementById('homeMsgInner'); if(!el) return;
    var text=_phrases[idx];
    if(!text||text.length<4){
      for(var d=1;d<15;d++){
        var a=_phrases[(idx+d)%15],b=_phrases[(idx-d+15)%15];
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
  function _startAutoRotate(){ _refreshDisplay(); setInterval(function(){ _refreshDisplay(); },60*1000); }

  function _makePrompts(role,partnerName,daysTogether,saison){
    var isBoy=role==='boy', adj=isBoy?'ta copine':'ton copain',
        pNom=partnerName||adj, moi=isBoy?'un garçon':'une fille',
        proSuj=isBoy?'elle':'il';
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
      fetch(GROQ_EDGE,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+(typeof yamGetAccessToken==='function'?yamGetAccessToken():SB_ANON_KEY),'apikey':SB_ANON_KEY},body:JSON.stringify({prompt:prompts[i]})})
      .then(function(r){return r.json();})
      .then(function(d){ var t=(d.text||'').trim().replace(/^[""\"«»\-–—]+|[""\"«»]+$/g,'').trim(); collected.push(t&&t.length>3?t:''); setTimeout(function(){_next(i+1);},280); })
      .catch(function(){collected.push(''); setTimeout(function(){_next(i+1);},350);});
    }
    _next(0);
  }

  function _load(){
    var uid=_userId(), cid=_coupleId(), role=_role();
    if(!uid||!cid||!role){
      _setLoading(false);
      var el=document.getElementById('homeMsgInner'); if(el) el.textContent='Connecte-toi pour découvrir tes messages du jour 💕';
      return;
    }
    var local=_loadLocal(uid);
    if(local){ _phrases=local; _setLoading(false); _startAutoRotate(); return; }
    _loadSB(cid,role,function(sb){
      if(sb){ _phrases=sb; _saveLocal(uid,sb); _setLoading(false); _startAutoRotate(); return; }
      _generate(cid,role,function(phrases){ _phrases=phrases; _setLoading(false); _startAutoRotate(); });
    });
  }

  // Déclencher au chargement et sur setProfile (via yam:session_ready)
  window.addEventListener('load', function(){ setTimeout(_load, 500); });
  document.addEventListener('yam:session_ready', function(){
    if(!_phrases.length) setTimeout(_load, 700);
  });
})();


// ═══════════════════════════════════════════════════════════════════
// Rappels du jour — CRUD + génération IA + sync Supabase
// ═══════════════════════════════════════════════════════════════════
(function(){
  var GROQ  = SB_URL + '/functions/v1/gemini-suggest';
  var CAT   = 'yam_rappels';
  var SLOT  = 'v1';
  var _data = [];
  var _idx  = 0;
  var _rowId= null;
  var _pollTimer=null, _lastHash='';

  function _cid(){ var u=yamGetUser(); return u?u.couple_id:null; }
  function _uid2(){ return Math.random().toString(36).slice(2,9)+Date.now().toString(36); }
  function _hash(arr){ return arr.map(function(r){return r.id+':'+(r.done?'1':'0')+':'+r.text;}).join('|'); }

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
    var cid=_cid(); if(!cid) return;
    _lastHash=_hash(_data);
    if(_rowId){
      fetch(SB_URL+'/rest/v1/photo_descs?id=eq.'+_rowId,{method:'PATCH',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),body:JSON.stringify({description:JSON.stringify(_data)})}).catch(function(){});
    } else {
      fetch(SB_URL+'/rest/v1/photo_descs',{method:'POST',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=representation'}),body:JSON.stringify({couple_id:cid,category:CAT,slot:SLOT,description:JSON.stringify(_data)})})
      .then(function(r){return r.ok?r.json():null;}).then(function(rows){if(rows&&rows[0])_rowId=rows[0].id;}).catch(function(){});
    }
  }

  function _active(){ return _data.filter(function(r){return !r.done;}); }
  function _done(){   return _data.filter(function(r){return  r.done;}); }

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

  function _sheet(){
    var list=document.getElementById('rshList'); if(!list) return;
    list.innerHTML='';
    var sorted=_active().concat(_done());
    if(!sorted.length){
      var d=document.createElement('div'); d.className='rsh-empty'; d.textContent='Aucun rappel — YAM va en proposer 💭'; list.appendChild(d); return;
    }
    sorted.forEach(function(item){
      var row=document.createElement('div'); row.className='rsh-item'+(item.done?' rsh-done':'');
      var chk=document.createElement('div'); chk.className='rsh-check'+(item.done?' on':''); chk.textContent=item.done?'✓':'';
      chk.onclick=function(){ _data.forEach(function(r){if(r.id===item.id)r.done=!r.done;}); _save(); var a=_active(); if(_idx>=a.length)_idx=Math.max(0,a.length-1); _card(); _sheet(); };
      var txt=document.createElement('div'); txt.className='rsh-item-txt'; txt.textContent=item.text; txt.contentEditable='true'; txt.spellcheck=false;
      txt.onblur=function(){ var v=txt.textContent.trim(); if(!v){txt.textContent=item.text;return;} _data.forEach(function(r){if(r.id===item.id)r.text=v;}); _save(); _card(); };
      txt.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();txt.blur();}};
      var del=document.createElement('button'); del.className='rsh-del'; del.innerHTML='&times;'; del.title='Supprimer';
      del.onclick=function(){ _data=_data.filter(function(r){return r.id!==item.id;}); _save(); var a=_active(); if(_idx>=a.length)_idx=Math.max(0,a.length-1); _card(); _sheet(); };
      row.appendChild(chk); row.appendChild(txt); row.appendChild(del); list.appendChild(row);
    });
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
    var newAct=_active(); if(_idx>=newAct.length)_idx=Math.max(0,newAct.length-1);
    _card(); _sheet();
  };

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
    var inp=document.getElementById('rshInput'); if(!inp) return;
    var v=inp.value.trim(); if(!v) return;
    _data.push({id:_uid2(),text:v,done:false});
    _save(); inp.value=''; _card(); _sheet();
  };

  function _todayStr(){ var d=new Date(); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
  function _canGenToday(){ try{ return localStorage.getItem('yam_rgen_'+(_cid()||''))!==_todayStr(); }catch(e){ return true; } }
  function _markGenToday(){ try{ localStorage.setItem('yam_rgen_'+(_cid()||''),_todayStr()); }catch(e){} }

  function _genAI(){
    var cid=_cid(); if(!cid||!_canGenToday()||_data.length>0) return;
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
      fetch(GROQ,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+(typeof yamGetAccessToken==='function'?yamGetAccessToken():SB_ANON_KEY),'apikey':SB_ANON_KEY},body:JSON.stringify({prompt:prompts[i]})})
      .then(function(r){return r.json();}).then(function(d){ var t=(d.text||'').trim().replace(/^[""\"«»\-–—\s]+|[""\"«»\s]+$/g,'').trim(); if(t&&t.length>2&&t.length<60) col.push(t); setTimeout(function(){_nx(i+1);},280); })
      .catch(function(){setTimeout(function(){_nx(i+1);},320);});
    }
    _nx(0);
  }

  function _syncIfChanged(fresh){
    var h=_hash(fresh);
    if(h!==_lastHash){ _data=fresh; _lastHash=h; var act=_active(); if(_idx>=act.length)_idx=Math.max(0,act.length-1); _card(); var sheet=document.getElementById('rappelSheet'); if(sheet&&sheet.classList.contains('open')) _sheet(); }
  }

  function _startPoll(){
    if(_pollTimer) clearInterval(_pollTimer);
    _pollTimer=setInterval(function(){ if(document.hidden||!_cid()) return; _load(_syncIfChanged); },8000);
  }

  function _init(){
    var cid=_cid();
    if(!cid){ _data=[{id:'d1',text:'Faites-vous un bisou 😘',done:false},{id:'d2',text:'Appelez-vous ce soir 📞',done:false},{id:'d3',text:'Partagez une chanson 🎵',done:false}]; _card(); return; }
    _load(function(loaded){ _data=loaded; _lastHash=_hash(_data); if(_data.length===0&&_canGenToday()) _genAI(); else _card(); });
    _startPoll();
  }

  document.addEventListener('visibilitychange', function(){ if(!document.hidden&&_cid()) _load(_syncIfChanged); });
  document.addEventListener('DOMContentLoaded', _init);
  document.addEventListener('yam:session_ready', function(){ setTimeout(_init, 900); });
})();


// ═══════════════════════════════════════════════════════════════════
// Sync humeurs + présence + avatars — home tab
// Expose : window._homeSyncMood, window._homeSyncSpam
// ═══════════════════════════════════════════════════════════════════
(function(){
  function homeSyncMood(){
    var user=typeof yamGetUser==='function'?yamGetUser():null;
    var profile=user?user.role:null;
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
    function setOnline(statusId,dotId,isOnline){ var sEl=document.getElementById(statusId),dEl=document.getElementById(dotId); if(sEl){sEl.textContent=isOnline?'En ligne':'Hors ligne';sEl.className='home-mood-status'+(isOnline?' online':'');} if(dEl)dEl.className='home-mood-online'+(isOnline?' online':''); }
    if(profile==='girl'){setOnline('homeMoodElleStatus','homeMoodElleOnline',selfOnline);setOnline('homeMoodLuiStatus','homeMoodLuiOnline',otherOnline);}
    else{setOnline('homeMoodLuiStatus','homeMoodLuiOnline',selfOnline);setOnline('homeMoodElleStatus','homeMoodElleOnline',otherOnline);}
    function syncAvatar(imgId,role){ var img=document.getElementById(imgId);if(!img)return; var realAv=window._yamRealAvatars&&window._yamRealAvatars[role]; img.src=realAv||('assets/images/profil_'+role+'.png'); }
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
    var navMus=document.getElementById('navMusique'), isPlaying=(navMus&&navMus.classList.contains('music-playing'))||(window._yamCurrentAudio&&!window._yamCurrentAudio.paused);
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
