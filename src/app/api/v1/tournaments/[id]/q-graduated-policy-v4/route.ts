import {type NextRequest} from 'next/server';
import {apiJson,readLargeJson,requireVerifiedSubject,withApiFailureBoundary} from '../../../../../../lib/api/route-boundary';
import {isSameOriginRequest} from '../../../../../../lib/api/same-origin';
import {isUuid} from '../../../../../../lib/api/validation';
import {isQGraduatedPolicyRequestV4,isQGraduatedPolicyResultV4,isQOperatingWorkspaceV4,qGraduatedPolicyResultMatchesV4} from '../../../../../../lib/api/q-graduated-policy-v4';
import {createClient} from '../../../../../../lib/supabase/server';
import {createServerOnlyAdminClient} from '../../../../../../lib/supabase/private-admin';
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){return withApiFailureBoundary(async()=>{
 const{id}=await params;if(!isUuid(id))return apiJson({error:'invalid_tournament'},{status:400});
 const actor=await requireVerifiedSubject(await createClient());if(!actor)return apiJson({error:'unauthorized'},{status:401});
 const{data,error}=await createServerOnlyAdminClient().rpc('get_q_operating_workspace_v2',{p_actor_id:actor,p_tournament_id:id});
 return error?apiJson({error:'q_operating_unavailable'},{status:503}):data===null?apiJson({error:'forbidden'},{status:403}):isQOperatingWorkspaceV4(data,id)?apiJson(data):apiJson({error:'q_operating_unavailable'},{status:503});
});}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){return withApiFailureBoundary(async()=>{
 if(!isSameOriginRequest(request))return apiJson({error:'invalid_origin'},{status:403});
 const{id}=await params,op=request.headers.get('x-idempotency-key'),body=await readLargeJson(request);
 if(!isUuid(id)||!isUuid(op)||!isQGraduatedPolicyRequestV4(body))return apiJson({error:'invalid_q_operating_request'},{status:400});
 const actor=await requireVerifiedSubject(await createClient());if(!actor)return apiJson({error:'unauthorized'},{status:401});
 const{data,error}=await createServerOnlyAdminClient().rpc('save_q_operating_policy_v4',{p_actor_id:actor,p_tournament_id:id,p_request:body,p_operation_id:op});
 return error?apiJson({error:'q_operating_unavailable'},{status:503}):data===null?apiJson({error:'forbidden'},{status:403}):isQGraduatedPolicyResultV4(data)&&qGraduatedPolicyResultMatchesV4(data,body)?apiJson(data,{status:data.status==='rejected'?409:200}):apiJson({error:'q_operating_unavailable'},{status:503});
});}
