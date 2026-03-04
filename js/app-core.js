// ═══════════════════════════════════════════════════════════
// app-core.js — iOS init · Supabase · Auth · Thème · Utilitaires

// Fix clavier iOS — géré par app-ios-touch.js (_yamKeyboardUpdate / _dmUpdateVP)
// Fix zoom iOS — supprimé (causait rebond navbar). Géré par font-size:16px en CSS.
// Pull-to-refresh blocker — géré par app-ios-touch.js

async function nativeLogout(){
  // Purge session v2 + compat
  localStorage.removeItem(V2_SESSION_KEY || 'yam_v2_session');
  localStorage.removeItem('jayana_profile');
  sessionStorage.clear(); // purge toutes les sessions stockées
  location.reload();
}



// ══════════════════════════════════════════════════════════
// SUPABASE V2 — Projet actif (auth + données + storage)
// ════════════════════════════════════════════
var SB2_URL        = 'https://jstiwtbgkbedtldqjdhp.supabase.co';
var SB2_KEY        = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdGl3dGJna2JlZHRsZHFqZGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4OTI1NTgsImV4cCI6MjA4NzQ2ODU1OH0.3W1u55aIakQxW5EyF0Sahc6Pjak1JqWhcX1ZifePH98';
var SB2_EDGE_AUTH  = SB2_URL + '/functions/v1/auth-v2';
var SB2_APP_SECRET = 'Kx9mPvR3wLjN7qTnYc4Zd';

// ── Helpers SB2 REST (utilisés dans tous les fichiers JS) ──
function sb2Headers(extra){
  // ⚠️ FIX LIKES : Le token de session est un UUID, pas un JWT valide
  // Supabase rejette les UUID avec "Expected 3 parts in JWT; got 1"
  // Solution : utiliser UNIQUEMENT l'anon key, ignorer le token
  return Object.assign({
    'apikey': SB2_KEY,
    'Authorization': 'Bearer ' + SB2_KEY,
    'Content-Type': 'application/json'
  }, extra || {});
}

// ── Intercepteur 401 : session expirée → purge + affichage login ──
function _sb2Handle401(response){
  if(response.status === 401){
    // Purge session expirée
    localStorage.removeItem('yam_v2_session');
    localStorage.removeItem('jayana_profile');
    // Affiche le login si disponible, sinon reload
    if(window.v2ShowLogin){
      window.v2ShowLogin();
    } else {
      location.reload();
    }
    return Promise.reject(new Error('Session expirée — veuillez vous reconnecter.'));
  }
  return response;
}

