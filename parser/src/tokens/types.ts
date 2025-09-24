import type { JsonPointer, SourceSpan } from '../types.js';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

export type TokenId = string;
export type TokenType = string;

export interface Position {
  readonly line: number;
  readonly character: number;
}

export interface Range {
  readonly start: Position;
  readonly end: Position;
}

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

export interface TokenDiagnostic {
  readonly severity: 'error' | 'warning' | 'info';
  readonly code: string;
  readonly message: string;
  readonly source: 'dtif-parser';
  readonly target: {
    readonly uri: string;
    readonly range: Range;
  };
  readonly related?: readonly {
    readonly message: string;
    readonly target: {
      readonly uri: string;
      readonly range: Range;
    };
  }[];
}

export interface TokenDiagnosticContext {
  readonly documentUri?: string;
  readonly pointerSpans?: ReadonlyMap<JsonPointer, SourceSpan>;
}

export interface FormatTokenDiagnosticOptions {
  readonly color?: boolean;
  readonly cwd?: string;
}
