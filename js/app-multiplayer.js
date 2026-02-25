// ═══════════════════════════════════════════════════════════════
// app-multiplayer.js — Moteur multijoueur générique YAM
// Gère : présence, lobby, matchmaking, poll, reconnexion,
//        abandon, bothAbsent, modales
// Version 1.0 — Février 2026
//
// Dépendances : app-core.js (SB2_URL, sb2Headers, getProfile,
//               v2GetDisplayName), app-account.js
//
// Usage :
//   var mp = YAMMultiplayer.create({
//     gameTable      : 'v2_skyjo_games',
//     presenceTable  : 'v2_skyjo_presence',
//     gameView       : document.getElementById('skyjoView'),
//     waitMsgEl      : document.getElementById('skyjoWaitMsg'),
//     pressDotGirl   : document.getElementById('skyjoPresenceGirl'),
//     pressDotBoy    : document.getElementById('skyjoPresenceBoy'),
//     oppDotEl       : document.getElementById('skyjoOppPresenceDot'),
//     buildInitState : function(me, deck) { return { ... }; },
//     onLaunch       : function(gameId, gameRow, me, other) { ... },
//     onStateUpdate  : function(gameRow) { ... },
//     onBothAbsent   : function(mp) { mp.enterLobby(); },
//     onAbandoned    : function(mp) { mp.enterLobby(); },
//     onLeave        : function() { ... }  // retour menu
//   });
//   mp.open();   // ouvrir le jeu (depuis le menu)
//   mp.close();  // fermer proprement
// ═══════════════════════════════════════════════════════════════

