import Link from "next/link";
import { notFound } from "next/navigation";
import { SharedDeviceSignOut } from "../../../../components/shared-device-sign-out";
import { requireTournamentAccess } from "../../../../lib/auth/require-tournament-access";
import { isUuid } from "../../../../lib/api/validation";
import { buildPreliminaryQualification } from "../../../../lib/results/qualification-preview";
import { getPreliminaryEventStandings } from "../../../../lib/results/preliminary-standings";
import { getQualificationResult } from "../../../../lib/api/qualification-finalization";
import { getFinalizedEventReport } from "../../../../lib/api/finalized-event-report";
import { formatSignedNet } from "../../../../lib/score";
import { createServerOnlyAdminClient } from "../../../../lib/supabase/private-admin";
import { QualificationFinalizationClient } from "./qualification-finalization-client";
import { getTournamentResultEventSummary } from "../../../../lib/results/event-summary";
import { LiveStandingsRefresh } from "./live-standings-refresh";
import { isSidePoolWorkspace } from "../../../../lib/api/side-pools";
import { isTeamWorkspace } from "../../../../lib/api/team-operations";
import { isTeamResults } from "../../../../lib/api/team-results";

const formatUsd = (minor: number) => `$${(minor / 100).toFixed(2)}`;

export default async function PreliminaryResultsPage({ params, searchParams }: {
  params: Promise<{ tournamentId: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  const { tournamentId } = await params;
  const { event } = await searchParams;
  if (!isUuid(tournamentId) || (event !== undefined && !isUuid(event))) notFound();
  const access = await requireTournamentAccess(tournamentId);
  const canViewResults = ["viewer", "player", "cross_checker", "director", "co_director"].includes(access.role);
  const canManageDisputes = ["director", "co_director", "cross_checker", "judge"].includes(access.role);
  if (!event) {
    if (!canViewResults) notFound();
    const workspace = await getTournamentResultEventSummary(access.user.id, tournamentId);
    const events = workspace.events;
    return <main className="auth-shell"><section className="auth-card standings-card" aria-labelledby="results-events-title">
      <p className="eyebrow">TOURNAMENT RESULTS</p>
      <h1 id="results-events-title">Tournament Results</h1>
      <p className="card-context">{workspace.tournamentName}</p>
      <p className="registration-note">Choose an event to review its verified standings and qualification status.</p>
      {events.length ? <ul className="correction-list">{events.map((item) => <li className="correction-item" key={item.eventId}><strong>{item.name}</strong><p>{item.eventType.replace("_", " ")} · {item.format.replaceAll("_", " ")} · {item.participantCount} enrolled participant{item.participantCount === 1 ? "" : "s"}</p><Link className="guide-link" href={`/tournament/${tournamentId}/results?event=${item.eventId}`}>View Results</Link></li>)}</ul> : <p className="auth-note">No tournament events are active yet.</p>}
      <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link>
      <SharedDeviceSignOut />
    </section></main>;
  }
  const eventWorkspace = await getTournamentResultEventSummary(access.user.id, tournamentId);
  const selectedEvent = eventWorkspace.events.find((item) => item.eventId === event);
  if (!selectedEvent) notFound();
  if (selectedEvent.eventType === "satellite") return <main className="auth-shell"><section className="auth-card standings-card"><p className="eyebrow">TOURNAMENT RESULTS</p><h1>{selectedEvent.name} Results</h1><p className="card-context">{eventWorkspace.tournamentName}</p><p className="registration-note">Singles and paper-scored doubles Satellites use the same director-reviewed result package: cashing placements, prize amounts, Q-Pool and Side-Pool results, special hands, and cross-check evidence.</p><section className="correction-item"><h2>ACC reporting</h2><p><strong>MRPs: Not applicable—Satellite event</strong></p><p>Satellite results never qualify a player for Main or Consolation.</p><p>Scorecards and payout evidence are retained for at least twelve months. The downloadable report assists the director. Automatic ACC submission remains disabled until an interface is approved.</p></section><Link className="guide-link" href={`/tournament/${tournamentId}/satellite-results?event=${event}`}>Open Satellite Results</Link><Link className="guide-link" href={`/tournament/${tournamentId}/results`}>Previous Screen</Link><SharedDeviceSignOut/></section></main>;
  if (["doubles", "canadian_doubles"].includes(selectedEvent.format)) {
    const admin = createServerOnlyAdminClient();
    const [teamRead,resultRead] = await Promise.all([admin.rpc("get_event_team_workspace_v1", { p_actor_id: access.user.id, p_tournament_id: tournamentId }),admin.rpc("get_event_team_results_v1",{p_actor_id:access.user.id,p_tournament_id:tournamentId,p_event_id:event})]);
    const normalized = teamRead.data && typeof teamRead.data === "object" && !Array.isArray(teamRead.data) ? { ...teamRead.data as Record<string, unknown>, actorId: access.user.id } : teamRead.data;
    if (teamRead.error || resultRead.error || !isTeamWorkspace(normalized) || !isTeamResults(resultRead.data)) notFound();
    const teamEvent = normalized.events.find((item) => item.eventId === event);
    if (!teamEvent) notFound();
    const report=resultRead.data;
    return <main className="auth-shell"><section className="auth-card standings-card"><p className="eyebrow">TOURNAMENT RESULTS</p><h1>Live Team Standings</h1><p className="card-context">{normalized.tournamentName} · {teamEvent.name}</p><p className="registration-note">Only verified or officially corrected team games are included. {report.eventType==="satellite"?"Satellite results do not award MRPs or qualify teams for Main or Consolation.":`${report.qualificationCount} team${report.qualificationCount===1?"":"s"} qualify from ${report.entries.length} entries when the cutoff is resolved.`}</p>{report.qualificationBlocked?<p className="error-text" role="status">The qualification cutoff is tied. Compare the applicable head-to-head result; if it does not resolve the tie, the required playoff must be recorded before qualification is final.</p>:null}<div className="table-scroll"><table className="standings-table"><thead><tr><th>Rank</th><th>Team and members</th><th>Game Points</th><th>Won</th><th>Plus</th><th>Minus</th><th>Net</th></tr></thead><tbody>{report.entries.map((row)=><tr key={row.teamEntryId}><td>{row.rank}{row.qualifies?" · Q":row.qualificationStatus==="tie_review_required"?" · Tie review":""}</td><th>{row.teamName}<br/><small>{row.members.map((member)=>member.accNumber?`${member.name} (${member.accNumber})`:member.name).join(" / ")}</small></th><td>{row.gamePoints}</td><td>{row.gamesWon}</td><td>+{row.plusSpreadPoints}</td><td>−{row.minusSpreadPoints}</td><td>{formatSignedNet(row.netSpreadPoints)}</td></tr>)}</tbody></table></div><p className="auth-note">Both team members remain attached to the team entry for finance, pools, results, and ACC-ready reporting.</p><a className="guide-link" href={`/api/v1/tournaments/${tournamentId}/events/${event}/team-results.pdf`}>Download Team Results PDF</a><Link className="guide-link" href={`/tournament/${tournamentId}/teams`}>Open Team Scorecards</Link><Link className="guide-link" href={`/tournament/${tournamentId}/results`}>Previous Screen</Link><SharedDeviceSignOut/></section></main>;
  }
  const standings = await getPreliminaryEventStandings(tournamentId, event);
  const qualification = buildPreliminaryQualification(standings.rows);
  const admin = createServerOnlyAdminClient();
  const sidePoolResult = await admin.rpc("get_event_side_pool_workspace_v1", { p_actor_id: access.user.id, p_tournament_id: tournamentId });
  const sidePoolWorkspace = !sidePoolResult.error && isSidePoolWorkspace(sidePoolResult.data) ? sidePoolResult.data : null;
  const sidePools = sidePoolWorkspace?.events.find((item) => item.eventId === event)?.pools ?? [];
  const finalized = await getQualificationResult(admin, access.user.id, tournamentId, event);
  const finalReport = finalized ? await getFinalizedEventReport(admin, access.user.id, tournamentId, event) : null;

  if (finalized) return <main className="auth-shell"><section className="auth-card standings-card" aria-labelledby="standings-title">
    <p className="eyebrow">TOURNAMENT RESULTS</p>
    <h1 id="standings-title">{finalReport ? "Final Event Results" : "Finalized Qualification"}</h1>
    <p className="card-context">{finalized.tournamentName} · {finalized.eventName}</p>
    {finalReport ? <>
      <p className="registration-note">Director-reviewed event results and awards from the finalized tournament record.</p>
      <section className="correction-item" aria-labelledby="playoff-results-title">
        <h2 id="playoff-results-title">Event Results</h2>
        <ol>{finalReport.playoffPlacements.map((row) => <li key={row.participantId}>
          <strong>{row.placement === 1 ? "Winner" : row.placement === 2 ? "Runner-up" : `Place ${row.placement}`}: {row.displayName}</strong> · Prize {formatUsd(row.prizeAmountMinor)}
        </li>)}</ol>
      </section>
      <section className="correction-item" aria-labelledby="qualifier-list-title">
        <h2 id="qualifier-list-title">Qualifiers</h2>
        <ol>{finalReport.qualifiers.map((row) => <li key={row.participantId}>
          <strong>{row.displayName}</strong> · {row.gamePoints} game points · {row.gamesWon} won · +{row.plusPoints} / -{row.minusPoints} spread · {formatSignedNet(row.netSpreadPoints)} net · {row.mrpPoints} MRPs · Q Pool {formatUsd(row.qPoolAwardMinor)}{row.otherAwardMinor ? ` · Other ${formatUsd(row.otherAwardMinor)}` : ""}
        </li>)}</ol>
        <section className="registration-note" aria-labelledby="high-non-qualifier-title">
          <h3 id="high-non-qualifier-title">High Non-Qualifier</h3>
          <p><strong>{finalReport.highNonQualifier.displayName}</strong> · {finalReport.highNonQualifier.gamePoints} game points · {finalReport.highNonQualifier.gamesWon} won · +{finalReport.highNonQualifier.plusPoints} / -{finalReport.highNonQualifier.minusPoints} spread · {formatSignedNet(finalReport.highNonQualifier.netSpreadPoints)} net</p>
        </section>
      </section>
      <p className="auth-note">Finalized by {finalReport.finalizedBy}. MRP and award values were entered and reviewed by the director; this is not an automatic ACC submission.</p>
    </> : <>
      <p className="registration-note">This is the locked qualifying-round ranking. Playoff winner, runner-up, MRPs, and awards appear after the director completes final event reconciliation.</p>
      <section className="correction-item" aria-labelledby="qualifier-list-title">
        <h2 id="qualifier-list-title">Qualifiers</h2>
        <ol>{finalized.qualifiers.map((row) => <li key={row.participantId}>
          <strong>{row.displayName}</strong> · {row.gamePoints} game points · {row.gamesWon} won · +{row.plusPoints} / -{row.minusPoints} spread · {formatSignedNet(row.netSpreadPoints)} net
        </li>)}</ol>
        <section className="registration-note" aria-labelledby="high-non-qualifier-title">
          <h3 id="high-non-qualifier-title">High Non-Qualifier</h3>
          <p><strong>{finalized.highNonQualifier.displayName}</strong> · {finalized.highNonQualifier.gamePoints} game points · {finalized.highNonQualifier.gamesWon} won · +{finalized.highNonQualifier.plusPoints} / -{finalized.highNonQualifier.minusPoints} spread · {formatSignedNet(finalized.highNonQualifier.netSpreadPoints)} net</p>
        </section>
      </section>
      <p className="auth-note">Finalized by {finalized.finalizedBy}. This record does not calculate playoff placements, MRPs, Q-pools, payouts, or an official ACC export.</p>
    </>}
    {sidePools.length ? <section className="correction-item"><h2>Side Pools</h2>{sidePools.map((pool) => <section key={pool.poolId}><strong>{pool.displayName}</strong><p>Collected {formatUsd(pool.collectedMinor)} · paid {formatUsd(pool.paidMinor)} · {pool.finalized ? "finalized" : "open"}</p><ol>{pool.payouts.map((payout) => <li key={payout.payoutId}>{payout.displayName} · place {payout.placement} · {formatUsd(payout.amountMinor)}</li>)}</ol></section>)}</section> : null}
    {finalReport ? <a className="guide-link" href={`/api/v1/tournaments/${tournamentId}/events/${event}/final-results.pdf`}>Download Final Event Results PDF</a> : null}
    {canManageDisputes ? <Link className="guide-link" href={`/tournament/${tournamentId}/events/${event}/disputes`}>Open Event Dispute Register</Link> : null}
    {(access.role === "director" || access.role === "co_director") ? <Link className="guide-link" href={`/tournament/${tournamentId}/events/${event}/settlement`}>Open Post-event Draft</Link> : null}
    <Link className="guide-link" href={`/tournament/${tournamentId}/scorecard?event=${event}`}>Back to Scorecard</Link>
    {canViewResults ? <Link className="guide-link" href={`/tournament/${tournamentId}/results`}>Previous Screen</Link> : null}
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link>
    <SharedDeviceSignOut />
  </section></main>;

  return <main className="auth-shell"><section className="auth-card standings-card" aria-labelledby="standings-title">
    <p className="eyebrow">TOURNAMENT RESULTS</p>
    <h1 id="standings-title">Live Preliminary Standings</h1>
    <p className="card-context">{standings.tournamentName} · {standings.eventName}</p>
    <LiveStandingsRefresh resolvedGameCount={standings.resolvedMatchCount} unresolvedTieCount={qualification?.preview.unresolvedTies.length ?? 0} generatedAt={new Date().toISOString()} />
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
    {sidePools.length ? <section className="correction-item"><h2>Side Pool Status</h2>{sidePools.map((pool) => <p key={pool.poolId}><strong>{pool.displayName}</strong> · {pool.elections.filter((item) => item.elected).length} elected · collected {formatUsd(pool.collectedMinor)} · payouts {formatUsd(pool.paidMinor)}</p>)}</section> : null}
    {qualification && (access.role === "director" || access.role === "co_director") ? <QualificationFinalizationClient
      actorId={access.user.id} tournamentId={tournamentId} eventId={event}
      canFinalize={standings.scheduledScorecardsComplete && !standings.rows.some((row) => row.tied)}
    /> : null}
    {canManageDisputes ? <Link className="guide-link" href={`/tournament/${tournamentId}/events/${event}/disputes`}>Open Event Dispute Register</Link> : null}
    <div className="table-scroll"><table className="standings-table">
      <caption className="sr-only">Live preliminary standings from verified scorecards</caption>
      <thead><tr><th scope="col">Numeric rank</th><th scope="col">Player</th><th scope="col">Status</th><th scope="col">Games</th><th scope="col">Game Points</th><th scope="col">Won</th><th scope="col">Plus</th><th scope="col">Minus</th><th scope="col">Net</th></tr></thead>
      <tbody>{standings.rows.map((row) => <tr key={row.participantId}>
        <td>{row.numericRank}{row.tied ? " (tie)" : ""}</td><th scope="row">{row.displayName}</th><td>{row.participantStatus.replace("_", " ")}</td><td>{row.verifiedGames}</td><td>{row.gamePoints}</td><td>{row.gamesWon}</td><td>+{row.plusPoints}</td><td>−{row.minusPoints}</td><td>{formatSignedNet(row.netSpreadPoints)}</td>
      </tr>)}{standings.rows.length === 0 ? <tr><td colSpan={9}>No event participants are available yet.</td></tr> : null}</tbody>
    </table></div>
    <Link className="guide-link" href={`/tournament/${tournamentId}/scorecard?event=${event}`}>Back to Scorecard</Link>
    {canViewResults ? <Link className="guide-link" href={`/tournament/${tournamentId}/results`}>Previous Screen</Link> : null}
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link>
    <SharedDeviceSignOut />
  </section></main>;
}
