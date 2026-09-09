import { NextResponse } from "next/server";

export const privateNoStore = { "cache-control": "private, no-store" };

export function apiJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
}

type ClaimsClient = {
  auth: {
    getClaims: () => Promise<{
      data: { claims?: { sub?: unknown } } | null;
      error: unknown;
    }>;
  };
};

export async function requireVerifiedSubject(supabase: ClaimsClient) {
  const { data, error } = await supabase.auth.getClaims();
  if (error) throw new Error("claims_unavailable");
  const subject = data?.claims?.sub;
  return typeof subject === "string" && subject.length > 0 ? subject : null;
}

export async function withApiFailureBoundary(run: () => Promise<NextResponse>) {
  try {
    return await run();
  } catch {
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  }
}
