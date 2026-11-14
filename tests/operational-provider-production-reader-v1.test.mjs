import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { largeJsonRequestBodyLimit } from '../src/lib/api/bounded-json.ts';
import {
  operationalProviderRequestBodyLimitV1,
  readOperationalProviderJsonV1,
} from '../src/lib/api/operational-provider-request-reader-v1.ts';

const request = value => new Request('http://localhost/api/v1/fixture', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ kind: 'operational-provider-reader-fixture-v1', value }),
});

test('production factory uses the dedicated 4.2 MB reader instead of the shared 512 KiB reader', () => {
  const source = fs.readFileSync(new URL('../src/lib/api/operational-provider-production-v1.ts', import.meta.url), 'utf8');
  assert.match(source, /import\{readOperationalProviderJsonV1\}from'\.\/operational-provider-request-reader-v1\.ts'/);
  assert.match(source, /readJson:readOperationalProviderJsonV1/);
  assert.doesNotMatch(source, /readLargeJson/);
});

test('production reader accepts a valid retained request beyond the shared 512 KiB limit', async () => {
  const value = 'x'.repeat(600_000);
  const bodyBytes = Buffer.byteLength(JSON.stringify({ kind: 'operational-provider-reader-fixture-v1', value }));
  assert.ok(bodyBytes > largeJsonRequestBodyLimit);
  assert.ok(bodyBytes < operationalProviderRequestBodyLimitV1);
  assert.deepEqual(
    await readOperationalProviderJsonV1(request(value), { maxBytes: operationalProviderRequestBodyLimitV1 }),
    { kind: 'operational-provider-reader-fixture-v1', value },
  );
});

test('production reader clamps trusted handler limits to 4.2 MB and honors smaller limits', async () => {
  assert.equal(
    await readOperationalProviderJsonV1(request('x'.repeat(operationalProviderRequestBodyLimitV1)), {
      maxBytes: operationalProviderRequestBodyLimitV1 + 1_000_000,
    }),
    null,
  );
  assert.equal(await readOperationalProviderJsonV1(request('x'.repeat(1_100)), { maxBytes: 1_024 }), null);
  assert.equal(await readOperationalProviderJsonV1(request('small'), { maxBytes: 0 }), null);
});
