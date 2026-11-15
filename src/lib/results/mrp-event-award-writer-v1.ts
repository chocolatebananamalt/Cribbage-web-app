import 'server-only';
import {createHash} from 'node:crypto';
import {projectMrpEventSnapshotV1,type MrpEventScopeV1} from './mrp-event-finalization-source-v1.ts';
export const mrpEventAwardWriterEnabledV1=()=>false;
export type MrpAwardRequestV1={operationId:string;expectedHeadId:string|null;expectedSourceDigest:string;reason:string;confirmed:true};
type Snapshot=Extract<ReturnType<typeof projectMrpEventSnapshotV1>,{status:'snapshot_available'}>;
type Access={actorId:string;sessionId:string;primaryDirector:boolean};
type Head={id:string;version:number}|null;
export type MrpEventAwardRecordV1={kind:'reviewed-event-mrp-awards-v1';id:string;version:number;priorId:string|null;
 tournamentId:string;eventId:string;actorId:string;actorSessionId:string;operationId:string;request:MrpAwardRequestV1;
 sourceDigest:string;sourceCapture:Snapshot['sourceCapture'];rows:Snapshot['rows'];pointsDatedOn:string;
 recordedAt:string;reportingSubmitted:false;coverage:'supported-canonical-playoff-qualifiers-only'};
/** A real adapter MUST use one transaction: serialize actor/operation, lock event,
 * result, roster and membership heads (including reciprocal source writers),
 * enforce immutable history + unique operation and CAS head, rollback on throw.
 * This port and mocked tests do not prove database isolation or authorization. */
export type MrpEventAwardTransactionV1={
 access:()=>Promise<Access|null>;lookupOperation:()=>Promise<MrpEventAwardRecordV1|null>;
 currentHead:()=>Promise<Head>;readLockedVerifiedEvidence:()=>Promise<unknown>;
 append:(record:Omit<MrpEventAwardRecordV1,'id'|'recordedAt'>)=>Promise<MrpEventAwardRecordV1>;
};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
export const mrpEventSourceDigestV1=(capture:Snapshot['sourceCapture'])=>createHash('sha256').update(canonical(['event-mrp-evidence-v1',capture])).digest('hex');
const denied=(code:string)=>({status:'blocked' as const,code,mrpWritten:false as const,reportingSubmitted:false as const});
function requestValid(v:unknown):v is MrpAwardRequestV1{return object(v)&&Object.keys(v).sort().join()==='confirmed,expectedHeadId,expectedSourceDigest,operationId,reason'&&uuid(v.operationId)&&(v.expectedHeadId===null||uuid(v.expectedHeadId))&&typeof v.expectedSourceDigest==='string'&&/^[a-f0-9]{64}$/.test(v.expectedSourceDigest)&&v.confirmed===true&&typeof v.reason==='string'&&v.reason===v.reason.trim()&&v.reason.length>0&&v.reason.length<=500&&!/[\u0000-\u001f\u007f]/.test(v.reason);}
/** Callback transaction only: no provider, route, SQL or official report is
 * installed by this module. Never accept points/eligibility from a request. */
