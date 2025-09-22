import { DiagnosticCodes } from '../diagnostics/codes.js';
import { JSON_POINTER_ROOT, appendJsonPointer } from '../utils/json-pointer.js';
import type { ExtensionCollector, ExtensionEvaluation } from '../plugins/index.js';
import type { Diagnostic, JsonPointer, RawDocument, SourceSpan } from '../types.js';
import type {
  AliasNode,
  AstField,
  CollectionNode,
  DocumentAst,
  DocumentChildNode,
  NodeMetadata,
  OverrideFallbackNode,
  OverrideNode,
  TokenNode
} from './nodes.js';

export interface NormaliserOptions {
  readonly extensions?: {
    createExtensionCollector(
      document: RawDocument,
      diagnostics: Diagnostic[]
    ): ExtensionCollector | undefined;
  };
}

export interface NormaliserResult {
  readonly ast?: DocumentAst;
  readonly diagnostics: readonly Diagnostic[];
  readonly extensions: readonly ExtensionEvaluation[];
}

interface NormaliserContext {
  readonly document: RawDocument;
  readonly diagnostics: Diagnostic[];
  readonly extensions?: ExtensionCollector;
}

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

const EMPTY_DIAGNOSTICS: readonly Diagnostic[] = Object.freeze([]);
const EMPTY_EXTENSION_RESULTS: readonly ExtensionEvaluation[] = Object.freeze([]);
const EMPTY_METADATA: NodeMetadata = Object.freeze({});
const EMPTY_CHILDREN: readonly DocumentChildNode[] = Object.freeze([]);
const EMPTY_OVERRIDES: readonly OverrideNode[] = Object.freeze([]);

const EXTENSION_KEY_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9]+)+$/u;

export function normalizeDocument(
  document: RawDocument,
  options: NormaliserOptions = {}
): NormaliserResult {
  const diagnostics: Diagnostic[] = [];
  const collector = options.extensions?.createExtensionCollector?.(document, diagnostics);
  const context: NormaliserContext = {
    document,
    diagnostics,
    extensions: collector
  };

  try {
    const ast = buildDocumentAst(context);
    return finalizeNormalisation(context, ast);
  } catch (error) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.FAILED,
      message:
        error instanceof Error
          ? error.message
          : 'Failed to normalise DTIF document.',
      severity: 'error',
      pointer: JSON_POINTER_ROOT,
      span: getSourceSpan(context, JSON_POINTER_ROOT)
    });
    return finalizeNormalisation(context, undefined);
  }
}

function buildDocumentAst(context: NormaliserContext): DocumentAst | undefined {
  const { document } = context;
  const data = document.data;

  if (!isPlainObject(data)) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_ROOT,
      message: 'DTIF document root must be a JSON object.',
      severity: 'error',
      pointer: JSON_POINTER_ROOT,
      span: getSourceSpan(context, JSON_POINTER_ROOT)
    });
    return undefined;
  }

  const metadata = extractMetadata(context, data, JSON_POINTER_ROOT);
  const schemaField = readOptionalStringField(context, data, '$schema', JSON_POINTER_ROOT);
  const versionField = readOptionalStringField(context, data, '$version', JSON_POINTER_ROOT);
  const overrides = normalizeOverrides(context, data, JSON_POINTER_ROOT);

  const children: DocumentChildNode[] = [];
  for (const [name, value] of Object.entries(data)) {
    if (name.startsWith('$')) {
      continue;
    }

    const pointer = appendJsonPointer(JSON_POINTER_ROOT, name);
    const node = normalizeNode(context, name, value, pointer);
    if (node) {
      children.push(node);
    }
  }

  return freezeDocumentAst({
    kind: 'document',
    uri: document.uri,
    pointer: JSON_POINTER_ROOT,
    span: getSourceSpan(context, JSON_POINTER_ROOT),
    schema: schemaField,
    version: versionField,
    metadata,
    children,
    overrides
  });
}

function finalizeNormalisation(context: NormaliserContext, ast?: DocumentAst): NormaliserResult {
  const diagnostics =
    context.diagnostics.length === 0
      ? EMPTY_DIAGNOSTICS
      : Object.freeze(context.diagnostics.map((diagnostic) => Object.freeze(diagnostic)));
  const extensions = context.extensions?.results() ?? EMPTY_EXTENSION_RESULTS;

  return {
    ast,
    diagnostics,
    extensions
  };
}

