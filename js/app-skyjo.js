// app-skyjo.js — Skyjo multijoueur temps réel
// Extrait de app-games.js — Version 3.3 — Février 2026
// Dépendances (chargées avant) : app-core.js, app-account.js
// Globals utilisés : SB2_URL, sb2Headers(), getProfile(), v2GetDisplayName(),
//                    _yamSlide(), resetZoom(), showToast(), haptic()


/* ══════════════════════════════════════════════════════
   SKYJO — JEU DE CARTES MULTIJOUEUR (v3 - sync robuste)
══════════════════════════════════════════════════════ */
(function(){
  var SKYJO_TABLE    = 'v2_skyjo_games';
  var SKYJO_PRESENCE = 'v2_skyjo_presence';
  // ─── État global ──────────────────────────────────────
  var _gameId        = null;
  var _me            = null;   // 'girl' | 'boy'
  var _other         = null;
  var _gameState     = null;
  var _phase         = null;
  var _launched      = false;  // GARDE : empêche double launchGame

  var _presTimer     = null;
  var _lobbyTimer    = null;
  var _pollTimer     = null;
  var _saving        = false;  // verrou pendant PATCH

  var _oppGoneTimer  = null;   // délai de grâce avant popup "X a quitté"
  var OPP_GRACE_MS   = 20000;  // 20s avant de considérer la déco comme définitive

  // ─── Deck ────────────────────────────────────────────
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

  // ─── Affichage écrans ────────────────────────────────
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
      // Calcul taille cartes : tout doit tenir sans scroll
      requestAnimationFrame(function(){
        var vw = window.innerWidth;
        var vh = window.innerHeight;

        // Hauteurs fixes estimées (on mesure après rendu si possible)
        var headerEl = document.querySelector('#skyjoView .game-view-header');
        var bannerEl = document.getElementById('skyjoTurnBanner');
        var headerH  = headerEl ? headerEl.offsetHeight : 38;
        var bannerH  = bannerEl ? bannerEl.offsetHeight : 28;
        var midH     = 64;  // zone centrale (pioche/défausse) en px
        var phaseH   = 0;   // message phase (souvent caché)
        var infoH    = 30;  // ligne avatar+nom par zone joueur × 2 = 60
        var gapH     = 16;  // gaps et paddings divers

        var safeB  = 4; // safe-area approx réduite pour remonter la zone de jeu
        var availH = vh - headerH - bannerH - midH - phaseH - (infoH*2) - gapH - safeB;
        // availH = espace pour 6 rangées de cartes (2 grilles × 3 rangées)
        var cardH = Math.floor((availH - 5*4) / 6); // 5 gaps de 4px

        // Contrainte largeur : 4 cartes + 3 gaps de 4px + paddings latéraux 16px
        var maxByW = Math.floor((vw - 16 - 3*4) / 4);
        var cardW  = Math.floor(cardH / 1.42);
        if(cardW > maxByW){ cardW = maxByW; cardH = Math.floor(cardW * 1.42); }

        // Bornes de sécurité
        cardH = Math.min(58, Math.max(34, cardH));
        cardW = Math.min(41, Math.max(24, cardW));
        var fs = Math.max(10, Math.min(16, Math.floor(cardW * 0.4)));

        document.documentElement.style.setProperty('--sj-cw', cardW+'px');
        document.documentElement.style.setProperty('--sj-ch', cardH+'px');
        document.documentElement.style.setProperty('--sj-fs', fs+'px');
      });
    } else {
      el.style.display='flex';
    }
  }

  // ─── Reset complet de l'état ─────────────────────────
  function resetState(){
    _gameId=null;
    _gameState=null;
    _phase=null;
    _launched=false;
    _waitingNextRound=false;
    _roundEndShown=false;
    _bothAbsentHandled=false;
    _lastPresenceSent=0;
    _absenceStart=0;
    window._sjLastSeenLiveTs = 0;
    _sjAnimPlaying = false;
    _sjPendingRenderRow = null;
    if(_oppGoneTimer){clearTimeout(_oppGoneTimer);_oppGoneTimer=null;}
  }

  // ─── Stop tous les timers ────────────────────────────
  function stopAll(){
    if(_presTimer){clearInterval(_presTimer);_presTimer=null;}
    if(_lobbyTimer){clearInterval(_lobbyTimer);_lobbyTimer=null;}
    if(_pollTimer){clearInterval(_pollTimer);_pollTimer=null;}
    if(_oppGoneTimer){clearTimeout(_oppGoneTimer);_oppGoneTimer=null;}
  }

  // ─── Présence ────────────────────────────────────────
  function startPresence(){
    upsertPresence();
    var interval = document.hidden ? 30000 : 4000;
    _presTimer=setInterval(upsertPresence, interval);
  }
  function _refreshPresenceRate(){
    // Au retour au premier plan : retarder le premier heartbeat de 3s
    // pour laisser fetchState() lire les vrais timestamps Supabase (figés pendant l'absence)
    // avant qu'upsertPresence() les écrase avec now().
    if(!document.hidden && _presTimer){
      clearInterval(_presTimer); _presTimer = null;
      setTimeout(function(){
        if(!_me) return;
        upsertPresence();
        _presTimer = setInterval(upsertPresence, 4000);
      }, 3000);
    }
  }
  var _lastPresenceSent = 0; // timestamp local du dernier heartbeat envoyé
  var _absenceStart     = 0; // heure exacte où on a quitté la page (visibilitychange)

  function upsertPresence(){
    if(!_me) return;
    if(document.hidden) return; // page cachée → updated_at gèle dans Supabase, détection d'absence OK
    _lastPresenceSent = Date.now();
    // ✅ FIX: Ajouter couple_id pour isoler la présence par couple
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId) return;
    function doPost(){
      fetch(SB2_URL+'/rest/v1/'+SKYJO_PRESENCE,{
        method:'POST',
        headers:sb2Headers({'Prefer':'resolution=merge-duplicates,return=minimal'}),
        body:JSON.stringify({profile:_me,couple_id:coupleId,updated_at:new Date().toISOString()})
      }).catch(function(){});
    }
    // Présence via SB2 — pas besoin de sbLogin, sb2Headers est suffisant
    doPost();
  }
  function deletePresence(){
    if(!_me) return;
    // ✅ FIX: Filtrer par couple_id ET profile pour supprimer uniquement sa propre présence
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId) return;
    // keepalive:true → survit à la fermeture de page (pagehide)
    fetch(SB2_URL+'/rest/v1/'+SKYJO_PRESENCE+'?couple_id=eq.'+coupleId+'&profile=eq.'+_me,{
      method:'DELETE', headers:sb2Headers(), keepalive:true
    }).catch(function(){});
  }

  // ─── Lock + Ouverture ────────────────────────────────
  window.openSkyjoLock = function(){
    var profile=getProfile();
    resetZoom();
    particleActive=false; hideDance(); window.scrollTo(0,0);
    if(profile){
      // Session V2 active — ouverture directe
      _openSkyjoWithProfile(profile);
    } else {
      document.getElementById('skyjoAuthModal').style.display='flex';
    }
  };

  window.skyjoAuthSelect = function(profile){
    document.getElementById('skyjoAuthModal').style.display='none';
    // v2 : session active → entrée directe
    if(typeof v2LoadSession === 'function' && v2LoadSession()){
      if(window._profileSave) window._profileSave(profile);
      if(window._profileApply) window._profileApply(profile);
      _openSkyjoWithProfile(profile);
    } else {
      // Pas de session v2 → rediriger vers login
      if(window.v2ShowLogin) window.v2ShowLogin();
    }
  };

  window.skyjoAuthClose = function(){
    document.getElementById('skyjoAuthModal').style.display='none';
  };

  function _openSkyjoWithProfile(profile){
    _yamSlide(document.getElementById('skyjoView'), document.getElementById('gamesView'), 'forward');
    document.querySelector('.bottom-nav').style.display='none';
    enterLobby();
  }

  // ─── Lobby ───────────────────────────────────────────
  function enterLobby(){
    stopAll();
    resetState();
    _me   =getProfile();
    _other=_me==='girl'?'boy':'girl';
    var myName=(typeof v2GetDisplayName==="function"?v2GetDisplayName(_me):(_me==="girl"?"Elle":"Lui"));
    var otherName=(typeof v2GetDisplayName==="function"?v2GetDisplayName(_me==="girl"?"boy":"girl"):(_me==="girl"?"Lui":"Elle"));

    // ✅ FIX: Récupérer couple_id pour filtrer les requêtes
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId) {
      showScreen('skyjoWaitScreen');
      document.getElementById('skyjoWaitMsg').innerHTML='❌ Session expirée — reconnectez-vous';
      return;
    }

    // Vérifier partie playing ET présence en même temps
    Promise.all([
      fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?couple_id=eq.'+coupleId+'&status=eq.playing&order=created_at.desc&limit=1&select=id,status,state,created_by',{headers:sb2Headers()}).then(function(r){return r.json();}),
      fetch(SB2_URL+'/rest/v1/'+SKYJO_PRESENCE+'?couple_id=eq.'+coupleId+'&select=profile',{headers:sb2Headers()}).then(function(r){return r.json();})
    ])
    .then(function(results){
      var rows          = results[0];
      var presRows      = results[1];
      var presenceEmpty = !Array.isArray(presRows) || presRows.length === 0;

      if(Array.isArray(rows) && rows[0]){
        if(presenceEmpty){
          // Partie fantôme (plus personne présent) → supprimer et aller en attente
          fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+rows[0].id,{
            method:'DELETE', headers:sb2Headers()
          }).catch(function(){});
        } else {
          // Partie valide ET joueur(s) présent(s) → rejoindre
          _gameId = rows[0].id;
          _launched = true;
          startPresence();
          showScreen('skyjoGameArea');
          var btn=document.getElementById('skyjoAbandonBtn');
          if(btn) btn.style.display='block';
          renderState(rows[0]);
          startPoll();
          return;
        }
      }
      // Pas de partie valide → salle d'attente
      showScreen('skyjoWaitScreen');
      document.getElementById('skyjoWaitMsg').innerHTML=
        'Connecté en tant que <strong>'+myName+'</strong>.<br>En attente que <strong>'+otherName+'</strong> rejoigne…';
      cleanMyOldGames(function(){
        startPresence();
        startLobbyPoll();
      });
    })
    .catch(function(){
      // En cas d'erreur réseau → salle d'attente normale
      showScreen('skyjoWaitScreen');
      document.getElementById('skyjoWaitMsg').innerHTML=
        'Connecté en tant que <strong>'+myName+'</strong>.<br>En attente que <strong>'+otherName+'</strong> rejoigne…';
      cleanMyOldGames(function(){
        startPresence();
        startLobbyPoll();
      });
    });
  }

  // Nettoyer les vieilles parties "waiting" créées par moi (évite qu'on rejoigne une vieille partie)
  function cleanMyOldGames(cb){
    // ✅ FIX: Filtrer par couple_id pour ne supprimer que mes propres parties de mon couple
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId) { if(cb)cb(); return; }
    fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?couple_id=eq.'+coupleId+'&status=eq.waiting&created_by=eq.'+_me,{
      method:'DELETE',headers:sb2Headers()
    }).then(function(){if(cb)cb();}).catch(function(){if(cb)cb();});
  }

  window.skyjoLeaveWait=function(){
    stopAll();
    deletePresence();
    cleanMyOldGames(null);
    resetState();
    _yamSlide(document.getElementById('gamesView'), document.getElementById('skyjoView'), 'backward');
    document.querySelector('.bottom-nav').style.display='';
  };

  // ─── Lobby Poll ──────────────────────────────────────
  function startLobbyPoll(){
    lobbyTick();
    _lobbyTimer=setInterval(lobbyTick,2500);
  }

  function lobbyTick(){
    // Si déjà lancé, stopper le lobby
    if(_launched){stopAll();return;}

    // Cas 1 : on a déjà un gameId → surveiller si ça passe à playing
    if(_gameId){
      fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+_gameId+'&select=id,status,state,created_by',{
        headers:sb2Headers()
      })
      .then(function(r){return r.json();})
      .then(function(rows){
        if(_launched) return; // double-check
        if(!Array.isArray(rows)||!rows[0]) return;
        var g=rows[0];
        updateDots(true,true);
        if(g.status==='playing') launchGame(g);
      }).catch(function(){});
      return;
    }

    // Cas 2 : vérifier présences
    // ✅ FIX: Filtrer par couple_id pour ne voir que les présences de mon couple
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId) return;
    fetch(SB2_URL+'/rest/v1/'+SKYJO_PRESENCE+'?couple_id=eq.'+coupleId+'&select=profile,updated_at',{
      headers:sb2Headers()
    })
    .then(function(r){return r.json();})
    .then(function(rows){
      if(_launched) return;
      if(!Array.isArray(rows)) return;
      var now=Date.now();
      var girlOk=false,boyOk=false;
      rows.forEach(function(row){
        if(now-new Date(row.updated_at).getTime()<10000){
          if(row.profile==='girl') girlOk=true;
          if(row.profile==='boy')  boyOk=true;
        }
      });
      updateDots(girlOk,boyOk);
      if(girlOk&&boyOk) doMatchmaking();
    }).catch(function(){});
  }

  function updateDots(g,b){
    var dg=document.getElementById('skyjoPresenceGirl');
    var db=document.getElementById('skyjoPresenceBoy');
    if(dg) dg.className='skyjo-presence-dot'+(g?' online':'');
    if(db) db.className='skyjo-presence-dot'+(b?' online':'');
  }

  // ─── Matchmaking ─────────────────────────────────────
  // Convention STRICTE pour éviter toute race condition :
  //   → "girl" est TOUJOURS la créatrice de la partie
  //   → "boy" rejoint TOUJOURS
  // Cela évite complètement les cas B/C ambigus et les doubles créations.
  function doMatchmaking(){
    if(_launched) return;

    // ✅ FIX: Filtrer par couple_id pour ne voir que les parties de mon couple
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId) return;

    fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?couple_id=eq.'+coupleId+'&status=in.(waiting,playing)&order=created_at.desc&limit=1&select=id,status,state,created_by',{
      headers:sb2Headers()
    })
    .then(function(r){return r.json();})
    .then(function(rows){
      if(_launched) return;
      var game=Array.isArray(rows)&&rows.length>0?rows[0]:null;

      // Une partie playing existe → tout le monde la rejoint
      if(game&&game.status==='playing'){
        _gameId=game.id;
        launchGame(game);
        return;
      }

      // Une partie waiting existe
      if(game&&game.status==='waiting'){
        if(game.created_by===_me){
          // C'est MA partie → je stocke l'id et j'attends (lobbyTick cas 1)
          _gameId=game.id;
          return;
        } else {
          // C'est la partie de l'autre → je la rejoins (PATCH conditionnel anti-race)
          _gameId=game.id;
          fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+game.id+'&status=eq.waiting',{
            method:'PATCH',
            headers:sb2Headers({'Prefer':'return=representation'}),
            body:JSON.stringify({status:'playing'})
          })
          .then(function(r){return r.json();})
          .then(function(updated){
            if(_launched) return;
            if(!Array.isArray(updated)||!updated[0]){
              // Race : quelqu'un d'autre a déjà patché → au prochain tick on verra playing
              return;
            }
            launchGame(updated[0]);
          }).catch(function(){});
          return;
        }
      }

      // Aucune partie → créer (les deux peuvent créer, mais cleanMyOldGames + convention
      // font que la girl a probablement déjà nettoyé → girl crée, boy attend et rejoint)
      if(!game){
        createNewGame();
      }
    }).catch(function(){});
  }

  function createNewGame(){
    if(_launched||_gameId) return; // évite double création
    // ✅ FIX: Ajouter couple_id pour isoler les parties par couple
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId) return;
    var deck=buildDeck();
    var gc=dealHand(deck),bc=dealHand(deck);
    var top=deck.pop();
    var state={
      deck:deck,discard:[top],
      girl_cards:gc,boy_cards:bc,
      phase:'init1',turn:null,
      round:1,scores:{girl:0,boy:0},
      held_card:null,must_flip:null,last_player:null,round_closer:null
    };
    fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE,{
      method:'POST',
      headers:sb2Headers({'Prefer':'return=representation'}),
      body:JSON.stringify({couple_id:coupleId,status:'waiting',created_by:_me,state:state})
    })
    .then(function(r){return r.json();})
    .then(function(rows){
      if(Array.isArray(rows)&&rows[0]&&!_launched) _gameId=rows[0].id;
    }).catch(function(){});
  }

  // ─── Lancement en jeu ────────────────────────────────
  function launchGame(gameRow){
    if(_launched) return;
    _launched=true;
    _gameId=gameRow.id;
    // Stopper lobby + ancien poll, mais CONSERVER le heartbeat de présence (_presTimer)
    // pour que l'adversaire puisse voir si on est en ligne pendant la partie
    if(_lobbyTimer){clearInterval(_lobbyTimer);_lobbyTimer=null;}
    if(_pollTimer){clearInterval(_pollTimer);_pollTimer=null;}
    // Si le heartbeat n'est pas encore actif (ex: rejoindre une partie en cours), le démarrer
    if(!_presTimer){ upsertPresence(); _presTimer=setInterval(upsertPresence,4000); }
    showScreen('skyjoGameArea');
    var btn=document.getElementById('skyjoAbandonBtn');
    if(btn) btn.style.display='block';
    renderState(gameRow);
    startPoll();
  }

  // ─── Poll état jeu ───────────────────────────────────
  function startPoll(){
    if(_pollTimer){clearInterval(_pollTimer);_pollTimer=null;}
    var interval = document.hidden ? 15000 : 2000; // ralenti si page cachée
    _pollTimer=setInterval(fetchState, interval);
  }
  function _refreshPollRate(){
    // Ne pas bloquer si _pollTimer est null (stopPoll() a pu être appelé par oppGoneTimer)
    var newInterval = document.hidden ? 15000 : 2000;
    if(_pollTimer){ clearInterval(_pollTimer); _pollTimer=null; }
    if(!document.hidden && _launched){
      // Retour au premier plan : fetchState IMMÉDIAT d'abord (avant que le heartbeat
      // ne remette updated_at à now() et empêche la détection bothAbsent),
      // puis on relance le poll normal.
      fetchState();
      _pollTimer = setInterval(fetchState, newInterval);
    }
  }
  var BOTH_ABSENT_TIMEOUT_MS = 40000; // 40s sans heartbeat des deux = clôture
  var _bothAbsentHandled = false; // évite double déclenchement

  function fetchState(){
    if(!_gameId||_saving) return;
    var oppKey = _me==='girl' ? 'boy' : 'girl';
    // ✅ FIX: Filtrer présences par couple_id
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId) return;
    Promise.all([
      fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+_gameId+'&select=id,status,state,created_by',{headers:sb2Headers()}).then(function(r){return r.json();}),
      fetch(SB2_URL+'/rest/v1/'+SKYJO_PRESENCE+'?couple_id=eq.'+coupleId+'&select=profile,updated_at',{headers:sb2Headers()}).then(function(r){return r.json();})
    ])
    .then(function(results){
      if(_saving) return;
      var rows     = results[0];
      var allPres  = results[1]; // toutes les présences
      // Séparer présence opp et moi
      var presRows = Array.isArray(allPres) ? allPres.filter(function(p){ return p.profile===oppKey; }) : [];
      var myPresRows= Array.isArray(allPres) ? allPres.filter(function(p){ return p.profile===_me; })  : [];

      // Mettre à jour le dot de présence adversaire
      var dot = document.getElementById('skyjoOppPresenceDot');
      var isOnline = Array.isArray(presRows) && presRows[0] &&
        (Date.now() - new Date(presRows[0].updated_at).getTime()) < 15000;
      if(dot){
        dot.style.background = isOnline ? '#22c55e' : '#555';
        dot.style.boxShadow  = isOnline ? '0 0 5px rgba(34,197,94,0.7)' : 'none';
        dot.title            = isOnline ? 'En ligne' : 'Hors ligne';
      }

      // ── Les DEUX joueurs absents depuis +40s → clôture automatique ─────
      var now = Date.now();
      // Pour les deux : Supabase = source de vérité.
      // upsertPresence() est retardé de 3s au retour (voir _refreshPresenceRate)
      // pour laisser fetchState() lire les vrais timestamps avant qu'ils soient écrasés.
      var myLastSeen = myPresRows[0]
        ? now - new Date(myPresRows[0].updated_at).getTime()
        : 99999999;
      // Pour l'adversaire : Supabase est la seule source possible
      var oppLastSeen = presRows[0]
        ? now - new Date(presRows[0].updated_at).getTime()
        : 99999999;
      var bothAbsent  = myLastSeen > BOTH_ABSENT_TIMEOUT_MS && oppLastSeen > BOTH_ABSENT_TIMEOUT_MS;

      if(bothAbsent && !_bothAbsentHandled && _launched){
        _bothAbsentHandled = true;
        stopAll();
        var gid = _gameId;
        resetState();
        // Supprimer la partie côté Supabase
        if(gid){
          fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+gid,{
            method:'DELETE', headers:sb2Headers()
          }).catch(function(){});
        }
        // ✅ FIX: Supprimer uniquement les présences de ce couple (pas toutes)
        fetch(SB2_URL+'/rest/v1/'+SKYJO_PRESENCE+'?couple_id=eq.'+coupleId,{
          method:'DELETE', headers:sb2Headers()
        }).catch(function(){});
        // Afficher le message puis retour au lobby
        showSkyjoAlert('⏱️', 'Partie expirée — les deux joueurs étaient absents', function(){
          _bothAbsentHandled = false;
          enterLobby();
        });
        return;
      }

      // ── Adversaire hors-ligne : démarrer le timer de grâce ────────────
      if(!isOnline && !_waitingForReconnect && !_oppGoneTimer && !document.getElementById('skyjoWaitModal') && !document.getElementById('skyjoCountdownModal')){
        _oppGoneTimer = setTimeout(function(){
          _oppGoneTimer = null;
          if(!_launched) return;
          if(_waitingForReconnect) return;
          if(document.getElementById('skyjoWaitModal') || document.getElementById('skyjoCountdownModal')) return;
          // On NE stoppe PAS le poll ici — il doit continuer à tourner
          // pour que fetchState() puisse détecter bothAbsent à 40s.
          // Le popup s'affiche à 20s mais le poll reste actif en arrière-plan.
          var oppName = (typeof v2GetDisplayName==="function"?v2GetDisplayName(_me==="girl"?"boy":"girl"):(_me==="girl"?"Lui":"Elle"));
          showSkyjoChoice(
            '😔',
            oppName+' est déconnecté(e)',
            'Connexion perdue. Tu peux attendre son retour ou quitter la partie.',
            'Attendre',
            function(){
              _waitingForReconnect = true;
              startPoll();
              startReconnectWait();
            },
            'Quitter',
            function(){
              _waitingForReconnect = false;
              stopAll();
              resetState();
              document.getElementById('skyjoView').classList.remove('active');
              document.querySelector('.bottom-nav').style.display='';
            }
          );
        }, OPP_GRACE_MS);
      }

      // ── Adversaire revenu en ligne : annuler le timer de grâce ────────
      // Ne pas annuler si on est déjà en mode "Attendre" (compte à rebours en cours)
      if(isOnline && _oppGoneTimer && !_waitingForReconnect){
        clearTimeout(_oppGoneTimer);
        _oppGoneTimer = null;
      }

      // ── Abandon volontaire : status = 'abandoned' ──────────────────────
      if(Array.isArray(rows) && rows[0] && rows[0].status === 'abandoned'){
        stopPoll();
        stopReconnectWait();
        _waitingForReconnect = false;
        if(_oppGoneTimer){clearTimeout(_oppGoneTimer);_oppGoneTimer=null;}
        var wm = document.getElementById('skyjoCountdownModal') || document.getElementById('skyjoWaitModal');
        if(wm) document.body.removeChild(wm);
        resetState();
        showSkyjoAlert('🏳️', 'Partie abandonnée', function(){ enterLobby(); });
        return;
      }

      // ── Partie introuvable (supprimée) ────────────────────────────────
      if(!Array.isArray(rows)||!rows[0]){
        if(_waitingForReconnect) return; // le compte à rebours gère la suite
        return; // déjà géré par le timer de présence
      }

      // ── Partie retrouvée : si on attendait une reconnexion → reprendre
      // SEULEMENT si l'adversaire est vraiment revenu en ligne
      if(_waitingForReconnect){
        if(!isOnline) return; // partie toujours là mais adv toujours absent → on attend
        _waitingForReconnect = false;
        stopReconnectWait();
        var wb = document.getElementById('skyjoCountdownModal');
        if(wb) document.body.removeChild(wb);
      }
      // Si boy attendait la manche suivante et que la phase est init1 → reprendre
      if(_waitingNextRound && rows[0].state && rows[0].state.phase==='init1'){
        _waitingNextRound=false;
        _roundEndShown=false;
        document.getElementById('skyjoRoundEnd').style.display='none';
      }
      renderState(rows[0]);
    }).catch(function(){});
  }
  function stopPoll(){if(_pollTimer){clearInterval(_pollTimer);_pollTimer=null;}}

  // ─── Rendu ───────────────────────────────────────────
  var _sjAnimPlaying = false;
  var _sjPendingRenderRow = null;

  function _sjAnimDone(){
    _sjAnimPlaying = false;
    if(_sjPendingRenderRow){
      var row = _sjPendingRenderRow;
      _sjPendingRenderRow = null;
      _doRenderState(row);
    }
  }

  function renderState(gameRow){
    // Si une animation live est en cours, mettre en attente et ne pas couper l'animation
    if(_sjAnimPlaying){
      _sjPendingRenderRow = gameRow;
      return;
    }
    _doRenderState(gameRow);
  }

  function _doRenderState(gameRow){
    var state=gameRow.state;
    if(!state) return;
    var prevState = _gameState;
    _gameState=state;
    _phase=state.phase;

    var myCards  =_me==='girl'?state.girl_cards:state.boy_cards;
    var oppCards =_me==='girl'?state.boy_cards:state.girl_cards;
    var myName   =(typeof v2GetDisplayName==="function"?v2GetDisplayName(_me):(_me==="girl"?"Elle":"Lui"));
    var oppName  =(typeof v2GetDisplayName==="function"?v2GetDisplayName(_me==="girl"?"boy":"girl"):(_me==="girl"?"Lui":"Elle"));
    var isMyTurn =state.turn===_me;
    var iHoldCard=state.held_card&&state.held_card.holder===_me;

    // Détecter si le tour vient de changer (pour animer la bannière)
    var prevTurn = prevState ? prevState.turn : null;
    var turnChanged = prevTurn !== state.turn;

    // Si le tour vient de passer à moi, attendre 1s pour laisser les animations adversaire se terminer
    if(turnChanged && isMyTurn && prevTurn !== null){
      setTimeout(function(){ _doRenderState(gameRow); }, 1000);
      return;
    }

    // Détecter si le tour vient de passer à moi → masquer la carte en main opp
    if(turnChanged && isMyTurn){
      var _ohw = document.getElementById('skyjoOppHeldWrap');
      if(_ohw) _ohw.classList.remove('sj-held-visible');
    }

    // Détecter si une nouvelle carte est arrivée en main
    var prevHeld = prevState ? (prevState.held_card && prevState.held_card.holder===_me) : false;
    var newHeld  = iHoldCard && !prevHeld;

    // Détecter si la défausse a changé
    var prevDiscard = prevState && prevState.discard && prevState.discard.length > 0 ? prevState.discard[prevState.discard.length-1] : null;
    var newDiscardTop = state.discard && state.discard.length > 0 ? state.discard[state.discard.length-1] : null;
    var discardChanged = prevDiscard !== newDiscardTop;

    // Scores : affecter selon le rôle (_me = profil local)
    // skyjoScoreGirl est dans la zone-opp, skyjoScoreBoy dans zone-me
    // → si _me==='girl' : moi=boy-slot, adversaire=girl-slot → INVERSÉ
    // On corrige : myScore dans zone-me, oppScore dans zone-opp
    var myScore  = state.scores[_me];
    var oppScore = state.scores[_me==='girl'?'boy':'girl'];
    document.getElementById('skyjoScoreBoy').textContent=myScore;   // zone-me  (bas)
    document.getElementById('skyjoScoreGirl').textContent=oppScore; // zone-opp (haut)
    document.getElementById('skyjoRound').textContent=state.round||1;
    // Score de la manche précédente — lu depuis state.round_scores (persisté en base, visible pour les deux)
    var lrBadge = document.getElementById('skyjoLastRoundBadge');
    if(lrBadge && state.round_scores && (state.round||1) > 1){
      lrBadge.textContent = 'Préc. 👧'+state.round_scores.girl+' | 👦'+state.round_scores.boy;
      lrBadge.style.display='block';
    } else if(lrBadge){
      lrBadge.style.display='none';
    }
    // Noms et avatars selon le rôle
    var myAvEl=document.getElementById('skyjoAvatarMe');
    var oppAvEl=document.getElementById('skyjoAvatarOpp');
    var myLbEl=document.getElementById('skyjoMyLabel');
    var oppLbEl=document.getElementById('skyjoOpponentLabel');
    if(myAvEl)  myAvEl.textContent  = _me==='girl'?'👧':'👦';
    if(oppAvEl) oppAvEl.textContent = _me==='girl'?'👦':'👧';
    if(myLbEl)  myLbEl.textContent  = myName;
    if(oppLbEl) oppLbEl.textContent = oppName;
    // Label carte en main adversaire
    var oppHeldLbl = document.getElementById('skyjoOppHeldLabel');
    if(oppHeldLbl) oppHeldLbl.textContent = 'En main – ' + oppName;
    // ── Pulse doré sur l'avatar du joueur actif ──
    var myAvEl2  = document.getElementById('skyjoAvatarMe');
    var oppAvEl2 = document.getElementById('skyjoAvatarOpp');
    var phase2   = state.phase;
    var myTurnActive  = isMyTurn && (phase2==='play'||phase2==='init1');
    var oppTurnActive = !isMyTurn && phase2==='play';
    if(myAvEl2){
      if(myTurnActive) myAvEl2.classList.add('active-turn');
      else myAvEl2.classList.remove('active-turn');
    }
    if(oppAvEl2){
      if(oppTurnActive) oppAvEl2.classList.add('active-turn');
      else oppAvEl2.classList.remove('active-turn');
    }
    // ── Highlight de zone active (fond respirant) ──
    var zoneMe  = document.querySelector('.skyjo-player-zone.zone-me');
    var zoneOpp = document.querySelector('.skyjo-player-zone.zone-opp');
    if(zoneMe){
      if(myTurnActive) zoneMe.classList.add('active-zone');
      else             zoneMe.classList.remove('active-zone');
    }
    if(zoneOpp){
      if(oppTurnActive) zoneOpp.classList.add('active-zone');
      else              zoneOpp.classList.remove('active-zone');
    }
    // ── Badge de tour dans le slot central (à droite de la défausse) ──
    var badgeSlot = document.getElementById('skyjoTurnBadgeSlot');
    if(badgeSlot){
      badgeSlot.innerHTML = '';
      if(myTurnActive){
        var b = document.createElement('div');
        b.className = 'sj-your-turn-badge';
        b.innerHTML = '<span class="sj-badge-icon">⬇️</span>TON<br>TOUR';
        badgeSlot.appendChild(b);
      } else if(oppTurnActive){
        var b2 = document.createElement('div');
        b2.className = 'sj-their-turn-badge';
        b2.innerHTML = '<span class="sj-badge-icon">⬆️</span>Son<br>tour…';
        badgeSlot.appendChild(b2);
      }
    }

    // ── Totaux cartes révélées ──
    var myRevTotal  = myCards.reduce(function(s,c){ return c.revealed&&!c.removed ? s+c.value : s; }, 0);
    var oppRevTotal = oppCards.reduce(function(s,c){ return c.revealed&&!c.removed ? s+c.value : s; }, 0);
    var myTotEl  = document.getElementById('skyjoMyTotal');
    var oppTotEl = document.getElementById('skyjoOppTotal');
    if(myTotEl)  myTotEl.textContent  = myRevTotal;
    if(oppTotEl) oppTotEl.textContent = oppRevTotal;

    // Bannière de tour — grosse et claire
    var banner=document.getElementById('skyjoTurnBanner');
    var newBannerClass, newBannerText;
    if(state.phase==='init1'){
      newBannerText='🃏 Phase d\'initialisation — retourne 2 cartes';
      newBannerClass='skyjo-turn-banner my-turn';
    } else if(isMyTurn){
      if(state.must_flip===_me){
        newBannerText='👆 Retourne une carte cachée de ta grille';
      } else if(iHoldCard){
        newBannerText='🃏 Place ta carte sur ta grille (ou défausse)';
      } else {
        newBannerText='🎯 C\'est ton tour — pioche une carte !';
      }
      newBannerClass='skyjo-turn-banner my-turn';
    } else {
      newBannerText='⏳ Tour de '+oppName+'…';
      newBannerClass='skyjo-turn-banner their-turn';
    }
    banner.textContent = newBannerText;
    if(banner.className !== newBannerClass || turnChanged){
      banner.className = newBannerClass;
      if(turnChanged){
        sjAnimBanner(banner, newBannerClass.indexOf('my-turn') >= 0);
      }
    }
    document.getElementById('skyjoOpponentLabel').textContent='Grille de '+oppName;

    // Défausse — animation si la carte du dessus a changé
    var discardEl=document.getElementById('skyjoDiscardCard');
    var top=state.discard&&state.discard.length>0?state.discard[state.discard.length-1]:null;
    if(top!==null&&top!==undefined){
      discardEl.innerHTML='<div class="sj-pip-top">'+top+'</div><span class="sj-num">'+top+'</span><div class="sj-pip-bot">'+top+'</div>';discardEl.setAttribute('data-val',top);discardEl.classList.remove('skyjo-card-back');
      if(discardChanged){
        discardEl.classList.remove('sj-discard-slide');
        void discardEl.offsetWidth;
        discardEl.classList.add('sj-discard-slide');
        setTimeout(function(){ discardEl.classList.remove('sj-discard-slide'); }, 380);
      }
    } else {
      discardEl.textContent='—';discardEl.removeAttribute('data-val');
    }
    document.getElementById('skyjoDrawPileCount').textContent=(state.deck?state.deck.length:0)+' cartes';

    // ── Pulse pioche & défausse : uniquement quand c'est mon tour ET que je n'ai pas encore pioché ──
    var deckEl2    = document.getElementById('skyjoDeckCard');
    var discardEl2 = document.getElementById('skyjoDiscardCard');
    // Condition : mon tour, phase play, pas de carte en main, pas de must_flip
    var canPickFromPiles = isMyTurn && state.phase==='play' && !iHoldCard && state.must_flip!==_me;
    if(deckEl2){
      if(canPickFromPiles) deckEl2.classList.add('sj-selectable');
      else                 deckEl2.classList.remove('sj-selectable');
    }
    if(discardEl2){
      // La défausse n'est sélectionnable que si elle a une carte (pas vide)
      var discardHasCard = state.discard && state.discard.length > 0;
      if(canPickFromPiles && discardHasCard) discardEl2.classList.add('sj-selectable');
      else                                   discardEl2.classList.remove('sj-selectable');
    }

    // ── Live spectateur : animations du tour adversaire ──────────────────
    var oppKey2    = _me==='girl' ? 'boy' : 'girl';
    var prevLive   = prevState ? prevState.live : null;
    var curLive    = state.live;
    var oppHeldWrap= document.getElementById('skyjoOppHeldWrap');
    var oppHeldEl  = document.getElementById('skyjoOppHeldCard');
    var deckElLv   = document.getElementById('skyjoDeckCard');
    var discardElLv= document.getElementById('skyjoDiscardCard');

    // L'adversaire tient une carte (état stable, pas d'animation)
    var oppHoldsCard = state.held_card && state.held_card.holder === oppKey2;

    // Nouveau signal live de l'adversaire ?
    // On compare au dernier ts VU (indépendant de prevState) pour ne jamais rater le signal
    if(!window._sjLastSeenLiveTs) window._sjLastSeenLiveTs = 0;
    var isNewLive = curLive && curLive.ts && curLive.ts !== window._sjLastSeenLiveTs;
    console.log('[SKYJO-LIVE] isNewLive='+isNewLive+' isMyTurn='+isMyTurn+' curLive=',curLive);

    // ── Pré-calcul des rects AVANT renderGrid (les éléments existent encore) ──
    var _pendingLiveAnim = null;
    if(isNewLive && curLive.player && curLive.player === oppKey2){
      var lv = curLive;
      window._sjLastSeenLiveTs = lv.ts;
      console.log('[SKYJO-LIVE] reçu action='+lv.action+' isMyTurn='+isMyTurn+' player='+lv.player+' oppKey2='+oppKey2);

      if(lv.action === 'draw_deck' || lv.action === 'draw_discard'){
        // Animation pioche : vole depuis deck/défausse → oppHeldEl
        var srcElPre = lv.action==='draw_deck' ? deckElLv : discardElLv;
        if(srcElPre){
          var sRpre = srcElPre.getBoundingClientRect();
          var dRpre = oppHeldEl ? oppHeldEl.getBoundingClientRect() : null;
          if(!dRpre || dRpre.width===0){
            dRpre = {left:sRpre.left, top:sRpre.top - 70, width:sRpre.width, height:sRpre.height};
          }
          var flyValPre = lv.action==='draw_discard' ? lv.val : null;
          _pendingLiveAnim = { type:'draw', sR:sRpre, dR:dRpre, val:flyValPre, flip: lv.action==='draw_deck' };
        }

      } else if(lv.action === 'replace'){
        // Source : oppHeldEl si visible, sinon deck/défausse
        var sR2pre = null, usingFallbackPre = true;
        if(oppHeldEl && oppHeldWrap && oppHeldWrap.classList.contains('sj-held-visible')){
          oppHeldEl.innerHTML='<div class="sj-pip-top">'+lv.val+'</div><span class="sj-num">'+lv.val+'</span><div class="sj-pip-bot">'+lv.val+'</div>';
          oppHeldEl.setAttribute('data-val', lv.val);
          sR2pre = oppHeldEl.getBoundingClientRect();
          if(sR2pre && sR2pre.width > 0) usingFallbackPre = false;
        }
        if(!sR2pre || sR2pre.width===0){
          var fbEl = deckElLv || discardElLv;
          sR2pre = fbEl ? fbEl.getBoundingClientRect() : null;
        }
        // Destination : toujours depuis le DOM local (coordonnées de cet écran)
        var targetOppElPre = sjGetCardEl('skyjoOpponentGrid', lv.idx);
        var dR2pre = targetOppElPre ? targetOppElPre.getBoundingClientRect() : null;
        console.log('[SKYJO-LIVE] replace sR=',sR2pre,'dR=',dR2pre,'idx=',lv.idx,'targetEl=',targetOppElPre);
        if(sR2pre && dR2pre && sR2pre.width>0 && dR2pre.width>0){
          _pendingLiveAnim = { type:'replace', idx:lv.idx, sR:sR2pre, dR:dR2pre, val:lv.val, usingFallback:usingFallbackPre };
          console.log('[SKYJO-LIVE] replace pendingAnim OK');
        } else {
          console.warn('[SKYJO-LIVE] replace ABANDONNÉ sR=',sR2pre,'dR=',dR2pre);
        }

      } else if(lv.action === 'discard_held'){
        var sR3pre, usingFallback3pre = false;
        if(oppHeldEl && oppHeldWrap && oppHeldWrap.classList.contains('sj-held-visible')){
          sR3pre = oppHeldEl.getBoundingClientRect();
        }
        if(!sR3pre || sR3pre.width===0){
          usingFallback3pre = true;
          var fbEl3 = deckElLv || discardElLv;
          sR3pre = fbEl3 ? fbEl3.getBoundingClientRect() : null;
        }
        // La défausse est un élément fixe — son rect est toujours valide
        var dR3pre = discardElLv ? discardElLv.getBoundingClientRect() : null;
        if(sR3pre && dR3pre && sR3pre.width>0 && dR3pre.width>0){
          _pendingLiveAnim = { type:'discard_held', sR:sR3pre, dR:dR3pre, val:lv.val, usingFallback:usingFallback3pre };
        }
      }

      // Planifier le masquage de oppHeldWrap après l'animation
      if(lv.action === 'replace' || lv.action === 'discard_held'){
        if(oppHeldWrap){
          var _hideDelay = lv.action==='replace' ? 380 : 320;
          setTimeout(function(){ oppHeldWrap.classList.remove('sj-held-visible'); }, _hideDelay);
        }
      }
    }

    // Signal émis par nous-mêmes → marquer comme vu sans animer (évite replay parasite)
    if(isNewLive && curLive.player && curLive.player === _me){
      window._sjLastSeenLiveTs = curLive.ts;
    }

    // Sync silencieux : si l'adversaire tient déjà une carte au chargement (rejoin mid-game)
    // → afficher directement sans animation
    if(!isNewLive && oppHoldsCard && oppHeldWrap && oppHeldEl){
      if(!oppHeldWrap.classList.contains('sj-held-visible')){
        oppHeldEl.innerHTML='<div class="sj-pip-top">'+state.held_card.value+'</div><span class="sj-num">'+state.held_card.value+'</span><div class="sj-pip-bot">'+state.held_card.value+'</div>';
        oppHeldEl.setAttribute('data-val', state.held_card.value);
        oppHeldWrap.classList.add('sj-held-visible');
      }
    } else if(!oppHoldsCard && oppHeldWrap && !isNewLive){
      oppHeldWrap.classList.remove('sj-held-visible');
    }
    // ────────────────────────────────────────────────────────────────────

    renderGrid('skyjoMyGrid',myCards,true,isMyTurn,state,iHoldCard);
    renderGrid('skyjoOpponentGrid',oppCards,false,false,state,false);

    // ── Lancer les animations live APRÈS renderGrid (nouveaux éléments dans le DOM) ──
    if(_pendingLiveAnim){
      var pla = _pendingLiveAnim;
      console.log('[SKYJO-ANIM] pendingLiveAnim type='+pla.type, pla);
      _sjAnimPlaying = true; // bloquer renderState pendant l'animation

      if(pla.type === 'draw'){
        sjAnimFly(pla.sR, pla.dR, pla.val, {duration:420, flip: pla.flip, onDone: function(){
          _sjAnimDone();
        }});
        if(oppHeldWrap && oppHeldEl){
          setTimeout(function(){
            if(!_gameState) return;
            var liveHeld = _gameState.held_card;
            if(liveHeld && liveHeld.holder===oppKey2){
              oppHeldEl.innerHTML='<div class="sj-pip-top">'+liveHeld.value+'</div><span class="sj-num">'+liveHeld.value+'</span><div class="sj-pip-bot">'+liveHeld.value+'</div>';
              oppHeldEl.setAttribute('data-val', liveHeld.value);
            }
            oppHeldWrap.classList.add('sj-held-visible');
            oppHeldEl.classList.remove('sj-held-appear');
            void oppHeldEl.offsetWidth;
            oppHeldEl.classList.add('sj-held-appear');
            setTimeout(function(){ oppHeldEl.classList.remove('sj-held-appear'); }, 420);
          }, 430);
        }

      } else if(pla.type === 'replace'){
        var newTargetOppEl = sjGetCardEl('skyjoOpponentGrid', pla.idx);
        if(newTargetOppEl) newTargetOppEl.style.visibility = 'hidden';
        if(!pla.usingFallback && oppHeldEl) oppHeldEl.style.visibility = 'hidden';
        sjAnimFly(pla.sR, pla.dR, pla.val, {duration:440, flip:false, onDone:function(){
          if(newTargetOppEl){ newTargetOppEl.style.visibility = ''; sjPlaceGlow(newTargetOppEl); }
          if(!pla.usingFallback && oppHeldEl) oppHeldEl.style.visibility = '';
          _sjAnimDone();
        }});

      } else if(pla.type === 'discard_held'){
        if(!pla.usingFallback && oppHeldEl) oppHeldEl.style.visibility = 'hidden';
        sjAnimFly(pla.sR, pla.dR, pla.val, {duration:380, flip:false, onDone:function(){
          if(!pla.usingFallback && oppHeldEl) oppHeldEl.style.visibility = '';
          _sjAnimDone();
        }});
      }
    }

    // Carte en main
    var heldWrap   = document.getElementById('skyjoHeldCardWrap');
    var heldEl     = document.getElementById('skyjoHeldCard');
    var discardBtn = document.getElementById('skyjoDiscardBtn');
    if(iHoldCard){
      heldWrap.classList.add('sj-held-visible');
      heldEl.innerHTML='<div class="sj-pip-top">'+state.held_card.value+'</div><span class="sj-num">'+state.held_card.value+'</span><div class="sj-pip-bot">'+state.held_card.value+'</div>';
      heldEl.setAttribute('data-val',state.held_card.value);
      // FIX : toujours réactiver le bouton Défausser (il peut avoir été disabled dans skyjoReplaceCard)
      if(discardBtn){ discardBtn.disabled = false; discardBtn.style.opacity = ''; discardBtn.style.pointerEvents = ''; }
      // Animation d'apparition si nouvelle carte
      if(newHeld){
        heldEl.classList.remove('sj-held-appear');
        void heldEl.offsetWidth;
        heldEl.classList.add('sj-held-appear');
        setTimeout(function(){ heldEl.classList.remove('sj-held-appear'); }, 420);
      }
    } else {
      heldWrap.classList.remove('sj-held-visible');
      if(discardBtn){ discardBtn.disabled = false; }
    }

    // Message init uniquement (le reste est géré par la bannière)
    var phaseMsg=document.getElementById('skyjoPhaseMsg');
    if(state.phase==='init1'){
      phaseMsg.style.display='block';
      var myFlippedCount=myCards.filter(function(c){return c.revealed;}).length;
      var othFlippedCount=oppCards.filter(function(c){return c.revealed;}).length;
      if(myFlippedCount<2){
        phaseMsg.textContent='Clique sur 2 cartes de ta grille pour les retourner';
      } else {
        phaseMsg.textContent='\u2705 Tu as retourné tes 2 cartes — en attente que '+oppName+' fasse pareil…';
      }
    } else {
      phaseMsg.style.display='none';
    }

    if(state.phase==='roundEnd'){showRoundEnd(state);} // poll continue pour détecter init1
    else if(state.phase==='gameEnd'){stopPoll();showGameEnd(state);}
  }

  function renderGrid(gridId,cards,isMe,isMyTurn,state,iHold){
    var grid=document.getElementById(gridId);
    // Snapshot des éléments existants AVANT de vider la grille
    var prevEls    = Array.from(grid.querySelectorAll('.skyjo-card'));
    var prevStates = prevEls.map(function(el){
      return {
        hidden:   el.classList.contains('skyjo-card-hidden'),
        removed:  el.classList.contains('skyjo-col-complete'),
        val:      el.getAttribute('data-val'),
        rect:     el.getBoundingClientRect()
      };
    });
    var isFirstRender = prevEls.length === 0;

    grid.innerHTML='';
    var phase=state.phase;
    var isInit=phase==='init1';
    var flipped=cards.filter(function(c){return c.revealed;}).length;

    var canFlipInit    = isMe && isInit && flipped<2;
    var canReplaceAny  = isMe && isMyTurn && phase==='play' && iHold;
    var mustFlipHidden = isMe && isMyTurn && phase==='play' && !iHold && state.must_flip===_me;

    cards.forEach(function(card,idx){
      var prev = prevStates[idx] || {};

      var el=document.createElement('div');
      el.className='skyjo-card';

      // ── Stagger d'entrée au premier rendu ──
      if(isFirstRender){
        el.style.opacity   = '0';
        el.style.transform = 'scale(0.6) translateY(12px) rotateZ('+(Math.random()*8-4)+'deg)';
        el.style.transition = 'opacity 0.32s ease, transform 0.32s cubic-bezier(.17,.89,.32,1.28)';
        el.style.transitionDelay = (idx * 38) + 'ms';
        setTimeout(function(e){
          e.style.opacity   = '1';
          e.style.transform = 'scale(1) translateY(0) rotateZ(0deg)';
          setTimeout(function(){ e.style.transition=''; e.style.transitionDelay=''; }, 380);
        }(el), 30 + idx * 38);
      }

      if(card.removed){
        el.classList.add('skyjo-col-complete');
        el.innerHTML='';
        if(!prev.removed && !isFirstRender){
          // Carte retirée : animation d'explosion
          el.classList.remove('skyjo-col-complete');
          el.classList.add('sj-col-remove');
          setTimeout(function(e){
            e.classList.remove('sj-col-remove');
            e.classList.add('skyjo-col-complete');
          }(el), 540);
          // Particules à la position de la carte
          if(prev.rect){
            sjSpawnParticles({ getBoundingClientRect: function(){ return prev.rect; } });
          }
        }

      } else if(card.revealed){
        el.setAttribute('data-val',card.value);
        el.innerHTML =
          '<div class="sj-pip-top">'+card.value+'</div>'+
          '<span class="sj-num">'+card.value+'</span>'+
          '<div class="sj-pip-bot">'+card.value+'</div>';

        // ── Nouvellement révélée par l'adversaire (via poll) : flip animé ──
        if(prev.hidden && !isFirstRender && !isMe){
          // L'adversaire a retourné cette carte → on l'anime
          // Ne pas masquer la carte ici : sjAnimFlipInPlace s'en charge au bon moment
          var _elRef = el;
          var _val = card.value;
          var _delay = idx * 55 + 80;
          setTimeout(function(){
            if(!_elRef || !_elRef.isConnected) return;
            sjAnimFlipInPlace(_elRef, _val, null);
          }, _delay);
        }
        // Révélation côté moi déjà animée dans l'action (skyjoFlipInit / skyjoFlipReveal)

        if(canReplaceAny){
          el.classList.add('skyjo-card-clickable');
          el.onclick=function(){skyjoReplaceCard(idx);};
        }
      } else {
        el.classList.add('skyjo-card-hidden');
        if(canFlipInit){
          el.classList.add('skyjo-card-clickable');
          el.onclick=function(){skyjoFlipInit(idx);};
        } else if(canReplaceAny){
          el.classList.add('skyjo-card-clickable');
          el.onclick=function(){skyjoReplaceCard(idx);};
        } else if(mustFlipHidden){
          el.classList.add('skyjo-card-clickable');
          el.onclick=function(){skyjoFlipReveal(idx);};
        }
      }
      grid.appendChild(el);
    });
  }

  // ─── Actions joueur (définies plus bas) ──────────────

  // ─── Helpers animations ──────────────────────────────

  function sjShowLoader(){ var o=document.getElementById('sjLoadingOverlay'); if(o) o.classList.add('visible'); }
  function sjHideLoader(){ var o=document.getElementById('sjLoadingOverlay'); if(o) o.classList.remove('visible'); }

  /* ═══════════════════════════════════════════════════════════
     SYSTÈME DE CARTES VOLANTES — clones absolus en position fixe
     Toutes les animations passent par sjAnimate() qui crée un
     clone de carte qui vole en CSS entre deux rectangles réels.
  ═══════════════════════════════════════════════════════════ */

  /**
   * Crée une carte clone qui vole de srcRect → destRect puis disparaît.
   * @param srcRect   - DOMRect source (position de départ)
   * @param destRect  - DOMRect destination
   * @param cardVal   - valeur de la carte (null = dos)
   * @param opts      - { flip: bool, delay: ms, duration: ms, onDone: fn }
   */
  function sjAnimFly(srcRect, destRect, cardVal, opts){
    opts = opts || {};
    var dur   = opts.duration || 480;
    var delay = opts.delay    || 0;

    var card = document.createElement('div');
    card.className = 'skyjo-card sj-fly-clone';
    card.style.cssText = [
      'position:fixed',
      'left:' + srcRect.left + 'px',
      'top:'  + srcRect.top  + 'px',
      'width:' + srcRect.width  + 'px',
      'height:'+ srcRect.height + 'px',
      'z-index:9999',
      'pointer-events:none',
      'will-change:transform,opacity',
      'transform-origin:center center',
      'transform-style:preserve-3d',
    ].join(';');

    if(cardVal !== null && cardVal !== undefined){
      card.innerHTML = '<span class="sj-num">'+cardVal+'</span>';
      card.setAttribute('data-val', cardVal);
    } else {
      card.classList.add('skyjo-card-back');
    }

    document.body.appendChild(card);

    var dx = (destRect.left + destRect.width/2)  - (srcRect.left + srcRect.width/2);
    var dy = (destRect.top  + destRect.height/2) - (srcRect.top  + srcRect.height/2);

    // === Construire l'animation via Web Animations API ===
    var scaleX = destRect.width  / srcRect.width;
    var scaleY = destRect.height / srcRect.height;

    var keyframes;

    if(opts.flip){
      // Vol avec retournement 3D : dos → face
      keyframes = [
        { transform: 'translate(0,0) scale(1) rotateZ(-4deg) rotateY(0deg)',    opacity: 1,    offset: 0    },
        { transform: 'translate('+dx*0.4+'px,'+dy*0.25+'px) scale(1.2) rotateZ(2deg) rotateY(90deg)',  opacity: 1,    offset: 0.35 },
        { transform: 'translate('+dx*0.7+'px,'+dy*0.6+'px) scale(1.1) rotateZ(1deg) rotateY(0deg)',   opacity: 1,    offset: 0.6  },
        { transform: 'translate('+dx+'px,'+dy+'px) scale('+scaleX+','+scaleY+') rotateZ(0deg) rotateY(0deg)', opacity: 0.1, offset: 1 }
      ];
      // Change l'aspect au milieu du flip (offset 0.35 = 90°)
      setTimeout(function(){
        if(!card.parentNode) return;
        card.classList.remove('skyjo-card-back');
        if(cardVal !== null && cardVal !== undefined){
          card.innerHTML = '<span class="sj-num">'+cardVal+'</span>';
          card.setAttribute('data-val', cardVal);
        }
      }, delay + dur * 0.35);
    } else {
      // Vol simple (dos → main, ou face → défausse)
      keyframes = [
        { transform: 'translate(0,0) scale(1) rotateZ(-5deg)',                                                    opacity: 1,   offset: 0    },
        { transform: 'translate('+dx*0.38+'px,'+dy*0.22+'px) scale(1.22) rotateZ(4deg)',                         opacity: 1,   offset: 0.28 },
        { transform: 'translate('+dx*0.72+'px,'+dy*0.68+'px) scale(1.08) rotateZ(1deg)',                         opacity: 1,   offset: 0.65 },
        { transform: 'translate('+dx+'px,'+dy+'px) scale('+scaleX+','+scaleY+') rotateZ(0deg)',                  opacity: 0.1, offset: 1    }
      ];
    }

    var anim = card.animate(keyframes, {
      duration: dur,
      delay: delay,
      easing: 'cubic-bezier(.25,.65,.3,.98)',
      fill: 'forwards'
    });

    anim.onfinish = function(){
      if(card.parentNode) card.parentNode.removeChild(card);
      if(opts.onDone) opts.onDone();
    };

    return anim;
  }

  /**
   * Retourne visuellement une carte sur place (3D flip, dos → face ou face → face).
   * Crée un clone par-dessus la carte, fait l'animation, puis retire le clone.
   * @param targetEl - élément DOM de la carte cible
   * @param newVal   - la valeur à révéler
   * @param onDone   - callback
   */
  function sjAnimFlipInPlace(targetEl, newVal, onDone){
    if(!targetEl){ if(onDone) onDone(); return; }
    var rect = targetEl.getBoundingClientRect();

    var card = document.createElement('div');
    card.className = 'skyjo-card';
    card.style.cssText = [
      'position:fixed',
      'left:' + rect.left + 'px',
      'top:'  + rect.top  + 'px',
      'width:' + rect.width  + 'px',
      'height:'+ rect.height + 'px',
      'z-index:9999',
      'pointer-events:none',
      'will-change:transform,opacity',
      'transform-origin:center center',
      'transform-style:preserve-3d',
      'perspective:500px',
    ].join(';');
    card.classList.add('skyjo-card-hidden'); // dos au départ
    document.body.appendChild(card);

    // Masquer la carte originale pendant l'animation
    targetEl.style.visibility = 'hidden';

    var dur = 540;
    var anim = card.animate([
      { transform: 'rotateY(0deg)   scale(1)',    filter: 'brightness(1)',   offset: 0    },
      { transform: 'rotateY(90deg)  scale(1.08)', filter: 'brightness(0.4)', offset: 0.36 },
      { transform: 'rotateY(-90deg) scale(1.08)', filter: 'brightness(0.4)', offset: 0.37 },
      { transform: 'rotateY(-10deg) scale(1.04)', filter: 'brightness(1.3)', offset: 0.7  },
      { transform: 'rotateY(3deg)   scale(1.01)', filter: 'brightness(1.1)', offset: 0.87 },
      { transform: 'rotateY(0deg)   scale(1)',    filter: 'brightness(1)',   offset: 1    }
    ], { duration: dur, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });

    // À mi-chemin → changer l'apparence de la carte
    setTimeout(function(){
      if(!card.parentNode) return;
      card.classList.remove('skyjo-card-hidden');
      if(newVal !== null && newVal !== undefined){
        card.innerHTML = '<span class="sj-num">'+newVal+'</span>';
        card.setAttribute('data-val', newVal);
      }
    }, dur * 0.37);

    anim.onfinish = function(){
      // Remettre la vraie carte visible avec la bonne valeur
      targetEl.style.visibility = '';
      if(card.parentNode) card.parentNode.removeChild(card);
      sjPlaceGlow(targetEl);
      if(onDone) onDone();
    };
  }

  /**
   * Fait voler une carte depuis "en main" vers une case de la grille.
   * La heldCard visible disparaît, un clone vole vers la case cible,
   * la nouvelle carte apparaît avec un pop.
   * @param heldEl    - élément DOM de la heldCard
   * @param targetEl  - élément DOM de la case cible dans la grille
   * @param heldVal   - valeur de la carte en main
   * @param newVal    - valeur qui remplacera la case (après flip si cachée)
   * @param wasHidden - la case cible était-elle face cachée
   * @param onDone    - callback une fois toutes les anim terminées
   */
  function sjAnimHeldToGrid(heldEl, targetEl, heldVal, newVal, wasHidden, onDone){
    if(!heldEl || !targetEl){ if(onDone) onDone(); return; }

    var srcRect  = heldEl.getBoundingClientRect();
    var destRect = targetEl.getBoundingClientRect();

    // Masquer la held card et la case cible pendant l'animation
    heldEl.style.visibility   = 'hidden';
    targetEl.style.visibility = 'hidden';

    var dur = wasHidden ? 560 : 480;

    sjAnimFly(srcRect, destRect, heldVal, {
      duration: dur,
      flip: wasHidden, // retournement si la case était cachée
      onDone: function(){
        // Remettre la case cible avec pop
        targetEl.style.visibility = '';
        if(wasHidden){
          // La vraie valeur est déjà appliquée par renderState, juste animer l'apparition
          targetEl.animate([
            { transform: 'scale(0.8) rotateZ(3deg)', opacity: 0.3, filter: 'brightness(1.4)' },
            { transform: 'scale(1.1) rotateZ(-1deg)', opacity: 1, filter: 'brightness(1.2)' },
            { transform: 'scale(1) rotateZ(0deg)', opacity: 1, filter: 'brightness(1)' }
          ], { duration: 280, easing: 'cubic-bezier(.17,.89,.32,1.28)', fill: 'forwards' })
          .onfinish = function(){ sjPlaceGlow(targetEl); };
        } else {
          // Carte visible → remplacée, simple pop
          targetEl.animate([
            { transform: 'scale(0.7) rotateZ(-5deg)', opacity: 0.2 },
            { transform: 'scale(1.1) rotateZ(1deg)',  opacity: 1 },
            { transform: 'scale(1) rotateZ(0deg)',    opacity: 1 }
          ], { duration: 260, easing: 'cubic-bezier(.17,.89,.32,1.28)', fill: 'forwards' })
          .onfinish = function(){ sjPlaceGlow(targetEl); };
        }
        heldEl.style.visibility = '';
        if(onDone) onDone();
      }
    });
  }

  /**
   * Fait voler la carte en main vers la défausse.
   * heldEl → discardEl, avec un spin rotatif au milieu.
   */
  function sjAnimHeldToDiscard(heldEl, discardEl, heldVal, onDone){
    if(!heldEl || !discardEl){ if(onDone) onDone(); return; }

    var srcRect  = heldEl.getBoundingClientRect();
    var destRect = discardEl.getBoundingClientRect();

    heldEl.style.visibility = 'hidden';

    var dx = (destRect.left + destRect.width/2)  - (srcRect.left + srcRect.width/2);
    var dy = (destRect.top  + destRect.height/2) - (srcRect.top  + srcRect.height/2);
    var scaleX = destRect.width  / srcRect.width;
    var scaleY = destRect.height / srcRect.height;

    var card = document.createElement('div');
    card.className = 'skyjo-card';
    card.style.cssText = 'position:fixed;left:'+srcRect.left+'px;top:'+srcRect.top+'px;width:'+srcRect.width+'px;height:'+srcRect.height+'px;z-index:9999;pointer-events:none;will-change:transform,opacity;transform-style:preserve-3d;';
    card.innerHTML = '<span class="sj-num">'+heldVal+'</span>';
    card.setAttribute('data-val', heldVal);
    document.body.appendChild(card);

    var dur = 440;
    var anim = card.animate([
      { transform: 'translate(0,0) scale(1) rotateZ(0deg) rotateY(0deg)', opacity: 1,   offset: 0    },
      { transform: 'translate('+dx*0.4+'px,'+dy*0.3+'px) scale(1.15) rotateZ(-8deg) rotateY(40deg)', opacity: 1,   offset: 0.3  },
      { transform: 'translate('+dx*0.75+'px,'+dy*0.7+'px) scale(1.05) rotateZ(12deg) rotateY(180deg)', opacity: 1,  offset: 0.65 },
      { transform: 'translate('+dx+'px,'+dy+'px) scale('+scaleX+','+scaleY+') rotateZ(0deg) rotateY(0deg)', opacity: 0.05, offset: 1 }
    ], { duration: dur, easing: 'cubic-bezier(.25,.6,.3,.98)', fill: 'forwards' });

    anim.onfinish = function(){
      if(card.parentNode) card.parentNode.removeChild(card);
      heldEl.style.visibility = '';
      if(onDone) onDone();
    };
  }

  // Fait voler une carte depuis un élément source vers un élément dest (API legacy)
  function sjFlyCard(srcEl, destEl, cardVal, isFromDiscard, onDone){
    if(!srcEl || !destEl){ if(onDone) onDone(); return; }
    var sRect = srcEl.getBoundingClientRect();
    var dRect = destEl.getBoundingClientRect();
    sjAnimFly(sRect, dRect, isFromDiscard ? cardVal : null, {
      duration: isFromDiscard ? 440 : 520,
      flip: false,
      onDone: onDone
    });
  }

  // Déclenche des particules depuis un élément (colonne complète)
  function sjSpawnParticles(el){
    if(!el) return;
    var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : el;
    var cx = rect.left + rect.width/2;
    var cy = rect.top  + rect.height/2;
    var emojis = ['✨','⭐','💫','🌟','🎉','🃏','💥','🌈'];
    var count = 10;
    for(var i=0; i<count; i++){
      (function(i){
        setTimeout(function(){
          var p = document.createElement('div');
          p.className = 'sj-particle';
          p.textContent = emojis[i % emojis.length];
          var angle = (i / count) * Math.PI * 2 + (Math.random() * 0.6);
          var dist = 45 + Math.random()*55;
          p.style.left = cx + 'px';
          p.style.top  = cy + 'px';
          p.style.setProperty('--px', (Math.cos(angle)*dist)+'px');
          p.style.setProperty('--py', (Math.sin(angle)*dist - 45)+'px');
          p.style.setProperty('--pr', (Math.random()*540-270)+'deg');
          p.style.fontSize = (13 + Math.random()*9) + 'px';
          document.body.appendChild(p);
          setTimeout(function(){ if(p.parentNode) p.parentNode.removeChild(p); }, 1100);
        }, i * 40 + Math.random()*25);
      })(i);
    }
  }

  // Halo vert après placement
  function sjPlaceGlow(el){
    if(!el) return;
    el.classList.remove('sj-place-glow');
    void el.offsetWidth;
    el.classList.add('sj-place-glow');
    setTimeout(function(){ el.classList.remove('sj-place-glow'); }, 620);
  }

  // Animation bannière de tour
  function sjAnimBanner(el, isMyTurn){
    if(!el) return;
    el.classList.remove('sj-banner-enter', 'sj-banner-enter-opp');
    void el.offsetWidth;
    el.classList.add(isMyTurn ? 'sj-banner-enter' : 'sj-banner-enter-opp');
    var cls = isMyTurn ? 'sj-banner-enter' : 'sj-banner-enter-opp';
    setTimeout(function(){ el.classList.remove(cls); }, 400);
  }

  // Retourne l'élément DOM d'une case de grille par index
  function sjGetCardEl(gridId, idx){
    var grid = document.getElementById(gridId);
    if(!grid) return null;
    var cards = grid.querySelectorAll('.skyjo-card');
    return cards[idx] || null;
  }

  // ─── RPC : appel atomique côté serveur ──────────────────
  // ─── Helpers logique jeu ─────────────────────────────

  // Vérifie si une colonne entière (3 cartes) est révélée avec la même valeur → retirer
  // Skyjo : 4 colonnes (indices col 0..3), chaque col = idx col, col+4, col+8
  function checkAndRemoveColumns(cards){
    var changed = false;
    for(var col=0; col<4; col++){
      var i0=col, i1=col+4, i2=col+8;
      var c0=cards[i0], c1=cards[i1], c2=cards[i2];
      if(!c0||!c1||!c2) continue;
      if(c0.removed||c1.removed||c2.removed) continue;
      if(c0.revealed&&c1.revealed&&c2.revealed&&c0.value===c1.value&&c1.value===c2.value){
        cards[i0].removed=true; cards[i1].removed=true; cards[i2].removed=true;
        changed=true;
      }
    }
    return changed;
  }

  // Calcule le score d'un joueur (cartes non-removed révélées + cartes cachées)
  function calcPlayerScore(cards){
    return cards.reduce(function(s,c){ return s+(c.removed?0:c.value); },0);
  }

  // Vérifie si toutes les cartes non-removed sont révélées → fermeture de manche
  function allRevealed(cards){
    return cards.every(function(c){ return c.removed||c.revealed; });
  }

  // Avance le tour à l'autre joueur
  function nextTurn(ns){
    ns.turn = (ns.turn==='girl'?'boy':'girl');
  }

  // Gère la fin de manche après qu'un joueur a tout révélé
  // closer = profil qui a fermé, last_player = l'autre joueur doit encore jouer
  function handleRoundClose(ns, closerKey){
    if(ns.phase==='roundEnd') return; // déjà géré
    if(!ns.round_closer){
      // Premier joueur à fermer
      ns.round_closer = closerKey;
      ns.last_player  = (closerKey==='girl'?'boy':'girl');
      // L'autre joueur joue son dernier tour
      ns.turn = ns.last_player;
    } else {
      // Le dernier joueur vient de jouer → fin de manche
      _finishRound(ns);
    }
  }

  function _finishRound(ns){
    // Révéler toutes les cartes cachées pour le comptage
    ['girl_cards','boy_cards'].forEach(function(key){
      ns[key].forEach(function(c){ if(!c.removed) c.revealed=true; });
    });
    var gs = calcPlayerScore(ns.girl_cards);
    var gb = calcPlayerScore(ns.boy_cards);
    // Pénalité Skyjo : si le joueur qui a fermé n'a PAS le score le plus bas, son score est doublé
    if(ns.round_closer==='girl' && gs >= gb) gs *= 2;
    if(ns.round_closer==='boy'  && gb >= gs) gb *= 2;
    ns.scores = ns.scores || {girl:0, boy:0};
    ns.scores.girl = (ns.scores.girl||0) + gs;
    ns.scores.boy  = (ns.scores.boy||0)  + gb;
    ns.round_scores = {girl:gs, boy:gb};
    // Fin de partie si un joueur dépasse 100 pts
    if(ns.scores.girl>=100||ns.scores.boy>=100){
      ns.phase='gameEnd';
    } else {
      ns.phase='roundEnd';
    }
  }

  // ─── Actions joueur ──────────────────────────────────

  window.skyjoFlipInit=function(idx){
    if(!_gameState||_phase!=='init1') return;
    var key=_me+'_cards';
    var flipped=_gameState[key].filter(function(c){return c.revealed;}).length;
    if(flipped>=2) return;

    // Animation flip in-place immédiate (optimiste, avant sauvegarde)
    var cardEl = sjGetCardEl('skyjoMyGrid', idx);
    if(cardEl && cardEl.classList.contains('skyjo-card-hidden')){
      cardEl.style.pointerEvents = 'none';
      cardEl.classList.remove('skyjo-card-clickable');
      sjAnimFlipInPlace(cardEl, _gameState[key][idx].value, null);
    }

    var ns = deepCopy(_gameState);
    ns[key][idx].revealed = true;

    var myFlipped    = ns[key].filter(function(c){return c.revealed;}).length;
    var otherKey     = (_me==='girl'?'boy':'girl')+'_cards';
    var otherFlipped = ns[otherKey].filter(function(c){return c.revealed;}).length;

    // Les deux ont retourné leurs 2 cartes → passer en play
    if(myFlipped>=2 && otherFlipped>=2){
      var myTot  = ns[key].reduce(function(a,c){return a+(c.revealed?c.value:0);},0);
      var othTot = ns[otherKey].reduce(function(a,c){return a+(c.revealed?c.value:0);},0);
      ns.turn  = myTot>=othTot ? _me : _other;
      ns.phase = 'play';
    }
    saveState(ns);
  };

  window.skyjoDrawFromDeck=function(){
    if(!_gameState||_phase!=='play') return;
    if(_gameState.turn!==_me||_gameState.held_card) return;
    if(!_gameState.deck||!_gameState.deck.length) return;

    var _d1=document.getElementById('skyjoDeckCard');
    var _d2=document.getElementById('skyjoDiscardCard');
    if(_d1) _d1.classList.remove('sj-selectable');
    if(_d2) _d2.classList.remove('sj-selectable');

    var deckEl = document.getElementById('skyjoDeckCard');
    var heldEl = document.getElementById('skyjoHeldCard');
    if(deckEl){
      deckEl.animate([
        { transform: 'scale(1) translateY(0)' },
        { transform: 'scale(0.87) translateY(4px) rotateZ(2deg)' },
        { transform: 'scale(1.06) translateY(-3px) rotateZ(-1deg)' },
        { transform: 'scale(1) translateY(0)' }
      ], { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)' });
    }
    if(deckEl && heldEl){
      var sRect = deckEl.getBoundingClientRect();
      var dRect = heldEl.getBoundingClientRect();
      if(!dRect||dRect.width===0) dRect={left:sRect.left-80,top:sRect.top,width:sRect.width,height:sRect.height};
      sjAnimFly(sRect, dRect, null, { duration: 440, flip: false });
    }

    var ns = deepCopy(_gameState);
    var drawnVal = ns.deck.pop();
    // Reconstituer la pioche si vide
    if(ns.deck.length===0 && ns.discard.length>1){
      var top=ns.discard.pop();
      ns.deck=shuffle(ns.discard.slice());
      ns.discard=[top];
    }
    ns.held_card = {value:drawnVal, holder:_me};
    ns.live = {action:'draw_deck', player:_me, ts:Date.now()};
    saveState(ns);
  };

  window.skyjoDrawFromDiscard=function(){
    if(!_gameState||_phase!=='play') return;
    if(_gameState.turn!==_me||_gameState.held_card) return;
    if(!_gameState.discard||!_gameState.discard.length) return;

    var _d1=document.getElementById('skyjoDeckCard');
    var _d2=document.getElementById('skyjoDiscardCard');
    if(_d1) _d1.classList.remove('sj-selectable');
    if(_d2) _d2.classList.remove('sj-selectable');

    var discardEl = document.getElementById('skyjoDiscardCard');
    var heldEl    = document.getElementById('skyjoHeldCard');
    var topVal    = _gameState.discard[_gameState.discard.length-1];
    if(discardEl && heldEl){
      var sRect = discardEl.getBoundingClientRect();
      var dRect = heldEl.getBoundingClientRect && heldEl.getBoundingClientRect().width>0
        ? heldEl.getBoundingClientRect()
        : {left:sRect.left-70,top:sRect.top,width:sRect.width,height:sRect.height};
      sjAnimFly(sRect, dRect, topVal, { duration: 440, flip: false });
    }

    var ns = deepCopy(_gameState);
    var drawnVal = ns.discard.pop();
    ns.held_card = {value:drawnVal, holder:_me};
    ns.live = {action:'draw_discard', val:drawnVal, player:_me, ts:Date.now()};
    saveState(ns);
  };

  window.skyjoReplaceCard=function(idx){
    if(!_gameState||_phase!=='play') return;
    if(_gameState.turn!==_me) return;
    if(!_gameState.held_card||_gameState.held_card.holder!==_me) return;

    var heldEl    = document.getElementById('skyjoHeldCard');
    var targetEl  = sjGetCardEl('skyjoMyGrid', idx);
    var key       = _me+'_cards';
    var heldVal   = _gameState.held_card.value;
    var wasHidden = _gameState[key][idx] && !_gameState[key][idx].revealed;
    var targetVal = _gameState[key][idx] ? _gameState[key][idx].value : null;

    var grid = document.getElementById('skyjoMyGrid');
    if(grid) grid.querySelectorAll('.skyjo-card').forEach(function(c){ c.style.pointerEvents='none'; c.classList.remove('skyjo-card-clickable'); });
    var discardBtn = document.getElementById('skyjoDiscardBtn');
    if(discardBtn) discardBtn.disabled = true;

    if(heldEl && targetEl){
      sjAnimHeldToGrid(heldEl, targetEl, heldVal, wasHidden?null:targetVal, wasHidden, function(){
        if(!wasHidden && targetVal!==null){
          var newTargetEl = sjGetCardEl('skyjoMyGrid', idx);
          var discardEl   = document.getElementById('skyjoDiscardCard');
          if(newTargetEl && discardEl){
            sjAnimFly(newTargetEl.getBoundingClientRect(), discardEl.getBoundingClientRect(), targetVal, {duration:360,flip:false});
          }
        }
      });
    }

    var ns = deepCopy(_gameState);
    var oldCard = ns[key][idx];
    // La carte remplacée va à la défausse
    ns.discard.push(oldCard.value);
    // La carte tenue prend la place, révélée
    ns[key][idx] = {value:heldVal, revealed:true};
    ns.held_card = null;
    // Signal live pour l'animation adversaire (coordonnées destination capturées avant renderGrid)
    var _liveDestRect = targetEl ? targetEl.getBoundingClientRect() : null;
    ns.live = {action:'replace', idx:idx, val:heldVal, player:_me,
      destRect: _liveDestRect ? {left:_liveDestRect.left, top:_liveDestRect.top, width:_liveDestRect.width, height:_liveDestRect.height} : null,
      ts:Date.now()};
    // Vérifier colonnes identiques
    checkAndRemoveColumns(ns[key]);
    // Vérifier si toutes révélées → fermeture de manche
    if(allRevealed(ns[key])){
      handleRoundClose(ns, _me);
    } else if(ns.round_closer && ns.last_player===_me){
      // C'était mon dernier tour
      _finishRound(ns);
    } else {
      nextTurn(ns);
    }
    saveState(ns);
  };

  window.skyjoDiscardHeld=function(){
    if(!_gameState||_phase!=='play') return;
    if(_gameState.turn!==_me) return;
    if(!_gameState.held_card||_gameState.held_card.holder!==_me) return;

    var heldEl    = document.getElementById('skyjoHeldCard');
    var discardEl = document.getElementById('skyjoDiscardCard');
    var heldVal   = _gameState.held_card.value;
    if(heldEl && discardEl){
      sjAnimHeldToDiscard(heldEl, discardEl, heldVal, null);
    }

    var ns = deepCopy(_gameState);
    ns.discard.push(ns.held_card.value);
    ns.live = {action:'discard_held', val:ns.held_card.value, player:_me, ts:Date.now()};
    ns.held_card = null;
    ns.must_flip = _me; // doit retourner une carte cachée
    saveState(ns);
  };

  window.skyjoFlipReveal=function(idx){
    if(!_gameState||_phase!=='play') return;
    if(_gameState.turn!==_me||_gameState.must_flip!==_me) return;
    var key=_me+'_cards';
    if(_gameState[key][idx].revealed) return;

    var cardEl  = sjGetCardEl('skyjoMyGrid', idx);
    var cardVal = _gameState[key][idx].value;
    if(cardEl){
      cardEl.style.pointerEvents = 'none';
      sjAnimFlipInPlace(cardEl, cardVal, null);
    }

    var ns = deepCopy(_gameState);
    ns[key][idx].revealed = true;
    ns.must_flip = null;
    // Vérifier colonnes identiques
    checkAndRemoveColumns(ns[key]);
    // Vérifier si toutes révélées → fermeture de manche
    if(allRevealed(ns[key])){
      handleRoundClose(ns, _me);
    } else if(ns.round_closer && ns.last_player===_me){
      _finishRound(ns);
    } else {
      nextTurn(ns);
    }
    saveState(ns);
  };


  function saveState(ns){
    if(!_gameId) return;
    // Mise à jour optimiste immédiate : le poll ne peut pas écraser pendant le PATCH
    _gameState = ns;
    _phase = ns.phase;
    _saving = true;
    fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+_gameId,{
      method:'PATCH',
      headers:sb2Headers({'Prefer':'return=representation'}),
      body:JSON.stringify({state:ns})
    })
    .then(function(r){
      if(!r.ok){
        r.text().then(function(t){ console.error('[SKYJO] saveState 400 detail:', t); });
        return null;
      }
      return r.json();
    })
    .then(function(rows){
      _saving = false;
      if(rows&&Array.isArray(rows)&&rows[0]) renderState(rows[0]);
    })
    .catch(function(e){
      _saving = false;
      console.error('[SKYJO] saveState err', e);
    });
  }

  /* ── Live signal : écrit un événement instantané dans le state pour que
        l'adversaire le voie via son poll et joue l'animation correspondante.
        Fire-and-forget, pas de callback. ── */
  function _writeLive(liveObj){
    if(!_gameId||!_gameState) return;
    // Merge le champ live dans le state courant et PATCH
    var patch = JSON.parse(JSON.stringify(_gameState));
    patch.live = liveObj; // ex: {action:'draw_deck', val:7, ts:Date.now()}
    fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+_gameId,{
      method:'PATCH',
      headers:sb2Headers({'Prefer':'return=minimal'}),
      body:JSON.stringify({state:patch})
    }).catch(function(){});
  }

  /* ── Efface le champ live (après que l'action finale a été jouée) ── */
  function _clearLive(){
    if(!_gameId||!_gameState) return;
    var patch = JSON.parse(JSON.stringify(_gameState));
    delete patch.live;
    fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+_gameId,{
      method:'PATCH',
      headers:sb2Headers({'Prefer':'return=minimal'}),
      body:JSON.stringify({state:patch})
    }).catch(function(){});
  }

  // ─── Fin de manche ───────────────────────────────────
  function showRoundEnd(state){
    if(_roundEndShown) return; // éviter double déclenchement par le poll
    _roundEndShown=true;

    // 1) Révéler toutes les cartes cachées avec animation en cascade
    _flipAllHiddenCards(state, function(){
      // 2) Agrandir + animer les badges de total
      var myTotEl  = document.getElementById('skyjoMyTotal');
      var oppTotEl = document.getElementById('skyjoOppTotal');
      [myTotEl, oppTotEl].forEach(function(el){
        if(!el) return;
        el.classList.remove('sj-score-pop');
        void el.offsetWidth;
        el.classList.add('sj-score-pop');
        // Agrandir pendant la phase de révélation
        el.style.width='44px'; el.style.height='44px'; el.style.fontSize='16px';
      });

      // 3) Après 10s de vue globale → afficher le popup
      setTimeout(function(){
        _showRoundEndPopup(state);
      }, 10000);
    });
  }

  function _flipAllHiddenCards(state, onDone){
    var myKey  = _me==='girl'?'girl_cards':'boy_cards';
    var oppKey = _me==='girl'?'boy_cards':'girl_cards';
    var myGrid  = document.getElementById('skyjoMyGrid');
    var oppGrid = document.getElementById('skyjoOpponentGrid');
    if(!myGrid||!oppGrid){ if(onDone) onDone(); return; }

    var myCardEls  = Array.from(myGrid.querySelectorAll('.skyjo-card'));
    var oppCardEls = Array.from(oppGrid.querySelectorAll('.skyjo-card'));
    var allEls     = myCardEls.concat(oppCardEls);
    var allData    = (state[myKey]||[]).concat(state[oppKey]||[]);

    // Désactiver tous les clics
    allEls.forEach(function(el){ el.onclick=null; el.classList.remove('skyjo-card-clickable'); el.style.pointerEvents='none'; });

    var delay  = 0;
    var maxEnd = 0;

    allEls.forEach(function(el, i){
      var cardData = allData[i];
      if(!cardData || cardData.removed) return;
      if(!cardData.revealed){
        (function(el, d, val){
          setTimeout(function(){
            sjAnimFlipInPlace(el, val, null);
          }, d);
        })(el, delay, cardData.value);
        maxEnd = delay + 540 + 80;
        delay += 90;
      }
    });

    setTimeout(function(){ if(onDone) onDone(); }, maxEnd + 100);
  }

  function _showRoundEndPopup(state){
    // Remettre les badges à taille normale
    var myTotEl=document.getElementById('skyjoMyTotal');
    var oppTotEl=document.getElementById('skyjoOppTotal');
    [myTotEl,oppTotEl].forEach(function(el){ if(el){ el.style.width=''; el.style.height=''; el.style.fontSize=''; } });
    var rg=state.round_scores?state.round_scores.girl:0;
    var rb=state.round_scores?state.round_scores.boy:0;
    var tg=state.scores?state.scores.girl:0;
    var tb=state.scores?state.scores.boy:0;
    var winner=rg<rb?(typeof v2GetDisplayName==="function"?v2GetDisplayName('girl')+' 👧':'Elle 👧'):(rb<rg?(typeof v2GetDisplayName==="function"?v2GetDisplayName('boy')+' 👦':'Lui 👦'):null);
    document.getElementById('skyjoRoundEndEmoji').textContent=!winner?'🤝':'🏆';
    document.getElementById('skyjoRoundEndTitle').textContent=!winner?'Manche nulle !':(winner+' gagne la manche !');
    document.getElementById('skyjoRoundEndSub').textContent='Manche '+(state.round||1);
    // Afficher MOI à gauche (Girl-slot), ADVERSAIRE à droite (Boy-slot), selon _me
    var myR   = _me==='girl' ? rg : rb;
    var oppR  = _me==='girl' ? rb : rg;
    var myT   = _me==='girl' ? tg : tb;
    var oppT  = _me==='girl' ? tb : tg;
    var myName2  = (typeof v2GetDisplayName==="function"?'👧 '+v2GetDisplayName('girl'):'👧 Elle');
    var oppName2 = (typeof v2GetDisplayName==="function"?'👦 '+v2GetDisplayName('boy'):'👦 Lui');
    // Mettre à jour les labels du popup (moi à gauche, adversaire à droite)
    var lblLeft  = document.getElementById('skyjoRoundLabelLeft');
    var lblRight = document.getElementById('skyjoRoundLabelRight');
    if(lblLeft)  lblLeft.textContent  = myName2;
    if(lblRight) lblRight.textContent = oppName2;
    document.getElementById('skyjoRoundScoreGirl').textContent='+'+myR;
    document.getElementById('skyjoRoundScoreBoy').textContent='+'+oppR;
    document.getElementById('skyjoTotalScoreGirl').textContent=myT+' pts';
    document.getElementById('skyjoTotalScoreBoy').textContent=oppT+' pts';
    var btn=document.getElementById('skyjoNextRoundBtn');
    var msg=document.getElementById('skyjoWaitNextMsg');
    if(btn){ btn.disabled=false; btn.textContent='Manche suivante →'; btn.style.display='block'; }
    if(msg) msg.style.display='none';
    _waitingNextRound=true;
    document.getElementById('skyjoRoundEnd').style.display='flex';
  }

  window.skyjoNextRound=function(){
    // Les deux joueurs peuvent lancer la manche suivante (premier arrivé)
    var btn=document.getElementById('skyjoNextRoundBtn');
    if(btn){ btn.disabled=true; btn.textContent='Chargement…'; }
    stopPoll();
    // Sauvegarder le score de la manche pour l'afficher discrètement en jeu
    var prevRg=_gameState&&_gameState.round_scores?_gameState.round_scores.girl:null;
    var prevRb=_gameState&&_gameState.round_scores?_gameState.round_scores.boy:null;
    var deck=buildDeck();
    var gc=dealHand(deck),bc=dealHand(deck);
    var top=deck.pop();
    var ns={
      deck:deck,discard:[top],
      girl_cards:gc,boy_cards:bc,
      phase:'init1',
      turn:_gameState?((_gameState.round_closer==='girl'?'boy':'girl')):'girl',
      round:_gameState?(_gameState.round||1)+1:2,
      scores:_gameState?_gameState.scores:{girl:0,boy:0},
      held_card:null,must_flip:null,last_player:null,round_closer:null
    };
    fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+_gameId,{
      method:'PATCH',
      headers:sb2Headers({'Prefer':'return=representation'}),
      body:JSON.stringify({status:'playing',state:ns})
    })
    .then(function(r){return r.json();})
    .then(function(rows){
      if(Array.isArray(rows)&&rows[0]){
        _waitingNextRound=false;
        document.getElementById('skyjoRoundEnd').style.display='none';
        // Score manche préc. géré par renderState depuis state.round_scores
        startPoll();
        renderState(rows[0]);
      }
    }).catch(function(){});
  };

  // ─── Fin de partie ───────────────────────────────────
  function showGameEnd(state){
    document.getElementById('skyjoRoundEnd').style.display='none';
    var btn=document.getElementById('skyjoAbandonBtn'); if(btn) btn.style.display='none';
    var gg=state.scores.girl,gb=state.scores.boy;
    var isDraw=gg===gb;
    var girlWins=gg<gb;
    document.getElementById('skyjoGameEndEmoji').textContent=isDraw?'🤝':(girlWins?'👧':'👦');
    document.getElementById('skyjoGameEndTitle').textContent=isDraw?'Égalité !':(girlWins?(typeof v2GetDisplayName==="function"?v2GetDisplayName('girl')+' 👧':'Elle 👧'):(typeof v2GetDisplayName==="function"?v2GetDisplayName('boy')+' 👦':'Lui 👦'))+' gagne la partie !';
    // Afficher MOI à gauche (Girl-slot), ADVERSAIRE à droite (Boy-slot)
    var myFinal  = _me==='girl' ? gg : gb;
    var oppFinal = _me==='girl' ? gb : gg;
    var myFinalWins  = myFinal < oppFinal;
    var oppFinalWins = oppFinal < myFinal;
    document.getElementById('skyjoFinalScoreGirl').textContent=myFinal;
    document.getElementById('skyjoFinalScoreBoy').textContent=oppFinal;
    // Labels fin de partie (moi à gauche, adversaire à droite)
    var fLblLeft  = document.getElementById('skyjoFinalLabelLeft');
    var fLblRight = document.getElementById('skyjoFinalLabelRight');
    if(fLblLeft)  fLblLeft.textContent  = (typeof v2GetDisplayName==="function"?v2GetDisplayName(_me):(_me==="girl"?"Elle":"Lui"));
    if(fLblRight) fLblRight.textContent = (typeof v2GetDisplayName==="function"?v2GetDisplayName(_me==="girl"?"boy":"girl"):(_me==="girl"?"Lui":"Elle"));
    var fEmoLeft  = document.getElementById('skyjoFinalEmojiLeft');
    var fEmoRight = document.getElementById('skyjoFinalEmojiRight');
    if(fEmoLeft)  fEmoLeft.textContent  = _me==='girl'?'👧':'👦';
    if(fEmoRight) fEmoRight.textContent = _me==='girl'?'👦':'👧';
    // Mettre en valeur le gagnant (score le plus bas)
    var cardG=document.getElementById('skyjoFinalScoreGirl').parentElement;
    var cardB=document.getElementById('skyjoFinalScoreBoy').parentElement;
    cardG.style.borderColor=''; cardG.style.background='';
    cardB.style.borderColor=''; cardB.style.background='';
    if(!isDraw){
      if(myFinalWins)  { cardG.style.borderColor='var(--green)'; cardG.style.background='rgba(0,201,167,0.1)'; }
      else             { cardB.style.borderColor='var(--green)'; cardB.style.background='rgba(0,201,167,0.1)'; }
    }
    document.getElementById('skyjoGameEnd').style.display='flex';
  }

  window.skyjoNewGame=function(){
    if(!_gameId) return;
    stopPoll();
    fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+_gameId,{
      method:'DELETE',headers:sb2Headers()
    }).then(function(){
      document.getElementById('skyjoGameEnd').style.display='none';
      enterLobby();
    }).catch(function(){});
  };

  // ─── Fermeture ───────────────────────────────────────
  // ─── Alerte modale légère ───────────────────────────
  var _waitingForReconnect = false;
  var _reconnectTimer = null;
  var _reconnectSeconds = 0;
  var _waitingNextRound = false; // boy attend que girl lance la manche suivante
  var _roundEndShown   = false; // évite double déclenchement showRoundEnd

  var RECONNECT_GRACE_S = 20; // secondes supplémentaires après "Attendre"

  function startReconnectWait(){
    _reconnectSeconds = RECONNECT_GRACE_S;
    // Créer un modal dédié au compte à rebours (l'ancien modal "Attendre/Quitter" est déjà fermé)
    _showCountdownModal(_reconnectSeconds);
    _reconnectTimer = setInterval(function(){
      _reconnectSeconds--;
      // Mettre à jour l'affichage du compte à rebours
      var el = document.getElementById('skyjoCountdownLabel');
      if(el) el.textContent = 'Retour en jeu dans : ' + _reconnectSeconds + 's…';
      if(_reconnectSeconds <= 0){
        // Temps écoulé → abandon forcé
        stopReconnectWait();
        _waitingForReconnect = false;
        stopAll();
        var gid = _gameId; // sauvegarder avant resetState
        var wb = document.getElementById('skyjoCountdownModal');
        if(wb) document.body.removeChild(wb);
        resetState();
        // Supprimer la partie côté Supabase
        if(gid){
          fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+gid,{
            method:'DELETE', headers:sb2Headers()
          }).catch(function(){});
        }
        showSkyjoAlert('\u23f0', 'Temps écoulé — Partie terminée', function(){ enterLobby(); });
      }
    }, 1000);
  }
  function _showCountdownModal(seconds){
    // Supprimer un éventuel modal précédent
    var old = document.getElementById('skyjoCountdownModal');
    if(old) document.body.removeChild(old);

    var overlay = document.createElement('div');
    overlay.id = 'skyjoCountdownModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:1200;display:flex;align-items:center;justify-content:center;padding:24px';

    var box = document.createElement('div');
    box.style.cssText = 'background:var(--s1);border:1px solid var(--border);border-radius:16px;padding:24px 20px;max-width:300px;width:100%;text-align:center;font-family:DM Sans,sans-serif';

    var emojiEl = document.createElement('div');
    emojiEl.textContent = '⏳';
    emojiEl.style.cssText = 'font-size:32px;margin-bottom:8px';
    box.appendChild(emojiEl);

    var titleEl = document.createElement('div');
    titleEl.textContent = 'En attente…';
    titleEl.style.cssText = 'font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px';
    box.appendChild(titleEl);

    var countEl = document.createElement('div');
    countEl.id = 'skyjoCountdownLabel';
    countEl.textContent = 'Retour en jeu dans : ' + seconds + 's…';
    countEl.style.cssText = 'font-size:13px;color:var(--muted);margin-bottom:18px;line-height:1.5';
    box.appendChild(countEl);

    var btn = document.createElement('button');
    btn.textContent = 'Abandonner';
    btn.style.cssText = 'padding:10px 24px;background:rgba(239,83,80,0.12);color:#ef5350;border:1px solid rgba(239,83,80,0.35);border-radius:50px;font-size:13px;font-weight:700;font-family:DM Sans,sans-serif;cursor:pointer';
    btn.onclick = function(){
      stopReconnectWait();
      _waitingForReconnect = false;
      stopAll();
      var gid = _gameId;
      document.body.removeChild(overlay);
      resetState();
      if(gid){
        fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+gid,{
          method:'DELETE', headers:sb2Headers()
        }).catch(function(){});
      }
      document.getElementById('skyjoView').classList.remove('active');
      document.querySelector('.bottom-nav').style.display='';
    };
    box.appendChild(btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }
  function stopReconnectWait(){
    if(_reconnectTimer){ clearInterval(_reconnectTimer); _reconnectTimer = null; }
  }
  function fetchStateForReconnect(){ /* no-op — géré par fetchState */ }

  /* Modale simple — showSkyjoAlert('emoji', 'titre', cb) ou ('emoji titre', cb) */
  function showSkyjoAlert(emojiOrMsg, titleOrCb, cb){
    var emoji, title, callback;
    if(typeof titleOrCb === 'function' || titleOrCb == null){
      var parts = emojiOrMsg.split(' ');
      emoji = parts[0]; title = parts.slice(1).join(' '); callback = titleOrCb;
    } else {
      emoji = emojiOrMsg; title = titleOrCb; callback = cb;
    }
    _buildModal(emoji, title, '', [{ label: 'OK', primary: true, action: callback }]);
  }

  /* Modale avec deux boutons */
  function showSkyjoChoice(emoji, title, subtitle, btnA, cbA, btnB, cbB){
    _buildModal(emoji, title, subtitle, [
      { label: btnA, primary: false, action: cbA },
      { label: btnB, primary: false, danger: true, action: cbB }
    ]);
  }

  /* Constructeur DOM commun — zéro apostrophe imbriquée */
  function _buildModal(emoji, title, subtitle, buttons){
    var overlay = document.createElement('div');
    overlay.id = 'skyjoWaitModal';
    overlay.style.cssText = [
      'position:fixed','inset:0','background:rgba(0,0,0,0.72)',
      'z-index:1200','display:flex','align-items:center',
      'justify-content:center','padding:24px'
    ].join(';');

    var box = document.createElement('div');
    box.style.cssText = [
      'background:var(--s1)','border:1px solid var(--border)',
      'border-radius:16px','padding:24px 20px','max-width:300px',
      'width:100%','text-align:center','font-family:DM Sans,sans-serif'
    ].join(';');

    var emojiEl = document.createElement('div');
    emojiEl.textContent = emoji;
    emojiEl.style.cssText = 'font-size:32px;margin-bottom:8px';
    box.appendChild(emojiEl);

    var titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.cssText = 'font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px';
    box.appendChild(titleEl);

    if(subtitle){
      var subEl = document.createElement('div');
      subEl.textContent = subtitle;
      subEl.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:6px;line-height:1.5';
      box.appendChild(subEl);
    }

    var timerEl = document.createElement('div');
    timerEl.id = 'skyjoWaitModalTimer';
    timerEl.style.cssText = 'font-size:11px;color:var(--muted);margin-bottom:18px;min-height:16px';
    box.appendChild(timerEl);

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;justify-content:center';
    buttons.forEach(function(b){
      var btn = document.createElement('button');
      btn.textContent = b.label;
      var bg = b.primary ? 'var(--green)' : b.danger ? 'rgba(239,83,80,0.12)' : 'var(--s2)';
      var col = b.primary ? '#000' : b.danger ? '#ef5350' : 'var(--text)';
      var border = b.danger ? '1px solid rgba(239,83,80,0.35)' : '1px solid var(--border)';
      btn.style.cssText = [
        'flex:1','padding:10px 0','background:'+bg,'color:'+col,
        'font-weight:700','font-size:13px','font-family:DM Sans,sans-serif',
        'border:'+border,'border-radius:50px','cursor:pointer'
      ].join(';');
      btn.onclick = function(){
        document.body.removeChild(overlay);
        if(b.action) b.action();
      };
      row.appendChild(btn);
    });
    box.appendChild(row);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // ─── Abandon en cours de partie ──────────────────────
  window.skyjoAbandon=function(){
    showSkyjoChoice(
      '🏳️', 'Abandonner ?', 'La partie sera supprimée, l’autre joueur en sera informé.',
      'Annuler', null,
      'Confirmer', function(){
        stopAll(); stopReconnectWait(); _waitingForReconnect=false;
        deletePresence();
        if(_gameId){
          // 1) Signaler l'abandon → l'adversaire le voit instantanément
          // 2) Supprimer la partie 3s après pour lui laisser le temps de lire
          var gid = _gameId;
          fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+gid,{
            method:'PATCH',
            headers:sb2Headers({'Prefer':'return=minimal'}),
            body:JSON.stringify({status:'abandoned'})
          }).catch(function(){});
          setTimeout(function(){
            fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+gid,{
              method:'DELETE',headers:sb2Headers()
            }).catch(function(){});
          }, 3000);
        }
        resetState();
        var btn=document.getElementById('skyjoAbandonBtn');
        if(btn) btn.style.display='none';
        _yamSlide(document.getElementById('gamesView'), document.getElementById('skyjoView'), 'backward');
        document.querySelector('.bottom-nav').style.display='';
      }
    );
  };

  // ─── Afficher/cacher le bouton Abandon selon l'écran ─
  var _origShowScreen = showScreen;
  // (déjà défini plus haut — on patch renderState pour afficher le bouton en jeu)

  // Expose les fonctions de refresh de taux pour le module bg-pause externe
  window._skyjoRefreshRates = function(){
    _refreshPollRate();
    _refreshPresenceRate();
  };
  // Supprime / remet la présence — appelé par pauseSkyjo/resumeSkyjo
  window._skyjoDeletePresence = deletePresence;
  window._skyjoUpsertPresence = upsertPresence;
  // Enregistre l'heure exacte de départ de la page
  window._skyjoMarkAbsence = function(){
    if(_launched && _absenceStart === 0) _absenceStart = Date.now();
  };

  window.closeSkyjoGame=function(){
    stopAll(); stopReconnectWait(); _waitingForReconnect=false;
    deletePresence();
    // Supprimer UNIQUEMENT les parties en attente (waiting)
    // Les parties en cours (playing) restent dans Supabase → l'autre peut attendre le retour
    if(_gameId && _phase !== 'play' && _phase !== 'init1' && _phase !== 'roundEnd'){
      fetch(SB2_URL+'/rest/v1/'+SKYJO_TABLE+'?id=eq.'+_gameId+'&status=eq.waiting',{
        method:'DELETE',headers:sb2Headers()
      }).catch(function(){});
    }
    resetState();
    _yamSlide(document.getElementById('gamesView'), document.getElementById('skyjoView'), 'backward');
    document.querySelector('.bottom-nav').style.display='';
  };

})();

