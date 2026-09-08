import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import { requireRole } from '../middlewares/requireRole';
import * as reservationController from '../controllers/reservation.controller';

const router = Router();

router.post('/', requireAuth, reservationController.createReservation);
router.post('/:id/cancel', requireAuth, reservationController.cancelReservation);
router.post(
  '/:id/approve',
  requireAuth,
  requireRole('ADMIN'),
  reservationController.approveReservation,
);
// Registered ahead of any future GET /:id route, otherwise Express would
// treat "pending" as an :id value instead of matching this literal path.
router.get('/pending', requireAuth, requireRole('ADMIN'), reservationController.getPendingQueue);

export default router;
