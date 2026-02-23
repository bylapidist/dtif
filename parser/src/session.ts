import { ParseDocumentUseCase, type ParseDocumentExecution } from './application/use-cases.js';
import type { ParseInput, DocumentAst, DocumentGraph } from './types.js';
import type { ResolvedParseSessionOptions } from './session/options.js';
import type { ParseSessionOptions } from './session/types.js';
import type { DocumentResolver } from './resolver/document-resolver.js';
import { createDocumentRequest } from './application/requests.js';
import type { DiagnosticEvent } from './domain/models.js';
import { createRuntime } from './session/runtime.js';
export type { OverrideContext, ParseSessionOptions } from './session/types.js';

type ResolverResult = DocumentResolver;

export type ParseDocumentResult = ParseDocumentExecution<
  DocumentAst,
  DocumentGraph,
  ResolverResult
>;

export interface ParseCollectionResult {
  readonly results: readonly ParseDocumentResult[];
  readonly diagnostics: readonly DiagnosticEvent[];
}

function isAsyncIterable<T>(value: Iterable<T> | AsyncIterable<T>): value is AsyncIterable<T> {
  const root: object = value;
  let current: object | null = root;

  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, Symbol.asyncIterator);
    if (descriptor) {
      if (typeof descriptor.value === 'function') {
        return true;
      }

      if (typeof descriptor.get === 'function') {
        try {
          if (typeof descriptor.get.call(value) === 'function') {
            return true;
          }
        } catch {
          // ignore getter errors; treat as not async iterable
        }
      }

      return false;
    }

    current = Reflect.getPrototypeOf(current);
  }

  return false;
}

async function* toAsyncIterable(
  inputs: Iterable<ParseInput> | AsyncIterable<ParseInput>
): AsyncGenerator<ParseInput, void, unknown> {
  if (isAsyncIterable(inputs)) {
    for await (const value of inputs) {
      yield value;
    }
    return;
  }

  for (const value of inputs) {
    yield value;
  }
}

export class ParseSession {
  readonly options: ResolvedParseSessionOptions;
  readonly #documents: ParseDocumentUseCase<DocumentAst, DocumentGraph, ResolverResult>;

  constructor(options: ParseSessionOptions = {}) {
    const runtime = createRuntime(options);
    this.options = runtime.options;
    this.#documents = runtime.documents;
  }

  async parseDocument(input: ParseInput): Promise<ParseDocumentResult> {
    const request = createDocumentRequest(input);
    const execution = await this.#documents.execute({ request });
    return execution;
  }

  async parseCollection(
    inputs: Iterable<ParseInput> | AsyncIterable<ParseInput>
  ): Promise<ParseCollectionResult> {
    const results: ParseDocumentResult[] = [];
    const diagnostics: DiagnosticEvent[] = [];

    for await (const input of toAsyncIterable(inputs)) {
      const result = await this.parseDocument(input);
      results.push(result);
      if (result.diagnostics.length > 0) {
        diagnostics.push(...result.diagnostics);
      }
    }

    return {
      results,
      diagnostics
    } satisfies ParseCollectionResult;
  }
}

export function createSession(options: ParseSessionOptions = {}): ParseSession {
  return new ParseSession(options);
}

export async function parseDocument(
  input: ParseInput,
  options?: ParseSessionOptions
): Promise<ParseDocumentResult> {
  const session = createSession(options);
  return session.parseDocument(input);
}

export async function parseCollection(
  inputs: Iterable<ParseInput> | AsyncIterable<ParseInput>,
  options?: ParseSessionOptions
): Promise<ParseCollectionResult> {
  const session = createSession(options);
  return session.parseCollection(inputs);
}
