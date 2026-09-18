import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, "utf8");
const sql = read("database/migrations/0217_event_attendance_readiness.sql");
const retiredEventSql = read("database/migrations/0218_event_check_in_hides_retired_events.sql");
const api = read("src/app/api/v1/tournaments/[id]/event-check-in/route.ts");
const client = read("src/app/tournament/[tournamentId]/event-check-in/event-check-in-client.tsx");

test("event check-in closes only after every active enrollee has a disposition", () => {
  assert.match(sql, /event_attendance_unresolved_count_v1/);
  assert.match(sql, /coalesce\(latest\.state,'cancelled'\) not in \('checked_in','no_show'\)/);
  assert.match(sql, /'attendance_incomplete','unresolvedCount',v_unresolved/);
  assert.match(client, /Close becomes available after every enrolled player is checked in or marked as a no-show/);
});

test("attendance corrections are audited, reasoned, retry-safe, and pre-start only", () => {
  assert.match(sql, /set_event_attendance_v1/);
  assert.match(sql, /p_state not in \('no_show','cancelled'\)/);
  assert.match(sql, /length\(trim\(coalesce\(p_reason,''\)\)\) not between 1 and 500/);
  assert.match(sql, /app\.event_play_state_v1\(p_event_id\) in \('in_progress','completed','finalized'\)/);
  assert.match(sql, /event_no_show_recorded/);
  assert.match(sql, /event_attendance_reset/);
  assert.match(sql, /idempotency_conflict/);
  assert.match(api, /isDirectorAttendanceAction/);
  assert.match(sql, /coalesce\(\(select version from app\.event_check_in_windows where event_id=p_event_id for update\),0\)\+1/);
});

test("a player cannot remain checked into two unfinished events", () => {
  assert.match(sql, /event_attendance_conflict_v1/);
  assert.match(sql, /latest\.state='checked_in'/);
  assert.match(sql, /event_play_state_v1\(latest\.event_id\) not in \('completed','finalized'\)/);
  assert.match(sql, /already_checked_in_to_another_event/);
  assert.match(sql, /event-presence:/);
  assert.match(client, /already checked into another event that has not finished/);
});

test("workspace exposes current attendance and payment evidence rather than historical check-in arrays", () => {
  assert.match(sql, /'attendanceState',coalesce\(latest\.state,'unresolved'\)/);
  assert.match(sql, /'amountOwedMinor'/);
  assert.match(sql, /'amountReceivedMinor'/);
  assert.match(sql, /'paymentMethod'/);
  assert.match(client, /row\.events\?\.find/);
  assert.match(client, /row\.checkedInEventIds\?\.includes/);
});

test("retired and replaced events remain historical and cannot re-enter check-in", () => {
  assert.match(retiredEventSql, /e\.operational_state='active'/);
  assert.match(retiredEventSql, /join app\.events e on e\.id=q\.event_id[^\n]+e\.operational_state='active'/);
  assert.match(retiredEventSql, /join app\.events e on e\.id=p\.event_id[^\n]+e\.operational_state='active'/);
  assert.match(retiredEventSql, /'event_unavailable'/);
});

test("event selection keeps its label readable instead of shrinking beside the full-width menu", () => {
  const css = read("src/app/globals.css");
  assert.match(client, /className="event-check-in-selector"/);
  assert.match(client, /<span>Event<\/span><select/);
  assert.match(css, /\.policy-settings>label\.event-check-in-selector \{ display:grid;/);
});
