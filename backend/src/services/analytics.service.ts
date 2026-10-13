import { OccupancyEventType, ReservationStatus } from '@prisma/client';
import { getMiguelProArea, type MiguelProArea } from '../config/miguelProAreas';
import * as seatRepository from '../repositories/seat.repository';
import * as occupancyLogRepository from '../repositories/occupancyLog.repository';
import * as reservationRepository from '../repositories/reservation.repository';
import * as validationEventRepository from '../repositories/validationEvent.repository';
import type {
  SeatOccupancyEvent,
  ReservationOccupancyEvent,
} from '../repositories/occupancyLog.repository';
import { BadRequestError } from '../utils/AppError';
import { BREAK_MAX_EXTENSIONS } from './reservation.service';

export interface UtilizationFilters {
  building?: string;
  floor?: number;
  area?: MiguelProArea;
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
  occupiedSeatHours: number;
  seats: SeatUtilization[];
}

export async function getUtilization(filters: UtilizationFilters): Promise<UtilizationReport> {
  const { from, to, seats, eventsBySeat } = await loadOccupancyData(filters);

  if (seats.length === 0) {
    return {
      from,
      to,
      seatCount: 0,
      overallUtilizationPercent: 0,
      occupiedSeatHours: 0,
      seats: [],
    };
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
    occupiedSeatHours: totalOccupiedMs / 3_600_000,
    seats: seatReports,
  };
}

export interface HourlyUtilization {
  hour: number; // 0-23, Philippine Time
  utilizationPercent: number;
  averageOccupiedSeats: number;
}

export interface PeakHoursReport {
  from: Date;
  to: Date;
  seatCount: number;
  hours: HourlyUtilization[];
}

export interface OccupancyForecastHour {
  hour: number; // 0-23, Philippine Time
  predictedUtilizationPercent: number | null;
  predictedOccupiedSeats: number | null;
  sampleCount: number;
}

export interface OccupancyForecastDay {
  date: string;
  hours: OccupancyForecastHour[];
}

export interface OccupancyForecastReport {
  from: Date;
  to: Date;
  generatedAt: Date;
  seatCount: number;
  hasObservedData: boolean;
  hasEnoughHistory: boolean;
  historySpanDays: number;
  activeDays: number;
  activeHours: number[];
  occupiedHourCells: number;
  historyScope: 'ALL_RECORDED';
  requirements: {
    activeDays: number;
    occupiedHourCells: number;
  };
  method: 'HISTORICAL_WEEKDAY_HOURLY_BASELINE';
  days: OccupancyForecastDay[];
}

const PHILIPPINE_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;
const FORECAST_REQUIREMENTS = {
  activeDays: 5,
  occupiedHourCells: 12,
} as const;

// Same occupied intervals as getUtilization, grouped by hour of day in
// Philippine Time. An occupied-seat count is easier to read than a tiny
// percentage when pilot activity is sparse.
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

  const hours: HourlyUtilization[] = Array.from({ length: 24 }, (_, hour) => {
    const utcHour = (hour - 8 + 24) % 24;
    const occupiedMs = occupiedMsByHour[utcHour] ?? 0;
    const possibleMs = possibleMsByHour[utcHour] ?? 0;
    return {
      hour,
      utilizationPercent: possibleMs > 0 ? roundToOneDecimal((occupiedMs / possibleMs) * 100) : 0,
      averageOccupiedSeats: possibleMs > 0 ? (occupiedMs * seats.length) / possibleMs : 0,
    };
  });

  return { from, to, seatCount: seats.length, hours };
}

