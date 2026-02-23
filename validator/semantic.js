const SUPPORTED_VERSION_MAJOR = 1;
const COLOR_COMPONENT_CHANNELS = new Map([
  ['srgb', 3],
  ['srgb-linear', 3],
  ['display-p3', 3],
  ['a98-rgb', 3],
  ['prophoto-rgb', 3],
  ['rec2020', 3],
  ['lab', 3],
  ['oklab', 3],
  ['lch', 3],
  ['oklch', 3],
  ['xyz', 3],
  ['xyz-d50', 3],
  ['xyz-d65', 3],
  ['hsl', 3],
  ['hwb', 3]
]);
const MOTION_PATH_TYPE_PATTERN = /\.(?:path|offset-path|motion-path)$/i;
const LENGTH_UNITS = new Set([
  '%',
  'cm',
  'mm',
  'q',
  'in',
  'pt',
  'pc',
  'px',
  'em',
  'ex',
  'cap',
  'ch',
  'ic',
  'rem',
  'rex',
  'rcap',
  'rch',
  'ric',
  'lh',
  'rlh',
  'vw',
  'vh',
  'vi',
  'vb',
  'vmin',
  'vmax',
  'svw',
  'svh',
  'svi',
  'svb',
  'svmin',
  'svmax',
  'lvw',
  'lvh',
  'lvi',
  'lvb',
  'lvmin',
  'lvmax',
  'dvw',
  'dvh',
  'dvi',
  'dvb',
  'dvmin',
  'dvmax',
  'cqw',
  'cqh',
  'cqi',
  'cqb',
  'cqmin',
  'cqmax',
  'dp',
  'sp'
]);
const ANGLE_UNITS = new Set(['deg', 'grad', 'rad', 'turn']);
const RESOLUTION_UNITS = new Set(['dpi', 'dpcm', 'dppx', 'x']);
const NUMERIC_UNIT_PATTERN = /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?([a-z%]+)$/i;
const NUMERIC_WITH_OPTIONAL_UNIT_PATTERN =
  /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?([a-z%]*)$/i;

function createSemanticIssue(instancePath, message, code) {
  return {
    instancePath,
    schemaPath: `#/dtif-semantic/${code}`,
    keyword: 'dtifSemantic',
    params: { code },
    message
  };
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkOrder(keys, expected, path, errors) {
  let last = -1;
  for (const key of expected) {
    const idx = keys.indexOf(key);
    if (idx === -1) return;
    if (idx < last) {
      errors.push(createSemanticIssue(path, 'canonical key order violated', 'E_ORDERING'));
      return;
    }
    last = idx;
  }
}

function checkCollectionOrder(node, path, errors) {
  const entries = Object.entries(node).filter(([key]) => !key.startsWith('$'));
  if (entries.length < 2) {
    return;
  }
  const objectEntries = entries.filter(([, value]) => isObject(value));
  if (objectEntries.length < 2) {
    return;
  }
  const keys = objectEntries.map(([key]) => key);
  const sorted = [...keys].sort((a, b) => a.localeCompare(b));
  for (let i = 0; i < keys.length; i += 1) {
    if (keys[i] !== sorted[i]) {
      errors.push(
        createSemanticIssue(
          path,
          'collection members must be sorted lexicographically',
          'E_COLLECTION_ORDER'
        )
      );
      break;
    }
  }
}

function hasPathTraversal(pointer) {
  const hashIndex = pointer.indexOf('#');
  const beforeFragment = hashIndex === -1 ? pointer : pointer.slice(0, hashIndex);
  const [pathBeforeQuery] = beforeFragment.split('?');
  const normalisedPath = pathBeforeQuery
    .replace(/%2f/gi, '/')
    .replace(/%5c/gi, '\\')
    .replace(/%2e/gi, '.');
  return normalisedPath
    .split(/[\\/]/)
    .filter((segment) => segment.length > 0)
    .some((segment) => segment === '..');
}

function resolvePointer(root, pointer, errors, refPath, chain = []) {
  if (typeof pointer !== 'string') {
    errors.push(createSemanticIssue(refPath, 'ref pointer must be a string', 'E_REF_INVALID_TYPE'));
    return null;
  }

  if (!pointer.startsWith('#')) {
    return null;
  }

  if (chain.includes(pointer)) {
    errors.push(
      createSemanticIssue(
        refPath,
        `circular reference ${[...chain, pointer].join(' -> ')}`,
        'E_REF_CIRCULAR'
      )
    );
    return null;
  }

  const parts = pointer
    .slice(1)
    .split('/')
    .filter(Boolean)
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));

  let current = root;
  for (const part of parts) {
    if (isObject(current) && Object.prototype.hasOwnProperty.call(current, part)) {
      current = current[part];
    } else {
      errors.push(
        createSemanticIssue(refPath, `unresolved pointer ${pointer}`, 'E_REF_UNRESOLVED')
      );
      return null;
    }
  }

  if (isObject(current) && typeof current.$ref === 'string' && current.$ref.startsWith('#')) {
    return resolvePointer(root, current.$ref, errors, refPath, [...chain, pointer]);
  }

  return current;
}

