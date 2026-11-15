import {isEventScheduleWorkspace} from "../api/event-schedule.ts";
import {isSeatingWorkspace} from "../api/seating-workspace.ts";
import {isParticipantStatusWorkspace} from "../api/participant-status.ts";
import {buildMixedMockManifest,type MockManifest} from "../mixed-mock-plan.ts";
import {prepareReviewedDrawSchedule} from "./reviewed-draw-schedule.ts";
import {isUuid} from "../api/validation.ts";
type DrawInput=Parameters<typeof prepareReviewedDrawSchedule>[0];
type Scope={actorId:string;tournamentId:string;eventId:string};
export type ReviewedDrawMixedInput={draw:DrawInput;publishedWorkspace:unknown;nativeWorkspace:unknown;eventStatusWorkspace:unknown;eventLifecycleWorkspace:unknown;loadedScope:Scope};
type Result={status:"blocked";code:string}|{
 status:"prepared-not-authorized";tournamentId:string;eventId:string;reviewedOperationId:string;nativePublicationId:string;schedulePublicationId:string;
 participantSnapshotDigest:string;manifest:MockManifest;sourceObservation:"provided-models-not-atomic"|"matching-double-read-not-atomic";
 normalStartReceiptVerified:false;enrollmentAuthorized:false;financeWriteAuthorized:false;payoutAuthorized:false;physicalMovementCertified:false;
};
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==="object"&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const matchKey=(m:{gameNumber:number;sideAVerificationId:string;sideBVerificationId:string;sideATableSeat:string;sideBTableSeat:string})=>canonical([m.gameNumber,m.sideAVerificationId,m.sideBVerificationId,m.sideATableSeat,m.sideBTableSeat]);

/** Bind a retained, validated draw plan to actual subsequently published game
 * UUIDs. No placeholders, draw, seating/schedule writer or enrollment occurs.
 * A future authenticated backend must re-read these sources under its guards. */
export function prepareReviewedDrawMixedManifest(input:ReviewedDrawMixedInput):Result{
 const blocked=(code:string):Result=>({status:"blocked",code});
 try{
  const plan=prepareReviewedDrawSchedule(input.draw);if(plan.status==="blocked")return blocked(plan.code);
  const scope=input.loadedScope;
  if(!scope||scope.actorId!==input.draw.actorId||scope.tournamentId!==plan.tournamentId||scope.eventId!==plan.eventId)return blocked("loader_scope_mismatch");
  const n=input.nativeWorkspace,w=input.publishedWorkspace,status=input.eventStatusWorkspace;
  if(!isSeatingWorkspace(n)||!isEventScheduleWorkspace(w)||!isParticipantStatusWorkspace(status))return blocked("workspaces_unavailable");
  const original=input.draw.nativeWorkspace as {publication:unknown};
  if(!n.registrationClosed||!w.registrationClosed||!n.publication||n.publication.publicationId!==plan.nativePublicationId
   ||!same(n.publication,original.publication)||n.publication.tableCount!==1||n.publication.seatsPerTable!==18
   ||w.tableCount!==1||w.seatsPerTable!==18)return blocked("native_publication_changed");
  if(n.checkIn.length!==18||new Set(n.checkIn.map(p=>p.rosterEntryId)).size!==18||n.checkIn.filter(p=>p.state==="checked_in").length!==18
   ||n.publication.assignments.some(a=>!n.checkIn.some(p=>p.rosterEntryId===a.rosterEntryId&&p.state==="checked_in"&&p.scorecardType===a.scorecardType)))return blocked("checked_roster_changed");
  const e=w.events[0];
  if(w.events.length!==1||!e||e.eventId!==plan.eventId||e.format!=="standard_singles"||e.scoringMethod!=="digital"||e.gameCount!==12||e.participantCount!==18
   ||!e.schedulePublished||!e.schedulePublicationId||!e.participantSnapshotDigest||e.publishedMatchCount!==108||e.playState!=="in_progress"||!e.startedAt||!e.startedBy)return blocked("published_event_not_started");
  if(w.participants.length!==18||new Set(w.participants.map(p=>p.participantId)).size!==18||new Set(w.participants.map(p=>p.verificationId)).size!==18
   ||w.participants.some(p=>{const b=plan.participantBindings.find(b=>b.participantId===p.participantId);const a=n.publication!.assignments.find(a=>a.rosterEntryId===b?.rosterEntryId);return p.eventId!==plan.eventId||!b||!a||p.verificationId!==b.tournamentId||p.profileLinked!==(a.scorecardType==="digital");}))return blocked("fixed_participant_bindings_changed");
  if(status.events.length!==1||status.events[0].eventId!==plan.eventId||status.events[0].playState!=="in_progress"||status.events[0].participants.length!==18
   ||new Set(status.events[0].participants.map(p=>p.participantId)).size!==18
   ||status.events[0].participants.some(p=>p.status!=="checked_in"||!w.participants.some(a=>a.participantId===p.participantId&&a.verificationId===p.verificationId)))return blocked("event_attendance_changed");
  const life=input.eventLifecycleWorkspace;
  if(!object(life)||!Array.isArray(life.events)||life.events.length!==1||!object(life.events[0]))return blocked("event_lifecycle_unavailable");
  const l=life.events[0];
  if(l.eventId!==plan.eventId||l.eventType!=="main"||l.format!=="standard_singles"||l.operationalState!=="active"||l.participantCount!==18||l.hasStarted!==true||l.replacementEventId!==null)return blocked("event_not_active_main");
  if(w.matches.length!==108||new Set(w.matches.map(m=>m.canonicalGameId)).size!==108||w.matches.some(m=>m.eventId!==plan.eventId||m.state!=="pending")
   ||!same(w.matches.map(matchKey).sort(),plan.matches.map(matchKey).sort()))return blocked("published_schedule_changed");
  const participants=plan.participantBindings.map(b=>({participantId:b.participantId,tournamentPlayerId:b.tournamentId,
   mode:n.publication!.assignments.find(a=>a.rosterEntryId===b.rosterEntryId)!.scorecardType}));
  const participant=(fixedId:string)=>participants.find(p=>p.tournamentPlayerId===fixedId)!.participantId;
  const manifest=buildMixedMockManifest(participants,w.matches.map(m=>({gameId:m.canonicalGameId,batchNumber:m.gameNumber,
   sideA:{participantId:participant(m.sideAVerificationId),currentSeat:m.sideATableSeat,cardGameNumber:m.gameNumber},
   sideB:{participantId:participant(m.sideBVerificationId),currentSeat:m.sideBTableSeat,cardGameNumber:m.gameNumber}})));
  return{status:"prepared-not-authorized",tournamentId:plan.tournamentId,eventId:plan.eventId,reviewedOperationId:plan.reviewedOperationId,nativePublicationId:plan.nativePublicationId,
   schedulePublicationId:e.schedulePublicationId,participantSnapshotDigest:e.participantSnapshotDigest,manifest,sourceObservation:"provided-models-not-atomic",
   normalStartReceiptVerified:false,enrollmentAuthorized:false,financeWriteAuthorized:false,payoutAuthorized:false,physicalMovementCertified:false};
 }catch{return blocked("mixed_manifest_source_invalid");}
}

