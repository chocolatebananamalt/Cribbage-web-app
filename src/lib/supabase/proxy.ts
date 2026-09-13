import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "../env";

export async function updateSession(request: NextRequest, requestHeaders = new Headers(request.headers)) {
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const { url, publishableKey } = getPublicSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        const refreshedHeaders = new Headers(requestHeaders);
        Object.entries(headersToSet).forEach(([name, value]) => refreshedHeaders.set(name, value));
        response = NextResponse.next({ request: { headers: refreshedHeaders } });
        Object.entries(headersToSet).forEach(([name, value]) => response.headers.set(name, value));
        response.headers.set("cache-control", "private, no-store");
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}
