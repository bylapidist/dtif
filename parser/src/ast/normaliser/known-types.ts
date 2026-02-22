import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const CORE_SCHEMA: unknown = require('@lapidist/dtif-schema/core.json');

const KNOWN_TYPES = collectKnownTypes(CORE_SCHEMA);

export function isKnownTokenType(value: string): boolean {
  return KNOWN_TYPES.has(value);
}

function collectKnownTypes(schema: unknown): ReadonlySet<string> {
  const known = new Set<string>();
  walkSchemaForTypeConsts(schema, known);

  return known;
}

function walkSchemaForTypeConsts(value: unknown, known: Set<string>): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      walkSchemaForTypeConsts(entry, known);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const typeProperty = value.$type;
  if (isRecord(typeProperty)) {
    const typeConst = typeProperty.const;
    if (typeof typeConst === 'string' && typeConst.length > 0) {
      known.add(typeConst);
    }
  }

  for (const nested of Object.values(value)) {
    walkSchemaForTypeConsts(nested, known);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
