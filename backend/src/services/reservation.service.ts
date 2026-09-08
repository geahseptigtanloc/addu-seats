import type { Reservation } from '@prisma/client';
import * as reservationRepository from '../repositories/reservation.repository';
import * as seatRepository from '../repositories/seat.repository';
import { redisClient } from '../config/redis';
import { logger } from '../config/logger';
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
