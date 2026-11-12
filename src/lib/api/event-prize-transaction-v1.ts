import 'server-only';
import {type EventSettingsSetupEnvelopeV3} from './event-settings-setup-v3.ts';
import {isEventPrizeNestedSavedV1,type EventPrizeNestedSavedV1,isEventPrizeWireValueV1,isEventPrizeResponseValueV1,isEventPrizeSettingsSnapshotV1,isEventPrizeSettingsSavedV1,serializeEventPrizeSettingsV1,parseEventPrizeSettingsV1,eventPrizeSettingsRequestHashV1,planEventPrizeSnapshotV1,type EventPrizeSettingsEnvelopeV1,type EventPrizeSettingsSnapshotV1,type EventPrizeSettingsSavedV1} from './event-prize-settings-v1.ts';
import type {SetupCustomPayoutsBaseV2} from './custom-payout-setup-v2.ts';
type Scope={actorId:string;tournamentId:string};
type Result={status:'accepted';ack:EventPrizeSettingsSavedV1}|{status:'rejected';code:string};
type RecordV1={kind:'event-prize-operation-record-v1';scope:Scope;operationId:string;requestText:string;requestHash:string;priorSnapshot:EventPrizeSettingsSnapshotV1|null;result:Result};
export type EventPrizeTransactionPortV1={
 lockAndRead:(scope:Scope)=>Promise<unknown>;
 lockRecoveryAccess?:(scope:Scope)=>Promise<unknown>;
 operation:(operationId:string)=>Promise<unknown>;
 reserve:(value:{scope:Scope;operationId:string;nestedOperationId:string;requestText:string;requestHash:string})=>Promise<boolean>;
 savepoint:<T>(work:()=>Promise<T>)=>Promise<{status:'released';value:T}|{status:'rolled_back';code:string}>;
 stageNested:(envelope:EventSettingsSetupEnvelopeV3)=>Promise<unknown>;
 stageSnapshot:(value:{envelope:EventPrizeSettingsEnvelopeV1;nested:EventPrizeNestedSavedV1;plans:EventPrizeSettingsSnapshotV1['plans'];requestHash:string})=>Promise<unknown>;
 compareAndSwapHead:(value:{scope:Scope;expectedBase:SetupCustomPayoutsBaseV2;expectedPrizeId:string|null;snapshot:EventPrizeSettingsSnapshotV1})=>Promise<boolean>;
 complete:(record:RecordV1)=>Promise<boolean>;
};
export type EventPrizeAtomicPortV1={
 access:(tournamentId:string)=>Promise<unknown>;
 atomic:<T>(work:(tx:EventPrizeTransactionPortV1)=>Promise<T>)=>Promise<{status:'committed';value:T}|{status:'rolled_back'}|{status:'unknown'}>;
 enabled?:()=>boolean;recoveryEnabled?:()=>boolean;
};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
function immutable<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(immutable);Object.freeze(value);}return value;}
const permitted=(v:unknown,scope:Scope)=>isEventPrizeWireValueV1(v)&&exact(v,['actorId','tournamentId','roles'])&&v.actorId===scope.actorId&&v.tournamentId===scope.tournamentId&&Array.isArray(v.roles)&&v.roles.every(r=>typeof r==='string')&&v.roles.some(r=>r==='director'||r==='co_director');
const stageCodes=new Set(['feature_disabled','nested_write_rejected','invalid_snapshot','head_conflict','write_failed']);
const stageFail=(code:string):never=>{throw Error('event_prize_stage:'+code);};
const unknownOutcome=()=>({status:'outcome_unknown' as const,code:'operation_outcome_unknown'});
async function prepareRequest(scope:Scope,input:unknown){
 if(!isEventPrizeWireValueV1(scope)||!exact(scope,['actorId','tournamentId'])||!Object.values(scope).every(uuid)||!isEventPrizeWireValueV1(input)||!object(input)||!object(input.setup)||!object(input.setup.setup))return{status:'invalid' as const,error:'invalid_request' as const};
 const postedBase=input.setup.setup.base,raw=serializeEventPrizeSettingsV1(input,postedBase);if(raw===null)return{status:'invalid' as const,error:'invalid_request' as const};
 const envelope=parseEventPrizeSettingsV1(raw,postedBase)!;const base=envelope.setup.setup.base;if(base.tournamentId!==scope.tournamentId)return{status:'invalid' as const,error:'invalid_request' as const};const fixed=Object.freeze({...scope}),fullHash=await eventPrizeSettingsRequestHashV1(envelope,base);return fullHash?{status:'ready' as const,envelope,base,fixed,raw,fullHash}:{status:'invalid' as const,error:'hash_unavailable' as const};
}
function lockedFor(value:unknown,scope:Scope):value is Record<string,unknown>{return isEventPrizeWireValueV1(value)&&exact(value,['kind','scope','roles','canEdit','base','settingsPin','prizePresence'])&&value.kind==='event-prize-locked-source-v1'&&same(value.scope,scope)&&permitted({...scope,roles:value.roles},scope)&&typeof value.canEdit==='boolean';}
function recoveryLockedFor(value:unknown,scope:Scope){return isEventPrizeWireValueV1(value)&&exact(value,['kind','scope','roles'])&&value.kind==='event-prize-recovery-access-v1'&&same(value.scope,scope)&&permitted({...scope,roles:value.roles},scope);}
function replayRecord(previous:unknown,p:{fixed:Scope;envelope:EventPrizeSettingsEnvelopeV1;base:SetupCustomPayoutsBaseV2;raw:string;fullHash:string}){
 const{fixed,envelope,base,raw,fullHash}=p;
 if(!isEventPrizeResponseValueV1(previous)||!exact(previous,['kind','scope','operationId','requestText','requestHash','priorSnapshot','result'])||previous.kind!=='event-prize-operation-record-v1'||!same(previous.scope,fixed)||previous.operationId!==envelope.operationId)return unknownOutcome();
 if(previous.requestText!==raw||previous.requestHash!==fullHash)return{status:'rejected' as const,code:'idempotency_conflict'};
 const plan=planEventPrizeSnapshotV1(envelope,base,previous.priorSnapshot);if(plan.status!=='planned'||!object(previous.result))return unknownOutcome();
 if(exact(previous.result,['status','ack'])&&previous.result.status==='accepted'&&isEventPrizeSettingsSavedV1(previous.result.ack,envelope,base,previous.priorSnapshot,fullHash))return{status:'accepted' as const,ack:structuredClone(previous.result.ack),replayed:true as const};
 if(exact(previous.result,['status','code'])&&previous.result.status==='rejected'&&typeof previous.result.code==='string'&&stageCodes.has(previous.result.code))return{status:'rejected' as const,code:previous.result.code,replayed:true as const};
 return unknownOutcome();
}
/** Executable coordinator contract only. No concrete adapter, route, DB object,
 * grant or capability is created. atomic/savepoint MUST map to one real database
 * transaction; JS/mocked rollback is not evidence of database atomicity.
 * Adapters must lock role/source/history, reject cross-protocol nested key reuse,
 * and return committed only AFTER commit. All defaults are disabled. */
