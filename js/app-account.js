// ═══════════════════════════════════════════════════════════
// app-account.js — Mon Compte · Paramètres couple · Migration v2

/* ════════════════════════════════════════════
   PATCH GLOBAL : rediriger toutes les requêtes
   vers les tables v2_ sur SB2 (nouveau projet)
   ─────────────────────────────────────────────
   Ce fichier DOIT être chargé APRÈS app-core.js
   et AVANT les autres modules.
════════════════════════════════════════════ */

// ── Helpers Supabase V2 (nouveau projet) ──
function sb2Headers(extra){
  return Object.assign({
    'apikey': SB2_KEY,
    'Authorization': 'Bearer ' + SB2_KEY,
    'Content-Type': 'application/json'
  }, extra || {});
}

function sb2Get(table, params){
  var url = SB2_URL + '/rest/v1/' + table + '?' + (params || 'order=created_at.desc');
  return fetch(url, { headers: sb2Headers() }).then(function(r){ return r.json(); });
}

function sb2Post(table, body, extra){
  return fetch(SB2_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: sb2Headers(Object.assign({ 'Prefer': 'return=representation' }, extra || {})),
    body: JSON.stringify(body)
  }).then(function(r){ return r.json(); });
}

function sb2Patch(table, filter, body){
  return fetch(SB2_URL + '/rest/v1/' + table + '?' + filter, {
    method: 'PATCH',
    headers: sb2Headers({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(body)
  }).then(function(r){ return r.json(); });
}

function sb2Delete(table, filter){
  return fetch(SB2_URL + '/rest/v1/' + table + '?' + filter, {
    method: 'DELETE',
    headers: sb2Headers()
  });
}

function sb2Upsert(table, body, onConflict){
  var prefer = 'resolution=merge-duplicates,return=representation';
  var url = SB2_URL + '/rest/v1/' + table;
  if(onConflict) url += '?on_conflict=' + onConflict;
  return fetch(url, {
    method: 'POST',
    headers: sb2Headers({ 'Prefer': prefer }),
    body: JSON.stringify(body)
  }).then(function(r){ return r.json(); });
}

// ── Override sbGet/sbPost/sbPatch/sbDelete pour pointer vers v2_ ──
// Mapping ancien nom → nouveau nom v2
var _V2_TABLE_MAP = {
  'dm_messages':      'v2_dm_messages',
  'dm_typing':        'v2_dm_typing',
  'memo_notes':       'v2_memo_notes',
  'memo_todos':       'v2_memo_todos',
  'like_counters':    'v2_like_counters',
  'presence':         'v2_presence',
  'photo_descs':      'v2_photo_descs',
  'song_plays':       'v2_song_plays',
  'favorites':        'v2_favorites',
  'moods':            'v2_moods',
  'suggestion_songs': 'v2_suggestion_songs',
  'game_scores':      'v2_game_scores',
  'skyjo_games':      'v2_skyjo_games',
  'skyjo_presence':   'v2_skyjo_presence',
  'pranks':           'v2_pranks',
  'now_listening':    'v2_now_listening'
};

function _mapTable(name){
  return _V2_TABLE_MAP[name] || name;
}

// Patch sbGet
var _origSbGet = window.sbGet || sbGet;
window.sbGet = function(table, params){
  var mapped = _mapTable(table);
  var url = SB2_URL + '/rest/v1/' + mapped + '?' + (params || 'order=created_at.desc');
  return fetch(url, { headers: sb2Headers() }).then(function(r){ return r.json(); });
};

// Patch sbPost
var _origSbPost = window.sbPost || sbPost;
window.sbPost = function(table, body){
  var mapped = _mapTable(table);
  return fetch(SB2_URL + '/rest/v1/' + mapped, {
    method: 'POST',
    headers: sb2Headers({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(body)
  }).then(function(r){ return r.json(); });
};

// Patch sbPatch
var _origSbPatch = window.sbPatch || sbPatch;
window.sbPatch = function(table, id, body){
  var mapped = _mapTable(table);
  return fetch(SB2_URL + '/rest/v1/' + mapped + '?id=eq.' + id, {
    method: 'PATCH',
    headers: sb2Headers({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(body)
  }).then(function(r){ return r.json(); });
};

// Patch sbDelete
var _origSbDelete = window.sbDelete || sbDelete;
window.sbDelete = function(table, id){
  var mapped = _mapTable(table);
  return fetch(SB2_URL + '/rest/v1/' + mapped + '?id=eq.' + id, {
    method: 'DELETE',
    headers: sb2Headers()
  });
};

// Patch sbHeaders — utiliser maintenant SB2_KEY pour les uploads Storage
// On garde l'ancien sbHeaders pour la compatibilité mais on le remplace par sb2Headers
window.sbHeaders = function(extra){
  return sb2Headers(extra);
};

// Patch présence — pointe vers v2_presence sur SB2
// Override _presencePush/_presencePoll en attendant le rechargement
(function patchPresence(){
  var _origPush = window._presencePush;
  var _origPoll = window._presencePoll;

  window._presencePush = function(){
    var profile = getProfile();
    if(!profile) return;
    // Envoi heartbeat sur v2_presence
    fetch(SB2_URL + '/rest/v1/v2_presence', {
      method: 'POST',
      headers: sb2Headers({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({
        player: profile,
        last_seen: new Date().toISOString(),
        is_playing: (function(){
          var p=false; document.querySelectorAll('audio').forEach(function(a){if(!a.paused)p=true;}); return p;
        })()
      })
    }).catch(function(){});
  };

  window._presencePoll = function(){
    var profile = getProfile();
    if(!profile) return;
    var other = profile === 'girl' ? 'boy' : 'girl';
    fetch(SB2_URL + '/rest/v1/v2_presence?player=eq.' + other + '&select=last_seen,is_playing', {
      headers: sb2Headers()
    })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(rows){
      if(!Array.isArray(rows)||!rows.length){
        var dot = document.getElementById('presenceDot'); if(dot) dot.classList.remove('visible'); return;
      }
      var row = rows[0];
      var elapsed = Date.now() - new Date(row.last_seen).getTime();
      var threshold = row.is_playing ? 60000 : 20000;
      var dot = document.getElementById('presenceDot');
      if(dot){
        var avOther = document.getElementById('profileAvatarOther');
        if(avOther && avOther.classList.contains('visible')){
          dot.classList.toggle('visible', elapsed < threshold);
        } else {
          dot.classList.remove('visible');
        }
      }
      if(window.yamSyncMood) window.yamSyncMood();
    }).catch(function(){});
  };
})();


/* ════════════════════════════════════════════
   COUPLE CONFIG — Chargement depuis v2_couples
   Contenu personnalisable : startDate, reasons,
   postits, timeline, etc.
════════════════════════════════════════════ */

window.YAM_COUPLE = {
  start_date: '2024-10-29T00:00:00',
  reasons: null,   // null = garder les raisons codées en dur
  postits: null,
  timeline: null,
  loaded: false
};

function loadCoupleConfig(){
  var u = v2GetUser();
  if(!u || !u.couple_id) return Promise.resolve(null);

  return fetch(SB2_URL + '/rest/v1/v2_couples?id=eq.' + encodeURIComponent(u.couple_id) + '&select=*', {
    headers: sb2Headers()
  })
  .then(function(r){ return r.ok ? r.json() : []; })
  .then(function(rows){
    if(!Array.isArray(rows) || !rows.length) return null;
    var cfg = rows[0];
    if(cfg.start_date) window.YAM_COUPLE.start_date = cfg.start_date;
    if(cfg.reasons && Array.isArray(cfg.reasons))   window.YAM_COUPLE.reasons  = cfg.reasons;
    if(cfg.postits && Array.isArray(cfg.postits))   window.YAM_COUPLE.postits  = cfg.postits;
    if(cfg.timeline && Array.isArray(cfg.timeline)) window.YAM_COUPLE.timeline = cfg.timeline;
    window.YAM_COUPLE.loaded = true;
    window.YAM_COUPLE._raw = cfg;

    // Mettre à jour le compteur avec la vraie date
    if(typeof startDate !== 'undefined') {
      window.startDate = new Date(window.YAM_COUPLE.start_date);
    }
    // Mettre à jour le texte "Depuis le..."
    var sinceEl = document.querySelector('.counter-since');
    if(sinceEl && cfg.start_date){
      var d = new Date(cfg.start_date);
      var opts = { day:'numeric', month:'long', year:'numeric' };
      var label = d.toLocaleDateString('fr-FR', opts);
      sinceEl.textContent = '💑 Depuis le ' + label;
    }

    // Injecter timeline si configurée
    if(cfg.timeline && Array.isArray(cfg.timeline)) renderTimeline(cfg.timeline);

    return cfg;
  })
  .catch(function(){ return null; });
}

function renderTimeline(items){
  var wrap = document.getElementById('tlWrap');
  if(!wrap || !items.length) return;
  wrap.innerHTML = '<div class="tl-line"></div>';
  items.forEach(function(item){
    var el = document.createElement('div');
    el.className = 'tl-item';
    el.innerHTML =
      '<div class="tl-dot"></div>' +
      '<div class="tl-date">' + escHtml(item.date || '') + '</div>' +
      '<div class="tl-card"><h3>' + escHtml(item.title || '') + '</h3><p>' + escHtml(item.text || '') + '</p></div>';
    wrap.appendChild(el);
  });
}

// Charger la config couple après connexion
document.addEventListener('DOMContentLoaded', function(){
  if(v2GetUser()) loadCoupleConfig();
});
var _acOrigSetProfile = window.setProfile;
window.setProfile = function(g){
  if(_acOrigSetProfile) _acOrigSetProfile.apply(this, arguments);
  setTimeout(loadCoupleConfig, 500);
};


/* ════════════════════════════════════════════
   MON COMPTE — Modal HTML + CSS + Logique
════════════════════════════════════════════ */

(function(){

  // ── Injecter le HTML de la modal ──
  var modalHTML = '' +
  '<div id="accountModal" style="display:none;position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.7);' +
  'backdrop-filter:blur(6px);align-items:flex-end;justify-content:center;padding:0;">' +
  '<div id="accountSheet" style="width:100%;max-width:480px;background:var(--s1);border-radius:24px 24px 0 0;' +
  'border-top:1px solid var(--border);padding:0 0 calc(env(safe-area-inset-bottom,0px) + 20px);' +
  'max-height:92vh;overflow-y:auto;font-family:\'DM Sans\',sans-serif;transition:transform 0.3s cubic-bezier(.4,0,.2,1);">' +

    // Handle
    '<div style="display:flex;justify-content:center;padding:12px 0 8px;">' +
    '<div style="width:40px;height:4px;border-radius:2px;background:var(--border);"></div></div>' +

    // Header
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 20px 16px;">' +
    '<div style="font-family:\'Playfair Display\',serif;font-size:20px;font-weight:700;color:var(--text);">Mon Compte</div>' +
    '<button onclick="closeAccountModal()" style="width:32px;height:32px;border-radius:50%;background:var(--s2);border:none;color:var(--muted);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>' +
    '</div>' +

    // Infos utilisateur
    '<div style="padding:0 20px 20px;">' +

      // Avatar + nom
      '<div style="display:flex;align-items:center;gap:14px;background:var(--s2);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:16px;">' +
        '<div id="acAvatarEmoji" style="font-size:38px;width:56px;height:56px;background:var(--s1);border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--border);">👤</div>' +
        '<div>' +
          '<div id="acPseudo" style="font-size:17px;font-weight:700;color:var(--text);">—</div>' +
          '<div id="acRoleBadge" style="font-size:11px;font-weight:600;margin-top:3px;padding:3px 9px;border-radius:20px;display:inline-block;">—</div>' +
        '</div>' +
      '</div>' +

      // Code couple
      '<div style="margin-bottom:12px;">' +
        '<div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Code couple</div>' +
        '<div style="display:flex;align-items:center;gap:10px;background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:12px 14px;">' +
          '<span id="acCoupleCode" style="font-size:18px;font-weight:800;letter-spacing:3px;color:var(--text);flex:1;">—</span>' +
          '<button onclick="acCopyCode()" id="acCopyBtn" style="background:var(--green);color:#000;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:\'DM Sans\',sans-serif;">Copier</button>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--muted);margin-top:5px;">Partage ce code à ton/ta partenaire pour lier vos comptes</div>' +
      '</div>' +

      // Partenaire
      '<div style="margin-bottom:12px;">' +
        '<div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Partenaire</div>' +
        '<div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:12px 14px;">' +
          '<span id="acPartnerName" style="font-size:15px;font-weight:600;color:var(--text);">—</span>' +
        '</div>' +
      '</div>' +

      // Date de début du couple
      '<div style="margin-bottom:16px;">' +
        '<div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Date de début du couple</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          '<input type="date" id="acStartDate" style="flex:1;background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:11px 14px;color:var(--text);font-size:14px;font-family:\'DM Sans\',sans-serif;outline:none;" />' +
          '<button onclick="acSaveStartDate()" style="background:var(--green);color:#000;border:none;border-radius:10px;padding:11px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:\'DM Sans\',sans-serif;white-space:nowrap;">Enregistrer</button>' +
        '</div>' +
        '<div id="acStartDateMsg" style="font-size:11px;margin-top:5px;color:var(--green);min-height:16px;"></div>' +
      '</div>' +

      // Séparateur
      '<div style="height:1px;background:var(--border);margin:0 -4px 16px;"></div>' +

      // Changer mot de passe
      '<div style="margin-bottom:16px;">' +
        '<div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Changer de mot de passe</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
          '<input type="password" id="acOldPwd" placeholder="Mot de passe actuel" autocomplete="current-password" ' +
          'style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text);font-size:14px;font-family:\'DM Sans\',sans-serif;outline:none;" />' +
          '<input type="password" id="acNewPwd" placeholder="Nouveau mot de passe" autocomplete="new-password" ' +
          'style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text);font-size:14px;font-family:\'DM Sans\',sans-serif;outline:none;" />' +
          '<input type="password" id="acConfirmPwd" placeholder="Confirmer le nouveau mot de passe" autocomplete="new-password" ' +
          'style="background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text);font-size:14px;font-family:\'DM Sans\',sans-serif;outline:none;" />' +
          '<button onclick="acChangePwd()" style="background:var(--green);color:#000;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:\'DM Sans\',sans-serif;">Changer le mot de passe</button>' +
          '<div id="acPwdMsg" style="font-size:12px;text-align:center;min-height:18px;color:var(--green);"></div>' +
        '</div>' +
      '</div>' +

      // Séparateur
      '<div style="height:1px;background:var(--border);margin:0 -4px 16px;"></div>' +

      // Bouton déconnexion
      '<button onclick="nativeLogout()" style="width:100%;padding:13px;background:rgba(224,85,85,0.1);border:1.5px solid rgba(224,85,85,0.4);border-radius:12px;color:#e05555;font-size:14px;font-weight:700;font-family:\'DM Sans\',sans-serif;cursor:pointer;">🔓 Se déconnecter</button>' +

    '</div>' + // /padding
  '</div>' + // /accountSheet
  '</div>'; // /accountModal

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // ── Fermer en cliquant en dehors ──
  document.getElementById('accountModal').addEventListener('click', function(e){
    if(e.target === this) closeAccountModal();
  });

})();


// ── Ouvrir la modal Mon Compte ──
window.openAccountModal = function(){
  var modal = document.getElementById('accountModal');
  if(!modal) return;
  var sheet = document.getElementById('accountSheet');
  modal.style.display = 'flex';
  // Animation entrée
  sheet.style.transform = 'translateY(100%)';
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      sheet.style.transform = 'translateY(0)';
    });
  });

  // Fermer le popup profil si ouvert
  var pp = document.getElementById('profilePopup');
  if(pp) pp.classList.remove('open');

  // Remplir les infos
  var u = v2GetUser();
  if(!u) return;

  var girlName = u.role === 'girl' ? (u.pseudo||'Elle') : (u.partner_pseudo||'Elle');
  var boyName  = u.role === 'boy'  ? (u.pseudo||'Lui')  : (u.partner_pseudo||'Lui');

  document.getElementById('acAvatarEmoji').textContent = u.role === 'girl' ? '👧' : '👦';
  document.getElementById('acPseudo').textContent      = escHtml(u.pseudo || '—');

  var badge = document.getElementById('acRoleBadge');
  if(u.role === 'girl'){
    badge.textContent = '👧 Elle';
    badge.style.background = 'rgba(232,121,160,0.15)';
    badge.style.color = '#e879a0';
  } else {
    badge.textContent = '👦 Lui';
    badge.style.background = 'rgba(91,156,246,0.15)';
    badge.style.color = '#5b9cf6';
  }

  document.getElementById('acPartnerName').textContent = u.role === 'girl'
    ? escHtml(boyName + (u.partner_pseudo ? '' : ' (pas encore lié)'))
    : escHtml(girlName + (u.partner_pseudo ? '' : ' (pas encore lié)'));

  // Code couple
  var code = u.couple_code || u.couple_id || '—';
  document.getElementById('acCoupleCode').textContent = code;

  // Date de début
  var dateVal = (window.YAM_COUPLE && window.YAM_COUPLE.start_date) || '2024-10-29T00:00:00';
  var d = new Date(dateVal);
  document.getElementById('acStartDate').value = d.toISOString().split('T')[0];

  // Vider les champs mdp
  ['acOldPwd','acNewPwd','acConfirmPwd'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value = '';
  });
  document.getElementById('acPwdMsg').textContent = '';
  document.getElementById('acPwdMsg').style.color = 'var(--green)';
};

window.closeAccountModal = function(){
  var sheet = document.getElementById('accountSheet');
  var modal = document.getElementById('accountModal');
  if(!sheet || !modal) return;
  sheet.style.transform = 'translateY(100%)';
  setTimeout(function(){ modal.style.display = 'none'; }, 300);
};

// ── Copier le code couple ──
window.acCopyCode = function(){
  var code = document.getElementById('acCoupleCode').textContent;
  var btn  = document.getElementById('acCopyBtn');
  if(!code || code === '—') return;
  if(navigator.clipboard){
    navigator.clipboard.writeText(code).catch(function(){});
  } else {
    // Fallback : sélection + copie
    var tmp = document.createElement('input');
    tmp.value = code;
    document.body.appendChild(tmp);
    tmp.select(); document.execCommand('copy');
    document.body.removeChild(tmp);
  }
  btn.textContent = '✅ Copié !';
  setTimeout(function(){ btn.textContent = 'Copier'; }, 2000);
};

// ── Enregistrer la date de début ──
window.acSaveStartDate = function(){
  var val = document.getElementById('acStartDate').value;
  var msg = document.getElementById('acStartDateMsg');
  if(!val){ msg.textContent = '⚠️ Choisis une date'; msg.style.color = '#e05555'; return; }
  var u = v2GetUser();
  if(!u || !u.couple_id){ msg.textContent = '⚠️ Couple non lié'; msg.style.color = '#e05555'; return; }

  msg.textContent = '⏳ Enregistrement...';
  msg.style.color = 'var(--muted)';

  var isoDate = val + 'T00:00:00';

  sb2Upsert('v2_couples', { id: u.couple_id, start_date: isoDate }, 'id')
  .then(function(res){
    if(res && res.error){
      msg.textContent = '❌ Erreur : ' + res.error;
      msg.style.color = '#e05555';
      return;
    }
    msg.textContent = '✅ Date mise à jour !';
    msg.style.color = 'var(--green)';
    // Mettre à jour localement
    window.YAM_COUPLE.start_date = isoDate;
    if(typeof startDate !== 'undefined') window.startDate = new Date(isoDate);
    // Mettre à jour le texte compteur
    var sinceEl = document.querySelector('.counter-since');
    if(sinceEl){
      var d = new Date(isoDate);
      sinceEl.textContent = '💑 Depuis le ' + d.toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
    }
    setTimeout(function(){ msg.textContent = ''; }, 3000);
  })
  .catch(function(err){
    msg.textContent = '❌ Erreur réseau';
    msg.style.color = '#e05555';
  });
};

// ── Changer le mot de passe ──
window.acChangePwd = function(){
  var oldPwd     = document.getElementById('acOldPwd').value;
  var newPwd     = document.getElementById('acNewPwd').value;
  var confirmPwd = document.getElementById('acConfirmPwd').value;
  var msg        = document.getElementById('acPwdMsg');

  if(!oldPwd || !newPwd || !confirmPwd){
    msg.textContent = '⚠️ Remplis tous les champs';
    msg.style.color = '#e05555'; return;
  }
  if(newPwd.length < 6){
    msg.textContent = '⚠️ Mot de passe trop court (6 min)';
    msg.style.color = '#e05555'; return;
  }
  if(newPwd !== confirmPwd){
    msg.textContent = '⚠️ Les mots de passe ne correspondent pas';
    msg.style.color = '#e05555'; return;
  }

  var u = v2GetUser();
  if(!u){ msg.textContent = '⚠️ Non connecté'; msg.style.color = '#e05555'; return; }

  msg.textContent = '⏳ Modification en cours...';
  msg.style.color = 'var(--muted)';

  // Passer par l'Edge Function auth-v2 avec action "change_password"
  v2Auth('change_password', {
    pseudo:       u.pseudo,
    old_password: oldPwd,
    new_password: newPwd
  })
  .then(function(data){
    if(data.error){
      msg.textContent = '❌ ' + data.error;
      msg.style.color = '#e05555';
    } else {
      msg.textContent = '✅ Mot de passe changé avec succès !';
      msg.style.color = 'var(--green)';
      ['acOldPwd','acNewPwd','acConfirmPwd'].forEach(function(id){
        var el = document.getElementById(id); if(el) el.value = '';
      });
      setTimeout(function(){ msg.textContent = ''; }, 4000);
    }
  })
  .catch(function(){
    msg.textContent = '❌ Erreur réseau';
    msg.style.color = '#e05555';
  });
};


/* ════════════════════════════════════════════
   INJECTION BOUTON "Mon Compte" dans le popup profil
════════════════════════════════════════════ */
(function(){
  function injectAccountBtn(){
    var pp = document.getElementById('profilePopup');
    if(!pp || document.getElementById('ppBtnAccount')) return;

    // Créer le bouton Mon Compte
    var btn = document.createElement('div');
    btn.id = 'ppBtnAccount';
    btn.className = 'profile-popup-btn';
    btn.style.cssText = 'display:none;'; // caché par défaut, visible si connecté
    btn.innerHTML = '<span style="margin-right:6px;">⚙️</span> Mon Compte';
    btn.onclick = function(){ openAccountModal(); };

    // Insérer avant le bouton déconnexion
    var logoutBtn = document.getElementById('ppBtnLogout');
    if(logoutBtn){
      pp.insertBefore(btn, logoutBtn);
    } else {
      pp.appendChild(btn);
    }
  }

  // Tenter l'injection au DOMContentLoaded
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', injectAccountBtn);
  } else {
    injectAccountBtn();
  }

  // Re-injecter si app-nav.js modifie le popup après
  setTimeout(injectAccountBtn, 800);

  // Afficher/masquer le bouton selon si on est connecté
  var _acOrigSetProfile2 = window.setProfile;
  window.setProfile = function(g){
    if(_acOrigSetProfile2) _acOrigSetProfile2.apply(this, arguments);
    setTimeout(function(){
      var btn = document.getElementById('ppBtnAccount');
      if(btn) btn.style.display = v2GetUser() ? '' : 'none';
    }, 200);
  };

  // Si déjà connecté au chargement
  setTimeout(function(){
    var btn = document.getElementById('ppBtnAccount');
    if(btn && v2GetUser()) btn.style.display = '';
  }, 600);

})();


/* ════════════════════════════════════════════
   SYNC RAISONS & POST-ITS depuis v2_couples
   (override des tableaux codés en dur dans app-love.js)
════════════════════════════════════════════ */

// Attendre que app-love.js soit chargé avant d'override
window.addEventListener('load', function(){
  if(!window.YAM_COUPLE.loaded) return;

  // Override reasons si configuré dans Supabase
  if(window.YAM_COUPLE.reasons && Array.isArray(window.YAM_COUPLE.reasons)){
    if(typeof reasons !== 'undefined'){
      reasons.length = 0;
      window.YAM_COUPLE.reasons.forEach(function(r){ reasons.push(r); });
    }
  }

  // Override postitData si configuré dans Supabase
  if(window.YAM_COUPLE.postits && Array.isArray(window.YAM_COUPLE.postits)){
    if(typeof postitData !== 'undefined'){
      postitData.length = 0;
      window.YAM_COUPLE.postits.forEach(function(p){ postitData.push(p); });
      if(typeof buildStack === 'function') buildStack();
    }
  }
});

// ─── loadCoupleConfig patch — call applyYamCouple after loading ───
var _origLoadCouple = loadCoupleConfig;
loadCoupleConfig = function(){
  return _origLoadCouple.apply(this, arguments).then(function(cfg){
    if(cfg) applyYamCouple();
    return cfg;
  });
};

function applyYamCouple(){
  if(!window.YAM_COUPLE || !window.YAM_COUPLE.loaded) return;
  if(window.YAM_COUPLE.reasons && Array.isArray(window.YAM_COUPLE.reasons)){
    if(typeof window.reloadReasons === 'function'){
      window.reloadReasons(window.YAM_COUPLE.reasons);
    }
  }
  if(window.YAM_COUPLE.postits && Array.isArray(window.YAM_COUPLE.postits)){
    if(typeof postitData !== 'undefined'){
      postitData.length = 0;
      window.YAM_COUPLE.postits.forEach(function(p){ postitData.push(p); });
      if(typeof buildStack === 'function') buildStack();
    }
  }
}
