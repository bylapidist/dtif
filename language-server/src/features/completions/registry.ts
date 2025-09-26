import registryTypesJson from '../../../../registry/types.json' with { type: 'json' };
import { isRecord } from '../../core/utils/object.js';

export interface RegistryTypeDefinition {
  readonly vendor: string;
  readonly owner?: string;
  readonly contact?: string;
  readonly spec?: string;
  readonly canonical?: readonly string[];
  readonly extensions?: string;
}

const registryTypes = parseRegistryTypes(registryTypesJson);

export function getRegistryTypes(): ReadonlyMap<string, RegistryTypeDefinition> {
  return registryTypes;
}

function parseRegistryTypes(value: unknown): ReadonlyMap<string, RegistryTypeDefinition> {
  if (!isRecord(value)) {
    return new Map();
  }

  const entries = Object.entries(value);
  const result = new Map<string, RegistryTypeDefinition>();
  for (const [key, definition] of entries) {
    if (isRegistryTypeDefinition(definition)) {
      result.set(key, definition);
    }
  }
  return result;
}

function isRegistryTypeDefinition(value: unknown): value is RegistryTypeDefinition {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.vendor === 'string';
}
