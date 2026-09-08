import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import * as reservationController from '../controllers/reservation.controller';

const router = Router();

router.post('/', requireAuth, reservationController.createReservation);

export default router;
