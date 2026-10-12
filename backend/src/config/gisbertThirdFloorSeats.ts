import { readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { prisma } from './prisma';

const seatMapEntrySchema = z.object({
  building: z.string().min(1),
  floor: z.number().int().positive(),
  currentQrToken: z.string().startsWith('seat:'),
});

// Add missing third-floor chairs so the 12 printed QR assignments can point to
// real seats even when the production database has not been seeded again.
// Existing rows keep their status and reservation history.
export async function ensureGisbertThirdFloorSeats(): Promise<number> {
  const seatMapPath = join(__dirname, '../../prisma/seat-map.json');
  const seatMap = z
    .array(seatMapEntrySchema)
    .min(1)
    .parse(JSON.parse(readFileSync(seatMapPath, 'utf-8')))
    .filter((seat) => seat.building === 'gisbert' && seat.floor === 3);
  if (seatMap.length !== 120) {
    throw new Error(`Expected 120 Gisbert third-floor seats, found ${seatMap.length}`);
  }
  const tokens = new Set(seatMap.map((seat) => seat.currentQrToken));
  if (tokens.size !== seatMap.length) {
    throw new Error('Duplicate QR token in the current seat map');
  }

  const result = await prisma.seat.createMany({ data: seatMap, skipDuplicates: true });
  return result.count;
}
