import{type NextRequest}from'next/server';
import{apiJson,readLargeJson,requireVerifiedSubject,withApiFailureBoundary}from'../../../../../../lib/api/route-boundary';
import{isSameOriginRequest}from'../../../../../../lib/api/same-origin';
import{isUuid}from'../../../../../../lib/api/validation';
import{isSideGraduatedMutationV2,isSideGraduatedResultV2,isSideGraduatedWorkspaceV2,sideGraduatedResultMatchesV2}from'../../../../../../lib/api/side-pool-graduated-v2';
import{createClient}from'../../../../../../lib/supabase/server';
import{createServerOnlyAdminClient}from'../../../../../../lib/supabase/private-admin';
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){return withApiFailureBoundary(async()=>{
 const{id}=await params;if(!isUuid(id))return apiJson({error:'invalid_tournament'},{status:400});const actor=await requireVerifiedSubject(await createClient());if(!actor)return apiJson({error:'unauthorized'},{status:401});
 const{data,error}=await createServerOnlyAdminClient().rpc('get_side_pool_graduated_workspace_v2',{p_actor_id:actor,p_tournament_id:id});return error?apiJson({error:'side_formula_unavailable'},{status:503}):data===null?apiJson({error:'forbidden'},{status:403}):isSideGraduatedWorkspaceV2(data,id)?apiJson(data):apiJson({error:'side_formula_unavailable'},{status:503});
});}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){return withApiFailureBoundary(async()=>{
 if(!isSameOriginRequest(request))return apiJson({error:'invalid_origin'},{status:403});const{id}=await params,body=await readLargeJson(request),op=request.headers.get('x-idempotency-key');
 if(!isUuid(id)||!isUuid(op)||!isSideGraduatedMutationV2(body))return apiJson({error:'invalid_side_formula_request'},{status:400});const actor=await requireVerifiedSubject(await createClient());if(!actor)return apiJson({error:'unauthorized'},{status:401});
 const name=body.action==='policy'?'save_side_pool_graduated_policy_v2':body.action==='election'?'save_side_pool_graduated_election_v2':'record_side_pool_amount_review_v2';
 const{data,error}=await createServerOnlyAdminClient().rpc(name,{p_actor_id:actor,p_tournament_id:id,p_event_id:body.eventId,p_pool_id:body.poolId,p_request:body.request,p_operation_id:op});
 return error?apiJson({error:'side_formula_unavailable'},{status:503}):data===null?apiJson({error:'forbidden'},{status:403}):isSideGraduatedResultV2(data)&&sideGraduatedResultMatchesV2(data,body)?apiJson(data,{status:data.status==='rejected'?409:200}):apiJson({error:'side_formula_unavailable'},{status:503});
});}
