import{type NextRequest}from'next/server';
import{apiJson,readLargeJson,requireVerifiedSubject,withApiFailureBoundary}from'../../../../../../../lib/api/route-boundary';
import{isSameOriginRequest}from'../../../../../../../lib/api/same-origin';
import{isUuid}from'../../../../../../../lib/api/validation';
import{isSideGraduatedMutationV2,isSideGraduatedResultV2,sideGraduatedResultMatchesV2}from'../../../../../../../lib/api/side-pool-graduated-v2';
import{createClient}from'../../../../../../../lib/supabase/server';
import{createServerOnlyAdminClient}from'../../../../../../../lib/supabase/private-admin';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){return withApiFailureBoundary(async()=>{
 if(!isSameOriginRequest(request))return apiJson({error:'invalid_origin'},{status:403});const{id}=await params,raw:unknown=await readLargeJson(request);
 if(!isUuid(id)||!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).sort().join()!=='mutation,operationId')return apiJson({error:'invalid_request'},{status:400});
 const body=raw as Record<string,unknown>;if(!isUuid(body.operationId)||!isSideGraduatedMutationV2(body.mutation))return apiJson({error:'invalid_request'},{status:400});
 const actor=await requireVerifiedSubject(await createClient());if(!actor)return apiJson({error:'unauthorized'},{status:401});const b=body.mutation;
 const{data,error}=await createServerOnlyAdminClient().rpc('get_side_pool_graduated_reconciliation_v2',{p_actor_id:actor,p_tournament_id:id,p_event_id:b.eventId,p_pool_id:b.poolId,p_request:b.request,p_operation_id:body.operationId,p_action:b.action});
 if(error)return apiJson({error:'side_formula_unavailable'},{status:503});if(data===null)return apiJson({error:'forbidden'},{status:403});return data?.authorized===true&&Object.keys(data).sort().join()==='authorized,result'&&(data.result===null||isSideGraduatedResultV2(data.result)&&sideGraduatedResultMatchesV2(data.result,b))?apiJson(data):apiJson({error:'side_formula_unavailable'},{status:503});
});}
