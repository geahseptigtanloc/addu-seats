import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import * as seatController from '../controllers/seat.controller';

const router = Router();

router.get('/', requireAuth, seatController.getSeats);
router.post('/:id/flag', requireAuth, seatController.flagSeat);

export default router;
