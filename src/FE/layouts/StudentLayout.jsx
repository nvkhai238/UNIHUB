import { Outlet } from 'react-router-dom';

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
    <div className="student-layout">
      {/* TODO: <StudentSidebar /> */}
      {/* TODO: <StudentTopBar /> */}
      <main className="student-layout__content">
        <Outlet />
      </main>
    </div>
  );
}
