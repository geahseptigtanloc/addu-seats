import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { io } from '../index.js';
import prisma from '../config/database.js';

const router = Router();

// POST /api/seats/:seatId/flag
router.post('/:seatId/flag', requireAuth, async (req, res, next) => {
  try {
    const { seatId } = req.params;
    const userId = req.user.userId;

    const result = await prisma.$transaction(async (tx) => {
      // Find the active reservation for this seat
      const reservation = await tx.reservation.findFirst({
        where: {
          seatId,
          status: 'active'
        },
        include: { seat: true }
      });

      if (!reservation) {
        throw new Error('No active reservation found for this seat');
      }

      if (reservation.userId === userId) {
        throw new Error('You cannot flag your own reservation');
      }

      const updatedReservation = await tx.reservation.update({
        where: { reservationId: reservation.reservationId },
        data: {
          flaggedAt: new Date(),
          flaggedBy: userId,
          validationEvents: {
            create: {
              eventType: 'flagged'
            }
          }
        }
      });

      return { reservation: updatedReservation, seat: reservation.seat };
    }, { maxWait: 15000, timeout: 15000 });

    // Notify the reservation owner via personal room
    io.of('/user').to(`user:${result.reservation.userId}`).emit('seat_flagged', {
      seatId,
      reservationId: result.reservation.reservationId,
      message: "Someone flagged your seat as vacant. Tap to confirm you're still here or it may be released."
    });

    // Broadcast to staff
    io.of('/user').to('staff-room').emit('flag_raised', {
      seatId,
      building: result.seat.building,
      floor: result.seat.floor
    });

    res.json({ message: 'Seat flagged successfully' });
  } catch (error) {
    if (error.message === 'No active reservation found for this seat' || error.message === 'You cannot flag your own reservation') {
      res.status(400).json({ error: error.message });
    } else {
      next(error);
    }
  }
});

export default router;
