import { isQPoolMembershipWorkspace } from './q-pool-membership.ts';
import { isPrizeScheduleWorkspace, type PrizeScheduleWorkspace } from './prize-schedule.ts';
import { isPrizeAccountingWorkspaceV9 } from './prize-accounting-v9.ts';
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
export function accountingEntryForSchedule(value: unknown, schedules: unknown, tournamentId: string, eventId: string, accounting: unknown): 'prize-accounting-v9' | 'prize-accounting-v8' | 'q-accounting-v6' | 'no-q-accounting-v7' | null {
 const old = accountingEntryForMembership(value, tournamentId, eventId);
 if (!old || !Array.isArray(schedules) || schedules.length > 32 || !schedules.every(s => !!s && typeof s === 'object' && isPrizeScheduleWorkspace(s, tournamentId, s.clientRowId))) return null;
 const matches = (schedules as PrizeScheduleWorkspace[]).filter(s => s.eventId === eventId);
 if (matches.length > 1) return null;
 const current = matches[0];
 if (!current?.versions[0] || !isDirectorPrizeScheduleV3(current.versions[0].schedule)) return old;
 if (!current.activated || !current.settingsCurrent || !isPrizeAccountingWorkspaceV9(accounting, tournamentId, eventId)) return null;
 // Canonical Side history includes retired pools; active definitions cannot prove absence.
 // Pending reviews still select V9, whose destination enforces every financial blocker.
 if (!accounting.regularRule || accounting.regularRule.scheduleVersionId !== current.versions[0].scheduleId || accounting.regularRule.scheduleVersion !== current.versions[0].version) return null;
 return accounting.sideReviews.length ? 'prize-accounting-v9' : 'prize-accounting-v8';
}
export async function getAccountingEntry(admin: RpcClient, actorId: string, tournamentId: string, eventId: string, schedules?: PrizeScheduleWorkspace[] | null) {
 try {
  const { data, error } = await admin.rpc('get_q_pool_membership_workspace_v1', { p_actor_id: actorId, p_tournament_id: tournamentId });
  if (error) return null;
  if (schedules === undefined) return accountingEntryForMembership(data, tournamentId, eventId);
  const preliminary = accountingEntryForSchedule(data, schedules, tournamentId, eventId, null);
  if (preliminary) return preliminary;
  // Existing scoped read only: no policy adoption or accounting writes for navigation.
  const accounting = await admin.rpc('get_prize_accounting_workspace_v9', { p_actor_id: actorId, p_tournament_id: tournamentId, p_event_id: eventId });
  return accounting.error ? null : accountingEntryForSchedule(data, schedules, tournamentId, eventId, accounting.data);
 } catch { return null; }
}
