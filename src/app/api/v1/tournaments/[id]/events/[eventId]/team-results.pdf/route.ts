import { NextRequest,NextResponse } from "next/server";
import { isTeamResults } from "../../../../../../../../lib/api/team-results";
import { apiJson,requireVerifiedSubject,withApiFailureBoundary } from "../../../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../../../lib/api/validation";
import { buildTeamResultsPdf } from "../../../../../../../../lib/results/team-results-pdf";
import { createServerOnlyAdminClient } from "../../../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../../../lib/supabase/server";

export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string;eventId:string}>}){return withApiFailureBoundary(async()=>{const{id,eventId}=await params;if(!isUuid(id)||!isUuid(eventId))return apiJson({error:"invalid_request"},{status:400});const actor=await requireVerifiedSubject(await createClient());if(!actor)return apiJson({error:"unauthorized"},{status:401});const result=await createServerOnlyAdminClient().rpc("get_event_team_results_v1",{p_actor_id:actor,p_tournament_id:id,p_event_id:eventId});if(result.error)return apiJson({error:"operation_unavailable"},{status:503});if(!isTeamResults(result.data))return apiJson({error:"not_found"},{status:404});const bytes=await buildTeamResultsPdf(result.data.tournamentName,result.data);return new NextResponse(new Uint8Array(bytes),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="team-results-${eventId}.pdf"`,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});});}
