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

    try {
      next = await this.read();
    } catch (error: unknown) {
      throw new SettingsReadError(error);
    }

    if (settingsEqual(previous, next)) {
      return { previous, current: previous, changed: false } satisfies SettingsChange;
    }

    this.#current = next;
    return { previous, current: next, changed: true } satisfies SettingsChange;
  }

  private async read(): Promise<DtifLanguageServerSettings> {
    const workspace: unknown = this.#connection.workspace;
    if (!hasConfiguration(workspace)) {
      return DEFAULT_SETTINGS;
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
