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
const unresolvedRelativeExternal = {
  $version: '1.0.0',
  custom: {
    $type: 'vendor.custom',
    $ref: './local.tokens.json#/custom/token'
  }
};
const unresolvedExternalOverrideTarget = {
  $version: '1.0.0',
  color: {
    base: {
      $type: 'color',
      $value: { colorSpace: 'srgb', components: [0, 0, 0, 1] }
    }
  },
  $overrides: [
    {
      $token: 'themes/dark.tokens.json#/color/base',
      $when: { platform: 'web' },
      $ref: '#/color/base'
    }
  ]
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
const overrideWithRefAndFallback = {
  $version: '1.0.0',
  color: {
    base: {
      $type: 'color',
      $value: { colorSpace: 'srgb', components: [0, 0, 0, 1] }
    },
    dark: {
      $type: 'color',
      $value: { colorSpace: 'srgb', components: [1, 1, 1, 1] }
    }
  },
  $overrides: [
    {
      $token: '#/color/base',
      $when: { platform: 'web' },
      $ref: '#/color/dark',
      $fallback: { $ref: '#/color/dark' }
    }
  ]
};
const overrideWithValueAndFallback = {
  $version: '1.0.0',
  color: {
    base: {
      $type: 'color',
      $value: { colorSpace: 'srgb', components: [0, 0, 0, 1] }
    }
  },
  $overrides: [
    {
      $token: '#/color/base',
      $when: { platform: 'web' },
      $value: { colorSpace: 'srgb', components: [1, 1, 1, 1] },
      $fallback: { $value: { colorSpace: 'srgb', components: [1, 1, 1, 1] } }
    }
  ]
};
const overrideInlineValueTypeMismatch = {
  $version: '1.0.0',
  color: {
    base: {
      $type: 'color',
      $value: { colorSpace: 'srgb', components: [0, 0, 0, 1] }
    }
  },
  $overrides: [
    {
      $token: '#/color/base',
      $when: { platform: 'web' },
      $value: { dimensionType: 'length', value: 8, unit: 'px' }
    }
  ]
};
const overrideFallbackValueTypeMismatch = {
  $version: '1.0.0',
  color: {
    base: {
      $type: 'color',
      $value: { colorSpace: 'srgb', components: [0, 0, 0, 1] }
    }
  },
  $overrides: [
    {
      $token: '#/color/base',
      $when: { platform: 'web' },
      $fallback: [{ $value: { dimensionType: 'length', value: 8, unit: 'px' } }]
    }
  ]
};
const functionParameterTypeMismatch = {
  $version: '1.0.0',
  color: {
    base: {
      $type: 'color',
      $value: { colorSpace: 'srgb', components: [0, 0, 0, 1] }
    }
  },
  spacing: {
    calc: {
      $type: 'dimension',
      $value: {
        fn: 'calc',
        parameters: [{ $ref: '#/color/base' }]
      }
    }
  }
};
const typographyFontSizeRefTypeMismatch = {
  $version: '1.0.0',
  color: {
    base: {
      $type: 'color',
      $value: { colorSpace: 'srgb', components: [0, 0, 0, 1] }
    }
  },
  typography: {
    body: {
      $type: 'typography',
      $value: {
        fontFamily: 'Inter',
        fontSize: { $ref: '#/color/base' }
      }
    }
  }
};
const gradientStopOrderViolation = {
  $version: '1.0.0',
  bad: {
    $type: 'gradient',
    $value: {
      gradientType: 'linear',
      stops: [
        {
          position: 0,
          color: { colorSpace: 'srgb', components: [1, 0, 0, 1] }
        },
        {
          position: 0.5,
          color: { colorSpace: 'srgb', components: [0, 1, 0, 1] }
        },
        {
          position: 0.4,
          color: { colorSpace: 'srgb', components: [0, 0, 1, 1] }
        }
      ],
      angle: 30
    }
  }
};
const calcMixedUnitsViolation = {
  $version: '1.0.0',
  bad: {
    $type: 'dimension',
    $value: { fn: 'calc', parameters: ['1px', '+', '1deg'] }
  }
};
const clampMinGreaterThanMaxViolation = {
  $version: '1.0.0',
  bad: {
    $type: 'dimension',
    $value: { fn: 'clamp', parameters: ['10px', '5px', '1px'] }
  }
};
const motionPathStartTimeViolation = {
  $version: '1.0.0',
  problem: {
    $type: 'motion',
    $value: {
      motionType: 'css.offset-path',
      parameters: {
        points: [
          {
            time: 0.25,
            position: {
              x: { dimensionType: 'length', value: 0, unit: 'px' }
            }
          },
          {
            time: 1,
            position: {
              x: { dimensionType: 'length', value: 16, unit: 'px' }
            }
          }
        ]
      }
    }
  }
};
const motionPathEndTimeViolation = {
  $version: '1.0.0',
  problem: {
    $type: 'motion',
    $value: {
      motionType: 'css.offset-path',
      parameters: {
        points: [
          {
            time: 0,
            position: {
              x: { dimensionType: 'length', value: 0, unit: 'px' }
            }
          },
          {
            time: 0.75,
            position: {
              x: { dimensionType: 'length', value: 16, unit: 'px' }
            }
          }
        ]
      }
    }
  }
};
const motionPathOrderViolation = {
  $version: '1.0.0',
  problem: {
    $type: 'motion',
    $value: {
      motionType: 'css.offset-path',
      parameters: {
        points: [
          {
            time: 0,
            position: {
              x: { dimensionType: 'length', value: 0, unit: 'px' }
            }
          },
          {
            time: 0.8,
            position: {
              x: { dimensionType: 'length', value: 12, unit: 'px' }
            }
          },
          {
            time: 0.5,
            position: {
              x: { dimensionType: 'length', value: 16, unit: 'px' }
            }
          },
          {
            time: 1,
            position: {
              x: { dimensionType: 'length', value: 20, unit: 'px' }
            }
          }
        ]
      }
    }
  }
};
const motionPathEasingTypeViolation = {
  $version: '1.0.0',
  palette: {
    background: {
      $type: 'color',
      $value: {
        colorSpace: 'srgb',
        components: [0.2, 0.3, 0.4, 1]
      }
    }
  },
  problem: {
    $type: 'motion',
    $value: {
      motionType: 'css.offset-path',
      parameters: {
        points: [
          {
            time: 0,
            position: {
              x: { dimensionType: 'length', value: 0, unit: 'px' }
            }
          },
          {
            time: 1,
            position: {
              x: { dimensionType: 'length', value: 16, unit: 'px' }
            },
            easing: '#/palette/background'
          }
        ]
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

  const unresolvedRelativeExternalValid = validate(unresolvedRelativeExternal);
  if (unresolvedRelativeExternalValid) {
    errors.push({
      code: 'E_VALIDATOR_EXTERNAL_RESOLUTION_MISSING',
      path: '',
      message:
        'validator should reject unresolved relative external references unless explicit opt-in is provided'
    });
  }

  const unresolvedExternalOverrideTargetValid = validate(unresolvedExternalOverrideTarget);
  if (unresolvedExternalOverrideTargetValid) {
    errors.push({
      code: 'E_VALIDATOR_OVERRIDE_EXTERNAL_TARGET_RESOLUTION_MISSING',
      path: '',
      message:
        'validator should reject unresolved external override targets unless explicit opt-in is provided'
    });
  }

  const { validate: validateWithExternalOptIn } = createDtifValidator({
    allowExternalReferences: true,
    allowRemoteReferences: true
  });
  const unresolvedRemoteWithOptInValid = validateWithExternalOptIn(unresolvedRemote);
  if (!unresolvedRemoteWithOptInValid) {
    errors.push({
      code: 'E_VALIDATOR_REMOTE_OPT_IN_REJECTED',
      path: '',
      message:
        'validator should defer remote reference resolution when external and remote opt-ins are both enabled'
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

  if (validate(overrideWithRefAndFallback)) {
    errors.push({
      code: 'E_VALIDATOR_OVERRIDE_REF_FALLBACK_COMBINATION',
      path: '',
      message: 'validator should reject overrides that combine $ref and $fallback'
    });
  }

  if (validate(overrideWithValueAndFallback)) {
    errors.push({
      code: 'E_VALIDATOR_OVERRIDE_VALUE_FALLBACK_COMBINATION',
      path: '',
      message: 'validator should reject overrides that combine $value and $fallback'
    });
  }

  if (validate(overrideInlineValueTypeMismatch)) {
    errors.push({
      code: 'E_VALIDATOR_OVERRIDE_INLINE_VALUE_TYPE_MISMATCH',
      path: '',
      message:
        'validator should reject override inline values that do not match the target token type'
    });
  }

  if (validate(overrideFallbackValueTypeMismatch)) {
    errors.push({
      code: 'E_VALIDATOR_OVERRIDE_FALLBACK_VALUE_TYPE_MISMATCH',
      path: '',
      message:
        'validator should reject override fallback inline values that do not match the target token type'
    });
  }

  if (validate(functionParameterTypeMismatch)) {
    errors.push({
      code: 'E_VALIDATOR_FUNCTION_PARAMETER_TYPE_MISMATCH',
      path: '',
      message:
        'validator should reject function parameter refs that resolve to a token with a different $type'
    });
  }

  if (validate(typographyFontSizeRefTypeMismatch)) {
    errors.push({
      code: 'E_VALIDATOR_TYPOGRAPHY_REF_TYPE_MISMATCH',
      path: '',
      message:
        'validator should reject typography fontSize refs that do not resolve to dimension tokens'
    });
  }

  if (validate(gradientStopOrderViolation)) {
    errors.push({
      code: 'E_VALIDATOR_GRADIENT_STOP_ORDER',
      path: '',
      message: 'validator should reject gradients whose stops are not sorted in ascending order'
    });
  }

  if (validate(calcMixedUnitsViolation)) {
    errors.push({
      code: 'E_VALIDATOR_CALC_UNIT_MISMATCH',
      path: '',
      message:
        'validator should reject calc dimension functions that mix incompatible unit families'
    });
  }

  if (validate(clampMinGreaterThanMaxViolation)) {
    errors.push({
      code: 'E_VALIDATOR_CLAMP_MIN_GREATER_THAN_MAX',
      path: '',
      message: 'validator should reject clamp dimension functions where min is greater than max'
    });
  }

  if (validate(motionPathStartTimeViolation)) {
    errors.push({
      code: 'E_VALIDATOR_MOTION_PATH_START',
      path: '',
      message: 'validator should reject motion path sequences that do not start at time 0'
    });
  }

  if (validate(motionPathEndTimeViolation)) {
    errors.push({
      code: 'E_VALIDATOR_MOTION_PATH_END',
      path: '',
      message: 'validator should reject motion path sequences that do not end at time 1'
    });
  }

  if (validate(motionPathOrderViolation)) {
    errors.push({
      code: 'E_VALIDATOR_MOTION_PATH_ORDER',
      path: '',
      message: 'validator should reject motion path sequences with non-monotonic time values'
    });
  }

  if (validate(motionPathEasingTypeViolation)) {
    errors.push({
      code: 'E_VALIDATOR_MOTION_PATH_EASING_TYPE',
      path: '',
      message:
        'validator should reject motion path keyframes whose easing pointer does not resolve to an easing token'
    });
  }

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : null };
}
