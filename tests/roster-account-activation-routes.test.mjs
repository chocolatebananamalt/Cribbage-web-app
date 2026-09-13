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

test("every activation mutation route is protected by origin, bounded input, and verified session checks", async () => {
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

test("activation page preserves the availability boundary and clears the credential fragment before hydration", async () => {
  const page = await readFile(path.join(root, "src/app/activate/page.tsx"), "utf8");
  const client = await readFile(path.join(root, "src/app/activate/activation-form.tsx"), "utf8");
  const bootstrap = await readFile(path.join(root, "public/activation-bootstrap.js"), "utf8");
  const proxy = await readFile(path.join(root, "src/proxy.ts"), "utf8");
  assert.match(page, /accountActivationEnabled\(\).*notFound/s);
  assert.match(page, /activation-bootstrap\.js/);
  assert.match(page, /strategy="beforeInteractive"/);
  assert.match(bootstrap, /history\.replaceState/);
  assert.match(bootstrap, /__accActivationCredential/);
  assert.match(client, /account-activations\/redemptions/);
  assert.match(client, /pending\.requestId/);
  assert.match(client, /pending\.confirmationPhrase/);
  assert.match(client, /credentials:\s*"same-origin"/);
  assert.match(client, /window\.addEventListener\("pagehide", onPageHide\)/);
  assert.match(client, /request\.current\?\.abort\(\)/);
  assert.match(proxy, /request\.nextUrl\.pathname === "\/activate"/);
  assert.match(proxy, /request\.nextUrl\.pathname === "\/activate" && !accountActivationEnabled\(\)/);
  assert.match(proxy, /registrationContentSecurityPolicy/);
  assert.doesNotMatch(bootstrap + client, /localStorage|sessionStorage/);
});

test("director activation workspace is protected, discoverable, and uses existing audited mutations", async () => {
  const page = await readFile(path.join(root, "src/app/tournament/[tournamentId]/account-activations/page.tsx"), "utf8");
  const client = await readFile(path.join(root, "src/app/tournament/[tournamentId]/account-activations/activation-workspace-client.tsx"), "utf8");
  const home = await readFile(path.join(root, "src/app/tournament/[tournamentId]/page.tsx"), "utf8");
  assert.match(page, /accountActivationEnabled\(\).*notFound/s);
  assert.match(page, /\["director", "co_director"\]\.includes\(access\.role\).*notFound/s);
  assert.match(page, /getRosterAccountActivationWorkspace/);
  assert.match(home, /accountActivationEnabled\(\).*account-activations/s);
  assert.match(client, /\/account-activation-requests\/\$\{requestId\}/);
  assert.match(client, /\/account-activations\/\$\{activationId\}\/cancellation/);
  assert.match(client, /isActivationIssueResult/);
  assert.match(client, /isActivationDecisionResult/);
  assert.match(client, /isActivationCancellationResult/);
  assert.match(client, /request\.canApprove/);
  assert.doesNotMatch(client, /localStorage|sessionStorage/);
});
