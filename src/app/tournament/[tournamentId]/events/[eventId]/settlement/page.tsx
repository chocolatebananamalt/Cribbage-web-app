import Link from "next/link";
import { notFound } from "next/navigation";

import { SharedDeviceSignOut } from "../../../../../../components/shared-device-sign-out";
import { getPlayoffPlacementWorkspace } from "../../../../../../lib/api/playoff-placement";
import { getSettlementWorkspace } from "../../../../../../lib/api/settlement-draft";
import { getManualSettlementFinalizationWorkspace } from "../../../../../../lib/api/settlement-finalization";
import { isUuid } from "../../../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import SettlementClient from "./settlement-client";
import PlayoffPlacementClient from "./playoff-placement-client";
import SettlementFinalizationClient from "./settlement-finalization-client";

export const dynamic = "force-dynamic";

export default async function SettlementPage({ params }: { params: Promise<{ tournamentId: string; eventId: string }> }) {
  const { tournamentId, eventId } = await params;
  if (!isUuid(tournamentId) || !isUuid(eventId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const admin = createServerOnlyAdminClient();
  const [workspace, playoffWorkspace, finalizationWorkspace] = await Promise.all([
    getSettlementWorkspace(admin, access.user.id, tournamentId, eventId),
    getPlayoffPlacementWorkspace(admin, access.user.id, tournamentId, eventId),
    getManualSettlementFinalizationWorkspace(admin, access.user.id, tournamentId, eventId),
  ]);
  if (!workspace || !playoffWorkspace || !finalizationWorkspace) notFound();
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="settlement-title">
    <p className="eyebrow">PRIVATE RESULTS AND FINANCE</p>
    <h1 id="settlement-title">Post-event settlement draft</h1>
    <p className="auth-note">Record playoff placement and award claims against the locked qualifier list. The server preserves every saved version and snapshots active receipts and expenses.</p>
    <Link className="guide-link" href={`/tournament/${tournamentId}/results?event=${eventId}`}>Previous Screen</Link>
    <PlayoffPlacementClient key={`playoff-${playoffWorkspace.currentVersion}`} actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} workspace={playoffWorkspace} />
    <SettlementClient key={`${workspace.currentVersion}-${workspace.draft?.settlementDraftId ?? "new"}`} actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} workspace={workspace} />
    <SettlementFinalizationClient key={`${finalizationWorkspace.currentVersion}-${finalizationWorkspace.draft?.settlementDraftId ?? "none"}`} actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} workspace={finalizationWorkspace} />
    <SharedDeviceSignOut />
  </section></main>;
}
