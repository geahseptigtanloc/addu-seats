import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import { requireRole } from '../middlewares/requireRole';
import * as analyticsController from '../controllers/analytics.controller';

const router = Router();

router.get('/utilization', requireAuth, requireRole('ADMIN'), analyticsController.getUtilization);
router.get('/peak-hours', requireAuth, requireRole('ADMIN'), analyticsController.getPeakHours);
router.get('/outcomes', requireAuth, requireRole('ADMIN'), analyticsController.getOutcomeBreakdown);

export default router;
