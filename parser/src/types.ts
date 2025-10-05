import type { DesignTokenInterchangeFormat } from '@lapidist/dtif-schema';
import type {
  DecodedDocument as DomainDecodedDocument,
  DiagnosticEvent,
  DiagnosticEventRelatedInformation,
  RawDocument as DomainRawDocument,
  RawDocumentIdentity as DomainRawDocumentIdentity
} from './domain/models.js';
import type {
  SourceMap as DomainSourceMap,
  SourceSpan as DomainSourceSpan,
  JsonPointer as DomainJsonPointer,
  SourcePosition as DomainSourcePosition
} from './domain/primitives.js';
import type { DocumentCachePort } from './domain/ports.js';

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

export type SourcePosition = DomainSourcePosition;

export type JsonPointer = DomainJsonPointer;

export type SourceSpan = DomainSourceSpan;

export type SourceMap = DomainSourceMap;

export type RelatedInformation = DiagnosticEventRelatedInformation;

export type Diagnostic = DiagnosticEvent;

export interface DocumentHandle {
  readonly uri: URL;
  readonly contentType: ContentType;
  readonly bytes: Uint8Array;
  readonly text?: string;
  readonly data?: unknown;
}

export type RawDocument = DomainRawDocument;

export type DecodedDocument = DomainDecodedDocument;

export type RawDocumentIdentity = DomainRawDocumentIdentity;

export type DocumentCache = DocumentCachePort;

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
