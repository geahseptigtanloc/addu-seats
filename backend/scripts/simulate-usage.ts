/**
 * Usage simulation for the occupancy-analytics demo (LOCAL DATABASE ONLY).
 *
 * Generates three weeks of back-dated activity (normal, exam, normal) as
 * reservations plus the occupancy logs, break validations and ghost-seat flags
 * the real flows would have written. Occupancy is not painted onto a curve:
 * arrivals follow a feedback-controlled Poisson process and stays follow a
 * length mixture, so the curve emerges from students arriving and leaving.
 *
 *   npx tsx scripts/simulate-usage.ts --part 1 --dry-run   # preview, no writes
 *   npx tsx scripts/simulate-usage.ts --part 1 --confirm   # write week 1
 *   npx tsx scripts/simulate-usage.ts --reset --confirm    # delete simulated data
 *
 * Options: --part <1|2|3>  --seed <n>  --seat-map <path>  --skip-seat-check
 */
import { readFileSync } from 'node:fs';
import type { Prisma } from '@prisma/client';
import {
  OccupancyEventType,
  ReservationEndReason,
  ReservationStatus,
  SeatFlagStatus,
  SeatStatus,
  UserRole,
  ValidationEventType,
} from '@prisma/client';
import { isRetiredSeatToken } from '../src/config/retiredSeats';
import { resolveSeatQrToken } from '../src/config/seatQrAliases';

// ----------------------------------------------------------------- constants

const SIM_PREFIX = 'sim-';
const POOL_SIZE = 5500;
const ADMIN_COUNT = 3;
const BASE_SEED = 20261022;
const CHUNK_SIZE = 5000;

const MIN = 60_000;
const DAY_MS = 24 * 60 * MIN;
const MANILA_OFFSET_MS = 8 * 60 * MIN; // fixed UTC+8, no DST

const ENTRY_WINDOW_MS = 5 * MIN; // unapproved reservations lapse
const FLAG_WINDOW_MS = 5 * MIN; // holder's time to re-verify a flagged seat
const FLAG_COOLDOWN_MS = 5 * MIN; // one flag per student per window
const BREAK_COOLDOWN_MS = 30 * MIN; // after returning with both extensions used
const BREAK_BASE_S = 300;
const BREAK_EXTENSION_S = 300;

const ARRIVAL_GAIN = 0.1; // how hard arrivals correct a gap to the target
const ARRIVALS_STOP_BEFORE_CLOSE_MIN = 25;
const OPEN_RAMP_MIN = 8; // the opening queue clears over a few minutes

type Building = 'miguel_pro' | 'gisbert';
type Curve = ReadonlyArray<readonly [number, number]>;

const hm = (h: number, m = 0): number => h * 60 + m;

const EXPECTED_SEATS: Record<string, number> = {
  'gisbert:1': 175,
  'gisbert:2': 130,
  'gisbert:3': 120,
  'gisbert:4': 117,
  'miguel_pro:1': 230,
};

const HOURS: Record<Building, { weekday: [number, number]; saturday: [number, number] }> = {
  miguel_pro: { weekday: [hm(8), hm(20)], saturday: [hm(8), hm(12)] },
  gisbert: { weekday: [hm(7, 30), hm(20)], saturday: [hm(8), hm(18)] },
};

// ------------------------------------------------------------------ profiles

type Mix = readonly [number, number, number]; // P(short), P(medium), P(long)

interface Profile {
  weekday: Record<Building, Curve>;
  saturday: Record<Building, Curve>;
  floorWeights: readonly number[]; // Gisbert floors 1-4, relative popularity
  meanStayMin: number;
  stayMix: Mix;
  lunchMix: Mix; // between-class arrivals skew short
  longMedianMin: number;
  breakExtensions: Mix; // P(0), P(1), P(2) extensions used per break
  cancel: number;
  forfeit: number;
  forgot: number; // left without checking out
  forgotFlag: number; // share of forgotten seats that get flagged as ghost
  forgotStaff: number; // share voided individually by staff
  falseFlag: number; // flagged while present, holder re-verifies or checks out
  lateSigma: number; // day-to-day spread of how busy the last hours are
  quietFloorsEmpty: boolean; // Gisbert floors 3-4 may drain to zero before close
}

const NORMAL: Profile = {
  weekday: {
    miguel_pro: [
      [hm(8), 0.15],
      [hm(9), 0.3],
      [hm(10), 0.48],
      [hm(11), 0.66],
      [hm(12), 0.82],
      [hm(12, 30), 0.92],
      [hm(13), 0.96],
      [hm(13, 30), 0.86],
      [hm(14), 0.72],
      [hm(14, 30), 0.78],
      [hm(15), 0.86],
      [hm(16), 0.88],
      [hm(17), 0.85],
      [hm(18), 0.78],
      [hm(19), 0.42],
      [hm(20), 0.15],
    ],
    gisbert: [
      [hm(7, 30), 0.03],
      [hm(8), 0.08],
      [hm(9), 0.18],
      [hm(10), 0.3],
      [hm(11), 0.4],
      [hm(12), 0.51],
      [hm(12, 30), 0.64],
      [hm(13), 0.73],
      [hm(13, 30), 0.62],
      [hm(14), 0.42],
      [hm(14, 30), 0.49],
      [hm(15), 0.58],
      [hm(16), 0.61],
      [hm(17), 0.58],
      [hm(18), 0.5],
      [hm(19), 0.24],
      [hm(20), 0.06],
    ],
  },
  saturday: {
    miguel_pro: [
      [hm(8), 0.08],
      [hm(9), 0.25],
      [hm(10), 0.42],
      [hm(11), 0.46],
      [hm(11, 30), 0.3],
      [hm(12), 0.08],
    ],
    gisbert: [
      [hm(8), 0.05],
      [hm(9), 0.14],
      [hm(10), 0.22],
      [hm(11), 0.28],
      [hm(12), 0.3],
      [hm(13), 0.27],
      [hm(14), 0.2],
      [hm(15), 0.15],
      [hm(16), 0.1],
      [hm(17), 0.06],
      [hm(18), 0.03],
    ],
  },
  floorWeights: [1.15, 1.1, 0.88, 0.8],
  meanStayMin: 110,
  stayMix: [0.4, 0.43, 0.17],
  lunchMix: [0.65, 0.28, 0.07],
  longMedianMin: 220,
  breakExtensions: [0.7, 0.2, 0.1],
  cancel: 0.04,
  forfeit: 0.015,
  forgot: 0.085,
  forgotFlag: 0.35,
  forgotStaff: 0.55,
  falseFlag: 0.008,
  lateSigma: 0.5,
  quietFloorsEmpty: true,
};

