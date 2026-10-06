import {
  type Prisma,
  ReservationStatus,
  SeatFlagStatus,
  SeatStatus,
  ValidationEventType,
  OccupancyEventType,
  type Reservation,
  type Seat,
  type SeatFlag,
} from '@prisma/client';
import { prisma } from '../config/prisma';
import * as reservationRepository from '../repositories/reservation.repository';
import * as seatRepository from '../repositories/seat.repository';
import * as seatFlagRepository from '../repositories/seatFlag.repository';
import { getSeatLabel } from './seat.service';
import { redisClient } from '../config/redis';
import { logger } from '../config/logger';
import { isRetiredSeatToken } from '../config/retiredSeats';
import {
  broadcastSeatStatusUpdate,
  notifySeatFlagged,
  notifyAdminsSeatFlagResolved,
  notifyAdminsSeatFlagged,
  notifyReservationEvicted,
  type SeatFlagResolution,
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

export interface ReservingStudent {
  id: string;
  name: string;
  studentIdLast4: string | null;
}

// Mirrors PendingQueueItem's field names, the student's receipt and
// front desk's queue entry describe the same reservation the same way.
// reservationId doubles as "the code" front desk matches against; no
// separate code generation needed.
export interface ReservationReceipt {
  reservationId: string;
  status: ReservationStatus;
  createdAt: Date;
  seatId: string;
  building: string;
  floor: number;
  studentName: string;
  studentIdLast4: string | null;
  remainingSeconds: number;
}

export async function createReservation(
  student: ReservingStudent,
  qrToken: string,
): Promise<ReservationReceipt> {
  const userId = student.id;

  if (await isOnBreakCooldown(userId)) {
    throw new ConflictError('You are on a break cooldown — please try again later');
  }

  if (isRetiredSeatToken(qrToken)) {
    throw new NotFoundError('This seat QR code is no longer active');
  }

  const seat = await seatRepository.findByQrToken(qrToken);

  if (!seat) {
    throw new NotFoundError('Seat not found');
  }

  if (seat.status !== SeatStatus.AVAILABLE) {
    throw new ConflictError('This seat is not available for reservation');
  }

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
    reservation = await prisma.$transaction(async (tx) => {
      const claimedSeat = await tx.seat.updateMany({
        where: { id: seat.id, status: SeatStatus.AVAILABLE },
        data: { status: SeatStatus.PENDING },
      });

      if (claimedSeat.count !== 1) {
        throw new ConflictError('Seat is already reserved');
      }

      return tx.reservation.create({ data: { userId, seatId: seat.id } });
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new ConflictError('Seat or user became unavailable — please try again');
    }
    throw err;
  }

  try {
    await redisClient.set(entryTimerKey(reservation.id), '1', { EX: ENTRY_TIMER_SECONDS });
  } catch (err) {
    logger.warn({ err, reservationId: reservation.id }, 'Failed to set entry timer in Redis');
  }

  try {
    broadcastSeatStatusUpdate(seat.building, seat.floor, {
      seatId: seat.id,
      status: SeatStatus.PENDING,
    });
  } catch (err) {
    logger.warn({ err, reservationId: reservation.id }, 'Failed to broadcast pending seat status');
  }

  return {
    reservationId: reservation.id,
    status: reservation.status,
    createdAt: reservation.createdAt,
    seatId: seat.id,
    building: seat.building,
    floor: seat.floor,
    studentName: student.name,
    studentIdLast4: student.studentIdLast4,
    remainingSeconds: await getRemainingSeconds(reservation.id, reservation.createdAt),
  };
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

  const [updated, updatedSeat] = await prisma.$transaction(async (tx) => {
    const res = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: ReservationStatus.CANCELLED, endedAt: new Date() },
    });
    const seat = await tx.seat.update({
      where: { id: reservation.seatId },
      data: { status: SeatStatus.AVAILABLE },
    });
    return [res, seat] as const;
  });

  // Best-effort cleanup, the key would self-expire anyway just cleaner not to leave it.
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
    logger.warn({ err, reservationId }, 'Failed to broadcast cancelled seat status');
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

  const pendingSeat = await seatRepository.findById(reservation.seatId);
  if (
    !pendingSeat ||
    isRetiredSeatToken(pendingSeat.currentQrToken) ||
    pendingSeat.status !== SeatStatus.PENDING
  ) {
    throw new ConflictError('This seat is no longer available for entry');
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
    await tx.occupancyLog.create({
      data: { reservationId, eventType: OccupancyEventType.OCCUPIED },
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
  currentQrToken: string;
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
      currentQrToken: r.seat.currentQrToken,
      remainingSeconds: await getRemainingSeconds(r.id, r.createdAt),
    })),
  );
}