function getPointerValue(root, pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('#')) {
    return null;
  }

  const parts = pointer
    .slice(1)
    .split('/')
    .filter(Boolean)
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));

  let current = root;
  for (const part of parts) {
    if (isObject(current) && Object.prototype.hasOwnProperty.call(current, part)) {
      current = current[part];
      continue;
    }
    return null;
  }

  return current;
}

function resolveTokenType(root, pointer, errors, refPath, chain = []) {
  if (typeof pointer !== 'string' || !pointer.startsWith('#')) {
    return null;
  }

  if (chain.includes(pointer)) {
    errors.push(
      createSemanticIssue(
        refPath,
        `circular reference ${[...chain, pointer].join(' -> ')}`,
        'E_REF_CIRCULAR'
      )
    );
    return null;
  }

  const target = getPointerValue(root, pointer);
  if (target === null) {
    errors.push(createSemanticIssue(refPath, `unresolved pointer ${pointer}`, 'E_REF_UNRESOLVED'));
    return null;
  }

  if (isObject(target) && typeof target.$ref === 'string' && target.$ref.startsWith('#')) {
    return resolveTokenType(root, target.$ref, errors, refPath, [...chain, pointer]);
  }

  return isObject(target) && typeof target.$type === 'string' ? target.$type : null;
}

function validateOverrideFallbackTypes(
  root,
  fallback,
  expectedType,
  errors,
  refPath,
  isValueCompatible
) {
  if (Array.isArray(fallback)) {
    fallback.forEach((entry, index) => {
      validateOverrideFallbackTypes(
        root,
        entry,
        expectedType,
        errors,
        `${refPath}/${index}`,
        isValueCompatible
      );
    });
    return;
  }

  if (!isObject(fallback)) {
    return;
  }

  if (typeof fallback.$ref === 'string') {
    const fallbackType = resolveTokenType(root, fallback.$ref, errors, `${refPath}/$ref`);
    if (fallbackType && fallbackType !== expectedType) {
      errors.push(
        createSemanticIssue(
          `${refPath}/$ref`,
          `override fallback ${fallback.$ref} has type ${fallbackType}, expected ${expectedType}`,
          'E_OVERRIDE_TYPE_MISMATCH'
        )
      );
    }
  }

  if (Object.prototype.hasOwnProperty.call(fallback, '$fallback')) {
    validateOverrideFallbackTypes(
      root,
      fallback.$fallback,
      expectedType,
      errors,
      `${refPath}/$fallback`,
      isValueCompatible
    );
  }

  if (
    typeof isValueCompatible === 'function' &&
    Object.prototype.hasOwnProperty.call(fallback, '$value') &&
    !isValueCompatible(expectedType, fallback.$value)
  ) {
    errors.push(
      createSemanticIssue(
        `${refPath}/$value`,
        `override fallback value is incompatible with target type ${expectedType}`,
        'E_OVERRIDE_TYPE_MISMATCH'
      )
    );
  }
}

function isLengthDimensionToken(root, pointer, errors, refPath) {
  const target = resolvePointer(root, pointer, errors, refPath);
  if (!isObject(target)) {
    return false;
  }
  if (typeof target.$type !== 'string' || target.$type !== 'dimension') {
    return false;
  }
  if (!isObject(target.$value)) {
    return false;
  }
  return target.$value.dimensionType === 'length';
}