function sb2Fetch(table, params){
  var url = SB2_URL + '/rest/v1/' + table + '?' + (params || 'order=created_at.desc');
  return fetch(url, { headers: sb2Headers() })
    .then(_sb2Handle401)
    .then(function(r){ return r.json(); });
}
function sb2Post(table, body, extra){
  return fetch(SB2_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: sb2Headers(Object.assign({ 'Prefer': 'return=representation' }, extra || {})),
    body: JSON.stringify(body)
  })
  .then(_sb2Handle401)
  .then(function(r){ return r.json(); });
}
function sb2Patch(table, filter, body){
  return fetch(SB2_URL + '/rest/v1/' + table + '?' + filter, {
    method: 'PATCH',
    headers: sb2Headers({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(body)
  })
  .then(_sb2Handle401)
  .then(function(r){ return r.json(); });
}
function sb2Delete(table, filter){
  return fetch(SB2_URL + '/rest/v1/' + table + '?' + filter, {
    method: 'DELETE',
    headers: sb2Headers()
  })
  .then(_sb2Handle401)
  .then(function(r){ return r.ok; });
}
function sb2Upsert(table, body, prefer){
  return fetch(SB2_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: sb2Headers({ 'Prefer': prefer || 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(body)
  })
  .then(_sb2Handle401)
  .then(function(r){ return r.ok; });
}

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

// Recharge les données utilisateur depuis le serveur et met à jour la session locale
// Utile après unlink_partner, update_pseudo, ou join_couple
function v2RefreshSession(){
  var s = v2LoadSession();
  if(!s || !s.user || !s.user.id) return Promise.resolve(null);
  
  return fetch(SB2_URL + '/rest/v1/v2_users?id=eq.' + s.user.id + '&select=id,pseudo,role,couple_id', {
    headers: sb2Headers()
  })
  .then(function(r){ return r.ok ? r.json() : null; })
  .then(function(rows){
    if(!Array.isArray(rows) || !rows.length) return null;
    var freshUser = rows[0];
    
    // Récupérer le partner_pseudo si couple_id existe
    if(freshUser.couple_id){
      return fetch(SB2_URL + '/rest/v1/v2_users?couple_id=eq.' + freshUser.couple_id + '&id=neq.' + freshUser.id + '&select=pseudo&limit=1', {
        headers: sb2Headers()
      })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(partnerRows){
        freshUser.partner_pseudo = (Array.isArray(partnerRows) && partnerRows.length > 0) ? partnerRows[0].pseudo : null;
        
        // Récupérer le couple_code
        return fetch(SB2_URL + '/rest/v1/v2_couples?id=eq.' + freshUser.couple_id + '&select=code&limit=1', {
          headers: sb2Headers()
        })
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(coupleRows){
          freshUser.couple_code = (Array.isArray(coupleRows) && coupleRows.length > 0) ? coupleRows[0].code : null;
          
          // Mettre à jour la session locale
          s.user = freshUser;
          localStorage.setItem(V2_SESSION_KEY, JSON.stringify(s));
          return freshUser;
        });
      });
    } else {
      // Pas de couple — mettre à jour quand même
      freshUser.partner_pseudo = null;
      freshUser.couple_code = null;
      s.user = freshUser;
      localStorage.setItem(V2_SESSION_KEY, JSON.stringify(s));
      return freshUser;
    }
  })
  .catch(function(){ return null; });
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
// ── Toutes les images et uploads utilisent désormais SB2_URL uniquement (R4 — V1 purgé) ──

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
// startDate est sur window pour être modifiable depuis app-account.js (acSaveStartDate)
// Valeur par défaut hardcodée — sera écrasée dès que loadCoupleConfig() charge la vraie date
window.startDate = new Date('2024-10-29T00:00:00');
function updateCounter() {
  var d = Math.floor((new Date() - window.startDate) / 1000);
  document.getElementById('cnt-days').textContent  = Math.floor(d / 86400);
  document.getElementById('cnt-hours').textContent = String(Math.floor((d % 86400) / 3600)).padStart(2,'0');
  document.getElementById('cnt-mins').textContent  = String(Math.floor((d % 3600) / 60)).padStart(2,'0');
  document.getElementById('cnt-secs').textContent  = String(d % 60).padStart(2,'0');
}
// ✅ OPT v3.8 : updateCounter smart — pause si page cachée ou Skyjo actif
(function(){
  var _iv = null;
  function startCounter(){
    if(_iv) return;
    updateCounter();
    _iv = setInterval(updateCounter, 1000);
  }
  function stopCounter(){
    if(!_iv) return;
    clearInterval(_iv); _iv = null;
  }
  // Pause quand page cachée (écran noir, autre app)
  document.addEventListener('visibilitychange', function(){
    if(document.hidden){ stopCounter(); } else { startCounter(); }
  });
  // API pour Skyjo : suspend le counter pendant la partie (compteur hors écran)
  window._counterSuspend = stopCounter;
  window._counterResume  = startCounter;
  // Démarrage
  startCounter();
})();

// ── THEME ── (version consolidée — R3 : persistence localStorage + home btn + haptic)
function applyThemeToggle() {
  // Lecture du thème actuel
  var html = document.documentElement;
  var currentTheme = html.getAttribute('data-theme') || 'warm';
  
  // Basculer entre warm et dark
  var newTheme = currentTheme === 'warm' ? 'dark' : 'warm';
  
  // Appliquer le nouveau thème
  html.setAttribute('data-theme', newTheme);
  
  // Stocker en localStorage
  try {
    localStorage.setItem('yam_theme_v2', newTheme);
  } catch(e) {}
  
  // Mettre à jour toutes les icônes de thème
  var icons = document.querySelectorAll('#themeIcon, .themeIconInner, #v2LoginThemeIcon');
  icons.forEach(function(icon) {
    if (newTheme === 'warm') {
      // Mode warm → afficher lune (pour passer au dark)
      icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>';
    } else {
      // Mode dark → afficher soleil (pour passer au warm)
      icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
    }
  });
  
  // Animation flash sur tous les boutons thème
  document.querySelectorAll('[onclick*="applyThemeToggle"]').forEach(function(btn) {
    btn.style.transform = 'scale(0.85) rotate(15deg)';
    setTimeout(function() {
      btn.style.transform = '';
    }, 300);
  });
  
  // Toast de confirmation
  if (typeof showToast === 'function') {
    showToast(newTheme === 'warm' ? 'Thème Warm ☀️' : 'Thème Dark 🌙', 'success', 1500);
  }
}

// ── Restauration du thème au chargement ──
(function(){
  var saved = localStorage.getItem('jayana_theme');
  if(saved === 'light' && !document.body.classList.contains('light')){
    document.body.classList.add('light');
    document.documentElement.classList.add('light');
    // Corrige la safe zone dès le chargement sans attendre le DOM
    var themeMeta = document.getElementById('themeColorMeta');
    if(themeMeta) themeMeta.setAttribute('content', '#f9e8f0');
    document.addEventListener('DOMContentLoaded', function(){
      var btn = document.getElementById('themeToggle');
      if(btn) btn.textContent = '🌙';
      var fBtn = document.getElementById('floatingThemeBtn');
      if(fBtn) fBtn.textContent = '🌙';
      // themeToggleHome utilise uniquement SVG, pas de textContent nécessaire
      ['qz','gv','dm','pm','home'].forEach(function(prefix){
        var moon = document.getElementById(prefix+'ThemeIconMoon');
        var sun  = document.getElementById(prefix+'ThemeIconSun');
        if(moon) moon.style.display = 'none';
        if(sun)  sun.style.display  = '';
      });
      // Sync icône bouton thème login (thème clair au démarrage → soleil visible)
      var _v2Moon = document.getElementById('v2LoginIconMoon');
      var _v2Sun  = document.getElementById('v2LoginIconSun');
      if(_v2Moon) _v2Moon.style.display = 'none';
      if(_v2Sun)  _v2Sun.style.display  = '';
    });
  }
})();

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
  // Bloquer le scroll arrière-plan
  if(typeof window._nousBlockScroll === 'function') window._nousBlockScroll();
  else {
    var nousWrap = document.getElementById('nousContentWrapper');
    if(nousWrap) nousWrap.style.overflow = 'hidden';
    window._yamScrollLocked = true;
  }
  document.getElementById('descEditModal').classList.add('open');
  setTimeout(function(){ if(input) input.focus(); }, 100);
}
function descEditClose(){
  document.getElementById('descEditModal').classList.remove('open');
  // Restaurer le scroll arrière-plan
  if(typeof window._nousUnblockScroll === 'function') window._nousUnblockScroll();
  else {
    var nousWrap = document.getElementById('nousContentWrapper');
    if(nousWrap) nousWrap.style.overflow = '';
    window._yamScrollLocked = false;
  }
  _descEditCallback = null;
}
function descEditSave(){
  var val = document.getElementById('descEditInput').value.trim();
  document.getElementById('descEditModal').classList.remove('open');
  // Restaurer le scroll arrière-plan (identique à descEditClose)
  if(typeof window._nousUnblockScroll === 'function') window._nousUnblockScroll();
  else {
    var nousWrap = document.getElementById('nousContentWrapper');
    if(nousWrap) nousWrap.style.overflow = '';
    window._yamScrollLocked = false;
  }
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
    var coupleId = null;
    try {
      var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
      if (s && s.user) coupleId = s.user.couple_id;
    } catch(e) {}
    if (!coupleId) return;
    fetch(SB2_URL + '/rest/v1/' + PRESENCE_TABLE, {
      method: 'POST',
      headers: sb2Headers({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({
        player:     profile,
        couple_id:  coupleId,
        last_seen:  new Date().toISOString(),
        is_playing: isAudioPlaying()
      })
    }).catch(function(){});
  }

  /* Lit l'état de l'autre et met à jour le point */
  function presencePoll() {
    var profile = getProfile();
    if (!profile) return;
    var coupleId = null;
    try {
      var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
      if (s && s.user) coupleId = s.user.couple_id;
    } catch(e) {}
    if (!coupleId) return;
    var other = profile === 'girl' ? 'boy' : 'girl';
    fetch(SB2_URL + '/rest/v1/' + PRESENCE_TABLE + '?couple_id=eq.' + coupleId + '&player=eq.' + other + '&select=last_seen,is_playing', {
      headers: sb2Headers()
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
      // ✅ FIX v3.7 : aussi suspendre presencePoll quand page cachée
      clearInterval(_pollIv); _pollIv = null;
    } else {
      presencePush(); // signal immédiat au retour
      _heartbeatIv = setInterval(presencePush, HEARTBEAT_MS);
      // ✅ FIX v3.7 : reprendre presencePoll seulement si Skyjo n'est pas actif
      // (pendant Skyjo, app-multiplayer.js gère la présence)
      if (!window._skyjoPresenceActive) {
        presencePoll();
        _pollIv = setInterval(presencePoll, POLL_MS);
      }
    }
  });

  /* ✅ FIX v3.7 : Suspension du presencePoll de core pendant Skyjo
     Pendant une partie Skyjo, app-multiplayer.js fait déjà des polls de présence
     toutes les 4s → le poll core toutes les 10s est un doublon inutile */
  window._corePresenceSuspend = function() {
    window._skyjoPresenceActive = true;
    clearInterval(_pollIv); _pollIv = null;
  };
  window._corePresenceResume = function() {
    window._skyjoPresenceActive = false;
    if (!_pollIv) {
      presencePoll();
      _pollIv = setInterval(presencePoll, POLL_MS);
    }
  };

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


// ═══════════════════════════════════════════════
// INITIALISATION THÈME v2 au chargement
// ═══════════════════════════════════════════════
(function() {
  var savedTheme = 'warm';
  try {
    savedTheme = localStorage.getItem('yam_theme_v2') || 'warm';
  } catch(e) {}
  
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  // Mettre à jour les icônes au chargement
  setTimeout(function() {
    var icons = document.querySelectorAll('#themeIcon, .themeIconInner, #v2LoginThemeIcon');
    icons.forEach(function(icon) {
      if (savedTheme === 'warm') {
        icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>';
      } else {
        icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
      }
    });
  }, 100);
})();
