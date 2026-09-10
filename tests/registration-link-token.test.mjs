import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';

const token = await import('../src/lib/registration-link-token.ts');
const linkId = '0f2f2d31-12ab-4bcd-8b8c-1234567890ab';

test('registration credentials are opaque 256-bit fragment values', () => {
  const credential = token.createRegistrationLinkCredential(linkId);
  assert.equal(credential.linkId, linkId);
  assert.match(credential.secret, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(credential.canonicalToken, `${linkId}.${credential.secret}`);
  assert.deepEqual(token.parseRegistrationLinkCredential(credential.canonicalToken), credential);
});

test('registration credential parser rejects URLs, paths, legacy values, and malformed fragments', () => {
  const credential = token.createRegistrationLinkCredential(linkId);
  for (const value of [
    `https://example.test/register#${credential.canonicalToken}`,
    `/register/${credential.canonicalToken}`,
    `?token=${credential.canonicalToken}`,
    credential.secret,
    `${linkId}.${credential.secret}.extra`,
    ` ${credential.canonicalToken}`,
    credential.canonicalToken.replace(/.$/, '!'),
  ]) assert.equal(token.parseRegistrationLinkCredential(value), null);
});

test('only a fixed-length digest leaves the application-server credential boundary', () => {
  const credential = token.createRegistrationLinkCredential(linkId);
  const salt = randomBytes(32);
  const digest = token.digestRegistrationLinkCredential(salt, credential.canonicalToken);
  assert.equal(digest.byteLength, 32);
  assert.equal(token.matchesRegistrationLinkDigest(digest, digest), true);
  assert.equal(token.matchesRegistrationLinkDigest(digest, randomBytes(32)), false);
  assert.equal(token.matchesRegistrationLinkDigest(digest, randomBytes(31)), false);
  assert.throws(() => token.digestRegistrationLinkCredential(randomBytes(31), credential.canonicalToken), /256 bits/);
  assert.throws(() => token.digestRegistrationLinkCredential(salt, `/register/${credential.canonicalToken}`), /Invalid/);
});

test('invalid registration digests are rejected before the serialized claim lock', async () => {
  const sql = await import('node:fs/promises').then(({ readFile }) => readFile('database/migrations/0072_registration_claim_invalid_digest_prelock_rejection.sql', 'utf8'));
  const prelock = sql.indexOf('from app.tournament_registration_links l\n  where l.id = p_link_id and app.fixed_32_byte_equal(l.token_digest, p_digest);');
  const lock = sql.indexOf("perform pg_catalog.pg_advisory_xact_lock");
  assert.ok(prelock >= 0, 'the preliminary digest check exists');
  assert.ok(lock > prelock, 'the advisory lock follows the digest check');
  assert.match(sql.slice(prelock, lock), /if not found then return jsonb_build_object\('status', 'unavailable'\); end if;/);
  assert.match(sql.slice(lock), /or not app\.fixed_32_byte_equal\(v_link\.token_digest, p_digest\)/, 'the locked state still rechecks the digest');
});

test('the v2 issuer receives the link ID before it stores the credential digest', async () => {
  const sql = await import('node:fs/promises').then(({ readFile }) => readFile('database/migrations/0073_registration_link_issuer_supplied_id.sql', 'utf8'));
  assert.match(sql, /p_link_id uuid, p_salt bytea, p_digest bytea/i);
  assert.match(sql, /p_link_id::text,\s*\n\s*encode\(p_salt, 'hex'\)/i, 'idempotency binds the supplied link ID');
  assert.match(sql, /values \(\s*\n\s*p_link_id, p_tournament_id, null, 2, p_salt, p_digest/i);
  assert.match(sql, /jsonb_build_object\('status', 'issued', 'linkId', p_link_id/i);
  assert.doesNotMatch(sql, /v_link_id uuid := extensions\.gen_random_uuid/i);
});
