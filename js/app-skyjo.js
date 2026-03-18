// app-skyjo.js — Skyjo multijoueur temps réel
// Version 4.0 — Février 2026
// Dépendances (chargées avant) : app-core.js, app-account.js, app-multiplayer.js
// Globals utilisés : SB_URL, sb2Headers(), getProfile(), v2GetDisplayName(),
//                    _yamSlide(), resetZoom(), showToast(), haptic(),
//                    YAMMultiplayer (app-multiplayer.js)


/* ══════════════════════════════════════════════════════
   SKYJO — JEU DE CARTES (logique + rendu + animations)
   Le moteur réseau (présence, lobby, poll, saveState…)
   est délégué à app-multiplayer.js via YAMMultiplayer.init()
══════════════════════════════════════════════════════ */
(function(){

  var SKYJO_TABLE    = 'skyjo_games';
  var SKYJO_PRESENCE = 'skyjo_presence';

  // ─── Rendu SVG des cartes (nouveau visuel) ────────────
  var _SJ_CARD_COLORS = {
    '-2': {bg:['#4a6ae8','#2240b8','#14288a'], txt:'#0e1c70'},
    '-1': {bg:['#4a6ae8','#2240b8','#14288a'], txt:'#0e1c70'},
    '0':  {bg:['#38b2f0','#1a8acc','#0e6898'], txt:'#052844'},
    '1':  {bg:['#28bc60','#189848','#0e7030'], txt:'#053818'},
    '2':  {bg:['#28bc60','#189848','#0e7030'], txt:'#053818'},
    '3':  {bg:['#28bc60','#189848','#0e7030'], txt:'#053818'},
    '4':  {bg:['#28bc60','#189848','#0e7030'], txt:'#053818'},
    '5':  {bg:['#f09820','#c87800','#985800'], txt:'#4a2800'},
    '6':  {bg:['#f09820','#c87800','#985800'], txt:'#4a2800'},
    '7':  {bg:['#f09820','#c87800','#985800'], txt:'#4a2800'},
    '8':  {bg:['#f09820','#c87800','#985800'], txt:'#4a2800'},
    '9':  {bg:['#f04040','#c82020','#981010'], txt:'#780808'},
    '10': {bg:['#f04040','#c82020','#981010'], txt:'#780808'},
    '11': {bg:['#f04040','#c82020','#981010'], txt:'#780808'},
    '12': {bg:['#f04040','#c82020','#981010'], txt:'#780808'}
  };
  var _SJ_POLYS = 'points="3,3 33,3 43,12 33,35 16,14 3,23"|points="33,3 67,3 80,12 67,16 43,12"|points="67,3 80,3 80,25 67,16"|points="3,23 16,14 33,35 25,60 12,47 3,47"|points="16,14 43,12 60,30 50,55 33,35"|points="43,12 67,16 77,45 60,30"|points="3,47 12,47 25,60 17,83 3,73"|points="12,47 33,35 50,55 45,70 27,47"|points="33,35 60,30 73,67 63,53 45,70 27,47"|points="3,73 17,83 33,100 19,106 3,100"|points="17,83 27,47 45,70 55,85 33,100"|points="45,70 63,53 73,67 67,105 55,85"|points="3,100 19,106 33,100 23,122 3,122"|points="33,100 55,85 67,105 39,113 23,122"|points="67,105 80,98 80,122 43,122 39,113"'.split('|');
  var _sjCardUID = 0;

  function _sjPolyStr() {
    return _SJ_POLYS.map(function(p,i){
      return '<polygon '+p+' fill="rgba('+(i%2===0?'255,255,255':'0,0,0')+',0.04)" stroke="rgba(255,255,255,0.09)" stroke-width="0.5"/>';
    }).join('');
  }

  function sjCardSVG(val) {
    _sjCardUID++;
    var id = 'sj'+_sjCardUID;
    var k = String(val);
    var c = _SJ_CARD_COLORS[k] || _SJ_CARD_COLORS['0'];
    var fs = (val === -2 || val === -1 || val >= 10) ? 22 : 26;
    var fsm = (val === -2 || val === -1 || val >= 10) ? 10 : 12;
    return '<svg viewBox="0 0 80 122" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">'
      +'<defs>'
      +'<linearGradient id="sbg'+id+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="'+c.bg[0]+'"/><stop offset="55%" stop-color="'+c.bg[1]+'"/><stop offset="100%" stop-color="'+c.bg[2]+'"/></linearGradient>'
      +'<radialGradient id="sbub'+id+'" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fff" stop-opacity="0.82"/><stop offset="52%" stop-color="#fff" stop-opacity="0.78"/><stop offset="74%" stop-color="#fff" stop-opacity="0.42"/><stop offset="90%" stop-color="#fff" stop-opacity="0.1"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>'
      +'<radialGradient id="sbs'+id+'" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fff" stop-opacity="0.95"/><stop offset="62%" stop-color="#fff" stop-opacity="0.72"/><stop offset="88%" stop-color="#fff" stop-opacity="0.2"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>'
      +'<clipPath id="scl'+id+'"><rect x="3" y="3" width="74" height="116" rx="8"/></clipPath>'
      +'</defs>'
      +'<rect width="80" height="122" rx="10" fill="#fff"/>'
      +'<rect x="3" y="3" width="74" height="116" rx="8" fill="url(#sbg'+id+')"/>'
      +_sjPolyStr()
      +'<g clip-path="url(#scl'+id+')">'
      +'<ellipse cx="40" cy="62" rx="33" ry="33" fill="url(#sbub'+id+')"/>'
      +'<text x="40" y="63" text-anchor="middle" dominant-baseline="central" font-family="Arial Black,Arial" font-weight="900" font-size="'+fs+'" fill="'+c.txt+'" paint-order="stroke" stroke="rgba(255,255,255,0.5)" stroke-width="2.5" letter-spacing="-1">'+val+'</text>'
      +'<ellipse cx="17" cy="17" rx="12" ry="10" fill="url(#sbs'+id+')"/>'
      +'<text x="17" y="17" text-anchor="middle" dominant-baseline="central" font-family="Arial Black,Arial" font-weight="900" font-size="'+fsm+'" fill="'+c.txt+'">'+val+'</text>'
      +'<ellipse cx="63" cy="105" rx="12" ry="10" fill="url(#sbs'+id+')"/>'
      +'<text x="63" y="105" text-anchor="middle" dominant-baseline="central" font-family="Arial Black,Arial" font-weight="900" font-size="'+fsm+'" fill="'+c.txt+'" transform="rotate(180 63 105)">'+val+'</text>'
      +'</g>'
      +'</svg>';
  }

  function sjCardBackSVG() {
    _sjCardUID++;
    var id = 'sj'+_sjCardUID;
    return '<svg viewBox="0 0 80 122" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">'
      +'<defs><linearGradient id="sbbk'+id+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1a2050"/><stop offset="50%" stop-color="#0e1438"/><stop offset="100%" stop-color="#1a1040"/></linearGradient></defs>'
      +'<rect width="80" height="122" rx="10" fill="#fff"/>'
      +'<rect x="3" y="3" width="74" height="116" rx="8" fill="url(#sbbk'+id+')"/>'
      +_sjPolyStr()
      +'<rect x="9" y="9" width="62" height="104" rx="5" fill="none" stroke="rgba(255,255,255,0.13)" stroke-width="1"/>'
      +'<text x="40" y="108" text-anchor="middle" dominant-baseline="central" font-family="Arial Black,Arial" font-weight="900" font-size="11" fill="rgba(255,255,255,0.55)" letter-spacing="3">YAM</text>'
      +'</svg>';
  }
  // ─────────────────────────────────────────────────────

  // ─── Moteur multijoueur ───────────────────────────────
  var _mp = null;  // instance YAMMultiplayer — initialisée dans _openSkyjoWithProfile

  // ─── État local (jeu uniquement) ─────────────────────
  var _gameState     = null;
  var _phase         = null;
  var _me            = null;
  var _other         = null;

  var _sjAnimPlaying     = false;
  var _sjPendingRenderRow= null;
  var _waitingNextRound  = false;
  var _roundEndShown     = false;

  // ─── Deck ─────────────────────────────────────────────
  function shuffle(a){
    a=a.slice();
    for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}
    return a;
  }
  function buildDeck(){
    var d=[];
    for(var i=0;i<5;i++) d.push(-2);
    for(var i=0;i<10;i++) d.push(-1);
    for(var i=0;i<15;i++) d.push(0);
    for(var v=1;v<=12;v++) for(var i=0;i<10;i++) d.push(v);
    return shuffle(d);
  }
  function dealHand(deck){var h=[];for(var i=0;i<12;i++)h.push({value:deck.pop(),revealed:false});return h;}
  function calcScore(cards){return cards.reduce(function(s,c){return s+(c.removed||c.value===null?0:c.value);},0);}
  function deepCopy(o){return JSON.parse(JSON.stringify(o));}

  // ─── Affichage écrans ──────────────────────────────────
  function showScreen(id){
    ['skyjoWaitScreen','skyjoGameArea','skyjoRoundEnd','skyjoGameEnd'].forEach(function(sid){
      var el=document.getElementById(sid);
      if(!el) return;
      if(sid==='skyjoGameArea'){ el.classList.remove('sja-visible'); el.style.display=''; }
      else el.style.display='none';
    });
    var el=document.getElementById(id);
    if(!el) return;
    if(id==='skyjoGameArea'){
      el.classList.add('sja-visible');
      requestAnimationFrame(function(){
        var vw=window.innerWidth, vh=window.innerHeight;
        var headerEl=document.querySelector('#skyjoView .game-view-header');
        var bannerEl=document.getElementById('skyjoTurnBanner');
        var headerH=headerEl?headerEl.offsetHeight:38;
        var bannerH=bannerEl?bannerEl.offsetHeight:28;
        var midH=64, phaseH=0, infoH=30, gapH=16, safeB=4;
        var availH=vh-headerH-bannerH-midH-phaseH-(infoH*2)-gapH-safeB;
        var cardH=Math.floor((availH-5*4)/6);
        var maxByW=Math.floor((vw-16-3*4)/4);
        var cardW=Math.floor(cardH/1.42);
        if(cardW>maxByW){cardW=maxByW;cardH=Math.floor(cardW*1.42);}
        cardH=Math.min(58,Math.max(34,cardH));
        cardW=Math.min(41,Math.max(24,cardW));
        var fs=Math.max(10,Math.min(16,Math.floor(cardW*0.4)));
        document.documentElement.style.setProperty('--sj-cw',cardW+'px');
        document.documentElement.style.setProperty('--sj-ch',cardH+'px');
        document.documentElement.style.setProperty('--sj-fs',fs+'px');
      });
    } else {
      el.style.display='flex';
    }
  }

  // ─── Reset état local ─────────────────────────────────
  function resetLocalState(){
    _gameState=null;
    _phase=null;
    _waitingNextRound=false;
    _roundEndShown=false;
    _sjAnimPlaying=false;
    _sjPendingRenderRow=null;
    window._sjLastSeenLiveTs=0;
    // Reset réactions
    _sjReactCooldown=false;
    _sjLastReactTs=0;
    if(_sjMyBubbleTimer){clearTimeout(_sjMyBubbleTimer);_sjMyBubbleTimer=null;}
    if(_sjOppBubbleTimer){clearTimeout(_sjOppBubbleTimer);_sjOppBubbleTimer=null;}
    var bm=document.getElementById('sjMyReactionBubble');
    var bo=document.getElementById('sjOppReactionBubble');
    if(bm)bm.classList.remove('visible','hiding');
    if(bo)bo.classList.remove('visible','hiding');
    var picker=document.getElementById('sjReactPicker');
    if(picker)picker.classList.remove('open');
    var btn=document.getElementById('sjReactBtn');
    if(btn)btn.classList.remove('sj-react-cooldown');
    // Reset timer
    _sjStopTimer();
    _sjTimerTurnKey=null;
    _sjTimerFired=false;
    _sjAutoWaitHeld=false;
    _sjAutoWaitFlip=false;
    // ✅ FIX v3.7 : reprend presencePoll de app-core quand on quitte la partie
    if(typeof window._corePresenceResume==='function') window._corePresenceResume();
    // ✅ OPT v3.8 : reprend le compteur d'amour
    if(typeof window._counterResume==='function') window._counterResume();
  }

  // ─── Lock + Ouverture ─────────────────────────────────
  window.openSkyjoLock = function(){
    var profile=(typeof getProfile==='function'?getProfile():null)||(typeof yamGetUser==='function'&&yamGetUser()?yamGetUser().role:null);
    resetZoom();
    particleActive=false; hideDance(); window.scrollTo(0,0);
    if(profile){
      _openSkyjoWithProfile(profile);
    } else {
      document.getElementById('skyjoAuthModal').style.display='flex';
    }
  };

  window.skyjoAuthSelect = function(profile){
    document.getElementById('skyjoAuthModal').style.display='none';
    if(typeof v2LoadSession==='function' && v2LoadSession()){
      if(window._profileSave)  window._profileSave(profile);
      if(window._profileApply) window._profileApply(profile);
      _openSkyjoWithProfile(profile);
    } else {
      if(window.v2ShowLogin) window.v2ShowLogin();
    }
  };

  window.skyjoAuthClose = function(){
    document.getElementById('skyjoAuthModal').style.display='none';
  };

  function _openSkyjoWithProfile(profile){
    _me    = profile;
    _other = _me==='girl' ? 'boy' : 'girl';

    _yamSlide(document.getElementById('skyjoView'), document.getElementById('gamesView'), 'forward');
    document.querySelector('.bottom-nav').style.display='none';

    // Créer / re-créer l'instance moteur
    _mp = YAMMultiplayer.init({
      gameTable:    SKYJO_TABLE,
      presenceTable: SKYJO_PRESENCE,
      waitModalId:      'skyjoWaitModal',
      countdownModalId: 'skyjoCountdownModal',
      deleteOnLeave: true,

      // État initial d'une nouvelle partie Skyjo
      buildInitialState: function(){
        var deck=buildDeck();
        var gc=dealHand(deck), bc=dealHand(deck);
        var top=deck.pop();
        return {
          deck:deck, discard:[top],
          girl_cards:gc, boy_cards:bc,
          phase:'init1', turn:null,
          round:1, scores:{girl:0,boy:0},
          held_card:null, must_flip:null, last_player:null, round_closer:null,
          ts_turn: Date.now()
        };
      },

      // Salle d'attente
      onWaiting: function(me, other){
        var myName=(typeof v2GetDisplayName==='function'?v2GetDisplayName(me):(me==='girl'?'Elle':'Lui'));
        var otherName=(typeof v2GetDisplayName==='function'?v2GetDisplayName(other):(me==='girl'?'Lui':'Elle'));
        showScreen('skyjoWaitScreen');
        document.getElementById('skyjoWaitMsg').innerHTML=
          'Connecté en tant que <strong>'+myName+'</strong>.<br>En attente que <strong>'+otherName+'</strong> rejoigne…';
      },

      // Tick lobby — mise à jour des points de présence
      onLobbyTick: function(girlOk, boyOk){
        var dg=document.getElementById('skyjoPresenceGirl');
        var db=document.getElementById('skyjoPresenceBoy');
        if(dg) dg.className='skyjo-presence-dot'+(girlOk?' online':'');
        if(db) db.className='skyjo-presence-dot'+(boyOk?' online':'');
      },

      // Partie trouvée / lancée
      onMatchFound: function(gameRow){
        resetLocalState();
        // ✅ FIX v3.7 : suspend presencePoll de app-core (doublon pendant Skyjo)
        if(typeof window._corePresenceSuspend==='function') window._corePresenceSuspend();
        // ✅ OPT v3.8 : suspend le compteur d'amour (hors écran pendant Skyjo)
        if(typeof window._counterSuspend==='function') window._counterSuspend();
        showScreen('skyjoGameArea');
        // Injecter le SVG dos de carte sur la pioche au démarrage
        var _dk=document.getElementById('skyjoDeckCard');
        if(_dk&&!_dk.querySelector('svg')) _dk.innerHTML=sjCardBackSVG();
        var btn=document.getElementById('skyjoAbandonBtn');
        if(btn) btn.style.display='block';
        renderState(gameRow);
      },

      // Mise à jour d'état (poll ou retour de saveState)
      onStateUpdate: function(gameRow){
        // Si on attendait la manche suivante et phase=init1 → reprendre
        if(_waitingNextRound && gameRow.state && gameRow.state.phase==='init1'){
          // ✅ FIX freeze: reset complet de l'état d'animation côté adversaire
          _sjAnimPlaying=false;
          _sjPendingRenderRow=null;
          _waitingNextRound=false;
          _roundEndShown=false;
          document.getElementById('skyjoRoundEnd').style.display='none';
        }
        renderState(gameRow);
      },

      // Présence adversaire → dot en jeu
      onPresenceUpdate: function(isOnline){
        var dot=document.getElementById('skyjoOppPresenceDot');
        if(dot){
          dot.style.background  = isOnline ? '#22c55e' : '#555';
          dot.style.boxShadow   = isOnline ? '0 0 5px rgba(34,197,94,0.7)' : 'none';
          dot.title             = isOnline ? 'En ligne' : 'Hors ligne';
        }
      },

      // Adversaire a abandonné
      onAbandon: function(){
        resetLocalState();
        _mp.showAlert('🏳️', 'Partie abandonnée', function(){ _mp.enterLobby(); });
      },

      // Les deux absents 40s
      onBothAbsent: function(){
        resetLocalState();
        _mp.showAlert('⏱️', 'Partie expirée — les deux joueurs étaient absents', function(){
          _mp.enterLobby();
        });
      },

      // Retour arrière (abandon ou fermeture)
      onLeave: function(){
        _yamSlide(document.getElementById('gamesView'), document.getElementById('skyjoView'), 'backward');
        document.querySelector('.bottom-nav').style.display='';
      }
    });

    _mp.enter(profile);
  }

  // ─── Quitter la salle d'attente ───────────────────────
  window.skyjoLeaveWait = function(){
    if(_mp) _mp.leave();
    resetLocalState();
    _yamSlide(document.getElementById('gamesView'), document.getElementById('skyjoView'), 'backward');
    document.querySelector('.bottom-nav').style.display='';
  };

  // ─── Fermeture (bouton ✕ en jeu) ─────────────────────
  window.closeSkyjoGame = function(){
    if(_mp) _mp.leave();
    resetLocalState();
    _yamSlide(document.getElementById('gamesView'), document.getElementById('skyjoView'), 'backward');
    document.querySelector('.bottom-nav').style.display='';
  };

  // ─── Abandon en cours de partie ───────────────────────
  window.skyjoAbandon = function(){
    if(!_mp) return;
    _mp.abandon(function(){
      resetLocalState();
      var btn=document.getElementById('skyjoAbandonBtn');
      if(btn) btn.style.display='none';
      _yamSlide(document.getElementById('gamesView'), document.getElementById('skyjoView'), 'backward');
      document.querySelector('.bottom-nav').style.display='';
    });
  };

  // ─── Rendu ────────────────────────────────────────────
  function _sjAnimDone(){
    _sjAnimPlaying=false;
    if(_sjPendingRenderRow){
      var row=_sjPendingRenderRow;
      _sjPendingRenderRow=null;
      _doRenderState(row);
    }
  }

  function renderState(gameRow){
    if(_sjAnimPlaying){ _sjPendingRenderRow=gameRow; return; }
    _doRenderState(gameRow);
  }

  function _doRenderState(gameRow){
    var state=gameRow.state;
    if(!state) return;
    var prevState=_gameState;
    _gameState=state;
    _phase=state.phase;
    _sjCheckIncomingReaction(state);

    // Timer auto-jeu
    var isMyTurn = state.turn === _me;
    _sjHandleTimer(state, isMyTurn);

    // Étape 2 auto-play : si on vient d'acquérir held_card après une pioche auto
    if(_sjAutoWaitHeld && state.held_card && state.held_card.holder === _me){
      _sjAutoStep2(state);
    }
    // Étape 3 auto-play : si on attend le must_flip après un discard auto
    if(_sjAutoWaitFlip && state.must_flip === _me && !state.held_card){
      _sjAutoFlip(state);
    }

    var myCards  =_me==='girl'?state.girl_cards:state.boy_cards;
    var oppCards =_me==='girl'?state.boy_cards:state.girl_cards;
    var myName   =(typeof v2GetDisplayName==='function'?v2GetDisplayName(_me):(_me==='girl'?'Elle':'Lui'));
    var oppName  =(typeof v2GetDisplayName==='function'?v2GetDisplayName(_me==='girl'?'boy':'girl'):(_me==='girl'?'Lui':'Elle'));
    var isMyTurn =state.turn===_me;
    var iHoldCard=state.held_card&&state.held_card.holder===_me;

    var prevTurn=prevState?prevState.turn:null;
    var turnChanged=prevTurn!==state.turn;


    if(turnChanged&&isMyTurn){
      var _ohw=document.getElementById('skyjoOppHeldWrap');
      if(_ohw) _ohw.classList.remove('sj-held-visible');
    }

    var prevHeld=prevState?(prevState.held_card&&prevState.held_card.holder===_me):false;
    var newHeld=iHoldCard&&!prevHeld;

    var prevDiscard=prevState&&prevState.discard&&prevState.discard.length>0?prevState.discard[prevState.discard.length-1]:null;
    var newDiscardTop=state.discard&&state.discard.length>0?state.discard[state.discard.length-1]:null;
    var discardChanged=prevDiscard!==newDiscardTop;

    var myScore =state.scores[_me];
    var oppScore=state.scores[_me==='girl'?'boy':'girl'];
    document.getElementById('skyjoScoreBoy').textContent=myScore;
    document.getElementById('skyjoScoreGirl').textContent=oppScore;
    document.getElementById('skyjoRound').textContent=state.round||1;

    var lrBadge=document.getElementById('skyjoLastRoundBadge');
    if(lrBadge&&state.round_scores&&(state.round||1)>1){
      lrBadge.textContent='Préc. 👧'+state.round_scores.girl+' | 👦'+state.round_scores.boy;
      lrBadge.style.display='block';
    } else if(lrBadge){ lrBadge.style.display='none'; }

    var myAvEl=document.getElementById('skyjoAvatarMe');
    var oppAvEl=document.getElementById('skyjoAvatarOpp');
    var myLbEl=document.getElementById('skyjoMyLabel');
    var oppLbEl=document.getElementById('skyjoOpponentLabel');
    // Mettre à jour les photos de profil sans écraser le <img>
    var myAvImg=myAvEl?myAvEl.querySelector('.yam-av-img'):null;
    var oppAvImg=oppAvEl?oppAvEl.querySelector('.yam-av-img'):null;
    if(myAvImg)  myAvImg.src ='assets/images/profil_'+_me+'.png';
    if(oppAvImg) oppAvImg.src='assets/images/profil_'+_other+'.png';
    if(myLbEl)  myLbEl.textContent =myName;
    if(oppLbEl) oppLbEl.textContent=oppName;
    var oppHeldLbl=document.getElementById('skyjoOppHeldLabel');
    if(oppHeldLbl) oppHeldLbl.textContent='En main – '+oppName;

    var myAvEl2=document.getElementById('skyjoAvatarMe');
    var oppAvEl2=document.getElementById('skyjoAvatarOpp');
    var phase2=state.phase;
    var myTurnActive =isMyTurn&&(phase2==='play'||phase2==='init1');
    var oppTurnActive=!isMyTurn&&phase2==='play';
    if(myAvEl2){if(myTurnActive)myAvEl2.classList.add('active-turn');else myAvEl2.classList.remove('active-turn');}
    if(oppAvEl2){if(oppTurnActive)oppAvEl2.classList.add('active-turn');else oppAvEl2.classList.remove('active-turn');}

    var zoneMe =document.querySelector('.skyjo-player-zone.zone-me');
    var zoneOpp=document.querySelector('.skyjo-player-zone.zone-opp');
    if(zoneMe){if(myTurnActive)zoneMe.classList.add('active-zone');else zoneMe.classList.remove('active-zone');}
    if(zoneOpp){if(oppTurnActive)zoneOpp.classList.add('active-zone');else zoneOpp.classList.remove('active-zone');}

    var badgeSlot=document.getElementById('skyjoTurnBadgeSlot');
    if(badgeSlot){
      badgeSlot.innerHTML='';
      var _avSrc=typeof window.yamAvatarSrc==='function';
      if(myTurnActive){
        var b=document.createElement('div');b.className='sj-your-turn-badge';
        var _mySrc=_avSrc?window.yamAvatarSrc(_me):'assets/images/profil_'+_me+'.png';
        b.innerHTML='<img src="'+_mySrc+'" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;pointer-events:none;">';
        badgeSlot.appendChild(b);
      } else if(oppTurnActive){
        var b2=document.createElement('div');b2.className='sj-their-turn-badge';
        var _oppSrc=_avSrc?window.yamAvatarSrc(_other):'assets/images/profil_'+_other+'.png';
        b2.innerHTML='<img src="'+_oppSrc+'" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;pointer-events:none;">';
        badgeSlot.appendChild(b2);
      }
    }

    var myRevTotal =myCards.reduce(function(s,c){return c.revealed&&!c.removed?s+c.value:s;},0);
    var oppRevTotal=oppCards.reduce(function(s,c){return c.revealed&&!c.removed?s+c.value:s;},0);
    var myTotEl=document.getElementById('skyjoMyTotal');
    var oppTotEl=document.getElementById('skyjoOppTotal');
    if(myTotEl)  myTotEl.textContent =myRevTotal;
    if(oppTotEl) oppTotEl.textContent=oppRevTotal;

    var banner=document.getElementById('skyjoTurnBanner');
    var bannerTextEl=document.getElementById('skyjoTurnBannerText');
    var newBannerClass, newBannerText;
    if(state.phase==='init1'){
      newBannerText='🃏 Phase d\'initialisation — retourne 2 cartes';
      newBannerClass='skyjo-turn-banner my-turn';
    } else if(isMyTurn){
      if(state.must_flip===_me){ newBannerText='👆 Retourne une carte cachée de ta grille'; }
      else if(iHoldCard){ newBannerText='🃏 Place ta carte sur ta grille (ou défausse)'; }
      else { newBannerText='🎯 C\'est ton tour — pioche une carte !'; }
      newBannerClass='skyjo-turn-banner my-turn';
    } else {
      newBannerText='⏳ Tour de '+oppName+'…';
      newBannerClass='skyjo-turn-banner their-turn';
    }
    if(bannerTextEl) bannerTextEl.textContent=newBannerText;
    if(banner.className!==newBannerClass||turnChanged){
      banner.className=newBannerClass;
      if(turnChanged){ sjAnimBanner(banner,newBannerClass.indexOf('my-turn')>=0); }
    }
    document.getElementById('skyjoOpponentLabel').textContent='Grille de '+oppName;

    var discardEl=document.getElementById('skyjoDiscardCard');
    var top=state.discard&&state.discard.length>0?state.discard[state.discard.length-1]:null;
    if(top!==null&&top!==undefined){
      discardEl.innerHTML=sjCardSVG(top);
      discardEl.setAttribute('data-val',top);discardEl.classList.remove('skyjo-card-back');
      if(discardChanged){
        discardEl.classList.remove('sj-discard-slide');void discardEl.offsetWidth;
        discardEl.classList.add('sj-discard-slide');
        setTimeout(function(){discardEl.classList.remove('sj-discard-slide');},380);
      }
    } else { discardEl.textContent='—';discardEl.removeAttribute('data-val'); }
    document.getElementById('skyjoDrawPileCount').textContent=(state.deck?state.deck.length:0)+' cartes';

    var deckEl2=document.getElementById('skyjoDeckCard');
    var discardEl2=document.getElementById('skyjoDiscardCard');
    var canPickFromPiles=isMyTurn&&state.phase==='play'&&!iHoldCard&&state.must_flip!==_me;
    if(deckEl2){if(canPickFromPiles)deckEl2.classList.add('sj-selectable');else deckEl2.classList.remove('sj-selectable');}
    if(discardEl2){
      var discardHasCard=state.discard&&state.discard.length>0;
      if(canPickFromPiles&&discardHasCard)discardEl2.classList.add('sj-selectable');else discardEl2.classList.remove('sj-selectable');
    }

    // ── Live spectateur : animations du tour adversaire ──
    var oppKey2=_me==='girl'?'boy':'girl';
    var curLive=state.live;
    var oppHeldWrap=document.getElementById('skyjoOppHeldWrap');
    var oppHeldEl=document.getElementById('skyjoOppHeldCard');
    var deckElLv=document.getElementById('skyjoDeckCard');
    var discardElLv=document.getElementById('skyjoDiscardCard');
    var oppHoldsCard=state.held_card&&state.held_card.holder===oppKey2;

    if(!window._sjLastSeenLiveTs) window._sjLastSeenLiveTs=0;
    var isNewLive=curLive&&curLive.ts&&curLive.ts!==window._sjLastSeenLiveTs;
    console.log('[SKYJO-LIVE] isNewLive='+isNewLive+' isMyTurn='+isMyTurn+' curLive=',curLive);

    var _pendingLiveAnim=null;
    if(isNewLive&&curLive.player&&curLive.player===oppKey2){
      var lv=curLive;
      window._sjLastSeenLiveTs=lv.ts;
      console.log('[SKYJO-LIVE] reçu action='+lv.action+' isMyTurn='+isMyTurn+' player='+lv.player+' oppKey2='+oppKey2);

      if(lv.action==='draw_deck'||lv.action==='draw_discard'){
        var srcElPre=lv.action==='draw_deck'?deckElLv:discardElLv;
        if(srcElPre){
          var sRpre=srcElPre.getBoundingClientRect();
          var dRpre=oppHeldEl?oppHeldEl.getBoundingClientRect():null;
          if(!dRpre||dRpre.width===0){dRpre={left:sRpre.left,top:sRpre.top-70,width:sRpre.width,height:sRpre.height};}
          var flyValPre=lv.action==='draw_discard'?lv.val:null;
          _pendingLiveAnim={type:'draw',sR:sRpre,dR:dRpre,val:flyValPre,flip:lv.action==='draw_deck'};
        }
      } else if(lv.action==='replace'){
        var sR2pre=null,usingFallbackPre=true;
        if(oppHeldEl&&oppHeldWrap&&oppHeldWrap.classList.contains('sj-held-visible')){
          oppHeldEl.innerHTML=sjCardSVG(lv.val);
          oppHeldEl.setAttribute('data-val',lv.val);
          sR2pre=oppHeldEl.getBoundingClientRect();
          if(sR2pre&&sR2pre.width>0) usingFallbackPre=false;
        }
        if(!sR2pre||sR2pre.width===0){var fbEl=deckElLv||discardElLv;sR2pre=fbEl?fbEl.getBoundingClientRect():null;}
        var targetOppElPre=sjGetCardEl('skyjoOpponentGrid',lv.idx);
        var dR2pre=targetOppElPre?targetOppElPre.getBoundingClientRect():null;
        console.log('[SKYJO-LIVE] replace sR=',sR2pre,'dR=',dR2pre,'idx=',lv.idx,'targetEl=',targetOppElPre);
        if(sR2pre&&dR2pre&&sR2pre.width>0&&dR2pre.width>0){
          _pendingLiveAnim={type:'replace',idx:lv.idx,sR:sR2pre,dR:dR2pre,val:lv.val,usingFallback:usingFallbackPre};
          console.log('[SKYJO-LIVE] replace pendingAnim OK');
        } else { console.warn('[SKYJO-LIVE] replace ABANDONNÉ sR=',sR2pre,'dR=',dR2pre); }
      } else if(lv.action==='discard_held'){
        var sR3pre,usingFallback3pre=false;
        if(oppHeldEl&&oppHeldWrap&&oppHeldWrap.classList.contains('sj-held-visible')){sR3pre=oppHeldEl.getBoundingClientRect();}
        if(!sR3pre||sR3pre.width===0){usingFallback3pre=true;var fbEl3=deckElLv||discardElLv;sR3pre=fbEl3?fbEl3.getBoundingClientRect():null;}
        var dR3pre=discardElLv?discardElLv.getBoundingClientRect():null;
        if(sR3pre&&dR3pre&&sR3pre.width>0&&dR3pre.width>0){_pendingLiveAnim={type:'discard_held',sR:sR3pre,dR:dR3pre,val:lv.val,usingFallback:usingFallback3pre};}
      }

      if(lv.action==='replace'||lv.action==='discard_held'){
        if(oppHeldWrap){
          var _hideDelay=lv.action==='replace'?380:320;
          setTimeout(function(){oppHeldWrap.classList.remove('sj-held-visible');},_hideDelay);
        }
      }
    }

    if(isNewLive&&curLive.player&&curLive.player===_me){ window._sjLastSeenLiveTs=curLive.ts; }

    if(!isNewLive&&oppHoldsCard&&oppHeldWrap&&oppHeldEl){
      if(!oppHeldWrap.classList.contains('sj-held-visible')){
        oppHeldEl.innerHTML=sjCardSVG(state.held_card.value);
        oppHeldEl.setAttribute('data-val',state.held_card.value);
        oppHeldWrap.classList.add('sj-held-visible');
      }
    } else if(!oppHoldsCard&&oppHeldWrap&&!isNewLive){ oppHeldWrap.classList.remove('sj-held-visible'); }

    // skipFlipIdx : index dont le flip est déjà géré par l'animation live 'replace'
    // → évite le sjAnimFlipInPlace parasite dans renderGrid
    var _skipFlipIdx = (_pendingLiveAnim && _pendingLiveAnim.type==='replace') ? _pendingLiveAnim.idx : -1;
    renderGrid('skyjoMyGrid',myCards,true,isMyTurn,state,iHoldCard,-1);
    renderGrid('skyjoOpponentGrid',oppCards,false,false,state,false,_skipFlipIdx);

    // ── Lancer les animations live ──
    if(_pendingLiveAnim){
      var pla=_pendingLiveAnim;
      console.log('[SKYJO-ANIM] pendingLiveAnim type='+pla.type,pla);
      _sjAnimPlaying=true;
      if(pla.type==='draw'){
        sjAnimFly(pla.sR,pla.dR,pla.val,{duration:420,flip:pla.flip,onDone:function(){_sjAnimDone();}});
        if(oppHeldWrap&&oppHeldEl){
          setTimeout(function(){
            if(!_gameState) return;
            var liveHeld=_gameState.held_card;
            if(liveHeld&&liveHeld.holder===oppKey2){
              oppHeldEl.innerHTML=sjCardSVG(liveHeld.value);
              oppHeldEl.setAttribute('data-val',liveHeld.value);
            }
            oppHeldWrap.classList.add('sj-held-visible');
            oppHeldEl.classList.remove('sj-held-appear');void oppHeldEl.offsetWidth;
            oppHeldEl.classList.add('sj-held-appear');
            setTimeout(function(){oppHeldEl.classList.remove('sj-held-appear');},420);
          },430);
        }
      } else if(pla.type==='replace'){
        var newTargetOppEl=sjGetCardEl('skyjoOpponentGrid',pla.idx);
        if(newTargetOppEl) newTargetOppEl.style.visibility='hidden';
        if(!pla.usingFallback&&oppHeldEl) oppHeldEl.style.visibility='hidden';
        sjAnimFly(pla.sR,pla.dR,pla.val,{duration:440,flip:false,onDone:function(){
          if(newTargetOppEl){newTargetOppEl.style.visibility='';sjPlaceGlow(newTargetOppEl);}
          if(!pla.usingFallback&&oppHeldEl) oppHeldEl.style.visibility='';
          _sjAnimDone();
        }});
      } else if(pla.type==='discard_held'){
        if(!pla.usingFallback&&oppHeldEl) oppHeldEl.style.visibility='hidden';
        sjAnimFly(pla.sR,pla.dR,pla.val,{duration:380,flip:false,onDone:function(){
          if(!pla.usingFallback&&oppHeldEl) oppHeldEl.style.visibility='';
          _sjAnimDone();
        }});
      }
    }

    // Carte en main
    var heldWrap=document.getElementById('skyjoHeldCardWrap');
    var heldEl=document.getElementById('skyjoHeldCard');
    var discardBtn=document.getElementById('skyjoDiscardBtn');
    if(iHoldCard){
      heldWrap.classList.add('sj-held-visible');
      heldEl.innerHTML=sjCardSVG(state.held_card.value);
      heldEl.setAttribute('data-val',state.held_card.value);
      if(discardBtn){discardBtn.disabled=false;discardBtn.style.opacity='';discardBtn.style.pointerEvents='';}
      if(newHeld){
        heldEl.classList.remove('sj-held-appear');void heldEl.offsetWidth;
        heldEl.classList.add('sj-held-appear');
        setTimeout(function(){heldEl.classList.remove('sj-held-appear');},420);
      }
    } else {
      heldWrap.classList.remove('sj-held-visible');
      if(discardBtn) discardBtn.disabled=false;
    }

    var phaseMsg=document.getElementById('skyjoPhaseMsg');
    if(state.phase==='init1'){
      phaseMsg.style.display='block';
      var myFlippedCount=myCards.filter(function(c){return c.revealed;}).length;
      var othFlippedCount=oppCards.filter(function(c){return c.revealed;}).length;
      if(myFlippedCount<2){ phaseMsg.textContent='Clique sur 2 cartes de ta grille pour les retourner'; }
      else { phaseMsg.textContent='✅ Tu as retourné tes 2 cartes — en attente que '+oppName+' fasse pareil…'; }
    } else { phaseMsg.style.display='none'; }

    if(state.phase==='roundEnd'){_sjStopTimer();showRoundEnd(state);}
    else if(state.phase==='gameEnd'){_sjStopTimer();if(_mp)_mp.stopPoll();showGameEnd(state);}
  }

  function renderGrid(gridId,cards,isMe,isMyTurn,state,iHold,skipFlipIdx){
    var grid=document.getElementById(gridId);
    var prevEls=Array.from(grid.querySelectorAll('.skyjo-card'));
    var prevStates=prevEls.map(function(el){
      return{hidden:el.classList.contains('skyjo-card-hidden'),removed:el.classList.contains('skyjo-col-complete'),val:el.getAttribute('data-val'),rect:el.getBoundingClientRect()};
    });
    var isFirstRender=prevEls.length===0;
    grid.innerHTML='';
    var phase=state.phase, isInit=phase==='init1';
    var flipped=cards.filter(function(c){return c.revealed;}).length;
    var canFlipInit   =isMe&&isInit&&flipped<2;
    var canReplaceAny =isMe&&isMyTurn&&phase==='play'&&iHold;
    var mustFlipHidden=isMe&&isMyTurn&&phase==='play'&&!iHold&&state.must_flip===_me;

    cards.forEach(function(card,idx){
      var prev=prevStates[idx]||{};
      var el=document.createElement('div');
      el.className='skyjo-card';
      if(isFirstRender){
        el.style.opacity='0';el.style.transform='scale(0.6) translateY(12px) rotateZ('+(Math.random()*8-4)+'deg)';
        el.style.transition='opacity 0.32s ease, transform 0.32s cubic-bezier(.17,.89,.32,1.28)';
        el.style.transitionDelay=(idx*38)+'ms';
        (function(e,delay){
          setTimeout(function(){
            e.style.opacity='1';e.style.transform='scale(1) translateY(0) rotateZ(0deg)';
            setTimeout(function(){e.style.transition='';e.style.transitionDelay='';},380);
          },delay);
        }(el,30+idx*38));
      }
      if(card.removed){
        el.classList.add('skyjo-col-complete');el.innerHTML='';
        if(!prev.removed&&!isFirstRender){
          el.classList.remove('skyjo-col-complete');el.classList.add('sj-col-remove');
          (function(e){setTimeout(function(){e.classList.remove('sj-col-remove');e.classList.add('skyjo-col-complete');},540);}(el));
          if(prev.rect) sjSpawnParticles({getBoundingClientRect:function(){return prev.rect;}});
        }
      } else if(card.revealed){
        el.setAttribute('data-val',card.value);
        el.innerHTML=sjCardSVG(card.value);
        // Ne pas rejouer le flip si l'animation live 'replace' l'a déjà géré pour cet index
        if(prev.hidden&&!isFirstRender&&!isMe&&idx!==skipFlipIdx){
          var _elRef=el,_val=card.value,_delay=idx*55+80;
          setTimeout(function(){if(!_elRef||!_elRef.isConnected)return;sjAnimFlipInPlace(_elRef,_val,null);},_delay);
        }
        if(canReplaceAny){el.classList.add('skyjo-card-clickable');el.onclick=function(){skyjoReplaceCard(idx);};}
      } else {
        el.classList.add('skyjo-card-hidden');
        el.innerHTML=sjCardBackSVG();
        if(canFlipInit){el.classList.add('skyjo-card-clickable');el.onclick=function(){skyjoFlipInit(idx);};}
        else if(canReplaceAny){el.classList.add('skyjo-card-clickable');el.onclick=function(){skyjoReplaceCard(idx);};}
        else if(mustFlipHidden){el.classList.add('skyjo-card-clickable');el.onclick=function(){skyjoFlipReveal(idx);};}
      }
      grid.appendChild(el);
    });
  }

  // ─── Helpers animations ───────────────────────────────
  function sjShowLoader(){var o=document.getElementById('sjLoadingOverlay');if(o)o.classList.add('visible');}
  function sjHideLoader(){var o=document.getElementById('sjLoadingOverlay');if(o)o.classList.remove('visible');}

  function sjAnimFly(srcRect,destRect,cardVal,opts){
    opts=opts||{};
    var dur=opts.duration||480,delay=opts.delay||0;
    var card=document.createElement('div');
    card.className='skyjo-card sj-fly-clone';
    card.style.cssText=['position:fixed','left:'+srcRect.left+'px','top:'+srcRect.top+'px','width:'+srcRect.width+'px','height:'+srcRect.height+'px','z-index:9999','pointer-events:none','will-change:transform,opacity','transform-origin:center center','transform-style:preserve-3d'].join(';');
    if(cardVal!==null&&cardVal!==undefined){card.innerHTML=sjCardSVG(cardVal);card.setAttribute('data-val',cardVal);}
    else{card.innerHTML=sjCardBackSVG();}
    document.body.appendChild(card);
    var dx=(destRect.left+destRect.width/2)-(srcRect.left+srcRect.width/2);
    var dy=(destRect.top+destRect.height/2)-(srcRect.top+srcRect.height/2);
    var scaleX=destRect.width/srcRect.width,scaleY=destRect.height/srcRect.height;
    var keyframes;
    if(opts.flip){
      keyframes=[
        {transform:'translate(0,0) scale(1) rotateZ(-4deg) rotateY(0deg)',opacity:1,offset:0},
        {transform:'translate('+dx*0.4+'px,'+dy*0.25+'px) scale(1.2) rotateZ(2deg) rotateY(90deg)',opacity:1,offset:0.35},
        {transform:'translate('+dx*0.7+'px,'+dy*0.6+'px) scale(1.1) rotateZ(1deg) rotateY(0deg)',opacity:1,offset:0.6},
        {transform:'translate('+dx+'px,'+dy+'px) scale('+scaleX+','+scaleY+') rotateZ(0deg) rotateY(0deg)',opacity:0.1,offset:1}
      ];
      setTimeout(function(){if(!card.parentNode)return;card.innerHTML=sjCardSVG(cardVal);card.setAttribute('data-val',cardVal);},delay+dur*0.35);
    } else {
      keyframes=[
        {transform:'translate(0,0) scale(1) rotateZ(-5deg)',opacity:1,offset:0},
        {transform:'translate('+dx*0.38+'px,'+dy*0.22+'px) scale(1.22) rotateZ(4deg)',opacity:1,offset:0.28},
        {transform:'translate('+dx*0.72+'px,'+dy*0.68+'px) scale(1.08) rotateZ(1deg)',opacity:1,offset:0.65},
        {transform:'translate('+dx+'px,'+dy+'px) scale('+scaleX+','+scaleY+') rotateZ(0deg)',opacity:0.1,offset:1}
      ];
    }
    var anim=card.animate(keyframes,{duration:dur,delay:delay,easing:'cubic-bezier(.25,.65,.3,.98)',fill:'forwards'});
    anim.onfinish=function(){if(card.parentNode)card.parentNode.removeChild(card);if(opts.onDone)opts.onDone();};
    return anim;
  }

  function sjAnimFlipInPlace(targetEl,newVal,onDone){
    if(!targetEl){if(onDone)onDone();return;}
    var rect=targetEl.getBoundingClientRect();
    var card=document.createElement('div');
    card.className='skyjo-card';
    card.style.cssText=['position:fixed','left:'+rect.left+'px','top:'+rect.top+'px','width:'+rect.width+'px','height:'+rect.height+'px','z-index:9999','pointer-events:none','will-change:transform,opacity','transform-origin:center center','transform-style:preserve-3d','perspective:500px'].join(';');
    card.classList.add('skyjo-card-hidden');
    card.innerHTML=sjCardBackSVG();
    document.body.appendChild(card);
    targetEl.style.visibility='hidden';
    var dur=540;
    var anim=card.animate([
      {transform:'rotateY(0deg) scale(1)',filter:'brightness(1)',offset:0},
      {transform:'rotateY(90deg) scale(1.08)',filter:'brightness(0.4)',offset:0.36},
      {transform:'rotateY(-90deg) scale(1.08)',filter:'brightness(0.4)',offset:0.37},
      {transform:'rotateY(-10deg) scale(1.04)',filter:'brightness(1.3)',offset:0.7},
      {transform:'rotateY(3deg) scale(1.01)',filter:'brightness(1.1)',offset:0.87},
      {transform:'rotateY(0deg) scale(1)',filter:'brightness(1)',offset:1}
    ],{duration:dur,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
    setTimeout(function(){if(!card.parentNode)return;card.classList.remove('skyjo-card-hidden');if(newVal!==null&&newVal!==undefined){card.innerHTML=sjCardSVG(newVal);card.setAttribute('data-val',newVal);}},dur*0.37);
    anim.onfinish=function(){targetEl.style.visibility='';if(card.parentNode)card.parentNode.removeChild(card);sjPlaceGlow(targetEl);if(onDone)onDone();};
  }

  function sjAnimHeldToGrid(heldEl,targetEl,heldVal,newVal,wasHidden,onDone){
    if(!heldEl||!targetEl){if(onDone)onDone();return;}
    var srcRect=heldEl.getBoundingClientRect(),destRect=targetEl.getBoundingClientRect();
    heldEl.style.visibility='hidden';targetEl.style.visibility='hidden';
    var dur=wasHidden?560:480;
    sjAnimFly(srcRect,destRect,heldVal,{duration:dur,flip:wasHidden,onDone:function(){
      targetEl.style.visibility='';
      if(wasHidden){
        targetEl.animate([
          {transform:'scale(0.8) rotateZ(3deg)',opacity:0.3,filter:'brightness(1.4)'},
          {transform:'scale(1.1) rotateZ(-1deg)',opacity:1,filter:'brightness(1.2)'},
          {transform:'scale(1) rotateZ(0deg)',opacity:1,filter:'brightness(1)'}
        ],{duration:280,easing:'cubic-bezier(.17,.89,.32,1.28)',fill:'forwards'}).onfinish=function(){sjPlaceGlow(targetEl);};
      } else {
        targetEl.animate([
          {transform:'scale(0.7) rotateZ(-5deg)',opacity:0.2},
          {transform:'scale(1.1) rotateZ(1deg)',opacity:1},
          {transform:'scale(1) rotateZ(0deg)',opacity:1}
        ],{duration:260,easing:'cubic-bezier(.17,.89,.32,1.28)',fill:'forwards'}).onfinish=function(){sjPlaceGlow(targetEl);};
      }
      heldEl.style.visibility='';
      if(onDone)onDone();
    }});
  }

  function sjAnimHeldToDiscard(heldEl,discardEl,heldVal,onDone){
    if(!heldEl||!discardEl){if(onDone)onDone();return;}
    var srcRect=heldEl.getBoundingClientRect(),destRect=discardEl.getBoundingClientRect();
    heldEl.style.visibility='hidden';
    var dx=(destRect.left+destRect.width/2)-(srcRect.left+srcRect.width/2);
    var dy=(destRect.top+destRect.height/2)-(srcRect.top+srcRect.height/2);
    var scaleX=destRect.width/srcRect.width,scaleY=destRect.height/srcRect.height;
    var card=document.createElement('div');
    card.className='skyjo-card';
    card.style.cssText='position:fixed;left:'+srcRect.left+'px;top:'+srcRect.top+'px;width:'+srcRect.width+'px;height:'+srcRect.height+'px;z-index:9999;pointer-events:none;will-change:transform,opacity;transform-style:preserve-3d;';
    card.innerHTML=sjCardSVG(heldVal);card.setAttribute('data-val',heldVal);
    document.body.appendChild(card);
    var anim=card.animate([
      {transform:'translate(0,0) scale(1) rotateZ(0deg) rotateY(0deg)',opacity:1,offset:0},
      {transform:'translate('+dx*0.4+'px,'+dy*0.3+'px) scale(1.15) rotateZ(-8deg) rotateY(40deg)',opacity:1,offset:0.3},
      {transform:'translate('+dx*0.75+'px,'+dy*0.7+'px) scale(1.05) rotateZ(12deg) rotateY(180deg)',opacity:1,offset:0.65},
      {transform:'translate('+dx+'px,'+dy+'px) scale('+scaleX+','+scaleY+') rotateZ(0deg) rotateY(0deg)',opacity:0.05,offset:1}
    ],{duration:440,easing:'cubic-bezier(.25,.6,.3,.98)',fill:'forwards'});
    anim.onfinish=function(){if(card.parentNode)card.parentNode.removeChild(card);heldEl.style.visibility='';if(onDone)onDone();};
  }

  function sjSpawnParticles(el){
    if(!el) return;
    var rect=el.getBoundingClientRect?el.getBoundingClientRect():el;
    var cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    var emojis=['✨','⭐','💫','🌟','🎉','🃏','💥','🌈'],count=10;
    for(var i=0;i<count;i++){
      (function(i){
        setTimeout(function(){
          var p=document.createElement('div');p.className='sj-particle';p.textContent=emojis[i%emojis.length];
          var angle=(i/count)*Math.PI*2+(Math.random()*0.6),dist=45+Math.random()*55;
          p.style.left=cx+'px';p.style.top=cy+'px';
          p.style.setProperty('--px',(Math.cos(angle)*dist)+'px');
          p.style.setProperty('--py',(Math.sin(angle)*dist-45)+'px');
          p.style.setProperty('--pr',(Math.random()*540-270)+'deg');
          p.style.fontSize=(13+Math.random()*9)+'px';
          document.body.appendChild(p);
          setTimeout(function(){if(p.parentNode)p.parentNode.removeChild(p);},1100);
        },i*40+Math.random()*25);
      })(i);
    }
  }

  function sjPlaceGlow(el){
    if(!el)return;
    el.classList.remove('sj-place-glow');void el.offsetWidth;
    el.classList.add('sj-place-glow');
    setTimeout(function(){el.classList.remove('sj-place-glow');},620);
  }

  function sjAnimBanner(el,isMyTurn){
    if(!el)return;
    el.classList.remove('sj-banner-enter','sj-banner-enter-opp');void el.offsetWidth;
    el.classList.add(isMyTurn?'sj-banner-enter':'sj-banner-enter-opp');
    var cls=isMyTurn?'sj-banner-enter':'sj-banner-enter-opp';
    setTimeout(function(){el.classList.remove(cls);},400);
  }

  function sjGetCardEl(gridId,idx){
    var grid=document.getElementById(gridId);
    if(!grid)return null;
    return grid.querySelectorAll('.skyjo-card')[idx]||null;
  }

  // ─── Helpers logique jeu ──────────────────────────────
  function checkAndRemoveColumns(cards){
    var changed=false;
    for(var col=0;col<4;col++){
      var i0=col,i1=col+4,i2=col+8;
      var c0=cards[i0],c1=cards[i1],c2=cards[i2];
      if(!c0||!c1||!c2)continue;
      if(c0.removed||c1.removed||c2.removed)continue;
      if(c0.revealed&&c1.revealed&&c2.revealed&&c0.value===c1.value&&c1.value===c2.value){
        cards[i0].removed=true;cards[i1].removed=true;cards[i2].removed=true;changed=true;
      }
    }
    return changed;
  }

  function calcPlayerScore(cards){return cards.reduce(function(s,c){return s+(c.removed?0:c.value);},0);}
  function allRevealed(cards){return cards.every(function(c){return c.removed||c.revealed;});}
  function nextTurn(ns){ns.turn=(ns.turn==='girl'?'boy':'girl');ns.ts_turn=Date.now();}

  function handleRoundClose(ns,closerKey){
    if(ns.phase==='roundEnd')return;
    if(!ns.round_closer){
      ns.round_closer=closerKey;
      ns.last_player=(closerKey==='girl'?'boy':'girl');
      ns.turn=ns.last_player;
    } else { _finishRound(ns); }
  }

  function _finishRound(ns){
    ['girl_cards','boy_cards'].forEach(function(key){ns[key].forEach(function(c){if(!c.removed)c.revealed=true;});});
    var gs=calcPlayerScore(ns.girl_cards),gb=calcPlayerScore(ns.boy_cards);
    if(ns.round_closer==='girl'&&gs>=gb) gs*=2;
    if(ns.round_closer==='boy'&&gb>=gs)  gb*=2;
    ns.scores=ns.scores||{girl:0,boy:0};
    ns.scores.girl=(ns.scores.girl||0)+gs;
    ns.scores.boy=(ns.scores.boy||0)+gb;
    ns.round_scores={girl:gs,boy:gb};
    if(ns.scores.girl>=100||ns.scores.boy>=100){ ns.phase='gameEnd'; }
    else { ns.phase='roundEnd'; }
  }

  // ─── Actions joueur ───────────────────────────────────
  window.skyjoFlipInit=function(idx){
    if(!_gameState||_phase!=='init1'||!_mp)return;
    var key=_me+'_cards';
    var flipped=_gameState[key].filter(function(c){return c.revealed;}).length;
    if(flipped>=2)return;
    var cardEl=sjGetCardEl('skyjoMyGrid',idx);
    if(cardEl&&cardEl.classList.contains('skyjo-card-hidden')){
      cardEl.style.pointerEvents='none';cardEl.classList.remove('skyjo-card-clickable');
      sjAnimFlipInPlace(cardEl,_gameState[key][idx].value,null);
    }
    var ns=deepCopy(_gameState);
    ns[key][idx].revealed=true;
    var myFlipped=ns[key].filter(function(c){return c.revealed;}).length;
    var otherKey=(_me==='girl'?'boy':'girl')+'_cards';
    var otherFlipped=ns[otherKey].filter(function(c){return c.revealed;}).length;
    if(myFlipped>=2&&otherFlipped>=2){
      var myTot=ns[key].reduce(function(a,c){return a+(c.revealed?c.value:0);},0);
      var othTot=ns[otherKey].reduce(function(a,c){return a+(c.revealed?c.value:0);},0);
      ns.turn=myTot>=othTot?_me:_other;ns.phase='play';ns.ts_turn=Date.now();
    }
    _mp.saveState(ns);
  };

  window.skyjoDrawFromDeck=function(){
    if(!_gameState||_phase!=='play'||!_mp)return;
    if(_gameState.turn!==_me||_gameState.held_card)return;
    if(!_gameState.deck||!_gameState.deck.length)return;
    var _d1=document.getElementById('skyjoDeckCard'),_d2=document.getElementById('skyjoDiscardCard');
    if(_d1)_d1.classList.remove('sj-selectable');if(_d2)_d2.classList.remove('sj-selectable');
    var deckEl=document.getElementById('skyjoDeckCard'),heldEl=document.getElementById('skyjoHeldCard');
    if(deckEl){deckEl.animate([{transform:'scale(1) translateY(0)'},{transform:'scale(0.87) translateY(4px) rotateZ(2deg)'},{transform:'scale(1.06) translateY(-3px) rotateZ(-1deg)'},{transform:'scale(1) translateY(0)'}],{duration:300,easing:'cubic-bezier(.4,0,.2,1)'});}
    if(deckEl&&heldEl){
      var sRect=deckEl.getBoundingClientRect(),dRect=heldEl.getBoundingClientRect();
      if(!dRect||dRect.width===0)dRect={left:sRect.left-80,top:sRect.top,width:sRect.width,height:sRect.height};
      sjAnimFly(sRect,dRect,null,{duration:440,flip:false});
    }
    var ns=deepCopy(_gameState);
    var drawnVal=ns.deck.pop();
    if(ns.deck.length===0&&ns.discard.length>1){var top=ns.discard.pop();ns.deck=shuffle(ns.discard.slice());ns.discard=[top];}
    ns.held_card={value:drawnVal,holder:_me};
    ns.live={action:'draw_deck',player:_me,ts:Date.now()};
    _mp.saveState(ns);
  };

  window.skyjoDrawFromDiscard=function(){
    if(!_gameState||_phase!=='play'||!_mp)return;
    if(_gameState.turn!==_me||_gameState.held_card)return;
    if(!_gameState.discard||!_gameState.discard.length)return;
    var _d1=document.getElementById('skyjoDeckCard'),_d2=document.getElementById('skyjoDiscardCard');
    if(_d1)_d1.classList.remove('sj-selectable');if(_d2)_d2.classList.remove('sj-selectable');
    var discardEl=document.getElementById('skyjoDiscardCard'),heldEl=document.getElementById('skyjoHeldCard');
    var topVal=_gameState.discard[_gameState.discard.length-1];
    if(discardEl&&heldEl){
      var sRect=discardEl.getBoundingClientRect();
      var dRect=heldEl.getBoundingClientRect&&heldEl.getBoundingClientRect().width>0?heldEl.getBoundingClientRect():{left:sRect.left-70,top:sRect.top,width:sRect.width,height:sRect.height};
      sjAnimFly(sRect,dRect,topVal,{duration:440,flip:false});
    }
    var ns=deepCopy(_gameState);
    var drawnVal=ns.discard.pop();
    ns.held_card={value:drawnVal,holder:_me};
    ns.live={action:'draw_discard',val:drawnVal,player:_me,ts:Date.now()};
    _mp.saveState(ns);
  };

  window.skyjoReplaceCard=function(idx){
    if(!_gameState||_phase!=='play'||!_mp)return;
    if(_gameState.turn!==_me)return;
    if(!_gameState.held_card||_gameState.held_card.holder!==_me)return;
    var heldEl=document.getElementById('skyjoHeldCard'),targetEl=sjGetCardEl('skyjoMyGrid',idx);
    var key=_me+'_cards',heldVal=_gameState.held_card.value;
    var wasHidden=_gameState[key][idx]&&!_gameState[key][idx].revealed;
    var targetVal=_gameState[key][idx]?_gameState[key][idx].value:null;
    var grid=document.getElementById('skyjoMyGrid');
    if(grid)grid.querySelectorAll('.skyjo-card').forEach(function(c){c.style.pointerEvents='none';c.classList.remove('skyjo-card-clickable');});
    var discardBtn=document.getElementById('skyjoDiscardBtn');
    if(discardBtn)discardBtn.disabled=true;
    if(heldEl&&targetEl){
      sjAnimHeldToGrid(heldEl,targetEl,heldVal,wasHidden?null:targetVal,wasHidden,function(){
        if(!wasHidden&&targetVal!==null){
          var newTargetEl=sjGetCardEl('skyjoMyGrid',idx),discardEl2=document.getElementById('skyjoDiscardCard');
          if(newTargetEl&&discardEl2){sjAnimFly(newTargetEl.getBoundingClientRect(),discardEl2.getBoundingClientRect(),targetVal,{duration:360,flip:false});}
        }
      });
    }
    var ns=deepCopy(_gameState);
    var oldCard=ns[key][idx];
    ns.discard.push(oldCard.value);
    ns[key][idx]={value:heldVal,revealed:true};
    ns.held_card=null;
    var _liveDestRect=targetEl?targetEl.getBoundingClientRect():null;
    ns.live={action:'replace',idx:idx,val:heldVal,player:_me,destRect:_liveDestRect?{left:_liveDestRect.left,top:_liveDestRect.top,width:_liveDestRect.width,height:_liveDestRect.height}:null,ts:Date.now()};
    checkAndRemoveColumns(ns[key]);
    if(allRevealed(ns[key])){handleRoundClose(ns,_me);}
    else if(ns.round_closer&&ns.last_player===_me){_finishRound(ns);}
    else{nextTurn(ns);}
    _mp.saveState(ns);
  };

  window.skyjoDiscardHeld=function(){
    if(!_gameState||_phase!=='play'||!_mp)return;
    if(_gameState.turn!==_me)return;
    if(!_gameState.held_card||_gameState.held_card.holder!==_me)return;
    var heldEl=document.getElementById('skyjoHeldCard'),discardEl=document.getElementById('skyjoDiscardCard');
    var heldVal=_gameState.held_card.value;
    if(heldEl&&discardEl){sjAnimHeldToDiscard(heldEl,discardEl,heldVal,null);}
    var ns=deepCopy(_gameState);
    ns.discard.push(ns.held_card.value);
    ns.live={action:'discard_held',val:ns.held_card.value,player:_me,ts:Date.now()};
    ns.held_card=null;ns.must_flip=_me;
    _mp.saveState(ns);
  };

  window.skyjoFlipReveal=function(idx){
    if(!_gameState||_phase!=='play'||!_mp)return;
    if(_gameState.turn!==_me||_gameState.must_flip!==_me)return;
    var key=_me+'_cards';
    if(_gameState[key][idx].revealed)return;
    var cardEl=sjGetCardEl('skyjoMyGrid',idx),cardVal=_gameState[key][idx].value;
    if(cardEl){cardEl.style.pointerEvents='none';sjAnimFlipInPlace(cardEl,cardVal,null);}
    var ns=deepCopy(_gameState);
    ns[key][idx].revealed=true;ns.must_flip=null;
    checkAndRemoveColumns(ns[key]);
    if(allRevealed(ns[key])){handleRoundClose(ns,_me);}
    else if(ns.round_closer&&ns.last_player===_me){_finishRound(ns);}
    else{nextTurn(ns);}
    _mp.saveState(ns);
  };

  // ─── Fin de manche ────────────────────────────────────
  function showRoundEnd(state){
    if(_roundEndShown)return;
    _roundEndShown=true;
    // ✅ FIX freeze: vider la file d'animation en attente + reset flag
    _sjAnimPlaying=false;
    _sjPendingRenderRow=null;
    _flipAllHiddenCards(state,function(){
      var myTotEl=document.getElementById('skyjoMyTotal'),oppTotEl=document.getElementById('skyjoOppTotal');
      [myTotEl,oppTotEl].forEach(function(el){
        if(!el)return;
        el.classList.remove('sj-score-pop');void el.offsetWidth;el.classList.add('sj-score-pop');
      });
      setTimeout(function(){_showRoundEndPopup(state);},10000);
    });
  }

  function _flipAllHiddenCards(state,onDone){
    var myKey=_me==='girl'?'girl_cards':'boy_cards',oppKey=_me==='girl'?'boy_cards':'girl_cards';
    var myGrid=document.getElementById('skyjoMyGrid'),oppGrid=document.getElementById('skyjoOpponentGrid');
    if(!myGrid||!oppGrid){if(onDone)onDone();return;}
    var myCardEls=Array.from(myGrid.querySelectorAll('.skyjo-card'));
    var oppCardEls=Array.from(oppGrid.querySelectorAll('.skyjo-card'));
    var allEls=myCardEls.concat(oppCardEls);
    var allData=(state[myKey]||[]).concat(state[oppKey]||[]);
    allEls.forEach(function(el){el.onclick=null;el.classList.remove('skyjo-card-clickable');el.style.pointerEvents='none';});
    var delay=0,maxEnd=0;
    allEls.forEach(function(el,i){
      var cardData=allData[i];
      if(!cardData||cardData.removed)return;
      if(!cardData.revealed){
        (function(el,d,val){setTimeout(function(){sjAnimFlipInPlace(el,val,null);},d);})(el,delay,cardData.value);
        maxEnd=delay+540+80;delay+=90;
      }
    });
    setTimeout(function(){if(onDone)onDone();},maxEnd+100);
  }

  function _showRoundEndPopup(state){
    var myTotEl=document.getElementById('skyjoMyTotal'),oppTotEl=document.getElementById('skyjoOppTotal');
    [myTotEl,oppTotEl].forEach(function(el){if(el){el.classList.remove('sj-score-pop');}});
    var rg=state.round_scores?state.round_scores.girl:0,rb=state.round_scores?state.round_scores.boy:0;
    var tg=state.scores?state.scores.girl:0,tb=state.scores?state.scores.boy:0;
    var winner=rg<rb?(typeof v2GetDisplayName==='function'?v2GetDisplayName('girl')+' gagne la manche !':'Elle gagne la manche !'):(rb<rg?(typeof v2GetDisplayName==='function'?v2GetDisplayName('boy')+' gagne la manche !':'Lui gagne la manche !'):null);
    document.getElementById('skyjoRoundEndEmoji').textContent=!winner?'🤝':'🏆';
    document.getElementById('skyjoRoundEndTitle').textContent=!winner?'Manche nulle !':winner;
    document.getElementById('skyjoRoundEndSub').textContent='Manche '+(state.round||1);
    var myR=_me==='girl'?rg:rb,oppR=_me==='girl'?rb:rg;
    var myT=_me==='girl'?tg:tb,oppT=_me==='girl'?tb:tg;
    var myName2=(typeof v2GetDisplayName==='function'?v2GetDisplayName('girl'):'Elle');
    var oppName2=(typeof v2GetDisplayName==='function'?v2GetDisplayName('boy'):'Lui');
    // Avatars — utilise yamAvatarSrc si dispo, sinon image par défaut
    var _avSrc=typeof window.yamAvatarSrc==='function';
    var mySrc  =_avSrc?window.yamAvatarSrc(_me)  :'assets/images/profil_'+_me+'.png';
    var oppSrc =_avSrc?window.yamAvatarSrc(_other):'assets/images/profil_'+_other+'.png';
    // Injecter les avatars dans les cartes
    var avLeft=document.getElementById('skyjoRoundAvatarLeft');
    var avRight=document.getElementById('skyjoRoundAvatarRight');
    if(avLeft)  avLeft.innerHTML ='<img src="'+mySrc+'"  alt="" style="width:100%;height:100%;object-fit:cover;display:block;">';
    if(avRight) avRight.innerHTML='<img src="'+oppSrc+'" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">';
    var lblLeft=document.getElementById('skyjoRoundLabelLeft'),lblRight=document.getElementById('skyjoRoundLabelRight');
    if(lblLeft)lblLeft.textContent=myName2;if(lblRight)lblRight.textContent=oppName2;
    document.getElementById('skyjoRoundScoreGirl').textContent='+'+myR;
    document.getElementById('skyjoRoundScoreBoy').textContent='+'+oppR;
    document.getElementById('skyjoTotalScoreGirl').textContent=myT+' pts';
    document.getElementById('skyjoTotalScoreBoy').textContent=oppT+' pts';
    var btn=document.getElementById('skyjoNextRoundBtn'),msg=document.getElementById('skyjoWaitNextMsg');
    if(btn){btn.disabled=false;btn.textContent='Manche suivante →';btn.style.display='block';}
    if(msg)msg.style.display='none';
    _waitingNextRound=true;
    document.getElementById('skyjoRoundEnd').style.display='flex';
  }

  window.skyjoNextRound=function(){
    if(!_mp)return;
    var btn=document.getElementById('skyjoNextRoundBtn');
    if(btn){btn.disabled=true;btn.textContent='Chargement…';}
    _mp.stopPoll();
    var deck=buildDeck(),gc=dealHand(deck),bc=dealHand(deck),top=deck.pop();
    var ns={
      deck:deck,discard:[top],girl_cards:gc,boy_cards:bc,
      phase:'init1',
      turn:_gameState?((_gameState.round_closer==='girl'?'boy':'girl')):'girl',
      round:_gameState?(_gameState.round||1)+1:2,
      scores:_gameState?_gameState.scores:{girl:0,boy:0},
      held_card:null,must_flip:null,last_player:null,round_closer:null,
      ts_turn:Date.now()
    };
    var gameId=_mp.getGameId();
    fetch(SB_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+gameId,{
      method:'PATCH',
      headers:sb2Headers({'Prefer':'return=representation'}),
      body:JSON.stringify({status:'playing',state:ns})
    }).then(function(r){return r.json();}).then(function(rows){
      if(Array.isArray(rows)&&rows[0]){
        // ✅ FIX freeze: reset complet de l'état d'animation avant de reprendre
        _sjAnimPlaying=false;
        _sjPendingRenderRow=null;
        _waitingNextRound=false;
        _roundEndShown=false;
        document.getElementById('skyjoRoundEnd').style.display='none';
        _mp.startPoll();
        renderState(rows[0]);
      }
    }).catch(function(){
      // ✅ FIX: en cas d'erreur réseau, réactiver le bouton
      if(btn){btn.disabled=false;btn.textContent='Manche suivante →';}
      _mp.startPoll();
    });
  };

  // ─── Timer auto-jeu (25s) ────────────────────────────
  var SJ_TIMER_DURATION = 25000; // 25 secondes
  var _sjTimerRAF       = null;  // ✅ FIX v3.7: setTimeout handle (était RAF 60fps)
  var _sjTimerStart     = 0;     // timestamp de début du timer
  var _sjTimerTurnKey   = null;  // clé unique du tour surveillé (turn+round+ts_turn)
  var _sjTimerFired     = false; // a-t-on déjà joué pour ce tour ?

  // Lance le timer pour MON tour
  function _sjStartMyTimer(state){
    _sjStopTimer();
    _sjTimerFired  = false;
    _sjTimerTurnKey= _sjMakeTurnKey(state);
    // ✅ FIX désync : utiliser ts_turn comme référence (comme _sjStartOppTimer)
    // évite que le timer reparte à 100% quand on revient sur l'app
    var refTs = (state.ts_turn || 0);
    var lagMs = refTs ? Math.min(Date.now() - refTs, SJ_TIMER_DURATION) : 0;
    _sjTimerStart = Date.now() - lagMs;

    var bar  = document.getElementById('sjTimerBar');
    var fill = document.getElementById('sjTimerBarFill');
    if(bar)  bar.classList.add('active');
    if(bar)  bar.classList.remove('danger');

    function tick(){
      var elapsed = Date.now() - _sjTimerStart;
      var ratio   = Math.max(0, 1 - elapsed / SJ_TIMER_DURATION);
      if(fill) fill.style.transform = 'scaleX(' + ratio + ')';

      // Danger rouge sous 7s
      if(bar){
        if(elapsed > SJ_TIMER_DURATION - 7000) bar.classList.add('danger');
        else                                    bar.classList.remove('danger');
      }

      if(elapsed >= SJ_TIMER_DURATION){
        _sjStopTimer();
        if(!_sjTimerFired){ _sjTimerFired=true; _sjAutoPlay(); }
        return;
      }
      _sjTimerRAF = setTimeout(tick, 100);
    }
    _sjTimerRAF = setTimeout(tick, 100);
  }

  // Lance le timer spectateur (juste la barre, pas d'action)
  function _sjStartOppTimer(state){
    _sjStopTimer();
    _sjTimerFired  = false;
    _sjTimerTurnKey= _sjMakeTurnKey(state);
    // On utilise ts_turn comme référence pour rester synchronisé
    var refTs = (state.ts_turn || 0);
    var lagMs = refTs ? Math.min(Date.now() - refTs, SJ_TIMER_DURATION) : 0;
    _sjTimerStart = Date.now() - lagMs;

    var bar  = document.getElementById('sjTimerBar');
    var fill = document.getElementById('sjTimerBarFill');
    if(bar)  bar.classList.add('active');
    if(bar)  bar.classList.remove('danger');

    function tick(){
      var elapsed = Date.now() - _sjTimerStart;
      var ratio   = Math.max(0, 1 - elapsed / SJ_TIMER_DURATION);
      if(fill) fill.style.transform = 'scaleX(' + ratio + ')';
      if(bar){
        if(elapsed > SJ_TIMER_DURATION - 7000) bar.classList.add('danger');
        else                                    bar.classList.remove('danger');
      }
      if(elapsed >= SJ_TIMER_DURATION){ _sjStopTimer(); return; }
      _sjTimerRAF = setTimeout(tick, 100);
    }
    _sjTimerRAF = setTimeout(tick, 100);
  }

  function _sjStopTimer(){
    if(_sjTimerRAF){ clearTimeout(_sjTimerRAF); _sjTimerRAF=null; }
    var bar  = document.getElementById('sjTimerBar');
    var fill = document.getElementById('sjTimerBarFill');
    if(bar){  bar.classList.remove('active','danger'); }
    if(fill){ fill.style.transform='scaleX(1)'; }
  }

  // Clé unique par tour : empêche de rejouer si le state se re-poll
  function _sjMakeTurnKey(state){
    // En init1 : on inclut le nombre de cartes retournées pour relancer le timer après chaque flip
    if(state.phase === 'init1'){
      var myKey = _me + '_cards';
      var flipped = state[myKey] ? state[myKey].filter(function(c){return c.revealed;}).length : 0;
      return 'init1_' + _me + '_f' + flipped + '_r' + (state.round||1);
    }
    return (state.turn||'') + '_r' + (state.round||1) + '_ts' + (state.ts_turn||0);
  }

  // Gère le démarrage/arrêt du timer à chaque rendu
  function _sjHandleTimer(state, isMyTurn){
    if(!state) return;
    var phase = state.phase;

    // Hors phase active → pas de timer
    if(phase !== 'play' && phase !== 'init1'){ _sjStopTimer(); return; }

    // Phase init1 : timer pour MOI tant que je n'ai pas retourné mes 2 cartes
    if(phase === 'init1'){
      var myKey   = _me + '_cards';
      var myFlipped = state[myKey] ? state[myKey].filter(function(c){return c.revealed;}).length : 0;
      var key = _sjMakeTurnKey(state); // clé change à chaque flip (inclut le compte)
      if(myFlipped < 2){
        if(key !== _sjTimerTurnKey){ _sjStartMyTimer(state); }
      } else {
        _sjStopTimer();
      }
      return;
    }

    // Phase play
    var key = _sjMakeTurnKey(state);
    if(isMyTurn){
      if(key !== _sjTimerTurnKey){ _sjStartMyTimer(state); }
    } else {
      if(key !== _sjTimerTurnKey){ _sjStartOppTimer(state); }
    }
  }

  // Action automatique aléatoire complète
  function _sjAutoPlay(){
    if(!_gameState || !_mp) return;
    var state = _gameState;
    var phase = state.phase;

    // Phase init1 : retourner UNE carte cachée aléatoire (le timer se relancera si il en manque encore)
    if(phase === 'init1'){
      var myKey = _me + '_cards';
      var myFlipped = state[myKey] ? state[myKey].filter(function(c){return c.revealed;}).length : 0;
      if(myFlipped >= 2) return; // déjà fait
      var hidden = [];
      (state[myKey]||[]).forEach(function(c,i){ if(!c.revealed && !c.removed) hidden.push(i); });
      if(!hidden.length) return;
      var idx = hidden[Math.floor(Math.random() * hidden.length)];
      window.skyjoFlipInit(idx);
      // Si on n'en avait retourné aucune, après ce flip il en manquera encore 1 →
      // _doRenderState recevra le nouveau state avec flipped=1, _sjHandleTimer
      // détectera la nouvelle clé et relancera un timer de 25s pour la 2e carte.
      return;
    }

    if(phase !== 'play') return;

    // Phase must_flip : retourner une carte cachée
    if(state.must_flip === _me){
      var key2 = _me + '_cards';
      var hidden2 = [];
      (state[key2]||[]).forEach(function(c,i){ if(!c.revealed && !c.removed) hidden2.push(i); });
      if(!hidden2.length) return;
      window.skyjoFlipReveal(hidden2[Math.floor(Math.random() * hidden2.length)]);
      return;
    }

    if(state.turn !== _me) return;

    // Étape 1 : si on tient déjà une carte → replace ou discard
    if(state.held_card && state.held_card.holder === _me){
      _sjAutoStep2(state);
      return;
    }

    // Étape 1 : piocher depuis la pioche ou la défausse (50/50)
    if(Math.random() < 0.5 && state.discard && state.discard.length > 0){
      window.skyjoDrawFromDiscard();
    } else {
      window.skyjoDrawFromDeck();
    }

    // Étape 2 sera déclenchée à la mise à jour du state (held_card posé)
    // On marque qu'on doit jouer l'étape 2 automatiquement
    _sjAutoWaitHeld = true;
  }

  var _sjAutoWaitHeld = false; // flag : attendre held_card pour jouer étape 2
  var _sjAutoWaitFlip = false; // flag : attendre must_flip après un discard auto

  function _sjAutoStep2(state){
    _sjAutoWaitHeld = false;
    if(!state.held_card || state.held_card.holder !== _me) return;
    var key = _me + '_cards';
    var cards = state[key] || [];
    var heldVal = state.held_card.value;

    // Choisir : remplacer la carte avec la plus haute valeur, OU défausser
    var bestIdx = -1, bestVal = -Infinity;
    cards.forEach(function(c,i){
      if(!c.removed && c.value > bestVal){ bestVal = c.value; bestIdx = i; }
    });

    if(bestIdx >= 0 && heldVal < bestVal){
      window.skyjoReplaceCard(bestIdx);
    } else {
      // Défausse → after this state will have must_flip=_me, arm the flag
      _sjAutoWaitFlip = true;
      window.skyjoDiscardHeld();
    }
  }

  function _sjAutoFlip(state){
    _sjAutoWaitFlip = false;
    var key = _me + '_cards';
    var hidden = [];
    (state[key]||[]).forEach(function(c,i){ if(!c.revealed && !c.removed) hidden.push(i); });
    if(!hidden.length) return;
    var idx = hidden[Math.floor(Math.random() * hidden.length)];
    // Petit délai pour laisser l'animation de défausse se terminer
    setTimeout(function(){ window.skyjoFlipReveal(idx); }, 350);
  }

  // ─── Réactions ───────────────────────────────────────
  var _sjReactCooldown    = false;
  var _sjLastReactTs      = 0;
  var _sjMyBubbleTimer    = null;
  var _sjOppBubbleTimer   = null;

  window.skyjoToggleReactionPicker = function(e){
    if(e) e.stopPropagation();
    var picker = document.getElementById('sjReactPicker');
    if(!picker) return;
    picker.classList.toggle('open');
    if(picker.classList.contains('open')){
      // fermer au prochain clic extérieur
      setTimeout(function(){
        document.addEventListener('click', _sjClosePicker, { once: true });
      }, 0);
    }
  };

  function _sjClosePicker(){
    var picker = document.getElementById('sjReactPicker');
    if(picker) picker.classList.remove('open');
  }

  window.skyjoSendReaction = function(idx){
    _sjClosePicker();
    if(_sjReactCooldown || !_mp || !_gameState) return;

    // Afficher ma bulle immédiatement (optimiste)
    _sjShowBubble('me', idx);

    // Cooldown 3s
    _sjReactCooldown = true;
    var btn = document.getElementById('sjReactBtn');
    if(btn) btn.classList.add('sj-react-cooldown');
    setTimeout(function(){
      _sjReactCooldown = false;
      if(btn) btn.classList.remove('sj-react-cooldown');
    }, 3000);

    // Écrire dans le state Supabase
    var ns = deepCopy(_gameState);
    ns.reaction = { player: _me, idx: idx, ts: Date.now() };
    _mp.saveState(ns);
  };

  function _sjShowBubble(who, idx){
    var bubbleId = who === 'me' ? 'sjMyReactionBubble' : 'sjOppReactionBubble';
    var bubble   = document.getElementById(bubbleId);
    if(!bubble) return;
    var img = bubble.querySelector('img');
    if(!img) return;

    // Réinitialiser animation
    bubble.classList.remove('visible', 'hiding');
    void bubble.offsetWidth;
    img.src = 'assets/images/reaction_' + idx + '.png';
    img.alt = 'reaction ' + idx;
    // Forcer reflow pour rejouer l'animation
    img.style.animation = 'none';
    void img.offsetWidth;
    img.style.animation = '';

    bubble.classList.add('visible');

    // Annuler le précédent timer si besoin
    if(who === 'me'){
      if(_sjMyBubbleTimer) clearTimeout(_sjMyBubbleTimer);
      _sjMyBubbleTimer = setTimeout(function(){
        bubble.classList.add('hiding');
        setTimeout(function(){ bubble.classList.remove('visible','hiding'); }, 260);
      }, 3000);
    } else {
      if(_sjOppBubbleTimer) clearTimeout(_sjOppBubbleTimer);
      _sjOppBubbleTimer = setTimeout(function(){
        bubble.classList.add('hiding');
        setTimeout(function(){ bubble.classList.remove('visible','hiding'); }, 260);
      }, 3000);
    }
  }

  // Appelé dans _doRenderState pour détecter une réaction adverse
  function _sjCheckIncomingReaction(state){
    if(!state || !state.reaction) return;
    var r = state.reaction;
    if(!r.player || !r.idx || !r.ts) return;
    if(r.player === _me) return; // ma propre réaction, ignorer
    if(r.ts === _sjLastReactTs) return; // déjà affiché
    _sjLastReactTs = r.ts;
    _sjShowBubble('opp', r.idx);
  }

  // ─── Fin de partie ────────────────────────────────────
  function showGameEnd(state){
    document.getElementById('skyjoRoundEnd').style.display='none';
    var btn=document.getElementById('skyjoAbandonBtn');if(btn)btn.style.display='none';
    var gg=state.scores.girl,gb=state.scores.boy;
    var isDraw=gg===gb,girlWins=gg<gb;
    document.getElementById('skyjoGameEndEmoji').textContent=isDraw?'🤝':(girlWins?'👧':'👦');
    document.getElementById('skyjoGameEndTitle').textContent=isDraw?'Égalité !':(girlWins?(typeof v2GetDisplayName==='function'?v2GetDisplayName('girl')+' 👧':'Elle 👧'):(typeof v2GetDisplayName==='function'?v2GetDisplayName('boy')+' 👦':'Lui 👦'))+' gagne la partie !';
    var myFinal=_me==='girl'?gg:gb,oppFinal=_me==='girl'?gb:gg;
    document.getElementById('skyjoFinalScoreGirl').textContent=myFinal;
    document.getElementById('skyjoFinalScoreBoy').textContent=oppFinal;
    var fLblLeft=document.getElementById('skyjoFinalLabelLeft'),fLblRight=document.getElementById('skyjoFinalLabelRight');
    if(fLblLeft)fLblLeft.textContent=(typeof v2GetDisplayName==='function'?v2GetDisplayName(_me):(_me==='girl'?'Elle':'Lui'));
    if(fLblRight)fLblRight.textContent=(typeof v2GetDisplayName==='function'?v2GetDisplayName(_me==='girl'?'boy':'girl'):(_me==='girl'?'Lui':'Elle'));
    var fEmoLeft=document.getElementById('skyjoFinalEmojiLeft'),fEmoRight=document.getElementById('skyjoFinalEmojiRight');
    if(fEmoLeft)fEmoLeft.textContent=_me==='girl'?'👧':'👦';
    if(fEmoRight)fEmoRight.textContent=_me==='girl'?'👦':'👧';
    var cardG=document.getElementById('skyjoFinalScoreGirl').parentElement;
    var cardB=document.getElementById('skyjoFinalScoreBoy').parentElement;
    cardG.style.borderColor='';cardG.style.background='';
    cardB.style.borderColor='';cardB.style.background='';
    if(!isDraw){
      if(myFinal<oppFinal){cardG.style.borderColor='var(--green)';cardG.style.background='rgba(0,201,167,0.1)';}
      else{cardB.style.borderColor='var(--green)';cardB.style.background='rgba(0,201,167,0.1)';}
    }
    document.getElementById('skyjoGameEnd').style.display='flex';
    // Flamme — partie Skyjo ensemble terminée
    if(typeof window.yamFlameActivity==='function') window.yamFlameActivity('skyjo_together');
  }

  window.skyjoNewGame=function(){
    if(!_mp)return;
    _mp.stopPoll();
    var gameId=_mp.getGameId();
    if(!gameId)return;
    fetch(SB_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+gameId,{method:'DELETE',headers:sb2Headers()})
    .then(function(){
      document.getElementById('skyjoGameEnd').style.display='none';
      _mp.enterLobby();
    }).catch(function(){});
  };

  // ─── Expose pour bg-pause ─────────────────────────────
  window._skyjoRefreshRates   = function(){ if(_mp) _mp.refreshRates(); };
  window._skyjoDeletePresence = function(){ if(_mp) _mp.deletePresence(); };
  window._skyjoUpsertPresence = function(){ if(_mp) _mp.upsertPresence(); };
  window._skyjoMarkAbsence    = function(){ if(_mp) _mp.markAbsence(); };
  window._sjStopTimer         = function(){ if(typeof _sjStopTimer==='function') _sjStopTimer(); };

})();


/* ══════════════════════════════════════════════════════════════
   SKYJO — OPTIMISATION CPU : pause complète quand page cachée
   v3.6
══════════════════════════════════════════════════════════════ */
(function(){
  var _skyjoView=null;
  function getSkyjoView(){return _skyjoView||(_skyjoView=document.getElementById('skyjoView'));}

  var _skyjoViewObs=new MutationObserver(function(){
    getSkyjoView();
  });
  var sv=document.getElementById('skyjoView');
  if(sv) _skyjoViewObs.observe(sv,{attributes:true,attributeFilter:['class']});

  function isSkyjoActive(){ return sv?sv.classList.contains('active'):false; }

  function pauseSkyjo(){
    document.body.classList.add('skyjo-bg-paused');
    document.querySelectorAll('.sj-fly-clone, .sj-particle').forEach(function(el){el.style.animationPlayState='paused';});
    // ✅ FIX v3.7 : stoppe le RAF du timer IA (évite 60fps en arrière-plan)
    if(typeof window._sjStopTimer==='function') window._sjStopTimer();
    if(typeof window._skyjoDeletePresence==='function') window._skyjoDeletePresence();
    if(typeof window._skyjoRefreshRates==='function')   window._skyjoRefreshRates();
  }

  function resumeSkyjo(){
    document.body.classList.remove('skyjo-bg-paused');
    document.querySelectorAll('.sj-fly-clone, .sj-particle').forEach(function(el){el.style.animationPlayState='';});
    if(typeof window._skyjoUpsertPresence==='function') window._skyjoUpsertPresence();
    if(typeof window._skyjoRefreshRates==='function')   window._skyjoRefreshRates();
    // ✅ FIX v3.7 : relance le timer IA si une partie est en cours (le prochain fetchState s'en chargera)
  }

  document.addEventListener('visibilitychange',function(){
    if(!isSkyjoActive())return;
    if(document.hidden){pauseSkyjo();}else{resumeSkyjo();}
  });
  window.addEventListener('pagehide',function(){if(!isSkyjoActive())return;pauseSkyjo();});
  window.addEventListener('pageshow',function(e){if(!isSkyjoActive())return;if(!document.hidden)resumeSkyjo();});
  window.addEventListener('blur',function(){if(!isSkyjoActive())return;pauseSkyjo();});
  window.addEventListener('focus',function(){if(!isSkyjoActive())return;if(!document.hidden)resumeSkyjo();});

  console.log('⚡ [v3.6] Skyjo bg-pause: visibilitychange+pagehide+blur/focus installés');
  console.log('⚡ [v3.7] Skyjo perf: RAF timer→setTimeout 100ms, presencePoll core suspendu pendant la partie');
  console.log('⚡ [v3.8] Skyjo perf: updateCounter suspendu pendant la partie');
})();
