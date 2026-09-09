import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "../../../lib/supabase/server";

function withCookies(response: NextResponse, source: NextResponse): NextResponse {
  source.cookies.getAll().forEach(({ name, value, ...options }) => response.cookies.set(name, value, options));
  response.headers.set("cache-control", "private, no-store");
  return response;
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  try {
    const { supabase, getResponse } = createRouteClient(request);
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
    const response = NextResponse.json({ status: "signed_out" });
    response.headers.set("Clear-Site-Data", '"cache", "storage"');
    return withCookies(response, getResponse());
  } catch {
    return NextResponse.json({ error: "sign_out_unavailable" }, { status: 503, headers: { "cache-control": "private, no-store" } });
  }
}
