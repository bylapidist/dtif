import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '../../schema/core.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const schemaId = schema.$id || 'https://dtif.lapidist.net/schema/core.json';
const ajv = new Ajv({ allErrors: true, strict: false, $data: true });
addFormats(ajv);
ajv.addSchema(schema);
let tokenValidator = ajv.getSchema(`${schemaId}#/$defs/token`);
if (!tokenValidator) {
  tokenValidator = ajv.compile({ $ref: `${schemaId}#/$defs/token` });
}

function getPointerTarget(root, pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('#')) {
    return null;
  }
  const parts = pointer
    .slice(1)
    .split('/')
    .filter(Boolean)
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur = root;
  for (const part of parts) {
    if (cur && typeof cur === 'object' && Object.prototype.hasOwnProperty.call(cur, part)) {
      cur = cur[part];
    } else {
      return null;
    }
  }
  return cur;
}

function getTokenTypeInfo(root, pointer, seen = new Set()) {
  if (typeof pointer !== 'string') {
    return { node: null, type: undefined };
  }
  const node = getPointerTarget(root, pointer);
  if (!node || typeof node !== 'object') {
    return { node: null, type: undefined };
  }
  if (typeof node.$ref === 'string' && node.$ref.startsWith('#') && !seen.has(pointer)) {
    seen.add(pointer);
    const resolved = getTokenTypeInfo(root, node.$ref, seen);
    if (resolved.type) {
      return resolved;
    }
    return { node, type: typeof node.$type === 'string' ? node.$type : undefined };
  }
  if (typeof node.$type === 'string') {
    return { node, type: node.$type };
  }
  return { node, type: undefined };
}

const MOTION_CATEGORY_PATTERNS = [
  { type: 'translation', regex: /\.(?:translate(?:[-a-z0-9]*)?|translation(?:[-a-z0-9]*)?)$/ },
  { type: 'rotation', regex: /\.(?:rotate(?:[-a-z0-9]*)?|rotation(?:[-a-z0-9]*)?)$/ },
  { type: 'scale', regex: /\.(?:scale(?:[-a-z0-9]*)?)$/ },
  { type: 'path', regex: /\.(?:path|offset-path|motion-path)$/ }
];

const FONT_WEIGHT_ABSOLUTE_KEYWORDS = new Map([
  ['normal', 400],
  ['bold', 700]
]);
const FONT_WEIGHT_RELATIVE_KEYWORDS = new Set(['bolder', 'lighter']);
const FONT_WEIGHT_NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const FONT_STYLE_PATTERN =
  /^(?:normal|italic|oblique(?:\s+[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?(?:deg|grad|rad|turn))?)$/i;
const FONT_STRETCH_PATTERN =
  /^(?:normal|ultra-condensed|extra-condensed|condensed|semi-condensed|semi-expanded|expanded|extra-expanded|ultra-expanded|\+?(?:0*(?:[1-9]\d{0,2})(?:\.\d+)?|0*1000(?:\.0+)?)%)$/i;
const FONT_FEATURE_TAG_PATTERN = /^[A-Za-z0-9]{4}$/;
const DURATION_UNIT_RULES = [
  {
    pattern:
      /^(?:css\.(?:transition|animation)-duration|ios\.caanimation\.duration|android\.value-animator\.duration)$/,
    units: new Set(['s', 'ms'])
  },
  {
    pattern: /^(?:ios\.cadisplaylink\.frame-count|android\.choreographer\.frame-count)$/,
    units: new Set(['frames'])
  },
  {
    pattern:
      /^(?:css\.timeline\.progress|ios\.uianimation\.fraction|android\.animator-set\.fraction)$/,
    units: new Set(['%'])
  }
];
const FONT_VARIANT_PATTERN = new RegExp(schema.$defs['font-variant-string'].pattern, 'iu');

function parseFontWeightAbsoluteValue(token) {
  if (typeof token !== 'string') {
    return { valid: false, value: NaN };
  }
  const keywordValue = FONT_WEIGHT_ABSOLUTE_KEYWORDS.get(token);
  if (typeof keywordValue === 'number') {
    return { valid: true, value: keywordValue };
  }
  if (!FONT_WEIGHT_NUMBER_PATTERN.test(token)) {
    return { valid: false, value: NaN };
  }
  const numericValue = Number(token);
  if (!Number.isFinite(numericValue) || numericValue < 1 || numericValue > 1000) {
    return { valid: false, value: NaN };
  }
  return { valid: true, value: numericValue };
}

function isValidFontWeightString(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (FONT_WEIGHT_RELATIVE_KEYWORDS.has(normalized)) {
    return true;
  }
  const absolute = parseFontWeightAbsoluteValue(normalized);
  if (absolute.valid) {
    return true;
  }
  const parts = normalized.split(/\s+/);
  if (parts.length === 2) {
    const first = parseFontWeightAbsoluteValue(parts[0]);
    const second = parseFontWeightAbsoluteValue(parts[1]);
    if (first.valid && second.valid && first.value <= second.value) {
      return true;
    }
  }
  return false;
}

function isValidFontStyle(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }
  return FONT_STYLE_PATTERN.test(normalized);
}

