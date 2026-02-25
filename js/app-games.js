// ═══════════════════════════════════════════════════════════
// app-games.js — Memory · Pendu · Puzzle · Snake · Quiz

// ── GAMES — chargement direct (plus de lazy load) ──
var _gamesLoaded = true;
function _loadGames() {} // no-op conservé pour compat
function openQuiz()        { _openQuiz(); }
function closeQuiz()       { _closeQuiz(); }
function startQuiz()       { _startQuiz(); }
function renderQuestion()  { _renderQuestion(); }
function openPenduGame()   { _openPenduGame(); }
function closePenduGame()  { _closePenduGame(); }
function openPuzzleGame()  { _openPuzzleGame(); }
function closePuzzleGame() { _closePuzzleGame(); }
function openSnakeGame()   { _openSnakeGame(); }
function closeSnakeGame()  { _closeSnakeGame(); }


// ── MEMORY ──
var MEMORY_EMOJIS=['💕','🌸','💋','🥰','🌙','✨','🎵','💎'];
var memCards=[],memFlipped=[],memMatched=0,memMoves=0,memLocked=false,memTimerInt=null,memSeconds=0,memStarted=false;
var memCurrentPlayer = null; // 'girl' ou 'boy'

// ── Sélection du genre ──
function memorySelectGender(gender) {
  memCurrentPlayer = gender;
  // Highlight bouton sélectionné
  document.getElementById('memGenderGirl').className = 'gender-select-btn' + (gender === 'girl' ? ' girl' : '');
  document.getElementById('memGenderBoy').className  = 'gender-select-btn' + (gender === 'boy'  ? ' boy'  : '');
  // Afficher titre personnalisé
  document.getElementById('memoryStartTitle').textContent = (typeof v2GetDisplayName==="function"?'Jeu de mémoire — '+v2GetDisplayName(gender):(gender==="girl"?'Jeu de mémoire — Elle 🩷':'Jeu de mémoire — Lui 💙'));
  // Transition vers écran de départ
  document.getElementById('memoryGenderScreen').style.display = 'none';
  document.getElementById('memoryStartScreen').style.display  = 'flex';
}

function memoryBackToGender() {
  memCurrentPlayer = null;
  document.getElementById('memoryStartScreen').style.display  = 'none';
  document.getElementById('memoryGenderScreen').style.display = 'flex';
  document.getElementById('memGenderGirl').className = 'gender-select-btn';
  document.getElementById('memGenderBoy').className  = 'gender-select-btn';
}

function memoryLaunch(){
  document.getElementById('memoryStartScreen').style.display='none';
  document.getElementById('memoryGameArea').style.display='block';
  memoryInit();
}
function memoryQuit(){
  clearInterval(memTimerInt);
  document.getElementById('memoryGameArea').style.display='none';
  document.getElementById('memoryWin').classList.remove('show');
  // Retour à l'écran genre
  memoryBackToGender();
}
function memoryInit(){
  clearInterval(memTimerInt);memCards=[];memFlipped=[];memMatched=0;memMoves=0;memSeconds=0;memLocked=false;memStarted=false;
  document.getElementById('memScore').textContent='0';document.getElementById('memMoves').textContent='0';document.getElementById('memTime').textContent='0s';document.getElementById('memoryWin').classList.remove('show');
  var pairs=MEMORY_EMOJIS.concat(MEMORY_EMOJIS);
  for(var i=pairs.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var tmp=pairs[i];pairs[i]=pairs[j];pairs[j]=tmp;}
  var grid=document.getElementById('memoryGrid');grid.innerHTML='';
  pairs.forEach(function(emoji,idx){
    var card=document.createElement('div');card.className='mem-card';
    card.innerHTML='<div class="mem-card-inner"><div class="mem-card-front"></div><div class="mem-card-back">'+emoji+'</div></div>';
    card.dataset.emoji=emoji;card.dataset.idx=idx;
    (function(c){c.addEventListener('click',function(){memCardClick(c);});})(card);
    grid.appendChild(card);memCards.push(card);
  });
}
function memoryRestart(){document.getElementById('memoryWin').classList.remove('show');memoryInit();}
function memCardClick(card){
  if(memLocked||card.classList.contains('flipped')||card.classList.contains('matched'))return;
  if(!memStarted){memStarted=true;memTimerInt=setInterval(function(){memSeconds++;var m=Math.floor(memSeconds/60),s=memSeconds%60;document.getElementById('memTime').textContent=m?m+'m'+String(s).padStart(2,'0')+'s':s+'s';},1000);}
  card.classList.add('flipped');memFlipped.push(card);
  if(memFlipped.length===2){memMoves++;document.getElementById('memMoves').textContent=memMoves;memLocked=true;setTimeout(checkMemMatch,700);}
}
function checkMemMatch(){
  var a=memFlipped[0],b=memFlipped[1];
  if(a.dataset.emoji===b.dataset.emoji){a.classList.add('matched');b.classList.add('matched');memMatched++;document.getElementById('memScore').textContent=memMatched;if(memMatched===MEMORY_EMOJIS.length){clearInterval(memTimerInt);setTimeout(memoryWinFn,400);}}
  else{a.classList.add('wrong');b.classList.add('wrong');setTimeout(function(){a.classList.remove('flipped','wrong');b.classList.remove('flipped','wrong');},350);}
  memFlipped=[];memLocked=false;
}

// Calcul score : moins de coups et moins de temps = meilleur score
function memoryCalcScore(moves, seconds) {
  var base = 1000;
  var penalty = moves * 10 + seconds * 2;
  return Math.max(0, base - penalty);
}

function memoryWinFn(){
  var win=document.getElementById('memoryWin');win.classList.add('show');
  var stars=memMoves<=20?'🌟🌟🌟':memMoves<=30?'🌟🌟':'🌟';
  var timeStr = document.getElementById('memTime').textContent;
  var who = (typeof v2GetDisplayName==="function"?v2GetDisplayName(memCurrentPlayer):(memCurrentPlayer==="girl"?"Elle":"Lui"));
  var msg = memMoves<=20 ? 'Parfait '+who+' ! '+memMoves+' coups en '+timeStr+' 💕' : memMoves<=30 ? 'Bien joué '+who+' ! '+memMoves+' coups en '+timeStr+' 😊' : 'Bravo '+who+' ! '+memMoves+' coups en '+timeStr+' 😏';
  document.getElementById('memoryWinTitle').textContent=stars+' Terminé !';
  document.getElementById('memoryWinSub').textContent=msg;
  win.scrollIntoView({behavior:'smooth',block:'center'});

  // Sauvegarder dans Supabase
  if(memCurrentPlayer) {
    var scoreVal = memoryCalcScore(memMoves, memSeconds);
    // ✅ FIX: Ajouter couple_id pour isoler les scores par couple
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(coupleId) {
      sbPost('game_scores', {
        couple_id: coupleId,
        game_id: 'memory',
        player: memCurrentPlayer,
        score: scoreVal,
        moves: memMoves,
        time_seconds: memSeconds
      }).then(function(){ _lbLoad(); }).catch(function(){});
    }
  }
}

// ── LEADERBOARD ──
var lbCurrentTab = 'all';

function lbSetTab(tab) {
  lbCurrentTab = tab;
  ['all','girl','boy'].forEach(function(t) {
    var el = document.getElementById('lbTab' + t.charAt(0).toUpperCase() + t.slice(1));
    if(el) el.className = 'lb-tab' + (t === tab ? ' active-' + tab : '');
  });
  lbRender(lbCurrentData);
}

var lbCurrentData = [];

function _lbLoad() {
  var list = document.getElementById('lbList');
  list.innerHTML = '<div class="lb-loading"><span class="spinner"></span></div>';
  // ✅ FIX: Filtrer par couple_id
  var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
  var coupleId = s && s.user ? s.user.couple_id : null;
  if(!coupleId) {
    list.innerHTML = '<div class="lb-empty">Session expirée — reconnectez-vous</div>';
    return;
  }
  sbGet('game_scores', 'couple_id=eq.' + coupleId + '&game_id=eq.memory&order=score.desc&limit=50')
    .then(function(rows) {
      lbCurrentData = Array.isArray(rows) ? rows : [];
      lbRender(lbCurrentData);
    })
    .catch(function() {
      list.innerHTML = '<div class="lb-empty">❌ Erreur de connexion.</div>';
    });
}

