import { type Connection, type TextDocumentChangeEvent } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { DtifLanguageServerSettings } from '../settings.js';
import type { DocumentValidator } from '../diagnostics.js';
import { DocumentAnalysisStore } from '../core/documents/analysis-store.js';
import type { ManagedDocuments } from './documents.js';
import { buildInitializeResult, getServerName, type DtifInitializeResult } from './initialize.js';
import {
  SettingsController,
  SettingsReadError,
  type SettingsChange
} from './services/settings-controller.js';
import { TelemetryReporter } from './services/telemetry-reporter.js';
import { DiagnosticsManager } from './services/diagnostics-manager.js';
import { describeError } from './utils/errors.js';

export interface LanguageServerSessionOptions {
  readonly connection: Connection;
  readonly documents: ManagedDocuments;
  readonly validator?: DocumentValidator;
  readonly store?: DocumentAnalysisStore;
}

export class LanguageServerSession {
  readonly connection: Connection;
  readonly documents: ManagedDocuments;
  readonly store: DocumentAnalysisStore;

  #settings: SettingsController;
  #telemetry: TelemetryReporter;
  #diagnostics: DiagnosticsManager;

  constructor(options: LanguageServerSessionOptions) {
    this.connection = options.connection;
    this.documents = options.documents;
    this.store = options.store ?? new DocumentAnalysisStore();
    this.#telemetry = new TelemetryReporter(this.connection);
    this.#settings = new SettingsController(this.connection);
    this.#diagnostics = new DiagnosticsManager({
      connection: this.connection,
      validator: options.validator,
      store: this.store,
      telemetry: this.#telemetry
    });
  }

  get settings(): DtifLanguageServerSettings {
    return this.#settings.current;
  }

  handleInitialize(): DtifInitializeResult {
    this.#settings.reset();
    this.#telemetry.update(this.#settings.current);
    return buildInitializeResult();
  }

  async handleInitialized(): Promise<void> {
    this.connection.console.info(`${getServerName()} initialised.`);
    await this.refreshSettings('initial');
  }

  handleShutdown(): void {
    this.connection.console.info(`${getServerName()} shutting down.`);
  }

  async handleDidChangeConfiguration(): Promise<void> {
    await this.refreshSettings('change');
  }

  handleDocumentOpen(event: TextDocumentChangeEvent<TextDocument>): void {
    void this.#diagnostics.publish(event.document, this.#settings.current);
  }

  handleDocumentChange(event: TextDocumentChangeEvent<TextDocument>): void {
    void this.#diagnostics.publish(event.document, this.#settings.current);
  }

  handleDocumentClose(event: TextDocumentChangeEvent<TextDocument>): void {
    void this.#diagnostics.clear(event.document.uri);
  }

  private async refreshSettings(reason: 'initial' | 'change'): Promise<void> {
    let change: SettingsChange;
    try {
      change = await this.#settings.refresh();
    } catch (error: unknown) {
      if (error instanceof SettingsReadError) {
        this.logSettingsError(error.cause ?? error);
      } else {
        this.logSettingsError(error);
      }
      return;
    }

    this.#telemetry.update(change.current);

    if (!change.changed) {
      return;
    }

    if (change.current.telemetry.enabled && !change.previous.telemetry.enabled) {
      this.#telemetry.log('dtifLanguageServer/telemetryEnabled', { reason });
    }

    if (change.previous.validation.mode !== change.current.validation.mode) {
      await this.#diagnostics.publishAll(this.documents.all(), change.current);
    }
  }

  private logSettingsError(error: unknown): void {
    const message = describeError(error);
    this.connection.console.error(`Failed to load DTIF language server settings: ${message}`);
    this.#telemetry.log('dtifLanguageServer/settingsError', { message });
  }
}
