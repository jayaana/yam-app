// ═══════════════════════════════════════════════════════════════════
// app-core-v3.js — YAM v3
// Supabase Auth natif · JWT · RLS via auth.uid() · Realtime propre
// Remplace complètement app-core.js (auth UUID custom supprimé)
// ═══════════════════════════════════════════════════════════════════

// ── Configuration Supabase ───────────────────────────────────────
var SB_URL       = 'https://jstiwtbgkbedtldqjdhp.supabase.co';
var SB_ANON_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdGl3dGJna2JlZHRsZHFqZGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4OTI1NTgsImV4cCI6MjA4NzQ2ODU1OH0.3W1u55aIakQxW5EyF0Sahc6Pjak1JqWhcX1ZifePH98';
var SB_EDGE_AUTH = SB_URL + '/functions/v1/auth-v3';
var SB_EDGE_PUSH = SB_URL + '/functions/v1/push-notify';

// ── Clé localStorage ─────────────────────────────────────────────
var YAM_SESSION_KEY = 'yam_session_v3';

// ── Debug ─────────────────────────────────────────────────────────
window._YAM_DEBUG = false;
window.yamLog = function() { if (window._YAM_DEBUG) console.log.apply(console, arguments); };

// ── Realtime ──────────────────────────────────────────────────────
window._yamRT         = null;
window._yamRTChannels = {};


// ═════════════════════════════════════════════════════════════════
// SESSION — Supabase Auth natif (JWT + refresh_token)
// ═════════════════════════════════════════════════════════════════

// Sauvegarde la session complète en localStorage
function yamSaveSession(data) {
  localStorage.setItem(YAM_SESSION_KEY, JSON.stringify({
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    data.expires_at,
    user:          data.user,
  }));
}

// Charge la session depuis localStorage
function yamLoadSession() {
  try {
    var s = JSON.parse(localStorage.getItem(YAM_SESSION_KEY) || 'null');
    if (s && s.access_token && s.user) return s;
  } catch (e) {}
  return null;
}

// Retourne true si le JWT est expiré (avec 60s de marge)
function _jwtExpired(session) {
  if (!session || !session.expires_at) return true;
  return new Date(session.expires_at * 1000) < new Date(Date.now() + 60000);
}

// Rafraîchit le JWT via le refresh_token si nécessaire
// Retourne la session fraîche ou null si impossible
async function yamRefreshIfNeeded() {
  var s = yamLoadSession();
  if (!s) return null;

  // JWT encore valide — pas besoin de refresh
  if (!_jwtExpired(s)) return s;

  // JWT expiré — on tente un refresh
  if (!s.refresh_token) {
    _yamHandleExpiredSession();
    return null;
  }

  try {
    var res = await fetch(SB_EDGE_AUTH, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + SB_ANON_KEY,
      },
      body: JSON.stringify({ action: 'refresh_token', refresh_token: s.refresh_token }),
    });
    var data = await res.json();
    if (!data.ok || data.error) {
      _yamHandleExpiredSession();
      return null;
    }
    yamSaveSession(data);
    // Re-auth le client Realtime avec le nouveau JWT
    if (window._yamRT) window._yamRT.realtime.setAuth(data.access_token);
    return yamLoadSession();
  } catch (e) {
    console.error('[Auth] Refresh failed:', e);
    _yamHandleExpiredSession();
    return null;
  }
}

// Session expirée → purge + affichage login
function _yamHandleExpiredSession() {
  window.yamClearAllPolls();
  if (window._yamRTCloseAll) window._yamRTCloseAll();
  localStorage.removeItem(YAM_SESSION_KEY);
  localStorage.removeItem('jayana_profile'); // compat
  if (window.v2ShowLogin) window.v2ShowLogin();
  else location.reload();
}

// ── Accesseurs session ─────────────────────────────────────────────

function yamGetSession()       { return yamLoadSession(); }
function yamGetUser()          { var s = yamLoadSession(); return s ? s.user : null; }
function yamGetAccessToken()   { var s = yamLoadSession(); return s ? s.access_token : ''; }
function yamGetPseudo()        { var u = yamGetUser(); return u ? u.pseudo : null; }
function yamGetPartnerPseudo() { var u = yamGetUser(); return u ? u.partner_pseudo : null; }
function getProfile()          { var u = yamGetUser(); return u ? u.role : null; }

function yamGetDisplayName(role) {
  var u = yamGetUser();
  if (u && u.role === role && u.pseudo)         return u.pseudo;
  if (u && u.role !== role && u.partner_pseudo) return u.partner_pseudo;
  return role === 'girl' ? 'Elle 👧' : 'Lui 👦';
}