// The holder's view of an open flag: when and where it was reported and how
// long they have left. Deliberately omits who reported it.
export interface ActiveFlagInfo {
  flagId: string;
  seatLabel: string;
  building: string;
  floor: number;
  flaggedAt: string;
  expiresAt: string;
  windowSeconds: number;
  remainingSeconds: number;
}

function toActiveFlagInfo(flag: SeatFlag, seat: Seat): ActiveFlagInfo {
  return {
    flagId: flag.id,
    seatLabel: getSeatLabel(seat),
    building: seat.building,
    floor: seat.floor,
    flaggedAt: flag.createdAt.toISOString(),
    expiresAt: flag.expiresAt.toISOString(),
    windowSeconds: flagWindowSeconds(flag),
    remainingSeconds: flagRemainingSeconds(flag),
  };
}

export interface ReservationDetails {
  reservationId: string;
  status: ReservationStatus;
  createdAt: Date;
  confirmedAt: Date | null;
  endedAt: Date | null;
  remainingSeconds?: number;
  breakRemainingSeconds?: number;
  breakMinutesUsed?: number;
  flag?: ActiveFlagInfo;
  seat: Seat;
  user: { name: string; studentIdLast4: string | null };
}

async function toReservationDetails(
  reservation: Awaited<ReturnType<typeof reservationRepository.findDetailsById>>,
): Promise<ReservationDetails> {
  if (!reservation) {
    throw new NotFoundError('Reservation not found');
  }

  const details: ReservationDetails = {
    reservationId: reservation.id,
    status: reservation.status,
    createdAt: reservation.createdAt,
    confirmedAt: reservation.confirmedAt,
    endedAt: reservation.endedAt,
    seat: reservation.seat,
    user: reservation.user,
  };

  if (reservation.status === ReservationStatus.PENDING) {
    details.remainingSeconds = await getRemainingSeconds(reservation.id, reservation.createdAt);
  }

  if (reservation.seat.status === SeatStatus.OCCUPIED_ON_BREAK) {
    try {
      const [rawState, ttl] = await Promise.all([
        redisClient.get(breakTimerKey(reservation.id)),
        redisClient.ttl(breakTimerKey(reservation.id)),
      ]);
      if (rawState) {
        const state = JSON.parse(rawState) as BreakTimerState;
        details.breakMinutesUsed = Math.min(15, (state.extensionsUsed + 1) * 5);
      }
      details.breakRemainingSeconds = Math.max(0, ttl);
    } catch (err) {
      logger.warn({ err, reservationId: reservation.id }, 'Failed to read break details');
    }
  }

  // Lets a refreshed page restore the flag banner and its countdown.
  if (reservation.status === ReservationStatus.CONFIRMED) {
    const flag = await seatFlagRepository.findActiveByReservation(prisma, reservation.id);

    if (flag) {
      details.flag = toActiveFlagInfo(flag, reservation.seat);
    }
  }

  return details;
}

export async function getCurrentReservation(userId: string): Promise<ReservationDetails> {
  const reservation = await reservationRepository.findActiveDetailsByUser(userId);
  return toReservationDetails(reservation);
}

export async function getReservationDetails(reservationId: string): Promise<ReservationDetails> {
  const reservation = await reservationRepository.findDetailsById(reservationId);
  return toReservationDetails(reservation);
}

