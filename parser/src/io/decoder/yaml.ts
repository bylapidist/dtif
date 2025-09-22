import { LineCounter, parseDocument, type Document as YamlDocument, type YAMLError } from 'yaml';

import { DecoderError } from './errors.js';

const MAX_ALIAS_COUNT = 1000;

export interface ParsedYamlDocument {
  readonly document: YamlDocument;
  readonly lineCounter: LineCounter;
}

export function parseYaml(text: string): ParsedYamlDocument {
  const lineCounter = new LineCounter();
  const document = parseDocument(text, { lineCounter, merge: true });

  if (document.errors.length > 0) {
    const [error] = document.errors;
    throw new DecoderError(formatYamlError(error));
  }

  return { document, lineCounter };
}

export function toJavaScript(document: YamlDocument): unknown {
  try {
    return document.toJS({ maxAliasCount: MAX_ALIAS_COUNT });
  } catch (error) {
    throw new DecoderError('Failed to convert DTIF document to JavaScript.', { cause: error });
  }
}

function formatYamlError(error: YAMLError): string {
  if (error.linePos && error.linePos.length > 0) {
    const [{ line, col }] = error.linePos;
    return `${error.message} (line ${line}, column ${col})`;
  }
  return error.message;
}