function isValidFontStretch(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }
  return FONT_STRETCH_PATTERN.test(normalized);
}

function isValidFontVariant(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }
  return FONT_VARIANT_PATTERN.test(normalized);
}

function getMotionCategory(motionType) {
  if (typeof motionType !== 'string') {
    return null;
  }
  const normalised = motionType.toLowerCase();
  for (const entry of MOTION_CATEGORY_PATTERNS) {
    if (entry.regex.test(normalised)) {
      return entry.type;
    }
  }
  return null;
}

export default function assertTypeCompat(doc) {
  const errors = [];

  function validateFunctionRef(ref, targetType, path) {
    if (!targetType || typeof ref !== 'string' || !ref.startsWith('#')) {
      return;
    }
    const { type: refType } = getTokenTypeInfo(doc, ref, new Set());
    if (!refType) {
      errors.push({
        code: 'E_FUNCTION_REF_TYPE_MISMATCH',
        path,
        message: `function parameter ref ${ref} must resolve to a token with type ${targetType}`
      });
      return;
    }
    if (refType !== targetType) {
      errors.push({
        code: 'E_FUNCTION_REF_TYPE_MISMATCH',
        path,
        message: `function parameter ref ${ref} has type ${refType}, expected ${targetType}`
      });
    }
  }

  function validateFunctionParameter(param, targetType, path) {
    if (!targetType) {
      return;
    }
    if (Array.isArray(param)) {
      param.forEach((entry, idx) => {
        validateFunctionParameter(entry, targetType, `${path}/${idx}`);
      });
      return;
    }
    if (param && typeof param === 'object') {
      if (typeof param.$ref === 'string') {
        validateFunctionRef(param.$ref, targetType, `${path}/$ref`);
      }
      if (param.fn && Array.isArray(param.parameters)) {
        validateFunctionValueNode(param, targetType, path);
        return;
      }
      for (const [key, value] of Object.entries(param)) {
        if (key !== '$ref') {
          validateFunctionParameter(value, targetType, `${path}/${key}`);
        }
      }
    }
  }

  function validateFunctionValueNode(value, targetType, path) {
    if (!value || typeof value !== 'object' || !targetType) {
      return;
    }
    if (value.fn && Array.isArray(value.parameters)) {
      value.parameters.forEach((param, idx) => {
        validateFunctionParameter(param, targetType, `${path}/parameters/${idx}`);
      });
    }
  }

  function validateOverrideValue(value, targetType, path) {
    if (!targetType || !tokenValidator) {
      return;
    }
    const candidate = { $type: targetType, $value: value };
    const valid = tokenValidator(candidate);
    if (!valid) {
      errors.push({
        code: 'E_OVERRIDE_TYPE_MISMATCH',
        path,
        message: `override value must be valid for type ${targetType}`
      });
    }
    validateFunctionValueNode(value, targetType, path);
  }

  function validateOverrideRef(ref, targetType, path) {
    if (!targetType || typeof ref !== 'string' || !ref.startsWith('#')) {
      return;
    }
    const { type: refType } = getTokenTypeInfo(doc, ref, new Set());
    if (!refType) {
      errors.push({
        code: 'E_OVERRIDE_TYPE_MISMATCH',
        path,
        message: `override $ref ${ref} must resolve to a token with type ${targetType}`
      });
    } else if (refType !== targetType) {
      errors.push({
        code: 'E_OVERRIDE_TYPE_MISMATCH',
        path,
        message: `override $ref ${ref} has type ${refType}, expected ${targetType}`
      });
    }
  }

  function validateFallbackBranch(branch, targetType, path) {
    if (!branch || typeof branch !== 'object') {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(branch, '$value')) {
      validateOverrideValue(branch.$value, targetType, `${path}/$value`);
    }
    if (typeof branch.$ref === 'string') {
      validateOverrideRef(branch.$ref, targetType, `${path}/$ref`);
    }
    if (Object.prototype.hasOwnProperty.call(branch, '$fallback')) {
      validateFallback(branch.$fallback, targetType, `${path}/$fallback`);
    }
  }

  function validateFallback(fallback, targetType, path) {
    if (Array.isArray(fallback)) {
      fallback.forEach((entry, idx) => {
        validateFallbackBranch(entry, targetType, `${path}/${idx}`);
      });
    } else {
      validateFallbackBranch(fallback, targetType, path);
    }
  }

  function validateTokenRefObject(refObj, options) {
    if (!refObj || typeof refObj !== 'object' || Array.isArray(refObj)) {
      return;
    }
    const pointer = refObj.$ref;
    if (typeof pointer !== 'string' || !pointer.startsWith('#')) {
      return;
    }
    const {
      expectedType,
      path,
      code,
      context = 'token $ref',
      dimensionType,
      dimensionMessage
    } = options;
    const { node: targetNode, type: refType } = getTokenTypeInfo(doc, pointer, new Set());
    const errorBase = { code, path };
    if (!refType) {
      errors.push({
        ...errorBase,
        message: `${context} ${pointer} must resolve to a token that declares $type ${expectedType}`
      });
      return;
    }
    if (refType !== expectedType) {
      errors.push({
        ...errorBase,
        message: `${context} ${pointer} has type ${refType}, expected ${expectedType}`
      });
      return;
    }
    if (dimensionType) {
      const value = targetNode?.$value;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const resolvedDimensionType = value.dimensionType;
        if (typeof resolvedDimensionType === 'string' && resolvedDimensionType !== dimensionType) {
          errors.push({
            ...errorBase,
            message:
              dimensionMessage || `${context} ${pointer} dimensionType must be "${dimensionType}"`
          });
        }
      }
    }
  }

  function validateDeprecated(node, path) {
    if (
      !node ||
      typeof node !== 'object' ||
      typeof node.$type !== 'string' ||
      !node.$deprecated ||
      typeof node.$deprecated !== 'object' ||
      typeof node.$deprecated.$replacement !== 'string'
    ) {
      return;
    }
    const pointer = node.$deprecated.$replacement;
    if (typeof pointer !== 'string' || !pointer.startsWith('#')) {
      return;
    }
    const { type: replacementType } = getTokenTypeInfo(doc, pointer, new Set());
    const errorBase = {
      code: 'E_DEPRECATED_REPLACEMENT_TYPE_MISMATCH',
      path: `${path}/$deprecated/$replacement`
    };
    if (!replacementType) {
      errors.push({
        ...errorBase,
        message: `deprecated replacement ${pointer} must resolve to a token declaring $type ${node.$type}`
      });
      return;
    }
    if (replacementType !== node.$type) {
      errors.push({
        ...errorBase,
        message: `deprecated replacement ${pointer} has type ${replacementType}, expected ${node.$type}`
      });
    }
  }

  function validateOverride(override, idx) {
    if (!override || typeof override !== 'object' || typeof override.$token !== 'string') {
      return;
    }
    const basePath = `/$overrides/${idx}`;
    const { node, type: targetType } = getTokenTypeInfo(doc, override.$token, new Set());
    const hasValueOrRef =
      node &&
      typeof node === 'object' &&
      (Object.prototype.hasOwnProperty.call(node, '$value') ||
        Object.prototype.hasOwnProperty.call(node, '$ref'));
    const hasDeclaredType = node && typeof node.$type === 'string';
    if (!hasValueOrRef || !hasDeclaredType || !targetType) {
      errors.push({
        code: 'E_OVERRIDE_TARGET_UNTYPED',
        path: `${basePath}/$token`,
        message: `override $token ${override.$token} must resolve to a token that declares $type`
      });
      return;
    }
    if (Object.prototype.hasOwnProperty.call(override, '$value')) {
      validateOverrideValue(override.$value, targetType, `${basePath}/$value`);
    }
    if (typeof override.$ref === 'string') {
      validateOverrideRef(override.$ref, targetType, `${basePath}/$ref`);
    }
    if (Object.prototype.hasOwnProperty.call(override, '$fallback')) {
      validateFallback(override.$fallback, targetType, `${basePath}/$fallback`);
    }
  }

  if (Array.isArray(doc?.$overrides)) {
    doc.$overrides.forEach((override, idx) => {
      validateOverride(override, idx);
    });
  }

  function walk(node, path = '') {
    if (node && typeof node === 'object') {
      validateDeprecated(node, path);
      // generic numeric precision check
      for (const [key, val] of Object.entries(node)) {
        const nextPath = `${path}/${key}`;
        if (typeof val === 'number') {
          const m = val.toString().match(/\.(\d+)/);
          if (m && m[1].length > 10) {
            errors.push({
              code: 'E_NUMERIC_PRECISION',
              path: nextPath,
              message: 'numeric precision overflow'
            });
          }
        }
      }
      if (
        node.$type === 'dimension' &&
        node.$value &&
        typeof node.$value === 'object' &&
        node.$value.fn === 'calc'
      ) {
        const units = new Set();
        for (const p of node.$value.parameters || []) {
          if (typeof p === 'string') {
            const m = p.match(/[a-z%]+$/i);
            if (m) units.add(m[0]);
          }
        }
        if (units.size > 1) {
          errors.push({
            code: 'E_CALC_MIXED_UNITS',
            path: `${path}/$value/parameters`,
            message: 'calc mixed units'
          });
        }
      } else if (
        node.$type === 'dimension' &&
        node.$value &&
        typeof node.$value === 'object' &&
        node.$value.fn === 'clamp'
      ) {
        const [min, , max] = node.$value.parameters || [];
        if (typeof min === 'string' && typeof max === 'string') {
          const minMatch = min.match(/(-?\d*\.?\d+)([a-z%]*)/i);
          const maxMatch = max.match(/(-?\d*\.?\d+)([a-z%]*)/i);
          if (minMatch && maxMatch && minMatch[2] === maxMatch[2]) {
            if (parseFloat(minMatch[1]) > parseFloat(maxMatch[1])) {
              errors.push({
                code: 'E_CLAMP_MIN_GT_MAX',
                path: `${path}/$value/parameters`,
                message: 'clamp min greater than max'
              });
            }
          }
        }
      }
      if (node.$type === 'duration' && node.$value && typeof node.$value === 'object') {
        const { durationType, unit } = node.$value;
        if (typeof durationType === 'string' && typeof unit === 'string') {
          const rule = DURATION_UNIT_RULES.find((entry) => entry.pattern.test(durationType));
          if (rule && !rule.units.has(unit)) {
            errors.push({
              code: 'E_DURATION_UNIT_MISMATCH',
              path: `${path}/$value/unit`,
              message: `duration unit ${unit} is invalid for durationType ${durationType}`
            });
          }
        }
      }
      if (node.$type === 'border' && node.$value && typeof node.$value === 'object') {
        validateTokenRefObject(node.$value.color, {
          expectedType: 'color',
          path: `${path}/$value/color/$ref`,
          code: 'E_BORDER_COLOR_TYPE',
          context: 'border color $ref'
        });
        validateTokenRefObject(node.$value.width, {
          expectedType: 'dimension',
          path: `${path}/$value/width/$ref`,
          code: 'E_BORDER_WIDTH_TYPE',
          context: 'border width $ref',
          dimensionType: 'length'
        });
        const stroke = node.$value.strokeStyle;
        if (
          stroke &&
          typeof stroke === 'object' &&
          Object.prototype.hasOwnProperty.call(stroke, '$ref') &&
          typeof stroke.$ref === 'string'
        ) {
          const { type: strokeType } = getTokenTypeInfo(doc, stroke.$ref, new Set());
          const errorBase = {
            code: 'E_BORDER_STROKE_STYLE_TYPE',
            path: `${path}/$value/strokeStyle/$ref`
          };
          if (!strokeType) {
            errors.push({
              ...errorBase,
              message: `border strokeStyle $ref ${stroke.$ref} must resolve to a token that declares $type strokeStyle`
            });
          } else if (strokeType !== 'strokeStyle') {
            errors.push({
              ...errorBase,
              message: `border strokeStyle $ref ${stroke.$ref} has type ${strokeType}, expected strokeStyle`
            });
          }
        }
      }
      if (node.$type === 'component' && node.$value && typeof node.$value === 'object') {
        const slots = node.$value.$slots;
        if (slots && typeof slots === 'object') {
          for (const [slotName, slotToken] of Object.entries(slots)) {
            if (
              slotToken &&
              typeof slotToken === 'object' &&
              typeof slotToken.$ref === 'string' &&
              slotToken.$ref.startsWith('#')
            ) {
              const { type: slotType } = getTokenTypeInfo(doc, slotToken.$ref, new Set());
              if (!slotType) {
                errors.push({
                  code: 'E_COMPONENT_SLOT_UNTYPED',
                  path: `${path}/$value/$slots/${slotName}/$ref`,
                  message: `component slot ${slotName} must resolve to a token that declares $type`
                });
              } else if (slotType === 'component') {
                errors.push({
                  code: 'E_COMPONENT_SLOT_TYPE',
                  path: `${path}/$value/$slots/${slotName}/$ref`,
                  message: `component slot ${slotName} must not reference a component token`
                });
              }
            }
          }
        }
      }
      if (node.$type === 'gradient' && node.$value && typeof node.$value === 'object') {
        const stops = node.$value.stops;
        if (Array.isArray(stops)) {
          let prev = -Infinity;
          stops.forEach((stop, idx) => {
            if (stop && typeof stop === 'object') {
              validateTokenRefObject(stop.color, {
                expectedType: 'color',
                path: `${path}/$value/stops/${idx}/color/$ref`,
                code: 'E_GRADIENT_COLOR_TYPE',
                context: `gradient stop ${idx} color $ref`
              });
            }
            if (stop && typeof stop === 'object' && typeof stop.position === 'number') {
              if (stop.position < prev) {
                errors.push({
                  code: 'E_GRADIENT_STOP_ORDER',
                  path: `${path}/$value/stops/${idx}/position`,
                  message: 'gradient stops must be sorted in ascending order'
                });
              }
              prev = stop.position;
            }
          });
        }
      }
      if (node.$type === 'motion' && node.$value && typeof node.$value === 'object') {
        const { motionType, parameters } = node.$value;
        const motionCategory = getMotionCategory(motionType);
        if (parameters && typeof parameters === 'object') {
          const basePath = `${path}/$value/parameters`;
          if (motionCategory === 'translation') {
            for (const axis of ['x', 'y', 'z']) {
              if (Object.prototype.hasOwnProperty.call(parameters, axis)) {
                validateFunctionValueNode(parameters[axis], 'dimension', `${basePath}/${axis}`);
              }
            }
          } else if (motionCategory === 'rotation') {
            if (Object.prototype.hasOwnProperty.call(parameters, 'angle')) {
              validateFunctionValueNode(parameters.angle, 'dimension', `${basePath}/angle`);
            }
            if (parameters.origin && typeof parameters.origin === 'object') {
              for (const [axis, value] of Object.entries(parameters.origin)) {
                if (typeof value === 'number' && (value < 0 || value > 1)) {
                  errors.push({
                    code: 'E_MOTION_ORIGIN_RANGE',
                    path: `${basePath}/origin/${axis}`,
                    message: 'rotation origin coordinates must be between 0 and 1'
                  });
                }
              }
            }
          } else if (motionCategory === 'path') {
            const points = parameters.points;
            if (Array.isArray(points)) {
              if (points.length > 0) {
                const firstTime = points[0]?.time;
                if (typeof firstTime === 'number' && firstTime !== 0) {
                  errors.push({
                    code: 'E_MOTION_PATH_START',
                    path: `${basePath}/points/0/time`,
                    message: 'motion path must start at time 0'
                  });
                }
                const lastTime = points[points.length - 1]?.time;
                if (typeof lastTime === 'number' && lastTime !== 1) {
                  errors.push({
                    code: 'E_MOTION_PATH_END',
                    path: `${basePath}/points/${points.length - 1}/time`,
                    message: 'motion path must end at time 1'
                  });
                }
              }
              let prevTime = -Infinity;
              points.forEach((point, idx) => {
                const time = point?.time;
                const timePath = `${basePath}/points/${idx}/time`;
                if (typeof time === 'number') {
                  if (time < 0 || time > 1) {
                    errors.push({
                      code: 'E_MOTION_PATH_TIME_RANGE',
                      path: timePath,
                      message: 'motion path keyframe time must be between 0 and 1'
                    });
                  }
                  if (time < prevTime) {
                    errors.push({
                      code: 'E_MOTION_PATH_ORDER',
                      path: timePath,
                      message: 'motion path keyframes must increase monotonically'
                    });
                  }
                  prevTime = time;
                }
                if (point?.position && typeof point.position === 'object') {
                  for (const axis of ['x', 'y', 'z']) {
                    if (Object.prototype.hasOwnProperty.call(point.position, axis)) {
                      validateFunctionValueNode(
                        point.position[axis],
                        'dimension',
                        `${basePath}/points/${idx}/position/${axis}`
                      );
                    }
                  }
                }
                if (typeof point?.easing === 'string') {
                  const { type: easingType } = getTokenTypeInfo(doc, point.easing, new Set());
                  if (easingType && easingType !== 'easing') {
                    errors.push({
                      code: 'E_MOTION_PATH_EASING_TYPE',
                      path: `${basePath}/points/${idx}/easing`,
                      message: `motion path easing ${point.easing} must reference an easing token`
                    });
                  }
                }
              });
            }
          }
        }
      }
      if (node.$type === 'shadow' && node.$value && typeof node.$value === 'object') {
        const checkShadowDimension = (dimension, prop) => {
          if (!dimension || typeof dimension !== 'object' || Array.isArray(dimension)) {
            return;
          }
          if (typeof dimension.$ref === 'string') {
            validateTokenRefObject(dimension, {
              expectedType: 'dimension',
              path: `${path}/$value/${prop}/$ref`,
              code: 'E_SHADOW_DIMENSION_TYPE',
              context: `shadow ${prop} $ref`,
              dimensionType: 'length',
              dimensionMessage: `shadow ${prop} $ref ${dimension.$ref} dimensionType must be "length"`
            });
            return;
          }
          if (dimension.dimensionType !== 'length') {
            errors.push({
              code: 'E_SHADOW_DIMENSION_TYPE',
              path: `${path}/$value/${prop}/dimensionType`,
              message: `${prop} dimensionType must be "length"`
            });
          }
        };
        checkShadowDimension(node.$value.offsetX, 'offsetX');
        checkShadowDimension(node.$value.offsetY, 'offsetY');
        checkShadowDimension(node.$value.blur, 'blur');
        checkShadowDimension(node.$value.spread, 'spread');
        validateTokenRefObject(node.$value.color, {
          expectedType: 'color',
          path: `${path}/$value/color/$ref`,
          code: 'E_SHADOW_COLOR_TYPE',
          context: 'shadow color $ref'
        });
      }
      if (node.$type === 'elevation' && node.$value && typeof node.$value === 'object') {
        const checkElevationDimension = (dimension, prop) => {
          const basePath = `${path}/$value/${prop}`;
          if (!dimension || typeof dimension !== 'object' || Array.isArray(dimension)) {
            errors.push({
              code: 'E_ELEVATION_DIMENSION_TYPE',
              path: basePath,
              message: `${prop} must be a length dimension object`
            });
            return;
          }
          if (typeof dimension.$ref === 'string') {
            validateTokenRefObject(dimension, {
              expectedType: 'dimension',
              path: `${basePath}/$ref`,
              code: 'E_ELEVATION_DIMENSION_TYPE',
              context: `elevation ${prop} $ref`,
              dimensionType: 'length',
              dimensionMessage: `elevation ${prop} $ref ${dimension.$ref} dimensionType must be "length"`
            });
            return;
          }
          if (dimension.dimensionType !== 'length') {
            errors.push({
              code: 'E_ELEVATION_DIMENSION_TYPE',
              path: `${basePath}/dimensionType`,
              message: `${prop} dimensionType must be "length"`
            });
          }
        };
        checkElevationDimension(node.$value.offset, 'offset');
        checkElevationDimension(node.$value.blur, 'blur');
        validateTokenRefObject(node.$value.color, {
          expectedType: 'color',
          path: `${path}/$value/color/$ref`,
          code: 'E_ELEVATION_COLOR_TYPE',
          context: 'elevation color $ref'
        });
      }
      if (node.$type === 'fontFace' && node.$value && typeof node.$value === 'object') {
        const fs = node.$value.fontStyle;
        if (typeof fs === 'string' && !isValidFontStyle(fs)) {
          errors.push({
            code: 'E_INVALID_KEYWORD',
            path: `${path}/$value/fontStyle`,
            message: 'invalid keyword'
          });
        }
        const fw = node.$value.fontWeight;
        if (typeof fw === 'string' && !isValidFontWeightString(fw)) {
          errors.push({
            code: 'E_INVALID_KEYWORD',
            path: `${path}/$value/fontWeight`,
            message: 'invalid keyword'
          });
        }
        const fst = node.$value.fontStretch;
        if (typeof fst === 'string' && !isValidFontStretch(fst)) {
          errors.push({
            code: 'E_INVALID_KEYWORD',
            path: `${path}/$value/fontStretch`,
            message: 'invalid keyword'
          });
        }
      }
      if (node.$type === 'typography' && node.$value && typeof node.$value === 'object') {
        const fontSize = node.$value.fontSize;
        if (fontSize && typeof fontSize === 'object' && !Array.isArray(fontSize)) {
          if (typeof fontSize.$ref === 'string') {
            validateTokenRefObject(fontSize, {
              expectedType: 'dimension',
              path: `${path}/$value/fontSize/$ref`,
              code: 'E_FONT_SIZE_DIMENSION_TYPE',
              context: 'typography fontSize $ref',
              dimensionType: 'length',
              dimensionMessage: `typography fontSize $ref ${fontSize.$ref} dimensionType must be "length"`
            });
          } else if (fontSize.dimensionType !== 'length') {
            errors.push({
              code: 'E_FONT_SIZE_DIMENSION_TYPE',
              path: `${path}/$value/fontSize/dimensionType`,
              message: 'fontSize dimensionType must be "length"'
            });
          }
        }
        validateTokenRefObject(node.$value.color, {
          expectedType: 'color',
          path: `${path}/$value/color/$ref`,
          code: 'E_TYPOGRAPHY_COLOR_TYPE',
          context: 'typography color $ref'
        });
        const ls = node.$value.letterSpacing;
        if (typeof ls === 'string' && ls !== 'normal') {
          errors.push({
            code: 'E_INVALID_KEYWORD',
            path: `${path}/$value/letterSpacing`,
            message: 'invalid keyword'
          });
        } else if (
          ls &&
          typeof ls === 'object' &&
          !Array.isArray(ls) &&
          typeof ls.$ref === 'string'
        ) {
          validateTokenRefObject(ls, {
            expectedType: 'dimension',
            path: `${path}/$value/letterSpacing/$ref`,
            code: 'E_LETTER_SPACING_DIMENSION_TYPE',
            context: 'letterSpacing $ref',
            dimensionType: 'length',
            dimensionMessage: `letterSpacing $ref ${ls.$ref} dimensionType must be "length"`
          });
        }
        const ws = node.$value.wordSpacing;
        if (typeof ws === 'string') {
          if (ws !== 'normal') {
            errors.push({
              code: 'E_INVALID_KEYWORD',
              path: `${path}/$value/wordSpacing`,
              message: 'invalid keyword'
            });
          }
        } else if (ws && typeof ws === 'object') {
          if (typeof ws.$ref === 'string') {
            validateTokenRefObject(ws, {
              expectedType: 'dimension',
              path: `${path}/$value/wordSpacing/$ref`,
              code: 'E_WORD_SPACING_DIMENSION_TYPE',
              context: 'wordSpacing $ref',
              dimensionType: 'length',
              dimensionMessage: `wordSpacing $ref ${ws.$ref} dimensionType must be "length"`
            });
          } else {
            const dimensionType = ws.dimensionType;
            if (typeof dimensionType === 'string' && dimensionType !== 'length') {
              errors.push({
                code: 'E_WORD_SPACING_DIMENSION_TYPE',
                path: `${path}/$value/wordSpacing/dimensionType`,
                message: 'wordSpacing dimensionType must be "length"'
              });
            }
          }
        }
        const lineHeightValue = node.$value.lineHeight;
        if (
          lineHeightValue &&
          typeof lineHeightValue === 'object' &&
          !Array.isArray(lineHeightValue) &&
          typeof lineHeightValue.$ref === 'string'
        ) {
          validateTokenRefObject(lineHeightValue, {
            expectedType: 'dimension',
            path: `${path}/$value/lineHeight/$ref`,
            code: 'E_LINE_HEIGHT_DIMENSION_TYPE',
            context: 'lineHeight $ref',
            dimensionType: 'length',
            dimensionMessage: `lineHeight $ref ${lineHeightValue.$ref} dimensionType must be "length"`
          });
        }
        const fontVariant = node.$value.fontVariant;
        if (typeof fontVariant === 'string' && !isValidFontVariant(fontVariant)) {
          errors.push({
            code: 'E_INVALID_KEYWORD',
            path: `${path}/$value/fontVariant`,
            message: 'invalid keyword'
          });
        }
        const fontStretch = node.$value.fontStretch;
        if (typeof fontStretch === 'string' && !isValidFontStretch(fontStretch)) {
          errors.push({
            code: 'E_INVALID_KEYWORD',
            path: `${path}/$value/fontStretch`,
            message: 'invalid keyword'
          });
        }
        const fw = node.$value.fontWeight;
        if (typeof fw === 'string' && !isValidFontWeightString(fw)) {
          errors.push({
            code: 'E_INVALID_KEYWORD',
            path: `${path}/$value/fontWeight`,
            message: 'invalid keyword'
          });
        }
        const fontFeatures = node.$value.fontFeatures;
        if (Array.isArray(fontFeatures)) {
          fontFeatures.forEach((feature, idx) => {
            if (typeof feature === 'string' && !FONT_FEATURE_TAG_PATTERN.test(feature)) {
              errors.push({
                code: 'E_INVALID_KEYWORD',
                path: `${path}/$value/fontFeatures/${idx}`,
                message: 'invalid keyword'
              });
            }
          });
        }
        const fs = node.$value.fontStyle;
        if (typeof fs === 'string' && !isValidFontStyle(fs)) {
          errors.push({
            code: 'E_INVALID_KEYWORD',
            path: `${path}/$value/fontStyle`,
            message: 'invalid keyword'
          });
        }
      }
      validateFunctionValueNode(node.$value, node.$type, `${path}/$value`);
      for (const [key, val] of Object.entries(node)) {
        walk(val, `${path}/${key}`);
      }
    }
  }

  walk(doc, '');
  return { valid: errors.length === 0, errors };
}