const RESOLUTION_BY_STATUS: Record<seatFlagRepository.ResolvedSeatFlagStatus, SeatFlagResolution> =
  {
    REVERIFIED: 'reverified',
    EVICTED: 'evicted',
    VOIDED: 'voided',
    CHECKED_OUT: 'checked_out',
  };

// Tells front desk a flag was resolved, so its card can flip to "resolved"
// without a refetch. Best-effort: the DB already holds the outcome.
function notifyFlagResolved(flag: SeatFlag): void {
  if (flag.status === SeatFlagStatus.ACTIVE || flag.resolvedAt === null) {
    return; // only ever called with a flag a close helper just resolved
  }

  try {
    notifyAdminsSeatFlagResolved({
      flagId: flag.id,
      reservationId: flag.reservationId,
      resolution: RESOLUTION_BY_STATUS[flag.status],
      resolvedAt: flag.resolvedAt.toISOString(),
    });
  } catch (err) {
    logger.warn({ err, flagId: flag.id }, 'Failed to notify admins of flag resolution');
  }
}

// Row-locks a CONFIRMED reservation until the transaction ends. Every path
// that touches a flag, starts a break, or ends a reservation locks the
// reservation first and the flag second, so they serialize instead of
// interleaving or deadlocking.
async function lockConfirmedReservation(
  tx: Prisma.TransactionClient,
  reservationId: string,
): Promise<boolean> {
  const { count } = await tx.reservation.updateMany({
    where: { id: reservationId, status: ReservationStatus.CONFIRMED },
    data: { status: ReservationStatus.CONFIRMED },
  });
  return count === 1;
}

// Frees a seat and reports whether it was OCCUPIED beforehand. Only then
// does it need a closing VACATED log entry; a seat on break was already
// vacated by startBreak. A seat marked UNAVAILABLE is left untouched.
async function releaseSeat(
  tx: Prisma.TransactionClient,
  seatId: string,
): Promise<{ seat: Seat; wasOccupied: boolean }> {
  const occupied = await tx.seat.updateMany({
    where: { id: seatId, status: SeatStatus.OCCUPIED },
    data: { status: SeatStatus.AVAILABLE },
  });

  if (occupied.count === 0) {
    await tx.seat.updateMany({
      where: { id: seatId, status: { in: [SeatStatus.PENDING, SeatStatus.OCCUPIED_ON_BREAK] } },
      data: { status: SeatStatus.AVAILABLE },
    });
  }

  const seat = await tx.seat.findUniqueOrThrow({ where: { id: seatId } });
  return { seat, wasOccupied: occupied.count === 1 };
}

export async function checkoutReservation(
  userId: string,
  reservationId: string,
): Promise<Reservation> {
  const reservation = await reservationRepository.findById(reservationId);

  if (!reservation || reservation.userId !== userId) {
    throw new NotFoundError('Reservation not found');
  }

  if (reservation.status !== ReservationStatus.CONFIRMED) {
    throw new ConflictError('Only a confirmed reservation can be checked out');
  }

  const { updatedReservation, updatedSeat, closedFlag } = await prisma.$transaction(async (tx) => {
    // Conditional update, so a concurrent void or eviction isn't overwritten.
    const ended = await tx.reservation.updateMany({
      where: { id: reservationId, status: ReservationStatus.CONFIRMED },
      data: { status: ReservationStatus.COMPLETED, endedAt: new Date() },
    });

    if (ended.count !== 1) {
      throw new ConflictError('Only a confirmed reservation can be checked out');
    }

    const closed = await seatFlagRepository.closeActiveByReservation(
      tx,
      reservationId,
      SeatFlagStatus.CHECKED_OUT,
    );
    const released = await releaseSeat(tx, reservation.seatId);

    if (released.wasOccupied) {
      await tx.occupancyLog.create({
        data: { reservationId, eventType: OccupancyEventType.VACATED },
      });
    }

    return {
      updatedReservation: await tx.reservation.findUniqueOrThrow({ where: { id: reservationId } }),
      updatedSeat: released.seat,
      closedFlag: closed,
    };
  });

  try {
    await redisClient.del(breakTimerKey(reservationId));
  } catch (err) {
    logger.warn({ err, reservationId }, 'Failed to clear checkout timers');
  }

  if (closedFlag) {
    notifyFlagResolved(closedFlag);
  }

  try {
    broadcastSeatStatusUpdate(updatedSeat.building, updatedSeat.floor, {
      seatId: updatedSeat.id,
      status: updatedSeat.status,
    });
  } catch (err) {
    logger.warn({ err, reservationId }, 'Failed to broadcast checkout');
  }

  return updatedReservation;
}

