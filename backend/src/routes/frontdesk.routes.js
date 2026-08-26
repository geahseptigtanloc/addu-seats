import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { io } from '../index.js';
import prisma from '../config/database.js';

const router = Router();

// GET /api/frontdesk/pending
router.get('/pending', requireAuth, requireRole('staff', 'admin'), async (req, res, next) => {
  try {
    const pendingReservations = await prisma.reservation.findMany({
      where: { status: 'pending_entry' },
      include: {
        user: { select: { name: true, adduIdLast4: true } },
        seat: { select: { building: true, floor: true, seatId: true } }
      },
      orderBy: { entryDeadline: 'asc' }
    });
    res.json(pendingReservations);
  } catch (error) {
    next(error);
  }
});

// POST /api/frontdesk/verify/:reservationId
router.post('/verify/:reservationId', requireAuth, requireRole('staff', 'admin'), async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const { approved, rejectionReason } = req.body;
    const adminId = req.user.userId;

    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { reservationId },
        include: { seat: true }
      });

      if (!reservation || reservation.status !== 'pending_entry') {
        throw new Error('Reservation not found or not in pending state');
      }

      let updatedReservation, updatedSeat;

      if (approved) {
        updatedReservation = await tx.reservation.update({
          where: { reservationId },
          data: {
            status: 'active',
            entryDeadline: null,
            verifiedAt: new Date(),
            validationEvents: {
              create: {
                adminId,
                eventType: 'front_desk_approved'
              }
            }
          }
        });

        updatedSeat = await tx.seat.update({
          where: { seatId: reservation.seatId },
          data: { status: 'occupied' }
        });

        io.of('/user').to(`user:${reservation.userId}`).emit('reservation_status_updated', {
          reservationId: reservation.reservationId,
          status: 'active'
        });
      } else {
        updatedReservation = await tx.reservation.update({
          where: { reservationId },
          data: {
            status: 'cancelled',
            entryDeadline: null,
            validationEvents: {
              create: {
                adminId,
                eventType: 'front_desk_rejected',
                note: rejectionReason
              }
            }
          }
        });

        updatedSeat = await tx.seat.update({
          where: { seatId: reservation.seatId },
          data: { status: 'available', currentQrToken: null }
        });

        io.of('/user').to(`user:${reservation.userId}`).emit('reservation_status_updated', {
          reservationId: reservation.reservationId,
          status: 'cancelled'
        });
      }

      return { updatedReservation, updatedSeat };
    }, { maxWait: 15000, timeout: 15000 });

    const { building, floor } = result.updatedSeat;
    io.of(`/floor/${building}-${floor}`).emit('seat_status_update', {
      seatId: result.updatedSeat.seatId,
      status: result.updatedSeat.status
    });

    res.json(result.updatedReservation);
  } catch (error) {
    try {
      const reservationId = req.params.reservationId;
      const failedReservation = await prisma.reservation.findUnique({
        where: { reservationId },
        include: { seat: true }
      });

      if (failedReservation && failedReservation.status === 'pending_entry') {
        await prisma.$transaction(async (tx) => {
          await tx.seat.update({
            where: { seatId: failedReservation.seatId },
            data: { status: 'available', currentQrToken: null }
          });

          await tx.reservation.update({
            where: { reservationId: failedReservation.reservationId },
            data: { status: 'cancelled', entryDeadline: null }
          });
        });
      }
    } catch (recoveryError) {
      console.error('[Frontdesk] Failed to recover stuck pending reservation after verification error:', recoveryError);
    }

    if (error.message === 'Reservation not found or not in pending state') {
      res.status(400).json({ error: error.message });
    } else {
      next(error);
    }
  }
});

// GET /api/frontdesk/lookup/:token
router.get('/lookup/:token', requireAuth, requireRole('staff', 'admin'), async (req, res, next) => {
  try {
    const { token } = req.params;
    
    // token format: seatId:userId:timestamp:hmac
    const parts = token.split(':');
    if (parts.length !== 4) {
      return res.status(400).json({ error: 'Invalid token format' });
    }
    
    const [seatId, userId, timestamp, providedHmac] = parts;
    
    // verify HMAC
    const secret = process.env.JWT_SECRET || 'fallback_secret';
    const data = `${seatId}:${userId}:${timestamp}`;
    const expectedHmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
    
    if (providedHmac !== expectedHmac) {
      return res.status(400).json({ error: 'Invalid token signature' });
    }

    const reservation = await prisma.reservation.findFirst({
      where: {
        seatId,
        userId,
        status: { in: ['pending_entry', 'active'] }
      },
      include: {
        user: { select: { name: true, adduIdLast4: true } },
        seat: { select: { building: true, floor: true } }
      },
      orderBy: { reservedAt: 'desc' }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Matching pending reservation not found' });
    }

    res.json({
      ...reservation,
      alreadyVerified: reservation.status === 'active'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
