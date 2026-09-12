import Link from "next/link";
import { notFound } from "next/navigation";

import { SharedDeviceSignOut } from "../../../../../../components/shared-device-sign-out";
import { getSettlementWorkspace } from "../../../../../../lib/api/settlement-draft";
import { isUuid } from "../../../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import SettlementClient from "./settlement-client";

export const dynamic = "force-dynamic";

export default async function SettlementPage({ params }: { params: Promise<{ tournamentId: string; eventId: string }> }) {
  const { tournamentId, eventId } = await params;
  if (!isUuid(tournamentId) || !isUuid(eventId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const workspace = await getSettlementWorkspace(createServerOnlyAdminClient(), access.user.id, tournamentId, eventId);
  if (!workspace) notFound();
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="settlement-title">
    <p className="eyebrow">PRIVATE RESULTS AND FINANCE</p>
    <h1 id="settlement-title">Post-event settlement draft</h1>
    <p className="auth-note">Record playoff placement and award claims against the locked qualifier list. The server preserves every saved version and snapshots active receipts and expenses.</p>
    <Link className="guide-link" href={`/tournament/${tournamentId}/results?event=${eventId}`}>Previous Screen</Link>
    <SettlementClient key={`${workspace.currentVersion}-${workspace.draft?.settlementDraftId ?? "new"}`} actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} workspace={workspace} />
    <SharedDeviceSignOut />
  </section></main>;
}
