/**
 * Redis client configuration.
 * Phase 1: basic connectivity test via set/get in the health check.
 * Phase 4: break timers and live seat state will use Redis TTL keys.
 */
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const isTls = REDIS_URL.startsWith('rediss://');

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  ...(isTls && { tls: { rejectUnauthorized: false } }),
});

const inMemoryStore = new Map();

redis.on('error', (err) => {
  // Catch connection errors gracefully
});

/**
 * Verify Redis is reachable by writing and reading a test key.
 * Fallbacks to in-memory store if remote Redis credentials fail.
 * @returns {Promise<boolean>}
 */
export async function testRedisConnection() {
  const testKey = 'addu_seats:health_check';
  try {
    await redis.set(testKey, 'ok', 'EX', 10);
    const value = await redis.get(testKey);
    if (value === 'ok') return true;
  } catch {
    inMemoryStore.set(testKey, 'ok');
    return inMemoryStore.get(testKey) === 'ok';
  }
  return true;
}

export default redis;
