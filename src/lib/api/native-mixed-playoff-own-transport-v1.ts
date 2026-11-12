import type{NativeMixedOwnClientV1}from'./native-mixed-game-evidence-transport-v1.ts';
import{readNativeMixedPlayoffOwnV1,isNativeMixedPlayoffOwnScopeV1,type NativeMixedPlayoffOwnScopeV1,type NativeMixedPlayoffOwnStateV1,type NativeMixedPlayoffOwnCommandV1}from'../playoffs/native-mixed-playoff-own-view-v1.ts';
export type NativeMixedPlayoffOwnTargetV1={actorId:string;sessionId:string;projectUrl:string;projectRef:string;ownScope:NativeMixedPlayoffOwnScopeV1};
type WireRequest=NativeMixedPlayoffOwnCommandV1&{reason:string};
export type NativeMixedPlayoffPreparedV1={version:'native-mixed-playoff-prepared-v1';target:NativeMixedPlayoffOwnTargetV1;operationId:string;request:WireRequest;retainedRaw:string};
export type NativeMixedPlayoffReceiptV1={status:'simulated_playoff_evidence_recorded';contextId:string;slot:number;gameNumber:number;entryId:string;revision:number;historyDigest:string;sourceDigest:string;matchDigest:string;gameComplete:boolean;matchComplete:boolean;winnerId:string|null;simulationOnly:true;ordinaryQualificationRecorded:false;mrpAwarded:false;moneyMoved:false;historicalReceipt?:true;currentSourceVerified?:false};
type Negative={status:'rejected'|'blocked'|'retry_exact';code:string};
type ReadError='disabled'|'invalid_target'|'identity_changed'|'provider_unavailable'|'invalid_response';
type ReadResult={data:NativeMixedPlayoffOwnStateV1;error:null}|{data:null;error:ReadError};
type WriteResult={data:NativeMixedPlayoffReceiptV1|Negative;error:null;dispatched:true;prepared:NativeMixedPlayoffPreparedV1;serverStateVerified:false}|{data:null;error:ReadError|'invalid_request'|'operation_outcome_unknown';dispatched:boolean;prepared:NativeMixedPlayoffPreparedV1|null;serverStateVerified:false};
const reason='Own explicitly simulated playoff entry; no ordinary result, MRP or money movement.';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,k:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const int=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isInteger(v)&&!Object.is(v,-0)&&v>=min&&v<=max;
function plain(v:unknown,seen=new Set<object>(),depth=0,budget={n:0}):boolean{
 if(depth>16||++budget.n>512)return false;if(v===null||typeof v==='string'||typeof v==='boolean')return true;if(typeof v==='number')return Number.isFinite(v);
 if(typeof v!=='object'||seen.has(v)||(!Array.isArray(v)&&!object(v)))return false;seen.add(v);const keys=Reflect.ownKeys(v);
 if(Array.isArray(v)&&(v.length>16||keys.length!==v.length+1))return false;
 for(const k of keys){if(Array.isArray(v)&&k==='length')continue;const d=Object.getOwnPropertyDescriptor(v,k);if(typeof k!=='string'||!d||!('value'in d)||!d.enumerable||!plain(d.value,seen,depth+1,budget))return false;}seen.delete(v);return true;
}
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function target(v:unknown,url:string,ref:string):v is NativeMixedPlayoffOwnTargetV1{
 if(!plain(v)||!exact(v,['actorId','sessionId','projectUrl','projectRef','ownScope'])||!uuid(v.actorId)||!uuid(v.sessionId)||!isNativeMixedPlayoffOwnScopeV1(v.ownScope)
  ||v.projectUrl!==url||v.projectRef!==ref||typeof ref!=='string'||!/^[a-z0-9-]{1,128}$/.test(ref)||typeof url!=='string')return false;
 try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&u.origin===url;}catch{return false;}
}
function command(v:unknown,t:NativeMixedPlayoffOwnTargetV1):v is NativeMixedPlayoffOwnCommandV1{
 if(!plain(v)||!exact(v,['version','action','expectedSourceDigest','data'])||v.version!=='native-mixed-playoff-request-v1'||v.action!=='game-action'||!hash(v.expectedSourceDigest)
  ||!exact(v.data,['contextId','slot','gameNumber','expectedMatchDigest','expectedRevision','expectedHistoryDigest','entry']))return false;
 const d=v.data,e=d.entry;if(!uuid(d.contextId)||!int(d.slot,1,4)||!int(d.gameNumber,1,2500)||!hash(d.expectedMatchDigest)||!int(d.expectedRevision,0,5)||!hash(d.expectedHistoryDigest)||!object(e)||e.participantId!==t.ownScope.participantId||!uuid(e.winnerParticipantId))return false;
 if(e.type==='digital-submit')return exact(e,['type','participantId','winnerParticipantId','statement'])&&e.statement==='simulation-own-playoff-result-v1';
 return e.type==='digital-confirm'&&exact(e,['type','participantId','submissionId','winnerParticipantId','evidenceIds','statement'])&&uuid(e.submissionId)&&e.statement==='simulation-own-playoff-confirmation-v1'
  &&Array.isArray(e.evidenceIds)&&e.evidenceIds.length>=2&&e.evidenceIds.length<=3&&e.evidenceIds.every(uuid)&&new Set(e.evidenceIds).size===e.evidenceIds.length&&e.evidenceIds.includes(e.submissionId)&&JSON.stringify([...e.evidenceIds].sort())===JSON.stringify(e.evidenceIds);
}
function receipt(v:unknown,r:WireRequest):NativeMixedPlayoffReceiptV1|Negative|null{
 if(!plain(v))return null;
 const negativeCodes={retry_exact:['source_busy'],blocked:['feature_unavailable','operation_history_unavailable'],rejected:['invalid_request','parent_or_context_unavailable','idempotency_conflict','source_changed','match_or_game_changed','history_changed','playoffs_complete','evidence_mismatch']};
 if(exact(v,['status','code'])&&typeof v.status==='string'&&Object.hasOwn(negativeCodes,v.status)&&negativeCodes[v.status as keyof typeof negativeCodes].includes(v.code as string))return structuredClone(v) as Negative;
 const keys=['status','contextId','slot','gameNumber','entryId','revision','historyDigest','sourceDigest','matchDigest','gameComplete','matchComplete','winnerId','simulationOnly','ordinaryQualificationRecorded','mrpAwarded','moneyMoved'];
 if(!object(v))return null;const historical=Object.hasOwn(v,'historicalReceipt')||Object.hasOwn(v,'currentSourceVerified');
 if(!exact(v,historical?[...keys,'historicalReceipt','currentSourceVerified']:keys)||v.status!=='simulated_playoff_evidence_recorded'||v.contextId!==r.data.contextId||v.slot!==r.data.slot||v.gameNumber!==r.data.gameNumber
  ||v.sourceDigest!==r.expectedSourceDigest||v.matchDigest!==r.data.expectedMatchDigest||!uuid(v.entryId)||v.revision!==r.data.expectedRevision+1||!hash(v.historyDigest)||typeof v.gameComplete!=='boolean'||typeof v.matchComplete!=='boolean'
  ||v.simulationOnly!==true||v.ordinaryQualificationRecorded!==false||v.mrpAwarded!==false||v.moneyMoved!==false
  ||historical&&(v.historicalReceipt!==true||v.currentSourceVerified!==false))return null;
 if(r.data.entry.type==='digital-submit'&&(v.gameComplete||v.matchComplete||v.winnerId!==null))return null;
 if(v.matchComplete?(!v.gameComplete||v.winnerId!==r.data.entry.winnerParticipantId):v.winnerId!==null)return null;
 if(r.data.entry.type==='digital-confirm'&&r.data.entry.evidenceIds.includes(v.entryId))return null;
 return structuredClone(v) as NativeMixedPlayoffReceiptV1;
}
/** Normal-auth only: no client creation, service key, actor RPC parameter,
 * operation generation, retry or storage. The host must construct the client
 * against the pinned project and derive ownScope from authenticated bindings.
 * A DTO echo is not proof of that host binding or of JWT signature verification.
 * Receipts do not echo actor/op/full entry; their association rests on the exact
 * authenticated RPC and server journal, not client cryptographic verification.
 * Accepted receipts never verify a game; only a separately refreshed own read
 * can display server state. retainedRaw is a local descriptor, not HTTP bytes.
 */
