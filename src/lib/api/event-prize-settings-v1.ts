import {isEventSettingsSetupV3,isEventSettingsDraftSavedV3,type EventSettingsSetupEnvelopeV3,type EventSettingsDraftSavedV3} from './event-settings-setup-v3.ts';
import {isEventSettingsCustomPoolDraftSavedV4,type EventSettingsCustomPoolDraftSavedV4} from './event-settings-custom-pool-v4.ts';
import type {SetupCustomPayoutsBaseV2} from './custom-payout-setup-v2.ts';
import {isPlayoffPrizePlanDraftV2,type PlayoffPrizePlanDraftV2} from '../playoffs/playoff-prize-plan-v2.ts';
export const eventPrizeSettingsSaveEnabledV1=()=>false;
export const eventPrizeSettingsMaximumBytesV1=1_000_000;
/** Complete receipts/journals repeat nested requests; outgoing limit is unchanged. */
export const eventPrizeSettingsResponseMaximumBytesV1=8_000_000;
export type EventPrizePlanChoiceV1={eventClientRowId:string;mode:'preserve_historical'}|{eventClientRowId:string;mode:'proposed_v2';draft:PlayoffPrizePlanDraftV2};
export type EventPrizeSettingsEnvelopeV1={kind:'event-prize-settings-setup-v1';operationId:string;setup:EventSettingsSetupEnvelopeV3;prizeBase:{settingsSnapshotId:string|null;settingsDigest:string|null;prizeSnapshotId:string|null;prizeDigest:string|null};prizePlans:EventPrizePlanChoiceV1[]};
export type EventPrizeSettingsSnapshotV1={kind:'event-prize-settings-snapshot-v1';tournamentId:string;setupRevisionId:string;setupVersion:number;settingsSnapshotId:string;settingsDigest:string;prizeSnapshotId:string;prizeDigest:string;plans:Array<(Exclude<EventPrizePlanChoiceV1,{mode:'preserve_historical'}>|{eventClientRowId:string;mode:'legacy_checks_required'})&{eventKind:'main'|'consolation'}>;activationAllowed:false;accountingAllowed:false;moneyMoved:false};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
/** Reject accessors/cycles/non-JSON values before validators read properties.
 * Bounds are technical serialization limits; no input is truncated. */
