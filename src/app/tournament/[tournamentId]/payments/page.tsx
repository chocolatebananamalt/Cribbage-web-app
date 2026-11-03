import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { getExpenseWorkspace } from "../../../../lib/expenses/workspace";
import { getPaymentWorkspace } from "../../../../lib/payments/workspace";
import { getPaymentConfiguration } from "../../../../lib/payments/configuration";
import { getPaymentObligations } from "../../../../lib/payments/obligations";
import ExpenseClient from "./expense-client";
import PaymentClient from "./payment-client";
import PaymentMethodConfiguration from "./payment-method-configuration";
import PaymentObligationClient from "./payment-obligation-client";
import PoolCalculator from "./pool-calculator";
import { getSyntheticEventContext } from "../../../../lib/paper-games/synthetic-event-context";
import { SyntheticEventNotice } from "../../../../components/synthetic-event-notice";
import { isSyntheticPaperDeployment } from "../../../../lib/api/synthetic-paper-evidence";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import { simulationFinanceDispatch } from "../../../../lib/api/simulation-finance-dispatch";
import { getTournamentResultEventSummary } from "../../../../lib/results/event-summary";
import SimulationFinanceClient from "./simulation-finance-client";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  if (isSyntheticPaperDeployment(process.env)) {
    const mode = await createServerOnlyAdminClient().rpc("get_multi_event_finance_workspace_v1", { actor: access.user.id, tid: tournamentId });
    const dispatch = simulationFinanceDispatch(mode.data, !!mode.error);
    if (dispatch === "blocked") return <main className="auth-shell"><section className="auth-card"><h1>Finance safety check unavailable</h1><p>Keep existing records and pending work intact. Finance mode could not be verified; no payment controls are available.</p><Link href={`/tournament/${tournamentId}`}>Back to tournament</Link></section></main>;
    if (dispatch === "simulation") {
      const [workspace, context] = await Promise.all([getTournamentResultEventSummary(access.user.id, tournamentId), getSyntheticEventContext(access.user.id, tournamentId)]);
      if (workspace.tournamentId !== tournamentId || !context) notFound();
      // Retired historical activations must not become new financial targets.
      // The selector RPC independently checks each selected event's current binding.
      const events = workspace.events.filter(event => context.eventIds.includes(event.eventId)).map(event => ({eventId:event.eventId,name:event.name}));
      if (!events.length) return <main className="auth-shell"><section className="auth-card"><h1>Simulated finance unavailable</h1><p>No enrolled event is available. Existing records and pending work are preserved.</p><Link href={`/tournament/${tournamentId}`}>Back to tournament</Link></section></main>;
      return <main className="auth-shell"><section className="auth-card corrections-card"><h1>Simulated finance</h1><p>TEST ONLY. These records describe a simulation. No money is received or paid, and no human consent is claimed.</p><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><SimulationFinanceClient actorId={access.user.id} tournamentId={tournamentId} events={events} canWrite={access.roles.includes("director")} /><SharedDeviceSignOut /></section></main>;
    }
  }
  const syntheticContext = await getSyntheticEventContext(access.user.id, tournamentId);
  const [paymentWorkspace, expenseWorkspace, paymentConfiguration, paymentObligations] = await Promise.all([
    getPaymentWorkspace(tournamentId),
    getExpenseWorkspace(tournamentId),
    getPaymentConfiguration(tournamentId),
    getPaymentObligations(tournamentId),
  ]);
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="payments-title"><p className="eyebrow">PRIVATE FINANCE</p><h1 id="payments-title">Payments and expenses</h1>{syntheticContext && <SyntheticEventNotice context={syntheticContext}/>}<p className="auth-note">These immutable records are evidence only. A payment record does not mean paid in full, reconciled, checked in, seated, enrolled, or eligible. Expense records also do not calculate payouts, Q-pools, sanctioning fees, MRPs, eligibility, or results. Never enter card, bank-account, or full check details.</p><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><PaymentMethodConfiguration configuration={paymentConfiguration}/><PaymentObligationClient actorId={access.user.id} tournamentId={tournamentId} entries={paymentObligations.entries}/><PoolCalculator /><ExpenseClient actorId={access.user.id} tournamentId={tournamentId} activeExpenseTotalMinor={expenseWorkspace.activeExpenseTotalMinor} expenses={expenseWorkspace.expenses} syntheticMode={!!syntheticContext} /><PaymentClient actorId={access.user.id} tournamentId={tournamentId} rosterEntries={paymentWorkspace.rosterEntries} acceptedMethods={[...(paymentConfiguration.cashEnabled ? ["cash" as const] : []), ...(paymentConfiguration.checkEnabled ? ["check" as const] : [])]} syntheticMode={!!syntheticContext} /><SharedDeviceSignOut /></section></main>;
}
