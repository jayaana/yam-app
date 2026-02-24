// ═══════════════════════════════════════════════════════════
// app-core.js — iOS init · Supabase · Auth · Thème · Utilitaires

// Fix clavier iOS — couvre la page principale derrière InstaLove
(function(){
  var NAV_H = 64;
  function update(){
    var hp  = document.getElementById('hiddenPage');
    var kbg = document.getElementById('dmKeyboardBg');
    if(!hp || !hp.classList.contains('active')) return;
    if(!window.visualViewport) return;
    var vv      = window.visualViewport;
    var kbH     = window.innerHeight - vv.height; // hauteur clavier
    if(kbH > 80){
      // Clavier ouvert : hiddenPage monte pour rester visible, bg bouche le trou
      hp.style.bottom  = kbH + 'px';
      if(kbg){ kbg.style.height = (kbH + NAV_H) + 'px'; kbg.classList.add('on'); }
    } else {
      // Clavier fermé : reset
      hp.style.bottom  = '';
      if(kbg){ kbg.style.height = ''; kbg.classList.remove('on'); }
    }
  }
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', update);
    window.visualViewport.addEventListener('scroll', update);
  }
  window._dmUpdateVP = update;
})();
(function(){
  function setScale(s){
    var m = document.querySelector('meta[name=viewport]');
    if(m) m.content = 'width=device-width, initial-scale=1.0, maximum-scale='+s+', user-scalable='+(s==='1.0'?'no':'yes')+', viewport-fit=cover';
  }
  document.addEventListener('focusin', function(e){
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') setScale('1.0');
  });
  document.addEventListener('focusout', function(e){
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') setScale('5.0');
  });
})();
(function() {
  var lastTouchY = 0;
  var preventPullToRefresh = false;
  document.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) return;
    lastTouchY = e.touches[0].clientY;
    preventPullToRefresh = window.scrollY === 0;
  }, { passive: false });
  document.addEventListener('touchmove', function(e) {
    var touchY = e.touches[0].clientY;
    var touchYDelta = touchY - lastTouchY;
    lastTouchY = touchY;
    if (preventPullToRefresh && touchYDelta > 0) {
      e.preventDefault();
      return false;
    }
  }, { passive: false });
  document.addEventListener('touchend', function(e) {
    preventPullToRefresh = false;
  }, { passive: false });
})();

async function nativeLogout(){
  // Purge session v2 + compat
  localStorage.removeItem(V2_SESSION_KEY || 'yam_v2_session');
  localStorage.removeItem('jayana_profile');
  sessionStorage.removeItem('jayana_sb_session');
  _sbAccessToken = null;
  location.reload();
}



// SUPABASE CONFIG — ancien projet (tables existantes inchangées)
// ════════════════════════════════════════════
// SB_URL (ancien projet) — supprimé, tout passe sur SB2
// SB_KEY (ancien projet) — remplacé par SB2_KEY
var SB_IMG = SB2_URL + '/storage/v1/object/public/images/';

// SUPABASE V2 CONFIG — nouveau projet auth
// ════════════════════════════════════════════
var SB2_URL        = 'https://jstiwtbgkbedtldqjdhp.supabase.co';
var SB2_KEY        = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdGl3dGJna2JlZHRsZHFqZGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4OTI1NTgsImV4cCI6MjA4NzQ2ODU1OH0.3W1u55aIakQxW5EyF0Sahc6Pjak1JqWhcX1ZifePH98';
var SB2_EDGE_AUTH  = SB2_URL + '/functions/v1/auth-v2';
var SB2_APP_SECRET = 'Kx9mPvR3wLjN7qTnYc4Zd';

// Clé localStorage pour la session v2
var V2_SESSION_KEY = 'yam_v2_session';

// Sauvegarde session v2 dans localStorage
function v2SaveSession(data){
  localStorage.setItem(V2_SESSION_KEY, JSON.stringify({
    token:     data.token,
    expires_at: data.expires_at,
    user:      data.user
  }));
}

// Charge session v2 depuis localStorage
function v2LoadSession(){
  try{
    var s = JSON.parse(localStorage.getItem(V2_SESSION_KEY)||'null');
    if(s && s.token && s.expires_at && new Date(s.expires_at) > new Date()) return s;
  }catch(e){}
  return null;
}

