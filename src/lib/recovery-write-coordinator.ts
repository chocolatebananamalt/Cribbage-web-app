"use client";

import {
  assertRecoveryStorageOwner,
  claimRecoveryStorageOwner,
  markUnknownRecoveryOwner,
  readRecoveryOwnerMarkers,
} from "./auth/recovery-owner.ts";
import { isAppRecoveryStorageKey } from "./client-session-storage.ts";
import { createRecoveryCoordinationState, trackRecoveryWriter } from "./recovery-coordination-state.ts";
import { recoveryStage } from "./recovery-diagnostic.ts";

const recoveryProtocolVersion = "acc-recovery-coordination-v2";
const recoveryDocumentLock = "acc-recovery-document-v2";
const recoveryWorkerPath = "/offline-score-sw.js";
const state = createRecoveryCoordinationState();

let actorId: string | null = null;
let actorInitialized = false;
let actorReadyResolve: (() => void) | null = null;
const actorReady = new Promise<void>((resolve) => { actorReadyResolve = resolve; });
let acquisition: Promise<void> | null = null;
let sharedRequest: Promise<void> | null = null;
let releaseShared: (() => void) | null = null;
let exclusiveRequest: Promise<void> | null = null;
let releaseExclusive: (() => void) | null = null;
let switchRequest: Promise<void> | null = null;
let blockedReason: string | null = null;
let expectedControllerChange = false;
let workerSetup: Promise<void> | null = null;
let workerPrepared = false;

function workerScriptUrl() {
  return window.location.origin + recoveryWorkerPath;
}

function currentController() {
  return navigator.serviceWorker.controller;
}

function assertCurrentController(expected: ServiceWorker | null): asserts expected is ServiceWorker {
  const current = currentController();
  if (!expected || current !== expected || current.state !== "activated" || current.scriptURL !== workerScriptUrl()) {
    throw new Error("recovery_controller_changed_or_unknown");
  }
}

async function ensureRecoveryWorker() {
  if (workerPrepared) return;
  if (workerSetup) return workerSetup;
  workerSetup = (async () => {
    expectedControllerChange = true;
    try {
      const registration = await recoveryStage("worker-register", () => navigator.serviceWorker.register(recoveryWorkerPath, { scope: "/", updateViaCache: "none" }));
      await recoveryStage("worker-update", () => registration.update());
      await recoveryStage("worker-ready", () => navigator.serviceWorker.ready);
      if (!currentController()) {
        await recoveryStage("controller", () => new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => reject(new Error("recovery_controller_unavailable")), 4000);
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            window.clearTimeout(timer);
            resolve();
          }, { once: true });
        }));
      }
      workerPrepared = true;
    } finally {
      expectedControllerChange = false;
    }
  })();
  try {
    await workerSetup;
  } finally {
    workerSetup = null;
  }
}

async function verifyControllerProtocol() {
  const expected = currentController();
  assertCurrentController(expected);
  const channel = new MessageChannel();
  const requestId = crypto.randomUUID();
  const response = new Promise<unknown>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error("recovery_protocol_unavailable"));
    }, 750);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer);
      channel.port1.close();
      resolve(event.data);
    };
  });
  expected.postMessage({ kind: "acc-recovery-protocol-probe-v2", version: recoveryProtocolVersion, requestId }, [channel.port2]);
  const result = await response;
  assertCurrentController(expected);
  if (!result || typeof result !== "object" ||
      !("kind" in result) || result.kind !== "acc-recovery-protocol-ready-v2" ||
      !("version" in result) || result.version !== recoveryProtocolVersion ||
      !("requestId" in result) || result.requestId !== requestId ||
      !("workerScriptURL" in result) || result.workerScriptURL !== workerScriptUrl()) {
    throw new Error("recovery_protocol_unavailable");
  }
  return expected;
}

