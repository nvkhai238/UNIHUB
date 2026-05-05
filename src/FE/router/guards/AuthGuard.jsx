import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { isTokenValid } from '../jwtUtils';
import { PATHS } from '../constants';

/**
 * AuthGuard — verifies that a valid (non-expired) JWT exists in localStorage.
 *
 * If the user is not authenticated:
 *   → redirect to /login, preserving the original destination in `state.from`
 *     so LoginPage can redirect back after a successful login.
 *
 * Usage (wrap role-specific layouts in the router):
 *   <AuthGuard>
 *     <RoleGuard allowedRoles={['STUDENT']}>
 *       <StudentLayout />
 *     </RoleGuard>
 *   </AuthGuard>
 */
export function AuthGuard({ children }) {
  const location = useLocation();

  if (!isTokenValid()) {
    return (
      <Navigate
        to={PATHS.LOGIN}
        state={{ from: location }}
        replace
      />
    );
  }

  // `children` may be a JSX element (e.g. <RoleGuard>) or omitted in favour of <Outlet>
  return children ?? <Outlet />;
}
