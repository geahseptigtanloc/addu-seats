import type { ScheduledJob } from './scheduler';
import { expireEntryTimers } from '../services/reservation.service';

export const entryTimerExpiryJob: ScheduledJob = {
  name: 'entry-timer-expiry',
  intervalMs: 30_000,
  run: expireEntryTimers,
};
