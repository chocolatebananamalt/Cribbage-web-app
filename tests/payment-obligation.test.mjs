import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { isPaymentObligationRequest, isPaymentObligationWorkspace } from "../src/lib/api/payment-obligation.ts";

const id = "00000000-0000-4000-8000-000000000001";
const base = { rosterEntryId: id, displayName: "Sample Player" };

test("payment obligation contract recomputes every status and rejects inconsistent money", () => {
  const valid = [
    { ...base, obligationVersion: 0, amountOwedMinor: null, amountReceivedMinor: 1000, amountRemainingMinor: null, paymentStatus: "not_configured" },
    { ...base, obligationVersion: 1, amountOwedMinor: 2000, amountReceivedMinor: 0, amountRemainingMinor: 2000, paymentStatus: "unpaid" },
    { ...base, obligationVersion: 1, amountOwedMinor: 2000, amountReceivedMinor: 1000, amountRemainingMinor: 1000, paymentStatus: "partial" },
    { ...base, obligationVersion: 1, amountOwedMinor: 2000, amountReceivedMinor: 2000, amountRemainingMinor: 0, paymentStatus: "paid" },
    { ...base, obligationVersion: 1, amountOwedMinor: 2000, amountReceivedMinor: 2500, amountRemainingMinor: 0, paymentStatus: "overpaid" },
    { ...base, obligationVersion: 1, amountOwedMinor: 0, amountReceivedMinor: 0, amountRemainingMinor: 0, paymentStatus: "paid" },
  ];
  for (const entry of valid) assert.equal(isPaymentObligationWorkspace({ entries: [entry] }), true);
  assert.equal(isPaymentObligationWorkspace({ entries: [{ ...valid[3], amountReceivedMinor: 1000 }] }), false);
  assert.equal(isPaymentObligationWorkspace({ entries: [{ ...valid[2], amountRemainingMinor: 999 }] }), false);
  assert.equal(isPaymentObligationWorkspace({ entries: [valid[0]], extra: true }), false);
  assert.equal(isPaymentObligationRequest({ rosterEntryId: id, expectedVersion: 0, amountOwedMinor: 2000, reason: "", idempotencyKey: id }), true);
});

test("obligations are append-only, audited, role-scoped, and separate from scoring", () => {
  const sql = fs.readFileSync(new URL("../database/migrations/0158_roster_payment_obligations.sql", import.meta.url), "utf8");
  assert.match(sql, /roster_payment_obligations_immutable/);
  assert.match(sql, /role in\('director','co_director'\)/);
  assert.match(sql, /payment_obligation_saved/);
  assert.doesNotMatch(sql, /(insert into|update) app\.(score|canonical_games|initial_seating)/);
});

test("latest voided receipt projects zero received for full-refund correction", () => {
  const sql = fs.readFileSync(new URL("../database/migrations/0159_pilot_storage_and_payment_projection_repairs.sql", import.meta.url), "utf8");
  assert.match(sql, /case when item\.event_type='received' then item\.amount_minor else 0 end as amount_received_minor/);
  assert.match(sql, /coalesce\(receipt\.amount_received_minor,0\)/);
  assert.match(sql, /select \* into v_existing[\s\S]+if v_status not in\('draft','open','pending_finalization'\)/);
});
