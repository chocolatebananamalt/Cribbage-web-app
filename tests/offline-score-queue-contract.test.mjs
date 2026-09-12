import test from "node:test";
import assert from "node:assert/strict";
import { canonicalOfflineSubmissionPayload, canDeleteOfflineQueueRecord, canQueueOfflineIntent, isOfflineQueueIntent, isOfflineQueueRecord, isOfflineReplayReceipt, isOfflineSubmissionCapability } from "../src/lib/offline-score-queue-contract.ts";

const digest = "a".repeat(64);
const submission = {
  version: 1, queueId: "queue-1", createdAtMs: 100, clientOperationId: "operation-1",
  verifiedActorId: "actor-1", sessionBindingId: "session-1", deviceKeyId: "device-key-1",
  tournamentId: "tournament-1", eventId: "event-1", gameId: "game-1", assignedSide: "a",
  expectedGameVersion: 3, capabilityId: "capability-1", capabilityExpiresAtMs: 1000,
  payloadDigest: digest, signature: "non-exportable-key-signature", kind: "submission",
  submissionId: "submission-1", submissionSlot: 1, winnerSide: "a", margin: 31,
};

test("offline queue intent has an exact, minimal immutable shape and no local verified state", () => {
  assert.equal(isOfflineQueueIntent(submission), true);
  assert.equal(isOfflineQueueIntent({ ...submission, playerName: "must not persist" }), false);
  assert.equal(isOfflineQueueIntent({ ...submission, margin: 122 }), false);
  assert.equal(isOfflineQueueRecord({ intent: submission, state: "Queued" }), true);
  assert.equal(isOfflineQueueRecord({ intent: submission, state: "Verified" }), false);
});

test("offline confirmation requires the server-issued matching challenge and an unexpired capability", () => {
  const confirmation = { ...submission, kind: "confirmation", matchedResultChallengeFingerprint: "b".repeat(64) };
  delete confirmation.submissionSlot; delete confirmation.winnerSide; delete confirmation.margin;
  assert.equal(isOfflineQueueIntent(confirmation), true);
  assert.equal(canQueueOfflineIntent(confirmation, 999), true);
  assert.equal(canQueueOfflineIntent(confirmation, 1000), false);
  assert.equal(isOfflineQueueIntent({ ...confirmation, matchedResultChallengeFingerprint: "client-only" }), false);
});

test("a queue record can only be deleted by an exact bound terminal receipt", () => {
  const record = { intent: submission, state: "PendingSync" };
  const receipt = { version: 1, queueId: "queue-1", clientOperationId: "operation-1", kind: "submission", gameId: "game-1", submissionId: "submission-1", payloadDigest: digest, disposition: "accepted" };
  assert.equal(canDeleteOfflineQueueRecord(record, receipt), true);
  assert.equal(canDeleteOfflineQueueRecord(record, { ...receipt, gameId: "other-game" }), false);
  assert.equal(canDeleteOfflineQueueRecord(record, { ...receipt, accessToken: "must not appear" }), false);
  assert.equal(canDeleteOfflineQueueRecord(record, { ...receipt, disposition: "verified" }), false);
});

test("canonical submission signing material is stable and excludes digest and signature", () => {
  const unsigned = { ...submission };
  delete unsigned.payloadDigest;
  delete unsigned.signature;
  const first = canonicalOfflineSubmissionPayload(unsigned);
  const second = canonicalOfflineSubmissionPayload({ ...unsigned });
  assert.equal(first, second);
  assert.doesNotMatch(first, /payloadDigest|signature|playerName|accessToken/);
  assert.match(first, /"margin":31/);
});

test("capabilities and receipts require exact minimal response shapes", () => {
  const capability = { status: "issued", version: 1, capabilityId: "capability-1", deviceKeyId: "device-1", verifiedActorId: "actor-1", sessionBindingId: "session-1", tournamentId: "tournament-1", eventId: "event-1", gameId: "game-1", assignedSide: "a", submissionSlot: 1, expectedGameVersion: 3, capabilityExpiresAtMs: 1000 };
  assert.equal(isOfflineSubmissionCapability(capability), true);
  assert.equal(isOfflineSubmissionCapability({ ...capability, accessToken: "forbidden" }), false);
  const receipt = { version: 1, queueId: "queue-1", clientOperationId: "operation-1", kind: "submission", gameId: "game-1", submissionId: "submission-1", payloadDigest: digest, disposition: "accepted" };
  assert.equal(isOfflineReplayReceipt(receipt), true);
  assert.equal(isOfflineReplayReceipt({ ...receipt, score: { status: "submitted" } }), false);
});

