import {
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
  type CompletionItem
} from 'vscode-languageserver/node.js';
import { DocumentAnalysisStore } from '../../core/documents/analysis-store.js';

const EXTENSION_NAMESPACE_SNIPPET = {
  label: 'org.example.design.tokens',
  kind: CompletionItemKind.Module,
  sortText: '0_org.example.design.tokens',
  detail: 'Reverse-DNS namespace snippet',
  insertTextFormat: InsertTextFormat.Snippet,
  insertText: '${1:org}.${2:example}.${3:feature}',
  documentation: {
    kind: MarkupKind.Markdown,
    value:
      'DTIF requires `$extensions` keys to use reverse-DNS namespaces so vendor metadata stays isolated.'
  }
} satisfies CompletionItem;

export function buildExtensionKeyCompletionItems(store: DocumentAnalysisStore): CompletionItem[] {
  const items: CompletionItem[] = [EXTENSION_NAMESPACE_SNIPPET];
  const seen = new Set<string>([EXTENSION_NAMESPACE_SNIPPET.label]);

  for (const key of store.getExtensionKeys()) {
    if (seen.has(key)) {
      continue;
    }
    items.push({
      label: key,
      kind: CompletionItemKind.Module,
      sortText: `1_${key}`,
      detail: 'Observed in workspace'
    });
    seen.add(key);
  }

  return items;
}
