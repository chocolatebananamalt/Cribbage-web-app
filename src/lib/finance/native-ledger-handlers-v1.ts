import 'server-only';
import{createHash}from'node:crypto';
import type{NextRequest}from'next/server';
import{planNativeLedgerAllocationsV1}from'./native-ledger-allocation-plan-v1.ts';
import{isUuid}from'../api/validation.ts';
type Context={params:Promise<{id:string;operationId?:string}>};
type Access={actorId:string;roles:string[]};
export type NativeLedgerRequestV1={kind:'native-ledger-allocation-v1';operationId:string;expectedRevisionId:string|null;sourceDigest:string;allocations:unknown[];reason:string;reviewed:true};
export type NativeLedgerEnvelopeV1={kind:'native-ledger-transport-v1';actorId:string;tournamentId:string;request:NativeLedgerRequestV1};
type Binding={actorId:string;tournamentId:string;operationId:string;requestBindingHash:string;envelope:NativeLedgerEnvelopeV1};
type Planned=Extract<ReturnType<typeof planNativeLedgerAllocationsV1>,{status:'planned'}>;
export type NativeLedgerPreparedRecordV1=Binding&{kind:'native-ledger-prepared-operation-v1';sourceSnapshot:unknown;outcome:{status:'prepared';plan:Planned;persisted:false;ledgerWriteAllowed:false;moneyMoved:false}};
/** A real adapter must implement this entire callback in ONE READ COMMITTED
 * transaction with actor/op then tournament then role locks and rollback on throw. These
 * interfaces and mocked tests cannot establish those database guarantees.
 * recordPrepared is immutable planning evidence ONLY, not an allocation writer.
 */
