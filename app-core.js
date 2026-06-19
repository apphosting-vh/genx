// app-core.js - GenFin Modern Edition
// WITH APP VERSION CHECK AND DYNAMIC UPDATE
// Daily backup check, persistent OAuth, folder caching, upsert backup, disconnect, refined UI,
// sync status indicator, retry-on-401, smart auto-backup, service & warranty, product inventory
// + Reset & Delete Data, Daily Backup Status, Auto-backup default 4h enabled, Inventory Type column,
// GST 0% fix, View modal table header fix, File System Access API for local disk sync
// + Production-grade service worker with PWA support
// + Product transaction view (Invoices & Purchase Orders linked to inventory items)
// + Modern SVG icons replacing all emoji icons in the UI
// + Google Drive sync bug fixes (silent refresh, no auto-popup, timeout, UI updates)
// + Fixed "Refresh token request timed out" error: silent refresh failures set state to expired, no toast
// + REAL-TIME SYNC: every change syncs to genfin_cloud_sync.json with offline support and timestamps
// + FIXED: Maximum call stack size exceeded (recursive update loop)
// + FIXED: Token auto-refresh on init – silently refresh expired tokens using prompt:'none'
// + NEW: GST Summary page with timeframe filter and PDF export
// + NEW: Notepad module with full CRUD, sync, backup & restore

