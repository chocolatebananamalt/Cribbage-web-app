import { NextRequest, NextResponse } from "next/server";
import { isSidePoolWorkspace } from "../../../../../../lib/api/side-pools";
import { apiJson, requireVerifiedSubject, withApiFailureBoundary } from "../../../../../../lib/api/route-boundary";
import { isUuid } from "../../../../../../lib/api/validation";
import { buildSidePoolReportPdf } from "../../../../../../lib/results/side-pool-report-pdf";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
import { createClient } from "../../../../../../lib/supabase/server";
export async function GET(_request: NextRequest,{params}:{params:Promise<{id:string}>}) { return withApiFailureBoundary(async()=>{ const {id}=await params; if(!isUuid(id)) return apiJson({error:"invalid_tournament"},{status:400}); const actor=await requireVerifiedSubject(await createClient()); if(!actor) return apiJson({error:"unauthorized"},{status:401}); const {data,error}=await createServerOnlyAdminClient().rpc("get_event_side_pool_director_export_v1",{p_actor_id:actor,p_tournament_id:id}); if(error||!isSidePoolWorkspace(data)) return apiJson({error:"side_pool_report_unavailable"},{status:error?503:403}); const pdf=await buildSidePoolReportPdf(data); return new NextResponse(new Uint8Array(pdf),{headers:{"cache-control":"private, no-store","content-disposition":`attachment; filename="side-pools-${id}.pdf"`,"content-type":"application/pdf","x-content-type-options":"nosniff"}}); }); }
