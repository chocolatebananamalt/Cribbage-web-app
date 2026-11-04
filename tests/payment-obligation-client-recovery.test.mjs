import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isRejectedPaymentObligation } from "../src/lib/api/payment-obligation.ts";
import { clearAppSessionStorage, countAppSessionStorageRecords } from "../src/lib/client-session-storage.ts";

const read = (path) => fs.readFileSync(path, "utf8");
const client = read("src/app/tournament/[tournamentId]/payments/payment-obligation-client.tsx");
const page = read("src/app/tournament/[tournamentId]/payments/page.tsx");
const api = read("src/lib/api/payment-obligation.ts");

test("payment obligation edits retain an exact actor scoped request for explicit retry", () => {
  assert.match(client, /payment-obligation:\$\{actorId\}:\$\{tournamentId\}:\$\{rosterEntryId\}/);
  assert.match(client, /storePending\(key, request\)/);
  assert.match(client, /Retry Exact Amount Owed Request/);
  assert.match(client, /hydrated \|\| busy \|\| inFlight\.current/);
  assert.match(client, /disabled=\{busy \|\| !!pending \|\| !hydrated\}/);
  assert.match(client, /setMessage\("The amount owed request could not be confirmed/);
  assert.doesNotMatch(client, /setMessage\("The amount owed was not saved/);
  assert.match(page, /<PaymentObligationClient actorId=\{access\.user\.id\}/);
});

test("payment obligation rejection codec requires the same roster entry", () => {
  assert.match(api, /invalid_request.*tournament_unavailable.*not_director.*idempotency_conflict.*roster_entry_unavailable.*stale_obligation/);
  assert.match(api, /isRejectedPaymentObligation/);
  assert.match(client, /response\.status === 409 && isRejectedPaymentObligation\(result, request\)/);
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
