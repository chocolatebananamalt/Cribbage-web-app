import { isQPoolMembershipWorkspace } from './q-pool-membership.ts';
import { isPrizeScheduleWorkspace, type PrizeScheduleWorkspace } from './prize-schedule.ts';
import { isDirectorPrizeScheduleV3 } from '../results/prize-schedule.ts';
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
export function accountingEntryForSchedule(value: unknown, schedules: unknown, tournamentId: string, eventId: string): 'prize-accounting-v8' | 'q-accounting-v6' | 'no-q-accounting-v7' | null {
 const old = accountingEntryForMembership(value, tournamentId, eventId);
 if (!old || !Array.isArray(schedules) || schedules.length > 32 || !schedules.every(s => !!s && typeof s === 'object' && isPrizeScheduleWorkspace(s, tournamentId, s.clientRowId))) return null;
 const matches = (schedules as PrizeScheduleWorkspace[]).filter(s => s.eventId === eventId);
 if (matches.length > 1) return null;
 const current = matches[0];
 if (!current?.versions[0] || !isDirectorPrizeScheduleV3(current.versions[0].schedule)) return old;
 return current.activated && current.settingsCurrent ? 'prize-accounting-v8' : null;
}
export async function getAccountingEntry(admin: RpcClient, actorId: string, tournamentId: string, eventId: string, schedules?: PrizeScheduleWorkspace[] | null) {
 try {
  const { data, error } = await admin.rpc('get_q_pool_membership_workspace_v1', { p_actor_id: actorId, p_tournament_id: tournamentId });
  return error ? null : schedules === undefined ? accountingEntryForMembership(data, tournamentId, eventId) : accountingEntryForSchedule(data, schedules, tournamentId, eventId);
 } catch { return null; }
}
