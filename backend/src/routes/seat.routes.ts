import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import { requireRole } from '../middlewares/requireRole';
import * as seatController from '../controllers/seat.controller';

const router = Router();

// Map browsing is public. Mutations such as ghost-seat reports remain authenticated.
router.get('/', seatController.getSeats);
router.post('/scan', requireAuth, seatController.getScannedSeat);
router.get(
  '/:id/active-reservation',
  requireAuth,
  requireRole('ADMIN'),
  seatController.getActiveReservation,
);
router.post('/:id/flag', requireAuth, seatController.flagSeat);

export default router;
