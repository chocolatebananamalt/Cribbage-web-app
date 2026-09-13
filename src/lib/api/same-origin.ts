import type { NextRequest } from "next/server";

export function isSameOriginRequest(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return false;
  // Fetch Metadata is advisory rather than universal, so an absent header does
  // not reject a legitimate older browser. An explicit cross-site value,
  // however, is inconsistent with an in-app mutation and fails closed.
  const fetchSite = request.headers.get("sec-fetch-site");
  return fetchSite === null || fetchSite === "same-origin";
}
