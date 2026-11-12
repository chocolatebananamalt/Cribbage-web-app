import type {NativeMixedReviewContextV1} from '../finance/native-mixed-review-read-v1.ts';
import 'server-only';
import {readNativeMixedReviewEnvelopeV1} from '../finance/native-mixed-review-read-v1.ts';
export const nativeMixedReviewReadEnabledV1=()=>false;
type Client={auth:{getUser:()=>Promise<{data:{user:{id:string}|null}|null;error:unknown}>;getClaims:()=>Promise<{data:{claims?:{sub?:unknown;session_id?:unknown;exp?:unknown;iss?:unknown}}|null;error:unknown}>};rpc:(name:string,args:Record<string,string>)=>PromiseLike<{data:unknown;error:unknown}>};
type Context={params:Promise<{id:string;eventId:string}>};
const ref='nnhcnvksxgxnpvdqjgpg',url=`https://${ref}.supabase.co`,uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
/** Two own-cookie resolver captures must agree. SQL resolves/locks current Start,
 * root, sealed funding and cohort; no browser-selected Start or admin client. */
export function createNativeMixedReviewHandlersV1<R extends Response>(d:{enabled?:()=>boolean;projectRef:string;projectUrl:string;client:()=>Promise<Client>;json:(v:unknown,init?:ResponseInit)=>R;boundary:(run:()=>Promise<R>)=>Promise<R>;now?:()=>number}){
 return{GET:(request:Request,context:Context)=>d.boundary(async()=>{
  const enabled=d.enabled??nativeMixedReviewReadEnabledV1,fail=(status:number,error:string)=>d.json({error},{status});if(enabled()!==true)return fail(404,'not_found');
  if(request.method!=='GET')return fail(405,'method_not_allowed');if(d.projectRef!==ref||d.projectUrl!==url)return fail(403,'invalid_target');
  const p=await context.params,actorId=request.headers.get('x-expected-actor-id');if(!uuid(p.id)||!uuid(p.eventId)||!uuid(actorId))return fail(400,'invalid_scope');
  const client=await d.client();const own=async(expectedSession?:string)=>{const u=await client.auth.getUser(),j=await client.auth.getClaims(),c=j.data?.claims;
   if(u.error||j.error||u.data?.user?.id!==actorId||c?.sub!==actorId||!uuid(c.session_id)||c.iss!==url+'/auth/v1'||typeof c.exp!=='number'||!Number.isFinite(c.exp*1000)||c.exp*1000<=(d.now??Date.now)()||(expectedSession!==undefined&&c.session_id!==expectedSession)||enabled()!==true)return null;
   const role=await client.rpc('get_tournament_role',{p_tournament_id:p.id});return !role.error&&(role.data==='director'||role.data==='co_director')&&enabled()===true?c.session_id:null;};
  const sessionId=await own();if(!sessionId)return fail(403,'permission_required');const scope:NativeMixedReviewContextV1={projectRef:ref,scope:{actorId,tournamentId:p.id,eventId:p.eventId},sessionId};
  const args={p_tournament_id:p.id,p_event_id:p.eventId};
  const first=await client.rpc('get_native_mixed_qualification_review_provider_v1',args);if(first.error)return fail(503,'review_unavailable');const before=readNativeMixedReviewEnvelopeV1(first.data,scope);if(!before)return fail(409,'review_unavailable');
  if(!await own(sessionId))return fail(403,'permission_required');
  const second=await client.rpc('get_native_mixed_qualification_review_provider_v1',args);if(second.error)return fail(503,'review_unavailable');const after=readNativeMixedReviewEnvelopeV1(second.data,scope);
  if(!after||canonical(before)!==canonical(after))return fail(409,'review_source_changed');if(!await own(sessionId)||enabled()!==true)return fail(403,'permission_required');return d.json(after);
 })};
}
