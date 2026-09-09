import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { getPaymentWorkspace } from "../../../../lib/payments/workspace";

export const dynamic = "force-dynamic";

const money = (minor: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);
const time = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default async function PaymentsPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const workspace = await getPaymentWorkspace(tournamentId);
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="payments-title"><p className="eyebrow">PRIVATE FINANCE</p><h1 id="payments-title">Manual payment evidence</h1><p className="auth-note">A recorded receipt is evidence only. It does not mean paid in full, reconciled, checked in, seated, enrolled, or eligible. Never place card, bank-account, or check-reference details in a note.</p><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to tournament</Link><section className="policy-settings" aria-label="Manual payment history">{workspace.rosterEntries.length ? <ul className="correction-list">{workspace.rosterEntries.map((entry) => <li className="correction-item" key={entry.rosterEntryId}><h2>{entry.displayName}</h2><p><strong>Evidence status:</strong> {entry.paymentState === "unrecorded" ? "No receipt recorded" : entry.paymentState === "received" ? "Current receipt recorded" : "Most recent receipt voided"} · history version {entry.paymentVersion}</p>{entry.history.length ? <ol>{entry.history.map((item) => <li key={item.paymentEventId}><strong>{item.eventType === "received" ? "Receipt recorded" : "Receipt voided"}</strong> · {money(item.amountMinor)} USD · {item.paymentMethod} · received {time(item.paymentReceivedAt)} · recorded by {item.recorderDisplayName} {item.receiptNote ? `· Note: ${item.receiptNote}` : ""}{item.voidReason ? `· Void reason: ${item.voidReason}` : ""}</li>)}</ol> : <p>No manual payment evidence has been recorded.</p>}</li>)}</ul> : <p>No private roster entries are available yet.</p>}</section><SharedDeviceSignOut /></section></main>;
}
