import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient } from "../supabase/server";
import { authAttemptCookie, performRecoveryAuthentication } from "./recovery-auth";
import { offlineOwnerCookie, recoveryOwnerCookie } from "./recovery-owner";

export async function recoveryAuthPost(request: NextRequest, mode: "password" | "code") {
  // Snapshot before Supabase's route client can mutate request.cookies.
  const owners = request.cookies.getAll().filter(cookie => cookie.name === recoveryOwnerCookie || cookie.name === offlineOwnerCookie).map(cookie => cookie.value);
  let cookieResponse: ReturnType<typeof createRouteClient>["getResponse"] | null = null;
  const result = await performRecoveryAuthentication(request, owners, async input => {
    if (input.mode !== mode) return { error: "rejected" };
    const { supabase, getResponse } = createRouteClient(request);
    cookieResponse = getResponse;
    const { data, error } = input.mode === "password"
      ? await supabase.auth.signInWithPassword({ email: input.email, password: input.password })
      : await supabase.auth.exchangeCodeForSession(input.code);
    if (error) return { error: error.status === 429 ? "rate_limited" : error.status && error.status >= 500 ? "unavailable" : "rejected" };
    return data.user && data.session ? { actorId: data.user.id } : { error: "rejected" };
  });
  // Rejections are fresh responses: never merge a rejected candidate's cookies.
  const response = new NextResponse(result.response.body, { status: result.response.status, headers: result.response.headers });
  if (result.accepted && cookieResponse) {
    const source = (cookieResponse as () => NextResponse)();
    source.cookies.getAll().forEach(({ name, value, ...options }) => response.cookies.set(name, value, options));
    response.cookies.set(authAttemptCookie, `${result.accepted.attemptId}:${result.accepted.actorId}`, { httpOnly: true, sameSite: "strict", secure: request.nextUrl.protocol === "https:", path: "/auth/session-state", maxAge: 120 });
  }
  return response;
}