const EXAM: Profile = {
  weekday: {
    miguel_pro: [
      [hm(8), 0.3],
      [hm(9), 0.5],
      [hm(10), 0.7],
      [hm(11), 0.88],
      [hm(12), 0.98],
      [hm(12, 30), 1],
      [hm(13, 30), 1],
      [hm(14), 0.86],
      [hm(14, 30), 0.92],
      [hm(15), 1],
      [hm(16, 30), 1],
      [hm(17), 0.95],
      [hm(18), 0.82],
      [hm(19), 0.52],
      [hm(20), 0.28],
    ],
    gisbert: [
      [hm(7, 30), 0.05],
      [hm(8), 0.16],
      [hm(9), 0.32],
      [hm(10), 0.5],
      [hm(11), 0.66],
      [hm(12), 0.8],
      [hm(12, 30), 0.88],
      [hm(13), 0.94],
      [hm(13, 30), 0.9],
      [hm(14), 0.58],
      [hm(14, 30), 0.68],
      [hm(15), 0.8],
      [hm(16), 0.85],
      [hm(17), 0.84],
      [hm(18), 0.5],
      [hm(19), 0.3],
      [hm(20), 0.17],
    ],
  },
  saturday: {
    miguel_pro: [
      [hm(8), 0.15],
      [hm(9), 0.45],
      [hm(10), 0.68],
      [hm(11), 0.78],
      [hm(11, 30), 0.5],
      [hm(12), 0.12],
    ],
    gisbert: [
      [hm(8), 0.1],
      [hm(9), 0.24],
      [hm(10), 0.38],
      [hm(11), 0.46],
      [hm(12), 0.5],
      [hm(13), 0.46],
      [hm(14), 0.36],
      [hm(15), 0.27],
      [hm(16), 0.18],
      [hm(17), 0.1],
      [hm(18), 0.05],
    ],
  },
  floorWeights: [1.05, 1.05, 0.97, 0.93],
  meanStayMin: 160,
  stayMix: [0.12, 0.4, 0.48],
  lunchMix: [0.45, 0.35, 0.2],
  longMedianMin: 330,
  breakExtensions: [0.55, 0.25, 0.2],
  cancel: 0.03,
  forfeit: 0.01,
  forgot: 0.12,
  forgotFlag: 0.5,
  forgotStaff: 0.4,
  falseFlag: 0.02,
  lateSigma: 0.3,
  quietFloorsEmpty: false,
};

interface PartConfig {
  weekStart: readonly [number, number, number]; // Monday, [year, month, day]
  profile: Profile;
  dayFactors: readonly number[]; // Mon-Fri multipliers on the weekday curves
}

const PARTS: Record<number, PartConfig> = {
  1: { weekStart: [2026, 9, 28], profile: NORMAL, dayFactors: [0.95, 1, 1.05, 1, 0.7] },
  2: { weekStart: [2026, 10, 5], profile: EXAM, dayFactors: [0.95, 1, 1, 0.97, 0.85] },
  3: { weekStart: [2026, 10, 12], profile: NORMAL, dayFactors: [0.85, 1, 1.05, 1, 0.7] },
};

// ------------------------------------------------------------------- random

let rand: () => number = Math.random;

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const uniform = (a: number, b: number): number => a + (b - a) * rand();
const normal = (): number => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
const logNormal = (median: number, sigma: number): number => median * Math.exp(sigma * normal());
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

function poisson(lambda: number): number {
  if (lambda <= 0) return 0;
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal()));
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > limit);
  return k - 1;
}

