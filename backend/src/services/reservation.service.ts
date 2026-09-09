import {
  ReservationStatus,
  SeatStatus,
  ValidationEventType,
  OccupancyEventType,
  type Reservation,
  type Seat,
} from '@prisma/client';
import { prisma } from '../config/prisma';
import * as reservationRepository from '../repositories/reservation.repository';
import * as seatRepository from '../repositories/seat.repository';
import * as validationEventRepository from '../repositories/validationEvent.repository';
import { redisClient } from '../config/redis';
import { logger } from '../config/logger';
import {
  broadcastSeatStatusUpdate,
  notifySeatFlagged,
  notifyAdminsSeatFlagged,
} from '../config/socket';
import { NotFoundError, ConflictError } from '../utils/AppError';

const ENTRY_TIMER_SECONDS = 5 * 60;

function entryTimerKey(reservationId: string): string {
  return `reservation:entry-timer:${reservationId}`;
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}

const BREAK_COOLDOWN_SECONDS = 30 * 60;

function breakCooldownKey(userId: string): string {
  return `user:break-cooldown:${userId}`;
}

// Fails open (assumes no cooldown) on a Redis error, blocking a student's
// entire reservation over an unrelated Redis hiccup is worse than
// occasionally missing a 30-min cooldown. No Postgres fallback exists for
// this one, unlike the entry timer; accepted trade-off.
async function isOnBreakCooldown(userId: string): Promise<boolean> {
  try {
    return (await redisClient.get(breakCooldownKey(userId))) !== null;
  } catch (err) {
    logger.warn({ err, userId }, 'Failed to check break cooldown in Redis — assuming none');
    return false;
  }
}

// Separate from the return-from-break scan, same physical QR.
// seat.status stays unchanged until front-desk approval, so no
// broadcast here, a second scan on the same seat just gets a conflict error.
export async function createReservation(userId: string, qrToken: string): Promise<Reservation> {
  if (await isOnBreakCooldown(userId)) {
    throw new ConflictError('You are on a break cooldown — please try again later');
  }

  const seat = await seatRepository.findByQrToken(qrToken);

  if (!seat) {
    throw new NotFoundError('Seat not found');
  }

  // UX fast-path only — the real guarantee is the DB's partial unique index.
  const [activeOnSeat, activeForUser] = await Promise.all([
    reservationRepository.findActiveBySeat(seat.id),
    reservationRepository.findActiveByUser(userId),
  ]);

  if (activeOnSeat) {
    throw new ConflictError('Seat is already reserved');
  }

  if (activeForUser) {
    throw new ConflictError('You already have an active reservation');
  }

  let reservation: Reservation;
  try {
    reservation = await reservationRepository.create({ userId, seatId: seat.id });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new ConflictError('Seat or user became unavailable — please try again');
    }
    throw err;
  }

  // Best-effort, powers the admin queue's remaining-time display,
  // not the actual expiry check.
  try {
    await redisClient.set(entryTimerKey(reservation.id), '1', { EX: ENTRY_TIMER_SECONDS });
  } catch (err) {
    logger.warn({ err, reservationId: reservation.id }, 'Failed to set entry timer in Redis');
  }

  return reservation;
}

// PENDING only, ending an already-CONFIRMED reservation (checkout) is a
// different action with a different resulting status, not built yet.
export async function cancelReservation(
  userId: string,
  reservationId: string,
): Promise<Reservation> {
  const reservation = await reservationRepository.findById(reservationId);

  // Not found and "not yours" are treated the same, to avoid confirming
  // to a caller that a reservation ID exists but belongs to someone else.
  if (!reservation || reservation.userId !== userId) {
    throw new NotFoundError('Reservation not found');
  }

  if (reservation.status !== ReservationStatus.PENDING) {
    throw new ConflictError('Only a pending reservation can be cancelled');
  }

  const updated = await reservationRepository.update(reservationId, {
    status: ReservationStatus.CANCELLED,
    endedAt: new Date(),
  });

  // Best-effort cleanup, the key would self-expire anyway just cleaner not to leave it.
  try {
    await redisClient.del(entryTimerKey(reservationId));
  } catch (err) {
    logger.warn({ err, reservationId }, 'Failed to clear entry timer in Redis');
  }

  return updated;
}
// Front desk staff visually check the student's name/ID against the
// reservation before calling this — this API records the outcome, it
// can't verify that check itself.
export async function approveReservation(reservationId: string): Promise<Reservation> {
  const reservation = await reservationRepository.findById(reservationId);

  if (!reservation) {
    throw new NotFoundError('Reservation not found');
  }

  if (reservation.status !== ReservationStatus.PENDING) {
    throw new ConflictError('Only a pending reservation can be approved');
  }

  // Both updates succeed or fail together — a CONFIRMED reservation with
  // a seat still marked AVAILABLE would be a real data-integrity bug.
  // Composed directly here (not via the single-model repositories) since
  // a two-model transaction doesn't belong to either one alone.
  const [updatedReservation, updatedSeat] = await prisma.$transaction(async (tx) => {
    const res = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CONFIRMED, confirmedAt: new Date() },
    });
    const seat = await tx.seat.update({
      where: { id: reservation.seatId },
      data: { status: SeatStatus.OCCUPIED },
    });
    return [res, seat] as const;
  });

  try {
    await redisClient.del(entryTimerKey(reservationId));
  } catch (err) {
    logger.warn({ err, reservationId }, 'Failed to clear entry timer in Redis');
  }

  try {
    broadcastSeatStatusUpdate(updatedSeat.building, updatedSeat.floor, {
      seatId: updatedSeat.id,
      status: updatedSeat.status,
    });
  } catch (err) {
    logger.warn({ err, reservationId }, 'Failed to broadcast seat status update');
  }

  return updatedReservation;
}

