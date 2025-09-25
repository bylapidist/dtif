import { normalizeJsonPointer } from '../utils/json-pointer.js';
import type { CliArguments, CliOptions } from './types.js';
import type { JsonPointer } from '../types.js';

const DEFAULT_INPUTS: readonly string[] = [];
const DEFAULT_POINTERS: readonly JsonPointer[] = [];
const DEFAULT_CONTEXT: ReadonlyMap<string, unknown> = new Map();

const DEFAULT_CLI_OPTIONS: CliOptions = {
  inputs: DEFAULT_INPUTS,
  allowHttp: false,
  format: 'pretty',
  pointers: DEFAULT_POINTERS,
  context: DEFAULT_CONTEXT
};

export function parseArguments(args: readonly string[]): CliArguments {
  const options: {
    inputs: string[];
    allowHttp: boolean;
    maxDepth?: number;
    format: 'pretty' | 'json';
    context: Map<string, unknown>;
  } = {
    inputs: [...DEFAULT_CLI_OPTIONS.inputs],
    allowHttp: DEFAULT_CLI_OPTIONS.allowHttp,
    maxDepth: DEFAULT_CLI_OPTIONS.maxDepth,
    format: DEFAULT_CLI_OPTIONS.format,
    context: new Map(DEFAULT_CLI_OPTIONS.context)
  };
  const pointerStrings: string[] = [];

  let index = 0;
  let parsingOptions = true;

  while (index < args.length) {
    const raw = args[index];

    if (parsingOptions && raw === '--') {
      parsingOptions = false;
      index++;
      continue;
    }

    if (parsingOptions && (raw === '--help' || raw === '-h')) {
      return { kind: 'help' };
    }

    if (parsingOptions && (raw === '--version' || raw === '-v')) {
      return { kind: 'version' };
    }

    if (parsingOptions && (raw === '--json' || raw === '--format=json')) {
      options.format = 'json';
      index++;
      continue;
    }

    if (parsingOptions && raw.startsWith('--format=')) {
      const value = raw.slice('--format='.length);
      const normalized = value.toLowerCase();
      if (normalized !== 'pretty' && normalized !== 'json') {
        return { kind: 'error', message: `Unsupported format "${value}".` };
      }
      options.format = normalized;
      index++;
      continue;
    }

    if (parsingOptions && raw === '--format') {
      const value = args[index + 1];
      if (!value) {
        return { kind: 'error', message: '--format requires a value of "pretty" or "json".' };
      }
      const normalized = value.toLowerCase();
      if (normalized !== 'pretty' && normalized !== 'json') {
        return { kind: 'error', message: `Unsupported format "${value}".` };
      }
      options.format = normalized;
      index += 2;
      continue;
    }

    if (parsingOptions && (raw === '--allow-http' || raw === '--allow-http=true')) {
      options.allowHttp = true;
      index++;
      continue;
    }

    if (parsingOptions && raw.startsWith('--allow-http=')) {
      const value = raw.slice('--allow-http='.length);
      const normalized = value.toLowerCase();
      if (normalized === 'true') {
        options.allowHttp = true;
        index++;
        continue;
      }
      if (normalized === 'false') {
        options.allowHttp = false;
        index++;
        continue;
      }
      return { kind: 'error', message: `Invalid value for --allow-http: "${value}".` };
    }

    if (parsingOptions && raw === '--max-depth') {
      const value = args[index + 1];
      if (!value) {
        return { kind: 'error', message: '--max-depth requires a numeric value.' };
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { kind: 'error', message: `Invalid --max-depth value "${value}".` };
      }
      options.maxDepth = parsed;
      index += 2;
      continue;
    }

    if (parsingOptions && raw.startsWith('--max-depth=')) {
      const value = raw.slice('--max-depth='.length);
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { kind: 'error', message: `Invalid --max-depth value "${value}".` };
      }
      options.maxDepth = parsed;
      index++;
      continue;
    }

    if (parsingOptions && raw === '--resolve') {
      const value = args[index + 1];
      if (!value) {
        return { kind: 'error', message: '--resolve requires a JSON Pointer argument.' };
      }
      pointerStrings.push(value);
      index += 2;
      continue;
    }

    if (parsingOptions && raw.startsWith('--resolve=')) {
      const value = raw.slice('--resolve='.length);
      if (!value) {
        return { kind: 'error', message: '--resolve requires a JSON Pointer argument.' };
      }
      pointerStrings.push(value);
      index++;
      continue;
    }

    if (parsingOptions && raw === '--context') {
      const value = args[index + 1];
      if (!value) {
        return { kind: 'error', message: '--context requires entries in the form key=value.' };
      }
      const parsedEntry = parseContextEntry(value);
      if ('error' in parsedEntry) {
        return { kind: 'error', message: parsedEntry.error };
      }
      options.context.set(parsedEntry.key, parsedEntry.value);
      index += 2;
      continue;
    }

    if (parsingOptions && raw.startsWith('--context=')) {
      const value = raw.slice('--context='.length);
      const parsedEntry = parseContextEntry(value);
      if ('error' in parsedEntry) {
        return { kind: 'error', message: parsedEntry.error };
      }
      options.context.set(parsedEntry.key, parsedEntry.value);
      index++;
      continue;
    }

    if (parsingOptions && raw.startsWith('-') && raw !== '-') {
      return { kind: 'error', message: `Unknown option "${raw}".` };
    }

    options.inputs.push(raw);
    index++;
  }

  const normalizedPointers = Array.from(
    new Set(pointerStrings.map((pointer) => normalizeJsonPointer(pointer)))
  );

  return {
    kind: 'run',
    options: {
      inputs: options.inputs,
      allowHttp: options.allowHttp,
      maxDepth: options.maxDepth,
      format: options.format,
      pointers: normalizedPointers,
      context: options.context
    }
  };
}

function parseContextEntry(
  input: string
): { readonly key: string; readonly value: unknown } | { readonly error: string } {
  const separator = input.indexOf('=');
  if (separator <= 0) {
    return { error: `Invalid context entry "${input}". Expected key=value.` };
  }
  const key = input.slice(0, separator).trim();
  const rawValue = input.slice(separator + 1);
  if (!key) {
    return { error: 'Context keys must be non-empty.' };
  }
  return { key, value: parseContextValue(rawValue) };
}

function parseContextValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === '') {
    return '';
  }
  const lowered = trimmed.toLowerCase();
  if (lowered === 'true') {
    return true;
  }
  if (lowered === 'false') {
    return false;
  }
  if (lowered === 'null') {
    return null;
  }
  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}