function lbRender(rows) {
  var list = document.getElementById('lbList');
  var filtered = lbCurrentTab === 'all' ? rows : rows.filter(function(r){ return r.player === lbCurrentTab; });
  // Top 10 seulement
  var top = filtered.slice(0, 10);
  if(!top.length) {
    list.innerHTML = '<div class="lb-empty">Aucun score encore — soyez les premiers ! 🎮</div>';
    return;
  }
  var rankIcons = ['🥇','🥈','🥉'];
  list.innerHTML = top.map(function(row, i) {
    var rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    var rankDisplay = i < 3 ? rankIcons[i] : (i + 1);
    var playerLabel = (typeof v2GetDisplayName==="function"?v2GetDisplayName(row.player):(row.player==="girl"?"Elle":"Lui"));
    var dotClass = row.player === 'girl' ? 'girl' : 'boy';
    var m = Math.floor(parseInt(row.time_seconds||0) / 60), s = parseInt(row.time_seconds||0) % 60;
    var timeStr = m ? m + 'm' + String(s).padStart(2,'0') + 's' : s + 's';
    return '<div class="lb-row">' +
      '<div class="lb-rank ' + rankClass + '">' + rankDisplay + '</div>' +
      '<div class="lb-dot ' + dotClass + '"></div>' +
      '<div class="lb-name">' + playerLabel + '</div>' +
      '<div class="lb-score"><span>' + parseInt(row.score||0) + 'pts</span> · ' + parseInt(row.moves||0) + ' coups · ' + timeStr + '</div>' +
    '</div>';
  }).join('');
}

var _gamesLbLoaded = false;

// ── QUIZ ──
  
var ALL_QUIZ_QUESTIONS=[
  {id:"plat",q:"Quel est mon plat préféré ? 😌",opts:["Risotto","Lasagne","Pattes","Tajine"],correct:1,hint:"Un plat qui demande un peu de patience… et qui est encore meilleur le lendemain."},
  {id:"boisson",q:"Quelle est ma boisson préférée ? 👀",opts:["Fanta","Oasis","Ice Tea","Sprite"],correct:3,hint:"Quand tu l’ouvres, ça fait 'pshhh'… et ça réveille un peu la langue."},
  {id:"sucresale",q:"Je suis plutôt sucré ou salé ? 😏",opts:["Sucré","Les deux égaux","Salé","Ni l'un ni l'autre"],correct:2,hint:"Je choisis ce qui rassasie vraiment, pas juste ce qu’on grignote."},
  {id:"couleur",q:"Quelle est ma couleur préférée ? ✨",opts:["Rose","Bleu","Violet","Rouge"],correct:3,hint:"Une couleur intense qu’on associe aux émotions fortes."},
  {id:"fruit",q:"Quel est mon fruit préféré ? 🤔",opts:["Fraise","Mangue","Pomme","Pêche"],correct:2,hint:"On dit que si on en consomme régulièrement, certaines visites restent à distance."},
  {id:"cuisine",q:"Quel type de cuisine je préfère ? 😋",opts:["Italienne","Mexicaine","Française","Asiatique"],correct:3,hint:"Une cuisine où les baguettes ne servent pas à faire du pain."},
  {id:"thecafe",q:"Je choisis quoi entre thé et café ? ☁️",opts:["Café","Thé","Les deux","Aucun des deux"],correct:3,hint:"Ni l’un pour me réveiller, ni l’autre pour faire une pause."},
  {id:"dessert",q:"Quel est mon dessert préféré ? 💭",opts:["Fondant au chocolat","Crème brûlée","Tarte au citron","Cheesecake"],correct:2,hint:"Un dessert qui fait légèrement plisser les yeux avant de sourire."},
  {id:"odeur",q:"Quelle odeur je préfère ? ",opts:["Rose","Lavande","Menthe","Vanille"],correct:3,hint:"Une odeur douce qui donne presque envie de croquer dans l’air."},
  {id:"animal",q:"Quel est mon animal préféré ? 🐾",opts:["Chat","Lapin","Cheval","Chien"],correct:3,hint:"Un compagnon fidèle qui remue plus que la tête quand il est heureux."},
  {id:"templibre",q:"Qu’est-ce que je préfère faire pendant mon temps libre ? 💕",opts:["Regarder des séries","Parler à l'amour de ma vie","Dessiner","Jouer au basket"],correct:1,hint:"Une activité qui ne demande rien d’autre qu’une personne essentielle à mes yeux."},
  {id:"film",q:"Quel est mon film préféré ? 🎬",opts:["Twilight","After","La La Land","Nos étoiles contraires"],correct:3,hint:"Une histoire d’amour intense où le temps semble compter double."},
  {id:"serie",q:"Quelle série je pourrais revoir sans me lasser ? 🔁",opts:["Stranger Things","Arcane","Game of Thrones","Naruto"],correct:1,hint:"Un univers animé où deux sœurs ne sont pas vraiment du même côté."},
  {id:"musique",q:"Quel type de musique j’écoute le plus ? 🎧",opts:["R&B","Pop","Rap","Variété française"],correct:2,hint:"Un genre où les mots frappent parfois plus fort que la mélodie."},
  {id:"artiste",q:"Quel est mon artiste préféré ? 🎶",opts:["Drake","Kendrick Lamar","Travis Scott","A$AP Rocky"],correct:3,hint:"Un artiste dont le nom sonne comme un pseudonyme sorti d’un défilé."},
  {id:"lecture",q:"Qu’est-ce que je préfère lire ? 📖",opts:["Je n'aime pas lire","Harry Potter","Les fables","Les mangas"],correct:2,hint:"Des récits courts qui cachent souvent une leçon entre les lignes."},
  {id:"sport",q:"Quel sport je pratique ? 💪",opts:["Tennis","Natation","Basket","Volleyball"],correct:2,hint:"Un sport où le silence juste avant un tir peut devenir électrique."},
  {id:"creatif",q:"Quelle activité créative je préfère ? ✏️",opts:["La peinture","Le tricot","La poterie","Dessiner"],correct:3,hint:"Quelques traits suffisent pour faire naître une idée."},
  {id:"hobby",q:"Quel hobby j’aimerais essayer ? 🌟",opts:["La photographie","Le yoga","String Art","La cuisine"],correct:2,hint:"Des lignes tendues qui finissent par former quelque chose d’harmonieux."},
  {id:"sortir",q:"Je préfère sortir ou rester chez moi ? 🌗",opts:["Sortir","Rester chez moi","Les deux selon l'humeur","Ni l'un ni l'autre"],correct:2,hint:"Tout dépend de mon énergie du moment."},
  {id:"reve",q:"Quel pays je rêve de visiter ? 🌍",opts:["La Nouvelle-Zélande","Le Canada","L'Australie","L'Islande"],correct:2,hint:"Un endroit lointain où la nature semble presque irréelle."},
  {id:"vacances",q:"Quelle est ma destination de vacances préférée ? ✈️",opts:["La Thaïlande","La Grèce","Le Japon","L'Espagne"],correct:2,hint:"Un pays où traditions anciennes et modernité se croisent en permanence."},
  {id:"nature",q:"Je préfère la mer, la montagne, la forêt ou la ville ? ✨",opts:["La montagne","La ville","La forêt","La mer"],correct:3,hint:"Un lieu où l’horizon semble ne jamais finir."},
  {id:"seule",q:"Est-ce que j’ai déjà voyagé seul ? 🧳",opts:["Non jamais","Oui","Pas encore mais j'aimerais","Non et je ne veux pas"],correct:1,hint:"Une preuve d’indépendance assumée."},
  {id:"enfance",q:"Quel est mon meilleur souvenir d’enfance ? 🌸",opts:["Un anniversaire mémorable","Un voyage en famille","Vacances avec mes cousins","Mon premier jour d'école"],correct:2,hint:"Un souvenir d’été partagé avec une partie bruyante de la famille."},
  {id:"jouet",q:"Quel objet j’adorais quand j’étais petit ? 💛",opts:["Une poupée Barbie","Un doudou lapin","Kevin (peluche Minions)","Un vélo"],correct:2,hint:"Une peluche avec un prénom, inspirée d’un univers jaune très connu."},
  {id:"matiere",q:"Quelle était ma matière préférée à l’école ? 📚",opts:["Histoire-Géographie","Mathématiques","Français","SVT"],correct:3,hint:"Une matière qui parle autant de la nature que du corps humain."},
  {id:"reveenfant",q:"Quel était mon rêve d’enfant ? ✨",opts:["Devenir médecin","Être architecte","Faire le tour du monde","Devenir clown"],correct:2,hint:"Un rêve qui ne tient pas dans une seule valise."},
  {id:"folle",q:"Quelle est la chose la plus folle que j’ai faite ? 😅",opts:["Sauter en parachute","Courir en slip dehors","Cache-cache dans un arbre","Conduire sans permis"],correct:2,hint:"Un jeu d’enfance… mais avec un peu plus d’altitude que prévu."},
  {id:"qualite",q:"Quelle est ma plus grande qualité ? 💫",opts:["La générosité","La persévérance","La créativité","L'empathie"],correct:1,hint:"Je n’abandonne pas facilement, même quand c’est compliqué."},
  {id:"defaut",q:"Quel est mon plus gros défaut ? 🙃",opts:["La procrastination","La jalousie","S'acharner jusqu'à réussir","L'impatience"],correct:2,hint:"Une qualité poussée un peu trop loin."},
  {id:"toimeme",q:"Quand est-ce que je me sens le plus moi-même ? 💞",opts:["Quand je suis seul","Quand je dessine","En compagnie de ma copine","Dans la nature"],correct:2,hint:"Quand je suis avec la personne qui me connaît vraiment."},
  {id:"colere",q:"Comment je réagis quand je suis en colère ? 🔥",opts:["Je pleure","Je me renferme sur moi-même","Je suis très irritable","Je crie"],correct:2,hint:"Mon humeur devient rapidement plus piquante."},
  {id:"amour",q:"Quel est mon langage de l’amour ? ❤️",opts:["Les cadeaux et les services","Les touchers et le temps de qualité","Les paroles et l'attention","Les actes de service"],correct:2,hint:"Les mots ont beaucoup de poids pour moi."},
  {id:"secret",q:"Est-ce que je sais garder un secret ? 🤫",opts:["Non jamais","Oui","Je ne sais plus","Rarement"],correct:1,hint:"Je sais me taire quand il le faut."},
  {id:"opti",q:"Je suis plutôt optimiste ou réaliste ? 🌤️",opts:["Réaliste","Pessimiste","Optimiste","Les deux à la fois"],correct:2,hint:"Je cherche la lumière même quand ce n’est pas évident."},
  {id:"pleurs",q:"Est-ce que je pleure facilement ? 💭",opts:["Oui très facilement","Ça dépend","Non","Jamais"],correct:2,hint:"Je garde souvent mes émotions bien maîtrisées."},
  {id:"rancune",q:"Est-ce que je suis rancunier ? 🌱",opts:["Oui beaucoup","Un peu","Non","Ça dépend des situations"],correct:2,hint:"Je préfère avancer plutôt que ressasser."},
  {id:"astro",q:"Quel est mon signe astro ? ✨",opts:["Vierge","Scorpion","Cancer","Gémeaux"],correct:3,hint:"Un signe associé à la dualité."}
];

