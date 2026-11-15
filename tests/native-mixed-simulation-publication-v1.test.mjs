import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../database/proposals/native-mixed-simulation-publication-v1.sql", import.meta.url), "utf8");
const compact = sql.replace(/\s+/g, " ");

test("simulation publication stays private, default-off, immutable, and fully revoked", () => {
  assert.match(sql, /native_mixed_simulation_publication_enabled_v1\(\).*?select false/s);
  assert.doesNotMatch(sql, /grant execute/i);
  assert.match(sql, /force row level security/);
  assert.match(sql, /revoke all on table app\.%I from public,anon,authenticated,service_role/);
  assert.match(sql, /revoke all on function %s from public,anon,authenticated,service_role/);
  assert.match(sql, /execute function app\.reject_immutable_history\(\)/);
  const functions = [...sql.matchAll(/create function\s+(app\.[a-z0-9_]+)\(/g)].map(x => x[1]);
  const acl = sql.slice(sql.lastIndexOf("do $$declare p regprocedure"));
  for (const fn of functions) assert.match(acl, new RegExp(fn.replaceAll(".", "\\.")));
});

test("plan consumes sealed readiness as sim_ready and excludes ordinary attendance state", () => {
  assert.match(compact, /native_mixed_attendance_source_v1\(actor,tid,eid\)/);
  assert.match(compact, /a-'actorId'/);
  assert.match(compact, /not\(p\.attendance_capture\?'actorId'\)/);
  assert.match(compact, /jsonb_build_object\('rosterEntryId',x\.value->>'rosterEntryId','state','sim_ready'\)/);
  assert.match(compact, /count\(\*\)from app\.event_participants p where p\.tournament_id=tid and p\.event_id=eid\)<>18/);
  assert.match(compact, /p\.status<>'registered'/);
  for (const table of ["roster_check_in_events", "event_participant_status_events", "event_check_in_windows", "event_check_in_events", "event_check_in_requests"]) {
    assert.match(compact, new RegExp(`or exists\\(select 1 from app\\.${table}`));
  }
  assert.match(compact, /random_seating_config_error_v1\(request->'config',snapshot\)/);
  assert.match(compact, /reviewed_candidate_a18_valid_v1\(p\.config,p\.roster_snapshot,d\.candidate\)/);
  assert.ok(compact.includes('["A:1-2","A:3-4","A:5-6","A:7-8","A:9-10","A:11-12","A:13-14","A:15-16","A:17-18"]'));
  assert.match(compact, /request#>>'\{config,anchor,seatId\}'<>'A-1'/);
});

test("one retained draw attempt consumes bounded failure and exact replay never redraws", () => {
  assert.match(compact, /exists\(select 1 from app\.native_mixed_simulation_operations_v1 where tournament_id=tid and event_id=eid and action='draw'\).*?'draw_already_attempted'/);
  assert.match(compact, /native_mixed_simulation_insert_operation_v1\(actor,op,tid,eid,'draw',request\).*?random_seating_candidate_v1\(p\.config,p\.roster_snapshot\)/);
  assert.match(compact, /'bounded_search_exhausted'.*?'entropyConsumed',true,'retryWithNewOperationAuthorized',false/);
  assert.match(compact, /exception when others then r:=jsonb_build_object\('kind','native-mixed-simulation-receipt-v1','action','draw','status','rejected','code','simulation_draw_failed'.*?'entropyConsumed',true,'retryWithNewOperationAuthorized',false\)/);
  assert.match(compact, /select result into r from app\.native_mixed_simulation_outcomes_v1.*?return r\|\|jsonb_build_object\('currentSourceVerified',false,'historicalReceipt',true\)/);
  assert.equal((sql.match(/random_seating_candidate_v1\(/g) ?? []).length, 1);
});

test("native seating and canonical schedule are atomically tagged with simulation provenance", () => {
  assert.match(compact, /source_method in\('director_csv','director_entry','native_mixed_simulation_v1'\)/);
  assert.match(compact, /insert into app\.initial_seating_publications/);
  assert.match(compact, /insert into app\.initial_seating_assignments/);
  assert.match(compact, /insert into app\.event_schedule_publications values\(sched_publication,tid,eid,'native_mixed_simulation_v1',12,18,108/);
  assert.match(compact, /insert into app\.rounds\(tournament_id,event_id,round_number\).*?generate_series\(1,12\)/);
  assert.match(compact, /insert into app\.canonical_games/);
  assert.match(compact, /insert into app\.event_schedule_games/);
  assert.match(compact, /pg_backend_pid\(\),txid_current\(\)/);
  assert.match(compact, /deferrable initially deferred/);
  assert.match(compact, /native mixed simulation schedule sidecar required/);
  assert.match(compact, /native mixed simulation seating sidecar required/);
  assert.match(compact, /jsonb_array_length\(ss\.assignments_capture\)=18/);
  assert.match(compact, /jsonb_array_length\(gs\.games_capture\)=108/);
  assert.match(compact, /count\(\*\)from app\.rounds x where x\.event_id=c\.event_id\)=12/);
  assert.match(compact, /count\(\*\)from app\.event_schedule_games x where x\.publication_id=ep\.id\)=108/);
  assert.match(compact, /count\(\*\)from app\.canonical_games x where x\.event_id=c\.event_id\)=108/);
});

