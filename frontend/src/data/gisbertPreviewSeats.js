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
  floorSeats.push({
    seatId: `preview-gisbert-${floor}-${floorSeats.length + 1}`,
    label: `G${floor}-${seatTypeCodes[seatType]}${String(sequence).padStart(3, '0')}`,
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

// These coordinates are measured from the centers of the green chair shapes in
// the supplied floor-plan SVGs. Green computer counters and lettering are excluded.
const gisbertThirdFloorChairPoints = [
  [318, 101], [371, 101], [423, 101], [476, 101], [577, 101], [525, 102],
  [87, 216], [578, 238], [320, 239], [372, 239], [424, 239], [477, 239],
  [526, 239], [87, 254], [190, 290], [225, 290], [89, 304], [588, 305],
  [520, 310], [440, 320], [264, 329], [380, 330], [157, 331], [89, 338],
  [570, 364], [226, 370], [193, 371], [89, 372], [431, 379], [227, 394],
  [193, 395], [89, 413], [267, 433], [159, 434], [90, 447], [195, 475],
  [230, 475], [90, 480], [331, 483], [431, 483], [535, 485], [630, 485],
  [421, 486], [524, 488], [195, 500], [230, 500], [85, 532], [160, 541],
  [267, 541], [85, 568], [196, 583], [229, 583], [444, 584], [561, 595],
  [368, 597], [196, 609], [229, 609], [86, 628], [267, 649], [161, 651],
  [414, 652], [600, 656], [521, 658], [86, 667], [197, 691], [230, 691],
  [197, 716], [230, 716], [93, 719], [388, 724], [337, 725], [427, 725],
  [475, 725], [510, 726], [586, 726], [556, 727], [635, 727], [94, 755],
  [160, 757], [267, 757], [475, 775], [509, 775], [556, 775], [587, 775],
  [635, 775], [342, 776], [390, 776], [427, 776], [94, 791], [198, 799],
  [229, 799], [612, 834], [364, 835], [464, 835], [524, 835], [553, 835],
  [425, 836], [612, 859], [364, 860], [425, 860], [465, 860], [524, 860],
  [553, 860], [408, 927], [501, 928], [592, 929], [363, 962], [462, 964],
  [517, 964], [557, 964], [609, 967], [415, 970], [400, 992], [457, 992],
  [542, 992], [594, 992], [594, 1033], [400, 1034], [457, 1034], [543, 1034],
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

addSeats(3, 'individual', gisbertThirdFloorChairPoints.slice(0, 76));
addSeats(3, 'table_node', gisbertThirdFloorChairPoints.slice(76));
addSeats(4, 'individual', gisbertFourthFloorChairPoints.slice(0, 92));
addSeats(4, 'table_node', gisbertFourthFloorChairPoints.slice(92, 99));
addSeats(4, 'cubicle', gisbertFourthFloorChairPoints.slice(99));

for (const floor of [3, 4]) {
  seatsByFloor[floor].forEach((seat) => {
    if (seat.seatType === 'table_node') seat.displayAsChair = true;
  });
}

export function getGisbertPreviewSeats(floor) {
  return seatsByFloor[Number(floor)]?.map((seat) => ({ ...seat })) ?? [];
}
