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
const deprecatedReplacementTypeMismatch = {
  $version: '1.0.0',
  color: {
    base: {
      $type: 'color',
      $value: { colorSpace: 'srgb', components: [0, 0, 0, 1] },
      $deprecated: { $replacement: '#/dimension/space' }
    }
  },
  dimension: {
    space: {
      $type: 'dimension',
      $value: { dimensionType: 'length', value: 4, unit: 'px' }
    }
  }
};
const overrideReferenceTypeMismatch = {
  $version: '1.0.0',
  button: {
    bg: {
      $type: 'color',
      $ref: '#/color/base'
    }
  },
  color: {
    base: {
      $type: 'color',
      $value: { colorSpace: 'srgb', components: [0, 0, 0, 1] }
    }
  },
  dimension: {
    space: {
      $type: 'dimension',
      $value: { dimensionType: 'length', value: 4, unit: 'px' }
    }
  },
  $overrides: [
    {
      $token: '#/button/bg',
      $when: { platform: 'web' },
      $ref: '#/dimension/space'
    }
  ]
};
const aliasTypeMismatch = {
  $version: '1.0.0',
  color: {
    base: {
      $type: 'color',
      $value: { colorSpace: 'srgb', components: [0, 0, 0, 1] }
    }
  },
  spacing: {
    token: {
      $type: 'dimension',
      $ref: '#/color/base'
    }
  }
};
const typographyReservedMember = {
  $version: '1.0.0',
  typography: {
    body: {
      $type: 'typography',
      $value: {
        fontFamily: 'Inter',
        fontSize: { dimensionType: 'length', value: 16, unit: 'px' },
        $illegal: true
      }
    }
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

  validate(minimalExample);
  const minimalWarnings = validate.warnings ?? [];
  if (minimalWarnings.some((warning) => warning.keyword === 'dtifSemantic')) {
    errors.push({
      code: 'E_VALIDATOR_REGISTERED_TYPES_WARN',
      path: '',
      message: `validator should not warn about registered token types: ${JSON.stringify(
        minimalWarnings,
        null,
        2
      )}`
    });
  }

  const unresolvedRemoteValid = validate(unresolvedRemote);
  if (unresolvedRemoteValid) {
    errors.push({
      code: 'E_VALIDATOR_REMOTE_RESOLUTION_MISSING',
      path: '',
      message: 'validator should reject unresolved remote references even when semantic checks run'
    });
  }

  const deprecatedReplacementValid = validate(deprecatedReplacementTypeMismatch);
  if (deprecatedReplacementValid) {
    errors.push({
      code: 'E_VALIDATOR_DEPRECATED_REPLACEMENT_TYPE',
      path: '',
      message:
        'validator should reject $deprecated.$replacement values that resolve to a different $type'
    });
  }

  const overrideTypeMismatchValid = validate(overrideReferenceTypeMismatch);
  if (overrideTypeMismatchValid) {
    errors.push({
      code: 'E_VALIDATOR_OVERRIDE_TYPE_MISMATCH',
      path: '',
      message:
        'validator should reject overrides whose $ref resolves to a different $type than $token'
    });
  }

  const aliasTypeMismatchValid = validate(aliasTypeMismatch);
  if (aliasTypeMismatchValid) {
    errors.push({
      code: 'E_VALIDATOR_ALIAS_TYPE_MISMATCH',
      path: '',
      message: 'validator should reject token aliases whose $ref resolves to a different $type'
    });
  }

  const typographyReservedMemberValid = validate(typographyReservedMember);
  if (typographyReservedMemberValid) {
    errors.push({
      code: 'E_VALIDATOR_RESERVED_MEMBER_ALLOWED',
      path: '',
      message:
        'validator should reject unrecognised reserved members beginning with $ in typography values'
    });
  }

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : null };
}
