import type{NextRequest}from'next/server';
import{createClient}from'../../../../../../../../lib/supabase/server';
import{createServerOnlyAdminClient}from'../../../../../../../../lib/supabase/private-admin';
import{closeoutTerminalReadEnabledV18,closeoutTerminalWriteEnabledV18,createCloseoutTerminalHandlerV18}from'../../../../../../../../lib/finance/closeout-terminal-handler-v18';
import{apiJson,readLargeJson}from'../../../../../../../../lib/api/route-boundary';
import{isSameOriginRequest}from'../../../../../../../../lib/api/same-origin';
import{closeoutRuntimePinsV20,createCloseoutCapabilityVerifierV19}from'../../../../../../../../lib/finance/closeout-runtime-v20';
export const dynamic='force-dynamic';
const handle=createCloseoutTerminalHandlerV18({readEnabled:closeoutTerminalReadEnabledV18,writeEnabled:closeoutTerminalWriteEnabledV18,normal:createClient,service:createServerOnlyAdminClient,verifyCapability:createCloseoutCapabilityVerifierV19(createServerOnlyAdminClient,closeoutRuntimePinsV20)});
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string;eventId:string}>}){
 if(!closeoutTerminalReadEnabledV18())return apiJson({error:'not_found'},{status:404});
 if(!isSameOriginRequest(request))return apiJson({error:'invalid_origin'},{status:403});
 try{const value=await readLargeJson(request);if(value===null)return apiJson({error:'invalid_request'},{status:400});const response=await handle(request,await params,{value});return apiJson(await response.json(),{status:response.status});}
 catch{return apiJson({error:'temporarily_unavailable'},{status:503});}
}
