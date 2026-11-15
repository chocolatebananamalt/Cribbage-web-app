import "server-only";
import { createHash } from "node:crypto";
import { isUuid } from "../api/validation.ts";
import { isQualificationResult } from "../api/qualification-finalization.ts";
import { isQualificationTieWorkspace } from "../api/qualification-ties.ts";
import { isEventScheduleWorkspace } from "../api/event-schedule.ts";
import { isPlayoffV4Workspace } from "../api/playoff-outcome-v4.ts";
import { isPlayoffOutcomeWorkspace } from "../api/playoff-outcome.ts";
import { isConsolationWorkspace } from "../api/consolation-playoff.ts";
import { isSyntheticEventContext } from "../api/synthetic-event-evidence.ts";
import { readMainFourPlayoffBindingV1 } from "./main-four-playoff-binding-v1.ts";
import { playoffDisplayVersion, projectPlayerPlayoff, type PlayoffDisplayInput, type PlayoffDisplayResult } from "./player-playoff-display.ts";

export type ExistingPlayoffMode = "main-v3" | "main-v4" | "consolation-v1";
export type ExistingPlayoffReadModels = { qualification: unknown; ties: unknown; schedule: unknown; playoff: unknown; syntheticContext: unknown | null; mainFourBinding?: unknown };
export type ExistingBracketOrigin = "synthetic-event" | "synthetic-indicated" | "director-attested-origin-unverified" | "director-reviewed-origin-unverified";
export type ExistingBracketProjection = {status:"blocked";code:string} | {
  status:"available"; input:PlayoffDisplayInput; display:Extract<ReturnType<typeof projectPlayerPlayoff>,{status:"available"}>;
  origin:ExistingBracketOrigin; notice:string; sourceObservation:"provided-models-not-atomic" | "matching-double-read-not-atomic"; publicAccessGranted:false; independentPlayEstablished:false;
};
const canonical = (v:unknown):string => Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : v && typeof v === "object"
  ? `{${Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>`${JSON.stringify(k)}:${canonical(x)}`).join(",")}}` : JSON.stringify(v) ?? "null";
const blocked = (code:string):ExistingBracketProjection => ({status:"blocked",code});
const uuid = (v:unknown):v is string => isUuid(v) && v === v.toLowerCase();
type Series = {winnerId:string;loserId:string;evidenceNote:string};

/** SERVER ONLY. Caller must preserve existing Director/co-director read permissions.
 * This projection grants neither public access nor independent-play authority. */