function normalizeNode(
  context: NormaliserContext,
  name: string,
  value: unknown,
  pointer: JsonPointer
): DocumentChildNode | undefined {
  if (!isPlainObject(value)) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_NODE,
      message: `Node "${name}" must be a JSON object.`,
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
    return undefined;
  }

  const metadata = extractMetadata(context, value, pointer);

  if (isTokenLike(value)) {
    if ('$ref' in value) {
      return normalizeAliasNode(context, name, value, pointer, metadata);
    }
    return normalizeTokenNode(context, name, value, pointer, metadata);
  }

  return normalizeCollectionNode(context, name, value, pointer, metadata);
}

function normalizeCollectionNode(
  context: NormaliserContext,
  name: string,
  value: Record<string, unknown>,
  pointer: JsonPointer,
  metadata: NodeMetadata
): CollectionNode {
  const children: DocumentChildNode[] = [];

  for (const [childName, childValue] of Object.entries(value)) {
    if (childName.startsWith('$')) {
      continue;
    }

    const childPointer = appendJsonPointer(pointer, childName);
    const childNode = normalizeNode(context, childName, childValue, childPointer);
    if (childNode) {
      children.push(childNode);
    }
  }

  return Object.freeze({
    kind: 'collection',
    name,
    pointer,
    span: getSourceSpan(context, pointer),
    metadata,
    children: children.length === 0 ? EMPTY_CHILDREN : Object.freeze(children)
  });
}

function normalizeTokenNode(
  context: NormaliserContext,
  name: string,
  value: Record<string, unknown>,
  pointer: JsonPointer,
  metadata: NodeMetadata
): TokenNode {
  const typeField = readOptionalStringField(context, value, '$type', pointer);
  const valueField =
    '$value' in value
      ? createField(context, value['$value'], appendJsonPointer(pointer, '$value'))
      : undefined;

  if (!valueField) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.MISSING_VALUE,
      message: `Token "${name}" must declare a $value when it does not alias another token.`,
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
  }

  return Object.freeze({
    kind: 'token',
    name,
    pointer,
    span: getSourceSpan(context, pointer),
    metadata,
    type: typeField,
    value: valueField
  });
}

function normalizeAliasNode(
  context: NormaliserContext,
  name: string,
  value: Record<string, unknown>,
  pointer: JsonPointer,
  metadata: NodeMetadata
): AliasNode | undefined {
  const refField = readOptionalStringField(context, value, '$ref', pointer);
  const typeField = readOptionalStringField(context, value, '$type', pointer);

  if (!refField) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.MISSING_ALIAS_TARGET,
      message: `Alias token "${name}" must declare a $ref pointer.`,
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
    return undefined;
  }

  if (!typeField) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.ALIAS_MISSING_TYPE,
      message: `Alias token "${name}" must declare a $type alongside $ref.`,
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
    return undefined;
  }

  return Object.freeze({
    kind: 'alias',
    name,
    pointer,
    span: getSourceSpan(context, pointer),
    metadata,
    type: typeField,
    ref: refField
  });
}

function normalizeOverrides(
  context: NormaliserContext,
  value: Record<string, unknown>,
  pointer: JsonPointer
): readonly OverrideNode[] {
  if (!('$overrides' in value)) {
    return EMPTY_OVERRIDES;
  }

  const overridesValue = value['$overrides'];
  const overridesPointer = appendJsonPointer(pointer, '$overrides');

  if (!Array.isArray(overridesValue)) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
      message: '$overrides must be an array of override objects.',
      severity: 'error',
      pointer: overridesPointer,
      span: getSourceSpan(context, overridesPointer)
    });
    return EMPTY_OVERRIDES;
  }

  const overrides: OverrideNode[] = [];

  overridesValue.forEach((entry, index) => {
    const entryPointer = appendJsonPointer(overridesPointer, String(index));
    const override = normalizeOverrideNode(context, entry, entryPointer);
    if (override) {
      overrides.push(override);
    }
  });

  return overrides.length === 0 ? EMPTY_OVERRIDES : Object.freeze(overrides);
}

