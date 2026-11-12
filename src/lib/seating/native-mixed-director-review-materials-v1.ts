import {isNativeMixedSimulationOperationV1,readNativeMixedSimulationOperationV1} from './native-mixed-simulation-operation-v1.ts';
import type {NativeMixedSimulationOperationV1,NativeMixedSimulationScopeV1} from './native-mixed-simulation-operation-v1.ts';
import {projectOneTableMovement} from './one-table-movement.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function readNativeMixedDirectorPreparedOperationV1(value:unknown):NativeMixedSimulationOperationV1|null{
 try{const raw=JSON.stringify(value);if(typeof raw!=='string'||new TextEncoder().encode(raw).length>131072)return null;const parsed:unknown=JSON.parse(raw);return isNativeMixedSimulationOperationV1(parsed)?parsed:null;}catch{return null;}
}
function history(value:unknown,scope:NativeMixedSimulationScopeV1){
 if(!object(value)||typeof value.operationId!=='string')return null;
 const read=readNativeMixedSimulationOperationV1(value,{scope,operationId:value.operationId});
 return read?.receipt.historicalReceipt===true&&read.receipt.currentSourceVerified===false?read:null;
}
/** Display binding only. No historical receipt grants current write authority. */
function readMaterials(value:unknown,scope:NativeMixedSimulationScopeV1,next:NativeMixedSimulationOperationV1){
 if(!object(value)||!isNativeMixedSimulationOperationV1(next)||!['review','publish'].includes(next.action))return null;
 const p=history(value.plan,scope),d=history(value.draw,scope);
 if(!p||!d||p.action!=='plan'||d.action!=='draw'||p.receipt.status!=='accepted'||d.receipt.status!=='accepted'||p.request.kind!=='native-mixed-simulation-plan-v1'||d.request.kind!=='native-mixed-simulation-draw-v1'||d.request.planId!==p.receipt.planId||d.request.expectedPlanDigest!==p.receipt.sourceDigest||d.request.expectedAttendanceSourceDigest!==p.request.expectedAttendanceSourceDigest||next.request.expectedAttendanceSourceDigest!==p.request.expectedAttendanceSourceDigest)return null;
 const r=next.request;
 if(r.kind==='native-mixed-simulation-review-v1'){
  if(r.drawId!==d.receipt.drawId||r.expectedDrawDigest!==d.receipt.sourceDigest)return null;
 }else if(r.kind==='native-mixed-simulation-publish-v1'){
  const v=history(value.review,scope);
  if(!v||v.action!=='review'||v.receipt.status!=='accepted'||v.request.kind!=='native-mixed-simulation-review-v1'||v.request.drawId!==d.receipt.drawId||v.request.expectedDrawDigest!==d.receipt.sourceDigest||v.request.expectedAttendanceSourceDigest!==p.request.expectedAttendanceSourceDigest||r.reviewId!==v.receipt.reviewId||r.expectedReviewDigest!==v.receipt.sourceDigest)return null;
 }else return null;
 if(projectOneTableMovement(p.request.config,d.receipt.candidate).status!=='verified')return null;
 return{config:structuredClone(p.request.config),candidate:structuredClone(d.receipt.candidate)};
}
export function readNativeMixedDirectorReviewMaterialsV1(value:unknown,scope:NativeMixedSimulationScopeV1,next:NativeMixedSimulationOperationV1){
 try{const raw=JSON.stringify(value);if(typeof raw!=='string'||new TextEncoder().encode(raw).length>131072)return null;return readMaterials(JSON.parse(raw),scope,next);}catch{return null;}
}
