import type { DesignTokenInterchangeFormat } from '@lapidist/dtif-schema';
import type { DiagnosticBag } from './diagnostics/bag.js';
import type { DiagnosticCode } from './diagnostics/codes.js';
import type { DiagnosticSeverity } from './diagnostics/severity.js';
import type { DocumentAst } from './ast/nodes.js';
import type { DocumentGraph } from './graph/nodes.js';
import type { DocumentResolver } from './resolver/index.js';
import type { ExtensionEvaluation } from './plugins/index.js';

export type JsonPointer = `#${string}`;

export type ParseInput =
  | string
  | Uint8Array
  | URL
  | ParseInputRecord
  | ParseDataInputRecord
  | DesignTokenInterchangeFormat;

export interface ParseInputRecord {
  readonly uri?: string | URL;
  readonly content: string | Uint8Array;
  readonly contentType?: ContentType;
}

export interface ParseDataInputRecord {
  readonly uri?: string | URL;
  readonly data: DesignTokenInterchangeFormat;
  readonly contentType?: ContentType;
}

export type ContentType = 'application/json' | 'application/yaml';

export interface SourcePosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

export interface SourceSpan {
  readonly uri: URL;
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

export interface SourceMap {
  readonly uri: URL;
  readonly pointers: ReadonlyMap<JsonPointer, SourceSpan>;
}

export interface RelatedInformation {
  readonly message: string;
  readonly pointer?: JsonPointer;
  readonly span?: SourceSpan;
}

export interface Diagnostic {
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly severity: DiagnosticSeverity;
  readonly pointer?: JsonPointer;
  readonly span?: SourceSpan;
  readonly related?: readonly RelatedInformation[];
}

export interface DocumentHandle {
  readonly uri: URL;
  readonly contentType: ContentType;
  readonly bytes: Uint8Array;
  readonly text?: string;
  readonly data?: unknown;
}

export interface RawDocument extends DocumentHandle {
  readonly text: string;
  readonly data: unknown;
  readonly sourceMap: SourceMap;
}

export interface DocumentCache {
  get(uri: URL): Promise<RawDocument | undefined> | RawDocument | undefined;
  set(document: RawDocument): Promise<void> | void;
  delete?(uri: URL): Promise<void> | void;
  clear?(): Promise<void> | void;
}

export interface ParseResult {
  readonly document?: RawDocument;
  readonly ast?: DocumentAst;
  readonly graph?: DocumentGraph;
  readonly resolver?: DocumentResolver;
  readonly diagnostics: DiagnosticBag;
  readonly extensions?: readonly ExtensionEvaluation[];
}

export interface ParseCollectionResult {
  readonly results: readonly ParseResult[];
  readonly diagnostics: DiagnosticBag;
}

export type { DiagnosticSeverity } from './diagnostics/severity.js';
export type { DiagnosticCode } from './diagnostics/codes.js';
export type {
  AstField,
  CollectionNode,
  DocumentAst,
  DocumentChildNode,
  NodeMetadata,
  OverrideFallbackNode,
  OverrideNode,
  TokenNode,
  AliasNode
} from './ast/nodes.js';
export type {
  DocumentGraph,
  GraphNode,
  GraphNodeBase,
  GraphCollectionNode,
  GraphTokenNode,
  GraphAliasNode,
  GraphReferenceField,
  GraphReferenceTarget,
  GraphOverrideNode,
  GraphOverrideFallbackNode
} from './graph/nodes.js';
