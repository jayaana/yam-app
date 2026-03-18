// app-ocho.js — Ocho multijoueur temps réel
// Version 1.0 — Mars 2026
// Dépendances (chargées avant) : app-core.js, app-account.js, app-multiplayer.js
// Globals utilisés : SB_URL, sb2Headers(), getProfile(), v2GetDisplayName(),
//                    _yamSlide(), showToast(), haptic(), YAMMultiplayer

/* ══════════════════════════════════════════════════════
   OCHO — Jeu de cartes multijoueur (type UNO)
   108 cartes, 6 manches, 7 cartes en main
   Cartes spéciales : +1(Q), +2(K), Blocage(J), 8(joker couleur), Changement de main
   Moteur réseau délégué à app-multiplayer.js via YAMMultiplayer.init()
══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var OCHO_TABLE    = 'ocho_games';
  var OCHO_PRESENCE = 'ocho_presence';
  var TURN_DURATION = 20; // secondes

  // ─── État local ──────────────────────────────────────
  var _mp         = null;
  var _me         = null;
  var _other      = null;
  var _state      = null;
  var _timerRAF   = null;
  var _timerStart = 0;
  var _timerFired = false;
  var _reactCooldown = false;
  var _lastReactTs   = 0;

  // ─── Deck ─────────────────────────────────────────────
  // Valeurs : 0-9, +1(Q), +2(K), blocage(J), swap(S), 8(wild)
  // Couleurs : heart, club, spade, diamond
  // Composition UNO 108 cartes :
  //   • 1 × 0 par couleur = 4
  //   • 2 × 1-9 par couleur = 72
  //   • 2 × +1(Q) par couleur = 8
  //   • 2 × +2(K) par couleur = 8
  //   • 2 × blocage(J) par couleur = 8
  //   • 4 × 8 wild = 4
  //   • 4 × swap = 4  (changement de main)
  //   Total = 108

  var SUITS = ['heart','club','spade','diamond'];
  var _cardId = 0;

  function _mkCard(suit, value) {
    return { id: ++_cardId, suit: suit, value: value };
  }

  function buildDeck() {
    var d = [];
    SUITS.forEach(function (s) {
      d.push(_mkCard(s, '0'));
      for (var n = 1; n <= 9; n++) {
        d.push(_mkCard(s, String(n)));
        d.push(_mkCard(s, String(n)));
      }
      d.push(_mkCard(s, '+1')); d.push(_mkCard(s, '+1')); // Q
      d.push(_mkCard(s, '+2')); d.push(_mkCard(s, '+2')); // K
      d.push(_mkCard(s, 'block')); d.push(_mkCard(s, 'block')); // J
    });
    // 4 wild 8
    for (var i = 0; i < 4; i++) d.push(_mkCard('wild', '8'));
    // 4 swap (changement de main)
    for (var j = 0; j < 4; j++) d.push(_mkCard('swap', 'swap'));
    return _shuffle(d);
  }

  function _shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function _dealHand(deck, n) {
    n = n || 7;
    var hand = [];
    for (var i = 0; i < n; i++) hand.push(deck.pop());
    return hand;
  }

  function _reshuffleDiscard(state) {
    // Garde le top de la défausse, reshufle le reste dans la pioche
    var top = state.discard[state.discard.length - 1];
    var rest = _shuffle(state.discard.slice(0, state.discard.length - 1));
    state.deck = rest;
    state.discard = [top];
  }

  // ─── Règles ───────────────────────────────────────────

  function _isPlayable(card, state) {
    var top = state.discard[state.discard.length - 1];
    if (!top) return true;
    // Wild 8 et swap : toujours jouables
    if (card.value === '8' || card.value === 'swap') return true;
    // Même couleur (en tenant compte de la couleur déclarée après un 8)
    var activeColor = state.current_color || top.suit;
    if (card.suit === activeColor) return true;
    // Même valeur
    if (card.value === top.value) return true;
    return false;
  }

  function _playableCards(hand, state) {
    return hand.filter(function (c) { return _isPlayable(c, state); });
  }

  // Applique l'effet d'une carte jouée, retourne le nouvel état
  function _applyCard(state, card, player, chosenColor) {
    var ns = _deepCopy(state);
    var other = player === 'girl' ? 'boy' : 'girl';
    var hand = player === 'girl' ? ns.girl_hand : ns.boy_hand;

    // Retirer la carte de la main
    var idx = hand.findIndex(function (c) { return c.id === card.id; });
    if (idx !== -1) hand.splice(idx, 1);

    // Mettre à jour la main
    if (player === 'girl') ns.girl_hand = hand;
    else ns.boy_hand = hand;

    // Ajouter à la défausse
    ns.discard.push(card);
    ns.current_color = card.suit === 'wild' || card.suit === 'swap' ? (chosenColor || 'heart') : card.suit;

    // Effets spéciaux
    ns.draw_penalty = null;
    ns.skip_next    = false;

    if (card.value === '+1') {
      // Adversaire pioche 1 carte — mais peut quand même jouer
      ns.draw_penalty = { target: other, count: 1 };
      ns.turn = other; // on passe quand même
    } else if (card.value === '+2') {
      ns.draw_penalty = { target: other, count: 2 };
      ns.turn = other;
    } else if (card.value === 'block') {
      // Adversaire perd son tour
      ns.turn = player; // reste sur le même joueur
    } else if (card.value === '8') {
      // Joker couleur — couleur choisie dans chosenColor
      ns.current_color = chosenColor || 'heart';
      ns.turn = other;
    } else if (card.value === 'swap') {
      // Échange les mains
      var tmp = ns.girl_hand;
      ns.girl_hand = ns.boy_hand;
      ns.boy_hand = tmp;
      ns.turn = other;
    } else {
      ns.turn = other;
    }

    ns.ts_turn = Date.now();
    ns.ocho_declared = null; // reset après chaque carte jouée

    // Vérifier fin de manche
    var myHandAfter = player === 'girl' ? ns.girl_hand : ns.boy_hand;
    if (myHandAfter.length === 0) {
      ns.phase = 'round_end';
      ns.round_winner = player;
      ns.wins[player] = (ns.wins[player] || 0) + 1;
    }

    return ns;
  }

  function _drawCard(state, player) {
    var ns = _deepCopy(state);
    if (ns.deck.length === 0) _reshuffleDiscard(ns);
    if (ns.deck.length === 0) return ns; // défense
    var card = ns.deck.pop();
    if (player === 'girl') ns.girl_hand.push(card);
    else ns.boy_hand.push(card);
    ns.turn = player; // peut jouer après avoir pioché
    ns.ts_turn = Date.now();
    return ns;
  }

  function _applyDrawPenalty(state) {
    var ns = _deepCopy(state);
    if (!ns.draw_penalty) return ns;
    var target = ns.draw_penalty.target;
    var count  = ns.draw_penalty.count;
    for (var i = 0; i < count; i++) {
      if (ns.deck.length === 0) _reshuffleDiscard(ns);
      if (ns.deck.length === 0) break;
      ns[target + '_hand'].push(ns.deck.pop());
    }
    ns.draw_penalty = null;
    return ns;
  }

  function _deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  // ─── Rendu des cartes ─────────────────────────────────

  var SUIT_SYMBOLS = { heart: '♥', club: '♣', spade: '♠', diamond: '♦' };
  var SUIT_COLORS  = { heart: '#E04E3E', club: '#4CB8A0', spade: '#5070B8', diamond: '#E89030' };
  var SUIT_DARK    = { heart: '#bf3020', club: '#3A9E88', spade: '#3A58A0', diamond: '#C07010' };

  function _cardSVG(card, opts) {
    opts = opts || {};
    var w = opts.w || 52, h = opts.h || 73;
    var rx = opts.rx || 9;

    if (!card) return _cardBackSVG(opts);

    // Dos de carte
    if (card === 'back') return _cardBackSVG(opts);

    // Wild 8
    if (card.value === '8') return _card8SVG(card, opts);

    // Swap (changement de main)
    if (card.value === 'swap') return _cardSwapSVG(opts);

    var bg  = SUIT_COLORS[card.suit]  || '#888';
    var dk  = SUIT_DARK[card.suit]    || '#555';
    var sym = SUIT_SYMBOLS[card.suit] || '?';

    var valueDisplay = card.value;
    if (card.value === '+1')    valueDisplay = '+1';
    if (card.value === '+2')    valueDisplay = '+2';
    if (card.value === 'block') valueDisplay = '⊘';

    var fsBig  = valueDisplay.length > 1 ? 11 : 13;
    var fsSmall = 10;

    // Sous-label (Q pour +1, K pour +2, J pour block)
    var subLabel = '';
    if (card.value === '+1')    subLabel = 'Q';
    if (card.value === '+2')    subLabel = 'K';
    if (card.value === 'block') subLabel = 'J';

    return '<svg viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">'
      + '<rect width="'+w+'" height="'+h+'" rx="'+rx+'" fill="#F2E8D4"/>'
      + '<rect x="2" y="2" width="'+(w-4)+'" height="'+(h-4)+'" rx="'+(rx-1)+'" fill="'+bg+'"/>'
      // Symbole géant en fond
      + '<text x="'+(w*-0.35)+'" y="'+(h*0.55)+'" font-family="Arial Black,sans-serif" font-size="'+(h*0.95)+'" fill="#F2E8D4" opacity="0.18">'+sym+'</text>'
      // Valeur principale
      + '<text x="7" y="'+(fsBig+5)+'" font-family="Arial Black,sans-serif" font-weight="900" font-size="'+fsBig+'" fill="'+dk+'">'+valueDisplay+'</text>'
      + (subLabel ? '<text x="7" y="'+(fsBig+5+fsSmall+1)+'" font-family="Arial Black,sans-serif" font-weight="900" font-size="'+fsSmall+'" fill="'+dk+'">'+subLabel+'</text>' : '')
      // Symbole couleur petit
      + '<text x="7" y="'+(fsBig+5+(subLabel?fsSmall+1:0)+fsSmall+2)+'" font-family="Arial,sans-serif" font-size="'+fsSmall+'" fill="'+dk+'">'+sym+'</text>'
      + '</svg>';
  }

  function _cardBackSVG(opts) {
    opts = opts || {};
    var w = opts.w || 52, h = opts.h || 73, rx = opts.rx || 9;
    return '<svg viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">'
      + '<rect width="'+w+'" height="'+h+'" rx="'+rx+'" fill="#F2E8D4"/>'
      + '<rect x="2" y="2" width="'+(w-4)+'" height="'+(h-4)+'" rx="'+(rx-1)+'" fill="#2a1205"/>'
      + '<rect x="2" y="2" width="'+(w-4)+'" height="'+(h-4)+'" rx="'+(rx-1)+'" fill="none" stroke="rgba(242,232,212,0.15)" stroke-width="1"/>'
      + '<text x="'+(w/2)+'" y="'+(h-6)+'" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="9" fill="rgba(242,232,212,0.5)" letter-spacing="2">YAM</text>'
      + '</svg>';
  }

  function _card8SVG(card, opts) {
    opts = opts || {};
    var w = opts.w || 52, h = opts.h || 73, rx = opts.rx || 9;
    // Couleur du 8 selon current_color si déclenché
    var bg = opts.color ? (SUIT_COLORS[opts.color] || '#888') : '#1a1a1a';
    var textFill = '#F2E8D4';
    return '<svg viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">'
      + '<rect width="'+w+'" height="'+h+'" rx="'+rx+'" fill="#F2E8D4"/>'
      + '<rect x="2" y="2" width="'+(w-4)+'" height="'+(h-4)+'" rx="'+(rx-1)+'" fill="'+bg+'"/>'
      + '<text x="'+(w/2)+'" y="'+(h*0.92)+'" text-anchor="middle" font-family="Nunito,Arial Black,sans-serif" font-weight="900" font-size="'+(h*1.2)+'" fill="'+textFill+'" opacity="0.95" transform="rotate(8,'+(w/2)+','+(h*0.92)+')">8</text>'
      + '</svg>';
  }

  function _cardSwapSVG(opts) {
    opts = opts || {};
    var w = opts.w || 52, h = opts.h || 73, rx = opts.rx || 9;
    // Fond 4 couleurs (quart chacun)
    var hw = w/2, hh = h/2;
    return '<svg viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">'
      + '<rect width="'+w+'" height="'+h+'" rx="'+rx+'" fill="#F2E8D4"/>'
      + '<clipPath id="ocp'+opts.uid+'"><rect x="2" y="2" width="'+(w-4)+'" height="'+(h-4)+'" rx="'+(rx-1)+'"/></clipPath>'
      + '<g clip-path="url(#ocp'+opts.uid+')">'
      + '<rect x="2" y="2" width="'+hw+'" height="'+hh+'" fill="#C8392B"/>'
      + '<rect x="'+(hw)+'" y="2" width="'+hw+'" height="'+hh+'" fill="#2E8B6A"/>'
      + '<rect x="2" y="'+(hh)+'" width="'+hw+'" height="'+hh+'" fill="#C87020"/>'
      + '<rect x="'+(hw)+'" y="'+(hh)+'" width="'+hw+'" height="'+hh+'" fill="#2D4F9E"/>'
      + '</g>'
      + '<rect x="2" y="2" width="'+(w-4)+'" height="'+(h-4)+'" rx="'+(rx-1)+'" fill="none" stroke="rgba(242,232,212,0.6)" stroke-width="1.5"/>'
      // Flèches swap
      + '<text x="'+(w*0.28)+'" y="'+(h*0.52)+'" text-anchor="middle" font-family="Arial,sans-serif" font-size="'+(w*0.38)+'" fill="#F2E8D4" opacity="0.9">⇄</text>'
      + '</svg>';
  }

  // ─── Construction HTML de l'interface ─────────────────

  function _buildOchoHTML() {
    return /* html */`
<div id="ochoView" style="display:none;position:fixed;inset:0;z-index:200;background:var(--bg);overflow:hidden;flex-direction:column;">

  <!-- HEADER -->
  <div class="game-view-header" id="ochoHeader">
    <div id="ochoBackBtn" class="game-view-back">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      Retour aux jeux
    </div>
    <div class="game-view-title">Ocho 🃏</div>
    <button id="ochoAbandonBtn" style="display:none;padding:4px 10px;background:rgba(239,83,80,0.12);color:#ef5350;border:1px solid rgba(239,83,80,0.35);border-radius:6px;font-size:11px;font-weight:700;font-family:'Bricolage Grotesque',sans-serif;cursor:pointer;">Abandon</button>
  </div>

  <div class="game-view-body" style="padding:0;position:relative;flex:1;overflow:hidden;">

    <!-- ══ ÉCRAN ATTENTE ══ -->
    <div id="ochoWaitScreen" style="display:none;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:20px;text-align:center;padding:24px;">
      <div style="font-size:52px">⏳</div>
      <div style="font-family:'Bricolage Grotesque',sans-serif;font-size:20px;font-weight:700;color:var(--text)">En attente…</div>
      <div id="ochoWaitMsg" style="font-size:14px;color:var(--sub);max-width:280px;line-height:1.6"></div>
      <div style="display:flex;gap:12px;align-items:center;margin-top:4px;">
        <div class="ocho-player-bubble" id="ochoWaitBubbleGirl">
          <div id="ochoWaitAvatarGirl" style="width:52px;height:52px;border-radius:50%;overflow:hidden;border:2.5px solid rgba(240,102,136,0.6);flex-shrink:0;">
            <img class="yam-av-img" src="assets/images/profil_girl.png" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">
          </div>
          <div style="font-size:10px;font-weight:700;color:#f06688;" id="ochoWaitNameGirl">Rose</div>
          <div class="ocho-presence-dot" id="ochoPresenceGirl"></div>
        </div>
        <div style="font-size:24px;color:var(--muted)">vs</div>
        <div class="ocho-player-bubble" id="ochoWaitBubbleBoy">
          <div id="ochoWaitAvatarBoy" style="width:52px;height:52px;border-radius:50%;overflow:hidden;border:2.5px solid rgba(90,200,250,0.6);flex-shrink:0;">
            <img class="yam-av-img" src="assets/images/profil_boy.png" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">
          </div>
          <div style="font-size:10px;font-weight:700;color:#5ac8fa;" id="ochoWaitNameBoy">Bleu</div>
          <div class="ocho-presence-dot" id="ochoPresenceBoy"></div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">La partie se lance automatiquement quand vous êtes tous les deux connectés 🎮</div>
      <button id="ochoLeaveWaitBtn" style="margin-top:8px;padding:10px 24px;background:var(--s2);color:var(--sub);border:1px solid var(--border);border-radius:50px;font-size:13px;font-weight:600;font-family:'Bricolage Grotesque',sans-serif;cursor:pointer;">Annuler</button>
    </div>

    <!-- ══ AIRE DE JEU ══ -->
    <div id="ochoGameArea" style="display:none;flex-direction:column;height:100%;position:relative;overflow:hidden;">

      <!-- Zone animation emoji (haut) -->
      <div id="ochoAnimZone" style="position:absolute;top:0;left:0;right:0;height:80px;display:flex;align-items:center;justify-content:center;z-index:30;pointer-events:none;overflow:hidden;">
        <div id="ochoAnimText" style="font-size:56px;opacity:0;font-family:'Nunito',sans-serif;font-weight:900;text-shadow:0 4px 20px rgba(0,0,0,0.4);transition:opacity 0.2s;"></div>
      </div>

      <!-- Aura OCHO -->
      <div id="ochoAuraOverlay" style="position:absolute;inset:0;border-radius:0;pointer-events:none;opacity:0;z-index:5;transition:opacity 0.3s;"></div>

      <!-- Profil adversaire + ses cartes -->
      <div id="ochoOppBlock" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 16px 0;z-index:10;">
        <!-- Cartes adversaire (dos) -->
        <div id="ochoOppCards" style="display:flex;gap:-8px;justify-content:center;min-height:60px;"></div>
        <!-- Profil pill adversaire -->
        <div id="ochoOppPill" style="display:inline-flex;align-items:center;gap:10px;padding:6px 16px 6px 6px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:28px;backdrop-filter:blur(10px);align-self:flex-start;margin-top:4px;">
          <div style="position:relative;width:52px;height:52px;flex-shrink:0;">
            <svg id="ochoOppTimerSVG" viewBox="0 0 38 38" fill="none" style="position:absolute;inset:0;transform:rotate(-90deg);width:100%;height:100%;">
              <circle cx="19" cy="19" r="15" stroke="rgba(255,255,255,0.12)" stroke-width="5"/>
              <circle cx="19" cy="19" r="15" id="ochoOppTimerArc" stroke="rgba(180,120,40,0.55)" stroke-width="5" stroke-dasharray="94.2 0" stroke-linecap="round"/>
            </svg>
            <div id="ochoOppAvatar" style="position:absolute;inset:8px;border-radius:50%;background:linear-gradient(135deg,#c87840,#7a4020);display:flex;align-items:center;justify-content:center;font-size:20px;overflow:hidden;">
              <img id="ochoOppAvatarImg" class="yam-av-img" src="assets/images/profil_girl.png" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">
            </div>
            <div id="ochoOppPresenceDot" style="position:absolute;bottom:4px;right:4px;width:10px;height:10px;border-radius:50%;background:#555;border:2px solid var(--bg);transition:background 0.3s,box-shadow 0.3s;"></div>
          </div>
          <div>
            <div id="ochoOppName" style="font-family:'Bricolage Grotesque',sans-serif;font-size:16px;font-weight:700;color:var(--text);line-height:1;">Julie</div>
            <div id="ochoOppSub" style="font-size:11px;color:var(--muted);margin-top:3px;">en attente</div>
          </div>
        </div>
      </div>

      <!-- Table centrale -->
      <div id="ochoTableZone" style="flex:1;display:flex;align-items:center;justify-content:center;position:relative;z-index:10;">
        <!-- Ellipse table -->
        <div id="ochoTable" style="width:220px;height:130px;border-radius:50%;background:radial-gradient(ellipse at 32% 30%,rgba(80,52,30,0.55) 0%,transparent 58%),linear-gradient(150deg,#382010 0%,#241208 45%,#180c06 100%);border:1.5px solid rgba(140,90,35,0.3);box-shadow:0 10px 44px rgba(0,0,0,0.75),inset 0 1px 0 rgba(255,255,255,0.035);position:relative;display:flex;align-items:center;justify-content:center;">
          <!-- Compteur tour -->
          <div id="ochoTurnCount" style="position:absolute;top:8px;right:12px;color:rgba(200,140,50,0.6);font-size:11px;font-family:'Bricolage Grotesque',sans-serif;font-weight:700;"></div>
          <div style="display:flex;align-items:center;gap:14px;">
            <!-- Pioche -->
            <div style="position:relative;">
              <div id="ochoDeckCard" style="width:46px;height:64px;border-radius:8px;cursor:pointer;overflow:hidden;box-shadow:0 3px 10px rgba(0,0,0,0.5);border:2px solid rgba(242,232,212,0.7);"></div>
              <div id="ochoDeckCount" style="position:absolute;top:-7px;right:-7px;background:#160a04;color:rgba(242,232,212,0.8);border:1.5px solid rgba(180,120,35,0.6);border-radius:9px;padding:1px 5px;font-size:9px;font-weight:900;font-family:'Arial Black',sans-serif;"></div>
            </div>
            <!-- Défausse -->
            <div style="position:relative;">
              <div id="ochoDiscardCard" style="width:46px;height:64px;border-radius:8px;overflow:hidden;box-shadow:0 3px 10px rgba(0,0,0,0.5);border:2px solid rgba(242,232,212,0.85);"></div>
              <!-- Dot couleur active -->
              <div id="ochoColorDot" style="position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);width:16px;height:16px;border-radius:50%;border:2px solid rgba(242,232,212,0.75);box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>
            </div>
          </div>
        </div>

        <!-- Barre timer -->
        <div id="ochoTimerBar" style="position:absolute;bottom:0;left:0;right:0;height:3px;background:rgba(255,255,255,0.08);">
          <div id="ochoTimerFill" style="height:100%;width:100%;background:#FFD700;transform-origin:left;transition:width 1s linear;"></div>
        </div>
      </div>

      <!-- Zone joueur local -->
      <div id="ochoMeBlock" style="display:flex;flex-direction:column;align-items:center;gap:0;padding:0 16px;z-index:10;">
        <!-- Ligne profil + bouton OCHO -->
        <div id="ochoMeRow" style="display:flex;align-items:center;align-self:stretch;margin-bottom:8px;">
          <!-- Profil -->
          <div style="display:inline-flex;align-items:center;gap:10px;">
            <div style="position:relative;width:52px;height:52px;flex-shrink:0;">
              <svg viewBox="0 0 38 38" fill="none" style="position:absolute;inset:0;transform:rotate(-90deg);width:100%;height:100%;">
                <circle cx="19" cy="19" r="15" stroke="rgba(255,255,255,0.12)" stroke-width="5"/>
                <circle cx="19" cy="19" r="15" id="ochoMeTimerArc" stroke="#FFD700" stroke-width="5" stroke-dasharray="94.2 0" stroke-linecap="round" style="filter:drop-shadow(0 0 5px rgba(255,215,0,0.7));"/>
              </svg>
              <div id="ochoMeAvatar" style="position:absolute;inset:8px;border-radius:50%;background:linear-gradient(135deg,#7040b0,#402880);display:flex;align-items:center;justify-content:center;font-size:20px;overflow:hidden;">
                <img id="ochoMeAvatarImg" class="yam-av-img" src="assets/images/profil_boy.png" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">
              </div>
            </div>
            <div>
              <div id="ochoMeName" style="font-family:'Bricolage Grotesque',sans-serif;font-size:16px;font-weight:700;color:#FFD700;line-height:1;">Toi</div>
              <div id="ochoMeTurnPill" style="display:none;margin-top:3px;display:inline-flex;align-items:center;gap:5px;background:rgba(255,215,0,0.12);border:1px solid rgba(255,215,0,0.35);border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;color:#FFD700;">
                <span style="width:6px;height:6px;border-radius:50%;background:#FFD700;box-shadow:0 0 4px 1px rgba(255,215,0,0.7);display:inline-block;"></span>
                Ton tour
              </div>
            </div>
          </div>
          <!-- Bouton OCHO -->
          <button id="ochoBtn" style="margin-left:auto;background:linear-gradient(135deg,#c83020,#e04535);color:#F2E8D4;border:2px solid rgba(242,232,212,0.75);border-radius:18px;padding:8px 16px;font-size:13px;font-weight:900;font-family:'Arial Black',sans-serif;letter-spacing:0.04em;box-shadow:0 3px 12px rgba(200,50,30,0.4);cursor:pointer;">¡ OCHO !</button>
        </div>

        <!-- Mes cartes (arc) -->
        <div id="ochoMyCards" style="position:relative;width:100%;min-height:80px;display:flex;justify-content:center;align-items:flex-end;margin-bottom:2px;"></div>

        <!-- Hint jouable -->
        <div id="ochoHint" style="display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:5px 14px;margin-bottom:4px;backdrop-filter:blur(8px);">
          <span id="ochoHintSuit" style="font-size:14px;line-height:1;"></span>
          <span id="ochoHintText" style="font-size:11px;font-weight:700;color:rgba(242,232,212,0.7);letter-spacing:0.03em;"></span>
          <span id="ochoHintBadge" style="background:#5070B8;color:#F2E8D4;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:900;font-family:'Arial Black',sans-serif;"></span>
        </div>
      </div>

      <!-- Safe zone (emoji + coeur) -->
      <div id="ochoSafeZone" style="position:absolute;bottom:0;left:0;right:0;height:80px;display:flex;align-items:center;justify-content:space-between;padding:0 24px 32px;z-index:50;">
        <!-- Emoji picker wrap -->
        <div id="ochoEmojiWrap" style="position:relative;display:flex;align-items:center;">
          <div id="ochoEmojiPill" style="display:flex;align-items:center;gap:2px;background:rgba(0,0,0,0.45);border:1.5px solid rgba(255,255,255,0.15);backdrop-filter:blur(12px);border-radius:30px;padding:0;position:absolute;left:52px;max-width:0;overflow:hidden;opacity:0;pointer-events:none;transition:max-width 0.32s cubic-bezier(.4,0,.2,1),opacity 0.22s ease,padding 0.32s ease;white-space:nowrap;"></div>
          <button id="ochoEmojiBtn" style="width:46px;height:46px;border-radius:50%;background:rgba(0,0,0,0.35);border:1.5px solid rgba(255,255,255,0.15);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;">😄</button>
        </div>
        <!-- Bouton coeur -->
        <button id="ochoHeartBtn" style="width:46px;height:46px;border-radius:50%;background:rgba(0,0,0,0.35);border:1.5px solid rgba(255,255,255,0.15);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;transition:opacity 0.2s ease;">🤍</button>
      </div>

      <!-- Overlay manche suivante -->
      <div id="ochoRoundEnd" style="display:none;position:absolute;inset:0;z-index:150;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);">
        <div id="ochoRoundEndEmoji" style="font-size:52px;">🏆</div>
        <div id="ochoRoundEndTitle" style="font-family:'Bricolage Grotesque',sans-serif;font-size:22px;font-weight:700;color:var(--text);line-height:1.3;"></div>
        <div id="ochoRoundEndSub" style="font-size:12px;color:var(--muted);font-weight:600;letter-spacing:0.5px;"></div>
        <!-- Scores manches -->
        <div style="display:flex;gap:12px;width:100%;max-width:280px;">
          <div style="flex:1;background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:16px 12px;text-align:center;">
            <div id="ochoRoundAvLeft" style="width:40px;height:40px;border-radius:50%;overflow:hidden;margin:0 auto 6px;background:var(--s2);"><img src="assets/images/profil_girl.png" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"></div>
            <div id="ochoRoundLabelLeft" style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px;">Rose</div>
            <div style="font-size:13px;color:var(--muted);margin-bottom:2px;">Manches</div>
            <div id="ochoRoundWinsLeft" style="font-size:28px;font-weight:800;color:var(--text);">0</div>
          </div>
          <div style="flex:1;background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:16px 12px;text-align:center;">
            <div id="ochoRoundAvRight" style="width:40px;height:40px;border-radius:50%;overflow:hidden;margin:0 auto 6px;background:var(--s2);"><img src="assets/images/profil_boy.png" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"></div>
            <div id="ochoRoundLabelRight" style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px;">Bleu</div>
            <div style="font-size:13px;color:var(--muted);margin-bottom:2px;">Manches</div>
            <div id="ochoRoundWinsRight" style="font-size:28px;font-weight:800;color:var(--text);">0</div>
          </div>
        </div>
        <div id="ochoRoundProgress" style="font-size:11px;color:var(--muted);font-weight:600;"></div>
        <div id="ochoNextRoundWrap" style="display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:280px;">
          <button id="ochoNextRoundBtn" style="width:100%;padding:14px 0;background:var(--green,#22c55e);color:#000;font-weight:700;font-size:15px;font-family:'Bricolage Grotesque',sans-serif;border:none;border-radius:50px;cursor:pointer;">Manche suivante →</button>
          <div id="ochoWaitNextMsg" style="display:none;font-size:12px;color:var(--muted);font-weight:600;">⏳ En attente que l'autre lance la manche…</div>
        </div>
      </div>

      <!-- Overlay fin de partie -->
      <div id="ochoGameEnd" style="display:none;position:absolute;inset:0;z-index:160;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;background:rgba(0,0,0,0.92);backdrop-filter:blur(12px);">
        <div id="ochoGameEndEmoji" style="font-size:72px;">🏆</div>
        <div id="ochoGameEndTitle" style="font-family:'Bricolage Grotesque',sans-serif;font-size:24px;font-weight:700;color:var(--text);">Victoire !</div>
        <div id="ochoGameEndSub" style="font-size:13px;color:var(--muted);"></div>
        <!-- Scores finaux -->
        <div style="display:flex;gap:12px;width:100%;max-width:280px;">
          <div style="flex:1;background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:16px 12px;text-align:center;">
            <div id="ochoFinalAvLeft" style="width:36px;height:36px;border-radius:50%;overflow:hidden;margin:0 auto 4px;"><img class="yam-av-img" src="assets/images/profil_girl.png" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"></div>
            <div id="ochoFinalLabelLeft" style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px;"></div>
            <div id="ochoFinalScoreLeft" style="font-size:36px;font-weight:800;color:var(--text);">0</div>
            <div style="font-size:10px;color:var(--muted);margin-top:2px;">manches</div>
          </div>
          <div style="flex:1;background:var(--s1);border:1px solid var(--border);border-radius:14px;padding:16px 12px;text-align:center;">
            <div id="ochoFinalAvRight" style="width:36px;height:36px;border-radius:50%;overflow:hidden;margin:0 auto 4px;"><img class="yam-av-img" src="assets/images/profil_boy.png" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"></div>
            <div id="ochoFinalLabelRight" style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px;"></div>
            <div id="ochoFinalScoreRight" style="font-size:36px;font-weight:800;color:var(--text);">0</div>
            <div style="font-size:10px;color:var(--muted);margin-top:2px;">manches</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:280px;">
          <button id="ochoNewGameBtn" style="width:100%;padding:14px 0;background:var(--green,#22c55e);color:#000;font-weight:700;font-size:15px;font-family:'Bricolage Grotesque',sans-serif;border:none;border-radius:50px;cursor:pointer;">Rejouer 🔄</button>
          <button id="ochoCloseEndBtn" style="width:100%;padding:12px 0;background:var(--s2);color:var(--sub);border:1px solid var(--border);border-radius:50px;font-size:13px;font-family:'Bricolage Grotesque',sans-serif;cursor:pointer;">Retour aux jeux</button>
        </div>
      </div>

      <!-- Overlay choix de couleur (après 8) -->
      <div id="ochoColorPicker" style="display:none;position:absolute;inset:0;z-index:140;flex-direction:column;align-items:center;justify-content:center;gap:20px;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);">
        <div style="font-family:'Bricolage Grotesque',sans-serif;font-size:18px;font-weight:700;color:#F2E8D4;">Choisir une couleur</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <button class="ocho-color-choice" data-color="heart"  style="width:80px;height:80px;border-radius:16px;background:#E04E3E;border:3px solid rgba(242,232,212,0.7);font-size:36px;cursor:pointer;">♥</button>
          <button class="ocho-color-choice" data-color="club"   style="width:80px;height:80px;border-radius:16px;background:#4CB8A0;border:3px solid rgba(242,232,212,0.7);font-size:36px;cursor:pointer;">♣</button>
          <button class="ocho-color-choice" data-color="spade"  style="width:80px;height:80px;border-radius:16px;background:#5070B8;border:3px solid rgba(242,232,212,0.7);font-size:36px;cursor:pointer;">♠</button>
          <button class="ocho-color-choice" data-color="diamond" style="width:80px;height:80px;border-radius:16px;background:#E89030;border:3px solid rgba(242,232,212,0.7);font-size:36px;cursor:pointer;">♦</button>
        </div>
      </div>

    </div><!-- fin #ochoGameArea -->

  </div><!-- fin .game-view-body -->
</div><!-- fin #ochoView -->
`;
  }

  // ─── CSS ──────────────────────────────────────────────
  function _injectCSS() {
    if (document.getElementById('ochoStyles')) return;
    var s = document.createElement('style');
    s.id  = 'ochoStyles';
    s.textContent = /* css */`
/* ── Layout ─── */
#ochoView { font-family:'Bricolage Grotesque',sans-serif; }
#ochoView.active { display:flex !important; }
#ochoGameArea.oa-visible { display:flex !important; }

/* Présence dot */
.ocho-presence-dot { width:10px;height:10px;border-radius:50%;background:#555;margin-top:4px;transition:background 0.3s; }
.ocho-presence-dot.online { background:#22c55e;box-shadow:0 0 5px rgba(34,197,94,0.7); }

/* Bubble salle d'attente */
.ocho-player-bubble { display:flex;flex-direction:column;align-items:center;gap:4px; }

/* Cartes main adversaire (dos, empilées en arc) */
#ochoOppCards .oc-back {
  position:absolute;
  width:36px;height:50px;border-radius:6px;
  border:1.5px solid rgba(242,232,212,0.65);
  background:repeating-linear-gradient(135deg,#2a1205 0px,#2a1205 5px,#3a1a0a 5px,#3a1a0a 10px);
  box-shadow:0 3px 8px rgba(0,0,0,0.5);
  transform-origin:center 110px;
  overflow:hidden;
}
#ochoOppCards .oc-back::after {
  content:'';position:absolute;inset:4px;border-radius:4px;
  border:1px solid rgba(242,232,212,0.1);
}

/* Mes cartes */
#ochoMyCards .oc-card {
  position:absolute;
  cursor:pointer;
  transition:transform 0.15s,box-shadow 0.15s;
  border-radius:9px;
  overflow:hidden;
  transform-origin:center 150px;
}
#ochoMyCards .oc-card:active { transform:translateY(-8px) scale(1.08) !important; }
#ochoMyCards .oc-card.playable { box-shadow:0 0 0 2.5px #FFD700,0 4px 16px rgba(255,210,0,0.4) !important; }
#ochoMyCards .oc-card.unplayable { opacity:0.35;filter:saturate(0.25); }

/* Presence dot adversaire */
#ochoOppPresenceDot { transition:background 0.3s,box-shadow 0.3s; }
#ochoOppPresenceDot.online { background:#22c55e !important;box-shadow:0 0 5px rgba(34,197,94,0.7) !important; }

/* Avatar tour actif */
.ocho-active-turn-ring { box-shadow:0 0 0 3px #FFD700,0 0 12px rgba(255,215,0,0.4) !important; }

/* Aura OCHO pulsante */
@keyframes ochoAuraPulse {
  0%   { box-shadow:inset 0 0 0px 0px rgba(220,60,40,0); }
  40%  { box-shadow:inset 0 0 60px 20px rgba(220,60,40,0.5),inset 0 0 120px 40px rgba(220,60,40,0.22); }
  100% { box-shadow:inset 0 0 0px 0px rgba(220,60,40,0); }
}
#ochoAuraOverlay.active { animation:ochoAuraPulse 1.2s ease-in-out infinite;opacity:1; }

/* Coeurs flottants */
.ocho-heart {
  position:absolute;pointer-events:none;
  color:#FF6B8A;
  animation:ochoFloatUp 2.2s ease-out forwards;
}
@keyframes ochoFloatUp {
  0%   { opacity:1;transform:translateY(0) scale(1); }
  30%  { opacity:0.85; }
  100% { opacity:0;transform:translateY(-500px) translateX(var(--dx)) scale(0.6); }
}

/* Animation emoji zone */
@keyframes ochoPopIn  { 0%{opacity:0;transform:scale(0.4) rotate(-8deg);}60%{opacity:1;transform:scale(1.15) rotate(3deg);}80%{transform:scale(0.95) rotate(-1deg);}100%{opacity:1;transform:scale(1) rotate(0);} }
@keyframes ochoPopOut { 0%{opacity:1;transform:scale(1);}100%{opacity:0;transform:scale(1.3);} }
.ocho-anim-show { animation:ochoPopIn 0.5s cubic-bezier(.34,1.56,.64,1) forwards; }
.ocho-anim-hide { animation:ochoPopOut 0.3s ease-in forwards; }

/* Hint badge couleurs */
.ocho-hint-heart   { background:#E04E3E; }
.ocho-hint-club    { background:#4CB8A0; }
.ocho-hint-spade   { background:#5070B8; }
.ocho-hint-diamond { background:#E89030; }

/* Tab hide */
#ochoView.active ~ .bottom-nav,
#ochoView.active ~ * .bottom-nav { display:none !important; }
`;
    document.head.appendChild(s);
  }

  // ─── Injection du HTML dans le DOM ────────────────────
  function _injectHTML() {
    if (document.getElementById('ochoView')) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = _buildOchoHTML();
    // Insérer après skyjoView si présent, sinon avant </body>
    var skyjo = document.getElementById('skyjoView');
    if (skyjo && skyjo.parentNode) {
      skyjo.parentNode.insertBefore(tmp.firstElementChild, skyjo.nextSibling);
    } else {
      document.body.appendChild(tmp.firstElementChild);
    }
  }

  // ─── Affichage d'écrans ───────────────────────────────
  function _showScreen(id) {
    ['ochoWaitScreen','ochoGameArea','ochoRoundEnd','ochoGameEnd'].forEach(function (sid) {
      var el = document.getElementById(sid);
      if (!el) return;
      if (sid === 'ochoGameArea') { el.classList.remove('oa-visible'); el.style.display = 'none'; }
      else el.style.display = 'none';
    });
    var el = document.getElementById(id);
    if (!el) return;
    if (id === 'ochoGameArea') { el.style.display = 'flex'; el.classList.add('oa-visible'); }
    else el.style.display = 'flex';
  }

  // ─── Ouverture du jeu ─────────────────────────────────
  window.openOcho = function () {
    var profile = (typeof getProfile === 'function' ? getProfile() : null)
                 || (typeof yamGetUser === 'function' && yamGetUser() ? yamGetUser().role : null);
    if (!profile) {
      if (window.v2ShowLogin) window.v2ShowLogin();
      return;
    }
    _injectHTML();
    _injectCSS();
    _setupListeners();
    _openOchoWithProfile(profile);
  };

  function _openOchoWithProfile(profile) {
    _me    = profile;
    _other = _me === 'girl' ? 'boy' : 'girl';

    var ochoView  = document.getElementById('ochoView');
    var gamesView = document.getElementById('gamesView');
    ochoView.style.display = 'flex';
    if (typeof _yamSlide === 'function') {
      _yamSlide(ochoView, gamesView, 'forward');
    } else {
      ochoView.classList.add('active');
    }
    var nav = document.querySelector('.bottom-nav');
    if (nav) nav.style.display = 'none';

    _updateSubviewIds();

    _mp = YAMMultiplayer.init({
      gameTable:        OCHO_TABLE,
      presenceTable:    OCHO_PRESENCE,
      waitModalId:      'ochoWaitModal',
      countdownModalId: 'ochoCountdownModal',
      deleteOnLeave:    true,
      staleGameMinutes: 30,

      buildInitialState: function () { return _buildInitialState(); },

      onWaiting: function (me) {
        var myName  = typeof v2GetDisplayName === 'function' ? v2GetDisplayName(me)  : 'Moi';
        var oppName = typeof v2GetDisplayName === 'function' ? v2GetDisplayName(me === 'girl' ? 'boy' : 'girl') : 'L\'autre';
        _showScreen('ochoWaitScreen');
        var msg = document.getElementById('ochoWaitMsg');
        if (msg) msg.innerHTML = 'Connecté en tant que <strong>' + myName + '</strong>.<br>En attente que <strong>' + oppName + '</strong> rejoigne…';
        _updateWaitNames();
      },

      onLobbyTick: function (girlOk, boyOk) {
        var dg = document.getElementById('ochoPresenceGirl');
        var db = document.getElementById('ochoPresenceBoy');
        if (dg) dg.className = 'ocho-presence-dot' + (girlOk ? ' online' : '');
        if (db) db.className = 'ocho-presence-dot' + (boyOk  ? ' online' : '');
      },

      onMatchFound: function (gameRow) {
        _resetLocalState();
        _showScreen('ochoGameArea');
        var btn = document.getElementById('ochoAbandonBtn');
        if (btn) btn.style.display = 'block';
        _renderState(gameRow);
      },

      onStateUpdate: function (gameRow) {
        _renderState(gameRow);
      },

      onPresenceUpdate: function (isOnline) {
        var dot = document.getElementById('ochoOppPresenceDot');
        if (dot) {
          dot.style.background  = isOnline ? '#22c55e' : '#555';
          dot.style.boxShadow   = isOnline ? '0 0 5px rgba(34,197,94,0.7)' : 'none';
          dot.title             = isOnline ? 'En ligne' : 'Hors ligne';
        }
      },

      onAbandon: function () {
        _resetLocalState();
        _mp.showAlert('🏳️', 'Partie abandonnée', function () { _mp.enterLobby(); });
      },

      onBothAbsent: function () {
        _resetLocalState();
        _mp.showAlert('⏱️', 'Partie expirée', function () { _mp.enterLobby(); });
      },

      onLeave: function () {
        _leaveOchoView();
      }
    });

    _mp.enter(profile);
  }

  function _buildInitialState() {
    _cardId = 0;
    var deck = buildDeck();
    var girlHand = _dealHand(deck, 7);
    var boyHand  = _dealHand(deck, 7);
    // Première carte de la défausse — ne doit pas être un 8 ni un swap
    var top;
    do { top = deck.pop(); } while (top && (top.value === '8' || top.value === 'swap'));
    if (top) deck.unshift(top); // remet si on a dépilé en trop
    top = null;
    for (var i = deck.length - 1; i >= 0; i--) {
      if (deck[i].value !== '8' && deck[i].value !== 'swap') {
        top = deck.splice(i, 1)[0];
        break;
      }
    }
    if (!top) { top = deck.pop(); } // fallback

    return {
      deck:          deck,
      discard:       [top],
      girl_hand:     girlHand,
      boy_hand:      boyHand,
      current_color: top.suit,
      turn:          'girl', // girl commence toujours la 1ère manche
      ts_turn:       Date.now(),
      round:         1,
      wins:          { girl: 0, boy: 0 },
      ocho_declared: null,
      phase:         'playing',
      round_winner:  null,
      draw_penalty:  null,
      abandoned:     false,
      abandonedBy:   null,
      reaction:      null
    };
  }

  // ─── Reset état local ─────────────────────────────────
  function _resetLocalState() {
    _state = null;
    _stopTimer();
    _timerFired = false;
    _reactCooldown = false;
    _lastReactTs   = 0;
    var aura = document.getElementById('ochoAuraOverlay');
    if (aura) aura.classList.remove('active');
    if (typeof window._corePresenceSuspend === 'function') window._corePresenceSuspend();
  }

  // ─── Rendu principal ──────────────────────────────────
  function _renderState(gameRow) {
    var state = gameRow.state;
    if (!state) return;
    _state = state;

    // Réactions adversaires
    _checkIncomingReaction(state);

    var isMyTurn = state.turn === _me;
    var myHand   = _me === 'girl' ? state.girl_hand : state.boy_hand;
    var oppHand  = _me === 'girl' ? state.boy_hand  : state.girl_hand;
    var myName   = typeof v2GetDisplayName === 'function' ? v2GetDisplayName(_me)    : 'Moi';
    var oppName  = typeof v2GetDisplayName === 'function' ? v2GetDisplayName(_other) : 'L\'autre';

    // Vérifier fin de manche
    if (state.phase === 'round_end') { _showRoundEnd(state); return; }
    if (state.phase === 'game_end')  { _showGameEnd(state);  return; }

    // Fermer écrans de fin si on revient en jeu (nouvelle manche)
    document.getElementById('ochoRoundEnd').style.display = 'none';
    document.getElementById('ochoGameEnd').style.display  = 'none';

    // ── Timer ──
    _runTimer(state, isMyTurn);

    // ── Noms et avatars ──
    var meNameEl   = document.getElementById('ochoMeName');
    var oppNameEl  = document.getElementById('ochoOppName');
    if (meNameEl)  meNameEl.textContent  = myName;
    if (oppNameEl) oppNameEl.textContent = oppName;

    var meImgEl  = document.getElementById('ochoMeAvatarImg');
    var oppImgEl = document.getElementById('ochoOppAvatarImg');
    if (meImgEl)  meImgEl.src  = 'assets/images/profil_' + _me    + '.png';
    if (oppImgEl) oppImgEl.src = 'assets/images/profil_' + _other + '.png';

    // ── Tour pill ──
    var turnPill = document.getElementById('ochoMeTurnPill');
    if (turnPill) turnPill.style.display = isMyTurn ? 'inline-flex' : 'none';

    var oppSub = document.getElementById('ochoOppSub');
    if (oppSub) oppSub.textContent = !isMyTurn ? '⏳ à son tour…' : 'en attente';

    // ── Défausse + couleur active ──
    var discardEl = document.getElementById('ochoDiscardCard');
    var colorDot  = document.getElementById('ochoColorDot');
    if (discardEl) {
      var topCard = state.discard && state.discard.length > 0
        ? state.discard[state.discard.length - 1] : null;
      var colorForCard = (topCard && topCard.value === '8') ? state.current_color : null;
      discardEl.innerHTML = _cardSVG(topCard, { w: 46, h: 64, rx: 7, color: colorForCard });
    }
    if (colorDot) {
      colorDot.style.background = SUIT_COLORS[state.current_color] || '#888';
    }

    // ── Compteur pioche ──
    var deckCountEl = document.getElementById('ochoDeckCount');
    if (deckCountEl) deckCountEl.textContent = state.deck ? state.deck.length : '—';

    // ── Dos de carte pioche ──
    var deckCardEl = document.getElementById('ochoDeckCard');
    if (deckCardEl && !deckCardEl.querySelector('svg')) {
      deckCardEl.innerHTML = _cardBackSVG({ w: 46, h: 64, rx: 7 });
    }

    // ── Numéro manche ──
    var turnCount = document.getElementById('ochoTurnCount');
    if (turnCount) turnCount.textContent = 'Manche ' + (state.round || 1) + '/6';

    // ── Cartes adversaire (dos en arc) ──
    _renderOppCards(oppHand.length);

    // ── Mes cartes ──
    var playable = _playableCards(myHand, state);
    _renderMyCards(myHand, playable, isMyTurn);

    // ── Hint ──
    _renderHint(state, myHand, playable, isMyTurn);

    // ── Pioche forcée au début de mon tour ──
    if (isMyTurn && state.draw_penalty && state.draw_penalty.target === _me) {
      _applyForcedDraw(state);
    }
  }

  // ─── Cartes adversaire (dos en arc) ───────────────────
  function _renderOppCards(count) {
    var container = document.getElementById('ochoOppCards');
    if (!container) return;
    container.style.position = 'relative';
    container.style.width    = '260px';
    container.style.height   = '60px';
    container.innerHTML = '';
    var n = Math.min(count, 15);
    for (var i = 0; i < n; i++) {
      var el = document.createElement('div');
      el.className = 'oc-back';
      var angle = (i - (n - 1) / 2) * 6;
      var cx    = 260 / 2 - 18 + (i - (n - 1) / 2) * 22;
      el.style.cssText = 'left:' + cx + 'px;top:4px;transform:rotate(' + angle + 'deg);';
      container.appendChild(el);
    }
    // Badge nombre de cartes
    var badge = document.getElementById('ochoOppCardCount');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'ochoOppCardCount';
      badge.style.cssText = 'position:absolute;top:-4px;right:-4px;background:var(--accent,#e75a7c);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;z-index:10;';
      container.style.position = 'relative';
      container.appendChild(badge);
    }
    badge.textContent = count;
  }

  // ─── Mes cartes (arc interactif) ──────────────────────
  function _renderMyCards(hand, playable, isMyTurn) {
    var container = document.getElementById('ochoMyCards');
    if (!container) return;
    container.innerHTML = '';
    var n = hand.length;
    if (n === 0) return;
    var cw = 52, ch = 73;
    // Largeur totale disponible
    var totalW = Math.min(container.offsetWidth || 320, 360);
    var spread = Math.min(44, (totalW - cw) / Math.max(n - 1, 1));
    var totalSpread = spread * (n - 1) + cw;
    var startX = (totalW - totalSpread) / 2;
    var maxAngle = Math.min(20, n * 2.5);

    hand.forEach(function (card, i) {
      var el = document.createElement('div');
      el.className = 'oc-card';
      var isPlay = playable.some(function (c) { return c.id === card.id; });
      if (isPlay && isMyTurn)   el.classList.add('playable');
      else if (isMyTurn)        el.classList.add('unplayable');
      var angle = n > 1 ? (i / (n - 1) - 0.5) * maxAngle * 2 : 0;
      var lift  = n > 1 ? -Math.abs(i / (n - 1) - 0.5) * 8 : 0;
      el.style.width  = cw + 'px';
      el.style.height = ch + 'px';
      el.style.left   = (startX + i * spread) + 'px';
      el.style.bottom = (lift + 4) + 'px';
      el.style.transform = 'rotate(' + angle + 'deg)';
      el.style.zIndex = i + 1;
      el.innerHTML = _cardSVG(card, { w: cw, h: ch });
      // Clic : jouer la carte
      el.addEventListener('click', function () {
        if (!isMyTurn) return;
        if (!_mp.isLaunched()) return;
        _onCardClick(card);
      });
      container.appendChild(el);
    });
  }

  // ─── Hint ─────────────────────────────────────────────
  function _renderHint(state, hand, playable, isMyTurn) {
    var hintEl   = document.getElementById('ochoHint');
    var suitEl   = document.getElementById('ochoHintSuit');
    var textEl   = document.getElementById('ochoHintText');
    var badgeEl  = document.getElementById('ochoHintBadge');
    if (!hintEl) return;

    if (!isMyTurn) {
      var oppHand = _me === 'girl' ? state.boy_hand : state.girl_hand;
      if (textEl)  textEl.textContent  = 'En attente…';
      if (suitEl)  suitEl.textContent  = '';
      if (badgeEl) badgeEl.textContent = oppHand.length + ' cartes';
      badgeEl.className = '';
      badgeEl.style.background = 'rgba(255,255,255,0.15)';
      return;
    }

    var color   = state.current_color || 'heart';
    var sym     = SUIT_SYMBOLS[color]  || '?';
    if (suitEl) suitEl.textContent = sym;
    if (textEl) {
      var top = state.discard[state.discard.length - 1];
      textEl.textContent = (top ? top.value : '?') + ' ou ' + sym + ' —';
    }
    if (badgeEl) {
      badgeEl.textContent = playable.length + ' jouable' + (playable.length > 1 ? 's' : '');
      badgeEl.className   = 'ocho-hint-' + color;
      badgeEl.style.background = '';
    }
  }

  // ─── Clic sur une carte ───────────────────────────────
  function _onCardClick(card) {
    if (!_state) return;
    var isMyTurn = _state.turn === _me;
    if (!isMyTurn) return;
    if (!_isPlayable(card, _state)) {
      if (typeof showToast === 'function') showToast('Cette carte n\'est pas jouable');
      return;
    }
    // Si c'est un 8, ouvrir le sélecteur de couleur
    if (card.value === '8') {
      _showColorPicker(card);
      return;
    }
    _playCard(card, null);
  }

  function _showColorPicker(card) {
    var overlay = document.getElementById('ochoColorPicker');
    if (!overlay) return;
    overlay.style.display = 'flex';
    overlay.querySelectorAll('.ocho-color-choice').forEach(function (btn) {
      btn.onclick = function () {
        overlay.style.display = 'none';
        _playCard(card, btn.getAttribute('data-color'));
      };
    });
  }

  function _playCard(card, chosenColor) {
    if (!_state || _mp.isSaving()) return;
    var ns = _applyCard(_state, card, _me, chosenColor);
    _mp.saveState(ns);
    if (typeof haptic === 'function') haptic();
    // Vérifier si on est à 1 carte (affichage alerte OCHO)
    var myNewHand = _me === 'girl' ? ns.girl_hand : ns.boy_hand;
    if (myNewHand.length === 1 && ns.phase !== 'round_end') {
      _flashOchoReminder();
    }
  }

  function _flashOchoReminder() {
    var btn = document.getElementById('ochoBtn');
    if (!btn) return;
    btn.style.animation = 'none';
    // Flash rapide
    var orig = btn.style.background;
    btn.style.background = '#FFD700';
    btn.style.color = '#000';
    setTimeout(function () {
      btn.style.background = '';
      btn.style.color = '';
    }, 600);
  }

  // ─── Pioche ───────────────────────────────────────────
  function _onDrawCard() {
    if (!_state || _mp.isSaving()) return;
    var isMyTurn = _state.turn === _me;
    if (!isMyTurn) return;
    var ns = _drawCard(_state, _me);
    _mp.saveState(ns);
    if (typeof haptic === 'function') haptic('light');
  }

  // ─── Pioche forcée (pénalité +1 ou +2) ───────────────
  function _applyForcedDraw(state) {
    if (_mp.isSaving()) return;
    var ns = _applyDrawPenalty(state);
    _mp.saveState(ns);
  }

  // ─── Bouton OCHO ─────────────────────────────────────
  function _onOchoBtn() {
    if (!_state) return;
    var myHand = _me === 'girl' ? _state.girl_hand : _state.boy_hand;

    // Cas 1 : je declare OCHO pour moi (j'ai 1 carte)
    if (myHand.length === 1 && _state.ocho_declared !== _me) {
      if (_mp.isSaving()) return;
      var ns = _deepCopy(_state);
      ns.ocho_declared = _me;
      _mp.saveState(ns);
      if (typeof haptic === 'function') haptic('medium');
      return;
    }

    // Cas 2 : l'adversaire a 1 carte et n'a pas déclaré OCHO
    var oppHand = _me === 'girl' ? _state.boy_hand : _state.girl_hand;
    if (oppHand.length === 1 && _state.ocho_declared !== _other) {
      // Penalise l'adversaire : pioche 1 carte
      if (_mp.isSaving()) return;
      var ns2 = _deepCopy(_state);
      if (ns2.deck.length === 0) _reshuffleDiscard(ns2);
      var penalCard = ns2.deck.pop();
      if (penalCard) {
        if (_other === 'girl') ns2.girl_hand.push(penalCard);
        else ns2.boy_hand.push(penalCard);
      }
      ns2.ocho_declared = _me + '_caught'; // marque l'action
      _mp.saveState(ns2);
      if (typeof showToast === 'function') showToast('💥 Ocho raté ! L\'adversaire pioche !');
      return;
    }

    // Cas 3 : trop tôt — pénalité sur moi
    if (myHand.length > 1) {
      if (_mp.isSaving()) return;
      var ns3 = _deepCopy(_state);
      if (ns3.deck.length === 0) _reshuffleDiscard(ns3);
      var penCard = ns3.deck.pop();
      if (penCard) {
        if (_me === 'girl') ns3.girl_hand.push(penCard);
        else ns3.boy_hand.push(penCard);
      }
      _mp.saveState(ns3);
      if (typeof showToast === 'function') showToast('Trop tôt ! Tu pioches une carte…');
    }
  }

  // ─── Timer ────────────────────────────────────────────
  function _runTimer(state, isMyTurn) {
    _stopTimer();
    var elapsed = (Date.now() - (state.ts_turn || Date.now())) / 1000;
    var remaining = Math.max(0, TURN_DURATION - elapsed);

    // Mettre à jour la barre
    var fill = document.getElementById('ochoTimerFill');
    if (fill) {
      fill.style.transition = 'none';
      fill.style.width = (remaining / TURN_DURATION * 100) + '%';
      // Couleur selon temps restant
      if (remaining < 5) fill.style.background = '#E04E3E';
      else if (remaining < 10) fill.style.background = '#E89030';
      else fill.style.background = '#FFD700';
      setTimeout(function () {
        fill.style.transition = 'width ' + remaining + 's linear';
        fill.style.width = '0%';
      }, 50);
    }

    // Timer arc joueur
    var arc = isMyTurn
      ? document.getElementById('ochoMeTimerArc')
      : document.getElementById('ochoOppTimerArc');
    if (arc) {
      var CIRC = 2 * Math.PI * 15;
      arc.setAttribute('stroke-dasharray', (CIRC * remaining / TURN_DURATION) + ' ' + CIRC);
    }

    // Si c'est mon tour et temps écoulé → pioche auto
    if (!isMyTurn || _timerFired) return;
    _timerFired = false;
    var deadline = (state.ts_turn || Date.now()) + TURN_DURATION * 1000;

    function _tick() {
      var now = Date.now();
      // Mettre à jour l'arc en temps réel
      var rem2 = Math.max(0, (deadline - now) / 1000);
      var arcMe = document.getElementById('ochoMeTimerArc');
      if (arcMe) {
        var CIRC2 = 2 * Math.PI * 15;
        arcMe.setAttribute('stroke-dasharray', (CIRC2 * rem2 / TURN_DURATION) + ' ' + CIRC2);
        if (rem2 < 5)       arcMe.setAttribute('stroke','#E04E3E');
        else if (rem2 < 10) arcMe.setAttribute('stroke','#E89030');
        else                arcMe.setAttribute('stroke','#FFD700');
      }
      if (now >= deadline) {
        _timerFired = true;
        _autoDrawOnTimeout();
        return;
      }
      _timerRAF = requestAnimationFrame(_tick);
    }
    _timerRAF = requestAnimationFrame(_tick);
  }

  function _stopTimer() {
    if (_timerRAF) { cancelAnimationFrame(_timerRAF); _timerRAF = null; }
  }

  function _autoDrawOnTimeout() {
    if (!_state || _mp.isSaving()) return;
    if (_state.turn !== _me) return;
    var ns = _drawCard(_state, _me);
    // Passe le tour après la pioche auto
    ns.turn = _other;
    ns.ts_turn = Date.now();
    _mp.saveState(ns);
    if (typeof showToast === 'function') showToast('⏰ Temps écoulé — pioche automatique');
  }

  // ─── Fin de manche ────────────────────────────────────
  function _showRoundEnd(state) {
    _stopTimer();
    var winner = state.round_winner;
    var winnerName = typeof v2GetDisplayName === 'function'
      ? v2GetDisplayName(winner) : (winner === 'girl' ? 'Elle' : 'Lui');
    var iWon = winner === _me;

    document.getElementById('ochoRoundEndEmoji').textContent = iWon ? '🏆' : '😔';
    document.getElementById('ochoRoundEndTitle').textContent = iWon
      ? 'Tu remportes cette manche !' : winnerName + ' remporte cette manche !';

    var myWins  = state.wins[_me]    || 0;
    var oppWins = state.wins[_other] || 0;
    document.getElementById('ochoRoundEndSub').textContent = 'Score : ' + myWins + ' – ' + oppWins;
    document.getElementById('ochoRoundProgress').textContent = 'Manche ' + (state.round || 1) + '/6';

    // Scores manches
    document.getElementById('ochoRoundWinsLeft').textContent  = _me === 'girl' ? myWins  : oppWins;
    document.getElementById('ochoRoundWinsRight').textContent = _me === 'girl' ? oppWins : myWins;
    document.getElementById('ochoRoundLabelLeft').textContent  = typeof v2GetDisplayName === 'function' ? v2GetDisplayName(_me)    : 'Moi';
    document.getElementById('ochoRoundLabelRight').textContent = typeof v2GetDisplayName === 'function' ? v2GetDisplayName(_other) : 'L\'autre';

    // Bouton manche suivante — seul le gagnant de la manche déclenche (ou girl par défaut)
    var canLaunch = winner === _me || (_me === 'girl' && !winner);
    var btn     = document.getElementById('ochoNextRoundBtn');
    var waitMsg = document.getElementById('ochoWaitNextMsg');
    if (btn && waitMsg) {
      if (canLaunch) {
        btn.style.display    = 'block';
        waitMsg.style.display = 'none';
      } else {
        btn.style.display    = 'none';
        waitMsg.style.display = 'block';
      }
    }

    document.getElementById('ochoRoundEnd').style.display = 'flex';
  }

  // ─── Lancer la manche suivante ────────────────────────
  function _startNextRound(state) {
    if (_mp.isSaving()) return;
    _cardId = 0;
    var deck = buildDeck();
    var girlHand = _dealHand(deck, 7);
    var boyHand  = _dealHand(deck, 7);
    var top = null;
    for (var i = deck.length - 1; i >= 0; i--) {
      if (deck[i].value !== '8' && deck[i].value !== 'swap') {
        top = deck.splice(i, 1)[0]; break;
      }
    }
    if (!top) top = deck.pop();

    // Alternance du premier joueur selon le gagnant de la manche précédente
    var firstTurn = state.round_winner || 'girl';

    var ns = {
      deck:          deck,
      discard:       [top],
      girl_hand:     girlHand,
      boy_hand:      boyHand,
      current_color: top.suit,
      turn:          firstTurn,
      ts_turn:       Date.now(),
      round:         (state.round || 1) + 1,
      wins:          state.wins,
      ocho_declared: null,
      phase:         'playing',
      round_winner:  null,
      draw_penalty:  null,
      abandoned:     false,
      abandonedBy:   null,
      reaction:      null
    };
    _mp.saveState(ns);
    document.getElementById('ochoRoundEnd').style.display = 'none';
  }

  // ─── Fin de partie ────────────────────────────────────
  function _showGameEnd(state) {
    _stopTimer();
    var myWins  = state.wins[_me]    || 0;
    var oppWins = state.wins[_other] || 0;
    var isDraw  = myWins === oppWins;
    var iWon    = myWins > oppWins;
    var winnerName = typeof v2GetDisplayName === 'function'
      ? v2GetDisplayName(iWon ? _me : _other) : (iWon ? 'Toi' : 'L\'autre');

    document.getElementById('ochoGameEndEmoji').textContent = isDraw ? '🤝' : (iWon ? '🏆' : '😔');
    document.getElementById('ochoGameEndTitle').textContent = isDraw
      ? 'Égalité !' : (iWon ? 'Tu gagnes la partie !' : winnerName + ' gagne la partie !');
    document.getElementById('ochoGameEndSub').textContent = myWins + ' – ' + oppWins + ' (sur 6 manches)';

    document.getElementById('ochoFinalScoreLeft').textContent  = _me === 'girl' ? myWins  : oppWins;
    document.getElementById('ochoFinalScoreRight').textContent = _me === 'girl' ? oppWins : myWins;
    document.getElementById('ochoFinalLabelLeft').textContent  = typeof v2GetDisplayName === 'function' ? v2GetDisplayName(_me)    : 'Moi';
    document.getElementById('ochoFinalLabelRight').textContent = typeof v2GetDisplayName === 'function' ? v2GetDisplayName(_other) : 'L\'autre';

    // Mettre en évidence le gagnant
    var cardL = document.getElementById('ochoFinalScoreLeft').parentElement;
    var cardR = document.getElementById('ochoFinalScoreRight').parentElement;
    if (cardL && cardR) {
      cardL.style.borderColor = ''; cardL.style.background = '';
      cardR.style.borderColor = ''; cardR.style.background = '';
      if (!isDraw) {
        var winner = iWon ? cardL : cardR;
        winner.style.borderColor = 'var(--green,#22c55e)';
        winner.style.background  = 'rgba(0,201,167,0.1)';
      }
    }

    document.getElementById('ochoGameEnd').style.display = 'flex';

    // Flamme couple
    if (typeof window.yamFlameActivity === 'function') window.yamFlameActivity('ocho_together');
  }

  // ─── Réactions emoji ─────────────────────────────────
  var OCHO_EMOJIS = ['🎉','🔥','💥','🌟','😂','👏'];

  function _setupEmojiPicker() {
    var pill   = document.getElementById('ochoEmojiPill');
    var btn    = document.getElementById('ochoEmojiBtn');
    var heartB = document.getElementById('ochoHeartBtn');
    if (!pill || !btn) return;

    // Remplir la pilule
    pill.innerHTML = '';
    OCHO_EMOJIS.forEach(function (em) {
      var sp = document.createElement('span');
      sp.textContent = em;
      sp.style.cssText = 'font-size:24px;cursor:pointer;padding:4px;border-radius:50%;transition:transform 0.15s;';
      sp.addEventListener('click', function (e) {
        e.stopPropagation();
        _closeEmojiPill();
        _sendReaction(em);
      });
      sp.addEventListener('mousedown', function () { this.style.transform = 'scale(0.82)'; });
      sp.addEventListener('mouseup',   function () { this.style.transform = ''; });
      pill.appendChild(sp);
    });

    var _open = false;
    function _closeEmojiPill() {
      _open = false;
      pill.style.maxWidth  = '0';
      pill.style.opacity   = '0';
      pill.style.padding   = '0';
      pill.style.pointerEvents = 'none';
      btn.textContent = '😄';
      if (heartB) { heartB.style.opacity = '1'; heartB.style.pointerEvents = 'all'; }
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      _open = !_open;
      if (_open) {
        pill.style.maxWidth     = '260px';
        pill.style.opacity      = '1';
        pill.style.padding      = '6px 10px';
        pill.style.pointerEvents = 'all';
        btn.textContent = '✕';
        if (heartB) { heartB.style.opacity = '0'; heartB.style.pointerEvents = 'none'; }
      } else {
        _closeEmojiPill();
      }
    });

    document.addEventListener('click', function () { if (_open) _closeEmojiPill(); });

    // Coeurs flottants
    if (heartB) {
      heartB.addEventListener('click', function () { _spawnHearts(); });
    }
  }

  function _sendReaction(emoji) {
    if (_reactCooldown || !_mp.isLaunched() || !_state) return;
    _reactCooldown = true;
    setTimeout(function () { _reactCooldown = false; }, 2500);
    _showAnimEmoji(emoji);
    // Écrire la réaction dans le state (sans modifier la logique de jeu)
    if (_mp.isSaving()) return;
    var ns = _deepCopy(_state);
    ns.reaction = { player: _me, emoji: emoji, ts: Date.now() };
    _mp.saveState(ns);
  }

  function _checkIncomingReaction(state) {
    if (!state || !state.reaction) return;
    var r = state.reaction;
    if (!r.player || !r.emoji || !r.ts) return;
    if (r.player === _me) return;
    if (r.ts === _lastReactTs) return;
    _lastReactTs = r.ts;
    _showAnimEmoji(r.emoji);
  }

  function _showAnimEmoji(emoji) {
    var el = document.getElementById('ochoAnimText');
    if (!el) return;
    el.textContent = emoji;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.classList.remove('ocho-anim-hide');
    el.classList.add('ocho-anim-show');
    el.style.opacity = '1';
    clearTimeout(window._ochoAnimT);
    window._ochoAnimT = setTimeout(function () {
      el.classList.remove('ocho-anim-show');
      el.classList.add('ocho-anim-hide');
      setTimeout(function () { el.classList.remove('ocho-anim-hide'); el.style.opacity = '0'; }, 350);
    }, 1800);
  }

  function _spawnHearts() {
    var screen = document.getElementById('ochoGameArea');
    var btn    = document.getElementById('ochoHeartBtn');
    if (!screen || !btn) return;
    for (var i = 0; i < 7; i++) {
      (function (delay) {
        setTimeout(function () {
          var h = document.createElement('div');
          h.className = 'ocho-heart';
          h.textContent = '♥';
          h.style.setProperty('--dx', (Math.random() - 0.5) * 120 + 'px');
          h.style.left   = (btn.offsetLeft + 6 + Math.random() * 34) + 'px';
          h.style.bottom = '90px';
          h.style.fontSize = (20 + Math.random() * 16) + 'px';
          screen.appendChild(h);
          setTimeout(function () { h.remove(); }, 2300);
        }, delay);
      })(i * 110);
    }
  }

  // ─── Bouton OCHO — aura ───────────────────────────────
  var _ochoAuraActive = false;
  function _toggleOchoAura() {
    var aura = document.getElementById('ochoAuraOverlay');
    if (!aura) return;
    _ochoAuraActive = !_ochoAuraActive;
    aura.classList.toggle('active', _ochoAuraActive);
  }

  // ─── Noms salle d'attente ─────────────────────────────
  function _updateWaitNames() {
    var girlName = typeof v2GetDisplayName === 'function' ? v2GetDisplayName('girl') : 'Rose';
    var boyName  = typeof v2GetDisplayName === 'function' ? v2GetDisplayName('boy')  : 'Bleu';
    var ng = document.getElementById('ochoWaitNameGirl'); if (ng) ng.textContent = girlName;
    var nb = document.getElementById('ochoWaitNameBoy');  if (nb) nb.textContent = boyName;
  }

  // ─── Mise à jour _subviewIds de app-core ─────────────
  function _updateSubviewIds() {
    if (typeof _subviewIds !== 'undefined' && Array.isArray(_subviewIds)) {
      if (_subviewIds.indexOf('ochoView') === -1) {
        _subviewIds.push('ochoView');
      }
    }
  }

  // ─── Quitter la vue ───────────────────────────────────
  function _leaveOchoView() {
    _stopTimer();
    var ochoView  = document.getElementById('ochoView');
    var gamesView = document.getElementById('gamesView');
    if (typeof _yamSlide === 'function') {
      _yamSlide(gamesView, ochoView, 'backward');
    } else if (ochoView) {
      ochoView.classList.remove('active');
      ochoView.style.display = 'none';
    }
    var nav = document.querySelector('.bottom-nav');
    if (nav) nav.style.display = '';
    if (typeof window._corePresenceResume === 'function') window._corePresenceResume();
  }

  // ─── Listeners (une seule fois) ───────────────────────
  var _listenersSet = false;
  function _setupListeners() {
    if (_listenersSet) return;
    _listenersSet = true;

    document.addEventListener('click', function (e) {
      var t = e.target;

      // ── Carte de jeu (gamesView) → ouvrir Ocho ──
      if (t.closest && t.closest('#ochoCard')) {
        window.openOcho();
        return;
      }

      // ── Bouton retour salle d'attente ──
      if (t.id === 'ochoLeaveWaitBtn' || t.closest('#ochoLeaveWaitBtn')) {
        if (_mp) _mp.leave();
        _resetLocalState();
        _leaveOchoView();
        return;
      }

      // ── Bouton retour en jeu ──
      if (t.id === 'ochoBackBtn' || t.closest('#ochoBackBtn')) {
        if (_mp && _mp.isLaunched()) {
          _mp.abandon(function () {
            _resetLocalState();
            _leaveOchoView();
          });
        } else {
          if (_mp) _mp.leave();
          _resetLocalState();
          _leaveOchoView();
        }
        return;
      }

      // ── Abandon ──
      if (t.id === 'ochoAbandonBtn' || t.closest('#ochoAbandonBtn')) {
        if (!_mp) return;
        _mp.abandon(function () {
          _resetLocalState();
          var btn = document.getElementById('ochoAbandonBtn');
          if (btn) btn.style.display = 'none';
          _leaveOchoView();
        });
        return;
      }

      // ── Pioche ──
      if (t.id === 'ochoDeckCard' || t.closest('#ochoDeckCard')) {
        _onDrawCard();
        return;
      }

      // ── Bouton OCHO ──
      if (t.id === 'ochoBtn' || t.closest('#ochoBtn')) {
        _onOchoBtn();
        _toggleOchoAura();
        return;
      }

      // ── Manche suivante ──
      if (t.id === 'ochoNextRoundBtn' || t.closest('#ochoNextRoundBtn')) {
        if (!_state) return;
        // Vérifier si 6 manches jouées
        var nextRound = (_state.round || 1) + 1;
        if (nextRound > 6) {
          // Déclencher fin de partie
          if (_mp.isSaving()) return;
          var ns = _deepCopy(_state);
          ns.phase = 'game_end';
          _mp.saveState(ns);
        } else {
          _startNextRound(_state);
        }
        return;
      }

      // ── Rejouer ──
      if (t.id === 'ochoNewGameBtn' || t.closest('#ochoNewGameBtn')) {
        if (!_mp) return;
        _mp.stopPoll();
        var gameId = _mp.getGameId();
        if (!gameId) return;
        fetch(SB_URL + '/rest/v1/' + OCHO_TABLE + '?id=eq.' + gameId, {
          method: 'DELETE', headers: sb2Headers()
        }).then(function () {
          document.getElementById('ochoGameEnd').style.display = 'none';
          _mp.enterLobby();
        }).catch(function () {});
        return;
      }

      // ── Fermer fin de partie ──
      if (t.id === 'ochoCloseEndBtn' || t.closest('#ochoCloseEndBtn')) {
        if (_mp) _mp.leave();
        _resetLocalState();
        _leaveOchoView();
        return;
      }
    });

    // ── Visibilité page (bg-pause) ──
    document.addEventListener('visibilitychange', function () {
      var view = document.getElementById('ochoView');
      if (!view || !view.classList.contains('active')) return;
      if (document.hidden) {
        _stopTimer();
        if (_mp) { _mp.deletePresence(); _mp.refreshRates(); }
      } else {
        if (_mp) { _mp.upsertPresence(); _mp.refreshRates(); }
      }
    });

    window.addEventListener('pagehide', function () {
      var view = document.getElementById('ochoView');
      if (view && view.classList.contains('active') && _mp) _mp.deletePresence();
    });
  }

  // ─── Expose global ────────────────────────────────────
  window.openOcho          = window.openOcho;          // déjà défini
  window.ochoLeaveWait     = function () {
    if (_mp) _mp.leave();
    _resetLocalState();
    _leaveOchoView();
  };
  window._ochoRefreshRates    = function () { if (_mp) _mp.refreshRates(); };
  window._ochoDeletePresence  = function () { if (_mp) _mp.deletePresence(); };
  window._ochoUpsertPresence  = function () { if (_mp) _mp.upsertPresence(); };
  window._ochoMarkAbsence     = function () { if (_mp) _mp.markAbsence(); };

  // ─── Carte Ocho dans gamesView ────────────────────────
  // Injecte la carte dans #gamesView si elle n'existe pas encore
  (function _injectGameCard() {
    function _tryInject() {
      var list = document.querySelector('#gamesView .gv-game-list');
      if (!list) { setTimeout(_tryInject, 500); return; }
      if (document.getElementById('ochoCard')) return;
      var card = document.createElement('div');
      card.className = 'gv-game-card';
      card.id        = 'ochoCard';
      card.style.cssText = 'position:relative;overflow:hidden;';
      card.innerHTML = '<div class="gv-game-card-icon">🃏</div>'
        + '<div class="gv-game-card-info">'
        +   '<div class="gv-game-card-name">Ocho</div>'
        +   '<div class="gv-game-card-desc">Le UNO version YAM — 6 manches</div>'
        + '</div>'
        + '<div class="gv-game-card-arrow">›</div>';
      // Insérer en premier dans la liste
      list.insertBefore(card, list.firstChild);
    }
    _tryInject();
  })();

  // ─── Auto-setup emoji picker quand le DOM est prêt ────
  document.addEventListener('DOMContentLoaded', function () {
    // setupListeners sera appelé à l'ouverture du jeu
  });

  // Patch : setup emoji picker après injection HTML
  var _origSetupListeners = _setupListeners;
  _setupListeners = function () {
    _origSetupListeners();
    _setupEmojiPicker();
  };

})();


