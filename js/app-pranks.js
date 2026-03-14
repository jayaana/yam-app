// ═══════════════════════════════════════════════════════════
// app-pranks.js — Système de bêtises interactives (13 types)

if(typeof _subviewIds !== 'undefined') {
  _subviewIds.forEach(function(id) {
    var el = document.getElementById(id);
    if(!el) return;
    new MutationObserver(updateFloatingThemeBtn).observe(el, { attributes: true, attributeFilter: ['class','style'] });
  });
}

// ── BETISES ──
document.getElementById('betisesBtn').addEventListener('click', function() {
  var profile = getProfile();
  if(profile === 'girl' || profile === 'boy'){
    openPrankMenu();
  } else {
    // Pas connecté → proposer le choix de profil
    var existing = document.getElementById('betisesLoginModal');
    if(existing) existing.remove();
    var modal = document.createElement('div');
    modal.id = 'betisesLoginModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(6px);';
    modal.innerHTML =
      '<div style="background:var(--s1);border:1px solid var(--border);border-radius:20px;padding:28px 22px;width:100%;max-width:300px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.4);">'
      + '<div style="font-size:32px;margin-bottom:10px;">🤡</div>'
      + '<div style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700;color:var(--text);margin-bottom:6px;">Accès Bêtises</div>'
      + '<div style="font-size:12px;color:var(--muted);margin-bottom:20px;">Connecte-toi d\'abord pour accéder aux bêtises</div>'
      + '<div style="display:flex;gap:10px;justify-content:center;margin-bottom:16px;">'
      +   '<button id="betisesLoginGirl" style="flex:1;padding:12px 8px;border-radius:14px;border:1.5px solid var(--border);background:var(--bg);cursor:pointer;font-family:\'DM Sans\',sans-serif;display:flex;flex-direction:column;align-items:center;gap:5px;">'
      +     '<span style="font-size:26px;">👧</span><span style="font-size:13px;font-weight:700;color:var(--text);">'+(typeof v2GetDisplayName==="function"?v2GetDisplayName('girl'):'Elle')+'</span>'
      +   '</button>'
      +   '<button id="betisesLoginBoy" style="flex:1;padding:12px 8px;border-radius:14px;border:1.5px solid var(--border);background:var(--bg);cursor:pointer;font-family:\'DM Sans\',sans-serif;display:flex;flex-direction:column;align-items:center;gap:5px;">'
      +     '<span style="font-size:26px;">👦</span><span style="font-size:13px;font-weight:700;color:var(--text);">'+(typeof v2GetDisplayName==="function"?v2GetDisplayName('boy'):'Lui')+'</span>'
      +   '</button>'
      + '</div>'
      + '<span id="betisesLoginCancel" style="font-size:11px;color:var(--muted);cursor:pointer;">Annuler</span>'
      + '</div>';
    document.body.appendChild(modal);
    function pickProfile(g){
      modal.remove();
      if(window.showProfileCodeModal){
        showProfileCodeModal(g, function(){
          if(window._profileSave) window._profileSave(g);
          if(window._profileApply) window._profileApply(g);
          openPrankMenu();
        });
      }
    }
    document.getElementById('betisesLoginGirl').addEventListener('click', function(){ pickProfile('girl'); });
    document.getElementById('betisesLoginBoy').addEventListener('click', function(){ pickProfile('boy'); });
    document.getElementById('betisesLoginCancel').addEventListener('click', function(){ modal.remove(); });
    modal.addEventListener('click', function(e){ if(e.target === modal) modal.remove(); });
  }
});

/* ══════════════════════════════════════════════
   SYSTÈME BÊTISES INTERACTIVES
══════════════════════════════════════════════ */

