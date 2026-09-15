import { NextRequest } from "next/server";
import { isSeatingDirectory } from "../../../../../../lib/api/team-operations";
import { apiJson,requireVerifiedSubject,withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){return withApiFailureBoundary(async()=>{const{id}=await params,eventId=request.nextUrl.searchParams.get("event"),query=request.nextUrl.searchParams.get("q")?.trim()??"";if(!isUuid(id)||!eventId||!isUuid(eventId)||query.length>160)return apiJson({error:"event_required"},{status:400});const actor=await requireVerifiedSubject(await createClient());if(!actor)return apiJson({error:"unauthorized"},{status:401});const result=await createServerOnlyAdminClient().rpc("get_tournament_seating_directory_v2",{p_actor_id:actor,p_tournament_id:id,p_event_id:eventId,p_query:query});if(result.error)return apiJson({error:"operation_unavailable"},{status:503});return isSeatingDirectory(result.data)?apiJson(result.data):apiJson({error:"not_found"},{status:404});});}
