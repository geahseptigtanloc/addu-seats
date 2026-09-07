import { createClient } from 'redis';
import { env } from './env';
import { logger } from './logger';

export const redisClient = createClient({
  url: env.REDIS_URL,
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