const GHOST_REPORT_INACTIVE = 'This ghost-seat report is no longer active';

// Shared by manual void and ghost-seat confirmation. With requireActiveFlag,
// the reservation is ended only if its flag is still open, all in one
// transaction: a flag resolved in the meantime rolls the whole void back.
async function endReservationAsStaff(
  reservation: Reservation,
  requireActiveFlag: boolean,
): Promise<Reservation> {
  const notActiveMessage = requireActiveFlag
    ? GHOST_REPORT_INACTIVE
    : 'Only an active reservation can be voided';

  const { updated, seat, closedFlag } = await prisma.$transaction(async (tx) => {
    // Conditional update, so a concurrent checkout or eviction isn't overwritten.
    const ended = await tx.reservation.updateMany({
      where: {
        id: reservation.id,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
      },
      data: { status: ReservationStatus.VOIDED, endedAt: new Date() },
    });

    if (ended.count !== 1) {
      throw new ConflictError(notActiveMessage);
    }

    const closed = await seatFlagRepository.closeActiveByReservation(
      tx,
      reservation.id,
      SeatFlagStatus.VOIDED,
    );

    if (requireActiveFlag && !closed) {
      throw new ConflictError(notActiveMessage);
    }

    const released = await releaseSeat(tx, reservation.seatId);

    if (released.wasOccupied) {
      await tx.occupancyLog.create({
        data: { reservationId: reservation.id, eventType: OccupancyEventType.VACATED },
      });
    }

    return {
      updated: await tx.reservation.findUniqueOrThrow({ where: { id: reservation.id } }),
      seat: released.seat,
      closedFlag: closed,
    };
  });

  try {
    await Promise.all([
      redisClient.del(entryTimerKey(reservation.id)),
      redisClient.del(breakTimerKey(reservation.id)),
    ]);
  } catch (err) {
    logger.warn(
      { err, reservationId: reservation.id },
      'Failed to clear reservation timers in Redis',
    );
  }

  if (closedFlag) {
    notifyFlagResolved(closedFlag);
  }

  try {
    broadcastSeatStatusUpdate(seat.building, seat.floor, {
      seatId: seat.id,
      status: seat.status,
    });
  } catch (err) {
    logger.warn({ err, reservationId: reservation.id }, 'Failed to broadcast seat status update');
  }

  return updated;
}

// Admin-only forced end of an active reservation.
// Unlike student cancellation (PENDING only), void works on PENDING or CONFIRMED.
export async function voidReservation(reservationId: string): Promise<Reservation> {
  const reservation = await reservationRepository.findById(reservationId);

  if (!reservation) {
    throw new NotFoundError('Reservation not found');
  }

  return endReservationAsStaff(reservation, false);
}

