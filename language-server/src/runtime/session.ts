import { type Connection, type TextDocumentChangeEvent } from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { DtifLanguageServerSettings } from '../settings.js';
import { DocumentValidator } from '../diagnostics/index.js';
import { DocumentAnalysisStore } from '../core/documents/analysis-store.js';
import type { ManagedDocuments } from './documents.js';
import { buildInitializeResult, getServerName, type DtifInitializeResult } from './initialize.js';
import {
  SettingsController,
  SettingsReadError,
  type SettingsChange
} from './services/settings-controller.js';
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
  #validator: DocumentValidator;

  constructor(options: LanguageServerSessionOptions) {
    this.connection = options.connection;
    this.documents = options.documents;
    this.store = options.store ?? new DocumentAnalysisStore();
    this.#settings = new SettingsController(this.connection);
    this.#validator = options.validator ?? new DocumentValidator();
  }

  get settings(): DtifLanguageServerSettings {
    return this.#settings.current;
  }

  handleInitialize(): DtifInitializeResult {
    this.#settings.reset();
    return buildInitializeResult();
  }

  async handleInitialized(): Promise<void> {
    this.connection.console.info(`${getServerName()} initialised.`);
    await this.refreshSettings();
  }

  handleShutdown(): void {
    this.connection.console.info(`${getServerName()} shutting down.`);
  }

  async handleDidChangeConfiguration(): Promise<void> {
    await this.refreshSettings();
  }

  handleDocumentOpen(event: TextDocumentChangeEvent<TextDocument>): void {
    this.indexDocument(event.document);
    void this.publishDiagnostics(event.document, this.#settings.current);
  }

  handleDocumentChange(event: TextDocumentChangeEvent<TextDocument>): void {
    this.indexDocument(event.document);
    void this.publishDiagnostics(event.document, this.#settings.current);
  }

  handleDocumentClose(event: TextDocumentChangeEvent<TextDocument>): void {
    this.store.remove(event.document.uri);
    void this.clearDiagnostics(event.document.uri);
  }

  private async refreshSettings(): Promise<void> {
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

    if (!change.changed) {
      return;
    }

    if (change.previous.validation.mode !== change.current.validation.mode) {
      this.reindexDocuments();
      await this.publishDiagnosticsForAll(change.current);
    }
  }

  private logSettingsError(error: unknown): void {
    const message = describeError(error);
    this.connection.console.error(`Failed to load DTIF language server settings: ${message}`);
  }

  private indexDocument(document: TextDocument): void {
    const result = this.store.update(document);
    if (!result.ok && result.error) {
      this.logIndexError(result.error);
    }
  }

  private reindexDocuments(): void {
    for (const document of this.documents.all()) {
      this.indexDocument(document);
    }
  }

  private async publishDiagnostics(
    document: TextDocument,
    settings: DtifLanguageServerSettings
  ): Promise<void> {
    if (settings.validation.mode === 'off') {
      await this.clearDiagnostics(document.uri);
      return;
    }

    try {
      const diagnostics = this.#validator.validate(document);
      await this.connection.sendDiagnostics({ uri: document.uri, diagnostics });
    } catch (error: unknown) {
      this.logValidationError(error);
    }
  }

  private async publishDiagnosticsForAll(settings: DtifLanguageServerSettings): Promise<void> {
    for (const document of this.documents.all()) {
      await this.publishDiagnostics(document, settings);
    }
  }

  private async clearDiagnostics(uri: string): Promise<void> {
    try {
      await this.connection.sendDiagnostics({ uri, diagnostics: [] });
    } catch (error: unknown) {
      this.logValidationError(error);
    }
  }

  private logIndexError(error: unknown): void {
    const message = describeError(error);
    this.connection.console.error(`Failed to analyse DTIF document: ${message}`);
  }

  private logValidationError(error: unknown): void {
    const message = describeError(error);
    this.connection.console.error(`Failed to validate DTIF document: ${message}`);
  }
}
