/** Only a schema-cache miss naming this exact new RPC permits legacy mode. */
export function isMissingSideSetupCapability(error: unknown): boolean {
 if (!error || typeof error !== 'object') return false;
 const e=error as Record<string,unknown>;
 return e.code==='PGRST202' && typeof e.message==='string' && /\bget_side_pool_setup_type_capability_v1\b/.test(e.message);
}
export function isSideSetupCapability(value: unknown): boolean {
 if (!value || typeof value!=='object' || Array.isArray(value)) return false;
 const v=value as Record<string,unknown>;
 return Object.keys(v).length===2 && v.status==='available' && v.version===1;
}
export function sideSetupCapabilityState(result: {data:unknown;error:unknown}): 'ready' | 'legacy' | 'unavailable' {
 if (result.error) return result.data == null && isMissingSideSetupCapability(result.error) ? 'legacy' : 'unavailable';
 return isSideSetupCapability(result.data) ? 'ready' : 'unavailable';
}
export function isLegacySideRequestUnbound(value: unknown): boolean {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
 const item=value as Record<string,unknown>;
 return Object.keys(item).length===1 && item.error==='legacy_side_request_unbound';
}
export function isSidePoolRequestConflict(value: unknown): boolean {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
 const item=value as Record<string,unknown>;
 return Object.keys(item).length===1 && item.error==='side_pool_request_conflict';
}
