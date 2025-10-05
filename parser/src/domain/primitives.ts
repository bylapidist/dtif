export type JsonPointer = `#${string}`;

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

export type DocumentContentType = 'application/json' | 'application/yaml';
