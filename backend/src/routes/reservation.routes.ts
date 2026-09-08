import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import * as reservationController from '../controllers/reservation.controller';
import { requireRole } from '../middlewares/requireRole';

const router = Router();

router.post('/', requireAuth, reservationController.createReservation);
router.post('/:id/cancel', requireAuth, reservationController.cancelReservation);
router.post(
  '/:id/approve',
  requireAuth,
  requireRole('ADMIN'),
  reservationController.approveReservation,
);

export default router;
