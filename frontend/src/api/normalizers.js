const SEAT_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  OCCUPIED_ON_BREAK: 'on_break',
  UNAVAILABLE: 'disabled',
};

const RESERVATION_STATUS = {
  PENDING: 'pending_entry',
  CONFIRMED: 'active',
  CANCELLED: 'cancelled',
  FORFEITED: 'expired',
  EVICTED: 'expired',
  VOIDED: 'cancelled',
  COMPLETED: 'completed',
};

export function normalizeRole(role) {
  return typeof role === 'string' ? role.toLowerCase() : role;
}

export function normalizeUser(user) {
  if (!user) return user;
  return {
    ...user,
    role: normalizeRole(user.role),
    adduIdLast4: user.adduIdLast4 ?? user.studentIdLast4 ?? null,
  };
}

export function normalizeSeatStatus(status) {
  return SEAT_STATUS[status] || String(status || 'available').toLowerCase();
}

export function seatLabelFromQrToken(token) {
  if (typeof token !== 'string' || !token.startsWith('seat:')) return null;
  return token.slice('seat:'.length).toUpperCase();
}

export function normalizeSeat(seat, canonical = {}) {
  if (!seat && !canonical) return null;
  const source = seat || {};
  const label = source.label || canonical.label || seatLabelFromQrToken(source.currentQrToken);
  const mappedSeat = CANONICAL_SEATS.get(label) || {};
  return {
    ...mappedSeat,
    ...canonical,
    ...source,
    seatId: source.seatId || source.id || canonical.seatId,
    label,
    seatType: source.seatType || canonical.seatType || mappedSeat.seatType || 'individual',
    status: normalizeSeatStatus(source.status || canonical.status),
  };
}

export function normalizeReservation(payload, fallback = {}) {
  const envelope = payload || {};
  const source = envelope.reservation || envelope;
  if (!source || (!source.reservationId && !source.id)) return null;

  const seat = normalizeSeat(source.seat, fallback.seat || {});
  const rawStatus = source.status;
  let status = RESERVATION_STATUS[rawStatus] || String(rawStatus || '').toLowerCase();
  if (rawStatus === 'CONFIRMED' && seat?.status === 'on_break') status = 'on_break';

  const remainingSeconds = Number(source.remainingSeconds);
  const breakRemainingSeconds = Number(source.breakRemainingSeconds);
  const entryDeadline = source.entryDeadline || (
    Number.isFinite(remainingSeconds)
      ? new Date(Date.now() + Math.max(0, remainingSeconds) * 1000).toISOString()
      : null
  );
  const breakDeadline = source.breakDeadline || (
    Number.isFinite(breakRemainingSeconds)
      ? new Date(Date.now() + Math.max(0, breakRemainingSeconds) * 1000).toISOString()
      : null
  );

  return {
    ...source,
    reservationId: source.reservationId || source.id,
    status,
    seat,
    user: normalizeUser(source.user || fallback.user),
    entryDeadline,
    breakDeadline,
    breakMinutesUsed: source.breakMinutesUsed || fallback.breakMinutesUsed || 5,
    qrToken: envelope.qrToken || source.qrToken || source.reservationId || source.id,
  };
}

export function normalizePendingReservation(item) {
  const currentQrToken = item.currentQrToken;
  const label = seatLabelFromQrToken(currentQrToken) || item.seatId;
  return {
    reservationId: item.reservationId,
    status: 'pending_entry',
    entryDeadline: new Date(Date.now() + Math.max(0, item.remainingSeconds || 0) * 1000).toISOString(),
    user: normalizeUser({ name: item.studentName, studentIdLast4: item.studentIdLast4 }),
    seat: normalizeSeat({
      id: item.seatId,
      label,
      building: item.building,
      floor: item.floor,
      currentQrToken,
      status: 'AVAILABLE',
    }),
  };
}
import { getGisbertPreviewSeats } from '../data/gisbertPreviewSeats.js';
import { getMiguelProPreviewSeats } from '../data/miguelProMap.js';

const CANONICAL_SEATS = new Map([
  ...[1, 2, 3, 4].flatMap((floor) => getGisbertPreviewSeats(floor)),
  ...getMiguelProPreviewSeats(1),
].map((seat) => [seat.label, seat]));
