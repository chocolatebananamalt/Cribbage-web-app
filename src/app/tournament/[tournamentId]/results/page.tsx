import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { buildPreliminaryQualification } from "../../../../lib/results/qualification-preview";
import { getPreliminaryEventStandings } from "../../../../lib/results/preliminary-standings";
import { getQualificationResult } from "../../../../lib/api/qualification-finalization";
import { formatSignedNet } from "../../../../lib/score";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import { QualificationFinalizationClient } from "./qualification-finalization-client";

export default async function PreliminaryResultsPage({ params, searchParams }: {
  params: Promise<{ tournamentId: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  const { tournamentId } = await params;
  const { event } = await searchParams;
  if (!isUuid(tournamentId) || !event || !isUuid(event)) notFound();
  const access = await requireTournamentAccess(tournamentId);
  const standings = await getPreliminaryEventStandings(tournamentId, event);
  const qualification = buildPreliminaryQualification(standings.rows);
  const finalized = await getQualificationResult(createServerOnlyAdminClient(), access.user.id, tournamentId, event);

  if (finalized) return <main className="auth-shell"><section className="auth-card standings-card" aria-labelledby="standings-title">
    <p className="eyebrow">TOURNAMENT RESULTS</p>
    <h1 id="standings-title">Finalized Qualification</h1>
    <p className="card-context">{finalized.tournamentName} · {finalized.eventName}</p>
    <p className="registration-note">This is the locked qualifying-round ranking. Playoff winner and runner-up are separate results and are not available on this screen.</p>
    <section className="correction-item" aria-labelledby="qualifier-list-title">
      <h2 id="qualifier-list-title">Qualifiers</h2>
      <ol>{finalized.qualifiers.map((row) => <li key={row.participantId}>
        <strong>{row.displayName}</strong> · {row.gamePoints} game points · {row.gamesWon} won · {formatSignedNet(row.netSpreadPoints)} net · +{row.plusPoints} plus
      </li>)}</ol>
      <section className="registration-note" aria-labelledby="high-non-qualifier-title">
        <h3 id="high-non-qualifier-title">High Non-Qualifier</h3>
        <p><strong>{finalized.highNonQualifier.displayName}</strong> · {finalized.highNonQualifier.gamePoints} game points · {finalized.highNonQualifier.gamesWon} won · {formatSignedNet(finalized.highNonQualifier.netSpreadPoints)} net · +{finalized.highNonQualifier.plusPoints} plus</p>
      </section>
    </section>
    <p className="auth-note">Finalized by {finalized.finalizedBy}. This record does not calculate playoff placements, MRPs, Q-pools, payouts, or an official ACC export.</p>
    {(access.role === "director" || access.role === "co_director") ? <Link className="guide-link" href={`/tournament/${tournamentId}/events/${event}/settlement`}>Open Post-event Draft</Link> : null}
    <Link className="guide-link" href={`/tournament/${tournamentId}/scorecard?event=${event}`}>Back to Scorecard</Link>
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link>
    <SharedDeviceSignOut />
  </section></main>;

  return <main className="auth-shell"><section className="auth-card standings-card" aria-labelledby="standings-title">
    <p className="eyebrow">TOURNAMENT RESULTS</p>
    <h1 id="standings-title">Preliminary Standings</h1>
    <p className="card-context">{standings.tournamentName} · {standings.eventName}</p>
    <p className="registration-note">Only verified or corrected games are included. Everything below is provisional; this screen does not decide final results or any money award.</p>
    <section className="correction-item" aria-labelledby="completion-title">
      <h2 id="completion-title">Scorecard completion</h2>
      <p>{standings.schedulePublished ? "Published schedule" : "Schedule not published"} · {standings.resolvedMatchCount} of {standings.scheduledMatchCount} scheduled matchups resolved.</p>
      <p>{standings.configuredGameCount === null ? "Configured game count is unavailable." : `${standings.configuredGameCount} games configured per player.`}</p>
      <strong>{standings.scheduledScorecardsComplete ? "Every scheduled matchup has verified or corrected scorecards." : "Standings are still in progress."}</strong>
    </section>
    {qualification ? <section className="correction-item" aria-labelledby="qualification-title">
      <h2 id="qualification-title">Qualification Preview</h2>
      <p>{qualification.preview.qualifierCount} qualifying place{qualification.preview.qualifierCount === 1 ? "" : "s"} · {qualification.preview.bracketSize}-player bracket · {qualification.preview.firstRoundByes} first-round bye{qualification.preview.firstRoundByes === 1 ? "" : "s"}.</p>
      {qualification.cutoffTie ? <p className="error-text" role="status">The qualification cutoff is tied. Compare head-to-head results if available; otherwise a one-game playoff is required before the qualifier and High Non-Qualifier can be identified.</p> : null}
      <ol>{qualification.provisionalQualifiers.map((row) => <li key={row.id}><strong>{row.displayName}</strong> · Numeric rank {row.numericRank}</li>)}</ol>
      {qualification.cutoffTie ? <div><h3>Unresolved cutoff tie</h3><ul>{qualification.cutoffTie.candidateIds.map((id) => <li key={id}>{qualification.preview.ranked.find((row) => row.id === id)?.displayName}</li>)}</ul></div> : null}
      {qualification.highNonQualifier ? <section className="registration-note" aria-labelledby="high-non-qualifier-title"><h3 id="high-non-qualifier-title">Provisional High Non-Qualifier</h3><p>{qualification.highNonQualifier.displayName} · Numeric rank {qualification.highNonQualifier.numericRank}</p></section> : null}
      {!qualification.cutoffTie && qualification.highNonQualifierTie ? <p className="error-text" role="status">The provisional High Non-Qualifier is tied and remains unresolved.</p> : null}
      <p className="auth-note">This preview does not show a winner or runner-up and does not calculate MRPs, Q-pools, or payouts.</p>
    </section> : <p className="registration-note">Enroll players before calculating a qualification preview.</p>}
    {qualification && (access.role === "director" || access.role === "co_director") ? <QualificationFinalizationClient
      actorId={access.user.id} tournamentId={tournamentId} eventId={event}
      canFinalize={standings.scheduledScorecardsComplete && !standings.rows.some((row) => row.tied)}
    /> : null}
    <div className="table-scroll"><table className="standings-table">
      <caption className="sr-only">Preliminary standings from verified scorecards</caption>
      <thead><tr><th scope="col">Numeric rank</th><th scope="col">Player</th><th scope="col">Status</th><th scope="col">Games</th><th scope="col">Game Points</th><th scope="col">Won</th><th scope="col">Plus</th><th scope="col">Minus</th><th scope="col">Net</th></tr></thead>
      <tbody>{standings.rows.map((row) => <tr key={row.participantId}>
        <td>{row.numericRank}{row.tied ? " (tie)" : ""}</td><th scope="row">{row.displayName}</th><td>{row.participantStatus.replace("_", " ")}</td><td>{row.verifiedGames}</td><td>{row.gamePoints}</td><td>{row.gamesWon}</td><td>+{row.plusPoints}</td><td>−{row.minusPoints}</td><td>{formatSignedNet(row.netSpreadPoints)}</td>
      </tr>)}{standings.rows.length === 0 ? <tr><td colSpan={9}>No event participants are available yet.</td></tr> : null}</tbody>
    </table></div>
    <Link className="guide-link" href={`/tournament/${tournamentId}/scorecard?event=${event}`}>Back to Scorecard</Link>
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link>
    <SharedDeviceSignOut />
  </section></main>;
}