function safe(v:unknown,ancestors=new Set<object>(),depth=0,budget={nodes:0,units:0,limit:eventPrizeSettingsMaximumBytesV1}):boolean{
 if(depth>32||++budget.nodes>Math.max(100000,Math.floor(budget.limit/10)))return false;
 if(v===null||typeof v==='boolean'){budget.units+=5;return budget.units<=budget.limit;}
 if(typeof v==='string'){budget.units+=v.length+2;return budget.units<=budget.limit;}
 if(typeof v==='number'){budget.units+=24;return budget.units<=budget.limit&&Number.isSafeInteger(v)&&!Object.is(v,-0);}
 if((!Array.isArray(v)&&!object(v))||ancestors.has(v))return false;
 if(Array.isArray(v)&&(!Number.isSafeInteger(v.length)||v.length>10000))return false;
 const keys=Reflect.ownKeys(v);if(keys.length>(Array.isArray(v)?10001:10000))return false;
 if(Array.isArray(v)&&(keys.length!==v.length+1||!Array.from({length:v.length},(_,i)=>Object.hasOwn(v,i)).every(Boolean)))return false;
 budget.units+=keys.length+2;if(budget.units>budget.limit)return false;
 ancestors.add(v);for(const k of keys){if(Array.isArray(v)&&k==='length')continue;const d=Object.getOwnPropertyDescriptor(v,k);if(typeof k!=='string'||!d||!('value'in d)||!d.enumerable)return false;budget.units+=k.length+3;if(budget.units>budget.limit||!safe(d.value,ancestors,depth+1,budget))return false;}ancestors.delete(v);return true;
}
const canonical=(v:unknown)=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const within=(raw:string,limit=eventPrizeSettingsMaximumBytesV1)=>new TextEncoder().encode(raw).byteLength<=limit;
export function isEventPrizeWireValueV1(value:unknown):boolean{try{return safe(value)&&within(canonical(value));}catch{return false;}}
export function isEventPrizeResponseValueV1(value:unknown):boolean{try{return safe(value,new Set<object>(),0,{nodes:0,units:0,limit:eventPrizeSettingsResponseMaximumBytesV1})&&within(canonical(value),eventPrizeSettingsResponseMaximumBytesV1);}catch{return false;}}
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
export function isEventPrizeSettingsEnvelopeV1(v:unknown,base:unknown):v is EventPrizeSettingsEnvelopeV1{
 try{
  if(!safe(base)||!safe(v)||!exact(v,['kind','operationId','setup','prizeBase','prizePlans'])||v.kind!=='event-prize-settings-setup-v1'||!uuid(v.operationId)||!isEventSettingsSetupV3(v.setup,base)||v.operationId===v.setup.setup.request.idempotencyKey||!exact(v.prizeBase,['settingsSnapshotId','settingsDigest','prizeSnapshotId','prizeDigest'])||![v.prizeBase.settingsSnapshotId,v.prizeBase.prizeSnapshotId].every(x=>x===null||uuid(x))||![v.prizeBase.settingsDigest,v.prizeBase.prizeDigest].every(x=>x===null||hash(x))||(v.prizeBase.settingsSnapshotId===null)!==(v.prizeBase.settingsDigest===null)||(v.prizeBase.prizeSnapshotId===null)!==(v.prizeBase.prizeDigest===null)||!Array.isArray(v.prizePlans))return false;
  const events=v.setup.setup.request.payload.events.filter(e=>e.eventKind==='main'||e.eventKind==='consolation');if(v.prizePlans.length!==events.length)return false;
  const seen=new Set<string>();for(const p of v.prizePlans){if(!object(p)||!uuid(p.eventClientRowId)||seen.has(p.eventClientRowId)||!events.some(e=>e.clientRowId===p.eventClientRowId))return false;seen.add(p.eventClientRowId);if(p.mode==='preserve_historical'){if(!exact(p,['eventClientRowId','mode']))return false;}else if(p.mode!=='proposed_v2'||!exact(p,['eventClientRowId','mode','draft'])||!isPlayoffPrizePlanDraftV2(p.draft))return false;}
  return within(canonical(v));
 }catch{return false;}
}
export function serializeEventPrizeSettingsV1(v:unknown,base:unknown):string|null{return isEventPrizeSettingsEnvelopeV1(v,base)?canonical(v):null;}
export function parseEventPrizeSettingsV1(raw:unknown,base:unknown):EventPrizeSettingsEnvelopeV1|null{if(typeof raw!=='string'||!within(raw))return null;try{const v:unknown=JSON.parse(raw);return serializeEventPrizeSettingsV1(v,base)===raw?freeze(v as EventPrizeSettingsEnvelopeV1):null;}catch{return null;}}
export type EventPrizeSettingsRecoveryV1={kind:'event-prize-settings-recovery-v1';actorId:string;operationId:string;envelope:EventPrizeSettingsEnvelopeV1};
export function serializeEventPrizeRecoveryV1(v:unknown,base:unknown):string|null{try{return safe(v)&&exact(v,['kind','actorId','operationId','envelope'])&&v.kind==='event-prize-settings-recovery-v1'&&uuid(v.actorId)&&uuid(v.operationId)&&isEventPrizeSettingsEnvelopeV1(v.envelope,base)&&v.operationId===v.envelope.operationId&&within(canonical(v))?canonical(v):null;}catch{return null;}}
export function parseEventPrizeRecoveryV1(raw:unknown,actorId:unknown,operationId:unknown,base:unknown):EventPrizeSettingsRecoveryV1|null{if(typeof raw!=='string'||!within(raw)||!uuid(actorId)||!uuid(operationId))return null;try{const v:unknown=JSON.parse(raw);return serializeEventPrizeRecoveryV1(v,base)===raw&&object(v)&&v.actorId===actorId&&v.operationId===operationId?freeze(v as EventPrizeSettingsRecoveryV1):null;}catch{return null;}}
export function isEventPrizeSettingsSnapshotV1(v:unknown):v is EventPrizeSettingsSnapshotV1{
 try{if(!safe(v)||!exact(v,['kind','tournamentId','setupRevisionId','setupVersion','settingsSnapshotId','settingsDigest','prizeSnapshotId','prizeDigest','plans','activationAllowed','accountingAllowed','moneyMoved'])||v.kind!=='event-prize-settings-snapshot-v1'||![v.tournamentId,v.setupRevisionId,v.settingsSnapshotId,v.prizeSnapshotId].every(uuid)||![v.settingsDigest,v.prizeDigest].every(hash)||!Number.isSafeInteger(v.setupVersion)||Number(v.setupVersion)<1||Number(v.setupVersion)>2147483647||v.activationAllowed!==false||v.accountingAllowed!==false||v.moneyMoved!==false||!Array.isArray(v.plans)||v.plans.length>32)return false;
 const seen=new Set<string>();for(const p of v.plans){if(!object(p)||!uuid(p.eventClientRowId)||!['main','consolation'].includes(p.eventKind as string)||seen.has(p.eventClientRowId))return false;seen.add(p.eventClientRowId);if(p.mode==='legacy_checks_required'){if(!exact(p,['eventClientRowId','eventKind','mode']))return false;}else if(p.mode!=='proposed_v2'||!exact(p,['eventClientRowId','eventKind','mode','draft'])||!isPlayoffPrizePlanDraftV2(p.draft))return false;}return within(canonical(v));}catch{return false;}
}
/** Pure plan only. prior must be read with setup/settings under one DB lock;
 * caller-supplied absence must never erase a stored snapshot. No IO occurs. */
