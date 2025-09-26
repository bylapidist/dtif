import { type Position, type TextEdit, type WorkspaceEdit } from 'vscode-languageserver/node.js';
import { DocumentAnalysisStore } from '../core/documents/analysis-store.js';
import { normalizePointer, pointerToPath, escapeJsonPointerSegment } from '../pointer-utils.js';

export function buildRenameEdit(
  store: DocumentAnalysisStore,
  uri: string,
  position: Position,
  newName: string
): WorkspaceEdit | null {
  const pointerKey = store.findPointerKey(uri, position);
  if (pointerKey) {
    return createRenameEdit(store, pointerKey.pointer, uri, newName);
  }

  const reference = store.findReference(uri, position);
  if (!reference) {
    return null;
  }

  return createRenameEdit(store, reference.targetPointer, reference.targetUri, newName);
}

function createRenameEdit(
  store: DocumentAnalysisStore,
  pointer: string,
  targetUri: string,
  newName: string
): WorkspaceEdit | null {
  const metadata = store.getPointerMetadata(targetUri, pointer);
  if (!metadata?.keyRange) {
    return null;
  }

  const outcome = computeRenameOutcome(pointer, newName);
  if (!outcome) {
    return null;
  }

  const editMap = new Map<string, TextEdit[]>();
  addEdit(editMap, targetUri, {
    range: metadata.keyRange,
    newText: JSON.stringify(outcome.newKey)
  });

  for (const reference of store.references()) {
    if (reference.targetUri !== targetUri || reference.targetPointer !== pointer) {
      continue;
    }

    const replacement = buildReferenceReplacement(reference.rawValue, outcome.newPointer);
    if (!replacement) {
      continue;
    }

    addEdit(editMap, reference.documentUri, {
      range: reference.range,
      newText: JSON.stringify(replacement)
    });
  }

  if (editMap.size === 0) {
    return null;
  }

  const changes: Record<string, TextEdit[]> = {};
  for (const [editUri, edits] of editMap) {
    changes[editUri] = edits;
  }

  return { changes } satisfies WorkspaceEdit;
}

interface RenameOutcome {
  readonly newPointer: string;
  readonly newKey: string;
}

function computeRenameOutcome(pointer: string, newName: string): RenameOutcome | null {
  const trimmed = newName.trim();
  if (!trimmed) {
    return null;
  }

  const path = pointerToPath(pointer);
  if (path.length === 0) {
    return null;
  }

  const lastSegment = path[path.length - 1];
  if (typeof lastSegment !== 'string') {
    return null;
  }

  const normalized = normalizePointer(trimmed);
  if (normalized) {
    const newPath = pointerToPath(normalized);
    if (newPath.length !== path.length) {
      return null;
    }

    const parentPath = path.slice(0, -1);
    const newParentPath = newPath.slice(0, -1);
    if (!pathsEqual(parentPath, newParentPath)) {
      return null;
    }

    const newLast = newPath[newPath.length - 1];
    if (typeof newLast !== 'string') {
      return null;
    }

    const rebuiltPointer = buildPointerFromSegments([...parentPath, newLast]);
    if (rebuiltPointer === pointer) {
      return null;
    }

    return {
      newPointer: rebuiltPointer,
      newKey: newLast
    } satisfies RenameOutcome;
  }

  const rebuiltPointer = buildPointerFromSegments([...path.slice(0, -1), trimmed]);
  if (rebuiltPointer === pointer) {
    return null;
  }

  return {
    newPointer: rebuiltPointer,
    newKey: trimmed
  } satisfies RenameOutcome;
}

function pathsEqual(a: readonly (string | number)[], b: readonly (string | number)[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((segment, index) => segment === b[index]);
}

function buildPointerFromSegments(segments: readonly (string | number)[]): string {
  if (segments.length === 0) {
    return '#';
  }

  const encoded = segments.map((segment) =>
    typeof segment === 'number' ? segment.toString() : escapeJsonPointerSegment(segment)
  );

  return `#/${encoded.join('/')}`;
}

function buildReferenceReplacement(originalValue: string, newPointer: string): string | undefined {
  const trimmed = originalValue.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = normalizePointer(trimmed);
  if (normalized) {
    if (trimmed === '#') {
      return trimmed;
    }
    if (trimmed.startsWith('#/')) {
      return newPointer;
    }
    if (trimmed.startsWith('/')) {
      return newPointer.slice(1);
    }
    if (trimmed.startsWith('#')) {
      return `#${newPointer.slice(2)}`;
    }
    return newPointer;
  }

  const hashIndex = trimmed.indexOf('#');
  if (hashIndex >= 0) {
    const prefix = trimmed.slice(0, hashIndex);
    return `${prefix}${newPointer}`;
  }

  return undefined;
}

function addEdit(map: Map<string, TextEdit[]>, uri: string, edit: TextEdit): void {
  const existing = map.get(uri);
  if (existing) {
    existing.push(edit);
    return;
  }
  map.set(uri, [edit]);
}
