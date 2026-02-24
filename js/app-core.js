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
  // Invalide le token côté serveur si une session active existe
  if(_sbAccessToken){
    await fetch(SB_URL+'/auth/v1/logout', {
      method:'POST', headers:{'apikey':SB_KEY,'Authorization':'Bearer '+_sbAccessToken}
    }).catch(function(){});
  }
  sessionStorage.removeItem('jayana_sb_session');
  localStorage.removeItem('jayana_profile');
  _sbAccessToken = null;
  location.reload();
}



// SUPABASE CONFIG
// ════════════════════════════════════════════
var SB_URL = 'https://zjmbyjpxqrojnuymnpcf.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqbWJ5anB4cXJvam51eW1ucGNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzEzNjcsImV4cCI6MjA4NzAwNzM2N30.vNRgLgCNqZ9g351YmodZoXYDqars-thVDFmri2Z3oxE';
var SB_IMG = SB_URL + '/storage/v1/object/public/images/';

function getProfile(){
  var v = localStorage.getItem('jayana_profile');
  return (v === 'boy' || v === 'girl') ? v : null;
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
  document.querySelectorAll('img[src^="https://zjmbyjpxqrojnuymnpcf.supabase.co/storage/v1/object/public/images/"]').forEach(function(img){
    img.src = img.src.replace('https://zjmbyjpxqrojnuymnpcf.supabase.co/storage/v1/object/public/images/', SB_IMG);
  });
})();

// ── Auth via Edge Function sécurisée ──
// Sécurité : secret vérifié côté Edge Function uniquement
// via la variable d'environnement Deno.env.get('APP_SECRET').
var _sbAccessToken = null;
var SB_SESSION_KEY = 'jayana_sb_session';
var SB_EDGE_FN     = SB_URL + '/functions/v1/get-token';
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
  var token = _sbAccessToken || SB_KEY;
  return Object.assign({'apikey':SB_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json'},extra||{});
}
function sbGet(table,params){
  var url=SB_URL+'/rest/v1/'+table+'?'+(params||'order=created_at.desc');
  return fetch(url,{headers:sbHeaders()}).then(function(r){return r.json();});
}
function sbPost(table,body){
  return fetch(SB_URL+'/rest/v1/'+table,{
    method:'POST',headers:sbHeaders({'Prefer':'return=representation'}),body:JSON.stringify(body)
  }).then(function(r){return r.json();});
}
function sbPatch(table,id,body){
  return fetch(SB_URL+'/rest/v1/'+table+'?id=eq.'+id,{
    method:'PATCH',headers:sbHeaders({'Prefer':'return=representation'}),body:JSON.stringify(body)
  }).then(function(r){return r.json();});
}
function sbDelete(table,id){
  return fetch(SB_URL+'/rest/v1/'+table+'?id=eq.'+id,{
    method:'DELETE',headers:sbHeaders()
  });
}

// ── COMPTEUR ──
var startDate = new Date('2024-10-29T00:00:00');
function updateCounter() {
  var d = Math.floor((new Date() - startDate) / 1000);
  document.getElementById('cnt-days').textContent  = Math.floor(d / 86400);
  document.getElementById('cnt-hours').textContent = String(Math.floor((d % 86400) / 3600)).padStart(2,'0');
  document.getElementById('cnt-mins').textContent  = String(Math.floor((d % 3600) / 60)).padStart(2,'0');
  document.getElementById('cnt-secs').textContent  = String(d % 60).padStart(2,'0');
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

// Gestion de la visibilité du bouton flottant selon la vue active
function updateFloatingThemeBtn() {
  var subviews = ['gamesView','memoryView','penduView','puzzleView','snakeView','skyjoView','quizView','hiddenPage'];
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


