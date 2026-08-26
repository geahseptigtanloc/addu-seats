/**
 * Seed script — inserts 10 test seats across 2 floors of Gisbert Library.
 * Run with: npm run seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_SEATS = [];

// Helper to generate a grid of seats
const generateGrid = (building, floor, startX, startY, rows, cols, gap, type) => {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      TEST_SEATS.push({
        building,
        floor,
        seatType: type,
        status: 'available',
        posX: startX + c * gap,
        posY: startY + r * gap,
      });
    }
  }
};

// Gisbert Floor 1 (15 seats)
generateGrid('gisbert', 1, 100, 100, 3, 4, 100, 'individual'); // 12 individual
generateGrid('gisbert', 1, 600, 100, 3, 1, 150, 'table_node'); // 3 table nodes

// Gisbert Floor 2 (15 seats)
generateGrid('gisbert', 2, 100, 100, 2, 5, 100, 'cubicle'); // 10 cubicles
generateGrid('gisbert', 2, 100, 400, 1, 5, 120, 'individual'); // 5 individual

// Gisbert Floor 3 (10 seats)
generateGrid('gisbert', 3, 200, 200, 2, 5, 100, 'individual');

// Gisbert Floor 4 (5 seats)
generateGrid('gisbert', 4, 300, 300, 1, 5, 120, 'cubicle');

// Miguel Pro Floor 1 (15 seats)
generateGrid('miguel_pro', 1, 150, 150, 3, 5, 90, 'individual'); // 15 individual

// Mark some as disabled/occupied for realism
TEST_SEATS[3].status = 'disabled';
TEST_SEATS[18].status = 'disabled';

async function main() {
  console.log('Seeding database...');

  // Clear existing seats so re-running seed is idempotent for development
  await prisma.validationEvent.deleteMany();
  await prisma.occupancyLog.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.seat.deleteMany();

  // Create mock user for development
  await prisma.user.upsert({
    where: { userId: '11111111-1111-1111-1111-111111111111' },
    update: {},
    create: {
      userId: '11111111-1111-1111-1111-111111111111',
      role: 'student',
      name: 'Mock Student',
      email: 'mock.student@addu.edu.ph',
      adduIdLast4: '1234'
    }
  });

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
