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
