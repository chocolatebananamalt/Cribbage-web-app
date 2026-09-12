import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "../../../lib/supabase/server";
import { canAcceptOfflineOwnerSession } from "../../../lib/auth/offline-account-switch";

function safeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = new URL(safeRedirectPath(request.nextUrl.searchParams.get("next")), request.url);

  if (!code) {
    destination.pathname = "/sign-in";
    destination.search = "error=missing_code";
    return privateRedirect(destination);
  }

  try {
    const { supabase, getResponse } = createRouteClient(request);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    const offlineOwner = request.cookies.get("acc_offline_score_owner")?.value;
    if (!canAcceptOfflineOwnerSession(offlineOwner, data.user?.id)) {
      // Discard the new session cookies, preserving the previous browser
      // identity if it is still valid. The one-time code is consumed, but no
      // different account can inherit the prior player's private offline page.
      return privateRedirect(new URL("/auth/offline-data-blocked", request.url));
    }
    return withCookies(NextResponse.redirect(destination), getResponse());
  } catch {
    destination.pathname = "/sign-in";
    destination.search = "error=callback_failed";
    return privateRedirect(destination);
  }
}

function privateRedirect(destination: URL): NextResponse {
  const response = NextResponse.redirect(destination);
  response.headers.set("cache-control", "private, no-store");
  return response;
}

function withCookies(response: NextResponse, source: NextResponse): NextResponse {
  source.headers.forEach((value, name) => {
    if (name.toLowerCase() !== "set-cookie") response.headers.set(name, value);
  });
  const cookies = source.cookies.getAll();
  cookies.forEach(({ name, value, ...options }) => response.cookies.set(name, value, options));
  // This route receives a one-time exchange code in its request URL. Even an
  // unsuccessful redirect must never be eligible for a shared cache.
  return privateRedirectResponse(response);
}

function privateRedirectResponse(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "private, no-store");
  return response;
}
