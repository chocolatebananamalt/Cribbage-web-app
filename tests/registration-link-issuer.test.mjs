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
  assert.equal(result.status, 'issued');
  assert.equal(observed.name, 'issue_registration_link_v2');
  assert.equal(observed.args.p_link_id, result.credential.linkId);
  assert.match(observed.args.p_salt, /^\\x[0-9a-f]{64}$/);
  assert.match(observed.args.p_digest, /^\\x[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(observed.args).includes(result.credential.secret), false);
  assert.equal(result.expiresAt, '2027-01-01T00:00:00.000Z');
});

test('server-only registration issuer accepts PostgreSQL timestamp serialization for the requested instant', async () => {
  let observed;
  const admin = { rpc: async (_name, args) => {
    observed = args;
    return { data: { status: 'issued', state: 'open', linkId: args.p_link_id, expiresAt: '2027-01-01T00:00:00+00:00' }, error: null };
  } };
  const result = await issuer.issueRegistrationLink(admin, {
    actorId: '0f2f2d31-12ab-4bcd-8b8c-1234567890ab', tournamentId: '1f2f2d31-12ab-4bcd-8b8c-1234567890ab',
    expiresAt: new Date('2027-01-01T00:00:00.000Z'), maxClaims: 100, maxClaimsPerHour: 10,
    operationId: '2f2f2d31-12ab-4bcd-8b8c-1234567890ab',
  });
  assert.equal(result.status, 'issued');
  assert.equal(observed.p_expires_at, '2027-01-01T00:00:00.000Z');
});

test('server-only registration issuer rejects a timestamp-only receipt mismatch', async () => {
  const admin = { rpc: async (_name, args) => ({ data: {
    status: 'issued', state: 'open', linkId: args.p_link_id, expiresAt: '2027-01-01T00:00:01+00:00',
  }, error: null }) };
  const result = await issuer.issueRegistrationLink(admin, {
    actorId: '0f2f2d31-12ab-4bcd-8b8c-1234567890ab', tournamentId: '1f2f2d31-12ab-4bcd-8b8c-1234567890ab',
    expiresAt: new Date('2027-01-01T00:00:00.000Z'), maxClaims: 100, maxClaimsPerHour: 10,
    operationId: '2f2f2d31-12ab-4bcd-8b8c-1234567890ab',
  });
  assert.deepEqual(result, { status: 'credential_unavailable' });
});

test('server-only registration issuer never recovers or regenerates a prior one-time credential', async () => {
  const admin = { rpc: async () => ({ data: {
    status: 'issued', state: 'open', linkId: '0f2f2d31-12ab-4bcd-8b8c-1234567890ab', expiresAt: '2027-01-01T00:00:00.000Z',
  }, error: null }) };
  const result = await issuer.issueRegistrationLink(admin, {
    actorId: '0f2f2d31-12ab-4bcd-8b8c-1234567890ab', tournamentId: '1f2f2d31-12ab-4bcd-8b8c-1234567890ab',
    expiresAt: new Date('2027-01-01T00:00:00.000Z'), maxClaims: 100, maxClaimsPerHour: 10,
    operationId: '2f2f2d31-12ab-4bcd-8b8c-1234567890ab',
  });
  assert.deepEqual(result, { status: 'credential_unavailable' });
});

test('server-only registration issuer exposes only narrow expected lifecycle conflicts', async () => {
  const admin = { rpc: async () => ({ data: { status: 'rejected', code: 'active_link_exists' }, error: null }) };
  const result = await issuer.issueRegistrationLink(admin, {
    actorId: '0f2f2d31-12ab-4bcd-8b8c-1234567890ab', tournamentId: '1f2f2d31-12ab-4bcd-8b8c-1234567890ab',
    expiresAt: new Date('2027-01-01T00:00:00.000Z'), maxClaims: 100, maxClaimsPerHour: 10,
    operationId: '2f2f2d31-12ab-4bcd-8b8c-1234567890ab',
  });
  assert.deepEqual(result, { status: 'rejected', code: 'active_link_exists' });
});

test('server-only registration issuer rejects mismatched receipts without returning a credential', async () => {
  const admin = { rpc: async () => ({ data: { status: 'issued', state: 'closed', linkId: 'wrong', expiresAt: '2027-01-01T00:00:00.000Z' }, error: null }) };
  await assert.rejects(() => issuer.issueRegistrationLink(admin, {
    actorId: '0f2f2d31-12ab-4bcd-8b8c-1234567890ab', tournamentId: '1f2f2d31-12ab-4bcd-8b8c-1234567890ab',
    expiresAt: new Date('2027-01-01T00:00:00.000Z'), maxClaims: 100, maxClaimsPerHour: 10,
    operationId: '2f2f2d31-12ab-4bcd-8b8c-1234567890ab',
  }), /unavailable/);
});

