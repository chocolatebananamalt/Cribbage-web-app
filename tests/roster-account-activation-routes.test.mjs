import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const routePaths = [
  "src/app/api/v1/tournaments/[id]/account-activations/route.ts",
  "src/app/api/v1/account-activations/redemptions/route.ts",
  "src/app/api/v1/tournaments/[id]/account-activation-requests/[requestId]/route.ts",
  "src/app/api/v1/tournaments/[id]/account-activations/[activationId]/cancellation/route.ts",
];

test("every activation mutation route defaults off and enforces origin, bounded input, and verified session", async () => {
  for (const relativePath of routePaths) {
    const source = await readFile(path.join(root, relativePath), "utf8");
    assert.match(source, /accountActivationEnabled\(\)/, relativePath);
    assert.match(source, /isSameOriginRequest\(request\)/, relativePath);
    assert.match(source, /readSmallJson\(request\)/, relativePath);
    assert.match(source, /requireVerifiedSubject\(await createClient\(\)\)/, relativePath);
    assert.match(source, /createServerOnlyAdminClient\(\)/, relativePath);
    assert.match(source, /apiJson\(/, relativePath);
  }
});
