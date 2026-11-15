import 'server-only';
import {
 isNativeMixedSimulationOperationV1,
 readNativeMixedSimulationOperationV1,
 readNativeMixedSimulationOutcomeV1,
 readNativeMixedSimulationScheduleSourceV1,
 type NativeMixedSimulationActionV1,
 type NativeMixedSimulationOperationReadV1,
 type NativeMixedSimulationOperationV1,
 type NativeMixedSimulationProviderWriteV1,
 type NativeMixedSimulationScopeV1,
} from '../seating/native-mixed-simulation-operation-v1.ts';
import {
 isNativeMixedSimulationCancellationRequestV1,
 readNativeMixedCancellationReceiptV1,
 type NativeMixedSimulationCancellationReceiptV1,
 type NativeMixedSimulationCancellationRequestV1,
} from '../seating/native-mixed-cancellation-v1.ts';
import {
 readNativeMixedDirectorTransitionV1,
 type NativeMixedDirectorTransitionV1,
} from '../seating/native-mixed-director-transition-v1.ts';

import {isNativeMixedSimulationStartRequestV1, readNativeMixedSimulationStartOutcomeV1,
 readNativeMixedSimulationStartReceiptV1, readNativeMixedSimulationStartedSourceV1,
 type NativeMixedSimulationStartRequestV1, type NativeMixedSimulationStartOutcomeV1,
 type NativeMixedSimulationStartReceiptV1, type NativeMixedSimulationStartedSourceV1,
} from '../seating/native-mixed-simulation-start-v1.ts';

type RpcResult={data:unknown;error:unknown};
type UserResult={data:{user:{id:string}|null};error:unknown};
type ClaimsResult={data:{claims?:{sub?:unknown;session_id?:unknown}}|null;error:unknown};
export type NativeMixedSimulationAuthenticatedClientV1={auth:{getUser:()=>Promise<UserResult>;getClaims:()=>Promise<ClaimsResult>};rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<RpcResult>};
export type NativeMixedSimulationProviderCapabilityV1=NativeMixedSimulationActionV1|'operation'|'source'|'cancel'|'cancellation'|'transition'|'simulation-start'|'simulation-start-operation'|'simulation-start-source';
export type NativeMixedDirectorSessionV1={kind:'native-mixed-director-session-v1';subjectId:string;sessionId:string;actorId:string;
 tournamentId:string;eventId:string;projectUrl:string;projectRef:string;allowedActions:NativeMixedSimulationProviderCapabilityV1[];expiresAt:string};
