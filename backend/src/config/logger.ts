import pino from 'pino';
import { env } from './env';

/**
 * Central logger. Import this everywhere instead of console. the
 * no-console ESLint rule enforces that (console.error is still allowed as a
 * last-resort fallback for failures that happen before this can be used,
 * e.g. env.ts's own validation-failure logging, which runs before this
 * module can even be safely imported).
 */
export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        }
      : undefined,
});
