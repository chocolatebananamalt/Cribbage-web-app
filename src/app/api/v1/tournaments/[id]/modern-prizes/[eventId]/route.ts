import{NextRequest}from'next/server';
import{apiJson,readMediumJson,withApiFailureBoundary}from'../../../../../../../lib/api/route-boundary';
import{createClient}from'../../../../../../../lib/supabase/server';
import{isSameOriginRequest}from'../../../../../../../lib/api/same-origin';
import{isUuid}from'../../../../../../../lib/api/validation';
import{createModernPrizeJournalTransportV2}from'../../../../../../../lib/api/modern-prize-journal-transport-v2';
import{isModernPrizeScopeV2,readModernPrizeAttemptV2}from'../../../../../../../lib/finance/modern-prize-journal-contract-v2';
import{modernPrizeReadRoutesEnabledV2,modernPrizeWritesVerifiedV2}from'../../../../../../../lib/finance/modern-prize-journal-gates-v2';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string;eventId:string}>}){return withApiFailureBoundary(async()=>{
 if(!modernPrizeReadRoutesEnabledV2())return apiJson({error:'not_found'},{status:404});
 const{id,eventId}=await params,actorId=request.nextUrl.searchParams.get('actor');const scope={actorId,tournamentId:id,eventId};if(!isModernPrizeScopeV2(scope))return apiJson({error:'invalid_request'},{status:400});
 const client=await createClient(),port=createModernPrizeJournalTransportV2(client,scope,{read:modernPrizeReadRoutesEnabledV2,writeVerified:modernPrizeWritesVerifiedV2});return apiJson(await port.read());
 });}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string;eventId:string}>}){return withApiFailureBoundary(async()=>{
 if(!modernPrizeReadRoutesEnabledV2())return apiJson({error:'not_found'},{status:404});
 if(!isSameOriginRequest(request))return apiJson({error:'invalid_origin'},{status:403});
 if(!modernPrizeWritesVerifiedV2())return apiJson({error:'database_verification_pending'},{status:503});
 const{id,eventId}=await params,body=await readMediumJson(request);if(!isUuid(id)||!isUuid(eventId)||!body||typeof body!=='object'||!('scope'in body)||!isModernPrizeScopeV2(body.scope)||body.scope.tournamentId!==id||body.scope.eventId!==eventId)return apiJson({error:'invalid_request'},{status:400});
 const attempt=readModernPrizeAttemptV2(body,body.scope);if(!attempt)return apiJson({error:'invalid_request'},{status:400});
 const client=await createClient(),port=createModernPrizeJournalTransportV2(client,attempt.scope,{read:modernPrizeReadRoutesEnabledV2,writeVerified:modernPrizeWritesVerifiedV2});const reply=await port.save(attempt);return apiJson(reply,{status:reply.status==='accepted'?200:reply.status==='rejected'?409:503});
 });}
