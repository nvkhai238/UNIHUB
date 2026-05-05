/**
 * checkin-db.ts — IndexedDB wrapper cho module check-in PWA
 *
 * Database:  unihub-checkin  (version 1)
 * Stores:
 *   qr_registry  — Cache danh sách QR hợp lệ từ GET /api/checkins/preload
 *   pending_sync — Hàng đợi check-in offline chờ sync lên server
 *
 * Tham chiếu blueprint:
 *   checkin.md §3 — IndexedDB Schema
 *   checkin.md §3 — Luồng check-in offline
 *   checkin.md §3 — Background Sync (sw.js)
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// ─── DB Schema Types ──────────────────────────────────────────────────────────

/**
 * Một entry trong `qr_registry`.
 * Là bản ghi QR hợp lệ tải về từ preload endpoint trước sự kiện.
 * (checkin.md §3 — Schema qr_registry)
 */
export interface QrRegistryEntry {
  /** UUID string — primary key */
  qrCode: string;
  studentName: string;
  studentId: string;
  workshopId: string;
  workshopTitle: string;
  workshopRoom: string;
  /** ISO 8601 string */
  workshopStartTime: string;
  /**
   * Flag cập nhật khi scan offline để ngăn check-in trùng.
   * (checkin.md §3 — "alreadyCheckedIn flag ngăn IndexedDB")
   */
  alreadyCheckedIn: boolean;
}

/**
 * Một entry trong `pending_sync`.
 * Ghi lại check-in đã xác nhận offline, chờ POST /api/checkins/sync.
 * (checkin.md §3 — Schema pending_sync)
 */
export interface PendingSyncEntry {
  /** autoIncrement — không cần truyền khi add */
  id?: number;
  qrCode: string;
  deviceId: string;
  /** ISO 8601 string — thời điểm quét QR trên thiết bị nhân sự */
  checkedInAt: string;
  /** 0 = chưa sync, 1 = đã sync thành công */
  synced: 0 | 1;
}

// ─── IDB Schema Definition ────────────────────────────────────────────────────

interface CheckinDB extends DBSchema {
  qr_registry: {
    key: string;                      // qrCode
    value: QrRegistryEntry;
    indexes: {
      by_workshop: string;            // workshopId
    };
  };
  pending_sync: {
    key: number;                      // autoIncrement id
    value: PendingSyncEntry;
    indexes: {
      by_synced: number;              // synced (0|1)
    };
  };
}

// ─── Singleton DB promise ─────────────────────────────────────────────────────

let _db: IDBPDatabase<CheckinDB> | null = null;

/**
 * Membuka (atau mendapatkan dari cache) koneksi DB.
 * Lazy-initialized — aman dipanggil berkali-kali.
 */
export async function getDb(): Promise<IDBPDatabase<CheckinDB>> {
  if (_db) return _db;

  _db = await openDB<CheckinDB>('unihub-checkin', 1, {
    upgrade(db, oldVersion) {
      // ── Version 0 → 1 ───────────────────────────────────────────────────
      if (oldVersion < 1) {
        // Object store: qr_registry
        const qrStore = db.createObjectStore('qr_registry', {
          keyPath: 'qrCode',
        });
        // Index cho phép query "tất cả QR của một workshop"
        // dùng trong preload theo từng workshopId
        qrStore.createIndex('by_workshop', 'workshopId', { unique: false });

        // Object store: pending_sync
        const syncStore = db.createObjectStore('pending_sync', {
          keyPath: 'id',
          autoIncrement: true,
        });
        // Index chính để Service Worker query "WHERE synced = 0"
        syncStore.createIndex('by_synced', 'synced', { unique: false });
      }
    },
  });

  return _db;
}

// ─────────────────────────────────────────────────────────────────────────────
// qr_registry operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lấy một entry QR theo qrCode.
 * Returns undefined nếu không tìm thấy — caller hiện "Không tìm thấy sinh viên".
 * (checkin.md §3 — "null → Hiển thị Không tìm thấy SV")
 */
export async function getQrEntry(
  qrCode: string,
): Promise<QrRegistryEntry | undefined> {
  const db = await getDb();
  return db.get('qr_registry', qrCode);
}

/**
 * Ghi một entry mới vào qr_registry.
 * Dùng khi preload: server trả về mảng entries, ghi từng cái.
 */