/* ══════════════════════════════════════════════════════════════
   OCHO — BG-PAUSE : pause complète quand page cachée
══════════════════════════════════════════════════════════════ */
(function () {
  function getOchoView() { return document.getElementById('ochoView'); }

  function isOchoActive() {
    var v = getOchoView();
    return v && (v.classList.contains('active') || v.style.display === 'flex');
  }

  function pauseOcho() {
    if (typeof window._ochoDeletePresence === 'function') window._ochoDeletePresence();
    if (typeof window._ochoRefreshRates   === 'function') window._ochoRefreshRates();
  }

  function resumeOcho() {
    if (typeof window._ochoUpsertPresence === 'function') window._ochoUpsertPresence();
    if (typeof window._ochoRefreshRates   === 'function') window._ochoRefreshRates();
  }

  document.addEventListener('visibilitychange', function () {
    if (!isOchoActive()) return;
    if (document.hidden) pauseOcho(); else resumeOcho();
  });
  window.addEventListener('pagehide',  function () { if (isOchoActive()) pauseOcho(); });
  window.addEventListener('pageshow',  function (e) { if (isOchoActive() && !document.hidden) resumeOcho(); });
  window.addEventListener('blur',      function () { if (isOchoActive()) pauseOcho(); });
  window.addEventListener('focus',     function () { if (isOchoActive() && !document.hidden) resumeOcho(); });
})();
