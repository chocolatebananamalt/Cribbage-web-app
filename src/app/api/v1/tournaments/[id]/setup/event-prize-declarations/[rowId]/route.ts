import {NextRequest} from 'next/server';
import {isEventPrizeDeclarationRequest,isEventPrizeDeclarationWorkspace,isEventPrizeDeclarationSaved,isEventPrizeDeclarationRejected} from '../../../../../../../../lib/api/event-prize-declaration';
import {apiJson,readMediumJson,requireVerifiedSubject,withApiFailureBoundary} from '../../../../../../../../lib/api/route-boundary';
import {isSameOriginRequest} from '../../../../../../../../lib/api/same-origin';
import {isUuid} from '../../../../../../../../lib/api/validation';
import {createClient} from '../../../../../../../../lib/supabase/server';
import {createServerOnlyAdminClient} from '../../../../../../../../lib/supabase/private-admin';
type Context={params:Promise<{id:string;rowId:string}>};
export async function GET(_request:NextRequest,{params}:Context){return withApiFailureBoundary(async()=>{
 const {id,rowId}=await params;
 if(!isUuid(id)||!isUuid(rowId))return apiJson({error:'invalid_declaration'},{status:400});
 const actor=await requireVerifiedSubject(await createClient());if(!actor)return apiJson({error:'unauthorized'},{status:401});
 const {data,error}=await createServerOnlyAdminClient().rpc('get_event_prize_declaration_v2',{p_actor_id:actor,p_tournament_id:id,p_client_row_id:rowId});
 return !error&&isEventPrizeDeclarationWorkspace(data,id,rowId)?apiJson(data):apiJson({error:'declaration_unavailable'},{status:503});
});}
export async function POST(request:NextRequest,{params}:Context){return withApiFailureBoundary(async()=>{
 if(!isSameOriginRequest(request))return apiJson({error:'invalid_origin'},{status:403});
 const {id,rowId}=await params,body=await readMediumJson(request),operation=request.headers.get('x-idempotency-key')??'';
 if(!isUuid(id)||!isUuid(rowId)||!isUuid(operation)||!isEventPrizeDeclarationRequest(body))return apiJson({error:'invalid_declaration'},{status:400});
 const actor=await requireVerifiedSubject(await createClient());if(!actor)return apiJson({error:'unauthorized'},{status:401});
 const {data,error}=await createServerOnlyAdminClient().rpc('save_event_prize_declaration_v2',{p_actor_id:actor,p_tournament_id:id,p_client_row_id:rowId,p_request:body,p_operation_id:operation});
 if(!error&&isEventPrizeDeclarationSaved(data,id,rowId,body))return apiJson(data);
 if(!error&&isEventPrizeDeclarationRejected(data))return apiJson(data,{status:409});
 return apiJson({error:'declaration_unavailable'},{status:503});
});}
