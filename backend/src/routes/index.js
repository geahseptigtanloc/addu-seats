/**
 * Route aggregator — mounts all API route modules under /api.
 */
import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import seatsRoutes from './seats.js';
import reservationsRoutes from './reservations.js';
import frontdeskRoutes from './frontdesk.routes.js';
import flaggingRoutes from './flagging.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/floors', seatsRoutes);
router.use('/seats', flaggingRoutes);
router.use('/reservations', reservationsRoutes);
router.use('/frontdesk', frontdeskRoutes);

export default router;
