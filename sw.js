// sw.js - GenFin Offline Service Worker
const CACHE_VERSION = 'v1'; // Increment when you change assets
const CACHE_NAME = `genfin-${CACHE_VERSION}`;

// List of assets to cache on install
const ASSETS = [
    './',
    './index.html',
    './app-core.js',
    // External libraries (CDN)
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
    'https://accounts.google.com/gsi/client',
    'https://apis.google.com/js/api.js',
    // Add favicon or manifest if any
    // './favicon.ico'
];

// Install event: cache all assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching assets');
                return cache.addAll(ASSETS);
            })
            .then(() => self.skipWaiting()) // Activate immediately
    );
});

// Activate event: clean old caches and claim clients
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
        .then(() => self.clients.claim()) // Take control of all clients
    );
});

// Fetch event: network-first, fallback to cache
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip cross-origin requests except for our CDN assets (already cached)
    // For external resources, we try network first, but if offline, we may fallback to cache.
    // For simplicity, we'll try network first for all, but for same-origin and known CDN, we also have cache.

    event.respondWith(
        fetch(request)
            .then(response => {
                // If response is valid, clone it and store in cache for future offline use
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    // Cache only same-origin or CDN resources (avoid caching external dynamic content)
                    if (url.origin === location.origin || 
                        url.hostname === 'cdn.jsdelivr.net' || 
                        url.hostname === 'accounts.google.com' || 
                        url.hostname === 'apis.google.com') {
                        cache.put(request, responseClone);
                    }
                });
                return response;
            })
            .catch(() => {
                // Network failed: serve from cache
                return caches.match(request)
                    .then(cachedResponse => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // If not in cache, return a fallback page (index.html) for navigation requests
                        if (request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        // Else return a simple error response
                        return new Response('Offline - Resource not available', { status: 404 });
                    });
            })
    );
});

// Optional: Listen for skipWaiting messages from clients to force update
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});