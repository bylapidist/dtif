import type { Location, Position } from 'vscode-languageserver/node.js';
import { DocumentAnalysisStore } from '../core/documents/analysis-store.js';

export function findDefinition(
  store: DocumentAnalysisStore,
  uri: string,
  position: Position
): Location | null {
  const reference = store.findReference(uri, position);
  if (!reference) {
    return null;
  }

  const targetMetadata = store.getPointerMetadata(reference.targetUri, reference.targetPointer);
  if (!targetMetadata) {
    return null;
  }

  return { uri: reference.targetUri, range: targetMetadata.valueRange } satisfies Location;
}
