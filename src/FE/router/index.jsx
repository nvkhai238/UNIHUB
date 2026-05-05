import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { AuthGuard } from './guards/AuthGuard';
import { RoleGuard } from './guards/RoleGuard';
import { ROLES } from './constants';

// ─── Layouts ──────────────────────────────────────────────────────────────────
import StudentLayout from '../layouts/StudentLayout';
import OrganizerLayout from '../layouts/OrganizerLayout';
import CheckinLayout from '../layouts/CheckinLayout';
import PublicLayout from '../layouts/PublicLayout';

// ─── Auth Pages ───────────────────────────────────────────────────────────────
import LoginPage from '../pages/auth/LoginPage';

// ─── Public Pages ─────────────────────────────────────────────────────────────
import WorkshopListPage from '../pages/public/WorkshopListPage';
import WorkshopDetailPage from '../pages/public/WorkshopDetailPage';

// ─── Student Pages ────────────────────────────────────────────────────────────
import StudentDashboard from '../pages/student/StudentDashboard';
import MyRegistrationsPage from '../pages/student/MyRegistrationsPage';
import MyQrCodePage from '../pages/student/MyQrCodePage';

// ─── Organizer Pages ──────────────────────────────────────────────────────────
import OrganizerDashboard from '../pages/organizer/OrganizerDashboard';
import WorkshopManagePage from '../pages/organizer/WorkshopManagePage';
import WorkshopCreatePage from '../pages/organizer/WorkshopCreatePage';
import WorkshopEditPage from '../pages/organizer/WorkshopEditPage';
import StatisticsPage from '../pages/organizer/StatisticsPage';

// ─── Check-in Staff Pages ─────────────────────────────────────────────────────
import CheckinDashboard from '../pages/checkin/CheckinDashboard';
import QrScannerPage from '../pages/checkin/QrScannerPage';

// ─── Utility Pages ────────────────────────────────────────────────────────────
import UnauthorizedPage from '../pages/error/UnauthorizedPage';
import NotFoundPage from '../pages/error/NotFoundPage';

// ─────────────────────────────────────────────────────────────────────────────
// Route tree
// ─────────────────────────────────────────────────────────────────────────────
const router = createBrowserRouter([
  // ── Public routes (no auth required) ───────────────────────────────────────
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/',
        element: <WorkshopListPage />,
      },
      {
        path: '/workshops/:id',
        element: <WorkshopDetailPage />,
      },
    ],
  },

  // ── Auth routes ─────────────────────────────────────────────────────────────
  {
    path: '/login',
    element: <LoginPage />,
  },

  // ── Student routes — requires STUDENT role ──────────────────────────────────
  {
    element: (
      <AuthGuard>
        <RoleGuard allowedRoles={[ROLES.STUDENT]}>
          <StudentLayout />
        </RoleGuard>
      </AuthGuard>
    ),
    children: [
      {
        path: '/student',
        element: <StudentDashboard />,
      },
      {
        path: '/student/registrations',
        element: <MyRegistrationsPage />,
      },
      {
        path: '/student/registrations/:registrationId/qr',
        element: <MyQrCodePage />,
      },
    ],
  },

  // ── Organizer routes — requires ORGANIZER role ──────────────────────────────
  {
    element: (
      <AuthGuard>
        <RoleGuard allowedRoles={[ROLES.ORGANIZER]}>
          <OrganizerLayout />
        </RoleGuard>
      </AuthGuard>
    ),
    children: [
      {
        path: '/admin',
        element: <OrganizerDashboard />,
      },
      {
        path: '/admin/workshops',
        element: <WorkshopManagePage />,
      },
      {
        path: '/admin/workshops/create',
        element: <WorkshopCreatePage />,
      },
      {
        path: '/admin/workshops/:id/edit',
        element: <WorkshopEditPage />,
      },
      {
        path: '/admin/statistics',
        element: <StatisticsPage />,
      },
    ],
  },

  // ── Check-in Staff routes — requires CHECKIN_STAFF role ─────────────────────
  {
    element: (
      <AuthGuard>
        <RoleGuard allowedRoles={[ROLES.CHECKIN_STAFF]}>
          <CheckinLayout />
        </RoleGuard>
      </AuthGuard>
    ),
    children: [
      {
        path: '/checkin',
        element: <CheckinDashboard />,
      },
      {
        path: '/checkin/scan',
        element: <QrScannerPage />,
      },
    ],
  },

  // ── Error routes ────────────────────────────────────────────────────────────
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
