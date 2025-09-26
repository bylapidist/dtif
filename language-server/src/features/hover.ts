import { MarkupKind, type Hover, type Position } from 'vscode-languageserver/node.js';
import { DocumentAnalysisStore } from '../core/documents/analysis-store.js';
import { formatHoverMarkdown } from './hover/markdown.js';

export function buildHover(
  store: DocumentAnalysisStore,
  uri: string,
  position: Position
): Hover | null {
  const reference = store.findReference(uri, position);
  if (!reference) {
    return null;
  }

  const targetMetadata = store.getPointerMetadata(reference.targetUri, reference.targetPointer);
  const markdown = formatHoverMarkdown({
    reference,
    targetNode: targetMetadata?.node,
    targetUri: reference.targetUri,
    sameDocument: reference.targetUri === uri
  });

  if (!markdown) {
    return null;
  }

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: markdown
    },
    range: reference.range
  } satisfies Hover;
}
