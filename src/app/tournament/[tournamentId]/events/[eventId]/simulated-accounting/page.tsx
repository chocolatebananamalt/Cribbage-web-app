import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../../../lib/auth/require-tournament-access";
import { isSyntheticPaperDeployment } from "../../../../../../lib/api/synthetic-paper-evidence";
import { namedMultiEventAwardPreview, type NamedPreview } from "../../../../../../lib/api/multi-event-award-preview";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";
import { PreviewView } from "./preview-view";
import AccountingClient from "./accounting-client";

export const dynamic = "force-dynamic";

export default async function SimulatedAccountingPage({ params }: { params: Promise<{ tournamentId: string; eventId: string }> }) {
  if (!isSyntheticPaperDeployment(process.env)) notFound();
  const { tournamentId, eventId } = await params;
  if (!isUuid(tournamentId) || !isUuid(eventId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!access.roles.some(role => role === "director" || role === "co_director")) notFound();
  let view: NamedPreview | null = null; let blocked = false;
  try {
    const admin = createServerOnlyAdminClient(); const user = await createClient();
    const [preview, selector, standings] = await Promise.all([
      admin.rpc("get_multi_event_award_preview_v1", { actor: access.user.id, tid: tournamentId, eid: eventId }),
      admin.rpc("get_simulated_finance_selector_workspace_v1", { actor: access.user.id, tid: tournamentId, eid: eventId }),
      user.rpc("get_preliminary_event_standings", { p_tournament_id: tournamentId, p_event_id: eventId }),
    ]);
    if (!preview.error && !selector.error && !standings.error && preview.data && selector.data) {
      blocked = typeof preview.data === "object" && preview.data.status === "blocked";
      if (!blocked) {
        const candidate = namedMultiEventAwardPreview(preview.data, selector.data, standings.data, tournamentId, eventId);
        if (candidate) {
          const latest = await admin.rpc("get_multi_event_award_preview_v1", { actor: access.user.id, tid: tournamentId, eid: eventId });
          if (!latest.error && latest.data?.status === "preview" && latest.data.sourceDigest === candidate.sourceDigest) view = candidate;
        }
      }
    }
  } catch { /* Keep the synthetic preview unavailable when any source cannot be verified. */ }
  return <PreviewView view={view} blocked={blocked} tournamentId={tournamentId} eventId={eventId}>{view && (access.roles.includes("director") ? <AccountingClient actorId={access.user.id} tournamentId={tournamentId} eventId={eventId} previewDigest={view.sourceDigest}/> : <p>Only the Director can record simulated cross-checks, drafts and joint unpaid closure.</p>)}</PreviewView>;
}
