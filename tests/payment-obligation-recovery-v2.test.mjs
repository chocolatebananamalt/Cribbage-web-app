import assert from "node:assert/strict";
import test from "node:test";
import {
  createPaymentObligationRecoveryEnvelopeV2,
  parsePaymentObligationRecoveryRaw,
  paymentObligationRecoveryStorageKey,
  readPaymentObligationRecovery,
} from "../src/lib/payments/payment-obligation-recovery-v2.ts";

const id = (n) => `f3280000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = id(1), other = id(2), tournament = id(3), roster = id(4), operation = id(5);
const zero = { rosterEntryId: roster, expectedVersion: 0, amountOwedMinor: 0, reason: "No fee due", idempotencyKey: operation };
class MemoryStorage { #values = new Map(); get length() { return this.#values.size; } key(index) { return [...this.#values.keys()][index] ?? null; } getItem(key) { return this.#values.get(key) ?? null; } setItem(key, value) { this.#values.set(key, String(value)); } removeItem(key) { this.#values.delete(key); } }

test("v2 obligation recovery preserves an exact zero-owed request", () => {
  const envelope = createPaymentObligationRecoveryEnvelopeV2(actor, tournament, roster, zero);
  assert.ok(envelope);
  assert.notEqual(envelope.request, zero);
  const parsed = parsePaymentObligationRecoveryRaw(JSON.stringify(envelope), actor, tournament, roster);
  assert.equal(parsed.status, "current");
  assert.deepEqual(parsed.request, zero);
  assert.equal(paymentObligationRecoveryStorageKey(actor, tournament, roster), `payment-obligation:${actor}:${tournament}:${roster}`);
});

test("constructor fails closed for malformed requests and noncanonical actor scope", () => {
  assert.equal(createPaymentObligationRecoveryEnvelopeV2(actor.toUpperCase(), tournament, roster, zero), null);
  assert.equal(createPaymentObligationRecoveryEnvelopeV2(actor, tournament, roster, null), null);
  assert.equal(createPaymentObligationRecoveryEnvelopeV2(actor, tournament, roster, { ...zero, rosterEntryId: id(9) }), null);
  assert.equal(parsePaymentObligationRecoveryRaw(JSON.stringify(zero), actor.toUpperCase(), tournament, roster).status, "unknown");
});

test("the original complete request remains readable without migration", () => {
  const raw = JSON.stringify(zero);
  const parsed = parsePaymentObligationRecoveryRaw(raw, actor, tournament, roster);
  assert.equal(parsed.status, "legacy");
  assert.equal(parsed.raw, raw);
  assert.deepEqual(parsed.request, zero);
});

test("future, malformed, foreign-scope and wrong-roster bytes remain unknown", () => {
  const envelope = createPaymentObligationRecoveryEnvelopeV2(actor, tournament, roster, zero);
  assert.ok(envelope);
  for (const raw of [
    "{future",
    JSON.stringify({ ...envelope, futureField: true }),
    JSON.stringify({ ...envelope, actorId: other }),
    JSON.stringify({ ...zero, futureField: true }),
    JSON.stringify({ ...zero, rosterEntryId: id(9) }),
  ]) assert.equal(parsePaymentObligationRecoveryRaw(raw, actor, tournament, roster).status, "unknown");
});

test("reading never deletes current, legacy, unknown, or another actor's bytes", () => {
  const storage = new MemoryStorage(), key = paymentObligationRecoveryStorageKey(actor, tournament, roster), otherKey = paymentObligationRecoveryStorageKey(other, tournament, roster);
  storage.setItem(key, "{unknown"); storage.setItem(otherKey, "OTHER ACTOR BYTES");
  assert.equal(readPaymentObligationRecovery(storage, key, actor, tournament, roster).status, "unknown");
  assert.equal(storage.getItem(key), "{unknown");
  assert.equal(storage.getItem(otherKey), "OTHER ACTOR BYTES");
});
