import { type NextRequest } from 'next/server';
import { apiJson, readMediumJson, requireVerifiedSubject, withApiFailureBoundary } from '../../../../../../../../../lib/api/route-boundary';
import { isSameOriginRequest } from '../../../../../../../../../lib/api/same-origin';
import { isUuid } from '../../../../../../../../../lib/api/validation';
import { isPlayoffV4ReconciliationRequest, isPlayoffV4Reconciliation } from '../../../../../../../../../lib/api/playoff-outcome-v4';
import { createServerOnlyAdminClient } from '../../../../../../../../../lib/supabase/private-admin';
import { createClient } from '../../../../../../../../../lib/supabase/server';
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
 return withApiFailureBoundary(async () => {
  if (!isSameOriginRequest(request)) return apiJson({ error: 'invalid_origin' }, { status: 403 });
  const { id, eventId } = await params, body = await readMediumJson(request);
  if (!isUuid(id) || !isUuid(eventId) || !isPlayoffV4ReconciliationRequest(body)) return apiJson({ error: 'invalid_request' }, { status: 400 });
  const actor = await requireVerifiedSubject(await createClient());
  if (!actor) return apiJson({ error: 'unauthorized' }, { status: 401 });
  const { data, error } = await createServerOnlyAdminClient().rpc('get_standard_singles_playoff_outcome_reconciliation_v4', { p_actor_id: actor, p_tournament_id: id, p_event_id: eventId, p_operation_id: body.operationId, p_request: body.request });
  return error ? apiJson({ error: 'playoff_unavailable' }, { status: 503 }) : data === null ? apiJson({ error: 'forbidden' }, { status: 403 }) : isPlayoffV4Reconciliation(data, id, eventId) ? apiJson(data) : apiJson({ error: 'playoff_unavailable' }, { status: 503 });
 });
}
