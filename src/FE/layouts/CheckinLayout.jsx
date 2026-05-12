import { NavLink, Outlet } from 'react-router-dom';
import UserDropdown from '../components/UserDropdown';
import { clearQrRegistry } from '../lib/checkin-db';

/**
 * CheckinLayout - layout danh rieng cho role CHECKIN_STAFF.
 *
 * Hien thi sau khi AuthGuard + RoleGuard xac thuc thanh cong.
 * Day la PWA offline-first - giu layout toi gian de tai nhanh.
 *
 * Quyen han (blueprint Section 5):
 *   - Quet QR check-in           POST /api/checkins/**
 *   - Preload danh sach QR       GET /api/checkins/preload
 *   - Sync check-in offline      POST /api/checkins/sync
 *   - Khong dang ky workshop
 *   - Khong quan ly workshop
 *
 * Luu y offline (blueprint Section 3 - Luong Check-in Offline):
 *   - Truoc su kien: app preload QR list -> luu vao IndexedDB
 *   - Mat mang: lookup IndexedDB local -> ghi pending queue
 *   - Co mang tro lai: Background Sync -> POST /checkins/sync
 */
export default function CheckinLayout() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] text-gray-950">
      <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="font-bold text-amber-700">UniHub Check-in</div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <nav className="flex flex-wrap gap-2 text-sm font-medium">
              <CheckinNavLink to="/checkin">Tải trước & đồng bộ</CheckinNavLink>
              <CheckinNavLink to="/checkin/scan">Quét QR</CheckinNavLink>
            </nav>
            <div className="ml-2">
              <UserDropdown onLoggedOut={clearQrRegistry} />
            </div>
          </div>
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
          'rounded-md border border-transparent px-3 py-2 transition duration-200 ease-out',
          isActive
            ? 'border-amber-200 bg-amber-100 text-amber-800 shadow-sm'
            : 'text-gray-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}
