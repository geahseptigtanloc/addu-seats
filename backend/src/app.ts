import express, { type Application } from 'express';
import healthRoutes from './routes/health.routes';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler';

export function createApp(): Application {
  const app = express();
  app.use(express.json());

  // For later, routes for features go here
  // app.use('/seats', seatRoutes);
  // app.use('/reservations', reservationRoutes);
  // app.use('/auth', authRoutes);
  app.use(healthRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
