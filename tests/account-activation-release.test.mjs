import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import test from "node:test";
const { accountActivationEnabled } = await import(pathToFileURL(path.join(process.cwd(), "src/lib/api/account-activation-release.ts")).href);
test("account activation is release-gated and defaults closed", () => {
  assert.equal(accountActivationEnabled({}), false);
  assert.equal(accountActivationEnabled({ ACC_ACCOUNT_ACTIVATION_ENABLED: "false" }), false);
  assert.equal(accountActivationEnabled({ ACC_ACCOUNT_ACTIVATION_ENABLED: "true" }), true);
});
