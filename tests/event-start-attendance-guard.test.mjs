import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, "utf8");
const migration = read("database/migrations/0236_event_start_requires_closed_attendance.sql");
const fixture = read("tests/event-start-attendance-guard.sql");
const teamStart = read("database/migrations/0174_october_team_scoring_and_seating_directory.sql");
const teamIntegrity = read("database/migrations/0185_team_paper_verification_and_start_integrity.sql");
const concurrencyRunner = read("tests/run-event-start-attendance-concurrency.ps1");
const concurrencyA = read("tests/event-start-attendance-lock-session-a.sql");
const concurrencyB = read("tests/event-start-attendance-lock-session-b.sql");
const raceSeed = read("tests/event-start-attendance-concurrency-seed.sql");
const raceA = read("tests/event-start-attendance-race-session-a.sql");
const raceB = read("tests/event-start-attendance-race-session-b.sql");
const dockerRaceRunner = read("tests/run-event-start-attendance-races-docker.ps1");

function functionBody(name) {
  const marker = `create function public.${name}`;
  const start = migration.indexOf(marker);
  assert.notEqual(start, -1, `${name} wrapper is missing`);
  const end = migration.indexOf("end $$;", start);
  assert.notEqual(end, -1, `${name} wrapper is unterminated`);
  return migration.slice(start, end);
}

test("start readiness requires a real closed window and resolved event-day attendance", () => {
  assert.match(migration, /event_attendance_ready_to_start_v1/);
  assert.match(migration, /window_row\.event_id=p_event_id and window_row\.state='closed'/);
  assert.match(migration, /event_attendance_unresolved_count_v1\(p_event_id\)=0/);
  assert.match(migration, /request_row\.request_state='pending_desk'/);
  assert.match(migration, /and app\.event_attendance_ready_to_start_v1\(p_event_id\)/);
  assert.match(functionBody("start_event_play_v1_before_sanctioning_snapshot"), /'attendance_or_seating_incomplete'/);
});

