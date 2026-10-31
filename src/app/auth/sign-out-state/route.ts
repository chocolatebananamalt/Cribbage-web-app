import type { NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { isSameOriginRequest } from "../../../lib/api/same-origin";
import { readSmallJson } from "../../../lib/api/bounded-json";
import { privateAuthJson } from "../../../lib/auth/recovery-auth";
import { signOutClaimsStatus } from "../../../lib/auth/sign-out-claims";
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return privateAuthJson({ status: "unconfirmed" }, 403);
  const input = await readSmallJson(request);
  if (!input || typeof input !== "object" || Object.keys(input).length !== 1 || !("kind" in input) || input.kind !== "sign_out") return privateAuthJson({ status: "unconfirmed" }, 400);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const status = signOutClaimsStatus(data, error);
    return privateAuthJson({ status }, status === "unconfirmed" ? 503 : 200);
  } catch { return privateAuthJson({ status: "unconfirmed" }, 503); }
}
