import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isAcceptedPaperGameCompletion,
  isAcceptedPaperGameReview,
  isCompletePaperGameRequest,
  isPaperGameOperationReconciliationRequest,
  isRejectedPaperGameCompletion,
  isReviewPaperGameRequest,
} from "../src/lib/api/paper-game-completion.ts";
import {
  LOCAL_CARD_PHOTO_MAX_BYTES,
  validateLocalCardPhoto,
} from "../src/lib/paper-games/local-card-photo.ts";

const completionId = "10000000-0000-4000-8000-000000000001";
const eventId = "20000000-0000-4000-8000-000000000002";
const gameId = "30000000-0000-4000-8000-000000000003";
const idempotencyKey = "40000000-0000-4000-8000-000000000004";
const request = {
  completionId, eventId, gameId, expectedGameVersion: 2,
  sideAClaim: { winnerSide: "a", margin: 31, evidenceReference: "card A-1" },
  sideBClaim: { winnerSide: "a", margin: 31, evidenceReference: "card A-2" },
  idempotencyKey,
};

test("paper completion request requires exact bounded card claims", () => {
  assert.equal(isCompletePaperGameRequest(request), true);
  assert.equal(isCompletePaperGameRequest({ ...request, expectedGameVersion: 0 }), false);
  assert.equal(isCompletePaperGameRequest({ ...request, sideAClaim: { ...request.sideAClaim, margin: 122 } }), false);
  assert.equal(isCompletePaperGameRequest({ ...request, sideAClaim: { ...request.sideAClaim, evidenceReference: "" } }), false);
  assert.equal(isCompletePaperGameRequest({ ...request, sideAClaim: { ...request.sideAClaim, gamePoints: 3 } }), false);
  assert.equal(isCompletePaperGameRequest({ ...request, extra: true }), false);
});

test("local paper-card photo aid accepts only bounded browser images", () => {
  assert.deepEqual(validateLocalCardPhoto({ type: "image/jpeg", size: 1 }), { accepted: true });
  assert.deepEqual(validateLocalCardPhoto({ type: "image/png", size: LOCAL_CARD_PHOTO_MAX_BYTES }), { accepted: true });
  assert.equal(validateLocalCardPhoto({ type: "image/heic", size: 100 }).accepted, false);
  assert.equal(validateLocalCardPhoto({ type: "image/jpeg", size: 0 }).accepted, false);
  assert.equal(validateLocalCardPhoto({ type: "image/webp", size: LOCAL_CARD_PHOTO_MAX_BYTES + 1 }).accepted, false);
});

test("paper operation reconciliation requests are exact and actor-routable", () => {
  assert.equal(isPaperGameOperationReconciliationRequest({ operationType: "complete_paper_vs_paper_game_v1", targetId: completionId, idempotencyKey }), true);
  assert.equal(isPaperGameOperationReconciliationRequest({ operationType: "invented", targetId: completionId, idempotencyKey }), false);
  assert.equal(isPaperGameOperationReconciliationRequest({ operationType: "review_paper_vs_paper_game_v1", targetId: completionId, idempotencyKey, extra: true }), false);
});

test("first paper-card transcription remains pending and non-authoritative", () => {
  const accepted = { status: "pending_review", completionId,
    tournamentId: "50000000-0000-4000-8000-000000000005", eventId, gameId,
    gameVersion: 2, winnerSide: "a", margin: 31, evidenceCount: 2, authoritative: false };
  assert.equal(isAcceptedPaperGameCompletion(accepted, request), true);
  assert.equal(isAcceptedPaperGameCompletion({ ...accepted, authoritative: true }, request), false);
  assert.equal(isAcceptedPaperGameCompletion({ ...accepted, gameVersion: 3 }, request), false);
  assert.equal(isRejectedPaperGameCompletion({ status: "rejected", code: "nonreciprocal_card_claims", completionId }, completionId), true);
  assert.equal(isRejectedPaperGameCompletion({ status: "rejected", code: "invented", completionId }, completionId), false);
});

test("second official review uses an exact request and proves authority only on approval", () => {
  const review = { decision: "approve", expectedGameVersion: 2, sideAClaim: request.sideAClaim,
    sideBClaim: request.sideBClaim, idempotencyKey };
  assert.equal(isReviewPaperGameRequest(review), true);
  assert.equal(isReviewPaperGameRequest({ ...review, extra: true }), false);
  const accepted = { status: "approved", decision: "approve", completionId, gameId,
    gameVersion: 3, authoritative: true, scorelinesCreated: true };
  assert.equal(isAcceptedPaperGameReview(accepted, completionId, review), true);
  assert.equal(isAcceptedPaperGameReview({ ...accepted, authoritative: false }, completionId, review), false);
});