// Retourne le profil courant (role: 'girl' ou 'boy') depuis la session v2
// Fallback sur l'ancien système pour ne pas casser l'app actuelle
function getProfile(){
  var s = v2LoadSession();
  if(s && s.user && (s.user.role === 'girl' || s.user.role === 'boy')) return s.user.role;
  var v = localStorage.getItem('jayana_profile');
  return (v === 'boy' || v === 'girl') ? v : null;
}

// Retourne l'objet user complet de la session v2
function v2GetUser(){
  var s = v2LoadSession();
  return s ? s.user : null;
}

// Retourne le pseudo de l'utilisateur connecté (ou null)
function v2GetPseudo(){
  var u = v2GetUser();
  return (u && u.pseudo) ? u.pseudo : null;
}

// Retourne le pseudo du partenaire (ou null)
// Nécessite que le couple_id et les données partenaire soient stockés en session
function v2GetPartnerPseudo(){
  var u = v2GetUser();
  return (u && u.partner_pseudo) ? u.partner_pseudo : null;
}

// Retourne le pseudo d'un profil — avec fallback sur "Zelda"/"Link"
// Utiliser cette fonction partout où on affiche le nom d'un profil
function v2GetDisplayName(role){
  var u = v2GetUser();
  if(u && u.role === role && u.pseudo) return u.pseudo;
  if(u && u.role !== role && u.partner_pseudo) return u.partner_pseudo;
  // Fallback : noms génériques selon le rôle
  return role === 'girl' ? 'Elle 👧' : 'Lui 👦';
}

// Appel à l'Edge Function auth-v2
function v2Auth(action, payload){
  return fetch(SB2_EDGE_AUTH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-secret': SB2_APP_SECRET,
      'Authorization': 'Bearer ' + SB2_KEY
    },
    body: JSON.stringify(Object.assign({ action: action }, payload))
  }).then(function(r){ return r.json(); });
}

// Connexion : pseudo + password
function v2Login(pseudo, password){
  return v2Auth('login', { pseudo: pseudo, password: password })
    .then(function(data){
      if(data.error) return { ok: false, error: data.error };
      v2SaveSession(data);
      localStorage.setItem('jayana_profile', data.user.role); // compat ancien système
      return { ok: true, data: data };
    });
}

// Inscription : pseudo + password + role → génère un code couple
function v2Register(pseudo, password, role){
  return v2Auth('register', { pseudo: pseudo, password: password, role: role })
    .then(function(data){
      if(data.error) return { ok: false, error: data.error };
      v2SaveSession(data);
      localStorage.setItem('jayana_profile', data.user.role);
      return { ok: true, data: data };
    });
}

// Rejoindre un couple : pseudo + password + role + code couple
function v2Join(pseudo, password, role, coupleCode){
  return v2Auth('join', { pseudo: pseudo, password: password, role: role, couple_code: coupleCode })
    .then(function(data){
      if(data.error) return { ok: false, error: data.error };
      v2SaveSession(data);
      localStorage.setItem('jayana_profile', data.user.role);
      return { ok: true, data: data };
    });
}

// SÉCURITÉ — Fonction globale d'échappement HTML
// À utiliser PARTOUT où des données Supabase sont injectées via innerHTML
function escHtml(str){
  if(str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
// ── Init images Supabase Storage ──
(function(){
  // (remplacement URLs ancien projet supprimé — plus nécessaire)
  });
})();

// ── Auth via Edge Function sécurisée ──
// Sécurité : secret vérifié côté Edge Function uniquement
// via la variable d'environnement Deno.env.get('APP_SECRET').
var _sbAccessToken = null;
var SB_SESSION_KEY = 'jayana_sb_session';
// var SB_EDGE_FN = SB2_URL + '/functions/v1/get-token';
var SB_APP_SECRET  = 'JayanaSecret2025!';

// Charge session depuis sessionStorage (plus sûr que localStorage)
function sbLoadSession(gender){
  try{
    var sessions = JSON.parse(sessionStorage.getItem(SB_SESSION_KEY)||'{}');
    var s = sessions[gender];
    if(s && s.access_token && s.expires_at && Date.now()/1000 < s.expires_at - 60){
      _sbAccessToken = s.access_token;
      return true;
    }
  }catch(e){}
  return false;
}

