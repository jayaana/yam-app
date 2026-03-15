// ═══════════════════════════════════════════════════════════
// app-account.js — Login UI · Mon Compte · Migration v2
// Doit être chargé APRÈS app-core.js et AVANT les autres modules
// ═══════════════════════════════════════════════════════════

// sb2Headers, sb2Fetch, sb2Post, sb2Patch, sb2Delete, sb2Upsert → définis dans app-core.js

/* ════════════════════════════════════════════
   COMPRESSION IMAGE — utilitaire global
   Utilisé par acHandleAvatarUpload, elleUpload, luiUpload,
   souvenirUploadPhoto, livreUploadPhoto dans app-nous.js
════════════════════════════════════════════ */
/**
 * compressImage(file, maxWidthPx, targetBytes)
 * Retourne une Promise<Blob> compressée en JPEG.
 * Essaie quality 0.82 → 0.65 → 0.45 jusqu'à atteindre targetBytes.
 * Rejette si HEIC ou si canvas.toBlob non supporté.
 */
window.compressImage = function(file, maxWidthPx, targetBytes){
  return new Promise(function(resolve, reject){
    // Détection HEIC (iPhone iOS 17+)
    var isHeic = file.type === 'image/heic' || file.type === 'image/heif'
              || file.name.toLowerCase().endsWith('.heic')
              || file.name.toLowerCase().endsWith('.heif');
    if(isHeic){
      reject(new Error('HEIC_NOT_SUPPORTED'));
      return;
    }
    var img = new Image();
    var objectUrl = URL.createObjectURL(file);
    img.onload = function(){
      URL.revokeObjectURL(objectUrl);
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      // Redimensionner si nécessaire
      if(w > maxWidthPx){
        h = Math.round(h * maxWidthPx / w);
        w = maxWidthPx;
      }
      var canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      if(!ctx){ reject(new Error('CANVAS_NOT_SUPPORTED')); return; }
      ctx.drawImage(img, 0, 0, w, h);

      // Essai qualité décroissante
      var qualities = [0.82, 0.65, 0.45];
      var idx = 0;
      function tryQuality(){
        if(idx >= qualities.length){
          // Dernier recours : retourner le blob à la qualité minimale
          canvas.toBlob(function(blob){
            if(!blob){ reject(new Error('CANVAS_TO_BLOB_FAILED')); return; }
            resolve(blob);
          }, 'image/jpeg', 0.45);
          return;
        }
        var q = qualities[idx++];
        canvas.toBlob(function(blob){
          if(!blob){ reject(new Error('CANVAS_TO_BLOB_FAILED')); return; }
          if(!targetBytes || blob.size <= targetBytes){
            resolve(blob);
          } else {
            tryQuality();
          }
        }, 'image/jpeg', q);
      }
      tryQuality();
    };
    img.onerror = function(){
      URL.revokeObjectURL(objectUrl);
      reject(new Error('IMAGE_LOAD_FAILED'));
    };
    img.src = objectUrl;
  });
};


/* ════════════════════════════════════════════
   PATCH GLOBAL — Rediriger sbGet/sbPost/sbPatch/sbDelete
   vers les tables v2_ sur SB2
════════════════════════════════════════════ */
// _V2_TABLE_MAP supprimé en v3 — toutes les tables utilisent leur nom direct (sans préfixe v2_)
var _V2_TABLE_MAP = {};
function _mapTable(name){ return _V2_TABLE_MAP[name] || name; }

