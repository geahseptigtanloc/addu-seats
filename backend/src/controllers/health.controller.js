/**
 * Health check controller — confirms Postgres and Redis are reachable.
 */
import prisma from '../config/database.js';
import { testRedisConnection } from '../config/redis.js';

export async function getHealth(_req, res) {
  const result = {
    status: 'ok',
    postgres: 'unknown',
    redis: 'unknown',
    timestamp: new Date().toISOString(),
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    result.postgres = 'connected';
  } catch {
    result.postgres = 'disconnected';
    result.status = 'degraded';
  }

  try {
    const redisOk = await testRedisConnection();
    result.redis = redisOk ? 'connected' : 'disconnected';
    if (!redisOk) result.status = 'degraded';
  } catch {
    result.redis = 'disconnected';
    result.status = 'degraded';
  }

  const statusCode = result.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(result);
}
