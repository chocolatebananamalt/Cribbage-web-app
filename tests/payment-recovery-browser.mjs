// Synthetic browser-only recovery proof. HTTP is mocked; no hosted or database writes.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const root = process.cwd();
const dir = path.join(root, "test-results/payment-recovery-browser");
const origin = "http://127.0.0.1:3403";
const actor = "f2280000-0000-4000-8000-000000000001";
const other = "f2280000-0000-4000-8000-000000000002";
const tid = "f2280000-0000-4000-8000-000000000003";
const roster = "f2280000-0000-4000-8000-000000000004";
const receipt = "f2280000-0000-4000-8000-000000000005";
const eventId = "f2280000-0000-4000-8000-000000000006";
const key = `payment-operation:${actor}:${tid}`;
const otherKey = `payment-operation:${other}:${tid}`;
const sha256 = async (value) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)))), (byte) => byte.toString(16).padStart(2, "0")).join("");

await fs.mkdir(path.join(dir, "app"), { recursive: true });
await fs.mkdir(path.join(dir, "public"), { recursive: true });
await fs.copyFile(path.join(root, "public/offline-score-sw.js"), path.join(dir, "public/offline-score-sw.js"));
await fs.writeFile(path.join(dir, "package.json"), '{"private":true,"type":"module"}');
await fs.writeFile(path.join(dir, "next.config.mjs"), `export default{turbopack:{root:${JSON.stringify(root)}},devIndicators:false};`);
await fs.writeFile(path.join(dir, "app/layout.tsx"), `import'../../../src/app/globals.css';import{RecoveryDocumentBoundary}from'../../../src/components/recovery-document-boundary';export default function Layout({children}:{children:React.ReactNode}){return<html lang="en"><body><div id="acc-recovery-frozen-shield">Reload required</div><div id="acc-recovery-live-app"><RecoveryDocumentBoundary actorId="${actor}">{children}</RecoveryDocumentBoundary></div></body></html>}`);
await fs.writeFile(path.join(dir, "app/page.tsx"), `"use client";import{useState}from'react';import PaymentClient from'../../../src/app/tournament/[tournamentId]/payments/payment-client';const base={rosterEntryId:"${roster}",displayName:"Fixture Player",plannedPaymentMethod:"cash" as const,history:[]};export default function Page(){const[activeActor,setActiveActor]=useState("${actor}");const[received,setReceived]=useState(false);const entry=received?{...base,paymentVersion:1,paymentState:"received" as const,currentReceiptEventId:"${receipt}",history:[{paymentEventId:"${receipt}",version:1,eventType:"received" as const,amountMinor:2500,currencyCode:"USD" as const,paymentMethod:"cash" as const,paymentReceivedAt:"2026-11-05T10:00:00.000Z",paymentVoidedAt:null,receiptNote:null,voidReason:null,recorderDisplayName:"Fixture",recordedAt:"2026-11-05T10:00:01.000Z"}]}:{...base,paymentVersion:0,paymentState:"unrecorded" as const,currentReceiptEventId:null};return<main className="tournament-shell"><section className="auth-card corrections-card"><h1>Manual payment recovery fixture</h1><button onClick={()=>setActiveActor("${other}")}>Switch actor</button><button onClick={()=>setReceived(v=>!v)}>Toggle receipt</button><output aria-label="Active actor">{activeActor}</output><PaymentClient actorId={activeActor} tournamentId="${tid}" rosterEntries={[entry]} acceptedMethods={['cash','check']} syntheticMode/></section></main>}`);

const recorded = { status: "payment_recorded", paymentEventId: eventId, rosterEntryId: roster, paymentVersion: 1, paymentState: "received", paymentRecorded: true, paidInFull: false, reconciled: false };
const voided = { status: "payment_voided", paymentEventId: eventId, voidedPaymentEventId: receipt, rosterEntryId: roster, paymentVersion: 2, paymentState: "voided", paymentRecorded: false, paidInFull: false, reconciled: false };
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", dir, "--hostname", "127.0.0.1", "--port", "3403"], { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
let log = "", browser;
server.stdout.on("data", (b) => log += b);
server.stderr.on("data", (b) => log += b);

