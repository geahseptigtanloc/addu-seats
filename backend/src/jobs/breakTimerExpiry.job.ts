import type { ScheduledJob } from './scheduler';
import { expireBreakTimers } from '../services/reservation.service';

export const breakTimerExpiryJob: ScheduledJob = {
  name: 'break-timer-expiry',
  intervalMs: 10_000,
  run: expireBreakTimers,
};
