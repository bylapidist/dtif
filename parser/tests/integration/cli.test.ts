import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Readable, Writable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { runCli } from '../../src/cli/parse.js';
import type { CliOutput, DocumentSummary, ResolutionSummary } from '../../src/cli/types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertIsDiagnosticsSummary(value: unknown): asserts value is CliOutput['summary'] {
  if (!isRecord(value)) {
    throw new TypeError('expected diagnostics summary to be an object');
  }

  const { total, error, warning, info } = value;

  if (typeof total !== 'number' || typeof error !== 'number') {
    throw new TypeError('expected diagnostic totals to be numbers');
  }

  if (typeof warning !== 'number' || typeof info !== 'number') {
    throw new TypeError('expected diagnostic counts to be numbers');
  }
}

function assertIsSerializableDiagnostics(
  value: unknown
): asserts value is DocumentSummary['diagnostics'] {
  if (!Array.isArray(value)) {
    throw new TypeError('expected diagnostics to be an array');
  }
}

function assertIsResolutionSummary(value: unknown): asserts value is ResolutionSummary {
  if (!isRecord(value)) {
    throw new TypeError('expected resolution summary to be an object');
  }

  if (typeof value.pointer !== 'string') {
    throw new TypeError('expected resolution pointer to be a string');
  }

  assertIsSerializableDiagnostics(value.diagnostics);

  if ('token' in value) {
    const { token } = value;

    if (token !== undefined && token !== null) {
      if (!isRecord(token)) {
        throw new TypeError('expected resolution token to be an object');
      }

      if ('type' in token && token.type !== undefined && typeof token.type !== 'string') {
        throw new TypeError('expected resolved token type to be a string');
      }

      if (!Array.isArray(token.trace)) {
        throw new TypeError('expected resolved token trace to be an array');
      }
    }
  }
}

function assertIsResolutionMap(
  value: unknown
): asserts value is NonNullable<DocumentSummary['resolutions']> {
  if (!isRecord(value)) {
    throw new TypeError('expected resolution map to be an object');
  }

  for (const entry of Object.values(value)) {
    assertIsResolutionSummary(entry);
  }
}

function assertIsDocumentSummary(value: unknown): asserts value is DocumentSummary {
  if (!isRecord(value)) {
    throw new TypeError('expected document summary to be an object');
  }

  if (!('uri' in value) || (value.uri !== null && typeof value.uri !== 'string')) {
    throw new TypeError('expected document URI to be a string or null');
  }

  assertIsSerializableDiagnostics(value.diagnostics);
  assertIsDiagnosticsSummary(value.diagnosticCounts);

  if (typeof value.resolverAvailable !== 'boolean') {
    throw new TypeError('expected resolver availability to be a boolean');
  }

  if ('resolutions' in value && value.resolutions !== undefined) {
    assertIsResolutionMap(value.resolutions);
  }
}

function assertIsCliOutput(value: unknown): asserts value is CliOutput {
  if (!isRecord(value)) {
    throw new TypeError('expected CLI output to be an object');
  }

  if (!Array.isArray(value.documents)) {
    throw new TypeError('expected CLI output documents to be an array');
  }

  value.documents.forEach(assertIsDocumentSummary);
  assertIsDiagnosticsSummary(value.summary);

  if (!Array.isArray(value.diagnostics)) {
    throw new TypeError('expected CLI output diagnostics to be an array');
  }
}

const writableDecoder = new TextDecoder();

function createWritableBuffer() {
  let data = '';
  const stream = new Writable({
    write(chunk: unknown, _encoding, callback) {
      if (typeof chunk === 'string') {
        data += chunk;
      } else if (chunk instanceof Uint8Array) {
        data += writableDecoder.decode(chunk);
      } else {
        data += String(chunk);
      }
      callback();
    }
  });
  return {
    stream,
    toString() {
      return data;
    }
  };
}

void test('dtif-parse outputs JSON summary for file inputs', async () => {
  const fixtureUrl = new URL('../fixtures/cli/basic.json', import.meta.url);
  const fixturePath = fileURLToPath(fixtureUrl);

  const stdout = createWritableBuffer();
  const stderr = createWritableBuffer();

  const exitCode = await runCli(['--format', 'json', fixturePath], {
    stdout: stdout.stream,
    stderr: stderr.stream
  });

  assert.equal(exitCode, 0);
  assert.equal(stderr.toString(), '');

  const outputRaw: unknown = JSON.parse(stdout.toString());
  assertIsCliOutput(outputRaw);
  const output = outputRaw;
  assert.equal(output.documents.length, 1);
  assert.equal(output.summary.error, 0);
  assert.equal(output.summary.warning, 0);
  assert.equal(output.summary.info, 0);

  const document = output.documents[0];
  assert.equal(document.uri, pathToFileURL(fixturePath).href);
  assert.equal(document.diagnosticCounts.total, 0);
  assert.equal(document.resolverAvailable, true);
});

void test('dtif-parse resolves requested pointers', async () => {
  const fixtureUrl = new URL('../fixtures/cli/basic.json', import.meta.url);
  const fixturePath = fileURLToPath(fixtureUrl);

  const stdout = createWritableBuffer();
  const exitCode = await runCli(
    [fixturePath, '--format', 'json', '--resolve', '#/color/brand/alias'],
    {
      stdout: stdout.stream,
      stderr: createWritableBuffer().stream
    }
  );

  assert.equal(exitCode, 0);

  const outputRaw: unknown = JSON.parse(stdout.toString());
  assertIsCliOutput(outputRaw);
  const output = outputRaw;
  const document = output.documents[0];
  const pointer = '#/color/brand/alias';
  const resolutions = document.resolutions;
  assert.ok(resolutions, 'expected resolution summaries to be present');
  const summary = resolutions[pointer];

  assert.ok(summary, 'expected resolution summary to be present');
  assert.equal(summary.diagnostics.length, 0);
  assert.equal(summary.token.type, 'color');
  assert.deepEqual(summary.token.value, {
    colorSpace: 'srgb',
    components: [0, 82, 204]
  });
  assert.ok(Array.isArray(summary.token.trace));
  assert.ok(summary.token.trace.length > 0);
});

void test('dtif-parse reads documents from stdin', async () => {
  const fixtureUrl = new URL('../fixtures/cli/basic.json', import.meta.url);
  const fixturePath = fileURLToPath(fixtureUrl);
  const fixtureContent = await readFile(fixturePath, 'utf8');

  const stdout = createWritableBuffer();
  const stderr = createWritableBuffer();
  const stdin = Readable.from([fixtureContent]);

  const exitCode = await runCli(['--format', 'json', '-'], {
    stdin,
    stdout: stdout.stream,
    stderr: stderr.stream
  });

  assert.equal(exitCode, 0);
  assert.equal(stderr.toString(), '');

  const outputRaw: unknown = JSON.parse(stdout.toString());
  assertIsCliOutput(outputRaw);
  const output = outputRaw;
  assert.equal(output.documents.length, 1);
  const document = output.documents[0];
  assert.equal(typeof document.uri, 'string');
  assert.ok(document.uri.startsWith('memory://'));
});

void test('dtif-parse reports errors for unknown options', async () => {
  const stdout = createWritableBuffer();
  const stderr = createWritableBuffer();

  const exitCode = await runCli(['--unknown'], {
    stdout: stdout.stream,
    stderr: stderr.stream
  });

  assert.equal(exitCode, 1);
  const errorOutput = stderr.toString();
  assert.match(errorOutput, /Unknown option/);
  assert.match(errorOutput, /Usage: dtif-parse/);
  assert.equal(stdout.toString(), '');
});
