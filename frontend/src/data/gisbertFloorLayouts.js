import { MIGUEL_PRO_LAYOUT } from './miguelProMap.js';

const rectTable = (cx, cy, width = 56, height = 36, options = {}) => ({
  type: 'desk',
  x: cx - width / 2,
  y: cy - height / 2,
  width,
  height,
  ...options,
});

const rectTables = (points, width = 56, height = 36) =>
  points.map(([x, y]) => rectTable(x, y, width, height));

const roundTables = (points, radius = 24) =>
  points.map(([cx, cy]) => ({ type: 'roundTable', cx, cy, radius }));

const room = (x, y, width, height, label, options = {}) => ({
  type: 'room',
  x,
  y,
  width,
  height,
  label,
  ...options,
});

const bookcase = (x, y, width, height, label, options = {}) => ({
  type: 'bookcase',
  x,
  y,
  width,
  height,
  label,
  ...options,
});

const label = (x, y, text, options = {}) => ({
  type: 'label',
  x,
  y,
  text,
  ...options,
});

const couch = (x, y, width, height, labelText, options = {}) => ({
  type: 'couch',
  x,
  y,
  width,
  height,
  label: labelText,
  ...options,
});

const segmentedCouch = (x, y, width, height, segments, orientation = 'horizontal') => ({
  type: 'segmentedCouch',
  x,
  y,
  width,
  height,
  segments,
  orientation,
});

const gisbertFirstFloorTables = [
  ...rectTables([[520, 185], [585, 185], [650, 185], [715, 185]], 38, 30),
  ...rectTables([[520, 250], [585, 250], [650, 250], [715, 250], [785, 250], [850, 250], [915, 250]], 38, 30),
  ...rectTables([[520, 315], [585, 315], [650, 315], [715, 315], [785, 315], [850, 315], [915, 315]], 38, 30),
  ...rectTables([[520, 380], [585, 380], [650, 380], [715, 380], [785, 380], [850, 380], [915, 380]], 38, 30),
  ...rectTables([[520, 445], [585, 445], [650, 445], [715, 445], [785, 445], [850, 445], [915, 445]], 38, 30),
];

const gisbertSecondFloorTables = [
  ...rectTables([[185, 110], [260, 110], [335, 110], [410, 110]], 44, 34),
  ...rectTables([[165, 185], [230, 185], [295, 185], [360, 185], [425, 185]], 44, 34),
  ...rectTables([[165, 260], [230, 260], [295, 260], [360, 260], [425, 260]], 44, 34),
  ...rectTables([[500, 90], [500, 165], [500, 240]], 58, 36),
  rectTable(330, 405, 54, 88),
  ...rectTables([[425, 405], [500, 405], [425, 480], [500, 480]], 44, 34),
];

const gisbertThirdFloorTables = [
  ...rectTables([[212, 330], [212, 434], [212, 542], [212, 650], [212, 758]], 72, 44),
  ...rectTables([[345, 170], [449, 170], [551, 170]], 24, 86),
  ...rectTables([[348, 486], [443, 486], [538, 486], [633, 486]], 46, 24),
  ...[[365, 750], [450, 750], [535, 750], [610, 750]].map(([x, y]) =>
    rectTable(x, y, 38, 38, { rotation: 45 })),
  ...rectTables([[395, 848], [495, 848], [583, 848]], 34, 52),
  ...roundTables([[402, 345], [535, 345], [424, 650], [560, 650], [405, 965], [500, 965], [590, 965]], 24),
];

const gisbertFourthFloorTables = [
  ...rectTables([[165, 326], [165, 412], [165, 502], [165, 588], [165, 678], [165, 776], [166, 873]], 84, 36),
  ...rectTables([[350, 588], [350, 678], [350, 774], [350, 873]], 84, 36),
  rectTable(303, 321, 48, 42),
  rectTable(435, 392, 52, 38),
  rectTable(565, 321, 48, 40),
  ...roundTables([[470, 340]], 25),
];