const BREAK_BASE_SECONDS = 5 * 60;
const BREAK_EXTENSION_SECONDS = 5 * 60;
export const BREAK_MAX_EXTENSIONS = 2;
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

  const updatedSeat = await prisma.$transaction(async (tx) => {
    if (!(await lockConfirmedReservation(tx, reservationId))) {
      throw new ConflictError('Only a confirmed reservation can start a break');
    }

    // Checked under the reservation lock so it can't race flagSeat. A flagged
    // student must re-verify first, otherwise a break would dodge the flag.
    if (await seatFlagRepository.findActiveByReservation(tx, reservationId)) {
      throw new ConflictError(
        'Your seat has been flagged. Scan the seat QR to verify your presence before starting a break',
      );
    }

    // Conditional claim, which also rejects a second start mid-break.
    const claimed = await tx.seat.updateMany({
      where: { id: reservation.seatId, status: SeatStatus.OCCUPIED },
      data: { status: SeatStatus.OCCUPIED_ON_BREAK },
    });

    if (claimed.count !== 1) {
      throw new ConflictError('A break is already in progress for this reservation');
    }

    await tx.occupancyLog.create({
      data: { reservationId, eventType: OccupancyEventType.VACATED },
    });

    return tx.seat.findUniqueOrThrow({ where: { id: reservation.seatId } });
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
      data: {
        reservationId: reservation.id,
        eventType: ValidationEventType.BREAK_RETURN,
        extensionsUsed,
      },
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

const FLAG_WINDOW_SECONDS = 5 * 60;
const FLAG_COOLDOWN_SECONDS = 5 * 60;

// `status=all` on the admin list also shows flags resolved within this
// lookback, capped, so the response stays bounded as history grows.
const RESOLVED_FLAG_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const MAX_RESOLVED_FLAGS = 500;

function flagCooldownKey(userId: string): string {
  return `user:flag-cooldown:${userId}`;
}

function formatWait(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

// Starts the flagger's cooldown with an atomic SET NX, so concurrent requests
// can't slip past it. Fails open on a Redis error, same trade-off as the break
// cooldown: blocking all flagging over a Redis hiccup is worse than briefly
// missing the rate limit.
async function claimFlagCooldown(userId: string): Promise<void> {
  let remainingSeconds: number;

  try {
    const claimed = await redisClient.set(flagCooldownKey(userId), '1', {
      expiration: { type: 'EX', value: FLAG_COOLDOWN_SECONDS },
      condition: 'NX',
    });

    if (claimed !== null) {
      return;
    }

    remainingSeconds = Math.max(1, await redisClient.ttl(flagCooldownKey(userId)));
  } catch (err) {
    logger.warn({ err, userId }, 'Failed to claim flag cooldown in Redis — allowing');
    return;
  }

  throw new ConflictError(`You can report another seat in ${formatWait(remainingSeconds)}`);
}

// A flag attempt that fails shouldn't burn the cooldown.
async function releaseFlagCooldown(userId: string): Promise<void> {
  try {
    await redisClient.del(flagCooldownKey(userId));
  } catch (err) {
    logger.warn({ err, userId }, 'Failed to release flag cooldown in Redis');
  }
}

function flagWindowSeconds(flag: SeatFlag): number {
  return Math.round((flag.expiresAt.getTime() - flag.createdAt.getTime()) / 1000);
}

function flagRemainingSeconds(flag: SeatFlag): number {
  return Math.max(0, Math.ceil((flag.expiresAt.getTime() - Date.now()) / 1000));
}

// Admin view of a flag. `flaggedBy` is admin-only; the holder-facing
// ActiveFlagInfo never includes it.
export interface FlaggedReservation {
  flagId: string;
  status: SeatFlagStatus;
  reservationId: string;
  seatId: string;
  seatLabel: string;
  building: string;
  floor: number;
  studentName: string;
  studentIdLast4: string | null;
  flaggedBy: { id: string; name: string; studentIdLast4: string | null };
  windowSeconds: number;
  remainingSeconds: number;
  expiresAt: string;
  reportedAt: string;
  resolvedAt: string | null;
}

function toFlaggedReservation(flag: seatFlagRepository.SeatFlagWithDetails): FlaggedReservation {
  return {
    flagId: flag.id,
    status: flag.status,
    reservationId: flag.reservationId,
    seatId: flag.seatId,
    seatLabel: getSeatLabel(flag.seat),
    building: flag.seat.building,
    floor: flag.seat.floor,
    studentName: flag.reservation.user.name,
    studentIdLast4: flag.reservation.user.studentIdLast4,
    flaggedBy: flag.flaggedBy,
    windowSeconds: flagWindowSeconds(flag),
    // Only a live flag has time left.
    remainingSeconds: flag.status === SeatFlagStatus.ACTIVE ? flagRemainingSeconds(flag) : 0,
    expiresAt: flag.expiresAt.toISOString(),
    reportedAt: flag.createdAt.toISOString(),
    resolvedAt: flag.resolvedAt?.toISOString() ?? null,
  };
}

// Active flags by default. With includeResolved, also flags resolved within
// the lookback window (capped), newest report first.
export async function getFlaggedReservations(
  includeResolved = false,
): Promise<FlaggedReservation[]> {
  const since = new Date(Date.now() - RESOLVED_FLAG_LOOKBACK_MS);
  const noResolved: seatFlagRepository.SeatFlagWithDetails[] = [];

  const [active, resolved] = await Promise.all([
    seatFlagRepository.findActiveWithDetails(),
    includeResolved
      ? seatFlagRepository.findResolvedSince(since, MAX_RESOLVED_FLAGS)
      : Promise.resolve(noResolved),
  ]);

  return [...active, ...resolved]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map(toFlaggedReservation);
}

// Front desk confirms the seat really is empty. Voids the reservation and
// closes its flag in a single transaction.
export async function confirmGhostSeat(reservationId: string): Promise<Reservation> {
  const reservation = await reservationRepository.findById(reservationId);

  if (!reservation || reservation.status !== ReservationStatus.CONFIRMED) {
    throw new ConflictError(GHOST_REPORT_INACTIVE);
  }

  return endReservationAsStaff(reservation, true);
}

// Any authenticated user can flag someone else's seat as apparently
// vacant. Not the seat's own reservation holder, and not a seat that isn't
// currently OCCUPIED (a seat on break or already free has nothing to flag).
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
    throw new ConflictError('No active reservation found for this seat');
  }

  if (reservation.userId === flaggingUserId) {
    throw new ConflictError('You cannot flag your own reservation');
  }

  await claimFlagCooldown(flaggingUserId);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + FLAG_WINDOW_SECONDS * 1000);

  let flag: SeatFlag;
  try {
    flag = await prisma.$transaction(async (tx) => {
      // Re-checked under the reservation lock: since the reads above, the
      // reservation may have ended or the seat may have gone on break.
      if (!(await lockConfirmedReservation(tx, reservation.id))) {
        throw new ConflictError('No active reservation found for this seat');
      }

      const current = await tx.seat.findUnique({
        where: { id: seatId },
        select: { status: true },
      });

      if (current?.status !== SeatStatus.OCCUPIED) {
        throw new ConflictError('Only an occupied seat can be flagged');
      }

      return seatFlagRepository.create(tx, {
        seatId,
        reservationId: reservation.id,
        flaggedById: flaggingUserId,
        createdAt: now,
        expiresAt,
      });
    });
  } catch (err) {
    await releaseFlagCooldown(flaggingUserId);

    // The partial unique index allows one ACTIVE flag per seat.
    if (isUniqueConstraintError(err)) {
      throw new ConflictError('This seat has already been flagged');
    }
    throw err;
  }

  try {
    notifySeatFlagged(reservation.userId, {
      flagId: flag.id,
      seatId,
      seatLabel: getSeatLabel(seat),
      building: seat.building,
      floor: seat.floor,
      reservationId: reservation.id,
      windowSeconds: FLAG_WINDOW_SECONDS,
      flaggedAt: flag.createdAt.toISOString(),
      expiresAt: flag.expiresAt.toISOString(),
      message: `Another student reported this seat as physically vacant. Scan the physical seat QR within ${FLAG_WINDOW_SECONDS / 60} minutes to keep your reservation.`,
    });
  } catch (err) {
    logger.warn(
      { err, seatId, reservationId: reservation.id },
      'Failed to notify reservation holder of flag',
    );
  }

  try {
    const reservationDetails = await reservationRepository.findDetailsById(reservation.id);
    if (!reservationDetails) {
      throw new NotFoundError('Reservation not found');
    }
    notifyAdminsSeatFlagged({
      flagId: flag.id,
      seatId,
      seatLabel: getSeatLabel(seat),
      reservationId: reservation.id,
      building: seat.building,
      floor: seat.floor,
      studentName: reservationDetails.user.name,
      studentIdLast4: reservationDetails.user.studentIdLast4,
      windowSeconds: FLAG_WINDOW_SECONDS,
      expiresAt: flag.expiresAt.toISOString(),
      reportedAt: flag.createdAt.toISOString(),
    });
  } catch (err) {
    logger.warn({ err, seatId, reservationId: reservation.id }, 'Failed to notify admins of flag');
  }
}

