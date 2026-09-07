import { z } from 'zod';

/**
 * Every env var the app depends on is declared here and validated once at
 * startup. If anything is missing or malformed, the app fails immediately
 * with a clear message instead of surfacing a confusing error later deep
 * inside a request handler.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET should be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().min(1, 'JWT_EXPIRES_IN cannot be blank').default('5h'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID cannot be blank'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET cannot be blank'),
  GOOGLE_CALLBACK_URL: z.string().url(),
  CORS_ORIGIN: z.string().url(),
});
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
