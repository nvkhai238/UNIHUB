import { NavLink, Outlet } from 'react-router-dom';
import LogoutButton from '../components/LogoutButton';

/**
 * OrganizerLayout - layout danh rieng cho role ORGANIZER.
 *
 * Hien thi sau khi AuthGuard + RoleGuard xac thuc thanh cong.
 * Them Admin Sidebar / Dashboard Nav o day.
 *
 * Quyen han (blueprint Section 5):
 *   - Tao workshop moi           POST /api/workshops/**
 *   - Sua / huy workshop         PUT/DELETE /api/workshops/**
 *   - Upload PDF workshop        multipart via admin endpoint
 *   - Xem thong ke dang ky       GET /api/admin/**
 *   - Xem danh sach / chi tiet   GET /api/workshops/** (public)
 *   - Khong dang ky workshop
 *   - Khong quet QR check-in
 */
export default function OrganizerLayout() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] text-gray-950">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="font-bold text-rose-700">UniHub Organizer</div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <nav className="flex flex-wrap gap-2 text-sm font-medium">
              <OrganizerNavLink to="/admin">Tổng quan</OrganizerNavLink>
              <OrganizerNavLink to="/admin/workshops">Workshop</OrganizerNavLink>
              <OrganizerNavLink to="/admin/workshops/create">Tạo mới</OrganizerNavLink>
              <OrganizerNavLink to="/admin/statistics">Thống kê</OrganizerNavLink>
              <OrganizerNavLink to="/admin/student-imports">Import SV</OrganizerNavLink>
            </nav>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

function OrganizerNavLink({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'rounded-md px-3 py-2',
          isActive ? 'bg-rose-50 text-rose-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}
