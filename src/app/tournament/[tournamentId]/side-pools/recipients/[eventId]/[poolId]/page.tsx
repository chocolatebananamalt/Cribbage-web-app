import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../../../../components/shared-device-sign-out";
import { isSidePoolRecipientWorkspaceV3 } from "../../../../../../../lib/api/side-pool-recipients-v3";
import { isSideGraduatedWorkspaceV2 } from "../../../../../../../lib/api/side-pool-graduated-v2";
import { isUuid } from "../../../../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../../../../lib/auth/require-tournament-access";
import { createServerOnlyAdminClient } from "../../../../../../../lib/supabase/private-admin";
import SidePoolRecipientsV3Client from "./side-pool-recipient-v3-client";

export const dynamic = "force-dynamic";

export default async function SidePoolRecipientsV3Page({ params }: { params: Promise<{ tournamentId: string; eventId: string; poolId: string }> }) {
  const { tournamentId, eventId, poolId } = await params;
  if (![tournamentId, eventId, poolId].every(isUuid)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director"].includes(access.role)) notFound();
  const admin = createServerOnlyAdminClient();
  const [{ data, error }, graduated] = await Promise.all([
    admin.rpc("get_side_pool_recipient_workspace_v3", {
      p_actor_id: access.user.id, p_tournament_id: tournamentId, p_event_id: eventId, p_pool_id: poolId,
    }),
    admin.rpc("get_side_pool_graduated_workspace_v2", { p_actor_id: access.user.id, p_tournament_id: tournamentId }),
  ]);
  const amountWorkspace = !graduated.error && isSideGraduatedWorkspaceV2(graduated.data, tournamentId) ? graduated.data : null;
  const amountPool = amountWorkspace?.pools.find((pool) => pool.eventId === eventId && pool.poolId === poolId);
  const canPublishPolicy = !!amountPool?.policy && !amountPool.started && amountPool.entries.length === 0;
  const workspace = !error && isSidePoolRecipientWorkspaceV3(data, tournamentId, eventId, poolId) ? data : null;
  return <main className="auth-shell"><section className="auth-card standings-card">
    <p className="eyebrow">SIDE POOL RECIPIENTS</p>
    <h1>Unpaid recipient review</h1>
    <p className="auth-note">This scoped review uses every fully paid entrant’s qualifying scorecard, regardless of playoff qualification. It records unpaid rank amounts only. It does not finalize tournament accounting, mark anyone paid, or move money.</p>
    {workspace
      ? <SidePoolRecipientsV3Client key={`${access.user.id}:${tournamentId}:${eventId}:${poolId}`} actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} poolId={poolId} workspace={workspace} canPublishPolicy={canPublishPolicy} />
      : <p className="auth-note" role="status">The v3 recipient workspace is unavailable for this pool. To use this flow, configure the new disclosed graduated amount policy and recipient disclosure before any elections. Existing fixed schedules and amount-only history stay unchanged and cannot be retrofitted or silently upgraded after collection or play begins.</p>}
    <Link className="guide-link" href={`/tournament/${tournamentId}/side-pools`}>Back to Side Pools</Link>
    <SharedDeviceSignOut />
  </section></main>;
}