// Clears a flag by proving the holder is actually still there (see
// flagSeat). Seat.status never changed during a flag, so there's nothing
// to transition back and no OccupancyLog entry; only the scan itself is
// recorded, via ValidationEvent, atomically with closing the flag.
export async function reverifyPresence(userId: string, qrToken: string): Promise<void> {
  const seat = await seatRepository.findByQrToken(qrToken);

  if (!seat) {
    throw new NotFoundError('Seat not found');
  }

  const reservation = await reservationRepository.findActiveBySeat(seat.id);

  if (!reservation || reservation.userId !== userId) {
    throw new NotFoundError('No matching reservation found for this seat');
  }

  const closedFlag = await prisma.$transaction(async (tx) => {
    if (!(await lockConfirmedReservation(tx, reservation.id))) {
      throw new ConflictError('No active flag to re-verify');
    }

    // The deadline is enforced here, not left to the eviction job's next tick.
    const closed = await seatFlagRepository.closeIfWithinWindow(
      tx,
      reservation.id,
      SeatFlagStatus.REVERIFIED,
      new Date(),
    );

    if (!closed) {
      const lapsed = await seatFlagRepository.findActiveByReservation(tx, reservation.id);
      throw new ConflictError(
        lapsed ? 'The verification window has expired' : 'No active flag to re-verify',
      );
    }

    await tx.validationEvent.create({
      data: {
        reservationId: reservation.id,
        eventType: ValidationEventType.FLAG_REVERIFICATION,
      },
    });

    return closed;
  });

  notifyFlagResolved(closedFlag);
}

