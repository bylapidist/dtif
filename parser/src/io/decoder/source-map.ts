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
import type { DocumentHandle, JsonPointer, SourceMap, SourceSpan } from '../../types.js';

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

  if (node == null || isAlias(node) || isScalar(node)) {
    return;
  }

  if (isMap(node)) {
    for (const pair of node.items as Array<{ key: unknown; value: unknown }>) {
      const valueNode = pair?.value as YamlNode | null | undefined;
      if (!valueNode) {
        continue;
      }
      const key = pair?.key ?? (isAlias(valueNode) ? '<<' : undefined);
      const segment = formatPointerSegment(key);
      const childPointer = appendJsonPointer(pointer, segment);
      visitNode(valueNode, childPointer, pointers, uri, lineCounter, textLength);
    }
    return;
  }

  if (isSeq(node)) {
    node.items.forEach((item, index) => {
      const valueNode = item as YamlNode | null | undefined;
      if (!valueNode) {
        return;
      }
      const childPointer = appendJsonPointer(pointer, String(index));
      visitNode(valueNode, childPointer, pointers, uri, lineCounter, textLength);
    });
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
  const rawEnd = valueEnd ?? nodeEnd ?? start;
  const endOffset = clampOffset(Math.max(start, rawEnd), textLength);

  const startPosition = toSourcePosition(lineCounter, startOffset);
  const endPosition = toSourcePosition(lineCounter, endOffset);

  return createSourceSpan(uri, startPosition, endPosition);
}

function toSourcePosition(lineCounter: LineCounter, offset: number) {
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

  if (typeof key === 'string' || typeof key === 'number' || typeof key === 'boolean') {
    return String(key);
  }

  if (typeof (key as { toJSON?: () => unknown }).toJSON === 'function') {
    const value = (key as { toJSON: () => unknown }).toJSON();
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  if (typeof (key as { value?: unknown }).value !== 'undefined') {
    const value = (key as { value?: unknown }).value;
    if (value !== undefined) {
      return String(value);
    }
  }

  if (typeof (key as { source?: unknown }).source === 'string') {
    return String((key as { source: string }).source);
  }

  return String(key);
}
