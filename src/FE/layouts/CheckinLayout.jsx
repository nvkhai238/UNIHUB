import { NavLink, Outlet } from 'react-router-dom';
import UserDropdown from '../components/UserDropdown';

/**
 * CheckinLayout - debug web surface for role CHECKIN_STAFF.
 *
 * Hien thi sau khi AuthGuard + RoleGuard xac thuc thanh cong.
 * Luong check-in chinh la mobile native app trong /src/mobile-checkin.
 * Web route nay chi dung de debug nhanh API preload/sync.
 *
 * Quyen han (blueprint Section 5):
 *   - Quet QR check-in           POST /api/checkins/**
 *   - Preload danh sach QR       GET /api/checkins/preload
 *   - Sync check-in debug        POST /api/checkins/sync
 *   - Khong dang ky workshop
 *   - Khong quan ly workshop
 */
export default function CheckinLayout() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] text-gray-950">
      <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="font-bold text-emerald-700">UniHub Check-in</div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <nav className="flex flex-wrap gap-2 text-sm font-medium">
              <CheckinNavLink to="/checkin">Tải trước & đồng bộ</CheckinNavLink>
              <CheckinNavLink to="/checkin/scan">Quét QR</CheckinNavLink>
            </nav>
            <div className="ml-2">
              <UserDropdown onLoggedOut={clearDebugCheckinCache} />
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

function clearDebugCheckinCache() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith('checkin_preload_') || key === 'unihub_checkin_offline_queue' || key === 'unihub_checkin_device_id')
    .forEach((key) => localStorage.removeItem(key));
}

function CheckinNavLink({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'rounded-md border border-transparent px-3 py-2 transition duration-200 ease-out',
          isActive
            ? 'border-emerald-200 bg-emerald-100 text-emerald-800 shadow-sm'
            : 'text-gray-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}
