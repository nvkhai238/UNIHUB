import { Link, NavLink } from 'react-router-dom';
import { getCurrentUser } from '../router/jwtUtils';

const navLinkBase =
  'inline-flex h-10 items-center rounded-md px-3 text-sm font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200';

export default function StudentHeader() {
  const user = getCurrentUser();
  const displayName = user?.fullName || user?.email || 'Sinh viên';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link
          to="/student"
          className="group inline-flex items-center gap-3 rounded-md pr-2 transition duration-200 ease-out hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-base font-bold text-white shadow-sm transition duration-200 group-hover:bg-emerald-700 group-hover:shadow-md">
            U
          </span>
          <span className="text-lg font-bold tracking-normal text-emerald-700">
            UniHub Student
          </span>
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <nav className="flex flex-wrap items-center gap-1 text-sm font-medium">
            <StudentNavLink to="/student" end>
              Tổng quan
            </StudentNavLink>
            <StudentNavLink to="/" end>
              Lịch workshop
            </StudentNavLink>
            <StudentNavLink to="/student/registrations">
              Đã đăng ký
            </StudentNavLink>
            <NotificationNavLink />
          </nav>

          <NavLink
            to="/student/profile"
            title="Hồ sơ sinh viên"
            aria-label="Hồ sơ sinh viên"
            className={({ isActive }) =>
              [
                'ml-1 flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-200',
                isActive
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:border-emerald-200 hover:bg-emerald-100',
              ].join(' ')
            }
          >
            {initial}
          </NavLink>
        </div>
      </div>
    </header>
  );
}

function StudentNavLink({ to, end = false, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          navLinkBase,
          isActive
            ? 'bg-emerald-50 text-emerald-700 shadow-sm'
            : 'text-gray-600',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}

function NotificationNavLink() {
  return (
    <NavLink
      to="/student/notifications"
      title="Thông báo"
      aria-label="Thông báo"
      className={({ isActive }) =>
        [
          'inline-flex h-10 w-10 items-center justify-center rounded-md transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200',
          isActive
            ? 'bg-emerald-50 text-emerald-700 shadow-sm'
            : 'text-gray-600',
        ].join(' ')
      }
    >
      <BellIcon />
    </NavLink>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
