import { CompletionItemKind, MarkupKind, type CompletionItem } from 'vscode-languageserver/node.js';
import { DocumentAnalysisStore } from '../../core/documents/analysis-store.js';
import { getRegistryTypes, type RegistryTypeDefinition } from './registry.js';

export function buildTypeCompletionItems(store: DocumentAnalysisStore): CompletionItem[] {
  const items: CompletionItem[] = [];
  const seen = new Set<string>();

  for (const [typeName, definition] of getRegistryTypes()) {
    const documentation = buildTypeDocumentation(typeName, definition);
    items.push({
      label: typeName,
      kind: CompletionItemKind.EnumMember,
      sortText: `1_${typeName}`,
      detail: formatRegistryDetail(definition),
      documentation: documentation ? { kind: MarkupKind.Markdown, value: documentation } : undefined
    });
    seen.add(typeName);
  }

  for (const observed of store.getTypeValues()) {
    if (seen.has(observed)) {
      continue;
    }
    items.push({
      label: observed,
      kind: CompletionItemKind.EnumMember,
      sortText: `2_${observed}`,
      detail: 'Observed in workspace'
    });
    seen.add(observed);
  }

  return items;
}

function buildTypeDocumentation(
  name: string,
  definition: RegistryTypeDefinition
): string | undefined {
  const lines: string[] = [];
  lines.push(`**Vendor:** ${definition.vendor}`);
  if (definition.owner) {
    lines.push(`**Owner:** ${definition.owner}`);
  }
  if (definition.contact) {
    lines.push(`**Contact:** ${definition.contact}`);
  }
  if (definition.canonical && definition.canonical.length > 0) {
    const canonical = definition.canonical.map((value) => `\`${value}\``).join(', ');
    lines.push(`Canonical values: ${canonical}`);
  }
  if (definition.extensions) {
    lines.push(definition.extensions);
  }
  if (definition.spec) {
    lines.push(`[Specification](${definition.spec})`);
  }

  if (lines.length === 0) {
    return undefined;
  }

  return lines.join('\n\n');
}

function formatRegistryDetail(definition: RegistryTypeDefinition): string {
  if (definition.owner) {
    return `${definition.vendor} • ${definition.owner}`;
  }
  return definition.vendor;
}
