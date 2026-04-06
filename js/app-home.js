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

  function _buildPrompt(role, partnerName, daysTogether, saison){
    var isBoy       = role === 'boy';
    var pNom        = partnerName || (isBoy ? 'ta copine' : 'ton copain');
    var moi         = isBoy ? 'un garçon' : 'une fille';
    var genreP      = isBoy ? 'une fille' : 'un garçon';
    var proP        = isBoy ? 'elle' : 'il';
    var pSurnom     = isBoy ? 'ta chérie'   : 'ton amoureux';
    var pSurnomAlt  = isBoy ? 'ta copine'   : 'ton copain';
    var pSurnoms    = isBoy
      ? '"ta chérie", "ta copine", "ton bébé", "ta moitié", "ton amoureuse"'
      : '"ton amoureux", "ton copain", "ton bébé", "ta moitié", "ton chéri"';
    var tonDuree    = daysTogether < 30
      ? 'couple très récent, sois doux et encourageant'
      : daysTogether < 365
        ? 'couple de quelques mois, complice et léger'
        : 'couple solide, tu peux faire allusion au temps passé ensemble';

    return (
      'Tu es YAM, mascotte enfantine et complice d\'une app pour couples.\n' +
      'Tu t\'adresses à ' + moi + '. Son/sa partenaire s\'appelle ' + pNom + ' (' + genreP + ').\n' +
      'Ensemble depuis ' + daysTogether + ' jours. Saison : ' + saison + '. ' + tonDuree + '.\n\n' +

      'TON : espiègle, naturel, chaleureux. Comme un enfant qui parle à un ami. Tu tutoies toujours.\n' +
      'Tu peux parler de toi : "je pense que...", "j\'ai une idée...".\n\n' +

      'EXEMPLES DE BONNES PHRASES (grammaire complète, aucun mot coupé) :\n' +
      'OK "T\'as bien dormi cette nuit ? 😴"\n' +
      'OK "' + pNom + ' attend sûrement un message de toi ce matin ! 💬"\n' +
      'OK "Ça te dirait de jouer à Ocho avec ' + pSurnom + ' ce soir ? 🎮"\n' +
      'OK "Je pense que ' + pSurnom + ' aimerait recevoir un petit mot doux 💌"\n' +
      'OK "Je te souhaite une belle journée pleine de soleil ☀️"\n\n' +

      'EXEMPLES INTERDITS :\n' +
      'NON "Je souhaite bonne journée" => phrase incomplète, il manque "te" — écris TOUJOURS les phrases en entier\n' +
      'NON "Bébé t\'as bien dormi ?" => YAM n\'appelle JAMAIS l\'utilisateur par un surnom\n' +
      'NON "' + pNom + ' adore les pique-niques" => ne jamais inventer de faits sur le couple\n' +
      'NON "Appelle ' + pSurnom + ', elle/il pense à toi" => utilise "' + proP + '" pas "elle/il"\n' +
      'NON "Ô ' + saison + ' magnifique..." => jamais pompeux ni poétique\n\n' +

      'SURNOMS AUTORISÉS pour désigner ' + pNom + ' : ' + pSurnoms + '.\n' +
      'Utilise ' + pNom + ' dans max 1 phrase sur 3. Alterne avec les surnoms.\n\n' +

      'MISSION : génère exactement 15 phrases YAM pour la journée, réparties ainsi :\n' +
      '- Phrases 1 à 5 : contexte MATIN\n' +
      '- Phrases 6 à 10 : contexte APRÈS-MIDI\n' +
      '- Phrases 11 à 15 : contexte SOIR\n\n' +

      'Thèmes à couvrir (1 par phrase, dans cet ordre) :\n' +
      '1. Demande si bien dormi, ton espiègle\n' +
      '2. Suggère d\'envoyer un premier message à ' + pNom + '\n' +
      '3. Invite à définir son humeur du jour dans l\'app\n' +
      '4. Glisse que ' + pSurnom + ' pense peut-être à lui/elle ce matin\n' +
      '5. Souhaite une belle journée en lien avec la saison ' + saison + ' (concret : chocolat chaud, soleil...)\n' +
      '6. Demande comment se passe la journée, ton curieux\n' +
      '7. Propose une partie de jeu dans l\'app (Memory, Skyjo ou Ocho)\n' +
      '8. Suggère d\'écrire un petit mot doux à ' + pSurnomAlt + ' dans l\'app\n' +
      '9. Suggère malicieusement d\'envoyer une bêtise à ' + pNom + '\n' +
      '10. Pensée simple sur ' + pSurnom + ' en lien avec la saison ou le quotidien\n' +
      '11. Demande comment s\'est passée la journée, suggère d\'en parler avec ' + pSurnom + '\n' +
      '12. Propose d\'écouter une musique ensemble dans l\'app\n' +
      '13. Suggère d\'appeler ' + pNom + ' ou lui envoyer un vocal\n' +
      '14. Invite à ouvrir la section Souvenirs et en ajouter un\n' +
      '15. Suggère d\'écrire une note du jour dans l\'app avant de dormir\n\n' +

      'FORMAT DE RÉPONSE - CRITIQUE :\n' +
      'Réponds UNIQUEMENT avec un tableau JSON valide de 15 strings, sans aucun texte avant ou après.\n' +
      'Chaque phrase : entre 7 et 16 mots. Phrases grammaticalement COMPLÈTES — ne coupe jamais un mot fonctionnel (te, lui, me, se, y, en...).\n' +
      '1 emoji OBLIGATOIRE par phrase (choisi selon le contexte).\n' +
      'YAM doit parler de lui ("je pense que...", "j\'ai une idée...", "on y va tous les 3...") dans AU MOINS 5 phrases sur 15.\n' +
      'YAM ne donne JAMAIS de surnom à l\'utilisateur (pas de "mon curieux", "mon ami", "mon grand", "ma belle"...). Il s\'adresse sans surnom.\n' +
      'Les phrases doivent sonner comme une invitation spontanée, pas comme des ordres télégraphiques.\n' +
      'Pas de guillemets dans le texte des phrases.\n' +
      'Format exact attendu :\n' +
      '["phrase1","phrase2","phrase3","phrase4","phrase5","phrase6","phrase7","phrase8","phrase9","phrase10","phrase11","phrase12","phrase13","phrase14","phrase15"]'
    );
  }

  function _generate(cid, role, onDone){
    if(_generating) return;
    _generating = true; _setLoading(true);
    var pName  = _partner();
    var days   = window.startDate ? Math.floor((Date.now() - new Date(window.startDate)) / (1000*60*60*24)) : 0;
    var saison = ['hiver','hiver','printemps','printemps','printemps','ete','ete','ete','automne','automne','automne','hiver'][new Date().getMonth()];
    var prompt = _buildPrompt(role, pName, days, saison);

    var headers = {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + (typeof yamGetAccessToken === 'function' ? yamGetAccessToken() : SB_ANON_KEY),
      'apikey':        SB_ANON_KEY
    };

    fetch(GROQ_EDGE, {method:'POST', headers:headers, body:JSON.stringify({prompt:prompt})})
    .then(function(r){ return r.json(); })
    .then(function(d){
      var raw = (d.text || '').trim();
      var match = raw.match(/\[[\s\S]*\]/);
      var phrases = [];
      if(match){ try{ phrases = JSON.parse(match[0]); }catch(e){} }
      function _fixText(s){
        // Récupération des apostrophes mangées par certains parseurs JSON
        return s
          .replace(/\bdis ta /g,      'dis à ta ')
          .replace(/\bdis ton /g,     'dis à ton ')
          .replace(/\bTas\b/g,        'T\'as')
          .replace(/\bJai\b/g,        'J\'ai')
          .replace(/\blapp\b/gi,      'l\'app')
          .replace(/\bsest\b/gi,      's\'est')
          .replace(/\bcest\b/gi,      'c\'est')
          .replace(/\bdans lapp\b/gi, 'dans l\'app')
          .replace(/\benvoie lui\b/gi,'envoie-lui')
          .replace(/\bappelle le\b/gi,'appelle-le')
          .replace(/\bappelle la\b/gi,'appelle-la')
          .replace(/\bparle en\b/gi,  'parles-en')
          .replace(/\braconte a\b/gi, 'raconte à')
          .replace(/ a ([A-Z])/g,     ' à $1');
      }
      var collected = [];
      for(var i=0; i<15; i++){
        var t = (phrases[i] || '').toString().trim().replace(/^["'`]+|["'`]+$/g,'').trim();
        t = _fixText(t);
        collected.push(t && t.length > 3 ? t : '');
      }
      _generating = false;
      _saveSB(cid, role, collected);
      var uid = _userId(); if(uid) _saveLocal(uid, collected);
      onDone(collected);
    })
    .catch(function(){
      _generating = false;
      var fb = [
        'T\'as bien dormi ? 😊',
        'Envoie un message a ' + (pName||'ton/ta partenaire') + ' ce matin !',
        'Definis ton humeur du jour dans l\'app 😌',
        'Je pense que ' + (pName||'ton/ta partenaire') + ' pense a toi ce matin.',
        'Belle journee en perspective ! 🌞',
        'Comment se passe ta journee ? 😊',
        'Ca te dirait une partie de jeu avec ' + (pName||'ton/ta partenaire') + ' ? 🎲',
        'Un petit mot doux dans l\'app, ca fait du bien 😌',
        'J\'ai une idee... envoie une betise a ' + (pName||'ton/ta partenaire') + ' 😈',
        'Je pense a toi et a ' + (pName||'ton/ta partenaire') + ' cet apres-midi.',
        'Comment s\'est passee ta journee ? 🌃',
        'On ecoute une musique tous les 3 ce soir ? 🎶',
        'Appelle ' + (pName||'ton/ta partenaire') + ' ou envoie-lui un vocal ! 📞',
        'Ouvre les Souvenirs et ajoute une photo du jour 📸',
        'Ecris une petite note avant de dormir 😴'
      ];
      _saveSB(cid, role, fb);
      var uid2 = _userId(); if(uid2) _saveLocal(uid2, fb);
      onDone(fb);
    });
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

  // Remet à zéro les rappels cochés uniquement si on est sur un NOUVEAU jour
  // (le flag yam_rgen_ a été posé un jour DIFFÉRENT d'aujourd'hui)
  // → évite de vider des rappels cochés le jour même
  function _resetDoneIfNewDay(){
    if(!_data.length) return;
    var allDone = _active().length === 0;
    if(!allDone) return; // il reste des actifs, rien à faire
    var lastGen = null;
    try{ lastGen = localStorage.getItem('yam_rgen_'+(_cid()||'')); }catch(e){}
    // On vide seulement si une génération a eu lieu un AUTRE jour que aujourd'hui
    if(lastGen && lastGen !== _todayStr()){
      _data = [];
      _save();
    }
    // Même jour tout coché → on laisse _data intact, _card() affichera "Tous vos rappels sont faits 🎉"
  }

  function _genAI(){
    // Regénérer si : aucun rappel actif disponible ET pas encore généré aujourd'hui
    var cid=_cid(); if(!cid) return;
    if(_active().length>0) return;   // il reste des rappels à faire
    if(!_canGenToday()) return;       // déjà généré aujourd'hui
    var loader=document.getElementById('rshLoader'); if(loader) loader.style.display='flex';
    var _days=window.startDate?Math.floor((Date.now()-new Date(window.startDate))/(1000*60*60*24)):0;
    var _saison=['hiver','hiver','printemps','printemps','printemps','ete','ete','ete','automne','automne','automne','hiver'][new Date().getMonth()];
    // Themes rotatifs selon le jour de la semaine — 7 combinaisons differentes
    var _dow=new Date().getDay();
    var _themes=[
      ['geste tendre (bisou, calin, se prendre la main...)',   'se parler ou s\'envoyer un vocal ce soir',          'activite ensemble (musique, jeu, film...)'],
      ['petit mot doux ou message surprise',                   'appel video ou vocal',                              'sortie ou balade en lien avec la saison '+_saison],
      ['moment calme ensemble (the, cafe, canape...)',         'partager une chanson dans l\'app',                  'jouer a un jeu dans l\'app'],
      ['geste affectueux inattendu',                           's\'envoyer une photo rigolote ou une betise',       'cuisiner ou manger quelque chose ensemble'],
      ['dire quelque chose de gentil a l\'autre',              'vocal ou message audio surprise',                   'activite ou decouverte ensemble'],
      ['bisou ou calin du matin ou du soir',                   'raconter sa journee a l\'autre',                    'regarder quelque chose ensemble (serie, video...)'],
      ['geste tendre spontane',                                'ecrire un petit mot dans l\'app',                   'activite en lien avec la saison '+_saison+' a faire ensemble'],
    ];
    var _t=_themes[_dow];

    var _prompt=
      'Tu es YAM, mascotte enfantine et complice d\'une app pour couples.\n'+
      'On est en '+_saison+'. Le couple est ensemble depuis '+_days+' jours.\n\n'+

      'MISSION : genere exactement 3 rappels du jour pour ce couple.\n'+
      'Chaque rappel est une petite invitation concrete et sympa a faire ensemble.\n\n'+

      'THEMES (1 par rappel, dans cet ordre) :\n'+
      '1. '+_t[0]+'\n'+
      '2. '+_t[1]+'\n'+
      '3. '+_t[2]+'\n\n'+

      'REGLES :\n'+
      '- S\'adresse au couple ensemble (pas de prenom, pas de "vous deux")\n'+
      '- Ton naturel, chaleureux, spontane. Jamais scolaire ni pompeux.\n'+
      '- Peut faire reference a la saison ('+_saison+') si c\'est naturel\n'+
      '- Entre 4 et 10 mots. 1 emoji OBLIGATOIRE. Pas de guillemets.\n'+
      '- Utilise les accents francais correctement.\n'+
      '- Les verbes sont a l\'imperatif pluriel : "Faites", "Dites", "Ecrivez", "Appelez", "Partagez", "Regardez", "Envoyez"...\n\n'+

      'EXEMPLES CORRECTS :\n'+
      'OK "Faites-vous un bisou ce soir 😘"\n'+
      'OK "Partagez une chanson dans l\'app 🎵"\n'+
      'OK "Un calin impromptu ca fait du bien 🤗"\n'+
      'OK "Racontez-vous votre journee ce soir 💬"\n'+
      'OK "Une balade au soleil tous les deux ? 🌞"\n\n'+

      'EXEMPLES INTERDITS :\n'+
      'NON "Vous devriez vous faire un bisou" => trop scolaire\n'+
      'NON "Il fait beau" => pas un rappel, pas d\'action\n\n'+

      'FORMAT : reponds UNIQUEMENT avec un tableau JSON de 3 strings, rien avant ni apres.\n'+
      '["rappel1","rappel2","rappel3"]';

    fetch(GROQ,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+(typeof yamGetAccessToken==='function'?yamGetAccessToken():SB_ANON_KEY),'apikey':SB_ANON_KEY},body:JSON.stringify({prompt:_prompt})})
    .then(function(r){return r.json();})
    .then(function(d){
      if(loader) loader.style.display='none';
      var raw=(d.text||'').trim();
      var match=raw.match(/\[[\s\S]*\]/);
      var phrases=[];
      if(match){ try{ phrases=JSON.parse(match[0]); }catch(e){} }
      var col=[];
      for(var i=0;i<3;i++){
        var t=(phrases[i]||'').toString().trim().replace(/^["'`]+|["'`]+$/g,'').trim();
        if(t&&t.length>2&&t.length<80) col.push(t);
      }
      if(!col.length) col=['Faites-vous un bisou 😘','Appelez-vous ce soir 📞','Partagez une chanson 🎵'];
      _markGenToday();
      col.forEach(function(t){ _data.push({id:_uid2(),text:t,done:false}); });
      _save(); _card(); _sheet();
    })
    .catch(function(){
      if(loader) loader.style.display='none';
      var fb=['Faites-vous un bisou 😘','Appelez-vous ce soir 📞','Partagez une chanson 🎵'];
      _markGenToday();
      fb.forEach(function(t){ _data.push({id:_uid2(),text:t,done:false}); });
      _save(); _card(); _sheet();
    });
  }


  function _syncIfChanged(fresh){
    var h=_hash(fresh);
    if(h!==_lastHash){ _data=fresh; _lastHash=h; var act=_active(); if(_idx>=act.length)_idx=Math.max(0,act.length-1); _card(); var sheet=document.getElementById('rappelSheet'); if(sheet&&sheet.classList.contains('open')) _sheet(); }
  }

  // Sync partenaire via Realtime photoDescs — toujours actif, indépendant du poll
  document.addEventListener('yam:rappels_changed', function(){ _load(_syncIfChanged); });

  function _pdRTActive(){
    // Vérifie dynamiquement si le channel photoDescs Realtime est joined
    return !!(window._yamRT && window._yamRT.getChannels &&
              window._yamRT.getChannels().find(function(c){
                return c.topic.includes('photoDescs-') && c.state === 'joined';
              }));
  }

  function _startPoll(){
    if(_pollTimer) clearInterval(_pollTimer);
    // Poll 30s — skippé si le Realtime photoDescs est actif (fallback uniquement)
    _pollTimer=setInterval(function(){
      if(document.hidden||!_cid()) return;
      if(_pdRTActive()) return; // Realtime ok → pas de poll
      _load(_syncIfChanged);
    },30000);
  }

  function _init(){
    var cid=_cid();
    if(!cid){ _data=[{id:'d1',text:'Faites-vous un bisou 😘',done:false},{id:'d2',text:'Appelez-vous ce soir 📞',done:false},{id:'d3',text:'Partagez une chanson 🎵',done:false}]; _card(); return; }
    _load(function(loaded){
      _data=loaded; _lastHash=_hash(_data);
      _resetDoneIfNewDay(); // vide les cochés si nouveau jour → _data peut devenir []
      if(_active().length===0) _genAI(); else _card();
    });
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
