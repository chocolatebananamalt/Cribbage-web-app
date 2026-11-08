import{nativeMixedPlayActivationEnabledV1}from'../seating/native-mixed-play-activation-v1.ts';
import 'server-only';
import type {NativeMixedSimulationAuthenticatedClientV1,NativeMixedSimulationExecutorV1} from './native-mixed-simulation-provider-v1.ts';
type RpcResult={data:unknown;error:unknown};
type Admin={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<RpcResult>};
export const nativeMixedPilotDirectorExecutorEnabledV1=()=>nativeMixedPlayActivationEnabledV1();
const canonical=(_key:string,value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value;
const ref='nnhcnvksxgxnpvdqjgpg',url=`https://${ref}.supabase.co`;
// Explicitly injected server-only clients. This factory creates no credentials,
// sessions or grants, and is not wired to an enabled route.
export function createNativeMixedPilotDirectorExecutorV1(options:{authenticated:NativeMixedSimulationAuthenticatedClientV1;admin:Admin;projectUrl:string;projectRef:string;tournamentId:string;eventId:string;enabled?:()=>boolean}):NativeMixedSimulationExecutorV1{
 async function invoke(action:string,args:{actor:string;tid:string;eid:string;request?:unknown;op?:string;startId?:string}):Promise<RpcResult>{
  const denied=()=>({data:null,error:{code:'pilot_scope_unavailable'}});
  try {
  const enabled=options.enabled??nativeMixedPilotDirectorExecutorEnabledV1;if(enabled()!==true)return denied();
  args=structuredClone(args);
  if(options.projectRef!==ref||options.projectUrl!==url||args.tid!==options.tournamentId||args.eid!==options.eventId)return denied();
  async function identity(){
   const user=await options.authenticated.auth.getUser(),claims=await options.authenticated.auth.getClaims();
   const expiry=(claims.data?.claims as {exp?:unknown}|undefined)?.exp;
   if(typeof expiry!=='number'||!Number.isFinite(expiry)||expiry*1000<=Date.now())return null;
   if(user.error||claims.error||user.data.user?.id!==args.actor||claims.data?.claims?.sub!==args.actor||typeof claims.data.claims.session_id!=='string')return null;
   const role=await options.authenticated.rpc('get_tournament_role',{p_tournament_id:args.tid});
   return role.error||role.data!=='director'?null:claims.data.claims.session_id;
  }
  const session=await identity();if(!session)return denied();
  const request=structuredClone(args.request??(args.op?{operationId:args.op}:args.startId?{startId:args.startId}:{}));
  if(action==='draw'){
   const raw=request as {operationId?:unknown};if(!raw||typeof raw!=='object'||typeof raw.operationId!=='string')return denied();
   // Separate committed reservation precedes candidate sampling. Existing pending
   // reservation is UNKNOWN, never an automatic re-execution signal.
   const reserved=await options.admin.rpc('reserve_native_mixed_pilot_draw_v1',{p_actor_id:args.actor,p_session_id:session,p_tournament_id:args.tid,p_event_id:args.eid,p_request:request});
   const reserveData=structuredClone(reserved.data),reserveError=reserved.error;
   if(reserveError||await identity()!==session||enabled()!==true)return{data:null,error:{code:'operation_outcome_unknown'}};
   const r=reserveData as Record<string,unknown>|null;
   if(r?.status==='rejected'||r?.status==='retry_exact')return Object.keys(r).sort().join(',')==='code,status'?{data:r,error:null}:{data:null,error:{code:'operation_outcome_unknown'}};
   if(!r||Object.getPrototypeOf(r)!==Object.prototype||Object.keys(r).sort().join(',')!==(r.status==='committed'?'actorId,eventId,kind,operationId,receipt,request,status,tournamentId':'actorId,eventId,kind,operationId,request,status,tournamentId')||r.kind!=='native-mixed-pilot-draw-reservation-v1'||r.actorId!==args.actor||r.tournamentId!==args.tid||r.eventId!==args.eid||r.operationId!==raw.operationId||JSON.stringify(r.request,canonical)!==JSON.stringify(request,canonical))return{data:null,error:{code:'operation_outcome_unknown'}};
   if(r.status==='committed')return{data:structuredClone(r.receipt),error:null};
   if(r.status!=='newly_reserved'||await identity()!==session||enabled()!==true)return{data:null,error:{code:'operation_outcome_unknown'}};
  }
  // Unknown transport outcome remains an error; never synthesize a receipt.
  const response=await options.admin.rpc('execute_native_mixed_pilot_director_v1',{p_actor_id:args.actor,p_session_id:session,p_tournament_id:args.tid,p_event_id:args.eid,p_action:action,p_request:request});
  const captured=structuredClone(response);return await identity()===session&&enabled()===true?captured:denied();
  } catch {return {data:null,error:{code:'operation_outcome_unknown'}};}
 }
 return{projectUrl:options.projectUrl,projectRef:options.projectRef,
  plan:a=>invoke('plan',a),draw:a=>invoke('draw',a),review:a=>invoke('review',a),publish:a=>invoke('publish',a),cancel:a=>invoke('cancel',a),
  readOperation:a=>invoke('operation',a),readCancellation:a=>invoke('cancellation',a),readTransition:a=>invoke('transition',a),readSource:a=>invoke('source',a),
  startSimulation:a=>invoke('simulation-start',a),readStartOperation:a=>invoke('simulation-start-operation',a),readStartedSource:a=>invoke('simulation-start-source',a)};
}
