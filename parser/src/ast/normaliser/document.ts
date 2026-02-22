import { DiagnosticCodes } from '../../diagnostics/codes.js';
import { JSON_POINTER_ROOT, appendJsonPointer } from '../../utils/json-pointer.js';
import type { DocumentChildNode, DocumentAst } from '../nodes.js';
import { readOptionalStringField } from './fields.js';
import type { NormaliserContext } from './context.js';
import { getSourceSpan } from './context.js';
import { extractMetadata } from './metadata.js';
import { normalizeNode } from './nodes.js';
import { validateCollectionMemberOrder } from './ordering.js';
import { normalizeOverrides } from './overrides.js';
import { freezeDocumentAst, isPlainObject } from './utils.js';

const SUPPORTED_DTIF_MAJOR_VERSION = 1;

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
  validateCollectionMemberOrder(context, data, JSON_POINTER_ROOT);
  const schemaField = readOptionalStringField(context, data, '$schema', JSON_POINTER_ROOT);
  const versionField = readOptionalStringField(context, data, '$version', JSON_POINTER_ROOT);
  warnOnFutureMajorVersion(context, versionField?.value);
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

function warnOnFutureMajorVersion(context: NormaliserContext, value: string | undefined): void {
  if (!value) {
    return;
  }

  const major = extractMajorVersion(value);
  if (major === undefined || major <= SUPPORTED_DTIF_MAJOR_VERSION) {
    return;
  }

  const pointer = appendJsonPointer(JSON_POINTER_ROOT, '$version');
  context.diagnostics.push({
    code: DiagnosticCodes.normaliser.FUTURE_MAJOR_VERSION,
    message: `Document $version "${value}" uses major ${String(
      major
    )}, which is newer than supported major ${String(SUPPORTED_DTIF_MAJOR_VERSION)}.`,
    severity: 'warning',
    pointer,
    span: getSourceSpan(context, pointer)
  });
}

function extractMajorVersion(value: string): number | undefined {
  const [core] = value.split('-', 1);
  if (!core) {
    return undefined;
  }

  const [majorPart] = core.split('.', 1);
  if (!majorPart || !/^\d+$/u.test(majorPart)) {
    return undefined;
  }

  return Number.parseInt(majorPart, 10);
}
