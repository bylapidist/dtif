#!/usr/bin/env node
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { createSession } from '../session.js';
import { normalizeJsonPointer } from '../utils/json-pointer.js';
import type {
  Diagnostic,
  DiagnosticSeverity,
  JsonPointer,
  ParseInput,
  SourcePosition,
  SourceSpan
} from '../types.js';
import type { AppliedOverride, ResolutionResult, ResolvedToken } from '../resolver/index.js';

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = require('../../package.json') as { readonly version?: string };

interface CliOptions {
  readonly inputs: readonly string[];
  readonly allowHttp: boolean;
  readonly maxDepth?: number;
  readonly format: 'pretty' | 'json';
  readonly pointers: readonly string[];
  readonly context: ReadonlyMap<string, unknown>;
}

interface CliArgumentsResult {
  readonly kind: 'run';
  readonly options: CliOptions;
}

interface CliHelpResult {
  readonly kind: 'help';
}

interface CliVersionResult {
  readonly kind: 'version';
}

interface CliErrorResult {
  readonly kind: 'error';
  readonly message: string;
}

interface CliIo {
  readonly stdin: NodeJS.ReadableStream;
  readonly stdout: NodeJS.WritableStream;
  readonly stderr: NodeJS.WritableStream;
}

interface CliRunOptions {
  readonly stdin?: NodeJS.ReadableStream;
  readonly stdout?: NodeJS.WritableStream;
  readonly stderr?: NodeJS.WritableStream;
}

interface DiagnosticsSummary {
  readonly total: number;
  readonly error: number;
  readonly warning: number;
  readonly info: number;
}

interface SerializablePosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

interface SerializableSpan {
  readonly uri: string;
  readonly start: SerializablePosition;
  readonly end: SerializablePosition;
}

interface SerializableDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: DiagnosticSeverity;
  readonly pointer?: JsonPointer;
  readonly span?: SerializableSpan;
  readonly related?: readonly SerializableRelatedInformation[];
}

interface SerializableRelatedInformation {
  readonly message: string;
  readonly pointer?: JsonPointer;
  readonly span?: SerializableSpan;
}

interface SerializableResolutionSource {
  readonly uri: string;
  readonly pointer: JsonPointer;
  readonly span?: SerializableSpan;
}

interface SerializableAppliedOverride {
  readonly pointer: JsonPointer;
  readonly kind: AppliedOverride['kind'];
  readonly depth: number;
  readonly span?: SerializableSpan;
  readonly source?: SerializableResolutionSource;
}

interface SerializableTraceStep {
  readonly pointer: JsonPointer;
  readonly kind: 'token' | 'alias' | 'override' | 'fallback';
  readonly span?: SerializableSpan;
}

interface SerializableResolvedToken {
  readonly pointer: JsonPointer;
  readonly uri: string;
  readonly type?: string;
  readonly value?: unknown;
  readonly source?: SerializableResolutionSource;
  readonly overridesApplied: readonly SerializableAppliedOverride[];
  readonly warnings: readonly SerializableDiagnostic[];
  readonly trace: readonly SerializableTraceStep[];
}

interface ResolutionSummary {
  readonly pointer: JsonPointer;
  readonly token?: SerializableResolvedToken;
  readonly diagnostics: readonly SerializableDiagnostic[];
}

interface DocumentSummary {
  readonly uri: string | null;
  readonly diagnostics: readonly SerializableDiagnostic[];
  readonly diagnosticCounts: DiagnosticsSummary;
  readonly resolverAvailable: boolean;
  readonly resolutions?: Readonly<Record<string, ResolutionSummary>>;
}

interface CliOutput {
  readonly documents: readonly DocumentSummary[];
  readonly diagnostics: readonly SerializableDiagnostic[];
  readonly summary: DiagnosticsSummary;
}

type CliArguments = CliArgumentsResult | CliHelpResult | CliVersionResult | CliErrorResult;

const DEFAULT_CLI_OPTIONS: CliOptions = {
  inputs: [],
  allowHttp: false,
  format: 'pretty',
  pointers: [],
  context: new Map()
};

