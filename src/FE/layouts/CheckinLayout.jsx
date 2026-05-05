import { Outlet } from 'react-router-dom';

/**
 * CheckinLayout — layout dành riêng cho role CHECKIN_STAFF.
 *
 * Hiển thị sau khi AuthGuard + RoleGuard xác thực thành công.
 * Đây là PWA app offline-first — giữ layout tối giản để tải nhanh.
 *
 * Quyền hạn (blueprint §5):
 *   ✅ Quét QR check-in            POST /api/checkins/**
 *   ✅ Preload danh sách QR        GET /api/checkins/preload
 *   ✅ Sync check-in offline       POST /api/checkins/sync
 *   ❌ Đăng ký workshop
 *   ❌ Quản lý workshop
 *
 * Lưu ý offline (blueprint §3 — Luồng Check-in Offline):
 *   - Trước sự kiện: app preload QR list → lưu vào IndexedDB
 *   - Mất mạng: lookup IndexedDB local → ghi pending queue
 *   - Có mạng trở lại: Service Worker Background Sync → POST /checkins/sync
 */
export default function CheckinLayout() {
  return (
    <div className="checkin-layout">
      {/* TODO: <CheckinHeader /> */}
      {/* TODO: Offline banner (navigator.onLine listener) */}
      <main className="checkin-layout__content">
        <Outlet />
      </main>
    </div>
  );
}
