"use client";

export const offlineScoreCachePrefix = "acc-offline-score-pages-v2:";
export const offlineScoreOwnerCookie = "acc_offline_score_owner";
const gamePath = /^\/tournament\/[0-9a-f-]{36}\/game\/([0-9a-f-]{36})\/?$/i;
const operationTimeoutMs = 8_000;

function supported() {
  return "serviceWorker" in navigator && "caches" in window;
}

function withTimeout<T>(operation: Promise<T>, milliseconds = operationTimeoutMs) {
  return Promise.race<T>([
    operation,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error("offline_preparation_timeout")), milliseconds)),
  ]);
}

export function markOfflineScoreOwner(actorId: string) {
  // Lax is intentional: the callback is a top-level GET reached from the
  // Supabase/email origin, and must receive this marker before exchanging a
  // different browser identity. Browsers cap persistent cookies; refresh the
  // maximum practical lifetime whenever offline state is written.
  document.cookie = `${offlineScoreOwnerCookie}=${encodeURIComponent(actorId)}; Path=/; Max-Age=34560000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
  if (!document.cookie.split(";").some((part) => part.trim() === `${offlineScoreOwnerCookie}=${encodeURIComponent(actorId)}`)) {
    throw new Error("offline_owner_marker_unavailable");
  }
}

export async function prepareCurrentScorePageForOffline(actorId: string, gameId: string, expiresAtMs: number) {
  const pathMatch = window.location.pathname.match(gamePath);
  if (!supported() || !pathMatch || pathMatch[1].toLowerCase() !== gameId.toLowerCase() || expiresAtMs <= Date.now()) return false;

  await withTimeout(navigator.serviceWorker.register("/offline-score-sw.js", {
    scope: "/",
    updateViaCache: "none",
  }));
  await withTimeout(navigator.serviceWorker.ready);

  const pageRequest = new Request(window.location.href, { credentials: "same-origin" });
  const pageResponse = await withTimeout(fetch(pageRequest, { cache: "no-store", redirect: "error" }));
  const contentType = pageResponse.headers.get("content-type") ?? "";
  if (!pageResponse.ok || pageResponse.redirected || pageResponse.url !== pageRequest.url || !contentType.toLowerCase().startsWith("text/html")) return false;
  const html = await withTimeout(pageResponse.text());
  const binding = `data-offline-score-binding="${actorId}:${gameId}"`;
  if (!html.includes(binding)) return false;

  const assetUrls = [...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[rel='stylesheet'][href]")]
    .map((element) => element instanceof HTMLScriptElement ? element.src : element.href)
    .filter((value) => {
      const url = new URL(value, window.location.href);
      return url.origin === window.location.origin && url.pathname.startsWith("/_next/static/");
    });
  const assets = await withTimeout(Promise.all([...new Set(assetUrls)].map(async (assetUrl) => {
    const request = new Request(assetUrl, { credentials: "same-origin" });
    const response = await fetch(request, { cache: "force-cache", redirect: "error" });
    if (!response.ok || response.redirected) throw new Error("offline_asset_unavailable");
    return { request, response };
  })));

  const cacheName = `${offlineScoreCachePrefix}${gameId.toLowerCase()}`;
  try {
    const headers = new Headers(pageResponse.headers);
    headers.set("x-acc-offline-expires-at", String(expiresAtMs));
    const cache = await caches.open(cacheName);
    await cache.put(pageRequest, new Response(html, { status: pageResponse.status, statusText: pageResponse.statusText, headers }));
    for (const asset of assets) await cache.put(asset.request, asset.response);
    markOfflineScoreOwner(actorId);
  } catch (error) {
    await caches.delete(cacheName);
    throw error;
  }
  return true;
}

export async function clearOfflineScorePageCache() {
  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(offlineScoreCachePrefix) || name === "acc-offline-score-pages-v1").map((name) => caches.delete(name)));
  }
  document.cookie = `${offlineScoreOwnerCookie}=; Path=/; Max-Age=0; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
}
