import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

import { DefaultDocumentLoader, DocumentLoaderError } from '../../src/io/document-loader.js';
import type { ParseInputRecord } from '../../src/types.js';

const textDecoder = new TextDecoder();

function decodeBytes(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

test('loads inline JSON content into a memory-backed handle', async () => {
  const loader = new DefaultDocumentLoader();
  const json = '{\n  "foo": "bar"\n}';

  const handle = await loader.load(json);

  assert.equal(handle.uri.protocol, 'memory:');
  assert.equal(handle.contentType, 'application/json');
  assert.equal(decodeBytes(handle.bytes), json);
});

test('loads filesystem documents using relative paths', async () => {
  const loader = new DefaultDocumentLoader();
  const fixturePath = path.join('tests', 'fixtures', 'sample.json');
  const handle = await loader.load(fixturePath);

  assert.equal(handle.uri.protocol, 'file:');
  assert.equal(handle.contentType, 'application/json');

  const fileBytes = await readFile(fixturePath);
  assert.equal(decodeBytes(handle.bytes), decodeBytes(fileBytes));
});

test('supports explicit parse input records with URIs', async () => {
  const loader = new DefaultDocumentLoader();
  const record: ParseInputRecord = {
    uri: 'memory://custom/document',
    content: 'collection:\n  base: 1\n',
    contentType: 'application/yaml'
  };

  const handle = await loader.load(record);

  assert.equal(handle.uri.href, 'memory://custom/document');
  assert.equal(handle.contentType, 'application/yaml');
  assert.equal(decodeBytes(handle.bytes), record.content);
});

test('rejects HTTP(S) requests when not allowed', async () => {
  const loader = new DefaultDocumentLoader();

  await assert.rejects(
    () => loader.load(new URL('https://example.com/tokens.json')),
    /HTTP\(S\) loading is disabled/
  );
});

test('fetches HTTP resources when allowed', async () => {
  const body = new TextEncoder().encode('{"ok":true}');
  let requestedUrl: URL | undefined;

  const fetchStub: typeof fetch = async (input) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    requestedUrl = new URL(href);
    return {
      ok: true,
      status: 200,
      headers: {
        get(name: string) {
          return name.toLowerCase() === 'content-type' ? 'application/json' : null;
        }
      },
      arrayBuffer: async () => body.slice().buffer
    } as unknown as Response;
  };

  const loader = new DefaultDocumentLoader({ allowHttp: true, fetch: fetchStub });
  const handle = await loader.load(new URL('https://example.com/tokens.json'));

  assert.equal(requestedUrl?.href, 'https://example.com/tokens.json');
  assert.equal(handle.contentType, 'application/json');
  assert.equal(decodeBytes(handle.bytes), decodeBytes(body));
});

test('resolves relative paths against a base URI', async () => {
  const loader = new DefaultDocumentLoader();
  const baseDirectory = path.resolve('tests/fixtures');
  const baseWithSlash = baseDirectory.endsWith(path.sep)
    ? baseDirectory
    : `${baseDirectory}${path.sep}`;
  const baseUri = pathToFileURL(baseWithSlash);

  const handle = await loader.load('collection.yaml', { baseUri });

  assert.equal(handle.uri.href, pathToFileURL(path.join(baseDirectory, 'collection.yaml')).href);
  assert.equal(handle.contentType, 'application/yaml');
});

test('treats Uint8Array input as raw bytes', async () => {
  const loader = new DefaultDocumentLoader();
  const content = new TextEncoder().encode('---\nfoo: bar\n');

  const handle = await loader.load(content);

  assert.equal(handle.uri.protocol, 'memory:');
  assert.equal(handle.contentType, 'application/json');
  assert.equal(decodeBytes(handle.bytes), decodeBytes(content));
});

test('enforces the configured maximum byte length for inline content', async () => {
  const loader = new DefaultDocumentLoader({ maxBytes: 64 });
  const payload = JSON.stringify({ value: 'x'.repeat(80) });

  await assert.rejects(
    () => loader.load(payload),
    (error) => {
      assert.ok(error instanceof DocumentLoaderError);
      assert.equal(error.reason, 'MAX_BYTES_EXCEEDED');
      assert.equal(error.limit, 64);
      assert.ok(
        /exceeding the configured maximum/.test(error.message),
        'expected error message to mention configured maximum'
      );
      return true;
    }
  );
});

test('allows larger documents when raising the byte limit', async () => {
  const loader = new DefaultDocumentLoader({ maxBytes: 256 });
  const content = new TextEncoder().encode('a'.repeat(200));

  const handle = await loader.load(content);

  assert.equal(handle.bytes.byteLength, content.byteLength);
});
