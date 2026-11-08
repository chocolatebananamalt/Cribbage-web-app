import {readPracticeQualificationFinanceReviewV1,type PracticeQualificationFinanceReviewV1} from './native-mixed-qualification-review-v1.ts';
export type NativeMixedReviewContextV1={projectRef:string;scope:{actorId:string;tournamentId:string;eventId:string};sessionId:string};
export const nativeMixedReviewUiEnabledV1=()=>false;
export const nativeMixedReviewBytesV1=131072;
export type NativeMixedReviewEnvelopeV1={kind:'native-mixed-review-provider-v1';actorId:string;sessionId:string;tournamentId:string;eventId:string;review:PracticeQualificationFinanceReviewV1};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
// Small protocol-local JSON guard: avoid importing mutable payout authoring
// modules solely for validation in a readonly rehearsal release.
function wire(v:unknown,seen=new Set<object>(),depth=0,budget={nodes:0,units:0}):boolean{
 if(depth>12||++budget.nodes>10000)return false;
 if(v===null||typeof v==='boolean'){budget.units+=5;return budget.units<=nativeMixedReviewBytesV1;}
 if(typeof v==='string'){budget.units+=v.length+2;return budget.units<=nativeMixedReviewBytesV1;}
 if(typeof v==='number'){budget.units+=24;return Number.isSafeInteger(v)&&!Object.is(v,-0)&&budget.units<=nativeMixedReviewBytesV1;}
 if((!Array.isArray(v)&&!object(v))||seen.has(v))return false;
 const keys=Reflect.ownKeys(v);if(keys.length>1000)return false;
 if(Array.isArray(v)&&(Object.getPrototypeOf(v)!==Array.prototype||keys.length!==v.length+1||!Array.from({length:v.length},(_,i)=>Object.hasOwn(v,i)).every(Boolean)))return false;
 seen.add(v);for(const k of keys){if(Array.isArray(v)&&k==='length')continue;const d=Object.getOwnPropertyDescriptor(v,k);if(typeof k!=='string'||!d||!('value'in d)||!d.enumerable)return false;budget.units+=k.length+3;if(budget.units>nativeMixedReviewBytesV1||!wire(d.value,seen,depth+1,budget))return false;}seen.delete(v);return true;
}
export function isNativeMixedReviewContextV1(c:unknown):c is NativeMixedReviewContextV1{return wire(c)&&exact(c,['projectRef','scope','sessionId'])&&c.projectRef==='nnhcnvksxgxnpvdqjgpg'&&uuid(c.sessionId)&&exact(c.scope,['actorId','tournamentId','eventId'])&&Object.values(c.scope).every(uuid);}
/** Structural intake only. Trust in current Start/root/funding comes from the
 * authenticated own-session SQL resolver, not from arbitrary browser objects. */
export function readNativeMixedReviewEnvelopeV1(value:unknown,context:NativeMixedReviewContextV1):NativeMixedReviewEnvelopeV1|null{
 try{if(!isNativeMixedReviewContextV1(context)||!wire(value)||!exact(value,['kind','actorId','sessionId','tournamentId','eventId','review'])||value.kind!=='native-mixed-review-provider-v1'||value.actorId!==context.scope.actorId||value.sessionId!==context.sessionId||value.tournamentId!==context.scope.tournamentId||value.eventId!==context.scope.eventId||new TextEncoder().encode(JSON.stringify(value)).byteLength>nativeMixedReviewBytesV1)return null;
  const review=readPracticeQualificationFinanceReviewV1(value.review);if(!review||review.tournamentId!==context.scope.tournamentId||review.eventId!==context.scope.eventId)return null;
  return{kind:'native-mixed-review-provider-v1',actorId:context.scope.actorId,sessionId:context.sessionId,tournamentId:context.scope.tournamentId,eventId:context.scope.eventId,review};
 }catch{return null;}
}
