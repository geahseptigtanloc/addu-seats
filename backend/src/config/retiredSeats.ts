// Keep retired QR tokens blocked even before an existing database receives the retirement migration.
const tokenRange = (floor: number, type: string, start: number, end: number): string[] =>
  Array.from(
    { length: end - start + 1 },
    (_, index) => `seat:g${floor}-${type}${String(start + index).padStart(3, '0')}`,
  );

const retiredSeatTokens = new Set([
  ...tokenRange(3, 'c', 1, 28),
  ...tokenRange(4, 'c', 19, 30),
  ...tokenRange(4, 't', 1, 7),
]);

export function isRetiredSeatToken(token: string): boolean {
  return retiredSeatTokens.has(token);
}
