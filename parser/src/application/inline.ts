import type { InlineDocumentRequestInput } from './requests.js';
import type { DocumentHandle } from '../types.js';
import type { DecodedDocument } from '../domain/models.js';
import { cloneJsonValue } from '../utils/clone-json.js';
import { decodeBytes } from '../io/decoder/encoding.js';
import { createSyntheticSourceMap } from '../io/decoder/synthetic-source-map.js';
import { normalizeInlineYamlText } from '../io/decoder/inline-yaml.js';
import { parseYaml, toJavaScript } from '../io/decoder/yaml.js';
import { buildSourceMap } from '../io/decoder/source-map.js';

export function createInlineDocumentHandle(input: InlineDocumentRequestInput): DocumentHandle {
  const encoder = new TextEncoder();
  const bytes = typeof input.text === 'string' ? encoder.encode(input.text) : new Uint8Array(0);
  const uri = new URL(input.uri);

  return Object.freeze({
    uri,
    contentType: input.contentType,
    bytes,
    ...(input.text !== undefined ? { text: input.text } : {}),
    ...(input.data !== undefined ? { data: cloneJsonValue(input.data) } : {})
  });
}

export function decodeInlineDocument(handle: DocumentHandle): DecodedDocument {
  if (hasProvidedData(handle)) {
    return Object.freeze(createDocumentFromProvidedData(handle));
  }

  const { text: decodedText } = decodeBytes(handle.bytes);
  const text = normalizeInlineYamlText(decodedText);
  const { document: yamlDocument, lineCounter } = parseYaml(text);
  const data = toJavaScript(yamlDocument);
  const sourceMap = buildSourceMap(handle, text, yamlDocument.contents, lineCounter);

  return Object.freeze({
    identity: Object.freeze({
      uri: handle.uri,
      contentType: handle.contentType
    }),
    bytes: handle.bytes,
    text,
    data,
    sourceMap
  });
}

function createDocumentFromProvidedData(handle: ProvidedDataHandle): DecodedDocument {
  const data = cloneJsonValue(handle.data);

  if (typeof handle.text === 'string' && handle.text.length > 0) {
    const text = normalizeInlineYamlText(handle.text);
    const { document: yamlDocument, lineCounter } = parseYaml(text);
    const sourceMap = buildSourceMap(handle, text, yamlDocument.contents, lineCounter);

    return {
      identity: Object.freeze({
        uri: handle.uri,
        contentType: handle.contentType
      }),
      bytes: handle.bytes,
      text,
      data,
      sourceMap
    } satisfies DecodedDocument;
  }

  const text = normalizeInlineYamlText(handle.text ?? '');
  const sourceMap = createSyntheticSourceMap(handle.uri, data);

  return {
    identity: Object.freeze({
      uri: handle.uri,
      contentType: handle.contentType
    }),
    bytes: handle.bytes,
    text,
    data,
    sourceMap
  } satisfies DecodedDocument;
}

type ProvidedDataHandle = DocumentHandle & { data: NonNullable<DocumentHandle['data']> };

function hasProvidedData(handle: DocumentHandle): handle is ProvidedDataHandle {
  return handle.data !== undefined && isDesignTokenDocument(handle.data);
}

function isDesignTokenDocument(value: unknown): value is ProvidedDataHandle['data'] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (value instanceof URL || value instanceof Uint8Array) {
    return false;
  }

  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
