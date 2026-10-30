import { isQPoolMembershipWorkspace } from './q-pool-membership.ts';
type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
/** Navigation only. The destination independently revalidates its full scope.
 * Zero configured pools are explicit server facts, never a failed-read default.
 * The membership writer itself deliberately does not support zero-pool entries.
 */
export function accountingEntryForMembership(value: unknown, tournamentId: string, eventId: string): 'q-accounting-v6' | 'no-q-accounting-v7' | null {
 if (!isQPoolMembershipWorkspace(value, tournamentId) || value.eventId !== eventId) return null;
 if (value.pools.length === 0) return 'no-q-accounting-v7';
 return value.supported && value.pools.length <= 2 ? 'q-accounting-v6' : null;
}
export async function getAccountingEntry(admin: RpcClient, actorId: string, tournamentId: string, eventId: string) {
 try {
  const { data, error } = await admin.rpc('get_q_pool_membership_workspace_v1', { p_actor_id: actorId, p_tournament_id: tournamentId });
  return error ? null : accountingEntryForMembership(data, tournamentId, eventId);
 } catch { return null; }
}