async function inventoryWindows() {
  const expected = await verifyControllerProtocol();
  const channel = new MessageChannel();
  const requestId = crypto.randomUUID();
  const response = new Promise<unknown>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error("recovery_inventory_unavailable"));
    }, 2500);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer);
      channel.port1.close();
      resolve(event.data);
    };
  });
  expected.postMessage({ kind: "acc-recovery-window-inventory-v2", version: recoveryProtocolVersion, requestId }, [channel.port2]);
  const result = await response;
  assertCurrentController(expected);
  if (!result || typeof result !== "object" ||
      !("kind" in result) || result.kind !== "acc-recovery-window-inventory-v2" ||
      !("version" in result) || result.version !== recoveryProtocolVersion ||
      !("requestId" in result) || result.requestId !== requestId ||
      !("status" in result) || result.status !== "ok" ||
      !("otherWindows" in result) || !Number.isSafeInteger(result.otherWindows) || Number(result.otherWindows) < 0 ||
      !("leaseReadyOther" in result) || !Number.isSafeInteger(result.leaseReadyOther) || Number(result.leaseReadyOther) < 0 ||
      !("legacyOther" in result) || !Number.isSafeInteger(result.legacyOther) || Number(result.legacyOther) < 0 ||
      Number(result.otherWindows) !== Number(result.leaseReadyOther) + Number(result.legacyOther)) {
    throw new Error("recovery_inventory_unavailable");
  }
  return Number(result.otherWindows);
}

async function acquireSharedLock() {
  if (releaseShared) return;
  const expected = await recoveryStage("protocol", () => verifyControllerProtocol());
  let resolveAcquired!: () => void;
  let rejectAcquired!: (error: unknown) => void;
  const acquired = new Promise<void>((resolve, reject) => { resolveAcquired = resolve; rejectAcquired = reject; });
  sharedRequest = navigator.locks.request(recoveryDocumentLock, { mode: "shared" }, async (lock) => {
    if (!lock) throw new Error("recovery_document_lease_unavailable");
    assertCurrentController(expected);
    state.ready();
    resolveAcquired();
    await new Promise<void>((resolve) => { releaseShared = resolve; });
    releaseShared = null;
  });
  void sharedRequest.catch(rejectAcquired);
  await acquired;
}

async function releaseSharedLock() {
  const request = sharedRequest;
  const release = releaseShared;
  releaseShared = null;
  release?.();
  if (request) await request;
  sharedRequest = null;
}

async function reacquireAfterRejectedSwitch() {
  state.reacquiring();
  try {
    await acquireSharedLock();
  } catch (error) {
    blockedReason = "recovery_reacquire_failed";
    throw error;
  }
}

/** The navigation worker can still own its bridge after this document's
 * shared lease is ready. Keep our lease while that handshake drains; never
 * interpret a timeout or incomplete lock snapshot as permission to clear. */
async function waitForNavigationLeaseDrain() {
  const deadline = performance.now() + 12_000;
  let settledSamples = 0;
  while (performance.now() < deadline) {
    if (blockedReason || !releaseShared) throw new Error("recovery_coordination_unavailable");
    await verifyControllerProtocol();
    const snapshot = await navigator.locks.query();
    const held = snapshot.held?.filter(lock => lock.name === recoveryDocumentLock);
    const pending = snapshot.pending?.filter(lock => lock.name === recoveryDocumentLock);
    if (!held || !pending) throw new Error("recovery_lock_inventory_unavailable");
    settledSamples = held.length === 1 && held[0].mode === "shared" && pending.length === 0 ? settledSamples + 1 : 0;
    if (settledSamples === 2) return;
    await new Promise<void>(resolve => window.setTimeout(resolve, 50));
  }
  throw new Error("recovery_navigation_lease_pending");
}

async function revalidateHeldExclusive() {
  if (blockedReason) throw new Error(blockedReason);
  if (!releaseExclusive) throw new Error("recovery_coordination_unavailable");
  await verifyControllerProtocol();
  if (await inventoryWindows() !== 0) throw new Error("other_tournament_tabs_or_unknown_inventory");
}

function assertActorOwner() {
  if (!actorId) throw new Error("recovery_owner_unknown");
  assertRecoveryStorageOwner(actorId);
}

function assertCoordinationWriteAllowed() {
  if (blockedReason) throw new Error(blockedReason);
  state.assertWriteAllowed();
}

function assertRecoveryValueCanBeStored(storage: Storage, key: string, value: string) {
  const existing = storage.getItem(key);
  if (existing !== null && existing !== value) throw new Error("recovery_record_conflict");
}

