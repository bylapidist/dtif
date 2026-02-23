import type {
  AstField,
  DocumentAst,
  DocumentChildNode,
  NodeMetadata,
  OverrideNode
} from '../nodes.js';
import type { JsonPointer } from '../../domain/primitives.js';
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
  const frozenEntries: Record<string, unknown> = {};

  for (const key of Object.keys(value)) {
    frozenEntries[key] = freezeValue(value[key]);
  }

  return Object.freeze(frozenEntries);
}

export function freezeValue<T>(value: readonly T[]): readonly T[];
export function freezeValue<T>(value: Readonly<Record<string, T>>): Readonly<Record<string, T>>;
export function freezeValue<T>(value: T): T;
export function freezeValue(value: unknown): unknown {
  if (isReadonlyArray(value)) {
    return freezeArray(value);
  }

  if (isPlainObject(value)) {
    const frozenEntries: Record<string, unknown> = {};

    for (const key of Object.keys(value)) {
      frozenEntries[key] = freezeValue(value[key]);
    }

    return Object.freeze(frozenEntries);
  }

  return value;
}

function freezeArray<T>(array: readonly T[]): readonly T[] {
  return Object.freeze(array.map((entry) => freezeValue(entry)));
}

function isReadonlyArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return false;
  }

  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
