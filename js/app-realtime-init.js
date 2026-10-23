// app-realtime-init.js — Initialise le client Supabase Realtime
// Chargé après app-core.js, avant app-account.js
// Remplace le bloc inline <script>if(window._yamInitRealtime) window._yamInitRealtime();</script>
if (window._yamInitRealtime) window._yamInitRealtime();

// ── Abonnement temps réel commun (n°14) ─────────────────────────────────────
// yamRTWatch(clé, [{table, event?, idCol?}], onChange, pollMs)
//  - un seul canal par clé (jamais deux .subscribe sur le même canal)
//  - INSERT/UPDATE/DELETE filtrés sur le couple + DELETE sans filtre (Supabase ne filtre pas les DELETE)
//  - si le direct coupe ou n'existe pas : repli par poll (onChange(null) toutes les pollMs ms)
window.yamRTWatch = function (key, tables, onChange, pollMs) {
  var iv = null;
  function poll() { try { onChange(null); } catch (e) {} }
  function startPoll() { if (pollMs && !iv) iv = setInterval(poll, pollMs); }
  function stopPoll() { if (iv) { clearInterval(iv); iv = null; } }
  function start() {
    var u = (typeof yamGetUser === 'function') ? yamGetUser() : null;
    var cid = u ? u.couple_id : null;
    if (!window._yamRT || !cid) return false;
    window._yamRTChannels = window._yamRTChannels || {};
    if (window._yamRTChannels[key]) return true;
    var ch = window._yamRT.channel(key + '-' + cid);
    tables.forEach(function (t) {
      var ev = t.event || '*';
      if (ev !== 'DELETE') {
        ch = ch.on('postgres_changes', { event: ev, schema: 'public', table: t.table, filter: (t.idCol || 'couple_id') + '=eq.' + cid }, onChange);
      }
      if (ev === '*' || ev === 'DELETE') {
        ch = ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: t.table }, onChange);
      }
    });
    ch.subscribe(function (status) {
      if (status === 'SUBSCRIBED') { stopPoll(); poll(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (window._yamRTChannels) delete window._yamRTChannels[key];
        startPoll();
      }
    });
    window._yamRTChannels[key] = ch;
    return true;
  }
  if (!start()) startPoll();
  document.addEventListener('yam:rt_ready', function () { setTimeout(start, 300); });
  document.addEventListener('yam:session_ready', function () { setTimeout(start, 1200); });
};

// ── Notification commune (n°17) ─────────────────────────────────────────────
// Petite bannière en haut quand l'autre envoie quelque chose (message, humeur, petit mot, bêtise).
// Ne gêne pas : pointer-events seulement sur la bannière, disparaît seule, ignorée si on est déjà sur la page concernée.
(function () {
  var _timer = null;
  function myRole() {
    var r = (typeof window.getProfile === 'function') ? window.getProfile() : null;
    if (!r) { var u = (typeof yamGetUser === 'function') ? yamGetUser() : null; r = u && u.role; }
    return r;
  }
  function onTab(id) { var n = document.getElementById(id); return !!(n && n.classList.contains('nav-active')); }
  window.yamNotif = function (icon, title, text, navId) {
    var el = document.getElementById('yamNotif');
    if (!el) {
      el = document.createElement('div');
      el.id = 'yamNotif';
      el.setAttribute('role', 'status');
      el.innerHTML = '<span class="yn-ic"></span><span class="yn-tx"><b class="yn-t"></b><span class="yn-m"></span></span>';
      el.addEventListener('click', function () {
        el.classList.remove('show');
        var n = el._nav && document.getElementById(el._nav);
        if (n) n.click();
      });
      document.body.appendChild(el);
    }
    clearTimeout(_timer);
    el._nav = navId || null;
    el.querySelector('.yn-ic').textContent = icon;
    el.querySelector('.yn-t').textContent = title;
    el.querySelector('.yn-m').textContent = text || '';
    void el.offsetWidth;
    el.classList.add('show');
    _timer = setTimeout(function () { el.classList.remove('show'); }, 4500);
  };
  function other() { var u = (typeof yamGetUser === 'function') ? yamGetUser() : null; return (u && u.partner_pseudo) || 'Ton/ta partenaire'; }
  function fromOther(role) { var me = myRole(); return !!(role && me && role !== me); }
  function start() {
    if (typeof window.yamRTWatch !== 'function' || window._yamNotifOn) return;
    window._yamNotifOn = true;
    window.yamRTWatch('notif', [
      { table: 'dm_messages', event: 'INSERT' },
      { table: 'moods', event: 'INSERT' },
      { table: 'moods', event: 'UPDATE' },
      { table: 'petits_mots', event: 'INSERT' }
    ], function (p) {
      if (!p || !p.new || !p.table) return;
      var r = p.new, t = p.table;
      if (t === 'dm_messages') {
        if (!fromOther(r.sender_role) || onTab('navMessages')) return;
        var txt = r.message_type === 'photo' ? '📷 Photo' : r.message_type === 'video' ? '🎬 Vidéo' : (r.text || '');
        window.yamNotif('💬', other(), txt.slice(0, 80), 'navMessages');
      } else if (t === 'moods') {
        if (!fromOther(r.role) || !r.emoji || onTab('navHome')) return;
        window.yamNotif(r.emoji, other(), 'a changé d’humeur' + (r.message ? ' : ' + String(r.message).slice(0, 60) : ''), 'navHome');
      } else if (t === 'petits_mots') {
        if (!fromOther(r.author)) return;
        window.yamNotif('💌', other(), 't’a laissé un petit mot', 'navNous');
      }
    }, 0);
  }
  start();
  document.addEventListener('yam:session_ready', function () { setTimeout(start, 1500); });
})();
