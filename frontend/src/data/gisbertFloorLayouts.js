const rectTable = (cx, cy, width = 56, height = 36) => ({
  type: 'desk',
  x: cx - width / 2,
  y: cy - height / 2,
  width,
  height,
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
  ...rectTables([[395, 745], [485, 745], [575, 745], [665, 745]], 38, 38),
  ...rectTables([[465, 850], [545, 850], [625, 850]], 36, 56),
  ...roundTables([[450, 350], [570, 350], [430, 610], [565, 610], [475, 930], [570, 930], [660, 930]], 24),
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
        room(20, 20, 90, 110, 'STAIRS'),
        room(130, 20, 140, 110, 'RECEPTION'),
        room(20, 130, 34, 120, 'ENTRANCE', { verticalLabel: true }),
        room(20, 345, 180, 175, 'MEETING ROOM'),
        room(200, 345, 92, 175, 'ELECTRONICS\nRESOURCES\nSECTION', { verticalLabel: true, fontSize: 12 }),
        room(900, 20, 80, 150, 'STAIRS'),
        room(805, 20, 82, 28, 'EXIT'),
        room(280, 20, 125, 28, 'COMPUTERS', { fontSize: 14 }),
        bookcase(310, 512, 660, 14, ''),
        bookcase(860, 75, 14, 105, ''),
        bookcase(940, 170, 30, 12, ''),
        bookcase(966, 185, 14, 325, ''),
        bookcase(430, 20, 95, 34, ''),
        bookcase(565, 20, 95, 34, ''),
        bookcase(700, 20, 95, 34, ''),
        couch(315, 150, 105, 116, 'COUCH SET'),
        couch(315, 315, 105, 116, 'COUCH SET'),
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
        room(120, 20, 45, 45, 'DOOR', { fontSize: 12 }),
        room(62, 975, 190, 38, 'STAIRS'),
        bookcase(370, 16, 270, 32, 'BOOKS'),
        bookcase(682, 150, 26, 400, 'BOOKS', { verticalLabel: true }),
        bookcase(645, 570, 26, 120, 'BOOKS', { verticalLabel: true }),
        bookcase(320, 998, 330, 24, 'BOOKS'),
        bookcase(46, 175, 65, 780, ''),
        { type: 'quietZone', x: 190, y: 25, width: 125, height: 170, label: 'IT' },
        couch(365, 140, 64, 88, 'COUCH', { verticalLabel: true }),
        couch(480, 140, 64, 88, 'COUCH', { verticalLabel: true }),
        couch(590, 140, 64, 88, 'COUCH', { verticalLabel: true }),
        { type: 'curve', d: 'M380 350 C405 270, 470 285, 500 340 S615 390, 660 300', strokeWidth: 3 },
        { type: 'curve', d: 'M380 610 C395 705, 470 705, 510 610 S625 540, 665 635', strokeWidth: 3 },
        { type: 'curve', d: 'M28 900 C-10 840, -5 770, 42 720', strokeWidth: 3 },
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
        ...gisbertFourthFloorTables,
      ],
    },
  },
};

export function getFloorLayout(building, floor) {
  return FLOOR_LAYOUTS[building]?.[Number(floor)] ?? null;
}
