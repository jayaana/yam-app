// ═══════════════════════════════════════════════════════════
// app-love.js — Page Nous : Photos Elle/Lui · Raisons · Post-its · Memo

// ════════════════════════════════════════════
// SECTION ELLE — Upload Supabase Storage V2
// ════════════════════════════════════════════
(function(){
  var SB_BUCKET = 'images';
  var SB_FOLDER = 'elle';
  var SLOTS = ['animal','fleurs','personnage','saison','repas'];
  var ELLE_DESC_DEFAULTS = {
    animal:     'Un regard doux 💫',
    fleurs:     'Pleine de couleurs 💕',
    personnage: 'Attachante 💍',
    saison:     'Un rayon de soleil ☀️',
    repas:      "N'aime que les pattes 🤝"
  };
  var _currentSlot = null;

  // ── Charger les images depuis Supabase Storage V2 ──
  // Bypass cache systématique + écrase tout src V1 résiduel dans le HTML
  function elleLoadImages(){
    SLOTS.forEach(function(slot){
      var url = SB2_URL + '/storage/v1/object/public/' + SB_BUCKET + '/' + SB_FOLDER + '/' + slot + '.jpg?t=' + Date.now();
      var img = document.getElementById('elle-img-' + slot);
      if(!img) return;
      // Nettoyer immédiatement tout src V1 résiduel (zjmbyjpxqrojnuymnpcf)
      if(img.src && img.src.indexOf('zjmbyjpxqrojnuymnpcf') !== -1) img.removeAttribute('src');
      var probe = new Image();
      probe.onload = function(){ img.src = url; };
      probe.onerror = function(){ /* image non uploadée — on laisse le slot vide */ };
      probe.src = url;
    });
  }

  // ── Afficher/masquer les boutons selon profil ──
  function elleSyncEditMode(){
    var profile = getProfile();
    var isLink = (profile === 'boy');
    SLOTS.forEach(function(slot){
      var btn = document.getElementById('elle-btn-' + slot);
      if(btn) btn.style.display = isLink ? '' : 'none';
      var desc = document.getElementById('elle-desc-' + slot);
      if(desc){
        if(isLink) desc.classList.add('lui-desc-editable');
        else desc.classList.remove('lui-desc-editable');
      }
    });
  }

  window.elleUploadClick = function(slot){
    if(getProfile() !== 'boy') return;
    _currentSlot = slot;
    var input = document.getElementById('elleFileInput');
    input.value = '';
    input.click();
  };

  window.elleHandleFile = function(input){
    if(!input.files || !input.files[0]) return;
    var file = input.files[0];
    var slot = _currentSlot;
    if(!slot) return;

    var ALLOWED_TYPES = ['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
    if(ALLOWED_TYPES.indexOf(file.type) === -1){
      alert('Format non autorisé. Utilise une image JPEG, PNG ou WebP.');
      input.value = '';
      return;
    }
    if(file.size > 5 * 1024 * 1024){ alert('Image trop lourde (max 5 Mo)'); return; }

    var loading = document.getElementById('elle-loading-' + slot);
    var bar = document.getElementById('elle-bar-' + slot);
    if(loading) loading.classList.add('show');
    if(bar){ bar.style.width = '0%'; setTimeout(function(){ bar.style.width = '60%'; }, 100); }

    var path = SB_FOLDER + '/' + slot + '.jpg';
    // Upload vers Supabase V2 Storage (plus de SB_KEY ni _sbAccessToken)
    fetch(SB2_URL + '/storage/v1/object/' + SB_BUCKET + '/' + path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': file.type, 'x-upsert': 'true' }, sb2Headers()),
      body: file
    })
    .then(function(r){
      if(bar) bar.style.width = '100%';
      return r.text().then(function(body){
        if(loading) loading.classList.remove('show');
        if(r.ok){
          var img = document.getElementById('elle-img-' + slot);
          if(img) img.src = SB2_URL + '/storage/v1/object/public/' + SB_BUCKET + '/' + SB_FOLDER + '/' + slot + '.jpg?t=' + Date.now();
        } else {
          alert('Erreur ' + r.status + ' : ' + body);
        }
      });
    })
    .catch(function(err){
      if(loading) loading.classList.remove('show');
      alert('Erreur réseau : ' + err);
    });
  };

  // ── Descriptions éditables ──
  function elleLoadDescs(){
    fetch(SB2_URL + '/rest/v1/v2_photo_descs?category=eq.elle&select=slot,description', {
      headers: sb2Headers()
    })
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(rows){
      if(!Array.isArray(rows)) return;
      rows.forEach(function(row){
        var el = document.getElementById('elle-desc-' + row.slot);
        if(el && row.description) el.textContent = row.description;
      });
    })
    .catch(function(){
      SLOTS.forEach(function(slot){
        var saved = localStorage.getItem('elle_desc_' + slot);
        var el = document.getElementById('elle-desc-' + slot);
        if(el && saved) el.textContent = saved;
      });
    });
  }

  function elleSaveDesc(slot, val){
    fetch(SB2_URL + '/rest/v1/v2_photo_descs', {
      method: 'POST',
      headers: sb2Headers({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ category: 'elle', slot: slot, description: val })
    }).catch(function(){});
    localStorage.setItem('elle_desc_' + slot, val);
  }

  var SLOT_LABELS = { animal:'Son animal', fleurs:'Ses fleurs', personnage:'Son personnage', saison:'Sa saison', repas:'Son repas' };
  window.elleEditDesc = function(slot){
    if(getProfile() !== 'boy') return;
    var el = document.getElementById('elle-desc-' + slot);
    if(!el) return;
    descEditOpen(el.textContent.trim(), 'Légende · ' + (SLOT_LABELS[slot] || slot), function(val){
      val = val || ELLE_DESC_DEFAULTS[slot];
      el.textContent = val;
      elleSaveDesc(slot, val);
    });
  };

  elleLoadImages();
  elleLoadDescs();
  elleSyncEditMode();

  var _origSetProfileElle = window.setProfile;
  window.setProfile = function(gender){
    if(_origSetProfileElle) _origSetProfileElle.apply(this, arguments);
    setTimeout(elleSyncEditMode, 300);
  };

})();

