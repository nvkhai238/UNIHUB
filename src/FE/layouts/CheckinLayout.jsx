import { NavLink, Outlet } from 'react-router-dom';

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
    <div className="min-h-screen bg-[#f7f8fb] text-gray-950">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="font-bold text-amber-700">UniHub Check-in</div>
          <nav className="flex flex-wrap gap-2 text-sm font-medium">
            <CheckinNavLink to="/checkin">Preload & Sync</CheckinNavLink>
            <CheckinNavLink to="/checkin/scan">Quét QR</CheckinNavLink>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

function CheckinNavLink({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'rounded-md px-3 py-2',
          isActive ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}
