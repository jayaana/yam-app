// ═══════════════════════════════════════════════════════════
// app-music.js — Top 50 · Player · Mini Player · Suggestions · Favoris · Glow

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

function fmtPlays(n){if(n>=1e6)return(n/1e6).toFixed(1).replace('.0','')+'M';if(n>=1e3)return(n/1e3).toFixed(1).replace('.0','')+'k';return n?String(n):'—';}

function savePlays(file){
  fetch(SB2_URL + '/rest/v1/rpc/increment_play', {
    method: 'POST',
    headers: sb2Headers({'Prefer': 'return=representation'}),
    body: JSON.stringify({ p_song_key: file })
  })
  .then(function(r){ return r.json(); })
  .then(function(result){
    // Supabase RPC peut retourner : un number, { increment_play: N }, ou [N]
    var newCount;
    if(typeof result === 'number'){
      newCount = result;
    } else if(Array.isArray(result)){
      newCount = parseInt(result[0], 10);
    } else if(result && typeof result === 'object'){
      newCount = parseInt(result.increment_play || result.play_count || result, 10);
    }
    if(!isNaN(newCount) && newCount > 0){
      var s = songsLove.find(function(x){ return x.file === file; });
      if(s) s.plays = newCount;
      var row = songRows[file];
      if(row){
        var pe = row.div.querySelector('.sp-plays');
        if(pe) pe.textContent = fmtPlays(newCount);
      }
    }
  })
  .catch(function(err){ console.error('savePlays error:', err); });
}

var allSongs = songsLove;
var currentAudio = null, currentBtn = null, currentRow = null;
var TOP_VISIBLE = 10, top50Expanded = false;

function stopCurrent(){
  if(currentAudio){currentAudio.pause();if(currentBtn){currentBtn.innerHTML='&#9654;';currentBtn.classList.remove('active');}if(currentRow)currentRow.classList.remove('playing');particleActive=false;hideDance();currentAudio=null;currentBtn=null;currentRow=null;}
}