export function createNativeMixedPlayoffOwnTransportV1(o:{authenticated:NativeMixedOwnClientV1;projectUrl:string;projectRef:string;target:NativeMixedPlayoffOwnTargetV1;enabled?:()=>boolean;now?:()=>number}){
 const projectUrl=o.projectUrl,projectRef=o.projectRef;
 let t:NativeMixedPlayoffOwnTargetV1|null=null;try{if(target(o.target,projectUrl,projectRef))t=freeze(structuredClone(o.target));}catch{/* Fail closed without auth or RPC. */}
 const client=o.authenticated,enabled=o.enabled??(()=>false),now=o.now??Date.now,isEnabled=()=>{try{return enabled()===true;}catch{return false;}};
 async function identity(){if(!t)return false;try{const u=await client.auth.getUser(),c=await client.auth.getClaims(),v=c.data?.claims;return !u.error&&!c.error&&u.data.user?.id===t.actorId&&v?.sub===t.actorId&&v.session_id===t.sessionId&&typeof v.exp==='number'&&Number.isSafeInteger(v.exp)&&v.exp*1000>now();}catch{return false;}}
 function prepare(operationId:string,value:NativeMixedPlayoffOwnCommandV1):NativeMixedPlayoffPreparedV1|null{
  try{if(!isEnabled()||!t||!uuid(operationId)||!command(value,t))return null;
   const body={version:'native-mixed-playoff-prepared-v1' as const,target:structuredClone(t),operationId,request:{...structuredClone(value),reason}};
   return freeze({...body,retainedRaw:JSON.stringify(body)});
  }catch{return null;}
 }
 function prepared(v:unknown):NativeMixedPlayoffPreparedV1|null{
  try{if(!t||!plain(v)||!exact(v,['version','target','operationId','request','retainedRaw'])||v.version!=='native-mixed-playoff-prepared-v1'||!uuid(v.operationId)||!target(v.target,projectUrl,projectRef)||canonical(v.target)!==canonical(t)||typeof v.retainedRaw!=='string'||v.retainedRaw.length>20000||!exact(v.request,['version','action','expectedSourceDigest','data','reason'])||v.request.reason!==reason)return null;
   const c={...v.request};delete c.reason;if(!command(c,t))return null;
   const raw=JSON.parse(v.retainedRaw);if(!plain(raw)||!exact(raw,['version','target','operationId','request'])||canonical(raw)!==canonical({version:v.version,target:v.target,operationId:v.operationId,request:v.request}))return null;
   return freeze(structuredClone(v)) as NativeMixedPlayoffPreparedV1;
  }catch{return null;}
 }
 return{
  prepare,
  read:async():Promise<ReadResult>=>{
   if(!isEnabled())return{data:null,error:'disabled'};if(!t)return{data:null,error:'invalid_target'};
   if(!await identity())return{data:null,error:'identity_changed'};if(!isEnabled())return{data:null,error:'disabled'};
   let value:NativeMixedPlayoffOwnStateV1|null=null,failed=false;try{const r=await client.rpc('get_native_mixed_playoff_own_v1',{p_tournament_id:t.ownScope.tournamentId,p_event_id:t.ownScope.eventId});failed=r.error!=null;if(!failed)value=readNativeMixedPlayoffOwnV1(r.data,t.ownScope);}catch{failed=true;}
   if(!await identity())return{data:null,error:'identity_changed'};if(!isEnabled())return{data:null,error:'disabled'};
   if(failed)return{data:null,error:'provider_unavailable'};return value?{data:value,error:null}:{data:null,error:'invalid_response'};
  },
  write:async(input:NativeMixedPlayoffPreparedV1):Promise<WriteResult>=>{
   const fail=(error:ReadError|'invalid_request'|'operation_outcome_unknown',p:NativeMixedPlayoffPreparedV1|null,dispatched=false):WriteResult=>({data:null,error,prepared:p,dispatched,serverStateVerified:false});
   if(!isEnabled())return fail('disabled',null);if(!t)return fail('invalid_target',null);const p=prepared(input);if(!p)return fail('invalid_request',null);
   if(!await identity())return fail('identity_changed',p);if(!isEnabled())return fail('disabled',p);
   // From here every error is ambiguous, including changed session/gate, thrown
   // SDK errors, null/malformed data and receipt scope or revision mismatch.
   let v:NativeMixedPlayoffReceiptV1|Negative|null=null,failed=false;try{const r=await client.rpc('execute_native_mixed_playoff_v1',{p_tournament_id:t.ownScope.tournamentId,p_event_id:t.ownScope.eventId,p_operation_id:p.operationId,p_request:structuredClone(p.request)});failed=r.error!=null;if(!failed)v=receipt(r.data,p.request);}catch{failed=true;}
   if(!await identity()||!isEnabled()||failed)return fail('operation_outcome_unknown',p,true);
   return v?{data:v,error:null,dispatched:true,prepared:p,serverStateVerified:false}:fail('operation_outcome_unknown',p,true);
  },
 };
}
