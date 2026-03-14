// ═══════════════════════════════════════════════════════════
// app-music.js — Top 50 · Player · Mini Player · Suggestions · Favoris · Glow
//
// ARCHITECTURE PLAYER :
//   Un seul <audio> global (_gAudio). Changer de piste = changer .src
//   sans jamais faire pause → zéro silence → iOS ne suspend pas en arrière-plan.
// ═══════════════════════════════════════════════════════════

var songsLove = [
  {title:"Perfect",            artist:"Ed Sheeran",     file:"perfect.mp3",                yt:"https://www.youtube.com/watch?v=2Vv-BfVoq4g"},
  {title:"Imagine",            artist:"Carbone",        file:"imagine_carbone.mp3",         yt:"https://www.youtube.com/watch?v=iuSUZyTWi6o"},
  {title:"Nanani",             artist:"Gazo",           file:"nanani.mp3",                  yt:"https://www.youtube.com/watch?v=8Bkgi6yB6P8"},
  {title:"Angela",             artist:"Hatik",          file:"angela.mp3",                  yt:"https://www.youtube.com/watch?v=uqsGUAM9WDk"},
  {title:"Bebe de Bogoda",     artist:"Moha la Squale", file:"bebe_de_bogoda.mp3",          yt:"https://www.youtube.com/watch?v=oW-xRDJhoqo"},
  {title:"Ma Belle",           artist:"Moha La Squale", file:"ma_belle_moha_la_squale.mp3", yt:"https://www.youtube.com/watch?v=NsxdxA_j8nk"},
  {title:"Luna",               artist:"Moha La Squale", file:"luna_moha_la_squale.mp3",     yt:"https://www.youtube.com/watch?v=qJZy8zy0Uy0"},
  {title:"Jaloux",             artist:"Dadju",          file:"dadju_jaloux.mp3",            yt:"https://www.youtube.com/watch?v=254EHfv9RvM"},
  {title:"Lettre à une femme", artist:"Ninho",          file:"lettre_a_une_femme_ninho.mp3",yt:"https://www.youtube.com/watch?v=ifNfpzkoY9s"},
  {title:"Jolie Bébé",         artist:"Naza",           file:"jolie_bebe_naza.mp3",         yt:"https://www.youtube.com/watch?v=sTp7C41iY6M"},
  {title:"Mon Bébé",           artist:"RnBoi",          file:"mon_bebe_rnboi.mp3",          yt:"https://www.youtube.com/watch?v=U2t5Y89I2tE"},
  {title:"Solide",             artist:"Ronisia",        file:"solide_ronisia.mp3",          yt:"https://www.youtube.com/watch?v=RHOhrdsGOc0"},
  {title:"Soleil Bleu",        artist:"Luiza",          file:"soleil_bleu_luiza.mp3",       yt:"https://www.youtube.com/watch?v=nd8RD3tjNQE"},
  {title:"Reine",              artist:"Dadju",          file:"DADJU_Reine.mp3",                        yt:"https://www.youtube.com/watch?v=tVKaN_H35xs",  isNew:true},
  {title:"Viens on essaie",    artist:"Vitaa",          file:"VITAA_VIENS_ON_ESSAIE.mp3",              yt:"https://youtu.be/KwvCpirpSgI",                 isNew:true},
  {title:"Solo",               artist:"Zaho & Tayc",    file:"Zaho_Solo.mp3",                          yt:"https://youtu.be/36gXZQzsPPk",                 isNew:true},
  {title:"On s'fait du mal",   artist:"Zaho & Dadju",   file:"Zaho_On_sfait_du_mal.mp3",               yt:"https://youtu.be/r6rodHhS1rE",                 isNew:true},
  {title:"Mon Amour",          artist:"Stromae",        file:"Stromae_Mon_amour.mp3",                  yt:"https://youtu.be/1LfgyPn8Byk",                 isNew:true},
  {title:"Ma meilleure ennemie",artist:"Stromae & Pomme",file:"Stromae_Ma_Meilleure_Ennemie.mp3",      yt:"https://youtu.be/1F3OGIFnW1k",                 isNew:true},
  {title:"Nous deux c'est mieux",artist:"Livaï",        file:"Livaï_Nous_deux_c'est_mieux.mp3",        yt:"https://youtu.be/h5O0lJeKaJo",                 isNew:true},
  {title:"Melodrama",          artist:"Theodora",       file:"Theodora_melodrama.mp3",                 yt:"https://youtu.be/szouaJ22rZY",                 isNew:true},
  {title:"Dégaine",            artist:"Aya Nakamura ft. Damso", file:"Aya_Nakamura_Dégaine.mp3",       yt:"https://youtu.be/7Lp9clJSB7E",                 isNew:true},
  {title:"Baida",              artist:"DTF",            file:"DTF_Baida.mp3",                          yt:"https://youtu.be/BogS6A_P5Cc",                 isNew:true}
];
songsLove.forEach(function(x){ x.plays = 0; });

var allSongs = songsLove;

// ════════════════════════════════════════════════════════════
// AUDIO GLOBAL — un seul élément, on change juste le src
// ════════════════════════════════════════════════════════════
var _gAudio = (function(){
  var a = document.createElement('audio');
  a.preload = 'auto';
  // Nécessaire sur iOS pour autoriser la lecture en arrière-plan
  a.setAttribute('playsinline', '');
  a.setAttribute('webkit-playsinline', '');
  document.body.appendChild(a);
  return a;
})();

// État courant du player
var _currentSong  = null;  // objet songsLove en cours
var _currentIndex = -1;    // index dans la playlist triée courante
var _playlist     = [];    // tableau d'objets songsLove dans l'ordre de lecture
var _isPlaying    = false;

// Compatibilité legacy (certains modules lisent currentAudio)
Object.defineProperty(window, 'currentAudio', {
  get: function(){ return _isPlaying || (_gAudio.src && !_gAudio.paused) ? _gAudio : (_gAudio.src ? _gAudio : null); },
  configurable: true
});
Object.defineProperty(window, 'currentRow', {
  get: function(){ return _currentSong ? (songRows[_currentSong.file] ? songRows[_currentSong.file].div : null) : null; },
  configurable: true
});

// ── Utilitaires ──
function fmtPlays(n){if(n>=1e6)return(n/1e6).toFixed(1).replace('.0','')+'M';if(n>=1e3)return(n/1e3).toFixed(1).replace('.0','')+'k';return n?String(n):'—';}

function savePlays(file){
  var _sp = yamGetUser ? {user: yamGetUser()} : null;
  var _spCoupleId = _sp && _sp.user ? _sp.user.couple_id : null;
  if(!_spCoupleId) return;
  fetch(SB_URL + '/rest/v1/rpc/increment_play', {
    method: 'POST',
    headers: sb2Headers({'Prefer': 'return=minimal'}),
    body: JSON.stringify({ p_song_file: file, p_couple_id: _spCoupleId })
  })
  .then(function(r){
    if(!r.ok) return;
    return fetch(SB_URL + '/rest/v1/song_plays?song_file=eq.' + encodeURIComponent(file) + '&couple_id=eq.' + _spCoupleId + '&select=plays', { headers: sb2Headers() });
  })
  .then(function(r){ return r && r.ok ? r.json() : null; })
  .then(function(rows){
    if(!Array.isArray(rows) || !rows.length) return;
    var newCount = parseInt(rows[0].plays, 10);
    if(isNaN(newCount)) return;
    var s = songsLove.find(function(x){ return x.file === file; });
    if(s) s.plays = newCount;
    var row = songRows[file];
    if(row){ var pe = row.div.querySelector('.sp-plays'); if(pe) pe.textContent = fmtPlays(newCount); }
  })
  .catch(function(){});
}

// Mascotte
function showDance(){
  var mascotte = document.querySelector('.yam-mascotte-zone img');
  if(mascotte) mascotte.src = 'https://raw.githubusercontent.com/jayaana/yam-app/main/assets/images/yam_dance.gif';
}
function hideDance(){
  var mascotte = document.querySelector('.yam-mascotte-zone img');
  if(mascotte) mascotte.src = 'https://raw.githubusercontent.com/jayaana/yam-app/main/assets/images/yam_start.gif';
}

