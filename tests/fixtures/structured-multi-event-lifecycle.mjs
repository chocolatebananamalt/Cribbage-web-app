// Local synthetic paper scoring support. This is not evidence of human play or cash.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const uuid = value => {
  assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return `'${value}'`;
};
const json = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;

// Fourteen distinct nonqualifiers, eight rounds, seven games each round.
// Player order is supplied from the saved Main qualification result.
export function consolationPlan(participantIds, firstRoundPairs = null) {
  assert.equal(participantIds.length, 14);
  assert.equal(new Set(participantIds).size, 14);
  participantIds.forEach(uuid);
  if (firstRoundPairs) {
    assert.equal(firstRoundPairs.length, 7);
    assert.deepEqual([...firstRoundPairs.flat()].sort(), [...participantIds].sort());
  }
  let circle = firstRoundPairs
    ? [...firstRoundPairs.map(pair => pair[0]), ...firstRoundPairs.map(pair => pair[1]).reverse()]
    : [...participantIds];
  const matches = [];
  for (let round = 1; round <= 8; round++) {
    for (let seat = 0; seat < 7; seat++) {
      const a = circle[seat], b = circle[13-seat];
      const ai = participantIds.indexOf(a), bi = participantIds.indexOf(b);
      matches.push({round, a, b, winnerSide: ai < bi ? 'a' : 'b', margin: 10 + ((round*17+ai*7+bi*11)%20)});
    }
    circle = [circle[0], circle[13], ...circle.slice(1,13)];
  }
  return matches;
}

function cardPayload(card, expected) {
  assert.ok(card && typeof card.text === 'string' && typeof card.reference === 'string');
  assert.equal(createHash('sha256').update(card.text).digest('hex'), card.sha256);
  const winner = /^Winner side: ([ab])$/m.exec(card.text)?.[1];
  const marginText = /^Spread points: (\d+)$/m.exec(card.text)?.[1];
  assert.equal(winner, expected.winnerSide);
  assert.equal(Number(marginText), expected.margin);
  return {winnerSide:winner, margin:Number(marginText), evidenceReference:card.reference};
}

// The caller owns the isolated, owner-only database session and event setup.
// No direct scoreline insertion, physical assertion, or forged artifact is used.
export function scoreStructuredPaperGames({sql, read, actor, checker, tournamentId, eventId, matches, operationId}) {
  [actor, checker, tournamentId, eventId].forEach(uuid);
  assert.notEqual(actor, checker);
  assert.ok(matches.length > 0);
  const ids = new Set();
  for (const m of matches) {
    uuid(m.gameId);
    assert.ok(!ids.has(m.gameId), 'duplicate game'); ids.add(m.gameId);
    assert.ok(['a','b'].includes(m.winnerSide));
    assert.ok(Number.isInteger(m.margin) && m.margin > 0);
  }
  // Fail before preparation if the event was not enrolled before scoring.
  assert.equal(read(`select exists(select 1 from app.synthetic_paper_fixtures_v1 where tournament_id=${uuid(tournamentId)} and event_id=${uuid(eventId)});`), true, 'synthetic fixture enrollment required');
  assert.equal(read(`select count(*)::integer from app.card_scorelines where tournament_id=${uuid(tournamentId)} and event_id=${uuid(eventId)};`), 0, 'fresh event required');
  sql(matches.map(m => `select app.prepare_synthetic_paper_artifact_v1(${uuid(m.gameId)},'${m.winnerSide}',${m.margin});`).join('\n'));
  const evidence = read(`select public.get_synthetic_paper_evidence_v1(${uuid(checker)},${uuid(tournamentId)});`);
  assert.ok(Array.isArray(evidence?.artifacts));
  const artifacts = new Map(evidence.artifacts.map(a => [a.gameId, a]));
  const operationIds = new Set();
  const prepared = matches.map((m, i) => {
    const artifact = artifacts.get(m.gameId);
    assert.ok(artifact, `missing artifact for ${m.gameId}`);
    const a = cardPayload(artifact.sideA, m), b = cardPayload(artifact.sideB, m);
    const completion = uuid(operationId('completion', i));
    const captureOp = uuid(operationId('capture', i));
    const reviewOp = uuid(operationId('review', i));
    for (const op of [completion, captureOp, reviewOp]) {
      assert.ok(!operationIds.has(op), 'duplicate operation or completion ID');
      operationIds.add(op);
    }
    return {m, a, b, completion, captureOp, reviewOp};
  });
  const batch = prepared.map(({m, a, b, completion, captureOp, reviewOp}) => `do $$declare r jsonb;begin
    r:=public.complete_synthetic_paper_game_v1(${uuid(checker)},${uuid(tournamentId)},${uuid(eventId)},${uuid(m.gameId)},${completion},1,${json(a)},${json(b)},${captureOp});
    if r->>'status' is distinct from 'pending_review' then raise exception 'synthetic capture %',r;end if;
    r:=public.review_synthetic_paper_game_v1(${uuid(checker)},${uuid(tournamentId)},${completion},'approve',1,${json(a)},${json(b)},${reviewOp});
    if r->>'status' is distinct from 'approved' then raise exception 'synthetic review %',r;end if;end$$;`).join('\n');
  sql('begin;'+batch+'commit;');
  assert.equal(read(`select count(*)::integer from app.canonical_games where event_id=${uuid(eventId)} and state='verified';`), matches.length);
  assert.equal(read(`select count(*)::integer from app.synthetic_paper_provenance_v1 where event_id=${uuid(eventId)} and phase='review';`), matches.length);
}
