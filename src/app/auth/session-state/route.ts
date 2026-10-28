import type { NextRequest } from "next/server";
import { getCurrentSubject } from "../../../lib/auth/current-subject";
import { isSameOriginRequest } from "../../../lib/api/same-origin";
import { readSmallJson } from "../../../lib/api/bounded-json";
import { authAttemptCookie, privateAuthJson } from "../../../lib/auth/recovery-auth";
import { ownerMarkersAllowActor, offlineOwnerCookie, recoveryOwnerCookie } from "../../../lib/auth/recovery-owner";
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return privateAuthJson({ status: "unconfirmed" }, 403);
  const input = await readSmallJson(request);
  if (!input || typeof input !== "object" || Object.keys(input).length !== 1 || !("attemptId" in input) || typeof input.attemptId !== "string" || !/^[0-9a-f-]{36}$/.test(input.attemptId)) return privateAuthJson({ status: "unconfirmed" }, 400);
  const subject = await getCurrentSubject();
  const receipt = request.cookies.get(authAttemptCookie)?.value;
  const owners = request.cookies.getAll().filter(cookie => cookie.name === recoveryOwnerCookie || cookie.name === offlineOwnerCookie).map(cookie => cookie.value);
  return privateAuthJson({ status: subject && receipt === `${input.attemptId}:${subject}` && ownerMarkersAllowActor(owners, subject) ? "signed_in" : "unconfirmed" });
}
