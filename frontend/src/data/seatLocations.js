import { getMiguelProPreviewSeats, MIGUEL_PRO_AREAS } from './miguelProMap.js';

const miguelProAreaBySeatLabel = new Map(
  getMiguelProPreviewSeats(1).map((seat) => [seat.label, seat.area]),
);

export function formatBuildingName(building) {
  if (building === 'gisbert') return 'Gisbert Library';
  if (building === 'miguel_pro') return 'Miguel Pro Learning Commons';
  return building
    ? String(building).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Library location unavailable';
}

function getSeatLocation(location = {}) {
  const seatLabel = location.seatLabel || location.seat?.label || location.label;
  const building = location.building || location.seat?.building
    || (/^G\d+-/.test(String(seatLabel || '')) ? 'gisbert' : null)
    || (/^M\d+-/.test(String(seatLabel || '')) ? 'miguel_pro' : null);
  const floor = location.floor || location.seat?.floor;

  if (building === 'miguel_pro') {
    const areaId = location.area || location.seat?.area || miguelProAreaBySeatLabel.get(seatLabel);
    const area = MIGUEL_PRO_AREAS.find((item) => item.id === areaId);
    return { building, floor: Number(floor) || 1, area };
  }

  const labelFloor = /^G(\d+)-/.exec(String(seatLabel || ''))?.[1];
  return { building, floor: Number(floor || labelFloor) || null, area: null };
}

export function formatSeatLocation(location) {
  const { building, floor, area } = getSeatLocation(location);
  const detail = area?.label || (floor ? `Floor ${floor}` : '');
  return [formatBuildingName(building), detail].filter(Boolean).join(' · ');
}

export function getSeatMapPath(location) {
  const { building, floor, area } = getSeatLocation(location);
  if (!building || !floor) return null;
  const path = `/map/${building}/${floor}`;
  return area ? `${path}?area=${area.id}` : path;
}
