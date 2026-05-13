import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

const ACCESS_TOKEN_KEY = 'unihub_access_token';
const REFRESH_TOKEN_KEY = 'unihub_refresh_token';
const DEVICE_ID_KEY = 'unihub_device_id';

let dbPromise;

export async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('unihub-checkin.db');
    const db = await dbPromise;
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS qr_registry (
        qr_code TEXT PRIMARY KEY NOT NULL,
        full_name TEXT,
        workshop_id TEXT NOT NULL,
        checked_in_local INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pending_checkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        qr_code TEXT NOT NULL,
        workshop_id TEXT,
        device_id TEXT,
        timestamp TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'PENDING',
        server_status TEXT,
        server_message TEXT
      );
    `);
  }
  return dbPromise;
}

export async function saveTokens(accessToken, refreshToken) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function getTokens() {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  return { accessToken, refreshToken };
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

export async function getOrCreateDeviceId() {
  let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `mobile-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export async function clearOfflineData() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM pending_checkins;
    DELETE FROM qr_registry;
  `);
}

export async function replaceQrRegistry(items) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM qr_registry;');
    for (const item of items) {
      await db.runAsync(
        `INSERT INTO qr_registry (qr_code, full_name, workshop_id, checked_in_local, updated_at)
         VALUES (?, ?, ?, 0, ?)`,
        [item.qrCode, item.fullName || '', item.workshopId, new Date().toISOString()]
      );
    }
  });
}

export async function findQr(qrCode) {
  const db = await getDb();
  return db.getFirstAsync(
    'SELECT qr_code AS qrCode, full_name AS fullName, workshop_id AS workshopId, checked_in_local AS checkedInLocal FROM qr_registry WHERE qr_code = ?',
    [qrCode]
  );
}

export async function queueOfflineCheckin({ qrCode, workshopId, deviceId, timestamp }) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO pending_checkins (qr_code, workshop_id, device_id, timestamp, sync_status)
       VALUES (?, ?, ?, ?, 'PENDING')`,
      [qrCode, workshopId || null, deviceId, timestamp]
    );
    await db.runAsync(
      'UPDATE qr_registry SET checked_in_local = 1, updated_at = ? WHERE qr_code = ?',
      [new Date().toISOString(), qrCode]
    );
  });
}

export async function hasLocalDuplicate(qrCode) {
  const db = await getDb();
  const pending = await db.getFirstAsync(
    `SELECT id FROM pending_checkins
     WHERE qr_code = ? AND sync_status IN ('PENDING', 'SYNCED', 'DUPLICATE')`,
    [qrCode]
  );
  if (pending) {
    return true;
  }
  const registry = await findQr(qrCode);
  return Boolean(registry?.checkedInLocal);
}

export async function listPendingCheckins() {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT id, qr_code AS qrCode, workshop_id AS workshopId, device_id AS deviceId, timestamp
     FROM pending_checkins
     WHERE sync_status = 'PENDING'
     ORDER BY id ASC`
  );
}

export async function markCheckinsSyncResult(items) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const item of items) {
      const nextStatus = item.status === 'CREATED' ? 'SYNCED' : item.status;
      await db.runAsync(
        `UPDATE pending_checkins
         SET sync_status = ?, server_status = ?, server_message = ?
         WHERE qr_code = ? AND sync_status = 'PENDING'`,
        [nextStatus, item.status, item.message || '', item.qrCode]
      );
      if (item.status !== 'CREATED') {
        await db.runAsync(
          'UPDATE qr_registry SET checked_in_local = 0, updated_at = ? WHERE qr_code = ?',
          [new Date().toISOString(), item.qrCode]
        );
      }
    }
  });
}

export async function getOfflineStats() {
  const db = await getDb();
  const [registry, pending] = await Promise.all([
    db.getFirstAsync('SELECT COUNT(*) AS total FROM qr_registry'),
    db.getFirstAsync(`SELECT COUNT(*) AS total FROM pending_checkins WHERE sync_status = 'PENDING'`),
  ]);
  return {
    registryCount: registry?.total ?? 0,
    pendingCount: pending?.total ?? 0,
  };
}
