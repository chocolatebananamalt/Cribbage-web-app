import { NextRequest } from "next/server";
import { isSeatingDirectory } from "../../../../../../lib/api/team-operations";
import { apiJson,requireVerifiedSubject,withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../lib/api/validation";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";

// The player branch of get_tournament_seating_directory_unbounded_v1 builds
// 'isSelf' as `l.profile_id=p_actor_id` over a LEFT JOIN on
// app.roster_account_links (0174, carried through 0178). A seated player with
// no app account has a null on the left of that comparison, so isSelf comes
// back null rather than false, the guard's `typeof isSelf === "boolean"`
// fails, and the whole directory 404s. Verified live: the RPC returned five
// correct rows and the route answered not_found.
//
// That is the common case, not an edge: a paper player never links an account,
// so one of them is enough to take the printed seating list out entirely. For
// an unlinked roster entry the answer is definitively false, so normalising is
// exact rather than lenient. The SQL should coalesce at source; this keeps the
// screen working without a production function change.
function normalizeIsSelf(value:unknown):unknown{
  if(!value||typeof value!=="object"||Array.isArray(value))return value;
  const record=value as Record<string,unknown>;
  if(!Array.isArray(record.entries))return value;
  return {...record,entries:record.entries.map((entry)=>entry&&typeof entry==="object"&&!Array.isArray(entry)&&(entry as Record<string,unknown>).isSelf===null
    ?{...entry as Record<string,unknown>,isSelf:false}
    :entry)};
}
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){return withApiFailureBoundary(async()=>{const{id}=await params,eventId=request.nextUrl.searchParams.get("event"),query=request.nextUrl.searchParams.get("q")?.trim()??"";if(!isUuid(id)||!eventId||!isUuid(eventId)||query.length>160)return apiJson({error:"event_required"},{status:400});const actor=await requireVerifiedSubject(await createClient());if(!actor)return apiJson({error:"unauthorized"},{status:401});const result=await createServerOnlyAdminClient().rpc("get_tournament_seating_directory_v2",{p_actor_id:actor,p_tournament_id:id,p_event_id:eventId,p_query:query});if(result.error)return apiJson({error:"operation_unavailable"},{status:503});return isSeatingDirectory(normalizeIsSelf(result.data))?apiJson(normalizeIsSelf(result.data)):apiJson({error:"not_found"},{status:404});});}