// Compat aliases (utilisés par d'autres modules)
window.v2GetUser          = yamGetUser;
window.v2GetPseudo        = yamGetPseudo;
window.v2GetPartnerPseudo = yamGetPartnerPseudo;
window.v2GetDisplayName   = yamGetDisplayName;
window.v2LoadSession      = yamLoadSession;


// ═════════════════════════════════════════════════════════════════
// HEADERS REST SUPABASE
// Toutes les requêtes REST utilisent le JWT Supabase Auth natif.
// RLS s'applique automatiquement via auth.uid().
// ═════════════════════════════════════════════════════════════════

function sb2Headers(extra) {
  var token = yamGetAccessToken();
  return Object.assign({
    'apikey':        SB_ANON_KEY,
    'Authorization': 'Bearer ' + (token || SB_ANON_KEY),
    'Content-Type':  'application/json',
  }, extra || {});
}


// ═════════════════════════════════════════════════════════════════
// INTERCEPTEUR 401 — JWT expiré mid-session
// ═════════════════════════════════════════════════════════════════

async function _sb2Handle401(response) {
  if (response.status === 401) {
    // Tenter un refresh silencieux avant de déconnecter
    var refreshed = await yamRefreshIfNeeded();
    if (!refreshed) {
      // Refresh impossible → déconnexion
      _yamHandleExpiredSession();
    }
    return Promise.reject(new Error('401 — session rafraîchie ou expirée'));
  }
  return response;
}


// ═════════════════════════════════════════════════════════════════
// HELPERS REST SB2 — identiques à app-core v2 pour compatibilité
// ═════════════════════════════════════════════════════════════════

function sb2Fetch(table, params) {
  var url = SB_URL + '/rest/v1/' + table + '?' + (params || 'order=created_at.desc');
  return fetch(url, { headers: sb2Headers() })
    .then(_sb2Handle401)
    .then(function(r) { return r.json(); })
    .catch(function(e) { console.error('[sb2Fetch]', table, e); return []; });
}

function sb2Post(table, body, extra) {
  return fetch(SB_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: sb2Headers(Object.assign({ 'Prefer': 'return=representation' }, extra || {})),
    body: JSON.stringify(body),
  })
  .then(_sb2Handle401)
  .then(function(r) { return r.json(); });
}

