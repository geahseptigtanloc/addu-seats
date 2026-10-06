import { ReservationStatus, SeatFlagStatus, type Prisma, type SeatFlag } from '@prisma/client';
import { prisma } from '../config/prisma';

export type ResolvedSeatFlagStatus = Exclude<SeatFlagStatus, typeof SeatFlagStatus.ACTIVE>;

// Accepts the global client or a transaction client, so the helpers below
// can run inside the caller's transaction.
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

// What the admin list shows. The flagger is admin-only information and must
// never reach a student-facing response.
const detailsInclude = {
  seat: true,
  reservation: { select: { user: { select: { name: true, studentIdLast4: true } } } },
  flaggedBy: { select: { id: true, name: true, studentIdLast4: true } },
} satisfies Prisma.SeatFlagInclude;

export type SeatFlagWithDetails = Prisma.SeatFlagGetPayload<{ include: typeof detailsInclude }>;

// Only flags on a still-CONFIRMED reservation count as live reports. Bounded
// by the one-ACTIVE-flag-per-seat index, so no limit is needed.
export function findActiveWithDetails(): Promise<SeatFlagWithDetails[]> {
  return prisma.seatFlag.findMany({
    where: { status: SeatFlagStatus.ACTIVE, reservation: { status: ReservationStatus.CONFIRMED } },
    orderBy: { createdAt: 'desc' },
    include: detailsInclude,
  });
}

// Most recently resolved first. The limit keeps the response bounded as
// history grows.
export function findResolvedSince(since: Date, limit: number): Promise<SeatFlagWithDetails[]> {
  return prisma.seatFlag.findMany({
    where: { status: { not: SeatFlagStatus.ACTIVE }, resolvedAt: { gte: since } },
    orderBy: { resolvedAt: 'desc' },
    take: limit,
    include: detailsInclude,
  });
}

// Each close helper is a conditional update, so exactly one caller can win
// a given flag; the rest get `null` and must treat it as already resolved.
// The closed flag is returned so callers can notify with its id and time.

// Closes the reservation's ACTIVE flag regardless of deadline, for paths
// that end the reservation itself (void, checkout).
export async function closeActiveByReservation(
  db: Db,
  reservationId: string,
  status: ResolvedSeatFlagStatus,
): Promise<SeatFlag | null> {
  const [flag] = await db.seatFlag.updateManyAndReturn({
    where: { reservationId, status: SeatFlagStatus.ACTIVE },
    data: { status, resolvedAt: new Date() },
  });
  return flag ?? null;
}

// Re-verification only counts while the deadline hasn't passed.
export async function closeIfWithinWindow(
  db: Db,
  reservationId: string,
  status: ResolvedSeatFlagStatus,
  now: Date,
): Promise<SeatFlag | null> {
  const [flag] = await db.seatFlag.updateManyAndReturn({
    where: { reservationId, status: SeatFlagStatus.ACTIVE, expiresAt: { gt: now } },
    data: { status, resolvedAt: now },
  });
  return flag ?? null;
}

// Eviction only counts once the deadline has passed.
export async function closeIfExpired(
  db: Db,
  flagId: string,
  status: ResolvedSeatFlagStatus,
  now: Date,
): Promise<SeatFlag | null> {
  const [flag] = await db.seatFlag.updateManyAndReturn({
    where: { id: flagId, status: SeatFlagStatus.ACTIVE, expiresAt: { lte: now } },
    data: { status, resolvedAt: now },
  });
  return flag ?? null;
}