window.sbGet = function(table, params){
  var mapped = _mapTable(table);
  var url = SB_URL + '/rest/v1/' + mapped + '?' + (params || 'order=created_at.desc');
  return fetch(url, { headers: sb2Headers() }).then(function(r){ return r.json(); });
};
window.sbPost = function(table, body){
  var mapped = _mapTable(table);
  return fetch(SB_URL + '/rest/v1/' + mapped, {
    method: 'POST',
    headers: sb2Headers({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(body)
  }).then(function(r){ return r.json(); });
};
window.sbPatch = function(table, id, body){
  var mapped = _mapTable(table);
  return fetch(SB_URL + '/rest/v1/' + mapped + '?id=eq.' + id, {
    method: 'PATCH',
    headers: sb2Headers({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(body)
  }).then(function(r){ return r.json(); });
};
window.sbDelete = function(table, id){
  var mapped = _mapTable(table);
  return fetch(SB_URL + '/rest/v1/' + mapped + '?id=eq.' + id, {
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
  window.yamLog('[YAM DEBUG] v2ShowLogin appelé', new Error().stack);
  var el = document.getElementById('v2LoginOverlay');
  if(el){ el.style.display = ''; el.classList.add('active'); }
  document.body.classList.add('v2-login-active');
};
window.v2HideLogin = function(){
  window.yamLog('[YAM DEBUG] v2HideLogin appelé', new Error().stack);
  var el = document.getElementById('v2LoginOverlay');
  if(el){ el.classList.remove('active'); el.style.display = ''; }
  document.body.classList.remove('v2-login-active');
  document.body.style.top = '';
  document.body.style.position = '';
  // Cacher le splash définitivement et révéler l'app
  var sp = document.getElementById('yamSplashScreen');
  window.yamLog('[YAM DEBUG] v2HideLogin - splash display avant:', sp ? sp.style.display : 'null');
  if(sp){ sp.style.display = 'none'; sp.style.visibility = 'hidden'; }
  document.body.classList.remove('splash-active');
  window.yamLog('[YAM DEBUG] v2HideLogin - splash caché, splash-active retiré');
};

window.v2SwitchTab = function(tab){
  ['login','register','join'].forEach(function(t){
    var form = document.getElementById('v2Form' + t.charAt(0).toUpperCase() + t.slice(1));
    var btn  = document.getElementById('v2Tab'  + t.charAt(0).toUpperCase() + t.slice(1));
    if(form) form.style.display = (t === tab) ? '' : 'none';
    if(btn)  btn.classList.toggle('active', t === tab);
  });
  // Cacher la section forgot password si on change d'onglet
  var forgot = document.getElementById('v2FormForgot');
  if(forgot) forgot.style.display = 'none';
};

window.v2ShowForgot = function(){
  var loginForm = document.getElementById('v2FormLogin');
  var forgotForm = document.getElementById('v2FormForgot');
  if(loginForm) loginForm.style.display = 'none';
  if(forgotForm) forgotForm.style.display = '';
  var el = document.getElementById('v2ForgotIdentifier');
  if(el){ el.value = (document.getElementById('v2LoginEmail') ? document.getElementById('v2LoginEmail').value : ''); el.focus(); }
};

window.v2ShowLoginForm = function(){
  var loginForm = document.getElementById('v2FormLogin');
  var forgotForm = document.getElementById('v2FormForgot');
  if(forgotForm) forgotForm.style.display = 'none';
  if(loginForm) loginForm.style.display = '';
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
  window.yamLog('[YAM DEBUG] _v2AfterLogin appelé, ok=', result.ok, result.error||'');
  if(!result.ok){
    _v2SetMsg(msgId, '❌ ' + (result.error || 'Erreur'), true);
    return;
  }
  window.yamLog('[YAM DEBUG] connexion OK - appel v2HideLogin');
  window.v2HideLogin();

  // Bloquer v2ShowLogin pendant 2s
  var _realV2ShowLogin = window.v2ShowLogin;
  window.v2ShowLogin = function(){
    window.yamLog('[YAM DEBUG] v2ShowLogin BLOQUÉ (init post-login)', new Error().stack);
  };
  setTimeout(function(){
    window.yamLog('[YAM DEBUG] v2ShowLogin restauré');
    window.v2ShowLogin = _realV2ShowLogin;
  }, 2000);

  var u = yamGetUser ? yamGetUser() : null;
  window.yamLog('[YAM DEBUG] v2GetUser=', u ? u.pseudo+'/'+u.role : 'NULL');
  if(u){
    localStorage.setItem('jayana_profile', u.role);
    window.yamLog('[YAM DEBUG] appel setProfile avec', u.role);
    if(window.setProfile) window.setProfile(u.role);
    if(window.loadCoupleConfig) window.loadCoupleConfig();
  }

  document.body.style.pointerEvents = 'none';
  window.scrollTo({ top: 0, behavior: 'instant' });

  setTimeout(function(){
    document.body.style.pointerEvents = '';
    window.yamLog('[YAM DEBUG] yamSwitchTab home');
    if(window.yamSwitchTab){
      window.yamSwitchTab('home');
    } else {
      var homeBtn = document.getElementById('navHome');
      if(homeBtn) homeBtn.click();
    }
    // Flamme — première connexion du jour
    if(typeof window.yamFlameActivity==='function') window.yamFlameActivity('first_login');
    // Push notifications — demande permission si première fois
    setTimeout(function(){ if(typeof window.yamRegisterPush==='function') window.yamRegisterPush(); }, 1500);
    // ✅ #38 — Relancer tous les polls après reconnexion
    document.dispatchEvent(new CustomEvent('yam:session_ready'));
  }, 350);
}

window.v2DoLogin = function(){
  var identifier = (document.getElementById('v2LoginEmail').value || '').trim();
  var password   =  document.getElementById('v2LoginPassword').value || '';
  var msgId      = 'v2LoginMsg';
  var msgEl = document.getElementById(msgId);
  if(!msgEl){
    msgEl = document.createElement('div');
    msgEl.id = msgId;
    msgEl.style.cssText = 'font-size:13px;margin-top:8px;text-align:center;';
    var form = document.getElementById('v2FormLogin');
    if(form) form.appendChild(msgEl);
  }
  if(!identifier || !password){
    _v2SetMsg(msgId, '⚠️ Remplis tous les champs', true); return;
  }
  _v2SetMsg(msgId, '⏳ Connexion...', false);
  // Passer l'identifiant tel quel — auth-v3 résout pseudo → email si pas d'@
  yamLogin(identifier, password).then(function(res){ _v2AfterLogin(res, msgId); });
};

// Mot de passe oublié
window.v2DoForgotPassword = function(){
  var identifier = (document.getElementById('v2ForgotIdentifier').value || '').trim();
  var msgId = 'v2ForgotFormMsg';
  if(!identifier){
    _v2SetMsg(msgId, '⚠️ Saisis ton email ou pseudo', true); return;
  }
  _v2SetMsg(msgId, '⏳ Envoi en cours...', false);
  _authPost({ action: 'forgot_password', email: identifier })
    .then(function(data){
      console.log('[forgot_password] réponse:', JSON.stringify(data));
      if(data.ok === false && data.debug){
        // Mode debug temporaire — affiche l'erreur Supabase réelle
        _v2SetMsg(msgId, '❌ Erreur Supabase : ' + data.debug, true);
      } else {
        _v2SetMsg(msgId, '✅ Si ce compte existe, un email de reset a été envoyé', false);
      }
    })
    .catch(function(err){
      console.error('[forgot_password] erreur réseau:', err);
      _v2SetMsg(msgId, '❌ Erreur réseau — vérifie ta connexion', true);
    });
};

// ── Changer le mot de passe depuis le lien de reset ──────────────
// Le token window._yamResetToken est injecté par le bloc splash dans index.html
window.v2DoResetPassword = function(){
  var p1    = (document.getElementById('v2ResetPassword').value  || '');
  var p2    = (document.getElementById('v2ResetPassword2').value || '');
  var msgId = 'v2ResetMsg';

  if(p1.length < 6){
    _v2SetMsg(msgId, '⚠️ Mot de passe trop court (6 min)', true); return;
  }
  if(p1 !== p2){
    _v2SetMsg(msgId, '⚠️ Les mots de passe ne correspondent pas', true); return;
  }
  if(!window._yamResetToken){
    _v2SetMsg(msgId, '❌ Lien expiré — refais "Mot de passe oublié"', true); return;
  }

  _v2SetMsg(msgId, '⏳ Mise à jour...', false);

  fetch(SB_URL + '/auth/v1/user', {
    method: 'PUT',
    headers: {
      'apikey':        SB_ANON_KEY,
      'Authorization': 'Bearer ' + window._yamResetToken,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ password: p1 }),
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    if(data.error || data.error_description){
      _v2SetMsg(msgId, '❌ ' + (data.error_description || data.error || 'Erreur'), true);
      return;
    }
    window._yamResetToken = null;
    _v2SetMsg(msgId, '✅ Mot de passe changé ! Connecte-toi.', false);
    setTimeout(function(){
      // Réafficher les onglets + formulaire connexion
      var tabs = document.getElementById('v2LoginTabs');
      if(tabs) tabs.style.display = '';
      var resetForm = document.getElementById('v2FormReset');
      if(resetForm) resetForm.style.display = 'none';
      var loginForm = document.getElementById('v2FormLogin');
      if(loginForm) loginForm.style.display = '';
      var tabLogin = document.getElementById('v2TabLogin');
      if(tabLogin) tabLogin.classList.add('active');
      var tabReg = document.getElementById('v2TabRegister');
      if(tabReg) tabReg.classList.remove('active');
    }, 2000);
  })
  .catch(function(){
    _v2SetMsg(msgId, '❌ Erreur réseau — réessaie', true);
  });
};

window.v2DoRegister = function(){
  var email    = (document.getElementById('v2RegEmail').value    || '').trim();
  var pseudo   = (document.getElementById('v2RegPseudo').value   || '').trim();
  var password =  document.getElementById('v2RegPassword').value || '';
  var msgId    = 'v2RegInfo';
  if(!email || !pseudo || !password){
    _v2SetMsg(msgId, '⚠️ Remplis tous les champs', true); return;
  }
  if(password.length < 6){
    _v2SetMsg(msgId, '⚠️ Mot de passe trop court (6 min)', true); return;
  }
  _v2SetMsg(msgId, '⏳ Création du compte...', false);
  yamRegister(email, password, pseudo, _v2Role).then(function(res){
    if(res.ok && res.data && res.data.user && res.data.user.couple_code){
      _v2SetMsg(msgId, '✅ Compte créé ! Ton code couple : ' + res.data.user.couple_code, false);
      setTimeout(function(){ _v2AfterLogin(res, msgId); }, 2000);
    } else {
      _v2AfterLogin(res, msgId);
    }
  });
};

window.v2DoJoin = function(){
  var email    = (document.getElementById('v2JoinEmail')    ? (document.getElementById('v2JoinEmail').value    || '').trim() : '');
  var pseudo   = (document.getElementById('v2JoinPseudo').value   || '').trim();
  var password =  document.getElementById('v2JoinPassword').value || '';
  var code     = (document.getElementById('v2JoinCode').value     || '').trim().toUpperCase();
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
  if(!email || !pseudo || !password || !code){
    _v2SetMsg(msgId, '⚠️ Remplis tous les champs', true); return;
  }
  if(password.length < 6){
    _v2SetMsg(msgId, '⚠️ Mot de passe trop court (6 min)', true); return;
  }
  _v2SetMsg(msgId, '⏳ Création du compte...', false);
  // v3 : register d'abord, puis join_couple
  yamRegister(email, password, pseudo, _v2Role).then(function(res){
    if(!res.ok){ _v2AfterLogin(res, msgId); return; }
    _v2SetMsg(msgId, '⏳ Connexion au couple...', false);
    yamJoinCouple(code).then(function(joinRes){
      if(!joinRes.ok){ _v2SetMsg(msgId, '❌ ' + (joinRes.error || 'Code couple invalide'), true); return; }
      // Rafraîchir la session avec le nouveau couple_id
      v2RefreshSession().then(function(){ _v2AfterLogin(res, msgId); });
    });
  });
};

// Au démarrage : si session active on s'assure que le login est fermé
// Si pas de session : ne rien faire — c'est le splash + yamSplashOpen qui gèrent tout
document.addEventListener('DOMContentLoaded', function(){
  var u = yamGetUser ? yamGetUser() : null;
  window.yamLog('[YAM DEBUG] DOMContentLoaded app-account - v2GetUser=', u ? u.pseudo+'/'+u.role : 'NULL');
  if(u){
    window.yamLog('[YAM DEBUG] DOMContentLoaded - session active, appel v2HideLogin');
    window.v2HideLogin();
  } else {
    window.yamLog('[YAM DEBUG] DOMContentLoaded - pas de session, on attend le splash');
    window.v2SelectRole('girl');
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
  var u = yamGetUser ? yamGetUser() : null;
  if(!u || !u.couple_id) return Promise.resolve(null);
  return fetch(SB_URL + '/rest/v1/couples?id=eq.' + encodeURIComponent(u.couple_id) + '&select=*', {
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
    // Remettre le scroll à 0 après injection du contenu
    window.scrollTo({ top: 0, behavior: 'instant' });
    return cfg;
  })
  .catch(function(){ return null; });
}

function renderTimeline(items){
  // La timeline est maintenant gérée dynamiquement par histoireRenderTimeline() dans app-nous.js
  // Cette fonction est conservée pour compatibilité — elle appelle la nouvelle si disponible
  if(typeof window.histoireRenderTimeline === 'function'){
    window.histoireRenderTimeline(items);
  }
}

function applyYamCouple(){
  if(!window.YAM_COUPLE || !window.YAM_COUPLE.loaded) return;
  // reasons supprimé (section "Pourquoi je t'aime" remplacée par "Mots doux IA")
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
  if(yamGetUser ? yamGetUser() : null) loadCoupleConfig();
  // Charger l'avatar photo dans la topbar si déjà connecté
  var u = yamGetUser ? yamGetUser() : null;
  if(u) setTimeout(function(){ if(window._acLoadAvatarTopbarOnStart) window._acLoadAvatarTopbarOnStart(u); }, 800);
});

var _acOrigSetProfile = window.setProfile;
window.setProfile = function(g){
  if(_acOrigSetProfile) _acOrigSetProfile.apply(this, arguments);
  setTimeout(loadCoupleConfig, 500);
  // Charger l'avatar photo dans la topbar après connexion
  setTimeout(function(){
    var u = yamGetUser ? yamGetUser() : null;
    if(u && window._acLoadAvatarTopbarOnStart) window._acLoadAvatarTopbarOnStart(u);
  }, 900);
};


/* ════════════════════════════════════════════
   PARAMÈTRES — Vue plein écran style iOS Settings
════════════════════════════════════════════ */
(function(){

  /* ── CSS dédié ── */
  var settingsCSS = document.createElement('style');
  settingsCSS.textContent = '\
#settingsView{display:none;position:fixed;inset:0;z-index:3000;background:var(--bg);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain;font-family:"Bricolage Grotesque",sans-serif;}\
#settingsView.active{display:block;}\
body.settings-open{overflow:hidden!important;}\
body.settings-open header,body.settings-open #yamStickyHeader,body.settings-open .bottom-nav{display:none!important;}\
.stg-safe-top{height:env(safe-area-inset-top,0px);}\
.stg-header{position:sticky;top:0;z-index:10;display:flex;align-items:center;padding:12px 16px;background:var(--bg);border-bottom:1px solid var(--border);gap:12px;}\
.stg-back{width:36px;height:36px;border-radius:50%;background:var(--s2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform .15s;-webkit-tap-highlight-color:transparent;}\
.stg-back:active{transform:scale(.9);}\
.stg-back svg{color:var(--text);}\
.stg-title{font-size:18px;font-weight:700;color:var(--text);}\
.stg-scroll{padding:0 16px 120px;}\
\
/* Carte profil */\
.stg-profile-card{display:flex;align-items:center;gap:14px;background:var(--s1);border:1px solid var(--border);border-radius:16px;padding:16px;margin:20px 0 24px;}\
.stg-avatar-wrap{position:relative;flex-shrink:0;}\
.stg-avatar{width:60px;height:60px;background:var(--s2);border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--border);overflow:hidden;cursor:pointer;}\
.stg-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%;}\
.stg-avatar-cam{position:absolute;bottom:-2px;right:-2px;width:22px;height:22px;background:var(--green);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;border:2px solid var(--s1);cursor:pointer;}\
.stg-avatar-del{display:none;position:absolute;top:-3px;left:-3px;width:18px;height:18px;background:#e05555;border-radius:50%;align-items:center;justify-content:center;font-size:9px;border:1.5px solid var(--s1);cursor:pointer;color:#fff;}\
.stg-profile-info{flex:1;min-width:0;}\
.stg-pseudo-row{display:flex;align-items:center;gap:6px;}\
.stg-pseudo{font-size:17px;font-weight:700;color:var(--text);}\
.stg-pseudo-edit-btn{background:none;border:none;cursor:pointer;padding:2px 4px;color:var(--muted);font-size:13px;}\
.stg-role-badge{font-size:11px;font-weight:600;margin-top:3px;padding:3px 9px;border-radius:20px;display:inline-block;}\
\
/* Groupes iOS */\
.stg-group-label{font-size:12px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;padding:0 4px 7px;margin-top:24px;}\
.stg-group{background:var(--s1);border:1px solid var(--border);border-radius:14px;overflow:hidden;}\
.stg-row{display:flex;align-items:center;padding:13px 16px;gap:12px;cursor:pointer;transition:background .12s;-webkit-tap-highlight-color:transparent;position:relative;}\
.stg-row:not(:last-child){border-bottom:1px solid var(--border);}\
.stg-row:active{background:var(--s2);}\
.stg-row-icon{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}\
.stg-row-body{flex:1;min-width:0;}\
.stg-row-title{font-size:14px;font-weight:600;color:var(--text);}\
.stg-row-sub{font-size:11px;color:var(--muted);margin-top:1px;}\
.stg-row-right{font-size:12px;color:var(--muted);flex-shrink:0;display:flex;align-items:center;gap:4px;}\
.stg-row-chevron{width:7px;height:12px;stroke:var(--muted);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;}\
.stg-row-value{font-size:13px;color:var(--sub);}\
.stg-row.no-chevron{cursor:default;}\
.stg-row.no-chevron:active{background:transparent;}\
\
/* Sous-pages */\
.stg-subpage{display:none;position:fixed;inset:0;z-index:3001;background:var(--bg);overflow-y:auto;-webkit-overflow-scrolling:touch;}\
.stg-subpage.active{display:block;}\
\
/* Champs dans sous-pages */\
.stg-field{padding:14px 16px;}\
.stg-field label{display:block;font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px;}\
.stg-field input,.stg-field select{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:12px;padding:12px 14px;color:var(--text);font-size:15px;font-family:"Bricolage Grotesque",sans-serif;outline:none;box-sizing:border-box;}\
.stg-field input:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(201,120,96,.12);}\
.stg-field-msg{font-size:11px;margin-top:5px;min-height:15px;}\
.stg-btn{width:100%;padding:13px;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:"Bricolage Grotesque",sans-serif;transition:transform .12s,opacity .12s;-webkit-tap-highlight-color:transparent;}\
.stg-btn:active{transform:scale(.97);opacity:.85;}\
.stg-btn-primary{background:var(--green);color:#fff;}\
.stg-btn-danger{background:rgba(224,85,85,.1);border:1.5px solid rgba(224,85,85,.4);color:#e05555;}\
.stg-confirm-box{margin:12px 16px;background:rgba(224,85,85,.06);border:1px solid rgba(224,85,85,.25);border-radius:12px;padding:14px;}\
.stg-confirm-box p{font-size:13px;color:var(--text);margin:0 0 10px;font-weight:600;}\
.stg-confirm-box span{font-size:12px;color:var(--muted);display:block;margin-bottom:12px;}\
.stg-confirm-btns{display:flex;gap:8px;}\
.stg-confirm-btns button{flex:1;padding:10px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:"Bricolage Grotesque",sans-serif;border:none;}\
\
/* Tags préférences */\
.stg-tags{display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px;}\
.stg-tag{padding:8px 16px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;border:1.5px solid var(--border);background:var(--s2);color:var(--text);-webkit-tap-highlight-color:transparent;}\
.stg-tag.on{background:var(--green);color:#fff;border-color:var(--green);}\
.stg-tag:active{transform:scale(.95);}\
\
/* Thème toggle dans paramètres */\
.stg-theme-pills{display:flex;gap:0;background:var(--s2);border-radius:10px;overflow:hidden;border:1px solid var(--border);}\
.stg-theme-pill{flex:1;padding:10px;text-align:center;font-size:13px;font-weight:600;cursor:pointer;color:var(--muted);transition:all .2s;}\
.stg-theme-pill.active{background:var(--green);color:#fff;}\
\
/* Version */\
.stg-version{text-align:center;padding:24px 0 16px;font-size:11px;color:var(--muted);}\
.stg-empty-state{text-align:center;padding:32px 16px;}\
.stg-empty-state .stg-empty-icon{font-size:40px;margin-bottom:8px;}\
.stg-empty-state .stg-empty-text{font-size:13px;color:var(--muted);line-height:1.5;}\
';
  document.head.appendChild(settingsCSS);

  /* ── HTML principal ── */
  var mainHTML =
  '<div id="settingsView">' +
    '<div class="stg-safe-top"></div>' +
    '<div class="stg-header">' +
      '<div class="stg-back" aria-label="Retour">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
      '</div>' +
      '<div class="stg-title">Paramètres</div>' +
    '</div>' +

    '<div class="stg-scroll">' +

      /* ── Carte profil ── */
      '<div class="stg-profile-card">' +
        '<div class="stg-avatar-wrap">' +
          '<div class="stg-avatar" id="acAvatarWrap">' +
            '<img id="acAvatarImg" src="" style="display:none;" />' +
            '<span id="acAvatarEmoji" style="font-size:34px;line-height:1;">👤</span>' +
          '</div>' +
          '<div class="stg-avatar-cam">📷</div>' +
          '<div class="stg-avatar-del" id="acDeleteAvatarBtn" title="Supprimer">✕</div>' +
        '</div>' +
        '<input type="file" id="acAvatarInput" accept="image/*" style="display:none;" />' +
        '<div class="stg-profile-info">' +
          '<div class="stg-pseudo-row">' +
            '<div class="stg-pseudo" id="acPseudo">—</div>' +
            '<button class="stg-pseudo-edit-btn" id="acEditPseudoBtn" title="Modifier">✏️</button>' +
          '</div>' +
          '<div id="acEditPseudoRow" style="display:none;margin-top:6px;">' +
            '<input type="text" id="acNewPseudoInput" maxlength="20" placeholder="Nouveau pseudo" style="background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:7px 10px;color:var(--text);font-size:13px;outline:none;width:100%;box-sizing:border-box;font-family:inherit;margin-bottom:4px;" />' +
            '<div style="display:flex;gap:4px;">' +
              '<button style="background:var(--green);color:#fff;border:none;border-radius:7px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;">✓</button>' +
              '<button style="background:var(--s2);color:var(--muted);border:1px solid var(--border);border-radius:7px;padding:5px 10px;font-size:12px;cursor:pointer;">✕</button>' +
            '</div>' +
            '<div id="acPseudoMsg" class="stg-field-msg" style="color:var(--green);"></div>' +
          '</div>' +
          '<div class="stg-role-badge" id="acRoleBadge">—</div>' +
        '</div>' +
      '</div>' +

      /* ── Groupe : Compte ── */
      '<div class="stg-group-label">Compte</div>' +
      '<div class="stg-group">' +
        '<div class="stg-row" data-sub="stgSubCouple">' +
          '<div class="stg-row-icon" style="background:rgba(201,120,96,.12);">💑</div>' +
          '<div class="stg-row-body"><div class="stg-row-title">Couple</div><div class="stg-row-sub">Code, partenaire, date anniversaire</div></div>' +
          '<div class="stg-row-right"><svg class="stg-row-chevron" viewBox="0 0 8 14"><polyline points="1 1 7 7 1 13"/></svg></div>' +
        '</div>' +
        '<div class="stg-row" data-sub="stgSubSecurity">' +
          '<div class="stg-row-icon" style="background:rgba(124,106,247,.12);">🔒</div>' +
          '<div class="stg-row-body"><div class="stg-row-title">Sécurité</div><div class="stg-row-sub">Mot de passe</div></div>' +
          '<div class="stg-row-right"><svg class="stg-row-chevron" viewBox="0 0 8 14"><polyline points="1 1 7 7 1 13"/></svg></div>' +
        '</div>' +
        '<div class="stg-row" data-sub="stgSubAbonnement">' +
          '<div class="stg-row-icon" style="background:rgba(231,90,124,.12);">✨</div>' +
          '<div class="stg-row-body"><div class="stg-row-title">Abonnement</div><div class="stg-row-sub">Gérer ton offre YAM</div></div>' +
          '<div class="stg-row-right"><span class="stg-row-value">Gratuit</span><svg class="stg-row-chevron" viewBox="0 0 8 14"><polyline points="1 1 7 7 1 13"/></svg></div>' +
        '</div>' +
      '</div>' +

      /* ── Groupe : Personnalisation ── */
      '<div class="stg-group-label">Personnalisation</div>' +
      '<div class="stg-group">' +
        '<div class="stg-row" data-sub="stgSubPrefs">' +
          '<div class="stg-row-icon" style="background:rgba(110,148,132,.12);">🎯</div>' +
          '<div class="stg-row-body"><div class="stg-row-title">Préférences</div><div class="stg-row-sub">Centres d\'intérêt, goûts, idées cadeaux</div></div>' +
          '<div class="stg-row-right"><svg class="stg-row-chevron" viewBox="0 0 8 14"><polyline points="1 1 7 7 1 13"/></svg></div>' +
        '</div>' +
        '<div class="stg-row" data-sub="stgSubAppearance">' +
          '<div class="stg-row-icon" style="background:rgba(185,153,112,.12);">🎨</div>' +
          '<div class="stg-row-body"><div class="stg-row-title">Apparence</div><div class="stg-row-sub">Thème sombre ou clair</div></div>' +
          '<div class="stg-row-right"><span id="stgThemeLabel" class="stg-row-value">Sombre</span><svg class="stg-row-chevron" viewBox="0 0 8 14"><polyline points="1 1 7 7 1 13"/></svg></div>' +
        '</div>' +
      '</div>' +

      /* ── Groupe : Application ── */
      '<div class="stg-group-label">Application</div>' +
      '<div class="stg-group">' +
        '<div class="stg-row" data-sub="stgSubNotifs">' +
          '<div class="stg-row-icon" style="background:rgba(240,102,136,.12);">🔔</div>' +
          '<div class="stg-row-body"><div class="stg-row-title">Notifications</div><div class="stg-row-sub">Gérer les alertes</div></div>' +
          '<div class="stg-row-right"><svg class="stg-row-chevron" viewBox="0 0 8 14"><polyline points="1 1 7 7 1 13"/></svg></div>' +
        '</div>' +
        '<div class="stg-row no-chevron">' +
          '<div class="stg-row-icon" style="background:rgba(124,106,247,.12);">🌐</div>' +
          '<div class="stg-row-body"><div class="stg-row-title">Langue</div><div class="stg-row-sub">Seul le français est disponible</div></div>' +
          '<div class="stg-row-right"><span class="stg-row-value">Français</span></div>' +
        '</div>' +
      '</div>' +

      /* ── Déconnexion ── */
      '<div style="margin-top:32px;padding:0 0 8px;">' +
        '<button class="stg-btn stg-btn-danger">🔓 Se déconnecter</button>' +
      '</div>' +

      '<div class="stg-version" id="stgVersionLabel">YAM — You And Me 💕</div>' +

    '</div>' + /* fin stg-scroll */
  '</div>';   /* fin settingsView */

  /* ── Sous-page COUPLE ── */
  var subCouple =
  '<div id="stgSubCouple" class="stg-subpage">' +
    '<div class="stg-safe-top"></div>' +
    '<div class="stg-header">' +
      '<div class="stg-back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></div>' +
      '<div class="stg-title">Couple</div>' +
    '</div>' +
    '<div style="padding:0 16px 80px;">' +

      /* Code couple */
      '<div class="stg-group-label" style="margin-top:20px;">Code couple</div>' +
      '<div class="stg-group">' +
        '<div class="stg-row no-chevron" style="cursor:default;">' +
          '<div style="flex:1;"><span id="acCoupleCode" style="font-size:18px;font-weight:800;letter-spacing:3px;color:var(--text);">—</span></div>' +
          '<button id="acCopyBtn" style="background:var(--green);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Copier</button>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--muted);padding:5px 4px 0;">Partage ce code à ton/ta partenaire pour lier vos comptes</div>' +

      /* Partenaire */
      '<div class="stg-group-label">Partenaire</div>' +
      '<div class="stg-group">' +
        '<div class="stg-row no-chevron" style="cursor:default;">' +
          '<div class="stg-row-body"><div class="stg-row-title" id="acPartnerName">—</div></div>' +
          '<button id="acUnlinkBtn" style="display:none;background:rgba(224,85,85,.1);border:1.5px solid rgba(224,85,85,.35);border-radius:8px;padding:5px 12px;font-size:12px;color:#e05555;cursor:pointer;font-weight:600;font-family:inherit;">✕ Délier</button>' +
        '</div>' +
      '</div>' +
      '<div id="acUnlinkMsg" class="stg-field-msg" style="padding:4px;color:#e05555;"></div>' +
      '<div id="acUnlinkConfirm" class="stg-confirm-box" style="display:none;">' +
        '<p>⚠️ Délier ce partenaire ?</p>' +
        '<span>Cette action ne supprime pas les données. Vous pourrez vous relier plus tard.</span>' +
        '<div class="stg-confirm-btns">' +
          '<button style="background:#e05555;color:#fff;">Oui, délier</button>' +
          '<button style="background:var(--s2);color:var(--muted);border:1px solid var(--border);">Non, annuler</button>' +
        '</div>' +
      '</div>' +

      /* Lier partenaire */
      '<div id="acLinkSection">' +
        '<div class="stg-group-label">Lier un partenaire</div>' +
        '<div class="stg-group">' +
          '<div class="stg-field" style="border:none;">' +
            '<div style="display:flex;gap:8px;align-items:center;">' +
              '<input type="text" id="acLinkCode" placeholder="Code couple" maxlength="36" style="flex:1;text-transform:uppercase;letter-spacing:1px;" />' +
              '<button class="stg-btn stg-btn-primary" style="width:auto;padding:12px 18px;">Lier</button>' +
            '</div>' +
            '<div id="acLinkMsg" class="stg-field-msg" style="color:var(--green);"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* Date anniversaire */
      '<div class="stg-group-label">Date de début du couple</div>' +
      '<div class="stg-group">' +
        '<div class="stg-field" style="border:none;">' +
          '<div style="display:flex;gap:8px;align-items:center;">' +
            '<input type="date" id="acStartDate" style="flex:1;" />' +
            '<button class="stg-btn stg-btn-primary" style="width:auto;padding:12px 18px;">Enregistrer</button>' +
          '</div>' +
          '<div id="acStartDateMsg" class="stg-field-msg" style="color:var(--green);"></div>' +
        '</div>' +
      '</div>' +

    '</div>' +
  '</div>';

  /* ── Sous-page SÉCURITÉ ── */
  var subSecurity =
  '<div id="stgSubSecurity" class="stg-subpage">' +
    '<div class="stg-safe-top"></div>' +
    '<div class="stg-header">' +
      '<div class="stg-back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></div>' +
      '<div class="stg-title">Sécurité</div>' +
    '</div>' +
    '<div style="padding:0 16px 80px;">' +
      '<div class="stg-group-label" style="margin-top:20px;">Compte</div>' +
      '<div class="stg-group">' +
        '<div class="stg-field" style="pointer-events:none;">' +
          '<label>Email</label>' +
          '<div id="acEmailDisplay" style="font-size:14px;color:var(--muted);padding:10px 0;letter-spacing:0.5px;">chargement...</div>' +
        '</div>' +
      '</div>' +
      '<div class="stg-group-label" style="margin-top:20px;">Changer le mot de passe</div>' +
      '<div class="stg-group">' +
        '<div class="stg-field"><label>Mot de passe actuel</label><input type="password" id="acOldPwd" placeholder="••••••" autocomplete="current-password" /></div>' +
        '<div class="stg-field"><label>Nouveau mot de passe</label><input type="password" id="acNewPwd" placeholder="6 caractères min." autocomplete="new-password" /></div>' +
        '<div class="stg-field"><label>Confirmer</label><input type="password" id="acConfirmPwd" placeholder="••••••" autocomplete="new-password" /></div>' +
      '</div>' +
      '<div style="padding:12px 0;"><button class="stg-btn stg-btn-primary">Changer le mot de passe</button></div>' +
      '<div id="acPwdMsg" class="stg-field-msg" style="text-align:center;color:var(--green);padding:0 4px;"></div>' +
    '</div>' +
  '</div>';

  /* ── Sous-page ABONNEMENT ── */
  var subAbonnement =
  '<div id="stgSubAbonnement" class="stg-subpage">' +
    '<div class="stg-safe-top"></div>' +
    '<div class="stg-header">' +
      '<div class="stg-back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></div>' +
      '<div class="stg-title">Abonnement</div>' +
    '</div>' +
    '<div style="padding:0 16px 80px;">' +
      '<div class="stg-empty-state" style="margin-top:60px;">' +
        '<div class="stg-empty-icon">✨</div>' +
        '<div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:8px;">Plan Gratuit</div>' +
        '<div class="stg-empty-text">Tu profites de toutes les fonctionnalités de YAM gratuitement.<br><br>Des offres premium arriveront bientôt avec des fonctionnalités exclusives 💕</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  /* ── Sous-page PRÉFÉRENCES ── */
  var subPrefs =
  '<div id="stgSubPrefs" class="stg-subpage">' +
    '<div class="stg-safe-top"></div>' +
    '<div class="stg-header">' +
      '<div class="stg-back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></div>' +
      '<div class="stg-title">Préférences</div>' +
    '</div>' +
    '<div style="padding:0 16px 80px;">' +
      '<div style="font-size:12px;color:var(--muted);padding:20px 4px 4px;">Sélectionne tes centres d\'intérêt pour que YAM puisse te suggérer des idées cadeaux et activités personnalisées.</div>' +

      '<div class="stg-group-label">Loisirs & activités</div>' +
      '<div class="stg-tags" id="stgPrefsLoisirs">' +
        '<div class="stg-tag" data-pref="cuisine">🍳 Cuisine</div>' +
        '<div class="stg-tag" data-pref="voyage">✈️ Voyage</div>' +
        '<div class="stg-tag" data-pref="sport">🏃 Sport</div>' +
        '<div class="stg-tag" data-pref="musique">🎵 Musique</div>' +
        '<div class="stg-tag" data-pref="lecture">📚 Lecture</div>' +
        '<div class="stg-tag" data-pref="cinema">🎬 Cinéma & séries</div>' +
        '<div class="stg-tag" data-pref="jeux-video">🎮 Jeux vidéo</div>' +
        '<div class="stg-tag" data-pref="nature">🌿 Nature</div>' +
        '<div class="stg-tag" data-pref="photo">📷 Photo</div>' +
        '<div class="stg-tag" data-pref="art">🎨 Art & créa</div>' +
      '</div>' +

      '<div class="stg-group-label">Style cadeaux</div>' +
      '<div class="stg-tags" id="stgPrefsGifts">' +
        '<div class="stg-tag" data-pref="fait-main">🎁 Fait main</div>' +
        '<div class="stg-tag" data-pref="experiences">🎪 Expériences</div>' +
        '<div class="stg-tag" data-pref="tech">💻 Tech & gadgets</div>' +
        '<div class="stg-tag" data-pref="mode">👗 Mode & bijoux</div>' +
        '<div class="stg-tag" data-pref="bien-etre">🧖 Bien-être</div>' +
        '<div class="stg-tag" data-pref="gourmand">🍫 Gourmand</div>' +
        '<div class="stg-tag" data-pref="deco">🏠 Déco maison</div>' +
        '<div class="stg-tag" data-pref="livres">📖 Livres</div>' +
      '</div>' +

      '<div class="stg-group-label">Types de sorties</div>' +
      '<div class="stg-tags" id="stgPrefsSorties">' +
        '<div class="stg-tag" data-pref="restaurant">🍽️ Restaurant</div>' +
        '<div class="stg-tag" data-pref="bar">🍸 Bar & cocktails</div>' +
        '<div class="stg-tag" data-pref="musee">🖼️ Musées & expos</div>' +
        '<div class="stg-tag" data-pref="concert">🎤 Concerts</div>' +
        '<div class="stg-tag" data-pref="rando">🥾 Rando & plein air</div>' +
        '<div class="stg-tag" data-pref="spa">♨️ Spa & détente</div>' +
        '<div class="stg-tag" data-pref="parc">🎢 Parcs & attractions</div>' +
        '<div class="stg-tag" data-pref="marche">🛍️ Marchés & brocantes</div>' +
      '</div>' +

      '<div id="stgPrefsSaveMsg" class="stg-field-msg" style="text-align:center;color:var(--green);padding:8px;"></div>' +

    '</div>' +
  '</div>';

  /* ── Sous-page APPARENCE ── */
  var subAppearance =
  '<div id="stgSubAppearance" class="stg-subpage">' +
    '<div class="stg-safe-top"></div>' +
    '<div class="stg-header">' +
      '<div class="stg-back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></div>' +
      '<div class="stg-title">Apparence</div>' +
    '</div>' +
    '<div style="padding:0 16px 80px;">' +
      '<div class="stg-group-label" style="margin-top:20px;">Thème</div>' +
      '<div class="stg-group">' +
        '<div style="padding:14px 16px;">' +
          '<div class="stg-theme-pills">' +
            '<div class="stg-theme-pill" id="stgThemeDark">🌙 Sombre</div>' +
            '<div class="stg-theme-pill" id="stgThemeLight">☀️ Clair</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--muted);padding:6px 4px;">Le thème s\'applique immédiatement à toute l\'application.</div>' +
    '</div>' +
  '</div>';

  /* ── Sous-page NOTIFICATIONS ── */
  var subNotifs =
  '<div id="stgSubNotifs" class="stg-subpage">' +
    '<div class="stg-safe-top"></div>' +
    '<div class="stg-header">' +
      '<div class="stg-back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></div>' +
      '<div class="stg-title">Notifications</div>' +
    '</div>' +
    '<div style="padding:0 16px 80px;">' +
      '<div class="stg-empty-state" style="margin-top:60px;">' +
        '<div class="stg-empty-icon">🔔</div>' +
        '<div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:8px;">Bientôt disponible</div>' +
        '<div class="stg-empty-text">Les notifications push arriveront dans une prochaine mise à jour.<br><br>Tu pourras choisir de recevoir des alertes pour les messages, bêtises et rappels du jour.</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  /* ── Injection ── */
  document.body.insertAdjacentHTML('beforeend', mainHTML + subCouple + subSecurity + subAbonnement + subPrefs + subAppearance + subNotifs);

  /* ── Event delegation — remplace tous les onclick= retirés des strings HTML (#89 CSP) ── */
  document.body.addEventListener('click', function(e) {
    var t = e.target;
    // stg-back : fermer le modal principal
    if (t.closest && t.closest('#settingsView > .stg-header .stg-back')) {
      window.closeAccountModal && window.closeAccountModal(); return;
    }
    // Avatar : upload
    if (t.closest && (t.closest('#acAvatarWrap') || t.closest('.stg-avatar-cam'))) {
      window.acTriggerAvatarUpload && window.acTriggerAvatarUpload(); return;
    }
    // Avatar : supprimer
    if (t.id === 'acDeleteAvatarBtn' || (t.closest && t.closest('#acDeleteAvatarBtn'))) {
      window.acDeleteAvatar && window.acDeleteAvatar(); return;
    }
    // Pseudo : éditer
    if (t.id === 'acEditPseudoBtn' || (t.closest && t.closest('#acEditPseudoBtn'))) {
      window.acToggleEditPseudo && window.acToggleEditPseudo(); return;
    }
    // Pseudo : sauvegarder (bouton \u2713 dans acEditPseudoRow)
    if (t.closest && t.closest('#acEditPseudoRow') && t.tagName === 'BUTTON' && t.textContent.trim() === '\u2713') {
      window.acSavePseudo && window.acSavePseudo(); return;
    }
    // Pseudo : annuler (bouton \u2715 dans acEditPseudoRow)
    if (t.closest && t.closest('#acEditPseudoRow') && t.tagName === 'BUTTON' && t.textContent.trim() === '\u2715') {
      window.acCancelEditPseudo && window.acCancelEditPseudo(); return;
    }
    // Déconnexion
    if (t.closest && t.closest('.stg-btn-danger')) {
      window.nativeLogout && window.nativeLogout(); return;
    }
    // Rows : ouvrir sous-pages (via data-sub ajouté dans le HTML)
    var row = t.closest && t.closest('.stg-row[data-sub]');
    if (row) { window.stgOpenSub && window.stgOpenSub(row.dataset.sub); return; }
    // stg-back dans sous-pages : fermer sous-page
    var backInSub = t.closest && t.closest('.stg-subpage .stg-back');
    if (backInSub) {
      var subPage = backInSub.closest('.stg-subpage');
      if (subPage) window.stgCloseSub && window.stgCloseSub(subPage.id); return;
    }
    // Copier code couple
    if (t.id === 'acCopyBtn') { window.acCopyCode && window.acCopyCode(); return; }
    // Délier partenaire
    if (t.id === 'acUnlinkBtn') { window.acConfirmUnlink && window.acConfirmUnlink(); return; }
    // Confirmer délier
    if (t.closest && t.closest('#acUnlinkConfirm')) {
      var btns = document.querySelectorAll('#acUnlinkConfirm button');
      if (t === btns[0]) { window.acDoUnlink && window.acDoUnlink(); return; }
      if (t === btns[1]) { window.acCancelUnlink && window.acCancelUnlink(); return; }
    }
    // Lier partenaire
    if (t.closest && t.closest('#acLinkSection') && t.tagName === 'BUTTON') {
      window.acLinkPartner && window.acLinkPartner(); return;
    }
    // Enregistrer date anniversaire
    if (t.closest && t.closest('#stgSubCouple') && t.tagName === 'BUTTON' && t.textContent.indexOf('Enregistrer') !== -1) {
      window.acSaveStartDate && window.acSaveStartDate(); return;
    }
    // Changer mot de passe
    if (t.closest && t.closest('#stgSubSecurity') && t.tagName === 'BUTTON' && t.textContent.indexOf('Changer') !== -1) {
      window.acChangePwd && window.acChangePwd(); return;
    }
    // Thème pills
    if (t.id === 'stgThemeDark')  { window.stgSetTheme && window.stgSetTheme('dark');  return; }
    if (t.id === 'stgThemeLight') { window.stgSetTheme && window.stgSetTheme('light'); return; }
  });

  // onchange avatar input
  document.body.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'acAvatarInput') {
      window.acHandleAvatarUpload && window.acHandleAvatarUpload(e.target);
    }
  });



  /* ── Navigation sous-pages ── */
  window.stgOpenSub = function(id){
    var el = document.getElementById(id);
    if(el) el.classList.add('active');
    // Sync thème pills
    if(id === 'stgSubAppearance') _stgSyncTheme();
    // Sync préférences tags
    if(id === 'stgSubPrefs') _stgLoadPrefs();
    // Charger l'email tronqué dans la page sécurité
    if(id === 'stgSubSecurity') _stgLoadEmail();
  };

  function _maskEmail(email){
    var parts = email.split('@');
    if(!parts[0] || !parts[1]) return email;
    var local = parts[0];
    var visible = local.length > 3 ? local.slice(0,3) : local.slice(0,1);
    return visible + '•••••@' + parts[1];
  }

  function _stgLoadEmail(){
    var el = document.getElementById('acEmailDisplay');
    if(!el) return;
    // Appel Supabase Auth pour récupérer l'email réel
    fetch(SB_URL + '/auth/v1/user', {
      headers: {
        'apikey': SB_ANON_KEY,
        'Authorization': 'Bearer ' + (yamGetAccessToken ? yamGetAccessToken() : ''),
      }
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if(data && data.email){
        el.textContent = _maskEmail(data.email);
      } else {
        el.textContent = '—';
      }
    })
    .catch(function(){ el.textContent = '—'; });
  }
  window.stgCloseSub = function(id){
    var el = document.getElementById(id);
    if(el) el.classList.remove('active');
  };

  /* ── Thème ── */
  function _stgSyncTheme(){
    var isLight = document.body.classList.contains('light') || document.documentElement.classList.contains('light');
    var d = document.getElementById('stgThemeDark');
    var l = document.getElementById('stgThemeLight');
    if(d) d.classList.toggle('active', !isLight);
    if(l) l.classList.toggle('active', isLight);
    var lbl = document.getElementById('stgThemeLabel');
    if(lbl) lbl.textContent = isLight ? 'Clair' : 'Sombre';
  }
  window.stgSetTheme = function(theme){
    if(typeof applyThemeToggle === 'function'){
      // applyThemeToggle bascule le thème — on vérifie si on doit toggler
      var isLight = document.body.classList.contains('light') || document.documentElement.classList.contains('light');
      if((theme === 'light' && !isLight) || (theme === 'dark' && isLight)){
        applyThemeToggle();
      }
    }
    setTimeout(_stgSyncTheme, 100);
  };

  /* ── Préférences (localStorage) ── */
  var _PREFS_KEY = 'yam_user_prefs';
  function _stgLoadPrefs(){
    var saved = {};
    try{ saved = JSON.parse(localStorage.getItem(_PREFS_KEY) || '{}'); }catch(e){}
    document.querySelectorAll('.stg-tag[data-pref]').forEach(function(tag){
      tag.classList.toggle('on', !!saved[tag.dataset.pref]);
    });
  }
  function _stgSavePrefs(){
    var prefs = {};
    document.querySelectorAll('.stg-tag.on[data-pref]').forEach(function(tag){
      prefs[tag.dataset.pref] = true;
    });
    localStorage.setItem(_PREFS_KEY, JSON.stringify(prefs));
    // Aussi sauvegarder en Supabase pour le partenaire
    var u = yamGetUser ? yamGetUser() : null;
    var cid = u ? u.couple_id : null;
    var role = u ? u.role : null;
    if(cid && role){
      var key = 'prefs_' + role;
      fetch(SB_URL+'/rest/v1/photo_descs?couple_id=eq.'+cid+'&category=eq.yam_prefs&slot=eq.'+key+'&select=id',{headers:sb2Headers()})
      .then(function(r){return r.ok?r.json():[];})
      .then(function(rows){
        if(rows && rows[0]){
          fetch(SB_URL+'/rest/v1/photo_descs?id=eq.'+rows[0].id,{method:'PATCH',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),body:JSON.stringify({description:JSON.stringify(prefs)})});
        } else {
          fetch(SB_URL+'/rest/v1/photo_descs',{method:'POST',headers:sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),body:JSON.stringify({couple_id:cid,category:'yam_prefs',slot:key,description:JSON.stringify(prefs)})});
        }
      }).catch(function(){});
    }
    var msg = document.getElementById('stgPrefsSaveMsg');
    if(msg){ msg.textContent = '✅ Préférences enregistrées'; setTimeout(function(){ msg.textContent = ''; }, 2000); }
  }

  /* Clic sur les tags */
  document.addEventListener('click', function(e){
    var tag = e.target.closest('.stg-tag[data-pref]');
    if(!tag) return;
    tag.classList.toggle('on');
    _stgSavePrefs();
  });

})();


window.openAccountModal = function(){
  var view = document.getElementById('settingsView');
  if(!view) return;
  view.classList.add('active');
  document.body.classList.add('settings-open');

  // Afficher la version du cache SW
  if('caches' in window) {
    caches.keys().then(function(keys) {
      var swCache = keys.find(function(k){ return k.startsWith('yam-'); }) || '';
      var el = document.getElementById('stgVersionLabel');
      if(el && swCache) el.textContent = swCache + ' — You And Me 💕';
    });
  }
  // Fermer le popup profil si ouvert
  var pp = document.getElementById('profilePopup');
  if(pp) pp.classList.remove('open');

  // Rafraîchir la session pour avoir les données les plus récentes
  if(window.v2RefreshSession){
    v2RefreshSession().then(function(u){
      if(!u) u = yamGetUser();
      _populateAccountModal(u);
    });
  } else {
    var u = yamGetUser ? yamGetUser() : null;
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
  var view = document.getElementById('settingsView');
  if(!view) return;
  // Fermer toutes les sous-pages d'abord
  document.querySelectorAll('.stg-subpage.active').forEach(function(sp){ sp.classList.remove('active'); });
  view.classList.remove('active');
  document.body.classList.remove('settings-open');
  // Scroll reset
  view.scrollTop = 0;
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
  var u = yamGetUser ? yamGetUser() : null;
  if(!u || !u.couple_id){ msg.textContent = '⚠️ Couple non lié'; msg.style.color = '#e05555'; return; }

  msg.textContent = '⏳ Enregistrement...'; msg.style.color = 'var(--muted)';
  var isoDate = val + 'T00:00:00';

  // Utiliser fetch direct avec service key n'est pas possible côté client.
  // On passe par l'Edge Function pour le PATCH avec privilèges.
  v3Auth('save_start_date', { couple_id: u.couple_id, start_date: isoDate })
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
  var u = yamGetUser ? yamGetUser() : null;
  if(!u){ msg.textContent = '⚠️ Non connecté'; msg.style.color = '#e05555'; return; }

  msg.textContent = '⏳ Modification en cours...'; msg.style.color = 'var(--muted)';

  // v3 : Supabase Auth natif — PATCH /auth/v1/user
  var token = yamGetAccessToken ? yamGetAccessToken() : '';
  fetch(SB_URL + '/auth/v1/user', {
    method: 'PUT',
    headers: { 'apikey': SB_ANON_KEY, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: newPwd })
  }).then(function(r){ return r.json(); }).then(function(data){
    if(data && data.error){
      msg.textContent = '❌ ' + (data.error || 'Erreur'); msg.style.color = '#e05555';
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
  var u = yamGetUser ? yamGetUser() : null;
  if(!u){ msg.textContent = '⚠️ Non connecté'; msg.style.color = '#e05555'; return; }
  if(u.partner_pseudo){ msg.textContent = '✅ Déjà lié à ' + escHtml(u.partner_pseudo); msg.style.color = 'var(--green)'; return; }

  msg.textContent = '⏳ Liaison en cours...'; msg.style.color = 'var(--muted)';

  yamJoinCouple(code)
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
          localStorage.setItem('yam_session_v3', JSON.stringify(s));
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
  var u = yamGetUser ? yamGetUser() : null;
  if(!u){ msg.textContent = '⚠️ Non connecté'; return; }
  msg.textContent = '⏳ Déliaison en cours...';
  v3Auth('unlink_partner', { user_id: u.id })
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
          localStorage.setItem('yam_session_v3', JSON.stringify(s));
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
  var u = yamGetUser ? yamGetUser() : null;
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
  var u = yamGetUser ? yamGetUser() : null;
  if(!u){ msg.textContent = '⚠️ Non connecté'; msg.style.color = '#e05555'; return; }
  msg.textContent = '⏳ Modification...'; msg.style.color = 'var(--muted)';
  v3Auth('update_pseudo', { user_id: u.id, new_pseudo: newPseudo })
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
        if(s && s.user){ s.user.pseudo = newPseudo; localStorage.setItem('yam_session_v3', JSON.stringify(s)); }
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
  var url = SB_URL + '/storage/v1/object/public/' + _AVATAR_BUCKET + '/' + path + '?t=' + Date.now();
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
  // Propager sur TOUS les éléments du rôle (topbar, mood cards, DM, Skyjo...)
  if(window._yamSyncAllAvatarsForRole) window._yamSyncAllAvatarsForRole(role, url);
  else {
    // Fallback si _yamSyncAllAvatarsForRole pas encore dispo
    if(window._yamRealAvatars) window._yamRealAvatars[role] = url;
    var mainEmoji = document.getElementById('profileAvatarEmoji');
    if(mainEmoji) mainEmoji.src = url;
  }
}

// ✅ FIX — Charge l'avatar du partenaire depuis Supabase Storage et propage partout
window._acLoadPartnerAvatar = function(){
  var u = (typeof yamGetUser === 'function') ? yamGetUser() : null;
  if(!u || !u.couple_id) return;
  fetch(SB_URL + '/rest/v1/profiles?couple_id=eq.' + u.couple_id + '&id=neq.' + u.id + '&select=id,role&limit=1',
    { headers: sb2Headers() })
  .then(function(r){ return r.ok ? r.json() : []; })
  .then(function(rows){
    if(!rows || !rows.length) return;
    var partner = rows[0];
    var url = SB_URL + '/storage/v1/object/public/images/avatars/' + partner.id + '.jpg?t=' + Date.now();
    var probe = new Image();
    probe.onload = function(){
      // Propager sur TOUS les éléments du rôle partenaire (topbar, mood cards, DM, Skyjo...)
      if(window._yamSyncAllAvatarsForRole) window._yamSyncAllAvatarsForRole(partner.role, url);
    };
    probe.onerror = function(){
      // Pas de photo → s'assurer que l'avatar par défaut est bien affiché partout
      var defaultSrc = partner.role === 'girl' ? 'assets/images/profil_girl.png' : 'assets/images/profil_boy.png';
      if(window._yamSyncAllAvatarsForRole) window._yamSyncAllAvatarsForRole(partner.role, defaultSrc);
    };
    probe.src = url;
  })
  .catch(function(){});
};

// Chargement automatique de l'avatar dans la topbar au démarrage (sans ouvrir le modal)
window._acLoadAvatarTopbarOnStart = function(u){
  if(!u) return;
  var _BUCKET = 'images';
  var path = 'avatars/' + u.id + '.jpg';
  var url = SB_URL + '/storage/v1/object/public/' + _BUCKET + '/' + path + '?t=' + Date.now();
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
  var u = yamGetUser ? yamGetUser() : null;
  if(!u) return;

  // Détection HEIC avant tout
  var isHeic = file.type === 'image/heic' || file.type === 'image/heif'
            || file.name.toLowerCase().endsWith('.heic')
            || file.name.toLowerCase().endsWith('.heif');
  if(isHeic){
    if(typeof showToast === 'function') showToast('Format HEIC non supporté — convertissez en JPG dans Photos puis réessayez', 'error', 4000);
    return;
  }

  var ALLOWED = ['image/jpeg','image/jpg','image/png','image/webp'];
  if(ALLOWED.indexOf(file.type) === -1){
    if(typeof showToast === 'function') showToast('Format non autorisé (JPEG, PNG, WebP)', 'error', 3000);
    return;
  }

  var wrap = document.getElementById('acAvatarWrap');
  if(wrap){ wrap.style.opacity = '0.5'; }
  var btn = document.getElementById('acAvatarWrap');
  if(btn){ btn.disabled = true; }

  // Compression : max 800px, cible 200 Ko
  window.compressImage(file, 800, 200 * 1024)
  .then(function(blob){
    var sizeKo = Math.round(blob.size / 1024);
    var path = 'avatars/' + u.id + '.jpg';
    return fetch(SB_URL + '/storage/v1/object/' + _AVATAR_BUCKET + '/' + path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, sb2Headers()),
      body: blob
    }).then(function(r){
      if(wrap) wrap.style.opacity = '';
      if(btn) btn.disabled = false;
      if(r.ok){
        var url = SB_URL + '/storage/v1/object/public/' + _AVATAR_BUCKET + '/' + path + '?t=' + Date.now();
        var img = document.getElementById('acAvatarImg');
        var emoji = document.getElementById('acAvatarEmoji');
        if(img){ img.src = url; img.style.display = ''; }
        if(emoji) emoji.style.display = 'none';
        var delBtn = document.getElementById('acDeleteAvatarBtn');
        if(delBtn) delBtn.style.display = 'flex';
        _acSyncAvatarTopbar(url, u.role);
        if(typeof showToast === 'function') showToast('✅ Photo mise à jour (' + sizeKo + ' Ko)', 'success', 2000);
      } else {
        r.text().then(function(t){ if(typeof showToast === 'function') showToast('Erreur upload : ' + t, 'error', 3000); });
      }
    });
  })
  .catch(function(err){
    if(wrap) wrap.style.opacity = '';
    if(btn) btn.disabled = false;
    if(err && err.message === 'HEIC_NOT_SUPPORTED'){
      if(typeof showToast === 'function') showToast('Format HEIC non supporté — convertissez en JPG', 'error', 4000);
    } else if(err && err.message === 'CANVAS_NOT_SUPPORTED'){
      // Fallback : uploader le fichier original sans compression
      var path = 'avatars/' + u.id + '.jpg';
      fetch(SB_URL + '/storage/v1/object/' + _AVATAR_BUCKET + '/' + path, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': file.type, 'x-upsert': 'true' }, sb2Headers()),
        body: file
      }).then(function(r){
        if(r.ok && typeof showToast === 'function') showToast('✅ Photo mise à jour (non compressée)', 'success', 2000);
      });
    } else {
      if(typeof showToast === 'function') showToast('Erreur : ' + (err && err.message || err), 'error', 3000);
    }
  });
};

// ✅ Suppression de la photo de profil
window.acDeleteAvatar = function(){
  var u = yamGetUser ? yamGetUser() : null;
  if(!u) return;
  if(!confirm('Supprimer ta photo de profil ?')) return;
  // ✅ Passe par l'Edge Function auth-v2 (service_role requis pour supprimer du storage)
  v3Auth('delete_avatar', { user_id: u.id })
  .then(function(res){
    if(!res || res.error){ if(typeof showToast==='function') showToast('Erreur : ' + (res && res.error || 'inconnue'), 'error', 3000); return; }
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
  .catch(function(err){ if(typeof showToast==='function') showToast('Erreur suppression : ' + err, 'error', 3000); });
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
    btn.innerHTML = '<span style="margin-right:6px;">⚙️</span> Paramètres';
    btn.onclick = function(){ openAccountModal(); };
    var logoutBtn = document.getElementById('ppBtnLogout');
    if(logoutBtn) pp.insertBefore(btn, logoutBtn);
    else pp.appendChild(btn);
    // Afficher seulement si connecté
    btn.style.display = yamGetUser() ? '' : 'none';
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
      if(btn) btn.style.display = yamGetUser() ? '' : 'none';
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
    var u = yamGetUser ? yamGetUser() : null;
    if(!u || !u.couple_id) return;
    
    // Sauvegarder l'état actuel pour comparaison
    if(_lastPartnerPseudo === null) _lastPartnerPseudo = u.partner_pseudo;
    if(_lastCoupleId === null) _lastCoupleId = u.couple_id;
    
    // Récupérer les données fraîches du partenaire
    fetch(SB_URL + '/rest/v1/profiles?couple_id=eq.' + u.couple_id + '&id=neq.' + u.id + '&select=pseudo,couple_id&limit=1', {
      headers: sb2Headers()
    })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(rows){
      if(!Array.isArray(rows)) return;
      
      // Cas 1 : Le partenaire n'existe plus (il s'est délié)
      if(rows.length === 0){
        // Vérifier si mon couple_id a changé côté serveur
        return fetch(SB_URL + '/rest/v1/profiles?id=eq.' + u.id + '&select=couple_id&limit=1', {
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
                    var modal = document.getElementById('settingsView');
                    if(modal && modal.classList.contains('active')){
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
              var modal = document.getElementById('settingsView');
              if(modal && modal.classList.contains('active')){
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
              var modal = document.getElementById('settingsView');
              if(modal && modal.classList.contains('active')){
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

  // Exposer stopPolling pour yamClearAllPolls (app-core.js)
  window._yamStopPartnerPoll = stopPolling;
  
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
  var MOOD_TABLE = 'moods';
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

  function get(){ var ls = localStorage.getItem(KEY); if(ls) return ls; var u = yamGetUser ? yamGetUser() : null; return u ? u.role : null; }
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
    var u = yamGetUser ? yamGetUser() : null;
    return u ? u.couple_id : null;
  }

  function saveMood(sender, emoji, message){
    var today = getTodayStr();
    var coupleId = getCoupleId();
    if (!coupleId) return;
    var msg = (typeof message === 'string') ? message.trim().slice(0, 120) : '';
    var u3 = yamGetUser ? yamGetUser() : null;
    fetch(SB_URL + '/rest/v1/' + MOOD_TABLE + '?couple_id=eq.' + coupleId + '&role=eq.' + sender + '&mood_date=eq.' + today, {
      method: 'DELETE', headers: sb2Headers()
    }).then(function(){
      fetch(SB_URL + '/rest/v1/' + MOOD_TABLE, {
        method: 'POST',
        headers: sb2Headers({'Prefer':'return=minimal'}),
        body: JSON.stringify({ role: sender, emoji: emoji, mood_date: today, couple_id: coupleId, user_id: u3 ? u3.id : null, message: msg || null })
      }).then(function(){
        if(typeof window.yamFlameActivity==='function') window.yamFlameActivity('mood_change');
      }).catch(function(){});
    }).catch(function(){});
  }

  var _lastOtherMood = null; // mémorise la dernière humeur connue de l'autre
  var _moodFirstLoad = true; // premier chargement → pas de notif
  window._myMoodMessage = ''; // message perso associé à l'humeur
  window._otherMoodMessage = ''; // message perso du partenaire

  function notifyMoodChange(emoji){
    // Scroll haut uniquement si on est sur la page principale (pas mode caché)
    var hiddenPage = document.getElementById('hiddenPage');
    var isHidden = hiddenPage && hiddenPage.classList.contains('active');
    if(!isHidden){
      // Supprimé : ce scroll causait un défilement visible au chargement après connexion
      // window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Déclencher la capsule pillule après un court délai (laisse le scroll se faire)
    setTimeout(function(){
      if(window.triggerMoodBandeau) triggerMoodBandeau();
    }, isHidden ? 0 : 400);
  }

  function loadMoods(){
    var today = getTodayStr();
    var coupleId = getCoupleId();
    var filter = '?mood_date=eq.' + today + (coupleId ? '&couple_id=eq.' + coupleId : '');
    fetch(SB_URL + '/rest/v1/' + MOOD_TABLE + filter, {
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
        if(profile && row.role === profile){
          selfFound = true;
          updateMoodBadge('self', row.emoji);
          window._myMood = row.emoji;
          window._myMoodMessage = row.message || '';
          var ppIcon = document.getElementById('ppMoodIcon');
          if(ppIcon) ppIcon.textContent = row.emoji;
        } else if(otherProfile && row.role === otherProfile){
          otherFound = true;
          window._otherMoodMessage = row.message || '';
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
        window._otherMoodMessage = '';
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
    var ppSep   = document.querySelector('#profilePopup .profile-popup-sep');

    if(!gender){
      // ── Non connecté : montrer le choix Elle/Lui ──
      if(avEmoji) avEmoji.textContent = EMOJIS.neutral;
      av.className = 'neutral';
      if(avOther) avOther.classList.remove('visible');
      var bandeau = document.getElementById('moodBandeau');
      if(bandeau) bandeau.classList.remove('visible','open');
      if(ppMood)  ppMood.style.display = 'none';
      if(bg) bg.style.display = 'flex';
      if(bb) bb.style.display = 'flex';
      if(ppLabel) ppLabel.textContent = 'Qui es-tu ?';
      if(ppSep) ppSep.style.display = 'none';
      var ppLogout2 = document.getElementById('ppBtnLogout');
      if(ppLogout2) ppLogout2.style.display = 'none';
    } else {
      // ── Connecté : masquer Elle/Lui, afficher pseudo + actions ──
      if(avEmoji) avEmoji.textContent = EMOJIS[gender];
      av.className = gender;
      if(avOther && avOtherE){
        avOtherE.textContent = EMOJIS[OTHER[gender]];
        avOther.classList.add('visible');
      }
      var bandeau2 = document.getElementById('moodBandeau');
      if(bandeau2) bandeau2.classList.add('visible');

      // Cacher les boutons Elle/Lui — inutiles une fois connecté
      if(bg) bg.style.display = 'none';
      if(bb) bb.style.display = 'none';

      // Afficher le pseudo en couleur selon le genre (rose=girl, bleu=boy)
      var u = (typeof yamGetUser === 'function') ? yamGetUser() : null;
      var displayName = u && u.pseudo ? u.pseudo : (gender === 'girl' ? 'Elle' : 'Lui');
      var pseudoColor = gender === 'girl' ? '#e879a0' : '#5b9cf6';
      if(ppLabel){
        ppLabel.textContent = displayName;
        ppLabel.style.cssText = 'font-size:16px;font-weight:700;color:' + pseudoColor + ';padding:0 16px 4px;letter-spacing:0;text-transform:none;border-bottom:none;';
      }

      if(ppMood) ppMood.style.display = 'flex';
      if(ppSep) ppSep.style.display = '';
      var ppLogout = document.getElementById('ppBtnLogout');
      if(ppLogout) ppLogout.style.display = 'flex';
    }
  }

  // ── Picker humeur ──
  function deleteMood(sender){
    var today = getTodayStr();
    fetch(SB_URL + '/rest/v1/' + MOOD_TABLE + '?role=eq.' + sender + '&mood_date=eq.' + today, {
      method: 'DELETE', headers: sb2Headers()
    }).catch(function(){});
  }

  // Catégories d'humeur — step 1 du picker
  var MOOD_CATEGORIES = [
    { label: '💖 Amour', emojis: ['😍','🥰','😊','🤗','😇','😏'] },
    { label: '⚡ Énergie', emojis: ['🔥','💪','🤩','🥳','😎','😂'] },
    { label: '🌧 Calme & Doux', emojis: ['😴','😔','🥺','😤','👤','😶'] }
  ];

  var _pickerStep = 1;          // 1 = choix emoji  |  2 = message
  var _pickerTempEmoji = null;  // emoji sélectionné en step 1 avant confirmation

  function _renderPickerStep1(){
    var picker = document.getElementById('moodPicker');
    if(!picker) return;
    var profile = get();
    var moodLabels = (profile === 'boy') ? MOOD_LABELS_BOY : MOOD_LABELS;

    picker.innerHTML = '';

    // Header
    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;';
    var lbl = document.createElement('div');
    lbl.className = 'mood-picker-label';
    lbl.style.marginBottom = '0';
    lbl.textContent = 'Comment tu te sens ?';
    var closeX = document.createElement('div');
    closeX.className = 'mood-picker-close';
    closeX.textContent = '✕';
    closeX.onclick = function(){ window.closeMoodPicker(); };
    hdr.appendChild(lbl); hdr.appendChild(closeX);
    picker.appendChild(hdr);

    // Affichage humeur actuelle
    if(window._myMood){
      var currentRow = document.createElement('div');
      currentRow.style.cssText = 'display:flex;align-items:center;gap:7px;background:var(--s2);border-radius:10px;padding:7px 10px;font-size:12px;color:var(--sub);';
      var curLabel = document.createElement('span');
      curLabel.textContent = 'Actuelle :';
      curLabel.style.cssText = 'font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:1px;';
      var curEmoji = document.createElement('span');
      curEmoji.style.fontSize = '18px';
      curEmoji.textContent = window._myMood;
      var curTxt = document.createElement('span');
      curTxt.style.cssText = 'font-weight:600;color:var(--text);flex:1;';
      curTxt.textContent = moodLabels[window._myMood] || '';
      var curMsg = document.createElement('span');
      curMsg.style.cssText = 'font-size:10px;color:var(--muted);font-style:italic;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      if(window._myMoodMessage) curMsg.textContent = '"' + window._myMoodMessage + '"';
      currentRow.appendChild(curLabel); currentRow.appendChild(curEmoji);
      currentRow.appendChild(curTxt); currentRow.appendChild(curMsg);
      picker.appendChild(currentRow);
    }

    // Catégories — accordéon replié par défaut, une seule ouverte à la fois
    // Si humeur active, ouvrir la catégorie correspondante
    var defaultOpenIdx = -1;
    if(window._myMood){
      MOOD_CATEGORIES.forEach(function(cat, idx){
        if(cat.emojis.indexOf(window._myMood) !== -1) defaultOpenIdx = idx;
      });
    }

    MOOD_CATEGORIES.forEach(function(cat, catIdx){
      var isOpen = (catIdx === defaultOpenIdx);

      var accordion = document.createElement('div');
      accordion.style.cssText = 'border-radius:10px;overflow:hidden;border:1px solid var(--border);margin-top:6px;';

      var catHdr = document.createElement('div');
      catHdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 11px;cursor:pointer;background:var(--s2);transition:background 0.15s;user-select:none;-webkit-user-select:none;';
      var catLblSpan = document.createElement('span');
      catLblSpan.style.cssText = 'font-size:11px;font-weight:700;color:var(--text);letter-spacing:0.3px;';
      catLblSpan.textContent = cat.label;
      var arrow = document.createElement('span');
      arrow.className = 'mood-cat-arrow';
      arrow.style.cssText = 'font-size:10px;color:var(--muted);transition:transform 0.2s;display:inline-block;flex-shrink:0;';
      arrow.textContent = '▾';
      if(!isOpen) arrow.style.transform = 'rotate(-90deg)';
      catHdr.appendChild(catLblSpan); catHdr.appendChild(arrow);

      var row = document.createElement('div');
      row.className = 'mood-cat-row';
      row.style.cssText = 'display:' + (isOpen ? 'grid' : 'none') + ';grid-template-columns:repeat(4,1fr);gap:6px;padding:10px;background:var(--s1);';

      cat.emojis.forEach(function(emoji){
        if(emoji === '👤' || emoji === '😶') return;
        var btn = document.createElement('div');
        btn.className = 'mood-emoji-btn' + (window._myMood === emoji ? ' selected' : '');
        btn.title = moodLabels[emoji] || emoji;
        var inner = document.createElement('div');
        inner.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;';
        var emojiSpan = document.createElement('span');
        emojiSpan.textContent = emoji;
        var lblSpan = document.createElement('span');
        lblSpan.style.cssText = 'font-size:7px;color:var(--muted);font-weight:600;line-height:1;max-width:40px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;';
        lblSpan.textContent = (moodLabels[emoji] || '').split(' ')[0];
        inner.appendChild(emojiSpan); inner.appendChild(lblSpan);
        btn.appendChild(inner);
        btn.onclick = function(){
          _pickerTempEmoji = emoji;
          _pickerStep = 2;
          _renderPickerStep2();
        };
        row.appendChild(btn);
      });

      catHdr.onclick = function(){
        var allRows = picker.querySelectorAll('.mood-cat-row');
        var allArrows = picker.querySelectorAll('.mood-cat-arrow');
        var isCurrentlyOpen = row.style.display !== 'none';
        allRows.forEach(function(r){ r.style.display = 'none'; });
        allArrows.forEach(function(a){ a.style.transform = 'rotate(-90deg)'; });
        if(!isCurrentlyOpen){
          row.style.display = 'grid';
          arrow.style.transform = '';
        }
      };

      accordion.appendChild(catHdr);
      accordion.appendChild(row);
      picker.appendChild(accordion);
    });


    // Bouton effacer (si humeur active)
    if(window._myMood){
      var clearBtn = document.createElement('div');
      clearBtn.className = 'mood-clear-btn';
      clearBtn.textContent = '🗑 Effacer mon humeur';
      clearBtn.style.display = 'flex';
      clearBtn.onclick = function(ev){
        ev.stopPropagation();
        var profile = get();
        if(!profile) return;
        deleteMood(profile);
        window._myMood = null;
        window._myMoodMessage = '';
        updateMoodBadge('self', null);
        var ppIcon = document.getElementById('ppMoodIcon');
        if(ppIcon) ppIcon.textContent = '😶';
        var selfBadge = document.getElementById('profileMoodSelf');
        if(selfBadge){ selfBadge.textContent = ''; selfBadge.classList.remove('visible'); }
        if(window.yamSyncMood) window.yamSyncMood();
        window.closeMoodPicker();
      };
      picker.appendChild(clearBtn);
    }

    picker.onclick = function(ev){ ev.stopPropagation(); };
  }

  function _renderPickerStep2(){
    var picker = document.getElementById('moodPicker');
    if(!picker) return;
    var profile = get();
    var moodLabels = (profile === 'boy') ? MOOD_LABELS_BOY : MOOD_LABELS;
    var emoji = _pickerTempEmoji;
    var label = moodLabels[emoji] || emoji;

    picker.innerHTML = '';

    // Header avec retour
    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
    var backBtn = document.createElement('div');
    backBtn.style.cssText = 'width:26px;height:26px;border-radius:8px;background:var(--s3);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;flex-shrink:0;transition:background 0.15s;';
    backBtn.textContent = '←';
    backBtn.onclick = function(){ _pickerStep = 1; _renderPickerStep1(); };
    var titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'display:flex;align-items:center;gap:6px;flex:1;';
    var emojiDisp = document.createElement('span');
    emojiDisp.style.fontSize = '22px';
    emojiDisp.textContent = emoji;
    var lblDisp = document.createElement('span');
    lblDisp.style.cssText = 'font-size:13px;font-weight:700;color:var(--text);';
    lblDisp.textContent = label;
    titleWrap.appendChild(emojiDisp); titleWrap.appendChild(lblDisp);
    var closeX = document.createElement('div');
    closeX.className = 'mood-picker-close';
    closeX.textContent = '✕';
    closeX.onclick = function(){ window.closeMoodPicker(); };
    hdr.appendChild(backBtn); hdr.appendChild(titleWrap); hdr.appendChild(closeX);
    picker.appendChild(hdr);

    // Séparateur
    var sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:var(--border);margin-bottom:8px;';
    picker.appendChild(sep);

    // Label message
    var msgLbl = document.createElement('div');
    msgLbl.style.cssText = 'font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:5px;';
    msgLbl.textContent = '💬 Ajouter un message (optionnel)';
    picker.appendChild(msgLbl);

    // Textarea message
    var textarea = document.createElement('textarea');
    textarea.id = 'moodMsgTextarea';
    textarea.maxLength = 120;
    textarea.placeholder = 'Un petit mot pour lui/elle… 💕';
    textarea.value = (emoji === window._myMood) ? (window._myMoodMessage || '') : '';
    textarea.style.cssText = 'width:100%;box-sizing:border-box;background:var(--s2);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;font-family:inherit;padding:9px 11px;resize:none;height:68px;outline:none;transition:border-color 0.18s;line-height:1.4;';
    textarea.onfocus = function(){ this.style.borderColor = 'var(--accent)'; };
    textarea.onblur  = function(){ this.style.borderColor = 'var(--border)'; };
    textarea.oninput = function(){
      var rem = document.getElementById('moodMsgCounter');
      if(rem) rem.textContent = (120 - this.value.length) + ' car. restants';
    };
    picker.appendChild(textarea);

    // Compteur de caractères
    var counter = document.createElement('div');
    counter.id = 'moodMsgCounter';
    counter.style.cssText = 'font-size:9px;color:var(--muted);text-align:right;margin-top:3px;margin-bottom:8px;';
    counter.textContent = '120 car. restants';
    picker.appendChild(counter);

    // Bouton Valider
    var confirmBtn = document.createElement('button');
    confirmBtn.style.cssText = 'width:100%;padding:10px;border-radius:10px;background:var(--green);color:#fff;font-weight:700;font-size:13px;border:none;cursor:pointer;transition:opacity 0.15s;font-family:inherit;';
    confirmBtn.textContent = '✓ Enregistrer mon humeur';
    confirmBtn.onclick = function(){
      var profile = get();
      if(!profile) return;
      var msg = textarea.value.trim().slice(0, 120);
      window._myMood = emoji;
      window._myMoodMessage = msg;
      saveMood(profile, emoji, msg);
      updateMoodBadge('self', emoji);
      var ppIcon = document.getElementById('ppMoodIcon');
      if(ppIcon) ppIcon.textContent = emoji;
      if(window.yamSyncMood) window.yamSyncMood();
      window.closeMoodPicker();
    };
    picker.appendChild(confirmBtn);

    picker.onclick = function(ev){ ev.stopPropagation(); };

    // Focus sur le textarea après un court délai
    setTimeout(function(){ textarea.focus(); }, 80);
  }

  window.openMoodPicker = function(e){
    if(e && e.stopPropagation) e.stopPropagation();
    var pp = document.getElementById('profilePopup');
    if(pp) pp.classList.remove('open');
    var picker = document.getElementById('moodPicker');
    if(!picker) return;
    _pickerStep = 1;
    _pickerTempEmoji = null;
    _renderPickerStep1();
    picker.classList.add('open');
    // Overlay sombre
    var overlay = document.getElementById('moodPickerOverlay');
    if(overlay) overlay.classList.add('visible');
    if(window._moodPickerTimer) clearTimeout(window._moodPickerTimer);
  };

  window.closeMoodPicker = function(){
    var picker = document.getElementById('moodPicker');
    if(picker) picker.classList.remove('open');
    var overlay = document.getElementById('moodPickerOverlay');
    if(overlay) overlay.classList.remove('visible');
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
    if(!pp) return;
    var isOpening = !pp.classList.contains('open');
    pp.classList.toggle('open');
    // Rafraichir le contenu a chaque ouverture (pseudo a jour, boutons corrects)
    if(isOpening) apply(get());
    var picker = document.getElementById('moodPicker');
    if(picker) picker.classList.remove('open');
  };

  // Fermer au clic extérieur
  document.addEventListener('click', function(e){
    var wrap         = document.getElementById('profileAvatarWrap');
    var avatarDirect = document.getElementById('profileAvatar');
    var stickyAvatar = document.getElementById('yamStickyAvatarSelf');
    var pp           = document.getElementById('profilePopup');
    var picker       = document.getElementById('moodPicker');
    var clickedInside = (wrap && wrap.contains(e.target))
      || (avatarDirect && avatarDirect.contains(e.target))
      || (stickyAvatar && stickyAvatar.contains(e.target));
    if(pp && pp.classList.contains('open') && !clickedInside && !pp.contains(e.target))
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
  var _initProfile = get() || (yamGetUser ? (yamGetUser()||{}).role : null);
  if(_initProfile) loadMoods();
  _moodFirstLoad = false;
  window._moodsPollIv = setInterval(function(){ if(get()) loadMoods(); }, 30000);
  window._moodsRTActive = false;

  // Exposer le stop pour yamClearAllPolls (app-core.js)
  window._yamStopMoodsPoll = function(){
    if(window._moodsPollIv){ clearInterval(window._moodsPollIv); window._moodsPollIv = null; }
  };

  // ✅ Realtime humeurs — remplace le poll 30s quand connecté — fallback si RT tombe
  (function(){
    var _moodsRTFallbackIv = null;

    function _startMoodsFallback(){
      if(_moodsRTFallbackIv) return;
      _moodsRTFallbackIv = setInterval(function(){ if(get()) loadMoods(); }, 30000);
      yamLog('[RT] humeurs fallback poll 30s activé');
    }
    function _stopMoodsFallback(){
      if(_moodsRTFallbackIv){ clearInterval(_moodsRTFallbackIv); _moodsRTFallbackIv = null; }
    }

    function _initMoodsRealtime(){
      if(!window._yamRT){ _startMoodsFallback(); return; }
      var u = typeof yamGetUser === 'function' ? yamGetUser() : null;
      var cid = u ? u.couple_id : null;
      if(!cid){ _startMoodsFallback(); return; }
      if(window._yamRTChannels && window._yamRTChannels['moods']) return;

      var ch = window._yamRT
        .channel('moods_' + cid)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'moods',
          filter: 'couple_id=eq.' + cid
        }, function(){
          if(get()) loadMoods();
        })
        .subscribe(function(status){
          if(status === 'SUBSCRIBED'){
            yamLog('[RT] humeurs connectées'); console.warn('[RT] ✅ humeurs connectées — Realtime actif');
            window._moodsRTActive = true;
            // Stoppe le poll 30s
            if(window._moodsPollIv){ clearInterval(window._moodsPollIv); window._moodsPollIv = null; }
            _stopMoodsFallback();
            if(get()) loadMoods();
          } else if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED'){
            yamLog('[RT] humeurs ' + status + ' — fallback poll'); console.warn('[RT] ⚠️ humeurs ' + status + ' — fallback poll 30s');
            window._moodsRTActive = false;
            if(window._yamRTChannels) delete window._yamRTChannels['moods'];
            _startMoodsFallback();
          }
        });
      if(window._yamRTChannels) window._yamRTChannels['moods'] = ch;
    }

    // Patch _yamStopMoodsPoll pour aussi stopper le fallback RT
    var _origStop = window._yamStopMoodsPoll;
    window._yamStopMoodsPoll = function(){
      if(window._moodsPollIv){ clearInterval(window._moodsPollIv); window._moodsPollIv = null; }
      _stopMoodsFallback();
    };

    setTimeout(function(){
      if(window._yamRT) _initMoodsRealtime();
    }, 2500);

    document.addEventListener('yam:session_ready', function(){
      setTimeout(_initMoodsRealtime, 1200);
    });

    // Upgrade vers RT dès que _yamRT est prêt
    document.addEventListener('yam:rt_ready', function(){
      setTimeout(_initMoodsRealtime, 200);
    });
  })();

  // ── Réinitialisation à minuit ──
  function resetMoodsUI(){
    window._myMood = null;
    window._myMoodMessage = '';
    window._otherMoodMessage = '';
    updateMoodBadge('self',  null);
    updateMoodBadge('other', null);
    var ppIcon  = document.getElementById('ppMoodIcon');
    if(ppIcon) ppIcon.textContent = '😶';
    var bandeau = document.getElementById('moodBandeau');
    if(bandeau){ clearTimeout(window._bandeauTimer); bandeau.classList.remove('open','visible','mood-highlight-girl','mood-highlight-boy'); }
    if(window.yamSyncMood) window.yamSyncMood();
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

/* ── Dépliant mot de passe ── */
window.acTogglePwdSection = function(){
  var section = document.getElementById('acPwdSection');
  var arrow   = document.getElementById('acPwdToggleArrow');
  if(!section) return;
  var isOpen = section.style.maxHeight && section.style.maxHeight !== '0px' && section.style.maxHeight !== '0';
  if(isOpen){
    section.style.maxHeight = '0';
    section.style.opacity = '0';
    section.style.pointerEvents = 'none';
    if(arrow) arrow.style.transform = '';
  } else {
    section.style.maxHeight = '400px';
    section.style.opacity = '1';
    section.style.pointerEvents = '';
    if(arrow) arrow.style.transform = 'rotate(180deg)';
  }
};
