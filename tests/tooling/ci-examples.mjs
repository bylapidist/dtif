import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import assertSchema from './assert-schema.mjs';
import assertTypeCompat from './assert-type-compat.mjs';
import assertOrdering from './assert-ordering.mjs';
import assertRefs from './assert-refs.mjs';
import codegenCSS from './codegen-css.mjs';
import codegenIOS from './codegen-ios.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.resolve(__dirname, '../../examples');
const snapshotsRoot = path.resolve(__dirname, '../fixtures/snapshots');

let failures = 0;
for (const file of fs.readdirSync(examplesDir)) {
  if (!file.endsWith('.tokens.json')) continue;
  const full = path.join(examplesDir, file);
  const doc = JSON.parse(fs.readFileSync(full, 'utf8'));
  const results = [
    ['schema', assertSchema(doc)],
    ['type-compat', assertTypeCompat(doc)],
    ['ordering', assertOrdering(doc)]
  ];
  for (const [name, res] of results) {
    if (!res.valid) {
      console.error(`${file} ${name} errors:`, res.errors);
      failures++;
    }
  }
  fs.writeFileSync(full, JSON.stringify(doc, null, 2) + '\n');
  console.log(`✔ ${file}`);
}

for (const type of fs.readdirSync(snapshotsRoot)) {
  const codegen = type === 'css' ? codegenCSS : codegenIOS;
  const dirRoot = path.join(snapshotsRoot, type);
  for (const name of fs.readdirSync(dirRoot)) {
    const dir = path.join(dirRoot, name);
    const meta = YAML.parse(fs.readFileSync(path.join(dir, 'meta.yaml'), 'utf8'));
    const input = JSON.parse(fs.readFileSync(path.join(dir, 'input.json'), 'utf8'));
    const refRes = assertRefs(input, { allowRemote: meta.allowRemote });
    const normalized = { ...refRes.resolved };
    delete normalized.$schema;
    fs.writeFileSync(path.join(dir, 'expected.json'), JSON.stringify(normalized, null, 2) + '\n');
    const out = codegen(refRes.resolved);
    const ext = type === 'css' ? 'css' : 'swift';
    fs.writeFileSync(path.join(dir, `expected.${ext}`), out + '\n');
    console.log(`✔ snapshot ${type}/${name}`);
  }
}

if (failures > 0) {
  console.error(`${failures} example(s) failed`);
  process.exit(1);
}
