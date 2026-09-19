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
