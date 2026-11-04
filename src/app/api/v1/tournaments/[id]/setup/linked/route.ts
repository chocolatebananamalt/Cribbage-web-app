import { NextRequest } from 'next/server';
import { apiJson, readLargeJson, requireVerifiedSubject, withApiFailureBoundary } from '../../../../../../../lib/api/route-boundary';
import { isSameOriginRequest } from '../../../../../../../lib/api/same-origin';
import { isUuid } from '../../../../../../../lib/api/validation';
import { isRejectedSetup, isSetupSaveRequest, isSetupWorkspace } from '../../../../../../../lib/api/setup';
import { isLinkedSetupSaveEnvelope, isLinkedSetupSaveResult, isSetupEventLinksWorkspace, isRejectedLinkedSetup } from '../../../../../../../lib/api/setup-event-links';
import { isSetupSaveWithUnchangedLegacySides } from '../../../../../../../lib/setup-legacy-side-validation';
import { createClient } from '../../../../../../../lib/supabase/server';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    const { id } = await params;
    if (!isUuid(id)) return apiJson({ error: 'invalid_tournament' }, { status: 400 });
    const client = await createClient();
    if (!await requireVerifiedSubject(client)) return apiJson({ error: 'unauthorized' }, { status: 401 });
    const { data, error } = await client.rpc('get_setup_event_links_v1', { p_tournament_id: id });
    if (error || !isSetupEventLinksWorkspace(data)) return apiJson({ error: 'operation_unavailable' }, { status: 503 });
    return apiJson(data);
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: 'invalid_origin' }, { status: 403 });
    const { id } = await params;
    const body = await readLargeJson(request);
    if (!isUuid(id) || !isLinkedSetupSaveEnvelope(body)) return apiJson({ error: 'invalid_setup' }, { status: 400 });
    const client = await createClient();
    if (!await requireVerifiedSubject(client)) return apiJson({ error: 'unauthorized' }, { status: 401 });
    if (!isSetupSaveRequest(body.request)) {
      // Reconcile the entire original envelope before consulting a newer baseline.
      // This read-only operation cannot accept a new write or a different graph.
      const prior = await client.rpc('reconcile_linked_setup_save_v1', { p_tournament_id: id, p_envelope: body });
      if (prior.error) return apiJson({ error: 'operation_unavailable' }, { status: 503 });
      if (prior.data !== null) return isLinkedSetupSaveResult(prior.data, body) ? apiJson(prior.data) : apiJson({ error: 'operation_unavailable' }, { status: 503 });
      const existing = await client.rpc('get_tournament_setup_workspace', { p_tournament_id: id });
      if (existing.error || !isSetupWorkspace(existing.data)) return apiJson({ error: 'operation_unavailable' }, { status: 503 });
      if (!isSetupSaveWithUnchangedLegacySides(body.request, existing.data.current)) return apiJson({ error: 'invalid_setup' }, { status: 400 });
    }
    const { data, error } = await client.rpc('save_linked_tournament_setup_v1', { p_tournament_id: id, p_envelope: body });
    if (error) return apiJson({ error: 'operation_unavailable' }, { status: 503 });
    if (isLinkedSetupSaveResult(data, body)) return apiJson(data);
    if (isRejectedSetup(data) || isRejectedLinkedSetup(data)) return apiJson(data, { status: 409 });
    return apiJson({ error: 'operation_unavailable' }, { status: 503 });
  });
}


