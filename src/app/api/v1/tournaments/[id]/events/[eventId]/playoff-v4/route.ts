import { type NextRequest } from 'next/server';
import { apiJson, readMediumJson, requireVerifiedSubject, withApiFailureBoundary } from '../../../../../../../../lib/api/route-boundary';
import { isSameOriginRequest } from '../../../../../../../../lib/api/same-origin';
import { isUuid } from '../../../../../../../../lib/api/validation';
import { isPlayoffV4Request, isPlayoffV4Workspace, isPlayoffV4Result } from '../../../../../../../../lib/api/playoff-outcome-v4';
import { createServerOnlyAdminClient } from '../../../../../../../../lib/supabase/private-admin';
import { createClient } from '../../../../../../../../lib/supabase/server';
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
 return withApiFailureBoundary(async () => {
  const { id, eventId } = await params;
  if (!isUuid(id) || !isUuid(eventId)) return apiJson({ error: 'invalid_playoff' }, { status: 400 });
  const actor = await requireVerifiedSubject(await createClient());
  if (!actor) return apiJson({ error: 'unauthorized' }, { status: 401 });
  const { data, error } = await createServerOnlyAdminClient().rpc('get_standard_singles_playoff_outcome_workspace_v4', { p_actor_id: actor, p_tournament_id: id, p_event_id: eventId });
  return error ? apiJson({ error: 'playoff_unavailable' }, { status: 503 }) : data === null ? apiJson({ error: 'forbidden' }, { status: 403 }) : isPlayoffV4Workspace(data, id, eventId) ? apiJson(data) : apiJson({ error: 'playoff_unavailable' }, { status: 503 });
 });
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
 return withApiFailureBoundary(async () => {
  if (!isSameOriginRequest(request)) return apiJson({ error: 'invalid_origin' }, { status: 403 });
  const { id, eventId } = await params, operationId = request.headers.get('x-idempotency-key'), body = await readMediumJson(request);
  if (!isUuid(id) || !isUuid(eventId) || !isUuid(operationId) || !isPlayoffV4Request(body)) return apiJson({ error: 'invalid_playoff' }, { status: 400 });
  const actor = await requireVerifiedSubject(await createClient());
  if (!actor) return apiJson({ error: 'unauthorized' }, { status: 401 });
  const { data, error } = await createServerOnlyAdminClient().rpc('record_standard_singles_playoff_outcomes_v4', { p_actor_id: actor, p_tournament_id: id, p_event_id: eventId, p_request: body, p_operation_id: operationId });
  return error ? apiJson({ error: 'playoff_unavailable' }, { status: 503 }) : data === null ? apiJson({ error: 'forbidden' }, { status: 403 }) : isPlayoffV4Result(data, id, eventId) ? apiJson(data, { status: data.status === 'rejected' ? 409 : 200 }) : apiJson({ error: 'playoff_unavailable' }, { status: 503 });
 });
}
