import { PrismaClient } from '@prisma/client';

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

  // Placeholder layout — replace with the real building/floor list once
  // known. QR tokens are fixed strings, not the random default, so
  // they're easy to hardcode when manually testing scan endpoints.
  const seatData = [
    { building: 'Gisbert', floor: 1, currentQrToken: 'seat-1' },
    { building: 'Gisbert', floor: 2, currentQrToken: 'seat-2' },
    { building: 'Gisbert', floor: 3, currentQrToken: 'seat-3' },
    { building: 'Migbro', floor: 1, currentQrToken: 'seat-4' },
  ];

  for (const seat of seatData) {
    await prisma.seat.upsert({
      where: { currentQrToken: seat.currentQrToken },
      update: {},
      create: seat,
    });
  }

  console.log(`Seeded: ${admin.email}, ${student.email}, ${seatData.length} seats`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
