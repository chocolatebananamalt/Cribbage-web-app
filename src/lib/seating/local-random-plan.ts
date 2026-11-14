/** Local planning only: logical rounds do not certify physical movement. */
export type RandomInt = (maxExclusive: number) => number;
export type FacingSeat = { tableId: string; seat: number; seatId: string };
export type FacingPair = { pairId: string; seats: [FacingSeat, FacingSeat] };
export type LocalRandomPlanInput = {
  source: { version: number; sha256: string };
  registration: 'open' | 'closed';
  seating: 'unpublished' | 'published';
  existingTournamentIds: string[];
  participants: { participantId: string; stationaryPreference: 'requested' | 'none' }[];
  tables: { tableId: string; seatCount: number }[];
  activePairIds: string[];
  anchor: { participantId: string | null; seatId: string; directorApproved: boolean };
  stationaryDecisions: { participantId: string; decision: 'selected-anchor' | 'not-accommodated' }[];
  constraints: { kind: 'avoid-pair-in-round'; participantIds: [string, string]; round: number; verified: true; sourceReference: string }[];
  maxAttempts?: number;
};
export type PlannedMatch = { round: number; pairId: string; sides: [{ participantId: string; seatId: string }, { participantId: string; seatId: string }] };
export type LocalRandomPlanResult =
  | { status: 'readonly'; reason: string }
  | { status: 'blocked'; reasons: string[]; attempts: number }
  | { status: 'candidate'; algorithmVersion: 'local-circle-18-v1'; source: LocalRandomPlanInput['source']; hashVerified: false;
      inputSnapshot: LocalRandomPlanInput; canonicalInput: string; attempts: number;
      anchor: { seatId: string; participantId: string; selection: 'blind-draw' | 'approved-person' };
      assignments: { participantId: string; tournamentId: string; logicalSlot: number }[]; matches: PlannedMatch[];
      physicalReviewRequired: true; publishable: false; persistentAudit: false };

