import { NavLink, Outlet } from 'react-router-dom';

/**
 * StudentLayout — layout dành riêng cho role STUDENT.
 *
 * Hiển thị sau khi AuthGuard + RoleGuard xác thực thành công.
 * Thêm Sidebar / TopBar cho sinh viên ở đây.
 *
 * Quyền hạn (blueprint §5):
 *   ✅ Xem danh sách workshop      GET /api/workshops/**  (public)
 *   ✅ Đăng ký workshop            POST /api/registrations/**
 *   ✅ Xem registration của mình   GET /api/registrations/my/**
 *   ❌ Tạo/sửa/hủy workshop
 *   ❌ Quét QR check-in
 */
export default function StudentLayout() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] text-gray-950">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="font-bold text-emerald-700">UniHub Student</div>
          <nav className="flex flex-wrap gap-2 text-sm font-medium">
            <StudentNavLink to="/student">Tổng quan</StudentNavLink>
            <StudentNavLink to="/">Lịch workshop</StudentNavLink>
            <StudentNavLink to="/student/registrations">Đăng ký</StudentNavLink>
            <StudentNavLink to="/student/notifications">Thông báo</StudentNavLink>
          </nav>
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