var QUIZ_TOTAL=10,qzCurrent=0,qzScore=0,qzAnswered=false,qzSession=[];
function _openQuiz(){resetZoom();isQuizOpen=true;_yamSlide(document.getElementById('quizView'),document.getElementById('yamJeuxTab'),'forward');particleActive=false;hideDance();document.getElementById('navSearch').style.display='none';_startQuiz();window.scrollTo(0,0);}
function _closeQuiz(){isQuizOpen=false;_yamSlide(null,document.getElementById('quizView'),'backward');document.getElementById('yamJeuxTab').classList.add('active');document.getElementById('navSearch').style.display='';}
function getHints(){try{return JSON.parse(localStorage.getItem('qz_hints')||'{}');}catch(e){return{};}}
function saveHint(id,hint){var h=getHints();h[id]=hint;try{localStorage.setItem('qz_hints',JSON.stringify(h));}catch(e){}}
function pickQuestions(){var pool=ALL_QUIZ_QUESTIONS.slice(),picked=[];while(picked.length<QUIZ_TOTAL&&pool.length>0){var i=Math.floor(Math.random()*pool.length);picked.push(pool.splice(i,1)[0]);}return picked;}
function _startQuiz(){qzCurrent=0;qzScore=0;qzAnswered=false;qzSession=pickQuestions();document.getElementById('qzResult').classList.remove('show');document.getElementById('qzCodeBox').classList.remove('show');document.getElementById('qzFeedback').classList.remove('show');document.getElementById('qzNextBtn').classList.remove('show');_renderQuestion();}
function _renderQuestion(){
  var q=qzSession[qzCurrent];qzAnswered=false;
  document.getElementById('qzQNum').textContent='Question '+(qzCurrent+1);
  document.getElementById('qzQText').textContent=q.q;
  document.getElementById('qzFill').style.width=(qzCurrent/QUIZ_TOTAL*100)+'%';
  document.getElementById('qzProgressTxt').textContent=qzCurrent+' / '+QUIZ_TOTAL;
  document.getElementById('qzFeedback').classList.remove('show');
  document.getElementById('qzNextBtn').classList.remove('show');
  var hints=getHints(),hintBar=document.getElementById('qzHintBar');
  if(hints[q.id]){hintBar.textContent='💡 Indice : '+hints[q.id];hintBar.style.display='block';}
  else{hintBar.style.display='none';}
  var optsEl=document.getElementById('qzOptions');optsEl.innerHTML='';
  q.opts.forEach(function(opt,i){var btn=document.createElement('button');btn.className='qz-opt';btn.textContent=opt;btn.addEventListener('click',function(){answerQ(i);});optsEl.appendChild(btn);});
}
function answerQ(idx){
  if(qzAnswered)return;qzAnswered=true;
  var q=qzSession[qzCurrent],opts=document.querySelectorAll('.qz-opt'),fb=document.getElementById('qzFeedback');
  opts.forEach(function(o){o.classList.add('disabled');});
  if(idx===q.correct){qzScore++;opts[idx].classList.remove('disabled');opts[idx].classList.add('correct');fb.textContent='✓ Bonne réponse ! 🎉';fb.className='qz-feedback show good';}
  else{opts[idx].classList.remove('disabled');opts[idx].classList.add('wrong');saveHint(q.id,q.hint);fb.innerHTML='✗ Raté ! Indice mémorisé 💾<br><span style="display:block;margin-top:5px;font-size:12px;opacity:0.9">💡 '+q.hint+'</span>';fb.className='qz-feedback show bad';}
  document.getElementById('qzNextBtn').classList.add('show');
  document.getElementById('qzNextBtn').textContent=qzCurrent+1<QUIZ_TOTAL?'Question suivante →':'Voir mon score 🎊';
}
document.getElementById('qzNextBtn').addEventListener('click',function(){qzCurrent++;if(qzCurrent<QUIZ_TOTAL){_renderQuestion();}else{showResult();}});
function showResult(){
  document.getElementById('qzOptions').innerHTML='';document.getElementById('qzFeedback').classList.remove('show');document.getElementById('qzNextBtn').classList.remove('show');document.getElementById('qzHintBar').style.display='none';
  document.getElementById('qzFill').style.width='100%';document.getElementById('qzProgressTxt').textContent=QUIZ_TOTAL+' / '+QUIZ_TOTAL;
  var res=document.getElementById('qzResult');res.classList.add('show');
  var emoji,title,sub,showCode;
  if(qzScore>=8){emoji='🏆';title='Parfaite connaisseuse !';sub=qzScore+'/'+QUIZ_TOTAL+' — Tu me connais par cœur, et j\'adore ça 💕\nTon code secret t\'attend ci-dessous 🔐';showCode=true;}
  else if(qzScore>=5){emoji='💕';title='Pas mal du tout !';sub=qzScore+'/'+QUIZ_TOTAL+' — T\'es sur la bonne voie, mais j\'ai encore des secrets 😏\nIl faut 8/10 pour obtenir le code secret !';showCode=false;}
  else{emoji='🤡';title='Noob 👉🤡';sub=qzScore+'/'+QUIZ_TOTAL+' — C\'est pas terrible ça ! Les indices t\'attendent pour la prochaine fois 😄';showCode=false;}
  document.getElementById('qzResultEmoji').textContent=emoji;document.getElementById('qzResultTitle').textContent=title;document.getElementById('qzResultSub').textContent=sub;
  if(showCode)document.getElementById('qzCodeBox').classList.add('show');
  res.scrollIntoView({behavior:'smooth',block:'start'});
}

