import { ReservationStatus, SeatFlagStatus, type Prisma, type SeatFlag } from '@prisma/client';
import { prisma } from '../config/prisma';

export type ResolvedSeatFlagStatus = Exclude<SeatFlagStatus, typeof SeatFlagStatus.ACTIVE>;

// Accepts the global client or a transaction client, so the close helpers
// below can run inside the caller's transaction.
type Db = Prisma.TransactionClient;

export interface CreateSeatFlagInput {
  seatId: string;
  reservationId: string;
  flaggedById: string;
  createdAt: Date;
  expiresAt: Date;
}

// Deliberately doesn't catch the DB's unique-constraint violation (one
// ACTIVE flag per seat), that's a business-rule conflict handled in the
// service layer.
export function create(db: Db, data: CreateSeatFlagInput): Promise<SeatFlag> {
  return db.seatFlag.create({ data });
}

export function findActiveByReservation(db: Db, reservationId: string): Promise<SeatFlag | null> {
  return db.seatFlag.findFirst({
    where: { reservationId, status: SeatFlagStatus.ACTIVE },
  });
}

// Oldest deadline first, so the eviction job works the longest-overdue
// flags before newer ones.
export function findDueActive(now: Date): Promise<SeatFlag[]> {
  return prisma.seatFlag.findMany({
    where: { status: SeatFlagStatus.ACTIVE, expiresAt: { lte: now } },
    orderBy: { expiresAt: 'asc' },
  });
}

// Only flags on a still-CONFIRMED reservation count as live reports.
export function findActiveWithDetails() {
  return prisma.seatFlag.findMany({
    where: { status: SeatFlagStatus.ACTIVE, reservation: { status: ReservationStatus.CONFIRMED } },
    orderBy: { createdAt: 'desc' },
    include: {
      seat: true,
      reservation: {
        select: { user: { select: { name: true, studentIdLast4: true } } },
      },
    },
  });
}

// Each close helper is a conditional update, so exactly one caller can win
// a given flag; the rest see `false` and must treat it as already resolved.

// Closes the reservation's ACTIVE flag regardless of deadline, for paths
// that end the reservation itself (void, checkout).
export async function closeActiveByReservation(
  db: Db,
  reservationId: string,
  status: ResolvedSeatFlagStatus,
): Promise<boolean> {
  const { count } = await db.seatFlag.updateMany({
    where: { reservationId, status: SeatFlagStatus.ACTIVE },
    data: { status, resolvedAt: new Date() },
  });
  return count > 0;
}

// Re-verification only counts while the deadline hasn't passed.
export async function closeIfWithinWindow(
  db: Db,
  reservationId: string,
  status: ResolvedSeatFlagStatus,
  now: Date,
): Promise<boolean> {
  const { count } = await db.seatFlag.updateMany({
    where: { reservationId, status: SeatFlagStatus.ACTIVE, expiresAt: { gt: now } },
    data: { status, resolvedAt: now },
  });
  return count > 0;
}

// Eviction only counts once the deadline has passed.
export async function closeIfExpired(
  db: Db,
  flagId: string,
  status: ResolvedSeatFlagStatus,
  now: Date,
): Promise<boolean> {
  const { count } = await db.seatFlag.updateMany({
    where: { id: flagId, status: SeatFlagStatus.ACTIVE, expiresAt: { lte: now } },
    data: { status, resolvedAt: now },
  });
  return count > 0;
}
