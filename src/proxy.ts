import { NextResponse, type NextRequest } from "next/server";
import {
  apiMutationOriginRejection,
  rejectsApiMutationOrigin,
} from "./lib/api/mutation-origin-gateway";
import { accountActivationEnabled } from "./lib/api/account-activation-release";
import { configuredSupabaseConnectSources } from "./lib/browser-connect-policy";
import { updateSession } from "./lib/supabase/proxy";

function registrationContentSecurityPolicy(nonce: string) {
  const development = process.env.NODE_ENV === "development";
  const supabaseConnectSources = configuredSupabaseConnectSources(process.env.NEXT_PUBLIC_SUPABASE_URL);
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src-elem 'self'${development ? " 'unsafe-inline'" : ` 'nonce-${nonce}'`}`,
    // React and Next.js use bounded style attributes for optimized images and
    // the route announcer. Scripts remain nonce-only, so allowing attributes
    // does not make executable or stylesheet content globally inline-capable.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // Browser authentication is the only current cross-origin connection.
    // Bind it to this deployment's configured project, never every Supabase
    // tenant, so a future integration needs an explicit security review.
    `connect-src 'self'${supabaseConnectSources.length ? ` ${supabaseConnectSources.join(" ")}` : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = registrationContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  if (rejectsApiMutationOrigin({
    pathname: request.nextUrl.pathname,
    method: request.method,
    origin: request.headers.get("origin"),
    fetchSite: request.headers.get("sec-fetch-site"),
    requestOrigin: request.nextUrl.origin,
  })) {
    const response = NextResponse.json(apiMutationOriginRejection.body, apiMutationOriginRejection.init);
    response.headers.set("Content-Security-Policy", policy);
    return response;
  }
  try {
    // The public demonstration is a static, synthetic-only interface. Keep it
    // independent from Supabase session refresh so visitors can open it
    // without authentication infrastructure or an account cookie.
    if ([
      "/demo",
      "/auth/offline-data-blocked",
      "/offline-score-sw.js",
      "/sample/qualifiers-summary.pdf",
      "/rulebook/acc-rulebook-2025.pdf",
    ].includes(request.nextUrl.pathname)) {
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.headers.set("Content-Security-Policy", policy);
      return response;
    }

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
    const response = NextResponse.json(
      { error: "operation_unavailable" },
      { status: 503, headers: { "cache-control": "private, no-store" } },
    );
    response.headers.set("Content-Security-Policy", policy);
    return response;
  }
}

export const config = {
  matcher: [
    "/api/v1/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