// Called by the entry-timer-expiry background job. Same
// ENTRY_TIMER_SECONDS used when the timer was started (createReservation),
// so "expired" means the same thing on both ends.
export async function expireEntryTimers(): Promise<void> {
  const cutoff = new Date(Date.now() - ENTRY_TIMER_SECONDS * 1000);
  const staleReservations = await reservationRepository.findStalePendingReservations(cutoff);
  let count = 0;

  for (const reservation of staleReservations) {
    const released = await prisma.$transaction(async (tx) => {
      const expired = await tx.reservation.updateMany({
        where: {
          id: reservation.id,
          status: ReservationStatus.PENDING,
          createdAt: { lt: cutoff },
        },
        data: { status: ReservationStatus.CANCELLED, endedAt: new Date() },
      });

      if (expired.count !== 1) return false;

      await tx.seat.updateMany({
        where: { id: reservation.seat.id, status: SeatStatus.PENDING },
        data: { status: SeatStatus.AVAILABLE },
      });
      return true;
    });

    if (!released) continue;
    count++;

    try {
      broadcastSeatStatusUpdate(reservation.seat.building, reservation.seat.floor, {
        seatId: reservation.seat.id,
        status: SeatStatus.AVAILABLE,
      });
    } catch (err) {
      logger.warn(
        { err, reservationId: reservation.id },
        'Failed to broadcast expired pending seat status',
      );
    }
  }

  if (count > 0) {
    logger.info({ count }, 'Expired stale pending reservations (entry timer)');
  }
}

