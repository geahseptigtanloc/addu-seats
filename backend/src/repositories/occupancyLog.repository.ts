import type { OccupancyLog, OccupancyEventType } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface CreateOccupancyLogInput {
  reservationId: string;
  eventType: OccupancyEventType;
}

export function create(data: CreateOccupancyLogInput): Promise<OccupancyLog> {
  return prisma.occupancyLog.create({ data });
}

export interface SeatOccupancyEvent {
  seatId: string;
  eventType: OccupancyEventType;
  createdAt: Date;
}

// OccupancyLog has no seatId of its own so seatId
// comes from a join through Reservation. Fetches full history up to
// `upTo` because determining whether
// a seat was ALREADY occupied at the range's start requires knowing its
// last transition before that point.
export async function findEventsForSeats(
  seatIds: string[],
  upTo: Date,
): Promise<SeatOccupancyEvent[]> {
  const logs = await prisma.occupancyLog.findMany({
    where: {
      createdAt: { lte: upTo },
      reservation: { seatId: { in: seatIds } },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      eventType: true,
      createdAt: true,
      reservation: { select: { seatId: true } },
    },
  });

  return logs.map((log) => ({
    seatId: log.reservation.seatId,
    eventType: log.eventType,
    createdAt: log.createdAt,
  }));
}
