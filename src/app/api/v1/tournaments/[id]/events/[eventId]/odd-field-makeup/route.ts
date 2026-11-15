import { type NextRequest } from 'next/server';
import { apiJson, readLargeJson, requireVerifiedSubject, withApiFailureBoundary } from '../../../../../../../../lib/api/route-boundary';
import { isSameOriginRequest } from '../../../../../../../../lib/api/same-origin';
import { isUuid } from '../../../../../../../../lib/api/validation';
import { isOddFieldMakeupRequest, isOddFieldMakeupResult, isOddFieldMakeupWorkspace, isOddFieldMakeupRejected } from '../../../../../../../../lib/api/odd-field-makeup';
import { createClient } from '../../../../../../../../lib/supabase/server';
import { createServerOnlyAdminClient } from '../../../../../../../../lib/supabase/private-admin';
export async function GET(_request: NextRequest,{params}:{params:Promise<{id:string;eventId:string}>}) {
  return withApiFailureBoundary(async()=>{
    const {id,eventId}=await params;
    if(!isUuid(id)||!isUuid(eventId))return apiJson({error:'invalid_target'},{status:400});
    const actor=await requireVerifiedSubject(await createClient());
    if(!actor)return apiJson({error:'unauthorized'},{status:401});
    const {data,error}=await createServerOnlyAdminClient().rpc('get_odd_field_makeup_workspace_v1',{a:actor,t:id,e:eventId});
    return error?apiJson({error:'makeup_unavailable'},{status:503}):data===null?apiJson({error:'forbidden'},{status:403})
      :isOddFieldMakeupWorkspace(data,id,eventId)?apiJson(data):apiJson({error:'makeup_unavailable'},{status:503});
  });
}
export async function POST(request: NextRequest,{params}:{params:Promise<{id:string;eventId:string}>}) {
  return withApiFailureBoundary(async()=>{
    if(!isSameOriginRequest(request))return apiJson({error:'invalid_origin'},{status:403});
    const {id,eventId}=await params,op=request.headers.get('x-idempotency-key'),body=await readLargeJson(request);
    if(!isUuid(id)||!isUuid(eventId)||!isUuid(op)||!isOddFieldMakeupRequest(body))return apiJson({error:'invalid_makeup_request'},{status:400});
    const actor=await requireVerifiedSubject(await createClient());
    if(!actor)return apiJson({error:'unauthorized'},{status:401});
    const {data,error}=await createServerOnlyAdminClient().rpc('publish_odd_field_makeup_schedule_v1',{a:actor,t:id,e:eventId,request:body,op});
    return error?apiJson({error:'makeup_unavailable'},{status:503}):data===null?apiJson({error:'forbidden'},{status:403})
      :isOddFieldMakeupResult(data,eventId)||isOddFieldMakeupRejected(data)?apiJson(data,{status:data.status==='rejected'?409:200}):apiJson({error:'makeup_unavailable'},{status:503});
  });
}