function validateFunctionParameterTypeCompatibility(root, value, expectedType, errors, path) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      validateFunctionParameterTypeCompatibility(
        root,
        entry,
        expectedType,
        errors,
        `${path}/${String(index)}`
      );
    });
    return;
  }

  if (!isObject(value)) {
    return;
  }

  if (typeof value.$ref === 'string') {
    const refPath = `${path}/$ref`;
    const referenceType = resolveTokenType(root, value.$ref, errors, refPath);
    if (!referenceType) {
      errors.push(
        createSemanticIssue(
          refPath,
          `function parameter ref ${value.$ref} must resolve to a token declaring $type ${expectedType}`,
          'E_FUNCTION_REF_TYPE_MISMATCH'
        )
      );
    } else if (referenceType !== expectedType) {
      errors.push(
        createSemanticIssue(
          refPath,
          `function parameter ref ${value.$ref} has type ${referenceType}, expected ${expectedType}`,
          'E_FUNCTION_REF_TYPE_MISMATCH'
        )
      );
    }
  }

  if (typeof value.fn === 'string' && Array.isArray(value.parameters)) {
    value.parameters.forEach((entry, index) => {
      validateFunctionParameterTypeCompatibility(
        root,
        entry,
        expectedType,
        errors,
        `${path}/parameters/${String(index)}`
      );
    });
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (key === '$ref') {
      continue;
    }
    validateFunctionParameterTypeCompatibility(
      root,
      nested,
      expectedType,
      errors,
      `${path}/${key}`
    );
  }
}

function validateTypographyReferenceTypes(root, value, errors, path) {
  if (!isObject(value)) {
    return;
  }

  const colorField = value.color;
  if (
    isObject(colorField) &&
    typeof colorField.$ref === 'string' &&
    colorField.$ref.startsWith('#')
  ) {
    const refPath = `${path}/color/$ref`;
    const referenceType = resolveTokenType(root, colorField.$ref, errors, refPath);
    if (!referenceType) {
      errors.push(
        createSemanticIssue(
          refPath,
          `typography color ref ${colorField.$ref} must resolve to a token declaring $type color`,
          'E_TYPOGRAPHY_REF_TYPE_MISMATCH'
        )
      );
    } else if (referenceType !== 'color') {
      errors.push(
        createSemanticIssue(
          refPath,
          `typography color ref ${colorField.$ref} has type ${referenceType}, expected color`,
          'E_TYPOGRAPHY_REF_TYPE_MISMATCH'
        )
      );
    }
  }

  const fontFamilyField = value.fontFamily;
  if (
    isObject(fontFamilyField) &&
    typeof fontFamilyField.$ref === 'string' &&
    fontFamilyField.$ref.startsWith('#')
  ) {
    const refPath = `${path}/fontFamily/$ref`;
    const referenceType = resolveTokenType(root, fontFamilyField.$ref, errors, refPath);
    if (!referenceType) {
      errors.push(
        createSemanticIssue(
          refPath,
          `typography fontFamily ref ${fontFamilyField.$ref} must resolve to a token declaring $type font`,
          'E_TYPOGRAPHY_REF_TYPE_MISMATCH'
        )
      );
    } else if (referenceType !== 'font') {
      errors.push(
        createSemanticIssue(
          refPath,
          `typography fontFamily ref ${fontFamilyField.$ref} has type ${referenceType}, expected font`,
          'E_TYPOGRAPHY_REF_TYPE_MISMATCH'
        )
      );
    }
  }

  const lengthDimensionFields = [
    'fontSize',
    'lineHeight',
    'letterSpacing',
    'wordSpacing',
    'underlineThickness',
    'underlineOffset',
    'overlineThickness',
    'overlineOffset'
  ];

  for (const fieldName of lengthDimensionFields) {
    const fieldValue = value[fieldName];
    if (
      !isObject(fieldValue) ||
      typeof fieldValue.$ref !== 'string' ||
      !fieldValue.$ref.startsWith('#')
    ) {
      continue;
    }
    const refPath = `${path}/${fieldName}/$ref`;
    const referenceType = resolveTokenType(root, fieldValue.$ref, errors, refPath);
    if (!referenceType) {
      errors.push(
        createSemanticIssue(
          refPath,
          `typography ${fieldName} ref ${fieldValue.$ref} must resolve to a token declaring $type dimension`,
          'E_TYPOGRAPHY_REF_TYPE_MISMATCH'
        )
      );
      continue;
    }
    if (referenceType !== 'dimension') {
      errors.push(
        createSemanticIssue(
          refPath,
          `typography ${fieldName} ref ${fieldValue.$ref} has type ${referenceType}, expected dimension`,
          'E_TYPOGRAPHY_REF_TYPE_MISMATCH'
        )
      );
      continue;
    }
    if (!isLengthDimensionToken(root, fieldValue.$ref, errors, refPath)) {
      errors.push(
        createSemanticIssue(
          refPath,
          `typography ${fieldName} ref ${fieldValue.$ref} must resolve to a dimension token with $value.dimensionType "length"`,
          'E_TYPOGRAPHY_REF_DIMENSION_KIND'
        )
      );
    }
  }
}

