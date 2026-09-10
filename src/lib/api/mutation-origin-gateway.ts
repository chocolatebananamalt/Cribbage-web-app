const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export const apiMutationOriginMatcher = "/api/v1/:path*";
export const apiMutationOriginRejection = {
  body: { error: "invalid_origin" },
  init: { status: 403, headers: { "cache-control": "private, no-store" } },
} as const;

export function rejectsApiMutationOrigin({
  pathname,
  method,
  origin,
  fetchSite,
  requestOrigin,
}: {
  pathname: string;
  method: string;
  origin: string | null;
  fetchSite: string | null;
  requestOrigin: string;
}) {
  if (!pathname.startsWith("/api/v1/") || safeMethods.has(method)) return false;
  if (origin !== requestOrigin) return true;
  // Fetch Metadata is not universal, so an absent header remains compatible
  // with older clients. An explicit cross-site value is never valid for an
  // in-app state-changing request and should fail closed at the shared edge.
  return fetchSite === "cross-site";
}
