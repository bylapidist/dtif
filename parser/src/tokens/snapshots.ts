import type { DocumentGraph } from '../graph/nodes.js';
import type { DocumentResolver } from '../resolver/index.js';
import type { Diagnostic } from '../types.js';
import { dedupePointers, toPlainJson } from './internal/utils.js';
import { getBaseType, getBaseValue, getTokenId, iterateTokenNodes } from './internal/graph.js';
import { normalizeJsonPointer } from '../utils/json-pointer.js';
import type { ResolvedTokenView, TokenId, TokenMetadataSnapshot, TokenPointer } from './types.js';
import type { NodeMetadata } from '../ast/nodes.js';

export function createMetadataSnapshot(graph: DocumentGraph): Map<TokenId, TokenMetadataSnapshot> {
  const entries = new Map<TokenId, TokenMetadataSnapshot>();
  const documentUri = graph.uri.href;

  for (const node of iterateTokenNodes(graph)) {
    const id = getTokenId(node.pointer);
    const sourceUri = node.span ? node.span.uri.href : documentUri;
    const metadata = normalizeMetadata(
      node.metadata,
      {
        uri: sourceUri,
        line: node.span ? node.span.start.line : undefined,
        column: node.span ? node.span.start.column : undefined
      },
      documentUri
    );

    entries.set(id, metadata);
  }

  return entries;
}

export function createResolutionSnapshot(
  graph: DocumentGraph,
  resolver: DocumentResolver,
  options: { onDiagnostic?: (diagnostic: Diagnostic) => void } = {}
): Map<TokenId, ResolvedTokenView> {
  const entries = new Map<TokenId, ResolvedTokenView>();
  const documentUri = graph.uri.href;
  const forwardDiagnostic = options.onDiagnostic;

  for (const node of iterateTokenNodes(graph)) {
    const pointer = normalizeJsonPointer(node.pointer);
    const id = getTokenId(node.pointer);
    const baseType = getBaseType(node);
    const rawValue = getBaseValue(node);
    const resolution = resolver.resolve(pointer);
    if (forwardDiagnostic) {
      for (const diagnostic of resolution.diagnostics) {
        forwardDiagnostic(diagnostic);
      }
    }
    const resolvedToken = resolution.token;

    const value = resolvedToken?.value ?? rawValue;
    const normalizedValue = toPlainJson(value);
    const normalizedRaw = toPlainJson(rawValue);

    const references: TokenPointer[] = [];
    if (node.kind === 'alias') {
      const target = node.ref.value;
      references.push({
        uri: target.uri.href,
        pointer: normalizeJsonPointer(target.pointer)
      });
    }

    const resolutionPath: TokenPointer[] = [];
    const appliedAliases: TokenPointer[] = [];
    if (resolvedToken) {
      if (resolvedToken.overridesApplied.length > 0) {
        for (const override of resolvedToken.overridesApplied) {
          if (override.source) {
            references.push({
              uri: override.source.uri.href,
              pointer: normalizeJsonPointer(override.source.pointer)
            });
          }
        }
      }

      if (forwardDiagnostic && resolvedToken.warnings.length > 0) {
        for (const warning of resolvedToken.warnings) {
          forwardDiagnostic(warning);
        }
      }
      for (const step of resolvedToken.trace) {
        const tokenPointer: TokenPointer = {
          uri: documentUri,
          pointer: normalizeJsonPointer(step.pointer)
        };
        resolutionPath.push(tokenPointer);
        if (step.kind === 'alias') {
          appliedAliases.push(tokenPointer);
        }
      }

      if (resolvedToken.source) {
        references.push({
          uri: resolvedToken.source.uri.href,
          pointer: normalizeJsonPointer(resolvedToken.source.pointer)
        });
      }
    }

    entries.set(id, {
      id,
      type: resolvedToken?.type ?? baseType,
      value: normalizedValue,
      raw: normalizedRaw,
      references: dedupePointers(references),
      resolutionPath: dedupePointers(resolutionPath),
      appliedAliases: dedupePointers(appliedAliases)
    });
  }

  return entries;
}

function normalizeMetadata(
  metadata: NodeMetadata,
  source: { uri: string; line?: number; column?: number },
  documentUri: string
): TokenMetadataSnapshot {
  const description =
    typeof metadata.description?.value === 'string' ? metadata.description.value : undefined;
  const extensions = cloneExtensions(metadata.extensions);
  const deprecated = normalizeDeprecated(metadata, documentUri);
  const line = typeof source.line === 'number' && Number.isFinite(source.line) ? source.line : 1;
  const column =
    typeof source.column === 'number' && Number.isFinite(source.column) ? source.column : 1;

  return {
    description,
    extensions,
    deprecated,
    source: {
      uri: source.uri,
      line,
      column
    }
  };
}

function cloneExtensions(value: NodeMetadata['extensions']): Record<string, unknown> {
  const extensionsValue = value?.value;
  if (!isRecord(extensionsValue)) {
    return {};
  }

  const copy: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(extensionsValue)) {
    const cloned = toPlainJson(entry);
    copy[key] = cloned === undefined ? entry : cloned;
  }

  return copy;
}

function normalizeDeprecated(
  metadata: NodeMetadata,
  documentUri: string
): TokenMetadataSnapshot['deprecated'] {
  const deprecated = metadata.deprecated?.value;
  if (!isRecord(deprecated)) {
    return undefined;
  }

  if (!('active' in deprecated) || typeof deprecated.active !== 'boolean') {
    return undefined;
  }

  if (!deprecated.active) {
    return undefined;
  }

  const supersededBy = extractReplacementPointer(deprecated, documentUri);
  if (supersededBy) {
    return { supersededBy };
  }

  return {};
}

function extractReplacementPointer(
  deprecated: Record<string, unknown>,
  documentUri: string
): TokenPointer | undefined {
  const replacement = deprecated.replacement;
  if (!isRecord(replacement)) {
    return undefined;
  }

  const reference = replacement.value;
  return createTokenPointer(reference, documentUri);
}

function createTokenPointer(reference: unknown, documentUri: string): TokenPointer | undefined {
  if (typeof reference !== 'string') {
    return undefined;
  }

  const trimmed = reference.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  try {
    const base = new URL(documentUri);
    const resolved = new URL(trimmed, base);
    const pointer = normalizeJsonPointer(resolved.hash || trimmed);
    resolved.hash = '';
    return {
      uri: resolved.href,
      pointer
    };
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
