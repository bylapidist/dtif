import {
  LineCounter,
  isAlias,
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  type Document as YamlDocument,
  type Node as YamlNode,
  type Range as YamlRange,
  type YAMLError
} from 'yaml';

import { JSON_POINTER_ROOT, appendJsonPointer } from '../utils/json-pointer.js';
import { createSourcePosition, createSourceSpan } from '../utils/source.js';
import type {
  DocumentHandle,
  JsonPointer,
  RawDocument,
  SourceMap,
  SourceSpan
} from '../types.js';

const TEXT_DECODER_OPTIONS: TextDecoderOptions & { fatal: true } = { fatal: true };
const MAX_ALIAS_COUNT = 1000;

export class DecoderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DecoderError';
  }
}

export async function decodeDocument(handle: DocumentHandle): Promise<RawDocument> {
  const { text } = decodeBytes(handle.bytes);

  const lineCounter = new LineCounter();
  const yamlDocument = parseDocument(text, { lineCounter, merge: true });

  if (yamlDocument.errors.length > 0) {
    const [error] = yamlDocument.errors;
    throw new DecoderError(formatYamlError(error));
  }

  let data: unknown;
  try {
    data = yamlDocument.toJS({ maxAliasCount: MAX_ALIAS_COUNT });
  } catch (error) {
    throw new DecoderError('Failed to convert DTIF document to JavaScript.', { cause: error });
  }

  const sourceMap = buildSourceMap(handle, text, yamlDocument, lineCounter);

  return Object.freeze({
    uri: handle.uri,
    contentType: handle.contentType,
    bytes: handle.bytes,
    text,
    data,
    sourceMap
  });
}

function decodeBytes(bytes: Uint8Array): { text: string } {
  if (bytes.length === 0) {
    return { text: '' };
  }

  const { encoding, offset } = detectEncoding(bytes);

  try {
    const decoder = new TextDecoder(encoding, TEXT_DECODER_OPTIONS);
    const view = offset > 0 ? bytes.subarray(offset) : bytes;
    const text = decoder.decode(view);
    return { text };
  } catch (error) {
    throw new DecoderError(`Failed to decode DTIF document as ${encoding.toUpperCase()}.`, {
      cause: error
    });
  }
}

function detectEncoding(bytes: Uint8Array): { encoding: string; offset: number } {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { encoding: 'utf-8', offset: 3 };
  }

  if (bytes.length >= 2) {
    const lead = bytes[0];
    const trail = bytes[1];
    if (lead === 0xfe && trail === 0xff) {
      return { encoding: 'utf-16be', offset: 2 };
    }
    if (lead === 0xff && trail === 0xfe) {
      return { encoding: 'utf-16le', offset: 2 };
    }
  }

  return { encoding: 'utf-8', offset: 0 };
}

function buildSourceMap(
  handle: DocumentHandle,
  text: string,
  yamlDocument: YamlDocument,
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

  const contents = yamlDocument.contents as YamlNode | null | undefined;
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

function formatYamlError(error: YAMLError): string {
  if (error.linePos && error.linePos.length > 0) {
    const [{ line, col }] = error.linePos;
    return `${error.message} (line ${line}, column ${col})`;
  }
  return error.message;
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
