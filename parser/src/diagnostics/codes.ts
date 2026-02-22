export type DiagnosticCode = `DTIF${number}${number}${number}${number}`;

const DIAGNOSTIC_CODE_PATTERN = /^DTIF\d{4}$/u;

export const DiagnosticDomain = {
  Core: 0,
  Resolver: 1,
  Loader: 2,
  Decoder: 3,
  SchemaGuard: 4,
  Normaliser: 5,
  Graph: 6,
  Outputs: 7,
  Plugins: 8
} as const;

export type DiagnosticDomainKey = keyof typeof DiagnosticDomain;
export type DiagnosticDomainValue = (typeof DiagnosticDomain)[DiagnosticDomainKey];
export type DiagnosticDomainInput = DiagnosticDomainKey | DiagnosticDomainValue;

export function isDiagnosticCode(value: unknown): value is DiagnosticCode {
  return typeof value === 'string' && DIAGNOSTIC_CODE_PATTERN.test(value);
}

export function formatDiagnosticCode(
  domain: DiagnosticDomainInput,
  major: number,
  minor = 0
): DiagnosticCode {
  const domainValue = resolveDiagnosticDomain(domain);

  assertIntegerInRange(domainValue, 0, 9, 'domain');
  assertIntegerInRange(major, 0, 99, 'major');
  assertIntegerInRange(minor, 0, 9, 'minor');

  const domainPart = domainValue.toString();
  const majorPart = major.toString().padStart(2, '0');
  const minorPart = minor.toString();
  const code = `DTIF${domainPart}${majorPart}${minorPart}`;

  if (!isDiagnosticCode(code)) {
    throw new RangeError('Invalid diagnostic code generated: ' + code);
  }

  return code;
}

function resolveDiagnosticDomain(domain: DiagnosticDomainInput): DiagnosticDomainValue {
  if (typeof domain === 'number') {
    return domain;
  }

  if (isDiagnosticDomainKey(domain)) {
    return DiagnosticDomain[domain];
  }

  const domainLabel = typeof domain === 'string' ? domain : String(domain);

  throw new RangeError(`Unknown diagnostic domain: ${domainLabel}`);
}

function assertIntegerInRange(value: number, min: number, max: number, label: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    const minLabel = min.toString();
    const maxLabel = max.toString();

    throw new RangeError(`${label} must be an integer in the range [${minLabel}, ${maxLabel}]`);
  }
}

function isDiagnosticDomainKey(value: unknown): value is DiagnosticDomainKey {
  return typeof value === 'string' && value in DiagnosticDomain;
}

export const DiagnosticCodes = {
  core: {
    INTERNAL_ERROR: formatDiagnosticCode('Core', 0, 0),
    NOT_IMPLEMENTED: formatDiagnosticCode('Core', 0, 1),
    CACHE_FAILED: formatDiagnosticCode('Core', 0, 2)
  },
  loader: {
    FAILED: formatDiagnosticCode('Loader', 0, 0),
    TOO_LARGE: formatDiagnosticCode('Loader', 0, 1)
  },
  decoder: {
    FAILED: formatDiagnosticCode('Decoder', 0, 0)
  },
  schemaGuard: {
    FAILED: formatDiagnosticCode('SchemaGuard', 0, 0),
    INVALID_DOCUMENT: formatDiagnosticCode('SchemaGuard', 1, 0)
  },
  normaliser: {
    FAILED: formatDiagnosticCode('Normaliser', 0, 0),
    INVALID_ROOT: formatDiagnosticCode('Normaliser', 1, 0),
    INVALID_NODE: formatDiagnosticCode('Normaliser', 1, 1),
    INVALID_MEMBER_TYPE: formatDiagnosticCode('Normaliser', 1, 2),
    MISSING_VALUE: formatDiagnosticCode('Normaliser', 2, 0),
    MISSING_ALIAS_TARGET: formatDiagnosticCode('Normaliser', 2, 1),
    ALIAS_MISSING_TYPE: formatDiagnosticCode('Normaliser', 2, 2),
    INVALID_OVERRIDE: formatDiagnosticCode('Normaliser', 3, 0),
    MISSING_REQUIRED_MEMBER: formatDiagnosticCode('Normaliser', 3, 1),
    INVALID_EXTENSIONS: formatDiagnosticCode('Normaliser', 4, 0),
    INVALID_METADATA_COMBINATION: formatDiagnosticCode('Normaliser', 4, 1),
    INVALID_MEMBER_ORDER: formatDiagnosticCode('Normaliser', 4, 2),
    FUTURE_VERSION: formatDiagnosticCode('Normaliser', 4, 3),
    UNKNOWN_TYPE: formatDiagnosticCode('Normaliser', 4, 4)
  },
  graph: {
    FAILED: formatDiagnosticCode('Graph', 0, 0),
    DUPLICATE_POINTER: formatDiagnosticCode('Graph', 1, 0),
    INVALID_REFERENCE: formatDiagnosticCode('Graph', 1, 1),
    MISSING_TARGET: formatDiagnosticCode('Graph', 1, 2),
    INVALID_TARGET_KIND: formatDiagnosticCode('Graph', 1, 3)
  },
  resolver: {
    FAILED: formatDiagnosticCode('Resolver', 0, 0),
    UNKNOWN_POINTER: formatDiagnosticCode('Resolver', 1, 0),
    INVALID_NODE_KIND: formatDiagnosticCode('Resolver', 1, 1),
    CYCLE_DETECTED: formatDiagnosticCode('Resolver', 1, 2),
    EXTERNAL_REFERENCE: formatDiagnosticCode('Resolver', 1, 3),
    MISSING_BASE_VALUE: formatDiagnosticCode('Resolver', 2, 0),
    TARGET_TYPE_MISMATCH: formatDiagnosticCode('Resolver', 2, 1),
    FALLBACK_EXHAUSTED: formatDiagnosticCode('Resolver', 3, 0),
    OVERRIDE_FAILED: formatDiagnosticCode('Resolver', 3, 1),
    MAX_DEPTH_EXCEEDED: formatDiagnosticCode('Resolver', 4, 0)
  },
  plugins: {
    EXTENSION_FAILED: formatDiagnosticCode('Plugins', 0, 0),
    RESOLUTION_FAILED: formatDiagnosticCode('Plugins', 0, 1)
  }
} as const satisfies Record<string, Record<string, DiagnosticCode>>;
