import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../../lib/supabase/server";
import { isSetupOfficialChoices, isSetupSaveRequest, isSavedSetup, isRejectedSetup, isSetupWorkspace } from "../../../../../../lib/api/setup";
import { isUuid } from "../../../../../../lib/api/validation";
import { isSameOriginRequest } from "../../../../../../lib/api/same-origin";
const privateNoStore = { "cache-control": "private, no-store" };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "invalid_tournament" }, { status: 400, headers: privateNoStore });
  const supabase = await createClient(); const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: privateNoStore });
  const [workspaceResult, choicesResult] = await Promise.all([
    supabase.rpc("get_tournament_setup_workspace", { p_tournament_id: id }),
    supabase.rpc("get_tournament_setup_official_choices", { p_tournament_id: id }),
  ]);
  if (workspaceResult.error || choicesResult.error) {
    return NextResponse.json({ error: "operation_unavailable" }, { status: 503, headers: privateNoStore });
  }
  if (!isSetupWorkspace(workspaceResult.data) || !isSetupOfficialChoices(choicesResult.data)) {
    return NextResponse.json({ error: "setup_unavailable" }, { status: 404, headers: privateNoStore });
  }
  return NextResponse.json({ workspace: workspaceResult.data, officialChoices: choicesResult.data }, { headers: privateNoStore });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers: privateNoStore });
  const { id } = await params; let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: privateNoStore }); }
  if (!isUuid(id) || !isSetupSaveRequest(body)) return NextResponse.json({ error: "invalid_setup" }, { status: 400, headers: privateNoStore });
  const supabase = await createClient(); const { data: claims } = await supabase.auth.getClaims(); if (!claims?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: privateNoStore });
  const { data, error } = await supabase.rpc("save_tournament_setup_version", { p_tournament_id: id, p_expected_version: body.expectedVersion, p_payload: body.payload, p_idempotency_key: body.idempotencyKey });
  if (error) return NextResponse.json({ error: "operation_unavailable" }, { status: 503, headers: privateNoStore });
  if (isSavedSetup(data, body)) return NextResponse.json(data, { headers: privateNoStore });
  if (isRejectedSetup(data)) return NextResponse.json(data, { status: 409, headers: privateNoStore });
  return NextResponse.json({ error: "operation_unavailable" }, { status: 503, headers: privateNoStore });
}
