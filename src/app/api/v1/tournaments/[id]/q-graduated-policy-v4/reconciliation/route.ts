import {type NextRequest} from 'next/server';
import {apiJson,readLargeJson,requireVerifiedSubject,withApiFailureBoundary} from '../../../../../../../lib/api/route-boundary';
import {isSameOriginRequest} from '../../../../../../../lib/api/same-origin';
import {isUuid} from '../../../../../../../lib/api/validation';
import {isQGraduatedReconciliationRequestV4,isQGraduatedPolicyResultV4,qGraduatedPolicyResultMatchesV4} from '../../../../../../../lib/api/q-graduated-policy-v4';
import {createClient} from '../../../../../../../lib/supabase/server';
import {createServerOnlyAdminClient} from '../../../../../../../lib/supabase/private-admin';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){return withApiFailureBoundary(async()=>{
 if(!isSameOriginRequest(request))return apiJson({error:'invalid_origin'},{status:403});
 const{id}=await params,body=await readLargeJson(request);if(!isUuid(id)||!isQGraduatedReconciliationRequestV4(body))return apiJson({error:'invalid_request'},{status:400});
 const actor=await requireVerifiedSubject(await createClient());if(!actor)return apiJson({error:'unauthorized'},{status:401});
 const{data,error}=await createServerOnlyAdminClient().rpc('get_q_operating_reconciliation_v4',{p_actor_id:actor,p_tournament_id:id,p_operation_id:body.operationId,p_request:body.request});
 if(error)return apiJson({error:'q_operating_unavailable'},{status:503});if(data===null)return apiJson({error:'forbidden'},{status:403});
 return data?.authorized===true&&Object.keys(data).sort().join()==='authorized,result'&&(data.result===null||isQGraduatedPolicyResultV4(data.result)&&qGraduatedPolicyResultMatchesV4(data.result,body.request))?apiJson(data):apiJson({error:'q_operating_unavailable'},{status:503});
});}
