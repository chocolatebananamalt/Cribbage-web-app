import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectProviderReadiness,
  parseRequiredCapabilities,
} from "../src/lib/providers/activation-readiness.ts";

test("all optional providers default closed while October manual paths remain available", () => {
  const report = inspectProviderReadiness({});
  assert.equal(report.manualFallbacksDeclared, true);
  assert.equal(report.safeToRunWithProvidersDisabled, true);
  assert.deepEqual(report.providers.map(({ capability, enabled, configurationReady, activationReady }) => ({
    capability, enabled, configurationReady, activationReady,
  })), [
    { capability: "online_payments", enabled: false, configurationReady: false, activationReady: false },
    { capability: "sms_seating", enabled: false, configurationReady: false, activationReady: false },
    { capability: "paper_card_ocr", enabled: false, configurationReady: false, activationReady: false },
  ]);
});

test("an invalid gate value fails closed", () => {
  const report = inspectProviderReadiness({ ACC_SMS_SEATING_ENABLED: "true" });
  assert.equal(report.safeToRunWithProvidersDisabled, false);
  assert.deepEqual(report.providers[1].errors, ["ACC_SMS_SEATING_ENABLED must be enabled or disabled"]);
});

test("Stripe configuration names every missing external input and never claims activation", () => {
  const report = inspectProviderReadiness({
    ACC_ONLINE_PAYMENTS_ENABLED: "enabled",
    ACC_PAYMENT_PROVIDER: "stripe",
  });
  assert.deepEqual(report.providers[0].missing, [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "ACC_PAYMENT_POLICY_REF",
    "ACC_STRIPE_ADAPTER_VERSION",
    "ACC_STRIPE_TEST_EVIDENCE_REF",
  ]);
  assert.equal(report.providers[0].activationReady, false);
  assert.match(report.providers[0].errors[0], /cannot be enabled until/);
});

test("OCR cannot be configured before the capture gate and governance inputs", () => {
  const report = inspectProviderReadiness({
    ACC_PAPER_CARD_OCR_ENABLED: "enabled",
    ACC_OCR_PROVIDER: "approved-ocr",
    ACC_OCR_EXECUTION_MODE: "external",
    OCR_PROVIDER_API_KEY: "server-only",
    SUPABASE_PAPER_CARD_BUCKET: "paper-scorecards-private",
    ACC_PAPER_CARD_RETENTION_POLICY_REF: "policy-2026-01",
    ACC_OCR_ADAPTER_VERSION: "v1",
    ACC_OCR_TEST_EVIDENCE_REF: "evidence-2026-01",
  });
  assert.equal(report.providers[2].configurationReady, false);
  assert.deepEqual(report.providers[2].errors, [
    "ACC_PAPER_CARD_CAPTURE_ENABLED must be enabled before OCR",
    "ACC_PAPER_CARD_OCR_ENABLED cannot be enabled until its adapter and live activation probe are released",
  ]);
});

test("complete configuration still requires a real provider probe before activation", () => {
  const report = inspectProviderReadiness({
    ACC_PAPER_CARD_CAPTURE_ENABLED: "enabled",
    ACC_PAPER_CARD_OCR_ENABLED: "disabled",
    ACC_OCR_PROVIDER: "approved-ocr",
    ACC_OCR_EXECUTION_MODE: "external",
    OCR_PROVIDER_API_KEY: "server-only",
    SUPABASE_PAPER_CARD_BUCKET: "paper-scorecards-private",
    ACC_PAPER_CARD_RETENTION_POLICY_REF: "policy-2026-01",
    ACC_OCR_ADAPTER_VERSION: "v1",
    ACC_OCR_TEST_EVIDENCE_REF: "evidence-2026-01",
  });
  assert.equal(report.providers[2].configurationReady, true);
  assert.equal(report.providers[2].runtimeVerificationRequired, true);
  assert.equal(report.providers[2].activationReady, false);
});

test("a prepared on-device OCR model does not require an external API key", () => {
  const report = inspectProviderReadiness({
    ACC_PAPER_CARD_CAPTURE_ENABLED: "enabled",
    ACC_PAPER_CARD_OCR_ENABLED: "disabled",
    ACC_OCR_PROVIDER: "approved-on-device-model",
    ACC_OCR_EXECUTION_MODE: "on_device",
    SUPABASE_PAPER_CARD_BUCKET: "paper-scorecards-private",
    ACC_PAPER_CARD_RETENTION_POLICY_REF: "policy-2026-01",
    ACC_OCR_ADAPTER_VERSION: "v1",
    ACC_OCR_TEST_EVIDENCE_REF: "evidence-2026-01",
  });
  assert.equal(report.providers[2].configurationReady, true);
  assert.equal(report.providers[2].missing.includes("OCR_PROVIDER_API_KEY"), false);
});

