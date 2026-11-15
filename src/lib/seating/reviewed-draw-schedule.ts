import { isUuid } from "../api/validation.ts";
import { isSeatingWorkspace } from "../api/seating-workspace.ts";
import { isEventScheduleWorkspace, validateScheduleForEvent, type EventScheduleMatch } from "../api/event-schedule.ts";
import { isParticipantStatusWorkspace } from "../api/participant-status.ts";
import { validateInitialGameSeats } from "../initial-game-seats.ts";
import { isReviewedDrawPublicationRequest } from "./reviewed-draw-publication.ts";
import { readReviewedDrawPublicationOperation } from "./reviewed-draw-publication-result.ts";
export type ReviewedDrawSchedulePreview = {status:"blocked";code:string}|{
 status:"prepared-not-authorized";tournamentId:string;eventId:string;nativePublicationId:string;reviewedOperationId:string;
 matches:EventScheduleMatch[];participantBindings:{participantId:string;rosterEntryId:string;tournamentId:string;displayName:string}[];
 reviewRequired:true;schedulePublished:false;eventStarted:false;sourceObservation:"provided-models-not-atomic"|"matching-double-read-not-atomic";
};
const uuid=(v:unknown):v is string=>isUuid(v)&&v===v.toLowerCase();
/** Pure derivation ONLY. No API/storage/RNG, permission, review attestation or
 * native writer call. Backend must rebind this source before publication. */
export function prepareReviewedDrawSchedule(input:{actorId:string;tournamentId:string;eventId:string;operation:unknown;nativeWorkspace:unknown;eventWorkspace:unknown;eventStatusWorkspace:unknown;eventLifecycleWorkspace:unknown;loadedScope:{actorId:string;tournamentId:string;eventId:string}}):ReviewedDrawSchedulePreview {
 const {actorId,tournamentId,eventId,operation:o,nativeWorkspace:n,eventWorkspace:w}=input;
 const blocked=(code:string):ReviewedDrawSchedulePreview=>({status:"blocked",code});
 if(![actorId,tournamentId,eventId].every(uuid))return blocked("invalid_scope");
 if(!input.loadedScope||input.loadedScope.actorId!==actorId||input.loadedScope.tournamentId!==tournamentId||input.loadedScope.eventId!==eventId)return blocked("loader_scope_mismatch");
 if(!o||typeof o!=="object"||Array.isArray(o)||!("request"in o)||!isReviewedDrawPublicationRequest(o.request))return blocked("reviewed_publication_unavailable");
 const outcome=readReviewedDrawPublicationOperation(o,{actorId,tournamentId,request:o.request});
 if(outcome.kind!=="accepted")return blocked("reviewed_publication_unavailable");
 if(!isSeatingWorkspace(n)||!isEventScheduleWorkspace(w))return blocked("workspaces_unavailable");
 const native=n.publication,candidate=o.request.reviewedCandidate;
 if(!native||native.publicationId!==outcome.receipt.publicationId||native.tableCount!==1||native.seatsPerTable!==18
 ||native.assignments.length!==18||!n.registrationClosed||!w.registrationClosed||w.tableCount!==1||w.seatsPerTable!==18)return blocked("native_publication_changed");
 const byRoster=new Map(candidate.assignments.map(a=>[a.participantId,a.tournamentId]));
 if(new Set(native.assignments.map(a=>a.rosterEntryId)).size!==18||new Set(native.assignments.map(a=>a.verificationId)).size!==18
 ||native.assignments.some(a=>byRoster.get(a.rosterEntryId)!==a.verificationId||a.initialTableSeat!==a.verificationId))return blocked("fixed_ids_changed");
 const checked=n.checkIn.filter(p=>p.state==="checked_in");
 if(checked.length!==18||new Set(checked.map(p=>p.rosterEntryId)).size!==18
 ||checked.some(p=>!native.assignments.some(a=>a.rosterEntryId===p.rosterEntryId&&a.scorecardType===p.scorecardType))
 ||checked.filter(p=>p.scorecardType==="digital").length!==6)return blocked("checked_roster_changed");
 if(w.events.length!==1||w.events[0].eventId!==eventId)return blocked("single_event_required");
 const e=w.events[0],players=w.participants.filter(p=>p.eventId===eventId);
 // Existing lifecycle reader supplies active/retired state absent from the
 // schedule/status DTOs. Never infer active Main from an event display name.
 const life=input.eventLifecycleWorkspace;
 if(!life||typeof life!=="object"||Array.isArray(life)||!("events"in life)||!Array.isArray(life.events)||life.events.length!==1
 ||!life.events[0]||typeof life.events[0]!=="object")return blocked("event_lifecycle_unavailable");
 const active=life.events[0]as Record<string,unknown>;
 if(active.eventId!==eventId||active.eventType!=="main"||active.format!=="standard_singles"||active.operationalState!=="active"
 ||active.participantCount!==18||active.hasStarted!==false||active.replacementEventId!==null)return blocked("event_not_active_main");

 if(e.format!=="standard_singles"||e.scoringMethod!=="digital"||e.gameCount!==12||e.participantCount!==18
 ||e.schedulePublished||e.schedulePublicationId!==null||e.participantSnapshotDigest!==null||e.publishedMatchCount!==0
 ||e.playState!=="preparing"||e.startedAt!==null||e.startedBy!==null||w.matches.length!==0)return blocked("event_not_preparing");
 if(w.participants.length!==18||players.length!==18||new Set(players.map(p=>p.participantId)).size!==18||new Set(players.map(p=>p.verificationId)).size!==18
 ||players.some(p=>!uuid(p.participantId))||players.some(p=>{const a=native.assignments.find(a=>a.verificationId===p.verificationId);return !a||p.profileLinked!==(a.scorecardType==="digital");}))return blocked("event_participants_changed");
 const statuses=input.eventStatusWorkspace;
 if(!isParticipantStatusWorkspace(statuses)||statuses.events.length!==1||statuses.events[0].eventId!==eventId
 ||statuses.events[0].playState!==e.playState||statuses.events[0].participants.length!==18
 ||new Set(statuses.events[0].participants.map(p=>p.participantId)).size!==18
 ||statuses.events[0].participants.some(p=>p.status!=="checked_in"||!players.some(current=>current.participantId===p.participantId&&current.verificationId===p.verificationId)))return blocked("event_attendance_changed");
 const bindings=players.map(p=>({participantId:p.participantId,rosterEntryId:native.assignments.find(a=>a.verificationId===p.verificationId)!.rosterEntryId,tournamentId:p.verificationId,displayName:p.displayName}));
 const matches=candidate.matches.map(m=>({gameNumber:m.round,sideAVerificationId:byRoster.get(m.sides[0].participantId)!,sideBVerificationId:byRoster.get(m.sides[1].participantId)!,sideATableSeat:m.sides[0].seatId,sideBTableSeat:m.sides[1].seatId}));
 if(matches.length!==108||validateScheduleForEvent(matches,12,players.map(p=>p.verificationId),1,18).length||validateInitialGameSeats(matches).length
 ||new Set(matches.map(m=>[m.sideAVerificationId,m.sideBVerificationId].sort().join(":"))).size!==108)return blocked("schedule_projection_invalid");
 return{status:"prepared-not-authorized",tournamentId,eventId,nativePublicationId:native.publicationId,reviewedOperationId:outcome.receipt.operationId,
 matches:structuredClone(matches),participantBindings:bindings,reviewRequired:true,schedulePublished:false,eventStarted:false,sourceObservation:"provided-models-not-atomic"};
}
