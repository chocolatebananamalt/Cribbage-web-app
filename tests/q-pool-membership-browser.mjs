// Local mocked UI proof with the actual RecoveryDocumentBoundary and worker.
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const root = process.cwd();
const dir = path.join(root, "test-results/q-pool-membership-browser");
const actor = "40000000-0000-4000-8000-000000000001";
const tournament = "40000000-0000-4000-8000-000000000002";
const event = "40000000-0000-4000-8000-000000000003";
const poolA = "40000000-0000-4000-8000-000000000004";
const poolB = "40000000-0000-4000-8000-000000000005";
const roster = "40000000-0000-4000-8000-000000000006";
const participant = "40000000-0000-4000-8000-000000000007";
const membershipId = "40000000-0000-4000-8000-000000000008";
const receiptId = "40000000-0000-4000-8000-000000000009";

function makeWorkspace({ started = false, elected = false, prePlayA = elected, hasReceipt = false, allocationVersion = 0 } = {}) {
  const obligation = 3000 + (elected ? 500 : 0);
  const received = hasReceipt ? obligation : 0;
  return {
    tournamentId: tournament, eventId: event, eventName: "Synthetic Main", canCorrect: true, started, supported: true, blockedReason: null, baseFeeMinor: 3000,
    pools: [{ poolVersionId: poolA, slot: 1, name: "Q Pool A", feeMinor: 500 }, { poolVersionId: poolB, slot: 2, name: "Q Pool B", feeMinor: 1000 }],
    entries: [{ rosterEntryId: roster, participantId: participant, displayName: "Sample Player", membershipVersion: 1, membershipVersionId: membershipId,
      pools: [
        { poolVersionId: poolA, prePlayElected: prePlayA, elected, consentReference: elected ? "recorded pre-play consent" : "", amountOwedMinor: elected ? 500 : 0, amountAllocatedMinor: allocationVersion ? 500 : 0, paidEntryEligible: allocationVersion > 0 },
        { poolVersionId: poolB, prePlayElected: false, elected: false, consentReference: "", amountOwedMinor: 0, amountAllocatedMinor: 0, paidEntryEligible: false },
      ],
      allocationVersion, receiptId: hasReceipt ? receiptId : null, receiptVersion: hasReceipt ? 1 : 0, receivedMinor: received,
      obligationVersion: 1, obligationMinor: obligation, allocationCurrent: allocationVersion > 0, baseAllocatedMinor: allocationVersion ? 3000 : 0, reason: null,
    }],
  };
}

const writeCapture = [];
await fs.mkdir(path.join(dir, "app/allocation"), { recursive: true });
for (const route of ["allocation", "started", "correction", "restore", "longname", "not-director", "unsupported", "unavailable", "mismatch"]) await fs.mkdir(path.join(dir, "app", route), { recursive: true });
await fs.mkdir(path.join(dir, "public"), { recursive: true });
await fs.writeFile(path.join(dir, "package.json"), '{"private":true,"type":"module"}');
await fs.writeFile(path.join(dir, "next.config.mjs"), `export default {turbopack:{root:${JSON.stringify(root)}}};`);
await fs.copyFile(path.join(root, "public/offline-score-sw.js"), path.join(dir, "public/offline-score-sw.js"));
await fs.writeFile(path.join(dir, "app/layout.tsx"), `import '../../../src/app/globals.css';import {RecoveryDocumentBoundary} from '../../../src/components/recovery-document-boundary';export default function Layout({children}:{children:React.ReactNode}){return <html><body><RecoveryDocumentBoundary actorId="${actor}">{children}</RecoveryDocumentBoundary></body></html>}`);
const pageSource = (workspace, source = "../../../src") => `import Client from '${source}/app/tournament/[tournamentId]/q-pools/q-pools-client';const workspace=${JSON.stringify(workspace)} as import('${source}/lib/api/q-pool-membership').QPoolMembershipWorkspace | null;export default function Page(){return <main className="auth-shell"><section className="auth-card corrections-card"><h1>Q Pool browser fixture</h1><Client actorId="${actor}" tournamentId="${tournament}" canManage={true} workspace={workspace}/></section></main>}`;
await fs.writeFile(path.join(dir, "app/page.tsx"), pageSource(makeWorkspace()));
await fs.writeFile(path.join(dir, "app/allocation/page.tsx"), pageSource(makeWorkspace({ elected: true, hasReceipt: true }), "../../../../src"));
await fs.writeFile(path.join(dir, "app/started/page.tsx"), pageSource(makeWorkspace({ started: true }), "../../../../src"));
await fs.writeFile(path.join(dir, "app/correction/page.tsx"), pageSource(makeWorkspace({ started: true, elected: true }), "../../../../src"));
await fs.writeFile(path.join(dir, "app/restore/page.tsx"), pageSource(makeWorkspace({ started: true, elected: false, prePlayA: true }), "../../../../src"));
const longNameWorkspace = makeWorkspace();
longNameWorkspace.pools[0].name = `Q Pool 1 - ${"😀".repeat(160)}`;
await fs.writeFile(path.join(dir, "app/longname/page.tsx"), pageSource(longNameWorkspace, "../../../../src"));
await fs.writeFile(path.join(dir, "app/not-director/page.tsx"), pageSource({ ...makeWorkspace({ started: true, elected: true }), canCorrect: false }, "../../../../src"));
await fs.writeFile(path.join(dir, "app/unsupported/page.tsx"), pageSource({ ...makeWorkspace(), supported: false, blockedReason: "No Q Pool fees are configured." }, "../../../../src"));
await fs.writeFile(path.join(dir, "app/unavailable/page.tsx"), pageSource(null, "../../../../src"));
const staleObligation = makeWorkspace({ elected: true });
staleObligation.entries[0].obligationMinor = 3000;
await fs.writeFile(path.join(dir, "app/mismatch/page.tsx"), pageSource(staleObligation, "../../../../src"));

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", dir, "--hostname", "127.0.0.1", "--port", "3240"], { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
let browser;
child.stdout.on("data", (chunk) => { logs += chunk; });
child.stderr.on("data", (chunk) => { logs += chunk; });
const origin = "http://127.0.0.1:3240";
let failFirstMutation = false;
let firstMutationSeen = false;

