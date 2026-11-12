import { NextRequest, NextResponse } from "next/server";
import { recoveryAuthPost } from "../../../lib/auth/recovery-auth-route";
import { safeAuthNext } from "../../../lib/auth/recovery-auth";

/** GET never consumes a one-time code or publishes a candidate session. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const target = new URL("/auth/complete-sign-in", request.url);
  if (!code || !/^[A-Za-z0-9_-]{8,2048}$/.test(code)) {
    target.pathname = "/sign-in"; target.search = "error=missing_code";
  } else {
    // Fragment stays browser-local rather than becoming another server URL query.
    target.hash = new URLSearchParams({ code, next: safeAuthNext(request.nextUrl.searchParams.get("next")) }).toString();
  }
  // A relative redirect preserves the browser-visible origin even when a
  // development proxy normalizes request.url to localhost.
  const response = new NextResponse(null, { status: 307, headers: { location: target.pathname + target.search + target.hash } });
  response.headers.set("cache-control", "private, no-store");
  response.headers.set("referrer-policy", "no-referrer");
  return response;
}
export async function POST(request: NextRequest) { return recoveryAuthPost(request, "code"); }
