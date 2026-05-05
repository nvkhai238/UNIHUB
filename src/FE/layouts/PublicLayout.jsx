import { Outlet } from 'react-router-dom';

/**
 * PublicLayout — wrapper cho tất cả trang không yêu cầu đăng nhập.
 * (Trang chủ, danh sách workshop, chi tiết workshop)
 *
 * Thêm Navbar/Header ở đây.
 */
export default function PublicLayout() {
  return (
    <div className="public-layout">
      {/* TODO: <PublicNavbar /> */}
      <main>
        <Outlet />
      </main>
      {/* TODO: <Footer /> */}
    </div>
  );
}