// ════════════════════════════════════════════
// SECTION LUI — Upload Supabase Storage V2
// ════════════════════════════════════════════
(function(){
  var SB_BUCKET = 'images';
  var SB_FOLDER = 'lui';
  var SLOTS = ['animal','fleurs','personnage','saison','repas'];
  var _currentSlot = null;

  function luiLoadImages(){
    SLOTS.forEach(function(slot){
      var url = SB2_URL + '/storage/v1/object/public/' + SB_BUCKET + '/' + SB_FOLDER + '/' + slot + '.jpg?t=' + Date.now();
      var img = document.getElementById('lui-img-' + slot);
      var empty = document.getElementById('lui-empty-' + slot);
      var btn = document.getElementById('lui-btn-' + slot);
      if(!img) return;
      // Nettoyer immédiatement tout src V1 résiduel (zjmbyjpxqrojnuymnpcf)
      if(img.src && img.src.indexOf('zjmbyjpxqrojnuymnpcf') !== -1) img.removeAttribute('src');
      var probe = new Image();
      probe.onload = function(){
        img.src = url;
        img.style.display = '';
        if(empty) empty.style.display = 'none';
        if(btn) btn.classList.remove('empty');
      };
      probe.onerror = function(){
        img.style.display = 'none';
        if(empty) empty.style.display = '';
        if(btn) btn.classList.add('empty');
      };
      probe.src = url;
    });
  }

  function luiSyncEditMode(){
    var profile = getProfile();
    var isZelda = (profile === 'girl');
    SLOTS.forEach(function(slot){
      var btn = document.getElementById('lui-btn-' + slot);
      if(btn) btn.style.display = isZelda ? '' : 'none';
    });
  }

  window.luiUploadClick = function(slot){
    if(getProfile() !== 'girl') return;
    _currentSlot = slot;
    var input = document.getElementById('luiFileInput');
    input.value = '';
    input.click();
  };

  window.luiHandleFile = function(input){
    if(!input.files || !input.files[0]) return;
    var file = input.files[0];
    var slot = _currentSlot;
    if(!slot) return;

    var ALLOWED_TYPES = ['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
    if(ALLOWED_TYPES.indexOf(file.type) === -1){
      alert('Format non autorisé. Utilise une image JPEG, PNG ou WebP.');
      input.value = '';
      return;
    }
    if(file.size > 5 * 1024 * 1024){ alert('Image trop lourde (max 5 Mo)'); return; }

    var loading = document.getElementById('lui-loading-' + slot);
    var bar = document.getElementById('lui-bar-' + slot);
    if(loading) loading.classList.add('show');
    if(bar){ bar.style.width = '0%'; setTimeout(function(){ bar.style.width = '60%'; }, 100); }

    var path = SB_FOLDER + '/' + slot + '.jpg';
    // Upload vers Supabase V2 Storage (plus de SB_KEY ni _sbAccessToken)
    fetch(SB2_URL + '/storage/v1/object/' + SB_BUCKET + '/' + path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': file.type, 'x-upsert': 'true' }, sb2Headers()),
      body: file
    })
    .then(function(r){
      if(bar) bar.style.width = '100%';
      return r.text().then(function(body){
        if(loading) loading.classList.remove('show');
        if(r.ok){
          var img = document.getElementById('lui-img-' + slot);
          var emptyEl = document.getElementById('lui-empty-' + slot);
          var btnEl = document.getElementById('lui-btn-' + slot);
          var newUrl = SB2_URL + '/storage/v1/object/public/' + SB_BUCKET + '/' + SB_FOLDER + '/' + slot + '.jpg?t=' + Date.now();
          if(img){ img.src = newUrl; img.style.display = ''; }
          if(emptyEl) emptyEl.style.display = 'none';
          if(btnEl) btnEl.classList.remove('empty');
        } else {
          alert('Erreur ' + r.status + ' : ' + body);
        }
      });
    })
    .catch(function(err){
      if(loading) loading.classList.remove('show');
      alert('Erreur réseau : ' + err);
    });
  };

  var LUI_DESC_DEFAULTS = {
    animal: 'Son animal 🐾',
    fleurs: 'Ses fleurs 🌸',
    personnage: 'Son personnage 💙',
    saison: 'Sa saison 🍂',
    repas: 'Son repas préféré 🍽️'
  };

  function luiLoadDescs(){
    fetch(SB2_URL + '/rest/v1/v2_photo_descs?category=eq.lui&select=slot,description', {
      headers: sb2Headers()
    })
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(rows){
      if(!Array.isArray(rows)) return;
      rows.forEach(function(row){
        var el = document.getElementById('lui-desc-' + row.slot);
        if(el && row.description) el.textContent = row.description;
      });
    })
    .catch(function(){
      SLOTS.forEach(function(slot){
        var saved = localStorage.getItem('lui_desc_' + slot);
        var el = document.getElementById('lui-desc-' + slot);
        if(el && saved) el.textContent = saved;
      });
    });
  }

  function luiSaveDesc(slot, val){
    fetch(SB2_URL + '/rest/v1/v2_photo_descs', {
      method: 'POST',
      headers: sb2Headers({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ category: 'lui', slot: slot, description: val })
    }).catch(function(){});
    localStorage.setItem('lui_desc_' + slot, val);
  }

  window.luiEditDesc = function(slot){
    if(getProfile() !== 'girl') return;
    var el = document.getElementById('lui-desc-' + slot);
    if(!el) return;
    var SLOT_LABELS_LUI = { animal:'Son animal', fleurs:'Ses fleurs', personnage:'Son personnage', saison:'Sa saison', repas:'Son repas' };
    descEditOpen(el.textContent.trim(), 'Légende · ' + (SLOT_LABELS_LUI[slot] || slot), function(val){
      val = val || LUI_DESC_DEFAULTS[slot];
      el.textContent = val;
      luiSaveDesc(slot, val);
    });
  };

  function luiSyncDescs(){
    var profile = getProfile();
    var isZelda = (profile === 'girl');
    SLOTS.forEach(function(slot){
      var el = document.getElementById('lui-desc-' + slot);
      if(!el) return;
      if(isZelda) el.classList.add('lui-desc-editable');
      else el.classList.remove('lui-desc-editable');
    });
  }

  luiLoadImages();
  luiLoadDescs();
  luiSyncEditMode();
  luiSyncDescs();

  var _origSetProfile = window.setProfile;
  window.setProfile = function(gender){
    if(_origSetProfile) _origSetProfile.apply(this, arguments);
    setTimeout(function(){ luiSyncEditMode(); luiSyncDescs(); }, 300);
  };

})();

