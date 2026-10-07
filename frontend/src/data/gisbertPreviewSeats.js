const seatsByFloor = { 1: [], 2: [], 3: [], 4: [] };
const seatCounters = new Map();

const seatTypeCodes = {
  individual: 'S',
  table_node: 'T',
  cubicle: 'C',
};

const addSeat = (floor, seatType, posX, posY) => {
  const floorSeats = seatsByFloor[floor];
  const counterKey = `${floor}-${seatType}`;
  const sequence = (seatCounters.get(counterKey) || 0) + 1;
  seatCounters.set(counterKey, sequence);
  // Preserve historical QR identity: the revised third-floor geometry gets
  // new labels instead of reassigning old tokens to different physical seats.
  const thirdFloorLabelOffset = { individual: 76, table_node: 44, cubicle: 22 };
  const labelSequence = floor === 3
    ? sequence + thirdFloorLabelOffset[seatType] + (seatType === 'cubicle' && sequence > 15 ? 9 : 0)
    : sequence;
  floorSeats.push({
    seatId: `preview-gisbert-${floor}-${floorSeats.length + 1}`,
    label: `G${floor}-${seatTypeCodes[seatType]}${String(labelSequence).padStart(3, '0')}`,
    building: 'gisbert',
    floor,
    seatType,
    status: 'available',
    posX,
    posY,
  });
};

const addSeats = (floor, seatType, points) => {
  points.forEach(([posX, posY]) => addSeat(floor, seatType, posX, posY));
};

const addRow = (floor, seatType, startX, y, count, gap) => {
  for (let index = 0; index < count; index += 1) {
    addSeat(floor, seatType, startX + index * gap, y);
  }
};

const addColumn = (floor, seatType, x, startY, count, gap) => {
  for (let index = 0; index < count; index += 1) {
    addSeat(floor, seatType, x, startY + index * gap);
  }
};

const spread = (center, span, count) => {
  if (count <= 0) return [];
  if (count === 1) return [center];
  const start = center - span / 2;
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, index) => start + step * index);
};

const addRectTable = (
  floor,
  cx,
  cy,
  { width = 56, height = 36, top = 1, bottom = 1, left = 1, right = 1, type = 'individual' } = {},
) => {
  const offset = 5;
  spread(cx, width * 0.62, top).forEach((x) =>
    addSeat(floor, type, Math.round(x), Math.round(cy - height / 2 - offset)));
  spread(cx, width * 0.62, bottom).forEach((x) =>
    addSeat(floor, type, Math.round(x), Math.round(cy + height / 2 + offset)));
  spread(cy, height * 0.65, left).forEach((y) =>
    addSeat(floor, type, Math.round(cx - width / 2 - offset), Math.round(y)));
  spread(cy, height * 0.65, right).forEach((y) =>
    addSeat(floor, type, Math.round(cx + width / 2 + offset), Math.round(y)));
};

for (const [y, xs] of [
  [185, [520, 585, 650, 715]],
  [250, [520, 585, 650, 715, 785, 850, 915]],
  [315, [520, 585, 650, 715, 785, 850, 915]],
  [380, [520, 585, 650, 715, 785, 850, 915]],
  [445, [520, 585, 650, 715, 785, 850, 915]],
]) {
  xs.forEach((x) => addRectTable(1, x, y, { width: 38, height: 30 }));
}
addSeats(1, 'table_node', [
  [320, 165], [355, 165], [390, 165], [425, 195], [425, 230], [390, 260], [355, 260], [320, 260],
  [320, 330], [355, 330], [390, 330], [425, 360], [425, 395], [390, 425], [355, 425], [320, 425],
]);
addSeats(1, 'cubicle', [
  [330, 522], [370, 522], [435, 522], [475, 522], [515, 522], [555, 522], [620, 522],
  [660, 522], [700, 522], [740, 522], [805, 522], [845, 522], [885, 522], [925, 522],
]);
addColumn(1, 'cubicle', 955, 220, 8, 38);
addColumn(1, 'cubicle', 855, 66, 5, 28);
addRow(1, 'cubicle', 870, 195, 4, 30);
addRow(1, 'cubicle', 440, 40, 3, 36);
addRow(1, 'cubicle', 565, 40, 3, 36);
addRow(1, 'cubicle', 690, 40, 3, 36);