export function projectExistingPlayoffReadModels(tournamentId:string,eventId:string,mode:ExistingPlayoffMode,models:ExistingPlayoffReadModels):ExistingBracketProjection {
  if (![tournamentId,eventId].every(uuid) || !["main-v3","main-v4","consolation-v1"].includes(mode)) return blocked("invalid_scope");
  const {qualification:q,ties,schedule:s,playoff:p,syntheticContext:context}=models;
  if (!isQualificationResult(q,tournamentId,eventId) || !isQualificationTieWorkspace(ties,tournamentId,eventId) || !isEventScheduleWorkspace(s)) return blocked("read_models_unavailable");
  if (q.qualifierCount>64) return blocked("placement_above_64_unverified");
  if (!ties.finalized || ties.blockers.length) return blocked("qualification_review_pending");
  const ids=new Set(q.qualifiers.map(row=>row.participantId));
  const relevantTies=ties.groups.filter(g=>g.candidateIds.some(id=>ids.has(id)));
  if (relevantTies.some(g=>g.method==="blocked" || g.resolution===null)
    || q.qualifiers.some(row=>row.tied && !relevantTies.some(g=>g.candidateIds.includes(row.participantId) && g.resolution))) return blocked("qualification_tie_unresolved");
  const scoreKeys=["gamePoints","gamesWon","netSpreadPoints","plusPoints"] as const;
  const boundaryRows=[...q.qualifiers,q.highNonQualifier];
  for(let index=1;index<boundaryRows.length;index++){
    const a=boundaryRows[index-1],b=boundaryRows[index];
    const firstDifference=scoreKeys.map(key=>a[key]-b[key]).find(value=>value!==0)??0;
    if(firstDifference<0)return blocked("qualification_order_conflict");
    if(firstDifference===0 && !relevantTies.some(g=>g.candidateIds.includes(a.participantId)&&g.candidateIds.includes(b.participantId)&&g.resolution))return blocked("qualification_tie_unresolved");
  }
  for(const group of relevantTies){
    const rows=group.candidateIds.map(id=>[...q.qualifiers,q.highNonQualifier].find(row=>row.participantId===id));
    if(rows.some(row=>!row) || rows.length!==2)return blocked("qualification_tie_source_incomplete");
    const [a,b]=rows;
    if(!a||!b || a.numericRank!==group.numericRank || b.numericRank!==group.numericRank
      || scoreKeys.some(key=>a[key]!==b[key]))return blocked("qualification_tie_source_changed");
    const qualified=q.qualifiers.filter(row=>group.candidateIds.includes(row.participantId));
    if(group.affectsQualificationCut!==(qualified.length===1))return blocked("qualification_tie_source_changed");
    if(qualified.length===1 ? group.resolution!.winnerId!==qualified[0].participantId
      : qualified.find(row=>row.participantId===group.resolution!.winnerId)?.qualificationRank!==Math.min(...qualified.map(row=>row.qualificationRank)))return blocked("qualification_tie_order_conflict");
  }
  const events=s.events.filter(e=>e.eventId===eventId),participants=s.participants.filter(row=>row.eventId===eventId),matches=s.matches.filter(row=>row.eventId===eventId);
  const e=events[0];
  if (events.length!==1 || !e || e.format!=="standard_singles" || !s.registrationClosed || !e.schedulePublished
    || !["completed","finalized"].includes(e.playState) || e.participantCount!==q.participantCount || participants.length!==q.participantCount
    || new Set(participants.map(row=>row.participantId)).size!==participants.length || new Set(participants.map(row=>row.verificationId)).size!==participants.length
    || !matches.length || matches.length!==e.publishedMatchCount || new Set(matches.map(row=>row.canonicalGameId)).size!==matches.length
    || matches.some(row=>!["verified","corrected"].includes(row.state)) || q.qualifiers.some(row=>row.verifiedGames!==e.gameCount)) return blocked("qualifying_schedule_unresolved");
  const players=q.qualifiers.map(row=>({participantId:row.participantId,displayName:row.displayName,
    tournamentId:participants.find(p=>p.participantId===row.participantId)?.verificationId ?? "",seed:row.qualificationRank}));
  if (players.some(row=>!row.tournamentId)) return blocked("fixed_tournament_id_unavailable");
  let series:Series[]=[],resultId:string|null=null,resultVersion=0,nativeDigest:string|null=null,origin:ExistingBracketOrigin="director-reviewed-origin-unverified";
  let sourceQualifiers:{participantId:string;qualificationRank:number;gamePoints:number}[];
  if (mode==="main-v4") {
    if (!isPlayoffV4Workspace(p,tournamentId,eventId) || p.blocker!==null || !p.sourceDigest || p.qualificationResultVersionId!==q.resultVersionId) return blocked("playoff_source_unavailable");
    sourceQualifiers=p.qualifiers;nativeDigest=p.sourceDigest;
    if (p.result) {if(!p.result.current || p.result.qualificationResultVersionId!==q.resultVersionId || p.result.sourceDigest!==p.sourceDigest)return blocked("playoff_source_changed");series=p.result.series;resultId=p.result.resultId;resultVersion=p.result.version;}
  } else if (mode==="main-v3") {
    if (!isPlayoffOutcomeWorkspace(p,tournamentId,eventId) || p.blocker!==null || p.legacyConflict || p.qualificationResultVersionId!==q.resultVersionId) return blocked("playoff_source_unavailable");
    sourceQualifiers=p.qualifiers;
    // The legacy DTO alone still cannot establish its result-specific FK/currentness.
    if(p.result){
      const binding=readMainFourPlayoffBindingV1(models.mainFourBinding,{tournamentId,eventId,qualificationResultVersionId:q.resultVersionId,qualificationVersion:q.version},p);
      if(!binding)return blocked("legacy_result_linkage_unavailable");
      nativeDigest=binding.sourceDigest;series=p.result.series;resultId=p.result.resultId;resultVersion=p.result.version;
    }
  } else {
    if (!isConsolationWorkspace(p,tournamentId,eventId) || p.blocker!==null || !p.sourceDigest || p.qualificationResultVersionId!==q.resultVersionId) return blocked("playoff_source_unavailable");
    sourceQualifiers=p.qualifiers;nativeDigest=p.sourceDigest;
    if(p.result){if(!p.result.current || p.result.sourceDigest!==p.sourceDigest)return blocked("playoff_source_changed");series=p.result.series;resultId=p.result.resultId;resultVersion=p.result.version;
      origin=p.result.physicalPlayAttested?"director-attested-origin-unverified":"synthetic-indicated";}
  }
  if(sourceQualifiers.length!==q.qualifierCount || sourceQualifiers.some((row,i)=>row.participantId!==q.qualifiers[i].participantId || row.qualificationRank!==q.qualifiers[i].qualificationRank || row.gamePoints!==q.qualifiers[i].gamePoints)) return blocked("qualifier_source_changed");
  // Positive markers may lower provenance; absence never establishes genuine play.
  if(series.some(row=>/SYNTHETIC/i.test(row.evidenceNote)))origin="synthetic-indicated";
  if(context!==null){
    if(!isSyntheticEventContext(context,tournamentId))return blocked("synthetic_origin_unavailable");
    if(context.eventIds.includes(eventId)){
      if(resultId && !context.artifacts.some(a=>a.eventId===eventId && a.kind==="playoff" && a.sourceDigest===nativeDigest
        && a.payload.qualificationResultVersionId===q.resultVersionId && a.payload.expectedVersion===resultVersion-1
        && canonical(a.payload.series)===canonical(series.map(({winnerId,loserId})=>({winnerId,loserId})))))return blocked("synthetic_source_changed");
      origin="synthetic-event";
    }
  }
  const digest=createHash("sha256").update(canonical({version:"existing-playoff-public-projection-v1",tournamentId,eventId,
    qualificationVersionId:q.resultVersionId,qualificationRevision:q.version,players,nativeDigest,resultId,resultVersion,origin})).digest("hex");
  const input:PlayoffDisplayInput={kind:"player-playoff-display-input-v2",tournamentId,eventId,qualificationVersionId:q.resultVersionId,sourceDigest:digest,
    sourceCurrent:true,qualificationReviewed:true,tiesResolved:true,eventType:mode==="consolation-v1"?"regular-consolation":"main",entrantCount:q.participantCount,qualifierCount:q.qualifierCount,players,results:[]};
  const path=mode==="main-v4"?["r1-m2","r2-m1","r2-m2","r3-m1"]:["r1-m1","r1-m2","r2-m1"];
  for(let index=0;index<series.length;index++){
    const display=projectPlayerPlayoff(input);if(display.status!=="available")return blocked(display.code);
    const row=series[index],match=display.rounds.flatMap(r=>r.matches).find(m=>m.matchId===path[index]);
    if(!resultId || !match || match.status!=="ready" || !match.sides.every(side=>side.player && [row.winnerId,row.loserId].includes(side.player.participantId)) || row.winnerId===row.loserId)return blocked("series_path_unresolved");
    const parentBindings=match.round===1?[null,null]:match.sides.map(side=>{
      const feed=display.rounds.flatMap(r=>r.matches).find(m=>m.matchId===side.fromMatch)!;
      return feed.status==="bye"?`bye:${q.resultVersionId}:${feed.matchId}`:feed.result?`${feed.result.resultId}:${feed.result.revision}:series-${feed.result.sourceSeriesOrdinal}`:null;
    });
    const projected:PlayoffDisplayResult={matchId:match.matchId,sideAId:match.sides[0].player!.participantId,sideBId:match.sides[1].player!.participantId,
      parentBindings:parentBindings as [string|null,string|null],bracketVersion:playoffDisplayVersion,winnerId:row.winnerId,resultId,
      sourceSeriesOrdinal:index+1,revision:resultVersion,qualificationVersionId:q.resultVersionId,sourceDigest:digest,
      provenance:origin.startsWith("synthetic")?"synthetic-example":"director-reviewed"};
    input.results.push(projected);
  }
  const display=projectPlayerPlayoff(input);if(display.status!=="available")return blocked(display.code);
  return {status:"available",input,display,origin,sourceObservation:"provided-models-not-atomic",notice:origin.startsWith("synthetic")
    ?"Simulated or synthetic-indicated results. No official result, physical play or independent human verification is established by this display."
    :"Director-reviewed read model; play origin and independent confirmation are not established by this display.",publicAccessGranted:false,independentPlayEstablished:false};
}