export async function acquireRecoveryDocument(nextActorId: string | null): Promise<void> {
  await recoveryStage("capability", () => { if (!navigator.locks || !navigator.serviceWorker) throw new Error("recovery_coordination_unavailable"); });
  await ensureRecoveryWorker();
  await recoveryStage("controller", () => { if (blockedReason) throw new Error(blockedReason); });
  actorId = nextActorId;
  if (!actorInitialized) {
    actorInitialized = true;
    actorReadyResolve?.();
    actorReadyResolve = null;
  }
  if (releaseShared || releaseExclusive) {
    await recoveryStage("protocol", () => verifyControllerProtocol());
    return;
  }
  if (!acquisition) {
    acquisition = recoveryStage("document-lease", () => acquireSharedLock()).catch((error) => {
      blockedReason = error instanceof Error ? error.message : "recovery_coordination_unavailable";
      throw error;
    }).finally(() => { acquisition = null; });
  }
  await acquisition;
}

export function assertRecoveryWriteAllowed() {
  assertCoordinationWriteAllowed();
  assertActorOwner();
}

export function setAppRecoveryItem(storage: Storage, key: string, value: string) {
  assertRecoveryWriteAllowed();
  if (!isAppRecoveryStorageKey(key)) throw new Error("recovery_storage_key_unsupported");
  assertRecoveryValueCanBeStored(storage, key, value);
  claimRecoveryStorageOwner(actorId);
  storage.setItem(key, value);
}

export function setPublicCheckInRecoveryItem(storage: Storage, key: string, value: string) {
  if (key !== "acc:event-check-in:completion") throw new Error("recovery_storage_key_unsupported");
  if (actorId) {
    setAppRecoveryItem(storage, key, value);
    return;
  }
  assertCoordinationWriteAllowed();
  assertRecoveryValueCanBeStored(storage, key, value);
  const before = readRecoveryOwnerMarkers();
  if (before.some(marker => marker !== "unknown")) throw new Error("recovery_owner_conflict");
  if (!before.length) markUnknownRecoveryOwner();
  const after = readRecoveryOwnerMarkers();
  if (!after.length || after.some(marker => marker !== "unknown")) throw new Error("recovery_owner_conflict");
  storage.setItem(key, value);
}

export async function trackAppRecoveryWrite<T>(operation: () => Promise<T>): Promise<T> {
  assertRecoveryWriteAllowed();
  claimRecoveryStorageOwner(actorId);
  return trackRecoveryWriter(state, operation);
}

export async function beginSafeRecoverySwitch(): Promise<void> {
  if (releaseExclusive) return revalidateHeldExclusive();
  if (switchRequest) return switchRequest;
  switchRequest = (async () => {
    await state.drain();
    try {
      if (await inventoryWindows() !== 0) throw new Error("other_tournament_tabs_or_unknown_inventory");
      await waitForNavigationLeaseDrain();
    } catch (error) {
      if (error instanceof Error && error.message === "other_tournament_tabs_or_unknown_inventory") {
        state.reacquiring();
        state.ready();
      } else {
        blockedReason = error instanceof Error ? error.message : "recovery_inventory_unavailable";
      }
      throw error;
    }
    await releaseSharedLock();
    let resolveAcquired!: (acquired: boolean) => void;
    let rejectAcquired!: (error: unknown) => void;
    const acquired = new Promise<boolean>((resolve, reject) => { resolveAcquired = resolve; rejectAcquired = reject; });
    exclusiveRequest = navigator.locks.request(recoveryDocumentLock, { mode: "exclusive", ifAvailable: true }, async (lock) => {
      if (!lock) { resolveAcquired(false); return; }
      state.exclusive();
      resolveAcquired(true);
      await new Promise<void>((resolve) => { releaseExclusive = resolve; });
      releaseExclusive = null;
    });
    void exclusiveRequest.catch(rejectAcquired);
    let hasExclusive: boolean;
    try {
      hasExclusive = await acquired;
    } catch (error) {
      exclusiveRequest = null;
      await reacquireAfterRejectedSwitch();
      throw error;
    }
    if (!hasExclusive) {
      await exclusiveRequest;
      exclusiveRequest = null;
      await reacquireAfterRejectedSwitch();
      throw new Error("other_tournament_tabs_or_unknown_inventory");
    }
    await revalidateHeldExclusive();
  })().finally(() => { switchRequest = null; });
  return switchRequest;
}