for (const [y, xs] of [
  [110, [185, 260, 335, 410]],
  [185, [165, 230, 295, 360, 425]],
  [260, [165, 230, 295, 360, 425]],
]) {
  xs.forEach((x) => addRectTable(2, x, y, { width: 44, height: 34 }));
}
[90, 165, 240].forEach((y) =>
  addRectTable(2, 500, y, { width: 58, height: 36, top: 2, bottom: 2 }));
addRectTable(2, 330, 405, { width: 54, height: 88, left: 2, right: 2 });
[[425, 405], [500, 405], [425, 480], [500, 480]].forEach(([x, y]) =>
  addRectTable(2, x, y, { width: 44, height: 34 }));
addSeats(2, 'table_node', [
  [150, 398], [180, 398], [210, 398], [240, 428], [240, 465], [210, 492], [180, 492], [150, 492],
]);
addRow(2, 'cubicle', 225, 45, 8, 36);
addColumn(2, 'cubicle', 550, 65, 4, 35);
addColumn(2, 'cubicle', 550, 380, 5, 36);
addRow(2, 'cubicle', 305, 535, 9, 28);

// Trace the chair centers from the supplied 1086 x 1448 third-floor sketch.
// The four chairs around each square table are individually reservable.
const thirdFloorPoint = ([x, y]) => [
  Math.round(20 + (x - 86) * 0.75),
  Math.round(20 + (y - 27) * 0.78),
];
const thirdFloorComputerChairs = [523, 665, 801].flatMap((x) => [
  [x - 37, 103], [x + 37, 103], [x - 37, 289], [x + 37, 289],
]);
const thirdFloorLongTableChairs = [411, 552, 695, 841, 985].flatMap((y) => [
  [315, y - 54], [361, y - 54], [270, y], [417, y],
  [320, y + 55], [365, y + 55],
]);
const thirdFloorRoundTableChairs = [
  [570, 411], [651, 398], [639, 477],
  [760, 383], [851, 377], [826, 457],
  [555, 769], [657, 752], [616, 845],
  [814, 768], [761, 852], [868, 852],
  [607, 1215], [547, 1260], [617, 1270],
  [734, 1216], [681, 1261], [754, 1269],
  [857, 1215], [788, 1260], [880, 1269],
];
const thirdFloorLowerRectangleChairs = [590, 723, 842].flatMap((x) => [
  [x - 42, 1090], [x + 42, 1090], [x - 42, 1124], [x + 42, 1124],
]);
const thirdFloorBenchChairs = [
  [597, 1302], [675, 1302], [597, 1358], [675, 1358],
  [789, 1302], [859, 1302], [789, 1358], [859, 1358],
];
const thirdFloorSquareTableChairs = [550, 665, 775, 882].flatMap((x) => [
  [x - 36, 942], [x + 36, 942], [x - 36, 1011], [x + 36, 1011],
]);
const gisbertThirdFloorIndividualPoints = [
  ...thirdFloorComputerChairs,
  ...thirdFloorLongTableChairs,
  ...thirdFloorRoundTableChairs,
  ...thirdFloorLowerRectangleChairs,
  ...thirdFloorBenchChairs,
].map(thirdFloorPoint);
const gisbertThirdFloorWallCubiclePoints =
  [257, 308, 376, 423, 467, 524, 570, 615, 683, 735, 811, 862, 935, 983, 1033]
    .map((y) => thirdFloorPoint([176, y]));
// The reference has six green chairs beside the zigzag dividers. The six
// outlined boxes between them are equipment/furniture, not seats.
const gisbertThirdFloorZigzagChairPoints = [
  [335, 463], [420, 465], [438, 462], [523, 465], [541, 462], [629, 463],
];

const gisbertFourthFloorChairPoints = [
  [166, 283], [203, 283], [131, 284], [302, 284], [523, 289], [599, 289],
  [230, 311], [99, 313], [262, 316], [345, 316], [66, 334], [165, 347],
  [202, 347], [128, 348], [402, 359], [301, 360], [65, 361], [128, 368],
  [164, 368], [202, 368], [66, 388], [441, 392], [345, 393], [362, 393],
  [262, 394], [99, 401], [230, 403], [66, 415], [402, 425], [302, 427],
  [202, 436], [128, 437], [164, 437], [164, 459], [202, 459], [128, 460],
  [67, 474], [98, 496], [231, 496], [66, 502], [66, 529], [164, 535],
  [204, 535], [127, 536], [127, 551], [164, 551], [204, 551], [314, 552],
  [350, 552], [385, 553], [66, 555], [97, 588], [230, 588], [280, 588],
  [415, 588], [66, 622], [348, 624], [385, 624], [204, 625], [314, 625],
  [128, 626], [164, 626], [314, 642], [349, 642], [385, 642], [127, 643],
  [164, 643], [203, 643], [66, 650], [98, 678], [230, 678], [281, 678],
  [413, 678], [66, 679], [66, 706], [349, 715], [386, 715], [313, 716],
  [128, 717], [164, 717], [202, 717], [313, 737], [349, 737], [386, 737],
  [165, 738], [202, 738], [128, 739], [279, 774], [416, 774], [98, 776],
  [232, 776], [65, 778], [65, 808], [165, 815], [204, 815], [312, 815],
  [349, 815], [387, 815], [128, 816], [388, 835], [128, 836], [165, 836],
  [204, 836], [312, 836], [349, 836], [65, 837], [65, 868], [97, 872],
  [280, 872], [234, 873], [418, 873], [128, 910], [166, 910], [204, 910],
  [348, 910], [387, 910], [310, 911],
];

