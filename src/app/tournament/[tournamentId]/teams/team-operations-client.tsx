"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isRejectedTeamMutation, isTeamMutation, isTeamMutationResult, isTeamWorkspace,
  type TeamEvent, type TeamMutation, type TeamWorkspace,
} from "../../../../lib/api/team-operations";
import { canDeleteOfflineQueueRecord } from "../../../../lib/offline-score-queue-contract";
import { deleteOfflineSubmission,provisionOfflineTeamSubmission,queueOfflineSubmission,readOfflineSubmission,readPreparedOfflineSubmissionCapability,replayOfflineTeamSubmission } from "../../../../lib/offline-score-queue";
import { JudgeCallButton } from "../game/[gameId]/judge-call-button";

const errors: Record<string, string> = {
  member_already_teamed: "One of these players is already assigned to a team in this event.",
  team_authority_unavailable: "A Digital team needs a captain with a linked app account.",
  team_configuration_incomplete: "Resolve every Digital team’s designated scorer before starting play.",
  confirmation_not_available: "This entry cannot be confirmed by this account.",
  wrong_scorecard_authority: "Only the designated scorer may enter this Digital team’s result.",
  invalid_schedule: "The schedule is incomplete or contains a conflicting team, game, or seat.",
  not_independent_confirmer: "Confirm the opposing team’s entry; a scorer cannot confirm their own submission.",
  roster_account_mismatch: "Sign in with the account linked to this roster entry to claim the team.",
  independent_official_required: "A cross-checker who did not play this game must make the correction.",
  independent_reviewer_required: "A different independent official must review this correction.",
  independent_paper_reviewer_required: "A second official who did not transcribe or play this game must re-enter the paper card.",
  paper_review_required: "The paper card needs a matching second-official review before confirmation.",
  paper_review_not_available: "This paper card is not ready for independent review.",
  mismatch_not_available: "This mismatch changed or already has a resolution in review.",
  mismatch_resolution_unavailable: "This mismatch resolution changed or was already reviewed.",
  reason_required: "This tournament requires a brief reason for score corrections.",
  stale_game_version: "This game changed before the correction was saved. Review the current result and try again.",
};

function roundRobin(teams: TeamEvent["teams"], gameCount: number) {
  const ids = teams.map((team) => team.teamEntryId);
  if (ids.length < 2 || ids.length % 2) return [];
  const games: Array<{gameId:string;gameNumber:number;matchInstance:number;sideATeamEntryId:string;sideBTeamEntryId:string;sideATableSeat:string;sideBTableSeat:string}> = [];
  let order = [...ids];
  for (let game = 1; game <= gameCount; game += 1) {
    for (let match = 0; match < order.length / 2; match += 1) {
      games.push({
        gameId: crypto.randomUUID(), gameNumber: game, matchInstance: match + 1,
        sideATeamEntryId: order[match], sideBTeamEntryId: order[order.length - 1 - match],
        sideATableSeat: `${String.fromCharCode(65 + Math.floor(match / 10))}-${match * 2 + 1}`,
        sideBTableSeat: `${String.fromCharCode(65 + Math.floor(match / 10))}-${match * 2 + 2}`,
      });
    }
    order = [order[0], order[order.length - 1], ...order.slice(1, -1)];
  }
  return games;
}