// ── FADE-IN ──
var fadeObs = new IntersectionObserver(function(entries) {
  entries.forEach(function(e) {
    if (e.isIntersecting) { e.target.classList.add('visible'); fadeObs.unobserve(e.target); }
  });
}, { threshold: 0.08 });
document.querySelectorAll('.fade-in').forEach(function(el){ fadeObs.observe(el); });

// ── RAISONS ──
var reasons = [
  "Ta personnalité. Elle est unique, elle est toi, et j'arrête pas de la découvrir 💫",
  "Le fait que tu te bats pour t'améliorer tout le temps. Ça me rend vraiment fier de toi 🌱",
  "Ta petite timidité qui donne envie de te mettre à l'aise pour toujours 🌸",
  "Ton sourire 😄",
  "J'aime bien tes lèvres 🫦",
  "Ton humour. T'as le don de me faire beaucoup rire avec tes bêtises 🤣",
  "Ta sensibilité. Quand tu ressens vraiment les choses, ça compte énormément 💓",
  "T'es mignonne. Dans tout ce que t'es, dans tout ce que tu fais 🌺",
  "Ton côté sage. T'as une façon de voir les choses qui me calme quand j'en ai besoin 🕊️",
  "La façon dont tu travailles sur toi — ça me pousse à faire pareil 🚀",
  "Ton cœur. T'as une façon d'aimer qui me touche vraiment au fond 💞",
  "Nos fous rires. Ces moments où on rit de rien pendant des heures — y'a rien de mieux 🥰",
  "Le fait que tu sois ma meilleure amie autant que mon amour 👫",
  "Le fait d'être toi, sans faire semblant. Juste toi. Et c'est tout ce qu'il faut ✨"
];
// ── Deck shufflé sans remise : toutes les raisons passent avant de recommencer ──
var _reasonDeck = [];
var _reasonDeckPos = 0;

function _buildDeck(excludeFirst) {
  var deck = [];
  for (var k = 0; k < reasons.length; k++) deck.push(k);
  // Fisher-Yates shuffle
  for (var j = deck.length - 1; j > 0; j--) {
    var r = Math.floor(Math.random() * (j + 1));
    var tmp = deck[j]; deck[j] = deck[r]; deck[r] = tmp;
  }
  // Garantir que la première carte du nouveau deck ≠ la dernière montrée
  if (excludeFirst !== undefined && deck[0] === excludeFirst && deck.length > 1) {
    var swap = 1 + Math.floor(Math.random() * (deck.length - 1));
    var t = deck[0]; deck[0] = deck[swap]; deck[swap] = t;
  }
  return deck;
}

// Init : afficher une raison aléatoire dès le chargement (pas toujours la même)
(function(){
  _reasonDeck = _buildDeck();
  _reasonDeckPos = 0;
  var i = _reasonDeck[_reasonDeckPos++];
  var rText = document.getElementById('reasonText');
  if(rText) rText.textContent = reasons[i];
})();

function showReason(idx) {
  var rText = document.getElementById('reasonText');
  if(!rText) return;
  rText.classList.remove('reason-in-down');
  rText.classList.add('reason-out-up');
  setTimeout(function(){
    rText.textContent = reasons[idx];
    rText.classList.remove('reason-out-up');
    void rText.offsetWidth;
    rText.classList.add('reason-in-down');
  }, 200);
}