type Access={actorId:string;roles:string[]};
export type ExistingBracketReadDependencies={access:(tournamentId:string)=>Promise<Access|null>;models:(actorId:string,tournamentId:string,eventId:string,mode:ExistingPlayoffMode)=>Promise<ExistingPlayoffReadModels>};
/** Existing private-read permission intersection only; no public/player endpoint. */
export function createExistingBracketReader(deps:ExistingBracketReadDependencies){
  return async(tournamentId:string,eventId:string,mode:ExistingPlayoffMode):Promise<ExistingBracketProjection>=>{
    if(![tournamentId,eventId].every(uuid)||!["main-v3","main-v4","consolation-v1"].includes(mode))return blocked("invalid_scope");
    const permitted=(a:Access|null):a is Access=>!!a&&uuid(a.actorId)&&Array.isArray(a.roles)&&a.roles.some(r=>["director","co_director"].includes(r));
    try{
      const a=await deps.access(tournamentId);if(!permitted(a))return blocked("existing_read_permission_required");
      const first=structuredClone(await deps.models(a.actorId,tournamentId,eventId,mode)),firstFingerprint=canonical(first),projection=projectExistingPlayoffReadModels(tournamentId,eventId,mode,first);
      if(projection.status!=="available")return projection;
      const b=await deps.access(tournamentId);if(!permitted(b)||b.actorId!==a.actorId)return blocked("existing_read_permission_required");
      const second=structuredClone(await deps.models(a.actorId,tournamentId,eventId,mode));
      const c=await deps.access(tournamentId);if(!permitted(c)||c.actorId!==a.actorId)return blocked("existing_read_permission_required");
      if(firstFingerprint!==canonical(second))return blocked("observed_source_changed");
      const current=projectExistingPlayoffReadModels(tournamentId,eventId,mode,second);
      return current.status==="available"?{...current,sourceObservation:"matching-double-read-not-atomic"}:current;
    }catch{return blocked("read_models_unavailable");}
  };
}
