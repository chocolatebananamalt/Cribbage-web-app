import { NextRequest } from "next/server";
import { apiJson,readLargeJson,requireVerifiedSubject,withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isSameOriginRequest } from "../../../../../../../../lib/api/same-origin";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";

const isBody=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const uuidArray=(value:unknown)=>Array.isArray(value)&&value.length>0&&value.every(isUuid);

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string;eventId:string}>}){return withApiFailureBoundary(async()=>{
  if(!isSameOriginRequest(request))return apiJson({error:"invalid_origin"},{status:403});
  const {id,eventId}=await params,body=await readLargeJson(request);
  if(!isUuid(id)||!isUuid(eventId)||!isBody(body)||!Number.isSafeInteger(body.cutoffRank)||!uuidArray(body.tiedTeamEntryIds)||!uuidArray(body.selectedTeamEntryIds)||typeof body.ruleBasis!=="string"||typeof body.reason!=="string"||!isUuid(body.resolutionId)||!isUuid(body.operationId))return apiJson({error:"invalid_tie_resolution"},{status:400});
  const actor=await requireVerifiedSubject(await createClient());if(!actor)return apiJson({error:"unauthorized"},{status:401});
  const result=await createServerOnlyAdminClient().rpc("resolve_event_team_qualification_tie_v1",{p_actor_id:actor,p_tournament_id:id,p_event_id:eventId,p_resolution_id:body.resolutionId,p_cutoff_rank:body.cutoffRank,p_tied_team_entry_ids:body.tiedTeamEntryIds,p_selected_team_entry_ids:body.selectedTeamEntryIds,p_rule_basis:body.ruleBasis,p_reason:body.reason,p_operation_id:body.operationId});
  if(result.error)return apiJson({error:"operation_unavailable"},{status:503});
  const value=result.data as Record<string,unknown>|null;
  return apiJson(value??{error:"operation_unavailable"},{status:value?.status==="rejected"?409:200});
});}
