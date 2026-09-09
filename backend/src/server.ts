import 'dotenv/config';
import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectRedis, redisClient } from './config/redis';
import { prisma } from './config/prisma';
import { initSocket, getIO } from './config/socket';
import { scheduleJob, stopAllJobs } from './jobs/scheduler';
import { entryTimerExpiryJob } from './jobs/entryTimerExpiry.job';

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`${signal} received, shutting down gracefully...`);

  const forceExitTimer = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  try {
    stopAllJobs();
    await getIO().close();
    await redisClient.quit();
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  await prisma.$connect();
  await connectRedis();

  const app = createApp();
  const httpServer = createServer(app);

  initSocket(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`);
  });

  scheduleJob(entryTimerExpiryJob);

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});
