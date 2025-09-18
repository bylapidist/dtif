import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outRoot = path.resolve(__dirname, '../fuzz/generated');

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seed = Number(process.argv[2] || Date.now());
const rand = mulberry32(seed);

function randomColor() {
  const r = Math.floor(rand() * 255)
    .toString(16)
    .padStart(2, '0');
  const g = Math.floor(rand() * 255)
    .toString(16)
    .padStart(2, '0');
  const b = Math.floor(rand() * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${r}${g}${b}`;
}

const doc = { $schema: 'https://dtif.lapidist.net/schema/core.json' };
for (let i = 0; i < 5; i++) {
  doc[`color${i}`] = { $type: 'color', $value: randomColor() };
}

const outDir = path.join(outRoot, `seed-${seed}`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'input.json'), JSON.stringify(doc, null, 2) + '\n');
