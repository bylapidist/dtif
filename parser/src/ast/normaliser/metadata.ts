import { DiagnosticCodes } from '../../diagnostics/codes.js';
import { appendJsonPointer } from '../../utils/json-pointer.js';
import type { JsonPointer } from '../../domain/primitives.js';
import type { AstField, NodeMetadata } from '../nodes.js';
import type { NormaliserContext } from './context.js';
import { getSourceSpan } from './context.js';
import { createField, EMPTY_METADATA, freezeRecord, isPlainObject } from './utils.js';
import { readOptionalStringField } from './fields.js';

interface MutableNodeMetadata {
  description?: AstField<string>;
  extensions?: AstField<Readonly<Record<string, unknown>>>;
  deprecated?: AstField<{ readonly active: boolean; readonly replacement?: AstField<string> }>;
  lastModified?: AstField<string>;
  lastUsed?: AstField<string>;
  usageCount?: AstField<number>;
  author?: AstField<string>;
  tags?: AstField<readonly string[]>;
  hash?: AstField<string>;
}

const EXTENSION_KEY_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9]+)+$/u;
const RFC3339_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;

function parseTimestampField(
  context: NormaliserContext,
  field: AstField<string>,
  key: '$lastModified' | '$lastUsed'
): number | undefined {
  if (!RFC3339_TIMESTAMP_PATTERN.test(field.value)) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
      message: `${key} must be an RFC 3339 date-time string.`,
      severity: 'error',
      pointer: field.pointer,
      span: field.span
    });
    return undefined;
  }

  const timestamp = Date.parse(field.value);
  if (Number.isNaN(timestamp)) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
      message: `${key} must be an RFC 3339 date-time string.`,
      severity: 'error',
      pointer: field.pointer,
      span: field.span
    });
    return undefined;
  }

  return timestamp;
}

