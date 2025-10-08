import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileSchemaTypes } from './lib/schema-types.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const schemaDir = path.join(repoRoot, 'schema');
const schemaSource = path.join(schemaDir, 'core.json');
const schemaTypesPath = path.join(schemaDir, 'index.d.ts');

async function main() {
  await fs.mkdir(schemaDir, { recursive: true });

  const types = await compileSchemaTypes(schemaSource, {
    cwd: schemaDir
  });

  await fs.writeFile(schemaTypesPath, types);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
