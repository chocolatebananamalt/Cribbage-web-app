"use client";

import {
  canonicalOfflineSubmissionPayload,
  isOfflineQueueRecord,
  isOfflineSubmissionCapability,
  type OfflineQueueRecord,
  type OfflineSubmissionCapability,
  type UnsignedOfflineSubmission,
} from "./offline-score-queue-contract";

const databaseName = "acc-offline-score-v1";
const queueStore = "queue";
const keyStore = "keys";
const capabilityStore = "capabilities";

type StoredDeviceKey = { id: string; actorId: string; gameId: string; privateKey: CryptoKey; publicJwk: JsonWebKey };
type StoredCapability = { id: string; actorId: string; gameId: string; value: OfflineSubmissionCapability };

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(queueStore)) db.createObjectStore(queueStore, { keyPath: "intent.queueId" });
      if (!db.objectStoreNames.contains(keyStore)) db.createObjectStore(keyStore, { keyPath: "id" });
      if (!db.objectStoreNames.contains(capabilityStore)) db.createObjectStore(capabilityStore, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("offline_storage_unavailable"));
  });
}

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("offline_storage_unavailable"));
  });
}

async function readOne<T>(store: string, id: string) {
  const db = await openDatabase();
  try { return await requestValue(db.transaction(store, "readonly").objectStore(store).get(id)) as T | undefined; }
  finally { db.close(); }
}

async function writeOne(store: string, value: unknown) {
  const db = await openDatabase();
  try {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error ?? new Error("offline_storage_unavailable")); });
  } finally { db.close(); }
}

async function removeOne(store: string, id: string) {
  const db = await openDatabase();
  try {
    const tx = db.transaction(store, "readwrite"); tx.objectStore(store).delete(id);
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error ?? new Error("offline_storage_unavailable")); });
  } finally { db.close(); }
}

const keyId = (actorId: string, gameId: string) => `${actorId}:${gameId}`;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ""; bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function hex(bytes: Uint8Array) { return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join(""); }

async function createDeviceKey(actorId: string, gameId: string): Promise<StoredDeviceKey> {
  const generated = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", generated.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", generated.privateKey);
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const value = { id: keyId(actorId, gameId), actorId, gameId, privateKey, publicJwk };
  await writeOne(keyStore, value);
  return value;
}

async function getDeviceKey(actorId: string, gameId: string) {
  return await readOne<StoredDeviceKey>(keyStore, keyId(actorId, gameId)) ?? createDeviceKey(actorId, gameId);
}

export async function provisionOfflineSubmission(actorId: string, gameId: string) {
  const id = keyId(actorId, gameId);
  const existing = await readOne<StoredCapability>(capabilityStore, id);
  let device = await getDeviceKey(actorId, gameId);
  const issue = async (capabilityId: string, deviceKeyId: string) => fetch(`/api/v1/games/${gameId}/offline-capability`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ capabilityId, deviceKeyId, publicJwk: device.publicJwk }),
  });
  let response = existing && isOfflineSubmissionCapability(existing.value) && existing.value.capabilityExpiresAtMs > Date.now() + 60_000
    ? await issue(existing.value.capabilityId, existing.value.deviceKeyId)
    : await issue(crypto.randomUUID(), crypto.randomUUID());
  if (response.status === 409) { device = await createDeviceKey(actorId, gameId); response = await issue(crypto.randomUUID(), crypto.randomUUID()); }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isOfflineSubmissionCapability(payload) || payload.verifiedActorId !== actorId || payload.gameId !== gameId) throw new Error("offline_capability_unavailable");
  await writeOne(keyStore, { ...device, id, serverDeviceKeyId: payload.deviceKeyId });
  await writeOne(capabilityStore, { id, actorId, gameId, value: payload });
  return payload;
}

export async function queueOfflineSubmission(capability: OfflineSubmissionCapability, winnerSide: "a" | "b", margin: number) {
  const device = await readOne<StoredDeviceKey>(keyStore, keyId(capability.verifiedActorId, capability.gameId));
  if (!device) throw new Error("offline_device_key_unavailable");
  const unsigned: UnsignedOfflineSubmission = {
    version: 1, queueId: crypto.randomUUID(), createdAtMs: Date.now(), clientOperationId: crypto.randomUUID(),
    verifiedActorId: capability.verifiedActorId, sessionBindingId: capability.sessionBindingId,
    deviceKeyId: capability.deviceKeyId, tournamentId: capability.tournamentId,
    eventId: capability.eventId, gameId: capability.gameId, assignedSide: capability.assignedSide,
    expectedGameVersion: capability.expectedGameVersion, capabilityId: capability.capabilityId,
    capabilityExpiresAtMs: capability.capabilityExpiresAtMs, kind: "submission",
    submissionId: crypto.randomUUID(), submissionSlot: capability.submissionSlot, winnerSide, margin,
  };
  const encoded = new TextEncoder().encode(canonicalOfflineSubmissionPayload(unsigned));
  const payloadDigest = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoded)));
  const signature = bytesToBase64Url(new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, device.privateKey, encoded)));
  const record: OfflineQueueRecord = { intent: { ...unsigned, payloadDigest, signature }, state: "Queued" };
  await writeOne(queueStore, record);
  return record;
}

export async function readOfflineSubmission(actorId: string, gameId: string) {
  const db = await openDatabase();
  try {
    const values = await requestValue(db.transaction(queueStore, "readonly").objectStore(queueStore).getAll());
    return (values as unknown[]).find((value): value is OfflineQueueRecord => isOfflineQueueRecord(value)
      && value.intent.kind === "submission" && value.intent.verifiedActorId === actorId && value.intent.gameId === gameId);
  } finally { db.close(); }
}

export async function replayOfflineSubmission(record: OfflineQueueRecord) {
  const response = await fetch("/api/v1/offline-score-replay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(record.intent) });
  const payload: unknown = await response.json().catch(() => null);
  return { response, payload };
}

export async function deleteOfflineSubmission(queueId: string) { await removeOne(queueStore, queueId); }

export async function countOfflineSubmissions() {
  const db = await openDatabase();
  try { return await requestValue(db.transaction(queueStore, "readonly").objectStore(queueStore).count()); }
  finally { db.close(); }
}

export async function clearOfflineScoreStorage() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve(); request.onblocked = () => reject(new Error("offline_storage_blocked"));
    request.onerror = () => reject(request.error ?? new Error("offline_storage_unavailable"));
  });
}