var YAMMultiplayer = (function(){

  // ── Helpers session ──────────────────────────────────────────
  function _getSession(){
    return JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
  }
  function _getCoupleId(){
    var s = _getSession();
    return s && s.user ? s.user.couple_id : null;
  }
  function _name(profile){
    return (typeof v2GetDisplayName === 'function')
      ? v2GetDisplayName(profile)
      : (profile === 'girl' ? 'Elle' : 'Lui');
  }

  // ── Fabrique d'instance ──────────────────────────────────────
  function create(opts){

    // ── Configuration ────────────────────────────────────────
    var GAME_TABLE        = opts.gameTable;
    var PRES_TABLE        = opts.presenceTable;
    var OPP_GRACE_MS      = opts.oppGraceMs      || 20000; // 20s avant popup déco
    var BOTH_ABSENT_MS    = opts.bothAbsentMs     || 40000; // 40s → clôture auto
    var RECONNECT_GRACE_S = opts.reconnectGraceS  || 20;   // secondes compte à rebours
    var POLL_INTERVAL     = opts.pollInterval     || 2000;  // ms entre chaque fetch

    // ── Callbacks jeu ────────────────────────────────────────
    var _onLaunch      = opts.onLaunch      || function(){};
    var _onStateUpdate = opts.onStateUpdate || function(){};
    var _onBothAbsent  = opts.onBothAbsent  || function(mp){ mp.enterLobby(); };
    var _onAbandoned   = opts.onAbandoned   || function(mp){ mp.enterLobby(); };
    var _onLeave       = opts.onLeave       || function(){};
    var _buildInitState= opts.buildInitState|| function(){ return {}; };

    // ── Éléments DOM (optionnels, tolère null) ───────────────
    var _gameView    = opts.gameView    || null;
    var _waitMsgEl   = opts.waitMsgEl   || null;
    var _dotGirl     = opts.pressDotGirl|| null;
    var _dotBoy      = opts.pressDotBoy || null;
    var _oppDotEl    = opts.oppDotEl    || null;

    // ── État interne ─────────────────────────────────────────
    var _gameId      = null;
    var _me          = null;
    var _other       = null;
    var _launched    = false;
    var _saving      = false;
    var _presTimer   = null;
    var _lobbyTimer  = null;
    var _pollTimer   = null;
    var _oppGoneTimer= null;
    var _lastPresenceSent = 0;

    var _waitingForReconnect = false;
    var _reconnectTimer      = null;
    var _reconnectSeconds    = 0;
    var _bothAbsentHandled   = false;

    // ── Présence ─────────────────────────────────────────────
    function _upsertPresence(){
      if(!_me) return;
      if(document.hidden) return;
      _lastPresenceSent = Date.now();
      var coupleId = _getCoupleId();
      if(!coupleId) return;
      fetch(SB2_URL+'/rest/v1/'+PRES_TABLE, {
        method:'POST',
        headers:sb2Headers({'Prefer':'resolution=merge-duplicates,return=minimal'}),
        body:JSON.stringify({profile:_me, couple_id:coupleId, updated_at:new Date().toISOString()})
      }).catch(function(){});
    }

    function _deletePresence(){
      if(!_me) return;
      var coupleId = _getCoupleId();
      if(!coupleId) return;
      fetch(SB2_URL+'/rest/v1/'+PRES_TABLE+'?couple_id=eq.'+coupleId+'&profile=eq.'+_me, {
        method:'DELETE', headers:sb2Headers(), keepalive:true
      }).catch(function(){});
    }

    function _startPresence(){
      if(_presTimer) return;
      _upsertPresence();
      _presTimer = setInterval(_upsertPresence, 4000);
    }

    function _refreshPresenceRate(){
      // Délai 3s au retour : laisse fetchState() lire les vrais timestamps
      // avant que le heartbeat ne les écrase (détection bothAbsent correcte)
      if(_presTimer){ clearInterval(_presTimer); _presTimer = null; }
      if(!document.hidden && _launched){
        setTimeout(function(){
          _upsertPresence();
          if(!_presTimer) _presTimer = setInterval(_upsertPresence, 4000);
        }, 3000);
      }
    }

    // ── Utilitaires DOM dots ─────────────────────────────────
    function _updateLobbyDots(g, b){
      if(_dotGirl) _dotGirl.className = 'skyjo-presence-dot' + (g ? ' online' : '');
      if(_dotBoy)  _dotBoy.className  = 'skyjo-presence-dot' + (b ? ' online' : '');
    }

    function _updateOppDot(isOnline){
      if(!_oppDotEl) return;
      _oppDotEl.style.background = isOnline ? '#22c55e' : '#555';
      _oppDotEl.style.boxShadow  = isOnline ? '0 0 5px rgba(34,197,94,0.7)' : 'none';
      _oppDotEl.title            = isOnline ? 'En ligne' : 'Hors ligne';
    }

    // ── Reset ────────────────────────────────────────────────
    function _resetState(){
      _gameId    = null;
      _launched  = false;
      _saving    = false;
      _bothAbsentHandled = false;
      if(_oppGoneTimer){ clearTimeout(_oppGoneTimer); _oppGoneTimer = null; }
    }

    function _stopAll(){
      if(_presTimer)  { clearInterval(_presTimer);   _presTimer  = null; }
      if(_lobbyTimer) { clearInterval(_lobbyTimer);  _lobbyTimer = null; }
      if(_pollTimer)  { clearInterval(_pollTimer);   _pollTimer  = null; }
      if(_oppGoneTimer){ clearTimeout(_oppGoneTimer); _oppGoneTimer = null; }
    }

    // ── Lobby ────────────────────────────────────────────────
    function enterLobby(){
      _stopAll();
      _resetState();
      _me    = getProfile();
      _other = _me === 'girl' ? 'boy' : 'girl';

      var coupleId = _getCoupleId();
      if(!coupleId){
        if(_waitMsgEl) _waitMsgEl.innerHTML = '❌ Session expirée — reconnectez-vous';
        return;
      }

      // Vérifier si une partie est déjà en cours (rejoin après fermeture accidentelle)
      Promise.all([
        fetch(SB2_URL+'/rest/v1/'+GAME_TABLE+'?couple_id=eq.'+coupleId+'&status=eq.playing&order=created_at.desc&limit=1&select=id,status,state,created_by',{headers:sb2Headers()}).then(function(r){return r.json();}),
        fetch(SB2_URL+'/rest/v1/'+PRES_TABLE+'?couple_id=eq.'+coupleId+'&select=profile',{headers:sb2Headers()}).then(function(r){return r.json();})
      ])
      .then(function(results){
        var rows         = results[0];
        var presRows     = results[1];
        var presenceEmpty= !Array.isArray(presRows) || presRows.length === 0;

        if(Array.isArray(rows) && rows[0]){
          if(presenceEmpty){
            // Partie fantôme → supprimer
            fetch(SB2_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+rows[0].id, {method:'DELETE',headers:sb2Headers()}).catch(function(){});
          } else {
            // Rejoindre la partie existante
            _gameId = rows[0].id;
            _launched = true;
            _startPresence();
            _launchGame(rows[0]);
            return;
          }
        }
        // Salle d'attente
        _showWaitMsg();
        _cleanMyOldGames(function(){
          _startPresence();
          _startLobbyPoll();
        });
      })
      .catch(function(){
        _showWaitMsg();
        _cleanMyOldGames(function(){
          _startPresence();
          _startLobbyPoll();
        });
      });
    }

    function _showWaitMsg(){
      if(_waitMsgEl){
        var myName  = _name(_me);
        var oppName = _name(_other);
        _waitMsgEl.innerHTML = 'Connecté en tant que <strong>'+myName+'</strong>.<br>En attente que <strong>'+oppName+'</strong> rejoigne…';
      }
    }

    function _cleanMyOldGames(cb){
      var coupleId = _getCoupleId();
      if(!coupleId){ if(cb) cb(); return; }
      fetch(SB2_URL+'/rest/v1/'+GAME_TABLE+'?couple_id=eq.'+coupleId+'&status=eq.waiting&created_by=eq.'+_me, {
        method:'DELETE', headers:sb2Headers()
      }).then(function(){ if(cb) cb(); }).catch(function(){ if(cb) cb(); });
    }

    // ── Lobby poll ───────────────────────────────────────────
    function _startLobbyPoll(){
      _lobbyTick();
      _lobbyTimer = setInterval(_lobbyTick, 2500);
    }

    function _lobbyTick(){
      if(_launched){ _stopAll(); return; }

      if(_gameId){
        // Surveille si la partie passe à 'playing'
        fetch(SB2_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+_gameId+'&select=id,status,state,created_by', {headers:sb2Headers()})
        .then(function(r){return r.json();})
        .then(function(rows){
          if(_launched) return;
          if(!Array.isArray(rows) || !rows[0]) return;
          var g = rows[0];
          _updateLobbyDots(true, true);
          if(g.status === 'playing') _launchGame(g);
        }).catch(function(){});
        return;
      }

      var coupleId = _getCoupleId();
      if(!coupleId) return;
      fetch(SB2_URL+'/rest/v1/'+PRES_TABLE+'?couple_id=eq.'+coupleId+'&select=profile,updated_at', {headers:sb2Headers()})
      .then(function(r){return r.json();})
      .then(function(rows){
        if(_launched) return;
        if(!Array.isArray(rows)) return;
        var now = Date.now();
        var girlOk = false, boyOk = false;
        rows.forEach(function(row){
          if(now - new Date(row.updated_at).getTime() < 10000){
            if(row.profile === 'girl') girlOk = true;
            if(row.profile === 'boy')  boyOk  = true;
          }
        });
        _updateLobbyDots(girlOk, boyOk);
        if(girlOk && boyOk) _doMatchmaking();
      }).catch(function(){});
    }

    // ── Matchmaking ──────────────────────────────────────────
    // Convention : girl crée toujours, boy rejoint — évite les doublons
    function _doMatchmaking(){
      if(_launched) return;
      var coupleId = _getCoupleId();
      if(!coupleId) return;

      fetch(SB2_URL+'/rest/v1/'+GAME_TABLE+'?couple_id=eq.'+coupleId+'&status=in.(waiting,playing)&order=created_at.desc&limit=1&select=id,status,state,created_by', {headers:sb2Headers()})
      .then(function(r){return r.json();})
      .then(function(rows){
        if(_launched) return;
        var game = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

        if(game && game.status === 'playing'){
          _gameId = game.id;
          _launchGame(game);
          return;
        }
        if(game && game.status === 'waiting'){
          if(game.created_by === _me){
            _gameId = game.id; // ma partie, j'attends
            return;
          }
          // Rejoindre la partie de l'autre (PATCH conditionnel anti-race)
          _gameId = game.id;
          fetch(SB2_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+game.id+'&status=eq.waiting', {
            method:'PATCH',
            headers:sb2Headers({'Prefer':'return=representation'}),
            body:JSON.stringify({status:'playing'})
          })
          .then(function(r){return r.json();})
          .then(function(updated){
            if(_launched) return;
            if(Array.isArray(updated) && updated[0]) _launchGame(updated[0]);
          }).catch(function(){});
          return;
        }

        if(!game) _createNewGame();
      }).catch(function(){});
    }

    function _createNewGame(){
      if(_launched || _gameId) return;
      var coupleId = _getCoupleId();
      if(!coupleId) return;
      var initState = _buildInitState(_me, _other);
      fetch(SB2_URL+'/rest/v1/'+GAME_TABLE, {
        method:'POST',
        headers:sb2Headers({'Prefer':'return=representation'}),
        body:JSON.stringify({couple_id:coupleId, status:'waiting', created_by:_me, state:initState})
      })
      .then(function(r){return r.json();})
      .then(function(rows){
        if(Array.isArray(rows) && rows[0] && !_launched) _gameId = rows[0].id;
      }).catch(function(){});
    }

    // ── Lancement ────────────────────────────────────────────
    function _launchGame(gameRow){
      if(_launched) return;
      _launched = true;
      _gameId   = gameRow.id;
      if(_lobbyTimer){ clearInterval(_lobbyTimer); _lobbyTimer = null; }
      if(_pollTimer) { clearInterval(_pollTimer);  _pollTimer  = null; }
      if(!_presTimer){ _upsertPresence(); _presTimer = setInterval(_upsertPresence, 4000); }
      _onLaunch(_gameId, gameRow, _me, _other);
      _startPoll();
    }

    // ── Poll état jeu ────────────────────────────────────────
    function _startPoll(){
      if(_pollTimer){ clearInterval(_pollTimer); _pollTimer = null; }
      var interval = document.hidden ? 15000 : POLL_INTERVAL;
      _pollTimer = setInterval(_fetchState, interval);
    }

    function _refreshPollRate(){
      var newInterval = document.hidden ? 15000 : POLL_INTERVAL;
      if(_pollTimer){ clearInterval(_pollTimer); _pollTimer = null; }
      if(!document.hidden && _launched){
        _fetchState();
        _pollTimer = setInterval(_fetchState, newInterval);
      }
    }

    function _fetchState(){
      if(!_gameId || _saving) return;
      var oppKey   = _me === 'girl' ? 'boy' : 'girl';
      var coupleId = _getCoupleId();
      if(!coupleId) return;

      Promise.all([
        fetch(SB2_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+_gameId+'&select=id,status,state,created_by', {headers:sb2Headers()}).then(function(r){return r.json();}),
        fetch(SB2_URL+'/rest/v1/'+PRES_TABLE+'?couple_id=eq.'+coupleId+'&select=profile,updated_at', {headers:sb2Headers()}).then(function(r){return r.json();})
      ])
      .then(function(results){
        if(_saving) return;
        var rows    = results[0];
        var allPres = results[1];

        var presOpp = Array.isArray(allPres) ? allPres.filter(function(p){ return p.profile === oppKey; }) : [];
        var presMe  = Array.isArray(allPres) ? allPres.filter(function(p){ return p.profile === _me;    }) : [];

        var now       = Date.now();
        var isOnline  = presOpp[0] && (now - new Date(presOpp[0].updated_at).getTime()) < 15000;
        _updateOppDot(isOnline);

        // ── bothAbsent : 40s sans heartbeat des deux ──────────
        var myMs  = presMe[0]  ? now - new Date(presMe[0].updated_at).getTime()  : 99999999;
        var oppMs = presOpp[0] ? now - new Date(presOpp[0].updated_at).getTime() : 99999999;
        if(myMs > BOTH_ABSENT_MS && oppMs > BOTH_ABSENT_MS && !_bothAbsentHandled && _launched){
          _bothAbsentHandled = true;
          _stopAll();
          var gid = _gameId;
          _resetState();
          if(gid){
            fetch(SB2_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+gid, {method:'DELETE',headers:sb2Headers()}).catch(function(){});
            fetch(SB2_URL+'/rest/v1/'+PRES_TABLE+'?couple_id=eq.'+coupleId, {method:'DELETE',headers:sb2Headers()}).catch(function(){});
          }
          showAlert('⏱️', 'Partie expirée — les deux joueurs étaient absents', function(){
            _bothAbsentHandled = false;
            _onBothAbsent(api);
          });
          return;
        }

        // ── Adversaire hors-ligne : timer de grâce ────────────
        if(!isOnline && !_waitingForReconnect && !_oppGoneTimer
           && !document.getElementById('mp-wait-modal')
           && !document.getElementById('mp-countdown-modal')){
          _oppGoneTimer = setTimeout(function(){
            _oppGoneTimer = null;
            if(!_launched || _waitingForReconnect) return;
            if(document.getElementById('mp-wait-modal') || document.getElementById('mp-countdown-modal')) return;
            var oppName = _name(oppKey);
            showChoice(
              '😔', oppName+' est déconnecté(e)',
              'Connexion perdue. Tu peux attendre son retour ou quitter la partie.',
              'Attendre', function(){
                _waitingForReconnect = true;
                _startPoll();
                _startReconnectWait();
              },
              'Quitter', function(){
                _waitingForReconnect = false;
                _stopAll();
                _resetState();
                _onLeave();
              }
            );
          }, OPP_GRACE_MS);
        }

        // ── Adversaire revenu ──────────────────────────────────
        if(isOnline && _oppGoneTimer && !_waitingForReconnect){
          clearTimeout(_oppGoneTimer);
          _oppGoneTimer = null;
        }

        // ── Abandon volontaire ─────────────────────────────────
        if(Array.isArray(rows) && rows[0] && rows[0].status === 'abandoned'){
          stopPoll();
          _stopReconnectWait();
          _waitingForReconnect = false;
          if(_oppGoneTimer){ clearTimeout(_oppGoneTimer); _oppGoneTimer = null; }
          var wm = document.getElementById('mp-countdown-modal') || document.getElementById('mp-wait-modal');
          if(wm) document.body.removeChild(wm);
          _resetState();
          showAlert('🏳️', 'Partie abandonnée', function(){ _onAbandoned(api); });
          return;
        }

        // ── Partie introuvable ─────────────────────────────────
        if(!Array.isArray(rows) || !rows[0]){
          if(_waitingForReconnect) return;
          return;
        }

        // ── Reconnexion réussie ────────────────────────────────
        if(_waitingForReconnect){
          if(!isOnline) return;
          _waitingForReconnect = false;
          _stopReconnectWait();
          var wb = document.getElementById('mp-countdown-modal');
          if(wb) document.body.removeChild(wb);
        }

        _onStateUpdate(rows[0]);
      }).catch(function(){});
    }

    function stopPoll(){ if(_pollTimer){ clearInterval(_pollTimer); _pollTimer = null; } }

    // ── Sauvegarde état ───────────────────────────────────────
    function saveState(ns, onDone){
      if(!_gameId) return;
      _saving = true;
      fetch(SB2_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+_gameId, {
        method:'PATCH',
        headers:sb2Headers({'Prefer':'return=representation'}),
        body:JSON.stringify({state:ns})
      })
      .then(function(r){
        if(!r.ok){ r.text().then(function(t){ console.error('[MP] saveState err:', t); }); return null; }
        return r.json();
      })
      .then(function(rows){
        _saving = false;
        if(rows && Array.isArray(rows) && rows[0]){
          if(onDone) onDone(rows[0]);
          else _onStateUpdate(rows[0]);
        }
      })
      .catch(function(e){ _saving = false; console.error('[MP] saveState catch:', e); });
    }

    // ── Reconnexion compte à rebours ─────────────────────────
    function _startReconnectWait(){
      _reconnectSeconds = RECONNECT_GRACE_S;
      _showCountdownModal(_reconnectSeconds);
      _reconnectTimer = setInterval(function(){
        _reconnectSeconds--;
        var el = document.getElementById('mp-countdown-label');
        if(el) el.textContent = 'Retour en jeu dans : '+_reconnectSeconds+'s…';
        if(_reconnectSeconds <= 0){
          _stopReconnectWait();
          _waitingForReconnect = false;
          _stopAll();
          var gid = _gameId;
          var wb  = document.getElementById('mp-countdown-modal');
          if(wb) document.body.removeChild(wb);
          _resetState();
          if(gid) fetch(SB2_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+gid, {method:'DELETE',headers:sb2Headers()}).catch(function(){});
          showAlert('⏰', 'Temps écoulé — Partie terminée', function(){ _onAbandoned(api); });
        }
      }, 1000);
    }

    function _showCountdownModal(seconds){
      var old = document.getElementById('mp-countdown-modal');
      if(old) document.body.removeChild(old);
      var overlay = document.createElement('div');
      overlay.id = 'mp-countdown-modal';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:1200;display:flex;align-items:center;justify-content:center;padding:24px';
      var box = _modalBox();
      _modalItem(box, 'div', '⏳', 'font-size:32px;margin-bottom:8px');
      _modalItem(box, 'div', 'En attente…', 'font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px');
      var countEl = _modalItem(box, 'div', 'Retour en jeu dans : '+seconds+'s…', 'font-size:13px;color:var(--muted);margin-bottom:18px;line-height:1.5');
      countEl.id = 'mp-countdown-label';
      var btn = document.createElement('button');
      btn.textContent = 'Abandonner';
      btn.style.cssText = 'padding:10px 24px;background:rgba(239,83,80,0.12);color:#ef5350;border:1px solid rgba(239,83,80,0.35);border-radius:50px;font-size:13px;font-weight:700;font-family:DM Sans,sans-serif;cursor:pointer';
      btn.onclick = function(){
        _stopReconnectWait();
        _waitingForReconnect = false;
        _stopAll();
        var gid = _gameId;
        document.body.removeChild(overlay);
        _resetState();
        if(gid) fetch(SB2_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+gid, {method:'DELETE',headers:sb2Headers()}).catch(function(){});
        _onLeave();
      };
      box.appendChild(btn);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    }

    function _stopReconnectWait(){
      if(_reconnectTimer){ clearInterval(_reconnectTimer); _reconnectTimer = null; }
    }

    // ── Abandon volontaire ────────────────────────────────────
    function abandon(abandonBtnEl, gameViewEl){
      showChoice(
        '🏳️', 'Abandonner ?',
        'La partie sera supprimée, l\'autre joueur en sera informé.',
        'Annuler', null,
        'Confirmer', function(){
          _stopAll(); _stopReconnectWait(); _waitingForReconnect = false;
          _deletePresence();
          if(_gameId){
            var gid = _gameId;
            fetch(SB2_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+gid, {
              method:'PATCH',
              headers:sb2Headers({'Prefer':'return=minimal'}),
              body:JSON.stringify({status:'abandoned'})
            }).catch(function(){});
            setTimeout(function(){
              fetch(SB2_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+gid, {method:'DELETE',headers:sb2Headers()}).catch(function(){});
            }, 3000);
          }
          _resetState();
          if(abandonBtnEl) abandonBtnEl.style.display = 'none';
          _onLeave();
        }
      );
    }

    // ── Fermeture propre ──────────────────────────────────────
    function close(currentPhase){
      _stopAll(); _stopReconnectWait(); _waitingForReconnect = false;
      _deletePresence();
      // Supprimer uniquement les parties en attente (pas les parties en cours)
      var activePhases = ['play','init1','roundEnd'];
      if(_gameId && activePhases.indexOf(currentPhase) === -1){
        fetch(SB2_URL+'/rest/v1/'+GAME_TABLE+'?id=eq.'+_gameId+'&status=eq.waiting', {method:'DELETE',headers:sb2Headers()}).catch(function(){});
      }
      _resetState();
    }

    // ── Modales génériques ────────────────────────────────────
    function _modalBox(){
      var box = document.createElement('div');
      box.style.cssText = 'background:var(--s1);border:1px solid var(--border);border-radius:16px;padding:24px 20px;max-width:300px;width:100%;text-align:center;font-family:DM Sans,sans-serif';
      return box;
    }
    function _modalItem(parent, tag, text, css){
      var el = document.createElement(tag);
      el.textContent = text;
      el.style.cssText = css;
      parent.appendChild(el);
      return el;
    }

    function showAlert(emojiOrMsg, titleOrCb, cb){
      var emoji, title, callback;
      if(typeof titleOrCb === 'function' || titleOrCb == null){
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
      var overlay = document.createElement('div');
      overlay.id = 'mp-wait-modal';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:1200;display:flex;align-items:center;justify-content:center;padding:24px';
      var box = _modalBox();
      _modalItem(box, 'div', emoji,    'font-size:32px;margin-bottom:8px');
      _modalItem(box, 'div', title,    'font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px');
      if(subtitle) _modalItem(box, 'div', subtitle, 'font-size:12px;color:var(--muted);margin-bottom:6px;line-height:1.5');
      var timerEl = document.createElement('div');
      timerEl.id = 'mp-wait-modal-timer';
      timerEl.style.cssText = 'font-size:11px;color:var(--muted);margin-bottom:18px;min-height:16px';
      box.appendChild(timerEl);
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:10px;justify-content:center';
      buttons.forEach(function(b){
        var btn = document.createElement('button');
        btn.textContent = b.label;
        var bg     = b.primary ? 'var(--green)' : b.danger ? 'rgba(239,83,80,0.12)' : 'var(--s2)';
        var col    = b.primary ? '#000'         : b.danger ? '#ef5350'               : 'var(--text)';
        var border = b.danger  ? '1px solid rgba(239,83,80,0.35)' : '1px solid var(--border)';
        btn.style.cssText = 'flex:1;padding:10px 0;background:'+bg+';color:'+col+';font-weight:700;font-size:13px;font-family:DM Sans,sans-serif;border:'+border+';border-radius:50px;cursor:pointer';
        btn.onclick = function(){ document.body.removeChild(overlay); if(b.action) b.action(); };
        row.appendChild(btn);
      });
      box.appendChild(row);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    }

    // ── Pause / Reprise (bg-pause) ────────────────────────────
    function pause(){
      _deletePresence();
      _refreshPollRate();
      _refreshPresenceRate();
    }

    function resume(){
      _upsertPresence();
      _refreshPollRate();
      _refreshPresenceRate();
    }

    // ── API publique ──────────────────────────────────────────
    var api = {
      // Navigation
      open       : function(){ enterLobby(); },
      enterLobby : enterLobby,
      leaveWait  : function(){
        _stopAll(); _deletePresence(); _cleanMyOldGames(null); _resetState(); _onLeave();
      },
      close      : close,

      // Jeu
      saveState  : saveState,
      stopPoll   : stopPoll,
      restartPoll: _startPoll,

      // Modales
      showAlert  : showAlert,
      showChoice : showChoice,

      // Abandon
      abandon    : abandon,

      // Pause/reprise (bg-pause module)
      pause      : pause,
      resume     : resume,

      // Accès état interne (lecture seule pour le jeu)
      getGameId  : function(){ return _gameId; },
      getMe      : function(){ return _me; },
      getOther   : function(){ return _other; },
      isLaunched : function(){ return _launched; },
      isSaving   : function(){ return _saving; },

      // Exposé pour bg-pause Skyjo (compat)
      _deletePresence : _deletePresence,
      _upsertPresence : _upsertPresence
    };

    return api;
  }

  return { create: create };

})();
