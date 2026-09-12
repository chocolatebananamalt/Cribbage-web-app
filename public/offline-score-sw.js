const OFFLINE_SCORE_CACHE_PREFIX = "acc-offline-score-pages-v2:";
const GAME_PATH = /^\/tournament\/[0-9a-f-]{36}\/game\/([0-9a-f-]{36})\/?$/i;

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
    event.respondWith((async () => {
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
    })());
    return;
  }

  if (url.pathname.startsWith("/_next/static/immutable/") || url.pathname.startsWith("/_next/static/chunks/")) {
    event.respondWith((async () => {
      const names = await caches.keys();
      for (const name of names.filter((value) => value.startsWith(OFFLINE_SCORE_CACHE_PREFIX))) {
        const cached = await caches.open(name).then((cache) => cache.match(request));
        if (cached) return cached;
      }
      return fetch(request);
    })());
  }
});
