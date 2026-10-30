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