/* ══════════════════════════════════════════════════════════════
   SKYJO — OPTIMISATION CPU : pause complète quand page cachée
   - Animations CSS pausées via body.skyjo-bg-paused
   - Poll jeu : 2s → 15s (ou stop si pas de partie active)
   - Heartbeat présence : 4s → 30s
   - Reprend immédiatement au retour sur la page
   v3.6
══════════════════════════════════════════════════════════════ */
(function(){
  var _skyjoView = null;
  function getSkyjoView(){ return _skyjoView || (_skyjoView = document.getElementById('skyjoView')); }
  var _isSkyjoOpen = false;

  // Surveille l'état du jeu pour savoir si Skyjo est actif
  var _skyjoViewObs = new MutationObserver(function(){
    _isSkyjoOpen = getSkyjoView() ? getSkyjoView().classList.contains('active') : false;
  });
  var sv = document.getElementById('skyjoView');
  if(sv) _skyjoViewObs.observe(sv, { attributes:true, attributeFilter:['class'] });

  function isSkyjoActive(){
    return sv ? sv.classList.contains('active') : false;
  }

  function pauseSkyjo(){
    document.body.classList.add('skyjo-bg-paused');
    document.querySelectorAll('.sj-fly-clone, .sj-particle').forEach(function(el){
      el.style.animationPlayState = 'paused';
    });
    // Supprimer la présence → table vide si les deux sont absents
    if(typeof window._skyjoDeletePresence === 'function') window._skyjoDeletePresence();
    if(typeof window._skyjoRefreshRates === 'function') window._skyjoRefreshRates();
  }

  function resumeSkyjo(){
    document.body.classList.remove('skyjo-bg-paused');
    document.querySelectorAll('.sj-fly-clone, .sj-particle').forEach(function(el){
      el.style.animationPlayState = '';
    });
    // Remettre la présence immédiatement au retour
    if(typeof window._skyjoUpsertPresence === 'function') window._skyjoUpsertPresence();
    if(typeof window._skyjoRefreshRates === 'function') window._skyjoRefreshRates();
  }

  // visibilitychange : déclenché sur onglet caché, changement d'app, veille écran
  document.addEventListener('visibilitychange', function(){
    if(!isSkyjoActive()) return;
    if(document.hidden){
      pauseSkyjo();
    } else {
      resumeSkyjo();
    }
  });

  // pagehide : déclenché quand on quitte le navigateur, ou navigation BFCache (iOS Safari/Chrome)
  window.addEventListener('pagehide', function(){
    if(!isSkyjoActive()) return;
    pauseSkyjo();
  });

  // pageshow : retour depuis BFCache
  window.addEventListener('pageshow', function(e){
    if(!isSkyjoActive()) return;
    if(!document.hidden) resumeSkyjo();
  });

  // blur/focus : Chrome mobile sur Android quitte sans déclencher visibilitychange parfois
  window.addEventListener('blur', function(){
    if(!isSkyjoActive()) return;
    pauseSkyjo();
  });
  window.addEventListener('focus', function(){
    if(!isSkyjoActive()) return;
    if(!document.hidden) resumeSkyjo();
  });

  console.log('⚡ [v3.6] Skyjo bg-pause: visibilitychange+pagehide+blur/focus installés');
})();