(function(){
  var PRANK_TABLE = 'pranks';
  var _selectedType = null;
  var _activePrank  = null;

  var PRANK_DEFS = {
    shake:    { emoji:'📳', label:'L\'écran qui tremble' },
    curtain:  { emoji:'🌧️', label:'Le rideau d\'emojis' },
    intrus:   { emoji:'👾', label:'L\'intrus qui esquive' },
    flip:     { emoji:'🔤', label:'Le texte à l\'envers' },
    splash:   { emoji:'🎨', label:'La flaque de peinture' },
    lock:     { emoji:'🔐', label:'Le cadenas' },
    fog:      { emoji:'🌫️', label:'Le brouillard' },
    colors:   { emoji:'🌈', label:'Les couleurs folles' },
    keyboard: { emoji:'⌨️', label:'Le faux clavier' },
    target:   { emoji:'🎯', label:'La cible qui esquive' },
    memory:   { emoji:'🃏', label:'Memory express' },
    eyes:     { emoji:'👁️', label:'Les yeux qui surveillent' },
    notif:    { emoji:'🔔', label:'Envoyer une notification' }
  };

  function showPrankToast(msg){
    var t = document.createElement('div');
    t.className = 'prank-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); }, 2400);
  }

  /* ── Ouverture menu auteur ── */
  window.openPrankMenu = function(){
    var profile = getProfile();
    if(!profile){ showPrankToast('🔒 Connecte-toi d\'abord !'); return; }
    var s = yamGetUser ? {user: yamGetUser()} : null;
    var partnerPseudo = s && s.user ? s.user.partner_pseudo : null;
    if(!partnerPseudo){ showPrankToast('🔒 Lie-toi à un couple d\'abord !'); return; }
    var victim = (typeof v2GetDisplayName==="function"?v2GetDisplayName(profile==="boy"?"girl":"boy"):(profile==="boy"?"Elle":"Lui"));
    var el = document.getElementById('prankVictimName');
    if(el) el.textContent = victim;
    var menu = document.getElementById('prankMenu');
    menu.classList.add('show');
    // Bloquer le scroll body (iOS compatible)
    var scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';
    document.body.dataset.scrollY = scrollY;
    // Animation slide depuis yamJeuxTab
    var jeuxTab = document.getElementById('yamJeuxTab');
    var DUR = 300;
    menu.style.transition = 'none';
    menu.style.transform  = 'translateX(100%)';
    void menu.getBoundingClientRect();
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      menu.style.transition = 'transform '+DUR+'ms cubic-bezier(.4,0,.2,1)';
      menu.style.transform  = 'translateX(0)';
      setTimeout(function(){ menu.style.transition=''; menu.style.transform=''; }, DUR+50);
    }); });
  };
  window.closePrankMenu = function(){
    var menu = document.getElementById('prankMenu');
    var DUR = 300;
    menu.style.transition = 'transform '+DUR+'ms cubic-bezier(.4,0,.2,1)';
    menu.style.transform  = 'translateX(100%)';
    setTimeout(function(){
      menu.classList.remove('show');
      menu.style.transition = '';
      menu.style.transform  = '';
      // Restaurer le scroll
      var scrollY = parseInt(document.body.dataset.scrollY || '0');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    }, DUR);
  };

  /* ══ SWIPE DROITE pour fermer prankMenu ══ */
  (function(){
    var menu = document.getElementById('prankMenu');
    var startX = 0, startY = 0;
    menu.addEventListener('touchstart', function(e){
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    menu.addEventListener('touchend', function(e){
      var dx = e.changedTouches[0].clientX - startX;
      var dy = Math.abs(e.changedTouches[0].clientY - startY);
      if(dx > 80 && dy < 60){ closePrankMenu(); }
    }, { passive: true });
  })();

  /* ── Annuler toutes les bêtises en attente ── */
  window.prankCancelAll = function(){
    var profile = getProfile();
    if(!profile) return;
    var victim = profile === 'boy' ? 'girl' : 'boy';
    var btn = document.getElementById('prankCancelAllBtn');
    if(btn) btn.textContent = '⏳ Annulation…';
    // PATCH active=false au lieu de DELETE — permet à la victime de détecter l'annulation en cours
    fetch(SB_URL+'/rest/v1/'+PRANK_TABLE+'?couple_id=eq.'+coupleId+'&sender_role=eq.'+profile+'&active=eq.true', {
      method: 'PATCH',
      headers: sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
      body: JSON.stringify({ active: false })
    }).then(function(){
      if(btn) btn.textContent = '✅ Bêtises annulées !';
      setTimeout(function(){
        if(btn) btn.textContent = '🗑️ Annuler toutes mes bêtises en attente';
        document.getElementById('prankMenu').classList.remove('show');
        var scrollY = parseInt(document.body.dataset.scrollY || '0');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      }, 1200);
    }).catch(function(){
      if(btn) btn.textContent = '🗑️ Annuler toutes mes bêtises en attente';
      alert('Erreur réseau, réessaie !');
    });
  };

  /* ── Sélection type → modal message ── */
  // Bêtises qui n'ont pas besoin de message personnalisé
  var NO_MSG_PRANKS = ['eyes', 'target', 'fog', 'memory', 'colors', 'shake', 'curtain', 'intrus', 'flip', 'splash'];

  window.prankSelectType = function(type){
    _selectedType = type;
    // Fermer le menu
    document.getElementById('prankMenu').classList.remove('show');
    var scrollY = parseInt(document.body.dataset.scrollY || '0');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.overflow = '';
    window.scrollTo(0, scrollY);

    // Bêtises sans message → envoyer directement
    if(NO_MSG_PRANKS.indexOf(type) !== -1){
      sendPrankDirect(type);
      return;
    }

    // Bêtises avec message → ouvrir le modal
    var def = PRANK_DEFS[type];
    document.getElementById('prankMsgPreview').textContent = def.emoji;
    document.getElementById('prankMsgTitle').textContent   = 'Ton message final 😈';
    document.getElementById('prankMsgText').value          = '';
    var lockWrap = document.getElementById('prankLockWordWrap');
    var lockInput = document.getElementById('prankLockWord');
    if(type === 'lock'){
      lockWrap.style.display = 'block';
      if(lockInput) lockInput.value = '';
    } else {
      lockWrap.style.display = 'none';
    }
    document.getElementById('prankMsgModal').classList.add('show');
  };

  function sendPrankDirect(type){
    var profile = getProfile();
    if(!profile) return;
    var s = yamGetUser ? {user: yamGetUser()} : null;
    var coupleId = s && s.user ? s.user.couple_id : null;
    var partnerPseudo = s && s.user ? s.user.partner_pseudo : null;
    if(!partnerPseudo){ showPrankToast('🔒 Lie-toi à un couple d\'abord !'); return; }
    var victim = profile === 'boy' ? 'girl' : 'boy';
    var body = { type: type, sender_role: profile, couple_id: coupleId, active: true };
    fetch(SB_URL+'/rest/v1/'+PRANK_TABLE, {
      method:'POST', headers: sb2Headers({'Prefer':'return=minimal'}),
      body: JSON.stringify(body)
    }).then(function(){
      var fb = document.createElement('div');
      fb.className = 'clown-pop'; fb.textContent = '😈 Bêtise envoyée !';
      fb.style.fontSize = '18px'; fb.style.fontWeight = '700'; fb.style.color = '#e8507a';
      document.body.appendChild(fb);
      setTimeout(function(){ fb.remove(); }, 1200);
    }).catch(function(){ alert('Erreur réseau, réessaie !'); });
  }

  window.closePrankMsg = function(){
    document.getElementById('prankMsgModal').classList.remove('show');
    // Rouvrir le menu avec scroll bloqué
    var scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';
    document.body.dataset.scrollY = scrollY;
    document.getElementById('prankMenu').classList.add('show');
  };

  /* ── Envoi de la bêtise en base ── */
  window.prankSend = function(){
    var profile = getProfile();
    if(!profile) return;
    var s = yamGetUser ? {user: yamGetUser()} : null;
    var coupleId = s && s.user ? s.user.couple_id : null;
    var partnerPseudo = s && s.user ? s.user.partner_pseudo : null;
    if(!partnerPseudo){ showPrankToast('🔒 Lie-toi à un couple d\'abord !'); return; }
    var victim   = profile === 'boy' ? 'girl' : 'boy';
    var msg      = document.getElementById('prankMsgText').value.trim();
    var lockWord = (_selectedType === 'lock') ? (document.getElementById('prankLockWord').value.trim().toLowerCase()) : null;
    if(!msg){ document.getElementById('prankMsgText').focus(); return; }
    if(_selectedType === 'lock' && !lockWord){ document.getElementById('prankLockWord').focus(); return; }
    var s = yamGetUser ? {user: yamGetUser()} : null;
    var coupleId = s && s.user ? s.user.couple_id : null;
    var body = { type: _selectedType, sender_role: profile, couple_id: coupleId, active: true };
    if(lockWord) body.lock_word = lockWord;
    // On insère directement sans effacer les bêtises précédentes — la file d'attente s'en charge
    fetch(SB_URL+'/rest/v1/'+PRANK_TABLE, {
      method:'POST', headers: sb2Headers({'Prefer':'return=minimal'}),
      body: JSON.stringify(body)
    }).then(function(){
      document.getElementById('prankMsgModal').classList.remove('show');
      var fb = document.createElement('div');
      fb.className = 'clown-pop'; fb.textContent = '😈 Bêtise envoyée !';
      fb.style.fontSize = '18px'; fb.style.fontWeight = '700'; fb.style.color = '#e8507a';
      document.body.appendChild(fb);
      setTimeout(function(){ fb.remove(); }, 1200);
    }).catch(function(){ alert('Erreur réseau, réessaie !'); });
  };

  /* ── File d'attente des bêtises ── */
  var _prankQueue = [];

  /* ── Vérification au login de la victime ── */
  window.checkActivePrank = function(profile){
    var s = yamGetUser ? {user: yamGetUser()} : null;
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(!coupleId) return;
    var myRole = typeof getProfile === 'function' ? getProfile() : (yamGetUser ? (yamGetUser()||{}).role : null);
    var prankFilter = myRole ? '&sender_role=neq.'+myRole : '';
    fetch(SB_URL+'/rest/v1/'+PRANK_TABLE+'?couple_id=eq.'+coupleId+'&active=eq.true'+prankFilter+'&order=created_at.asc', {
      headers: sb2Headers()
    })
    .then(function(r){ return r.json(); })
    .then(function(rows){
      if(!rows || !rows.length) return;
      rows.forEach(function(row){
        // N'ajouter que si pas déjà dans la queue ni déjà active
        var alreadyQueued = _prankQueue.some(function(q){ return q.id === row.id; });
        var isActive = _activePrank && _activePrank.id === row.id;
        if(!alreadyQueued && !isActive) _prankQueue.push(row);
      });
      dequeueNextPrank();
    }).catch(function(){});
  };

  function dequeueNextPrank(){
    // Si une bêtise tourne déjà, on attend
    if(_activePrank) return;
    if(!_prankQueue.length) return;
    var next = _prankQueue.shift();
    _activePrank = next;
    setTimeout(function(){ triggerPrank(_activePrank); }, 800);
  }

  /* ── Déclenchement bêtise ── */
  function triggerPrank(p){
    if(!p) return;
    // Bloquer scroll et interactions du fond pendant la bêtise
    // (réappliqué même si une bêtise précédente était active)
    var scrollY = window.scrollY || parseInt(document.body.dataset.prankScrollY || '0');
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';
    document.body.dataset.prankScrollY = scrollY;
    document.body.classList.add('prank-active');
    switch(p.type){
      case 'shake':    startShake(p); break;
      case 'curtain':  startCurtain(p); break;
      case 'intrus':   startIntrus(p); break;
      case 'flip':     startFlip(p); break;
      case 'splash':   startSplash(p); break;
      case 'lock':     startLock(p); break;
      case 'fog':      startFog(p); break;
      case 'colors':   startColors(p); break;
      case 'keyboard': startKeyboard(p); break;
      case 'target':   startTarget(p); break;
      case 'memory':   startMemoryPrank(p); break;
      case 'eyes':     startEyes(p); break;
      case 'notif':    startNotif(p); break;
    }
  }

  function _prankUnlockScroll(){
    var scrollY = parseInt(document.body.dataset.prankScrollY || '0');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.overflow = '';
    document.body.dataset.prankScrollY = '';
    document.body.classList.remove('prank-active');
    window.scrollTo(0, scrollY);
  }

  /* ════ BÊTISE 7 : BROUILLARD ════ */
  var _fogTaps = 0; var _fogLock = false;
  var _fogIsIOS = !!window.CSS && !CSS.supports('backdrop-filter','blur(1px)') || /iPhone|iPad|iPod/.test(navigator.userAgent);
  function startFog(p){
    _fogTaps = 0; _fogLock = false;
    var overlay = document.getElementById('prankFogOverlay');
    overlay.classList.add('show');
    if(_fogIsIOS){
      // iOS : backdrop-filter désactivé → simuler avec fond semi-opaque blanc
      overlay.style.background = 'rgba(220,220,220,0.82)';
      overlay.style.backdropFilter = '';
      overlay.style.webkitBackdropFilter = '';
    } else {
      overlay.style.background = '';
      overlay.style.backdropFilter = 'blur(20px)';
      overlay.style.webkitBackdropFilter = 'blur(20px)';
    }
    document.getElementById('prankFogCount').textContent = 10;
    document.getElementById('prankFogBanner').classList.add('show');
    document.addEventListener('touchstart', onFogTap, { passive: false });
    document.addEventListener('click', onFogClick);
  }
  function onFogTap(e){ e.preventDefault(); if(_fogLock) return; _fogLock=true; setTimeout(function(){ _fogLock=false; },300); doFogTap(); }
  function onFogClick(){ if(_fogLock) return; doFogTap(); }
  function doFogTap(){
    _fogTaps++;
    var left = 10 - _fogTaps;
    document.getElementById('prankFogCount').textContent = Math.max(0, left);
    var overlay = document.getElementById('prankFogOverlay');
    if(_fogIsIOS){
      var alpha = Math.round(82 * (left / 10)) / 100;
      overlay.style.background = 'rgba(220,220,220,' + alpha + ')';
    } else {
      var blurVal = Math.round(20 * (left / 10));
      overlay.style.backdropFilter = 'blur('+blurVal+'px)';
      overlay.style.webkitBackdropFilter = 'blur('+blurVal+'px)';
    }
    if(_fogTaps >= 10){
      document.removeEventListener('touchstart', onFogTap);
      document.removeEventListener('click', onFogClick);
      overlay.classList.remove('show');
      overlay.style.background = '';
      document.getElementById('prankFogBanner').classList.remove('show');
      prankDone();
    }
  }

  /* ════ BÊTISE 8 : COULEURS FOLLES ════ */
  var _colorsAnim = null; var _colorsHue = 0;
  var _colorsHolding = false; var _colorsTimer = null; var _colorsProgress = 0;
  function startColors(p){
    _colorsHue = 0; _colorsProgress = 0; _colorsHolding = false;
    _colorsAnim = setInterval(function(){
      _colorsHue = (_colorsHue + 3) % 360;
      document.documentElement.style.filter = 'hue-rotate('+_colorsHue+'deg) saturate(2)';
    }, 30);
    document.getElementById('prankColorsBanner').classList.add('show');
    document.getElementById('prankColorsProgressBar').style.width = '0%';
    var btn = document.getElementById('prankColorsHoldBtn');
    var newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    function startHold(){ _colorsHolding=true; _colorsProgress=0; runColorsProgress(); }
    function stopHold(){ _colorsHolding=false; clearTimeout(_colorsTimer); document.getElementById('prankColorsProgressBar').style.width='0%'; }
    newBtn.addEventListener('mousedown', startHold);
    newBtn.addEventListener('touchstart', function(e){ e.preventDefault(); startHold(); }, { passive:false });
    newBtn.addEventListener('mouseup', stopHold);
    newBtn.addEventListener('mouseleave', stopHold);
    newBtn.addEventListener('touchend', stopHold);
    newBtn.addEventListener('touchcancel', stopHold);
  }
  function runColorsProgress(){
    if(!_colorsHolding) return;
    _colorsProgress += 4;
    document.getElementById('prankColorsProgressBar').style.width = Math.min(_colorsProgress,100)+'%';
    if(_colorsProgress >= 100){
      clearInterval(_colorsAnim);
      document.documentElement.style.filter = '';
      document.getElementById('prankColorsBanner').classList.remove('show');
      prankDone();
    } else {
      _colorsTimer = setTimeout(runColorsProgress, 80);
    }
  }

  /* ════ BÊTISE 9 : FAUX CLAVIER ════ */
  var KEYBOARD_WORDS = ['BISOUS','AMOUR','ZELDA','TRESOR','CHATON','SOLEIL','GATEAU','POISSON','PAPILLON','ETOILE'];
  var _kbWord = ''; var _kbTyped = ''; var _kbMap = {};
  var _kbHintTimer = null; var _kbHintInterval = null; var _kbHintActive = false;

  function startKeyboard(p){
    _kbWord = KEYBOARD_WORDS[Math.floor(Math.random()*KEYBOARD_WORDS.length)];
    _kbTyped = ''; _kbHintActive = false;
    clearTimeout(_kbHintTimer); clearInterval(_kbHintInterval);
    // Créer un mapping aléatoire lettre → touche affichée
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    var shuffled = letters.slice().sort(function(){ return Math.random()-0.5; });
    _kbMap = {};
    letters.forEach(function(l,i){ _kbMap[l] = shuffled[i]; });
    // Afficher le mot avec blur progressif
    var display = document.getElementById('pkbWordDisplay');
    display.innerHTML = _kbWord.split('').map(function(c){
      return '<span class="pkb-word-blur">'+c+'</span>';
    }).join('');
    var spans = display.querySelectorAll('.pkb-word-blur');
    spans.forEach(function(s,i){ setTimeout(function(){ s.style.filter='none'; }, i*600); });
    document.getElementById('pkbTyped').textContent = '';
    document.getElementById('pkbErr').textContent = '';
    // Construire la grille
    var grid = document.getElementById('pkbGrid');
    grid.innerHTML = '';
    var keysToShow = Object.keys(_kbMap);
    keysToShow.forEach(function(realLetter){
      var key = document.createElement('div');
      key.className = 'pkb-key';
      key.textContent = _kbMap[realLetter];
      key.dataset.real = realLetter;
      key.addEventListener('touchstart', function(e){ e.preventDefault(); kbPress(realLetter); }, { passive:false });
      key.addEventListener('click', function(){ kbPress(realLetter); });
      grid.appendChild(key);
    });
    var bk = document.createElement('div');
    bk.className = 'pkb-key backspace'; bk.textContent = '⌫ Effacer';
    bk.addEventListener('touchstart', function(e){ e.preventDefault(); kbBackspace(); }, { passive:false });
    bk.addEventListener('click', kbBackspace);
    grid.appendChild(bk);
    document.getElementById('prankKeyboard').classList.add('show');
    // Après 8s sans succès → faire clignoter les bonnes touches une par une
    _kbHintTimer = setTimeout(kbShowHints, 8000);
  }

  function kbShowHints(){
    _kbHintActive = true;
    // Toutes les bonnes touches du mot clignotent ensemble en boucle
    var wordLetters = _kbWord.split('').filter(function(c,i,arr){ return arr.indexOf(c)===i; });
    var visible = true;
    _kbHintInterval = setInterval(function(){
      visible = !visible;
      document.querySelectorAll('.pkb-key').forEach(function(k){
        if(wordLetters.indexOf(k.dataset.real) !== -1){
          if(visible) k.classList.add('hint');
          else k.classList.remove('hint');
        }
      });
    }, 600);
  }

  function kbPress(letter){
    if(_kbTyped.length >= _kbWord.length) return;
    // Réinitialiser le timer d'indice à chaque frappe
    clearTimeout(_kbHintTimer); clearInterval(_kbHintInterval);
    document.querySelectorAll('.pkb-key.hint').forEach(function(k){ k.classList.remove('hint'); });
    _kbHintTimer = setTimeout(kbShowHints, 8000);
    _kbTyped += letter;
    var el = document.getElementById('pkbTyped');
    el.textContent = _kbTyped;
    el.style.color = '';
    document.getElementById('pkbErr').textContent = '';
    // Vérifier lettre par lettre si on a atteint la longueur du mot
    if(_kbTyped.length === _kbWord.length){
      if(_kbTyped === _kbWord){
        clearTimeout(_kbHintTimer); clearInterval(_kbHintInterval);
        document.getElementById('prankKeyboard').classList.remove('show');
        prankDone();
      } else {
        // Trouver la première lettre fausse et effacer à partir de là
        var firstBad = -1;
        for(var i=0; i<_kbTyped.length; i++){
          if(_kbTyped[i] !== _kbWord[i]){ firstBad = i; break; }
        }
        el.style.color = '#e05555';
        document.getElementById('pkbErr').textContent = '❌ Lettre '+(firstBad+1)+' incorrecte !';
        // Effacer seulement à partir de la mauvaise lettre
        setTimeout(function(){
          _kbTyped = _kbTyped.slice(0, firstBad);
          el.textContent = _kbTyped;
          el.style.color = '';
          document.getElementById('pkbErr').textContent = '';
        }, 700);
      }
    }
  }
  function kbBackspace(){
    _kbTyped = _kbTyped.slice(0,-1);
    document.getElementById('pkbTyped').textContent = _kbTyped;
    document.getElementById('pkbErr').textContent = '';
  }

  /* ════ BÊTISE 10 : CIBLE ════ */
  var _targetHits = 0; var _targetSpeed = 180; var _targetMoveTimer = null; var _targetLock = false;
  function startTarget(p){
    _targetHits = 0; _targetSpeed = 180; _targetLock = false;
    var el = document.getElementById('prankTarget');
    el.classList.add('show');
    document.getElementById('prankTargetCount').textContent = 10;
    document.getElementById('prankTargetBanner').classList.add('show');
    moveTarget();
    _targetMoveTimer = setInterval(moveTarget, _targetSpeed * 3);
    el.addEventListener('touchstart', onTargetHit, { passive:false });
    el.addEventListener('click', onTargetHit);
  }
  function moveTarget(){
    var el = document.getElementById('prankTarget');
    var size = 64;
    var x = 8 + Math.random()*(window.innerWidth - size - 16);
    var y = 60 + Math.random()*(window.innerHeight - size - 200);
    el.style.left = x+'px'; el.style.top = y+'px';
    el.style.transition = 'left '+(_targetSpeed/1000)+'s cubic-bezier(.4,2,.55,.9), top '+(_targetSpeed/1000)+'s cubic-bezier(.4,2,.55,.9)';
  }
  function onTargetHit(e){
    e.stopPropagation();
    if(e.type==='touchstart') e.preventDefault();
    if(_targetLock) return; _targetLock=true; setTimeout(function(){ _targetLock=false; },200);
    _targetHits++;
    var left = 10 - _targetHits;
    document.getElementById('prankTargetCount').textContent = left;
    // Accélérer à chaque touche
    _targetSpeed = Math.max(60, _targetSpeed - 12);
    clearInterval(_targetMoveTimer);
    moveTarget();
    _targetMoveTimer = setInterval(moveTarget, Math.max(600, _targetSpeed*3));
    if(_targetHits >= 10){
      clearInterval(_targetMoveTimer);
      var el = document.getElementById('prankTarget');
      el.classList.remove('show');
      el.removeEventListener('touchstart', onTargetHit);
      el.removeEventListener('click', onTargetHit);
      document.getElementById('prankTargetBanner').classList.remove('show');
      prankDone();
    }
  }

  /* ════ BÊTISE 11 : MEMORY EXPRESS ════ */
  var MEMORY_EMOJIS = ['💖','🌸','🎀','🦋','🌈','🍓','⭐','🎵'];
  var _memCards = []; var _memFlipped = []; var _memMatched = 0; var _memLock = false;
  function startMemoryPrank(p){
    _memMatched = 0; _memFlipped = []; _memLock = true;
    var pairs = MEMORY_EMOJIS.slice(0,4);
    var deck = pairs.concat(pairs).sort(function(){ return Math.random()-0.5; });
    var grid = document.getElementById('pmemGrid');
    grid.innerHTML = '';
    _memCards = [];
    deck.forEach(function(emoji, i){
      var card = document.createElement('div');
      card.className = 'pmem-card flipped'; // commence retournée (emoji visible)
      card.innerHTML = '<div class="pmem-face pmem-back">❓</div><div class="pmem-face pmem-front">'+emoji+'</div>';
      card.dataset.emoji = emoji;
      card.dataset.idx = i;
      card.addEventListener('touchstart', function(e){ e.preventDefault(); memFlip(card); }, { passive:false });
      card.addEventListener('click', function(){ memFlip(card); });
      grid.appendChild(card);
      _memCards.push(card);
    });
    document.getElementById('pmemSub').textContent = 'Mémorise les paires… tu as 3 secondes !';
    document.getElementById('pmemStatus').textContent = '';
    document.getElementById('prankMemoryOverlay').classList.add('show');
    // Après 3s, retourner toutes les cartes face cachée
    setTimeout(function(){
      _memCards.forEach(function(c){ c.classList.remove('flipped'); });
      document.getElementById('pmemSub').textContent = 'Retrouve les 4 paires !';
      _memLock = false;
    }, 3000);
  }
  function memFlip(card){
    if(_memLock) return;
    if(card.classList.contains('flipped') || card.classList.contains('matched')) return;
    card.classList.add('flipped');
    _memFlipped.push(card);
    if(_memFlipped.length === 2){
      _memLock = true;
      var a = _memFlipped[0], b = _memFlipped[1];
      if(a.dataset.emoji === b.dataset.emoji){
        a.classList.add('matched'); b.classList.add('matched');
        _memMatched++;
        document.getElementById('pmemStatus').textContent = _memMatched + ' / 4 paires trouvées';
        _memFlipped = []; _memLock = false;
        if(_memMatched >= 4){
          setTimeout(function(){
            document.getElementById('prankMemoryOverlay').classList.remove('show');
            prankDone();
          }, 600);
        }
      } else {
        setTimeout(function(){
          a.classList.remove('flipped'); b.classList.remove('flipped');
          _memFlipped = []; _memLock = false;
        }, 900);
      }
    }
  }

  /* ════ BÊTISE 12 : LES YEUX ════ */
  var _eyesPairs = []; var _eyesCurrent = 0; var _eyesTimer = null; var _eyesProgress = 0;
  var _eyesAnimFrame = null; var _eyesInterrupted = false;
  function startEyes(p){
    _eyesCurrent = 0; _eyesInterrupted = false;
    var overlay = document.getElementById('prankEyesOverlay');
    overlay.innerHTML = '';
    overlay.classList.add('show');
    document.getElementById('prankEyesBanner').classList.add('show');
    _eyesPairs = [];
    // Créer 3 paires mais les ajouter une par une au bon moment
    cancelAnimationFrame(_eyesAnimFrame);
    _eyesAnimFrame = requestAnimationFrame(trackEyes);
    // Lancer la première paire
    showNextEyePair(overlay);
  }

  function randomEyePos(existing){
    var x, y, safe, attempts = 0;
    do {
      safe = true;
      x = 20 + Math.random()*(window.innerWidth - 140);
      y = 80 + Math.random()*(window.innerHeight - 260);
      existing.forEach(function(pos){ if(Math.abs(pos.x-x)<150&&Math.abs(pos.y-y)<90) safe=false; });
      attempts++;
    } while(!safe && attempts < 20);
    return {x:x, y:y};
  }

  function showNextEyePair(overlay){
    var idx = _eyesPairs.length;
    if(idx >= 4){ return; } // ne pas créer plus de 4
    var pos = randomEyePos(_eyesPairs.map(function(p){ return {x:parseInt(p.el.style.left),y:parseInt(p.el.style.top)}; }));
    var pair = createEyePair(idx, pos.x, pos.y);
    // Apparition en fondu
    pair.el.style.opacity = '0';
    pair.el.style.transform = 'scale(0.5)';
    pair.el.style.transition = 'opacity 0.4s ease, transform 0.4s cubic-bezier(.4,2,.55,.9)';
    overlay.appendChild(pair.el);
    _eyesPairs.push(pair);
    // Lancer l'animation de clignement
    startEyeBlink(pair);
    setTimeout(function(){
      pair.el.style.opacity = '1';
      pair.el.style.transform = 'scale(1)';
    }, 50);
    // Commencer le timer de fixation après l'apparition
    setTimeout(function(){ startEyePair(idx); }, 500);
  }

  function startEyeBlink(pair){
    // Clignement aléatoire toutes les 2-5s
    function blink(){
      var eyes = pair.el.querySelectorAll('.prank-eye');
      eyes.forEach(function(eye){
        eye.classList.add('blink');
        setTimeout(function(){ eye.classList.remove('blink'); }, 180);
      });
      var next = 2000 + Math.random()*3000;
      pair.blinkTimer = setTimeout(blink, next);
    }
    pair.blinkTimer = setTimeout(blink, 1000 + Math.random()*2000);
  }

  function createEyePair(idx, x, y){
    var el = document.createElement('div');
    el.className = 'prank-eye-pair';
    el.style.left = x+'px'; el.style.top = y+'px';
    el.innerHTML = [0,1].map(function(){
      return '<div class="prank-eye"><div class="prank-eye-lid"></div><div class="prank-eye-pupil"></div><div class="prank-eye-ring"></div></div>';
    }).join('');
    var timer = document.createElement('div');
    timer.className = 'prank-eye-timer';
    timer.textContent = '';
    el.appendChild(timer);
    return { el:el, idx:idx, done:false, timer:timer, blinkTimer:null };
  }

  function trackEyes(){
    var cx = window.innerWidth/2, cy = window.innerHeight/2;
    _eyesPairs.forEach(function(pair){
      var rect = pair.el.getBoundingClientRect();
      var pupils = pair.el.querySelectorAll('.prank-eye-pupil');
      pupils.forEach(function(pupil, i){
        var eyeCx = rect.left + (i===0 ? 26 : 86);
        var eyeCy = rect.top + 26;
        var dx = cx - eyeCx, dy = cy - eyeCy;
        var dist = Math.sqrt(dx*dx+dy*dy);
        var max = 12;
        var tx = dist>0 ? (dx/dist)*Math.min(dist,max) : 0;
        var ty = dist>0 ? (dy/dist)*Math.min(dist,max) : 0;
        pupil.style.transform = 'translate('+tx+'px,'+ty+'px)';
      });
    });
    _eyesAnimFrame = requestAnimationFrame(trackEyes);
  }

  function startEyePair(idx){
    if(idx >= 4){ eyesDone(); return; }
    var pair = _eyesPairs[idx];
    var rings = pair.el.querySelectorAll('.prank-eye-ring');
    rings.forEach(function(r){ r.classList.add('active'); });
    var timeLeft = 5;
    pair.timer.textContent = timeLeft+'s';
    _eyesTimer = setInterval(function(){
      timeLeft--;
      pair.timer.textContent = timeLeft > 0 ? timeLeft+'s' : '✅';
      if(timeLeft <= 0){
        clearInterval(_eyesTimer);
        rings.forEach(function(r){ r.classList.remove('active'); });
        clearTimeout(pair.blinkTimer);
        pair.done = true;
        // Disparition en fondu puis paire suivante
        pair.el.style.opacity = '0';
        pair.el.style.transform = 'scale(0.5)';
        setTimeout(function(){
          pair.el.remove();
          var overlay = document.getElementById('prankEyesOverlay');
          if(idx + 1 < 4){
            showNextEyePair(overlay);
          } else {
            eyesDone();
          }
        }, 400);
      }
    }, 1000);
  }

  function eyesDone(){
    cancelAnimationFrame(_eyesAnimFrame);
    clearInterval(_eyesTimer);
    _eyesPairs.forEach(function(p){ clearTimeout(p.blinkTimer); });
    document.getElementById('prankEyesOverlay').classList.remove('show');
    document.getElementById('prankEyesBanner').classList.remove('show');
    var msg = document.getElementById('prankEyesMessage');
    msg.classList.add('show');
    setTimeout(function(){
      msg.classList.remove('show');
      if(_activePrank){
        fetch(SB_URL+'/rest/v1/'+PRANK_TABLE+'?id=eq.'+_activePrank.id, {
          method:'PATCH',
          headers: sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
          body: JSON.stringify({ active: false })
        }).catch(function(){});
        _activePrank = null;
        setTimeout(function(){ dequeueNextPrank(); }, 500);
      }
    }, 3500);
  }

  /* ════ BÊTISE 13 : FAUSSE NOTIF ════ */
  function startNotif(p){
    var authorName = (typeof v2GetDisplayName==="function"?v2GetDisplayName(p.author):(p.author==="boy"?"Lui":"Elle"));
    var avatar = p.author === 'boy' ? '💙' : '💖';
    document.getElementById('pnAvatar').textContent = avatar;
    document.getElementById('pnApp').textContent = 'Nouveau message';
    document.getElementById('pnTitle').textContent = authorName;
    document.getElementById('pnBody').textContent = p.message || '…';
    // 1. Scroll vers le haut
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // 2. Après le scroll (~500ms) : bloquer le scroll + afficher overlay + notif
    setTimeout(function(){
      // Bloquer le scroll
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = '0';
      // Overlay sombre
      var overlay = document.getElementById('prankNotifOverlay');
      if(overlay) overlay.classList.add('active');
      // Vibration
      if(navigator.vibrate){ navigator.vibrate([100, 50, 100, 50, 200]); }
      // Notif
      setTimeout(function(){
        document.getElementById('prankNotif').classList.add('show');
      }, 200);
    }, 550);
  }
  window.prankNotifDismiss = function(){
    var notif   = document.getElementById('prankNotif');
    var overlay = document.getElementById('prankNotifOverlay');
    notif.classList.remove('show');
    if(overlay) overlay.classList.remove('active');
    // Débloquer le scroll
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
    setTimeout(function(){
      if(_activePrank){
        fetch(SB_URL+'/rest/v1/'+PRANK_TABLE+'?id=eq.'+_activePrank.id, {
          method:'PATCH',
          headers: sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
          body: JSON.stringify({ active: false })
        }).catch(function(){});
        _activePrank = null;
        setTimeout(function(){ dequeueNextPrank(); }, 300);
      }
    }, 400);
  };

  
  function abortActivePrank(){
    if(!_activePrank) return;
    _activePrank = null;
    _prankQueue  = [];

    document.body.classList.remove('prank-shake');
    document.body.classList.remove('prank-flip');
    document.documentElement.style.filter = '';

    ['prankShakeBanner','prankFlipBanner','prankCurtainBanner','prankIntrusBanner',
     'prankSplashBanner','prankFogBanner','prankColorsBanner','prankTargetBanner',
     'prankEyesBanner','prankEyesMessage'].forEach(function(id){
      var el = document.getElementById(id); if(el) el.classList.remove('show');
    });
    ['prankCurtain','prankSplash','prankFogOverlay','prankKeyboard',
     'prankMemoryOverlay','prankEyesOverlay','prankLock'].forEach(function(id){
      var el = document.getElementById(id); if(el) el.classList.remove('show');
    });
    ['prankIntrus','prankTarget','prankNotif','prankNotifOverlay'].forEach(function(id){
      var el = document.getElementById(id); if(el) el.classList.remove('show','active');
    });
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
    _prankUnlockScroll();

    if(_intrusTimer){ clearInterval(_intrusTimer); _intrusTimer = null; }
    if(_targetMoveTimer){ clearInterval(_targetMoveTimer); _targetMoveTimer = null; }
    if(_colorsAnim){ clearInterval(_colorsAnim); _colorsAnim = null; }
    if(_eyesAnimFrame){ cancelAnimationFrame(_eyesAnimFrame); _eyesAnimFrame = null; }
    if(_eyesTimer){ clearInterval(_eyesTimer); _eyesTimer = null; }
    if(_kbHintInterval){ clearInterval(_kbHintInterval); _kbHintInterval = null; }
    if(_kbHintTimer){ clearTimeout(_kbHintTimer); _kbHintTimer = null; }
    if(typeof _shakeMaxTimer!=='undefined'&&_shakeMaxTimer){ clearTimeout(_shakeMaxTimer); _shakeMaxTimer=null; }

    document.removeEventListener('touchstart', onShakeTap);
    document.removeEventListener('click', onShakeClick);
    document.removeEventListener('touchstart', onFogTap);
    document.removeEventListener('click', onFogClick);
  }

  /* ── Marquer la bêtise comme terminée ── */
  function prankDone(){
    if(!_activePrank) return;
    fetch(SB_URL+'/rest/v1/'+PRANK_TABLE+'?id=eq.'+_activePrank.id, {
      method:'PATCH',
      headers: sb2Headers({'Content-Type':'application/json','Prefer':'return=minimal'}),
      body: JSON.stringify({ active: false })
    }).catch(function(){});
    showGotcha(_activePrank);
    _activePrank = null;
    _prankUnlockScroll();
    // Déclencher la suivante en attente après le gotcha
    setTimeout(function(){ dequeueNextPrank(); }, 2000);
  }

  /* ── Écran gotcha ── */
  function showGotcha(p){
    var authorName = (typeof v2GetDisplayName==="function"?v2GetDisplayName(p.author):(p.author==="boy"?"Lui":"Elle"));
    document.getElementById('gotchaMsg').textContent = p.message || '😈';
    document.getElementById('prankGotcha').classList.add('show');
  }
  window.closeGotcha = function(){
    document.getElementById('prankGotcha').classList.remove('show');
    // Ne pas délocker si une nouvelle bêtise est déjà en cours
    if(!_activePrank) _prankUnlockScroll();
  };

  /* ════ BÊTISE 1 : TREMBLEMENT ════ */
  var _shakeTaps = 0; var _shakeTimer = null; var _shakeLock = false;
  var _shakeMaxTimer = null; // sécurité : arrêt automatique après 20s max
  function startShake(p){
    _shakeTaps = 0;
    _shakeLock = false;
    // Scroll en haut pour que la victime voie le bandeau d'instruction
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.classList.add('prank-shake');
    var banner = document.getElementById('prankShakeBanner');
    banner.classList.add('show');
    updateShakeCount();
    // On écoute uniquement touchstart sur mobile, click sur desktop
    // passive:false pour pouvoir appeler preventDefault
    document.addEventListener('touchstart', onShakeTap, { passive: false });
    document.addEventListener('click', onShakeClick);
    // Sécurité : arrêt automatique au bout de 4s pour éviter surchauffe
    if(_shakeMaxTimer) clearTimeout(_shakeMaxTimer);
    _shakeMaxTimer = setTimeout(function(){
      document.removeEventListener('touchstart', onShakeTap);
      document.removeEventListener('click', onShakeClick);
      document.body.classList.remove('prank-shake');
      var b = document.getElementById('prankShakeBanner');
      if(b) b.classList.remove('show');
      prankDone();
    }, 20000);
  }
  function updateShakeCount(){
    var el = document.getElementById('prankShakeCount');
    var left = 10 - _shakeTaps;
    if(el) el.textContent = left + ' tap' + (left > 1 ? 's' : '') + ' restant' + (left > 1 ? 's' : '') + ' !';
  }
  function onShakeTap(e){
    // touchstart : on bloque le click fantôme qui suit (~300ms après)
    e.preventDefault();
    if(_shakeLock) return;
    _shakeLock = true;
    setTimeout(function(){ _shakeLock = false; }, 400);
    doShakeTap();
  }
  function onShakeClick(){
    // click : ne compte que si aucun touch ne vient de se déclencher
    if(_shakeLock) return;
    doShakeTap();
  }
  function doShakeTap(){
    _shakeTaps++;
    updateShakeCount();
    if(_shakeTaps >= 10){
      if(_shakeMaxTimer){ clearTimeout(_shakeMaxTimer); _shakeMaxTimer = null; }
      document.removeEventListener('touchstart', onShakeTap);
      document.removeEventListener('click', onShakeClick);
      document.body.classList.remove('prank-shake');
      document.getElementById('prankShakeBanner').classList.remove('show');
      prankDone();
    }
  }

  /* ════ BÊTISE 2 : RIDEAU D'EMOJIS ════ */
  var _curtainTotal = 0; var _curtainCaught = 0;
  var CURTAIN_EMOJIS = ['🤡','😈','💀','👻','🕷️','🦇','🎃','🤪','😜'];
  function startCurtain(p){
    _curtainCaught = 0;
    var container = document.getElementById('prankCurtain');
    container.innerHTML = '';
    container.classList.add('show');
    _curtainTotal = 18;
    document.getElementById('prankCurtainCount').textContent = _curtainTotal;
    document.getElementById('prankCurtainBanner').classList.add('show');

    // Zone sûre : on réserve le haut (5vh min) et le bas
    // bannière est à bottom:80px, hauteur ~50px → on évite les 145px du bas
    // nav du bas ~64px → marge totale basse = 150px
    var EMOJI_SIZE  = 44;  // taille approximative de l'emoji en px
    var MARGIN_TOP  = Math.round(window.innerHeight * 0.05);        // 5vh
    var MARGIN_BOT  = 150;  // bannière + nav

    var safeH = window.innerHeight - MARGIN_TOP - MARGIN_BOT - EMOJI_SIZE;
    var safeW = window.innerWidth  - EMOJI_SIZE - 8;

    for(var i = 0; i < _curtainTotal; i++){
      (function(idx){
        setTimeout(function(){
          var el = document.createElement('div');
          el.className = 'prank-curtain-emoji';
          el.textContent = CURTAIN_EMOJIS[Math.floor(Math.random()*CURTAIN_EMOJIS.length)];
          el.style.left = (4 + Math.random() * safeW) + 'px';
          el.style.top  = (MARGIN_TOP + Math.random() * safeH) + 'px';
          // touchstart uniquement sur mobile (preventDefault bloque le click fantôme)
          el.addEventListener('touchstart', function(e){ e.preventDefault(); catchCurtainEmoji(el); }, { passive: false });
          el.addEventListener('click', function(){ catchCurtainEmoji(el); });
          container.appendChild(el);
        }, idx * 120);
      })(i);
    }
  }
  function catchCurtainEmoji(el){
    if(el.classList.contains('caught')) return;
    el.classList.add('caught');
    _curtainCaught++;
    var left = _curtainTotal - _curtainCaught;
    document.getElementById('prankCurtainCount').textContent = left;
    setTimeout(function(){ el.remove(); }, 350);
    if(_curtainCaught >= _curtainTotal){
      document.getElementById('prankCurtain').classList.remove('show');
      document.getElementById('prankCurtainBanner').classList.remove('show');
      prankDone();
    }
  }

  /* ════ BÊTISE 3 : L'INTRUS QUI ESQUIVE ════ */
  var _intrusTouches = 0; var _intrusTimer = null; var _intrusEl = null;
  var _intrusHitLock = false;
  function startIntrus(p){
    _intrusTouches = 0;
    _intrusHitLock = false;
    var el = document.getElementById('prankIntrus');
    _intrusEl = el;
    el.classList.add('show');
    document.getElementById('prankIntrusBanner').classList.add('show');
    document.getElementById('prankIntrusCount').textContent = 10;
    // Premier placement sans transition (l'emoji apparaît direct à sa place)
    el.style.transition = 'none';
    moveIntrus();
    // On rétablit la transition après le premier placement
    setTimeout(function(){ el.style.transition = ''; }, 50);
    _intrusTimer = setInterval(moveIntrus, 1800);
    el.addEventListener('touchstart', function(e){ e.preventDefault(); hitIntrus(); }, { passive: false });
    el.addEventListener('click', hitIntrus);
  }
  function moveIntrus(){
    var el = _intrusEl; if(!el) return;
    var EMOJI_SIZE = 56;  // un peu plus grand que le font-size pour la marge tactile
    var MARGIN_TOP = 60;  // évite le header fixe
    var MARGIN_BOT = 160; // évite la nav + bannière (bottom:80px + ~50px + marge)
    var safeW = window.innerWidth  - EMOJI_SIZE - 8;
    var safeH = window.innerHeight - MARGIN_TOP - MARGIN_BOT - EMOJI_SIZE;
    var x = 4  + Math.random() * safeW;
    var y = MARGIN_TOP + Math.random() * safeH;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
  }
  function hitIntrus(){
    if(_intrusHitLock) return;
    _intrusHitLock = true;
    setTimeout(function(){ _intrusHitLock = false; }, 400);
    _intrusTouches++;
    var left = 10 - _intrusTouches;
    document.getElementById('prankIntrusCount').textContent = left;
    if(_intrusTouches >= 10){
      clearInterval(_intrusTimer);
      _intrusEl.classList.remove('show');
      document.getElementById('prankIntrusBanner').classList.remove('show');
      prankDone();
    } else {
      // L'intrus esquive immédiatement après qu'on l'a touché
      moveIntrus();
    }
  }

  /* ════ BÊTISE 4 : TEXTE À L'ENVERS ════ */
  var _flipHolding = false; var _flipTimer = null; var _flipProgress = 0;
  function startFlip(p){
    // Petit délai pour que la victime voit la page normale avant le retournement
    setTimeout(function(){
      document.body.classList.add('prank-flip');
    }, 300);
    document.getElementById('prankFlipBanner').classList.add('show');
    var btn = document.getElementById('prankFlipBtn');
    document.getElementById('prankFlipProgressBar').style.width = '0%';
    _flipHolding = false; _flipProgress = 0;

    function startHold(){
      _flipHolding = true;
      _flipProgress = 0;
      runFlipProgress();
    }
    function stopHold(){
      _flipHolding = false;
      clearTimeout(_flipTimer);
      document.getElementById('prankFlipProgressBar').style.width = '0%';
    }
    // Nettoyer les anciens listeners en clonant le bouton
    var newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('mousedown',  startHold);
    newBtn.addEventListener('touchstart', function(e){ e.preventDefault(); startHold(); }, { passive: false });
    newBtn.addEventListener('mouseup',    stopHold);
    newBtn.addEventListener('mouseleave', stopHold);
    newBtn.addEventListener('touchend',   stopHold);
    newBtn.addEventListener('touchcancel',stopHold);
  }
  function runFlipProgress(){
    if(!_flipHolding) return;
    _flipProgress += 4;
    document.getElementById('prankFlipProgressBar').style.width = Math.min(_flipProgress, 100) + '%';
    if(_flipProgress >= 100){
      document.body.classList.remove('prank-flip');
      document.getElementById('prankFlipBanner').classList.remove('show');
      prankDone();
    } else {
      _flipTimer = setTimeout(runFlipProgress, 80);
    }
  }

  /* ════ BÊTISE 5 : FLAQUE DE PEINTURE ════ */
  var _splashTotal = 0; var _splashWiped = 0;
  var SPLASH_COLORS = ['#e8507a','#a78bfa','#60a5fa','#34d399','#fb923c','#f59e0b','#ec4899','#06b6d4'];
  function startSplash(p){
    _splashWiped = 0;
    var container = document.getElementById('prankSplash');
    container.innerHTML = '';
    container.classList.add('show');
    _splashTotal = 10;
    document.getElementById('prankSplashCount').textContent = _splashTotal;
    document.getElementById('prankSplashBanner').classList.add('show');
    for(var i = 0; i < _splashTotal; i++){
      var blob = document.createElement('div');
      blob.className = 'prank-splash-blob';
      var w = 80 + Math.random()*120; var h = 60 + Math.random()*100;
      var x = Math.random()*(window.innerWidth - w);
      var y = Math.random()*(window.innerHeight - h - 80) + 40;
      var color = SPLASH_COLORS[i % SPLASH_COLORS.length];
      blob.style.cssText = 'width:'+w+'px;height:'+h+'px;left:'+x+'px;top:'+y+'px;background:'+color+';opacity:0.88;transform:rotate('+((Math.random()-0.5)*30)+'deg);';
      blob.addEventListener('click', function(){ wipeSplash(this); });
      blob.addEventListener('touchstart', function(e){ e.preventDefault(); wipeSplash(this); });
      container.appendChild(blob);
    }
  }
  function wipeSplash(el){
    if(el.classList.contains('wiped')) return;
    el.classList.add('wiped');
    _splashWiped++;
    var left = _splashTotal - _splashWiped;
    document.getElementById('prankSplashCount').textContent = left;
    setTimeout(function(){ el.remove(); }, 400);
    if(_splashWiped >= _splashTotal){
      document.getElementById('prankSplash').classList.remove('show');
      document.getElementById('prankSplashBanner').classList.remove('show');
      prankDone();
    }
  }

  /* ════ BÊTISE 6 : CADENAS ════ */
  var _lockPrank = null;
  function startLock(p){
    _lockPrank = p;
    var authorName = (typeof v2GetDisplayName==="function"?v2GetDisplayName(p.author):(p.author==="boy"?"Lui":"Elle"));
    document.getElementById('prankLockTitle').textContent = '🔐 Accès bloqué par ' + authorName;
    document.getElementById('prankLockInput').value = '';
    document.getElementById('prankLockErr').textContent = '';
    document.getElementById('prankLock').classList.add('show');
  }
  window.prankCheckLock = function(){
    var input    = document.getElementById('prankLockInput').value.trim().toLowerCase();
    var expected = (_lockPrank && _lockPrank.lock_word) ? _lockPrank.lock_word.trim().toLowerCase() : null;
    // Sécurité : si pas de lock_word en base ou saisie vide → bloquer
    if(!expected || !input){
      var inp = document.getElementById('prankLockInput');
      inp.classList.add('error');
      document.getElementById('prankLockErr').textContent = '❌ Non ! Essaie encore…';
      setTimeout(function(){ inp.classList.remove('error'); }, 500);
      return;
    }
    if(input === expected){
      document.getElementById('prankLock').classList.remove('show');
      prankDone();
    } else {
      var inp = document.getElementById('prankLockInput');
      inp.classList.add('error');
      document.getElementById('prankLockErr').textContent = '❌ Non ! Essaie encore…';
      setTimeout(function(){ inp.classList.remove('error'); }, 500);
    }
  };
  // Valider avec Entrée
  document.getElementById('prankLockInput').addEventListener('keydown', function(e){
    if(e.key === 'Enter') window.prankCheckLock();
  });

  /* ── Hook sur setProfile : vérifier bêtise active ── */
  var _origSetProfile = window.setProfile;
  var _prankPollTimer = null;

  // ── Realtime bêtises (#27) ───────────────────────────────────────────────
  var _prankRTChannel = null;

  function _startPrankRealtime(coupleId, gender) {
    if (!window._yamRT || !coupleId || _prankRTChannel) return;

    _prankRTChannel = window._yamRT
      .channel('pranks-' + coupleId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pranks',
        filter: 'couple_id=eq.' + coupleId
      }, function(payload) {
        // Vérifier si la bêtise nous est destinée
        var row = payload.new;
        if (row && row.sender_role !== gender && row.active) {
          window.checkActivePrank(gender);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'pranks',
        filter: 'couple_id=eq.' + coupleId
      }, function() {
        if (_activePrank) {
          // Vérifier si la bêtise active a été annulée
          fetch(SB_URL+'/rest/v1/'+PRANK_TABLE+'?id=eq.'+_activePrank.id+'&select=active', {
            headers: sb2Headers()
          }).then(function(r){ return r.json(); })
          .then(function(rows){
            if(rows && rows.length && rows[0].active === false) abortActivePrank();
          }).catch(function(){});
        }
      })
      .subscribe(function(status) {
        if (status === 'SUBSCRIBED') {
          // Stopper le poll 15s — Realtime prend le relais
          stopPrankPoll();
          console.log('[RT] Pranks channel connecté — poll désactivé');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Fallback poll si Realtime échoue
          if (!_prankPollTimer) {
            startPrankPoll(gender);
            console.warn('[RT] Pranks channel perdu — fallback poll 15s');
          }
        }
      });

    window._yamRTChannels['pranks'] = _prankRTChannel;
  }

  function _stopPrankRealtime() {
    if (_prankRTChannel && window._yamRT) {
      try { window._yamRT.removeChannel(_prankRTChannel); } catch(e) {}
      _prankRTChannel = null;
      delete window._yamRTChannels['pranks'];
    }
  }

  function startPrankPoll(gender){
    stopPrankPoll();
    _prankPollTimer = setInterval(function(){
      if(_activePrank){
        // Vérifier si la bêtise en cours a été annulée par l'auteur
        fetch(SB_URL+'/rest/v1/'+PRANK_TABLE+'?id=eq.'+_activePrank.id+'&select=active', {
          headers: sb2Headers()
        }).then(function(r){ return r.json(); })
        .then(function(rows){
          if(rows && rows.length && rows[0].active === false){
            // Annulée à distance — on stoppe tout proprement sans gotcha
            abortActivePrank();
          }
        }).catch(function(){});
      } else {
        window.checkActivePrank(gender);
      }
    }, 15000);
  }
  function stopPrankPoll(){
    if(_prankPollTimer){ clearInterval(_prankPollTimer); _prankPollTimer = null; }
  }
  window._yamStopPrankPoll = stopPrankPoll;

  // ✅ #38 — Relancer le poll bêtises après reconnexion
  document.addEventListener('yam:session_ready', function(){
    var gender = (typeof getProfile === 'function') ? getProfile() : null;
    if (!gender) return;
    setTimeout(function(){ window.checkActivePrank(gender); }, 500);
    var u = (typeof yamGetUser === 'function') ? yamGetUser() : null;
    var coupleId = u ? u.couple_id : null;
    if (window._yamRT && coupleId) {
      _prankRTChannel = null;
      _startPrankRealtime(coupleId, gender);
    } else {
      if(_prankPollTimer) return;
      startPrankPoll(gender);
    }
  });

  window.setProfile = function(gender){
    _origSetProfile(gender);
    setTimeout(function(){ window.checkActivePrank(gender); }, 1500);
    var u = (typeof yamGetUser === 'function') ? yamGetUser() : null;
    var coupleId = u ? u.couple_id : null;
    if (window._yamRT && coupleId) {
      _stopPrankRealtime();
      _startPrankRealtime(coupleId, gender);
    } else {
      startPrankPoll(gender);
    }
  };

  // Vérifier aussi au démarrage si déjà connecté + lancer le poll ou Realtime
  var _savedProfile = getProfile();
  if(_savedProfile){
    setTimeout(function(){ window.checkActivePrank(_savedProfile); }, 2000);
    var _u = (typeof yamGetUser === 'function') ? yamGetUser() : null;
    var _coupleId = _u ? _u.couple_id : null;
    if (window._yamRT && _coupleId) {
      _startPrankRealtime(_coupleId, _savedProfile);
    } else {
      startPrankPoll(_savedProfile);
    }
  }

  // Arrêter le poll si la victime se déconnecte
  var _origLogout = window.nativeLogout;
  window.nativeLogout = function(){
    stopPrankPoll();
    if(_origLogout) return _origLogout.apply(this, arguments);
  };

})();

