import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import { isPaymentWorkspace, type PaymentWorkspace } from "../api/payment";
export type { PaymentEvent, PaymentRosterEntry, PaymentWorkspace } from "../api/payment";

export async function getPaymentWorkspace(tournamentId: string): Promise<PaymentWorkspace> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_roster_payment_workspace", { p_tournament_id: tournamentId });
  if (error || !data || typeof data !== "object") notFound();
  const result = data as Record<string, unknown>;
  if (!isPaymentWorkspace(result)) notFound();
  return { rosterEntries: result.rosterEntries };
}
