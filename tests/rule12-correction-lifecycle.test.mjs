import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const migration = fs.readFileSync(path.join(process.cwd(), "database/migrations/0106_rule12b_independent_card_correction_lifecycle.sql"), "utf8");
const lifecycle = await import(pathToFileURL(path.join(process.cwd(), "src/lib/corrections/independent-lifecycle.ts")).href);

const actorId = "00000000-0000-4000-8000-000000000001";
const gameId = "00000000-0000-4000-8000-000000000002";
const correctionId = "00000000-0000-4000-8000-000000000003";
const operationId = "00000000-0000-4000-8000-000000000004";

const createInput = {
  actorId,
  gameId,
  correctionId,
  expectedGameVersion: 1,
  expectedCorrectionSequence: 0,
  originalA: { isWinner: true, margin: 17 },
  originalB: { isWinner: false, margin: 16 },
  qualificationChanged: false,
  reason: "Cross-check of both cards",
  operationId,
};

test("Rule 12.2(b) lifecycle remains server-only, private, append-only, and unreleased", () => {
  assert.match(migration, /create table app\.independent_card_correction_lifecycles/);
  assert.match(migration, /create table app\.independent_card_correction_state_events/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /independent_card_correction_lifecycles_immutable/);
  assert.match(migration, /independent_card_correction_state_events_immutable/);
  assert.match(migration, /coalesce\(auth\.role\(\), ''\) <> 'service_role'/);
  for (const signature of [
    "public.create_rule12b_correction_v1\\(uuid, uuid, uuid, integer, integer, boolean, integer, boolean, integer, boolean, text, uuid\\)",
    "public.review_rule12_correction_v1\\(uuid, uuid, text, uuid\\)",
    "public.get_rule12_correction_v1\\(uuid, uuid\\)",
  ]) {
    assert.match(migration, new RegExp(`revoke all on function ${signature} from public, anon, authenticated`));
    assert.match(migration, new RegExp(`grant execute on function ${signature} to service_role`));
  }
  assert.doesNotMatch(migration, /grant execute[^;]+to authenticated/i);
  assert.match(migration, /revoke all on function public\.propose_game_correction[^;]+from authenticated/);
  assert.match(migration, /revoke all on function public\.review_game_correction[^;]+from authenticated/);
});

test("writer enforces exact source case, policy, self-check, sequencing, and publication boundaries", () => {
  assert.match(migration, /p_original_a_is_winner = p_original_b_is_winner/);
  assert.match(migration, /p_original_a_margin = p_original_b_margin/);
  assert.match(migration, /qualification notice workflow unavailable/);
  assert.match(migration, /r\.role = 'cross_checker'/);
  assert.match(migration, /cannot correct own game/);
  assert.equal((migration.match(/select t\.status into v_tournament_status[\s\S]{0,120}for update/g) ?? []).length, 2);
  assert.equal((migration.match(/select s\.state into v_publication_state[\s\S]{0,160}for update/g) ?? []).length, 2);
  assert.equal((migration.match(/return v_existing\.response_payload;[\s\S]{0,180}v_tournament_status <> 'open'/g) ?? []).length, 2);
  assert.equal((migration.match(/v_publication_state <> 'draft'/g) ?? []).length, 2);
  assert.match(migration, /e\.format = 'standard_singles' and e\.scoring_method = 'digital'/);
  assert.match(migration, /v_game\.state <> 'verified'/);
  assert.match(migration, /stale game version/);
  assert.match(migration, /stale correction sequence/);
  assert.match(migration, /pending independent correction already exists/);
  assert.match(migration, /v_policy\.reason_required and v_reason is null/);
  assert.match(migration, /case when v_policy\.required_approvals = 0 then 'applied' else 'pending' end/);
});

test("writer preserves originals and derives the non-reciprocal 17/16 to 16/17 projections", () => {
  assert.match(migration, /p_actor_id, '12\.2b', v_reason/);
  assert.match(migration, /false, array\['a', 'b'\]::text\[\]/);
  assert.match(migration, /p_original_a_is_winner, p_original_b_margin/);
  assert.match(migration, /p_original_b_is_winner, p_original_a_margin/);
  assert.doesNotMatch(migration, /update app\.card_scorelines/i);
  assert.doesNotMatch(migration, /update app\.canonical_games/i);
});

test("review requires an independent eligible reviewer and an exact pending policy snapshot", () => {
  assert.match(migration, /p_actor_id = v_correction\.editor_profile_id/);
  assert.match(migration, /reviewer must be independent/);
  assert.match(migration, /r\.role in \('director', 'co_director', 'cross_checker'\)/);
  assert.match(migration, /v_lifecycle\.required_approvals <> 1/);
  assert.match(migration, /correction policy snapshot invalid/);
  assert.match(migration, /e\.state = 'pending' and e\.transition_sequence = 1/);
  assert.match(migration, /'approved', 2/);
  assert.match(migration, /'applied', 3/);
  assert.match(migration, /'rejected', 2/);
});

