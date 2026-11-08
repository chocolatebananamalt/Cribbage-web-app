import {isScoreEntryReady} from "../score.ts";
import {observeNativeMixedPublishedScheduleV1, type NativeMixedPublishedExpectedV1} from "./native-mixed-published-schedule-v1.ts";
import {readNativeMixedSimulationStartedSourceV1, type NativeMixedSimulationStartRequestV1} from "./native-mixed-simulation-start-v1.ts";
import type {NativeMixedSimulationScopeV1} from "./native-mixed-simulation-operation-v1.ts";

export type SimulatedGameActionV1="digital-submit"|"digital-confirm"|"paper-capture"|"paper-review";
type Result={winnerSide:"a"|"b";margin:number};
type EntryBase={id:string;operationId:string;receiptId:string;payloadDigest:string;sequence:number;actorId:string;
 tournamentId:string;eventId:string;startId:string;gameId:string;startSourceDigest:string};
export type SimulatedGameEntryV1=EntryBase & (
 {action:"digital-submit";participantId:string;result:Result;statement:"simulation-own-result-v1"}|
 {action:"digital-confirm";participantId:string;result:Result;references:string[];statement:"simulation-own-confirmation-v1"}|
 {action:"paper-capture";artifactId:string;artifactDigest:string;claims:{side:"a"|"b";result:Result}[];
  physicalOriginal:false;fictionalOpponentPlayed:false;independentHumanPlayClaimed:false;statement:"fictional-paper-capture-v1"}|
 {action:"paper-review";captureId:string;artifactId:string;artifactDigest:string;reenteredClaims:{side:"a"|"b";result:Result}[];decision:"accepted-simulation-only";statement:"fictional-paper-review-v1"});
export type NativeMixedPostStartInputV1={
 start:{value:unknown;expected:{scope:NativeMixedSimulationScopeV1;request:NativeMixedSimulationStartRequestV1;startId:string}};
 schedule:{value:unknown;expected:NativeMixedPublishedExpectedV1};gameId:string;
 actor:{profileId:string;subjectId:string};history:unknown;ordinaryState:unknown;
};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const digest=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const result=(v:unknown):v is Result=>exact(v,["winnerSide","margin"])&&(v.winnerSide==="a"||v.winnerSide==="b")&&isScoreEntryReady(v.margin as number,v.winnerSide==="a"?"player":"opponent");
const sameResult=(a:Result,b:Result)=>a.winnerSide===b.winnerSide&&a.margin===b.margin;
const baseKeys=["id","operationId","receiptId","payloadDigest","sequence","actorId","tournamentId","eventId","startId","gameId","startSourceDigest"];
const entryKeys:Record<SimulatedGameActionV1,string[]>={
 "digital-submit":["action","participantId","result","statement"],
 "digital-confirm":["action","participantId","result","references","statement"],
 "paper-capture":["action","artifactId","artifactDigest","claims","physicalOriginal","fictionalOpponentPlayed","independentHumanPlayClaimed","statement"],
 "paper-review":["action","captureId","artifactId","artifactDigest","reenteredClaims","decision","statement"]};
const zeroKeys=["ordinaryStartCount","ordinaryRosterCheckInCount","ordinaryEventCheckInCount","ordinaryCheckInWindowCount","ordinaryCheckInRequestCount","ordinaryParticipantStatusCount"];
const flags={databaseProvenanceVerified:false,identitySubjectVerified:false,writeAuthorized:false,normalStartAuthorized:false,
 scoringAuthorized:false,officialResultVerified:false,humanPlayVerified:false,physicalOriginalVerified:false,moneyMoved:false,payoutAuthorized:false}as const;
type Blocked={status:"blocked";code:string};
type Observation={status:"simulation-game-admission-observation";pairing:"DD"|"PD"|"PP";gameId:string;round:number;
 startId:string;startSourceDigest:string;expectedRevision:number;evidenceIds:string[];suggestedActions:SimulatedGameActionV1[];
 phase:"awaiting-evidence"|"awaiting-confirmation"|"mismatch-needs-review"|"simulation-evidence-complete";
 simulatedResult:Result|null;sourceObservation:"provided-models-not-atomic";
 sides:{side:"a"|"b";participantId:string;fixedTournamentId:string;currentSeat:string;mode:"digital"|"paper"}[];} & typeof flags;

/** Structural protocol observation only. No posted model or computed action list
 * is server permission. A future private writer must independently bind journal
 * receipts/audits and repeat this contract under current identity/source locks. */
