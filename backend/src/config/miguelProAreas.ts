// Miguel Pro's area seats are contiguous in the supplied map. Keep these
// ranges aligned with frontend/src/data/miguelProMap.js if the map changes.
export const MIGUEL_PRO_AREA_RANGES = [
  { id: 'main_area', first: 1, last: 168 },
  { id: 'research_nook', first: 169, last: 200 },
  { id: 'workspace_room', first: 201, last: 230 },
] as const;

export type MiguelProArea = (typeof MIGUEL_PRO_AREA_RANGES)[number]['id'];

export function getMiguelProArea(currentQrToken: string): MiguelProArea | null {
  const match = /^seat:m1-s(\d{3})$/i.exec(currentQrToken);
  if (!match) return null;
  const number = Number(match[1]);
  return (
    MIGUEL_PRO_AREA_RANGES.find((area) => number >= area.first && number <= area.last)?.id ?? null
  );
}
