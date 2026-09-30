import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

interface SeatMapEntry {
  building: string;
  floor: number;
  currentQrToken: string;
}

// Real seat layout, provided by the frontend team. Upserted by
// currentQrToken (unique) so re-running this script is safe — an
// existing seat's building/floor gets updated in place rather than
// duplicated.
async function seedSeats(): Promise<void> {
  const seatMapPath = join(__dirname, 'seat-map.json');
  const seatMap = JSON.parse(readFileSync(seatMapPath, 'utf-8')) as SeatMapEntry[];

  for (const seat of seatMap) {
    await prisma.seat.upsert({
      where: { currentQrToken: seat.currentQrToken },
      update: { building: seat.building, floor: seat.floor },
      create: {
        building: seat.building,
        floor: seat.floor,
        currentQrToken: seat.currentQrToken,
      },
    });
  }

  console.log(`Seeded ${seatMap.length} seats from seat-map.json`);
}

async function main(): Promise<void> {
  await seedSeats();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });