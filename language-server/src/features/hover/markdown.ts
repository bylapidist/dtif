import { getNodeValue, type Node as JsonNode } from 'jsonc-parser';
import { fileURLToPath } from 'node:url';
import { escapeInlineCode } from '../../util/markdown.js';
import { isRecord } from '../../core/utils/object.js';
import type { DocumentReference } from '../../core/documents/types.js';

interface HoverContext {
  readonly reference: DocumentReference;
  readonly targetNode?: JsonNode;
  readonly targetUri: string;
  readonly sameDocument: boolean;
}

export function formatHoverMarkdown(context: HoverContext): string | undefined {
  const header = `**DTIF Pointer** \`${context.reference.targetPointer}\``;
  const lines: string[] = [header];

  if (!context.sameDocument) {
    lines.push(`- **Document:** ${formatUri(context.targetUri)}`);
  }

  const summary = context.targetNode ? summarizePointerNode(context.targetNode) : undefined;

  if (summary?.type) {
    lines.push(`- **$type:** \`${escapeInline(summary.type)}\``);
  }

  if (summary?.unit) {
    lines.push(`- **Unit:** \`${escapeInline(summary.unit)}\``);
  }

  if (summary?.value !== undefined) {
    lines.push(`- **Value:** \`${escapeInline(summary.value)}\``);
  }

  if (summary?.description) {
    lines.push(`- **Description:** ${escapeMarkdown(summary.description)}`);
  }

  if (!context.targetNode) {
    lines.push('');
    lines.push('_Pointer target not indexed in open documents._');
    return lines.join('\n');
  }

  const snippet = formatSnippet(context.targetNode);
  if (snippet) {
    lines.push('');
    lines.push('```json');
    lines.push(snippet);
    lines.push('```');
  }

  return lines.join('\n');
}

interface PointerSummary {
  readonly type?: string;
  readonly description?: string;
  readonly value?: string;
  readonly unit?: string;
}

function summarizePointerNode(node: JsonNode): PointerSummary | undefined {
  const value: unknown = getNodeValue(node);
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return { value: formatPrimitiveValue(value) };
  }

  if (isRecord(value)) {
    const type = typeof value.$type === 'string' ? value.$type : undefined;
    const unit = typeof value.unit === 'string' ? value.unit : undefined;
    const description = typeof value.$description === 'string' ? value.$description : undefined;
    const rawValue = Object.prototype.hasOwnProperty.call(value, 'value') ? value.value : undefined;
    const valueSummary = formatPrimitiveValue(rawValue);
    return {
      type,
      unit,
      description,
      value: valueSummary
    } satisfies PointerSummary;
  }

  return { value: formatPrimitiveValue(value) } satisfies PointerSummary;
}

function formatPrimitiveValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    return truncateInlineValue(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return truncateInlineValue(value.toString());
  }

  if (typeof value === 'bigint') {
    return truncateInlineValue(`${value.toString()}n`);
  }

  return undefined;
}

const MAX_INLINE_VALUE_LENGTH = 120;
const MAX_SNIPPET_LENGTH = 800;

function truncateInlineValue(value: string): string {
  if (value.length > MAX_INLINE_VALUE_LENGTH) {
    return `${value.slice(0, MAX_INLINE_VALUE_LENGTH - 1)}…`;
  }
  return value;
}

function formatSnippet(node: JsonNode): string | undefined {
  const value: unknown = getNodeValue(node);
  if (value === undefined) {
    return undefined;
  }

  try {
    const serialized = JSON.stringify(value, null, 2);
    if (serialized.length > MAX_SNIPPET_LENGTH) {
      return `${serialized.slice(0, MAX_SNIPPET_LENGTH - 1)}…`;
    }
    return serialized;
  } catch {
    return undefined;
  }
}

function formatUri(targetUri: string): string {
  try {
    const parsed = new URL(targetUri);
    if (parsed.protocol === 'file:') {
      return `\`${escapeInline(fileURLToPath(parsed))}\``;
    }
    return `\`${escapeInline(targetUri)}\``;
  } catch {
    return `\`${escapeInline(targetUri)}\``;
  }
}

function escapeInline(value: string): string {
  return escapeInlineCode(value);
}

function escapeMarkdown(value: string): string {
  return value
    .replace(/\\/gu, '\\\\')
    .replace(/([*_`])/gu, '\\$1')
    .replace(/\|/gu, '\\|')
    .replace(/\r?\n/gu, '  \n');
}
