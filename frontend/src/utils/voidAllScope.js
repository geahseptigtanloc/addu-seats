export const VOID_BUILDINGS = {
  gisbert: { label: 'Gisbert Library', floors: [1, 2, 3, 4] },
  miguel_pro: { label: 'Miguel Pro Learning Commons', floors: [1] },
};

export function buildVoidScope(building, floor) {
  const selectedBuilding = VOID_BUILDINGS[building];
  if (!selectedBuilding) throw new Error('Choose a valid library.');
  if (floor === 'all') return { building, allFloors: true };

  const floorNumber = Number(floor);
  if (!selectedBuilding.floors.includes(floorNumber)) throw new Error('Choose a valid floor.');
  return { building, floor: floorNumber };
}
