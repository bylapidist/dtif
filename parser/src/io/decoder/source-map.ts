import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  type LineCounter,
  type Node as YamlNode,
  type Range as YamlRange
} from 'yaml';

import { JSON_POINTER_ROOT, appendJsonPointer } from '../../utils/json-pointer.js';
import { createSourcePosition, createSourceSpan } from '../../utils/source.js';
import type {
  DocumentHandle,
  JsonPointer,
  SourceMap,
  SourcePosition,
  SourceSpan
} from '../../types.js';

export function buildSourceMap(
  handle: DocumentHandle,
  text: string,
  contents: YamlNode | null | undefined,
  lineCounter: LineCounter
): SourceMap {
  const pointers = new Map<JsonPointer, SourceSpan>();
  const textLength = text.length;

  const rootSpan = createSourceSpan(
    handle.uri,
    toSourcePosition(lineCounter, 0),
    toSourcePosition(lineCounter, textLength)
  );
  pointers.set(JSON_POINTER_ROOT, rootSpan);

  if (contents) {
    visitNode(contents, JSON_POINTER_ROOT, pointers, handle.uri, lineCounter, textLength);
  }

  return Object.freeze({
    uri: handle.uri,
    pointers
  });
}

function visitNode(
  node: YamlNode,
  pointer: JsonPointer,
  pointers: Map<JsonPointer, SourceSpan>,
  uri: URL,
  lineCounter: LineCounter,
  textLength: number
): void {
  const span = rangeToSpan(node.range, uri, lineCounter, textLength);
  if (span) {
    pointers.set(pointer, span);
  }

  if (isAlias(node) || isScalar(node)) {
    return;
  }

  if (isMap(node)) {
    for (const pair of node.items) {
      const valueNode = pair.value;
      if (!isYamlNodeLike(valueNode)) {
        continue;
      }

      const pairKey = pair.key;
      const key = pairKey ?? (isAlias(valueNode) ? '<<' : undefined);
      const segment = formatPointerSegment(key);
      const childPointer = appendJsonPointer(pointer, segment);
      visitNode(valueNode, childPointer, pointers, uri, lineCounter, textLength);
    }
    return;
  }

  if (isSeq(node)) {
    for (let index = 0; index < node.items.length; index += 1) {
      const valueNode = node.items[index];
      if (!isYamlNodeLike(valueNode)) {
        continue;
      }
      const childPointer = appendJsonPointer(pointer, index.toString(10));
      visitNode(valueNode, childPointer, pointers, uri, lineCounter, textLength);
    }
  }
}

function rangeToSpan(
  range: YamlRange | null | undefined,
  uri: URL,
  lineCounter: LineCounter,
  textLength: number
): SourceSpan | undefined {
  if (!range) {
    return undefined;
  }

  const [start, valueEnd, nodeEnd] = range;
  const startOffset = clampOffset(start, textLength);
  const rawEnd = selectRangeEdge(valueEnd, nodeEnd, start);
  const endOffset = clampOffset(Math.max(start, rawEnd), textLength);

  const startPosition = toSourcePosition(lineCounter, startOffset);
  const endPosition = toSourcePosition(lineCounter, endOffset);

  return createSourceSpan(uri, startPosition, endPosition);
}

function toSourcePosition(lineCounter: LineCounter, offset: number): SourcePosition {
  const result = lineCounter.linePos(offset);
  const line = result.line > 0 ? result.line : 1;
  const column = result.col > 0 ? result.col : offset + 1;
  return createSourcePosition(offset, line, column);
}

function clampOffset(offset: number, textLength: number): number {
  if (!Number.isFinite(offset)) {
    return 0;
  }
  return Math.min(Math.max(0, Math.trunc(offset)), textLength);
}

function formatPointerSegment(key: unknown): string {
  if (key === null || key === undefined) {
    return '';
  }

  if (isScalar(key)) {
    return formatPointerSegment(key.value);
  }

  if (isAlias(key)) {
    return key.source;
  }

  if (isMap(key) || isSeq(key)) {
    return describeUnknownObject(key);
  }

  const primitive = toPrimitiveString(key);
  if (primitive !== undefined) {
    return primitive;
  }

  if (typeof key === 'object') {
    const source: unknown = Reflect.get(key, 'source');
    if (typeof source === 'string') {
      return source;
    }

    const value: unknown = Reflect.get(key, 'value');
    if (value !== undefined && value !== key) {
      const formattedValue = formatPointerSegment(value);
      if (formattedValue !== '') {
        return formattedValue;
      }
    }

    const toJSONCandidate: unknown = Reflect.get(key, 'toJSON');
    if (isCallable(toJSONCandidate)) {
      try {
        const jsonValue = toJSONCandidate.call(key);
        if (jsonValue !== undefined && jsonValue !== key) {
          const formattedJson = formatPointerSegment(jsonValue);
          if (formattedJson !== '') {
            return formattedJson;
          }
        }
      } catch {
        // ignore serialization failures and fall through to the generic formatters
      }
    }

    const serialized = safeJsonStringify(key);
    if (serialized) {
      return serialized;
    }

    return describeUnknownObject(key);
  }

  if (typeof key === 'function') {
    return key.name ? `[Function ${key.name}]` : '[Function]';
  }

  return '[unknown]';
}

function isYamlNodeLike(value: unknown): value is YamlNode {
  return isAlias(value) || isScalar(value) || isMap(value) || isSeq(value);
}

function selectRangeEdge(...candidates: (number | null | undefined)[]): number {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return 0;
}

function toPrimitiveString(value: unknown): string | undefined {
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
      return Number.isFinite(value) ? value.toString(10) : String(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'bigint':
      return value.toString(10);
    case 'symbol':
      return value.description ?? value.toString();
    default:
      return undefined;
  }
}

function safeJsonStringify(value: unknown): string | undefined {
  try {
    const result = JSON.stringify(value);
    return typeof result === 'string' ? result : undefined;
  } catch {
    return undefined;
  }
}

function describeUnknownObject(value: object): string {
  return Object.prototype.toString.call(value);
}

function isCallable(value: unknown): value is (this: unknown) => unknown {
  return typeof value === 'function';
}