function normalizeOverrideNode(
  context: NormaliserContext,
  value: unknown,
  pointer: JsonPointer
): OverrideNode | undefined {
  if (!isPlainObject(value)) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
      message: 'Override entries must be JSON objects.',
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
    return undefined;
  }

  const token = readRequiredStringField(context, value, '$token', pointer);
  const when = readOverrideConditions(context, value, pointer);
  const refField = readOptionalStringField(context, value, '$ref', pointer);
  const valueField =
    '$value' in value
      ? createField(context, value['$value'], appendJsonPointer(pointer, '$value'))
      : undefined;
  const fallback =
    '$fallback' in value
      ? normalizeFallbackChain(context, value['$fallback'], appendJsonPointer(pointer, '$fallback'))
      : undefined;

  if (!token || !when) {
    return undefined;
  }

  if (!refField && !valueField && !fallback) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_OVERRIDE,
      message: 'Override entries must provide $ref, $value, or $fallback.',
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
  }

  if (refField && valueField) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_OVERRIDE,
      message: 'Override entries must not declare both $ref and $value.',
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
  }

  return Object.freeze({
    kind: 'override',
    pointer,
    span: getSourceSpan(context, pointer),
    token,
    when,
    ref: refField,
    value: valueField,
    fallback
  });
}

function normalizeFallbackChain(
  context: NormaliserContext,
  value: unknown,
  pointer: JsonPointer
): readonly OverrideFallbackNode[] | undefined {
  if (Array.isArray(value)) {
    const entries: OverrideFallbackNode[] = [];
    value.forEach((entry, index) => {
      const entryPointer = appendJsonPointer(pointer, String(index));
      const node = normalizeFallbackEntry(context, entry, entryPointer);
      if (node) {
        entries.push(node);
      }
    });
    return entries.length === 0 ? undefined : Object.freeze(entries);
  }

  if (isPlainObject(value)) {
    const entry = normalizeFallbackEntry(context, value, pointer);
    return entry ? Object.freeze([entry]) : undefined;
  }

  context.diagnostics.push({
    code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
    message: '$fallback must be an override object or an array of override objects.',
    severity: 'error',
    pointer,
    span: getSourceSpan(context, pointer)
  });
  return undefined;
}

function normalizeFallbackEntry(
  context: NormaliserContext,
  value: unknown,
  pointer: JsonPointer
): OverrideFallbackNode | undefined {
  if (!isPlainObject(value)) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
      message: 'Fallback entries must be JSON objects.',
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
    return undefined;
  }

  const refField = readOptionalStringField(context, value, '$ref', pointer);
  const valueField =
    '$value' in value
      ? createField(context, value['$value'], appendJsonPointer(pointer, '$value'))
      : undefined;
  const fallback =
    '$fallback' in value
      ? normalizeFallbackChain(context, value['$fallback'], appendJsonPointer(pointer, '$fallback'))
      : undefined;

  if (!refField && !valueField) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_OVERRIDE,
      message: 'Fallback entries must provide $ref or $value.',
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
    return undefined;
  }

  if (refField && valueField) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_OVERRIDE,
      message: 'Fallback entries must not declare both $ref and $value.',
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
    return undefined;
  }

  return Object.freeze({
    kind: 'fallback',
    pointer,
    span: getSourceSpan(context, pointer),
    ref: refField,
    value: valueField,
    fallback
  });
}

function readOptionalStringField(
  context: NormaliserContext,
  value: Record<string, unknown>,
  key: string,
  pointer: JsonPointer
): AstField<string> | undefined {
  if (!(key in value)) {
    return undefined;
  }

  const fieldPointer = appendJsonPointer(pointer, key);
  const raw = value[key];

  if (typeof raw !== 'string') {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
      message: `${key} must be a string.`,
      severity: 'error',
      pointer: fieldPointer,
      span: getSourceSpan(context, fieldPointer)
    });
    return undefined;
  }

  return createField(context, raw, fieldPointer);
}

function readRequiredStringField(
  context: NormaliserContext,
  value: Record<string, unknown>,
  key: string,
  pointer: JsonPointer
): AstField<string> | undefined {
  const field = readOptionalStringField(context, value, key, pointer);
  if (!field) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.MISSING_REQUIRED_MEMBER,
      message: `Override entries must declare ${key}.`,
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
  }
  return field;
}

function readOverrideConditions(
  context: NormaliserContext,
  value: Record<string, unknown>,
  pointer: JsonPointer
): AstField<Readonly<Record<string, unknown>>> | undefined {
  if (!('$when' in value)) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.MISSING_REQUIRED_MEMBER,
      message: 'Override entries must declare $when conditions.',
      severity: 'error',
      pointer,
      span: getSourceSpan(context, pointer)
    });
    return undefined;
  }

  const fieldPointer = appendJsonPointer(pointer, '$when');
  const raw = value['$when'];

  if (!isPlainObject(raw)) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_MEMBER_TYPE,
      message: '$when must be an object containing at least one condition.',
      severity: 'error',
      pointer: fieldPointer,
      span: getSourceSpan(context, fieldPointer)
    });
    return undefined;
  }

  if (Object.keys(raw).length === 0) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_OVERRIDE,
      message: '$when must declare at least one condition.',
      severity: 'error',
      pointer: fieldPointer,
      span: getSourceSpan(context, fieldPointer)
    });
  }

  const frozen = freezeRecord(raw);
  return createField(context, frozen, fieldPointer);
}

