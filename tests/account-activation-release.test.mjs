import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import test from "node:test";
const { accountActivationEnabled } = await import(pathToFileURL(path.join(process.cwd(), "src/lib/api/account-activation-release.ts")).href);
const { rule12CorrectionEnabled } = await import(pathToFileURL(path.join(process.cwd(), "src/lib/api/rule12-correction-release.ts")).href);
test("reviewed account activation is available without a deployment toggle", () => {
  assert.equal(accountActivationEnabled({}), true);
  assert.equal(accountActivationEnabled({ ACC_ACCOUNT_ACTIVATION_ENABLED: "false" }), true);
  assert.equal(accountActivationEnabled({ ACC_ACCOUNT_ACTIVATION_ENABLED: "true" }), true);
});

test("reviewed Rule 12.2 correction workflow is available without a deployment toggle", () => {
  assert.equal(rule12CorrectionEnabled({}), true);
  assert.equal(rule12CorrectionEnabled({ ACC_RULE12_CORRECTION_ENABLED: "true" }), true);
  assert.equal(rule12CorrectionEnabled({ ACC_RULE12_CORRECTION_ENABLED: "approved" }), true);
});

test("deployment template makes staged feature defaults explicitly closed", async () => {
  const example = await readFile(path.join(process.cwd(), ".env.example"), "utf8");
  assert.match(example, /^ACC_REGISTRATION_LINK_MANAGEMENT_V2=disabled$/m);
  assert.match(example, /^ACC_PUBLIC_REGISTRATION_V2=disabled$/m);
  assert.doesNotMatch(example, /^ACC_ACCOUNT_ACTIVATION_ENABLED=/m);
  assert.doesNotMatch(example, /^ACC_RULE12_CORRECTION_ENABLED=/m);
  assert.doesNotMatch(example, /SUPABASE.*(?:SERVICE|SECRET)/i);
});
