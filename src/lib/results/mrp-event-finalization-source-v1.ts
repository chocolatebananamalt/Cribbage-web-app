import { integratedTestUiEnabled as integratedTestFeatureEnabled } from '../integrated-test-target.ts';
import 'server-only';
import {deriveCanonicalPlayoffMrp,type CanonicalPlayoffMrpInput} from './canonical-playoff-mrp.ts';
import {projectMrpMembershipAward,type MrpMembershipInput} from './mrp-membership-eligibility.ts';

export const mrpEventFinalizationEnabledV1=()=>integratedTestFeatureEnabled();
export type MrpEventScopeV1={tournamentId:string;eventId:string;actorId:string;sessionId:string};
type Access={actorId:string;sessionId:string;primaryDirector:boolean};
/** Private adapter contract, never a request body. Evidence must already have
 * been authenticated, identity-matched and event-date verified in storage.
 * The manual review journal and current public lookup do NOT satisfy it. */
export type MrpEventEvidenceV1={
 kind:'verified-event-mrp-evidence-v1';tournamentId:string;eventId:string;
 eventRevisionId:string;rosterRevisionId:string;membershipRevisionId:string;
 startsOn:string;endsOn:string;officialPlay:boolean;canonical:CanonicalPlayoffMrpInput;
 members:Array<{participantId:string;rosterEntryId:string;verifiedFrom:string;verifiedThrough:string;
  authority:'event-specific-verified'|'review-only';membership:MrpMembershipInput}>;
};
type Dependencies={enabled?:()=>boolean;access:(scope:MrpEventScopeV1)=>Promise<Access|null>;
 readVerifiedEvidence:(scope:MrpEventScopeV1)=>Promise<unknown>};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).sort().join()===keys.sort().join();
function canonicalJson(v:unknown):string{if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return`[${v.map(canonicalJson).join(',')}]`;return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonicalJson((v as Record<string,unknown>)[k])}`).join(',')}}`;}
const blocked=(code:string)=>({status:'blocked' as const,code,mrpWritten:false as const,finalizationAuthorized:false as const});

/** Snapshot foundation only. Does not store points, grant access or accept a
 * browser's assertion of eligibility. No grace-period/date inference. */