export const FLOOR_LAYOUTS = {
  gisbert: {
    1: {
      name: 'Gisbert Library - Floor 1',
      width: 1000,
      height: 560,
      features: [
        room(20, 20, 90, 100, 'STAIRS'),
        room(130, 20, 140, 100, 'RECEPTION'),
        room(20, 120, 34, 130, 'ENTRANCE', { verticalLabel: true }),
        room(20, 280, 120, 80, ''),
        room(20, 360, 180, 180, 'MEETING ROOM'),
        room(200, 360, 72, 180, 'ELECTRONICS\nRESOURCES\nSECTION', { verticalLabel: true, fontSize: 12 }),
        room(888, 20, 92, 150, 'STAIRS'),
        room(785, 20, 76, 28, 'EXIT'),
        room(280, 20, 125, 28, 'COMPUTERS', { fontSize: 14 }),
        bookcase(290, 512, 670, 14, ''),
        bookcase(850, 52, 14, 142, ''),
        bookcase(860, 188, 100, 14, ''),
        bookcase(950, 198, 14, 312, ''),
        bookcase(420, 20, 105, 34, ''),
        bookcase(545, 20, 105, 34, ''),
        bookcase(670, 20, 105, 34, ''),
        segmentedCouch(305, 150, 100, 30, 3),
        segmentedCouch(410, 180, 30, 65, 2, 'vertical'),
        segmentedCouch(305, 245, 100, 30, 3),
        label(355, 215, 'COUCH SET', { fontSize: 12 }),
        segmentedCouch(305, 315, 100, 30, 3),
        segmentedCouch(410, 345, 30, 65, 2, 'vertical'),
        segmentedCouch(305, 410, 100, 30, 3),
        label(355, 380, 'COUCH SET', { fontSize: 12 }),
        ...gisbertFirstFloorTables,
      ],
    },
    2: {
      name: 'Gisbert Library - Floor 2',
      width: 1000,
      height: 560,
      features: [
        room(20, 20, 88, 130, 'STAIRS'),
        room(20, 150, 120, 118, 'RECEPTION', { verticalLabel: true }),
        room(20, 268, 120, 95, 'STAFF\nLOUNGE', { verticalLabel: true }),
        room(20, 382, 98, 158, 'BATHROOM', { verticalLabel: true }),
        room(555, 20, 425, 520, 'BOOKS', { fontSize: 16 }),
        room(112, 20, 95, 24, 'COMPUTERS', { fontSize: 10 }),
        bookcase(125, 382, 20, 158, 'BOOKS', { verticalLabel: true, fontSize: 12 }),
        bookcase(145, 510, 120, 24, 'BOOKS', { fontSize: 12 }),
        bookcase(230, 340, 260, 18, 'BOOKS', { fontSize: 12 }),
        bookcase(544, 210, 10, 118, ''),
        bookcase(220, 42, 300, 14, ''),
        bookcase(544, 55, 10, 110, ''),
        bookcase(544, 365, 10, 165, ''),
        bookcase(300, 528, 235, 12, ''),
        couch(145, 405, 115, 95, 'COUCH SET', { fontSize: 11 }),
        ...gisbertSecondFloorTables,
      ],
    },
    3: {
      name: 'Gisbert Library - Floor 3',
      width: 720,
      height: 1120,
      features: [
        room(28, 20, 70, 42, 'DOOR', { fontSize: 11 }),
        { type: 'quietZone', x: 125, y: 20, width: 145, height: 190, label: 'IT' },
        bookcase(300, 16, 335, 28, 'BOOKS'),
        bookcase(682, 78, 24, 390, 'BOOKS', { verticalLabel: true, fontSize: 11 }),
        bookcase(682, 486, 24, 520, 'BOOKS', { verticalLabel: true, fontSize: 11 }),
        bookcase(292, 1082, 375, 22, 'BOOKS', { fontSize: 11 }),
        room(55, 1072, 180, 32, 'STAIRS', { fontSize: 12 }),
        ...[190, 300, 410, 520, 630, 740, 850].map((y) => bookcase(18, y, 54, 82, '')),
        couch(333, 126, 24, 88, 'COMPS', { verticalLabel: true, fontSize: 9 }),
        couch(437, 126, 24, 88, 'COMPS', { verticalLabel: true, fontSize: 9 }),
        couch(539, 126, 24, 88, 'COMPS', { verticalLabel: true, fontSize: 9 }),
        { type: 'curve', d: 'M345 400 C360 300, 435 278, 480 340 S592 420, 650 320', strokeWidth: 3 },
        { type: 'curve', d: 'M342 580 C346 680, 425 714, 494 645 S610 548, 656 628', strokeWidth: 3 },
        { type: 'curve', d: 'M12 900 C142 914, 142 1030, 12 1058', strokeWidth: 3 },
        { type: 'curve', d: 'M35 924 C108 934, 108 1008, 35 1033', strokeWidth: 2 },
        label(126, 980, 'FRONT DESK', { fontSize: 10, verticalLabel: true }),
        { type: 'chair', x: 78, y: 945, width: 14, height: 18, label: 'Front desk chair' },
        { type: 'chair', x: 78, y: 974, width: 14, height: 18, label: 'Front desk chair' },
        { type: 'chair', x: 78, y: 1003, width: 14, height: 18, label: 'Front desk chair' },
        segmentedCouch(375, 1038, 118, 22, 2),
        segmentedCouch(535, 1038, 118, 22, 2),
        ...gisbertThirdFloorTables,
      ],
    },
    4: {
      name: 'Gisbert Library - Floor 4',
      width: 720,
      height: 1120,
      features: [
        label(360, 48, 'BOOKS', { fontSize: 16 }),
        { type: 'quietZone', x: 14, y: 82, width: 692, height: 112, label: '' },
        bookcase(48, 176, 585, 28, ''),
        bookcase(50, 1068, 470, 22, 'BOOKS', { fontSize: 11 }),
        bookcase(680, 220, 26, 840, 'BOOKS', { verticalLabel: true, fontSize: 11 }),
        ...[286, 416, 546, 676, 806].map((y) => bookcase(18, y, 44, 104, '')),
        room(621, 395, 85, 84, 'STAFF\nDESK', { fontSize: 11 }),
        room(617, 1060, 88, 44, 'DOOR', { fontSize: 11 }),
        couch(405, 255, 118, 42, 'COUCH', { curved: true, fontSize: 10 }),
        { type: 'curve', d: 'M700 610 C605 658, 590 820, 700 882', strokeWidth: 4 },
        { type: 'curve', d: 'M700 635 C630 686, 622 796, 700 854', strokeWidth: 2 },
        label(625, 755, 'FRONT DESK', { fontSize: 10, verticalLabel: true }),
        { type: 'chair', x: 660, y: 752, width: 14, height: 18, label: 'Front desk chair' },
        ...gisbertFourthFloorTables,
      ],
    },
  },
  miguel_pro: {
    1: MIGUEL_PRO_LAYOUT,
  },
};

export function getFloorLayout(building, floor) {
  return FLOOR_LAYOUTS[building]?.[Number(floor)] ?? null;
}

export function getAvailableFloors(building) {
  return Object.keys(FLOOR_LAYOUTS[building] || {}).map(Number).sort((a, b) => a - b);
}
