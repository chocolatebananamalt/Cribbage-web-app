import{playoffProgressEnabledV37,progressEventEligibleV37}from'../../../../lib/playoffs/progress-v37';
import { integratedTestBackendRef, integratedTestBackendOrigin } from '../../../../lib/integrated-test-target.ts';
import{manualPreparationEnabledV1}from'../../../../lib/playoffs/modern-manual-preparation-contract-v1';
import{modernManualResultsEnabledV1,getModernManualResultsV1}from'../../../../lib/results/modern-manual-playoff-results-v1';
import{ModernManualPlayoffResultsV1}from'../../../../components/modern-manual-playoff-results-v1';
import { modernPrizeExportEnabledV2 } from '../../../../lib/results/modern-prize-export-v2';
import{nativeMixedProposedMrpEnabledV1}from'../../../../lib/results/native-mixed-proposed-mrp-v1';
import{readNativeMixedProposedMrpV1}from'../../../../lib/results/native-mixed-proposed-mrp-read-v1';
import{NativeMixedProposedMrpV1}from'../../../../components/native-mixed-proposed-mrp-v1';
import{resultBasedMrpEnabledV1}from'../../../../lib/results/result-based-mrp-v1';
import{readResultBasedMrpProductionV1}from'../../../../lib/results/result-based-mrp-production-v1';
import{ResultBasedMrpV1}from'../../../../components/result-based-mrp-v1';
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
import { isQualificationTieWorkspace, type QualificationTieWorkspace } from "../../../../lib/api/qualification-ties";
import QualificationTiesClient from "./qualification-ties-client";
import { getSyntheticEventContext } from "../../../../lib/paper-games/synthetic-event-context";
import { SyntheticEventNotice } from "../../../../components/synthetic-event-notice";
import { consolationPlayoffEntry } from "../../../../lib/results/consolation-playoff-navigation";
import { nativeMixedEventResultsEnabledV1 } from "../../../../lib/results/native-mixed-event-results-v1";
import { readNativeMixedEventResultsV1 } from "../../../../lib/results/native-mixed-event-results-read-v1";
import { NativeMixedEventResultsV1 } from "../../../../components/native-mixed-event-results-v1";
import { createClient as createNormalClient } from "../../../../lib/supabase/server";
import { getPublicSupabaseEnv } from "../../../../lib/env";
import { nativeMixedPreparationPageEnabledV1 } from "../../../../lib/seating/native-mixed-pilot-preparation-v1";
import { modernPrizeResultsEnabledV2, readModernPrizeResultsV2 } from "../../../../lib/results/modern-prize-results-v2";
import { ModernPrizeResultsV2 } from "../../../../components/modern-prize-results-v2";
import {createSelectedStepAwardTransportV3,selectedStepAwardResultsEnabledV3,selectedStepAwardPageEnabledV3} from '../../../../lib/api/selected-step-award-transport-v3';
import { nativePoolAwardResultsEnabledV2, readNativePoolAwardResultsV2 } from "../../../../lib/results/native-pool-award-results-v2";
import { NativePoolAwardResultsV2 } from "../../../../components/native-pool-award-results-v2";
import { selectedStepPoolResultsEnabledV3, readSelectedStepPoolResultsV3 } from "../../../../lib/results/selected-step-pool-results-v3";
import { SelectedStepPoolResultsV3 } from "../../../../components/selected-step-pool-results-v3";

const formatUsd = (minor: number) => `$${(minor / 100).toFixed(2)}`;