// ── Mise à jour visuelle des lignes de la playlist ──
var songRows = {};  // { file: { div, btn } }

function _updateRowUI(song, playing){
  if(!song) return;
  var row = songRows[song.file];
  if(!row) return;
  if(playing){
    row.btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    row.btn.classList.add('active');
    row.div.classList.add('playing');
  } else {
    row.btn.innerHTML = '&#9654;';
    row.btn.classList.remove('active');
    row.div.classList.remove('playing');
  }
}

// ── Lecture d'une chanson ──
function _playSong(song){
  if(!song) return;

  var wasPlaying = _currentSong;

  // Met à jour l'UI de l'ancienne piste
  if(_currentSong && _currentSong !== song) _updateRowUI(_currentSong, false);

  _currentSong = song;
  _currentIndex = _playlist.indexOf(song);
  _isPlaying = true;

  // Pas de pause/play — on change juste le src si nécessaire
  var newSrc = song.file;
  var curSrc = '';
  try { curSrc = decodeURIComponent(_gAudio.src).split('/').pop(); } catch(e) { curSrc = _gAudio.src; }

  if(curSrc !== newSrc){
    _gAudio.src = newSrc;
  }

  var playPromise = _gAudio.play();
  if(playPromise && typeof playPromise.catch === 'function'){
    playPromise.catch(function(e){
      console.warn('[YAM] play() rejected:', e);
      // iOS en arrière-plan peut rejeter le premier play() — on retry jusqu'à 3 fois
      var _retryCount = 0;
      function _retry(){
        if(_retryCount >= 3 || !_isPlaying) return;
        _retryCount++;
        setTimeout(function(){
          var p2 = _gAudio.play();
          if(p2 && p2.catch) p2.catch(function(e2){
            console.warn('[YAM] play() retry '+_retryCount+' rejected:', e2);
            _retry();
          });
        }, 300 * _retryCount);
      }
      _retry();
    });
  }

  _updateRowUI(song, true);
  particleActive = true;
  showDance();

  if(window.mpUpdate) mpUpdate();
  if(window._yamMediaSession) _yamMediaSession(song);
}

function _pauseCurrent(){
  _gAudio.pause();
  _isPlaying = false;
  _updateRowUI(_currentSong, false);
  particleActive = false;
  hideDance();
  if(window.mpUpdate) mpUpdate();
}

function _stopCurrent(){
  _gAudio.pause();
  _isPlaying = false;
  _updateRowUI(_currentSong, false);
  _currentSong = null;
  _currentIndex = -1;
  particleActive = false;
  hideDance();
  if(window.mpUpdate) mpUpdate();
}
// Compatibilité legacy
window.stopCurrent = _stopCurrent;

// Comptage écoutes
_gAudio.addEventListener('timeupdate', function(){
  if(_currentSong && !_currentSong._counted && _gAudio.currentTime >= 10){
    _currentSong._counted = true;
    savePlays(_currentSong.file);
  }
});

// ── Fin de piste → piste suivante ──
_gAudio.addEventListener('ended', function(){
  if(!_currentSong) return;
  if(_currentSong) _currentSong._counted = false;
  var next = _getNextSong();
  if(next){
    // Sur iOS en arrière-plan : on change le src IMMÉDIATEMENT dans le handler ended
    // (contexte encore actif) avant que WebKit ne throttle le JS
    var wasPlaying = _currentSong;
    if(_currentSong && _currentSong !== next) _updateRowUI(_currentSong, false);
    _currentSong = next;
    _currentIndex = _playlist.indexOf(next);
    _isPlaying = true;
    _gAudio.src = next.file;
    var ep = _gAudio.play();
    if(ep && ep.catch) ep.catch(function(e){
      console.warn('[YAM] ended->play() rejected:', e);
      // Retry immédiat puis différé
      setTimeout(function(){
        if(!_isPlaying) return;
        var p2 = _gAudio.play();
        if(p2 && p2.catch) p2.catch(function(){
          setTimeout(function(){ if(_isPlaying) _gAudio.play().catch(function(){}); }, 500);
        });
      }, 200);
    });
    _updateRowUI(next, true);
    particleActive = true;
    showDance();
    if(window.mpUpdate) mpUpdate();
    if(window._yamMediaSession) _yamMediaSession(next);
  } else {
    _stopCurrent();
  }
});

// ── Calcul de la piste suivante/précédente ──
function _getNextSong(){
  if(!_currentSong || !_playlist.length) return null;
  if(playMode === 'repeatOne') return _currentSong;
  if(playMode === 'shuffle'){
    var idx = Math.floor(Math.random() * _playlist.length);
    return _playlist[idx];
  }
  var i = _playlist.indexOf(_currentSong);
  if(i < _playlist.length - 1) return _playlist[i + 1];
  if(playMode === 'repeatAll') return _playlist[0];
  return null;
}

function _getPrevSong(){
  if(!_currentSong || !_playlist.length) return null;
  var i = _playlist.indexOf(_currentSong);
  if(i > 0) return _playlist[i - 1];
  return _playlist[_playlist.length - 1];
}

// ════════════════════════════════════════════════════════════
// TOP 50
// ════════════════════════════════════════════════════════════
var prevRanks = (function(){
  try { return JSON.parse(localStorage.getItem('sp_prev_ranks') || '{}'); } catch(e){ return {}; }
})();

var TOP_VISIBLE = 4, top50Expanded = false;

function renderTop50(){
  var sorted = songsLove.slice().sort(function(a,b){ return b.plays - a.plays; });
  var newRanks = {};
  sorted.forEach(function(s,i){ newRanks[s.file] = i+1; });
  var container = document.getElementById('Love');
  container.innerHTML = '';
  songRows = {};
  document.getElementById('top50Count').textContent = sorted.length;

  // Met à jour la playlist dans l'ordre de tri
  _playlist = sorted.slice();

  sorted.forEach(function(song, i){
    var rank = i+1;
    var hidden = rank > TOP_VISIBLE && !top50Expanded;
    var trendClass = '';
    if(prevRanks[song.file] === undefined)  { trendClass = 'new'; }
    else if(prevRanks[song.file] > rank)    { trendClass = 'up'; }
    else if(prevRanks[song.file] < rank)    { trendClass = 'down'; }
    var trendHtml = trendClass ? '<span class="sp-trend '+trendClass+'"></span>' : '';

    var div = document.createElement('div');
    div.className = 'sp-song' + (hidden ? ' hidden-row' : '');
    div.dataset.file = song.file;
    div.innerHTML =
      '<div class="sp-rank"><span class="sp-rank-num">'+rank+'</span>'+trendHtml+
      '<div class="sp-rank-wave"><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div></div></div>'+
      '<div class="sp-info"><div class="sp-title">'+song.title+(song.isNew?'<span class="badge-new">new</span>':'')+'</div><div class="sp-artist">'+song.artist+'</div></div>'+
      '<button class="sp-heart" data-file="'+song.file+'">♡</button>'+
      '<div class="sp-plays">'+fmtPlays(song.plays)+'</div>'+
      '<div class="sp-actions"><button class="sp-btn-play">&#9654;</button><button class="sp-btn-yt">YT</button></div>';

    var btn = div.querySelector('.sp-btn-play');
    var ytb = div.querySelector('.sp-btn-yt');
    var heartBtn = div.querySelector('.sp-heart');

    songRows[song.file] = { div:div, btn:btn };

    heartBtn.addEventListener('click', function(e){ e.stopPropagation(); toggleFavorite(song.file, heartBtn); });
    applyHeartState(song.file, heartBtn);
    ytb.addEventListener('click', function(e){ e.stopPropagation(); var u=song.yt; if(u&&(u.startsWith('https://')||u.startsWith('http://')))window.open(u,'_blank','noopener,noreferrer'); });

    function toggle(e){
      if(e) e.stopPropagation();
      if(_currentSong === song){
        // Toggle play/pause sur la même piste
        if(_gAudio.paused){ _isPlaying = true; var p=_gAudio.play(); if(p&&p.catch)p.catch(function(){}); _updateRowUI(song,true); particleActive=true; showDance(); if(window.mpUpdate)mpUpdate(); if(window._yamMediaSession)_yamMediaSession(song); }
        else { _pauseCurrent(); }
      } else {
        _playSong(song);
      }
    }
    btn.addEventListener('click', toggle);
    div.addEventListener('click', toggle);

    // Remettre le visuel si c'est la piste en cours (ex: après re-render)
    if(_currentSong === song && !_gAudio.paused){
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
      btn.classList.add('active');
      div.classList.add('playing');
    }

    container.appendChild(div);
  });

  prevRanks = newRanks;
  try { localStorage.setItem('sp_prev_ranks', JSON.stringify(prevRanks)); } catch(e){}
  var eb = document.getElementById('top50Expand');
  eb.style.display = sorted.length <= TOP_VISIBLE ? 'none' : 'flex';
  var remaining = sorted.length - TOP_VISIBLE;
  eb.querySelector('span:first-child').textContent = top50Expanded ? 'Réduire' : 'Voir tout ('+remaining+' titres)';
  eb.classList.toggle('open', top50Expanded);
}

