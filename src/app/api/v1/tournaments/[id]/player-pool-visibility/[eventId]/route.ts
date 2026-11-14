import{NextRequest}from'next/server';
import{apiJson,readMediumJson,withApiFailureBoundary}from'../../../../../../../lib/api/route-boundary';
import{isSameOriginRequest}from'../../../../../../../lib/api/same-origin';
import{createClient}from'../../../../../../../lib/supabase/server';
import{isModernPrizeScopeV2,type ModernPrizeScopeV2}from'../../../../../../../lib/finance/modern-prize-journal-contract-v2';
import{playerPoolVisibilityPageEnabledV1 as enabled,playerPoolVisibilityWritesVerifiedV1 as verified}from'../../../../../../../lib/results/player-pool-totals-gates-v1';
import{readPoolVisibilityAttemptV1}from'../../../../../../../lib/results/player-pool-visibility-contract-v1';
import{createPoolVisibilityProviderV1}from'../../../../../../../lib/results/player-pool-visibility-provider-v1';
export const dynamic='force-dynamic';
async function context(scope:ModernPrizeScopeV2){
 const client=await createClient();async function authorized(){const b=await client.auth.getUser();if(b.error||b.data.user?.id!==scope.actorId)return false;const r=await client.rpc('get_tournament_role',{p_tournament_id:scope.tournamentId});const a=await client.auth.getUser();return !r.error&&r.data==='director'&&!a.error&&a.data.user?.id===scope.actorId&&enabled();}
 if(!await authorized())return null;
 return{client,scope,enabled,writesVerified:verified,authorized};
}
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string;eventId:string}>}){return withApiFailureBoundary(async()=>{
 if(!enabled())return apiJson({error:'not_found'},{status:404});const{id,eventId}=await params,scope={actorId:request.nextUrl.searchParams.get('actor'),tournamentId:id,eventId};if(!isModernPrizeScopeV2(scope))return apiJson({error:'invalid_request'},{status:400});const c=await context(scope);if(!c)return apiJson({error:'permission_required'},{status:403});const result=await createPoolVisibilityProviderV1(c).read();if(!await c.authorized())return apiJson({error:'permission_required'},{status:403});return apiJson(result);
 });}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string;eventId:string}>}){return withApiFailureBoundary(async()=>{
 if(!enabled())return apiJson({error:'not_found'},{status:404});if(!isSameOriginRequest(request))return apiJson({error:'invalid_origin'},{status:403});if(!verified())return apiJson({error:'database_verification_pending'},{status:503});const{id,eventId}=await params,body=await readMediumJson(request);
 if(!body||typeof body!=='object'||Reflect.ownKeys(body).length!==2||!('attempt'in body)||!('action'in body)||!['record','recover','resolve_stale'].includes(body.action as string)||!body.attempt||typeof body.attempt!=='object'||!('scope'in body.attempt)||!isModernPrizeScopeV2(body.attempt.scope)||body.attempt.scope.tournamentId!==id||body.attempt.scope.eventId!==eventId)return apiJson({error:'invalid_request'},{status:400});const a=readPoolVisibilityAttemptV1(body.attempt,body.attempt.scope);if(!a)return apiJson({error:'invalid_request'},{status:400});const c=await context(a.scope);if(!c)return apiJson({error:'permission_required'},{status:403});const result=await createPoolVisibilityProviderV1(c).send(a,body.action==='resolve_stale'?'resolve_stale':body.action==='recover');if(!await c.authorized())return apiJson({error:'outcome_unknown'},{status:503});return apiJson(result,{status:result.status==='accepted'||result.status==='closed'?200:result.status==='rejected'?409:503});
 });}
