// Real UI/recovery boundary with fictional loopback APIs. Root runs this harness.
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const root = process.cwd(), dir = path.join(root, "test-results/q-obligation-v2-browser"), origin = "http://127.0.0.1:3251";
const id = n => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = id(90), tid = id(80), eid = id(81), hash = "a".repeat(64);
const obligations = [
  { poolVersionId: id(60), policyId: id(70), name: "Fictional graduated Q", fundMinor: 16000, kind: "award", status: "unpaid", rows: [
    { participantId: id(4), displayName: "QPlayer04", amountMinor: 8000, qualificationRank: 4, qRank: 1 },
    { participantId: id(5), displayName: "QPlayer05", amountMinor: 5000, qualificationRank: null, qRank: 2 },
    { participantId: id(6), displayName: "QPlayer06", amountMinor: 3000, qualificationRank: null, qRank: 3 },
  ] },
  { poolVersionId: id(61), policyId: id(71), name: "Fictional equal Q", fundMinor: 1000, kind: "refund", status: "unpaid", rows: [
    { participantId: id(15), displayName: "QPlayer15", amountMinor: 1000, qualificationRank: null, qRank: null },
  ] },
];
const initial = { tournamentId: tid, eventId: eid, sourceDigest: hash, preview: obligations, blockers: [], currentVersion: 0, current: false, history: [], automaticPayout: false, canonicalSettlement: false };
const history = { id: id(20), version: 1, supersedesId: null, reason: "TEST ONLY reviewed all named pools", recordedAt: "2026-10-29T22:00:00Z", actorId: actor, sourceDigest: hash, status: "unpaid", obligations };
const saved = { ...initial, currentVersion: 1, current: true, history: [history] };
let workspace = initial, reconcile = null, mode = "success";
let result = { status: "q_obligations_recorded_v2", reviewId: id(20), eventId: eid, version: 1, sourceDigest: hash };
const key = `payment-obligation:q-review-v2:${actor}:${tid}`, writes = [], checks = [];

