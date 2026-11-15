import type { PrizeScheduleWorkspace } from "../api/prize-schedule.ts";

export function settlementEntryRoute(state: { hasVersionedDraft: boolean; hasCanonicalOutcome: boolean; currentStructuredSchedule: boolean; legacyReadAvailable: boolean; hasLegacyHistory: boolean }) {
  if (state.hasVersionedDraft || state.hasCanonicalOutcome) return "settlement-v5";
  if (state.currentStructuredSchedule && state.legacyReadAvailable && !state.hasLegacyHistory) return "playoff-outcomes";
  return "settlement";
}

/** Use the draft's exact bound version, never a newer setup revision. */
export function boundScheduleReference(schedules: PrizeScheduleWorkspace[] | null, eventId: string, scheduleVersionId?: string) {
  if (!scheduleVersionId) return undefined;
  return schedules?.find(s => s.eventId === eventId)?.versions.find(v => v.scheduleId === scheduleVersionId)?.schedule.sourceReference;
}
