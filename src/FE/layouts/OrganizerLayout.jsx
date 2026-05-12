import { NavLink, Outlet } from 'react-router-dom';
import UserDropdown from '../components/UserDropdown';

export default function OrganizerLayout() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] text-gray-950">
      <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="font-bold text-rose-700">UniHub Organizer</div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <nav className="flex flex-wrap gap-2 text-sm font-medium">
              <OrganizerNavLink to="/admin" end>Tong quan</OrganizerNavLink>
              <OrganizerNavLink to="/admin/workshops" end>Workshop</OrganizerNavLink>
              <OrganizerNavLink to="/admin/statistics">Thong ke</OrganizerNavLink>
              <OrganizerNavLink to="/admin/student-imports">Import SV</OrganizerNavLink>
            </nav>
            <div className="ml-2">
              <UserDropdown />
            </div>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

function OrganizerNavLink({ to, children, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'rounded-md border border-transparent px-3 py-2 transition duration-200 ease-out',
          isActive
            ? 'border-rose-200 bg-rose-100 text-rose-800 shadow-sm'
            : 'text-gray-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}
