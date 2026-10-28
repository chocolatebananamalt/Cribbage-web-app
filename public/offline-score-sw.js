const OFFLINE_SCORE_CACHE_PREFIX = "acc-offline-score-pages-v2:";
const GAME_PATH = /^\/tournament\/[0-9a-f-]{36}\/game\/([0-9a-f-]{36})\/?$/i;
const RECOVERY_PROTOCOL_VERSION = "acc-recovery-coordination-v2";
const RECOVERY_DOCUMENT_LOCK = "acc-recovery-document-v2";
const RECOVERY_WORKER_PATH = "/offline-score-sw.js";

const recoveryDelay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function recoveryClient(clientId) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const client = clientId ? await self.clients.get(clientId) : null;
    if (client) return client;
    await recoveryDelay(50);
  }
  return null;
}

async function bridgeRecoveryNavigation(clientId, bridgeId) {
  const client = await recoveryClient(clientId);
  if (!client) throw new Error("recovery_bridge_client_unavailable");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    // A closed destination no longer needs a navigation lease. Never keep its
    // bridge alive solely because an earlier Client object was retained.
    if (!await self.clients.get(clientId)) return;
    const channel = new MessageChannel();
    const reply = new Promise((resolve) => {
      const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 2500);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(event.data);
      };
    });
    client.postMessage({
      kind: "acc-recovery-navigation-lease-v2",
      version: RECOVERY_PROTOCOL_VERSION,
      bridgeId,
      workerScriptURL: self.location.origin + RECOVERY_WORKER_PATH,
    }, [channel.port2]);
    const message = await reply;
    if (message?.kind === "acc-recovery-navigation-lease-ready-v2" &&
        message.version === RECOVERY_PROTOCOL_VERSION && message.bridgeId === bridgeId &&
        message.controllerScriptURL === self.location.origin + RECOVERY_WORKER_PATH) return;
  }
  throw new Error("recovery_bridge_ack_unavailable");
}

async function recoveryClientHasLease(client) {
  const requestId = crypto.randomUUID();
  const channel = new MessageChannel();
  const reply = new Promise((resolve) => {
    const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 350);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data);
    };
  });
  client.postMessage({ kind: "acc-recovery-lease-challenge-v2", version: RECOVERY_PROTOCOL_VERSION, requestId }, [channel.port2]);
  const message = await reply;
  return message?.kind === "acc-recovery-lease-status-v2" && message.version === RECOVERY_PROTOCOL_VERSION &&
    message.requestId === requestId && message.state === "lease_ready" &&
    message.controllerScriptURL === self.location.origin + RECOVERY_WORKER_PATH;
}

