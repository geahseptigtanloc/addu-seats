import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * ts-node-dev tears down and re-imports modules on every file change, which
 * would normally create a brand new PrismaClient (and a brand new DB
 * connection pool) on every hot-reload. Stashing the instance on `global`
 * survives the module re-evaluation, so dev mode reuses the same client
 * instead of leaking connections. In production there's only ever one
 * module load, so this has no effect beyond ordinary singleton behavior.
 */
declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV === 'development') {
  global.__prisma = prisma;
}