// ══════════════════════════════════════════
// ── PENDU ──
// ══════════════════════════════════════════
var PENDU_WORDS = [
  {w:'amour',h:'Un sentiment fort entre deux personnes',t:'💑 Couple'},
  {w:'bisou',h:'Un petit geste de tendresse sur les lèvres',t:'💑 Couple'},
  {w:'calin',h:'On se serre fort dans les bras',t:'💑 Couple'},
  {w:'coeur',h:'Symbole de l\'amour ❤️',t:'💑 Couple'},
  {w:'douceur',h:'Une qualité précieuse chez quelqu\'un de gentil',t:'✨ Sentiment'},
  {w:'etoile',h:'Elle brille la nuit dans le ciel',t:'🌙 Nature'},
  {w:'fleur',h:'Souvent offerte pour la Saint-Valentin',t:'🌸 Nature'},
  {w:'gateau',h:'On le mange lors d\'un anniversaire',t:'🎂 Fête'},
  {w:'hasard',h:'Quand quelque chose arrive sans être prévu',t:'✨ Sentiment'},
  {w:'infini',h:'Quelque chose qui ne finit jamais',t:'✨ Sentiment'},
  {w:'jaloux',h:'Un sentiment parfois difficile à gérer',t:'✨ Sentiment'},
  {w:'kawaii',h:'Mot japonais qui signifie mignon',t:'🌸 Mignon'},
  {w:'lune',h:'Elle éclaire les nuits romantiques',t:'🌙 Nature'},
  {w:'magie',h:'Ce qu\'on ressent quand tout est parfait',t:'✨ Sentiment'},
  {w:'nuage',h:'Il flotte dans le ciel comme les rêves',t:'🌙 Nature'},
  {w:'ocean',h:'Une grande étendue d\'eau bleue',t:'🌊 Nature'},
  {w:'papillon',h:'Il symbolise la transformation et la liberté',t:'🌸 Nature'},
  {w:'quartz',h:'Une pierre précieuse rose',t:'💎 Bijou'},
  {w:'rose',h:'La fleur de l\'amour par excellence',t:'🌸 Nature'},
  {w:'soleil',h:'Il réchauffe comme un sourire',t:'🌙 Nature'},
  {w:'tendre',h:'Quelqu\'un de doux et affectueux',t:'💑 Couple'},
  {w:'univers',h:'Tout ce qui existe autour de nous',t:'✨ Sentiment'},
  {w:'voyage',h:'Partir découvrir de nouveaux endroits',t:'✈️ Voyage'},
  {w:'week-end',h:'Les deux jours qu\'on attend toute la semaine',t:'🎉 Vie'},
  {w:'zinzin',h:'Un peu fou, mais attachant',t:'🤪 Fun'},
  {w:'rire',h:'Le meilleur remède au blues',t:'😄 Fun'},
  {w:'musique',h:'Ce site en est plein',t:'🎵 Musique'},
  {w:'playlist',h:'Une liste de sons qu\'on aime',t:'🎵 Musique'},
  {w:'melodie',h:'Une suite de notes harmonieuses',t:'🎵 Musique'},
  {w:'rythme',h:'Ce qui donne envie de danser',t:'🎵 Musique'},
  {w:'chanson',h:'Un texte mis en musique',t:'🎵 Musique'},
  {w:'artiste',h:'Quelqu\'un qui crée de l\'art',t:'🎵 Musique'},
  {w:'concert',h:'Un spectacle musical en direct',t:'🎵 Musique'},
  {w:'guitare',h:'Instrument à cordes',t:'🎸 Instrument'},
  {w:'piano',h:'Instrument à touches noir et blanc',t:'🎹 Instrument'},
  {w:'microphone',h:'On parle ou chante dedans',t:'🎤 Musique'},
  {w:'studio',h:'Là où on enregistre la musique',t:'🎵 Musique'},
  {w:'album',h:'Une collection de chansons',t:'🎵 Musique'},
  {w:'refrain',h:'La partie répétée d\'une chanson',t:'🎵 Musique'},
  {w:'couplet',h:'La partie narrative d\'une chanson',t:'🎵 Musique'},
  {w:'beatbox',h:'Faire de la musique avec sa bouche',t:'🎤 Musique'},
  {w:'rappeur',h:'Il place des rimes sur un beat',t:'🎤 Musique'},
  {w:'freestyle',h:'Improviser sans préparation',t:'🎤 Musique'},
  {w:'casque',h:'On met ça sur les oreilles pour écouter',t:'🎧 Musique'},
  {w:'vinyle',h:'Un vieux disque noir qui tourne',t:'🎵 Musique'},
  {w:'festival',h:'Un grand événement musical en plein air',t:'🎉 Fête'},
  {w:'karaoké',h:'On chante sur les paroles affichées',t:'🎤 Musique'},
  {w:'baguette',h:'Accessoire du chef d\'orchestre',t:'🎵 Musique'},
  {w:'harmonie',h:'Quand tout s\'accorde parfaitement',t:'🎵 Musique'},
  {w:'ballade',h:'Une chanson douce et lente',t:'🎵 Musique'},
  {w:'silence',h:'L\'absence de son',t:'✨ Sentiment'},
  {w:'vibration',h:'Ce que la musique fait ressentir',t:'🎵 Musique'},
];

var penduPlayer=null, penduWord='', penduHint='', penduTheme='', penduGuessed=[], penduErrors=0, penduMaxErrors=7;
var penduScore=0, penduWins=0;
var PENDU_PARTS=['ph-head','ph-body','ph-arm1','ph-arm2','ph-leg1','ph-leg2'];

function _openPenduGame(){
  resetZoom();
  _yamSlide(document.getElementById('penduView'), document.getElementById('gamesView'), 'forward');
  particleActive=false; hideDance();
  window.scrollTo(0,0);
  plbLoad();
}
function _closePenduGame(){
  _yamSlide(document.getElementById('gamesView'), document.getElementById('penduView'), 'backward');
  penduPlayer=null;
  document.getElementById('penduGenderScreen').style.display='flex';
  document.getElementById('penduGameArea').style.display='none';
  document.getElementById('penduGenderGirl').className='gender-select-btn';
  document.getElementById('penduGenderBoy').className='gender-select-btn';
}
function penduSelectGender(g){
  penduPlayer=g;
  document.getElementById('penduGenderGirl').className='gender-select-btn'+(g==='girl'?' girl':'');
  document.getElementById('penduGenderBoy').className='gender-select-btn'+(g==='boy'?' boy':'');
  document.getElementById('penduGenderScreen').style.display='none';
  document.getElementById('penduGameArea').style.display='block';
  penduWins=0; penduScore=0;
  penduNewWord();
}
function penduNewWord(){
  var idx=Math.floor(Math.random()*PENDU_WORDS.length);
  penduWord=PENDU_WORDS[idx].w; penduHint=PENDU_WORDS[idx].h; penduTheme=PENDU_WORDS[idx].t||'❓ Thème';
  penduGuessed=[]; penduErrors=0;
  // Reset pendu drawing
  PENDU_PARTS.forEach(function(id){ document.getElementById(id).style.display='none'; });
  document.getElementById('penduErrors').textContent='0 / 7 erreurs';
  document.getElementById('penduHint').textContent='💡 '+penduHint;
  // Afficher le thème
  var themeWrap=document.getElementById('penduThemeWrap');
  if(themeWrap) themeWrap.innerHTML='<span class="pendu-theme">Thème : '+penduTheme+'</span>';
  document.getElementById('penduResult').style.display='none';
  document.getElementById('penduGameArea').querySelectorAll('.pendu-key').forEach(function(k){ k.remove(); });
  renderPenduWord();
  renderPenduKeyboard();
}
function penduNextWord(){ penduNewWord(); }
function renderPenduWord(){
  var el=document.getElementById('penduWord'); el.innerHTML='';
  penduWord.split('').forEach(function(c){
    var d=document.createElement('div'); d.className='pendu-letter';
    if(c==='-') d.textContent='-';
    else d.textContent=penduGuessed.includes(c)?c:'';
    el.appendChild(d);
  });
}
function renderPenduKeyboard(){
  var el=document.getElementById('penduKeyboard'); el.innerHTML='';
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach(function(c){
    var btn=document.createElement('button'); btn.className='pendu-key'; btn.textContent=c;
    btn.addEventListener('click',function(){ penduGuess(c,btn); });
    el.appendChild(btn);
  });
}
function penduGuess(c, btn){
  if(penduGuessed.includes(c)||btn.classList.contains('used')) return;
  penduGuessed.push(c);
  btn.classList.add('used');
  if(penduWord.includes(c)){
    btn.classList.add('correct');
    renderPenduWord();
    // Vérif victoire
    var won=penduWord.split('').every(function(l){ return l==='-'||penduGuessed.includes(l); });
    if(won){ penduWins++; penduScore+=100-penduErrors*10; penduEndGame(true); }
  } else {
    btn.classList.add('wrong');
    penduErrors++;
    document.getElementById('penduErrors').textContent=penduErrors+' / 7 erreurs';
    if(penduErrors<=PENDU_PARTS.length) document.getElementById(PENDU_PARTS[penduErrors-1]).style.display='';
    if(penduErrors>=7) penduEndGame(false);
  }
}
function penduEndGame(won){
  var res=document.getElementById('penduResult');
  res.style.display='block';
  document.getElementById('penduResultEmoji').textContent=won?'🎉':'💀';
  document.getElementById('penduResultMsg').textContent=won?'Bravo ! Mot trouvé 🎊 Score : '+penduScore+' pts':'Perdu... Tu avais '+penduErrors+' erreurs';
  document.getElementById('penduWordReveal').textContent=penduWord.toUpperCase();
  if(penduPlayer && penduScore>0){
    // ✅ FIX: Ajouter couple_id pour isoler les scores par couple
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(coupleId) {
      sbPost('game_scores',{couple_id:coupleId,game_id:'pendu',player:penduPlayer,score:penduScore,moves:penduErrors,time_seconds:0})
        .then(function(){ plbLoad(); }).catch(function(){});
    }
  }
}

// Classement Pendu
var plbTab='all', plbData=[];
function plbSetTab(t){
  plbTab=t;
  ['all','girl','boy'].forEach(function(x){
    document.getElementById('plbTab'+x.charAt(0).toUpperCase()+x.slice(1)).className='lb-tab'+(x===t?' active-'+t:'');
  });
  plbRender(plbData);
}
function plbLoad(){
  document.getElementById('plbList').innerHTML='<div class="lb-loading">Chargement...</div>';
  // ✅ FIX: Filtrer par couple_id
  var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
  var coupleId = s && s.user ? s.user.couple_id : null;
  if(!coupleId) {
    document.getElementById('plbList').innerHTML='<div class="lb-empty">Session expirée</div>';
    return;
  }
  sbGet('game_scores','couple_id=eq.' + coupleId + '&game_id=eq.pendu&order=score.desc&limit=50').then(function(r){
    plbData=Array.isArray(r)?r:[];plbRender(plbData);
  }).catch(function(){ document.getElementById('plbList').innerHTML='<div class="lb-empty">❌ Erreur</div>'; });
}
function plbRender(rows){
  renderLb('plbList', plbTab==='all'?rows:rows.filter(function(r){return r.player===plbTab;}), function(r){ return '<span>'+parseInt(r.score||0)+'pts</span> · '+parseInt(r.moves||0)+' erreurs'; });
}