test("postcondition binds operation, receipts, audits, actual IDs, graph, and source captures", () => {
  for (const fn of ["operation_bound", "plan_bound", "draw_bound", "review_bound", "publication_bound"]) {
    assert.match(sql, new RegExp(`native_mixed_simulation_${fn}_v1`));
  }
  assert.match(compact, /sr\.operation_type='publish_native_mixed_simulation_seating_v1'.*?er\.operation_type='publish_native_mixed_simulation_schedule_v1'/);
  assert.match(compact, /sr\.target_id=sp\.id and er\.target_id=ep\.id/);
  assert.match(compact, /c\.source_capture=jsonb_build_object\('attendance',p\.attendance_capture/);
  assert.match(compact, /'nativeAssignments',ss\.assignments_capture,'nativeGames',gs\.games_capture/);
  assert.match(compact, /x\.result->>'status'='accepted'/);
  assert.match(compact, /a\.id=\(x->>'assignmentId'\)::uuid.*?p\.id=\(x->>'participantId'\)::uuid/s);
  assert.match(compact, /candidate\.value->>'participantId'=x->>'rosterEntryId'and candidate\.value->>'tournamentId'=x->>'fixedId'/);
  assert.match(compact, /g\.id=\(x->>'gameId'\)::uuid.*?g\.side_b_table_seat_snapshot=x->>'sideBTableSeat'/s);
  assert.match(compact, /candidate\.ord=\(x->>'importRowNumber'\)::bigint.*?side_a\.id=\(x->>'sideAParticipantId'\)::uuid.*?side_b\.id=\(x->>'sideBParticipantId'\)::uuid/);
  assert.match(compact, /x\.action='native_mixed_simulation_seating_published'/);
  assert.match(compact, /x\.action='native_mixed_simulation_schedule_published'/);
});

test("actor operation IDs are reserved both ways across admission, funding, and attendance", () => {
  assert.match(compact, /native_mixed_attendance_operation_reserved_v1\(actor,op\)is true/);
  assert.match(compact, /exists\(select 1 from app\.native_mixed_simulation_operations_v1 x where x\.actor_id=new\.actor_id and x\.operation_id=new\.operation_id\)/);
  for (const table of ["native_mixed_admission_operations_v1", "native_mixed_funding_operations_v1", "native_mixed_attendance_operations_v1"]) {
    assert.match(compact, new RegExp(`before insert on app\\.${table} for each row execute function app\\.reject_native_mixed_simulation_operation_reuse_v1`));
  }
});

test("private source uses the exact truthful publication DTO and no ordinary writer claim", () => {
  for (const fragment of [
    "'status','source_available'", "'kind','native-mixed-simulation-schedule-source-v1'", "'attendance',attendance_source",
    "'plan',plan_source", "'draw',draw_source", "'review',review_source", "'publication',publication_source",
    "'fixedAssignments',assignments", "'canonicalGames',games", "'sourceMethod','native_mixed_simulation_v1'",
    "'assignmentCount',18,'roundCount',12,'matchCount',108", "'simulationRosterProjected',true",
    "'nativeInitialSeatingPublished',true", "'nativeCanonicalSchedulePublished',true"
  ]) assert.ok(compact.includes(fragment), fragment);
  for (const flag of ["ordinaryAttendanceUsed", "ordinaryInitialSeatingWriterUsed", "ordinaryScheduleWriterUsed",
    "humanPresenceVerified", "paymentVerified", "moneyMoved", "normalStartAuthorized", "payoutAuthorized", "finalizationAuthorized"]) {
    assert.match(compact, new RegExp(`'${flag}',false`));
  }
  assert.doesNotMatch(compact, /public\.publish_initial_seating/);
  assert.doesNotMatch(compact, /publish_director_reviewed_event_schedule/);
  assert.doesNotMatch(compact, /(?:insert into|update|delete from) app\.(?:roster_check_in_events|event_check_in_events|event_check_in_requests|event_participant_status_events|event_play_starts|roster_payment_events|roster_payment_obligation_versions)/);
});


function requestKeyList(action) {
  const start = sql.indexOf(`create function app.native_mixed_simulation_${action}_request_valid_v1`);
  assert.ok(start >= 0);
  const body = sql.slice(start, sql.indexOf("$$;", start));
  const match = body.match(/array_agg\(k order by k\).*?=array\[([^\]]+)\]/s);
  assert.ok(match, `${action} exact-key guard`);
  return [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]);
}

