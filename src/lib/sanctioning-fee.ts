export const DEFAULT_MAIN_SANCTIONING_FEE_RATE_CENTS = 300;
export const DEFAULT_CONSOLATION_SANCTIONING_FEE_RATE_CENTS = 100;
export const MAX_SANCTIONING_FEE_RATE_CENTS = 100_000;

export type SanctioningFeeCounts = {
  mainEligibleParticipantCount: number;
  consolationEligibleParticipantCount: number;
};

export type SanctioningFeeRates = {
  mainRateCents: number;
  consolationRateCents: number;
};

export function calculateSanctioningFeeRunningTotalCents(counts: SanctioningFeeCounts, rates: SanctioningFeeRates) {
  return (counts.mainEligibleParticipantCount * rates.mainRateCents)
    + (counts.consolationEligibleParticipantCount * rates.consolationRateCents);
}

export function requiresSanctioningFeeOverrideEvidence(eventKind: "main" | "consolation", rateCents: number) {
  return eventKind === "main"
    ? rateCents !== DEFAULT_MAIN_SANCTIONING_FEE_RATE_CENTS
    : rateCents !== DEFAULT_CONSOLATION_SANCTIONING_FEE_RATE_CENTS;
}
