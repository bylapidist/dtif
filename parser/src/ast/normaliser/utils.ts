import type {
  AstField,
  DocumentAst,
  DocumentChildNode,
  NodeMetadata,
  OverrideNode
} from '../nodes.js';
import type { JsonPointer } from '../../types.js';
import type { NormaliserContext } from './context.js';
import { getSourceSpan } from './context.js';

export const EMPTY_METADATA: NodeMetadata = Object.freeze({});
export const EMPTY_CHILDREN: readonly DocumentChildNode[] = Object.freeze([]);
export const EMPTY_OVERRIDES: readonly OverrideNode[] = Object.freeze([]);

export function freezeDocumentAst(ast: DocumentAst): DocumentAst {
  const children = ast.children.length === 0 ? EMPTY_CHILDREN : ast.children;
  const overrides = ast.overrides.length === 0 ? EMPTY_OVERRIDES : ast.overrides;
  return Object.freeze({
    ...ast,
    children,
    overrides
  });
}

export function createField<T>(
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

export function freezeRecord(value: Record<string, unknown>): Readonly<Record<string, unknown>> {
  const entries = Object.entries(value).map(([key, entry]) => [key, freezeValue(entry)] as const);
  return Object.freeze(Object.fromEntries(entries));
}

export function freezeValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => freezeValue(entry))) as unknown as T;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, entry]) => [key, freezeValue(entry)] as const
    );
    return Object.freeze(Object.fromEntries(entries)) as unknown as T;
  }

  return value;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
