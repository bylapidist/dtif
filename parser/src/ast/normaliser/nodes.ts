import { DiagnosticCodes } from '../../diagnostics/codes.js';
import { appendJsonPointer } from '../../utils/json-pointer.js';
import type { JsonPointer } from '../../types.js';
import type {
  AliasNode,
  CollectionNode,
  DocumentChildNode,
  NodeMetadata,
  TokenNode
} from '../nodes.js';
import type { NormaliserContext } from './context.js';
import { getSourceSpan } from './context.js';
import { readOptionalStringField } from './fields.js';
import { extractMetadata } from './metadata.js';
import {
  validateCanonicalValueOrdering,
  validateCollectionMemberOrder,
  validateTokenMemberOrder
} from './ordering.js';
import { createField, EMPTY_CHILDREN, isPlainObject } from './utils.js';

export function normalizeNode(
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
  validateCollectionMemberOrder(context, value, pointer);

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
  validateTokenMemberOrder(context, value, pointer);

  const typeField = readOptionalStringField(context, value, '$type', pointer);
  const valueField =
    '$value' in value
      ? createField(context, value.$value, appendJsonPointer(pointer, '$value'))
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

  if (valueField) {
    validateCanonicalValueOrdering(context, valueField.value, valueField.pointer);
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

function isTokenLike(value: Record<string, unknown>): boolean {
  return '$value' in value || '$ref' in value || '$type' in value;
}
