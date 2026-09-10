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
