import { getLocation } from 'jsonc-parser';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { type CompletionItem, type Position } from 'vscode-languageserver/node.js';
import { DocumentAnalysisStore } from '../../core/documents/analysis-store.js';
import { parentPointer, pathToPointer, pointerToPath } from '../../pointer-utils.js';
import { buildTypeCompletionItems } from './type-items.js';
import { buildUnitCompletionItems } from './unit-items.js';
import { buildExtensionKeyCompletionItems } from './extension-items.js';

export interface BuildCompletionsOptions {
  readonly document: TextDocument;
  readonly position: Position;
  readonly store: DocumentAnalysisStore;
}

export function buildCompletions(options: BuildCompletionsOptions): CompletionItem[] {
  const { document, position, store } = options;
  const pointerMatch = store.matchPointer(document.uri, position);

  const completions: CompletionItem[] = [];

  if (pointerMatch) {
    const pointerPath = pointerToPath(pointerMatch.pointer);
    const lastSegment = pointerPath[pointerPath.length - 1];

    if (!pointerMatch.inKey && lastSegment === '$type') {
      completions.push(...buildTypeCompletionItems(store));
    }

    if (!pointerMatch.inKey && lastSegment === 'unit') {
      completions.push(...buildUnitCompletionItems(store, document.uri, pointerMatch.pointer));
    }

    if (pointerMatch.inKey) {
      const parent = parentPointer(pointerMatch.pointer);
      const parentPath = parent ? pointerToPath(parent) : [];
      const parentKey = parentPath[parentPath.length - 1];
      if (parentKey === '$extensions') {
        completions.push(...buildExtensionKeyCompletionItems(store));
      }
    }
  }

  if (completions.length > 0) {
    return completions;
  }

  const offset = document.offsetAt(position);
  const location = getLocation(document.getText(), offset);
  const path = location.path;
  const pointerFromLocation = path.length > 0 ? pathToPointer(path) : '#';
  const activeSegment = path[path.length - 1];

  if (activeSegment === '$type') {
    return buildTypeCompletionItems(store);
  }

  if (activeSegment === 'unit') {
    return buildUnitCompletionItems(
      store,
      document.uri,
      pointerMatch?.pointer ?? pointerFromLocation
    );
  }

  if (location.isAtPropertyKey && path[path.length - 1] === '') {
    const containerPointer = pathToPointer(path.slice(0, -1));
    const segments = pointerToPath(containerPointer);
    if (segments[segments.length - 1] === '$extensions') {
      return buildExtensionKeyCompletionItems(store);
    }
  }

  return [];
}