await fs.mkdir(path.join(dir, "public"), { recursive: true });
await fs.mkdir(path.join(dir, "app"), { recursive: true });
await fs.writeFile(path.join(dir, "package.json"), '{"private":true,"type":"module"}');
await fs.writeFile(path.join(dir, "next.config.mjs"), `export default {turbopack:{root:${JSON.stringify(root)}}};`);
await fs.copyFile("public/offline-score-sw.js", path.join(dir, "public/offline-score-sw.js"));
await fs.writeFile(path.join(dir, "app/layout.tsx"), `import '../../../src/app/globals.css';import {RecoveryDocumentBoundary} from '../../../src/components/recovery-document-boundary';export default function Layout({children}:{children:React.ReactNode}){return <html><body><RecoveryDocumentBoundary actorId="${actor}">{children}</RecoveryDocumentBoundary></body></html>}`);
await fs.writeFile(path.join(dir, "app/page.tsx"), `import Client from '../../../src/app/tournament/[tournamentId]/q-obligation-reviews-v2/review-client';const initial=${JSON.stringify(initial)};export default function Page(){return <main className="auth-shell"><section className="auth-card corrections-card"><h1>Fictional Q v2 unpaid review</h1><Client actorId="${actor}" tournamentId="${tid}" initial={initial}/></section></main>}`);
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", dir, "--hostname", "127.0.0.1", "--port", "3251"], { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = "", browser;
child.stdout.on("data", b => logs += b); child.stderr.on("data", b => logs += b);
await fs.writeFile("test-results/q-obligation-v2-browser-process.json", JSON.stringify({ pid: child.pid, origin }));
try {
  let ready = false;
  for (let end = Date.now() + 180000; Date.now() < end;) {
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(20000) })).ok) { ready = true; break; } }
    catch (error) { if (["EPERM", "EACCES"].includes(error.cause?.code)) throw error; }
    await new Promise(r => setTimeout(r, 300));
  }
  assert.ok(ready, "local fixture ready");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext(), page = await context.newPage();
  await page.route("**/api/v1/tournaments/**/q-obligation-reviews-v2**", async route => {
    const request = route.request(); assert.ok(request.url().startsWith(origin));
    if (request.url().endsWith("/reconciliation")) {
      const body = JSON.parse(request.postData());
      assert.deepEqual(Object.keys(body).sort(), ["operationId", "request"]);
      assert.deepEqual(Object.keys(body.request).sort(), ["expectedVersion", "reason", "reviewed", "sourceDigest"]);
      return route.fulfill({ status: mode === "reconcile-unavailable" ? 503 : 200, json: { authorized: true, result: reconcile } });
    }
    if (request.method() === "GET") return route.fulfill({ json: workspace });
    writes.push({ body: JSON.parse(request.postData()), key: request.headers()["x-idempotency-key"] });
    await new Promise(r => setTimeout(r, 120));
    if (mode === "abort") return route.abort();
    return route.fulfill({ json: mode === "unknown" ? { status: "unknown" } : mode === "rejected" ? { status: "rejected", code: "source_changed" } : result });
  });
  const status = text => page.getByRole("status").filter({ hasText: text }).waitFor();
  const go = async () => { await page.goto(origin); await status("Review every named pool"); };
  const save = () => page.getByRole("button", { name: "Record reviewed Q obligations", exact: true });
  const retry = () => page.getByRole("button", { name: "Retry exact review request", exact: true });
  const fill = async () => { await page.getByLabel("Review reason", { exact: true }).fill("TEST ONLY reviewed all named pools"); await page.getByRole("checkbox").check(); };
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await go();
    const rows = await page.locator("article li").allTextContents();
    assert.ok(rows.some(t => t.includes("QPlayer04: $80.00") && t.includes("playoff qualifier")));
    assert.ok(rows.some(t => t.includes("QPlayer05: $50.00") && t.includes("not a playoff qualifier") && t.includes("Q award order 2")));
    assert.ok(rows.some(t => t.includes("QPlayer15: $10.00") && t.includes("refund obligation")));
    assert.ok(await save().isDisabled());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `test-results/q-obligation-v2-${width}.png`, fullPage: true });
    checks.push(`dollar awards/refund, nonqualifier Q rank, unpaid labels, initial validation/no overflow ${width}`);
  }
  await fill(); await save().evaluate(b => { b.click(); b.click(); }); await status("Q obligations recorded as unpaid");
  assert.equal(writes.length, 1); assert.equal(writes[0].body.expectedVersion, 0);
  assert.equal(await page.evaluate(k => sessionStorage.getItem(k), key), null);
  checks.push("repeated click single-flight, exact source request, confirmed receipt clears recovery");

  await go(); mode = "abort"; await fill(); await save().click(); await status("Recording could not be confirmed");
  const raw = await page.evaluate(k => sessionStorage.getItem(k), key); assert.ok(raw);
  await page.reload(); await status("No completed operation receipt");
  assert.equal(await page.evaluate(k => sessionStorage.getItem(k), key), raw);
  mode = "success"; await retry().click(); await status("Q obligations recorded as unpaid");
  assert.deepEqual(writes.at(-1), writes.at(-2));
  checks.push("interrupted request/reload retains original body and key; explicit exact retry after reconciliation");

  reconcile = result; await page.evaluate(({ key, raw }) => sessionStorage.setItem(key, raw), { key, raw });
  const postCount = writes.length; await page.reload(); await status("Q obligations recorded as unpaid");
  assert.equal(writes.length, postCount); assert.equal(await page.evaluate(k => sessionStorage.getItem(k), key), null);
  checks.push("server success/lost response reconciles full retained request without duplicate POST");

  reconcile = { ...result, sourceDigest: "b".repeat(64) };
  await page.evaluate(({ key, raw }) => sessionStorage.setItem(key, raw), { key, raw }); await page.reload(); await status("Outcome remains uncertain");
  assert.equal(await page.evaluate(k => sessionStorage.getItem(k), key), raw);
  reconcile = null; mode = "rejected"; await retry().click(); await status("Review rejected: source changed");
  assert.equal(await page.evaluate(k => sessionStorage.getItem(k), key), null);
  checks.push("mismatched source receipt cannot clear recovery; exact known stale rejection clears only retained work");

  workspace = saved; mode = "success";
  await page.getByRole("button", { name: "Refresh review sources", exact: true }).click();
  await page.getByText("Latest review is current and unpaid.", { exact: true }).waitFor();
  assert.ok(await save().isDisabled()); await page.getByRole("heading", { name: "Review 1 — unpaid — current", exact: true }).waitFor();
  workspace = { ...saved, current: false, sourceDigest: "b".repeat(64) };
  await page.getByRole("button", { name: "Refresh review sources", exact: true }).click();
  await page.getByText("Latest review is stale or blocked. No historical version is substituted.", { exact: true }).waitFor();
  await page.getByLabel("Reason for superseding the prior review", { exact: true }).fill("TEST ONLY changed allocation reviewed");
  await page.getByRole("checkbox").check(); assert.ok(await save().isEnabled());
  workspace = { ...workspace, blockers: ["q_cash_tie_unresolved"] };
  await page.getByRole("button", { name: "Refresh review sources", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "q cash tie unresolved" }).waitFor(); assert.ok(await save().isDisabled());
  checks.push("current review cannot duplicate; stale version needs reason; unresolved cash tie blocks despite saved history");

  const changed = JSON.parse(raw); changed.request.reason = "DIFFERENT TEST ONLY reason";
  const changedRaw = JSON.stringify(changed);
  reconcile = { status: "rejected", code: "idempotency_conflict" };
  await page.evaluate(({ key, changedRaw }) => sessionStorage.setItem(key, changedRaw), { key, changedRaw });
  const before = writes.length; await page.reload(); await status("Operation identity conflict");
  assert.equal(await page.evaluate(k => sessionStorage.getItem(k), key), changedRaw);
  assert.equal(writes.length, before); assert.ok(await retry().isDisabled());
  checks.push("full-request changed-reason conflict preserves recovery and blocks retries");

  const malformed = '{"kind":"future-review","preserve":true}';
  await page.evaluate(({ key, malformed }) => sessionStorage.setItem(key, malformed), { key, malformed });
  await page.reload(); await status("Unrecognized retained review");
  assert.equal(await page.evaluate(k => sessionStorage.getItem(k), key), malformed); assert.ok(await save().isDisabled());
  checks.push("unknown retained intent remains intact and prevents new mutation");
  await fs.writeFile("test-results/q-obligation-v2-browser-result.json", JSON.stringify({ status: "passed", checks, writes, limitations: "Real UI/recovery boundary with fictional intercepted APIs; real SQL tested separately. No hosted session, real credentials, actual payment/refund or physical multi-device proof." }, null, 2));
  console.log(JSON.stringify({ status: "passed", checks, writes: writes.length }, null, 2));
  await context.close();
} finally {
  await browser?.close();
  if (child.exitCode === null) { const closed = new Promise(resolve => child.once("close", resolve)); child.kill(); await closed; }
  await fs.writeFile("test-results/q-obligation-v2-browser-server.log", logs);
  assert.ok(path.resolve(dir).startsWith(path.resolve(root, "test-results") + path.sep));
  await fs.rm(dir, { recursive: true, force: true });
}
