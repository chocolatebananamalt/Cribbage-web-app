import { exactV5, scopedV5, canonicalV5, type IdentityAccessV5 } from '../identity-v5/contracts.ts';
import type { RpcV5 } from '../identity-v5/provider.ts';
import { hashV25, readProfileV8, type RegistrationV25 } from './contracts.ts';

/** New versioned public contracts are intentionally NOT granted/installed by the local proposal. */
export function legacyRegistrationProviderV25(client: RpcV5, expectedCatalogHash: string) {
  const call = async (name: string, a: IdentityAccessV5, parameters: Record<string,unknown> = {}) => {
    const r = await client.rpc(name,{p_actor_id:a.actorId,p_session_id:a.sessionId,p_tournament_id:a.tournamentId,...parameters});
    if (r.error) throw Error('legacy_identity_provider_unavailable');
    return r.data;
  };
  return {
    capability: async (a: IdentityAccessV5) => {
      const v = await call('get_legacy_roster_identity_capability_v25',a);
      return exactV5(v,['kind','actorId','sessionId','tournamentId','version','available','catalogHash','writesEnabled']) && scopedV5(v,a) && v.kind === 'legacy-roster-identity-capability-v25' && v.version === 25 && v.available === true && hashV25(expectedCatalogHash) && v.catalogHash === expectedCatalogHash && typeof v.writesEnabled === 'boolean' ? {writesEnabled:v.writesEnabled} : null;
    },
    prepare: (a: IdentityAccessV5, entry: unknown, address: unknown) => call('prepare_legacy_roster_identity_v25',a,{p_entry:entry,p_address:address}),
    write: (a: IdentityAccessV5, operationId: string, requestHash: string, request: RegistrationV25) => call('write_legacy_roster_identity_v25',a,{p_operation_id:operationId,p_request_hash:requestHash,p_request_text:canonicalV5(request)}),
    reconcile: (a: IdentityAccessV5, operationId: string, requestHash: string) => call('reconcile_legacy_roster_identity_v25',a,{p_operation_id:operationId,p_request_hash:requestHash}),
    profile: async (a: IdentityAccessV5, rosterEntryId: string) => readProfileV8(await call('read_legacy_adoption_profile_v8',a,{p_roster_entry_id:rosterEntryId}),a,rosterEntryId),
  };
}