test("create adapter binds the exact operation and accepts only a policy-consistent receipt", async () => {
  const calls = [];
  const admin = { async rpc(name, args) {
    calls.push({ name, args });
    return { data: {
      status: "pending", correctionId, gameId, gameVersion: 1, correctionSequence: 1,
      policyVersion: 2, reasonRequired: true, requiredApprovals: 1, qualificationChanged: false,
    }, error: null };
  } };
  const result = await lifecycle.createRule12bCorrection(admin, createInput);
  assert.equal(result.status, "pending");
  assert.deepEqual(calls[0], { name: "create_rule12b_correction_v1", args: {
    p_actor_id: actorId,
    p_game_id: gameId,
    p_correction_id: correctionId,
    p_expected_game_version: 1,
    p_expected_correction_sequence: 0,
    p_original_a_is_winner: true,
    p_original_a_margin: 17,
    p_original_b_is_winner: false,
    p_original_b_margin: 16,
    p_qualification_changed: false,
    p_reason: "Cross-check of both cards",
    p_operation_id: operationId,
  } });
});

test("create adapter rejects mismatched sequences and malformed success envelopes", async () => {
  for (const data of [
    { status: "pending", correctionId, gameId, gameVersion: 1, correctionSequence: 2, policyVersion: 2, reasonRequired: true, requiredApprovals: 1, qualificationChanged: false },
    { status: "applied", correctionId, gameId, gameVersion: 1, correctionSequence: 1, policyVersion: 2, reasonRequired: true, requiredApprovals: 1, qualificationChanged: false },
    { status: "pending", correctionId, gameId, gameVersion: 1, correctionSequence: 1, policyVersion: 2, reasonRequired: true, requiredApprovals: 1, qualificationChanged: false, extra: true },
  ]) {
    const admin = { async rpc() { return { data, error: null }; } };
    await assert.rejects(() => lifecycle.createRule12bCorrection(admin, createInput), /unavailable/);
  }
});

test("review adapter distinguishes accepted rejection from an error rejection", async () => {
  const reviewInput = { actorId, correctionId, decision: "reject", operationId };
  const admin = { async rpc() { return { data: {
    status: "rejected", decision: "reject", correctionId, gameId,
    gameVersion: 1, correctionSequence: 1,
  }, error: null }; } };
  assert.equal((await lifecycle.reviewRule12Correction(admin, reviewInput)).decision, "reject");

  const malformed = { async rpc() { return { data: { status: "rejected", correctionId }, error: null }; } };
  await assert.rejects(() => lifecycle.reviewRule12Correction(malformed, reviewInput), /unavailable/);
});

test("reader validates independent projections and refuses malformed arithmetic", async () => {
  const tournamentId = "00000000-0000-4000-8000-000000000005";
  const eventId = "00000000-0000-4000-8000-000000000006";
  const scorelineA = "00000000-0000-4000-8000-000000000007";
  const scorelineB = "00000000-0000-4000-8000-000000000008";
  const base = {
    correctionId, tournamentId, eventId, gameId, correctionSequence: 1,
    baseGameVersion: 1, editorProfileId: actorId, ruleCase: "12.2b",
    reason: null, createdAt: "2026-09-10T12:00:00.000Z", qualificationChanged: false,
    apparentQualifierSides: ["a", "b"], policyVersion: 0, reasonRequired: false,
    requiredApprovals: 0, status: "applied",
    projections: [
      { cardSide: "a", canonicalScorelineId: scorelineA,
        original: { isWinner: true, margin: 17, plusPoints: 17, minusPoints: 0, gamePoints: 2 },
        adjudicated: { isWinner: true, margin: 16, plusPoints: 16, minusPoints: 0, gamePoints: 2 } },
      { cardSide: "b", canonicalScorelineId: scorelineB,
        original: { isWinner: false, margin: 16, plusPoints: 0, minusPoints: 16, gamePoints: 0 },
        adjudicated: { isWinner: false, margin: 17, plusPoints: 0, minusPoints: 17, gamePoints: 0 } },
    ],
  };
  const admin = { async rpc() { return { data: base, error: null }; } };
  assert.equal((await lifecycle.getRule12Correction(admin, actorId, correctionId)).status, "applied");
  const bad = structuredClone(base);
  bad.projections[1].adjudicated.minusPoints = 16;
  await assert.rejects(() => lifecycle.getRule12Correction({ async rpc() { return { data: bad, error: null }; } }, actorId, correctionId), /unavailable/);

  const uncrossed = structuredClone(base);
  uncrossed.projections[0].adjudicated = structuredClone(uncrossed.projections[0].original);
  uncrossed.projections[1].adjudicated = structuredClone(uncrossed.projections[1].original);
  await assert.rejects(() => lifecycle.getRule12Correction({ async rpc() { return { data: uncrossed, error: null }; } }, actorId, correctionId), /unavailable/);

  const invalidPolicyState = structuredClone(base);
  invalidPolicyState.requiredApprovals = 0;
  invalidPolicyState.status = "pending";
  await assert.rejects(() => lifecycle.getRule12Correction({ async rpc() { return { data: invalidPolicyState, error: null }; } }, actorId, correctionId), /unavailable/);
});
