const PENDING_RESERVATION_TOKEN_KEY = 'pendingReservationToken';
const PENDING_REVERIFY_TOKEN_KEY = 'pendingReverifyToken';

export function storePendingReservationToken(token) {
  if (typeof token === 'string' && token) {
    sessionStorage.setItem(PENDING_RESERVATION_TOKEN_KEY, token);
  }
}

export function takePendingReservationToken() {
  const token = sessionStorage.getItem(PENDING_RESERVATION_TOKEN_KEY);
  sessionStorage.removeItem(PENDING_RESERVATION_TOKEN_KEY);
  return token || null;
}

export function clearPendingReservationToken() {
  sessionStorage.removeItem(PENDING_RESERVATION_TOKEN_KEY);
}

export function storePendingReverifyToken(token) {
  if (typeof token === 'string' && token) {
    sessionStorage.setItem(PENDING_REVERIFY_TOKEN_KEY, token);
  }
}

export function takePendingReverifyToken() {
  const token = sessionStorage.getItem(PENDING_REVERIFY_TOKEN_KEY);
  sessionStorage.removeItem(PENDING_REVERIFY_TOKEN_KEY);
  return token || null;
}

export function clearPendingReverifyToken() {
  sessionStorage.removeItem(PENDING_REVERIFY_TOKEN_KEY);
}
