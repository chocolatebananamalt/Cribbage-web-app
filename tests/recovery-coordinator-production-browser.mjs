// Actual production coordinator + worker, served only by a disposable localhost Next app.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const root = process.cwd();
const dir = path.join(root, "test-results", "recovery-coordinator-production-browser");
const actor = "a1310000-0000-4000-8000-000000000001";
const otherActor = "a1310000-0000-4000-8000-000000000002";
await fs.mkdir(path.join(dir, "app", "legacy"), { recursive: true });
await fs.mkdir(path.join(dir, "app", "other"), { recursive: true });
await fs.mkdir(path.join(dir, "public"), { recursive: true });
await Promise.all([
  fs.writeFile(path.join(dir, "package.json"), '{"private":true,"type":"module"}'),
  fs.writeFile(path.join(dir, "next.config.mjs"), `export default {turbopack:{root:${JSON.stringify(root)}}};`),
  fs.writeFile(path.join(dir, "app", "layout.tsx"), 'export default function Layout({children}:{children:React.ReactNode}){return <html><body>{children}</body></html>}'),
  fs.writeFile(path.join(dir, "app", "legacy", "page.tsx"), 'export default function Page(){return <h1>Legacy window without coordinator</h1>}'),
  fs.writeFile(path.join(dir, "app", "other", "page.tsx"), 'export default function Page(){return <h1>Other page</h1>}'),
  fs.copyFile(path.join(root, "public", "offline-score-sw.js"), path.join(dir, "public", "offline-score-sw.js")),
  fs.writeFile(path.join(dir, "public", "replacement-sw.js"), "self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));"),
  fs.writeFile(path.join(dir, "app", "page.tsx"), String.raw`
"use client";
import {useEffect,useState} from "react";
import {
  acquireRecoveryDocument,assertRecoveryWriteAllowed,beginSafeRecoverySwitch,cancelSafeRecoverySwitch,
  beginRecoveryCleanup,failSafeRecoverySwitch,finishPreservingRecoverySignOut,finishRecoveryAuthentication,finishSafeRecoverySwitch,markRecoveryCleanupStarted,resumeRecoveryAfterRejectedAuth,
  setAppRecoveryItem,setPublicCheckInRecoveryItem,trackAppRecoveryWrite,
} from "../../../src/lib/recovery-write-coordinator";
const actor=${JSON.stringify(actor)};
const pending=new Map<string,()=>void>();
const running=new Map<string,Promise<unknown>>();
export default function Page(){
  const [status,setStatus]=useState("acquiring");
  useEffect(()=>{const params=new URLSearchParams(location.search);const selected=params.has("anonymous")?null:actor;const delay=Number(params.get("delayAcquire")??"0");const acquire=()=>{void acquireRecoveryDocument(selected).then(()=>setStatus("ready"),error=>setStatus("error:"+error.message));};if(delay>0){const timer=window.setTimeout(acquire,delay);return()=>window.clearTimeout(timer);}acquire();},[]);
  useEffect(()=>{const observe=(event:PageTransitionEvent)=>{window.wasPersisted=event.persisted};addEventListener("pageshow",observe);return()=>removeEventListener("pageshow",observe)},[]);
  useEffect(()=>{Object.assign(window,{recoveryProduction:{
    acquire:acquireRecoveryDocument,assertWrite:assertRecoveryWriteAllowed,setItem:(key:string,value:string)=>setAppRecoveryItem(localStorage,key,value),
    setPublicCheckIn:(key:string,value:string)=>setPublicCheckInRecoveryItem(localStorage,key,value),
    begin:beginSafeRecoverySwitch,beginCleanup:beginRecoveryCleanup,cancel:cancelSafeRecoverySwitch,mark:markRecoveryCleanupStarted,fail:failSafeRecoverySwitch,
    finish:finishSafeRecoverySwitch,finishAuth:finishRecoveryAuthentication,finishSignOut:finishPreservingRecoverySignOut,resume:resumeRecoveryAfterRejectedAuth,locks:()=>navigator.locks.query(),
    startWriter:(id:string)=>{let resolve!:()=>void;const gate=new Promise<void>(done=>{resolve=done});pending.set(id,resolve);const work=trackAppRecoveryWrite(async()=>{await gate;return id});running.set(id,work);return id},
    finishWriter:(id:string)=>{pending.get(id)?.();pending.delete(id);return running.get(id)},
  }});},[]);
  return <main><h1>Production recovery coordinator</h1><output data-testid="status">{status}</output></main>;
}
declare global {interface Window {recoveryProduction:any;exclusiveIntercepted?:boolean;releaseExclusiveRequest?:()=>void;wasPersisted?:boolean}}
`),
]);

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", dir, "--hostname", "127.0.0.1", "--port", "3241"], {
  cwd: root,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", data => { logs += data; });
