import type { ValidationEvent, ValidationEventType } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface CreateValidationEventInput {
  reservationId: string;
  eventType: ValidationEventType;
  extensionsUsed?: number;
}

export function create(data: CreateValidationEventInput): Promise<ValidationEvent> {
  return prisma.validationEvent.create({ data });
}

export interface BreakReturnEvent {
  extensionsUsed: number | null;
  createdAt: Date;
}

// Only breaks that were actually returned from ever reach here,
// extensionsUsed for a forfeited (never-returned) break is unknowable,
// since the Redis key holding it is already gone by the time the
// expiry job checks it (that absence is the detection mechanism itself).
export function findBreakReturnsInRange(
  seatIds: string[],
  from: Date,
  to: Date,
): Promise<BreakReturnEvent[]> {
  return prisma.validationEvent.findMany({
    where: {
      eventType: 'BREAK_RETURN',
      createdAt: { gte: from, lt: to },
      reservation: { seatId: { in: seatIds } },
    },
    select: { extensionsUsed: true, createdAt: true },
  });
}