function validateColorComponentCounts(value, errors, path) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      validateColorComponentCounts(entry, errors, `${path}/${String(index)}`);
    });
    return;
  }

  if (!isObject(value)) {
    return;
  }

  if (typeof value.colorSpace === 'string' && Array.isArray(value.components)) {
    const expectedChannels = COLOR_COMPONENT_CHANNELS.get(value.colorSpace.toLowerCase());
    if (typeof expectedChannels === 'number') {
      const actualChannels = value.components.length;
      const validChannelCount =
        actualChannels === expectedChannels || actualChannels === expectedChannels + 1;
      if (!validChannelCount) {
        errors.push(
          createSemanticIssue(
            `${path}/components`,
            `colorSpace "${value.colorSpace}" requires ${String(expectedChannels)} channel values with optional alpha`,
            'E_COLOR_COMPONENT_COUNT'
          )
        );
      }
    }
  }

  for (const [key, nested] of Object.entries(value)) {
    validateColorComponentCounts(nested, errors, `${path}/${key}`);
  }
}

function resolveDimensionUnitCategory(unit) {
  const normalized = unit.toLowerCase();
  if (LENGTH_UNITS.has(normalized)) {
    return 'length';
  }
  if (ANGLE_UNITS.has(normalized)) {
    return 'angle';
  }
  if (RESOLUTION_UNITS.has(normalized)) {
    return 'resolution';
  }
  return undefined;
}

function extractStringUnitCategory(value) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const match = NUMERIC_UNIT_PATTERN.exec(value.trim());
  if (!match) {
    return undefined;
  }
  return resolveDimensionUnitCategory(match[1]);
}

function parseNumericStringWithUnit(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const match = NUMERIC_WITH_OPTIONAL_UNIT_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) {
    return null;
  }

  return {
    value: number,
    unit: match[1].toLowerCase()
  };
}

function validateDimensionFunctionSemantics(value, errors, path) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      validateDimensionFunctionSemantics(entry, errors, `${path}/${String(index)}`);
    });
    return;
  }

  if (!isObject(value)) {
    return;
  }

  if (value.fn === 'calc' && Array.isArray(value.parameters)) {
    const categories = new Set();
    for (const parameter of value.parameters) {
      const category = extractStringUnitCategory(parameter);
      if (category) {
        categories.add(category);
      }
    }

    if (categories.size > 1) {
      errors.push(
        createSemanticIssue(
          `${path}/parameters`,
          'calc mixed incompatible unit categories',
          'E_CALC_UNIT_MISMATCH'
        )
      );
    }
  }

  if (value.fn === 'clamp' && Array.isArray(value.parameters) && value.parameters.length >= 3) {
    const minToken = parseNumericStringWithUnit(value.parameters[0]);
    const maxToken = parseNumericStringWithUnit(value.parameters[2]);

    if (
      minToken &&
      maxToken &&
      minToken.unit.length > 0 &&
      minToken.unit === maxToken.unit &&
      minToken.value > maxToken.value
    ) {
      errors.push(
        createSemanticIssue(
          `${path}/parameters`,
          'clamp min greater than max',
          'E_CLAMP_MIN_GT_MAX'
        )
      );
    }
  }

  for (const [key, nested] of Object.entries(value)) {
    validateDimensionFunctionSemantics(nested, errors, `${path}/${key}`);
  }
}

function validateGradientStopOrder(value, errors, path) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      validateGradientStopOrder(entry, errors, `${path}/${String(index)}`);
    });
    return;
  }

  if (!isObject(value)) {
    return;
  }

  if (Array.isArray(value.stops)) {
    let previous = -Infinity;
    value.stops.forEach((stop, index) => {
      if (!isObject(stop) || typeof stop.position !== 'number') {
        return;
      }

      if (stop.position < previous) {
        errors.push(
          createSemanticIssue(
            `${path}/stops/${String(index)}/position`,
            'gradient stops must be sorted in ascending order',
            'E_GRADIENT_STOP_ORDER'
          )
        );
      }
      previous = stop.position;
    });
  }

  for (const [key, nested] of Object.entries(value)) {
    validateGradientStopOrder(nested, errors, `${path}/${key}`);
  }
}

