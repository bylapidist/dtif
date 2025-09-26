import type { Node as JsonNode } from 'jsonc-parser';
import type { Range } from 'vscode-languageserver/node.js';

export interface DocumentReference {
  readonly documentUri: string;
  readonly range: Range;
  readonly targetUri: string;
  readonly targetPointer: string;
  readonly rawValue: string;
}

export interface PointerMetadata {
  readonly valueRange: Range;
  readonly keyRange?: Range;
  readonly node: JsonNode;
}

export interface DocumentAnalysis {
  readonly pointers: ReadonlyMap<string, PointerMetadata>;
  readonly references: readonly DocumentReference[];
  readonly tree: JsonNode;
  readonly typeValues: ReadonlySet<string>;
  readonly extensionKeys: ReadonlySet<string>;
  readonly unitValues: ReadonlySet<string>;
}
