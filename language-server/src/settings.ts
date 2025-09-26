import { isRecord } from './core/utils/object.js';

export interface DtifLanguageServerSettings {
  readonly validation: {
    readonly mode: 'on' | 'off';
  };
  readonly telemetry: {
    readonly enabled: boolean;
  };
}

export const SETTINGS_SECTION = 'dtifLanguageServer';

export const DEFAULT_SETTINGS: DtifLanguageServerSettings = {
  validation: { mode: 'on' },
  telemetry: { enabled: false }
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

function parseTelemetrySettings(value: unknown): DtifLanguageServerSettings['telemetry'] {
  if (!isRecord(value)) {
    return DEFAULT_SETTINGS.telemetry;
  }

  const enabled = value.enabled;
  return { enabled: typeof enabled === 'boolean' ? enabled : DEFAULT_SETTINGS.telemetry.enabled };
}

export function parseSettings(value: unknown): DtifLanguageServerSettings {
  if (!isRecord(value)) {
    return DEFAULT_SETTINGS;
  }

  const validation = parseValidationSettings(value.validation);
  const telemetry = parseTelemetrySettings(value.telemetry);

  return { validation, telemetry } satisfies DtifLanguageServerSettings;
}

export function settingsEqual(
  a: DtifLanguageServerSettings,
  b: DtifLanguageServerSettings
): boolean {
  return a.validation.mode === b.validation.mode && a.telemetry.enabled === b.telemetry.enabled;
}
