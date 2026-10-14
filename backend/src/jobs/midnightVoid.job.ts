import {
  evictExpiredFlags,
  expireBreakTimers,
  expireEntryTimers,
  sweepMidnightReservations,
} from '../services/reservation.service';
import type { ScheduledJob } from './scheduler';

let hasCaughtUp = false;

async function run(): Promise<void> {
  if (!hasCaughtUp) {
    // First run after a start or wake-up: let the expiry jobs settle overdue
    // rows first, so they keep their own outcome (CANCELLED, FORFEITED, EVICTED)
    // instead of becoming midnight voids. A failure here retries next tick.
    await expireEntryTimers();
    await expireBreakTimers();
    await evictExpiredFlags();
    hasCaughtUp = true;
  }

  await sweepMidnightReservations();
}

export const midnightVoidJob: ScheduledJob = {
  name: 'midnight-void',
  intervalMs: 60 * 1000,
  run,
};
