// ════════════════════════════════════════════════════════════════════
// APP-COWATCH.JS v4.0-beta
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var TABLE    = 'v2_cowatch_sessions';
  var TABLE_PL = 'v2_cowatch_playlist'; // playlist persistante par couple
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
  var _playlist=[]; // [{ytId}] — historique complet session en cours, jamais supprimé
  var _plIndex=0;   // index de la vidéo en cours dans _playlist
  var _currentYtId=null;
  var _savedPlaylist=[];
  var _launchedFromLink=false;
  // Edge Function proxy — évite les erreurs CORS
  var SB2_EDGE_PIPED = SB2_URL + '/functions/v1/piped-search';
  var _pipedIdx=0;
  var _searchDeb=null;

  // ── CSS ────────────────────────────────────────────────────────────
  var st=document.createElement('style');
  st.textContent=[
    '#cwOv{display:none;position:fixed;inset:0;z-index:2600;background:var(--bg);flex-direction:column;}',
    '.cw-tabs{display:flex;gap:0;background:var(--s2);border-radius:12px;padding:3px;margin-bottom:6px;}',
    '.cw-tab{flex:1;padding:8px;text-align:center;font-size:12px;font-weight:600;color:var(--muted);border-radius:9px;cursor:pointer;transition:background .15s,color .15s;-webkit-tap-highlight-color:transparent;}',
    '.cw-tab.active{background:var(--s1);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.12);}',
    '.cw-search-wrap{position:relative;width:100%;}',
    '.cw-search-input{width:100%;padding:11px 38px 11px 14px;background:var(--s1);border:1.5px solid var(--border);border-radius:14px;font-size:14px;color:var(--text);font-family:"Bricolage Grotesque",sans-serif;outline:none;transition:border-color .2s;-webkit-appearance:none;box-sizing:border-box;}',
    '.cw-search-input:focus{border-color:var(--accent);}',
    '.cw-search-clear{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:26px;height:26px;border-radius:50%;background:var(--muted);border:none;display:none;align-items:center;justify-content:center;cursor:pointer;color:#fff;padding:0;font-size:0;line-height:1;transition:opacity .15s;}',
    '.cw-search-clear.on{display:flex;}.cw-search-clear:active{opacity:.7;}',
    '.cw-search-results{background:var(--s2);border:1.5px solid var(--accent);border-radius:12px;overflow:hidden;margin-top:6px;display:none;max-height:300px;overflow-y:auto;-webkit-overflow-scrolling:touch;box-shadow:0 4px 18px rgba(232,90,126,.13);}',
    '.cw-search-results.on{display:block;}',
    '.cw-search-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);-webkit-tap-highlight-color:transparent;transition:background .15s;}',
    '.cw-search-item:last-child{border-bottom:none;}',
    '.cw-search-item:active{background:var(--s2);}',
    '.cw-search-thumb{width:72px;height:44px;border-radius:6px;object-fit:cover;flex-shrink:0;background:var(--s2);}',
    '.cw-search-info{flex:1;min-width:0;}',
    '.cw-search-title{font-size:12px;font-weight:600;color:var(--text);line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
    '.cw-search-meta{font-size:10px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.cw-search-add{width:28px;height:28px;border-radius:50%;background:var(--accent);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color:transparent;}',
    '.cw-search-add svg{pointer-events:none;}',
    '.cw-search-loading{text-align:center;padding:16px;font-size:12px;color:var(--muted);}',
    '.cw-search-err{text-align:center;padding:14px 16px;font-size:12px;color:var(--muted);line-height:1.5;}',
    '.cw-lpl-eye{width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:50%;transition:opacity .15s;-webkit-tap-highlight-color:transparent;flex-shrink:0;opacity:.45;}',
    '.cw-lpl-eye.open{opacity:1;}',
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
    '.cw-btn{background:var(--accent);color:#fff;border:none;border-radius:0 0 14px 14px;padding:13px 20px;font-size:14px;font-weight:700;cursor:pointer;font-family:"Bricolage Grotesque",sans-serif;transition:opacity .15s;width:100%;display:block;}',
    '.cw-btn:active{opacity:.8;}.cw-btn:disabled{opacity:.35;cursor:not-allowed;}',
    '.cw-btn-ghost{background:var(--s2);color:var(--muted);border:1.5px solid var(--border);border-radius:50px;padding:12px 32px;font-size:14px;font-weight:600;cursor:pointer;font-family:"Bricolage Grotesque",sans-serif;}',
    '#cwScLobby{padding:24px 20px;gap:18px;}',
    '.cw-label{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);}',
    '.cw-urlinput{width:100%;padding:13px 16px;background:var(--s1);border:1.5px solid var(--border);border-radius:14px;font-size:14px;color:var(--text);font-family:"Bricolage Grotesque",sans-serif;outline:none;transition:border-color .2s;-webkit-appearance:none;box-sizing:border-box;}',
    '.cw-urlinput:focus{border-color:var(--accent);}',
    '.cw-preview{background:var(--s1);border:1px solid var(--border);border-radius:12px;overflow:hidden;display:none;}',
    '.cw-preview.on{display:block;}.cw-preview img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;}',
    '.cw-preview-info{padding:10px 14px;}.cw-preview-id{font-size:12px;color:var(--muted);}',
    // Lobby — section playlist sauvegardée
    '.cw-lpl-box{background:var(--s1);border:1px solid var(--border);border-radius:14px 14px 0 0;overflow:hidden;}',
    '.cw-link-box{background:var(--s1);border:1px solid var(--border);border-radius:14px 14px 0 0;overflow:hidden;padding:10px 10px 0;}',
    '.cw-lpl-hdr{padding:11px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border);}',
    '.cw-lpl-title{flex:1;font-size:13px;font-weight:700;color:var(--text);}',
    '.cw-lpl-count{font-size:10px;font-weight:700;background:var(--accent);color:#fff;border-radius:20px;padding:1px 7px;}',
    '.cw-lpl-list{max-height:190px;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;}',
    '.cw-lpl-list.open{display:block;}',
    '.cw-lpl-item{display:flex;align-items:center;gap:8px;padding:7px 14px;border-bottom:1px solid var(--border);}',
    '.cw-lpl-item:last-child{border-bottom:none;}',
    '.cw-lpl-thumb{width:44px;height:28px;border-radius:4px;object-fit:cover;flex-shrink:0;background:var(--s2);}',
    '.cw-lpl-id{flex:1;font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.cw-lpl-rm{width:26px;height:26px;border-radius:50%;border:none;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--muted);-webkit-tap-highlight-color:transparent;flex-shrink:0;}',
    '.cw-lpl-rm:active{opacity:.5;}.cw-lpl-rm svg{pointer-events:none;}',
    '.cw-lpl-add{display:flex;gap:6px;padding:8px 10px;align-items:center;border-top:1px solid var(--border);}',
    '.cw-lpl-input{flex:1;padding:7px 10px;background:var(--s2);border:1.5px solid var(--border);border-radius:10px;font-size:12px;color:var(--text);font-family:"Bricolage Grotesque",sans-serif;outline:none;-webkit-appearance:none;transition:border-color .2s;box-sizing:border-box;}',
    '.cw-lpl-input:focus{border-color:var(--accent);}',
    '.cw-lpl-add-btn{width:30px;height:30px;border-radius:50%;background:var(--accent);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;}',
    '.cw-lpl-add-btn:disabled{opacity:.35;cursor:not-allowed;}.cw-lpl-add-btn svg{pointer-events:none;}',
    '.cw-lpl-empty{font-size:12px;color:var(--muted);text-align:center;padding:14px;}',
    // Bouton "lancer playlist"
    '.cw-btn-pl{background:var(--accent);color:#fff;border:none;border-radius:0 0 14px 14px;padding:13px 20px;font-size:14px;font-weight:700;cursor:pointer;font-family:"Bricolage Grotesque",sans-serif;transition:opacity .15s;width:100%;display:block;}',
    '.cw-btn-pl:active{opacity:.8;}.cw-btn-pl:disabled{opacity:.35;cursor:not-allowed;}',
    // Bouton import playlist (dans le panel playlist en session)
    '.cw-pl-import-btn{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 14px;margin:0 10px 8px;border-radius:10px;background:rgba(201,120,96,.1);border:1.5px dashed rgba(201,120,96,.4);cursor:pointer;font-size:12px;font-weight:600;color:var(--accent);-webkit-tap-highlight-color:transparent;}',
    '.cw-pl-import-btn:active{opacity:.7;}',
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
    '#cwScPlayer{flex:1;flex-direction:column;overflow:hidden;min-height:0;}',
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
    '.cw-vwrap.cw-ios-fs{position:fixed!important;inset:0!important;z-index:9000!important;width:100vw!important;height:100vh!important;display:flex!important;align-items:center!important;justify-content:center!important;}',
    '.cw-vwrap.cw-ios-fs #cwYTDiv,.cw-vwrap.cw-ios-fs iframe{width:100vw!important;height:56.25vw!important;max-height:100vh!important;max-width:177.78vh!important;aspect-ratio:unset!important;}',
    '.cw-vwrap.cw-ios-fs .cw-syncov{height:56.25vw;max-height:100vh;}',
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
    // Safe zone iOS
    '.cw-safe-bottom{flex-shrink:0;height:calc(env(safe-area-inset-bottom,16px) + 24px);}',
    // Playlist — panel qui remplace réactions+chat
    '.cw-pl-panel{display:none;flex-direction:column;flex:1;min-height:0;border-top:1px solid var(--border);background:var(--bg);}',
    '.cw-pl-panel.on{display:flex;}',
    '.cw-pl-hdr{flex-shrink:0;padding:9px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border);background:var(--s1);}',
    '.cw-pl-hdr-title{flex:1;font-size:13px;font-weight:700;color:var(--text);}',
    '.cw-pl-count{font-size:10px;font-weight:700;background:var(--accent);color:#fff;border-radius:20px;padding:1px 7px;}',
    '.cw-pl-close-btn{width:28px;height:28px;border-radius:50%;background:var(--s2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;}',
    '.cw-pl-close-btn svg{pointer-events:none;}',
    '.cw-pl-list{flex:1;overflow-y:auto;padding:6px 10px;-webkit-overflow-scrolling:touch;}',
    '.cw-pl-item{display:flex;align-items:center;gap:8px;padding:6px 4px;border-radius:8px;transition:background .15s;}',
    '.cw-pl-item.current{background:rgba(201,120,96,.1);}',
    '.cw-pl-item.past{opacity:.45;}',
    '.cw-pl-thumb{width:52px;height:32px;border-radius:5px;object-fit:cover;flex-shrink:0;background:var(--s2);}',
    '.cw-pl-info{flex:1;min-width:0;}',
    '.cw-pl-status{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:1px;}',
    '.cw-pl-status.now{color:var(--accent);}.cw-pl-status.next{color:var(--green);}.cw-pl-status.done{color:var(--muted);}',
    '.cw-pl-id{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.cw-pl-rm{width:26px;height:26px;border-radius:50%;border:none;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--muted);flex-shrink:0;-webkit-tap-highlight-color:transparent;}',
    '.cw-pl-rm:active{opacity:.5;}.cw-pl-rm svg{pointer-events:none;}',
    '.cw-pl-add{flex-shrink:0;display:flex;gap:6px;padding:8px 10px;border-top:1px solid var(--border);align-items:center;}',
    '.cw-pl-input{flex:1;padding:8px 11px;background:var(--s2);border:1.5px solid var(--border);border-radius:10px;font-size:12px;color:var(--text);font-family:"Bricolage Grotesque",sans-serif;outline:none;-webkit-appearance:none;transition:border-color .2s;box-sizing:border-box;}',
    '.cw-pl-input:focus{border-color:var(--accent);}',
    '.cw-pl-add-btn{width:30px;height:30px;border-radius:50%;background:var(--accent);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color:transparent;}',
    '.cw-pl-add-btn:disabled{opacity:.35;cursor:not-allowed;}.cw-pl-add-btn svg{pointer-events:none;}',
    '.cw-pl-clickable:hover{background:var(--s2);}.cw-pl-clickable:active{opacity:.7;}',
    // Bouton playlist actif dans la ctrl bar
    '.cw-cbtn.pl-active{background:rgba(201,120,96,.15);border-color:rgba(201,120,96,.4);}',
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
      '<div id="cwHdrThemeBtn" class="cw-icon-btn" onclick="window._cwToggleTheme()" title="Changer le th\u00e8me" style="width:30px;height:30px;flex-shrink:0;">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' +
      '</div>' +
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
      // Mode A : lancer par lien ou recherche
      '<div id="cwLobbyNewLink">' +
        '<div class="cw-link-box">' +
        '<div class="cw-tabs">' +
          '<div class="cw-tab active" id="cwTabLink" onclick="window._cwSwitchTab(0)">\uD83D\uDD17 Coller un lien</div>' +
          '<div class="cw-tab" id="cwTabSearch" onclick="window._cwSwitchTab(1)">\uD83D\uDD0D Rechercher</div>' +
        '</div>' +
        '<div id="cwPanelLink">' +
          '<input id="cwUrlIn" class="cw-urlinput" type="url" placeholder="https://youtube.com/watch?v=..." autocomplete="off" />' +
          '<div id="cwPreview" class="cw-preview">' +
            '<img id="cwThumb" src="" alt="" />' +
            '<div class="cw-preview-info"><div id="cwPreviewId" class="cw-preview-id"></div></div>' +
          '</div>' +
        '</div>' +
        '<div id="cwPanelSearch" style="display:none;">' +
          '<div class="cw-search-wrap">' +
            '<input id="cwSearchIn" class="cw-search-input" type="search" placeholder="Titre, artiste\u2026" autocomplete="off" autocorrect="off" spellcheck="false" />' +
            '<button class="cw-search-clear" id="cwSearchClear" onclick="window._cwSearchClear()"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
          '</div>' +
          '<div class="cw-search-results" id="cwSearchResults"></div>' +
        '</div>' +
        '</div>' +
        '<button class="cw-btn" id="cwGoBtn" onclick="window._cwLaunch()" disabled>Lancer ce lien \uD83C\uDFAC</button>' +
      '</div>' +
      // Séparateur
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<div style="flex:1;height:1px;background:var(--border);"></div>' +
        '<span style="font-size:11px;color:var(--muted);font-weight:600;">ou</span>' +
        '<div style="flex:1;height:1px;background:var(--border);"></div>' +
      '</div>' +
      // Mode B : lancer la playlist sauvegardée
      '<div id="cwLobbyPl">' +
        '<div class="cw-lpl-box">' +
          '<div class="cw-lpl-hdr">' +
            '<span style="font-size:15px;">\uD83C\uDFAC</span>' +
            '<span class="cw-lpl-title">Notre playlist</span>' +
            '<span class="cw-lpl-count" id="cwLplCount">0</span>' +
            '<div class="cw-lpl-eye" id="cwLplEye" onclick="window._cwLplToggle()">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e85a7e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
            '</div>' +
          '</div>' +
          '<div class="cw-lpl-list" id="cwLplList"><div class="cw-lpl-empty">Aucune vid\u00e9o enregistr\u00e9e</div></div>' +
          '<div class="cw-search-results" id="cwLplSearchResults" style="margin:0 4px 4px;"></div>' +
          '<div class="cw-lpl-add" id="cwLplAddRow" style="display:none;">' +
            '<input id="cwLplInput" class="cw-lpl-input" type="text" placeholder="Lien ou titre YouTube\u2026" autocomplete="off" autocorrect="off" spellcheck="false" />' +
            '<button class="cw-lpl-add-btn" id="cwLplAddBtn" onclick="window._cwLplAddOrClear()" disabled>' +
              '<svg id="cwLplBtnIcon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<button class="cw-btn-pl" id="cwGoPlBtn" onclick="window._cwLaunchPlaylist()" disabled>Lancer la playlist \u25b6</button>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--muted);text-align:center;line-height:1.6;">Tu seras l\u2019h\u00f4te et tu contr\u00f4les la lecture.</div>' +
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
          '<div class="cw-icon-btn" id="cwFsBtn" onclick="window._cwFullscreen()" title="Plein \u00e9cran">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>' +
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
        '<div class="cw-cbtn dis" id="cwPrevBtn" onclick="window._cwPrev()" title="Vid\u00e9o pr\u00e9c\u00e9dente">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="5" x2="5" y2="19"/><polygon points="19 4 9 12 19 20 19 4"/></svg>' +
        '</div>' +
        '<div class="cw-time" id="cwTime">0:00 / 0:00</div>' +
        '<div class="cw-cbtn dis" id="cwSkipBtn" onclick="window._cwSkip()" title="Vid\u00e9o suivante">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>' +
        '</div>' +
        '<div class="cw-cbtn" id="cwFwd10" onclick="window._cwFwd10()">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-5"/></svg>' +
        '</div>' +
        '<div class="cw-cbtn" id="cwPlBtn" onclick="window._cwPlToggle()" title="Playlist">' +
          '\uD83C\uDFAC' +
        '</div>' +
      '</div>' +
      // Réactions (masquées quand playlist ouverte)
      '<div class="cw-reacts" id="cwReacts">' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'\u2764\uFE0F\')">\u2764\uFE0F</button>' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'\uD83D\uDE02\')">\uD83D\uDE02</button>' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'\uD83D\uDE2E\')">\uD83D\uDE2E</button>' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'\uD83D\uDD25\')">\uD83D\uDD25</button>' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'\uD83D\uDC4F\')">\uD83D\uDC4F</button>' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'\uD83D\uDE2D\')">\uD83D\uDE2D</button>' +
      '</div>' +
      // Chat (masqué quand playlist ouverte)
      '<div class="cw-chat-wrap" id="cwChatWrap">' +
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
      // Panel playlist (remplace réactions+chat quand ouvert)
      '<div class="cw-pl-panel" id="cwPlPanel">' +
        '<div class="cw-pl-hdr">' +
          '<span style="font-size:16px;">\uD83C\uDFAC</span>' +
          '<span class="cw-pl-hdr-title">Playlist</span>' +
          '<span class="cw-pl-count" id="cwPlCount">0</span>' +
          '<div class="cw-pl-close-btn" onclick="window._cwPlToggle()">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</div>' +
        '</div>' +
        '<div class="cw-pl-list" id="cwPlList"></div>' +
        '<div class="cw-pl-import-btn" id="cwPlImportBtn" onclick="window._cwImportSavedPl()">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
          'Importer notre playlist \u00e0 la suite' +
        '</div>' +
        '<div class="cw-pl-add" id="cwPlAddRow">' +
          '<input id="cwPlInput" class="cw-pl-input" type="text" placeholder="Lien ou titre YouTube\u2026" autocomplete="off" autocorrect="off" spellcheck="false" />' +
          '<button class="cw-pl-add-btn" id="cwPlAddBtn" onclick="window._cwPlAddOrClear()" disabled>' +
            '<svg id="cwPlBtnIcon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +   
    '</div>' +     
    '<div class="cw-safe-bottom"></div>' +
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

  // ── Lobby playlist sauvegardée ─────────────────────────────────────

  // ── Piped Search ───────────────────────────────────────────────────
  function _pipedSearch(q,onResults,onError){
    fetch(SB2_EDGE_PIPED+'?q='+encodeURIComponent(q),{
      headers:sb2Headers({'x-app-secret':SB2_APP_SECRET})
    })
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(data){
      if(data.error){throw new Error(data.error);}
      var items=(data.items||[]).filter(function(v){return v.url&&v.type==='stream';}).slice(0,10);
      onResults(items);
    })
    .catch(function(){onError();});
  }

  function _fmtDur(s){if(!s||s<0)return '';var m=Math.floor(s/60),sec=s%60;return m+':'+(sec<10?'0':'')+sec;}

  function _renderSearchResults(items,listEl,pickFn){
    if(!items.length){listEl.innerHTML='<div class="cw-search-err">Aucun r\u00e9sultat</div>';listEl.classList.add('on');return;}
    listEl.innerHTML=items.map(function(v){
      var ytId=(v.url||'').replace('/watch?v=','');
      var thumb=v.thumbnail||('https://img.youtube.com/vi/'+ytId+'/mqdefault.jpg');
      var meta=_escHtml(v.uploaderName||'')+(_fmtDur(v.duration)?' \u00b7 '+_fmtDur(v.duration):'');
      return '<div class="cw-search-item">'+
        '<img class="cw-search-thumb" src="'+_escHtml(thumb)+'" alt="" loading="lazy" />'+
        '<div class="cw-search-info">'+
          '<div class="cw-search-title">'+_escHtml(v.title||ytId)+'</div>'+
          '<div class="cw-search-meta">'+meta+'</div>'+
        '</div>'+
        '<button class="cw-search-add" data-ytid="'+_escHtml(ytId)+'" data-fn="'+_escHtml(pickFn)+'">'+
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'+
        '</button>'+
      '</div>';
    }).join('');
    listEl.onclick=function(e){
      var btn=e.target.closest('.cw-search-add');if(!btn)return;
      var ytId=btn.getAttribute('data-ytid');
      var fn=btn.getAttribute('data-fn').replace('window.','');
      if(ytId&&window[fn])window[fn](ytId);
    };
    if(!listEl._scrollBlurBound){
      listEl._scrollBlurBound=true;
      listEl.addEventListener('touchstart',function(){
        var focused=document.activeElement;
        if(focused&&(focused.tagName==='INPUT'||focused.tagName==='TEXTAREA'))focused.blur();
      },{passive:true});
    }
    listEl.classList.add('on');
  }

  window._cwSwitchTab=function(idx){
    var pl=document.getElementById('cwPanelLink'),ps=document.getElementById('cwPanelSearch');
    var tl=document.getElementById('cwTabLink'),ts=document.getElementById('cwTabSearch');
    var goBtn=document.getElementById('cwGoBtn');
    if(idx===0){
      if(pl)pl.style.display='';if(ps)ps.style.display='none';
      if(tl)tl.classList.add('active');if(ts)ts.classList.remove('active');
      var urlIn=document.getElementById('cwUrlIn');
      if(goBtn)goBtn.disabled=!_ytId((urlIn&&urlIn.value)||'');
    } else {
      if(pl)pl.style.display='none';if(ps)ps.style.display='';
      if(tl)tl.classList.remove('active');if(ts)ts.classList.add('active');
      if(goBtn)goBtn.disabled=true;
      setTimeout(function(){var el=document.getElementById('cwSearchIn');if(el)el.focus();},100);
    }
  };

  window._cwSearchClear=function(){
    var inp=document.getElementById('cwSearchIn'),res=document.getElementById('cwSearchResults'),clr=document.getElementById('cwSearchClear');
    if(inp)inp.value='';if(res){res.innerHTML='';res.classList.remove('on');}if(clr)clr.classList.remove('on');
  };

  window._cwSearchPick=function(ytId){
    window._cwSwitchTab(0);
    var urlIn=document.getElementById('cwUrlIn');
    if(urlIn)urlIn.value='https://youtube.com/watch?v='+ytId;
    document.getElementById('cwThumb').src='https://img.youtube.com/vi/'+ytId+'/mqdefault.jpg';
    document.getElementById('cwPreviewId').textContent='youtube.com/watch?v='+ytId;
    document.getElementById('cwPreview').classList.add('on');
    var goBtn=document.getElementById('cwGoBtn');if(goBtn)goBtn.disabled=false;
  };

  var _lplOpen=false;
  window._cwLplToggle=function(){
    _lplOpen=!_lplOpen;
    var list=document.getElementById('cwLplList'),addRow=document.getElementById('cwLplAddRow'),eye=document.getElementById('cwLplEye');
    if(list)list.classList.toggle('open',_lplOpen);
    if(addRow)addRow.style.display=_lplOpen?'flex':'none';
    if(eye)eye.classList.toggle('open',_lplOpen);
    if(_lplOpen){setTimeout(function(){var el=document.getElementById('cwLplInput');if(el)el.focus();},150);}
  };

  window._cwLplPick=function(ytId){
    var inp=document.getElementById('cwLplInput');
    if(inp)inp.value='https://youtube.com/watch?v='+ytId;
    if(window._cwLplHideResults)window._cwLplHideResults();
    window._cwLplAdd();
  };

  window._cwPlPick=function(ytId){
    var inp=document.getElementById('cwPlInput');
    if(inp)inp.value='https://youtube.com/watch?v='+ytId;
    document.querySelectorAll('#cwPlPanel .cw-search-results').forEach(function(p){p.innerHTML='';p.classList.remove('on');});
    window._cwPlAdd();
  };

  // Wiring recherche principale
  (function(){
    var inp=document.getElementById('cwSearchIn'),res=document.getElementById('cwSearchResults'),clr=document.getElementById('cwSearchClear');
    if(!inp||!res)return;
    inp.addEventListener('input',function(){
      var q=this.value.trim();
      if(clr)clr.classList.toggle('on',q.length>0);
      clearTimeout(_searchDeb);
      if(!q){res.innerHTML='';res.classList.remove('on');return;}
      res.innerHTML='<div class="cw-search-loading">Recherche\u2026</div>';res.classList.add('on');
      _searchDeb=setTimeout(function(){
        _pipedSearch(q,function(items){_renderSearchResults(items,res,'window._cwSearchPick');},
        function(){res.innerHTML='<div class="cw-search-err">Impossible de contacter YouTube.</div>';res.classList.add('on');});
      },500);
    });
    inp.addEventListener('keydown',function(e){if(e.key==='Escape')window._cwSearchClear();});
  })();

  // Wiring playlist lobby lien OU recherche
  (function(){
    var inp=document.getElementById('cwLplInput'),btn=document.getElementById('cwLplAddBtn'),res=document.getElementById('cwLplSearchResults');
    if(!inp||!btn)return;
    var _lplDeb=null;
    var _plusSvg='<svg width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"white\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/><line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/></svg>';
    var _crossSvg='<svg width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"white\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/></svg>';
    function _updateLplBtn(val){
      var icon=document.getElementById('cwLplBtnIcon');
      if(!icon)return;
      if(val){icon.outerHTML=_crossSvg.replace('<svg ','<svg id="cwLplBtnIcon" ');btn.disabled=false;btn.style.background='var(--muted)';}
      else{icon.outerHTML=_plusSvg.replace('<svg ','<svg id="cwLplBtnIcon" ');btn.disabled=true;btn.style.background='';}
    }
    function _lplShowResults(){
      var lplList=document.getElementById('cwLplList');
      if(lplList)lplList.style.display='none';
    }
    function _lplHideResults(){
      var lplList=document.getElementById('cwLplList');
      if(lplList)lplList.style.display='';
      if(res){res.innerHTML='';res.classList.remove('on');}
      _updateLplBtn('');
      inp.value='';
    }
    inp.addEventListener('input',function(){
      var val=this.value.trim();
      _updateLplBtn(val);
      if(_ytId(val)){if(res){res.innerHTML='';res.classList.remove('on');}var lplList=document.getElementById('cwLplList');if(lplList)lplList.style.display='none';return;}
      clearTimeout(_lplDeb);
      if(!val){_lplHideResults();return;}
      _lplShowResults();
      if(res){res.innerHTML='<div class="cw-search-loading">Recherche\u2026</div>';res.classList.add('on');}
      _lplDeb=setTimeout(function(){
        _pipedSearch(val,function(items){if(res)_renderSearchResults(items,res,'window._cwLplPick');},
        function(){if(res){res.innerHTML='<div class="cw-search-err">Erreur r\u00e9seau</div>';res.classList.add('on');}});
      },500);
    });
    inp.addEventListener('keydown',function(e){if(e.key==='Enter')window._cwLplAdd();if(e.key==='Escape')_lplHideResults();});
    window._cwLplAddOrClear=function(){
      var val=inp.value.trim();
      var hasResults=res&&res.classList.contains('on');
      // Si un lien YouTube valide est dans le champ → ajouter directement
      if(_ytId(val)){window._cwLplAdd();return;}
      // Sinon (résultats de recherche affichés ou texte non-URL) → effacer
      if(hasResults||val){_lplHideResults();}
    };
    window._cwLplHideResults=_lplHideResults;
  })();

  // Fermer résultats recherche au clic en dehors
  document.addEventListener('click',function(e){
    document.querySelectorAll('.cw-search-results.on').forEach(function(r){
      if(!r.contains(e.target)&&!e.target.closest('.cw-search-wrap')&&e.target.id!=='cwPlInput'&&e.target.id!=='cwLplInput'&&e.target.id!=='cwSearchIn'){
        if(r.id==='cwLplSearchResults'&&window._cwLplHideResults){window._cwLplHideResults();}
        else{r.innerHTML='';r.classList.remove('on');}
      }
    });
  });

  function _loadSavedPlaylist(cb){
    if(!_coupleId)return;
    fetch(SB2_URL+'/rest/v1/'+TABLE_PL+'?couple_id=eq.'+encodeURIComponent(_coupleId)+'&order=position.asc',{headers:sb2Headers()})
    .then(function(r){return r.json();})
    .then(function(rows){
      _savedPlaylist=(rows||[]).map(function(r){return{ytId:r.yt_id,id:r.id};});
      _renderLobbyPlaylist();
      if(cb)cb();
    }).catch(function(){if(cb)cb();});
  }

  function _renderLobbyPlaylist(){
    var list=document.getElementById('cwLplList');
    var count=document.getElementById('cwLplCount');
    var goBtn=document.getElementById('cwGoPlBtn');
    if(!list)return;
    if(count)count.textContent=_savedPlaylist.length;
    if(goBtn)goBtn.disabled=_savedPlaylist.length===0;
    if(!_savedPlaylist.length){
      list.innerHTML='<div class="cw-lpl-empty">Aucune vid\u00e9o enregistr\u00e9e</div>';
      return;
    }
    list.innerHTML=_savedPlaylist.map(function(item,i){
      var thumb='https://img.youtube.com/vi/'+item.ytId+'/default.jpg';
      return '<div class="cw-lpl-item">'+
        '<img class="cw-lpl-thumb" src="'+thumb+'" alt="" />'+
        '<span class="cw-lpl-id">youtu.be/'+item.ytId+'</span>'+
        '<button class="cw-lpl-rm" onclick="window._cwLplRemove('+i+')">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>'+
      '</div>';
    }).join('');
  }

  window._cwLplAdd=function(){
    var inp=document.getElementById('cwLplInput');if(!inp)return;
    var id=_ytId(inp.value.trim());if(!id)return;
    var coupleId=_getCoupleId()||_coupleId;
    if(!coupleId){if(typeof showToast==='function')showToast('Session non chargée','error');return;}
    _coupleId=coupleId;
    inp.value='';
    var btn=document.getElementById('cwLplAddBtn');if(btn)btn.disabled=true;
    var res=document.getElementById('cwLplSearchResults');if(res){res.innerHTML='';res.classList.remove('on');}
    var pos=_savedPlaylist.length;
    fetch(SB2_URL+'/rest/v1/'+TABLE_PL,{
      method:'POST',
      headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=representation'}),
      body:JSON.stringify({couple_id:coupleId,yt_id:id,position:pos})
    }).then(function(r){return r.json();})
    .then(function(rows){
      if(rows&&rows[0])_savedPlaylist.push({ytId:id,id:rows[0].id});
      _renderLobbyPlaylist();
    }).catch(function(){});
  };

  window._cwLplRemove=function(idx){
    var item=_savedPlaylist[idx];if(!item||!item.id)return;
    _cwConfirm('Supprimer cette vidéo de la playlist ?',function(){
      fetch(SB2_URL+'/rest/v1/'+TABLE_PL+'?id=eq.'+encodeURIComponent(item.id),{
        method:'DELETE',headers:sb2Headers({'Prefer':'return=minimal'})
      }).catch(function(){});
      _savedPlaylist.splice(idx,1);
      _renderLobbyPlaylist();
    });
  };

  // Lancer depuis la playlist sauvegardée (premier item)
  window._cwLaunchPlaylist=function(){
    if(!_savedPlaylist.length||!_coupleId||!_myRole)return;
    var firstId=_savedPlaylist[0].ytId;
    var allItems=_savedPlaylist.map(function(i){return{ytId:i.ytId};});
    fetch(SB2_URL+'/rest/v1/'+TABLE+'?couple_id=eq.'+encodeURIComponent(_coupleId),{
      method:'PATCH',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
      body:JSON.stringify({active:false})
    }).then(function(){
      return fetch(SB2_URL+'/rest/v1/'+TABLE,{
        method:'POST',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=representation'}),
        body:JSON.stringify({couple_id:_coupleId,yt_id:firstId,host_role:_myRole,active:true,
          state:{playing:false,currentTime:0,ts:0,reactions:[],joined:false,currentYtId:firstId},
          chat:[],presence:{},playlist:allItems,playlist_index:0})
      });
    }).then(function(r){return r.json();})
    .then(function(rows){
      if(!rows||!rows.length)return;
      _sessionId=rows[0].id;_isHost=true;_launchedFromLink=false;
      _playlist=allItems;_plIndex=0;
      document.getElementById('cwWaitTxt').textContent='En attente que '+_name(_otherRole(_myRole))+' rejoigne\u2026';
      _sc('cwScWait');_startWaitPoll();
    }).catch(function(){if(typeof showToast==='function')showToast('Erreur r\u00e9seau','error');});
  };

  // Import playlist sauvegardée dans une session en cours
  window._cwImportSavedPl=function(){
    if(!_isHost||!_savedPlaylist.length)return;
    var coupleId=_getCoupleId()||_coupleId;
    if(_currentYtId&&coupleId){
      var already=_savedPlaylist.some(function(s){return s.ytId===_currentYtId;});
      if(!already){
        fetch(SB2_URL+'/rest/v1/'+TABLE_PL,{
          method:'POST',
          headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=representation'}),
          body:JSON.stringify({couple_id:coupleId,yt_id:_currentYtId,position:_savedPlaylist.length})
        }).then(function(r){return r.json();})
        .then(function(rows){if(rows&&rows[0])_savedPlaylist.unshift({ytId:_currentYtId,id:rows[0].id});})
        .catch(function(){});
      }
    }
    var newItems=_savedPlaylist.map(function(i){return{ytId:i.ytId};});
    var existing=_playlist.map(function(i){return i.ytId;});
    var toAdd=newItems.filter(function(i){return existing.indexOf(i.ytId)===-1;});
    if(!toAdd.length){if(typeof showToast==='function')showToast('D\u00e9j\u00e0 tout dans la playlist','info');return;}
    _playlist=_playlist.concat(toAdd);
    _savePlaylist();
    _renderPlaylist();
    _updateSkipBtn();
    var importBtn=document.getElementById('cwPlImportBtn');if(importBtn)importBtn.style.display='none';
    _launchedFromLink=false;
    if(typeof showToast==='function')showToast(toAdd.length+' vid\u00e9o(s) ajout\u00e9e(s)','success');
  };
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
    if(!_coupleId){var u=typeof v2GetUser==='function'?v2GetUser():null;if(u)_coupleId=u.couple_id||null;}
    if(!_betaOk()){_sc('cwScBeta');return;}
    _afterBeta();
  };

  function _afterBeta(){
    if(!_coupleId){_sc('cwScLobby');return;}
    _loadSavedPlaylist(); // charger la playlist du couple
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
          state:{playing:false,currentTime:0,ts:0,reactions:[],joined:false,currentYtId:ytId},
          chat:[],presence:{},playlist:[{ytId:ytId}],playlist_index:0})
      });
    }).then(function(r){return r.json();})
    .then(function(rows){
      if(!rows||!rows.length){if(typeof showToast==='function')showToast('Erreur','error');return;}
      _sessionId=rows[0].id;_isHost=true;_launchedFromLink=true;
      document.getElementById('cwWaitTxt').textContent='En attente que '+_name(_otherRole(_myRole))+' rejoigne\u2026';
      _sc('cwScWait');_startWaitPoll();
    }).catch(function(){if(typeof showToast==='function')showToast('Erreur r\u00e9seau','error');});
  };

  function _startWaitPoll(){
    _stopPoll();
    _pollIv=setInterval(function(){
      if(!_sessionId)return;
      fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId)+'&select=state,yt_id,playlist,playlist_index',{headers:sb2Headers()})
      .then(function(r){return r.json();})
      .then(function(rows){
        if(!rows||!rows.length)return;
        if((rows[0].state||{}).joined){
          _stopPoll();
          var spl=rows[0].playlist||[];var sidx=typeof rows[0].playlist_index==='number'?rows[0].playlist_index:0;
          if(spl.length>0){_playlist=spl;_plIndex=sidx;}
          _startPlayer(rows[0].yt_id);
        }
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
    _currentYtId=ytId;
    // Hôte : init playlist avec la première vidéo
    if(_isHost&&_playlist.length===0){_playlist=[{ytId:ytId}];_plIndex=0;}
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
    // Playlist : input add + import visibles seulement hôte
    var plAddRow=document.getElementById('cwPlAddRow');
    if(plAddRow)plAddRow.style.display=(_isHost&&!_launchedFromLink)?'':'none';
    var plImport=document.getElementById('cwPlImportBtn');
    if(plImport)plImport.style.display=(_isHost&&_launchedFromLink)?'':'none';
    _renderPlaylist();
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
    // Fin de vidéo → passer à la suivante automatiquement
    if(data===(P.ENDED||0)){
      setTimeout(function(){_cwSkipNext();},1200);
    }
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
    _saveState({playing:playing,currentTime:_player.getCurrentTime(),ts:Date.now(),currentYtId:_currentYtId});
  }

  // ── Poll ────────────────────────────────────────────────────────────
  function _startSyncPoll(){
    _stopPoll();
    _pollIv=setInterval(function(){
      if(!_sessionId)return;
      fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId)+'&select=state,active,chat,presence,playlist,playlist_index',{headers:sb2Headers()})
      .then(function(r){return r.json();})
      .then(function(rows){
        if(!rows||!rows.length)return;
        var row=rows[0];
        if(!row.active){_stopAll();if(typeof showToast==='function')showToast('Session termin\u00e9e','info');_sc('cwScLobby');return;}
        var state=row.state||{};
        if(!_isHost)_applyStateIfNeeded(state);
        // Sync playlist pour tout le monde
        _applyPlaylist(row.playlist||[],state.currentYtId||null,row.playlist_index||0);
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

  // ── Playlist ────────────────────────────────────────────────────────
  // Stockée dans colonne `playlist` (jsonb array [{ytId}]) en base.
  // currentYtId voyage dans state pour que le non-hôte sache ce qui tourne.

  // ── Playlist ────────────────────────────────────────────────────────
  // Structure : [{ytId}] — tableau ordonné, _plIndex = index en cours.
  // On ne supprime jamais les vidéos passées, on avance juste l'index.
  // Seul l'hôte peut ajouter/supprimer les vidéos à venir.
  // L'index courant et la playlist voyagent dans state + colonne playlist.

  var _plOpen=false;
  var _plJustOpened=false;

  window._cwPlToggle=function(){
    _plOpen=!_plOpen;
    if(_plOpen)_plJustOpened=true;
    var panel=document.getElementById('cwPlPanel');
    var reacts=document.getElementById('cwReacts');
    var chatWrap=document.getElementById('cwChatWrap');
    var plBtn=document.getElementById('cwPlBtn');
    if(panel)panel.classList.toggle('on',_plOpen);
    if(reacts)reacts.style.display=_plOpen?'none':'';
    if(chatWrap)chatWrap.style.display=_plOpen?'none':'';
    if(plBtn)plBtn.classList.toggle('pl-active',_plOpen);
    if(_plOpen)_renderPlaylist();
  };

  // Wiring session playlist lien OU recherche
  (function(){
    var inp=document.getElementById('cwPlInput'),btn=document.getElementById('cwPlAddBtn');
    if(!inp||!btn)return;
    var _plDeb=null;
    var res=document.createElement('div');res.className='cw-search-results';res.style.cssText='margin:0 10px 6px;';
    var addRow=document.getElementById('cwPlAddRow');
    if(addRow&&addRow.parentNode)addRow.parentNode.insertBefore(res,addRow);
    var _plusSvg='<svg width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"white\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/><line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/></svg>';
    var _crossSvg='<svg width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"white\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/></svg>';
    function _updatePlBtn(val){
      var icon=document.getElementById('cwPlBtnIcon');
      if(!icon)return;
      if(val){icon.outerHTML=_crossSvg.replace('<svg ','<svg id="cwPlBtnIcon" ');btn.disabled=false;btn.style.background='var(--muted)';}
      else{icon.outerHTML=_plusSvg.replace('<svg ','<svg id="cwPlBtnIcon" ');btn.disabled=true;btn.style.background='';}
    }
    inp.addEventListener('input',function(){
      var val=this.value.trim();
      _updatePlBtn(val);
      if(_ytId(val)){res.innerHTML='';res.classList.remove('on');return;}
      clearTimeout(_plDeb);
      if(!val){res.innerHTML='';res.classList.remove('on');return;}
      res.innerHTML='<div class="cw-search-loading">Recherche\u2026</div>';res.classList.add('on');
      _plDeb=setTimeout(function(){
        _pipedSearch(val,function(items){_renderSearchResults(items,res,'window._cwPlPick');},
        function(){res.innerHTML='<div class="cw-search-err">Erreur r\u00e9seau</div>';res.classList.add('on');});
      },500);
    });
    inp.addEventListener('keydown',function(e){if(e.key==='Enter')window._cwPlAdd();if(e.key==='Escape'){inp.value='';res.innerHTML='';res.classList.remove('on');_updatePlBtn('');}});
    window._cwPlAddOrClear=function(){
      var val=inp.value.trim();
      var hasResults=res&&res.classList.contains('on');
      // Si un lien YouTube valide est dans le champ → ajouter directement
      if(_ytId(val)){window._cwPlAdd();return;}
      // Sinon (résultats de recherche affichés ou texte non-URL) → effacer
      if(hasResults||val){inp.value='';res.innerHTML='';res.classList.remove('on');_updatePlBtn('');}
    };
  })();

  window._cwPlAdd=function(){
    if(!_isHost)return;
    var inp=document.getElementById('cwPlInput');if(!inp)return;
    var id=_ytId(inp.value.trim());if(!id)return;
    if(!_sessionId){if(typeof showToast==='function')showToast('Pas de session active','error');return;}
    inp.value='';
    var btn=document.getElementById('cwPlAddBtn');if(btn)btn.disabled=true;
    _playlist.push({ytId:id});
    _savePlaylist();
    _renderPlaylist();
    _updateSkipBtn();
    var coupleId=_getCoupleId()||_coupleId;
    if(coupleId){
      var alreadySaved=_savedPlaylist.some(function(s){return s.ytId===id;});
      if(!alreadySaved){
        fetch(SB2_URL+'/rest/v1/'+TABLE_PL,{
          method:'POST',
          headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=representation'}),
          body:JSON.stringify({couple_id:coupleId,yt_id:id,position:_savedPlaylist.length})
        }).then(function(r){return r.json();})
        .then(function(rows){if(rows&&rows[0])_savedPlaylist.push({ytId:id,id:rows[0].id});})
        .catch(function(){});
      }
    }
  };

  window._cwPlJump=function(idx){
    if(!_isHost||idx===_plIndex||idx<0||idx>=_playlist.length)return;
    _plIndex=idx;
    _savePlaylist();
    _loadVideo(_playlist[_plIndex].ytId);
  };

  window._cwPlRemove=function(idx){
    if(!_isHost||idx<=_plIndex)return;
    _cwConfirm('Supprimer cette vidéo de la playlist ?',function(){
      _playlist.splice(idx,1);
      _savePlaylist();
      _renderPlaylist();
      _updateSkipBtn();
    });
  };

  // Skip : avance l'index, charge la suivante
  window._cwSkip=function(){if(_isHost)_cwSkipNext();};
  function _cwSkipNext(){
    if(!_isHost||!_sessionId)return;
    var nextIdx=_plIndex+1;
    if(nextIdx>=_playlist.length)return;
    _plIndex=nextIdx;
    _savePlaylist();
    _loadVideo(_playlist[_plIndex].ytId);
  }

  // Prev : recule l'index
  window._cwPrev=function(){if(_isHost)_cwSkipPrev();};
  function _cwSkipPrev(){
    if(!_isHost||!_sessionId)return;
    var prevIdx=_plIndex-1;
    if(prevIdx<0)return;
    _plIndex=prevIdx;
    _savePlaylist();
    _loadVideo(_playlist[_plIndex].ytId);
  }

  function _loadVideo(ytId){
    if(!ytId||!_player)return;
    _currentYtId=ytId;
    _player.loadVideoById(ytId);
    _broadcastNow(true);
    _renderPlaylist();
    _updateSkipBtn();
  }

  function _savePlaylist(){
    if(!_sessionId)return;
    fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId),{
      method:'PATCH',
      headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
      body:JSON.stringify({playlist:_playlist,playlist_index:_plIndex})
    }).catch(function(){});
  }

  // Sync playlist depuis le poll (les deux côtés)
  function _applyPlaylist(serverPlaylist,serverYtId,serverIdx){
    var idx=typeof serverIdx==='number'?serverIdx:0;
    if(!_isHost){
      _playlist=serverPlaylist||[];
      _plIndex=idx;
      _renderPlaylist();
      // Changement de vidéo côté hôte
      if(serverYtId&&serverYtId!==_currentYtId&&_player&&typeof _player.loadVideoById==='function'){
        _currentYtId=serverYtId;
        _player.loadVideoById(serverYtId);
      }
    } else {
      // Hôte : re-render si playlist changée (ex: non-hôte n'ajoute pas mais on garde la porte)
      _renderPlaylist();
    }
    _updateSkipBtn();
  }

  function _updateSkipBtn(){
    var skip=document.getElementById('cwSkipBtn');
    var prev=document.getElementById('cwPrevBtn');
    var hasNext=_playlist.length>0&&(_plIndex+1)<_playlist.length;
    var hasPrev=_plIndex>0;
    if(skip)skip.classList.toggle('dis',!_isHost||!hasNext);
    if(prev)prev.classList.toggle('dis',!_isHost||!hasPrev);
  }

  function _renderPlaylist(){
    var list=document.getElementById('cwPlList');
    var count=document.getElementById('cwPlCount');
    if(!list)return;
    var total=_playlist.length;
    if(count)count.textContent=total;
    if(!total){
      list.innerHTML='<div class="cw-pl-empty">Aucune vid\u00e9o dans la playlist</div>';
      return;
    }
    list.innerHTML=_playlist.map(function(item,i){
      var thumb='https://img.youtube.com/vi/'+item.ytId+'/default.jpg';
      var isCurrent=(i===_plIndex);
      var isPast=(i<_plIndex);
      var isNext=(i===_plIndex+1);
      var cls='cw-pl-item'+(isCurrent?' current':isPast?' past':'');
      var clickable=_isHost&&!isCurrent;
      if(clickable)cls+=' cw-pl-clickable';
      var statusCls=isCurrent?'now':isPast?'done':isNext?'next':'';
      var statusLbl=isCurrent?'\u25b6 En cours':isPast?'\u2713 Vue':isNext?'\u25b6 Suivante':'\u2014 En attente';
      // Bouton suppr uniquement sur les futures (non passées, non en cours)
      var rmHtml=(_isHost&&!isCurrent&&!isPast)
        ?'<button class="cw-pl-rm" onclick="window._cwPlRemove('+i+')">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
        :'';
      return '<div class="'+cls+'"'+(clickable?' onclick="window._cwPlJump('+i+')" style="cursor:pointer;"':'')+'>'+
        '<img class="cw-pl-thumb" src="'+thumb+'" alt="" />'+
        '<div class="cw-pl-info">'+
          '<div class="cw-pl-status '+statusCls+'">'+statusLbl+'</div>'+
          '<div class="cw-pl-id">youtu.be/'+item.ytId+'</div>'+
        '</div>'+
        rmHtml+
      '</div>';
    }).join('');
    // Scroll jusqu'à la vidéo en cours uniquement à l'ouverture
    var items=list.querySelectorAll('.cw-pl-item');
    if(_plJustOpened&&items[_plIndex]){items[_plIndex].scrollIntoView({block:'nearest'});_plJustOpened=false;}
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
  // Desktop/Android : requestFullscreen natif sur l'iframe existante.
  // iOS PWA : on agrandit le .cw-vwrap en position fixed (même iframe, même session YT).
  window._cwFullscreen=function(){
    var wrap=document.querySelector('.cw-vwrap');if(!wrap)return;
    var iframe=wrap.querySelector('iframe');

    // Si déjà en mode iOS-fs → sortir
    if(wrap.classList.contains('cw-ios-fs')){
      wrap.classList.remove('cw-ios-fs');
      var btn=document.getElementById('cwFsBtn');
      if(btn)btn.innerHTML=_iconExpand();
      document.body.style.overflow='';
      var old=document.getElementById('cwFsClose');
      if(old)old.parentNode.removeChild(old);
      return;
    }

    // Tentative native (desktop Chrome/Firefox, Android Chrome)
    var target=iframe||wrap;
    if(!document.fullscreenElement&&!document.webkitFullscreenElement){
      if(target.requestFullscreen){target.requestFullscreen();return;}
      if(target.webkitRequestFullscreen){target.webkitRequestFullscreen();return;}
    } else {
      if(document.exitFullscreen)document.exitFullscreen();
      else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
      return;
    }

    // Fallback iOS : agrandir le wrap existant sans toucher à l'iframe
    wrap.classList.add('cw-ios-fs');
    document.body.style.overflow='hidden';
    var btn=document.getElementById('cwFsBtn');
    if(btn)btn.innerHTML=_iconCompress();
    // Bouton fermer flottant dans le wrap
    var closeBtn=document.createElement('div');
    closeBtn.id='cwFsClose';
    closeBtn.style.cssText='position:absolute;top:14px;right:14px;z-index:9100;width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;';
    closeBtn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.onclick=function(){window._cwFullscreen();};
    wrap.appendChild(closeBtn);
  };

  // Écouter la sortie fullscreen native (bouton Échap / swipe)
  document.addEventListener('fullscreenchange',_onFsChange);
  document.addEventListener('webkitfullscreenchange',_onFsChange);
  function _onFsChange(){
    if(!document.fullscreenElement&&!document.webkitFullscreenElement){
      var btn=document.getElementById('cwFsBtn');
      if(btn)btn.innerHTML=_iconExpand();
    }
  }

  function _iconExpand(){
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  }
  function _iconCompress(){
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>';
  }

  // ── Confirmation inline ───────────────────────────────────────────
  function _cwConfirm(msg,onOk){
    var existing=document.getElementById('cwConfirmToast');
    if(existing)existing.remove();
    var toast=document.createElement('div');
    toast.id='cwConfirmToast';
    toast.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--s1);border:1.5px solid var(--border);border-radius:14px;padding:14px 16px;box-shadow:0 8px 32px rgba(0,0,0,.18);display:flex;flex-direction:column;gap:10px;min-width:240px;max-width:300px;font-family:"Bricolage Grotesque",sans-serif;';
    toast.innerHTML='<div style="font-size:13px;font-weight:600;color:var(--text);text-align:center;">'+msg+'</div>'+
      '<div style="display:flex;gap:8px;">'+
        '<button id="cwConfirmNo" style="flex:1;padding:8px;border-radius:10px;border:1.5px solid var(--border);background:var(--s2);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Annuler</button>'+
        '<button id="cwConfirmYes" style="flex:1;padding:8px;border-radius:10px;border:none;background:#ef4444;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Supprimer</button>'+
      '</div>';
    document.body.appendChild(toast);
    document.getElementById('cwConfirmNo').onclick=function(){toast.remove();};
    document.getElementById('cwConfirmYes').onclick=function(){toast.remove();onOk();};
    setTimeout(function(){if(toast.parentNode)toast.remove();},6000);
  }

  // ── Thème ──────────────────────────────────────────────────────────
  window._cwToggleTheme=function(){
    document.body.classList.toggle('light');
    var isLight=document.body.classList.contains('light');
    var btn=document.getElementById('cwHdrThemeBtn');
    if(btn)btn.innerHTML=isLight?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
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
    _playlist=[];_plIndex=0;_currentYtId=null;_plOpen=false;_savedPlaylist=[];_launchedFromLink=false;
    var ui=document.getElementById('cwUrlIn');if(ui)ui.value='';
    var pr=document.getElementById('cwPreview');if(pr)pr.classList.remove('on');
    var gb=document.getElementById('cwGoBtn');if(gb)gb.disabled=true;
    var ch=document.getElementById('cwChat');if(ch)ch.innerHTML='<div class="cw-chat-empty" id="cwChatEmpty">Aucun message pour l\u2019instant \uD83C\uDF7F</div>';
    var ci=document.getElementById('cwChatInput');if(ci){ci.value='';ci.style.height='auto';}
    var sb=document.getElementById('cwSendBtn');if(sb)sb.disabled=true;
  }

  window.closeCowatchModal=function(){
    if(_isHost&&_sessionId){
      // Nettoyer chat, présence, réactions — garder playlist intacte en base
      fetch(SB2_URL+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(_sessionId),{
        method:'PATCH',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
        body:JSON.stringify({active:false,chat:[],presence:{},
          state:{playing:false,currentTime:0,ts:0,reactions:[],joined:false}})
      }).catch(function(){});
    }
    _stopAll();
    var ov=document.getElementById('cwOv');if(ov)ov.classList.remove('on');
    document.body.classList.remove('subview-active');
  };

})();
