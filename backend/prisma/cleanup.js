/**
 * One-time cleanup script to reset stuck seats and reservations.
 * Run with: node prisma/cleanup.js
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('Starting cleanup...');

  // 1. Find all reservations stuck in pending_entry with expired deadlines
  const stuckReservations = await prisma.reservation.findMany({
    where: {
      status: { in: ['pending', 'pending_entry'] },
    },
    include: { seat: true },
  });

  console.log(`Found ${stuckReservations.length} stuck reservation(s)`);

  for (const res of stuckReservations) {
    await prisma.reservation.update({
      where: { reservationId: res.reservationId },
      data: { status: 'expired' },
    });
    console.log(`  Expired reservation ${res.reservationId}`);
  }

  // 2. Reset all seats that are not 'available' but have no active/pending reservation
  const nonAvailableSeats = await prisma.seat.findMany({
    where: {
      status: { not: 'available' },
    },
    include: {
      reservations: {
        where: {
          status: { in: ['pending_entry', 'active', 'on_break'] },
        },
      },
    },
  });

  let resetCount = 0;
  for (const seat of nonAvailableSeats) {
    if (seat.reservations.length === 0) {
      await prisma.seat.update({
        where: { seatId: seat.seatId },
        data: { status: 'available', currentQrToken: null },
      });
      resetCount++;
      console.log(`  Reset seat ${seat.seatId} (was ${seat.status}) to available`);
    }
  }

  console.log(`\nDone! Expired ${stuckReservations.length} reservation(s), reset ${resetCount} seat(s) to available.`);
  await prisma.$disconnect();
}

cleanup().catch((e) => {
  console.error('Cleanup error:', e);
  process.exit(1);
});
