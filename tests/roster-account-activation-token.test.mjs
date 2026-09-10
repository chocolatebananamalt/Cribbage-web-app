import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import test from "node:test";

const moduleUrl = pathToFileURL(path.join(process.cwd(), "src/lib/roster-account-activation-token.ts")).href;
const token = await import(moduleUrl);

test("activation credentials are 256-bit opaque fragments with canonical parsing", () => {
  const credential = token.createRosterAccountActivationCredential(randomUUID());
  assert.match(credential.activationId, /^[0-9a-f-]{36}$/);
  assert.match(credential.secret, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(token.parseRosterAccountActivationCredential(credential.canonicalToken)?.canonicalToken, credential.canonicalToken);
  assert.equal(
    token.parseRosterAccountActivationCredential(`${credential.activationId.toUpperCase()}.${credential.secret}`)?.canonicalToken,
    credential.canonicalToken,
  );
  assert.notEqual(token.parseRosterAccountActivationCredential(credential.canonicalToken.toUpperCase())?.canonicalToken, credential.canonicalToken);
});

test("activation credential parsing rejects URLs, altered grammar, and whitespace", () => {
  const credential = token.createRosterAccountActivationCredential(randomUUID());
  for (const value of [
    `https://example.test/activate#${credential.canonicalToken}`,
    `#${credential.canonicalToken}`,
    `${credential.canonicalToken}.extra`,
    ` ${credential.canonicalToken}`,
    `${credential.canonicalToken} `,
    credential.canonicalToken.replace(".", "_"),
  ]) assert.equal(token.parseRosterAccountActivationCredential(value), null);
});

test("activation digest is salted, fixed length, and equality is exact", () => {
  const credential = token.createRosterAccountActivationCredential(randomUUID());
  const salt = new Uint8Array(32).fill(7);
  const digest = token.digestRosterAccountActivationCredential(salt, credential.canonicalToken);
  assert.equal(digest.byteLength, 32);
  assert.equal(token.matchesRosterAccountActivationDigest(digest, digest), true);
  assert.equal(token.matchesRosterAccountActivationDigest(digest, new Uint8Array(32)), false);
  assert.throws(() => token.digestRosterAccountActivationCredential(new Uint8Array(31), credential.canonicalToken), /256 bits/);
  assert.throws(() => token.digestRosterAccountActivationCredential(salt, `${credential.canonicalToken} `), /Invalid/);
});