export async function addQrEntry(entry: QrRegistryEntry): Promise<void> {
  const db = await getDb();
  await db.put('qr_registry', entry); // put để idempotent khi preload lại
}

/**
 * Ghi batch entries vào qr_registry trong một transaction.
 * Dùng sau khi nhận response từ GET /api/checkins/preload.
 * Xóa dữ liệu cũ (của ngày hôm qua) trước khi ghi mới nếu clearFirst = true.
 */
export async function bulkPutQrEntries(
  entries: QrRegistryEntry[],
  clearFirst = false,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('qr_registry', 'readwrite');

  if (clearFirst) {
    await tx.store.clear();
  }
  await Promise.all([
    ...entries.map((entry) => tx.store.put(entry)),
    tx.done,
  ]);
}

/**
 * Cập nhật flag alreadyCheckedIn = true sau khi xác nhận check-in offline.
 * (checkin.md §3 — "IndexedDB.put('qr_registry', {..., alreadyCheckedIn: true})")
 */
export async function markQrAsCheckedIn(qrCode: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('qr_registry', 'readwrite');
  const entry = await tx.store.get(qrCode);
  if (!entry) {
    await tx.done;
    return;
  }
  await tx.store.put({ ...entry, alreadyCheckedIn: true });
  await tx.done;
}

/**
 * Lấy tất cả entries trong qr_registry theo workshopId.
 */
export async function getQrEntriesByWorkshop(
  workshopId: string,
): Promise<QrRegistryEntry[]> {
  const db = await getDb();
  return db.getAllFromIndex('qr_registry', 'by_workshop', workshopId);
}

/**
 * Xóa toàn bộ qr_registry (dùng khi logout hoặc cuối sự kiện).
 */
export async function clearQrRegistry(): Promise<void> {
  const db = await getDb();
  await db.clear('qr_registry');
}

// ─────────────────────────────────────────────────────────────────────────────
// pending_sync operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thêm một check-in offline vào hàng đợi.
 * Trả về id autoIncrement được tạo ra.
 * (checkin.md §3 — "IndexedDB.add('pending_sync', entry)")
 */
export async function addPendingCheckin(
  entry: Omit<PendingSyncEntry, 'id'>,
): Promise<number> {
  const db = await getDb();
  const id = await db.add('pending_sync', { ...entry, synced: 0 });
  return id as number;
}

/**
 * Lấy tất cả check-in chưa sync (synced = 0).
 * Đây là hàm mà Service Worker gọi để lấy batch cần POST lên server.
 * (checkin.md §3 — "getAllFromIndex('pending_sync', 'synced', 0)")
 */
export async function getPendingCheckins(): Promise<PendingSyncEntry[]> {
  const db = await getDb();
  return db.getAllFromIndex('pending_sync', 'by_synced', 0);
}

/**
 * Đánh dấu một entry là đã sync thành công (synced = 1).
 * Gọi sau khi server xác nhận trong response POST /api/checkins/sync.
 */
export async function markSynced(id: number): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('pending_sync', 'readwrite');
  const entry = await tx.store.get(id);
  if (!entry) {
    await tx.done;
    return;
  }
  await tx.store.put({ ...entry, synced: 1 });
  await tx.done;
}

/**
 * Đánh dấu batch nhiều entries đã sync trong một transaction.
 * Hiệu quả hơn gọi markSynced() nhiều lần.
 */
export async function markSyncedBatch(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const tx = db.transaction('pending_sync', 'readwrite');

  await Promise.all(
    ids.map(async (id) => {
      const entry = await tx.store.get(id);
      if (entry) {
        await tx.store.put({ ...entry, synced: 1 });
      }
    }),
  );
  await tx.done;
}

/**
 * Xóa tất cả entries đã sync (dọn dẹp định kỳ).
 */
export async function deleteSyncedEntries(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('pending_sync', 'readwrite');
  const synced = await tx.store.index('by_synced').getAll(1);
  await Promise.all(synced.map((e) => tx.store.delete(e.id!)));
  await tx.done;
}

/**
 * Số lượng check-in đang chờ sync.
 * Dùng để hiển thị badge trên UI khi offline.
 */
export async function countPending(): Promise<number> {
  const db = await getDb();
  return db.countFromIndex('pending_sync', 'by_synced', 0);
}
