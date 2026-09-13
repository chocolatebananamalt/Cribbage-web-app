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

export const dynamic = "force-dynamic";

export default async function PaymentsPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const [paymentWorkspace, expenseWorkspace, paymentConfiguration, paymentObligations] = await Promise.all([
    getPaymentWorkspace(tournamentId),
    getExpenseWorkspace(tournamentId),
    getPaymentConfiguration(tournamentId),
    getPaymentObligations(tournamentId),
  ]);
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="payments-title"><p className="eyebrow">PRIVATE FINANCE</p><h1 id="payments-title">Payments and expenses</h1><p className="auth-note">These immutable records are evidence only. A payment record does not mean paid in full, reconciled, checked in, seated, enrolled, or eligible. Expense records also do not calculate payouts, Q-pools, sanctioning fees, MRPs, eligibility, or results. Never enter card, bank-account, or full check details.</p><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><PaymentMethodConfiguration configuration={paymentConfiguration}/><PaymentObligationClient tournamentId={tournamentId} entries={paymentObligations.entries}/><PoolCalculator /><ExpenseClient actorId={access.user.id} tournamentId={tournamentId} activeExpenseTotalMinor={expenseWorkspace.activeExpenseTotalMinor} expenses={expenseWorkspace.expenses} /><PaymentClient actorId={access.user.id} tournamentId={tournamentId} rosterEntries={paymentWorkspace.rosterEntries} acceptedMethods={[...(paymentConfiguration.cashEnabled ? ["cash" as const] : []), ...(paymentConfiguration.checkEnabled ? ["check" as const] : [])]} /><SharedDeviceSignOut /></section></main>;
}