export function createMrpEventAwardWriterV1(deps:{enabled?:()=>boolean;transaction:<T>(scope:MrpEventScopeV1,operationId:string,run:(tx:MrpEventAwardTransactionV1)=>Promise<T>)=>Promise<T>}){
 return async(scope:MrpEventScopeV1,request:unknown)=>{
  const on=()=>{try{return(deps.enabled??mrpEventAwardWriterEnabledV1)()===true;}catch{return false;}};
  try{if(!on())return denied('feature_unavailable');if(!object(scope)||Object.keys(scope).sort().join()!=='actorId,eventId,sessionId,tournamentId'||!Object.values(scope).every(uuid)||!requestValid(request))return denied('invalid_request');
   const s=structuredClone(scope),r=structuredClone(request);
   return await deps.transaction(structuredClone(s),r.operationId,async tx=>{
    const authorized=async()=>{const a=await tx.access();if(!on()||!a||a.actorId!==s.actorId||a.sessionId!==s.sessionId||a.primaryDirector!==true)throw Error('not_authorized');};
    await authorized();
    const previous=structuredClone(await tx.lookupOperation());
    if(previous!==null){
     if(!object(previous)||Object.keys(previous).sort().join()!==['kind','id','version','priorId','tournamentId','eventId','actorId','actorSessionId','operationId','request','sourceDigest','sourceCapture','rows','pointsDatedOn','recordedAt','reportingSubmitted','coverage'].sort().join())throw Error('stored_operation_invalid');
     if(previous.tournamentId!==s.tournamentId||previous.eventId!==s.eventId||previous.actorId!==s.actorId||previous.operationId!==r.operationId||!same(previous.request,r))return denied('operation_conflict');
     const derived=projectMrpEventSnapshotV1(previous.sourceCapture,{...s,sessionId:previous.actorSessionId});
     if(derived.status!=='snapshot_available'||derived.reviewPending||previous.kind!=='reviewed-event-mrp-awards-v1'||!uuid(previous.id)||!Number.isSafeInteger(previous.version)||previous.version<1||!same(previous.rows,derived.rows)||previous.sourceDigest!==mrpEventSourceDigestV1(derived.sourceCapture)||previous.sourceDigest!==r.expectedSourceDigest||previous.pointsDatedOn!==derived.pointsDatedOn||previous.reportingSubmitted!==false||previous.coverage!==derived.coverage)throw Error('stored_operation_invalid');
     if(!uuid(previous.actorSessionId)||previous.priorId!==r.expectedHeadId||(previous.version===1)!==(previous.priorId===null)||typeof previous.recordedAt!=='string'||!Number.isFinite(Date.parse(previous.recordedAt)))throw Error('stored_operation_invalid');
     await authorized();return{status:'recorded' as const,record:structuredClone(previous),exactReplay:true,historicalReceipt:true,currentSourceVerified:false,mrpWritten:true as const,reportingSubmitted:false as const};
    }
    const head=structuredClone(await tx.currentHead());if(head!==null&&(!uuid(head.id)||!Number.isSafeInteger(head.version)||head.version<1||head.version>=Number.MAX_SAFE_INTEGER))throw Error('invalid_head');
    if((head?.id??null)!==r.expectedHeadId)return denied('head_changed');
    const capture=structuredClone(await tx.readLockedVerifiedEvidence()),snapshot=projectMrpEventSnapshotV1(capture,s);
    if(snapshot.status!=='snapshot_available')return denied(snapshot.code);
    if(snapshot.reviewPending)return denied('membership_review_pending');
    const digest=mrpEventSourceDigestV1(snapshot.sourceCapture);if(digest!==r.expectedSourceDigest)return denied('source_changed');
    await authorized();if(!same(capture,await tx.readLockedVerifiedEvidence())||!same(head,await tx.currentHead()))throw Error('source_changed');
    const draft={kind:'reviewed-event-mrp-awards-v1' as const,version:(head?.version??0)+1,priorId:head?.id??null,tournamentId:s.tournamentId,eventId:s.eventId,actorId:s.actorId,actorSessionId:s.sessionId,operationId:r.operationId,request:r,sourceDigest:digest,sourceCapture:snapshot.sourceCapture,rows:snapshot.rows,pointsDatedOn:snapshot.pointsDatedOn,reportingSubmitted:false as const,coverage:snapshot.coverage};
    const stored=structuredClone(await tx.append(structuredClone(draft)));
    const{id,recordedAt,...saved}=stored;if(!uuid(id)||typeof recordedAt!=='string'||!Number.isFinite(Date.parse(recordedAt))||!same(saved,draft))throw Error('stored_operation_invalid');
    await authorized();return{status:'recorded' as const,record:stored,exactReplay:false,mrpWritten:true as const,reportingSubmitted:false as const};
   });
  }catch{return{status:'outcome_unknown' as const,code:'transaction_outcome_unconfirmed',mrpWritten:null,reportingSubmitted:false as const,exactOperationRecoveryRequired:true as const};}
 };
}
