import { legacyRegistrationRouteV25 } from '../../../../../../../lib/legacy-registration-v25/runtime';
import { apiJson, readMediumJson, withApiFailureBoundary } from '../../../../../../../lib/api/route-boundary';
import { isSameOriginRequest } from '../../../../../../../lib/api/same-origin';
import type { NextRequest } from 'next/server';
type Context = {params:Promise<{id:string;action:string}>};
async function respond(r:Request, context:Context, body?:unknown) {
  const {id,action}=await context.params;
  const response=await legacyRegistrationRouteV25(r,id,action,body);
  return apiJson(await response.json(),{status:response.status});
}
export async function GET(r:Request,context:Context) {
  return withApiFailureBoundary(()=>respond(r,context));
}
export async function POST(r:NextRequest,context:Context) {
  return withApiFailureBoundary(async()=>{
    if(!isSameOriginRequest(r))return apiJson({error:'invalid_origin'},{status:403});
    const body=await readMediumJson(r);
    if(body===null)return apiJson({error:'invalid_request'},{status:400});
    return respond(r,context,body);
  });
}
