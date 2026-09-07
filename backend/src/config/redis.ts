import { createClient } from 'redis';
import { env } from './env';
import { logger } from './logger';

export const redisClient = createClient({
  url: env.REDIS_URL,
  socket: {
    // Without a bounded strategy, node-redis retries forever by default
    // which means an unreachable Redis at startup would hang the process
    // indefinitely instead of failing fast like every other startup check
    // in this app. Capping retries makes connectRedis() actually reject
    // after a few seconds so main().catch() can log and exit cleanly.
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        return new Error('Redis: max reconnection attempts reached');
      }
      return Math.min(retries * 200, 2000);
    },
  },
});

redisClient.on('error', (err: unknown) => {
  logger.error({ err }, 'Redis client error');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

/**
 * Call once at startup before the HTTP server starts
 * accepting requests
 */
export async function connectRedis(): Promise<void> {
  await redisClient.connect();
}