test("every singles attendance mutation and start shares the event lifecycle lock", () => {
  const wrappers = [
    "open_event_check_in_window_v1",
    "close_event_check_in_window_v1",
    "set_event_attendance_v1",
    "desk_check_in_event_v1",
    "submit_event_check_in_completion_v1",
    "enroll_roster_entries_in_event_v3",
    "start_event_play_v1_before_sanctioning_snapshot",
  ];
  for (const wrapper of wrappers) {
    assert.match(functionBody(wrapper), /perform app\.lock_event_attendance_lifecycle_v1\(/, `${wrapper} lacks the lifecycle lock`);
  }
  assert.match(migration, /'event-attendance-lifecycle:'\|\|p_event_id::text/);
});

test("idempotent wrappers replay exact receipts before current lifecycle state", () => {
  const wrappers = [
    "open_event_check_in_window_v1",
    "close_event_check_in_window_v1",
    "set_event_attendance_v1",
    "desk_check_in_event_v1",
    "enroll_roster_entries_in_event_v3",
    "start_event_play_v1_before_sanctioning_snapshot",
  ];
  for (const wrapper of wrappers) {
    const body = functionBody(wrapper);
    const operationLock = body.indexOf("pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||':'||p_idempotency_key::text,0))");
    const authorization = body.indexOf("from app.tournament_roles role_row");
    const receipt = body.indexOf("select * into v_existing from app.operation_receipts");
    const replay = body.indexOf("return v_existing.response_payload");
    const lifecycle = body.indexOf("perform app.lock_event_attendance_lifecycle_v1");
    assert.ok(operationLock >= 0 && authorization > operationLock && receipt > authorization && replay > receipt && lifecycle > replay,
      `${wrapper} must authorize after the operation lock, then replay before the lifecycle gate`);
  }
  for (const wrapper of ["enroll_roster_entries_in_event_v3", "start_event_play_v1_before_sanctioning_snapshot"]) {
    const body = functionBody(wrapper);
    assert.ok(body.indexOf("tournament.status='open' for update") < body.indexOf("select * into v_existing from app.operation_receipts"),
      `${wrapper} must retain the legacy locked open-tournament gate before replay`);
  }
});

test("post-start enrollment rejects only a fully validated event-scoped request", () => {
  const body = functionBody("enroll_roster_entries_in_event_v3");
  const started = body.indexOf("started.event_id=p_event_id and started.tournament_id=p_tournament_id");
  assert.match(body, /coalesce\(jsonb_typeof\(p_roster_entry_ids\),''\)<>'array'/);
  assert.match(body, /v_requested_count between 1 and 500/);
  assert.match(body, /count\(distinct \(item#>>'\{\}'\)::uuid\)=v_requested_count/);
  assert.match(body, /event_row\.id=p_event_id and event_row\.tournament_id=p_tournament_id/);
  assert.match(body, /event_row\.format='standard_singles' and event_row\.scoring_method='digital'/);
  assert.match(body, /app\.tournament_roster_entries roster_entry/);
  assert.match(body, /app\.roster_check_in_events check_in/);
  assert.ok(started > body.indexOf("app.roster_check_in_events check_in"), "start state was probed before request validation");
});

test("latest QR completion resolves its event then rechecks through the locked delegate", () => {
  const body = functionBody("submit_event_check_in_completion_v1");
  assert.match(body, /from app\.event_check_in_completion_sessions session_row/);
  assert.match(body, /app\.fixed_32_byte_equal/);
  assert.ok(body.indexOf("perform app.lock_event_attendance_lifecycle_v1(v_event_id)") < body.lastIndexOf("submit_event_check_in_completion_v1_before_start_guard"));
});

test("renamed delegates cannot bypass the service-role wrappers", () => {
  const delegates = [
    "open_event_check_in_window_v1_before_start_guard",
    "close_event_check_in_window_v1_before_start_guard",
    "set_event_attendance_v1_before_start_guard",
    "desk_check_in_event_v1_before_start_guard",
    "submit_event_check_in_completion_v1_before_start_guard",
    "enroll_roster_entries_in_event_v3_before_start_guard",
    "start_event_play_v1_before_attendance_guard",
  ];
  for (const delegate of delegates) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${delegate}\\([^;]+from public,anon,authenticated,service_role;`));
  }
  assert.match(migration, /revoke all on function public\.start_event_play_v1_legacy\([^;]+from public,anon,authenticated,service_role;/);
  assert.match(migration, /revoke all on function public\.submit_event_check_in_qr_request_v1\([^;]+from public,anon,authenticated,service_role;/);
  assert.match(migration, /grant execute on function public\.submit_event_check_in_completion_v1\(uuid,text,text,text,text,text\) to service_role/);
});

test("Doubles retains its team-entry readiness model instead of claiming empty participant attendance", () => {
  assert.doesNotMatch(migration, /alter function public\.start_event_team_play_v1/);
  assert.doesNotMatch(migration, /create function public\.start_event_team_play_v1/);
  assert.match(teamStart, /create or replace function public\.start_event_team_play_v1/);
  assert.match(teamIntegrity, /create trigger event_team_start_ready before insert on app\.event_team_starts/);
  assert.match(teamIntegrity, /app\.event_team_entries entry/);
  assert.match(migration, /Team\/Doubles start remains governed by 0174\/0185/);
});

test("rollback fixture covers each gate and an exact accepted replay", () => {
  assert.match(fixture, /^begin;/m);
  assert.ok(fixture.indexOf("'open','open'") < fixture.indexOf("insert into app.tournament_roster_entries"));
  assert.ok(fixture.indexOf("update app.tournaments set registration_status='closed'") > fixture.indexOf("insert into app.roster_check_in_events"));
  assert.match(fixture, /no-window start was not rejected/);
  assert.match(fixture, /open-window start was not rejected/);
  assert.match(fixture, /unresolved attendance start was not rejected/);
  assert.match(fixture, /pending-desk start was not rejected/);
  assert.match(fixture, /no-show was not treated as a resolved day-attendance disposition/);
  assert.match(fixture, /closed resolved start failed/);
  assert.match(fixture, /accepted singles retry changed/);
  assert.match(fixture, /revoked director replay was not rejected/);
  assert.match(fixture, /duplicated start/);
  assert.match(fixture, /post-start enrollment was not rejected/);
  assert.match(fixture, /post-start enrollment retry changed/);
  assert.match(fixture, /^rollback;/m);
});

test("local concurrency runner is structured for two rollback sessions", () => {
  assert.match(concurrencyRunner, /allowedHosts = @\("localhost", "127\.0\.0\.1", "::1"\)/);
  assert.match(concurrencyRunner, /Remote databases are refused/);
  assert.match(concurrencyRunner, /PGSERVICE is refused/);
  assert.match(concurrencyRunner, /PGHOSTADDR must be empty or loopback/);
  assert.match(concurrencyRunner, /Database must be a plain local database name/);
  assert.match(concurrencyRunner, /Parameter\(Mandatory = \$true\)/);
  assert.match(concurrencyRunner, /\$databaseArgs = @\("-d", \$Database\)/);
  assert.match(concurrencyRunner, /ProcessStartInfo/);
  assert.match(concurrencyRunner, /@\("-X", "-h", \$env:PGHOST/);
  assert.match(concurrencyRunner, /& \$psql\.Source -X -h \$env:PGHOST/);
  assert.match(concurrencyRunner, /session_b_waited_for_event_lifecycle_lock/);
  assert.match(concurrencyA, /pg_sleep\(4\)/);
  assert.match(concurrencyA, /^rollback;/m);
  assert.match(concurrencyB, /lifecycle_waited/);
  assert.match(concurrencyB, /^rollback;/m);
});

test("disposable Docker race suite covers real competing RPCs and persisted outcomes", () => {
  for (const scenario of ["start_reopen", "desk_start", "qr_close", "start_enrollment", "repeated_start"]) {
    assert.match(raceA, new RegExp(`'${scenario}'`));
    assert.match(raceB, new RegExp(`'${scenario}'`));
    assert.match(dockerRaceRunner, new RegExp(`"${scenario}"`));
  }
  assert.match(raceSeed, /begin;[\s\S]+commit;/);
  assert.match(raceSeed, /seed already exists; discard and recreate the isolated project/);
  assert.match(raceSeed, /insert into app\.tournament_setup_official_versions/);
  assert.match(raceSeed, /d2370000-0000-4000-8000-000000000010[\s\S]+a2370000-0000-4000-8000-000000000001[\s\S]+'director'/);
  assert.ok(raceSeed.indexOf("'open','open'") < raceSeed.indexOf("insert into app.tournament_roster_entries"));
  assert.ok(raceSeed.indexOf("update app.tournaments set registration_status='closed'") > raceSeed.indexOf("insert into app.roster_check_in_events"));
  assert.match(raceSeed, /roster_payment_obligation_versions/);
  assert.match(raceSeed, /f2370000-0000-4000-8000-000000000202[\s\S]+Synthetic zero-dollar desk race/);
  assert.match(raceSeed, /amount_owed_minor[\s\S]+Synthetic zero-dollar QR race/);
  assert.match(raceSeed, /event_check_in_completion_sessions/);
  assert.match(raceA, /EVENT_START_ATTENDANCE_A_READY_:scenario[\s\S]+pg_sleep\(4\)[\s\S]+commit;/);
  assert.match(raceB, /extract\(epoch from clock_timestamp\(\)-:'wait_started'::timestamptz\)>=2/);
  assert.match(raceB, /:'first_rejection_ok'::boolean/);
  assert.doesNotMatch(raceB, /select\s+:first_rejection_ok\b/);
  assert.match(raceB, /event_play_starts/);
  assert.match(raceB, /event_check_in_windows/);
  assert.match(raceB, /event_check_in_events/);
  assert.match(raceB, /event_check_in_requests/);
  assert.match(raceB, /event_participants/);
  assert.match(raceB, /operation_receipts/);
  assert.match(raceB, /audit_events/);
  assert.match(raceB, /:'retry_response'::jsonb=:'accepted_response'::jsonb/);
  assert.match(dockerRaceRunner, /supabase_db_cribbage-isolated-db-20261023/);
  assert.match(dockerRaceRunner, /com\.supabase\.cli\.project/);
  assert.match(dockerRaceRunner, /DOCKER_HOST overrides are refused/);
  assert.match(dockerRaceRunner, /DOCKER_CONTEXT must be empty or desktop-linux/);
  assert.ok(dockerRaceRunner.includes("npipe:////./pipe/dockerDesktopLinuxEngine"));
  assert.match(dockerRaceRunner, /@\("--context", \$dockerContext, "exec"/);
  assert.match(dockerRaceRunner, /\.State\.Running/);
  assert.match(dockerRaceRunner, /\.NetworkSettings\.Ports/);
  assert.match(dockerRaceRunner, /published database-container binding must use explicit 127\.0\.0\.1/);
  assert.match(dockerRaceRunner, /0236-event-start-attendance-race-evidence\.log/);
  assert.match(dockerRaceRunner, /Add-Content -LiteralPath \$evidenceLog/);
  assert.match(dockerRaceRunner, /EVENT_START_ATTENDANCE_A_COMMITTED_\$scenario/);
  assert.match(dockerRaceRunner, /EVENT_START_ATTENDANCE_B_COMMITTED_\$scenario/);
  assert.match(dockerRaceRunner, /ReadLineAsync\(\)/);
  assert.match(dockerRaceRunner, /post-RPC lock-held marker/);
  assert.doesNotMatch(dockerRaceRunner, /postgres(?:ql)?:\/\//i);
});