function sbSaveSession(gender, data){
  try{
    var sessions = JSON.parse(sessionStorage.getItem(SB_SESSION_KEY)||'{}');
    sessions[gender] = { access_token: data.access_token, expires_at: data.expires_at };
    sessionStorage.setItem(SB_SESSION_KEY, JSON.stringify(sessions));
    _sbAccessToken = data.access_token;
  }catch(e){}
}

function sbLogin(gender){
  if(sbLoadSession(gender)) return Promise.resolve(true);
  return fetch(SB_EDGE_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-secret': SB_APP_SECRET },
    body: JSON.stringify({ gender: gender })
  }).then(function(r){ return r.json(); }).then(function(data){
    if(data.access_token){ sbSaveSession(gender, data); return true; }
    return false;
  }).catch(function(){ return false; });
}

function sbHeaders(extra){
  var token = _sbAccessToken || SB2_KEY;
  return Object.assign({'apikey':SB2_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json'},extra||{});
}
function sbGet(table,params){
  var url=SB2_URL+'/rest/v1/'+table+'?'+(params||'order=created_at.desc');
  return fetch(url,{headers:sbHeaders()}).then(function(r){return r.json();});
}
function sbPost(table,body){
  return fetch(SB2_URL+'/rest/v1/'+table,{
    method:'POST',headers:sbHeaders({'Prefer':'return=representation'}),body:JSON.stringify(body)
  }).then(function(r){return r.json();});
}
function sbPatch(table,id,body){
  return fetch(SB2_URL+'/rest/v1/'+table+'?id=eq.'+id,{
    method:'PATCH',headers:sbHeaders({'Prefer':'return=representation'}),body:JSON.stringify(body)
  }).then(function(r){return r.json();});
}
function sbDelete(table,id){
  return fetch(SB2_URL+'/rest/v1/'+table+'?id=eq.'+id,{
    method:'DELETE',headers:sbHeaders()
  });
}

/* ════════════════════════════════════════════
   setProfile — NOUVEAU système v2 uniquement
   Remplace l'ancienne logique éparpillée dans app-music.js
   Appelé par index.html (v2DoLogin/Register/Join) et par app-nav.js
════════════════════════════════════════════ */
window.setProfile = function(gender){
  var s = v2LoadSession();
  if(!s || !s.user){
    if(window.v2ShowLogin) window.v2ShowLogin();
    return;
  }
  localStorage.setItem('jayana_profile', gender);
  if(window._profileApply) window._profileApply(gender);
  if(window._profileLoadMoods) window._profileLoadMoods();
  if(window._checkUnread) window._checkUnread();
  // Mettre à jour les noms dans le popup profil
  var u = v2GetUser();
  var btnGirl = document.getElementById('ppBtnGirl');
  var btnBoy  = document.getElementById('ppBtnBoy');
  if(btnGirl && u) btnGirl.innerHTML = '<span class="profile-popup-dot girl"></span>' + escHtml(u.role==='girl' ? (u.pseudo||'Elle') : (u.partner_pseudo||'Elle'));
  if(btnBoy  && u) btnBoy.innerHTML  = '<span class="profile-popup-dot boy"></span>'  + escHtml(u.role==='boy'  ? (u.pseudo||'Lui')  : (u.partner_pseudo||'Lui'));
  var pp = document.getElementById('profilePopup');
  if(pp) pp.classList.remove('open');
  if(window._presencePush) window._presencePush();
};

/* ════════════════════════════════════════════
   Init au chargement : si session v2 active, sync localStorage
════════════════════════════════════════════ */
(function(){
  var s = v2LoadSession();
  if(!s || !s.user) return;
  localStorage.setItem('jayana_profile', s.user.role);
  document.addEventListener('DOMContentLoaded', function(){
    var u = v2GetUser();
    if(!u) return;
    var btnGirl = document.getElementById('ppBtnGirl');
    var btnBoy  = document.getElementById('ppBtnBoy');
    if(btnGirl) btnGirl.innerHTML = '<span class="profile-popup-dot girl"></span>' + escHtml(u.role==='girl' ? (u.pseudo||'Elle') : (u.partner_pseudo||'Elle'));
    if(btnBoy)  btnBoy.innerHTML  = '<span class="profile-popup-dot boy"></span>'  + escHtml(u.role==='boy'  ? (u.pseudo||'Lui')  : (u.partner_pseudo||'Lui'));
  });
})();

// ── COMPTEUR ──
// startDate est dynamique : mis à jour par app-account.js depuis v2_couples
var startDate = new Date('2024-10-29T00:00:00');
function updateCounter() {
  // Utilise window.YAM_COUPLE.start_date si disponible (chargé depuis Supabase)
  var ref = (window.YAM_COUPLE && window.YAM_COUPLE.start_date)
    ? new Date(window.YAM_COUPLE.start_date)
    : startDate;
  var d = Math.floor((new Date() - ref) / 1000);
  var dEl = document.getElementById('cnt-days');
  var hEl = document.getElementById('cnt-hours');
  var mEl = document.getElementById('cnt-mins');
  var sEl = document.getElementById('cnt-secs');
  if(dEl) dEl.textContent  = Math.floor(d / 86400);
  if(hEl) hEl.textContent = String(Math.floor((d % 86400) / 3600)).padStart(2,'0');
  if(mEl) mEl.textContent  = String(Math.floor((d % 3600) / 60)).padStart(2,'0');
  if(sEl) sEl.textContent  = String(d % 60).padStart(2,'0');
}
updateCounter(); setInterval(updateCounter, 1000);

// ── THEME ──
function applyThemeToggle() {
  document.body.classList.toggle('light');
  var isLight = document.body.classList.contains('light');
  document.getElementById('themeToggle').textContent = isLight ? '🌙 Thème' : '☀️ Thème';
  document.getElementById('floatingThemeBtn').textContent = isLight ? '🌙 Thème' : '☀️ Thème';
  // Sync icônes lune/soleil dans Quiz, Jeux, sous-jeux et Bêtises
  ['qz','gv','dm','pm','home'].forEach(function(prefix){
    var moon = document.getElementById(prefix+'ThemeIconMoon');
    var sun  = document.getElementById(prefix+'ThemeIconSun');
    if(moon) moon.style.display = isLight ? 'none' : '';
    if(sun)  sun.style.display  = isLight ? ''     : 'none';
  });
  document.querySelectorAll('.game-view-header .dm-topbar-theme svg').forEach(function(svg, i){
    if(i % 2 === 0) svg.style.display = isLight ? 'none' : ''; // lune
    else            svg.style.display = isLight ? ''     : 'none'; // soleil
  });
}
document.getElementById('themeToggle').addEventListener('click', applyThemeToggle);
document.getElementById('floatingThemeBtn').addEventListener('click', applyThemeToggle);

// Injecter le bouton thème dans les headers des sous-jeux
(function(){
  var MOON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg>';
  var SUN_SVG  = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  document.querySelectorAll('.game-view-header').forEach(function(header){
    var btn = document.createElement('button');
    btn.className = 'dm-topbar-theme';
    btn.title = 'Thème';
    btn.innerHTML = MOON_SVG + SUN_SVG;
    btn.onclick = function(){ applyThemeToggle(); };
    header.appendChild(btn);
  });
})();

// ── IDs des sous-vues (partagé avec app-pranks.js pour les MutationObservers) ──
var _subviewIds = ['gamesView','memoryView','penduView','puzzleView','snakeView','skyjoView','quizView','hiddenPage','prankMenu'];

// Gestion de la visibilité du bouton flottant selon la vue active
function updateFloatingThemeBtn() {
  var subviews = _subviewIds;
  var open = subviews.some(function(id) {
    var el = document.getElementById(id);
    return el && (el.classList.contains('active') || el.style.display === 'block');
  });
  document.body.classList.toggle('subview-open', open);
}
// Observer les changements de classe sur les sous-vues



// ── Modal édition description ──
var _descEditCallback = null;
function descEditOpen(currentVal, label, cb){
  _descEditCallback = cb;
  var input = document.getElementById('descEditInput');
  var lbl = document.getElementById('descEditLabel');
  if(lbl) lbl.textContent = label || 'Modifier la description';
  if(input){ input.value = currentVal || ''; }
  document.getElementById('descEditModal').classList.add('open');
  setTimeout(function(){ if(input) input.focus(); }, 100);
}
function descEditClose(){
  document.getElementById('descEditModal').classList.remove('open');
  _descEditCallback = null;
}
function descEditSave(){
  var val = document.getElementById('descEditInput').value.trim();
  document.getElementById('descEditModal').classList.remove('open');
  if(_descEditCallback){ _descEditCallback(val); _descEditCallback = null; }
}
document.addEventListener('DOMContentLoaded', function(){
  var inp = document.getElementById('descEditInput');
  var modal = document.getElementById('descEditModal');
  if(inp) inp.addEventListener('keydown', function(e){
    if(e.key === 'Enter') descEditSave();
    if(e.key === 'Escape') descEditClose();
  });
  if(modal) modal.addEventListener('click', function(e){
    if(e.target === this) descEditClose();
  });
});




/* ════════════════════════════════════════════
   PRÉSENCE EN LIGNE
   - Heartbeat toutes les 10s → table "presence"
   - Poll toutes les 10s pour afficher l'état de l'autre
   - Offline après 20s sans signal (60s si musique en cours)
   - visibilitychange : pause heartbeat quand page cachée
════════════════════════════════════════════ */
(function(){
  var PRESENCE_TABLE  = 'v2_presence';
  var HEARTBEAT_MS    = 10000;   // envoyer toutes les 10s
  var POLL_MS         = 10000;   // lire toutes les 10s
  var OFFLINE_AFTER   = 20000;   // ms sans signal = offline
  var OFFLINE_PLAYING = 60000;   // ms si is_playing = true

  var _heartbeatIv = null;
  var _pollIv      = null;
  var _dot         = null;

  function isAudioPlaying() {
    var playing = false;
    document.querySelectorAll('audio').forEach(function(a){ if(!a.paused) playing = true; });
    return playing;
  }

  /* Envoie mon heartbeat */
  function presencePush() {
    var profile = getProfile();
    if (!profile) return;
    fetch(SB2_URL + '/rest/v1/' + PRESENCE_TABLE, {
      method: 'POST',
      headers: sbHeaders({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({
        player:     profile,
        last_seen:  new Date().toISOString(),
        is_playing: isAudioPlaying()
      })
    }).catch(function(){});
  }

  /* Lit l'état de l'autre et met à jour le point */
  function presencePoll() {
    var profile = getProfile();
    if (!profile) return;
    var other = profile === 'girl' ? 'boy' : 'girl';
    fetch(SB2_URL + '/rest/v1/' + PRESENCE_TABLE + '?player=eq.' + other + '&select=last_seen,is_playing', {
      headers: sbHeaders()
    })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(rows) {
      if (!Array.isArray(rows) || !rows.length) { setDot(false); return; }
      var row       = rows[0];
      var lastSeen  = new Date(row.last_seen).getTime();
      var elapsed   = Date.now() - lastSeen;
      var threshold = row.is_playing ? OFFLINE_PLAYING : OFFLINE_AFTER;
      setDot(elapsed < threshold);
    }).catch(function(){ setDot(false); });
  }

  /* Affiche ou cache le point vert */
  function setDot(online) {
    if (!_dot) _dot = document.getElementById('presenceDot');
    if (!_dot) return;
    // Le point n'a de sens que si l'avatar de l'autre est visible
    var avOther = document.getElementById('profileAvatarOther');
    if (avOther && avOther.classList.contains('visible')) {
      _dot.classList.toggle('visible', online);
    } else {
      _dot.classList.remove('visible');
    }
    // Synchroniser immédiatement le badge météo humeur
    if(window.yamSyncMood) window.yamSyncMood();
  }

  /* Démarrage */
  function start() {
    if (_heartbeatIv) return;
    presencePush();
    _heartbeatIv = setInterval(presencePush, HEARTBEAT_MS);
    presencePoll();
    _pollIv = setInterval(presencePoll, POLL_MS);
  }

  /* Pause heartbeat quand page cachée — le timeout fera le reste */
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      clearInterval(_heartbeatIv); _heartbeatIv = null;
    } else {
      presencePush(); // signal immédiat au retour
      _heartbeatIv = setInterval(presencePush, HEARTBEAT_MS);
    }
  });

  /* Démarrer quand un profil est choisi */
  var _origSetProfile = window.setProfile;
  window.setProfile = function(g) {
    if (_origSetProfile) _origSetProfile.apply(this, arguments);
    setTimeout(start, 300);
  };

  /* Si profil déjà choisi au chargement */
  if (getProfile()) start();

  window._presencePoll = presencePoll;
  window._presencePush = presencePush;
})();