export function observeNativeMixedPostStartAdmissionV1(input:NativeMixedPostStartInputV1):Blocked|Observation{
 const blocked=(code:string):Blocked=>({status:"blocked",code});
 const start=readNativeMixedSimulationStartedSourceV1(input.start.value,input.start.expected);
 if(!start)return blocked("current_simulated_start_required");
 const schedule=observeNativeMixedPublishedScheduleV1(input.schedule.value,input.schedule.expected);
 if(schedule.status!=="simulation-schedule-observation")return blocked("current_native_schedule_required");
 const raw=input.schedule.value as Record<string,unknown>,receipt=start.receipt,attendance=input.schedule.expected.attendance.value;
 if(!object(attendance))return blocked("current_native_schedule_required");
 if(!uuid(input.gameId)||!exact(input.actor,["profileId","subjectId"])||!uuid(input.actor.profileId)||input.actor.profileId!==input.actor.subjectId)return blocked("actor_subject_changed");
 if(start.tournamentId!==schedule.tournamentId||start.eventId!==schedule.eventId||receipt.contextId!==schedule.publication.contextId
 ||receipt.request.expectedScheduleSourceDigest!==raw.sourceDigest||receipt.request.expectedAttendanceSourceDigest!==attendance.sourceDigest)return blocked("start_publication_changed");
 const ordinary=input.ordinaryState;
 if(!exact(ordinary,["status","tournamentId","eventId","startId","gameId","canonicalState","allCanonicalGamesPending","ordinaryScoreHistory",...zeroKeys])||ordinary.status!=="observed"
 ||ordinary.tournamentId!==start.tournamentId||ordinary.eventId!==start.eventId
 ||ordinary.startId!==receipt.startId||ordinary.gameId!==input.gameId||ordinary.canonicalState!=="pending"||ordinary.allCanonicalGamesPending!==true||zeroKeys.some(k=>ordinary[k]!==0)
 ||!exact(ordinary.ordinaryScoreHistory,["checker","empty"])
 ||ordinary.ordinaryScoreHistory.checker!=="app.native_mixed_admission_score_history_empty_v1"
 ||ordinary.ordinaryScoreHistory.empty!==true)return blocked("ordinary_state_unavailable_or_active");
 const game=schedule.canonicalGames.find(g=>g.gameId===input.gameId);if(!game)return blocked("game_not_in_publication");
 const roster=input.schedule.expected.attendance.expected.roster;
 const sides=(["a","b"]as const).map(side=>{const participantId=side==="a"?game.sideAParticipantId:game.sideBParticipantId;
  const person=roster.find(p=>p.participantId===participantId),fixed=schedule.fixedAssignments.find(p=>p.participantId===participantId);
  return person&&fixed?{side,participantId,profileId:person.profileId,mode:person.mode,fixedTournamentId:fixed.fixedId,currentSeat:side==="a"?game.sideATableSeat:game.sideBTableSeat}:null;});
 if(sides.some(s=>s===null))return blocked("game_identity_changed");
 const players=sides as NonNullable<(typeof sides)[number]>[],digital=players.filter(p=>p.mode==="digital"),paper=players.filter(p=>p.mode==="paper");
 const pairing=digital.length===2?"DD":digital.length===1?"PD":"PP";
 const history=input.history;
 if(!exact(history,["kind","status","tournamentId","eventId","startId","gameId","startSourceDigest","revision","entries"])
 ||history.kind!=="native-mixed-simulation-game-history-v1"||history.status!=="known"||history.tournamentId!==start.tournamentId
 ||history.eventId!==start.eventId||history.startId!==receipt.startId||history.gameId!==game.gameId||history.startSourceDigest!==receipt.sourceDigest
 ||!Array.isArray(history.entries)||!Number.isSafeInteger(history.revision)||history.revision!==history.entries.length||history.entries.length>4)return blocked("bound_simulation_history_required");
 const officials=input.schedule.expected.attendance.expected.officials;
 const crossChecker=(actor:string)=>officials.some(o=>o.profileId===actor&&o.roles.includes("cross_checker"));
 const paperReviewer=(actor:string)=>officials.some(o=>o.profileId===actor&&o.roles.some(r=>["director","co_director","cross_checker"].includes(r)));
 const ownGame=(actor:string)=>digital.some(p=>p.profileId===actor);
 const submissions=new Map<string,Extract<SimulatedGameEntryV1,{action:"digital-submit"}>>();
 const confirmations=new Set<string>();let capture:Extract<SimulatedGameEntryV1,{action:"paper-capture"}>|null=null;
 let review:Extract<SimulatedGameEntryV1,{action:"paper-review"}>|null=null,mismatch=false;
 const ids=new Set<string>(),operations=new Set<string>(),receipts=new Set<string>();
 const bundle=()=>{if(digital.some(p=>!submissions.has(p.participantId))||paper.length>0&&(!capture||!review))return null;
  const results=digital.map(p=>submissions.get(p.participantId)!.result).concat(capture?capture.claims.map(c=>c.result):[]);
  if(results.some(r=>!sameResult(r,results[0])))return null;
  const references=[...submissions.values()].map(s=>s.id).concat(capture&&review?[capture.id,review.id]:[]).sort();return{result:results[0],references};};
 for(const[index,rawEntry]of history.entries.entries()){
  if(!object(rawEntry)||!Object.hasOwn(entryKeys,rawEntry.action as string))return blocked("unsupported_simulation_evidence");
  const action=rawEntry.action as SimulatedGameActionV1;
  if(!exact(rawEntry,[...baseKeys,...entryKeys[action]])||![rawEntry.id,rawEntry.operationId,rawEntry.receiptId,rawEntry.actorId].every(uuid)
   ||!digest(rawEntry.payloadDigest)||rawEntry.sequence!==index+1||rawEntry.startId!==receipt.startId||rawEntry.gameId!==game.gameId
   ||rawEntry.tournamentId!==start.tournamentId||rawEntry.eventId!==start.eventId||rawEntry.startSourceDigest!==receipt.sourceDigest
   ||ids.has(rawEntry.id as string)||operations.has(`${rawEntry.actorId}:${rawEntry.operationId}`)||receipts.has(rawEntry.receiptId as string))return blocked("simulation_evidence_binding_changed");
  ids.add(rawEntry.id as string);operations.add(`${rawEntry.actorId}:${rawEntry.operationId}`);receipts.add(rawEntry.receiptId as string);
  const e=rawEntry as SimulatedGameEntryV1;
  if(e.action==="digital-submit"){
   if(e.statement!=="simulation-own-result-v1"||!digital.some(p=>p.participantId===e.participantId&&p.profileId===e.actorId)
    ||submissions.has(e.participantId)||confirmations.size>0||!result(e.result))return blocked("digital_own_submission_required");
   submissions.set(e.participantId,e);
  }else if(e.action==="digital-confirm"){
   const ready=bundle();
   if(e.statement!=="simulation-own-confirmation-v1"||!digital.some(p=>p.participantId===e.participantId&&p.profileId===e.actorId)
    ||confirmations.has(e.participantId)||!ready||!result(e.result)||!sameResult(e.result,ready.result)
    ||!Array.isArray(e.references)||!e.references.every(uuid)||!same([...e.references].sort(),ready.references))return blocked("exact_independent_confirmation_required");
   confirmations.add(e.participantId);
  }else if(e.action==="paper-capture"){
   if(e.statement!=="fictional-paper-capture-v1"||e.physicalOriginal!==false||e.fictionalOpponentPlayed!==false||e.independentHumanPlayClaimed!==false
    ||capture||paper.length===0||!crossChecker(e.actorId)||ownGame(e.actorId)||!uuid(e.artifactId)||!digest(e.artifactDigest)
    ||!Array.isArray(e.claims)||e.claims.length!==paper.length
    ||e.claims.some(c=>!exact(c,["side","result"])||!paper.some(p=>p.side===c.side)||!result(c.result))
    ||new Set(e.claims.map(c=>c.side)).size!==paper.length)return blocked("fictional_paper_capture_required");
   capture=e;
  }else{
   if(e.statement!=="fictional-paper-review-v1"||e.decision!=="accepted-simulation-only"||!capture||review
    ||!paperReviewer(e.actorId)||ownGame(e.actorId)||e.actorId===capture.actorId||e.captureId!==capture.id
    ||e.artifactId!==capture.artifactId||e.artifactDigest!==capture.artifactDigest
    ||!Array.isArray(e.reenteredClaims)||e.reenteredClaims.length!==capture.claims.length||new Set(e.reenteredClaims.map(c=>c?.side)).size!==capture.claims.length
    ||e.reenteredClaims.some(c=>!exact(c,["side","result"])||!result(c.result)||!capture!.claims.some(p=>p.side===c.side&&sameResult(p.result,c.result))))return blocked("independent_nonself_paper_review_required");
   review=e;
  }
  const results=[...submissions.values()].map(s=>s.result).concat(capture?capture.claims.map(c=>c.result):[]);
  mismatch=results.length>1&&results.some(r=>!sameResult(r,results[0]));
  if(mismatch&&index<history.entries.length-1)return blocked("mismatch_requires_reviewed_correction");
 }
 const ready=bundle(),complete=!mismatch&&!!ready&&digital.every(p=>confirmations.has(p.participantId));
 const suggestedActions:SimulatedGameActionV1[]=[];const mine=digital.find(p=>p.profileId===input.actor.profileId);
 if(!complete&&!mismatch){
  if(mine&&!submissions.has(mine.participantId))suggestedActions.push("digital-submit");
  if(mine&&ready&&!confirmations.has(mine.participantId))suggestedActions.push("digital-confirm");
  if(paper.length>0&&!ownGame(input.actor.profileId)){
   if(!capture&&crossChecker(input.actor.profileId))suggestedActions.push("paper-capture");
   else if(capture&&!review&&paperReviewer(input.actor.profileId)&&capture.actorId!==input.actor.profileId)suggestedActions.push("paper-review");
  }
 }
 return{status:"simulation-game-admission-observation",pairing,gameId:game.gameId,round:game.round,startId:receipt.startId,
 startSourceDigest:receipt.sourceDigest,expectedRevision:history.revision as number,evidenceIds:[...ids],suggestedActions,
 phase:mismatch?"mismatch-needs-review":complete?"simulation-evidence-complete":ready?"awaiting-confirmation":"awaiting-evidence",
 simulatedResult:complete?structuredClone(ready!.result):null,sourceObservation:"provided-models-not-atomic",...flags,
 sides:players.map(p=>({side:p.side,participantId:p.participantId,fixedTournamentId:p.fixedTournamentId,currentSeat:p.currentSeat,mode:p.mode}))};
}
