import type { Connection } from 'vscode-languageserver/node.js';
import type { DtifLanguageServerSettings } from '../../settings.js';
import { describeError } from '../utils/errors.js';

export class TelemetryReporter {
  #connection: Connection;
  #enabled = false;

  constructor(connection: Connection) {
    this.#connection = connection;
  }

  update(settings: DtifLanguageServerSettings): void {
    this.#enabled = settings.telemetry.enabled;
  }

  log(event: string, data?: Record<string, unknown>): void {
    if (!this.#enabled) {
      return;
    }

    if (!hasTelemetryLogger(this.#connection.telemetry)) {
      return;
    }

    try {
      void this.#connection.telemetry.log({ event, data });
    } catch (error: unknown) {
      const message = describeError(error);
      this.#connection.console.error(`Failed to send telemetry: ${message}`);
    }
  }
}

interface TelemetryLogger {
  log: (payload: {
    event: string;
    data?: Record<string, unknown>;
  }) => PromiseLike<unknown> | undefined;
}

function hasTelemetryLogger(telemetry: unknown): telemetry is TelemetryLogger {
  if (typeof telemetry !== 'object' || telemetry === null) {
    return false;
  }

  const log: unknown = Reflect.get(telemetry, 'log');
  return typeof log === 'function';
}
