import assert from "node:assert/strict";
import test from "node:test";
import { futurePaymentMethods, octoberPilotPaymentMethods, PAYMENT_METHOD_CATALOG } from "../src/lib/payments/method-catalog.ts";

test("October pilot exposes only director-confirmed cash and check", () => {
  assert.deepEqual(octoberPilotPaymentMethods().map(({ code, confirmation }) => [code, confirmation]), [
    ["cash", "director"],
    ["check", "director"],
  ]);
  assert.deepEqual(octoberPilotPaymentMethods(["check"]).map(({ code }) => code), ["check"]);
});

test("future methods are provider-neutral, named, and default off", () => {
  assert.deepEqual(futurePaymentMethods().map(({ code }) => code), [
    "cash_app_pay", "apple_pay", "google_pay", "venmo", "venmo_tap_to_pay",
  ]);
  assert.deepEqual(PAYMENT_METHOD_CATALOG.filter(({ defaultEnabled }) => defaultEnabled).map(({ code }) => code), ["cash", "check"]);
  assert.equal(futurePaymentMethods().every(({ defaultEnabled, provider }) => !defaultEnabled && provider !== "manual"), true);
});
