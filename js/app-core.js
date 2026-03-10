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
var SB2_EDGE_PUSH  = SB2_URL + '/functions/v1/push-notify';
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

// Échappe les caractères HTML spéciaux (XSS protection)
function escHtml(str){
  if(str==null) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
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
      if(data.token && data.user){
        v2SaveSession(data);
        if(window.yamRegisterPush) yamRegisterPush(); // activer les notifs push
        return { ok: true, user: data.user };
      }
      return { ok: false, error: 'Réponse invalide' };
    });
}

// Inscription : pseudo + password + role
function v2Register(pseudo, password, role){
  return v2Auth('register', { pseudo: pseudo, password: password, role: role })
    .then(function(data){
      if(data.error) return { ok: false, error: data.error };
      if(data.token && data.user){
        v2SaveSession(data);
        if(window.yamRegisterPush) yamRegisterPush(); // activer les notifs push
        return { ok: true, user: data.user };
      }
      return { ok: false, error: 'Réponse invalide' };
    });
}

// Test de connexion (session valide ?)
function v2Ping(){
  return v2Auth('ping', {});
}

// Reset password : génération d'un code à 6 chiffres + envoi par notif push
function v2ResetPassword(pseudo){
  return v2Auth('reset_password', { pseudo: pseudo })
    .then(function(data){
      if(data.error) return { ok: false, error: data.error };
      return { ok: true };
    });
}

// Confirm reset : valide le code et change le mot de passe
function v2ConfirmReset(pseudo, code, newPassword){
  return v2Auth('confirm_reset', { pseudo: pseudo, code: code, new_password: newPassword })
    .then(function(data){
      if(data.error) return { ok: false, error: data.error };
      if(data.token && data.user){
        v2SaveSession(data);
        return { ok: true };
      }
      return { ok: false, error: 'Réponse invalide' };
    });
}

// Update password : change le mot de passe (nécessite l'ancien)
function v2UpdatePassword(oldPassword, newPassword){
  return v2Auth('update_password', { old_password: oldPassword, new_password: newPassword })
    .then(function(data){
      if(data.error) return { ok: false, error: data.error };
      return { ok: true };
    });
}

// Update pseudo : change le pseudo de l'utilisateur connecté
function v2UpdatePseudo(newPseudo){
  return v2Auth('update_pseudo', { new_pseudo: newPseudo })
    .then(function(data){
      if(data.error) return { ok: false, error: data.error };
      return { ok: true };
    });
}

// Créer un couple : génère un code unique et met à jour l'utilisateur
function v2CreateCouple(){
  return v2Auth('create_couple', {})
    .then(function(data){
      if(data.error) return { ok: false, error: data.error };
      if(data.couple && data.couple.code){
        return { ok: true, code: data.couple.code };
      }
      return { ok: false, error: 'Réponse invalide' };
    });
}

// Rejoindre un couple : entre le code et lie l'utilisateur au couple
function v2JoinCouple(code){
  return v2Auth('join_couple', { code: code })
    .then(function(data){
      if(data.error) return { ok: false, error: data.error };
      return { ok: true };
    });
}

// Unlink partner : supprime le lien de couple pour l'utilisateur actuel
function v2UnlinkPartner(){
  return v2Auth('unlink_partner', {})
    .then(function(data){
      if(data.error) return { ok: false, error: data.error };
      return { ok: true };
    });
}


/* ════════════════════════════════════════════
   THEME — Gestion automatique clair/sombre
   ════════════════════════════════════════════ */
function toggleTheme() {
  var html = document.documentElement;
  html.classList.toggle('dark');
  // Sauvegarder le choix pour le prochain reload
  localStorage.setItem('yamTheme', html.classList.contains('dark') ? 'dark' : 'light');
}
// Alias utilisé dans index.html
window.applyThemeToggle = toggleTheme;

function initTheme() {
  var saved = localStorage.getItem('yamTheme');
  var html = document.documentElement;

  if (saved === 'dark') {
    html.classList.add('dark');
  } else if (saved === 'light') {
    html.classList.remove('dark');
  } else {
    // Auto — détection système
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      html.classList.add('dark');
    }
  }

  // Écouter les changements du système
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
      var html = document.documentElement;
      // Respecter le choix manuel si déjà défini
      if (localStorage.getItem('yamTheme')) return;
      if (e.matches) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
    });
  }
}