function sb2Patch(table, filter, body) {
  return fetch(SB_URL + '/rest/v1/' + table + '?' + filter, {
    method: 'PATCH',
    headers: sb2Headers({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(body),
  })
  .then(_sb2Handle401)
  .then(function(r) { return r.json(); });
}

function sb2Delete(table, filter) {
  return fetch(SB_URL + '/rest/v1/' + table + '?' + filter, {
    method: 'DELETE',
    headers: sb2Headers(),
  })
  .then(_sb2Handle401)
  .then(function(r) { return r.ok; });
}

function sb2Upsert(table, body, prefer) {
  var conflictMap = {
    'presence':          'couple_id,role',
    'now_listening':     'couple_id,user_id',
    'dm_typing':         'couple_id,user_id',
    'like_counters':     'couple_id,role',
    'push_subscriptions':'user_id,endpoint',
    'skyjo_presence':    'couple_id,role',
    'memory_presence':   'couple_id,role',
    'cowatch_presence':  'couple_id,role',
    'flame':             'couple_id',
    'streak':            'couple_id',
    'crown':             'couple_id',
    'memo_notes':        'couple_id',
    'cowatch_sessions':  'couple_id',
    'moods':             'couple_id,user_id,mood_date',
    'flame_activities':  'couple_id,activity_type,activity_date',
    'photo_descs':       'couple_id,category,slot',
    'song_plays':        'couple_id,song_file',
    'new_badges':        'couple_id,section',
  };
  var onConflict = conflictMap[table];
  var url = SB_URL + '/rest/v1/' + table + (onConflict ? '?on_conflict=' + onConflict : '');
  return fetch(url, {
    method: 'POST',
    headers: sb2Headers({ 'Prefer': prefer || 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(body),
  })
  .then(_sb2Handle401)
  .then(function(r) { return r.ok; });
}


// ═════════════════════════════════════════════════════════════════
// AUTH — Register / Login / Logout
// Délèguent à Edge Function auth-v3 qui utilise Supabase Auth Admin
// ═════════════════════════════════════════════════════════════════

function _authPost(payload) {
  return fetch(SB_EDGE_AUTH, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + SB_ANON_KEY,
    },
    body: JSON.stringify(payload),
  }).then(function(r) { return r.json(); });
}

function _authPostWithJwt(payload) {
  var token = yamGetAccessToken();
  return fetch(SB_EDGE_AUTH, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify(payload),
  }).then(function(r) { return r.json(); });
}

function yamRegister(email, password, pseudo, role) {
  return _authPost({ action: 'register', email, password, pseudo, role })
    .then(function(data) {
      if (!data.ok) return { ok: false, error: data.error };
      yamSaveSession(data);
      localStorage.setItem('jayana_profile', data.user.role);
      return { ok: true, data: data };
    });
}

function yamLogin(email, password) {
  return _authPost({ action: 'login', email, password })
    .then(function(data) {
      if (!data.ok) return { ok: false, error: data.error };
      yamSaveSession(data);
      localStorage.setItem('jayana_profile', data.user.role);
      return { ok: true, data: data };
    });
}

async function yamLogout() {
  // Invalider le JWT côté Supabase Auth
  try {
    var token = yamGetAccessToken();
    if (token) {
      await fetch(SB_URL + '/auth/v1/logout', {
        method: 'POST',
        headers: { 'apikey': SB_ANON_KEY, 'Authorization': 'Bearer ' + token },
      });
    }
  } catch (e) { /* silent */ }

  window.yamClearAllPolls();
  if (window._yamRTCloseAll) window._yamRTCloseAll();
  localStorage.removeItem(YAM_SESSION_KEY);
  localStorage.removeItem('jayana_profile');
  location.reload();
}

// Compat alias
window.nativeLogout  = yamLogout;
window.v3Auth        = function(action, payload) { return _authPostWithJwt(Object.assign({ action }, payload)); };

// Rafraîchit le profil complet depuis auth-v3 (ex: après join_couple ou update_pseudo)
function v2RefreshSession() {
  return _authPost({ action: 'refresh_token', refresh_token: (yamLoadSession() || {}).refresh_token })
    .then(function(data) {
      if (!data.ok || !data.user) return null;
      yamSaveSession(data);
      if (window._yamRT) window._yamRT.realtime.setAuth(data.access_token);
      return data.user;
    })
    .catch(function() { return null; });
}
window.v2RefreshSession = v2RefreshSession;

// Join couple via code
function yamJoinCouple(coupleCode) {
  return _authPostWithJwt({ action: 'join_couple', couple_code: coupleCode })
    .then(function(data) {
      if (!data.ok) return { ok: false, error: data.error };
      // Mettre à jour le user dans la session locale
      var s = yamLoadSession();
      if (s) { s.user = data.user; localStorage.setItem(YAM_SESSION_KEY, JSON.stringify(s)); }
      return { ok: true, data: data };
    });
}
window.yamJoinCouple = yamJoinCouple;


// ═════════════════════════════════════════════════════════════════
// REALTIME — Client Supabase Auth natif
// Le JWT est passé à setAuth() → auth.uid() disponible dans les policies
// ═════════════════════════════════════════════════════════════════

function _yamInitRealtime() {
  if (window._yamRT) return;
  if (!window.supabase) { console.warn('[RT] supabase-js non chargé'); return; }

  window._yamRT = window.supabase.createClient(SB_URL, SB_ANON_KEY);

  // ── CLEF : passer le JWT Supabase Auth natif au client Realtime
  // Cela active auth.uid() dans les policies Realtime côté Supabase
  var token = yamGetAccessToken();
  if (token) {
    window._yamRT.realtime.setAuth(token);
    yamLog('[RT] setAuth JWT OK');
  }

  yamLog('[RT] Client Realtime initialisé');
}
window._yamInitRealtime = _yamInitRealtime;

// ✅ FIX RT — Init (ou re-auth) Realtime après chaque login
document.addEventListener('yam:session_ready', function() {
  if (!window._yamRT) {
    _yamInitRealtime();
    yamLog('[RT] Init Realtime sur session_ready');
    document.dispatchEvent(new CustomEvent('yam:rt_ready'));
  } else {
    // Client déjà créé — juste re-auth avec le nouveau JWT
    var token = yamGetAccessToken();
    if (token) window._yamRT.realtime.setAuth(token);
    yamLog('[RT] Re-auth Realtime sur session_ready');
    document.dispatchEvent(new CustomEvent('yam:rt_ready'));
  }
});

window._yamRTCloseAll = function() {
  if (!window._yamRT) return;
  Object.keys(window._yamRTChannels).forEach(function(key) {
    try { window._yamRT.removeChannel(window._yamRTChannels[key]); } catch (e) {}
  });
  window._yamRTChannels = {};
  yamLog('[RT] Tous les channels fermés');
};

// Quand le JWT est rafraîchi → re-auth le client Realtime
window._yamRTReAuth = function() {
  var token = yamGetAccessToken();
  if (window._yamRT && token) {
    window._yamRT.realtime.setAuth(token);
    yamLog('[RT] setAuth rafraîchi');
  }
};


// ═════════════════════════════════════════════════════════════════
// STOP POLLS — Appelé à la déconnexion et au 401
// ═════════════════════════════════════════════════════════════════

window.yamClearAllPolls = function() {
  if (window._yamStopPresence)     window._yamStopPresence();
  if (window._yamStopAdaptivePolls) window._yamStopAdaptivePolls();
  if (window._dmStopPoll)          window._dmStopPoll();
  if (window._dmStopBadgePoll)     window._dmStopBadgePoll();
  if (window._yamStopUnreadPoll)   window._yamStopUnreadPoll();
  if (window._likesIv)             { clearInterval(window._likesIv); window._likesIv = null; }
  if (window._yamStopPrankPoll)    window._yamStopPrankPoll();
  if (window._yamStopPartnerPoll)  window._yamStopPartnerPoll();
  if (window._yamStopMoodsPoll)    window._yamStopMoodsPoll();
  if (window._yamStopPlaysIv)      window._yamStopPlaysIv();
};


// ═════════════════════════════════════════════════════════════════
// INIT AU CHARGEMENT — Sync session + auto-refresh JWT
// ═════════════════════════════════════════════════════════════════

(function() {
  var s = yamLoadSession();
  if (!s || !s.user) return;

  // Sync localStorage compat
  localStorage.setItem('jayana_profile', s.user.role);

  // Auto-refresh JWT si expiré dès le démarrage
  if (_jwtExpired(s)) {
    yamRefreshIfNeeded(); // async, ne bloque pas
  }

  document.addEventListener('DOMContentLoaded', function() {
    var u = yamGetUser();
    if (!u) return;
    var btnGirl = document.getElementById('ppBtnGirl');
    var btnBoy  = document.getElementById('ppBtnBoy');
    if (btnGirl) btnGirl.innerHTML = '<span class="profile-popup-dot girl"></span>' + escHtml(u.role === 'girl' ? (u.pseudo || 'Elle') : (u.partner_pseudo || 'Elle'));
    if (btnBoy)  btnBoy.innerHTML  = '<span class="profile-popup-dot boy"></span>'  + escHtml(u.role === 'boy'  ? (u.pseudo || 'Lui')  : (u.partner_pseudo || 'Lui'));

    // ✅ FIX RT — Init Realtime au démarrage si session déjà active
    // Sans ça, _yamRT reste null et tous les channels tombent en fallback poll
    setTimeout(function() {
      _yamInitRealtime();
      yamLog('[RT] Init Realtime au démarrage (session active)');
      document.dispatchEvent(new CustomEvent('yam:rt_ready'));
    }, 300);
  });
})();

// Rafraîchir le JWT proactivement toutes les 50 minutes (expire après 60 min par défaut)
setInterval(function() {
  var s = yamLoadSession();
  if (s && _jwtExpired(s)) yamRefreshIfNeeded();
}, 50 * 60 * 1000);


// ═════════════════════════════════════════════════════════════════
// setProfile — Chargement du profil actif
// ═════════════════════════════════════════════════════════════════

window.setProfile = function(gender) {
  var s = yamLoadSession();
  if (!s || !s.user) {
    if (window.v2ShowLogin) window.v2ShowLogin();
    return;
  }
  localStorage.setItem('jayana_profile', gender);
  if (window._profileApply)      window._profileApply(gender);
  if (window._profileLoadMoods)  window._profileLoadMoods();
  if (window._checkUnread)       window._checkUnread();

  var u = yamGetUser();
  var btnGirl = document.getElementById('ppBtnGirl');
  var btnBoy  = document.getElementById('ppBtnBoy');
  if (btnGirl && u) btnGirl.innerHTML = '<span class="profile-popup-dot girl"></span>' + escHtml(u.role === 'girl' ? (u.pseudo || 'Elle') : (u.partner_pseudo || 'Elle'));
  if (btnBoy  && u) btnBoy.innerHTML  = '<span class="profile-popup-dot boy"></span>'  + escHtml(u.role === 'boy'  ? (u.pseudo || 'Lui')  : (u.partner_pseudo || 'Lui'));

  var pp = document.getElementById('profilePopup');
  if (pp) pp.classList.remove('open');
  if (window._presencePush) window._presencePush();
};


// ═════════════════════════════════════════════════════════════════
// ESCAPE HTML — sécurité XSS
// ═════════════════════════════════════════════════════════════════

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escHtml = escHtml;


// ═════════════════════════════════════════════════════════════════
// COMPTEUR ANNIVERSAIRE
// ═════════════════════════════════════════════════════════════════

window.startDate = null; // défini dynamiquement via YAM_COUPLE.start_date

function updateCounter() {
  var u = yamGetUser ? yamGetUser() : null;
  var hasPartner = u && u.partner_pseudo;
  var labelEl = document.querySelector('.home-counter-label');
  var numsEl  = document.querySelector('.home-counter-nums');

  if (!hasPartner) {
    if (numsEl)  numsEl.style.display  = 'none';
    if (labelEl) labelEl.textContent = u && u.role === 'girl' ? '💑 Lie ton partenaire !' : '💑 Lie ta partenaire !';
    return;
  }

  // Partenaire lié mais pas de date définie
  var hasDate = window.YAM_COUPLE && window.YAM_COUPLE.start_date;
  if (!hasDate) {
    if (numsEl)  numsEl.style.display  = 'none';
    if (labelEl) labelEl.textContent = '📅 En attente de votre date…';
    return;
  }

  // Tout est OK — affichage normal
  if (numsEl)  numsEl.style.display  = '';
  if (labelEl) labelEl.textContent = 'Nombre de jours ensemble';
  var d = Math.floor((new Date() - window.startDate) / 1000);
  var el;
  if ((el = document.getElementById('cnt-days')))  el.textContent = Math.floor(d / 86400);
  if ((el = document.getElementById('cnt-hours'))) el.textContent = String(Math.floor((d % 86400) / 3600)).padStart(2, '0');
  if ((el = document.getElementById('cnt-mins')))  el.textContent = String(Math.floor((d % 3600) / 60)).padStart(2, '0');
  if ((el = document.getElementById('cnt-secs')))  el.textContent = String(d % 60).padStart(2, '0');
}

(function() {
  var _iv = null;
  function start() { if (_iv) return; updateCounter(); _iv = setInterval(updateCounter, 1000); }
  function stop()  { if (_iv) { clearInterval(_iv); _iv = null; } }
  document.addEventListener('visibilitychange', function() { document.hidden ? stop() : start(); });
  window._counterSuspend = stop;
  window._counterResume  = start;
  start();
})();


// ═════════════════════════════════════════════════════════════════
// THÈME warm / dark
// ═════════════════════════════════════════════════════════════════

function applyThemeToggle() {
  var isLight = document.body.classList.contains('light');
  var goWarm  = !isLight;
  document.body.classList.toggle('light', goWarm);
  document.documentElement.classList.toggle('light', goWarm);
  document.documentElement.setAttribute('data-theme', goWarm ? 'warm' : 'dark');
  var themeMeta = document.getElementById('themeColorMeta');
  if (themeMeta) themeMeta.setAttribute('content', goWarm ? '#e2d9cf' : '#121212');
  localStorage.setItem('jayana_theme', goWarm ? 'light' : 'dark');
  var t1 = document.getElementById('themeToggle');
  var t2 = document.getElementById('floatingThemeBtn');
  if (t1) t1.textContent = goWarm ? '🌙' : '☀️';
  if (t2) t2.textContent = goWarm ? '🌙' : '☀️';
  ['qz','gv','dm','pm','home'].forEach(function(prefix) {
    var moon = document.getElementById(prefix + 'ThemeIconMoon');
    var sun  = document.getElementById(prefix + 'ThemeIconSun');
    if (moon) moon.style.display = goWarm ? 'none' : '';
    if (sun)  sun.style.display  = goWarm ? ''     : 'none';
  });
  if (typeof haptic === 'function') haptic('light');
  var lMoon = document.getElementById('v2LoginIconMoon');
  var lSun  = document.getElementById('v2LoginIconSun');
  if (lMoon) lMoon.style.display = goWarm ? 'none' : '';
  if (lSun)  lSun.style.display  = goWarm ? ''     : 'none';
}

(function() {
  var saved   = localStorage.getItem('jayana_theme');
  var goLight = saved !== 'dark';
  if (goLight) {
    document.body.classList.add('light');
    document.documentElement.classList.add('light');
    document.documentElement.setAttribute('data-theme', 'warm');
    var m = document.getElementById('themeColorMeta');
    if (m) m.setAttribute('content', '#e2d9cf');
    document.addEventListener('DOMContentLoaded', function() {
      var btn = document.getElementById('themeToggle');
      if (btn) btn.textContent = '🌙';
      var fBtn = document.getElementById('floatingThemeBtn');
      if (fBtn) fBtn.textContent = '🌙';
      ['qz','gv','dm','pm','home'].forEach(function(prefix) {
        var moon = document.getElementById(prefix + 'ThemeIconMoon');
        var sun  = document.getElementById(prefix + 'ThemeIconSun');
        if (moon) moon.style.display = 'none';
        if (sun)  sun.style.display  = '';
      });
    });
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

document.getElementById('themeToggle')     && document.getElementById('themeToggle').addEventListener('click', applyThemeToggle);
document.getElementById('floatingThemeBtn') && document.getElementById('floatingThemeBtn').addEventListener('click', applyThemeToggle);

(function() {
  var MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>';
  var SUN  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  document.querySelectorAll('.game-view-header').forEach(function(header) {
    var btn = document.createElement('button');
    btn.className = 'dm-topbar-theme';
    btn.title     = 'Thème';
    btn.innerHTML = MOON + SUN;
    btn.onclick   = applyThemeToggle;
    header.appendChild(btn);
  });
})();


// ═════════════════════════════════════════════════════════════════
// MODAL ÉDITION DESCRIPTION
// ═════════════════════════════════════════════════════════════════

var _descEditCallback = null;

function descEditOpen(currentVal, label, cb) {
  _descEditCallback = cb;
  var input = document.getElementById('descEditInput');
  var lbl   = document.getElementById('descEditLabel');
  if (lbl)   lbl.textContent = label || 'Modifier la description';
  if (input) input.value = currentVal || '';
  if (typeof window._nousBlockScroll === 'function') window._nousBlockScroll();
  else window._yamScrollLocked = true;
  document.getElementById('descEditModal').classList.add('open');
  setTimeout(function() { if (input) input.focus(); }, 100);
}

function descEditClose() {
  document.getElementById('descEditModal').classList.remove('open');
  if (typeof window._nousUnblockScroll === 'function') window._nousUnblockScroll();
  else window._yamScrollLocked = false;
  _descEditCallback = null;
}

function descEditSave() {
  var val = document.getElementById('descEditInput').value.trim();
  document.getElementById('descEditModal').classList.remove('open');
  if (typeof window._nousUnblockScroll === 'function') window._nousUnblockScroll();
  else window._yamScrollLocked = false;
  if (_descEditCallback) { _descEditCallback(val); _descEditCallback = null; }
}

document.addEventListener('DOMContentLoaded', function() {
  var inp   = document.getElementById('descEditInput');
  var modal = document.getElementById('descEditModal');
  if (inp)   inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') descEditSave(); if (e.key === 'Escape') descEditClose(); });
  if (modal) modal.addEventListener('click', function(e) { if (e.target === this) descEditClose(); });
});


// ═════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═════════════════════════════════════════════════════════════════

var _VAPID_PUBLIC_KEY = 'BNZesKdT92j-aS0IIeuH6ea0sc927o3QjFve3Z2fIKFAB_TPaciM1MaUPFMTuYMOCrzJH3rrGbKvJsy0CReZvYU';

function _urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData = atob(base64);
  var output  = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

async function _yamSendSubToServer(sub) {
  var user  = yamGetUser();
  var token = yamGetAccessToken();
  if (!user || !token) return;
  var subJSON = sub.toJSON();
  try {
    await fetch(SB_EDGE_PUSH, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        action:    'subscribe',
        user_id:   user.id,
        couple_id: user.couple_id,
        profile:   user.role,
        subscription: {
          endpoint: subJSON.endpoint,
          p256dh:   subJSON.keys.p256dh,
          auth:     subJSON.keys.auth,
        },
        user_agent: navigator.userAgent,
      }),
    });
  } catch (e) {
    console.error('[Push] sendSubToServer error:', e);
  }
}

window.yamRegisterPush = async function() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    var reg  = await navigator.serviceWorker.ready;
    var existing = await reg.pushManager.getSubscription();
    if (existing) { await _yamSendSubToServer(existing); return; }
    var permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    var sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlBase64ToUint8Array(_VAPID_PUBLIC_KEY),
    });
    await _yamSendSubToServer(sub);
    yamLog('[Push] Subscription enregistrée');
  } catch (e) {
    console.error('[Push] yamRegisterPush error:', e);
  }
};

