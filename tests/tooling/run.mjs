import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import assertSchema from './assert-schema.mjs';
import assertRoundtrip from './assert-roundtrip.mjs';
import assertTypeCompat from './assert-type-compat.mjs';
import assertOrdering from './assert-ordering.mjs';
import assertRefs from './assert-refs.mjs';
import assertMetadata from './assert-metadata.mjs';
import assertRegistry from './assert-registry.mjs';
import assertRegistryContactHttpsRegression from './assert-registry-contact-https-regression.mjs';
import assertRegistryHttpsRegression from './assert-registry-https-regression.mjs';
import assertRegistrySchemaSyncRegression from './assert-registry-schema-sync-regression.mjs';
import assertPackages from './assert-packages.mjs';
import assertValidatorDefaults from './assert-validator-defaults.mjs';
import codegenCSS from './codegen-css.mjs';
import codegenIOS from './codegen-ios.mjs';
import diffSnapshots from './diff-snapshots.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesRoot = path.resolve(__dirname, '../fixtures');

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const res = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (fs.existsSync(path.join(res, 'input.json'))) {
        yield res;
      }
      yield* walk(res);
    }
  }
}

let failures = 0;
const registryRes = assertRegistry();
if (!registryRes.valid) {
  console.error('registry validation errors:', registryRes.errors);
  failures += registryRes.errors.length || 1;
} else {
  console.log('✔ registry/types.json');
}

const registryContactHttpsRes = assertRegistryContactHttpsRegression();
if (!registryContactHttpsRes.valid) {
  console.error('registry contact regression errors:', registryContactHttpsRes.errors);
  failures += registryContactHttpsRes.errors.length || 1;
} else {
  console.log('✔ registry contact requires https or mailto');
}

const registryHttpsRes = assertRegistryHttpsRegression();
if (!registryHttpsRes.valid) {
  console.error('registry https regression errors:', registryHttpsRes.errors);
  failures += registryHttpsRes.errors.length || 1;
} else {
  console.log('✔ registry spec requires https');
}

const registrySchemaSyncRes = assertRegistrySchemaSyncRegression();
if (!registrySchemaSyncRes.valid) {
  console.error('registry schema sync regression errors:', registrySchemaSyncRes.errors);
  failures += registrySchemaSyncRes.errors.length || 1;
} else {
  console.log('✔ registry schema sync regression');
}

const packagesRes = await assertPackages();
if (!packagesRes.valid) {
  console.error('package validation errors:', packagesRes.errors);
  failures += packagesRes.errors.length || 1;
} else {
  console.log('✔ schema and validator packages');
}

const validatorDefaultsRes = assertValidatorDefaults();
if (!validatorDefaultsRes.valid) {
  console.error('validator default errors:', validatorDefaultsRes.errors);
  failures += validatorDefaultsRes.errors?.length || 1;
} else {
  console.log('✔ validator strict defaults');
}

for (const dir of walk(fixturesRoot)) {
  const meta = YAML.parse(fs.readFileSync(path.join(dir, 'meta.yaml'), 'utf8'));
  const input = JSON.parse(fs.readFileSync(path.join(dir, 'input.json'), 'utf8'));
  const hasError = fs.existsSync(path.join(dir, 'expected.error.json'));

  const schemaRes = assertSchema(input);
  const refRes = assertRefs(input, { allowRemote: meta.allowRemote });
  const roundtripRes = assertRoundtrip(input);
  const typeRes = assertTypeCompat(input);
  const orderingRes = assertOrdering(input);
  const metadataRes = assertMetadata(input);

  const results = [
    ['schema', schemaRes],
    ['refs', refRes],
    ['roundtrip', roundtripRes],
    ['type-compat', typeRes],
    ['ordering', orderingRes],
    ['metadata', metadataRes]
  ];

  const assertions = meta.assertions || [];
  if (assertions.includes('snapshot:css')) {
    const css = codegenCSS(refRes.resolved);
    const expectedCss = fs.readFileSync(path.join(dir, 'expected.css'), 'utf8');
    const snapRes = diffSnapshots(css, expectedCss);
    if (!snapRes.valid) {
      snapRes.errors = [{ code: 'E_SNAPSHOT_MISMATCH', path: '', message: snapRes.diff }];
    }
    results.push(['snapshot:css', snapRes]);
  }

  if (assertions.includes('snapshot:ios')) {
    const swift = codegenIOS(refRes.resolved);
    const expectedSwift = fs.readFileSync(path.join(dir, 'expected.swift'), 'utf8');
    const snapRes = diffSnapshots(swift, expectedSwift);
    if (!snapRes.valid) {
      snapRes.errors = [{ code: 'E_SNAPSHOT_MISMATCH', path: '', message: snapRes.diff }];
    }
    results.push(['snapshot:ios', snapRes]);
  }

  if (hasError) {
    const expectedFile = JSON.parse(fs.readFileSync(path.join(dir, 'expected.error.json'), 'utf8'));
    const expectedRaw = expectedFile.error || expectedFile.message || expectedFile;
    const expectedErr =
      typeof expectedRaw === 'string'
        ? { code: 'E_UNKNOWN', path: '', message: expectedRaw }
        : expectedRaw;
    const actualErrors = results
      .flatMap(([, res]) => res.errors || [])
      .map((e) => (typeof e === 'string' ? { code: 'E_UNKNOWN', path: '', message: e } : e));
    let match;
    if (expectedErr.code === 'E_UNKNOWN' && !expectedErr.path) {
      match = actualErrors.length > 0;
    } else {
      match = actualErrors.find((e) => {
        if (expectedErr.code && e.code !== expectedErr.code) return false;
        if (expectedErr.path && e.path !== expectedErr.path) return false;
        return e.message === expectedErr.message;
      });
    }
    if (!match) {
      console.error(`Expected error not found in ${dir}`);
      failures++;
    }
  } else {
    const expected = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json'), 'utf8'));
    const normalized = { ...refRes.resolved };
    delete normalized.$schema;
    for (const [name, res] of results) {
      if (!res.valid) {
        console.error(`${name} errors in ${dir}:`, res.errors);
        failures++;
      }
    }
    if (JSON.stringify(expected) !== JSON.stringify(normalized)) {
      console.error(`output mismatch in ${dir}`);
      failures++;
    }
  }
  console.log(`✔ ${path.relative(fixturesRoot, dir)}`);
}

if (failures > 0) {
  console.error(`${failures} fixture(s) failed`);
  process.exit(1);
}
