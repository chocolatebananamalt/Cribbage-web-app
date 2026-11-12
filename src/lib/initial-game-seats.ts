import type { EventScheduleMatch } from "./api/event-schedule";

/** Only a NEW initial publication: later audited reseating retains player IDs. */
export function validateInitialGameSeats(matches: EventScheduleMatch[]): string[] {
  const invalid = matches.some(match => match.gameNumber === 1 && (
    match.sideAVerificationId !== match.sideATableSeat ||
    match.sideBVerificationId !== match.sideBTableSeat
  ));
  return invalid ? ["Game 1: each playing participant must use the Table/Seat in their permanent starting Player ID. A first-game sit-out is exempt; later audited reseating is separate."] : [];
}
