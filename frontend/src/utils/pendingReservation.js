const PENDING_RESERVATION_TOKEN_KEY = 'pendingReservationToken';

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
