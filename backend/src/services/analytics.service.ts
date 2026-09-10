import { OccupancyEventType } from '@prisma/client';
import * as seatRepository from '../repositories/seat.repository';
import * as occupancyLogRepository from '../repositories/occupancyLog.repository';
import type { SeatOccupancyEvent } from '../repositories/occupancyLog.repository';
import { BadRequestError } from '../utils/AppError';

export interface UtilizationFilters {
  building?: string;
  floor?: number;
  from: Date;
  to: Date;
}

export interface SeatUtilization {
  seatId: string;
  building: string;
  floor: number;
  utilizationPercent: number;
}

export interface UtilizationReport {
  from: Date;
  to: Date;
  seatCount: number;
  overallUtilizationPercent: number;
  seats: SeatUtilization[];
}

export async function getUtilization(filters: UtilizationFilters): Promise<UtilizationReport> {
  const { from } = filters;
  // Never count time that hasn't happened yet, in either the numerator
  // (occupied time) or the denominator (total possible time).
  const to = filters.to > new Date() ? new Date() : filters.to;

  if (from >= to) {
    throw new BadRequestError('from must be before to');
  }

  const seats = await seatRepository.findMany({ building: filters.building, floor: filters.floor });

  if (seats.length === 0) {
    return { from, to, seatCount: 0, overallUtilizationPercent: 0, seats: [] };
  }

  const events = await occupancyLogRepository.findEventsForSeats(
    seats.map((seat) => seat.id),
    to,
  );

  const eventsBySeat = new Map<string, SeatOccupancyEvent[]>();
  for (const event of events) {
    const list = eventsBySeat.get(event.seatId);
    if (list) {
      list.push(event);
    } else {
      eventsBySeat.set(event.seatId, [event]);
    }
  }

  const rangeMs = to.getTime() - from.getTime();
  let totalOccupiedMs = 0;

  const seatReports: SeatUtilization[] = seats.map((seat) => {
    const occupiedMs = computeOccupiedMs(eventsBySeat.get(seat.id) ?? [], from, to);
    totalOccupiedMs += occupiedMs;
    return {
      seatId: seat.id,
      building: seat.building,
      floor: seat.floor,
      utilizationPercent: roundToOneDecimal((occupiedMs / rangeMs) * 100),
    };
  });

  return {
    from,
    to,
    seatCount: seats.length,
    overallUtilizationPercent: roundToOneDecimal(
      (totalOccupiedMs / (rangeMs * seats.length)) * 100,
    ),
    seats: seatReports,
  };
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

// Walks a seat's OCCUPIED/VACATED history (ascending) and sums the milliseconds it was occupied within
// [rangeStart, rangeEnd]. Events before rangeStart establish the starting
// state rather than counting toward the total.
function computeOccupiedMs(events: SeatOccupancyEvent[], rangeStart: Date, rangeEnd: Date): number {
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();
  let occupiedSinceMs: number | null = null;
  let totalMs = 0;

  for (const event of events) {
    const eventMs = event.createdAt.getTime();

    if (eventMs < startMs) {
      occupiedSinceMs = event.eventType === OccupancyEventType.OCCUPIED ? startMs : null;
      continue;
    }

    if (event.eventType === OccupancyEventType.OCCUPIED) {
      occupiedSinceMs ??= eventMs;
    } else if (occupiedSinceMs !== null) {
      totalMs += Math.min(eventMs, endMs) - occupiedSinceMs;
      occupiedSinceMs = null;
    }
  }

  // Still occupied with no closing VACATED in range.
  if (occupiedSinceMs !== null) {
    totalMs += endMs - occupiedSinceMs;
  }

  return totalMs;
}
