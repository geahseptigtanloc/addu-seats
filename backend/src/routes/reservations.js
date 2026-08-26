import { Router } from 'express';
import crypto from 'crypto';
import { io } from '../index.js'; // Ensure to export io from index.js
import { requireAuth } from '../middleware/auth.middleware.js';
import prisma from '../config/database.js';

const router = Router();

// GET /api/reservations/me/current
router.get('/me/current', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const reservation = await prisma.reservation.findFirst({
      where: {
        userId,
        status: { in: ['pending_entry', 'active', 'on_break'] }
      },
      orderBy: {
        reservedAt: 'desc'
      },
      include: {
        seat: true
      }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'No active reservation found' });
    }

    res.json({
      reservation,
      qrToken: reservation.seat.currentQrToken
    });
  } catch (error) {
    next(error);
  }
});

const generateQrToken = (seatId, userId) => {
  const timestamp = Date.now();
  const secret = process.env.JWT_SECRET || 'fallback_secret';
  const data = `${seatId}:${userId}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${data}:${hmac}`;
};


// POST /api/reservations
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { seatId } = req.body;
    const userId = req.user.userId;

    // Transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      const seat = await tx.seat.findUnique({ where: { seatId } });
      if (!seat || seat.status !== 'available') {
        throw new Error('Seat is not available');
      }

      const qrToken = generateQrToken(seatId, userId);
      const entryDeadline = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

      const reservation = await tx.reservation.create({
        data: {
          userId,
          seatId,
          status: 'pending_entry',
          entryDeadline
        }
      });

      const updatedSeat = await tx.seat.update({
        where: { seatId },
        data: {
          status: 'pending',
          currentQrToken: qrToken
        }
      });

      return { reservation, updatedSeat };
    }, { maxWait: 15000, timeout: 15000 });

    // Emit socket event
    const { building, floor } = result.updatedSeat;
    io.of(`/floor/${building}-${floor}`).emit('seat_status_update', {
      seatId,
      status: 'pending'
    });

    res.json({
      reservation: result.reservation,
      qrToken: result.updatedSeat.currentQrToken
    });
  } catch (error) {
    if (error.message === 'Seat is not available') {
      res.status(400).json({ error: error.message });
    } else {
      next(error);
    }
  }
});

// DELETE /api/reservations/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const reservationId = req.params.id;
    const userId = req.user.userId;

    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { reservationId },
        include: { seat: true }
      });

      if (!reservation) {
        throw new Error('Reservation not found');
      }

      // Only the reservation owner can cancel
      if (reservation.userId !== userId) {
        throw new Error('Unauthorized');
      }

      if (reservation.status !== 'pending_entry') {
        throw new Error('Cannot cancel reservation in current state');
      }

      const updatedReservation = await tx.reservation.update({
        where: { reservationId },
        data: { status: 'cancelled' }
      });

      const updatedSeat = await tx.seat.update({
        where: { seatId: reservation.seatId },
        data: {
          status: 'available',
          currentQrToken: null
        }
      });

      return { updatedReservation, updatedSeat };
    }, { maxWait: 15000, timeout: 15000 });

    // Emit socket event
    const { building, floor } = result.updatedSeat;
    io.of(`/floor/${building}-${floor}`).emit('seat_status_update', {
      seatId: result.updatedSeat.seatId,
      status: 'available'
    });

    res.json(result.updatedReservation);
  } catch (error) {
    if (error.message === 'Reservation not found') {
      res.status(404).json({ error: error.message });
    } else if (error.message === 'Unauthorized' || error.message === 'Cannot cancel reservation in current state') {
      res.status(400).json({ error: error.message });
    } else {
      next(error);
    }
  }
});

// POST /api/reservations/:id/checkout
router.post('/:id/checkout', requireAuth, async (req, res, next) => {
  try {
    const reservationId = req.params.id;
    const userId = req.user.userId;

    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { reservationId },
        include: { seat: true }
      });

      if (!reservation) {
        throw new Error('Reservation not found');
      }

      if (reservation.userId !== userId) {
        throw new Error('Unauthorized');
      }

      if (!['active', 'on_break'].includes(reservation.status)) {
        throw new Error('Cannot check out from current state');
      }

      const updatedReservation = await tx.reservation.update({
        where: { reservationId },
        data: {
          status: 'completed',
          checkedOutAt: new Date(),
          breakStartedAt: null,
          breakDeadline: null,
          breakMinutesUsed: 0,
          cooldownUntil: null,
          validationEvents: {
            create: { eventType: 'break_returned' }
          }
        }
      });

      const updatedSeat = await tx.seat.update({
        where: { seatId: reservation.seatId },
        data: {
          status: 'available',
          currentQrToken: null
        }
      });

      return { updatedReservation, updatedSeat };
    }, { maxWait: 15000, timeout: 15000 });

    const { building, floor } = result.updatedSeat;
    io.of(`/floor/${building}-${floor}`).emit('seat_status_update', {
      seatId: result.updatedSeat.seatId,
      status: 'available'
    });

    res.json(result.updatedReservation);
  } catch (error) {
    if (error.message === 'Reservation not found') {
      res.status(404).json({ error: error.message });
    } else if (error.message === 'Unauthorized' || error.message === 'Cannot check out from current state') {
      res.status(400).json({ error: error.message });
    } else {
      next(error);
    }
  }
});

