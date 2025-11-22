import { isRecord } from './core/utils/object.js';

export interface DtifLanguageServerSettings {
  readonly validation: {
    readonly mode: 'on' | 'off';
  };
}

export interface ParsedSettings {
  readonly settings: DtifLanguageServerSettings;
  readonly warnings: readonly string[];
}

export const SETTINGS_SECTION = 'dtifLanguageServer';

export const DEFAULT_SETTINGS: DtifLanguageServerSettings = {
  validation: { mode: 'on' }
};

function parseValidationSettings(
  value: unknown,
  warnings: string[]
): DtifLanguageServerSettings['validation'] {
  if (!isRecord(value)) {
    warnings.push('Expected an object for validation settings; using defaults.');
    return DEFAULT_SETTINGS.validation;
  }

  const mode = value.mode;
  if (mode === 'off') {
    return { mode: 'off' };
  }

  if (mode === 'on') {
    return { mode: 'on' };
  }

  warnings.push(
    `validation.mode must be "on" or "off" (received ${JSON.stringify(mode)}); using "on".`
  );
  return { mode: 'on' };
}

export function parseSettings(value: unknown): ParsedSettings {
  const warnings: string[] = [];

  if (!isRecord(value)) {
    warnings.push('Expected dtifLanguageServer settings to be an object; using defaults.');
    return { settings: DEFAULT_SETTINGS, warnings } satisfies ParsedSettings;
  }

  const validation = parseValidationSettings(value.validation, warnings);

  return { settings: { validation }, warnings } satisfies ParsedSettings;
}

export function settingsEqual(
  a: DtifLanguageServerSettings,
  b: DtifLanguageServerSettings
): boolean {
  return a.validation.mode === b.validation.mode;
}
