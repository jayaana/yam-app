// app-ocho.js — Ocho multijoueur temps réel
// Version 3.0 — Mars 2026
// Dépendances : app-core.js, app-account.js, app-multiplayer.js
// Globals : SB_URL, sb2Headers(), getProfile(), v2GetDisplayName(),
//           _yamSlide(), showToast(), haptic(), YAMMultiplayer, escHtml()

/* ══════════════════════════════════════════════════════
   OCHO — Jeu de cartes multijoueur (type UNO)
   108 cartes, 6 manches, 7 cartes en main
   Cartes spéciales : +1(Q), +2(K), Blocage(J), 8(joker), Swap(main)
   v3 : vraies cartes SVG, animations vol, draw+pass, double-clic, aura, photos
══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var OCHO_TABLE    = 'ocho_games';
  var OCHO_PRESENCE = 'ocho_presence';
  var TURN_DURATION = 20;

  var _mp            = null;
  var _me            = null;
  var _other         = null;
  var _state         = null;
  var _timerRAF      = null;
  var _timerFired    = false;
  var _reactCooldown = false;
  var _lastReactTs   = 0;
  var _ochoAuraOn    = false;
  var _pillOpen      = false;
  var _selectedCard  = null;
  var _drawnThisTurn = false;
  var _passAvailable = false;

  // ─── Deck ─────────────────────────────────────────────
  var SUITS  = ['heart','club','spade','diamond'];
  var _cardId = 0;
  function _mkCard(suit, value) { return { id: ++_cardId, suit: suit, value: value }; }

  function buildDeck() {
    var d = [];
    SUITS.forEach(function (s) {
      d.push(_mkCard(s,'0'));
      for (var n=1;n<=9;n++) { d.push(_mkCard(s,String(n))); d.push(_mkCard(s,String(n))); }
      d.push(_mkCard(s,'+1')); d.push(_mkCard(s,'+1'));
      d.push(_mkCard(s,'+2')); d.push(_mkCard(s,'+2'));
      d.push(_mkCard(s,'block')); d.push(_mkCard(s,'block'));
    });
    for (var i=0;i<4;i++) d.push(_mkCard('wild','8'));
    for (var j=0;j<4;j++) d.push(_mkCard('swap','swap'));
    return _shuffle(d);
  }

  function _shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
  function _dealHand(deck,n){var h=[];for(var i=0;i<n;i++)h.push(deck.pop());return h;}
  function _reshuffleDiscard(state){var top=state.discard[state.discard.length-1];state.deck=_shuffle(state.discard.slice(0,state.discard.length-1));state.discard=[top];}

  // ─── Règles ───────────────────────────────────────────
  function _isPlayable(card,state){
    var top=state.discard[state.discard.length-1];if(!top)return true;
    if(card.value==='8'||card.value==='swap')return true;
    var ac=state.current_color||top.suit;
    return card.suit===ac||card.value===top.value;
  }
  function _playableCards(hand,state){return hand.filter(function(c){return _isPlayable(c,state);});}

  function _applyCard(state,card,player,chosenColor){
    var ns=_deepCopy(state);
    var other=player==='girl'?'boy':'girl';
    var hand=player==='girl'?ns.girl_hand:ns.boy_hand;
    var idx=hand.findIndex(function(c){return c.id===card.id;});
    if(idx!==-1)hand.splice(idx,1);
    if(player==='girl')ns.girl_hand=hand;else ns.boy_hand=hand;
    ns.discard.push(card);
    ns.current_color=(card.suit==='wild'||card.suit==='swap')?(chosenColor||'heart'):card.suit;
    ns.draw_penalty=null;
    if(card.value==='+1'){ns.draw_penalty={target:other,count:1};ns.turn=other;}
    else if(card.value==='+2'){ns.draw_penalty={target:other,count:2};ns.turn=other;}
    else if(card.value==='block'){ns.turn=player;}
    else if(card.value==='8'){ns.current_color=chosenColor||'heart';ns.turn=other;}
    else if(card.value==='swap'){var tmp=ns.girl_hand;ns.girl_hand=ns.boy_hand;ns.boy_hand=tmp;ns.turn=other;}
    else{ns.turn=other;}
    ns.ts_turn=Date.now();ns.ocho_declared=null;
    var mha=player==='girl'?ns.girl_hand:ns.boy_hand;
    if(mha.length===0){ns.phase='round_end';ns.round_winner=player;ns.wins[player]=(ns.wins[player]||0)+1;}
    return ns;
  }

  function _drawCard(state,player){
    var ns=_deepCopy(state);
    if(ns.deck.length===0)_reshuffleDiscard(ns);
    if(ns.deck.length===0)return ns;
    var card=ns.deck.pop();
    if(player==='girl')ns.girl_hand.push(card);else ns.boy_hand.push(card);
    ns.turn=player;ns.ts_turn=Date.now();
    return ns;
  }

  function _applyDrawPenalty(state){
    var ns=_deepCopy(state);if(!ns.draw_penalty)return ns;
    for(var i=0;i<ns.draw_penalty.count;i++){
      if(ns.deck.length===0)_reshuffleDiscard(ns);
      if(ns.deck.length===0)break;
      ns[ns.draw_penalty.target+'_hand'].push(ns.deck.pop());
    }
    ns.draw_penalty=null;return ns;
  }

  function _deepCopy(o){return JSON.parse(JSON.stringify(o));}

  // ─── Couleurs ─────────────────────────────────────────
  var SUIT_COLORS ={heart:'#E04E3E',club:'#4CB8A0',spade:'#5070B8',diamond:'#E89030'};
  var SUIT_BG_DARK={heart:'#8B1A10',club:'#145A38',spade:'#162060',diamond:'#7A3A00'};
  var SUIT_DARK   ={heart:'#bf3020',club:'#3A9E88',spade:'#3A58A0',diamond:'#C07010'};
  var SUIT_SYMS   ={heart:'\u2665',club:'\u2663',spade:'\u2660',diamond:'\u2666'};

  // ─── SVG inline des 4 symboles (remplace Bootstrap Icons) ────
  // Chaque fonction retourne un SVG string à la taille voulue
  var _SUIT_SVG = {
    heart: function(sz,col){
      return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 16 16" fill="'+col+'" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;">'+
        '<path d="M8 14.25l-.35-.3C3.4 10.15 1 8.02 1 5.5 1 3.42 2.62 2 4.5 2c1.03 0 2.04.5 2.68 1.3L8 4.48l.82-.18C9.46 2.5 10.47 2 11.5 2 13.38 2 15 3.42 15 5.5c0 2.52-2.4 4.65-6.65 8.45L8 14.25z"/>'+
      '</svg>';
    },
    diamond: function(sz,col){
      return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 16 16" fill="'+col+'" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;">'+
        '<path d="M8 1l7 7-7 7L1 8z"/>'+
      '</svg>';
    },
    club: function(sz,col){
      return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 16 16" fill="'+col+'" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;">'+
        '<path d="M8 1a3 3 0 0 0-2.83 4.02A3 3 0 1 0 8 11.5a3 3 0 1 0 2.83-6.48A3 3 0 0 0 8 1zm0 10.5c-.55 0-1.05.1-1.5.28V13h3v-1.22A4 4 0 0 1 8 11.5z"/>'+
      '</svg>';
    },
    spade: function(sz,col){
      return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 16 16" fill="'+col+'" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;">'+
        '<path d="M8 1L1 8a4 4 0 0 0 5.5 5.8C6.19 14.4 6 15 6 15h4s-.19-.6-.5-1.2A4 4 0 0 0 15 8z"/>'+
      '</svg>';
    }
  };

  // Icône SVG grosse (fond de carte)
  function _suitBgSVG(suit, color, small) {
    var sz = small ? 68 : 72;
    var fn = _SUIT_SVG[suit];
    if (!fn) return '';
    var top  = small ? -16 : -18;
    var left = small ? -18 : -14;
    return '<div style="position:absolute;top:'+top+'px;left:'+left+'px;pointer-events:none;opacity:1;line-height:0;">'+
      fn(sz, color)+
    '</div>';
  }

  // Icône SVG petite (sous-label)
  function _suitSmSVG(suit, color, sz) {
    var fn = _SUIT_SVG[suit];
    return fn ? fn(sz, color) : '';
  }

  // ─── Rendu d'une vraie carte ──────────────────────────
  function _cardInner(card, small) {
    var fs  = small ? 13 : 16;
    var sub = small ? 8  : 10;
    var suit = card.suit, val = card.value;

    if (val === '8')    return _card8Inner(null, small);
    if (val === 'swap') return _cardSwapInner(small);

    var bg   = SUIT_COLORS[suit]||'#888';
    var dark = SUIT_DARK[suit]||'#555';

    var displayVal = val==='block' ? '\u2298' : val;
    var subHtml;
    if (val==='+1')
      subHtml='<span style="font-family:Arial Rounded MT Bold,Arial Black,sans-serif;font-size:'+sub+'px;font-weight:900;color:'+dark+'">Q</span>'+_suitSmSVG(suit,dark,sub);
    else if (val==='+2')
      subHtml='<span style="font-family:Arial Rounded MT Bold,Arial Black,sans-serif;font-size:'+sub+'px;font-weight:900;color:'+dark+'">K</span>'+_suitSmSVG(suit,dark,sub);
    else if (val==='block')
      subHtml='<span style="font-family:Arial Rounded MT Bold,Arial Black,sans-serif;font-size:'+sub+'px;font-weight:900;color:'+dark+'">J</span>'+_suitSmSVG(suit,dark,sub);
    else
      subHtml=_suitSmSVG(suit,dark,sub+3);

    return '<div style="position:absolute;inset:0;background:'+bg+';">'+
      _suitBgSVG(suit,'#F2E8D4',small)+
      '<div style="position:absolute;top:'+(small?4:5)+'px;left:'+(small?5:7)+'px;display:flex;flex-direction:column;align-items:center;z-index:2;">'+
        '<div style="font-family:Arial Rounded MT Bold,Arial Black,sans-serif;font-size:'+fs+'px;font-weight:900;line-height:1;letter-spacing:-0.06em;color:'+dark+';">'+displayVal+'</div>'+
        '<div style="display:flex;align-items:center;gap:1px;margin-top:1px;">'+subHtml+'</div>'+
      '</div>'+
    '</div>';
  }

  function _card8Inner(chosenColor, small) {
    var w = small?50:52, h = small?70:73;
    var inner = '';
    if (chosenColor && SUIT_COLORS[chosenColor]) {
      inner = '<div style="position:absolute;inset:0;background:'+SUIT_COLORS[chosenColor]+';"></div>'+
              '<div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent,'+SUIT_BG_DARK[chosenColor]+'88);"></div>';
    } else {
      inner = '<svg style="position:absolute;top:-2px;left:-2px;width:calc(100% + 4px);height:calc(100% + 4px);" viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">'+
        '<polygon points="0,0 '+w+',0 '+w+','+(h*0.42)+' '+(w/2)+','+(h*0.56)+' 0,'+(h*0.42)+'" fill="#C8392B"/>'+
        '<polygon points="'+w+',0 '+w+','+h+' '+(w*0.6)+','+h+' '+(w/2)+','+(h*0.56)+'" fill="#2E8B6A"/>'+
        '<polygon points="0,'+h+' '+w+','+h+' '+(w*0.6)+','+h+' '+(w/2)+','+(h*0.56)+' 0,'+(h*0.7)+'" fill="#2D4F9E"/>'+
        '<polygon points="0,0 0,'+h+' '+(w/2)+','+(h*0.56)+' 0,'+(h*0.42)+'" fill="#C87020"/>'+
      '</svg>';
    }
    inner += '<svg style="position:absolute;top:-2px;left:-2px;width:calc(100% + 4px);height:calc(100% + 4px);overflow:visible;" viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg">'+
      '<text x="'+(w/2)+'" y="'+(h*0.945)+'" text-anchor="middle" '+
      'font-family="Arial Rounded MT Bold,Arial Black,system-ui,sans-serif" font-weight="900" font-size="'+(h*1.23)+'" '+
      'fill="#F2E8D4" opacity="0.95" transform="rotate(8,'+(w/2)+','+(h*0.945)+')" '+
      'dominant-baseline="auto">8</text></svg>';
    return '<div style="position:absolute;inset:0;">'+inner+'</div>';
  }

  function _cardSwapInner(small) {
    var w = small?50:52, h = small?70:73;
    return '<div style="position:absolute;inset:0;">'+
      '<svg style="position:absolute;top:-2px;left:-2px;width:calc(100% + 4px);height:calc(100% + 4px);" viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg">'+
        '<polygon points="0,0 '+w+',0 '+w+','+(h*0.42)+' '+(w/2)+','+(h*0.56)+' 0,'+(h*0.42)+'" fill="#C8392B"/>'+
        '<polygon points="'+w+',0 '+w+','+h+' '+(w*0.6)+','+h+' '+(w/2)+','+(h*0.56)+'" fill="#2E8B6A"/>'+
        '<polygon points="0,'+h+' '+w+','+h+' '+(w*0.6)+','+h+' '+(w/2)+','+(h*0.56)+' 0,'+(h*0.7)+'" fill="#2D4F9E"/>'+
        '<polygon points="0,0 0,'+h+' '+(w/2)+','+(h*0.56)+' 0,'+(h*0.42)+'" fill="#C87020"/>'+
      '</svg>'+
      '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">'+
        '<svg width="30" height="18" viewBox="0 0 30 18" fill="none">'+
          '<path d="M2 5 L13 5 L9.5 2 M13 5 L9.5 8" stroke="#F2E8D4" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>'+
          '<path d="M28 13 L17 13 L20.5 10 M17 13 L20.5 16" stroke="#F2E8D4" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>'+
        '</svg>'+
      '</div>'+
    '</div>';
  }

  // ─── CSS ─────────────────────────────────────────────
  function _injectCSS(){
    if(document.getElementById('ochoStyles'))return;
    var s=document.createElement('style');s.id='ochoStyles';
    s.textContent=
/* Pas d'import CDN externe — SVG inline + police système */
'#ochoView{display:none;position:fixed;inset:0;z-index:200;overflow:hidden;font-family:Bricolage Grotesque,system-ui,sans-serif;}'+
'#ochoView.active{display:block!important;}'+
'#ochoBg{position:absolute;inset:0;background:linear-gradient(180deg,#f2a890 0%,#eaa078 16%,#c87850 32%,#b06838 52%,#985828 68%,#804818 82%,#6a3c14 100%);}'+
'#ochoSky{position:absolute;top:0;left:0;right:0;height:36%;background:linear-gradient(180deg,#f0a490 0%,#e8b898 38%,#bcd4c8 76%,#a8c8ba 100%);}'+
'.oc-cloud{position:absolute;background:rgba(255,242,235,0.78);border-radius:40px;}'+
'.oc-mesa{position:absolute;background:#7a3818;}'+
'.oc-rock{position:absolute;background:#8a4422;border-radius:50%;}'+
'.oc-cv{position:absolute;background:#385c28;border-radius:3px;}'+
'.oc-ch{position:absolute;background:#385c28;border-radius:2px;}'+
'#ochoAura{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:5;}'+
'#ochoAura.active{animation:ochoAuraAnim 1.2s ease-in-out infinite;opacity:1;}'+
'@keyframes ochoAuraAnim{0%{box-shadow:inset 0 0 0px 0px rgba(220,60,40,0);}40%{box-shadow:inset 0 0 60px 20px rgba(220,60,40,0.45),inset 0 0 120px 40px rgba(220,60,40,0.2);}100%{box-shadow:inset 0 0 0px 0px rgba(220,60,40,0);}}'+
'#ochoAnimZone{position:absolute;top:46px;left:0;right:0;height:130px;display:flex;align-items:center;justify-content:center;z-index:20;pointer-events:none;overflow:hidden;}'+
'#ochoAnimText{font-family:Bricolage Grotesque,system-ui,sans-serif;font-size:48px;font-weight:900;color:#F2E8D4;text-shadow:0 4px 20px rgba(0,0,0,0.4);opacity:0;letter-spacing:-1px;}'+
'@keyframes ochoPopIn{0%{opacity:0;transform:scale(0.4) rotate(-8deg);}60%{opacity:1;transform:scale(1.15) rotate(3deg);}80%{transform:scale(0.95) rotate(-1deg);}100%{opacity:1;transform:scale(1) rotate(0);}}'+
'@keyframes ochoPopOut{0%{opacity:1;transform:scale(1);}100%{opacity:0;transform:scale(1.3);}}'+
'.oc-anim-show{animation:ochoPopIn 0.5s cubic-bezier(.34,1.56,.64,1) forwards;}'+
'.oc-anim-hide{animation:ochoPopOut 0.3s ease-in forwards;}'+
'#ochoLayout{position:absolute;top:112px;bottom:80px;left:0;right:0;display:none;flex-direction:column;justify-content:center;padding:0 16px;}'+
'#ochoLayout.visible{display:flex;}'+
'#ochoOppBlock{display:flex;flex-direction:column;align-items:center;gap:0;margin-bottom:4px;}'+
'#ochoTopArc{position:relative;width:260px;height:85px;margin:0 auto;}'+
'#ochoTopArc .oc-arc-bk{position:absolute;width:48px;height:67px;border-radius:9px;border:2px solid rgba(242,232,212,0.65);background:repeating-linear-gradient(135deg,#2a1205 0px,#2a1205 6px,#3a1a0a 6px,#3a1a0a 12px);box-shadow:0 4px 14px rgba(0,0,0,0.5);transform-origin:center 130px;}'+
'#ochoTopArc .oc-arc-bk::after{content:\'\';position:absolute;inset:5px;border-radius:5px;border:1px solid rgba(242,232,212,0.12);}'+
'#ochoOppCardBadge{position:absolute;top:-6px;right:-6px;background:#e75a7c;color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;z-index:10;}'+
'.oc-profile-pill{display:inline-flex;align-items:center;gap:12px;padding:7px 18px 7px 7px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:36px;backdrop-filter:blur(10px);margin-top:6px;align-self:flex-start;}'+
'.oc-av-wrap{position:relative;width:68px;height:68px;flex-shrink:0;}'+
'.oc-av-wrap svg{position:absolute;inset:0;transform:rotate(-90deg);width:100%;height:100%;}'+
'.oc-av-face{position:absolute;inset:8px;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;}'+
'.oc-av-face img{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;}'+
'.oc-av-partner{background:linear-gradient(135deg,#c87840,#7a4020);}'+
'.oc-av-me{background:linear-gradient(135deg,#7040b0,#402880);}'+
'.oc-p-name{font-family:Bricolage Grotesque,system-ui,sans-serif;font-size:20px;font-weight:900;color:#F2E8D4;line-height:1;}'+
'.oc-p-sub{font-size:13px;color:rgba(242,232,212,0.45);font-weight:600;margin-top:4px;letter-spacing:0.03em;}'+
'#ochoOppPresenceDot{position:absolute;bottom:6px;right:6px;width:12px;height:12px;border-radius:50%;background:#555;border:2px solid rgba(0,0,0,0.4);transition:background 0.3s;}'+
'#ochoOppPresenceDot.online{background:#22c55e!important;box-shadow:0 0 5px rgba(34,197,94,0.7)!important;}'+
'#ochoTableWrap{display:flex;align-items:center;justify-content:center;margin:14px 0;}'+
'#ochoTable{width:240px;height:150px;border-radius:50%;position:relative;'+
'background:radial-gradient(ellipse at 32% 30%,rgba(80,52,30,0.55) 0%,transparent 58%),radial-gradient(ellipse at 72% 74%,rgba(15,8,4,0.5) 0%,transparent 55%),linear-gradient(150deg,#382010 0%,#241208 45%,#180c06 100%);'+
'border:1.5px solid rgba(140,90,35,0.3);box-shadow:0 10px 44px rgba(0,0,0,0.75),inset 0 1px 0 rgba(255,255,255,0.035);}'+
'#ochoTableRound{position:absolute;top:10px;right:14px;color:rgba(200,140,50,0.5);font-size:11px;font-weight:700;}'+
'#ochoPiles{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:16px;}'+
'.oc-pile-wrap{position:relative;width:50px;height:70px;}'+
'.oc-slot{position:absolute;inset:0;border-radius:8px;background:rgba(0,0,0,0.38);box-shadow:inset 0 2px 6px rgba(0,0,0,0.65);}'+
'.oc-mc{width:50px;height:70px;border-radius:8px;border:2.5px solid rgba(242,232,212,0.88);position:absolute;top:0;left:0;overflow:hidden;box-shadow:0 3px 10px rgba(0,0,0,0.5);cursor:pointer;}'+
'.oc-mc-sym{position:absolute;font-size:64px;top:-16px;left:-18px;color:#F2E8D4;line-height:1;pointer-events:none;}'+
'.oc-mc-val{font-family:Arial Rounded MT Bold,Arial Black,sans-serif;font-size:13px;font-weight:900;position:absolute;top:4px;left:5px;z-index:2;line-height:1;}'+
'.oc-mc-sub{font-size:9px;font-weight:900;font-family:Arial Rounded MT Bold,Arial Black,sans-serif;position:absolute;top:20px;left:5px;z-index:2;}'+
'.oc-mc.h{background:#E04E3E;border-color:#F2E8D4;}.oc-mc.h .oc-mc-val,.oc-mc.h .oc-mc-sub{color:#bf3020;}'+
'.oc-mc.c{background:#4CB8A0;border-color:#F2E8D4;}.oc-mc.c .oc-mc-val,.oc-mc.c .oc-mc-sub{color:#3A9E88;}'+
'.oc-mc.s{background:#5070B8;border-color:#F2E8D4;}.oc-mc.s .oc-mc-val,.oc-mc.s .oc-mc-sub{color:#3A58A0;}'+
'.oc-mc.d{background:#E89030;border-color:#F2E8D4;}.oc-mc.d .oc-mc-val,.oc-mc.d .oc-mc-sub{color:#C07010;}'+
'.oc-mc.oc-bk{background:repeating-linear-gradient(135deg,#2a1205 0px,#2a1205 6px,#3a1a0a 6px,#3a1a0a 12px);}.oc-mc.oc-bk::after{content:\'\';position:absolute;inset:5px;border-radius:4px;border:1px solid rgba(242,232,212,0.14);}'+
'.oc-deck-n{position:absolute;top:-7px;right:-7px;z-index:10;background:#160a04;color:rgba(242,232,212,0.8);border:1.5px solid rgba(180,120,35,0.6);border-radius:9px;padding:1px 5px;font-size:9px;font-weight:900;font-family:Arial Black,sans-serif;}'+
'.oc-suit-dot{position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);width:18px;height:18px;border-radius:50%;border:2px solid rgba(242,232,212,0.75);display:flex;align-items:center;justify-content:center;font-size:9px;color:rgba(242,232,212,0.9);box-shadow:0 2px 6px rgba(0,0,0,0.5);z-index:10;}'+
'#ochoTimerBar{position:absolute;bottom:0;left:0;right:0;height:3px;background:rgba(255,255,255,0.08);border-radius:0 0 50% 50%;overflow:hidden;}'+
'#ochoTimerFill{height:100%;width:100%;background:#FFD700;transform-origin:left;}'+
'#ochoMeBlock{display:flex;flex-direction:column;align-items:center;gap:0;margin-top:4px;}'+
'#ochoMeRow{display:flex;align-items:center;gap:0;align-self:stretch;margin-bottom:10px;}'+
'#ochoMeProfile{display:flex;align-items:center;gap:12px;}'+
'#ochoBtn{margin-left:auto;background:linear-gradient(135deg,#c83020,#e04535);color:#F2E8D4;border:2px solid rgba(242,232,212,0.75);border-radius:18px;padding:8px 16px;font-size:13px;font-weight:900;font-family:Bricolage Grotesque,system-ui,sans-serif;letter-spacing:0.04em;box-shadow:0 3px 12px rgba(200,50,30,0.4);cursor:pointer;white-space:nowrap;}'+
'#ochoMeTurnPill{display:none;margin-top:3px;align-items:center;gap:5px;background:rgba(255,215,0,0.12);border:1px solid rgba(255,215,0,0.35);border-radius:20px;padding:4px 11px;font-size:12px;font-weight:700;color:#FFD700;}'+
'#ochoMeTurnPill.visible{display:inline-flex;}'+
'.oc-turn-dot{width:7px;height:7px;border-radius:50%;background:#FFD700;box-shadow:0 0 5px 2px rgba(255,215,0,0.7);}'+
'#ochoPassBtn{display:none;margin:0 auto 6px;padding:7px 22px;background:rgba(255,255,255,0.12);color:#F2E8D4;border:1px solid rgba(255,255,255,0.3);border-radius:20px;font-size:12px;font-weight:700;font-family:Bricolage Grotesque,system-ui,sans-serif;cursor:pointer;backdrop-filter:blur(8px);}'+
'#ochoPassBtn.visible{display:block;}'+
'#ochoBotArc{position:relative;width:300px;height:95px;margin:0 auto;}'+
/* Vraie carte dans l'arc */
'.oc-card{position:absolute;width:52px;height:73px;border-radius:9px;border:2.5px solid #F2E8D4;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.5);cursor:pointer;transition:box-shadow 0.15s;}'+
'.oc-card.playable{box-shadow:0 0 0 2.5px #FFD700,0 4px 16px rgba(255,210,0,0.35)!important;}'+
'.oc-card.selected{box-shadow:0 0 0 3px #FFD700,0 8px 24px rgba(255,215,0,0.55)!important;}'+
'.oc-card.unplayable{opacity:0.32;filter:saturate(0.2);}'+
'#ochoHint{display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:5px 14px;margin-top:6px;backdrop-filter:blur(8px);}'+
'.oc-hint-suit{font-size:14px;line-height:1;}'+
'.oc-hint-text{font-size:11px;font-weight:700;color:rgba(242,232,212,0.7);letter-spacing:0.03em;}'+
'.oc-hint-badge{color:#F2E8D4;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:900;font-family:Arial Black,sans-serif;}'+
'.oc-hint-badge.heart{background:#E04E3E;}.oc-hint-badge.club{background:#4CB8A0;}.oc-hint-badge.spade{background:#5070B8;}.oc-hint-badge.diamond{background:#E89030;}'+
'#ochoSafeZone{position:absolute;bottom:0;left:0;right:0;height:80px;display:flex;align-items:center;justify-content:space-between;padding:0 24px 64px;z-index:50;}'+
'.oc-btn-round{width:46px;height:46px;border-radius:50%;background:rgba(0,0,0,0.35);border:1.5px solid rgba(255,255,255,0.15);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;transition:transform 0.15s;-webkit-tap-highlight-color:transparent;}'+
'.oc-btn-round:active{transform:scale(0.9);}'+
'#ochoEmojiWrap{position:relative;display:flex;align-items:center;}'+
'#ochoEmojiPill{display:flex;align-items:center;gap:2px;background:rgba(0,0,0,0.55);border:1.5px solid rgba(255,255,255,0.2);backdrop-filter:blur(14px);border-radius:30px;position:absolute;bottom:0;left:52px;white-space:nowrap;max-width:0;overflow:hidden;opacity:0;padding:0;transition:max-width 0.32s cubic-bezier(.4,0,.2,1),opacity 0.22s ease,padding 0.32s ease;pointer-events:none;z-index:60;}'+
'#ochoEmojiPill.open{max-width:300px;opacity:1;padding:6px 10px;pointer-events:all;}'+
'.oc-epick{font-size:24px;cursor:pointer;border-radius:50%;padding:3px;transition:transform 0.15s;background:none;border:none;-webkit-tap-highlight-color:transparent;}'+
'.oc-epick:active{transform:scale(0.82);}'+
'.oc-heart{position:absolute;pointer-events:none;color:#FF6B8A;animation:ochoFloatUp 2.2s ease-out forwards;}'+
'@keyframes ochoFloatUp{0%{opacity:1;transform:translateY(0) scale(1);}30%{opacity:0.85;}100%{opacity:0;transform:translateY(-520px) translateX(var(--dx)) scale(0.6);}}'+
'#ochoHomeBar{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:120px;height:5px;background:rgba(255,255,255,0.22);border-radius:3px;}'+
'#ochoWaitScreen{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:20px;text-align:center;padding:24px;background:linear-gradient(180deg,#f2a890 0%,#c87850 50%,#6a3c14 100%);}'+
'.oc-wait-bubble{display:flex;flex-direction:column;align-items:center;gap:4px;}'+
'.oc-pres-dot{width:10px;height:10px;border-radius:50%;background:#555;margin-top:4px;transition:background 0.3s;}'+
'.oc-pres-dot.online{background:#22c55e;box-shadow:0 0 5px rgba(34,197,94,0.7);}'+
'#ochoRoundEnd,#ochoGameEnd{display:none;position:absolute;inset:0;z-index:150;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;background:rgba(0,0,0,0.88);backdrop-filter:blur(10px);}'+
'#ochoColorPicker{display:none;position:absolute;inset:0;z-index:140;flex-direction:column;align-items:center;justify-content:center;gap:20px;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);}'+
'.oc-color-btn{width:80px;height:80px;border-radius:16px;border:3px solid rgba(242,232,212,0.7);font-size:36px;cursor:pointer;transition:transform 0.12s;}'+
'.oc-color-btn:active{transform:scale(0.9);}'+
'.oc-flying-card{position:fixed;z-index:500;pointer-events:none;border-radius:9px;border:2.5px solid #F2E8D4;box-shadow:0 6px 20px rgba(0,0,0,0.5);}'+
'#ochoView.active ~ .bottom-nav{display:none!important;}';
    document.head.appendChild(s);
  }

  // ─── HTML ─────────────────────────────────────────────
  function _buildOchoHTML(){
    return '<div id="ochoView">'+
    '<div id="ochoBg"></div>'+
    '<div id="ochoSky">'+
      '<div class="oc-cloud" style="width:72px;height:23px;top:20%;left:7%;"></div>'+
      '<div class="oc-cloud" style="width:46px;height:15px;top:31%;left:17%;"></div>'+
      '<div class="oc-cloud" style="width:88px;height:27px;top:15%;right:9%;"></div>'+
      '<div class="oc-cloud" style="width:54px;height:17px;top:29%;right:21%;"></div>'+
    '</div>'+
    '<div class="oc-mesa" style="width:50px;height:24px;bottom:57%;left:1%;border-radius:3px 3px 0 0;opacity:0.48;"></div>'+
    '<div class="oc-mesa" style="width:62px;height:20px;bottom:58%;right:0;border-radius:3px 3px 0 0;opacity:0.42;"></div>'+
    '<div class="oc-rock" style="width:18px;height:11px;bottom:32%;left:4%;opacity:0.6;"></div>'+
    '<div class="oc-rock" style="width:24px;height:13px;bottom:31%;right:5%;opacity:0.55;"></div>'+
    '<div class="oc-cv" style="width:5px;height:20px;bottom:32%;left:15%;opacity:0.65;"></div>'+
    '<div class="oc-ch" style="width:9px;height:4px;bottom:39%;left:11%;opacity:0.65;"></div>'+
    '<div class="oc-cv" style="width:5px;height:17px;bottom:32%;right:14%;opacity:0.58;"></div>'+
    '<div class="oc-ch" style="width:8px;height:4px;bottom:37%;right:11%;opacity:0.58;"></div>'+
    '<div id="ochoAura"></div>'+
    '<div id="ochoAnimZone"><div id="ochoAnimText"></div></div>'+
    '<div id="ochoHeader" style="position:absolute;top:0;left:0;right:0;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;z-index:100;">'+
      '<button id="ochoBackBtn" style="display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:20px;padding:6px 14px;color:#F2E8D4;font-size:13px;font-weight:700;font-family:Bricolage Grotesque,system-ui,sans-serif;cursor:pointer;backdrop-filter:blur(8px);">'+
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Retour</button>'+
      '<div style="font-family:Bricolage Grotesque,system-ui,sans-serif;font-size:17px;font-weight:900;color:#F2E8D4;text-shadow:0 1px 4px rgba(0,0,0,0.4);">Ocho \uD83C\uDCCF</div>'+
      '<button id="ochoAbandonBtn" style="display:none;background:rgba(239,83,80,0.18);color:#ef5350;border:1px solid rgba(239,83,80,0.4);border-radius:14px;padding:5px 12px;font-size:12px;font-weight:700;font-family:Bricolage Grotesque,system-ui,sans-serif;cursor:pointer;">Abandon</button>'+
    '</div>'+
    '<div id="ochoWaitScreen">'+
      '<div style="font-size:52px;">\u23F3</div>'+
      '<div style="font-family:Bricolage Grotesque,system-ui,sans-serif;font-size:20px;font-weight:900;color:#F2E8D4;">En attente\u2026</div>'+
      '<div id="ochoWaitMsg" style="font-size:14px;color:rgba(242,232,212,0.7);max-width:280px;line-height:1.6;"></div>'+
      '<div style="display:flex;gap:12px;align-items:center;margin-top:4px;">'+
        '<div class="oc-wait-bubble">'+
          '<div style="width:52px;height:52px;border-radius:50%;overflow:hidden;border:2.5px solid rgba(240,102,136,0.6);">'+
            '<img id="ochoWaitAvGirl" src="assets/images/profil_girl.png" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"></div>'+
          '<div style="font-size:10px;font-weight:700;color:#f06688;" id="ochoWaitNameGirl">Rose</div>'+
          '<div class="oc-pres-dot" id="ochoPresenceGirl"></div></div>'+
        '<div style="font-size:24px;color:rgba(242,232,212,0.4);">vs</div>'+
        '<div class="oc-wait-bubble">'+
          '<div style="width:52px;height:52px;border-radius:50%;overflow:hidden;border:2.5px solid rgba(90,200,250,0.6);">'+
            '<img id="ochoWaitAvBoy" src="assets/images/profil_boy.png" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"></div>'+
          '<div style="font-size:10px;font-weight:700;color:#5ac8fa;" id="ochoWaitNameBoy">Bleu</div>'+
          '<div class="oc-pres-dot" id="ochoPresenceBoy"></div></div>'+
      '</div>'+
      '<div style="font-size:11px;color:rgba(242,232,212,0.5);margin-top:4px;">La partie se lance automatiquement \uD83C\uDFAE</div>'+
      '<button id="ochoLeaveWaitBtn" style="margin-top:8px;padding:10px 24px;background:rgba(0,0,0,0.3);color:rgba(242,232,212,0.7);border:1px solid rgba(255,255,255,0.15);border-radius:50px;font-size:13px;font-weight:600;font-family:Bricolage Grotesque,system-ui,sans-serif;cursor:pointer;backdrop-filter:blur(8px);">Annuler</button>'+
    '</div>'+
    '<div id="ochoLayout">'+
      '<div id="ochoOppBlock">'+
        '<div id="ochoTopArc" style="position:relative;"><div id="ochoOppCardBadge">0</div></div>'+
        '<div class="oc-profile-pill">'+
          '<div class="oc-av-wrap">'+
            '<svg viewBox="0 0 68 68" fill="none" xmlns="http://www.w3.org/2000/svg">'+
              '<circle cx="34" cy="34" r="27" stroke="rgba(255,255,255,0.12)" stroke-width="7"/>'+
              '<circle cx="34" cy="34" r="27" id="ochoOppTimerArc" stroke="rgba(180,120,40,0.7)" stroke-width="7" stroke-dasharray="169.6 169.6" stroke-dashoffset="0" stroke-linecap="round"/>'+
            '</svg>'+
            '<div class="oc-av-face oc-av-partner"><img id="ochoOppAvatarImg" src="assets/images/profil_girl.png" alt=""></div>'+
            '<div id="ochoOppPresenceDot"></div>'+
          '</div>'+
          '<div><div class="oc-p-name" id="ochoOppName">Julie</div><div class="oc-p-sub" id="ochoOppSub">en attente</div></div>'+
        '</div>'+
      '</div>'+
      '<div id="ochoTableWrap"><div id="ochoTable">'+
        '<div id="ochoTableRound">Manche 1/6</div>'+
        '<div id="ochoPiles">'+
          '<div class="oc-pile-wrap"><div class="oc-slot"></div><div class="oc-mc oc-bk" id="ochoDeckCard"></div><div class="oc-deck-n" id="ochoDeckCount">\u2014</div></div>'+
          '<div class="oc-pile-wrap"><div class="oc-slot"></div><div class="oc-mc" id="ochoDiscardCard"></div><div class="oc-suit-dot" id="ochoColorDot"></div></div>'+
        '</div>'+
        '<div id="ochoTimerBar"><div id="ochoTimerFill"></div></div>'+
      '</div></div>'+
      '<div id="ochoMeBlock">'+
        '<div id="ochoMeRow">'+
          '<div id="ochoMeProfile">'+
            '<div class="oc-av-wrap">'+
              '<svg viewBox="0 0 68 68" fill="none" xmlns="http://www.w3.org/2000/svg">'+
                '<circle cx="34" cy="34" r="27" stroke="rgba(255,255,255,0.12)" stroke-width="7"/>'+
                '<circle cx="34" cy="34" r="27" id="ochoMeTimerArc" stroke="#FFD700" stroke-width="7" stroke-dasharray="169.6 169.6" stroke-dashoffset="0" stroke-linecap="round" style="filter:drop-shadow(0 0 5px rgba(255,215,0,0.7));"/>'+
              '</svg>'+
              '<div class="oc-av-face oc-av-me"><img id="ochoMeAvatarImg" src="assets/images/profil_boy.png" alt=""></div>'+
            '</div>'+
            '<div><div class="oc-p-name" id="ochoMeName" style="color:#FFD700;">Toi</div>'+
            '<div id="ochoMeTurnPill"><span class="oc-turn-dot"></span>Ton tour</div></div>'+
          '</div>'+
          '<button id="ochoBtn">\u00a1 OCHO !</button>'+
        '</div>'+
        '<button id="ochoPassBtn">Passer mon tour \u2192</button>'+
        '<div id="ochoBotArc"></div>'+
        '<div id="ochoHint"><span class="oc-hint-suit" id="ochoHintSuit"></span><span class="oc-hint-text" id="ochoHintText"></span><span class="oc-hint-badge" id="ochoHintBadge"></span></div>'+
      '</div>'+
    '</div>'+
    '<div id="ochoSafeZone">'+
      '<div id="ochoEmojiWrap">'+
        '<div id="ochoEmojiPill"></div>'+
        '<button id="ochoEmojiBtn" class="oc-btn-round">\uD83D\uDE04</button>'+
      '</div>'+
      '<button id="ochoHeartBtn" class="oc-btn-round">\uD83E\uDD0D</button>'+
    '</div>'+
    '<div id="ochoHomeBar"></div>'+
    '<div id="ochoRoundEnd">'+
      '<div id="ochoRoundEndEmoji" style="font-size:52px;">\uD83C\uDFC6</div>'+
      '<div id="ochoRoundEndTitle" style="font-family:Bricolage Grotesque,system-ui,sans-serif;font-size:22px;font-weight:900;color:#F2E8D4;line-height:1.3;"></div>'+
      '<div id="ochoRoundEndSub" style="font-size:12px;color:rgba(242,232,212,0.55);font-weight:600;"></div>'+
      '<div style="display:flex;gap:12px;width:100%;max-width:280px;">'+
        '<div style="flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:16px 12px;text-align:center;">'+
          '<div id="ochoRoundAvLeft" style="width:40px;height:40px;border-radius:50%;overflow:hidden;margin:0 auto 6px;"><img src="assets/images/profil_girl.png" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"></div>'+
          '<div id="ochoRoundLabelLeft" style="font-size:12px;font-weight:700;color:#F2E8D4;margin-bottom:4px;"></div>'+
          '<div style="font-size:11px;color:rgba(242,232,212,0.5);margin-bottom:2px;">Manches</div>'+
          '<div id="ochoRoundWinsLeft" style="font-size:28px;font-weight:900;color:#F2E8D4;">0</div>'+
        '</div>'+
        '<div style="flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:16px 12px;text-align:center;">'+
          '<div id="ochoRoundAvRight" style="width:40px;height:40px;border-radius:50%;overflow:hidden;margin:0 auto 6px;"><img src="assets/images/profil_boy.png" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"></div>'+
          '<div id="ochoRoundLabelRight" style="font-size:12px;font-weight:700;color:#F2E8D4;margin-bottom:4px;"></div>'+
          '<div style="font-size:11px;color:rgba(242,232,212,0.5);margin-bottom:2px;">Manches</div>'+
          '<div id="ochoRoundWinsRight" style="font-size:28px;font-weight:900;color:#F2E8D4;">0</div>'+
        '</div>'+
      '</div>'+
      '<div id="ochoRoundProgress" style="font-size:11px;color:rgba(242,232,212,0.5);font-weight:600;"></div>'+
      '<div id="ochoNextRoundWrap" style="display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:280px;">'+
        '<button id="ochoNextRoundBtn" style="width:100%;padding:14px 0;background:#FFD700;color:#000;font-weight:900;font-size:15px;font-family:Bricolage Grotesque,system-ui,sans-serif;border:none;border-radius:50px;cursor:pointer;">Manche suivante \u2192</button>'+
        '<div id="ochoWaitNextMsg" style="display:none;font-size:12px;color:rgba(242,232,212,0.5);font-weight:600;">\u23F3 En attente que l\'autre lance\u2026</div>'+
      '</div>'+
    '</div>'+
    '<div id="ochoGameEnd">'+
      '<div id="ochoGameEndEmoji" style="font-size:72px;">\uD83C\uDFC6</div>'+
      '<div id="ochoGameEndTitle" style="font-family:Bricolage Grotesque,system-ui,sans-serif;font-size:24px;font-weight:900;color:#F2E8D4;"></div>'+
      '<div id="ochoGameEndSub" style="font-size:13px;color:rgba(242,232,212,0.55);"></div>'+
      '<div style="display:flex;gap:12px;width:100%;max-width:280px;">'+
        '<div style="flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:16px 12px;text-align:center;">'+
          '<div id="ochoFinalAvLeft" style="width:36px;height:36px;border-radius:50%;overflow:hidden;margin:0 auto 4px;"><img src="assets/images/profil_girl.png" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"></div>'+
          '<div id="ochoFinalLabelLeft" style="font-size:13px;font-weight:700;color:#F2E8D4;margin-bottom:6px;"></div>'+
          '<div id="ochoFinalScoreLeft" style="font-size:36px;font-weight:900;color:#F2E8D4;">0</div>'+
          '<div style="font-size:10px;color:rgba(242,232,212,0.5);margin-top:2px;">manches</div>'+
        '</div>'+
        '<div style="flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:16px 12px;text-align:center;">'+
          '<div id="ochoFinalAvRight" style="width:36px;height:36px;border-radius:50%;overflow:hidden;margin:0 auto 4px;"><img src="assets/images/profil_boy.png" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"></div>'+
          '<div id="ochoFinalLabelRight" style="font-size:13px;font-weight:700;color:#F2E8D4;margin-bottom:6px;"></div>'+
          '<div id="ochoFinalScoreRight" style="font-size:36px;font-weight:900;color:#F2E8D4;">0</div>'+
          '<div style="font-size:10px;color:rgba(242,232,212,0.5);margin-top:2px;">manches</div>'+
        '</div>'+
      '</div>'+
      '<div style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:280px;">'+
        '<button id="ochoNewGameBtn" style="width:100%;padding:14px 0;background:#FFD700;color:#000;font-weight:900;font-size:15px;font-family:Bricolage Grotesque,system-ui,sans-serif;border:none;border-radius:50px;cursor:pointer;">Rejouer \uD83D\uDD04</button>'+
        '<button id="ochoCloseEndBtn" style="width:100%;padding:12px 0;background:rgba(0,0,0,0.3);color:rgba(242,232,212,0.7);border:1px solid rgba(255,255,255,0.15);border-radius:50px;font-size:13px;font-family:Bricolage Grotesque,system-ui,sans-serif;cursor:pointer;">Retour aux jeux</button>'+
      '</div>'+
    '</div>'+
    '<div id="ochoColorPicker">'+
      '<div style="font-family:Bricolage Grotesque,system-ui,sans-serif;font-size:18px;font-weight:900;color:#F2E8D4;">Choisir une couleur</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">'+
        '<button class="oc-color-btn" data-color="heart"   style="background:#E04E3E;">\u2665</button>'+
        '<button class="oc-color-btn" data-color="club"    style="background:#4CB8A0;">\u2663</button>'+
        '<button class="oc-color-btn" data-color="spade"   style="background:#5070B8;">\u2660</button>'+
        '<button class="oc-color-btn" data-color="diamond" style="background:#E89030;">\u2666</button>'+
      '</div>'+
    '</div>'+
    '</div>';
  }

  // ─── Injection HTML ───────────────────────────────────
  function _injectHTML(){
    if(document.getElementById('ochoView'))return;
    var tmp=document.createElement('div');tmp.innerHTML=_buildOchoHTML();
    var skyjo=document.getElementById('skyjoView');
    if(skyjo&&skyjo.parentNode)skyjo.parentNode.insertBefore(tmp.firstElementChild,skyjo.nextSibling);
    else document.body.appendChild(tmp.firstElementChild);
  }

  // ─── Écrans ───────────────────────────────────────────
  function _showScreen(id){
    var layout=document.getElementById('ochoLayout'),wait=document.getElementById('ochoWaitScreen');
    if(id==='ochoWaitScreen'){
      if(layout){layout.classList.remove('visible');layout.style.display='none';}
      if(wait)wait.style.display='flex';
    }else{
      if(wait)wait.style.display='none';
      if(layout){layout.style.display='flex';layout.classList.add('visible');}
    }
  }

  // ─── Avatars réels ────────────────────────────────────
  function _getAvatarUrl(role){
    // 1. YAM_COUPLE (chargé par app-account)
    if(window.YAM_COUPLE){
      var m=window.YAM_COUPLE[role];
      if(m&&m.avatar_url)return m.avatar_url;
    }
    // 2. Session localStorage
    try{
      var sess=JSON.parse(localStorage.getItem('yam_session_v3')||'null');
      if(sess&&sess.user){
        var myRole=(typeof getProfile==='function'?getProfile():null)||(sess.user&&sess.user.role);
        if(role===myRole&&sess.user.avatar_url)return sess.user.avatar_url;
      }
    }catch(e){}
    return 'assets/images/profil_'+role+'.png';
  }

  function _loadAvatars(){
    if(!_me)return;
    var myUrl=_getAvatarUrl(_me), opUrl=_getAvatarUrl(_other);
    var imgs={ochoMeAvatarImg:myUrl, ochoOppAvatarImg:opUrl,
              ochoWaitAvGirl:_getAvatarUrl('girl'), ochoWaitAvBoy:_getAvatarUrl('boy')};
    Object.keys(imgs).forEach(function(id){
      var el=document.getElementById(id);if(el&&el.src!==imgs[id])el.src=imgs[id];
    });
    var rL=document.querySelector('#ochoRoundAvLeft img'),rR=document.querySelector('#ochoRoundAvRight img');
    var fL=document.querySelector('#ochoFinalAvLeft img'),fR=document.querySelector('#ochoFinalAvRight img');
    var gUrl=_getAvatarUrl('girl'),bUrl=_getAvatarUrl('boy');
    if(rL)rL.src=(_me==='girl')?gUrl:bUrl; if(rR)rR.src=(_me==='girl')?bUrl:gUrl;
    if(fL)fL.src=(_me==='girl')?gUrl:bUrl; if(fR)fR.src=(_me==='girl')?bUrl:gUrl;
  }

  // ─── Ouverture ────────────────────────────────────────
  window.openOcho=function(){
    var profile=(typeof getProfile==='function'?getProfile():null)
      ||(typeof yamGetUser==='function'&&yamGetUser()?yamGetUser().role:null);
    if(!profile){if(window.v2ShowLogin)window.v2ShowLogin();return;}
    _injectHTML();_injectCSS();_setupListeners();_setupEmojiPicker();
    _openOchoWithProfile(profile);
  };

  function _openOchoWithProfile(profile){
    _me=profile;_other=_me==='girl'?'boy':'girl';
    _drawnThisTurn=false;_passAvailable=false;_selectedCard=null;
    var ov=document.getElementById('ochoView'),gv=document.getElementById('gamesView');
    if(typeof _yamSlide==='function')_yamSlide(ov,gv,'forward');
    else{ov.classList.add('active');ov.style.display='block';}
    var nav=document.querySelector('.bottom-nav');if(nav)nav.style.display='none';
    if(typeof _subviewIds!=='undefined'&&Array.isArray(_subviewIds)&&_subviewIds.indexOf('ochoView')===-1)_subviewIds.push('ochoView');
    _loadAvatars();

    _mp=YAMMultiplayer.init({
      gameTable:OCHO_TABLE,presenceTable:OCHO_PRESENCE,
      waitModalId:'ochoWaitModal',countdownModalId:'ochoCountdownModal',
      deleteOnLeave:true,staleGameMinutes:30,
      buildInitialState:function(){return _buildInitialState();},
      onWaiting:function(me){
        var mn=typeof v2GetDisplayName==='function'?v2GetDisplayName(me):'Moi';
        var on=typeof v2GetDisplayName==='function'?v2GetDisplayName(me==='girl'?'boy':'girl'):'L\'autre';
        _showScreen('ochoWaitScreen');
        var msg=document.getElementById('ochoWaitMsg');
        if(msg)msg.innerHTML='Connecté en tant que <strong>'+(typeof escHtml==='function'?escHtml(mn):mn)+'</strong>.<br>En attente que <strong>'+(typeof escHtml==='function'?escHtml(on):on)+'</strong> rejoigne\u2026';
        _updateWaitNames();
      },
      onLobbyTick:function(girlOk,boyOk){
        var dg=document.getElementById('ochoPresenceGirl'),db=document.getElementById('ochoPresenceBoy');
        if(dg)dg.className='oc-pres-dot'+(girlOk?' online':'');
        if(db)db.className='oc-pres-dot'+(boyOk?' online':'');
      },
      onMatchFound:function(gameRow){
        _resetLocalState();_showScreen('ochoLayout');
        var btn=document.getElementById('ochoAbandonBtn');if(btn)btn.style.display='block';
        _renderState(gameRow);
      },
      onStateUpdate:function(gameRow){_renderState(gameRow);},
      onPresenceUpdate:function(isOnline){
        var dot=document.getElementById('ochoOppPresenceDot');if(!dot)return;
        dot.style.background=isOnline?'#22c55e':'#555';
        dot.style.boxShadow=isOnline?'0 0 5px rgba(34,197,94,0.7)':'none';
        dot.className=isOnline?'online':'';
      },
      onAbandon:function(){_resetLocalState();_mp.showAlert('\uD83C\uDFF3\uFE0F','Partie abandonn\u00e9e',function(){_mp.enterLobby();});},
      onBothAbsent:function(){_resetLocalState();_mp.showAlert('\u23F1\uFE0F','Partie expir\u00e9e',function(){_mp.enterLobby();});},
      onLeave:function(){_leaveOchoView();}
    });
    _mp.enter(profile);
  }

  function _buildInitialState(){
    _cardId=0;
    var deck=buildDeck(),gh=_dealHand(deck,7),bh=_dealHand(deck,7);
    var top=null;
    for(var i=deck.length-1;i>=0;i--){if(deck[i].value!=='8'&&deck[i].value!=='swap'){top=deck.splice(i,1)[0];break;}}
    if(!top)top=deck.pop();
    return{deck:deck,discard:[top],girl_hand:gh,boy_hand:bh,
      current_color:top.suit,turn:'girl',ts_turn:Date.now(),
      round:1,wins:{girl:0,boy:0},ocho_declared:null,phase:'playing',
      round_winner:null,draw_penalty:null,abandoned:false,abandonedBy:null,reaction:null};
  }

  function _resetLocalState(){
    _state=null;_stopTimer();_timerFired=false;_reactCooldown=false;
    _lastReactTs=0;_ochoAuraOn=false;_selectedCard=null;
    _drawnThisTurn=false;_passAvailable=false;
    var aura=document.getElementById('ochoAura');if(aura)aura.classList.remove('active');
    var pass=document.getElementById('ochoPassBtn');if(pass)pass.classList.remove('visible');
    if(typeof window._corePresenceSuspend==='function')window._corePresenceSuspend();
  }

  // ─── Rendu état ───────────────────────────────────────
  function _renderState(gameRow){
    var state=gameRow.state;if(!state)return;
    // Reset local si changement de tour
    if(_state&&_state.ts_turn!==state.ts_turn){
      _drawnThisTurn=false;_passAvailable=false;_selectedCard=null;
      var pb=document.getElementById('ochoPassBtn');if(pb)pb.classList.remove('visible');
    }
    _state=state;_checkIncomingReaction(state);
    // Désactiver aura si je ne l'ai plus déclarée
    if(state.ocho_declared!==_me&&_ochoAuraOn){
      _ochoAuraOn=false;
      var aura=document.getElementById('ochoAura');if(aura)aura.classList.remove('active');
    }
    if(state.phase==='round_end'){_showRoundEnd(state);return;}
    if(state.phase==='game_end'){_showGameEnd(state);return;}
    var re=document.getElementById('ochoRoundEnd'),ge=document.getElementById('ochoGameEnd');
    if(re)re.style.display='none';if(ge)ge.style.display='none';
    var isMyTurn=state.turn===_me;
    var myHand=_me==='girl'?state.girl_hand:state.boy_hand;
    var oppHand=_me==='girl'?state.boy_hand:state.girl_hand;
    _runTimer(state,isMyTurn);
    var meN=document.getElementById('ochoMeName');var opN=document.getElementById('ochoOppName');
    var myName=typeof v2GetDisplayName==='function'?v2GetDisplayName(_me):'Moi';
    var oppName=typeof v2GetDisplayName==='function'?v2GetDisplayName(_other):'L\'autre';
    if(meN)meN.textContent=myName;if(opN)opN.textContent=oppName;
    _loadAvatars();
    var tp=document.getElementById('ochoMeTurnPill');if(tp)tp.className=isMyTurn?'visible':'';
    var os=document.getElementById('ochoOppSub');if(os)os.textContent=!isMyTurn?'\u23F3 \u00e0 son tour\u2026':'en attente';
    var tr=document.getElementById('ochoTableRound');if(tr)tr.textContent='Manche '+(state.round||1)+'/6';
    var topCard=state.discard&&state.discard.length>0?state.discard[state.discard.length-1]:null;
    _renderDiscardCard(topCard,state.current_color);
    var cdot=document.getElementById('ochoColorDot');
    if(cdot){cdot.style.background=SUIT_COLORS[state.current_color]||'#888';cdot.textContent=SUIT_SYMS[state.current_color]||'';}
    var dc=document.getElementById('ochoDeckCount');if(dc)dc.textContent=state.deck?state.deck.length:'\u2014';
    _renderOppCards(oppHand.length);
    var playable=_playableCards(myHand,state);
    _renderMyCards(myHand,playable,isMyTurn);
    _renderHint(state,myHand,playable,isMyTurn);
    if(isMyTurn&&state.draw_penalty&&state.draw_penalty.target===_me)_applyForcedDraw(state);
  }

  // ─── Défausse ─────────────────────────────────────────
  function _renderDiscardCard(card,currentColor){
    var el=document.getElementById('ochoDiscardCard');if(!el)return;
    el.innerHTML='';el.className='oc-mc';el.style.background='';
    if(!card)return;
    if(card.value==='8'){
      el.innerHTML=_card8Inner(SUIT_COLORS[currentColor]?currentColor:null,true);
    }else if(card.value==='swap'){
      el.innerHTML=_cardSwapInner(true);
    }else{
      var sClass={heart:'h',club:'c',spade:'s',diamond:'d'}[card.suit]||'';
      if(sClass)el.classList.add(sClass);
      var bg2=document.createElement('div');bg2.className='oc-mc-sym';
      bg2.textContent=SUIT_SYMS[card.suit]||'';el.appendChild(bg2);
      var vd=card.value==='block'?'\u2298':card.value;
      var ve=document.createElement('div');ve.className='oc-mc-val';ve.textContent=vd;el.appendChild(ve);
      if(card.value==='+1'||card.value==='+2'||card.value==='block'){
        var ltr=card.value==='+1'?'Q':card.value==='+2'?'K':'J';
        var sub=document.createElement('div');sub.className='oc-mc-sub';sub.textContent=ltr;el.appendChild(sub);
      }
    }
  }

  // ─── Cartes adversaire ────────────────────────────────
  function _renderOppCards(count){
    var c=document.getElementById('ochoTopArc');if(!c)return;
    Array.from(c.children).forEach(function(el){if(el.id!=='ochoOppCardBadge')el.remove();});
    var n=Math.min(count,10);
    for(var i=0;i<n;i++){
      var el=document.createElement('div');el.className='oc-arc-bk';
      var angle=(i-(n-1)/2)*8,cx=260/2-24+(i-(n-1)/2)*26;
      el.style.cssText='left:'+cx+'px;top:4px;transform:rotate('+angle+'deg);';
      c.insertBefore(el,c.firstChild);
    }
    var badge=document.getElementById('ochoOppCardBadge');if(badge)badge.textContent=count;
  }

  // ─── Mes cartes (vraies cartes, double-clic) ──────────
  function _renderMyCards(hand,playable,isMyTurn){
    var c=document.getElementById('ochoBotArc');if(!c)return;
    c.innerHTML='';if(hand.length===0)return;
    var n=hand.length;
    var totalW=Math.min(c.offsetWidth||300,340);
    var spread=Math.min(46,(totalW-52)/Math.max(n-1,1));
    var startX=(totalW-(spread*(n-1)+52))/2;
    var maxAngle=Math.min(22,n*3);

    hand.forEach(function(card,i){
      var el=document.createElement('div');el.className='oc-card';
      var isPlay=playable.some(function(p){return p.id===card.id;});
      var isSelected=_selectedCard&&_selectedCard.id===card.id;

      if(isMyTurn&&isPlay)el.classList.add('playable');
      else if(isMyTurn)el.classList.add('unplayable');
      if(isSelected)el.classList.add('selected');

      var angle=n>1?(i/(n-1)-0.5)*maxAngle*2:0;
      var lift=n>1?-Math.abs(i/(n-1)-0.5)*8:0;

      el.style.cssText='left:'+(startX+i*spread)+'px;bottom:4px;'+
        'transform:rotate('+angle+'deg) translateY('+lift+(isSelected?-12:0)+'px);'+
        'z-index:'+(isSelected?99:(i+1))+';';

      el.innerHTML=_cardInner(card,false);

      el.addEventListener('click',(function(cc){return function(e){
        e.stopPropagation();
        if(!isMyTurn||!_mp||!_mp.isLaunched())return;
        if(!isPlay){if(typeof showToast==='function')showToast('Carte non jouable \u26A0\uFE0F');return;}
        if(_selectedCard&&_selectedCard.id===cc.id){
          _playCardFromUI(cc);
        }else{
          _selectedCard=cc;
          _renderMyCards(hand,playable,isMyTurn);
        }
      };})(card));
      c.appendChild(el);
    });
  }

  // ─── Hint ─────────────────────────────────────────────
  function _renderHint(state,hand,playable,isMyTurn){
    var se=document.getElementById('ochoHintSuit'),te=document.getElementById('ochoHintText'),be=document.getElementById('ochoHintBadge');
    if(!se)return;
    if(!isMyTurn){
      var oh=_me==='girl'?state.boy_hand:state.girl_hand;
      se.textContent='';te.textContent='En attente\u2026';
      if(be){be.textContent=oh.length+' cartes';be.className='oc-hint-badge';be.style.background='rgba(255,255,255,0.15)';}
      return;
    }
    var color=SUIT_COLORS[state.current_color]?state.current_color:'heart';
    var sym=SUIT_SYMS[color]||'?';
    var top=state.discard[state.discard.length-1];
    var tv=top?String(top.value).substring(0,5):'?';if(tv==='block')tv='\u2298';
    se.textContent=sym;
    if(_drawnThisTurn&&_passAvailable){
      te.textContent='Pioch\u00e9 \u2014 ';
      if(be){be.textContent='Jouer ou passer';be.className='oc-hint-badge';be.style.background='rgba(255,255,255,0.2)';}
    }else{
      te.textContent=tv+' ou '+sym+' \u2014 ';
      if(be){be.textContent=playable.length+' jouable'+(playable.length>1?'s':'');be.className='oc-hint-badge '+color;be.style.background='';}
    }
  }

  // ─── Actions ──────────────────────────────────────────
  function _playCardFromUI(card){
    if(!_state||_state.turn!==_me)return;
    if(!_isPlayable(card,_state)){if(typeof showToast==='function')showToast('Carte non jouable');return;}
    _selectedCard=null;
    if(card.value==='8'){_showColorPicker(card);return;}
    _animateCardPlay(card,function(){_playCard(card,null);});
  }

  function _showColorPicker(card){
    var overlay=document.getElementById('ochoColorPicker');if(!overlay)return;
    overlay.style.display='flex';
    overlay.querySelectorAll('.oc-color-btn').forEach(function(btn){
      btn.onclick=function(){
        overlay.style.display='none';
        _animateCardPlay(card,function(){_playCard(card,btn.getAttribute('data-color'));});
      };
    });
  }

  function _playCard(card,chosenColor){
    if(!_state||_mp.isSaving())return;
    var ns=_applyCard(_state,card,_me,chosenColor);
    _mp.saveState(ns);
    if(typeof haptic==='function')haptic();
    var mnh=_me==='girl'?ns.girl_hand:ns.boy_hand;
    if(mnh.length===1&&ns.phase!=='round_end')_flashOchoReminder();
  }

  function _flashOchoReminder(){
    var btn=document.getElementById('ochoBtn');if(!btn)return;
    btn.style.background='#FFD700';btn.style.color='#000';
    setTimeout(function(){btn.style.background='';btn.style.color='';},700);
  }

  // ─── Pioche et passe ──────────────────────────────────
  function _onDrawCard(){
    if(!_state||_mp.isSaving()||_state.turn!==_me)return;
    if(_drawnThisTurn&&_passAvailable){_onPassTurn();return;}
    if(_drawnThisTurn)return;

    var ns=_drawCard(_state,_me);
    _drawnThisTurn=true;

    var newHand=_me==='girl'?ns.girl_hand:ns.boy_hand;
    var newCard=newHand[newHand.length-1];
    var canPlay=newCard&&_isPlayable(newCard,ns);

    if(canPlay){
      _passAvailable=true;
      // Garder le tour à nous mais reset le ts pour éviter la re-pioche par timer
      ns.turn=_me;ns.ts_turn=Date.now();
      _mp.saveState(ns);
      var pb=document.getElementById('ochoPassBtn');if(pb)pb.classList.add('visible');
      _animateDrawCard(function(){});
      if(typeof haptic==='function')haptic('light');
    }else{
      _passAvailable=false;
      ns.turn=_other;ns.ts_turn=Date.now();
      _mp.saveState(ns);
      _animateDrawCard(function(){});
      if(typeof haptic==='function')haptic('light');
      if(typeof showToast==='function')showToast('Pas de carte jouable \u2014 tour pass\u00e9');
    }
  }

  function _onPassTurn(){
    if(!_state||_mp.isSaving()||_state.turn!==_me)return;
    var ns=_deepCopy(_state);ns.turn=_other;ns.ts_turn=Date.now();
    _drawnThisTurn=false;_passAvailable=false;_selectedCard=null;
    var pb=document.getElementById('ochoPassBtn');if(pb)pb.classList.remove('visible');
    _mp.saveState(ns);
  }

  function _applyForcedDraw(state){if(_mp.isSaving())return;_mp.saveState(_applyDrawPenalty(state));}

  // ─── Bouton OCHO ──────────────────────────────────────
  function _onOchoBtn(){
    if(!_state)return;
    var mh=_me==='girl'?_state.girl_hand:_state.boy_hand;
    var oh=_me==='girl'?_state.boy_hand:_state.girl_hand;
    if(mh.length===1&&_state.ocho_declared!==_me){
      if(_mp.isSaving())return;
      var ns=_deepCopy(_state);ns.ocho_declared=_me;_mp.saveState(ns);
      _ochoAuraOn=true;var aura=document.getElementById('ochoAura');if(aura)aura.classList.add('active');
      if(typeof haptic==='function')haptic('medium');return;
    }
    if(oh.length===1&&_state.ocho_declared!==_other){
      if(_mp.isSaving())return;
      var ns2=_deepCopy(_state);if(ns2.deck.length===0)_reshuffleDiscard(ns2);
      var pc=ns2.deck.pop();
      if(pc){if(_other==='girl')ns2.girl_hand.push(pc);else ns2.boy_hand.push(pc);}
      ns2.ocho_declared=_me+'_caught';_mp.saveState(ns2);
      if(typeof showToast==='function')showToast('\uD83D\uDCA5 Ocho rat\u00e9\u00a0! L\'adversaire pioche\u00a0!');return;
    }
    if(mh.length>1){
      if(_mp.isSaving())return;
      var ns3=_deepCopy(_state);if(ns3.deck.length===0)_reshuffleDiscard(ns3);
      var pc2=ns3.deck.pop();
      if(pc2){if(_me==='girl')ns3.girl_hand.push(pc2);else ns3.boy_hand.push(pc2);}
      _mp.saveState(ns3);
      if(typeof showToast==='function')showToast('Trop t\u00f4t\u00a0! Tu pioches une carte\u2026');
    }
  }

  // ─── Animations vol de carte ──────────────────────────
  function _animateCardPlay(card,cb){
    var arc=document.getElementById('ochoBotArc');
    var discardEl=document.getElementById('ochoDiscardCard');
    if(!arc||!discardEl){if(cb)cb();return;}

    // Trouver l'élément de carte par index dans la main
    var hand=_me==='girl'?_state.girl_hand:_state.boy_hand;
    var cardIdx=hand.findIndex(function(c){return c.id===card.id;});
    var cardEls=arc.querySelectorAll('.oc-card');
    var fromEl=cardEls[cardIdx]||cardEls[0];
    if(!fromEl){if(cb)cb();return;}

    var fromRect=fromEl.getBoundingClientRect();
    var toRect=discardEl.getBoundingClientRect();

    var fly=document.createElement('div');
    fly.className='oc-flying-card';
    fly.style.cssText='width:52px;height:73px;left:'+fromRect.left+'px;top:'+fromRect.top+'px;overflow:hidden;';
    fly.innerHTML=_cardInner(card,false);
    document.body.appendChild(fly);

    // Masquer la carte originale
    fromEl.style.opacity='0';

    var toX=toRect.left-fromRect.left;
    var toY=toRect.top-fromRect.top;
    var sc=Math.min(toRect.width/52,toRect.height/73);

    requestAnimationFrame(function(){requestAnimationFrame(function(){
      fly.style.transition='transform 0.3s cubic-bezier(.4,0,.2,1),opacity 0.3s ease';
      fly.style.transform='translate('+toX+'px,'+toY+'px) scale('+sc+')';
      fly.style.opacity='0';
      setTimeout(function(){fly.remove();if(cb)cb();},320);
    });});
  }

  function _animateDrawCard(cb){
    var deckEl=document.getElementById('ochoDeckCard');
    var arc=document.getElementById('ochoBotArc');
    if(!deckEl||!arc){if(cb)cb();return;}
    var fromRect=deckEl.getBoundingClientRect();
    var toRect=arc.getBoundingClientRect();

    var fly=document.createElement('div');
    fly.className='oc-flying-card oc-bk';
    fly.style.cssText='width:50px;height:70px;left:'+fromRect.left+'px;top:'+fromRect.top+'px;'+
      'background:repeating-linear-gradient(135deg,#2a1205 0px,#2a1205 6px,#3a1a0a 6px,#3a1a0a 12px);';
    document.body.appendChild(fly);

    var toX=toRect.left+(toRect.width/2)-fromRect.left-25;
    var toY=toRect.top-fromRect.top;

    requestAnimationFrame(function(){requestAnimationFrame(function(){
      fly.style.transition='transform 0.28s cubic-bezier(.4,0,.2,1),opacity 0.28s ease';
      fly.style.transform='translate('+toX+'px,'+toY+'px) scale(1.06)';
      setTimeout(function(){
        fly.style.opacity='0';
        setTimeout(function(){fly.remove();if(cb)cb();},150);
      },200);
    });});
  }

  // ─── Timer (r=27, CIRC≈169.6) ────────────────────────
  var CIRC=2*Math.PI*27; // ≈ 169.646

  function _setArc(elId,frac,color){
    var el=document.getElementById(elId);if(!el)return;
    var d=Math.max(0,Math.min(1,frac))*CIRC;
    el.setAttribute('stroke-dasharray',d+' '+(CIRC-d));
    if(color)el.setAttribute('stroke',color);
  }

  function _runTimer(state,isMyTurn){
    _stopTimer();
    var elapsed=(Date.now()-(state.ts_turn||Date.now()))/1000;
    var remaining=Math.max(0,TURN_DURATION-elapsed);
    var color=remaining<5?'#E04E3E':remaining<10?'#E89030':'#FFD700';

    // Barre table
    var fill=document.getElementById('ochoTimerFill');
    if(fill){
      fill.style.transition='none';fill.style.width=(remaining/TURN_DURATION*100)+'%';fill.style.background=color;
      setTimeout(function(){fill.style.transition='width '+remaining+'s linear';fill.style.width='0%';},50);
    }

    if(isMyTurn){
      _setArc('ochoMeTimerArc',remaining/TURN_DURATION,color);
      _setArc('ochoOppTimerArc',0,'rgba(180,120,40,0.3)');
    }else{
      _setArc('ochoOppTimerArc',remaining/TURN_DURATION,'rgba(180,120,40,0.8)');
      _setArc('ochoMeTimerArc',1,'rgba(255,255,255,0.1)');
    }

    if(!isMyTurn||_timerFired)return;
    _timerFired=false;
    var deadline=(state.ts_turn||Date.now())+TURN_DURATION*1000;
    function _tick(){
      var now=Date.now(),rem2=Math.max(0,(deadline-now)/1000);
      _setArc('ochoMeTimerArc',rem2/TURN_DURATION,rem2<5?'#E04E3E':rem2<10?'#E89030':'#FFD700');
      if(now>=deadline){_timerFired=true;_autoDrawOnTimeout();return;}
      _timerRAF=requestAnimationFrame(_tick);
    }
    _timerRAF=requestAnimationFrame(_tick);
  }

  function _stopTimer(){if(_timerRAF){cancelAnimationFrame(_timerRAF);_timerRAF=null;}}

  function _autoDrawOnTimeout(){
    if(!_state||_mp.isSaving()||_state.turn!==_me)return;
    var ns=_drawCard(_state,_me);ns.turn=_other;ns.ts_turn=Date.now();
    _mp.saveState(ns);
    if(typeof showToast==='function')showToast('\u23F0 Temps \u00e9coul\u00e9 \u2014 pioche automatique');
  }

  // ─── Fin de manche ────────────────────────────────────
  function _showRoundEnd(state){
    _stopTimer();_ochoAuraOn=false;
    var aura=document.getElementById('ochoAura');if(aura)aura.classList.remove('active');
    var winner=state.round_winner,iWon=winner===_me;
    var wn=typeof v2GetDisplayName==='function'?v2GetDisplayName(winner):(winner==='girl'?'Elle':'Lui');
    document.getElementById('ochoRoundEndEmoji').textContent=iWon?'\uD83C\uDFC6':'\uD83D\uDE14';
    document.getElementById('ochoRoundEndTitle').textContent=iWon?'Tu remportes cette manche\u00a0!':wn+' remporte cette manche\u00a0!';
    var mw=state.wins[_me]||0,ow=state.wins[_other]||0;
    document.getElementById('ochoRoundEndSub').textContent='Score\u00a0: '+mw+' \u2013 '+ow;
    document.getElementById('ochoRoundProgress').textContent='Manche '+(state.round||1)+'/6';
    document.getElementById('ochoRoundWinsLeft').textContent=_me==='girl'?mw:ow;
    document.getElementById('ochoRoundWinsRight').textContent=_me==='girl'?ow:mw;
    document.getElementById('ochoRoundLabelLeft').textContent=typeof v2GetDisplayName==='function'?v2GetDisplayName(_me):'Moi';
    document.getElementById('ochoRoundLabelRight').textContent=typeof v2GetDisplayName==='function'?v2GetDisplayName(_other):'L\'autre';
    var canL=winner===_me;
    var btn=document.getElementById('ochoNextRoundBtn'),wm=document.getElementById('ochoWaitNextMsg');
    if(btn)btn.style.display=canL?'block':'none';
    if(wm)wm.style.display=canL?'none':'block';
    // Avatars récap
    var rL=document.querySelector('#ochoRoundAvLeft img'),rR=document.querySelector('#ochoRoundAvRight img');
    if(rL)rL.src=_getAvatarUrl(_me);if(rR)rR.src=_getAvatarUrl(_other);
    document.getElementById('ochoRoundEnd').style.display='flex';
  }

  function _startNextRound(state){
    if(_mp.isSaving())return;
    _cardId=0;var deck=buildDeck(),gh=_dealHand(deck,7),bh=_dealHand(deck,7);
    var top=null;
    for(var i=deck.length-1;i>=0;i--){if(deck[i].value!=='8'&&deck[i].value!=='swap'){top=deck.splice(i,1)[0];break;}}
    if(!top)top=deck.pop();
    _mp.saveState({deck:deck,discard:[top],girl_hand:gh,boy_hand:bh,
      current_color:top.suit,turn:state.round_winner||'girl',ts_turn:Date.now(),
      round:(state.round||1)+1,wins:state.wins,
      ocho_declared:null,phase:'playing',round_winner:null,draw_penalty:null,
      abandoned:false,abandonedBy:null,reaction:null});
    document.getElementById('ochoRoundEnd').style.display='none';
  }

  // ─── Fin de partie ────────────────────────────────────
  function _showGameEnd(state){
    _stopTimer();_ochoAuraOn=false;
    var aura=document.getElementById('ochoAura');if(aura)aura.classList.remove('active');
    var mw=state.wins[_me]||0,ow=state.wins[_other]||0;
    var isDraw=mw===ow,iWon=mw>ow;
    var wn=typeof v2GetDisplayName==='function'?v2GetDisplayName(iWon?_me:_other):(iWon?'Toi':'L\'autre');
    document.getElementById('ochoGameEndEmoji').textContent=isDraw?'\uD83E\uDD1D':(iWon?'\uD83C\uDFC6':'\uD83D\uDE14');
    document.getElementById('ochoGameEndTitle').textContent=isDraw?'\u00c9galit\u00e9\u00a0!':(iWon?'Tu gagnes la partie\u00a0!':wn+' gagne la partie\u00a0!');
    document.getElementById('ochoGameEndSub').textContent=mw+' \u2013 '+ow+' (sur 6 manches)';
    document.getElementById('ochoFinalScoreLeft').textContent=_me==='girl'?mw:ow;
    document.getElementById('ochoFinalScoreRight').textContent=_me==='girl'?ow:mw;
    document.getElementById('ochoFinalLabelLeft').textContent=typeof v2GetDisplayName==='function'?v2GetDisplayName(_me):'Moi';
    document.getElementById('ochoFinalLabelRight').textContent=typeof v2GetDisplayName==='function'?v2GetDisplayName(_other):'L\'autre';
    var fL=document.querySelector('#ochoFinalAvLeft img'),fR=document.querySelector('#ochoFinalAvRight img');
    if(fL)fL.src=_getAvatarUrl(_me);if(fR)fR.src=_getAvatarUrl(_other);
    var cL=document.getElementById('ochoFinalScoreLeft').parentElement;
    var cR=document.getElementById('ochoFinalScoreRight').parentElement;
    if(cL&&cR){
      cL.style.borderColor='';cL.style.background='';cR.style.borderColor='';cR.style.background='';
      if(!isDraw){var w=iWon?cL:cR;w.style.borderColor='#FFD700';w.style.background='rgba(255,215,0,0.1)';}
    }
    document.getElementById('ochoGameEnd').style.display='flex';
    if(typeof window.yamFlameActivity==='function')window.yamFlameActivity('ocho_together');
  }

  // ─── Emoji picker (corrigé) ───────────────────────────
  var OCHO_EMOJIS=['\uD83C\uDF89','\uD83D\uDD25','\uD83D\uDCA5','\uD83C\uDF1F','\uD83D\uDE02','\uD83D\uDC4F','\u2764\uFE0F','\uD83D\uDE0E'];

  function _setupEmojiPicker(){
    var pill=document.getElementById('ochoEmojiPill');
    var btnE=document.getElementById('ochoEmojiBtn');
    var btnH=document.getElementById('ochoHeartBtn');
    if(!pill||!btnE||pill.dataset.init)return;
    pill.dataset.init='1';
    pill.innerHTML='';

    OCHO_EMOJIS.forEach(function(em){
      var sp=document.createElement('button');sp.className='oc-epick';sp.type='button';sp.textContent=em;
      sp.addEventListener('click',function(e){e.stopPropagation();_closePill();_sendReaction(em);});
      pill.appendChild(sp);
    });

    function _closePill(){
      _pillOpen=false;pill.classList.remove('open');btnE.textContent='\uD83D\uDE04';
      if(btnH){btnH.style.opacity='1';btnH.style.pointerEvents='all';}
    }

    btnE.addEventListener('click',function(e){
      e.stopPropagation();e.preventDefault();
      _pillOpen=!_pillOpen;pill.classList.toggle('open',_pillOpen);
      btnE.textContent=_pillOpen?'\u2715':'\uD83D\uDE04';
      if(btnH){btnH.style.opacity=_pillOpen?'0':'1';btnH.style.pointerEvents=_pillOpen?'none':'all';}
    });

    // Fermer sur clic extérieur
    document.addEventListener('click',function(e){
      if(_pillOpen&&!pill.contains(e.target)&&e.target!==btnE)_closePill();
    },{capture:false,passive:true});

    if(btnH){
      btnH.addEventListener('click',function(e){e.stopPropagation();_spawnHearts();});
    }
  }

  function _sendReaction(emoji){
    if(_reactCooldown)return;_reactCooldown=true;setTimeout(function(){_reactCooldown=false;},2500);
    _showAnimEmoji(emoji);
    if(!_mp||!_mp.isLaunched()||_mp.isSaving()||!_state)return;
    var ns=_deepCopy(_state);ns.reaction={player:_me,emoji:emoji,ts:Date.now()};_mp.saveState(ns);
  }

  function _checkIncomingReaction(state){
    if(!state||!state.reaction)return;
    var r=state.reaction;
    if(!r.player||!r.emoji||!r.ts||r.player===_me||r.ts===_lastReactTs)return;
    _lastReactTs=r.ts;_showAnimEmoji(r.emoji);
  }

  function _showAnimEmoji(emoji){
    var el=document.getElementById('ochoAnimText');if(!el)return;
    el.textContent=emoji;el.style.animation='none';void el.offsetWidth;
    el.classList.remove('oc-anim-hide');el.classList.add('oc-anim-show');el.style.opacity='1';
    clearTimeout(window._ochoAnimT);
    window._ochoAnimT=setTimeout(function(){
      el.classList.remove('oc-anim-show');el.classList.add('oc-anim-hide');
      setTimeout(function(){el.classList.remove('oc-anim-hide');el.style.opacity='0';},350);
    },1800);
  }

  function _spawnHearts(){
    var screen=document.getElementById('ochoView'),btn=document.getElementById('ochoHeartBtn');
    if(!screen||!btn)return;
    for(var i=0;i<7;i++){(function(d){setTimeout(function(){
      var h=document.createElement('div');h.className='oc-heart';h.textContent='\u2665';
      h.style.setProperty('--dx',(Math.random()-0.5)*120+'px');
      h.style.left=(btn.offsetLeft+6+Math.random()*34)+'px';
      h.style.bottom='90px';h.style.fontSize=(20+Math.random()*16)+'px';
      screen.appendChild(h);setTimeout(function(){h.remove();},2300);
    },d);})(i*110);}
  }

  function _updateWaitNames(){
    var gn=typeof v2GetDisplayName==='function'?v2GetDisplayName('girl'):'Rose';
    var bn=typeof v2GetDisplayName==='function'?v2GetDisplayName('boy'):'Bleu';
    var g=document.getElementById('ochoWaitNameGirl');if(g)g.textContent=gn;
    var b=document.getElementById('ochoWaitNameBoy');if(b)b.textContent=bn;
  }

  function _leaveOchoView(){
    _stopTimer();
    var ov=document.getElementById('ochoView'),gv=document.getElementById('gamesView');
    if(typeof _yamSlide==='function')_yamSlide(gv,ov,'backward');
    else if(ov){ov.classList.remove('active');ov.style.display='none';}
    var nav=document.querySelector('.bottom-nav');if(nav)nav.style.display='';
    if(typeof window._corePresenceResume==='function')window._corePresenceResume();
  }

  // ─── Listeners ────────────────────────────────────────
  var _listenersSet=false;
  function _setupListeners(){
    if(_listenersSet)return;_listenersSet=true;
    document.addEventListener('click',function(e){
      var t=e.target;
      function cl(sel){var el=t;while(el){if(el.matches&&el.matches(sel))return el;el=el.parentElement;}return null;}
      if(cl('#ochoLeaveWaitBtn')){if(_mp)_mp.leave();_resetLocalState();_leaveOchoView();return;}
      if(cl('#ochoBackBtn')){
        if(_mp&&_mp.isLaunched())_mp.abandon(function(){_resetLocalState();_leaveOchoView();});
        else{if(_mp)_mp.leave();_resetLocalState();_leaveOchoView();}
        return;
      }
      if(cl('#ochoAbandonBtn')){
        if(!_mp)return;
        _mp.abandon(function(){_resetLocalState();var b=document.getElementById('ochoAbandonBtn');if(b)b.style.display='none';_leaveOchoView();});
        return;
      }
      if(cl('#ochoDeckCard')||t.id==='ochoDeckCard'){_onDrawCard();return;}
      if(cl('#ochoPassBtn')){_onPassTurn();return;}
      if(cl('#ochoBtn')||t.id==='ochoBtn'){_onOchoBtn();return;}
      if(cl('#ochoNextRoundBtn')){
        if(!_state)return;
        if((_state.round||1)>=6){if(_mp.isSaving())return;var ns=_deepCopy(_state);ns.phase='game_end';_mp.saveState(ns);}
        else _startNextRound(_state);
        return;
      }
      if(cl('#ochoNewGameBtn')){
        if(!_mp)return;_mp.stopPoll();var gid=_mp.getGameId();if(!gid)return;
        fetch(SB_URL+'/rest/v1/'+OCHO_TABLE+'?id=eq.'+gid,{method:'DELETE',headers:sb2Headers()})
          .then(function(){document.getElementById('ochoGameEnd').style.display='none';_mp.enterLobby();}).catch(function(){});
        return;
      }
      if(cl('#ochoCloseEndBtn')){if(_mp)_mp.leave();_resetLocalState();_leaveOchoView();return;}
      // Désélection si clic hors carte
      if(_selectedCard&&!cl('.oc-card')){
        _selectedCard=null;
        if(_state){
          var myH=_me==='girl'?_state.girl_hand:_state.boy_hand;
          _renderMyCards(myH,_playableCards(myH,_state),_state.turn===_me);
        }
      }
    });
    document.addEventListener('visibilitychange',function(){
      var v=document.getElementById('ochoView');
      if(!v||(!v.classList.contains('active')&&v.style.display!=='block'))return;
      if(document.hidden){_stopTimer();if(_mp){_mp.deletePresence();_mp.refreshRates();}}
      else{if(_mp){_mp.upsertPresence();_mp.refreshRates();}}
    });
    window.addEventListener('pagehide',function(){
      var v=document.getElementById('ochoView');
      if(v&&(v.classList.contains('active')||v.style.display==='block')&&_mp)_mp.deletePresence();
    });
  }

  // ─── Carte gamesView ──────────────────────────────────
  (function(){
    function tryInject(){
      var list=document.querySelector('#gamesView .gv-game-list');
      if(!list){setTimeout(tryInject,500);return;}
      if(document.getElementById('ochoCard'))return;
      var card=document.createElement('div');card.className='gv-game-card';card.id='ochoCard';card.style.cssText='position:relative;overflow:hidden;';
      var icon=document.createElement('div');icon.className='gv-game-card-icon';icon.textContent='\uD83C\uDCCF';
      var info=document.createElement('div');info.className='gv-game-card-info';
      var name=document.createElement('div');name.className='gv-game-card-name';name.textContent='Ocho';
      var desc=document.createElement('div');desc.className='gv-game-card-desc';desc.textContent='Le UNO version YAM \u2014 6 manches';
      var arr=document.createElement('div');arr.className='gv-game-card-arrow';arr.textContent='\u203a';
      info.appendChild(name);info.appendChild(desc);card.appendChild(icon);card.appendChild(info);card.appendChild(arr);
      list.insertBefore(card,list.firstChild);
    }
    tryInject();
  })();

  window._ochoRefreshRates  =function(){if(_mp)_mp.refreshRates();};
  window._ochoDeletePresence=function(){if(_mp)_mp.deletePresence();};
  window._ochoUpsertPresence=function(){if(_mp)_mp.upsertPresence();};
  window._ochoMarkAbsence   =function(){if(_mp)_mp.markAbsence();};

})();

/* ══════════════════════════════════════════════════════════════
   OCHO — BG-PAUSE
══════════════════════════════════════════════════════════════ */
(function(){
  function isActive(){var v=document.getElementById('ochoView');return v&&(v.classList.contains('active')||v.style.display==='block');}
  function pause(){if(typeof window._ochoDeletePresence==='function')window._ochoDeletePresence();if(typeof window._ochoRefreshRates==='function')window._ochoRefreshRates();}
  function resume(){if(typeof window._ochoUpsertPresence==='function')window._ochoUpsertPresence();if(typeof window._ochoRefreshRates==='function')window._ochoRefreshRates();}
  document.addEventListener('visibilitychange',function(){if(!isActive())return;if(document.hidden)pause();else resume();});
  window.addEventListener('pagehide',function(){if(isActive())pause();});
  window.addEventListener('pageshow',function(){if(isActive()&&!document.hidden)resume();});
  window.addEventListener('blur',    function(){if(isActive())pause();});
  window.addEventListener('focus',   function(){if(isActive()&&!document.hidden)resume();});
})();
