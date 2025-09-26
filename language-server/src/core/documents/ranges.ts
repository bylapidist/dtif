import type { Node as JsonNode } from 'jsonc-parser';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { Position, Range } from 'vscode-languageserver/node.js';

export function rangeFromNode(node: JsonNode, document: TextDocument): Range {
  const start = document.positionAt(node.offset);
  const end = document.positionAt(node.offset + Math.max(node.length, 1));
  return { start, end } satisfies Range;
}

export function rangeFromOffset(document: TextDocument, offset: number, length: number): Range {
  const start = document.positionAt(offset);
  const end = document.positionAt(offset + Math.max(length, 1));
  return { start, end } satisfies Range;
}

export function rangeContainsInclusive(range: Range, position: Position): boolean {
  if (isBefore(position, range.start)) {
    return false;
  }

  if (isBefore(range.end, position)) {
    return false;
  }

  return true;
}

export function isBefore(a: Position, b: Position): boolean {
  if (a.line < b.line) {
    return true;
  }

  if (a.line > b.line) {
    return false;
  }

  return a.character < b.character;
}

export function equalsPosition(a: Position, b: Position): boolean {
  return a.line === b.line && a.character === b.character;
}