try {
  let ready = false;
  for (let until = Date.now() + 45000; Date.now() < until;) {
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1200) })).ok) { ready = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  assert.ok(ready, "local mocked Next app becomes ready");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route("**/api/v1/tournaments/**/q-pools**", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.fulfill({ status: 503, json: { error: "unexpected route" } });
    if (request.url().endsWith("/reconciliation")) return route.fulfill({ status: 200, json: { authorized: true, result: null } });
    const body = JSON.parse(request.postData() ?? "{}");
    const operationId = request.headers()["x-idempotency-key"];
    writeCapture.push({ body, operationId });
    if (failFirstMutation && !firstMutationSeen) {
      firstMutationSeen = true;
      return route.abort();
    }
    return route.fulfill({ status: 200, json: { status: "q_pool_saved", action: body.action, rosterEntryId: body.rosterEntryId, version: body.expectedVersion + 1, versionId: crypto.randomUUID() } });
  });

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1050 });
    await page.goto(origin);
    await page.getByRole("heading", { name: "Q Pool browser fixture" }).waitFor();
    await page.getByLabel("Elect into Q Pool 1: Q Pool A ($5.00)").waitFor();
    const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(layout.scroll <= layout.width + 1, `no horizontal overflow at ${width}px`);
    await page.screenshot({ path: path.join(root, `test-results/q-pool-membership-${width}.png`), fullPage: true });
  }

  const membershipButton = page.getByRole("button", { name: "Save Membership" });
  const poolAConsent = page.getByLabel("Consent reference for Q Pool A");
  const membershipReason = page.getByLabel("Reason for membership record (required)");
  assert.equal(await membershipButton.isDisabled(), true, "reason and opt-in consent are required");
  await page.getByLabel("Elect into Q Pool 1: Q Pool A ($5.00)").check();
  await membershipReason.fill("Sample pre-play election correction");
  assert.equal(await membershipButton.isDisabled(), true, "elected pool requires consent reference");
  await poolAConsent.fill("signed paper card 1");
  failFirstMutation = true;
  await membershipButton.dblclick();
  await page.getByText("The Q Pool outcome is uncertain. The exact request remains saved for retry.").waitFor();
  assert.equal(writeCapture.length, 1, "rapid repeated click starts one mutation");
  const savedEnvelope = await page.evaluate((key) => sessionStorage.getItem(key), `payment-obligation:q-pool:${actor}:${tournament}`);
  assert.ok(savedEnvelope, "unknown outcome retains exact operation envelope");
  const original = writeCapture[0];
  assert.deepEqual(original.body, { action: "membership", rosterEntryId: roster, expectedVersion: 1, correction: false, reason: "Sample pre-play election correction", pools: [{ poolVersionId: poolA, elected: true, consentReference: "signed paper card 1" }, { poolVersionId: poolB, elected: false, consentReference: "" }] });

  failFirstMutation = false;
  await page.reload();
  await page.getByText("No completed Q Pool receipt is available. The exact request remains saved for retry.").waitFor();
  await page.getByRole("button", { name: "Retry exact Q Pool request" }).click();
  await page.getByText("Q Pool record saved. Refreshing the authoritative membership and allocation state.").waitFor();
  assert.equal(writeCapture.length, 2, "one retry follows interrupted request");
  assert.deepEqual(writeCapture[1], original, "retry reuses exact body and idempotency key");
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), `payment-obligation:q-pool:${actor}:${tournament}`), null, "verified result clears exact recovery envelope");

  await page.goto(`${origin}/allocation`);
  await page.getByRole("heading", { name: "Q Pool browser fixture" }).waitFor();
  assert.match(await page.getByText(/Recorded receipt:/).innerText(), /\$35\.00/);
  const base = page.getByLabel("Base entry allocation (USD)");
  const a = page.getByLabel(/Q Pool A allocation/);
  const b = page.getByLabel(/Q Pool B allocation/);
  const allocate = page.getByRole("button", { name: "Save Receipt Allocation" });
  assert.equal(await allocate.isDisabled(), true, "allocation cannot be implicitly allocated");
  await base.fill("30.00");
  await a.fill("5.00");
  await b.fill("1.00");
  await page.getByLabel("Reason for allocation record (required)").fill("Explicit receipt assignment");
  assert.equal(await allocate.isDisabled(), true, "allocation cannot exceed an unelected pool's owed amount");
  await b.fill("0.00");
  assert.equal(await allocate.isDisabled(), false, "explicit full allocation of existing receipt is enabled");
  await allocate.click();
  const allocationRequest = writeCapture[2];
  assert.equal(allocationRequest.body.action, "allocation");
  assert.equal(allocationRequest.body.receiptId, receiptId);
  assert.equal(allocationRequest.body.baseMinor, 3000);
  assert.deepEqual(allocationRequest.body.pools, [{ poolVersionId: poolA, amountMinor: 500 }, { poolVersionId: poolB, amountMinor: 0 }]);

  await page.goto(`${origin}/started`);
  await page.getByRole("heading", { name: "Q Pool browser fixture" }).waitFor();
  await page.getByText("A pre-play elected Q Pool record is required before play; first late opt-in is blocked.").waitFor();
  assert.equal(await page.getByRole("button", { name: "Save Director Membership Correction" }).isDisabled(), true);
  assert.equal(writeCapture.length, 3, "unsupported first late opt-in made no write");
  await page.goto(`${origin}/restore`);
  await page.getByRole("heading", { name: "Q Pool browser fixture" }).waitFor();
  const restoreKnown = page.getByLabel("Elect into Q Pool 1: Q Pool A ($5.00)");
  const latePool = page.getByLabel("Elect into Q Pool 2: Q Pool B ($10.00)");
  assert.equal(await restoreKnown.isDisabled(), false, "a pool elected before play can be restored after a later decline");
  assert.equal(await latePool.isDisabled(), true, "a previously unelected pool cannot be opted into after play starts");
  await restoreKnown.check();
  await page.getByLabel("Consent reference for Q Pool A").fill("restore known pre-play election");
  await page.getByLabel("Reason for membership record (required)").fill("Restore documented pre-play election");
  await page.getByRole("button", { name: "Save Director Membership Correction" }).click();
  assert.equal(writeCapture[3].body.pools[0].elected, true);
  assert.equal(writeCapture[3].body.pools[1].elected, false);
  await page.goto(`${origin}/longname`);
  await page.getByRole("heading", { name: "Q Pool browser fixture" }).waitFor();
  const longNameLayout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(longNameLayout.scroll <= longNameLayout.width + 1, "database-valid long Unicode pool label wraps without horizontal overflow");
  await page.goto(`${origin}/correction`);
  await page.getByLabel("Reason for membership record (required)").fill("Correct recorded pre-play opt-in");
  const correctMembership = page.getByRole("button", { name: "Save Director Membership Correction" });
  assert.equal(await correctMembership.isDisabled(), false);
  await correctMembership.click();
  assert.equal(writeCapture[4].body.correction, true, "post-play write is explicitly a correction");
  assert.equal(writeCapture[4].body.reason, "Correct recorded pre-play opt-in");
  await page.goto(`${origin}/not-director`);
  assert.equal(await page.getByRole("button", { name: "Save Director Membership Correction" }).count(), 0, "non-director cannot reach correction controls");
  await page.goto(`${origin}/unsupported`);
  await page.getByText("Q Pool membership is unavailable for this event: No Q Pool fees are configured.").waitFor();
  await page.goto(`${origin}/unavailable`);
  await page.getByText("Q Pool workspace is unavailable. This does not mean the event is unsupported.").waitFor();
  await page.goto(`${origin}/mismatch`);
  await page.getByText(/does not match current base fee and elections/).waitFor();
  assert.equal(await page.getByRole("button", { name: "Save Receipt Allocation" }).isDisabled(), true, "stale obligation blocks allocation while leaving workspace visible");
  assert.equal(writeCapture.length, 5);
  console.log("PASS local 390/1440px Q Pool UI; exact opt-in coverage; rapid-repeat singleflight; interrupted request reconciles and retries exact body/key; receipt allocation is explicit, complete, fee-capped and exact; first late opt-in blocked; prior elected pool can be restored but a new pool remains blocked; long Unicode pool label wraps; post-play reasoned director correction accepted; stale obligations remain visible but allocation-blocked; unavailable differs from unsupported. API requests intercepted; no backend calls.");
  await context.close();
} finally {
  await browser?.close();
  child.kill();
  await fs.writeFile(path.join(root, "test-results/q-pool-membership-browser-server.log"), logs);
  const fixturePath = path.resolve(dir);
  assert.ok(fixturePath.startsWith(`${path.resolve(root, "test-results")}${path.sep}`), "fixture cleanup stays inside test-results");
  await fs.rm(fixturePath, { recursive: true, force: true });
}