export default function TeamOperationsClient({ tournamentId }: { tournamentId: string }) {
  const [data, setData] = useState<TeamWorkspace | null>(null);
  const [message, setMessage] = useState("Loading team events…");
  const [busy, setBusy] = useState(false);
  const [eventId, setEventId] = useState("");
  const [captain, setCaptain] = useState("");
  const [partner, setPartner] = useState("");
  const [mode, setMode] = useState<"digital" | "paper">("digital");
  const [marginByGame, setMarginByGame] = useState<Record<string, string>>({});
  const [winnerByGame, setWinnerByGame] = useState<Record<string, "a" | "b">>({});
  const [reasonByGame, setReasonByGame] = useState<Record<string, string>>({});
  const [offlineReady, setOfflineReady] = useState<Record<string, boolean>>({});
  const [offlineQueued, setOfflineQueued] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const response = await fetch(`/api/v1/tournaments/${tournamentId}/teams`, { cache: "no-store" });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok || !isTeamWorkspace(value)) throw new Error("load");
    setData(value);
    setEventId((current) => current || value.events[0]?.eventId || "");
    setMessage(value.events.length ? "Team records are current." : "No Traditional or Canadian Doubles event has been activated yet.");
  }, [tournamentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load().catch(() => setMessage("Team events are temporarily unavailable.")), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const eligible = data.events.flatMap((teamEvent) => teamEvent.started ? teamEvent.games.filter((game) => {
      const a = teamEvent.teams.find((team) => team.teamEntryId === game.sideATeamEntryId);
      const b = teamEvent.teams.find((team) => team.teamEntryId === game.sideBTeamEntryId);
      const side = a?.designatedScorerProfileId === data.actorId ? "a" : b?.designatedScorerProfileId === data.actorId ? "b" : null;
      return !!side && !game.submissions.some((submission) => submission.side === side);
    }) : []);
    let active = true;
    const prepareAndSync = async () => {
      let synchronized = false;
      for (const game of eligible) {
        if (navigator.onLine) {
          try { await provisionOfflineTeamSubmission(data.actorId, game.gameId); if (active) setOfflineReady((current) => ({ ...current, [game.gameId]: true })); } catch { /* remain visibly not ready */ }
          try {
            const record = await readOfflineSubmission(data.actorId, game.gameId);
            if (record) {
              const replay = await replayOfflineTeamSubmission(record);
              if (canDeleteOfflineQueueRecord(record, replay.payload)) { await deleteOfflineSubmission(record.intent.queueId); synchronized = true; if (active) setOfflineQueued((current) => ({ ...current, [game.gameId]: false })); }
            }
          } catch { /* the durable queue remains for the next reconnect */ }
        }
      }
      if (active && synchronized) await load();
    };
    void prepareAndSync();
    const reconnect = () => void prepareAndSync();
    window.addEventListener("online", reconnect);
    return () => { active = false; window.removeEventListener("online", reconnect); };
  }, [data, load]);

  async function mutate(value: TeamMutation) {
    if (busy || !isTeamMutation(value)) return;
    setBusy(true);
    setMessage("Saving and auditing…");
    try {
      const response = await fetch(`/api/v1/tournaments/${tournamentId}/teams`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value),
      });
      const result: unknown = await response.json().catch(() => null);
      if (response.ok && isTeamMutationResult(result)) { await load(); setMessage("Saved and audited."); }
      else if (isRejectedTeamMutation(result)) setMessage(errors[result.code] ?? `Not saved: ${result.code.replaceAll("_", " ")}.`);
      else setMessage("The operation is unresolved. Refresh before retrying.");
    } catch { setMessage("The operation is unresolved. Refresh before retrying."); }
    finally { setBusy(false); }
  }

  async function submitDigital(teamEvent:TeamEvent,gameId:string,winnerSide:"a"|"b",margin:number) {
    const actorId = data?.actorId;
    if (!actorId) { setMessage("Your tournament session is unavailable. Reconnect and refresh before entering this result."); return; }
    if (navigator.onLine) { await mutate({action:"submit_score",eventId:teamEvent.eventId,gameId,submissionId:crypto.randomUUID(),winnerSide,margin,operationId:crypto.randomUUID()}); return; }
    try {
      const capability=await readPreparedOfflineSubmissionCapability(actorId,gameId);
      if(!capability){setMessage("Offline entry is unavailable because this game was not prepared while connected.");return;}
      await queueOfflineSubmission(capability,winnerSide,margin);
      setOfflineQueued((current)=>({...current,[gameId]:true}));
      setMessage("Stored safely on this device. Waiting to synchronize; this result is not verified yet.");
    } catch { setMessage("This result could not be stored safely. Keep the paper record and ask an official for help."); }
  }

  const event = data?.events.find((item) => item.eventId === eventId);
  const available = data?.roster.filter((roster) => !event?.teams.some((team) => team.members.some((member) => member.rosterEntryId === roster.rosterEntryId))) ?? [];
  const ownRosterIds = useMemo(() => new Set(data?.roster.filter((row) => row.profileId === data.actorId).map((row) => row.rosterEntryId) ?? []), [data]);
  const ownAvailable = available.filter((row) => row.profileId === data?.actorId);
  const effectiveCaptain = data?.canManage ? captain : ownAvailable.length === 1 ? ownAvailable[0].rosterEntryId : "";
  const partnerOptions = available.filter((row) => row.rosterEntryId !== effectiveCaptain);
  const paper = event?.teams.filter((team) => team.scorecardType === "paper") ?? [];

  function publishSeats() {
    if (!event) return;
    void mutate({ action: "publish_seating", eventId: event.eventId, publicationId: crypto.randomUUID(), assignments: event.teams.map((team, index) => ({ teamEntryId: team.teamEntryId, tableSeat: `${String.fromCharCode(65 + Math.floor(index / 20))}-${index % 20 + 1}` })), operationId: crypto.randomUUID() });
  }
  function publishSchedule() {
    if (!event) return;
    const count = event.configuredGameCount;
    const games = roundRobin(event.teams, count);
    if (!games.length) { setMessage("An even number of at least two teams is required."); return; }
    void mutate({ action: "publish_schedule", eventId: event.eventId, publicationId: crypto.randomUUID(), gameCount: count, games, operationId: crypto.randomUUID() });
  }

  if (!data) return <p role="status" className="auth-note">{message}</p>;
  return <div className="policy-settings">
    <label>Team event<select value={eventId} onChange={(change) => setEventId(change.target.value)}>{data.events.map((item) => <option key={item.eventId} value={item.eventId}>{item.name} — {item.format === "doubles" ? "Traditional Doubles" : "Canadian Doubles"}</option>)}</select></label>
    {event && (data.canManage || ownAvailable.length === 1) ? <section className="setup-subsection"><h2>Create a two-person team</h2><div className="setup-grid">
      {data.canManage ? <label>Captain<select value={captain} onChange={(change) => setCaptain(change.target.value)}><option value="">Select captain</option>{available.map((player) => <option key={player.rosterEntryId} value={player.rosterEntryId}>{player.displayName} · {player.accNumber}</option>)}</select></label> : <label>Captain<input readOnly value={`${ownAvailable[0].displayName} · ${ownAvailable[0].accNumber}`} /></label>}
      <label>Partner<select value={partner} onChange={(change) => setPartner(change.target.value)}><option value="">Select partner</option>{partnerOptions.map((player) => <option key={player.rosterEntryId} value={player.rosterEntryId}>{player.displayName} · {player.accNumber}</option>)}</select></label>
      <label>Shared scorecard<select value={mode} onChange={(change) => setMode(change.target.value as "digital" | "paper")}><option value="digital">Digital</option><option value="paper">Paper</option></select></label>
    </div><button className="primary" disabled={busy || !effectiveCaptain || !partner || effectiveCaptain === partner} onClick={() => void mutate({ action: "create_team", eventId: event.eventId, teamId: crypto.randomUUID(), teamEntryId: crypto.randomUUID(), captainRosterEntryId: effectiveCaptain, partnerRosterEntryId: partner, scorecardType: mode, operationId: crypto.randomUUID() })}>Create Team</button></section> : null}
    {event ? <><a className="guide-link" href={`/tournament/${tournamentId}/seating-directory?event=${event.eventId}`}>Open Seating Directory for {event.name}</a>
      <section><h2>Teams and shared scorecards</h2><div className="table-wrap"><table><thead><tr><th>Team</th><th>Members</th><th>Scorecard</th><th>Verification ID</th><th className="no-print">Actions</th></tr></thead><tbody>{event.teams.map((team) => {
        const linked = team.members.map((member) => data.roster.find((row) => row.rosterEntryId === member.rosterEntryId)).filter((row): row is TeamWorkspace["roster"][number] & {profileId:string} => !!row?.profileId);
        const claimable = team.members.find((member) => !member.profileLinked && ownRosterIds.has(member.rosterEntryId));
        return <tr key={team.teamEntryId}><td>{team.displayName}</td><td>{team.members.map((member) => <span key={member.rosterEntryId}>{member.displayName}{member.role === "captain" ? " (Captain)" : ""}<br /></span>)}</td><td>{team.scorecardType}{team.scorerResolutionStatus === "unresolved" ? <strong className="error-text"> — scorer required before Start Play</strong> : null}</td><td>{team.verificationId ?? "Not published"}</td><td className="no-print"><div className="actions">
          {claimable ? <button className="secondary" disabled={busy} onClick={() => void mutate({ action: "claim_partner", eventId: event.eventId, teamId: team.teamId, rosterEntryId: claimable.rosterEntryId, claimId: crypto.randomUUID(), operationId: crypto.randomUUID() })}>Claim My Team Place</button> : null}
          {data.canManage && !event.started ? <>{linked.map((member) => <button className="secondary" key={member.profileId} disabled={busy || team.designatedScorerProfileId === member.profileId} onClick={() => void mutate({ action: "configure_team", eventId: event.eventId, teamEntryId: team.teamEntryId, scorecardType: "digital", designatedScorerProfileId: member.profileId, expectedVersion: team.configurationVersion, reason: "Designated scorer selected before play", operationId: crypto.randomUUID() })}>Digital · scorer {member.displayName}</button>)}<button className="secondary" disabled={busy || team.scorecardType === "paper"} onClick={() => void mutate({ action: "configure_team", eventId: event.eventId, teamEntryId: team.teamEntryId, scorecardType: "paper", designatedScorerProfileId: null, expectedVersion: team.configurationVersion, reason: "Shared team paper scorecard selected before play", operationId: crypto.randomUUID() })}>Use Paper Card</button></> : null}
        </div></td></tr>;
      })}</tbody></table></div>
      {data.canManage ? <div className="actions"><button className="secondary" disabled={busy || event.teams.length < 2 || !!event.teams[0]?.verificationId} onClick={publishSeats}>Publish Team Seating and IDs</button><button className="secondary" disabled={busy || !event.teams.every((team) => team.verificationId) || event.games.length > 0} onClick={publishSchedule}>Generate and Publish Schedule</button>{event.games.length && !event.started ? <button className="primary" disabled={busy || !event.schedulePublicationId} onClick={() => event.schedulePublicationId && void mutate({ action: "start_play", eventId: event.eventId, startId: crypto.randomUUID(), schedulePublicationId: event.schedulePublicationId, operationId: crypto.randomUUID() })}>Start {event.name}</button> : null}</div> : null}
      <p><strong>Paper cards required:</strong> {paper.length} shared team card{paper.length === 1 ? "" : "s"}.</p></section>
      <section><h2>{event.started ? "Current Team Games" : "Schedule Preview"}</h2>{event.games.map((game) => {
        const a = event.teams.find((team) => team.teamEntryId === game.sideATeamEntryId);
        const b = event.teams.find((team) => team.teamEntryId === game.sideBTeamEntryId);
        const mine = a?.designatedScorerProfileId === data.actorId ? "a" : b?.designatedScorerProfileId === data.actorId ? "b" : null;
        const opposing = mine ? game.submissions.find((submission) => submission.side !== mine && !submission.confirmed) : undefined;
        const own = mine ? game.submissions.find((submission) => submission.side === mine) : undefined;
        const margin = marginByGame[game.gameId] ?? "";
        const winner = winnerByGame[game.gameId] ?? "a";
        const setResult = (side: "a" | "b", value: string) => { setWinnerByGame((current) => ({ ...current, [game.gameId]: side })); setMarginByGame((current) => ({ ...current, [game.gameId]: value })); };
        const pendingMismatch = event.pendingMismatchResolutions.some((resolution) => resolution.gameId === game.gameId);
        const playerIsInGame = [a, b].some((team) => team?.members.some((member) => ownRosterIds.has(member.rosterEntryId)));
        return <article className="setup-subsection" key={game.gameId}><h3>Game {game.gameNumber}: {a?.displayName} vs {b?.displayName}</h3><p>{game.sideATableSeat} / {game.sideBTableSeat} · <strong>{game.state}</strong></p><p className="auth-note">{game.sideAMembers.map((member)=>`${member.displayName} — ${member.currentTableSeat}`).join(" · ")}<br/>{game.sideBMembers.map((member)=>`${member.displayName} — ${member.currentTableSeat}`).join(" · ")}</p>
          {event.started && playerIsInGame ? <JudgeCallButton tournamentId={tournamentId} gameId={game.gameId} /> : null}
          {event.started && (mine || data.canCrossCheck) ? <><label>Winner<select value={winner} onChange={(change) => setResult(change.target.value as "a" | "b", margin)}><option value="a">{a?.displayName}</option><option value="b">{b?.displayName}</option></select></label><label>Spread Points<input inputMode="numeric" value={margin} onChange={(change) => setResult(winner, change.target.value.replace(/\D/g, "").slice(0, 3))} /></label></> : null}
          {mine && !own && event.started ? <><p className="auth-note">{offlineQueued[game.gameId]?"Stored on this device · synchronization pending":offlineReady[game.gameId]?"Offline Ready":"Preparing Offline Use…"}</p><button className="primary" disabled={busy || offlineQueued[game.gameId] || Number(margin) < 1 || Number(margin) > 121} onClick={() => void submitDigital(event,game.gameId,winner,Number(margin))}>Submit My Independent Entry</button></> : null}
          {data.canCrossCheck && event.started ? <div className="actions">{(["a", "b"] as const).map((side) => { const team = side === "a" ? a : b; return team?.scorecardType === "paper" && team.verificationId && !game.submissions.some((submission) => submission.side === side) ? <button className="secondary" key={`submit-${side}`} disabled={busy || Number(margin) < 1 || Number(margin) > 121} onClick={() => void mutate({ action: "submit_paper_score", eventId: event.eventId, gameId: game.gameId, submissionId: crypto.randomUUID(), side, paperCardReference:team.verificationId!, winnerSide: winner, margin: Number(margin), operationId: crypto.randomUUID() })}>Transcribe {team.displayName} Card {team.verificationId}</button> : null; })}{["confirmation_pending","mismatch"].includes(game.state)?game.submissions.filter((submission)=>submission.sourceMethod==="paper_transcription"&&!submission.paperReviewed&&!submission.own).map((submission)=>{const team=submission.side==="a"?a:b;return team?.verificationId?<button className="secondary" key={`review-${submission.submissionId}`} disabled={busy||Number(margin)<1||Number(margin)>121} onClick={()=>void mutate({action:"review_paper_score",eventId:event.eventId,gameId:game.gameId,submissionId:submission.submissionId,reviewId:crypto.randomUUID(),paperCardReference:team.verificationId!,winnerSide:winner,margin:Number(margin),operationId:crypto.randomUUID()})}>Second Official Re-enter Card {team.verificationId}</button>:null;}):null}</div> : null}
          {opposing && mine ? <button className="primary" disabled={busy || opposing.winnerSide !== own?.winnerSide || opposing.margin !== own?.margin} onClick={() => void mutate({ action: "confirm_score", eventId: event.eventId, gameId: game.gameId, submissionId: opposing.submissionId, confirmationId: crypto.randomUUID(), operationId: crypto.randomUUID() })}>Confirm Opposing Team Entry</button> : null}
          {data.canCrossCheck && game.state==="confirmation_pending" ? <div className="actions">{game.submissions.filter((submission)=>!submission.confirmed&&!submission.own&&(submission.sourceMethod!=="paper_transcription"||submission.paperReviewed)).map((submission)=>{const oppositeTeam=submission.side==="a"?b:a;return oppositeTeam?.scorecardType==="paper"?<button className="primary" key={`official-confirm-${submission.submissionId}`} disabled={busy} onClick={()=>void mutate({action:"confirm_score",eventId:event.eventId,gameId:game.gameId,submissionId:submission.submissionId,confirmationId:crypto.randomUUID(),operationId:crypto.randomUUID()})}>Official Confirm {submission.side.toUpperCase()} Entry</button>:null;})}</div>:null}
          {data.canCrossCheck && game.state==="mismatch" && !pendingMismatch ? <div className="actions"><button className="primary" disabled={busy||Number(margin)<1||Number(margin)>121||!(reasonByGame[game.gameId]??"").trim()} onClick={()=>void mutate({action:"resolve_mismatch",eventId:event.eventId,gameId:game.gameId,resolutionId:crypto.randomUUID(),expectedGameVersion:game.version,winnerSide:winner,margin:Number(margin),reason:reasonByGame[game.gameId]??"",operationId:crypto.randomUUID()})}>Propose Mismatch Resolution</button></div>:null}
          {data.canCrossCheck && ["verified","corrected"].includes(game.state) ? <div className="setup-grid"><label>Correction reason (optional unless required by tournament policy)<input value={reasonByGame[game.gameId] ?? ""} maxLength={500} onChange={(change)=>setReasonByGame((current)=>({...current,[game.gameId]:change.target.value}))}/></label><button className="secondary" disabled={busy || Number(margin)<1 || Number(margin)>121 || (winner===game.winnerSide && Number(margin)===game.margin)} onClick={()=>void mutate({action:"correct_score",eventId:event.eventId,gameId:game.gameId,correctionId:crypto.randomUUID(),expectedGameVersion:game.version,winnerSide:winner,margin:Number(margin),reason:reasonByGame[game.gameId]??"",operationId:crypto.randomUUID()})}>Submit Correction</button></div>:null}
        </article>;
      })}</section>
      {data.canCrossCheck && event.pendingCorrections.length ? <section><h2>Team Corrections Awaiting Independent Review</h2>{event.pendingCorrections.map((correction)=><article className="setup-subsection" key={correction.correctionId}><p>Game {event.games.find((game)=>game.gameId===correction.gameId)?.gameNumber ?? ""} · corrected to {correction.winnerSide.toUpperCase()} by {correction.margin}{correction.reason?` · ${correction.reason}`:""}</p><div className="actions"><button className="primary" disabled={busy || correction.editorProfileId===data.actorId} onClick={()=>void mutate({action:"review_correction",eventId:event.eventId,correctionId:correction.correctionId,reviewId:crypto.randomUUID(),approved:true,operationId:crypto.randomUUID()})}>Approve Correction</button><button className="secondary" disabled={busy || correction.editorProfileId===data.actorId} onClick={()=>void mutate({action:"review_correction",eventId:event.eventId,correctionId:correction.correctionId,reviewId:crypto.randomUUID(),approved:false,operationId:crypto.randomUUID()})}>Reject Correction</button></div></article>)}</section>:null}
      {data.canCrossCheck && event.pendingMismatchResolutions.length ? <section><h2>Mismatch Resolutions Awaiting Independent Review</h2>{event.pendingMismatchResolutions.map((resolution)=><article className="setup-subsection" key={resolution.resolutionId}><p>Game {event.games.find((game)=>game.gameId===resolution.gameId)?.gameNumber ?? ""} · {resolution.winnerSide.toUpperCase()} by {resolution.margin} · {resolution.reason}</p><div className="actions"><button className="primary" disabled={busy||resolution.resolverProfileId===data.actorId} onClick={()=>void mutate({action:"review_mismatch",eventId:event.eventId,resolutionId:resolution.resolutionId,reviewId:crypto.randomUUID(),approved:true,operationId:crypto.randomUUID()})}>Approve Mismatch Resolution</button><button className="secondary" disabled={busy||resolution.resolverProfileId===data.actorId} onClick={()=>void mutate({action:"review_mismatch",eventId:event.eventId,resolutionId:resolution.resolutionId,reviewId:crypto.randomUUID(),approved:false,operationId:crypto.randomUUID()})}>Reject Mismatch Resolution</button></div></article>)}</section>:null}
      <section><h2>Shared Team Scorecards</h2>{event.teams.map((team) => <article className="setup-subsection" key={team.teamEntryId}><h3>{team.displayName} · ID# {team.verificationId ?? "Pending"}</h3><div className="table-wrap"><table><thead><tr><th>Game</th><th>Points</th><th>(+)</th><th>(−)</th><th>Opponent</th></tr></thead><tbody>{event.games.filter((game) => game.sideATeamEntryId === team.teamEntryId || game.sideBTeamEntryId === team.teamEntryId).map((game) => { const isA = game.sideATeamEntryId === team.teamEntryId; const opponentId = isA ? game.sideBTeamEntryId : game.sideATeamEntryId; const won = game.winnerSide === (isA ? "a" : "b"); const points = game.state === "verified" || game.state === "corrected" ? (won ? (Number(game.margin) >= 31 ? 3 : 2) : 0) : null; return <tr key={game.gameId}><td>{game.gameNumber}</td><td>{points ?? "—"}</td><td>{points !== null && won ? `+${game.margin}` : ""}</td><td>{points !== null && !won ? `−${game.margin}` : ""}</td><td>{event.teams.find((entry) => entry.teamEntryId === opponentId)?.displayName}</td></tr>; })}</tbody></table></div></article>)}</section>
      <section><h2>Team Standings</h2><div className="table-wrap"><table><thead><tr><th>Team</th><th>Game Points</th><th>Won</th><th>Plus</th><th>Minus</th><th>Net</th></tr></thead><tbody>{event.standings.map((standing) => <tr key={standing.teamEntryId}><td>{standing.displayName}</td><td>{standing.gamePoints}</td><td>{standing.gamesWon}</td><td>+{standing.plusPoints}</td><td>-{standing.minusPoints}</td><td>{standing.netSpreadPoints >= 0 ? "+" : ""}{standing.netSpreadPoints}</td></tr>)}</tbody></table></div></section>
    </> : null}
    <p role="status" className={message.startsWith("Not") || message.includes("unavailable") || message.includes("unresolved") ? "error-text" : "auth-note"}>{message}</p>
  </div>;
}
