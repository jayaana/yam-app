// ════════════════════════════════════════════════════════════════════
// APP-COWATCH.JS v4.0-beta
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var TABLE    = 'v2_cowatch_sessions';
  var BETA_CODE= 'YAMNOW';
  var BETA_KEY = 'yam_cowatch_beta_ok';
  var POLL_MS  = 3000;   // poll état
  var PRES_MS  = 5000;   // heartbeat présence
  var BROADCAST_MS = 5000; // hôte broadcast currentTime toutes les 5s
  var DRIFT_MAX = 10;    // secondes de dérive max avant seekTo
  var SEEK_COOLDOWN = 15000; // ms minimum entre deux seekTo non-hôte

  var _myRole=null,_coupleId=null,_sessionId=null;
  var _isHost=false,_player=null,_ytReady=false;
  var _pollIv=null,_timeIv=null,_presIv=null,_broadcastIv=null;
  var _isSyncing=false,_lastSeekAt=0,_lastAppliedTs=0,_lastChatTs=0,_lastReactTs=0;

  // ── CSS ────────────────────────────────────────────────────────────
  var st=document.createElement('style');
  st.textContent=[
    '#cwOv{display:none;position:fixed;inset:0;z-index:2600;background:var(--bg);flex-direction:column;}',
    '#cwOv.on{display:flex;}',
    '#cwHdr{display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border);gap:12px;flex-shrink:0;}',
    '#cwHdr h2{flex:1;font-size:17px;font-weight:700;font-family:"Bricolage Grotesque",sans-serif;color:var(--text);}',
    '.cw-back{width:36px;height:36px;border-radius:50%;background:var(--s2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}',
    '.cw-bbadge{background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;font-size:9px;font-weight:800;letter-spacing:1.5px;padding:3px 8px;border-radius:20px;}',
    '.cw-sc{display:none;flex-direction:column;flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;}',
    '.cw-sc.on{display:flex;}',
    '#cwScBeta{align-items:center;justify-content:center;padding:40px 24px;gap:20px;text-align:center;}',
    '.cw-bi{font-size:52px;}.cw-bt{font-family:"Bricolage Grotesque",sans-serif;font-size:22px;font-weight:800;color:var(--text);}',
    '.cw-bs{font-size:14px;color:var(--muted);line-height:1.5;max-width:280px;}',
    '.cw-binput{width:100%;max-width:280px;padding:14px 18px;background:var(--s1);border:1.5px solid var(--border);border-radius:14px;font-size:20px;font-weight:700;letter-spacing:5px;text-align:center;color:var(--text);font-family:"Bricolage Grotesque",sans-serif;outline:none;transition:border-color .2s;-webkit-appearance:none;box-sizing:border-box;}',
    '.cw-binput:focus{border-color:var(--accent);}.cw-binput.err{border-color:#ef4444;animation:cwShk .35s;}',
    '@keyframes cwShk{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}',
    '.cw-btn{background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 70%,var(--green)));color:#fff;border:none;border-radius:50px;padding:14px 40px;font-size:15px;font-weight:700;cursor:pointer;font-family:"Bricolage Grotesque",sans-serif;box-shadow:0 4px 20px rgba(201,120,96,.3);transition:transform .12s;position:relative;overflow:hidden;}',
    '.cw-btn::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.15) 0%,transparent 60%);pointer-events:none;}',
    '.cw-btn:active{transform:scale(.97);}.cw-btn:disabled{opacity:.4;cursor:not-allowed;transform:none;}',
    '.cw-btn-ghost{background:var(--s2);color:var(--muted);border:1.5px solid var(--border);border-radius:50px;padding:12px 32px;font-size:14px;font-weight:600;cursor:pointer;font-family:"Bricolage Grotesque",sans-serif;}',
    '#cwScLobby{padding:24px 20px;gap:18px;}',
    '.cw-label{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);}',
    '.cw-urlinput{width:100%;padding:13px 16px;background:var(--s1);border:1.5px solid var(--border);border-radius:14px;font-size:14px;color:var(--text);font-family:"Bricolage Grotesque",sans-serif;outline:none;transition:border-color .2s;-webkit-appearance:none;box-sizing:border-box;}',
    '.cw-urlinput:focus{border-color:var(--accent);}',
    '.cw-preview{background:var(--s1);border:1px solid var(--border);border-radius:12px;overflow:hidden;display:none;}',
    '.cw-preview.on{display:block;}.cw-preview img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;}',
    '.cw-preview-info{padding:10px 14px;}.cw-preview-id{font-size:12px;color:var(--muted);}',
    '#cwScWait{align-items:center;justify-content:center;padding:40px 24px;gap:16px;text-align:center;}',
    '.cw-spin{width:52px;height:52px;border-radius:50%;border:3px solid var(--border);border-top-color:var(--accent);animation:cwRot 1s linear infinite;}',
    '@keyframes cwRot{to{transform:rotate(360deg)}}',
    '.cw-wt{font-family:"Bricolage Grotesque",sans-serif;font-size:18px;font-weight:700;color:var(--text);}',
    '.cw-ws{font-size:13px;color:var(--muted);line-height:1.5;max-width:260px;}',
    '#cwScJoin{align-items:center;justify-content:center;padding:40px 24px;gap:18px;text-align:center;}',
    '.cw-join-thumb{width:100%;max-width:300px;border-radius:14px;overflow:hidden;border:1px solid var(--border);}',
    '.cw-join-thumb img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;}',
    '.cw-join-title{font-family:"Bricolage Grotesque",sans-serif;font-size:20px;font-weight:800;color:var(--text);}',
    '.cw-join-sub{font-size:13px;color:var(--muted);}.cw-join-host{font-size:14px;color:var(--accent);font-weight:700;}',
    // Player screen
    '#cwScPlayer{flex:1;flex-direction:column;overflow:hidden;}',
    // Barre présence + actions
    '.cw-top-bar{flex-shrink:0;padding:7px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);background:var(--s1);}',
    '.cw-pres-item{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);font-weight:500;}',
    '.cw-pdot{width:8px;height:8px;border-radius:50%;background:#555;flex-shrink:0;transition:background .4s,box-shadow .4s;}',
    '.cw-pdot.on{background:#22c55e;box-shadow:0 0 5px rgba(34,197,94,.7);}',
    '.cw-pavatar{width:22px;height:22px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid var(--border);}',
    '.cw-top-actions{margin-left:auto;display:flex;gap:6px;align-items:center;}',
    '.cw-icon-btn{width:32px;height:32px;border-radius:50%;background:var(--s2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;flex-shrink:0;}',
    '.cw-icon-btn:active{opacity:.7;}',
    '.cw-icon-btn svg{pointer-events:none;}',
    '.cw-hbadge{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:10px;background:rgba(201,120,96,.15);color:var(--accent);border:1px solid rgba(201,120,96,.3);}',
    // Vidéo
    '.cw-vwrap{position:relative;width:100%;background:#000;flex-shrink:0;}',
    '#cwYTDiv{display:block;width:100%;aspect-ratio:16/9;}',
    '.cw-syncov{position:absolute;inset:0;background:rgba(0,0,0,.65);display:none;align-items:center;justify-content:center;flex-direction:column;gap:8px;z-index:5;}',
    '.cw-syncov.on{display:flex;}',
    '.cw-syncspin{width:28px;height:28px;border-radius:50%;border:3px solid rgba(255,255,255,.2);border-top-color:#fff;animation:cwRot .8s linear infinite;}',
    '.cw-synctxt{font-size:11px;color:rgba(255,255,255,.8);font-weight:600;}',
    // Contrôles
    '.cw-ctrl{flex-shrink:0;padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;}',
    '.cw-cbtn{width:40px;height:40px;border-radius:50%;border:1.5px solid var(--border);background:var(--s2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .1s,opacity .2s;flex-shrink:0;-webkit-tap-highlight-color:transparent;}',
    '.cw-cbtn:active{transform:scale(.9);}.cw-cbtn svg{pointer-events:none;}',
    '.cw-cbtn.pri{background:var(--accent);border-color:var(--accent);}',
    '.cw-cbtn.dis{opacity:.28;pointer-events:none;}',
    '.cw-time{flex:1;font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;font-weight:600;text-align:center;}',
    // Réactions
    '.cw-reacts{flex-shrink:0;padding:7px 14px;display:flex;justify-content:space-around;border-bottom:1px solid var(--border);}',
    '.cw-rbtn{font-size:22px;padding:5px 8px;border-radius:12px;border:none;background:transparent;cursor:pointer;transition:transform .15s;-webkit-tap-highlight-color:transparent;}',
    '.cw-rbtn:active{transform:scale(1.4);}',
    // Float réaction
    '.cw-float{position:fixed;pointer-events:none;z-index:2700;animation:cwFloat 1.5s ease-out forwards;display:flex;flex-direction:column;align-items:center;gap:3px;}',
    '.cw-float-emoji{font-size:30px;line-height:1;}',
    '.cw-float-info{display:flex;align-items:center;gap:4px;}',
    '.cw-float-av{width:18px;height:18px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,255,255,.4);}',
    '.cw-float-name{font-size:10px;font-weight:700;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.7);}',
    '@keyframes cwFloat{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-100px) scale(1.4);opacity:0}}',
    // Chat
    '.cw-chat-wrap{flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;}',
    '.cw-chat{flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:8px;-webkit-overflow-scrolling:touch;}',
    '.cw-cmsg{display:flex;align-items:flex-end;gap:7px;max-width:85%;}',
    '.cw-cmsg.mine{align-self:flex-end;flex-direction:row-reverse;}',
    '.cw-cmsg.other{align-self:flex-start;}',
    '.cw-cavatar{width:26px;height:26px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid var(--border);}',
    '.cw-cbody{display:flex;flex-direction:column;gap:2px;}',
    '.cw-cmsg.mine .cw-cbody{align-items:flex-end;}',
    '.cw-cname{font-size:10px;color:var(--muted);font-weight:600;padding:0 4px;}',
    '.cw-cbubble{padding:8px 12px;border-radius:16px;font-size:13px;line-height:1.4;word-break:break-word;max-width:220px;}',
    '.cw-cmsg.other .cw-cbubble{background:var(--s2);border:1px solid var(--border);color:var(--text);border-bottom-left-radius:4px;}',
    '.cw-cmsg.mine .cw-cbubble{background:rgba(201,120,96,.2);border:1px solid rgba(201,120,96,.35);color:var(--text);border-bottom-right-radius:4px;}',
    '.cw-cbubble.emoji-only{background:transparent!important;border:none!important;font-size:26px;padding:2px 4px;}',
    '.cw-ctime{font-size:9px;color:var(--muted);padding:0 4px;}',
    '.cw-chat-input-wrap{flex-shrink:0;padding:8px 12px;border-top:1px solid var(--border);display:flex;gap:8px;align-items:flex-end;background:var(--bg);}',
    '.cw-chat-input{flex:1;padding:9px 14px;background:var(--s1);border:1.5px solid var(--border);border-radius:20px;font-size:14px;color:var(--text);font-family:"Bricolage Grotesque",sans-serif;outline:none;resize:none;max-height:80px;transition:border-color .2s;-webkit-appearance:none;box-sizing:border-box;}',
    '.cw-chat-input:focus{border-color:var(--accent);}',
    '.cw-send-btn{width:36px;height:36px;border-radius:50%;background:var(--accent);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform .1s,opacity .15s;-webkit-tap-highlight-color:transparent;}',
    '.cw-send-btn:active{transform:scale(.9);}.cw-send-btn:disabled{opacity:.35;cursor:not-allowed;}',
    '.cw-send-btn svg{pointer-events:none;}',
    '.cw-chat-empty{flex:1;display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--muted);text-align:center;padding:20px;}',
  ].join('\n');
  document.head.appendChild(st);

  // ── HTML ───────────────────────────────────────────────────────────
  document.body.insertAdjacentHTML('beforeend',
    '<div id="cwOv">' +
    '<div id="cwHdr">' +
      '<div class="cw-back" onclick="window.closeCowatchModal()">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
      '</div>' +
      '<h2>\uD83D\uDCFA Regarder ensemble</h2>' +
      '<div class="cw-bbadge">BETA</div>' +
    '</div>' +
    '<div id="cwScBeta" class="cw-sc">' +
      '<div class="cw-bi">\uD83D\uDD10</div>' +
      '<div class="cw-bt">Acc\u00e8s b\u00eata</div>' +
      '<div class="cw-bs">Entre le code d\u2019acc\u00e8s pour tester cette fonctionnalit\u00e9.</div>' +
      '<input id="cwBetaIn" class="cw-binput" type="text" placeholder="CODE" autocomplete="off" autocorrect="off" spellcheck="false" />' +
      '<button class="cw-btn" onclick="window._cwBetaOk()">Acc\u00e9der \u2728</button>' +
    '</div>' +
    '<div id="cwScLobby" class="cw-sc">' +
      '<div class="cw-label">Colle un lien YouTube</div>' +
      '<input id="cwUrlIn" class="cw-urlinput" type="url" placeholder="https://youtube.com/watch?v=..." autocomplete="off" />' +
      '<div id="cwPreview" class="cw-preview">' +
        '<img id="cwThumb" src="" alt="" />' +
        '<div class="cw-preview-info"><div id="cwPreviewId" class="cw-preview-id"></div></div>' +
      '</div>' +
      '<button class="cw-btn" id="cwGoBtn" onclick="window._cwLaunch()" disabled>Lancer la session \uD83C\uDFAC</button>' +
      '<div style="font-size:12px;color:var(--muted);text-align:center;line-height:1.6;">Tu seras l\u2019h\u00f4te et tu contr\u00f4les la lecture.<br>L\u2019autre verra une invitation d\u00e8s qu\u2019il ouvre cette section.</div>' +
    '</div>' +
    '<div id="cwScWait" class="cw-sc">' +
      '<div class="cw-spin"></div>' +
      '<div class="cw-wt">En attente\u2026</div>' +
      '<div class="cw-ws" id="cwWaitTxt">En attente que l\u2019autre rejoigne.</div>' +
      '<button class="cw-btn-ghost" onclick="window._cwCancel()">Annuler la session</button>' +
    '</div>' +
    '<div id="cwScJoin" class="cw-sc">' +
      '<div class="cw-join-host" id="cwJoinHost"></div>' +
      '<div class="cw-join-title">t\u2019invite \u00e0 regarder</div>' +
      '<div class="cw-join-thumb"><img id="cwJoinThumb" src="" alt="" /></div>' +
      '<div class="cw-join-sub" id="cwJoinSub"></div>' +
      '<button class="cw-btn" onclick="window._cwJoin()">Rejoindre \uD83C\uDF7F</button>' +
      '<button class="cw-btn-ghost" style="margin-top:4px;" onclick="window.closeCowatchModal()">Pas maintenant</button>' +
    '</div>' +
    '<div id="cwScPlayer" class="cw-sc">' +
      // Barre présence + actions
      '<div class="cw-top-bar">' +
        '<div class="cw-pres-item">' +
          '<img id="cwPresAvMe" class="cw-pavatar" src="" alt="" />' +
          '<div class="cw-pdot on" id="cwPresMe"></div>' +
          '<span id="cwPresNameMe">Moi</span>' +
        '</div>' +
        '<div class="cw-pres-item" style="margin-left:10px;">' +
          '<img id="cwPresAvOther" class="cw-pavatar" src="" alt="" />' +
          '<div class="cw-pdot" id="cwPresOther"></div>' +
          '<span id="cwPresNameOther">L\u2019autre</span>' +
        '</div>' +
        '<div class="cw-top-actions">' +
          // Plein écran
          '<div class="cw-icon-btn" onclick="window._cwFullscreen()" title="Plein \u00e9cran">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>' +
          '</div>' +
          // Thème
          '<div class="cw-icon-btn" onclick="window._cwToggleTheme()" id="cwThemeBtn" title="Changer le th\u00e8me">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' +
          '</div>' +
          '<div id="cwRoleBadge" class="cw-hbadge" style="display:none;">H\u00f4te</div>' +
        '</div>' +
      '</div>' +
      '<div class="cw-vwrap">' +
        '<div id="cwYTDiv"></div>' +
        '<div class="cw-syncov" id="cwSyncOv"><div class="cw-syncspin"></div><div class="cw-synctxt">Synchronisation\u2026</div></div>' +
      '</div>' +
      '<div class="cw-ctrl">' +
        '<div class="cw-cbtn pri" id="cwPlayBtn" onclick="window._cwPlay()">' +
          '<svg id="cwPlayIc" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>' +
        '</div>' +
        '<div class="cw-cbtn" id="cwBack10" onclick="window._cwBack10()">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5"/></svg>' +
        '</div>' +
        '<div class="cw-time" id="cwTime">0:00 / 0:00</div>' +
        '<div class="cw-cbtn" id="cwFwd10" onclick="window._cwFwd10()">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-5"/></svg>' +
        '</div>' +
      '</div>' +
      '<div class="cw-reacts">' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'\u2764\uFE0F\')">\u2764\uFE0F</button>' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'\uD83D\uDE02\')">\uD83D\uDE02</button>' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'\uD83D\uDE2E\')">\uD83D\uDE2E</button>' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'\uD83D\uDD25\')">\uD83D\uDD25</button>' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'\uD83D\uDC4F\')">\uD83D\uDC4F</button>' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'\uD83D\uDE2D\')">\uD83D\uDE2D</button>' +
      '</div>' +
      '<div class="cw-chat-wrap">' +
        '<div class="cw-chat" id="cwChat">' +
          '<div class="cw-chat-empty" id="cwChatEmpty">Aucun message pour l\u2019instant \uD83C\uDF7F</div>' +
        '</div>' +
        '<div class="cw-chat-input-wrap">' +
          '<textarea id="cwChatInput" class="cw-chat-input" rows="1" placeholder="Envoyer un message\u2026" maxlength="300"></textarea>' +
          '<button class="cw-send-btn" id="cwSendBtn" onclick="window._cwSend()" disabled>' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '</div>'
  );

  // ── Helpers ────────────────────────────────────────────────────────
  function _sc(id){['cwScBeta','cwScLobby','cwScWait','cwScJoin','cwScPlayer'].forEach(function(s){var el=document.getElementById(s);if(el)el.classList.toggle('on',s===id);});}
  function _ytId(url){var m=(url||'').match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);return m?m[1]:null;}
  function _fmt(s){s=Math.floor(s||0);var m=Math.floor(s/60),ss=s%60;return m+':'+(ss<10?'0':'')+ss;}
  function _getCoupleId(){var u=typeof v2GetUser==='function'?v2GetUser():null;return u?u.couple_id:null;}
  function _betaOk(){try{return localStorage.getItem(BETA_KEY)==='1';}catch(e){return false;}}
  function _otherRole(r){return r==='girl'?'boy':'girl';}
  function _name(r){return typeof v2GetDisplayName==='function'?v2GetDisplayName(r):(r==='girl'?'Elle':'Lui');}
  function _escHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function _isEmojiOnly(s){try{return /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\s)+$/u.test(s.trim());}catch(e){return false;}}

  // Avatar URL depuis yamAvatarSrc ou fallback initiale
  function _avatarUrl(role) {
    try {
      var u = typeof v2GetUser === 'function' ? v2GetUser() : null;
      if(u && typeof window.yamAvatarSrc === 'function') return window.yamAvatarSrc(role) || null;
    } catch(e){}
    return null;
  }

  function _avatarEl(role, className) {
    var url = _avatarUrl(role);
    if(url) return '<img class="'+className+'" src="'+_escHtml(url)+'" alt="" />';
    // Fallback cercle initiale
    var init = _name(role).charAt(0).toUpperCase();
    return '<div class="'+className+'" style="background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--muted);">'+_escHtml(init)+'</div>';
  }

  // ── Beta ───────────────────────────────────────────────────────────
  window._cwBetaOk=function(){
    var el=document.getElementById('cwBetaIn');if(!el)return;
    if(el.value.trim().toUpperCase()===BETA_CODE){try{localStorage.setItem(BETA_KEY,'1');}catch(e){}_afterBeta();}
    else{el.classList.add('err');el.value='';setTimeout(function(){el.classList.remove('err');},400);}
  };
  document.getElementById('cwBetaIn').addEventListener('keydown',function(e){if(e.key==='Enter')window._cwBetaOk();});
  document.getElementById('cwBetaIn').addEventListener('input',function(){this.value=this.value.toUpperCase();});

  // ── Preview URL ────────────────────────────────────────────────────
  var _pvDeb=null;
  document.getElementById('cwUrlIn').addEventListener('input',function(){
    clearTimeout(_pvDeb);var id=_ytId(this.value.trim());
    var btn=document.getElementById('cwGoBtn'),prv=document.getElementById('cwPreview');
    if(!id){btn.disabled=true;prv.classList.remove('on');return;}
    _pvDeb=setTimeout(function(){
      document.getElementById('cwThumb').src='https://img.youtube.com/vi/'+id+'/mqdefault.jpg';
      document.getElementById('cwPreviewId').textContent='youtube.com/watch?v='+id;
      prv.classList.add('on');btn.disabled=false;
    },350);
  });

  // ── Chat input ─────────────────────────────────────────────────────
  document.getElementById('cwChatInput').addEventListener('input',function(){
    var btn=document.getElementById('cwSendBtn');if(btn)btn.disabled=this.value.trim().length===0;
    this.style.height='auto';this.style.height=Math.min(this.scrollHeight,80)+'px';
  });
  document.getElementById('cwChatInput').addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();window._cwSend();}
  });

  // ── Ouvrir ─────────────────────────────────────────────────────────
  window.openCowatchModal=function(){
    var ov=document.getElementById('cwOv');if(!ov)return;
    ov.classList.add('on');document.body.classList.add('subview-active');
    _myRole=typeof getProfile==='function'?getProfile():null;
    _coupleId=_getCoupleId();
    if(!_betaOk()){_sc('cwScBeta');return;}
    _afterBeta();
  };

  function _afterBeta(){
    if(!_coupleId){_sc('cwScLobby');return;}
    fetch(SB2_URL+'/rest/v1/'+TABLE+'?couple_id=eq.'+encodeURIComponent(_coupleId)+'&active=eq.true&order=created_at.desc&limit=1',{headers:sb2Headers()})
    .then(function(r){return r.json();})
    .then(function(rows){
      if(!rows||!rows.length||rows[0].host_role===_myRole){_sc('cwScLobby');}
      else{
        var s=rows[0];_sessionId=s.id;
        document.getElementById('cwJoinHost').textContent=_name(s.host_role);
        document.getElementById('cwJoinThumb').src='https://img.youtube.com/vi/'+s.yt_id+'/mqdefault.jpg';
        document.getElementById('cwJoinSub').textContent='youtube.com/watch?v='+s.yt_id;
        _sc('cwScJoin');
      }
    }).catch(function(){_sc('cwScLobby');});
  }

  // ── Lancer ─────────────────────────────────────────────────────────
  window._cwLaunch=function(){
    var url=document.getElementById('cwUrlIn').value.trim();
    var ytId=_ytId(url);if(!ytId||!_coupleId||!_myRole)return;
    fetch(SB2_URL+'/rest/v1/'+TABLE+'?couple_id=eq.'+encodeURIComponent(_coupleId),{
      method:'PATCH',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
      body:JSON.stringify({active:false})
    }).then(function(){
      return fetch(SB2_URL+'/rest/v1/'+TABLE,{
        method:'POST',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=representation'}),
        body:JSON.stringify({couple_id:_coupleId,yt_id:ytId,host_role:_myRole,active:true,
          state:{playing:false,currentTime:0,ts:0,reactions:[],joined:false},
          chat:[],presence:{}})
      });
    }).then(function(r){return r.json();})
    .then(function(rows){
      if(!rows||!rows.length){if(typeof showToast==='function')showToast('Erreur','error');return;}
      _sessionId=rows[0].id;_isHost=true;
      document.getElementById('cwWaitTxt').textContent='En attente que '+_name(_otherRole(_myRole))+' rejoigne\u2026';
      _sc('cwScWait');_startWaitPoll();
    }).catch(function(){if(typeof showToast==='function')showToast('Erreur r\u00e9seau','error');});
  };

  function _startWaitPoll(){
    _stopPoll();
    _pollIv=setInterval(function(){
      if(!_sessionId)return;
      fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId)+'&select=state,yt_id',{headers:sb2Headers()})
      .then(function(r){return r.json();})
      .then(function(rows){
        if(!rows||!rows.length)return;
        if((rows[0].state||{}).joined){_stopPoll();_startPlayer(rows[0].yt_id);}
      }).catch(function(){});
    },POLL_MS);
  }

  window._cwJoin=function(){
    if(!_sessionId)return;_isHost=false;
    fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId),{
      method:'PATCH',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=representation'}),
      body:JSON.stringify({state:{joined:true,playing:false,currentTime:0,ts:0,reactions:[]}})
    }).then(function(r){return r.json();})
    .then(function(rows){if(!rows||!rows.length)return;_startPlayer(rows[0].yt_id);})
    .catch(function(){if(typeof showToast==='function')showToast('Erreur r\u00e9seau','error');});
  };

  window._cwCancel=function(){
    _stopPoll();
    if(_sessionId){fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId),{
      method:'PATCH',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
      body:JSON.stringify({active:false})
    }).catch(function(){});}
    _sessionId=null;_isHost=false;_sc('cwScLobby');
  };

  // ── Player ─────────────────────────────────────────────────────────
  function _startPlayer(ytId){
    _sc('cwScPlayer');
    // Badge hôte
    var badge=document.getElementById('cwRoleBadge');if(badge)badge.style.display=_isHost?'':'none';
    // Désactiver contrôles pour non-hôte
    ['cwBack10','cwFwd10','cwPlayBtn'].forEach(function(id){
      var el=document.getElementById(id);if(el)el.classList.toggle('dis',!_isHost);
    });
    // Présence : noms + avatars
    document.getElementById('cwPresNameMe').textContent=_name(_myRole);
    document.getElementById('cwPresNameOther').textContent=_name(_otherRole(_myRole));
    _setPresAvatar('cwPresAvMe',_myRole);
    _setPresAvatar('cwPresAvOther',_otherRole(_myRole));
    document.getElementById('cwPresMe').classList.add('on');
    _loadChat();
    _loadYT(function(){
      var wrap=document.getElementById('cwYTDiv');if(!wrap)return;
      wrap.innerHTML='';
      _player=new YT.Player('cwYTDiv',{
        width:'100%',videoId:ytId,
        playerVars:{playsinline:1,controls:0,rel:0,modestbranding:1,disablekb:1},
        events:{
          onReady:function(){_startTimeIv();if(_isHost)_startBroadcast();},
          onStateChange:function(e){_onYTState(e.data);}
        }
      });
    });
    _startSyncPoll();
    _startPresence();
  }

  function _setPresAvatar(elId,role){
    var el=document.getElementById(elId);if(!el)return;
    var url=_avatarUrl(role);
    if(url){el.src=url;el.style.display='';}
    else{el.style.display='none';}
  }

  // ── YouTube ────────────────────────────────────────────────────────
  function _loadYT(cb){
    if(_ytReady&&window.YT&&window.YT.Player){cb();return;}
    var prev=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=function(){_ytReady=true;if(typeof prev==='function')prev();cb();};
    if(window.YT&&window.YT.Player){_ytReady=true;cb();return;}
    if(!document.getElementById('yt-api-sc')){
      var s=document.createElement('script');s.id='yt-api-sc';
      s.src='https://www.youtube.com/iframe_api';document.head.appendChild(s);
    }
  }

  // ── Bloquer les interactions player pour le non-hôte ───────────────
  // On intercepte les clics sur l'iframe via un div transparent par-dessus
  function _lockPlayerForGuest(){
    var wrap=document.querySelector('.cw-vwrap');if(!wrap)return;
    var shield=document.getElementById('cwPlayerShield');
    if(!shield){
      shield=document.createElement('div');
      shield.id='cwPlayerShield';
      shield.style.cssText='position:absolute;inset:0;z-index:4;cursor:not-allowed;';
      wrap.appendChild(shield);
    }
    shield.style.display=_isHost?'none':'block';
  }

  function _onYTState(data){
    if(!_isHost)return;
    var P=window.YT?window.YT.PlayerState:{};
    if(data===(P.PLAYING||1)){_updatePlayIc(true);_broadcastNow(true);}
    if(data===(P.PAUSED||2)){_updatePlayIc(false);_broadcastNow(false);}
  }

  // Hôte : broadcast son état en temps réel toutes les BROADCAST_MS
  function _startBroadcast(){
    if(_broadcastIv)clearInterval(_broadcastIv);
    _broadcastIv=setInterval(function(){
      if(!_player||!_isHost||!_sessionId)return;
      var P=window.YT?window.YT.PlayerState:{};
      var playing=_player.getPlayerState()===(P.PLAYING||1);
      _broadcastNow(playing);
    },BROADCAST_MS);
  }
  function _broadcastNow(playing){
    if(!_player||!_sessionId)return;
    _saveState({playing:playing,currentTime:_player.getCurrentTime(),ts:Date.now()});
  }

  // ── Poll ────────────────────────────────────────────────────────────
  function _startSyncPoll(){
    _stopPoll();
    _pollIv=setInterval(function(){
      if(!_sessionId)return;
      fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId)+'&select=state,active,chat,presence',{headers:sb2Headers()})
      .then(function(r){return r.json();})
      .then(function(rows){
        if(!rows||!rows.length)return;
        var row=rows[0];
        if(!row.active){_stopAll();if(typeof showToast==='function')showToast('Session termin\u00e9e','info');_sc('cwScLobby');return;}
        var state=row.state||{};
        if(!_isHost)_applyStateIfNeeded(state);
        _handleReacts(state);
        _updatePresenceUI(row.presence||{});
        _applyChat(row.chat||[]);
      }).catch(function(){});
    },POLL_MS);
  }

  // ── Sync non-hôte : stable, sans boucle ────────────────────────────
  // Principe : l'hôte broadcast currentTime + ts toutes les 5s.
  // On recalcule la position attendue en ajoutant le lag réseau.
  // On ne seekTo QUE si la dérive > DRIFT_MAX ET cooldown respecté.
  // Pour play/pause : on agit immédiatement sans seekTo.
  function _applyStateIfNeeded(state){
    if(!state||!state.ts)return;
    if(!_player||typeof _player.seekTo!=='function')return;
    if(_isSyncing)return;

    var P=window.YT?window.YT.PlayerState:{};
    var isPlaying=_player.getPlayerState()===(P.PLAYING||1);
    var statePlaying=!!state.playing;
    var now=Date.now();

    // ── 1. Gérer play/pause si changé ──
    if(statePlaying!==isPlaying&&state.ts!==_lastAppliedTs){
      _lastAppliedTs=state.ts;
      if(statePlaying){_player.playVideo();_updatePlayIc(true);}
      else{_player.pauseVideo();_updatePlayIc(false);}
      // Ne pas retourner : on vérifie aussi la dérive ci-dessous
    }

    // ── 2. Calculer la dérive SEULEMENT si la vidéo tourne ──
    // Si pausée, pas besoin de rattraper
    if(!statePlaying)return;

    var lag=Math.min((now-state.ts)/1000,8); // lag réseau estimé, max 8s
    var expectedTime=(state.currentTime||0)+lag;
    var actualTime=_player.getCurrentTime()||0;
    var drift=actualTime-expectedTime; // positif = on est en avance, négatif = en retard

    // Cooldown entre deux seeks
    var cooldownOk=(now-_lastSeekAt)>SEEK_COOLDOWN;
    if(Math.abs(drift)<=DRIFT_MAX||!cooldownOk)return;

    // ── 3. seekTo uniquement si dérive réelle ──
    _isSyncing=true;
    _lastSeekAt=now;
    _lastAppliedTs=state.ts;
    _showSync(true);
    _player.seekTo(expectedTime,true);
    setTimeout(function(){
      _player.playVideo();_updatePlayIc(true);
      _showSync(false);_isSyncing=false;
    },800);
  }

  function _saveState(patch){
    if(!_sessionId)return;
    fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId),{
      method:'PATCH',
      headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
      body:JSON.stringify({state:patch,updated_at:new Date().toISOString()})
    }).catch(function(){});
  }

  // ── Présence ───────────────────────────────────────────────────────
  function _startPresence(){
    if(_presIv)clearInterval(_presIv);
    _heartbeat();_presIv=setInterval(_heartbeat,PRES_MS);
  }
  function _heartbeat(){
    if(!_sessionId)return;
    fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId)+'&select=presence',{headers:sb2Headers()})
    .then(function(r){return r.json();})
    .then(function(rows){
      if(!rows||!rows.length)return;
      var pres=rows[0].presence||{};pres[_myRole]=Date.now();
      fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId),{
        method:'PATCH',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
        body:JSON.stringify({presence:pres})
      }).catch(function(){});
    }).catch(function(){});
  }
  function _updatePresenceUI(pres){
    var now=Date.now();
    var myOk=pres[_myRole]&&(now-pres[_myRole])<PRES_MS*2.5;
    var otOk=pres[_otherRole(_myRole)]&&(now-pres[_otherRole(_myRole)])<PRES_MS*2.5;
    var me=document.getElementById('cwPresMe'),ot=document.getElementById('cwPresOther');
    if(me)me.classList.toggle('on',!!myOk);
    if(ot)ot.classList.toggle('on',!!otOk);
  }

  // ── Réactions ──────────────────────────────────────────────────────
  window._cwReact=function(emoji){
    _showFloat(emoji,_myRole);
    _addChatMsg({type:'react',emoji:emoji,role:_myRole,ts:Date.now()},true);
    if(!_sessionId)return;
    fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId)+'&select=state',{headers:sb2Headers()})
    .then(function(r){return r.json();})
    .then(function(rows){
      if(!rows||!rows[0])return;
      var state=rows[0].state||{};
      var reacts=(state.reactions||[]).slice(-9);
      reacts.push({emoji:emoji,role:_myRole,ts:Date.now()});
      state.reactions=reacts;
      fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId),{
        method:'PATCH',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
        body:JSON.stringify({state:state})
      }).catch(function(){});
    }).catch(function(){});
  };

  function _handleReacts(state){
    if(!Array.isArray(state.reactions)||!state.reactions.length)return;
    var last=state.reactions[state.reactions.length-1];
    if(!last||last.ts<=_lastReactTs||last.role===_myRole)return;
    _lastReactTs=last.ts;
    _showFloat(last.emoji,last.role);
    _addChatMsg({type:'react',emoji:last.emoji,role:last.role,ts:last.ts},false);
  }

  function _showFloat(emoji,role){
    var isMine=role===_myRole;
    var el=document.createElement('div');el.className='cw-float';
    el.style.cssText='left:'+((isMine?12:55)+Math.random()*22)+'vw;bottom:42vh;animation-duration:'+(1.2+Math.random()*0.4)+'s;';
    var url=_avatarUrl(role);
    var avHtml=url?'<img class="cw-float-av" src="'+_escHtml(url)+'" alt="" />':'';
    el.innerHTML='<div class="cw-float-emoji">'+emoji+'</div><div class="cw-float-info">'+avHtml+'<div class="cw-float-name">'+_escHtml(_name(role))+'</div></div>';
    document.body.appendChild(el);
    setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},2000);
  }

  // ── Chat ───────────────────────────────────────────────────────────
  window._cwSend=function(){
    var input=document.getElementById('cwChatInput');if(!input)return;
    var text=input.value.trim();if(!text||!_sessionId)return;
    input.value='';input.style.height='auto';
    var btn=document.getElementById('cwSendBtn');if(btn)btn.disabled=true;
    var msg={type:'text',text:text,role:_myRole,ts:Date.now()};
    _addChatMsg(msg,true);
    fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId)+'&select=chat',{headers:sb2Headers()})
    .then(function(r){return r.json();})
    .then(function(rows){
      if(!rows||!rows[0])return;
      var chat=(rows[0].chat||[]).slice(-49);chat.push(msg);
      fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId),{
        method:'PATCH',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
        body:JSON.stringify({chat:chat})
      }).catch(function(){});
    }).catch(function(){});
  };

  function _loadChat(){
    if(!_sessionId)return;
    fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId)+'&select=chat',{headers:sb2Headers()})
    .then(function(r){return r.json();})
    .then(function(rows){
      if(!rows||!rows[0])return;
      var chat=document.getElementById('cwChat');if(!chat)return;
      chat.innerHTML='<div class="cw-chat-empty" id="cwChatEmpty">Aucun message pour l\u2019instant \uD83C\uDF7F</div>';
      _lastChatTs=0;
      (rows[0].chat||[]).forEach(function(msg){_addChatMsg(msg,msg.role===_myRole);});
    }).catch(function(){});
  }

  function _applyChat(msgs){
    if(!Array.isArray(msgs)||!msgs.length)return;
    msgs.forEach(function(msg){
      if(!msg.ts||msg.ts<=_lastChatTs||msg.role===_myRole)return;
      _lastChatTs=Math.max(_lastChatTs,msg.ts);
      _addChatMsg(msg,false);
    });
  }

  function _addChatMsg(msg,isMine){
    var chat=document.getElementById('cwChat');if(!chat)return;
    var empty=document.getElementById('cwChatEmpty');if(empty)empty.style.display='none';
    var d=document.createElement('div');
    d.className='cw-cmsg '+(isMine?'mine':'other');
    var now=new Date(msg.ts||Date.now());
    var t=now.getHours()+':'+String(now.getMinutes()).padStart(2,'0');
    var role=msg.role||_myRole;
    var url=_avatarUrl(role);
    var avHtml=url
      ?'<img class="cw-cavatar" src="'+_escHtml(url)+'" alt="" />'
      :'<div class="cw-cavatar" style="background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--muted);">'+_escHtml(_name(role).charAt(0))+'</div>';
    var bubbleClass='cw-cbubble';
    var content='';
    if(msg.type==='react'){bubbleClass+=' emoji-only';content=msg.emoji||'';}
    else{content=_escHtml(msg.text||'');if(_isEmojiOnly(msg.text||''))bubbleClass+=' emoji-only';}
    d.innerHTML=avHtml+
      '<div class="cw-cbody">'+
        (isMine?'':'<div class="cw-cname">'+_escHtml(_name(role))+'</div>')+
        '<div class="'+bubbleClass+'">'+content+'</div>'+
        '<div class="cw-ctime">'+t+'</div>'+
      '</div>';
    chat.appendChild(d);chat.scrollTop=chat.scrollHeight;
    if(isMine)_lastChatTs=Math.max(_lastChatTs,msg.ts||0);
  }

  // ── Contrôles ──────────────────────────────────────────────────────
  window._cwPlay=function(){
    if(!_player||!_isHost)return;
    var P=window.YT?window.YT.PlayerState:{};
    if(_player.getPlayerState()===(P.PLAYING||1))_player.pauseVideo();else _player.playVideo();
  };
  window._cwBack10=function(){
    if(!_player||!_isHost)return;
    var t=Math.max(0,_player.getCurrentTime()-10);
    _player.seekTo(t,true);_broadcastNow(true);
  };
  window._cwFwd10=function(){
    if(!_player||!_isHost)return;
    var t=_player.getCurrentTime()+10;
    _player.seekTo(t,true);_broadcastNow(true);
  };

  // ── Plein écran ────────────────────────────────────────────────────
  // Sur mobile (iOS/Android) requestFullscreen ne fonctionne pas sur iframe.
  // On overlay l'iframe en position fixed pour simuler le plein écran.
  window._cwFullscreen=function(){
    var wrap=document.querySelector('.cw-vwrap');if(!wrap)return;
    var iframe=wrap.querySelector('iframe');

    // Tentative native d'abord (Android Chrome, desktop)
    var target=iframe||wrap;
    if(document.fullscreenElement||document.webkitFullscreenElement){
      if(document.exitFullscreen)document.exitFullscreen();
      else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
      return;
    }
    if(target.requestFullscreen){target.requestFullscreen();return;}
    if(target.webkitRequestFullscreen){target.webkitRequestFullscreen();return;}

    // Fallback iOS : faux plein écran via CSS fixé
    var ov=document.getElementById('cwFsOverlay');
    if(ov){
      ov.parentNode.removeChild(ov);
      document.body.classList.remove('cw-fs-active');
      return;
    }
    var fsOv=document.createElement('div');
    fsOv.id='cwFsOverlay';
    fsOv.style.cssText='position:fixed;inset:0;z-index:9999;background:#000;display:flex;align-items:center;justify-content:center;';
    // Bouton fermer
    var closeBtn=document.createElement('div');
    closeBtn.style.cssText='position:absolute;top:14px;right:14px;z-index:10000;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;cursor:pointer;';
    closeBtn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.onclick=function(){window._cwFullscreen();};
    if(iframe){
      // Cloner l'iframe dans l'overlay
      var ifrClone=document.createElement('iframe');
      ifrClone.src=iframe.src;
      ifrClone.style.cssText='width:100vw;height:56.25vw;max-height:100vh;max-width:177.78vh;border:none;';
      ifrClone.allow=iframe.allow||'autoplay';
      ifrClone.setAttribute('allowfullscreen','');
      fsOv.appendChild(ifrClone);
    }
    fsOv.appendChild(closeBtn);
    document.body.appendChild(fsOv);
    document.body.classList.add('cw-fs-active');
  };

  // ── Thème ──────────────────────────────────────────────────────────
  window._cwToggleTheme=function(){
    document.body.classList.toggle('light');
    // Mettre à jour l'icône selon le thème
    var btn=document.getElementById('cwThemeBtn');
    if(!btn)return;
    var isLight=document.body.classList.contains('light');
    btn.title=isLight?'Mode sombre':'Mode clair';
  };

  // ── UI helpers ─────────────────────────────────────────────────────
  function _updatePlayIc(playing){
    var ic=document.getElementById('cwPlayIc');if(!ic)return;
    ic.innerHTML=playing
      ?'<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
      :'<polygon points="5 3 19 12 5 21 5 3"/>';
  }
  function _startTimeIv(){
    if(_timeIv)clearInterval(_timeIv);
    _timeIv=setInterval(function(){
      if(!_player||typeof _player.getCurrentTime!=='function')return;
      var el=document.getElementById('cwTime');
      if(el)el.textContent=_fmt(_player.getCurrentTime())+' / '+_fmt(_player.getDuration());
    },500);
  }
  function _showSync(show){var el=document.getElementById('cwSyncOv');if(el)el.classList.toggle('on',show);}

  // ── Stop / fermer ──────────────────────────────────────────────────
  function _stopPoll(){if(_pollIv){clearInterval(_pollIv);_pollIv=null;}}
  function _stopAll(){
    _stopPoll();
    if(_timeIv){clearInterval(_timeIv);_timeIv=null;}
    if(_presIv){clearInterval(_presIv);_presIv=null;}
    if(_broadcastIv){clearInterval(_broadcastIv);_broadcastIv=null;}
    if(_player){try{_player.destroy();}catch(e){}_player=null;}
    _isHost=false;_isSyncing=false;_lastSeekAt=0;_lastAppliedTs=0;_lastChatTs=0;_lastReactTs=0;_sessionId=null;
    var ui=document.getElementById('cwUrlIn');if(ui)ui.value='';
    var pr=document.getElementById('cwPreview');if(pr)pr.classList.remove('on');
    var gb=document.getElementById('cwGoBtn');if(gb)gb.disabled=true;
    var ch=document.getElementById('cwChat');if(ch)ch.innerHTML='<div class="cw-chat-empty" id="cwChatEmpty">Aucun message pour l\u2019instant \uD83C\uDF7F</div>';
    var ci=document.getElementById('cwChatInput');if(ci){ci.value='';ci.style.height='auto';}
    var sb=document.getElementById('cwSendBtn');if(sb)sb.disabled=true;
  }

  window.closeCowatchModal=function(){
    if(_isHost&&_sessionId){
      fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId),{
        method:'PATCH',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
        body:JSON.stringify({active:false})
      }).catch(function(){});
    }
    _stopAll();
    var ov=document.getElementById('cwOv');if(ov)ov.classList.remove('on');
    document.body.classList.remove('subview-active');
  };

})();
