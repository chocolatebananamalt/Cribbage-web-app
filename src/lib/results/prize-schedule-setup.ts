import { directorPrizeScheduleVersionV3, isDirectorPrizeScheduleV3, type DirectorPrizeScheduleV3 } from './prize-schedule.ts';
import { calculateRegularPrizeRoundingV3, type RegularPrizeRoundingResultV3 } from './regular-prize-rounding-v3.ts';
import { parseUsdMinor } from '../money.ts';
type PrizeScheduleSetupEvent = {
  eventKind: string;
  gameCount: number;
  styleCode: string;
  formatCode: string;
  entryFeeCents: number;
  sidePools: unknown[];
};

// Q fees and awards remain separate from this base-entry prize schedule.
// Server readers/writers independently validate all configured pool policies.
export function supportsSetupPrizeSchedule(events: readonly PrizeScheduleSetupEvent[]): boolean {
  if (events.length !== 1) return false;
  const event = events[0];
  return event.eventKind === "main" && event.gameCount === 12 &&
    event.styleCode === "Standard" && event.formatCode === "standard_singles" &&
    Number.isSafeInteger(event.entryFeeCents) && event.entryFeeCents > 0 && event.sidePools.length === 0;
}

/** New declarations save a formula, never these estimated dollar awards. */
export function buildSetupPrizeScheduleV3(expectedQualifierCount: 4 | 5, weights: readonly string[], sourceReference: string): DirectorPrizeScheduleV3 | null {
 if (!weights.every(w => /^[1-9]\d*$/.test(w))) return null;
 const schedule = { kind: directorPrizeScheduleVersionV3, amountBasis: 'total_award', expectedQualifierCount, sourceReference,
  roundingRule: 'automatic-five-dollar-cohort-v3', cohorts: weights.map((w, i) => ({ bandStart: [1, 2, 3, 5][i], bandEnd: [1, 2, 4, 5][i], weight: Number(w) })) };
 return isDirectorPrizeScheduleV3(schedule) ? schedule : null;
}

export function previewSetupPrizeScheduleV3(input: { entryCount: string; entryFeeMinor: number; expenses: string; benefitExpenses: string; expectedQualifierCount: 4 | 5; weights: readonly string[] }): RegularPrizeRoundingResultV3 | null {
 if ([input.entryCount, input.expenses, input.benefitExpenses, ...input.weights].some(v => v === '')) return null;
 const schedule = buildSetupPrizeScheduleV3(input.expectedQualifierCount, input.weights, 'Local estimate only');
 const expenses = parseUsdMinor(input.expenses, { allowZero: true }), benefits = parseUsdMinor(input.benefitExpenses, { allowZero: true });
 if (!schedule || !/^\d+$/.test(input.entryCount) || !Number.isSafeInteger(Number(input.entryCount)) || !Number.isSafeInteger(input.entryFeeMinor) || input.entryFeeMinor < 1 || expenses === null || benefits === null) return { status: 'blocked', code: 'invalid_input' };
 const gross = BigInt(input.entryCount) * BigInt(input.entryFeeMinor);
 if (gross > BigInt(Number.MAX_SAFE_INTEGER)) return { status: 'blocked', code: 'invalid_input' };
 return calculateRegularPrizeRoundingV3({ grossBaseIncomeMinor: Number(gross), expenseTotalMinor: expenses, benefitExpenseMinor: benefits, expectedQualifierCount: input.expectedQualifierCount, cohorts: schedule.cohorts });
}
