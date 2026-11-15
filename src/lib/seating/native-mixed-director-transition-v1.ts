import {isNativeMixedSimulationOperationV1,readNativeMixedSimulationOperationV1} from './native-mixed-simulation-operation-v1.ts';
import type {NativeMixedSimulationOperationV1,NativeMixedSimulationOperationReadV1,NativeMixedSimulationScopeV1} from './native-mixed-simulation-operation-v1.ts';

/** Read-time observation only. The actual writer must recheck current sources. */
export type NativeMixedDirectorTransitionV1={kind:'native-mixed-director-transition-v1';actorId:string;tournamentId:string;eventId:string;prior:NativeMixedSimulationOperationReadV1;nextAction:'draw'|'review'|'publish';parentId:string;parentDigest:string;attendanceDigest:string;observedAt:string;currentSourceVerified:true;writeAuthorized:false;normalStartAuthorized:false};
const exact=(value:unknown,keys:string[]):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const digest=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const parent={plan:['draw','planId'],draw:['review','drawId'],review:['publish','reviewId']} as const;
export function readNativeMixedDirectorTransitionV1(value:unknown,expected:{scope:NativeMixedSimulationScopeV1;prior:NativeMixedSimulationOperationV1;now:number}):NativeMixedDirectorTransitionV1|null{
 const keys=['kind','actorId','tournamentId','eventId','prior','nextAction','parentId','parentDigest','attendanceDigest','observedAt','currentSourceVerified','writeAuthorized','normalStartAuthorized'];
 if(!exact(value,keys)||value.kind!=='native-mixed-director-transition-v1'||value.actorId!==expected.scope.actorId||value.tournamentId!==expected.scope.tournamentId||value.eventId!==expected.scope.eventId||value.currentSourceVerified!==true||value.writeAuthorized!==false||value.normalStartAuthorized!==false||expected.prior.action==='publish'||!digest(value.parentDigest)||!digest(value.attendanceDigest)||typeof value.observedAt!=='string')return null;
 const when=Date.parse(value.observedAt);if(!Number.isFinite(expected.now)||!Number.isFinite(when)||new Date(when).toISOString()!==value.observedAt||when>expected.now||expected.now-when>30000)return null;
 const prior=readNativeMixedSimulationOperationV1(value.prior,{scope:expected.scope,operationId:expected.prior.operationId,operation:expected.prior});
 if(!prior||prior.receipt.status!=='accepted')return null;
 const [nextAction,idKey]=parent[expected.prior.action];
 if(value.nextAction!==nextAction||value.parentId!==prior.receipt[idKey]||value.parentDigest!==prior.receipt.sourceDigest||value.attendanceDigest!==expected.prior.request.expectedAttendanceSourceDigest)return null;
 return structuredClone({...value,prior}) as NativeMixedDirectorTransitionV1;
}
export function nativeMixedNextOperationMatchesV1(next:unknown,proof:NativeMixedDirectorTransitionV1){
 if(!isNativeMixedSimulationOperationV1(next)||next.action!==proof.nextAction||next.operationId===proof.prior.operationId||next.request.expectedAttendanceSourceDigest!==proof.attendanceDigest)return false;
 const r=next.request;
 if(r.kind==='native-mixed-simulation-draw-v1')return r.planId===proof.parentId&&r.expectedPlanDigest===proof.parentDigest;
 if(r.kind==='native-mixed-simulation-review-v1')return r.drawId===proof.parentId&&r.expectedDrawDigest===proof.parentDigest;
 return r.kind==='native-mixed-simulation-publish-v1'&&r.reviewId===proof.parentId&&r.expectedReviewDigest===proof.parentDigest;
}
