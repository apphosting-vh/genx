// app-core.js - GenFin Modern Edition (Profit Tracking & Reporting)
// WITH PERSISTENT OAUTH, FOLDER CACHING, UPSERT BACKUP, DISCONNECT, REFINED UI,
// SYNC STATUS INDICATOR, RETRY-ON-401, SMART AUTO-BACKUP
(function() {
    'use strict';

    // ---------- IndexedDB wrapper ----------
    const DB_NAME = 'GenFinDB';
    const DB_VERSION = 5;
    let db;

    const stores = ['customers', 'suppliers', 'products', 'invoices', 'purchaseOrders', 'expenses', 'settings'];

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
                scheduleAutoBackup();
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
                scheduleAutoBackup();
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
                scheduleAutoBackup();
            };
            request.onerror = () => reject(request.error);
        });
    }

    function dbClearStore(storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => {
                resolve();
                scheduleAutoBackup();
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ---------- Settings helpers for token storage ----------
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

    // ---------- Google Drive Backup Module (FULLY FIXED) ----------
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
    let initPromise = null; // for concurrency control

    const GD_CLIENT_ID = '769525551930-5d645morj103efjqp7baq95b3629k38h.apps.googleusercontent.com';
    const GD_SCOPES = 'https://www.googleapis.com/auth/drive.file';
    const GD_APP_FOLDER_NAME = 'GenFinBackups';
    const GD_BACKUP_FILENAME = 'genfin_latest_backup.json';

    // ---- Sync state machine ----
    const syncState = {
        status: 'disconnected',
        lastSuccessAt: null,
        lastAttemptAt: null,
        lastError: null,
        errorToastShown: false,
        recoveryToastShown: false,
    };

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
            showToast('⚠️ Drive sync error: ' + (error || 'Unknown error'), 'error');
            syncState.errorToastShown = true;
        }
        if (newState === 'success' && prev === 'error') {
            if (!syncState.recoveryToastShown) {
                showToast('✅ Drive sync recovered', 'success');
                syncState.recoveryToastShown = true;
            }
            syncState.errorToastShown = false;
        }
        updateSettingsUI();
    }

    function setAccessToken(token) {
        accessToken = token;
        if (token && gapi && gapi.client) {
            gapi.client.setToken({ access_token: token });
        }
    }

    // ---- Proper token refresh with Promise ----
    async function refreshAccessToken() {
        if (!tokenClient) {
            throw new Error('Token client not available');
        }
        return new Promise((resolve, reject) => {
            const originalCallback = tokenClient.callback;
            tokenClient.callback = (resp) => {
                tokenClient.callback = originalCallback;
                if (resp.error) {
                    reject(new Error(resp.error));
                } else {
                    saveDriveToken(resp.access_token, resp.expires_in, currentDriveUserEmail)
                        .then(() => resolve(accessToken))
                        .catch(reject);
                }
            };
            tokenClient.requestAccessToken({ prompt: '' });
        });
    }

    async function withTokenRetry(fn, retry = true) {
        try {
            return await fn();
        } catch (err) {
            if (retry && err.status === 401) {
                console.warn('401 detected, attempting token refresh');
                setSyncState('expired');
                setAccessToken(null);
                try {
                    await refreshAccessToken();
                    return await fn();
                } catch (refreshErr) {
                    setSyncState('disconnected', 'Token refresh failed');
                    throw refreshErr;
                }
            }
            throw err;
        }
    }

    // ---- Token persistence ----
    async function saveDriveToken(token, expiresIn, email) {
        setAccessToken(token);
        const expiry = Date.now() + (expiresIn * 1000);
        tokenExpiry = expiry;
        currentDriveUserEmail = email || '';
        await dbSetSetting('gdrive_token', token);
        await dbSetSetting('gdrive_expiry', expiry);
        await dbSetSetting('gdrive_email', currentDriveUserEmail);
        scheduleTokenRefresh(expiry);
        setSyncState('idle');
        scheduleAutoBackup();
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
        if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
        await dbDeleteSetting('gdrive_token');
        await dbDeleteSetting('gdrive_expiry');
        await dbDeleteSetting('gdrive_email');
        setSyncState('disconnected');
        updateDriveUI(false);
        stopAutoBackup();
    }

    function scheduleTokenRefresh(expiry) {
        if (refreshTimer) clearTimeout(refreshTimer);
        const now = Date.now();
        const timeUntilExpiry = expiry - now;
        const refreshIn = Math.max(0, timeUntilExpiry - 5 * 60 * 1000);
        if (refreshIn > 0) {
            refreshTimer = setTimeout(async () => {
                if (accessToken && tokenClient) {
                    try {
                        await refreshAccessToken();
                    } catch (err) {
                        console.warn('Silent token refresh failed:', err);
                    }
                }
            }, refreshIn);
        } else if (tokenClient) {
            refreshAccessToken().catch(console.warn);
        }
    }

    // ---- Google API init (fully retryable) ----
    async function initGoogleDriveModule(force = false) {
        if (driveInitialized && !force) return;
        if (initPromise) return initPromise;

        initPromise = (async () => {
            try {
                console.log('Initializing Google Drive module...');
                await waitForGlobalObjects();
                await initGoogleAPI();
                await initGIS();
                // Restore stored token
                const stored = await loadDriveToken();
                if (stored.token && stored.expiry) {
                    const now = Date.now();
                    if (stored.expiry > now) {
                        setAccessToken(stored.token);
                        tokenExpiry = stored.expiry;
                        currentDriveUserEmail = stored.email || '';
                        updateDriveUI(true);
                        scheduleTokenRefresh(tokenExpiry);
                        fetchDriveUserEmail();
                        setSyncState('idle');
                        scheduleAutoBackup();
                        console.log('Drive token restored from DB');
                    } else {
                        console.log('Drive token expired – attempting silent refresh');
                        if (tokenClient) {
                            await refreshAccessToken();
                        } else {
                            throw new Error('tokenClient not ready');
                        }
                    }
                }
                driveInitialized = true;
                driveInitFailed = false;
                console.log('Google Drive module ready');
            } catch (err) {
                driveInitFailed = true;
                console.warn('Google Drive init failed:', err);
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
                    // Do NOT pass clientId and scope here – handled by GIS token client.
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
                            // Set token first so email fetch can use it
                            setAccessToken(resp.access_token);
                            const email = await fetchDriveUserEmail();
                            await saveDriveToken(resp.access_token, resp.expires_in, email);
                            updateDriveUI(true);
                            showToast('Connected to Google Drive', 'success');
                        } catch (e) {
                            // If email fetch fails, still save token
                            await saveDriveToken(resp.access_token, resp.expires_in, '');
                            updateDriveUI(true);
                            showToast('Connected (email not available)', 'success');
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
        if (!accessToken) return '';
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            const data = await res.json();
            if (data.email) {
                currentDriveUserEmail = data.email;
                const emailSpan = document.getElementById('driveUserEmail');
                if (emailSpan) emailSpan.textContent = currentDriveUserEmail;
                return data.email;
            }
        } catch (err) {
            console.warn('Could not fetch user email', err);
        }
        return '';
    }

    // ---- Sign-in with robust error handling ----
    function signInToGoogle() {
        console.log('signInToGoogle called');
        try {
            // If not initialized or failed, force a fresh initialization
            if (!driveInitialized || driveInitFailed) {
                initGoogleDriveModule(true)
                    .then(() => {
                        console.log('Init successful, requesting token...');
                        if (tokenClient) {
                            tokenClient.requestAccessToken({ prompt: 'consent' });
                        } else {
                            showToast('Token client not available after init', 'error');
                        }
                    })
                    .catch(err => {
                        console.error('Init failed:', err);
                        showToast('Failed to initialize Google Drive: ' + err.message, 'error');
                    });
            } else {
                // Already initialized, just request token
                if (tokenClient) {
                    tokenClient.requestAccessToken({ prompt: 'consent' });
                } else {
                    showToast('Token client not available', 'error');
                }
            }
        } catch (err) {
            console.error('Error in signInToGoogle:', err);
            showToast('Error connecting to Google Drive: ' + err.message, 'error');
        }
    }

    // ---- Drive folder caching ----
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

    async function getLatestBackupFileId() {
        if (!accessToken) return null;
        const folderId = await ensureBackupFolder();
        const response = await withTokenRetry(() =>
            gapi.client.drive.files.list({
                q: `'${folderId}' in parents and name='${GD_BACKUP_FILENAME}' and trashed=false`,
                fields: 'files(id, name)',
            })
        );
        if (response.result.files.length > 0) {
            lastBackupFileId = response.result.files[0].id;
            return lastBackupFileId;
        }
        return null;
    }

    async function uploadBackupToDrive(showToastMsg = true) {
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
            const profile = getProfile();
            const backupData = {
                version: 1,
                timestamp: new Date().toISOString(),
                profile, customers, suppliers, products,
                invoices, purchaseOrders, expenses,
            };
            const jsonStr = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });

            let fileId = await getLatestBackupFileId();
            let uploadUrl, method;
            let metadata = {
                name: GD_BACKUP_FILENAME,
                parents: [folderId],
            };
            if (fileId) {
                uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
                method = 'PATCH';
            } else {
                uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
                method = 'POST';
            }

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            const response = await withTokenRetry(async () => {
                const res = await fetch(uploadUrl, {
                    method: method,
                    headers: { Authorization: `Bearer ${accessToken}` },
                    body: form,
                });
                if (!res.ok) throw new Error('Upload failed: ' + res.status);
                return res;
            });

            const result = await response.json();
            lastBackupFileId = result.id;

            localStorage.setItem('genfin_last_backup', new Date().toISOString());
            setSyncState('success');
            updateLastBackupUI();
            if (showToastMsg) showToast('Backup uploaded to Google Drive', 'success');
            updateViewBackupLink(result.id);
            return true;
        } catch (err) {
            console.error(err);
            setSyncState('error', err.message);
            if (showToastMsg) showToast('Backup upload failed: ' + err.message, 'error');
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
        if (!backupData.version || !backupData.profile ||
            !backupData.customers || !backupData.suppliers || !backupData.products ||
            !backupData.invoices || !backupData.purchaseOrders || !backupData.expenses) {
            throw new Error('Invalid backup file format');
        }
        const confirmMsg = '⚠️ WARNING: This will replace ALL existing data (customers, suppliers, products, invoices, purchase orders, expenses, and business profile).\n\nAre you absolutely sure you want to proceed?';
        if (!confirm(confirmMsg)) return false;

        showToast('Restoring backup, please wait...', 'info');
        for (const storeName of stores) {
            await dbClearStore(storeName);
        }
        for (const customer of backupData.customers) await dbAdd('customers', customer);
        for (const supplier of backupData.suppliers) await dbAdd('suppliers', supplier);
        for (const product of backupData.products) await dbAdd('products', product);
        for (const invoice of backupData.invoices) await dbAdd('invoices', invoice);
        for (const po of backupData.purchaseOrders) await dbAdd('purchaseOrders', po);
        for (const expense of backupData.expenses) await dbAdd('expenses', expense);
        saveProfile(backupData.profile);
        showToast('Backup restored successfully!', 'success');
        navigateTo('dashboard');
        return true;
    }

    async function showRestoreDialog() {
        if (!accessToken) {
            showToast('Not connected to Google Drive', 'error');
            return;
        }
        try {
            const files = await listDriveBackups();
            if (!files.length) {
                showToast('No backup files found in your GenFinBackups folder', 'info');
                return;
            }
            const modalHtml = `
                <div class="modal-overlay" id="restoreModal">
                    <div class="modal">
                        <button class="modal-close" id="closeRestoreModal">✕</button>
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
        if (confirm('Disconnect from Google Drive? This will clear your stored authentication.')) {
            await clearDriveToken();
            updateDriveUI(false);
            showToast('Disconnected from Google Drive', 'info');
            const currentPage = document.querySelector('.nav-item.active')?.dataset?.page;
            if (currentPage === 'settings') await renderSettings();
        }
    }

    function updateDriveUI(connected) {
        const authPanel = document.getElementById('gdriveAuthPanel');
        const actionsDiv = document.getElementById('gdriveActions');
        const statusSpan = document.getElementById('gdriveStatus');
        const disconnectBtn = document.getElementById('gdriveDisconnectBtn');
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
        } else {
            authPanel.style.display = 'block';
            actionsDiv.style.display = 'none';
            statusSpan.innerHTML = driveInitFailed ? 'Drive service unavailable – check your connection or client ID' : 'Not connected';
            if (disconnectBtn) disconnectBtn.style.display = 'none';
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

    // ---- Global sync indicator ----
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
        const status = syncState.status;
        let icon = '☁️';
        let color = '#6b7280';
        let tooltip = 'Not connected';
        switch (status) {
            case 'idle': color = '#6b7280'; tooltip = 'Connected, idle'; break;
            case 'syncing': icon = '⏳'; color = '#f59e0b'; tooltip = 'Syncing...'; break;
            case 'success': icon = '✅'; color = '#10b981'; tooltip = 'Last sync: ' + (syncState.lastSuccessAt ? new Date(syncState.lastSuccessAt).toLocaleString() : 'never'); break;
            case 'error': icon = '❌'; color = '#ef4444'; tooltip = 'Sync error: ' + (syncState.lastError || 'unknown'); break;
            case 'expired': icon = '🕒'; color = '#f59e0b'; tooltip = 'Token expired – refreshing'; break;
            default: color = '#6b7280'; tooltip = 'Not connected'; break;
        }
        indicator.innerHTML = `<span style="color:${color};">${icon}</span>`;
        indicator.title = tooltip;
        updateSettingsUI();
    }

    // ---- Auto-backup scheduling ----
    let autoBackupInterval = null;
    let backupDebounceTimer = null;
    let backupFrequency = 30;

    function loadBackupFrequency() {
        const stored = localStorage.getItem('gdrive_backup_frequency');
        if (stored) {
            const val = parseInt(stored);
            if (val > 0) backupFrequency = val;
        }
    }
    loadBackupFrequency();

    function stopAutoBackup() {
        if (autoBackupInterval) { clearInterval(autoBackupInterval); autoBackupInterval = null; }
        if (backupDebounceTimer) { clearTimeout(backupDebounceTimer); backupDebounceTimer = null; }
    }

    function scheduleAutoBackup() {
        const autoEnabled = localStorage.getItem('gdrive_auto_backup') === 'true';
        const connected = accessToken != null;
        if (!autoEnabled || !connected) {
            stopAutoBackup();
            return;
        }
        if (backupDebounceTimer) clearTimeout(backupDebounceTimer);
        backupDebounceTimer = setTimeout(async () => {
            await uploadBackupToDrive(false);
            backupDebounceTimer = null;
        }, 30000);

        if (autoBackupInterval) clearInterval(autoBackupInterval);
        const intervalMs = backupFrequency * 60 * 1000;
        autoBackupInterval = setInterval(async () => {
            if (accessToken) {
                await uploadBackupToDrive(false);
            }
        }, intervalMs);
    }

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
                case 'expired': dotColor = '#f59e0b'; label = 'Token Expiring Soon'; break;
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
        nextInvoiceNumber: 1,
        nextPONumber: 1
    };

    function getProfile() {
        const stored = localStorage.getItem('genfin_profile');
        return stored ? JSON.parse(stored) : { ...defaultProfile };
    }

    function saveProfile(profile) {
        localStorage.setItem('genfin_profile', JSON.stringify(profile));
    }

    function getNextInvoiceNumber() {
        const profile = getProfile();
        const num = profile.nextInvoiceNumber || 1;
        const padded = String(num).padStart(3, '0');
        return profile.invoicePrefix + padded;
    }

    function incrementInvoiceNumber() {
        const profile = getProfile();
        profile.nextInvoiceNumber = (profile.nextInvoiceNumber || 1) + 1;
        saveProfile(profile);
    }

    function getNextPONumber() {
        const profile = getProfile();
        const num = profile.nextPONumber || 1;
        const padded = String(num).padStart(3, '0');
        return 'PO-' + padded;
    }

    function incrementPONumber() {
        const profile = getProfile();
        profile.nextPONumber = (profile.nextPONumber || 1) + 1;
        saveProfile(profile);
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
                selectedGstRate: it.selectedGstRate || 18
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
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
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
    }

    async function renderPage(page) {
        try {
            switch (page) {
                case 'dashboard': await renderDashboard(); break;
                case 'invoices': await renderInvoices(); break;
                case 'purchase-orders': await renderPurchaseOrders(); break;
                case 'expenses': await renderExpenses(); break;
                case 'customers': await renderCustomers(); break;
                case 'suppliers': await renderSuppliers(); break;
                case 'products': await renderProducts(); break;
                case 'reports': await renderReports(); break;
                case 'profile': renderProfile(); break;
                case 'settings': await renderSettings(); break;
                default: await renderDashboard();
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
            } else {
                statusDot.className = 'status-dot offline';
                offlineIndicator.textContent = 'Offline';
            }
        }
    }

    // ---------- Dashboard ----------
    async function renderDashboard() {
        try {
            const invoices = await dbGetAll('invoices');
            const expenses = await dbGetAll('expenses');
            const totalSales = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
            const pendingInvoices = invoices.filter(inv => inv.paymentStatus !== 'Paid').length;
            const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
            const profit = totalSales - totalExpenses;
            mainContent.innerHTML = `
                <div class="page-header"><h1 class="page-title">Dashboard</h1></div>
                <div class="stat-row">
                    <div class="stat-card"><div class="stat-value">${formatCurrency(totalSales)}</div><div class="stat-label">Total Sales</div></div>
                    <div class="stat-card"><div class="stat-value">${pendingInvoices}</div><div class="stat-label">Pending Invoices</div></div>
                    <div class="stat-card"><div class="stat-value">${formatCurrency(totalExpenses)}</div><div class="stat-label">Total Expenses</div></div>
                    <div class="stat-card"><div class="stat-value">${formatCurrency(profit)}</div><div class="stat-label">Net Profit</div></div>
                </div>
                <div class="card"><h3>Quick Overview</h3><p>Use sidebar to manage invoices, POs, expenses, contacts, and run reports.</p></div>
            `;
        } catch (err) {
            showToast('Failed to load dashboard', 'error');
            mainContent.innerHTML = '<div class="card">Unable to load dashboard data.</div>';
        }
    }

    // ---------- Constants ----------
    const GST_SLABS = [0, 5, 12, 18, 28];
    const PAYMENT_TERMS = ['Immediate', 'Net 15 Days', 'Net 30 Days', 'Net 45 Days', 'Net 60 Days', 'Net 90 Days'];
    const INVOICE_STATUSES = ['Unpaid', 'Paid', 'Overdue', 'Partially Paid'];
    const PRODUCT_TYPES = ['Product', 'Service'];
    const PO_STATUSES = ['Pending', 'Received', 'Cancelled'];

    function invoiceItemRow(item, idx, products) {
        const selectedProductId = item ? item.productId : (products[0]?.id || '');
        const productOptions = products.length ? products.map(p => `<option value="${p.id}" ${p.id == selectedProductId ? 'selected' : ''}>${escapeHtml(p.name)} (${p.type || 'Product'})</option>`).join('') : '<option disabled>No products found</option>';
        const rateValue = (item && item.rate) ? item.rate : '';
        return `
            <div class="invoice-item-row" style="display:flex; gap:8px; margin-bottom:6px; align-items:center; flex-wrap:wrap;">
                <select class="item-product" style="flex:2; min-width:120px;">${productOptions}</select>
                <input type="number" class="item-qty" placeholder="Qty" value="${item ? item.qty : 1}" step="1" style="width:70px;">
                <input type="number" class="item-rate" placeholder="Rate" value="${rateValue}" step="0.01" style="width:90px;">
                <select class="item-gst" style="width:80px;">${GST_SLABS.map(s => `<option value="${s}">${s}%</option>`).join('')}</select>
                <button type="button" class="btn btn-danger btn-xs remove-item-row">✕</button>
            </div>
        `;
    }

    function poItemRow(item, idx, products) {
        const selectedProductId = item ? item.productId : (products[0]?.id || '');
        const productOptions = products.length ? products.map(p => `<option value="${p.id}" ${p.id == selectedProductId ? 'selected' : ''}>${escapeHtml(p.name)} (${p.type || 'Product'})</option>`).join('') : '<option disabled>No products found</option>';
        const rateValue = (item && item.rate) ? item.rate : '';
        return `
            <div class="po-item-row" style="display:flex; gap:8px; margin-bottom:6px; align-items:center; flex-wrap:wrap;">
                <select class="item-product" style="flex:2; min-width:120px;">${productOptions}</select>
                <input type="number" class="item-qty" value="${item ? item.qty : 1}" step="1" style="width:70px;">
                <input type="number" class="item-rate" value="${rateValue}" step="0.01" style="width:90px;">
                <select class="item-gst" style="width:80px;">${GST_SLABS.map(s => `<option value="${s}">${s}%</option>`).join('')}</select>
                <button type="button" class="btn btn-danger btn-xs remove-row">✕</button>
            </div>
        `;
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
                    <div class="page-header"><h1 class="page-title">Invoices</h1><button class="btn btn-primary" id="addInvoiceBtn">+ New Invoice</button></div>
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
                                <button class="btn btn-danger btn-sm delete-invoice" data-id="${inv.id}">Del</button>
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
            };
            
            const applyFilter = () => {
                fromDate = document.getElementById('invFromDate').value;
                toDate = document.getElementById('invToDate').value;
                filteredInvoices = filterByDateRange(allInvoices, fromDate, toDate);
                renderTable();
            };
            const clearFilter = () => {
                fromDate = '';
                toDate = '';
                filteredInvoices = [...allInvoices];
                renderTable();
            };
            
            filteredInvoices = [...allInvoices];
            renderTable();
            setTimeout(() => {
                const applyBtn = document.getElementById('applyInvFilter');
                const clearBtn = document.getElementById('clearInvFilter');
                if (applyBtn) applyBtn.addEventListener('click', applyFilter);
                if (clearBtn) clearBtn.addEventListener('click', clearFilter);
            }, 0);
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
                    <table border="1" cellpadding="6" style="width:100%; border-collapse:collapse;">
                        <thead><tr><th>Item</th><th>HSN</th><th>Qty</th><th>Rate</th><th>GST</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th></tr></thead>
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
                        <button class="modal-close" id="closeViewInvModal">✕</button>
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

    // Professional PDF Export for Invoices
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
                        th { background: #f3f4f6; padding: 10px 8px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb; }
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
                        <button class="modal-close" id="closeInvoiceModal">✕</button>
                        <h3>${title}</h3>
                        <form id="invoiceForm">
                            <div class="form-grid">
                                <div class="form-group"><label>Invoice Number</label><input type="text" id="invNumber" value="${isEdit ? invoiceData.invoiceNumber : getNextInvoiceNumber()}" ${isEdit ? '' : 'readonly'}></div>
                                <div class="form-group"><label>Date</label><input type="date" id="invDate" value="${defDate}"></div>
                                <div class="form-group"><label>Customer</label><select id="invCustomer">${customers.map(c => `<option value="${c.id}" ${isEdit && invoiceData.customerId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select></div>
                                <div class="form-group"><label>Payment Terms</label><select id="invPaymentTerms">${PAYMENT_TERMS.map(term => `<option value="${term}" ${term === defTerms ? 'selected' : ''}>${term}</option>`).join('')}</select></div>
                                <div class="form-group"><label>Due Date (auto)</label><input type="date" id="invDueDate" readonly value="${defDueDate}"></div>
                                <div class="form-group"><label>Payment Status</label><select id="invStatus">${INVOICE_STATUSES.map(s => `<option value="${s}" ${s === defStatus ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
                            </div>
                            <h4 style="margin-top:16px;">Items</h4>
                            <div id="invoiceItemsContainer">${(isEdit ? invoiceData.items : []).map((item, idx) => invoiceItemRow(item, idx, products)).join('')}</div>
                            <button type="button" class="btn btn-outline btn-sm" id="addInvoiceItem">+ Add Item</button>
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
                    const gst = parseFloat(row.querySelector('.item-gst').value) || 18;
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
                    const itemsRaw = [];
                    document.querySelectorAll('.invoice-item-row').forEach(row => {
                        itemsRaw.push({
                            productId: row.querySelector('.item-product').value,
                            qty: parseFloat(row.querySelector('.item-qty').value) || 0,
                            rate: parseFloat(row.querySelector('.item-rate').value) || 0,
                            selectedGstRate: parseFloat(row.querySelector('.item-gst').value) || 18
                        });
                    });
                    const customerId = Number(customerSelect.value);
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
                    else { await dbAdd('invoices', invoiceObj); incrementInvoiceNumber(); }
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
                let html = `<div class="page-header"><h1 class="page-title">Purchase Orders</h1><button class="btn btn-primary" id="addPOBtn">+ New PO</button></div>
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
                            <button class="btn btn-primary btn-sm export-po" data-id="${po.id}">PDF</button>${statusActions}<button class="btn btn-danger btn-sm delete-po" data-id="${po.id}">Del</button></td></tr>`;
                });
                html += `</tbody></table></div></div>`;
                mainContent.innerHTML = html;
                document.getElementById('addPOBtn')?.addEventListener('click', () => showPOModal());
                document.querySelectorAll('.view-po').forEach(btn => btn.addEventListener('click', () => showPOViewModal(Number(btn.dataset.id))));
                document.querySelectorAll('.edit-po').forEach(btn => btn.addEventListener('click', async () => { const po = await dbGetById('purchaseOrders', Number(btn.dataset.id)); if (po) showPOModal(po); }));
                document.querySelectorAll('.export-po').forEach(btn => btn.addEventListener('click', () => exportPOPDF(Number(btn.dataset.id))));
                document.querySelectorAll('.mark-received-btn, .mark-cancelled-btn, .mark-pending-btn').forEach(btn => btn.addEventListener('click', async () => { await updatePOStatus(Number(btn.dataset.id), btn.dataset.status); await renderPurchaseOrders(); }));
                document.querySelectorAll('.delete-po').forEach(btn => btn.addEventListener('click', async () => { if (confirm('Delete this PO?')) { await dbDelete('purchaseOrders', Number(btn.dataset.id)); await renderPurchaseOrders(); } }));
            };
            const apply = () => { fromDate = document.getElementById('poFromDate').value; toDate = document.getElementById('poToDate').value; filteredPOs = filterByDateRange(allPOs, fromDate, toDate); renderTable(); };
            const clear = () => { fromDate = ''; toDate = ''; filteredPOs = [...allPOs]; renderTable(); };
            filteredPOs = [...allPOs];
            renderTable();
            setTimeout(() => { document.getElementById('applyPOFilter')?.addEventListener('click', apply); document.getElementById('clearPOFilter')?.addEventListener('click', clear); }, 0);
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
                    <table border="1" cellpadding="6" style="width:100%; border-collapse:collapse;"><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>GST</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th></tr></thead>
                    <tbody>${po.items.map(i => `<tr><td>${escapeHtml(i.description)}</td><td class="text-right">${i.qty}</td><td class="text-right">${formatCurrency(i.rate)}</td><td class="text-center">${i.selectedGstRate}%</td><td class="text-right">${formatCurrency(i.taxable)}</td><td class="text-right">${formatCurrency(i.cgstAmt)}</td><td class="text-right">${formatCurrency(i.sgstAmt)}</td><td class="text-right">${formatCurrency(i.igstAmt)}</td><td class="text-right">${formatCurrency(i.total)}</td></tr>`).join('')}</tbody></table>
                    <p style="text-align:right;">Subtotal: ${formatCurrency(po.subtotal)}<br>Discount: ${formatCurrency(po.discount)}<br>Total Tax: ${formatCurrency(po.totalTax)}<br><strong>Grand Total: ${formatCurrency(po.grandTotal)}</strong></p>
                    <div style="margin-top:12px;"><label>Status:</label><select id="viewPOStatusSelect">${statusOptions}</select><button class="btn btn-primary btn-sm" id="updateViewPOStatusBtn">Update Status</button></div>
                </div>
            `;
            const modalContainer = document.getElementById('modalContainer');
            modalContainer.innerHTML = `<div class="modal-overlay" id="viewPOModalOverlay"><div class="modal" style="max-width:800px;"><button class="modal-close" id="closeViewPOModal">✕</button><div style="max-height:70vh; overflow-y:auto;">${content}</div><div style="text-align:right; margin-top:16px;"><button class="btn btn-secondary" id="editViewPOBtn">Edit</button><button class="btn btn-primary" id="printViewPOBtn">Print / Export PDF</button><button class="btn btn-outline" id="closeViewPOBtn2">Close</button></div></div></div>`;
            const close = () => { modalContainer.innerHTML = ''; };
            document.getElementById('closeViewPOModal').addEventListener('click', close);
            document.getElementById('closeViewPOBtn2').addEventListener('click', close);
            document.getElementById('viewPOModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) close(); });
            document.getElementById('printViewPOBtn').addEventListener('click', () => { exportPOPDF(id); });
            document.getElementById('editViewPOBtn').addEventListener('click', () => { close(); showPOModal(po); });
            document.getElementById('updateViewPOStatusBtn').addEventListener('click', async () => { const newStatus = document.getElementById('viewPOStatusSelect').value; await updatePOStatus(id, newStatus); close(); showPOViewModal(id); });
        } catch(err) { showToast('Error loading PO details', 'error'); }
    }

    // Professional PDF Export for Purchase Orders
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
                    th { background: #f3f4f6; padding: 10px 8px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb; }
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
            const modalHtml = `<div class="modal-overlay" id="poModalOverlay"><div class="modal"><button class="modal-close" id="closePOModal">✕</button><h3>${isEdit ? 'Edit' : 'New'} Purchase Order</h3>
                <form id="poForm"><div class="form-grid"><div class="form-group"><label>PO Number</label><input type="text" id="poNumber" value="${isEdit ? poData.poNumber : getNextPONumber()}" ${isEdit ? '' : 'readonly'}></div>
                <div class="form-group"><label>Date</label><input type="date" id="poDate" value="${isEdit ? poData.date : new Date().toISOString().split('T')[0]}"></div>
                <div class="form-group"><label>Supplier</label><select id="poSupplier">${suppliers.map(s => `<option value="${s.id}" ${isEdit && poData.supplierId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}</select></div>
                <div class="form-group"><label>Status</label><select id="poStatus">${PO_STATUSES.map(s => `<option value="${s}" ${s === defStatus ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
                <h4>Items</h4><div id="poItemsContainer">${(isEdit ? poData.items : []).map((it, idx) => poItemRow(it, idx, products)).join('')}</div>
                <button type="button" class="btn btn-outline btn-sm" id="addPOItem">+ Add Item</button>
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
                        rateInput.value = product.costPrice || 0;
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
                    const gst = parseFloat(row.querySelector('.item-gst').value) || 18;
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
                    const itemsRaw = [];
                    document.querySelectorAll('.po-item-row').forEach(row => {
                        itemsRaw.push({
                            productId: row.querySelector('.item-product').value,
                            qty: parseFloat(row.querySelector('.item-qty').value) || 0,
                            rate: parseFloat(row.querySelector('.item-rate').value) || 0,
                            selectedGstRate: parseFloat(row.querySelector('.item-gst').value) || 18
                        });
                    });
                    const supplierId = Number(supplierSelect.value);
                    const supplier = suppliers.find(s => s.id === supplierId);
                    const stateOfSupply = supplier ? supplier.state : profile.state;
                    const discount = parseFloat(document.getElementById('poDiscount').value) || 0;
                    const { items, subtotal, totalTax, grandTotal } = applyDiscountAndRecalcTaxes(itemsRaw, discount, stateOfSupply, profile.state, products);
                    const poObj = { poNumber: document.getElementById('poNumber').value, date: document.getElementById('poDate').value, supplierId, items, subtotal, discount, totalTax, grandTotal, status: document.getElementById('poStatus').value };
                    if (isEdit) { poObj.id = poData.id; await dbPut('purchaseOrders', poObj); } else { await dbAdd('purchaseOrders', poObj); incrementPONumber(); }
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
                    if (!rateInput.value || rateInput.value == 0) rateInput.value = product.costPrice || 0;
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
                let html = `<div class="page-header"><h1 class="page-title">Expenses</h1><button class="btn btn-primary" id="addExpenseBtn">+ Log Expense</button></div>
                <div class="card"><div class="filter-bar" style="display:flex;gap:12px;margin-bottom:20px;align-items:flex-end;">
                    <div class="form-group" style="margin-bottom:0;"><label>From Date</label><input type="date" id="expFromDate" value="${fromDate}"></div>
                    <div class="form-group" style="margin-bottom:0;"><label>To Date</label><input type="date" id="expToDate" value="${toDate}"></div>
                    <button class="btn btn-primary" id="applyExpFilter">Apply Filter</button><button class="btn btn-secondary" id="clearExpFilter">Clear</button>
                </div><div class="table-wrap"><table style="width:100%;"><thead><tr style="${TABLE_HEADER_STYLE}"><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Actions</th></tr></thead><tbody>`;
                filteredExpenses.sort((a,b)=>b.id - a.id).forEach(e => { html += `<tr><td>${formatDate(e.date)}</td><td>${escapeHtml(e.category)}</td><td>${escapeHtml(e.description)}</td><td>${formatCurrency(e.amount)}</td><td><button class="btn btn-danger btn-sm delete-expense" data-id="${e.id}">Del</button></td></tr>`; });
                if (!filteredExpenses.length) html += `<tr><td colspan="5" class="empty-state">No expenses in date range.</td></tr>`;
                html += `</tbody></table></div></div>`;
                mainContent.innerHTML = html;
                document.getElementById('addExpenseBtn')?.addEventListener('click', showExpenseModal);
                document.querySelectorAll('.delete-expense').forEach(b => b.addEventListener('click', async () => { await dbDelete('expenses', Number(b.dataset.id)); await renderExpenses(); }));
            };
            const apply = () => { fromDate = document.getElementById('expFromDate').value; toDate = document.getElementById('expToDate').value; filteredExpenses = filterByDateRange(allExpenses, fromDate, toDate); renderTable(); };
            const clear = () => { fromDate = ''; toDate = ''; filteredExpenses = [...allExpenses]; renderTable(); };
            filteredExpenses = [...allExpenses];
            renderTable();
            setTimeout(() => { document.getElementById('applyExpFilter')?.addEventListener('click', apply); document.getElementById('clearExpFilter')?.addEventListener('click', clear); }, 0);
        } catch(err) { showToast('Failed to load expenses', 'error'); }
    }

    async function showExpenseModal(expData = null) {
        try {
            const isEdit = !!expData;
            const modalHtml = `<div class="modal-overlay" id="expModalOverlay"><div class="modal"><button class="modal-close" id="closeExpModal">✕</button><h3>${isEdit ? 'Edit' : 'Log'} Expense</h3>
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
                let html = `<div class="page-header"><h1 class="page-title">Customers</h1><button class="btn btn-primary" id="addCustomerBtn">+ Add Customer</button></div>
                <div class="card"><div class="filter-bar" style="display:flex;gap:12px;margin-bottom:20px;align-items:flex-end;"><div class="form-group" style="margin-bottom:0;flex:1;"><label>Search by Name</label><input type="text" id="custSearch" value="${escapeHtml(searchTerm)}" placeholder="Type customer name..."></div>
                <button class="btn btn-primary" id="applyCustSearch">Search</button><button class="btn btn-secondary" id="clearCustSearch">Clear</button></div>
                <div class="table-wrap"><table style="width:100%;"><thead><tr style="${TABLE_HEADER_STYLE}"><th>Name</th><th>GSTIN</th><th>State</th><th>Phone</th><th>Actions</th></tr></thead><tbody>`;
                filteredCustomers.forEach(c => { html += `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.gstin)}</td><td>${escapeHtml(c.state)}</td><td>${escapeHtml(c.phone)}</td><td><button class="btn btn-outline btn-sm edit-customer" data-id="${c.id}">Edit</button> <button class="btn btn-danger btn-sm delete-customer" data-id="${c.id}">Del</button></td></tr>`; });
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
            const modalHtml = `<div class="modal-overlay" id="custModalOverlay"><div class="modal"><button class="modal-close" id="closeCustModal">✕</button><h3>${isEdit ? 'Edit' : 'Add'} Customer</h3>
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
                let html = `<div class="page-header"><h1 class="page-title">Suppliers</h1><button class="btn btn-primary" id="addSupplierBtn">+ Add Supplier</button></div>
                <div class="card"><div class="filter-bar" style="display:flex;gap:12px;margin-bottom:20px;align-items:flex-end;"><div class="form-group" style="margin-bottom:0;flex:1;"><label>Search by Name</label><input type="text" id="supSearch" value="${escapeHtml(searchTerm)}" placeholder="Type supplier name..."></div>
                <button class="btn btn-primary" id="applySupSearch">Search</button><button class="btn btn-secondary" id="clearSupSearch">Clear</button></div>
                <div class="table-wrap"><table style="width:100%;"><thead><tr style="${TABLE_HEADER_STYLE}"><th>Name</th><th>GSTIN</th><th>State</th><th>Phone</th><th>Actions</th></tr></thead><tbody>`;
                filteredSuppliers.forEach(s => { html += `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.gstin)}</td><td>${escapeHtml(s.state)}</td><td>${escapeHtml(s.phone)}</td><td><button class="btn btn-outline btn-sm edit-supplier" data-id="${s.id}">Edit</button> <button class="btn btn-danger btn-sm delete-supplier" data-id="${s.id}">Del</button></td></tr>`; });
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
            const modalHtml = `<div class="modal-overlay" id="supModalOverlay"><div class="modal"><button class="modal-close" id="closeSupModal">✕</button><h3>${isEdit ? 'Edit' : 'Add'} Supplier</h3>
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

    // ---------- Products ----------
    async function renderProducts() {
        try {
            const allProducts = await dbGetAll('products');
            let searchTerm = '';
            let filteredProducts = [...allProducts];
            const renderTable = () => {
                let html = `<div class="page-header"><h1 class="page-title">Products & Services</h1><button class="btn btn-primary" id="addProductBtn">+ Add Product</button></div>
                <div class="card"><div class="filter-bar" style="display:flex;gap:12px;margin-bottom:20px;align-items:flex-end;"><div class="form-group" style="margin-bottom:0;flex:1;"><label>Search by Name</label><input type="text" id="prodSearch" value="${escapeHtml(searchTerm)}" placeholder="Type product name..."></div>
                <button class="btn btn-primary" id="applyProdSearch">Search</button><button class="btn btn-secondary" id="clearProdSearch">Clear</button></div>
                <div class="table-wrap"><table style="width:100%;"><thead><tr style="${TABLE_HEADER_STYLE}"><th>Type</th><th>Name</th><th>HSN/SAC</th><th>Cost Price</th><th>Selling Price</th><th>GST%</th><th>Actions</th></tr></thead><tbody>`;
                filteredProducts.forEach(p => { html += `<tr><td>${escapeHtml(p.type||'Product')}</td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.hsnSacCode)}</td><td>${formatCurrency(p.costPrice||0)}</td><td>${formatCurrency(p.sellingPrice||0)}</td><td>${p.gstRate}%</td><td><button class="btn btn-outline btn-sm edit-product" data-id="${p.id}">Edit</button> <button class="btn btn-danger btn-sm delete-product" data-id="${p.id}">Del</button></td></tr>`; });
                if (!filteredProducts.length) html += `<tr><td colspan="7" class="empty-state">No products found.</td></tr>`;
                html += `</tbody></table></div></div>`;
                mainContent.innerHTML = html;
                document.getElementById('addProductBtn')?.addEventListener('click', () => showProductModal());
                document.querySelectorAll('.edit-product').forEach(b => b.addEventListener('click', async () => { const p = await dbGetById('products', Number(b.dataset.id)); showProductModal(p); }));
                document.querySelectorAll('.delete-product').forEach(b => b.addEventListener('click', async () => { await dbDelete('products', Number(b.dataset.id)); await renderProducts(); }));
            };
            const apply = () => { searchTerm = document.getElementById('prodSearch').value.trim().toLowerCase(); filteredProducts = allProducts.filter(p => p.name.toLowerCase().includes(searchTerm)); renderTable(); };
            const clear = () => { searchTerm = ''; filteredProducts = [...allProducts]; renderTable(); };
            filteredProducts = [...allProducts];
            renderTable();
            setTimeout(() => { document.getElementById('applyProdSearch')?.addEventListener('click', apply); document.getElementById('clearProdSearch')?.addEventListener('click', clear); }, 0);
        } catch(err) { showToast('Failed to load products', 'error'); }
    }

    async function showProductModal(prodData = null) {
        try {
            const isEdit = !!prodData;
            const modalHtml = `<div class="modal-overlay" id="prodModalOverlay"><div class="modal"><button class="modal-close" id="closeProdModal">✕</button><h3>${isEdit ? 'Edit' : 'Add'} Product/Service</h3>
                <form id="prodForm"><div class="form-grid"><div class="form-group"><label>Type</label><select id="prodType">${PRODUCT_TYPES.map(t => `<option value="${t}" ${isEdit && prodData.type === t ? 'selected' : (t === 'Product' && !isEdit ? 'selected' : '')}>${t}</option>`).join('')}</select></div>
                <div class="form-group"><label>Name *</label><input id="prodName" value="${isEdit ? escapeHtml(prodData.name) : ''}" required></div>
                <div class="form-group"><label>HSN/SAC Code</label><input id="prodHsn" value="${isEdit ? escapeHtml(prodData.hsnSacCode) : ''}"></div>
                <div class="form-group"><label>Cost Price (₹)</label><input type="number" step="0.01" id="prodCostPrice" value="${isEdit ? (prodData.costPrice || 0) : 0}"></div>
                <div class="form-group"><label>Selling Price (₹)</label><input type="number" step="0.01" id="prodSellingPrice" value="${isEdit ? (prodData.sellingPrice || 0) : 0}"></div>
                <div class="form-group"><label>GST %</label><input type="number" step="0.1" id="prodGst" value="${isEdit ? prodData.gstRate : 18}"></div>
                </div><button type="submit" class="btn btn-primary">Save</button></form></div></div>`;
            document.getElementById('modalContainer').innerHTML = modalHtml;
            const close = () => { document.getElementById('modalContainer').innerHTML = ''; };
            document.getElementById('closeProdModal').addEventListener('click', close);
            document.getElementById('prodModalOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) close(); });
            document.getElementById('prodForm').addEventListener('submit', async e => {
                e.preventDefault();
                try {
                    const obj = { type: document.getElementById('prodType').value, name: document.getElementById('prodName').value, hsnSacCode: document.getElementById('prodHsn').value, costPrice: parseFloat(document.getElementById('prodCostPrice').value)||0, sellingPrice: parseFloat(document.getElementById('prodSellingPrice').value)||0, gstRate: parseFloat(document.getElementById('prodGst').value)||18 };
                    if (isEdit) { obj.id = prodData.id; await dbPut('products', obj); } else await dbAdd('products', obj);
                    close(); await renderProducts(); showToast('Product saved', 'success');
                } catch(err) { showToast('Error saving product', 'error'); }
            });
        } catch(err) { showToast('Error opening product form', 'error'); }
    }

    // ---------- Business Profile ----------
    function renderProfile() {
        const p = getProfile();
        mainContent.innerHTML = `
            <div class="page-header"><h1 class="page-title">Business Profile</h1></div>
            <div class="card"><form id="profileForm">
                <div class="form-grid">
                    <div class="form-group"><label>Business Name</label><input id="bizName" value="${escapeHtml(p.businessName)}"></div>
                    <div class="form-group"><label>GSTIN</label><input id="bizGstin" value="${escapeHtml(p.gstin)}"></div>
                    <div class="form-group"><label>State</label><input id="bizState" value="${escapeHtml(p.state)}"></div>
                    <div class="form-group"><label>Invoice Prefix</label><input id="bizPrefix" value="${escapeHtml(p.invoicePrefix)}"></div>
                    <div class="form-group"><label>Next Invoice #</label><input type="number" id="bizNextInv" value="${p.nextInvoiceNumber}"></div>
                    <div class="form-group"><label>Next PO #</label><input type="number" id="bizNextPO" value="${p.nextPONumber}"></div>
                </div>
                <button type="submit" class="btn btn-primary" style="margin-top:12px;">Update Profile</button>
            </form></div>
        `;
        document.getElementById('profileForm').addEventListener('submit', e => {
            e.preventDefault();
            const updated = { ...getProfile() };
            updated.businessName = document.getElementById('bizName').value;
            updated.gstin = document.getElementById('bizGstin').value;
            updated.state = document.getElementById('bizState').value;
            updated.invoicePrefix = document.getElementById('bizPrefix').value;
            updated.nextInvoiceNumber = parseInt(document.getElementById('bizNextInv').value) || 1;
            updated.nextPONumber = parseInt(document.getElementById('bizNextPO').value) || 1;
            saveProfile(updated);
            showToast('Profile updated', 'success');
        });
    }

    // ---------- SETTINGS: Backup & Restore + Google Drive ----------
    async function renderSettings() {
        createSyncIndicator();
        updateGlobalSyncIndicator();

        mainContent.innerHTML = `
            <div class="page-header"><h1 class="page-title">Settings</h1></div>
            <div class="card">
                <h3>Local Backup & Restore</h3>
                <p style="margin-bottom: 16px; color: #6b7280;">Export all your business data as a JSON file, or restore from a previously saved backup.</p>
                <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                    <button class="btn btn-primary" id="exportBackupBtn">📥 Export Backup (JSON)</button>
                    <button class="btn btn-secondary" id="importBackupBtn">📤 Import Backup</button>
                    <input type="file" id="backupFileInput" accept=".json" style="display: none;">
                </div>
                <div style="margin-top: 24px; padding: 12px; background: #fef3c7; border-radius: 8px; font-size: 0.8rem; color: #92400e;">
                    ⚠️ Warning: Importing a backup will completely replace all existing data. Please ensure you have a current backup before proceeding.
                </div>
            </div>

            <div class="card">
                <h3>☁️ Google Drive Backup</h3>
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
                                    <option value="30" selected>30 min</option>
                                    <option value="60">1 hour</option>
                                    <option value="120">2 hours</option>
                                    <option value="240">4 hours</option>
                                </select>
                            </div>
                            <div style="margin-top: 6px;">
                                <label>
                                    <input type="checkbox" id="gdriveAutoBackup"> Enable automatic backup
                                </label>
                            </div>
                            <div style="margin-top: 6px;">
                                <a id="viewBackupLink" href="#" target="_blank" style="display:none;">📂 View latest backup in Drive</a>
                            </div>
                            <div style="margin-top: 8px; font-size:0.75rem; color:#6b7280; border-top:1px solid #e5e7eb; padding-top:8px;">
                                <strong>What gets backed up:</strong> All business data (customers, suppliers, products, invoices, purchase orders, expenses, and your business profile) in a single JSON file. The backup is stored as <code>genfin_latest_backup.json</code> in your <strong>GenFinBackups</strong> folder on Drive.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

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
        if (authBtn) authBtn.addEventListener('click', signInToGoogle);
        const reconnectBtn = document.getElementById('gdriveReconnectBtn');
        if (reconnectBtn) reconnectBtn.addEventListener('click', signInToGoogle);
        const backupBtn = document.getElementById('gdriveBackupBtn');
        if (backupBtn) backupBtn.addEventListener('click', () => uploadBackupToDrive(true));
        const restoreBtn = document.getElementById('gdriveRestoreBtn');
        if (restoreBtn) restoreBtn.addEventListener('click', showRestoreDialog);
        const disconnectBtn = document.getElementById('gdriveDisconnectBtn');
        if (disconnectBtn) disconnectBtn.addEventListener('click', disconnectDrive);

        const freqSelect = document.getElementById('backupFrequencySelect');
        if (freqSelect) {
            const current = localStorage.getItem('gdrive_backup_frequency') || '30';
            freqSelect.value = current;
            freqSelect.addEventListener('change', (e) => {
                const val = parseInt(e.target.value);
                if (val > 0) {
                    localStorage.setItem('gdrive_backup_frequency', String(val));
                    backupFrequency = val;
                    if (localStorage.getItem('gdrive_auto_backup') === 'true' && accessToken) {
                        scheduleAutoBackup();
                    }
                }
            });
        }

        const autoCheck = document.getElementById('gdriveAutoBackup');
        if (autoCheck) {
            autoCheck.checked = localStorage.getItem('gdrive_auto_backup') === 'true';
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

        updateDriveUI(!!accessToken);
        updateLastBackupUI();
        updateSettingsUI();
        if (accessToken) {
            fetchDriveUserEmail();
            if (lastBackupFileId) {
                updateViewBackupLink(lastBackupFileId);
            }
        }
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
            const profile = getProfile();
            const backupData = {
                version: 1,
                timestamp: new Date().toISOString(),
                profile: profile,
                customers: customers,
                suppliers: suppliers,
                products: products,
                invoices: invoices,
                purchaseOrders: purchaseOrders,
                expenses: expenses
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
                if (!backupData.version || !backupData.profile || 
                    !backupData.customers || !backupData.suppliers || !backupData.products ||
                    !backupData.invoices || !backupData.purchaseOrders || !backupData.expenses) {
                    throw new Error('Invalid backup file format');
                }
                const confirmMsg = '⚠️ WARNING: This will replace ALL existing data (customers, suppliers, products, invoices, purchase orders, expenses, and business profile).\n\nAre you absolutely sure you want to proceed?';
                if (!confirm(confirmMsg)) {
                    showToast('Import cancelled', 'info');
                    return;
                }
                showToast('Restoring backup, please wait...', 'info');
                for (const storeName of stores) {
                    await dbClearStore(storeName);
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
                saveProfile(backupData.profile);
                showToast('Backup restored successfully!', 'success');
                navigateTo('dashboard');
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

    // ---------- ENHANCED REPORTS (GST, Profit, and Monthly Trends) ----------
    let currentChart = null;
    let currentTrendChart = null;
    async function renderReports() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const html = `
            <div class="page-header"><h1 class="page-title">Reports</h1></div>
            <div class="card">
                <div style="display: flex; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid var(--border);">
                    <button class="btn btn-outline" id="tabGST">GST Summary</button>
                    <button class="btn btn-outline" id="tabProfit">Profitability</button>
                    <button class="btn btn-outline" id="tabTrends">Monthly Trends</button>
                </div>
                <div id="reportControls" class="form-grid" style="margin-bottom:16px;">
                    <div class="form-group"><label>Period</label><select id="reportPeriod"><option value="Weekly">Weekly</option><option value="Monthly">Monthly</option><option value="Quarterly">Quarterly</option><option value="Half-Yearly">Half-Yearly</option><option value="Yearly" selected>Yearly</option></select></div>
                    <div class="form-group"><label>Year</label><input type="number" id="reportYear" value="${currentYear}" style="width:100px;"></div>
                    <div class="form-group" id="reportSubGroup" style="display:none;"><label>Detail</label><div id="reportSubContainer"></div></div>
                    <div class="form-group" style="align-self:end; display:flex; gap:8px;">
                        <button class="btn btn-primary" id="generateReportBtn">Generate</button>
                        <button class="btn btn-secondary" id="exportCsvBtn">Export Summary CSV</button>
                        <button class="btn btn-secondary" id="exportFullDataBtn">Export All Invoices & POs (CSV)</button>
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
            const period = periodSelect.value;
            const year = parseInt(document.getElementById('reportYear').value) || currentYear;
            let sub = '';
            if (period === 'Weekly') sub = document.getElementById('reportWeekStart')?.value || new Date().toISOString().split('T')[0];
            else { const subElem = document.getElementById('reportSub'); if (subElem) sub = subElem.value; }
            const { start, end } = getDateRange(period, year, sub);
            if (currentTab === 'GST') currentReportData = await generateGSTReport(start, end, period, year, sub, true);
            else if (currentTab === 'Profit') currentReportData = await generateProfitReport(start, end, period, year, sub, true);
            else if (currentTab === 'Trends') await generateTrendsReport(year);
        }
        document.getElementById('generateReportBtn').addEventListener('click', generate);
        document.getElementById('exportCsvBtn').addEventListener('click', () => { if (!currentReportData) { showToast('Generate a report first', 'info'); return; } if (currentTab === 'GST') exportGSTToCSV(currentReportData); else if (currentTab === 'Profit') exportProfitToCSV(currentReportData); else showToast('CSV export only for GST/Profit reports', 'info'); });
        document.getElementById('exportFullDataBtn').addEventListener('click', exportAllTransactionsCSV);
        document.getElementById('tabGST').addEventListener('click', () => { currentTab = 'GST'; document.getElementById('tabGST').className = 'btn btn-primary'; document.getElementById('tabProfit').className = 'btn btn-outline'; document.getElementById('tabTrends').className = 'btn btn-outline'; generate(); });
        document.getElementById('tabProfit').addEventListener('click', () => { currentTab = 'Profit'; document.getElementById('tabProfit').className = 'btn btn-primary'; document.getElementById('tabGST').className = 'btn btn-outline'; document.getElementById('tabTrends').className = 'btn btn-outline'; generate(); });
        document.getElementById('tabTrends').addEventListener('click', () => { currentTab = 'Trends'; document.getElementById('tabTrends').className = 'btn btn-primary'; document.getElementById('tabGST').className = 'btn btn-outline'; document.getElementById('tabProfit').className = 'btn btn-outline'; generate(); });
        document.getElementById('tabGST').className = 'btn btn-primary';
        document.getElementById('tabProfit').className = 'btn btn-outline';
        document.getElementById('tabTrends').className = 'btn btn-outline';
        await generate();
    }

    // Monthly Trends Chart (Revenue, COGS, Profit for last 12 months)
    async function generateTrendsReport(year) {
        const allInvoices = await dbGetAll('invoices');
        const allPOs = await dbGetAll('purchaseOrders');
        const products = await dbGetAll('products');
        const months = [];
        const revenueData = [];
        const cogsData = [];
        const profitData = [];
        const now = new Date();
        const targetYear = year || now.getFullYear();
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
                        const costPerUnit = prod?.costPrice || 0;
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
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` } } }
            }
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
        const outputHtml = `<h2>GST Summary: ${periodLabel}</h2><div class="stat-row"><div class="stat-card"><div class="stat-value">${formatCurrency(totalInvTaxable)}</div><div class="stat-label">Sales Taxable</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(totalPOTaxable)}</div><div class="stat-label">Purchase Taxable</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(totalInvCGST+totalInvSGST+totalInvIGST)}</div><div class="stat-label">Sales GST</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(totalPOCGST+totalPOSGST+totalPOIGST)}</div><div class="stat-label">Purchase GST</div></div></div>
        <div class="chart-container"><canvas id="gstChart" width="400" height="200"></canvas></div>
        <div class="card"><h3>Outward Supplies (Sales)</h3>${allInvoiceItems.length ? `<div class="table-wrap"><table><thead><tr><th>Rate</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total Tax</th></tr></thead><tbody>${invoiceRateRows}<tr style="background:#f9fafb; font-weight:bold;"><td>Total</td><td class="text-right">${formatCurrency(totalInvTaxable)}</td><td class="text-right">${formatCurrency(totalInvCGST)}</td><td class="text-right">${formatCurrency(totalInvSGST)}</td><td class="text-right">${formatCurrency(totalInvIGST)}</td><td class="text-right">${formatCurrency(totalInvCGST+totalInvSGST+totalInvIGST)}</td></tr></tbody></table></div>` : '<p>No invoices.</p>'}</div>
        <div class="card"><h3>Inward Supplies (Purchases)</h3>${allPOItems.length ? `<div class="table-wrap"><table><thead><tr><th>Rate</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total Tax</th></tr></thead><tbody>${poRateRows}<tr style="background:#f9fafb; font-weight:bold;"><td>Total</td><td class="text-right">${formatCurrency(totalPOTaxable)}</td><td class="text-right">${formatCurrency(totalPOCGST)}</td><td class="text-right">${formatCurrency(totalPOSGST)}</td><td class="text-right">${formatCurrency(totalPOIGST)}</td><td class="text-right">${formatCurrency(totalPOCGST+totalPOSGST+totalPOIGST)}</td></tr></tbody></table></div>` : '<p>No POs.</p>'}</div>
        <div class="card"><h3>Net GST Liability</h3><div class="stat-row"><div class="stat-card"><div class="stat-value">${formatCurrency((totalInvCGST+totalInvSGST) - (totalPOCGST+totalPOSGST))}</div><div class="stat-label">Net CGST+SGST</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(totalInvIGST - totalPOIGST)}</div><div class="stat-label">Net IGST</div></div></div></div>`;
        if (renderToDom) {
            document.getElementById('reportOutput').innerHTML = outputHtml;
            const ctx = document.getElementById('gstChart').getContext('2d');
            if (currentChart) currentChart.destroy();
            currentChart = new Chart(ctx, { type: 'bar', data: { labels: rates.map(r => `${r}%`), datasets: [{ label: 'Taxable Value', data: taxableData, backgroundColor: '#4f46e5' }, { label: 'Total Tax', data: taxData, backgroundColor: '#f59e0b' }] }, options: { responsive: true, maintainAspectRatio: true } });
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
            const costPerUnit = prod?.costPrice || 0;
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
        const outputHtml = `<h2>Profitability Report: ${periodLabel}</h2><div class="stat-row"><div class="stat-card"><div class="stat-value">${formatCurrency(totalRevenue)}</div><div class="stat-label">Total Sales Revenue</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(totalCOGS)}</div><div class="stat-label">Cost of Goods Sold</div></div><div class="stat-card"><div class="stat-value">${formatCurrency(grossProfit)}</div><div class="stat-label">Gross Profit</div></div><div class="stat-card"><div class="stat-value">${grossMargin.toFixed(2)}%</div><div class="stat-label">Gross Margin</div></div></div>
        <div class="chart-container"><canvas id="profitChart" width="400" height="200"></canvas></div>
        <div class="card"><h3>Profit by Product / Service</h3>${profitDetails.length ? `<div class="table-wrap"><table><thead><tr><th>Item</th><th>Type</th><th>Qty Sold</th><th>Revenue</th><th>COGS</th><th>Profit</th><th>Margin</th></tr></thead><tbody>${detailsRows}</tbody></table></div>` : '<p>No sales data in this period.</p>'}</div>`;
        if (renderToDom) {
            document.getElementById('reportOutput').innerHTML = outputHtml;
            const ctx = document.getElementById('profitChart').getContext('2d');
            if (currentChart) currentChart.destroy();
            currentChart = new Chart(ctx, { type: 'pie', data: { labels: profitDetails.map(d => d.name), datasets: [{ data: profitDetails.map(d => d.profit), backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec489a'] }] }, options: { responsive: true, plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}` } } } } });
        }
        return { periodLabel, totalRevenue, totalCOGS, grossProfit, grossMargin, details: profitDetails };
    }

    // --- ENHANCED CSV EXPORT WITH FULL CUSTOMER/SUPPLIER GST DETAILS ---
    async function exportAllTransactionsCSV() {
        const invoices = await dbGetAll('invoices');
        const purchaseOrders = await dbGetAll('purchaseOrders');
        const customers = await dbGetAll('customers');
        const suppliers = await dbGetAll('suppliers');
        const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));
        const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s]));
        
        const csvRows = [];
        
        // === INVOICES SECTION with full customer details ===
        csvRows.push(['=== INVOICES (Sales) ===']);
        csvRows.push([
            'Invoice #', 'Date', 'Due Date', 'Customer Name', 'Customer GSTIN', 
            'Customer State', 'Customer Phone', 'Customer Address', 'Status', 
            'Subtotal', 'Discount', 'Total Tax', 'Grand Total', 'Notes'
        ]);
        for (const inv of invoices) {
            const cust = customerMap[inv.customerId] || {};
            csvRows.push([
                inv.invoiceNumber, inv.date, inv.dueDate, cust.name || '', cust.gstin || '',
                cust.state || '', cust.phone || '', cust.address || '', inv.paymentStatus,
                inv.subtotal, inv.discount || 0, inv.totalTax, inv.grandTotal, inv.notes || ''
            ]);
            csvRows.push(['Line Items:', 'Product', 'Description', 'HSN', 'Qty', 'Rate', 'GST%', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total']);
            if (inv.items) {
                for (const item of inv.items) {
                    csvRows.push(['', item.description, '', item.hsn, item.qty, item.rate, item.selectedGstRate, item.taxable, item.cgstAmt, item.sgstAmt, item.igstAmt, item.total]);
                }
            }
            csvRows.push([]); // blank line between invoices
        }
        
        // === PURCHASE ORDERS SECTION with full supplier details ===
        csvRows.push(['=== PURCHASE ORDERS (Purchases) ===']);
        csvRows.push([
            'PO #', 'Date', 'Supplier Name', 'Supplier GSTIN', 'Supplier State', 
            'Supplier Phone', 'Supplier Address', 'Status', 'Subtotal', 
            'Discount', 'Total Tax', 'Grand Total'
        ]);
        for (const po of purchaseOrders) {
            const supp = supplierMap[po.supplierId] || {};
            csvRows.push([
                po.poNumber, po.date, supp.name || '', supp.gstin || '', supp.state || '',
                supp.phone || '', supp.address || '', po.status, po.subtotal,
                po.discount || 0, po.totalTax, po.grandTotal
            ]);
            csvRows.push(['Line Items:', 'Product', 'Description', 'HSN', 'Qty', 'Rate', 'GST%', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total']);
            if (po.items) {
                for (const item of po.items) {
                    csvRows.push(['', item.description, '', item.hsn, item.qty, item.rate, item.selectedGstRate, item.taxable, item.cgstAmt, item.sgstAmt, item.igstAmt, item.total]);
                }
            }
            csvRows.push([]);
        }
        
        // Generate CSV string
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

    // Start app (non-blocking Google Drive init)
    openDB().then(() => {
        updateOnlineStatus();
        initGoogleDriveModule().catch(err => console.warn('Drive init background error:', err));
        navigateTo('dashboard');
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