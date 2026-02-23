import type { DocumentHandle } from '../../types.js';
import type { DecodedDocument } from '../../domain/models.js';
import { normalizeInlineYamlText } from '../../utils/inline-yaml.js';
import { decodeBytes } from './encoding.js';
import { buildSourceMap } from './source-map.js';
import { parseYaml, toJavaScript } from './yaml.js';
import { cloneJsonValue } from '../../utils/clone-json.js';
import { createSyntheticSourceMap } from './synthetic-source-map.js';

export type ProvidedDataHandle = DocumentHandle & { data: NonNullable<DocumentHandle['data']> };

export function decodeTextDocument(handle: DocumentHandle): DecodedDocument {
  const { text: decodedText } = decodeBytes(handle.bytes);
  const text = normalizeInlineYamlText(decodedText);
  const { document: yamlDocument, lineCounter } = parseYaml(text);
  const data = toJavaScript(yamlDocument);
  const sourceMap = buildSourceMap(handle, text, yamlDocument.contents, lineCounter);

  return Object.freeze(createDecodedDocument(handle, text, data, sourceMap));
}

export function decodeProvidedDataDocument(handle: ProvidedDataHandle): DecodedDocument {
  const data = cloneJsonValue(handle.data);

  if (typeof handle.text === 'string' && handle.text.length > 0) {
    const text = normalizeInlineYamlText(handle.text);
    const { document: yamlDocument, lineCounter } = parseYaml(text);
    const sourceMap = buildSourceMap(handle, text, yamlDocument.contents, lineCounter);

    return Object.freeze(createDecodedDocument(handle, text, data, sourceMap));
  }

  const text = normalizeInlineYamlText(handle.text ?? '');
  const sourceMap = createSyntheticSourceMap(handle.uri, data);

  return Object.freeze(createDecodedDocument(handle, text, data, sourceMap));
}

function createDecodedDocument(
  handle: DocumentHandle,
  text: string,
  data: unknown,
  sourceMap: DecodedDocument['sourceMap']
): DecodedDocument {
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
