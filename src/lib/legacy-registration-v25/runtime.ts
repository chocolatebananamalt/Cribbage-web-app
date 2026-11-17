import 'server-only';
import type { NextRequest } from 'next/server';
import { createClient } from '../supabase/server';
import { createServerOnlyAdminClient } from '../supabase/private-admin';
import { identityAccessV5 } from '../identity-v5/provider';
import { requireVerifiedIdentity } from '../api/verified-subject';
import { isSameOriginRequest } from '../api/same-origin';
import { legacyRegistrationEnabledV25 } from './gate';
import { createLegacyRegistrationHandlersV25 } from './handlers';
import { legacyRegistrationProviderV25 } from './provider';

export async function legacyRegistrationRouteV25(r: Request, tid: string, action: string, body?: unknown) {
  if (!legacyRegistrationEnabledV25()) return Response.json({error:'legacy_identity_registration_unavailable'},{status:503,headers:{'cache-control':'private, no-store'}});
  const user=await createClient();
  return createLegacyRegistrationHandlersV25({enabled:legacyRegistrationEnabledV25,sameOrigin:request=>isSameOriginRequest(request as NextRequest),access:async(_r,t)=>{
    const a=await identityAccessV5(user,t),last=await requireVerifiedIdentity(user);
    return a&&last?.subject===a.actorId&&last.sessionId===a.sessionId?a:null;
  },provider:legacyRegistrationProviderV25(createServerOnlyAdminClient(),process.env.CRIBBAGE_LEGACY_REGISTRATION_V25_CATALOG_HASH!)})(r,tid,action,body);
}
