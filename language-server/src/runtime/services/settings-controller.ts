import type { Connection } from 'vscode-languageserver/node.js';
import {
  DEFAULT_SETTINGS,
  SETTINGS_SECTION,
  parseSettings,
  settingsEqual,
  type DtifLanguageServerSettings
} from '../../settings.js';

export interface SettingsChange {
  readonly previous: DtifLanguageServerSettings;
  readonly current: DtifLanguageServerSettings;
  readonly changed: boolean;
}

export class SettingsReadError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super('Failed to read DTIF language server settings.');
    this.name = 'SettingsReadError';
    this.cause = cause;
  }
}

export class SettingsController {
  #connection: Connection;
  #current: DtifLanguageServerSettings = DEFAULT_SETTINGS;

  constructor(connection: Connection) {
    this.#connection = connection;
  }

  get current(): DtifLanguageServerSettings {
    return this.#current;
  }

  reset(): void {
    this.#current = DEFAULT_SETTINGS;
  }

  async refresh(): Promise<SettingsChange> {
    const previous = this.#current;
    let next: DtifLanguageServerSettings;
    let warnings: readonly string[] = [];

    try {
      const result = await this.read();
      next = result.settings;
      warnings = result.warnings;
    } catch (error: unknown) {
      throw new SettingsReadError(error);
    }

    for (const warning of warnings) {
      this.#connection.console.warn(`DTIF language server settings warning: ${warning}`);
    }

    if (settingsEqual(previous, next)) {
      return { previous, current: previous, changed: false } satisfies SettingsChange;
    }

    this.#current = next;
    return { previous, current: next, changed: true } satisfies SettingsChange;
  }

  private async read(): Promise<ReturnType<typeof parseSettings>> {
    const workspace: unknown = this.#connection.workspace;
    if (!hasConfiguration(workspace)) {
      return { settings: DEFAULT_SETTINGS, warnings: [] } satisfies ReturnType<
        typeof parseSettings
      >;
    }

    const configuration: unknown = await workspace.getConfiguration({ section: SETTINGS_SECTION });
    return parseSettings(configuration);
  }
}

interface WorkspaceWithConfiguration {
  getConfiguration: (scope: { section: string }) => PromiseLike<unknown>;
}

function hasConfiguration(workspace: unknown): workspace is WorkspaceWithConfiguration {
  if (typeof workspace !== 'object' || workspace === null) {
    return false;
  }

  const getter: unknown = Reflect.get(workspace, 'getConfiguration');
  return typeof getter === 'function';
}
