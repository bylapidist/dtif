import { isRecord } from './core/utils/object.js';

export interface DtifLanguageServerSettings {
  readonly validation: {
    readonly mode: 'on' | 'off';
  };
}

export const SETTINGS_SECTION = 'dtifLanguageServer';

export const DEFAULT_SETTINGS: DtifLanguageServerSettings = {
  validation: { mode: 'on' }
};

function parseValidationSettings(value: unknown): DtifLanguageServerSettings['validation'] {
  if (!isRecord(value)) {
    return DEFAULT_SETTINGS.validation;
  }

  const mode = value.mode;
  if (mode === 'off') {
    return { mode: 'off' };
  }

  return { mode: 'on' };
}

export function parseSettings(value: unknown): DtifLanguageServerSettings {
  if (!isRecord(value)) {
    return DEFAULT_SETTINGS;
  }

  const validation = parseValidationSettings(value.validation);

  return { validation } satisfies DtifLanguageServerSettings;
}

export function settingsEqual(
  a: DtifLanguageServerSettings,
  b: DtifLanguageServerSettings
): boolean {
  return a.validation.mode === b.validation.mode;
}
