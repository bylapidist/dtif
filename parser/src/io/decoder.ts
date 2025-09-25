import type { DocumentHandle, RawDocument } from '../types.js';
import { decodeBytes } from './decoder/encoding.js';
import { buildSourceMap } from './decoder/source-map.js';
import { parseYaml, toJavaScript } from './decoder/yaml.js';
import { cloneJsonValue } from '../utils/clone-json.js';
import { createSyntheticSourceMap } from './decoder/synthetic-source-map.js';

export { DecoderError } from './decoder/errors.js';

function hasProvidedData(handle: DocumentHandle): handle is ProvidedDataHandle {
  return handle.data !== undefined;
}

export function decodeDocument(handle: DocumentHandle): Promise<RawDocument> {
  if (hasProvidedData(handle)) {
    return Promise.resolve(Object.freeze(createRawDocumentFromProvidedData(handle)));
  }

  const { text } = decodeBytes(handle.bytes);
  const { document: yamlDocument, lineCounter } = parseYaml(text);
  const data = toJavaScript(yamlDocument);
  const sourceMap = buildSourceMap(handle, text, yamlDocument.contents, lineCounter);

  return Promise.resolve(
    Object.freeze({
      uri: handle.uri,
      contentType: handle.contentType,
      bytes: handle.bytes,
      text,
      data,
      sourceMap
    })
  );
}

type ProvidedDataHandle = DocumentHandle & { data: NonNullable<DocumentHandle['data']> };

function createRawDocumentFromProvidedData(handle: ProvidedDataHandle): RawDocument {
  const data = cloneJsonValue(handle.data);

  if (typeof handle.text === 'string' && handle.text.length > 0) {
    const text = handle.text;
    const { document: yamlDocument, lineCounter } = parseYaml(text);
    const sourceMap = buildSourceMap(handle, text, yamlDocument.contents, lineCounter);

    return {
      uri: handle.uri,
      contentType: handle.contentType,
      bytes: handle.bytes,
      text,
      data,
      sourceMap
    } satisfies RawDocument;
  }

  const text = handle.text ?? '';
  const sourceMap = createSyntheticSourceMap(handle.uri, data);

  return {
    uri: handle.uri,
    contentType: handle.contentType,
    bytes: handle.bytes,
    text,
    data,
    sourceMap
  } satisfies RawDocument;
}
