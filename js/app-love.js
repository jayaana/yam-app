// ═══════════════════════════════════════════════════════════
// app-love.js — Page Nous : Photos Elle/Lui · Raisons · Post-its · Memo

// ════════════════════════════════════════════
// HELPER STORAGE — couple-aware
// Toutes les images sont stockées sous :
//   images/{couple_id}/elle/{slot}.jpg
//   images/{couple_id}/lui/{slot}.jpg
//   images/{couple_id}/livres/{idx}.jpg
// ════════════════════════════════════════════
function getCoupleId(){
  var u = (typeof v2GetUser === 'function') ? v2GetUser() : null;
  return (u && u.couple_id) ? u.couple_id : 'shared';
}

function storagePublicUrl(folder, filename){
  return SB2_URL + '/storage/v1/object/public/images/' + getCoupleId() + '/' + folder + '/' + filename + '?t=' + Date.now();
}

function storageUploadUrl(folder, filename){
  return SB2_URL + '/storage/v1/object/images/' + getCoupleId() + '/' + folder + '/' + filename;
}

// Upload générique vers Supabase Storage SB2 (bucket "images")
function storageUpload(folder, filename, file, onProgress, onDone, onError){
  var url = storageUploadUrl(folder, filename);
  fetch(url, {
    method: 'POST',
    headers: {
      'apikey':          SB2_KEY,
      'Authorization':   'Bearer ' + SB2_KEY,
      'Content-Type':    file.type,
      'x-upsert':        'true'
    },
    body: file
  })
  .then(function(r){
    return r.text().then(function(body){
      if(r.ok){ if(onDone) onDone(); }
      else { if(onError) onError('Erreur ' + r.status + ' : ' + body); }
    });
  })
  .catch(function(err){ if(onError) onError('Erreur réseau : ' + err); });
}

// Probe si une image existe dans Storage
function storageProbe(url, onExist, onMissing){
  var img = new Image();
  img.onload  = function(){ if(onExist)   onExist(url); };
  img.onerror = function(){ if(onMissing) onMissing(); };
  img.src = url;
}

// Validation fichier image
function validateImageFile(file){
  var ALLOWED = ['image/jpeg','image/jpg','image/png','image/webp'];
  if(ALLOWED.indexOf(file.type) === -1) return 'Format non autorisé. Utilise JPEG, PNG ou WebP.';
  if(file.size > 8 * 1024 * 1024) return 'Image trop lourde (max 8 Mo)';
  return null;
}

