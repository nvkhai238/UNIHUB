import { Navigate, Outlet } from 'react-router-dom';
import { getCurrentRole } from '../jwtUtils';
import { PATHS } from '../constants';

/**
 * RoleGuard — checks that the authenticated user's role is in `allowedRoles`.
 *
 * Must be used INSIDE AuthGuard (AuthGuard guarantees a valid token exists).
 *
 * If the user's role is not permitted:
 *   → redirect to /unauthorized
 *
 * @param {string[]} allowedRoles  - array of allowed role strings, e.g. ['STUDENT']
 * @param {React.ReactNode} [children] - optional; falls back to <Outlet /> if omitted
 *
 * Usage:
 *   <RoleGuard allowedRoles={[ROLES.ORGANIZER]}>
 *     <OrganizerLayout />
 *   </RoleGuard>
 */
export function RoleGuard({ allowedRoles, children }) {
  const role = getCurrentRole();

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to={PATHS.UNAUTHORIZED} replace />;
  }

  return children ?? <Outlet />;
}
