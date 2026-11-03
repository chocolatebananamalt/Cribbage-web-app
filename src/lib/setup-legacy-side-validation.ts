import { isEnabledPoolFee, isRetainedSetupSaveRequest, isSetupEvent, type SetupEvent, type SetupSaveRequest } from './api/setup.ts';

/** Accept an unchanged historical untyped Side Pool without guessing a policy.
 * Use only with the current authoritative setup revision before a new write. */
export function isSetupSaveWithUnchangedLegacySides(value: unknown, baseline: {version:number;events:readonly Pick<SetupEvent,'clientRowId'|'eventKind'|'formatCode'|'styleCode'|'sidePools'>[]} | null): value is SetupSaveRequest {
 if (!isRetainedSetupSaveRequest(value) || !baseline || baseline.version !== value.expectedVersion) return false;
 let legacyCount = 0;
 for (const event of value.payload.events) {
  const previous = baseline.events.find(item => item.clientRowId === event.clientRowId);
  for (const [index, side] of event.sidePools.entries()) {
   if (side.payoutType !== undefined) continue;
   legacyCount++;
   const old = previous?.sidePools[index];
   if (!previous || previous.eventKind !== event.eventKind || previous.formatCode !== event.formatCode || previous.styleCode !== event.styleCode
       || !old || old.payoutType !== undefined || !isEnabledPoolFee(side.entryFeeCents) || old.poolTypeCode.trim() !== side.poolTypeCode.trim()
       || old.entryFeeCents !== side.entryFeeCents || old.note !== side.note) return false;
  }
  // Historical unchanged entries were validated above. Validate all current
  // entries without assigning an invented payout type to the legacy record.
  const checked = { ...event, sidePools: event.sidePools.filter(side => side.payoutType !== undefined) };
  if (!isSetupEvent(checked)) return false;
 }
 return legacyCount > 0;
}