export type NativeMixedSimulationExecutorArgsV1={actor:string;tid:string;eid:string;request:unknown};
export type NativeMixedSimulationExecutorV1={projectUrl:string;projectRef:string;
 plan:(args:NativeMixedSimulationExecutorArgsV1)=>PromiseLike<RpcResult>;
 draw:(args:NativeMixedSimulationExecutorArgsV1)=>PromiseLike<RpcResult>;
 review:(args:NativeMixedSimulationExecutorArgsV1)=>PromiseLike<RpcResult>;
 publish:(args:NativeMixedSimulationExecutorArgsV1)=>PromiseLike<RpcResult>;
 cancel:(args:NativeMixedSimulationExecutorArgsV1)=>PromiseLike<RpcResult>;
 readOperation:(args:{actor:string;tid:string;eid:string;op:string})=>PromiseLike<RpcResult>;
 readCancellation:(args:{actor:string;tid:string;eid:string;op:string})=>PromiseLike<RpcResult>;
 readTransition:(args:{actor:string;tid:string;eid:string;op:string})=>PromiseLike<RpcResult>;
 readSource:(args:{actor:string;tid:string;eid:string})=>PromiseLike<RpcResult>;
 startSimulation?:(args:NativeMixedSimulationExecutorArgsV1)=>PromiseLike<RpcResult>;
 readStartOperation?:(args:{actor:string;tid:string;eid:string;op:string})=>PromiseLike<RpcResult>;
 readStartedSource?:(args:{actor:string;tid:string;eid:string;startId:string})=>PromiseLike<RpcResult>;
};
export type NativeMixedSimulationCancellationRetryV1={status:'retry_exact';code:'source_busy'};
export type NativeMixedSimulationCancellationBlockedV1={status:'rejected'|'blocked';code:'feature_unavailable'|'idempotency_conflict'|'draw_already_cancelled'|'draw_not_cancellable'|'operation_conflict'|'recovery_unavailable'|'operation_history_unavailable'|'cancellation_history_unavailable'};
export type NativeMixedSimulationCancelOutcomeV1=NativeMixedSimulationCancellationReceiptV1|NativeMixedSimulationOperationReadV1|NativeMixedSimulationCancellationRetryV1|NativeMixedSimulationCancellationBlockedV1;
type ErrorCode='disabled'|'invalid_session'|'action_not_allowed'|'permission_required'|'identity_changed'|'provider_unavailable'|'operation_outcome_unknown'|'invalid_response';
type Result<T>={data:T;error:null}|{data:null;error:ErrorCode};
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(value:unknown,keys:readonly string[]):value is Record<string,unknown>=>object(value)&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const iso=(value:unknown):value is string=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))return false;const parsed=Date.parse(value);return Number.isFinite(parsed)&&new Date(parsed).toISOString()===value;};
const clone=<T>(value:T):T=>structuredClone(value);
const snapshot=(value:unknown):{ok:true;data:unknown}|{ok:false;data:null}=>{try{return{ok:true,data:clone(value)};}catch{return{ok:false,data:null};}};
const capabilities:NativeMixedSimulationProviderCapabilityV1[]=['plan','draw','review','publish','operation','source','cancel','cancellation','transition','simulation-start','simulation-start-operation','simulation-start-source'];
export const nativeMixedSimulationProviderEnabledV1=()=>false;
const unavailable=async():Promise<RpcResult>=>({data:null,error:{code:'executor_unavailable'}});
export const nativeMixedSimulationUnavailableExecutorV1=(projectUrl='',projectRef=''):NativeMixedSimulationExecutorV1=>({projectUrl,projectRef,plan:unavailable,draw:unavailable,review:unavailable,publish:unavailable,cancel:unavailable,readOperation:unavailable,readCancellation:unavailable,readTransition:unavailable,readSource:unavailable,startSimulation:unavailable,readStartOperation:unavailable,readStartedSource:unavailable});

export function readNativeMixedDirectorSessionV1(value:unknown,expected:{subjectId?:string;sessionId?:string;tournamentId?:string;eventId?:string;projectUrl:string;projectRef:string;action:NativeMixedSimulationProviderCapabilityV1;now:number}):NativeMixedDirectorSessionV1|null{
 if(!exact(value,['kind','subjectId','sessionId','actorId','tournamentId','eventId','projectUrl','projectRef','allowedActions','expiresAt'])||value.kind!=='native-mixed-director-session-v1'||![value.subjectId,value.actorId,value.tournamentId,value.eventId].every(uuid)||value.subjectId!==value.actorId||typeof value.sessionId!=='string'||value.sessionId.length<1||value.sessionId.length>512||typeof value.projectRef!=='string'||!/^[a-z0-9-]{1,128}$/.test(value.projectRef)||!iso(value.expiresAt))return null;
 if(!Array.isArray(value.allowedActions)||value.allowedActions.length<1||new Set(value.allowedActions).size!==value.allowedActions.length||value.allowedActions.some(item=>!capabilities.includes(item as NativeMixedSimulationProviderCapabilityV1))||!value.allowedActions.includes(expected.action))return null;
 if(expected.subjectId!==undefined&&value.subjectId!==expected.subjectId||expected.sessionId!==undefined&&value.sessionId!==expected.sessionId||expected.tournamentId!==undefined&&value.tournamentId!==expected.tournamentId||expected.eventId!==undefined&&value.eventId!==expected.eventId||value.projectUrl!==expected.projectUrl||value.projectRef!==expected.projectRef)return null;
 const expiry=Date.parse(value.expiresAt);return expiry>expected.now&&expiry-expected.now<=300000?structuredClone(value) as NativeMixedDirectorSessionV1:null;
}
function scope(session:NativeMixedDirectorSessionV1):NativeMixedSimulationScopeV1{return{actorId:session.actorId,tournamentId:session.tournamentId,eventId:session.eventId};}

async function official(client:NativeMixedSimulationAuthenticatedClientV1,session:NativeMixedDirectorSessionV1){
 const user=await client.auth.getUser();const claims=await client.auth.getClaims();
 if(user.error||claims.error||!user.data.user||user.data.user.id!==session.actorId||claims.data?.claims?.sub!==session.subjectId||claims.data.claims.session_id!==session.sessionId)return'identity_changed' as const;
 const role=await client.rpc('get_tournament_role',{p_tournament_id:session.tournamentId});if(role.error||role.data!=='director')return'permission_required' as const;
 return null;
}

