import Constants from 'expo-constants';
import { getTokens, saveTokens } from './storage';

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:8080';

async function request(path, options = {}, allowRefresh = true) {
  const tokens = await getTokens();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (tokens.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
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
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
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
