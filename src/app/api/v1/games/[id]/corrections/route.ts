import { NextRequest } from "next/server";
import { apiJson, readSmallJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { createClient } from "../../../../../../lib/supabase/server";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { isUuid } from "../../../../../../lib/api/validation";
import { createRule12Correction, type Rule12Claim } from "../../../../../../lib/corrections/independent-lifecycle";
import { rule12CorrectionEnabled } from "../../../../../../lib/api/rule12-correction-release";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { adjudicateRule12Fixture, type Rule12Case } from "../../../../../../lib/rule12-discrepancy";

const cases = new Set(["a", "b", "c", "d", "e", "f", "h"]);
function claim(value: unknown): value is Rule12Claim {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 4 && ["win", "loss"].includes(v.outcome as string)
    && (v.margin === null || (Number.isInteger(v.margin) && (v.margin as number) >= 1 && (v.margin as number) <= 121))
    && ["plus", "minus", "blank"].includes(v.column as string) && typeof v.apparentQualifier === "boolean"
    && ((v.column === "blank") === (v.margin === null));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!rule12CorrectionEnabled()) return apiJson({ error: "not_found" }, { status: 404 });
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params; const parsed = await readSmallJson(request);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return apiJson({ error: "invalid_json" }, { status: 400 });
    const body = parsed as Record<string, unknown>; const ruleCase = typeof body.ruleCase === "string" ? body.ruleCase.replace("12.2", "") : "";
    if (!isUuid(id) || !isUuid(body.correctionId) || !isUuid(body.idempotencyKey)
      || !Number.isSafeInteger(body.expectedGameVersion) || (body.expectedGameVersion as number) < 1
      || !Number.isSafeInteger(body.expectedCorrectionSequence) || (body.expectedCorrectionSequence as number) < 0
      || !cases.has(ruleCase) || !claim(body.claimA) || !claim(body.claimB)
      || typeof body.qualificationChanged !== "boolean"
      || (body.qualificationChanged ? !isUuid(body.affectedParticipantId) : body.affectedParticipantId !== null)
      || (body.reason !== undefined && (typeof body.reason !== "string" || body.reason.length > 500))) return apiJson({ error: "invalid_correction" }, { status: 400 });
    try { adjudicateRule12Fixture(ruleCase as Rule12Case, [{ id: "a", recordedOutcome: body.claimA.outcome, recordedMargin: body.claimA.margin, recordedColumn: body.claimA.column, apparentQualifier: body.claimA.apparentQualifier }, { id: "b", recordedOutcome: body.claimB.outcome, recordedMargin: body.claimB.margin, recordedColumn: body.claimB.column, apparentQualifier: body.claimB.apparentQualifier }], { qualificationChanged: body.qualificationChanged }); }
    catch { return apiJson({ error: "invalid_correction" }, { status: 400 }); }
    const actorId = await requireVerifiedSubject(await createClient());
    if (!actorId) return apiJson({ error: "unauthorized" }, { status: 401 });
    const data = await createRule12Correction(createServerOnlyAdminClient(), { actorId, gameId: id, correctionId: body.correctionId as string, expectedGameVersion: body.expectedGameVersion as number, expectedCorrectionSequence: body.expectedCorrectionSequence as number, ruleCase: `12.2${ruleCase}` as `12.2${Rule12Case}`, claimA: body.claimA, claimB: body.claimB, qualificationChanged: body.qualificationChanged, affectedParticipantId: body.affectedParticipantId as string | null, reason: body.reason as string | undefined, operationId: body.idempotencyKey as string });
    return apiJson(data, { status: data.status === "rejected" ? 409 : 200 });
  });
}