function validateMotionParameterType(root, value, errors, path, label) {
  if (!isObject(value)) {
    return;
  }

  if (typeof value.$ref === 'string') {
    const refPath = `${path}/$ref`;
    const referenceType = resolveTokenType(root, value.$ref, errors, refPath);
    if (!referenceType) {
      errors.push(
        createSemanticIssue(
          refPath,
          `${label} ref ${value.$ref} must resolve to a token declaring $type dimension`,
          'E_MOTION_PARAMETER_TYPE'
        )
      );
    } else if (referenceType !== 'dimension') {
      errors.push(
        createSemanticIssue(
          refPath,
          `${label} ref ${value.$ref} has type ${referenceType}, expected dimension`,
          'E_MOTION_PARAMETER_TYPE'
        )
      );
    }
  }

  if (typeof value.fn === 'string' && Array.isArray(value.parameters)) {
    validateFunctionParameterTypeCompatibility(root, value, 'dimension', errors, path);
  }
}

function validateMotionRotationAxis(root, value, errors, path) {
  if (
    typeof value.motionType !== 'string' ||
    !/\.(?:rotate(?:[-a-z0-9]*)?|rotation(?:[-a-z0-9]*)?)$/i.test(value.motionType) ||
    !isObject(value.parameters)
  ) {
    return;
  }

  if (isObject(value.parameters.angle)) {
    validateMotionParameterType(
      root,
      value.parameters.angle,
      errors,
      `${path}/parameters/angle`,
      'motion rotation angle'
    );
  }

  if (isObject(value.parameters.axis)) {
    const { x, y, z } = value.parameters.axis;
    if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number') {
      if (x === 0 && y === 0 && z === 0) {
        errors.push(
          createSemanticIssue(
            `${path}/parameters/axis`,
            'rotation axis must include at least one non-zero component',
            'E_MOTION_ROTATION_AXIS_ZERO'
          )
        );
      }
    }
  }
}

function validateMotionPathSemantics(root, value, errors, path) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      validateMotionPathSemantics(root, entry, errors, `${path}/${String(index)}`);
    });
    return;
  }

  if (!isObject(value)) {
    return;
  }

  if (
    typeof value.motionType === 'string' &&
    /\.(?:translate(?:[-a-z0-9]*)?)$/i.test(value.motionType) &&
    isObject(value.parameters)
  ) {
    for (const axis of ['x', 'y', 'z']) {
      if (isObject(value.parameters[axis])) {
        validateMotionParameterType(
          root,
          value.parameters[axis],
          errors,
          `${path}/parameters/${axis}`,
          `motion translation ${axis}`
        );
      }
    }
  }

  if (
    typeof value.motionType === 'string' &&
    MOTION_PATH_TYPE_PATTERN.test(value.motionType) &&
    isObject(value.parameters) &&
    Array.isArray(value.parameters.points)
  ) {
    const points = value.parameters.points;
    const basePath = `${path}/parameters/points`;
    if (points.length > 0) {
      const firstTime = points[0]?.time;
      if (typeof firstTime === 'number' && firstTime !== 0) {
        errors.push(
          createSemanticIssue(
            `${basePath}/0/time`,
            'motion path must start at time 0',
            'E_MOTION_PATH_START'
          )
        );
      }

      const lastIndex = points.length - 1;
      const lastTime = points[lastIndex]?.time;
      if (typeof lastTime === 'number' && lastTime !== 1) {
        errors.push(
          createSemanticIssue(
            `${basePath}/${String(lastIndex)}/time`,
            'motion path must end at time 1',
            'E_MOTION_PATH_END'
          )
        );
      }
    }

    let previousTime = -Infinity;
    points.forEach((point, index) => {
      if (!isObject(point)) {
        return;
      }

      const pointPath = `${basePath}/${String(index)}`;
      if (isObject(point.position)) {
        for (const axis of ['x', 'y', 'z']) {
          if (isObject(point.position[axis])) {
            validateMotionParameterType(
              root,
              point.position[axis],
              errors,
              `${pointPath}/position/${axis}`,
              `motion path position ${axis}`
            );
          }
        }
      }

      if (typeof point.time === 'number') {
        if (point.time < 0 || point.time > 1) {
          errors.push(
            createSemanticIssue(
              `${pointPath}/time`,
              'motion path keyframe time must be between 0 and 1',
              'E_MOTION_PATH_TIME_RANGE'
            )
          );
        }
        if (point.time < previousTime) {
          errors.push(
            createSemanticIssue(
              `${pointPath}/time`,
              'motion path keyframes must increase monotonically',
              'E_MOTION_PATH_ORDER'
            )
          );
        }
        previousTime = point.time;
      }

      if (typeof point.easing === 'string' && point.easing.startsWith('#')) {
        const easingType = resolveTokenType(root, point.easing, errors, `${pointPath}/easing`);
        if (easingType !== 'easing') {
          errors.push(
            createSemanticIssue(
              `${pointPath}/easing`,
              `motion path easing ${point.easing} must reference an easing token`,
              'E_MOTION_PATH_EASING_TYPE'
            )
          );
        }
      }
    });
  }

  validateMotionRotationAxis(root, value, errors, path);

  for (const [key, nested] of Object.entries(value)) {
    validateMotionPathSemantics(root, nested, errors, `${path}/${key}`);
  }
}

