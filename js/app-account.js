// ═══════════════════════════════════════════════════════════
// app-account.js — Login UI · Mon Compte · Migration v2
// Doit être chargé APRÈS app-core.js et AVANT les autres modules
// ═══════════════════════════════════════════════════════════

// sb2Headers, sb2Fetch, sb2Post, sb2Patch, sb2Delete, sb2Upsert → définis dans app-core.js


/* ════════════════════════════════════════════
   PATCH GLOBAL — Rediriger sbGet/sbPost/sbPatch/sbDelete
   vers les tables v2_ sur SB2
════════════════════════════════════════════ */
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
function _mapTable(name){ return _V2_TABLE_MAP[name] || name; }

window.sbGet = function(table, params){
  var mapped = _mapTable(table);
  var url = SB2_URL + '/rest/v1/' + mapped + '?' + (params || 'order=created_at.desc');
  return fetch(url, { headers: sb2Headers() }).then(function(r){ return r.json(); });
};
window.sbPost = function(table, body){
  var mapped = _mapTable(table);
  return fetch(SB2_URL + '/rest/v1/' + mapped, {
    method: 'POST',
    headers: sb2Headers({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(body)
  }).then(function(r){ return r.json(); });
};
window.sbPatch = function(table, id, body){
  var mapped = _mapTable(table);
  return fetch(SB2_URL + '/rest/v1/' + mapped + '?id=eq.' + id, {
    method: 'PATCH',
    headers: sb2Headers({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(body)
  }).then(function(r){ return r.json(); });
};
window.sbDelete = function(table, id){
  var mapped = _mapTable(table);
  return fetch(SB2_URL + '/rest/v1/' + mapped + '?id=eq.' + id, {
    method: 'DELETE',
    headers: sb2Headers()
  });
};
window.sbHeaders = function(extra){ return sb2Headers(extra); };

// Présence gérée entièrement dans app-core.js (R2 — doublon supprimé)


/* ════════════════════════════════════════════
   LOGIN UI — v2SwitchTab, v2SelectRole,
   v2DoLogin, v2DoRegister, v2DoJoin
════════════════════════════════════════════ */
var _v2Role = 'girl'; // rôle sélectionné dans le formulaire inscription/rejoindre

window.v2ShowLogin = function(){
  var el = document.getElementById('v2LoginOverlay');
  if(el) el.style.display = 'flex';
};
window.v2HideLogin = function(){
  var el = document.getElementById('v2LoginOverlay');
  if(el) el.style.display = 'none';
};

window.v2SwitchTab = function(tab){
  ['login','register','join'].forEach(function(t){
    var form = document.getElementById('v2Form' + t.charAt(0).toUpperCase() + t.slice(1));
    var btn  = document.getElementById('v2Tab'  + t.charAt(0).toUpperCase() + t.slice(1));
    if(form) form.style.display = (t === tab) ? '' : 'none';
    if(btn)  btn.classList.toggle('active', t === tab);
  });
};

window.v2SelectRole = function(role){
  _v2Role = role;
  var girl = document.getElementById('v2RoleGirl');
  var boy  = document.getElementById('v2RoleBoy');
  if(girl) girl.classList.toggle('selected', role === 'girl');
  if(boy)  boy.classList.toggle('selected', role === 'boy');
};

function _v2SetMsg(id, text, isError){
  var el = document.getElementById(id);
  if(!el) return;
  el.textContent = text;
  el.style.display = text ? '' : 'none';
  el.style.color = isError ? '#e05555' : 'var(--green)';
}

function _v2AfterLogin(result, msgId){
  if(!result.ok){
    _v2SetMsg(msgId, '❌ ' + (result.error || 'Erreur'), true);
    return;
  }
  window.v2HideLogin();
  // Déclencher l'init app
  var u = v2GetUser();
  if(u){
    localStorage.setItem('jayana_profile', u.role);
    if(window.setProfile) window.setProfile(u.role);
    if(window.loadCoupleConfig) window.loadCoupleConfig();
  }
}

window.v2DoLogin = function(){
  var pseudo   = (document.getElementById('v2LoginPseudo').value   || '').trim();
  var password =  document.getElementById('v2LoginPassword').value  || '';
  var msgId    = 'v2LoginMsg';
  // Créer/assurer le message div
  var msgEl = document.getElementById(msgId);
  if(!msgEl){
    msgEl = document.createElement('div');
    msgEl.id = msgId;
    msgEl.style.cssText = 'font-size:13px;margin-top:8px;text-align:center;';
    var form = document.getElementById('v2FormLogin');
    if(form) form.appendChild(msgEl);
  }
  if(!pseudo || !password){
    _v2SetMsg(msgId, '⚠️ Remplis tous les champs', true); return;
  }
  _v2SetMsg(msgId, '⏳ Connexion...', false);
  v2Login(pseudo, password).then(function(res){ _v2AfterLogin(res, msgId); });
};

window.v2DoRegister = function(){
  var pseudo   = (document.getElementById('v2RegPseudo').value   || '').trim();
  var password =  document.getElementById('v2RegPassword').value  || '';
  var msgId    = 'v2RegInfo';
  if(!pseudo || !password){
    _v2SetMsg(msgId, '⚠️ Remplis tous les champs', true); return;
  }
  if(password.length < 6){
    _v2SetMsg(msgId, '⚠️ Mot de passe trop court (6 min)', true); return;
  }
  _v2SetMsg(msgId, '⏳ Création du compte...', false);
  v2Register(pseudo, password, _v2Role).then(function(res){
    if(res.ok && res.data && res.data.user && res.data.user.couple_code){
      _v2SetMsg(msgId, '✅ Compte créé ! Ton code couple : ' + res.data.user.couple_code, false);
      setTimeout(function(){ _v2AfterLogin(res, msgId); }, 2000);
    } else {
      _v2AfterLogin(res, msgId);
    }
  });
};

window.v2DoJoin = function(){
  var pseudo   = (document.getElementById('v2JoinPseudo').value   || '').trim();
  var password =  document.getElementById('v2JoinPassword').value  || '';
  var code     = (document.getElementById('v2JoinCode').value      || '').trim().toUpperCase();
  var msgId    = 'v2JoinMsg';
  // Créer/assurer le message div
  var msgEl = document.getElementById(msgId);
  if(!msgEl){
    msgEl = document.createElement('div');
    msgEl.id = msgId;
    msgEl.style.cssText = 'font-size:13px;margin-top:8px;text-align:center;';
    var form = document.getElementById('v2FormJoin');
    if(form) form.appendChild(msgEl);
  }
  if(!pseudo || !password || !code){
    _v2SetMsg(msgId, '⚠️ Remplis tous les champs', true); return;
  }
  if(password.length < 6){
    _v2SetMsg(msgId, '⚠️ Mot de passe trop court (6 min)', true); return;
  }
  _v2SetMsg(msgId, '⏳ Connexion au couple...', false);
  v2Join(pseudo, password, _v2Role, code).then(function(res){ _v2AfterLogin(res, msgId); });
};

// Afficher l'écran login si pas de session au démarrage
document.addEventListener('DOMContentLoaded', function(){
  if(!v2GetUser()){
    window.v2ShowLogin();
    // Sélectionner "girl" par défaut dans les formulaires
    window.v2SelectRole('girl');
  } else {
    window.v2HideLogin();
  }
});


/* ════════════════════════════════════════════
   COUPLE CONFIG — Chargement depuis v2_couples
════════════════════════════════════════════ */
window.YAM_COUPLE = {
  start_date: null,
  reasons: null,
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

    // Mettre à jour le compteur
    // Toujours mettre à jour window.startDate (déclaré dans app-core.js)
    window.startDate = new Date(window.YAM_COUPLE.start_date);
    if(typeof updateCounter === 'function') updateCounter();
    // Mettre à jour le texte "Depuis le..."
    var sinceEl = document.querySelector('.counter-since');
    if(sinceEl && cfg.start_date){
      var d = new Date(cfg.start_date);
      sinceEl.textContent = '💑 Depuis le ' + d.toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
    }
    if(cfg.timeline && Array.isArray(cfg.timeline)) renderTimeline(cfg.timeline);
    return cfg;
  })
  .then(function(cfg){
    if(cfg) applyYamCouple();
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

function applyYamCouple(){
  if(!window.YAM_COUPLE || !window.YAM_COUPLE.loaded) return;
  if(window.YAM_COUPLE.reasons && Array.isArray(window.YAM_COUPLE.reasons)){
    if(typeof window.reloadReasons === 'function') window.reloadReasons(window.YAM_COUPLE.reasons);
    else if(typeof reasons !== 'undefined'){
      reasons.length = 0;
      window.YAM_COUPLE.reasons.forEach(function(r){ reasons.push(r); });
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

// Charger config couple après connexion
document.addEventListener('DOMContentLoaded', function(){
  if(v2GetUser()) loadCoupleConfig();
  // Charger l'avatar photo dans la topbar si déjà connecté
  var u = v2GetUser();
  if(u) setTimeout(function(){ if(window._acLoadAvatarTopbarOnStart) window._acLoadAvatarTopbarOnStart(u); }, 800);
});

var _acOrigSetProfile = window.setProfile;
window.setProfile = function(g){
  if(_acOrigSetProfile) _acOrigSetProfile.apply(this, arguments);
  setTimeout(loadCoupleConfig, 500);
  // Charger l'avatar photo dans la topbar après connexion
  setTimeout(function(){
    var u = v2GetUser();
    if(u && window._acLoadAvatarTopbarOnStart) window._acLoadAvatarTopbarOnStart(u);
  }, 900);
};


/* ════════════════════════════════════════════
   MON COMPTE — Modal HTML + CSS + Logique
════════════════════════════════════════════ */
(function(){
  var modalHTML =
  '<div id="accountModal" style="display:none;position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.7);' +
  'backdrop-filter:blur(6px);align-items:flex-end;justify-content:center;padding:0;">' +
  '<div id="accountSheet" data-scrollable="1" style="width:100%;max-width:480px;background:var(--s1);border-radius:24px 24px 0 0;' +
  'border-top:1px solid var(--border);' +
  'padding-top:env(safe-area-inset-top,0px);' +
  'padding-bottom:calc(env(safe-area-inset-bottom,0px) + 24px);' +
  'max-height:calc(92dvh - env(safe-area-inset-top,0px));' +
  'overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;' +
  'font-family:\'DM Sans\',sans-serif;transition:transform 0.3s cubic-bezier(.4,0,.2,1);">' +

    // Handle
    '<div style="display:flex;justify-content:center;padding:12px 0 8px;">' +
    '<div style="width:40px;height:4px;border-radius:2px;background:var(--border);"></div></div>' +

    // Header
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:0 20px 16px;">' +
    '<div style="font-family:\'Playfair Display\',serif;font-size:20px;font-weight:700;color:var(--text);">Mon Compte</div>' +
    '<button onclick="closeAccountModal()" style="width:32px;height:32px;border-radius:50%;background:var(--s2);border:none;color:var(--muted);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>' +
    '</div>' +

    '<div style="padding:0 20px 20px;">' +

      // Avatar + nom
      '<div style="display:flex;align-items:center;gap:14px;background:var(--s2);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:16px;">' +
        // Avatar cliquable pour upload photo
        '<div style="position:relative;flex-shrink:0;">' +
          '<div id="acAvatarWrap" onclick="acTriggerAvatarUpload()" style="font-size:38px;width:56px;height:56px;background:var(--s1);border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--border);overflow:hidden;cursor:pointer;">' +
            '<img id="acAvatarImg" src="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:none;" />' +
            '<span id="acAvatarEmoji" style="font-size:38px;line-height:1;">👤</span>' +
          '</div>' +
          '<div style="position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;background:var(--green);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;border:1.5px solid var(--s2);cursor:pointer;" onclick="acTriggerAvatarUpload()">📷</div>' +
          '<div id="acDeleteAvatarBtn" style="display:none;position:absolute;top:-4px;left:-4px;width:18px;height:18px;background:#e05555;border-radius:50%;align-items:center;justify-content:center;font-size:9px;border:1.5px solid var(--s2);cursor:pointer;" onclick="acDeleteAvatar()" title="Supprimer la photo">✕</div>' +
        '</div>' +
        '<input type="file" id="acAvatarInput" accept="image/*" style="display:none;" onchange="acHandleAvatarUpload(this)" />' +
        '<div style="flex:1;min-width:0;">' +
          // Pseudo éditable inline
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<div id="acPseudo" style="font-size:17px;font-weight:700;color:var(--text);">—</div>' +
            '<button onclick="acToggleEditPseudo()" id="acEditPseudoBtn" title="Modifier le pseudo" style="background:none;border:none;cursor:pointer;padding:2px 4px;color:var(--muted);font-size:13px;line-height:1;">✏️</button>' +
          '</div>' +
          // Champ édition pseudo (masqué par défaut)
          '<div id="acEditPseudoRow" style="display:none;margin-top:6px;gap:6px;flex-direction:column;">' +
            '<input type="text" id="acNewPseudoInput" maxlength="20" placeholder="Nouveau pseudo" ' +
            'style="background:var(--s1);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-size:13px;font-family:\'DM Sans\',sans-serif;outline:none;flex:1;width:100%;" />' +
            '<div style="display:flex;gap:4px;margin-top:4px;">' +
              '<button onclick="acSavePseudo()" style="background:var(--green);color:#000;border:none;border-radius:7px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:\'DM Sans\',sans-serif;">✓</button>' +
              '<button onclick="acCancelEditPseudo()" style="background:var(--s2);color:var(--muted);border:1px solid var(--border);border-radius:7px;padding:5px 10px;font-size:12px;cursor:pointer;font-family:\'DM Sans\',sans-serif;">✕</button>' +
            '</div>' +
            '<div id="acPseudoMsg" style="font-size:11px;margin-top:3px;min-height:14px;color:var(--green);"></div>' +
          '</div>' +
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
        '<div style="background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
          '<span id="acPartnerName" style="font-size:15px;font-weight:600;color:var(--text);">—</span>' +
          '<button id="acUnlinkBtn" onclick="acConfirmUnlink()" title="Délier ce partenaire" style="display:none;background:rgba(224,85,85,0.1);border:1.5px solid rgba(224,85,85,0.35);border-radius:8px;padding:4px 10px;font-size:12px;color:#e05555;cursor:pointer;font-family:\'DM Sans\',sans-serif;font-weight:600;flex-shrink:0;">✕ Délier</button>' +
        '</div>' +
        '<div id="acUnlinkMsg" style="font-size:11px;margin-top:5px;min-height:14px;color:#e05555;"></div>' +
        // Confirmation inline (masquée par défaut)
        '<div id="acUnlinkConfirm" style="display:none;margin-top:8px;background:rgba(224,85,85,0.08);border:1px solid rgba(224,85,85,0.3);border-radius:10px;padding:12px 14px;">' +
          '<div style="font-size:13px;color:var(--text);margin-bottom:10px;font-weight:600;">⚠️ Délier ce partenaire ?</div>' +
          '<div style="font-size:12px;color:var(--muted);margin-bottom:10px;">Cette action ne supprime pas les données. Vous pourrez vous relire plus tard.</div>' +
          '<div style="display:flex;gap:8px;">' +
            '<button onclick="acDoUnlink()" style="flex:1;background:#e05555;color:#fff;border:none;border-radius:8px;padding:9px;font-size:13px;font-weight:700;cursor:pointer;font-family:\'DM Sans\',sans-serif;">Oui, délier</button>' +
            '<button onclick="acCancelUnlink()" style="flex:1;background:var(--s2);color:var(--muted);border:1px solid var(--border);border-radius:8px;padding:9px;font-size:13px;cursor:pointer;font-family:\'DM Sans\',sans-serif;">Non, annuler</button>' +
          '</div>' +
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

      // Lier partenaire (visible seulement si pas encore lié)
      '<div id="acLinkSection" style="margin-bottom:12px;">' +
        '<div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Lier un partenaire</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
          '<input type="text" id="acLinkCode" placeholder="Code couple du partenaire" maxlength="36" ' +
          'style="flex:1;background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text);font-size:13px;font-family:\'DM Sans\',sans-serif;outline:none;text-transform:uppercase;letter-spacing:1px;" />' +
          '<button onclick="acLinkPartner()" style="background:var(--green);color:#000;border:none;border-radius:10px;padding:11px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:\'DM Sans\',sans-serif;white-space:nowrap;">Lier</button>' +
        '</div>' +
        '<div id="acLinkMsg" style="font-size:11px;margin-top:5px;min-height:16px;color:var(--green);"></div>' +
      '</div>' +

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

      '<div style="height:1px;background:var(--border);margin:0 -4px 16px;"></div>' +

      // Déconnexion
      '<button onclick="nativeLogout()" style="width:100%;padding:13px;background:rgba(224,85,85,0.1);border:1.5px solid rgba(224,85,85,0.4);border-radius:12px;color:#e05555;font-size:14px;font-weight:700;font-family:\'DM Sans\',sans-serif;cursor:pointer;">🔓 Se déconnecter</button>' +

    '</div>' +
  '</div>' +
  '</div>';

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  document.getElementById('accountModal').addEventListener('click', function(e){
    if(e.target === this) closeAccountModal();
  });
})();


window.openAccountModal = function(){
  var modal = document.getElementById('accountModal');
  if(!modal) return;
  var sheet = document.getElementById('accountSheet');
  modal.style.display = 'flex';
  sheet.style.transform = 'translateY(100%)';
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      sheet.style.transform = 'translateY(0)';
    });
  });

  var pp = document.getElementById('profilePopup');
  if(pp) pp.classList.remove('open');

  // CORRECTION : Rafraîchir la session pour avoir les données les plus récentes
  if(window.v2RefreshSession){
    v2RefreshSession().then(function(u){
      if(!u) u = v2GetUser(); // Fallback si refresh échoue
      _populateAccountModal(u);
    });
  } else {
    var u = v2GetUser();
    _populateAccountModal(u);
  }
};

// Fonction interne pour remplir le modal avec les données utilisateur
function _populateAccountModal(u){
  if(!u) return;

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

  var partnerPseudo = u.partner_pseudo || null;
  document.getElementById('acPartnerName').textContent = partnerPseudo
    ? escHtml(partnerPseudo)
    : '(pas encore lié)';

  // Bouton délier : visible seulement si partenaire lié
  var unlinkBtn = document.getElementById('acUnlinkBtn');
  if(unlinkBtn) unlinkBtn.style.display = partnerPseudo ? '' : 'none';
  var unlinkConfirm = document.getElementById('acUnlinkConfirm');
  if(unlinkConfirm) unlinkConfirm.style.display = 'none';
  var unlinkMsg = document.getElementById('acUnlinkMsg');
  if(unlinkMsg) unlinkMsg.textContent = '';

  var linkSec = document.getElementById('acLinkSection');
  if(linkSec){
    linkSec.style.display = partnerPseudo ? 'none' : '';
    var li = document.getElementById('acLinkCode'); if(li) li.value = '';
    var lm = document.getElementById('acLinkMsg');  if(lm) lm.textContent = '';
  }

  // Reset pseudo edit
  var editRow = document.getElementById('acEditPseudoRow');
  if(editRow) editRow.style.display = 'none';
  var pseudoMsg = document.getElementById('acPseudoMsg');
  if(pseudoMsg) pseudoMsg.textContent = '';

  // Avatar photo : charger depuis storage si disponible
  _acLoadAvatarPhoto(u);

  var code = u.couple_code || u.couple_id || '—';
  document.getElementById('acCoupleCode').textContent = code;

  var dateVal = (window.YAM_COUPLE && window.YAM_COUPLE.start_date) || '2024-10-29T00:00:00';
  document.getElementById('acStartDate').value = dateVal.split('T')[0];

  ['acOldPwd','acNewPwd','acConfirmPwd'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value = '';
  });
  document.getElementById('acPwdMsg').textContent = '';
  document.getElementById('acStartDateMsg').textContent = '';
}

window.closeAccountModal = function(){
  var sheet = document.getElementById('accountSheet');
  var modal = document.getElementById('accountModal');
  if(!sheet || !modal) return;
  sheet.style.transform = 'translateY(100%)';
  setTimeout(function(){ modal.style.display = 'none'; }, 300);
};

window.acCopyCode = function(){
  var code = document.getElementById('acCoupleCode').textContent;
  var btn  = document.getElementById('acCopyBtn');
  if(!code || code === '—') return;
  if(navigator.clipboard){
    navigator.clipboard.writeText(code).catch(function(){});
  } else {
    var tmp = document.createElement('input');
    tmp.value = code; document.body.appendChild(tmp);
    tmp.select(); document.execCommand('copy');
    document.body.removeChild(tmp);
  }
  btn.textContent = '✅ Copié !';
  setTimeout(function(){ btn.textContent = 'Copier'; }, 2000);
};

window.acSaveStartDate = function(){
  var val = document.getElementById('acStartDate').value;
  var msg = document.getElementById('acStartDateMsg');
  if(!val){ msg.textContent = '⚠️ Choisis une date'; msg.style.color = '#e05555'; return; }
  var u = v2GetUser();
  if(!u || !u.couple_id){ msg.textContent = '⚠️ Couple non lié'; msg.style.color = '#e05555'; return; }

  msg.textContent = '⏳ Enregistrement...'; msg.style.color = 'var(--muted)';
  var isoDate = val + 'T00:00:00';

  // Utiliser fetch direct avec service key n'est pas possible côté client.
  // On passe par l'Edge Function pour le PATCH avec privilèges.
  v2Auth('save_start_date', { couple_id: u.couple_id, start_date: isoDate })
  .then(function(res){
    if(res && res.error){
      msg.textContent = '❌ Erreur sauvegarde'; msg.style.color = '#e05555'; return;
    }
    msg.textContent = '✅ Date mise à jour !'; msg.style.color = 'var(--green)';
    window.YAM_COUPLE.start_date = isoDate;
    window.startDate = new Date(isoDate);
    var sinceEl = document.querySelector('.counter-since');
    if(sinceEl){
      var d = new Date(isoDate);
      sinceEl.textContent = '💑 Depuis le ' + d.toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
    }
    // Forcer la mise à jour du compteur
    if(typeof updateCounter === 'function') updateCounter();
    setTimeout(function(){ msg.textContent = ''; }, 3000);
  })
  .catch(function(){ msg.textContent = '❌ Erreur réseau'; msg.style.color = '#e05555'; });
};

window.acChangePwd = function(){
  var oldPwd     = document.getElementById('acOldPwd').value;
  var newPwd     = document.getElementById('acNewPwd').value;
  var confirmPwd = document.getElementById('acConfirmPwd').value;
  var msg        = document.getElementById('acPwdMsg');

  if(!oldPwd || !newPwd || !confirmPwd){
    msg.textContent = '⚠️ Remplis tous les champs'; msg.style.color = '#e05555'; return;
  }
  if(newPwd.length < 6){
    msg.textContent = '⚠️ Mot de passe trop court (6 min)'; msg.style.color = '#e05555'; return;
  }
  if(newPwd !== confirmPwd){
    msg.textContent = '⚠️ Les mots de passe ne correspondent pas'; msg.style.color = '#e05555'; return;
  }
  var u = v2GetUser();
  if(!u){ msg.textContent = '⚠️ Non connecté'; msg.style.color = '#e05555'; return; }

  msg.textContent = '⏳ Modification en cours...'; msg.style.color = 'var(--muted)';

  // Passer par l'Edge Function auth-v2 avec action change_password
  v2Auth('change_password', {
    pseudo: u.pseudo,
    old_password: oldPwd,
    new_password: newPwd
  }).then(function(data){
    if(data && data.error){
      msg.textContent = '❌ ' + (data.error || 'Mot de passe actuel incorrect');
      msg.style.color = '#e05555';
    } else {
      msg.textContent = '✅ Mot de passe changé !'; msg.style.color = 'var(--green)';
      ['acOldPwd','acNewPwd','acConfirmPwd'].forEach(function(id){
        var el = document.getElementById(id); if(el) el.value = '';
      });
      setTimeout(function(){ msg.textContent = ''; }, 4000);
    }
  }).catch(function(){
    msg.textContent = '❌ Erreur réseau'; msg.style.color = '#e05555';
  });
};

window.acLinkPartner = function(){
  var code = (document.getElementById('acLinkCode').value || '').trim().toUpperCase();
  var msg  = document.getElementById('acLinkMsg');
  if(!code){ msg.textContent = '⚠️ Entre le code couple'; msg.style.color = '#e05555'; return; }
  var u = v2GetUser();
  if(!u){ msg.textContent = '⚠️ Non connecté'; msg.style.color = '#e05555'; return; }
  if(u.partner_pseudo){ msg.textContent = '✅ Déjà lié à ' + escHtml(u.partner_pseudo); msg.style.color = 'var(--green)'; return; }

  msg.textContent = '⏳ Liaison en cours...'; msg.style.color = 'var(--muted)';

  v2Auth('join_couple', { user_id: u.id, couple_code: code, token: (v2LoadSession()||{}).token })
  .then(function(data){
    if(data && data.error){
      msg.textContent = '❌ ' + data.error; msg.style.color = '#e05555';
    } else {
      msg.textContent = '✅ Compte lié avec succès !'; msg.style.color = 'var(--green)';
      
      // CORRECTION : Recharger la session pour avoir les données fraîches
      if(window.v2RefreshSession){
        v2RefreshSession().then(function(freshUser){
          if(freshUser){
            var el = document.getElementById('acPartnerName');
            if(el) el.textContent = freshUser.partner_pseudo || '(lié)';
            var ls = document.getElementById('acLinkSection');
            if(ls) ls.style.display = 'none';
            var unlinkBtn = document.getElementById('acUnlinkBtn');
            if(unlinkBtn) unlinkBtn.style.display = '';
            
            // Forcer un rechargement de la présence avec le nouveau couple
            if(window._presencePush) window._presencePush();
            
            // Recharger la config du couple
            if(window.loadCoupleConfig) window.loadCoupleConfig();
          }
        });
      } else {
        // Fallback
        var s = v2LoadSession();
        if(s && s.user){
          if(data.couple_id) s.user.couple_id = data.couple_id;
          if(data.partner_pseudo) s.user.partner_pseudo = data.partner_pseudo;
          localStorage.setItem(typeof V2_SESSION_KEY !== 'undefined' ? V2_SESSION_KEY : 'yam_v2_session', JSON.stringify(s));
        }
        var el = document.getElementById('acPartnerName');
        if(el) el.textContent = data.partner_pseudo || '(lié)';
        var ls = document.getElementById('acLinkSection');
        if(ls) ls.style.display = 'none';
        var unlinkBtn = document.getElementById('acUnlinkBtn');
        if(unlinkBtn) unlinkBtn.style.display = '';
      }
    }
  })
  .catch(function(){ msg.textContent = '❌ Erreur réseau'; msg.style.color = '#e05555'; });
};

/* ── Délier un partenaire ── */
window.acConfirmUnlink = function(){
  var confirm = document.getElementById('acUnlinkConfirm');
  if(confirm) confirm.style.display = '';
};
window.acCancelUnlink = function(){
  var confirm = document.getElementById('acUnlinkConfirm');
  if(confirm) confirm.style.display = 'none';
};
window.acDoUnlink = function(){
  var msg = document.getElementById('acUnlinkMsg');
  var u = v2GetUser();
  if(!u){ msg.textContent = '⚠️ Non connecté'; return; }
  msg.textContent = '⏳ Déliaison en cours...';
  v2Auth('unlink_partner', { user_id: u.id })
  .then(function(data){
    if(data && data.error){
      msg.textContent = '❌ ' + data.error;
    } else {
      msg.textContent = '✅ Partenaire délié.';
      
      // CORRECTION : Recharger les données fraîches depuis le serveur
      if(window.v2RefreshSession){
        v2RefreshSession().then(function(freshUser){
          if(freshUser){
            // Mettre à jour l'affichage
            var el = document.getElementById('acPartnerName');
            if(el) el.textContent = '(pas encore lié)';
            var codeEl = document.getElementById('acCoupleCode');
            if(codeEl && freshUser.couple_code) codeEl.textContent = freshUser.couple_code;
            var unlinkBtn = document.getElementById('acUnlinkBtn');
            if(unlinkBtn) unlinkBtn.style.display = 'none';
            var unlinkConfirm = document.getElementById('acUnlinkConfirm');
            if(unlinkConfirm) unlinkConfirm.style.display = 'none';
            var ls = document.getElementById('acLinkSection');
            if(ls) ls.style.display = '';
            
            // Forcer un rechargement de la présence avec le nouveau couple_id
            if(window._presencePush) window._presencePush();
            
            setTimeout(function(){ msg.textContent = ''; }, 3000);
          }
        });
      } else {
        // Fallback si v2RefreshSession n'existe pas (ne devrait pas arriver)
        var s = v2LoadSession();
        if(s && s.user){
          s.user.partner_pseudo = null;
          if(data.new_couple_code){
            s.user.couple_code = data.new_couple_code;
            var codeEl = document.getElementById('acCoupleCode');
            if(codeEl) codeEl.textContent = data.new_couple_code;
          }
          localStorage.setItem('yam_v2_session', JSON.stringify(s));
        }
        var el = document.getElementById('acPartnerName');
        if(el) el.textContent = '(pas encore lié)';
        var unlinkBtn = document.getElementById('acUnlinkBtn');
        if(unlinkBtn) unlinkBtn.style.display = 'none';
        var unlinkConfirm = document.getElementById('acUnlinkConfirm');
        if(unlinkConfirm) unlinkConfirm.style.display = 'none';
        var ls = document.getElementById('acLinkSection');
        if(ls) ls.display = '';
        setTimeout(function(){ msg.textContent = ''; }, 3000);
      }
    }
  })
  .catch(function(){ msg.textContent = '❌ Erreur réseau'; });
};

/* ── Modifier le pseudo ── */
window.acToggleEditPseudo = function(){
  var row = document.getElementById('acEditPseudoRow');
  var inp = document.getElementById('acNewPseudoInput');
  var u = v2GetUser();
  if(!row) return;
  if(row.style.display === 'none'){
    row.style.display = 'flex';
    if(inp){ inp.value = u ? (u.pseudo || '') : ''; inp.focus(); }
  } else {
    row.style.display = 'none';
  }
};
window.acCancelEditPseudo = function(){
  var row = document.getElementById('acEditPseudoRow');
  if(row) row.style.display = 'none';
  var msg = document.getElementById('acPseudoMsg');
  if(msg) msg.textContent = '';
};
window.acSavePseudo = function(){
  var inp = document.getElementById('acNewPseudoInput');
  var msg = document.getElementById('acPseudoMsg');
  var newPseudo = (inp ? inp.value : '').trim();
  if(!newPseudo || newPseudo.length < 2){
    msg.textContent = '⚠️ Pseudo trop court (2 min)'; msg.style.color = '#e05555'; return;
  }
  if(newPseudo.length > 20){
    msg.textContent = '⚠️ Pseudo trop long (20 max)'; msg.style.color = '#e05555'; return;
  }
  var u = v2GetUser();
  if(!u){ msg.textContent = '⚠️ Non connecté'; msg.style.color = '#e05555'; return; }
  msg.textContent = '⏳ Modification...'; msg.style.color = 'var(--muted)';
  v2Auth('update_pseudo', { user_id: u.id, new_pseudo: newPseudo })
  .then(function(data){
    if(data && data.error){
      msg.textContent = '❌ ' + data.error; msg.style.color = '#e05555';
    } else {
      msg.textContent = '✅ Pseudo mis à jour !'; msg.style.color = 'var(--green)';
      
      // CORRECTION : Recharger la session pour propager le changement
      if(window.v2RefreshSession){
        v2RefreshSession().then(function(freshUser){
          if(freshUser){
            // Mettre à jour l'affichage
            var pseudoEl = document.getElementById('acPseudo');
            if(pseudoEl) pseudoEl.textContent = escHtml(freshUser.pseudo);
            var row = document.getElementById('acEditPseudoRow');
            setTimeout(function(){
              msg.textContent = '';
              if(row) row.style.display = 'none';
            }, 2000);
          }
        });
      } else {
        // Fallback
        var s = v2LoadSession();
        if(s && s.user){ s.user.pseudo = newPseudo; localStorage.setItem('yam_v2_session', JSON.stringify(s)); }
        var pseudoEl = document.getElementById('acPseudo');
        if(pseudoEl) pseudoEl.textContent = escHtml(newPseudo);
        var row = document.getElementById('acEditPseudoRow');
        setTimeout(function(){
          msg.textContent = '';
          if(row) row.style.display = 'none';
        }, 2000);
      }
    }
  })
  .catch(function(){ msg.textContent = '❌ Erreur réseau'; msg.style.color = '#e05555'; });
};

/* ── Avatar photo de profil ── */
var _AVATAR_BUCKET = 'images';

function _acLoadAvatarPhoto(u){
  if(!u) return;
  var folder = 'avatars';
  var path = folder + '/' + u.id + '.jpg';
  var url = SB2_URL + '/storage/v1/object/public/' + _AVATAR_BUCKET + '/' + path + '?t=' + Date.now();
  var img = document.getElementById('acAvatarImg');
  var emoji = document.getElementById('acAvatarEmoji');
  if(!img) return;
  var probe = new Image();
  probe.onload = function(){
    img.src = url; img.style.display = '';
    if(emoji) emoji.style.display = 'none';
    // Mettre à jour l'avatar principal dans la topbar
    _acSyncAvatarTopbar(url, u.role);
    // ✅ Afficher le bouton suppression si une photo existe
    var delBtn = document.getElementById('acDeleteAvatarBtn');
    if(delBtn) delBtn.style.display = 'flex';
  };
  probe.onerror = function(){
    img.style.display = 'none';
    if(emoji){ emoji.style.display = ''; emoji.textContent = u.role === 'girl' ? '👧' : '👦'; }
    // Pas de photo → cacher le bouton suppression
    var delBtn = document.getElementById('acDeleteAvatarBtn');
    if(delBtn) delBtn.style.display = 'none';
  };
  probe.src = url;
}

function _acSyncAvatarTopbar(url, role){
  // Alimenter le cache central
  if(window._yamRealAvatars) window._yamRealAvatars[role] = url;
  // ✅ FIX — mettre à jour uniquement le src de l'img existante, sans toucher au positionnement
  var mainEmoji = document.getElementById('profileAvatarEmoji');
  if(mainEmoji) mainEmoji.src = url;
}

// ✅ FIX — Charge l'avatar du partenaire depuis Supabase Storage et propage partout
window._acLoadPartnerAvatar = function(){
  var u = (typeof v2GetUser === 'function') ? v2GetUser() : null;
  if(!u || !u.couple_id) return;
  fetch(SB2_URL + '/rest/v1/v2_users?couple_id=eq.' + u.couple_id + '&id=neq.' + u.id + '&select=id,role&limit=1',
    { headers: sb2Headers() })
  .then(function(r){ return r.ok ? r.json() : []; })
  .then(function(rows){
    if(!rows || !rows.length) return;
    var partner = rows[0];
    var url = SB2_URL + '/storage/v1/object/public/images/avatars/' + partner.id + '.jpg?t=' + Date.now();
    var probe = new Image();
    probe.onload = function(){
      // Alimenter le cache central
      if(window._yamRealAvatars) window._yamRealAvatars[partner.role] = url;
      // ✅ FIX placement — mettre à jour UNIQUEMENT le src de l'img existante
      // Ne JAMAIS toucher à othWrap.style.position (le CSS gère bottom:-4px;left:-10px)
      var othEmoji = document.getElementById('profileAvatarOtherEmoji');
      if(othEmoji) othEmoji.src = url;
    };
    probe.onerror = function(){};
    probe.src = url;
  })
  .catch(function(){});
};

// Chargement automatique de l'avatar dans la topbar au démarrage (sans ouvrir le modal)
window._acLoadAvatarTopbarOnStart = function(u){
  if(!u) return;
  var _BUCKET = 'images';
  var path = 'avatars/' + u.id + '.jpg';
  var url = SB2_URL + '/storage/v1/object/public/' + _BUCKET + '/' + path + '?t=' + Date.now();
  var probe = new Image();
  probe.onload = function(){
    _acSyncAvatarTopbar(url, u.role);
    // ✅ Charger aussi le partenaire juste après
    setTimeout(function(){ if(window._acLoadPartnerAvatar) window._acLoadPartnerAvatar(); }, 300);
  };
  probe.src = url;
};

window.acTriggerAvatarUpload = function(){
  var inp = document.getElementById('acAvatarInput');
  if(inp){ inp.value = ''; inp.click(); }
};

window.acHandleAvatarUpload = function(input){
  if(!input.files || !input.files[0]) return;
  var file = input.files[0];
  var u = v2GetUser();
  if(!u) return;

  var ALLOWED = ['image/jpeg','image/jpg','image/png','image/webp'];
  if(ALLOWED.indexOf(file.type) === -1){ alert('Format non autorisé (JPEG, PNG, WebP)'); return; }
  if(file.size > 3 * 1024 * 1024){ alert('Image trop lourde (max 3 Mo)'); return; }

  var wrap = document.getElementById('acAvatarWrap');
  if(wrap) wrap.style.opacity = '0.5';

  var path = 'avatars/' + u.id + '.jpg';
  fetch(SB2_URL + '/storage/v1/object/' + _AVATAR_BUCKET + '/' + path, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': file.type, 'x-upsert': 'true' }, sb2Headers()),
    body: file
  })
  .then(function(r){
    if(wrap) wrap.style.opacity = '';
    if(r.ok){
      var url = SB2_URL + '/storage/v1/object/public/' + _AVATAR_BUCKET + '/' + path + '?t=' + Date.now();
      var img = document.getElementById('acAvatarImg');
      var emoji = document.getElementById('acAvatarEmoji');
      if(img){ img.src = url; img.style.display = ''; }
      if(emoji) emoji.style.display = 'none';
      // ✅ Afficher le bouton suppression
      var delBtn = document.getElementById('acDeleteAvatarBtn');
      if(delBtn) delBtn.style.display = 'flex';
      _acSyncAvatarTopbar(url, u.role);
      if(typeof showToast === 'function') showToast('✅ Photo de profil mise à jour !', 'success', 2000);
    } else {
      r.text().then(function(t){ alert('Erreur upload : ' + t); });
    }
  })
  .catch(function(err){ if(wrap) wrap.style.opacity = ''; alert('Erreur réseau : ' + err); });
};

// ✅ Suppression de la photo de profil
window.acDeleteAvatar = function(){
  var u = v2GetUser();
  if(!u) return;
  if(!confirm('Supprimer ta photo de profil ?')) return;
  // ✅ Passe par l'Edge Function auth-v2 (service_role requis pour supprimer du storage)
  v2Auth('delete_avatar', { user_id: u.id })
  .then(function(res){
    if(!res || res.error){ alert('Erreur : ' + (res && res.error || 'inconnue')); return; }
    // Reset UI dans le modal
    var img = document.getElementById('acAvatarImg');
    var emoji = document.getElementById('acAvatarEmoji');
    var delBtn = document.getElementById('acDeleteAvatarBtn');
    if(img){ img.src = ''; img.style.display = 'none'; }
    if(emoji) emoji.style.display = '';
    if(delBtn) delBtn.style.display = 'none';
    // Reset header — revenir à l'image par défaut
    var defaultSrc = u.role === 'girl' ? 'assets/images/profil_girl.png' : 'assets/images/profil_boy.png';
    if(window._yamRealAvatars) window._yamRealAvatars[u.role] = null;
    var mainEmoji = document.getElementById('profileAvatarEmoji');
    if(mainEmoji) mainEmoji.src = defaultSrc;
    if(typeof showToast === 'function') showToast('🗑️ Photo supprimée', 'success', 2000);
  })
  .catch(function(err){ alert('Erreur suppression : ' + err); });
};


/* ════════════════════════════════════════════
   INJECTION BOUTON "Mon Compte" dans le popup profil
════════════════════════════════════════════ */
(function(){
  function injectAccountBtn(){
    var pp = document.getElementById('profilePopup');
    if(!pp || document.getElementById('ppBtnAccount')) return;
    var btn = document.createElement('div');
    btn.id = 'ppBtnAccount';
    btn.className = 'profile-popup-btn';
    btn.innerHTML = '<span style="margin-right:6px;">⚙️</span> Mon Compte';
    btn.onclick = function(){ openAccountModal(); };
    var logoutBtn = document.getElementById('ppBtnLogout');
    if(logoutBtn) pp.insertBefore(btn, logoutBtn);
    else pp.appendChild(btn);
    // Afficher seulement si connecté
    btn.style.display = v2GetUser() ? '' : 'none';
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', injectAccountBtn);
  } else {
    injectAccountBtn();
  }
  setTimeout(injectAccountBtn, 800);

  var _origSetProfile3 = window.setProfile;
  window.setProfile = function(g){
    if(_origSetProfile3) _origSetProfile3.apply(this, arguments);
    setTimeout(function(){
      var btn = document.getElementById('ppBtnAccount');
      if(btn) btn.style.display = v2GetUser() ? '' : 'none';
    }, 200);
  };
})();


/* ════════════════════════════════════════════
   SYNC RAISONS & POST-ITS depuis v2_couples
════════════════════════════════════════════ */
window.addEventListener('load', function(){
  if(!window.YAM_COUPLE.loaded) return;
  applyYamCouple();
});


/* ════════════════════════════════════════════
   POLLING PARTENAIRE — Détecte changements pseudo/couple
   Poll toutes les 15s pour voir si le partenaire a changé de pseudo ou s'est délié
════════════════════════════════════════════ */
(function(){
  var POLL_INTERVAL = 15000; // 15 secondes
  var _pollIv = null;
  var _lastPartnerPseudo = null;
  var _lastCoupleId = null;
  
  function pollPartnerChanges(){
    var u = v2GetUser();
    if(!u || !u.couple_id) return;
    
    // Sauvegarder l'état actuel pour comparaison
    if(_lastPartnerPseudo === null) _lastPartnerPseudo = u.partner_pseudo;
    if(_lastCoupleId === null) _lastCoupleId = u.couple_id;
    
    // Récupérer les données fraîches du partenaire
    fetch(SB2_URL + '/rest/v1/v2_users?couple_id=eq.' + u.couple_id + '&id=neq.' + u.id + '&select=pseudo,couple_id&limit=1', {
      headers: sb2Headers()
    })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(rows){
      if(!Array.isArray(rows)) return;
      
      // Cas 1 : Le partenaire n'existe plus (il s'est délié)
      if(rows.length === 0){
        // Vérifier si mon couple_id a changé côté serveur
        return fetch(SB2_URL + '/rest/v1/v2_users?id=eq.' + u.id + '&select=couple_id&limit=1', {
          headers: sb2Headers()
        })
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(myRows){
          if(Array.isArray(myRows) && myRows.length > 0){
            var myCoupleId = myRows[0].couple_id;
            if(myCoupleId !== _lastCoupleId){
              // Mon couple_id a changé — le partenaire m'a délié
              if(window.v2RefreshSession){
                v2RefreshSession().then(function(freshUser){
                  if(freshUser){
                    _lastCoupleId = freshUser.couple_id;
                    _lastPartnerPseudo = freshUser.partner_pseudo;
                    
                    // Notification
                    if(typeof showToast === 'function'){
                      showToast('⚠️ Votre partenaire s\'est délié', 'warning', 4000);
                    }
                    
                    // Mettre à jour l'UI si le modal Mon Compte est ouvert
                    var modal = document.getElementById('accountModal');
                    if(modal && modal.classList.contains('open')){
                      var el = document.getElementById('acPartnerName');
                      if(el) el.textContent = '(pas encore lié)';
                      var unlinkBtn = document.getElementById('acUnlinkBtn');
                      if(unlinkBtn) unlinkBtn.style.display = 'none';
                      var ls = document.getElementById('acLinkSection');
                      if(ls) ls.style.display = '';
                    }
                  }
                });
              }
            }
          }
        });
      }
      
      // Cas 2 : Le partenaire existe toujours
      var partner = rows[0];
      
      // Détection changement de pseudo
      if(partner.pseudo !== _lastPartnerPseudo && _lastPartnerPseudo !== null){
        if(window.v2RefreshSession){
          v2RefreshSession().then(function(freshUser){
            if(freshUser){
              _lastPartnerPseudo = freshUser.partner_pseudo;
              
              // Notification
              if(typeof showToast === 'function'){
                showToast('💬 ' + escHtml(_lastPartnerPseudo) + ' a changé de pseudo', 'info', 3000);
              }
              
              // Mettre à jour l'UI si le modal Mon Compte est ouvert
              var modal = document.getElementById('accountModal');
              if(modal && modal.classList.contains('open')){
                var el = document.getElementById('acPartnerName');
                if(el) el.textContent = escHtml(_lastPartnerPseudo);
              }
            }
          });
        }
      }
      
      // Détection changement de couple_id du partenaire (il s'est délié)
      if(partner.couple_id !== u.couple_id){
        // Le partenaire est dans un autre couple maintenant
        if(window.v2RefreshSession){
          v2RefreshSession().then(function(freshUser){
            if(freshUser){
              _lastCoupleId = freshUser.couple_id;
              _lastPartnerPseudo = freshUser.partner_pseudo;
              
              // Notification
              if(typeof showToast === 'function'){
                showToast('⚠️ Votre partenaire s\'est délié', 'warning', 4000);
              }
              
              // Mettre à jour l'UI si le modal Mon Compte est ouvert
              var modal = document.getElementById('accountModal');
              if(modal && modal.classList.contains('open')){
                var el = document.getElementById('acPartnerName');
                if(el) el.textContent = '(pas encore lié)';
                var unlinkBtn = document.getElementById('acUnlinkBtn');
                if(unlinkBtn) unlinkBtn.style.display = 'none';
                var ls = document.getElementById('acLinkSection');
                if(ls) ls.style.display = '';
              }
            }
          });
        }
      }
    })
    .catch(function(){/* erreur réseau — silent */});
  }
  
  function startPolling(){
    if(_pollIv) return;
    pollPartnerChanges(); // immédiat
    _pollIv = setInterval(pollPartnerChanges, POLL_INTERVAL);
  }
  
  function stopPolling(){
    if(_pollIv){ clearInterval(_pollIv); _pollIv = null; }
  }
  
  // Démarrer le polling quand un profil est choisi
  var _origSetProfile4 = window.setProfile;
  window.setProfile = function(g){
    if(_origSetProfile4) _origSetProfile4.apply(this, arguments);
    setTimeout(startPolling, 500);
  };
  
  // Si profil déjà choisi au chargement
  if(getProfile()) startPolling();
  
  // Pause si page cachée
  document.addEventListener('visibilitychange', function(){
    if(document.hidden) stopPolling();
    else startPolling();
  });
})();


