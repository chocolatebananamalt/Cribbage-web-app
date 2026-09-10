import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import test from "node:test";
const { accountActivationEnabled } = await import(pathToFileURL(path.join(process.cwd(), "src/lib/api/account-activation-release.ts")).href);
const { rule12CorrectionEnabled } = await import(pathToFileURL(path.join(process.cwd(), "src/lib/api/rule12-correction-release.ts")).href);
test("account activation is release-gated and defaults closed", () => {
  assert.equal(accountActivationEnabled({}), false);
  assert.equal(accountActivationEnabled({ ACC_ACCOUNT_ACTIVATION_ENABLED: "false" }), false);
  assert.equal(accountActivationEnabled({ ACC_ACCOUNT_ACTIVATION_ENABLED: "true" }), true);
});

test("incomplete Rule 12.2 correction mutation defaults closed", () => {
  assert.equal(rule12CorrectionEnabled({}), false);
  assert.equal(rule12CorrectionEnabled({ ACC_RULE12_CORRECTION_ENABLED: "true" }), false);
  assert.equal(rule12CorrectionEnabled({ ACC_RULE12_CORRECTION_ENABLED: "approved" }), false);
});
