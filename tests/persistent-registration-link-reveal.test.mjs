import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const secret = await import("../src/lib/registration-link-secret.ts");

const env = { ACC_REGISTRATION_LINK_REVEAL_KEY: Buffer.alloc(32, 9).toString("base64url") };
const tournamentId = "00000000-0000-4000-8000-000000000001";
const linkId = "00000000-0000-4000-8000-000000000002";
const credential = `${linkId}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

test("registration credential envelopes decrypt only with the exact tournament and link context", () => {
  const envelope = secret.sealRegistrationLinkCredential(tournamentId, credential, env);
  assert.equal(secret.openRegistrationLinkCredential(tournamentId, linkId, envelope, env), credential);
  assert.throws(() => secret.openRegistrationLinkCredential("00000000-0000-4000-8000-000000000003", linkId, envelope, env));
  assert.throws(() => secret.openRegistrationLinkCredential(tournamentId, "00000000-0000-4000-8000-000000000004", envelope, env));
});

test("public claims require distinct first and last names rather than a single ambiguous name", async () => {
  const contract = await readFile("src/lib/api/public-registration-v2.ts", "utf8");
  const route = await readFile("src/app/api/v1/registration/claims/route.ts", "utf8");
  assert.match(contract, /"firstName", "lastName"/);
  assert.match(contract, /claim\.firstName\.trim\(\)\.length >= 1/);
  assert.match(contract, /claim\.lastName\.trim\(\)\.length >= 1/);
  assert.match(route, /submit_registration_claim_v4/);
  assert.match(route, /p_first_name: body\.firstName/);
});

test("persistent reveal migration keeps envelopes private, audits reveal metadata, and preserves legacy links", async () => {
  const sql = await readFile("database/migrations/0203_persistent_registration_link_reveal_and_name_parts.sql", "utf8");
  assert.match(sql, /create table app\.registration_link_reveal_envelopes/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /revoke all on table app\.registration_link_reveal_envelopes from public, anon, authenticated/i);
  assert.match(sql, /registration_link_credential_revealed/i);
  assert.match(sql, /legacy_unrecoverable/i);
  assert.match(sql, /get_registration_link_reveal_availability_v1/i);
  assert.doesNotMatch(sql, /rename to issue_registration_link_v2_before_reveal/i);
  assert.match(sql, /submit_registration_claim_v4/i);
  assert.match(sql, /'directorName'/i);
});

test("registration UI offers repeatable active viewing and renders status only once", async () => {
  const client = await readFile("src/app/tournament/[tournamentId]/registration/registration-link-client.tsx", "utf8");
  const form = await readFile("src/app/register/registration-form.tsx", "utf8");
  assert.match(client, /View Active QR Code/);
  assert.match(client, /View Active Link/);
  assert.match(client, /Replace Active QR Code and Link/);
  assert.equal((client.match(/stateMessage\(state\)/g) ?? []).length, 1);
  const page = await readFile("src/app/tournament/[tournamentId]/registration/page.tsx", "utf8");
  assert.match(page, /legacy active link remains usable/i);
  assert.match(form, /Tournament Director:/);
  assert.match(form, /Phone:/);
  assert.match(form, /tournamentContact\.phone \?/);
  assert.match(form, /tournamentContact\.email \?/);
  assert.match(form, /First name/);
  assert.match(form, /Last name/);
  assert.match(form, /Thank you and welcome/);
});
