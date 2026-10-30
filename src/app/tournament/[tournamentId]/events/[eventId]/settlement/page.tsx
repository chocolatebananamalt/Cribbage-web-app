import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SharedDeviceSignOut } from "../../../../../../components/shared-device-sign-out";
import { getPlayoffPlacementWorkspace } from "../../../../../../lib/api/playoff-placement";
import { getSettlementWorkspace } from "../../../../../../lib/api/settlement-draft";
import { getManualSettlementFinalizationWorkspace } from "../../../../../../lib/api/settlement-finalization";
import { getSettlementV5Workspace } from "../../../../../../lib/api/settlement-v5";
import { listPrizeSchedules } from "../../../../../../lib/api/prize-schedule";
import { settlementEntryRoute } from "../../../../../../lib/results/settlement-navigation";
import { getQualificationResult } from "../../../../../../lib/api/qualification-finalization";
import { isPlayoffV4Workspace } from "../../../../../../lib/api/playoff-outcome-v4";
import { getAccountingEntry } from "../../../../../../lib/api/accounting-entry";
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
  const settlementV5 = await getSettlementV5Workspace(admin, access.user.id, tournamentId, eventId);
  if (settlementV5?.draft || settlementV5?.sources.some((source) => source.kind === "playoff_outcome_v3")) redirect(`/tournament/${tournamentId}/events/${eventId}/settlement-v5`);
  const [workspace, playoffWorkspace, finalizationWorkspace, schedules, qualification] = await Promise.all([
    getSettlementWorkspace(admin, access.user.id, tournamentId, eventId),
    getPlayoffPlacementWorkspace(admin, access.user.id, tournamentId, eventId),
    getManualSettlementFinalizationWorkspace(admin, access.user.id, tournamentId, eventId),
    listPrizeSchedules(admin, access.user.id, tournamentId),
    getQualificationResult(admin, access.user.id, tournamentId, eventId),
  ]);
  const hasLegacyHistory = !!workspace?.draft || !!playoffWorkspace?.playoffResult || !!finalizationWorkspace?.draft || !!finalizationWorkspace?.finalization;
  const legacyReadAvailable = !!workspace && !!playoffWorkspace && !!finalizationWorkspace;
  if (qualification?.qualifierCount === 5 && !hasLegacyHistory) {
    if (!legacyReadAvailable) return <main className="auth-shell"><section className="auth-card corrections-card"><h1>Settlement history unavailable</h1><p>Existing settlement history could not be checked. No new result or accounting route was assumed.</p><Link href={`/tournament/${tournamentId}/results?event=${eventId}`}>Review qualifying results</Link><SharedDeviceSignOut/></section></main>;
    let currentFiveResult = false;
    try {
      const { data, error } = await admin.rpc("get_standard_singles_playoff_outcome_workspace_v4", { p_actor_id: access.user.id, p_tournament_id: tournamentId, p_event_id: eventId });
      currentFiveResult = !error && isPlayoffV4Workspace(data, tournamentId, eventId) && data.result?.current === true;
    } catch { /* New schema unavailable: its own screen fails closed. */ }
    if (!currentFiveResult) redirect(`/tournament/${tournamentId}/events/${eventId}/playoff-v4`);
    const accountingEntry = access.role === "director" ? await getAccountingEntry(admin, access.user.id, tournamentId, eventId) : null;
    if (accountingEntry) redirect(`/tournament/${tournamentId}/events/${eventId}/${accountingEntry}`);
    return <main className="auth-shell"><section className="auth-card corrections-card"><h1>Accounting route unavailable</h1><p>The primary director must review a supported current pool configuration before entering accounting. No zero-pool or legacy fallback was assumed.</p><Link href={`/tournament/${tournamentId}/events/${eventId}/playoff-v4`}>Review five-qualifier playoff</Link><SharedDeviceSignOut/></section></main>;
  }
  const route = settlementEntryRoute({
    hasVersionedDraft: false, hasCanonicalOutcome: false,
    currentStructuredSchedule: !!schedules?.some(s => s.eventId === eventId && s.settingsCurrent && s.activated && s.versions.length > 0),
    legacyReadAvailable,
    hasLegacyHistory,
  });
  if (route === "playoff-outcomes") redirect(`/tournament/${tournamentId}/events/${eventId}/playoff-outcomes`);
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
