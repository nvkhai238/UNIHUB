/**
 * sw.js — Service Worker cho UniHub Check-in PWA
 *
 * Chức năng:
 *   1. Cache static assets khi install (cache-first cho tốc độ).
 *   2. Lắng nghe Background Sync event "checkin-sync":
 *        - Đọc tất cả pending_sync entries có synced=0 từ IndexedDB
 *        - POST /api/checkins/sync với batch
 *        - Đánh dấu synced=1 cho từng entry thành công
 *        - Xử lý refresh token nếu accessToken hết hạn
 *   3. Xử lý lỗi cẩn thận — giữ synced=0 khi mạng chưa ổn định
 *      để Background Sync retry tự động.
 *
 * Tham chiếu blueprint:
 *   checkin.md §3 — Background Sync (sw.js)
 *   checkin.md §3 — Xử lý lỗi offline
 *   auth.md §3    — Token TTL & refresh flow
 *
 * Lưu ý: sw.js nằm ở /public/sw.js (Vite copy thẳng vào root)
 * để scope bao phủ toàn bộ origin.
 * Đăng ký trong main.tsx:
 *   navigator.serviceWorker.register('/sw.js')
 */

/* global self, clients */

// ─── Constants ────────────────────────────────────────────────────────────────

const DB_NAME        = 'unihub-checkin';
const DB_VERSION     = 1;
const SYNC_TAG       = 'checkin-sync';
const CACHE_NAME     = 'unihub-static-v1';
const API_BASE       = self.location.origin;  // same-origin

/**
 * Static assets to precache on install.
 * Vite injects the actual hashed filenames at build time via vite-plugin-pwa.
 * For manual sw.js, list the critical shell assets here.
 */
const PRECACHE_URLS = [
  '/',
  '/index.html',
];

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),  // activate immediately
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch — network-first for API, cache-first for static ───────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls — always network, never cache
  if (url.pathname.startsWith('/api/')) return;

  // Static assets — cache-first
  event.respondWith(
    caches.match(request).then(
      (cached) => cached ?? fetch(request),
    ),
  );
});

// ─── Background Sync ──────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    // waitUntil ensures the SW doesn't terminate while sync is in flight.
    // If syncPendingCheckins() throws (network failure), the browser will
    // automatically retry the sync when connectivity is restored.
    event.waitUntil(syncPendingCheckins());
  }
});

// ─── Core sync function ───────────────────────────────────────────────────────

/**
 * Reads all unsynced check-in entries from IndexedDB and POSTs them
 * to /api/checkins/sync in a single batch request.
 *
 * Error handling strategy (checkin.md §3):
 *   - Network error / 5xx / 429 → throw Error → Background Sync retries automatically
 *   - 401 TOKEN_EXPIRED          → attempt token refresh → retry once
 *   - 401 after refresh failed   → post message to app for re-login prompt
 *   - 400 / other 4xx            → log and mark as synced=1 to avoid infinite loop
 *                                  (server ON CONFLICT DO NOTHING handles duplicates)
 */
async function syncPendingCheckins() {
  const db = await openCheckinDB();
  const pending = await getAllPending(db);

  if (pending.length === 0) return;

  let token = getStoredAccessToken();

  // First attempt
  let result = await trySyncRequest(pending, token);

  // Handle 401 — try to refresh the token once
  if (result.status === 401) {
    const refreshed = await attemptTokenRefresh();
    if (!refreshed) {
      // Refresh token also expired — notify the app to prompt re-login.
      // Do NOT throw here: we don't want the SW to retry this automatically
      // because the user needs to interact (log in again).
      await notifyClients({ type: 'SESSION_EXPIRED' });
      return;
    }
    token = refreshed;
    result = await trySyncRequest(pending, token);
  }

  // Network / server error — let Background Sync retry
  if (!result.ok) {
    const retryable = result.status === 0      // network failure
      || result.status === 429                  // rate limited
      || result.status >= 500;                 // server errors
    if (retryable) {
      throw new Error(`Sync failed with status ${result.status} — will retry`);
    }
    // 4xx (other than 401) — bad request; avoid infinite retries.
    // The server uses ON CONFLICT DO NOTHING so it's safe to mark as synced.
    console.warn('[SW] Non-retryable sync error', result.status);
    await markAllSynced(db, pending);
    return;
  }

  const body = await result.json();
  // body.data.errors contains individual entries the server couldn't process
  const serverErrors = new Set(
    (body?.data?.errors ?? []).map((e) => e.qrCode),
  );

  // Mark entries as synced, skipping ones the server explicitly rejected
  const syncedIds = pending
    .filter((e) => !serverErrors.has(e.qrCode))
    .map((e) => e.id);

  await markAllSynced(db, pending.filter((e) => !serverErrors.has(e.qrCode)));

  // Notify the app so it can refresh the UI counter
  await notifyClients({
    type: 'SYNC_COMPLETE',
    synced: syncedIds.length,
    skipped: serverErrors.size,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * POST /api/checkins/sync with the given entries.
 * Returns the raw Response object (caller inspects .ok and .status).
 * Never throws — network errors are caught and returned as {ok:false, status:0}.
 */
async function trySyncRequest(pending, token) {
  const entries = pending.map(({ qrCode, deviceId, checkedInAt }) => ({
    qrCode,
    deviceId,
    checkedInAt,
  }));

  try {
    return await fetch(`${API_BASE}/api/checkins/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token ?? ''}`,
      },
      body: JSON.stringify({ entries }),
    });
  } catch (networkError) {
    // Offline or DNS failure — return a synthetic "0" response
    console.warn('[SW] Network error during sync:', networkError.message);
    return { ok: false, status: 0, json: async () => ({}) };
  }
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns the new access token string, or null if refresh fails.
 * (checkin.md §3 — "Access token hết hạn khi sync → gọi /api/auth/refresh")
 */
async function attemptTokenRefresh() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const resp = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!resp.ok) return null;

    const body = await resp.json();
    const newToken = body?.data?.accessToken;
    if (!newToken) return null;

    // Persist new token so the main app also picks it up
    persistAccessToken(newToken);
    return newToken;
  } catch {
    return null;
  }
}

