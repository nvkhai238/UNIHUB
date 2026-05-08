import { Link, Outlet } from 'react-router-dom';

/**
 * PublicLayout — wrapper cho tất cả trang không yêu cầu đăng nhập.
 * (Trang chủ, danh sách workshop, chi tiết workshop)
 *
 * Thêm Navbar/Header ở đây.
 */
export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] text-gray-950">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-lg font-bold tracking-normal text-emerald-700">UniHub Workshop</Link>
          <nav className="flex items-center gap-3 text-sm font-medium text-gray-600">
            <Link className="hover:text-emerald-700" to="/">Workshops</Link>
            <Link className="rounded-md bg-gray-950 px-3 py-2 text-white hover:bg-gray-800" to="/login">Đăng nhập</Link>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
