import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  isChangeDirectorStatusRequest,
  isCreateTournamentRequest,
  isDirectorAccessWorkspace,
  isDirectorAdminWorkspace,
  isReviewDirectorRequest,
  isTournamentCreated,
} from "../src/lib/api/director-administration.ts";

const root = process.cwd();
const uuid = "a1630000-0000-4000-8000-000000000001";
const read = (file) => readFile(path.join(root, file), "utf8");

test("director administration request and response contracts are exact", () => {
  assert.equal(isCreateTournamentRequest({ name: "Full Rehearsal", plannedStartDate: "2026-09-16", idempotencyKey: uuid }), true);
  assert.equal(isCreateTournamentRequest({ name: "Full Rehearsal", plannedStartDate: "09-16-2026", idempotencyKey: uuid }), false);
  assert.equal(isCreateTournamentRequest({ name: "Full Rehearsal", plannedStartDate: "2026-09-16", idempotencyKey: uuid, role: "owner" }), false);
  assert.equal(isReviewDirectorRequest({ decision: "approve", accVerified: false, note: null, idempotencyKey: uuid }), true);
  assert.equal(isReviewDirectorRequest({ decision: "approve", accVerified: "yes", note: null, idempotencyKey: uuid }), false);
  assert.equal(isChangeDirectorStatusRequest({ status: "suspended", note: "Review required", idempotencyKey: uuid }), true);
  assert.equal(isChangeDirectorStatusRequest({ status: "suspended", note: "", idempotencyKey: uuid }), false);
  assert.equal(isTournamentCreated({ status: "tournament_created", tournamentId: uuid, tournamentName: "Full Rehearsal", tournamentDate: "09-16-2026" }), true);
});

test("private workspaces reveal only bounded administration fields", () => {
  assert.equal(isDirectorAccessWorkspace({
    canCreateTournament: true, isPlatformAdmin: true, administratorType: "app_owner",
    directorStatus: "approved", accVerified: false, pendingApplicationId: null,
  }), true);
  assert.equal(isDirectorAccessWorkspace({
    canCreateTournament: true, isPlatformAdmin: true, administratorType: "app_owner",
    directorStatus: "approved", accVerified: false, pendingApplicationId: null, email: "hidden@test.invalid",
  }), false);
  assert.equal(isDirectorAdminWorkspace({
    administratorType: "app_owner",
    applications: [{ applicationId: uuid, applicantProfileId: "a1630000-0000-4000-8000-000000000002", displayName: "Applicant", status: "pending", submittedAt: "2026-09-13T00:00:00Z", decidedAt: null, decisionNote: null, accVerified: false }],
    authorizations: [{ profileId: "a1630000-0000-4000-8000-000000000003", displayName: "Director", status: "approved", accVerified: false, version: 1, updatedAt: "2026-09-13T00:00:00Z" }],
  }), true);
});

test("database migration enforces platform authority, audit, replay, and separate ACC verification", async () => {
  const sql = await read("database/migrations/0163_director_administration_and_tournament_creation.sql");
  assert.match(sql, /create table app\.platform_administrators/);
  assert.match(sql, /create table app\.director_applications/);
  assert.match(sql, /create table app\.director_authorizations/);
  assert.match(sql, /create table app\.platform_audit_events/);
  assert.match(sql, /force row level security/g);
  assert.match(sql, /auth\.jwt\(\)->>'role'/);
  assert.match(sql, /acc_verification_requires_acc_admin/);
  assert.match(sql, /director_approval_required/);
  assert.match(sql, /duplicate_tournament/);
  assert.match(sql, /insert into app\.tournament_roles\(tournament_id,profile_id,role\)/);
  assert.match(sql, /'tournament_draft_created'/);
  assert.match(sql, /planned_start_date/);
  assert.match(sql, /grant execute on function public\.create_tournament_draft_v1.*service_role/s);
  assert.doesNotMatch(sql, /grant execute on function public\.create_tournament_draft_v1.*authenticated/s);
});

test("all platform mutations have verified-session, same-origin, and server-only boundaries", async () => {
  const routes = await Promise.all([
    "src/app/api/v1/director-applications/route.ts",
    "src/app/api/v1/director/tournaments/route.ts",
    "src/app/api/v1/platform/director-applications/[id]/route.ts",
    "src/app/api/v1/platform/directors/[id]/route.ts",
  ].map(read));
  for (const route of routes) {
    assert.match(route, /isSameOriginRequest\(request\)/);
    assert.match(route, /requireVerifiedSubject\(await createClient\(\)\)/);
    assert.match(route, /readSmallJson\(request\)/);
    assert.match(route, /withApiFailureBoundary/);
  }
  const adapter = await read("src/lib/director-administration.ts");
  assert.match(adapter, /^import "server-only";/);
  assert.match(adapter, /createServerOnlyAdminClient\(\)/);
});

test("signed-in home, create page, and administration page expose the intended workflow", async () => {
  const [home, actions, creation, admin] = await Promise.all([
    read("src/app/page.tsx"), read("src/components/director-access-actions.tsx"),
    read("src/app/director/tournaments/new/page.tsx"), read("src/app/platform/directors/page.tsx"),
  ]);
  assert.match(home, /getDirectorAccessWorkspace/);
  assert.match(home, /DirectorAccessActions/);
  assert.match(actions, />Create Tournament</);
  assert.match(actions, /Request director access/);
  assert.match(actions, />Director Administration</);
  assert.match(creation, /access\?\.canCreateTournament.*notFound/s);
  assert.match(admin, /getDirectorAdminWorkspace/);
  assert.match(admin, /Approve app access separately from official ACC verification/);
});
