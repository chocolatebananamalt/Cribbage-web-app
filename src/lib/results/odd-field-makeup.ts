import { isEventScheduleMatch, validateScheduleForEvent, type EventScheduleMatch } from '../api/event-schedule.ts';

export type MakeupSeats = { sideATableSeat: string; sideBTableSeat: string };
export type OddFieldMakeupMatch = EventScheduleMatch & {
  /** Original blank scorecard lines, not an extra qualifying game. */
  sideACardGameNumber: number;
  sideBCardGameNumber: number;
};
export type OddFieldMakeupPlan = {
  policy: 'acc-director-manual-2019-12b-even-game-makeup-v1';
  qualifyingGameCount: 12;
  regularMatchCount: 96;
  makeupBatchNumber: 13;
  sitouts: Array<{ gameNumber: number; verificationId: string }>;
  makeupMatches: OddFieldMakeupMatch[];
};

/**
 * Narrow 17-player/12-game implementation of Director Manual §12.B's offered
 * solution. The director supplies the regular schedule and reviews makeup
 * seats. This is not an invented universal ACC rotation algorithm.
 */
export function deriveOddFieldMakeupPlan(
  regularMatches: EventScheduleMatch[], verificationIds: string[], makeupSeats: MakeupSeats[],
  tableCount: number, seatsPerTable: number,
): OddFieldMakeupPlan {
  if (!Array.isArray(regularMatches) || regularMatches.some(m => !isEventScheduleMatch(m))
    || !Array.isArray(verificationIds) || verificationIds.length !== 17
    || !Number.isSafeInteger(tableCount) || tableCount < 1 || tableCount > 26
    || !Number.isSafeInteger(seatsPerTable) || seatsPerTable < 2 || seatsPerTable > 20
    || validateScheduleForEvent(regularMatches, 12, verificationIds, tableCount, seatsPerTable).length)
    throw new TypeError('A complete reviewed seventeen-player twelve-game regular schedule is required.');
  const sitouts = Array.from({ length: 12 }, (_, i) => {
    const gameNumber = i + 1;
    const used = new Set(regularMatches.filter(m => m.gameNumber === gameNumber)
      .flatMap(m => [m.sideAVerificationId, m.sideBVerificationId]));
    const absent = verificationIds.filter(id => !used.has(id));
    if (absent.length !== 1) throw new TypeError('Exactly one sit-out is required per regular game.');
    return { gameNumber, verificationId: absent[0] };
  });
  if (new Set(sitouts.map(s => s.verificationId)).size !== 12)
    throw new TypeError('This supported makeup method requires twelve distinct sit-outs.');
  if(verificationIds.some(id=>new Set(regularMatches.flatMap(m=>m.sideAVerificationId===id?[m.sideATableSeat]
    :m.sideBVerificationId===id?[m.sideBTableSeat]:[])).size<2))
    throw new TypeError('This supported zero-anchor schedule requires every player to change physical seats.');
  const seat = /^[A-Z]-[1-9][0-9]*$/;
  const inPlan = (s: unknown): s is string => typeof s === 'string' && seat.test(s)
    && s.charCodeAt(0) - 64 <= tableCount && Number(s.split('-')[1]) <= seatsPerTable;
  if (!Array.isArray(makeupSeats) || makeupSeats.length !== 6 || makeupSeats.some(p => !p
    || Object.keys(p).sort().join(',') !== 'sideATableSeat,sideBTableSeat'
    || !inPlan(p.sideATableSeat) || !inPlan(p.sideBTableSeat)
    || p.sideATableSeat[0] !== p.sideBTableSeat[0] || p.sideATableSeat === p.sideBTableSeat)
    || new Set(makeupSeats.flatMap(p => [p.sideATableSeat, p.sideBTableSeat])).size !== 12)
    throw new TypeError('Six nonconflicting same-table makeup seat pairs must be reviewed.');
  const makeupMatches = makeupSeats.map((seats, i) => ({ gameNumber: 13,
    sideAVerificationId: sitouts[i].verificationId, sideBVerificationId: sitouts[11 - i].verificationId,
    ...seats, sideACardGameNumber: sitouts[i].gameNumber, sideBCardGameNumber: sitouts[11 - i].gameNumber,
  }));
  return { policy: 'acc-director-manual-2019-12b-even-game-makeup-v1', qualifyingGameCount: 12,
    regularMatchCount: 96, makeupBatchNumber: 13, sitouts, makeupMatches };
}
