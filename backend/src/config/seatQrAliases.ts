import { readFileSync } from 'fs';
import { join } from 'path';

// These printed floor-three QR images were never attached to the old seats.
// Keep their physical tokens usable by assigning each print to one current seat.
// The target token remains the seat's canonical identity for maps and history.
const printedThirdFloorAssignments = [
  ['seat:g3-s001', 'seat:g3-s089'],
  ['seat:g3-s002', 'seat:g3-s090'],
  ['seat:g3-s003', 'seat:g3-s091'],
  ['seat:g3-s004', 'seat:g3-s092'],
  ['seat:g3-s005', 'seat:g3-s093'],
  ['seat:g3-s006', 'seat:g3-s094'],
  ['seat:g3-s026', 'seat:g3-s095'],
  ['seat:g3-s029', 'seat:g3-s096'],
  ['seat:g3-s035', 'seat:g3-s097'],
  ['seat:g3-s036', 'seat:g3-s098'],
  ['seat:g3-s037', 'seat:g3-s099'],
  ['seat:g3-s066', 'seat:g3-s100'],
] as const;

const assignedQrTokens = new Map<string, string>();
const assignedSeats = new Set<string>();

for (const [printedToken, currentToken] of printedThirdFloorAssignments) {
  if (
    !/^seat:g3-s\d{3}$/.test(printedToken) ||
    !/^seat:g3-s\d{3}$/.test(currentToken) ||
    String(printedToken) === currentToken ||
    assignedQrTokens.has(printedToken) ||
    assignedSeats.has(currentToken)
  ) {
    throw new Error(
      `Invalid third-floor printed QR assignment: ${printedToken} -> ${currentToken}`,
    );
  }
  assignedQrTokens.set(printedToken, currentToken);
  assignedSeats.add(currentToken);
}

// Display labels come from the same checked-in seat map used to seed the
// backend. Only the 12 assignments above resolve older printed QR values;
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
}

for (const [printedToken, currentToken] of printedThirdFloorAssignments) {
  if (displayTokenBySeat.get(currentToken) !== printedToken) {
    throw new Error(`Printed QR label does not match current seat: ${printedToken}`);
  }
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
