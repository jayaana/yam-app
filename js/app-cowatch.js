// ════════════════════════════════════════════════════════════════════
// APP-COWATCH.JS — Co-watching YouTube synchronisé
// Version : 1.0-beta
// Dépendances globales : SB2_URL, sb2Headers(), getProfile(),
//                        v2GetUser(), v2GetDisplayName(),
//                        YAMMultiplayer, _yamSlide, showToast
// Table Supabase requise : v2_cowatch_sessions (voir commentaire bas)
// ════════════════════════════════════════════════════════════════════
//
// SQL à exécuter dans Supabase :
// ─────────────────────────────
// CREATE TABLE IF NOT EXISTS v2_cowatch_sessions (
//   id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   couple_id   uuid NOT NULL,
//   state       jsonb NOT NULL DEFAULT '{}',
//   created_at  timestamptz DEFAULT now(),
//   updated_at  timestamptz DEFAULT now()
// );
// CREATE TABLE IF NOT EXISTS v2_cowatch_presence (
//   id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   couple_id   uuid NOT NULL,
//   role        text NOT NULL,
//   last_seen   timestamptz DEFAULT now(),
//   UNIQUE(couple_id, role)
// );
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────
  var COWATCH_TABLE    = 'v2_cowatch_sessions';
  var COWATCH_PRESENCE = 'v2_cowatch_presence';
  var BETA_CODE        = 'YAMNOW';   // ← code d'accès beta
  var BETA_LS_KEY      = 'yam_cowatch_beta_ok';

  // ── État local ──────────────────────────────────────────────────
  var _mp           = null;
  var _player       = null;   // instance YT.Player
  var _ytReady      = false;
  var _isSyncing    = false;  // garde pour éviter les boucles de sync
  var _lastRemoteTs = 0;
  var _myRole       = null;
  var _isHost       = false;  // l'hôte est celui qui contrôle la lecture

  // ── Injecter CSS ────────────────────────────────────────────────
  var _style = document.createElement('style');
  _style.textContent = [

    // ── Overlay principal ──
    '#cowatchOverlay{display:none;position:fixed;inset:0;z-index:2600;background:var(--bg);overflow:hidden;flex-direction:column;}',
    '#cowatchOverlay.active{display:flex;}',

    // ── Header ──
    '#cwHeader{display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border);gap:12px;flex-shrink:0;}',
    '#cwHeader h2{flex:1;font-size:17px;font-weight:700;color:var(--text);font-family:"Bricolage Grotesque",sans-serif;letter-spacing:-0.3px;}',
    '.cw-back-btn{width:36px;height:36px;border-radius:50%;background:var(--s2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}',
    '.cw-beta-badge{background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:3px 8px;border-radius:20px;}',

    // ── Screens ──
    '.cw-screen{display:none;flex-direction:column;flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;}',
    '.cw-screen.active{display:flex;}',

    // ── Beta gate ──
    '#cwBetaScreen{align-items:center;justify-content:center;padding:40px 24px;gap:20px;text-align:center;}',
    '.cw-beta-icon{font-size:52px;line-height:1;}',
    '.cw-beta-title{font-family:"Bricolage Grotesque",sans-serif;font-size:22px;font-weight:800;color:var(--text);}',
    '.cw-beta-sub{font-size:14px;color:var(--muted);line-height:1.5;max-width:280px;}',
    '.cw-beta-input-wrap{width:100%;max-width:280px;position:relative;}',
    '.cw-beta-input{width:100%;padding:14px 18px;background:var(--s1);border:1.5px solid var(--border);border-radius:14px;font-size:18px;font-weight:700;letter-spacing:4px;text-align:center;color:var(--text);font-family:"Bricolage Grotesque",sans-serif;outline:none;transition:border-color 0.2s,box-shadow 0.2s;-webkit-appearance:none;}',
    '.cw-beta-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(201,120,96,0.15);}',
    '.cw-beta-input.error{border-color:#ef4444;animation:cwShake 0.35s ease;}',
    '@keyframes cwShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}',
    '.cw-btn-primary{background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 70%,var(--green)));color:#fff;border:none;border-radius:50px;padding:14px 40px;font-size:15px;font-weight:700;cursor:pointer;font-family:"Bricolage Grotesque",sans-serif;box-shadow:0 4px 20px rgba(201,120,96,0.3);transition:transform 0.12s,box-shadow 0.15s;position:relative;overflow:hidden;}',
    '.cw-btn-primary::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,0.15) 0%,transparent 60%);pointer-events:none;}',
    '.cw-btn-primary:hover{transform:scale(1.03);box-shadow:0 6px 26px rgba(201,120,96,0.4);}',
    '.cw-btn-primary:active{transform:scale(0.97);}',
    '.cw-btn-primary:disabled{opacity:0.45;cursor:not-allowed;transform:none;}',

    // ── Lobby / URL input ──
    '#cwLobbyScreen{padding:24px 20px;gap:18px;}',
    '.cw-section-title{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:4px;}',
    '.cw-url-wrap{display:flex;flex-direction:column;gap:10px;}',
    '.cw-url-input{width:100%;padding:13px 16px;background:var(--s1);border:1.5px solid var(--border);border-radius:14px;font-size:14px;color:var(--text);font-family:"Bricolage Grotesque",sans-serif;outline:none;transition:border-color 0.2s,box-shadow 0.2s;-webkit-appearance:none;box-sizing:border-box;}',
    '.cw-url-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(201,120,96,0.12);}',
    '.cw-url-preview{background:var(--s1);border:1px solid var(--border);border-radius:12px;overflow:hidden;display:none;}',
    '.cw-url-preview.visible{display:block;}',
    '.cw-url-preview img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;}',
    '.cw-url-preview-info{padding:10px 14px;}',
    '.cw-url-preview-title{font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.cw-url-preview-channel{font-size:11px;color:var(--muted);margin-top:2px;}',

    // ── Wait screen ──
    '#cwWaitScreen{align-items:center;justify-content:center;padding:40px 24px;gap:20px;text-align:center;}',
    '.cw-wait-anim{width:60px;height:60px;border-radius:50%;border:3px solid var(--border);border-top-color:var(--accent);animation:cwSpin 1s linear infinite;}',
    '@keyframes cwSpin{to{transform:rotate(360deg)}}',
    '.cw-wait-title{font-family:"Bricolage Grotesque",sans-serif;font-size:18px;font-weight:700;color:var(--text);}',
    '.cw-wait-sub{font-size:13px;color:var(--muted);}',
    '.cw-presence-row{display:flex;gap:20px;align-items:center;justify-content:center;}',
    '.cw-presence-item{display:flex;flex-direction:column;align-items:center;gap:6px;}',
    '.cw-presence-dot{width:10px;height:10px;border-radius:50%;background:#444;transition:background 0.3s,box-shadow 0.3s;}',
    '.cw-presence-dot.online{background:#22c55e;box-shadow:0 0 6px rgba(34,197,94,0.7);}',
    '.cw-presence-name{font-size:11px;color:var(--muted);font-weight:600;}',

    // ── Player screen ──
    '#cwPlayerScreen{flex:1;flex-direction:column;overflow:hidden;}',
    '.cw-video-wrap{position:relative;width:100%;background:#000;flex-shrink:0;}',
    '.cw-video-wrap iframe{display:block;width:100%;aspect-ratio:16/9;border:none;}',
    // Overlay "en attente de sync"
    '.cw-sync-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.65);display:none;align-items:center;justify-content:center;flex-direction:column;gap:10px;z-index:5;}',
    '.cw-sync-overlay.active{display:flex;}',
    '.cw-sync-spinner{width:32px;height:32px;border-radius:50%;border:3px solid rgba(255,255,255,0.2);border-top-color:#fff;animation:cwSpin 0.8s linear infinite;}',
    '.cw-sync-txt{font-size:12px;color:rgba(255,255,255,0.8);font-weight:600;}',

    // ── Contrôles ──
    '.cw-controls{flex-shrink:0;padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;}',
    '.cw-ctrl-btn{width:44px;height:44px;border-radius:50%;border:1.5px solid var(--border);background:var(--s2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.15s,transform 0.1s;flex-shrink:0;-webkit-tap-highlight-color:transparent;}',
    '.cw-ctrl-btn:active{transform:scale(0.92);}',
    '.cw-ctrl-btn svg{pointer-events:none;}',
    '.cw-ctrl-btn.primary{background:var(--accent);border-color:var(--accent);}',
    '.cw-ctrl-btn.primary svg{stroke:#fff;}',
    '.cw-time{flex:1;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;font-weight:600;}',
    '.cw-host-badge{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:10px;background:rgba(201,120,96,0.15);color:var(--accent);border:1px solid rgba(201,120,96,0.3);}',

    // ── Réactions ──
    '.cw-reactions{flex-shrink:0;padding:10px 16px;display:flex;justify-content:space-around;border-bottom:1px solid var(--border);}',
    '.cw-react-btn{font-size:22px;padding:6px 10px;border-radius:12px;border:none;background:transparent;cursor:pointer;transition:transform 0.15s;-webkit-tap-highlight-color:transparent;}',
    '.cw-react-btn:active{transform:scale(1.4);}',

    // ── Réaction flottante ──
    '.cw-float-reaction{position:fixed;font-size:32px;pointer-events:none;z-index:2700;animation:cwFloatUp 1.4s ease-out forwards;}',
    '@keyframes cwFloatUp{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-120px) scale(1.6);opacity:0}}',

    // ── Chat minimal (réactions texte) ──
    '.cw-chat{flex:1;overflow-y:auto;padding:10px 16px;display:flex;flex-direction:column;gap:6px;min-height:0;}',
    '.cw-chat-msg{display:flex;align-items:flex-end;gap:8px;}',
    '.cw-chat-msg.mine{flex-direction:row-reverse;}',
    '.cw-chat-bubble{max-width:200px;padding:7px 12px;border-radius:16px;font-size:13px;font-weight:500;color:var(--text);background:var(--s2);border:1px solid var(--border);word-break:break-word;}',
    '.cw-chat-msg.mine .cw-chat-bubble{background:rgba(201,120,96,0.18);border-color:rgba(201,120,96,0.3);}',
    '.cw-chat-time{font-size:10px;color:var(--muted);flex-shrink:0;margin-bottom:2px;}',

  ].join('\n');
  document.head.appendChild(_style);

  // ── Injecter HTML ────────────────────────────────────────────────
  var _html = ''
    + '<div id="cowatchOverlay">'
    + '<div id="cwHeader">'
    +   '<div class="cw-back-btn" onclick="window.closeCowatchModal()">'
    +     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
    +   '</div>'
    +   '<h2>📺 Regarder ensemble</h2>'
    +   '<div class="cw-beta-badge">BETA</div>'
    + '</div>'

    // ── Screen 1 : Beta gate ──
    + '<div id="cwBetaScreen" class="cw-screen active">'
    +   '<div class="cw-beta-icon">🔐</div>'
    +   '<div class="cw-beta-title">Accès bêta</div>'
    +   '<div class="cw-beta-sub">Cette fonctionnalité est en cours de développement. Entre le code d\'accès pour la tester.</div>'
    +   '<div class="cw-beta-input-wrap">'
    +     '<input id="cwBetaInput" class="cw-beta-input" type="text" placeholder="CODE" autocomplete="off" autocorrect="off" spellcheck="false" oninput="this.value=this.value.toUpperCase()" />'
    +   '</div>'
    +   '<button class="cw-btn-primary" onclick="window._cwBetaSubmit()">Accéder ✨</button>'
    + '</div>'

    // ── Screen 2 : Lobby ──
    + '<div id="cwLobbyScreen" class="cw-screen">'
    +   '<div class="cw-section-title">Colle un lien YouTube</div>'
    +   '<div class="cw-url-wrap">'
    +     '<input id="cwUrlInput" class="cw-url-input" type="url" placeholder="https://youtube.com/watch?v=..." autocomplete="off" />'
    +     '<div id="cwUrlPreview" class="cw-url-preview">'
    +       '<img id="cwPreviewThumb" src="" alt=""/>'
    +       '<div class="cw-url-preview-info">'
    +         '<div id="cwPreviewTitle" class="cw-url-preview-title"></div>'
    +         '<div id="cwPreviewChannel" class="cw-url-preview-channel"></div>'
    +       '</div>'
    +     '</div>'
    +   '</div>'
    +   '<button class="cw-btn-primary" id="cwStartBtn" onclick="window._cwStart()" disabled>Lancer la session 🎬</button>'
    +   '<div style="font-size:12px;color:var(--muted);text-align:center;line-height:1.5;">L\'autre joueur devra rejoindre la session.<br>Tu seras l\'hôte — tu contrôles la lecture.</div>'
    + '</div>'

    // ── Screen 3 : Attente ──
    + '<div id="cwWaitScreen" class="cw-screen">'
    +   '<div class="cw-wait-anim"></div>'
    +   '<div class="cw-wait-title">En attente…</div>'
    +   '<div class="cw-wait-sub" id="cwWaitMsg">En attente que l\'autre rejoigne</div>'
    +   '<div class="cw-presence-row">'
    +     '<div class="cw-presence-item"><div class="cw-presence-dot" id="cwDotGirl"></div><div class="cw-presence-name" id="cwNameGirl">Elle</div></div>'
    +     '<div class="cw-presence-item"><div class="cw-presence-dot" id="cwDotBoy"></div><div class="cw-presence-name" id="cwNameBoy">Lui</div></div>'
    +   '</div>'
    +   '<button class="cw-btn-primary" style="background:var(--s2);color:var(--muted);box-shadow:none;border:1.5px solid var(--border);" onclick="window._cwLeave()">Annuler</button>'
    + '</div>'

    // ── Screen 4 : Player ──
    + '<div id="cwPlayerScreen" class="cw-screen">'
    +   '<div class="cw-video-wrap">'
    +     '<div id="cwYTPlayer"></div>'
    +     '<div class="cw-sync-overlay" id="cwSyncOverlay">'
    +       '<div class="cw-sync-spinner"></div>'
    +       '<div class="cw-sync-txt">Synchronisation…</div>'
    +     '</div>'
    +   '</div>'
    +   '<div class="cw-controls">'
    +     '<div class="cw-ctrl-btn primary" id="cwPlayBtn" onclick="window._cwTogglePlay()">'
    +       '<svg id="cwPlayIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
    +     '</div>'
    +     '<div class="cw-time" id="cwTime">0:00 / 0:00</div>'
    +     '<div id="cwHostBadge" class="cw-host-badge" style="display:none;">Hôte</div>'
    +     '<div class="cw-ctrl-btn" onclick="window._cwSeekBack()">'
    +       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5"/></svg>'
    +     '</div>'
    +     '<div class="cw-ctrl-btn" onclick="window._cwSeekFwd()">'
    +       '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-5"/></svg>'
    +     '</div>'
    +   '</div>'
    +   '<div class="cw-reactions">'
    +     ['❤️','😂','😮','🔥','👏','😭'].map(function(e){
    +       return '<button class="cw-react-btn" onclick="window._cwReact(\'' + e + '\')">' + e + '</button>';
    +     }).join('')
    +   '</div>'
    +   '<div class="cw-chat" id="cwChat"></div>'
    + '</div>'

    + '</div>'; // #cowatchOverlay

  document.body.insertAdjacentHTML('beforeend', _html);

  // ── Helpers UI ───────────────────────────────────────────────────
  function _showScreen(id) {
    ['cwBetaScreen','cwLobbyScreen','cwWaitScreen','cwPlayerScreen'].forEach(function(s) {
      var el = document.getElementById(s);
      if (el) el.classList.toggle('active', s === id);
    });
  }

  // ── Beta gate ────────────────────────────────────────────────────
  function _isBetaUnlocked() {
    try { return localStorage.getItem(BETA_LS_KEY) === '1'; } catch(e) { return false; }
  }

  window._cwBetaSubmit = function() {
    var input = document.getElementById('cwBetaInput');
    if (!input) return;
    if (input.value.trim() === BETA_CODE) {
      try { localStorage.setItem(BETA_LS_KEY, '1'); } catch(e) {}
      _showScreen('cwLobbyScreen');
    } else {
      input.classList.add('error');
      setTimeout(function() { input.classList.remove('error'); }, 400);
      input.value = '';
    }
  };

  // ── Extraction YouTube ID ────────────────────────────────────────
  function _ytId(url) {
    var m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  // ── Preview URL ──────────────────────────────────────────────────
  var _previewDebounce = null;
  document.getElementById('cwUrlInput').addEventListener('input', function() {
    clearTimeout(_previewDebounce);
    var val = this.value.trim();
    var id = _ytId(val);
    var startBtn = document.getElementById('cwStartBtn');
    var preview = document.getElementById('cwUrlPreview');
    if (!id) {
      startBtn.disabled = true;
      preview.classList.remove('visible');
      return;
    }
    _previewDebounce = setTimeout(function() {
      document.getElementById('cwPreviewThumb').src = 'https://img.youtube.com/vi/' + id + '/mqdefault.jpg';
      document.getElementById('cwPreviewTitle').textContent = 'Vidéo YouTube';
      document.getElementById('cwPreviewChannel').textContent = 'youtube.com/watch?v=' + id;
      preview.classList.add('visible');
      startBtn.disabled = false;
    }, 400);
  });

  // ── Lancer session ───────────────────────────────────────────────
  window._cwStart = function() {
    var url   = document.getElementById('cwUrlInput').value.trim();
    var ytId  = _ytId(url);
    if (!ytId) return;
    var profile = typeof getProfile === 'function' ? getProfile() : null;
    if (!profile) return;
    _myRole  = profile;
    _isHost  = true;
    _showScreen('cwWaitScreen');
    _initMultiplayer(ytId, profile);
  };

  // ── Rejoindre depuis une session existante ────────────────────────
  // (appelé automatiquement via onMatchFound si l'autre a déjà créé)
  function _joinSession(gameRow) {
    _isHost = false;
    _showScreen('cwPlayerScreen');
    _initYTPlayer(gameRow.state.ytId, false);
  }

  // ── Multiplayer init ─────────────────────────────────────────────
  function _initMultiplayer(ytId, profile) {
    if (typeof YAMMultiplayer === 'undefined') {
      showToast('Erreur : module multijoueur introuvable', 'error'); return;
    }
    _mp = YAMMultiplayer.init({
      gameTable    : COWATCH_TABLE,
      presenceTable: COWATCH_PRESENCE,
      deleteOnLeave: false,

      buildInitialState: function() {
        return {
          ytId    : ytId,
          playing : false,
          currentTime: 0,
          ts      : Date.now(),
          reactions: [],
          host    : profile
        };
      },

      onWaiting: function(me, other) {
        var myName    = typeof v2GetDisplayName === 'function' ? v2GetDisplayName(me)    : me;
        var otherName = typeof v2GetDisplayName === 'function' ? v2GetDisplayName(other) : other;
        document.getElementById('cwWaitMsg').textContent = 'En attente que ' + otherName + ' rejoigne…';
      },

      onLobbyTick: function(girlOk, boyOk) {
        var dg = document.getElementById('cwDotGirl');
        var db = document.getElementById('cwDotBoy');
        if (dg) { dg.classList.toggle('online', girlOk); }
        if (db) { db.classList.toggle('online', boyOk); }
        var ng = typeof v2GetDisplayName === 'function' ? v2GetDisplayName('girl') : 'Elle';
        var nb = typeof v2GetDisplayName === 'function' ? v2GetDisplayName('boy')  : 'Lui';
        var elg = document.getElementById('cwNameGirl'); if (elg) elg.textContent = ng;
        var elb = document.getElementById('cwNameBoy');  if (elb) elb.textContent = nb;
      },

      onMatchFound: function(gameRow) {
        var state = gameRow.state || {};
        _isHost = (state.host === _myRole);
        _showScreen('cwPlayerScreen');
        if (document.getElementById('cwHostBadge'))
          document.getElementById('cwHostBadge').style.display = _isHost ? '' : 'none';
        _initYTPlayer(state.ytId || ytId, true);
      },

      onStateUpdate: function(gameRow) {
        _onRemoteState(gameRow.state);
      },

      onPresenceUpdate: function(isOnline) {
        // indicateur dans les contrôles si besoin
      },

      onAbandon: function() {
        if (typeof showToast === 'function') showToast('L\'autre a quitté la session', 'info');
        _showScreen('cwLobbyScreen');
      },

      onBothAbsent: function() {
        _showScreen('cwLobbyScreen');
      },

      onLeave: function() {
        _showScreen('cwLobbyScreen');
      }
    });

    _mp.enter(profile);
  }

  // ── YouTube IFrame API ───────────────────────────────────────────
  function _loadYTApi(cb) {
    if (_ytReady) { cb(); return; }
    if (window.YT && window.YT.Player) { _ytReady = true; cb(); return; }
    var prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function() {
      _ytReady = true;
      if (typeof prev === 'function') prev();
      cb();
    };
    if (!document.getElementById('yt-iframe-api')) {
      var s = document.createElement('script');
      s.id  = 'yt-iframe-api';
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  }

  function _initYTPlayer(ytId, autoSync) {
    _loadYTApi(function() {
      var wrap = document.getElementById('cwYTPlayer');
      if (!wrap) return;
      wrap.innerHTML = '';
      _player = new YT.Player('cwYTPlayer', {
        width : '100%',
        videoId: ytId,
        playerVars: {
          playsinline : 1,
          controls    : 0,   // on gère nos propres contrôles
          rel         : 0,
          modestbranding: 1
        },
        events: {
          onReady: function() {
            if (autoSync) _showSyncOverlay(true);
            _startTimeUpdater();
          },
          onStateChange: function(e) {
            _onPlayerStateChange(e.data);
          }
        }
      });
    });
  }

  // ── Sync overlay ─────────────────────────────────────────────────
  function _showSyncOverlay(show) {
    var ov = document.getElementById('cwSyncOverlay');
    if (ov) ov.classList.toggle('active', show);
  }

  // ── Mise à jour icône play/pause ─────────────────────────────────
  function _updatePlayIcon(playing) {
    var icon = document.getElementById('cwPlayIcon');
    if (!icon) return;
    if (playing) {
      icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    } else {
      icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    }
  }

  // ── Updater temps ────────────────────────────────────────────────
  var _timeIv = null;
  function _startTimeUpdater() {
    if (_timeIv) clearInterval(_timeIv);
    _timeIv = setInterval(function() {
      if (!_player || typeof _player.getCurrentTime !== 'function') return;
      var cur  = _player.getCurrentTime() || 0;
      var dur  = _player.getDuration()    || 0;
      var el   = document.getElementById('cwTime');
      if (el) el.textContent = _fmt(cur) + ' / ' + _fmt(dur);
    }, 500);
  }

  function _fmt(s) {
    s = Math.floor(s);
    var m = Math.floor(s / 60), ss = s % 60;
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  // ── Gestion état player local ────────────────────────────────────
  function _onPlayerStateChange(state) {
    if (_isSyncing) return;
    if (!_isHost) return; // seul l'hôte broadcast ses actions
    var YTS = window.YT ? window.YT.PlayerState : {};
    if (state === (YTS.PLAYING || 1)) {
      _updatePlayIcon(true);
      _broadcastState({ playing: true, currentTime: _player.getCurrentTime(), ts: Date.now() });
    } else if (state === (YTS.PAUSED || 2)) {
      _updatePlayIcon(false);
      _broadcastState({ playing: false, currentTime: _player.getCurrentTime(), ts: Date.now() });
    }
  }

  // ── Broadcast état ───────────────────────────────────────────────
  function _broadcastState(patch) {
    if (!_mp) return;
    var gameRow = _mp.getCurrentState ? _mp.getCurrentState() : {};
    var newState = Object.assign({}, gameRow, patch);
    _mp.saveState(newState);
  }

  // ── Recevoir état distant ────────────────────────────────────────
  function _onRemoteState(state) {
    if (!state || !_player || typeof _player.seekTo !== 'function') return;
    if (!state.ts || state.ts <= _lastRemoteTs) return;
    _lastRemoteTs = state.ts;

    // Ignorer les updates qu'on a nous-mêmes envoyés (hôte)
    if (_isHost) return;

    _isSyncing = true;
    _showSyncOverlay(true);

    var lag = (Date.now() - state.ts) / 1000; // latence réseau estimée
    var targetTime = (state.currentTime || 0) + (state.playing ? lag : 0);

    _player.seekTo(targetTime, true);

    setTimeout(function() {
      if (state.playing) {
        _player.playVideo();
        _updatePlayIcon(true);
      } else {
        _player.pauseVideo();
        _updatePlayIcon(false);
      }
      _showSyncOverlay(false);
      _isSyncing = false;
    }, 600);

    // Afficher réactions reçues
    if (Array.isArray(state.reactions) && state.reactions.length > 0) {
      var last = state.reactions[state.reactions.length - 1];
      if (last && last.ts > (_lastRemoteTs - 3000)) {
        _showFloatReaction(last.emoji, false);
        _addChatMsg(last.emoji, last.role !== _myRole);
      }
    }
  }

  // ── Contrôles hôte ───────────────────────────────────────────────
  window._cwTogglePlay = function() {
    if (!_player) return;
    var YTS = window.YT ? window.YT.PlayerState : {};
    var playing = _player.getPlayerState() === (YTS.PLAYING || 1);
    if (playing) {
      _player.pauseVideo();
    } else {
      _player.playVideo();
    }
    // Le broadcast se fait via onStateChange
  };

  window._cwSeekBack = function() {
    if (!_player) return;
    var t = Math.max(0, _player.getCurrentTime() - 10);
    _player.seekTo(t, true);
    if (_isHost) _broadcastState({ currentTime: t, ts: Date.now() });
  };

  window._cwSeekFwd = function() {
    if (!_player) return;
    var t = _player.getCurrentTime() + 10;
    _player.seekTo(t, true);
    if (_isHost) _broadcastState({ currentTime: t, ts: Date.now() });
  };

  // ── Réactions ────────────────────────────────────────────────────
  window._cwReact = function(emoji) {
    _showFloatReaction(emoji, true);
    _addChatMsg(emoji, false);
    if (!_mp) return;
    var state = _mp.getCurrentState ? _mp.getCurrentState() : {};
    var reactions = (state.reactions || []).slice(-9); // garde les 10 dernières
    reactions.push({ emoji: emoji, role: _myRole, ts: Date.now() });
    _broadcastState({ reactions: reactions, ts: Date.now() });
  };

  function _showFloatReaction(emoji, isMine) {
    var el = document.createElement('div');
    el.className = 'cw-float-reaction';
    el.textContent = emoji;
    var x = isMine ? (20 + Math.random() * 30) : (50 + Math.random() * 30);
    el.style.cssText = 'left:' + x + 'vw;bottom:35vh;animation-duration:' + (1.2 + Math.random() * 0.4) + 's;';
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 2000);
  }

  function _addChatMsg(emoji, isMine) {
    var chat = document.getElementById('cwChat');
    if (!chat) return;
    var msg = document.createElement('div');
    msg.className = 'cw-chat-msg' + (isMine ? ' mine' : '');
    var now = new Date();
    var time = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
    msg.innerHTML = '<div class="cw-chat-bubble">' + emoji + '</div>'
      + '<div class="cw-chat-time">' + time + '</div>';
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
  }

  // ── Quitter ──────────────────────────────────────────────────────
  window._cwLeave = function() {
    if (_mp) { _mp.leave(); _mp = null; }
    if (_player) { try { _player.destroy(); } catch(e) {} _player = null; }
    if (_timeIv) { clearInterval(_timeIv); _timeIv = null; }
    _isHost = false;
    _isSyncing = false;
    _lastRemoteTs = 0;
    document.getElementById('cwUrlInput').value = '';
    document.getElementById('cwUrlPreview').classList.remove('visible');
    document.getElementById('cwStartBtn').disabled = true;
    document.getElementById('cwChat').innerHTML = '';
    _showScreen('cwLobbyScreen');
  };

  // ── API publique ─────────────────────────────────────────────────
  window.openCowatchModal = function() {
    var ov = document.getElementById('cowatchOverlay');
    if (!ov) return;
    ov.classList.add('active');
    document.body.classList.add('subview-active');
    _myRole = typeof getProfile === 'function' ? getProfile() : null;

    // Écran initial selon beta
    if (_isBetaUnlocked()) {
      _showScreen('cwLobbyScreen');
    } else {
      _showScreen('cwBetaScreen');
    }
  };

  window.closeCowatchModal = function() {
    window._cwLeave();
    var ov = document.getElementById('cowatchOverlay');
    if (ov) ov.classList.remove('active');
    document.body.classList.remove('subview-active');
  };

  // Entrée code beta via Enter
  document.getElementById('cwBetaInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') window._cwBetaSubmit();
  });

})();

// ════════════════════════════════════════════════════════════════════
// SQL Supabase à exécuter avant le déploiement :
//
// CREATE TABLE IF NOT EXISTS v2_cowatch_sessions (
//   id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   couple_id  uuid NOT NULL,
//   state      jsonb NOT NULL DEFAULT '{}',
//   created_at timestamptz DEFAULT now(),
//   updated_at timestamptz DEFAULT now()
// );
// CREATE TABLE IF NOT EXISTS v2_cowatch_presence (
//   id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   couple_id  uuid NOT NULL,
//   role       text NOT NULL,
//   last_seen  timestamptz DEFAULT now(),
//   UNIQUE(couple_id, role)
// );
// ════════════════════════════════════════════════════════════════════
