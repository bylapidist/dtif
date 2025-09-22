import type { DocumentHandle, RawDocument } from '../types.js';
import { decodeBytes } from './decoder/encoding.js';
import { buildSourceMap } from './decoder/source-map.js';
import { parseYaml, toJavaScript } from './decoder/yaml.js';

export { DecoderError } from './decoder/errors.js';

export async function decodeDocument(handle: DocumentHandle): Promise<RawDocument> {
  const { text } = decodeBytes(handle.bytes);
  const { document: yamlDocument, lineCounter } = parseYaml(text);
  const data = toJavaScript(yamlDocument);
  const sourceMap = buildSourceMap(handle, text, yamlDocument.contents, lineCounter);

  return Object.freeze({
    uri: handle.uri,
    contentType: handle.contentType,
    bytes: handle.bytes,
    text,
    data,
    sourceMap
  });
}