// ══════════════════════════════════════════
// ── PUZZLE ──
// ══════════════════════════════════════════
// ── PUZZLE GÉNÉRATION PROCÉDURALE ──
var PUZZLE_IMAGES=(function(){var b=SB2_URL+'/storage/v1/object/public/images/';return['image-1.jpg','image-2.jpg','image-3.jpg','image-4.jpg','image-5.jpg','image-6.jpg','image-7.jpg','image-8.jpg','image-9.jpg','image-10.jpg'].map(function(f){return b+f;});})();
var puzzleDataURLCurrent='', puzzleLastImage='';

// Thèmes de génération
var PUZZLE_THEMES = [
  function(ctx, sz){ // Dégradé radial + cercles
    var seed = Math.random;
    var c1=rndColor(), c2=rndColor(), c3=rndColor();
    var g=ctx.createRadialGradient(sz*.3,sz*.3,sz*.05,sz*.6,sz*.6,sz*.9);
    g.addColorStop(0,c1); g.addColorStop(0.5,c2); g.addColorStop(1,c3);
    ctx.fillStyle=g; ctx.fillRect(0,0,sz,sz);
    for(var i=0;i<12;i++){
      ctx.beginPath();
      ctx.arc(Math.random()*sz,Math.random()*sz,Math.random()*sz*.18+sz*.04,0,Math.PI*2);
      ctx.fillStyle=rndColorA(0.15,0.35); ctx.fill();
    }
  },
  function(ctx, sz){ // Lignes diagonales colorées
    var cols=[rndColor(),rndColor(),rndColor(),rndColor(),rndColor()];
    var stripes=cols.length*2;
    for(var i=0;i<stripes;i++){
      ctx.beginPath();
      var x=i*(sz*2/stripes)-sz;
      ctx.moveTo(x,0); ctx.lineTo(x+sz*2,0); ctx.lineTo(x+sz,sz); ctx.lineTo(x-sz,sz);
      ctx.closePath();
      ctx.fillStyle=cols[i%cols.length]; ctx.fill();
    }
    // overlay texture
    for(var j=0;j<8;j++){
      ctx.beginPath();
      ctx.arc(Math.random()*sz,Math.random()*sz,Math.random()*sz*.22+sz*.05,0,Math.PI*2);
      ctx.fillStyle=rndColorA(0.1,0.25); ctx.fill();
    }
  },
  function(ctx, sz){ // Grille de rectangles colorés façon Mondrian
    var cols=[rndColor(),rndColor(),rndColor(),rndColor(),rndColor(),rndColor()];
    var g=ctx.createLinearGradient(0,0,sz,sz);
    g.addColorStop(0,rndColor()); g.addColorStop(1,rndColor());
    ctx.fillStyle=g; ctx.fillRect(0,0,sz,sz);
    for(var i=0;i<20;i++){
      var rx=Math.random()*sz, ry=Math.random()*sz;
      var rw=Math.random()*sz*.35+sz*.08, rh=Math.random()*sz*.35+sz*.08;
      ctx.fillStyle=rndColorA(0.25,0.55);
      ctx.fillRect(rx,ry,rw,rh);
    }
  },
  function(ctx, sz){ // Vagues / sinusoïdes
    var bg1=rndColor(), bg2=rndColor();
    var g=ctx.createLinearGradient(0,0,0,sz);
    g.addColorStop(0,bg1); g.addColorStop(1,bg2);
    ctx.fillStyle=g; ctx.fillRect(0,0,sz,sz);
    var waves=6+Math.floor(Math.random()*5);
    for(var w=0;w<waves;w++){
      var amp=sz*.04+Math.random()*sz*.1;
      var freq=1+Math.random()*3;
      var yBase=sz*w/waves;
      ctx.beginPath(); ctx.moveTo(0,yBase);
      for(var x=0;x<=sz;x+=2){
        ctx.lineTo(x, yBase+Math.sin(x/sz*Math.PI*2*freq+w)*amp);
      }
      ctx.lineTo(sz,sz); ctx.lineTo(0,sz); ctx.closePath();
      ctx.fillStyle=rndColorA(0.18,0.35); ctx.fill();
    }
  },
  function(ctx, sz){ // Triangles géométriques
    var g=ctx.createLinearGradient(0,sz,sz,0);
    g.addColorStop(0,rndColor()); g.addColorStop(0.5,rndColor()); g.addColorStop(1,rndColor());
    ctx.fillStyle=g; ctx.fillRect(0,0,sz,sz);
    var n=14+Math.floor(Math.random()*10);
    for(var i=0;i<n;i++){
      var cx=Math.random()*sz, cy=Math.random()*sz, r=Math.random()*sz*.25+sz*.05;
      ctx.beginPath();
      ctx.moveTo(cx+r*Math.cos(0), cy+r*Math.sin(0));
      ctx.lineTo(cx+r*Math.cos(Math.PI*2/3), cy+r*Math.sin(Math.PI*2/3));
      ctx.lineTo(cx+r*Math.cos(Math.PI*4/3), cy+r*Math.sin(Math.PI*4/3));
      ctx.closePath();
      ctx.fillStyle=rndColorA(0.2,0.5); ctx.fill();
    }
  },
  function(ctx, sz){ // Spirale / tourbillon
    var g=ctx.createRadialGradient(sz/2,sz/2,0,sz/2,sz/2,sz*.7);
    var c1=rndColor(),c2=rndColor(),c3=rndColor();
    g.addColorStop(0,c1); g.addColorStop(0.5,c2); g.addColorStop(1,c3);
    ctx.fillStyle=g; ctx.fillRect(0,0,sz,sz);
    var turns=4+Math.floor(Math.random()*4), steps=360*turns;
    for(var i=0;i<steps;i++){
      var angle=i/steps*Math.PI*2*turns;
      var rad=i/steps*sz*.48;
      var px=sz/2+rad*Math.cos(angle), py=sz/2+rad*Math.sin(angle);
      ctx.beginPath(); ctx.arc(px,py,sz*.012,0,Math.PI*2);
      ctx.fillStyle=rndColorA(0.4,0.7); ctx.fill();
    }
  },
  function(ctx, sz){ // Hexagones
    var g=ctx.createLinearGradient(0,0,sz,sz);
    g.addColorStop(0,rndColor()); g.addColorStop(1,rndColor());
    ctx.fillStyle=g; ctx.fillRect(0,0,sz,sz);
    var hr=sz*.1, hh=hr*Math.sqrt(3);
    for(var row=-1;row<sz/hh+1;row++){
      for(var col=-1;col<sz/(hr*1.5)+1;col++){
        var hx=col*hr*3+(row%2)*hr*1.5, hy=row*hh;
        ctx.beginPath();
        for(var v=0;v<6;v++){
          var a=Math.PI/180*(60*v-30);
          v===0?ctx.moveTo(hx+hr*Math.cos(a),hy+hr*Math.sin(a)):ctx.lineTo(hx+hr*Math.cos(a),hy+hr*Math.sin(a));
        }
        ctx.closePath();
        ctx.fillStyle=rndColorA(0.15,0.4); ctx.fill();
        ctx.strokeStyle=rndColorA(0.1,0.2); ctx.lineWidth=1; ctx.stroke();
      }
    }
  },
  function(ctx, sz){ // Étoiles / points lumineux
    ctx.fillStyle='#0a0a1a'; ctx.fillRect(0,0,sz,sz);
    var g=ctx.createRadialGradient(sz*.4,sz*.4,0,sz*.5,sz*.5,sz*.7);
    g.addColorStop(0,rndColorA(0.5,0.8)); g.addColorStop(1,'transparent');
    ctx.fillStyle=g; ctx.fillRect(0,0,sz,sz);
    for(var i=0;i<120;i++){
      var x=Math.random()*sz, y=Math.random()*sz, r=Math.random()*sz*.018+sz*.003;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,'+(Math.random()*.8+0.2)+')'; ctx.fill();
    }
  }
];

function rndColor(){
  // Palette harmonieuse — évite les gris ternes
  var palettes=[
    ['#FF6B9D','#C44F8C','#FF9F68','#FFD93D','#6BCB77'],
    ['#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD'],
    ['#FF6347','#FF8C00','#FFD700','#9ACD32','#3CB371'],
    ['#1a1a2e','#16213e','#0f3460','#e94560','#533483'],
    ['#f8b500','#e91e8c','#27c0e5','#d7f205','#f05b4f'],
    ['#2d6a4f','#40916c','#52b788','#74c69d','#95d5b2'],
    ['#9b2226','#ae2012','#bb3e03','#ca6702','#ee9b00'],
    ['#7400b8','#6930c3','#5e60ce','#5390d9','#4ea8de'],
  ];
  var pal=palettes[Math.floor(Math.random()*palettes.length)];
  return pal[Math.floor(Math.random()*pal.length)];
}
function rndColorA(minA,maxA){
  var c=rndColor();
  var r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);
  var a=(minA+Math.random()*(maxA-minA)).toFixed(2);
  return 'rgba('+r+','+g+','+b+','+a+')';
}