// Produces a seven-day historical baseline from all prior occupancy logs for
// the selected library/floor. The dashboard date filter still applies to the
// other reports; a narrow date range must not discard earlier training data.
// A matching weekday/hour is preferred, then observations at the same hour
// on other weekdays. This is distinct from the pending SARIMA/XGBoost models.
export async function getOccupancyForecast(
  filters: UtilizationFilters,
): Promise<OccupancyForecastReport> {
  const { from, to, seats, eventsBySeat } = await loadOccupancyData(filters);
  let firstRecordedOccupancyMs = Number.POSITIVE_INFINITY;
  for (const events of eventsBySeat.values()) {
    for (const event of events) {
      if (event.eventType === OccupancyEventType.OCCUPIED) {
        firstRecordedOccupancyMs = Math.min(firstRecordedOccupancyMs, event.createdAt.getTime());
      }
    }
  }
  const historyFrom = Number.isFinite(firstRecordedOccupancyMs)
    ? new Date(firstRecordedOccupancyMs)
    : from;
  const occupiedMsByBucket = new Map<string, number>();
  const possibleMsByBucket = new Map<string, number>();
  let firstOccupiedAtMs = Number.POSITIVE_INFINITY;

  for (const seat of seats) {
    const intervals = extractOccupiedIntervals(eventsBySeat.get(seat.id) ?? [], historyFrom, to);
    for (const interval of intervals) {
      firstOccupiedAtMs = Math.min(firstOccupiedAtMs, interval.start.getTime());
      accumulateDatedHourlyMs(
        interval.start,
        interval.end,
        occupiedMsByBucket,
        PHILIPPINE_TIME_OFFSET_MS,
      );
    }
  }

  if (Number.isFinite(firstOccupiedAtMs)) {
    accumulateDatedHourlyMs(
      new Date(firstOccupiedAtMs),
      to,
      possibleMsByBucket,
      PHILIPPINE_TIME_OFFSET_MS,
      seats.length,
    );
  }

  const samplesByWeekdayHour = new Map<string, number[]>();
  const samplesByHour = new Map<number, number[]>();
  let totalOccupiedMs = 0;
  const activeDates = new Set<string>();
  const activeHours = new Set<number>();
  let occupiedHourCells = 0;

  for (const [bucket, possibleMs] of possibleMsByBucket) {
    if (possibleMs <= 0) continue;
    const [date, hourText] = bucket.split('|');
    const hour = Number(hourText);
    const occupiedMs = occupiedMsByBucket.get(bucket) ?? 0;
    const utilizationPercent = (occupiedMs / possibleMs) * 100;
    if (occupiedMs > 0) {
      activeDates.add(date ?? '');
      activeHours.add(hour);
      occupiedHourCells += 1;
    }
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    const weekdayHourKey = `${weekday}|${hour}`;

    const weekdaySamples = samplesByWeekdayHour.get(weekdayHourKey) ?? [];
    weekdaySamples.push(utilizationPercent);
    samplesByWeekdayHour.set(weekdayHourKey, weekdaySamples);

    const hourlySamples = samplesByHour.get(hour) ?? [];
    hourlySamples.push(utilizationPercent);
    samplesByHour.set(hour, hourlySamples);
    totalOccupiedMs += occupiedMs;
  }

  const historySpanDays = Number.isFinite(firstOccupiedAtMs)
    ? Math.floor((to.getTime() - firstOccupiedAtMs) / (24 * 60 * 60 * 1000))
    : 0;
  const hasEnoughHistory =
    activeDates.size >= FORECAST_REQUIREMENTS.activeDays &&
    occupiedHourCells >= FORECAST_REQUIREMENTS.occupiedHourCells;

  const firstForecastDate = new Date(to.getTime() + PHILIPPINE_TIME_OFFSET_MS);
  firstForecastDate.setUTCHours(0, 0, 0, 0);
  firstForecastDate.setUTCDate(firstForecastDate.getUTCDate() + 1);
  const days: OccupancyForecastDay[] = hasEnoughHistory
    ? Array.from({ length: 7 }, (_, dayOffset) => {
        const date = new Date(firstForecastDate);
        date.setUTCDate(firstForecastDate.getUTCDate() + dayOffset);
        const dateKey = date.toISOString().slice(0, 10);
        const weekday = date.getUTCDay();

        return {
          date: dateKey,
          hours: Array.from({ length: 24 }, (_, hour) => {
            const weekdaySamples = samplesByWeekdayHour.get(`${weekday}|${hour}`) ?? [];
            const samples = weekdaySamples.length
              ? weekdaySamples
              : (samplesByHour.get(hour) ?? []);
            const predictedUtilizationPercent = samples.length
              ? samples.reduce((sum, value) => sum + value, 0) / samples.length
              : null;

            return {
              hour,
              predictedUtilizationPercent,
              predictedOccupiedSeats:
                predictedUtilizationPercent === null
                  ? null
                  : (predictedUtilizationPercent * seats.length) / 100,
              sampleCount: samples.length,
            };
          }),
        };
      })
    : [];

  return {
    from: historyFrom,
    to,
    generatedAt: new Date(),
    seatCount: seats.length,
    hasObservedData: totalOccupiedMs > 0,
    hasEnoughHistory,
    historySpanDays,
    activeDays: activeDates.size,
    activeHours: [...activeHours].sort((left, right) => left - right),
    occupiedHourCells,
    historyScope: 'ALL_RECORDED',
    requirements: FORECAST_REQUIREMENTS,
    method: 'HISTORICAL_WEEKDAY_HOURLY_BASELINE',
    days,
  };
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

  const seats = await findScopedSeats(filters);

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

async function findScopedSeats(filters: Pick<UtilizationFilters, 'building' | 'floor' | 'area'>) {
  const seats = await seatRepository.findMany({ building: filters.building, floor: filters.floor });
  return filters.area
    ? seats.filter(
        (seat) =>
          seat.building === 'miguel_pro' && getMiguelProArea(seat.currentQrToken) === filters.area,
      )
    : seats;
}

interface TimeInterval {
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
): TimeInterval[] {
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();
  let occupiedSinceMs: number | null = null;
  const intervals: TimeInterval[] = [];

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

function sumIntervalMs(intervals: TimeInterval[]): number {
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

function accumulateDatedHourlyMs(
  start: Date,
  end: Date,
  bucketsMs: Map<string, number>,
  offsetMs: number,
  weight = 1,
): void {
  let cursorMs = start.getTime();
  const endMs = end.getTime();

  while (cursorMs < endMs) {
    const localClock = new Date(cursorMs + offsetMs);
    const hour = localClock.getUTCHours();
    const date = localClock.toISOString().slice(0, 10);
    const bucket = `${date}|${hour}`;
    const nextHourMs =
      Date.UTC(
        localClock.getUTCFullYear(),
        localClock.getUTCMonth(),
        localClock.getUTCDate(),
        hour + 1,
      ) - offsetMs;
    const chunkEndMs = Math.min(nextHourMs, endMs);
    bucketsMs.set(bucket, (bucketsMs.get(bucket) ?? 0) + (chunkEndMs - cursorMs) * weight);
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
  area?: MiguelProArea;
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
  const seatIds = filters.area
    ? (await findScopedSeats(filters)).map((seat) => seat.id)
    : undefined;

  const counts = await reservationRepository.countByOutcome({
    building: filters.building,
    floor: filters.floor,
    seatIds,
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

export interface NoShowRateFilters {
  building?: string;
  floor?: number;
  area?: MiguelProArea;
  from: Date;
  to: Date;
}

export interface NoShowRateReport {
  from: Date;
  to: Date;
  totalReservations: number;
  cancelledCount: number;
  noShowRatePercent: number;
}

// "No-show" here means CANCELLED a reservation that never reached
// CONFIRMED.
export async function getNoShowRate(filters: NoShowRateFilters): Promise<NoShowRateReport> {
  const { from, to } = resolveDateRange(filters);
  const seatIds = filters.area
    ? (await findScopedSeats(filters)).map((seat) => seat.id)
    : undefined;
  const scope = { building: filters.building, floor: filters.floor, seatIds, from, to };

  const [totalReservations, cancelledCount] = await Promise.all([
    reservationRepository.countByFilters(scope),
    reservationRepository.countByFilters({ ...scope, status: ReservationStatus.CANCELLED }),
  ]);

  return {
    from,
    to,
    totalReservations,
    cancelledCount,
    noShowRatePercent:
      totalReservations > 0 ? roundToOneDecimal((cancelledCount / totalReservations) * 100) : 0,
  };
}

export interface SessionLengthFilters {
  building?: string;
  floor?: number;
  area?: MiguelProArea;
  from: Date;
  to: Date;
}

export interface SessionLengthReport {
  from: Date;
  to: Date;
  sessionCount: number;
  averageSessionMinutes: number;
}

// A session runs from confirmedAt to endedAt
// (void, forfeit, eviction, or a future checkout action). Filtered by
// endedAt.
export async function getAverageSessionLength(
  filters: SessionLengthFilters,
): Promise<SessionLengthReport> {
  const { from, to } = resolveDateRange(filters);
  const seatIds = filters.area
    ? (await findScopedSeats(filters)).map((seat) => seat.id)
    : undefined;

  const sessions = await reservationRepository.findCompletedSessions({
    building: filters.building,
    floor: filters.floor,
    seatIds,
    from,
    to,
  });

  if (sessions.length === 0) {
    return { from, to, sessionCount: 0, averageSessionMinutes: 0 };
  }

  const totalMs = sessions.reduce(
    (sum, session) => sum + (session.endedAt.getTime() - session.confirmedAt.getTime()),
    0,
  );

  return {
    from,
    to,
    sessionCount: sessions.length,
    averageSessionMinutes: roundToOneDecimal(totalMs / sessions.length / 60_000),
  };
}

export interface BreakStatsFilters {
  building?: string;
  floor?: number;
  area?: MiguelProArea;
  from: Date;
  to: Date;
}

export interface BreakStatsReport {
  from: Date;
  to: Date;
  breakCount: number;
  averageBreakMinutes: number;
  returnedBreakCount: number;
  capHitCount: number;
  capHitPercent: number;
}

// breakCount/averageBreakMinutes cover all breaks, including forfeited
// ones. capHitPercent covers only returned breaks, extensionsUsed for
// a forfeited break is unknowable, since its Redis key is already gone
// by the time the expiry job checks it.
export async function getBreakStats(filters: BreakStatsFilters): Promise<BreakStatsReport> {
  const { from, to } = resolveDateRange(filters);

  const seats = await findScopedSeats(filters);

  if (seats.length === 0) {
    return {
      from,
      to,
      breakCount: 0,
      averageBreakMinutes: 0,
      returnedBreakCount: 0,
      capHitCount: 0,
      capHitPercent: 0,
    };
  }

  const seatIds = seats.map((seat) => seat.id);

  const [events, reservations, breakReturns] = await Promise.all([
    occupancyLogRepository.findEventsForReservationsInSeats(seatIds),
    reservationRepository.findBySeatIds(seatIds),
    validationEventRepository.findBreakReturnsInRange(seatIds, from, to),
  ]);

  const reservationById = new Map(reservations.map((r) => [r.id, r]));

  const eventsByReservation = new Map<string, ReservationOccupancyEvent[]>();
  for (const event of events) {
    const list = eventsByReservation.get(event.reservationId);
    if (list) {
      list.push(event);
    } else {
      eventsByReservation.set(event.reservationId, [event]);
    }
  }

  const breaksInRange: TimeInterval[] = [];
  for (const [reservationId, reservationEvents] of eventsByReservation) {
    const reservation = reservationById.get(reservationId);
    const forfeitedEndedAt =
      reservation?.status === ReservationStatus.FORFEITED ? reservation.endedAt : null;

    for (const breakInterval of extractBreakIntervals(reservationEvents, forfeitedEndedAt)) {
      if (breakInterval.end >= from && breakInterval.end < to) {
        breaksInRange.push(breakInterval);
      }
    }
  }

  const capHitCount = breakReturns.filter(
    (e) => (e.extensionsUsed ?? 0) >= BREAK_MAX_EXTENSIONS,
  ).length;
  const capHitPercent =
    breakReturns.length > 0 ? roundToOneDecimal((capHitCount / breakReturns.length) * 100) : 0;

  return {
    from,
    to,
    breakCount: breaksInRange.length,
    averageBreakMinutes:
      breaksInRange.length > 0
        ? roundToOneDecimal(sumIntervalMs(breaksInRange) / breaksInRange.length / 60_000)
        : 0,
    returnedBreakCount: breakReturns.length,
    capHitCount,
    capHitPercent,
  };
}

// Pairs each VACATED with the next OCCUPIED (break start -> return).
// An OCCUPIED with no prior VACATED is the initial approval, skipped.
// A trailing, unpaired VACATED closes at the reservation's own endedAt if
// it was FORFEITED (break-timer expiry still ended the break, just not
// via a return scan), otherwise it's skipped (still open, or ended via
// void).
function extractBreakIntervals(
  events: { eventType: OccupancyEventType; createdAt: Date }[],
  forfeitedEndedAt: Date | null,
): TimeInterval[] {
  const intervals: TimeInterval[] = [];
  let vacatedAt: Date | null = null;

  for (const event of events) {
    if (event.eventType === OccupancyEventType.VACATED) {
      vacatedAt = event.createdAt;
    } else if (vacatedAt !== null) {
      intervals.push({ start: vacatedAt, end: event.createdAt });
      vacatedAt = null;
    }
  }

  if (vacatedAt !== null && forfeitedEndedAt !== null) {
    intervals.push({ start: vacatedAt, end: forfeitedEndedAt });
  }

  return intervals;
}

export interface LocationComparisonFilters {
  building?: string;
  from: Date;
  to: Date;
}

export interface LocationDemand {
  building: string;
  floor: number;
  area?: MiguelProArea;
  seatCount: number;
  utilizationPercent: number;
  occupiedSeatHours: number;
}

export interface LocationComparisonReport {
  from: Date;
  to: Date;
  locations: LocationDemand[];
}

interface LocationAccumulator {
  building: string;
  floor: number;
  area?: MiguelProArea;
  seatCount: number;
  occupiedMs: number;
}

// Same occupied intervals as getUtilization, grouped by Gisbert floor or
// Miguel Pro area. No floor/area filter here: this is the full comparison.
export async function getLocationComparison(
  filters: LocationComparisonFilters,
): Promise<LocationComparisonReport> {
  const { from, to, seats, eventsBySeat } = await loadOccupancyData({
    building: filters.building,
    from: filters.from,
    to: filters.to,
  });

  const rangeMs = to.getTime() - from.getTime();
  const groups = new Map<string, LocationAccumulator>();

  for (const seat of seats) {
    const area = seat.building === 'miguel_pro' ? getMiguelProArea(seat.currentQrToken) : null;
    const groupKey = `${seat.building}::${seat.floor}::${area ?? ''}`;
    const occupiedMs = sumIntervalMs(
      extractOccupiedIntervals(eventsBySeat.get(seat.id) ?? [], from, to),
    );

    const group = groups.get(groupKey);
    if (group) {
      group.seatCount += 1;
      group.occupiedMs += occupiedMs;
    } else {
      groups.set(groupKey, {
        building: seat.building,
        floor: seat.floor,
        ...(area && { area }),
        seatCount: 1,
        occupiedMs,
      });
    }
  }

  const locations: LocationDemand[] = Array.from(groups.values())
    .map((group) => ({
      building: group.building,
      floor: group.floor,
      ...(group.area && { area: group.area }),
      seatCount: group.seatCount,
      utilizationPercent: roundToOneDecimal((group.occupiedMs / (rangeMs * group.seatCount)) * 100),
      occupiedSeatHours: group.occupiedMs / 3_600_000,
    }))
    .sort((a, b) => b.utilizationPercent - a.utilizationPercent);

  return { from, to, locations };
}
