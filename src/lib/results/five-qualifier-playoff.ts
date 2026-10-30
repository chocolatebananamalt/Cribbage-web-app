import { calculateStandardSinglesMrpFromWins, groupEliminationCohorts } from './playoff-rounds-won.ts';

export type FiveQualifier = { participantId: string; qualificationRank: number; gamePoints: number };
export type PlayedSeries = { winnerId: string; loserId: string; evidenceNote: string };

/** 2025 ACC eight-slot chart, with seeds 6–8 absent. A bye is not a played series. */
export function deriveFiveQualifierPlayoff(qualifiers: readonly FiveQualifier[], series: readonly PlayedSeries[]) {
  const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!Array.isArray(qualifiers) || qualifiers.length !== 5 || qualifiers.some((q, i) => !q
    || Object.keys(q).sort().join(',') !== 'gamePoints,participantId,qualificationRank' || !id.test(q.participantId)
    || q.qualificationRank !== i + 1 || !Number.isSafeInteger(q.gamePoints) || q.gamePoints < 0 || q.gamePoints > 36)
    || new Set(qualifiers.map(q => q.participantId.toLowerCase())).size !== 5
    || !Array.isArray(series) || series.length !== 4 || series.some(s => !s
      || Object.keys(s).sort().join(',') !== 'evidenceNote,loserId,winnerId' || !id.test(s.winnerId) || !id.test(s.loserId)
      || s.winnerId.toLowerCase() === s.loserId.toLowerCase() || typeof s.evidenceNote !== 'string'
      || !s.evidenceNote.trim() || s.evidenceNote !== s.evidenceNote.trim() || s.evidenceNote.length > 200)) return null;
  const q = qualifiers.map(p => ({ ...p, participantId: p.participantId.toLowerCase() }));
  const matches = series.map(s => ({ ...s, winnerId: s.winnerId.toLowerCase(), loserId: s.loserId.toLowerCase() }));
  const pair = (s: PlayedSeries, a: string, b: string) => new Set([s.winnerId, s.loserId, a, b]).size === 2;
  if (!pair(matches[0], q[3].participantId, q[4].participantId)
    || !pair(matches[1], q[0].participantId, matches[0].winnerId)
    || !pair(matches[2], q[2].participantId, q[1].participantId)
    || !pair(matches[3], matches[1].winnerId, matches[2].winnerId)) return null;
  const eliminated = (pid: string) => matches[3].winnerId === pid ? null : matches[3].loserId === pid ? 3
    : matches[0].loserId === pid ? 1 : 2;
  const cohorts = groupEliminationCohorts(q.map(p => ({ participantId: p.participantId, eliminatedInRound: eliminated(p.participantId) })));
  const rows = [];
  for (const p of q) {
    const playedMatchWins = matches.filter(s => s.winnerId === p.participantId).length;
    const byeWins = p.qualificationRank <= 3 ? 1 : 0;
    const mrp = calculateStandardSinglesMrpFromWins({ eventType: 'main', gameCount: 12, qualifierCount: 5,
      qualificationRank: p.qualificationRank, gamePoints: p.gamePoints, roundsWon: playedMatchWins, byesWon: byeWins });
    if (mrp.status === 'blocked' || mrp.playoffMrp === null || mrp.totalMrp === null) return null;
    const band = cohorts.find(c => c.participantIds.includes(p.participantId))!;
    rows.push({ participantId: p.participantId, playedMatchWins, byeWins, eliminatedInRound: eliminated(p.participantId),
      champion: eliminated(p.participantId) === null, bandStart: band.bandStart, bandEnd: band.bandEnd,
      qualifyingMrp: mrp.qualifyingMrp, playoffMrp: mrp.playoffMrp, totalMrp: mrp.totalMrp });
  }
  return rows;
}