try {
  let ready = false;
  for (const end = Date.now() + 90000; Date.now() < end;) { if (log.includes("Ready in")) { ready = true; break; } await new Promise((r) => setTimeout(r, 200)); }
  assert(ready, "payment harness process ready");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await context.newPage();
  const waitEnabled = async (name) => {
    const button = page.getByRole("button", { name });
    await button.waitFor({ state: "visible" });
    for (const end = Date.now() + 10000; Date.now() < end && !await button.isEnabled();) await page.waitForTimeout(50);
    assert.equal(await button.isEnabled(), true, `${name} enabled`);
    return button;
  };
  let mode = "accept", posts = 0, lastBody = null, reconcileGate = null;
  await context.route("**/api/v1/tournaments/**/payments/**", async (route) => {
    const request = route.request();
    assert.equal(request.headers()["x-expected-actor-id"], actor);
    const body = request.postDataJSON();
    if (request.url().endsWith("/reconciliation")) {
      if (reconcileGate) { reconcileGate.seen(); await reconcileGate.wait; reconcileGate = null; }
      const result = mode === "none" ? null
        : mode === "conflict" ? { status: "rejected", code: "idempotency_conflict", rosterEntryId: roster }
        : mode === "stale" ? { status: "rejected", code: "stale_payment_history", rosterEntryId: roster }
        : body.operationType === "void_manual_roster_payment" ? voided : recorded;
      return route.fulfill({ json: { result } });
    }
    posts++;
    lastBody = body;
    if (mode === "abort") return route.abort("failed");
    if (mode === "conflict") return route.fulfill({ status: 409, json: { status: "rejected", code: "idempotency_conflict", rosterEntryId: roster } });
    if (mode === "stale") return route.fulfill({ status: 409, json: { status: "rejected", code: "stale_payment_history", rosterEntryId: roster } });
    return route.fulfill({ json: request.url().endsWith("/void") ? voided : recorded });
  });

  await page.goto(origin);
  await page.getByText("Fixture Player").waitFor();
  await page.screenshot({ path: path.join(dir, "phone-390.png"), fullPage: true });

  // The complete request exists before POST and exact accepted completion alone removes it.
  await page.getByLabel("Amount in USD").fill("25.00");
  await page.getByLabel(/Optional note/).fill("Desk receipt");
  await page.getByRole("button", { name: "Record simulated receipt evidence" }).click();
  await page.waitForFunction((k) => sessionStorage.getItem(k) === null, key);
  assert.equal(lastBody.amountMinor, 2500);
  assert.equal(lastBody.note, "TEST ONLY SYNTHETIC: Desk receipt");

  // A lost response remains byte-exact across reload; explicit retry reuses the saved request.
  mode = "abort";
  await (await waitEnabled("Record simulated receipt evidence")).click();
  await page.getByText("exact recovery record remains saved", { exact: false }).waitFor();
  const lostRaw = await page.evaluate((k) => sessionStorage.getItem(k), key);
  assert(lostRaw?.includes('"amountMinor":2500'));
  const lostBody = lastBody;
  mode = "none";
  await page.reload();
  await page.getByText("No server receipt exists yet", { exact: false }).waitFor();
  mode = "accept";
  await page.getByRole("button", { name: "Retry exact saved payment request" }).click();
  await page.waitForFunction((k) => sessionStorage.getItem(k) === null, key);
  assert.deepEqual(lastBody, lostBody);
  await page.waitForTimeout(500);

  // An idempotency conflict is never cleared.
  mode = "abort";
  await page.getByLabel("Amount in USD").fill("25.00");
  await page.getByLabel(/Optional note/).fill("Conflict fixture");
  await (await waitEnabled("Record simulated receipt evidence")).click();
  await page.getByText("exact recovery record remains saved", { exact: false }).waitFor();
  const conflictRaw = await page.evaluate((k) => sessionStorage.getItem(k), key);
  mode = "conflict";
  await page.getByRole("button", { name: "Retry exact saved payment request" }).click();
  await page.getByText("idempotency conflict", { exact: false }).waitFor();
  assert.equal(await page.evaluate((k) => sessionStorage.getItem(k), key), conflictRaw);

  // Replacing retained bytes before the tracked retry prevents another POST.
  const beforeChangedRetry = posts;
  await page.evaluate((k) => sessionStorage.setItem(k, "NEWER PAYMENT BYTES"), key);
  await page.getByRole("button", { name: "Retry exact saved payment request" }).click();
  await page.getByText("newer bytes remain saved", { exact: false }).waitFor();
  assert.equal(posts, beforeChangedRetry);
  assert.equal(await page.evaluate((k) => sessionStorage.getItem(k), key), "NEWER PAYMENT BYTES");

  // Unknown and other-actor bytes are preserved.
  await page.evaluate(([k, ok]) => { sessionStorage.setItem(k, "{future payment bytes"); sessionStorage.setItem(ok, "OTHER ACTOR BYTES"); }, [key, otherKey]);
  await page.reload();
  await page.getByText("unrecognized payment recovery record", { exact: false }).waitFor();
  assert.equal(await page.evaluate((k) => sessionStorage.getItem(k), key), "{future payment bytes");
  assert.equal(await page.evaluate((k) => sessionStorage.getItem(k), otherKey), "OTHER ACTOR BYTES");

  // Legacy digest-only bytes stay intact for wrong details, then upgrade to the complete exact request before POST.
  const legacyOperation = "f2280000-0000-4000-8000-000000000008";
  const legacyReceivedAt = "2026-11-05T10:00:00.000Z";
  const legacyFields = { amountMinor: 2500, paymentMethod: "cash", paymentReceivedAt: legacyReceivedAt, note: "TEST ONLY SYNTHETIC: Legacy desk receipt" };
  const legacyRaw = JSON.stringify({ kind: "payment", operationType: "record_manual_roster_payment", rosterEntryId: roster, expectedPaymentVersion: 0, paymentEventId: null, idempotencyKey: legacyOperation, digest: await sha256({ kind: "record_manual_roster_payment", rosterEntryId: roster, expectedPaymentVersion: 0, paymentEventId: null, fields: legacyFields }) });
  await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [key, legacyRaw]);
  mode = "none";
  await page.reload();
  await page.getByText("legacy record has no full payload", { exact: false }).waitFor();
  const postsBeforeWrongLegacy = posts;
  await page.getByLabel("Amount in USD").fill("24.00");
  await page.getByLabel(/Received at/).fill(legacyReceivedAt);
  await page.getByLabel(/Optional note/).fill("Legacy desk receipt");
  await page.getByRole("button", { name: "Record simulated receipt evidence" }).click();
  await page.getByText("Re-enter the original details exactly", { exact: false }).waitFor();
  assert.equal(posts, postsBeforeWrongLegacy);
  assert.equal(await page.evaluate((k) => sessionStorage.getItem(k), key), legacyRaw);
  // A failed atomic replacement leaves the original legacy bytes intact.
  await page.evaluate((targetKey) => {
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, "__paymentOriginalSetItem", { value: original, configurable: true });
    Storage.prototype.setItem = function (candidateKey, value) {
      if (this === sessionStorage && candidateKey === targetKey && String(value).includes('"kind":"payment-recovery-v2"')) throw new Error("synthetic_storage_failure");
      return original.call(this, candidateKey, value);
    };
  }, key);
  await page.getByLabel("Amount in USD").fill("25.00");
  const postsBeforeFailedUpgrade = posts;
  await page.getByRole("button", { name: "Record simulated receipt evidence" }).click();
  await page.getByText("cannot safely retain the exact payment request", { exact: false }).waitFor();
  assert.equal(posts, postsBeforeFailedUpgrade);
  assert.equal(await page.evaluate((k) => sessionStorage.getItem(k), key), legacyRaw);
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__paymentOriginalSetItem;
    delete window.__paymentOriginalSetItem;
  });
  mode = "accept";
  await page.getByRole("button", { name: "Record simulated receipt evidence" }).click();
  await page.waitForFunction((k) => sessionStorage.getItem(k) === null, key);
  assert.equal(lastBody.idempotencyKey, legacyOperation);
  assert.equal(lastBody.paymentReceivedAt, legacyReceivedAt);

  // A future nested request field is preserved as unknown rather than forwarded.
  const futureRaw = JSON.stringify({ kind: "payment-recovery-v2", actorId: actor, tournamentId: tid, operationType: "record_manual_roster_payment", request: { ...lostBody, futureField: true } });
  await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [key, futureRaw]);
  await page.reload();
  await page.getByText("unrecognized payment recovery record", { exact: false }).waitFor();
  assert.equal(await page.evaluate((k) => sessionStorage.getItem(k), key), futureRaw);

  // A safe stale rejection is removed only after the same code is confirmed by identity reconciliation.
  await page.evaluate((k) => sessionStorage.removeItem(k), key);
  await page.reload();
  mode = "stale";
  await page.getByLabel("Amount in USD").fill("25.00");
  await page.getByRole("button", { name: "Record simulated receipt evidence" }).click();
  await page.getByText("confirmed the same terminal rejection", { exact: false }).waitFor();
  assert.equal(await page.evaluate((k) => sessionStorage.getItem(k), key), null);

  // Void uses the complete immutable request and clears only on its exact accepted response.
  mode = "accept";
  await page.getByRole("button", { name: "Toggle receipt" }).click();
  await page.getByLabel("Reason for Void").fill("Duplicate desk record");
  await page.getByRole("button", { name: "Void current receipt" }).click();
  await page.waitForFunction((k) => sessionStorage.getItem(k) === null, key);
  assert.equal(lastBody.paymentEventId, receipt);
  assert.equal(lastBody.voidReason, "Duplicate desk record");

  // A delayed reconciliation from actor A cannot update actor B or remove actor A's bytes.
  const delayed = JSON.stringify({ kind: "payment-recovery-v2", actorId: actor, tournamentId: tid, operationType: "record_manual_roster_payment", request: { ...lostBody, idempotencyKey: "f2280000-0000-4000-8000-000000000009" } });
  await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [key, delayed]);
  let seen, release;
  reconcileGate = { seen: () => seen(), wait: new Promise((r) => release = r) };
  const observed = new Promise((r) => seen = r);
  await page.reload();
  await observed;
  await page.getByRole("button", { name: "Switch actor" }).click();
  await page.getByLabel("Active actor").filter({ hasText: other }).waitFor();
  release();
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate((k) => sessionStorage.getItem(k), key), delayed);
  assert.equal(await page.evaluate((k) => sessionStorage.getItem(k), otherKey), "OTHER ACTOR BYTES");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(dir, "desktop-1440.png"), fullPage: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await page.setViewportSize({ width: 390, height: 900 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: path.join(dir, "phone-390-text-200.png"), fullPage: true });
  await fs.writeFile(path.join(dir, "result.json"), JSON.stringify({ passed: true, mockedHttp: true, noDatabase: true, widths: [390, 1440], textScalePercent: 200, exactRequestBeforePost: true, lostResponseExactRetry: true, conflictPreserved: true, replacedBeforeRetryNoPost: true, unknownAndOtherActorPreserved: true, legacyWrongDetailsPreserved: true, failedLegacyReplacementPreservedOriginal: true, legacyExactUpgradeBeforePost: true, futureNestedFieldPreserved: true, safeRejectedCodeDoubleConfirmed: true, voidCovered: true, actorSwitchFenced: true }, null, 2));
  await context.close();
} catch (error) {
  await fs.writeFile(path.join(dir, "result.json"), JSON.stringify({ passed: false, error: String(error) }, null, 2));
  throw error;
} finally {
  await browser?.close();
  try { execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch {}
  await fs.writeFile(path.join(dir, "server.log"), log);
  await fs.writeFile(path.join(dir, "cleanup.json"), JSON.stringify({ pid: server.pid, browserClosed: true, taskTreeStopRequested: true }));
}
