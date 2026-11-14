import {captureResultMrpMembershipV1} from './result-mrp-membership-capture-v1.ts';
import{readMainFourPlayoffProviderV1}from'./main-four-playoff-provider-v1.ts';
import'server-only';
import{createClient}from'../supabase/server';
import{createServerOnlyAdminClient}from'../supabase/private-admin';
import{requireVerifiedIdentity}from'../api/verified-subject.ts';
import{isQualificationResult}from'../api/qualification-finalization.ts';
import{isTournamentResultEventSummary}from'../api/result-event-summary.ts';
import{getSyntheticEventContext}from'../paper-games/synthetic-event-context';
import{resultBasedMrpEnabledV1,type ResultMrpScopeV1}from'./result-based-mrp-v1.ts';
import{createResultBasedMrpReaderV1}from'./result-based-mrp-read-v1.ts';
export async function readResultBasedMrpProductionV1(scope:ResultMrpScopeV1){
 if(!resultBasedMrpEnabledV1())return{status:'blocked' as const,code:'disabled',actualMrpAwarded:false as const,accSubmissionPerformed:false as const};
 const normal=await createClient();let admin:ReturnType<typeof createServerOnlyAdminClient>|null=null;
 return createResultBasedMrpReaderV1({enabled:resultBasedMrpEnabledV1,now:()=>new Date().toISOString(),access:async()=>{const identity=await requireVerifiedIdentity(normal),user=await normal.auth.getUser();if(!identity||user.error||user.data.user?.id!==identity.subject)return null;const role=await normal.rpc('get_tournament_role',{p_tournament_id:scope.tournamentId});return role.error||typeof role.data!=='string'?null:{actorId:identity.subject,sessionId:identity.sessionId,roles:[role.data]};},capture:async actor=>{
  admin??=createServerOnlyAdminClient();const args={p_actor_id:actor,p_tournament_id:scope.tournamentId,p_event_id:scope.eventId};
  const[q,summary,schedule,ties,standings,syntheticContext]=await Promise.all([admin.rpc('get_standard_singles_qualification_result_v1',args),admin.rpc('get_tournament_result_events_v1',{p_actor_id:actor,p_tournament_id:scope.tournamentId}),admin.rpc('get_event_schedule_workspace_v1',{p_actor_id:actor,p_tournament_id:scope.tournamentId}),admin.rpc('get_qualification_tie_workspace_v1',args),normal.rpc('get_preliminary_event_standings',{p_tournament_id:scope.tournamentId,p_event_id:scope.eventId}),getSyntheticEventContext(actor,scope.tournamentId)]);
  if([q,summary,schedule,ties,standings].some(r=>r.error))throw Error('source_unavailable');
  let playoff:unknown=null,mainFourBinding:unknown=null,nativePlayoff:unknown=null;if(isQualificationResult(q.data,scope.tournamentId,scope.eventId)&&isTournamentResultEventSummary(summary.data)){const event=summary.data.events.find(e=>e.eventId===scope.eventId);let reply=null;if(event?.eventType==='main'&&q.data.qualifierCount===5)reply=await admin.rpc('get_standard_singles_playoff_outcome_workspace_v4',args);else if(event?.eventType==='main'&&q.data.qualifierCount===4)reply=await admin.rpc('get_standard_singles_playoff_outcome_workspace_v3',args);else if(event?.eventType==='consolation'&&q.data.qualifierCount===4)reply=await admin.rpc('get_consolation_playoff_workspace_v1',{actor,tid:scope.tournamentId,eid:scope.eventId});if(event&&['main','consolation'].includes(event.eventType)&&q.data.qualifierCount>=6&&q.data.qualifierCount<=64){try{const native=await normal.rpc('get_native_playoff_mrp_source_v1',{p_tournament_id:scope.tournamentId,p_event_id:scope.eventId});if(!native.error)nativePlayoff=structuredClone(native.data);}catch{/* Qualifying proposals remain separate from unavailable playoff proof. */}}if(reply&&!reply.error){playoff=structuredClone(reply.data);if(event?.eventType==='main'&&q.data.qualifierCount===4)mainFourBinding=await readMainFourPlayoffProviderV1({client:normal,scope:{actorId:actor,tournamentId:scope.tournamentId,eventId:scope.eventId,qualificationResultVersionId:q.data.resultVersionId,qualificationVersion:q.data.version},workspace:playoff,enabled:resultBasedMrpEnabledV1});}}
  // Membership lookup failure annotates the report; it never gates its preparation.
  const players=isQualificationResult(q.data,scope.tournamentId,scope.eventId)?q.data.qualifiers.flatMap(row=>{const person=(schedule.data as {participants?:Array<{participantId:string;verificationId:string;displayName:string}>})?.participants?.find(p=>p.participantId===row.participantId);return person?[{verificationId:person.verificationId,displayName:row.displayName}]:[];}):[];
  const membershipReporting=await captureResultMrpMembershipV1({eventId:scope.eventId,players,
   readRoster:async()=>{const r=await admin!.rpc('get_event_roster_enrollment_workspace_v3',{p_actor_id:actor,p_tournament_id:scope.tournamentId});return r.error?null:r.data;},
   readReview:async rosterEntryId=>{const r=await normal.rpc('get_mrp_membership_manual_review_v1',{p_tournament_id:scope.tournamentId,p_event_id:scope.eventId,p_roster_entry_id:rosterEntryId});return r.error?null:r.data;}});
  return{membershipReporting,qualification:q.data,eventSummary:summary.data,schedule:schedule.data,ties:ties.data,standings:standings.data,playoff,mainFourBinding,nativePlayoff,syntheticContext};
 }})(scope);
}