export function extractMetadata(
  context: NormaliserContext,
  value: Record<string, unknown>,
  pointer: JsonPointer
): NodeMetadata {
  const metadata: MutableNodeMetadata = {};
  let lastModifiedTimestamp: number | undefined;
  let lastUsedTimestamp: number | undefined;

  if ('$description' in value) {
    const description = readOptionalStringField(context, value, '$description', pointer);
    if (description) {
      metadata.description = description;
    }
  }

  if ('$extensions' in value) {
    const fieldPointer = appendJsonPointer(pointer, '$extensions');
    const raw = value.$extensions;
    if (!isPlainObject(raw)) {
      context.diagnostics.push({
        code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
        message: '$extensions must be an object keyed by reverse-DNS identifiers.',
        severity: 'error',
        pointer: fieldPointer,
        span: getSourceSpan(context, fieldPointer)
      });
    } else {
      const invalidKey = Object.keys(raw).find((key) => !EXTENSION_KEY_PATTERN.test(key));
      if (invalidKey) {
        context.diagnostics.push({
          code: DiagnosticCodes.normaliser.INVALID_EXTENSIONS,
          message: `Extension namespace "${invalidKey}" must use lower-case reverse-DNS format.`,
          severity: 'error',
          pointer: appendJsonPointer(fieldPointer, invalidKey),
          span: getSourceSpan(context, appendJsonPointer(fieldPointer, invalidKey))
        });
      }
      const frozen = freezeRecord(raw);
      metadata.extensions = createField(context, frozen, fieldPointer);
      if (context.extensions) {
        for (const [namespace, extensionValue] of Object.entries(frozen)) {
          const entryPointer = appendJsonPointer(fieldPointer, namespace);
          context.extensions.handle({
            namespace,
            pointer: entryPointer,
            span: getSourceSpan(context, entryPointer),
            value: extensionValue
          });
        }
      }
    }
  }

  if ('$deprecated' in value) {
    const fieldPointer = appendJsonPointer(pointer, '$deprecated');
    const raw = value.$deprecated;

    if (typeof raw === 'boolean') {
      metadata.deprecated = createField(context, { active: raw }, fieldPointer);
    } else if (isPlainObject(raw) && '$replacement' in raw) {
      const replacementField = readOptionalStringField(context, raw, '$replacement', fieldPointer);
      if (replacementField) {
        metadata.deprecated = createField(
          context,
          { active: true, replacement: replacementField },
          fieldPointer
        );
      }
    } else {
      context.diagnostics.push({
        code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
        message: '$deprecated must be a boolean or an object containing $replacement.',
        severity: 'error',
        pointer: fieldPointer,
        span: getSourceSpan(context, fieldPointer)
      });
    }
  }

  if ('$lastModified' in value) {
    const lastModified = readOptionalStringField(context, value, '$lastModified', pointer);
    if (lastModified) {
      const parsed = parseTimestampField(context, lastModified, '$lastModified');
      if (parsed !== undefined) {
        metadata.lastModified = lastModified;
        lastModifiedTimestamp = parsed;
      }
    }
  }

  if ('$lastUsed' in value) {
    const lastUsed = readOptionalStringField(context, value, '$lastUsed', pointer);
    if (lastUsed) {
      const parsed = parseTimestampField(context, lastUsed, '$lastUsed');
      if (parsed !== undefined) {
        metadata.lastUsed = lastUsed;
        lastUsedTimestamp = parsed;
      }
    }
  }

  if ('$usageCount' in value) {
    const fieldPointer = appendJsonPointer(pointer, '$usageCount');
    const raw = value.$usageCount;

    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
      context.diagnostics.push({
        code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
        message: '$usageCount must be a non-negative integer.',
        severity: 'error',
        pointer: fieldPointer,
        span: getSourceSpan(context, fieldPointer)
      });
    } else {
      metadata.usageCount = createField(context, raw, fieldPointer);
    }
  }

  if ('$author' in value) {
    const author = readOptionalStringField(context, value, '$author', pointer);
    if (author) {
      metadata.author = author;
    }
  }

  if ('$tags' in value) {
    const fieldPointer = appendJsonPointer(pointer, '$tags');
    const raw = value.$tags;
    if (!Array.isArray(raw)) {
      context.diagnostics.push({
        code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
        message: '$tags must be an array of unique strings.',
        severity: 'error',
        pointer: fieldPointer,
        span: getSourceSpan(context, fieldPointer)
      });
    } else {
      const tags: string[] = [];
      const seen = new Set<string>();
      raw.forEach((entry, index) => {
        if (typeof entry !== 'string') {
          const tagPointer = appendJsonPointer(fieldPointer, String(index));
          context.diagnostics.push({
            code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
            message: '$tags entries must be strings.',
            severity: 'error',
            pointer: tagPointer,
            span: getSourceSpan(context, tagPointer)
          });
          return;
        }
        const trimmed = entry.trim();
        if (trimmed.length === 0) {
          const tagPointer = appendJsonPointer(fieldPointer, String(index));
          context.diagnostics.push({
            code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
            message: '$tags entries must not be empty.',
            severity: 'error',
            pointer: tagPointer,
            span: getSourceSpan(context, tagPointer)
          });
          return;
        }
        if (seen.has(trimmed)) {
          const tagPointer = appendJsonPointer(fieldPointer, String(index));
          context.diagnostics.push({
            code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
            message: `Duplicate tag "${trimmed}" detected.`,
            severity: 'error',
            pointer: tagPointer,
            span: getSourceSpan(context, tagPointer)
          });
          return;
        }
        seen.add(trimmed);
        tags.push(trimmed);
      });
      metadata.tags = createField(context, Object.freeze(tags), fieldPointer);
    }
  }

  if ('$hash' in value) {
    const hash = readOptionalStringField(context, value, '$hash', pointer);
    if (hash) {
      metadata.hash = hash;
    }
  }

  if (
    metadata.lastModified &&
    metadata.lastUsed &&
    lastModifiedTimestamp !== undefined &&
    lastUsedTimestamp !== undefined &&
    lastUsedTimestamp < lastModifiedTimestamp
  ) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_METADATA_COMBINATION,
      message: '$lastUsed must not precede $lastModified.',
      severity: 'error',
      pointer: metadata.lastUsed.pointer,
      span: metadata.lastUsed.span
    });
    delete metadata.lastUsed;
    lastUsedTimestamp = undefined;
  }

  if (metadata.lastUsed && metadata.usageCount && metadata.usageCount.value <= 0) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_METADATA_COMBINATION,
      message: '$lastUsed requires a positive $usageCount.',
      severity: 'error',
      pointer: metadata.lastUsed.pointer,
      span: metadata.lastUsed.span
    });
    delete metadata.lastUsed;
    lastUsedTimestamp = undefined;
  }

  if (metadata.lastUsed && !metadata.usageCount) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_METADATA_COMBINATION,
      message: '$lastUsed must be accompanied by $usageCount.',
      severity: 'error',
      pointer: metadata.lastUsed.pointer,
      span: metadata.lastUsed.span
    });
    delete metadata.lastUsed;
    lastUsedTimestamp = undefined;
  }

  if (metadata.usageCount && metadata.usageCount.value > 0 && !metadata.lastUsed) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_METADATA_COMBINATION,
      message: '$usageCount greater than zero must be accompanied by $lastUsed.',
      severity: 'error',
      pointer: metadata.usageCount.pointer,
      span: metadata.usageCount.span
    });
    delete metadata.usageCount;
  }

  const hasMetadata = Object.keys(metadata).length > 0;
  return hasMetadata ? Object.freeze(metadata) : EMPTY_METADATA;
}
