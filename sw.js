// sw.js - GenFin Production Offline Service Worker
const CACHE_VERSION = 'v1.0';
const CACHE_NAME = `genfin-${CACHE_VERSION}`;

// Same-origin assets to cache on install
const STATIC_ASSETS = [
    './',
    './index.html',
    './app-core.js',
    './manifest.json'
];

// External CDN assets – cached individually with cross-origin mode
const EXTERNAL_ASSETS = [
    { url: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', crossOrigin: true },
    { url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js', crossOrigin: true }
];

// URLs that should never be cached (always network)
const NEVER_CACHE = [
    './app-version.json',
    'https://accounts.google.com/gsi/client',
    'https://apis.google.com/js/api.js'
];

// Install event – cache core assets, then external assets individually
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(STATIC_ASSETS)
                    .then(() => {
                        // Cache external assets individually with no-cors to handle opaque responses
                        return Promise.allSettled(
                            EXTERNAL_ASSETS.map(asset => {
                                const req = new Request(asset.url, {
                                    mode: asset.crossOrigin ? 'no-cors' : 'same-origin'
                                });
                                return fetch(req)
                                    .then(response => {
                                        // no-cors gives opaque (status 0) – still cacheable
                                        if (response && (response.status === 200 || response.type === 'opaque')) {
                                            return cache.put(req, response);
                                        }
                                    })
                                    .catch(err => {
                                        console.warn('Failed to cache external asset:', asset.url, err);
                                    });
                            })
                        );
                    });
            })
            .then(() => self.skipWaiting())
    );
});

// Activate – clean old caches and take control
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
        .then(() => self.clients.claim())
    );
});

// Fetch handler
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // 1) Never cache: go straight to network
    if (NEVER_CACHE.some(pattern => url.href.includes(pattern) || url.pathname.includes(pattern))) {
        event.respondWith(fetch(request));
        return;
    }

    // 2) For navigation (HTML pages) – network-first, fall back to cache
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Cache the fresh response for offline use
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => {
                    // Offline – serve from cache
                    return caches.match(request)
                        .then(cached => cached || caches.match('./index.html'))
                        .then(fallback => fallback || new Response(
                            '<html><body><h1>Offline</h1><p>Please connect to the internet.</p></body></html>',
                            { headers: { 'Content-Type': 'text/html' } }
                        ));
                })
        );
        return;
    }

    // 3) For static assets (JS, CSS, etc.) – stale-while-revalidate
    event.respondWith(
        caches.match(request)
            .then(cached => {
                const fetchPromise = fetch(request)
                    .then(response => {
                        if (response && response.status === 200) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                        }
                        return response;
                    })
                    .catch(() => cached); // fallback to cache on network error

                if (cached) {
                    // Return cached immediately, update in background
                    fetchPromise;
                    return cached;
                } else {
                    return fetchPromise;
                }
            })
    );
});

// Message listener to skip waiting
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