test("external OCR requires a server-only API key and rejects an invalid execution mode", () => {
  const external = inspectProviderReadiness({
    ACC_PAPER_CARD_CAPTURE_ENABLED: "enabled",
    ACC_OCR_PROVIDER: "approved-external-provider",
    ACC_OCR_EXECUTION_MODE: "external",
    SUPABASE_PAPER_CARD_BUCKET: "paper-scorecards-private",
    ACC_PAPER_CARD_RETENTION_POLICY_REF: "policy-2026-01",
    ACC_OCR_ADAPTER_VERSION: "v1",
    ACC_OCR_TEST_EVIDENCE_REF: "evidence-2026-01",
  });
  assert.equal(external.providers[2].configurationReady, false);
  assert.deepEqual(external.providers[2].missing, ["OCR_PROVIDER_API_KEY"]);

  const invalid = inspectProviderReadiness({
    ACC_OCR_PROVIDER: "unapproved-mode",
    ACC_OCR_EXECUTION_MODE: "hybrid",
  });
  assert.deepEqual(invalid.providers[2].errors, [
    "ACC_PAPER_CARD_CAPTURE_ENABLED must be enabled before OCR",
    "ACC_OCR_EXECUTION_MODE must be external or on_device",
  ]);
});

test("an unreleased provider cannot be enabled even with complete configuration", () => {
  const report = inspectProviderReadiness({
    ACC_ONLINE_PAYMENTS_ENABLED: "enabled",
    ACC_PAYMENT_PROVIDER: "stripe",
    STRIPE_SECRET_KEY: "server-only",
    STRIPE_WEBHOOK_SECRET: "server-only",
    ACC_PAYMENT_POLICY_REF: "policy-2026-01",
    ACC_STRIPE_ADAPTER_VERSION: "v1",
    ACC_STRIPE_TEST_EVIDENCE_REF: "evidence-2026-01",
  });
  assert.equal(report.providers[0].configurationReady, true);
  assert.match(report.providers[0].errors[0], /cannot be enabled until/);
  assert.equal(report.safeToRunWithProvidersDisabled, false);
});

test("secret-like provider variables are rejected when exposed as NEXT_PUBLIC", () => {
  const report = inspectProviderReadiness({ NEXT_PUBLIC_OCR_PROVIDER_API_KEY: "leak" });
  assert.deepEqual(report.globalErrors, ["NEXT_PUBLIC_OCR_PROVIDER_API_KEY must not be exposed to the browser"]);
  assert.equal(report.safeToRunWithProvidersDisabled, false);
});

test("public credentials are rejected by name, known prefix, or equality without exposing their value", () => {
  const report = inspectProviderReadiness({
    STRIPE_SECRET_KEY: "opaque-shared-value",
    NEXT_PUBLIC_STRIPE_CREDENTIAL: "ordinary-looking-value",
    NEXT_PUBLIC_PAYMENT_REFERENCE: "sk_test_synthetic",
    NEXT_PUBLIC_DUPLICATED_VALUE: "opaque-shared-value",
  });
  assert.deepEqual(report.globalErrors, [
    "NEXT_PUBLIC_DUPLICATED_VALUE must not be exposed to the browser",
    "NEXT_PUBLIC_PAYMENT_REFERENCE must not be exposed to the browser",
    "NEXT_PUBLIC_STRIPE_CREDENTIAL must not be exposed to the browser",
  ]);
  assert.equal(report.globalErrors.some((error) => error.includes("synthetic")), false);
});

test("the publishable Supabase slot accepts a publishable key but rejects a private-key value", () => {
  assert.deepEqual(inspectProviderReadiness({
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
  }).globalErrors, []);
  assert.deepEqual(inspectProviderReadiness({
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_synthetic",
  }).globalErrors, [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must not be exposed to the browser",
  ]);
});

test("provider requirement arguments reject empty and malformed forms", () => {
  assert.deepEqual(parseRequiredCapabilities(["--require="]), {
    requested: [],
    errors: ["invalid provider requirement: --require="],
  });
  assert.deepEqual(parseRequiredCapabilities(["--require"]), {
    requested: [],
    errors: ["invalid provider requirement: --require"],
  });
  assert.deepEqual(parseRequiredCapabilities(["--require=online_payments,sms_seating"]), {
    requested: ["online_payments", "sms_seating"],
    errors: [],
  });
});
