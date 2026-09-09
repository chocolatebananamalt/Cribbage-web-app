import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { getPaymentWorkspace } from "../../../../lib/payments/workspace";
import PaymentClient from "./payment-client";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const workspace = await getPaymentWorkspace(tournamentId);
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="payments-title"><p className="eyebrow">PRIVATE FINANCE</p><h1 id="payments-title">Manual payment evidence</h1><p className="auth-note">A recorded receipt is evidence only. It does not mean paid in full, reconciled, checked in, seated, enrolled, or eligible. Never place card, bank-account, or check-reference details in a note.</p><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><PaymentClient actorId={access.user.id} tournamentId={tournamentId} rosterEntries={workspace.rosterEntries} /><SharedDeviceSignOut /></section></main>;
}
