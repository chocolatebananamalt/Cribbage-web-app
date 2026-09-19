import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("database/migrations/0178_team_scoring_integrity_and_recovery.sql", "utf8");
const lifecycle = readFileSync("database/migrations/0183_team_claim_lifecycle_directory_privacy.sql", "utf8");
const poolSql = readFileSync("database/migrations/0180_team_side_pool_workspace.sql", "utf8");
const correctionSql = readFileSync("database/migrations/0182_team_corrections_and_result_integrity.sql", "utf8");
const releaseSql = readFileSync("database/migrations/0185_team_paper_verification_and_start_integrity.sql", "utf8");
const offlineIdempotencySql = readFileSync("database/migrations/0189_team_offline_capability_idempotency.sql", "utf8");
const hostedFixture = readFileSync("tests/october-team-scoring.sql", "utf8");

test("team hardening adds cross-event foreign keys and exact team shape", () => {
  for (const token of [
    "event_team_games_publication_scope_fk",
    "event_team_games_a_scope_fk",
    "event_team_games_b_scope_fk",
    "event_team_score_submissions_game_scope_fk",
    "event_team_score_confirmations_game_scope_fk",
    "event_team_members_shape",
    "exactly two members and one captain",
    "event_team_game_member_snapshot",
    "event_team_schedule_complete",
    "team schedule is incomplete",
  ]) assert.match(sql, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("team claims are append-only and linked to the claiming roster account", () => {
  assert.match(sql, /claim_event_team_partner_v1/);
  assert.match(sql, /roster_account_links/);
  assert.match(sql, /event_team_member_claim_versions/);
  assert.match(sql, /team member binding is append-only/);
});

test("seating directory fails closed until published and supports bounded search", () => {
  assert.match(sql, /initial_seating_assignments/);
  assert.match(sql, /event_team_seating_publications/);
  assert.match(sql, /claimed_acc_number/);
  assert.match(sql, /currentTableSeat/);
  assert.match(sql, /get_tournament_seating_directory_v1/);
  assert.match(sql, /p_query text/);
});

test("offline team replay and verified-only team results are explicit", () => {
  for (const token of [
    "event_team_offline_capabilities",
    "event_team_offline_replays",
    "get_event_team_results_v1",
    "not_applicable_satellite",
    "state in('verified','corrected')",
    "submit_event_team_paper_score_v1",
    "issue_event_team_offline_capability_v1",
    "replay_event_team_offline_score_v1",
  ]) assert.match(sql, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(poolSql,/teamBeneficiaries/);
});

test("team claim transition is narrowly authorized and creation stops after lifecycle lock", () => {
  assert.match(lifecycle, /drop trigger if exists event_team_members_immutable/);
  assert.match(lifecycle, /team member identity is immutable/);
  assert.match(lifecycle, /team member claim must match the linked roster account/);
  assert.match(lifecycle, /registration_status='open'/);
  assert.match(lifecycle, /event_team_seating_publications/);
  assert.match(lifecycle, /event_team_score_submissions/);
  assert.match(lifecycle, /'event_locked'/);
});

test("directory requires a selected event and permits linked paper participants", () => {
  assert.match(lifecycle, /p_event_id uuid,p_query text/);
  assert.match(lifecycle, /event_participants ep join app\.roster_account_links/);
  assert.match(lifecycle, /event_team_seating_publications/);
  assert.match(lifecycle, /get_tournament_seating_directory_unbounded_v1/);
  const route = readFileSync("src/app/api/v1/tournaments/[id]/seating-directory/route.ts", "utf8");
  assert.match(route, /!eventId/);
  const client = readFileSync("src/app/tournament/[tournamentId]/seating-directory/seating-directory-client.tsx", "utf8");
  assert.match(client, /URLSearchParams\(\{event:eventId\}\)/);
  assert.match(client, /<th>Event<\/th>/);
});

test("participant team workspace exposes registration choices without exposing other account ids", () => {
  assert.match(releaseSql, /link\.profile_id=p_actor_id then link\.profile_id else null/);
  assert.match(releaseSql, /not staff and not linked/);
  assert.match(releaseSql, /canManage/);
});

test("team corrections preserve original values and follow the correction policy",()=>{
  for(const token of ["previous_winner_side","previous_margin","reason_required","required_approvals","independent_official_required","independent_reviewer_required","team_correction_pending","team_correction_applied","stale_game_version"]) assert.match(correctionSql,new RegExp(token));
  assert.match(correctionSql,/game_points desc,games_won desc,net_points desc,plus_points desc/);
});

test("paper team evidence needs card identity, a second official review, and two confirmations",()=>{
  for(const token of ["event_team_paper_score_evidence","paper_card_reference","event_team_paper_score_reviews","second non-participant official","review_event_team_paper_score_v1","paper review required before confirmation","try_finalize_event_team_game_v2","confirmation_count<>2"]) assert.match(releaseSql,new RegExp(token));
  assert.match(releaseSql,/submission\.source_method='paper_transcription'[\s\S]*review\.matched/);
  assert.match(releaseSql,/submit_event_team_score_v1[\s\S]*wrong_scorecard_authority/);
});

test("team activation, publication, and start require the supported locked capability",()=>{
  for(const token of ["for update","registration_status='open'","registration_status='closed'","doubles","canadian_doubles","scoring_method='digital'","ruleset.approved_at is not null","event_team_offline_replays","event_team_score_correction_reviews","event_team_seating_capability_guard","event_team_schedule_capability_guard","event_team_start_ready"]) assert.match(releaseSql,new RegExp(token));
});

test("mismatches preserve submissions and need two independent officials",()=>{
  for(const token of ["event_team_mismatch_resolutions","event_team_mismatch_resolution_reviews","team_mismatch_resolution_pending","independent_reviewer_required","team_mismatch_resolution_applied"]) assert.match(releaseSql,new RegExp(token));
  assert.doesNotMatch(releaseSql,/delete from app\.event_team_score_submissions/i);
});

test("team submit and confirmation retries resolve receipts before current game state",()=>{
  for(const fn of ["submit_event_team_score_v1","submit_event_team_paper_score_v1","review_event_team_paper_score_v1","confirm_event_team_score_v1"]){
    const body=releaseSql.slice(releaseSql.indexOf(`function public.${fn}`),releaseSql.indexOf("end $$;",releaseSql.indexOf(`function public.${fn}`)));
    assert.ok(body.indexOf("select * into prior")<body.indexOf("game_row.state"),`${fn} must check the receipt first`);
    assert.match(body,/idempotency_conflict/);
  }
});

test("offline capability retries resolve the immutable binding before mutable game state",()=>{
  const prior=offlineIdempotencySql.indexOf("select * into prior from app.event_team_offline_capabilities");
  const game=offlineIdempotencySql.indexOf("select * into game from app.event_team_games");
  assert.ok(prior>=0&&game>=0&&prior<game);
  for(const token of ["team-offline-capability:","is distinct from p_session_binding_id","idempotency_conflict","prior.assigned_side","prior.submission_slot","prior.expected_game_version","prior.expires_at"]) assert.match(offlineIdempotencySql,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
});

test("hosted rollback fixture covers all team evidence modes, mismatch, authority, and offline lost response",()=>{
  for(const token of [
    "Digital/digital mismatch","Digital/paper","Paper/paper","participant treated as official",
    "self-confirmation accepted","paper self-review accepted","team_mismatch_resolution_applied",
    "outsider received offline capability","non-scorer submitted digital score",
    "lost issuance response was not replayed exactly","offline capability conflict accepted",
    "offline replay conflict accepted","set constraints all immediate","rollback;",
  ]) assert.match(hostedFixture,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
});

test("the seating directory offers an event to choose when none is in the URL", () => {
  const page = readFileSync("src/app/tournament/[tournamentId]/seating-directory/page.tsx", "utf8");
  const client = readFileSync("src/app/tournament/[tournamentId]/seating-directory/seating-directory-client.tsx", "utf8");
  const hub = readFileSync("src/app/tournament/[tournamentId]/page.tsx", "utf8");
  // The client still has no picker of its own, which is why the page must supply one.
  assert.match(client, /const\[data,setData\][\s\S]*?\[eventId\]=useState\(initialEventId\)/);
  assert.match(client, /Choose a specific event to open its published seating directory\./);
  // The hub link carries no event, so the no-event path is the one a director hits.
  assert.match(hub, /href=\{`\/tournament\/\$\{tournamentId\}\/seating-directory`\}/);
  assert.match(page, /seating-directory\?event=\$\{item\.eventId\}/);
  assert.match(page, /Open published seating/);
  assert.match(page, /No tournament events are active yet, so no seating has been published\./);
  assert.ok(page.indexOf("chooser?") < page.indexOf("<SeatingDirectoryClient"));
  // The listing RPC serves only these roles and the helper turns its null into
  // notFound(), so an ungated chooser would 404 a judge who used to reach the
  // page. 0183 made the per-event requirement a privacy boundary, so passing a
  // null event instead of listing events is not an option.
  const listing = readFileSync("database/migrations/0146_scorecard_preference_and_results_discovery.sql", "utf8");
  const privacy = readFileSync("database/migrations/0183_team_claim_lifecycle_directory_privacy.sql", "utf8");
  assert.match(listing, /get_tournament_result_events_v1/);
  assert.match(listing, /r[.]role in\('viewer','player','cross_checker','director','co_director'\)/);
  assert.match(privacy, /and p_event_id is not null/);
  assert.match(page, /const canListEvents=\["viewer","player","cross_checker","director","co_director"\]\.some\(\(role\)=>access\.roles\.includes\(role\)\);/);
  assert.match(page, /const chooser=event\|\|!canListEvents\?null:await getTournamentResultEventSummary/);
});