export type NativeLedgerTransactionPortV1={isolation:'read_committed';access:()=>Promise<Access|null>;lookupOperation:()=>Promise<unknown|null>;currentHead:()=>Promise<{revisionId:string|null;version:number}>;readSources:()=>Promise<unknown>;reserve:(binding:Binding)=>Promise<'reserved'|'conflict'>;recordPrepared:(record:NativeLedgerPreparedRecordV1)=>Promise<unknown>};
export class NativeLedgerRetryV1 extends Error{readonly code:'operation_busy'|'source_busy'|'source_changed';constructor(code:'operation_busy'|'source_busy'|'source_changed'){super(code);this.code=code;}}
class NativeLedgerPlanBlockedV1 extends Error{readonly code:string;constructor(code:string){super(code);this.code=code;}}
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>obj(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>isUuid(v)&&v===v.toLowerCase();
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>obj(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const copy=<T>(v:T):T=>freeze(JSON.parse(canonical(v))as T);
function jsonSafe(v:unknown,depth=0):boolean{if(depth>12)return false;if(v===null||typeof v==='string'||typeof v==='boolean')return true;if(typeof v==='number')return Number.isSafeInteger(v)&&!Object.is(v,-0);if(Array.isArray(v))return v.length<=10000&&Reflect.ownKeys(v).length===v.length+1&&v.every(x=>jsonSafe(x,depth+1));return obj(v)&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&jsonSafe(v[k],depth+1));}
export function isNativeLedgerEnvelopeV1(v:unknown):v is NativeLedgerEnvelopeV1{
 if(!jsonSafe(v)||!exact(v,['kind','actorId','tournamentId','request'])||v.kind!=='native-ledger-transport-v1'||!uuid(v.actorId)||!uuid(v.tournamentId)||!exact(v.request,['kind','operationId','expectedRevisionId','sourceDigest','allocations','reason','reviewed']))return false;
 const r=v.request;return r.kind==='native-ledger-allocation-v1'&&uuid(r.operationId)&&(r.expectedRevisionId===null||uuid(r.expectedRevisionId))&&typeof r.sourceDigest==='string'&&/^[a-f0-9]{64}$/.test(r.sourceDigest)&&Array.isArray(r.allocations)&&r.allocations.length<=10000&&r.reviewed===true&&typeof r.reason==='string'&&r.reason===r.reason.trim()&&r.reason.length>=1&&r.reason.length<=500&&!/[\u0000-\u001f\u007f]/.test(r.reason)&&new TextEncoder().encode(canonical(v)).byteLength<=1000000;
}
/** Versioned request is projected only AFTER its full exact shape is checked;
 * expectedRevisionId is never omitted from binding hash or current-head CAS.
 */
function plannerRequest(r:NativeLedgerRequestV1){return{sourceDigest:r.sourceDigest,operationId:r.operationId,allocations:r.allocations,reason:r.reason,reviewed:r.reviewed};}
function binding(envelope:NativeLedgerEnvelopeV1):Binding{return{actorId:envelope.actorId,tournamentId:envelope.tournamentId,operationId:envelope.request.operationId,requestBindingHash:createHash('sha256').update(canonical(envelope)).digest('hex'),envelope:copy(envelope)};}
const permitted=(a:Access|null,actorId?:string):a is Access=>!!a&&uuid(a.actorId)&&(!actorId||a.actorId===actorId)&&Array.isArray(a.roles)&&a.roles.every(r=>typeof r==='string')&&a.roles.some(r=>r==='director'||r==='co_director');
function sourceBound(v:unknown,b:Binding){return obj(v)&&v.actorId===b.actorId&&v.tournamentId===b.tournamentId;}
export function readNativeLedgerPreparedRecordV1(v:unknown,envelope:unknown):NativeLedgerPreparedRecordV1|null{
 if(!isNativeLedgerEnvelopeV1(envelope)||!exact(v,['kind','actorId','tournamentId','operationId','requestBindingHash','envelope','sourceSnapshot','outcome'])||v.kind!=='native-ledger-prepared-operation-v1')return null;
 const b=binding(envelope);if(v.actorId!==b.actorId||v.tournamentId!==b.tournamentId||v.operationId!==b.operationId||v.requestBindingHash!==b.requestBindingHash||canonical(v.envelope)!==canonical(b.envelope)||!sourceBound(v.sourceSnapshot,b)||!exact(v.outcome,['status','plan','persisted','ledgerWriteAllowed','moneyMoved'])||v.outcome.status!=='prepared'||v.outcome.persisted!==false||v.outcome.ledgerWriteAllowed!==false||v.outcome.moneyMoved!==false)return null;
 const planned=planNativeLedgerAllocationsV1({current:v.sourceSnapshot,request:plannerRequest(envelope.request)});
 return planned.status==='planned'&&canonical(v.outcome.plan)===canonical(planned)?copy(v as NativeLedgerPreparedRecordV1):null;
}
/** No default live backend or actual route. Even an injected mock journal can
 * return only PREPARED/nonpersisted evidence here. The separate SQL writer's
 * accepted receipt needs its own reviewed persisted-result adapter.
 */
export function createNativeLedgerHandlersV1<Reply>(d:{enabled?:()=>boolean;access:(tid:string)=>Promise<Access|null>;transaction:<T>(scope:{actorId:string;tournamentId:string;operationId:string;readOnly:boolean},run:(tx:NativeLedgerTransactionPortV1)=>Promise<T>)=>Promise<T>;sameOrigin:(r:NextRequest)=>boolean;readJson:(r:NextRequest,limits:{maxBytes:number})=>Promise<unknown>;json:(v:unknown,init?:ResponseInit)=>Reply;boundary:(run:()=>Promise<Reply>)=>Promise<Reply>}){
 const respond=(body:unknown,init?:ResponseInit)=>{const headers=new Headers(init?.headers);headers.set('Cache-Control','private, no-store');headers.set('Vary','Cookie, Authorization');headers.set('X-Content-Type-Options','nosniff');return d.json(body,{...init,headers});};
 const fail=(status:number,error:string)=>respond({error},{status});
 const guarded=(run:()=>Promise<Reply>)=>d.boundary(async()=>{try{return await run();}catch{return fail(503,'operation_outcome_unknown');}});
 async function enter(r:NextRequest,c:Context,method:'GET'|'POST'):Promise<{reply:Reply}|{actorId:string;tid:string;operationId:string|undefined}>{
  if(d.enabled?.()!==true)return{reply:fail(404,'not_found')};if(r.method!==method)return{reply:fail(405,'method_not_allowed')};if(method==='POST'&&!d.sameOrigin(r))return{reply:fail(403,'invalid_origin')};const p=await c.params;if(!uuid(p.id))return{reply:fail(400,'invalid_request')};const a=await d.access(p.id);if(!a)return{reply:fail(401,'unauthorized')};if(!permitted(a))return{reply:fail(403,'forbidden')};return{actorId:a.actorId,tid:p.id,operationId:p.operationId};
 }
 const still=async(actorId:string,tid:string)=>permitted(await d.access(tid),actorId);
 return{
  POST:(r:NextRequest,c:Context)=>guarded(async()=>{
   const e=await enter(r,c,'POST');if('reply'in e)return e.reply;
   const body=await d.readJson(r,{maxBytes:1000000});if(!isNativeLedgerEnvelopeV1(body)||body.actorId!==e.actorId||body.tournamentId!==e.tid)return fail(400,'invalid_request');const b=binding(body);
   try{
    const result=await d.transaction({actorId:b.actorId,tournamentId:b.tournamentId,operationId:b.operationId,readOnly:false},async tx=>{
     if(tx.isolation!=='read_committed')throw new NativeLedgerRetryV1('source_busy');if(!permitted(await tx.access(),e.actorId))throw Error('role_changed');
     const prior=await tx.lookupOperation();if(prior!==null){if(!obj(prior)||!isNativeLedgerEnvelopeV1(prior.envelope))throw Error('operation_outcome_unknown');if(canonical(prior.envelope)!==canonical(body))return{status:'rejected',code:'operation_conflict'};const record=readNativeLedgerPreparedRecordV1(prior,body);if(!record)throw Error('operation_outcome_unknown');if(!permitted(await tx.access(),e.actorId))throw Error('role_changed');return record;}
     const head=await tx.currentHead();if(!exact(head,['revisionId','version'])||!(head.revisionId===null||uuid(head.revisionId))||!Number.isSafeInteger(head.version)||head.version<0||(head.version===0)!==(head.revisionId===null))throw Error('invalid_head');if(head.revisionId!==body.request.expectedRevisionId)return{status:'rejected',code:'allocation_revision_changed'};
     if(await tx.reserve(b)!=='reserved')throw new NativeLedgerRetryV1('operation_busy');
     const first=await tx.readSources();if(!sourceBound(first,b))throw Error('invalid_source');const snapshot=copy(first);if(obj(snapshot)&&snapshot.sourceDigest!==body.request.sourceDigest)throw new NativeLedgerRetryV1('source_changed');const plan=planNativeLedgerAllocationsV1({current:snapshot,request:plannerRequest(body.request)});if(plan.status!=='planned')throw new NativeLedgerPlanBlockedV1(plan.code);
     const second=await tx.readSources();if(canonical(second)!==canonical(snapshot))throw new NativeLedgerRetryV1('source_changed');const afterHead=await tx.currentHead();if(canonical(afterHead)!==canonical(head))throw new NativeLedgerRetryV1('source_changed');if(!permitted(await tx.access(),e.actorId))throw Error('role_changed');
     const record:NativeLedgerPreparedRecordV1={kind:'native-ledger-prepared-operation-v1',...b,sourceSnapshot:snapshot,outcome:{status:'prepared',plan,persisted:false,ledgerWriteAllowed:false,moneyMoved:false}};
     const stored=await tx.recordPrepared(copy(record));if(!readNativeLedgerPreparedRecordV1(stored,body)||canonical(stored)!==canonical(record))throw Error('record_outcome_unknown');if(!permitted(await tx.access(),e.actorId))throw Error('role_changed');return copy(record);
    });
    if(!await still(e.actorId,e.tid))return fail(403,'forbidden');return respond(result,{status:'status'in result&&result.status==='rejected'?409:200});
   }catch(error){if(error instanceof NativeLedgerRetryV1)return respond({status:'retry_exact',code:error.code},{status:503});if(error instanceof NativeLedgerPlanBlockedV1)return respond({...b,status:'not_prepared',code:error.code,persisted:false,ledgerWriteAllowed:false,moneyMoved:false},{status:409});return fail(503,'operation_outcome_unknown');}
  }),
  operationGET:(r:NextRequest,c:Context)=>guarded(async()=>{
   const e=await enter(r,c,'GET');if('reply'in e)return e.reply;if(!uuid(e.operationId)||new URL(r.url).search!=='')return fail(400,'invalid_request');
   try{const result=await d.transaction({actorId:e.actorId,tournamentId:e.tid,operationId:e.operationId,readOnly:true},async tx=>{
    if(tx.isolation!=='read_committed'||!permitted(await tx.access(),e.actorId))throw Error('scope_unavailable');const v=await tx.lookupOperation();if(!obj(v)||!isNativeLedgerEnvelopeV1(v.envelope)||v.envelope.actorId!==e.actorId||v.envelope.tournamentId!==e.tid||v.envelope.request.operationId!==e.operationId)throw Error('unknown_operation');const record=readNativeLedgerPreparedRecordV1(v,v.envelope);if(!record||!permitted(await tx.access(),e.actorId))throw Error('unknown_operation');return record;
   });return await still(e.actorId,e.tid)?respond(result):fail(403,'forbidden');}catch{return fail(503,'operation_outcome_unknown');}
  }),
 };
}
