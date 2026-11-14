import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isRejectedPaymentObligation } from "../src/lib/api/payment-obligation.ts";
import { clearAppSessionStorage, countAppSessionStorageRecords } from "../src/lib/client-session-storage.ts";

const read = (path) => fs.readFileSync(path, "utf8");
const client = read("src/app/tournament/[tournamentId]/payments/payment-obligation-client.tsx");
const recovery = read("src/lib/payments/payment-obligation-recovery-v2.ts");
const page = read("src/app/tournament/[tournamentId]/payments/page.tsx");
const api = read("src/lib/api/payment-obligation.ts");
const route = read("src/app/api/v1/tournaments/[id]/payment-obligations/route.ts");

test("payment obligation edits retain an exact actor scoped request for explicit retry", () => {
  assert.match(recovery, /payment-obligation:\$\{actorId\}:\$\{tournamentId\}:\$\{rosterEntryId\}/);
  assert.match(client, /createPaymentObligationRecoveryEnvelopeV2/);
  assert.match(client, /setAppRecoveryItem\(window\.sessionStorage, key, raw\)/);
  assert.match(client, /trackAppRecoveryWrite/);
  assert.match(client, /window\.sessionStorage\.getItem\(key\) !== activePending\.raw/);
  assert.match(client, /Retry Exact Amount Owed Request/);
  assert.match(client, /!hydrated \|\| storageUnavailable \|\| busy \|\| inFlight\.current/);
  assert.match(client, /disabled=\{storageUnavailable \|\| busy \|\| !!pending \|\| !hydrated\}/);
  assert.match(client, /exact recovery record remains saved for retry/);
  assert.match(client, /exact amount owed request was confirmed\. Refreshing the current amount/);
  assert.doesNotMatch(client, /Amount owed saved/);
  assert.match(client, /x-expected-actor-id/);
  assert.doesNotMatch(client, /sessionStorage\.setItem/);
  assert.doesNotMatch(client, /setMessage\("The amount owed was not saved/);
  assert.match(page, /<PaymentObligationClient actorId=\{access\.user\.id\}/);
});

test("payment obligation route binds the expected actor and exposes only strict outcomes", () => {
  assert.match(route, /readExpectedPaymentActor/);
  assert.match(route, /requireVerifiedSubject\(client\) !== expectedActorId/);
  assert.equal((route.match(/paymentActorMatches\(client, expectedActorId\)/g) ?? []).length, 2);
  assert.match(route, /isSavedPaymentObligation/);
  assert.match(route, /isRejectedPaymentObligation/);
  assert.match(route, /operation_unavailable/);
  assert.doesNotMatch(route, /service_role|\.from\(/);
});

test("payment obligation rejection codec requires the same roster entry", () => {
  assert.match(api, /invalid_request.*tournament_unavailable.*not_director.*idempotency_conflict.*roster_entry_unavailable.*stale_obligation/);
  assert.match(api, /isRejectedPaymentObligation/);
  assert.match(client, /response\.status === 409 && isRejectedPaymentObligation\(result, activePending\.request\)/);
  const request = { rosterEntryId: "10000000-0000-4000-8000-000000000001" };
  assert.equal(isRejectedPaymentObligation({ status: "rejected", code: "stale_obligation", rosterEntryId: request.rosterEntryId }, request), true);
  assert.equal(isRejectedPaymentObligation({ status: "rejected", code: "stale_obligation", rosterEntryId: "other" }, request), false);
  assert.equal(isRejectedPaymentObligation({ status: "rejected", code: "unknown", rosterEntryId: request.rosterEntryId }, request), false);
});

test("shared-device cleanup accounts for new create and amount-owed retry envelopes", () => {
  const values = new Map([["payment-obligation:actor:tournament:roster", "{}"], ["director-new-tournament-pending:actor", "{}"], ["event-start:actor:tournament", "{}"], ["tournament-creation-seed:actor:tournament", "{}"], ["unrelated", "keep"]]);
  const storage = { get length() { return values.size; }, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => values.delete(key) };
  assert.equal(countAppSessionStorageRecords(storage), 4);
  clearAppSessionStorage(storage);
  assert.deepEqual([...values.keys()], ["unrelated"]);
});
