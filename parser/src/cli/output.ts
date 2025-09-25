import type { JsonPointer } from '../types.js';
import { formatSpan } from './serialize.js';
import type {
  CliOutput,
  DiagnosticsSummary,
  ResolutionSummary,
  SerializableDiagnostic,
  SerializableResolvedToken
} from './types.js';

export function printPrettyOutput(
  output: CliOutput,
  pointers: readonly JsonPointer[],
  stdout: NodeJS.WritableStream
): void {
  const documentCount = output.documents.length;
  stdout.write(
    `Parsed ${formatNumber(documentCount)} document${documentCount === 1 ? '' : 's'}.\n`
  );
  stdout.write(
    `Summary: ${formatNumber(output.summary.error)} error(s), ${formatNumber(
      output.summary.warning
    )} warning(s), ${formatNumber(output.summary.info)} info message(s).\n`
  );

  output.documents.forEach((document, index) => {
    const title = document.uri ?? '<inline document>';
    stdout.write(`\nDocument ${formatNumber(index + 1)}: ${title}\n`);
    printDiagnosticsSummary(document.diagnosticCounts, document.diagnostics, stdout);

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

function printDiagnosticsSummary(
  counts: DiagnosticsSummary,
  diagnostics: readonly SerializableDiagnostic[],
  stdout: NodeJS.WritableStream
): void {
  if (counts.total === 0) {
    stdout.write('  Diagnostics: none\n');
    return;
  }

  stdout.write(
    `  Diagnostics: ${formatNumber(counts.error)} error(s), ${formatNumber(
      counts.warning
    )} warning(s), ${formatNumber(counts.info)} info message(s)\n`
  );
  for (const diagnostic of diagnostics) {
    printDiagnostic('    ', diagnostic, stdout);
  }
}

export function printDiagnostic(
  prefix: string,
  diagnostic: SerializableDiagnostic,
  stdout: NodeJS.WritableStream
): void {
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

function printResolutionSummary(
  prefix: string,
  summary: ResolutionSummary,
  stdout: NodeJS.WritableStream
): void {
  stdout.write(`${prefix}${summary.pointer}\n`);
  const nested = `${prefix}  `;

  if (summary.token) {
    printResolvedToken(nested, summary.token, stdout);
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

function printResolvedToken(
  prefix: string,
  token: SerializableResolvedToken,
  stdout: NodeJS.WritableStream
): void {
  stdout.write(`${prefix}type: ${token.type ?? '(unspecified)'}\n`);
  if (typeof token.value === 'undefined') {
    stdout.write(`${prefix}value: <alias>\n`);
  } else {
    printValue(prefix, token.value, stdout);
  }
  if (token.source) {
    stdout.write(
      `${prefix}source: ${token.source.pointer} (${token.source.uri})${
        token.source.span ? ` at ${formatSpan(token.source.span)}` : ''
      }\n`
    );
  }
  if (token.overridesApplied.length > 0) {
    stdout.write(`${prefix}overrides:\n`);
    for (const override of token.overridesApplied) {
      stdout.write(
        `${prefix}  - ${override.kind} ${override.pointer} (depth ${formatNumber(
          override.depth
        )})${
          override.span ? ` at ${formatSpan(override.span)}` : ''
        }${override.source ? ` from ${override.source.pointer}` : ''}\n`
      );
    }
  }
  if (token.trace.length > 0) {
    const trace = token.trace.map((step) => `${step.kind}(${step.pointer})`).join(' -> ');
    stdout.write(`${prefix}trace: ${trace}\n`);
  }
  const { warnings } = token;
  let headerWritten = false;
  for (const warning of warnings) {
    if (!headerWritten) {
      stdout.write(`${prefix}warnings:\n`);
      headerWritten = true;
    }
    printDiagnostic(`${prefix}  `, warning, stdout);
  }
}

function printValue(prefix: string, value: unknown, stdout: NodeJS.WritableStream): void {
  const serialized = safeStringify(value);
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

function formatNumber(value: number): string {
  return value.toString();
}

function safeStringify(value: unknown): string | undefined {
  return JSON.stringify(value, null, 2);
}