type Access={actorId:string;roles:string[]};
type Dependencies={access:(tournamentId:string)=>Promise<Access|null>;models:(actorId:string,tournamentId:string,eventId:string,reviewedOperationId:string)=>Promise<ReviewedDrawMixedInput>};
/** Private reader composition only; no provider/page or expanded permission.
 * Matching reads detect observed drift, not atomic game ownership or a lease. */
export function createReviewedDrawMixedManifestReader(d:Dependencies){
 return async(tournamentId:string,eventId:string,operationId:string):Promise<Result>=>{
  const blocked=(code:string):Result=>({status:"blocked",code});
  const valid=(v:unknown):v is string=>isUuid(v)&&v===v.toLowerCase();
  const allowed=(a:Access|null):a is Access=>!!a&&valid(a.actorId)&&Array.isArray(a.roles)&&a.roles.some(r=>r==="director"||r==="co_director");
  if(![tournamentId,eventId,operationId].every(valid))return blocked("invalid_scope");
  try{
   const a=await d.access(tournamentId);if(!allowed(a))return blocked("existing_read_permission_required");
   const first=structuredClone(await d.models(a.actorId,tournamentId,eventId,operationId)),fingerprint=canonical(first);
   if(first.draw.actorId!==a.actorId||first.draw.tournamentId!==tournamentId||first.draw.eventId!==eventId
    ||!object(first.draw.operation)||first.draw.operation.operationId!==operationId)return blocked("loader_scope_mismatch");
   const p=prepareReviewedDrawMixedManifest(first);if(p.status==="blocked")return p;
   const b=await d.access(tournamentId);if(!allowed(b)||b.actorId!==a.actorId)return blocked("existing_read_permission_required");
   const second=structuredClone(await d.models(a.actorId,tournamentId,eventId,operationId));
   const c=await d.access(tournamentId);if(!allowed(c)||c.actorId!==a.actorId)return blocked("existing_read_permission_required");
   if(canonical(second)!==fingerprint)return blocked("observed_source_changed");
   const current=prepareReviewedDrawMixedManifest(second);
   return current.status==="prepared-not-authorized"?{...current,sourceObservation:"matching-double-read-not-atomic"}:current;
  }catch{return blocked("read_models_unavailable");}
 };
}