function collectOverrideGraph(root) {
  const graph = new Map();
  const tokenIndex = new Map();

  if (!Array.isArray(root?.$overrides)) {
    return { graph, tokenIndex };
  }

  root.$overrides.forEach((override, idx) => {
    if (!isObject(override)) {
      return;
    }
    const token = override.$token;
    if (typeof token !== 'string') {
      return;
    }

    if (!tokenIndex.has(token)) {
      tokenIndex.set(token, idx);
    }

    const addEdge = (ref) => {
      if (typeof ref !== 'string' || !ref.startsWith('#')) {
        return;
      }
      if (!graph.has(token)) {
        graph.set(token, new Set());
      }
      graph.get(token).add(ref);
    };

    const walkFallback = (entry) => {
      if (Array.isArray(entry)) {
        entry.forEach((value) => walkFallback(value));
        return;
      }
      if (!isObject(entry)) {
        return;
      }
      if (typeof entry.$ref === 'string') {
        addEdge(entry.$ref);
      }
      if (Object.prototype.hasOwnProperty.call(entry, '$fallback')) {
        walkFallback(entry.$fallback);
      }
    };

    if (typeof override.$ref === 'string') {
      addEdge(override.$ref);
    }
    if (Object.prototype.hasOwnProperty.call(override, '$fallback')) {
      walkFallback(override.$fallback);
    }
  });

  return { graph, tokenIndex };
}

function detectOverrideCycles(root, errors) {
  const { graph, tokenIndex } = collectOverrideGraph(root);
  if (graph.size === 0) {
    return;
  }

  const visited = new Set();
  const stack = [];
  const inStack = new Set();
  const reported = new Set();

  const dfs = (node) => {
    stack.push(node);
    inStack.add(node);

    const targets = graph.get(node);
    if (targets) {
      for (const ref of targets) {
        if (!graph.has(ref)) {
          continue;
        }
        if (inStack.has(ref)) {
          const startIndex = stack.indexOf(ref);
          const cycle = stack.slice(startIndex);
          cycle.push(ref);
          const signature = cycle.join('->');
          if (!reported.has(signature)) {
            reported.add(signature);
            const first = cycle[0];
            const overrideIndex = tokenIndex.get(first);
            const instancePath =
              typeof overrideIndex === 'number'
                ? `/$overrides/${overrideIndex}/$token`
                : '/$overrides';
            errors.push(
              createSemanticIssue(
                instancePath,
                `override cycle ${cycle.join(' -> ')}`,
                'E_OVERRIDE_CIRCULAR'
              )
            );
          }
        } else if (!visited.has(ref)) {
          dfs(ref);
        }
      }
    }

    stack.pop();
    inStack.delete(node);
    visited.add(node);
  };

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }
}