/**
 * Read access token from localStorage.
 * Service Workers cannot access localStorage directly — use IndexedDB or
 * postMessage. Here we use a shared IndexedDB entry as a bridge.
 *
 * For simplicity, we read from a well-known IDB key written by the main app.
 * Falls back to null if unavailable.
 */
function getStoredAccessToken() {
  // The main app writes tokens to IndexedDB store 'auth_tokens'.
  // This is a synchronous helper that returns the last cached value.
  // The async version is used during actual sync (see openCheckinDB flow).
  // NOTE: We read this synchronously from the DB during syncPendingCheckins()
  // via the DB connection — this function is a placeholder for clarity.
  // In practice, token is read from the opened DB in syncPendingCheckins().
  return _cachedAccessToken;
}

function getStoredRefreshToken() {
  return _cachedRefreshToken;
}

function persistAccessToken(token) {
  _cachedAccessToken = token;
}

// Tokens are written into these module-level variables when the DB is opened.
// The main app posts them via postMessage when the SW activates.
let _cachedAccessToken = null;
let _cachedRefreshToken = null;

// Listen for token updates from the main app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_TOKENS') {
    _cachedAccessToken  = event.data.accessToken  ?? null;
    _cachedRefreshToken = event.data.refreshToken ?? null;
  }
});

// ─── IndexedDB helpers (no idb lib in SW — use raw IDBPDatabase via idb UMD  ──
// SW cannot import ES modules directly unless type="module" is used.
// We use the idb UMD bundle loaded below, OR implement a minimal raw wrapper.

/**
 * Opens the unihub-checkin IndexedDB.
 * Uses the same schema as checkin-db.ts.
 * We implement a thin raw IDB wrapper here to avoid ES module import issues in SW.
 */
function openCheckinDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('qr_registry')) {
        const qrStore = db.createObjectStore('qr_registry', { keyPath: 'qrCode' });
        qrStore.createIndex('by_workshop', 'workshopId', { unique: false });
      }
      if (!db.objectStoreNames.contains('pending_sync')) {
        const syncStore = db.createObjectStore('pending_sync', {
          keyPath: 'id',
          autoIncrement: true,
        });
        syncStore.createIndex('by_synced', 'synced', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/** Get all pending_sync entries where synced = 0 */
function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('pending_sync', 'readonly');
    const index = tx.objectStore('pending_sync').index('by_synced');
    const req   = index.getAll(0);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/** Mark a list of entries as synced = 1 */
function markAllSynced(db, entries) {
  return new Promise((resolve, reject) => {
    if (entries.length === 0) return resolve();

    const tx    = db.transaction('pending_sync', 'readwrite');
    const store = tx.objectStore('pending_sync');

    let completed = 0;
    for (const entry of entries) {
      const putReq = store.put({ ...entry, synced: 1 });
      putReq.onsuccess = () => {
        completed++;
        if (completed === entries.length) resolve();
      };
      putReq.onerror = () => reject(putReq.error);
    }

    tx.onerror = () => reject(tx.error);
  });
}

// ─── Client messaging ─────────────────────────────────────────────────────────

/**
 * Broadcast a message to all open windows/tabs controlled by this SW.
 * The main React app listens via navigator.serviceWorker.addEventListener('message').
 */
async function notifyClients(payload) {
  const allClients = await self.clients.matchAll({ type: 'window' });
  for (const client of allClients) {
    client.postMessage(payload);
  }
}
