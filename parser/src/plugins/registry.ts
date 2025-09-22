import { DiagnosticCodes } from '../diagnostics/codes.js';
import type { Diagnostic, JsonPointer, RawDocument, SourceSpan } from '../types.js';
import type {
  ExtensionEvaluation,
  ExtensionHandler,
  ExtensionHandlerInput,
  ParserPlugin,
  ResolvedTokenTransform,
  ResolvedTokenTransformEntry
} from './types.js';

const EMPTY_DIAGNOSTICS: readonly Diagnostic[] = Object.freeze([]);
const EMPTY_EXTENSION_EVALUATIONS: readonly ExtensionEvaluation[] = Object.freeze([]);
const EMPTY_TRANSFORM_ENTRIES: readonly ResolvedTokenTransformEntry[] = Object.freeze([]);

type ExtensionHandlerEntry = {
  readonly plugin: string;
  readonly handler: ExtensionHandler;
};

type ExtensionHandlerMap = ReadonlyMap<string, readonly ExtensionHandlerEntry[]>;

interface ExtensionInvocation {
  readonly namespace: string;
  readonly pointer: JsonPointer;
  readonly span?: SourceSpan;
  readonly value: unknown;
}

export interface ExtensionCollector {
  handle(invocation: ExtensionInvocation): void;
  results(): readonly ExtensionEvaluation[];
}

class ExtensionCollectorImpl implements ExtensionCollector {
  #results: ExtensionEvaluation[] = [];
  #finalized?: readonly ExtensionEvaluation[];

  constructor(
    private readonly handlers: ExtensionHandlerMap,
    private readonly document: RawDocument,
    private readonly diagnostics: Diagnostic[]
  ) {}

  handle(invocation: ExtensionInvocation): void {
    const entries = this.handlers.get(invocation.namespace);
    if (!entries || entries.length === 0) {
      return;
    }

    for (const entry of entries) {
      try {
        const result = entry.handler(createExtensionHandlerInput(invocation, this.document));
        const diagnostics = freezeDiagnostics(result?.diagnostics);
        if (diagnostics.length > 0) {
          for (const diagnostic of diagnostics) {
            this.diagnostics.push(diagnostic);
          }
        }
        this.#results.push(
          Object.freeze({
            plugin: entry.plugin,
            namespace: invocation.namespace,
            pointer: invocation.pointer,
            span: invocation.span,
            value: invocation.value,
            normalized: result?.normalized,
            diagnostics
          })
        );
      } catch (error) {
        this.diagnostics.push(createExtensionFailureDiagnostic(invocation, entry.plugin, error));
      }
    }
  }

  results(): readonly ExtensionEvaluation[] {
    if (this.#finalized) {
      return this.#finalized;
    }
    if (this.#results.length === 0) {
      this.#finalized = EMPTY_EXTENSION_EVALUATIONS;
      return this.#finalized;
    }
    this.#finalized = Object.freeze(this.#results.slice());
    return this.#finalized;
  }
}

function createExtensionHandlerInput(
  invocation: ExtensionInvocation,
  document: RawDocument
): ExtensionHandlerInput {
  return {
    namespace: invocation.namespace,
    pointer: invocation.pointer,
    span: invocation.span,
    value: invocation.value,
    document
  };
}

function createExtensionFailureDiagnostic(
  invocation: ExtensionInvocation,
  plugin: string,
  error: unknown
): Diagnostic {
  const message = error instanceof Error ? error.message : String(error);
  return {
    code: DiagnosticCodes.plugins.EXTENSION_FAILED,
    message: `Plugin "${plugin}" failed to process extension "${invocation.namespace}": ${message}`,
    severity: 'error',
    pointer: invocation.pointer,
    span: invocation.span
  };
}

function freezeDiagnostics(list?: readonly Diagnostic[]): readonly Diagnostic[] {
  if (!list || list.length === 0) {
    return EMPTY_DIAGNOSTICS;
  }
  return Object.freeze(Array.from(list));
}

function normalizeHandlers(
  input: ReadonlyMap<string, ExtensionHandler> | Readonly<Record<string, ExtensionHandler>>
): Iterable<[string, ExtensionHandler]> {
  if (input instanceof Map) {
    return input.entries();
  }
  return Object.entries(input);
}

export class PluginRegistry {
  readonly #handlers: ExtensionHandlerMap;
  readonly #transforms: readonly ResolvedTokenTransformEntry[];

  constructor(plugins: readonly ParserPlugin[] = []) {
    const handlerMap = new Map<string, ExtensionHandlerEntry[]>();
    const transforms: ResolvedTokenTransformEntry[] = [];

    for (const plugin of plugins) {
      if (!plugin || typeof plugin.name !== 'string' || plugin.name.trim() === '') {
        throw new TypeError('Parser plugins must declare a non-empty name.');
      }
      const name = plugin.name;

      if (plugin.extensions) {
        for (const [namespace, handler] of normalizeHandlers(plugin.extensions)) {
          if (typeof handler !== 'function') {
            throw new TypeError(
              `Extension handler for namespace "${namespace}" in plugin "${name}" must be a function.`
            );
          }
          const list = handlerMap.get(namespace);
          const entry: ExtensionHandlerEntry = Object.freeze({ plugin: name, handler });
          if (list) {
            list.push(entry);
          } else {
            handlerMap.set(namespace, [entry]);
          }
        }
      }

      if (plugin.transformResolvedToken) {
        transforms.push(Object.freeze({ plugin: name, transform: plugin.transformResolvedToken }));
      }
    }

    const frozenHandlers = new Map<string, readonly ExtensionHandlerEntry[]>();
    for (const [namespace, entries] of handlerMap.entries()) {
      frozenHandlers.set(namespace, Object.freeze(entries.slice()));
    }

    this.#handlers = frozenHandlers;
    this.#transforms =
      transforms.length === 0 ? EMPTY_TRANSFORM_ENTRIES : Object.freeze(transforms.slice());
  }

  createExtensionCollector(
    document: RawDocument,
    diagnostics: Diagnostic[]
  ): ExtensionCollector | undefined {
    if (this.#handlers.size === 0) {
      return undefined;
    }
    return new ExtensionCollectorImpl(this.#handlers, document, diagnostics);
  }

  get transforms(): readonly ResolvedTokenTransformEntry[] {
    return this.#transforms;
  }
}

export type { ResolvedTokenTransformEntry };
