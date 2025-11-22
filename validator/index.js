import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const schema = require('@lapidist/dtif-schema/core.json');

export const DEFAULT_VALIDATOR_OPTIONS = {
  allErrors: true,
  strict: true,
  $data: true
};

export const DEFAULT_FORMAT_REGISTRAR = addFormats;

const DEFAULT_SCHEMA_ID = schema.$id ?? 'https://dtif.lapidist.net/schema/core.json';

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
    schemaId = DEFAULT_SCHEMA_ID
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

  const validate = ensureSchema(ajv, schemaId);

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
    errors: valid ? null : (validate.errors ?? [])
  };
}

export { schema };
