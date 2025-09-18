import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assertSchema from './assert-schema.mjs';
import assertTypeCompat from './assert-type-compat.mjs';
import assertOrdering from './assert-ordering.mjs';
import assertMetadata from './assert-metadata.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.resolve(__dirname, '../../examples');

let failures = 0;
for (const file of fs.readdirSync(examplesDir)) {
  if (!file.endsWith('.tokens.json')) continue;
  const doc = JSON.parse(fs.readFileSync(path.join(examplesDir, file), 'utf8'));
  const results = [
    ['schema', assertSchema(doc)],
    ['type-compat', assertTypeCompat(doc)],
    ['ordering', assertOrdering(doc)],
    ['metadata', assertMetadata(doc)]
  ];
  for (const [name, res] of results) {
    if (!res.valid) {
      console.error(`${file} ${name} errors:`, res.errors);
      failures++;
    }
  }
  console.log(`✔ ${file}`);
}
if (failures > 0) {
  console.error(`${failures} example(s) failed`);
  process.exit(1);
}
