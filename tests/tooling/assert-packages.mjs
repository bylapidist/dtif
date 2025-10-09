import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';
import { compileSchemaTypes } from '../../scripts/lib/schema-types.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const schemaDir = path.join(repoRoot, 'schema');
const schemaSource = path.join('schema', 'core.json');
const schemaTypesPath = path.join('schema', 'index.d.ts');
const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;

function normalizeSchemaTypes(source) {
  return `${source.trimEnd()}\n`;
}

function readJson(relPath) {
  const fullPath = path.join(repoRoot, relPath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function fileExists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function readFile(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

export default async function assertPackages() {
  const errors = [];

  if (!fileExists(schemaSource)) {
    errors.push({
      code: 'E_SCHEMA_MISSING',
      path: schemaSource,
      message: 'schema/core.json must exist'
    });
  }

  const schemaPackagePath = 'schema/package.json';
  let schemaPkg;
  if (!fileExists(schemaPackagePath)) {
    errors.push({
      code: 'E_SCHEMA_PACKAGE_META_MISSING',
      path: schemaPackagePath,
      message: 'schema/package.json must exist'
    });
  } else {
    schemaPkg = readJson(schemaPackagePath);
    if (schemaPkg.name !== '@lapidist/dtif-schema') {
      errors.push({
        code: 'E_SCHEMA_PACKAGE_NAME',
        path: `${schemaPackagePath}/name`,
        message: 'schema package must be published as @lapidist/dtif-schema'
      });
    }
    if (typeof schemaPkg.version !== 'string' || !semverPattern.test(schemaPkg.version)) {
      errors.push({
        code: 'E_SCHEMA_PACKAGE_VERSION',
        path: `${schemaPackagePath}/version`,
        message: 'schema package must declare a valid semver version'
      });
    }
    const files = Array.isArray(schemaPkg.files) ? schemaPkg.files : [];
    for (const required of ['core.json', 'index.d.ts', 'README.md', 'CHANGELOG.md']) {
      if (!files.includes(required)) {
        errors.push({
          code: 'E_SCHEMA_PACKAGE_FILES',
          path: `${schemaPackagePath}/files`,
          message: `schema package must ship ${required}`
        });
      }
    }
    if (schemaPkg.types !== 'index.d.ts') {
      errors.push({
        code: 'E_SCHEMA_PACKAGE_TYPES_FIELD',
        path: `${schemaPackagePath}/types`,
        message: 'schema package must declare index.d.ts as the type entry'
      });
    }
    const rootExport = schemaPkg.exports?.['.'];
    if (!rootExport) {
      errors.push({
        code: 'E_SCHEMA_PACKAGE_EXPORTS',
        path: `${schemaPackagePath}/exports`,
        message: 'schema package must export ./core.json at the package root'
      });
    } else if (typeof rootExport === 'string') {
      if (rootExport !== './core.json') {
        errors.push({
          code: 'E_SCHEMA_PACKAGE_EXPORTS',
          path: `${schemaPackagePath}/exports`,
          message: 'schema package must export ./core.json at the package root'
        });
      }
    } else {
      if (rootExport.default !== './core.json') {
        errors.push({
          code: 'E_SCHEMA_PACKAGE_EXPORTS_DEFAULT',
          path: `${schemaPackagePath}/exports`,
          message: 'schema package must expose ./core.json as the default export'
        });
      }
      if (rootExport.types !== './index.d.ts') {
        errors.push({
          code: 'E_SCHEMA_PACKAGE_EXPORTS_TYPES',
          path: `${schemaPackagePath}/exports`,
          message: 'schema package must expose ./index.d.ts as the type export'
        });
      }
    }
    if (schemaPkg.exports?.['./index.d.ts'] !== './index.d.ts') {
      errors.push({
        code: 'E_SCHEMA_PACKAGE_EXPORTS_TYPES_PATH',
        path: `${schemaPackagePath}/exports`,
        message: 'schema package must export ./index.d.ts explicitly'
      });
    }
  }

  if (!fileExists('schema/README.md')) {
    errors.push({
      code: 'E_SCHEMA_PACKAGE_README',
      path: 'schema/README.md',
      message: 'schema package must include a README'
    });
  }

  if (!fileExists('schema/CHANGELOG.md')) {
    errors.push({
      code: 'E_SCHEMA_PACKAGE_CHANGELOG',
      path: 'schema/CHANGELOG.md',
      message: 'schema package must document changes in CHANGELOG.md'
    });
  }

  if (!fileExists(schemaTypesPath)) {
    errors.push({
      code: 'E_SCHEMA_TYPES_MISSING',
      path: schemaTypesPath,
      message: 'schema/index.d.ts must exist'
    });
  }

  const validatorEntryPath = 'validator/index.js';
  if (!fileExists(validatorEntryPath)) {
    errors.push({
      code: 'E_VALIDATOR_ENTRY_MISSING',
      path: validatorEntryPath,
      message: 'validator/index.js must exist'
    });
  }

  const validatorPackagePath = 'validator/package.json';
  let validatorPkg;
  if (!fileExists(validatorPackagePath)) {
    errors.push({
      code: 'E_VALIDATOR_PACKAGE_META_MISSING',
      path: validatorPackagePath,
      message: 'validator/package.json must exist'
    });
  } else {
    validatorPkg = readJson(validatorPackagePath);
    if (validatorPkg.name !== '@lapidist/dtif-validator') {
      errors.push({
        code: 'E_VALIDATOR_PACKAGE_NAME',
        path: `${validatorPackagePath}/name`,
        message: 'validator package must be published as @lapidist/dtif-validator'
      });
    }
    if (validatorPkg.main !== 'index.js') {
      errors.push({
        code: 'E_VALIDATOR_PACKAGE_MAIN',
        path: `${validatorPackagePath}/main`,
        message: 'validator package must expose index.js as the entry point'
      });
    }
    if (validatorPkg.exports?.['.'] !== './index.js') {
      errors.push({
        code: 'E_VALIDATOR_PACKAGE_EXPORTS',
        path: `${validatorPackagePath}/exports`,
        message: 'validator package must export ./index.js at the package root'
      });
    }
    if (typeof validatorPkg.version !== 'string' || !semverPattern.test(validatorPkg.version)) {
      errors.push({
        code: 'E_VALIDATOR_PACKAGE_VERSION',
        path: `${validatorPackagePath}/version`,
        message: 'validator package must declare a valid semver version'
      });
    }
    if (validatorPkg.types !== 'index.d.ts') {
      errors.push({
        code: 'E_VALIDATOR_PACKAGE_TYPES_FIELD',
        path: `${validatorPackagePath}/types`,
        message: 'validator package must declare index.d.ts as the type entry'
      });
    }
    const files = Array.isArray(validatorPkg.files) ? validatorPkg.files : [];
    for (const required of ['index.d.ts', 'index.js', 'README.md', 'CHANGELOG.md']) {
      if (!files.includes(required)) {
        errors.push({
          code: 'E_VALIDATOR_PACKAGE_FILES',
          path: `${validatorPackagePath}/files`,
          message: `validator package must ship ${required}`
        });
      }
    }
    const deps = validatorPkg.dependencies || {};
    if (!deps['@lapidist/dtif-schema']) {
      errors.push({
        code: 'E_VALIDATOR_PACKAGE_SCHEMA_DEP',
        path: `${validatorPackagePath}/dependencies`,
        message: 'validator package must depend on @lapidist/dtif-schema'
      });
    }
    if (!deps.ajv) {
      errors.push({
        code: 'E_VALIDATOR_PACKAGE_AJV_DEP',
        path: `${validatorPackagePath}/dependencies`,
        message: 'validator package must depend on ajv'
      });
    }
    if (!deps['ajv-formats']) {
      errors.push({
        code: 'E_VALIDATOR_PACKAGE_AJV_FORMATS_DEP',
        path: `${validatorPackagePath}/dependencies`,
        message: 'validator package must depend on ajv-formats'
      });
    }
  }

  if (!fileExists('validator/README.md')) {
    errors.push({
      code: 'E_VALIDATOR_PACKAGE_README',
      path: 'validator/README.md',
      message: 'validator package must include a README'
    });
  }

  if (!fileExists('validator/CHANGELOG.md')) {
    errors.push({
      code: 'E_VALIDATOR_PACKAGE_CHANGELOG',
      path: 'validator/CHANGELOG.md',
      message: 'validator package must document changes in CHANGELOG.md'
    });
  }

  if (fileExists(validatorEntryPath)) {
    const contents = readFile(validatorEntryPath);
    if (!contents.includes('@lapidist/dtif-schema')) {
      errors.push({
        code: 'E_VALIDATOR_PACKAGE_IMPORT_SCHEMA',
        path: validatorEntryPath,
        message: 'validator entry must import the published schema package'
      });
    }
  }

  if (fileExists(schemaSource) && fileExists(schemaTypesPath)) {
    try {
      const schemaFullPath = path.join(repoRoot, schemaSource);
      const expected = await compileSchemaTypes(schemaFullPath, {
        cwd: schemaDir
      });
      const normalizedActual = normalizeSchemaTypes(readFile(schemaTypesPath));
      if (normalizedActual !== expected) {
        errors.push({
          code: 'E_SCHEMA_TYPES_OUT_OF_DATE',
          path: schemaTypesPath,
          message: 'schema/index.d.ts must be regenerated from schema/core.json'
        });
      }
    } catch (error) {
      errors.push({
        code: 'E_SCHEMA_TYPES_GENERATE_FAILED',
        path: schemaTypesPath,
        message: `failed to generate types from schema: ${error.message}`
      });
    }
  }

  if (fileExists(schemaTypesPath)) {
    const schemaTypesFullPath = path.join(repoRoot, schemaTypesPath);
    const program = ts.createProgram([schemaTypesFullPath], {
      strict: true,
      skipLibCheck: false,
      exactOptionalPropertyTypes: true,
      noEmit: true
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    const normalizedSchemaPath = path.normalize(schemaTypesFullPath);
    for (const diagnostic of diagnostics) {
      if (diagnostic.file) {
        const fileName = path.normalize(diagnostic.file.fileName);
        if (fileName !== normalizedSchemaPath) {
          continue;
        }
      } else if (diagnostic.category !== ts.DiagnosticCategory.Error) {
        continue;
      }
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      let diagnosticPath = schemaTypesPath;
      if (diagnostic.file && typeof diagnostic.start === 'number') {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        diagnosticPath = `${schemaTypesPath}:${line + 1}:${character + 1}`;
      }
      errors.push({
        code: 'E_SCHEMA_TYPES_TSC',
        path: diagnosticPath,
        message
      });
    }
  }

  const parserPackagePath = 'parser/package.json';
  let parserPkg;
  if (!fileExists(parserPackagePath)) {
    errors.push({
      code: 'E_PARSER_PACKAGE_META_MISSING',
      path: parserPackagePath,
      message: 'parser/package.json must exist'
    });
  } else {
    parserPkg = readJson(parserPackagePath);
    if (parserPkg.name !== '@lapidist/dtif-parser') {
      errors.push({
        code: 'E_PARSER_PACKAGE_NAME',
        path: `${parserPackagePath}/name`,
        message: 'parser package must be published as @lapidist/dtif-parser'
      });
    }
    if (parserPkg.main !== './dist/index.js') {
      errors.push({
        code: 'E_PARSER_PACKAGE_MAIN',
        path: `${parserPackagePath}/main`,
        message: 'parser package must expose ./dist/index.js as the entry point'
      });
    }
    if (parserPkg.types !== './dist/index.d.ts') {
      errors.push({
        code: 'E_PARSER_PACKAGE_TYPES_FIELD',
        path: `${parserPackagePath}/types`,
        message: 'parser package must declare ./dist/index.d.ts as the type entry'
      });
    }
    if (typeof parserPkg.version !== 'string' || !semverPattern.test(parserPkg.version)) {
      errors.push({
        code: 'E_PARSER_PACKAGE_VERSION',
        path: `${parserPackagePath}/version`,
        message: 'parser package must declare a valid semver version'
      });
    }
    const parserRootExport = parserPkg.exports?.['.'];
    if (!parserRootExport || typeof parserRootExport !== 'object') {
      errors.push({
        code: 'E_PARSER_PACKAGE_EXPORTS',
        path: `${parserPackagePath}/exports`,
        message: 'parser package must provide an object export for the package root'
      });
    } else {
      if (parserRootExport.import !== './dist/index.js') {
        errors.push({
          code: 'E_PARSER_PACKAGE_EXPORTS_IMPORT',
          path: `${parserPackagePath}/exports`,
          message: 'parser package must expose ./dist/index.js as the import entry'
        });
      }
      if (parserRootExport.types !== './dist/index.d.ts') {
        errors.push({
          code: 'E_PARSER_PACKAGE_EXPORTS_TYPES',
          path: `${parserPackagePath}/exports`,
          message: 'parser package must expose ./dist/index.d.ts as the type entry'
        });
      }
    }
    const parserFiles = Array.isArray(parserPkg.files) ? parserPkg.files : [];
    for (const required of ['dist', 'README.md', 'CHANGELOG.md']) {
      if (!parserFiles.includes(required)) {
        errors.push({
          code: 'E_PARSER_PACKAGE_FILES',
          path: `${parserPackagePath}/files`,
          message: `parser package must ship ${required}`
        });
      }
    }
    const parserDependencies = parserPkg.dependencies || {};
    if (!parserDependencies['@lapidist/dtif-schema']) {
      errors.push({
        code: 'E_PARSER_PACKAGE_SCHEMA_DEP',
        path: `${parserPackagePath}/dependencies`,
        message: 'parser package must depend on @lapidist/dtif-schema'
      });
    }
    if (!parserDependencies['@lapidist/dtif-validator']) {
      errors.push({
        code: 'E_PARSER_PACKAGE_VALIDATOR_DEP',
        path: `${parserPackagePath}/dependencies`,
        message: 'parser package must depend on @lapidist/dtif-validator'
      });
    }
    if (!parserDependencies.yaml) {
      errors.push({
        code: 'E_PARSER_PACKAGE_YAML_DEP',
        path: `${parserPackagePath}/dependencies`,
        message: 'parser package must depend on yaml'
      });
    }
  }

  if (!fileExists('parser/README.md')) {
    errors.push({
      code: 'E_PARSER_PACKAGE_README',
      path: 'parser/README.md',
      message: 'parser package must include a README'
    });
  }

  if (!fileExists('parser/CHANGELOG.md')) {
    errors.push({
      code: 'E_PARSER_PACKAGE_CHANGELOG',
      path: 'parser/CHANGELOG.md',
      message: 'parser package must document changes in CHANGELOG.md'
    });
  }

  if (fileExists('parser/dist/index.js') && !fileExists('parser/dist/index.d.ts')) {
    errors.push({
      code: 'E_PARSER_PACKAGE_TYPES_MISSING',
      path: 'parser/dist/index.d.ts',
      message: 'parser package must emit TypeScript declarations alongside the build output'
    });
  }

  const versionedPackages = [
    ['schema', schemaPkg],
    ['validator', validatorPkg],
    ['parser', parserPkg]
  ];
  const publishedVersions = versionedPackages
    .filter(([, pkg]) => typeof pkg?.version === 'string')
    .map(([, pkg]) => pkg.version);
  if (publishedVersions.length > 1) {
    const uniqueVersions = new Set(publishedVersions);
    if (uniqueVersions.size > 1) {
      errors.push({
        code: 'E_PACKAGE_VERSION_MISMATCH',
        path: 'schema/package.json/version',
        message: 'schema, validator, and parser packages must share the same version'
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
