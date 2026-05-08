import { NavLink, Outlet } from 'react-router-dom';
import LogoutButton from '../components/LogoutButton';

/**
 * StudentLayout - layout danh rieng cho role STUDENT.
 *
 * Hien thi sau khi AuthGuard + RoleGuard xac thuc thanh cong.
 * Them Sidebar / TopBar cho sinh vien o day.
 *
 * Quyen han (blueprint Section 5):
 *   - Xem danh sach workshop     GET /api/workshops/**  (public)
 *   - Dang ky workshop           POST /api/registrations/**
 *   - Xem registration cua minh  GET /api/registrations/my/**
 *   - Khong tao/sua/huy workshop
 *   - Khong quet QR check-in
 */
export default function StudentLayout() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] text-gray-950">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="font-bold text-emerald-700">UniHub Student</div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <nav className="flex flex-wrap gap-2 text-sm font-medium">
              <StudentNavLink to="/student">Tổng quan</StudentNavLink>
              <StudentNavLink to="/">Lịch workshop</StudentNavLink>
              <StudentNavLink to="/student/registrations">Đăng ký</StudentNavLink>
              <StudentNavLink to="/student/notifications">Thông báo</StudentNavLink>
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

function StudentNavLink({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'rounded-md px-3 py-2',
          isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}
