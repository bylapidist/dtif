import type { JsonPointer, SourceSpan } from '../types.js';

export interface AstField<T> {
  readonly value: T;
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
}

export interface DeprecatedMetadata {
  readonly active: boolean;
  readonly replacement?: AstField<string>;
}

export interface NodeMetadata {
  readonly description?: AstField<string>;
  readonly extensions?: AstField<Readonly<Record<string, unknown>>>;
  readonly deprecated?: AstField<DeprecatedMetadata>;
  readonly lastModified?: AstField<string>;
  readonly lastUsed?: AstField<string>;
  readonly usageCount?: AstField<number>;
  readonly author?: AstField<string>;
  readonly tags?: AstField<readonly string[]>;
  readonly hash?: AstField<string>;
}

export interface BaseNode {
  readonly kind: 'collection' | 'token' | 'alias';
  readonly name: string;
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly metadata: NodeMetadata;
}

export interface CollectionNode extends BaseNode {
  readonly kind: 'collection';
  readonly children: readonly DocumentChildNode[];
}

export interface TokenNode extends BaseNode {
  readonly kind: 'token';
  readonly type?: AstField<string>;
  readonly value?: AstField<unknown>;
}

export interface AliasNode extends BaseNode {
  readonly kind: 'alias';
  readonly type: AstField<string>;
  readonly ref: AstField<string>;
}

export type DocumentChildNode = CollectionNode | TokenNode | AliasNode;

export interface OverrideFallbackNode {
  readonly kind: 'fallback';
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly ref?: AstField<string>;
  readonly value?: AstField<unknown>;
  readonly fallback?: readonly OverrideFallbackNode[];
}

export interface OverrideNode {
  readonly kind: 'override';
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly token: AstField<string>;
  readonly when: AstField<Readonly<Record<string, unknown>>>;
  readonly ref?: AstField<string>;
  readonly value?: AstField<unknown>;
  readonly fallback?: readonly OverrideFallbackNode[];
}

export interface DocumentAst {
  readonly kind: 'document';
  readonly uri: URL;
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly schema?: AstField<string>;
  readonly version?: AstField<string>;
  readonly metadata: NodeMetadata;
  readonly children: readonly DocumentChildNode[];
  readonly overrides: readonly OverrideNode[];
}