test("review exact-key guard accepts the intended fields and rejects extra or missing fields", () => {
  const valid = {
    kind: "native-mixed-simulation-review-v1", operationId: "a1111111-1111-4111-8111-111111111111",
    drawId: "b1111111-1111-4111-8111-111111111111", expectedDrawDigest: "a".repeat(64),
    expectedAttendanceSourceDigest: "b".repeat(64), decision: "accepted-test-simulation-only",
    humanPresenceNotVerified: true, simulationLayoutReviewed: true, fictionalPaperAcknowledged: true,
    reason: "TEST ONLY review validator regression"
  };
  const expected = requestKeyList("review");
  // Structural proof of the SQL array_agg ORDER BY / exact-array comparison,
  // not a substitute for executing the complete validator in PostgreSQL.
  const keysMatch = value => JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expected);
  assert.equal(keysMatch(valid), true);
  assert.equal(keysMatch(Object.fromEntries(Object.entries(valid).reverse())), true);
  assert.equal(keysMatch({...valid, unexpected: true}), false);
  const missing = {...valid}; delete missing.fictionalPaperAcknowledged;
  assert.equal(keysMatch(missing), false);
});

test("all simulation request exact-key arrays have unique canonical ordering", () => {
  for (const action of ["plan", "draw", "review", "publish"]) {
    const keys = requestKeyList(action);
    assert.equal(new Set(keys).size, keys.length, `${action} duplicate key`);
    assert.deepEqual(keys, [...keys].sort(), `${action} key order must match SQL ORDER BY`);
  }
});


test("shared sidecar trigger branches by table before accessing table-specific NEW fields", () => {
  const start = sql.indexOf("create function app.require_native_mixed_simulation_sidecar_v1()");
  const body = sql.slice(start, sql.indexOf("end$$;", start));
  assert.match(body, /if tg_table_name='event_schedule_publications'then\s+if new\.source_method=/);
  assert.match(body, /elsif tg_table_name='initial_seating_publications'then\s+if exists/);
  assert.doesNotMatch(body, /tg_table_name='[^']+'and new\./);
  assert.match(body, /native mixed simulation schedule sidecar required/);
  assert.match(body, /native mixed simulation seating sidecar required/);
});
