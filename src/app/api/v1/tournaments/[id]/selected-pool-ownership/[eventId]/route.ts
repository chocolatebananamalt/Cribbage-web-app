import{NextRequest}from'next/server';
import{apiJson,readMediumJson,withApiFailureBoundary}from'../../../../../../../lib/api/route-boundary';
import{isSameOriginRequest}from'../../../../../../../lib/api/same-origin';
import{createClient}from'../../../../../../../lib/supabase/server';
import{createServerOnlyAdminClient}from'../../../../../../../lib/supabase/private-admin';
import{isModernPrizeScopeV2,type ModernPrizeScopeV2}from'../../../../../../../lib/finance/modern-prize-journal-contract-v2';
import{selectedStepOwnershipRoutesEnabledV3 as enabled,selectedStepOwnershipWritesVerifiedV3 as verified}from'../../../../../../../lib/finance/selected-step-ownership-gates-v3';
import{readSelectedStepOwnershipAttemptV3}from'../../../../../../../lib/finance/selected-step-ownership-contract-v3';
import{createSelectedStepOwnershipProviderV3}from'../../../../../../../lib/finance/selected-step-ownership-provider-v3';
export const dynamic='force-dynamic';
async function context(scope:ModernPrizeScopeV2){
 const authenticated=await createClient();async function authorized(){const b=await authenticated.auth.getUser();if(b.error||b.data.user?.id!==scope.actorId)return false;const r=await authenticated.rpc('get_tournament_role',{p_tournament_id:scope.tournamentId});const a=await authenticated.auth.getUser();return !r.error&&r.data==='director'&&!a.error&&a.data.user?.id===scope.actorId&&enabled();}
 if(!await authorized())return null;
 // Construct privileged client only after independent normal-session authorization.
 const service=createServerOnlyAdminClient();return{authenticated,serviceRpc:(name:string,args:Record<string,unknown>)=>service.rpc(name,args),scope,enabled,writesVerified:verified,authorized};
}
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string;eventId:string}>}){return withApiFailureBoundary(async()=>{
 if(!enabled())return apiJson({error:'not_found'},{status:404});const{id,eventId}=await params,scope={actorId:request.nextUrl.searchParams.get('actor'),tournamentId:id,eventId};if(!isModernPrizeScopeV2(scope))return apiJson({error:'invalid_request'},{status:400});const c=await context(scope);if(!c)return apiJson({error:'permission_required'},{status:403});const result=await createSelectedStepOwnershipProviderV3(c).read();if(!await c.authorized())return apiJson({error:'permission_required'},{status:403});return apiJson(result);
 });}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string;eventId:string}>}){return withApiFailureBoundary(async()=>{
 if(!enabled())return apiJson({error:'not_found'},{status:404});if(!isSameOriginRequest(request))return apiJson({error:'invalid_origin'},{status:403});if(!verified())return apiJson({error:'database_verification_pending'},{status:503});const{id,eventId}=await params,body=await readMediumJson(request);
 if(!body||typeof body!=='object'||Reflect.ownKeys(body).length!==2||!('attempt'in body)||!('action'in body)||!['record','recover'].includes(body.action as string)||!body.attempt||typeof body.attempt!=='object'||!('scope'in body.attempt)||!isModernPrizeScopeV2(body.attempt.scope)||body.attempt.scope.tournamentId!==id||body.attempt.scope.eventId!==eventId)return apiJson({error:'invalid_request'},{status:400});const a=readSelectedStepOwnershipAttemptV3(body.attempt,body.attempt.scope);if(!a)return apiJson({error:'invalid_request'},{status:400});const c=await context(a.scope);if(!c)return apiJson({error:'permission_required'},{status:403});const result=await createSelectedStepOwnershipProviderV3(c).send(a,body.action==='recover');if(!await c.authorized())return apiJson({error:'outcome_unknown'},{status:503});return apiJson(result,{status:result.status==='accepted'?200:result.status==='rejected'?409:503});
 });}