window.yamClearAppBadge = function() {
  if (!('serviceWorker' in navigator)) return;
  function _send() {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'YAM_CLOSE_NOTIFICATIONS' });
    }
  }
  if (navigator.serviceWorker.controller) _send();
  else navigator.serviceWorker.ready.then(_send);
};

document.addEventListener('visibilitychange', function() {
  if (!document.hidden) window.yamClearAppBadge();
});

window.yamPushNotify = async function(opts) {
  var user  = yamGetUser();
  var token = yamGetAccessToken();
  if (!user || !token) return;
  var targetProfile = user.role === 'girl' ? 'boy' : 'girl';
  try {
    await fetch(SB_EDGE_PUSH, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        action:         'notify',
        couple_id:      user.couple_id,
        target_profile: targetProfile,
        title:          opts.title || 'YAM',
        body:           opts.body  || '',
        tag:            opts.tag   || 'yam-notif',
        data:           Object.assign({ url: '/yam-app/' }, opts.data || {}),
      }),
    });
  } catch (e) {
    console.error('[Push] yamPushNotify error:', e);
  }
};


// ═════════════════════════════════════════════════════════════════
// PRÉSENCE EN LIGNE
// Même logique qu'avant — tables et colonnes renommées (v2_ → sans préfixe)
// ═════════════════════════════════════════════════════════════════

