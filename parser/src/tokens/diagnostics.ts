import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Diagnostic, JsonPointer, RelatedInformation, SourceSpan } from '../types.js';
import { normalizeJsonPointer } from '../utils/json-pointer.js';
import {
  type FormatTokenDiagnosticOptions,
  type Range,
  type TokenDiagnostic,
  type TokenDiagnosticContext
} from './types.js';

const DEFAULT_URI = 'unknown://dtif-token';

export function toTokenDiagnostic(
  diagnostic: Diagnostic,
  context: TokenDiagnosticContext = {}
): TokenDiagnostic {
  const span = resolveSpan(diagnostic.span, diagnostic.pointer, context);
  const targetUri = span?.uri?.href ?? context.documentUri ?? DEFAULT_URI;
  const targetRange = span ? toRange(span) : createZeroRange();

  return {
    severity: diagnostic.severity,
    code: String(diagnostic.code),
    message: diagnostic.message,
    source: 'dtif-parser',
    target: {
      uri: targetUri,
      range: targetRange
    },
    related: mapRelated(diagnostic.related, context)
  };
}

export function formatTokenDiagnostic(
  diagnostic: TokenDiagnostic,
  options: FormatTokenDiagnosticOptions = {}
): string {
  const colorize = options.color ? selectColorizer(diagnostic.severity) : passthrough;
  const severityLabel = diagnostic.severity.toUpperCase();
  const header = `${colorize(severityLabel)} ${diagnostic.code}: ${diagnostic.message}`;
  const location = formatTarget(diagnostic.target, options.cwd);
  const lines = [header, `  at ${location}`];

  if (diagnostic.related && diagnostic.related.length > 0) {
    for (const related of diagnostic.related) {
      lines.push(`  related: ${related.message}`);
      lines.push(`    at ${formatTarget(related.target, options.cwd)}`);
    }
  }

  return lines.join('\n');
}

function resolveSpan(
  span: SourceSpan | undefined,
  pointer: JsonPointer | undefined,
  context: TokenDiagnosticContext
): SourceSpan | undefined {
  if (span) {
    return span;
  }

  if (!pointer || !context.pointerSpans) {
    return undefined;
  }

  const normalized = normalizeJsonPointer(pointer);
  return context.pointerSpans.get(normalized);
}

function toRange(span: SourceSpan): Range {
  return {
    start: toPosition(span.start),
    end: toPosition(span.end)
  };
}

function toPosition(position: SourceSpan['start']): { line: number; character: number } {
  const line = Number.isFinite(position.line) ? position.line - 1 : 0;
  const column = Number.isFinite(position.column) ? position.column - 1 : 0;
  return {
    line: line >= 0 ? line : 0,
    character: column >= 0 ? column : 0
  };
}

function createZeroRange(): Range {
  return {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 0 }
  };
}

function mapRelated(
  related: readonly RelatedInformation[] | undefined,
  context: TokenDiagnosticContext
): TokenDiagnostic['related'] {
  if (!related || related.length === 0) {
    return undefined;
  }

  const entries: Array<NonNullable<TokenDiagnostic['related']>[number]> = [];

  for (const item of related) {
    const span = resolveSpan(item.span, item.pointer, context);
    const uri = span?.uri?.href ?? context.documentUri ?? DEFAULT_URI;
    entries.push({
      message: item.message,
      target: {
        uri,
        range: span ? toRange(span) : createZeroRange()
      }
    });
  }

  return entries;
}

function selectColorizer(severity: TokenDiagnostic['severity']): (value: string) => string {
  switch (severity) {
    case 'error':
      return (value) => `\u001b[31m${value}\u001b[0m`;
    case 'warning':
      return (value) => `\u001b[33m${value}\u001b[0m`;
    case 'info':
    default:
      return (value) => `\u001b[36m${value}\u001b[0m`;
  }
}

function passthrough(value: string): string {
  return value;
}

function formatTarget(target: TokenDiagnostic['target'], cwd: string | undefined): string {
  const { uri, range } = target;
  const location = formatUri(uri, cwd);
  const line = range.start.line + 1;
  const character = range.start.character + 1;
  return `${location}:${line}:${character}`;
}

function formatUri(uri: string, cwd: string | undefined): string {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol === 'file:') {
      const filePath = fileURLToPath(parsed);
      if (cwd) {
        const relative = path.relative(cwd, filePath);
        return relative.startsWith('..') ? filePath : relative || '.';
      }
      return filePath;
    }
    return parsed.href;
  } catch {
    return uri;
  }
}
