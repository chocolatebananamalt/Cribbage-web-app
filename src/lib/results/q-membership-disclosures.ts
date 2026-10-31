import { isQOperatingWorkspaceV4, graduatedQMethodV4 } from '../api/q-graduated-policy-v4.ts';
import { balancedQMethodV3 } from '../api/q-operating-schedules.ts';
import { qChartSchedules } from './q-chart-catalog.ts';

/** Shared server projection: balanced policies must reach the membership client
 * so its consent reference binds the exact frozen policy ID. */
export function qMembershipOperatingDisclosures(value: unknown, tournamentId: string): Array<{id:string;poolVersionId:string;disclosureText:string}> | null {
  if (!isQOperatingWorkspaceV4(value,tournamentId)) return null;
  return value.policies.map(p => ({id:p.id,poolVersionId:p.poolVersionId,
    disclosureText:p.method === 'equal-paid-playoff-qualifiers-v2'
      ? 'Equal Q: fully paid playoff qualifiers share this named pool. If none qualify, contributions become unpaid refund obligations. Remainder cents follow finalized qualification order. No money moves.'
      : (p.method === balancedQMethodV3 || p.method === graduatedQMethodV4)
        ? `Graduated Q: observed ACC raw weights with this app's fund-conserving $5 largest-remainder rounding, not ACC endorsement. Recipient count is rounded up from fully paid named-pool entrants divided by ${p.ratio}; paid nonqualifiers can receive awards by Q card rank. Unsupported cash ties block. No money moves.`
        : `Graduated Q: ${qChartSchedules.find(s=>s.id===p.scheduleId)?.label ?? p.scheduleId}. Recipient count is rounded up from paid pool entrants divided by ${p.ratio}; paid nonqualifiers can receive awards by Q card rank. Exact chart amounts apply; unsupported cells require director review. No money moves.`}));
}
