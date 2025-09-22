import assert from 'node:assert/strict';
import test from 'node:test';

import { SchemaGuard } from '../../src/validation/schema-guard.js';
import { decodeDocument } from '../../src/io/decoder.js';
import { DiagnosticCodes } from '../../src/diagnostics/codes.js';
import type { DocumentHandle, RawDocument } from '../../src/types.js';

const encoder = new TextEncoder();

async function decodeJsonDocument(json: string): Promise<RawDocument> {
  const handle: DocumentHandle = {
    uri: new URL('memory://schema-guard'),
    contentType: 'application/json',
    bytes: encoder.encode(json)
  };

  return decodeDocument(handle);
}

test('SchemaGuard accepts documents that satisfy the DTIF schema', async () => {
  const json = JSON.stringify(
    {
      $schema: 'https://dtif.lapidist.net/schema/core.json',
      color: {
        brand: {
          primary: {
            $type: 'color',
            $value: {
              colorSpace: 'srgb',
              components: [0, 0, 0]
            }
          }
        }
      }
    },
    null,
    2
  );

  const raw = await decodeJsonDocument(json);
  const guard = new SchemaGuard();

  const result = guard.validate(raw);

  assert.equal(result.valid, true);
  assert.equal(result.diagnostics.length, 0);
});

test('SchemaGuard reports diagnostics with pointers and spans for schema violations', async () => {
  const json = JSON.stringify(
    {
      $schema: 'https://dtif.lapidist.net/schema/core.json',
      color: {
        brand: {
          primary: {
            $type: 'color',
            $value: {
              colorSpace: 'srgb',
              components: []
            }
          }
        }
      }
    },
    null,
    2
  );

  const raw = await decodeJsonDocument(json);
  const guard = new SchemaGuard();

  const result = guard.validate(raw);

  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.length >= 1);

  const diagnostic = result.diagnostics.find(
    (entry) => entry.pointer === '#/color/brand/primary/$value/components'
  );

  assert.ok(diagnostic, 'expected diagnostic for the components pointer');
  assert.equal(diagnostic?.code, DiagnosticCodes.schemaGuard.INVALID_DOCUMENT);
  assert.equal(diagnostic?.severity, 'error');
  assert.ok(diagnostic?.span);
  assert.ok(diagnostic && /schema violation/i.test(diagnostic.message));
  assert.ok(
    diagnostic?.related?.some((info) => /at least 1 item/i.test(info.message)) ?? false,
    'expected related information describing the minItems violation'
  );
});