document.getElementById('reasonBox').addEventListener('click', function() {
  // Si le deck est épuisé, en construire un nouveau
  if (_reasonDeckPos >= _reasonDeck.length) {
    var lastShown = _reasonDeck[_reasonDeck.length - 1];
    _reasonDeck = _buildDeck(lastShown);
    _reasonDeckPos = 0;
  }
  var i = _reasonDeck[_reasonDeckPos++];
  showReason(i);
});

// ── POSTIT ──
var postitData = [
  { color:'#1a3a2a', icon:'💪', title:'Fiers de nous', text:"Des débuts compliqués, des doutes, des gens contre nous... et on s'est renforcés à chaque fois." },
  { color:'#2a1a2e', icon:'🌸', title:"Merci d'être toi", text:"Merci pour ta patience, ton humour, et tous les efforts pour qu'on grandisse ensemble." },
  { color:'#1a2a3a', icon:'☀️', title:'Plus vivante', text:"T'as rendu ma vie plus simple, plus belle, plus vivante. T'es ma dose de bonheur quotidien." },
  { color:'#2a2216', icon:'👵', title:'Ma vieille dame préférée', text:"T'es ma meilleure amie, mon bonheur, mon monde. Celle avec qui tout devient plus léger." },
  { color:'#1a2a2a', icon:'⭐', title:'Mon repère', text:"T'es mon équilibre, la preuve qu'un vrai amour existe. Je veux tout partager avec toi." },
  { color:'#2a1a1a', icon:'🤗', title:'Mon jour préféré', text:"Le jour où je te prendrai dans mes bras et te serrerai si fort qu'on pourra plus respirer." },
  { color:'#1a1a2a', icon:'🌙', title:'80 ans main dans la main', text:"Nos délires de \"vieille dame ch'ti\", nos bêtises... Je veux encore rire comme ça à 80 ans. 💕" },
  { color:'#222222', icon:'💘', title:'Ma seule certitude', text:"T'es pas juste \"la personne que j'aime\". T'es la seule avec qui je veux construire ma vie." }
];

// Messages anniversaire mensuels — mois 1 à 11
var annivPostitMessages = [
  null, // index 0 non utilisé
  "Un mois de plus à tes côtés... et j'en veux encore des centaines 💑",
  "Deux mois. Deux mois à sourire grâce à toi. J'espère ne jamais m'y habituer 🌸",
  "Trois mois ensemble — et déjà je sais plus comment c'était avant toi 🥺",
  "Quatre mois. Chaque journée avec toi est un cadeau que je garde précieusement 💝",
  "Cinq mois. T'es devenue une évidence dans ma vie, et c'est la plus belle des évidences ✨",
  "Six mois déjà. La moitié d'une année à être heureux — grâce à toi 🎂",
  "Sept mois. Je recompte parfois depuis le début juste pour me rappeler ma chance 💫",
  "Huit mois. Nos souvenirs s'accumulent et chacun d'eux me fait sourire 🌟",
  "Neuf mois. Je t'aime un peu plus fort qu'hier, et moins fort que demain 💞",
  "Dix mois. T'es mon endroit préféré au monde 🏠💕",
  "Onze mois. Presque un an... et pourtant ça me semble à peine commencé 🌙"
];

function getAnnivPostitText(months) {
  if (months % 12 === 0) {
    // Anniversaire annuel
    var years = months / 12;
    if (years === 1) return "Un an ensemble !! Boucle bouclée, mais notre histoire elle, ne fait que commencer 🎉💑";
    if (years === 2) return "Deux ans. Deux ans à construire quelque chose de vrai, de beau, de nous. Je t'aime 💍";
    if (years === 3) return "Trois ans. Trois ans que t'es ma meilleure décision 🥂✨";
    // Au-delà : message générique annuel
    return years + " ans ensemble. Je recommencerais mille fois 🎂💑";
  } else if (months < 12) {
    // Mois 1 à 11 — message personnalisé
    return annivPostitMessages[months];
  } else {
    // Mois 13+ hors anniversaire annuel — message générique avec le vrai chiffre
    var m = months % 12 === 0 ? 12 : months % 12;
    var y = Math.floor(months / 12);
    return y + " an" + (y > 1 ? "s" : "") + " et " + m + " mois. Chaque jour compte, et chaque jour t'es là 🩷";
  }
}

var rots = [-1.8, 1.4, -0.9, 2.0, -1.3, 0.7, -2.2, 1.1];
var stackIndex = 0;

// Injecte le post-it anniversaire en tête de pile si on est le 29
(function injectAnnivPostit(){
  var START  = new Date(2024, 9, 29);
  var now    = new Date();
  if (now.getDate() !== 29) return;
  var months = (now.getFullYear() - START.getFullYear()) * 12
             + (now.getMonth()    - START.getMonth());
  if (months < 1) return;
  var msg = getAnnivPostitText(months);
  var annivPostit = {
    color: '#2a1a1a',
    icon:  '🎂',
    title: 'Bonne mensiversaire 🩷',
    text:  msg,
    isAnniv: true
  };
  postitData.unshift(annivPostit); // En tête → s'affiche en premier
  rots.unshift(0.4);
})();