const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(v);
export function buildFacingGeometry(tables: LocalRandomPlanInput['tables']): { pairs: FacingPair[]; unpairedSeats: FacingSeat[] } {
  const seen = new Set<string>();
  const pairs: FacingPair[] = [], unpairedSeats: FacingSeat[] = [];
  for (const table of tables) {
    if (!/^[A-Z]$/.test(table.tableId) || seen.has(table.tableId) || !Number.isInteger(table.seatCount) || table.seatCount < 1 || table.seatCount > 20) throw new Error('Invalid physical table');
    seen.add(table.tableId);
    const seat = (n: number): FacingSeat => ({ tableId: table.tableId, seat: n, seatId: `${table.tableId}-${n}` });
    for (let n = 1; n + 1 <= table.seatCount; n += 2) pairs.push({ pairId: `${table.tableId}:${n}-${n + 1}`, seats: [seat(n), seat(n + 1)] });
    if (table.seatCount % 2) unpairedSeats.push(seat(table.seatCount));
  }
  return { pairs, unpairedSeats };
}
export function shuffleWithRandomInt<T>(items: readonly T[], randomInt: RandomInt): T[] {
  const result = [...items];
  for (let n = result.length; n > 1; n--) {
    const selected = randomInt(n);
    if (!Number.isInteger(selected) || selected < 0 || selected >= n) throw new Error('randomInt returned an out-of-range integer');
    [result[n - 1], result[selected]] = [result[selected], result[n - 1]];
  }
  return result;
}
export function validateLocalRandomPlanInput(input: LocalRandomPlanInput): string[] {
  const errors: string[] = [];
  if (!input || typeof input !== 'object') return ['Missing input'];
  if (!input.source || !Number.isSafeInteger(input.source.version) || input.source.version < 1 || !/^[a-f0-9]{64}$/i.test(input.source.sha256)) errors.push('Invalid source version/hash');
  if (input.registration !== 'closed') errors.push('Registration must be closed');
  if (input.seating !== 'unpublished') errors.push('Seating must be unpublished');
  if (!Array.isArray(input.existingTournamentIds) || input.existingTournamentIds.length) errors.push('Existing Tournament IDs cannot be reassigned');
  const participants = Array.isArray(input.participants) ? input.participants : [];
  const ids = new Set(participants.map(p => p?.participantId));
  if (participants.length !== 18 || ids.size !== 18 || participants.some(p => !p || !id(p.participantId) || !['requested', 'none'].includes(p.stationaryPreference))) errors.push('Exactly18 unique valid participants required');
  let pairs: FacingPair[] = [];
  try { pairs = buildFacingGeometry(input.tables).pairs; } catch { errors.push('Invalid physical geometry'); }
  const active = Array.isArray(input.activePairIds) ? input.activePairIds : [];
  if (active.length !== 9 || new Set(active).size !== 9 || active.some(p => !pairs.some(pair => pair.pairId === p))) errors.push('Select nine complete facing pairs');
  const anchor = input.anchor;
  if (!anchor || anchor.directorApproved !== true || (anchor.participantId !== null && !ids.has(anchor.participantId)) || !pairs.some(p => active.includes(p.pairId) && p.seats.some(s => s.seatId === anchor.seatId))) errors.push('Director must approve one participant and occupied anchor seat');
  const decisions = Array.isArray(input.stationaryDecisions) ? input.stationaryDecisions : [];
  if (new Set(decisions.map(d => d?.participantId)).size !== decisions.length || decisions.some(d => !d || !ids.has(d.participantId) || !['selected-anchor', 'not-accommodated'].includes(d.decision) || (d.decision === 'selected-anchor' && d.participantId !== anchor?.participantId) || (d.decision === 'not-accommodated' && d.participantId === anchor?.participantId))) errors.push('Invalid stationary decisions');
  if (participants.some(p => p?.stationaryPreference === 'requested' && !decisions.some(d => d?.participantId === p.participantId))) errors.push('Resolve all requested stationary preferences');
  if (input.maxAttempts !== undefined && (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1 || input.maxAttempts > 256)) errors.push('Attempts must be1..256');
  const constraints = Array.isArray(input.constraints) ? input.constraints : [];
  if (!Array.isArray(input.constraints)) errors.push('Missing explicit constraint list');
  const seenConstraints = new Set<string>();
  const forbidden = new Map<string, Set<string>>();
  for (const c of constraints) {
    if (!c || Object.keys(c).sort().join(',') !== 'kind,participantIds,round,sourceReference,verified' || c.kind !== 'avoid-pair-in-round' || c.verified !== true || !Number.isInteger(c.round) || c.round < 1 || c.round > 12 || !Array.isArray(c.participantIds) || c.participantIds.length !== 2 || c.participantIds.some(p => !ids.has(p)) || c.participantIds[0] === c.participantIds[1] || typeof c.sourceReference !== 'string' || !c.sourceReference.trim()) { errors.push('Unknown or unverified constraint scope'); continue; }
    const [a, b] = c.participantIds, key = `${c.round}|${[a, b].sort().join('|')}`;
    if (seenConstraints.has(key)) errors.push('Duplicate pair-round constraint');
    seenConstraints.add(key);
    for (const [p, opponent] of [[a, b], [b, a]]) {
      const k = `${c.round}|${p}`, opponents = forbidden.get(k) ?? new Set<string>();
      opponents.add(opponent); forbidden.set(k, opponents);
      if (opponents.size === 17) errors.push('A participant has no permitted opponent in a specified round');
    }
  }
  return [...new Set(errors)];
}
export function planLocalRandomSeating(input: LocalRandomPlanInput, randomInt: RandomInt): LocalRandomPlanResult {
  if (input?.seating === 'published' || (Array.isArray(input?.existingTournamentIds) && input.existingTournamentIds.length)) return { status: 'readonly', reason: 'Published seating and existing Tournament IDs are immutable' };
  const reasons = validateLocalRandomPlanInput(input);
  if (reasons.length) return { status: 'blocked', reasons, attempts: 0 };
  const snapshot: LocalRandomPlanInput = JSON.parse(JSON.stringify(input));
  const allPairs = buildFacingGeometry(snapshot.tables).pairs;
  const pairs = snapshot.activePairIds.map(p => allPairs.find(x => x.pairId === p)!);
  const anchorIndex = pairs.findIndex(p => p.seats.some(s => s.seatId === snapshot.anchor.seatId));
  [pairs[0], pairs[anchorIndex]] = [pairs[anchorIndex], pairs[0]];
  if (pairs[0].seats[0].seatId !== snapshot.anchor.seatId) pairs[0] = { ...pairs[0], seats: [pairs[0].seats[1], pairs[0].seats[0]] };
  const limit = snapshot.constraints.length ? snapshot.maxAttempts ?? 128 : 1;
  for (let attempt = 1; attempt <= limit; attempt++) {
    let ring: string[];
    try { ring = snapshot.anchor.participantId === null
      ? shuffleWithRandomInt(snapshot.participants.map(p => p.participantId), randomInt)
      : [snapshot.anchor.participantId, ...shuffleWithRandomInt(snapshot.participants.filter(p => p.participantId !== snapshot.anchor.participantId).map(p => p.participantId), randomInt)]; }
    catch { return { status: 'blocked', reasons: ['Invalid randomInt source'], attempts: attempt }; }
    const initial = [...ring], matches: PlannedMatch[] = [];
    for (let round = 1; round <= 12; round++) {
      for (let board = 0; board < 9; board++) matches.push({ round, pairId: pairs[board].pairId, sides: [{ participantId: ring[board], seatId: pairs[board].seats[0].seatId }, { participantId: ring[17 - board], seatId: pairs[board].seats[1].seatId }] });
      ring = [ring[0], ring[17], ...ring.slice(1, 17)];
    }
    if (!snapshot.constraints.every(c => !matches.some(m => m.round === c.round && c.participantIds.every(p => m.sides.some(s => s.participantId === p))))) continue;
    return { status: 'candidate', algorithmVersion: 'local-circle-18-v1', source: { ...snapshot.source }, hashVerified: false, inputSnapshot: snapshot, canonicalInput: JSON.stringify(snapshot), attempts: attempt,
      anchor: { seatId: snapshot.anchor.seatId, participantId: initial[0], selection: snapshot.anchor.participantId === null ? 'blind-draw' : 'approved-person' },
      assignments: initial.map((participantId, logicalSlot) => ({ participantId, logicalSlot, tournamentId: matches.filter(m => m.round === 1).flatMap(m => m.sides).find(s => s.participantId === participantId)!.seatId })), matches,
      physicalReviewRequired: true, publishable: false, persistentAudit: false };
  }
  return { status: 'blocked', reasons: ['No candidate found within the bounded draw attempts; infeasibility is not established'], attempts: limit };
}