// Called by the break-timer-expiry background job. Postgres
// (seat.status) tells that a break is in progress; Redis's own TTL tells
// whether time's run out.
export async function expireBreakTimers(): Promise<void> {
  const onBreakSeats = await seatRepository.findByStatus(SeatStatus.OCCUPIED_ON_BREAK);
  let expiredCount = 0;

  for (const seat of onBreakSeats) {
    // Per-seat try/catch, one failure shouldn't abort the whole batch and
    // delay every other seat behind it until the next tick.
    try {
      const reservation = await reservationRepository.findActiveBySeat(seat.id);

      if (!reservation) {
        // Shouldn't happen (ON_BREAK implies an active reservation).
        logger.warn({ seatId: seat.id }, 'Seat is ON_BREAK but has no active reservation');
        continue;
      }

      const stillOnBreak = await redisClient.exists(breakTimerKey(reservation.id));

      if (stillOnBreak) {
        continue;
      }

      // Reservation + seat must change together
      const updatedSeat = await prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: ReservationStatus.FORFEITED, endedAt: new Date() },
        });
        return tx.seat.update({
          where: { id: seat.id },
          data: { status: SeatStatus.AVAILABLE },
        });
      });

      expiredCount++;

      try {
        broadcastSeatStatusUpdate(updatedSeat.building, updatedSeat.floor, {
          seatId: updatedSeat.id,
          status: updatedSeat.status,
        });
      } catch (err) {
        logger.warn(
          { err, reservationId: reservation.id },
          'Failed to broadcast seat status update',
        );
      }
    } catch (err) {
      logger.error({ err, seatId: seat.id }, 'Failed to process break-timer expiry for seat');
    }
  }

  if (expiredCount > 0) {
    logger.info({ count: expiredCount }, 'Forfeited reservations with expired break timers');
  }
}

const EVICTION_MESSAGE =
  'Your reservation ended: the seat was reported vacant and your presence was not verified in time.';

// Called by the flag-eviction background job. Postgres is the source of
// truth for flags, so "due" is a plain query on the flag's own deadline.
export async function evictExpiredFlags(): Promise<void> {
  const dueFlags = await seatFlagRepository.findDueActive(new Date());
  let evictedCount = 0;

  for (const flag of dueFlags) {
    // Per-flag try/catch, one failure shouldn't hold up the rest of the batch.
    try {
      const evicted = await prisma.$transaction(async (tx) => {
        if (!(await lockConfirmedReservation(tx, flag.reservationId))) {
          // Every path that ends a reservation closes its flag, so this is
          // defensive: close the stale flag rather than evict anything.
          await seatFlagRepository.closeActiveByReservation(
            tx,
            flag.reservationId,
            SeatFlagStatus.VOIDED,
          );
          logger.warn(
            { flagId: flag.id, reservationId: flag.reservationId },
            'Closed an active flag whose reservation had already ended',
          );
          return null;
        }

        const now = new Date();
        const closedFlag = await seatFlagRepository.closeIfExpired(
          tx,
          flag.id,
          SeatFlagStatus.EVICTED,
          now,
        );

        if (!closedFlag) {
          return null; // re-verified or otherwise resolved since the batch was read
        }

        const reservation = await tx.reservation.update({
          where: { id: flag.reservationId },
          data: { status: ReservationStatus.EVICTED, endedAt: now },
        });

        const released = await releaseSeat(tx, flag.seatId);

        if (released.wasOccupied) {
          await tx.occupancyLog.create({
            data: { reservationId: flag.reservationId, eventType: OccupancyEventType.VACATED },
          });
        }

        return { closedFlag, userId: reservation.userId, seat: released.seat, endedAt: now };
      });

      if (!evicted) {
        continue;
      }

      evictedCount++;
      notifyFlagResolved(evicted.closedFlag);

      try {
        notifyReservationEvicted(evicted.userId, {
          reservationId: flag.reservationId,
          seatId: evicted.seat.id,
          reason: 'flag_expired',
          message: EVICTION_MESSAGE,
          endedAt: evicted.endedAt.toISOString(),
        });
      } catch (err) {
        logger.warn(
          { err, reservationId: flag.reservationId },
          'Failed to notify student of eviction',
        );
      }

      try {
        broadcastSeatStatusUpdate(evicted.seat.building, evicted.seat.floor, {
          seatId: evicted.seat.id,
          status: evicted.seat.status,
        });
      } catch (err) {
        logger.warn(
          { err, reservationId: flag.reservationId },
          'Failed to broadcast seat status update',
        );
      }
    } catch (err) {
      logger.error({ err, flagId: flag.id }, 'Failed to process flag eviction');
    }
  }

  if (evictedCount > 0) {
    logger.info({ count: evictedCount }, 'Evicted reservations with expired flags');
  }
}
