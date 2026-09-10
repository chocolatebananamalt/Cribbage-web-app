import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "../../../lib/supabase/server";

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
    return NextResponse.redirect(destination);
  }

  try {
    const { supabase, getResponse } = createRouteClient(request);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return withCookies(NextResponse.redirect(destination), getResponse());
  } catch {
    destination.pathname = "/sign-in";
    destination.search = "error=callback_failed";
    return NextResponse.redirect(destination);
  }
}

function withCookies(response: NextResponse, source: NextResponse): NextResponse {
  source.headers.forEach((value, name) => response.headers.set(name, value));
  const cookies = source.cookies.getAll();
  cookies.forEach(({ name, value, ...options }) => response.cookies.set(name, value, options));
  // This route receives a one-time exchange code in its request URL. Even an
  // unsuccessful redirect must never be eligible for a shared cache.
  response.headers.set("cache-control", "private, no-store");
  return response;
}
