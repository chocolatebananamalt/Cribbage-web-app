import{NextRequest}from'next/server';
import{createClient}from'../../../../../../lib/supabase/server';
import{isUuid}from'../../../../../../lib/api/validation';
import{requireVerifiedSubject}from'../../../../../../lib/api/verified-subject';
import{apiJson,readSmallJson,withApiFailureBoundary}from'../../../../../../lib/api/route-boundary';
import{isSameOriginRequest}from'../../../../../../lib/api/same-origin';
import{stationaryRegistrationEnabledV1,isStationaryReviewRequestV1,isStationaryReviewReceiptV1,isStationaryReviewSupersededV1}from'../../../../../../lib/api/stationary-registration-v1';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return withApiFailureBoundary(async()=>{
  if(!stationaryRegistrationEnabledV1())return apiJson({error:'not_found'},{status:404});
  if(!isSameOriginRequest(request))return apiJson({error:'invalid_origin'},{status:403});
  const{id}=await params,body=await readSmallJson(request);
  if(!isUuid(id)||!isStationaryReviewRequestV1(body))return apiJson({error:'invalid_request'},{status:400});
  const client=await createClient(),before=await requireVerifiedSubject(client);
  if(before!==body.expectedActorId)return apiJson({error:'identity_changed'},{status:403});
  const r=await client.rpc('review_registration_stationary_request_v1',{p_tournament_id:id,p_claim_id:body.claimId,p_expected_revision:body.expectedRevision,p_decision:body.decision,p_reason:body.reason,p_operation_id:body.operationId});
  if(await requireVerifiedSubject(client)!==before)return apiJson({error:'outcome_unknown'},{status:503});
  if(!r.error&&isStationaryReviewReceiptV1(r.data,body,id))return apiJson(r.data);
  if(!r.error&&isStationaryReviewSupersededV1(r.data,body,id))return apiJson(r.data,{status:409});
  return apiJson({error:'outcome_unknown'},{status:503});
 });
}
