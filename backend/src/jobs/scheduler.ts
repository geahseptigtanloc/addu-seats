import { logger } from '../config/logger';

export interface ScheduledJob {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
}

interface JobHandle {
  timer: NodeJS.Timeout;
  isRunning: boolean;
}

const handles: JobHandle[] = [];

/**
 * Runs job.run() on a fixed interval, starting immediately rather than
 * waiting for the first interval to elapse. A job's effect should be
 * visible right after startup.
 * Skips a tick if the previous run hasn't finished; one run's error
 * is logged and never stops future scheduled runs.
 */
export function scheduleJob(job: ScheduledJob): void {
  const handle: JobHandle = { isRunning: false, timer: undefined as unknown as NodeJS.Timeout };

  const tick = (): void => {
    if (handle.isRunning) {
      logger.warn({ job: job.name }, 'Skipping tick — previous run still in progress');
      return;
    }

    handle.isRunning = true;
    job
      .run()
      .catch((err: unknown) => {
        logger.error({ err, job: job.name }, 'Background job failed');
      })
      .finally(() => {
        handle.isRunning = false;
      });
  };

  handle.timer = setInterval(tick, job.intervalMs);
  handles.push(handle);
  tick();
}

// Called during graceful shutdown so no dangling interval keeps the
// process alive.
export function stopAllJobs(): void {
  for (const { timer } of handles) {
    clearInterval(timer);
  }
  handles.length = 0;
}
