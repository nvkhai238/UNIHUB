/**
 * api.ts — Axios instance trung tâm cho UniHub Workshop
 *
 * Tính năng:
 *  1. Tự động đính kèm Authorization: Bearer <accessToken> cho mọi request.
 *  2. Nếu nhận 401 (TOKEN_EXPIRED / TOKEN_INVALID):
 *       a. Gọi POST /api/auth/refresh một lần duy nhất dù có N request bị 401 cùng lúc.
 *       b. Các request còn lại xếp vào hàng đợi (pendingQueue), chờ kết quả refresh.
 *       c. Refresh thành công → cấp token mới cho tất cả, retry mọi request trong queue.
 *       d. Refresh thất bại → reject toàn bộ queue, xóa token, chuyển về /login.
 *  3. Các lỗi 401 với code INVALID_CREDENTIALS (sai password) KHÔNG trigger refresh.
 *  4. Hàm logout() dọn dẹp token và blacklist refreshToken phía server.
 *
 * Tham chiếu blueprint:
 *  - design.md §5    — JWT payload: { sub, email, role, iat, exp }
 *  - auth.md §2      — POST /api/auth/login, /api/auth/refresh, /api/auth/logout
 *  - auth.md §3      — Access Token TTL: 24h | Refresh Token TTL: 7 ngày
 *  - auth.md §7      — Error codes: TOKEN_EXPIRED, TOKEN_INVALID, REFRESH_TOKEN_INVALID
 */

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from '../router/jwtUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Standard error response body from the Spring Boot backend */
interface ApiErrorBody {
  status: number;
  code: string;       // e.g. "TOKEN_EXPIRED", "REFRESH_TOKEN_INVALID"
  message: string;
}

/** Successful response wrapper from backend */
export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
}

/** POST /api/auth/refresh — response data shape */
interface RefreshResponseData {
  accessToken: string;
  expiresIn: number;  // seconds (86400 = 24h)
}

/** POST /api/auth/login — response data shape */
export interface LoginResponseData {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: 'STUDENT' | 'ORGANIZER' | 'CHECKIN_STAFF';
  };
}

// ─── Error codes that should trigger a token refresh ──────────────────────────
// INVALID_CREDENTIALS is a login failure — it must NOT trigger refresh.
const REFRESH_TRIGGER_CODES = new Set(['TOKEN_EXPIRED', 'TOKEN_INVALID']);

// ─── Pending queue ────────────────────────────────────────────────────────────
// While a token refresh is in flight, incoming 401 requests are queued here.
// Each entry holds resolve/reject callbacks from a Promise that the failed
// request's response interceptor is waiting on.
type QueueEntry = {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
};

let isRefreshing = false;
const pendingQueue: QueueEntry[] = [];

/** Resolve all queued requests with the new access token. */
function flushQueueSuccess(newToken: string): void {
  pendingQueue.splice(0).forEach(({ resolve }) => resolve(newToken));
}

/** Reject all queued requests (refresh failed). */
function flushQueueFailure(error: unknown): void {
  pendingQueue.splice(0).forEach(({ reject }) => reject(error));
}

// ─── Axios instance ───────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000,     // 120 s — accommodate slow cold-start / network latency
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Request interceptor — attach Bearer token ────────────────────────────────

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response interceptor — silent token refresh ─────────────────────────────

api.interceptors.response.use(
  // 2xx — pass through unchanged
  (response) => response,

  async (error: AxiosError<ApiErrorBody>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const status = error.response?.status;
    const code   = error.response?.data?.code ?? '';

    // ── Only handle 401s that indicate an expired/invalid token ─────────────
    const shouldRefresh =
      status === 401 &&
      REFRESH_TRIGGER_CODES.has(code) &&
      !originalRequest._retry;           // prevent infinite retry loops

    if (!shouldRefresh) {
      // 401 with INVALID_CREDENTIALS (wrong password) or other errors —
      // propagate to the caller unchanged.
      return Promise.reject(error);
    }

    // ── Mark this request so it won't enter the retry branch again ──────────
    originalRequest._retry = true;

    // ── If a refresh is already in flight, queue this request ───────────────
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    // ── We are the first 401 — start the refresh flow ────────────────────────
    isRefreshing = true;
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      // No refresh token stored — session is completely gone.
      isRefreshing = false;
      flushQueueFailure(error);
      handleSessionExpired();
      return Promise.reject(error);
    }

    try {
      // Use a plain axios call (NOT `api`) to avoid the interceptor loop.
      const { data } = await axios.post<ApiResponse<RefreshResponseData>>(
        `${BASE_URL}/api/auth/refresh`,
        { refreshToken },
        { timeout: 10_000 },
      );

      const newAccessToken = data.data.accessToken;

      // Persist the new token (refreshToken stays the same until logout)
      saveTokens({ accessToken: newAccessToken, refreshToken });

      // Update the Authorization header on the original failed request
      originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

      // Unblock all queued requests
      flushQueueSuccess(newAccessToken);

      return api(originalRequest);
    } catch (refreshError) {
      // Refresh token is expired or blacklisted — force logout
      flushQueueFailure(refreshError);
      handleSessionExpired();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

// ─── Session expiry handler ───────────────────────────────────────────────────

/**
 * Called when the refresh token is invalid/expired.
 * Clears tokens and redirects to /login.
 *
 * Uses `window.location` instead of react-router so this module has
 * zero dependency on React context (it can be called from anywhere).
 */
function handleSessionExpired(): void {
  clearTokens();
  // Preserve the current path so LoginPage can redirect back after re-login
  const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/login?returnTo=${returnTo}`);
}

// ─── Auth API helpers ─────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 *
 * On success, persists both tokens to localStorage.
 * The caller receives the full user object to update app state / redirect.
 */
export async function login(
  email: string,
  password: string,
): Promise<LoginResponseData> {
  const { data } = await api.post<ApiResponse<LoginResponseData>>(
    '/api/auth/login',
    { email, password },
  );
  const payload = data.data;
  saveTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken });
  return payload;
}

/**
 * POST /api/auth/logout
 *
 * Blacklists the refreshToken server-side (Redis TTL = remaining token lifetime).
 * Then wipes localStorage regardless of server response so the UI is always clean.
 *
 * References: auth.md §2 — POST /api/auth/logout, response 204 (no body)
 */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      // Fire-and-forget is acceptable here; we clear tokens regardless.
      await api.post('/api/auth/logout', { refreshToken });
    }
  } catch {
    // Swallow errors — if the server is unreachable we still clear local state.
  } finally {
    clearTokens();
  }
}

/**
 * POST /api/auth/change-password
 *
 * Requires a valid access token (handled automatically by the request interceptor).
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await api.post('/api/auth/change-password', { currentPassword, newPassword });
}

/**
 * POST /api/auth/register
 *
 * Creates a new STUDENT account and returns tokens so the user is
 * immediately logged in. Throws on duplicate email or studentId.
 */
export async function register(payload: {
  fullName: string;
  email: string;
  studentId: string;
  password: string;
}): Promise<LoginResponseData> {
  const { data } = await api.post<ApiResponse<LoginResponseData>>(
    '/api/auth/register',
    payload,
  );
  const responsePayload = data.data;
  saveTokens({
    accessToken: responsePayload.accessToken,
    refreshToken: responsePayload.refreshToken,
  });
  return responsePayload;
}

// ─── Default export ───────────────────────────────────────────────────────────

export default api;
