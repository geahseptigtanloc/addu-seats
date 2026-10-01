import QRCode from 'qrcode';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';

interface SeatMapEntry {
  building: string;
  floor: number;
  currentQrToken: string;
}

const CORS_ORIGIN = process.env.CORS_ORIGIN;

if (!CORS_ORIGIN) {
  throw new Error('CORS_ORIGIN is not set, check your .env file');
}

const SCAN_BASE_URL = `${CORS_ORIGIN}/scan`;

async function main(): Promise<void> {
  const seatMapPath = join(__dirname, '../prisma/seat-map.json');
  const seatMap = JSON.parse(readFileSync(seatMapPath, 'utf-8')) as SeatMapEntry[];

  const outputDir = join(__dirname, '../qr-codes');
  mkdirSync(outputDir, { recursive: true });

  for (const seat of seatMap) {
    const encodedValue = `${SCAN_BASE_URL}?token=${encodeURIComponent(seat.currentQrToken)}`;
    const safeName = seat.currentQrToken.replace(/[^a-zA-Z0-9-]/g, '_');
    const filePath = join(outputDir, `${seat.building}-floor${seat.floor}-${safeName}.png`);

    // High error correction (H, ~30%) since these get printed and stuck
    // on furniture, they'll pick up scratches, dirt, and glare over time.
    await QRCode.toFile(filePath, encodedValue, {
      width: 500,
      margin: 2,
      errorCorrectionLevel: 'H',
    });
    console.log(`Generated: ${filePath}`);
  }

  console.log(`\nDone — ${seatMap.length} QR codes written to ${outputDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
