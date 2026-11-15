import type{NextRequest}from'next/server';
import{apiJson,readMediumJson}from'../../../../../../../lib/api/route-boundary';
import{createClient}from'../../../../../../../lib/supabase/server';
import{createServerOnlyAdminClient}from'../../../../../../../lib/supabase/private-admin';
import{requireVerifiedIdentity}from'../../../../../../../lib/api/verified-subject';
import{isSameOriginRequest}from'../../../../../../../lib/api/same-origin';
import{isModernPrizeScopeV2,readModernPrizeAttemptV2}from'../../../../../../../lib/finance/modern-prize-journal-contract-v2';
import{createSelectedStepAwardTransportV3,selectedStepAwardRoutesEnabledV3,selectedStepAwardWritesVerifiedV3}from'../../../../../../../lib/api/selected-step-award-transport-v3';
export const dynamic='force-dynamic';
type Params={id:string;eventId:string};
async function run(r:NextRequest,p:Params,write:boolean){
 if(!selectedStepAwardRoutesEnabledV3())return apiJson({error:'not_found'},{status:404});
 if(write&&(!isSameOriginRequest(r)||!selectedStepAwardWritesVerifiedV3()))return apiJson({error:'recording_unavailable'},{status:403});
 try{const normal=await createClient(),identity=await requireVerifiedIdentity(normal),user=await normal.auth.getUser();if(!identity||user.error||user.data.user?.id!==identity.subject)return apiJson({error:'unauthorized'},{status:401});
  const scope={actorId:identity.subject,tournamentId:p.id,eventId:p.eventId};if(!isModernPrizeScopeV2(scope))return apiJson({error:'invalid_request'},{status:400});
  let attempt:ReturnType<typeof readModernPrizeAttemptV2>=null;
  if(write){attempt=readModernPrizeAttemptV2(await readMediumJson(r),scope);if(!attempt)return apiJson({error:'invalid_request'},{status:400});}
  else if(r.nextUrl.searchParams.get('actor')!==identity.subject)return apiJson({error:'unauthorized'},{status:401});
  const role=await normal.rpc('get_tournament_role',{p_tournament_id:p.id});if(role.error||role.data!=='director')return apiJson({error:'forbidden'},{status:403});
  const service=createServerOnlyAdminClient(),port=createSelectedStepAwardTransportV3(normal,(name,args)=>service.rpc(name,args),scope,{read:selectedStepAwardRoutesEnabledV3,write:selectedStepAwardWritesVerifiedV3});
  const value=write?await port.save(attempt):await port.read(),after=await requireVerifiedIdentity(normal);
  if(!after||after.subject!==identity.subject||after.sessionId!==identity.sessionId)return apiJson({error:'unauthorized'},{status:401});return apiJson(value);
 }catch{return apiJson({error:'temporarily_unavailable'},{status:503});}
}
export async function GET(r:NextRequest,{params}:{params:Promise<Params>}){return run(r,await params,false);}
export async function POST(r:NextRequest,{params}:{params:Promise<Params>}){return run(r,await params,true);}
