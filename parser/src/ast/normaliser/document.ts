import { DiagnosticCodes } from '../../diagnostics/codes.js';
import { JSON_POINTER_ROOT, appendJsonPointer } from '../../utils/json-pointer.js';
import type { DocumentChildNode, DocumentAst } from '../nodes.js';
import { readOptionalStringField } from './fields.js';
import type { NormaliserContext } from './context.js';
import { getSourceSpan } from './context.js';
import { extractMetadata } from './metadata.js';
import { normalizeNode } from './nodes.js';
import { normalizeOverrides } from './overrides.js';
import { freezeDocumentAst, isPlainObject } from './utils.js';

export function buildDocumentAst(context: NormaliserContext): DocumentAst | undefined {
  const { document } = context;
  const data = document.data;

  if (!isPlainObject(data)) {
    context.diagnostics.push({
      code: DiagnosticCodes.normaliser.INVALID_ROOT,
      message: 'DTIF document root must be a JSON object.',
      severity: 'error',
      pointer: JSON_POINTER_ROOT,
      span: getSourceSpan(context, JSON_POINTER_ROOT)
    });
    return undefined;
  }

  const metadata = extractMetadata(context, data, JSON_POINTER_ROOT);
  const schemaField = readOptionalStringField(context, data, '$schema', JSON_POINTER_ROOT);
  const versionField = readOptionalStringField(context, data, '$version', JSON_POINTER_ROOT);
  const overrides = normalizeOverrides(context, data, JSON_POINTER_ROOT);

  const children: DocumentChildNode[] = [];
  for (const [name, value] of Object.entries(data)) {
    if (name.startsWith('$')) {
      continue;
    }

    const pointer = appendJsonPointer(JSON_POINTER_ROOT, name);
    const node = normalizeNode(context, name, value, pointer);
    if (node) {
      children.push(node);
    }
  }

  return freezeDocumentAst({
    kind: 'document',
    uri: document.identity.uri,
    pointer: JSON_POINTER_ROOT,
    span: getSourceSpan(context, JSON_POINTER_ROOT),
    schema: schemaField,
    version: versionField,
    metadata,
    children,
    overrides
  });
}