test("offline replay schema is private, immutable, and exposes only least-privilege RPCs", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(new URL("../database/migrations/0122_offline_submission_replay_foundation.sql", import.meta.url), "utf8");
  for (const table of ["offline_device_keys", "offline_score_capabilities", "offline_score_replay_receipts", "offline_score_replay_conflicts"]) {
    assert.match(sql, new RegExp(`create table app\\.${table}`));
    assert.match(sql, new RegExp(`alter table app\\.${table} force row level security`));
  }
  assert.match(sql, /event_schedule_games/);
  assert.match(sql, /coalesce\(auth\.role\(\),''\) <> 'service_role'/);
  assert.match(sql, /public_jwk - 'kty' - 'crv' - 'x' - 'y' - 'ext' - 'key_ops'/);
  assert.match(sql, /state in \('pending','submitted'\)/);
  assert.match(sql, /version not between p_expected_game_version and p_expected_game_version\+1/);
  assert.match(sql, /unique \(actor_profile_id, session_binding_id, canonical_game_id, operation_kind\)/);
  assert.match(sql, /unique \(capability_id\)/);
  assert.match(sql, /grant execute on function public\.issue_offline_submission_capability_v1[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.issue_offline_submission_capability_v1[\s\S]*to authenticated/);
  assert.match(sql, /record_offline_submission_rejection_v1/);
  assert.match(sql, /actor_profile_id=p_actor_id and client_operation_id=p_client_operation_id/);
  assert.match(sql, /grant execute on function public\.replay_offline_submission_v1[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.replay_offline_submission_v1[\s\S]*to authenticated/);
});

test("offline routes are same-origin, claim-bound, signed, bounded, and keep the secret client server-only", async () => {
  const { readFile } = await import("node:fs/promises");
  const capability = await readFile(new URL("../src/app/api/v1/games/[id]/offline-capability/route.ts", import.meta.url), "utf8");
  const replay = await readFile(new URL("../src/app/api/v1/offline-score-replay/route.ts", import.meta.url), "utf8");
  for (const route of [capability, replay]) { assert.match(route, /isSameOriginRequest/); assert.match(route, /readSmallJson/); assert.match(route, /apiJson/); }
  assert.match(capability, /requireVerifiedIdentity/);
  assert.match(capability, /createServerOnlyAdminClient/);
  assert.match(replay, /requireVerifiedIdentity/);
  assert.match(replay, /crypto\.subtle\.verify/);
  assert.match(replay, /createServerOnlyAdminClient/);
  assert.match(replay, /raw\.verifiedActorId !== identity\.subject/);
  assert.match(replay, /const replaySessionId = raw\.sessionBindingId/);
  assert.doesNotMatch(replay, /raw\.sessionBindingId !== identity\.sessionId/);
});

test("offline score pages are explicitly prepared, narrowly cached, reusable after reload, and cleared on shared-device signout", async () => {
  const { readFile } = await import("node:fs/promises");
  const [worker, pageCache, queue, entry, gamePage, gameError, callback, blockedPage, config, proxy] = await Promise.all([
    readFile(new URL("../public/offline-score-sw.js", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/offline-score-page-cache.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/offline-score-queue.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/tournament/[tournamentId]/game/[gameId]/score-entry.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/tournament/[tournamentId]/game/[gameId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/tournament/[tournamentId]/game/[gameId]/error.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/auth/callback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/auth/offline-data-blocked/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/proxy.ts", import.meta.url), "utf8"),
  ]);

  assert.match(worker, /request\.method !== "GET"/);
  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.match(worker, /request\.mode === "navigate" \? url\.pathname\.match\(GAME_PATH\)/);
  assert.match(worker, /network\.status >= 500/);
  assert.match(worker, /!network\.redirected/);
  assert.match(worker, /validCachedGame/);
  assert.match(worker, /x-acc-offline-expires-at/);
  assert.match(worker, /cache\.match\(request\)/);
  assert.match(worker, /status: 503/);
  assert.doesNotMatch(worker, /\/api\/v1/);

  assert.match(pageCache, /register\("\/offline-score-sw\.js"/);
  assert.match(pageCache, /updateViaCache: "none"/);
  assert.match(pageCache, /withTimeout/);
  assert.match(pageCache, /credentials: "same-origin"/);
  assert.match(pageCache, /cache: "no-store"/);
  assert.match(pageCache, /redirect: "error"/);
  assert.match(pageCache, /pageResponse\.url !== pageRequest\.url/);
  assert.match(pageCache, /data-offline-score-binding/);
  assert.match(pageCache, /url\.origin === window\.location\.origin/);
  assert.match(pageCache, /url\.pathname\.startsWith\("\/_next\/static\/"\)/);
  assert.match(pageCache, /cache\.put\(pageRequest/);
  assert.match(pageCache, /offlineScoreCachePrefix/);
  assert.match(pageCache, /caches\.delete\(cacheName\)/);
  assert.match(pageCache, /acc_offline_score_owner/);
  assert.match(pageCache, /SameSite=Lax/);
  assert.match(pageCache, /markOfflineScoreOwner\(actorId\)/);

  assert.match(queue, /readPreparedOfflineSubmissionCapability/);
  assert.match(queue, /capabilityExpiresAtMs <= now/);
  assert.match(queue, /device\.serverDeviceKeyId !== stored\.value\.deviceKeyId/);
  assert.match(queue, /await clearOfflineScorePageCache\(\)/);
  assert.ok(queue.indexOf("markOfflineScoreOwner(capability.verifiedActorId)") < queue.indexOf("await writeOne(queueStore, record)"));
  assert.match(entry, /readPreparedOfflineSubmissionCapability\(context\.actorId, context\.gameId\)/);
  assert.match(entry, /void prepareCurrentScorePageForOffline/);
  assert.match(entry, /Offline Ready/);
  assert.match(gamePage, /data-offline-score-binding/);
  assert.match(gamePage, /throw new Error\("game_workspace_temporarily_unavailable"\)/);
  assert.match(gameError, /Game workspace temporarily unavailable/);
  assert.match(gameError, /onClick=\{reset\}/);
  assert.match(callback, /request\.cookies\.get\("acc_offline_score_owner"\)/);
  assert.match(callback, /canAcceptOfflineOwnerSession\(offlineOwner, data\.user\?\.id\)/);
  assert.ok(callback.indexOf("exchangeCodeForSession") < callback.indexOf("canAcceptOfflineOwnerSession(offlineOwner"));
  assert.match(blockedPage, /different-account sign-in was not completed/);
  assert.match(blockedPage, /SharedDeviceSignOut/);
  assert.match(config, /source: "\/offline-score-sw\.js"/);
  assert.match(config, /Service-Worker-Allowed/);
  assert.match(proxy, /"\/offline-score-sw\.js"/);
});

test("offline navigation falls back only for network and transient server failures", async () => {
  const { readFile } = await import("node:fs/promises");
  const { runInNewContext } = await import("node:vm");
  const source = await readFile(new URL("../public/offline-score-sw.js", import.meta.url), "utf8");
  const handlers = {};
  const stored = new Map();
  let networkResult = new Response("server", { status: 500 });
  const cache = { match: async (request) => stored.get(request.url)?.clone() ?? null };
  const context = {
    URL, Response, Date,
    caches: { open: async () => cache, keys: async () => [], delete: async () => true },
    fetch: async () => {
      if (networkResult instanceof Error) throw networkResult;
      return networkResult;
    },
    self: {
      location: { origin: "https://example.test" }, clients: { claim: async () => undefined }, skipWaiting: async () => undefined,
      addEventListener: (name, handler) => { handlers[name] = handler; },
    },
  };
  runInNewContext(source, context);
  const url = "https://example.test/tournament/11111111-1111-4111-8111-111111111111/game/22222222-2222-4222-8222-222222222222";
  const request = { method: "GET", mode: "navigate", url };
  stored.set(url, new Response("cached", { headers: { "x-acc-offline-expires-at": String(Date.now() + 60_000) } }));
  const respond = async () => {
    let responsePromise;
    handlers.fetch({ request, respondWith: (value) => { responsePromise = value; } });
    return await responsePromise;
  };
  assert.equal(await (await respond()).text(), "cached", "5xx must use an unexpired prepared page");
  networkResult = new Response("unauthorized", { status: 401 });
  assert.equal((await respond()).status, 401, "authorization failures must never use cached private HTML");
  networkResult = new Error("offline");
  assert.equal(await (await respond()).text(), "cached", "network failure must use an unexpired prepared page");
  stored.set(url, new Response("expired", { headers: { "x-acc-offline-expires-at": String(Date.now() - 1) } }));
  assert.equal((await respond()).status, 503, "expired private pages must fail closed");
  let apiResponse;
  handlers.fetch({ request: { method: "POST", mode: "cors", url: "https://example.test/api/v1/offline-score-replay" }, respondWith: (value) => { apiResponse = value; } });
  assert.equal(apiResponse, undefined, "the worker must never intercept score mutations");
});

test("offline owner marker allows same-player reauthentication but blocks account replacement", async () => {
  const { canAcceptOfflineOwnerSession } = await import("../src/lib/auth/offline-account-switch.ts");
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";
  assert.equal(canAcceptOfflineOwnerSession(undefined, second), true);
  assert.equal(canAcceptOfflineOwnerSession(first, first), true);
  assert.equal(canAcceptOfflineOwnerSession(first, second), false);
  assert.equal(canAcceptOfflineOwnerSession("malformed", first), false);
  assert.equal(canAcceptOfflineOwnerSession(first, undefined), false);
});
