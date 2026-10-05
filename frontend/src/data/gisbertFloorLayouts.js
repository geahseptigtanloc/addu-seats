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
  ...rectTables([[265, 285], [265, 410], [265, 535], [265, 660], [265, 785]], 90, 54),
  ...rectTables([[395, 115], [505, 115], [615, 115], [395, 235], [505, 235], [615, 235]], 38, 42),
  ...rectTables([[388, 465], [443, 465], [498, 465], [553, 465], [608, 465], [663, 465]], 34, 24),
  ...[[380, 745], [470, 745], [560, 745], [650, 745]].map(([x, y]) =>
    rectTable(x, y, 38, 38, { rotation: 45 })),
  ...rectTables([[465, 825], [545, 825], [625, 825]], 36, 56),
  ...roundTables([[450, 350], [570, 350], [430, 610], [565, 610], [440, 915], [535, 915], [625, 915]], 24),
];

const gisbertFourthFloorTables = [
  ...rectTables([[250, 300], [250, 425], [250, 550], [250, 675], [250, 800], [250, 900]], 104, 54),
  ...rectTables([[455, 555], [455, 675], [455, 800], [455, 900]], 108, 54),
  ...rectTables([[400, 290], [515, 360], [610, 285]], 52, 36),
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
      height: 1040,
      features: [
        room(70, 20, 48, 42, 'DOOR', { fontSize: 11 }),
        room(55, 995, 175, 32, 'STAIRS', { fontSize: 12 }),
        bookcase(305, 16, 320, 28, 'BOOKS'),
        bookcase(684, 82, 24, 385, 'BOOKS', { verticalLabel: true }),
        bookcase(684, 485, 24, 490, 'BOOKS', { verticalLabel: true }),
        bookcase(285, 1016, 380, 12, 'BOOKS', { fontSize: 10 }),
        bookcase(18, 135, 62, 96, ''),
        bookcase(18, 246, 62, 96, ''),
        bookcase(18, 357, 62, 96, ''),
        bookcase(18, 468, 62, 96, ''),
        bookcase(18, 579, 62, 96, ''),
        bookcase(18, 690, 62, 96, ''),
        bookcase(18, 801, 62, 65, ''),
        { type: 'quietZone', x: 135, y: 24, width: 135, height: 170, label: 'IT' },
        couch(377, 132, 36, 86, 'COUCH', { verticalLabel: true, fontSize: 10 }),
        couch(487, 132, 36, 86, 'COUCH', { verticalLabel: true, fontSize: 10 }),
        couch(597, 132, 36, 86, 'COUCH', { verticalLabel: true, fontSize: 10 }),
        { type: 'curve', d: 'M355 365 C365 285, 435 270, 480 330 S600 405, 660 310', strokeWidth: 3 },
        { type: 'curve', d: 'M350 565 C350 655, 430 700, 500 630 S615 525, 665 610', strokeWidth: 3 },
        { type: 'curve', d: 'M22 870 C145 885, 145 965, 22 992', strokeWidth: 3 },
        { type: 'curve', d: 'M42 892 C112 900, 112 953, 42 972', strokeWidth: 2 },
        label(142, 930, 'FRONT DESK', { fontSize: 10, verticalLabel: true }),
        { type: 'chair', x: 73, y: 900, width: 14, height: 18, label: 'Front desk chair' },
        { type: 'chair', x: 73, y: 925, width: 14, height: 18, label: 'Front desk chair' },
        { type: 'chair', x: 73, y: 950, width: 14, height: 18, label: 'Front desk chair' },
        segmentedCouch(390, 976, 112, 20, 2),
        segmentedCouch(548, 976, 112, 20, 2),
        ...gisbertThirdFloorTables,
      ],
    },
    4: {
      name: 'Gisbert Library - Floor 4',
      width: 720,
      height: 1040,
      features: [
        label(370, 54, 'BOOKS', { fontSize: 16 }),
        bookcase(120, 168, 500, 28, ''),
        bookcase(70, 985, 470, 22, 'BOOKS', { fontSize: 12 }),
        bookcase(55, 250, 58, 540, ''),
        bookcase(675, 160, 28, 840, ''),
        room(635, 335, 72, 80, 'ADMIN\nDESK', { fontSize: 12 }),
        room(640, 992, 66, 38, 'DOOR'),
        couch(475, 215, 90, 32, 'COUCH', { curved: true, fontSize: 11 }),
        { type: 'quietZone', x: 15, y: 115, width: 690, height: 70, label: '' },
        { type: 'curve', d: 'M650 575 C575 630, 570 760, 650 820', strokeWidth: 4 },
        { type: 'curve', d: 'M667 590 C600 645, 598 750, 667 805', strokeWidth: 2 },
        label(615, 710, 'FRONT DESK', { fontSize: 10 }),
        { type: 'chair', x: 654, y: 705, width: 12, height: 10, label: 'Front desk chair' },
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
