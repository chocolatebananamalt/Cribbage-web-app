import PrizeScheduleSummary from "./prize-schedule-summary";
import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { listPrizeSchedules, listPrizeAwardSummaries } from "../../../../lib/api/prize-schedule";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
export const dynamic = "force-dynamic";
export default async function PrizeSchedulesPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  const admin = createServerOnlyAdminClient();
  const [schedules, resolved] = await Promise.all([
    listPrizeSchedules(admin, access.user.id, tournamentId),
    listPrizeAwardSummaries(admin, access.user.id, tournamentId),
  ]);
  return <PrizeScheduleSummary tournamentId={tournamentId} schedules={schedules} resolved={resolved} />;
}
