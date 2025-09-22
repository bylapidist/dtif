import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Readable, Writable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { runCli } from '../../src/cli/parse.js';

function createWritableBuffer() {
  let data = '';
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      data += typeof chunk === 'string' ? chunk : chunk.toString();
      callback();
    }
  });
  return {
    stream: stream as unknown as NodeJS.WritableStream,
    toString() {
      return data;
    }
  };
}

test('dtif-parse outputs JSON summary for file inputs', async () => {
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

  const output = JSON.parse(stdout.toString());
  assert.equal(output.documents.length, 1);
  assert.equal(output.summary.error, 0);
  assert.equal(output.summary.warning, 0);
  assert.equal(output.summary.info, 0);

  const document = output.documents[0];
  assert.equal(document.uri, pathToFileURL(fixturePath).href);
  assert.equal(document.diagnosticCounts.total, 0);
  assert.equal(document.resolverAvailable, true);
});

test('dtif-parse resolves requested pointers', async () => {
  const fixtureUrl = new URL('../fixtures/cli/basic.json', import.meta.url);
  const fixturePath = fileURLToPath(fixtureUrl);

  const stdout = createWritableBuffer();
  const exitCode = await runCli([fixturePath, '--format', 'json', '--resolve', '#/color/brand/alias'], {
    stdout: stdout.stream,
    stderr: createWritableBuffer().stream
  });

  assert.equal(exitCode, 0);

  const output = JSON.parse(stdout.toString());
  const document = output.documents[0];
  const pointer = '#/color/brand/alias';
  const summary = document.resolutions[pointer];

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

test('dtif-parse reads documents from stdin', async () => {
  const fixtureUrl = new URL('../fixtures/cli/basic.json', import.meta.url);
  const fixturePath = fileURLToPath(fixtureUrl);
  const fixtureContent = await readFile(fixturePath, 'utf8');

  const stdout = createWritableBuffer();
  const stderr = createWritableBuffer();
  const stdin = Readable.from([fixtureContent]);

  const exitCode = await runCli(['--format', 'json', '-'], {
    stdin: stdin as unknown as NodeJS.ReadableStream,
    stdout: stdout.stream,
    stderr: stderr.stream
  });

  assert.equal(exitCode, 0);
  assert.equal(stderr.toString(), '');

  const output = JSON.parse(stdout.toString());
  assert.equal(output.documents.length, 1);
  const document = output.documents[0];
  assert.equal(typeof document.uri, 'string');
  assert.ok(document.uri.startsWith('memory://'));
});

test('dtif-parse reports errors for unknown options', async () => {
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