export function runSemanticValidation(document, options = {}) {
  const {
    allowRemoteReferences = false,
    allowExternalReferences = false,
    knownTypes = new Set(),
    isValueCompatible = undefined
  } = options;
  const errors = [];
  const warnings = [];

  if (!isObject(document)) {
    return { errors, warnings };
  }

  const version = document.$version;
  if (typeof version === 'string') {
    const match = /^([0-9]+)\./.exec(version);
    if (match) {
      const major = Number.parseInt(match[1], 10);
      if (Number.isSafeInteger(major) && major > SUPPORTED_VERSION_MAJOR) {
        warnings.push(
          createSemanticIssue(
            '/$version',
            `major version ${String(major)} is newer than supported major ${String(
              SUPPORTED_VERSION_MAJOR
            )}`,
            'W_FUTURE_VERSION'
          )
        );
      }
    }
  }

  const walk = (node, path = '') => {
    if (Array.isArray(node)) {
      node.forEach((value, index) => walk(value, `${path}/${String(index)}`));
      return;
    }
    if (!isObject(node)) {
      return;
    }

    const keys = Object.keys(node);
    if ('$type' in node && '$value' in node) {
      checkOrder(keys, ['$type', '$value'], path, errors);
    }
    if ('dimensionType' in node && 'value' in node && 'unit' in node) {
      checkOrder(keys, ['dimensionType', 'value', 'unit'], path, errors);
    }
    if ('fn' in node && 'parameters' in node) {
      checkOrder(keys, ['fn', 'parameters'], path, errors);
    }
    if ('colorSpace' in node && 'components' in node) {
      checkOrder(keys, ['colorSpace', 'components'], path, errors);
    }
    checkCollectionOrder(node, path, errors);

    if (typeof node.$type === 'string' && !knownTypes.has(node.$type)) {
      warnings.push(
        createSemanticIssue(`${path}/$type`, `unknown $type "${node.$type}"`, 'W_UNKNOWN_TYPE')
      );
    }

    const validateReference = (pointer, refPath) => {
      if (typeof pointer !== 'string') {
        errors.push(
          createSemanticIssue(refPath, 'ref pointer must be a string', 'E_REF_INVALID_TYPE')
        );
        return;
      }
      if (hasPathTraversal(pointer)) {
        errors.push(
          createSemanticIssue(
            refPath,
            `path traversal not allowed: ${pointer}`,
            'E_REF_PATH_TRAVERSAL'
          )
        );
        return;
      }
      if (!pointer.includes('#')) {
        errors.push(
          createSemanticIssue(
            refPath,
            `ref must include fragment: ${pointer}`,
            'E_REF_MISSING_FRAGMENT'
          )
        );
        return;
      }
      if (!pointer.startsWith('#')) {
        const hashIndex = pointer.indexOf('#');
        const base = hashIndex === -1 ? pointer : pointer.slice(0, hashIndex);
        if (base.startsWith('//') || base.startsWith('\\\\')) {
          errors.push(
            createSemanticIssue(
              refPath,
              `network-path refs are not allowed: ${pointer}`,
              'E_REF_NETWORK_PATH'
            )
          );
          return;
        }
        if (base.startsWith('/') || base.startsWith('\\')) {
          errors.push(
            createSemanticIssue(
              refPath,
              `absolute-path refs are not allowed: ${pointer}`,
              'E_REF_ABSOLUTE_PATH'
            )
          );
          return;
        }
        const schemeMatch = base.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);

        if (!schemeMatch) {
          if (!allowExternalReferences) {
            errors.push(
              createSemanticIssue(
                refPath,
                `external refs require explicit opt-in: ${pointer}`,
                'E_REF_EXTERNAL_UNRESOLVED'
              )
            );
          }
          return;
        }

        const scheme = schemeMatch[1].toLowerCase();
        if (!['http', 'https'].includes(scheme)) {
          errors.push(
            createSemanticIssue(
              refPath,
              `unsupported remote scheme ${pointer}`,
              'E_REF_UNSUPPORTED_SCHEME'
            )
          );
          return;
        }

        if (!allowRemoteReferences) {
          errors.push(
            createSemanticIssue(
              refPath,
              `remote refs not allowed: ${pointer}`,
              'E_REF_REMOTE_DISABLED'
            )
          );
          return;
        }

        if (!allowExternalReferences) {
          errors.push(
            createSemanticIssue(
              refPath,
              `external refs require explicit opt-in: ${pointer}`,
              'E_REF_EXTERNAL_UNRESOLVED'
            )
          );
          return;
        }
        return;
      }
      resolvePointer(document, pointer, errors, refPath);
    };

    if ('$ref' in node) {
      validateReference(node.$ref, `${path}/$ref`);
    }
    if (
      typeof node.$type === 'string' &&
      typeof node.$ref === 'string' &&
      node.$ref.startsWith('#')
    ) {
      const refPath = `${path}/$ref`;
      const referenceType = resolveTokenType(document, node.$ref, errors, refPath);
      if (!referenceType) {
        errors.push(
          createSemanticIssue(
            refPath,
            `reference ${node.$ref} must resolve to a token declaring $type ${node.$type}`,
            'E_REF_TYPE_MISMATCH'
          )
        );
      } else if (referenceType !== node.$type) {
        errors.push(
          createSemanticIssue(
            refPath,
            `reference ${node.$ref} has type ${referenceType}, expected ${node.$type}`,
            'E_REF_TYPE_MISMATCH'
          )
        );
      }
    }
    if ('$token' in node) {
      validateReference(node.$token, `${path}/$token`);
    }

    if (
      typeof node.$type === 'string' &&
      isObject(node.$value) &&
      typeof node.$value.fn === 'string' &&
      Array.isArray(node.$value.parameters)
    ) {
      validateFunctionParameterTypeCompatibility(
        document,
        node.$value,
        node.$type,
        errors,
        `${path}/$value`
      );
    }

    if (node.$type === 'typography' && isObject(node.$value)) {
      validateTypographyReferenceTypes(document, node.$value, errors, `${path}/$value`);
    }

    if (node.$type === 'color') {
      validateColorComponentCounts(node.$value, errors, `${path}/$value`);
    }

    if (node.$type === 'dimension') {
      validateDimensionFunctionSemantics(node.$value, errors, `${path}/$value`);
    }

    if (node.$type === 'gradient') {
      validateGradientStopOrder(node.$value, errors, `${path}/$value`);
    }

    if (node.$type === 'motion') {
      validateMotionPathSemantics(document, node.$value, errors, `${path}/$value`);
    }

    if (isObject(node.$deprecated) && '$replacement' in node.$deprecated) {
      const replacementPath = `${path}/$deprecated/$replacement`;
      const replacement = node.$deprecated.$replacement;
      validateReference(replacement, replacementPath);

      if (
        typeof node.$type === 'string' &&
        typeof replacement === 'string' &&
        replacement.startsWith('#')
      ) {
        const replacementType = resolveTokenType(document, replacement, errors, replacementPath);
        if (!replacementType) {
          errors.push(
            createSemanticIssue(
              replacementPath,
              `deprecated replacement ${replacement} must resolve to a token declaring $type ${node.$type}`,
              'E_DEPRECATED_REPLACEMENT_TYPE'
            )
          );
        } else if (replacementType !== node.$type) {
          errors.push(
            createSemanticIssue(
              replacementPath,
              `deprecated replacement ${replacement} has type ${replacementType}, expected ${node.$type}`,
              'E_DEPRECATED_REPLACEMENT_TYPE'
            )
          );
        }
      }
    }

    if (
      path.startsWith('/$overrides/') &&
      isObject(node) &&
      typeof node.$token === 'string' &&
      node.$token.startsWith('#')
    ) {
      const tokenPath = `${path}/$token`;
      const overrideTargetType = resolveTokenType(document, node.$token, errors, tokenPath);
      if (!overrideTargetType) {
        errors.push(
          createSemanticIssue(
            tokenPath,
            `override target ${node.$token} must resolve to a token declaring $type`,
            'E_OVERRIDE_TARGET_TYPE'
          )
        );
      } else {
        if (typeof node.$ref === 'string') {
          const refPath = `${path}/$ref`;
          const overrideRefType = resolveTokenType(document, node.$ref, errors, refPath);
          if (overrideRefType && overrideRefType !== overrideTargetType) {
            errors.push(
              createSemanticIssue(
                refPath,
                `override reference ${node.$ref} has type ${overrideRefType}, expected ${overrideTargetType}`,
                'E_OVERRIDE_TYPE_MISMATCH'
              )
            );
          }
        }

        if (
          typeof isValueCompatible === 'function' &&
          Object.prototype.hasOwnProperty.call(node, '$value') &&
          !isValueCompatible(overrideTargetType, node.$value)
        ) {
          errors.push(
            createSemanticIssue(
              `${path}/$value`,
              `override value is incompatible with target type ${overrideTargetType}`,
              'E_OVERRIDE_TYPE_MISMATCH'
            )
          );
        }

        if (Object.prototype.hasOwnProperty.call(node, '$fallback')) {
          validateOverrideFallbackTypes(
            document,
            node.$fallback,
            overrideTargetType,
            errors,
            `${path}/$fallback`,
            isValueCompatible
          );
        }
      }
    }

    for (const [key, value] of Object.entries(node)) {
      walk(value, `${path}/${key}`);
    }
  };

  walk(document);
  detectOverrideCycles(document, errors);

  return { errors, warnings };
}
