import { type NextRequest } from 'next/server';
import { apiJson, readLargeJson, requireVerifiedSubject, withApiFailureBoundary } from '../../../../../../../../../lib/api/route-boundary';
import { isSameOriginRequest } from '../../../../../../../../../lib/api/same-origin';
import { isUuid } from '../../../../../../../../../lib/api/validation';
import { isOddFieldMakeupRequest, isOddFieldMakeupResult, isOddFieldMakeupRejected } from '../../../../../../../../../lib/api/odd-field-makeup';
import { createClient } from '../../../../../../../../../lib/supabase/server';
import { createServerOnlyAdminClient } from '../../../../../../../../../lib/supabase/private-admin';
export async function POST(request: NextRequest,{params}:{params:Promise<{id:string;eventId:string}>}) {
  return withApiFailureBoundary(async()=>{
    if(!isSameOriginRequest(request))return apiJson({error:'invalid_origin'},{status:403});
    const {id,eventId}=await params,body=await readLargeJson(request);
    if(!isUuid(id)||!isUuid(eventId)||!body||typeof body!=='object'||Array.isArray(body)
      ||Object.keys(body).sort().join()!=='operationId,request')return apiJson({error:'invalid_request'},{status:400});
    const b=body as {operationId:unknown;request:unknown};
    if(!isUuid(b.operationId)||!isOddFieldMakeupRequest(b.request))return apiJson({error:'invalid_request'},{status:400});
    const actor=await requireVerifiedSubject(await createClient());
    if(!actor)return apiJson({error:'unauthorized'},{status:401});
    const {data,error}=await createServerOnlyAdminClient().rpc('reconcile_odd_field_makeup_schedule_v1',{a:actor,t:id,e:eventId,request:b.request,op:b.operationId});
    if(error)return apiJson({error:'makeup_unavailable'},{status:503});
    if(data===null)return apiJson({error:'forbidden'},{status:403});
    return data?.authorized===true&&Object.keys(data).sort().join()==='authorized,result'
      &&(data.result===null||isOddFieldMakeupResult(data.result,eventId)||isOddFieldMakeupRejected(data.result))?apiJson(data):apiJson({error:'makeup_unavailable'},{status:503});
  });
}
