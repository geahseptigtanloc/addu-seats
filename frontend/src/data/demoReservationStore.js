const STORAGE_KEY = 'addu_seats_demo_reservation';
const CHANGE_EVENT = 'addu-seats:demo-reservation-change';

const ACTIVE_STATUSES = new Set(['pending_entry', 'active', 'on_break']);

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function publishChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function saveReservation(reservation) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reservation));
  publishChange();
  return clone(reservation);
}

function readReservation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function expireIfNeeded(reservation) {
  if (!reservation) return null;

  const now = Date.now();
  const entryExpired = reservation.status === 'pending_entry'
    && new Date(reservation.entryDeadline).getTime() <= now;
  const breakExpired = reservation.status === 'on_break'
    && new Date(reservation.breakDeadline).getTime() <= now;

  if (!entryExpired && !breakExpired) return reservation;

  return saveReservation({
    ...reservation,
    status: 'expired',
    expiredAt: new Date().toISOString(),
    expiryReason: entryExpired ? 'entry_deadline' : 'break_deadline',
  });
}

export function getDemoReservation({ includeTerminal = false } = {}) {
  const reservation = expireIfNeeded(readReservation());
  if (!reservation) return null;
  return includeTerminal || ACTIVE_STATUSES.has(reservation.status) ? clone(reservation) : null;
}

export function createDemoReservation({ seat, user }) {
  const current = getDemoReservation();
  if (current) {
    throw new Error('You already have a reservation in progress.');
  }

  const now = Date.now();
  const reservationId = `demo-reservation-${now}`;
  const qrToken = `demo:${reservationId}`;
  const reservation = {
    reservationId,
    userId: user.userId,
    status: 'pending_entry',
    reservedAt: new Date(now).toISOString(),
    entryDeadline: new Date(now + 5 * 60 * 1000).toISOString(),
    verifiedAt: null,
    checkedOutAt: null,
    breakStartedAt: null,
    breakDeadline: null,
    breakMinutesUsed: 0,
    cooldownUntil: null,
    qrToken,
    demo: true,
    user: {
      name: user.name,
      adduIdLast4: user.adduIdLast4,
    },
    seat: clone(seat),
  };

  return saveReservation(reservation);
}

export function updateDemoReservation(reservationId, action, details = {}) {
  const reservation = getDemoReservation({ includeTerminal: true });
  if (!reservation || reservation.reservationId !== reservationId) {
    throw new Error('Demo reservation was not found.');
  }

  const now = new Date();
  let next;

  switch (action) {
    case 'approve':
      if (reservation.status !== 'pending_entry') throw new Error('Reservation is no longer pending.');
      next = { ...reservation, status: 'active', entryDeadline: null, verifiedAt: now.toISOString() };
      break;
    case 'reject':
      if (reservation.status !== 'pending_entry') throw new Error('Reservation is no longer pending.');
      next = { ...reservation, status: 'cancelled', entryDeadline: null, rejectionReason: details.reason || '' };
      break;
    case 'cancel':
      if (reservation.status !== 'pending_entry') throw new Error('Only a pending reservation can be cancelled.');
      next = { ...reservation, status: 'cancelled', entryDeadline: null };
      break;
    case 'checkout':
      if (!['active', 'on_break'].includes(reservation.status)) throw new Error('No active session to check out.');
      next = { ...reservation, status: 'completed', checkedOutAt: now.toISOString(), breakDeadline: null };
      break;
    case 'start_break':
      if (reservation.status !== 'active') throw new Error('Breaks can only start during an active session.');
      if (reservation.cooldownUntil && new Date(reservation.cooldownUntil) > now) {
        throw new Error('Breaks are unavailable during the cooldown period.');
      }
      next = {
        ...reservation,
        status: 'on_break',
        breakStartedAt: now.toISOString(),
        breakDeadline: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
        breakMinutesUsed: 5,
      };
      break;
    case 'extend_break':
      if (reservation.status !== 'on_break') throw new Error('This reservation is not on break.');
      if (reservation.breakMinutesUsed >= 15) throw new Error('The 15-minute break maximum has been reached.');
      next = {
        ...reservation,
        breakDeadline: new Date(new Date(reservation.breakDeadline).getTime() + 5 * 60 * 1000).toISOString(),
        breakMinutesUsed: reservation.breakMinutesUsed + 5,
      };
      break;
    case 'qr_return': {
      if (reservation.status !== 'on_break') throw new Error('This reservation is not on break.');
      const usedFullAllowance = reservation.breakMinutesUsed === 15;
      next = {
        ...reservation,
        status: 'active',
        breakStartedAt: null,
        breakDeadline: null,
        breakMinutesUsed: 0,
        cooldownUntil: usedFullAllowance
          ? new Date(now.getTime() + 30 * 60 * 1000).toISOString()
          : null,
      };
      break;
    }
    default:
      throw new Error('Unknown demo reservation action.');
  }

  return saveReservation(next);
}

export function getDemoPendingReservations() {
  const reservation = getDemoReservation();
  return reservation?.status === 'pending_entry' ? [reservation] : [];
}

export function getDemoSeatStatus(seatId) {
  const reservation = getDemoReservation();
  if (!reservation || reservation.seat?.seatId !== seatId) return null;
  if (reservation.status === 'pending_entry') return 'pending';
  if (reservation.status === 'active') return 'occupied';
  if (reservation.status === 'on_break') return 'on_break';
  return null;
}

export function subscribeToDemoReservation(callback) {
  const handleStorage = (event) => {
    if (!event.key || event.key === STORAGE_KEY) callback();
  };
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', handleStorage);
  };
}
