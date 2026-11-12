import { NextRequest } from 'next/server';
import { apiJson, readMediumJson, requireVerifiedSubject, withApiFailureBoundary } from '../../../../../../../../lib/api/route-boundary';
import { isSameOriginRequest } from '../../../../../../../../lib/api/same-origin';
import { isUuid } from '../../../../../../../../lib/api/validation';
import { isRejectedSetupActivation, isSetupActivationRequest } from '../../../../../../../../lib/api/setup-activation';
import { isLinkedSetupActivationResult, isRejectedLinkedSetup } from '../../../../../../../../lib/api/setup-event-links';
import { createClient } from '../../../../../../../../lib/supabase/server';
import { createServerOnlyAdminClient } from '../../../../../../../../lib/supabase/private-admin';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiFailureBoundary(async () => {
    if (!isSameOriginRequest(request)) return apiJson({ error: 'invalid_origin' }, { status: 403 });
    const { id } = await params;
    const body = await readMediumJson(request);
    if (!isUuid(id) || !body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 2 || !('request' in body) || !('associationHash' in body) || !isSetupActivationRequest(body.request) || typeof body.associationHash !== 'string' || !/^[a-f0-9]{64}$/.test(body.associationHash)) return apiJson({ error: 'invalid_activation' }, { status: 400 });
    const subject = await requireVerifiedSubject(await createClient());
    if (!isUuid(subject)) return apiJson({ error: 'unauthorized' }, { status: 401 });
    const { data, error } = await createServerOnlyAdminClient().rpc('finalize_linked_tournament_setup_v1', { p_actor_id: subject, p_tournament_id: id, p_envelope: body });
    if (error) return apiJson({ error: 'operation_unavailable' }, { status: 503 });
    if (isLinkedSetupActivationResult(data, body.request, body.associationHash)) return apiJson(data);
    if (isRejectedSetupActivation(data) || isRejectedLinkedSetup(data)) return apiJson(data, { status: 409 });
    return apiJson({ error: 'operation_unavailable' }, { status: 503 });
  });
}

