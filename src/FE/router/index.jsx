import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AuthGuard } from './guards/AuthGuard';
import { RoleGuard } from './guards/RoleGuard';
import { ROLES } from './constants';

import StudentLayout from '../layouts/StudentLayout';
import OrganizerLayout from '../layouts/OrganizerLayout';
import CheckinLayout from '../layouts/CheckinLayout';
import PublicLayout from '../layouts/PublicLayout';

import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';

import WorkshopListPage from '../pages/public/WorkshopListPage';
import WorkshopDetailPage from '../pages/public/WorkshopDetailPage';
import TicketPage from '../pages/public/TicketPage';

import StudentDashboard from '../pages/student/StudentDashboard';
import MyRegistrationsPage from '../pages/student/MyRegistrationsPage';
import MyQrCodePage from '../pages/student/MyQrCodePage';
import RegistrationDetailPage from '../pages/student/RegistrationDetailPage';
import NotificationsPage from '../pages/student/NotificationsPage';
import PaymentStatusPage from '../pages/student/PaymentStatusPage';
import StudentProfilePage from '../pages/student/StudentProfilePage';

import OrganizerDashboard from '../pages/organizer/OrganizerDashboard';
import WorkshopManagePage from '../pages/organizer/WorkshopManagePage';
import WorkshopEditPage from '../pages/organizer/WorkshopEditPage';
import StatisticsPage from '../pages/organizer/StatisticsPage';
import StudentImportPage from '../pages/organizer/StudentImportPage';
import AdminWorkshopRegistrationsPage from '../pages/organizer/AdminWorkshopRegistrationsPage';
import PaymentSimulatorPage from '../pages/organizer/PaymentSimulatorPage';
import OrganizerRefundsPage from '../pages/organizer/OrganizerRefundsPage';

import CheckinDashboard from '../pages/checkin/CheckinDashboard';
import QrScannerPage from '../pages/checkin/QrScannerPage';

import UnauthorizedPage from '../pages/error/UnauthorizedPage';
import NotFoundPage from '../pages/error/NotFoundPage';

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <WorkshopListPage /> },
      { path: '/workshops/:id', element: <WorkshopDetailPage /> },
      { path: '/ticket', element: <TicketPage /> },
    ],
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: (
      <AuthGuard>
        <RoleGuard allowedRoles={[ROLES.STUDENT]}>
          <StudentLayout />
        </RoleGuard>
      </AuthGuard>
    ),
    children: [
      { path: '/student', element: <StudentDashboard /> },
      { path: '/student/profile', element: <StudentProfilePage /> },
      { path: '/student/workshops', element: <WorkshopListPage /> },
      { path: '/student/workshops/:id', element: <WorkshopDetailPage /> },
      { path: '/student/registrations', element: <MyRegistrationsPage /> },
      { path: '/student/registrations/:registrationId', element: <RegistrationDetailPage /> },
      { path: '/student/registrations/:registrationId/qr', element: <MyQrCodePage /> },
      { path: '/student/registrations/:registrationId/payment', element: <PaymentStatusPage /> },
      { path: '/student/notifications', element: <NotificationsPage /> },
    ],
  },
  {
    element: (
      <AuthGuard>
        <RoleGuard allowedRoles={[ROLES.ORGANIZER]}>
          <OrganizerLayout />
        </RoleGuard>
      </AuthGuard>
    ),
    children: [
      { path: '/admin', element: <OrganizerDashboard /> },
      { path: '/admin/workshops', element: <WorkshopManagePage /> },
      { path: '/admin/workshops/create', element: <WorkshopManagePage /> },
      { path: '/admin/workshops/:id/edit', element: <WorkshopEditPage /> },
      { path: '/admin/workshops/:id/registrations', element: <AdminWorkshopRegistrationsPage /> },
      { path: '/admin/refunds', element: <OrganizerRefundsPage /> },
      { path: '/admin/statistics', element: <StatisticsPage /> },
      { path: '/admin/student-imports', element: <StudentImportPage /> },
      { path: '/admin/payment-simulator', element: <PaymentSimulatorPage /> },
    ],
  },
  {
    element: (
      <AuthGuard>
        <RoleGuard allowedRoles={[ROLES.CHECKIN_STAFF]}>
          <CheckinLayout />
        </RoleGuard>
      </AuthGuard>
    ),
    children: [
      { path: '/checkin', element: <CheckinDashboard /> },
      { path: '/checkin/scan', element: <QrScannerPage /> },
    ],
  },
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  { path: '*', element: <NotFoundPage /> },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