async function getRemainingSeconds(reservationId: string, createdAt: Date): Promise<number> {
  try {
    const ttl = await redisClient.ttl(entryTimerKey(reservationId));
    if (ttl >= 0) {
      return ttl;
    }
  } catch (err) {
    logger.warn({ err, reservationId }, 'Failed to read entry timer from Redis');
  }

  // Redis miss (expired, cleared, or never set), fall back to computing
  // from Postgres's createdAt.
  const elapsedSeconds = (Date.now() - createdAt.getTime()) / 1000;
  return Math.max(0, Math.round(ENTRY_TIMER_SECONDS - elapsedSeconds));
}

export interface PendingQueueItem {
  reservationId: string;
  studentName: string;
  studentIdLast4: string | null;
  seatId: string;
  building: string;
  floor: number;
  remainingSeconds: number;
}

export async function getPendingQueue(): Promise<PendingQueueItem[]> {
  const pending = await reservationRepository.findPending();

  return Promise.all(
    pending.map(async (r) => ({
      reservationId: r.id,
      studentName: r.user.name,
      studentIdLast4: r.user.studentIdLast4,
      seatId: r.seat.id,
      building: r.seat.building,
      floor: r.seat.floor,
      remainingSeconds: await getRemainingSeconds(r.id, r.createdAt),
    })),
  );
}

// Admin-only forced end of an active reservation.
// Unlike student cancellation (PENDING only), void works on PENDING or CONFIRMED.
export async function voidReservation(reservationId: string): Promise<Reservation> {
  const reservation = await reservationRepository.findById(reservationId);

  if (!reservation) {
    throw new NotFoundError('Reservation not found');
  }

  const wasConfirmed = reservation.status === ReservationStatus.CONFIRMED;
  const isActive = reservation.status === ReservationStatus.PENDING || wasConfirmed;

  if (!isActive) {
    throw new ConflictError('Only an active reservation can be voided');
  }

  let updatedReservation: Reservation;

  if (wasConfirmed) {
    // Seat is OCCUPIED in this case. Reservation, seat, and the
    // occupancy log entry must all change together.
    const [res, seat] = await prisma.$transaction(async (tx) => {
      const r = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.VOIDED, endedAt: new Date() },
      });
      const s = await tx.seat.update({
        where: { id: reservation.seatId },
        data: { status: SeatStatus.AVAILABLE },
      });
      await tx.occupancyLog.create({
        data: { reservationId, eventType: OccupancyEventType.VACATED },
      });
      return [r, s] as const;
    });

    updatedReservation = res;

    try {
      broadcastSeatStatusUpdate(seat.building, seat.floor, {
        seatId: seat.id,
        status: seat.status,
      });
    } catch (err) {
      logger.warn({ err, reservationId }, 'Failed to broadcast seat status update');
    }
  } else {
    // PENDING, seat.status was never changed on creation, nothing to revert.
    updatedReservation = await reservationRepository.update(reservationId, {
      status: ReservationStatus.VOIDED,
      endedAt: new Date(),
    });
  }

  try {
    await redisClient.del(entryTimerKey(reservationId));
  } catch (err) {
    logger.warn({ err, reservationId }, 'Failed to clear entry timer in Redis');
  }

  return updatedReservation;
}

const BREAK_BASE_SECONDS = 5 * 60;
const BREAK_EXTENSION_SECONDS = 5 * 60;
const BREAK_MAX_EXTENSIONS = 2;
const BREAK_MAX_SECONDS = BREAK_BASE_SECONDS + BREAK_MAX_EXTENSIONS * BREAK_EXTENSION_SECONDS; // 15 min

function breakTimerKey(reservationId: string): string {
  return `reservation:break-timer:${reservationId}`;
}

