import { isEventRosterEnrollmentWorkspace } from '../api/event-roster-enrollment.ts';
import type { ResultMrpMembershipCaptureV1 } from './result-mrp-membership-v1.ts';

/** Optional reads have a total time budget and at most four in flight. A slow
 * lookup cannot hold result reporting or dispatch more reads after timeout. */
export async function captureResultMrpMembershipV1(o: {
  eventId: string;
  players: Array<{ verificationId: string; displayName: string }>;
  readRoster: () => Promise<unknown>;
  readReview: (rosterEntryId: string) => Promise<unknown>;
  budgetMs?: number;
}): Promise<ResultMrpMembershipCaptureV1> {
  const empty = (): ResultMrpMembershipCaptureV1 => ({ roster: null, reviews: {} });
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const capture = async (): Promise<ResultMrpMembershipCaptureV1> => {
    try {
      const roster = await o.readRoster();
      if (expired || !isEventRosterEnrollmentWorkspace(roster)) return empty();
      const entries = roster.roster.filter(r => r.enrolledEventIds.includes(o.eventId)
        && o.players.some(p => p.verificationId === r.verificationId && p.displayName === r.displayName));
      const reviews: Record<string, unknown> = {};
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(4, entries.length) }, async () => {
        while (!expired && next < entries.length) {
          const entry = entries[next++];
          try { const review = await o.readReview(entry.rosterEntryId); if (!expired) reviews[entry.rosterEntryId] = review; }
          catch { if (!expired) reviews[entry.rosterEntryId] = null; }
        }
      }));
      return expired ? empty() : { roster, reviews };
    } catch { return empty(); }
  };
  try {
    return await Promise.race([capture(), new Promise<ResultMrpMembershipCaptureV1>(resolve => {
      timer = setTimeout(() => { expired = true; resolve(empty()); }, o.budgetMs ?? 1500);
    })]);
  } finally { clearTimeout(timer); }
}
