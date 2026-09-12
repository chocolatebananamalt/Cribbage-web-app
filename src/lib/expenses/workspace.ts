import "server-only";

import { notFound } from "next/navigation";
import { isExpenseWorkspace, type ExpenseWorkspace } from "../api/expense";
import { createClient } from "../supabase/server";

export async function getExpenseWorkspace(tournamentId: string): Promise<ExpenseWorkspace> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_tournament_expense_workspace", {
    p_tournament_id: tournamentId,
  });
  if (error || !isExpenseWorkspace(data, tournamentId)) notFound();
  return data;
}
