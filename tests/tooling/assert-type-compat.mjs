import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '../../schema/core.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const schemaId = schema.$id || 'https://dtif.lapidist.net/schema/core.json';
const ajv = new Ajv({ allErrors: true, strict: false });
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
  if (typeof node.$type === 'string') {
    return { node, type: node.$type };
  }
  if (typeof node.$ref === 'string' && node.$ref.startsWith('#') && !seen.has(pointer)) {
    seen.add(pointer);
    return getTokenTypeInfo(root, node.$ref, seen);
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
      if (node.$type === 'fontFace' && node.$value && typeof node.$value === 'object') {
        const fw = node.$value.fontWeight;
        if (typeof fw === 'string' && !isValidFontWeightString(fw)) {
          errors.push({
            code: 'E_INVALID_KEYWORD',
            path: `${path}/$value/fontWeight`,
            message: 'invalid keyword'
          });
        }
      }
      if (node.$type === 'typography' && node.$value && typeof node.$value === 'object') {
        const ls = node.$value.letterSpacing;
        if (typeof ls === 'string' && ls !== 'normal') {
          errors.push({
            code: 'E_INVALID_KEYWORD',
            path: `${path}/$value/letterSpacing`,
            message: 'invalid keyword'
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
          const dimensionType = ws.dimensionType;
          if (typeof dimensionType === 'string' && dimensionType !== 'length') {
            errors.push({
              code: 'E_WORD_SPACING_DIMENSION_TYPE',
              path: `${path}/$value/wordSpacing/dimensionType`,
              message: 'wordSpacing dimensionType must be "length"'
            });
          }
        }
        const fw = node.$value.fontWeight;
        if (typeof fw === 'string' && !isValidFontWeightString(fw)) {
          errors.push({
            code: 'E_INVALID_KEYWORD',
            path: `${path}/$value/fontWeight`,
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