export function planEventPrizeSnapshotV1(envelope:unknown,base:SetupCustomPayoutsBaseV2,prior:unknown){
 if(!isEventPrizeSettingsEnvelopeV1(envelope,base))return{status:'blocked' as const,code:'invalid_envelope'};
 if(prior!==null&&(!isEventPrizeSettingsSnapshotV1(prior)||prior.tournamentId!==base.tournamentId||prior.setupRevisionId!==base.setupRevisionId||prior.setupVersion!==base.setupVersion||prior.settingsSnapshotId!==envelope.prizeBase.settingsSnapshotId||prior.prizeSnapshotId!==envelope.prizeBase.prizeSnapshotId||prior.settingsDigest!==envelope.prizeBase.settingsDigest||prior.prizeDigest!==envelope.prizeBase.prizeDigest))return{status:'blocked' as const,code:'prize_snapshot_source_changed'};
 if(prior===null&&envelope.prizeBase.prizeSnapshotId!==null)return{status:'blocked' as const,code:'prize_snapshot_required'};
 const previous=prior as EventPrizeSettingsSnapshotV1|null;
 const events=envelope.setup.setup.request.payload.events;
 if(envelope.prizePlans.some(p=>p.mode==='preserve_historical'&&previous?.plans.some(old=>old.eventClientRowId===p.eventClientRowId&&old.eventKind!==events.find(e=>e.clientRowId===p.eventClientRowId)!.eventKind)))return{status:'blocked' as const,code:'event_kind_changed_requires_review'};
 const plans=envelope.prizePlans.map(p=>{const eventKind=events.find(e=>e.clientRowId===p.eventClientRowId)!.eventKind as 'main'|'consolation';return p.mode==='proposed_v2'?{...structuredClone(p),eventKind}:structuredClone(previous?.plans.find(old=>old.eventClientRowId===p.eventClientRowId)??{eventClientRowId:p.eventClientRowId,eventKind,mode:'legacy_checks_required' as const});});
 return{status:'planned' as const,plans,expectedVersion:base.setupVersion,databaseReadRequired:true as const,atomicNestedSetupRequired:true as const,persisted:false as const,activationAllowed:false as const,accountingAllowed:false as const,moneyMoved:false as const};
}
export type EventPrizeNestedSavedV1=EventSettingsDraftSavedV3|EventSettingsCustomPoolDraftSavedV4;
/** Explicit protocol union. Never relabel a V4 receipt as V3. */
export function isEventPrizeNestedSavedV1(v:unknown,envelope:unknown,base:unknown):v is EventPrizeNestedSavedV1{return isEventSettingsDraftSavedV3(v,envelope,base)||isEventSettingsCustomPoolDraftSavedV4(v,envelope,base);}
export type EventPrizeSettingsSavedV1={status:'event_prize_settings_draft_saved_v1';fullRequestHash:string;envelope:EventPrizeSettingsEnvelopeV1;nested:EventPrizeNestedSavedV1;snapshot:EventPrizeSettingsSnapshotV1;activationAllowed:false;accountingAllowed:false;moneyMoved:false};
/** Expected full hash must be computed from the full canonical new envelope by
 * the fixed-scope transport/server, never borrowed from a nested V3 result. */
