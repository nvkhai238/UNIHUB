import { Outlet } from 'react-router-dom';

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
    <div className="organizer-layout">
      {/* TODO: <OrganizerSidebar /> */}
      {/* TODO: <OrganizerTopBar /> */}
      <main className="organizer-layout__content">
        <Outlet />
      </main>
    </div>
  );
}
