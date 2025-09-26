import type { PublishDiagnosticsParams } from 'vscode-languageserver/node.js';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Connection } from 'vscode-languageserver/node.js';
import { DocumentValidator } from '../../diagnostics.js';
import { DocumentAnalysisStore } from '../../core/documents/analysis-store.js';
import type { DtifLanguageServerSettings } from '../../settings.js';
import { TelemetryReporter } from './telemetry-reporter.js';
import { describeError } from '../utils/errors.js';

export interface DiagnosticsManagerOptions {
  readonly connection: Connection;
  readonly validator?: DocumentValidator;
  readonly store: DocumentAnalysisStore;
  readonly telemetry: TelemetryReporter;
}

export class DiagnosticsManager {
  readonly store: DocumentAnalysisStore;

  #connection: Connection;
  #validator: DocumentValidator;
  #telemetry: TelemetryReporter;

  constructor(options: DiagnosticsManagerOptions) {
    this.#connection = options.connection;
    this.#validator = options.validator ?? new DocumentValidator();
    this.store = options.store;
    this.#telemetry = options.telemetry;
  }

  async publish(document: TextDocument, settings: DtifLanguageServerSettings): Promise<void> {
    const diagnostics =
      settings.validation.mode === 'off' ? [] : this.#validator.validate(document);
    await this.sendDiagnostics({ uri: document.uri, diagnostics });
    this.indexDocument(document);
  }

  async publishAll(
    documents: Iterable<TextDocument>,
    settings: DtifLanguageServerSettings
  ): Promise<void> {
    for (const document of documents) {
      await this.publish(document, settings);
    }
  }

  async clear(uri: string): Promise<void> {
    await this.sendDiagnostics({ uri, diagnostics: [] });
    this.store.remove(uri);
  }

  private async sendDiagnostics(params: PublishDiagnosticsParams): Promise<void> {
    try {
      await this.#connection.sendDiagnostics(params);
    } catch (error: unknown) {
      this.logValidationError(error);
    }
  }

  private indexDocument(document: TextDocument): void {
    const result = this.store.update(document);
    if (!result.ok && result.error) {
      this.logIndexError(result.error);
    }
  }

  private logValidationError(error: unknown): void {
    const message = describeError(error);
    this.#connection.console.error(`Failed to validate DTIF document: ${message}`);
    this.#telemetry.log('dtifLanguageServer/validationError', { message });
  }

  private logIndexError(error: unknown): void {
    const message = describeError(error);
    this.#connection.console.error(`Failed to analyse DTIF document: ${message}`);
    this.#telemetry.log('dtifLanguageServer/indexError', { message });
  }
}
