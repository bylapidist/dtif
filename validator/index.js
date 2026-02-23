import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runSemanticValidation } from './semantic.js';

const require = createRequire(import.meta.url);
const LOCAL_SCHEMA_PATH = fileURLToPath(new URL('../schema/core.json', import.meta.url));
const SCHEMA_PACKAGE_PATH = '@lapidist/dtif-schema/core.json';
const schema = require(existsSync(LOCAL_SCHEMA_PATH) ? LOCAL_SCHEMA_PATH : SCHEMA_PACKAGE_PATH);
const LOCAL_REGISTRY_PATH = fileURLToPath(new URL('../registry/types.json', import.meta.url));
const localRegistryTypes = existsSync(LOCAL_REGISTRY_PATH) ? require(LOCAL_REGISTRY_PATH) : {};

export const DEFAULT_VALIDATOR_OPTIONS = {
  allErrors: true,
  strict: true,
  $data: true
};

export const DEFAULT_FORMAT_REGISTRAR = addFormats;

const DEFAULT_SCHEMA_ID = schema.$id ?? 'https://dtif.lapidist.net/schema/core.json';
const KNOWN_TYPES = collectKnownTypes(schema, localRegistryTypes);

function ensureSchema(ajv, schemaId = DEFAULT_SCHEMA_ID) {
  let validate = ajv.getSchema(schemaId);
  if (!validate) {
    ajv.addSchema(schema, schemaId);
    validate = ajv.getSchema(schemaId);
  }
  return validate ?? ajv.compile(schema);
}

export function createDtifValidator(options = {}) {
  const {
    ajv: existingAjv,
    ajvOptions = {},
    formats = addFormats,
    schemaId = DEFAULT_SCHEMA_ID,
    allowRemoteReferences = false,
    enforceSemanticRules = true
  } = options;

  const ajv =
    existingAjv ??
    new Ajv2020({
      ...DEFAULT_VALIDATOR_OPTIONS,
      ...ajvOptions
    });

  if (formats) {
    const register = typeof formats === 'function' ? formats : DEFAULT_FORMAT_REGISTRAR;
    register(ajv);
  }

  const schemaValidate = ensureSchema(ajv, schemaId);
  const validate = (document) => {
    const schemaValid = schemaValidate(document);
    const schemaErrors = schemaValid ? [] : (schemaValidate.errors ?? []);
    const semantic =
      schemaValid && enforceSemanticRules
        ? runSemanticValidation(document, { allowRemoteReferences, knownTypes: KNOWN_TYPES })
        : { errors: [], warnings: [] };

    const mergedErrors = [...schemaErrors, ...semantic.errors];
    validate.errors = mergedErrors.length === 0 ? null : mergedErrors;
    validate.warnings = semantic.warnings.length === 0 ? null : semantic.warnings;

    return mergedErrors.length === 0;
  };

  validate.errors = null;
  validate.warnings = null;
  validate.schema = schemaValidate.schema;
  validate.schemaEnv = schemaValidate.schemaEnv;
  validate.source = schemaValidate.source;

  return {
    ajv,
    schema,
    schemaId,
    validate
  };
}

export function validateDtif(document, options = {}) {
  const { validate } = createDtifValidator(options);
  const valid = validate(document);
  return {
    valid,
    errors: valid ? null : (validate.errors ?? []),
    warnings: validate.warnings ?? null
  };
}

export { schema };

function collectKnownTypes(value, registry = {}) {
  const known = new Set();
  if (registry && typeof registry === 'object') {
    for (const key of Object.keys(registry)) {
      if (typeof key === 'string' && key.length > 0) {
        known.add(key);
      }
    }
  }

  const tokenSchema = value?.$defs?.['token-core'];
  const clauses = tokenSchema?.allOf;
  if (!Array.isArray(clauses)) {
    return known;
  }

  for (const clause of clauses) {
    const typeConst = clause?.if?.properties?.$type?.const;
    if (typeof typeConst === 'string' && typeConst.length > 0) {
      known.add(typeConst);
    }
  }

  return known;
}
