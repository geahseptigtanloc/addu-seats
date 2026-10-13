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
const printedTokenBySeat = new Map<string, string>();

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
  printedTokenBySeat.set(currentToken, printedToken);
}

export function resolveSeatQrToken(token: string): string {
  return assignedQrTokens.get(token) ?? token;
}

export function hasAssignedPrintedQr(token: string): boolean {
  return assignedSeats.has(token);
}

export function getDisplayQrToken(currentToken: string): string {
  return printedTokenBySeat.get(currentToken) ?? currentToken;
}
