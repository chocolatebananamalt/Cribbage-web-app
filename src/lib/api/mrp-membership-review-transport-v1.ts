import {mrpReviewUuid,isMrpMembershipManualReviewRequestV1,isMrpMembershipReviewCommandReplyV1,readMrpMembershipReviewWorkspaceV1,type MrpReviewScopeV1,type Row} from '../results/mrp-membership-review-contract-v1.ts';
import type {MrpMembershipReviewRuntimeV1} from '../../components/mrp-membership-review-v1';
/** Normal same-origin cookies only. Caller must invalidate current() on session,
 * scope, role or project change; server primary-director checks are authoritative. */
export function createMrpMembershipReviewTransportV1(o:{enabled:boolean;scope:MrpReviewScopeV1;actorId:string;sessionId:string;current:()=>boolean;recoveryCurrent?:()=>boolean;fetcher:typeof fetch;makeId:()=>string;now:()=>string}):MrpMembershipReviewRuntimeV1|null{
 if(!o.enabled||![...Object.values(o.scope),o.actorId,o.sessionId].every(mrpReviewUuid))return null;
 const scope=structuredClone(o.scope),actor=o.actorId,session=o.sessionId,base=`/api/v1/tournaments/${scope.tournamentId}/events/${scope.eventId}/mrp-membership-review`,current=o.current,recoveryCurrent=o.recoveryCurrent??o.current,fetcher=o.fetcher;
 async function send(action:'read'|'write'|'reconcile',operationId?:string,request?:Row){
  const admitted=action==='reconcile'?recoveryCurrent:current;if(!admitted())return null;
  if(action!=='read'&&(!mrpReviewUuid(operationId)||!isMrpMembershipManualReviewRequestV1(request)||request.rosterEntryId!==scope.rosterEntryId))return null;
  const captured=action==='read'?null:structuredClone(request!);
  const headers:Record<string,string>={'x-expected-actor-id':actor,'x-expected-session-id':session};if(operationId)headers['x-idempotency-key']=operationId;if(action!=='read')headers['content-type']='application/json';
  const result=await fetcher(action==='read'?`${base}?rosterEntryId=${scope.rosterEntryId}`:base+(action==='reconcile'?'/reconcile':''),{method:action==='read'?'GET':'POST',headers,credentials:'same-origin',cache:'no-store',redirect:'error',mode:'same-origin',...(action==='read'?{}:{body:JSON.stringify(captured)})});
  if(!admitted())return null;const body=await result.json();if(!admitted())return null;
  if(action==='read')return result.status===200?readMrpMembershipReviewWorkspaceV1(body,scope):null;
  if(!isMrpMembershipReviewCommandReplyV1(body,{id:scope.tournamentId,eventId:scope.eventId},captured!,action==='reconcile'))return null;
  const status=(body as Row).status,expected=status==='manual_review_recorded'||status==='not_found'?200:status==='rejected'?409:503;return result.status===expected?body:null;
 }
 return{current,recoveryCurrent,read:()=>send('read'),write:(id,request)=>send('write',id,request),reconcile:(id,request)=>send('reconcile',id,request),makeId:o.makeId,now:o.now};
}