export async function cancelSafeRecoverySwitch(): Promise<void> {
  if (state.snapshot().destructiveStarted) throw new Error("recovery_destructive_step_started");
  if (!releaseExclusive) return;
  const release = releaseExclusive;
  const request = exclusiveRequest;
  releaseExclusive = null;
  release();
  if (request) await request;
  exclusiveRequest = null;
  await reacquireAfterRejectedSwitch();
}

export async function markRecoveryCleanupStarted(): Promise<void> {
  await revalidateHeldExclusive();
  if (blockedReason) throw new Error(blockedReason);
  if (!releaseExclusive || (state.snapshot().phase !== "exclusive" && state.snapshot().phase !== "partial-failure")) {
    throw new Error("recovery_coordination_unavailable");
  }
  if (!state.snapshot().destructiveStarted) state.destructiveStep();
}

export async function beginRecoveryCleanup(): Promise<void> {
  await markRecoveryCleanupStarted();
}

export async function resumeRecoveryAfterRejectedAuth(): Promise<void> {
  if (!releaseExclusive) throw new Error("recovery_coordination_unavailable");
  await revalidateHeldExclusive();
}

export function failSafeRecoverySwitch() {
  if (!releaseExclusive) return;
  state.fail();
}

export function finishSafeRecoverySwitch() {
  if (blockedReason) throw new Error(blockedReason);
  if (!releaseExclusive || !state.snapshot().destructiveStarted) throw new Error("recovery_invalid_transition");
  state.signedOut();
  const release = releaseExclusive;
  releaseExclusive = null;
  release();
}

export function finishRecoveryAuthentication() {
  if (blockedReason) throw new Error(blockedReason);
  if (!releaseExclusive || state.snapshot().destructiveStarted) throw new Error("recovery_invalid_transition");
  state.authenticated();
  const release = releaseExclusive;
  releaseExclusive = null;
  release();
}

export function finishPreservingRecoverySignOut() {
  if (blockedReason) throw new Error(blockedReason);
  if (!releaseExclusive || state.snapshot().destructiveStarted) throw new Error("recovery_invalid_transition");
  state.sessionEnded();
  const release = releaseExclusive;
  releaseExclusive = null;
  release();
}

if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!expectedControllerChange) blockedReason = "recovery_controller_changed_or_unknown";
  });
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data;
    const port = event.ports[0];
    if (!data || !port) return;
    if (data.kind === "acc-recovery-navigation-lease-v2") {
      void (async () => {
        const expected = currentController();
        if (event.source !== expected || data.version !== recoveryProtocolVersion || data.workerScriptURL !== workerScriptUrl()) return;
        try {
          await actorReady;
          await acquireRecoveryDocument(actorId);
          assertCurrentController(expected);
          port.postMessage({
            kind: "acc-recovery-navigation-lease-ready-v2",
            version: recoveryProtocolVersion,
            bridgeId: data.bridgeId,
            controllerScriptURL: expected.scriptURL,
          });
        } catch {
          // The worker's bounded bridge remains held and then treats this page as legacy.
        }
      })();
      return;
    }
    if (data.kind === "acc-recovery-lease-challenge-v2") {
      const current = currentController();
      if (event.source !== current || data.version !== recoveryProtocolVersion || !current || current.scriptURL !== workerScriptUrl()) return;
      port.postMessage({
        kind: "acc-recovery-lease-status-v2",
        version: recoveryProtocolVersion,
        requestId: data.requestId,
        state: !blockedReason && releaseShared && state.snapshot().phase === "ready" ? "lease_ready" : "blocked",
        controllerScriptURL: current.scriptURL,
      });
    }
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (actorInitialized) document.documentElement.classList.add("acc-recovery-frozen");
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      document.documentElement.classList.add("acc-recovery-frozen");
      blockedReason = "recovery_bfcache_requires_reload";
    }
  });
}
