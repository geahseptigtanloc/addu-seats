import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import { requireRole } from '../middlewares/requireRole';
import * as analyticsController from '../controllers/analytics.controller';

const router = Router();

router.get('/utilization', requireAuth, requireRole('ADMIN'), analyticsController.getUtilization);
router.get('/peak-hours', requireAuth, requireRole('ADMIN'), analyticsController.getPeakHours);
router.get('/outcomes', requireAuth, requireRole('ADMIN'), analyticsController.getOutcomeBreakdown);
router.get('/no-show-rate', requireAuth, requireRole('ADMIN'), analyticsController.getNoShowRate);
router.get(
  '/session-length',
  requireAuth,
  requireRole('ADMIN'),
  analyticsController.getAverageSessionLength,
);
router.get('/break-stats', requireAuth, requireRole('ADMIN'), analyticsController.getBreakStats);

export default router;
