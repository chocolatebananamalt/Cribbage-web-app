// Local UI-only money validation proof. All writes are intercepted; no backend is used.
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const root = process.cwd();
const dir = path.join(root, "test-results/other-money-browser");
const actor = "40000000-0000-4000-8000-000000000001";
const tournament = "40000000-0000-4000-8000-000000000002";
const event = "40000000-0000-4000-8000-000000000003";
const poolId = "40000000-0000-4000-8000-000000000004";
const participant = "40000000-0000-4000-8000-000000000005";
const team = "40000000-0000-4000-8000-000000000006";
const writes = [];

const sidePoolWorkspace = {
  tournamentName: "Synthetic money UI",
  events: [{
    eventId: event, name: "Main", eventType: "main", participants: [{ participantId: participant, displayName: "Sample Player" }],
    teamBeneficiaries: [{ teamEntryId: team, displayName: "Sample Team", elections: [], payouts: [] }],
    pools: [{ poolId, version: 1, categoryCode: "test", displayName: "Test Pool", entryFeeMinor: 1000, policy: null, elections: [], payouts: [], collectedMinor: 0, paidMinor: 0, finalized: false }],
  }],
};
const satelliteWorkspace = {
  tournamentName: "Synthetic money UI",
  events: [{ eventId: event, name: "Satellite", format: "standard_singles", scoringMethod: "manual", participants: [{ participantId: participant, displayName: "Sample Player" }], current: null }],
};

await fs.mkdir(path.join(dir, "app"), { recursive: true });
await fs.mkdir(path.join(dir, "public"), { recursive: true });
await fs.writeFile(path.join(dir, "package.json"), '{"private":true,"type":"module"}');
await fs.writeFile(path.join(dir, "next.config.mjs"), `export default {turbopack:{root:${JSON.stringify(root)}}};`);
await fs.copyFile(path.join(root, "public/offline-score-sw.js"), path.join(dir, "public/offline-score-sw.js"));
await fs.writeFile(path.join(dir, "app/layout.tsx"), `import '../../../src/app/globals.css';import {RecoveryDocumentBoundary} from '../../../src/components/recovery-document-boundary';export default function Layout({children}:{children:React.ReactNode}){return <html><body><RecoveryDocumentBoundary actorId="${actor}">{children}</RecoveryDocumentBoundary></body></html>}`);
await fs.writeFile(path.join(dir, "app/page.tsx"), `import SidePools from '../../../src/app/tournament/[tournamentId]/side-pools/side-pools-client';import Satellite from '../../../src/app/tournament/[tournamentId]/satellite-results/satellite-results-client';const sidePoolWorkspace=${JSON.stringify(sidePoolWorkspace)};const satelliteWorkspace=${JSON.stringify(satelliteWorkspace)};export default function Page(){return <main className="auth-shell"><section className="auth-card corrections-card"><h1>Local monetary input check</h1><SidePools actorId="${actor}" tournamentId="${tournament}" workspace={sidePoolWorkspace}/><Satellite tournamentId="${tournament}" workspace={satelliteWorkspace} canManage={true} initialEventId="${event}"/></section></main>}`);

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", dir, "--hostname", "127.0.0.1", "--port", "3239"], { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
let browser;
child.stdout.on("data", (chunk) => { logs += chunk; });
child.stderr.on("data", (chunk) => { logs += chunk; });