function pickIndex(weights: readonly number[]): number {
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Index ${index} out of range`);
  return item;
}

// UUIDv7 keyed to the simulated timestamp, so ids sort like real ones.
function uuidv7(timestampMs: number): string {
  const hex = (n: number, len: number): string => n.toString(16).padStart(len, '0');
  const t = Math.floor(timestampMs);
  const tail = hex(Math.floor(rand() * 0x1000000), 6) + hex(Math.floor(rand() * 0x1000000), 6);
  const variant = 0x8000 | Math.floor(rand() * 0x4000);
  const seq = Math.floor(rand() * 0x1000);
  return `${hex(Math.floor(t / 0x10000), 8)}-${hex(t % 0x10000, 4)}-7${hex(seq, 3)}-${hex(variant, 4)}-${tail}`;
}

function interp(curve: Curve, minute: number): number {
  const first = at(curve, 0);
  if (minute <= first[0]) return first[1];
  for (let i = 1; i < curve.length; i++) {
    const a = at(curve, i - 1);
    const b = at(curve, i);
    if (minute <= b[0]) return a[1] + ((b[1] - a[1]) * (minute - a[0])) / (b[0] - a[0]);
  }
  return at(curve, curve.length - 1)[1];
}

// --------------------------------------------------------------------- model

interface SeatRef {
  id: string;
}

interface Zone {
  building: Building;
  floor: number;
  seats: SeatRef[];
  free: number[]; // indices into seats
  active: Session[];
  target: Float64Array; // target fraction per minute of the day
  open: number;
  close: number;
  occupancy: Uint16Array; // held seats per minute of the day
  weightIndex: number; // position among Gisbert floors, -1 for Migpro
}

type SessionKind =
  | 'checkout'
  | 'cancel'
  | 'timeout'
  | 'forfeit'
  | 'ghostEvict'
  | 'ghostVoid'
  | 'staffVoid'
  | 'closingVoid'
  | 'midnightVoid';

interface Session {
  id: string;
  userIdx: number;
  zone: Zone;
  seatIdx: number;
  kind: SessionKind;
  createdMs: number;
  confirmedMs: number | null;
  leaveMs: number; // physical departure; equals holdEndMs unless the seat is forgotten
  holdEndMs: number; // when the reservation ends in the system
  pressurable: boolean; // may leave early when the zone is above target
  flagMs: number | null; // ghost flag raised against a forgotten seat
  forfeitBreak: { startMs: number; extensions: number } | null;
  adminIdx: number;
}

interface ZoneSnapshot {
  building: Building;
  floor: number;
  open: number;
  close: number;
  capacity: number;
  occupancy: Uint16Array;
}

interface DayContext {
  dayStartMs: number;
  closingBatchMs: Record<Building, number>;
  adminByBuilding: Record<Building, number>;
}

interface Output {
  users: Prisma.UserCreateManyInput[];
  reservations: Prisma.ReservationCreateManyInput[];
  occupancyLogs: Prisma.OccupancyLogCreateManyInput[];
  validationEvents: Prisma.ValidationEventCreateManyInput[];
  seatFlags: Prisma.SeatFlagCreateManyInput[];
}

interface Counters {
  dropped: number;
  spilled: number;
  breaks: number;
  extensionHistogram: [number, number, number];
  stayMinutes: number[];
}

interface Pool {
  ids: string[];
  adminIds: string[];
  cumulative: Float64Array;
  busyUntil: Float64Array;
  flagTimes: Map<number, number[]>;
}

// ---------------------------------------------------------------- simulation

function pickUser(pool: Pool, nowMs: number): number {
  const total = pool.cumulative[pool.cumulative.length - 1] ?? 0;
  for (let attempt = 0; attempt < 40; attempt++) {
    const r = rand() * total;
    let lo = 0;
    let hi = pool.cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((pool.cumulative[mid] ?? 0) < r) lo = mid + 1;
      else hi = mid;
    }
    if ((pool.busyUntil[lo] ?? 0) <= nowMs) return lo;
  }
  const start = Math.floor(rand() * pool.ids.length);
  for (let i = 0; i < pool.ids.length; i++) {
    const idx = (start + i) % pool.ids.length;
    if ((pool.busyUntil[idx] ?? 0) <= nowMs) return idx;
  }
  return -1;
}

function pickFlagger(pool: Pool, holderIdx: number, tsMs: number): number {
  const clear = (idx: number): boolean =>
    idx !== holderIdx &&
    (pool.flagTimes.get(idx) ?? []).every((t) => Math.abs(t - tsMs) >= FLAG_COOLDOWN_MS);
  let idx = Math.floor(rand() * pool.ids.length);
  for (let i = 0; i < pool.ids.length && !clear(idx); i++) idx = (idx + 1) % pool.ids.length;
  pool.flagTimes.set(idx, [...(pool.flagTimes.get(idx) ?? []), tsMs]);
  return idx;
}

function stayMinutes(profile: Profile, minuteOfDay: number): number {
  const lunch = minuteOfDay >= hm(11, 30) && minuteOfDay < hm(13, 30);
  const mix = lunch ? profile.lunchMix : profile.stayMix;
  const band = pickIndex(mix);
  if (band === 0) return clamp(logNormal(58, 0.35), 20, 110);
  if (band === 1) return clamp(logNormal(135, 0.3), 75, 230);
  return clamp(logNormal(profile.longMedianMin, 0.3), 160, 600);
}

function planSession(
  profile: Profile,
  ctx: DayContext,
  zone: Zone,
  seatIdx: number,
  userIdx: number,
  nowMs: number,
  minuteOfDay: number,
): Session {
  const closeMs = ctx.dayStartMs + zone.close * MIN;
  const lengthMs = stayMinutes(profile, minuteOfDay) * MIN;
  const confirmedMs = nowMs + uniform(20_000, 270_000);
  const closingEndMs = (): number => ctx.closingBatchMs[zone.building] + uniform(0, 25_000);
  const base = {
    id: uuidv7(nowMs),
    userIdx,
    zone,
    seatIdx,
    createdMs: nowMs,
    flagMs: null,
    forfeitBreak: null,
    adminIdx: ctx.adminByBuilding[zone.building],
    pressurable: false,
  };

  // Walking out without checking out happens mostly at the end of the day.
  const leavesLate = nowMs + lengthMs >= closeMs - 90 * MIN;
  const forgotRate = profile.forgot * (leavesLate ? 1.4 : 0.5);
  const r = rand();

  if (r < profile.cancel) {
    const lapses = rand() < 0.45;
    const endMs = lapses ? nowMs + ENTRY_WINDOW_MS + uniform(0, 45_000) : nowMs + uniform(40_000, 180_000);
    return { ...base, kind: lapses ? 'timeout' : 'cancel', confirmedMs: null, leaveMs: endMs, holdEndMs: endMs };
  }

  if (r < profile.cancel + profile.forfeit) {
    const timerMs = (BREAK_BASE_S + 2 * BREAK_EXTENSION_S) * 1000 + 60_000;
    const latestStart = closeMs - timerMs - 5 * MIN;
    const startMs = Math.min(confirmedMs + lengthMs * uniform(0.35, 0.85), latestStart);
    if (startMs >= confirmedMs + 10 * MIN) {
      const extensions = pickIndex(profile.breakExtensions);
      const endMs = startMs + (BREAK_BASE_S + extensions * BREAK_EXTENSION_S) * 1000 + uniform(5_000, 50_000);
      return {
        ...base,
        kind: 'forfeit',
        confirmedMs,
        leaveMs: endMs,
        holdEndMs: endMs,
        forfeitBreak: { startMs, extensions },
      };
    }
  } else if (r < profile.cancel + profile.forfeit + forgotRate) {
    if (leavesLate) {
      // Closing rush: everyone packs up at once and a few skip the checkout.
      const leaveMs = Math.max(confirmedMs + 15 * MIN, closeMs - uniform(0, 35) * MIN);
      const kind = rand() < 0.82 ? 'closingVoid' : 'midnightVoid';
      const holdEndMs = kind === 'closingVoid' ? closingEndMs() : ctx.dayStartMs + DAY_MS;
      return { ...base, kind, confirmedMs, leaveMs, holdEndMs };
    }
    // Mid-day: another student flags the seat, or staff notice it on their rounds.
    const leaveMs = Math.min(nowMs + lengthMs, closeMs - uniform(0, 10) * MIN);
    const s = rand();
    if (s < profile.forgotFlag) {
      const flagMs = leaveMs + uniform(10, 90) * MIN;
      if (flagMs + FLAG_WINDOW_MS < closeMs - 10 * MIN) {
        if (rand() < 0.55) {
          const holdEndMs = flagMs + FLAG_WINDOW_MS + uniform(5_000, 55_000);
          return { ...base, kind: 'ghostEvict', confirmedMs, leaveMs, holdEndMs, flagMs };
        }
        const holdEndMs = flagMs + uniform(0.7, 4.2) * MIN;
        return { ...base, kind: 'ghostVoid', confirmedMs, leaveMs, holdEndMs, flagMs };
      }
    } else if (s < profile.forgotFlag + profile.forgotStaff) {
      const holdEndMs = leaveMs + uniform(25, 150) * MIN;
      if (holdEndMs < closeMs - 10 * MIN) {
        return { ...base, kind: 'staffVoid', confirmedMs, leaveMs, holdEndMs };
      }
    }
    return { ...base, kind: 'closingVoid', confirmedMs, leaveMs, holdEndMs: closingEndMs() };
  }

  const plannedEndMs = nowMs + lengthMs;
  if (plannedEndMs >= closeMs - 8 * MIN) {
    if (rand() < 0.3) {
      const leaveMs = closeMs - uniform(0, 10) * MIN;
      return { ...base, kind: 'closingVoid', confirmedMs, leaveMs, holdEndMs: closingEndMs() };
    }
    const endMs = Math.max(confirmedMs + 10 * MIN, closeMs - uniform(0, 8) * MIN);
    return { ...base, kind: 'checkout', confirmedMs, leaveMs: endMs, holdEndMs: endMs, pressurable: true };
  }
  return { ...base, kind: 'checkout', confirmedMs, leaveMs: plannedEndMs, holdEndMs: plannedEndMs, pressurable: true };
}

// Turns a finished session into the rows the real flows would have written.
function finalize(s: Session, profile: Profile, pool: Pool, out: Output, counters: Counters): void {
  const userId = at(pool.ids, s.userIdx);
  const adminId = at(pool.adminIds, s.adminIdx);
  const endMs = s.holdEndMs;
  const seatId = at(s.zone.seats, s.seatIdx).id;
  let busyUntil = endMs + uniform(3, 15) * MIN;

  const reservation: Prisma.ReservationCreateManyInput = {
    id: s.id,
    userId,
    seatId,
    status: ReservationStatus.COMPLETED,
    createdAt: new Date(s.createdMs),
    confirmedAt: s.confirmedMs === null ? null : new Date(s.confirmedMs),
    endedAt: new Date(endMs),
  };
  const logAt = (eventType: OccupancyEventType, ms: number): void => {
    out.occupancyLogs.push({
      id: uuidv7(ms),
      reservationId: s.id,
      eventType,
      createdAt: new Date(ms),
    });
  };

  switch (s.kind) {
    case 'cancel':
    case 'timeout':
      reservation.status = ReservationStatus.CANCELLED;
      break;
    case 'forfeit':
      reservation.status = ReservationStatus.FORFEITED;
      break;
    case 'ghostEvict':
      reservation.status = ReservationStatus.EVICTED;
      break;
    case 'ghostVoid':
      reservation.status = ReservationStatus.VOIDED;
      reservation.endReason = ReservationEndReason.GHOST_CONFIRMED;
      reservation.endedById = adminId;
      break;
    case 'staffVoid':
      reservation.status = ReservationStatus.VOIDED;
      reservation.endReason = ReservationEndReason.STAFF_VOID;
      reservation.endedById = adminId;
      break;
    case 'closingVoid':
      reservation.status = ReservationStatus.VOIDED;
      reservation.endReason = ReservationEndReason.BULK_VOID;
      reservation.endedById = adminId;
      break;
    case 'midnightVoid':
      reservation.status = ReservationStatus.VOIDED;
      reservation.endReason = ReservationEndReason.MIDNIGHT_SWEEP;
      break;
    case 'checkout':
      break;
  }
  out.reservations.push(reservation);

  const breakSpans: [number, number][] = [];
  if (s.confirmedMs !== null) {
    logAt(OccupancyEventType.OCCUPIED, s.confirmedMs);

    // Breaks: logged VACATED on start and OCCUPIED on return, with the
    // extensions used recorded on the return event.
    let cooldownUntil = 0;
    if (s.kind === 'forfeit' && s.forfeitBreak) {
      logAt(OccupancyEventType.VACATED, s.forfeitBreak.startMs);
    } else {
      const windowStart = s.confirmedMs + 15 * MIN;
      const windowEnd = s.leaveMs - 10 * MIN;
      const hours = (s.leaveMs - s.confirmedMs) / (60 * MIN);
      let remaining = Math.min(3, poisson(hours * 0.5));
      let cursor = windowStart;
      while (remaining-- > 0 && windowEnd - cursor > 6 * MIN) {
        const startMs = cursor + rand() * (windowEnd - cursor) * 0.6;
        const extensions = pickIndex(profile.breakExtensions);
        const seconds =
          extensions === 0 ? uniform(60, 290) : (BREAK_BASE_S + extensions * BREAK_EXTENSION_S) - uniform(10, 290);
        const returnMs = startMs + seconds * 1000;
        if (returnMs > windowEnd) break;
        logAt(OccupancyEventType.VACATED, startMs);
        logAt(OccupancyEventType.OCCUPIED, returnMs);
        breakSpans.push([startMs, returnMs]);
        out.validationEvents.push({
          id: uuidv7(returnMs),
          reservationId: s.id,
          eventType: ValidationEventType.BREAK_RETURN,
          extensionsUsed: extensions,
          createdAt: new Date(returnMs),
        });
        counters.breaks++;
        counters.extensionHistogram[extensions] = (counters.extensionHistogram[extensions] ?? 0) + 1;
        if (extensions === 2) cooldownUntil = returnMs + BREAK_COOLDOWN_MS;
        cursor = returnMs + (extensions === 2 ? BREAK_COOLDOWN_MS : 20 * MIN);
      }
    }
    busyUntil = Math.max(busyUntil, cooldownUntil);

    if (s.kind !== 'forfeit') logAt(OccupancyEventType.VACATED, endMs);
  }

  // Ghost flags raised against a forgotten seat.
  if ((s.kind === 'ghostEvict' || s.kind === 'ghostVoid') && s.flagMs !== null) {
    const evicted = s.kind === 'ghostEvict';
    out.seatFlags.push({
      id: uuidv7(s.flagMs),
      seatId,
      reservationId: s.id,
      flaggedById: at(pool.ids, pickFlagger(pool, s.userIdx, s.flagMs)),
      status: evicted ? SeatFlagStatus.EVICTED : SeatFlagStatus.VOIDED,
      createdAt: new Date(s.flagMs),
      expiresAt: new Date(s.flagMs + FLAG_WINDOW_MS),
      resolvedAt: new Date(endMs),
    });
  }

  // False alarms: a present student is flagged, then re-verifies or checks out.
  const presentMs = endMs - (s.confirmedMs ?? endMs);
  if (s.kind === 'checkout' && s.confirmedMs !== null && presentMs > 50 * MIN && rand() < profile.falseFlag) {
    const checkedOutFirst = rand() < 0.3;
    let flagMs = checkedOutFirst ? endMs - uniform(0.6, 4) * MIN : uniform(s.confirmedMs + 20 * MIN, endMs - 6 * MIN);
    // A flag never lands on a break in progress.
    for (let tries = 0; tries < 8 && breakSpans.some(([a, b]) => flagMs > a - 6 * MIN && flagMs < b + MIN); tries++) {
      flagMs = uniform(s.confirmedMs + 20 * MIN, endMs - 6 * MIN);
    }
    if (!breakSpans.some(([a, b]) => flagMs > a - 6 * MIN && flagMs < b + MIN)) {
      const resolvedMs = checkedOutFirst ? endMs : flagMs + uniform(0.5, 4.5) * MIN;
      out.seatFlags.push({
        id: uuidv7(flagMs),
        seatId,
        reservationId: s.id,
        flaggedById: at(pool.ids, pickFlagger(pool, s.userIdx, flagMs)),
        status: checkedOutFirst ? SeatFlagStatus.CHECKED_OUT : SeatFlagStatus.REVERIFIED,
        createdAt: new Date(flagMs),
        expiresAt: new Date(flagMs + FLAG_WINDOW_MS),
        resolvedAt: new Date(resolvedMs),
      });
      if (!checkedOutFirst) {
        out.validationEvents.push({
          id: uuidv7(resolvedMs),
          reservationId: s.id,
          eventType: ValidationEventType.FLAG_REVERIFICATION,
          createdAt: new Date(resolvedMs),
        });
      }
    }
  }

  if (s.kind === 'checkout' && s.confirmedMs !== null) {
    counters.stayMinutes.push((endMs - s.confirmedMs) / MIN);
  }
  pool.busyUntil[s.userIdx] = busyUntil;
}

function buildTarget(
  zone: Zone,
  profile: Profile,
  saturday: boolean,
  dayFactor: number,
  buildingNoise: number,
): void {
  const curve = (saturday ? profile.saturday : profile.weekday)[zone.building];
  const isGisbert = zone.weightIndex >= 0;
  const weight = isGisbert ? (profile.floorWeights[zone.weightIndex] ?? 1) : 1;
  const zoneNoise = clamp(1 + 0.04 * normal(), 0.9, 1.1);
  const late = clamp(logNormal(1, profile.lateSigma), zone.building === 'miguel_pro' ? 0.35 : 0.15, 2.2);
  const quietFloor = isGisbert && zone.weightIndex >= 2 && profile.quietFloorsEmpty;
  const quietLevel = rand() < 0.5 ? 0 : 0.35;
  const lateStart = saturday ? zone.close - 120 : hm(18);
  const cap = zone.building === 'miguel_pro' ? 0.995 : 0.99;
  let drift = 1;

  for (let m = zone.open; m <= zone.close; m++) {
    drift = clamp(drift + 0.05 * (1 - drift) + 0.012 * normal(), 0.85, 1.15);
    const lateRamp = clamp((m - lateStart) / (zone.close - lateStart), 0, 1);
    const quietRamp = clamp((m - (zone.close - 90)) / 90, 0, 1);
    const openRamp = clamp((m - zone.open + 3) / OPEN_RAMP_MIN, 0, 1);
    let fraction = interp(curve, m) * dayFactor * buildingNoise * zoneNoise * drift * weight;
    fraction *= 1 + (late - 1) * lateRamp;
    if (quietFloor) fraction *= 1 - (1 - quietLevel) * quietRamp;
    zone.target[m] = clamp(fraction * openRamp, 0, cap);
  }
}

function simulateDay(
  profile: Profile,
  pool: Pool,
  zones: Zone[],
  dayIdx: number,
  dayStartMs: number,
  dayFactor: number,
  out: Output,
  counters: Counters,
): void {
  const saturday = dayIdx === 5;
  const buildingNoise: Record<Building, number> = {
    miguel_pro: clamp(logNormal(1, 0.06), 0.85, 1.15),
    gisbert: clamp(logNormal(1, 0.06), 0.85, 1.15),
  };
  const ctx: DayContext = {
    dayStartMs,
    closingBatchMs: { miguel_pro: 0, gisbert: 0 },
    adminByBuilding: {
      miguel_pro: Math.floor(rand() * ADMIN_COUNT),
      gisbert: Math.floor(rand() * ADMIN_COUNT),
    },
  };

  for (const zone of zones) {
    const [open, close] = HOURS[zone.building][saturday ? 'saturday' : 'weekday'];
    zone.open = open;
    zone.close = close;
    zone.free = zone.seats.map((_, i) => i);
    zone.active = [];
    zone.target.fill(0);
    zone.occupancy.fill(0);
    buildTarget(zone, profile, saturday, saturday ? 1 : dayFactor, buildingNoise[zone.building]);
    ctx.closingBatchMs[zone.building] = dayStartMs + close * MIN + uniform(1, 12) * MIN;
  }

  const gisbertZones = zones.filter((z) => z.weightIndex >= 0);
  const migpro = zones.find((z) => z.building === 'miguel_pro');
  const firstMinute = Math.min(...zones.map((z) => z.open));
  const lastMinute = Math.max(...zones.map((z) => z.close));

  const release = (zone: Zone, minuteEndMs: number): void => {
    for (let i = zone.active.length - 1; i >= 0; i--) {
      const s = at(zone.active, i);
      if (s.holdEndMs < minuteEndMs) {
        finalize(s, profile, pool, out, counters);
        zone.free.push(s.seatIdx);
        zone.active.splice(i, 1);
      }
    }
  };

  const seatArrival = (zone: Zone, nowMs: number, minuteOfDay: number): void => {
    let target = zone;
    if (target.free.length === 0) {
      const spillPool = target === migpro ? gisbertZones : zones.filter((z) => z !== target && z.weightIndex >= 0);
      const open = spillPool.filter((z) => z.free.length > 0 && minuteOfDay >= z.open && minuteOfDay < z.close);
      if (open.length === 0 || rand() > (target === migpro ? 0.6 : 0.7)) {
        counters.dropped++;
        return;
      }
      target = at(open, pickIndex(open.map((z) => z.free.length)));
      counters.spilled++;
    }
    const userIdx = pickUser(pool, nowMs);
    if (userIdx < 0) return;
    const slot = Math.floor(rand() * target.free.length);
    const seatIdx = at(target.free, slot);
    target.free[slot] = at(target.free, target.free.length - 1);
    target.free.pop();
    const session = planSession(profile, ctx, target, seatIdx, userIdx, nowMs, minuteOfDay);
    pool.busyUntil[userIdx] = Number.POSITIVE_INFINITY;
    target.active.push(session);
  };

  for (let m = firstMinute; m < lastMinute; m++) {
    const minuteMs = dayStartMs + m * MIN;
    for (const zone of zones) {
      if (m < zone.open || m >= zone.close) continue;
      const capacity = zone.seats.length;
      const targetSeats = (zone.target[m] ?? 0) * capacity;

      // Early departures: the zone is above target, so long-stayers start leaving.
      const held = zone.active.length;
      const excess = held - targetSeats;
      if (excess > Math.max(2, 0.04 * capacity)) {
        const closing = m >= zone.close - 90;
        const p = clamp(((closing ? 0.3 : 0.12) * excess) / held, 0, closing ? 0.08 : 0.03);
        for (const s of zone.active) {
          if (s.pressurable && minuteMs - s.createdMs >= 45 * MIN && rand() < p) {
            s.holdEndMs = minuteMs + uniform(0, MIN);
            s.leaveMs = s.holdEndMs;
            s.pressurable = false;
          }
        }
      }

      // Seats freed within this minute become bookable from the next one, so a
      // seat is never reserved before its previous holder has left.
      release(zone, minuteMs);

      if (m < zone.close - ARRIVALS_STOP_BEFORE_CLOSE_MIN) {
        const next = (zone.target[m + 1] ?? 0) * capacity;
        const lambda = Math.max(
          0,
          next - targetSeats + zone.active.length / profile.meanStayMin + ARRIVAL_GAIN * (targetSeats - zone.active.length),
        );
        for (let n = poisson(lambda); n > 0; n--) {
          seatArrival(zone, minuteMs + rand() * MIN, m);
        }
      }
      zone.occupancy[m] = zone.active.length;
    }
  }

  // Closing: whoever is still on the books is settled by their own end time.
  for (const zone of zones) {
    zone.active.sort((a, b) => a.holdEndMs - b.holdEndMs);
    for (const s of zone.active) finalize(s, profile, pool, out, counters);
    zone.active = [];
  }
}

// ------------------------------------------------------------------ database

const FIRST_NAMES = [
  'Juan', 'Maria', 'Jose', 'Ana', 'Mark', 'Angela', 'John', 'Kristine', 'Paolo', 'Jasmine',
  'Carlo', 'Patricia', 'Miguel', 'Sofia', 'Rafael', 'Bianca', 'Gabriel', 'Camille', 'Joshua', 'Danica',
  'Nathan', 'Trisha', 'Kevin', 'Ella', 'Jericho', 'Faith', 'Lance', 'Hannah', 'Dominic', 'Janine',
  'Ryan', 'Isabel', 'Adrian', 'Katrina', 'Vincent', 'Alyssa', 'Francis', 'Denise', 'Jerome', 'Nicole',
];
const LAST_NAMES = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Garcia', 'Mendoza', 'Torres', 'Flores', 'Ramos', 'Aquino',
  'Castillo', 'Villanueva', 'Navarro', 'Domingo', 'Salazar', 'Pascual', 'Fernandez', 'Lim', 'Tan', 'Dela Cruz',
  'Mercado', 'Soriano', 'Valdez', 'Aguilar', 'Rivera', 'Manalo', 'Padilla', 'Estrada', 'Velasco', 'Gonzales',
  'Lopez', 'Alvarez', 'Marquez', 'Lorenzo', 'Dizon', 'Ocampo', 'Tolentino', 'Abad', 'Cabrera', 'Magno',
];

type Db = Prisma.TransactionClient;

interface LoadedPool {
  pool: Pool;
  newUsers: Prisma.UserCreateManyInput[];
}

async function loadPool(db: Db): Promise<LoadedPool> {
  rand = mulberry32(BASE_SEED); // fixed so every part sees the same students
  const existing = new Map(
    (
      await db.user.findMany({
        where: { googleId: { startsWith: SIM_PREFIX } },
        select: { id: true, googleId: true },
      })
    ).map((u) => [u.googleId, u.id]),
  );
  const newUsers: Prisma.UserCreateManyInput[] = [];
  const makeUser = (googleId: string, name: string, role: UserRole, index: number): string => {
    // Draw first so the random stream is identical whether or not the user exists.
    const id = uuidv7(Date.UTC(2026, 8, 1) + index);
    const last4 = String(Math.floor(rand() * 10000)).padStart(4, '0');
    const known = existing.get(googleId);
    if (known) return known;
    newUsers.push({
      id,
      googleId,
      email: `${googleId}@sim.local`,
      name,
      role,
      studentIdLast4: role === UserRole.STUDENT ? last4 : null,
      createdAt: new Date(Date.UTC(2026, 7, 15)),
    });
    return id;
  };

  const adminIds = Array.from({ length: ADMIN_COUNT }, (_, i) =>
    makeUser(`${SIM_PREFIX}admin-${i + 1}`, `Front Desk ${i + 1}`, UserRole.ADMIN, i),
  );
  const weights: number[] = [];
  const ids = Array.from({ length: POOL_SIZE }, (_, i) => {
    weights.push(Math.exp(normal())); // regulars visit far more often
    const name = `${at(FIRST_NAMES, Math.floor(rand() * FIRST_NAMES.length))} ${at(LAST_NAMES, Math.floor(rand() * LAST_NAMES.length))}`;
    return makeUser(`${SIM_PREFIX}${String(i + 1).padStart(4, '0')}`, name, UserRole.STUDENT, ADMIN_COUNT + i);
  });

  const cumulative = new Float64Array(POOL_SIZE);
  weights.reduce((sum, w, i) => (cumulative[i] = sum + w), 0);
  return {
    pool: {
      ids,
      adminIds,
      cumulative,
      busyUntil: new Float64Array(POOL_SIZE),
      flagTimes: new Map(),
    },
    newUsers,
  };
}

interface DbSeat {
  id: string;
  building: string;
  floor: number;
  currentQrToken: string;
  status: SeatStatus;
}

// Retired seats stay in the table but are not in seat-map.json.
const isRetiredSeat = (s: DbSeat): boolean => isRetiredSeatToken(resolveSeatQrToken(s.currentQrToken));
const isUsableSeat = (s: DbSeat): boolean => s.status !== SeatStatus.UNAVAILABLE && !isRetiredSeat(s);

function buildZones(seats: DbSeat[]): Zone[] {
  const make = (building: Building, floor: number, weightIndex: number): Zone => {
    const usable = seats.filter(
      (s) => s.building === building && s.floor === floor && isUsableSeat(s),
    );
    return {
      building,
      floor,
      seats: usable.map((s) => ({ id: s.id })),
      free: [],
      active: [],
      target: new Float64Array(24 * 60 + 2),
      open: 0,
      close: 0,
      occupancy: new Uint16Array(24 * 60 + 2),
      weightIndex,
    };
  };
  return [make('miguel_pro', 1, -1), ...[1, 2, 3, 4].map((f, i) => make('gisbert', f, i))];
}

function checkSeatCounts(seats: DbSeat[], skip: boolean): void {
  const counts = new Map<string, number>();
  for (const s of seats) {
    if (!isUsableSeat(s)) continue; // retired/unavailable rows are not part of the seat map
    counts.set(`${s.building}:${s.floor}`, (counts.get(`${s.building}:${s.floor}`) ?? 0) + 1);
  }
  const rows = Object.entries(EXPECTED_SEATS).map(
    ([key, expected]) => `  ${key.padEnd(14)} expected ${expected}, found ${counts.get(key) ?? 0}`,
  );
  const mismatch = Object.entries(EXPECTED_SEATS).some(([key, n]) => (counts.get(key) ?? 0) !== n);
  if (mismatch && !skip) {
    throw new Error(`Seat table does not match the seat map:\n${rows.join('\n')}\nReseed, or pass --skip-seat-check.`);
  }
}

function checkSeatMapFile(path: string, seats: DbSeat[], skip: boolean): void {
  const file = JSON.parse(readFileSync(path, 'utf8')) as { building: string; floor: number; currentQrToken: string }[];
  const inDb = new Map(seats.map((s) => [s.currentQrToken, s]));
  const inFile = new Set(file.map((s) => s.currentQrToken));
  const missing = file.filter((s) => !inDb.has(s.currentQrToken));
  const moved = file.filter((s) => {
    const db = inDb.get(s.currentQrToken);
    return db !== undefined && (db.building !== s.building || db.floor !== s.floor);
  });
  const extra = seats.filter((s) => !inFile.has(s.currentQrToken) && isUsableSeat(s));
  console.log(
    `Seat map: ${inFile.size} tokens in file, ${missing.length} missing from DB, ` +
      `${moved.length} on a different floor, ${extra.length} extra in DB`,
  );
  const show = (label: string, rows: string[]): void => {
    if (rows.length > 0) console.log(`  ${label}: ${rows.slice(0, 10).join(', ')}${rows.length > 10 ? ', ...' : ''}`);
  };
  show('missing', missing.map((s) => s.currentQrToken));
  show('moved', moved.map((s) => `${s.currentQrToken} (map ${s.building}:${s.floor}, DB ${inDb.get(s.currentQrToken)?.building}:${inDb.get(s.currentQrToken)?.floor})`));
  show('extra', extra.map((s) => `${s.currentQrToken} (${s.building}:${s.floor})`));
  if ((missing.length > 0 || moved.length > 0) && !skip) {
    throw new Error('Database does not match the seat map. Reseed first, or pass --skip-seat-check.');
  }
}

async function insertChunks<T>(label: string, rows: T[], insert: (chunk: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) await insert(rows.slice(i, i + CHUNK_SIZE));
  console.log(`  inserted ${rows.length} ${label}`);
}

// ------------------------------------------------------------------- summary

const pct = (x: number): string => `${Math.round(x * 100)}%`.padStart(4);

function printSummary(
  part: number,
  out: Output,
  counters: Counters,
  dayOccupancy: ZoneSnapshot[][],
  rangeStartMs: number,
): void {
  console.log(`\n=== Part ${part} summary ===`);
  const byStatus = new Map<string, number>();
  for (const r of out.reservations) byStatus.set(r.status ?? '', (byStatus.get(r.status ?? '') ?? 0) + 1);
  const total = out.reservations.length;
  console.log(`Reservations: ${total}`);
  for (const [status, n] of [...byStatus].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status.padEnd(10)} ${String(n).padStart(6)}  ${((100 * n) / total).toFixed(1)}%`);
  }
  const byReason = new Map<string, number>();
  for (const r of out.reservations) if (r.endReason) byReason.set(r.endReason, (byReason.get(r.endReason) ?? 0) + 1);
  console.log(`  VOIDED by reason: ${[...byReason].map(([k, v]) => `${k} ${v}`).join(', ')}`);
  const stays = [...counters.stayMinutes].sort((a, b) => a - b);
  const median = stays[Math.floor(stays.length / 2)] ?? 0;
  const mean = stays.reduce((a, b) => a + b, 0) / Math.max(1, stays.length);
  console.log(`Checked-out stays: median ${Math.round(median)} min, mean ${Math.round(mean)} min`);
  console.log(
    `Breaks: ${counters.breaks} (extensions 0/1/2: ${counters.extensionHistogram.join('/')}), flags: ${out.seatFlags.length}, ` +
      `turned away: ${counters.dropped}, spilled: ${counters.spilled}`,
  );
  console.log(
    `Rows: ${out.occupancyLogs.length} occupancy logs, ${out.validationEvents.length} validation events`,
  );

  const perDay = [0, 0, 0, 0, 0, 0];
  for (const r of out.reservations) {
    const d = Math.floor((new Date(r.createdAt as Date).getTime() - rangeStartMs) / DAY_MS);
    perDay[d] = (perDay[d] ?? 0) + 1;
  }
  console.log(`Per day (Mon-Sat): ${perDay.join(', ')}`);

  const marks = [hm(8, 15), hm(10), hm(12), hm(13), hm(14), hm(15), hm(17), hm(18), hm(19), hm(19, 45)];
  const header = marks.map((m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`.padStart(5)).join('');
  const groups: [string, number[]][] = [
    ['Mon-Thu', [0, 1, 2, 3]],
    ['Fri', [4]],
    ['Sat', [5]],
  ];
  console.log(`\nOccupancy by time (average over the days)           ${header}`);
  for (const [label, days] of groups) {
    const rowFor = (name: string, pick: (zs: ZoneSnapshot[]) => ZoneSnapshot[]): void => {
      const cells = marks.map((m) => {
        let held = 0;
        let seats = 0;
        for (const d of days) {
          const zs = pick(at(dayOccupancy, d));
          for (const z of zs) {
            if (m >= z.open && m < z.close) held += z.occupancy[m] ?? 0;
            seats += m >= z.open && m < z.close ? z.capacity : 0;
          }
        }
        return seats === 0 ? '    -' : pct(held / seats).padStart(5);
      });
      console.log(`  ${label.padEnd(8)} ${name.padEnd(12)}${' '.repeat(28)}${cells.join('')}`);
    };
    rowFor('combined', (zs) => zs);
    rowFor('Migpro', (zs) => zs.filter((z) => z.building === 'miguel_pro'));
    rowFor('Gisbert', (zs) => zs.filter((z) => z.building === 'gisbert'));
    if (label === 'Mon-Thu') {
      for (const f of [1, 2, 3, 4]) rowFor(`Gisbert F${f}`, (zs) => zs.filter((z) => z.building === 'gisbert' && z.floor === f));
    }
  }
}

// ----------------------------------------------------------------------- main

interface Args {
  part: number | null;
  reset: boolean;
  dryRun: boolean;
  confirm: boolean;
  seed: number;
  seatMap: string | null;
  skipSeatCheck: boolean;
}

function parseArgs(argv: string[]): Args {
  const value = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    return i >= 0 ? (argv[i + 1] ?? null) : null;
  };
  const part = value('--part');
  return {
    part: part === null ? null : Number(part),
    reset: argv.includes('--reset'),
    dryRun: argv.includes('--dry-run'),
    confirm: argv.includes('--confirm'),
    seed: Number(value('--seed') ?? BASE_SEED),
    seatMap: value('--seat-map'),
    skipSeatCheck: argv.includes('--skip-seat-check'),
  };
}

// The script writes thousands of fake rows, so it only ever targets localhost.
function assertLocalDatabase(): string {
  const raw = process.env['DATABASE_URL'];
  if (!raw) throw new Error('DATABASE_URL is not set.');
  const url = new URL(raw);
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
    throw new Error(`Refusing to run: DATABASE_URL points at "${url.hostname}", not localhost.`);
  }
  return `${url.hostname}:${url.port || '5432'}${url.pathname}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  try {
    process.loadEnvFile();
  } catch {
    // No .env file; rely on the environment.
  }
  const target = assertLocalDatabase();
  console.log(`Target database: ${target}`);

  if (!args.reset && (args.part === null || !(args.part in PARTS))) {
    throw new Error('Pass --part 1, 2 or 3 (or --reset).');
  }
  if (!args.dryRun && !args.confirm) {
    throw new Error('Writes data. Re-run with --confirm to proceed, or --dry-run to preview.');
  }

  // Imported after the environment is loaded so the client sees DATABASE_URL.
  const { prisma } = await import('../src/config/prisma');
  try {
    if (args.reset) {
      const simUsers = { googleId: { startsWith: SIM_PREFIX } };
      const removed = await prisma.reservation.deleteMany({ where: { user: simUsers } });
      const users = await prisma.user.deleteMany({ where: simUsers });
      console.log(`Removed ${removed.count} reservations and ${users.count} users (logs and flags cascade).`);
      return;
    }

    const config = PARTS[args.part as number];
    if (!config) throw new Error('Unknown part.');
    const seats = await prisma.seat.findMany({
      select: { id: true, building: true, floor: true, currentQrToken: true, status: true },
    });
    // Token-level report first, so a count mismatch below is already explained.
    if (args.seatMap) checkSeatMapFile(args.seatMap, seats, args.skipSeatCheck);
    checkSeatCounts(seats, args.skipSeatCheck);

    const [y, mo, d] = config.weekStart;
    const rangeStart = new Date(Date.UTC(y, mo - 1, d) - MANILA_OFFSET_MS); // Monday 00:00 Manila
    const rangeEnd = new Date(rangeStart.getTime() + 7 * DAY_MS);
    const manilaDate = (ms: number): string => new Date(ms + MANILA_OFFSET_MS).toISOString().slice(0, 10);
    if (new Date(rangeStart.getTime() + MANILA_OFFSET_MS).getUTCDay() !== 1) {
      throw new Error(`Part ${args.part} must start on a Monday, got ${manilaDate(rangeStart.getTime())}.`);
    }
    console.log(`Week: ${manilaDate(rangeStart.getTime())} (Mon) to ${manilaDate(rangeStart.getTime() + 5 * DAY_MS)} (Sat)`);

    const zones = buildZones(seats);
    console.log(`Seats in play: ${zones.reduce((n, z) => n + z.seats.length, 0)}`);

    const result = await prisma.$transaction(
      async (tx) => {
        const { pool, newUsers } = await loadPool(tx);
        if (!args.dryRun) {
          const clash = await tx.reservation.count({
            where: { user: { googleId: { startsWith: SIM_PREFIX } }, createdAt: { gte: rangeStart, lt: rangeEnd } },
          });
          if (clash > 0) throw new Error(`Part ${args.part} already exists (${clash} rows). Run --reset first.`);
        }
        const real = await tx.reservation.count({
          where: { user: { googleId: { not: { startsWith: SIM_PREFIX } } }, createdAt: { gte: rangeStart, lt: rangeEnd } },
        });
        if (real > 0) console.warn(`Warning: ${real} non-simulated reservations already fall inside this week.`);

        rand = mulberry32(args.seed + (args.part as number));
        const out: Output = { users: newUsers, reservations: [], occupancyLogs: [], validationEvents: [], seatFlags: [] };
        const counters: Counters = { dropped: 0, spilled: 0, breaks: 0, extensionHistogram: [0, 0, 0], stayMinutes: [] };
        const dayOccupancy: ZoneSnapshot[][] = [];
        for (let day = 0; day < 6; day++) {
          const dayStartMs = rangeStart.getTime() + day * DAY_MS;
          simulateDay(config.profile, pool, zones, day, dayStartMs, config.dayFactors[day] ?? 1, out, counters);
          dayOccupancy.push(
            zones.map((z) => ({
              building: z.building,
              floor: z.floor,
              open: z.open,
              close: z.close,
              capacity: z.seats.length,
              occupancy: z.occupancy.slice(),
            })),
          );
        }

        if (!args.dryRun) {
          console.log('Writing...');
          await insertChunks('users', out.users, (data) => tx.user.createMany({ data }));
          await insertChunks('reservations', out.reservations, (data) => tx.reservation.createMany({ data }));
          await insertChunks('occupancy logs', out.occupancyLogs, (data) => tx.occupancyLog.createMany({ data }));
          await insertChunks('validation events', out.validationEvents, (data) => tx.validationEvent.createMany({ data }));
          await insertChunks('seat flags', out.seatFlags, (data) => tx.seatFlag.createMany({ data }));
        }
        return { out, counters, dayOccupancy };
      },
      { timeout: 10 * 60_000, maxWait: 60_000 },
    );

    printSummary(args.part as number, result.out, result.counters, result.dayOccupancy, rangeStart.getTime());
    console.log(args.dryRun ? '\nDry run: nothing was written.' : '\nDone.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});