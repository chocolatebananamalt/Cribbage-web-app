import assert from 'node:assert/strict';
import test from 'node:test';

const issuer = await import('../src/lib/registration-link-issuer.ts');

test('server-only registration issuer binds its returned credential ID and only sends bytea digests', async () => {
  let observed;
  const admin = { rpc: async (name, args) => {
    observed = { name, args };
    return { data: { status: 'issued', state: 'open', linkId: args.p_link_id, expiresAt: args.p_expires_at }, error: null };
  } };
  const result = await issuer.issueRegistrationLink(admin, {
    actorId: '0f2f2d31-12ab-4bcd-8b8c-1234567890ab', tournamentId: '1f2f2d31-12ab-4bcd-8b8c-1234567890ab',
    expiresAt: new Date('2027-01-01T00:00:00.000Z'), maxClaims: 100, maxClaimsPerHour: 10,
    operationId: '2f2f2d31-12ab-4bcd-8b8c-1234567890ab',
  });
  assert.equal(observed.name, 'issue_registration_link_v2');
  assert.equal(observed.args.p_link_id, result.credential.linkId);
  assert.match(observed.args.p_salt, /^\\x[0-9a-f]{64}$/);
  assert.match(observed.args.p_digest, /^\\x[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(observed.args).includes(result.credential.secret), false);
  assert.equal(result.expiresAt, '2027-01-01T00:00:00.000Z');
});

test('server-only registration issuer rejects mismatched receipts without returning a credential', async () => {
  const admin = { rpc: async () => ({ data: { status: 'issued', state: 'open', linkId: 'wrong', expiresAt: '2027-01-01T00:00:00.000Z' }, error: null }) };
  await assert.rejects(() => issuer.issueRegistrationLink(admin, {
    actorId: '0f2f2d31-12ab-4bcd-8b8c-1234567890ab', tournamentId: '1f2f2d31-12ab-4bcd-8b8c-1234567890ab',
    expiresAt: new Date('2027-01-01T00:00:00.000Z'), maxClaims: 100, maxClaimsPerHour: 10,
    operationId: '2f2f2d31-12ab-4bcd-8b8c-1234567890ab',
  }), /unavailable/);
});
