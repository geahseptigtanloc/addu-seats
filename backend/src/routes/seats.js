import { Router } from 'express';
import prisma from '../config/database.js';

const router = Router();

// GET /api/floors/:building/:floor/seats
router.get('/:building/:floor/seats', async (req, res, next) => {
  try {
    const { building, floor } = req.params;

    const seats = await prisma.seat.findMany({
      where: {
        building,
        floor: parseInt(floor, 10)
      },
      select: {
        seatId: true,
        seatType: true,
        status: true,
        posX: true,
        posY: true
      }
    });

    res.json(seats);
  } catch (error) {
    next(error);
  }
});

export default router;
