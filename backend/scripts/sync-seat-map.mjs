import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { getGisbertPreviewSeats } from '../../frontend/src/data/gisbertPreviewSeats.js';
import { getMiguelProPreviewSeats } from '../../frontend/src/data/miguelProMap.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, '../prisma/seat-map.json');

const mappedSeats = [
  ...[1, 2, 3, 4].flatMap((floor) => getGisbertPreviewSeats(floor)),
  ...getMiguelProPreviewSeats(1),
];

const labels = new Set(mappedSeats.map((seat) => seat.label));
if (labels.size !== mappedSeats.length) {
  throw new Error('Seat-map labels must be unique before backend seed data can be generated.');
}

const seats = mappedSeats.map((seat) => ({
  building: seat.building,
  floor: seat.floor,
  currentQrToken: `seat:${seat.label.toLowerCase()}`,
}));

writeFileSync(outputPath, `${JSON.stringify(seats, null, 2)}\n`);
process.stdout.write(`Wrote ${seats.length} mapped seats to ${outputPath}\n`);
