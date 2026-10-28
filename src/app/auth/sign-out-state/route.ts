import type { NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { isSameOriginRequest } from "../../../lib/api/same-origin";
import { readSmallJson } from "../../../lib/api/bounded-json";
import { privateAuthJson } from "../../../lib/auth/recovery-auth";
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return privateAuthJson({ status: "unconfirmed" }, 403);
  const input = await readSmallJson(request);
  if (!input || typeof input !== "object" || Object.keys(input).length !== 1 || !("kind" in input) || input.kind !== "sign_out") return privateAuthJson({ status: "unconfirmed" }, 400);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error?.name === "AuthSessionMissingError") return privateAuthJson({ status: "signed_out" });
    if (error) return privateAuthJson({ status: "unconfirmed" }, 503);
    return privateAuthJson({ status: data?.claims?.sub ? "signed_in" : "unconfirmed" });
  } catch { return privateAuthJson({ status: "unconfirmed" }, 503); }
}
