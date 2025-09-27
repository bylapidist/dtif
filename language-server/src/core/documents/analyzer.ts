import { parseTree, type Node as JsonNode, type ParseError } from 'jsonc-parser';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { escapeJsonPointerSegment, pointerToPath } from '../../pointer-utils.js';
import type { DocumentAnalysis, DocumentReference, PointerMetadata } from './types.js';
import { rangeFromNode } from './ranges.js';

const POINTER_REFERENCE_KEYS = new Set(['$ref', 'token', 'ref']);

export function analyzeTextDocument(document: TextDocument, text: string): DocumentAnalysis | null {
  const parseErrors: ParseError[] = [];
  const tree = parseTree(text, parseErrors, {
    allowTrailingComma: false,
    disallowComments: true
  });

  if (!tree || parseErrors.length > 0) {
    return null;
  }

  const pointers = new Map<string, PointerMetadata>();
  const typeValues = new Set<string>();
  const extensionKeys = new Set<string>();
  const unitValues = new Set<string>();

  collectPointerMetadata(
    tree,
    '#',
    document,
    pointers,
    undefined,
    undefined,
    typeValues,
    extensionKeys,
    unitValues
  );

  const references: DocumentReference[] = [];
  collectReferences(tree, document, document.uri, references);

  return {
    pointers,
    references,
    tree,
    typeValues,
    extensionKeys,
    unitValues
  } satisfies DocumentAnalysis;
}

function collectPointerMetadata(
  node: JsonNode,
  pointer: string,
  document: TextDocument,
  result: Map<string, PointerMetadata>,
  keyNode: JsonNode | undefined,
  parentPointer: string | undefined,
  typeValues: Set<string>,
  extensionKeys: Set<string>,
  unitValues: Set<string>
): void {
  result.set(pointer, {
    valueRange: rangeFromNode(node, document),
    keyRange: keyNode ? rangeFromNode(keyNode, document) : undefined,
    node
  });

  if (keyNode && typeof keyNode.value === 'string') {
    if (keyNode.value === '$type' && typeof node.value === 'string') {
      typeValues.add(node.value);
    }

    if (keyNode.value === 'unit' && typeof node.value === 'string') {
      unitValues.add(node.value);
    }

    if (parentPointer) {
      const parentPath = pointerToPath(parentPointer);
      const parentKey = parentPath[parentPath.length - 1];
      if (parentKey === '$extensions') {
        extensionKeys.add(keyNode.value);
      }
    }
  }

  if (!node.children || node.children.length === 0) {
    return;
  }

  if (node.type === 'object') {
    for (const property of node.children) {
      const nextKey = property.children?.[0];
      const valueNode = property.children?.[1];
      if (!nextKey || !valueNode || typeof nextKey.value !== 'string') {
        continue;
      }
      const escaped = escapeJsonPointerSegment(nextKey.value);
      const childPointer = pointer === '#' ? `#/${escaped}` : `${pointer}/${escaped}`;
      collectPointerMetadata(
        valueNode,
        childPointer,
        document,
        result,
        nextKey,
        pointer,
        typeValues,
        extensionKeys,
        unitValues
      );
    }
    return;
  }

  if (node.type === 'array') {
    node.children.forEach((child, index) => {
      const segment = index.toString();
      const childPointer = pointer === '#' ? `#/${segment}` : `${pointer}/${segment}`;
      collectPointerMetadata(
        child,
        childPointer,
        document,
        result,
        undefined,
        pointer,
        typeValues,
        extensionKeys,
        unitValues
      );
    });
  }
}

function collectReferences(
  node: JsonNode,
  document: TextDocument,
  documentUri: string,
  references: DocumentReference[]
): void {
  if (!node.children || node.children.length === 0) {
    return;
  }

  if (node.type === 'object') {
    for (const property of node.children) {
      const keyNode = property.children?.[0];
      const valueNode = property.children?.[1];
      if (!keyNode || !valueNode || typeof keyNode.value !== 'string') {
        continue;
      }

      if (valueNode.type === 'string' && POINTER_REFERENCE_KEYS.has(keyNode.value)) {
        const pointerCandidate: unknown = valueNode.value;
        if (typeof pointerCandidate !== 'string') {
          continue;
        }

        const reference = resolvePointerTarget(pointerCandidate, documentUri);
        if (reference) {
          references.push({
            documentUri,
            range: rangeFromNode(valueNode, document),
            targetUri: reference.uri,
            targetPointer: reference.pointer,
            rawValue: pointerCandidate
          });
        }
      }

      collectReferences(valueNode, document, documentUri, references);
    }
    return;
  }

  if (node.type === 'array') {
    for (const child of node.children) {
      collectReferences(child, document, documentUri, references);
    }
  }
}

function resolvePointerTarget(
  value: unknown,
  baseUri: string
): { uri: string; pointer: string } | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = normalizePointerCandidate(value);
  if (normalized) {
    return { uri: baseUri, pointer: normalized };
  }

  try {
    const parsed = new URL(value, baseUri);
    if (!parsed.hash) {
      return undefined;
    }
    return { uri: parsed.toString(), pointer: normalizePointerCandidate(parsed.hash) ?? '#' };
  } catch {
    return undefined;
  }
}

function normalizePointerCandidate(value: string): string | undefined {
  if (value === '#') {
    return '#';
  }

  if (value.startsWith('#/')) {
    return value;
  }

  if (value.startsWith('/')) {
    return `#${value}`;
  }

  if (value.startsWith('#')) {
    return value.length > 1 ? `#/${value.slice(1)}` : '#';
  }

  return undefined;
}