child.stderr.on("data", data => { logs += data; });
const origin = "http://127.0.0.1:3241";
let browser;

async function openReady(context, suffix = "") {
  const page = await context.newPage();
  await page.goto(origin + suffix);
  await page.getByTestId("status").filter({ hasText: "ready" }).waitFor();
  return page;
}

try {
  let ready = false;
  for (let until = Date.now() + 45_000; Date.now() < until;) {
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1500) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  assert.ok(ready, "disposable localhost app ready");
  browser = await chromium.launch({ channel: "chrome", headless: true });

  const immediateContext = await browser.newContext();
  const immediatePage = await openReady(immediateContext);
  assert.equal(await immediatePage.evaluate(() => window.recoveryProduction.begin().then(() => "exclusive", error => error.message)), "exclusive");
  await immediatePage.evaluate(() => window.recoveryProduction.cancel());
  await immediateContext.close();
  console.log("PASS production fence: immediate post-navigation switch waits for the navigation bridge before acquiring exclusive");

  const closedClientContext = await browser.newContext();
  const closedClientOwner = await openReady(closedClientContext);
  const closingClient = await closedClientContext.newPage();
  await closingClient.goto(origin + "/?delayAcquire=5000", { waitUntil: "domcontentloaded" });
  await closedClientOwner.waitForFunction(async () => {
    const snapshot = await navigator.locks.query();
    return snapshot.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "shared").length === 2;
  });
  await closingClient.close();
  const closedStartedAt = Date.now();
  assert.equal(await closedClientOwner.evaluate(() => window.recoveryProduction.begin().then(() => "exclusive", error => error.message)), "exclusive");
  assert.ok(Date.now() - closedStartedAt < 6000, "closed destination bridge releases without exhausting all three acknowledgement attempts");
  await closedClientOwner.evaluate(() => window.recoveryProduction.cancel());
  await closedClientContext.close();
  console.log("PASS production fence: a destination closed before lease-ready is rechecked and its worker bridge drains promptly");

  const heldFenceContext = await browser.newContext();
  const heldFencePage = await openReady(heldFenceContext);
  await heldFencePage.evaluate(() => {
    let release;
    window.extraSharedLease = navigator.locks.request("acc-recovery-document-v2", { mode: "shared" }, async () => new Promise(resolve => { release = resolve; }));
    window.releaseExtraSharedLease = () => release?.();
  });
  await heldFencePage.waitForFunction(async () => {
    const snapshot = await navigator.locks.query();
    return snapshot.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "shared").length === 2;
  });
  const heldStartedAt = Date.now();
  assert.equal(await heldFencePage.evaluate(() => window.recoveryProduction.begin().then(() => null, error => error.message)), "recovery_navigation_lease_pending");
  assert.ok(Date.now() - heldStartedAt >= 11_500, "extra held navigation lease must reach the bounded fail-closed timeout");
  let fenceLocks = await heldFencePage.evaluate(() => navigator.locks.query());
  assert.equal(fenceLocks.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "shared").length, 2);
  assert.equal(await heldFencePage.evaluate(() => { try { window.recoveryProduction.setItem("payment-operation:held-fence", "blocked"); return "allowed"; } catch (error) { return error.message; } }), "recovery_navigation_lease_pending");
  await heldFencePage.evaluate(() => window.releaseExtraSharedLease());
  await heldFenceContext.close();
  console.log("PASS production fence: an unexplained extra held lease times out fail-closed without releasing the document lease");

  const pendingFenceContext = await browser.newContext();
  const pendingFencePage = await openReady(pendingFenceContext);
  await pendingFencePage.evaluate(() => {
    window.pendingExclusiveLease = navigator.locks.request("acc-recovery-document-v2", { mode: "exclusive" }, async () => undefined);
  });
  await pendingFencePage.waitForFunction(async () => {
    const snapshot = await navigator.locks.query();
    return snapshot.pending.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "exclusive").length === 1;
  });
  const pendingStartedAt = Date.now();
  assert.equal(await pendingFencePage.evaluate(() => window.recoveryProduction.begin().then(() => null, error => error.message)), "recovery_navigation_lease_pending");
  assert.ok(Date.now() - pendingStartedAt >= 11_500, "queued navigation contender must reach the bounded fail-closed timeout");
  fenceLocks = await pendingFencePage.evaluate(() => navigator.locks.query());
  assert.equal(fenceLocks.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "shared").length, 1);
  assert.equal(fenceLocks.pending.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "exclusive").length, 1);
  assert.equal(await pendingFencePage.evaluate(() => { try { window.recoveryProduction.setItem("payment-operation:pending-fence", "blocked"); return "allowed"; } catch (error) { return error.message; } }), "recovery_navigation_lease_pending");
  await pendingFenceContext.close();
  console.log("PASS production fence: a queued exclusive contender times out fail-closed while the document shared lease remains held");

  const context = await browser.newContext();
  const page = await openReady(context);
  await page.evaluate(() => window.recoveryProduction.setItem("payment-operation:synthetic-recovery", "same-owner"));
  assert.equal(await page.evaluate(() => localStorage.getItem("payment-operation:synthetic-recovery")), "same-owner");
  await page.evaluate(() => window.recoveryProduction.setItem("payment-operation:synthetic-recovery", "same-owner"));
  assert.equal(await page.evaluate(() => { try { window.recoveryProduction.setItem("payment-operation:synthetic-recovery", "changed"); return "allowed"; } catch (error) { return error.message; } }), "recovery_record_conflict");
  assert.equal(await page.evaluate(() => localStorage.getItem("payment-operation:synthetic-recovery")), "same-owner");
  assert.equal(await page.evaluate(() => { try { window.recoveryProduction.setItem("unowned-key", "blocked"); return "allowed"; } catch (error) { return error.message; } }), "recovery_storage_key_unsupported");
  assert.equal(await page.evaluate(() => localStorage.getItem("unowned-key")), null);
  assert.equal(await page.evaluate(id => window.recoveryProduction.acquire(id).then(() => null, error => error.message), otherActor), null);
  assert.equal(await page.evaluate(() => { try { window.recoveryProduction.setItem("payment-operation:different-owner", "blocked"); return "allowed"; } catch (error) { return error.message; } }), "recovery_owner_conflict");
  await page.evaluate(id => window.recoveryProduction.acquire(id), actor);
  await page.reload();
  await page.getByTestId("status").filter({ hasText: "ready" }).waitFor();
  let locks = await page.evaluate(async () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const snapshot = await window.recoveryProduction.locks();
      if (snapshot.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "shared").length === 1) return snapshot;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return window.recoveryProduction.locks();
  });
  assert.equal(locks.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "shared").length, 1);
  console.log("PASS production: lease-only acquisition renders across owner conflict; writes reject until the matching owner returns");

  const legacy = await context.newPage();
  await legacy.goto(origin + "/legacy");
  await new Promise(resolve => setTimeout(resolve, 7800));
  assert.equal(await page.evaluate(() => window.recoveryProduction.begin().then(() => null, error => error.message)), "other_tournament_tabs_or_unknown_inventory");
  await legacy.close();
  console.log("PASS production: legacy no-lease window remains inventoried after the full worker bridge deadline");

  await page.evaluate(() => {
    const request = navigator.locks.request.bind(navigator.locks);
    let intercepted = false;
    window.exclusiveIntercepted = false;
    navigator.locks.request = (name, options, callback) => {
      if (!intercepted && options?.mode === "exclusive") {
        intercepted = true;
        window.exclusiveIntercepted = true;
        return new Promise(resolve => { window.releaseExclusiveRequest = () => resolve(request(name, options, callback)); });
      }
      return request(name, options, callback);
    };
  });
  const lateSwitch = page.evaluate(() => window.recoveryProduction.begin().then(() => null, error => error.message));
  await page.waitForFunction(() => window.exclusiveIntercepted === true);
  const lateLegacy = await context.newPage();
  await lateLegacy.goto(origin + "/legacy?late=1");
  await new Promise(resolve => setTimeout(resolve, 7800));
  await page.evaluate(() => window.releaseExclusiveRequest());
  assert.equal(await lateSwitch, "other_tournament_tabs_or_unknown_inventory");
  locks = await page.evaluate(() => window.recoveryProduction.locks());
  assert.equal(locks.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "exclusive").length, 1);
  await page.evaluate(() => window.recoveryProduction.cancel());
  await lateLegacy.close();
  console.log("PASS production: late legacy navigation after preflight is rejected by the under-exclusive second inventory");

  await page.evaluate(() => window.recoveryProduction.startWriter("slow"));
  const switching = page.evaluate(() => window.recoveryProduction.begin().then(() => "exclusive", error => error.message));
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(await page.evaluate(() => { try { window.recoveryProduction.setItem("payment-operation:late", "blocked"); return "allowed"; } catch (error) { return error.message; } }), "recovery_write_barrier_closed");
  await page.evaluate(() => window.recoveryProduction.finishWriter("slow"));
  assert.equal(await switching, "exclusive");
  locks = await page.evaluate(() => window.recoveryProduction.locks());
  assert.equal(locks.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "exclusive").length, 1);
  await page.evaluate(() => window.recoveryProduction.cancel());
  locks = await page.evaluate(() => window.recoveryProduction.locks());
  assert.equal(locks.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "shared").length, 1);
  console.log("PASS production: tracked async writer drains before exclusive; pre-cleanup cancel reacquires shared");

  await page.evaluate(() => window.recoveryProduction.begin());
  await page.evaluate(async () => { await window.recoveryProduction.mark(); window.recoveryProduction.fail(); });
  assert.equal(await page.evaluate(() => window.recoveryProduction.cancel().then(() => null, error => error.message)), "recovery_destructive_step_started");
  await page.evaluate(() => window.recoveryProduction.resume());
  await page.evaluate(() => window.recoveryProduction.begin());
  locks = await page.evaluate(() => window.recoveryProduction.locks());
  assert.equal(locks.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "exclusive").length, 1);
  await page.evaluate(() => window.recoveryProduction.finish());
  console.log("PASS production: partial failure retains exclusive; rejected auth revalidates retry; finish releases only after cleanup started");

  const replacementContext = await browser.newContext();
  const replacementPage = await openReady(replacementContext);
  await replacementPage.evaluate(() => window.recoveryProduction.begin());
  await replacementPage.evaluate(async () => {
    const prior = navigator.serviceWorker.controller;
    await navigator.serviceWorker.register("/replacement-sw.js", { scope: "/", updateViaCache: "none" });
    if (navigator.serviceWorker.controller === prior) await new Promise(resolve => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
  });
  assert.equal(await replacementPage.evaluate(() => window.recoveryProduction.mark().then(() => null, error => error.message)), "recovery_controller_changed_or_unknown");
  locks = await replacementPage.evaluate(() => navigator.locks.query());
  assert.equal(locks.held.filter(lock => lock.name === "acc-recovery-document-v2" && lock.mode === "exclusive").length, 1);
  await replacementContext.close();
  console.log("PASS production: controller replacement before cleanup blocks the destructive marker while retaining exclusive");

  const malformed = await browser.newContext();
  const malformedPage = await malformed.newPage();
  await malformedPage.goto(origin);
  await malformedPage.getByTestId("status").filter({ hasText: "ready" }).waitFor();
  assert.equal(await malformedPage.evaluate(() => window.recoveryProduction.acquire("not-a-uuid").then(() => null, error => error.message)), null);
  assert.equal(await malformedPage.evaluate(() => { try { window.recoveryProduction.setItem("payment-operation:malformed", "blocked"); return "allowed"; } catch (error) { return error.message; } }), "recovery_owner_conflict");
  await malformed.close();
  await context.close();

  const malformedGuest = await browser.newContext();
  const malformedGuestPage = await openReady(malformedGuest, "/?anonymous=1");
  await malformedGuestPage.evaluate(() => localStorage.setItem("acc:event-check-in:completion", "malformed-retained"));
  assert.equal(await malformedGuestPage.evaluate(() => { try { window.recoveryProduction.setPublicCheckIn("acc:event-check-in:completion", "replacement"); return "allowed"; } catch (error) { return error.message; } }), "recovery_record_conflict");
  assert.deepEqual(await malformedGuestPage.evaluate(() => ({ value: localStorage.getItem("acc:event-check-in:completion"), cookie: document.cookie })), { value: "malformed-retained", cookie: "" });
  await malformedGuest.close();
  console.log("PASS production: malformed anonymous retained data is neither overwritten nor silently assigned an owner marker");

  const publicGuest = await browser.newContext();
  const publicGuestPage = await openReady(publicGuest, "/?anonymous=1");
  assert.equal(await publicGuestPage.evaluate(() => { try { window.recoveryProduction.setPublicCheckIn("payment-operation:not-public", "blocked"); return "allowed"; } catch (error) { return error.message; } }), "recovery_storage_key_unsupported");
  assert.equal(await publicGuestPage.evaluate(() => { try { window.recoveryProduction.setItem("payment-operation:guest-private", "blocked"); return "allowed"; } catch (error) { return error.message; } }), "recovery_owner_unknown");
  await publicGuestPage.evaluate(() => window.recoveryProduction.setPublicCheckIn("acc:event-check-in:completion", "synthetic-public-check-in"));
  assert.deepEqual(await publicGuestPage.evaluate(() => ({ value: localStorage.getItem("acc:event-check-in:completion"), cookie: document.cookie })), {
    value: "synthetic-public-check-in",
    cookie: "acc_recovery_owner_v1=unknown",
  });
  assert.equal(await publicGuestPage.evaluate(id => window.recoveryProduction.acquire(id).then(() => null, error => error.message), actor), null);
  assert.equal(await publicGuestPage.evaluate(() => { try { window.recoveryProduction.setItem("payment-operation:unknown-owner-block", "blocked"); return "allowed"; } catch (error) { return error.message; } }), "recovery_owner_conflict");
  await publicGuest.close();
  console.log("PASS production: anonymous public check-in writes only its exact key, marks unknown first, and blocks private or later actor writes");

  const knownOwner = await browser.newContext();
  const knownOwnerPage = await openReady(knownOwner);
  await knownOwnerPage.evaluate(() => window.recoveryProduction.setItem("payment-operation:known-owner", "claimed"));
  await knownOwnerPage.evaluate(() => window.recoveryProduction.acquire(null));
  assert.equal(await knownOwnerPage.evaluate(() => { try { window.recoveryProduction.setPublicCheckIn("acc:event-check-in:completion", "blocked"); return "allowed"; } catch (error) { return error.message; } }), "recovery_owner_conflict");
  assert.equal(await knownOwnerPage.evaluate(() => localStorage.getItem("acc:event-check-in:completion")), null);
  await knownOwner.close();
  console.log("PASS production: anonymous public check-in cannot write through an existing known-owner marker");

  const anonymous = await browser.newContext();
  const anonymousPage = await openReady(anonymous, "/?anonymous=1");
  await anonymousPage.evaluate(() => window.recoveryProduction.begin());
  await anonymousPage.evaluate(() => window.recoveryProduction.finishAuth());
  assert.equal(await anonymousPage.evaluate(() => { try { window.recoveryProduction.setItem("payment-operation:guest", "blocked"); return "allowed"; } catch (error) { return error.message; } }), "recovery_write_barrier_closed");
  await anonymous.close();
  console.log("PASS production: signed-out document can coordinate auth without claiming an owner; accepted auth terminal releases exclusive and keeps writers closed");
  const preserving = await browser.newContext();
  const preservingPage = await openReady(preserving);
  await preservingPage.evaluate(() => window.recoveryProduction.begin());
  await preservingPage.evaluate(() => window.recoveryProduction.finishSignOut());
  assert.equal(await preservingPage.evaluate(() => { try { window.recoveryProduction.setItem("payment-operation:preserved", "blocked"); return "allowed"; } catch (error) { return error.message; } }), "recovery_write_barrier_closed");
  await preserving.close();
  console.log("PASS production: ordinary preserving sign-out releases exclusive through its distinct terminal state without claiming cleanup");

  const terminatedWorker = await browser.newContext();
  const terminatedPage = await openReady(terminatedWorker);
  const cdp = await terminatedWorker.newCDPSession(terminatedPage);
  await cdp.send("ServiceWorker.enable");
  await cdp.send("ServiceWorker.stopAllWorkers");
  assert.equal(await terminatedPage.evaluate(() => window.recoveryProduction.begin().then(() => "exclusive", error => error.message)), "exclusive");
  await terminatedPage.evaluate(() => window.recoveryProduction.cancel());
  await terminatedWorker.close();
  console.log("PASS production: CDP worker termination restarts the exact worker protocol before exclusive acquisition");

  const frozen = await browser.newContext();
  const frozenPage = await openReady(frozen);
  const frozenResult = await frozenPage.evaluate(() => {
    dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    const hiddenClassBeforeRestore = document.documentElement.classList.contains("acc-recovery-frozen");
    dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    let writeResult = "allowed";
    try { window.recoveryProduction.setItem("payment-operation:bfcache", "blocked"); } catch (error) { writeResult = error.message; }
    return { hiddenClassBeforeRestore, hiddenClassAfterRestore: document.documentElement.classList.contains("acc-recovery-frozen"), writeResult };
  });
  assert.deepEqual(frozenResult, { hiddenClassBeforeRestore: true, hiddenClassAfterRestore: true, writeResult: "recovery_bfcache_requires_reload" });
  await frozen.close();
  console.log("PASS production: persisted pagehide/pageshow synchronously freezes prior DOM and keeps recovery writes blocked");

  const bfcache = await browser.newContext();
  const bfcachePage = await openReady(bfcache);
  await bfcachePage.goto(origin + "/other");
  await bfcachePage.goBack();
  await bfcachePage.getByTestId("status").filter({ hasText: "ready" }).waitFor();
  const persisted = await bfcachePage.evaluate(() => window.wasPersisted === true);
  const afterBack = await bfcachePage.evaluate(() => { try { window.recoveryProduction.setItem("payment-operation:after-back", "probe"); return "allowed"; } catch (error) { return error.message; } });
  if (persisted) assert.equal(afterBack, "recovery_bfcache_requires_reload");
  else assert.equal(afterBack, "allowed");
  await bfcache.close();
  console.log(`PASS production: back navigation ${persisted ? "restored BFCache and stayed write-blocked" : "created a fresh coordinated document (BFCache not used)"}`);
  console.log("PASS production coordinator browser: actual module/worker, fictional actors, localhost only, no hosted requests");
} finally {
  await browser?.close();
  child.kill();
  await fs.writeFile(path.join(root, "test-results", "recovery-coordinator-production-browser-server.log"), logs);
}
