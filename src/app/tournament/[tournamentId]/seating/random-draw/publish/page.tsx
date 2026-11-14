import { fictionalDrawBoundaryEnabled } from "../../../../../../lib/api/fictional-draw-enabled";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { reviewedDrawNativePublicationEnabled } from "../../../../../../lib/seating/reviewed-draw-publication-result";
import { rosterDrawEnabled } from "../../../../../../lib/api/roster-random-draw-handlers";
import { isLoopbackPlannerUrl } from "../../../../../../lib/api/local-seating-planner";
import { requireTournamentAccess } from "../../../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../../../lib/api/validation";
import { RecoveryDocumentBoundary } from "../../../../../../components/recovery-document-boundary";
import Client from "../../../../../../components/reviewed-draw-publisher-client";
export default async function Page({ params }: { params: Promise<{ tournamentId: string }> }) {
  if (!fictionalDrawBoundaryEnabled() && (!reviewedDrawNativePublicationEnabled() || !rosterDrawEnabled(process.env))) notFound();
  const host = (await headers()).get("host"); if (!host || (!fictionalDrawBoundaryEnabled() && !isLoopbackPlannerUrl(`http://${host}`))) notFound();
  const { tournamentId } = await params; if (!isUuid(tournamentId) || tournamentId !== tournamentId.toLowerCase()) notFound();
  const access = await requireTournamentAccess(tournamentId); if (!access.roles.some(r => r === "director" || r === "co_director")) notFound();
  return <RecoveryDocumentBoundary actorId={access.user.id}><main className="auth-shell"><section className="auth-card"><h1>Publish reviewed seating</h1><Client actorId={access.user.id} tournamentId={tournamentId}/></section></main></RecoveryDocumentBoundary>;
}

