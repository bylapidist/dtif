import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createDtifValidator } from '../../validator/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const minimalExamplePath = path.resolve(__dirname, '../../examples/minimal.tokens.json');
const minimalExample = JSON.parse(fs.readFileSync(minimalExamplePath, 'utf8'));

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

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : null };
}
