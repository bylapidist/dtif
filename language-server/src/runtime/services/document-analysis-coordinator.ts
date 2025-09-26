import type { Connection } from 'vscode-languageserver/node.js';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentAnalysisStore } from '../../core/documents/analysis-store.js';
import { TelemetryReporter } from './telemetry-reporter.js';
import { describeError } from '../utils/errors.js';

export interface DocumentAnalysisCoordinatorOptions {
  readonly connection: Connection;
  readonly store: DocumentAnalysisStore;
  readonly telemetry: TelemetryReporter;
}

export class DocumentAnalysisCoordinator {
  readonly store: DocumentAnalysisStore;

  #connection: Connection;
  #telemetry: TelemetryReporter;

  constructor(options: DocumentAnalysisCoordinatorOptions) {
    this.store = options.store;
    this.#connection = options.connection;
    this.#telemetry = options.telemetry;
  }

  update(document: TextDocument): void {
    const result = this.store.update(document);
    if (!result.ok && result.error) {
      this.logIndexError(result.error);
    }
  }

  remove(uri: string): void {
    this.store.remove(uri);
  }

  reindex(documents: Iterable<TextDocument>): void {
    for (const document of documents) {
      this.update(document);
    }
  }

  private logIndexError(error: unknown): void {
    const message = describeError(error);
    this.#connection.console.error(`Failed to analyse DTIF document: ${message}`);
    this.#telemetry.log('dtifLanguageServer/indexError', { message });
  }
}
