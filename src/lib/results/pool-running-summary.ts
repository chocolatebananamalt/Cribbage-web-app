export type RunningPoolRow = {
  poolId:string; kind:"q"|"side"; name:string; feeMinor:number; policyId:string|null;
  status:"available"|"partial"|"unavailable"; issues:string[];
  enteredCount:number|null; fullyPaidCount:number|null; eligiblePaidEntryCount:number|null; partiallyPaidCount:number|null;
  recordedPoolTotalMinor:number|null; eligiblePoolTotalMinor:number|null; knownRecordedSubtotalMinor:number|null;
  projectedIfAllEnteredPayMinor:number|null; heldRecordedMinor:number|null; unknownPaymentCount:number|null;
  heldOrExcludedReviewRequired:boolean;
};
export type RunningPoolWorkspace = {
  kind:"pool-running-workspace-v1";tournamentId:string;eventId:string;observedAt:string;
  sourceObservation:"provided-models-not-atomic"|"matching-double-read-not-atomic"|"observed-source-drift";
  qState:"available"|"unavailable"|"no-recorded-pool";sideState:"available"|"unavailable"|"no-recorded-pool";
  pools:RunningPoolRow[];issues:string[];currency:"USD";estimate:true;awardEstimateAvailable:false;
  publicAccessGranted:false;moneyMovedByThisRead:false;
};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const id=(v:unknown)=>typeof v==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const amount=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const code=(v:unknown)=>typeof v==="string"&&/^[a-z_]{1,80}$/.test(v);
const fields=["enteredCount","fullyPaidCount","eligiblePaidEntryCount","partiallyPaidCount","recordedPoolTotalMinor","eligiblePoolTotalMinor","knownRecordedSubtotalMinor","projectedIfAllEnteredPayMinor","heldRecordedMinor","unknownPaymentCount"];
function consistent(p:Record<string,unknown>){
  const r=p as RunningPoolRow;
  if(r.status==="unavailable")return true;
  if(r.enteredCount===null||r.projectedIfAllEnteredPayMinor===null||BigInt(r.enteredCount)*BigInt(r.feeMinor)!==BigInt(r.projectedIfAllEnteredPayMinor))return false;
  if(r.fullyPaidCount!==null&&r.fullyPaidCount>r.enteredCount||r.partiallyPaidCount!==null&&r.partiallyPaidCount>r.enteredCount)return false;
  if(r.fullyPaidCount!==null&&r.partiallyPaidCount!==null&&r.fullyPaidCount+r.partiallyPaidCount>r.enteredCount)return false;
  if(r.eligiblePaidEntryCount!==null&&(r.fullyPaidCount===null||r.eligiblePaidEntryCount>r.fullyPaidCount))return false;
  if(r.eligiblePaidEntryCount===null?r.eligiblePoolTotalMinor!==null:r.eligiblePoolTotalMinor===null||BigInt(r.eligiblePaidEntryCount)*BigInt(r.feeMinor)!==BigInt(r.eligiblePoolTotalMinor))return false;
  if(r.recordedPoolTotalMinor!==null&&(r.knownRecordedSubtotalMinor!==r.recordedPoolTotalMinor
    ||r.eligiblePoolTotalMinor!==null&&r.eligiblePoolTotalMinor>r.recordedPoolTotalMinor
    ||r.heldRecordedMinor!==null&&r.heldRecordedMinor>r.recordedPoolTotalMinor
    ||r.fullyPaidCount!==null&&BigInt(r.fullyPaidCount)*BigInt(r.feeMinor)>BigInt(r.recordedPoolTotalMinor)))return false;
  return r.status!=="available"||fields.every(k=>p[k]!==null)&&!r.heldOrExcludedReviewRequired;
}
export function isRunningPoolWorkspace(v:unknown):v is RunningPoolWorkspace {
  if(!obj(v)||!exact(v,["kind","tournamentId","eventId","observedAt","sourceObservation","qState","sideState","pools","issues","currency","estimate","awardEstimateAvailable","publicAccessGranted","moneyMovedByThisRead"])
    ||v.kind!=="pool-running-workspace-v1"||!id(v.tournamentId)||!id(v.eventId)||typeof v.observedAt!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.observedAt)||!Number.isFinite(Date.parse(v.observedAt))
    ||!["provided-models-not-atomic","matching-double-read-not-atomic","observed-source-drift"].includes(v.sourceObservation as string)
    ||![v.qState,v.sideState].every(s=>["available","unavailable","no-recorded-pool"].includes(s as string))
    ||v.currency!=="USD"||v.estimate!==true||v.awardEstimateAvailable!==false||v.publicAccessGranted!==false||v.moneyMovedByThisRead!==false
    ||!Array.isArray(v.issues)||!v.issues.every(code)||!Array.isArray(v.pools)||v.pools.length>8)return false;
  return new Set(v.pools.map(p=>obj(p)?p.poolId:null)).size===v.pools.length&&v.pools.every(p=>obj(p)
    &&exact(p,["poolId","kind","name","feeMinor","policyId","status","issues",...fields,"heldOrExcludedReviewRequired"])
    &&id(p.poolId)&&["q","side"].includes(p.kind as string)&&typeof p.name==="string"&&p.name.trim().length>0&&p.name.length<=331&&!/[\u0000-\u001f\u007f]/.test(p.name)
    &&amount(p.feeMinor)&&(Number(p.feeMinor)>0||p.status==="unavailable")&&(p.policyId===null||id(p.policyId))&&["available","partial","unavailable"].includes(p.status as string)
    &&Array.isArray(p.issues)&&p.issues.every(code)&&fields.every(k=>p[k]===null||amount(p[k]))&&typeof p.heldOrExcludedReviewRequired==="boolean"
    &&(p.status!=="unavailable"||fields.every(k=>p[k]===null))&&consistent(p));
}
