import { notFound } from "next/navigation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { getCorrectionWorkspace } from "../../../../lib/corrections/workspace";

export default async function CorrectionsPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  await requireTournamentAccess(tournamentId);
  const workspace = await getCorrectionWorkspace(tournamentId);
  return <main className="auth-shell"><section className="auth-card" aria-labelledby="corrections-title"><p className="eyebrow">CROSS CHECK</p><h1 id="corrections-title">Score Corrections</h1><p className="auth-note">Only actions the tournament server has authorized are shown here. A pending correction does not change scorecards, standings, or exports.</p><h2>Corrections you may propose</h2>{workspace.proposalCandidates.length ? <ul>{workspace.proposalCandidates.map((game) => <li key={game.gameId}>{game.eventName} · Game {game.matchInstance} · {game.sideA.displayName} / {game.sideB.displayName}</li>)}</ul> : <p className="auth-note">No correction proposals are available to you.</p>}<h2>Independent reviews waiting for you</h2>{workspace.pendingReviews.length ? <ul>{workspace.pendingReviews.map((review) => <li key={review.correctionId}>{review.eventName} · Game {review.matchInstance} · pending independent review</li>)}</ul> : <p className="auth-note">No independent reviews are waiting for you.</p>}</section></main>;
}
