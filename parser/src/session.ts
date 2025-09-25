import { normalizeDocument } from './ast/normaliser.js';
import { DiagnosticBag } from './diagnostics/bag.js';
import { DiagnosticCodes } from './diagnostics/codes.js';
import { buildDocumentGraph } from './graph/builder.js';
import { DocumentLoaderError } from './io/document-loader.js';
import { decodeDocument } from './io/decoder.js';
import { createDocumentResolver } from './resolver/index.js';
import type {
  DocumentHandle,
  ParseCollectionResult,
  ParseInput,
  ParseResult,
  RawDocument
} from './types.js';
import { resolveOptions, type ResolvedParseSessionOptions } from './session/internal/options.js';
import type { ParseSessionOptions } from './session/types.js';
export type { OverrideContext, ParseSessionOptions } from './session/types.js';

function isAsyncIterable<T>(value: Iterable<T> | AsyncIterable<T>): value is AsyncIterable<T> {
  const root: object = value;
  let current: object | null = root;

  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, Symbol.asyncIterator);
    if (descriptor && typeof descriptor.value === 'function') {
      return true;
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

  constructor(options: ParseSessionOptions = {}) {
    this.options = resolveOptions(options);
  }

  async parseDocument(input: ParseInput): Promise<ParseResult> {
    const diagnostics = new DiagnosticBag();
    const handle = await this.loadDocumentHandle(input, diagnostics);

    if (!handle) {
      return { diagnostics };
    }

    const cachedDocument = await this.getCachedDocument(handle, diagnostics);
    const document = cachedDocument ?? (await this.decodeDocumentHandle(handle, diagnostics));

    if (!document) {
      return { diagnostics };
    }

    if (!cachedDocument) {
      await this.storeDocumentInCache(document, diagnostics);
    }

    const schemaValid = this.validateDocumentSchema(document, diagnostics);

    if (!schemaValid) {
      return {
        document,
        diagnostics
      };
    }

    const normalised = normalizeDocument(document, {
      extensions: this.options.plugins
    });
    diagnostics.addMany(normalised.diagnostics);

    if (!normalised.ast) {
      return {
        document,
        extensions: normalised.extensions,
        diagnostics
      };
    }

    const graphResult = buildDocumentGraph(normalised.ast);
    diagnostics.addMany(graphResult.diagnostics);

    const graph = graphResult.graph;
    const resolver =
      graph &&
      createDocumentResolver(graph, {
        context: this.options.overrideContext,
        maxDepth: this.options.maxDepth,
        document,
        transforms: this.options.plugins?.transforms
      });

    return {
      document,
      ast: normalised.ast,
      graph,
      resolver,
      extensions: normalised.extensions,
      diagnostics
    };
  }

  async parseCollection(
    inputs: Iterable<ParseInput> | AsyncIterable<ParseInput>
  ): Promise<ParseCollectionResult> {
    const results: ParseResult[] = [];
    const diagnostics = new DiagnosticBag();

    for await (const input of toAsyncIterable(inputs)) {
      const result = await this.parseDocument(input);
      results.push(result);
      diagnostics.extend(result.diagnostics);
    }

    return {
      results,
      diagnostics
    };
  }

  private async loadDocumentHandle(
    input: ParseInput,
    diagnostics: DiagnosticBag
  ): Promise<DocumentHandle | undefined> {
    try {
      return await this.options.loader.load(input);
    } catch (error) {
      if (error instanceof DocumentLoaderError) {
        diagnostics.add({
          code: DiagnosticCodes.loader.TOO_LARGE,
          message: error.message,
          severity: 'error'
        });
      } else {
        diagnostics.add({
          code: DiagnosticCodes.loader.FAILED,
          message: error instanceof Error ? error.message : 'Failed to load DTIF document.',
          severity: 'error'
        });
      }
      return undefined;
    }
  }

  private async decodeDocumentHandle(
    handle: DocumentHandle,
    diagnostics: DiagnosticBag
  ): Promise<RawDocument | undefined> {
    try {
      return await decodeDocument(handle);
    } catch (error) {
      diagnostics.add({
        code: DiagnosticCodes.decoder.FAILED,
        message: error instanceof Error ? error.message : 'Failed to decode DTIF document.',
        severity: 'error'
      });
      return undefined;
    }
  }

  private validateDocumentSchema(document: RawDocument, diagnostics: DiagnosticBag): boolean {
    try {
      const result = this.options.schemaGuard.validate(document);
      if (!result.valid) {
        diagnostics.addMany(result.diagnostics);
      }
      return result.valid;
    } catch (error) {
      diagnostics.add({
        code: DiagnosticCodes.schemaGuard.FAILED,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to validate DTIF document against the schema.',
        severity: 'error'
      });
      return false;
    }
  }

  private async getCachedDocument(
    handle: DocumentHandle,
    diagnostics: DiagnosticBag
  ): Promise<RawDocument | undefined> {
    const cache = this.options.cache;
    if (!cache) {
      return undefined;
    }

    try {
      const cached = await cache.get(handle.uri);
      if (!cached) {
        return undefined;
      }

      return areByteArraysEqual(cached.bytes, handle.bytes) ? cached : undefined;
    } catch (error) {
      diagnostics.add({
        code: DiagnosticCodes.core.CACHE_FAILED,
        message:
          error instanceof Error
            ? `Failed to read DTIF document from cache: ${error.message}`
            : 'Failed to read DTIF document from cache.',
        severity: 'warning'
      });
      return undefined;
    }
  }

  private async storeDocumentInCache(
    document: RawDocument,
    diagnostics: DiagnosticBag
  ): Promise<void> {
    const cache = this.options.cache;
    if (!cache) {
      return;
    }

    try {
      await cache.set(document);
    } catch (error) {
      diagnostics.add({
        code: DiagnosticCodes.core.CACHE_FAILED,
        message:
          error instanceof Error
            ? `Failed to update DTIF document cache: ${error.message}`
            : 'Failed to update DTIF document cache.',
        severity: 'warning'
      });
    }
  }
}

function areByteArraysEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left === right) {
    return true;
  }

  if (left.byteLength !== right.byteLength) {
    return false;
  }

  for (let index = 0; index < left.byteLength; index++) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

export function createSession(options: ParseSessionOptions = {}): ParseSession {
  return new ParseSession(options);
}

export async function parseDocument(
  input: ParseInput,
  options?: ParseSessionOptions
): Promise<ParseResult> {
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
