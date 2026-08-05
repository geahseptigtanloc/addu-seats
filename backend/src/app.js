/**
 * Express application setup — middleware and route mounting.
 * HTTP server creation and Socket.IO live in index.js.
 */
import express from 'express';
import cors from 'cors';
import passport from './config/passport.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());

// Passport initializes the Google OAuth strategy (no server-side sessions in Phase 1)
app.use(passport.initialize());

app.use('/api', apiRoutes);

app.use(errorHandler);

export default app;
