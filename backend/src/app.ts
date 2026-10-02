import express, { type Application } from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler';
import { env } from './config/env';
import { passport } from './config/passport';
import authRoutes from './routes/auth.routes';
import seatRoutes from './routes/seat.routes';
import reservationRoutes from './routes/reservation.routes';
import analyticsRoutes from './routes/analytics.routes';

export function createApp(): Application {
  const app = express();
  app.set('trust proxy', 1); // Trust the reverse proxy (Render) to set secure cookies

  // `credentials: true` is deliberately not set here. This API is
  // Bearer-JWT-only for ongoing auth, no cross-origin cookies are ever
  // sent or read, so there's nothing for CORS credentials mode to cover.
  // The one place a cookie exists is set during
  // a top-level browser redirect to/from Google, which
  // isn't a fetch/XHR call and isn't subject to CORS.
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());

  // Passport's stateless request-decoration middleware only not
  // passport.session(). This project uses JWT for all ongoing API auth;
  // Passport's persistent-login session mechanism is never used. The
  // express-session middleware itself is still needed, but only for the
  // transient OAuth redirect round-trip
  app.use(passport.initialize());

  app.use('/api/seats', seatRoutes);
  app.use('/api/reservations', reservationRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api', healthRoutes);

  // Keep the unprefixed paths documented by the backend guide available
  // while the browser client continues to use the explicit /api prefix.
  app.use('/seats', seatRoutes);
  app.use('/reservations', reservationRoutes);
  app.use('/analytics', analyticsRoutes);
  app.use('/auth', authRoutes);
  app.use(healthRoutes);

  // Error handling must be mounted last, in this order.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
