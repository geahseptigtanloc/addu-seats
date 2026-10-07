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

// Floor 3 is traced from the supplied portrait sketch (1086 x 1448). Keeping
// the sketch coordinates here makes the furniture and seat groups easy to audit.
const thirdFloorX = (x) => Math.round(20 + (x - 86) * 0.75);
const thirdFloorY = (y) => Math.round(20 + (y - 27) * 0.78);
const thirdFloorRect = (x, y, width, height, options = {}) => ({
  type: 'desk',
  x: thirdFloorX(x),
  y: thirdFloorY(y),
  width: Math.round(width * 0.75),
  height: Math.round(height * 0.78),
  ...options,
});
const thirdFloorRound = (x, y, radius) => ({
  type: 'roundTable', cx: thirdFloorX(x), cy: thirdFloorY(y), radius: Math.round(radius * 0.76),
});
const gisbertThirdFloorTables = [
  ...[376, 517, 658, 805, 949].map((y) => thirdFloorRect(291, y, 104, 70)),
  ...[506, 647, 785].flatMap((x) => [
    thirdFloorRect(x, 81, 37, 43),
    thirdFloorRect(x + 3, 267, 37, 42),
    thirdFloorRect(x - 30, 135, 91, 12),
    thirdFloorRect(x - 30, 239, 91, 12),
  ]),
  ...[[616, 432], [807, 410], [608, 794], [815, 822], [589, 1246], [716, 1246], [844, 1246]]
    .map(([x, y]) => thirdFloorRound(x, y, 30)),
  ...[550, 665, 775, 882].map((x) => thirdFloorRect(x - 29, 948, 58, 58, { rotation: 45 })),
  ...[[360, 460], [395, 463], [462, 460], [497, 463], [564, 460], [600, 463]]
    .map(([x, y]) => rectTable(x, y, 18, 20, { fill: '#ffffff', stroke: '#6f7f90', rx: 1 })),
  ...[568, 701, 819].map((x) => thirdFloorRect(x, 1053, 47, 94)),
  thirdFloorRect(559, 1314, 147, 32),
  thirdFloorRect(758, 1314, 132, 32),
];

const gisbertFourthFloorTables = [
  // These edges sit between the green chair rows in the supplied SVG.
  ...[313, 397, 489, 588, 678, 776, 873].map((y) => rectTable(162, y, 108, 45)),
  ...[588, 678, 774, 873].map((y) => rectTable(349, y, 112, 45)),
  rectTable(299, 311, 60, 42),
  rectTable(302, 393, 62, 45),
  rectTable(400, 393, 60, 45),
  rectTable(555, 289, 50, 34),
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
        room(42, 20, 55, 47, 'DOOR', { fontSize: 11 }),
        { type: 'quietZone', x: 119, y: 20, width: 137, height: 205, label: '' },
        bookcase(299, 20, 368, 25, 'BOOKS'),
        bookcase(678, 77, 25, 441, 'BOOKS', { verticalLabel: true, fontSize: 11 }),
        bookcase(681, 535, 21, 491, 'BOOKS', { verticalLabel: true, fontSize: 11 }),
        bookcase(292, 1074, 384, 27, 'BOOKS', { fontSize: 11 }),
        room(95, 1074, 167, 27, 'STAIRS', { fontSize: 12 }),
        ...[[219, 346], [352, 496], [500, 635], [640, 764], [769, 899], [904, 1052]]
          .map(([top, bottom]) => thirdFloorRect(85, top, 69, bottom - top)),
        ...[523, 665, 801].map((x) => label(thirdFloorX(x), thirdFloorY(196), 'COMPS', { verticalLabel: true, fontSize: 11 })),
        { type: 'curve', d: 'M337 370 C340 300 415 249 470 318 S590 410 639 261', strokeWidth: 2 },
        { type: 'curve', d: 'M328 559 C330 660 411 704 475 633 S596 526 651 681', strokeWidth: 2 },
        { type: 'curve', d: 'M327 482 V439 H378 V483 H430 V439 H481 V483 H533 V439 H584 V483 H637 V439', strokeWidth: 2 },
        { type: 'quietZone', x: 307, y: 900, width: 376, height: 31, label: '' },
        { type: 'curve', d: 'M20 858 C140 864 145 1025 20 1055', strokeWidth: 2 },
        { type: 'curve', d: 'M43 884 C107 903 107 1005 43 1024', strokeWidth: 2 },
        ...[1182, 1223, 1264].map((y) => ({
          type: 'chair', x: thirdFloorX(136) - 7, y: thirdFloorY(y) - 6,
          width: 14, height: 12, label: 'Front desk chair',
        })),
        ...gisbertThirdFloorTables,
      ],
    },
    4: {
      name: 'Gisbert Library - Floor 4',
      width: 720,
      height: 1120,
      features: [
        room(10, 67, 686, 169, ''),
        label(360, 124, 'BOOKS', { fontSize: 16 }),
        { type: 'quietZone', x: 10, y: 178, width: 686, height: 57, label: '' },
        ...[[43, 119], [176, 121], [326, 113], [475, 150]]
          .map(([x, width]) => bookcase(x, 236, width, 21, '')),
        ...[[309, 117], [451, 117], [595, 124], [749, 135]]
          .map(([y, height]) => room(10, y, 36, height, '')),
        ...[[426, 25], [568, 27], [719, 30]]
          .map(([y, height]) => ({ type: 'quietZone', x: 10, y, width: 36, height, label: '' })),
        bookcase(657, 289, 39, 124, ''),
        bookcase(676, 539, 20, 405, ''),
        bookcase(21, 974, 388, 26, ''),
        label(258, 1031, 'BOOKS', { fontSize: 16 }),
        room(639, 428, 57, 73, 'STAFF\nDESK', { fontSize: 11 }),
        room(425, 1011, 158, 42, 'DOOR', { fontSize: 11 }),
        { type: 'curve', d: 'M376 310 C394 282 422 267 444 277 C469 287 487 317 482 320 C475 324 461 289 437 287 C410 285 390 323 376 310', strokeWidth: 2 },
        { type: 'curve', d: 'M676 622 C555 632 459 686 459 750 C459 817 552 869 676 881', strokeWidth: 3 },
        { type: 'curve', d: 'M640 662 C550 685 500 722 500 750 C500 791 558 828 640 844', strokeWidth: 2 },
        { type: 'chair', x: 563, y: 735, width: 28, height: 30, label: 'Front desk chair' },
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
