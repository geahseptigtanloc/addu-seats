import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * Single PrismaClient instance, reused for the lifetime of the process.
 *
 * if the code creates a database client with new PrismaClient()
 * sitting at the top of a file, and the dev tool swaps in the
 * updated code without fully restarting the program, the backend can end up
 * creating a second, third, fourth... database client every time a file is saved.
 *
 * ts-node-dev fully restarts the Node process on every file change
 * (confirmed by checking process.pid before and after a reload),
 * rather than reloading code in place. That means this file is
 * only ever evaluated once per running process, so a plain module-level
 * singleton is enough, there's no scenario where multiple PrismaClient
 * instances (and multiple connection pools) could end up coexisting
 * within one process.
 */
export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
