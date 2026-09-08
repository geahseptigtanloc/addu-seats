import { ReservationStatus, SeatStatus, type Reservation } from '@prisma/client';
import { prisma } from '../config/prisma';
import * as reservationRepository from '../repositories/reservation.repository';
import * as seatRepository from '../repositories/seat.repository';
import { redisClient } from '../config/redis';
import { logger } from '../config/logger';
import { broadcastSeatStatusUpdate } from '../config/socket';
import { NotFoundError, ConflictError } from '../utils/AppError';

const ENTRY_TIMER_SECONDS = 5 * 60;

function entryTimerKey(reservationId: string): string {
  return `reservation:entry-timer:${reservationId}`;
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}

// Separate from the return-from-break scan, same physical QR.
// seat.status stays unchanged until front-desk approval, so no
// broadcast here, a second scan on the same seat just gets a conflict error.
export async function createReservation(userId: string, qrToken: string): Promise<Reservation> {
  const seat = await seatRepository.findByQrToken(qrToken);

  if (!seat) {
    throw new NotFoundError('Seat not found');
  }

  // UX fast-path only, the real guarantee is the DB's partial unique index.
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
    // Seat is actually OCCUPIED in this case, reservation and seat must
    // change together, same reasoning as approveReservation.
    const [res, seat] = await prisma.$transaction(async (tx) => {
      const r = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.VOIDED, endedAt: new Date() },
      });
      const s = await tx.seat.update({
        where: { id: reservation.seatId },
        data: { status: SeatStatus.AVAILABLE },
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
