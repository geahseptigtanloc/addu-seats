import { OccupancyEventType, type ReservationStatus } from '@prisma/client';
import * as seatRepository from '../repositories/seat.repository';
import * as occupancyLogRepository from '../repositories/occupancyLog.repository';
import * as reservationRepository from '../repositories/reservation.repository';
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
  const { from, to, seats, eventsBySeat } = await loadOccupancyData(filters);

  if (seats.length === 0) {
    return { from, to, seatCount: 0, overallUtilizationPercent: 0, seats: [] };
  }

  const rangeMs = to.getTime() - from.getTime();
  let totalOccupiedMs = 0;

  const seatReports: SeatUtilization[] = seats.map((seat) => {
    const intervals = extractOccupiedIntervals(eventsBySeat.get(seat.id) ?? [], from, to);
    const occupiedMs = sumIntervalMs(intervals);
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

export interface HourlyUtilization {
  hour: number; // 0-23, UTC
  utilizationPercent: number;
}

export interface PeakHoursReport {
  from: Date;
  to: Date;
  seatCount: number;
  hours: HourlyUtilization[];
}

// Same underlying occupied intervals as getUtilization, but split by
// hour-of-day and summed across every day in the range, instead of
// collapsed into one aggregate. Hour-of-day is UTC so the project has no
// established local-timezone handling anywhere else, so this doesn't
// introduce one; revisit if the school's local hours need to line up
// with these buckets.
export async function getPeakHours(filters: UtilizationFilters): Promise<PeakHoursReport> {
  const { from, to, seats, eventsBySeat } = await loadOccupancyData(filters);

  const occupiedMsByHour = new Array<number>(24).fill(0);
  const possibleMsByHour = new Array<number>(24).fill(0);

  for (const seat of seats) {
    const intervals = extractOccupiedIntervals(eventsBySeat.get(seat.id) ?? [], from, to);
    for (const interval of intervals) {
      accumulateHourlyMs(interval.start, interval.end, occupiedMsByHour);
    }
    // This seat's entire range counts as "possible" time
    accumulateHourlyMs(from, to, possibleMsByHour);
  }

  const hours: HourlyUtilization[] = occupiedMsByHour.map((occupiedMs, hour) => {
    const possibleMs = possibleMsByHour[hour] ?? 0;
    return {
      hour,
      utilizationPercent: possibleMs > 0 ? roundToOneDecimal((occupiedMs / possibleMs) * 100) : 0,
    };
  });

  return { from, to, seatCount: seats.length, hours };
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

interface LoadedOccupancyData {
  from: Date;
  to: Date;
  seats: Awaited<ReturnType<typeof seatRepository.findMany>>;
  eventsBySeat: Map<string, SeatOccupancyEvent[]>;
}

// Shared setup for both reports: validate the range, resolve which seats
// are in scope, and group their occupancy events.
async function loadOccupancyData(filters: UtilizationFilters): Promise<LoadedOccupancyData> {
  const { from } = filters;
  const to = filters.to > new Date() ? new Date() : filters.to;

  if (from >= to) {
    throw new BadRequestError('from must be before to');
  }

  const seats = await seatRepository.findMany({ building: filters.building, floor: filters.floor });

  if (seats.length === 0) {
    return { from, to, seats, eventsBySeat: new Map() };
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

  return { from, to, seats, eventsBySeat };
}

interface OccupiedInterval {
  start: Date;
  end: Date;
}

// Walks a seat's OCCUPIED/VACATED history (ascending) and sums the milliseconds it was occupied within
// [rangeStart, rangeEnd]. Events before rangeStart establish the starting
// state rather than counting toward the total.
function extractOccupiedIntervals(
  events: SeatOccupancyEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): OccupiedInterval[] {
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();
  let occupiedSinceMs: number | null = null;
  const intervals: OccupiedInterval[] = [];

  for (const event of events) {
    const eventMs = event.createdAt.getTime();

    if (eventMs < startMs) {
      occupiedSinceMs = event.eventType === OccupancyEventType.OCCUPIED ? startMs : null;
      continue;
    }

    if (event.eventType === OccupancyEventType.OCCUPIED) {
      occupiedSinceMs ??= eventMs;
    } else if (occupiedSinceMs !== null) {
      intervals.push({ start: new Date(occupiedSinceMs), end: new Date(Math.min(eventMs, endMs)) });
      occupiedSinceMs = null;
    }
  }

  if (occupiedSinceMs !== null) {
    intervals.push({ start: new Date(occupiedSinceMs), end: rangeEnd });
  }

  return intervals;
}

function sumIntervalMs(intervals: OccupiedInterval[]): number {
  return intervals.reduce(
    (sum, interval) => sum + (interval.end.getTime() - interval.start.getTime()),
    0,
  );
}

// Splits [start, end) into per-UTC-hour chunks and adds each chunk's
// duration into the matching 0-23 bucket. Walks hour-boundary by
// hour-boundary rather than assuming a single bucket, so an interval
// spanning multiple hours or multiple days is split correctly.
function accumulateHourlyMs(start: Date, end: Date, bucketsMs: number[]): void {
  let cursorMs = start.getTime();
  const endMs = end.getTime();

  while (cursorMs < endMs) {
    const cursor = new Date(cursorMs);
    const hour = cursor.getUTCHours();
    const nextHourMs = Date.UTC(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth(),
      cursor.getUTCDate(),
      cursor.getUTCHours() + 1,
    );
    const chunkEndMs = Math.min(nextHourMs, endMs);
    bucketsMs[hour] = (bucketsMs[hour] ?? 0) + (chunkEndMs - cursorMs);
    cursorMs = chunkEndMs;
  }
}

// Never count time that hasn't happened yet, in any report; from must
// precede to. Shared by every analytics report that takes a date range.
function resolveDateRange(filters: { from: Date; to: Date }): { from: Date; to: Date } {
  const { from } = filters;
  const to = filters.to > new Date() ? new Date() : filters.to;

  if (from >= to) {
    throw new BadRequestError('from must be before to');
  }

  return { from, to };
}

export interface OutcomeBreakdownFilters {
  building?: string;
  floor?: number;
  from: Date;
  to: Date;
}

export interface OutcomeBreakdown {
  status: ReservationStatus;
  count: number;
}

export interface OutcomeReport {
  from: Date;
  to: Date;
  totalCount: number;
  outcomes: OutcomeBreakdown[];
}

// Counted by createdAt not by endedAt. Every terminal status is always
// present in the response, defaulted to 0, since groupBy silently omits
// a status with no matches rather than returning it as zero.
export async function getOutcomeBreakdown(
  filters: OutcomeBreakdownFilters,
): Promise<OutcomeReport> {
  const { from, to } = resolveDateRange(filters);

  const counts = await reservationRepository.countByOutcome({
    building: filters.building,
    floor: filters.floor,
    from,
    to,
  });

  const countByStatus = new Map(counts.map((c) => [c.status, c.count]));

  const outcomes: OutcomeBreakdown[] = reservationRepository.OUTCOME_STATUSES.map((status) => ({
    status,
    count: countByStatus.get(status) ?? 0,
  }));

  return {
    from,
    to,
    totalCount: outcomes.reduce((sum, outcome) => sum + outcome.count, 0),
    outcomes,
  };
}
