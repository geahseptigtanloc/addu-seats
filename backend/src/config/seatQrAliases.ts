import { readFileSync } from 'fs';
import { join } from 'path';

// These 12 physical reservation QRs were printed but remain unattached. Their
// targets come from seat-map.json, which is generated from the same floor plan
// used by the frontend. No QR URL changes when a print moves to another chair.
const printedThirdFloorTokens = new Set([
  'seat:g3-s001',
  'seat:g3-s002',
  'seat:g3-s003',
  'seat:g3-s004',
  'seat:g3-s005',
  'seat:g3-s006',
  'seat:g3-s026',
  'seat:g3-s029',
  'seat:g3-s035',
  'seat:g3-s036',
  'seat:g3-s037',
  'seat:g3-s066',
]);
const assignedQrTokens = new Map<string, string>();
const assignedSeats = new Set<string>();

// Display labels come from the same checked-in seat map used to seed the
// backend. Only the 12 listed printed values resolve to another seat;
// renaming the other chairs must not reactivate retired QR tokens.
const seatMapPath = join(__dirname, '../../prisma/seat-map.json');
const seatMap = JSON.parse(readFileSync(seatMapPath, 'utf-8')) as Array<{
  building: string;
  floor: number;
  currentQrToken: string;
  displayLabel?: string;
}>;
const displayTokenBySeat = new Map<string, string>();
const usedDisplayTokens = new Set<string>();

for (const seat of seatMap) {
  if (seat.building !== 'gisbert' || seat.floor !== 3 || !seat.displayLabel) continue;
  const displayToken = `seat:${seat.displayLabel.toLowerCase()}`;
  if (
    !/^seat:g3-s\d{3}$/.test(displayToken) ||
    displayTokenBySeat.has(seat.currentQrToken) ||
    usedDisplayTokens.has(displayToken)
  ) {
    throw new Error(`Invalid third-floor display label: ${seat.displayLabel}`);
  }
  displayTokenBySeat.set(seat.currentQrToken, displayToken);
  usedDisplayTokens.add(displayToken);
  if (printedThirdFloorTokens.has(displayToken)) {
    if (
      !/^seat:g3-[sc]\d{3}$/.test(seat.currentQrToken) ||
      seat.currentQrToken === displayToken ||
      assignedSeats.has(seat.currentQrToken)
    ) {
      throw new Error(`Invalid third-floor printed QR assignment: ${displayToken}`);
    }
    assignedQrTokens.set(displayToken, seat.currentQrToken);
    assignedSeats.add(seat.currentQrToken);
  }
}

if (assignedQrTokens.size !== printedThirdFloorTokens.size) {
  const missing = [...printedThirdFloorTokens].filter((token) => !assignedQrTokens.has(token));
  throw new Error(`Missing Gisbert third-floor printed QR assignments: ${missing.join(', ')}`);
}

export function resolveSeatQrToken(token: string): string {
  return assignedQrTokens.get(token) ?? token;
}

export function hasAssignedPrintedQr(token: string): boolean {
  return assignedSeats.has(token);
}

export function getDisplayQrToken(currentToken: string): string {
  return displayTokenBySeat.get(currentToken) ?? currentToken;
}
