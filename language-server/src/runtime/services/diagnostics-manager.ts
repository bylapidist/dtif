import type { Connection, PublishDiagnosticsParams } from 'vscode-languageserver/node.js';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentValidator } from '../../diagnostics/index.js';
import type { DtifLanguageServerSettings } from '../../settings.js';
import { TelemetryReporter } from './telemetry-reporter.js';
import { describeError } from '../utils/errors.js';

export interface DiagnosticsManagerOptions {
  readonly connection: Connection;
  readonly validator?: DocumentValidator;
  readonly telemetry: TelemetryReporter;
}

export class DiagnosticsManager {
  #connection: Connection;
  #validator: DocumentValidator;
  #telemetry: TelemetryReporter;

  constructor(options: DiagnosticsManagerOptions) {
    this.#connection = options.connection;
    this.#validator = options.validator ?? new DocumentValidator();
    this.#telemetry = options.telemetry;
  }

  async publish(document: TextDocument, settings: DtifLanguageServerSettings): Promise<void> {
    const diagnostics =
      settings.validation.mode === 'off' ? [] : this.#validator.validate(document);
    await this.sendDiagnostics({ uri: document.uri, diagnostics });
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
  }

  private async sendDiagnostics(params: PublishDiagnosticsParams): Promise<void> {
    try {
      await this.#connection.sendDiagnostics(params);
    } catch (error: unknown) {
      this.logValidationError(error);
    }
  }

  private logValidationError(error: unknown): void {
    const message = describeError(error);
    this.#connection.console.error(`Failed to validate DTIF document: ${message}`);
    this.#telemetry.log('dtifLanguageServer/validationError', { message });
  }
}
