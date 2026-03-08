// ════════════════════════════════════════════════════════════════════
// APP-COWATCH.JS — Co-watching YouTube synchronisé v2.0-beta
// Dépendances : SB2_URL, sb2Headers(), getProfile(), v2GetUser(),
//               v2GetDisplayName(), showToast
//
// SQL Supabase (une seule fois) :
// ALTER TABLE v2_cowatch_sessions ADD COLUMN IF NOT EXISTS yt_id text;
// ALTER TABLE v2_cowatch_sessions ADD COLUMN IF NOT EXISTS host_role text;
// ALTER TABLE v2_cowatch_sessions ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
// (ou recréer avec le schéma complet ci-dessous si la table n'existe pas)
// ════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var TABLE     = 'v2_cowatch_sessions';
  var BETA_CODE = 'YAMNOW';
  var BETA_KEY  = 'yam_cowatch_beta_ok';
  var POLL_MS   = 2000;

  var _myRole = null, _coupleId = null, _sessionId = null;
  var _isHost = false, _player = null, _ytReady = false;
  var _pollIv = null, _timeIv = null, _isSyncing = false;
  var _lastTs = 0, _lastReactTs = 0;

  // ── CSS ────────────────────────────────────────────────────────────
  var st = document.createElement('style');
  st.textContent = [
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
    '#cwScPlayer{flex:1;flex-direction:column;overflow:hidden;}',
    '.cw-vwrap{position:relative;width:100%;background:#000;flex-shrink:0;}',
    '#cwYTDiv{display:block;width:100%;aspect-ratio:16/9;}',
    '.cw-syncov{position:absolute;inset:0;background:rgba(0,0,0,.65);display:none;align-items:center;justify-content:center;flex-direction:column;gap:8px;z-index:5;}',
    '.cw-syncov.on{display:flex;}',
    '.cw-syncspin{width:28px;height:28px;border-radius:50%;border:3px solid rgba(255,255,255,.2);border-top-color:#fff;animation:cwRot .8s linear infinite;}',
    '.cw-synctxt{font-size:11px;color:rgba(255,255,255,.8);font-weight:600;}',
    '.cw-ctrl{flex-shrink:0;padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;}',
    '.cw-cbtn{width:42px;height:42px;border-radius:50%;border:1.5px solid var(--border);background:var(--s2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .1s;flex-shrink:0;-webkit-tap-highlight-color:transparent;}',
    '.cw-cbtn:active{transform:scale(.9);}.cw-cbtn svg{pointer-events:none;}',
    '.cw-cbtn.pri{background:var(--accent);border-color:var(--accent);}',
    '.cw-time{flex:1;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;font-weight:600;}',
    '.cw-hbadge{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:10px;background:rgba(201,120,96,.15);color:var(--accent);border:1px solid rgba(201,120,96,.3);}',
    '.cw-nohost{font-size:11px;color:var(--muted);padding:3px 8px;}',
    '.cw-reacts{flex-shrink:0;padding:8px 16px;display:flex;justify-content:space-around;border-bottom:1px solid var(--border);}',
    '.cw-rbtn{font-size:22px;padding:6px 10px;border-radius:12px;border:none;background:transparent;cursor:pointer;transition:transform .15s;-webkit-tap-highlight-color:transparent;}',
    '.cw-rbtn:active{transform:scale(1.4);}',
    '.cw-float{position:fixed;font-size:32px;pointer-events:none;z-index:2700;animation:cwFloat 1.4s ease-out forwards;}',
    '@keyframes cwFloat{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-110px) scale(1.5);opacity:0}}',
    '.cw-chat{flex:1;overflow-y:auto;padding:10px 16px;display:flex;flex-direction:column;gap:6px;min-height:60px;max-height:120px;}',
    '.cw-cmsg{display:flex;align-items:flex-end;gap:8px;}.cw-cmsg.mine{flex-direction:row-reverse;}',
    '.cw-cbubble{padding:6px 12px;border-radius:16px;font-size:13px;background:var(--s2);border:1px solid var(--border);color:var(--text);}',
    '.cw-cmsg.mine .cw-cbubble{background:rgba(201,120,96,.18);border-color:rgba(201,120,96,.3);}',
    '.cw-ctime{font-size:10px;color:var(--muted);flex-shrink:0;margin-bottom:2px;}',
  ].join('\n');
  document.head.appendChild(st);

  // ── HTML ───────────────────────────────────────────────────────────
  document.body.insertAdjacentHTML('beforeend',
    '<div id="cwOv">' +
    '<div id="cwHdr">' +
      '<div class="cw-back" onclick="window.closeCowatchModal()">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
      '</div>' +
      '<h2>📺 Regarder ensemble</h2>' +
      '<div class="cw-bbadge">BETA</div>' +
    '</div>' +
    '<div id="cwScBeta" class="cw-sc">' +
      '<div class="cw-bi">🔐</div>' +
      '<div class="cw-bt">Accès bêta</div>' +
      '<div class="cw-bs">Entre le code d&#39;acc&egrave;s pour tester cette fonctionnalit&eacute;.</div>' +
      '<input id="cwBetaIn" class="cw-binput" type="text" placeholder="CODE" autocomplete="off" autocorrect="off" spellcheck="false" />' +
      '<button class="cw-btn" onclick="window._cwBetaOk()">Accéder ✨</button>' +
    '</div>' +
    '<div id="cwScLobby" class="cw-sc">' +
      '<div class="cw-label">Colle un lien YouTube</div>' +
      '<input id="cwUrlIn" class="cw-urlinput" type="url" placeholder="https://youtube.com/watch?v=..." autocomplete="off" />' +
      '<div id="cwPreview" class="cw-preview">' +
        '<img id="cwThumb" src="" alt="" />' +
        '<div class="cw-preview-info"><div id="cwPreviewId" class="cw-preview-id"></div></div>' +
      '</div>' +
      '<button class="cw-btn" id="cwGoBtn" onclick="window._cwLaunch()" disabled>Lancer la session 🎬</button>' +
      '<div style="font-size:12px;color:var(--muted);text-align:center;line-height:1.6;">Tu seras l\'hôte et tu contrôles la lecture.<br>L\'autre verra une invitation dès qu\'il ouvre cette section.</div>' +
    '</div>' +
    '<div id="cwScWait" class="cw-sc">' +
      '<div class="cw-spin"></div>' +
      '<div class="cw-wt">En attente…</div>' +
      '<div class="cw-ws" id="cwWaitTxt">En attente que l&#39;autre rejoigne.</div>' +
      '<button class="cw-btn-ghost" onclick="window._cwCancel()">Annuler la session</button>' +
    '</div>' +
    '<div id="cwScJoin" class="cw-sc">' +
      '<div class="cw-join-host" id="cwJoinHost"></div>' +
      '<div class="cw-join-title">t\'invite \xe0 regarder</div>' +
      '<div class="cw-join-thumb"><img id="cwJoinThumb" src="" alt="" /></div>' +
      '<div class="cw-join-sub" id="cwJoinSub"></div>' +
      '<button class="cw-btn" onclick="window._cwJoin()">Rejoindre 🍿</button>' +
      '<button class="cw-btn-ghost" style="margin-top:4px;" onclick="window.closeCowatchModal()">Pas maintenant</button>' +
    '</div>' +
    '<div id="cwScPlayer" class="cw-sc">' +
      '<div class="cw-vwrap">' +
        '<div id="cwYTDiv"></div>' +
        '<div class="cw-syncov" id="cwSyncOv"><div class="cw-syncspin"></div><div class="cw-synctxt">Synchronisation…</div></div>' +
      '</div>' +
      '<div class="cw-ctrl">' +
        '<div class="cw-cbtn pri" onclick="window._cwPlay()">' +
          '<svg id="cwPlayIc" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>' +
        '</div>' +
        '<div class="cw-time" id="cwTime">0:00 / 0:00</div>' +
        '<div id="cwRoleBadge"></div>' +
        '<div class="cw-cbtn" onclick="window._cwBack10()">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5"/></svg>' +
        '</div>' +
        '<div class="cw-cbtn" onclick="window._cwFwd10()">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-5"/></svg>' +
        '</div>' +
      '</div>' +
      '<div class="cw-reacts">' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'❤️\'  )">❤️</button>' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'😂\'  )">😂</button>' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'😮\'  )">😮</button>' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'🔥\'  )">🔥</button>' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'👏\'  )">👏</button>' +
        '<button class="cw-rbtn" onclick="window._cwReact(\'😭\'  )">😭</button>' +
      '</div>' +
      '<div class="cw-chat" id="cwChat"></div>' +
    '</div>' +
    '</div>'
  );

  // ── Helpers ────────────────────────────────────────────────────────
  function _sc(id) {
    ['cwScBeta','cwScLobby','cwScWait','cwScJoin','cwScPlayer'].forEach(function(s) {
      var el = document.getElementById(s);
      if (el) el.classList.toggle('on', s === id);
    });
  }

  function _ytId(url) {
    var m = (url||'').match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function _fmt(s) {
    s = Math.floor(s || 0);
    var m = Math.floor(s / 60), ss = s % 60;
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function _getCoupleId() {
    var u = typeof v2GetUser === 'function' ? v2GetUser() : null;
    return u ? u.couple_id : null;
  }

  function _betaOk() {
    try { return localStorage.getItem(BETA_KEY) === '1'; } catch(e) { return false; }
  }

  function _otherRole(r) { return r === 'girl' ? 'boy' : 'girl'; }

  function _name(r) {
    return typeof v2GetDisplayName === 'function' ? v2GetDisplayName(r) : (r === 'girl' ? 'Elle' : 'Lui');
  }

  // ── Beta ────────────────────────────────────────────────────────────
  window._cwBetaOk = function() {
    var el = document.getElementById('cwBetaIn');
    if (!el) return;
    if (el.value.trim().toUpperCase() === BETA_CODE) {
      try { localStorage.setItem(BETA_KEY, '1'); } catch(e) {}
      _afterBeta();
    } else {
      el.classList.add('err'); el.value = '';
      setTimeout(function() { el.classList.remove('err'); }, 400);
    }
  };
  document.getElementById('cwBetaIn').addEventListener('keydown', function(e) { if (e.key === 'Enter') window._cwBetaOk(); });
  document.getElementById('cwBetaIn').addEventListener('input', function() { this.value = this.value.toUpperCase(); });

  // ── Preview ────────────────────────────────────────────────────────
  var _pvDebounce = null;
  document.getElementById('cwUrlIn').addEventListener('input', function() {
    clearTimeout(_pvDebounce);
    var id  = _ytId(this.value.trim());
    var btn = document.getElementById('cwGoBtn');
    var prv = document.getElementById('cwPreview');
    if (!id) { btn.disabled = true; prv.classList.remove('on'); return; }
    _pvDebounce = setTimeout(function() {
      document.getElementById('cwThumb').src = 'https://img.youtube.com/vi/' + id + '/mqdefault.jpg';
      document.getElementById('cwPreviewId').textContent = 'youtube.com/watch?v=' + id;
      prv.classList.add('on');
      btn.disabled = false;
    }, 350);
  });

  // ── Ouvrir ──────────────────────────────────────────────────────────
  window.openCowatchModal = function() {
    var ov = document.getElementById('cwOv');
    if (!ov) return;
    ov.classList.add('on');
    document.body.classList.add('subview-active');
    _myRole   = typeof getProfile === 'function' ? getProfile() : null;
    _coupleId = _getCoupleId();
    if (!_betaOk()) { _sc('cwScBeta'); return; }
    _afterBeta();
  };

  function _afterBeta() {
    // Cherche une session active créée par le partenaire
    if (!_coupleId) { _sc('cwScLobby'); return; }
    fetch(SB2_URL + '/rest/v1/' + TABLE
      + '?couple_id=eq.' + encodeURIComponent(_coupleId)
      + '&active=eq.true&order=created_at.desc&limit=1',
      { headers: sb2Headers() }
    )
    .then(function(r) { return r.json(); })
    .then(function(rows) {
      if (!rows || !rows.length || rows[0].host_role === _myRole) {
        _sc('cwScLobby'); // pas de session, ou c'est moi l&#39;hôte déjà
      } else {
        // Le partenaire a une session active → écran rejoindre
        var s = rows[0];
        _sessionId = s.id;
        var hostName = _name(s.host_role);
        document.getElementById('cwJoinHost').textContent = hostName;
        document.getElementById('cwJoinThumb').src = 'https://img.youtube.com/vi/' + s.yt_id + '/mqdefault.jpg';
        document.getElementById('cwJoinSub').textContent = 'youtube.com/watch?v=' + s.yt_id;
        _sc('cwScJoin');
      }
    })
    .catch(function() { _sc('cwScLobby'); });
  }

  // ── Lancer (hôte) ───────────────────────────────────────────────────
  window._cwLaunch = function() {
    var url  = document.getElementById('cwUrlIn').value.trim();
    var ytId = _ytId(url);
    if (!ytId || !_coupleId || !_myRole) return;

    // Désactiver sessions existantes du couple
    fetch(SB2_URL + '/rest/v1/' + TABLE + '?couple_id=eq.' + encodeURIComponent(_coupleId), {
      method: 'PATCH',
      headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
      body: JSON.stringify({ active: false })
    })
    .then(function() {
      return fetch(SB2_URL + '/rest/v1/' + TABLE, {
        method : 'POST',
        headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=representation' }),
        body   : JSON.stringify({
          couple_id : _coupleId,
          yt_id     : ytId,
          host_role : _myRole,
          active    : true,
          state     : { playing: false, currentTime: 0, ts: Date.now(), reactions: [], joined: false }
        })
      });
    })
    .then(function(r) { return r.json(); })
    .then(function(rows) {
      if (!rows || !rows.length) { if (typeof showToast==='function') showToast('Erreur création session','error'); return; }
      _sessionId = rows[0].id;
      _isHost    = true;
      document.getElementById('cwWaitTxt').textContent = 'En attente que ' + _name(_otherRole(_myRole)) + ' rejoigne…';
      _sc('cwScWait');
      _startWaitPoll();
    })
    .catch(function() { if (typeof showToast==='function') showToast('Erreur réseau','error'); });
  };

  // ── Poll hôte attend que joined=true ────────────────────────────────
  function _startWaitPoll() {
    _stopPoll();
    _pollIv = setInterval(function() {
      if (!_sessionId) return;
      fetch(SB2_URL + '/rest/v1/' + TABLE + '?id=eq.' + encodeURIComponent(_sessionId) + '&select=state,yt_id', { headers: sb2Headers() })
      .then(function(r) { return r.json(); })
      .then(function(rows) {
        if (!rows || !rows.length) return;
        var s = rows[0].state || {};
        if (s.joined) {
          _stopPoll();
          _startPlayer(rows[0].yt_id);
        }
      }).catch(function() {});
    }, POLL_MS);
  }

  // ── Rejoindre (non-hôte) ────────────────────────────────────────────
  window._cwJoin = function() {
    if (!_sessionId) return;
    _isHost = false;
    fetch(SB2_URL + '/rest/v1/' + TABLE + '?id=eq.' + encodeURIComponent(_sessionId), {
      method : 'PATCH',
      headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=representation' }),
      body   : JSON.stringify({ state: { joined: true, playing: false, currentTime: 0, ts: Date.now(), reactions: [] } })
    })
    .then(function(r) { return r.json(); })
    .then(function(rows) {
      if (!rows || !rows.length) return;
      _startPlayer(rows[0].yt_id);
    })
    .catch(function() { if (typeof showToast==='function') showToast('Erreur réseau','error'); });
  };

  // ── Annuler (hôte) ──────────────────────────────────────────────────
  window._cwCancel = function() {
    _stopPoll();
    if (_sessionId) {
      fetch(SB2_URL + '/rest/v1/' + TABLE + '?id=eq.' + encodeURIComponent(_sessionId), {
        method: 'PATCH',
        headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ active: false })
      }).catch(function() {});
    }
    _sessionId = null; _isHost = false;
    _sc('cwScLobby');
  };

  // ── Démarrer player ─────────────────────────────────────────────────
  function _startPlayer(ytId) {
    _sc('cwScPlayer');
    var badge = document.getElementById('cwRoleBadge');
    if (badge) {
      badge.className   = _isHost ? 'cw-hbadge' : 'cw-nohost';
      badge.textContent = _isHost ? 'Hôte' : '👁 Spectateur';
    }
    _loadYT(function() {
      var wrap = document.getElementById('cwYTDiv');
      if (!wrap) return;
      wrap.innerHTML = '';
      _player = new YT.Player('cwYTDiv', {
        width: '100%', videoId: ytId,
        playerVars: { playsinline: 1, controls: 0, rel: 0, modestbranding: 1 },
        events: {
          onReady      : function() { _startTimeIv(); if (!_isHost) _showSync(true); },
          onStateChange: function(e) { _onYTState(e.data); }
        }
      });
    });
    _startSyncPoll();
  }

  // ── YouTube API ─────────────────────────────────────────────────────
  function _loadYT(cb) {
    if (_ytReady && window.YT && window.YT.Player) { cb(); return; }
    var prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function() { _ytReady = true; if (typeof prev==='function') prev(); cb(); };
    if (window.YT && window.YT.Player) { _ytReady = true; cb(); return; }
    if (!document.getElementById('yt-api-sc')) {
      var s = document.createElement('script'); s.id = 'yt-api-sc';
      s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
    }
  }

  function _onYTState(data) {
    if (_isSyncing || !_isHost) return;
    var P = window.YT ? window.YT.PlayerState : {};
    if (data === (P.PLAYING || 1)) { _updatePlayIc(true);  _saveState({ playing: true,  currentTime: _player.getCurrentTime(), ts: Date.now() }); }
    if (data === (P.PAUSED  || 2)) { _updatePlayIc(false); _saveState({ playing: false, currentTime: _player.getCurrentTime(), ts: Date.now() }); }
  }

  // ── Poll sync ────────────────────────────────────────────────────────
  function _startSyncPoll() {
    _stopPoll();
    _pollIv = setInterval(function() {
      if (!_sessionId) return;
      fetch(SB2_URL + '/rest/v1/' + TABLE + '?id=eq.' + encodeURIComponent(_sessionId) + '&select=state,active', { headers: sb2Headers() })
      .then(function(r) { return r.json(); })
      .then(function(rows) {
        if (!rows || !rows.length) return;
        var row = rows[0];
        if (!row.active) { _stopAll(); if (typeof showToast==='function') showToast('Session terminée','info'); _sc('cwScLobby'); return; }
        var state = row.state || {};
        if (!_isHost) _applyState(state);
        _handleReacts(state);
      }).catch(function() {});
    }, POLL_MS);
  }

  function _applyState(state) {
    if (!state.ts || state.ts <= _lastTs) return;
    if (!_player || typeof _player.seekTo !== 'function') return;
    _lastTs = state.ts; _isSyncing = true; _showSync(true);
    var lag = Math.min((Date.now() - state.ts) / 1000, 5);
    _player.seekTo((state.currentTime || 0) + (state.playing ? lag : 0), true);
    setTimeout(function() {
      if (state.playing) { _player.playVideo(); _updatePlayIc(true); }
      else               { _player.pauseVideo(); _updatePlayIc(false); }
      _showSync(false); _isSyncing = false;
    }, 500);
  }

  function _saveState(patch) {
    if (!_sessionId) return;
    fetch(SB2_URL + '/rest/v1/' + TABLE + '?id=eq.' + encodeURIComponent(_sessionId), {
      method: 'PATCH',
      headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
      body: JSON.stringify({ state: patch, updated_at: new Date().toISOString() })
    }).catch(function() {});
  }

  // ── Contrôles ────────────────────────────────────────────────────────
  window._cwPlay = function() {
    if (!_player || !_isHost) return;
    var P = window.YT ? window.YT.PlayerState : {};
    if (_player.getPlayerState() === (P.PLAYING || 1)) _player.pauseVideo(); else _player.playVideo();
  };
  window._cwBack10 = function() {
    if (!_player || !_isHost) return;
    var t = Math.max(0, _player.getCurrentTime() - 10);
    _player.seekTo(t, true); _saveState({ playing: true, currentTime: t, ts: Date.now() });
  };
  window._cwFwd10 = function() {
    if (!_player || !_isHost) return;
    var t = _player.getCurrentTime() + 10;
    _player.seekTo(t, true); _saveState({ playing: true, currentTime: t, ts: Date.now() });
  };

  // ── Réactions ────────────────────────────────────────────────────────
  window._cwReact = function(emoji) {
    _showFloat(emoji, true); _addChat(emoji, true);
    if (!_sessionId) return;
    var now = Date.now();
    fetch(SB2_URL + '/rest/v1/' + TABLE + '?id=eq.' + encodeURIComponent(_sessionId) + '&select=state', { headers: sb2Headers() })
    .then(function(r) { return r.json(); })
    .then(function(rows) {
      if (!rows || !rows[0]) return;
      var state = rows[0].state || {};
      var reacts = (state.reactions || []).slice(-9);
      reacts.push({ emoji: emoji, role: _myRole, ts: now });
      state.reactions = reacts;
      fetch(SB2_URL + '/rest/v1/' + TABLE + '?id=eq.' + encodeURIComponent(_sessionId), {
        method: 'PATCH',
        headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ state: state })
      }).catch(function() {});
    }).catch(function() {});
  };

  function _handleReacts(state) {
    if (!Array.isArray(state.reactions) || !state.reactions.length) return;
    var last = state.reactions[state.reactions.length - 1];
    if (!last || last.ts <= _lastReactTs || last.role === _myRole) return;
    _lastReactTs = last.ts;
    _showFloat(last.emoji, false); _addChat(last.emoji, false);
  }

  function _showFloat(emoji, isMine) {
    var el = document.createElement('div'); el.className = 'cw-float'; el.textContent = emoji;
    el.style.cssText = 'left:' + ((isMine ? 15 : 55) + Math.random() * 30) + 'vw;bottom:38vh;animation-duration:' + (1.1 + Math.random() * 0.4) + 's;';
    document.body.appendChild(el);
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 2000);
  }

  function _addChat(emoji, isMine) {
    var chat = document.getElementById('cwChat'); if (!chat) return;
    var d = document.createElement('div'); d.className = 'cw-cmsg' + (isMine ? ' mine' : '');
    var now = new Date(); var t = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
    d.innerHTML = '<div class="cw-cbubble">' + emoji + '</div><div class="cw-ctime">' + t + '</div>';
    chat.appendChild(d); chat.scrollTop = chat.scrollHeight;
  }

  function _startTimeIv() {
    if (_timeIv) clearInterval(_timeIv);
    _timeIv = setInterval(function() {
      if (!_player || typeof _player.getCurrentTime !== 'function') return;
      var el = document.getElementById('cwTime');
      if (el) el.textContent = _fmt(_player.getCurrentTime()) + ' / ' + _fmt(_player.getDuration());
    }, 500);
  }

  function _updatePlayIc(playing) {
    var ic = document.getElementById('cwPlayIc'); if (!ic) return;
    ic.innerHTML = playing
      ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
      : '<polygon points="5 3 19 12 5 21 5 3"/>';
  }

  function _showSync(show) {
    var el = document.getElementById('cwSyncOv'); if (el) el.classList.toggle('on', show);
  }

  function _stopPoll() {
    if (_pollIv) { clearInterval(_pollIv); _pollIv = null; }
  }

  function _stopAll() {
    _stopPoll();
    if (_timeIv)  { clearInterval(_timeIv); _timeIv = null; }
    if (_player)  { try { _player.destroy(); } catch(e) {} _player = null; }
    _isHost = false; _isSyncing = false; _lastTs = 0; _sessionId = null;
    var ui = document.getElementById('cwUrlIn');   if (ui) ui.value = '';
    var pr = document.getElementById('cwPreview'); if (pr) pr.classList.remove('on');
    var gb = document.getElementById('cwGoBtn');   if (gb) gb.disabled = true;
    var ch = document.getElementById('cwChat');    if (ch) ch.innerHTML = '';
  }

  // ── Fermer ───────────────────────────────────────────────────────────
  window.closeCowatchModal = function() {
    if (_isHost && _sessionId) {
      fetch(SB2_URL + '/rest/v1/' + TABLE + '?id=eq.' + encodeURIComponent(_sessionId), {
        method: 'PATCH',
        headers: sb2Headers({ 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ active: false })
      }).catch(function() {});
    }
    _stopAll();
    var ov = document.getElementById('cwOv'); if (ov) ov.classList.remove('on');
    document.body.classList.remove('subview-active');
  };

})();
