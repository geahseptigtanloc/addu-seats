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
// Returns bare Reservation rows.
export function findPending(): Promise<Reservation[]> {
  return prisma.reservation.findMany({
    where: { status: ReservationStatus.PENDING },
    orderBy: { createdAt: 'asc' },
  });
}
