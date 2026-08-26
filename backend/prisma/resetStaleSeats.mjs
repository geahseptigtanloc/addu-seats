import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const seats = await prisma.seat.findMany({
    where: { status: 'occupied' },
    include: {
      reservations: {
        where: {
          status: { in: ['pending_entry', 'active', 'on_break'] }
        },
        select: { reservationId: true }
      }
    }
  });

  let resetCount = 0;

  for (const seat of seats) {
    if (seat.reservations.length === 0) {
      await prisma.seat.update({
        where: { seatId: seat.seatId },
        data: { status: 'available', currentQrToken: null }
      });
      resetCount += 1;
      console.log('reset', seat.seatId);
    }
  }

  console.log(`Done. Reset ${resetCount} stale occupied seat(s).`);
} finally {
  await prisma.$disconnect();
}