export default async function PreliminaryResultsPage({ params, searchParams }: {
  params: Promise<{ tournamentId: string }>;
  searchParams: Promise<{ event?: string; practice?: string | string[] }>;
}) {
  const { tournamentId } = await params;
  const { event, practice } = await searchParams;
  if (!isUuid(tournamentId) || (event !== undefined && !isUuid(event))) notFound();
  // An explicit practice request must never become ordinary results when its
  // gate is closed or its query is malformed (including repeated values).
  if (practice !== undefined && (practice !== "mixed" || !event || !nativeMixedEventResultsEnabledV1())) notFound();
  const access = await requireTournamentAccess(tournamentId);
  if (practice !== undefined && !access.roles.some(r => r === "director" || r === "co_director")) notFound();
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
  // Private closed candidate uses the ordinary Results location, explicitly
  // opted into by an existing official. No current ordinary result is replaced
  // and no SDK/read is constructed while the literal gate is closed.
  if (practice === "mixed") {
    if (!nativeMixedEventResultsEnabledV1() || !access.roles.some(r => r === "director" || r === "co_director")) notFound();
    if(getPublicSupabaseEnv().url!==integratedTestBackendOrigin())notFound();
    const client=await createNormalClient(),claims=await client.auth.getClaims(),sessionId=claims.data?.claims?.session_id;
    const report=typeof sessionId==='string'?await readNativeMixedEventResultsV1({client,enabled:nativeMixedEventResultsEnabledV1,scope:{projectRef:integratedTestBackendRef(),scope:{actorId:access.user.id,tournamentId,eventId:event},sessionId,eventKind:selectedEvent.eventType,format:selectedEvent.format}}):null;
    const showMixedMrp=nativeMixedProposedMrpEnabledV1();
    const mixedMrp=showMixedMrp&&typeof sessionId==='string'?await readNativeMixedProposedMrpV1({client,context:{projectRef:integratedTestBackendRef(),scope:{actorId:access.user.id,tournamentId,eventId:event},sessionId}}):null;
    return <main className="auth-shell">{showMixedMrp&&<NativeMixedProposedMrpV1 view={mixedMrp?.status==='available'?mixedMrp:null}/>} {report?.status==='unsupported'?<section><h1>{selectedEvent.name} - Practice Results</h1><p role="status">{report.reason}</p></section>:<NativeMixedEventResultsV1 view={report?.status==='available'?report.view:null} eventName={selectedEvent.name}/>}
      {nativeMixedPreparationPageEnabledV1()&&<Link className="guide-link" href={`/tournament/${tournamentId}/rehearsal-prepare/${event}`}>Back to Rehearsal Preparation</Link>}<Link className="guide-link" href={`/tournament/${tournamentId}/results?event=${event}`}>Standard Event Results</Link><Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link><SharedDeviceSignOut/>
    </main>;
  }
  const syntheticContext = await getSyntheticEventContext(access.user.id, tournamentId);
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
  let qualification = buildPreliminaryQualification(standings.rows);
  const admin = createServerOnlyAdminClient();
  const sidePoolResult = await admin.rpc("get_event_side_pool_workspace_v1", { p_actor_id: access.user.id, p_tournament_id: tournamentId });
  const sidePoolWorkspace = !sidePoolResult.error && isSidePoolWorkspace(sidePoolResult.data) ? sidePoolResult.data : null;
  const sidePools = sidePoolWorkspace?.events.find((item) => item.eventId === event)?.pools ?? [];
  const finalized = await getQualificationResult(admin, access.user.id, tournamentId, event);
  const finalReport = finalized ? await getFinalizedEventReport(admin, access.user.id, tournamentId, event) : null;
  const showResultMrp=!!finalized&&resultBasedMrpEnabledV1()&&access.roles.some(r=>r==='director'||r==='co_director');
  const resultMrp=showResultMrp?await readResultBasedMrpProductionV1({tournamentId,eventId:event}):null;
  const showSelectedStepPrizes = !!finalized && !finalReport && !syntheticContext && selectedStepAwardResultsEnabledV3()
    && access.role === 'director' && ['main','consolation'].includes(selectedEvent.eventType) && selectedEvent.format === 'standard_singles';
  let selectedStepPrizes: Awaited<ReturnType<ReturnType<typeof createSelectedStepAwardTransportV3>['results']>> = null;
  if(showSelectedStepPrizes&&finalized){try{const normal=await createNormalClient();
    // The transport verifies the live normal identity/session and primary role
    // before invoking this lazy privileged read; it never enables a writer.
    const port=createSelectedStepAwardTransportV3(normal,(name,args)=>createServerOnlyAdminClient().rpc(name,args),{actorId:access.user.id,tournamentId,eventId:event},{read:selectedStepAwardResultsEnabledV3,write:()=>false});
    const reviewed=await port.results(finalized.resultVersionId);if(reviewed?.eventKind===selectedEvent.eventType)selectedStepPrizes=reviewed;
  }catch{/* Hold unavailable or stale awards; never substitute historical receipts. */}}
  const showModernPrizes = !showSelectedStepPrizes && !!finalized && !finalReport && !syntheticContext && modernPrizeResultsEnabledV2()
    && access.roles.some(role => role === "director" || role === "co_director")
    && ["main", "consolation"].includes(selectedEvent.eventType) && selectedEvent.format === "standard_singles";
  let modernPrizes: Awaited<ReturnType<typeof readModernPrizeResultsV2>> = null;
  if (showModernPrizes && finalized) {
    const normal = await createNormalClient();
    const reviewed = await readModernPrizeResultsV2(normal, { actorId: access.user.id, tournamentId, eventId: event }, modernPrizeResultsEnabledV2, finalized.resultVersionId);
    if (reviewed?.eventKind === selectedEvent.eventType) modernPrizes = reviewed;
  }
  const showNativePoolAwards = !!finalized && !finalReport && !syntheticContext && nativePoolAwardResultsEnabledV2()
    && access.roles.includes("director") && selectedEvent.eventType === "main" && selectedEvent.format === "standard_singles";
  let nativePoolAwards: Awaited<ReturnType<typeof readNativePoolAwardResultsV2>> = null;
  if (showNativePoolAwards && finalized) {
    const normal = await createNormalClient();
    nativePoolAwards = await readNativePoolAwardResultsV2({ authenticated: normal, serviceRpc: (name, args) => admin.rpc(name, args),
      scope: { actorId: access.user.id, tournamentId, eventId: event }, qualificationId: finalized.resultVersionId, enabled: nativePoolAwardResultsEnabledV2 });
  }
  const consolationPlayoffHref = finalized ? consolationPlayoffEntry({tournamentId,eventId:event,role:access.role,eventType:selectedEvent.eventType,format:selectedEvent.format,qualifierCount:finalized.qualifierCount,syntheticEventIds:syntheticContext?.eventIds ?? []}) : null;
  const showSelectedPoolAwards = !!finalized && !finalReport && !syntheticContext && selectedStepPoolResultsEnabledV3()
    && access.roles.includes("director") && selectedEvent.eventType === "main" && selectedEvent.format === "standard_singles";
  let selectedPoolAwards: Awaited<ReturnType<typeof readSelectedStepPoolResultsV3>> = null;
  if (showSelectedPoolAwards && finalized) {
    const normal = await createNormalClient();
    selectedPoolAwards = await readSelectedStepPoolResultsV3({authenticated:normal,serviceRpc:(name,args)=>admin.rpc(name,args),
      scope:{actorId:access.user.id,tournamentId,eventId:event},qualificationId:finalized.resultVersionId,enabled:selectedStepPoolResultsEnabledV3});
  }
  const showManualPlayoffs=!!finalized&&!finalReport&&!syntheticContext&&modernManualResultsEnabledV1()&&access.roles.some(r=>r==='director'||r==='co_director')&&['main','consolation'].includes(selectedEvent.eventType)&&selectedEvent.format==='standard_singles';
  const manualPlayoffs=showManualPlayoffs&&finalized?await getModernManualResultsV1(await createNormalClient(),{actorId:access.user.id,tournamentId,eventId:event},finalized.resultVersionId):null;
  let tieWorkspace: QualificationTieWorkspace | null = null;
  const canReviewQualificationTies = access.role === "director" || access.role === "co_director";
  if (canReviewQualificationTies && qualification?.preview.unresolvedTies.length) {
    const tieRead = await admin.rpc("get_qualification_tie_workspace_v1", { p_actor_id: access.user.id, p_tournament_id: tournamentId, p_event_id: event });
    if (!tieRead.error && isQualificationTieWorkspace(tieRead.data, tournamentId, event)) {
      try {
        const resolved = buildPreliminaryQualification(standings.rows, tieRead.data.groups
          .filter(group => group.resolution !== null).map(group => ({ candidateIds: group.candidateIds, winnerId: group.resolution!.winnerId })));
        tieWorkspace = tieRead.data;
        if (!finalized) qualification = resolved;
      } catch { /* Mismatched source or pairs stay unresolved; no client ranking fallback. */ }
    }
  }

  if (finalized) return <main className="auth-shell"><section className="auth-card standings-card" aria-labelledby="standings-title">
    {syntheticContext && <SyntheticEventNotice context={syntheticContext}/>}
    <p className="eyebrow">TOURNAMENT RESULTS</p>
    <h1 id="standings-title">{finalReport ? "Final Event Results" : "Finalized Qualification"}</h1>
    <p className="card-context">{finalized.tournamentName} · {finalized.eventName}</p>
    {tieWorkspace?.groups.some(group => group.resolution) ? <section className="correction-item"><h2>Qualification tie audit</h2><p>Original qualifying totals remain unchanged. These decisions determine ranking only.</p><ul>{tieWorkspace.groups.filter(group => group.resolution).map(group => <li key={group.resolution!.id}><strong>{standings.rows.find(row => row.participantId === group.resolution!.winnerId)?.displayName} ranks higher</strong> after {group.resolution!.method === "head_to_head" ? "qualifying-round head-to-head" : "a separate one-game playoff"}. Evidence: {group.resolution!.evidenceReference}. Reason: {group.resolution!.reason}. Recorded by {group.resolution!.recordedBy} at {group.resolution!.recordedAt}.</li>)}</ul></section> : null}
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
    {showResultMrp&&<ResultBasedMrpV1 view={resultMrp?.status==='available'?resultMrp:null}/>}
    {manualPreparationEnabledV1()&&finalized&&access.roles.includes("director")&&!syntheticContext&&<Link href={`/tournament/${tournamentId}/manual-playoffs/prepare/${event}`}>Prepare Manual Playoff Rules, Start and Matches</Link>}
    {showManualPlayoffs&&<ModernManualPlayoffResultsV1 view={manualPlayoffs}/>}
    {playoffProgressEnabledV37()&&finalized&&access.role==='director'&&!syntheticContext&&progressEventEligibleV37(selectedEvent)&&<Link prefetch={false} href={`/tournament/${tournamentId}/events/${event}/playoff-progress`}>Review Current Playoff Progress</Link>}
    {showModernPrizes && <ModernPrizeResultsV2 view={modernPrizes}/>}
    {showSelectedStepPrizes&&<><ModernPrizeResultsV2 view={selectedStepPrizes}/>{selectedStepAwardPageEnabledV3()&&<Link className="guide-link" href={`/tournament/${tournamentId}/finance/${event}/selected-step-awards`}>Review Regular Prize Awards</Link>}</>}
      {showSelectedStepPrizes && selectedStepPrizes && modernPrizeExportEnabledV2() && <a href={`/api/v1/tournaments/${tournamentId}/events/${event}/regular-prize-report`}>Download Current Unpaid Regular Prize Awards CSV</a>}
    {showSelectedPoolAwards && <SelectedStepPoolResultsV3 view={selectedPoolAwards}/>}
    {showNativePoolAwards && <NativePoolAwardResultsV2 view={nativePoolAwards}/>}
    {finalReport ? <a className="guide-link" href={`/api/v1/tournaments/${tournamentId}/events/${event}/final-results.pdf`}>Download Final Event Results PDF</a> : null}
    {canManageDisputes ? <Link className="guide-link" href={`/tournament/${tournamentId}/events/${event}/disputes`}>Open Event Dispute Register</Link> : null}
    {(access.role === "director" || access.role === "co_director") && selectedEvent.eventType === "main" && finalized.qualifierCount === 5 ? <Link className="guide-link" href={`/tournament/${tournamentId}/events/${event}/playoff-v4`}>Record Five-qualifier Playoff and Byes</Link> : null}
    {consolationPlayoffHref ? <Link className="guide-link" href={consolationPlayoffHref}>Review Simulated Consolation Playoff</Link> : null}
    {(access.role === "director" || access.role === "co_director") ? <Link className="guide-link" href={`/tournament/${tournamentId}/events/${event}/settlement`}>Open Post-event Draft</Link> : null}
    <Link className="guide-link" href={`/tournament/${tournamentId}/scorecard?event=${event}`}>Back to Scorecard</Link>
    {canViewResults ? <Link className="guide-link" href={`/tournament/${tournamentId}/results`}>Previous Screen</Link> : null}
    <Link className="guide-link" href={`/tournament/${tournamentId}`}>Back to Tournament</Link>
    <SharedDeviceSignOut />
  </section></main>;

  // "Standings are still in progress" and "Resolve every completion notice and
  // ranking tie" are both true and both useless: the reader is told a state,
  // not which of seven conditions is unmet or for whom. Verified live on an
  // event with 24 of 24 matchups resolved, 0 unresolved ties, 12 games
  // configured per player and a published schedule that only gives each of the
  // 5 players 9 or 10. Finalize Qualification was permanently disabled and
  // nothing on the page said why. The conditions are the ones
  // preliminary-standings-contract.ts computes `complete` from, in that order.
  const shortOfConfigured = standings.configuredGameCount === null ? [] : standings.rows
    .filter((row) => row.verifiedGames !== standings.configuredGameCount)
    .map((row) => `${row.displayName} has ${row.verifiedGames}`);
  const tiedRows = standings.rows.filter((row) => qualification?.preview.unresolvedTies.some(tie => tie.candidateIds.includes(row.participantId)));
  const completionBlockedReason = standings.scheduledScorecardsComplete ? null
    : !standings.schedulePublished ? "The schedule for this event is not published yet, so there are no scheduled matchups to complete. Publish it on the Game schedule screen."
    : standings.configuredGameCount === null ? "This event has no configured games-per-player count, so completion cannot be measured. Set it on the Set Up Tournament screen."
    : standings.rows.length === 0 ? "No player is enrolled in this event yet, so there is nothing to complete. Enroll players on the Event participants screen."
    : standings.persistedMatchCount !== standings.scheduledMatchCount ? `The published schedule lists ${standings.scheduledMatchCount} matchups but only ${standings.persistedMatchCount} games exist. Republish the schedule on the Game schedule screen.`
    : standings.resolvedMatchCount !== standings.scheduledMatchCount ? `${standings.scheduledMatchCount - standings.resolvedMatchCount} of ${standings.scheduledMatchCount} scheduled matchups still have no verified or corrected scorecard. Finish them on the scoring screens.`
    : shortOfConfigured.length > 0 ? `This event is configured for ${standings.configuredGameCount} games per player, and the published schedule does not give every player that many: ${shortOfConfigured.join(", ")}. Every scheduled matchup is already resolved, so playing on will not close this gap. Either change the configured games-per-player count to match the schedule, or republish a schedule that gives all ${standings.rows.length} players ${standings.configuredGameCount} games each.`
    : "Completion is still short. Recheck the scheduled matchups on the Game schedule screen.";
  const finalizeBlockedReason = completionBlockedReason
    ?? (tiedRows.length > 0 ? `${tiedRows.length === 1 ? `${tiedRows[0].displayName} is` : `${tiedRows.map((row) => row.displayName).join(", ")} are`} tied on the ranking, and a tie has to be resolved before the qualifying ranking can be locked.` : null);

  return <main className="auth-shell"><section className="auth-card standings-card" aria-labelledby="standings-title">
    {syntheticContext && <SyntheticEventNotice context={syntheticContext}/>}
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
      {completionBlockedReason ? <p className="auth-note">{completionBlockedReason}</p> : null}
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
    {canReviewQualificationTies && standings.rows.some(row => row.tied) ? <QualificationTiesClient
      actorId={access.user.id} tournamentId={tournamentId} eventId={event} source={tieWorkspace} syntheticContext={syntheticContext}
      candidates={standings.rows.map(row => ({ id: row.participantId, displayName: row.displayName }))}
    /> : null}
    {qualification && (access.role === "director" || access.role === "co_director") ? <QualificationFinalizationClient
      actorId={access.user.id} tournamentId={tournamentId} eventId={event}
      canFinalize={standings.scheduledScorecardsComplete && qualification.preview.finalizable && (!tieWorkspace || (!tieWorkspace.finalized && tieWorkspace.blockers.length === 0))}
      blockedReason={finalizeBlockedReason}
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