function updateTop50(){
  var container = document.getElementById('Love');
  if(!container || Object.keys(songRows).length === 0){ renderTop50(); return; }
  var sorted = songsLove.slice().sort(function(a,b){ return b.plays - a.plays; });
  var newRanks = {};
  sorted.forEach(function(s,i){ newRanks[s.file] = i+1; });

  _playlist = sorted.slice();

  sorted.forEach(function(song, i){
    var rank = i+1;
    var row = songRows[song.file];
    if(!row) return;
    var rankNum = row.div.querySelector('.sp-rank-num');
    if(rankNum) rankNum.textContent = rank;
    var trendClass = '';
    if(prevRanks[song.file] === undefined)  { trendClass = 'new'; }
    else if(prevRanks[song.file] > rank)    { trendClass = 'up'; }
    else if(prevRanks[song.file] < rank)    { trendClass = 'down'; }
    var existingTrend = row.div.querySelector('.sp-trend');
    if(trendClass){
      if(existingTrend){ existingTrend.className = 'sp-trend '+trendClass; }
      else {
        var t = document.createElement('span'); t.className = 'sp-trend '+trendClass;
        var rankEl = row.div.querySelector('.sp-rank');
        if(rankEl) rankEl.insertBefore(t, rankEl.querySelector('.sp-rank-wave'));
      }
    } else if(existingTrend){ existingTrend.remove(); }
    var pe = row.div.querySelector('.sp-plays');
    if(pe) pe.textContent = fmtPlays(song.plays);
    var hidden = rank > TOP_VISIBLE && !top50Expanded;
    row.div.classList.toggle('hidden-row', hidden);
    if(top50Expanded) row.div.classList.add('revealed');
    container.appendChild(row.div);
  });

  prevRanks = newRanks;
  try { localStorage.setItem('sp_prev_ranks', JSON.stringify(prevRanks)); } catch(e){}
}

document.getElementById('top50Expand').addEventListener('click', function(){
  top50Expanded = !top50Expanded;
  var rows = document.querySelectorAll('#Love .sp-song.hidden-row');
  if(top50Expanded){ rows.forEach(function(r,i){ setTimeout(function(){ r.classList.add('revealed'); }, i*35); }); }
  else { rows.forEach(function(r){ r.classList.remove('revealed'); }); }
  var remaining = songsLove.length - TOP_VISIBLE;
  this.querySelector('span:first-child').textContent = top50Expanded ? 'Réduire' : 'Voir tout ('+remaining+' titres)';
  this.classList.toggle('open', top50Expanded);
});

// ── PLAY MODE ──
var playMode = 'repeatAll';
var _modeList = ['repeatAll','order','shuffle','repeatOne'];
var _modeTitles = { order:"Dans l'ordre", shuffle:'Aléatoire', repeatAll:'Répéter tout', repeatOne:'Répéter ce titre' };
var _modeIconIds = { order:'modeIconOrder', shuffle:'modeIconShuffle', repeatAll:'modeIconRepeatAll', repeatOne:'modeIconRepeatOne' };

function setPlayMode(mode){
  playMode = mode;
  Object.keys(_modeIconIds).forEach(function(k){
    var el = document.getElementById(_modeIconIds[k]);
    if(el) el.style.display = k === mode ? '' : 'none';
  });
  var btn = document.getElementById('top50ModeBtn');
  if(btn){ btn.title = _modeTitles[mode] || mode; btn.classList.toggle('active', mode !== 'order'); }
}
setPlayMode('repeatAll');
document.getElementById('top50ModeBtn').addEventListener('click', function(){
  var idx = _modeList.indexOf(playMode);
  setPlayMode(_modeList[(idx + 1) % _modeList.length]);
});

document.getElementById('top50PlayAll').addEventListener('click', function(){
  if(_currentSong){
    if(_gAudio.paused){ var p=_gAudio.play(); if(p&&p.catch)p.catch(function(){}); _isPlaying=true; _updateRowUI(_currentSong,true); particleActive=true; showDance(); if(window.mpUpdate)mpUpdate(); }
    else { _pauseCurrent(); }
    return;
  }
  if(_playlist.length) _playSong(_playlist[0]);
});

function updateTop50PlayBtn(){
  var btn = document.getElementById('top50PlayAll');
  if(!btn) return;
  var isPlaying = _currentSong && !_gAudio.paused;
  var iconPlay  = document.getElementById('top50IconPlay');
  var iconPause = document.getElementById('top50IconPause');
  if(isPlaying){ btn.classList.add('playing'); if(iconPlay) iconPlay.style.display='none'; if(iconPause) iconPause.style.display=''; }
  else         { btn.classList.remove('playing'); if(iconPlay) iconPlay.style.display=''; if(iconPause) iconPause.style.display='none'; }
}
window._top50Iv = setInterval(updateTop50PlayBtn, 500);

// ── CHARGEMENT INITIAL ──
(function(){
  sb2Fetch('song_plays', 'select=song_file,plays').then(function(rows){
    if(!Array.isArray(rows)){ renderTop50(); return; }
    var map = {};
    rows.forEach(function(r){ map[r.song_file] = r.plays || 0; });
    songsLove.forEach(function(s){ s.plays = map[s.file] || 0; });
    renderTop50();
  }).catch(function(){ renderTop50(); });

  function refreshPlays(){
    sb2Fetch('song_plays', 'select=song_file,plays').then(function(rows){
      if(!Array.isArray(rows)) return;
      var changed = false, map = {};
      rows.forEach(function(r){ map[r.song_file] = r.plays || 0; });
      songsLove.forEach(function(s){ var remote = map[s.file]||0; if(remote>s.plays){ s.plays=remote; changed=true; } });
      if(changed) updateTop50();
    }).catch(function(){});
  }
  window._playsRTActive = false;
  window.refreshPlays = refreshPlays;
  window._playsIv = setInterval(refreshPlays, 30000);

  // Enregistrement dans le registre global yamClearAllPolls
  window._yamStopPlaysIv = function(){
    if(window._playsIv){ clearInterval(window._playsIv); window._playsIv = null; }
    if(window._top50Iv){ clearInterval(window._top50Iv); window._top50Iv = null; }
    if(window._mpPollIv){ clearInterval(window._mpPollIv); window._mpPollIv = null; }
  };
})();

// ── PARTICLES (déclaré pour compatibilité) ──
var particleActive = false;

