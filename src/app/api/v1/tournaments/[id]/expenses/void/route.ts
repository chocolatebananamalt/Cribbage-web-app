import { NextRequest } from "next/server";

import {
  isExpenseVoidRequest,
  isRejectedExpense,
  isVoidedExpense,
  type ExpenseRecoveryRequest,
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
    if (!isUuid(id) || !isExpenseVoidRequest(body)) {
      return apiJson({ error: "invalid_expense_void" }, { status: 400 });
    }
    const supabase = await createClient();
    if (!await requireVerifiedSubject(supabase)) return apiJson({ error: "unauthorized" }, { status: 401 });
    const { data, error } = await supabase.rpc("void_tournament_expense", {
      p_tournament_id: id,
      p_expense_id: body.expenseId,
      p_expected_expense_version: body.expectedExpenseVersion,
      p_expense_event_id: body.expenseEventId,
      p_void_reason: body.voidReason,
      p_idempotency_key: body.idempotencyKey,
    });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isVoidedExpense(data, body)) return apiJson(data);
    const recovery: ExpenseRecoveryRequest = {
      operationType: "void_tournament_expense",
      expenseId: body.expenseId,
      expectedExpenseVersion: body.expectedExpenseVersion,
      expenseEventId: body.expenseEventId,
      idempotencyKey: body.idempotencyKey,
    };
    if (isRejectedExpense(data, recovery)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