export async function runCli(args: readonly string[], options: CliRunOptions = {}): Promise<number> {
  const io: CliIo = {
    stdin: options.stdin ?? process.stdin,
    stdout: options.stdout ?? process.stdout,
    stderr: options.stderr ?? process.stderr
  };

  const parsed = parseArguments(args);

  switch (parsed.kind) {
    case 'help': {
      io.stdout.write(formatUsage());
      return 0;
    }
    case 'version': {
      io.stdout.write(`${PACKAGE_VERSION ?? '0.0.0'}\n`);
      return 0;
    }
    case 'error': {
      io.stderr.write(`Error: ${parsed.message}\n`);
      io.stderr.write('\n');
      io.stderr.write(formatUsage());
      return 1;
    }
    case 'run':
      break;
    default: {
      const exhaustive: never = parsed;
      throw new Error(`Unhandled CLI arguments kind: ${String(exhaustive)}`);
    }
  }

  const { options: cliOptions } = parsed;
  const gatherResult = await gatherInputs(cliOptions.inputs, io);

  if (gatherResult.errors.length > 0) {
    for (const message of gatherResult.errors) {
      io.stderr.write(`Error: ${message}\n`);
    }
    io.stderr.write('\n');
    io.stderr.write(formatUsage());
    return 1;
  }

  if (gatherResult.inputs.length === 0) {
    io.stderr.write('Error: No input provided. Pass a file path or pipe a document via stdin.\n');
    io.stderr.write('\n');
    io.stderr.write(formatUsage());
    return 1;
  }

  const normalizedPointers = Array.from(new Set(cliOptions.pointers.map(normalizeJsonPointer)));

  const session = createSession({
    allowHttp: cliOptions.allowHttp,
    maxDepth: cliOptions.maxDepth,
    overrideContext: cliOptions.context
  });

  const collection = await session.parseCollection(gatherResult.inputs);

  let exitCode = collection.diagnostics.hasErrors() ? 1 : 0;
  let resolutionError = false;

  const documents: DocumentSummary[] = [];

  for (const result of collection.results) {
    const uri = result.document?.uri?.href ?? null;
    const diagnostics = result.diagnostics.toArray().map(serializeDiagnostic);
    const diagnosticCounts = createDiagnosticSummary(result.diagnostics);
    const resolverAvailable = Boolean(result.resolver);
    let resolutions: Record<string, ResolutionSummary> | undefined;

    if (resolverAvailable && normalizedPointers.length > 0 && result.resolver) {
      resolutions = {};
      for (const pointer of normalizedPointers) {
        const resolution = result.resolver.resolve(pointer);
        const summary = serializeResolution(pointer, resolution);
        if (
          resolution.diagnostics.some((diagnostic) => diagnostic.severity === 'error') ||
          summary.token?.warnings.some((diagnostic) => diagnostic.severity === 'error')
        ) {
          resolutionError = true;
        }
        resolutions[pointer] = summary;
      }
    }

    documents.push({
      uri,
      diagnostics,
      diagnosticCounts,
      resolverAvailable,
      resolutions
    });
  }

  const diagnostics = collection.diagnostics.toArray().map(serializeDiagnostic);
  const summary = createDiagnosticSummary(collection.diagnostics);

  const output: CliOutput = {
    documents,
    diagnostics,
    summary
  };

  if (cliOptions.format === 'json') {
    io.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    printPrettyOutput(output, normalizedPointers, io.stdout);
  }

  if (resolutionError) {
    exitCode = 1;
  }

  return exitCode;
}