// ════════════════════════════════════════════════════════════
// MINI PLAYER
// ════════════════════════════════════════════════════════════
(function(){
  var mp        = document.getElementById('miniPlayer');
  var mpTitle   = document.getElementById('mpTitle');
  var mpArtist  = document.getElementById('mpArtist');
  var mpIconPlay  = document.getElementById('mpIconPlay');
  var mpIconPause = document.getElementById('mpIconPause');
  var mpModeBtn   = document.getElementById('mpModeBtn');

  var _gameViews = ['memoryView','penduView','puzzleView','snakeView','skyjoView','gamesView','quizView'];
  function isGameActive(){
    return _gameViews.some(function(id){ var el=document.getElementById(id); return el&&el.classList.contains('active'); });
  }

  function mpShow(){
    if(isGameActive()){ mp.classList.add('game-hidden'); mp.classList.remove('visible'); document.body.classList.remove('mp-active'); return; }
    mp.classList.remove('game-hidden');
    if(window._currentTab && window._currentTab !== 'musique'){
      mp.classList.add('tab-hidden'); mp.classList.remove('visible'); document.body.classList.remove('mp-active'); return;
    }
    mp.classList.remove('tab-hidden'); mp.classList.add('visible'); document.body.classList.add('mp-active');
  }
  function mpHide(){
    mp.classList.remove('visible','tab-hidden'); document.body.classList.remove('mp-active');
  }

  window.mpUpdate = function(){
    if(!_currentSong){ mpUpdateIcons(); var navMus=document.getElementById('navMusique'); if(navMus)navMus.classList.remove('music-playing'); return; }
    mpTitle.textContent  = _currentSong.title;
    mpArtist.textContent = _currentSong.artist;
    mpUpdateIcons();
    mpShow();
    var navMus2 = document.getElementById('navMusique');
    if(navMus2){ navMus2.classList.toggle('music-playing', !_gAudio.paused && window._currentTab !== 'musique'); }
  };

  function mpUpdateIcons(){
    var playing = _currentSong && !_gAudio.paused;
    mpIconPlay.style.display  = playing ? 'none' : '';
    mpIconPause.style.display = playing ? '' : 'none';
  }

  // ── Seekbar ──
  var mpSeek      = document.getElementById('mpSeek');
  var mpSeekFill  = document.getElementById('mpSeekFill');
  var mpSeekThumb = document.getElementById('mpSeekThumb');
  var mpTime      = document.getElementById('mpTime');

  function fmtTime(s){ if(isNaN(s)||!isFinite(s)) return '—'; var m=Math.floor(s/60),sec=Math.floor(s%60); return m+':'+(sec<10?'0':'')+sec; }

  window.mpUpdateProgress = function(){
    var cur = _gAudio.currentTime || 0;
    var dur = _gAudio.duration;
    var pct = (dur && isFinite(dur)) ? (cur / dur * 100) : 0;
    mpSeekFill.style.width = pct + '%';
    mpSeekThumb.style.right = 'auto';
    mpSeekThumb.style.left  = 'calc('+pct+'% - 5px)';
    mpTime.textContent = fmtTime(cur) + ' / ' + ((dur&&isFinite(dur))?fmtTime(dur):'—');
  };
  var mpUpdateProgress = window.mpUpdateProgress;

  function seekTo(e){
    if(!_gAudio.duration) return;
    var rect = mpSeek.getBoundingClientRect();
    var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    var pct = Math.max(0, Math.min(1, x / rect.width));
    _gAudio.currentTime = pct * _gAudio.duration;
    mpUpdateProgress();
  }
  var _seeking = false;
  mpSeek.addEventListener('mousedown',  function(e){ _seeking=true; mpSeek.classList.add('dragging'); seekTo(e); });
  mpSeek.addEventListener('touchstart', function(e){ _seeking=true; mpSeek.classList.add('dragging'); seekTo(e); }, {passive:true});
  document.addEventListener('mousemove', function(e){ if(_seeking) seekTo(e); });
  document.addEventListener('touchmove', function(e){ if(_seeking) seekTo(e); }, {passive:true});
  document.addEventListener('mouseup',   function(){ if(_seeking){ _seeking=false; mpSeek.classList.remove('dragging'); } });
  document.addEventListener('touchend',  function(){ if(_seeking){ _seeking=false; mpSeek.classList.remove('dragging'); } });

  window.mpUpdateMode = function(){
    var mode = typeof playMode !== 'undefined' ? playMode : 'repeatAll';
    var mpIconIds = { order:'mpModeIconOrder', shuffle:'mpModeIconShuffle', repeatAll:'mpModeIconRepeatAll', repeatOne:'mpModeIconRepeatOne' };
    var titles    = { order:"Dans l'ordre", shuffle:'Aléatoire', repeatAll:'Répéter tout', repeatOne:'Répéter ce titre' };
    Object.keys(mpIconIds).forEach(function(k){ var el=document.getElementById(mpIconIds[k]); if(el) el.style.display = k===mode?'':'none'; });
    mpModeBtn.classList.toggle('active', mode !== 'order');
    mpModeBtn.title = titles[mode] || mode;
  };

  // ── Actions mini player ──
  window.mpToggle = function(){
    if(!_currentSong) return;
    if(_gAudio.paused){
      var p = _gAudio.play(); if(p&&p.catch) p.catch(function(){});
      _isPlaying = true;
      _updateRowUI(_currentSong, true);
      particleActive = (window._currentTab === 'musique' || window._currentTab === 'nous');
      showDance();
    } else {
      _pauseCurrent();
    }
    mpUpdateIcons();
    var navMus = document.getElementById('navMusique');
    if(navMus) navMus.classList.toggle('music-playing', !_gAudio.paused && window._currentTab !== 'musique');
  };

  window.mpStop = function(){
    if('mediaSession' in navigator){ navigator.mediaSession.playbackState = 'none'; navigator.mediaSession.metadata = null; }
    _stopCurrent();
    mpHide();
    var navMus = document.getElementById('navMusique');
    if(navMus) navMus.classList.remove('music-playing');
  };

  window.mpNext = function(){
    var next = _getNextSong();
    if(next) _playSong(next);
  };

  window.mpPrev = function(){
    var prev = _getPrevSong();
    if(prev) _playSong(prev);
  };

  window.mpCycleMode = function(){
    var idx = _modeList ? _modeList.indexOf(playMode) : 0;
    setPlayMode(_modeList[(idx+1) % _modeList.length]);
    mpUpdateMode();
  };

  window.mpCheckGameState = function(){
    if(_currentSong && !_gAudio.paused){
      if(isGameActive()){ mp.classList.add('game-hidden'); mp.classList.remove('visible'); }
      else {
        mp.classList.remove('game-hidden');
        if(window._currentTab && window._currentTab !== 'musique'){ mp.classList.add('tab-hidden'); mp.classList.remove('visible'); }
        else { mp.classList.remove('tab-hidden'); mp.classList.add('visible'); }
      }
    }
  };

  window._mpPollIv = setInterval(function(){
    if(_currentSong && !_gAudio.paused){ mpUpdate(); mpUpdateProgress(); }
    mpUpdateMode();
    mpCheckGameState();
  }, 250);
})();

// Patch openGames / closeGames
(function(){
  var patchOpen  = ['openGames','openMemoryGame','openPenduGame','openPuzzleGame','openSnakeGame','openSkyjoLock','openQuiz'];
  var patchClose = ['closeGames','closeMemoryGame','closePenduGame','closePuzzleGame','closeSnakeGame','closeSkyjoGame','closeQuiz'];
  patchOpen.forEach(function(fn){ var orig=window[fn]; if(orig) window[fn]=function(){ orig.apply(this,arguments); if(window.mpCheckGameState) mpCheckGameState(); }; });
  patchClose.forEach(function(fn){ var orig=window[fn]; if(orig) window[fn]=function(){ orig.apply(this,arguments); setTimeout(function(){ if(window.mpCheckGameState) mpCheckGameState(); if(window.mpUpdate) mpUpdate(); },300); }; });
})();


