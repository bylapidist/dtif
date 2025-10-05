import type { JsonPointer } from '../domain/primitives.js';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

export type TokenId = string;
export type TokenType = string;

export interface TokenPointer {
  readonly uri: string;
  readonly pointer: JsonPointer;
}

export interface DtifFlattenedToken {
  readonly id: TokenId;
  readonly pointer: JsonPointer;
  readonly name: string;
  readonly path: readonly string[];
  readonly type?: TokenType;
  readonly value?: JsonValue;
  readonly raw?: JsonValue;
}

export interface TokenMetadataSnapshot {
  readonly description?: string;
  readonly extensions: Record<string, unknown>;
  readonly deprecated?: {
    readonly since?: string;
    readonly reason?: string;
    readonly supersededBy?: TokenPointer;
  };
  readonly source: {
    readonly uri: string;
    readonly line: number;
    readonly column: number;
  };
}

export interface ResolvedTokenView {
  readonly id: TokenId;
  readonly type?: TokenType;
  readonly value?: JsonValue;
  readonly raw?: JsonValue;
  readonly references: readonly TokenPointer[];
  readonly resolutionPath: readonly TokenPointer[];
  readonly appliedAliases: readonly TokenPointer[];
}
