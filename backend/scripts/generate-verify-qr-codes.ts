import 'dotenv/config';
import { mkdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import QRCode from 'qrcode';
import { z } from 'zod';
import { isRetiredSeatToken } from '../src/config/retiredSeats';

// Writes one verify QR per seat to qr-verify-codes/. Each opens
// <frontend>/reverify?token=<seat token>, where a flagged holder proves they
// are still at the seat. It uses the same seat token as the reservation QR
// (generate-seat-qr-codes.ts, which is unaffected by this script), on a
// different page. The output folder is recreated on every run, so images of
// removed or retired seats never linger. Changing the page path or the token
// parameter invalidates every printed label.

const seatMapSchema = z.array(
  z.object({
    building: z.string().min(1),
    floor: z.number().int(),
    currentQrToken: z.string().min(1),
  }),
);

type SeatMapEntry = z.infer<typeof seatMapSchema>[number];

const VERIFY_PATH = '/reverify';
const TOKEN_PARAM = 'token';

const SEAT_MAP_PATH = join(__dirname, '../prisma/seat-map.json');
const OUTPUT_DIR = join(__dirname, '../qr-verify-codes');
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

// CORS_ORIGIN is read directly, not through src/config/env.ts, which would
// demand every unrelated server variable just to draw QR codes.
function loadFrontendOrigin(): URL {
  const raw = process.env['CORS_ORIGIN'];

  if (!raw) {
    throw new Error('CORS_ORIGIN is not set. Check your .env file.');
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`CORS_ORIGIN is not a valid URL: ${raw}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`CORS_ORIGIN must start with http:// or https://: ${raw}`);
  }

  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error(`CORS_ORIGIN must be an origin only, without a path or query: ${raw}`);
  }

  return url;
}

function assertUnique(values: string[], what: string): void {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${what} in seat-map.json: ${value}`);
    }
    seen.add(value);
  }
}

// File-name-safe form of one part of a name. Different inputs can collapse to
// the same output, which is why collisions are checked below.
function safePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]/g, '_');
}

function fileName(seat: SeatMapEntry): string {
  return `verify-${safePart(seat.building)}-floor${seat.floor}-${safePart(seat.currentQrToken)}.png`;
}

// One readable line per problem instead of a raw validation dump.
function parseSeatMap(json: unknown): SeatMapEntry[] {
  const result = seatMapSchema.safeParse(json);

  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  ${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`,
    );
    throw new Error(`seat-map.json is invalid:\n${problems.join('\n')}`);
  }

  return result.data;
}

function loadSeats(): { seats: SeatMapEntry[]; retiredTokens: string[] } {
  const all = parseSeatMap(JSON.parse(readFileSync(SEAT_MAP_PATH, 'utf-8')));

  assertUnique(
    all.map((seat) => seat.currentQrToken),
    'QR token',
  );
  assertUnique(all.map(fileName), 'image file name');

  // A retired seat's QR is rejected by the backend, so never print one.
  const seats = all.filter((seat) => !isRetiredSeatToken(seat.currentQrToken));
  const retiredTokens = all
    .filter((seat) => isRetiredSeatToken(seat.currentQrToken))
    .map((seat) => seat.currentQrToken);

  if (seats.length === 0) {
    throw new Error('seat-map.json has no usable seats.');
  }

  return { seats, retiredTokens };
}

function verifyLink(origin: URL, token: string): string {
  const link = new URL(VERIFY_PATH, origin);
  link.search = `${TOKEN_PARAM}=${encodeURIComponent(token)}`;
  return link.toString();
}

async function writeCodes(seats: SeatMapEntry[], origin: URL): Promise<void> {
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const seat of seats) {
    // Level H error correction (~30%) since these get printed and stuck on
    // furniture, where scratches, dirt and glare are expected.
    await QRCode.toFile(join(OUTPUT_DIR, fileName(seat)), verifyLink(origin, seat.currentQrToken), {
      width: 500,
      margin: 2,
      errorCorrectionLevel: 'H',
    });
  }
}

async function main(): Promise<void> {
  const origin = loadFrontendOrigin();
  const { seats, retiredTokens } = loadSeats();

  await writeCodes(seats, origin);

  console.log(`${seats.length} verify QR images in ${OUTPUT_DIR}`);
  const sample = seats[0];
  if (sample) {
    console.log(`  e.g. ${verifyLink(origin, sample.currentQrToken)}`);
  }

  if (retiredTokens.length > 0) {
    console.log(`Skipped ${retiredTokens.length} retired seat(s): ${retiredTokens.join(', ')}`);
  }

  if (LOCAL_HOSTNAMES.has(origin.hostname)) {
    console.warn(
      `\nWARNING: these codes point at ${origin.origin}, which a phone cannot reach.\n` +
        'Fine for testing; set CORS_ORIGIN to the deployed frontend URL before printing.',
    );
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
