import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest } from "../../../lib/api/same-origin";
import { createRouteClient } from "../../../lib/supabase/server";

function withCookies(response: NextResponse, source: NextResponse): NextResponse {
  source.cookies.getAll().forEach(({ name, value, ...options }) => response.cookies.set(name, value, options));
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers: { "cache-control": "private, no-store" } });
  try {
    const { supabase, getResponse } = createRouteClient(request);
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error && error.name !== "AuthSessionMissingError") throw error;
    const response = NextResponse.json({ status: "signed_out" });
    // Targeted cleanup happens only under the browser's recovery barrier.
    // Never erase another tab's storage through a broad response header.
    return withCookies(response, getResponse());
  } catch {
    return NextResponse.json({ error: "sign_out_unavailable" }, { status: 503, headers: { "cache-control": "private, no-store" } });
  }
}