function buildStack() {
  var stackWrap = document.getElementById('postitStack');
  var stackCtr = document.getElementById('stackCounter');
  stackWrap.innerHTML = '';
  var n = postitData.length;
  for (var i = 0; i < n; i++) {
    var dIdx = (stackIndex + n - 1 - i) % n;
    var dd = postitData[dIdx];
    var depth = n - 1 - i;
    var el = document.createElement('div');
    el.className = 'postit';
    el.style.zIndex = i + 1;
    el.style.transform = 'translateY(' + (depth * 4) + 'px) rotate(' + rots[dIdx % rots.length] + 'deg)';
    el.style.opacity = depth === 0 ? '1' : String(Math.max(0.38, 1 - depth * 0.16));
    el.innerHTML = '<div class="p-art" style="background:' + escHtml(dd.color) + '">' + dd.icon + '</div><div class="p-body"><div class="p-title">' + escHtml(dd.title) + '</div><div class="p-text">' + escHtml(dd.text) + '</div></div>';
    if (dd.isAnniv) {
      el.style.boxShadow = '0 0 0 2px rgba(245,197,24,0.6), 0 8px 32px rgba(0,0,0,0.45)';
      el.style.outline = 'none';
    }
    stackWrap.appendChild(el);
  }
  stackCtr.textContent = (stackIndex + 1) + ' / ' + n;
  var top = stackWrap.lastElementChild;
  if (top) attachPostitEvents(top);
}

function dismissTop(dirX) {
  var top = document.getElementById('postitStack').lastElementChild;
  if (!top || top._dismissing) return;
  top._dismissing = true;
  var angle = dirX > 0 ? 18 : -18;
  var tx = dirX > 0 ? '115%' : '-115%';
  top.style.transition = 'transform 0.32s cubic-bezier(.4,0,.6,1), opacity 0.26s';
  top.style.transform = 'translateX(' + tx + ') rotate(' + angle + 'deg)';
  top.style.opacity = '0';
  top.style.pointerEvents = 'none';
  stackIndex = (stackIndex + 1) % postitData.length;
  setTimeout(buildStack, 300);
}

function attachPostitEvents(el) {
  var startX, startY, dragging = false, moved = false;
  var baseRot = rots[stackIndex % rots.length];

  /* ── Touch ── */
  el.addEventListener('touchstart', function(e) {
    if (el._dismissing) return;
    var t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    dragging = true;
    moved = false;
    el.style.transition = 'none';
  }, { passive: true });

  el.addEventListener('touchmove', function(e) {
    if (!dragging || el._dismissing) return;
    var t = e.touches[0];
    var dx = t.clientX - startX;
    var dy = t.clientY - startY;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    moved = true;
    // N'intercepte que si le mouvement est majoritairement horizontal
    if (Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
      var rot = baseRot + dx * 0.06;
      var lift = Math.min(Math.abs(dx) * 0.04, 6);
      el.style.transform = 'translateX(' + dx + 'px) translateY(-' + lift + 'px) rotate(' + rot + 'deg)';
      el.style.opacity = String(Math.max(0.3, 1 - Math.abs(dx) / 280));
    }
  }, { passive: false });

  el.addEventListener('touchend', function(e) {
    if (!dragging || el._dismissing) return;
    dragging = false;
    var t = e.changedTouches[0];
    var dx = t.clientX - startX;
    var dy = t.clientY - startY;

    if (!moved) {
      // Simple tap
      dismissTop(1);
      return;
    }

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      dismissTop(dx > 0 ? 1 : -1);
    } else {
      // Snap back
      el.style.transition = 'transform 0.3s cubic-bezier(.4,2,.55,.9), opacity 0.2s';
      el.style.transform = 'translateY(0px) rotate(' + baseRot + 'deg)';
      el.style.opacity = '1';
    }
  }, { passive: true });

  /* ── Mouse (desktop) ── */
  el.addEventListener('mousedown', function(e) {
    if (el._dismissing) return;
    startX = e.clientX;
    startY = e.clientY;
    dragging = true;
    moved = false;
    el.style.transition = 'none';
    el.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', function onMove(e) {
    if (!dragging || el._dismissing) return;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    moved = true;
    var rot = baseRot + dx * 0.06;
    var lift = Math.min(Math.abs(dx) * 0.04, 6);
    el.style.transform = 'translateX(' + dx + 'px) translateY(-' + lift + 'px) rotate(' + rot + 'deg)';
    el.style.opacity = String(Math.max(0.3, 1 - Math.abs(dx) / 280));
    el._onMove = onMove;
  });

  document.addEventListener('mouseup', function onUp(e) {
    if (!dragging || el._dismissing) return;
    dragging = false;
    el.style.cursor = 'pointer';
    document.removeEventListener('mousemove', el._onMove);
    document.removeEventListener('mouseup', onUp);
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;

    if (!moved) {
      dismissTop(1);
      return;
    }

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      dismissTop(dx > 0 ? 1 : -1);
    } else {
      el.style.transition = 'transform 0.3s cubic-bezier(.4,2,.55,.9), opacity 0.2s';
      el.style.transform = 'translateY(0px) rotate(' + baseRot + 'deg)';
      el.style.opacity = '1';
    }
  });
}
buildStack();

