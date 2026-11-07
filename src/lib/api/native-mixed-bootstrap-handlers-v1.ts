import 'server-only';
import{bootstrapWorkflowEnabled,isBootstrapWire,readBootstrapOffer,readBootstrapResult,type BootstrapContext,type BootstrapMode}from'../seating/native-mixed-bootstrap-workflow-v1.ts';
import type{NativeMixedSimulationAuthenticatedClientV1}from'./native-mixed-simulation-provider-v1.ts';
type Rpc={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
type Context={params:Promise<{id:string;eventId:string;mode:string;operationId?:string}>};
export function createNativeMixedBootstrapHandlersV1<Reply,Req extends Request=Request>(d:{enabled?:()=>boolean;projectUrl:string;projectRef:string;authenticated:()=>Promise<NativeMixedSimulationAuthenticatedClientV1>;privileged:()=>Promise<Rpc>;readJson:(r:Req,max:number)=>Promise<unknown>;sameOrigin:(r:Req)=>boolean;json:(body:unknown,init?:ResponseInit)=>Reply;boundary:(run:()=>Promise<Reply>)=>Promise<Reply>;now?:()=>number}){
 function handler(method:'source'|'write'|'operation'){return(request:Req,context:Context)=>d.boundary(async()=>{
  const enabled=d.enabled??bootstrapWorkflowEnabled,fail=(status:number,error:string)=>d.json({error},{status}),now=d.now??Date.now;if(!enabled())return fail(404,'not_found');
  const p=await context.params,expected=request.headers.get('x-expected-actor-id');if(!['director','paper-review','consent'].includes(p.mode))return fail(404,'not_found');
  if(d.projectRef!=='nnhcnvksxgxnpvdqjgpg'||d.projectUrl!=='https://nnhcnvksxgxnpvdqjgpg.supabase.co'||!uuid(p.id)||!uuid(p.eventId)||!uuid(expected))return fail(403,'invalid_target');
  const writing=method==='write';if(method!=='source'&&!d.sameOrigin(request))return fail(403,'invalid_origin');
  const wire=method==='source'?null:await d.readJson(request,32768);if(method!=='source'&&(!isBootstrapWire(wire)||wire.mode!==p.mode||!uuid(p.operationId)||wire.operationId!==p.operationId))return fail(400,'invalid_request');
  const client=await d.authenticated();async function identity(){const u=await client.auth.getUser(),j=await client.auth.getClaims(),v=j.data?.claims as{sub?:unknown;session_id?:unknown;exp?:unknown}|undefined;return !u.error&&!j.error&&u.data.user?.id===expected&&v?.sub===expected&&uuid(v.session_id)&&typeof v.exp==='number'&&Number.isFinite(v.exp)&&v.exp*1000>now()?{actorId:expected,sessionId:v.session_id}:null;}
  const own=await identity();if(!own)return fail(403,'identity_changed');
  async function lease(){const r=await client.rpc('get_native_mixed_bootstrap_session_v1',{p_tournament_id:p.id,p_event_id:p.eventId,p_mode:p.mode,p_writing:writing});const v=structuredClone(r.data),failed=!!r.error;if(failed||!v||typeof v!=='object'||Array.isArray(v))return false;const x=v as Record<string,unknown>;return Reflect.ownKeys(x).length===8&&['kind','actorId','sessionId','tournamentId','eventId','mode','writing','expiresAt'].every(k=>Object.hasOwn(x,k))&&x.kind==='native-mixed-bootstrap-session-v1'&&x.actorId===own!.actorId&&x.sessionId===own!.sessionId&&x.tournamentId===p.id&&x.eventId===p.eventId&&x.mode===p.mode&&x.writing===writing&&typeof x.expiresAt==='string'&&Number.isFinite(Date.parse(x.expiresAt))&&Date.parse(x.expiresAt)>now();}
  if(!await lease())return fail(403,'permission_required');const before=await identity();if(!before||before.sessionId!==own.sessionId||!enabled())return fail(403,'identity_changed');
  let response:{data:unknown;error:unknown};
  if(p.mode==='consent'){
   response=method==='source'?await client.rpc('get_native_mixed_own_consent_offer_v1',{p_tournament_id:p.id,p_event_id:p.eventId}):await client.rpc('execute_native_mixed_own_consent_v1',{p_tournament_id:p.id,p_event_id:p.eventId,p_wire:wire,p_read_only:method==='operation'});
  }else{const admin=await d.privileged();response=method==='source'?await admin.rpc('get_native_mixed_bootstrap_offer_v1',{p_actor_id:own.actorId,p_session_id:own.sessionId,p_tournament_id:p.id,p_event_id:p.eventId,p_mode:p.mode}):await admin.rpc('execute_native_mixed_bootstrap_v1',{p_actor_id:own.actorId,p_session_id:own.sessionId,p_tournament_id:p.id,p_event_id:p.eventId,p_mode:p.mode,p_wire:wire,p_read_only:method==='operation'});}
  const captured=structuredClone(response.data),failed=!!response.error,after=await identity();if(!after||after.sessionId!==own.sessionId||!enabled()||!await lease())return fail(403,'identity_changed');if(failed)return fail(503,'outcome_unknown');
  const target:BootstrapContext={projectRef:d.projectRef,scope:{actorId:own.actorId,tournamentId:p.id,eventId:p.eventId},sessionId:own.sessionId,mode:p.mode as BootstrapMode};
  if(method==='source'){const source=readBootstrapOffer(captured,target,now());return source?d.json(source):fail(409,'source_unavailable');}
  if(!isBootstrapWire(wire))return fail(400,'invalid_request');const result=readBootstrapResult(captured,target,wire);return result?d.json(result,{status:result.status==='accepted'?200:result.status==='retry_exact'?503:409}):fail(503,'outcome_unknown');
 });}
 return{sourceGET:handler('source'),writePOST:handler('write'),operationPOST:handler('operation')};
}