try {
  let ready = false;
  for (let until = Date.now() + 45000; Date.now() < until;) {
    try { if ((await fetch("http://127.0.0.1:3239", { signal: AbortSignal.timeout(1200) })).ok) { ready = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  assert.ok(ready, "mock Next page becomes ready");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route("**/api/v1/tournaments/**", async (route) => {
    const request = JSON.parse(route.request().postData() ?? "{}");
    writes.push(request);
    let response;
    if (request.action === "configure_policy") response = { status: "side_pool_policy_configured", poolId: request.poolId };
    else if (request.action === "set_election") response = { status: "side_pool_election_recorded", poolId: request.poolId, participantId: request.participantId };
    else if (request.action === "set_team_election") response = { status: "side_pool_team_election_recorded", poolId: request.poolId, teamEntryId: request.teamEntryId };
    else if (request.action === "set_payout") response = { status: "side_pool_payout_recorded", poolId: request.poolId, participantId: request.participantId };
    else if (request.action === "set_team_payout") response = { status: "side_pool_team_payout_recorded", poolId: request.poolId, teamEntryId: request.teamEntryId };
    else response = { status: "satellite_results_saved", eventId: request.eventId, packageId: request.packageId, versionId: request.versionId, version: request.expectedVersion + 1, mrpStatus: "Not applicable-Satellite event", qualificationEffect: "none" };
    await route.fulfill({ status: 200, json: response });
  });

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("http://127.0.0.1:3239");
    await page.getByRole("heading", { name: "Local monetary input check" }).waitFor();
    await page.getByLabel("Prize (USD)").waitFor();
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.width + 1, `no overflow at ${width}px`);
    await page.screenshot({ path: path.join(root, `test-results/other-money-${width}.png`), fullPage: true });
  }

  const customFee = page.getByLabel("Entry fee (USD)");
  await page.getByLabel("Pool name").fill("Custom Pool");
  await customFee.fill("1e3");
  await page.getByRole("button", { name: "Add Custom Side Pool" }).click();
  assert.equal(writes.length, 0, "exponent entry fee starts no write");
  await customFee.fill("25.10");
  await page.getByRole("button", { name: "Add Custom Side Pool" }).click();
  assert.equal(writes[0].action, "add_pool");
  assert.equal(writes[0].entryFeeMinor, 2510, "custom $25.10 is 2510 minor units");

  const policy = page.getByLabel("Posted payout schedule (placement: USD amount)");
  const postPolicy = page.getByRole("button", { name: "Post Payout Schedule" });
  await policy.fill("1:5.00,2:2.001");
  assert.equal(await postPolicy.isDisabled(), true, "one invalid schedule row blocks whole submission");
  assert.equal(writes.length, 1, "invalid schedule did not submit a partial policy");
  await policy.fill("1:5.00,2:2.50");
  await postPolicy.click();
  assert.deepEqual(writes[1].postedPayoutSchedule, [{ placement: 1, amountMinor: 500 }, { placement: 2, amountMinor: 250 }]);

  const received = page.getByLabel("Amount received (USD)").first();
  await received.fill("1e2");
  await page.getByRole("button", { name: "Save Election" }).click();
  assert.equal(writes.length, 2, "exponent receipt starts no write");
  await received.fill("12.34");
  await page.getByRole("button", { name: "Save Election" }).click();
  assert.equal(writes[2].amountReceivedMinor, 1234, "$12.34 receipt is 1234 minor units");

  const prize = page.getByLabel("Prize (USD)");
  const qPool = page.getByLabel("Q-Pool award (USD, optional)");
  const side = page.getByLabel("Side Pool award (USD, optional)");
  const addPlacement = page.getByRole("button", { name: "Add Placement" });
  await page.getByLabel("Cross-check evidence reference").fill("synthetic paper check");
  await prize.fill("");
  await addPlacement.click();
  assert.equal(await page.getByText("Enter the prize amount in dollars.").count(), 1, "blank required prize is rejected");
  assert.equal(await page.locator("ol li").count(), 0, "blank prize creates no placement");
  await prize.fill("1e2");
  await qPool.fill("0");
  await addPlacement.click();
  assert.equal(await page.locator("ol li").count(), 0, "exponent prize creates no placement");
  await prize.fill("0");
  await qPool.fill("0.001");
  await addPlacement.click();
  assert.equal(await page.locator("ol li").count(), 0, "over-precise optional award creates no placement");
  await prize.fill("0");
  await qPool.fill("0.25");
  await side.fill("");
  await addPlacement.click();
  await page.getByText("1. Sample Player", { exact: false }).waitFor();
  assert.match(await page.locator("ol").filter({ hasText: "Sample Player" }).first().innerText(), /prize \$0\.00 · Q Pool \$0\.25 · Side Pool \$0\.00/);
  await page.getByRole("button", { name: "Save Draft" }).click();
  const satelliteWrite = writes[3];
  assert.equal(satelliteWrite.action, "save_draft");
  assert.deepEqual(satelliteWrite.placements.map(({ prizeMinor, qPoolMinor, sidePoolMinor }) => ({ prizeMinor, qPoolMinor, sidePoolMinor })), [{ prizeMinor: 0, qPoolMinor: 25, sidePoolMinor: 0 }]);
  assert.equal(writes.length, 4);

  console.log("PASS 390/1440px UI; $25.10→2510, $12.34→1234, USD schedule rows exact; bad precision/exponent/blank required values send no write; invalid payout row is not dropped; satellite explicit $0 and blank optional awards persist as zero.");
  await context.close();
} finally {
  await browser?.close();
  child.kill();
  await fs.writeFile(path.join(root, "test-results/other-money-browser-server.log"), logs);
}
