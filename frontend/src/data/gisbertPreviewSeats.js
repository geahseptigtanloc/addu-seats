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

const addRoundTable = (floor, cx, cy, { radius = 34, count = 4, type = 'table_node' } = {}) => {
  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    addSeat(
      floor,
      type,
      Math.round(cx + Math.cos(angle) * radius),
      Math.round(cy + Math.sin(angle) * radius),
    );
  }
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
addRow(1, 'cubicle', 335, 522, 5, 44);
addRow(1, 'cubicle', 620, 522, 5, 44);
addRow(1, 'cubicle', 815, 522, 4, 44);
addColumn(1, 'cubicle', 970, 210, 8, 38);
addColumn(1, 'cubicle', 870, 85, 5, 31);
addRow(1, 'cubicle', 895, 175, 4, 32);
addRow(1, 'cubicle', 450, 40, 3, 36);
addRow(1, 'cubicle', 580, 40, 3, 36);
addRow(1, 'cubicle', 710, 40, 3, 36);

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

[285, 410, 535, 660, 785].forEach((y) =>
  addRectTable(3, 265, y, { width: 90, height: 54, top: 3, bottom: 3 }));
[[395, 115], [505, 115], [615, 115], [395, 235], [505, 235], [615, 235]].forEach(([x, y]) =>
  addRectTable(3, x, y, { width: 38, height: 42 }));
[[450, 350], [570, 350], [430, 610], [565, 610], [475, 930], [570, 930], [660, 930]].forEach(([x, y]) =>
  addRoundTable(3, x, y));
[[395, 745], [485, 745], [575, 745], [665, 745]].forEach(([x, y]) =>
  addRectTable(3, x, y, { width: 38, height: 38, type: 'table_node' }));
[[465, 850], [545, 850], [625, 850]].forEach(([x, y]) =>
  addRectTable(3, x, y, { width: 36, height: 56, top: 0, bottom: 0, left: 2, right: 2 }));
addRow(3, 'cubicle', 388, 465, 6, 55);
addColumn(3, 'cubicle', 115, 180, 7, 43);
addColumn(3, 'cubicle', 95, 555, 6, 56);
addSeats(3, 'cubicle', [[95, 880], [95, 915], [95, 950]]);
addRow(3, 'cubicle', 450, 1005, 6, 40);

[300, 425, 550, 675, 800, 900].forEach((y) =>
  addRectTable(4, 250, y, { width: 104, height: 54, top: 3, bottom: 3 }));
[555, 675, 800, 900].forEach((y) =>
  addRectTable(4, 455, y, { width: 108, height: 54, top: 3, bottom: 3 }));
[[400, 290], [515, 360], [610, 285]].forEach(([x, y]) =>
  addRectTable(4, x, y, { width: 52, height: 36 }));
addSeats(4, 'table_node', [[500, 205], [520, 202], [540, 205], [573, 231], [540, 270], [520, 273], [500, 270]]);
addColumn(4, 'cubicle', 105, 295, 7, 46);
addColumn(4, 'cubicle', 95, 650, 6, 46);
addSeats(4, 'cubicle', [[155, 235], [220, 235], [285, 235], [350, 235], [415, 235], [610, 235], [645, 265]]);
addRow(4, 'cubicle', 160, 970, 8, 50);
addSeats(4, 'cubicle', [[660, 290], [660, 710]]);

export function getGisbertPreviewSeats(floor) {
  return seatsByFloor[Number(floor)]?.map((seat) => ({ ...seat })) ?? [];
}
