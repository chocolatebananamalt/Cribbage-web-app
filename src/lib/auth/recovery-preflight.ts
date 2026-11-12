"use client";
import { countAppSessionStorageRecords } from "../client-session-storage";
import { countOfflineSubmissions } from "../offline-score-queue";
import { offlineScoreCachePrefix } from "../offline-score-page-cache";
import { markUnknownRecoveryOwner, readRecoveryOwnerMarkers } from "./recovery-owner";

/** Inspect counts/names only; never infer the owner of legacy values. */
export async function protectUnownedRecovery() {
  const offline = await countOfflineSubmissions();
  const retries = countAppSessionStorageRecords(sessionStorage);
  const cached = "caches" in window && (await caches.keys()).some(name => name.startsWith(offlineScoreCachePrefix) || name === "acc-offline-score-pages-v1");
  if ((offline || retries || cached) && !readRecoveryOwnerMarkers().length) markUnknownRecoveryOwner();
}