export function createEventPrizeTransactionV1(port:EventPrizeAtomicPortV1){
 const enabled=()=>{try{return port.enabled?.()===true;}catch{return false;}};
 const recoveryEnabled=()=>{try{return port.recoveryEnabled?.()===true;}catch{return false;}};
 const rejected=(code:string)=>({status:'rejected' as const,code});
 const unknown=unknownOutcome;
 return{async save(scope:Scope,input:unknown){
  if(!enabled())return rejected('feature_unavailable');
  const prepared=await prepareRequest(scope,input);if(prepared.status!=='ready')return rejected(prepared.error);const{envelope,base,fixed,raw,fullHash}=prepared;
  try{
   if(!permitted(await port.access(fixed.tournamentId),fixed))return rejected('not_director');
   let produced:unknown;let invocations=0;
   const work=async(tx:EventPrizeTransactionPortV1)=>{
    const lockedValue=await tx.lockAndRead(fixed);
    if(!lockedFor(lockedValue,fixed))return rejected('locked_source_unavailable');const locked=immutable(structuredClone(lockedValue));
    const previous=await tx.operation(envelope.operationId);
    if(previous!==null)return replayRecord(previous,prepared);
    if(!locked.canEdit)return rejected('setup_lifecycle_closed');
    if(serializeEventPrizeSettingsV1(envelope,locked.base)===null)return rejected('source_changed');
    if(!exact(locked.settingsPin,['snapshotId','digest'])||!((locked.settingsPin.snapshotId===null&&locked.settingsPin.digest===null)||(uuid(locked.settingsPin.snapshotId)&&hash(locked.settingsPin.digest)))||locked.settingsPin.snapshotId!==envelope.prizeBase.settingsSnapshotId||locked.settingsPin.digest!==envelope.prizeBase.settingsDigest)return rejected('settings_source_changed');
    const presence=locked.prizePresence;if(!exact(presence,['state','historyExists','snapshot']))return rejected('prize_source_unavailable');
    if(!((presence.state==='absent'&&presence.historyExists===false&&presence.snapshot===null)||(presence.state==='present'&&presence.historyExists===true&&isEventPrizeSettingsSnapshotV1(presence.snapshot))))return rejected('prize_source_unavailable');
    const prior=presence.snapshot as EventPrizeSettingsSnapshotV1|null,plan=planEventPrizeSnapshotV1(envelope,base,prior);if(plan.status!=='planned')return rejected(plan.code);
    if(!enabled())return rejected('feature_disabled');
    if(!await tx.reserve({scope:fixed,operationId:envelope.operationId,nestedOperationId:envelope.setup.setup.request.idempotencyKey,requestText:raw,requestHash:fullHash}))return rejected('operation_busy');
    const staged=await tx.savepoint(async()=>{
     if(!enabled())stageFail('feature_disabled');const nested=await tx.stageNested(envelope.setup);
     if(!isEventPrizeNestedSavedV1(nested,envelope.setup,base)||nested.status!=='event_settings_custom_pool_draft_saved_v4')stageFail('nested_write_rejected');
     if(!enabled())stageFail('feature_disabled');const snapshot=await tx.stageSnapshot({envelope,nested:nested as EventPrizeNestedSavedV1,plans:plan.plans,requestHash:fullHash});
     const ack={status:'event_prize_settings_draft_saved_v1' as const,fullRequestHash:fullHash,envelope,nested,snapshot,activationAllowed:false as const,accountingAllowed:false as const,moneyMoved:false as const};
     if(!isEventPrizeSettingsSavedV1(ack,envelope,base,prior,fullHash))stageFail('invalid_snapshot');
     if(!enabled())stageFail('feature_disabled');if(!await tx.compareAndSwapHead({scope:fixed,expectedBase:base,expectedPrizeId:envelope.prizeBase.prizeSnapshotId,snapshot:snapshot as EventPrizeSettingsSnapshotV1}))stageFail('head_conflict');
     return ack as EventPrizeSettingsSavedV1;
    });
    const outcome:Result=staged.status==='released'&&isEventPrizeSettingsSavedV1(staged.value,envelope,base,prior,fullHash)?{status:'accepted',ack:staged.value}:staged.status==='rolled_back'?{status:'rejected',code:stageCodes.has(staged.code)?staged.code:'write_failed'}:stageFail('write_failed');
    if(!enabled())stageFail('feature_disabled');
    if(!await tx.complete({kind:'event-prize-operation-record-v1',scope:fixed,operationId:envelope.operationId,requestText:raw,requestHash:fullHash,priorSnapshot:prior,result:outcome}))stageFail('write_failed');
    if(outcome.status==='accepted'&&!isEventPrizeSettingsSavedV1(outcome.ack,envelope,base,prior,fullHash))stageFail('write_failed');
    return{...outcome,replayed:false};
   };
   const result=await port.atomic(async tx=>{if(++invocations!==1)stageFail('write_failed');const value=await work(tx);produced=structuredClone(value);return value;});
   if(result.status==='rolled_back')return rejected('atomic_write_rolled_back');
   if(result.status!=='committed'||produced===undefined||!isEventPrizeResponseValueV1(result.value)||!same(result.value,produced))return unknown();
   const committed=immutable(structuredClone(result.value));
   if(!enabled()||!permitted(await port.access(fixed.tournamentId),fixed))return unknown();
   return committed;
  }catch{return unknown();}
 },async reconcile(scope:Scope,input:unknown){
  // Read capability is independent of the write flag. This path calls no stage,
  // reserve, savepoint, head-CAS or completion method and clears no pending work.
  if(!recoveryEnabled())return rejected('recovery_unavailable');
  const prepared=await prepareRequest(scope,input);if(prepared.status!=='ready')return rejected(prepared.error);const{fixed,envelope}=prepared;
  try{
   if(!permitted(await port.access(fixed.tournamentId),fixed))return rejected('not_director');
   let produced:unknown;let invocations=0;
   const result=await port.atomic(async tx=>{if(++invocations!==1)stageFail('write_failed');if(!tx.lockRecoveryAccess){const unavailable=unknown();produced=unavailable;return unavailable;}const locked=await tx.lockRecoveryAccess(fixed);let value;
    if(!recoveryLockedFor(locked,fixed))value=rejected('locked_source_unavailable');
    else{const record=await tx.operation(envelope.operationId);value=record===null?{status:'not_found' as const,pendingCleared:false as const,writeAuthorized:false as const}:replayRecord(record,prepared);}
    produced=structuredClone(value);return value;
   });
   if(result.status!=='committed'||produced===undefined||!isEventPrizeResponseValueV1(result.value)||!same(result.value,produced))return unknown();const committed=immutable(structuredClone(result.value));
   if(!recoveryEnabled()||!permitted(await port.access(fixed.tournamentId),fixed))return unknown();
   return committed;
  }catch{return unknown();}
 }};
}
