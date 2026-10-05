import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import { requireRole } from '../middlewares/requireRole';
import * as reservationController from '../controllers/reservation.controller';

const router = Router();

router.post('/', requireAuth, reservationController.createReservation);
router.post('/:id/cancel', requireAuth, reservationController.cancelReservation);
router.post('/:id/checkout', requireAuth, reservationController.checkoutReservation);
router.post(
  '/:id/approve',
  requireAuth,
  requireRole('ADMIN'),
  reservationController.approveReservation,
);
router.post('/:id/void', requireAuth, requireRole('ADMIN'), reservationController.voidReservation);
router.post(
  '/:id/confirm-ghost',
  requireAuth,
  requireRole('ADMIN'),
  reservationController.confirmGhostSeat,
);
router.post('/:id/break/start', requireAuth, reservationController.startBreak);
router.post('/:id/break/extend', requireAuth, reservationController.extendBreak);
router.post('/break/return', requireAuth, reservationController.returnFromBreak);
router.post('/reverify', requireAuth, reservationController.reverifyPresence);
router.get('/pending', requireAuth, requireRole('ADMIN'), reservationController.getPendingQueue);
router.get(
  '/flagged',
  requireAuth,
  requireRole('ADMIN'),
  reservationController.getFlaggedReservations,
);
router.get('/me/current', requireAuth, reservationController.getCurrentReservation);
router.get('/:id', requireAuth, requireRole('ADMIN'), reservationController.getReservationDetails);

export default router;