// Lancer au chargement
initTheme();


/* ════════════════════════════════════════════
   UTILITAIRES
   ════════════════════════════════════════════ */

// Formater une date
function formatDate(d) {
  if (!d) return '';
  if (typeof d === 'string') d = new Date(d);
  var opts = { day: '2-digit', month: '2-digit', year: 'numeric' };
  return d.toLocaleDateString('fr-FR', opts);
}

// Formater un timestamp en "il y a X"
function timeAgo(timestamp) {
  if (!timestamp) return '';
  var date = new Date(timestamp);
  var seconds = Math.floor((new Date() - date) / 1000);
  var intervals = [
    { label: 'an', seconds: 31536000 },
    { label: 'mois', seconds: 2592000 },
    { label: 'jour', seconds: 86400 },
    { label: 'heure', seconds: 3600 },
    { label: 'minute', seconds: 60 }
  ];
  for (var i = 0; i < intervals.length; i++) {
    var interval = Math.floor(seconds / intervals[i].seconds);
    if (interval >= 1) {
      return 'Il y a ' + interval + ' ' + intervals[i].label + (interval > 1 ? 's' : '');
    }
  }
  return 'À l\'instant';
}

// Générer un UUID simple
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0;
    var v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Escape HTML
function escapeHTML(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Détecter iOS
function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

// Vérifier si on est dans une PWA
function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}


/* ════════════════════════════════════════════
   HEARTBEAT PRÉSENCE — Système de présence temps réel
   Envoie régulièrement un heartbeat pour signaler que l'utilisateur est actif
   Lit la présence du partenaire pour afficher le point vert
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

// ── Push Notifications ────────────────────────────────────────────────────────
// yamRegisterPush()  — demande permission + crée subscription VAPID + l'envoie en base
// yamPushNotify()    — envoie une notif push au partenaire via Edge Function push-notify
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️  Remplacer par ta vraie clé publique VAPID (générée avec : npx web-push generate-vapid-keys)
var _VAPID_PUBLIC_KEY = 'BNZesKdT92j-aS0IIeuH6ea0sc927o3QjFve3Z2fIKFAB_TPaciM1MaUPFMTuYMOCrzJH3rrGbKvJsy0CReZvYU';

function _urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData = atob(base64);
  var output  = new Uint8Array(rawData.length);
  for (var i = 0; i < rawData.length; i++) { output[i] = rawData.charCodeAt(i); }
  return output;
}

async function _yamSendSubToServer(sub) {
  var user = v2GetUser();
  if (!user) return;
  var subJSON = sub.toJSON();
  try {
    await fetch(SB2_EDGE_PUSH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-secret': SB2_APP_SECRET,
        'Authorization': 'Bearer ' + SB2_KEY
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
    console.error('[Push] _yamSendSubToServer error:', e);
  }
}

window.yamRegisterPush = async function() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    var reg = await navigator.serviceWorker.ready;
    var existingSub = await reg.pushManager.getSubscription();
    if (existingSub) { await _yamSendSubToServer(existingSub); return; }

    var permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    var sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlBase64ToUint8Array(_VAPID_PUBLIC_KEY),
    });
    await _yamSendSubToServer(sub);
    console.log('[Push] Subscription enregistrée ✓');
  } catch (e) {
    console.error('[Push] yamRegisterPush error:', e);
  }
};

window.yamPushNotify = async function(opts) {
  // opts: { title, body, tag, data }
  var user = v2GetUser();
  if (!user) return;
  var targetProfile = user.role === 'girl' ? 'boy' : 'girl';
  try {
    await fetch(SB2_EDGE_PUSH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-secret': SB2_APP_SECRET,
        'Authorization': 'Bearer ' + SB2_KEY
      },
      body: JSON.stringify({
        action:         'notify',
        couple_id:      user.couple_id,
        target_profile: targetProfile,
        title:          opts.title || 'YAM 💕',
        body:           opts.body  || '',
        tag:            opts.tag   || 'yam-notif',
        data:           Object.assign({ url: '/yam-app/' }, opts.data || {}),
      }),
    });
  } catch (e) {
    console.error('[Push] yamPushNotify error:', e);
  }
};
