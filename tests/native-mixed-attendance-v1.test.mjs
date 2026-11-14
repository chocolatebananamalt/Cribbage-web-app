import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const sql = readFileSync(new URL("../database/proposals/native-mixed-attendance-v1.sql", import.meta.url), "utf8");
const transport = readFileSync(new URL("../database/proposals/native-mixed-attendance-consent-transport-v1.sql", import.meta.url), "utf8");
const compact = sql.replace(/\s+/g, " ");

test("native mixed attendance stays private, default-off, and immutable", () => {
  assert.match(sql, /native_mixed_attendance_enabled_v1\(\).*?select false/s);
  assert.doesNotMatch(sql, /grant execute/i);
  assert.match(sql, /revoke all on table app\.%I from public,anon,authenticated,service_role/);
  assert.match(sql, /revoke all on function %s from public,anon,authenticated,service_role/);
  assert.equal((sql.match(/force row level security/g) ?? []).length, 1);
  for (const table of ["native_mixed_attendance_operations_v1", "native_mixed_attendance_scopes_v1",
    "native_mixed_digital_consent_decisions_v1", "native_mixed_paper_declarations_v1",
    "native_mixed_paper_declaration_entries_v1", "native_mixed_paper_reviews_v1",
    "native_mixed_attendance_seals_v1", "native_mixed_attendance_outcomes_v1"]) {
    assert.match(sql, new RegExp(table));
  }
  assert.match(sql, /execute function app\.reject_immutable_history\(\)/);
});

test("scope and seal are pre-draw readiness evidence without future identifiers", () => {
  assert.match(compact, /not exists\(select 1 from app\.random_seating_draws_v1 where tournament_id=tid\)/);
  assert.match(compact, /not exists\(select 1 from app\.initial_seating_publications where tournament_id=tid\)/);
  assert.match(compact, /not exists\(select 1 from app\.event_schedule_publications where tournament_id=tid and event_id=eid\)/);
  assert.match(compact, /not exists\(select 1 from app\.event_play_starts where tournament_id=tid and event_id=eid\)/);
  assert.match(compact, /'predraw_simulation_readiness_sealed'/);
  assert.match(compact, /'normalDrawAuthorized',false,'normalStartAuthorized',false/);
  const projection = sql.slice(sql.indexOf("create function app.native_mixed_attendance_projection_v1"),
    sql.indexOf("create function app.seal_native_mixed_attendance_v1"));
  assert.doesNotMatch(projection, /reviewedDrawId|initialSeatingPublicationId|schedulePublicationId|fixedId/);
});

test("six Digital grants are self-subject decisions and revocation survives seal or Start", () => {
  assert.match(compact, /declare actor uuid:=auth\.uid\(\)/);
  assert.match(compact, /x->>'mode'='digital'and x->>'profileId'=actor::text/);
  assert.match(compact, /check\(actor_id=profile_id\)/);
  assert.match(compact, /decision text not null check\(decision in\('granted','revoked'\)\)/);
  assert.match(compact, /if request->>'decision'='granted'and\(exists\(select 1 from app\.native_mixed_attendance_seals_v1/);
  assert.doesNotMatch(compact, /request->>'decision'='revoked'and.*event_play_starts/);
  assert.match(compact, /coalesce\(jsonb_array_length\(consents\),0\)<>6 or exists.*decision'<>'granted'/);
  assert.match(compact, /native_mixed_attendance_consent_bound_v1\(c\.id\)is distinct from true/);
  assert.match(compact, /c\.roster_entry_id=\(b->>'rosterEntryId'\)::uuid and c\.participant_id=\(b->>'participantId'\)::uuid and c\.profile_id=\(b->>'profileId'\)::uuid/);
});

test("optional consent transport is auth.uid-bound, default-off, and cannot be called by service role", () => {
  assert.match(transport, /native_mixed_attendance_consent_transport_enabled_v1\(\).*?select false/s);
  assert.match(transport, /declare actor uuid:=auth\.uid\(\)/);
  assert.match(transport, /if actor is null or role_name<>'authenticated'then return null/);
  assert.match(transport, /record_native_mixed_digital_consent_v1\(p_tournament_id,p_event_id,p_request\)/);
  assert.match(transport, /grant execute on function public\.record_native_mixed_digital_consent_v1\(uuid,uuid,jsonb\)to authenticated/);
  assert.doesNotMatch(transport, /grant execute .*service_role/);
  assert.doesNotMatch(transport, /p_actor|actor uuid[,)]/);
});

test("Paper declaration is fictional and independently reviewed without excluding Digital reviewers", () => {
  assert.match(compact, /profile_id uuid check\(profile_id is null\)/);
  assert.match(compact, /mode text not null default'paper'check\(mode='paper'\),fictional boolean not null default true check\(fictional\)/);
  assert.match(compact, /profile_id=actor and role='director'/);
  assert.match(compact, /profile_id=actor and role='cross_checker'/);
  assert.match(compact, /check\(reviewer_id<>preparer_id\)/);
  assert.match(compact, /decision text not null check\(decision='accepted-synthetic-only'\)/);
  assert.doesNotMatch(sql, /reviewer.*mode.*digital|digital.*reviewer/i);
  assert.match(compact, /count\(\*\)from app\.native_mixed_paper_declaration_entries_v1 where declaration_id=d\.id and profile_id is null and mode='paper'and fictional\)<>12/);
});

test("source binds current funding, intent, operations, rows, and latest consent heads", () => {
  assert.match(compact, /native_mixed_funding_seal_source_v1\(s\.tournament_id,s\.event_id\)/);
  assert.match(compact, /i\.id is not distinct from s\.admission_intent_id/);
  assert.match(compact, /b->'roster'is not distinct from s\.roster_capture/);
  for (const fn of ["operation_bound", "scope_bound", "consent_bound", "declaration_bound", "review_bound"]) {
    assert.match(sql, new RegExp(`native_mixed_attendance_${fn}_v1`));
  }
  assert.match(compact, /c\.version=\(select max\(x\.version\).*x\.roster_entry_id=c\.roster_entry_id\)/);
  assert.match(compact, /z\.source_capture is not distinct from v and z\.source_digest=v->>'sourceDigest'/);
});

test("source makes no ordinary attendance, payment, draw, Start, or money claim", () => {
  const forbiddenWrites = ["event_check_in_events", "event_check_in_requests", "event_attendance_windows",
    "event_participant_status_events", "event_play_starts", "initial_seating_publications", "event_schedule_publications",
    "roster_payment_events", "roster_payment_obligation_versions"];
  for (const table of forbiddenWrites) {
    assert.doesNotMatch(compact, new RegExp(`(?:insert into|update|delete from) app\\.${table}`));
  }
  for (const flag of ["ordinaryAttendanceUsed", "paymentVerified", "humanPresenceVerified", "physicalPresenceVerified",
    "actualMoneyReceived", "moneyMoved", "refundAuthorized", "payoutAuthorized", "finalizationAuthorized",
    "normalDrawAuthorized", "normalStartAuthorized"]) {
    assert.match(compact, new RegExp(`'${flag}',false`));
  }
  assert.doesNotMatch(sql, /source\s*=\s*['"](?:qr|desk)['"]/i);
  assert.doesNotMatch(sql, /operation_kind\s*=\s*['"]reinstate['"]/i);
});