function generatePuzzleCanvas(sz){
  var cvs=document.createElement('canvas');
  cvs.width=sz; cvs.height=sz;
  var ctx=cvs.getContext('2d');
  var theme=PUZZLE_THEMES[Math.floor(Math.random()*PUZZLE_THEMES.length)];
  theme(ctx,sz);
  return cvs.toDataURL();
}

var _puzzleLoading = false;
function generatePuzzleSource(sz, excludeImg){
  // 65% de chance d'avoir une photo du site
  if(Math.random() < 0.65){
    var available=PUZZLE_IMAGES.filter(function(img){ return img !== excludeImg; });
    if(available.length > 0){
      var chosen=available[Math.floor(Math.random()*available.length)];
      puzzleLastImage=chosen;
      return { type:'image', src:chosen };
    }
  }
  // Génération procédurale (fallback ou 35%)
  puzzleLastImage='';
  return { type:'canvas', src:generatePuzzleCanvas(sz) };
}

var puzzlePlayer=null, puzzleSize=3, puzzleOrder=[], puzzleSelected=null, puzzleMoveCount=0, puzzleDataURLCurrent='', puzzleSourceType='canvas', puzzleSourceSrc='';

function _openPuzzleGame(){
  resetZoom();
  _yamSlide(document.getElementById('puzzleView'), document.getElementById('gamesView'), 'forward');
  particleActive=false; hideDance();
  window.scrollTo(0,0);
  zplbLoad();
}
function _closePuzzleGame(){
  _yamSlide(document.getElementById('gamesView'), document.getElementById('puzzleView'), 'backward');
  puzzlePlayer=null;
  document.getElementById('puzzleGenderScreen').style.display='flex';
  document.getElementById('puzzleGameArea').style.display='none';
  document.getElementById('puzzleGenderGirl').className='gender-select-btn';
  document.getElementById('puzzleGenderBoy').className='gender-select-btn';
}
function puzzleSelectGender(g){
  puzzlePlayer=g;
  document.getElementById('puzzleGenderGirl').className='gender-select-btn'+(g==='girl'?' girl':'');
  document.getElementById('puzzleGenderBoy').className='gender-select-btn'+(g==='boy'?' boy':'');
  document.getElementById('puzzleGenderScreen').style.display='none';
  document.getElementById('puzzleGameArea').style.display='block';
  var sz=Math.min(340,window.innerWidth*0.92);
  var src=generatePuzzleSource(sz,'');
  puzzleSourceType=src.type; puzzleSourceSrc=src.src;
  if(src.type==='canvas'){ puzzleDataURLCurrent=src.src; puzzleInit(); }
  else { loadImageThenInit(src.src, sz); }
}
function puzzleSetSize(n, btn){
  if(_puzzleLoading) return;
  puzzleSize=n;
  document.querySelectorAll('.puzzle-size-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  if(puzzleSourceType==='image' && puzzleSourceSrc){
    var sz=Math.min(340,window.innerWidth*0.92);
    loadImageThenInit(puzzleSourceSrc, sz);
  } else {
    puzzleInit();
  }
}
function puzzleReplay(){
  if(_puzzleLoading) return;
  var sz=Math.min(340,window.innerWidth*0.92);
  var src=generatePuzzleSource(sz, puzzleLastImage||'');
  puzzleSourceType=src.type; puzzleSourceSrc=src.src;
  if(src.type==='canvas'){ puzzleDataURLCurrent=src.src; puzzleInit(); }
  else { loadImageThenInit(src.src, sz); }
}
function loadImageThenInit(imgSrc, sz){
  _puzzleLoading = true;
  var img=new Image();
  img.crossOrigin='anonymous';
  img.onload=function(){
    var cvs=document.createElement('canvas'); cvs.width=sz; cvs.height=sz;
    var ctx=cvs.getContext('2d');
    // object-fit cover
    var scale=Math.max(sz/img.naturalWidth, sz/img.naturalHeight);
    var bw=img.naturalWidth*scale, bh=img.naturalHeight*scale;
    ctx.drawImage(img,(sz-bw)/2,(sz-bh)/2,bw,bh);
    puzzleDataURLCurrent=cvs.toDataURL();
    _puzzleLoading = false;
    puzzleInit();
  };
  img.onerror=function(){
    // fallback canvas procédural
    puzzleDataURLCurrent=generatePuzzleCanvas(sz);
    _puzzleLoading = false;
    puzzleInit();
  };
  img.src=imgSrc;
}
function puzzleInit(){
  puzzleMoveCount=0; puzzleSelected=null;
  document.getElementById('puzzleMoves').textContent='0 échanges';
  document.getElementById('puzzleWin').style.display='none';
  var n=puzzleSize*puzzleSize;
  puzzleOrder=Array.from({length:n},function(_,i){return i;});
  for(var i=n-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=puzzleOrder[i];puzzleOrder[i]=puzzleOrder[j];puzzleOrder[j]=t;}
  renderPuzzle();
}
function renderPuzzle(){
  var grid=document.getElementById('puzzleGrid');
  var sz=Math.min(340,window.innerWidth*0.92);
  grid.style.gridTemplateColumns='repeat('+puzzleSize+',1fr)';
  grid.style.width=sz+'px'; grid.style.height=sz+'px';
  grid.innerHTML='';
  var pieceSz=sz/puzzleSize;
  // Le canvas généré fait exactement sz x sz, pas besoin de scale/offset
  puzzleOrder.forEach(function(pos,idx){
    var div=document.createElement('div'); div.className='puzzle-piece';
    var row=Math.floor(pos/puzzleSize), col=pos%puzzleSize;
    div.style.backgroundImage='url('+puzzleDataURLCurrent+')';
    div.style.backgroundSize=sz+'px '+sz+'px';
    div.style.backgroundPosition=(-col*pieceSz)+'px '+(-row*pieceSz)+'px';
    div.style.backgroundRepeat='no-repeat';
    if(pos===idx) div.classList.add('correct-pos');
    (function(i){ div.addEventListener('click',function(){ puzzleClick(i); }); })(idx);
    grid.appendChild(div);
  });
}
function puzzleClick(idx){
  if(puzzleSelected===null){
    puzzleSelected=idx;
    document.getElementById('puzzleGrid').children[idx].classList.add('selected');
  } else {
    if(puzzleSelected===idx){
      document.getElementById('puzzleGrid').children[idx].classList.remove('selected');
      puzzleSelected=null; return;
    }
    // Échange
    var t=puzzleOrder[puzzleSelected]; puzzleOrder[puzzleSelected]=puzzleOrder[idx]; puzzleOrder[idx]=t;
    puzzleMoveCount++;
    document.getElementById('puzzleMoves').textContent=puzzleMoveCount+' échange'+(puzzleMoveCount>1?'s':'');
    puzzleSelected=null;
    renderPuzzle();
    // Vérif victoire
    if(puzzleOrder.every(function(v,i){return v===i;})) puzzleWin();
  }
}
function puzzleShowPreview(){
  var w=document.getElementById('puzzleWin');
  w.style.display='block';
  w.innerHTML='<img src="'+puzzleDataURLCurrent+'" style="width:120px;height:120px;border-radius:8px;object-fit:cover;margin-bottom:8px"><br><button class="game-start-btn" onclick="document.getElementById(\'puzzleWin\').style.display=\'none\'">Fermer</button>';
}
function puzzleWin(){
  var score=Math.max(0,1000-puzzleMoveCount*5);
  var win=document.getElementById('puzzleWin'); win.style.display='block';
  win.innerHTML='<div style="font-size:44px">🏆</div><div style="font-family:\'Playfair Display\',serif;font-size:18px;font-weight:700;color:var(--text);margin:8px 0">Puzzle terminé !</div><div style="font-size:13px;color:var(--sub)">'+puzzleMoveCount+' échanges · '+score+' pts</div><button class="game-start-btn" style="margin-top:14px" onclick="puzzleReplay()">Rejouer 🔀</button>';
  if(puzzlePlayer){
    // ✅ FIX: Ajouter couple_id pour isoler les scores par couple
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(coupleId) {
      sbPost('game_scores',{couple_id:coupleId,game_id:'puzzle',player:puzzlePlayer,score:score,moves:puzzleMoveCount,time_seconds:0})
        .then(function(){ zplbLoad(); }).catch(function(){});
    }
  }
}

