// sw.js - GenFin Production Offline Service Worker
const CACHE_VERSION = 'v3';
const CACHE_NAME = `genfin-${CACHE_VERSION}`;

// Assets to cache on install (always from the same origin)
const STATIC_ASSETS = [
    './',
    './index.html',
    './app-core.js',
    './manifest.json'
];

// External CDN assets (cached with crossOrigin)
const EXTERNAL_ASSETS = [
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// URLs that should never be cached (always network)
const NEVER_CACHE = [
    './app-version.json',
    // Google auth scripts – dynamic and must come from network
    'https://accounts.google.com/gsi/client',
    'https://apis.google.com/js/api.js'
];

// Install event – cache core assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                // Cache static and external assets
                return Promise.all([
                    cache.addAll(STATIC_ASSETS),
                    cache.addAll(EXTERNAL_ASSETS)
                ]);
            })
            .then(() => self.skipWaiting()) // Activate immediately
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
        .then(() => self.clients.claim()) // Take control of all clients
    );
});

// Fetch – network‑first for NEVER_CACHE, stale‑while‑revalidate for others
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // 1) Never cache: go straight to network
    if (NEVER_CACHE.some(pattern => url.href.includes(pattern) || url.pathname.includes(pattern))) {
        event.respondWith(fetch(request));
        return;
    }

    // 2) For navigation (HTML pages) – serve from cache, fallback to network, then to offline fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            caches.match(request)
                .then(cached => {
                    if (cached) return cached;
                    // Not in cache – try network
                    return fetch(request)
                        .then(response => {
                            // Cache the new response for future
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                            return response;
                        })
                        .catch(() => {
                            // Offline – serve a simple fallback
                            return caches.match('./index.html') || new Response(
                                '<html><body><h1>Offline</h1><p>Please connect to the internet.</p></body></html>',
                                { headers: { 'Content-Type': 'text/html' } }
                            );
                        });
                })
        );
        return;
    }

    // 3) For static assets (JS, CSS, images, etc.) – use stale‑while‑revalidate
    //    (serve from cache, update in background)
    event.respondWith(
        caches.match(request)
            .then(cached => {
                // Update the cache in the background (don't await)
                const fetchPromise = fetch(request)
                    .then(response => {
                        if (response && response.status === 200) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                        }
                        return response;
                    })
                    .catch(() => {}); // ignore errors

                // Return cached version immediately, or wait for network if not cached
                if (cached) {
                    // Update cache in background
                    fetchPromise;
                    return cached;
                } else {
                    // Not cached – wait for network
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