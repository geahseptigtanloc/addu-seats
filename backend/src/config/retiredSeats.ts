// Keep retired QR tokens blocked even before an existing database receives the retirement migration.
const retiredSeatTokens = new Set(['seat:g3-c020', 'seat:g3-c021', 'seat:g3-c022', 'seat:g4-c030']);

export function isRetiredSeatToken(token: string): boolean {
  return retiredSeatTokens.has(token);
}