interface BreakTimerState {
  breakStartedAt: string; // ISO timestamp, durations computed from this, not from Redis TTL alone
  extensionsUsed: number;
}

// Reservation.status stays CONFIRMED throughout a break. Only Seat.status
// changes (to OCCUPIED_ON_BREAK) so "already on break" has to be checked
// against the seat, not the reservation. Without this check, a student
// could bypass the 15-min cap entirely by calling start again instead of
// extend, resetting the timer to a fresh 5 minutes each time.
export async function startBreak(userId: string, reservationId: string): Promise<Seat> {
  const reservation = await reservationRepository.findById(reservationId);

  if (!reservation || reservation.userId !== userId) {
    throw new NotFoundError('Reservation not found');
  }

  if (reservation.status !== ReservationStatus.CONFIRMED) {
    throw new ConflictError('Only a confirmed reservation can start a break');
  }

  const seat = await seatRepository.findById(reservation.seatId);

  if (!seat || seat.status !== SeatStatus.OCCUPIED) {
    throw new ConflictError('A break is already in progress for this reservation');
  }

  const updatedSeat = await prisma.$transaction(async (tx) => {
    const s = await tx.seat.update({
      where: { id: reservation.seatId },
      data: { status: SeatStatus.OCCUPIED_ON_BREAK },
    });
    await tx.occupancyLog.create({
      data: { reservationId, eventType: OccupancyEventType.VACATED },
    });
    return s;
  });

  // Best-effort. The timer's authoritative "started" fact is the seat/log
  // update above, which already succeeded; this just powers extend/return.
  const state: BreakTimerState = { breakStartedAt: new Date().toISOString(), extensionsUsed: 0 };
  try {
    await redisClient.set(breakTimerKey(reservationId), JSON.stringify(state), {
      EX: BREAK_BASE_SECONDS,
    });
  } catch (err) {
    logger.warn({ err, reservationId }, 'Failed to set break timer in Redis');
  }

  try {
    broadcastSeatStatusUpdate(updatedSeat.building, updatedSeat.floor, {
      seatId: updatedSeat.id,
      status: updatedSeat.status,
    });
  } catch (err) {
    logger.warn({ err, reservationId }, 'Failed to broadcast seat status update');
  }

  return updatedSeat;
}

// Total break duration is capped relative to breakStartedAt (5, 10, then
// 15 min), not "add 5 more minutes to whatever's left", otherwise the
// 15-minute cap could never actually be enforced.
export async function extendBreak(
  userId: string,
  reservationId: string,
): Promise<{ remainingSeconds: number }> {
  const reservation = await reservationRepository.findById(reservationId);

  if (!reservation || reservation.userId !== userId) {
    throw new NotFoundError('Reservation not found');
  }

  const raw = await redisClient.get(breakTimerKey(reservationId));

  if (!raw) {
    throw new ConflictError('No active break to extend');
  }

  const state = JSON.parse(raw) as BreakTimerState;

  if (state.extensionsUsed >= BREAK_MAX_EXTENSIONS) {
    throw new ConflictError('Maximum break extensions already used');
  }

  state.extensionsUsed += 1;
  const allowedSeconds = Math.min(
    BREAK_BASE_SECONDS + state.extensionsUsed * BREAK_EXTENSION_SECONDS,
    BREAK_MAX_SECONDS,
  );
  const elapsedSeconds = (Date.now() - new Date(state.breakStartedAt).getTime()) / 1000;
  const remainingSeconds = Math.max(0, Math.round(allowedSeconds - elapsedSeconds));

  await redisClient.set(breakTimerKey(reservationId), JSON.stringify(state), {
    EX: remainingSeconds || 1, // EX must be > 0; guards an already-expired edge case
  });

  return { remainingSeconds };
}

