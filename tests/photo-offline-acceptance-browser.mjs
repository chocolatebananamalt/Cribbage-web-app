// Actual client components/queue; fictional transports only. Not server permission proof.
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const root = process.cwd(), dir = path.join(root, "test-results/photo-offline-acceptance");
const id = "40000000-0000-4000-8000-000000000001";
const captureId = "40000000-0000-4000-8000-000000000002";
const uploadId = "40000000-0000-4000-8000-000000000003";
const objectId = "40000000-0000-4000-8000-000000000004";
const receiptId = "40000000-0000-4000-8000-000000000005";
const origin = "http://127.0.0.1:3241";
await fs.mkdir(path.join(dir, "app/offline"), { recursive: true });
await fs.mkdir(path.join(dir, "app/recover"), { recursive: true });
await fs.mkdir(path.join(dir, "public"), { recursive: true });
await fs.writeFile(path.join(dir, "package.json"), '{"private":true,"type":"module"}');
await fs.writeFile(path.join(dir, "next.config.mjs"), `export default {turbopack:{root:${JSON.stringify(root)}}};`);
await fs.copyFile("public/offline-score-sw.js", path.join(dir, "public/offline-score-sw.js"));
await fs.writeFile(path.join(dir, "app/layout.tsx"), `import '../../../src/app/globals.css';export default function Layout({children}:{children:React.ReactNode}){return <html><body>{children}</body></html>}`);
await fs.writeFile(path.join(dir, "app/page.tsx"), `import {PrivatePaperCardPhoto} from '../../../src/components/private-paper-card-photo';import {RecoveryDocumentBoundary} from '../../../src/components/recovery-document-boundary';import {SharedDeviceSignOut} from '../../../src/components/shared-device-sign-out';export default function Page(){return <RecoveryDocumentBoundary actorId="${id}"><main><h1>Synthetic photo acceptance</h1><PrivatePaperCardPhoto actorId="${id}" tournamentId="${id}" gameId="${id}" cardSide="a" verificationId="A-1" inputId="card" label="Synthetic A"/><SharedDeviceSignOut/></main></RecoveryDocumentBoundary>}`);
await fs.writeFile(path.join(dir, "app/recover/page.tsx"), `import {PendingPaperCardPhotos} from '../../../../src/components/pending-paper-card-photos';import {RecoveryDocumentBoundary} from '../../../../src/components/recovery-document-boundary';import {SharedDeviceSignOut} from '../../../../src/components/shared-device-sign-out';export default function Page(){return <RecoveryDocumentBoundary actorId="${id}"><main><h1>No current game candidates</h1><PendingPaperCardPhotos actorId="${id}" tournamentId="${id}"/><SharedDeviceSignOut/></main></RecoveryDocumentBoundary>}`);
await fs.writeFile(path.join(dir, "app/offline/page.tsx"), `"use client";import {useEffect} from 'react';import * as queue from '../../../../src/lib/offline-score-queue';import {SharedDeviceSignOut} from '../../../../src/components/shared-device-sign-out';import {RecoveryDocumentBoundary} from '../../../../src/components/recovery-document-boundary';export default function Page(){useEffect(()=>{Object.assign(window,{queue})},[]);return <RecoveryDocumentBoundary actorId="${id}"><h1>Actual offline queue fixture</h1><SharedDeviceSignOut/></RecoveryDocumentBoundary>}`);
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", dir, "--hostname", "127.0.0.1", "--port", "3241"], { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SUPABASE_URL: "http://localhost:3241", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fictional-local-only" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = "", browser;
child.stdout.on("data", value => { logs += value; }); child.stderr.on("data", value => { logs += value; });
const outcomes = [];
function record(name, detail) { outcomes.push({ name, detail }); console.log("PASS", name, detail ?? ""); }
try {
  let ready = false;
  for (const until = Date.now() + 60000; Date.now() < until;) {
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1500) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  assert.ok(ready, "local fixture ready");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    let failCompletion = true, completionPersisted = false, abortCaptureOnce = false, rejection = null, captures = [], completions = 0, uploads = 0;
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (![origin, "http://localhost:3241"].includes(url.origin)) return route.abort();
      if (url.pathname.includes("/storage/v1/")) { uploads++; return uploads === 2 ? route.fulfill({ status: 409, json: { statusCode: "409", error: "Duplicate", message: "Synthetic object already exists" } }) : route.fulfill({ status: 200, json: { Key: "synthetic-card" } }); }
      if (!url.pathname.includes("/paper-card-captures")) return route.continue();
      const request = JSON.parse(route.request().postData() ?? "{}");
      if (url.pathname.endsWith("/complete")) {
        completions++;
        if (failCompletion) { completionPersisted = true; return route.abort(); }
        return route.fulfill({ status: 200, json: { status: "image_stored", captureId, storageReceiptId: receiptId, retentionState: "restricted_hold", ocrRequested: false, scoreChanged: false, gameVerified: false } });
      }
      if (url.pathname.endsWith("/upload")) return completionPersisted ? route.fulfill({ status: 409, json: { error: "upload_unavailable" } }) : route.fulfill({ status: 200, json: { status: "upload_authorized", captureId, uploadIntentId: uploadId, objectReferenceId: objectId, objectPath: `${id}/${objectId}.png`, mediaType: "image/png", byteSize: captures.at(-1).declaredByteSize, sha256: captures.at(-1).declaredSha256, retentionState: "restricted_hold", token: "fictional-local-upload" } });
      captures.push(request);
      if (abortCaptureOnce) { abortCaptureOnce = false; return route.abort(); }
      if (rejection) return route.fulfill({ status: 409, json: { status: "rejected", code: rejection } });
      return route.fulfill({ status: 200, json: { status: "paper_card_capture_created", captureId, uploadIntentId: uploadId, objectReferenceId: objectId, gameId: request.gameId, cardSide: request.cardSide, verificationId: request.verificationId, captureState: "upload_provider_pending", humanReviewState: "not_started", retentionState: "restricted_hold", originalMetadata: { sourceKind: request.sourceKind, fileName: request.originalFileName, mediaType: request.declaredMediaType, byteSize: request.declaredByteSize, sha256: request.declaredSha256, clientCapturedAt: null }, uploadProviderConfigured: false, uploadAuthorized: false, imageStored: false, publicUrlCreated: false, ocrRequested: false, transcriptionCreated: false, scoreChanged: false, gameVerified: false } });
    });
    await page.goto(origin);
    const png = await page.evaluate(() => { const canvas = document.createElement("canvas"); canvas.width = 400; canvas.height = 200; const ctx = canvas.getContext("2d"); ctx.fillStyle = "white"; ctx.fillRect(0, 0, 400, 200); ctx.fillStyle = "black"; ctx.font = "20px sans-serif"; ctx.fillText("TEST ONLY A-1 wins +15", 10, 60); return canvas.toDataURL("image/png").split(",")[1]; });
    const file = { name: "synthetic-card.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") };
    await page.locator("input[type=file]").setInputFiles(file);
    await page.getByRole("button", { name: "Store private photo", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "upload is not confirmed" }).waitFor().catch(async error => { console.log("PHOTO_DIAGNOSTIC", { text: await page.getByRole("status").allTextContents(), captures: captures.length, uploads, completions }); throw error; });
    const first = captures[0];
    failCompletion = false;
    await page.getByRole("button", { name: "Store private photo", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Human review is still required" }).waitFor();
    assert.deepEqual(captures[1], first); assert.equal(completions, 2); assert.equal(uploads, 1);
    assert.equal(await page.getByRole("button", { name: "Store private photo", exact: true }).count(), 0);
    record(`photo ${width}: simulated lost-success completion retry`, "same exact capture envelope retained; mock server refuses new upload authorization after completion, supported completion reconciliation succeeds without another PUT");
    await page.screenshot({ path: path.join(root, `test-results/photo-stored-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "Clear preview" }).click();
    await page.locator("input[type=file]").setInputFiles(file); failCompletion = true; completionPersisted = false;
    await page.getByRole("button", { name: "Store private photo", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "upload is not confirmed" }).waitFor();
    const beforeReload = captures.at(-1).idempotencyKey;
    await page.goto(origin + "/recover");
    await page.getByRole("heading", { name: "No current game candidates" }).waitFor();
    await page.getByRole("status").filter({ hasText: "An earlier photo upload is unresolved" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Store private photo", exact: true }).count(), 0);
    await page.getByRole("status").filter({ hasText: "retry record is" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Clear safe app data and sign out", exact: true }).count(), 0);
    const beforeMismatch = captures.length;
    await page.locator("input[type=file]").setInputFiles({ ...file, buffer: Buffer.concat([file.buffer, Buffer.from("different")]) });
    await page.getByRole("status").filter({ hasText: "This is a different image" }).waitFor();
    assert.equal(captures.length, beforeMismatch);
    await page.locator("input[type=file]").setInputFiles(file); failCompletion = false;
    await page.getByRole("button", { name: "Store private photo", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Human review is still required" }).waitFor();
    assert.equal(captures.at(-1).idempotencyKey, beforeReload);
    assert.equal(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('paper-game-completion:photo:')).length), 0);
    record(`photo ${width}: reload recovery`, "same image reselect reuses retained key; pending request blocks clear/switch and confirmed completion clears only its request");
    await page.getByRole("button", { name: "Clear preview" }).click();
    assert.equal(await page.locator("input[type=file]").isDisabled(), true);
    await page.goto(origin);
    abortCaptureOnce = true; completionPersisted = false;
    await page.locator("input[type=file]").setInputFiles(file);
    const captureOffset = captures.length;
    await page.getByRole("button", { name: "Store private photo", exact: true }).evaluate(button => { button.click(); button.click(); });
    await page.getByRole("status").filter({ hasText: "upload is not confirmed" }).waitFor();
    assert.equal(captures.length, captureOffset + 1);
    await page.getByRole("button", { name: "Store private photo", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Human review is still required" }).waitFor();
    assert.deepEqual(captures[captureOffset], captures[captureOffset + 1]);
    record(`photo ${width}: capture interruption and repeated click`, "one capture from immediate double click; interrupted response retains exact operation for explicit retry");
    await page.getByRole("button", { name: "Clear preview" }).click();
    rejection = "not_capture_official";
    await page.locator("input[type=file]").setInputFiles(file);
    await page.getByRole("button", { name: "Store private photo", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "request is unresolved" }).waitFor();
    assert.equal(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('paper-game-completion:photo:')).length), 1);
    rejection = "verification_id_mismatch";
    await page.getByRole("button", { name: "Store private photo", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "cannot be attached" }).waitFor();
    assert.equal(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('paper-game-completion:photo:')).length), 0);
    record(`photo ${width}: rejection boundary`, "lost role retains exact work; definitive receipted identity rejection clears its own envelope; no automatic replacement submission");
    await context.close();
  }
  // Actual queue/key-generation code and browser IndexedDB/worker; mocked capability/replay transport.
  // This harness does not independently verify signature validity or key extractability.
  const context = await browser.newContext();
  const page = await context.newPage();
  await context.route("**/*", route => [origin, "http://localhost:3241"].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  await context.route("**/offline-capability", route => {
    const request = JSON.parse(route.request().postData());
    return route.fulfill({ status: 200, json: { status: "issued", version: 1, capabilityId: request.capabilityId, deviceKeyId: request.deviceKeyId, verifiedActorId: id, sessionBindingId: "fictional-session", tournamentId: id, eventId: id, gameId: id, assignedSide: "a", submissionSlot: 1, expectedGameVersion: 1, capabilityExpiresAtMs: Date.now() + 3600000 } });
  });
  await page.goto(origin + "/offline");
  await page.getByRole("heading", { name: "Actual offline queue fixture" }).waitFor({ timeout: 20000 });
  await page.waitForFunction(() => window.queue);
  await page.evaluate(async id => { window.capability = await window.queue.provisionOfflineSubmission(id, id); }, id);
  await context.setOffline(true);
  const results = await page.evaluate(async () => Promise.allSettled([window.queue.queueOfflineSubmission(window.capability, "a", 15), window.queue.queueOfflineSubmission(window.capability, "b", 16)]).then(values => values.map(value => value.status === "fulfilled" ? { status: value.status, record: value.value } : { status: value.status, message: value.reason.message })));
  assert.equal(results.filter(value => value.status === "fulfilled").length, 1);
  assert.equal(results.filter(value => value.status === "rejected").length, 1);
  const saved = results.find(value => value.status === "fulfilled").record;
  assert.equal(await page.evaluate(() => window.queue.countOfflineSubmissions()), 1);
  record("offline simultaneous local conflict", "real overlapping queue calls: one durable intent, one rejected; no server verified state");
  const duplicate = await page.evaluate(async saved => window.queue.queueOfflineSubmission(window.capability, saved.intent.winnerSide, saved.intent.margin), saved);
  assert.deepEqual(duplicate, saved);
  record("offline exact duplicate", "same result returns original intent and queue stays at one");
  await context.setOffline(false);
  await page.reload();
  await page.getByRole("heading", { name: "Actual offline queue fixture" }).waitFor({ timeout: 20000 });
  await page.waitForFunction(() => window.queue);
  assert.deepEqual(await page.evaluate(id => window.queue.readOfflineSubmission(id, id), id), saved);
  record("offline retained across reload", "exact signed bytes survive reload; connectivity restored before reload (offline page-cache navigation not claimed)");
  await page.getByRole("status").filter({ hasText: "1 offline score entry is" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Clear safe app data and sign out", exact: true }).count(), 0);
  record("pending queue prevents clear-and-switch UI", "actual sign-out component reports one offline entry; destructive switch unavailable; no sign-out/auth called");
  await context.route("**/api/v1/offline-score-replay", route => route.fulfill({ status: 503, json: { error: "synthetic_unavailable" } }));
  const replay = await page.evaluate(async id => { const record = await window.queue.readOfflineSubmission(id, id); const result = await window.queue.replayOfflineSubmission(record); return { status: result.response.status, retained: await window.queue.readOfflineSubmission(id, id) }; }, id);
  assert.equal(replay.status, 503); assert.deepEqual(replay.retained, saved);
  record("offline transient replay transport", "503 leaves exact retained intent intact; full score-entry sync controller and server acceptance not exercised");
  await context.close();
  await fs.writeFile(path.join(root, "test-results/photo-offline-acceptance-results.json"), JSON.stringify(outcomes, null, 2));
} finally {
  await browser?.close(); child.kill();
  await fs.writeFile(path.join(root, "test-results/photo-offline-acceptance-server.log"), logs);
}