// ════════════════════════════════════════════
// SECTION ELLE — modifiable par ELLE uniquement
// ════════════════════════════════════════════
(function(){
  var FOLDER = 'elle';
  var SLOTS  = ['animal','fleurs','personnage','saison','repas'];
  var ELLE_DESC_DEFAULTS = {
    animal:     'Un regard doux 💫',
    fleurs:     'Pleine de couleurs 💕',
    personnage: 'Attachante 💍',
    saison:     'Un rayon de soleil ☀️',
    repas:      "N'aime que les pattes 🤝"
  };
  var _currentSlot = null;

  function elleLoadImages(){
    SLOTS.forEach(function(slot){
      var url = storagePublicUrl(FOLDER, slot + '.jpg');
      var img = document.getElementById('elle-img-' + slot);
      if(!img) return;
      storageProbe(url,
        function(u){ img.src = u; img.classList.add('loaded'); },
        null // pas d'image → on garde le src vide, le slot reste vide
      );
    });
  }

  function elleSyncEditMode(){
    // Elle peut modifier ses propres photos, Lui peut seulement voir
    var profile = getProfile();
    var canEdit = (profile === 'girl');
    SLOTS.forEach(function(slot){
      var btn  = document.getElementById('elle-btn-' + slot);
      var desc = document.getElementById('elle-desc-' + slot);
      if(btn)  btn.style.display = canEdit ? '' : 'none';
      if(desc){
        if(canEdit) desc.classList.add('lui-desc-editable');
        else        desc.classList.remove('lui-desc-editable');
      }
    });
  }

  window.elleUploadClick = function(slot){
    if(getProfile() !== 'girl'){ return; }
    _currentSlot = slot;
    var input = document.getElementById('elleFileInput');
    input.value = ''; input.click();
  };

  window.elleHandleFile = function(input){
    if(!input.files || !input.files[0]) return;
    var file = input.files[0];
    var slot = _currentSlot;
    if(!slot) return;

    var err = validateImageFile(file);
    if(err){ alert(err); input.value = ''; return; }

    var loading = document.getElementById('elle-loading-' + slot);
    var bar     = document.getElementById('elle-bar-' + slot);
    if(loading) loading.classList.add('show');
    if(bar){ bar.style.width = '0%'; setTimeout(function(){ bar.style.width = '60%'; }, 100); }

    storageUpload(FOLDER, slot + '.jpg', file,
      null,
      function(){
        if(bar)     bar.style.width = '100%';
        if(loading) loading.classList.remove('show');
        var img = document.getElementById('elle-img-' + slot);
        if(img){ img.src = storagePublicUrl(FOLDER, slot + '.jpg'); img.classList.add('loaded'); }
      },
      function(errMsg){
        if(loading) loading.classList.remove('show');
        alert(errMsg);
      }
    );
  };

  // Descriptions — filtrées par couple_id
  function elleLoadDescs(){
    var cid = getCoupleId();
    fetch(SB2_URL + '/rest/v1/v2_photo_descs?couple_id=eq.' + encodeURIComponent(cid) + '&category=eq.elle&select=slot,description', {
      headers: sbHeaders()
    })
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(rows){
      if(!Array.isArray(rows)) return;
      rows.forEach(function(row){
        var el = document.getElementById('elle-desc-' + row.slot);
        if(el && row.description) el.textContent = row.description;
      });
    })
    .catch(function(){});
  }

  function elleSaveDesc(slot, val){
    var cid = getCoupleId();
    fetch(SB2_URL + '/rest/v1/v2_photo_descs', {
      method: 'POST',
      headers: sbHeaders({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ couple_id: cid, category: 'elle', slot: slot, description: val })
    }).catch(function(){});
  }

  var SLOT_LABELS = { animal:'Son animal', fleurs:'Ses fleurs', personnage:'Son personnage', saison:'Sa saison', repas:'Son repas' };
  window.elleEditDesc = function(slot){
    if(getProfile() !== 'girl') return;
    var el = document.getElementById('elle-desc-' + slot);
    if(!el) return;
    descEditOpen(el.textContent.trim(), 'Légende · ' + (SLOT_LABELS[slot] || slot), function(val){
      val = val || ELLE_DESC_DEFAULTS[slot];
      el.textContent = val;
      elleSaveDesc(slot, val);
    });
  };

  function init(){
    elleLoadImages();
    elleLoadDescs();
    elleSyncEditMode();
  }
  init();

  var _origSP = window.setProfile;
  window.setProfile = function(g){
    if(_origSP) _origSP.apply(this, arguments);
    setTimeout(function(){ elleSyncEditMode(); elleLoadImages(); elleLoadDescs(); }, 400);
  };
})();

