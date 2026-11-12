import type { NextRequest } from "next/server";

/** Next development route Requests normalize a loopback URL to localhost.
 * Compare the browser Origin with the actual HTTP Host authority, never a
 * caller-supplied forwarding header or an Origin-derived allowlist. */
export function expectedRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  if (host === null) return url.origin;
  if (!/^(?:[a-z0-9._-]+|\[[a-f0-9:]+\])(?::\d{1,5})?$/i.test(host)) return "";
  try { return new URL(`${url.protocol}//${host}`).origin; } catch { return ""; }
}

export function isSameOriginRequest(request: NextRequest) {
  const expected = expectedRequestOrigin(request);
  if (!expected || request.headers.get("origin") !== expected) return false;
  // Fetch Metadata is advisory rather than universal, so an absent header does
  // not reject a legitimate older browser. An explicit cross-site value,
  // however, is inconsistent with an in-app mutation and fails closed.
  const fetchSite = request.headers.get("sec-fetch-site");
  return fetchSite === null || fetchSite === "same-origin";
}
