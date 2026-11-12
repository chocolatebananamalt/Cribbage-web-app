import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { isUuid } from "../../../../lib/api/validation";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { getPaperGameWorkspace } from "../../../../lib/paper-games/workspace";
import { getSyntheticPaperEvidence } from "../../../../lib/paper-games/synthetic-evidence";
import { syntheticPaperNotice } from "../../../../lib/api/synthetic-paper-evidence";
import PaperGameClient from "./paper-game-client";
import {getGameScorecardNumbers,type GameScorecardNumbers} from '../../../../lib/games/scorecard-number-context';

export default async function PaperGamePage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  if (!isUuid(tournamentId)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (!["director", "co_director", "cross_checker"].includes(access.role)) notFound();
  const workspace = await getPaperGameWorkspace(access.user.id, tournamentId);
  const synthetic = await getSyntheticPaperEvidence(access.user.id, tournamentId);
  const cardNumberContexts:Record<string,GameScorecardNumbers>={};
  const ids=[...new Set([...workspace.candidates,...workspace.reviewCases].filter(g=>g.gameNumber===13).map(g=>g.gameId))];
  await Promise.all(ids.map(async id=>{const n=await getGameScorecardNumbers(access.user.id,tournamentId,id);if(n)cardNumberContexts[id]=n;}));
  return <main className="auth-shell"><section className="auth-card corrections-card" aria-labelledby="paper-games-title">
    <p className="eyebrow">CROSS CHECK</p>
    <h1 id="paper-games-title">Complete paper-versus-paper games</h1>
    <p className="card-context">{workspace.tournamentName}</p>
    <p className="registration-note">{synthetic ? syntheticPaperNotice + " Separate capture and re-entry remain required; this is not physical-paper acceptance. Earlier captures keep their original history and are not retroactively assigned generated evidence." : "An authorized official records both original paper cards, then independently re-enters the same evidence to confirm it. A mismatch stays out of scorecards and standings. Two officials may split these steps, and one official may do both."}</p>
    <PaperGameClient syntheticGameIds={synthetic?.gameIds} syntheticEventIds={synthetic?.eventIds} syntheticArtifacts={synthetic ? Object.fromEntries(synthetic.artifacts.map(a => [a.gameId,a])) : undefined} actorId={access.user.id} tournamentId={tournamentId} actorRole={workspace.actorRole} actorIdentityConfirmed={workspace.actorIdentityConfirmed} unboundOfficials={workspace.unboundOfficials} rosterChoices={workspace.rosterChoices} candidates={workspace.candidates} reviewCases={workspace.reviewCases} cardNumberContexts={cardNumberContexts}/>
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link>
    <SharedDeviceSignOut />
  </section></main>;
}
