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
  requestOrigin,
}: {
  pathname: string;
  method: string;
  origin: string | null;
  requestOrigin: string;
}) {
  return pathname.startsWith("/api/v1/") && !safeMethods.has(method) && origin !== requestOrigin;
}