// ── Profil Avatar + Humeur du jour ────────────────────────────────────────
(function(){
  var KEY      = 'jayana_profile';
  var MOOD_KEY = 'jayana_mood';
  var MOOD_TABLE = 'v2_moods';
  var EMOJIS   = { neutral:'👤', girl:'👧', boy:'👦' };
  var OTHER    = { girl:'boy', boy:'girl' };
  var MOODS    = ['😊','😍','🥰','😴','😔','🥺','😂','🔥','😎','🤩','😤','🥳','😇','🤗','💪','😏'];
  var MOOD_LABELS = window.MOOD_LABELS = {
    '😊':'Heureuse','😍':'Amoureuse','🥰':'Câline','😴':'Fatiguée','😔':'Triste',
    '🥺':'Sensible','😂':'Morte de rire','🔥':'Motivée','😎':'Sereine','🤩':'Excitée',
    '😤':'Frustrée','🥳':'En fête','😇':'Sage','🤗':'Affectueuse','💪':'Énergique','😏':'Coquine'
  };
  var MOOD_LABELS_BOY = window.MOOD_LABELS_BOY = {
    '😊':'Heureux','😍':'Amoureux','🥰':'Câlin','😴':'Fatigué','😔':'Triste',
    '🥺':'Sensible','😂':'Mort de rire','🔥':'Motivé','😎':'Serein','🤩':'Excité',
    '😤':'Frustré','🥳':'En fête','😇':'Sage','🤗':'Affectueux','💪':'Énergique','😏':'Coquin'
  };

  function get(){ return localStorage.getItem(KEY) || null; }
  function save(g){ localStorage.setItem(KEY, g); }
  window._profileSave = save;
  window._profileApply = function(g){ apply(g); };
  window._profileLoadMoods = function(){ loadMoods(); };
  window._profileCheckUnread = function(){ if(window._checkUnread) window._checkUnread(); };

  // ── Humeur Supabase ──
  function getTodayStr(){
    var d = new Date();
    return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
  }

  function getCoupleId(){
    try {
      var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
      if (s && s.user) return s.user.couple_id;
    } catch(e) {}
    return null;
  }

  function saveMood(sender, emoji){
    var today = getTodayStr();
    var coupleId = getCoupleId();
    if (!coupleId) return;
    fetch(SB2_URL + '/rest/v1/' + MOOD_TABLE + '?sender=eq.' + sender + '&date=eq.' + today, {
      method: 'DELETE', headers: sb2Headers()
    }).then(function(){
      fetch(SB2_URL + '/rest/v1/' + MOOD_TABLE, {
        method: 'POST',
        headers: sb2Headers({'Prefer':'return=minimal'}),
        body: JSON.stringify({ sender: sender, emoji: emoji, date: today, couple_id: coupleId })
      }).catch(function(){});
    }).catch(function(){});
  }

  var _lastOtherMood = null; // mémorise la dernière humeur connue de l'autre
  var _moodFirstLoad = true; // premier chargement → pas de notif

  function notifyMoodChange(emoji){
    // Scroll haut uniquement si on est sur la page principale (pas mode caché)
    var hiddenPage = document.getElementById('hiddenPage');
    var isHidden = hiddenPage && hiddenPage.classList.contains('active');
    if(!isHidden){
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Déclencher la capsule pillule après un court délai (laisse le scroll se faire)
    setTimeout(function(){
      if(window.triggerMoodBandeau) triggerMoodBandeau();
    }, isHidden ? 0 : 400);
  }

  function loadMoods(){
    var today = getTodayStr();
    var coupleId = getCoupleId();
    var filter = '?date=eq.' + today + (coupleId ? '&couple_id=eq.' + coupleId : '');
    fetch(SB2_URL + '/rest/v1/' + MOOD_TABLE + filter, {
      headers: sb2Headers()
    })
    .then(function(r){ return r.json(); })
    .then(function(rows){
      if(!Array.isArray(rows)) return;
      var profile = get();
      var otherProfile = profile ? OTHER[profile] : null;
      var selfFound  = false;
      var otherFound = false;
      rows.forEach(function(row){
        if(profile && row.sender === profile){
          selfFound = true;
          updateMoodBadge('self', row.emoji);
          window._myMood = row.emoji;
          var ppIcon = document.getElementById('ppMoodIcon');
          if(ppIcon) ppIcon.textContent = row.emoji;
        } else if(otherProfile && row.sender === otherProfile){
          otherFound = true;
          updateMoodBadge('other', row.emoji);
          // Détecter le changement d'humeur de l'autre
          if(row.emoji !== _lastOtherMood){
            _lastOtherMood = row.emoji;
            if(!_moodFirstLoad) notifyMoodChange(row.emoji);
          }
        }
      });
      if(!selfFound)  updateMoodBadge('self',  null);
      if(!otherFound){
        updateMoodBadge('other', null);
        _lastOtherMood = null;
      }
    })
    .catch(function(){});
  }

  function updateMoodBadge(who, emoji){
    var el = document.getElementById(who === 'self' ? 'profileMoodSelf' : 'profileMoodOther');
    var bandeau = document.getElementById('moodBandeau');
    if(!el) return;
    if(emoji){
      el.textContent = emoji;
      el.classList.add('visible');
      if(who === 'other'){
        if(bandeau) bandeau.classList.add('visible');
        el.classList.add('idle-glow');
      }
    } else {
      el.classList.remove('visible', 'idle-glow');
      if(who === 'other' && bandeau) bandeau.classList.remove('visible');
    }
    // Synchroniser immédiatement les badges météo humeur
    if(window.yamSyncMood) window.yamSyncMood();
  }

  // ── Rendu des avatars ──
  function apply(gender){
    var av       = document.getElementById('profileAvatar');
    var avEmoji  = document.getElementById('profileAvatarEmoji');
    var avOther  = document.getElementById('profileAvatarOther');
    var avOtherE = document.getElementById('profileAvatarOtherEmoji');
    var bg       = document.getElementById('ppBtnGirl');
    var bb       = document.getElementById('ppBtnBoy');
    var ppMood   = document.getElementById('ppBtnMood');
    if(!av) return;

    var ppLabel = document.querySelector('#profilePopup .profile-popup-label');
    if(!gender){
      // Non connecté : avatar neutre seul, popup simplifié
      if(avEmoji) avEmoji.textContent = EMOJIS.neutral;
      av.className = 'neutral';
      if(avOther) avOther.classList.remove('visible');
      var bandeau = document.getElementById('moodBandeau');
      if(bandeau) bandeau.classList.remove('visible','open');
      if(ppMood)  ppMood.style.display = 'none';
      if(bg) bg.style.display = 'flex';
      if(bb) bb.style.display = 'flex';
      if(ppLabel) ppLabel.textContent = 'Qui es-tu ?';
      var ppSep = document.querySelector('#profilePopup .profile-popup-sep');
      if(ppSep) ppSep.style.display = 'none';
      var ppLogout2 = document.getElementById('ppBtnLogout');
      if(ppLogout2) ppLogout2.style.display = 'none';
    } else {
      if(avEmoji) avEmoji.textContent = EMOJIS[gender];
      av.className = gender;
      if(avOther && avOtherE){
        avOtherE.textContent = EMOJIS[OTHER[gender]];
        avOther.classList.add('visible');
      }
      var bandeau2 = document.getElementById('moodBandeau');
      if(bandeau2) bandeau2.classList.add('visible');
      if(ppMood) ppMood.style.display = 'flex';
      if(bg) bg.style.display = 'flex';
      if(bb) bb.style.display = 'flex';
      if(ppLabel) ppLabel.textContent = 'Je suis…';
      var ppSep2 = document.querySelector('#profilePopup .profile-popup-sep');
      if(ppSep2) ppSep2.style.display = '';
      var ppLogout = document.getElementById('ppBtnLogout');
      if(ppLogout) ppLogout.style.display = 'flex';
    }
    if(bg){ bg.className = 'profile-popup-btn' + (gender==='girl' ? ' sel-girl' : ''); }
    if(bb){ bb.className = 'profile-popup-btn' + (gender==='boy'  ? ' sel-boy'  : ''); }
  }

  // ── Picker humeur ──
  function deleteMood(sender){
    var today = getTodayStr();
    fetch(SB2_URL + '/rest/v1/' + MOOD_TABLE + '?sender=eq.' + sender + '&date=eq.' + today, {
      method: 'DELETE', headers: sb2Headers()
    }).catch(function(){});
  }

  window.openMoodPicker = function(e){
    if(e && e.stopPropagation) e.stopPropagation();
    var pp = document.getElementById('profilePopup');
    if(pp) pp.classList.remove('open');
    var picker = document.getElementById('moodPicker');
    var grid   = document.getElementById('moodPickerGrid');
    if(!picker || !grid) return;
    var profile = get();
    var moodLabels = (profile === 'boy') ? MOOD_LABELS_BOY : MOOD_LABELS;
    var descEl = document.getElementById('moodPickerDesc');
    if(descEl) descEl.textContent = window._myMood ? (moodLabels[window._myMood] || '') : '';

    grid.innerHTML = '';
    MOODS.forEach(function(emoji){
      var btn = document.createElement('div');
      btn.className = 'mood-emoji-btn' + (window._myMood === emoji ? ' selected' : '');
      btn.textContent = emoji;
      btn.onmouseenter = function(){
        if(descEl) descEl.textContent = moodLabels[emoji] || '';
      };
      btn.onmouseleave = function(){
        if(descEl) descEl.textContent = window._myMood ? (moodLabels[window._myMood] || '') : '';
      };
      btn.onclick = function(){
        var profile = get();
        if(!profile) return;
        window._myMood = emoji;
        saveMood(profile, emoji);
        updateMoodBadge('self', emoji);
        var ppIcon = document.getElementById('ppMoodIcon');
        if(ppIcon) ppIcon.textContent = emoji;
        // Mettre à jour la sélection visuelle
        grid.querySelectorAll('.mood-emoji-btn').forEach(function(b){ b.classList.remove('selected'); });
        btn.classList.add('selected');
        // Mettre à jour la description
        if(descEl) descEl.textContent = moodLabels[emoji] || '';
        // Afficher le bouton effacer
        var cb = picker.querySelector('.mood-clear-btn');
        if(cb) cb.style.display = 'flex';
        // Réinitialiser le timer de fermeture automatique
        if(window._moodPickerTimer) clearTimeout(window._moodPickerTimer);
        window._moodPickerTimer = setTimeout(function(){ window.closeMoodPicker(); }, 10000);
      };
      grid.appendChild(btn);
    });
    // Supprimer l'ancien bouton effacer s'il existe
    var oldClear = picker.querySelector('.mood-clear-btn');
    if(oldClear) oldClear.remove();
    // Bouton supprimer — visible seulement si une humeur est définie
    var selfBadgeEl = document.getElementById('profileMoodSelf');
    var hasMood = !!(window._myMood) || !!(selfBadgeEl && selfBadgeEl.classList.contains('visible') && selfBadgeEl.textContent.trim().length > 0);
    var clearBtn = document.createElement('div');
    clearBtn.className = 'mood-clear-btn';
    clearBtn.textContent = '🗑 Effacer mon humeur';
    clearBtn.style.display = hasMood ? 'flex' : 'none';
    clearBtn.onclick = function(ev){
      ev.stopPropagation();
      var profile = get();
      if(!profile) return;
      deleteMood(profile);
      window._myMood = null;
      updateMoodBadge('self', null);
      var ppIcon = document.getElementById('ppMoodIcon');
      if(ppIcon) ppIcon.textContent = '😶';
      var selfBadge = document.getElementById('profileMoodSelf');
      if(selfBadge){ selfBadge.textContent = ''; selfBadge.classList.remove('visible'); }
      closeMoodPicker();
    };
    var descEl2 = document.getElementById('moodPickerDesc');
    if(descEl2) descEl2.after(clearBtn);
    else grid.after(clearBtn);
    picker.classList.add('open');
    picker.onclick = function(ev){ ev.stopPropagation(); };

    // Auto-fermeture après 10 secondes
    if(window._moodPickerTimer) clearTimeout(window._moodPickerTimer);
    window._moodPickerTimer = setTimeout(function(){
      window.closeMoodPicker();
    }, 10000);
  };

  window.closeMoodPicker = function(){
    var picker = document.getElementById('moodPicker');
    if(picker) picker.classList.remove('open');
    document.removeEventListener('click', window._moodPickerOutsideClick);
    if(window._moodPickerTimer){ clearTimeout(window._moodPickerTimer); window._moodPickerTimer = null; }
  };

  // Fermeture au clic extérieur
  window._moodPickerOutsideClick = function(ev){
    var picker = document.getElementById('moodPicker');
    if(picker && picker.classList.contains('open') && !picker.contains(ev.target)){
      window.closeMoodPicker();
    }
  };

  // Empêcher la propagation des clics à l'intérieur du picker
  document.addEventListener('click', function(ev){
    var picker = document.getElementById('moodPicker');
    if(picker && picker.contains(ev.target)) return;
    if(picker && picker.classList.contains('open')){
      window.closeMoodPicker();
    }
  });

  // showProfileCodeModal et setProfile sont désormais gérés dans app-core.js (système v2)
  // Ces stubs permettent la compatibilité si un autre fichier les appelle encore
  window.showProfileCodeModal = function(gender, onSuccess){
    // Système v2 : si session active, appeler directement onSuccess
    if(typeof v2LoadSession === 'function' && v2LoadSession()){
      if(window._profileSave) window._profileSave(gender);
      if(window._profileApply) window._profileApply(gender);
      if(onSuccess) onSuccess();
      return;
    }
    // Sinon : afficher l'écran login v2
    if(window.v2ShowLogin) window.v2ShowLogin();
  };

  window.toggleProfilePopup = function(){
    var pp = document.getElementById('profilePopup');
    if(pp) pp.classList.toggle('open');
    var picker = document.getElementById('moodPicker');
    if(picker) picker.classList.remove('open');
  };

  // Fermer au clic extérieur
  document.addEventListener('click', function(e){
    var wrap        = document.getElementById('profileAvatarWrap');
    var stickyAvatar = document.getElementById('yamStickyAvatarSelf');
    var pp          = document.getElementById('profilePopup');
    var picker      = document.getElementById('moodPicker');
    // Considérer l'avatar du sticky header comme zone "intérieure" au même titre que wrap
    var clickedInside = (wrap && wrap.contains(e.target)) || (stickyAvatar && stickyAvatar.contains(e.target));
    if(pp && pp.classList.contains('open') && !clickedInside)
      pp.classList.remove('open');
    if(picker && picker.classList.contains('open') && !picker.contains(e.target) && !clickedInside)
      picker.classList.remove('open');
  });

  // Au démarrage : charger l'état depuis la session v2
  (function(){
    var saved = get();
    // Plus besoin de sbLoadSession ici — app-core.js gère la session v2
  })();
  apply(get());
  if(get()) loadMoods();
  _moodFirstLoad = false;
  setInterval(function(){ if(get()) loadMoods(); }, 30000);

  // ── Réinitialisation à minuit ──
  function resetMoodsUI(){
    window._myMood = null;
    updateMoodBadge('self',  null);
    updateMoodBadge('other', null);
    var ppIcon  = document.getElementById('ppMoodIcon');
    if(ppIcon) ppIcon.textContent = '😶';
    var bandeau = document.getElementById('moodBandeau');
    if(bandeau){ clearTimeout(window._bandeauTimer); bandeau.classList.remove('open','visible','mood-highlight-girl','mood-highlight-boy'); }
  }

  function scheduleMidnightReset(){
    var now  = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2); // minuit + 2s
    var ms   = next - now;
    setTimeout(function(){
      resetMoodsUI();
      scheduleMidnightReset(); // reprogrammer pour le lendemain
    }, ms);
  }
  scheduleMidnightReset();

  window.triggerMoodBandeau = function(){
    var bandeau    = document.getElementById('moodBandeau');
    var bandeauTxt = document.getElementById('moodBandeauText');
    var bandeauEmo = document.getElementById('moodBandeauEmoji');
    var moodBadge  = document.getElementById('profileMoodOther');
    var avOther    = document.getElementById('profileAvatarOther');
    if(!bandeau) return;

    var myProfile    = get();
    var otherProfile = OTHER[myProfile];
    var hlBandeau    = otherProfile === 'boy' ? 'mood-highlight-boy' : 'mood-highlight-girl';
    var labels       = otherProfile === 'boy' ? MOOD_LABELS_BOY : MOOD_LABELS;
    var currentMood  = moodBadge ? moodBadge.textContent : '';
    var label        = currentMood && labels[currentMood] ? labels[currentMood] : '';
    if(bandeauEmo) bandeauEmo.textContent = currentMood || '';
    if(bandeauTxt) bandeauTxt.textContent = label;

    // Reset
    if(avOther) avOther.classList.remove('mood-highlight','mood-highlight-boy');
    if(moodBadge) moodBadge.classList.remove('mood-highlight-girl','mood-highlight-boy');
    bandeau.classList.remove('open','mood-highlight-girl','mood-highlight-boy');
    void bandeau.offsetWidth;

    // Masquer la bulle emoji — la pillule la remplace
    if(moodBadge){ moodBadge.style.opacity = '0'; moodBadge.classList.remove('idle-glow'); }

    // Ouvrir + animer
    bandeau.classList.add('open');
    setTimeout(function(){
      bandeau.classList.add(hlBandeau);
      if(moodBadge) moodBadge.classList.add(hlBandeau);
    }, 150);

    // Fermer après 4s — réafficher la bulle
    clearTimeout(window._bandeauTimer);
    window._bandeauTimer = setTimeout(function(){
      bandeau.classList.remove('open','mood-highlight-girl','mood-highlight-boy');
      if(moodBadge) moodBadge.classList.remove('mood-highlight-girl','mood-highlight-boy');
      // Réafficher la bulle après la fermeture de la pillule
      setTimeout(function(){
        if(moodBadge){ moodBadge.style.opacity = ''; moodBadge.classList.add('idle-glow'); }
      }, 200);
    }, 4000);
  };

  // Brancher le clic sur l'avatar secondaire
  document.addEventListener('click', function(e){
    var avOther = document.getElementById('profileAvatarOther');
    if(avOther && avOther.contains(e.target)){
      var moodBadge = document.getElementById('profileMoodOther');
      var hasMood = moodBadge && moodBadge.textContent.trim().length > 0;
      if(hasMood) triggerMoodBandeau();
    }
  });

  // Init bandeau caché si pas de profil
  (function(){
    var bandeau = document.getElementById('moodBandeau');
    if(bandeau && !get()) bandeau.classList.remove('visible');
  })();

  // Appliquer l'aura de suggestion sur les boutons genre des jeux
  function applyGenderHint(){
    var profile = get();
    var pairs = [
      ['memGenderGirl','memGenderBoy'],
      ['penduGenderGirl','penduGenderBoy'],
      ['puzzleGenderGirl','puzzleGenderBoy'],
      ['snakeGenderGirl','snakeGenderBoy']
    ];
    pairs.forEach(function(p){
      var btnGirl = document.getElementById(p[0]);
      var btnBoy  = document.getElementById(p[1]);
      if(!btnGirl || !btnBoy) return;
      btnGirl.classList.remove('profile-hint-girl','profile-hint-boy');
      btnBoy.classList.remove('profile-hint-girl','profile-hint-boy');
      if(profile === 'girl') btnGirl.classList.add('profile-hint-girl');
      if(profile === 'boy')  btnBoy.classList.add('profile-hint-boy');
    });
  }
  applyGenderHint();
  ['openGames','openMemoryGame','openPenduGame','openPuzzleGame','openSnakeGame'].forEach(function(fn){
    var orig = window[fn];
    if(orig) window[fn] = function(){
      orig.apply(this, arguments);
      setTimeout(applyGenderHint, 80);
    };
  });
})();