function respondWithRecoveryNavigationLease(event, operation) {
  if (!self.navigator?.locks) {
    event.respondWith(Promise.resolve(new Response("Recovery coordination is unavailable.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    })));
    return;
  }
  let resolveResponse;
  let rejectResponse;
  const response = new Promise((resolve, reject) => { resolveResponse = resolve; rejectResponse = reject; });
  const bridgeId = crypto.randomUUID();
  const lease = self.navigator.locks.request(RECOVERY_DOCUMENT_LOCK, { mode: "shared" }, async () => {
    try {
      resolveResponse(await operation());
      await bridgeRecoveryNavigation(event.resultingClientId, bridgeId);
    } catch (error) {
      rejectResponse(error);
      throw error;
    }
  });
  void lease.catch(rejectResponse);
  event.respondWith(response);
  event.waitUntil(lease);
}

self.addEventListener("message", (event) => {
  const data = event.data;
  const port = event.ports[0];
  if (!data || !port || !event.source?.id) return;
  if (data.kind === "acc-recovery-protocol-probe-v2") {
    port.postMessage({
      kind: "acc-recovery-protocol-ready-v2",
      version: RECOVERY_PROTOCOL_VERSION,
      requestId: data.requestId,
      workerScriptURL: self.location.origin + RECOVERY_WORKER_PATH,
    });
    return;
  }
  if (data.kind !== "acc-recovery-window-inventory-v2") return;
  event.waitUntil((async () => {
    if (data.version !== RECOVERY_PROTOCOL_VERSION) {
      port.postMessage({ kind: data.kind, version: RECOVERY_PROTOCOL_VERSION, requestId: data.requestId, status: "unsupported_version" });
      return;
    }
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (!windows.some((client) => client.id === event.source.id)) {
      port.postMessage({ kind: data.kind, version: RECOVERY_PROTOCOL_VERSION, requestId: data.requestId, status: "unknown_requester" });
      return;
    }
    const others = windows.filter((client) => client.id !== event.source.id);
    const statuses = await Promise.all(others.map(recoveryClientHasLease));
    const leaseReadyOther = statuses.filter(Boolean).length;
    port.postMessage({
      kind: data.kind,
      version: RECOVERY_PROTOCOL_VERSION,
      requestId: data.requestId,
      status: "ok",
      otherWindows: others.length,
      leaseReadyOther,
      legacyOther: others.length - leaseReadyOther,
    });
  })());
});

const cacheNameForGame = (gameId) => `${OFFLINE_SCORE_CACHE_PREFIX}${gameId.toLowerCase()}`;

async function validCachedGame(request, gameId) {
  const cache = await caches.open(cacheNameForGame(gameId));
  const response = await cache.match(request);
  if (!response) return null;
  const expiresAt = Number(response.headers.get("x-acc-offline-expires-at"));
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await caches.delete(cacheNameForGame(gameId));
    return null;
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name === "acc-offline-score-pages-v1").map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const gameMatch = request.mode === "navigate" ? url.pathname.match(GAME_PATH) : null;
  if (gameMatch) {
    respondWithRecoveryNavigationLease(event, async () => {
      try {
        const network = await fetch(request);
        if (!network.redirected && network.status >= 500) {
          return await validCachedGame(request, gameMatch[1]) ?? network;
        }
        return network;
      } catch {
        return await validCachedGame(request, gameMatch[1]) ?? new Response(
          "This game was not prepared for offline use. Reconnect, open the game, and wait for Offline Ready before disconnecting.",
          { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } },
        );
      }
    });
    return;
  }

  if (request.mode === "navigate") {
    respondWithRecoveryNavigationLease(event, () => fetch(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      // This MUST try the network first. Serving a cached build asset whenever
      // one exists looks harmless because these paths are conventionally
      // immutable, but this app's build id is the literal string "immutable",
      // so /_next/static/immutable/chunks/<name>.js is the SAME URL in every
      // deploy. Cache-first therefore pinned a device to the JavaScript of
      // whichever build first prepared a game for offline use, forever.
      //
      // The page still rendered, because the HTML is server-rendered fresh on
      // every request and is not cached here. Fresh HTML against stale chunks
      // fails hydration, React never attaches its handlers, and the result is a
      // page that looks completely normal and ignores every click and
      // keystroke. Observed 2026-09-18 on two separate directors' devices right
      // after a deploy: neither could type into Create Tournament, while a
      // browser with no cache worked.
      //
      // The cached copy is still the right answer when the network is gone,
      // which is the only thing this worker exists for. The timeout keeps a
      // dead-slow venue connection from stalling score entry.
      const cachedCopy = async () => {
        const names = await caches.keys();
        for (const name of names.filter((value) => value.startsWith(OFFLINE_SCORE_CACHE_PREFIX))) {
          const cached = await caches.open(name).then((cache) => cache.match(request));
          if (cached) return cached;
        }
        return null;
      };
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        try {
          const network = await fetch(request, { signal: controller.signal });
          if (network && network.status < 400) return network;
        } finally {
          clearTimeout(timer);
        }
      } catch {
        // offline, aborted, or a network error: fall through to the cache
      }
      return (await cachedCopy()) ?? fetch(request);
    })());
  }
});
