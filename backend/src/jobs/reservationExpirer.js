import prisma from '../config/database.js';
import { io } from '../index.js';

export const startReservationExpirer = () => {
  console.log('[Jobs] Starting reservation expirer job (every 30 seconds)');
  
  setInterval(async () => {
    try {
      // 1. Pending Entry Expiry
      const expiredPending = await prisma.reservation.findMany({
        where: {
          status: 'pending_entry',
          entryDeadline: { lt: new Date() }
        },
        include: { seat: true }
      });

      for (const reservation of expiredPending) {
        await prisma.$transaction(async (tx) => {
          await tx.reservation.update({
            where: { reservationId: reservation.reservationId },
            data: { status: 'expired' }
          });
          await tx.seat.update({
            where: { seatId: reservation.seatId },
            data: { status: 'available', currentQrToken: null }
          });
        });

        console.log(`[Jobs] Expired pending reservation ${reservation.reservationId}`);
        const { building, floor } = reservation.seat;
        io.of(`/floor/${building}-${floor}`).emit('seat_status_update', {
          seatId: reservation.seatId,
          status: 'available'
        });
      }

      // 2. Break Expiry
      const expiredBreaks = await prisma.reservation.findMany({
        where: {
          status: 'on_break',
          breakDeadline: { lt: new Date() }
        },
        include: { seat: true }
      });

      for (const reservation of expiredBreaks) {
        await prisma.$transaction(async (tx) => {
          await tx.reservation.update({
            where: { reservationId: reservation.reservationId },
            data: { 
              status: 'expired',
              validationEvents: {
                create: { eventType: 'break_expired' }
              }
            }
          });
          await tx.seat.update({
            where: { seatId: reservation.seatId },
            data: { status: 'available', currentQrToken: null }
          });
        });

        console.log(`[Jobs] Expired break for reservation ${reservation.reservationId}`);
        const { building, floor } = reservation.seat;
        io.of(`/floor/${building}-${floor}`).emit('seat_status_update', {
          seatId: reservation.seatId,
          status: 'available'
        });
        io.of('/user').to(`user:${reservation.userId}`).emit('break_expired', {
          message: 'Your break time expired and your seat has been forfeited.'
        });
      }

      // 3. Flag Timeout
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const expiredFlags = await prisma.reservation.findMany({
        where: {
          status: 'active',
          flaggedAt: { lt: tenMinutesAgo }
        },
        include: { seat: true }
      });

      for (const reservation of expiredFlags) {
        await prisma.$transaction(async (tx) => {
          await tx.reservation.update({
            where: { reservationId: reservation.reservationId },
            data: { 
              status: 'expired',
              validationEvents: {
                create: { 
                  eventType: 'flag_resolved',
                  note: 'System auto-resolved: no response within 10 minutes'
                }
              }
            }
          });
          await tx.seat.update({
            where: { seatId: reservation.seatId },
            data: { status: 'available', currentQrToken: null }
          });
        });

        console.log(`[Jobs] Expired flagged reservation ${reservation.reservationId}`);
        const { building, floor } = reservation.seat;
        io.of(`/floor/${building}-${floor}`).emit('seat_status_update', {
          seatId: reservation.seatId,
          status: 'available'
        });
        io.of('/user').to(`user:${reservation.userId}`).emit('flag_expired', {
          message: 'Your seat was flagged as vacant and you did not confirm presence. Seat forfeited.'
        });
        io.of('/user').to('staff-room').emit('flag_resolved', {
          reservationId: reservation.reservationId,
          reason: 'timeout'
        });
      }

    } catch (error) {
      console.error('[Jobs] Error running reservation expirer:', error);
    }
  }, 30 * 1000); // 30 seconds
};
