/* ═══════════════════════════════════════════════════════════════
   Arion Lead — Service Worker
   Handles: Web Push Notifications (FCM)
   Triggers: New Lead | Manual Reminder | SLA Overdue
   ═══════════════════════════════════════════════════════════════ */

var CACHE_NAME = 'arion-sw-v1';

/* ── Install ─────────────────────────────────────────────────── */
self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(self.clients.claim());
});

/* ── Push receive ────────────────────────────────────────────── */
self.addEventListener('push', function(event) {
  if (!event.data) return;

  var payload;
  try { payload = event.data.json(); }
  catch(e) { payload = { title: 'Arion Lead', body: event.data.text(), type: 'generic' }; }

  var title   = payload.title  || 'Arion Lead';
  var body    = payload.body   || '';
  var type    = payload.type   || 'new_lead';   /* new_lead | reminder | sla */
  var leadId  = payload.leadId || '';
  var waNum   = payload.waNum  || '';
  var panelUrl= payload.url    || '/';

  /* Icon per type */
  var icon = type === 'new_lead'  ? '/arion-icon.png'
           : type === 'reminder'  ? '/arion-icon.png'
           : '/arion-icon.png';

  /* Badge — small monochrome icon (Android) */
  var badge = '/arion-badge.png';

  /* Actions — max 2 (browser limit) */
  var actions = [];
  if (type === 'new_lead' || type === 'reminder') {
    if (waNum) actions.push({ action: 'whatsapp', title: '💬 WhatsApp' });
    actions.push({ action: 'view', title: '👁 Open Lead' });
  } else {
    actions.push({ action: 'view', title: '👁 Open Lead' });
  }

  var options = {
    body:    body,
    icon:    icon,
    badge:   badge,
    tag:     leadId || type,        /* same-lead notifications group/replace */
    renotify: type === 'reminder',  /* reminder re-alerts even if same tag */
    requireInteraction: type === 'new_lead', /* new lead stays until dismissed */
    vibrate: type === 'new_lead' ? [200, 100, 200, 100, 400] : [200, 100, 200],
    data:    { leadId: leadId, waNum: waNum, url: panelUrl, type: type },
    actions: actions
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* ── Notification click ──────────────────────────────────────── */
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var data   = event.notification.data || {};
  var action = event.action;
  var leadId = data.leadId || '';
  var waNum  = data.waNum  || '';
  var panelUrl = (data.url || '/') + (leadId ? ('?openLead=' + leadId) : '');

  if (action === 'whatsapp' && waNum) {
    /* Open WhatsApp directly */
    event.waitUntil(clients.openWindow('https://wa.me/' + waNum));
    return;
  }

  /* Default / 'view' action — focus existing panel tab or open new */
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clist) {
      /* Find an already-open panel window */
      for (var i = 0; i < clist.length; i++) {
        var c = clist[i];
        if (c.url.indexOf('Arion_Branch_Panel') > -1 || c.url.indexOf(data.url) > -1) {
          /* Focus and send message so panel opens the lead directly */
          c.focus();
          c.postMessage({ type: 'OPEN_LEAD', leadId: leadId });
          return;
        }
      }
      /* No panel tab open — open new */
      return clients.openWindow(panelUrl);
    })
  );
});

/* ── Notification close (dismiss) ───────────────────────────── */
self.addEventListener('notificationclose', function(event) {
  /* Optional: log dismissal — not used currently */
});
