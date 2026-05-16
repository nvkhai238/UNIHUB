import Constants from 'expo-constants';
import { getTokens, saveTokens } from './storage';

const DEFAULT_API_BASE_URL = 'http://localhost:8080';
const REQUEST_TIMEOUT_MS = 15000;

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

export function getApiBaseUrl() {
  const envUrl = typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_API_BASE_URL : undefined;
  const extraUrl = Constants.expoConfig?.extra?.apiBaseUrl || Constants.manifest2?.extra?.expoClient?.extra?.apiBaseUrl;
  return normalizeBaseUrl(envUrl || extraUrl);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    const reason = error.name === 'AbortError' ? 'timeout' : 'network';
    throw new Error(
      `Không kết nối được API (${reason}) tại ${getApiBaseUrl()}. Hãy đảm bảo backend đang chạy, điện thoại cùng Wi-Fi với máy tính, và apiBaseUrl/EXPO_PUBLIC_API_BASE_URL là IP LAN của máy backend.`
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function request(path, options = {}, allowRefresh = true) {
  const tokens = await getTokens();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (tokens.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  const response = await fetchWithTimeout(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && allowRefresh && tokens.refreshToken) {
    const refreshed = await refreshToken(tokens.refreshToken);
    if (refreshed) {
      return request(path, options, false);
    }
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.error || 'Request failed';
    throw new Error(message);
  }
  return payload;
}

export async function login(email, password) {
  const payload = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, false);
  return payload.data;
}

async function refreshToken(refreshTokenValue) {
  try {
    const response = await fetchWithTimeout(`${getApiBaseUrl()}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshTokenValue }),
    });
    if (!response.ok) {
      return false;
    }
    const payload = await response.json();
    await saveTokens(payload.data.accessToken, payload.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lấy danh sách workshops PUBLISHED diễn ra trong ngày `date`.
 * Dùng để hiển thị dropdown chọn ca cho staff.
 */
export async function getWorkshopsByDate(date) {
  const payload = await request(`/api/checkins/workshops?date=${date}`);
  return payload.data || [];
}

/**
 * Preload QR codes cho ngày `date`.
 * Nếu có `workshopId`, chỉ tải QR của workshop đó.
 */
export async function preloadCheckins(date, workshopId) {
  const query = new URLSearchParams({ date });
  if (workshopId) {
    query.set('workshopId', workshopId);
  }
  const payload = await request(`/api/checkins/preload?${query.toString()}`);
  return payload.data || [];
}

/**
 * Tra cứu QR code online.
 * Nếu có `workshopId`, backend sẽ validate QR phải thuộc đúng workshop đó.
 */
export async function lookupCheckinQr(qrCode, date, workshopId) {
  const query = new URLSearchParams({ qrCode });
  if (date) {
    query.set('date', date);
  }
  if (workshopId) {
    query.set('workshopId', workshopId);
  }
  const payload = await request(`/api/checkins/lookup?${query.toString()}`);
  return payload.data;
}

export async function syncCheckins(records) {
  const payload = await request('/api/checkins/sync', {
    method: 'POST',
    body: JSON.stringify(records),
  });
  return payload.data;
}

export async function logout(refreshTokenValue) {
  await request('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refreshTokenValue }),
  }).catch(() => undefined);
}
