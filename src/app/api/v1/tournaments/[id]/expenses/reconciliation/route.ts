import { NextRequest } from "next/server";

import {
  isExpenseRecoveryRequest,
  isRecoveredExpense,
  isRejectedExpense,
} from "../../../../../../../lib/api/expense";
import {
  apiJson,
  readSmallJson,
  requireVerifiedSubject,
  withApiFailureBoundary,
} from "../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../lib/api/validation";
import { createClient } from "../../../../../../../lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (body === null) return apiJson({ error: "invalid_json" }, { status: 400 });
    if (!isUuid(id) || !isExpenseRecoveryRequest(body)) {
      return apiJson({ error: "invalid_expense_recovery" }, { status: 400 });
    }
    const supabase = await createClient();
    if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await supabase.rpc("get_tournament_expense_operation_reconciliation", {
      p_tournament_id: id,
      p_operation_type: body.operationType,
      p_idempotency_key: body.idempotencyKey,
    });
    if (error || !data || typeof data !== "object"
      || (data as Record<string, unknown>).authorized !== true
      || !("result" in (data as Record<string, unknown>))) {
      return apiJson({ error: "operation_unavailable" }, { status: 503 });
    }
    const result = (data as Record<string, unknown>).result;
    if (result === null || isRecoveredExpense(result, body) || isRejectedExpense(result, body)) {
      return apiJson({ result });
    }
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
