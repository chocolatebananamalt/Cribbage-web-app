import type{NextRequest}from'next/server';
import{createClient}from'../../../../../../../lib/supabase/server';
import{apiJson,readSmallJson,withApiFailureBoundary}from'../../../../../../../lib/api/route-boundary';
import{isSameOriginRequest}from'../../../../../../../lib/api/same-origin';
import{createManualRosterRecoveryHandlerV22}from'../../../../../../../lib/api/manual-roster-recovery-handler-v22';
export const dynamic='force-dynamic';
const handle=createManualRosterRecoveryHandlerV22(createClient);
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){return withApiFailureBoundary(async()=>{
 if(!isSameOriginRequest(request))return apiJson({error:'invalid_origin'},{status:403});
 const value=await readSmallJson(request),{id}=await params;const result=await handle(request,id,{value});return apiJson(await result.json(),{status:result.status});
});}
