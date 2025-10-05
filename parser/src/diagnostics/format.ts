import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DiagnosticEvent, DiagnosticEventRelatedInformation } from '../domain/models.js';
import type { SourceSpan } from '../domain/primitives.js';

export interface FormatDiagnosticOptions {
  readonly color?: boolean;
  readonly cwd?: string;
}

export function formatDiagnostic(
  diagnostic: DiagnosticEvent,
  options: FormatDiagnosticOptions = {}
): string {
  const colorize = options.color ? selectColorizer(diagnostic.severity) : passthrough;
  const severityLabel = colorize(diagnostic.severity.toUpperCase());
  const header = `${severityLabel} ${diagnostic.code}: ${diagnostic.message}`;
  const lines = [header];

  const location = formatLocation(diagnostic, options.cwd);
  if (location) {
    lines.push(`  at ${location}`);
  }

  if (diagnostic.pointer && !diagnostic.span) {
    lines.push(`  pointer: ${diagnostic.pointer}`);
  }

  if (diagnostic.related && diagnostic.related.length > 0) {
    for (const related of diagnostic.related) {
      lines.push(`  related: ${related.message}`);
      const relatedLocation = formatRelatedLocation(related, options.cwd);
      if (relatedLocation) {
        lines.push(`    at ${relatedLocation}`);
      }
      if (related.pointer && !related.span) {
        lines.push(`    pointer: ${related.pointer}`);
      }
    }
  }

  return lines.join('\n');
}

function formatLocation(diagnostic: DiagnosticEvent, cwd: string | undefined): string | undefined {
  if (diagnostic.span) {
    return formatSpan(diagnostic.span, cwd);
  }
  if (diagnostic.pointer) {
    return diagnostic.pointer;
  }
  return undefined;
}

function formatRelatedLocation(
  related: DiagnosticEventRelatedInformation,
  cwd: string | undefined
): string | undefined {
  if (related.span) {
    return formatSpan(related.span, cwd);
  }
  if (related.pointer) {
    return related.pointer;
  }
  return undefined;
}

function formatSpan(span: SourceSpan, cwd: string | undefined): string {
  const uri = formatUri(span.uri.href, cwd);
  const start = formatPosition(span.start);
  const end = formatPosition(span.end);
  if (start === end) {
    return `${uri}:${start}`;
  }
  return `${uri}:${start}-${end}`;
}

function formatPosition(position: SourceSpan['start']): string {
  const line = Number.isFinite(position.line) ? Math.max(1, position.line) : 1;
  const column = Number.isFinite(position.column) ? Math.max(1, position.column) : 1;
  const lineLabel = line.toString();
  const columnLabel = column.toString();
  return `${lineLabel}:${columnLabel}`;
}

function selectColorizer(severity: DiagnosticEvent['severity']): (value: string) => string {
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