test("migration preserves paper evidence and keeps authority server-only", () => {
  const sql = readFileSync(new URL("../database/migrations/0144_paper_vs_paper_authoritative_completion.sql", import.meta.url), "utf8").toLowerCase();
  for (const table of ["paper_game_completions", "paper_game_completion_evidence", "paper_game_completion_reviews", "paper_game_completion_state_events", "paper_game_completion_conflicts"]) {
    assert.match(sql, new RegExp(`create table app\\.${table}`));
    assert.match(sql, new RegExp(`${table}.*immutable`, "s"));
  }
  assert.match(sql, /role='cross_checker'/);
  assert.match(sql, /official identity unconfirmed/);
  assert.match(sql, /nonreciprocal card claims/);
  assert.match(sql, /claimed_game_points smallint not null check \(claimed_game_points in \(0,2,3\)\)/);
  assert.match(sql, /paper completion cannot fabricate player submissions or confirmations/);
  assert.match(sql, /authoritative paper completion blocks duplicate game history/);
  assert.match(sql, /p_expected_game_version/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /paper_vs_paper_game_completed/);
  assert.match(sql, /reviewer not independent/);
  assert.match(sql, /review claims mismatch/);
  assert.match(sql, /case_sequence integer not null/);
  assert.match(sql, /unique \(canonical_game_id,case_sequence\)/);
  assert.doesNotMatch(sql, /unique \(canonical_game_id\)[,\n]/);
  assert.match(sql, /paper_game_completion_latest_state/);
  assert.match(sql, /latest_state\(completion\.id\)<>'rejected'/);
  assert.match(sql, /join app\.event_schedule_games schedule_game/);
  assert.match(sql, /join app\.event_schedule_publications publication/);
  assert.match(sql, /device_recovery_excludes_paper_completion/);
  assert.match(sql, /paper_completion_excludes_device_recovery/);
  assert.match(sql, /manual-game-evidence:/);
  assert.match(sql, /create table app\.paper_official_identity_bindings/);
  assert.match(sql, /binding_version integer not null/);
  assert.match(sql, /supersedes_binding_id uuid/);
  assert.match(sql, /p_expected_binding_version integer/);
  assert.match(sql, /p_actor_id=p_official_profile_id/);
  assert.match(sql, /order by binding_row\.binding_version desc limit 1/);
  assert.match(sql, /paper_official_identity_binding_rejected/);
  assert.match(sql, /profile_is_tournament_participant/);
  assert.match(sql, /roster_account_links link where link\.tournament_id=p_tournament_id and link\.profile_id=p_official_profile_id/);
  assert.match(sql, /event_participants participant where participant\.tournament_id=p_tournament_id and participant\.profile_id=p_official_profile_id/);
  assert.match(sql, /guard_paper_nonparticipant_identity/);
  assert.match(sql, /roster_account_link_blocks_nonparticipant_official/);
  assert.match(sql, /event_participant_blocks_nonparticipant_official/);
  assert.match(sql, /profile has a current nonparticipant official binding/);
  assert.match(sql, /'stale_binding_version'/);
  assert.match(sql, /'pending_review'.*false/s);
  assert.match(sql, /if p_decision='approve' then[\s\S]*insert into app\.card_scorelines/);
  assert.match(sql, /grant execute on function public\.review_paper_vs_paper_game_v1[\s\S]*to service_role/);
  assert.match(readFileSync(new URL("./paper-game-completion.sql", import.meta.url), "utf8"), /request\.jwt\.claim\.role','service_role'[\s\S]*set local role service_role/);
  assert.match(sql, /paper_vs_paper_game_completion_rejected/);
  assert.match(sql, /revoke all on function public\.complete_paper_vs_paper_game_v1[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /grant (select|insert|update|delete|all) on table/i);
});

test("controlled-error reconciliation revalidates current authority before receipts", () => {
  const sql = readFileSync(new URL("../database/migrations/0144_paper_vs_paper_authoritative_completion.sql", import.meta.url), "utf8").toLowerCase();
  assert.doesNotMatch(sql, /v_authorized/);
  const complete = sql.slice(sql.indexOf("create or replace function public.complete_paper_vs_paper_game_v1"), sql.indexOf("create or replace function public.review_paper_vs_paper_game_v1"));
  const review = sql.slice(sql.indexOf("create or replace function public.review_paper_vs_paper_game_v1"), sql.indexOf("create or replace function public.get_paper_game_operation_reconciliation_v1"));
  assert.match(complete, /p_actor_id::text\|\|':'\|\|p_operation_id::text[\s\S]*from app\.tournaments where id=p_tournament_id for update[\s\S]*paper-official:[\s\S]*role='cross_checker' limit 1 for update[\s\S]*order by binding_version desc limit 1 for update[\s\S]*select \* into v_existing from app\.operation_receipts[\s\S]*v_tournament_status is distinct from 'open'/);
  assert.match(sql, /v_first_identity_binding\.id<>v_completion\.official_identity_binding_id[\s\S]*first official identity changed/);
  assert.match(review, /p_actor_id::text\|\|':'\|\|p_operation_id::text[\s\S]*paper-completion:[\s\S]*from app\.tournaments where id=v_completion\.tournament_id for update[\s\S]*paper-official:[\s\S]*role in \('director','co_director','cross_checker'\)[\s\S]*v_first_identity_binding[\s\S]*v_identity_binding[\s\S]*select \* into v_existing from app\.operation_receipts[\s\S]*v_tournament_status is distinct from 'open'/);
  assert.match(sql, /get_paper_game_operation_reconciliation_v1[\s\S]*receipt\.actor_profile_id=p_actor_id[\s\S]*receipt\.tournament_id=p_tournament_id[\s\S]*receipt\.client_operation_id=p_operation_id[\s\S]*receipt\.operation_type=p_operation_type[\s\S]*receipt\.target_id=p_target_id/);
  const fixture = readFileSync(new URL("./paper-game-completion.sql", import.meta.url), "utf8").toLowerCase();
  assert.match(fixture, /revoked_replay[\s\S]*not_cross_checker/);
  assert.match(fixture, /revoked_review_replay[\s\S]*not_eligible_reviewer/);
  assert.match(fixture, /orphan_game[\s\S]*game_not_scheduled/);
  assert.match(fixture, /recovery_blocks_paper[\s\S]*device_recovery_case_exists/);
  assert.match(fixture, /another manual evidence case already open/);
  assert.match(fixture, /paper_case_rejected[\s\S]*paper_case_two[\s\S]*max\(case_sequence\)/);
  assert.match(fixture, /binding_correction_replay[\s\S]*binding_stale_replay/);
  assert.match(fixture, /nonparticipant roster-link race unexpectedly succeeded/);
  assert.match(fixture, /nonparticipant event-link race unexpectedly succeeded/);
  assert.match(fixture, /closed_completion_replay[\s\S]*closed_review_replay/);
  assert.match(fixture, /closed_identity_replay/);
  assert.match(fixture, /correction_before_review[\s\S]*first_official_identity_changed/);
});

test("paper completion route and page enforce protected cross-check access", () => {
  const route = readFileSync(new URL("../src/app/api/v1/tournaments/[id]/paper-game-completions/route.ts", import.meta.url), "utf8");
  assert.match(route, /isSameOriginRequest\(request\)/);
  assert.match(route, /requireVerifiedSubject\(await createClient\(\)\)/);
  assert.match(route, /createServerOnlyAdminClient\(\)\.rpc\("complete_paper_vs_paper_game_v1"/);
  const page = readFileSync(new URL("../src/app/tournament/[tournamentId]/paper-games/page.tsx", import.meta.url), "utf8");
  assert.match(page, /director.*co_director.*cross_checker/);
  assert.match(page, /second, distinct authorized official/i);
  const client = readFileSync(new URL("../src/app/tournament/[tournamentId]/paper-games/paper-game-client.tsx", import.meta.url), "utf8");
  assert.match(client, /paper-game-completion:\$\{actorId\}:\$\{gameId\}/);
  assert.match(client, /Retry the same locked request/);
  assert.match(client, /isRejectedPaperGameCompletion/);
  assert.match(client, /first official&apos;s entries are intentionally hidden/i);
  assert.match(client, /Approval is blocked; reject this entry for investigation/);
  assert.match(client, /disabled=\{!storageReady \|\| !entered \|\| busy/);
  assert.match(client, /Checking prior request/);
  assert.match(client, /paper-official-identity:\$\{actorId\}:\$\{tournamentId\}/);
  assert.match(client, /prior identity update may be unresolved/i);
  assert.match(client, /paper-game-operations\/reconciliation/);
  assert.match(client, /saved paper-card operation/);
  assert.match(client, /Retry the same locked request/);
  assert.match(client, /LocalPaperCardPhoto/);
  const photo = readFileSync(new URL("../src/components/local-paper-card-photo.tsx", import.meta.url), "utf8");
  assert.match(photo, /capture="environment"/);
  assert.match(photo, /image\/jpeg,image\/png,image\/webp/);
  assert.match(photo, /stays on this device and is not uploaded/i);
  assert.doesNotMatch(photo, /fetch\(|supabase|uploadToSignedUrl/);
  const reviewRoute = readFileSync(new URL("../src/app/api/v1/paper-game-completions/[id]/reviews/route.ts", import.meta.url), "utf8");
  assert.match(reviewRoute, /rpc\("review_paper_vs_paper_game_v1"/);
  assert.match(reviewRoute, /isSameOriginRequest/);
  const reconciliationRoute = readFileSync(new URL("../src/app/api/v1/tournaments/[id]/paper-game-operations/reconciliation/route.ts", import.meta.url), "utf8");
  assert.match(reconciliationRoute, /requireVerifiedSubject/);
  assert.match(reconciliationRoute, /get_paper_game_operation_reconciliation_v1/);
  assert.doesNotMatch(reconciliationRoute, /\.from\(/);
});

test("workspace includes roster-backed scheduled games without requiring profiles", () => {
  const sql = readFileSync(new URL("../database/migrations/0144_paper_vs_paper_authoritative_completion.sql", import.meta.url), "utf8").toLowerCase();
  assert.match(sql, /join app\.tournament_roster_entries roster_a on roster_a\.id=participant_a\.roster_entry_id/);
  assert.match(sql, /left join app\.profiles profile_a/);
  assert.match(sql, /not exists\(select 1 from app\.score_submissions/);
  assert.match(sql, /app\.recovery_participant_profile_id/);
  assert.match(sql, /'reviewcases'/);
});
