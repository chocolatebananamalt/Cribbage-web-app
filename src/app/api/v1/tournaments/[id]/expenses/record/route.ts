import { NextRequest } from "next/server";

import {
  isExpenseRecordRequest,
  isRecordedExpense,
  isRejectedExpense,
  type ExpenseRecoveryRequest,
} from "../../../../../../../lib/api/expense";
import {
  apiJson,
  readSmallJson,
  requireVerifiedSubject,
  withApiFailureBoundary,
} from "../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../lib/api/same-origin";
import { expenseActorMatches, readExpectedExpenseActor } from "../../../../../../../lib/api/expense-expected-actor";
import { isUuid } from "../../../../../../../lib/api/validation";
import { createClient } from "../../../../../../../lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: "invalid_origin" }, { status: 403 });
    const expectedActorId = readExpectedExpenseActor(request);
    if (!expectedActorId) return apiJson({ error: "identity_changed" }, { status: 403 });
    const { id } = await params;
    const body = await readSmallJson(request);
    if (body === null) return apiJson({ error: "invalid_json" }, { status: 400 });
    if (!isUuid(id) || !isExpenseRecordRequest(body)) {
      return apiJson({ error: "invalid_expense_record" }, { status: 400 });
    }
    const supabase = await createClient();
    if (await requireVerifiedSubject(supabase) !== expectedActorId || !await expenseActorMatches(supabase, expectedActorId)) return apiJson({ error: "identity_changed" }, { status: 403 });
    const { data, error } = await supabase.rpc("record_tournament_expense", {
      p_tournament_id: id,
      p_amount_minor: body.amountMinor,
      p_currency_code: "USD",
      p_description: body.description,
      p_idempotency_key: body.idempotencyKey,
    });
    if (!await expenseActorMatches(supabase, expectedActorId)) return apiJson({ error: "identity_changed" }, { status: 403 });
    if (error) return apiJson({ error: "operation_unavailable" }, { status: 503 });
    if (isRecordedExpense(data, body)) return apiJson(data);
    const recovery: ExpenseRecoveryRequest = {
      operationType: "record_tournament_expense",
      expenseId: null,
      expectedExpenseVersion: 0,
      expenseEventId: null,
      idempotencyKey: body.idempotencyKey,
    };
    if (isRejectedExpense(data, recovery)) return apiJson(data, { status: 409 });
    return apiJson({ error: "operation_unavailable" }, { status: 503 });
  });
}
