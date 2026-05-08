import { NavLink, Outlet } from 'react-router-dom';
import LogoutButton from '../components/LogoutButton';
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
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="font-bold text-amber-700">UniHub Check-in</div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <nav className="flex flex-wrap gap-2 text-sm font-medium">
              <CheckinNavLink to="/checkin">Preload & Sync</CheckinNavLink>
              <CheckinNavLink to="/checkin/scan">Quét QR</CheckinNavLink>
            </nav>
            <LogoutButton onLoggedOut={clearQrRegistry} />
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
          'rounded-md px-3 py-2',
          isActive ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}