function parseArguments(args: readonly string[]): CliArguments {
  const options: {
    inputs: string[];
    allowHttp: boolean;
    maxDepth?: number;
    format: 'pretty' | 'json';
    pointers: string[];
    context: Map<string, unknown>;
  } = {
    inputs: [...DEFAULT_CLI_OPTIONS.inputs],
    allowHttp: DEFAULT_CLI_OPTIONS.allowHttp,
    maxDepth: DEFAULT_CLI_OPTIONS.maxDepth,
    format: DEFAULT_CLI_OPTIONS.format,
    pointers: [...DEFAULT_CLI_OPTIONS.pointers],
    context: new Map(DEFAULT_CLI_OPTIONS.context)
  };

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
      options.pointers.push(value);
      index += 2;
      continue;
    }

    if (parsingOptions && raw.startsWith('--resolve=')) {
      const value = raw.slice('--resolve='.length);
      if (!value) {
        return { kind: 'error', message: '--resolve requires a JSON Pointer argument.' };
      }
      options.pointers.push(value);
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

  return {
    kind: 'run',
    options: {
      inputs: options.inputs,
      allowHttp: options.allowHttp,
      maxDepth: options.maxDepth,
      format: options.format,
      pointers: options.pointers,
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

async function gatherInputs(inputs: readonly string[], io: CliIo): Promise<{ inputs: ParseInput[]; errors: string[] }> {
  const collected: ParseInput[] = [];
  const errors: string[] = [];
  let stdinPromise: Promise<ParseInput | undefined> | undefined;

  const readStdinOnce = async (): Promise<ParseInput | undefined> => {
    if (!stdinPromise) {
      stdinPromise = readFromStream(io.stdin);
    }
    return stdinPromise;
  };

  if (inputs.length === 0) {
    if (isInteractiveStdin(io.stdin)) {
      return { inputs: [], errors: ['No input provided. Pass a file path or use "-" to read from stdin.'] };
    }
    const stdinInput = await readStdinOnce();
    if (stdinInput) {
      collected.push(stdinInput);
    }
    return { inputs: collected, errors };
  }

  for (const entry of inputs) {
    if (entry === '-') {
      const stdinInput = await readStdinOnce();
      if (!stdinInput) {
        errors.push('No data received on stdin.');
      } else {
        collected.push(stdinInput);
      }
      continue;
    }
    collected.push(entry);
  }

  return { inputs: collected, errors };
}

async function readFromStream(stream: NodeJS.ReadableStream): Promise<ParseInput | undefined> {
  const chunks: Uint8Array[] = [];
  let total = 0;

  for await (const chunk of stream) {
    const array =
      chunk instanceof Uint8Array
        ? new Uint8Array(chunk)
        : typeof chunk === 'string'
          ? new TextEncoder().encode(chunk)
          : new TextEncoder().encode(String(chunk));
    chunks.push(array);
    total += array.length;
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  if (bytes.length === 0) {
    return undefined;
  }

  return { content: bytes };
}

function isInteractiveStdin(stream: NodeJS.ReadableStream): boolean {
  const readStream = stream as NodeJS.ReadStream;
  return Boolean(readStream && typeof readStream.isTTY === 'boolean' && readStream.isTTY);
}

function serializeResolution(pointer: JsonPointer, resolution: ResolutionResult): ResolutionSummary {
  return {
    pointer,
    token: resolution.token ? serializeResolvedToken(resolution.token) : undefined,
    diagnostics: resolution.diagnostics.map(serializeDiagnostic)
  };
}

function serializeResolvedToken(token: ResolvedToken): SerializableResolvedToken {
  return {
    pointer: token.pointer,
    uri: token.uri.href,
    type: token.type,
    value: token.value,
    source: token.source ? serializeResolutionSource(token.source) : undefined,
    overridesApplied: token.overridesApplied.map(serializeAppliedOverride),
    warnings: token.warnings.map(serializeDiagnostic),
    trace: token.trace.map(serializeTraceStep)
  };
}

function serializeResolutionSource(source: NonNullable<ResolvedToken['source']>): SerializableResolutionSource {
  return {
    uri: source.uri.href,
    pointer: source.pointer,
    span: serializeSpan(source.span)
  };
}

function serializeAppliedOverride(override: AppliedOverride): SerializableAppliedOverride {
  return {
    pointer: override.pointer,
    kind: override.kind,
    depth: override.depth,
    span: serializeSpan(override.span),
    source: override.source ? serializeResolutionSource(override.source) : undefined
  };
}

function serializeTraceStep(step: ResolvedToken['trace'][number]): SerializableTraceStep {
  return {
    pointer: step.pointer,
    kind: step.kind,
    span: serializeSpan(step.span)
  };
}

function serializeDiagnostic(diagnostic: Diagnostic): SerializableDiagnostic {
  return {
    code: diagnostic.code,
    message: diagnostic.message,
    severity: diagnostic.severity,
    pointer: diagnostic.pointer,
    span: serializeSpan(diagnostic.span),
    related: diagnostic.related?.map(serializeRelatedInformation)
  };
}

function serializeRelatedInformation(
  info: NonNullable<Diagnostic['related']>[number]
): SerializableRelatedInformation {
  return {
    message: info.message,
    pointer: info.pointer,
    span: serializeSpan(info.span)
  };
}

function serializeSpan(span?: SourceSpan): SerializableSpan | undefined {
  if (!span) {
    return undefined;
  }
  return {
    uri: span.uri.href,
    start: serializePosition(span.start),
    end: serializePosition(span.end)
  };
}

function serializePosition(position: SourcePosition): SerializablePosition {
  return {
    offset: position.offset,
    line: position.line,
    column: position.column
  };
}

function createDiagnosticSummary(bag: Iterable<Diagnostic> & {
  count(severity?: DiagnosticSeverity): number;
}): DiagnosticsSummary {
  const error = bag.count('error');
  const warning = bag.count('warning');
  const info = bag.count('info');
  const total = bag.count();
  return { total, error, warning, info };
}

function printPrettyOutput(output: CliOutput, pointers: readonly JsonPointer[], stdout: NodeJS.WritableStream): void {
  const documentCount = output.documents.length;
  stdout.write(`Parsed ${documentCount} document${documentCount === 1 ? '' : 's'}.\n`);
  stdout.write(
    `Summary: ${output.summary.error} error(s), ${output.summary.warning} warning(s), ${output.summary.info} info message(s).\n`
  );

  output.documents.forEach((document, index) => {
    const title = document.uri ?? '<inline document>';
    stdout.write(`\nDocument ${index + 1}: ${title}\n`);
    const { diagnosticCounts } = document;
    if (diagnosticCounts.total === 0) {
      stdout.write('  Diagnostics: none\n');
    } else {
      stdout.write(
        `  Diagnostics: ${diagnosticCounts.error} error(s), ${diagnosticCounts.warning} warning(s), ${diagnosticCounts.info} info message(s)\n`
      );
      for (const diagnostic of document.diagnostics) {
        printDiagnostic('    ', diagnostic, stdout);
      }
    }

    if (pointers.length === 0) {
      return;
    }

    if (!document.resolverAvailable) {
      stdout.write('  Resolutions unavailable (document did not produce a resolver).\n');
      return;
    }

    stdout.write('  Resolutions:\n');
    for (const pointer of pointers) {
      const summary = document.resolutions?.[pointer];
      if (!summary) {
        stdout.write(`    ${pointer}: no data\n`);
        continue;
      }
      printResolutionSummary('    ', summary, stdout);
    }
  });
}

function printDiagnostic(prefix: string, diagnostic: SerializableDiagnostic, stdout: NodeJS.WritableStream): void {
  const header = `${prefix}- [${diagnostic.severity.toUpperCase()}] ${diagnostic.code}: ${diagnostic.message}`;
  const location = diagnostic.pointer ? ` (${diagnostic.pointer})` : '';
  stdout.write(`${header}${location}\n`);
  if (diagnostic.span) {
    stdout.write(`${prefix}  at ${formatSpan(diagnostic.span)}\n`);
  }
  if (diagnostic.related && diagnostic.related.length > 0) {
    stdout.write(`${prefix}  Related information:\n`);
    for (const related of diagnostic.related) {
      const relatedLine = `${prefix}    - ${related.message}`;
      const relatedPointer = related.pointer ? ` (${related.pointer})` : '';
      stdout.write(`${relatedLine}${relatedPointer}\n`);
      if (related.span) {
        stdout.write(`${prefix}      at ${formatSpan(related.span)}\n`);
      }
    }
  }
}

function printResolutionSummary(prefix: string, summary: ResolutionSummary, stdout: NodeJS.WritableStream): void {
  stdout.write(`${prefix}${summary.pointer}\n`);
  const nested = `${prefix}  `;

  if (summary.token) {
    const token = summary.token;
    stdout.write(`${nested}type: ${token.type ?? '(unspecified)'}\n`);
    if (typeof token.value === 'undefined') {
      stdout.write(`${nested}value: <alias>\n`);
    } else {
      printValue(nested, token.value, stdout);
    }
    if (token.source) {
      stdout.write(
        `${nested}source: ${token.source.pointer} (${token.source.uri})${token.source.span ? ` at ${formatSpan(token.source.span)}` : ''}\n`
      );
    }
    if (token.overridesApplied.length > 0) {
      stdout.write(`${nested}overrides:\n`);
      for (const override of token.overridesApplied) {
        stdout.write(
          `${nested}  - ${override.kind} ${override.pointer} (depth ${override.depth})${
            override.span ? ` at ${formatSpan(override.span)}` : ''
          }${override.source ? ` from ${override.source.pointer}` : ''}\n`
        );
      }
    }
    if (token.trace.length > 0) {
      const trace = token.trace.map((step) => `${step.kind}(${step.pointer})`).join(' -> ');
      stdout.write(`${nested}trace: ${trace}\n`);
    }
    if (token.warnings.length > 0) {
      stdout.write(`${nested}warnings:\n`);
      for (const warning of token.warnings) {
        printDiagnostic(`${nested}  `, warning, stdout);
      }
    }
  } else {
    stdout.write(`${nested}unresolved\n`);
  }

  if (summary.diagnostics.length > 0) {
    stdout.write(`${nested}diagnostics:\n`);
    for (const diagnostic of summary.diagnostics) {
      printDiagnostic(`${nested}  `, diagnostic, stdout);
    }
  }
}

function printValue(prefix: string, value: unknown, stdout: NodeJS.WritableStream): void {
  const serialized = JSON.stringify(value, null, 2);
  if (serialized === undefined) {
    stdout.write(`${prefix}value: undefined\n`);
    return;
  }
  const lines = serialized.split('\n');
  stdout.write(`${prefix}value: ${lines[0] ?? ''}\n`);
  for (const line of lines.slice(1)) {
    stdout.write(`${prefix}       ${line}\n`);
  }
}

function formatSpan(span: SerializableSpan): string {
  const start = `${span.start.line}:${span.start.column}`;
  const end = `${span.end.line}:${span.end.column}`;
  if (start === end) {
    return `${span.uri} @ ${start}`;
  }
  return `${span.uri} @ ${start}-${end}`;
}

function formatUsage(): string {
  return `Usage: dtif-parse [options] [file ...]\n\n` +
    'Options:\n' +
    '  --help, -h               Show this usage information.\n' +
    '  --version, -v            Print the parser version.\n' +
    '  --format <pretty|json>   Control output formatting (default: pretty).\n' +
    '  --json                   Shortcut for --format json.\n' +
    '  --resolve <pointer>      Resolve a token at the provided JSON Pointer.\n' +
    '                           Repeat for multiple pointers.\n' +
    '  --context key=value      Provide override context entries.\n' +
    '  --allow-http             Allow HTTP(S) loading in the default loader.\n' +
    '  --max-depth <number>     Set the maximum resolution depth (default: 32).\n' +
    '  --                       Treat all following arguments as input paths.\n' +
    '\n' +
    'Inputs default to reading from stdin when provided via a pipe. Use "-" to\n' +
    'force reading from stdin explicitly alongside file paths.\n';
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runCli(process.argv.slice(2)).then(
    (code) => {
      process.exit(code);
    },
    (error) => {
      console.error(error);
      process.exit(1);
    }
  );
}
