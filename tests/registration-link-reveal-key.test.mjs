import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

import { registrationLinkRevealKeyConfigured, sealRegistrationLinkCredential } from "../src/lib/registration-link-secret.ts";

const KEY = randomBytes(32);
const TOURNAMENT = "fe1ef5f5-6225-4c00-840b-337be49aa8b8";

// Create Link returned 503 on production with the reason swallowed by the API
// failure boundary. The key parser accepted base64url only, so the output of
// `openssl rand -base64 32` (padded, with + and /) was rejected as "not
// configured" even though it is a perfectly good 32 byte key.
test("a 32 byte key is accepted in any ordinary encoding", () => {
  for (const [label, encoded] of [
    ["base64url", KEY.toString("base64url")],
    ["base64", KEY.toString("base64")],
    ["hex", KEY.toString("hex")],
  ]) {
    assert.ok(
      registrationLinkRevealKeyConfigured({ ACC_REGISTRATION_LINK_REVEAL_KEY: encoded }),
      `a 32 byte key written as ${label} must be accepted`,
    );
  }
});

test("surrounding whitespace from a copy and paste is tolerated", () => {
  assert.ok(registrationLinkRevealKeyConfigured({ ACC_REGISTRATION_LINK_REVEAL_KEY: `  ${KEY.toString("base64")}\n` }));
});

// The strength requirement is the point of the check and must not have been
// loosened along with the encoding.
test("anything that is not exactly 32 bytes is still refused", () => {
  for (const [label, value] of [
    ["absent", undefined],
    ["empty", ""],
    ["16 bytes", randomBytes(16).toString("base64url")],
    ["31 bytes", randomBytes(31).toString("base64url")],
    ["33 bytes", randomBytes(33).toString("base64url")],
    ["not an encoding", "this is not a key"],
  ]) {
    assert.equal(
      registrationLinkRevealKeyConfigured({ ACC_REGISTRATION_LINK_REVEAL_KEY: value }),
      false,
      `${label} must not be accepted as a reveal key`,
    );
  }
});

test("a key accepted by the probe actually seals a credential", () => {
  const env = { ACC_REGISTRATION_LINK_REVEAL_KEY: KEY.toString("base64") };
  assert.ok(registrationLinkRevealKeyConfigured(env));
  const envelope = sealRegistrationLinkCredential(TOURNAMENT, `${TOURNAMENT}.${"a".repeat(43)}`, env);
  assert.ok(envelope && typeof envelope.nonce === "string" && typeof envelope.ciphertext === "string");
});

// The whole point of the probe is that the director is told which setting is
// missing rather than being shown a blank failure.
test("the route names the missing setting instead of returning a bare 503", () => {
  const route = readFileSync("src/app/api/v1/tournaments/[id]/registration-links/route.ts", "utf8");
  assert.match(route, /registrationLinkRevealKeyConfigured\(\)/);
  assert.match(route, /registration_link_reveal_key_required/);
  const client = readFileSync("src/app/tournament/[tournamentId]/registration/registration-link-client.tsx", "utf8");
  assert.match(client, /registration_link_reveal_key_required/);
  assert.match(client, /ACC_REGISTRATION_LINK_REVEAL_KEY/, "the message must name the setting an operator has to set");
});

// Credential hygiene: the value must never be able to reach a log or a response.
test("the reveal key value never appears in an error or a response", () => {
  const secret = readFileSync("src/lib/registration-link-secret.ts", "utf8");
  assert.ok(!/console\.(log|warn|error)/.test(secret), "the reveal key module must never log");
  for (const thrown of secret.matchAll(/throw new Error\(([^)]*)\)/g)) {
    assert.ok(
      /^"[^"]*"$/.test(thrown[1].trim()),
      `every thrown message must be a fixed string, found: ${thrown[1].trim()}`,
    );
  }
});
