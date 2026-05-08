import { NavLink, Outlet } from 'react-router-dom';

/**
 * OrganizerLayout — layout dành riêng cho role ORGANIZER (Ban tổ chức).
 *
 * Hiển thị sau khi AuthGuard + RoleGuard xác thực thành công.
 * Thêm Admin Sidebar / Dashboard Nav ở đây.
 *
 * Quyền hạn (blueprint §5):
 *   ✅ Tạo workshop mới            POST /api/workshops/**
 *   ✅ Sửa / hủy workshop          PUT/DELETE /api/workshops/**
 *   ✅ Upload PDF workshop          (multipart via admin endpoint)
 *   ✅ Xem thống kê đăng ký        GET /api/admin/**
 *   ✅ Xem danh sách / chi tiết    GET /api/workshops/** (public)
 *   ❌ Đăng ký workshop
 *   ❌ Quét QR check-in
 */
export default function OrganizerLayout() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] text-gray-950">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="font-bold text-rose-700">UniHub Organizer</div>
          <nav className="flex flex-wrap gap-2 text-sm font-medium">
            <OrganizerNavLink to="/admin">Tổng quan</OrganizerNavLink>
            <OrganizerNavLink to="/admin/workshops">Workshop</OrganizerNavLink>
            <OrganizerNavLink to="/admin/workshops/create">Tạo mới</OrganizerNavLink>
            <OrganizerNavLink to="/admin/statistics">Thống kê</OrganizerNavLink>
            <OrganizerNavLink to="/admin/student-imports">Import SV</OrganizerNavLink>
          </nav>
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
