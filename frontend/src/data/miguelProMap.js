export const MIGUEL_PRO_AREAS = [
  { id: 'main_area', label: 'Main Area' },
  { id: 'research_nook', label: 'Research Nook' },
  { id: 'workspace_room', label: 'Workspace Room' },
];

const MAIN_TRANSFORM = { minX: 1350, minY: 250, scale: 0.175, offsetX: 30, offsetY: 40 };
const WORKSPACE_TRANSFORM = { minX: 200, minY: 3850, scale: 0.36, offsetX: 40, offsetY: 30 };
const RIGHT_TABLE_SHIFT_X = 20;

function transformRect([x, y, width, height], transform) {
  return {
    type: 'desk',
    x: Math.round(transform.offsetX + (x - transform.minX) * transform.scale),
    y: Math.round(transform.offsetY + (y - transform.minY) * transform.scale),
    width: Math.max(8, Math.round(width * transform.scale)),
    height: Math.max(8, Math.round(height * transform.scale)),
  };
}

function transformPoint(x, y, transform) {
  return [
    Math.round(transform.offsetX + (x - transform.minX) * transform.scale),
    Math.round(transform.offsetY + (y - transform.minY) * transform.scale),
  ];
}

function centerMainX(x) {
  return Math.round(174 + x * 0.82);
}

function centerMainRect(rect) {
  return { ...rect, x: centerMainX(rect.x) };
}

function shiftRightTableRect(rect) {
  return { ...rect, x: rect.x + RIGHT_TABLE_SHIFT_X };
}

const squareTableSources = [
  [2462.18, 3365.83], [2462.18, 3009.83], [2462.18, 2654.83],
  [2462.18, 2320.83], [2462.18, 1985.83], [2462.18, 1652.83],
  [2946.18, 3041.83], [2946.18, 2685.83], [2946.18, 2330.83],
  [2946.18, 1996.83], [2946.18, 1661.83],
  [3842.18, 3052.83], [3842.18, 2696.83], [3842.18, 2341.83],
  [3842.18, 2007.83], [3842.18, 1672.83],
  [4261.18, 3052.83], [4261.18, 2696.83], [4261.18, 2341.83],
  [4261.18, 2007.83], [4261.18, 1672.83],
  [6073.18, 1625.83], [6073, 2007.83],
  [2008.22, 2172.83], [2008.22, 3000.19],
  [3394.22, 2257.83], [3394.22, 3052.19],
  [1533.18, 2629.83], [1533.18, 2267.83], [1526.18, 1912.83],
];

const mainSquareTables = squareTableSources.map(([x, y]) =>
  centerMainRect(transformRect([x, y, 129.564, 123.713], MAIN_TRANSFORM)));

const mainLongTableDefinitions = [
  { source: [1506, 2948, 184, 661], seats: { left: 6, right: 6 } },
  { source: [4948, 1433, 876, 145], seats: { bottom: 10 } },
  { source: [4926, 1862, 91, 331], seats: { left: 4 } },
  { source: [5143, 1862, 91, 331], seats: { left: 4 } },
  { source: [5358, 1862, 91, 331], seats: { left: 4 } },
  { source: [5575, 1862, 91, 331], seats: { left: 4 } },
  { source: [5794, 1862, 91, 331], seats: { left: 4 } },
].map((definition) => ({
  ...definition,
  table: definition.source[0] === 1506
    ? centerMainRect(transformRect(definition.source, MAIN_TRANSFORM))
    : shiftRightTableRect(transformRect(definition.source, MAIN_TRANSFORM)),
}));

const hubSevenChairTable = {
  table: { type: 'desk', x: 948, y: 78, width: 22, height: 66 },
  seats: { left: 3, right: 3 },
  features: [78, 101, 124].map((y) => ({ type: 'desk', x: 948, y, width: 22, height: 20 })),
};

mainLongTableDefinitions.splice(1, 0, hubSevenChairTable);

const researchNookTableDefinitions = [
  { table: { type: 'desk', x: 78, y: 112, width: 42, height: 96 }, seats: { left: 3, right: 3 } },
  { table: { type: 'desk', x: 230, y: 46, width: 42, height: 126 }, seats: { left: 4, right: 4 } },
  { table: { type: 'desk', x: 412, y: 78, width: 42, height: 96 }, seats: { left: 3, right: 3 } },
  { table: { type: 'desk', x: 574, y: 142, width: 42, height: 96 }, seats: { left: 3, right: 3 } },
  { table: { type: 'desk', x: 405, y: 244, width: 126, height: 42 }, seats: { top: 3, bottom: 3 } },
];

const collabHubs = [
  { id: 'collab_hub_1', label: 'Collab Hub 1', x: 52, y: 278, width: 84, height: 50 },
  { id: 'collab_hub_2', label: 'Collab Hub 2', x: 52, y: 184, width: 84, height: 50 },
  { id: 'collab_hub_3', label: 'Collab Hub 3', x: 186, y: 112, width: 84, height: 50 },
  { id: 'collab_hub_4', label: 'Collab Hub 4', x: 438, y: 112, width: 84, height: 50 },
  { id: 'collab_hub_5', label: 'Collab Hub 5', x: 566, y: 112, width: 84, height: 50 },
  { id: 'collab_hub_6', label: 'Collab Hub 6', x: 694, y: 112, width: 84, height: 50 },
  { id: 'collab_hub_7', label: 'Collab Hub 7', x: 832, y: 112, width: 84, height: 50 },
].map((hub) => ({ type: 'collabHub', ...hub }));