(function() {
  var PRESENCE_TABLE  = 'presence';
  var HEARTBEAT_MS    = 10000;
  var POLL_MS         = 10000;
  var OFFLINE_AFTER   = 20000;
  var OFFLINE_PLAYING = 60000;

  var _heartbeatIv = null;
  var _pollIv      = null;
  var _dot         = null;

  function isAudioPlaying() {
    var playing = false;
    document.querySelectorAll('audio').forEach(function(a) { if (!a.paused) playing = true; });
    return playing;
  }

  function presencePush() {
    var u = yamGetUser();
    if (!u || !u.couple_id) return;
    sb2Upsert(PRESENCE_TABLE, {
      user_id:    u.id,
      couple_id:  u.couple_id,
      role:       u.role,
      last_seen:  new Date().toISOString(),
      is_playing: isAudioPlaying(),
    }, 'resolution=merge-duplicates,return=minimal');
  }

  function presencePoll() {
    var u = yamGetUser();
    if (!u || !u.couple_id) return;
    var other = u.role === 'girl' ? 'boy' : 'girl';
    sb2Fetch(PRESENCE_TABLE, 'couple_id=eq.' + u.couple_id + '&role=eq.' + other + '&select=last_seen,is_playing')
      .then(function(rows) {
        if (!Array.isArray(rows) || !rows.length) { setDot(false); return; }
        var row       = rows[0];
        var elapsed   = Date.now() - new Date(row.last_seen).getTime();
        var threshold = row.is_playing ? OFFLINE_PLAYING : OFFLINE_AFTER;
        setDot(elapsed < threshold);
      }).catch(function() { setDot(false); });
  }

  window.yamPartnerOnlineCheck = async function() {
    try {
      var u = yamGetUser();
      if (!u || !u.couple_id) return false;
      var other = u.role === 'girl' ? 'boy' : 'girl';
      var rows  = await sb2Fetch(PRESENCE_TABLE, 'couple_id=eq.' + u.couple_id + '&role=eq.' + other + '&select=last_seen');
      if (!Array.isArray(rows) || !rows.length) return false;
      return Date.now() - new Date(rows[0].last_seen).getTime() < 20000;
    } catch (e) { return false; }
  };

  function setDot(online) {
    if (!_dot) _dot = document.getElementById('presenceDot');
    if (!_dot) return;
    var avOther = document.getElementById('profileAvatarOther');
    if (avOther && avOther.classList.contains('visible')) {
      _dot.classList.toggle('visible', online);
    } else {
      _dot.classList.remove('visible');
    }
    if (window.yamSyncMood) window.yamSyncMood();
  }

  function start() {
    if (_heartbeatIv) return;
    presencePush();
    _heartbeatIv = setInterval(presencePush, HEARTBEAT_MS);
    presencePoll();
    _pollIv = setInterval(presencePoll, POLL_MS);
  }

  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      clearInterval(_heartbeatIv); _heartbeatIv = null;
      clearInterval(_pollIv);      _pollIv      = null;
    } else {
      presencePush();
      _heartbeatIv = setInterval(presencePush, HEARTBEAT_MS);
      if (!window._skyjoPresenceActive) {
        presencePoll();
        _pollIv = setInterval(presencePoll, POLL_MS);
      }
    }
  });

  window._corePresenceSuspend = function() {
    window._skyjoPresenceActive = true;
    clearInterval(_pollIv); _pollIv = null;
  };
  window._corePresenceResume = function() {
    window._skyjoPresenceActive = false;
    if (!_pollIv) { presencePoll(); _pollIv = setInterval(presencePoll, POLL_MS); }
  };

  var _origSetProfile = window.setProfile;
  window.setProfile = function(g) {
    if (_origSetProfile) _origSetProfile.apply(this, arguments);
    setTimeout(start, 300);
  };

  if (getProfile()) start();

  window._presencePoll  = presencePoll;
  window._presencePush  = presencePush;

  window._yamStopPresence = function() {
    clearInterval(_heartbeatIv); _heartbeatIv = null;
    clearInterval(_pollIv);      _pollIv      = null;
  };

  window._yamStartPresence = function() {
    if (_heartbeatIv) return;
    start();
  };

  document.addEventListener('yam:session_ready', function() {
    window._yamStartPresence();
  });

  // ── Realtime présence — remplace le poll quand connecté ──
  (function() {
    var _fallbackIv = null;

    function _startFallback() {
      if (_fallbackIv) return;
      _fallbackIv = setInterval(presencePoll, POLL_MS);
      yamLog('[RT] présence fallback actif');
    }
    function _stopFallback() {
      if (_fallbackIv) { clearInterval(_fallbackIv); _fallbackIv = null; }
    }

    function _initPresenceRT() {
      if (!window._yamRT) { _startFallback(); return; }
      var u = yamGetUser();
      if (!u || !u.couple_id) { _startFallback(); return; }
      if (window._yamRTChannels['presence']) return;

      var ch = window._yamRT
        .channel('presence_' + u.couple_id)
        .on('postgres_changes', {
          event:  'UPDATE',
          schema: 'public',
          table:  'presence',
          filter: 'couple_id=eq.' + u.couple_id,
        }, function() { presencePoll(); })
        .subscribe(function(status) {
          if (status === 'SUBSCRIBED') {
            yamLog('[RT] présence connectée');
            clearInterval(_pollIv); _pollIv = null;
            _stopFallback();
            presencePoll();
          } else if (['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)) {
            yamLog('[RT] présence ' + status + ' — fallback');
            delete window._yamRTChannels['presence'];
            _startFallback();
          }
        });
      window._yamRTChannels['presence'] = ch;
    }

    // Patch stop pour aussi arrêter le fallback
    window._yamStopPresence = function() {
      clearInterval(_heartbeatIv); _heartbeatIv = null;
      clearInterval(_pollIv);      _pollIv      = null;
      _stopFallback();
    };

    setTimeout(function() { if (window._yamRT) _initPresenceRT(); }, 2000);
    document.addEventListener('yam:session_ready', function() {
      setTimeout(_initPresenceRT, 1000);
    });
  })();
})();


