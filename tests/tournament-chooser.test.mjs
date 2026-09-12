import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isAccessibleTournamentList } from "../src/lib/api/tournament-chooser.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const id = "10000000-0000-4000-8000-000000000001";
const tournament = {
  tournamentId: id,
  tournamentName: "Topaz Winter Wonderland",
  tournamentDate: "01-27-2026",
  tournamentStatus: "open",
  effectiveRole: "player",
};

test("tournament chooser validates a bounded exact private projection", () => {
  assert.equal(isAccessibleTournamentList([tournament]), true);
  assert.equal(isAccessibleTournamentList([{ ...tournament, tournamentId: "10000000-0000-0000-0000-000000000001" }]), true);
  assert.equal(isAccessibleTournamentList([]), true);
  assert.equal(isAccessibleTournamentList([{ ...tournament, tournamentId: "not-a-uuid" }]), false);
  assert.equal(isAccessibleTournamentList([{ ...tournament, tournamentDate: "January 27" }]), false);
  assert.equal(isAccessibleTournamentList([{ ...tournament, tournamentStatus: "archived" }]), false);
  assert.equal(isAccessibleTournamentList([{ ...tournament, effectiveRole: "owner" }]), false);
  assert.equal(isAccessibleTournamentList([{ ...tournament, memberNames: ["Private Person"] }]), false);
  assert.equal(isAccessibleTournamentList([tournament, tournament]), false);
});

test("database chooser is server-only, actor-scoped, role deterministic, and excludes archives", () => {
  const sql = read("database/migrations/0134_signed_in_tournament_chooser.sql");
  assert.match(sql, /\(select auth\.role\(\)\) = 'service_role'/);
  assert.match(sql, /role_assignment\.profile_id = p_actor_id/);
  assert.match(sql, /app\.event_participants participant/);
  assert.match(sql, /participant\.profile_id = p_actor_id/);
  assert.match(sql, /participant\.status = 'checked_in'/);
  assert.match(sql, /select 'player', 7/);
  assert.match(sql, /tournament\.status in \('draft','open','pending_finalization','finalized'\)/);
  assert.match(sql, /coalesce\(latest_setup\.tournament_name, tournament\.name\)/);
  assert.match(sql, /when 'director' then 1[\s\S]*when 'judge' then 3[\s\S]*when 'cross_checker' then 4[\s\S]*when 'viewer' then 6/);
  assert.match(sql, /limit 1/);
  assert.match(sql, /revoke all[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /display_name|email|phone|address|acc_number|roster/);
});

test("server adapter binds the verified subject and production home renders friendly choices", () => {
  const adapter = read("src/lib/tournaments/accessible-tournaments.ts");
  const page = read("src/app/page.tsx");
  assert.match(adapter, /^import "server-only";/);
  assert.match(adapter, /createServerOnlyAdminClient\(\)\.rpc/);
  assert.match(adapter, /p_actor_id: profileId/);
  assert.match(adapter, /isAccessibleTournamentList/);
  assert.match(page, /getCurrentSubject\(\)/);
  assert.match(page, /getAccessibleTournaments\(subject\)/);
  assert.match(page, />Your tournaments</);
  assert.match(page, /tournament\.tournamentName/);
  assert.match(page, /tournament\.tournamentDate \|\| "Date not set"/);
  assert.match(page, /href={`\/tournament\/\$\{tournament\.tournamentId\}`}/);
  assert.match(page, />No tournament access yet</);
  assert.match(page, /href="\/demo"/);
});
