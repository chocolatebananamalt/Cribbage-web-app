import assert from 'node:assert/strict';
import test from 'node:test';

const registrationLink = await import('../src/lib/api/registration-link.ts');

test('registration-link request reader accepts a bounded JSON body', async () => {
  const request = new Request('https://example.test', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"ok":true}',
  });
  assert.deepEqual(await registrationLink.readRegistrationLinkJson(request), { ok: true });
});

test('registration-link request reader rejects non-JSON, malformed, declared-oversize, and actual-oversize bodies', async () => {
  const cases = [
    new Request('https://example.test', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }),
    new Request('https://example.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }),
    new Request('https://example.test', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '2049' }, body: '{}' }),
    new Request('https://example.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note: 'x'.repeat(2100) }) }),
  ];
  for (const request of cases) assert.equal(await registrationLink.readRegistrationLinkJson(request), null);
});

test('registration-link request reader cancels an oversized stream before later chunks are read', async () => {
  let reads = 0;
  let canceled = false;
  const request = {
    headers: new Headers({ 'content-type': 'application/json' }),
    body: {
      getReader() {
        return {
          async read() {
            reads += 1;
            if (reads === 1) return { done: false, value: new Uint8Array(2000) };
            if (reads === 2) return { done: false, value: new Uint8Array(49) };
            throw new Error('reader must not consume a later chunk');
          },
          async cancel() { canceled = true; },
          releaseLock() {},
        };
      },
    },
  };
  assert.equal(await registrationLink.readRegistrationLinkJson(request), null);
  assert.equal(reads, 2);
  assert.equal(canceled, true);
});

test('rotation and closure require an exact current link/version and a canonical expiry', () => {
  const valid = {
    expectedLinkId: '0f2f2d31-12ab-4bcd-8b8c-1234567890ab', expectedVersion: 2,
    expiresAt: '2027-01-01T00:00:00.000Z', maxClaims: 100, maxClaimsPerHour: 10,
    operationId: '1f2f2d31-12ab-4bcd-8b8c-1234567890ab',
  };
  assert.equal(registrationLink.isRegistrationLinkRotateRequest(valid), true);
  assert.equal(registrationLink.isRegistrationLinkCloseRequest({
    expectedLinkId: valid.expectedLinkId, expectedVersion: valid.expectedVersion, operationId: valid.operationId,
  }), true);
  assert.equal(registrationLink.isRegistrationLinkRotateRequest({ ...valid, expiresAt: '2027-01-01T00:00:00+00:00' }), false);
  assert.equal(registrationLink.isRegistrationLinkRotateRequest({ ...valid, expectedVersion: 0 }), false);
  assert.equal(registrationLink.isRegistrationLinkCloseRequest({ ...valid, extra: true }), false);
});
