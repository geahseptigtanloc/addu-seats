/**
 * Shared Prisma client singleton.
 * Reuses one connection pool across the app instead of opening a new client per request.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
