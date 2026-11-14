import type{NextRequest}from'next/server';
import{apiJson,readMediumJson}from'../../../../../../../lib/api/route-boundary';
import{createClient}from'../../../../../../../lib/supabase/server';
import{createServerOnlyAdminClient}from'../../../../../../../lib/supabase/private-admin';
import{requireVerifiedIdentity}from'../../../../../../../lib/api/verified-subject';
import{isSameOriginRequest}from'../../../../../../../lib/api/same-origin';
import{fundObjectV3 as obj,fundUuidV3 as uuid,readFundAttemptV3}from'../../../../../../../lib/finance/selected-step-fund-contract-v3';
import{createSelectedStepFundTransportV3,selectedStepFundEnabledV3,selectedStepFundWritesVerifiedV3}from'../../../../../../../lib/api/selected-step-fund-transport-v3';
export const dynamic='force-dynamic';type Params={id:string;eventId:string};
async function run(r:NextRequest,p:Params,post:boolean){
 if(!selectedStepFundEnabledV3())return apiJson({error:'not_found'},{status:404});if(post&&!isSameOriginRequest(r))return apiJson({error:'forbidden'},{status:403});
 try{const normal=await createClient(),identity=await requireVerifiedIdentity(normal),user=await normal.auth.getUser();if(!identity||user.error||user.data.user?.id!==identity.subject)return apiJson({error:'unauthorized'},{status:401});const scope={actorId:identity.subject,tournamentId:p.id,eventId:p.eventId};if(!Object.values(scope).every(uuid))return apiJson({error:'invalid_request'},{status:400});
 const body=post?await readMediumJson(r):null,attempt=post&&obj(body)?readFundAttemptV3(body.attempt,scope):null;
 if(post&&(!obj(body)||!attempt||!['save','check'].includes(String(body.action))||Object.keys(body).length!==2))return apiJson({error:'invalid_request'},{status:400});if(post&&obj(body)&&body.action==='save'&&!selectedStepFundWritesVerifiedV3())return apiJson({error:'recording_unavailable'},{status:403});
 const expense=r.nextUrl.searchParams.get('expense');if(!post&&(r.nextUrl.searchParams.get('actor')!==identity.subject||expense!==null&&!uuid(expense)))return apiJson({error:'invalid_request'},{status:400});
 const role=await normal.rpc('get_tournament_role',{p_tournament_id:p.id});if(role.error||role.data!=='director')return apiJson({error:'forbidden'},{status:403});
 const service=createServerOnlyAdminClient(),port=createSelectedStepFundTransportV3(normal,(name,args)=>service.rpc(name,args),scope,{read:selectedStepFundEnabledV3,write:selectedStepFundWritesVerifiedV3});
 const result=post&&obj(body)?body.action==='check'?await port.check(attempt):await port.save(attempt):await port.read(expense),after=await requireVerifiedIdentity(normal);if(!after||after.subject!==identity.subject||after.sessionId!==identity.sessionId)return apiJson({error:'unauthorized'},{status:401});return apiJson(result);
 }catch{return apiJson({error:'temporarily_unavailable'},{status:503});}}
export async function GET(r:NextRequest,{params}:{params:Promise<Params>}){return run(r,await params,false);}
export async function POST(r:NextRequest,{params}:{params:Promise<Params>}){return run(r,await params,true);}