test('server-only registration rotation binds the replacement credential to the exact current head', async () => {
  let observed;
  const admin = { rpc: async (name, args) => {
    observed = { name, args };
    return { data: { status: 'rotated', state: 'open', linkId: args.p_link_id, expiresAt: args.p_expires_at, version: 8 }, error: null };
  } };
  const result = await issuer.rotateRegistrationLink(admin, {
    actorId: '0f2f2d31-12ab-4bcd-8b8c-1234567890ab', tournamentId: '1f2f2d31-12ab-4bcd-8b8c-1234567890ab',
    expectedLinkId: '3f2f2d31-12ab-4bcd-8b8c-1234567890ab', expectedVersion: 7,
    expiresAt: new Date('2027-01-01T00:00:00.000Z'), maxClaims: 100, maxClaimsPerHour: 10,
    operationId: '2f2f2d31-12ab-4bcd-8b8c-1234567890ab',
  });
  assert.equal(result.status, 'rotated');
  assert.equal(result.version, 8);
  assert.equal(observed.name, 'rotate_registration_link_v2');
  assert.equal(observed.args.p_expected_link_id, '3f2f2d31-12ab-4bcd-8b8c-1234567890ab');
  assert.equal(observed.args.p_expected_version, 7);
  assert.equal(observed.args.p_link_id, result.credential.linkId);
  assert.match(observed.args.p_salt, /^\\x[0-9a-f]{64}$/);
  assert.match(observed.args.p_digest, /^\\x[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(observed.args).includes(result.credential.secret), false);
});

test('registration rotation never reconstructs a credential from a replayed receipt', async () => {
  const admin = { rpc: async () => ({ data: {
    status: 'rotated', state: 'open', linkId: '0f2f2d31-12ab-4bcd-8b8c-1234567890ab', expiresAt: '2027-01-01T00:00:00.000Z', version: 8,
  }, error: null }) };
  const result = await issuer.rotateRegistrationLink(admin, {
    actorId: '0f2f2d31-12ab-4bcd-8b8c-1234567890ab', tournamentId: '1f2f2d31-12ab-4bcd-8b8c-1234567890ab',
    expectedLinkId: '3f2f2d31-12ab-4bcd-8b8c-1234567890ab', expectedVersion: 7,
    expiresAt: new Date('2027-01-01T00:00:00.000Z'), maxClaims: 100, maxClaimsPerHour: 10,
    operationId: '2f2f2d31-12ab-4bcd-8b8c-1234567890ab',
  });
  assert.deepEqual(result, { status: 'credential_unavailable' });
});

test('a same-operation rotation retry uses fresh private material but safely withholds the original credential', async () => {
  let firstReceipt;
  let calls = 0;
  const admin = { rpc: async (_name, args) => {
    calls += 1;
    if (calls === 1) {
      firstReceipt = { status: 'rotated', state: 'open', linkId: args.p_link_id, expiresAt: args.p_expires_at, version: 8 };
      return { data: firstReceipt, error: null };
    }
    assert.notEqual(args.p_link_id, firstReceipt.linkId);
    return { data: firstReceipt, error: null };
  } };
  const input = {
    actorId: '0f2f2d31-12ab-4bcd-8b8c-1234567890ab', tournamentId: '1f2f2d31-12ab-4bcd-8b8c-1234567890ab',
    expectedLinkId: '3f2f2d31-12ab-4bcd-8b8c-1234567890ab', expectedVersion: 7,
    expiresAt: new Date('2027-01-01T00:00:00.000Z'), maxClaims: 100, maxClaimsPerHour: 10,
    operationId: '2f2f2d31-12ab-4bcd-8b8c-1234567890ab',
  };
  assert.equal((await issuer.rotateRegistrationLink(admin, input)).status, 'rotated');
  assert.deepEqual(await issuer.rotateRegistrationLink(admin, input), { status: 'credential_unavailable' });
});

test('registration rotation withholds a credential when the receipt version does not advance exactly once', async () => {
  const admin = { rpc: async (_name, args) => ({ data: {
    status: 'rotated', state: 'open', linkId: args.p_link_id, expiresAt: args.p_expires_at, version: 9,
  }, error: null }) };
  await assert.rejects(() => issuer.rotateRegistrationLink(admin, {
    actorId: '0f2f2d31-12ab-4bcd-8b8c-1234567890ab', tournamentId: '1f2f2d31-12ab-4bcd-8b8c-1234567890ab',
    expectedLinkId: '3f2f2d31-12ab-4bcd-8b8c-1234567890ab', expectedVersion: 7,
    expiresAt: new Date('2027-01-01T00:00:00.000Z'), maxClaims: 100, maxClaimsPerHour: 10,
    operationId: '2f2f2d31-12ab-4bcd-8b8c-1234567890ab',
  }), /unavailable/);
});