// ════════════════════════════════════════════════════════════
// SUGGESTIONS
// ════════════════════════════════════════════════════════════
(function(){
  var _SG_HASH = 'a586ffe3acf28484d17760d1ddaa2af699666c870aaaa66f8cfc826a528429ce';
  var sgUnlocked = false;
  var _sgAuthCb = null;

  function escSg(str){ return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

  function openSgAuth(cb){
    _sgAuthCb = cb;
    document.getElementById('sgAuthModal').classList.add('open');
    document.getElementById('sgAuthInput').value = '';
    document.getElementById('sgAuthErr').style.display = 'none';
    setTimeout(function(){ document.getElementById('sgAuthInput').focus(); }, 80);
  }
  window.closeSgAuth = function(){ document.getElementById('sgAuthModal').classList.remove('open'); };

  var _sgFailCount=0, _sgBlocked=false;
  window.sgCheckAuth = async function(){
    if(_sgBlocked) return;
    var val = document.getElementById('sgAuthInput').value.trim().toUpperCase();
    var h = await _sha256(val);
    if(h === _SG_HASH){
      _sgFailCount=0; window.closeSgAuth(); if(_sgAuthCb){ _sgAuthCb(); _sgAuthCb=null; }
    } else {
      _sgFailCount++;
      document.getElementById('sgAuthInput').value = '';
      document.getElementById('sgAuthInput').focus();
      var errEl = document.getElementById('sgAuthErr');
      if(_sgFailCount >= 5){
        _sgBlocked = true;
        errEl.style.display='block'; errEl.textContent='⛔ Trop de tentatives — attends 30s';
        document.getElementById('sgAuthInput').disabled = true;
        setTimeout(function(){ _sgBlocked=false; _sgFailCount=0; document.getElementById('sgAuthInput').disabled=false; errEl.style.display='none'; }, 30000);
      } else {
        errEl.style.display='block'; errEl.textContent='❌ Code incorrect, réessaie ! ('+_sgFailCount+'/5)';
      }
    }
  };
  document.getElementById('sgAuthInput').addEventListener('keydown', function(e){ if(e.key==='Enter') window.sgCheckAuth(); });
  document.getElementById('sgAuthModal').addEventListener('click', function(e){ if(e.target===this) window.closeSgAuth(); });

  window.sgToggleLock = function(){
    if(sgUnlocked){ sgLock(); return; }
    if(yamLoadSession()){ sgUnlock(); return; }
    openSgAuth(sgUnlock);
  };

  function sgUnlock(){
    sgUnlocked = true;
    document.getElementById('sgLockBadge').classList.add('unlocked');
    document.getElementById('sgLockTxt').textContent = '🔒 Verrouiller';
    document.getElementById('sgAddBtn').style.display = 'flex';
    renderSuggestions();
  }
  function sgLock(){
    sgUnlocked = false;
    document.getElementById('sgLockBadge').classList.remove('unlocked');
    document.getElementById('sgLockTxt').textContent = 'Proposer une musique 🎵';
    document.getElementById('sgAddBtn').style.display = 'none';
    renderSuggestions();
  }

  window.openSgModal = function(){
    ['sgTitleInput','sgArtistInput','sgNoteInput'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
    var em=document.getElementById('sgErrMsg'); if(em){ em.style.display='none'; em.textContent=''; }
    document.getElementById('sgModal').classList.add('open');
    setTimeout(function(){ var t=document.getElementById('sgTitleInput'); if(t) t.focus(); }, 80);
  };
  window.closeSgModal = function(){ document.getElementById('sgModal').classList.remove('open'); };
  document.getElementById('sgModal').addEventListener('click', function(e){ if(e.target===this) window.closeSgModal(); });

  window.sgSave = function(){
    var title=(document.getElementById('sgTitleInput').value||'').trim();
    var artist=(document.getElementById('sgArtistInput').value||'').trim();
    var note=(document.getElementById('sgNoteInput').value||'').trim();
    if(!title||!artist){
      if(!title) document.getElementById('sgTitleInput').style.borderColor='#e05555';
      if(!artist) document.getElementById('sgArtistInput').style.borderColor='#e05555';
      return;
    }
    var btn=document.querySelector('.sg-modal-save'); btn.textContent='⏳'; btn.disabled=true;
    var _sg2 = yamGetUser ? {user: yamGetUser()} : null;
    var _sg2Id=_sg2&&_sg2.user?_sg2.user.couple_id:null;
    if(!_sg2Id){ btn.textContent='Proposer 💚'; btn.disabled=false; return; }
    var payload={couple_id:_sg2Id,title:title,artist:artist,suggested_by_role:getProfile()||null};
    if(note) payload.note=note;
    var url=SB_URL+'/rest/v1/suggestion_songs';
    fetch(url,{ method:'POST', headers:sb2Headers({'Prefer':'return=representation'}), body:JSON.stringify(payload) })
    .then(function(r){ return r.text().then(function(txt){ return {ok:r.ok,status:r.status,body:txt}; }); })
    .then(function(res){
      btn.textContent='Proposer 💚'; btn.disabled=false;
      if(res.ok){ window.closeSgModal(); renderSuggestions(); }
      else {
        if(res.body&&res.body.indexOf('gender')!==-1){
          var p2={couple_id:_sg2Id,title:title,artist:artist,suggested_by_role:getProfile()||null}; if(note) p2.note=note;
          fetch(url,{method:'POST',headers:sb2Headers({'Prefer':'return=representation'}),body:JSON.stringify(p2)})
          .then(function(r2){ return r2.text(); }).then(function(){ window.closeSgModal(); renderSuggestions(); }).catch(function(){ window.closeSgModal(); });
        } else {
          var errMsg=document.getElementById('sgErrMsg');
          if(errMsg){ errMsg.textContent='❌ Erreur : '+res.status+' — '+res.body.substring(0,120); errMsg.style.display='block'; }
        }
      }
    }).catch(function(err){ btn.textContent='Proposer 💚'; btn.disabled=false; var errMsg=document.getElementById('sgErrMsg'); if(errMsg){ errMsg.textContent='❌ '+err.message; errMsg.style.display='block'; } });
  };
  ['sgTitleInput','sgArtistInput','sgNoteInput'].forEach(function(id){
    var el=document.getElementById(id);
    if(el){ el.addEventListener('keydown',function(e){ if(e.key==='Enter') window.sgSave(); }); el.addEventListener('focus',function(){ this.style.borderColor=''; }); }
  });

  var _sgTickerTimer=null, _sgTickerIdx=0;
  function _startTicker(total){
    if(_sgTickerTimer) clearInterval(_sgTickerTimer);
    if(total<=1) return;
    _sgTickerIdx=0;
    _sgTickerTimer=setInterval(function(){
      _sgTickerIdx=(_sgTickerIdx+1)%total;
      var ticker=document.querySelector('.mu-sugg-ticker');
      if(ticker) ticker.style.transform='translateY(-'+(_sgTickerIdx*66)+'px)';
    },4000);
  }

  function renderSuggestions(){
    var list=document.getElementById('sgList');
    list.innerHTML='<div class="sg-empty"><span class="spinner"></span></div>';
    if(_sgTickerTimer){ clearInterval(_sgTickerTimer); _sgTickerTimer=null; }
    var _rsg = yamGetUser ? {user: yamGetUser()} : null;
    var _rsgId=_rsg&&_rsg.user?_rsg.user.couple_id:null;
    if(!_rsgId){ list.innerHTML='<div class="sg-empty">Session expirée.</div>'; return; }
    sb2Fetch('suggestion_songs','couple_id=eq.'+_rsgId+'&order=created_at.asc').then(function(items){
      list.innerHTML='';
      if(!Array.isArray(items)||!items.length){
        var em=document.createElement('div'); em.className='sg-empty';
        em.textContent=sgUnlocked?'Aucune suggestion — propose-en une ! 🎵':'Aucune suggestion pour l\'instant. 🎵';
        list.appendChild(em); return;
      }
      items.forEach(function(item){
        var g=item.suggested_by_role||'';
        if(g!=='girl'&&g!=='boy') g='';
        var row=document.createElement('div'); row.className='sg-song';
        var noteHtml=item.note?'<div class="sg-note-pill">«\u00a0'+escSg(item.note)+'\u00a0»</div>':'';
        var avatarSrc=g?((window._yamRealAvatars&&window._yamRealAvatars[g])||'assets/images/profil_'+g+'.png'):'';
        var avatarContent=avatarSrc?'<img src="'+avatarSrc+'" alt="">':'🎵';
        var avatarClass='sg-avatar'+(g?' '+g:'');
        var iconClass='sg-icon'+(g?' '+g:'');
        row.innerHTML='<div class="'+iconClass+'">🎵</div><div class="sg-info"><div class="sg-title">'+escSg(item.title)+'</div><div class="sg-artist">'+escSg(item.artist)+'</div>'+noteHtml+'</div><div class="'+avatarClass+'">'+avatarContent+'</div>'+(sgUnlocked?'<button class="sg-edit" title="Modifier">✏️</button>':'')+(sgUnlocked?'<button class="sg-del" title="Supprimer">✕</button>':'');
        if(sgUnlocked){
          (function(id){ row.querySelector('.sg-del').addEventListener('click',function(e){ e.stopPropagation(); sb2Delete('suggestion_songs','id=eq.'+id).then(renderSuggestions); }); })(item.id);
          (function(it){ row.querySelector('.sg-edit').addEventListener('click',function(e){ e.stopPropagation(); openSgEditModal(it); }); })(item);
        }
        list.appendChild(row);
      });
      _startTicker(items.length);
    }).catch(function(){ list.innerHTML='<div class="sg-empty">❌ Erreur de connexion.</div>'; });
  }

  renderSuggestions();
  window.sgLoad = function(){ renderSuggestions(); loadFavorites(); };

  (function(){
    function patchSync(){
      if(typeof window._yamSyncAllAvatarsForRole!=='function'){ setTimeout(patchSync,300); return; }
      if(window._sgAvatarSyncPatched) return;
      window._sgAvatarSyncPatched=true;
      var orig=window._yamSyncAllAvatarsForRole;
      window._yamSyncAllAvatarsForRole=function(role,url){
        orig.apply(this,arguments);
        var avatars=document.querySelectorAll('#sgList .sg-avatar.'+role+' img');
        avatars.forEach(function(img){ img.src=url; });
      };
    }
    setTimeout(patchSync,200);
  })();

  var _sgEditId=null;
  function openSgEditModal(item){
    _sgEditId=item.id;
    var ti=document.getElementById('sgEditTitleInput'), ai=document.getElementById('sgEditArtistInput'), ni=document.getElementById('sgEditNoteInput');
    if(ti) ti.value=item.title||''; if(ai) ai.value=item.artist||''; if(ni) ni.value=item.note||'';
    var errMsg=document.getElementById('sgEditErrMsg'); if(errMsg) errMsg.style.display='none';
    document.getElementById('sgEditModal').classList.add('open');
    setTimeout(function(){ if(ti) ti.focus(); },80);
  }
  window.closeSgEditModal=function(){ document.getElementById('sgEditModal').classList.remove('open'); _sgEditId=null; };
  document.getElementById('sgEditModal').addEventListener('click',function(e){ if(e.target===this) window.closeSgEditModal(); });

  // ── Modal "Modifier les suggestions" ──
  window.openSgManageModal = function(){
    document.getElementById('sgManageModal').classList.add('open');
    renderSgManageList();
  };
  window.closeSgManageModal = function(){ document.getElementById('sgManageModal').classList.remove('open'); };
  document.getElementById('sgManageModal').addEventListener('click',function(e){ if(e.target===this) window.closeSgManageModal(); });

  function renderSgManageList(){
    var list=document.getElementById('sgManageList');
    list.innerHTML='<div class="sg-empty"><span class="spinner"></span></div>';
    var _rm = yamGetUser ? {user: yamGetUser()} : null;
    var _rmId=_rm&&_rm.user?_rm.user.couple_id:null;
    if(!_rmId){ list.innerHTML='<div class="sg-empty">Session expirée.</div>'; return; }
    sb2Fetch('suggestion_songs','couple_id=eq.'+_rmId+'&order=created_at.asc').then(function(items){
      list.innerHTML='';
      if(!Array.isArray(items)||!items.length){
        list.innerHTML='<div class="sg-empty">Aucune suggestion à modifier. 🎵</div>'; return;
      }
      items.forEach(function(item){
        var row=document.createElement('div'); row.className='sg-manage-row';
        var senderLabel=item.suggested_by_role==='girl'?'Elle':item.suggested_by_role==='boy'?'Lui':'';
        row.innerHTML=
          '<div class="sg-manage-info">'+
            '<div class="sg-manage-title">'+escSg(item.title)+'</div>'+
            '<div class="sg-manage-artist">'+escSg(item.artist)+(item.note?' · <em>'+escSg(item.note)+'</em>':'')+'</div>'+
          '</div>'+
          '<button class="sg-manage-edit-btn" title="Modifier" aria-label="Modifier">'+
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'+
          '</button>'+
          '<button class="sg-manage-del-btn" title="Supprimer" aria-label="Supprimer">'+
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>'+
          '</button>';
        (function(it){
          row.querySelector('.sg-manage-edit-btn').addEventListener('click',function(e){
            e.stopPropagation();
            window.closeSgManageModal();
            openSgEditModal(it);
          });
          row.querySelector('.sg-manage-del-btn').addEventListener('click',function(e){
            e.stopPropagation();
            sb2Delete('suggestion_songs','id=eq.'+it.id).then(function(){
              renderSgManageList();
              renderSuggestions();
            });
          });
        })(item);
        list.appendChild(row);
      });
    }).catch(function(){ list.innerHTML='<div class="sg-empty">❌ Erreur de connexion.</div>'; });
  }

  window.sgEditSave=function(){
    if(!_sgEditId) return;
    var title=(document.getElementById('sgEditTitleInput').value||'').trim();
    var artist=(document.getElementById('sgEditArtistInput').value||'').trim();
    var note=(document.getElementById('sgEditNoteInput').value||'').trim();
    if(!title||!artist){
      ['sgEditTitleInput','sgEditArtistInput'].forEach(function(id){ var el=document.getElementById(id); if(el&&!el.value.trim()) el.style.borderColor='#e05555'; });
      return;
    }
    var btn=document.querySelector('.sg-edit-save'); btn.textContent='⏳'; btn.disabled=true;
    var payload={title:title,artist:artist}; if(note) payload.note=note; else payload.note=null;
    var _se2 = yamGetUser ? {user: yamGetUser()} : null;
    var _se2Id=_se2&&_se2.user?_se2.user.couple_id:null;
    var _editFilter='id=eq.'+_sgEditId+(_se2Id?'&couple_id=eq.'+_se2Id:'');
    fetch(SB_URL+'/rest/v1/suggestion_songs?'+_editFilter,{ method:'PATCH', headers:sb2Headers({'Prefer':'return=representation'}), body:JSON.stringify(payload) })
    .then(function(r){ btn.textContent='Sauvegarder ✅'; btn.disabled=false; if(r.ok){ window.closeSgEditModal(); renderSuggestions(); } else { var errMsg=document.getElementById('sgEditErrMsg'); if(errMsg){ errMsg.textContent='❌ Erreur lors de la sauvegarde.'; errMsg.style.display='block'; } } })
    .catch(function(err){ btn.textContent='Sauvegarder ✅'; btn.disabled=false; var errMsg=document.getElementById('sgEditErrMsg'); if(errMsg){ errMsg.textContent='❌ '+err.message; errMsg.style.display='block'; } });
  };
  ['sgEditTitleInput','sgEditArtistInput','sgEditNoteInput'].forEach(function(id){
    var el=document.getElementById(id);
    if(el){ el.addEventListener('keydown',function(e){ if(e.key==='Enter') window.sgEditSave(); }); el.addEventListener('focus',function(){ this.style.borderColor=''; }); }
  });
})();

// ════════════════════════════════════════════════════════════
// FAVORIS (Coup de cœur)
// ════════════════════════════════════════════════════════════
var favoritesCache = {};

function loadFavorites(){
  var _sf = yamGetUser ? {user: yamGetUser()} : null;
  var _sfId=_sf&&_sf.user?_sf.user.couple_id:null;
  if(!_sfId) return Promise.resolve();
  return sb2Fetch('favorites','couple_id=eq.'+_sfId+'&select=role,song_file')
    .then(function(rows){ favoritesCache={}; if(!Array.isArray(rows)) return; rows.forEach(function(r){ favoritesCache[r.role]=r.song_file; }); refreshAllHearts(); })
    .catch(function(){});
}

function applyHeartState(file,btn){
  btn.className=btn.className.replace(/heart-girl|heart-boy/g,'').trim();
  if(favoritesCache['girl']===file) btn.classList.add('heart-girl');
  if(favoritesCache['boy'] ===file) btn.classList.add('heart-boy');
  btn.textContent=(favoritesCache['girl']===file||favoritesCache['boy']===file)?'♥':'♡';
}

function refreshAllHearts(){
  document.querySelectorAll('.btn-heart, .sp-heart').forEach(function(btn){ var file=btn.dataset.file; if(file) applyHeartState(file,btn); });
}

function toggleFavorite(file,btn){
  var profile=getProfile(); if(!profile) return;
  var _tf = yamGetUser ? {user: yamGetUser()} : null;
  var _tfId=_tf&&_tf.user?_tf.user.couple_id:null; if(!_tfId) return;
  var current=favoritesCache[profile];
  if(current===file){
    fetch(SB_URL+'/rest/v1/favorites?couple_id=eq.'+_tfId+'&role=eq.'+profile+'&song_file=eq.'+encodeURIComponent(file),{method:'DELETE',headers:sb2Headers()})
    .then(function(){ delete favoritesCache[profile]; refreshAllHearts(); });
  } else {
    var doAdd=function(){
      fetch(SB_URL+'/rest/v1/favorites',{method:'POST',headers:sb2Headers({'Prefer':'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify({couple_id:_tfId,role:profile,song_file:file,user_id:(yamGetUser?yamGetUser().id:null)})})
      .then(function(){ favoritesCache[profile]=file; refreshAllHearts(); });
    };
    if(current){
      fetch(SB_URL+'/rest/v1/favorites?couple_id=eq.'+_tfId+'&role=eq.'+profile+'&song_file=eq.'+encodeURIComponent(current),{method:'DELETE',headers:sb2Headers()}).then(doAdd);
    } else { doAdd(); }
  }
}

loadFavorites();

// ════════════════════════════════════════════════════════════
// NOW LISTENING — Glow sur la chanson
// ════════════════════════════════════════════════════════════
(function(){
  var NL_TABLE='now_listening';
  var _nlBoyFile=null, _nlGirlFile=null, _nlLastPushRemote='__none__';

  function basename(file){ if(!file) return null; return file.split('/').pop().split('?')[0]; }

  function updateNavSync(){
    var navMus=document.getElementById('navMusique'); if(!navMus) return;
    navMus.classList.toggle('music-sync', !!_nlBoyFile && !!_nlGirlFile);
  }

  var _nlWasTogetherLast=false;
  function applyGlow(){
    var myProfile=getProfile();
    var boyBase=basename(_nlBoyFile), girlBase=basename(_nlGirlFile);
    var sameSong=!!(boyBase&&girlBase&&boyBase===girlBase);
    if(sameSong&&!_nlWasTogetherLast){ if(typeof window.yamFlameActivity==='function') window.yamFlameActivity('music_together'); }
    _nlWasTogetherLast=sameSong;
    updateNavSync();
    var otherBase=null, otherWho=null;
    if(myProfile==='boy'){ otherBase=girlBase; otherWho='girl'; }
    else if(myProfile==='girl'){ otherBase=boyBase; otherWho='boy'; }
    document.querySelectorAll('.nl-other-playing').forEach(function(el){ el.classList.remove('nl-other-playing','nl-glow-boy','nl-glow-girl','nl-glow-together'); });
    var ind=document.getElementById('nlOtherIndicator'), dot=document.getElementById('nlOtherDot'), lbl=document.getElementById('nlOtherLabel');
    if(ind){
      if(!otherBase){ ind.style.display='none'; ind.className=''; }
      else {
        ind.style.display='flex'; ind.className=sameSong?'nl-ind-together':('nl-ind-'+otherWho);
        if(lbl){
          if(sameSong) lbl.textContent='On écoute ensemble';
          else if(otherWho==='girl') lbl.textContent=(typeof v2GetDisplayName==='function'?v2GetDisplayName('girl'):'Elle')+' écoute';
          else lbl.textContent=(typeof v2GetDisplayName==='function'?v2GetDisplayName('boy'):'Lui')+' écoute';
        }
      }
    }
    if(!otherBase) return;
    // Glow sur les lignes — utilise dataset.file au lieu de l'audio src
    document.querySelectorAll('#Love .sp-song').forEach(function(row){
      var file=row.dataset.file; if(!file) return;
      var rowBase=basename(file);
      if(!rowBase||rowBase!==otherBase) return;
      row.classList.add('nl-other-playing');
      row.classList.add(sameSong?'nl-glow-together':'nl-glow-'+otherWho);
    });
    if(sameSong&&myProfile){
      var myBase=myProfile==='boy'?boyBase:girlBase;
      document.querySelectorAll('#Love .sp-song').forEach(function(row){
        if(row.classList.contains('nl-glow-together')) return;
        var file=row.dataset.file; if(!file) return;
        if(basename(file)===myBase) row.classList.add('nl-other-playing','nl-glow-together');
      });
    }
  }

  function nlPoll(){
    var _nl = yamGetUser ? {user: yamGetUser()} : null;
    var _nlId=_nl&&_nl.user?_nl.user.couple_id:null; if(!_nlId) return;
    fetch(SB_URL+'/rest/v1/'+NL_TABLE+'?couple_id=eq.'+_nlId+'&select=sender_role,song_file&order=updated_at.desc',{headers:sb2Headers()})
    .then(function(r){ return r.ok?r.json():null; })
    .then(function(rows){
      if(!Array.isArray(rows)) return;
      var newBoy=null,newGirl=null;
      rows.forEach(function(r){ if(r.sender_role==='boy') newBoy=r.song_file||null; if(r.sender_role==='girl') newGirl=r.song_file||null; });
      _nlBoyFile=newBoy; _nlGirlFile=newGirl; applyGlow();
    }).catch(function(){});
  }

  function nlPush(file){
    var profile=getProfile(); if(!profile) return;
    var normalized=basename(file);
    if(profile==='boy') _nlBoyFile=normalized; if(profile==='girl') _nlGirlFile=normalized;
    applyGlow();
    if(_nlLastPushRemote===(normalized||'null')) return;
    _nlLastPushRemote=normalized||'null';
    var _np = yamGetUser ? {user: yamGetUser()} : null;
    var _npId=_np&&_np.user?_np.user.couple_id:null; if(!_npId) return;
    fetch(SB_URL+'/rest/v1/'+NL_TABLE,{method:'POST',headers:sb2Headers({'Prefer':'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify({couple_id:_npId,sender_role:profile,song_file:normalized,user_id:(yamGetUser?yamGetUser().id:null)})}).catch(function(){});
  }

  window.nlPoll=nlPoll; window._nlRTActive=false; nlPoll(); window._nlIv=setInterval(nlPoll,5000);

  // Hook sur _gAudio directement — plus d'events DOM parasites
  _gAudio.addEventListener('play', function(){
    if(_currentSong) nlPush(_currentSong.file);
  });
  _gAudio.addEventListener('pause', function(){
    setTimeout(function(){ if(_gAudio.paused){ _nlLastPushRemote='__none__'; nlPush(null); } },200);
  });
  _gAudio.addEventListener('ended', function(){
    setTimeout(function(){ if(_gAudio.paused){ _nlLastPushRemote='__none__'; nlPush(null); } },300);
  });

  var _origMpUpdate=window.mpUpdate;
  window.mpUpdate=function(){
    if(_origMpUpdate) _origMpUpdate.apply(this,arguments);
    if(_currentSong&&!_gAudio.paused) nlPush(_currentSong.file); else nlPush(null);
  };
  var _origMpStop=window.mpStop;
  window.mpStop=function(){ if(_origMpStop) _origMpStop.apply(this,arguments); nlPush(null); };

  window.addEventListener('beforeunload',function(){
    var profile=getProfile(); if(!profile) return;
    var _bu = yamGetUser ? {user: yamGetUser()} : null;
    var _buId=_bu&&_bu.user?_bu.user.couple_id:null; if(!_buId) return;
    fetch(SB_URL+'/rest/v1/'+NL_TABLE,{method:'POST',headers:sb2Headers({'Prefer':'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify({couple_id:_buId,sender_role:profile,song_file:null,user_id:(yamGetUser?yamGetUser().id:null)}),keepalive:true}).catch(function(){});
  });
  window._nlPush=nlPush;
})();

// ════════════════════════════════════════════════════════════
// RECHERCHE
// ════════════════════════════════════════════════════════════
function openSearch(){
  if(typeof isQuizOpen!=='undefined'&&isQuizOpen) return;
  if(typeof resetZoom==='function') resetZoom();
  var o=document.getElementById('searchOverlay'); if(!o) return;
  o.classList.add('open');
  document.getElementById('searchInput').value='';
  document.getElementById('searchResults').innerHTML='';
  setTimeout(function(){ document.getElementById('searchInput').focus(); },80);
}
function closeSearch(){
  if(typeof resetZoom==='function') resetZoom();
  var o=document.getElementById('searchOverlay'); if(o) o.classList.remove('open');
}
function filterSongs(q){
  var res=document.getElementById('searchResults'); if(!res) return;
  res.innerHTML=''; if(!q.trim()) return;
  var f=allSongs.filter(function(s){ return s.title.toLowerCase().includes(q.toLowerCase())||s.artist.toLowerCase().includes(q.toLowerCase()); });
  if(!f.length){ res.innerHTML='<p style="color:var(--muted);text-align:center;padding:20px;font-size:13px">Aucun résultat</p>'; return; }
  f.forEach(function(s){
    var row=document.createElement('div');
    row.className='sp-song';
    row.style.cssText='display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;cursor:pointer;';
    row.innerHTML='<div class="sp-info"><div class="sp-title">'+escHtml(s.title)+'</div><div class="sp-artist">'+escHtml(s.artist)+'</div></div><div style="font-size:11px;color:var(--green);font-weight:600;flex-shrink:0">▶</div>';
    row.addEventListener('click',function(){
      closeSearch();
      var realRow=songRows[s.file];
      if(realRow){
        realRow.div.scrollIntoView({behavior:'smooth',block:'center'});
        setTimeout(function(){ _playSong(s); },400);
      } else {
        _playSong(s);
      }
    });
    res.appendChild(row);
  });
}

// ════════════════════════════════════════════════════════════
// MEDIA SESSION API — Écran verrouillé iOS / AirPods
// Architecture : un seul <audio> global → aucun silence → iOS ne suspend pas
// ════════════════════════════════════════════════════════════
(function(){
  if(!('mediaSession' in navigator)) return;

  // ── Logger ──
  var _LOG_KEY='yam_ms_log', _LOG_MAX=80;
  function _log(msg){
    try {
      var now=new Date();
      var ts=now.getHours()+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0')+'.'+String(now.getMilliseconds()).padStart(3,'0');
      var lines=JSON.parse(localStorage.getItem(_LOG_KEY)||'[]');
      lines.push('['+ts+'] '+msg);
      if(lines.length>_LOG_MAX) lines=lines.slice(-_LOG_MAX);
      localStorage.setItem(_LOG_KEY,JSON.stringify(lines));
    } catch(e){}
  }
  window.yamMsLogs=function(){ try{ return JSON.parse(localStorage.getItem(_LOG_KEY)||'[]').join('\n'); }catch(e){ return '(vide)'; } };
  window.yamMsClear=function(){ localStorage.removeItem(_LOG_KEY); };
  window.yamMsClear();
  _log('INIT — mediaSession supporté, audio global');

  // ── Position state ──
  var _msIv=null;
  function _stopTick(){ if(_msIv){ clearInterval(_msIv); _msIv=null; } }
  function _updatePos(){
    if(!_gAudio.duration||!isFinite(_gAudio.duration)||_gAudio.duration<=0) return;
    var pos=Math.min(_gAudio.currentTime||0, _gAudio.duration);
    try { navigator.mediaSession.setPositionState({ duration:_gAudio.duration, playbackRate:1, position:pos }); } catch(e){}
  }
  function _startTick(){
    _stopTick();
    _msIv=setInterval(function(){ if(_gAudio.paused){ _stopTick(); return; } _updatePos(); },1000);
  }

  // ── Handlers — enregistrés une seule fois ──
  navigator.mediaSession.setActionHandler('play', function(){
    _log('handler PLAY');
    if(window.mpToggle) window.mpToggle();
  });
  navigator.mediaSession.setActionHandler('pause', function(){
    _log('handler PAUSE');
    if(window.mpToggle) window.mpToggle();
  });

  var _lastChange=0, _COOLDOWN=600;
  navigator.mediaSession.setActionHandler('nexttrack', function(){
    var now=Date.now();
    if(now-_lastChange<_COOLDOWN){ _log('NEXT spam ignoré'); return; }
    _lastChange=now; _log('handler NEXT');
    if(window.mpNext) window.mpNext();
  });
  navigator.mediaSession.setActionHandler('previoustrack', function(){
    var now=Date.now();
    if(now-_lastChange<_COOLDOWN){ _log('PREV spam ignoré'); return; }
    _lastChange=now; _log('handler PREV');
    if(window.mpPrev) window.mpPrev();
  });
  navigator.mediaSession.setActionHandler('seekto', function(details){
    if(!_gAudio.duration || !isFinite(_gAudio.duration)) return;
    if(details.seekTime !== undefined){
      _gAudio.currentTime = Math.max(0, Math.min(details.seekTime, _gAudio.duration));
      _updatePos();
    }
  });

  // ── Mise à jour des métadonnées à chaque nouvelle piste ──
  window._yamMediaSession=function(song){
    _log('track: '+(song?song.title:'null'));
    try {
      navigator.mediaSession.metadata=new MediaMetadata({
        title:  song?song.title:'',
        artist: song?song.artist:'',
        album:  'YAM — You And Me'
      });
    } catch(e){ _log('metadata err: '+e.message); }
    navigator.mediaSession.playbackState='playing';
    _stopTick();
    if(_gAudio.duration&&isFinite(_gAudio.duration)&&_gAudio.duration>0){
      _updatePos(); _startTick();
    } else {
      _gAudio.addEventListener('loadedmetadata', function _onMeta(){
        _gAudio.removeEventListener('loadedmetadata',_onMeta);
        _log('loadedmetadata dur='+_gAudio.duration);
        _updatePos(); _startTick();
      });
    }
  };

  // ── Sync playbackState sur l'audio global uniquement ──
  _gAudio.addEventListener('play',  function(){
    navigator.mediaSession.playbackState='playing';
    _log('gAudio PLAY');
    // FIX BUG 3 : relancer le tick à chaque play (même simple resume après pause)
    // pour que iOS ait toujours un setPositionState valide
    if(_gAudio.duration && isFinite(_gAudio.duration) && _gAudio.duration > 0){
      _updatePos(); _startTick();
    }
  });
  _gAudio.addEventListener('pause', function(){ navigator.mediaSession.playbackState='paused';   _log('gAudio PAUSE'); _stopTick(); });
  _gAudio.addEventListener('ended', function(){ _stopTick(); _log('gAudio ENDED'); });

  _log('INIT terminé');
})();