// ════════════════════════════════════════════
// SECTION LUI — modifiable par LUI uniquement
// ════════════════════════════════════════════
(function(){
  var FOLDER = 'lui';
  var SLOTS  = ['animal','fleurs','personnage','saison','repas'];
  var LUI_DESC_DEFAULTS = {
    animal:     'Son animal 🐾',
    fleurs:     'Ses fleurs 🌸',
    personnage: 'Son personnage 💙',
    saison:     'Sa saison 🍂',
    repas:      'Son repas préféré 🍽️'
  };
  var _currentSlot = null;

  function luiLoadImages(){
    SLOTS.forEach(function(slot){
      var url   = storagePublicUrl(FOLDER, slot + '.jpg');
      var img   = document.getElementById('lui-img-' + slot);
      var empty = document.getElementById('lui-empty-' + slot);
      var btn   = document.getElementById('lui-btn-' + slot);
      if(!img) return;
      storageProbe(url,
        function(u){
          img.src = u; img.style.display = '';
          if(empty) empty.style.display = 'none';
          if(btn)   btn.classList.remove('empty');
        },
        function(){
          img.style.display = 'none';
          if(empty) empty.style.display = '';
          if(btn)   btn.classList.add('empty');
        }
      );
    });
  }

  function luiSyncEditMode(){
    var profile = getProfile();
    var canEdit = (profile === 'boy');
    SLOTS.forEach(function(slot){
      var btn  = document.getElementById('lui-btn-' + slot);
      var desc = document.getElementById('lui-desc-' + slot);
      if(btn)  btn.style.display = canEdit ? '' : 'none';
      if(desc){
        if(canEdit) desc.classList.add('lui-desc-editable');
        else        desc.classList.remove('lui-desc-editable');
      }
    });
  }

  window.luiUploadClick = function(slot){
    if(getProfile() !== 'boy') return;
    _currentSlot = slot;
    var input = document.getElementById('luiFileInput');
    input.value = ''; input.click();
  };

  window.luiHandleFile = function(input){
    if(!input.files || !input.files[0]) return;
    var file = input.files[0];
    var slot = _currentSlot;
    if(!slot) return;

    var err = validateImageFile(file);
    if(err){ alert(err); input.value = ''; return; }

    var loading = document.getElementById('lui-loading-' + slot);
    var bar     = document.getElementById('lui-bar-' + slot);
    if(loading) loading.classList.add('show');
    if(bar){ bar.style.width = '0%'; setTimeout(function(){ bar.style.width = '60%'; }, 100); }

    storageUpload(FOLDER, slot + '.jpg', file,
      null,
      function(){
        if(bar)     bar.style.width = '100%';
        if(loading) loading.classList.remove('show');
        var img   = document.getElementById('lui-img-' + slot);
        var empty = document.getElementById('lui-empty-' + slot);
        var btn   = document.getElementById('lui-btn-' + slot);
        var url   = storagePublicUrl(FOLDER, slot + '.jpg');
        if(img){ img.src = url; img.style.display = ''; }
        if(empty) empty.style.display = 'none';
        if(btn)   btn.classList.remove('empty');
      },
      function(errMsg){
        if(loading) loading.classList.remove('show');
        alert(errMsg);
      }
    );
  };

  function luiLoadDescs(){
    var cid = getCoupleId();
    fetch(SB2_URL + '/rest/v1/v2_photo_descs?couple_id=eq.' + encodeURIComponent(cid) + '&category=eq.lui&select=slot,description', {
      headers: sbHeaders()
    })
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(rows){
      if(!Array.isArray(rows)) return;
      rows.forEach(function(row){
        var el = document.getElementById('lui-desc-' + row.slot);
        if(el && row.description) el.textContent = row.description;
      });
    })
    .catch(function(){});
  }

  function luiSaveDesc(slot, val){
    var cid = getCoupleId();
    fetch(SB2_URL + '/rest/v1/v2_photo_descs', {
      method: 'POST',
      headers: sbHeaders({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ couple_id: cid, category: 'lui', slot: slot, description: val })
    }).catch(function(){});
  }

  window.luiEditDesc = function(slot){
    if(getProfile() !== 'boy') return;
    var el = document.getElementById('lui-desc-' + slot);
    if(!el) return;
    var LABELS = { animal:'Son animal', fleurs:'Ses fleurs', personnage:'Son personnage', saison:'Sa saison', repas:'Son repas' };
    descEditOpen(el.textContent.trim(), 'Légende · ' + (LABELS[slot] || slot), function(val){
      val = val || LUI_DESC_DEFAULTS[slot];
      el.textContent = val;
      luiSaveDesc(slot, val);
    });
  };

  function init(){
    luiLoadImages();
    luiLoadDescs();
    luiSyncEditMode();
  }
  init();

  var _origSP = window.setProfile;
  window.setProfile = function(g){
    if(_origSP) _origSP.apply(this, arguments);
    setTimeout(function(){ luiSyncEditMode(); luiLoadImages(); luiLoadDescs(); }, 400);
  };
})();


