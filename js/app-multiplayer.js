// app-multiplayer.js — Moteur multijoueur partagé YAM
// Version 1.0 — Extrait de app-skyjo.js — Février 2026
// Dépendances (chargées avant) : app-core.js, app-account.js
// Globals utilisés : SB_URL, sb2Headers(), getProfile(), v2GetDisplayName(),
//                    _yamSlide(), showToast(), haptic()
//
// Fournit YAMMultiplayer.init({...}) — API générique pour tous les jeux multijoueur
// Utilisé par : app-skyjo.js (Skyjo), app-uno.js (futur Uno), etc.

/* ══════════════════════════════════════════════════════
   YAM MULTIPLAYER ENGINE — Moteur réseau temps réel
   Gère : présence, lobby, matchmaking, poll, saveState,
           abandon, reconnexion, modales génériques
══════════════════════════════════════════════════════ */
(function(){

  // ─── API publique ─────────────────────────────────────
  // Appelé par chaque jeu pour s'enregistrer auprès du moteur
  window.YAMMultiplayer = {

    /**
     * Initialise le moteur pour un jeu donné.
     * @param {object} config
     *   config.gameTable        {string}   — nom de la table Supabase des parties
     *   config.presenceTable    {string}   — nom de la table de présence
     *   config.abandonBtn       {string}   — id du bouton abandon (optionnel)
     *   config.buildInitialState {function} — retourne l'état JSON initial d'une nouvelle partie
     *   config.onMatchFound     {function(gameRow)} — appelé quand la partie commence
     *   config.onStateUpdate    {function(gameRow)} — appelé à chaque mise à jour d'état
     *   config.onOpponentOffline {function}  — appelé quand l'adversaire décroche (optionnel)
     *   config.onBothAbsent     {function}  — appelé après 40s d'absence des deux (optionnel)
     *   config.onAbandon        {function}  — appelé quand l'adversaire abandonne (optionnel)
     * @returns {object} handle — { saveState, enterLobby, stopAll, resetState, getGameId, getMe, getOther, showAlert, showChoice }
     */
    init: function(config) {
      return _createEngine(config);
    }
  };

  // ─── Fabrique d'instance moteur ──────────────────────
  function _createEngine(cfg) {

    var GAME_TABLE     = cfg.gameTable;
    var PRESENCE_TABLE = cfg.presenceTable;

    // ─── État interne ──────────────────────────────────
    var _gameId        = null;
    var _me            = null;   // 'girl' | 'boy'
    var _other         = null;
    var _gameState     = null;
    var _launched      = false;
    var _saving        = false;  // verrou pendant PATCH

    var _presTimer     = null;
    var _lobbyTimer    = null;
    var _pollTimer     = null;
    var _rtChannel     = null;  // channel Realtime game state
    var _oppGoneTimer  = null;
    var OPP_GRACE_MS   = 20000;
    var _presenceActive = false; // verrou : bloque upsertPresence après stopAll/leave

    var _waitingForReconnect = false;
    var _reconnectTimer      = null;
    var _reconnectSeconds    = 0;
    var RECONNECT_GRACE_S    = 20;

    var _bothAbsentHandled = false;
    var BOTH_ABSENT_TIMEOUT_MS = cfg.bothAbsentTimeout || 40000;

    var _lastPresenceSent = 0;
    var _absenceStart     = 0;

    // ─── Helpers session ──────────────────────────────
    function _getCoupleId(){
      var s = yamGetUser ? {user: yamGetUser()} : null;
      return s && s.user ? s.user.couple_id : null;
    }

    // ─── Reset complet ────────────────────────────────
    function resetState(){
      _gameId  = null;
      _gameState = null;
      _launched  = false;
      _saving    = false;
      _bothAbsentHandled = false;
      _lastPresenceSent  = 0;
      _absenceStart      = 0;
      if(_oppGoneTimer){ clearTimeout(_oppGoneTimer);  _oppGoneTimer  = null; }
    }

    // ─── Stop tous les timers ─────────────────────────
    function stopAll(){
      _presenceActive = false;
      if(_presTimer)  { clearInterval(_presTimer);   _presTimer   = null; }
      if(_lobbyTimer) { clearInterval(_lobbyTimer);  _lobbyTimer  = null; }
      if(_pollTimer)  { clearInterval(_pollTimer);   _pollTimer   = null; }
      if(_oppGoneTimer){ clearTimeout(_oppGoneTimer); _oppGoneTimer = null; }
      _stopRTChannel();
    }

    function stopPoll(){
      if(_pollTimer){ clearInterval(_pollTimer); _pollTimer = null; }
      _stopRTChannel();
    }

    // ─── Présence ─────────────────────────────────────
    function startPresence(){
      _presenceActive = true;
      upsertPresence();
      var interval = document.hidden ? 30000 : 4000;
      _presTimer = setInterval(upsertPresence, interval);
    }

    function _refreshPresenceRate(){
      if(!document.hidden && _presTimer){
        clearInterval(_presTimer); _presTimer = null;
        setTimeout(function(){
          if(!_me) return;
          upsertPresence();
          _presTimer = setInterval(upsertPresence, 4000);
        }, 3000);
      }
    }

    function upsertPresence(){
      if(!_presenceActive) return; // stopAll/leave a désactivé la présence
      if(!_me) return;
      if(document.hidden) return;
      _lastPresenceSent = Date.now();
      var coupleId = _getCoupleId();
      if(!coupleId) return;
      fetch(SB_URL+'/rest/v1/'+PRESENCE_TABLE, {
        method:'POST',
        headers: sb2Headers({'Prefer':'resolution=merge-duplicates,return=minimal'}),
        body: JSON.stringify({profile:_me, couple_id:coupleId, updated_at:new Date().toISOString()})
      }).catch(function(){});
    }

    function deletePresence(){
      if(!_me) return;
      var coupleId = _getCoupleId();
      if(!coupleId) return;
      // 1) Patch updated_at dans le passé (-60s) : ainsi même si le DELETE race-conditionne
      //    avec un dernier heartbeat, fetchState() voit un timestamp trop vieux → isOnline=false immédiat
      var staleTime = new Date(Date.now() - 60000).toISOString();
      fetch(SB_URL+'/rest/v1/'+PRESENCE_TABLE+'?couple_id=eq.'+coupleId+'&role=eq.'+_me, {
        method:'PATCH', headers:sb2Headers({'Prefer':'return=minimal'}),
        body: JSON.stringify({updated_at: staleTime})
      }).catch(function(){});
      // 2) Puis DELETE pour nettoyer la ligne
      fetch(SB_URL+'/rest/v1/'+PRESENCE_TABLE+'?couple_id=eq.'+coupleId+'&role=eq.'+_me, {
        method:'DELETE', headers:sb2Headers(), keepalive:true
      }).catch(function(){});
    }

    // ─── Poll rates ───────────────────────────────────
    function refreshRates(){
      _refreshPollRate();
      _refreshPresenceRate();
    }

    function _refreshPollRate(){
      var newInterval = document.hidden ? 15000 : 2000;
      if(_pollTimer){ clearInterval(_pollTimer); _pollTimer = null; }
      if(!document.hidden && _launched){
        fetchState();
        _pollTimer = setInterval(fetchState, newInterval);
      }
    }

    // ─── Entrée dans l'app (après auth) ───────────────
    function enter(profile){
      _me    = profile || getProfile();
      _other = _me==='girl' ? 'boy' : 'girl';
      enterLobby();
    }

    // ─── Lobby ────────────────────────────────────────
    function enterLobby(){
      stopAll();
      resetState();
      _me    = _me || getProfile();
      _other = _me==='girl' ? 'boy' : 'girl';

      var coupleId = _getCoupleId();
      if(!coupleId){
        if(cfg.onError) cfg.onError('Session expirée — reconnectez-vous');
        return;
      }

      Promise.all([
        fetch(SB_URL+'/rest/v1/'+GAME_TABLE+'?couple_id=eq.'+coupleId+'&status=eq.playing&order=created_at.desc&limit=1&select=id,status,state,created_by,updated_at', {headers:sb2Headers()}).then(function(r){return r.json();}),
        fetch(SB_URL+'/rest/v1/'+PRESENCE_TABLE+'?couple_id=eq.'+coupleId+'&select=profile', {headers:sb2Headers()}).then(function(r){return r.json();})
      ])
      .then(function(results){
        var rows     = results[0];
        var presRows = results[1];
        var presenceEmpty = !Array.isArray(presRows) || presRows.length === 0;

        // Partie trop ancienne → considérée comme fantôme même si présence non vide
        var isStale = false;
        if(cfg.staleGameMinutes && Array.isArray(rows) && rows[0] && rows[0].updated_at){
          var ageMs = Date.now() - new Date(rows[0].updated_at).getTime();
          isStale = ageMs > cfg.staleGameMinutes * 60 * 1000;
        }

        if(Array.isArray(rows) && rows[0]){
          if(presenceEmpty || isStale){
            // Partie fantôme → supprimer
            fetch(SB_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+rows[0].id, {
              method:'DELETE', headers:sb2Headers()
            }).catch(function(){});
          } else {
            // Partie valide → rejoindre directement
            _gameId   = rows[0].id;
            _launched = true;
            startPresence();
            if(cfg.onMatchFound) cfg.onMatchFound(rows[0]);
            startPoll();
            return;
          }
        }
        // Salle d'attente
        cleanMyOldGames(function(){
          startPresence();
          startLobbyPoll();
        });
        if(cfg.onWaiting) cfg.onWaiting(_me, _other);
      })
      .catch(function(){
        cleanMyOldGames(function(){
          startPresence();
          startLobbyPoll();
        });
        if(cfg.onWaiting) cfg.onWaiting(_me, _other);
      });
    }

    function cleanMyOldGames(cb){
      var coupleId = _getCoupleId();
      if(!coupleId){ if(cb)cb(); return; }
      fetch(SB_URL+'/rest/v1/'+GAME_TABLE+'?couple_id=eq.'+coupleId+'&status=eq.waiting&created_by=eq.'+_me, {
        method:'DELETE', headers:sb2Headers()
      }).then(function(){ if(cb)cb(); }).catch(function(){ if(cb)cb(); });
    }

    // ─── Lobby Poll ───────────────────────────────────
    function startLobbyPoll(){
      lobbyTick();
      _lobbyTimer = setInterval(lobbyTick, 2500);
    }

    function lobbyTick(){
      if(_launched){ stopAll(); return; }

      if(_gameId){
        fetch(SB_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+_gameId+'&select=id,status,state,created_by', {headers:sb2Headers()})
        .then(function(r){return r.json();})
        .then(function(rows){
          if(_launched) return;
          if(!Array.isArray(rows)||!rows[0]) return;
          if(rows[0].status==='playing') launchGame(rows[0]);
          if(cfg.onLobbyTick) cfg.onLobbyTick(true, true);
        }).catch(function(){});
        return;
      }

      var coupleId = _getCoupleId();
      if(!coupleId) return;
      fetch(SB_URL+'/rest/v1/'+PRESENCE_TABLE+'?couple_id=eq.'+coupleId+'&select=profile,updated_at', {headers:sb2Headers()})
      .then(function(r){return r.json();})
      .then(function(rows){
        if(_launched) return;
        if(!Array.isArray(rows)) return;
        var now = Date.now();
        var girlOk=false, boyOk=false;
        rows.forEach(function(row){
          if(now - new Date(row.updated_at).getTime() < 10000){
            if(row.profile==='girl') girlOk=true;
            if(row.profile==='boy')  boyOk=true;
          }
        });
        if(cfg.onLobbyTick) cfg.onLobbyTick(girlOk, boyOk);
        if(girlOk && boyOk) doMatchmaking();
      }).catch(function(){});
    }

    // ─── Matchmaking ──────────────────────────────────
    function doMatchmaking(){
      if(_launched) return;
      var coupleId = _getCoupleId();
      if(!coupleId) return;

      fetch(SB_URL+'/rest/v1/'+GAME_TABLE+'?couple_id=eq.'+coupleId+'&status=in.(waiting,playing)&order=created_at.desc&limit=1&select=id,status,state,created_by', {headers:sb2Headers()})
      .then(function(r){return r.json();})
      .then(function(rows){
        if(_launched) return;
        var game = Array.isArray(rows) && rows.length>0 ? rows[0] : null;

        if(game && game.status==='playing'){
          _gameId = game.id;
          launchGame(game);
          return;
        }
        if(game && game.status==='waiting'){
          if(game.created_by===_me){
            _gameId = game.id;
            return;
          } else {
            _gameId = game.id;
            fetch(SB_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+game.id+'&status=eq.waiting', {
              method:'PATCH',
              headers: sb2Headers({'Prefer':'return=representation'}),
              body: JSON.stringify({status:'playing'})
            })
            .then(function(r){return r.json();})
            .then(function(updated){
              if(_launched) return;
              if(!Array.isArray(updated)||!updated[0]) return;
              launchGame(updated[0]);
            }).catch(function(){});
            return;
          }
        }
        if(!game) createNewGame();
      }).catch(function(){});
    }

    function createNewGame(){
      if(_launched||_gameId) return;
      var coupleId = _getCoupleId();
      if(!coupleId) return;
      var initialState = cfg.buildInitialState ? cfg.buildInitialState() : {};
      fetch(SB_URL+'/rest/v1/'+GAME_TABLE, {
        method:'POST',
        headers: sb2Headers({'Prefer':'return=representation'}),
        body: JSON.stringify({couple_id:coupleId, status:'waiting', created_by:_me, state:initialState})
      })
      .then(function(r){return r.json();})
      .then(function(rows){
        if(Array.isArray(rows) && rows[0] && !_launched) _gameId = rows[0].id;
      }).catch(function(){});
    }

    // ─── Lancement en jeu ─────────────────────────────
    function launchGame(gameRow){
      if(_launched) return;
      _launched = true;
      _gameId   = gameRow.id;
      if(_lobbyTimer){ clearInterval(_lobbyTimer); _lobbyTimer = null; }
      if(_pollTimer)  { clearInterval(_pollTimer);  _pollTimer  = null; }
      if(!_presTimer){ upsertPresence(); _presTimer = setInterval(upsertPresence, 4000); }
      if(cfg.onMatchFound) cfg.onMatchFound(gameRow);
      startPoll();
    }

    // ─── Poll état jeu ────────────────────────────────
    function startPoll(){
      if(_pollTimer){ clearInterval(_pollTimer); _pollTimer = null; }
      var interval = document.hidden ? 15000 : 2000;
      _pollTimer = setInterval(fetchState, interval);
      _startRTChannel();
    }

    function _startRTChannel(){
      if(!_gameId || _rtChannel) return;
      if(!window._yamRT){
        // _yamRT pas encore prêt — réessayer dans 1s
        setTimeout(_startRTChannel, 1000);
        return;
      }
      _rtChannel = window._yamRT
        .channel('game_state_' + _gameId)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: GAME_TABLE,
          filter: 'id=eq.' + _gameId
        }, function(){
          if(!_saving) fetchState();
        })
        .subscribe(function(status){
          yamLog('[RT] game_state ' + _gameId + ' ' + status);
          if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED'){
            _rtChannel = null;
            if(window._yamRTChannels) delete window._yamRTChannels['game_state_' + _gameId];
          }
        });
      if(window._yamRTChannels) window._yamRTChannels['game_state_' + _gameId] = _rtChannel;
    }

    function _stopRTChannel(){
      if(_rtChannel){
        try{ if(window._yamRT) window._yamRT.removeChannel(_rtChannel); }catch(e){}
        if(window._yamRTChannels) delete window._yamRTChannels['game_state_' + _gameId];
        _rtChannel = null;
      }
    }

    function fetchState(){
      if(!_gameId || _saving) return;
      var oppKey   = _me==='girl' ? 'boy' : 'girl';
      var coupleId = _getCoupleId();
      if(!coupleId) return;

      Promise.all([
        fetch(SB_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+_gameId+'&select=id,status,state,created_by', {headers:sb2Headers()}).then(function(r){return r.json();}),
        fetch(SB_URL+'/rest/v1/'+PRESENCE_TABLE+'?couple_id=eq.'+coupleId+'&select=profile,updated_at', {headers:sb2Headers()}).then(function(r){return r.json();})
      ])
      .then(function(results){
        if(_saving) return;
        var rows    = results[0];
        var allPres = results[1];
        var presRows  = Array.isArray(allPres) ? allPres.filter(function(p){ return p.profile===oppKey; }) : [];
        var myPresRows= Array.isArray(allPres) ? allPres.filter(function(p){ return p.profile===_me;    }) : [];

        // Notifier le jeu de la présence adversaire
        var isOnline = presRows[0] && (Date.now() - new Date(presRows[0].updated_at).getTime()) < 15000;
        if(cfg.onPresenceUpdate) cfg.onPresenceUpdate(isOnline);

        // ── Les DEUX joueurs absents depuis +40s ──────────
        var now = Date.now();
        var myLastSeen  = myPresRows[0]  ? now - new Date(myPresRows[0].updated_at).getTime()  : 99999999;
        var oppLastSeen = presRows[0]    ? now - new Date(presRows[0].updated_at).getTime()    : 99999999;
        var bothAbsent  = myLastSeen > BOTH_ABSENT_TIMEOUT_MS && oppLastSeen > BOTH_ABSENT_TIMEOUT_MS;

        if(bothAbsent && !_bothAbsentHandled && _launched){
          _bothAbsentHandled = true;
          stopAll();
          var gid = _gameId;
          resetState();
          if(gid){
            fetch(SB_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+gid, {method:'DELETE', headers:sb2Headers()}).catch(function(){});
          }
          fetch(SB_URL+'/rest/v1/'+PRESENCE_TABLE+'?couple_id=eq.'+coupleId, {method:'DELETE', headers:sb2Headers()}).catch(function(){});
          if(cfg.onBothAbsent){
            cfg.onBothAbsent();
          } else {
            showAlert('⏱️', 'Partie expirée — les deux joueurs étaient absents', function(){
              _bothAbsentHandled = false;
              enterLobby();
            });
          }
          return;
        }

        // ── Adversaire hors-ligne : timer de grâce ────────
        if(!isOnline && !_waitingForReconnect && !_oppGoneTimer &&
           !document.getElementById(cfg.waitModalId||'yamWaitModal') &&
           !document.getElementById(cfg.countdownModalId||'yamCountdownModal')){
          _oppGoneTimer = setTimeout(function(){
            _oppGoneTimer = null;
            if(!_launched || _waitingForReconnect) return;
            if(document.getElementById(cfg.waitModalId||'yamWaitModal') ||
               document.getElementById(cfg.countdownModalId||'yamCountdownModal')) return;
            var oppName = (typeof v2GetDisplayName==='function' ? v2GetDisplayName(_me==='girl'?'boy':'girl') : (_me==='girl'?'Lui':'Elle'));
            if(cfg.onOpponentOffline){
              cfg.onOpponentOffline(oppName);
            } else {
              showChoice(
                '😔', oppName+' est déconnecté(e)',
                'Connexion perdue. Tu peux attendre son retour ou quitter la partie.',
                'Attendre', function(){ _waitingForReconnect = true; startPoll(); startReconnectWait(); },
                'Quitter',  function(){ _waitingForReconnect = false; _doLeave(); }
              );
            }
          }, OPP_GRACE_MS);
        }

        // ── Adversaire revenu ─────────────────────────────
        if(isOnline && _oppGoneTimer && !_waitingForReconnect){
          clearTimeout(_oppGoneTimer);
          _oppGoneTimer = null;
        }

        // ── Abandon volontaire de l'adversaire ────────────
        if(Array.isArray(rows) && rows[0] && rows[0].status==='abandoned'){
          stopPoll();
          stopReconnectWait();
          _waitingForReconnect = false;
          if(_oppGoneTimer){ clearTimeout(_oppGoneTimer); _oppGoneTimer=null; }
          var wm = document.getElementById(cfg.countdownModalId||'yamCountdownModal') ||
                   document.getElementById(cfg.waitModalId||'yamWaitModal');
          if(wm) document.body.removeChild(wm);
          resetState();
          if(cfg.onAbandon){
            cfg.onAbandon();
          } else {
            showAlert('🏳️', 'Partie abandonnée', function(){ enterLobby(); });
          }
          return;
        }

        // ── Partie introuvable ────────────────────────────
        if(!Array.isArray(rows)||!rows[0]){
          if(_waitingForReconnect) return;
          return;
        }

        // ── Reprendre après reconnexion ───────────────────
        if(_waitingForReconnect){
          if(!isOnline) return;
          _waitingForReconnect = false;
          stopReconnectWait();
          var wb = document.getElementById(cfg.countdownModalId||'yamCountdownModal');
          if(wb) document.body.removeChild(wb);
        }

        // ── Notifier le jeu ───────────────────────────────
        if(cfg.onStateUpdate) cfg.onStateUpdate(rows[0]);
      }).catch(function(){});
    }

    // ─── saveState ────────────────────────────────────
    function saveState(ns){
      if(!_gameId) return;
      _gameState = ns;
      _saving    = true;
      fetch(SB_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+_gameId, {
        method:'PATCH',
        headers: sb2Headers({'Prefer':'return=representation'}),
        body: JSON.stringify({state:ns})
      })
      .then(function(r){
        if(!r.ok){ r.text().then(function(t){ console.error('[MULTIPLAYER] saveState error:', t); }); return null; }
        return r.json();
      })
      .then(function(rows){
        _saving = false;
        if(rows && Array.isArray(rows) && rows[0]){
          if(cfg.onStateUpdate) cfg.onStateUpdate(rows[0]);
        }
      })
      .catch(function(e){
        _saving = false;
        console.error('[MULTIPLAYER] saveState err', e);
      });
    }

    // ─── Abandon volontaire ───────────────────────────
    function abandon(onConfirm){
      showChoice(
        '🏳️', 'Abandonner ?', 'La partie sera supprimée, l\'autre joueur en sera informé.',
        'Annuler', null,
        'Confirmer', function(){
          stopAll(); stopReconnectWait(); _waitingForReconnect = false;
          deletePresence();
          if(_gameId){
            var gid = _gameId;
            fetch(SB_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+gid, {
              method:'PATCH',
              headers: sb2Headers({'Prefer':'return=minimal'}),
              body: JSON.stringify({status:'abandoned'})
            }).catch(function(){});
            setTimeout(function(){
              fetch(SB_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+gid, {method:'DELETE', headers:sb2Headers()}).catch(function(){});
            }, 3000);
          }
          resetState();
          if(onConfirm) onConfirm();
          else _doLeave();
        }
      );
    }

    // ─── Quitter proprement ───────────────────────────
    function leave(){
      _presenceActive = false; // couper AVANT deletePresence pour éviter un heartbeat parasite
      stopAll(); stopReconnectWait(); _waitingForReconnect = false;
      deletePresence();
      if(_gameId && cfg.deleteOnLeave){
        fetch(SB_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+_gameId+'&status=eq.waiting', {
          method:'DELETE', headers:sb2Headers()
        }).catch(function(){});
      }
      resetState();
    }

    function _doLeave(){
      leave();
      if(cfg.onLeave) cfg.onLeave();
    }

    // ─── Reconnexion (compte à rebours) ──────────────
    function startReconnectWait(){
      _reconnectSeconds = RECONNECT_GRACE_S;
      _showCountdownModal(_reconnectSeconds);
      _reconnectTimer = setInterval(function(){
        _reconnectSeconds--;
        var el = document.getElementById('yamCountdownLabel');
        if(el) el.textContent = 'Retour en jeu dans : '+_reconnectSeconds+'s…';
        if(_reconnectSeconds <= 0){
          stopReconnectWait();
          _waitingForReconnect = false;
          stopAll();
          var gid = _gameId;
          var wb  = document.getElementById(cfg.countdownModalId||'yamCountdownModal');
          if(wb) document.body.removeChild(wb);
          resetState();
          if(gid){
            fetch(SB_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+gid, {method:'DELETE', headers:sb2Headers()}).catch(function(){});
          }
          showAlert('⏰', 'Temps écoulé — Partie terminée', function(){
            if(cfg.onReconnectTimeout) cfg.onReconnectTimeout();
            else enterLobby();
          });
        }
      }, 1000);
    }

    function stopReconnectWait(){
      if(_reconnectTimer){ clearInterval(_reconnectTimer); _reconnectTimer = null; }
    }

    function _showCountdownModal(seconds){
      var modalId = cfg.countdownModalId || 'yamCountdownModal';
      var old = document.getElementById(modalId);
      if(old) document.body.removeChild(old);

      var overlay = document.createElement('div');
      overlay.id  = modalId;
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:1200;display:flex;align-items:center;justify-content:center;padding:24px';

      var box = document.createElement('div');
      box.style.cssText = 'background:var(--s1);border:1px solid var(--border);border-radius:16px;padding:24px 20px;max-width:300px;width:100%;text-align:center;font-family:DM Sans,sans-serif';

      var emojiEl = document.createElement('div'); emojiEl.textContent = '⏳';
      emojiEl.style.cssText = 'font-size:32px;margin-bottom:8px'; box.appendChild(emojiEl);

      var titleEl = document.createElement('div'); titleEl.textContent = 'En attente…';
      titleEl.style.cssText = 'font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px'; box.appendChild(titleEl);

      var countEl = document.createElement('div');
      countEl.id  = 'yamCountdownLabel';
      countEl.textContent = 'Retour en jeu dans : '+seconds+'s…';
      countEl.style.cssText = 'font-size:13px;color:var(--muted);margin-bottom:18px;line-height:1.5'; box.appendChild(countEl);

      var btn = document.createElement('button');
      btn.textContent = 'Abandonner';
      btn.style.cssText = 'padding:10px 24px;background:rgba(239,83,80,0.12);color:#ef5350;border:1px solid rgba(239,83,80,0.35);border-radius:50px;font-size:13px;font-weight:700;font-family:DM Sans,sans-serif;cursor:pointer';
      btn.onclick = function(){
        stopReconnectWait(); _waitingForReconnect = false; stopAll();
        var gid = _gameId;
        document.body.removeChild(overlay);
        resetState();
        if(gid){ fetch(SB_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+gid, {method:'DELETE', headers:sb2Headers()}).catch(function(){}); }
        if(cfg.onLeave) cfg.onLeave();
      };
      box.appendChild(btn);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    }

    // ─── Modales génériques ───────────────────────────
    function showAlert(emojiOrMsg, titleOrCb, cb){
      var emoji, title, callback;
      if(typeof titleOrCb==='function' || titleOrCb==null){
        var parts = emojiOrMsg.split(' ');
        emoji = parts[0]; title = parts.slice(1).join(' '); callback = titleOrCb;
      } else {
        emoji = emojiOrMsg; title = titleOrCb; callback = cb;
      }
      _buildModal(emoji, title, '', [{label:'OK', primary:true, action:callback}]);
    }

    function showChoice(emoji, title, subtitle, btnA, cbA, btnB, cbB){
      _buildModal(emoji, title, subtitle, [
        {label:btnA, primary:false, action:cbA},
        {label:btnB, primary:false, danger:true, action:cbB}
      ]);
    }

    function _buildModal(emoji, title, subtitle, buttons){
      var modalId = cfg.waitModalId || 'yamWaitModal';
      var overlay = document.createElement('div');
      overlay.id  = modalId;
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:1200;display:flex;align-items:center;justify-content:center;padding:24px';

      var box = document.createElement('div');
      box.style.cssText = 'background:var(--s1);border:1px solid var(--border);border-radius:16px;padding:24px 20px;max-width:300px;width:100%;text-align:center;font-family:DM Sans,sans-serif';

      var emojiEl = document.createElement('div'); emojiEl.textContent = emoji;
      emojiEl.style.cssText = 'font-size:32px;margin-bottom:8px'; box.appendChild(emojiEl);

      var titleEl = document.createElement('div'); titleEl.textContent = title;
      titleEl.style.cssText = 'font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px'; box.appendChild(titleEl);

      if(subtitle){
        var subEl = document.createElement('div'); subEl.textContent = subtitle;
        subEl.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:6px;line-height:1.5'; box.appendChild(subEl);
      }

      var timerEl = document.createElement('div');
      timerEl.id  = 'yamWaitModalTimer';
      timerEl.style.cssText = 'font-size:11px;color:var(--muted);margin-bottom:18px;min-height:16px'; box.appendChild(timerEl);

      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:10px;justify-content:center';
      buttons.forEach(function(b){
        var btn = document.createElement('button');
        btn.textContent = b.label;
        var bg     = b.primary ? 'var(--green)' : b.danger ? 'rgba(239,83,80,0.12)' : 'var(--s2)';
        var col    = b.primary ? '#000' : b.danger ? '#ef5350' : 'var(--text)';
        var border = b.danger  ? '1px solid rgba(239,83,80,0.35)' : '1px solid var(--border)';
        btn.style.cssText = 'flex:1;padding:10px 0;background:'+bg+';color:'+col+';font-weight:700;font-size:13px;font-family:DM Sans,sans-serif;border:'+border+';border-radius:50px;cursor:pointer';
        btn.onclick = function(){ document.body.removeChild(overlay); if(b.action) b.action(); };
        row.appendChild(btn);
      });
      box.appendChild(row);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    }

    // ─── Expose interne (pour bg-pause) ───────────────
    function markAbsence(){ if(_launched && _absenceStart===0) _absenceStart = Date.now(); }

    // ─── Handle public ────────────────────────────────
    return {
      enter:          enter,
      enterLobby:     enterLobby,
      saveState:      saveState,
      startPoll:      startPoll,
      stopAll:        stopAll,
      stopPoll:       stopPoll,
      resetState:     resetState,
      leave:          leave,
      abandon:        abandon,
      deletePresence: deletePresence,
      upsertPresence: upsertPresence,
      refreshRates:   refreshRates,
      markAbsence:    markAbsence,
      showAlert:      showAlert,
      showChoice:     showChoice,
      getGameId:      function(){ return _gameId; },
      getMe:          function(){ return _me; },
      getOther:       function(){ return _other; },
      getGameState:   function(){ return _gameState; },
      isSaving:       function(){ return _saving; },
      isLaunched:     function(){ return _launched; },
      startReconnectWait: function(){ _waitingForReconnect = true; startPoll(); startReconnectWait(); }
    };
  }

})();
