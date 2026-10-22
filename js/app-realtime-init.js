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
