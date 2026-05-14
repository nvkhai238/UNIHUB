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
      `Khong ket noi duoc API (${reason}) tai ${getApiBaseUrl()}. Hay dam bao backend dang chay, dien thoai cung Wi-Fi voi may tinh, va apiBaseUrl/EXPO_PUBLIC_API_BASE_URL la IP LAN cua may backend.`
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

export async function preloadCheckins(date) {
  const payload = await request(`/api/checkins/preload?date=${date}`);
  return payload.data || [];
}

export async function lookupCheckinQr(qrCode, date) {
  const query = new URLSearchParams({ qrCode });
  if (date) {
    query.set('date', date);
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
