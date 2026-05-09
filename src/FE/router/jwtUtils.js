/**
 * JWT utility helpers
 *
 * The backend stores the token in localStorage under the key "accessToken".
 * JWT payload shape (from blueprint/specs/auth.md §3):
 * {
 *   sub:   "uuid-of-user",
 *   email: "user@university.edu.vn",
 *   role:  "STUDENT" | "ORGANIZER" | "CHECKIN_STAFF",
 *   iat:   <unix epoch>,
 *   exp:   <unix epoch>,
 * }
 */

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_PROFILE_KEY = 'currentUser';

// ─── Token storage ────────────────────────────────────────────────────────────

/** Persist both tokens received from POST /api/auth/login */
export function saveTokens({ accessToken, refreshToken }) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_PROFILE_KEY);
}

export function saveUserProfile(user) {
  if (!user) return;
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user));
}

export function getStoredUserProfile() {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── JWT decode (no-verify — verification is done server-side) ────────────────

/**
 * Decode the JWT payload without verifying the signature.
 * Returns null if the token is missing or malformed.
 */
export function decodeToken(token) {
  if (!token) return null;
  try {
    const base64Payload = token.split('.')[1];
    if (!base64Payload) return null;
    // Replace URL-safe base64 chars back to standard base64 before decoding
    const standardBase64 = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
    // Pad with '=' to make length a multiple of 4 (required by atob)
    const padded = standardBase64.padEnd(standardBase64.length + ((4 - (standardBase64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Returns the decoded payload of the stored access token,
 * or null if no valid token is found.
 */
export function getCurrentUser() {
  const token = getAccessToken();
  const payload = decodeToken(token);
  if (!payload) return null;
  const storedUser = getStoredUserProfile();
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    fullName: storedUser?.fullName,
    ...storedUser,
    id: storedUser?.id ?? payload.sub,
    email: storedUser?.email ?? payload.email,
    role: storedUser?.role ?? payload.role,
  };
}

/**
 * Returns true when the stored access token exists and is not expired.
 * Note: this is a client-side check only. The server always re-validates.
 */
export function isTokenValid() {
  const token = getAccessToken();
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return false;
  // payload.exp is in seconds; Date.now() is in ms
  return payload.exp * 1000 > Date.now();
}

/**
 * Returns the role stored in the current JWT, or null.
 */
export function getCurrentRole() {
  return getCurrentUser()?.role ?? null;
}
