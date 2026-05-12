import { Link, Outlet } from 'react-router-dom';
import StudentHeader from '../components/StudentHeader';
import { isTokenValid, getCurrentRole } from '../router/jwtUtils';
import { ROLES, ROLE_HOME } from '../router/constants';
import UserDropdown from '../components/UserDropdown';

/**
 * PublicLayout - wrapper cho cac trang khong yeu cau dang nhap.
 * Neu sinh vien da dang nhap, giu dung header sinh vien khi xem lich workshop.
 */
export default function PublicLayout() {
  const role = getCurrentRole();
  const loggedIn = isTokenValid();
  const showStudentHeader = loggedIn && role === ROLES.STUDENT;

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-gray-950">
      {showStudentHeader ? <StudentHeader /> : <PublicHeader loggedIn={loggedIn} role={role} />}
      <main>
        <Outlet />
      </main>
    </div>
  );
}

function PublicHeader({ loggedIn, role }) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link
          to="/"
          className="inline-flex items-center gap-3 rounded-md pr-2 transition duration-200 ease-out hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-base font-bold text-white shadow-sm">
            U
          </span>
          <span className="text-lg font-bold tracking-normal text-emerald-700">
            UniHub Workshop
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-semibold text-gray-600">
          <Link
            className="inline-flex h-10 items-center rounded-md border border-transparent px-3 transition duration-200 ease-out hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
            to="/"
          >
            Workshops
          </Link>
          {loggedIn && role ? (
            <>
              <Link
                className="inline-flex h-10 items-center rounded-md bg-emerald-600 px-4 text-white transition duration-200 ease-out hover:bg-emerald-700 hover:shadow-md ml-2"
                to={ROLE_HOME[role] ?? '/'}
              >
                Bảng điều khiển
              </Link>
              <div className="ml-2 border-l border-gray-200 pl-3">
                <UserDropdown />
              </div>
            </>
          ) : (
            <Link
              className="inline-flex h-10 items-center rounded-md bg-gray-950 px-4 text-white transition duration-200 ease-out hover:bg-emerald-700 hover:shadow-md ml-2"
              to="/login"
            >
              Đăng nhập
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