export function isEventPrizeSettingsSavedV1(v:unknown,envelope:unknown,base:SetupCustomPayoutsBaseV2,prior:unknown,expectedFullHash:unknown):v is EventPrizeSettingsSavedV1{
 try{if(!isEventPrizeResponseValueV1(v)||!hash(expectedFullHash)||!isEventPrizeSettingsEnvelopeV1(envelope,base)||!exact(v,['status','fullRequestHash','envelope','nested','snapshot','activationAllowed','accountingAllowed','moneyMoved'])||v.status!=='event_prize_settings_draft_saved_v1'||v.fullRequestHash!==expectedFullHash||v.activationAllowed!==false||v.accountingAllowed!==false||v.moneyMoved!==false||serializeEventPrizeSettingsV1(v.envelope,base)!==serializeEventPrizeSettingsV1(envelope,base)||!isEventPrizeNestedSavedV1(v.nested,envelope.setup,base)||!isEventPrizeSettingsSnapshotV1(v.snapshot))return false;
 const plan=planEventPrizeSnapshotV1(envelope,base,prior);return plan.status==='planned'&&v.snapshot.tournamentId===base.tournamentId&&v.snapshot.setupRevisionId===v.nested.linked.result.revisionId&&v.snapshot.setupVersion===v.nested.linked.result.version&&v.snapshot.settingsSnapshotId===v.nested.settingsSnapshotId&&v.snapshot.settingsDigest===v.nested.fullRequestHash&&v.snapshot.prizeDigest===expectedFullHash&&v.snapshot.prizeSnapshotId!==envelope.prizeBase.prizeSnapshotId&&v.snapshot.settingsSnapshotId!==envelope.prizeBase.settingsSnapshotId&&v.snapshot.setupRevisionId!==base.setupRevisionId&&canonical(v.snapshot.plans)===canonical(plan.plans);
 }catch{return false;}
}
/** The provider has already bound the immutable operation to the signed-in
 * actor. Include its exact prior snapshot so a reloaded browser can validate a
 * historical-preservation acknowledgement without inventing previous state. */
