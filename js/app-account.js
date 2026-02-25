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

  var u = v2GetUser();
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

  var linkSec = document.getElementById('acLinkSection');
  if(linkSec){
    linkSec.style.display = partnerPseudo ? 'none' : '';
    var li = document.getElementById('acLinkCode'); if(li) li.value = '';
    var lm = document.getElementById('acLinkMsg');  if(lm) lm.textContent = '';
  }

  var code = u.couple_code || u.couple_id || '—';
  document.getElementById('acCoupleCode').textContent = code;

  var dateVal = (window.YAM_COUPLE && window.YAM_COUPLE.start_date) || '2024-10-29T00:00:00';
  document.getElementById('acStartDate').value = dateVal.split('T')[0];

  ['acOldPwd','acNewPwd','acConfirmPwd'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value = '';
  });
  document.getElementById('acPwdMsg').textContent = '';
  document.getElementById('acStartDateMsg').textContent = '';
};

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

  // Utiliser l'Edge Function pour rejoindre le couple
  v2Auth('join_couple', { user_id: u.id, couple_code: code, token: (v2LoadSession()||{}).token })
  .then(function(data){
    if(data && data.error){
      msg.textContent = '❌ ' + data.error; msg.style.color = '#e05555';
    } else {
      msg.textContent = '✅ Compte lié avec succès !'; msg.style.color = 'var(--green)';
      // Mettre à jour la session locale
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
    }
  })
  .catch(function(){ msg.textContent = '❌ Erreur réseau'; msg.style.color = '#e05555'; });
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
    var wrap   = document.getElementById('profileAvatarWrap');
    var pp     = document.getElementById('profilePopup');
    var picker = document.getElementById('moodPicker');
    if(pp && pp.classList.contains('open') && wrap && !wrap.contains(e.target))
      pp.classList.remove('open');
    if(picker && picker.classList.contains('open') && !picker.contains(e.target) && wrap && !wrap.contains(e.target))
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

