/**
 * API client — thin fetch wrapper pointed at the backend.
 * Automatically attaches the JWT from localStorage when present.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'addu_seats_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * @param {string} path — API path starting with /api/...
 * @param {RequestInit} [options]
 */
export async function apiClient(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }

  return response.json();
}

/** URL to start the Google OAuth flow (full-page redirect). */
export function getGoogleAuthUrl() {
  return `${API_URL}/api/auth/google`;
}

export { API_URL };