export function createNativeMixedSimulationProviderV1(options:{authenticated:NativeMixedSimulationAuthenticatedClientV1;executor?:NativeMixedSimulationExecutorV1;enabled?:()=>boolean;now?:()=>number;simulatedStartEnabled?:()=>boolean;simulatedStartRecoveryEnabled?:()=>boolean}){
 const executor=options.executor??nativeMixedSimulationUnavailableExecutorV1(),projectUrl=executor.projectUrl,projectRef=executor.projectRef,enabled=options.enabled??nativeMixedSimulationProviderEnabledV1,now=options.now??Date.now;
 const startEnabled=options.simulatedStartEnabled??(()=>false),startRecoveryEnabled=options.simulatedStartRecoveryEnabled??(()=>false);
 async function enter(input:NativeMixedDirectorSessionV1,action:NativeMixedSimulationProviderCapabilityV1){
  const session=clone(input);if(enabled()!==true)return{session:null,error:'disabled' as const};
  const checked=readNativeMixedDirectorSessionV1(session,{projectUrl,projectRef,action,now:now()});
  if(!checked)return{session:null,error:'invalid_session' as const};
  const before=await official(options.authenticated,session);if(before)return{session:null,error:before};
  return Date.parse(session.expiresAt)>now()?{session,error:null}:{session:null,error:'invalid_session' as const};
 }
 async function leave(session:NativeMixedDirectorSessionV1){
  if(enabled()!==true)return'disabled' as const;if(Date.parse(session.expiresAt)<=now())return'invalid_session' as const;
  const after=await official(options.authenticated,session);if(after)return after;
  return Date.parse(session.expiresAt)>now()?null:'invalid_session' as const;
 }
 async function execute(input:NativeMixedDirectorSessionV1,operationInput:NativeMixedSimulationOperationV1):Promise<Result<NativeMixedSimulationProviderWriteV1>>{
  const operation=clone(operationInput);if(!isNativeMixedSimulationOperationV1(operation))return{data:null,error:'invalid_response'};
  const entered=await enter(input,operation.action);if(entered.error)return{data:null,error:entered.error};const session=entered.session;
  const response=await executor[operation.action]({actor:session.actorId,tid:session.tournamentId,eid:session.eventId,request:operation.request});
  const captured=snapshot(response.data),rpcError=response.error,after=await leave(session);if(after)return{data:null,error:after};if(rpcError)return{data:null,error:'provider_unavailable'};if(!captured.ok)return{data:null,error:'invalid_response'};
  const fixedScope=scope(session),outcome=readNativeMixedSimulationOutcomeV1(captured.data,{scope:fixedScope,operation});if(!outcome)return{data:null,error:'invalid_response'};
  return{data:{kind:'native-mixed-simulation-provider-write-v1',action:operation.action,...fixedScope,operationId:operation.operationId,operation,outcome},error:null};
 }
 function cancellationOutcome(value:unknown,fixedScope:NativeMixedSimulationScopeV1,operation:NativeMixedSimulationOperationV1,reason:string):NativeMixedSimulationCancelOutcomeV1|null{
  const receipt=readNativeMixedCancellationReceiptV1(value,{scope:fixedScope,operation,reason});if(receipt)return receipt;
  const committed=readNativeMixedSimulationOperationV1(value,{scope:fixedScope,operationId:operation.operationId,operation});if(committed)return committed;
  if(exact(value,['status','code'])&&value.status==='retry_exact'&&value.code==='source_busy')return clone(value) as NativeMixedSimulationCancellationRetryV1;
  const rejectedCodes=['feature_unavailable','idempotency_conflict','draw_already_cancelled','draw_not_cancellable','operation_conflict'];
  const blockedCodes=['recovery_unavailable','operation_history_unavailable','cancellation_history_unavailable'];
  if(exact(value,['status','code'])&&(value.status==='rejected'&&rejectedCodes.includes(value.code as string)||value.status==='blocked'&&blockedCodes.includes(value.code as string)))return clone(value) as NativeMixedSimulationCancellationBlockedV1;
  return null;
 }
 return{
  execute,
  startSimulation:async(input:NativeMixedDirectorSessionV1,requestInput:NativeMixedSimulationStartRequestV1):Promise<Result<NativeMixedSimulationStartOutcomeV1>>=>{
   if(startEnabled()!==true)return{data:null,error:'disabled'};
   const saved=snapshot(requestInput);if(!saved.ok||!isNativeMixedSimulationStartRequestV1(saved.data))return{data:null,error:'invalid_response'};const request=saved.data;
   const entered=await enter(input,'simulation-start');if(entered.error)return{data:null,error:entered.error};const session=entered.session;
   if(startEnabled()!==true)return{data:null,error:'disabled'};if(!executor.startSimulation)return{data:null,error:'provider_unavailable'};
   const response=await Promise.resolve().then(()=>executor.startSimulation!({actor:session.actorId,tid:session.tournamentId,eid:session.eventId,request})).catch(()=>({data:null,error:true}));
   const captured=snapshot(response.data),failed=response.error!=null,after=await leave(session);if(after)return{data:null,error:after};if(startEnabled()!==true)return{data:null,error:'disabled'};
   if(failed||!captured.ok)return{data:null,error:'operation_outcome_unknown'};
   const value=readNativeMixedSimulationStartOutcomeV1(captured.data,{scope:scope(session),request});return value?{data:value,error:null}:{data:null,error:'operation_outcome_unknown'};
  },
  startOperation:async(input:NativeMixedDirectorSessionV1,requestInput:NativeMixedSimulationStartRequestV1):Promise<Result<NativeMixedSimulationStartReceiptV1>>=>{
   if(startRecoveryEnabled()!==true)return{data:null,error:'disabled'};
   const saved=snapshot(requestInput);if(!saved.ok||!isNativeMixedSimulationStartRequestV1(saved.data))return{data:null,error:'invalid_response'};const request=saved.data;
   const entered=await enter(input,'simulation-start-operation');if(entered.error)return{data:null,error:entered.error};const session=entered.session;
   if(startRecoveryEnabled()!==true)return{data:null,error:'disabled'};if(!executor.readStartOperation)return{data:null,error:'provider_unavailable'};
   const response=await Promise.resolve().then(()=>executor.readStartOperation!({actor:session.actorId,tid:session.tournamentId,eid:session.eventId,op:request.operationId})).catch(()=>({data:null,error:true}));
   const captured=snapshot(response.data),failed=response.error!=null,after=await leave(session);if(after)return{data:null,error:after};if(startRecoveryEnabled()!==true)return{data:null,error:'disabled'};
   if(failed||!captured.ok)return{data:null,error:'operation_outcome_unknown'};
   const value=readNativeMixedSimulationStartReceiptV1(captured.data,{scope:scope(session),request,historicalOnly:true});return value?{data:value,error:null}:{data:null,error:'operation_outcome_unknown'};
  },
  startedSource:async(input:NativeMixedDirectorSessionV1,requestInput:NativeMixedSimulationStartRequestV1,startId:string):Promise<Result<NativeMixedSimulationStartedSourceV1>>=>{
   if(startEnabled()!==true)return{data:null,error:'disabled'};
   const saved=snapshot(requestInput);if(!saved.ok||!isNativeMixedSimulationStartRequestV1(saved.data)||!uuid(startId))return{data:null,error:'invalid_response'};const request=saved.data;
   const entered=await enter(input,'simulation-start-source');if(entered.error)return{data:null,error:entered.error};const session=entered.session;
   if(startEnabled()!==true)return{data:null,error:'disabled'};if(!executor.readStartedSource)return{data:null,error:'provider_unavailable'};
   const response=await Promise.resolve().then(()=>executor.readStartedSource!({actor:session.actorId,tid:session.tournamentId,eid:session.eventId,startId})).catch(()=>({data:null,error:true}));
   const captured=snapshot(response.data),failed=response.error!=null,after=await leave(session);if(after)return{data:null,error:after};if(startEnabled()!==true)return{data:null,error:'disabled'};
   if(failed)return{data:null,error:'provider_unavailable'};if(!captured.ok)return{data:null,error:'invalid_response'};
   const value=readNativeMixedSimulationStartedSourceV1(captured.data,{scope:scope(session),request,startId});return value?{data:value,error:null}:{data:null,error:'invalid_response'};
  },
  cancel:async(input:NativeMixedDirectorSessionV1,requestInput:NativeMixedSimulationCancellationRequestV1):Promise<Result<NativeMixedSimulationCancelOutcomeV1>>=>{
   const request=clone(requestInput);if(!isNativeMixedSimulationCancellationRequestV1(request))return{data:null,error:'invalid_response'};
   const operation={action:request.action,operationId:request.operationId,request:request.operationRequest} as NativeMixedSimulationOperationV1;
   const entered=await enter(input,'cancel');if(entered.error)return{data:null,error:entered.error};const session=entered.session;
   const response=await executor.cancel({actor:session.actorId,tid:session.tournamentId,eid:session.eventId,request});
   const captured=snapshot(response.data),rpcError=response.error,after=await leave(session);if(after)return{data:null,error:after};if(rpcError)return{data:null,error:'provider_unavailable'};if(!captured.ok)return{data:null,error:'invalid_response'};
   const outcome=cancellationOutcome(captured.data,scope(session),operation,request.reason);return outcome?{data:outcome,error:null}:{data:null,error:'invalid_response'};
  },
  operation:async(input:NativeMixedDirectorSessionV1,operationId:string):Promise<Result<NativeMixedSimulationOperationReadV1>>=>{
   if(!uuid(operationId))return{data:null,error:'invalid_response'};
   const entered=await enter(input,'operation');if(entered.error)return{data:null,error:entered.error};const session=entered.session;
   const response=await executor.readOperation({actor:session.actorId,tid:session.tournamentId,eid:session.eventId,op:operationId});
   const captured=snapshot(response.data),rpcError=response.error,after=await leave(session);if(after)return{data:null,error:after};if(rpcError||!captured.ok||captured.data===null)return{data:null,error:'operation_outcome_unknown'};
   const value=readNativeMixedSimulationOperationV1(captured.data,{scope:scope(session),operationId});return value?{data:value,error:null}:{data:null,error:'operation_outcome_unknown'};
  },
  cancellation:async(input:NativeMixedDirectorSessionV1,operationInput:NativeMixedSimulationOperationV1):Promise<Result<NativeMixedSimulationCancellationReceiptV1>>=>{
   const operation=clone(operationInput);if(!isNativeMixedSimulationOperationV1(operation))return{data:null,error:'invalid_response'};
   const entered=await enter(input,'cancellation');if(entered.error)return{data:null,error:entered.error};const session=entered.session;
   const response=await executor.readCancellation({actor:session.actorId,tid:session.tournamentId,eid:session.eventId,op:operation.operationId});
   const captured=snapshot(response.data),rpcError=response.error,after=await leave(session);if(after)return{data:null,error:after};if(rpcError||!captured.ok||captured.data===null)return{data:null,error:'operation_outcome_unknown'};
   const receipt=readNativeMixedCancellationReceiptV1(captured.data,{scope:scope(session),operation});return receipt?.historicalReceipt===true?{data:receipt,error:null}:{data:null,error:'operation_outcome_unknown'};
  },
  transition:async(input:NativeMixedDirectorSessionV1,operationInput:NativeMixedSimulationOperationV1):Promise<Result<NativeMixedDirectorTransitionV1>>=>{
   const operation=clone(operationInput);if(!isNativeMixedSimulationOperationV1(operation))return{data:null,error:'invalid_response'};
   const entered=await enter(input,'transition');if(entered.error)return{data:null,error:entered.error};const session=entered.session;
   const response=await executor.readTransition({actor:session.actorId,tid:session.tournamentId,eid:session.eventId,op:operation.operationId});
   const captured=snapshot(response.data),rpcError=response.error,after=await leave(session);if(after)return{data:null,error:after};if(rpcError||!captured.ok||captured.data===null)return{data:null,error:'operation_outcome_unknown'};
   const proof=readNativeMixedDirectorTransitionV1(captured.data,{scope:scope(session),prior:operation,now:now()});return proof?{data:proof,error:null}:{data:null,error:'invalid_response'};
  },
  source:async(input:NativeMixedDirectorSessionV1):Promise<Result<NonNullable<ReturnType<typeof readNativeMixedSimulationScheduleSourceV1>>>>=>{
   const entered=await enter(input,'source');if(entered.error)return{data:null,error:entered.error};const session=entered.session;
   const response=await executor.readSource({actor:session.actorId,tid:session.tournamentId,eid:session.eventId}),captured=snapshot(response.data),rpcError=response.error,after=await leave(session);if(after)return{data:null,error:after};if(rpcError)return{data:null,error:'provider_unavailable'};if(!captured.ok)return{data:null,error:'invalid_response'};
   const value=readNativeMixedSimulationScheduleSourceV1(captured.data,scope(session));return value?{data:value,error:null}:{data:null,error:'invalid_response'};
  },
 };
}
