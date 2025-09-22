#!/usr/bin/env node
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { createSession } from '../session.js';
import { parseArguments } from './args.js';
import { gatherInputs } from './io.js';
import { printPrettyOutput } from './output.js';
import { createDiagnosticSummary, serializeDiagnostic, serializeResolution } from './serialize.js';
import type { CliIo, CliOutput, CliRunOptions, ResolutionSummary } from './types.js';

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = require('../../package.json') as { readonly version?: string };

export async function runCli(
  args: readonly string[],
  options: CliRunOptions = {}
): Promise<number> {
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

  const session = createSession({
    allowHttp: cliOptions.allowHttp,
    maxDepth: cliOptions.maxDepth,
    overrideContext: cliOptions.context
  });

  const collection = await session.parseCollection(gatherResult.inputs);

  let exitCode = collection.diagnostics.hasErrors() ? 1 : 0;
  let resolutionError = false;

  const documents: CliOutput['documents'] = collection.results.map((result) => {
    const uri = result.document?.uri?.href ?? null;
    const diagnostics = result.diagnostics.toArray().map(serializeDiagnostic);
    const diagnosticCounts = createDiagnosticSummary(result.diagnostics);
    const resolverAvailable = Boolean(result.resolver);
    let resolutions: Record<string, ResolutionSummary> | undefined;

    if (resolverAvailable && cliOptions.pointers.length > 0 && result.resolver) {
      resolutions = {};
      for (const pointer of cliOptions.pointers) {
        const resolution = result.resolver.resolve(pointer);
        const summary = serializeResolution(pointer, resolution);
        if (
          resolution.diagnostics.some((diagnostic) => diagnostic.severity === 'error') ||
          (resolution.token &&
            resolution.token.warnings.some((warning) => warning.severity === 'error'))
        ) {
          resolutionError = true;
        }
        resolutions[pointer] = summary;
      }
    }

    return {
      uri,
      diagnostics,
      diagnosticCounts,
      resolverAvailable,
      resolutions
    };
  });

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
    printPrettyOutput(output, cliOptions.pointers, io.stdout);
  }

  if (resolutionError) {
    exitCode = 1;
  }

  return exitCode;
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
    (error) => {
      console.error(error);
      process.exit(1);
    }
  );
}
