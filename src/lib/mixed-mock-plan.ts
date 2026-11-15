/** Local rehearsal planning/oracle only. This module never authorizes a score or payment. */
export type MockParticipant = { participantId: string; tournamentPlayerId: string; mode: "digital" | "paper" };
export type MockSeat = { participantId: string; currentSeat: string; cardGameNumber: number };
export type MockMatch = { gameId: string; batchNumber: number; sideA: MockSeat; sideB: MockSeat };
export type MockPairing = "digital-digital" | "paper-digital" | "paper-paper";
export type MockManifest = {
  kind: "mixed-mock-plan-v1";
  notice: "Planning evidence only; not verified games or real payments.";
  participants: ReadonlyArray<Readonly<MockParticipant>>;
  matches: ReadonlyArray<Readonly<MockMatch & { pairing: MockPairing }>>;
  counts: Readonly<Record<MockPairing, number>>;
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const seat = /^[A-E]-[1-4]$/;
function fail(message: string): never { throw new TypeError(message); }
const key = (id: string) => id.toLowerCase();

/** Validate bounded 17/18-player twelve-line rehearsal plans, not ACC movement certification. */
export function buildMixedMockManifest(participants: MockParticipant[], matches: MockMatch[]): MockManifest {
  if (!Array.isArray(participants) || ![17, 18].includes(participants.length) || !Array.isArray(matches) || matches.length !== participants.length * 6)
    fail("The mock requires 17/18 participants and twelve games each.");
  const odd = participants.length === 17;
  // A reviewed native one-table draw publishes A-1..A-18. Accept that complete
  // identity domain explicitly; do not treat partial/mixed layouts as native.
  const nativeIds = new Set(Array.from({ length: 18 }, (_, i) => `A-${i + 1}`));
  const oneNativeTable = !odd && new Set(participants.map(p => p?.tournamentPlayerId)).size === 18
    && participants.every(p => p && nativeIds.has(p.tournamentPlayerId));
  const validSeat = (value: unknown): value is string => typeof value === "string"
    && (oneNativeTable ? nativeIds.has(value) : seat.test(value));
  const people = new Map<string, MockParticipant>();
  const playerIds = new Set<string>();
  for (const p of participants) {
    if (!p || !uuid.test(p.participantId) || !validSeat(p.tournamentPlayerId) || !["digital", "paper"].includes(p.mode)
      || people.has(key(p.participantId)) || playerIds.has(p.tournamentPlayerId)) fail("Invalid or duplicate participant identity/mode.");
    people.set(key(p.participantId), p); playerIds.add(p.tournamentPlayerId);
  }
  if (participants.filter(p => p.mode === "digital").length !== 6) fail("The mock requires six digital participants; all others use paper.");
  const gameIds = new Set<string>(), opponentPairs = new Set<string>(), batchPlayers = new Set<string>(), batchSeats = new Set<string>(), cardLines = new Set<string>();
  const counts: Record<MockPairing, number> = { "digital-digital": 0, "paper-digital": 0, "paper-paper": 0 };
  const batches = Array<number>(14).fill(0);
  const snapshots = matches.map(m => {
    if (!m || !uuid.test(m.gameId) || gameIds.has(key(m.gameId)) || !Number.isInteger(m.batchNumber) || m.batchNumber < 1 || m.batchNumber > (odd ? 13 : 12))
      fail("Invalid or duplicate game/batch.");
    gameIds.add(key(m.gameId)); batches[m.batchNumber]++;
    const a = m.sideA, b = m.sideB;
    if (!a || !b || !uuid.test(a.participantId) || !uuid.test(b.participantId) || key(a.participantId) === key(b.participantId)
      || !people.has(key(a.participantId)) || !people.has(key(b.participantId)) || !validSeat(a.currentSeat) || !validSeat(b.currentSeat)
      || a.currentSeat[0] !== b.currentSeat[0] || a.currentSeat === b.currentSeat) fail("Unknown participant, self pairing or invalid current seats.");
    const opponentPair = [key(a.participantId), key(b.participantId)].sort().join(":");
    if (opponentPairs.has(opponentPair)) fail("Players may not repeat an opponent, including fictional opponents.");
    opponentPairs.add(opponentPair);
    for (const s of [a, b]) {
      const p = people.get(key(s.participantId))!;
      if (!Number.isInteger(s.cardGameNumber) || s.cardGameNumber < 1 || s.cardGameNumber > 12
        || (m.batchNumber < 13 && s.cardGameNumber !== m.batchNumber)
        || (m.batchNumber === 1 && s.currentSeat !== p.tournamentPlayerId)) fail("Invalid card line or initial seat identity.");
      const bp = `${m.batchNumber}:${key(s.participantId)}`, bs = `${m.batchNumber}:${s.currentSeat}`, line = `${key(s.participantId)}:${s.cardGameNumber}`;
      if (batchPlayers.has(bp) || batchSeats.has(bs) || cardLines.has(line)) fail("Participant/seat conflict or duplicate scorecard line.");
      batchPlayers.add(bp); batchSeats.add(bs); cardLines.add(line);
    }
    const modes = [people.get(key(a.participantId))!.mode, people.get(key(b.participantId))!.mode];
    const pairing: MockPairing = modes.every(v => v === "digital") ? "digital-digital" : modes.every(v => v === "paper") ? "paper-paper" : "paper-digital";
    counts[pairing]++;
    return Object.freeze({ gameId: key(m.gameId), batchNumber: m.batchNumber,
      sideA: Object.freeze({ ...a, participantId: key(a.participantId) }), sideB: Object.freeze({ ...b, participantId: key(b.participantId) }), pairing });
  });
  if (batches.slice(1, 13).some(n => n !== (odd ? 8 : 9)) || batches[13] !== (odd ? 6 : 0) || Object.values(counts).some(n => n === 0))
    fail("Require complete rounds, odd-field makeup only when needed, and all three pairings.");
  for (const id of people.keys()) for (let line = 1; line <= 12; line++) if (!cardLines.has(`${id}:${line}`)) fail("Every participant needs each of twelve card lines exactly once.");
  // This supported makeup method pairs twelve distinct sit-outs, once each.
  if (odd && new Set(snapshots.filter(m => m.batchNumber === 13).flatMap(m => [m.sideA.participantId, m.sideB.participantId])).size !== 12)
    fail("Makeup games require twelve distinct sit-outs.");
  return Object.freeze({ kind: "mixed-mock-plan-v1", notice: "Planning evidence only; not verified games or real payments.",
    participants: Object.freeze(participants.map(p => Object.freeze({ ...p, participantId: key(p.participantId) }))),
    matches: Object.freeze(snapshots), counts: Object.freeze(counts) });
}

export type MockOutcome = { gameId: string; winnerParticipantId: string; spreadPoints: number;
  evidence: "observed-digital-play" | "scripted-mixed" | "scripted-paper" };
export type MockTally = { participantId: string; tournamentPlayerId: string; recordedGames: number; gamePoints: number;
  wins: number; positiveSpreadPoints: number; negativeSpreadPoints: number; netSpreadPoints: number };

/** Independently tally raw outcomes; never consume app totals or infer player verification. */
export function tallyMixedMock(manifest: MockManifest, outcomes: MockOutcome[], requireComplete = true): MockTally[] {
  // Revalidate externally reconstructed manifests; callers cannot bypass checks with a cast.
  const checked = buildMixedMockManifest([...manifest.participants], [...manifest.matches]);
  if (!Array.isArray(outcomes)) fail("Raw outcomes are required.");
  const games = new Map(checked.matches.map(m => [m.gameId, m]));
  const rows = new Map(checked.participants.map(p => [p.participantId, { participantId: p.participantId, tournamentPlayerId: p.tournamentPlayerId,
    recordedGames: 0, gamePoints: 0, wins: 0, positiveSpreadPoints: 0, negativeSpreadPoints: 0, netSpreadPoints: 0 }]));
  const seen = new Set<string>();
  for (const o of outcomes) {
    if (!o || !uuid.test(o.gameId) || !uuid.test(o.winnerParticipantId)) fail("Invalid raw result identity.");
    const m = games.get(key(o.gameId));
    if (!m || seen.has(key(o.gameId)) || ![m.sideA.participantId, m.sideB.participantId].includes(key(o.winnerParticipantId))
      || !Number.isInteger(o.spreadPoints) || o.spreadPoints < 1 || o.spreadPoints > 121) fail("Unknown, duplicate or invalid raw result.");
    const expected = m.pairing === "digital-digital" ? "observed-digital-play" : m.pairing === "paper-digital" ? "scripted-mixed" : "scripted-paper";
    if (o.evidence !== expected) fail("Raw evidence must distinguish observed digital play from scripted paper/mixed results.");
    seen.add(key(o.gameId));
    for (const id of [m.sideA.participantId, m.sideB.participantId]) {
      const r = rows.get(id)!; r.recordedGames++;
      if (id === key(o.winnerParticipantId)) { r.wins++; r.gamePoints += o.spreadPoints > 30 ? 3 : 2; r.positiveSpreadPoints += o.spreadPoints; }
      else r.negativeSpreadPoints += o.spreadPoints;
      r.netSpreadPoints = r.positiveSpreadPoints - r.negativeSpreadPoints;
    }
  }
  if (requireComplete && seen.size !== checked.matches.length) fail("Complete expected results require every scheduled raw outcome.");
  // Preserve roster order: tied rankings/qualification require the separate reviewed rules and evidence.
  return [...rows.values()];
}

export type SimulatedFund = { fundId: string; incomingMinor: number; expensesMinor: number; retainedMinor: number;
  awards: Array<{ participantId: string; amountMinor: number }> };
/** Arithmetic only. Balanced funds do not establish eligibility or payout-method compliance. */
export function reconcileSimulatedFunds(funds: SimulatedFund[]) {
  if (!Array.isArray(funds)) fail("Simulated funds are required.");
  const ids = new Set<string>();
  return funds.map(f => {
    const minor = (n: number) => Number.isSafeInteger(n) && n >= 0;
    if (!f || typeof f.fundId !== "string" || !f.fundId.trim() || ids.has(f.fundId) || !minor(f.incomingMinor)
      || !minor(f.expensesMinor) || !minor(f.retainedMinor) || !Array.isArray(f.awards)) fail("Invalid or duplicate simulated fund.");
    ids.add(f.fundId);
    const recipients = new Set<string>(); let awardsMinor = 0;
    for (const a of f.awards) {
      if (!a || !uuid.test(a.participantId) || recipients.has(key(a.participantId)) || !minor(a.amountMinor)) fail("Invalid or duplicate simulated award.");
      recipients.add(key(a.participantId)); awardsMinor += a.amountMinor;
      if (!Number.isSafeInteger(awardsMinor)) fail("Simulated amount overflow.");
    }
    const allocated = f.expensesMinor + f.retainedMinor + awardsMinor;
    if (!Number.isSafeInteger(allocated)) fail("Simulated amount overflow.");
    return { fundId: f.fundId, simulated: true as const, paid: false as const, incomingMinor: f.incomingMinor, expensesMinor: f.expensesMinor,
      awardsMinor, retainedMinor: f.retainedMinor, unallocatedMinor: f.incomingMinor - allocated, balanced: f.incomingMinor === allocated,
      methodCompliance: "not-established" as const };
  });
}
