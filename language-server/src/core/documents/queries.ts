import type { Position } from 'vscode-languageserver/node.js';
import { pointerToPath } from '../../pointer-utils.js';
import type { DocumentAnalysis, DocumentReference, PointerMetadata } from './types.js';
import { equalsPosition, rangeContainsInclusive } from './ranges.js';

export function findReferenceAtPosition(
  references: readonly DocumentReference[],
  position: Position
): DocumentReference | null {
  for (const reference of references) {
    if (rangeContainsInclusive(reference.range, position)) {
      return reference;
    }
  }
  return null;
}

export interface PointerKeyMatch {
  readonly pointer: string;
  readonly metadata: PointerMetadata;
}

export function findPointerKeyAtPosition(
  pointers: ReadonlyMap<string, PointerMetadata>,
  position: Position
): PointerKeyMatch | null {
  for (const [pointer, metadata] of pointers) {
    if (metadata.keyRange && rangeContainsInclusive(metadata.keyRange, position)) {
      return { pointer, metadata } satisfies PointerKeyMatch;
    }
  }
  return null;
}

export interface PointerMatch {
  readonly pointer: string;
  readonly inKey: boolean;
}

export function matchPointerInAnalysis(
  analysis: DocumentAnalysis,
  position: Position
): PointerMatch | null {
  let bestMatch: { pointer: string; inKey: boolean; depth: number } | null = null;

  for (const [pointer, metadata] of analysis.pointers) {
    if (metadata.keyRange && rangeContainsInclusive(metadata.keyRange, position)) {
      const depth = pointerDepth(pointer);
      if (!bestMatch || depth >= bestMatch.depth) {
        bestMatch = { pointer, inKey: true, depth };
      }
      continue;
    }

    if (rangeContainsInclusive(metadata.valueRange, position)) {
      const depth = pointerDepth(pointer);
      if (!bestMatch || depth >= bestMatch.depth) {
        bestMatch = { pointer, inKey: false, depth };
      }
    }
  }

  if (!bestMatch) {
    return null;
  }

  return { pointer: bestMatch.pointer, inKey: bestMatch.inKey } satisfies PointerMatch;
}

export function referenceIntersectsPosition(
  reference: DocumentReference,
  position: Position
): boolean {
  return (
    rangeContainsInclusive(reference.range, position) ||
    equalsPosition(reference.range.end, position) ||
    equalsPosition(reference.range.start, position)
  );
}

function pointerDepth(pointer: string): number {
  if (pointer === '#') {
    return 0;
  }

  return pointerToPath(pointer).length;
}
