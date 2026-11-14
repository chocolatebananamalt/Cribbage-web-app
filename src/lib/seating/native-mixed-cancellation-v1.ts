import {
 isNativeMixedSimulationOperationV1,
 type NativeMixedSimulationActionV1,
 type NativeMixedSimulationOperationV1,
 type NativeMixedSimulationRequestV1,
 type NativeMixedSimulationScopeV1,
} from './native-mixed-simulation-operation-v1.ts';

export type NativeMixedSimulationCancellationRequestV1={
 kind:'native-mixed-simulation-cancellation-v1';
 operationId:string;
 action:NativeMixedSimulationActionV1;
 operationRequest:NativeMixedSimulationRequestV1;
 reason:string;
};

export type NativeMixedSimulationCancellationReceiptV1={
 kind:'native-mixed-simulation-cancellation-receipt-v1';
 status:'cancelled_no_committed_operation';
 code:'simulation_operation_cancelled';
 actorId:string;
 tournamentId:string;
 eventId:string;
 operationId:string;
 action:NativeMixedSimulationActionV1;
 request:NativeMixedSimulationRequestV1;
 requestHash:string;
 cancellationReason:string;
 notCommitted:true;
 executionNotProven:true;
 freshDrawAuthorized:false;
 normalStartAuthorized:false;
 currentSourceVerified:false;
 historicalReceipt?:true;
};

const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value:unknown,keys:readonly string[]):value is Record<string,unknown>=>object(value)&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const digest=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const reason=(value:unknown):value is string=>typeof value==='string'&&value===value.trim()&&value.length>=1&&value.length<=500&&!/[\u0000-\u001f\u007f]/u.test(value);
const same=(a:unknown,b:unknown)=>JSON.stringify(a,(_key,value)=>object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value)===JSON.stringify(b,(_key,value)=>object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);

export function isNativeMixedSimulationCancellationRequestV1(value:unknown):value is NativeMixedSimulationCancellationRequestV1{
 if(!exact(value,['kind','operationId','action','operationRequest','reason'])||value.kind!=='native-mixed-simulation-cancellation-v1'||!reason(value.reason))return false;
 const operation={action:value.action,operationId:value.operationId,request:value.operationRequest};
 return isNativeMixedSimulationOperationV1(operation);
}

export function readNativeMixedCancellationReceiptV1(
 value:unknown,
 expected:{scope:NativeMixedSimulationScopeV1;operation:NativeMixedSimulationOperationV1;reason?:string},
):NativeMixedSimulationCancellationReceiptV1|null{
 try{
  const historical=object(value)&&value.historicalReceipt===true;
  const keys=['kind','status','code','actorId','tournamentId','eventId','operationId','action','request','requestHash','cancellationReason','notCommitted','executionNotProven','freshDrawAuthorized','normalStartAuthorized','currentSourceVerified',...(historical?['historicalReceipt']:[])];
  if(!exact(value,keys)||value.kind!=='native-mixed-simulation-cancellation-receipt-v1'||value.status!=='cancelled_no_committed_operation'||value.code!=='simulation_operation_cancelled')return null;
  if(!isNativeMixedSimulationOperationV1(expected.operation)||value.actorId!==expected.scope.actorId||value.tournamentId!==expected.scope.tournamentId||value.eventId!==expected.scope.eventId||value.operationId!==expected.operation.operationId||value.action!==expected.operation.action||!same(value.request,expected.operation.request)||!digest(value.requestHash)||!reason(value.cancellationReason)||(expected.reason!==undefined&&value.cancellationReason!==expected.reason))return null;
  if(value.notCommitted!==true||value.executionNotProven!==true||value.freshDrawAuthorized!==false||value.normalStartAuthorized!==false||value.currentSourceVerified!==false)return null;
  return structuredClone(value) as NativeMixedSimulationCancellationReceiptV1;
 }catch{return null;}
}
