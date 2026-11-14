import { isRetainedSetupSaveRequest, type SetupSaveRequest } from './setup.ts';
import { validateSetupEventLinks, type SetupEventLinkChoice } from './setup-event-links.ts';
import { isUuid } from './validation.ts';
import { isCustomPayoutIntentV1, legacyPayoutPresetForIntentV1, type CustomPayoutIntentV1 } from './custom-payout-intent-v1.ts';
import { isGraduatedSidePoolSetupType } from './side-pool-setup-selection.ts';

/** Unconnected candidate transport, never an acknowledgement or database authority. */
export type SetupCustomPayoutsEnvelopeV2 = { kind:'setup-custom-payouts-v2'; base:SetupCustomPayoutsBaseV2; request:SetupSaveRequest; choices:SetupEventLinkChoice[]; customPayouts:CustomPayoutIntentV1[] };
export type SetupCustomPayoutsBaseV2 = { tournamentId:string; setupRevisionId:string|null; setupVersion:number; sourceDigest:string };
export type SetupCustomPayoutsRecoveryV2 = { kind:'setup-custom-payouts-recovery-v2'; actorId:string; operationId:string; envelope:SetupCustomPayoutsEnvelopeV2 };
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>isUuid(v)&&v===v.toLowerCase();
function safe(v:unknown,depth=0):boolean {
 if(depth>12)return false;
 if(v===null||typeof v==='string'||typeof v==='boolean')return true;
 if(typeof v==='number')return Number.isSafeInteger(v)&&!Object.is(v,-0);
 if(Array.isArray(v))return Reflect.ownKeys(v).length===v.length+1&&v.every(x=>safe(x,depth+1));
 return object(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&safe(v[k],depth+1));
}
function canonical(v:unknown):string { return JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x); }
function freeze<T>(v:T):T {if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const clone=<T>(v:T):T=>freeze(JSON.parse(canonical(v)) as T);
function baseValid(v:unknown):v is SetupCustomPayoutsBaseV2 {
 return exact(v,['tournamentId','setupRevisionId','setupVersion','sourceDigest'])&&uuid(v.tournamentId)&&Number.isSafeInteger(v.setupVersion)&&(v.setupVersion as number)>=0&&(v.setupVersion as number)<=2147483647
 &&(v.setupVersion===0?v.setupRevisionId===null:uuid(v.setupRevisionId))&&typeof v.sourceDigest==='string'&&/^[a-f0-9]{64}$/.test(v.sourceDigest);
}
export function isSetupCustomPayoutsV2(value:unknown,base:unknown):value is SetupCustomPayoutsEnvelopeV2 {
 if(!baseValid(base)||!safe(value)||!exact(value,['kind','base','request','choices','customPayouts'])||value.kind!=='setup-custom-payouts-v2'||!baseValid(value.base)||canonical(value.base)!==canonical(base)||!isRetainedSetupSaveRequest(value.request)
 ||value.request.expectedVersion!==base.setupVersion||!uuid(value.request.idempotencyKey)||!validateSetupEventLinks(value.request.payload.events,value.choices).valid
 ||!Array.isArray(value.customPayouts)||value.customPayouts.length>288)return false;
 const events=value.request.payload.events;
 if(events.some(e=>!uuid(e.clientRowId))||new Set(events.map(e=>e.clientRowId)).size!==events.length||value.request.payload.officials.some(o=>!uuid(o.profileId)))return false;
 const choices=value.choices as SetupEventLinkChoice[];
 if(choices.some(c=>!uuid(c.mainClientRowId)||c.consolationClientRowIds.some(id=>!uuid(id))))return false;
 const seen=new Set<string>();
 for(const intent of value.customPayouts){
  if(!isCustomPayoutIntentV1(intent))return false;
  const s=intent.source;
  if(s.tournamentId!==base.tournamentId||s.setupVersion!==base.setupVersion||s.setupRevisionId!==base.setupRevisionId||s.sourceDigest!==base.sourceDigest)return false;
  const event=events.find(e=>e.clientRowId===s.eventClientRowId),key=`${s.eventClientRowId}:${intent.scope}:${s.poolSlot}`;
  if(!event||seen.has(key))return false;seen.add(key);
  if(intent.scope==='q'){
   const pool=event.qPools[(s.poolSlot as number)-1];
   if(!['main','consolation'].includes(event.eventKind)||!pool||pool.poolTypeCode!==`Graduated (1-in-${intent.ratioDenominator})`)return false;
  }else if(intent.scope==='satellite'){
   if(event.eventKind!=='satellite'||event.payoutNote!==`1 in ${intent.ratioDenominator}`)return false;
  }else{
   const pool=event.sidePools[(s.poolSlot as number)-1];
   if(!pool||!['main','consolation','satellite'].includes(event.eventKind))return false;
   // An old advertised preset cannot serve as a surrogate for a different N.
   if(pool.payoutType!==undefined&&pool.payoutType!==legacyPayoutPresetForIntentV1(intent))return false;
  }
 }
 // Coverage is bidirectional: a new custom-looking advertised term cannot be
 // silently retained after its explicit intent has been removed. Historical
 // unrelated free text remains text, never inferred into a numeric policy.
 for(const event of events){
  for(const [index,pool] of event.qPools.entries()){
   if(/^Graduated\s*\(1-in-/i.test(pool.poolTypeCode.trim())&&!['Graduated (1-in-4)','Graduated (1-in-6)','Graduated (1-in-8)','Graduated (1-in-10)'].includes(pool.poolTypeCode.trim())
    &&!seen.has(`${event.clientRowId}:q:${index+1}`))return false;
  }
  for(const [index,pool] of event.sidePools.entries()){
   if(!isGraduatedSidePoolSetupType(pool.payoutType)&&!seen.has(`${event.clientRowId}:side:${index+1}`))return false;
  }
  if(event.eventKind==='satellite'&&/^1\s+in\s/i.test(event.payoutNote.trim())&&!['1 in 4','1 in 5','1 in 6'].includes(event.payoutNote.trim())
   &&!seen.has(`${event.clientRowId}:satellite:null`))return false;
 }
 return true;
}
export function readSetupCustomPayoutsV2(value:unknown,base:unknown):SetupCustomPayoutsEnvelopeV2|null{return isSetupCustomPayoutsV2(value,base)?clone(value):null;}
export function serializeSetupCustomPayoutsV2(value:unknown,base:unknown):string|null{return isSetupCustomPayoutsV2(value,base)?canonical(value):null;}
export function parseSetupCustomPayoutsV2(raw:unknown,base:unknown):SetupCustomPayoutsEnvelopeV2|null{
 if(typeof raw!=='string'||raw.length>1000000)return null;
 try{const v:unknown=JSON.parse(raw);return serializeSetupCustomPayoutsV2(v,base)===raw?readSetupCustomPayoutsV2(v,base):null;}catch{return null;}
}
export function createSetupCustomPayoutsRecoveryV2(actorId:unknown,envelope:unknown,base:unknown):SetupCustomPayoutsRecoveryV2|null{
 const copy=readSetupCustomPayoutsV2(envelope,base);return uuid(actorId)&&copy?freeze({kind:'setup-custom-payouts-recovery-v2',actorId,operationId:copy.request.idempotencyKey,envelope:copy}):null;
}
export function serializeSetupCustomPayoutsRecoveryV2(value:unknown,base:unknown):string|null{
 return exact(value,['kind','actorId','operationId','envelope'])&&value.kind==='setup-custom-payouts-recovery-v2'&&uuid(value.actorId)&&uuid(value.operationId)&&isSetupCustomPayoutsV2(value.envelope,base)&&value.operationId===value.envelope.request.idempotencyKey?canonical(value):null;
}
export function parseSetupCustomPayoutsRecoveryV2(raw:unknown,actorId:unknown,operationId:unknown,base:unknown):SetupCustomPayoutsRecoveryV2|null{
 if(typeof raw!=='string'||raw.length>1000000||!uuid(actorId)||!uuid(operationId))return null;
 try{const v:unknown=JSON.parse(raw);return serializeSetupCustomPayoutsRecoveryV2(v,base)===raw&&object(v)&&v.actorId===actorId&&v.operationId===operationId?clone(v as SetupCustomPayoutsRecoveryV2):null;}catch{return null;}
}
export function setupCustomPayoutsRecoveryMatchesV2(a:unknown,b:unknown,base:unknown):boolean{const x=serializeSetupCustomPayoutsRecoveryV2(a,base);return x!==null&&x===serializeSetupCustomPayoutsRecoveryV2(b,base);}
