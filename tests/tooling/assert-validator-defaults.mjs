import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createDtifValidator } from '../../validator/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const minimalExamplePath = path.resolve(__dirname, '../../examples/minimal.tokens.json');
const minimalExample = JSON.parse(fs.readFileSync(minimalExamplePath, 'utf8'));
const invalidMinimalExample = JSON.parse(JSON.stringify(minimalExample));
if (invalidMinimalExample.spacing?.small) {
  invalidMinimalExample.spacing.small = { foo: 'bar' };
}
const orderingViolation = {
  $version: '1.0.0',
  custom: {
    $value: 4,
    $type: 'vendor.custom'
  }
};
const warningOnly = {
  $version: '2.0.0',
  custom: {
    $type: 'vendor.custom',
    $value: 4
  }
};
const unresolvedRemote = {
  $version: '1.0.0',
  custom: {
    $type: 'vendor.custom',
    $ref: 'https://example.com/remote.tokens.json#/custom/token'
  }
};

export default function assertValidatorDefaults() {
  const { ajv, validate } = createDtifValidator();
  const errors = [];

  if (ajv.opts.strict !== true) {
    errors.push({
      code: 'E_VALIDATOR_STRICT_MODE_DISABLED',
      path: '',
      message: 'createDtifValidator must enable Ajv strict mode by default'
    });
  }

  if (ajv.opts.$data !== true) {
    errors.push({
      code: 'E_VALIDATOR_DATA_DISABLED',
      path: '',
      message: 'createDtifValidator must enable Ajv $data references by default'
    });
  }

  if (ajv.opts.allowUnionTypes) {
    errors.push({
      code: 'E_VALIDATOR_ALLOW_UNION_TYPES_ENABLED',
      path: '',
      message: 'createDtifValidator should not allow union types in strict mode'
    });
  }

  const valid = validate(minimalExample);
  if (!valid) {
    errors.push({
      code: 'E_VALIDATOR_MINIMAL_EXAMPLE_INVALID',
      path: '',
      message: `minimal example should validate: ${JSON.stringify(validate.errors ?? [], null, 2)}`
    });
  }

  const invalidExampleIsValid = validate(invalidMinimalExample);
  if (invalidExampleIsValid) {
    errors.push({
      code: 'E_VALIDATOR_INVALID_EXAMPLE_VALIDATES',
      path: '',
      message: 'invalid minimal example missing $type should not validate'
    });
  } else if (!validate.errors || validate.errors.length === 0) {
    errors.push({
      code: 'E_VALIDATOR_INVALID_EXAMPLE_MISSING_ERRORS',
      path: '',
      message: 'invalid minimal example should provide validation errors'
    });
  }

  const orderingValid = validate(orderingViolation);
  if (orderingValid) {
    errors.push({
      code: 'E_VALIDATOR_ORDERING_ENFORCEMENT_MISSING',
      path: '',
      message: 'validator should reject canonical ordering violations'
    });
  }

  const warningValid = validate(warningOnly);
  if (!warningValid) {
    errors.push({
      code: 'E_VALIDATOR_WARNING_ONLY_REJECTED',
      path: '',
      message: 'future version and unknown type warnings should not fail validation'
    });
  } else {
    const warnings = validate.warnings ?? [];
    if (warnings.length < 2) {
      errors.push({
        code: 'E_VALIDATOR_WARNINGS_MISSING',
        path: '',
        message: 'validator should surface warnings for unknown type and future major version'
      });
    }
  }

  const unresolvedRemoteValid = validate(unresolvedRemote);
  if (unresolvedRemoteValid) {
    errors.push({
      code: 'E_VALIDATOR_REMOTE_RESOLUTION_MISSING',
      path: '',
      message: 'validator should reject unresolved remote references even when semantic checks run'
    });
  }

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : null };
}