(function(){
  var STORAGE_KEY = 'jayana_prank_favs';

  function getFavs(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }catch(e){ return []; }
  }
  function saveFavs(arr){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }catch(e){}
  }

  /* Applique l'état visuel de tous les coeurs */
  function applyFavStates(){
    var favs = getFavs();
    document.querySelectorAll('.prank-fav-btn').forEach(function(btn){
      var t = btn.dataset.prankType;
      btn.classList.toggle('active', favs.indexOf(t) !== -1);
    });
  }

  /* Réordonne la liste : favoris en haut, séparateur, reste */
  function rebuildPrankList(){
    var list = document.getElementById('prankMenuList');
    if(!list) return;
    var favs = getFavs();
    var items = Array.from(list.querySelectorAll('.prank-menu-item'));

    /* Supprimer labels/dividers précédents */
    list.querySelectorAll('.prank-fav-section-label, .prank-fav-divider').forEach(function(el){ el.remove(); });

    var favItems   = items.filter(function(el){ return favs.indexOf(el.dataset.prankType) !== -1; });
    var otherItems = items.filter(function(el){ return favs.indexOf(el.dataset.prankType) === -1; });

    /* Vider la liste */
    items.forEach(function(el){ el.remove(); });

    if(favItems.length > 0){
      var lblFav = document.createElement('div');
      lblFav.className = 'prank-fav-section-label';
      lblFav.textContent = '♥ Favoris';
      list.appendChild(lblFav);
      favItems.forEach(function(el){ list.appendChild(el); });

      if(otherItems.length > 0){
        var div = document.createElement('div');
        div.className = 'prank-fav-divider';
        list.appendChild(div);
      }
    }

    otherItems.forEach(function(el){ list.appendChild(el); });
    applyFavStates();
  }

  /* Toggle favori */
  window.prankToggleFav = function(e, type){
    e.stopPropagation();
    var favs = getFavs();
    var idx  = favs.indexOf(type);
    var btn  = e.currentTarget || e.target;

    if(idx === -1){
      favs.push(type);
      btn.classList.add('prank-fav-pop');
      setTimeout(function(){ btn.classList.remove('prank-fav-pop'); }, 350);
    } else {
      favs.splice(idx, 1);
    }
    saveFavs(favs);
    rebuildPrankList();
    if(window.haptic) haptic('light');
  };

  /* Init au chargement et à l'ouverture du menu */
  var origOpen = window.openPrankMenu;
  window.openPrankMenu = function(){
    if(origOpen) origOpen.apply(this, arguments);
    setTimeout(rebuildPrankList, 50);
  };

  /* Aussi lors de la première affichage (le menu peut s'ouvrir via betisesBtn) */
  document.addEventListener('DOMContentLoaded', function(){
    rebuildPrankList();
  });
  /* Si DOM déjà prêt */
  if(document.readyState !== 'loading') rebuildPrankList();
})();

console.log('✨ Jayana UX v.UX01 chargé');
