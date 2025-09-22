import type {
  AliasNode,
  AstField,
  CollectionNode,
  DocumentAst,
  DocumentChildNode,
  NodeMetadata,
  OverrideFallbackNode,
  OverrideNode,
  TokenNode
} from '../ast/nodes.js';
import type { JsonPointer, SourceSpan } from '../types.js';

export type GraphNode = GraphCollectionNode | GraphTokenNode | GraphAliasNode;

export interface GraphNodeBase {
  readonly kind: DocumentChildNode['kind'];
  readonly name: string;
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly path: readonly string[];
  readonly parent?: JsonPointer;
  readonly metadata: NodeMetadata;
}

export interface GraphCollectionNode extends GraphNodeBase {
  readonly kind: CollectionNode['kind'];
  readonly children: readonly JsonPointer[];
}

export interface GraphTokenNode extends GraphNodeBase {
  readonly kind: TokenNode['kind'];
  readonly type?: AstField<string>;
  readonly value?: AstField<unknown>;
}

export interface GraphAliasNode extends GraphNodeBase {
  readonly kind: AliasNode['kind'];
  readonly type: AstField<string>;
  readonly ref: GraphReferenceField;
}

export interface GraphReferenceTarget {
  readonly uri: URL;
  readonly pointer: JsonPointer;
  readonly external: boolean;
}

export type GraphReferenceField = AstField<GraphReferenceTarget>;

export interface GraphOverrideNode {
  readonly kind: OverrideNode['kind'];
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly token: GraphReferenceField;
  readonly when: AstField<Readonly<Record<string, unknown>>>;
  readonly ref?: GraphReferenceField;
  readonly value?: AstField<unknown>;
  readonly fallback?: readonly GraphOverrideFallbackNode[];
}

export interface GraphOverrideFallbackNode {
  readonly kind: OverrideFallbackNode['kind'];
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly ref?: GraphReferenceField;
  readonly value?: AstField<unknown>;
  readonly fallback?: readonly GraphOverrideFallbackNode[];
}

export interface DocumentGraph {
  readonly kind: 'document-graph';
  readonly uri: URL;
  readonly ast: DocumentAst;
  readonly nodes: ReadonlyMap<JsonPointer, GraphNode>;
  readonly rootPointers: readonly JsonPointer[];
  readonly overrides: readonly GraphOverrideNode[];
}

export type {
  AliasNode,
  CollectionNode,
  DocumentAst,
  DocumentChildNode,
  NodeMetadata,
  OverrideFallbackNode,
  OverrideNode,
  TokenNode
};
