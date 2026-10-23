/* Câlin à tapoter (n°31) : têtes de peluches, aucun texte, aucun réseau.
   Mode écoute : musique en cours + 15 s sans taper → casque, yeux fermés, notes. */
(function(){
'use strict';
var box=document.getElementById('loveBox'); if(!box) return;
function sh(h,p){var n=parseInt(h.slice(1),16),r=n>>16,g=n>>8&255,b=n&255,t=p<0?0:255,a=Math.abs(p);r=Math.round((t-r)*a+r);g=Math.round((t-g)*a+g);b=Math.round((t-b)*a+b);return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}
var A={
 cat:{n:'Chaton',c:'#f6c48c',belly:'#fff1de',acc:'bow',p:['🐾','💗','✨','🐟']},
 bunny:{n:'Lapin',c:'#fdf6f8',belly:'#ffe3ea',acc:'carrot',p:['🥕','💗','✨','🌸']},
 bear:{n:'Ourson',c:'#c98f5c',belly:'#f1cfa6',acc:'scarf',p:['🍯','💗','✨','🧡']},
 fox:{n:'Renard',c:'#f28a3c',belly:'#fff1de',acc:'leaf',p:['🍂','🧡','✨','🌰']},
 panda:{n:'Panda',c:'#fbfbfd',belly:'#ffffff',acc:'bamboo',p:['🎋','💗','✨','🤍']},
 pig:{n:'Cochon',c:'#ffb3c4',belly:'#ffd9e2',acc:'flower',p:['🌸','💗','✨','🍓']},
 chick:{n:'Poussin',c:'#ffe36a',belly:'#fff6c8',acc:'shell',p:['🐣','💗','✨','🌼']},
 frog:{n:'Grenouille',c:'#8fdc7a',belly:'#d8f5c8',acc:'lily',p:['🪷','💚','✨','🫧']},
 koala:{n:'Koala',c:'#b9bdca',belly:'#f4f4f8',acc:'euca',p:['🌿','💗','✨','🍃']},
 sheep:{n:'Mouton',c:'#ffffff',belly:'#ffffff',acc:'bell',p:['☁️','💗','✨','🧶']},
 penguin:{n:'Pingouin',c:'#46536e',belly:'#ffffff',acc:'hat',p:['❄️','💙','✨','🐟']},
 hamster:{n:'Hamster',c:'#f5c98c',belly:'#fff4e8',acc:'seed',p:['🌻','💗','✨','🌰']},
 mouse:{n:'Souris',c:'#cdd2de',belly:'#f4f4fa',acc:'cheese',p:['🧀','💗','✨','⭐']}
};
var KEYS=['cat','bunny','bear','fox','panda','pig','mouse','chick','frog','koala','sheep','hamster'];
var look={x:0,y:0};

var HEAD='M-54 4C-54 -28 -30 -42 0 -42C30 -42 54 -28 54 4C54 32 30 50 0 50C-30 50 -54 32 -54 4Z';
function ears(k,c){
  var d=sh(c,-.16),inn='#ffb3c4',s='';
  var T=function(sx){return '<g class="cl-ear"><path d="M'+sx*50+' -4L'+sx*46+' -62L'+sx*8+' -38Z" fill="url(#clg1)" stroke="url(#clg1)" stroke-width="10" stroke-linejoin="round"/><path d="M'+sx*41+' -24L'+sx*40+' -50L'+sx*21+' -38Z" fill="'+(k=='fox'?'#3a2630':inn)+'" stroke="'+(k=='fox'?'#3a2630':inn)+'" stroke-width="4" stroke-linejoin="round"/></g>'};
  if(k=='cat'||k=='fox')s=T(-1)+T(1);
  if(k=='bunny'){var B=function(sx){return '<g class="cl-ear" transform="rotate('+sx*9+' '+sx*24+' -36)"><ellipse cx="'+sx*24+'" cy="-60" rx="13" ry="27" fill="url(#clg1)" stroke="'+d+'" stroke-width="1.4"/><ellipse cx="'+sx*24+'" cy="-58" rx="6.5" ry="19" fill="'+inn+'"/></g>'};s=B(-1)+B(1)}
  if(k=='bear'||k=='mouse'||k=='panda'){var r=k=='mouse'?19:15,col=k=='panda'?'#2a2a33':'url(#clg1)',R=function(sx){return '<g class="cl-ear"><circle cx="'+sx*40+'" cy="-30" r="'+r+'" fill="'+col+'" stroke="'+d+'" stroke-width="1.4"/><circle cx="'+sx*40+'" cy="-30" r="'+(r-7)+'" fill="'+(k=='panda'?'#3d3d4a':inn)+'"/></g>'};s=R(-1)+R(1)}
  if(k=='pig'){var G=function(sx){return '<g class="cl-ear"><path d="M'+sx*48+' -14L'+sx*42+' -66L'+sx*10+' -38Z" fill="#ff9db2" stroke="#ff9db2" stroke-width="10" stroke-linejoin="round"/><path d="M'+sx*40+' -26L'+sx*37+' -46L'+sx*22+' -38Z" fill="#ff7a98" stroke="#ff7a98" stroke-width="4" stroke-linejoin="round"/></g>'};s=G(-1)+G(1)}
  if(k=='chick')s='<path d="M-6 -40Q-12 -58 -3 -66M2 -40Q4 -62 15 -66M9 -40Q19 -54 25 -50" stroke="'+d+'" stroke-width="5" fill="none" stroke-linecap="round"/>';
  if(k=='frog'){var Fr=function(sx){return '<g class="cl-ear"><circle cx="'+sx*30+'" cy="-34" r="17" fill="url(#clg1)" stroke="'+d+'" stroke-width="1.4"/><circle cx="'+sx*30+'" cy="-34" r="9" fill="#c6f2b8"/></g>'};s=Fr(-1)+Fr(1)}
  if(k=='koala'){var Ko=function(sx){return '<g class="cl-ear"><circle cx="'+sx*44+'" cy="-24" r="22" fill="url(#clg1)" stroke="'+d+'" stroke-width="1.4"/><circle cx="'+sx*44+'" cy="-24" r="13" fill="#f4f4f8"/></g>'};s=Ko(-1)+Ko(1)}
  if(k=='sheep'){s='<g class="cl-ear"><ellipse cx="-56" cy="2" rx="10" ry="15" fill="#f3dcc6" stroke="#d9b99c" stroke-width="1.2" transform="rotate(25 -56 2)"/><ellipse cx="56" cy="2" rx="10" ry="15" fill="#f3dcc6" stroke="#d9b99c" stroke-width="1.2" transform="rotate(-25 56 2)"/></g>'+[[-30,-34,16],[-10,-44,17],[12,-45,17],[32,-34,16],[-48,-10,13],[48,-10,13]].map(function(q){return '<circle cx="'+q[0]+'" cy="'+q[1]+'" r="'+q[2]+'" fill="#fff" stroke="#e3dcee" stroke-width="1.2"/>'}).join('')}
  if(k=='hamster'){var Ha=function(sx){return '<g class="cl-ear"><circle cx="'+sx*36+'" cy="-32" r="13" fill="url(#clg1)" stroke="'+d+'" stroke-width="1.4"/><circle cx="'+sx*36+'" cy="-32" r="7" fill="'+inn+'"/></g>'};s=Ha(-1)+Ha(1)}
  return s;
}
function acc(a){
  if(a=='shell')return '<path d="M-30 -30L-22 -43L-14 -32L-6 -45L2 -32L10 -45L18 -32L26 -43L32 -30Q0 -21 -30 -30Z" fill="#fffaf0" stroke="#d8cdb8" stroke-width="1.3" stroke-linejoin="round"/>';
  if(a=='lily')return '<g transform="translate(0,-44)"><ellipse rx="24" ry="7" fill="#5fcf6a" stroke="#3a9a4a" stroke-width="1.2"/><g transform="translate(8,-7)">'+[0,72,144,216,288].map(function(r){return '<ellipse cx="0" cy="-6" rx="4.5" ry="6.5" fill="#ffd0e0" stroke="#f08fb0" stroke-width="1" transform="rotate('+r+')"/>'}).join('')+'<circle r="3.5" fill="#ffd54a"/></g></g>';
  if(a=='euca')return '<g transform="translate(40,-48) rotate(20)"><path d="M0 0v-14" stroke="#4a8a5a" stroke-width="2"/><ellipse cx="-7" cy="-10" rx="7" ry="4" fill="#7bc79a" stroke="#4a8a5a" stroke-width="1" transform="rotate(-30 -7 -10)"/><ellipse cx="7" cy="-16" rx="7" ry="4" fill="#9be0b4" stroke="#4a8a5a" stroke-width="1" transform="rotate(30 7 -16)"/><ellipse cx="0" cy="-22" rx="6" ry="3.6" fill="#7bc79a" stroke="#4a8a5a" stroke-width="1" transform="rotate(-80 0 -22)"/></g>';
  if(a=='bell')return '<g transform="translate(-38,-26)"><path d="M-9 -4Q0 -14 9 -4L12 6L-12 6Z" fill="#ff7aa2" stroke="#d6336b" stroke-width="1.2" opacity="0"/><circle r="7.5" fill="#ffd54a" stroke="#e0a800" stroke-width="1.3"/><path d="M-4 3h8" stroke="#e0a800" stroke-width="1.6"/><circle cy="6" r="1.8" fill="#e0a800"/></g>';
  if(a=='hat')return '<g transform="translate(0,-34)"><path d="M-38 4Q-30 -34 0 -36Q30 -34 38 4Q0 -6 -38 4Z" fill="#e8465f" stroke="#b8304a" stroke-width="1.4"/><rect x="-40" y="0" width="80" height="10" rx="5" fill="#fff" stroke="#e3dcee" stroke-width="1.2"/><circle cy="-38" r="7.5" fill="#fff" stroke="#e3dcee" stroke-width="1.2"/></g>';
  if(a=='seed')return '<g transform="translate(40,38) rotate(25)"><ellipse rx="6.5" ry="10" fill="#5a4a3a"/><path d="M-3 -6v12M3 -6v12" stroke="#e8e0d0" stroke-width="1.4"/></g>';
  if(a=='bow')return '<g transform="translate(34,-34) rotate(18)"><path d="M0 0L-16-9V9zM0 0L16-9V9z" fill="#ff4d85" stroke="#d6336b" stroke-width="1.5" stroke-linejoin="round"/><circle r="4.5" fill="#ff7fa8" stroke="#d6336b" stroke-width="1.2"/></g>';
  if(a=='scarf')return '<g transform="translate(-16,-26) rotate(-18)"><rect x="-11" y="-5" width="22" height="10" rx="2" fill="#ffd9b0" stroke="#d9a070" stroke-width="1.2"/><rect x="-3" y="-5" width="6" height="10" fill="#f6c28f"/><circle cx="-7" cy="0" r="1" fill="#d9a070"/><circle cx="7" cy="0" r="1" fill="#d9a070"/></g>';
  if(a=='leaf')return '<g transform="translate(4,-38) rotate(-15)"><path d="M0 0q14-22 28-6q-10 16-28 6z" fill="#7bd36b" stroke="#4aa14a" stroke-width="1.2"/><path d="M2 0q12-6 22-5" stroke="#4aa14a" stroke-width="1.2" fill="none"/></g>';
  if(a=='flower')return '<g transform="translate(-34,-40)">'+[0,72,144,216,288].map(function(r){return '<ellipse cx="0" cy="-8" rx="6" ry="8" fill="#fff" stroke="#f3a3c0" stroke-width="1" transform="rotate('+r+')"/>'}).join('')+'<circle r="5" fill="#ffd54a"/></g>';
  if(a=='carrot')return '<g transform="translate(42,32) rotate(25) scale(1.5)"><path d="M0 18L-7-4h14z" fill="#ff9a3c" stroke="#e07a1c" stroke-width="1"/><path d="M0-4l-5-9M0-4v-11M0-4l5-9" stroke="#5fcf6a" stroke-width="3" stroke-linecap="round"/></g>';
  if(a=='bamboo')return '<g transform="translate(44,-34) rotate(14) scale(1.3)"><rect x="-5" y="-26" width="10" height="30" rx="3" fill="#8be39a" stroke="#4aa86a" stroke-width="1.2"/><path d="M-4-10h8" stroke="#4aa86a" stroke-width="1.4"/><path d="M3-22q14-8 18 0q-10 6-18 0z" fill="#9be3a0" stroke="#4aa86a" stroke-width="1"/></g>';
  if(a=='cheese')return '<g transform="translate(46,36) rotate(-10) scale(1.5)"><path d="M-12 8h26l-4-18z" fill="#ffd54a" stroke="#e0a800" stroke-width="1.2" stroke-linejoin="round"/><circle cx="4" cy="1" r="2.4" fill="#e0a800"/><circle cx="9" cy="-4" r="1.8" fill="#e0a800"/></g>';
  return '';
}
function eyes(hot,k){
  var x=look.x*3,y=look.y*2.5;
  if(hot)return '<path d="M-24 4q7-9 14 0M10 4q7-9 14 0" stroke="#3a2630" stroke-width="3.6" fill="none" stroke-linecap="round"/>';
  var pc=k=='panda';
  var e=function(cx){return '<g class="cl-blink">'+(pc?'<ellipse cx="'+cx+'" cy="3" rx="12" ry="15" fill="#2a2a33" transform="rotate('+(cx<0?20:-20)+' '+cx+' 3)"/>':'')+'<g transform="translate('+x+','+y+')"><ellipse cx="'+cx+'" cy="3" rx="6.2" ry="8" fill="#2f1f2a"/><circle cx="'+(cx+2)+'" cy="-.5" r="2.6" fill="#fff"/><circle cx="'+(cx-2)+'" cy="7" r="1.3" fill="#fff" opacity=".8"/></g></g>'};
  return e(-18)+e(18);
}
var HEADPHONES='<path d="M-52 -2C-52 -52 52 -52 52 -2" fill="none" stroke="#ff4d85" stroke-width="7" stroke-linecap="round"/><path d="M-52 -2C-52 -52 52 -52 52 -2" fill="none" stroke="#ff8fb8" stroke-width="2" stroke-linecap="round" transform="translate(0,-1)" opacity=".7"/><rect x="-62" y="-12" width="17" height="34" rx="8" fill="#ff4d85" stroke="#d6336b" stroke-width="1.5"/><rect x="45" y="-12" width="17" height="34" rx="8" fill="#ff4d85" stroke="#d6336b" stroke-width="1.5"/><rect x="-59" y="-6" width="6" height="22" rx="3" fill="#ffc2d8" opacity=".6"/><rect x="53" y="-6" width="6" height="22" rx="3" fill="#ffc2d8" opacity=".6"/>';
function extraHead(k){
  if(k=='fox')return '<g clip-path="url(#clhc)"><path d="M-58 6Q-28 0 0 26Q28 0 58 6V60H-58Z" fill="#fff1de"/></g>';
  if(k=='sheep')return '<ellipse cx="0" cy="8" rx="38" ry="34" fill="#f3dcc6" stroke="#d9b99c" stroke-width="1.2"/>';
  if(k=='penguin')return '<path d="M-38 6Q-30 -8 -10 -6Q0 -2 10 -6Q30 -8 38 6Q40 34 0 46Q-40 34 -38 6Z" fill="#fff"/>';
  return '';
}
function extra(k,hot){
  if(k=='chick'||k=='penguin')return {snout:'<path d="M-10 13L10 13L0 26Z" fill="'+(k=='chick'?'#ff9a3c':'#ffb03c')+'" stroke="#e07a1c" stroke-width="1.2" stroke-linejoin="round"/>',mouth:''};
  if(k=='frog')return {snout:'<circle cx="-6" cy="11" r="1.7" fill="#3a6b3a"/><circle cx="6" cy="11" r="1.7" fill="#3a6b3a"/>',mouth:hot?'<path d="M-28 19Q0 44 28 19Q0 27 -28 19Z" fill="#c23a5e"/>':'<path d="M-28 19Q0 36 28 19" stroke="#2f5a2f" stroke-width="2.4" fill="none" stroke-linecap="round"/>'};
  if(k=='koala')return {snout:'<ellipse cx="0" cy="12" rx="11" ry="15" fill="#2f2a33"/><ellipse cx="-3" cy="6" rx="3" ry="1.6" fill="#fff" opacity=".5"/>',mouth:hot?'<path d="M-8 30q8 10 16 0z" fill="#c23a5e"/>':'<path d="M-6 31q3 3 6 0q3 3 6 0" stroke="#3a2630" stroke-width="2" fill="none" stroke-linecap="round"/>'};
  if(k=='sheep')return {snout:'<ellipse cx="0" cy="14" rx="8" ry="6" fill="#ffb3c4"/>',mouth:hot?'<path d="M-8 22q8 12 16 0z" fill="#c23a5e"/>':'<path d="M0 20v3M-6 23q3 3 6 0q3 3 6 0" stroke="#3a2630" stroke-width="2" fill="none" stroke-linecap="round"/>'};
  if(k=='hamster')return {snout:'<ellipse cx="-30" cy="20" rx="17" ry="13" fill="#fff4e8" opacity=".9"/><ellipse cx="30" cy="20" rx="17" ry="13" fill="#fff4e8" opacity=".9"/><path d="M-4.5 10q4.5-4 9 0q-1 4-4.5 5q-3.5-1-4.5-5z" fill="#ff8fa6"/>',mouth:hot?'<path d="M-8 20q8 12 16 0z" fill="#c23a5e"/>':'<path d="M0 15v4M-6 19q3 3 6 0q3 3 6 0" stroke="#3a2630" stroke-width="2" fill="none" stroke-linecap="round"/><rect x="-3.5" y="21" width="7" height="6" rx="1.5" fill="#fff" stroke="#c9a" stroke-width="1"/>'};
  return null;
}
function pet(i,hot,secret,listen){
  var k=KEYS[i%KEYS.length],a=A[k],c=a.c,dk=sh(c,-.16),panda=k=='panda';
  var g='<defs><radialGradient id="clg1" cx=".35" cy=".25" r=".95"><stop offset="0" stop-color="'+sh(c,.5)+'"/><stop offset=".5" stop-color="'+c+'"/><stop offset="1" stop-color="'+sh(c,-.2)+'"/></radialGradient><clipPath id="clhc"><path d="'+HEAD+'"/></clipPath></defs>';
  var head='<path d="'+HEAD+'" fill="url(#clg1)" stroke="'+dk+'" stroke-width="1.6"/><path d="M-44 6C-44 -20 -26 -32 0 -32C26 -32 44 -20 44 6" fill="none" stroke="'+sh(c,.4)+'" stroke-width="1.2" stroke-dasharray="3 4" opacity=".6"/><ellipse cx="-24" cy="-26" rx="15" ry="7" fill="#fff" opacity=".4" transform="rotate(-24 -24 -26)"/>';
  var fox=extraHead(k);
  var snout=k=='pig'?'<ellipse cx="0" cy="15" rx="17" ry="12" fill="#ff8fa6" stroke="#e8708a" stroke-width="1.2"/><ellipse cx="-6" cy="15" rx="3" ry="4.2" fill="#c23a5e"/><ellipse cx="6" cy="15" rx="3" ry="4.2" fill="#c23a5e"/>':
   '<ellipse cx="0" cy="17" rx="15" ry="11" fill="'+(panda||k=='bunny'?'#f6e3e8':'#fff4e8')+'" opacity=".95"/><path d="M-4.5 11q4.5-4 9 0q-1 5-4.5 6q-3.5-1-4.5-6z" fill="#3a2630"/><ellipse cx="-1.4" cy="11.2" rx="1.8" ry="1" fill="#fff" opacity=".7"/>';
  var mouth=k=='pig'?(hot?'<path d="M-7 29q7 8 14 0z" fill="#c23a5e"/>':'<path d="M-6 29q6 4 12 0" stroke="#3a2630" stroke-width="2" fill="none" stroke-linecap="round"/>'):
   (hot?'<path d="M-8 22q8 13 16 0z" fill="#c23a5e"/><path d="M-4 27q4 5 8 0" fill="#ff8aa6"/>':'<path d="M0 17v4M-7 21q3.5 3.5 7 0q3.5 3.5 7 0" stroke="#3a2630" stroke-width="2" fill="none" stroke-linecap="round"/>');
  var X=extra(k,hot);if(X){snout=X.snout;mouth=X.mouth;}
  var cheeks='<ellipse cx="-35" cy="20" rx="9" ry="6" fill="#ff7aa2" opacity="'+(hot?.95:.55)+'"/><ellipse cx="35" cy="20" rx="9" ry="6" fill="#ff7aa2" opacity="'+(hot?.95:.55)+'"/>'+(hot?'<path d="M-39 16l3 5M-34 15l3 5M32 15l3 5M37 16l3 5" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>':'');
  var whisk=(k=='cat'||k=='fox'||k=='mouse')?'<path d="M-43 15h-17M-43 22l-16 5M43 15h17M43 22l16 5" stroke="#6b4a40" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>':'';
  var crown=secret?'<g transform="translate(0,-46) scale(1.35)"><path d="M-18 2l-4-18 11 9 11-14 11 14 11-9-4 18z" fill="#ffd54a" stroke="#e0a800" stroke-width="1.5" stroke-linejoin="round"/><circle cx="0" cy="-10" r="3" fill="#ff4d85"/></g>':'';
  var sec=secret?'<defs><linearGradient id="clrb"><stop offset="0" stop-color="#ff8fb8"/><stop offset=".5" stop-color="#ffe27a"/><stop offset="1" stop-color="#8fc9ff"/></linearGradient></defs><circle cy="-4" r="82" fill="none" stroke="url(#clrb)" stroke-width="3" stroke-dasharray="4 8"/>':'';
  return g+sec+'<ellipse class="cl-sh" cx="0" cy="62" rx="40" ry="6" fill="#7a2a5a" opacity=".2"/><g class="'+(listen?'cl-bob':'cl-breathe')+'" id="clbod">'+ears(k,c)+head+fox+'<g id="clface" transform="translate(0,6)">'+(listen?'<path d="M-25 4q7 7 14 0M11 4q7 7 14 0" stroke="#3a2630" stroke-width="3.6" fill="none" stroke-linecap="round"/>':eyes(hot,k))+'</g><g transform="translate(0,6)">'+snout+mouth+whisk+'</g>'+cheeks+acc(a.acc)+crown+(listen?HEADPHONES:'')+'</g>';
}

var LS='yam_calin', st={taps:0,seen:[]};
try{ var o=JSON.parse(localStorage.getItem(LS)||'{}'); st.taps=o.taps|0; st.seen=Array.isArray(o.seen)?o.seen:[]; }catch(e){}
function save(){ try{ localStorage.setItem(LS,JSON.stringify(st)); }catch(e){} }
function see(k){ if(st.seen.indexOf(k)<0) st.seen.push(k); }
var NB=KEYS.length;
var h='<div class="cl-rays"></div><div class="cl-glow"></div>';
for(var b=0;b<6;b++) h+='<i class="cl-bub" style="left:'+(5+Math.random()*90)+'%;width:'+(6+Math.random()*12)+'px;height:'+(6+Math.random()*12)+'px;animation-duration:'+(6+Math.random()*7)+'s;animation-delay:-'+(Math.random()*8)+'s"></i>';
box.innerHTML=h+'<svg class="cl-pet" id="calinSvg" viewBox="-85 -92 170 160" aria-hidden="true"></svg><svg class="cl-ring" aria-hidden="true"><rect x="3" y="3" rx="21" ry="21" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" pathLength="100" stroke-dasharray="0 100"/></svg><button type="button" class="lb-info" id="loveBoxInfo" aria-label="Infos">i</button><div class="lb-tip" id="loveBoxTip"></div>';
var P=document.getElementById('calinSvg'), ring=box.querySelector('.cl-ring rect'), tip=document.getElementById('loveBoxTip'), gl=box.querySelector('.cl-glow'), info=document.getElementById('loveBoxInfo');
function sz(){ var r=box.getBoundingClientRect(); if(r.width){ ring.setAttribute('width',Math.max(0,r.width-6)); ring.setAttribute('height',Math.max(0,r.height-6)); } }
var cur=Math.floor(st.taps/8)%NB, sec=false, listening=false, noteIv=null, calm=null, tipT=null, combo=0, last=Date.now();
function draw(hot,s){ sec=!!s; P.innerHTML=pet(cur,hot,s,listening&&!hot); see(s?'S':KEYS[cur%NB]); }
function vis(){ return box.offsetParent!==null && !document.hidden; }
function playing(){ try{ return typeof _gAudio!=='undefined' && _gAudio && !_gAudio.paused && !!_gAudio.src; }catch(e){ return false; } }
function burst(n,s){
  var r=P.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2, set=A[KEYS[cur%NB]].p;
  for(var k=0;k<n;k++)(function(k){ setTimeout(function(){
    var p=document.createElement('div'); p.className='cl-p'; p.textContent=Math.random()<.35?set[0]:set[1+Math.floor(Math.random()*3)];
    p.style.left=cx+'px'; p.style.top=cy+'px'; p.style.fontSize=(12+Math.random()*18)+'px'; document.body.appendChild(p);
    var a=(Math.random()*260-130)*Math.PI/180, d=70+Math.random()*80;
    p.animate([{transform:'translate(0,0) scale(.5)',opacity:1},{transform:'translate('+Math.cos(a)*d+'px,'+(Math.sin(a)*d-60)+'px) scale(1.3) rotate('+(Math.random()*90-45)+'deg)',opacity:0}],{duration:850,easing:'cubic-bezier(.2,.9,.3,1)'}).onfinish=function(){ p.remove(); };
  },k*35); })(k);
}
function note(){
  var r=P.getBoundingClientRect(), p=document.createElement('div'); p.className='cl-p cl-note';
  p.textContent=['♪','♫','♬','🎵'][Math.floor(Math.random()*4)];
  p.style.left=(r.left+r.width/2+(Math.random()<.5?-55:55))+'px'; p.style.top=(r.top+40)+'px'; p.style.fontSize=(16+Math.random()*10)+'px'; document.body.appendChild(p);
  p.animate([{transform:'translate(0,0) scale(.7)',opacity:1},{transform:'translate('+(Math.random()*40-20)+'px,-70px) scale(1.2) rotate('+(Math.random()*40-20)+'deg)',opacity:0}],{duration:1600,easing:'ease-out'}).onfinish=function(){ p.remove(); };
}
function startListen(){ if(listening) return; listening=true; draw(false,sec); noteIv=setInterval(function(){ if(vis()) note(); },700); }
function stopListen(){ if(!listening) return; listening=false; clearInterval(noteIv); noteIv=null; }
draw(false,false); sz(); window.addEventListener('resize',sz);
info.addEventListener('click',function(e){
  e.stopPropagation(); sz();
  tip.textContent='Peluches découvertes '+st.seen.length+'/'+(NB+1)+' · '+st.taps+' taps';
  tip.classList.add('on'); clearTimeout(tipT); tipT=setTimeout(function(){ tip.classList.remove('on'); },3000);
});
box.addEventListener('click',function(){
  var n=Date.now(); combo=(n-last<450)?Math.min(combo+1,12):0; last=n; st.taps++;
  stopListen();
  var hot=combo>=4, s=st.taps===100;
  cur=Math.floor(st.taps/8)%NB; if(!s&&Math.random()<.1) cur=Math.floor(Math.random()*NB);
  draw(hot,s); save();
  P.querySelectorAll('.cl-ear').forEach(function(e){ e.classList.remove('cl-wig'); void e.getBoundingClientRect(); e.classList.add('cl-wig'); });
  P.animate([{transform:'scale(1.28,.72) translateY(6px)'},{transform:'scale(.88,1.16)',offset:.45},{transform:'scale(1)'}],{duration:360,easing:'cubic-bezier(.3,1.6,.5,1)'});
  ring.setAttribute('stroke-dasharray',(combo/12*100)+' 100');
  gl.style.opacity=hot?.95:''; gl.style.transform=hot?'scale(1.3)':'';
  if(hot) box.animate([{transform:'translateX(0)'},{transform:'translateX(2px)'},{transform:'translateX(-2px)'},{transform:'translateX(0)'}],{duration:120});
  try{ if(navigator.vibrate) navigator.vibrate(hot?18:8); }catch(e){}
  clearTimeout(calm); calm=setTimeout(function(){ combo=0; ring.setAttribute('stroke-dasharray','0 100'); gl.style.opacity=''; gl.style.transform=''; draw(false,sec); },1300);
  burst(s?24:(hot?10:6),s);
});
/* mode écoute : vérifié chaque seconde, seulement si le bouton est visible */
setInterval(function(){
  if(!vis()){ if(listening) stopListen(); return; }
  if(!playing()){ if(listening){ stopListen(); draw(false,sec); } return; }
  if(!listening && Date.now()-last>=15000) startListen();
},1000);
/* les yeux suivent le doigt / curseur (seulement si visible) */
var rafP=false;
window.addEventListener('pointermove',function(e){
  if(rafP||listening||!vis()) return; rafP=true;
  requestAnimationFrame(function(){
    rafP=false; var r=box.getBoundingClientRect();
    var lx=Math.max(-1,Math.min(1,(e.clientX-(r.left+r.width/2))/(r.width/2))), ly=Math.max(-1,Math.min(1,(e.clientY-(r.top+r.height/2))/(r.height/2)));
    P.querySelectorAll('#clface > g.cl-blink > g').forEach(function(g){ g.setAttribute('transform','translate('+lx*3+','+ly*2.5+')'); });
    look.x=lx; look.y=ly;
  });
},{passive:true});
setInterval(function(){ if(vis()&&!listening&&Date.now()-last>3000) P.querySelectorAll('.cl-ear').forEach(function(e){ e.classList.remove('cl-wig'); void e.getBoundingClientRect(); e.classList.add('cl-wig'); }); },5000);
})();