// ════════════════════════════════════════════
// SECTION LIVRES — modifiable par Elle ET Lui
// Stocké dans v2_books (couple_id, idx, title, desc, url, img)
// Image dans Storage : images/{couple_id}/livres/{idx}.jpg
// ════════════════════════════════════════════
(function(){
  var FOLDER     = 'livres';
  var MAX_BOOKS  = 8;   // max 8 livres par couple
  var _editIdx   = null; // index du livre en cours d'édition (null = nouveau)
  var _booksData = [];   // cache local

  // ── Charger les livres depuis v2_books ──
  function booksLoad(){
    var cid = getCoupleId();
    if(cid === 'shared') return; // pas encore de couple_id = on attend
    fetch(SB2_URL + '/rest/v1/v2_books?couple_id=eq.' + encodeURIComponent(cid) + '&order=position.asc,created_at.asc', {
      headers: sbHeaders()
    })
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(rows){
      _booksData = Array.isArray(rows) ? rows : [];
      booksRender();
    })
    .catch(function(){ booksRender(); });
  }

  // ── Render ──
  function booksRender(){
    var slider   = document.getElementById('booksSlider');
    var addBtn   = document.getElementById('booksAddBtn');
    if(!slider) return;

    var canEdit  = !!getProfile();
    if(addBtn) addBtn.style.display = (canEdit && _booksData.length < MAX_BOOKS) ? '' : 'none';

    slider.innerHTML = '';

    if(!_booksData.length){
      slider.innerHTML = '<div style="padding:20px 8px;color:var(--muted);font-size:13px;text-align:center;">Aucun livre ajouté — soyez les premiers ! 📖</div>';
      return;
    }

    _booksData.forEach(function(book, i){
      var card = document.createElement('div');
      card.className = 'album-card';

      var imgSrc = storagePublicUrl(FOLDER, book.idx + '.jpg');
      var hasImg = !!book.has_image; // flag stocké en base

      card.innerHTML =
        '<div class="album-image" style="position:relative;">' +
          (hasImg
            ? '<img id="book-img-' + book.idx + '" src="' + escHtml(imgSrc) + '" loading="lazy" decoding="async" onload="this.classList.add(\'loaded\')" style="width:100%;height:100%;object-fit:cover;">'
            : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px;background:var(--s2);">📚</div>'
          ) +
          '<div class="album-banner">' + escHtml(book.title || 'Livre') + '</div>' +
          (canEdit ? '<div class="lui-upload-btn" onclick="booksEditClick(' + i + ')" style="opacity:0;position:absolute;inset:0;background:rgba(0,0,0,0.5);display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:inherit;cursor:pointer;transition:opacity 0.2s;"><div style="font-size:20px;">✏️</div><div style="font-size:11px;font-weight:700;color:#fff;margin-top:4px;">Modifier</div></div>' : '') +
        '</div>' +
        '<div class="album-desc">' + escHtml(book.description || '') + '</div>';

      // Hover show edit overlay
      if(canEdit){
        var overlay = card.querySelector('.lui-upload-btn');
        if(overlay){
          card.addEventListener('mouseenter', function(){ overlay.style.opacity = '1'; });
          card.addEventListener('mouseleave', function(){ overlay.style.opacity = '0'; });
          card.addEventListener('touchstart', function(){ overlay.style.opacity = '1'; }, {passive:true});
        }
      }

      slider.appendChild(card);
    });
  }

  // ── Clic "Ajouter" ──
  window.booksAddClick = function(){
    if(!getProfile()) return;
    _editIdx = null;
    booksOpenModal(null);
  };

  // ── Clic "Modifier" sur un livre existant ──
  window.booksEditClick = function(i){
    if(!getProfile()) return;
    _editIdx = i;
    booksOpenModal(_booksData[i]);
  };

  // ── Modal édition livre ──
  function booksOpenModal(book){
    // Créer la modal si elle n'existe pas
    var modal = document.getElementById('booksModal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'booksModal';
      modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:2500;background:rgba(0,0,0,0.7);align-items:flex-end;justify-content:center;';
      modal.innerHTML =
        '<div id="booksSheet" style="width:100%;max-width:480px;background:var(--s1);border-radius:24px 24px 0 0;border-top:1px solid var(--border);padding:20px 20px calc(env(safe-area-inset-bottom,0px)+24px);font-family:\'DM Sans\',sans-serif;max-height:80vh;overflow-y:auto;">' +
          '<div style="display:flex;justify-content:center;margin-bottom:16px;"><div style="width:40px;height:4px;border-radius:2px;background:var(--border);"></div></div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
            '<div id="booksModalTitle" style="font-size:17px;font-weight:700;color:var(--text);">Ajouter un livre</div>' +
            '<button onclick="booksCloseModal()" style="background:var(--s2);border:none;border-radius:50%;width:30px;height:30px;color:var(--muted);font-size:15px;cursor:pointer;">✕</button>' +
          '</div>' +
          // Image upload
          '<div onclick="document.getElementById(\'booksFileInput\').click()" id="booksImgPreview" style="width:100%;height:160px;background:var(--s2);border:2px dashed var(--border);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;margin-bottom:14px;overflow:hidden;position:relative;">' +
            '<div id="booksImgPlaceholder" style="display:flex;flex-direction:column;align-items:center;gap:8px;"><span style="font-size:36px;">📷</span><span style="font-size:13px;color:var(--muted);">Ajouter une photo de couverture</span></div>' +
            '<img id="booksImgThumb" src="" style="display:none;width:100%;height:100%;object-fit:cover;border-radius:12px;">' +
          '</div>' +
          // Titre
          '<input type="text" id="booksTitleInput" placeholder="Titre du livre..." maxlength="50" style="width:100%;background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text);font-size:14px;font-family:\'DM Sans\',sans-serif;outline:none;box-sizing:border-box;margin-bottom:10px;">' +
          // Description
          '<input type="text" id="booksDescInput" placeholder="Courte description..." maxlength="60" style="width:100%;background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text);font-size:14px;font-family:\'DM Sans\',sans-serif;outline:none;box-sizing:border-box;margin-bottom:14px;">' +
          // Actions
          '<div style="display:flex;gap:8px;">' +
            '<button onclick="booksSave()" style="flex:1;padding:13px;background:var(--green);color:#000;border:none;border-radius:10px;font-size:14px;font-weight:700;font-family:\'DM Sans\',sans-serif;cursor:pointer;">Sauvegarder 💾</button>' +
            '<button id="booksDeleteBtn" onclick="booksDelete()" style="padding:13px 16px;background:rgba(224,85,85,0.1);border:1.5px solid rgba(224,85,85,0.4);color:#e05555;border-radius:10px;font-size:13px;font-weight:700;font-family:\'DM Sans\',sans-serif;cursor:pointer;display:none;">🗑️</button>' +
          '</div>' +
          '<div id="booksModalMsg" style="font-size:12px;color:var(--green);text-align:center;margin-top:10px;min-height:18px;"></div>' +
        '</div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', function(e){ if(e.target===this) booksCloseModal(); });
    }

    // Remplir
    document.getElementById('booksModalTitle').textContent = book ? 'Modifier le livre' : 'Ajouter un livre';
    document.getElementById('booksTitleInput').value = book ? (book.title || '') : '';
    document.getElementById('booksDescInput').value  = book ? (book.description  || '') : '';
    document.getElementById('booksDeleteBtn').style.display = book ? '' : 'none';
    document.getElementById('booksModalMsg').textContent = '';

    // Thumb image existante
    var thumb = document.getElementById('booksImgThumb');
    var placeholder = document.getElementById('booksImgPlaceholder');
    if(book && book.has_image){
      thumb.src = storagePublicUrl(FOLDER, book.idx + '.jpg');
      thumb.style.display = '';
      placeholder.style.display = 'none';
    } else {
      thumb.src = ''; thumb.style.display = 'none';
      placeholder.style.display = 'flex';
    }

    // Afficher
    modal.style.display = 'flex';
    var sheet = document.getElementById('booksSheet');
    sheet.style.transform = 'translateY(100%)';
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){ sheet.style.transform = 'translateY(0)'; sheet.style.transition = 'transform 0.3s'; });
    });
  }

  window.booksCloseModal = function(){
    var modal = document.getElementById('booksModal');
    var sheet = document.getElementById('booksSheet');
    if(!modal) return;
    if(sheet){ sheet.style.transform = 'translateY(100%)'; }
    setTimeout(function(){ modal.style.display = 'none'; }, 300);
    _editIdx = null;
    _pendingFile = null;
  };

  // Fichier image sélectionné
  var _pendingFile = null;
  window.booksHandleFile = function(input){
    if(!input.files || !input.files[0]) return;
    var file = input.files[0];
    var err = validateImageFile(file);
    if(err){ alert(err); input.value=''; return; }
    _pendingFile = file;
    // Preview
    var reader = new FileReader();
    reader.onload = function(e){
      var thumb = document.getElementById('booksImgThumb');
      var placeholder = document.getElementById('booksImgPlaceholder');
      if(thumb){ thumb.src = e.target.result; thumb.style.display = ''; }
      if(placeholder) placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  };

  // Sauvegarder
  window.booksSave = function(){
    var title = (document.getElementById('booksTitleInput').value || '').trim();
    var desc  = (document.getElementById('booksDescInput').value  || '').trim();
    var msg   = document.getElementById('booksModalMsg');
    if(!title){ msg.textContent = '⚠️ Titre obligatoire'; msg.style.color='#e05555'; return; }

    var cid = getCoupleId();
    if(cid === 'shared'){ msg.textContent = '⚠️ Compte non lié'; msg.style.color='#e05555'; return; }

    msg.textContent = '⏳ Enregistrement...'; msg.style.color = 'var(--muted)';

    // Générer un idx unique (timestamp ou position)
    var idx = (_editIdx !== null && _booksData[_editIdx]) ? _booksData[_editIdx].idx : Date.now();
    var hasImage = (_editIdx !== null && _booksData[_editIdx]) ? !!_booksData[_editIdx].has_image : false;
    if(_pendingFile) hasImage = true;

    var bookPayload = {
      couple_id:  cid,
      idx:        idx,
      title:      title,
      description: desc,
      has_image:  hasImage,
      position:   (_editIdx !== null && _booksData[_editIdx]) ? (_booksData[_editIdx].position || _editIdx) : _booksData.length
    };

    var doSave = function(){
      fetch(SB2_URL + '/rest/v1/v2_books', {
        method: 'POST',
        headers: sbHeaders({ 'Prefer': 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(bookPayload)
      })
      .then(function(r){ return r.json(); })
      .then(function(res){
        if(res && res.error){ msg.textContent='❌ '+res.error; msg.style.color='#e05555'; return; }
        msg.textContent = '✅ Sauvegardé !'; msg.style.color = 'var(--green)';
        _pendingFile = null;
        setTimeout(function(){ booksCloseModal(); booksLoad(); }, 800);
      })
      .catch(function(){ msg.textContent='❌ Erreur réseau'; msg.style.color='#e05555'; });
    };

    // Upload image si nécessaire
    if(_pendingFile){
      storageUpload(FOLDER, idx + '.jpg', _pendingFile, null, doSave, function(e){ msg.textContent='❌ '+e; msg.style.color='#e05555'; });
    } else {
      doSave();
    }
  };

  // Supprimer un livre
  window.booksDelete = function(){
    if(_editIdx === null) return;
    var book = _booksData[_editIdx];
    if(!book) return;
    var msg = document.getElementById('booksModalMsg');
    msg.textContent = '⏳ Suppression...'; msg.style.color = 'var(--muted)';
    var cid = getCoupleId();
    fetch(SB2_URL + '/rest/v1/v2_books?couple_id=eq.' + encodeURIComponent(cid) + '&idx=eq.' + book.idx, {
      method: 'DELETE',
      headers: sbHeaders()
    })
    .then(function(){ setTimeout(function(){ booksCloseModal(); booksLoad(); }, 300); })
    .catch(function(){ msg.textContent='❌ Erreur'; msg.style.color='#e05555'; });
  };

  // Init + resync après login
  function init(){
    var cid = getCoupleId();
    if(cid !== 'shared') booksLoad();
    var addBtn = document.getElementById('booksAddBtn');
    if(addBtn) addBtn.style.display = getProfile() ? '' : 'none';
  }
  init();

  var _origSP = window.setProfile;
  window.setProfile = function(g){
    if(_origSP) _origSP.apply(this, arguments);
    setTimeout(booksLoad, 500);
  };

  // Charger aussi dès que couple_id est disponible (après loadCoupleConfig)
  var _booksLoaded = false;
  var _booksCheckIv = setInterval(function(){
    if(getCoupleId() !== 'shared' && !_booksLoaded){
      _booksLoaded = true;
      clearInterval(_booksCheckIv);
      booksLoad();
    }
  }, 1000);

})();


// ── FADE-IN ──
var fadeObs = new IntersectionObserver(function(entries) {
  entries.forEach(function(e) {
    if (e.isIntersecting) { e.target.classList.add('visible'); fadeObs.unobserve(e.target); }
  });
}, { threshold: 0.08 });
document.querySelectorAll('.fade-in').forEach(function(el){ fadeObs.observe(el); });

// ── RAISONS ──
// Les raisons peuvent être overridées par app-account.js via window.YAM_COUPLE.reasons
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

// ── Permet à app-account.js de mettre à jour les raisons depuis Supabase ──
window.reloadReasons = function(newReasons){
  if(!Array.isArray(newReasons) || !newReasons.length) return;
  reasons.length = 0;
  newReasons.forEach(function(r){ reasons.push(r); });
  _reasonDeck = _buildDeck();
  _reasonDeckPos = 0;
  var i = _reasonDeck[_reasonDeckPos++];
  var rText = document.getElementById('reasonText');
  if(rText) showReason(i);
};

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
    // Récupérer les messages non lus envoyés par l'autre
    fetch(SB2_URL + '/rest/v1/v2_dm_messages?sender=eq.' + other + '&seen=eq.false&deleted=eq.false&order=created_at.desc&limit=99', {
      headers: sbHeaders()
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
  var h=document.createElement('div');h.className='like-heart';h.textContent='🤍';document.body.appendChild(h);setTimeout(function(){h.remove();},600);
  // Incrémenter le compteur Supabase
  var profile = getProfile() || null;
  if(!profile) return; // pas de profil = animation only
  fetch(SB2_URL+'/rest/v1/rpc/increment_like_counter', {
    method:'POST',
    headers:sbHeaders(),
    body:JSON.stringify({ p_profile: profile })
  }).then(function(){ loadLikeCounters(); }).catch(function(){});
}

function fmtLikes(n){
  if(!n || n<=0) return '0';
  if(n>=1000000) return (n/1000000).toFixed(1).replace('.0','')+'M';
  if(n>=1000) return (n/1000).toFixed(1).replace('.0','')+'k';
  return String(n);
}

function loadLikeCounters(){
  sbGet('like_counters','select=profile,total').then(function(rows){
    if(!Array.isArray(rows)) return;
    rows.forEach(function(r){
      if(r.profile==='girl') document.getElementById('likeNumGirl').textContent = fmtLikes(r.total);
      if(r.profile==='boy')  document.getElementById('likeNumBoy').textContent  = fmtLikes(r.total);
    });
  }).catch(function(){});
}

loadLikeCounters();
// Polling toutes les 5s pour voir les coeurs de l'autre en temps réel
window._likesIv = setInterval(loadLikeCounters, 5000);
function openSearch(){
  if(isQuizOpen)return;
  resetZoom();
  var o=document.getElementById('searchOverlay');
  o.classList.add('open');
  document.getElementById('searchInput').value='';
  document.getElementById('searchResults').innerHTML='';
  setTimeout(function(){document.getElementById('searchInput').focus();},80);
}
function closeSearch(){
  resetZoom();
  document.getElementById('searchOverlay').classList.remove('open');
}
function filterSongs(q){
  var res=document.getElementById('searchResults');
  res.innerHTML='';
  if(!q.trim())return;
  var f=allSongs.filter(function(s){return s.title.toLowerCase().includes(q.toLowerCase())||s.artist.toLowerCase().includes(q.toLowerCase());});
  if(!f.length){res.innerHTML='<p style="color:var(--muted);text-align:center;padding:20px;font-size:13px">Aucun résultat</p>';return;}
  f.forEach(function(s){
    var row=document.createElement('div');
    row.className='sp-song';
    row.style.cssText='display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;cursor:pointer;';
    row.innerHTML='<div class="sp-info"><div class="sp-title">'+escHtml(s.title)+'</div><div class="sp-artist">'+escHtml(s.artist)+'</div></div><div style="font-size:11px;color:var(--green);font-weight:600;flex-shrink:0">▶</div>';
    row.addEventListener('click', function(){
      closeSearch();
      // Trouver la vraie ligne dans le top50 et la jouer
      var realRow = songRows[s.file];
      if(realRow){
        // Scroller vers la chanson dans le top50
        realRow.div.scrollIntoView({behavior:'smooth', block:'center'});
        setTimeout(function(){
          // Si une chanson est déjà en cours, l'arrêter
          if(currentAudio && currentAudio !== realRow.audio){
            stopCurrent();
          }
          // Lancer via le bouton du top50 pour que tout soit comptabilisé
          realRow.btn.click();
        }, 400);
      }
    });
    res.appendChild(row);
  });
}


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
    // Si connecté (session active), pas de code demandé
    if(_sbAccessToken){memoUnlock();return;}
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
