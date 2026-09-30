import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import * as seatController from '../controllers/seat.controller';

const router = Router();

// Map browsing is public. Mutations such as ghost-seat reports remain authenticated.
router.get('/', seatController.getSeats);
router.post('/scan', requireAuth, seatController.getScannedSeat);
router.post('/:id/flag', requireAuth, seatController.flagSeat);

export default router;