// Classement Puzzle
var zplbTab='all', zplbData=[];
function zplbSetTab(t){
  zplbTab=t;
  ['all','girl','boy'].forEach(function(x){
    document.getElementById('zplbTab'+x.charAt(0).toUpperCase()+x.slice(1)).className='lb-tab'+(x===t?' active-'+t:'');
  });
  zplbRender(zplbData);
}
function zplbLoad(){
  document.getElementById('zplbList').innerHTML='<div class="lb-loading">Chargement...</div>';
  // ✅ FIX: Filtrer par couple_id
  var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
  var coupleId = s && s.user ? s.user.couple_id : null;
  if(!coupleId) {
    document.getElementById('zplbList').innerHTML='<div class="lb-empty">Session expirée</div>';
    return;
  }
  sbGet('game_scores','couple_id=eq.' + coupleId + '&game_id=eq.puzzle&order=score.desc&limit=50').then(function(r){
    zplbData=Array.isArray(r)?r:[];zplbRender(zplbData);
  }).catch(function(){ document.getElementById('zplbList').innerHTML='<div class="lb-empty">❌ Erreur</div>'; });
}
function zplbRender(rows){
  renderLb('zplbList', zplbTab==='all'?rows:rows.filter(function(r){return r.player===zplbTab;}), function(r){ return '<span>'+parseInt(r.score||0)+'pts</span> · '+parseInt(r.moves||0)+' échanges'; });
}

// ══════════════════════════════════════════
// ── SNAKE ──
// ══════════════════════════════════════════
var snakePlayer=null, snakeRunning=false, snakeInterval=null;
var SNAKE_CELL=20, SNAKE_COLS=17, SNAKE_ROWS=17;
var snakeCvs, snakeCtx2, snakeBody=[], snakeDx=1, snakeDy=0, snakeNextDx=1, snakeNextDy=0;
var snakeFoodX=0, snakeFoodY=0, snakeFoodType='heart', snakeCurScore=0, snakeBestScore=0;
// Types de nourriture : heart (💕), apple (🍎), banana (🍌)
// Probabilités : 70% heart, 15% apple, 15% banana
var SNAKE_FOODS=['heart','heart','heart','heart','heart','heart','heart','apple','apple','banana','banana','banana','clown','skull'];
// Effet de brillance actif
var snakeGlowColor=null, snakeGlowEnd=0;
var snakeFrozen=false, snakeFreezeEnd=0;
var snakeSpeedBoost=false, snakeSpeedBoostEnd=0;
var snakeBaseMs=180; // vitesse progressive de base (jamais affectée par les bonus)

function _openSnakeGame(){
  resetZoom();
  _yamSlide(document.getElementById('snakeView'), document.getElementById('gamesView'), 'forward');
  particleActive=false; hideDance();
  window.scrollTo(0,0);
  slbLoad();
  snakeCvs=document.getElementById('snakeCanvas');
  snakeCtx2=snakeCvs.getContext('2d');
  var s=Math.min(340,window.innerWidth-32);
  snakeCvs.width=s; snakeCvs.height=s;
  SNAKE_CELL=Math.floor(s/SNAKE_COLS);
  snakeDrawIdle();
}
function _closeSnakeGame(){
  clearInterval(snakeInterval); snakeRunning=false;
  _yamSlide(document.getElementById('gamesView'), document.getElementById('snakeView'), 'backward');
  snakePlayer=null;
  document.getElementById('snakeGenderScreen').style.display='flex';
  document.getElementById('snakeGameArea').style.display='none';
  document.getElementById('snakeGenderGirl').className='gender-select-btn';
  document.getElementById('snakeGenderBoy').className='gender-select-btn';
}
function snakeSelectGender(g){
  snakePlayer=g;
  document.getElementById('snakeGenderGirl').className='gender-select-btn'+(g==='girl'?' girl':'');
  document.getElementById('snakeGenderBoy').className='gender-select-btn'+(g==='boy'?' boy':'');
  document.getElementById('snakeGenderScreen').style.display='none';
  document.getElementById('snakeGameArea').style.display='block';
  snakeBestScore=0;
  document.getElementById('snakeBest').textContent='0';
  document.getElementById('snakeOverlayTitle').textContent='Snake 🐍';
  document.getElementById('snakeOverlaySub').textContent='Mange les 💕 sans te mordre la queue';
  document.getElementById('snakeOverlay').style.display='flex';
  snakeCvs=document.getElementById('snakeCanvas');
  snakeCtx2=snakeCvs.getContext('2d');
  var s=Math.min(340,window.innerWidth-32);
  snakeCvs.width=s; snakeCvs.height=s;
  SNAKE_CELL=Math.floor(s/SNAKE_COLS);
  snakeDrawIdle();
}
function snakeDrawIdle(){
  if(!snakeCtx2) return;
  snakeCtx2.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--s1').trim()||'#181818';
  snakeCtx2.fillRect(0,0,snakeCvs.width,snakeCvs.height);
}
var snakeStartTime=0, snakeTickMs=180;
var SNAKE_SPEED_INIT=252, SNAKE_SPEED_MIN=154, SNAKE_SPEED_RAMP=300000; // 5 min en ms
function snakeStart(){
  document.getElementById('snakeOverlay').style.display='none';
  clearInterval(snakeInterval);
  var mid=Math.floor(SNAKE_COLS/2);
  snakeBody=[{x:mid,y:mid},{x:mid-1,y:mid},{x:mid-2,y:mid}];
  snakeDx=1; snakeDy=0; snakeNextDx=1; snakeNextDy=0;
  snakeCurScore=0;
  snakeGlowColor=null; snakeGlowEnd=0;
  snakeFrozen=false; snakeFreezeEnd=0;
  snakeSpeedBoost=false; snakeSpeedBoostEnd=0;
  snakeBaseMs=SNAKE_SPEED_INIT;
  snakeStartTime=Date.now();
  snakeTickMs=SNAKE_SPEED_INIT;
  document.getElementById('snakeScore').textContent='0';
  snakePlaceFood();
  snakeInterval=setInterval(snakeTick, snakeTickMs);
  snakeRunning=true;
  snakeAnimFrame();
}
function snakeAnimFrame(){
  if(!snakeRunning) return;
  snakeDraw();
  requestAnimationFrame(snakeAnimFrame);
}
function snakePlaceFood(){
  do{ snakeFoodX=Math.floor(Math.random()*SNAKE_COLS); snakeFoodY=Math.floor(Math.random()*SNAKE_ROWS); }
  while(snakeBody.some(function(s){ return s.x===snakeFoodX&&s.y===snakeFoodY; }));
  snakeFoodType=SNAKE_FOODS[Math.floor(Math.random()*SNAKE_FOODS.length)];
}
function snakeTick(){
  var now2=Date.now();
  // Fin du freeze clown
  if(snakeFrozen&&now2>=snakeFreezeEnd){ snakeFrozen=false; }
  if(snakeFrozen) return; // serpent immobile
  // Fin du speed boost crâne
  if(snakeSpeedBoost&&now2>=snakeSpeedBoostEnd){
    snakeSpeedBoost=false;
    clearInterval(snakeInterval);
    snakeTickMs=snakeBaseMs;
    snakeInterval=setInterval(snakeTick,snakeTickMs);
  }
  snakeDx=snakeNextDx; snakeDy=snakeNextDy;
  var head={x:snakeBody[0].x+snakeDx, y:snakeBody[0].y+snakeDy};
  // Traversée des murs (wrap)
  head.x=(head.x+SNAKE_COLS)%SNAKE_COLS;
  head.y=(head.y+SNAKE_ROWS)%SNAKE_ROWS;
  // Mort = collision avec soi-même seulement
  if(snakeBody.some(function(s){return s.x===head.x&&s.y===head.y;})){
    snakeGameOver(); return;
  }
  snakeBody.unshift(head);
  if(head.x===snakeFoodX&&head.y===snakeFoodY){
    snakeCurScore+=10;
    document.getElementById('snakeScore').textContent=snakeCurScore;
    // Déclencher l'effet selon le fruit
    if(snakeFoodType==='apple'){
      snakeGlowColor='apple'; snakeGlowEnd=Date.now()+5000;
    } else if(snakeFoodType==='banana'){
      snakeGlowColor='banana'; snakeGlowEnd=Date.now()+5000;
    } else if(snakeFoodType==='clown'){
      // Freeze 3s
      snakeFrozen=true; snakeFreezeEnd=Date.now()+3000;
      snakeGlowColor='clown'; snakeGlowEnd=Date.now()+3000;
    } else if(snakeFoodType==='skull'){
      // Speed boost +40% pendant 3s
      // snakeBaseMs already tracks the progressive base speed
      snakeSpeedBoost=true; snakeSpeedBoostEnd=Date.now()+4000;
      snakeGlowColor='skull'; snakeGlowEnd=Date.now()+4000;
      var boostedMs=Math.max(50,Math.round(snakeTickMs*0.6));
      clearInterval(snakeInterval);
      snakeTickMs=boostedMs;
      snakeInterval=setInterval(snakeTick, snakeTickMs);
    } else {
      if(snakeGlowEnd<Date.now()) snakeGlowColor=null;
    }
    snakePlaceFood();
  } else { snakeBody.pop(); }
  // Vitesse progressive sur 5 min (seulement hors boost crâne)
  if(!snakeSpeedBoost){
    var elapsed=Math.min(Date.now()-snakeStartTime, SNAKE_SPEED_RAMP);
    var t=elapsed/SNAKE_SPEED_RAMP;
    var newMs=Math.round(SNAKE_SPEED_INIT-(SNAKE_SPEED_INIT-SNAKE_SPEED_MIN)*t);
    if(newMs!==snakeBaseMs){
      snakeBaseMs=newMs;
      snakeTickMs=newMs;
      clearInterval(snakeInterval);
      snakeInterval=setInterval(snakeTick, snakeTickMs);
    }
  }
}
function snakeDraw(){
  var ctx=snakeCtx2, c=SNAKE_CELL;
  var isLight=document.body.classList.contains('light');
  ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--s1').trim()||(isLight?'#fff5f8':'#181818');
  ctx.fillRect(0,0,snakeCvs.width,snakeCvs.height);
  // Grille légère
  ctx.strokeStyle=isLight?'rgba(200,24,94,0.05)':'rgba(255,255,255,0.03)';
  ctx.lineWidth=0.5;
  for(var i=0;i<=SNAKE_COLS;i++){ctx.beginPath();ctx.moveTo(i*c,0);ctx.lineTo(i*c,snakeCvs.height);ctx.stroke();}
  for(var j=0;j<=SNAKE_ROWS;j++){ctx.beginPath();ctx.moveTo(0,j*c);ctx.lineTo(snakeCvs.width,j*c);ctx.stroke();}
  // Food
  var foodEmoji=snakeFoodType==='apple'?'🍎':snakeFoodType==='banana'?'🍌':snakeFoodType==='clown'?'🤡':snakeFoodType==='skull'?'💀':'💕';
  ctx.font=Math.floor(c*0.82)+'px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(foodEmoji,snakeFoodX*c+c/2,snakeFoodY*c+c/2);
  // Calcul glow actif
  var now=Date.now();
  var glowActive=snakeGlowColor&&now<snakeGlowEnd;
  var glowPhase=glowActive?Math.sin(now/120)*0.5+0.5:0; // 0..1 oscillation rapide
  // Serpent
  snakeBody.forEach(function(s,i){
    var alpha=i===0?1:0.75-i*0.02;
    var baseColor='rgba(61,155,212,'+Math.max(0.3,alpha)+')';
    if(glowActive){
      // Calcul couleur de glow selon fruit
      var gr,gg,gb;
      if(snakeGlowColor==='apple'){ gr=220; gg=60; gb=60; }
      else if(snakeGlowColor==='banana'){ gr=240; gg=210; gb=40; }
      else if(snakeGlowColor==='clown'){ gr=180; gg=80; gb=220; }   // violet clown
      else { gr=180; gg=20; gb=20; }                                  // rouge sombre crâne
      var blend=0.35+glowPhase*0.5; // intensité pulsante
      var ar=Math.round(61*(1-blend)+gr*blend);
      var ag=Math.round(155*(1-blend)+gg*blend);
      var ab=Math.round(212*(1-blend)+gb*blend);
      baseColor='rgba('+ar+','+ag+','+ab+','+Math.max(0.35,alpha)+')';
    }
    ctx.fillStyle=baseColor;
    ctx.beginPath();
    ctx.roundRect(s.x*c+1,s.y*c+1,c-2,c-2,i===0?6:4);
    ctx.fill();
    // Halo externe sur la tête si glow actif
    if(i===0&&glowActive){
      var gr2,gg2,gb2;
      if(snakeGlowColor==='apple'){ gr2=255; gg2=80; gb2=80; }
      else if(snakeGlowColor==='banana'){ gr2=255; gg2=230; gb2=50; }
      else if(snakeGlowColor==='clown'){ gr2=200; gg2=100; gb2=255; }
      else { gr2=220; gg2=30; gb2=30; }
      var glowAlpha=(0.2+glowPhase*0.5).toFixed(2);
      var glowSize=Math.round(3+glowPhase*5);
      ctx.save();
      ctx.shadowColor='rgba('+gr2+','+gg2+','+gb2+',0.8)';
      ctx.shadowBlur=glowSize*2;
      ctx.fillStyle='rgba('+gr2+','+gg2+','+gb2+','+glowAlpha+')';
      ctx.beginPath();
      ctx.roundRect(s.x*c+1,s.y*c+1,c-2,c-2,6);
      ctx.fill();
      ctx.restore();
    }
    // Yeux tête
    if(i===0){
      ctx.fillStyle='#fff';
      ctx.fillRect(s.x*c+c*0.25,s.y*c+c*0.25,c*0.15,c*0.15);
      ctx.fillRect(s.x*c+c*0.55,s.y*c+c*0.25,c*0.15,c*0.15);
    }
  });
  // Halo de fond sur tout le canvas si glow
  if(glowActive){
    var gr3,gg3,gb3;
    if(snakeGlowColor==='apple'){ gr3=220; gg3=50; gb3=50; }
    else if(snakeGlowColor==='banana'){ gr3=240; gg3=200; gb3=30; }
    else if(snakeGlowColor==='clown'){ gr3=180; gg3=80; gb3=220; }
    else { gr3=200; gg3=20; gb3=20; }
    var bgAlpha=(0.04+glowPhase*0.06).toFixed(3);
    ctx.fillStyle='rgba('+gr3+','+gg3+','+gb3+','+bgAlpha+')';
    ctx.fillRect(0,0,snakeCvs.width,snakeCvs.height);
  }
}
function snakeGameOver(){
  clearInterval(snakeInterval); snakeRunning=false;
  if(snakeCurScore>snakeBestScore){ snakeBestScore=snakeCurScore; document.getElementById('snakeBest').textContent=snakeBestScore; }
  document.getElementById('snakeOverlayTitle').textContent='Game Over 💀';
  document.getElementById('snakeOverlaySub').textContent='Score : '+snakeCurScore+' pts';
  document.getElementById('snakeOverlay').style.display='flex';
  if(snakePlayer&&snakeCurScore>0){
    // ✅ FIX: Ajouter couple_id pour isoler les scores par couple
    var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
    var coupleId = s && s.user ? s.user.couple_id : null;
    if(coupleId) {
      sbPost('game_scores',{couple_id:coupleId,game_id:'snake',player:snakePlayer,score:snakeCurScore,moves:0,time_seconds:0})
        .then(function(){ slbLoad(); }).catch(function(){});
    }
  }
}
function snakeDir(dx,dy){
  if(!snakeRunning) return;
  if(dx===1&&snakeDx===-1) return; if(dx===-1&&snakeDx===1) return;
  if(dy===1&&snakeDy===-1) return; if(dy===-1&&snakeDy===1) return;
  snakeNextDx=dx; snakeNextDy=dy;
}
// Clavier
document.addEventListener('keydown',function(e){
  if(!snakeRunning) return;
  var map={'ArrowUp':[0,-1],'ArrowDown':[0,1],'ArrowLeft':[-1,0],'ArrowRight':[1,0]};
  if(map[e.key]){ e.preventDefault(); snakeDir(map[e.key][0],map[e.key][1]); }
});