function extractMetadata(
  context: NormaliserContext,
  value: Record<string, unknown>,
  pointer: JsonPointer
): NodeMetadata {
  const metadata: MutableNodeMetadata = {};

  if ('$description' in value) {
    const description = readOptionalStringField(context, value, '$description', pointer);
    if (description) {
      metadata.description = description;
    }
  }

  if ('$extensions' in value) {
    const fieldPointer = appendJsonPointer(pointer, '$extensions');
    const raw = value['$extensions'];
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
        for (const [namespace, extensionValue] of Object.entries(
          frozen as Record<string, unknown>
        )) {
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
    const raw = value['$deprecated'];

    if (typeof raw === 'boolean') {
      metadata.deprecated = createField(context, { active: raw }, fieldPointer);
    } else if (isPlainObject(raw) && '$replacement' in raw) {
      const replacementField = readOptionalStringField(context, raw, '$replacement', fieldPointer);
      if (replacementField) {
        metadata.deprecated = createField(context, { active: true, replacement: replacementField }, fieldPointer);
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
      metadata.lastModified = lastModified;
    }
  }

  if ('$lastUsed' in value) {
    const lastUsed = readOptionalStringField(context, value, '$lastUsed', pointer);
    if (lastUsed) {
      metadata.lastUsed = lastUsed;
    }
  }

  if ('$usageCount' in value) {
    const fieldPointer = appendJsonPointer(pointer, '$usageCount');
    const raw = value['$usageCount'];

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
    const raw = value['$tags'];
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

  if (metadata.lastUsed && metadata.usageCount && metadata.usageCount.value <= 0) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_METADATA_COMBINATION,
      message: '$lastUsed requires a positive $usageCount.',
      severity: 'error',
      pointer: metadata.lastUsed.pointer,
      span: metadata.lastUsed.span
    });
  }

  if (metadata.lastUsed && !metadata.usageCount) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_METADATA_COMBINATION,
      message: '$lastUsed must be accompanied by $usageCount.',
      severity: 'error',
      pointer: metadata.lastUsed.pointer,
      span: metadata.lastUsed.span
    });
  }

  if (metadata.usageCount && metadata.usageCount.value > 0 && !metadata.lastUsed) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_METADATA_COMBINATION,
      message: '$usageCount greater than zero must be accompanied by $lastUsed.',
      severity: 'error',
      pointer: metadata.usageCount.pointer,
      span: metadata.usageCount.span
    });
  }

  const hasMetadata = Object.keys(metadata).length > 0;
  return hasMetadata ? Object.freeze(metadata) : EMPTY_METADATA;
}

function freezeRecord(value: Record<string, unknown>): Readonly<Record<string, unknown>> {
  const entries = Object.entries(value).map(([key, entry]) => [key, freezeValue(entry)] as const);
  return Object.freeze(Object.fromEntries(entries));
}

function createField<T>(
  context: NormaliserContext,
  value: T,
  pointer: JsonPointer
): AstField<T> {
  return Object.freeze({
    value: freezeValue(value),
    pointer,
    span: getSourceSpan(context, pointer)
  });
}

function freezeDocumentAst(ast: DocumentAst): DocumentAst {
  const children = ast.children.length === 0 ? EMPTY_CHILDREN : ast.children;
  const overrides = ast.overrides.length === 0 ? EMPTY_OVERRIDES : ast.overrides;
  return Object.freeze({
    ...ast,
    children,
    overrides
  });
}

function isTokenLike(value: Record<string, unknown>): boolean {
  return '$value' in value || '$ref' in value || '$type' in value;
}

function freezeValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => freezeValue(entry))) as unknown as T;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, freezeValue(entry)] as const);
    return Object.freeze(Object.fromEntries(entries)) as unknown as T;
  }

  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function getSourceSpan(context: NormaliserContext, pointer: JsonPointer): SourceSpan | undefined {
  return context.document.sourceMap.pointers.get(pointer);
}
