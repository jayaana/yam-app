/* Menu du profil « silhouette » : la photo et le menu Paramètres / Se déconnecter forment UNE forme.
   #profilePopup reste le conteneur (app-account.js ajoute/retire la classe « open ») ; ce fichier le place sous l'avatar
   touché, y ajoute la silhouette + une copie de la photo, et fait « aspirer » le bouton thème voisin par la photo
   (effet goutte), puis le fait ressortir à la fermeture. Styles : css/da-parametres.css (bloc « Menu du profil silhouette »). */
(function(){
  var PATH = 'M149 0 A27 27 0 0 1 176 27 L176 149 A22 22 0 0 1 154 171 L22 171 A22 22 0 0 1 0 149 L0 49 A22 22 0 0 1 22 27 L110.5 27 A14 14 0 0 0 123.65 17.78 A27 27 0 0 1 149 0 Z';
  var THEME_IDS = ['themeToggleHome','themeToggleDm1','themeToggleDm2','themeToggleGames','themeTogglePranks'];
  var AVATAR_IDS = ['dmConvProfileBtn','yamStickyAvatarSelf','profileAvatar'];
  var st = { on:false, timer:0, theme:null, overlay:null };

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
    svg.setAttribute('class', 'pm-sh'); svg.setAttribute('viewBox', '0 0 176 171'); svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(ns, 'path'); p.setAttribute('d', PATH); svg.appendChild(p);
    pp.insertBefore(svg, pp.firstChild);
    var img = document.createElement('img');
    img.className = 'pm-av'; img.alt = '';
    img.addEventListener('click', function(e){ e.stopPropagation(); if(window.toggleProfilePopup) window.toggleProfilePopup(); });
    pp.insertBefore(img, svg.nextSibling);
  }
  function ensureFilter(){
    if(document.getElementById('yamGooSvg')) return;
    var d = document.createElement('div');
    d.id = 'yamGooSvg'; d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = '<svg width="0" height="0"><filter id="yamGoo"><feGaussianBlur in="SourceGraphic" stdDeviation="6"/><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"/></filter></svg>';
    document.body.appendChild(d);
  }
  function buildOverlay(av, th){
    ensureFilter();
    var a = av.getBoundingClientRect(), t = th.getBoundingClientRect();
    var ax = a.left + a.width/2, ay = a.top + a.height/2, tx = t.left + t.width/2, ty = t.top + t.height/2;
    var o = document.createElement('div');
    o.className = 'yam-goo';
    o.style.setProperty('--dx', (ax - tx) + 'px'); o.style.setProperty('--dy', (ay - ty) + 'px');
    var icon = th.innerHTML.replace(/\sid="[^"]*"/g, '');
    o.innerHTML = '<div class="gw"><div class="goo"><div class="orb"></div><div class="tb"></div></div></div><div class="ti">' + icon + '</div>';
    var orb = o.querySelector('.orb'), tb = o.querySelector('.tb'), ti = o.querySelector('.ti');
    orb.style.cssText = 'left:' + (ax - 27) + 'px;top:' + (ay - 27) + 'px';
    tb.style.cssText = 'left:' + t.left + 'px;top:' + t.top + 'px;width:' + t.width + 'px;height:' + t.height + 'px';
    ti.style.cssText = 'left:' + t.left + 'px;top:' + t.top + 'px;width:' + t.width + 'px;height:' + t.height + 'px';
    document.body.appendChild(o);
    return o;
  }
  function cleanup(pp){
    pp.classList.remove('yam-pm-on', 'yam-pm-show');
    if(st.overlay){ st.overlay.remove(); st.overlay = null; }
    if(st.theme){ st.theme.style.opacity = ''; st.theme.style.pointerEvents = ''; st.theme = null; }
  }
  function open(pp){
    clearTimeout(st.timer); cleanup(pp);
    var av = pickAvatar();
    prepare(pp);
    var r = av ? av.getBoundingClientRect() : { left: window.innerWidth - 63, top: 48, width: 44, height: 44 };
    var cx = r.left + r.width/2, cy = r.top + r.height/2;
    pp.style.setProperty('--pm-top', (cy - 27) + 'px');
    pp.style.setProperty('--pm-right', (window.innerWidth - cx - 27) + 'px');
    var src = av && av.querySelector('img'); pp.querySelector('.pm-av').src = src ? src.src : '';
    var th = av ? pickTheme(av) : null;
    if(th){ st.theme = th; st.overlay = buildOverlay(av, th); th.style.opacity = '0'; th.style.pointerEvents = 'none'; }
    st.on = true;
    pp.classList.add('yam-pm-on');
    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      pp.classList.add('yam-pm-show');
      if(st.overlay) st.overlay.classList.add('go');
    }); });
  }
  function close(pp){
    st.on = false;
    pp.classList.remove('yam-pm-show');
    if(st.overlay) st.overlay.classList.remove('go');
    clearTimeout(st.timer);
    st.timer = setTimeout(function(){ cleanup(pp); }, 650);
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
