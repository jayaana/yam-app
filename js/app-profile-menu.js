/* Menu du profil « silhouette » : la photo et le menu Paramètres / Se déconnecter forment UNE forme.
   #profilePopup reste le conteneur (app-account.js ajoute/retire la classe « open ») ; ce fichier le place sous l'avatar
   touché, y ajoute la silhouette + une copie de la photo, et fait glisser le bouton thème voisin sous la photo
   (il disparaît), puis le ramène à la fermeture. Styles : css/da-parametres.css (bloc « Menu du profil silhouette »). */
(function(){
  var W = 132, CR = 16;
  /* Silhouette d'un seul tracé : tête ronde (rayon R, = la photo + 1 px) en haut à droite, corps qui en descend, raccord creux (rayon 14) tangent au cercle */
  function buildPath(R, H){
    var r = 14, Cx = W - R, d = Math.sqrt(R*R + 2*R*r), Fx = Cx - d, Fy = R - r, k = r / (R + r);
    var Tx = (Fx + (Cx - Fx) * k).toFixed(2), Ty = (Fy + (R - Fy) * k).toFixed(2), c = CR;
    return 'M' + Cx + ' 0 A' + R + ' ' + R + ' 0 0 1 ' + W + ' ' + R + ' L' + W + ' ' + (H-c) + ' A' + c + ' ' + c + ' 0 0 1 ' + (W-c) + ' ' + H +
      ' L' + c + ' ' + H + ' A' + c + ' ' + c + ' 0 0 1 0 ' + (H-c) + ' L0 ' + (R+c) + ' A' + c + ' ' + c + ' 0 0 1 ' + c + ' ' + R + ' L' + Fx.toFixed(2) + ' ' + R +
      ' A' + r + ' ' + r + ' 0 0 0 ' + Tx + ' ' + Ty + ' A' + R + ' ' + R + ' 0 0 1 ' + Cx + ' 0 Z';
  }
  var THEME_IDS = ['themeToggleHome','themeToggleDm1','themeToggleDm2','themeToggleGames','themeTogglePranks'];
  var AVATAR_IDS = ['dmConvProfileBtn','yamStickyAvatarSelf','profileAvatar'];
  var st = { on:false, timer:0, theme:null };

  function visible(el){
    if(!el) return false;
    var r = el.getBoundingClientRect();
    if(r.width < 10 || r.height < 10) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.05;
  }
  function pickAvatar(){
    for(var i=0;i<AVATAR_IDS.length;i++){ var el = document.getElementById(AVATAR_IDS[i]); if(visible(el)) return el; }
    return null;
  }
  function pickTheme(av){
    var a = av.getBoundingClientRect(), ay = a.top + a.height/2, best = null, bd = 1e9;
    THEME_IDS.forEach(function(id){
      var el = document.getElementById(id);
      if(!visible(el)) return;
      var r = el.getBoundingClientRect(), gap = a.left - r.right;
      if(Math.abs((r.top + r.height/2) - ay) < 40 && gap > -10 && gap < 120 && gap < bd){ bd = gap; best = el; }
    });
    return best;
  }
  function prepare(pp){
    if(pp.querySelector('.pm-sh')) return;
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'pm-sh'); svg.setAttribute('aria-hidden', 'true');
    svg.appendChild(document.createElementNS(ns, 'path'));
    pp.insertBefore(svg, pp.firstChild);
    var img = document.createElement('img');
    img.className = 'pm-av'; img.alt = '';
    img.addEventListener('click', function(e){ e.stopPropagation(); if(window.toggleProfilePopup) window.toggleProfilePopup(); });
    pp.insertBefore(img, svg.nextSibling);
  }
  function cleanup(pp){
    pp.classList.remove('yam-pm-on', 'yam-pm-show', 'yam-pm-out');
    if(st.theme){ resetTheme(st.theme); st.theme = null; }
  }
  function resetTheme(th){ th.style.transition = ''; th.style.transform = ''; th.style.opacity = ''; th.style.pointerEvents = ''; }
  function open(pp){
    clearTimeout(st.timer); cleanup(pp);
    var av = pickAvatar();
    prepare(pp);
    var r = av ? av.getBoundingClientRect() : { left: window.innerWidth - 63, top: 48, width: 44, height: 44 };
    var cx = r.left + r.width/2, cy = r.top + r.height/2, R = r.width/2 + 1, pt = R + 28, H = pt + 78;
    pp.style.setProperty('--pm-r', R + 'px'); pp.style.setProperty('--pm-pt', pt + 'px'); pp.style.setProperty('--pm-h', H + 'px');
    pp.style.setProperty('--pm-top', (cy - R) + 'px');
    pp.style.setProperty('--pm-right', (window.innerWidth - cx - R) + 'px');
    var sh = pp.querySelector('.pm-sh'); sh.setAttribute('viewBox', '0 0 ' + W + ' ' + H); sh.firstChild.setAttribute('d', buildPath(R, H));
    /* Photo copiée à l'identique : même taille et même place que l'image réelle (la bordure de l'avatar n'est pas comptée) */
    var src = av && av.querySelector('img'), im = pp.querySelector('.pm-av');
    var ir = src ? src.getBoundingClientRect() : r;
    im.src = src ? src.src : '';
    im.style.width = ir.width + 'px'; im.style.height = ir.height + 'px';
    im.style.left = (ir.left - (cx + R - W)) + 'px'; im.style.top = (ir.top - (cy - R)) + 'px'; im.style.right = 'auto';
    var th = av ? pickTheme(av) : null;
    if(th){
      /* Le bouton thème glisse vers la droite sous la photo et s'efface ; il revient en glissant vers la gauche à la fermeture */
      st.theme = th;
      var tr = th.getBoundingClientRect(), dx = (r.left + r.width/2) - (tr.left + tr.width/2);
      th.style.transition = 'transform .14s ease-in, opacity .12s ease-in';
      th.style.pointerEvents = 'none';
      requestAnimationFrame(function(){ th.style.transform = 'translateX(' + dx + 'px)'; th.style.opacity = '0'; });
    }
    st.on = true;
    pp.classList.add('yam-pm-on');
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      pp.classList.add('yam-pm-show');
    }); });
  }
  function close(pp){
    st.on = false;
    pp.classList.remove('yam-pm-show');
    pp.classList.add('yam-pm-out');   /* le rond blanc se replie avec le menu (pas après) */
    var th = st.theme;
    if(th){
      st.theme = null;
      th.style.transition = 'transform .16s ease-out .04s, opacity .14s ease-out .04s';
      th.style.transform = ''; th.style.opacity = ''; th.style.pointerEvents = '';
      setTimeout(function(){ th.style.transition = ''; }, 400);
    }
    clearTimeout(st.timer);
    st.timer = setTimeout(function(){ cleanup(pp); }, 120);
  }
  function init(){
    var pp = document.getElementById('profilePopup');
    if(!pp || pp._pmInit) return;
    pp._pmInit = true;
    new MutationObserver(function(){
      var isOpen = pp.classList.contains('open');
      if(isOpen && !st.on) open(pp);
      else if(!isOpen && st.on) close(pp);
    }).observe(pp, { attributes:true, attributeFilter:['class'] });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