(function() {
    'use strict';

    // ---------- SVG Icon Definitions ----------
    const ICONS = {
        plus: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>`,
        export: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>`,
        import: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4 4m0 0l-4-4m4 4V4" /></svg>`,
        cloud: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>`,
        save: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>`,
        trash: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`,
        refresh: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>`,
        check: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
        cross: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
        warning: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`,
        folder: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>`,
        calendar: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>`,
        clock: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
        sync: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>`,
        spinner: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="animate-spin"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>`,
        close: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`,
        power: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>`,
        fileText: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
        stickyNote: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`
    };

    function iconSvg(name, className = '') {
        const svg = ICONS[name] || '';
        return `<span class="icon ${className}">${svg}</span>`;
    }

    // Inject icon styles
    function injectIconStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .icon {
                display: inline-block;
                width: 20px;
                height: 20px;
                vertical-align: middle;
                margin-right: 4px;
                line-height: 1;
                flex-shrink: 0;
            }
            .icon svg {
                width: 100%;
                height: 100%;
                stroke: currentColor;
                fill: none;
                stroke-width: 2;
            }
            .icon.animate-spin svg {
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    injectIconStyles();

    // ---------- App Version ----------
    const APP_VERSION = '1.0.0';
    const VERSION_CHECK_INTERVAL = 60 * 60 * 1000;
    let versionCheckTimer = null;

    // ---------- IndexedDB wrapper ----------
    const DB_NAME = 'GenFinDB';
    const DB_VERSION = 7; // increment version to add 'notes' store
    let db;

    const stores = ['customers', 'suppliers', 'products', 'invoices', 'purchaseOrders', 'expenses', 'settings', 'serviceHistory', 'warranties', 'notes'];

    const INVOICE_STATUSES = ['Unpaid', 'Paid', 'Overdue'];
    const PAYMENT_TERMS = ['Immediate', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];
    const PO_STATUSES = ['Pending', 'Received', 'Cancelled'];
    const PRODUCT_TYPES = ['Generator', 'Accessory', 'Spare Part', 'Service'];
    const PRODUCT_STATUSES = ['In Stock', 'Low Stock', 'Out of Stock', 'Discontinued'];

    let _suppressAutoBackup = false;

    // ---------- Service Worker Registration ----------
    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        const basePath = window.location.pathname.replace(/\/[^/]*$/, '/') || '/';
        navigator.serviceWorker.register('./sw.js', { scope: basePath })
            .then(reg => {
                console.log('Service Worker registered with scope:', reg.scope);
                if (reg.waiting) showUpdatePrompt(reg.waiting);
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdatePrompt(newWorker);
                        }
                    });
                });
            })
            .catch(err => console.warn('Service Worker registration failed:', err));
    }

    function showUpdatePrompt(worker) {
        if (sessionStorage.getItem('update_prompt_dismissed')) return;
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const existing = container.querySelector('.toast-update');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast toast-info toast-update';
        toast.style.cursor = 'pointer';
        toast.innerHTML = `
            <span>${iconSvg('refresh')} App update available!</span>
            <button class="btn btn-sm" style="margin-left:10px; padding:2px 12px; background:#fff; color:#4f46e5; border:none; font-weight:700; cursor:pointer;">Update Now</button>
            <button class="btn btn-sm toast-dismiss" style="margin-left:6px; padding:2px 8px; background:transparent; color:#fff; border:1px solid rgba(255,255,255,0.4); cursor:pointer;">✕</button>
        `;
        toast.querySelector('button:not(.toast-dismiss)').addEventListener('click', (e) => {
            e.stopPropagation();
            worker.postMessage('skipWaiting');
        });
        toast.querySelector('.toast-dismiss').addEventListener('click', (e) => {
            e.stopPropagation();
            sessionStorage.setItem('update_prompt_dismissed', '1');
            toast.remove();
        });
        container.appendChild(toast);
    }

    // ---------- IndexedDB functions ----------
    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = e => {
                const database = e.target.result;
                stores.forEach(storeName => {
                    if (!database.objectStoreNames.contains(storeName)) {
                        const options = storeName === 'settings' ? { keyPath: 'key' } : { keyPath: 'id', autoIncrement: true };
                        database.createObjectStore(storeName, options);
                    }
                });
            };
            request.onsuccess = e => {
                db = e.target.result;
                resolve(db);
            };
            request.onerror = e => reject(e.target.error);
        });
    }

    function dbAdd(storeName, item) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.add(item);
            request.onsuccess = () => {
                resolve(request.result);
                if (!_suppressAutoBackup) {
                    scheduleAutoBackup();
                    scheduleLocalFileWrite();
                    updateLocalChangeTimestamp();
                    scheduleRealTimeSync();
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    function dbPut(storeName, item) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(item);
            request.onsuccess = () => {
                resolve(request.result);
                if (!_suppressAutoBackup) {
                    scheduleAutoBackup();
                    scheduleLocalFileWrite();
                    updateLocalChangeTimestamp();
                    scheduleRealTimeSync();
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    function dbGetAll(storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    function dbGetById(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function dbDelete(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => {
                resolve();
                if (!_suppressAutoBackup) {
                    scheduleAutoBackup();
                    scheduleLocalFileWrite();
                    updateLocalChangeTimestamp();
                    scheduleRealTimeSync();
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    function dbClearStore(storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ---------- Settings helpers ----------
    function dbGetSetting(key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('settings', 'readonly');
            const store = tx.objectStore('settings');
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => reject(request.error);
        });
    }

    function dbSetSetting(key, value) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('settings', 'readwrite');
            const store = tx.objectStore('settings');
            const request = store.put({ key, value });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    function dbDeleteSetting(key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction('settings', 'readwrite');
            const store = tx.objectStore('settings');
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ---- Atomic increment helpers ----
    async function getNextInvoiceNumber() {
        let num = await dbGetSetting('nextInvoiceNumber');
        if (num === null || num === undefined) num = 1;
        const profile = getProfile();
        const prefix = profile.invoicePrefix || 'GEN/';
        const padded = String(num).padStart(3, '0');
        return prefix + padded;
    }

    async function incrementInvoiceNumber() {
        let num = await dbGetSetting('nextInvoiceNumber');
        if (num === null || num === undefined) num = 1;
        else num++;
        await dbSetSetting('nextInvoiceNumber', num);
        return num;
    }

    async function getNextPONumber() {
        let num = await dbGetSetting('nextPONumber');
        if (num === null || num === undefined) num = 1;
        return 'PO-' + String(num).padStart(3, '0');
    }

    async function incrementPONumber() {
        let num = await dbGetSetting('nextPONumber');
        if (num === null || num === undefined) num = 1;
        else num++;
        await dbSetSetting('nextPONumber', num);
        return num;
    }

    // ---------- App Version Check ----------
    async function checkForAppUpdate() {
        try {
            const url = `./app-version.json?t=${Date.now()}`;
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('No app-version.json found – skipping version check.');
                } else {
                    console.warn('Version check failed:', response.status);
                }
                return;
            }
            const data = await response.json();
            const remoteVersion = data.version;
            if (!remoteVersion) return;
            if (isNewerVersion(remoteVersion, APP_VERSION)) {
                showUpdateToast(remoteVersion);
            } else {
                console.log('App is up to date (v' + APP_VERSION + ')');
            }
        } catch (err) {
            console.debug('Version check skipped:', err.message);
        }
    }

    function isNewerVersion(a, b) {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const na = pa[i] || 0;
            const nb = pb[i] || 0;
            if (na > nb) return true;
            if (na < nb) return false;
        }
        return false;
    }

    function showUpdateToast(newVersion) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        if (sessionStorage.getItem('version_toast_dismissed')) return;
        const existing = container.querySelector('.toast-update');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast toast-info toast-update';
        toast.style.cursor = 'pointer';
        toast.innerHTML = `
            <span>${iconSvg('refresh')} New version ${newVersion} available!</span>
            <button class="btn btn-sm" style="margin-left:10px; padding:2px 12px; background:#fff; color:#4f46e5; border:none; font-weight:700; cursor:pointer;">Update Now</button>
            <button class="btn btn-sm toast-dismiss" style="margin-left:6px; padding:2px 8px; background:transparent; color:#fff; border:1px solid rgba(255,255,255,0.4); cursor:pointer;">✕</button>
        `;
        toast.querySelector('button:not(.toast-dismiss)').addEventListener('click', async (e) => {
            e.stopPropagation();
            await performAppUpdate();
        });
        toast.querySelector('.toast-dismiss').addEventListener('click', (e) => {
            e.stopPropagation();
            sessionStorage.setItem('version_toast_dismissed', '1');
            toast.remove();
        });
        toast.addEventListener('click', async () => {
            await performAppUpdate();
        });
        container.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 60000);
    }

    async function performAppUpdate() {
        try {
            showToast('Updating app...', 'info');
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            localStorage.removeItem('genfin_last_success');
            localStorage.removeItem('genfin_last_attempt');
            localStorage.removeItem('genfin_last_error');
            window.location.reload();
        } catch (err) {
            console.error('Update failed:', err);
            showToast('Update failed: ' + err.message, 'error');
        }
    }

    function scheduleVersionCheck() {
        if (versionCheckTimer) clearInterval(versionCheckTimer);
        checkForAppUpdate();
        versionCheckTimer = setInterval(checkForAppUpdate, VERSION_CHECK_INTERVAL);
    }

    // ---------- Google Drive Backup Module ----------
    let gapiInited = false;
    let gisInited = false;
    let tokenClient = null;
    let accessToken = null;
    let tokenExpiry = null;
    let currentDriveUserEmail = '';
    let refreshTimer = null;
    let backupTimer = null;
    let driveInitialized = false;
    let driveInitFailed = false;
    let folderIdCache = null;
    let lastBackupFileId = null;
    let initPromise = null;
    let isRefreshing = false;
    let popupBlocked = false;
    let isDailyBackupRunning = false;

    const GD_CLIENT_ID = '769525551930-5d645morj103efjqp7baq95b3629k38h.apps.googleusercontent.com';
    const GD_SCOPES = 'https://www.googleapis.com/auth/drive.file';
    const GD_APP_FOLDER_NAME = 'GenFinBackups';
    const GD_BACKUP_FILENAME = 'genfin_latest_backup.json';
    const CLOUD_SYNC_FILENAME = 'genfin_cloud_sync.json';

    // Sync state machine
    const syncState = {
        status: 'disconnected',
        lastSuccessAt: null,
        lastAttemptAt: null,
        lastError: null,
        errorToastShown: false,
        recoveryToastShown: false,
    };

    // ---------- Real‑time sync state ----------
    let realTimeSyncDebounceTimer = null;
    let isRealTimeSyncing = false;
    let pendingSync = false;
    let lastLocalChange = null;
    let lastCloudSync = null;

    async function loadSyncTimestamps() {
        lastLocalChange = await dbGetSetting('lastLocalChange') || null;
        lastCloudSync = await dbGetSetting('lastCloudSync') || null;
    }

    async function updateLocalChangeTimestamp() {
        const now = new Date().toISOString();
        lastLocalChange = now;
        await dbSetSetting('lastLocalChange', now);
        updateRealTimeSyncUI();
    }

    async function setCloudSyncTimestamp(timestamp) {
        lastCloudSync = timestamp;
        await dbSetSetting('lastCloudSync', timestamp);
        updateRealTimeSyncUI();
    }

    function scheduleRealTimeSync() {
        if (!accessToken) {
            pendingSync = true;
            updateRealTimeSyncUI();
            return;
        }
        if (realTimeSyncDebounceTimer) clearTimeout(realTimeSyncDebounceTimer);
        realTimeSyncDebounceTimer = setTimeout(() => {
            realTimeSyncDebounceTimer = null;
            performRealTimeSync();
        }, 2000);
    }

    async function performRealTimeSync() {
        if (isRealTimeSyncing) return;
        if (!accessToken) {
            pendingSync = true;
            updateRealTimeSyncUI();
            return;
        }
        if (!navigator.onLine) {
            pendingSync = true;
            updateRealTimeSyncUI();
            return;
        }

        isRealTimeSyncing = true;
        pendingSync = false;
        updateRealTimeSyncUI();

        try {
            await uploadBackupToDrive(false, CLOUD_SYNC_FILENAME);
            const now = new Date().toISOString();
            await setCloudSyncTimestamp(now);
            pendingSync = false;
            updateRealTimeSyncUI();
        } catch (err) {
            console.warn('Real‑time sync failed:', err);
            pendingSync = true;
            updateRealTimeSyncUI();
        } finally {
            isRealTimeSyncing = false;
        }
    }

    async function checkPendingSync() {
        if (pendingSync && accessToken && navigator.onLine) {
            await performRealTimeSync();
        }
    }

    function updateRealTimeSyncUI() {
        const statusEl = document.getElementById('realtimeSyncStatus');
        const localChangeEl = document.getElementById('lastLocalChangeDisplay');
        const cloudSyncEl = document.getElementById('lastCloudSyncDisplay');

        if (localChangeEl) {
            localChangeEl.textContent = lastLocalChange ? new Date(lastLocalChange).toLocaleString() : 'Never';
        }
        if (cloudSyncEl) {
            cloudSyncEl.textContent = lastCloudSync ? new Date(lastCloudSync).toLocaleString() : 'Never';
        }

        if (statusEl) {
            let statusText = '';
            let color = '#6b7280';
            if (!accessToken) {
                statusText = 'Not connected';
                color = '#6b7280';
            } else if (isRealTimeSyncing) {
                statusText = 'Syncing…';
                color = '#f59e0b';
            } else if (pendingSync) {
                statusText = 'Pending sync';
                color = '#ef4444';
            } else if (lastLocalChange && lastCloudSync && lastLocalChange <= lastCloudSync) {
                statusText = '✅ Synced';
                color = '#10b981';
            } else if (lastLocalChange && lastCloudSync && lastLocalChange > lastCloudSync) {
                statusText = '⚠️ Changes pending';
                color = '#f59e0b';
            } else {
                statusText = 'Idle';
                color = '#6b7280';
            }
            statusEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;"></span> ${statusText}`;
        }

        // Also update sidebar indicator (which includes real-time status)
        updateGlobalSyncIndicator();
    }

    // ---------- Drive sync state persistence ----------
    function loadSyncPersist() {
        try {
            syncState.lastSuccessAt = localStorage.getItem('genfin_last_success') || null;
            syncState.lastAttemptAt = localStorage.getItem('genfin_last_attempt') || null;
            syncState.lastError = localStorage.getItem('genfin_last_error') || null;
        } catch (e) {}
    }
    loadSyncPersist();

    function saveSyncPersist() {
        try {
            if (syncState.lastSuccessAt) localStorage.setItem('genfin_last_success', syncState.lastSuccessAt);
            else localStorage.removeItem('genfin_last_success');
            if (syncState.lastAttemptAt) localStorage.setItem('genfin_last_attempt', syncState.lastAttemptAt);
            else localStorage.removeItem('genfin_last_attempt');
            if (syncState.lastError) localStorage.setItem('genfin_last_error', syncState.lastError);
            else localStorage.removeItem('genfin_last_error');
        } catch (e) {}
    }

    function setSyncState(newState, error = null) {
        const prev = syncState.status;
        syncState.status = newState;
        if (error) syncState.lastError = error;
        if (newState === 'success') {
            syncState.lastSuccessAt = new Date().toISOString();
            syncState.lastError = null;
            syncState.errorToastShown = false;
            syncState.recoveryToastShown = false;
        }
        if (newState === 'syncing' || newState === 'error') {
            syncState.lastAttemptAt = new Date().toISOString();
        }
        saveSyncPersist();
        updateGlobalSyncIndicator();

        if (newState === 'error' && prev !== 'error' && !syncState.errorToastShown) {
            if (error && error.includes('silent_refresh_timeout')) {
                // no toast
            } else {
                showToast('⚠️ Drive sync error: ' + (error || 'Unknown error'), 'error');
            }
            syncState.errorToastShown = true;
        }
        if (newState === 'success' && prev === 'error') {
            if (!syncState.recoveryToastShown) {
                showToast('✅ Drive sync recovered', 'success');
                syncState.recoveryToastShown = true;
            }
            syncState.errorToastShown = false;
        }
        // Update settings UI but avoid recursion
        updateSettingsUI();
    }

    function setAccessToken(token) {
        accessToken = token;
        if (token && gapi && gapi.client) {
            try {
                gapi.client.setToken({ access_token: token });
            } catch (e) {
                console.warn('gapi.client.setToken failed, token stored in accessToken variable:', e);
                // Fallback: token is stored in accessToken, will be used in fetch calls.
            }
        }
    }

    // ---------- Token refresh with timeout ----------
    function refreshAccessToken(prompt = 'select_account', timeoutMs = 15000) {
        if (!tokenClient) {
            // Try to reinitialize token client
            if (google && google.accounts) {
                try {
                    tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: GD_CLIENT_ID,
                        scope: GD_SCOPES,
                        callback: async (resp) => {
                            if (resp.error) {
                                await clearDriveToken();
                                showToast('Google auth failed: ' + resp.error, 'error');
                                return;
                            }
                            try {
                                await saveDriveToken(resp.access_token, resp.expires_in, '');
                                updateDriveUI(true);
                                showToast('Connected to Google Drive', 'success');
                                await loadSyncTimestamps();
                                updateRealTimeSyncUI();
                                setTimeout(() => checkPendingSync(), 3000);
                            } catch (e) {
                                showToast('Error saving token: ' + e.message, 'error');
                            }
                        }
                    });
                } catch (e) {
                    return Promise.reject(new Error('Token client not available: ' + e.message));
                }
            } else {
                return Promise.reject(new Error('Token client not available'));
            }
        }
        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                const interval = setInterval(() => {
                    if (!isRefreshing) {
                        clearInterval(interval);
                        if (accessToken) resolve(accessToken);
                        else reject(new Error('Refresh failed'));
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(interval);
                    reject(new Error('Refresh timed out waiting for previous refresh'));
                }, timeoutMs);
            });
        }

        isRefreshing = true;
        return new Promise((resolve, reject) => {
            let resolved = false;
            // originalCallback must be captured here (before the setTimeout closure) so the
            // timeout handler can reference it via closure even though the const is declared below.
            // JS hoists the binding to the top of the executor scope; it is initialised before
            // the timer can fire because the timer is asynchronous.
            let originalCallback; // declared early so the timeout closure below can see it

            const timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    // CRITICAL FIX: restore the original callback so future sign-in / silent-refresh
                    // attempts still work.  The previous code set tokenClient.callback = null here,
                    // which permanently broke all subsequent GIS callbacks after the first timeout.
                    if (tokenClient) tokenClient.callback = originalCallback;
                    isRefreshing = false;
                    if (prompt === 'none') {
                        reject(new Error('silent_refresh_timeout'));
                    } else {
                        reject(new Error('Refresh token request timed out'));
                    }
                }
            }, timeoutMs);

            originalCallback = tokenClient.callback;
            tokenClient.callback = (resp) => {
                if (resolved) return;
                clearTimeout(timeoutId);
                tokenClient.callback = originalCallback;
                isRefreshing = false;
                resolved = true;
                if (resp.error) {
                    // 'immediate_failed' is GIS's way of saying it can't silently
                    // refresh (no active session).  Preserve the error code so
                    // callers can distinguish this from a hard auth failure.
                    const err = new Error(resp.error);
                    err.code = resp.error;
                    reject(err);
                } else {
                    setAccessToken(resp.access_token);
                    tokenExpiry = Date.now() + (resp.expires_in * 1000);
                    dbSetSetting('gdrive_token', resp.access_token).then(() => {
                        dbSetSetting('gdrive_expiry', tokenExpiry);
                        scheduleTokenRefresh(tokenExpiry);
                        setSyncState('idle');
                        // Flush any syncs that were queued while the token was expired.
                        // This is needed when the refresh is triggered by the proactive
                        // timer (scheduleTokenRefresh) rather than by saveDriveToken.
                        setTimeout(() => checkPendingSync(), 2000);
                        resolve(accessToken);
                    }).catch(err => {
                        reject(err);
                    });
                }
            };
            try {
                tokenClient.requestAccessToken({ prompt: prompt });
            } catch (err) {
                clearTimeout(timeoutId);
                tokenClient.callback = originalCallback;
                isRefreshing = false;
                resolved = true;
                reject(err);
            }
        });
    }

    function silentRefreshAccessToken() {
        return refreshAccessToken('none', 10000);
    }

    async function withTokenRetry(fn, retry = true) {
        try {
            return await fn();
        } catch (err) {
            if (retry && (err.status === 401 || (err.result && err.result.error && err.result.error.code === 401))) {
                console.warn('401 detected, attempting silent refresh');
                setSyncState('expired');
                setAccessToken(null);
                try {
                    await silentRefreshAccessToken();
                    const result = await fn();
                    // Success — flush any other pending syncs queued during the outage.
                    setTimeout(() => checkPendingSync(), 2000);
                    return result;
                } catch (refreshErr) {
                    // 'immediate_failed' = GIS can't refresh without a prompt (session gone).
                    // Use 'expired' (not 'disconnected') so the UI shows "reconnect" rather
                    // than "not connected", which is a more accurate description.
                    const isSessionGone = refreshErr.code === 'immediate_failed'
                        || refreshErr.code === 'user_logged_out'
                        || refreshErr.message === 'silent_refresh_timeout';
                    const reason = isSessionGone
                        ? 'Session expired – please reconnect'
                        : 'Token refresh failed';
                    setSyncState('expired', reason);
                    updateDriveUI(false);
                    throw refreshErr;
                }
            }
            throw err;
        }
    }

    // ---- FIXED: saveDriveToken with robust error handling ----
    async function saveDriveToken(token, expiresIn, email) {
        try {
            setAccessToken(token);
            const expiry = Date.now() + (expiresIn * 1000);
            tokenExpiry = expiry;
            currentDriveUserEmail = email || '';

            // Wait for IndexedDB to be ready
            if (!db) {
                await openDB();
            }

            await dbSetSetting('gdrive_token', token);
            await dbSetSetting('gdrive_expiry', expiry);
            await dbSetSetting('gdrive_email', currentDriveUserEmail);
            scheduleTokenRefresh(expiry);
            setSyncState('idle');
            scheduleAutoBackup();
            fetchDriveUserEmail().catch(() => {});
            setTimeout(() => performDailyBackupCheck(), 5000);
            setTimeout(() => checkPendingSync(), 3000);
            updateDriveUI(true);
            updateGlobalSyncIndicator();
            return true;
        } catch (err) {
            console.error('saveDriveToken error:', err);
            showToast('Failed to save token: ' + err.message, 'error');
            throw err;
        }
    }

    async function loadDriveToken() {
        const token = await dbGetSetting('gdrive_token');
        const expiry = await dbGetSetting('gdrive_expiry');
        const email = await dbGetSetting('gdrive_email');
        return { token, expiry, email };
    }

    async function clearDriveToken() {
        setAccessToken(null);
        tokenExpiry = null;
        currentDriveUserEmail = '';
        folderIdCache = null;
        lastBackupFileId = null;
        isRefreshing = false;
        popupBlocked = false;
        if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
        await dbDeleteSetting('gdrive_token');
        await dbDeleteSetting('gdrive_expiry');
        await dbDeleteSetting('gdrive_email');
        setSyncState('disconnected');
        updateDriveUI(false);
        stopAutoBackup();
        pendingSync = false;
        lastLocalChange = null;
        lastCloudSync = null;
        await dbDeleteSetting('lastLocalChange');
        await dbDeleteSetting('lastCloudSync');
        updateRealTimeSyncUI();
    }

    function scheduleTokenRefresh(expiry) {
        if (refreshTimer) clearTimeout(refreshTimer);
        const now = Date.now();
        const timeUntilExpiry = expiry - now;

        // Shared handler for when a proactive silent-refresh succeeds/fails
        const onRefreshSuccess = () => {
            setTimeout(() => checkPendingSync(), 2000);
        };
        const onRefreshFailure = (err) => {
            console.warn('Silent token refresh failed:', err.message);
            setSyncState('expired', 'Session expired – please reconnect');
            setAccessToken(null);
            updateDriveUI(false);
        };

        if (timeUntilExpiry > 5 * 60 * 1000) {
            // Token is healthy — schedule a proactive refresh 5 min before expiry
            const refreshIn = timeUntilExpiry - 5 * 60 * 1000;
            refreshTimer = setTimeout(async () => {
                if (accessToken && tokenClient) {
                    try {
                        await silentRefreshAccessToken();
                        onRefreshSuccess();
                    } catch (err) {
                        onRefreshFailure(err);
                    }
                }
            }, refreshIn);
        } else if (timeUntilExpiry > 0) {
            // Token expiring very soon — refresh immediately in the background
            if (accessToken && tokenClient) {
                silentRefreshAccessToken()
                    .then(onRefreshSuccess)
                    .catch(onRefreshFailure);
            }
        } else {
            // Token ALREADY expired.  Rather than giving up, attempt a silent recovery —
            // GIS can often succeed via prompt:'none' if the browser still has an active
            // Google session, even after the access-token itself has expired.
            if (tokenClient) {
                console.log('Token already expired — attempting silent recovery...');
                setAccessToken(null); // Clear stale token so in-flight ops don't use it
                silentRefreshAccessToken()
                    .then(() => {
                        console.log('Expired token recovered silently');
                        setSyncState('idle');
                        updateDriveUI(true);
                        onRefreshSuccess();
                    })
                    .catch(err => {
                        console.warn('Expired token silent recovery failed:', err.message);
                        setSyncState('expired', 'Session expired – please reconnect');
                        updateDriveUI(false);
                    });
            } else {
                setSyncState('expired', 'Session expired – please reconnect');
                setAccessToken(null);
                updateDriveUI(false);
            }
        }
    }

    // ---------- Google Drive init (now with auto‑refresh) ----------
    async function initGoogleDriveModule(force = false) {
        if (driveInitialized && !force) return;
        if (initPromise) return initPromise;

        initPromise = (async () => {
            try {
                console.log('Initializing Google Drive module...');
                await waitForGlobalObjects();
                await initGoogleAPI();
                await initGIS();
                const stored = await loadDriveToken();
                if (stored.token && stored.expiry) {
                    const now = Date.now();
                    if (stored.expiry > now) {
                        // Token is still valid – restore it
                        setAccessToken(stored.token);
                        tokenExpiry = stored.expiry;
                        currentDriveUserEmail = stored.email || '';
                        updateDriveUI(true);
                        scheduleTokenRefresh(tokenExpiry);
                        fetchDriveUserEmail().catch(() => {});
                        setSyncState('idle');
                        scheduleAutoBackup();
                        console.log('Drive token restored from DB');
                        setTimeout(() => performDailyBackupCheck(), 5000);
                        await loadSyncTimestamps();
                        updateRealTimeSyncUI();
                        setTimeout(() => checkPendingSync(), 3000);
                    } else {
                        // Token expired – attempt silent refresh (no popup)
                        console.log('Drive token expired, attempting silent refresh...');
                        try {
                            await silentRefreshAccessToken();
                            // If we get here, refresh succeeded
                            console.log('Silent refresh succeeded');
                            updateDriveUI(true);
                            setSyncState('idle');
                            await loadSyncTimestamps();
                            updateRealTimeSyncUI();
                            setTimeout(() => checkPendingSync(), 3000);
                        } catch (refreshErr) {
                            // Silent refresh failed – user likely not signed in
                            console.warn('Silent refresh failed:', refreshErr.message);
                            setSyncState('expired', 'Token expired – please reconnect');
                            updateDriveUI(false);
                            // Do not auto-popup; user must click "Connect"
                        }
                    }
                } else {
                    // No token stored
                    updateDriveUI(false);
                    setSyncState('disconnected');
                    await loadSyncTimestamps();
                    updateRealTimeSyncUI();
                }
                driveInitialized = true;
                driveInitFailed = false;
                console.log('Google Drive module ready');
            } catch (err) {
                driveInitFailed = true;
                console.warn('Google Drive init failed:', err);
                updateDriveUI(false);
                setSyncState('disconnected', err.message);
                throw err;
            } finally {
                initPromise = null;
            }
        })();
        return initPromise;
    }

    function waitForGlobalObjects(timeout = 5000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const check = () => {
                if (typeof gapi !== 'undefined' && typeof google !== 'undefined' && google.accounts) {
                    resolve();
                } else if (Date.now() - start > timeout) {
                    reject(new Error('Google APIs timeout'));
                } else {
                    setTimeout(check, 200);
                }
            };
            check();
        });
    }

    async function initGoogleAPI() {
        return new Promise((resolve, reject) => {
            if (!gapi) {
                reject(new Error('gapi not loaded'));
                return;
            }
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
                    });
                    gapiInited = true;
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    async function initGIS() {
        return new Promise((resolve, reject) => {
            if (!google || !google.accounts) {
                reject(new Error('GIS not loaded'));
                return;
            }
            try {
                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: GD_CLIENT_ID,
                    scope: GD_SCOPES,
                    callback: async (resp) => {
                        if (resp.error) {
                            await clearDriveToken();
                            showToast('Google auth failed: ' + resp.error, 'error');
                            return;
                        }
                        try {
                            // FIXED: Use robust saveDriveToken
                            await saveDriveToken(resp.access_token, resp.expires_in, '');
                            // Fetch email after saving
                            try {
                                const email = await fetchDriveUserEmail();
                                if (email) {
                                    currentDriveUserEmail = email;
                                    await dbSetSetting('gdrive_email', email);
                                }
                            } catch (emailErr) {
                                console.warn('Could not fetch user email:', emailErr);
                            }
                            updateDriveUI(true);
                            showToast('Connected to Google Drive', 'success');
                            await loadSyncTimestamps();
                            updateRealTimeSyncUI();
                            setTimeout(() => checkPendingSync(), 3000);
                        } catch (e) {
                            showToast('Error saving token: ' + e.message, 'error');
                            // Reset token client so user can retry
                            tokenClient = null;
                        }
                    }
                });
                gisInited = true;
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    async function fetchDriveUserEmail() {
        if (!accessToken) {
            console.warn('fetchDriveUserEmail: no access token');
            return '';
        }
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!res.ok) {
                const err = new Error('Userinfo request failed: ' + res.status);
                err.status = res.status;
                throw err;
            }
            const data = await res.json();
            if (data.email) {
                currentDriveUserEmail = data.email;
                const emailSpan = document.getElementById('driveUserEmail');
                if (emailSpan) emailSpan.textContent = currentDriveUserEmail;
                return data.email;
            }
            return '';
        } catch (err) {
            console.warn('fetchDriveUserEmail error:', err.message);
            if (err.status === 401) throw err;
            return '';
        }
    }

    function signInToGoogle() {
        console.log('signInToGoogle called');
        popupBlocked = false;
        try {
            if (!driveInitialized || driveInitFailed) {
                initGoogleDriveModule(true)
                    .then(() => {
                        console.log('Init successful, requesting token with select_account...');
                        if (tokenClient) {
                            try {
                                tokenClient.requestAccessToken({ prompt: 'select_account' });
                            } catch (popupErr) {
                                console.warn('Popup blocked or error:', popupErr);
                                popupBlocked = true;
                                showToast('⚠️ Popup was blocked. Please allow popups for this site and try again.', 'error');
                                const authBtn = document.getElementById('gdriveAuthBtn');
                                if (authBtn) authBtn.textContent = '🔄 Allow Popups & Retry';
                            }
                        } else {
                            // Re-initialize token client
                            if (google && google.accounts) {
                                try {
                                    tokenClient = google.accounts.oauth2.initTokenClient({
                                        client_id: GD_CLIENT_ID,
                                        scope: GD_SCOPES,
                                        callback: async (resp) => {
                                            if (resp.error) {
                                                await clearDriveToken();
                                                showToast('Google auth failed: ' + resp.error, 'error');
                                                return;
                                            }
                                            try {
                                                await saveDriveToken(resp.access_token, resp.expires_in, '');
                                                try {
                                                    const email = await fetchDriveUserEmail();
                                                    if (email) {
                                                        currentDriveUserEmail = email;
                                                        await dbSetSetting('gdrive_email', email);
                                                    }
                                                } catch (emailErr) {}
                                                updateDriveUI(true);
                                                showToast('Connected to Google Drive', 'success');
                                                await loadSyncTimestamps();
                                                updateRealTimeSyncUI();
                                                setTimeout(() => checkPendingSync(), 3000);
                                            } catch (e) {
                                                showToast('Error saving token: ' + e.message, 'error');
                                                tokenClient = null;
                                            }
                                        }
                                    });
                                    tokenClient.requestAccessToken({ prompt: 'select_account' });
                                } catch (reinitErr) {
                                    showToast('Error initializing Google Sign-In: ' + reinitErr.message, 'error');
                                }
                            } else {
                                showToast('Google Sign-In not available', 'error');
                            }
                        }
                    })
                    .catch(err => {
                        console.error('Init failed:', err);
                        showToast('Failed to initialize Google Drive: ' + err.message, 'error');
                    });
            } else {
                if (tokenClient) {
                    try {
                        tokenClient.requestAccessToken({ prompt: 'select_account' });
                    } catch (popupErr) {
                        console.warn('Popup blocked or error:', popupErr);
                        popupBlocked = true;
                        showToast('⚠️ Popup was blocked. Please allow popups for this site and try again.', 'error');
                        const authBtn = document.getElementById('gdriveAuthBtn');
                        if (authBtn) authBtn.textContent = '🔄 Allow Popups & Retry';
                    }
                } else {
                    // Re-initialize token client
                    if (google && google.accounts) {
                        try {
                            tokenClient = google.accounts.oauth2.initTokenClient({
                                client_id: GD_CLIENT_ID,
                                scope: GD_SCOPES,
                                callback: async (resp) => {
                                    if (resp.error) {
                                        await clearDriveToken();
                                        showToast('Google auth failed: ' + resp.error, 'error');
                                        return;
                                    }
                                    try {
                                        await saveDriveToken(resp.access_token, resp.expires_in, '');
                                        try {
                                            const email = await fetchDriveUserEmail();
                                            if (email) {
                                                currentDriveUserEmail = email;
                                                await dbSetSetting('gdrive_email', email);
                                            }
                                        } catch (emailErr) {}
                                        updateDriveUI(true);
                                        showToast('Connected to Google Drive', 'success');
                                        await loadSyncTimestamps();
                                        updateRealTimeSyncUI();
                                        setTimeout(() => checkPendingSync(), 3000);
                                    } catch (e) {
                                        showToast('Error saving token: ' + e.message, 'error');
                                        tokenClient = null;
                                    }
                                }
                            });
                            tokenClient.requestAccessToken({ prompt: 'select_account' });
                        } catch (reinitErr) {
                            showToast('Error initializing Google Sign-In: ' + reinitErr.message, 'error');
                        }
                    } else {
                        showToast('Google Sign-In not available', 'error');
                    }
                }
            }
        } catch (err) {
            console.error('Error in signInToGoogle:', err);
            showToast('Error connecting to Google Drive: ' + err.message, 'error');
        }
    }

    // ---------- Drive file operations ----------
    async function ensureBackupFolder(forceRefresh = false) {
        if (!accessToken) throw new Error('Not connected');
        if (folderIdCache && !forceRefresh) return folderIdCache;
        try {
            const response = await withTokenRetry(() =>
                gapi.client.drive.files.list({
                    q: `name='${GD_APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                    fields: 'files(id, name)',
                })
            );
            let folderId;
            if (response.result.files.length > 0) {
                folderId = response.result.files[0].id;
            } else {
                const fileMetadata = {
                    name: GD_APP_FOLDER_NAME,
                    mimeType: 'application/vnd.google-apps.folder',
                };
                const create = await withTokenRetry(() =>
                    gapi.client.drive.files.create({
                        resource: fileMetadata,
                        fields: 'id',
                    })
                );
                folderId = create.result.id;
            }
            folderIdCache = folderId;
            return folderId;
        } catch (err) {
            console.error('ensureBackupFolder error', err);
            throw err;
        }
    }

    async function getLatestBackupFileId(filename = GD_BACKUP_FILENAME) {
        if (!accessToken) return null;
        try {
            const folderId = await ensureBackupFolder();
            const response = await withTokenRetry(() =>
                gapi.client.drive.files.list({
                    q: `'${folderId}' in parents and name='${filename}' and trashed=false`,
                    fields: 'files(id, name)',
                })
            );
            if (response.result.files.length > 0) {
                return response.result.files[0].id;
            }
            return null;
        } catch (err) {
            console.warn('getLatestBackupFileId error:', err);
            return null;
        }
    }

    async function getLatestBackupMetadata(filename = GD_BACKUP_FILENAME) {
        if (!accessToken) return null;
        try {
            const folderId = await ensureBackupFolder();
            const response = await withTokenRetry(() =>
                gapi.client.drive.files.list({
                    q: `'${folderId}' in parents and name='${filename}' and trashed=false`,
                    fields: 'files(id, name, modifiedTime)',
                    pageSize: 1,
                })
            );
            if (response.result.files.length > 0) {
                return response.result.files[0];
            }
            return null;
        } catch (err) {
            console.warn('getLatestBackupMetadata error:', err);
            return null;
        }
    }

    async function deleteDriveFile(fileId) {
        if (!accessToken || !fileId) return false;
        try {
            await withTokenRetry(() =>
                gapi.client.drive.files.delete({ fileId })
            );
            console.log('Deleted file:', fileId);
            return true;
        } catch (err) {
            console.warn('Failed to delete file:', err);
            return false;
        }
    }

    async function uploadBackupToDrive(showToastMsg = true, filename = GD_BACKUP_FILENAME) {
        if (!accessToken) {
            if (showToastMsg) showToast('Not connected to Google Drive', 'error');
            setSyncState('disconnected');
            return false;
        }
        setSyncState('syncing');
        try {
            const folderId = await ensureBackupFolder();
            const customers = await dbGetAll('customers');
            const suppliers = await dbGetAll('suppliers');
            const products = await dbGetAll('products');
            const invoices = await dbGetAll('invoices');
            const purchaseOrders = await dbGetAll('purchaseOrders');
            const expenses = await dbGetAll('expenses');
            const serviceHistory = await dbGetAll('serviceHistory');
            const warranties = await dbGetAll('warranties');
            const notes = await dbGetAll('notes');
            const settings = await dbGetAll('settings');
            const profile = getProfile();
            const backupData = {
                version: 2,
                timestamp: new Date().toISOString(),
                profile,
                customers,
                suppliers,
                products,
                invoices,
                purchaseOrders,
                expenses,
                serviceHistory,
                warranties,
                notes,
                settings
            };
            const jsonStr = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });

            let fileId = await getLatestBackupFileId(filename);
            let uploadUrl, method;

            if (fileId) {
                uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
                method = 'PATCH';
                // IMPORTANT: Do NOT include 'parents' in PATCH metadata.
                // Drive v3 rejects it with 403 ("File already has parents").
                // Parents are immutable after creation — use addParents/removeParents
                // query params if you ever need to move a file.
            } else {
                uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
                method = 'POST';
            }

            // Build the metadata blob once; the Blob is reusable across retries.
            // 'parents' is only included on POST (new file), never on PATCH (update).
            const metadataObj = method === 'POST'
                ? { name: filename, parents: [folderId] }
                : { name: filename };
            const metadataBlob = new Blob([JSON.stringify(metadataObj)], { type: 'application/json' });

            // Build a fresh FormData inside the fn so withTokenRetry can safely
            // call fn() more than once (e.g. after a silent token refresh).
            const buildForm = () => {
                const f = new FormData();
                f.append('metadata', metadataBlob);
                f.append('file', blob);
                return f;
            };

            let response;
            let uploadSuccess = false;
            let alreadyHandled = false;

            try {
                response = await withTokenRetry(async () => {
                    const res = await fetch(uploadUrl, {
                        method: method,
                        headers: { Authorization: `Bearer ${accessToken}` },
                        body: buildForm(),
                    });
                    if (!res.ok) {
                        const err = new Error('Upload failed: ' + res.status);
                        err.status = res.status;
                        throw err;
                    }
                    return res;
                });
                uploadSuccess = true;
            } catch (err) {
                // Fallback: if PATCH still returns 403 for any reason, delete and recreate.
                // This should be rare now that 'parents' is excluded from PATCH metadata.
                if (err.status === 403 && method === 'PATCH') {
                    console.warn('403 on PATCH, trying to delete and recreate...');
                    if (fileId) {
                        await deleteDriveFile(fileId);
                    }
                    const newUploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
                    const newMetadataBlob = new Blob(
                        [JSON.stringify({ name: filename, parents: [folderId] })],
                        { type: 'application/json' }
                    );
                    const retryRes = await withTokenRetry(async () => {
                        const newForm = new FormData();
                        newForm.append('metadata', newMetadataBlob);
                        newForm.append('file', blob);
                        const res = await fetch(newUploadUrl, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${accessToken}` },
                            body: newForm,
                        });
                        if (!res.ok) {
                            const e = new Error('Upload failed: ' + res.status);
                            e.status = res.status;
                            throw e;
                        }
                        return res;
                    });
                    response = retryRes;
                    uploadSuccess = true;
                    const result = await response.json();
                    fileId = result.id;
                    console.log('Created new file with ID:', fileId);
                    alreadyHandled = true;
                } else {
                    throw err;
                }
            }

            if (uploadSuccess && !alreadyHandled) {
                const result = await response.json();
                fileId = result.id;
            }

            if (filename === GD_BACKUP_FILENAME) {
                lastBackupFileId = fileId;
                updateViewBackupLink(lastBackupFileId);
                localStorage.setItem('genfin_last_backup', new Date().toISOString());
                setSyncState('success');
                updateLastBackupUI();
                if (showToastMsg) showToast('Backup uploaded to Google Drive', 'success');
            } else {
                // sync file – just return success
                if (showToastMsg) showToast('Sync successful', 'success');
            }
            return true;
        } catch (err) {
            console.error('uploadBackupToDrive error:', err);
            setSyncState('error', err.message);
            if (showToastMsg) showToast('Upload failed: ' + err.message, 'error');
            return false;
        }
    }

    function updateViewBackupLink(fileId) {
        const link = document.getElementById('viewBackupLink');
        if (link && fileId) {
            link.href = `https://drive.google.com/file/d/${fileId}/view`;
            link.style.display = 'inline';
        } else if (link) {
            link.style.display = 'none';
        }
    }

    async function listDriveBackups() {
        if (!accessToken) throw new Error('Not connected');
        const folderId = await ensureBackupFolder();
        const response = await withTokenRetry(() =>
            gapi.client.drive.files.list({
                q: `'${folderId}' in parents and mimeType='application/json' and trashed=false`,
                fields: 'files(id, name, createdTime)',
                orderBy: 'createdTime desc',
            })
        );
        return response.result.files || [];
    }

    async function restoreFromDrive(fileId) {
        if (!accessToken) throw new Error('Not connected');
        const response = await withTokenRetry(() =>
            gapi.client.drive.files.get({ fileId, alt: 'media' })
        );
        const backupData = response.result;
        if (!backupData.version || backupData.version !== 2) {
            throw new Error('Unsupported backup version. Expected version 2.');
        }
        if (!backupData.profile ||
            !backupData.customers || !backupData.suppliers || !backupData.products ||
            !backupData.invoices || !backupData.purchaseOrders || !backupData.expenses) {
            throw new Error('Invalid backup file format');
        }
        const confirmMsg = '⚠️ WARNING: This will replace ALL existing data.\n\nAre you absolutely sure?';
        if (!confirm(confirmMsg)) return false;

        showToast('Restoring backup, please wait...', 'info');
        _suppressAutoBackup = true;
        try {
            for (const storeName of stores) {
                await dbClearStore(storeName);
            }
            if (backupData.settings && Array.isArray(backupData.settings)) {
                for (const setting of backupData.settings) {
                    await dbSetSetting(setting.key, setting.value);
                }
            }
            for (const customer of backupData.customers) await dbAdd('customers', customer);
            for (const supplier of backupData.suppliers) await dbAdd('suppliers', supplier);
            for (const product of backupData.products) await dbAdd('products', product);
            for (const invoice of backupData.invoices) await dbAdd('invoices', invoice);
            for (const po of backupData.purchaseOrders) await dbAdd('purchaseOrders', po);
            for (const expense of backupData.expenses) await dbAdd('expenses', expense);
            if (backupData.serviceHistory) {
                for (const s of backupData.serviceHistory) await dbAdd('serviceHistory', s);
            }
            if (backupData.warranties) {
                for (const w of backupData.warranties) await dbAdd('warranties', w);
            }
            if (backupData.notes) {
                for (const n of backupData.notes) await dbAdd('notes', n);
            }
            saveProfile(backupData.profile);
            showToast('Backup restored successfully!', 'success');
            navigateTo('invoices');
            await loadSyncTimestamps();
            updateRealTimeSyncUI();
            return true;
        } catch (err) {
            showToast('Restore failed: ' + err.message, 'error');
            return false;
        } finally {
            _suppressAutoBackup = false;
            scheduleAutoBackup();
            scheduleRealTimeSync();
        }
    }

    async function showRestoreDialog() {
        if (!accessToken) {
            showToast('Not connected to Google Drive', 'error');
            return;
        }
        try {
            const files = await listDriveBackups();
            if (!files.length) {
                showToast('No backup files found', 'info');
                return;
            }
            const modalHtml = `
                <div class="modal-overlay" id="restoreModal">
                    <div class="modal">
                        <button class="modal-close" id="closeRestoreModal">${iconSvg('close')}</button>
                        <h3>Restore from Google Drive</h3>
                        <select id="backupSelect" style="width:100%; margin-bottom:16px;">
                            ${files.map(f => `<option value="${f.id}">${f.name} (${new Date(f.createdTime).toLocaleString()})</option>`).join('')}
                        </select>
                        <button class="btn btn-primary" id="confirmRestoreBtn">Restore Selected</button>
                    </div>
                </div>
            `;
            const modalContainer = document.getElementById('modalContainer');
            modalContainer.innerHTML = modalHtml;
            const closeModal = () => { modalContainer.innerHTML = ''; };
            document.getElementById('closeRestoreModal').addEventListener('click', closeModal);
            document.getElementById('restoreModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
            document.getElementById('confirmRestoreBtn').addEventListener('click', async () => {
                const selectedId = document.getElementById('backupSelect').value;
                closeModal();
                await restoreFromDrive(selectedId);
            });
        } catch (err) {
            showToast('Error listing backups: ' + err.message, 'error');
        }
    }

    async function disconnectDrive() {
        if (confirm('Disconnect from Google Drive?')) {
            await clearDriveToken();
            updateDriveUI(false);
            showToast('Disconnected from Google Drive', 'info');
            const currentPage = document.querySelector('.nav-item.active')?.dataset?.page;
            if (currentPage === 'settings') await renderSettings();
        }
    }

    // ---------- Drive UI updates ----------
    function updateDriveUI(connected) {
        const authPanel = document.getElementById('gdriveAuthPanel');
        const actionsDiv = document.getElementById('gdriveActions');
        const statusSpan = document.getElementById('gdriveStatus');
        const disconnectBtn = document.getElementById('gdriveDisconnectBtn');
        const authBtn = document.getElementById('gdriveAuthBtn');
        if (!authPanel || !actionsDiv) return;
        if (connected && accessToken) {
            authPanel.style.display = 'none';
            actionsDiv.style.display = 'block';
            const expiryStr = tokenExpiry ? new Date(tokenExpiry).toLocaleString() : 'unknown';
            statusSpan.innerHTML = `
                Connected as <strong>${currentDriveUserEmail || '...'}</strong><br>
                <span style="font-size:0.8rem;color:#6b7280;">Token expires: ${expiryStr}</span>
            `;
            if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
            if (authBtn) authBtn.textContent = 'Connect to Google Drive';
            updateDailyBackupStatus();
            updateRealTimeSyncUI();
        } else {
            authPanel.style.display = 'block';
            actionsDiv.style.display = 'none';
            statusSpan.innerHTML = driveInitFailed ? 'Drive service unavailable' : 'Not connected';
            if (disconnectBtn) disconnectBtn.style.display = 'none';
            if (authBtn) {
                if (popupBlocked) {
                    authBtn.textContent = '🔄 Allow Popups & Retry';
                } else {
                    authBtn.textContent = 'Connect to Google Drive';
                }
            }
            const dailyStatus = document.getElementById('dailyBackupStatus');
            if (dailyStatus) dailyStatus.textContent = 'Not connected';
            updateRealTimeSyncUI();
        }
        updateGlobalSyncIndicator();
    }

    function updateLastBackupUI() {
        const lastBackupSpan = document.getElementById('lastBackupTime');
        if (lastBackupSpan) {
            const last = localStorage.getItem('genfin_last_backup');
            lastBackupSpan.textContent = last ? new Date(last).toLocaleString() : 'Never';
        }
        if (!syncState.lastSuccessAt && localStorage.getItem('genfin_last_backup')) {
            syncState.lastSuccessAt = localStorage.getItem('genfin_last_backup');
            saveSyncPersist();
        }
    }

    async function updateDailyBackupStatus() {
        const statusEl = document.getElementById('dailyBackupStatus');
        if (!statusEl) return;
        if (!accessToken) {
            statusEl.textContent = 'Not connected';
            return;
        }
        try {
            const meta = await getLatestBackupMetadata(GD_BACKUP_FILENAME);
            if (meta && meta.modifiedTime) {
                const d = new Date(meta.modifiedTime);
                statusEl.innerHTML = `${iconSvg('check')} ${d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
                statusEl.style.color = '#10b981';
            } else {
                statusEl.textContent = 'No backup found in Drive';
                statusEl.style.color = '#f59e0b';
            }
        } catch (err) {
            console.warn('Daily backup status error:', err);
            statusEl.textContent = '⚠️ Could not fetch';
            statusEl.style.color = '#ef4444';
        }
    }

    // ---------- Sidebar sync indicator (combined Drive + real-time) ----------
    function createSyncIndicator() {
        const footer = document.querySelector('.sidebar-footer');
        if (!footer) return;
        let indicator = document.getElementById('syncIndicator');
        if (!indicator) {
            indicator = document.createElement('span');
            indicator.id = 'syncIndicator';
            indicator.style.cssText = 'margin-left: auto; cursor: default; display: inline-flex; align-items: center; gap: 4px;';
            indicator.title = 'Sync status';
            footer.appendChild(indicator);
        }
        return indicator;
    }

    function updateGlobalSyncIndicator() {
        const indicator = document.getElementById('syncIndicator');
        if (!indicator) return;
        let iconHtml = '';
        let color = '#6b7280';
        let tooltip = 'Not connected';

        if (!accessToken) {
            iconHtml = iconSvg('cloud');
            color = '#6b7280';
            tooltip = 'Not connected to Drive';
        } else if (isRealTimeSyncing) {
            iconHtml = iconSvg('refresh', 'animate-spin');
            color = '#f59e0b';
            tooltip = 'Real‑time sync in progress';
        } else if (pendingSync) {
            iconHtml = iconSvg('clock');
            color = '#ef4444';
            tooltip = 'Changes pending sync';
        } else if (lastLocalChange && lastCloudSync && lastLocalChange <= lastCloudSync) {
            iconHtml = iconSvg('check');
            color = '#10b981';
            tooltip = 'All changes synced';
        } else {
            iconHtml = iconSvg('cloud');
            color = '#6b7280';
            tooltip = 'Connected, idle';
        }
        indicator.innerHTML = `<span style="color:${color};">${iconHtml}</span>`;
        indicator.title = tooltip;
        // Do NOT call updateSettingsUI() here to avoid recursion.
    }

    // ---------- Auto-backup scheduling ----------
    let autoBackupInterval = null;
    let backupDebounceTimer = null;
    let backupFrequency = 240;

    function loadBackupFrequency() {
        const stored = localStorage.getItem('gdrive_backup_frequency');
        if (stored) {
            const val = parseInt(stored);
            if (val > 0) backupFrequency = val;
        } else {
            backupFrequency = 240;
            localStorage.setItem('gdrive_backup_frequency', '240');
        }
    }
    loadBackupFrequency();

    function stopAutoBackup() {
        if (autoBackupInterval) { clearInterval(autoBackupInterval); autoBackupInterval = null; }
        if (backupDebounceTimer) { clearTimeout(backupDebounceTimer); backupDebounceTimer = null; }
    }

    function scheduleAutoBackup() {
        const autoEnabled = localStorage.getItem('gdrive_auto_backup') !== 'false';
        const connected = accessToken != null;
        if (!autoEnabled || !connected) {
            stopAutoBackup();
            return;
        }
        if (backupDebounceTimer) clearTimeout(backupDebounceTimer);
        backupDebounceTimer = setTimeout(async () => {
            await uploadBackupToDrive(false, GD_BACKUP_FILENAME);
            backupDebounceTimer = null;
        }, 30000);

        if (autoBackupInterval) clearInterval(autoBackupInterval);
        const intervalMs = backupFrequency * 60 * 1000;
        autoBackupInterval = setInterval(async () => {
            if (accessToken) {
                await uploadBackupToDrive(false, GD_BACKUP_FILENAME);
            }
        }, intervalMs);
    }

    async function performDailyBackupCheck() {
        if (!accessToken) {
            console.log('Daily backup check: Not connected, skipping.');
            return;
        }
        if (isDailyBackupRunning) {
            console.log('Daily backup check: Already running, skipping.');
            return;
        }
        isDailyBackupRunning = true;
        try {
            console.log('Performing daily backup check...');
            const latestFile = await getLatestBackupMetadata(GD_BACKUP_FILENAME);
            const now = new Date();
            let shouldBackup = false;

            if (!latestFile) {
                console.log('No existing backup file found. Will create one.');
                shouldBackup = true;
            } else {
                const modified = new Date(latestFile.modifiedTime);
                const diffHours = (now - modified) / (1000 * 60 * 60);
                console.log(`Latest backup modified at ${modified.toISOString()}, ${diffHours.toFixed(1)} hours ago.`);
                if (diffHours > 24) {
                    console.log('Backup is older than 24 hours. Triggering backup.');
                    shouldBackup = true;
                } else {
                    console.log('Backup is recent enough, no action needed.');
                }
            }

            if (shouldBackup) {
                console.log('Starting silent daily backup...');
                await uploadBackupToDrive(false, GD_BACKUP_FILENAME);
            }
        } catch (err) {
            console.warn('Daily backup check error:', err);
        } finally {
            isDailyBackupRunning = false;
        }
    }

    // ---------- Settings UI update (avoids recursion) ----------
    function updateSettingsUI() {
        const statusBadge = document.getElementById('syncStatusBadge');
        const reconnectBtn = document.getElementById('gdriveReconnectBtn');
        const connectBtn = document.getElementById('gdriveAuthBtn');
        const lastSuccessEl = document.getElementById('lastSyncSuccess');
        const lastAttemptEl = document.getElementById('lastSyncAttempt');
        const lastErrorEl = document.getElementById('lastSyncError');
        const viewLink = document.getElementById('viewBackupLink');

        if (statusBadge) {
            const state = syncState.status;
            let dotColor = '#6b7280';
            let label = 'Not Connected';
            switch (state) {
                case 'idle': dotColor = '#6b7280'; label = 'Connected & Idle'; break;
                case 'syncing': dotColor = '#f59e0b'; label = 'Syncing...'; break;
                case 'success': dotColor = '#10b981'; label = 'Connected & Synced'; break;
                case 'error': dotColor = '#ef4444'; label = 'Sync Error'; break;
                case 'expired': dotColor = '#f59e0b'; label = 'Token Expired – Reconnect'; break;
                default: dotColor = '#6b7280'; label = 'Not Connected'; break;
            }
            statusBadge.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${dotColor};margin-right:6px;"></span> ${label}`;
        }

        if (reconnectBtn && connectBtn) {
            const isConnected = accessToken != null;
            const isExpired = syncState.status === 'expired';
            if (isConnected && isExpired) {
                reconnectBtn.style.display = 'inline-block';
                connectBtn.style.display = 'none';
            } else if (isConnected) {
                reconnectBtn.style.display = 'none';
                connectBtn.style.display = 'none';
            } else {
                reconnectBtn.style.display = 'none';
                connectBtn.style.display = 'inline-block';
                if (popupBlocked) {
                    connectBtn.textContent = '🔄 Allow Popups & Retry';
                } else {
                    connectBtn.textContent = 'Connect to Google Drive';
                }
            }
        }

        if (lastSuccessEl) lastSuccessEl.textContent = syncState.lastSuccessAt ? new Date(syncState.lastSuccessAt).toLocaleString() : 'Never';
        if (lastAttemptEl) lastAttemptEl.textContent = syncState.lastAttemptAt ? new Date(syncState.lastAttemptAt).toLocaleString() : 'Never';
        if (lastErrorEl) {
            lastErrorEl.textContent = syncState.lastError || 'None';
            lastErrorEl.style.color = syncState.lastError ? '#ef4444' : '#6b7280';
        }

        if (viewLink && lastBackupFileId) {
            viewLink.href = `https://drive.google.com/file/d/${lastBackupFileId}/view`;
            viewLink.style.display = 'inline';
        } else if (viewLink) {
            viewLink.style.display = 'none';
        }

        updateDailyBackupStatus();
        updateRealTimeSyncUI(); // updates the real-time card and also calls updateGlobalSyncIndicator
    }

    // ---------- Business Profile ----------
    const defaultProfile = {
        businessName: 'Your Generator Services',
        address: '123 Main Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        gstin: '27ABCDE1234F1Z5',
        phone: '9876543210',
        email: 'hello@genfin.in',
        bankName: 'State Bank of India',
        accountNo: '12345678901',
        ifsc: 'SBIN0001234',
        upi: 'genfin@upi',
        invoicePrefix: 'GEN/24-25/',
    };

    function getProfile() {
        const stored = localStorage.getItem('genfin_profile');
        return stored ? JSON.parse(stored) : { ...defaultProfile };
    }

    function saveProfile(profile) {
        localStorage.setItem('genfin_profile', JSON.stringify(profile));
        scheduleLocalFileWrite();
        updateLocalChangeTimestamp();
        scheduleRealTimeSync();
    }

    // ---- Service and Warranty ID generators ----
    async function getNextServiceId() {
        let next = await dbGetSetting('nextServiceId');
        if (next === null || next === undefined) next = 1;
        return 'SRV-' + String(next).padStart(4, '0');
    }

    async function incrementServiceId() {
        let next = await dbGetSetting('nextServiceId');
        if (next === null || next === undefined) next = 1;
        else next++;
        await dbSetSetting('nextServiceId', next);
        return next;
    }

    async function getNextWarrantyId() {
        let next = await dbGetSetting('nextWarrantyId');
        if (next === null || next === undefined) next = 1;
        return 'WAR-' + String(next).padStart(4, '0');
    }

    async function incrementWarrantyId() {
        let next = await dbGetSetting('nextWarrantyId');
        if (next === null || next === undefined) next = 1;
        else next++;
        await dbSetSetting('nextWarrantyId', next);
        return next;
    }

    // ---------- GST Logic ----------
    function getGstRates(stateOfSupply, partyState) {
        const isIntra = stateOfSupply && partyState && stateOfSupply.trim().toLowerCase() === partyState.trim().toLowerCase();
        return { intra: isIntra, cgst: isIntra ? 9 : 0, sgst: isIntra ? 9 : 0, igst: isIntra ? 0 : 18 };
    }

    function applyDiscountAndRecalcTaxes(itemsRaw, discount, stateOfSupply, partyState, products) {
        const itemsWithBase = itemsRaw.map(it => {
            const prod = products.find(p => p.id == it.productId) || {};
            const originalTaxable = it.rate * it.qty;
            return {
                ...it,
                originalTaxable,
                description: prod.name || 'Unknown Item',
                hsn: prod.hsnSacCode || '',
                selectedGstRate: it.selectedGstRate !== undefined && it.selectedGstRate !== null ? it.selectedGstRate : 18
            };
        });
        const totalOriginalTaxable = itemsWithBase.reduce((sum, i) => sum + i.originalTaxable, 0);
        let discountApplied = Math.min(discount, totalOriginalTaxable);
        let ratio = totalOriginalTaxable > 0 ? (totalOriginalTaxable - discountApplied) / totalOriginalTaxable : 1;
        const processedItems = itemsWithBase.map(it => {
            const discountedTaxable = it.originalTaxable * ratio;
            const gstInfo = getGstRates(stateOfSupply, partyState);
            const gstRate = it.selectedGstRate;
            const effectiveCgst = gstInfo.intra ? gstRate / 2 : 0;
            const effectiveSgst = gstInfo.intra ? gstRate / 2 : 0;
            const effectiveIgst = gstInfo.intra ? 0 : gstRate;
            const cgstAmt = (discountedTaxable * effectiveCgst) / 100;
            const sgstAmt = (discountedTaxable * effectiveSgst) / 100;
            const igstAmt = (discountedTaxable * effectiveIgst) / 100;
            return {
                productId: it.productId,
                description: it.description,
                hsn: it.hsn,
                qty: it.qty,
                rate: it.rate,
                selectedGstRate: gstRate,
                taxable: discountedTaxable,
                cgstRate: effectiveCgst,
                sgstRate: effectiveSgst,
                igstRate: effectiveIgst,
                cgstAmt,
                sgstAmt,
                igstAmt,
                total: discountedTaxable + cgstAmt + sgstAmt + igstAmt
            };
        });
        const subtotal = processedItems.reduce((s, i) => s + i.taxable, 0);
        const totalTax = processedItems.reduce((s, i) => s + i.cgstAmt + i.sgstAmt + i.igstAmt, 0);
        const grandTotal = subtotal + totalTax;
        return { items: processedItems, subtotal, totalTax, grandTotal };
    }

    // ---------- Helpers ----------
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function formatCurrency(amount) {
        return '₹ ' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function addDays(dateStr, days) {
        const d = new Date(dateStr);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    }

    function getDateRange(period, year, sub) {
        const now = new Date();
        year = parseInt(year) || now.getFullYear();
        let start, end;
        if (period === 'Weekly') {
            const weekStart = sub ? new Date(sub) : new Date();
            start = new Date(weekStart);
            start.setHours(0,0,0,0);
            end = new Date(start);
            end.setDate(end.getDate() + 6);
            end.setHours(23,59,59,999);
        } else if (period === 'Monthly') {
            const month = parseInt(sub) || 0;
            start = new Date(year, month, 1);
            end = new Date(year, month + 1, 0, 23,59,59,999);
        } else if (period === 'Quarterly') {
            const quarter = parseInt(sub) || 1;
            const startMonth = (quarter - 1) * 3;
            start = new Date(year, startMonth, 1);
            end = new Date(year, startMonth + 3, 0, 23,59,59,999);
        } else if (period === 'Half-Yearly') {
            const half = sub === 'H2' ? 1 : 0;
            const startMonth = half * 6;
            start = new Date(year, startMonth, 1);
            end = new Date(year, startMonth + 6, 0, 23,59,59,999);
        } else if (period === 'Yearly') {
            start = new Date(year, 0, 1);
            end = new Date(year, 11, 31, 23,59,59,999);
        } else {
            start = new Date(2000,0,1);
            end = new Date(2099,11,31);
        }
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            if (m === '"') return '&quot;';
            if (m === "'") return '&#39;';
            return m;
        }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
            return c;
        });
    }

    function filterByDateRange(items, fromDate, toDate) {
        if (!fromDate && !toDate) return items;
        return items.filter(item => {
            const itemDate = item.date;
            if (!itemDate) return false;
            if (fromDate && itemDate < fromDate) return false;
            if (toDate && itemDate > toDate) return false;
            return true;
        });
    }

    const TABLE_HEADER_STYLE = 'background: #1e1a4a; color: white; font-weight: 600;';

    // ---------- Navigation ----------
    const mainContent = document.getElementById('mainContent');
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const offlineIndicator = document.getElementById('offlineIndicator');
    const statusDot = document.getElementById('statusDot');

    function navigateTo(page) {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        const activeNav = document.querySelector(`[data-page="${page}"]`);
        if (activeNav) activeNav.classList.add('active');
        renderPage(page);
        if (window.innerWidth <= 768) sidebar.classList.remove('open');
        document.dispatchEvent(new CustomEvent('pageChange', { detail: { page } }));
    }
    window.navigateTo = navigateTo;

    async function renderPage(page) {
        try {
            switch (page) {
                case 'invoices': await renderInvoices(); break;
                case 'purchase-orders': await renderPurchaseOrders(); break;
                case 'expenses': await renderExpenses(); break;
                case 'customers': await renderCustomers(); break;
                case 'suppliers': await renderSuppliers(); break;
                case 'products': await renderProducts(); break;
                case 'reports': await renderReports(); break;
                case 'profile': renderProfile(); break;
                case 'settings': await renderSettings(); break;
                case 'service-warranty': await renderServiceWarranty(); break;
                case 'gst-summary': await renderGSTSummary(); break;
                case 'notepad': await renderNotepad(); break;
                default: await renderInvoices();
            }
        } catch (err) {
            console.error(err);
            showToast('Error loading page: ' + err.message, 'error');
        }
    }

    document.addEventListener('click', e => {
        const navItem = e.target.closest('.nav-item');
        if (navItem && navItem.dataset.page) navigateTo(navItem.dataset.page);
    });

    if (menuToggle) {
        menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    }
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    function updateOnlineStatus() {
        if (statusDot && offlineIndicator) {
            if (navigator.onLine) {
                statusDot.className = 'status-dot';
                offlineIndicator.textContent = 'Online';
                if (accessToken) {
                    setTimeout(() => performDailyBackupCheck(), 3000);
                    setTimeout(() => checkPendingSync(), 2000);
                }
            } else {
                statusDot.className = 'status-dot offline';
                offlineIndicator.textContent = 'Offline';
            }
        }
    }

    // ---------- Invoices ----------
    async function renderInvoices() {
        try {
            const allInvoices = await dbGetAll('invoices');
            const customers = await dbGetAll('customers');
            const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
            let fromDate = '', toDate = '';
            let filteredInvoices = [...allInvoices];
            
            const renderTable = () => {
                let html = `
                    <div class="page-header"><h1 class="page-title">Invoices</h1><button class="btn btn-primary" id="addInvoiceBtn">${iconSvg('plus')} New Invoice</button></div>
                    <div class="card">
                        <div class="filter-bar" style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; align-items: flex-end;">
                            <div class="form-group" style="margin-bottom:0;"><label>From Date</label><input type="date" id="invFromDate" value="${fromDate}" style="padding: 8px;"></div>
                            <div class="form-group" style="margin-bottom:0;"><label>To Date</label><input type="date" id="invToDate" value="${toDate}" style="padding: 8px;"></div>
                            <button class="btn btn-primary" id="applyInvFilter">Apply Filter</button>
                            <button class="btn btn-secondary" id="clearInvFilter">Clear</button>
                        </div>
                        <div class="table-wrap">
                            <table style="width:100%; border-collapse: collapse;">
                                <thead><tr style="${TABLE_HEADER_STYLE}"><th>Invoice #</th><th>Date</th><th>Due Date</th><th>Customer</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody>
                `;
                if (filteredInvoices.length === 0) {
                    html += `<tr><td colspan="7" class="empty-state">No invoices found in selected date range.</td></tr>`;
                } else {
                    filteredInvoices.forEach(inv => {
                        html += `<tr>
                            <td>${escapeHtml(inv.invoiceNumber)}</td>
                            <td>${formatDate(inv.date)}</td>
                            <td>${formatDate(inv.dueDate)}</td>
                            <td>${escapeHtml(customerMap[inv.customerId] || '')}</td>
                            <td>${formatCurrency(inv.grandTotal)}</td>
                            <td><span class="badge ${inv.paymentStatus === 'Paid' ? 'badge-paid' : (inv.paymentStatus === 'Overdue' ? 'badge-overdue' : 'badge-pending')}">${inv.paymentStatus || 'Unpaid'}</span></td>
                            <td>
                                <button class="btn btn-outline btn-sm view-invoice" data-id="${inv.id}">View</button>
                                <button class="btn btn-secondary btn-sm edit-invoice" data-id="${inv.id}">Edit</button>
                                <button class="btn btn-primary btn-sm export-invoice" data-id="${inv.id}">PDF</button>
                                ${inv.paymentStatus !== 'Paid' ? `<button class="btn btn-success btn-sm mark-paid-btn" data-id="${inv.id}" data-status="Paid">Paid</button>` : ''}
                                ${inv.paymentStatus === 'Paid' ? `<button class="btn btn-warning btn-sm mark-unpaid-btn" data-id="${inv.id}" data-status="Unpaid">Unpaid</button>` : ''}
                                <button class="btn btn-danger btn-sm delete-invoice" data-id="${inv.id}">${iconSvg('trash')}</button>
                            </td>
                        </tr>`;
                    });
                }
                html += `</tbody></table></div></div>`;
                mainContent.innerHTML = html;
                
                document.getElementById('addInvoiceBtn')?.addEventListener('click', () => showInvoiceModal());
                document.querySelectorAll('.view-invoice').forEach(btn => btn.addEventListener('click', () => showInvoiceViewModal(Number(btn.dataset.id))));
                document.querySelectorAll('.edit-invoice').forEach(btn => btn.addEventListener('click', async () => {
                    const inv = await dbGetById('invoices', Number(btn.dataset.id));
                    if (inv) showInvoiceModal(inv);
                }));
                document.querySelectorAll('.export-invoice').forEach(btn => btn.addEventListener('click', () => exportInvoicePDF(Number(btn.dataset.id))));
                document.querySelectorAll('.mark-paid-btn, .mark-unpaid-btn').forEach(btn => btn.addEventListener('click', async () => {
                    await updateInvoiceStatus(Number(btn.dataset.id), btn.dataset.status);
                    await renderInvoices();
                }));
                document.querySelectorAll('.delete-invoice').forEach(btn => btn.addEventListener('click', async () => {
                    if (confirm('Delete this invoice?')) { await dbDelete('invoices', Number(btn.dataset.id)); await renderInvoices(); }
                }));
                document.getElementById('applyInvFilter')?.addEventListener('click', () => {
                    fromDate = document.getElementById('invFromDate').value;
                    toDate = document.getElementById('invToDate').value;
                    filteredInvoices = filterByDateRange(allInvoices, fromDate, toDate);
                    renderTable();
                });
                document.getElementById('clearInvFilter')?.addEventListener('click', () => {
                    fromDate = '';
                    toDate = '';
                    filteredInvoices = [...allInvoices];
                    renderTable();
                });
            };
            filteredInvoices = [...allInvoices];
            renderTable();
        } catch (err) {
            showToast('Failed to load invoices', 'error');
            console.error(err);
        }
    }

    async function updateInvoiceStatus(id, newStatus) {
        try {
            const inv = await dbGetById('invoices', id);
            if (!inv) return showToast('Invoice not found', 'error');
            inv.paymentStatus = newStatus;
            await dbPut('invoices', inv);
            showToast(`Invoice marked as ${newStatus}`, 'success');
            await renderInvoices();
        } catch (err) {
            showToast('Error updating status', 'error');
        }
    }

    async function showInvoiceViewModal(id) {
        try {
            const inv = await dbGetById('invoices', id);
            if (!inv) return showToast('Invoice not found', 'error');
            const profile = getProfile();
            const customers = await dbGetAll('customers');
            const customer = customers.find(c => c.id === inv.customerId) || {};
            const statusOptions = INVOICE_STATUSES.map(s => `<option value="${s}" ${s === inv.paymentStatus ? 'selected' : ''}>${s}</option>`).join('');
            const content = `
                <div style="padding:20px; font-family:sans-serif; max-width:700px; margin:auto;">
                    <h2>${escapeHtml(profile.businessName)}</h2>
                    <p>${escapeHtml(profile.address)}, ${escapeHtml(profile.city)}, ${escapeHtml(profile.state)} - ${escapeHtml(profile.pincode)}<br>GSTIN: ${escapeHtml(profile.gstin)}</p>
                    <hr>
                    <h3>Invoice: ${escapeHtml(inv.invoiceNumber)}</h3>
                    <p>Date: ${formatDate(inv.date)} &nbsp; | &nbsp; Due Date: ${formatDate(inv.dueDate)} &nbsp; | &nbsp; Payment Terms: ${escapeHtml(inv.paymentTerms)}<br>
                    Customer: ${escapeHtml(customer.name || 'N/A')} &nbsp; | &nbsp; GSTIN: ${escapeHtml(customer.gstin || 'N/A')}</p>
                    <table border="1" cellpadding="6" style="width:100%; border-collapse:collapse; background:#fff;">
                        <thead>
                            <tr style="background:#f1f5f9; color:#111827;">
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">Item</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">HSN</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">Qty</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">Rate</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">GST</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">Taxable</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">CGST</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">SGST</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">IGST</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">Total</th>
                            </tr>
                        </thead>
                        <tbody>${inv.items.map(i => `<tr><td style="padding:6px;">${escapeHtml(i.description)}</td><td style="padding:6px;">${escapeHtml(i.hsn)}</td><td style="padding:6px; text-align:right;">${i.qty}</td><td style="padding:6px; text-align:right;">${formatCurrency(i.rate)}</td><td style="padding:6px; text-align:center;">${i.selectedGstRate}%</td><td style="padding:6px; text-align:right;">${formatCurrency(i.taxable)}</td><td style="padding:6px; text-align:right;">${formatCurrency(i.cgstAmt)}</td><td style="padding:6px; text-align:right;">${formatCurrency(i.sgstAmt)}</td><td style="padding:6px; text-align:right;">${formatCurrency(i.igstAmt)}</td><td style="padding:6px; text-align:right;">${formatCurrency(i.total)}</td></tr>`).join('')}</tbody>
                    </table>
                    <p style="text-align:right;">Subtotal: ${formatCurrency(inv.subtotal)}<br>Discount: ${formatCurrency(inv.subtotal - inv.items.reduce((s,i)=>s+i.taxable,0))}<br>Total Tax: ${formatCurrency(inv.totalTax)}<br><strong>Grand Total: ${formatCurrency(inv.grandTotal)}</strong></p>
                    <div style="margin-top:12px; display:flex; gap:8px; align-items:center;">
                        <label>Status:</label>
                        <select id="viewInvStatusSelect" class="item-gst">${statusOptions}</select>
                        <button class="btn btn-primary btn-sm" id="updateViewInvStatusBtn">Update Status</button>
                    </div>
                </div>
            `;
            const modalContainer = document.getElementById('modalContainer');
            modalContainer.innerHTML = `
                <div class="modal-overlay" id="viewInvModalOverlay">
                    <div class="modal" style="max-width:800px;">
                        <button class="modal-close" id="closeViewInvModal">${iconSvg('close')}</button>
                        <div style="max-height:70vh; overflow-y:auto;">${content}</div>
                        <div style="text-align:right; margin-top:16px;">
                            <button class="btn btn-secondary" id="editViewInvBtn">Edit</button>
                            <button class="btn btn-primary" id="printViewInvBtn">Print / Export PDF</button>
                            <button class="btn btn-outline" id="closeViewInvBtn2">Close</button>
                        </div>
                    </div>
                </div>
            `;
            const close = () => { modalContainer.innerHTML = ''; };
            document.getElementById('closeViewInvModal').addEventListener('click', close);
            document.getElementById('closeViewInvBtn2').addEventListener('click', close);
            document.getElementById('viewInvModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) close(); });
            document.getElementById('printViewInvBtn').addEventListener('click', () => { exportInvoicePDF(id); });
            document.getElementById('editViewInvBtn').addEventListener('click', () => {
                close();
                showInvoiceModal(inv);
            });
            document.getElementById('updateViewInvStatusBtn').addEventListener('click', async () => {
                const newStatus = document.getElementById('viewInvStatusSelect').value;
                await updateInvoiceStatus(id, newStatus);
                close();
                showInvoiceViewModal(id);
            });
        } catch (err) {
            showToast('Error loading invoice details', 'error');
        }
    }

    async function exportInvoicePDF(id) {
        try {
            const inv = await dbGetById('invoices', id);
            if (!inv) return showToast('Invoice not found', 'error');
            const profile = getProfile();
            const customers = await dbGetAll('customers');
            const customer = customers.find(c => c.id === inv.customerId) || {};
            const printHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Invoice ${inv.invoiceNumber}</title>
                    <style>
                        body { font-family: 'Inter', Arial, sans-serif; margin: 20px; color: #111827; background: #fff; }
                        .invoice-container { max-width: 1100px; margin: 0 auto; background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; }
                        .header { text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #4f46e5; }
                        .header h1 { margin: 0; font-size: 28px; color: #4f46e5; }
                        .header p { margin: 5px 0; font-size: 12px; color: #6b7280; }
                        .title { font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; color: #1f2937; }
                        .info-row { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
                        .info-box { width: 48%; border: 1px solid #e5e7eb; padding: 12px; border-radius: 6px; background: #f9fafb; }
                        .info-box strong { display: block; margin-bottom: 5px; color: #4f46e5; }
                        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
                        th { background: #f3f4f6; padding: 10px 8px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb; color: #111827; }
                        td { padding: 8px; border: 1px solid #e5e7eb; text-align: left; }
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        .totals { margin-top: 20px; text-align: right; font-size: 14px; }
                        .grand-total { font-size: 18px; font-weight: bold; color: #4f46e5; }
                        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; }
                        @media print { body { padding: 0; } .invoice-container { border: none; } }
                    </style>
                </head>
                <body>
                    <div class="invoice-container">
                        <div class="header"><h1>${escapeHtml(profile.businessName)}</h1><p>${escapeHtml(profile.address)}, ${escapeHtml(profile.city)}, ${escapeHtml(profile.state)} - ${escapeHtml(profile.pincode)}<br>GSTIN: ${escapeHtml(profile.gstin)} | Phone: ${escapeHtml(profile.phone)} | Email: ${escapeHtml(profile.email)}</p></div>
                        <div class="title">TAX INVOICE</div>
                        <div class="info-row">
                            <div class="info-box"><strong>Bill To:</strong>${escapeHtml(customer.name || 'N/A')}<br>GSTIN: ${escapeHtml(customer.gstin || 'N/A')}<br>State: ${escapeHtml(customer.state || 'N/A')}<br>Phone: ${escapeHtml(customer.phone || 'N/A')}</div>
                            <div class="info-box"><strong>Invoice Details:</strong>Invoice No: ${escapeHtml(inv.invoiceNumber)}<br>Date: ${formatDate(inv.date)}<br>Due Date: ${formatDate(inv.dueDate)}<br>Payment Terms: ${escapeHtml(inv.paymentTerms)}<br>Status: ${inv.paymentStatus}</div>
                        </div>
                        <table><thead><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate (₹)</th><th>GST%</th><th>Taxable (₹)</th><th>CGST (₹)</th><th>SGST (₹)</th><th>IGST (₹)</th><th>Total (₹)</th></tr></thead>
                        <tbody>${inv.items.map((item, idx) => `<tr><td class="text-center">${idx+1}</td><td>${escapeHtml(item.description)}</td><td class="text-center">${escapeHtml(item.hsn)}</td><td class="text-right">${item.qty}</td><td class="text-right">${formatCurrency(item.rate)}</td><td class="text-center">${item.selectedGstRate}%</td><td class="text-right">${formatCurrency(item.taxable)}</td><td class="text-right">${formatCurrency(item.cgstAmt)}</td><td class="text-right">${formatCurrency(item.sgstAmt)}</td><td class="text-right">${formatCurrency(item.igstAmt)}</td><td class="text-right">${formatCurrency(item.total)}</td></tr>`).join('')}</tbody></table>
                        <div class="totals"><p>Subtotal (Taxable): ${formatCurrency(inv.subtotal)}</p><p>Discount: ${formatCurrency(inv.discount || 0)}</p><p>Total Tax: ${formatCurrency(inv.totalTax)}</p><p class="grand-total">Grand Total: ${formatCurrency(inv.grandTotal)}</p></div>
                        <div class="footer"><p>Thank you for your business! This is a system generated invoice.</p><p>Bank: ${escapeHtml(profile.bankName)} | A/c: ${escapeHtml(profile.accountNo)} | IFSC: ${escapeHtml(profile.ifsc)} | UPI: ${escapeHtml(profile.upi)}</p></div>
                    </div>
                    <script>window.print();<\/script>
                </body>
                </html>
            `;
            const printWindow = window.open('', '_blank');
            printWindow.document.write(printHtml);
            printWindow.document.close();
        } catch (err) {
            showToast('Error generating PDF', 'error');
        }
    }

    // ---------- Helper row functions for invoice/PO item rows ----------
    function invoiceItemRow(item, idx, products) {
        const productOptions = products.map(p => `<option value="${p.id}" ${item && item.productId == p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
        const qty = item ? item.qty : 1;
        const rate = item ? item.rate : 0;
        const gst = item ? item.selectedGstRate : 18;
        return `<div class="invoice-item-row" style="display:flex; gap:8px; margin-bottom:8px; align-items:end; flex-wrap:wrap;">
            <div class="form-group" style="flex:2; min-width:120px;"><label>Product</label><select class="item-product" style="width:100%;">${productOptions}</select></div>
            <div class="form-group" style="flex:1; min-width:70px;"><label>Qty</label><input type="number" class="item-qty" value="${qty}" step="1" min="1" style="width:100%;"></div>
            <div class="form-group" style="flex:1; min-width:80px;"><label>Rate (₹)</label><input type="number" class="item-rate" value="${rate}" step="0.01" min="0" style="width:100%;"></div>
            <div class="form-group" style="flex:1; min-width:70px;"><label>GST %</label><select class="item-gst" style="width:100%;">${[0,5,12,18,28].map(g => `<option value="${g}" ${g == gst ? 'selected' : ''}>${g}%</option>`).join('')}</select></div>
            <button type="button" class="btn btn-danger btn-sm remove-item-row" style="margin-bottom:2px;">${iconSvg('cross')}</button>
        </div>`;
    }

    function poItemRow(item, idx, products) {
        const productOptions = products.map(p => `<option value="${p.id}" ${item && item.productId == p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('');
        const qty = item ? item.qty : 1;
        const rate = item ? item.rate : 0;
        const gst = item ? item.selectedGstRate : 18;
        return `<div class="po-item-row" style="display:flex; gap:8px; margin-bottom:8px; align-items:end; flex-wrap:wrap;">
            <div class="form-group" style="flex:2; min-width:120px;"><label>Product</label><select class="item-product" style="width:100%;">${productOptions}</select></div>
            <div class="form-group" style="flex:1; min-width:70px;"><label>Qty</label><input type="number" class="item-qty" value="${qty}" step="1" min="1" style="width:100%;"></div>
            <div class="form-group" style="flex:1; min-width:80px;"><label>Rate (₹)</label><input type="number" class="item-rate" value="${rate}" step="0.01" min="0" style="width:100%;"></div>
            <div class="form-group" style="flex:1; min-width:70px;"><label>GST %</label><select class="item-gst" style="width:100%;">${[0,5,12,18,28].map(g => `<option value="${g}" ${g == gst ? 'selected' : ''}>${g}%</option>`).join('')}</select></div>
            <button type="button" class="btn btn-danger btn-sm remove-row" style="margin-bottom:2px;">${iconSvg('cross')}</button>
        </div>`;
    }

    // ----- Invoice Modal -----
    async function showInvoiceModal(invoiceData = null) {
        try {
            const customers = await dbGetAll('customers');
            const products = await dbGetAll('products');
            const profile = getProfile();
            const isEdit = !!invoiceData;
            const title = isEdit ? 'Edit Invoice' : 'New Invoice';
            const defDate = isEdit ? invoiceData.date : new Date().toISOString().split('T')[0];
            const defTerms = isEdit ? invoiceData.paymentTerms : 'Net 30 Days';
            const defDueDate = isEdit ? invoiceData.dueDate : '';
            const defStatus = isEdit ? invoiceData.paymentStatus : 'Unpaid';
            const defDiscount = isEdit && invoiceData.discount !== undefined ? invoiceData.discount : 0;

            const modalHtml = `
                <div class="modal-overlay" id="invoiceModalOverlay">
                    <div class="modal">
                        <button class="modal-close" id="closeInvoiceModal">${iconSvg('close')}</button>
                        <h3>${title}</h3>
                        <form id="invoiceForm">
                            <div class="form-grid">
                                <div class="form-group"><label>Invoice Number</label><input type="text" id="invNumber" value="${isEdit ? invoiceData.invoiceNumber : await getNextInvoiceNumber()}" ${isEdit ? '' : 'readonly'}></div>
                                <div class="form-group"><label>Date</label><input type="date" id="invDate" value="${defDate}"></div>
                                <div class="form-group"><label>Customer</label><select id="invCustomer">${customers.map(c => `<option value="${c.id}" ${isEdit && invoiceData.customerId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select></div>
                                <div class="form-group"><label>Payment Terms</label><select id="invPaymentTerms">${PAYMENT_TERMS.map(term => `<option value="${term}" ${term === defTerms ? 'selected' : ''}>${term}</option>`).join('')}</select></div>
                                <div class="form-group"><label>Due Date (auto)</label><input type="date" id="invDueDate" readonly value="${defDueDate}"></div>
                                <div class="form-group"><label>Payment Status</label><select id="invStatus">${INVOICE_STATUSES.map(s => `<option value="${s}" ${s === defStatus ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
                            </div>
                            <h4 style="margin-top:16px;">Items</h4>
                            <div id="invoiceItemsContainer">${(isEdit ? invoiceData.items : []).map((item, idx) => invoiceItemRow(item, idx, products)).join('')}</div>
                            <button type="button" class="btn btn-outline btn-sm" id="addInvoiceItem">${iconSvg('plus')} Add Item</button>
                            <div class="card" style="margin-top:16px; background:#f8fafc;">
                                <div class="form-grid span-3">
                                    <div class="form-group"><label>Subtotal (Taxable)</label><div style="font-weight:700; font-size:1rem;" id="invSubtotalDisplay">₹ 0.00</div></div>
                                    <div class="form-group"><label>Discount (₹)</label><input type="number" id="invDiscount" value="${defDiscount}" step="0.01" style="font-weight:600;"></div>
                                    <div class="form-group"><label>Total Tax</label><div style="font-weight:700; font-size:1rem;" id="invTaxDisplay">₹ 0.00</div></div>
                                    <div class="form-group"><label>Grand Total</label><div style="font-weight:800; font-size:1.2rem; color:var(--primary);" id="invGrandTotalDisplay">₹ 0.00</div></div>
                                </div>
                            </div>
                            <div class="form-group" style="margin-top:12px;"><label>Notes</label><textarea id="invNotes">${isEdit ? (invoiceData.notes || '') : ''}</textarea></div>
                            <div style="margin-top:16px; text-align:right;">
                                <button type="button" class="btn btn-outline" id="cancelInvoiceBtn">Cancel</button>
                                <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Save'} Invoice</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            document.getElementById('modalContainer').innerHTML = modalHtml;
            const closeModal = () => { document.getElementById('modalContainer').innerHTML = ''; };
            document.getElementById('closeInvoiceModal').addEventListener('click', closeModal);
            document.getElementById('cancelInvoiceBtn').addEventListener('click', closeModal);
            document.getElementById('invoiceModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

            const invDateInput = document.getElementById('invDate');
            const termsSelect = document.getElementById('invPaymentTerms');
            const dueDateInput = document.getElementById('invDueDate');
            const customerSelect = document.getElementById('invCustomer');

            function calculateDueDate() {
                const dateVal = invDateInput.value;
                const term = termsSelect.value;
                if (!dateVal) return;
                let days = 0;
                if (term === 'Immediate') days = 0;
                else if (term.startsWith('Net')) days = parseInt(term.split(' ')[1]) || 0;
                dueDateInput.value = addDays(dateVal, days);
            }
            invDateInput.addEventListener('change', calculateDueDate);
            termsSelect.addEventListener('change', calculateDueDate);
            if (!isEdit || !invoiceData.dueDate) calculateDueDate();

            const itemsContainer = document.getElementById('invoiceItemsContainer');
            itemsContainer.addEventListener('change', function(e) {
                if (e.target.classList.contains('item-product')) {
                    const row = e.target.closest('.invoice-item-row');
                    const productId = e.target.value;
                    const product = products.find(p => p.id == productId);
                    if (product) {
                        const rateInput = row.querySelector('.item-rate');
                        const gstSelect = row.querySelector('.item-gst');
                        rateInput.value = product.sellingPrice || 0;
                        const gstValue = product.gstRate || 18;
                        if ([...gstSelect.options].some(opt => opt.value == gstValue)) gstSelect.value = gstValue;
                        else gstSelect.value = 18;
                    }
                    updateBreakdown();
                }
            });
            document.getElementById('addInvoiceItem').addEventListener('click', () => {
                if (products.length === 0) { showToast('Please add products first', 'warning'); return; }
                itemsContainer.insertAdjacentHTML('beforeend', invoiceItemRow(null, 0, products));
                updateBreakdown();
            });
            document.getElementById('invoiceForm').addEventListener('input', updateBreakdown);
            document.getElementById('invoiceForm').addEventListener('change', updateBreakdown);
            customerSelect.addEventListener('change', updateBreakdown);

            function updateBreakdown() {
                const items = [];
                document.querySelectorAll('.invoice-item-row').forEach(row => {
                    const productId = row.querySelector('.item-product').value;
                    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
                    const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
                    const gst = parseFloat(row.querySelector('.item-gst').value) || 0;
                    items.push({ productId, qty, rate, selectedGstRate: gst });
                });
                const customerId = Number(customerSelect.value);
                const customer = customers.find(c => c.id === customerId);
                const stateOfSupply = customer ? customer.state : profile.state;
                const discount = parseFloat(document.getElementById('invDiscount').value) || 0;
                const { subtotal, totalTax, grandTotal } = applyDiscountAndRecalcTaxes(items, discount, stateOfSupply, profile.state, products);
                document.getElementById('invSubtotalDisplay').textContent = formatCurrency(subtotal);
                document.getElementById('invTaxDisplay').textContent = formatCurrency(totalTax);
                document.getElementById('invGrandTotalDisplay').textContent = formatCurrency(grandTotal);
            }

            document.getElementById('invoiceForm').addEventListener('submit', async e => {
                e.preventDefault();
                try {
                    const customerId = Number(customerSelect.value);
                    if (!customerId || isNaN(customerId) || customerId <= 0) {
                        showToast('Please select a valid customer.', 'error');
                        return;
                    }
                    const itemRows = document.querySelectorAll('.invoice-item-row');
                    if (itemRows.length === 0) {
                        showToast('Please add at least one item.', 'error');
                        return;
                    }
                    let valid = true;
                    itemRows.forEach(row => {
                        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
                        const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
                        if (qty <= 0 || rate <= 0) valid = false;
                    });
                    if (!valid) {
                        showToast('Each item must have quantity and rate greater than zero.', 'error');
                        return;
                    }

                    const itemsRaw = [];
                    itemRows.forEach(row => {
                        itemsRaw.push({
                            productId: row.querySelector('.item-product').value,
                            qty: parseFloat(row.querySelector('.item-qty').value) || 0,
                            rate: parseFloat(row.querySelector('.item-rate').value) || 0,
                            selectedGstRate: parseFloat(row.querySelector('.item-gst').value) || 0
                        });
                    });
                    const customer = customers.find(c => c.id === customerId);
                    const stateOfSupply = customer ? customer.state : profile.state;
                    const discount = parseFloat(document.getElementById('invDiscount').value) || 0;
                    const { items, subtotal, totalTax, grandTotal } = applyDiscountAndRecalcTaxes(itemsRaw, discount, stateOfSupply, profile.state, products);
                    const invoiceObj = {
                        invoiceNumber: document.getElementById('invNumber').value,
                        date: invDateInput.value,
                        customerId,
                        items, subtotal, discount, totalTax, grandTotal,
                        paymentTerms: termsSelect.value, dueDate: dueDateInput.value,
                        paymentStatus: document.getElementById('invStatus').value,
                        notes: document.getElementById('invNotes').value,
                        stateOfSupply, isIntraState: getGstRates(stateOfSupply, profile.state).intra
                    };
                    if (isEdit) { invoiceObj.id = invoiceData.id; await dbPut('invoices', invoiceObj); }
                    else { await dbAdd('invoices', invoiceObj); await incrementInvoiceNumber(); }
                    showToast('Invoice saved', 'success');
                    closeModal();
                    await renderInvoices();
                } catch (err) { showToast('Error saving invoice', 'error'); console.error(err); }
            });
            itemsContainer.querySelectorAll('.invoice-item-row').forEach(row => {
                const productSelect = row.querySelector('.item-product');
                const productId = productSelect.value;
                const product = products.find(p => p.id == productId);
                if (product) {
                    const rateInput = row.querySelector('.item-rate');
                    const gstSelect = row.querySelector('.item-gst');
                    if (!rateInput.value || rateInput.value == 0) rateInput.value = product.sellingPrice || 0;
                    if (!gstSelect.value || gstSelect.value == 18) {
                        const gstValue = product.gstRate || 18;
                        if ([...gstSelect.options].some(opt => opt.value == gstValue)) gstSelect.value = gstValue;
                        else gstSelect.value = 18;
                    }
                }
            });
            updateBreakdown();
        } catch (err) { showToast('Error opening invoice form', 'error'); }
    }

    // ---------- Purchase Orders ----------
    async function renderPurchaseOrders() {
        try {
            const allPOs = await dbGetAll('purchaseOrders');
            const suppliers = await dbGetAll('suppliers');
            const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));
            let fromDate = '', toDate = '';
            let filteredPOs = [...allPOs];
            
            const renderTable = () => {
                let html = `<div class="page-header"><h1 class="page-title">Purchase Orders</h1><button class="btn btn-primary" id="addPOBtn">${iconSvg('plus')} New PO</button></div>
                <div class="card"><div class="filter-bar" style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:flex-end;">
                    <div class="form-group" style="margin-bottom:0;"><label>From Date</label><input type="date" id="poFromDate" value="${fromDate}" style="padding:8px;"></div>
                    <div class="form-group" style="margin-bottom:0;"><label>To Date</label><input type="date" id="poToDate" value="${toDate}" style="padding:8px;"></div>
                    <button class="btn btn-primary" id="applyPOFilter">Apply Filter</button><button class="btn btn-secondary" id="clearPOFilter">Clear</button>
                </div><div class="table-wrap"><table style="width:100%;"><thead><tr style="${TABLE_HEADER_STYLE}"><th>PO #</th><th>Date</th><th>Supplier</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>`;
                if (filteredPOs.length === 0) html += `<tr><td colspan="6" class="empty-state">No purchase orders in selected date range.</td></tr>`;
                else filteredPOs.forEach(po => {
                    let statusActions = '';
                    if (po.status === 'Pending') statusActions = `<button class="btn btn-success btn-sm mark-received-btn" data-id="${po.id}" data-status="Received">Receive</button><button class="btn btn-warning btn-sm mark-cancelled-btn" data-id="${po.id}" data-status="Cancelled">Cancel</button>`;
                    else if (po.status === 'Received' || po.status === 'Cancelled') statusActions = `<button class="btn btn-outline btn-sm mark-pending-btn" data-id="${po.id}" data-status="Pending">Reopen</button>`;
                    html += `<tr><td>${po.poNumber}</td><td>${formatDate(po.date)}</td><td>${supplierMap[po.supplierId] || ''}</td><td>${formatCurrency(po.grandTotal)}</td><td>${po.status}</td>
                            <td><button class="btn btn-outline btn-sm view-po" data-id="${po.id}">View</button><button class="btn btn-secondary btn-sm edit-po" data-id="${po.id}">Edit</button>
                            <button class="btn btn-primary btn-sm export-po" data-id="${po.id}">PDF</button>${statusActions}<button class="btn btn-danger btn-sm delete-po" data-id="${po.id}">${iconSvg('trash')}</button></td></tr>`;
                });
                html += `</tbody></table></div></div>`;
                mainContent.innerHTML = html;
                document.getElementById('addPOBtn')?.addEventListener('click', () => showPOModal());
                document.querySelectorAll('.view-po').forEach(btn => btn.addEventListener('click', () => showPOViewModal(Number(btn.dataset.id))));
                document.querySelectorAll('.edit-po').forEach(btn => btn.addEventListener('click', async () => { const po = await dbGetById('purchaseOrders', Number(btn.dataset.id)); if (po) showPOModal(po); }));
                document.querySelectorAll('.export-po').forEach(btn => btn.addEventListener('click', () => exportPOPDF(Number(btn.dataset.id))));
                document.querySelectorAll('.mark-received-btn, .mark-cancelled-btn, .mark-pending-btn').forEach(btn => btn.addEventListener('click', async () => { await updatePOStatus(Number(btn.dataset.id), btn.dataset.status); }));
                document.querySelectorAll('.delete-po').forEach(btn => btn.addEventListener('click', async () => { if (confirm('Delete this PO?')) { await dbDelete('purchaseOrders', Number(btn.dataset.id)); await renderPurchaseOrders(); } }));
                document.getElementById('applyPOFilter')?.addEventListener('click', () => { fromDate = document.getElementById('poFromDate').value; toDate = document.getElementById('poToDate').value; filteredPOs = filterByDateRange(allPOs, fromDate, toDate); renderTable(); });
                document.getElementById('clearPOFilter')?.addEventListener('click', () => { fromDate = ''; toDate = ''; filteredPOs = [...allPOs]; renderTable(); });
            };
            filteredPOs = [...allPOs];
            renderTable();
        } catch(err) { showToast('Failed to load purchase orders', 'error'); }
    }

    async function updatePOStatus(id, newStatus) {
        try { const po = await dbGetById('purchaseOrders', id); if (!po) return; po.status = newStatus; await dbPut('purchaseOrders', po); showToast(`PO status updated to ${newStatus}`, 'success'); await renderPurchaseOrders(); } catch(err) { showToast('Error updating PO status', 'error'); }
    }

    async function showPOViewModal(id) {
        try {
            const po = await dbGetById('purchaseOrders', id);
            if (!po) return showToast('PO not found', 'error');
            const profile = getProfile();
            const suppliers = await dbGetAll('suppliers');
            const supplier = suppliers.find(s => s.id === po.supplierId) || {};
            const statusOptions = PO_STATUSES.map(s => `<option value="${s}" ${s === po.status ? 'selected' : ''}>${s}</option>`).join('');
            const content = `
                <div style="padding:20px; font-family:sans-serif; max-width:700px; margin:auto;">
                    <h2>${escapeHtml(profile.businessName)}</h2>
                    <p>${escapeHtml(profile.address)}, ${escapeHtml(profile.city)}, ${escapeHtml(profile.state)} - ${escapeHtml(profile.pincode)}<br>GSTIN: ${escapeHtml(profile.gstin)}</p>
                    <hr><h3>Purchase Order: ${escapeHtml(po.poNumber)}</h3>
                    <p>Date: ${formatDate(po.date)}<br>Supplier: ${escapeHtml(supplier.name || 'N/A')} &nbsp; | &nbsp; GSTIN: ${escapeHtml(supplier.gstin || 'N/A')}</p>
                    <table border="1" cellpadding="6" style="width:100%; border-collapse:collapse; background:#fff;">
                        <thead>
                            <tr style="background:#f1f5f9; color:#111827;">
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">Item</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">Qty</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">Rate</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">GST</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">Taxable</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">CGST</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">SGST</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">IGST</th>
                                <th style="background:#f1f5f9; color:#111827; padding:8px;">Total</th>
                            </tr>
                        </thead>
                        <tbody>${po.items.map(i => `<tr><td style="padding:6px;">${escapeHtml(i.description)}</td><td style="padding:6px; text-align:right;">${i.qty}</td><td style="padding:6px; text-align:right;">${formatCurrency(i.rate)}</td><td style="padding:6px; text-align:center;">${i.selectedGstRate}%</td><td style="padding:6px; text-align:right;">${formatCurrency(i.taxable)}</td><td style="padding:6px; text-align:right;">${formatCurrency(i.cgstAmt)}</td><td style="padding:6px; text-align:right;">${formatCurrency(i.sgstAmt)}</td><td style="padding:6px; text-align:right;">${formatCurrency(i.igstAmt)}</td><td style="padding:6px; text-align:right;">${formatCurrency(i.total)}</td></tr>`).join('')}</tbody>
                    </table>
                    <p style="text-align:right;">Subtotal: ${formatCurrency(po.subtotal)}<br>Discount: ${formatCurrency(po.discount)}<br>Total Tax: ${formatCurrency(po.totalTax)}<br><strong>Grand Total: ${formatCurrency(po.grandTotal)}</strong></p>
                    <div style="margin-top:12px;"><label>Status:</label><select id="viewPOStatusSelect">${statusOptions}</select><button class="btn btn-primary btn-sm" id="updateViewPOStatusBtn">Update Status</button></div>
                </div>
            `;
            const modalContainer = document.getElementById('modalContainer');
            modalContainer.innerHTML = `<div class="modal-overlay" id="viewPOModalOverlay"><div class="modal" style="max-width:800px;"><button class="modal-close" id="closeViewPOModal">${iconSvg('close')}</button><div style="max-height:70vh; overflow-y:auto;">${content}</div><div style="text-align:right; margin-top:16px;"><button class="btn btn-secondary" id="editViewPOBtn">Edit</button><button class="btn btn-primary" id="printViewPOBtn">Print / Export PDF</button><button class="btn btn-outline" id="closeViewPOBtn2">Close</button></div></div></div>`;
            const close = () => { modalContainer.innerHTML = ''; };
            document.getElementById('closeViewPOModal').addEventListener('click', close);
            document.getElementById('closeViewPOBtn2').addEventListener('click', close);
            document.getElementById('viewPOModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) close(); });
            document.getElementById('printViewPOBtn').addEventListener('click', () => { exportPOPDF(id); });
            document.getElementById('editViewPOBtn').addEventListener('click', () => { close(); showPOModal(po); });
            document.getElementById('updateViewPOStatusBtn').addEventListener('click', async () => { const newStatus = document.getElementById('viewPOStatusSelect').value; await updatePOStatus(id, newStatus); close(); showPOViewModal(id); });
        } catch(err) { showToast('Error loading PO details', 'error'); }
    }

    async function exportPOPDF(id) {
        try {
            const po = await dbGetById('purchaseOrders', id);
            if (!po) return showToast('PO not found', 'error');
            const profile = getProfile();
            const suppliers = await dbGetAll('suppliers');
            const supplier = suppliers.find(s => s.id === po.supplierId) || {};
            const printHtml = `
                <!DOCTYPE html>
                <html><head><meta charset="UTF-8"><title>Purchase Order ${po.poNumber}</title>
                <style>
                    body { font-family: 'Inter', Arial, sans-serif; margin: 20px; color: #111827; background: #fff; }
                    .po-container { max-width: 1100px; margin: 0 auto; background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; }
                    .header { text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #4f46e5; }
                    .header h1 { margin: 0; font-size: 28px; color: #4f46e5; }
                    .header p { margin: 5px 0; font-size: 12px; color: #6b7280; }
                    .title { font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; color: #1f2937; }
                    .info-row { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; }
                    .info-box { width: 48%; border: 1px solid #e5e7eb; padding: 12px; border-radius: 6px; background: #f9fafb; }
                    .info-box strong { display: block; margin-bottom: 5px; color: #4f46e5; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
                    th { background: #f3f4f6; padding: 10px 8px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb; color: #111827; }
                    td { padding: 8px; border: 1px solid #e5e7eb; text-align: left; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .totals { margin-top: 20px; text-align: right; font-size: 14px; }
                    .grand-total { font-size: 18px; font-weight: bold; color: #4f46e5; }
                    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; }
                    @media print { body { padding: 0; } .po-container { border: none; } }
                </style>
                </head>
                <body>
                <div class="po-container">
                    <div class="header"><h1>${escapeHtml(profile.businessName)}</h1><p>${escapeHtml(profile.address)}, ${escapeHtml(profile.city)}, ${escapeHtml(profile.state)} - ${escapeHtml(profile.pincode)}<br>GSTIN: ${escapeHtml(profile.gstin)} | Phone: ${escapeHtml(profile.phone)} | Email: ${escapeHtml(profile.email)}</p></div>
                    <div class="title">PURCHASE ORDER</div>
                    <div class="info-row"><div class="info-box"><strong>Supplier:</strong>${escapeHtml(supplier.name || 'N/A')}<br>GSTIN: ${escapeHtml(supplier.gstin || 'N/A')}<br>State: ${escapeHtml(supplier.state || 'N/A')}<br>Phone: ${escapeHtml(supplier.phone || 'N/A')}</div>
                    <div class="info-box"><strong>PO Details:</strong>PO Number: ${escapeHtml(po.poNumber)}<br>Date: ${formatDate(po.date)}<br>Status: ${po.status}</div></div>
                    <table><thead><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate (₹)</th><th>GST%</th><th>Taxable (₹)</th><th>CGST (₹)</th><th>SGST (₹)</th><th>IGST (₹)</th><th>Total (₹)</th></tr></thead>
                    <tbody>${po.items.map((item, idx) => `<tr><td class="text-center">${idx+1}</td><td>${escapeHtml(item.description)}</td><td class="text-center">${escapeHtml(item.hsn)}</td><td class="text-right">${item.qty}</td><td class="text-right">${formatCurrency(item.rate)}</td><td class="text-center">${item.selectedGstRate}%</td><td class="text-right">${formatCurrency(item.taxable)}</td><td class="text-right">${formatCurrency(item.cgstAmt)}</td><td class="text-right">${formatCurrency(item.sgstAmt)}</td><td class="text-right">${formatCurrency(item.igstAmt)}</td><td class="text-right">${formatCurrency(item.total)}</td></tr>`).join('')}</tbody>
                    </table>
                    <div class="totals"><p>Subtotal (Taxable): ${formatCurrency(po.subtotal)}</p><p>Discount: ${formatCurrency(po.discount || 0)}</p><p>Total Tax: ${formatCurrency(po.totalTax)}</p><p class="grand-total">Grand Total: ${formatCurrency(po.grandTotal)}</p></div>
                    <div class="footer"><p>This is a system generated purchase order. Thank you for your business.</p></div>
                </div>
                <script>window.print();<\/script>
                </body></html>
            `;
            const printWindow = window.open('', '_blank');
            printWindow.document.write(printHtml);
            printWindow.document.close();
        } catch(err) { showToast('Error generating PDF', 'error'); }
    }

    async function showPOModal(poData = null) {
        try {
            const suppliers = await dbGetAll('suppliers');
            const products = await dbGetAll('products');
            const profile = getProfile();
            const isEdit = !!poData;
            const defStatus = isEdit ? poData.status : 'Pending';
            const defDiscount = isEdit && poData.discount !== undefined ? poData.discount : 0;
            const modalHtml = `<div class="modal-overlay" id="poModalOverlay"><div class="modal"><button class="modal-close" id="closePOModal">${iconSvg('close')}</button><h3>${isEdit ? 'Edit' : 'New'} Purchase Order</h3>
                <form id="poForm"><div class="form-grid"><div class="form-group"><label>PO Number</label><input type="text" id="poNumber" value="${isEdit ? poData.poNumber : await getNextPONumber()}" ${isEdit ? '' : 'readonly'}></div>
                <div class="form-group"><label>Date</label><input type="date" id="poDate" value="${isEdit ? poData.date : new Date().toISOString().split('T')[0]}"></div>
                <div class="form-group"><label>Supplier</label><select id="poSupplier">${suppliers.map(s => `<option value="${s.id}" ${isEdit && poData.supplierId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}</select></div>
                <div class="form-group"><label>Status</label><select id="poStatus">${PO_STATUSES.map(s => `<option value="${s}" ${s === defStatus ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
                <h4>Items</h4><div id="poItemsContainer">${(isEdit ? poData.items : []).map((it, idx) => poItemRow(it, idx, products)).join('')}</div>
                <button type="button" class="btn btn-outline btn-sm" id="addPOItem">${iconSvg('plus')} Add Item</button>
                <div class="card" style="margin-top:16px; background:#f8fafc;"><div class="form-grid span-3"><div class="form-group"><label>Subtotal (Taxable)</label><div style="font-weight:700;" id="poSubtotalDisplay">₹ 0.00</div></div>
                <div class="form-group"><label>Discount (₹)</label><input type="number" id="poDiscount" value="${defDiscount}" step="0.01"></div>
                <div class="form-group"><label>Total Tax</label><div style="font-weight:700;" id="poTaxDisplay">₹ 0.00</div></div>
                <div class="form-group"><label>Grand Total</label><div style="font-weight:800; font-size:1.2rem; color:var(--primary);" id="poGrandTotal">₹ 0.00</div></div></div></div>
                <div style="margin-top:16px; text-align:right;"><button type="button" class="btn btn-outline" id="cancelPOBtn">Cancel</button> <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Save'}</button></div>
                </form></div></div>`;
            document.getElementById('modalContainer').innerHTML = modalHtml;
            const close = () => { document.getElementById('modalContainer').innerHTML = ''; };
            document.getElementById('closePOModal').addEventListener('click', close);
            document.getElementById('cancelPOBtn').addEventListener('click', close);
            document.getElementById('poModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) close(); });
            const itemsContainer = document.getElementById('poItemsContainer');
            itemsContainer.addEventListener('change', function(e) {
                if (e.target.classList.contains('item-product')) {
                    const row = e.target.closest('.po-item-row');
                    const productId = e.target.value;
                    const product = products.find(p => p.id == productId);
                    if (product) {
                        const rateInput = row.querySelector('.item-rate');
                        const gstSelect = row.querySelector('.item-gst');
                        rateInput.value = product.purchasePrice || 0;
                        const gstValue = product.gstRate || 18;
                        if ([...gstSelect.options].some(opt => opt.value == gstValue)) gstSelect.value = gstValue;
                        else gstSelect.value = 18;
                    }
                    updatePOBreakdown();
                }
            });
            document.getElementById('addPOItem').addEventListener('click', () => {
                if (products.length === 0) { showToast('Please add products first', 'warning'); return; }
                itemsContainer.insertAdjacentHTML('beforeend', poItemRow(null, 0, products));
                updatePOBreakdown();
            });
            document.getElementById('poForm').addEventListener('input', updatePOBreakdown);
            document.getElementById('poForm').addEventListener('change', updatePOBreakdown);
            const supplierSelect = document.getElementById('poSupplier');
            function updatePOBreakdown() {
                const items = [];
                document.querySelectorAll('.po-item-row').forEach(row => {
                    const productId = row.querySelector('.item-product').value;
                    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
                    const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
                    const gst = parseFloat(row.querySelector('.item-gst').value) || 0;
                    items.push({ productId, qty, rate, selectedGstRate: gst });
                });
                const supplierId = Number(supplierSelect.value);
                const supplier = suppliers.find(s => s.id === supplierId);
                const stateOfSupply = supplier ? supplier.state : profile.state;
                const discount = parseFloat(document.getElementById('poDiscount').value) || 0;
                const { subtotal, totalTax, grandTotal } = applyDiscountAndRecalcTaxes(items, discount, stateOfSupply, profile.state, products);
                document.getElementById('poSubtotalDisplay').textContent = formatCurrency(subtotal);
                document.getElementById('poTaxDisplay').textContent = formatCurrency(totalTax);
                document.getElementById('poGrandTotal').textContent = formatCurrency(grandTotal);
            }
            document.getElementById('poForm').addEventListener('submit', async e => {
                e.preventDefault();
                try {
                    const supplierId = Number(supplierSelect.value);
                    if (!supplierId || isNaN(supplierId) || supplierId <= 0) {
                        showToast('Please select a valid supplier.', 'error');
                        return;
                    }
                    const itemRows = document.querySelectorAll('.po-item-row');
                    if (itemRows.length === 0) {
                        showToast('Please add at least one item.', 'error');
                        return;
                    }
                    let valid = true;
                    itemRows.forEach(row => {
                        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
                        const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
                        if (qty <= 0 || rate <= 0) valid = false;
                    });
                    if (!valid) {
                        showToast('Each item must have quantity and rate greater than zero.', 'error');
                        return;
                    }

                    const itemsRaw = [];
                    itemRows.forEach(row => {
                        itemsRaw.push({
                            productId: row.querySelector('.item-product').value,
                            qty: parseFloat(row.querySelector('.item-qty').value) || 0,
                            rate: parseFloat(row.querySelector('.item-rate').value) || 0,
                            selectedGstRate: parseFloat(row.querySelector('.item-gst').value) || 0
                        });
                    });
                    const supplier = suppliers.find(s => s.id === supplierId);
                    const stateOfSupply = supplier ? supplier.state : profile.state;
                    const discount = parseFloat(document.getElementById('poDiscount').value) || 0;
                    const { items, subtotal, totalTax, grandTotal } = applyDiscountAndRecalcTaxes(itemsRaw, discount, stateOfSupply, profile.state, products);
                    const poObj = { poNumber: document.getElementById('poNumber').value, date: document.getElementById('poDate').value, supplierId, items, subtotal, discount, totalTax, grandTotal, status: document.getElementById('poStatus').value };
                    if (isEdit) { poObj.id = poData.id; await dbPut('purchaseOrders', poObj); } else { await dbAdd('purchaseOrders', poObj); await incrementPONumber(); }
                    showToast('Purchase order saved', 'success');
                    close();
                    await renderPurchaseOrders();
                } catch (err) { showToast('Error saving purchase order', 'error'); console.error(err); }
            });
            itemsContainer.querySelectorAll('.po-item-row').forEach(row => {
                const productSelect = row.querySelector('.item-product');
                const productId = productSelect.value;
                const product = products.find(p => p.id == productId);
                if (product) {
                    const rateInput = row.querySelector('.item-rate');
                    const gstSelect = row.querySelector('.item-gst');
                    if (!rateInput.value || rateInput.value == 0) rateInput.value = product.purchasePrice || 0;
                    if (!gstSelect.value || gstSelect.value == 18) {
                        const gstValue = product.gstRate || 18;
                        if ([...gstSelect.options].some(opt => opt.value == gstValue)) gstSelect.value = gstValue;
                        else gstSelect.value = 18;
                    }
                }
            });
            updatePOBreakdown();
        } catch(err) { showToast('Error opening PO form', 'error'); }
    }

    // ---------- Expenses ----------
    async function renderExpenses() {
        try {
            const allExpenses = await dbGetAll('expenses');
            let fromDate = '', toDate = '';
            let filteredExpenses = [...allExpenses];
            const renderTable = () => {
                let html = `<div class="page-header"><h1 class="page-title">Expenses</h1><button class="btn btn-primary" id="addExpenseBtn">${iconSvg('plus')} Log Expense</button></div>
                <div class="card"><div class="filter-bar" style="display:flex;gap:12px;margin-bottom:20px;align-items:flex-end;">
                    <div class="form-group" style="margin-bottom:0;"><label>From Date</label><input type="date" id="expFromDate" value="${fromDate}"></div>
                    <div class="form-group" style="margin-bottom:0;"><label>To Date</label><input type="date" id="expToDate" value="${toDate}"></div>
                    <button class="btn btn-primary" id="applyExpFilter">Apply Filter</button><button class="btn btn-secondary" id="clearExpFilter">Clear</button>
                </div><div class="table-wrap"><table style="width:100%;"><thead><tr style="${TABLE_HEADER_STYLE}"><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Actions</th></tr></thead><tbody>`;
                filteredExpenses.sort((a,b)=>b.id - a.id).forEach(e => { html += `<tr><td>${formatDate(e.date)}</td><td>${escapeHtml(e.category)}</td><td>${escapeHtml(e.description)}</td><td>${formatCurrency(e.amount)}</td><td><button class="btn btn-danger btn-sm delete-expense" data-id="${e.id}">${iconSvg('trash')}</button></td></tr>`; });
                if (!filteredExpenses.length) html += `<tr><td colspan="5" class="empty-state">No expenses in date range.</td></tr>`;
                html += `</tbody></table></div></div>`;
                mainContent.innerHTML = html;
                document.getElementById('addExpenseBtn')?.addEventListener('click', () => showExpenseModal());
                document.querySelectorAll('.delete-expense').forEach(b => b.addEventListener('click', async () => { await dbDelete('expenses', Number(b.dataset.id)); await renderExpenses(); }));
                document.getElementById('applyExpFilter')?.addEventListener('click', () => { fromDate = document.getElementById('expFromDate').value; toDate = document.getElementById('expToDate').value; filteredExpenses = filterByDateRange(allExpenses, fromDate, toDate); renderTable(); });
                document.getElementById('clearExpFilter')?.addEventListener('click', () => { fromDate = ''; toDate = ''; filteredExpenses = [...allExpenses]; renderTable(); });
            };
            filteredExpenses = [...allExpenses];
            renderTable();
        } catch(err) { showToast('Failed to load expenses', 'error'); }
    }

    async function showExpenseModal(expData = null) {
        if (expData && typeof expData === 'object' && expData.target) {
            expData = null;
        }
        try {
            const isEdit = !!expData;
            const modalHtml = `<div class="modal-overlay" id="expModalOverlay"><div class="modal"><button class="modal-close" id="closeExpModal">${iconSvg('close')}</button><h3>${isEdit ? 'Edit' : 'Log'} Expense</h3>
                <form id="expForm"><div class="form-grid"><div class="form-group"><label>Date</label><input type="date" id="expDate" value="${isEdit ? expData.date : new Date().toISOString().split('T')[0]}"></div>
                <div class="form-group"><label>Category</label><input id="expCategory" value="${isEdit ? escapeHtml(expData.category) : ''}" placeholder="e.g. Parts, Labour, Rent"></div>
                <div class="form-group"><label>Description</label><input id="expDesc" value="${isEdit ? escapeHtml(expData.description) : ''}"></div>
                <div class="form-group"><label>Amount (₹)</label><input type="number" step="0.01" id="expAmount" value="${isEdit ? expData.amount : ''}"></div>
                </div><button type="submit" class="btn btn-primary">Save</button></form></div></div>`;
            document.getElementById('modalContainer').innerHTML = modalHtml;
            const close = () => { document.getElementById('modalContainer').innerHTML = ''; };
            document.getElementById('closeExpModal').addEventListener('click', close);
            document.getElementById('expModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) close(); });
            document.getElementById('expForm').addEventListener('submit', async e => {
                e.preventDefault();
                try {
                    const obj = { date: document.getElementById('expDate').value, category: document.getElementById('expCategory').value, description: document.getElementById('expDesc').value, amount: parseFloat(document.getElementById('expAmount').value)||0 };
                    if (isEdit) { obj.id = expData.id; await dbPut('expenses', obj); } else await dbAdd('expenses', obj);
                    close(); await renderExpenses(); showToast('Expense saved', 'success');
                } catch(err) { showToast('Error saving expense', 'error'); }
            });
        } catch(err) { showToast('Error opening expense form', 'error'); }
    }

    // ---------- Customers ----------
    async function renderCustomers() {
        try {
            const allCustomers = await dbGetAll('customers');
            let searchTerm = '';
            let filteredCustomers = [...allCustomers];
            const renderTable = () => {
                let html = `<div class="page-header"><h1 class="page-title">Customers</h1><button class="btn btn-primary" id="addCustomerBtn">${iconSvg('plus')} Add Customer</button></div>
                <div class="card"><div class="filter-bar" style="display:flex;gap:12px;margin-bottom:20px;align-items:flex-end;"><div class="form-group" style="margin-bottom:0;flex:1;"><label>Search by Name</label><input type="text" id="custSearch" value="${escapeHtml(searchTerm)}" placeholder="Type customer name..."></div>
                <button class="btn btn-primary" id="applyCustSearch">Search</button><button class="btn btn-secondary" id="clearCustSearch">Clear</button></div>
                <div class="table-wrap"><table style="width:100%;"><thead><tr style="${TABLE_HEADER_STYLE}"><th>Name</th><th>GSTIN</th><th>State</th><th>Phone</th><th>Actions</th></tr></thead><tbody>`;
                filteredCustomers.forEach(c => { html += `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.gstin)}</td><td>${escapeHtml(c.state)}</td><td>${escapeHtml(c.phone)}</td><td><button class="btn btn-outline btn-sm edit-customer" data-id="${c.id}">Edit</button> <button class="btn btn-danger btn-sm delete-customer" data-id="${c.id}">${iconSvg('trash')}</button></td></tr>`; });
                if (!filteredCustomers.length) html += `<tr><td colspan="5" class="empty-state">No customers found.</td></tr>`;
                html += `</tbody></table></div></div>`;
                mainContent.innerHTML = html;
                document.getElementById('addCustomerBtn')?.addEventListener('click', () => showCustomerModal());
                document.querySelectorAll('.edit-customer').forEach(b => b.addEventListener('click', async () => { const c = await dbGetById('customers', Number(b.dataset.id)); showCustomerModal(c); }));
                document.querySelectorAll('.delete-customer').forEach(b => b.addEventListener('click', async () => { await dbDelete('customers', Number(b.dataset.id)); await renderCustomers(); }));
            };
            const apply = () => { searchTerm = document.getElementById('custSearch').value.trim().toLowerCase(); filteredCustomers = allCustomers.filter(c => c.name.toLowerCase().includes(searchTerm)); renderTable(); };
            const clear = () => { searchTerm = ''; filteredCustomers = [...allCustomers]; renderTable(); };
            filteredCustomers = [...allCustomers];
            renderTable();
            setTimeout(() => { document.getElementById('applyCustSearch')?.addEventListener('click', apply); document.getElementById('clearCustSearch')?.addEventListener('click', clear); }, 0);
        } catch(err) { showToast('Failed to load customers', 'error'); }
    }

    async function showCustomerModal(custData = null) {
        try {
            const isEdit = !!custData;
            const modalHtml = `<div class="modal-overlay" id="custModalOverlay"><div class="modal"><button class="modal-close" id="closeCustModal">${iconSvg('close')}</button><h3>${isEdit ? 'Edit' : 'Add'} Customer</h3>
                <form id="custForm"><div class="form-grid"><div class="form-group"><label>Name *</label><input id="custName" value="${isEdit ? escapeHtml(custData.name) : ''}" required></div>
                <div class="form-group"><label>GSTIN</label><input id="custGstin" value="${isEdit ? escapeHtml(custData.gstin) : ''}"></div>
                <div class="form-group"><label>State</label><input id="custState" value="${isEdit ? escapeHtml(custData.state) : ''}"></div>
                <div class="form-group"><label>Phone</label><input id="custPhone" value="${isEdit ? escapeHtml(custData.phone) : ''}"></div>
                <div class="form-group full"><label>Address</label><textarea id="custAddress" rows="2">${isEdit ? escapeHtml(custData.address || '') : ''}</textarea></div>
                </div><button type="submit" class="btn btn-primary">Save</button></form></div></div>`;
            document.getElementById('modalContainer').innerHTML = modalHtml;
            const close = () => { document.getElementById('modalContainer').innerHTML = ''; };
            document.getElementById('closeCustModal').addEventListener('click', close);
            document.getElementById('custModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) close(); });
            document.getElementById('custForm').addEventListener('submit', async e => {
                e.preventDefault();
                try {
                    const obj = { 
                        name: document.getElementById('custName').value, 
                        gstin: document.getElementById('custGstin').value, 
                        state: document.getElementById('custState').value, 
                        phone: document.getElementById('custPhone').value,
                        address: document.getElementById('custAddress').value
                    };
                    if (isEdit) { obj.id = custData.id; await dbPut('customers', obj); } else await dbAdd('customers', obj);
                    close(); await renderCustomers(); showToast('Customer saved', 'success');
                } catch(err) { showToast('Error saving customer', 'error'); }
            });
        } catch(err) { showToast('Error opening customer form', 'error'); }
    }

    // ---------- Suppliers ----------
    async function renderSuppliers() {
        try {
            const allSuppliers = await dbGetAll('suppliers');
            let searchTerm = '';
            let filteredSuppliers = [...allSuppliers];
            const renderTable = () => {
                let html = `<div class="page-header"><h1 class="page-title">Suppliers</h1><button class="btn btn-primary" id="addSupplierBtn">${iconSvg('plus')} Add Supplier</button></div>
                <div class="card"><div class="filter-bar" style="display:flex;gap:12px;margin-bottom:20px;align-items:flex-end;"><div class="form-group" style="margin-bottom:0;flex:1;"><label>Search by Name</label><input type="text" id="supSearch" value="${escapeHtml(searchTerm)}" placeholder="Type supplier name..."></div>
                <button class="btn btn-primary" id="applySupSearch">Search</button><button class="btn btn-secondary" id="clearSupSearch">Clear</button></div>
                <div class="table-wrap"><table style="width:100%;"><thead><tr style="${TABLE_HEADER_STYLE}"><th>Name</th><th>GSTIN</th><th>State</th><th>Phone</th><th>Actions</th></tr></thead><tbody>`;
                filteredSuppliers.forEach(s => { html += `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.gstin)}</td><td>${escapeHtml(s.state)}</td><td>${escapeHtml(s.phone)}</td><td><button class="btn btn-outline btn-sm edit-supplier" data-id="${s.id}">Edit</button> <button class="btn btn-danger btn-sm delete-supplier" data-id="${s.id}">${iconSvg('trash')}</button></td></tr>`; });
                if (!filteredSuppliers.length) html += `<tr><td colspan="5" class="empty-state">No suppliers found.</td></tr>`;
                html += `</tbody></table></div></div>`;
                mainContent.innerHTML = html;
                document.getElementById('addSupplierBtn')?.addEventListener('click', () => showSupplierModal());
                document.querySelectorAll('.edit-supplier').forEach(b => b.addEventListener('click', async () => { const s = await dbGetById('suppliers', Number(b.dataset.id)); showSupplierModal(s); }));
                document.querySelectorAll('.delete-supplier').forEach(b => b.addEventListener('click', async () => { await dbDelete('suppliers', Number(b.dataset.id)); await renderSuppliers(); }));
            };
            const apply = () => { searchTerm = document.getElementById('supSearch').value.trim().toLowerCase(); filteredSuppliers = allSuppliers.filter(s => s.name.toLowerCase().includes(searchTerm)); renderTable(); };
            const clear = () => { searchTerm = ''; filteredSuppliers = [...allSuppliers]; renderTable(); };
            filteredSuppliers = [...allSuppliers];
            renderTable();
            setTimeout(() => { document.getElementById('applySupSearch')?.addEventListener('click', apply); document.getElementById('clearSupSearch')?.addEventListener('click', clear); }, 0);
        } catch(err) { showToast('Failed to load suppliers', 'error'); }
    }

    async function showSupplierModal(supData = null) {
        try {
            const isEdit = !!supData;
            const modalHtml = `<div class="modal-overlay" id="supModalOverlay"><div class="modal"><button class="modal-close" id="closeSupModal">${iconSvg('close')}</button><h3>${isEdit ? 'Edit' : 'Add'} Supplier</h3>
                <form id="supForm"><div class="form-grid"><div class="form-group"><label>Name *</label><input id="supName" value="${isEdit ? escapeHtml(supData.name) : ''}" required></div>
                <div class="form-group"><label>GSTIN</label><input id="supGstin" value="${isEdit ? escapeHtml(supData.gstin) : ''}"></div>
                <div class="form-group"><label>State</label><input id="supState" value="${isEdit ? escapeHtml(supData.state) : ''}"></div>
                <div class="form-group"><label>Phone</label><input id="supPhone" value="${isEdit ? escapeHtml(supData.phone) : ''}"></div>
                <div class="form-group full"><label>Address</label><textarea id="supAddress" rows="2">${isEdit ? escapeHtml(supData.address || '') : ''}</textarea></div>
                </div><button type="submit" class="btn btn-primary">Save</button></form></div></div>`;
            document.getElementById('modalContainer').innerHTML = modalHtml;
            const close = () => { document.getElementById('modalContainer').innerHTML = ''; };
            document.getElementById('closeSupModal').addEventListener('click', close);
            document.getElementById('supModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) close(); });
            document.getElementById('supForm').addEventListener('submit', async e => {
                e.preventDefault();
                try {
                    const obj = { 
                        name: document.getElementById('supName').value, 
                        gstin: document.getElementById('supGstin').value, 
                        state: document.getElementById('supState').value, 
                        phone: document.getElementById('supPhone').value,
                        address: document.getElementById('supAddress').value
                    };
                    if (isEdit) { obj.id = supData.id; await dbPut('suppliers', obj); } else await dbAdd('suppliers', obj);
                    close(); await renderSuppliers(); showToast('Supplier saved', 'success');
                } catch(err) { showToast('Error saving supplier', 'error'); }
            });
        } catch(err) { showToast('Error opening supplier form', 'error'); }
    }

    // ---------- Products (Enhanced) + View Transactions ----------
    async function renderProducts() {
        try {
            const allProducts = await dbGetAll('products');
            const suppliers = await dbGetAll('suppliers');
            const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));
            let searchTerm = '';
            let filteredProducts = [...allProducts];
            const renderTable = () => {
                let html = `<div class="page-header"><h1 class="page-title">Inventory</h1><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-secondary" id="downloadTemplateBtn">${iconSvg('export')} Template</button><button class="btn btn-secondary" id="exportExcelBtn">${iconSvg('export')} Export Excel</button><button class="btn btn-secondary" id="importExcelBtn">${iconSvg('import')} Import Excel</button><button class="btn btn-primary" id="addProductBtn">${iconSvg('plus')} Add Item</button></div></div>
                <input type="file" id="excelFileInput" accept=".xlsx,.xls,.csv" style="display:none;">
                <div class="card"><div class="filter-bar" style="display:flex;gap:12px;margin-bottom:20px;align-items:flex-end;"><div class="form-group" style="margin-bottom:0;flex:1;"><label>Search by Name, SKU, Brand, Model</label><input type="text" id="prodSearch" value="${escapeHtml(searchTerm)}" placeholder="Type search term..."></div>
                <button class="btn btn-primary" id="applyProdSearch">Search</button><button class="btn btn-secondary" id="clearProdSearch">Clear</button></div>
                <div class="table-wrap"><table style="width:100%;"><thead><tr style="${TABLE_HEADER_STYLE}">
                    <th>Type</th><th>SKU</th><th>Name</th><th>Brand</th><th>Model</th><th>Category</th><th>Capacity (KVA)</th><th>Sell Price</th><th>Stock</th><th>Status</th><th>Actions</th>
                </tr></thead><tbody>`;
                filteredProducts.forEach(p => {
                    let status = p.status || 'In Stock';
                    if (status !== 'Discontinued') {
                        if (p.stockQuantity <= 0) status = 'Out of Stock';
                        else if (p.stockQuantity <= (p.reorderLevel || 0)) status = 'Low Stock';
                        else status = 'In Stock';
                    }
                    const statusClass = status === 'In Stock' ? 'status-in-stock' :
                                       status === 'Low Stock' ? 'status-low-stock' :
                                       status === 'Out of Stock' ? 'status-out-of-stock' : 'status-discontinued';
                    html += `<tr>
                        <td><span class="badge" style="background:#eef2ff;color:#4f46e5;font-size:0.7rem;">${escapeHtml(p.type || 'Product')}</span></td>
                        <td>${escapeHtml(p.sku || '')}</td>
                        <td>${escapeHtml(p.name)}</td>
                        <td>${escapeHtml(p.brand || '')}</td>
                        <td>${escapeHtml(p.modelNumber || '')}</td>
                        <td>${escapeHtml(p.category || '')}</td>
                        <td>${p.capacityKva || ''}</td>
                        <td>${formatCurrency(p.sellingPrice || 0)}</td>
                        <td>${p.stockQuantity || 0}</td>
                        <td><span class="status-badge ${statusClass}">${status}</span></td>
                        <td>
                            <button class="btn btn-outline btn-sm edit-product" data-id="${p.id}">Edit</button>
                            <button class="btn btn-info btn-sm view-transactions" data-id="${p.id}" style="background:#0ea5e9; color:white; border-color:#0ea5e9;">Transactions</button>
                            <button class="btn btn-danger btn-sm delete-product" data-id="${p.id}">${iconSvg('trash')}</button>
                        </td>
                    </tr>`;
                });
                if (!filteredProducts.length) html += `<tr><td colspan="11" class="empty-state">No items found.</td></tr>`;
                html += `</tbody></table></div></div>`;
                mainContent.innerHTML = html;
                document.getElementById('addProductBtn')?.addEventListener('click', () => showProductModal());
                document.querySelectorAll('.edit-product').forEach(b => b.addEventListener('click', async () => { const p = await dbGetById('products', Number(b.dataset.id)); showProductModal(p); }));
                document.querySelectorAll('.delete-product').forEach(b => b.addEventListener('click', async () => { await dbDelete('products', Number(b.dataset.id)); await renderProducts(); }));
                document.querySelectorAll('.view-transactions').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const productId = Number(btn.dataset.id);
                        showProductTransactions(productId);
                    });
                });
            };
            const apply = () => {
                searchTerm = document.getElementById('prodSearch').value.trim().toLowerCase();
                filteredProducts = allProducts.filter(p => 
                    (p.name && p.name.toLowerCase().includes(searchTerm)) ||
                    (p.sku && p.sku.toLowerCase().includes(searchTerm)) ||
                    (p.brand && p.brand.toLowerCase().includes(searchTerm)) ||
                    (p.modelNumber && p.modelNumber.toLowerCase().includes(searchTerm)) ||
                    (p.category && p.category.toLowerCase().includes(searchTerm))
                );
                renderTable();
            };
            const clear = () => { searchTerm = ''; filteredProducts = [...allProducts]; renderTable(); };
            filteredProducts = [...allProducts];
            renderTable();
            setTimeout(() => {
                document.getElementById('applyProdSearch')?.addEventListener('click', apply);
                document.getElementById('clearProdSearch')?.addEventListener('click', clear);
                document.getElementById('downloadTemplateBtn')?.addEventListener('click', downloadInventoryTemplate);
                document.getElementById('exportExcelBtn')?.addEventListener('click', exportInventoryToExcel);
                document.getElementById('importExcelBtn')?.addEventListener('click', () => document.getElementById('excelFileInput')?.click());
                document.getElementById('excelFileInput')?.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files[0]) {
                        importInventoryFromExcel(e.target.files[0]);
                        e.target.value = '';
                    }
                });
            }, 0);
        } catch(err) { showToast('Failed to load inventory', 'error'); }
    }

    // ---- Inventory Excel Export / Import / Template ----
    function downloadInventoryTemplate() {
        const headers = [
            'Type', 'SKU', 'Item Name *', 'Brand', 'Model Number', 'Category',
            'Fuel Type', 'Capacity (KVA)', 'Output Voltage', 'Phase', 'Frequency (Hz)',
            'Engine Model', 'Alternator Model', 'Serial Number', 'Manufacturing Year',
            'Warranty Period (months)', 'Purchase Price (₹)', 'Selling Price (₹)',
            'GST %', 'Supplier Name', 'Stock Quantity', 'Reorder Level', 'Status'
        ];
        const sampleRow = [
            'Generator', 'GEN-001', 'Sample Generator 5KVA', 'Cummins', 'C5.5D5', 'Generator',
            'Diesel', '5', '230V', 'Single', '50',
            '4BTA3.9-G11', 'PI044E', 'SN12345', '2024',
            '12', '150000', '200000',
            '18', '', '10', '2', 'In Stock'
        ];
        const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
        ws['!cols'] = headers.map((h, i) => ({ wch: Math.max(h.length, i === 2 ? 25 : 12) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inventory Template');
        const instructions = [
            ['INVENTORY IMPORT INSTRUCTIONS'],
            [''],
            ['Column', 'Required', 'Description'],
            ['Type', 'No', 'Product type: Generator, Accessory, Spare Part, Service'],
            ['SKU', 'No', 'Unique item code (e.g. GEN-001)'],
            ['Item Name *', 'YES', 'Item name - REQUIRED'],
            ['Brand', 'No', 'Brand/manufacturer name'],
            ['Model Number', 'No', 'Model number'],
            ['Category', 'No', 'Product category'],
            ['Fuel Type', 'No', 'Diesel, Petrol, Gas, or Electric'],
            ['Capacity (KVA)', 'No', 'Generator capacity in KVA'],
            ['Output Voltage', 'No', 'e.g. 230V, 415V'],
            ['Phase', 'No', 'Single or Three'],
            ['Frequency (Hz)', 'No', 'e.g. 50'],
            ['Engine Model', 'No', 'Engine model number'],
            ['Alternator Model', 'No', 'Alternator model number'],
            ['Serial Number', 'No', 'Unique serial number'],
            ['Manufacturing Year', 'No', 'Year (e.g. 2024)'],
            ['Warranty Period (months)', 'No', 'Warranty in months'],
            ['Purchase Price (₹)', 'No', 'Cost/purchase price'],
            ['Selling Price (₹)', 'No', 'Selling price'],
            ['GST %', 'No', 'GST rate (default 18%)'],
            ['Supplier Name', 'No', 'Must match existing supplier name exactly'],
            ['Stock Quantity', 'No', 'Current stock count'],
            ['Reorder Level', 'No', 'Low-stock threshold'],
            ['Status', 'No', 'In Stock, Low Stock, Out of Stock, Discontinued'],
            [''],
            ['NOTES:'],
            ['- Rows with missing Item Name will be skipped'],
            ['- If SKU matches an existing item, it will be UPDATED'],
            ['- New SKUs will be added as new items'],
            ['- Supplier Name must match an existing supplier exactly (case-insensitive)'],
            ['- Delete the sample row before importing your data']
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(instructions);
        ws2['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 60 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');
        XLSX.writeFile(wb, 'genfin_inventory_template.xlsx');
        showToast('Template downloaded', 'success');
    }

    async function exportInventoryToExcel() {
        try {
            showToast('Preparing export...', 'info');
            const products = await dbGetAll('products');
            const suppliers = await dbGetAll('suppliers');
            const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));
            if (!products.length) {
                showToast('No inventory items to export', 'info');
                return;
            }
            const headers = [
                'Type', 'SKU', 'Item Name', 'Brand', 'Model Number', 'Category',
                'Fuel Type', 'Capacity (KVA)', 'Output Voltage', 'Phase', 'Frequency (Hz)',
                'Engine Model', 'Alternator Model', 'Serial Number', 'Manufacturing Year',
                'Warranty Period (months)', 'Purchase Price (₹)', 'Selling Price (₹)',
                'GST %', 'Supplier Name', 'Stock Quantity', 'Reorder Level', 'Status'
            ];
            const rows = products.map(p => [
                p.type || '', p.sku || '', p.name || '', p.brand || '', p.modelNumber || '', p.category || '',
                p.fuelType || '', p.capacityKva || '', p.outputVoltage || '', p.phase || '', p.frequency || '',
                p.engineModel || '', p.alternatorModel || '', p.serialNumber || '', p.manufacturingYear || '',
                p.warrantyPeriod || '', p.purchasePrice || 0, p.sellingPrice || 0,
                p.gstRate || 18, supplierMap[p.supplierId] || '', p.stockQuantity || 0, p.reorderLevel || 0, p.status || ''
            ]);
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            ws['!cols'] = headers.map((h, i) => ({ wch: Math.max(h.length, 12) }));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
            const dateStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `genfin_inventory_${dateStr}.xlsx`);
            showToast(`Exported ${products.length} items`, 'success');
        } catch (err) {
            console.error('Export error:', err);
            showToast('Error exporting: ' + err.message, 'error');
        }
    }

    async function importInventoryFromExcel(file) {
        try {
            showToast('Reading file...', 'info');
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
            if (!jsonData.length) {
                showToast('Excel file is empty', 'error');
                return;
            }
            const colMap = {
                'type': ['type', 'Type'],
                'sku': ['sku', 'SKU', 'SKU (Item ID)'],
                'name': ['Item Name *', 'Item Name', 'name', 'Name'],
                'brand': ['brand', 'Brand'],
                'modelNumber': ['Model Number', 'modelNumber', 'Model'],
                'category': ['category', 'Category'],
                'fuelType': ['Fuel Type', 'fuelType'],
                'capacityKva': ['Capacity (KVA)', 'capacityKva', 'Capacity'],
                'outputVoltage': ['Output Voltage', 'outputVoltage', 'Voltage'],
                'phase': ['phase', 'Phase'],
                'frequency': ['Frequency (Hz)', 'frequency', 'Frequency'],
                'engineModel': ['Engine Model', 'engineModel'],
                'alternatorModel': ['Alternator Model', 'alternatorModel'],
                'serialNumber': ['Serial Number', 'serialNumber', 'Serial No'],
                'manufacturingYear': ['Manufacturing Year', 'manufacturingYear', 'Mfg Year'],
                'warrantyPeriod': ['Warranty Period (months)', 'warrantyPeriod', 'Warranty'],
                'purchasePrice': ['Purchase Price (₹)', 'Purchase Price', 'purchasePrice', 'Cost Price'],
                'sellingPrice': ['Selling Price (₹)', 'Selling Price', 'sellingPrice'],
                'gstRate': ['GST %', 'gstRate', 'GST'],
                'supplierName': ['Supplier Name', 'supplierName', 'Supplier'],
                'stockQuantity': ['Stock Quantity', 'stockQuantity', 'Stock'],
                'reorderLevel': ['Reorder Level', 'reorderLevel'],
                'status': ['status', 'Status']
            };
            function getColValue(row, field) {
                const aliases = colMap[field] || [field];
                for (const alias of aliases) {
                    if (row[alias] !== undefined && row[alias] !== '') return row[alias];
                }
                return '';
            }
            const existingProducts = await dbGetAll('products');
            const suppliers = await dbGetAll('suppliers');
            const skuMap = {};
            existingProducts.forEach(p => { if (p.sku) skuMap[p.sku.toLowerCase()] = p; });
            const supplierNameMap = {};
            suppliers.forEach(s => { supplierNameMap[s.name.toLowerCase()] = s.id; });
            let added = 0, updated = 0, skipped = 0;
            _suppressAutoBackup = true;
            try {
                for (const row of jsonData) {
                    const name = String(getColValue(row, 'name')).trim();
                    if (!name) { skipped++; continue; }
                    const sku = String(getColValue(row, 'sku')).trim();
                    const supplierName = String(getColValue(row, 'supplierName')).trim();
                    const productObj = {
                        type: String(getColValue(row, 'type')).trim() || 'Product',
                        sku: sku,
                        name: name,
                        brand: String(getColValue(row, 'brand')).trim(),
                        modelNumber: String(getColValue(row, 'modelNumber')).trim(),
                        category: String(getColValue(row, 'category')).trim(),
                        fuelType: String(getColValue(row, 'fuelType')).trim(),
                        capacityKva: parseFloat(getColValue(row, 'capacityKva')) || 0,
                        outputVoltage: String(getColValue(row, 'outputVoltage')).trim(),
                        phase: String(getColValue(row, 'phase')).trim(),
                        frequency: String(getColValue(row, 'frequency')).trim(),
                        engineModel: String(getColValue(row, 'engineModel')).trim(),
                        alternatorModel: String(getColValue(row, 'alternatorModel')).trim(),
                        serialNumber: String(getColValue(row, 'serialNumber')).trim(),
                        manufacturingYear: parseInt(getColValue(row, 'manufacturingYear')) || null,
                        warrantyPeriod: parseInt(getColValue(row, 'warrantyPeriod')) || null,
                        purchasePrice: parseFloat(getColValue(row, 'purchasePrice')) || 0,
                        sellingPrice: parseFloat(getColValue(row, 'sellingPrice')) || 0,
                        gstRate: parseFloat(getColValue(row, 'gstRate')) || 18,
                        supplierId: supplierName ? (supplierNameMap[supplierName.toLowerCase()] || null) : null,
                        stockQuantity: parseInt(getColValue(row, 'stockQuantity')) || 0,
                        reorderLevel: parseInt(getColValue(row, 'reorderLevel')) || 0,
                        status: String(getColValue(row, 'status')).trim() || 'In Stock'
                    };
                    if (sku && skuMap[sku.toLowerCase()]) {
                        productObj.id = skuMap[sku.toLowerCase()].id;
                        await dbPut('products', productObj);
                        updated++;
                    } else {
                        await dbAdd('products', productObj);
                        added++;
                    }
                }
            } finally {
                _suppressAutoBackup = false;
                scheduleAutoBackup();
            }
            showToast(`Import complete: ${added} added, ${updated} updated, ${skipped} skipped`, 'success');
            await renderProducts();
        } catch (err) {
            console.error('Import error:', err);
            showToast('Error importing: ' + err.message, 'error');
            _suppressAutoBackup = false;
        }
    }

    // ---- Show Product Transactions Modal ----
    async function showProductTransactions(productId) {
        try {
            const product = await dbGetById('products', productId);
            if (!product) {
                showToast('Product not found', 'error');
                return;
            }
            const invoices = await dbGetAll('invoices');
            const purchaseOrders = await dbGetAll('purchaseOrders');
            const customers = await dbGetAll('customers');
            const suppliers = await dbGetAll('suppliers');
            const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
            const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]));

            const relatedInvoices = invoices.filter(inv => 
                inv.items && inv.items.some(item => Number(item.productId) === productId)
            );
            const relatedPOs = purchaseOrders.filter(po => 
                po.items && po.items.some(item => Number(item.productId) === productId)
            );

            const modalContent = `
                <div class="modal-overlay" id="productTransactionsModal">
                    <div class="modal" style="max-width: 900px;">
                        <button class="modal-close" id="closeProductTransactionsModal">${iconSvg('close')}</button>
                        <h3>Transactions for: ${escapeHtml(product.name)}</h3>
                        <p style="color: #6b7280; margin-bottom: 16px;">SKU: ${escapeHtml(product.sku || 'N/A')} | Brand: ${escapeHtml(product.brand || 'N/A')}</p>

                        <h4 style="margin-top: 16px;">📄 Invoices</h4>
                        ${relatedInvoices.length ? `
                            <div class="table-wrap">
                                <table>
                                    <thead><tr style="${TABLE_HEADER_STYLE}">
                                        <th>Invoice #</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th><th>Actions</th>
                                    </tr></thead>
                                    <tbody>
                                        ${relatedInvoices.map(inv => `
                                            <tr>
                                                <td>${escapeHtml(inv.invoiceNumber)}</td>
                                                <td>${formatDate(inv.date)}</td>
                                                <td>${escapeHtml(customerMap[inv.customerId] || '')}</td>
                                                <td>${formatCurrency(inv.grandTotal)}</td>
                                                <td><span class="badge ${inv.paymentStatus === 'Paid' ? 'badge-paid' : (inv.paymentStatus === 'Overdue' ? 'badge-overdue' : 'badge-pending')}">${inv.paymentStatus || 'Unpaid'}</span></td>
                                                <td><button class="btn btn-outline btn-sm view-invoice" data-id="${inv.id}">View</button></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `<p style="color: #6b7280;">No invoices found for this product.</p>`}

                        <h4 style="margin-top: 24px;">📦 Purchase Orders</h4>
                        ${relatedPOs.length ? `
                            <div class="table-wrap">
                                <table>
                                    <thead><tr style="${TABLE_HEADER_STYLE}">
                                        <th>PO #</th><th>Date</th><th>Supplier</th><th>Total</th><th>Status</th><th>Actions</th>
                                    </tr></thead>
                                    <tbody>
                                        ${relatedPOs.map(po => `
                                            <tr>
                                                <td>${escapeHtml(po.poNumber)}</td>
                                                <td>${formatDate(po.date)}</td>
                                                <td>${escapeHtml(supplierMap[po.supplierId] || '')}</td>
                                                <td>${formatCurrency(po.grandTotal)}</td>
                                                <td>${po.status}</td>
                                                <td><button class="btn btn-outline btn-sm view-po" data-id="${po.id}">View</button></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `<p style="color: #6b7280;">No purchase orders found for this product.</p>`}
                        <div style="text-align:right; margin-top:16px;">
                            <button class="btn btn-outline" id="closeProductTransactionsBtn">Close</button>
                        </div>
                    </div>
                </div>
            `;
            const modalContainer = document.getElementById('modalContainer');
            modalContainer.innerHTML = modalContent;

            const closeModal = () => { modalContainer.innerHTML = ''; };
            document.getElementById('closeProductTransactionsModal').addEventListener('click', closeModal);
            document.getElementById('closeProductTransactionsBtn').addEventListener('click', closeModal);
            document.getElementById('productTransactionsModal').addEventListener('click', e => {
                if (e.target === e.currentTarget) closeModal();
            });

            document.querySelectorAll('#productTransactionsModal .view-invoice').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = Number(btn.dataset.id);
                    closeModal();
                    showInvoiceViewModal(id);
                });
            });
            document.querySelectorAll('#productTransactionsModal .view-po').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = Number(btn.dataset.id);
                    closeModal();
                    showPOViewModal(id);
                });
            });

        } catch (err) {
            showToast('Error loading transactions: ' + err.message, 'error');
            console.error(err);
        }
    }

    async function showProductModal(prodData = null) {
        try {
            const isEdit = !!prodData;
            const suppliers = await dbGetAll('suppliers');
            let defaultStatus = 'In Stock';
            if (isEdit && prodData.status) defaultStatus = prodData.status;
            else {
                const stock = prodData?.stockQuantity || 0;
                const reorder = prodData?.reorderLevel || 0;
                if (stock <= 0) defaultStatus = 'Out of Stock';
                else if (stock <= reorder) defaultStatus = 'Low Stock';
                else defaultStatus = 'In Stock';
            }

            const modalHtml = `<div class="modal-overlay" id="prodModalOverlay"><div class="modal"><button class="modal-close" id="closeProdModal">${iconSvg('close')}</button><h3>${isEdit ? 'Edit' : 'Add'} Item</h3>
                <form id="prodForm">
                    <div class="form-grid">
                        <div class="form-group"><label>Type</label><select id="prodType">${PRODUCT_TYPES.map(t => `<option value="${t}" ${isEdit && prodData.type === t ? 'selected' : (t === 'Product' && !isEdit ? 'selected' : '')}>${t}</option>`).join('')}</select></div>
                        <div class="form-group"><label>SKU (Item ID)</label><input id="prodSku" value="${isEdit ? escapeHtml(prodData.sku || '') : ''}" placeholder="e.g. GEN-001"></div>
                        <div class="form-group"><label>Item Name *</label><input id="prodName" value="${isEdit ? escapeHtml(prodData.name) : ''}" required></div>
                        <div class="form-group"><label>Brand</label><input id="prodBrand" value="${isEdit ? escapeHtml(prodData.brand || '') : ''}"></div>
                        <div class="form-group"><label>Model Number</label><input id="prodModel" value="${isEdit ? escapeHtml(prodData.modelNumber || '') : ''}"></div>
                        <div class="form-group"><label>Category</label><input id="prodCategory" value="${isEdit ? escapeHtml(prodData.category || '') : ''}"></div>
                        <div class="form-group"><label>Fuel Type</label>
                            <select id="prodFuelType">
                                <option value="">Select</option>
                                <option value="Diesel" ${isEdit && prodData.fuelType === 'Diesel' ? 'selected' : ''}>Diesel</option>
                                <option value="Petrol" ${isEdit && prodData.fuelType === 'Petrol' ? 'selected' : ''}>Petrol</option>
                                <option value="Gas" ${isEdit && prodData.fuelType === 'Gas' ? 'selected' : ''}>Gas</option>
                                <option value="Electric" ${isEdit && prodData.fuelType === 'Electric' ? 'selected' : ''}>Electric</option>
                            </select>
                        </div>
                        <div class="form-group"><label>Capacity (KVA)</label><input type="number" step="0.01" id="prodCapacity" value="${isEdit ? prodData.capacityKva || '' : ''}"></div>
                        <div class="form-group"><label>Output Voltage</label><input id="prodVoltage" value="${isEdit ? escapeHtml(prodData.outputVoltage || '') : ''}"></div>
                        <div class="form-group"><label>Phase</label>
                            <select id="prodPhase">
                                <option value="">Select</option>
                                <option value="Single" ${isEdit && prodData.phase === 'Single' ? 'selected' : ''}>Single</option>
                                <option value="Three" ${isEdit && prodData.phase === 'Three' ? 'selected' : ''}>Three</option>
                            </select>
                        </div>
                        <div class="form-group"><label>Frequency (Hz)</label><input id="prodFrequency" value="${isEdit ? escapeHtml(prodData.frequency || '') : ''}"></div>
                        <div class="form-group"><label>Engine Model</label><input id="prodEngine" value="${isEdit ? escapeHtml(prodData.engineModel || '') : ''}"></div>
                        <div class="form-group"><label>Alternator Model</label><input id="prodAlternator" value="${isEdit ? escapeHtml(prodData.alternatorModel || '') : ''}"></div>
                        <div class="form-group"><label>Serial Number</label><input id="prodSerial" value="${isEdit ? escapeHtml(prodData.serialNumber || '') : ''}"></div>
                        <div class="form-group"><label>Manufacturing Year</label><input type="number" id="prodYear" value="${isEdit ? prodData.manufacturingYear || '' : ''}"></div>
                        <div class="form-group"><label>Warranty Period (months)</label><input type="number" id="prodWarranty" value="${isEdit ? prodData.warrantyPeriod || '' : ''}"></div>
                        <div class="form-group"><label>Purchase Price (₹)</label><input type="number" step="0.01" id="prodCostPrice" value="${isEdit ? (prodData.purchasePrice || 0) : 0}"></div>
                        <div class="form-group"><label>Selling Price (₹)</label><input type="number" step="0.01" id="prodSellingPrice" value="${isEdit ? (prodData.sellingPrice || 0) : 0}"></div>
                        <div class="form-group"><label>GST %</label><input type="number" step="0.1" id="prodGst" value="${isEdit ? prodData.gstRate : 18}"></div>
                        <div class="form-group"><label>Supplier</label>
                            <select id="prodSupplier">
                                <option value="">Select Supplier</option>
                                ${suppliers.map(s => `<option value="${s.id}" ${isEdit && prodData.supplierId == s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group"><label>Stock Quantity</label><input type="number" id="prodStock" value="${isEdit ? (prodData.stockQuantity || 0) : 0}"></div>
                        <div class="form-group"><label>Reorder Level</label><input type="number" id="prodReorder" value="${isEdit ? (prodData.reorderLevel || 0) : 0}"></div>
                        <div class="form-group"><label>Status</label>
                            <select id="prodStatus">
                                ${PRODUCT_STATUSES.map(s => `<option value="${s}" ${s === defaultStatus ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary" style="margin-top:16px;">${isEdit ? 'Update' : 'Save'} Item</button>
                </form></div></div>`;
            document.getElementById('modalContainer').innerHTML = modalHtml;
            const close = () => { document.getElementById('modalContainer').innerHTML = ''; };
            document.getElementById('closeProdModal').addEventListener('click', close);
            document.getElementById('prodModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) close(); });
            document.getElementById('prodForm').addEventListener('submit', async e => {
                e.preventDefault();
                try {
                    const obj = {
                        type: document.getElementById('prodType').value,
                        sku: document.getElementById('prodSku').value,
                        name: document.getElementById('prodName').value,
                        brand: document.getElementById('prodBrand').value,
                        modelNumber: document.getElementById('prodModel').value,
                        category: document.getElementById('prodCategory').value,
                        fuelType: document.getElementById('prodFuelType').value,
                        capacityKva: parseFloat(document.getElementById('prodCapacity').value) || 0,
                        outputVoltage: document.getElementById('prodVoltage').value,
                        phase: document.getElementById('prodPhase').value,
                        frequency: document.getElementById('prodFrequency').value,
                        engineModel: document.getElementById('prodEngine').value,
                        alternatorModel: document.getElementById('prodAlternator').value,
                        serialNumber: document.getElementById('prodSerial').value,
                        manufacturingYear: parseInt(document.getElementById('prodYear').value) || null,
                        warrantyPeriod: parseInt(document.getElementById('prodWarranty').value) || null,
                        purchasePrice: parseFloat(document.getElementById('prodCostPrice').value) || 0,
                        sellingPrice: parseFloat(document.getElementById('prodSellingPrice').value) || 0,
                        gstRate: parseFloat(document.getElementById('prodGst').value) || 18,
                        supplierId: document.getElementById('prodSupplier').value ? parseInt(document.getElementById('prodSupplier').value) : null,
                        stockQuantity: parseInt(document.getElementById('prodStock').value) || 0,
                        reorderLevel: parseInt(document.getElementById('prodReorder').value) || 0,
                        status: document.getElementById('prodStatus').value
                    };
                    if (isEdit) { obj.id = prodData.id; await dbPut('products', obj); } else await dbAdd('products', obj);
                    close(); await renderProducts(); showToast('Item saved', 'success');
                } catch(err) { showToast('Error saving item', 'error'); console.error(err); }
            });
        } catch(err) { showToast('Error opening item form', 'error'); }
    }

    // ---------- Business Profile ----------
    function renderProfile() {
        const p = getProfile();
        mainContent.innerHTML = `
            <div class="page-header"><h1 class="page-title">Business Profile</h1></div>
            <div class="card">
                <p style="color: #6b7280; margin-bottom: 16px;">These details will appear on all invoices and purchase orders. Update them to reflect your current business information.</p>
                <form id="profileForm">
                    <div class="form-grid">
                        <div class="form-group"><label>Business Name</label><input id="bizName" value="${escapeHtml(p.businessName)}"></div>
                        <div class="form-group"><label>GSTIN</label><input id="bizGstin" value="${escapeHtml(p.gstin)}"></div>
                        <div class="form-group"><label>Address Line</label><input id="bizAddress" value="${escapeHtml(p.address)}"></div>
                        <div class="form-group"><label>City</label><input id="bizCity" value="${escapeHtml(p.city)}"></div>
                        <div class="form-group"><label>State</label><input id="bizState" value="${escapeHtml(p.state)}"></div>
                        <div class="form-group"><label>Pincode</label><input id="bizPincode" value="${escapeHtml(p.pincode)}"></div>
                        <div class="form-group"><label>Email</label><input id="bizEmail" type="email" value="${escapeHtml(p.email)}"></div>
                        <div class="form-group"><label>Phone</label><input id="bizPhone" value="${escapeHtml(p.phone)}"></div>
                        <div class="form-group"><label>Invoice Prefix</label><input id="bizPrefix" value="${escapeHtml(p.invoicePrefix)}"></div>
                        <div class="form-group"><label>Bank Name</label><input id="bizBankName" value="${escapeHtml(p.bankName)}"></div>
                        <div class="form-group"><label>Account Number</label><input id="bizAccountNo" value="${escapeHtml(p.accountNo)}"></div>
                        <div class="form-group"><label>IFSC Code</label><input id="bizIfsc" value="${escapeHtml(p.ifsc)}"></div>
                        <div class="form-group"><label>UPI ID</label><input id="bizUpi" value="${escapeHtml(p.upi)}"></div>
                    </div>
                    <button type="submit" class="btn btn-primary" style="margin-top:12px;">Update Profile</button>
                </form>
            </div>
        `;
        document.getElementById('profileForm').addEventListener('submit', e => {
            e.preventDefault();
            const updated = {
                businessName: document.getElementById('bizName').value,
                gstin: document.getElementById('bizGstin').value,
                address: document.getElementById('bizAddress').value,
                city: document.getElementById('bizCity').value,
                state: document.getElementById('bizState').value,
                pincode: document.getElementById('bizPincode').value,
                email: document.getElementById('bizEmail').value,
                phone: document.getElementById('bizPhone').value,
                invoicePrefix: document.getElementById('bizPrefix').value,
                bankName: document.getElementById('bizBankName').value,
                accountNo: document.getElementById('bizAccountNo').value,
                ifsc: document.getElementById('bizIfsc').value,
                upi: document.getElementById('bizUpi').value
            };
            saveProfile(updated);
            showToast('Profile updated successfully.', 'success');
        });
    }

    // ---------- Reset & Delete Data ----------
    async function resetAllData() {
        const confirmMsg = '⚠️ WARNING: This will permanently DELETE ALL data including customers, suppliers, products, invoices, POs, expenses, service records, warranties, notes, and all settings.\n\nThis action CANNOT be undone.\n\nAre you absolutely sure you want to proceed?';
        if (!confirm(confirmMsg)) {
            showToast('Reset cancelled', 'info');
            return;
        }
        const secondConfirm = 'Type "DELETE ALL" to confirm:';
        const userInput = prompt(secondConfirm);
        if (userInput !== 'DELETE ALL') {
            showToast('Reset cancelled - confirmation text did not match', 'info');
            return;
        }
        try {
            showToast('Resetting all data...', 'info');
            _suppressAutoBackup = true;
            for (const storeName of stores) {
                await dbClearStore(storeName);
            }
            await dbSetSetting('nextInvoiceNumber', 1);
            await dbSetSetting('nextPONumber', 1);
            await dbSetSetting('nextServiceId', 1);
            await dbSetSetting('nextWarrantyId', 1);
            saveProfile({ ...defaultProfile });
            localStorage.removeItem('genfin_last_success');
            localStorage.removeItem('genfin_last_attempt');
            localStorage.removeItem('genfin_last_error');
            localStorage.removeItem('genfin_last_backup');
            syncState.lastSuccessAt = null;
            syncState.lastAttemptAt = null;
            syncState.lastError = null;
            syncState.errorToastShown = false;
            syncState.recoveryToastShown = false;
            saveSyncPersist();
            await dbDeleteSetting('lastLocalChange');
            await dbDeleteSetting('lastCloudSync');
            lastLocalChange = null;
            lastCloudSync = null;
            pendingSync = false;
            updateRealTimeSyncUI();
            showToast('✅ All data has been reset successfully.', 'success');
            navigateTo('invoices');
        } catch (err) {
            console.error('Reset error:', err);
            showToast('Error during reset: ' + err.message, 'error');
        } finally {
            _suppressAutoBackup = false;
            scheduleAutoBackup();
        }
    }

    // ---------- FILE SYSTEM ACCESS API (Local Disk Sync) ----------
    let localFileHandle = null;
    let localFileWriteDebounceTimer = null;
    let localFileWritePending = false;
    let localFileLastWriteTime = null;

    function isFileSystemAccessSupported() {
        return 'showSaveFilePicker' in window && 'showDirectoryPicker' in window;
    }

    async function loadLocalFileHandle() {
        try {
            const handleData = await dbGetSetting('localFileHandle');
            if (handleData) {
                if (handleData.fileName) {
                    return { fileName: handleData.fileName, lastWrite: handleData.lastWrite };
                }
            }
            return null;
        } catch (err) {
            console.warn('Error loading local file handle:', err);
            return null;
        }
    }

    async function saveLocalFileHandleInfo(fileName) {
        await dbSetSetting('localFileHandle', { fileName, lastWrite: localFileLastWriteTime || new Date().toISOString() });
    }

    async function clearLocalFileHandleInfo() {
        await dbDeleteSetting('localFileHandle');
        localFileHandle = null;
        localFileLastWriteTime = null;
        await updateLocalFileUI();
    }

    async function requestLocalFileHandle() {
        if (!isFileSystemAccessSupported()) {
            showToast('File System Access API not supported in this browser.', 'error');
            return false;
        }
        try {
            const suggestedName = `genfin_local_data_${new Date().toISOString().slice(0,10)}.json`;
            const options = {
                suggestedName,
                types: [
                    {
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] },
                    },
                ],
            };
            const handle = await window.showSaveFilePicker(options);
            const permission = await handle.requestPermission({ mode: 'readwrite' });
            if (permission !== 'granted') {
                showToast('Permission to write to file was denied.', 'error');
                return false;
            }
            localFileHandle = handle;
            await writeDataToLocalFile();
            await saveLocalFileHandleInfo(handle.name);
            showToast(`Local file selected: ${handle.name}`, 'success');
            await updateLocalFileUI();
            return true;
        } catch (err) {
            if (err.name !== 'AbortError' && err.name !== 'SecurityError') {
                console.error('Error selecting file:', err);
                showToast('Failed to select file: ' + err.message, 'error');
            }
            return false;
        }
    }

    async function checkLocalFilePermission() {
        if (!localFileHandle) return false;
        try {
            const permission = await localFileHandle.requestPermission({ mode: 'readwrite' });
            if (permission === 'granted') {
                return true;
            } else {
                return false;
            }
        } catch (err) {
            console.warn('Permission check error:', err);
            return false;
        }
    }

    async function writeDataToLocalFile() {
        if (!localFileHandle) {
            const info = await loadLocalFileHandle();
            if (info && info.fileName) {
                showLocalFileReconnectToast();
                return false;
            }
            return false;
        }
        const hasPermission = await checkLocalFilePermission();
        if (!hasPermission) {
            showLocalFileReconnectToast();
            return false;
        }
        try {
            const customers = await dbGetAll('customers');
            const suppliers = await dbGetAll('suppliers');
            const products = await dbGetAll('products');
            const invoices = await dbGetAll('invoices');
            const purchaseOrders = await dbGetAll('purchaseOrders');
            const expenses = await dbGetAll('expenses');
            const serviceHistory = await dbGetAll('serviceHistory');
            const warranties = await dbGetAll('warranties');
            const notes = await dbGetAll('notes');
            const settings = await dbGetAll('settings');
            const profile = getProfile();
            const data = {
                version: 2,
                timestamp: new Date().toISOString(),
                profile,
                customers,
                suppliers,
                products,
                invoices,
                purchaseOrders,
                expenses,
                serviceHistory,
                warranties,
                notes,
                settings
            };
            const jsonStr = JSON.stringify(data, null, 2);
            const writable = await localFileHandle.createWritable();
            await writable.write(jsonStr);
            await writable.close();
            localFileLastWriteTime = new Date().toISOString();
            await saveLocalFileHandleInfo(localFileHandle.name);
            await updateLocalFileUI();
            return true;
        } catch (err) {
            console.error('Error writing to local file:', err);
            if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
                showLocalFileReconnectToast();
            } else {
                showToast('Error writing to local file: ' + err.message, 'error');
            }
            return false;
        }
    }

    async function scheduleLocalFileWrite() {
        if (!localFileHandle && !(await localFileHandleInfoExists())) {
            return;
        }
        if (localFileWriteDebounceTimer) {
            clearTimeout(localFileWriteDebounceTimer);
        }
        localFileWriteDebounceTimer = setTimeout(async () => {
            localFileWriteDebounceTimer = null;
            await writeDataToLocalFile();
        }, 2000);
    }

    async function localFileHandleInfoExists() {
        const info = await loadLocalFileHandle();
        return info && info.fileName;
    }

    function showLocalFileReconnectToast() {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const existing = container.querySelector('.toast-local-file-reconnect');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast toast-warning toast-local-file-reconnect';
        toast.style.cursor = 'pointer';
        toast.innerHTML = `
            <span>${iconSvg('folder')} Local file sync needs attention. </span>
            <button class="btn btn-sm btn-primary" style="margin-left:10px; padding:2px 12px;">Reconnect</button>
        `;
        const reconnectBtn = toast.querySelector('button');
        reconnectBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await requestLocalFileHandle();
            toast.remove();
        });
        toast.addEventListener('click', async () => {
            await requestLocalFileHandle();
            toast.remove();
        });
        container.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 30000);
    }

    async function initializeLocalFileSync() {
        if (!isFileSystemAccessSupported()) {
            console.log('File System Access API not supported, local file sync disabled.');
            return;
        }
        const info = await loadLocalFileHandle();
        if (info && info.fileName) {
            showLocalFileReconnectToast();
            await updateLocalFileUI(info.fileName);
        }
    }

    async function updateLocalFileUI(fileName) {
        const statusEl = document.getElementById('localFileStatus');
        const nameEl = document.getElementById('localFileName');
        const lastWriteEl = document.getElementById('localFileLastWrite');
        const selectBtn = document.getElementById('selectLocalFileBtn');
        const disconnectBtn = document.getElementById('disconnectLocalFileBtn');

        if (nameEl) {
            if (fileName || localFileHandle) {
                const name = fileName || (localFileHandle ? localFileHandle.name : '');
                nameEl.textContent = name || 'No file selected';
            } else {
                nameEl.textContent = 'No file selected';
            }
        }
        if (statusEl) {
            if (localFileHandle) {
                statusEl.textContent = '✅ Connected';
                statusEl.style.color = '#10b981';
            } else if (await localFileHandleInfoExists()) {
                statusEl.textContent = '⚠️ Reconnect required';
                statusEl.style.color = '#f59e0b';
            } else {
                statusEl.textContent = 'Not connected';
                statusEl.style.color = '#6b7280';
            }
        }
        if (lastWriteEl) {
            if (localFileLastWriteTime) {
                lastWriteEl.textContent = new Date(localFileLastWriteTime).toLocaleString();
            } else {
                const info = await loadLocalFileHandle();
                if (info && info.lastWrite) {
                    lastWriteEl.textContent = new Date(info.lastWrite).toLocaleString();
                } else {
                    lastWriteEl.textContent = 'Never';
                }
            }
        }
        if (selectBtn) {
            selectBtn.textContent = localFileHandle ? 'Change File Location' : 'Select File Location';
        }
        if (disconnectBtn) {
            disconnectBtn.style.display = localFileHandle ? 'inline-block' : 'none';
        }
    }

    async function disconnectLocalFile() {
        if (confirm('Disconnect local file sync?')) {
            await clearLocalFileHandleInfo();
            await updateLocalFileUI();
            showToast('Local file sync disconnected', 'info');
        }
    }

    // ---------- SETTINGS ----------
    async function renderSettings() {
        createSyncIndicator();
        updateGlobalSyncIndicator();

        const localFileInfo = await loadLocalFileHandle();
        const localFileName = localFileInfo ? localFileInfo.fileName : '';

        mainContent.innerHTML = `
            <div class="page-header"><h1 class="page-title">Settings</h1></div>
            <div class="card">
                <h3>Local Backup & Restore</h3>
                <p style="margin-bottom: 16px; color: #6b7280;">Export all your business data as a JSON file, or restore from a previously saved backup.</p>
                <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                    <button class="btn btn-primary" id="exportBackupBtn">${iconSvg('export')} Export Backup (JSON)</button>
                    <button class="btn btn-secondary" id="importBackupBtn">${iconSvg('import')} Import Backup</button>
                    <input type="file" id="backupFileInput" accept=".json" style="display: none;">
                </div>
                <div style="margin-top: 24px; padding: 12px; background: #fef3c7; border-radius: 8px; font-size: 0.8rem; color: #92400e;">
                    ⚠️ Warning: Importing a backup will completely replace all existing data. Please ensure you have a current backup before proceeding.
                </div>
            </div>

            <div class="card">
                <h3>${iconSvg('cloud')} Google Drive Backup</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <span id="syncStatusBadge" style="display: inline-flex; align-items: center; font-weight: 600;">Not Connected</span>
                        </div>
                        <div id="gdriveStatus" style="font-size:0.9rem; color:#6b7280;">Not connected</div>
                        <div id="gdriveAuthPanel" style="margin-top: 8px;">
                            <button class="btn btn-primary" id="gdriveAuthBtn">Connect to Google Drive</button>
                        </div>
                        <div id="gdriveActions" style="display:none; margin-top: 8px;">
                            <button class="btn btn-primary" id="gdriveBackupBtn">Backup Now</button>
                            <button class="btn btn-secondary" id="gdriveRestoreBtn">Restore from Drive</button>
                            <button class="btn btn-danger" id="gdriveDisconnectBtn" style="display:none;">Disconnect</button>
                            <button class="btn btn-warning" id="gdriveReconnectBtn" style="display:none;">Reconnect</button>
                        </div>
                        <div style="margin-top: 10px; font-size:0.85rem; background:#f0fdf4; padding:8px 12px; border-radius:6px; border-left:3px solid #10b981;">
                            <strong>📅 Daily Backup Status:</strong> <span id="dailyBackupStatus">Not connected</span>
                        </div>
                    </div>
                    <div style="background: #f9fafb; padding: 12px; border-radius: 8px;">
                        <div style="font-size:0.85rem;">
                            <div><strong>Last successful sync:</strong> <span id="lastSyncSuccess">Never</span></div>
                            <div><strong>Last attempt:</strong> <span id="lastSyncAttempt">Never</span></div>
                            <div><strong>Last error:</strong> <span id="lastSyncError">None</span></div>
                            <div style="margin-top: 6px;">
                                <label style="font-weight:600;">Auto backup frequency:</label>
                                <select id="backupFrequencySelect" style="margin-left: 6px; padding: 4px;">
                                    <option value="15">15 min</option>
                                    <option value="30">30 min</option>
                                    <option value="60">1 hour</option>
                                    <option value="120">2 hours</option>
                                    <option value="240" selected>4 hours</option>
                                </select>
                            </div>
                            <div style="margin-top: 6px;">
                                <label>
                                    <input type="checkbox" id="gdriveAutoBackup" checked> Enable automatic backup
                                </label>
                            </div>
                            <div style="margin-top: 6px;">
                                <a id="viewBackupLink" href="#" target="_blank" style="display:none;">📂 View latest backup in Drive</a>
                            </div>
                            <div style="margin-top: 8px; font-size:0.75rem; color:#6b7280; border-top:1px solid #e5e7eb; padding-top:8px;">
                                <strong>What gets backed up:</strong> All business data (customers, suppliers, products, invoices, purchase orders, expenses, service history, warranties, notes, and your business profile) in a single JSON file. The backup is stored as <code>genfin_latest_backup.json</code> in your <strong>GenFinBackups</strong> folder on Drive.
                            </div>
                            <div style="margin-top: 6px; font-size:0.75rem; background: #fef9e7; padding: 6px; border-radius: 4px; color: #7c6a2d;">
                                💡 If the popup is blocked, please allow popups for this site and click "Connect" again.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Real‑time sync card -->
            <div class="card">
                <h3>${iconSvg('sync')} Real‑time Cloud Sync</h3>
                <p style="color: #6b7280; margin-bottom: 12px;">Every change you make (invoices, POs, inventory, notes, etc.) is automatically synced to <code>genfin_cloud_sync.json</code> in your Drive folder. If you're offline, changes are queued and synced when you come back online.</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 12px; border-radius: 6px;">
                    <div>
                        <div><strong>Status:</strong> <span id="realtimeSyncStatus">Not connected</span></div>
                        <div><strong>Last local change:</strong> <span id="lastLocalChangeDisplay">Never</span></div>
                        <div><strong>Last cloud sync:</strong> <span id="lastCloudSyncDisplay">Never</span></div>
                    </div>
                    <div style="text-align: right;">
                        <button class="btn btn-primary btn-sm" id="forceSyncBtn">${iconSvg('refresh')} Sync Now</button>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3>${iconSvg('save')} Local Disk Sync (Save to a JSON file on your computer)</h3>
                <p style="color: #6b7280; margin-bottom: 12px;">
                    Choose a location on your hard drive to automatically save all your business data as a JSON file. 
                    Every change you make will be written to this file (with a 2-second debounce). 
                    If the file is moved or deleted, you can reconnect.
                </p>
                <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 12px;">
                    <button class="btn btn-primary" id="selectLocalFileBtn">Select File Location</button>
                    <button class="btn btn-danger" id="disconnectLocalFileBtn" style="display: none;">Disconnect</button>
                </div>
                <div style="font-size: 0.9rem; background: #f8fafc; padding: 12px; border-radius: 6px;">
                    <div><strong>Status:</strong> <span id="localFileStatus">Not connected</span></div>
                    <div><strong>File:</strong> <span id="localFileName">${localFileName || 'No file selected'}</span></div>
                    <div><strong>Last write:</strong> <span id="localFileLastWrite">${localFileInfo && localFileInfo.lastWrite ? new Date(localFileInfo.lastWrite).toLocaleString() : 'Never'}</span></div>
                </div>
                <div style="margin-top: 12px; font-size:0.75rem; background: #eef2ff; padding: 8px; border-radius: 4px; color: #3730a3;">
                    ⚙️ The file is updated automatically on every data change (invoices, POs, expenses, inventory, notes, etc.). 
                    Use this as an additional backup or to migrate data to another device.
                </div>
            </div>

            <div class="card" style="border-color: #fca5a5; background: #fef2f2;">
                <h3 style="color: #dc2626;">${iconSvg('trash')} Reset & Delete Data</h3>
                <p style="color: #6b7280; margin-bottom: 12px;">Permanently erase all business data and reset the app to a fresh state. This action cannot be undone.</p>
                <button class="btn btn-danger" id="resetDataBtn">${iconSvg('trash')} Delete All Data & Reset</button>
            </div>
        `;

        // Force sync button
        document.getElementById('forceSyncBtn')?.addEventListener('click', async () => {
            if (!accessToken) {
                showToast('Not connected to Google Drive', 'error');
                return;
            }
            if (!navigator.onLine) {
                showToast('You are offline. Sync will happen automatically when online.', 'warning');
                pendingSync = true;
                updateRealTimeSyncUI();
                return;
            }
            await performRealTimeSync();
        });

        const selectLocalBtn = document.getElementById('selectLocalFileBtn');
        const disconnectLocalBtn = document.getElementById('disconnectLocalFileBtn');
        if (selectLocalBtn) {
            selectLocalBtn.addEventListener('click', async () => {
                await requestLocalFileHandle();
                await updateLocalFileUI();
            });
        }
        if (disconnectLocalBtn) {
            disconnectLocalBtn.addEventListener('click', disconnectLocalFile);
        }

        document.getElementById('exportBackupBtn').addEventListener('click', exportBackup);
        const importBtn = document.getElementById('importBackupBtn');
        const fileInput = document.getElementById('backupFileInput');
        importBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                importBackup(e.target.files[0]);
                fileInput.value = '';
            }
        });

        const authBtn = document.getElementById('gdriveAuthBtn');
        if (authBtn) {
            authBtn.addEventListener('click', signInToGoogle);
            if (popupBlocked) {
                authBtn.textContent = '🔄 Allow Popups & Retry';
            }
        }
        const reconnectBtn = document.getElementById('gdriveReconnectBtn');
        if (reconnectBtn) reconnectBtn.addEventListener('click', signInToGoogle);
        const backupBtn = document.getElementById('gdriveBackupBtn');
        if (backupBtn) backupBtn.addEventListener('click', () => uploadBackupToDrive(true, GD_BACKUP_FILENAME));
        const restoreBtn = document.getElementById('gdriveRestoreBtn');
        if (restoreBtn) restoreBtn.addEventListener('click', showRestoreDialog);
        const disconnectBtn = document.getElementById('gdriveDisconnectBtn');
        if (disconnectBtn) disconnectBtn.addEventListener('click', disconnectDrive);

        const freqSelect = document.getElementById('backupFrequencySelect');
        if (freqSelect) {
            const current = localStorage.getItem('gdrive_backup_frequency') || '240';
            freqSelect.value = current;
            freqSelect.addEventListener('change', (e) => {
                const val = parseInt(e.target.value);
                if (val > 0) {
                    localStorage.setItem('gdrive_backup_frequency', String(val));
                    backupFrequency = val;
                    if (localStorage.getItem('gdrive_auto_backup') !== 'false' && accessToken) {
                        scheduleAutoBackup();
                    }
                }
            });
        }

        const autoCheck = document.getElementById('gdriveAutoBackup');
        if (autoCheck) {
            const stored = localStorage.getItem('gdrive_auto_backup');
            autoCheck.checked = stored !== 'false';
            autoCheck.addEventListener('change', (e) => {
                localStorage.setItem('gdrive_auto_backup', e.target.checked);
                if (e.target.checked && accessToken) {
                    showToast('Auto backup enabled – changes will be synced to Drive', 'success');
                    scheduleAutoBackup();
                } else if (!e.target.checked) {
                    showToast('Auto backup disabled', 'info');
                    stopAutoBackup();
                }
            });
        }

        const resetBtn = document.getElementById('resetDataBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetAllData);
        }

        updateDriveUI(!!accessToken);
        updateLastBackupUI();
        updateSettingsUI();
        await updateLocalFileUI();
        if (accessToken) {
            fetchDriveUserEmail().catch(() => {});
            if (lastBackupFileId) {
                updateViewBackupLink(lastBackupFileId);
            }
            updateDailyBackupStatus();
        }
        await loadSyncTimestamps();
        updateRealTimeSyncUI();
    }

    // ---------- Local Backup & Restore ----------
    async function exportBackup() {
        try {
            showToast('Preparing backup...', 'info');
            const customers = await dbGetAll('customers');
            const suppliers = await dbGetAll('suppliers');
            const products = await dbGetAll('products');
            const invoices = await dbGetAll('invoices');
            const purchaseOrders = await dbGetAll('purchaseOrders');
            const expenses = await dbGetAll('expenses');
            const serviceHistory = await dbGetAll('serviceHistory');
            const warranties = await dbGetAll('warranties');
            const notes = await dbGetAll('notes');
            const settings = await dbGetAll('settings');
            const profile = getProfile();
            const backupData = {
                version: 2,
                timestamp: new Date().toISOString(),
                profile: profile,
                customers: customers,
                suppliers: suppliers,
                products: products,
                invoices: invoices,
                purchaseOrders: purchaseOrders,
                expenses: expenses,
                serviceHistory: serviceHistory,
                warranties: warranties,
                notes: notes,
                settings: settings
            };
            const jsonStr = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `genfin_backup_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Backup exported successfully', 'success');
        } catch (err) {
            console.error(err);
            showToast('Error exporting backup: ' + err.message, 'error');
        }
    }

    async function importBackup(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const backupData = JSON.parse(e.target.result);
                if (!backupData.version || backupData.version !== 2) {
                    throw new Error('Unsupported backup version. Expected version 2.');
                }
                if (!backupData.profile ||
                    !backupData.customers || !backupData.suppliers || !backupData.products ||
                    !backupData.invoices || !backupData.purchaseOrders || !backupData.expenses) {
                    throw new Error('Invalid backup file format');
                }
                const confirmMsg = '⚠️ WARNING: This will replace ALL existing data.\n\nAre you absolutely sure you want to proceed?';
                if (!confirm(confirmMsg)) {
                    showToast('Import cancelled', 'info');
                    return;
                }
                showToast('Restoring backup, please wait...', 'info');
                _suppressAutoBackup = true;
                try {
                    for (const storeName of stores) {
                        await dbClearStore(storeName);
                    }
                    if (backupData.settings && Array.isArray(backupData.settings)) {
                        for (const setting of backupData.settings) {
                            await dbSetSetting(setting.key, setting.value);
                        }
                    }
                    for (const customer of backupData.customers) {
                        await dbAdd('customers', customer);
                    }
                    for (const supplier of backupData.suppliers) {
                        await dbAdd('suppliers', supplier);
                    }
                    for (const product of backupData.products) {
                        await dbAdd('products', product);
                    }
                    for (const invoice of backupData.invoices) {
                        await dbAdd('invoices', invoice);
                    }
                    for (const po of backupData.purchaseOrders) {
                        await dbAdd('purchaseOrders', po);
                    }
                    for (const expense of backupData.expenses) {
                        await dbAdd('expenses', expense);
                    }
                    if (backupData.serviceHistory) {
                        for (const s of backupData.serviceHistory) {
                            await dbAdd('serviceHistory', s);
                        }
                    }
                    if (backupData.warranties) {
                        for (const w of backupData.warranties) {
                            await dbAdd('warranties', w);
                        }
                    }
                    if (backupData.notes) {
                        for (const n of backupData.notes) {
                            await dbAdd('notes', n);
                        }
                    }
                    saveProfile(backupData.profile);
                    showToast('Backup restored successfully!', 'success');
                    navigateTo('invoices');
                } finally {
                    _suppressAutoBackup = false;
                    scheduleAutoBackup();
                }
            } catch (err) {
                console.error(err);
                showToast('Error importing backup: ' + err.message, 'error');
            }
        };
        reader.onerror = () => {
            showToast('Error reading file', 'error');
        };
        reader.readAsText(file);
    }

    // ---------- ENHANCED REPORTS ----------
    let currentChart = null;
    let currentTrendChart = null;

    const REPORT_TABS = ['GST', 'Profit', 'Trends', 'Inventory', 'Receivables', 'Expenses', 'TopItems'];
    const TAB_LABELS = { GST: 'GST Summary', Profit: 'Profitability', Trends: 'Monthly Trends', Inventory: 'Inventory', Receivables: 'Receivables', Expenses: 'Expenses', TopItems: 'Top Items' };

    function setReportTabStyles(activeTab) {
        REPORT_TABS.forEach(t => {
            const el = document.getElementById('tab' + t);
            if (el) el.className = t === activeTab ? 'btn btn-primary' : 'btn btn-outline';
        });
    }

    async function renderReports() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const html = `
            <div class="page-header"><h1 class="page-title">Reports & Analytics</h1></div>
            <div class="card">
                <div style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--border); flex-wrap: wrap;">
                    ${REPORT_TABS.map(t => `<button class="btn btn-outline" id="tab${t}">${TAB_LABELS[t]}</button>`).join('')}
                </div>
                <div id="reportControls" class="form-grid" style="margin-bottom:16px;">
                    <div class="form-group"><label>Period</label><select id="reportPeriod"><option value="Weekly">Weekly</option><option value="Monthly">Monthly</option><option value="Quarterly">Quarterly</option><option value="Half-Yearly">Half-Yearly</option><option value="Yearly" selected>Yearly</option></select></div>
                    <div class="form-group"><label>Year</label><input type="number" id="reportYear" value="${currentYear}" style="width:100px;"></div>
                    <div class="form-group" id="reportSubGroup" style="display:none;"><label>Detail</label><div id="reportSubContainer"></div></div>
                    <div class="form-group" style="align-self:end; display:flex; gap:8px;">
                        <button class="btn btn-primary" id="generateReportBtn">Generate</button>
                        <button class="btn btn-secondary" id="exportCsvBtn">Export CSV</button>
                        <button class="btn btn-secondary" id="exportFullDataBtn">Export All Data (CSV)</button>
                    </div>
                </div>
            </div>
            <div id="reportOutput"></div>
        `;
        mainContent.innerHTML = html;
        let currentTab = 'GST';
        let currentReportData = null;
        const periodSelect = document.getElementById('reportPeriod');
        const subGroup = document.getElementById('reportSubGroup');
        const subContainer = document.getElementById('reportSubContainer');
        const noPeriodTabs = ['Inventory', 'TopItems'];
        function updateControlsVisibility() {
            const controls = document.getElementById('reportControls');
            if (controls) controls.style.display = noPeriodTabs.includes(currentTab) ? 'none' : '';
        }
        function updateSubOptions() {
            const period = periodSelect.value;
            subGroup.style.display = period === 'Yearly' ? 'none' : 'block';
            subContainer.innerHTML = '';
            if (period === 'Monthly') {
                const select = document.createElement('select'); select.id = 'reportSub';
                for (let i = 0; i < 12; i++) { const opt = document.createElement('option'); opt.value = i; opt.textContent = new Date(2020, i).toLocaleString('en-IN', { month: 'long' }); if (i === currentMonth) opt.selected = true; select.appendChild(opt); }
                subContainer.appendChild(select);
            } else if (period === 'Quarterly') {
                const select = document.createElement('select'); select.id = 'reportSub';
                const quarters = ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'];
                quarters.forEach((q, idx) => { const opt = document.createElement('option'); opt.value = idx+1; opt.textContent = q; if (idx+1 === Math.floor(currentMonth/3)+1) opt.selected = true; select.appendChild(opt); });
                subContainer.appendChild(select);
            } else if (period === 'Half-Yearly') {
                const select = document.createElement('select'); select.id = 'reportSub';
                const halves = ['H1 (Apr-Sep)', 'H2 (Oct-Mar)'];
                halves.forEach((h, idx) => { const opt = document.createElement('option'); opt.value = idx === 0 ? 'H1' : 'H2'; opt.textContent = h; if ((idx === 0 && currentMonth < 6) || (idx === 1 && currentMonth >= 6)) opt.selected = true; select.appendChild(opt); });
                subContainer.appendChild(select);
            } else if (period === 'Weekly') {
                const input = document.createElement('input'); input.type = 'date'; input.id = 'reportWeekStart'; input.value = new Date().toISOString().split('T')[0];
                subContainer.appendChild(input);
            }
        }
        updateSubOptions();
        periodSelect.addEventListener('change', updateSubOptions);
        async function generate() {
            updateControlsVisibility();
            if (noPeriodTabs.includes(currentTab)) {
                if (currentTab === 'Inventory') currentReportData = await generateInventoryReport(true);
                else if (currentTab === 'TopItems') currentReportData = await generateTopItemsReport(true);
                return;
            }
            const period = periodSelect.value;
            const year = parseInt(document.getElementById('reportYear').value) || currentYear;
            let sub = '';
            if (period === 'Weekly') sub = document.getElementById('reportWeekStart')?.value || new Date().toISOString().split('T')[0];
            else { const subElem = document.getElementById('reportSub'); if (subElem) sub = subElem.value; }
            const { start, end } = getDateRange(period, year, sub);
            if (currentTab === 'GST') currentReportData = await generateGSTReport(start, end, period, year, sub, true);
            else if (currentTab === 'Profit') currentReportData = await generateProfitReport(start, end, period, year, sub, true);
            else if (currentTab === 'Trends') await generateTrendsReport(year);
            else if (currentTab === 'Receivables') currentReportData = await generateReceivablesReport(start, end, period, year, sub, true);
            else if (currentTab === 'Expenses') currentReportData = await generateExpenseBreakdownReport(start, end, period, year, sub, true);
        }
        document.getElementById('generateReportBtn').addEventListener('click', generate);
        document.getElementById('exportCsvBtn').addEventListener('click', () => { if (!currentReportData) { showToast('Generate a report first', 'info'); return; } if (currentTab === 'GST') exportGSTToCSV(currentReportData); else if (currentTab === 'Profit') exportProfitToCSV(currentReportData); else if (currentTab === 'Receivables' && currentReportData.csvRows) downloadCSV(currentReportData.csvRows, 'receivables_report.csv'); else if (currentTab === 'Expenses' && currentReportData.csvRows) downloadCSV(currentReportData.csvRows, 'expense_report.csv'); else showToast('CSV export available for this report', 'info'); });
        document.getElementById('exportFullDataBtn').addEventListener('click', exportAllTransactionsCSV);
        REPORT_TABS.forEach(t => {
            document.getElementById('tab' + t)?.addEventListener('click', () => {
                currentTab = t;
                setReportTabStyles(t);
                generate();
            });
        });
        setReportTabStyles('GST');
        await generate();
    }

    async function generateTrendsReport(year) {
        const allInvoices = await dbGetAll('invoices');
        const products = await dbGetAll('products');
        const months = [];
        const revenueData = [];
        const cogsData = [];
        const profitData = [];
        const targetYear = year || new Date().getFullYear();
        for (let m = 0; m < 12; m++) {
            const monthStart = new Date(targetYear, m, 1);
            const monthEnd = new Date(targetYear, m + 1, 0);
            const startStr = monthStart.toISOString().split('T')[0];
            const endStr = monthEnd.toISOString().split('T')[0];
            const monthInvoices = allInvoices.filter(inv => inv.date >= startStr && inv.date <= endStr);
            let monthRevenue = 0;
            let monthCOGS = 0;
            for (const inv of monthInvoices) {
                monthRevenue += inv.grandTotal || 0;
                if (inv.items) {
                    for (const item of inv.items) {
                        const prod = products.find(p => p.id == item.productId);
                        const costPerUnit = prod?.purchasePrice || 0;
                        monthCOGS += (item.qty * costPerUnit);
                    }
                }
            }
            const monthProfit = monthRevenue - monthCOGS;
            months.push(monthStart.toLocaleString('en-IN', { month: 'short' }));
            revenueData.push(monthRevenue);
            cogsData.push(monthCOGS);
            profitData.push(monthProfit);
        }
        const outputHtml = `
            <div class="card">
                <h3>Monthly Financial Trends (${targetYear})</h3>
                <div class="chart-container" style="max-height: 400px;">
                    <canvas id="trendsChart" width="800" height="400"></canvas>
                </div>
                <p style="margin-top: 12px; font-size: 0.8rem; color: #6b7280;">Revenue (Sales), Cost of Goods Sold, and Gross Profit for each month.</p>
            </div>
            <div class="card">
                <h3>Summary</h3>
                <div class="stat-row">
                    <div class="stat-card"><div class="stat-value">${formatCurrency(revenueData.reduce((a,b)=>a+b,0))}</div><div class="stat-label">Total Revenue</div></div>
                    <div class="stat-card"><div class="stat-value">${formatCurrency(cogsData.reduce((a,b)=>a+b,0))}</div><div class="stat-label">Total COGS</div></div>
                    <div class="stat-card"><div class="stat-value">${formatCurrency(profitData.reduce((a,b)=>a+b,0))}</div><div class="stat-label">Total Profit</div></div>
                </div>
            </div>
        `;
        document.getElementById('reportOutput').innerHTML = outputHtml;
        const ctx = document.getElementById('trendsChart').getContext('2d');
        if (currentTrendChart) currentTrendChart.destroy();
        currentTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [
                    { label: 'Revenue (₹)', data: revenueData, borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,0.1)', tension: 0.2, fill: true },
                    { label: 'COGS (₹)', data: cogsData, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', tension: 0.2, fill: true },
                    { label: 'Gross Profit (₹)', data: profitData, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.2, fill: true }
                ]
            },
            options: { responsive: true, maintainAspectRatio: true, plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` } } } }
        });
    }

    async function generateGSTReport(start, end, period, year, sub, renderToDom = true) {
        const allInvoices = await dbGetAll('invoices');
        const allPOs = await dbGetAll('purchaseOrders');
        const filterByDate = (items) => items.filter(item => item.date >= start && item.date <= end);
        const invoices = filterByDate(allInvoices);
        const pos = filterByDate(allPOs);
        let allInvoiceItems = []; invoices.forEach(inv => { if (inv.items) allInvoiceItems = allInvoiceItems.concat(inv.items); });
        let allPOItems = []; pos.forEach(po => { if (po.items) allPOItems = allPOItems.concat(po.items); });
        function aggregateTaxByRate(items) { const rates = {}; items.forEach(item => { const gstRate = item.selectedGstRate; if (!rates[gstRate]) rates[gstRate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 }; rates[gstRate].taxable += item.taxable; rates[gstRate].cgst += item.cgstAmt; rates[gstRate].sgst += item.sgstAmt; rates[gstRate].igst += item.igstAmt; }); return rates; }
        const invoiceTaxByRate = aggregateTaxByRate(allInvoiceItems);
        const poTaxByRate = aggregateTaxByRate(allPOItems);
        const totalInvTaxable = allInvoiceItems.reduce((s,i)=>s+i.taxable,0);
        const totalInvCGST = allInvoiceItems.reduce((s,i)=>s+i.cgstAmt,0);
        const totalInvSGST = allInvoiceItems.reduce((s,i)=>s+i.sgstAmt,0);
        const totalInvIGST = allInvoiceItems.reduce((s,i)=>s+i.igstAmt,0);
        const totalPOTaxable = allPOItems.reduce((s,i)=>s+i.taxable,0);
        const totalPOCGST = allPOItems.reduce((s,i)=>s+i.cgstAmt,0);
        const totalPOSGST = allPOItems.reduce((s,i)=>s+i.sgstAmt,0);
        const totalPOIGST = allPOItems.reduce((s,i)=>s+i.igstAmt,0);
        const periodLabel = period === 'Weekly' ? `Week of ${formatDate(start)}` : period === 'Monthly' ? `${new Date(year, sub).toLocaleString('en-IN',{month:'long', year:'numeric'})}` : period === 'Quarterly' ? `Q${sub} ${year}` : period === 'Half-Yearly' ? `${sub} ${year}` : `Year ${year}`;
        const rates = Object.keys(invoiceTaxByRate).sort((a,b)=>Number(a)-Number(b));
        const taxableData = rates.map(r => invoiceTaxByRate[r].taxable);
        const taxData = rates.map(r => invoiceTaxByRate[r].cgst + invoiceTaxByRate[r].sgst + invoiceTaxByRate[r].igst);
        const invoiceRateRows = rates.map(rate => { const r = invoiceTaxByRate[rate]; return `<tr><td>${rate}%</td><td class="text-right">${formatCurrency(r.taxable)}</td><td class="text-right">${formatCurrency(r.cgst)}</td><td class="text-right">${formatCurrency(r.sgst)}</td><td class="text-right">${formatCurrency(r.igst)}</td><td class="text-right">${formatCurrency(r.cgst+r.sgst+r.igst)}</td></tr>`; }).join('');
        const poRateRows = Object.keys(poTaxByRate).sort((a,b)=>Number(a)-Number(b)).map(rate => { const r = poTaxByRate[rate]; return `<tr><td>${rate}%</td><td class="text-right">${formatCurrency(r.taxable)}</td><td class="text-right">${formatCurrency(r.cgst)}</td><td class="text-right">${formatCurrency(r.sgst)}</td><td class="text-right">${formatCurrency(r.igst)}</td><td class="text-right">${formatCurrency(r.cgst+r.sgst+r.igst)}</td></tr>`; }).join('');
        let chartHtml = '';
        if (rates.length > 0) {
            chartHtml = `<div class="chart-container"><canvas id="gstChart" width="400" height="200"></canvas></div>`;
        } else {
            chartHtml = `<p style="color:#6b7280;">No GST data available for this period.</p>`;
        }
        const outputHtml = `<h2>GST Summary: ${periodLabel}</h2><div class="stat-row"><div class="stat-card"><div class="stat-value">${formatCurrency(totalInvTaxable)}</div><div class="stat-label">Sales Taxable</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(totalPOTaxable)}</div><div class="stat-label">Purchase Taxable</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(totalInvCGST+totalInvSGST+totalInvIGST)}</div><div class="stat-label">Sales GST</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(totalPOCGST+totalPOSGST+totalPOIGST)}</div><div class="stat-label">Purchase GST</div></div></div>
        ${chartHtml}
        <div class="card"><h3>Outward Supplies (Sales)</h3>${allInvoiceItems.length ? `<div class="table-wrap"><table><thead><tr><th>Rate</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total Tax</th></tr></thead><tbody>${invoiceRateRows}<tr style="background:#f9fafb; font-weight:bold;"><td>Total</td><td class="text-right">${formatCurrency(totalInvTaxable)}</td><td class="text-right">${formatCurrency(totalInvCGST)}</td><td class="text-right">${formatCurrency(totalInvSGST)}</td><td class="text-right">${formatCurrency(totalInvIGST)}</td><td class="text-right">${formatCurrency(totalInvCGST+totalInvSGST+totalInvIGST)}</td></tr></tbody></table></div>` : '<p>No invoices.</p>'}</div>
        <div class="card"><h3>Inward Supplies (Purchases)</h3>${allPOItems.length ? `<div class="table-wrap"><table><thead><tr><th>Rate</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total Tax</th></tr></thead><tbody>${poRateRows}<tr style="background:#f9fafb; font-weight:bold;"><td>Total</td><td class="text-right">${formatCurrency(totalPOTaxable)}</td><td class="text-right">${formatCurrency(totalPOCGST)}</td><td class="text-right">${formatCurrency(totalPOSGST)}</td><td class="text-right">${formatCurrency(totalPOIGST)}</td><td class="text-right">${formatCurrency(totalPOCGST+totalPOSGST+totalPOIGST)}</td></tr></tbody></table></div>` : '<p>No POs.</p>'}</div>
        <div class="card"><h3>Net GST Liability</h3><div class="stat-row"><div class="stat-card"><div class="stat-value">${formatCurrency((totalInvCGST+totalInvSGST) - (totalPOCGST+totalPOSGST))}</div><div class="stat-label">Net CGST+SGST</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(totalInvIGST - totalPOIGST)}</div><div class="stat-label">Net IGST</div></div></div></div>`;
        if (renderToDom) {
            document.getElementById('reportOutput').innerHTML = outputHtml;
            if (rates.length > 0) {
                const ctx = document.getElementById('gstChart').getContext('2d');
                if (currentChart) currentChart.destroy();
                currentChart = new Chart(ctx, { type: 'bar', data: { labels: rates.map(r => `${r}%`), datasets: [{ label: 'Taxable Value', data: taxableData, backgroundColor: '#4f46e5' }, { label: 'Total Tax', data: taxData, backgroundColor: '#f59e0b' }] }, options: { responsive: true, maintainAspectRatio: true } });
            }
        }
        return { periodLabel, invoices: { byRate: invoiceTaxByRate, totals: { taxable: totalInvTaxable, cgst: totalInvCGST, sgst: totalInvSGST, igst: totalInvIGST } }, pos: { byRate: poTaxByRate, totals: { taxable: totalPOTaxable, cgst: totalPOCGST, sgst: totalPOSGST, igst: totalPOIGST } } };
    }

    async function generateProfitReport(start, end, period, year, sub, renderToDom = true) {
        const allInvoices = await dbGetAll('invoices');
        const products = await dbGetAll('products');
        const filterByDate = (items) => items.filter(item => item.date >= start && item.date <= end);
        const invoices = filterByDate(allInvoices);
        const salesByProduct = {};
        invoices.forEach(inv => { inv.items.forEach(item => { const pid = item.productId; if (!salesByProduct[pid]) salesByProduct[pid] = { qty: 0, revenue: 0 }; salesByProduct[pid].qty += item.qty; salesByProduct[pid].revenue += item.taxable; }); });
        let totalRevenue = 0, totalCOGS = 0;
        const profitDetails = [];
        for (const [pid, sales] of Object.entries(salesByProduct)) {
            const prod = products.find(p => p.id == pid);
            const costPerUnit = prod?.purchasePrice || 0;
            const cogs = sales.qty * costPerUnit;
            const profit = sales.revenue - cogs;
            const margin = sales.revenue ? (profit / sales.revenue) * 100 : 0;
            totalRevenue += sales.revenue; totalCOGS += cogs;
            profitDetails.push({ name: prod?.name || 'Unknown', type: prod?.type || 'Product', qty: sales.qty, revenue: sales.revenue, cogs, profit, margin });
        }
        const grossProfit = totalRevenue - totalCOGS;
        const grossMargin = totalRevenue ? (grossProfit / totalRevenue) * 100 : 0;
        const periodLabel = period === 'Weekly' ? `Week of ${formatDate(start)}` : period === 'Monthly' ? `${new Date(year, sub).toLocaleString('en-IN',{month:'long', year:'numeric'})}` : period === 'Quarterly' ? `Q${sub} ${year}` : period === 'Half-Yearly' ? `${sub} ${year}` : `Year ${year}`;
        const detailsRows = profitDetails.map(d => `<tr><td style="padding:6px;">${escapeHtml(d.name)}</td><td style="padding:6px;">${escapeHtml(d.type)}</td><td class="text-right">${d.qty}</td><td class="text-right">${formatCurrency(d.revenue)}</td><td class="text-right">${formatCurrency(d.cogs)}</td><td class="text-right">${formatCurrency(d.profit)}</td><td class="text-right">${d.margin.toFixed(2)}%</td></tr>`).join('');
        let chartHtml = '';
        if (profitDetails.length > 0) {
            chartHtml = `<div class="chart-container"><canvas id="profitChart" width="400" height="200"></canvas></div>`;
        } else {
            chartHtml = `<p style="color:#6b7280;">No sales data available for this period.</p>`;
        }
        const outputHtml = `<h2>Profitability Report: ${periodLabel}</h2><div class="stat-row"><div class="stat-card"><div class="stat-value">${formatCurrency(totalRevenue)}</div><div class="stat-label">Total Sales Revenue</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(totalCOGS)}</div><div class="stat-label">Cost of Goods Sold</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(grossProfit)}</div><div class="stat-label">Gross Profit</div></div><div class="stat-card"><div class="stat-value">${grossMargin.toFixed(2)}%</div><div class="stat-label">Gross Margin</div></div></div>
        ${chartHtml}
        <div class="card"><h3>Profit by Product / Service</h3>${profitDetails.length ? `<div class="table-wrap"><table><thead><tr><th>Item</th><th>Type</th><th>Qty Sold</th><th>Revenue</th><th>COGS</th><th>Profit</th><th>Margin</th></tr></thead><tbody>${detailsRows}</tbody></table></div>` : '<p>No sales data in this period.</p>'}</div>`;
        if (renderToDom) {
            document.getElementById('reportOutput').innerHTML = outputHtml;
            if (profitDetails.length > 0) {
                const ctx = document.getElementById('profitChart').getContext('2d');
                if (currentChart) currentChart.destroy();
                currentChart = new Chart(ctx, { type: 'pie', data: { labels: profitDetails.map(d => d.name), datasets: [{ data: profitDetails.map(d => d.profit), backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec489a'] }] }, options: { responsive: true, plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}` } } } } });
            }
        }
        return { periodLabel, totalRevenue, totalCOGS, grossProfit, grossMargin, details: profitDetails };
    }

    // --- CSV Exports ---
    async function exportAllTransactionsCSV() {
        const invoices = await dbGetAll('invoices');
        const purchaseOrders = await dbGetAll('purchaseOrders');
        const customers = await dbGetAll('customers');
        const suppliers = await dbGetAll('suppliers');
        const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));
        const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s]));
        
        const csvRows = [];
        csvRows.push(['=== INVOICES (Sales) ===']);
        csvRows.push(['Invoice #', 'Date', 'Due Date', 'Customer Name', 'Customer GSTIN', 'Customer State', 'Customer Phone', 'Customer Address', 'Status', 'Subtotal', 'Discount', 'Total Tax', 'Grand Total', 'Notes']);
        for (const inv of invoices) {
            const cust = customerMap[inv.customerId] || {};
            csvRows.push([inv.invoiceNumber, inv.date, inv.dueDate, cust.name || '', cust.gstin || '', cust.state || '', cust.phone || '', cust.address || '', inv.paymentStatus, inv.subtotal, inv.discount || 0, inv.totalTax, inv.grandTotal, inv.notes || '']);
            csvRows.push(['Line Items:', 'Product', 'Description', 'HSN', 'Qty', 'Rate', 'GST%', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total']);
            if (inv.items) {
                for (const item of inv.items) {
                    csvRows.push(['', item.description, '', item.hsn, item.qty, item.rate, item.selectedGstRate, item.taxable, item.cgstAmt, item.sgstAmt, item.igstAmt, item.total]);
                }
            }
            csvRows.push([]);
        }
        csvRows.push(['=== PURCHASE ORDERS (Purchases) ===']);
        csvRows.push(['PO #', 'Date', 'Supplier Name', 'Supplier GSTIN', 'Supplier State', 'Supplier Phone', 'Supplier Address', 'Status', 'Subtotal', 'Discount', 'Total Tax', 'Grand Total']);
        for (const po of purchaseOrders) {
            const supp = supplierMap[po.supplierId] || {};
            csvRows.push([po.poNumber, po.date, supp.name || '', supp.gstin || '', supp.state || '', supp.phone || '', supp.address || '', po.status, po.subtotal, po.discount || 0, po.totalTax, po.grandTotal]);
            csvRows.push(['Line Items:', 'Product', 'Description', 'HSN', 'Qty', 'Rate', 'GST%', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total']);
            if (po.items) {
                for (const item of po.items) {
                    csvRows.push(['', item.description, '', item.hsn, item.qty, item.rate, item.selectedGstRate, item.taxable, item.cgstAmt, item.sgstAmt, item.igstAmt, item.total]);
                }
            }
            csvRows.push([]);
        }
        const csvContent = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', `all_transactions_${new Date().toISOString().slice(0,19)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Full transaction data with GST details exported', 'success');
    }

    function exportGSTToCSV(reportData) {
        let csvRows = [];
        csvRows.push(['GST Report - ' + reportData.periodLabel]);
        csvRows.push([]);
        csvRows.push(['Outward Supplies (Sales)']); csvRows.push(['GST Rate', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax']);
        for (const [rate, data] of Object.entries(reportData.invoices.byRate).sort((a,b)=>Number(a[0])-Number(b[0]))) csvRows.push([`${rate}%`, data.taxable, data.cgst, data.sgst, data.igst, data.cgst+data.sgst+data.igst]);
        csvRows.push(['Total', reportData.invoices.totals.taxable, reportData.invoices.totals.cgst, reportData.invoices.totals.sgst, reportData.invoices.totals.igst, reportData.invoices.totals.cgst+reportData.invoices.totals.sgst+reportData.invoices.totals.igst]);
        csvRows.push([]); csvRows.push(['Inward Supplies (Purchases)']); csvRows.push(['GST Rate', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax']);
        for (const [rate, data] of Object.entries(reportData.pos.byRate).sort((a,b)=>Number(a[0])-Number(b[0]))) csvRows.push([`${rate}%`, data.taxable, data.cgst, data.sgst, data.igst, data.cgst+data.sgst+data.igst]);
        csvRows.push(['Total', reportData.pos.totals.taxable, reportData.pos.totals.cgst, reportData.pos.totals.sgst, reportData.pos.totals.igst, reportData.pos.totals.cgst+reportData.pos.totals.sgst+reportData.pos.totals.igst]);
        downloadCSV(csvRows, `gst_report_${reportData.periodLabel.replace(/ /g,'_')}.csv`);
    }

    function exportProfitToCSV(reportData) {
        let csvRows = [];
        csvRows.push(['Profitability Report - ' + reportData.periodLabel]);
        csvRows.push([]); csvRows.push(['Total Sales Revenue', reportData.totalRevenue]); csvRows.push(['Cost of Goods Sold', reportData.totalCOGS]); csvRows.push(['Gross Profit', reportData.grossProfit]); csvRows.push(['Gross Margin %', reportData.grossMargin.toFixed(2)]); csvRows.push([]);
        csvRows.push(['Profit by Product / Service']); csvRows.push(['Item', 'Type', 'Qty Sold', 'Revenue', 'COGS', 'Profit', 'Margin %']);
        reportData.details.forEach(d => { csvRows.push([d.name, d.type, d.qty, d.revenue, d.cogs, d.profit, d.margin.toFixed(2)]); });
        downloadCSV(csvRows, `profit_report_${reportData.periodLabel.replace(/ /g,'_')}.csv`);
    }

    function downloadCSV(rows, filename) {
        const csvContent = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a'); const url = URL.createObjectURL(blob);
        link.href = url; link.setAttribute('download', filename);
        document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
        showToast('CSV exported', 'success');
    }

    // Remove row handler
    document.addEventListener('click', e => {
        if (e.target.classList.contains('remove-item-row') || e.target.classList.contains('remove-row')) {
            e.target.closest('.invoice-item-row, .po-item-row')?.remove();
            const form = e.target.closest('form');
            if (form) form.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    // ---- Create sync indicator in sidebar ----
    createSyncIndicator();

    // ---- Service & Warranty Module ----
    async function renderServiceWarranty() {
        const html = `
            <div class="page-header"><h1 class="page-title">Service & Warranty</h1></div>
            <div class="card">
                <div style="display: flex; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid var(--border);">
                    <button class="btn btn-primary" id="tabService">Service History</button>
                    <button class="btn btn-outline" id="tabWarranty">Warranty Tracking</button>
                </div>
                <div id="serviceWarrantyContent"></div>
            </div>
        `;
        mainContent.innerHTML = html;
        let activeTab = 'service';

        async function loadTab(tab) {
            activeTab = tab;
            document.getElementById('tabService').className = tab === 'service' ? 'btn btn-primary' : 'btn btn-outline';
            document.getElementById('tabWarranty').className = tab === 'warranty' ? 'btn btn-primary' : 'btn btn-outline';
            const content = document.getElementById('serviceWarrantyContent');
            if (tab === 'service') {
                await renderServiceList(content);
            } else {
                await renderWarrantyList(content);
            }
        }

        document.getElementById('tabService').addEventListener('click', () => loadTab('service'));
        document.getElementById('tabWarranty').addEventListener('click', () => loadTab('warranty'));
        await loadTab('service');
    }

    // ---- Service History ----
    async function renderServiceList(container) {
        const services = await dbGetAll('serviceHistory');
        const customers = await dbGetAll('customers');
        const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
        services.sort((a,b) => new Date(b.serviceDate) - new Date(a.serviceDate));
        let html = `
            <div style="display:flex; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
                <h3>Service Records</h3>
                <button class="btn btn-primary" id="addServiceBtn">${iconSvg('plus')} New Service Record</button>
            </div>
            <div class="table-wrap">
                <table>
                    <thead><tr style="${TABLE_HEADER_STYLE}">
                        <th>Service ID</th><th>Customer</th><th>Serial #</th><th>Service Date</th><th>Runtime (hrs)</th><th>Next Due</th><th>Cost</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
        `;
        if (!services.length) {
            html += `<tr><td colspan="8" class="empty-state">No service records found.</td></tr>`;
        } else {
            services.forEach(s => {
                html += `<tr>
                    <td>${escapeHtml(s.serviceId)}</td>
                    <td>${escapeHtml(customerMap[s.customerId] || '')}</td>
                    <td>${escapeHtml(s.generatorSerialNumber || '')}</td>
                    <td>${formatDate(s.serviceDate)}</td>
                    <td>${s.runtimeHours || ''}</td>
                    <td>${formatDate(s.nextServiceDueDate)}</td>
                    <td>${formatCurrency(s.serviceCost || 0)}</td>
                    <td>
                        <button class="btn btn-outline btn-sm edit-service" data-id="${s.id}">Edit</button>
                        <button class="btn btn-danger btn-sm delete-service" data-id="${s.id}">${iconSvg('trash')}</button>
                    </td>
                </tr>`;
            });
        }
        html += `</tbody></table></div>`;
        container.innerHTML = html;

        document.getElementById('addServiceBtn')?.addEventListener('click', () => showServiceModal());
        document.querySelectorAll('.edit-service').forEach(btn => {
            btn.addEventListener('click', async () => {
                const s = await dbGetById('serviceHistory', Number(btn.dataset.id));
                if (s) showServiceModal(s);
            });
        });
        document.querySelectorAll('.delete-service').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Delete this service record?')) {
                    await dbDelete('serviceHistory', Number(btn.dataset.id));
                    await renderServiceWarranty();
                }
            });
        });
    }

    async function showServiceModal(serviceData = null) {
        const isEdit = !!serviceData;
        const customers = await dbGetAll('customers');
        const products = await dbGetAll('products');
        const customerOptions = customers.map(c => `<option value="${c.id}" ${isEdit && serviceData.customerId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
        const serialOptions = products.filter(p => p.serialNumber).map(p => `<option value="${escapeHtml(p.serialNumber)}" ${isEdit && serviceData.generatorSerialNumber === p.serialNumber ? 'selected' : ''}>${escapeHtml(p.serialNumber)} (${escapeHtml(p.name)})</option>`).join('');
        const nextId = await getNextServiceId();
        const modalHtml = `
            <div class="modal-overlay" id="serviceModalOverlay">
                <div class="modal">
                    <button class="modal-close" id="closeServiceModal">${iconSvg('close')}</button>
                    <h3>${isEdit ? 'Edit' : 'New'} Service Record</h3>
                    <form id="serviceForm">
                        <div class="form-grid">
                            <div class="form-group"><label>Service ID</label><input type="text" id="serviceId" value="${isEdit ? serviceData.serviceId : nextId}" readonly></div>
                            <div class="form-group"><label>Customer *</label><select id="serviceCustomer" required>${customerOptions}</select></div>
                            <div class="form-group"><label>Generator Serial Number</label>
                                <input list="serialList" id="serviceSerial" value="${isEdit ? escapeHtml(serviceData.generatorSerialNumber || '') : ''}">
                                <datalist id="serialList">${serialOptions}</datalist>
                            </div>
                            <div class="form-group"><label>Service Date *</label><input type="date" id="serviceDate" value="${isEdit ? serviceData.serviceDate : new Date().toISOString().split('T')[0]}" required></div>
                            <div class="form-group"><label>Runtime Hours</label><input type="number" step="0.1" id="serviceRuntime" value="${isEdit ? serviceData.runtimeHours || '' : ''}"></div>
                            <div class="form-group"><label>Problem Reported</label><textarea id="serviceProblem" rows="2">${isEdit ? escapeHtml(serviceData.problemReported || '') : ''}</textarea></div>
                            <div class="form-group"><label>Resolution</label><textarea id="serviceResolution" rows="2">${isEdit ? escapeHtml(serviceData.resolution || '') : ''}</textarea></div>
                            <div class="form-group"><label>Parts Replaced</label><input id="serviceParts" value="${isEdit ? escapeHtml(serviceData.partsReplaced || '') : ''}"></div>
                            <div class="form-group"><label>Next Service Due Date</label><input type="date" id="serviceNextDue" value="${isEdit ? serviceData.nextServiceDueDate : ''}"></div>
                            <div class="form-group"><label>Service Cost (₹)</label><input type="number" step="0.01" id="serviceCost" value="${isEdit ? serviceData.serviceCost || 0 : 0}"></div>
                        </div>
                        <button type="submit" class="btn btn-primary" style="margin-top:12px;">${isEdit ? 'Update' : 'Save'}</button>
                    </form>
                </div>
            </div>
        `;
        document.getElementById('modalContainer').innerHTML = modalHtml;
        const close = () => { document.getElementById('modalContainer').innerHTML = ''; };
        document.getElementById('closeServiceModal').addEventListener('click', close);
        document.getElementById('serviceModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) close(); });
        document.getElementById('serviceForm').addEventListener('submit', async e => {
            e.preventDefault();
            try {
                const obj = {
                    serviceId: document.getElementById('serviceId').value,
                    customerId: parseInt(document.getElementById('serviceCustomer').value),
                    generatorSerialNumber: document.getElementById('serviceSerial').value,
                    serviceDate: document.getElementById('serviceDate').value,
                    runtimeHours: parseFloat(document.getElementById('serviceRuntime').value) || 0,
                    problemReported: document.getElementById('serviceProblem').value,
                    resolution: document.getElementById('serviceResolution').value,
                    partsReplaced: document.getElementById('serviceParts').value,
                    nextServiceDueDate: document.getElementById('serviceNextDue').value,
                    serviceCost: parseFloat(document.getElementById('serviceCost').value) || 0,
                };
                if (isEdit) {
                    obj.id = serviceData.id;
                    await dbPut('serviceHistory', obj);
                } else {
                    await dbAdd('serviceHistory', obj);
                    await incrementServiceId();
                }
                showToast('Service record saved', 'success');
                close();
                await renderServiceWarranty();
            } catch(err) {
                showToast('Error saving service record', 'error');
                console.error(err);
            }
        });
    }

    // ---- Warranty Tracking ----
    async function renderWarrantyList(container) {
        const warranties = await dbGetAll('warranties');
        const customers = await dbGetAll('customers');
        const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
        warranties.sort((a,b) => new Date(b.warrantyStartDate) - new Date(a.warrantyStartDate));
        let html = `
            <div style="display:flex; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
                <h3>Warranty Records</h3>
                <button class="btn btn-primary" id="addWarrantyBtn">${iconSvg('plus')} New Warranty</button>
            </div>
            <div class="table-wrap">
                <table>
                    <thead><tr style="${TABLE_HEADER_STYLE}">
                        <th>Warranty ID</th><th>Customer</th><th>Serial #</th><th>Purchase Date</th><th>Start Date</th><th>End Date</th><th>Coverage</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
        `;
        if (!warranties.length) {
            html += `<tr><td colspan="8" class="empty-state">No warranty records found.</td></tr>`;
        } else {
            warranties.forEach(w => {
                html += `<tr>
                    <td>${escapeHtml(w.warrantyId)}</td>
                    <td>${escapeHtml(customerMap[w.customerId] || '')}</td>
                    <td>${escapeHtml(w.generatorSerialNumber || '')}</td>
                    <td>${formatDate(w.purchaseDate)}</td>
                    <td>${formatDate(w.warrantyStartDate)}</td>
                    <td>${formatDate(w.warrantyEndDate)}</td>
                    <td>${escapeHtml(w.coverageDetails || '')}</td>
                    <td>
                        <button class="btn btn-outline btn-sm edit-warranty" data-id="${w.id}">Edit</button>
                        <button class="btn btn-danger btn-sm delete-warranty" data-id="${w.id}">${iconSvg('trash')}</button>
                    </td>
                </tr>`;
            });
        }
        html += `</tbody></table></div>`;
        container.innerHTML = html;

        document.getElementById('addWarrantyBtn')?.addEventListener('click', () => showWarrantyModal());
        document.querySelectorAll('.edit-warranty').forEach(btn => {
            btn.addEventListener('click', async () => {
                const w = await dbGetById('warranties', Number(btn.dataset.id));
                if (w) showWarrantyModal(w);
            });
        });
        document.querySelectorAll('.delete-warranty').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (confirm('Delete this warranty record?')) {
                    await dbDelete('warranties', Number(btn.dataset.id));
                    await renderServiceWarranty();
                }
            });
        });
    }

    async function showWarrantyModal(warrantyData = null) {
        const isEdit = !!warrantyData;
        const customers = await dbGetAll('customers');
        const products = await dbGetAll('products');
        const customerOptions = customers.map(c => `<option value="${c.id}" ${isEdit && warrantyData.customerId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
        const serialOptions = products.filter(p => p.serialNumber).map(p => `<option value="${escapeHtml(p.serialNumber)}" ${isEdit && warrantyData.generatorSerialNumber === p.serialNumber ? 'selected' : ''}>${escapeHtml(p.serialNumber)} (${escapeHtml(p.name)})</option>`).join('');
        const nextId = await getNextWarrantyId();
        const modalHtml = `
            <div class="modal-overlay" id="warrantyModalOverlay">
                <div class="modal">
                    <button class="modal-close" id="closeWarrantyModal">${iconSvg('close')}</button>
                    <h3>${isEdit ? 'Edit' : 'New'} Warranty</h3>
                    <form id="warrantyForm">
                        <div class="form-grid">
                            <div class="form-group"><label>Warranty ID</label><input type="text" id="warrantyId" value="${isEdit ? warrantyData.warrantyId : nextId}" readonly></div>
                            <div class="form-group"><label>Customer *</label><select id="warrantyCustomer" required>${customerOptions}</select></div>
                            <div class="form-group"><label>Generator Serial Number</label>
                                <input list="serialListW" id="warrantySerial" value="${isEdit ? escapeHtml(warrantyData.generatorSerialNumber || '') : ''}">
                                <datalist id="serialListW">${serialOptions}</datalist>
                            </div>
                            <div class="form-group"><label>Purchase Date</label><input type="date" id="warrantyPurchaseDate" value="${isEdit ? warrantyData.purchaseDate : ''}"></div>
                            <div class="form-group"><label>Warranty Start Date *</label><input type="date" id="warrantyStartDate" value="${isEdit ? warrantyData.warrantyStartDate : ''}" required></div>
                            <div class="form-group"><label>Warranty End Date *</label><input type="date" id="warrantyEndDate" value="${isEdit ? warrantyData.warrantyEndDate : ''}" required></div>
                            <div class="form-group full"><label>Coverage Details</label><textarea id="warrantyCoverage" rows="3">${isEdit ? escapeHtml(warrantyData.coverageDetails || '') : ''}</textarea></div>
                            <div class="form-group full"><label>Claim History</label><textarea id="warrantyClaims" rows="3">${isEdit ? escapeHtml(warrantyData.claimHistory || '') : ''}</textarea></div>
                        </div>
                        <button type="submit" class="btn btn-primary" style="margin-top:12px;">${isEdit ? 'Update' : 'Save'}</button>
                    </form>
                </div>
            </div>
        `;
        document.getElementById('modalContainer').innerHTML = modalHtml;
        const close = () => { document.getElementById('modalContainer').innerHTML = ''; };
        document.getElementById('closeWarrantyModal').addEventListener('click', close);
        document.getElementById('warrantyModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) close(); });
        document.getElementById('warrantyForm').addEventListener('submit', async e => {
            e.preventDefault();
            try {
                const obj = {
                    warrantyId: document.getElementById('warrantyId').value,
                    customerId: parseInt(document.getElementById('warrantyCustomer').value),
                    generatorSerialNumber: document.getElementById('warrantySerial').value,
                    purchaseDate: document.getElementById('warrantyPurchaseDate').value,
                    warrantyStartDate: document.getElementById('warrantyStartDate').value,
                    warrantyEndDate: document.getElementById('warrantyEndDate').value,
                    coverageDetails: document.getElementById('warrantyCoverage').value,
                    claimHistory: document.getElementById('warrantyClaims').value,
                };
                if (isEdit) {
                    obj.id = warrantyData.id;
                    await dbPut('warranties', obj);
                } else {
                    await dbAdd('warranties', obj);
                    await incrementWarrantyId();
                }
                showToast('Warranty record saved', 'success');
                close();
                await renderServiceWarranty();
            } catch(err) {
                showToast('Error saving warranty', 'error');
                console.error(err);
            }
        });
    }

    // ---------- NEW: GST Summary Page ----------
    async function renderGSTSummary() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const html = `
            <div class="page-header"><h1 class="page-title">GST Summary</h1></div>
            <div class="card">
                <div class="form-grid" style="margin-bottom:16px;">
                    <div class="form-group">
                        <label>Period</label>
                        <select id="gstPeriod">
                            <option value="Monthly">Monthly</option>
                            <option value="Quarterly">Quarterly</option>
                            <option value="Half-Yearly">Half-Yearly</option>
                            <option value="Yearly" selected>Yearly</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Year</label>
                        <input type="number" id="gstYear" value="${currentYear}" style="width:120px;">
                    </div>
                    <div class="form-group" id="gstSubGroup" style="display:none;">
                        <label>Detail</label>
                        <div id="gstSubContainer"></div>
                    </div>
                    <div class="form-group" style="align-self:end; display:flex; gap:8px;">
                        <button class="btn btn-primary" id="generateGstBtn">Generate</button>
                        <button class="btn btn-secondary" id="exportGstPdfBtn">Export PDF</button>
                    </div>
                </div>
                <div id="gstSummaryOutput"></div>
            </div>
        `;
        mainContent.innerHTML = html;

        const periodSelect = document.getElementById('gstPeriod');
        const subGroup = document.getElementById('gstSubGroup');
        const subContainer = document.getElementById('gstSubContainer');

        function updateSubOptions() {
            const period = periodSelect.value;
            subGroup.style.display = period === 'Yearly' ? 'none' : 'block';
            subContainer.innerHTML = '';
            if (period === 'Monthly') {
                const select = document.createElement('select'); select.id = 'gstSub';
                for (let i = 0; i < 12; i++) {
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.textContent = new Date(2020, i).toLocaleString('en-IN', { month: 'long' });
                    if (i === currentMonth) opt.selected = true;
                    select.appendChild(opt);
                }
                subContainer.appendChild(select);
            } else if (period === 'Quarterly') {
                const select = document.createElement('select'); select.id = 'gstSub';
                const quarters = ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'];
                quarters.forEach((q, idx) => {
                    const opt = document.createElement('option');
                    opt.value = idx + 1;
                    opt.textContent = q;
                    if (idx + 1 === Math.floor(currentMonth / 3) + 1) opt.selected = true;
                    select.appendChild(opt);
                });
                subContainer.appendChild(select);
            } else if (period === 'Half-Yearly') {
                const select = document.createElement('select'); select.id = 'gstSub';
                const halves = ['H1 (Apr-Sep)', 'H2 (Oct-Mar)'];
                halves.forEach((h, idx) => {
                    const opt = document.createElement('option');
                    opt.value = idx === 0 ? 'H1' : 'H2';
                    opt.textContent = h;
                    if ((idx === 0 && currentMonth < 6) || (idx === 1 && currentMonth >= 6)) opt.selected = true;
                    select.appendChild(opt);
                });
                subContainer.appendChild(select);
            }
        }
        updateSubOptions();
        periodSelect.addEventListener('change', updateSubOptions);

        async function generateGST() {
            const period = periodSelect.value;
            const year = parseInt(document.getElementById('gstYear').value) || currentYear;
            let sub = '';
            const subElem = document.getElementById('gstSub');
            if (subElem) sub = subElem.value;
            const { start, end } = getDateRange(period, year, sub);
            const output = document.getElementById('gstSummaryOutput');
            output.innerHTML = '<p>Loading...</p>';

            try {
                // Fetch data
                const allInvoices = await dbGetAll('invoices');
                const allPOs = await dbGetAll('purchaseOrders');
                const customers = await dbGetAll('customers');
                const suppliers = await dbGetAll('suppliers');
                const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));
                const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s]));

                const filterByDate = (items) => items.filter(item => item.date >= start && item.date <= end);
                const invoices = filterByDate(allInvoices);
                const pos = filterByDate(allPOs);

                // Build outward table (invoices)
                let outwardRows = '';
                let totalOutwardTaxable = 0, totalOutwardCGST = 0, totalOutwardSGST = 0, totalOutwardIGST = 0;
                invoices.forEach(inv => {
                    const cust = customerMap[inv.customerId] || {};
                    const items = inv.items || [];
                    let invTaxable = 0, invCGST = 0, invSGST = 0, invIGST = 0;
                    items.forEach(item => {
                        invTaxable += item.taxable || 0;
                        invCGST += item.cgstAmt || 0;
                        invSGST += item.sgstAmt || 0;
                        invIGST += item.igstAmt || 0;
                    });
                    totalOutwardTaxable += invTaxable;
                    totalOutwardCGST += invCGST;
                    totalOutwardSGST += invSGST;
                    totalOutwardIGST += invIGST;
                    const itemDesc = items.map(it => escapeHtml(it.description)).join(', ');
                    outwardRows += `<tr>
                        <td>${escapeHtml(inv.invoiceNumber)}</td>
                        <td>${formatDate(inv.date)}</td>
                        <td>${escapeHtml(cust.name || '')}</td>
                        <td>${escapeHtml(cust.gstin || '')}</td>
                        <td>${itemDesc}</td>
                        <td class="text-right">${formatCurrency(invTaxable)}</td>
                        <td class="text-right">${formatCurrency(invCGST)}</td>
                        <td class="text-right">${formatCurrency(invSGST)}</td>
                        <td class="text-right">${formatCurrency(invIGST)}</td>
                        <td class="text-right">${formatCurrency(invTaxable + invCGST + invSGST + invIGST)}</td>
                    </tr>`;
                });

                // Build inward table (purchase orders)
                let inwardRows = '';
                let totalInwardTaxable = 0, totalInwardCGST = 0, totalInwardSGST = 0, totalInwardIGST = 0;
                pos.forEach(po => {
                    const supp = supplierMap[po.supplierId] || {};
                    const items = po.items || [];
                    let poTaxable = 0, poCGST = 0, poSGST = 0, poIGST = 0;
                    items.forEach(item => {
                        poTaxable += item.taxable || 0;
                        poCGST += item.cgstAmt || 0;
                        poSGST += item.sgstAmt || 0;
                        poIGST += item.igstAmt || 0;
                    });
                    totalInwardTaxable += poTaxable;
                    totalInwardCGST += poCGST;
                    totalInwardSGST += poSGST;
                    totalInwardIGST += poIGST;
                    const itemDesc = items.map(it => escapeHtml(it.description)).join(', ');
                    inwardRows += `<tr>
                        <td>${escapeHtml(po.poNumber)}</td>
                        <td>${formatDate(po.date)}</td>
                        <td>${escapeHtml(supp.name || '')}</td>
                        <td>${escapeHtml(supp.gstin || '')}</td>
                        <td>${itemDesc}</td>
                        <td class="text-right">${formatCurrency(poTaxable)}</td>
                        <td class="text-right">${formatCurrency(poCGST)}</td>
                        <td class="text-right">${formatCurrency(poSGST)}</td>
                        <td class="text-right">${formatCurrency(poIGST)}</td>
                        <td class="text-right">${formatCurrency(poTaxable + poCGST + poSGST + poIGST)}</td>
                    </tr>`;
                });

                const netCGST = totalOutwardCGST - totalInwardCGST;
                const netSGST = totalOutwardSGST - totalInwardSGST;
                const netIGST = totalOutwardIGST - totalInwardIGST;
                const netTotalTax = netCGST + netSGST + netIGST;

                const periodLabel = period === 'Monthly' ? `${new Date(year, sub).toLocaleString('en-IN',{month:'long', year:'numeric'})}` :
                                   period === 'Quarterly' ? `Q${sub} ${year}` :
                                   period === 'Half-Yearly' ? `${sub} ${year}` : `Year ${year}`;

                const outputHtml = `
                    <h2>GST Summary: ${periodLabel}</h2>
                    <div class="stat-row">
                        <div class="stat-card"><div class="stat-value">${formatCurrency(totalOutwardTaxable)}</div><div class="stat-label">Outward Taxable</div></div>
                        <div class="stat-card"><div class="stat-value">${formatCurrency(totalOutwardCGST+totalOutwardSGST+totalOutwardIGST)}</div><div class="stat-label">Outward Tax</div></div>
                        <div class="stat-card"><div class="stat-value">${formatCurrency(totalInwardTaxable)}</div><div class="stat-label">Inward Taxable</div></div>
                        <div class="stat-card"><div class="stat-value">${formatCurrency(totalInwardCGST+totalInwardSGST+totalInwardIGST)}</div><div class="stat-label">Inward Tax</div></div>
                    </div>
                    <div class="stat-row">
                        <div class="stat-card" style="background:${netTotalTax >= 0 ? '#fef2f2' : '#ecfdf5'}">
                            <div class="stat-value" style="color:${netTotalTax >= 0 ? '#dc2626' : '#10b981'};">${formatCurrency(netTotalTax)}</div>
                            <div class="stat-label">${netTotalTax >= 0 ? 'Net GST Payable' : 'Net GST Refundable'}</div>
                        </div>
                        <div class="stat-card"><div class="stat-value">${formatCurrency(netCGST)}</div><div class="stat-label">Net CGST</div></div>
                        <div class="stat-card"><div class="stat-value">${formatCurrency(netSGST)}</div><div class="stat-label">Net SGST</div></div>
                        <div class="stat-card"><div class="stat-value">${formatCurrency(netIGST)}</div><div class="stat-label">Net IGST</div></div>
                    </div>

                    <h3>Outward Supplies (Invoices)</h3>
                    <div class="table-wrap">
                        <table>
                            <thead><tr style="${TABLE_HEADER_STYLE}">
                                <th>Invoice #</th><th>Date</th><th>Customer</th><th>GSTIN</th><th>Items</th>
                                <th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th>
                            </tr></thead>
                            <tbody>
                                ${outwardRows || `<tr><td colspan="10" class="empty-state">No invoices in this period.</td></tr>`}
                            </tbody>
                            ${outwardRows ? `<tfoot style="font-weight:bold; background:#f9fafb;"><tr>
                                <td colspan="5" class="text-right">Totals</td>
                                <td class="text-right">${formatCurrency(totalOutwardTaxable)}</td>
                                <td class="text-right">${formatCurrency(totalOutwardCGST)}</td>
                                <td class="text-right">${formatCurrency(totalOutwardSGST)}</td>
                                <td class="text-right">${formatCurrency(totalOutwardIGST)}</td>
                                <td class="text-right">${formatCurrency(totalOutwardTaxable + totalOutwardCGST + totalOutwardSGST + totalOutwardIGST)}</td>
                            </tr></tfoot>` : ''}
                        </table>
                    </div>

                    <h3>Inward Supplies (Purchase Orders)</h3>
                    <div class="table-wrap">
                        <table>
                            <thead><tr style="${TABLE_HEADER_STYLE}">
                                <th>PO #</th><th>Date</th><th>Supplier</th><th>GSTIN</th><th>Items</th>
                                <th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th>
                            </tr></thead>
                            <tbody>
                                ${inwardRows || `<tr><td colspan="10" class="empty-state">No purchase orders in this period.</td></tr>`}
                            </tbody>
                            ${inwardRows ? `<tfoot style="font-weight:bold; background:#f9fafb;"><tr>
                                <td colspan="5" class="text-right">Totals</td>
                                <td class="text-right">${formatCurrency(totalInwardTaxable)}</td>
                                <td class="text-right">${formatCurrency(totalInwardCGST)}</td>
                                <td class="text-right">${formatCurrency(totalInwardSGST)}</td>
                                <td class="text-right">${formatCurrency(totalInwardIGST)}</td>
                                <td class="text-right">${formatCurrency(totalInwardTaxable + totalInwardCGST + totalInwardSGST + totalInwardIGST)}</td>
                            </tr></tfoot>` : ''}
                        </table>
                    </div>
                `;
                output.innerHTML = outputHtml;
                // Store data for PDF export
                output.dataset.periodLabel = periodLabel;
                output.dataset.outwardRows = outwardRows;
                output.dataset.inwardRows = inwardRows;
                output.dataset.totalOutwardTaxable = totalOutwardTaxable;
                output.dataset.totalOutwardCGST = totalOutwardCGST;
                output.dataset.totalOutwardSGST = totalOutwardSGST;
                output.dataset.totalOutwardIGST = totalOutwardIGST;
                output.dataset.totalInwardTaxable = totalInwardTaxable;
                output.dataset.totalInwardCGST = totalInwardCGST;
                output.dataset.totalInwardSGST = totalInwardSGST;
                output.dataset.totalInwardIGST = totalInwardIGST;
                output.dataset.netCGST = netCGST;
                output.dataset.netSGST = netSGST;
                output.dataset.netIGST = netIGST;
                output.dataset.netTotalTax = netTotalTax;
            } catch (err) {
                output.innerHTML = `<p style="color:red;">Error generating GST summary: ${err.message}</p>`;
                console.error(err);
            }
        }

        document.getElementById('generateGstBtn').addEventListener('click', generateGST);
        document.getElementById('exportGstPdfBtn').addEventListener('click', exportGSTSummaryPDF);
        // Auto-generate on load
        await generateGST();
    }

    function exportGSTSummaryPDF() {
        const output = document.getElementById('gstSummaryOutput');
        if (!output) return;
        const periodLabel = output.dataset.periodLabel || 'GST Summary';
        const outwardRows = output.dataset.outwardRows || '';
        const inwardRows = output.dataset.inwardRows || '';
        const totalOutwardTaxable = parseFloat(output.dataset.totalOutwardTaxable) || 0;
        const totalOutwardCGST = parseFloat(output.dataset.totalOutwardCGST) || 0;
        const totalOutwardSGST = parseFloat(output.dataset.totalOutwardSGST) || 0;
        const totalOutwardIGST = parseFloat(output.dataset.totalOutwardIGST) || 0;
        const totalInwardTaxable = parseFloat(output.dataset.totalInwardTaxable) || 0;
        const totalInwardCGST = parseFloat(output.dataset.totalInwardCGST) || 0;
        const totalInwardSGST = parseFloat(output.dataset.totalInwardSGST) || 0;
        const totalInwardIGST = parseFloat(output.dataset.totalInwardIGST) || 0;
        const netCGST = parseFloat(output.dataset.netCGST) || 0;
        const netSGST = parseFloat(output.dataset.netSGST) || 0;
        const netIGST = parseFloat(output.dataset.netIGST) || 0;
        const netTotalTax = parseFloat(output.dataset.netTotalTax) || 0;

        const profile = getProfile();
        const printHtml = `
            <!DOCTYPE html>
            <html><head><meta charset="UTF-8"><title>GST Summary - ${periodLabel}</title>
            <style>
                body { font-family: 'Inter', Arial, sans-serif; margin: 20px; color: #111827; background: #fff; }
                .container { max-width: 1100px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #4f46e5; padding-bottom: 15px; }
                .header h1 { margin: 0; font-size: 28px; color: #4f46e5; }
                .header p { margin: 5px 0; font-size: 12px; color: #6b7280; }
                h2 { margin-top: 30px; }
                .stat-row { display: flex; flex-wrap: wrap; gap: 10px; margin: 15px 0; }
                .stat-card { border: 1px solid #e5e7eb; padding: 12px 16px; border-radius: 6px; flex: 1; min-width: 120px; background: #f9fafb; }
                .stat-value { font-size: 1.8rem; font-weight: 700; }
                .stat-label { font-size: 0.7rem; text-transform: uppercase; color: #6b7280; }
                table { width: 100%; border-collapse: collapse; font-size: 0.75rem; margin: 15px 0; }
                th { background: #4f46e5; color: #fff; padding: 8px 10px; text-align: left; }
                td { padding: 6px 10px; border: 1px solid #e5e7eb; }
                .text-right { text-align: right; }
                tfoot td { font-weight: bold; background: #f3f4f6; }
                .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; }
                @media print { body { padding: 0; } .container { border: none; } }
            </style>
            </head>
            <body>
            <div class="container">
                <div class="header">
                    <h1>${escapeHtml(profile.businessName)}</h1>
                    <p>${escapeHtml(profile.address)}, ${escapeHtml(profile.city)}, ${escapeHtml(profile.state)} - ${escapeHtml(profile.pincode)}<br>GSTIN: ${escapeHtml(profile.gstin)}</p>
                    <h2>GST Summary: ${periodLabel}</h2>
                </div>

                <div class="stat-row">
                    <div class="stat-card"><div class="stat-value">${formatCurrency(totalOutwardTaxable)}</div><div class="stat-label">Outward Taxable</div></div>
                    <div class="stat-card"><div class="stat-value">${formatCurrency(totalOutwardCGST+totalOutwardSGST+totalOutwardIGST)}</div><div class="stat-label">Outward Tax</div></div>
                    <div class="stat-card"><div class="stat-value">${formatCurrency(totalInwardTaxable)}</div><div class="stat-label">Inward Taxable</div></div>
                    <div class="stat-card"><div class="stat-value">${formatCurrency(totalInwardCGST+totalInwardSGST+totalInwardIGST)}</div><div class="stat-label">Inward Tax</div></div>
                </div>
                <div class="stat-row">
                    <div class="stat-card" style="background:${netTotalTax >= 0 ? '#fef2f2' : '#ecfdf5'};">
                        <div class="stat-value" style="color:${netTotalTax >= 0 ? '#dc2626' : '#10b981'};">${formatCurrency(netTotalTax)}</div>
                        <div class="stat-label">${netTotalTax >= 0 ? 'Net GST Payable' : 'Net GST Refundable'}</div>
                    </div>
                    <div class="stat-card"><div class="stat-value">${formatCurrency(netCGST)}</div><div class="stat-label">Net CGST</div></div>
                    <div class="stat-card"><div class="stat-value">${formatCurrency(netSGST)}</div><div class="stat-label">Net SGST</div></div>
                    <div class="stat-card"><div class="stat-value">${formatCurrency(netIGST)}</div><div class="stat-label">Net IGST</div></div>
                </div>

                <h3>Outward Supplies (Invoices)</h3>
                <table>
                    <thead><tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>GSTIN</th><th>Items</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th></tr></thead>
                    <tbody>${outwardRows || '<tr><td colspan="10" class="text-center">No invoices.</td></tr>'}</tbody>
                    ${outwardRows ? `<tfoot><tr><td colspan="5" class="text-right">Totals</td><td class="text-right">${formatCurrency(totalOutwardTaxable)}</td><td class="text-right">${formatCurrency(totalOutwardCGST)}</td><td class="text-right">${formatCurrency(totalOutwardSGST)}</td><td class="text-right">${formatCurrency(totalOutwardIGST)}</td><td class="text-right">${formatCurrency(totalOutwardTaxable + totalOutwardCGST + totalOutwardSGST + totalOutwardIGST)}</td></tr></tfoot>` : ''}
                </table>

                <h3>Inward Supplies (Purchase Orders)</h3>
                <table>
                    <thead><tr><th>PO #</th><th>Date</th><th>Supplier</th><th>GSTIN</th><th>Items</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th></tr></thead>
                    <tbody>${inwardRows || '<tr><td colspan="10" class="text-center">No purchase orders.</td></tr>'}</tbody>
                    ${inwardRows ? `<tfoot><tr><td colspan="5" class="text-right">Totals</td><td class="text-right">${formatCurrency(totalInwardTaxable)}</td><td class="text-right">${formatCurrency(totalInwardCGST)}</td><td class="text-right">${formatCurrency(totalInwardSGST)}</td><td class="text-right">${formatCurrency(totalInwardIGST)}</td><td class="text-right">${formatCurrency(totalInwardTaxable + totalInwardCGST + totalInwardSGST + totalInwardIGST)}</td></tr></tfoot>` : ''}
                </table>

                <div class="footer">This is a system generated GST summary. Generated on ${new Date().toLocaleString()}</div>
            </div>
            <script>window.print();<\/script>
            </body></html>
        `;
        const win = window.open('', '_blank');
        win.document.write(printHtml);
        win.document.close();
    }

    // ---------- NEW: Notepad Module ----------
    async function renderNotepad() {
        const notes = await dbGetAll('notes');
        notes.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

        let listHtml = notes.map(n => `
            <div class="note-card" data-id="${n.id}">
                <div class="note-card-title">${escapeHtml(n.title || 'Untitled')}</div>
                <div class="note-card-preview">${escapeHtml((n.content || '').substring(0, 80))}</div>
                <div class="note-card-date">${n.updatedAt ? new Date(n.updatedAt).toLocaleString() : new Date(n.createdAt).toLocaleString()}</div>
            </div>
        `).join('');

        const html = `
            <div class="page-header"><h1 class="page-title">Notepad</h1><button class="btn btn-primary" id="newNoteBtn">${iconSvg('plus')} New Note</button></div>
            <div class="card" style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; align-items: start;">
                <div>
                    <h3>Your Notes</h3>
                    <div class="notes-grid" id="notesList">
                        ${listHtml || '<p style="color:#6b7280;">No notes yet. Create one!</p>'}
                    </div>
                </div>
                <div>
                    <h3 id="noteEditorTitle">New Note</h3>
                    <form id="noteForm">
                        <div class="form-group">
                            <label>Title</label>
                            <input type="text" id="noteTitle" placeholder="Note title" required>
                        </div>
                        <div class="form-group">
                            <label>Content</label>
                            <textarea id="noteContent" rows="10" placeholder="Write your note here..." style="width:100%;"></textarea>
                        </div>
                        <div style="display:flex; gap:8px; margin-top:10px;">
                            <button type="submit" class="btn btn-primary">Save</button>
                            <button type="button" class="btn btn-danger" id="deleteNoteBtn">${iconSvg('trash')} Delete</button>
                            <button type="button" class="btn btn-outline" id="clearNoteBtn">Clear</button>
                        </div>
                        <input type="hidden" id="editNoteId" value="">
                    </form>
                </div>
            </div>
        `;
        mainContent.innerHTML = html;

        const notesList = document.getElementById('notesList');
        const noteTitle = document.getElementById('noteTitle');
        const noteContent = document.getElementById('noteContent');
        const editId = document.getElementById('editNoteId');
        const noteForm = document.getElementById('noteForm');
        const deleteBtn = document.getElementById('deleteNoteBtn');
        const clearBtn = document.getElementById('clearNoteBtn');
        const newNoteBtn = document.getElementById('newNoteBtn');

        function loadNote(note) {
            noteTitle.value = note.title || '';
            noteContent.value = note.content || '';
            editId.value = note.id || '';
            document.getElementById('noteEditorTitle').textContent = note.id ? 'Edit Note' : 'New Note';
        }

        function clearEditor() {
            noteTitle.value = '';
            noteContent.value = '';
            editId.value = '';
            document.getElementById('noteEditorTitle').textContent = 'New Note';
        }

        // Click on note card to load
        notesList.addEventListener('click', async (e) => {
            const card = e.target.closest('.note-card');
            if (!card) return;
            const id = Number(card.dataset.id);
            const note = await dbGetById('notes', id);
            if (note) loadNote(note);
        });

        // Save note
        noteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = noteTitle.value.trim() || 'Untitled';
            const content = noteContent.value.trim();
            const id = editId.value ? Number(editId.value) : null;
            const now = new Date().toISOString();
            const noteObj = { title, content, updatedAt: now };
            if (id) {
                noteObj.id = id;
                const existing = await dbGetById('notes', id);
                noteObj.createdAt = existing.createdAt || now;
                await dbPut('notes', noteObj);
                showToast('Note updated', 'success');
            } else {
                noteObj.createdAt = now;
                await dbAdd('notes', noteObj);
                showToast('Note created', 'success');
            }
            await renderNotepad();
        });

        // Delete note
        deleteBtn.addEventListener('click', async () => {
            const id = editId.value;
            if (!id) { showToast('No note selected to delete', 'warning'); return; }
            if (confirm('Delete this note?')) {
                await dbDelete('notes', Number(id));
                showToast('Note deleted', 'info');
                await renderNotepad();
            }
        });

        // Clear editor
        clearBtn.addEventListener('click', clearEditor);

        // New note
        newNoteBtn.addEventListener('click', () => {
            clearEditor();
            document.getElementById('noteEditorTitle').textContent = 'New Note';
            noteTitle.focus();
        });

        // If no notes, show empty editor
        if (!notes.length) clearEditor();
    }

    // ---- Start app ----
    openDB().then(async () => {
        updateOnlineStatus();
        registerServiceWorker();
        initGoogleDriveModule().catch(err => console.warn('Drive init background error:', err));
        initializeLocalFileSync().catch(err => console.warn('Local file sync init error:', err));
        await loadSyncTimestamps();
        updateRealTimeSyncUI();
        navigateTo('invoices');
        scheduleVersionCheck();
    }).catch(err => {
        console.error('IndexedDB error:', err);
        document.getElementById('mainContent').innerHTML = `
            <div class="card">
                <h3>⚠️ Database Error</h3>
                <p>Unable to load the local database. Please check your browser settings and ensure storage is enabled.</p>
                <p><strong>Error details:</strong> ${err.message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Reload Page</button>
            </div>
        `;
    });

})();