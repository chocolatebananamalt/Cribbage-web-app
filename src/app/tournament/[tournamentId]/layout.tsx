import { requireTournamentAccess } from "../../../lib/auth/require-tournament-access";
import { isSimulatedLinkTournament } from "../../../lib/api/simulated-player-links";
import { hasSimulatedPlayerLinkLabel } from "../../../lib/simulated-player-links";
import { createServerOnlyAdminClient } from "../../../lib/supabase/private-admin";
import { SimulatedRehearsalNotice } from "../../../components/simulated-rehearsal-notice";

export default async function TournamentLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isSimulatedLinkTournament(tournamentId)) return children;
  const access = await requireTournamentAccess(tournamentId);
  const simulated = await hasSimulatedPlayerLinkLabel(createServerOnlyAdminClient(), tournamentId, access.user.id);
  return <>{simulated ? <SimulatedRehearsalNotice /> : null}{children}</>;
}
