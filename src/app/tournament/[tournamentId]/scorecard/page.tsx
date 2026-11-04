import { notFound } from "next/navigation";
import { PlayerScorecardView } from "../../../../components/player-scorecard-view";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { getPlayerScorecard } from "../../../../lib/games/player-scorecard";
import { getMyGames } from "../../../../lib/games/my-games";
import { getRule12PlayerNotices } from "../../../../lib/corrections/player-notices";
import { rule12CorrectionEnabled } from "../../../../lib/api/rule12-correction-release";

export default async function PlayerScorecardPage({ params, searchParams }: { params: Promise<{ tournamentId: string }>; searchParams: Promise<{ event?: string }> }) {
  const { tournamentId } = await params;
  const { event } = await searchParams;
  if (!isUuid(tournamentId) || !event || !isUuid(event)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  const [scorecard, assigned] = await Promise.all([getPlayerScorecard(tournamentId, event), getMyGames(tournamentId)]);
  const notices = rule12CorrectionEnabled() ? await getRule12PlayerNotices(access.user.id, tournamentId) : [];
  return <PlayerScorecardView scorecard={scorecard}
    assignments={assigned.status === "available" ? assigned.workspace.games : []}
    hasCorrectionNotice={notices.some((notice) => notice.eventId === event)} />;
}