const workspaceTableDefinitions = [347, 712, 1077, 1442, 1807].map((x) => ({
  table: transformRect([x, 3976, 91, 237], WORKSPACE_TRANSFORM),
  seats: { top: 1, bottom: 1, left: 2, right: 2 },
}));

const mainFeatures = [
  ...collabHubs,
  { type: 'desk', x: 305, y: 74, width: 94, height: 60 },
  ...mainSquareTables,
  ...mainLongTableDefinitions.flatMap((definition) => definition.features || [definition.table]),
  centerMainRect(transformRect([2886, 3355, 413, 145], MAIN_TRANSFORM)),
  centerMainRect(transformRect([1987.5, 3344.73, 171, 145], MAIN_TRANSFORM)),
  centerMainRect(transformRect([3345.5, 2618.36, 227, 197], MAIN_TRANSFORM)),
  (() => {
    const [cx, cy] = transformPoint(2073, 2648.36, MAIN_TRANSFORM);
    return { type: 'roundTable', cx: centerMainX(cx), cy, radius: Math.round(131 * MAIN_TRANSFORM.scale) };
  })(),
  { type: 'label', x: 500, y: 638, text: 'MIGUEL PRO MAIN AREA', fontSize: 13 },
];

const researchNookFeatures = [
  { type: 'room', x: 18, y: 14, width: 644, height: 304, label: '' },
  { type: 'label', x: 340, y: 29, text: 'RESEARCH NOOK', fontSize: 13 },
  ...researchNookTableDefinitions.map((definition) => definition.table),
];

const workspaceFeatures = [
  { type: 'room', x: 18, y: 14, width: 721, height: 215, label: '' },
  { type: 'label', x: 378, y: 24, text: 'WORKSPACE ROOM', fontSize: 13 },
  ...workspaceTableDefinitions.map((definition) => definition.table),
];

export const MIGUEL_PRO_AREA_LAYOUTS = {
  main_area: {
    name: 'Miguel Pro Learning Commons - Main Area',
    width: 1000,
    height: 660,
    features: mainFeatures,
  },
  research_nook: {
    name: 'Miguel Pro Learning Commons - Research Nook',
    width: 680,
    height: 336,
    features: researchNookFeatures,
  },
  workspace_room: {
    name: 'Miguel Pro Learning Commons - Workspace Room',
    width: 760,
    height: 250,
    features: workspaceFeatures,
  },
};

export const MIGUEL_PRO_LAYOUT = MIGUEL_PRO_AREA_LAYOUTS.main_area;

const seats = [];
const counters = { individual: 0, table_node: 0 };
const typeCode = { individual: 'S', table_node: 'T' };

function addSeat(area, seatType, posX, posY, extras = {}) {
  counters[seatType] += 1;
  seats.push({
    seatId: `preview-miguel-pro-${area}-${seats.length + 1}`,
    label: `M1-${typeCode[seatType]}${String(counters[seatType]).padStart(3, '0')}`,
    building: 'miguel_pro',
    floor: 1,
    area,
    seatType,
    status: 'available',
    posX: Math.round(posX),
    posY: Math.round(posY),
    ...extras,
  });
}

function spread(center, span, count) {
  if (!count) return [];
  if (count === 1) return [center];
  const start = center - span / 2;
  return Array.from({ length: count }, (_, index) => start + (span * index) / (count - 1));
}

function addIndividualSeats(area, table, options = {}) {
  const { top = 0, bottom = 0, left = 0, right = 0 } = options;
  const cx = table.x + table.width / 2;
  const cy = table.y + table.height / 2;
  const offset = 7;
  spread(cx, table.width * 0.78, top).forEach((x) => addSeat(area, 'individual', x, table.y - offset));
  spread(cx, table.width * 0.78, bottom).forEach((x) => addSeat(area, 'individual', x, table.y + table.height + offset));
  spread(cy, table.height * 0.78, left).forEach((y) => addSeat(area, 'individual', table.x - offset, y));
  spread(cy, table.height * 0.78, right).forEach((y) => addSeat(area, 'individual', table.x + table.width + offset, y));
}

mainLongTableDefinitions.forEach(({ table, seats: seatOptions }) => {
  addIndividualSeats('main_area', table, seatOptions);
});
mainSquareTables.forEach((table) => {
  addIndividualSeats('main_area', table, { top: 1, bottom: 1, left: 1, right: 1 });
});
researchNookTableDefinitions.forEach(({ table, seats: seatOptions }) => {
  addIndividualSeats('research_nook', table, seatOptions);
});
workspaceTableDefinitions.forEach(({ table, seats: seatOptions }) => {
  addIndividualSeats('workspace_room', table, seatOptions);
});

export function getMiguelProAreaLayout(area = 'main_area') {
  return MIGUEL_PRO_AREA_LAYOUTS[area] || MIGUEL_PRO_AREA_LAYOUTS.main_area;
}

export function getMiguelProPreviewSeats(floor, area) {
  if (Number(floor) !== 1) return [];
  const filtered = area ? seats.filter((seat) => seat.area === area) : seats;
  return filtered.map((seat) => ({ ...seat }));
}
