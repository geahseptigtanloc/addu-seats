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
const REVERIFY_BASE_URL = `${CORS_ORIGIN}/reverify`;

const QR_OPTIONS = {
  width: 500,
  margin: 2,
  errorCorrectionLevel: 'H' as const,
};

async function main(): Promise<void> {
  const seatMapPath = join(__dirname, '../prisma/seat-map.json');
  const seatMap = JSON.parse(readFileSync(seatMapPath, 'utf-8')) as SeatMapEntry[];

  const outputDir = join(__dirname, '../qr-codes');
  const reverifyOutputDir = join(outputDir, 'reverify');
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(reverifyOutputDir, { recursive: true });

  for (const seat of seatMap) {
    const reservationUrl = `${SCAN_BASE_URL}?token=${encodeURIComponent(seat.currentQrToken)}`;
    const reverifyUrl = `${REVERIFY_BASE_URL}?token=${encodeURIComponent(seat.currentQrToken)}`;
    const safeName = seat.currentQrToken.replace(/[^a-zA-Z0-9-]/g, '_');
    const fileName = `${seat.building}-floor${seat.floor}-${safeName}.png`;
    const reservationPath = join(outputDir, fileName);
    const reverifyPath = join(reverifyOutputDir, fileName);

    // High error correction (H, ~30%) since these get printed and stuck
    // on furniture, they'll pick up scratches, dirt, and glare over time.
    await Promise.all([
      QRCode.toFile(reservationPath, reservationUrl, QR_OPTIONS),
      QRCode.toFile(reverifyPath, reverifyUrl, QR_OPTIONS),
    ]);
    console.log(`Generated reservation QR: ${reservationPath}`);
    console.log(`Generated verification QR: ${reverifyPath}`);
  }

  console.log(
    `\nDone — ${seatMap.length} reservation and ${seatMap.length} verification QR codes written to ${outputDir}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
