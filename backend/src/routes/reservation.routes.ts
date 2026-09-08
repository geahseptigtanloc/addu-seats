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
router.post('/:id/void', requireAuth, requireRole('ADMIN'), reservationController.voidReservation);
router.post('/:id/break/start', requireAuth, reservationController.startBreak);
router.post('/:id/break/extend', requireAuth, reservationController.extendBreak);
router.post('/break/return', requireAuth, reservationController.returnFromBreak);
router.get('/pending', requireAuth, requireRole('ADMIN'), reservationController.getPendingQueue);

export default router;
