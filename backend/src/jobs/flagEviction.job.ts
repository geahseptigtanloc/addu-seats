import type { ScheduledJob } from './scheduler';
import { evictExpiredFlags } from '../services/reservation.service';

export const flagEvictionJob: ScheduledJob = {
  name: 'flag-eviction',
  intervalMs: 10_000,
  run: evictExpiredFlags,
};
