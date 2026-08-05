/**
 * Seed script — inserts 10 test seats across 2 floors of Gisbert Library.
 * Run with: npm run seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_SEATS = [
  // Floor 1 — individual cubicles
  { building: 'gisbert', floor: 1, seatType: 'individual', status: 'available' },
  { building: 'gisbert', floor: 1, seatType: 'individual', status: 'available' },
  { building: 'gisbert', floor: 1, seatType: 'individual', status: 'available' },
  { building: 'gisbert', floor: 1, seatType: 'individual', status: 'disabled' },
  // Floor 1 — collaborative table nodes
  { building: 'gisbert', floor: 1, seatType: 'table_node', status: 'available' },
  { building: 'gisbert', floor: 1, seatType: 'table_node', status: 'available' },
  // Floor 2 — individual cubicles
  { building: 'gisbert', floor: 2, seatType: 'individual', status: 'available' },
  { building: 'gisbert', floor: 2, seatType: 'individual', status: 'available' },
  { building: 'gisbert', floor: 2, seatType: 'individual', status: 'available' },
  // Floor 2 — collaborative table node
  { building: 'gisbert', floor: 2, seatType: 'table_node', status: 'available' },
];

async function main() {
  console.log('Seeding database...');

  // Clear existing seats so re-running seed is idempotent for development
  await prisma.seat.deleteMany();

  for (const seat of TEST_SEATS) {
    await prisma.seat.create({ data: seat });
  }

  const count = await prisma.seat.count();
  console.log(`Seeded ${count} seats in Gisbert Library (floors 1–2).`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
