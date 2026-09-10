import { NextResponse, type NextRequest } from "next/server";
import {
  apiMutationOriginRejection,
  rejectsApiMutationOrigin,
} from "./lib/api/mutation-origin-gateway";
import { accountActivationEnabled } from "./lib/api/account-activation-release";
import { updateSession } from "./lib/supabase/proxy";

function registrationContentSecurityPolicy(nonce: string) {
  const development = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src 'self'${development ? " 'unsafe-inline'" : ` 'nonce-${nonce}'`}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // Browser authentication is the only current cross-origin connection.
    // Keep the allow-list narrowly scoped so a future integration must be
    // consciously reviewed before it can receive operational browser data.
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  if (rejectsApiMutationOrigin({
    pathname: request.nextUrl.pathname,
    method: request.method,
    origin: request.headers.get("origin"),
    fetchSite: request.headers.get("sec-fetch-site"),
    requestOrigin: request.nextUrl.origin,
  })) {
    return NextResponse.json(apiMutationOriginRejection.body, apiMutationOriginRejection.init);
  }
  try {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const policy = registrationContentSecurityPolicy(nonce);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", policy);

    // A disabled feature must stay absent even when an unconfigured local
    // environment cannot initialize the unrelated authenticated-session proxy.
    // It still receives the same browser isolation policy as every other page.
    if (request.nextUrl.pathname === "/activate" && !accountActivationEnabled()) {
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.headers.set("Content-Security-Policy", policy);
      return response;
    }

    const response = await updateSession(request, requestHeaders);
    response.headers.set("Content-Security-Policy", policy);
    return response;
  } catch {
    return NextResponse.json(
      { error: "operation_unavailable" },
      { status: 503, headers: { "cache-control": "private, no-store" } },
    );
  }
}

export const config = {
  matcher: [
    "/api/v1/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
