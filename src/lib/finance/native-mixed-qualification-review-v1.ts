// Private rehearsal intake only. This is not an ordinary Finance source or an
// official qualification result. A decoded DTO never grants write authority.
export type PracticeCardV1 = {
  participantId: string; fixedTournamentId: string; games: number;
  distinctOpponents: number; wins: number; losses: number; gamePoints: number;
  positiveSpread: number; negativeSpread: number; netSpread: number;
  rank: number; tieCount: number;
};
export type PracticeQualificationFinanceReviewV1 = {
  kind: 'native-mixed-qualification-finance-review-v1'; status: 'review_available';
  tournamentId: string; eventId: string; startId: string; sourceDigest: string;
  startSourceDigest: string; fundingSourceDigest: string;
  cards: PracticeCardV1[]; entrantCount: 18; qualifyingCount: 5;
  qualificationReady: boolean; tieReviewRequired: boolean; tieReviewReason: string | null;
  evidenceHeads: { gameId: string; revision: number; historyDigest: string }[];
  simulatedReceipts: { participantId: string; receiptId: string; amountMinor: number; sourceDigest: string }[];
  simulatedGrossMinor: number; costsMinor: null; netPrizeFundMinor: null; awards: null;
  policyReviewRequired: true; simulationOnly: true; officialQualificationRecorded: false;
  mrpAwarded: false; actualMoneyReceived: false; moneyMoved: false;
  payoutAuthorized: false; ordinaryFinanceSource: false;
};
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const integer = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min;
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const cardKeys = ['participantId','fixedTournamentId','games','distinctOpponents','wins','losses','gamePoints','positiveSpread','negativeSpread','netSpread','rank','tieCount'];
const keys = ['kind','status','tournamentId','eventId','startId','sourceDigest','startSourceDigest','fundingSourceDigest','cards','entrantCount','qualifyingCount','qualificationReady','tieReviewRequired','tieReviewReason','evidenceHeads','simulatedReceipts','simulatedGrossMinor','costsMinor','netPrizeFundMinor','awards','policyReviewRequired','simulationOnly','officialQualificationRecorded','mrpAwarded','actualMoneyReceived','moneyMoved','payoutAuthorized','ordinaryFinanceSource'];

export function readPracticeQualificationFinanceReviewV1(value: unknown): PracticeQualificationFinanceReviewV1 | null {
  if (!object(value) || !exact(value, keys) || value.kind !== 'native-mixed-qualification-finance-review-v1' || value.status !== 'review_available'
    || ![value.tournamentId,value.eventId,value.startId].every(uuid)
    || ![value.sourceDigest,value.startSourceDigest,value.fundingSourceDigest].every(digest)
    || value.entrantCount !== 18 || value.qualifyingCount !== 5 || value.policyReviewRequired !== true || value.simulationOnly !== true
    || ['officialQualificationRecorded','mrpAwarded','actualMoneyReceived','moneyMoved','payoutAuthorized','ordinaryFinanceSource'].some(k => value[k] !== false)
    || ['costsMinor','netPrizeFundMinor','awards'].some(k => value[k] !== null)
    || !Array.isArray(value.cards) || value.cards.length !== 18 || !Array.isArray(value.evidenceHeads) || value.evidenceHeads.length !== 108
    || !Array.isArray(value.simulatedReceipts) || value.simulatedReceipts.length !== 18 || !integer(value.simulatedGrossMinor)) return null;
  const cards: PracticeCardV1[] = [];
  for (const c of value.cards) {
    if (!object(c) || !exact(c, cardKeys) || !uuid(c.participantId) || typeof c.fixedTournamentId !== 'string' || !/^[A-Z]+-[1-9][0-9]*$/.test(c.fixedTournamentId)
      || c.games !== 12 || c.distinctOpponents !== 12 || !integer(c.wins) || !integer(c.losses) || c.wins + c.losses !== 12
      || !integer(c.gamePoints) || c.gamePoints < c.wins * 2 || c.gamePoints > c.wins * 3
      || !integer(c.positiveSpread) || !integer(c.negativeSpread) || !Number.isSafeInteger(c.netSpread)
      || c.netSpread !== c.positiveSpread - c.negativeSpread || !integer(c.rank, 1) || c.rank > 18 || !integer(c.tieCount, 1) || c.tieCount > 18) return null;
    cards.push(c as PracticeCardV1);
  }
  if (new Set(cards.map(c => c.participantId)).size !== 18 || new Set(cards.map(c => c.fixedTournamentId)).size !== 18
    || cards.reduce((n,c) => n+c.wins,0) !== 108 || cards.reduce((n,c) => n+c.netSpread,0) !== 0) return null;
  const compare = (a: PracticeCardV1,b: PracticeCardV1) => b.gamePoints-a.gamePoints || b.wins-a.wins || b.netSpread-a.netSpread || b.positiveSpread-a.positiveSpread;
  const sorted = [...cards].sort(compare);
  for (const c of cards) {
    const same = sorted.filter(x => compare(c,x) === 0);
    if (c.rank !== sorted.findIndex(x => compare(c,x) === 0)+1 || c.tieCount !== same.length) return null;
  }
  const tied = cards.some(c => c.tieCount > 1);
  if (value.qualificationReady !== !tied || value.tieReviewRequired !== tied
    || (tied ? typeof value.tieReviewReason !== 'string' || !value.tieReviewReason.trim() : value.tieReviewReason !== null)) return null;
  for (const h of value.evidenceHeads) {
    if (!object(h) || !exact(h,['gameId','revision','historyDigest']) || !uuid(h.gameId) || ![2,4].includes(h.revision as number) || !digest(h.historyDigest)) return null;
  }
  if (new Set(value.evidenceHeads.map(h => h.gameId)).size !== 108) return null;
  let total = 0;
  for (const r of value.simulatedReceipts) {
    if (!object(r) || !exact(r,['participantId','receiptId','amountMinor','sourceDigest']) || !uuid(r.participantId) || !uuid(r.receiptId)
      || !cards.some(c => c.participantId === r.participantId) || !integer(r.amountMinor, 1) || !digest(r.sourceDigest)) return null;
    total += r.amountMinor;
  }
  if (!Number.isSafeInteger(total) || total !== value.simulatedGrossMinor
    || new Set(value.simulatedReceipts.map(r => r.participantId)).size !== 18 || new Set(value.simulatedReceipts.map(r => r.receiptId)).size !== 18) return null;
  // Return a detached copy; consumers cannot mutate pending/recovered input.
  return structuredClone(value) as PracticeQualificationFinanceReviewV1;
}
