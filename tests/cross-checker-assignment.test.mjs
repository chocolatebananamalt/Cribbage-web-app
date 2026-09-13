import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  isCrossCheckerAssignmentRequest,
  isCrossCheckerAssignmentResult,
  isCrossCheckerAssignmentWorkspace,
} from "../src/lib/api/cross-checker-assignment.ts";

const root = process.cwd();
const tournamentId = "b1610000-0000-4000-8000-000000000001";
const rosterEntryId = "d1610000-0000-4000-8000-000000000001";

test("cross-checker assignment contracts are exact", () => {
  assert.equal(isCrossCheckerAssignmentRequest({ rosterEntryId, operationId: "e1610000-0000-4000-8000-000000000001" }), true);
  assert.equal(isCrossCheckerAssignmentRequest({ rosterEntryId, operationId: "bad" }), false);
  assert.equal(isCrossCheckerAssignmentRequest({ rosterEntryId, operationId: "e1610000-0000-4000-8000-000000000001", extra: true }), false);
  assert.equal(isCrossCheckerAssignmentResult({ status: "cross_checker_assigned", tournamentId, rosterEntryId }, tournamentId, rosterEntryId), true);
  assert.equal(isCrossCheckerAssignmentWorkspace({
    tournamentName: "October Test",
    assignments: [{ assignmentId: "f1610000-0000-4000-8000-000000000001", displayName: "Assigned Person", assignedAt: null }],
    candidates: [{ rosterEntryId, displayName: "Candidate Person", identityHint: `ACC # HI-296 · Ref ${rosterEntryId.toUpperCase()}` }],
  }), true);
  assert.equal(isCrossCheckerAssignmentWorkspace({ tournamentName: "October Test", assignments: [], candidates: [{ rosterEntryId, displayName: "Candidate", identityHint: `Roster · Ref ${rosterEntryId.toUpperCase()}` }, { rosterEntryId, displayName: "Duplicate", identityHint: `Roster · Ref ${rosterEntryId.toUpperCase()}` }] }), false);
});

test("assignment route has the private mutation boundary", async () => {
  const route = await readFile(path.join(root, "src/app/api/v1/tournaments/[id]/cross-checkers/route.ts"), "utf8");
  assert.match(route, /isSameOriginRequest\(request\)/);
  assert.match(route, /readSmallJson\(request\)/);
  assert.match(route, /requireVerifiedSubject\(await createClient\(\)\)/);
  assert.match(route, /createServerOnlyAdminClient\(\)/);
  assert.match(route, /isCrossCheckerAssignmentRequest/);
  assert.match(route, /withApiFailureBoundary/);
});

test("director assignment screen is protected and discoverable", async () => {
  const page = await readFile(path.join(root, "src/app/tournament/[tournamentId]/cross-checkers/page.tsx"), "utf8");
  const client = await readFile(path.join(root, "src/app/tournament/[tournamentId]/cross-checkers/cross-checker-assignment-client.tsx"), "utf8");
  const home = await readFile(path.join(root, "src/app/tournament/[tournamentId]/page.tsx"), "utf8");
  assert.match(page, /requireTournamentAccess/);
  assert.match(page, /\["director", "co_director"\]\.includes\(access\.role\).*notFound/s);
  assert.match(page, /assignments are permanent from this screen/);
  assert.match(client, /I confirm this person will independently check other players/);
  assert.match(client, /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(client, /localStorage|sessionStorage/);
  assert.match(home, /cross-checkers.*Cross-checker assignments/);
});

test("migration is assignment-only, audited, scoped, and service-only", async () => {
  const sql = await readFile(path.join(root, "database/migrations/0161_cross_checker_assignment.sql"), "utf8");
  assert.match(sql, /create table app\.cross_checker_assignment_events/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /cross_checker_assignment_events_immutable/);
  assert.match(sql, /coalesce\(auth\.role\(\), ''\) <> 'service_role'/);
  assert.match(sql, /actor_role\.role in \('director', 'co_director'\)/);
  assert.match(sql, /link_row\.tournament_id = roster\.tournament_id/);
  assert.match(sql, /v_profile_id = p_actor_id/);
  assert.match(sql, /protected_role\.role in \('director', 'co_director', 'judge'/);
  assert.match(sql, /identityHint/);
  assert.match(sql, /' · Ref ', upper\(roster\.id::text\)/);
  assert.doesNotMatch(sql, /upper\(left\(roster\.id::text/);
  assert.match(sql, /insert into app\.operation_receipts/);
  assert.match(sql, /insert into app\.audit_events/);
  assert.match(sql, /cross_checker_assignment_operation_conflicts/);
  assert.match(sql, /'cross_checker_assignment_rejected'/);
  assert.match(sql, /'rejected', v_response/);
  assert.match(sql, /insert into app\.tournament_roles\(tournament_id, profile_id, role\)/);
  assert.doesNotMatch(sql, /delete from app\.tournament_roles|update app\.tournament_roles/);
  assert.match(sql, /revoke all on function public\.assign_cross_checker_v1.*public, anon, authenticated/s);
  assert.match(sql, /grant execute on function public\.assign_cross_checker_v1.*service_role/s);
});