// ── POLLING badge non-lus (page principale) ──
// Vérifie les messages non-lus toutes les 30s pour mettre à jour le cadenas
(function startLockBadgePolling(){
  var _prevUnreadCount = -1; // -1 = pas encore initialisé, évite la notif au premier check

  function checkUnread(){
    // Ne pas vérifier si InstaLove est ouvert (il gère lui-même)
    if(document.getElementById('hiddenPage').classList.contains('active')) return;
    var profile = getProfile();
    if(!profile) return; // pas connecté, rien à vérifier
    var other = profile === 'girl' ? 'boy' : 'girl';
    // Récupérer le couple_id depuis la session
    var _s = null;
    try { _s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null'); } catch(e){}
    var coupleId = _s && _s.user ? _s.user.couple_id : null;
    if(!coupleId) return;
    // Récupérer les messages non lus envoyés par l'autre, filtrés par couple
    fetch(SB2_URL + '/rest/v1/v2_dm_messages?couple_id=eq.' + coupleId + '&sender=eq.' + other + '&seen=eq.false&deleted=eq.false&order=created_at.desc&limit=99', {
      headers: sb2Headers()
    })
    .then(function(r){ return r.json(); })
    .then(function(rows){
      if(!Array.isArray(rows)) return;
      var unread = rows.length;
      var lockBtn   = document.getElementById('lockNavBtn');
      var lockBadge = document.getElementById('lockUnreadBadge');
      if(!lockBtn || !lockBadge) return;
      if(unread > 0){
        lockBadge.textContent = unread > 99 ? '99+' : unread;
        lockBadge.classList.add('visible');
        lockBtn.classList.add('has-unread');
        // Pilule notif si nouveaux messages apparus ET pas sur onglet messages
        if(_prevUnreadCount >= 0 && unread > _prevUnreadCount && window._currentTab !== 'messages'){
          var last = rows[0]; // le plus récent (order desc)
          var emoji = other === 'girl' ? '👧' : '👦';
          var name  = (typeof v2GetDisplayName==="function"?v2GetDisplayName(other):(other==="girl"?"👧":"👦"));
          var txt   = (last && last.text) ? last.text : '💬 Nouveau message';
          if(window.showMsgHeaderPill) window.showMsgHeaderPill(emoji, name, txt);
        }
      } else {
        lockBadge.classList.remove('visible');
        lockBtn.classList.remove('has-unread');
      }
      _prevUnreadCount = unread;
    })
    .catch(function(){});
  }
  window._checkUnread = checkUnread;
  checkUnread(); // Vérification immédiate au chargement
  setInterval(checkUnread, 8000); // Toutes les 8 secondes
})();

function spawnHeart(){
  // Animation cœur volant
  var h=document.createElement('div');h.className='like-heart';h.textContent='🤍';document.body.appendChild(h);setTimeout(function(){h.remove();},600);

  var profile = getProfile() || null;
  if(!profile) return;

  var coupleId = null;
  try{
    var s = JSON.parse(localStorage.getItem('yam_v2_session')||'null');
    if(s && s.user) coupleId = s.user.couple_id;
  }catch(e){}
  if(!coupleId) return;

  // Mise à jour optimiste : incrémenter l'affichage immédiatement
  var numEl = document.getElementById(profile==='girl' ? 'likeNumGirl' : 'likeNumBoy');
  if(numEl){
    var txt = (numEl.textContent||'0').trim();
    var cur = 0;
    if(txt.endsWith('M')) cur = parseFloat(txt) * 1000000;
    else if(txt.endsWith('k')) cur = parseFloat(txt) * 1000;
    else cur = parseInt(txt) || 0;
    numEl.textContent = fmtLikes(cur + 1);
  }

  // Appel RPC increment_like_counter pour incrémentation atomique en base
  fetch(SB2_URL+'/rest/v1/rpc/increment_like_counter', {
    method:'POST',
    headers: Object.assign({'Content-Type':'application/json'}, sb2Headers()),
    body:JSON.stringify({ 
      p_profile: profile, 
      p_couple_id: coupleId
    })
  })
  .then(function(r){ 
    if(!r.ok){
      return r.text().then(function(txt){ 
        console.error('Erreur RPC increment_like_counter:', r.status, txt);
        loadLikeCounters();
      });
    }
    // RPC réussie — programmer une synchro après 800ms
    if(window.scheduleLikeSync) window.scheduleLikeSync();
  })
  .catch(function(err){ 
    console.error('Erreur réseau likes:', err);
    loadLikeCounters();
  });
}

function fmtLikes(n){
  if(!n || n<=0) return '0';
  if(n>=1000000) return (n/1000000).toFixed(1).replace('.0','')+'M';
  if(n>=1000) return (n/1000).toFixed(1).replace('.0','')+'k';
  return String(n);
}

function loadLikeCounters(){
  var coupleId = null;
  try{
    var s = JSON.parse(localStorage.getItem('yam_v2_session')||'null');
    if(s && s.user) coupleId = s.user.couple_id;
  }catch(e){}
  if(!coupleId) return;

  fetch(SB2_URL+'/rest/v1/v2_like_counters?couple_id=eq.'+coupleId+'&select=profile,total', {
    headers: sb2Headers()
  })
  .then(function(r){ return r.ok ? r.json() : []; })
  .then(function(rows){
    if(!Array.isArray(rows)) return;
    
    // Initialiser à 0 si aucune donnée
    var elGirl = document.getElementById('likeNumGirl');
    var elBoy  = document.getElementById('likeNumBoy');
    var foundGirl = false;
    var foundBoy = false;
    
    rows.forEach(function(r){
      if(r.profile==='girl' && elGirl){
        elGirl.textContent = fmtLikes(r.total);
        foundGirl = true;
      }
      if(r.profile==='boy' && elBoy){
        elBoy.textContent = fmtLikes(r.total);
        foundBoy = true;
      }
    });
    
    // Si aucune ligne trouvée, initialiser à 0
    if(!foundGirl && elGirl) elGirl.textContent = '0';
    if(!foundBoy && elBoy) elBoy.textContent = '0';
  }).catch(function(){});
}

// Exposer globalement pour le refresh par onglet
window.loadLikeCounters = loadLikeCounters;

// Timer de debounce pour synchronisation après spam
var _likeSyncDebounce = null;
window.scheduleLikeSync = function(){
  // Annuler le timer précédent
  if(_likeSyncDebounce) clearTimeout(_likeSyncDebounce);
  // Programmer un rechargement dans 800ms (après la fin du spam)
  _likeSyncDebounce = setTimeout(function(){
    loadLikeCounters();
    _likeSyncDebounce = null;
  }, 800);
};

loadLikeCounters();
// Polling toutes les 5s pour voir les coeurs de l'autre en temps réel
window._likesIv = setInterval(loadLikeCounters, 5000);


// ── MEMO COUPLE — Supabase ──
(function(){
  var _MEMO_HASH='a586ffe3acf28484d17760d1ddaa2af699666c870aaaa66f8cfc826a528429ce', memoUnlocked=false, memoCurrentNote=null;
  var NOTE_COLORS=['#1a3a2a','#2a1a2e','#1a2a3a','#2a2216','#1a2a2a','#2a1a1a','#1a1a2a','#222222'];
  var NOTE_ICONS=['💬','✍️','💌','📖','🌙','💭','✨','🎵'];

  function escHtml(str){return(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  var _authCb=null;
  function openMemoAuth(cb){
    _authCb=cb;
    var m=document.getElementById('memoAuthModal');m.classList.add('open');
    document.getElementById('memoAuthInput').value='';
    document.getElementById('memoAuthErr').style.display='none';
    setTimeout(function(){document.getElementById('memoAuthInput').focus();},80);
  }
  window.closeMemoAuth=function(){document.getElementById('memoAuthModal').classList.remove('open');};
  var _memoFailCount=0, _memoBlocked=false;
  window.memoCheckAuth=async function(){
    if(_memoBlocked) return;
    var val=document.getElementById('memoAuthInput').value.trim().toUpperCase();
    var h=await _sha256(val);
    if(h===_MEMO_HASH){_memoFailCount=0;window.closeMemoAuth();if(_authCb){_authCb();_authCb=null;}}
    else{
      _memoFailCount++;
      document.getElementById('memoAuthInput').value='';
      document.getElementById('memoAuthInput').focus();
      var errEl=document.getElementById('memoAuthErr');
      if(_memoFailCount>=5){
        _memoBlocked=true;
        errEl.style.display='block';errEl.textContent='⛔ Trop de tentatives — attends 30s';
        document.getElementById('memoAuthInput').disabled=true;
        setTimeout(function(){_memoBlocked=false;_memoFailCount=0;document.getElementById('memoAuthInput').disabled=false;errEl.style.display='none';},30000);
      } else {
        errEl.style.display='block';errEl.textContent='❌ Code incorrect, réessaie ! ('+_memoFailCount+'/5)';
      }
    }
  };
  document.getElementById('memoAuthInput').addEventListener('keydown',function(e){if(e.key==='Enter')window.memoCheckAuth();});
  document.getElementById('memoAuthModal').addEventListener('click',function(e){if(e.target===this)window.closeMemoAuth();});

  window.memoRequestUnlock=function(){
    if(memoUnlocked){memoLock();return;}
    // Si session V2 active, pas de code demandé
    if(v2LoadSession()){memoUnlock();return;}
    openMemoAuth(function(){memoUnlock();});
  };

  function memoUnlock(){
    memoUnlocked=true;
    document.getElementById('memoLockBadge').classList.add('unlocked');
    document.getElementById('memoLockTxt').textContent='Verrouiller';
    document.getElementById('memoTodoAddRow').style.display='flex';
    renderNotes();renderTodos();
  }
  function memoLock(){
    memoUnlocked=false;
    document.getElementById('memoLockBadge').classList.remove('unlocked');
    document.getElementById('memoLockTxt').textContent='Modifier';
    document.getElementById('memoTodoAddRow').style.display='none';
    renderNotes();renderTodos();
  }

  function renderNotes(){
    var slider=document.getElementById('memoNotesSlider');
    slider.innerHTML='<div class="memo-loading"><span class="spinner"></span>Chargement...</div>';
    sbGet('memo_notes').then(function(notes){
      slider.innerHTML='';
      var addCard=document.createElement('div');
      addCard.className='memo-note-add-card'+(memoUnlocked?' visible':'');
      addCard.innerHTML='<div class="memo-note-add-img"><div class="memo-note-add-icon">+</div><div class="memo-note-add-lbl">Nouvelle note</div></div>';
      addCard.addEventListener('click',function(){openMemoModal(null,true);});
      slider.appendChild(addCard);
      if(!Array.isArray(notes)||!notes.length){
        var empty=document.createElement('div');empty.className='memo-notes-empty';
        empty.textContent=memoUnlocked?'Aucune note — ajoute-en une !':'Aucune note pour l\'instant.';
        slider.appendChild(empty);return;
      }
      notes.forEach(function(note,i){
        var col=NOTE_COLORS[i%NOTE_COLORS.length],icon=NOTE_ICONS[i%NOTE_ICONS.length];
        var prev=(note.text||'').substring(0,40)+((note.text||'').length>40?'…':'');
        var d=new Date(note.updated_at||note.created_at);
        var ds=d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
        var isRecentlyModified = note.updated_at &&
          note.updated_at !== note.created_at &&
          (Date.now() - new Date(note.updated_at).getTime()) < 6 * 60 * 60 * 1000;
        var newBadge = isRecentlyModified ? '<div class="memo-note-new-badge">new</div>' : '';
        var card=document.createElement('div');card.className='memo-note-card';
        card.innerHTML=
          '<div class="memo-note-img" style="background:'+col+'">' +
          '<div class="memo-note-bg">'+icon+'</div>' +
          newBadge +
          '<div class="memo-note-date-badge">'+escHtml(ds)+'</div>' +
          '<div class="memo-note-banner">'+escHtml(note.title||'Note')+'</div></div>' +
          '<div class="memo-note-preview">'+escHtml(prev)+'</div>';
        (function(n){card.addEventListener('click',function(){openMemoModal(n,false);});})(note);
        slider.appendChild(card);
      });
    }).catch(function(){
      document.getElementById('memoNotesSlider').innerHTML='<div class="memo-notes-empty">❌ Erreur de connexion Supabase.</div>';
    });
  }

  function openMemoModal(note,isNew){
    memoCurrentNote=note;
    if(memoUnlocked){
      document.getElementById('memoModalView').style.display='none';
      document.getElementById('memoModalEdit').style.display='block';
      document.getElementById('memoModalTitleInput').value=isNew?'':(note.title||'');
      document.getElementById('memoModalTextarea').value=isNew?'':(note.text||'');
      document.getElementById('memoModalDelBtn').style.display=isNew?'none':'block';
    }else{
      document.getElementById('memoModalView').style.display='block';
      document.getElementById('memoModalEdit').style.display='none';
      document.querySelector('.memo-modal-label').textContent=note&&note.title?note.title:'Note';
      document.getElementById('memoModalContent').textContent=note?(note.text||'(vide)'):'';
      var modDate=note?(note.updated_at||note.created_at):Date.now();
      var d=new Date(modDate);
      var isUpdated=note&&note.updated_at&&note.updated_at!==note.created_at;
      document.getElementById('memoModalDate').textContent=
        (isUpdated?'Modifié le ':'Créé le ')+
        d.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+
        ' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    }
    document.getElementById('memoModal').classList.add('open');
  }
  window.closeMemoModal=function(){document.getElementById('memoModal').classList.remove('open');memoCurrentNote=null;document.querySelector('.memo-modal-label').textContent='Note';};
  document.getElementById('memoModal').addEventListener('click',function(e){if(e.target===this)window.closeMemoModal();});

  window.memoSaveNote=function(){
    var txt=document.getElementById('memoModalTextarea').value.trim();
    var ttl=document.getElementById('memoModalTitleInput').value.trim()||'Sans titre';
    if(!txt)return;
    var btn=document.querySelector('.memo-modal-save');btn.textContent='⏳';btn.disabled=true;
    var done=function(){btn.textContent='Sauvegarder 💾';btn.disabled=false;window.closeMemoModal();renderNotes();};
    if(memoCurrentNote&&memoCurrentNote.id){
      sbPatch('memo_notes',memoCurrentNote.id,{text:txt,title:ttl,updated_at:new Date().toISOString()}).then(done).catch(done);
    }else{
      sbPost('memo_notes',{text:txt,title:ttl}).then(done).catch(done);
    }
  };
  window.memoDeleteNote=function(){
    if(!memoCurrentNote||!memoCurrentNote.id){window.closeMemoModal();return;}
    sbDelete('memo_notes',memoCurrentNote.id).then(function(){window.closeMemoModal();renderNotes();});
  };

  function renderTodos(){
    var container=document.getElementById('memoTodoList');
    container.innerHTML='<div class="memo-loading"><span class="spinner"></span>Chargement...</div>';
    sbGet('memo_todos','order=created_at.asc').then(function(items){
      container.innerHTML='';
      if(!Array.isArray(items)||!items.length){
        var empty=document.createElement('div');empty.className='todo-empty';
        empty.textContent=memoUnlocked?'Aucun item — ajoute-en un !':'La to-do est vide.';
        container.appendChild(empty);return;
      }
      items.forEach(function(item){
        var row=document.createElement('div');row.className='todo-item';
        row.innerHTML=
          '<div class="todo-check'+(item.done?' done':'')+'">'+(item.done?'✓':'')+'</div>'+
          '<div class="todo-text'+(item.done?' done':'')+'">'+escHtml(item.text)+'</div>'+
          (memoUnlocked?'<div class="todo-del">✕</div>':'');
        (function(it){
          row.querySelector('.todo-check').addEventListener('click',function(){
            sbPatch('memo_todos',it.id,{done:!it.done}).then(renderTodos);
          });
          var del=row.querySelector('.todo-del');
          if(del)del.addEventListener('click',function(e){e.stopPropagation();sbDelete('memo_todos',it.id).then(renderTodos);});
        })(item);
        container.appendChild(row);
      });
    }).catch(function(){
      document.getElementById('memoTodoList').innerHTML='<div class="todo-empty">❌ Erreur Supabase.</div>';
    });
  }

  window.memoAddTodoItem=function(){
    var input=document.getElementById('memoTodoInput'),txt=input.value.trim();if(!txt)return;
    input.value='';
    sbPost('memo_todos',{text:txt,done:false}).then(renderTodos);
  };
  document.getElementById('memoTodoInput').addEventListener('keydown',function(e){if(e.key==='Enter')window.memoAddTodoItem();});

  renderNotes();renderTodos();
})();