const gisbertFourthFloorIndividualPoints = [
  [131, 284], [166, 283], [203, 283], [99, 313], [230, 311], [128, 348], [165, 347], [202, 347],
  [128, 368], [164, 368], [202, 368], [99, 401], [230, 403], [128, 437], [164, 437], [202, 436],
  [128, 460], [164, 459], [202, 459], [98, 496], [231, 496], [127, 536], [164, 535], [204, 535],
  [127, 551], [164, 551], [204, 551], [97, 588], [230, 588], [128, 626], [164, 626], [204, 625],
  [127, 643], [164, 643], [203, 643], [98, 678], [230, 678], [128, 717], [164, 717], [202, 717],
  [128, 739], [165, 738], [202, 738], [98, 776], [232, 776], [128, 816], [165, 815], [204, 815],
  [128, 836], [165, 836], [204, 836], [97, 872], [234, 873], [128, 910], [166, 910], [204, 910],
  [314, 552], [350, 552], [385, 553], [280, 588], [415, 588], [314, 625], [348, 624], [385, 624],
  [314, 642], [349, 642], [385, 642], [281, 678], [413, 678], [313, 716], [349, 715], [386, 715],
  [313, 737], [349, 737], [386, 737], [279, 774], [416, 774], [312, 815], [349, 815], [387, 815],
  [312, 836], [349, 836], [388, 835], [280, 872], [418, 873], [310, 911], [348, 910], [387, 910],
  [302, 284], [262, 316], [345, 316], [301, 360],
  // Each green shape beside the smaller upper desks is a chair, not a
  // shared table booking point.
  [523, 289], [599, 289], [402, 359], [441, 392], [345, 393], [362, 393], [402, 425],
];

const pointKey = ([x, y]) => `${x}:${y}`;
const addReferenceFloor = (floor, allPoints, individualPoints, tablePoints) => {
  const individualKeys = new Set(individualPoints.map(pointKey));
  const tableKeys = new Set(tablePoints.map(pointKey));
  addSeats(floor, 'individual', individualPoints);
  addSeats(floor, 'table_node', tablePoints);
  addSeats(
    floor,
    'cubicle',
    allPoints.filter((point) => !individualKeys.has(pointKey(point)) && !tableKeys.has(pointKey(point))),
  );
};

addSeats(3, 'individual', gisbertThirdFloorIndividualPoints);
addSeats(3, 'individual', thirdFloorSquareTableChairs.map(thirdFloorPoint));
seatsByFloor[3].slice(-thirdFloorSquareTableChairs.length).forEach((seat) => {
  seat.squareChair = true;
  seat.hitWidth = 20;
  seat.hitHeight = 20;
});
addSeats(3, 'cubicle', gisbertThirdFloorWallCubiclePoints);
addSeats(3, 'cubicle', gisbertThirdFloorZigzagChairPoints);
seatsByFloor[3].slice(-gisbertThirdFloorZigzagChairPoints.length).forEach((seat) => {
  seat.zigzagChair = true;
  seat.hitWidth = 14;
  seat.hitHeight = 32;
});

addReferenceFloor(
  4,
  gisbertFourthFloorChairPoints,
  gisbertFourthFloorIndividualPoints,
  [],
);

seatsByFloor[4].forEach((seat) => {
  seat.floorFourChair = true;
  seat.hitWidth = 18;
  seat.hitHeight = 18;
});

export function getGisbertPreviewSeats(floor) {
  return seatsByFloor[Number(floor)]?.map((seat) => ({ ...seat })) ?? [];
}