function createSongEl(song, num) {
  var div = document.createElement('div'); div.className = 'song';
  var newBadge = song.isNew ? '<span class="badge-new">new</span>' : '';
  var safeTitle=escHtml(song.title),safeArtist=escHtml(song.artist),safeFile=escHtml(song.file);
  div.innerHTML = '<div class="song-num">'+num+'</div><div class="song-info"><div class="song-title">'+safeTitle+newBadge+'</div><div class="song-artist">'+safeArtist+'</div></div><div class="song-actions"><button class="btn-heart" data-file="'+safeFile+'">♡</button><button class="btn-play">&#9654;</button><button class="btn-yt">YT</button><audio src="'+safeFile+'"></audio></div>';
  var btn=div.querySelector('.btn-play'), audio=div.querySelector('audio');
  var heartBtn = div.querySelector('.btn-heart');
  heartBtn.addEventListener('click', function(e){ e.stopPropagation(); toggleFavorite(song.file, heartBtn); });
  applyHeartState(song.file, heartBtn);
  div.querySelector('.btn-yt').addEventListener('click',function(){var u=song.yt;if(u&&(u.startsWith('https://')||u.startsWith('http://')))window.open(u,'_blank','noopener,noreferrer');});
  function ps(){audio.pause();btn.innerHTML='&#9654;';btn.classList.remove('active');div.classList.remove('playing');particleActive=false;hideDance();if(window.mpUpdate) mpUpdate();}
  function pl(){audio.play();btn.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';btn.classList.add('active');div.classList.add('playing');particleActive=true;showDance();if(window.mpUpdate) mpUpdate();}
  btn.addEventListener('click',function(){if(currentAudio===audio){audio.paused?pl():ps();}else{stopCurrent();currentAudio=audio;currentBtn=btn;currentRow=div;pl();}});
  audio.addEventListener('ended',function(){ps();currentAudio=null;currentBtn=null;currentRow=null;});
  return div;
}

var prevRanks = (function(){
  try { return JSON.parse(localStorage.getItem('sp_prev_ranks') || '{}'); }
  catch(e){ return {}; }
})();

var songRows = {};

function renderTop50() {
  var sorted = songsLove.slice().sort(function(a,b){return b.plays-a.plays;});
  var newRanks = {};
  sorted.forEach(function(s,i){ newRanks[s.file] = i+1; });
  var container = document.getElementById('Love');
  container.innerHTML = '';
  songRows = {};
  document.getElementById('top50Count').textContent = sorted.length;

  sorted.forEach(function(song, i) {
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
      '<div class="sp-actions"><button class="sp-btn-play">&#9654;</button><button class="sp-btn-yt">YT</button>'+
      '<audio src="'+song.file+'"></audio></div>';

    var btn = div.querySelector('.sp-btn-play');
    var ytb = div.querySelector('.sp-btn-yt');
    var heartBtn = div.querySelector('.sp-heart');
    var audio = div.querySelector('audio');
    audio._counted = false;
    songRows[song.file] = { div:div, btn:btn, audio:audio };
    heartBtn.addEventListener('click', function(e){ e.stopPropagation(); toggleFavorite(song.file, heartBtn); });
    applyHeartState(song.file, heartBtn);

    ytb.addEventListener('click', function(e){ e.stopPropagation(); var u=song.yt;if(u&&(u.startsWith('https://')||u.startsWith('http://')))window.open(u,'_blank','noopener,noreferrer'); });
    function ps(){ audio.pause(); btn.innerHTML='&#9654;'; btn.classList.remove('active'); div.classList.remove('playing'); particleActive=false; hideDance(); if(window.mpUpdate) mpUpdate(); }
    function pl(){ audio.play(); btn.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'; btn.classList.add('active'); div.classList.add('playing'); particleActive=true; showDance(); if(window.mpUpdate) mpUpdate(); }
    function toggle(e){ if(e) e.stopPropagation(); if(currentAudio===audio){ audio.paused?pl():ps(); }else{ stopCurrent(); currentAudio=audio; currentBtn=btn; currentRow=div; pl(); } }
    btn.addEventListener('click', toggle);
    div.addEventListener('click', toggle);

    audio.addEventListener('timeupdate', function(){
      if(!audio._counted && audio.currentTime >= 10){
        audio._counted = true;
        savePlays(song.file);
      }
    });

    audio.addEventListener('ended', function(){
      audio._counted = false; ps(); currentAudio=null; currentBtn=null; currentRow=null;
      playNext(div);
    });

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

function updateTop50() {
  var container = document.getElementById('Love');
  if(!container || Object.keys(songRows).length === 0) { renderTop50(); return; }
  var sorted = songsLove.slice().sort(function(a,b){ return b.plays-a.plays; });
  var newRanks = {};
  sorted.forEach(function(s,i){ newRanks[s.file] = i+1; });

  sorted.forEach(function(song, i) {
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
    if(trendClass) {
      if(existingTrend) { existingTrend.className = 'sp-trend '+trendClass; }
      else {
        var t = document.createElement('span'); t.className = 'sp-trend '+trendClass;
        var rankEl = row.div.querySelector('.sp-rank');
        if(rankEl) rankEl.insertBefore(t, rankEl.querySelector('.sp-rank-wave'));
      }
    } else if(existingTrend) { existingTrend.remove(); }
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

document.getElementById('top50Expand').addEventListener('click',function(){
  top50Expanded=!top50Expanded;
  var rows=document.querySelectorAll('#Love .sp-song.hidden-row');
  if(top50Expanded){rows.forEach(function(r,i){setTimeout(function(){r.classList.add('revealed');},i*35);});}
  else{rows.forEach(function(r){r.classList.remove('revealed');});}
  var remaining=songsLove.length-TOP_VISIBLE;
  this.querySelector('span:first-child').textContent=top50Expanded?'Réduire':'Voir tout ('+remaining+' titres)';
  this.classList.toggle('open',top50Expanded);
});

// ── PLAY MODE ──
var playMode = 'repeatAll';
var _modeList = ['repeatAll','order','shuffle','repeatOne'];
var _modeTitles = {
  order:     "Dans l'ordre",
  shuffle:   'Aléatoire',
  repeatAll: 'Répéter tout',
  repeatOne: 'Répéter ce titre'
};
var _modeIconIds = {
  order:     'modeIconOrder',
  shuffle:   'modeIconShuffle',
  repeatAll: 'modeIconRepeatAll',
  repeatOne: 'modeIconRepeatOne'
};
function setPlayMode(mode) {
  playMode = mode;
  Object.keys(_modeIconIds).forEach(function(k){
    var el = document.getElementById(_modeIconIds[k]);
    if(el) el.style.display = k === mode ? '' : 'none';
  });
  var btn = document.getElementById('top50ModeBtn');
  if(btn){
    btn.title = _modeTitles[mode] || mode;
    btn.classList.toggle('active', mode !== 'order');

  }
}
setPlayMode('repeatAll');
document.getElementById('top50ModeBtn').addEventListener('click', function(){
  var idx = _modeList.indexOf(playMode);
  setPlayMode(_modeList[(idx + 1) % _modeList.length]);
});
function playNext(currentDiv) {
  var songs = Array.from(document.querySelectorAll('#Love .sp-song'));
  if(!songs.length) return;
  if(playMode === 'repeatOne') {
    var btn=currentDiv.querySelector('.sp-btn-play'); if(btn) setTimeout(function(){btn.click();},80); return;
  }
  if(playMode === 'shuffle') {
    var idx=Math.floor(Math.random()*songs.length); var btn=songs[idx].querySelector('.sp-btn-play'); if(btn) setTimeout(function(){btn.click();},80); return;
  }
  var idx=songs.indexOf(currentDiv), next=songs[idx+1];
  if(next){
    var btn=next.querySelector('.sp-btn-play'); if(btn) setTimeout(function(){btn.click();},80);
  } else if(playMode === 'repeatAll'){
    // Retourne au début
    var btn=songs[0].querySelector('.sp-btn-play'); if(btn) setTimeout(function(){btn.click();},80);
  }
}
document.getElementById('top50PlayAll').addEventListener('click', function(){
  if(currentRow) { var btn=currentRow.querySelector('.sp-btn-play'); if(btn){btn.click();return;} }
  var first=document.querySelector('#Love .sp-song');
  if(first) first.querySelector('.sp-btn-play').click();
});

function updateTop50PlayBtn(){
  var btn=document.getElementById('top50PlayAll');
  if(!btn) return;
  var isLovePlaying = currentAudio && !currentAudio.paused && currentRow && currentRow.closest && currentRow.closest('#Love');
  var iconPlay  = document.getElementById('top50IconPlay');
  var iconPause = document.getElementById('top50IconPause');
  if(isLovePlaying){
    btn.classList.add('playing');
    if(iconPlay)  iconPlay.style.display  = 'none';
    if(iconPause) iconPause.style.display = '';
  } else {
    btn.classList.remove('playing');
    if(iconPlay)  iconPlay.style.display  = '';
    if(iconPause) iconPause.style.display = 'none';
  }
}
// Poll léger pour capturer les changements d'état audio
window._top50Iv = setInterval(updateTop50PlayBtn, 500);

// ── CHARGEMENT INITIAL depuis Supabase ──
(function(){
  sbGet('song_plays', 'select=song_key,play_count').then(function(rows){
    if(!Array.isArray(rows)) { renderTop50(); return; }
    var map = {};
    rows.forEach(function(r){ map[r.song_key] = r.play_count || 0; });
    songsLove.forEach(function(s){ s.plays = map[s.file] || 0; });
    renderTop50();
  }).catch(function(){ renderTop50(); });

  function refreshPlays() {
    sbGet('song_plays', 'select=song_key,play_count').then(function(rows){
      if(!Array.isArray(rows)) return;
      var changed = false;
      var map = {};
      rows.forEach(function(r){ map[r.song_key] = r.play_count || 0; });
      songsLove.forEach(function(s){
        var remote = map[s.file] || 0;
        if(remote > s.plays) { s.plays = remote; changed = true; }
      });
      if(changed) updateTop50();
    }).catch(function(){});
  }
  setInterval(refreshPlays, 30000);
})();

// ── PARTICLES ──

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


// MINI PLAYER
// ════════════════════════════════════════════
(function(){
  var mp = document.getElementById('miniPlayer');
  var mpTitle = document.getElementById('mpTitle');
  var mpArtist = document.getElementById('mpArtist');
  var mpIconPlay = document.getElementById('mpIconPlay');
  var mpIconPause = document.getElementById('mpIconPause');
  var mpModeBtn = document.getElementById('mpModeBtn');

  // Track if we're in a game (to hide mini player)
  var _gameViews = ['memoryView','penduView','puzzleView','snakeView','skyjoView','gamesView','quizView'];

  function isGameActive(){
    return _gameViews.some(function(id){
      var el = document.getElementById(id);
      return el && el.classList.contains('active');
    });
  }

  function mpShow(){
    if(isGameActive()){ mp.classList.add('game-hidden'); mp.classList.remove('visible'); document.body.classList.remove('mp-active'); return; }
    mp.classList.remove('game-hidden');
    // Cacher hors onglet musique (si tab connu et différent de musique)
    if(window._currentTab && window._currentTab !== 'musique'){
      mp.classList.add('tab-hidden');
      mp.classList.remove('visible');
      document.body.classList.remove('mp-active');
      return;
    }
    mp.classList.remove('tab-hidden');
    mp.classList.add('visible');
    document.body.classList.add('mp-active');
  }
  function mpHide(){
    mp.classList.remove('visible');
    mp.classList.remove('tab-hidden');
    document.body.classList.remove('mp-active');
  }

  // Update mini player state from currentAudio
  window.mpUpdate = function(){
    if(!currentAudio || !currentRow){
      // If no current audio, check if paused (still has info)
      mpUpdateIcons();
      // Retire l'icône dansante si plus de musique
      var navMus = document.getElementById('navMusique');
      if(navMus) navMus.classList.remove('music-playing');
      return;
    }
    // Find song info (decode URL to handle special chars like é, ï, apostrophes)
    var decodedSrc = '';
    try { decodedSrc = decodeURIComponent(currentAudio.src || ''); } catch(e) { decodedSrc = currentAudio.src || ''; }
    var songData = songsLove.find(function(s){ return decodedSrc.indexOf(s.file) !== -1; });
    if(songData){
      mpTitle.textContent = songData.title;
      mpArtist.textContent = songData.artist;
    }
    mpUpdateIcons();
    mpShow();
    // Icône dansante : si musique joue et pas sur onglet musique
    var navMus2 = document.getElementById('navMusique');
    if(navMus2){
      var playing2 = currentAudio && !currentAudio.paused;
      navMus2.classList.toggle('music-playing', playing2 && window._currentTab !== 'musique');
    }
  };

  function mpUpdateIcons(){
    var playing = currentAudio && !currentAudio.paused;
    mpIconPlay.style.display = playing ? 'none' : '';
    mpIconPause.style.display = playing ? '' : 'none';
  }

  /* ── Seekbar ── */
  var mpSeek     = document.getElementById('mpSeek');
  var mpSeekFill = document.getElementById('mpSeekFill');
  var mpSeekThumb= document.getElementById('mpSeekThumb');
  var mpTime     = document.getElementById('mpTime');

  function fmtTime(s){
    if(isNaN(s) || !isFinite(s)) return '—';
    var m = Math.floor(s/60), sec = Math.floor(s%60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  window.mpUpdateProgress = function(){
    if(!currentAudio) return;
    var cur = currentAudio.currentTime || 0;
    var dur = currentAudio.duration;
    var pct = (dur && isFinite(dur)) ? (cur / dur * 100) : 0;
    mpSeekFill.style.width = pct + '%';
    mpSeekThumb.style.right = 'auto';
    mpSeekThumb.style.left  = 'calc(' + pct + '% - 5px)';
    var durStr = (dur && isFinite(dur)) ? fmtTime(dur) : '—';
    mpTime.textContent = fmtTime(cur) + ' / ' + durStr;
  };
  var mpUpdateProgress = window.mpUpdateProgress;

  // Seek on click / drag
  function seekTo(e){
    if(!currentAudio || !currentAudio.duration) return;
    var rect = mpSeek.getBoundingClientRect();
    var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    var pct = Math.max(0, Math.min(1, x / rect.width));
    currentAudio.currentTime = pct * currentAudio.duration;
    mpUpdateProgress();
  }
  var _seeking = false;
  mpSeek.addEventListener('mousedown',  function(e){ _seeking=true; mpSeek.classList.add('dragging'); seekTo(e); });
  mpSeek.addEventListener('touchstart', function(e){ _seeking=true; mpSeek.classList.add('dragging'); seekTo(e); }, {passive:true});
  document.addEventListener('mousemove', function(e){ if(_seeking) seekTo(e); });
  document.addEventListener('touchmove', function(e){ if(_seeking) seekTo(e.touches?e:e); }, {passive:true});
  document.addEventListener('mouseup',  function(){ if(_seeking){ _seeking=false; mpSeek.classList.remove('dragging'); } });
  document.addEventListener('touchend', function(){ if(_seeking){ _seeking=false; mpSeek.classList.remove('dragging'); } });

  window.mpUpdateMode = function(){
    var mode = typeof playMode !== 'undefined' ? playMode : 'repeatAll';
    var mpIconIds = {
      order:     'mpModeIconOrder',
      shuffle:   'mpModeIconShuffle',
      repeatAll: 'mpModeIconRepeatAll',
      repeatOne: 'mpModeIconRepeatOne'
    };
    var titles = {
      order:     "Dans l'ordre",
      shuffle:   'Aléatoire',
      repeatAll: 'Répéter tout',
      repeatOne: 'Répéter ce titre'
    };
    Object.keys(mpIconIds).forEach(function(k){
      var el = document.getElementById(mpIconIds[k]);
      if(el) el.style.display = k === mode ? '' : 'none';
    });
    mpModeBtn.classList.toggle('active', mode !== 'order');
    mpModeBtn.title = titles[mode] || mode;
  };

  // Actions
  window.mpToggle = function(){
    if(!currentAudio) return;
    if(currentAudio.paused){
      currentAudio.play();
      if(currentBtn){ currentBtn.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'; currentBtn.classList.add('active'); }
      if(currentRow){ currentRow.classList.add('playing'); }
      particleActive = (window._currentTab === 'musique' || window._currentTab === 'nous');
      showDance();
    } else {
      currentAudio.pause();
      if(currentBtn){ currentBtn.innerHTML='&#9654;'; currentBtn.classList.remove('active'); }
      if(currentRow){ currentRow.classList.remove('playing'); }
      particleActive=false; hideDance();
    }
    mpUpdateIcons();
    // Icône dansante
    var navMus = document.getElementById('navMusique');
    if(navMus){
      var playing = currentAudio && !currentAudio.paused;
      navMus.classList.toggle('music-playing', playing && window._currentTab !== 'musique');
    }
  };

  window.mpStop = function(){
    stopCurrent();
    mpHide();
    var navMus = document.getElementById('navMusique');
    if(navMus) navMus.classList.remove('music-playing');
  };

  window.mpNext = function(){
    if(!currentRow) return;
    var songs = Array.from(document.querySelectorAll('#Love .sp-song'));
    if(typeof playMode !== 'undefined' && playMode === 'repeatOne'){
      var btn = currentRow.querySelector('.sp-btn-play'); if(btn) btn.click();
    } else if(typeof playMode !== 'undefined' && playMode === 'shuffle'){
      var idx = Math.floor(Math.random()*songs.length);
      var btn = songs[idx] && songs[idx].querySelector('.sp-btn-play'); if(btn) btn.click();
    } else {
      var idx = songs.indexOf(currentRow);
      var next = songs[idx+1] || songs[0];
      if(next){ var btn = next.querySelector('.sp-btn-play'); if(btn) btn.click(); }
    }
  };

  window.mpPrev = function(){
    if(!currentRow) return;
    var songs = Array.from(document.querySelectorAll('#Love .sp-song'));
    var idx = songs.indexOf(currentRow);
    var prev = songs[idx-1] || songs[songs.length-1];
    if(prev){ var btn = prev.querySelector('.sp-btn-play'); if(btn) btn.click(); }
  };

  window.mpCycleMode = function(){
    var mode = typeof playMode !== 'undefined' ? playMode : 'order';
    var idx = _modeList ? _modeList.indexOf(mode) : 0; var next = _modeList ? _modeList[(idx+1)%_modeList.length] : 'order';
    setPlayMode(next);
    mpUpdateMode();
  };

  // Show/hide based on game state
  window.mpCheckGameState = function(){
    if(currentAudio && !currentAudio.paused){
      if(isGameActive()){
        mp.classList.add('game-hidden');
        mp.classList.remove('visible');
      } else {
        mp.classList.remove('game-hidden');
        // Respecter la restriction d'onglet
        if(window._currentTab && window._currentTab !== 'musique'){
          mp.classList.add('tab-hidden');
          mp.classList.remove('visible');
        } else {
          mp.classList.remove('tab-hidden');
          mp.classList.add('visible');
        }
      }
    }
  };

  // Poll for updates — remplacé par event-driven dans Perf v3
  window._mpPollIv = setInterval(function(){
    if(currentAudio && !currentAudio.paused) {
      mpUpdate();
      mpUpdateProgress();
    }
    mpUpdateMode();
    mpCheckGameState();
  }, 250);
})();


// Patch openGames / closeGames / open*Game / close*Game to call mpCheckGameState
(function(){
  var patchOpen = ['openGames','openMemoryGame','openPenduGame','openPuzzleGame','openSnakeGame','openSkyjoLock','openQuiz'];
  var patchClose = ['closeGames','closeMemoryGame','closePenduGame','closePuzzleGame','closeSnakeGame','closeSkyjoGame','closeQuiz'];
  patchOpen.forEach(function(fn){
    var orig = window[fn];
    if(orig) window[fn] = function(){ orig.apply(this,arguments); if(window.mpCheckGameState) mpCheckGameState(); };
  });
  patchClose.forEach(function(fn){
    var orig = window[fn];
    if(orig) window[fn] = function(){ orig.apply(this,arguments); setTimeout(function(){ if(window.mpCheckGameState) mpCheckGameState(); if(window.mpUpdate) mpUpdate(); }, 300); };
  });
})();


(function(){
  var _SG_HASH = 'a586ffe3acf28484d17760d1ddaa2af699666c870aaaa66f8cfc826a528429ce';
  var sgUnlocked = false;
  var _sgAuthCb = null;

  function escSg(str){ return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

  // Auth modal
  function openSgAuth(cb){
    _sgAuthCb = cb;
    document.getElementById('sgAuthModal').classList.add('open');
    document.getElementById('sgAuthInput').value = '';
    document.getElementById('sgAuthErr').style.display = 'none';
    setTimeout(function(){ document.getElementById('sgAuthInput').focus(); }, 80);
  }
  window.closeSgAuth = function(){
    document.getElementById('sgAuthModal').classList.remove('open');
  };
  var _sgFailCount=0, _sgBlocked=false;
  window.sgCheckAuth = async function(){
    if(_sgBlocked) return;
    var val = document.getElementById('sgAuthInput').value.trim().toUpperCase();
    var h = await _sha256(val);
    if(h === _SG_HASH){
      _sgFailCount=0;
      window.closeSgAuth();
      if(_sgAuthCb){ _sgAuthCb(); _sgAuthCb = null; }
    } else {
      _sgFailCount++;
      document.getElementById('sgAuthInput').value = '';
      document.getElementById('sgAuthInput').focus();
      var errEl = document.getElementById('sgAuthErr');
      if(_sgFailCount >= 5){
        _sgBlocked = true;
        errEl.style.display = 'block'; errEl.textContent = '⛔ Trop de tentatives — attends 30s';
        document.getElementById('sgAuthInput').disabled = true;
        setTimeout(function(){ _sgBlocked=false; _sgFailCount=0; document.getElementById('sgAuthInput').disabled=false; errEl.style.display='none'; }, 30000);
      } else {
        errEl.style.display = 'block'; errEl.textContent = '❌ Code incorrect, réessaie ! ('+_sgFailCount+'/5)';
      }
    }
  };
  document.getElementById('sgAuthInput').addEventListener('keydown', function(e){ if(e.key==='Enter') window.sgCheckAuth(); });
  document.getElementById('sgAuthModal').addEventListener('click', function(e){ if(e.target===this) window.closeSgAuth(); });

  // Toggle lock
  window.sgToggleLock = function(){
    if(sgUnlocked){ sgLock(); return; }
    // Si session V2 active, pas de code demandé
    if(v2LoadSession()){ sgUnlock(); return; }
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

  // Suggestion modal
  var sgGender = null;

  window.sgSelectGender = function(g){
    sgGender = g;
    var btnG = document.getElementById('sgBtnGirl');
    var btnB = document.getElementById('sgBtnBoy');
    if(btnG) btnG.className = 'sg-gender-btn' + (g === 'girl' ? ' selected-girl' : '');
    if(btnB) btnB.className = 'sg-gender-btn' + (g === 'boy'  ? ' selected-boy'  : '');
  };

  window.openSgModal = function(){
    sgGender = null;
    var bg = document.getElementById('sgBtnGirl'); if(bg) bg.className = 'sg-gender-btn';
    var bb = document.getElementById('sgBtnBoy');  if(bb) bb.className = 'sg-gender-btn';
    var ti = document.getElementById('sgTitleInput');   if(ti) ti.value = '';
    var ai = document.getElementById('sgArtistInput');  if(ai) ai.value = '';
    var ni = document.getElementById('sgNoteInput');    if(ni) ni.value = '';
    var em = document.getElementById('sgErrMsg'); if(em){ em.style.display='none'; em.textContent=''; }
    document.getElementById('sgModal').classList.add('open');
    setTimeout(function(){ var t=document.getElementById('sgTitleInput'); if(t) t.focus(); }, 80);
  };
  window.closeSgModal = function(){
    document.getElementById('sgModal').classList.remove('open');
  };
  document.getElementById('sgModal').addEventListener('click', function(e){ if(e.target===this) window.closeSgModal(); });

  window.sgSave = function(){
    var title = document.getElementById('sgTitleInput').value.trim();
    var artist = document.getElementById('sgArtistInput').value.trim();
    var note = document.getElementById('sgNoteInput').value.trim();
    if(!title || !artist) {
      if(!title) document.getElementById('sgTitleInput').style.borderColor='#e05555';
      if(!artist) document.getElementById('sgArtistInput').style.borderColor='#e05555';
      return;
    }
    var btn = document.querySelector('.sg-modal-save');
    btn.textContent = '⏳'; btn.disabled = true;

    var payload = { title: title, artist: artist };
    if(note) payload.note = note;
    if(sgGender) payload.gender = sgGender;

    var url = SB2_URL + '/rest/v1/v2_suggestion_songs';
    fetch(url, {
      method: 'POST',
      headers: sb2Headers({'Prefer': 'return=representation'}),
      body: JSON.stringify(payload)
    })
    .then(function(r){
      return r.text().then(function(txt){
        return { ok: r.ok, status: r.status, body: txt };
      });
    })
    .then(function(res){
      btn.textContent = 'Proposer 💚'; btn.disabled = false;
      if(res.ok){
        window.closeSgModal();
        renderSuggestions();
      } else {
        // Essai sans gender si erreur de colonne inconnue
        if(res.body && res.body.indexOf('gender') !== -1){
          var p2 = { title: title, artist: artist };
          if(note) p2.note = note;
          fetch(url, {
            method: 'POST',
            headers: sb2Headers({'Prefer': 'return=representation'}),
            body: JSON.stringify(p2)
          })
          .then(function(r2){ return r2.text(); })
          .then(function(){ window.closeSgModal(); renderSuggestions(); })
          .catch(function(){ window.closeSgModal(); });
        } else {
          var errMsg = document.getElementById('sgErrMsg');
          if(errMsg) { errMsg.textContent = '❌ Erreur : ' + res.status + ' — ' + res.body.substring(0,120); errMsg.style.display='block'; }
        }
      }
    })
    .catch(function(err){
      btn.textContent = 'Proposer 💚'; btn.disabled = false;
      var errMsg = document.getElementById('sgErrMsg');
      if(errMsg) { errMsg.textContent = '❌ ' + err.message; errMsg.style.display='block'; }
    });
  };

  // Enter key in inputs
  ['sgTitleInput','sgArtistInput','sgNoteInput'].forEach(function(id){
    var el = document.getElementById(id);
    if(el){
      el.addEventListener('keydown', function(e){ if(e.key==='Enter') window.sgSave(); });
      el.addEventListener('focus', function(){ this.style.borderColor=''; });
    }
  });

  function renderSuggestions(){
    var list = document.getElementById('sgList');
    list.innerHTML = '<div class="sg-empty"><span class="spinner"></span></div>';
    sbGet('suggestion_songs', 'order=created_at.asc').then(function(items){
      list.innerHTML = '';
      if(!Array.isArray(items) || !items.length){
        var em = document.createElement('div');
        em.className = 'sg-empty';
        em.textContent = sgUnlocked ? 'Aucune suggestion — propose-en une ! 🎵' : 'Aucune suggestion pour l\'instant. 🎵';
        list.appendChild(em);
        return;
      }
      items.forEach(function(item, index){
        var row = document.createElement('div');
        row.className = 'sg-song';
        row.innerHTML =
          '<div class="sg-num">' + (index + 1) + '</div>' +
          '<div class="sg-dot' + (item.gender === 'girl' ? ' sg-dot-girl' : item.gender === 'boy' ? ' sg-dot-boy' : '') + '"></div>' +
          '<div class="sg-info"><div class="sg-title">' + escSg(item.title) + '</div><div class="sg-artist">' + escSg(item.artist) + '</div></div>' +
          (item.note ? '<div class="sg-note">' + escSg(item.note) + '</div>' : '<div style="width:110px;flex-shrink:0"></div>') +
          (sgUnlocked ? '<button class="sg-edit" title="Modifier">✏️</button>' : '') +
          (sgUnlocked ? '<button class="sg-del" title="Supprimer">✕</button>' : '');
        if(sgUnlocked){
          (function(id){
            row.querySelector('.sg-del').addEventListener('click', function(e){
              e.stopPropagation();
              sbDelete('suggestion_songs', id).then(renderSuggestions);
            });
          })(item.id);
          (function(it){
            row.querySelector('.sg-edit').addEventListener('click', function(e){
              e.stopPropagation();
              openSgEditModal(it);
            });
          })(item);
        }
        list.appendChild(row);
      });
    }).catch(function(){
      list.innerHTML = '<div class="sg-empty">❌ Erreur de connexion.</div>';
    });
  }

  renderSuggestions();

  // ── Édition d'une suggestion ──
  var _sgEditId = null;

  function openSgEditModal(item){
    _sgEditId = item.id;
    var ti = document.getElementById('sgEditTitleInput');
    var ai = document.getElementById('sgEditArtistInput');
    var ni = document.getElementById('sgEditNoteInput');
    if(ti) ti.value = item.title || '';
    if(ai) ai.value = item.artist || '';
    if(ni) ni.value = item.note || '';
    var errMsg = document.getElementById('sgEditErrMsg');
    if(errMsg) errMsg.style.display = 'none';
    document.getElementById('sgEditModal').classList.add('open');
    setTimeout(function(){ if(ti) ti.focus(); }, 80);
  }

  window.closeSgEditModal = function(){
    document.getElementById('sgEditModal').classList.remove('open');
    _sgEditId = null;
  };
  document.getElementById('sgEditModal').addEventListener('click', function(e){ if(e.target===this) window.closeSgEditModal(); });

  window.sgEditSave = function(){
    if(!_sgEditId) return;
    var title = (document.getElementById('sgEditTitleInput').value||'').trim();
    var artist = (document.getElementById('sgEditArtistInput').value||'').trim();
    var note = (document.getElementById('sgEditNoteInput').value||'').trim();
    if(!title || !artist){
      ['sgEditTitleInput','sgEditArtistInput'].forEach(function(id){
        var el=document.getElementById(id);
        if(el&&!el.value.trim()) el.style.borderColor='#e05555';
      });
      return;
    }
    var btn = document.querySelector('.sg-edit-save');
    btn.textContent = '⏳'; btn.disabled = true;
    var payload = { title: title, artist: artist };
    if(note) payload.note = note; else payload.note = null;
    fetch(SB2_URL + '/rest/v1/v2_suggestion_songs?id=eq.' + _sgEditId, {
      method: 'PATCH',
      headers: sb2Headers({'Prefer': 'return=representation'}),
      body: JSON.stringify(payload)
    })
    .then(function(r){
      btn.textContent = 'Sauvegarder ✅'; btn.disabled = false;
      if(r.ok){ window.closeSgEditModal(); renderSuggestions(); }
      else {
        var errMsg = document.getElementById('sgEditErrMsg');
        if(errMsg){ errMsg.textContent = '❌ Erreur lors de la sauvegarde.'; errMsg.style.display='block'; }
      }
    })
    .catch(function(err){
      btn.textContent = 'Sauvegarder ✅'; btn.disabled = false;
      var errMsg = document.getElementById('sgEditErrMsg');
      if(errMsg){ errMsg.textContent = '❌ ' + err.message; errMsg.style.display='block'; }
    });
  };

  ['sgEditTitleInput','sgEditArtistInput','sgEditNoteInput'].forEach(function(id){
    var el = document.getElementById(id);
    if(el){
      el.addEventListener('keydown', function(e){ if(e.key==='Enter') window.sgEditSave(); });
      el.addEventListener('focus', function(){ this.style.borderColor=''; });
    }
  });

})();

// ── Coup de cœur ──────────────────────────────────────────────────────────
var favoritesCache = {}; // { girl: 'file.mp3', boy: 'file.mp3' }

function loadFavorites(){
  return sbGet('favorites', 'select=profile,song_file').then(function(rows){
    favoritesCache = {};
    if(!Array.isArray(rows)) return;
    rows.forEach(function(r){ favoritesCache[r.profile] = r.song_file; });
    refreshAllHearts();
  }).catch(function(){});
}

function applyHeartState(file, btn){
  var profile = getProfile();
  btn.className = btn.className.replace(/heart-girl|heart-boy/g,'').trim();
  if(favoritesCache['girl'] === file) btn.classList.add('heart-girl');
  if(favoritesCache['boy']  === file) btn.classList.add('heart-boy');
  // Texte plein ou vide
  var isActive = (favoritesCache['girl']===file || favoritesCache['boy']===file);
  btn.textContent = isActive ? '♥' : '♡';
}

function refreshAllHearts(){
  document.querySelectorAll('.btn-heart, .sp-heart').forEach(function(btn){
    var file = btn.dataset.file;
    if(file) applyHeartState(file, btn);
  });
}

function toggleFavorite(file, btn){
  var profile = getProfile();
  if(!profile) return; // pas de profil = rien

  var current = favoritesCache[profile];

  if(current === file){
    // Retirer le coup de cœur
    fetch(SB2_URL+'/rest/v1/v2_favorites?profile=eq.'+profile+'&song_file=eq.'+encodeURIComponent(file), {
      method:'DELETE', headers:sb2Headers()
    }).then(function(){
      delete favoritesCache[profile];
      refreshAllHearts();
    });
  } else {
    // Supprimer l'ancien puis ajouter le nouveau
    var doAdd = function(){
      fetch(SB2_URL+'/rest/v1/v2_favorites', {
        method:'POST',
        headers:sb2Headers({'Prefer':'return=representation'}),
        body:JSON.stringify({ profile: profile, song_file: file })
      }).then(function(){
        favoritesCache[profile] = file;
        refreshAllHearts();
      });
    };
    if(current){
      fetch(SB2_URL+'/rest/v1/v2_favorites?profile=eq.'+profile+'&song_file=eq.'+encodeURIComponent(current), {
        method:'DELETE', headers:sb2Headers()
      }).then(doAdd);
    } else {
      doAdd();
    }
  }
}

loadFavorites();


/* ══════════════════════════════════════════════════════
   NOW LISTENING — Glow sur la chanson (version propre)
   
   Logique :
   - Je vois UNIQUEMENT ce que l'autre écoute (pas moi)
   - Link voit Zelda en rose, Zelda voit Link en bleu
   - Même chanson en même temps → doré qui brille fort sur les deux
══════════════════════════════════════════════════════ */
(function(){

  var NL_TABLE = 'v2_now_listening';

  var _nlBoyFile        = null;
  var _nlGirlFile       = null;
  var _nlLastPushRemote = '__none__';

  /* ── Comparaison robuste par basename ── */
  function basename(file){
    if(!file) return null;
    return file.split('/').pop().split('?')[0];
  }

  /* ── Applique le glow sur les lignes de la playlist ── */
  function applyGlow(){
    var myProfile = getProfile();
    var boyBase   = basename(_nlBoyFile);
    var girlBase  = basename(_nlGirlFile);
    var sameSong  = !!(boyBase && girlBase && boyBase === girlBase);

    // Détermine ce que l'autre écoute
    var otherBase = null;
    var otherWho  = null;
    if(myProfile === 'boy'){
      otherBase = girlBase;
      otherWho  = 'girl';
    } else if(myProfile === 'girl'){
      otherBase = boyBase;
      otherWho  = 'boy';
    }

    // Retire tous les glows existants
    document.querySelectorAll('.nl-other-playing').forEach(function(el){
      el.classList.remove('nl-other-playing','nl-glow-boy','nl-glow-girl','nl-glow-together');
    });

    // Indicateur bandeau
    var ind = document.getElementById('nlOtherIndicator');
    var dot = document.getElementById('nlOtherDot');
    var lbl = document.getElementById('nlOtherLabel');
    if(ind){
      if(!otherBase){
        ind.style.display = 'none';
        ind.className = '';
      } else {
        ind.style.display = 'flex';
        ind.className = sameSong ? 'nl-ind-together' : ('nl-ind-' + otherWho);
        if(lbl){
          if(sameSong)       lbl.textContent = 'On écoute ensemble';
          else if(otherWho === 'girl') lbl.textContent = (typeof v2GetDisplayName === 'function' ? v2GetDisplayName('girl') : 'Elle') + ' écoute';
          else               lbl.textContent = (typeof v2GetDisplayName === 'function' ? v2GetDisplayName('boy') : 'Lui') + ' écoute';
        }
      }
    }

    if(!otherBase) return; // l'autre n'écoute rien → rien à afficher

    // Cherche la ligne correspondante dans la playlist
    document.querySelectorAll('#Love .sp-song').forEach(function(row){
      var audio = row.querySelector('audio');
      if(!audio) return;
      var src = '';
      try{ src = decodeURIComponent(audio.src); }catch(e){ src = audio.src || ''; }
      var rowBase = basename(src);
      if(!rowBase || rowBase !== otherBase) return;

      row.classList.add('nl-other-playing');
      if(sameSong){
        row.classList.add('nl-glow-together');
      } else {
        row.classList.add('nl-glow-' + otherWho);
      }
    });

    // Si même chanson, aussi glow sur MA chanson (même ligne, même base)
    if(sameSong && myProfile){
      var myBase = myProfile === 'boy' ? boyBase : girlBase;
      document.querySelectorAll('#Love .sp-song').forEach(function(row){
        if(row.classList.contains('nl-glow-together')) return; // déjà fait
        var audio = row.querySelector('audio');
        if(!audio) return;
        var src = '';
        try{ src = decodeURIComponent(audio.src); }catch(e){ src = audio.src || ''; }
        if(basename(src) === myBase){
          row.classList.add('nl-other-playing','nl-glow-together');
        }
      });
    }
  }

  /* ── Poll Supabase toutes les 5s ── */
  function nlPoll(){
    var url = SB2_URL + '/rest/v1/' + NL_TABLE + '?select=sender,song_file&order=updated_at.desc';
    fetch(url, { headers: sb2Headers() })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(rows){
        if(!Array.isArray(rows)) return;
        var newBoy = null, newGirl = null;
        rows.forEach(function(r){
          if(r.sender === 'boy')  newBoy  = r.song_file || null;
          if(r.sender === 'girl') newGirl = r.song_file || null;
        });
        _nlBoyFile  = newBoy;
        _nlGirlFile = newGirl;
        applyGlow();
      }).catch(function(){});
  }

  /* ── Push mon état vers Supabase ── */
  function nlPush(file){
    var profile = getProfile();
    if(!profile) return;

    var normalized = basename(file);

    // Mise à jour locale immédiate
    if(profile === 'boy')  _nlBoyFile  = normalized;
    if(profile === 'girl') _nlGirlFile = normalized;
    applyGlow();

    // Push distant seulement si changement
    if(_nlLastPushRemote === (normalized || 'null')) return;
    _nlLastPushRemote = normalized || 'null';

    fetch(SB2_URL + '/rest/v1/' + NL_TABLE, {
      method: 'POST',
      headers: sb2Headers({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ sender: profile, song_file: normalized })
    }).catch(function(){});
  }

  /* ── Démarre le poll ── */
  window.nlPoll = nlPoll;
  nlPoll();
  window._nlIv = setInterval(nlPoll, 5000);

  /* ── Hooks audio ── */
  var _origMpUpdate = window.mpUpdate;
  window.mpUpdate = function(){
    if(_origMpUpdate) _origMpUpdate.apply(this, arguments);
    var ca = (typeof currentAudio !== 'undefined') ? currentAudio : null;
    if(ca && !ca.paused){
      var src = '';
      try{ src = decodeURIComponent(ca.src); }catch(e){ src = ca.src || ''; }
      nlPush(src);
    } else {
      nlPush(null);
    }
  };

  var _origMpStop = window.mpStop;
  window.mpStop = function(){
    if(_origMpStop) _origMpStop.apply(this, arguments);
    nlPush(null);
  };

  document.addEventListener('play', function(e){
    if(e.target && e.target.tagName === 'AUDIO'){
      var src = '';
      try{ src = decodeURIComponent(e.target.src); }catch(ex){ src = e.target.src || ''; }
      if(src) nlPush(src);
    }
  }, true);

  document.addEventListener('pause', function(e){
    if(e.target && e.target.tagName === 'AUDIO'){
      setTimeout(function(){
        var any = false;
        document.querySelectorAll('audio').forEach(function(a){ if(!a.paused) any = true; });
        if(!any){
          _nlLastPushRemote = '__none__';
          nlPush(null);
        }
      }, 200);
    }
  }, true);

  document.addEventListener('ended', function(e){
    if(e.target && e.target.tagName === 'AUDIO'){
      setTimeout(function(){
        var any = false;
        document.querySelectorAll('audio').forEach(function(a){ if(!a.paused) any = true; });
        if(!any){
          _nlLastPushRemote = '__none__';
          nlPush(null);
        }
      }, 300);
    }
  }, true);

  /* ── Efface le statut à la fermeture ── */
  window.addEventListener('beforeunload', function(){
    var profile = getProfile();
    if(!profile) return;
    fetch(SB2_URL + '/rest/v1/' + NL_TABLE, {
      method: 'POST',
      headers: sb2Headers({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ sender: profile, song_file: null }),
      keepalive: true
    }).catch(function(){});
  });

  window._nlPush = nlPush;

})();

// ════════════════════════════════════════════
// RECHERCHE MUSICALE — déplacé depuis app-love.js (R1)
// openSearch / closeSearch / filterSongs
// Utilise : allSongs, songRows, currentAudio, stopCurrent, resetZoom, isQuizOpen (app-games.js)
// ════════════════════════════════════════════
function openSearch(){
  if(typeof isQuizOpen !== 'undefined' && isQuizOpen) return;
  if(typeof resetZoom === 'function') resetZoom();
  var o = document.getElementById('searchOverlay');
  if(!o) return;
  o.classList.add('open');
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '';
  setTimeout(function(){ document.getElementById('searchInput').focus(); }, 80);
}
function closeSearch(){
  if(typeof resetZoom === 'function') resetZoom();
  var o = document.getElementById('searchOverlay');
  if(o) o.classList.remove('open');
}
function filterSongs(q){
  var res = document.getElementById('searchResults');
  if(!res) return;
  res.innerHTML = '';
  if(!q.trim()) return;
  var f = allSongs.filter(function(s){
    return s.title.toLowerCase().includes(q.toLowerCase()) ||
           s.artist.toLowerCase().includes(q.toLowerCase());
  });
  if(!f.length){
    res.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px;font-size:13px">Aucun résultat</p>';
    return;
  }
  f.forEach(function(s){
    var row = document.createElement('div');
    row.className = 'sp-song';
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;cursor:pointer;';
    row.innerHTML = '<div class="sp-info"><div class="sp-title">' + escHtml(s.title) + '</div><div class="sp-artist">' + escHtml(s.artist) + '</div></div><div style="font-size:11px;color:var(--green);font-weight:600;flex-shrink:0">▶</div>';
    row.addEventListener('click', function(){
      closeSearch();
      var realRow = songRows[s.file];
      if(realRow){
        realRow.div.scrollIntoView({ behavior:'smooth', block:'center' });
        setTimeout(function(){
          if(currentAudio && currentAudio !== realRow.audio) stopCurrent();
          realRow.btn.click();
        }, 400);
      }
    });
    res.appendChild(row);
  });
}