export function projectMrpEventSnapshotV1(value:unknown,scope:MrpEventScopeV1){try{
 if(!object(scope)||!exact(scope,['tournamentId','eventId','actorId','sessionId'])||!Object.values(scope).every(uuid))return blocked('invalid_scope');
 if(!object(value)||!exact(value,['kind','tournamentId','eventId','eventRevisionId','rosterRevisionId','membershipRevisionId','startsOn','endsOn','officialPlay','canonical','members'])
  ||value.kind!=='verified-event-mrp-evidence-v1'||value.tournamentId!==scope.tournamentId||value.eventId!==scope.eventId
  ||![value.eventRevisionId,value.rosterRevisionId,value.membershipRevisionId].every(uuid)||!date(value.startsOn)||!date(value.endsOn)||value.startsOn>value.endsOn
  ||value.officialPlay!==true||!Array.isArray(value.members)||value.members.length>128)return blocked('event_evidence_unavailable');
 const evidence=value as unknown as MrpEventEvidenceV1,calculation=deriveCanonicalPlayoffMrp(evidence.canonical);
 if(calculation.status!=='available'||calculation.resultScope.tournamentId!==scope.tournamentId||calculation.resultScope.eventId!==scope.eventId)return blocked('performance_evidence_unavailable');
 if(evidence.members.length!==calculation.rows.length)return blocked('membership_roster_incomplete');
 const seen=new Set<string>(),roster=new Set<string>();
 const rows=calculation.rows.map(row=>{
  const matches=evidence.members.filter(m=>m.participantId===row.participantId);if(matches.length!==1)throw Error('membership_roster_mismatch');
  const m=matches[0];if(!object(m)||!exact(m,['participantId','rosterEntryId','verifiedFrom','verifiedThrough','authority','membership'])||!uuid(m.participantId)||!uuid(m.rosterEntryId)||seen.has(m.participantId)||roster.has(m.rosterEntryId))throw Error('membership_roster_mismatch');
  seen.add(m.participantId);roster.add(m.rosterEntryId);
  const calculated={qualifyingMrp:row.qualifyingMrp,playoffMrp:row.playoffMrp,totalMrp:row.totalMrp};
  const covered=m.authority==='event-specific-verified'&&date(m.verifiedFrom)&&date(m.verifiedThrough)&&m.verifiedFrom<=evidence.startsOn&&m.verifiedThrough>=evidence.endsOn;
  const ms=m.membership?.scope;
  const bound=ms?.tournamentId===scope.tournamentId&&ms.eventId===scope.eventId&&ms.rosterEntryId===m.rosterEntryId&&ms.membershipEffectiveOn===evidence.endsOn;
  // Invalid or review-only evidence remains pending; absence is never nonmember.
  const projected=projectMrpMembershipAward(covered&&bound?m.membership:null,calculated);
  return{participantId:row.participantId,rosterEntryId:m.rosterEntryId,displayName:row.displayName,...projected};
 });
 return{status:'snapshot_available' as const,scope:structuredClone(scope),sourceCapture:structuredClone(evidence),pointsDatedOn:evidence.endsOn,
  coverage:'supported-canonical-playoff-qualifiers-only' as const,rows,reviewPending:rows.some(r=>r.awarded===null),directorReviewRequired:true as const,mrpWritten:false as const,finalizationAuthorized:false as const};
 }catch{return blocked('membership_evidence_invalid');}}

/** Two exact captures and three real identity/role checks; matching reads do not
 * claim an atomic transaction. A future writer must re-lock/recollect in SQL. */
export function createMrpEventEvidenceCollectorV1(deps:Dependencies){return async(scope:MrpEventScopeV1)=>{
 const on=()=>{try{return(deps.enabled??mrpEventFinalizationEnabledV1)()===true;}catch{return false;}};
 try{if(!on()||!scope||Object.keys(scope).sort().join()!=='actorId,eventId,sessionId,tournamentId'||!Object.values(scope).every(uuid))return blocked('feature_unavailable');
  const bound=structuredClone(scope);const admitted=async()=>{const a=await deps.access(structuredClone(bound));return!!a&&a.actorId===bound.actorId&&a.sessionId===bound.sessionId&&a.primaryDirector===true;};if(!await admitted())return blocked('not_authorized');
  const first=structuredClone(await deps.readVerifiedEvidence(structuredClone(bound)));if(!on()||!await admitted())return blocked('not_authorized');
  const second=structuredClone(await deps.readVerifiedEvidence(structuredClone(bound)));if(!on()||!await admitted()||!on())return blocked('not_authorized');
  if(canonicalJson(first)!==canonicalJson(second))return blocked('source_changed');
  return projectMrpEventSnapshotV1(second,bound);
 }catch{return blocked('source_unavailable');}
};}

/** Compare the entire retained capture, not just result/version labels. This is
 * preflight for explicit review, never permission to persist official points. */
export async function revalidateMrpEventSnapshotV1(retained:unknown,scope:MrpEventScopeV1,collect:ReturnType<typeof createMrpEventEvidenceCollectorV1>){
 try{if(!object(retained)||retained.status!=='snapshot_available')return blocked('snapshot_invalid');
  const current=await collect(scope);if(current.status!=='snapshot_available')return current;
  if(canonicalJson(current)!==canonicalJson(retained))return blocked('snapshot_changed');
  if(current.reviewPending)return blocked('membership_review_pending');
  return{status:'ready_for_director_review' as const,snapshot:current,mrpWritten:false as const,finalizationAuthorized:false as const};
 }catch{return blocked('snapshot_invalid');}
}