// POST /api/reservations/:id/start-break
router.post('/:id/start-break', requireAuth, async (req, res, next) => {
  try {
    const reservationId = req.params.id;
    const userId = req.user.userId;

    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { reservationId },
        include: { seat: true }
      });

      if (!reservation || reservation.userId !== userId) {
        throw new Error('Unauthorized or not found');
      }

      if (reservation.status !== 'active') {
        throw new Error('Can only start break from active reservation');
      }

      if (reservation.cooldownUntil && reservation.cooldownUntil > new Date()) {
        throw new Error('Cannot start break during cooldown period');
      }

      const breakDeadline = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

      const updatedReservation = await tx.reservation.update({
        where: { reservationId },
        data: {
          status: 'on_break',
          breakStartedAt: new Date(),
          breakDeadline,
          validationEvents: {
            create: { eventType: 'break_started' }
          }
        }
      });

      const updatedSeat = await tx.seat.update({
        where: { seatId: reservation.seatId },
        data: { status: 'on_break' }
      });

      return { updatedReservation, updatedSeat };
    }, { maxWait: 15000, timeout: 15000 });

    const { building, floor } = result.updatedSeat;
    io.of(`/floor/${building}-${floor}`).emit('seat_status_update', {
      seatId: result.updatedSeat.seatId,
      status: 'on_break'
    });

    res.json(result.updatedReservation);
  } catch (error) {
    if (error.message.includes('Unauthorized') || error.message.includes('cooldown') || error.message.includes('active')) {
      res.status(400).json({ error: error.message });
    } else {
      next(error);
    }
  }
});

// POST /api/reservations/:id/extend-break
router.post('/:id/extend-break', requireAuth, async (req, res, next) => {
  try {
    const reservationId = req.params.id;
    const userId = req.user.userId;

    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({ where: { reservationId } });

      if (!reservation || reservation.userId !== userId) {
        throw new Error('Unauthorized or not found');
      }

      if (reservation.status !== 'on_break') {
        throw new Error('Reservation is not currently on break');
      }

      if (reservation.breakMinutesUsed + 5 > 15) {
        throw new Error('Maximum break time exceeded');
      }

      const breakDeadline = new Date(reservation.breakDeadline.getTime() + 5 * 60 * 1000);

      const updatedReservation = await tx.reservation.update({
        where: { reservationId },
        data: {
          breakDeadline,
          breakMinutesUsed: reservation.breakMinutesUsed + 5,
          validationEvents: {
            create: { eventType: 'break_extended' }
          }
        }
      });

      return updatedReservation;
    }, { maxWait: 15000, timeout: 15000 });

    res.json(result);
  } catch (error) {
    if (error.message.includes('Unauthorized') || error.message.includes('exceeded') || error.message.includes('not currently on break')) {
      res.status(400).json({ error: error.message });
    } else {
      next(error);
    }
  }
});

// POST /api/reservations/:id/return-from-break
router.post('/:id/return-from-break', requireAuth, async (req, res, next) => {
  try {
    const reservationId = req.params.id;
    const userId = req.user.userId;

    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { reservationId },
        include: { seat: true }
      });

      if (!reservation || reservation.userId !== userId) {
        throw new Error('Unauthorized or not found');
      }

      if (reservation.status !== 'on_break') {
        throw new Error('Reservation is not currently on break');
      }

      // If they hit the 15-minute cap, apply 30-min cooldown
      const minutesUsed = reservation.breakMinutesUsed;
      // Start is 0, extension 1 makes it 5, extension 2 makes it 10. Wait, start is 5 mins implicitly.
      // Actually break_minutes_used only increments on extension. 
      // Spec says: "If break_minutes_used reached 15... sets cooldown"
      // Wait, 5 + 5 + 5 = 15 total time. breakMinutesUsed tracks additions. Let's say reaching 10 addition means 15 total.
      // I'll check if breakMinutesUsed >= 10.
      const cooldownUntil = (minutesUsed >= 10) ? new Date(Date.now() + 30 * 60 * 1000) : null;

      const updatedReservation = await tx.reservation.update({
        where: { reservationId },
        data: {
          status: 'active',
          breakStartedAt: null,
          breakDeadline: null,
          breakMinutesUsed: 0,
          cooldownUntil,
          validationEvents: {
            create: { eventType: 'break_returned' }
          }
        }
      });

      const updatedSeat = await tx.seat.update({
        where: { seatId: reservation.seatId },
        data: { status: 'occupied' }
      });

      return { updatedReservation, updatedSeat };
    }, { maxWait: 15000, timeout: 15000 });

    const { building, floor } = result.updatedSeat;
    io.of(`/floor/${building}-${floor}`).emit('seat_status_update', {
      seatId: result.updatedSeat.seatId,
      status: 'occupied'
    });

    res.json(result.updatedReservation);
  } catch (error) {
    if (error.message.includes('Unauthorized') || error.message.includes('not currently on break')) {
      res.status(400).json({ error: error.message });
    } else {
      next(error);
    }
  }
});

// POST /api/reservations/:id/resolve-flag
router.post('/:id/resolve-flag', requireAuth, async (req, res, next) => {
  try {
    const reservationId = req.params.id;
    const userId = req.user.userId;

    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { reservationId }
      });

      if (!reservation || reservation.userId !== userId) {
        throw new Error('Unauthorized or not found');
      }

      if (!reservation.flaggedAt) {
        throw new Error('Reservation is not flagged');
      }

      const updatedReservation = await tx.reservation.update({
        where: { reservationId },
        data: {
          flaggedAt: null,
          flaggedBy: null,
          validationEvents: {
            create: { eventType: 'flag_resolved' }
          }
        }
      });

      return updatedReservation;
    }, { maxWait: 15000, timeout: 15000 });

    // Notify staff room that flag is resolved
    io.of('/user').to('staff-room').emit('flag_resolved', {
      reservationId
    });

    res.json(result);
  } catch (error) {
    if (error.message.includes('Unauthorized') || error.message.includes('not flagged')) {
      res.status(400).json({ error: error.message });
    } else {
      next(error);
    }
  }
});

export default router;
