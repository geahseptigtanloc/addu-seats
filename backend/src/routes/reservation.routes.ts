import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import * as reservationController from '../controllers/reservation.controller';

const router = Router();

router.post('/', requireAuth, reservationController.createReservation);
router.post('/:id/cancel', requireAuth, reservationController.cancelReservation);

export default router;
