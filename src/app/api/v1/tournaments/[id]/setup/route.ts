import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";
import { isSetupOfficialChoices, isSetupSaveRequest, isSavedSetup, isRejectedSetup, isSetupWorkspace } from "../../../../../../lib/api/setup";
import { isUuid } from "../../../../../../lib/api/validation";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
import { decideSetupRead } from "../../../../../../lib/api/setup-read-decision";
import { readLargeJson } from "../../../../../../lib/api/bounded-json";
import { createServerOnlyAdminClient } from "../../../../../../lib/supabase/private-admin";
const privateNoStore = { "cache-control": "private, no-store" };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "invalid_tournament" }, { status: 400, headers: privateNoStore });
  try {
    const supabase = await createClient(); const { data: claims, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError) return NextResponse.json({ error: "operation_unavailable" }, { status: 503, headers: privateNoStore });
    if (!claims?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: privateNoStore });
    const [workspaceResult, choicesResult] = await Promise.all([
      supabase.rpc("get_tournament_setup_workspace", { p_tournament_id: id }),
      supabase.rpc("get_tournament_setup_official_choices", { p_tournament_id: id }),
    ]);
    const decision = decideSetupRead({ rpcFailure: !!workspaceResult.error || !!choicesResult.error, workspace: workspaceResult.data, officialChoices: choicesResult.data, valid: isSetupWorkspace(workspaceResult.data) && isSetupOfficialChoices(choicesResult.data) });
    if (decision.status !== 200) return NextResponse.json({ error: decision.error }, { status: decision.status, headers: privateNoStore });
    return NextResponse.json({ workspace: workspaceResult.data, officialChoices: choicesResult.data }, { headers: privateNoStore });
  } catch {
    return NextResponse.json({ error: "operation_unavailable" }, { status: 503, headers: privateNoStore });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers: privateNoStore });
  const { id } = await params; const body = await readLargeJson(request);
  if (body === null) return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: privateNoStore });
  if (!isUuid(id) || !isSetupSaveRequest(body)) return NextResponse.json({ error: "invalid_setup" }, { status: 400, headers: privateNoStore });
  try {
    const supabase = await createClient(); const { data: claims, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError) return NextResponse.json({ error: "operation_unavailable" }, { status: 503, headers: privateNoStore });
    if (!claims?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: privateNoStore });
    // Legacy setup storage deliberately owns the core event fields. Side Pool
    // definitions are versioned separately and are materialized only once an
    // event becomes active, so they cannot be mistaken for Q Pools.
    const corePayload = { ...body.payload, events: body.payload.events.map((event) => {
      const coreEvent = { ...event }; Reflect.deleteProperty(coreEvent, "sidePools"); return coreEvent;
    }) };
    Reflect.deleteProperty(corePayload, "tournamentDirectorPublicName");
    const { data, error } = await supabase.rpc("save_tournament_setup_version", { p_tournament_id: id, p_expected_version: body.expectedVersion, p_payload: corePayload, p_idempotency_key: body.idempotencyKey });
    if (error) return NextResponse.json({ error: "operation_unavailable" }, { status: 503, headers: privateNoStore });
    if (isSavedSetup(data, body)) {
      const sidePools = await createServerOnlyAdminClient().rpc("configure_tournament_setup_side_pools_v1", { p_actor_id: claims.claims.sub, p_tournament_id: id, p_setup_revision_id: data.revisionId, p_events: body.payload.events });
      if (sidePools.error || !sidePools.data || typeof sidePools.data !== "object" || (sidePools.data as Record<string, unknown>).status !== "setup_side_pools_configured") return NextResponse.json({ error: "operation_unavailable" }, { status: 503, headers: privateNoStore });
      const publicContact = await createServerOnlyAdminClient().rpc("configure_tournament_public_contact_from_setup_v1", { p_actor_id: claims.claims.sub, p_tournament_id: id, p_setup_revision_id: data.revisionId, p_director_name: body.payload.tournamentDirectorPublicName });
      if (publicContact.error || !publicContact.data || typeof publicContact.data !== "object" || (publicContact.data as Record<string, unknown>).status !== "public_contact_configured") return NextResponse.json({ error: "operation_unavailable" }, { status: 503, headers: privateNoStore });
      return NextResponse.json(data, { headers: privateNoStore });
    }
    if (isRejectedSetup(data)) return NextResponse.json(data, { status: 409, headers: privateNoStore });
    return NextResponse.json({ error: "operation_unavailable" }, { status: 503, headers: privateNoStore });
  } catch {
    return NextResponse.json({ error: "operation_unavailable" }, { status: 503, headers: privateNoStore });
  }
}