export function eventPrizeReplyBindingMatchesV1(value:unknown,envelope:EventPrizeSettingsEnvelopeV1,expectedFullHash:string,actorId:string):boolean{
 return isEventPrizeResponseValueV1(value)&&uuid(actorId)&&hash(expectedFullHash)&&exact(value,['actorId','tournamentId','operationId','requestHash'])&&value.actorId===actorId&&value.tournamentId===envelope.setup.setup.base.tournamentId&&value.operationId===envelope.operationId&&value.requestHash===expectedFullHash;
}
export function readEventPrizeAcceptedReplyV1(value:unknown,envelope:EventPrizeSettingsEnvelopeV1,expectedFullHash:string,actorId:string):{ack:EventPrizeSettingsSavedV1;priorSnapshot:EventPrizeSettingsSnapshotV1|null}|null{
 try{if(!isEventPrizeResponseValueV1(value)||!exact(value,['status','binding','ack','priorSnapshot','pendingCleared'])||value.status!=='accepted'||value.pendingCleared!==false||!eventPrizeReplyBindingMatchesV1(value.binding,envelope,expectedFullHash,actorId)||!isEventPrizeSettingsSavedV1(value.ack,envelope,envelope.setup.setup.base,value.priorSnapshot,expectedFullHash))return null;return freeze(structuredClone({ack:value.ack,priorSnapshot:value.priorSnapshot as EventPrizeSettingsSnapshotV1|null}));}catch{return null;}
}
export const eventPrizeRecordedRejectionCodesV1=['feature_disabled','nested_write_rejected','invalid_snapshot','head_conflict','write_failed'] as const;
export type EventPrizeRecordedRejectionV1={kind:'event-prize-recorded-rejection-v1';status:'rejected';code:typeof eventPrizeRecordedRejectionCodesV1[number];binding:{actorId:string;tournamentId:string;operationId:string;requestHash:string};requestText:string;envelope:EventPrizeSettingsEnvelopeV1;priorSnapshot:EventPrizeSettingsSnapshotV1|null;pendingCleared:false;writeAuthorized:false};
/** Only a complete immutable journal record can produce this shape. Attempt
 * errors and transport failures are never evidence that a save was rolled back. */
export function readEventPrizeRecordedRejectionV1(value:unknown,envelope:EventPrizeSettingsEnvelopeV1,expectedFullHash:string,actorId:string):EventPrizeRecordedRejectionV1|null{
 try{
  if(!isEventPrizeResponseValueV1(value)||!isEventPrizeSettingsEnvelopeV1(envelope,envelope.setup.setup.base)||!exact(value,['kind','status','code','binding','requestText','envelope','priorSnapshot','pendingCleared','writeAuthorized'])||value.kind!=='event-prize-recorded-rejection-v1'||value.status!=='rejected'||!eventPrizeRecordedRejectionCodesV1.includes(value.code as EventPrizeRecordedRejectionV1['code'])||value.pendingCleared!==false||value.writeAuthorized!==false||!eventPrizeReplyBindingMatchesV1(value.binding,envelope,expectedFullHash,actorId))return null;
  const raw=serializeEventPrizeSettingsV1(envelope,envelope.setup.setup.base);
  if(value.requestText!==raw||serializeEventPrizeSettingsV1(value.envelope,envelope.setup.setup.base)!==raw||planEventPrizeSnapshotV1(envelope,envelope.setup.setup.base,value.priorSnapshot).status!=='planned')return null;
  return freeze(structuredClone(value) as EventPrizeRecordedRejectionV1);
 }catch{return null;}
}

/** Fingerprint includes the complete nested request, all plans and both old
 * snapshot pins. It is content binding, not authentication or a save receipt. */
export async function eventPrizeSettingsRequestHashV1(envelope:unknown,base:unknown):Promise<string|null>{const raw=serializeEventPrizeSettingsV1(envelope,base);if(raw===null)return null;try{const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}catch{return null;}}
export function readEventPrizeProviderWriteV1(value:unknown,expected:{actorId:string;tournamentId:string;envelope:EventPrizeSettingsEnvelopeV1;base:SetupCustomPayoutsBaseV2;prior:unknown;fullRequestHash:string}){
 try{if(!isEventPrizeResponseValueV1(value)||!uuid(expected.actorId)||expected.tournamentId!==expected.base.tournamentId||!exact(value,['actorId','tid','operationId','envelope','outcome'])||value.actorId!==expected.actorId||value.tid!==expected.tournamentId||value.operationId!==expected.envelope.operationId||serializeEventPrizeSettingsV1(value.envelope,expected.base)!==serializeEventPrizeSettingsV1(expected.envelope,expected.base)||!isEventPrizeSettingsSavedV1(value.outcome,expected.envelope,expected.base,expected.prior,expected.fullRequestHash))return null;return freeze(structuredClone(value));}catch{return null;}
}