// ═════════════════════════════════════════════════════════════════
// Variables globales partagées (compat avec les autres modules)
// ═════════════════════════════════════════════════════════════════

var _subviewIds = ['gamesView','memoryView','penduView','puzzleView','snakeView','skyjoView','quizView','hiddenPage','prankMenu'];

function updateFloatingThemeBtn() {
  var open = _subviewIds.some(function(id) {
    var el = document.getElementById(id);
    return el && (el.classList.contains('active') || el.style.display === 'block');
  });
  document.body.classList.toggle('subview-open', open);
}


// ═════════════════════════════════════════════════════════════════
// #28 — Gestionnaire d'erreurs global
// Capture window.onerror + unhandledrejection → POST errors_log
// ═════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // Rate-limit : max 5 erreurs loggées par session pour éviter le spam DB
  var _errCount = 0;
  var _ERR_MAX  = 5;

  // Patterns à ignorer — erreurs bénignes / externes
  var _IGNORE = [
    'ResizeObserver loop',
    'Non-Error promise rejection',
    'Load failed',
    'NetworkError',
    'Failed to fetch',
    'unsafe-eval',
    'Script error.',
    'Cannot read properties of null',
  ];

  function _shouldIgnore(msg) {
    if (!msg) return true;
    for (var i = 0; i < _IGNORE.length; i++) {
      if (msg.indexOf(_IGNORE[i]) !== -1) return true;
    }
    return false;
  }

  // Envoyer l'erreur dans errors_log via Supabase REST
  window.yamLogError = function(message, context, stack) {
    if (_errCount >= _ERR_MAX) return;
    if (_shouldIgnore(message)) return;

    // Ne pas logger si l'utilisateur n'est pas connecté
    var u = (typeof yamGetUser === 'function') ? yamGetUser() : null;
    if (!u) return;

    _errCount++;

    var payload = {
      user_id:    u.id        || null,
      couple_id:  u.couple_id || null,
      message:    (message || '').substring(0, 500),
      stack:      (stack   || '').substring(0, 2000),
      context:    (context || '').substring(0, 200),
      url:        window.location.href.substring(0, 300),
      created_at: new Date().toISOString(),
    };

    // Fire & forget
    fetch(SB_URL + '/rest/v1/errors_log', {
      method:  'POST',
      headers: sb2Headers({ 'Prefer': 'return=minimal' }),
      body:    JSON.stringify(payload),
    }).catch(function() {});
  };

  // Capturer les erreurs JS non catchées
  window.onerror = function(message, source, lineno, colno, error) {
    var stack = error && error.stack ? error.stack : (source + ':' + lineno + ':' + colno);
    var ctx   = source ? source.split('/').pop() + ':' + lineno : 'unknown';
    window.yamLogError(String(message), ctx, stack);
    return false;
  };

  // Capturer les Promises rejetées non catchées
  window.addEventListener('unhandledrejection', function(e) {
    var reason  = e.reason;
    var message = reason ? (reason.message || String(reason)) : 'Unhandled promise rejection';
    var stack   = reason && reason.stack ? reason.stack : '';
    window.yamLogError(message, 'promise', stack);
  });

})();
