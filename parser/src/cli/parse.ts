#!/usr/bin/env node
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { createParseDocumentUseCase } from '../application/factory.js';
import { createDocumentRequest } from '../application/requests.js';
import { resolveOptions } from '../session/internal/options.js';
import { parseArguments } from './args.js';
import { gatherInputs } from './io.js';
import { printPrettyOutput } from './output.js';
import { createDiagnosticSummary, serializeDiagnostic, serializeResolution } from './serialize.js';
import type { CliIo, CliOutput, CliRunOptions, ResolutionSummary } from './types.js';
import type { ParseDocumentResult } from '../session.js';
import type { DiagnosticEvent } from '../domain/models.js';

const require = createRequire(import.meta.url);
const PACKAGE_VERSION = getPackageVersion(require('../../package.json'));

function getPackageVersion(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const version: unknown = Reflect.get(value, 'version');
  return typeof version === 'string' ? version : undefined;
}

export async function runCli(
  args: readonly string[],
  options: CliRunOptions = {}
): Promise<number> {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;

  const io: CliIo = {
    stdin,
    stdout,
    stderr
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

  const resolvedOptions = resolveOptions({
    allowHttp: cliOptions.allowHttp,
    maxDepth: cliOptions.maxDepth,
    overrideContext: cliOptions.context
  });

  const documentsUseCase = createParseDocumentUseCase(resolvedOptions);
  const aggregatedDiagnostics: DiagnosticEvent[] = [];
  const executions: DocumentExecution[] = [];
  let exitCode = 0;

  for (const input of gatherResult.inputs) {
    const request = createDocumentRequest(input);
    const execution = await documentsUseCase.execute({ request });
    const diagnostics = [...execution.diagnostics];
    if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
      exitCode = 1;
    }
    aggregatedDiagnostics.push(...diagnostics);
    executions.push({ execution, diagnostics });
  }

  const documents: CliOutput['documents'] = executions.map(({ execution, diagnostics }) => {
    const uri = execution.document?.identity.uri.href ?? null;
    const diagnosticList = diagnostics.map(serializeDiagnostic);
    const diagnosticCounts = createDiagnosticSummary(diagnostics);
    const resolver = execution.resolution?.result;
    const resolverAvailable = Boolean(resolver);
    let resolutions: Record<string, ResolutionSummary> | undefined;

    if (resolver && cliOptions.pointers.length > 0) {
      resolutions = {};
      for (const pointer of cliOptions.pointers) {
        const resolution = resolver.resolve(pointer);
        const summary = serializeResolution(pointer, resolution);
        if (
          resolution.diagnostics.some((diagnostic) => diagnostic.severity === 'error') ||
          (resolution.token?.warnings.some((warning) => warning.severity === 'error') ?? false)
        ) {
          exitCode = 1;
        }
        resolutions[pointer] = summary;
      }
    }

    return {
      uri,
      diagnostics: diagnosticList,
      diagnosticCounts,
      resolverAvailable,
      resolutions
    };
  });

  const diagnostics = aggregatedDiagnostics.map(serializeDiagnostic);
  const summary = createDiagnosticSummary(aggregatedDiagnostics);
  if (summary.error > 0) {
    exitCode = 1;
  }

  const output: CliOutput = {
    documents,
    diagnostics,
    summary
  };

  if (cliOptions.format === 'json') {
    io.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    printPrettyOutput(output, cliOptions.pointers, io.stdout);
  }

  return exitCode;
}

interface DocumentExecution {
  readonly execution: ParseDocumentResult;
  readonly diagnostics: readonly DiagnosticEvent[];
}

function formatUsage(): string {
  return (
    `Usage: dtif-parse [options] [file ...]\n\n` +
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
    'force reading from stdin explicitly alongside file paths.\n'
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runCli(process.argv.slice(2)).then(
    (code) => {
      process.exit(code);
    },
    (error: unknown) => {
      console.error(error);
      process.exit(1);
    }
  );
}