// QR scan, not a UI click (unlike start/extend).
// Cooldown is based on whether both extensions were used (reached the
// 15-min cap), not on whether the timer actually expired. A student who
// scans back in with e.g. 1s left after using both extensions still gets
// the cooldown, since they exhausted the maximum either way.
export async function returnFromBreak(userId: string, qrToken: string): Promise<Seat> {
  const seat = await seatRepository.findByQrToken(qrToken);

  if (!seat) {
    throw new NotFoundError('Seat not found');
  }

  if (seat.status !== SeatStatus.OCCUPIED_ON_BREAK) {
    throw new ConflictError('This seat is not currently on break');
  }

  const reservation = await reservationRepository.findActiveBySeat(seat.id);

  if (!reservation || reservation.userId !== userId) {
    throw new NotFoundError('No matching reservation found for this seat');
  }

  // Missing key (expired, or lost to the best-effort write in startBreak)
  // is treated as 0 extensions used, fails open, no cooldown applied,
  // consistent with how Redis misses are handled everywhere else here.
  let extensionsUsed = 0;
  try {
    const raw = await redisClient.get(breakTimerKey(reservation.id));
    if (raw) {
      extensionsUsed = (JSON.parse(raw) as BreakTimerState).extensionsUsed;
    }
  } catch (err) {
    logger.warn({ err, reservationId: reservation.id }, 'Failed to read break timer from Redis');
  }
  const cooldownApplies = extensionsUsed >= BREAK_MAX_EXTENSIONS;

  const updatedSeat = await prisma.$transaction(async (tx) => {
    const s = await tx.seat.update({
      where: { id: seat.id },
      data: { status: SeatStatus.OCCUPIED },
    });
    await tx.validationEvent.create({
      data: { reservationId: reservation.id, eventType: ValidationEventType.BREAK_RETURN },
    });
    await tx.occupancyLog.create({
      data: { reservationId: reservation.id, eventType: OccupancyEventType.OCCUPIED },
    });
    return s;
  });

  try {
    await redisClient.del(breakTimerKey(reservation.id));
  } catch (err) {
    logger.warn({ err, reservationId: reservation.id }, 'Failed to clear break timer in Redis');
  }

  if (cooldownApplies) {
    try {
      await redisClient.set(breakCooldownKey(userId), '1', { EX: BREAK_COOLDOWN_SECONDS });
    } catch (err) {
      logger.warn({ err, userId }, 'Failed to set break cooldown in Redis');
    }
  }

  try {
    broadcastSeatStatusUpdate(updatedSeat.building, updatedSeat.floor, {
      seatId: updatedSeat.id,
      status: updatedSeat.status,
    });
  } catch (err) {
    logger.warn({ err, reservationId: reservation.id }, 'Failed to broadcast seat status update');
  }

  return updatedSeat;
}

const FLAG_WINDOW_SECONDS = 10 * 60;

function seatFlagKey(seatId: string): string {
  return `seat:flag:${seatId}`;
}

// Any authenticated user can flag someone else's seat as apparently
// vacant. Not the seat's own reservation holder,
// and not a seat that isn't currently OCCUPIED (a seat on break or
// already free has nothing to flag).
export async function flagSeat(flaggingUserId: string, seatId: string): Promise<void> {
  const seat = await seatRepository.findById(seatId);

  if (!seat) {
    throw new NotFoundError('Seat not found');
  }

  if (seat.status !== SeatStatus.OCCUPIED) {
    throw new ConflictError('Only an occupied seat can be flagged');
  }

  const reservation = await reservationRepository.findActiveBySeat(seatId);

  if (!reservation) {
    // Shouldn't happen if seat.status is OCCUPIED.
    // Guards a data inconsistency rather than a normal, expected case.
    throw new ConflictError('No active reservation found for this seat');
  }

  if (reservation.userId === flaggingUserId) {
    throw new ConflictError('You cannot flag your own reservation');
  }

  // Two students flagging the same seat at once
  // can't both succeed (a plain get-then-set would race).
  const set = await redisClient.set(seatFlagKey(seatId), reservation.id, {
    expiration: { type: 'EX', value: FLAG_WINDOW_SECONDS },
    condition: 'NX',
  });

  if (set === null) {
    throw new ConflictError('This seat has already been flagged');
  }

  try {
    notifySeatFlagged(reservation.userId, { seatId, windowSeconds: FLAG_WINDOW_SECONDS });
  } catch (err) {
    logger.warn(
      { err, seatId, reservationId: reservation.id },
      'Failed to notify reservation holder of flag',
    );
  }

  try {
    notifyAdminsSeatFlagged({ seatId, reservationId: reservation.id });
  } catch (err) {
    logger.warn({ err, seatId, reservationId: reservation.id }, 'Failed to notify admins of flag');
  }
}

// Clears a flag by proving the holder is actually still there (see
// flagSeat). Seat.status never changed during a flag, so there's nothing
// to transition back and no OccupancyLog entry only the scan itself is
// recorded, via ValidationEvent.
export async function reverifyPresence(userId: string, qrToken: string): Promise<void> {
  const seat = await seatRepository.findByQrToken(qrToken);

  if (!seat) {
    throw new NotFoundError('Seat not found');
  }

  const reservation = await reservationRepository.findActiveBySeat(seat.id);

  if (!reservation || reservation.userId !== userId) {
    throw new NotFoundError('No matching reservation found for this seat');
  }

  // getDel, same atomic get-and-delete pattern as the OAuth exchange
  // code. Avoids a check-then-delete race and confirms
  // there was actually an active flag to clear.
  const flaggedReservationId = await redisClient.getDel(seatFlagKey(seat.id));

  if (!flaggedReservationId) {
    throw new ConflictError('No active flag to re-verify');
  }

  await validationEventRepository.create({
    reservationId: reservation.id,
    eventType: ValidationEventType.FLAG_REVERIFICATION,
  });
}
