// ⚡ YAM Service Worker v1.1
// Cache les assets statiques pour un chargement rapide
// Ne met PAS en cache les requêtes Supabase (données toujours fraîches)

var CACHE_NAME = 'yam-v3';

// Assets à mettre en cache au premier chargement
var STATIC_ASSETS = [
  '/yam-app/',
  '/yam-app/index.html',
  '/yam-app/css/main.css',
  '/yam-app/js/app-core.js',
  '/yam-app/js/app-account.js',
  '/yam-app/js/app-nous.js',
  '/yam-app/js/app-music.js',
  '/yam-app/js/app-games.js',
  '/yam-app/js/app-multiplayer.js',
  '/yam-app/js/app-skyjo.js',
  '/yam-app/js/app-pranks.js',
  '/yam-app/js/app-messages.js',
  '/yam-app/js/app-events.js',
  '/yam-app/js/app-nav.js',
  '/yam-app/assets/icons/icon-192.png',
  '/yam-app/assets/icons/icon-512.png',
  '/yam-app/assets/images/reaction_1.png',
  '/yam-app/assets/images/reaction_2.png',
  '/yam-app/assets/images/reaction_3.png',
  '/yam-app/assets/images/reaction_4.png',
  '/yam-app/assets/images/reaction_5.png',
  '/yam-app/assets/images/reaction_6.png',
  '/yam-app/assets/images/reaction_7.png'
];

// ── Installation : mise en cache des assets statiques ──
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // On cache ce qu'on peut, sans bloquer si un asset manque
      return Promise.allSettled(
        STATIC_ASSETS.map(function(url) {
          return cache.add(url).catch(function(e) {
            console.warn('[SW] Impossible de cacher :', url, e);
          });
        })
      );
    }).then(function() {
      // Prend le contrôle immédiatement sans attendre le rechargement
      return self.skipWaiting();
    })
  );
});

// ── Activation : supprime les anciens caches ──
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME;
        }).map(function(key) {
          console.log('[SW] Suppression ancien cache :', key);
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── Fetch : stratégie hybride ──
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // ❌ Ne jamais cacher : Supabase (données temps réel)
  if (url.includes('supabase.co')) {
    return; // laisse passer sans interception
  }

  // ❌ Ne jamais cacher : requêtes POST/PATCH/DELETE
  if (event.request.method !== 'GET') {
    return;
  }

  // ❌ Ne jamais cacher : GitHub raw (mascotte externe)
  if (url.includes('raw.githubusercontent.com')) {
    return;
  }

  // ✅ Assets statiques : Cache First (rapide, offline)
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // Retourne le cache ET met à jour en arrière-plan (stale-while-revalidate)
        var fetchPromise = fetch(event.request).then(function(network) {
          if (network && network.status === 200) {
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, network.clone());
            });
          }
          return network;
        }).catch(function() {});
        return cached;
      }

      // Pas en cache : fetch réseau, puis mise en cache
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        var toCache = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, toCache);
        });
        return response;
      }).catch(function() {
        // Offline et pas en cache : page d'erreur minimale
        if (event.request.destination === 'document') {
          return caches.match('/yam-app/index.html');
        }
      });
    })
  );
});