// Classement Snake
var slbTab='all', slbData=[];
function slbSetTab(t){
  slbTab=t;
  ['all','girl','boy'].forEach(function(x){
    document.getElementById('slbTab'+x.charAt(0).toUpperCase()+x.slice(1)).className='lb-tab'+(x===t?' active-'+t:'');
  });
  slbRender(slbData);
}
function slbLoad(){
  document.getElementById('slbList').innerHTML='<div class="lb-loading">Chargement...</div>';
  // ✅ FIX: Filtrer par couple_id
  var s = JSON.parse(localStorage.getItem('yam_v2_session') || 'null');
  var coupleId = s && s.user ? s.user.couple_id : null;
  if(!coupleId) {
    document.getElementById('slbList').innerHTML='<div class="lb-empty">Session expirée</div>';
    return;
  }
  sbGet('game_scores','couple_id=eq.' + coupleId + '&game_id=eq.snake&order=score.desc&limit=50').then(function(r){
    slbData=Array.isArray(r)?r:[];slbRender(slbData);
  }).catch(function(){ document.getElementById('slbList').innerHTML='<div class="lb-empty">❌ Erreur</div>'; });
}
function slbRender(rows){
  renderLb('slbList', slbTab==='all'?rows:rows.filter(function(r){return r.player===slbTab;}), function(r){ return '<span>'+parseInt(r.score||0)+'pts</span>'; });
}

// ── Fonction commune de rendu leaderboard ──
function renderLb(elId, rows, detailFn){
  var list=document.getElementById(elId);
  var top=rows.slice(0,10);
  if(!top.length){ list.innerHTML='<div class="lb-empty">Aucun score encore 🎮</div>'; return; }
  var icons=['🥇','🥈','🥉'];
  list.innerHTML=top.map(function(r,i){
    var rc=i===0?'gold':i===1?'silver':i===2?'bronze':'';
    return '<div class="lb-row"><div class="lb-rank '+rc+'">'+(i<3?icons[i]:i+1)+'</div><div class="lb-dot '+(r.player==='girl'?'girl':'boy')+'"></div><div class="lb-name">'+(typeof v2GetDisplayName==="function"?v2GetDisplayName(r.player):(r.player==="girl"?"Elle":"Lui"))+'</div><div class="lb-score">'+detailFn(r)+'</div></div>';
  }).join('');
}
