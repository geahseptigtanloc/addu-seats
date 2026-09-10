import { ReservationStatus, type Reservation } from '@prisma/client';
import { prisma } from '../config/prisma';

// Must match the partial unique index in the reservations migration (one
// active reservation per seat/user) — kept in sync here so "active" means
// the same thing at the application level as it does at the DB level.
const ACTIVE_STATUSES: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
];

export interface CreateReservationInput {
  userId: string;
  seatId: string;
}

// Deliberately doesn't catch the DB's unique-constraint violation (one
// active reservation per seat/user), that's a business-rule conflict,
// implemented in the service layer.
export function create(data: CreateReservationInput): Promise<Reservation> {
  return prisma.reservation.create({ data });
}

export function findById(id: string): Promise<Reservation | null> {
  return prisma.reservation.findUnique({ where: { id } });
}

export function findActiveBySeat(seatId: string): Promise<Reservation | null> {
  return prisma.reservation.findFirst({
    where: { seatId, status: { in: ACTIVE_STATUSES } },
  });
}

export function findActiveByUser(userId: string): Promise<Reservation | null> {
  return prisma.reservation.findFirst({
    where: { userId, status: { in: ACTIVE_STATUSES } },
  });
}

export interface UpdateReservationInput {
  status?: ReservationStatus;
  confirmedAt?: Date | null;
  endedAt?: Date | null;
}

export function update(id: string, data: UpdateReservationInput): Promise<Reservation> {
  return prisma.reservation.update({ where: { id }, data });
}

// Oldest-first, matching the front-desk admin queue's expected order.
export function findPending() {
  return prisma.reservation.findMany({
    where: { status: ReservationStatus.PENDING },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { name: true, studentIdLast4: true } },
      seat: { select: { id: true, building: true, floor: true } },
    },
  });
}

// Bulk update, a single statement for however many
// reservations timed out since the last tick. Returns the count for the
// job to log. seat.status is never touched: a PENDING reservation never
// changed it in the first place (see createReservation).
export async function expireStalePendingReservations(olderThan: Date): Promise<number> {
  const result = await prisma.reservation.updateMany({
    where: { status: ReservationStatus.PENDING, createdAt: { lt: olderThan } },
    data: { status: ReservationStatus.CANCELLED, endedAt: new Date() },
  });
  return result.count;
}

// The 5 terminal, "outcome" statuses, excludes PENDING and
// CONFIRMED, which are still in progress, not an outcome yet.
export const OUTCOME_STATUSES: ReservationStatus[] = [
  ReservationStatus.COMPLETED,
  ReservationStatus.CANCELLED,
  ReservationStatus.FORFEITED,
  ReservationStatus.EVICTED,
  ReservationStatus.VOIDED,
];

export interface OutcomeFilters {
  building?: string;
  floor?: number;
  from: Date;
  to: Date;
}

export interface OutcomeCount {
  status: ReservationStatus;
  count: number;
}

// groupBy only returns rows for statuses that actually appear in the
// data, a status with zero matches in range is simply absent here, not
// returned as zero. The service layer fills in the missing statuses.
export async function countByOutcome(filters: OutcomeFilters): Promise<OutcomeCount[]> {
  const hasSeatFilter = filters.building !== undefined || filters.floor !== undefined;

  const grouped = await prisma.reservation.groupBy({
    by: ['status'],
    where: {
      status: { in: OUTCOME_STATUSES },
      createdAt: { gte: filters.from, lt: filters.to },
      ...(hasSeatFilter && {
        seat: {
          ...(filters.building !== undefined && { building: filters.building }),
          ...(filters.floor !== undefined && { floor: filters.floor }),
        },
      }),
    },
    _count: { status: true },
  });

  return grouped.map((g) => ({ status: g.status, count: g._count.status }));
}
