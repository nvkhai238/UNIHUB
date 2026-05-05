// ─── Roles — must match JWT claim values from backend ─────────────────────────
// JWT payload: { "role": "STUDENT" | "ORGANIZER" | "CHECKIN_STAFF" }
export const ROLES = Object.freeze({
  STUDENT: 'STUDENT',
  ORGANIZER: 'ORGANIZER',
  CHECKIN_STAFF: 'CHECKIN_STAFF',
});

// ─── Default redirect path per role after login ───────────────────────────────
export const ROLE_HOME = Object.freeze({
  [ROLES.STUDENT]: '/student',
  [ROLES.ORGANIZER]: '/admin',
  [ROLES.CHECKIN_STAFF]: '/checkin',
});

// ─── Route paths (single source of truth) ────────────────────────────────────
export const PATHS = Object.freeze({
  // Public
  HOME: '/',
  WORKSHOP_DETAIL: '/workshops/:id',
  LOGIN: '/login',

  // Student
  STUDENT_DASHBOARD: '/student',
  STUDENT_REGISTRATIONS: '/student/registrations',
  STUDENT_QR: '/student/registrations/:registrationId/qr',

  // Organizer
  ADMIN_DASHBOARD: '/admin',
  ADMIN_WORKSHOPS: '/admin/workshops',
  ADMIN_WORKSHOP_CREATE: '/admin/workshops/create',
  ADMIN_WORKSHOP_EDIT: '/admin/workshops/:id/edit',
  ADMIN_STATISTICS: '/admin/statistics',

  // Check-in Staff
  CHECKIN_DASHBOARD: '/checkin',
  CHECKIN_SCAN: '/checkin/scan',

  // Errors
  UNAUTHORIZED: '/unauthorized',
});
