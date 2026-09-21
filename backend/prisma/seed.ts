import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();

// Fake seed.local emails/googleIds — never real accounts, so they can't
// collide with a real STAFF_EMAILS entry or an actual student's data.
async function main(): Promise<void> {
  const admin = await prisma.user.upsert({
    where: { googleId: 'seed-admin-google-id' },
    update: {},
    create: {
      googleId: 'seed-admin-google-id',
      email: 'admin@seed.local',
      name: 'Seed Admin',
      role: 'ADMIN',
    },
  });

  const student = await prisma.user.upsert({
    where: { googleId: 'seed-student-google-id' },
    update: {},
    create: {
      googleId: 'seed-student-google-id',
      email: 'student@seed.local',
      name: 'Seed Student',
      role: 'STUDENT',
      studentIdLast4: '1234',
    },
  });

  const seatData = JSON.parse(readFileSync(join(__dirname, 'seat-map.json'), 'utf8')) as Array<{
    building: string;
    floor: number;
    currentQrToken: string;
  }>;

  // Remove only the four placeholder records from the original guide seed.
  // Existing real mapped seats and their reservation history are preserved.
  await prisma.seat.deleteMany({
    where: {
      currentQrToken: { in: ['seat-1', 'seat-2', 'seat-3', 'seat-4'] },
      reservations: { none: {} },
    },
  });

  await prisma.seat.createMany({ data: seatData, skipDuplicates: true });

  console.log(`Seeded: ${admin.email}, ${student.email}, ${seatData.length} mapped seats`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
